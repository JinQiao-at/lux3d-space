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
            raise RuntimeError("未配置 EMBEDDING_*，无法进行向量检索")

        where = ["TRUE"]
        filter_params: list[object] = []
        if req.zone_id:
            where.append("zone_id = %s")
            filter_params.append(req.zone_id)
        if req.topics:
            where.append("topics && %s::text[]")
            filter_params.append(req.topics)
        if req.min_confidence:
            where.append("confidence = ANY(%s::text[])")
            filter_params.append(list(_CONF_RANK)[: _CONF_RANK[req.min_confidence]])

        sql = f"""
            SELECT id, zone_id, object_id, camera_id, title, topics, content,
                   sources, confidence, related_object_ids, spoiler_level,
                   1 - (embedding <=> %s::vector) AS score
            FROM knowledge_entries
            WHERE {' AND '.join(where)}
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """
        # 占位符顺序：SELECT 打分向量 → WHERE 过滤参数 → ORDER BY 向量 → LIMIT
        ordered_params = [vector, *filter_params, vector, req.limit]
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(sql, ordered_params)
                rows = await cur.fetchall()
        return [SearchHit(entry=self._row_to_entry(row), score=round(float(row[-1]), 4)) for row in rows]

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
