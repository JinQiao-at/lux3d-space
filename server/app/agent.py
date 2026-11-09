"""受控叙事 Agent（规则 stub → LLM function calling，issue #3 清单项）。

本文件与设计文档第 10 章一一对应：
- 检索：先走 Retriever（mock 词法 / pg 向量），回答必须引用条目 id 与 sources；
- 工具：TOOLS 是前端 function calling 的契约（与 demo 的 Agent 面板一致）；
- 权限：Agent 只读游戏状态，只能建议前端工具，不能直接改 flags/stage；
- 降级：无 LLM key 时使用模板拼装，保证「不编造、无命中显式声明」。

LLM 模式（T-026）：配 LLM_API_KEY 后 answer 走 function calling——
server 端真执行只读数据工具（search_knowledge / get_player_state / list_zone_objects），
视觉/叙事/提示类工具（focus_object 等）转为 suggestedTools 由前端执行；
任何失败静默降级模板拼装。默认 glm-4-flash（免费档，不产生费用）。
"""
from __future__ import annotations

from .models import (
    AgentAskRequest,
    AgentAskResponse,
    AgentCitation,
    SearchRequest,
    ToolSuggestion,
)
from .retrieval import Retriever

# 与 demo/src/data/knowledge.ts、设计文档附录一致的工具白名单（JSON Schema 摘要）。
TOOLS: list[dict] = [
    {
        "name": "search_knowledge",
        "description": "按关键词/主题检索叙事空间的知识档案，返回带来源的条目。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "zoneId": {"type": "string"},
                "topics": {"type": "array", "items": {"type": "string"}},
                "limit": {"type": "integer", "minimum": 1, "maximum": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "focus_object",
        "description": "把镜头移动到指定物体的预设机位并高亮它。仅影响镜头与视觉，不改变剧情状态。",
        "parameters": {
            "type": "object",
            "properties": {"objectId": {"type": "string"}, "cameraId": {"type": "string"}},
            "required": ["objectId"],
        },
    },
    {
        "name": "highlight_object",
        "description": "在 3D 场景中高亮指定物体，用于引导注意力。",
        "parameters": {
            "type": "object",
            "properties": {"objectId": {"type": "string"}, "durationMs": {"type": "integer"}},
            "required": ["objectId"],
        },
    },
    {
        "name": "show_narration",
        "description": "在叙事日志中展示一段文字，必须给出知识来源 id。",
        "parameters": {
            "type": "object",
            "properties": {"text": {"type": "string"}, "sourceIds": {"type": "array", "items": {"type": "string"}}},
            "required": ["text"],
        },
    },
    {
        "name": "get_player_state",
        "description": "只读获取玩家当前 stage、zone、提灯状态与 flags，用于回答“我在哪/我该做什么”。",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "list_zone_objects",
        "description": "列出指定区域内可调查对象及其交互状态。",
        "parameters": {"type": "object", "properties": {"zoneId": {"type": "string"}}, "required": ["zoneId"]},
    },
    {
        "name": "request_hint",
        "description": "按当前进度返回 1-3 级提示，不计入失败惩罚。",
        "parameters": {"type": "object", "properties": {"level": {"type": "integer", "enum": [1, 2, 3]}}},
    },
]

SYSTEM_PROMPT = """你是 DSH 叙事空间的档案管理员。只依据检索到的知识条目回答，不要编造。
规则：
1. 知识类结论后用 [条目 id] 标注来源，id 只能是检索结果里的知识条目 id（kb_ 开头），工具调用不标注；无检索命中时明确回答“档案中没有这条记录”。
2. 你只能调用白名单工具；不得修改游戏状态、道具或剧情进度。
3. 回答控制在 3 句话内；需要引导玩家时建议 focus_object / highlight_object。
4. 不剧透 spoilerLevel 高于玩家当前进度的内容。"""


def _fallback_answer(req: AgentAskRequest, citations: list[AgentCitation]) -> str:
    if not citations:
        return "档案里没有找到与这个问题相关的记录。你可以换一个关键词，或去书房里再调查一下。"
    titles = "、".join(f"《{item.title}》" for item in citations[:2])
    return (
        f"档案里与“{req.question.strip()}”最相关的是 {titles}。"
        f"要点已列在下方引文里，可以点击定位到对应物件。"
    )


async def answer_question(req: AgentAskRequest, retriever: Retriever) -> AgentAskResponse:
    hits = await retriever.search(SearchRequest(query=req.question, limit=3))
    citations = [
        AgentCitation(
            id=hit.entry.id,
            title=hit.entry.title,
            sources=hit.entry.sources,
            confidence=hit.entry.confidence,
        )
        for hit in hits
    ]

    suggestions: list[ToolSuggestion] = []
    if hits:
        top = hits[0].entry
        if top.object_id:
            suggestions.append(ToolSuggestion(name="focus_object", arguments={"objectId": top.object_id, "cameraId": top.camera_id or ""}))
    suggestions.append(ToolSuggestion(name="search_knowledge", arguments={"query": req.question, "limit": 3}))

    # LLM 模式优先（配 LLM_API_KEY 生效）；失败/未配静默降级模板拼装
    llm_response = await _llm_reply(req, retriever)
    if llm_response is not None:
        return llm_response

    answer = _fallback_answer(req, citations)
    # 只有检索有依据时才补进度相关提示；无命中必须保持"不编造"的生硬拒答
    if citations and req.player_state and req.player_state.stage in {"find_light", "light_it"}:
        answer += " 提灯就在书房书架后的暗格里。"
    return AgentAskResponse(answer=answer, citations=citations, suggested_tools=suggestions, grounded=bool(citations))


# ---------------------------------------------------------------------------
# LLM function calling（T-026）
# ---------------------------------------------------------------------------

_LLM_TIMEOUT_S = 20
_MAX_TOOL_ROUNDS = 2
# server 端可真执行的只读数据工具；其余（focus/highlight/show_narration/request_hint）
# 的调用意图转为 suggestedTools，由前端本地执行（契约不变）。
_SERVER_TOOLS = {"search_knowledge", "get_player_state", "list_zone_objects"}
_FORWARD_TOOLS = {"focus_object", "highlight_object", "show_narration", "request_hint"}


def _llm_config() -> dict[str, str] | None:
    from .config import get_settings

    settings = get_settings()
    api_key = settings.llm_api_key.strip()
    if not api_key:
        return None
    return {
        "url": settings.llm_api_url.strip(),
        "model": settings.llm_model.strip(),
        "key": api_key,
    }


def _all_entries(retriever: Retriever) -> list:
    """Duck-typing 取全量条目（mock 走 LexicalIndex.entries，pg 走 entry_cache）。"""
    index = getattr(retriever, "index", None)
    if index is not None and getattr(index, "entries", None):
        return list(index.entries)
    cache = getattr(retriever, "_cache", None)
    if cache:
        return list(cache.values())
    return []


async def _execute_server_tool(name: str, args: dict, req: AgentAskRequest, retriever: Retriever) -> object:
    """server 端真执行的只读工具；返回值序列化后作为 tool 结果回传 LLM。"""
    if name == "search_knowledge":
        hits = await retriever.search(
            SearchRequest(query=str(args.get("query", req.question)), limit=int(args.get("limit", 3)))
        )
        return [
            {"id": h.entry.id, "title": h.entry.title, "content": h.entry.content,
             "sources": h.entry.sources, "confidence": h.entry.confidence}
            for h in hits
        ]
    if name == "get_player_state":
        if req.player_state is None:
            return {"stage": "arrival", "zone": "zone_study", "lanternLit": False, "flags": {}}
        return req.player_state.model_dump()
    if name == "list_zone_objects":
        zone_id = str(args.get("zoneId", req.player_state.zone if req.player_state else "zone_study"))
        return [
            {"objectId": e.object_id, "title": e.title}
            for e in _all_entries(retriever)
            if e.zone_id == zone_id and e.object_id
        ]
    return None


async def _llm_reply(req: AgentAskRequest, retriever: Retriever) -> AgentAskResponse | None:
    """LLM function calling 主循环；任何失败返回 None 由调用方降级，绝不让请求 500。"""
    import json as _json
    import logging

    import httpx

    cfg = _llm_config()
    if cfg is None:
        return None
    logger = logging.getLogger("lux3d.agent")
    # TOOLS 是前端契约的平铺格式；OpenAI 兼容接口（含智谱）要求 type/function 包装
    tools_payload = [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool.get("parameters", {"type": "object", "properties": {}}),
            },
        }
        for tool in TOOLS
    ]

    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": req.question},
    ]
    seen_citations: dict[str, AgentCitation] = {}
    forward_suggestions: list[ToolSuggestion] = []

    try:
        async with httpx.AsyncClient(timeout=_LLM_TIMEOUT_S) as client:
            for _round in range(_MAX_TOOL_ROUNDS + 1):
                resp = await client.post(
                    cfg["url"],
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {cfg['key']}"},
                    json={"model": cfg["model"], "messages": messages, "tools": tools_payload, "max_tokens": 400},
                )
                resp.raise_for_status()
                message = resp.json()["choices"][0]["message"]
                tool_calls = message.get("tool_calls") or []
                if not tool_calls:
                    answer = (message.get("content") or "").strip()
                    if not answer:
                        return None
                    return AgentAskResponse(
                        answer=answer,
                        citations=list(seen_citations.values()),
                        suggested_tools=forward_suggestions,
                        grounded=bool(seen_citations),
                    )

                messages.append({"role": "assistant", "content": message.get("content") or "", "tool_calls": tool_calls})
                for call in tool_calls[:4]:
                    name = call["function"]["name"]
                    try:
                        args = _json.loads(call["function"].get("arguments") or "{}")
                    except _json.JSONDecodeError:
                        args = {}
                    if name in _SERVER_TOOLS:
                        result = await _execute_server_tool(name, args, req, retriever)
                        if name == "search_knowledge":
                            for item in result or []:
                                seen_citations.setdefault(
                                    item["id"],
                                    AgentCitation(id=item["id"], title=item["title"], sources=item["sources"],
                                                  confidence=item["confidence"]),
                                )
                    elif name in _FORWARD_TOOLS:
                        forward_suggestions.append(ToolSuggestion(name=name, arguments=args))
                        result = "已转交前端执行（只读视觉/叙事/提示效果）"
                    else:
                        result = "未知工具，已忽略"
                    messages.append(
                        {"role": "tool", "tool_call_id": call["id"], "content": _json.dumps(result, ensure_ascii=False)}
                    )
    except Exception as error:  # noqa: BLE001 —— LLM 层任何失败都降级，不影响游戏主链
        logger.warning("LLM 模式降级模板拼装: %s: %s", type(error).__name__, error)
        return None
    return None
