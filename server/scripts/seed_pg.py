"""把 app/seed_knowledge.json 的 17 条知识幂等灌入 pg（embedding 留 NULL，等 embedding 接入后回填）。

用法（见 server/README.md）：
    $env:DATABASE_URL="postgresql://lux3d:lux3d@127.0.0.1:25433/lux3d"
    python scripts/seed_pg.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

SEED_PATH = Path(__file__).resolve().parents[1] / "app" / "seed_knowledge.json"

_UPSERT = """
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


def main() -> int:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        print("缺 DATABASE_URL 环境变量（参考 server/README.md 的 pg 模式一节）")
        return 1
    raw = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    entries = raw.get("entries", [])
    if not entries:
        print(f"{SEED_PATH} 无 entries")
        return 1

    import psycopg

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for item in entries:
                cur.execute(
                    _UPSERT,
                    {
                        "id": item["id"],
                        "zone_id": item.get("zoneId"),
                        "object_id": item.get("objectId"),
                        "camera_id": item.get("cameraId"),
                        "title": item["title"],
                        "topics": list(item.get("topics") or []),
                        "content": item["content"],
                        "sources": list(item.get("sources") or []),
                        "confidence": item.get("confidence") or "verified",
                    },
                )
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM knowledge_entries")
            total = cur.fetchone()[0]
    print(f"灌库完成：seed {len(entries)} 条，knowledge_entries 现有 {total} 行（embedding 留 NULL）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
