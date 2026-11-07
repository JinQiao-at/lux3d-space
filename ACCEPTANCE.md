# ACCEPTANCE · 验收清单（Lead 独立验收）

> 验收对象：`docs/` 设计文档、`demo/` 可运行 3D Demo、`server/` 后端骨架、`research/` 一手证据。
> 验收方式：不采用成员自测结论，由 Lead 用捆绑运行时重新执行命令并核对文件。
> 验收时间：2026-11-03 21:20–22:05（Asia/Shanghai）。

## 0. 验收环境

| 项 | 值 |
|---|---|
| 工作区 | `C:\Users\王潇\Documents\deepseek-harness\default-workspace\lux3d-space` |
| Node | v24.21.0（DSH 捆绑运行时） |
| pnpm | 11.28.5（DSH 捆绑运行时） |
| Python | 3.12（DSH 捆绑运行时） |
| 浏览器 | Edge Headless（WebGL 截图验证） |

## 1. 用户诉求 → 证据映射

| # | 原始诉求 | 落地位置 | 验收证据 | 状态 |
|---|---|---|---|---|
| 1 | 技术栈：TS/Three.js/R3F/Zustand/Blender Python/gltf-transform/Node-FastAPI/PostgreSQL-pgvector | 文档第 5 章；`demo/package.json`；`server/requirements.txt`；第 11 章 Blender/gltf-transform 规范 | `demo` 实测 R3F 9 + three 0.187 + zustand 5；`server` 实测 FastAPI 0.162 + pydantic 2.14；Blender/gltf-transform 为规范 + 命令 + 脚本片段（本机无 Blender 运行时） | ✅ |
| 2 | 3D 叙事空间、第一人称、描述道具、任务推动、解谜/导览 | 文档第 2 章 F1–F5 判定特征；Demo 实际玩法 | 标题页截图 + 7 步主线可走通 | ✅ |
| 3 | 小 Demo：神秘书房、可调查物品、线索解锁密室；ECO×ZORK；不做大世界 | 文档第 7 章；`demo/src/data/*`（3 zone / 17 对象 / 14 相机点） | 单测 18/18；3 zone 垂直切片 | ✅ |
| 4 | 流程：取提灯 → 地下室 → 照亮淋浴门 → 暗门 → 密室 | 文档 7.2/7.4；`demo/src/data/scene.ts`、`narrative.ts` | 单测 + Demo README 自测轨迹：arrival→…→complete | ✅ |
| 5 | 情景图与状态系统、状态解锁 | 文档 7.3（flowchart + stateDiagram）；`demo/src/game/actions.ts`、`store.ts` | 文档 10 张 mermaid（含状态图）；`applyAction` 纯函数 + 18 单测 | ✅ |
| 6 | Agent：检索 + 空间 ID → 3D 导航 | 文档第 9/10 章；`demo/src/ui/ArchivePanel.tsx`、`game/agent.ts`；`server/app/agent.py` | 单测：检索→`focus_object`/高亮→镜头；服务端 `/api/meta/agent` 7 工具契约 | ✅ |
| 7 | 开发期/生产期完整管线 | 文档 4.1（P0–P7 管线图）+ 第 11 章 | mermaid + Blender 规范表 + `gltf-transform` 命令 + 性能预算 | ✅ |
| 8 | 运行期：R3F 场景/相机/交互/碰撞；信息导航；触发器/条件/任务/存档；受控 Agent | 文档第 8/9/10 章；`demo/src/scene/*`、`game/*`、`ui/*` | build 617 modules；dev 200；单测覆盖碰撞/交互/存档/Agent | ✅ |
| 9 | 知识条目 schema（id/zoneId/objectId/cameraId/title/topics/content/sources/confidence） | 文档第 6 章；`demo/src/data/knowledge.ts`；`server/app/seed_knowledge.json`、`models.py` | 脚本比对：seed 11 条 = demo 11 条，id/zone 全部一致 | ✅ |
| 10 | 数据流闭环：Lux3D → Blender → gltf-transform → Three.js → Zustand → 后端/数据库 | 文档第 4 章数据流 + 第 11 章；`server/db/schema.sql` | 文档 + mock 服务实测 + DDL 与文档第 12 章对照 | ✅ |
| 11 | 总体适配 Agent（生产 + 运行时受控 Agent） | 文档第 10 章；`server/app/agent.py` | 7 工具白名单 + system prompt + 只读约束 + 单测「Agent 不能推进剧情」 | ✅ |
| 12 | 自由度/可扩展性 | 文档每章「替换点/扩展点/验收点」；2.4 节；第 13 章 M0–M3 | 18 处替换点小节；五类扩展场景 | ✅ |
| 13 | 两个参考链接补充 | 文档参考章节/附录；`research/01`（42KB，文件:行证据）、`research/02`（17 条模式） | 三条链接（官网/GitHub/微信）出现于文档；research 引用真实文件行号 | ✅ |
| 14 | 一个完整文档 + 实际实行（可运行代码） | `docs/01-总体设计与实施方案.md` + `demo/` + `server/` | 文档 25,332 汉字 / 14 章；demo build+test+dev；server 13/13 E2E | ✅ |

## 2. 文档验收

| 检查项 | 结果 | 证据 |
|---|---|---|
| 章节 1–14 齐全（执行摘要→正文→一页速查表） | ✅ | `# 第 1 章` … `# 第 14 章` 共 14 个一级章节 |
| 正文汉字数 ≥ 18,000 | ✅ | 25,332 汉字（99,459 字符） |
| mermaid ≥ 5 且类型合法 | ✅ | 10 块：flowchart LR/TB ×7、sequenceDiagram ×2、stateDiagram-v2 ×1 |
| 每章末尾「替换点/扩展点/验收点」 | ✅ | 18 处标题（14 章 + 摘要/附录） |
| 参考链接齐全 | ✅ | Zork 官网 / GitHub `emollick/zork-underground-empire` / 微信文章 各 2 处 |
| Demo 设计与代码一致 | ✅ | 7.9 节已由 Lead 回填最终文件（`game/agent.ts`、`ui/ArchivePanel.tsx`、`ui/AgentPanel.tsx`、`CameraRig.tsx`、`store.ts`） |
| 后端 API/工具契约一致 | ✅ | 8 个 API 路径、7 个工具名与 `server/` 代码逐一核对 |
| 无编造风险 | ✅ | 参考事实均标注来源；ECO 明确写「无公认定义、本文工作定义」；10 项 TBC 列于 14.5 |

## 3. Demo 验收（Lead 实测）

命令在 `demo/` 下、使用 DSH 捆绑 Node/pnpm 执行：

| 检查项 | 命令 | 结果 |
|---|---|---|
| 依赖 | `node <pnpm.mjs> install` | ✅ node_modules 就绪，install 正常 |
| 类型检查 + 构建 | `node <pnpm.mjs> build` | ✅ exit 0，tsc strict 0 错误，`✓ 617 modules transformed`，`built in 6.13s` |
| 单测 | `node --experimental-strip-types --test tests/state-machine.test.ts` | ✅ 18/18 pass，0 fail（292ms） |
| dev server | `node <pnpm.mjs> dev --port 5180` + `curl` | ✅ HTTP 200，HTML 含 `<div id="root">`，Vite 模块入口正常 |
| 静态产物 | `node <pnpm.mjs> preview --port 5181` + `curl` | ✅ index 200；JS 200（1,267,696 B） |
| 7 步主线 | 单测 + Demo README 自测轨迹 | ✅ arrival→find_light→light_it→descend→illuminate→solve_dials→chamber→complete |
| 条件门禁 | 单测 | ✅ 未读日记/未点灯/未解谜/跳步均被拦截；错误拨盘重置可重试 |
| 检索→导航 | 单测 + 代码核对 | ✅ 关键词/topic/zone 过滤；命中→高亮 + 相机 tween |
| Agent 约束 | 单测 | ✅ 命中引用条目；无命中「档案中没有记录」；回答前后状态字节一致 |
| 存档 | 单测 | ✅ localStorage 自动存档；导出/导入；坏档兜底 |
| 零网络资产 | `grep` + 运行 | ✅ `src/` 无 http(s) URL、无 fetch/XHR；断网可用 |
| 视觉验证 | Edge Headless 截图 | ✅ `assets/screenshots/demo-title.png`（标题页/操作说明渲染正常） |

## 4. 后端验收（Lead 实测）

> 本机 8765/8790 落在 Windows 保留端口段（WinError 10013），改用 5182 验证；端口可配置。

| 检查项 | 结果 | 证据 |
|---|---|---|
| 语法/JSON 静态校验 | ✅ | `py_compile` 7 个模块通过；seed JSON 11 条合法 |
| 依赖安装（mock 最小集） | ✅ | fastapi 0.162 / pydantic 2.14 / uvicorn 0.54 / pydantic-settings / httpx 安装成功 |
| 服务启动 | ✅ | `uvicorn app.main:app --port 5182` 启动成功，health `{status:"ok",mode:"mock",entries:11}` |
| 检索 API | ✅ | 「符号」命中 `book_A16_023`/`kb_mural_symbols`/`kb_lantern_origin`（camelCase `tookMs`） |
| Agent API | ✅ | 「提灯在哪里」grounded=true 且引用 `kb_lantern_origin`；「量子纠缠火箭发动机」grounded=false 并明确拒答 |
| 工具契约 | ✅ | `/api/meta/agent` 返回 7 个工具，名称与文档/ demo 完全一致 |
| 进度 API | ✅ | PUT/GET 往返一致（`saveVersion`/`playedSeconds`）；不存在 404 |
| 埋点 API | ✅ | `POST /api/events` → `{ok:true}` |
| 端到端脚本 | ✅ | 13/13 pass（`server_accept.py`） |
| pg 模式 | ⚠️ 未运行时验证 | `db/schema.sql` + `docker-compose.yml` 已提供；本机无 Docker/pgvector 实例，pg 模式为设计+DDL 交付（见已知限制） |

## 5. 已知限制（如实记录，不视为失败）

1. **3D 资产：Lux3D 管线已实跑接入真实资产**（8/17 件：日记/书桌/书架/壁炉/浮雕/淋浴门/暗门/石台；registry 8 条，全部 HEAD 200 `model/gltf-binary`），其余 9 件仍为程序化占位；Blender 规范化环节未执行（本机无 Blender），保留为 M1 后续步骤。逐件任务 ID 与体积对比见 `docs/08-Lux3D使用审计.md`。
2. **运行时 Agent 为规则 stub**：未接真实 LLM；`server/app/embeddings.py` 与 `SYSTEM_PROMPT/TOOLS` 已留真实接入点，检索修复后已验证「无命中拒答」。
3. **pg 模式未做运行时验证**：本机无 PostgreSQL/pgvector 实例；DDL、检索 SQL、Docker Compose 均已提供，mock 模式已做 13/13 E2E。
4. **移动端触控 / 战斗 / 多人 / 鉴权 / 限流 / 迁移工具**：明确不在首版范围（文档 3.4）。
5. **mermaid 未用 CLI 渲染**：只做结构/首行类型校验，建议在支持 mermaid 的预览器（IDE、GitHub、Typora）查看。
6. **Zork 证据基于 2026-11-03 快照**：行号引用 `codex/public-release` 分支，上游改动可能漂移（已在 research/01 标注）。

## 6. 验收结论

| 交付物 | 结论 |
|---|---|
| 设计文档 `docs/01-总体设计与实施方案.md` | **通过**：25,332 汉字 / 14 章 / 10 图 / 每章三小节 / 引用可追溯 |
| Demo `demo/` | **通过**：build ✅、单测 **21/21** ✅、dev/preview 200 ✅、7 步主线与约束 ✅、GLB 优先加载 ✅、截图 ✅；剧情文本 +62.1%、日记 12 条（主线可收集 10 条、全部 12/12 可收集）、17 条知识、结局 329 汉字；中文排版（衬线/手稿/打字机/reduced-motion）✅ |
| 后端 `server/` | **mock 模式通过**（13/13 E2E，知识种子同步 17 条）；pg 模式为 DDL/Compose 交付，未运行 |
| 调研 `research/` | **通过**：42KB 源码级证据 + 17 条探索感模式 + ECO 核查与工作定义 |
| Lux3D 资产管线 `pipeline/lux3d/` | **通过**：真实 API 全链路跑通，**8/17 件**真实 GLB 已生成并接入（六件高光资产齐），压缩 -75%~-89%；审计见 `docs/08` |

**总体：M0 垂直切片达到可交付标准，并已开始 M1（Lux3D 真实资产）首批接入。**

## 7. Aholo Lux3D 接入验收

| 检查项 | 结果 | 证据 |
|---|---|---|
| API Key / region 鉴权 | ✅ | `check-key.mjs`：cn / com 均 OK（任务列表只读，不耗额度） |
| 文生图（参考图） | ✅ | `runs/20261103-225015/refs/obj_study_diary.jpg`（578KB） |
| 图生 3D（G1，PBR） | ✅ | 8 件资产均由 Lux3D 生成（日记/书桌/书架/壁炉/浮雕/淋浴门/暗门/石台）；每件含参考图任务与 3D 任务 ID |
| gltf-transform 压缩 | ✅ | 8 件原始 79.58 MB → 入库 12.12 MB（平均 **-85%**），单件 -75%~-89%；PDF 证据链见 `docs/08` |
| Demo 加载链路 | ✅ | Vite dev `HEAD /models/*.glb` → 200 `model/gltf-binary`；AssetModel HEAD 探测 + Suspense/ErrorBoundary 兜底；`assetRegistry.ts` 已回写 2 条 |
| 回退安全 | ✅ | `public/models` 为空或 GLB 失败时渲染程序化几何，19/19 单测不受影响 |
| 可复现命令 | ✅ | `pipeline/lux3d/README.md`（dry-run / 单件 / 全量 / 断点续跑） |
| 安全 | ✅ | Key 仅环境变量读取；`.gitignore` 忽略 `runs/`、`.env*`；脚本不打印 Key |

## 8. 复现命令

```powershell
# Demo
cd lux3d-space\demo
node "C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" install
node "C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" build
node --experimental-strip-types --test tests/state-machine.test.ts
node "C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" dev --port 5180

# Lux3D 资产管线（先设置 AHOLO_API_KEY 环境变量）
cd ..\pipeline\lux3d
node check-key.mjs
node generate-assets.mjs --dry-run
node generate-assets.mjs --only obj_study_diary

# 后端（mock）
cd ..\..\server
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 5182
curl.exe http://127.0.0.1:5182/api/health
```
