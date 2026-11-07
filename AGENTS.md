# AGENTS.md — 工作区入口（DSH × ZCode 双 Agent 契约）

> 本文件是任何 AI 编码 Agent（DeepSeek Harness / 智谱 ZCode）进入本工作区的**唯一入口**。
> 先读完本文件，再按"必读顺序"读文档，最后从任务板领取任务。
> 最后更新：2026-11-04 · Lead（DSH）

## 0. 项目一句话

把 Aholo Lux3D 生成的 3D 资产，装进一个**可探索、可对话、可存档的叙事空间**（Demo《提灯与暗门》），
并用它验证一条可复用的「3D 叙事空间生产线」——参赛群核科技 Aholo 全球 3D AI 黑客松。

## 1. 必读顺序（每次接手都读）

1. `README.md` —— 项目总览、怎么跑
2. `docs/02-参赛选题与叙事方案.md` —— 为什么做/为谁做/Lux3D 与 LuxReal 怎么用/选题文案
3. **`docs/09-最终交接与ZCode开发计划.md` —— 剩余给 ZCode 的任务队列、提示词与验收门禁（当前冲刺必读）**
4. `docs/03-双Agent协同开发手册.md` —— 两个 Agent 怎么分工、怎么同步、怎么写交接单
5. `collab/board.json` + `collab/cli.mjs` —— 当前任务板与命令
6. `research/00-brief.md` —— 历史事实源（需求、验收标准、已验证事实）

## 2. 当前状态（2026-11-03 23:15）

| 模块 | 状态 |
|---|---|
| `docs/` 设计文档 | ✅ 25,434 汉字 / 14 章 |
| `demo/` 可运行切片 | ✅ build 通过；单测 **21/21**；dev :5180；剧情 +62%、12 条日记均可收集、中文排版优化 |
| `server/` FastAPI mock | ✅ 13/13 E2E；知识种子已同步 17 条；pg 模式仅 DDL |
| `pipeline/lux3d/` 真实资产 | ✅ 已生成 **8/17** 件 GLB（六件高光齐），压缩 -75%~-89%，已接入 Demo；审计见 `docs/08` |
| hackathon 准备 | 🚧 选题叙事完成；剩余资产、公网部署、报告/视频待办 |

## 3. 硬约束（违反会破坏交付）

1. **密钥零落盘**：`AHOLO_API_KEY` 只从环境变量读取；不得写入代码、文档、commit、日志。
2. **契约不可破坏**：`demo/src/scene/assetRegistry.ts` 的 `ASSET_REGISTRY` 格式由 `pipeline/lux3d/generate-assets.mjs` 生成，禁止手改语义。
3. **改 `demo/` 必回归**：`pnpm build` + `node --experimental-strip-types --test tests/state-machine.test.ts`（当前 21/21，持续增加）。
4. **单写者原则**：一个任务在同一时刻只能有一个 `owner`；动手前先 claim，完成后写交接单。
5. **不编造**：所有性能/资产/评分数据必须来自运行记录或官方页面；不确定标"待验证"。

## 4. 目录地图

```
lux3d-space/
├── AGENTS.md               ← 本文件
├── docs/                   # 设计/参赛/协同文档
├── demo/                   # R3F 运行期 Demo（前端）
├── server/                 # FastAPI + pgvector 骨架
├── pipeline/lux3d/         # Lux3D 资产管线（真实 API 已跑通）
├── collab/                 # 双 Agent 任务板 + 交接单（文件即消息）
├── research/               # 参考资料与证据
└── ACCEPTANCE.md           # 验收清单
```

## 5. 常用命令

```powershell
# Demo（DSH 与 ZCode 通用）
cd demo
pnpm install
pnpm build
node --experimental-strip-types --test tests/state-machine.test.ts
pnpm dev -- --port 5180

# Lux3D 资产（先设置 AHOLO_API_KEY 环境变量）
cd pipeline/lux3d
node check-key.mjs
node generate-assets.mjs --dry-run
node generate-assets.mjs --only obj_study_bookshelf

# 双 Agent 任务板
node collab/cli.mjs list
node collab/cli.mjs next
node collab/cli.mjs claim <id> --owner zcode
node collab/cli.mjs done <id>
```

## 6. 技能与工具

| 能力 | DSH（DeepSeek Harness） | ZCode（智谱） |
|---|---|---|
| 调研/网页 | `agent-reach` skill（Exa/Jina/GitHub API 等） | 内置联网/浏览能力；或把链接与任务交给 DSH |
| 技能/工具设计 | `agent-experience` skill | 内置 skill / 插件 / Agent CLI |
| 文档/表格 | `office`、`docx`、`xlsx` skills | 终端脚本 + 手工编辑 |
| 3D 资产 | `pipeline/lux3d/*.mjs`（SDK/API） | 同一脚本可直接跑（Node ≥18） |
| Aholo 官方 Skill | SkillHub `lux3d`（图生 3D/文生 3D） | 安装到 `skills` 目录后重启 Agent |
| 任务编排 | 子 Agent / 团队任务（本文件 + collab 板） | 终端跑 `collab/cli.mjs` 领取/汇报 |

## 7. ZCode 首启提示词（复制粘贴）

> 完整版（主提示词 + 任务模板 + 文件工程规范 + 验收提示词）见 [`docs/06-ZCode工程提示词.md`](docs/06-ZCode工程提示词.md)，直接复制 §1 与 §2 即可。
> ZCode 侧已内置：项目技能 [`.agents/skills/lux3d-space/SKILL.md`](.agents/skills/lux3d-space/SKILL.md)、Hook 守卫 [`zcode/hooks/guard-protected.mjs`](zcode/hooks/guard-protected.mjs)、项目配置 [`zcode.json`](zcode.json)。启用/信任步骤见 [`docs/07-15天ZCode落地与开源参考.md`](docs/07-15天ZCode落地与开源参考.md)。

```
你在工作区 lux3d-space 中作为「实现工程师」与 DSH 主控协同工作。
第一步：读 AGENTS.md、docs/03-双Agent协同开发手册.md、collab/board.json。
第二步：执行 node collab/cli.mjs next 领取优先级最高的 pending 任务。
第三步：claim 后只改任务 scope 内文件；完成后跑该任务的验收命令，再 done 并写交接单 collab/handoffs/<id>.md。
硬约束：不改 pipeline 契约；不提交密钥；改 demo 必须 build + 21 项单测全过；有冲突先 block。
```

## 8. DSH（Lead）职责提醒

- 维护任务板与验收；负责 `docs/`、`pipeline/`、`server/` 契约与对外提交物。
- ZCode 完成后逐条复核验收命令，不通过则 reopen 并写明原因。
- 每轮结束更新 `README.md`、`ACCEPTANCE.md`，并把新事实写回本文件第 2 节状态表。
