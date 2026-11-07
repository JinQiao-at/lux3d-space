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
    url = os.getenv("EMBEDDING_API_URL", "").strip()
    model = os.getenv("EMBEDDING_MODEL", "").strip()
    if not url or not model:
        return None
    headers = {"Content-Type": "application/json"}
    api_key = os.getenv("EMBEDDING_API_KEY", "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {"model": model, "input": text}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
    return data["data"][0]["embedding"]
