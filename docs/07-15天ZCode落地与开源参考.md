# 07 · 15 天落地：ZCode 主开发、DSH 检查、开源参考与工具形态

> 约束：距提交约 **15 天**（2026-11-04 → 11-19 19:00）；**ZCode 主开发，DSH 辅助检查**；
> 在"隐形约束"下执行（Hook / 权限 / 单写者 / 契约冻结）。
> 本文件回答三件事：① 15 天怎么分工；② 有哪些 GitHub 开源架构可参考；③ 在 ZCode 里到底用哪种"工具形式"（Skill / MCP / Hook / Plugin / Agent）。
> 最后更新：2026-11-04 · DSH

---

## 1. 15 天总原则

1. **ZCode 写代码，DSH 守门**：ZCode 负责 `demo/` 的实现、视觉、部署、修 bug；DSH 负责 `pipeline/` 资产、契约、文档、验收、提交物。两者都用 `collab/` 任务板交接。
2. **每天必须有可验收产物**：build + 19 单测 + 可打开页面，三者缺一不算完成。
3. **契约冻结**：`assetRegistry`、`server` API、7 个 Agent 工具名、7 步主线，冲刺期不再改；确需改由 DSH 批准并同步文档。
4. **先保三件套**（可运行链接 / 源码 / 报告+视频），再打磨视觉。
5. **一切数据可追溯**：体积/三角面/耗时来自 `pipeline/lux3d/runs/*/report.json` 或命令输出。

---

## 2. 角色与分工

| 工作 | ZCode（主开发） | DSH（检查/资产） | 人类 |
|---|---|---|---|
| `demo/` 前端、R3F 场景、UI、修 bug、补测试 | **R/A** | 验收（复跑命令） | 体验反馈 |
| 公网部署（Vercel/Netlify/Cloudflare） | **R** | A（验收链接） | 账号/域名 |
| Lux3D 资产生成与压缩（`pipeline/lux3d`） | 只读/协助 | **R/A** | 额度确认 |
| 真实 GLB 接入与视觉微调 | **R** | A（验截图/比例） | 审美拍板 |
| `server/` 契约与 `docs/` | 只读 | **R/A** | I |
| 报告书 / 90 秒视频 / 社媒发布 | 提供素材 | **R** | A（提交/发布） |
| 任务板维护与最终验收 | 执行 | **R/A** | 知会 |

R=执行，A=最终负责。

---

## 3. 15 天排期（ZCode 视角）

| 日期 | ZCode 主任务 | DSH 配合 | 当日验收 |
|---|---|---|---|
| 11/04–11/05 | 读 `AGENTS.md` + skill，跑通 build/单测；领 T-005 微调真实 GLB 朝向/比例 | 生成书桌/日记以外高光资产（T-001） | 5180 截图 + 19/19 |
| 11/06–11/08 | 公网部署（T-002）：静态托管 + SPA 回退 + GLB 随包 | 资产接入 registry、报告证据链 | 公网 URL 200、手机可玩 |
| 11/09–11/11 | 视觉打磨：灯光/材质/UI 可读性；`part_split` 暗门/转盘动画（T-011） | part_split 资产产出 + 契约确认 | 前后对比录屏 |
| 11/12–11/13 | 性能与稳定：首屏、GLB 懒加载、移动端布局不崩 | 录 90 秒视频素材（T-004） | 首帧 <5s、无 console.error |
| 11/14–11/16 | 修复验收问题；部署更新；截图/录屏给报告 | 报告书（T-003）、社媒文案（T-006） | 报告初稿 |
| 11/17–11/18 | 回归：build/19 单测/公网/双端浏览器 | 提交演练（填表/上传/链接检查） | 提交草稿 |
| 11/19（15:00 前） | 待命修紧急问题 | 正式提交 + 存档截图 | 提交成功 |

> 详细赛事倒排见 [`04-提交清单与倒排期.md`](04-提交清单与倒排期.md)。

---

## 4. "隐形约束"怎么落地（ZCode 原生机制）

| 机制 | ZCode 里的形态 | 我们的落地 | 效果 |
|---|---|---|---|
| **项目指令** | `AGENTS.md`（项目 + 用户目录合并；见 ZCode `11-memory.md`） | 根目录 [AGENTS.md](../AGENTS.md) | 每次会话自动带上"硬约束/必读顺序" |
| **项目技能** | `.agents/skills/<name>/SKILL.md`（或 `.zcode/skills`；见 `08-skills.md`） | [`.agents/skills/lux3d-space/SKILL.md`](../.agents/skills/lux3d-space/SKILL.md) + `references/` | 按需加载工作流/验收/契约，不占常驻上下文 |
| **Hook 守卫** | PreToolUse 进程 Hook（见 `09-hooks.md`），需 `zcode hooks trust` | [`zcode/hooks/guard-protected.mjs`](../zcode/hooks/guard-protected.mjs) + [配置示例](../zcode/hooks.example.json) | 自动拒绝：改生成物/契约、`rm -rf`、`git reset --hard`、force push |
| **权限模式** | `plan / build / edit / yolo / guarded`（见 `05-permissions.md`） | 日常 `edit`（改文件免审批）；批量无人值守才用 `yolo` | 减少误操作；yolo 也不是万能，Hook 仍会拦 |
| **单写者任务板** | 外部文件（我们自己的 `collab/cli.mjs`） | `collab/board.json` | 两个 Agent 不互相覆盖 |
| **验收门禁** | 任务 `acceptance` 字段 | build + 19 单测 + GLB 200 + 截图 | DSH 亲自复跑才 verify |

**启用顺序**（ZCode 侧）：

```powershell
# 1) 技能被发现
zcode skills list --cwd <ABS_PATH>/lux3d-space --json

# 2) Hook 审查并信任（项目 Hook 默认不信任）
zcode hooks trust review --workspace <ABS_PATH>/lux3d-space --json
zcode hooks trust grant  --workspace <ABS_PATH>/lux3d-space --hook-digest <SHA256>

# 3) 权限模式：日常交互用 edit/build；无人值守批量再用 yolo
```

> ZCode 配置位置（官方 `03-config.md`）：个人模型 `~/.zcode/v2/provider_config.json`；运行/权限/MCP/Hook/插件 `~/.zcode/cli/config.json`；项目配置 `<project>/zcode.json` 或 `<project>/.zcode/config.json`。Hook 配置在运行配置的 `hooks` 字段。

---

## 5. 在 ZCode 里用哪种"工具形式"（需要明确的那部分）

| 形式 | 是什么 | 本项目用不用 | 怎么落地 |
|---|---|---|---|
| **Agent（对话/CLI）** | ZCode 桌面/Web/TUI 的编码 Agent，可读写工作区、跑终端 | ✅ 主开发入口 | 打开工作区，粘 `docs/06` 主提示词；或直接说"执行任务 T-005" |
| **Skill（技能）** | 按需加载的任务说明（`SKILL.md` + references） | ✅ 已建项目技能 | `.agents/skills/lux3d-space/`；`zcode skills list` 验证 |
| **MCP** | 给 Agent 接外部工具服务（stdio/http） | ✅ 接 Aholo 官方 MCP（26 tools） | 见 §6；`features.mcp: true` + `mcp.servers` |
| **Hooks** | 会话/工具事件上的本地程序，可阻断/补上下文 | ✅ 安全守卫 | `guard-protected.mjs` + 项目运行配置 + trust |
| **Plugins（插件）** | 打包分发 skill/command/hook/MCP；UI Plugin 扩展 ZCode 界面 | ❌ 不需要 | 我们把技能直接放项目 `.agents/skills`，不发布插件；ZCode 界面插件与比赛交付无关 |
| **自定义命令** | 插件 `commands/*.md` 定义 `/xxx` 斜杠命令 | ⏳ 可选 | 若高频重复，可加 `/task`、`/verify`；现阶段用 `node collab/cli.mjs` 足够 |
| **Subagent（子代理）** | 运行配置有 `features.subagent`（以实际构建为准） | ⏳ 视需要 | 并行任务多时再开；当前两 Agent 分工已够 |
| **批量任务/轨迹** | `--prompt`、`--json`、运行记录（见 `13-automation.md`） | ✅ 验收用 | 固定工作区、记录版本/命令/结果，写入交接单 |

> 结论：**我们真正需要的是 Agent + Skill + MCP + Hooks 四件；插件不需要。** 这能解释"为什么不是所有扩展都上"。

---

## 6. Aholo MCP 接入（ZCode / DSH 都可用）

ZCode 运行配置（`~/.zcode/cli/config.json` 或项目 `.zcode/config.json`）：

```json
{
  "features": { "mcp": true },
  "mcp": {
    "servers": {
      "aholo": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@manycore/aholo-sdk-mcp"],
        "env": { "AHOLO_API_KEY": "<从环境变量注入，不要写死>", "AHOLO_REGION": "cn" },
        "enabled": true,
        "timeoutMs": 60000
      }
    }
  }
}
```

- 校验：`zcode` 里问"列出 Aholo MCP 工具"或用最小无副作用工具测试；**模型说能用 ≠ 真的连通**（官方文档提醒）。
- 密钥：不写进仓库/项目配置；用用户级环境或凭据注入。
- 可用的代表性 tools：`world_generate`、`world_reconstruct_space_from_files`、`lux3d_img_to_3d_from_file`、`lux3d_part_split`、`lux3d_material_transfer`。
- 若 ZCode 的 MCP 配置格式随版本变化，以 `zcode doctor --json` 与官方 `07-mcp.md` 为准。

---

## 7. GitHub 开源参考（架构知识库参考清单）

> 只参考**架构与代码组织**，不复制业务代码；GPL 项目（Twine）只看思路不拷代码。许可证以各仓库 LICENSE 为准（下表为 2026-11-04 核对）。

### 7.1 运行期/3D（R3F 生态）

| 项目 | 许可证 | 参考什么 | 注意 |
|---|---|---|---|
| [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) | MIT | 组件化 3D、Suspense 加载、render loop 组织 | 我们已用 |
| [pmndrs/drei](https://github.com/pmndrs/drei) | MIT | `PointerLockControls`、`useGLTF`、`Html`、性能辅助 | 我们已用 |
| [pmndrs/zustand](https://github.com/pmndrs/zustand) | MIT | 外部 store、selector、非 React 访问 | 我们已用 |
| [pmndrs/react-three-rapier](https://github.com/pmndrs/react-three-rapier) | MIT | 物理/角色控制器（若替换 AABB 碰撞） | 首版未用，别临时引入 |
| [mrdoob/three.js](https://github.com/mrdoob/three.js) | MIT | 官方 examples：pointer lock、first-person、raycast | 查实现语义的首选 |

### 7.2 叙事/游戏结构

| 项目 | 许可证 | 参考什么 | 注意 |
|---|---|---|---|
| [emollick/zork-underground-empire](https://github.com/emollick/zork-underground-empire) | MIT | 数据驱动房间/对象、纯状态机、存档校验、node:test 策略 | 我们已深度参考（见 `research/01`） |
| [inkle/ink](https://github.com/inkle/ink) | MIT | 叙事脚本 DSL、分支/状态模型 | 远期可做剧情 DSL，不在 15 天内 |
| [inkle/inkjs](https://github.com/inkle/inkjs) | MIT | ink 的 JS 运行时 | 同上 |
| [klembot/twinejs](https://github.com/klembot/twinejs) | **GPL-3.0** | 故事图/变量/链接的组织方式（**只看架构**） | 不复制代码，避免许可证污染 |

### 7.3 资产与 3DGS

| 项目 | 许可证 | 参考什么 | 注意 |
|---|---|---|---|
| [donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | MIT | 压缩/优化/纹理处理 | 管线已用（-89%） |
| [manycoretech/aholo-spatial-sdk](https://github.com/manycoretech/aholo-spatial-sdk) | MIT | Lux3D/World 官方 SDK 用法、MCP 封装 | 官方一手实现 |
| [manycoretech/aholo-viewer](https://github.com/manycoretech/aholo-viewer) | MIT | 3DGS 渲染器/Viewer 集成（记忆回廊） | 高星官方仓库，可自托管 |
| [antimatter15/splat](https://github.com/antimatter15/splat) | MIT | 极简 3DGS Web viewer 架构 | 小场景参考 |
| [mkkellogg/GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D) | MIT | Three.js 内嵌 3DGS 渲染 | 与 R3F 集成可参考 |
| [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | 各资产不同 | 测试模型/合规校验 | 只用作测试，注意资产许可 |

### 7.4 后端/检索/Agent 工具

| 项目 | 许可证 | 参考什么 | 注意 |
|---|---|---|---|
| [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) | MIT | FastAPI 项目分层（routers/models/db）、测试结构 | 我们 server 可对齐分层 |
| [pgvector/pgvector](https://github.com/pgvector/pgvector) | PostgreSQL License | 向量索引/查询写法 | 我们已用 HNSW 设计 |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | 见仓库 LICENSE | MCP server 结构（若自建"场景知识 MCP"） | 未来扩展 |
| [google/model-viewer](https://github.com/google/model-viewer) | Apache-2.0 | 单模型 Web 展示/AR | 与我们的 R3F 场景互补 |

### 7.5 建议优先读的 5 个

1. `pmndrs/react-three-fiber` + `drei`（我们的渲染基座）
2. `emollick/zork-underground-empire`（数据/状态/测试范式）
3. `donmccurdy/glTF-Transform`（资产压缩）
4. `manycoretech/aholo-spatial-sdk`（Aholo 原生接入）
5. `fastapi/full-stack-fastapi-template`（后端分层）

---

## 8. 与 Zork 架构的差异（一句话版）

Zork 是"单体游戏"（纯 Three.js 循环 + 纯数据 + 本地存档 + 程序化几何）；我们是"平台"（R3F 声明式渲染 + 纯 reducer/Effects + Lux3D 资产管线 + 知识检索/受控 Agent + FastAPI/pgvector）。
详细逐层对比与取舍见 `docs/03` 与 `docs/06` 的说明；结论：**继承 Zork 的玩法语法，替换它的生产与信息层**。

---

## 9. 每日/里程碑验收门禁

| 时点 | 必须通过 |
|---|---|
| 每日结束 | `pnpm build`、19/19 单测、5180 可打开；任务板无超 24h 的 in_progress |
| 里程碑（11/08、11/13、11/17） | 公网链接可访问；至少 2 件真实 GLB 可见；报告/视频素材有备份 |
| 提交前 24h | 见 `docs/04` 第 4 节检查清单 |

---

## 10. 参考链接

- ZCode 源码与文档：<https://github.com/zai-org/ZCode>（`apps/zcode-cli/docs/usage/` 下 01–13 章）
- Aholo MCP：<https://labs.aholo3d.cn/api-docs/mcp>
- Lux3D 文档：<https://labs.aholo3d.cn/api-docs/skills/lux3d>
- Aholo World/3DGS：<https://labs.aholo3d.cn/api-docs/skills/aholo-3dgs-reconstruction>
- 本项目入口：`AGENTS.md`、`docs/06-ZCode工程提示词.md`、`collab/README.md`
