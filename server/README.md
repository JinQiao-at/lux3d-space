# Lux3D 后端服务（FastAPI + PostgreSQL/pgvector）

3D 叙事空间的运行期服务：**知识检索 / 受控叙事 Agent / 进度存档 / 叙事埋点**。
默认 **mock 模式**：不装数据库也能启动，便于前端联调与评审演示；切到 **pg 模式**只改环境变量。

## 快速开始（mock，零依赖）

```powershell
cd lux3d-space\server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 25432
```

- 健康检查：`http://127.0.0.1:25432/api/health`
- 交互式文档：`http://127.0.0.1:25432/docs`

```powershell
curl.exe http://127.0.0.1:25432/api/health
curl.exe -X POST http://127.0.0.1:25432/api/knowledge/search -H "Content-Type: application/json" -d "{\"query\":\"符号\",\"limit\":3}"
```

## 接 PostgreSQL + pgvector（pg 模式）

```powershell
docker compose up -d          # pgvector/pgvector:pg16，宿主端口 25433，自动执行 db/schema.sql
$env:LUX3D_MODE="pg"
$env:DATABASE_URL="postgresql://lux3d:lux3d@127.0.0.1:25433/lux3d"
uvicorn app.main:app --host 127.0.0.1 --port 25432
```

> 端口说明：示例用 25432；本机 Windows 保留了 5041–5763、8058–8157、8300–8399 等 TCP 段（5182/8765/8790 都在其中，WinError 10013），换一个未被排除的端口即可（DB 同理：5433→25433）。

pg 模式下检索走 `embedding <=> query` 余弦距离；需要配置 OpenAI 兼容的 embedding 服务：

```env
EMBEDDING_API_URL=https://api.example.com/v1/embeddings
EMBEDDING_MODEL=bge-m3
EMBEDDING_API_KEY=sk-xxx
```

未配置 embedding 时，pg 模式检索会返回 500 并提示；开发期请用 mock 模式或补齐 embedding 配置。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 模式/条目数健康检查 |
| GET | `/api/knowledge` | 全量知识条目（调试/后台） |
| POST | `/api/knowledge/search` | 检索：`query`、`zoneId`、`topics`、`limit` |
| POST | `/api/agent/ask` | 受控 Agent：检索 + 引用 + 工具建议 |
| GET | `/api/meta/agent` | 前端 Agent 工具契约（system prompt + 工具 JSON Schema） |
| GET | `/api/progress/{player_id}` | 读取玩家存档，无则 404 |
| PUT | `/api/progress/{player_id}` | 写入存档（JSONB + save_version 乐观并发） |
| POST | `/api/events` | 叙事埋点 |

请求/响应字段为 **camelCase**（与前端 schema 对齐），服务端内部 snake_case。

## 目录

```
server/
├── app/
│   ├── main.py            # FastAPI 入口与路由
│   ├── models.py          # Pydantic 契约（camelCase 别名）
│   ├── retrieval.py       # 词法检索 / pgvector 检索
│   ├── embeddings.py      # embedding 服务适配层
│   ├── agent.py           # 受控 Agent：模板回答 + 工具白名单 + system prompt
│   ├── db.py              # mock 内存 / psycopg 连接池 + 进度与埋点
│   ├── config.py          # 环境变量
│   └── seed_knowledge.json# Demo 知识档案种子（17 条）
├── db/schema.sql          # knowledge_entries / progress / narrative_events / scene_objects
├── docker-compose.yml     # pgvector 本地库
└── requirements.txt
```

## 与文档、Demo 的对应关系

- 设计文档第 10 章（Agent）↔ `agent.py` 的 `TOOLS` / `SYSTEM_PROMPT`；
- 设计文档第 12 章（后端与数据）↔ `db/schema.sql` / 本文件 API 表；
- Demo 前端（`../demo`）的 Agent 面板与档案检索面板 ↔ `/api/meta/agent` 与 `/api/knowledge/search` 的契约；
- 前端未接后端时，demo 内使用本地 `knowledge.ts` + 规则 Agent，两者字段一致，可无缝切换。

## 边界与后续

- 这是**演示级骨架**：无鉴权、无限流、无迁移工具。生产接入时补 JWT、审计、Alembic/Flyway、连接池调优。
- Agent 目前是规则模板 + 检索，不调用 LLM；把 `answer_question()` 换成 OpenAI function calling 时，只需保留 `TOOLS` 白名单与「必须引用」的约束。
