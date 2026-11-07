-- Lux3D 叙事空间 · PostgreSQL + pgvector 表结构
-- 对应设计文档第 12 章；运行方式见 server/README.md。
--
-- docker compose up -d 首次启动会自动执行本文件（挂载到 initdb.d）。

CREATE EXTENSION IF NOT EXISTS vector;

-- 1) 知识条目：ECO 的「实体层」检索单元（一个条目可挂到 zone/object/camera）
CREATE TABLE IF NOT EXISTS knowledge_entries (
    id                  TEXT PRIMARY KEY,
    zone_id             TEXT NOT NULL,
    object_id           TEXT,
    camera_id           TEXT,
    title               TEXT NOT NULL,
    topics              TEXT[] NOT NULL DEFAULT '{}',
    content             TEXT NOT NULL,
    sources             TEXT[] NOT NULL DEFAULT '{}',
    confidence          TEXT NOT NULL DEFAULT 'verified'
                        CHECK (confidence IN ('verified', 'inferred', 'uncertain')),
    related_object_ids  TEXT[] NOT NULL DEFAULT '{}',
    spoiler_level       SMALLINT NOT NULL DEFAULT 0 CHECK (spoiler_level BETWEEN 0 AND 3),
    embedding           vector(1024),
    embedding_model     TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_zone ON knowledge_entries (zone_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_topics ON knowledge_entries USING GIN (topics);
-- HNSW 适合 <= 百万级；更大规模可换 IVFFlat 并按需重建
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
    ON knowledge_entries USING hnsw (embedding vector_cosine_ops);

-- 2) 玩家进度：前端存档整体透传（JSONB），服务端只做版本与大小校验
CREATE TABLE IF NOT EXISTS progress (
    player_id       TEXT PRIMARY KEY,
    state           JSONB NOT NULL,
    save_version    INTEGER NOT NULL DEFAULT 1,
    played_seconds  INTEGER NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) 叙事埋点：stage 推进、线索发现、Agent 调用、提示使用
CREATE TABLE IF NOT EXISTS narrative_events (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    player_id   TEXT,
    payload     JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_player_time ON narrative_events (player_id, created_at DESC);

-- 4) 场景对象注册表（可选：由 Lux3D 资产管线/场景摆放导出，供 Agent 工具与后台审阅）
CREATE TABLE IF NOT EXISTS scene_objects (
    id          TEXT PRIMARY KEY,
    zone_id     TEXT NOT NULL,
    label       TEXT NOT NULL,
    asset_uri   TEXT,
    collider    JSONB,
    meta        JSONB NOT NULL DEFAULT '{}'
);

-- 常用检索 SQL 示例（向量由应用层生成后传入）：
-- SELECT id, title, 1 - (embedding <=> :query_vector) AS score
-- FROM knowledge_entries
-- WHERE zone_id = :zone_id AND topics && :topics
-- ORDER BY embedding <=> :query_vector
-- LIMIT 5;
