# 03 · 双 Agent 协同开发手册（DeepSeek Harness × 智谱 ZCode）

> 目标：让 **DSH（本机 Lead Agent）** 与 **ZCode（智谱 AI 编程工作台，桌面/Web/CLI）** 在同一个工作区里
> **并行干活、互不踩踏、任务可交接、结果可验收**。
> 适用：本仓库 `lux3d-space`（比赛冲刺期尤其需要两条 Agent 流水线）。
> 最后更新：2026-11-03 · Lead（DSH）

---

## 1. 为什么用两个 Agent

| 能力 | DSH（DeepSeek Harness） | ZCode（智谱） |
|---|---|---|
| 强项 | 长上下文、跨会话记忆、文档/调研/验收、资产管线编排、多 Agent 团队 | 本地 IDE 式编码、快速改代码、终端/Git、GLM 模型、插件与 UI |
| 典型任务 | 需求与设计文档、Lux3D 批量资产生成、后端契约、验收、对外提交物 | 前端交互/渲染迭代、重构、修 bug、补测试、性能优化 |
| 运行形态 | 会话内工具调用 + 后台任务 + 团队 Agent | 桌面 App / Web / CLI，打开同一工作区 |
| 记忆载体 | 会话 + 文件 | 会话 + 文件（以 `AGENTS.md` 为入口） |

**结论**：DSH 做"主控 + 内容 + 资产 + 验收"，ZCode 做"实现 + 迭代 + 调试"，通过**文件即任务**同步。

---

## 2. 角色与文件所有权

### 2.1 RACI（谁负责什么）

| 工作 | DSH（Lead） | ZCode（Engineer） | 人类（Owner） |
|---|---|---|---|
| 参赛叙事/选题/报告 | **R/A** | C（提供实现细节） | C（拍板） |
| `docs/` 设计文档 | **R/A** | C | I |
| `demo/` 前端/交互/测试 | C（验收） | **R/A** | I |
| `pipeline/lux3d/` 资产管线 | **R/A** | C（可帮忙改脚本） | I |
| `server/` API/DB 契约 | **R/A** | C | I |
| 公网部署 | A | **R**（可执行） | C（账号） |
| 提交物（视频/报告/链接） | **R/A** | C | **A**（最终提交） |

R=执行，A=最终负责，C=协商，I=知会。

### 2.2 文件所有权（避免同时写）

| 路径 | 主写者 | 只读/评审 |
|---|---|---|
| `docs/`、`AGENTS.md`、`collab/` | DSH | ZCode |
| `demo/src/**`、`demo/tests/**` | ZCode | DSH |
| `pipeline/lux3d/**` | DSH | ZCode |
| `server/**` | DSH | ZCode |
| 根 `README.md`、`ACCEPTANCE.md` | DSH | ZCode |

> 需要改别人所有权内的文件：**先开任务 + 在 `collab` 里注明**，不要直接改。

---

## 3. 同步机制：文件即任务（File-as-Task）

DAG（两个 Agent 都能读写）：
`collab/board.json`（任务板）+ `collab/handoffs/<id>.md`（交接单）+ `collab/cli.mjs`（命令）。

### 3.1 任务板 schema

```json
{
  "version": 1,
  "updatedAt": "2026-11-03T23:20:00+08:00",
  "tasks": [
    {
      "id": "T-005",
      "title": "真实 GLB 的摆放/朝向/尺寸微调",
      "status": "pending",            // pending | in_progress | blocked | done | verified
      "owner": null,                  // dsh | zcode | 队员名
      "priority": 2,
      "scope": ["demo/src/scene"],
      "acceptance": "build 通过；19 项单测全过；5180 截图或录屏确认朝向正确",
      "blockedBy": [],
      "notes": [],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### 3.2 状态机

```
pending ──claim──▶ in_progress ──done──▶ done ──verify──▶ verified
   ▲                   │                    │
   └────release────────┘                    │
   └────block（写原因）◀─────────────────────┘（reopen 可回到 pending）
```

规则：
- **单写者**：`claim` 成功后 `owner` 即是唯一写者；其他人只读。
- **过期回收**：`in_progress` 超过 24h 无更新（或心跳过期），另一方可用 `release --force` 回收。
- **验收权在 DSH**：ZCode 只能把任务置 `done`，`verified` 由 DSH 复核后设置。

### 3.3 交接单模板（`collab/handoffs/T-005.md`）

```markdown
# T-005 真实 GLB 的摆放/朝向/尺寸微调

- owner: zcode
- 开始: 2026-11-03 23:10
- 完成: 2026-11-03 23:40
- 摘要: 调整书桌/日记的 position.y 与 rotationYDeg；AssetModel fitSize 用 manifest scaleHintM
- 改动文件:
  - demo/src/scene/Props.tsx
  - demo/src/scene/AssetModel.tsx
- 验收命令与结果:
  - pnpm build → exit 0（619 modules）
  - node --experimental-strip-types --test tests/state-machine.test.ts → 19/19 pass
  - curl http://127.0.0.1:5180/ → 200
- 风险/未完成: 浮雕的朝向仍偏 15°，等真实资产生成后再校
- 给 Lead 的注意点: 本次未改 registry 契约
```

### 3.4 命令速查（两个 Agent 完全一致）

```powershell
node collab/cli.mjs list                 # 看板（含 owner/优先级/scope）
node collab/cli.mjs next                 # 推荐下一个可领任务
node collab/cli.mjs claim T-005 --owner zcode
node collab/cli.mjs note T-005 "调整了书桌 y=0.02"
node collab/cli.mjs done T-005 --summary "..." --files "demo/src/scene/Props.tsx"
node collab/cli.mjs verify T-005         # 仅 DSH
node collab/cli.mjs block T-005 --reason "等 Lux3D 资产"
node collab/cli.mjs reopen T-005 --reason "验收未过：朝向反了"
node collab/cli.mjs add --title "..." --scope demo/src --priority 2 --acceptance "..."
node collab/cli.mjs show T-005
```

---

## 4. 推荐协作流程（一个任务的生命周期）

1. **DSH 建任务**：`collab/cli.mjs add ...`，写清 scope / acceptance / 优先级。
2. **ZCode 领取**：打开工作区 → 读 `AGENTS.md` → `next` → `claim`。
3. **ZCode 实现**：只改 scope 内文件；中途可用 `note` 记录关键决策。
4. **ZCode 自测**：跑 acceptance 里的命令；完成后 `done`（自动生成交接单，补全内容）。
5. **DSH 复核**：逐条重跑验收命令；通过 `verify`，不通过 `reopen` 并写原因。
6. **DSH 同步**：更新 `README.md` / `ACCEPTANCE.md` / 本手册（如有流程变化）。

---

## 5. 技能与第三方工具：在哪跑、怎么接

### 5.1 两条 Agent 的技能体系

| 能力 | DSH 侧 | ZCode 侧 |
|---|---|---|
| 网页调研 | `agent-reach` skill（Exa/Jina/GitHub API） | 内置联网/浏览；或把来源发给 DSH |
| 工具/技能设计 | `agent-experience` skill | skill / 插件 / Agent CLI |
| 文档办公 | `office` / `docx` / `xlsx` / `pdf` skills | 终端脚本 + 编辑 |
| Aholo Lux3D | 官方 SkillHub `lux3d`（图生3D/文生3D），或直接用 `pipeline/lux3d` 的 Node SDK 脚本 | 同一脚本在终端直接跑（Node ≥18）；也可安装 SkillHub `lux3d` 到 skills 目录 |
| Aholo MCP | 文档：<https://labs.aholo3d.cn/api-docs/mcp>；可作为 MCP 服务接进 DSH | ZCode 支持 Agent CLI 与插件；MCP/Skill 接入以其文档为准 |
| LuxReal | 官方工作台出片（比赛期最稳）；若开放 API 再脚本化 | 同上 |
| 任务编排 | 会话内团队 Agent + collab 板 | 终端 `collab/cli.mjs` |

### 5.2 关键原则：**同一脚本，两边可跑**

- 资产管线 `pipeline/lux3d/generate-assets.mjs` 是纯 Node 脚本，只要有 `AHOLO_API_KEY` 环境变量，DSH 与 ZCode 都能跑。
- 不要为某个 Agent 单独复制一套脚本；脚本即"共享工具"，写进 `pipeline/README`。
- 任何 Agent 生成的中间产物（GLB/报告/截图）统一落到约定目录，另一个 Agent 只读。

---

## 6. 启动提示词

### 6.1 给 ZCode（复制到对话框，第一句）

```
你是 lux3d-space 工作区的「实现工程师」，与 DSH 主控协同。
先读：AGENTS.md → docs/03-双Agent协同开发手册.md → collab/board.json。
然后执行：node collab/cli.mjs next，claim 任务后只改 scope 内文件。
硬约束：不改 pipeline/assetRegistry 契约；不写任何密钥；改 demo 必须 build + 19 项单测全过；
完成后 done 并补全 collab/handoffs/<id>.md。遇到依赖 DSH 的决策先 block，不要自行改设计。
```

### 6.2 给 DSH（新会话开场）

```
你是 lux3d-space 的 Lead。读 AGENTS.md 与 collab/board.json，先跑 node collab/cli.mjs list。
职责：维护任务板/文档/资产管线/验收；ZCode 的 done 任务逐条复跑验收命令后 verify。
对外事实以 research/ 与运行记录为准，不编造。
```

---

## 7. 冲突与失败模式

| 失败模式 | 现象 | 对策 |
|---|---|---|
| 两人同改一个文件 | 覆盖、编译随机报错 | 单写者 + claim；冲突时后到者 block |
| 任务被遗忘 | 板上有 in_progress 超 24h | `release --force` 回收 + 在 note 说明 |
| ZCode 自作主张改契约 | registry/API 字段被改 | 契约列入"必须 DSH 批准"清单；reopen 回滚 |
| 交接单为空 | 无法验收 | `done` 时强制要求 `--summary`，DSH 可拒绝 |
| 验收放水 | 只看描述不看命令 | DSH 必须**亲自重跑**验收命令（build/test/端口） |
| 密钥泄漏 | 出现在文件/commit | 只读环境变量；提交前搜 `AHOLO_API_KEY=` 无结果 |

---

## 8. 每日节奏（比赛冲刺建议）

| 时间 | DSH | ZCode |
|---|---|---|
| 09:00 | 看板 + 当天目标 + 建任务 | — |
| 09:30 | 资产/文档/脚本任务 | 领 `demo/` 任务实现 |
| 13:00 | 复核上午 done 任务 | 继续实现 |
| 15:00 | 同步进度写 `collab/notes` | 修 bug / 补测试 |
| 18:00 | 更新 README/ACCEPTANCE，生成报告素材 | 提交日终交接单 |
| 21:00 | 备份、检查必交项清单 | — |

---

## 9. 与比赛交付物的责任划分

| 交付物 | 主责 | 协作 |
|---|---|---|
| 可运行 Demo 链接 | ZCode（部署/修复） | DSH 验收 |
| 源代码仓库 | DSH（结构/文档） | ZCode（代码质量） |
| 项目报告书 | DSH（内容/数据/证据链） | ZCode（截图/实现细节） |
| 90 秒 Demo 视频 | DSH（脚本/叙事） | ZCode（录屏素材/真机操作） |
| 小红书/X 传播 | DSH | 人类发布 |
| Lux3D 资产证据链 | DSH（pipeline 运行记录） | ZCode 只读 |

---

## 10. 版本与安全

- 任务板与交接单是**项目资产**，提交进仓库；锁文件 `.board.lock` 不进仓库。
- 每次大改前在任务板 `note` 记录动机；回滚以交接单 + git diff 为准。
- 密钥、账号、私有链接一律不进仓库；比赛提交前全仓搜索一次敏感串。
