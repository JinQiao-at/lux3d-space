"""Pydantic 数据契约。

字段命名与前端知识条目 schema 对齐（camelCase 输出，snake_case 兼容输入），
对应设计文档第 6 章「知识条目 schema」与第 12 章「API 清单」。
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Confidence = Literal["verified", "inferred", "uncertain"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class KnowledgeEntry(CamelModel):
    id: str
    zone_id: str
    object_id: str | None = None
    camera_id: str | None = None
    title: str
    topics: list[str] = Field(default_factory=list)
    content: str
    sources: list[str] = Field(default_factory=list)
    confidence: Confidence = "verified"
    related_object_ids: list[str] = Field(default_factory=list)
    spoiler_level: int = Field(default=0, ge=0, le=3)


class SearchRequest(CamelModel):
    query: str = Field(min_length=1, max_length=200)
    zone_id: str | None = None
    topics: list[str] = Field(default_factory=list)
    limit: int = Field(default=5, ge=1, le=20)
    min_confidence: Confidence | None = None


class SearchHit(CamelModel):
    entry: KnowledgeEntry
    score: float


class SearchResponse(CamelModel):
    query: str
    hits: list[SearchHit]
    took_ms: int


class ProgressState(CamelModel):
    """前端 Zustand 存档的透传结构；后端不解释具体游戏语义，只校验版本与大小。"""

    version: int = 1
    save_version: int = 1
    state: dict[str, Any]
    played_seconds: int = 0


class ProgressResponse(CamelModel):
    player_id: str
    progress: ProgressState
    updated_at: str | None = None


class PlayerStateSummary(CamelModel):
    stage: str = "arrival"
    zone: str = "zone_study"
    lantern_lit: bool = False
    flags: dict[str, bool] = Field(default_factory=dict)


class AgentAskRequest(CamelModel):
    question: str = Field(min_length=1, max_length=500)
    player_state: PlayerStateSummary | None = None


class AgentCitation(CamelModel):
    id: str
    title: str
    sources: list[str]
    confidence: str = "verified"


class ToolSuggestion(CamelModel):
    name: str
    arguments: dict[str, Any]


class AgentAskResponse(CamelModel):
    answer: str
    citations: list[AgentCitation]
    suggested_tools: list[ToolSuggestion]
    grounded: bool


class EventIn(CamelModel):
    name: str
    player_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
