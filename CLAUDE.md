# CLAUDE.md · 《提灯与暗门》项目地图（给 Claude Code 的速览）

Aholo 黑客松 3D 叙事解谜游戏：Lux3D 生成资产 → Three.js/R3F 渲染 → Zustand 纯函数状态机 → FastAPI+pgvector 知识检索。

## 目录地图

| 路径 | 内容 |
|---|---|
| `demo/` | 前端（Vite+React19+TS strict+three/R3F+zustand） |
| `demo/src/game/` | 状态机：`actions.ts`（applyAction 纯函数）、`store.ts`（zustand）、`narrative.ts`（JSON re-export 壳） |
| `demo/src/narrative/` | **唯一剧本源**：narrative-content.json（台词/场景文案）+ narrative-agent.json（人设/边界/LLM 配置）+ schema/loader/promptBuilder |
| `demo/src/scene/` | 3D 场景（Props/AssetModel/World/bvh） |
| `demo/tests/` | node:test 单测（state-machine.test.ts，35 个，护栏契约） |
| `demo/tests/e2e/` | **Playwright E2E**（main-story/side-quests/mirror-hall + helpers/hooks） |
| `demo/public/models/` | 17 件 Lux3D GLB（Meshopt 压缩后） |
| `server/` | FastAPI+pgvector（`run.py` 启动、`scripts/seed_pg.py` 灌库、`mcp_server.py` MCP） |
| `pipeline/` | Lux3D 资产管线（manifest/生成/压缩） |
| `collab/` | 双 Agent 任务板（board.json+cli.mjs+handoffs） |
| `docs/` | 设计文档（10 故事技术栈 / 14 提交包 / 15 二期路线图） |

## 常用命令（在 demo/ 下）

生产/备用访问：**https://jinqiao-at.github.io/lux3d-space/**（GitHub Pages 主）/ https://lux3d-lantern-demo.vercel.app（Vercel 备）；本机 DNS 污染期用 PLAYWRIGHT_HOST_MAP="jinqiao-at.github.io=185.199.109.153"（Edge 指纹劫持仍 404 时以 curl 为准）。

```bash
pnpm build                # tsc --noEmit + vite build（门禁）
pnpm test                 # node:test 单测 35 个（护栏）
pnpm exec vite --port 6120   # dev server（Windows 排除段避开 5800/5180）
npx playwright test       # E2E 全量（webServer 自动起 vite）
npx playwright test mirror-hall.spec.ts   # 单 spec
npx playwright show-report
cd ../server && docker compose up -d && python run.py   # pg+API（25432/25433）
python scripts/seed_pg.py --embed       # 知识+向量灌库
```

## Playtest 调试钩子（DEV 构建自动注入）

- `window.getPlaytestState()` → `{started,panel,stage,zone,lanternLit,flags,inventory,journalCount,logTail}`
- `window.applyAction(action)` → dispatch 并返回最新快照；action 为 `{type,objectId?,itemId?}`，type ∈ read/search/inspect/use/use_item_on/dial/toggle_lantern/blow_lantern/keep_lantern
- `window.__store` → zustand store 本体

## 护栏（违反即拒绝）

1. 7 步主线（arrival→complete）与 9 个 FLAG_KEYS 语义不变（单测 695/732 行锁定）
2. 35 个单测全绿是门禁；新增机制=新 case+新表+新测试
3. 台词/文案只改 `demo/src/narrative/narrative-content.json`（**追加不改写**），代码只是读取器
4. 不写任何密钥到仓库（密钥在 server/.env，gitignored）
5. 主线调查条件链：日记→书架需 clue_diary；转盘需三线索 flags（shower/mural/basin inspect）；暗门需 dials_solved

## E2E 已知注意

- WebGL 需 GPU：config 已配 Edge channel + GPU 三参数
- 视觉回归 `toHaveScreenshot` 允许 5% 像素差；3DGS 点云不稳定只断 DOM
- 快进链必含**三线索 inspect**（shower/mural/basin），否则转盘 conditions 不满足
