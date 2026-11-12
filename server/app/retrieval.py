"""检索层：mock 模式用词法打分；pg 模式用 pgvector 余弦检索。

迁移路径（对应设计文档第 10/12 章）：
1. 内容流水线用 embedding 模型把知识条目转向量，写入 knowledge_entries.embedding；
2. 把 LUX3D_MODE 设为 pg 并配置 DATABASE_URL / EMBEDDING_*；
3. 前端 API 契约不变 —— 检索结果始终返回 KnowledgeEntry + score。
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Protocol

from .embeddings import embed_text
from .models import Confidence, KnowledgeEntry, SearchHit, SearchRequest

_CJK = re.compile(r"[\u4e00-\u9fff]")
_TOKEN_RE = re.compile(r"[a-z0-9]+|[\u4e00-\u9fff]+")
_CONF_RANK: dict[Confidence, int] = {"verified": 3, "inferred": 2, "uncertain": 1}


def _tokens(text: str) -> list[str]:
    """中文用双字词（长度 1 的查询保留单字），避免单字噪声造成"无关问题也命中"。"""
    out: list[str] = []
    for match in _TOKEN_RE.finditer(text.lower()):
        token = match.group(0)
        if _CJK.match(token):
            if len(token) == 1:
                out.append(token)
            else:
                out.extend(token[i : i + 2] for i in range(len(token) - 1))
        else:
            out.append(token)
    return out


# 低于该分值视为"无效命中"（宁可拒答也不编造）
MIN_SCORE = 1.5
# 向量余弦拒答线（PgVectorRetriever 专用）：与词法分量纲不同，实测校准见 T-031 handoff
MIN_VECTOR_SCORE = 0.55


@dataclass
class LexicalIndex:
    entries: list[KnowledgeEntry]

    def search(self, req: SearchRequest) -> list[SearchHit]:
        query = req.query.strip().lower()
        query_tokens = _tokens(query)
        hits: list[SearchHit] = []

        for entry in self.entries:
            if req.zone_id and entry.zone_id != req.zone_id:
                continue
            if req.topics and not set(map(str.lower, req.topics)) & set(map(str.lower, entry.topics)):
                continue
            if req.min_confidence and _CONF_RANK[entry.confidence] < _CONF_RANK[req.min_confidence]:
                continue

            title = entry.title.lower()
            content = entry.content.lower()
            topics = [topic.lower() for topic in entry.topics]
            score = 0.0

            if query and query in title:
                score += 6.0
            if query and query in content:
                score += 3.0
            if query and any(topic in query or query in topic for topic in topics):
                score += 4.0

            for token in query_tokens:
                if not token:
                    continue
                if token in title:
                    score += 2.0
                if any(token in topic for topic in topics):
                    score += 1.5
                if token in content:
                    score += 1.0

            # 置信度轻微加权，避免低置信条目压过高置信条目
            score *= {3: 1.0, 2: 0.9, 1: 0.8}[_CONF_RANK[entry.confidence]]
            if score >= MIN_SCORE:
                hits.append(SearchHit(entry=entry, score=round(score, 3)))

        hits.sort(key=lambda hit: (-hit.score, _CONF_RANK[hit.entry.confidence]))
        return hits[: req.limit]


class Retriever(Protocol):
    async def search(self, req: SearchRequest) -> list[SearchHit]: ...


class MockRetriever:
    def __init__(self, entries: list[KnowledgeEntry]) -> None:
        self.index = LexicalIndex(entries)

    async def search(self, req: SearchRequest) -> list[SearchHit]:
        return self.index.search(req)


class PgVectorRetriever:
    """生产检索：pgvector `<=>` 余弦距离；embedding 由 embeddings.embed_text 提供。"""

    def __init__(self, entry_cache: list[KnowledgeEntry] | None = None) -> None:
        self._cache = {entry.id: entry for entry in entry_cache or []}

    async def search(self, req: SearchRequest) -> list[SearchHit]:
        from .db import get_pool

        pool = await get_pool()
        if pool is None:
            raise RuntimeError("pg 模式未初始化连接池")
        vector = await embed_text(req.query)
        if vector is None:
            # 未配置 EMBEDDING_*：降级为库内词法检索（与 mock 同一套打分/拒答逻辑），避免 500。
            return await self._lexical_from_db(req)

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT id, zone_id, object_id, camera_id, title, topics, content,
                           sources, confidence, related_object_ids, spoiler_level,
                           1 - (embedding <=> %(vector)s::vector) AS score
                    FROM knowledge_entries
                    WHERE (COALESCE(%(zone_id)s, '') = '' OR zone_id = %(zone_id)s)
                      AND (COALESCE(cardinality(%(topics)s::text[]), 0) = 0
                           OR topics && %(topics)s::text[])
                      AND (COALESCE(cardinality(%(min_conf)s::text[]), 0) = 0
                           OR confidence = ANY(%(min_conf)s::text[]))
                    ORDER BY embedding <=> %(vector)s::vector
                    LIMIT %(limit)s
                    """,
                    self._query_params(req, vector=vector),
                )
                rows = await cur.fetchall()
        # T-028 语义拒答阈值：向量余弦分 ∈[0,1]，量纲与词法分（1.5+）不同。
        # 实测校准：语义改述「一盏照亮黑暗的旧提灯」top1=0.7154，无关问题「玻尔」=0.4865 → 取 0.55 分界。
        hits = [
            SearchHit(entry=self._row_to_entry(row), score=round(float(row[-1]), 4))
            for row in rows
            if float(row[-1]) >= MIN_VECTOR_SCORE
        ]
        return hits

    @staticmethod
    def _query_params(req: SearchRequest, **extra: object) -> dict[str, object]:
        """命名参数固定模板：条件开关全部参数化，SQL 文本零拼接。

        数组参数恒传 list（None 会被 psycopg 序列化成无效数组字面量），开关用 cardinality 判断。
        """
        params: dict[str, object] = {
            "zone_id": req.zone_id,
            "topics": list(req.topics) if req.topics else [],
            "min_conf": list(_CONF_RANK)[: _CONF_RANK[req.min_confidence]] if req.min_confidence else [],
            "limit": req.limit,
        }
        params.update(extra)
        return params

    async def _lexical_from_db(self, req: SearchRequest) -> list[SearchHit]:
        """无 embedding 的词法降级：库内行交给 LexicalIndex（分制与 mock 一致）。"""
        from .db import get_pool

        pool = await get_pool()
        if pool is None:
            raise RuntimeError("pg 模式未初始化连接池")
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT id, zone_id, object_id, camera_id, title, topics, content,
                           sources, confidence, related_object_ids, spoiler_level
                    FROM knowledge_entries
                    WHERE (COALESCE(%(zone_id)s, '') = '' OR zone_id = %(zone_id)s)
                      AND (COALESCE(cardinality(%(topics)s::text[]), 0) = 0
                           OR topics && %(topics)s::text[])
                      AND (COALESCE(cardinality(%(min_conf)s::text[]), 0) = 0
                           OR confidence = ANY(%(min_conf)s::text[]))
                    """,
                    self._query_params(req),
                )
                rows = await cur.fetchall()
        return LexicalIndex([self._row_to_entry(row) for row in rows]).search(req)

    def _row_to_entry(self, row: tuple) -> KnowledgeEntry:
        return KnowledgeEntry(
            id=row[0], zone_id=row[1], object_id=row[2], camera_id=row[3], title=row[4],
            topics=list(row[5] or []), content=row[6], sources=list(row[7] or []),
            confidence=row[8], related_object_ids=list(row[9] or []), spoiler_level=row[10],
        )


def load_seed_entries(path) -> list[KnowledgeEntry]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [KnowledgeEntry(**item) for item in raw["entries"]]


def build_retriever(use_pg: bool, seed_entries: list[KnowledgeEntry]) -> Retriever:
    if use_pg:
        return PgVectorRetriever(seed_entries)
    return MockRetriever(seed_entries)


def elapsed_ms(start: float) -> int:
    return int((time.perf_counter() - start) * 1000)
