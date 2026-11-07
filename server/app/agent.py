"""受控叙事 Agent（规则 stub → 可替换为 LLM + 工具调用）。

本文件与设计文档第 10 章一一对应：
- 检索：先走 Retriever（mock 词法 / pg 向量），回答必须引用条目 id 与 sources；
- 工具：TOOLS 是前端 function calling 的契约（与 demo 的 Agent 面板一致）；
- 权限：Agent 只读游戏状态，只能建议前端工具，不能直接改 flags/stage；
- 降级：无 LLM key 时使用模板拼装，保证「不编造、无命中显式声明」。
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
1. 每条结论后用 [条目 id] 标注来源；无检索命中时明确回答“档案中没有这条记录”。
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
        AgentCitation(id=hit.entry.id, title=hit.entry.title, sources=hit.entry.sources)
        for hit in hits
    ]

    suggestions: list[ToolSuggestion] = []
    if hits:
        top = hits[0].entry
        if top.object_id:
            suggestions.append(ToolSuggestion(name="focus_object", arguments={"objectId": top.object_id, "cameraId": top.camera_id or ""}))
    suggestions.append(ToolSuggestion(name="search_knowledge", arguments={"query": req.question, "limit": 3}))

    answer = _fallback_answer(req, citations)
    # 只有检索有依据时才补进度相关提示；无命中必须保持"不编造"的生硬拒答
    if citations and req.player_state and req.player_state.stage in {"find_light", "light_it"}:
        answer += " 提灯就在书房书架后的暗格里。"
    return AgentAskResponse(answer=answer, citations=citations, suggested_tools=suggestions, grounded=bool(citations))
