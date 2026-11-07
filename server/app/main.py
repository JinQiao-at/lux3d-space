"""Lux3D 叙事空间后端入口（FastAPI）。

启动：
    cd server
    python -m venv .venv && .venv\\Scripts\\activate
    pip install -r requirements.txt
    uvicorn app.main:app --host 127.0.0.1 --port 8765

默认 mock 模式：知识检索走词法打分，进度存内存，零依赖即可联调。
接 PostgreSQL + pgvector：docker compose up -d && LUX3D_MODE=pg 配置 DATABASE_URL。
"""
from __future__ import annotations

import json
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .agent import SYSTEM_PROMPT, TOOLS, answer_question
from .config import SEED_PATH, get_settings
from .db import append_event, close_pool, get_progress, init_pool, upsert_progress
from .models import (
    AgentAskRequest,
    AgentAskResponse,
    EventIn,
    KnowledgeEntry,
    ProgressResponse,
    ProgressState,
    SearchRequest,
    SearchResponse,
)
from .retrieval import build_retriever, elapsed_ms, load_seed_entries


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await init_pool(settings)
    entries = load_seed_entries(SEED_PATH)
    app.state.settings = settings
    app.state.entries = entries
    app.state.retriever = build_retriever(settings.use_pg, entries)
    yield
    await close_pool()


settings = get_settings()
app = FastAPI(
    title="Lux3D Narrative Space API",
    version="0.1.0",
    description="3D 叙事空间：知识检索 / 受控 Agent / 进度存档。默认 mock 模式可零依赖启动。",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _progress_payload(player_id: str, data: dict) -> ProgressResponse:
    progress = ProgressState(
        version=data.get("version", 1),
        save_version=data["save_version"],
        state=data["state"],
        played_seconds=data.get("played_seconds", 0),
    )
    return ProgressResponse(player_id=player_id, progress=progress, updated_at=data.get("updated_at"))


@app.get("/")
async def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "mode": "pg" if settings.use_pg else "mock",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health(request: Request) -> dict:
    return {
        "status": "ok",
        "mode": "pg" if request.app.state.settings.use_pg else "mock",
        "entries": len(request.app.state.entries),
    }


@app.get("/api/knowledge", response_model=list[KnowledgeEntry])
async def list_knowledge(request: Request) -> list[KnowledgeEntry]:
    return request.app.state.entries


@app.post("/api/knowledge/search", response_model=SearchResponse)
async def search_knowledge(req: SearchRequest, request: Request) -> SearchResponse:
    started = time.perf_counter()
    hits = await request.app.state.retriever.search(req)
    return SearchResponse(query=req.query, hits=hits, took_ms=elapsed_ms(started))


@app.post("/api/agent/ask", response_model=AgentAskResponse)
async def agent_ask(req: AgentAskRequest, request: Request) -> AgentAskResponse:
    response = await answer_question(req, request.app.state.retriever)
    await append_event("agent_ask", None, {"question": req.question, "grounded": response.grounded})
    return response


@app.get("/api/meta/agent")
async def agent_meta() -> dict:
    """前端 Agent 面板的工具契约（与 demo 的 tools.ts 保持一致）。"""
    return {"systemPrompt": SYSTEM_PROMPT, "tools": TOOLS}


@app.get("/api/progress/{player_id}", response_model=ProgressResponse)
async def read_progress(player_id: str) -> ProgressResponse:
    data = await get_progress(player_id)
    if data is None:
        raise HTTPException(status_code=404, detail="progress not found")
    return _progress_payload(player_id, data)


@app.put("/api/progress/{player_id}", response_model=ProgressResponse)
async def save_progress(player_id: str, payload: ProgressState) -> ProgressResponse:
    if len(json.dumps(payload.state, ensure_ascii=False)) > 512_000:
        raise HTTPException(status_code=413, detail="save state too large")
    data = await upsert_progress(player_id, payload.model_dump())
    await append_event("progress_save", player_id, {"saveVersion": payload.save_version})
    return _progress_payload(player_id, data)


@app.post("/api/events")
async def post_event(event: EventIn) -> dict:
    await append_event(event.name, event.player_id, event.payload)
    return {"ok": True}
