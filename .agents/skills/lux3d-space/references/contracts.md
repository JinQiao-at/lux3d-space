# 不可破坏的契约

| 路径/对象 | 规则 | 违反后果 |
|---|---|---|
| `demo/src/scene/assetRegistry.ts` | 自动生成（pipeline 覆盖），只登记 objectId → `/models/<id>.glb`；不手改语义 | 下次资产生成被覆盖，加载失效 |
| `pipeline/lux3d/assets-manifest.json` | 资产清单/提示词/状态；由管线写；手工改需 DSH 同意 | 断点续跑与证据链断裂 |
| `pipeline/lux3d/generate-assets.mjs` | 输出目录、命名、压缩参数约定 | 资产与 Demo 对不上 |
| `server/app/agent.py::TOOLS` | 7 个工具名与参数 schema | 前后端 Agent 契约不一致 |
| `server/app/main.py` | API 路径与字段（camelCase） | 文档/前端不一致 |
| 知识条目 id | `book_A16_023`、`kb_*` 与 server seed 对齐 | 检索/问答引用失效 |
| 7 步主线 | `STAGES` 单调、`FLAG_KEYS` 9 个、`lanternLit` 独立 | 单测失败、剧情卡死 |
| 存档 key | `lux3d.save.v1` + 版本校验 | 旧存档不可读 |

变更任一契约：先在任务板 `note` 说明，block 等 DSH 批准，再改代码与文档。
