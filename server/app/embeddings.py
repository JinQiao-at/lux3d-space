"""Embedding 适配层。

默认不启用。接入任意 OpenAI 兼容的 embedding 服务（OpenAI、BGE、通义、Ollama 等）即可：
    EMBEDDING_API_URL=https://api.example.com/v1/embeddings
    EMBEDDING_MODEL=bge-m3
    EMBEDDING_API_KEY=sk-xxx

对应设计文档第 10 章「RAG 流程」：内容入库时全量转向量；查询时转向量后走 pgvector。
"""
from __future__ import annotations

import os

import httpx


async def embed_text(text: str) -> list[float] | None:
    # T-027 教训同款：配置走 pydantic Settings（os.getenv 读不到 .env 文件里的值）
    from .config import get_settings

    settings = get_settings()
    url = settings.embedding_api_url.strip()
    model = settings.embedding_model.strip()
    if not url or not model:
        return None
    headers = {"Content-Type": "application/json"}
    api_key = settings.embedding_api_key.strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload: dict = {"model": model, "input": text}
    # 维度对齐：schema 锁 vector(1024)，智谱 embedding-3 用 dimensions 参数指定
    if settings.embedding_dim:
        payload["dimensions"] = settings.embedding_dim
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    return data["data"][0]["embedding"]
