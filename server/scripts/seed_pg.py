"""把 app/seed_knowledge.json 的 17 条知识幂等灌入 pg；配置 EMBEDDING_* 时同步回填向量。

用法（见 server/README.md）：
    $env:DATABASE_URL="postgresql://lux3d:lux3d@127.0.0.1:25433/lux3d"
    python scripts/seed_pg.py            # 纯内容灌库（embedding 留 NULL）
    python scripts/seed_pg.py --embed    # 内容 + 逐条调智谱 embedding-3 回填向量（1024 维）
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

SEED_PATH = Path(__file__).resolve().parents[1] / "app" / "seed_knowledge.json"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # 使脚本可 import app.*

# 两个完整静态 SQL（带向量版/不带向量版），全部占位符参数化、零拼接
_UPSERT_PLAIN = """
    INSERT INTO knowledge_entries
        (id, zone_id, object_id, camera_id, title, topics, content, sources, confidence)
    VALUES (%(id)s, %(zone_id)s, %(object_id)s, %(camera_id)s, %(title)s,
            %(topics)s, %(content)s, %(sources)s, %(confidence)s)
    ON CONFLICT (id) DO UPDATE SET
        zone_id = EXCLUDED.zone_id,
        object_id = EXCLUDED.object_id,
        camera_id = EXCLUDED.camera_id,
        title = EXCLUDED.title,
        topics = EXCLUDED.topics,
        content = EXCLUDED.content,
        sources = EXCLUDED.sources,
        confidence = EXCLUDED.confidence,
        updated_at = now()
"""

_UPSERT_WITH_VEC = """
    INSERT INTO knowledge_entries
        (id, zone_id, object_id, camera_id, title, topics, content, sources, confidence,
         embedding, embedding_model)
    VALUES (%(id)s, %(zone_id)s, %(object_id)s, %(camera_id)s, %(title)s,
            %(topics)s, %(content)s, %(sources)s, %(confidence)s,
            %(embedding)s::vector, 'embedding-3')
    ON CONFLICT (id) DO UPDATE SET
        zone_id = EXCLUDED.zone_id,
        object_id = EXCLUDED.object_id,
        camera_id = EXCLUDED.camera_id,
        title = EXCLUDED.title,
        topics = EXCLUDED.topics,
        content = EXCLUDED.content,
        sources = EXCLUDED.sources,
        confidence = EXCLUDED.confidence,
        embedding = EXCLUDED.embedding,
        embedding_model = 'embedding-3',
        updated_at = now()
"""

# 向量输入：标题 + 主题 + 正文（与检索时查询语义对齐）
def _embed_input(item: dict) -> str:
    topics = "、".join(item.get("topics") or [])
    return f"{item['title']}（{topics}）：{item['content']}"


def main() -> int:
    with_embed = "--embed" in sys.argv
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print("缺 DATABASE_URL 环境变量（参考 server/README.md 的 pg 模式一节）")
        return 1
    raw = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    entries = raw.get("entries", [])
    if not entries:
        print(f"{SEED_PATH} 无 entries")
        return 1

    embed = None
    if with_embed:
        # os.getenv 读不到 pydantic 的 .env 文件——脚本侧手动补载（不覆盖已有环境变量）
        env_file = Path(__file__).resolve().parents[1] / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())
        if os.getenv("EMBEDDING_API_KEY", "").strip():
            import asyncio

            from app.embeddings import embed_text  # 复用 app 的 OpenAI 兼容适配层

            def embed(text: str) -> list[float] | None:
                # embed_text 是 async（httpx.AsyncClient）；同步脚本用 asyncio.run 桥接
                return asyncio.run(embed_text(text))

        else:
            print("缺 EMBEDDING_API_KEY（server/.env 或环境变量）——将只灌内容、向量留 NULL")

    import psycopg

    embedded = 0
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for item in entries:
                base = {
                    "id": item["id"],
                    "zone_id": item.get("zoneId"),
                    "object_id": item.get("objectId"),
                    "camera_id": item.get("cameraId"),
                    "title": item["title"],
                    "topics": list(item.get("topics") or []),
                    "content": item["content"],
                    "sources": list(item.get("sources") or []),
                    "confidence": item.get("confidence") or "verified",
                }
                if embed:
                    vector = embed(_embed_input(item))
                    if vector:
                        cur.execute(_UPSERT_WITH_VEC, {**base, "embedding": vector})
                        embedded += 1
                        continue
                    print(f"  {item['id']}: embedding 失败（留 NULL）")
                cur.execute(_UPSERT_PLAIN, base)
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT count(*), count(embedding) FROM knowledge_entries")
            total, with_vec = cur.fetchone()
    print(f"灌库完成：seed {len(entries)} 条；总 {total} 行，向量已回填 {with_vec} 行")
    return 0


if __name__ == "__main__":
    sys.exit(main())
