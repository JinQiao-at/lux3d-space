# 《提灯与暗门》· Lux3D 叙事空间垂直切片 Demo

> English edition: [README.en.md](./README.en.md)

第一人称 3D 叙事空间 Demo：雨夜书房 → 提灯与黑暗 → 地下室符号机关 → 密室结局。
技术栈按 00-brief §2.3 硬性要求：**Vite + React 19 + TypeScript strict + three + @react-three/fiber + @react-three/drei + Zustand**。

- **零网络资产**：房间、家具、提灯、门、转盘、浮雕、挂毯全部由程序化几何在代码里生成；音效由 WebAudio 振荡器/噪声实时合成。
- **中文 UI 用 HTML overlay**：不引入任何字体文件；3D 场景内不贴中文纹理。
- **纯静态前端**：无后端、无 API key；检索由本地知识数据驱动，Agent 为接口对齐 LLM function calling 的本地规则引擎 stub。

---

## 1. 运行方式

本机捆绑运行时路径（与 00-brief §2.4 一致）：

- Node：`C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`
- pnpm：`C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs`

在本目录（`lux3d-space/demo`）执行：

```powershell
# 1) 安装依赖（已有 pnpm-lock.yaml；首次约 1–2 分钟）
node "C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" install

# 2) 生产构建（tsc --noEmit 严格类型检查 + vite build）
node "C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" build

# 3) 单元测试（Node 24 内置 test runner + 类型剥离）
node --experimental-strip-types --test tests/state-machine.test.ts
#   或（bash / cmd 下通配符展开）：node --experimental-strip-types --test tests/*.test.ts

# 4) 开发服务器（默认 5180）
node "C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" dev --port 5180
# 浏览器打开 http://127.0.0.1:5180/

# 5) UI 截图（需 dev server 已运行；Edge headless + CDP，输出 4 张到 assets/screenshots/）
node --experimental-strip-types scripts/screenshot.mjs
```

> 说明：pnpm v11 默认把 `esbuild` 的安装脚本列入“待批准”并让 install 返回非 0；本项目在
> `pnpm-workspace.yaml` 里用 `strictDepBuilds: false` 让 install 正常返回 0（esbuild 的平台二进制由
> 可选依赖提供，构建已实测通过）。这是 pnpm 11 的供应链策略，不影响运行。

### 自动化验收结果（实测）

| 项 | 命令 | 结果 |
|---|---|---|
| 安装 | `node <pnpm.mjs> install` | ✅ 退出码 0（reused 依赖，Done in 1s；首次安装 +131 packages） |
| 类型检查 | `node <pnpm.mjs> build` 中的 `tsc --noEmit` | ✅ 0 错误（strict + noUnusedLocals + verbatimModuleSyntax） |
| 构建 | `node <pnpm.mjs> build` | ✅ `✓ 619 modules transformed`，`✓ built in 9.76s`，产物 `dist/`（JS 1,358.89 kB / gzip 382.36 kB，CSS 25.41 kB / gzip 6.17 kB） |
| 单测 | `node --experimental-strip-types --test tests/state-machine.test.ts` | ✅ 21/21 通过（7 步主线、条件拦截、谜题、存档往返、检索、Agent、assetRegistry 契约、叙事完整性、日记可收集性） |
| 开发服务器 | `node <pnpm.mjs> dev --port 5180` 后 `curl http://127.0.0.1:5180/` | ✅ HTTP 200，HTML 含 `<div id="root"></div>` 与 `/src/main.tsx` 模块入口；`/src/{App,scene/World,ui/HUD,game/store}.tsx` 均 200（Vite transform 无错） |
| GLB 资产层 | 临时放入最小测试 GLB 后 `curl -I /models/obj_study_desk.glb` | ✅ 探测命中：200 `model/gltf-binary` 724 B → `present` 渲染 GLB；移除后同 URL 返回 200 `text/html`（Vite SPA fallback）→ 被内容类型检查判为 `missing` → 回退程序化几何；`/src/scene/{AssetModel.tsx,assetRegistry.ts,Props.tsx}` transform 均 200（测试后已清空 public/models，仅保留 .gitkeep） |
| UI 截图 | `node --experimental-strip-types scripts/screenshot.mjs`（需先 `pnpm dev`） | ✅ 生成 `assets/screenshots/ui-01-title.png` / `ui-02-hud-study.png` / `ui-03-journal.png` / `ui-04-ending.png`（1600×900 ×4）；脚本自动启停 Edge headless（CDP）、清理 os.tmpdir 临时 profile，只写本机 dev server 与输出目录 |
| 静态产物 | `node <pnpm.mjs> preview --port 5181` / 直接托管 `dist/` | ✅ `dist/index.html` 200（695 B）；`/assets/index-Erk1bYzE.js` 200（1,345,854 B，text/javascript）；`/assets/index-DWCQGfc2.css` 15,776 B；`dist/models/.gitkeep` 随静态产物一起复制（base: './'） |

### 7 步主线自测（直接跑状态机脚本，非 mock）

```
start: stage=arrival zone=zone_study
read:obj_study_diary        -> ok=true stage=find_light  zone=zone_study
search:obj_study_bookshelf  -> ok=true stage=light_it    zone=zone_study
toggle_lantern              -> ok=true stage=descend     zone=zone_study
use:obj_study_floor_door    -> ok=true stage=illuminate  zone=zone_basement
inspect:obj_basement_shower -> ok=true stage=illuminate  zone=zone_basement
inspect:obj_basement_mural  -> ok=true stage=illuminate  zone=zone_basement
inspect:obj_basement_basin  -> ok=true stage=solve_dials zone=zone_basement
dial:obj_basement_dial_3    -> ok=true stage=solve_dials zone=zone_basement
dial:obj_basement_dial_1    -> ok=true stage=solve_dials zone=zone_basement
dial:obj_basement_dial_2    -> ok=true stage=chamber     zone=zone_basement
use:obj_basement_secret_door-> ok=true stage=chamber     zone=zone_chamber
inspect:obj_chamber_pedestal-> ok=true stage=complete    zone=zone_chamber
final: journal=7 inventory=lantern
       flags=clue_diary,has_lantern,cellar_open,saw_secret_outline,clue_symbols,clue_basin,dials_solved,secret_open,ending_seen
```

条件拦截自测（单测覆盖）：未读日记搜书架 ✗、未点灯开地板暗门 ✗、无灯进地下室 ✗（触发 darkness effect）、
未解谜开暗门 ✗、跳过地下室进密室 ✗、错误拨盘 1-2-3 → 重置为 [] 可重试、Agent 回答前后存档字节完全一致（不能推进剧情）。

---

## 2. 操作

| 按键 | 功能 |
|---|---|
| 鼠标点击画面 | 锁定指针开始漫游（浏览器安全策略要求用户手势） |
| `W A S D` / 方向键 | 移动（带 AABB 碰撞，不能穿墙/穿家具） |
| 鼠标 | 第一人称环视（drei `PointerLockControls`） |
| `Shift` | 快走 |
| `E` | 调查 / 阅读 / 搜索 / 使用 / 拨动转盘（准星对准物件时 HUD 提示） |
| `L` | 点亮 / 熄灭提灯 |
| `Tab` / `J` / `F` | 档案检索 / 日记与三级提示 / 叙事 Agent |
| `Esc` | 暂停菜单（继续 / 导出/导入存档 / 设置 / 重新开始）；镜头定位时返回漫游 |

---

## 3. 主流程（7 步，自动化单测覆盖）

1. **arrival**：调查书桌或阅读日记 → 获得线索 `clue_diary`；目标转为“找到光源”。
2. **find_light**：按日记提示搜索书架第三层 → 暗格弹出，获得黄铜提灯（`has_lantern`）。
3. **light_it**：按 `L` 点亮提灯 → 壁炉旁地板暗门显形。
4. **descend**：对地板暗门按 `E` → `cellar_open`，进入地下室；**未点灯无法进入**（被黑暗拦回）。
5. **illuminate**：提灯照亮淋浴间玻璃门（`saw_secret_outline`）、石壁浮雕（`clue_symbols`）、铜管洗手台（`clue_basin`）。
6. **solve_dials**：按浮雕序号与刻文“先三后一，最后二”，依次拨 **转盘·三 → 转盘·一 → 转盘·二** → `dials_solved`，暗门开；错误顺序会震动并重置，可无限重试。
7. **chamber**：穿过东墙暗门进入密室 → 调查石台 → 结局面板 + `ending_seen`，阶段 `complete`。

地下室还有一处“来时的木梯”可以回书房。镜子/油画/壁炉/挂毯等提供环境叙事与知识条目。

---

## 4. 目录结构

```
demo/
├─ index.html                 # root 挂载点
├─ package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├─ tsconfig.json              # strict + allowImportingTsExtensions + erasableSyntaxOnly（兼容 Node 类型剥离）
├─ vite.config.ts             # base './'，dev/preview 127.0.0.1:5180
├─ src/
│  ├─ main.tsx / App.tsx      # 入口、全局快捷键、计时、自动存档、导览
│  ├─ styles.css              # 全部 HTML overlay 样式（无字体文件、无图片资产）
│  ├─ data/
│  │  ├─ scene.ts             # 3 zone / 17 对象 / 14 相机点 / AABB 碰撞 / 条件（数据驱动）
│  │  ├─ knowledge.ts         # 11 条知识条目（与 server/app/seed_knowledge.json 对齐）+ 检索
│  │  └─ narrative.ts         # 阶段目标、房间/对象文案、日记、三级提示、结局
│  ├─ game/
│  │  ├─ types.ts             # Stage/Zone/Flag/Action/Effect/GameState/KnowledgeEntry…
│  │  ├─ actions.ts           # applyAction 纯函数状态机（唯一剧情推进入口）
│  │  ├─ store.ts             # Zustand store + 运行时 UI 状态 + effects 分发
│  │  ├─ save.ts              # localStorage['lux3d.save.v1'] + 导出/导入 + 坏存档兜底
│  │  ├─ interaction.ts       # 视线/距离交互评分 + 圆-AABB 碰撞
│  │  ├─ agent.ts             # 7 工具定义 + 本地规则引擎 + 参数白名单
│  │  └─ audio.ts             # WebAudio 合成音效
│  ├─ scene/
│  │  ├─ World.tsx            # 按 zone 渲染场景
│  │  ├─ RoomShell.tsx        # 房间盒体/地板/墙/天花板/建筑特征
│  │  ├─ Props.tsx            # 每个物件包 <PropAsset>：GLB 优先、程序化几何兜底
│  │  ├─ AssetModel.tsx       # useGLTF 加载 + 底部中心归一化 + 探测/错误兜底（新增）
│  │  ├─ assetRegistry.ts     # objectId → /models/<objectId>.glb（pipeline 脚本自动覆盖生成）
│  │  ├─ Lighting.tsx         # 书房暖光 / 地下室提灯照明 / 密室烛光冷光
│  │  ├─ Player.tsx           # PointerLockControls + WASD + 碰撞 + 交互检测 + 手持提灯
│  │  └─ CameraRig.tsx        # 检索/Agent/导览的镜头 tween
│  └─ ui/
│     ├─ HUD.tsx              # 目标/交互提示/提灯/转盘/快捷键/黑暗遮罩
│     ├─ Overlays.tsx         # 叙事日志、点击提示
│     ├─ TitleScreen.tsx / JournalPanel.tsx / ArchivePanel.tsx
│     ├─ AgentPanel.tsx / PauseMenu.tsx / EndingPanel.tsx / FocusCard.tsx
│     └─ Modal.tsx / dom.ts   # 通用面板、指针锁定与文件下载/读取
├─ public/models/             # Lux3D 生成的 GLB（<objectId>.glb）；空目录 = 纯程序化几何
│  └─ .gitkeep
└─ tests/
   └─ state-machine.test.ts   # 19 个纯逻辑测试
```

---

## 5. 与 00-brief 第 4 节的对应关系

| Brief 要求 | 落点 |
|---|---|
| 3 zone（`zone_study` / `zone_basement` / `zone_chamber`） | `src/data/scene.ts` `ZONES` |
| ≥12 可交互对象及条件/效果 | `OBJECT_LIST` 共 17 个（含 3 个独立转盘），`actions.ts` 实现效果 |
| 7 步主线与 stage 单调推进 | `actions.ts` `advanceStage` + 单测“7 步主线可完整推进到结局” |
| 状态与 flags（brief §4.5 全字段） | `types.ts` `GameState`；`save.ts` 校验/兜底 |
| 提灯与黑暗（无灯不可进地下室） | `Player`/`HandLantern` 镜头点光；`enterZone` 黑暗拦截；`DarknessOverlay` |
| 符号谜题 3-1-2 与错误重试 | `DIAL_SEQUENCE = [3,1,2]`；`dial()` 错误重置 + `dialShake`；`DIAL_WRONG_TEXTS` |
| 知识条目 8 条（含 `book_A16_023`） | `knowledge.ts` 11 条，id 与后端 seed 完全一致，`sources/confidence` 必填 |
| 档案检索：关键词/topic 过滤 → 高亮 + 镜头定位 | `ArchivePanel` → `searchKnowledge` → `store.focusKnowledge` → `CameraRig` tween + `HighlightHalo` |
| 检索↔空间 ID 映射数据驱动 | `KnowledgeEntry.objectId/cameraId`、`SCENE.CAMERA_ANCHORS`；UI 无硬编码映射 |
| Agent stub 7 工具、引用 id/sources、无命中不编造 | `agent.ts` `AGENT_TOOLS` / `answerQuestion`；`AgentPanel` 展示工具调用与引用 |
| Agent 只读、不得改 flags/stage/inventory | 工具白名单 + 单测“Agent 不能推进剧情：回答前后状态完全一致” |
| localStorage 存档 + 导出/导入 + 坏存档兜底 | `save.ts`；`PauseMenu` 导出 JSON / 导入 JSON；单测往返与坏数据 |
| 三级提示 | `HINTS` + `request_hint`（计入 `hintsUsed`）+ 日记面板 |
| UI：首屏/HUD/日志/暂停/设置/结局 | `ui/` 各组件；设置含灵敏度/音量/画质 |
| 无网络资产、中文 HTML overlay、WebAudio | 全部几何程序化；`audio.ts` 合成；无图片/字体文件 |

### 知识条目与后端种子对齐

`src/data/knowledge.ts` 的 11 个 id 与 `server/app/seed_knowledge.json` 一致：
`book_A16_023, kb_study_room, kb_lantern_origin, kb_painting, kb_mirror, kb_shower, kb_mural_symbols, kb_basin_inscription, kb_secret_door, kb_chamber_altar, kb_tapestry`。
字段对齐 `id/zoneId/objectId/cameraId/title/topics/content/sources/confidence`，前端额外使用可选字段
`relatedObjectIds`（objectId 为 null 时的兜底高亮）与 `spoilerLevel`（档案面板剧透标记），不影响后端契约。

### Agent 7 工具（JSON Schema 见 `src/game/agent.ts`）

`search_knowledge(query, filters?)` / `focus_object(objectId, cameraId?)` / `highlight_object(objectId, durationMs?)` /
`show_narration(text, sourceIds?)` / `get_player_state()` / `list_zone_objects(zoneId?)` / `request_hint(level)`。

- 只读约束：工具调用只会触发“镜头定位 / 高亮 / 叙事日志 / 只读状态读取”；`request_hint` 仅累加 `hintsUsed`（brief 明确允许）。
- 无命中时固定回答“档案中没有记录。我不会为这个问题编造答案。”，不返回 citation。
- 接入真实 LLM 时：把 `AGENT_TOOLS` 原样作为 `tools` 传入，把 `answerQuestion` 替换为模型调用，工具执行层复用 store 的 `focusCamera/highlightObject/pushLog/dispatch(request_hint)` 即可。

---

## 6. 数据流（与文档第 8/9/10 章对应）

```
3D 场景（R3F 程序化几何）
   │  视线/距离/朝向评分（interaction.ts）
   ▼
E 交互 → dispatch(Action) → applyAction(state, action) 纯函数
   │                          ├─ 返回新 GameState（stage/flags/inventory/journal/dialOrder）
   │                          └─ 返回 Effect[]（narration/journal/sound/stage/ending/darkness/hint/highlight）
   ▼
Zustand store 分发 effects → HTML overlay（叙事日志/HUD/面板） + WebAudio + 镜头
   ▼
localStorage 自动存档（12s / 页面隐藏时 / 每次操作后）
```

- **UI 不得直接改状态**：只 dispatch；Agent 只产生只读工具指令，由 store 白名单执行。
- **阶段单调**：`STAGE_INDEX` 比较，重复交互只重复文案，不会回退或重复推进。
- **镜头定位**：`FocusTarget.cameraId` → `CAMERA_ANCHORS` → `CameraRig` 四元数 slerp；退出时回到玩家位姿。
- **高亮**：`highlight.objectId` → `OBJECTS[objectId].position` → 脉动线框球 + 点光，自动过期。

---

## 7. 接真实资产（Aholo Lux3D）：GLB 优先 + 程序化兜底

> 新增于 task-4，为 Aholo Lux3D 生成的 17 件真实资产接入 Demo 做准备。**资产目录为空时，行为与纯程序化版本完全一致。**

### 7.1 数据流

```
pipeline/lux3d/assets-manifest.json（17 物件提示词 + scaleHintM + status）
   │  node pipeline/lux3d/generate-assets.mjs
   ▼
demo/public/models/<objectId>.glb          +   demo/src/scene/assetRegistry.ts（脚本覆盖生成）
   │                                              Record<objectId, '/models/<objectId>.glb'>
   ▼
Props.tsx 中每个物件的 <PropAsset objectId="...">
   ├─ Registry 命中 且 HEAD 探测到文件 → <AssetModel> 用 useGLTF 加载真实 GLB
   └─ 未登记 / 文件缺失 / 加载中 / 加载失败 → 原程序化几何（原样保留）
```

### 7.2 关键文件与契约

| 文件 | 说明 |
|---|---|
| `src/scene/assetRegistry.ts` | **自动生成文件，勿手改**：`export const ASSET_REGISTRY: Record<string, string>`，objectId → `/models/<objectId>.glb`。当前为占位版（17 条全覆盖）；pipeline 跑完后只保留 `status=done` 的条目。Demo 代码只依赖 `ASSET_REGISTRY` 这一导出，pipeline 覆盖后无需改代码。 |
| `src/scene/AssetModel.tsx` | `useGLTF(src, false)`（禁用 drei 默认 CDN Draco，保持零外链）；`Box3` 包围盒归一化：XZ 居中、**底部对齐 y=0**；`fitSize` 按 manifest `scaleHintM` 的最大边等比缩放（默认 1 单位 = 1m）；空模型/失败返回 null。导出 `PropAsset`（Registry 查询 + HEAD 探测 + Suspense/ErrorBoundary 三层兜底）与 `ASSET_FIT_SIZE_HINTS`。 |
| `src/scene/Props.tsx` | 17 个可交互物件各自包在 `<PropAsset objectId=... position=... rotationYDeg=...>` 中；GLB 的放置点/朝向集中在这里（底边中心锚点）。交互高亮 `HighlightHalo` 仍由 `OBJECTS[objectId].position` 驱动，不依赖视觉来源。 |
| `public/models/.gitkeep` | 资产目录占位；GLB 由 pipeline 写入，打包进静态产物，无 CDN 依赖。 |

### 7.3 兜底策略（三层）

1. **HEAD 探测**：每个 URL 只探测一次（模块级缓存）；`content-type: text/html` 视为 SPA fallback（缺失），非 200/空文件同样视为缺失 → 直接渲染原程序化几何，不触发加载报错。
2. **Suspense fallback**：文件存在但加载中时先显示程序化几何，加载完成后无缝替换。
3. **ErrorBoundary + null**：GLB 解析/读取失败 → `AssetErrorBoundary` 回退程序化几何（仅 `console.warn`，不产生 console.error）；`AssetModel` 对空 scene 返回 null。

### 7.4 接入步骤（pipeline 产出后）

```powershell
cd lux3d-space/pipeline/lux3d
node generate-assets.mjs --dry-run        # 先看计划
node generate-assets.mjs --only obj_study_desk   # 生成单件验证
node generate-assets.mjs                  # 批量生成（自动写 public/models 与 assetRegistry.ts）

cd ../../demo
node "<pnpm.mjs>" build                   # public/ 会打包进 dist（无需改代码）
node "<pnpm.mjs>" dev --port 5180         # 刷新页面即可看到真实资产
```

- 若资产朝向/尺寸不理想：调整 `Props.tsx` 中对应 `rotationYDeg` / `position` 或 `AssetModel.tsx` 的 `ASSET_FIT_SIZE_HINTS`（这些文件不被 pipeline 覆盖）。
- 若 pipeline 输出 Draco 压缩 GLB：默认已关闭 CDN 解码器；把解码器文件放到 `public/draco/`，在 `AssetModel.tsx` 中把 `useGLTF(src, false)` 改为 `useGLTF(src, '/draco/')`。
- 占位期（目录为空）：17 条 Registry 全部登记、文件均不存在 → 每 zone 首次进入时每个对象一次 HEAD 探测（缓存），只产生网络面板 404 记录，不影响玩法/控制台错误。

---

## 8. 已知限制 / 二期

1. 移动端未做触控（brief 允许；仅保证布局不崩）。Pointer Lock 需要桌面浏览器。
2. 三个 zone 采用“分别渲染 + 传送”的垂直切片实现，不是连续楼层；地下层在视觉上通过木梯/暗门衔接。替换为真实楼层时需要增加楼层流式加载。
3. 场景视觉默认使用程序化几何；已接入 GLB 优先加载层（见第 7 节），等 pipeline/lux3d 产出资产后替换视觉，交互/高亮/状态机不随视觉来源变化。
4. Agent 为本地规则引擎，未接 LLM/pgvector；检索为内存数据（11 条）。接口、工具 schema、只读约束已按接入形态设计。
5. 画质档位（high/balanced）当前只写入存档设置，未切换渲染管线（二期接 dpr/shadow 开关）。
6. 音频需要浏览器用户手势后才会发声（已用“开始探索”点击与全局 pointerdown 解锁）。

### 替换点 / 扩展点

- 新增 zone：在 `scene.ts` 加 `ZoneDef` + 对象数据 + 相机点，`World.tsx` 自动渲染；`actions.ts` 的 `enterZone` 增加进入条件即可。
- 新增对象/谜题：优先在数据层声明 `conditions/visibleWhen`，只有新效果类型才改 `actions.ts` 的 switch。
- 新增知识：直接向 `knowledge.ts` 增补条目（或未来从 `/api/knowledge` 拉取同 schema JSON）；检索、档案、Agent 自动生效。
- 接入真实 LLM：`agent.ts` 的 `ANSWER` 层替换为模型调用，保留 `AGENT_TOOLS` 与 store 白名单执行器。
