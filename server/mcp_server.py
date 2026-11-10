"""《提灯与暗门》叙事空间 MCP server（stdio）——E5：MCP 服务 + Agent 适配。

把 server 的知识检索与受控 Agent 暴露为 MCP 工具，任何 MCP 客户端
（Claude/DSH/ZCode/评委的 Agent）都能直接查询游戏世界观档案。

- mock 词法检索（seed_knowledge.json 17 条，零外部依赖；pg/LLM 配置通过环境变量透传）；
- 复用 app.agent.answer_question 全链（LLM function calling → 词法 → 模板三态降级）；
- 工具全部只读：不改游戏状态、不写库，与游戏内 Agent 同一护栏（不编造、引用条目 id）。

接入（任意 MCP 客户端配置）：
    command: python
    args:    [server/mcp_server.py 的绝对路径]

自测（不经 MCP 客户端直接验证工具函数）：
    python mcp_server.py --selftest
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcp.server.fastmcp import FastMCP  # noqa: E402

from app.agent import TOOLS, answer_question  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.models import AgentAskRequest, PlayerStateSummary, SearchRequest  # noqa: E402
from app.retrieval import MockRetriever, load_seed_entries  # noqa: E402

SEED_PATH = Path(__file__).resolve().parent / "app" / "seed_knowledge.json"

_settings = get_settings()
_entries = load_seed_entries(SEED_PATH)
_retriever = MockRetriever(_entries)

mcp = FastMCP("lux3d-narrative")


@mcp.tool()
async def search_knowledge(query: str, zone_id: str = "", limit: int = 5) -> str:
    """按关键词检索《提灯与暗门》知识档案，返回带来源的条目与得分。

    Args:
        query: 检索词（中文/英文均可，中文走双字词分词）
        zone_id: 可选区域过滤（zone_study / zone_basement / zone_chamber）
        limit: 返回条数上限（1-10）
    """
    req = SearchRequest(query=query, zone_id=zone_id or None, limit=max(1, min(limit, 10)))
    hits = await _retriever.search(req)
    return json.dumps(
        [
            {"id": h.entry.id, "title": h.entry.title, "zone": h.entry.zone_id,
             "content": h.entry.content, "sources": h.entry.sources,
             "confidence": h.entry.confidence, "score": h.score}
            for h in hits
        ],
        ensure_ascii=False,
    )


@mcp.tool()
async def agent_ask(question: str, stage: str = "arrival", zone: str = "zone_study") -> str:
    """向受控叙事 Agent 提问：回答带知识条目引用；配置 LLM_API_KEY 时走 function calling。

    Args:
        question: 关于游戏世界观/场景/进度的问题（1-500 字）
        stage: 玩家当前阶段（arrival / find_light / light_it / ...）
        zone: 玩家当前区域（zone_study / zone_basement / zone_chamber）
    """
    req = AgentAskRequest(
        question=question,
        player_state=PlayerStateSummary(stage=stage, zone=zone, lantern_lit=False, flags={}),
    )
    resp = await answer_question(req, _retriever)
    return json.dumps(
        {"answer": resp.answer, "citations": [c.model_dump() for c in resp.citations],
         "suggested_tools": [t.model_dump() for t in resp.suggested_tools], "grounded": resp.grounded},
        ensure_ascii=False,
    )


@mcp.tool()
async def list_knowledge() -> str:
    """列出全部知识条目概览（id/标题/区域/主题），用于了解档案全貌后定向检索。"""
    return json.dumps(
        [{"id": e.id, "title": e.title, "zone": e.zone_id, "topics": e.topics} for e in _entries],
        ensure_ascii=False,
    )


@mcp.tool()
async def get_agent_tools() -> str:
    """返回游戏内 Agent 的 7 工具 JSON Schema 契约（与前端 function calling 一致）。"""
    return json.dumps(TOOLS, ensure_ascii=False)


_BOARD_PATH = Path(__file__).resolve().parents[1] / "collab" / "board.json"
_MANIFEST_PATH = Path(__file__).resolve().parents[1] / "pipeline" / "lux3d" / "assets-manifest.json"


@mcp.tool()
async def get_roadmap() -> str:
    """读项目任务板（collab/board.json），返回全部任务的 id/标题/状态/优先级/scope——
    外部 Agent 可据此领取（claim→done 流程见任务板工作流）或核对路线图。"""
    data = json.loads(_BOARD_PATH.read_text(encoding="utf-8"))
    return json.dumps(
        [
            {"id": t["id"], "title": t["title"], "status": t["status"],
             "priority": t.get("priority"), "scope": t.get("scope", [])}
            for t in data.get("tasks", [])
        ],
        ensure_ascii=False,
    )


@mcp.tool()
async def list_assets() -> str:
    """列出 Lux3D 生成管线 17 件资产清单（objectId/中文名/压缩前后体积/任务号/状态）。"""
    data = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assets = data.get("assets", [])
    return json.dumps(
        [
            {"objectId": a.get("objectId"), "label": a.get("label"),
             "glbBytes": a.get("glbBytes"), "glbRawBytes": a.get("glbRawBytes"),
             "taskId": a.get("glbTaskId"), "status": a.get("status")}
            for a in assets
        ],
        ensure_ascii=False,
    )


def _selftest() -> int:
    """不经 stdio 直接调用工具函数，验证检索与 Agent 全链。"""

    async def run() -> int:
        overview = await list_knowledge()
        entries = json.loads(overview)
        assert len(entries) == 17, f"条目数异常: {len(entries)}"
        hits = json.loads(await search_knowledge("提灯"))
        assert hits and hits[0]["id"] == "kb_lantern_origin", f"检索异常: {hits[:1]}"
        ask = json.loads(await agent_ask("提灯有什么来历"))
        assert ask["grounded"] and ask["citations"], f"agent 异常: {ask['answer'][:60]}"
        tools = json.loads(await get_agent_tools())
        assert len(tools) == 7, f"工具数异常: {len(tools)}"
        roadmap = json.loads(await get_roadmap())
        assert len(roadmap) >= 25, f"任务板异常: {len(roadmap)}"
        assets = json.loads(await list_assets())
        assert len(assets) == 17, f"资产清单异常: {len(assets)}"
        print(f"selftest OK: 17 条目 / 检索 top1={hits[0]['id']}({hits[0]['score']}) / "
              f"agent grounded={ask['grounded']} / {len(tools)} 工具契约 / "
              f"roadmap {len(roadmap)} 任务 / assets {len(assets)} 件")
        return 0

    return asyncio.run(run())


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(_selftest())
    mcp.run()  # stdio
