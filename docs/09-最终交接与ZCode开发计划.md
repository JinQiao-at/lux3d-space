# 09 · 最终交接与 ZCode 开发计划

> 目的：把**剩余开发工作全部交给 ZCode（智谱）主写**，DSH 只保留三类事：**Lux3D 资产生产（密钥约束）、验收检查、提交物**。
> 时间：2026-11-04 → **11-19 19:00 提交**（约 15 天）。
> 状态基线：build ✅ / 单测 21/21 ✅ / 8 件真实 GLB ✅ / 剧情 +62% ✅ / 中文排版 ✅ / dev 5180 ✅。
> 最后更新：2026-11-04 · DSH

---

## 1. 一页状态盘点

| 模块 | 状态 | 备注 |
|---|---|---|
| 设计文档 `docs/01` | ✅ | 25,434 字 / 14 章 |
| 参赛叙事 `docs/02` | ✅ | 为什么/为谁/Lux3D/LuxReal/选题文案 |
| 运行期 Demo | ✅ | 7 步主线、21 单测、GLB 优先加载、剧情/排版优化 |
| Lux3D 资产 | 🚧 **8/17** | 六件高光齐；剩 9 件待生成（DSH） |
| 知识/检索/Agent | ✅ | 17 条知识、7 工具、服务端 mock 13/13 |
| 报告书 / 视频 | ⬜ | T-003 / T-004（DSH + 人类） |
| 公网部署 | ⬜ | **T-002（ZCode 第一优先）** |
| 3DGS 记忆回廊 / LuxReal | ⬜ | T-009/010 / T-007（加分项） |

---

## 2. 全流程梳理（6 条流水线）

```
① 内容生产（DSH）：assets-manifest → Lux3D 图生 3D → gltf-transform → public/models → assetRegistry
② 资产接入（ZCode 验收）：Props/AssetModel 加载真实 GLB，缺失回退程序化
③ 运行期（ZCode 主写）：R3F 场景 + Zustand + 纯 reducer/Effects + HUD/日记/档案/Agent 面板
④ 叙事与文本（已完成）：narrative/knowledge 数据 + 中文排版/打字机/手稿
⑤ 验证（DSH）：build + 21 单测 + GLB HEAD + 截图 + 服务端 mock
⑥ 提交（DSH/人类）：公网链接 + 源码 + 报告书 + 90 秒视频 + 社媒
```

---

## 3. 责任切换（最终版）

| 工作 | ZCode（主开发） | DSH（检查/资产） | 人类 |
|---|---|---|---|
| **公网部署 T-002** | **R/A** | 验收链接 | 账号/域名 |
| **视觉/GLB 朝向微调 T-005** | **R/A** | 复跑验收+截图 | 审美拍板 |
| **暗门/转盘 part_split 动画 T-011** | **R/A** | 先产出拆分 GLB | I |
| **记忆回廊 T-009（DSH 产 3DGS）→ T-010 Viewer 页面（ZCode）** | **R/A（T-010）** | **R/A（T-009 资产）** | I |
| **剩余 9 件 Lux3D 资产（新增 T-018）** | 只读 | **R/A** | 额度确认 |
| 回归/修 bug/性能/移动端布局 | **R/A** | 验收 | 体验反馈 |
| 报告书/视频/社媒/最终提交 | 提供截图素材 | **R/A** | **A**（提交） |

> 规则：**ZCode 写代码 → 自测 → done + 交接单；DSH 亲自复跑验收命令 → verify**。契约变更只有 DSH 能批。

---

## 4. ZCode 任务队列（按顺序领，别并行超过 2 个）

| 顺序 | 任务 | 依赖 | 建议日期 | 退出标准 |
|---|---|---|---|---|
| 1 | **T-005** 真实 GLB 朝向/比例微调（当前 in_progress） | 8 件资产已就位 | 11/04–05 | build + 21 单测 + 5180 截图确认 |
| 2 | **T-002** 公网部署 | dist 可构建 | 11/05–06 | 公网 URL 200、手机 4G 可玩、GLB 随包 |
| 3 | **T-011** part_split 暗门/转盘动画 | DSH 产出拆分 GLB（11/05 前） | 11/06–08 | 部件可分别旋转/开合，主线与单测不变 |
| 4 | **T-010** 记忆回廊 Viewer 页面 | DSH 产出 3DGS 场景（T-009） | 11/09–11 | 结局面板可打开、桌面+手机可环视 |
| 5 | **T-012** Aholo MCP 接入（可选） | Key 环境变量 | 11/10 | 对话可列/调 Aholo 工具，Key 不落盘 |
| 6 | 回归/性能/移动端 | 前 5 项 | 11/12–13 | 首帧<5s、无 console.error、窄屏不崩 |
| 7 | 配合报告/视频 | T-003/T-004 | 11/14–16 | 提供 4 张 UI 截图 + 真实资产录屏 |

ZCode 开工命令：

```powershell
cd lux3d-space
node collab/cli.mjs next
node collab/cli.mjs show T-005
node collab/cli.mjs claim T-005 --owner zcode
# …实现…
node collab/cli.mjs done T-005 --summary "..." --files "..."
```

---

## 5. 每个任务的启动提示词（复制进 ZCode）

**通用前缀（每个任务都先粘）**

```text
你是 lux3d-space 的实现工程师，与 DSH 协同。先读 AGENTS.md、docs/09、collab/board.json。
按 node collab/cli.mjs next → show → claim --owner zcode 流程；只改任务 scope 内文件；
完成后跑 acceptance 命令并写 collab/handoffs/<ID>.md；硬约束：不改 assetRegistry 契约、不写密钥、不改 7 步主线与 21 单测语义。
```

**T-002 部署**

```text
任务 T-002：把 demo 部署到公网静态托管（Vercel/Netlify/Cloudflare Pages 任选，构建 pnpm build、输出 dist）。
要求：SPA 路由回退 index.html；public/models 的 8 个 GLB 随包发布；不把任何 token/Key 写进仓库或构建配置。
验收：公网 URL 200；手机 4G 打开能开始游戏；至少 3 个真实 GLB 加载成功；链接写回 README 对应位置。
```

**T-005 微调**

```text
任务 T-005：用真实 GLB 校准书房书桌/日记/书架/壁炉、地下室浮雕/淋浴门/暗门、密室石台的位置·朝向·比例。
只改 demo/src/scene/Props.tsx 与 AssetModel.tsx 的 ASSET_FIT_SIZE_HINTS；不要改 assetRegistry。
验收：build + 21 单测；5180 截图（书房/地下室/密室各 1 张）对比确认无悬空/穿墙/比例异常。
```

**T-011 part_split**

```text
任务 T-011：DSH 已用 Lux3D part_split 产出拆分 GLB（暗门/三转盘），见 demo/public/models/parts/。
在 R3F 中用拆分节点做"拨盘转动 → 暗门开合"动画；保留原有交互判定与状态机。
验收：build + 21 单测；录屏展示 3-1-2 正确/错误两种拨盘反馈。
```

**T-010 记忆回廊**

```text
任务 T-010：结局石台调查后，结局面板增加「进入记忆回廊」按钮，用 Aholo Viewer（@manycore/aholo-viewer 或独立页）
加载 DSH 产出的 3DGS 场景（demo/public/splats/）。保底方案：独立页在新窗口打开。
验收：结局面板按钮可用；3DGS 可环视；桌面+手机各验证一次；失败不阻塞主线。
```

---

## 6. "隐形约束"清单（ZCode 侧已配好）

1. `AGENTS.md`：自动注入规则（硬约束/必读/命令）；
2. `.agents/skills/lux3d-space/SKILL.md`：按需加载工作流/验收/契约；
3. `zcode/hooks/guard-protected.mjs`：PreToolUse 自动拒绝改生成物/契约/密钥、拦 `rm -rf`/`git reset --hard`/force push（需 `zcode hooks trust`）；
4. `collab/board.json`：单写者 + 交接单 + DSH verify；
5. 权限模式：日常 `edit/build`；批量无人值守才用 `yolo`；
6. 验收门禁：build + 单测 + GLB HEAD + 截图，缺一不可 done。

---

## 7. 每日节奏与升级规则

| 时间 | ZCode | DSH |
|---|---|---|
| 09:30 | `next` 领任务，claim | 看板 + 资产/验收 |
| 12:30 | 中途 `note` 进度 | 复跑上一个 done |
| 18:00 | `done` + 交接单 | 验收 + `verify` / `reopen` |
| 21:00 | 日终同步 | 更新 README/ACCEPTANCE、备份 |

**升级（block）条件**：契约要改 / scope 冲突 / 缺资产 / 验收命令无法通过且 2 次尝试失败 / 依赖 T-009 未就绪。
block 时写清：任务 ID、卡点、已排除原因、需要的决定。

---

## 8. 提交物映射（11/19）

| 比赛必交 | 谁产出 | 当前状态 |
|---|---|---|
| 可运行 Demo 链接 | ZCode（T-002） | ⬜ |
| 源代码 | 全仓 | ✅ |
| 项目报告书（过程截图/资产迭代对比） | DSH（T-003） | ⬜ |
| 90 秒 Demo 视频（真实运行画面） | DSH + 人类（T-004） | ⬜ |
| 小红书 / X（加分） | 人类 + DSH 文案（T-006） | ⬜ |
| Lux3D 证据链 | DSH（docs/08） | ✅ |

---

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| 部署后 GLB 404 / 体积大 | 构建产物检查 dist/models；GLB 已压到 1–3MB，必要时再 simplify |
| Real GLB 视觉穿模/比例错 | T-005 逐件校准 + 截图验收；集中改 Props/ASSET_FIT_SIZE_HINTS |
| part_split/3DGS 资产未就绪 | ZCode 先做 UI/逻辑占位，资产到位再替换 |
| ZCode 上下文漂移 | 每任务前粘通用前缀 + 只读 AGENTS/docs/09 |
| 截止前赶工 | 11/19 15:00 前完成三件套，17–18 只做回归 |

---

## 10. 参考

- ZCode 工程提示词：`docs/06`
- 双 Agent 手册：`docs/03`
- ZCode 落地与开源参考：`docs/07`
- 任务板：`collab/README.md`
