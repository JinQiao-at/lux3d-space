"""数据访问层：mock（内存）与 pg（PostgreSQL + pgvector）双后端。

mock 模式让前端/答辩零依赖联调；pg 模式的生产表结构见 db/schema.sql。
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .config import Settings

_pool: Any = None
_memory: dict[str, Any] = {"progress": {}, "events": []}


async def init_pool(settings: Settings) -> None:
    global _pool
    if not settings.use_pg:
        return
    from psycopg_pool import AsyncConnectionPool

    _pool = AsyncConnectionPool(settings.database_url, min_size=1, max_size=5, open=False)
    await _pool.open(wait=True, timeout=15)


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def get_pool() -> Any:
    return _pool


async def get_progress(player_id: str) -> dict[str, Any] | None:
    if _pool is None:
        return _memory["progress"].get(player_id)
    async with _pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT state, save_version, played_seconds, updated_at FROM progress WHERE player_id = %s",
                (player_id,),
            )
            row = await cur.fetchone()
    if row is None:
        return None
    return {
        "state": row[0],
        "save_version": row[1],
        "played_seconds": row[2],
        "updated_at": row[3].isoformat(),
    }


async def upsert_progress(player_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """乐观并发：payload 携带 save_version，服务端只增不减。"""
    now = datetime.now(timezone.utc)
    if _pool is None:
        current = _memory["progress"].get(player_id)
        if current and payload["save_version"] < current["save_version"]:
            payload = {**current}
        _memory["progress"][player_id] = {**payload, "updated_at": now.isoformat()}
        return _memory["progress"][player_id]
    async with _pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO progress (player_id, state, save_version, played_seconds, updated_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (player_id) DO UPDATE SET
                    state = CASE WHEN EXCLUDED.save_version >= progress.save_version
                                 THEN EXCLUDED.state ELSE progress.state END,
                    save_version = GREATEST(progress.save_version, EXCLUDED.save_version),
                    played_seconds = GREATEST(progress.played_seconds, EXCLUDED.played_seconds),
                    updated_at = NOW()
                RETURNING state, save_version, played_seconds, updated_at
                """,
                (player_id, payload["state"], payload["save_version"], payload["played_seconds"], now),
            )
            row = await cur.fetchone()
    return {
        "state": row[0],
        "save_version": row[1],
        "played_seconds": row[2],
        "updated_at": row[3].isoformat(),
    }


async def append_event(name: str, player_id: str | None, payload: dict[str, Any]) -> None:
    if _pool is None:
        _memory["events"].append({"name": name, "player_id": player_id, "payload": payload})
        return
    async with _pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO narrative_events (name, player_id, payload) VALUES (%s, %s, %s)",
                (name, player_id, payload),
            )
