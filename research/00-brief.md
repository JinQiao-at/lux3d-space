# 00 · 作战简报（Lead 维护，全员必读）

> 项目：Lux3D 叙事空间（内部代号 `lux3d-space`）
> 首个垂直切片 Demo：《提灯与暗门》（The Lantern and the Hidden Door）
> 目标：把用户给的"技术栈 + 管线 + Zork 参考 + 情景/状态系统"整理成**一份可落地的完整设计文档 + 一个可运行的 3D Demo**。
> 本文件是唯一事实来源。所有子任务开工前先读完本文件。

---

## 1. 用户原始诉求（逐条保留，不得丢）

1. 技术栈锁定：**TypeScript + Three.js / React Three Fiber + Zustand + Blender Python + gltf-transform + Node / FastAPI + PostgreSQL / pgvector**。
2. 产品类型：**3D 叙事空间**（不是普通 3D 官网）。第一人称漫游，描述道具，任务推动，适合解谜冒险 / 故事导览。
3. 先做一个**小 Demo**：一间神秘 3D 书房，有可调查的物品，**一条线索解锁密室**；同时体现 **ECO 的信息组织** 与 **ZORK 的探索感**。不要求一开始搭完整大世界。
4. Demo 的具体流程线索（用户口述，语义按最合理方式实现）：**取得提灯 → 进入地下室 → 照亮"淋浴门" → 打开暗门 → 进入密室**。
5. 需要产出**情景图与状态系统**，并包含**状态解锁**机制。
6. Agent 定位：**检索 + 空间 ID → 3D 导航**（不是"把检索结果丢给 Agent 就完了"），要接进 Lux3D 工作流。
7. 开发期/生产期管线：
   `资料/图片/视频 → 编排 Agent（检索、整理证据、资产清单、内容草案）→ Lux3D Skill/MCP（生成单件模型）→ Blender 脚本（统一比例/原点/朝向/材质/碰撞体）→ gltf-transform 压缩 + 场景摆放 + 知识数据 + 剧情数据 → 运行期`。
8. 运行期：`Three.js / R3F：场景/相机/交互/碰撞；信息导航：搜索/高亮/镜头定位/导览；叙事系统：触发器/条件/任务/存档；受控 Agent：检索回答 + 调用前端工具`。
9. 知识条目 schema（用户给的原型）：
   ```json
   { "id": "book_A16_023", "zoneId": "corridor_A", "objectId": "book_A16_023",
     "cameraId": "view_A16_023", "title": "书名", "topics": ["符号学","中世纪"],
     "content": "用于检索和回答的资料", "sources": ["资料来源"], "confidence": "verified" }
   ```
10. 数据流闭环：`Lux3D 生成物件 → Blender 修整和组装 → gltf-transform 压缩 → Three.js 展示与交互 → Zustand 管理状态 → 后端和数据库负责检索、问答与存档`。
11. "适配总体的、添加 Agent"：Agent 是体系的一部分（内容生产 + 运行时受控助手），不是外挂。
12. 自由度/可扩展性：模块可替换、数据驱动、内容可加量；文档要说明替换点与扩展点。
13. 参考链接：
    - 在线 Demo：https://zork-underground-empire.netlify.app/
    - 技术拆解文：https://mp.weixin.qq.com/s/lPK9t2SSz9hn5oA6v71M3w
14. 产出要求：**整理成一个完整文档**，并"在这个框架内去实行"（即按上述栈真的写出可运行代码）。

---

## 2. 已确认决策

### 2.1 目录与写作用域（advisory write scope，不得越界）

| 路径 | 内容 | 负责人 |
|---|---|---|
| `research/` | 参考资料、证据、参考实现分析 | researcher + Lead 的 00-brief |
| `docs/` | 主设计文档、验收清单 | doc-writer |
| `demo/` | 可运行 R3F Demo（Vite + TS） | demo-engineer |
| `server/` | FastAPI + pgvector 骨架（对齐文档 API） | Lead（demo 完成后） |
| 根 `README.md`、`docs/验收清单.md` | 入口与验收 | Lead |

### 2.2 范围（首版）

**做**：3 个 zone（书房 / 地下室盥洗室 / 密室）、约 12 个可调查/可交互对象、1 条主线、1 个符号机关谜题、提灯与黑暗、3 级提示、存档（localStorage + 导出/导入）、信息检索→高亮→镜头定位、受控 Agent（本地规则引擎 stub，接口对齐真实 LLM 工具调用）、完整可读文档。

**不做**：完整大世界、战斗、多人、真实 LLM/向量库接入（只留接口、server 骨架与文档说明）、Lux3D/Blender 实际生成资产（用程序化几何占位并在文档中说明替换路径）。

### 2.3 运行时技术选型（Demo 必须真实安装、可 build）

- React 19 + TypeScript 5.x strict + Vite（最新稳定）
- `three` + `@react-three/fiber` + `@react-three/drei`
- `zustand`
- 测试：Node 24 内置 `node --experimental-strip-types --test`（纯状态机逻辑，UI 不测）
- 无任何网络资产依赖：所有几何程序化生成；中文 UI 用 HTML overlay（不引字体文件）
- 若依赖组合安装失败：允许降级到 React 18 + R3F 8 + drei 9，但必须在报告里说明

### 2.4 运行时路径（沙箱内可用）

- Node：`C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`
- pnpm：`C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs`（`node <pnpm.mjs> ...`）
- Python：`C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`
- 安装依赖示例（在 `demo/` 下）：`node "C:\...\pnpm.mjs" install --reporter=append-only`

---

## 3. 已核实的参考事实（可写入文档，注明来源）

### 3.1 Zork 官网（一手证据，已抓取 bundle / HTML / GitHub 源码）

- 定位：Ethan Mollick（沃顿教授）的独立项目，把 1977/1980 的 Zork I 改编为**浏览器内第一人称 3D 动作冒险**。
- 技术栈：**Three.js 0.180 + Vite + TypeScript**；`package.json` 依赖仅 `three`、字体包；**纯静态前端，无后端、无 API key、无外部资产服务**。
- 资产策略：角色/环境/物体/UI/合成音效**直接在 Three.js 代码里程序化构建或生成**，不导入现成 3D 模型；仅封面插画与部分纹理（如山毛榉叶）为 AI 生成。
- 内容规模：约 **30 个区域**（含 1 个迷宫室）、**19 件宝物**、Stone Barrow 结局；保留原版文案（来源 Microsoft 2025 开源的 Zork I 源码）。
- 探索感机制（一手源码验证）：
  - `types.ts` 数据驱动：`RoomDef`（id/name/description/kind/size/spawn/yaw/exits/objects/enemy/dark/map）、`ExitDef`（requires/blocked/barrier/via/yaw/arrival）、`ObjectDef`（action/requires/hiddenIf/item/treasure）、`GameState`（room/position/yaw/health/stamina/lantern/inventory/flags/visited/journal/checkpoint/deaths/playTime/settings）、`ActionResult`（message/sound/travel/choices/prompt/itemSelection/ending）、`Collider`。
  - `darkness.ts`：`carriesLight()`（物品+灯笼开启）/`hasLight()`（附近有火把）/`grueTiming()` 按难度给宽限、伤害、间隔；黑暗=经典 Grue 死亡威胁。
  - `interaction-target.ts`：门口交互的**朝向+孔径+距离评分函数**，背对门时不提示（可借鉴到我们的交互判定）。
  - `campaign.ts`：全部房间/出口/物件/道具为**纯数据**（如 `START_ROOM`、`ITEMS`、`prop()`、`pickup()` 工厂），文案与 `qa/source-design.md` 映射。
  - HUD/系统：灯笼(L)、地图(M)、日记(J 自动记录 + 三级提示)、背包(Tab)、休息回血与安全点快速返回、三档难度、存档导出/导入、触控。测试覆盖战役/谜题/存档/路线/战斗/触控。
- 结论：**ZORK 的探索感 = 第一人称移动 + 逐房间文字描述 + 光照/黑暗约束 + 物品谜题 + 日记/提示 + 存档**；可复制的是**数据驱动的房间/对象/条件模型**，不是它的美术资产。

### 3.2 微信技术拆解文（已抓取正文，标题：《GPT-6 Astra 把经典文字冒险游戏 Zork 改成可以漫游的 3D 动作冒险游戏》）

- 核心事实：Mollick 用 **GPT-6 Astra** 把 Zork 改成完整 3D 游戏；**保留原版剧情/谜题/文案**，增加战斗；**所有角色与环境直接在 Three.js 中构建**（非导入模型）；人类只给初始指令 + 少量 nudge + 测试微调。
- 成功要素：原作提供了经过打磨的长线叙事、谜题设计、文字质量作为底座；AI 发挥代码生成、3D 实现、系统扩展的强项。完整可玩、有测试覆盖，而非半成品。
- 对我们的启示（必须写进文档）：**"优质现成叙事底座 + AI 生成实现"是可行路径**；我们必须把"内容底座（ECO 知识组织 + 剧本数据）"和"生成实现（Lux3D/Blender/代码）"分层，避免一次生成整世界。

### 3.3 仓库证据（供 researcher 深挖，文档可引用）

- 仓库：https://github.com/emollick/zork-underground-empire（MIT；默认分支 `codex/public-release`）
- 关键文件：`src/types.ts`、`src/campaign.ts`（35KB 场景数据）、`src/main.ts`（46KB 主循环/世界）、`src/darkness.ts`、`src/interaction-target.ts`、`src/world.ts`、`src/models.ts`、`src/materials.ts`、`src/audio.ts`、`src/ui.ts`、`src/touch-controls.ts`、`tests/*.test.ts`。

---

## 4. Demo《提灯与暗门》规格（demo-engineer 按此实现；doc-writer 按此写第 5 章）

### 4.1 体验目标

玩家在雨夜醒来于一间**神秘 3D 书房**：壁炉、书桌、书架、油画、镜子。目标是找到提灯、下到地下室、用提灯照亮淋浴间的玻璃门、发现被封死的暗门、按浮雕线索解开机关、进入密室看到终局。全程第一人称、无战斗、纯探索/调查/解谜，Zork 式"逐房间文字描写 + 环境叙事"。

### 4.2 空间与相机（zoneId / cameraId 规范）

命名规范：`zone_<slug>` / `obj_<zone>_<slug>` / `cam_<zone>_<slug>` / `view_<slug>`（展示用短 id 兼容用户样例 `view_A16_023` 风格）。

| zoneId | 名称 | 光照 | 进入条件 | 关键对象 |
|---|---|---|---|---|
| `zone_study` | 神秘书房 | 暖光壁炉 + 台灯 | 初始 | 书桌、书架、壁炉、油画、镜子、地板暗门 |
| `zone_basement` | 地下室盥洗室 | 全黑（需提灯） | `cellar_open === true` 且进入时手持提灯 | 淋浴间玻璃门、石壁浮雕、洗手台、三个转盘、暗门 |
| `zone_chamber` | 密室 | 冷光/烛光 | `secret_open === true` 且从地下室进入 | 石台、挂毯 |

每 zone 提供 1–3 个 `cameraId` 定位点（用于检索结果"镜头定位"）：
`cam_study_desk`、`cam_study_bookshelf`、`cam_basement_mural`、`cam_basement_shower`、`cam_chamber_pedestal`。

### 4.3 可交互对象表（约 12 个）

| objectId | 所在 zone | 类型/action | 条件 | 效果 |
|---|---|---|---|---|
| `obj_study_desk` | study | inspect | — | 获得线索 `clue_diary`，解锁日记条目 |
| `obj_study_diary` | study | read | — | 阅读半页日记（"三声钟响后，镜子记得来路"）→ `clue_diary` |
| `obj_study_bookshelf` | study | search | `clue_diary` | 触发书架暗格 → 获得 `lantern`（提灯），`has_lantern=true` |
| `obj_study_fireplace` | study | inspect/burn | `has_lantern` | 点亮提灯后的第一个可调查点，提示地板暗门位置 |
| `obj_study_floor_door` | study | use | `lantern_lit && clue_diary` | `cellar_open=true`，进入地下室 |
| `obj_study_mirror` | study | inspect | — | 氛围 + 暗示（"镜中倒影比你多站了一秒"）；三级提示锚点 |
| `obj_study_painting` | study | inspect | — | 知识条目（油画主题），氛围叙事 |
| `obj_basement_lantern_check` | basement | auto | 进入时 `!lantern_lit` | 黑屏提示"伸手不见五指"，强制回书房或点亮 |
| `obj_basement_shower` | basement | inspect | `lantern_lit` | 发现玻璃门后暗门轮廓 → `saw_secret_outline=true` |
| `obj_basement_mural` | basement | inspect | `lantern_lit` | 获得线索 `clue_symbols`（符号 3-1-2 顺序） |
| `obj_basement_basin` | basement | inspect | `lantern_lit` | 获得线索 `clue_basin`（符号含义校验） |
| `obj_basement_dials` | basement | use | `clue_symbols && clue_basin` | 按 3-1-2 解谜 → `dials_solved=true` → 暗门开 |
| `obj_basement_secret_door` | basement | use | `dials_solved` | `secret_open=true` → 进入密室 |
| `obj_chamber_pedestal` | chamber | inspect | — | 结局面板 + 成就；`ending_seen=true` |
| `obj_chamber_tapestry` | chamber | inspect | — | 世界观伏笔（下一章节钩子） |

（实现时可合并为 12 个左右实体，但表中条件/效果必须一致。）

### 4.4 主线任务（7 步）

1. `arrival`：醒来，调查书桌/日记 → 目标"找到光源"。
2. `find_light`：根据日记提示调查书架 → 获得提灯。
3. `light_it`：按 L 点亮提灯（`lantern_lit=true`）→ 壁炉旁地板暗门显形。
4. `descend`：打开地板暗门 → 进入地下室（无灯不可进/进入全黑）。
5. `illuminate`：提灯照亮淋浴间玻璃门与石壁浮雕 → 读到符号线索。
6. `solve_dials`：按 3-1-2 操作三个转盘 → 暗门开启。
7. `chamber`：进入密室调查石台 → 结局。

### 4.5 状态系统（Zustand store 形状，demo 必须实现）

```ts
type Stage = 'arrival' | 'find_light' | 'light_it' | 'descend' | 'illuminate' | 'solve_dials' | 'chamber' | 'complete';
interface GameState {
  version: 1;
  stage: Stage;
  zone: 'zone_study' | 'zone_basement' | 'zone_chamber';
  position: [number, number, number];
  yaw: number;
  inventory: string[];            // ['lantern']
  lanternLit: boolean;
  flags: Record<string, boolean>; // clue_diary, has_lantern, cellar_open, saw_secret_outline, clue_symbols, clue_basin, dials_solved, secret_open, ending_seen
  visited: string[];
  journal: { id: string; title: string; text: string }[];
  dialOrder: number[];            // 玩家已拨顺序，如 [3,1,2]
  hintsUsed: number;
  playTime: number;
  settings: { sensitivity: number; volume: number; quality: 'high' | 'balanced' };
}
```

- 断言式状态机：`applyAction(state, action) -> { state, effects[] }` 纯函数（可单测）。
- 状态转换必须只由玩家交互或显式调试指令触发；Agent 不得直接推进剧情。
- 存档：`localStorage['lux3d.save.v1']`，含 `version`，支持"导出 JSON / 导入 JSON"；对坏存档做兜底（回 `arrival`）。

### 4.6 谜题（符号机关）

- 浮雕给出 3 个符号（如 `△ ○ □`）及对应数字提示；洗手台刻字给出顺序规则"先三后一，最后二"。
- 转盘交互：按 E 拨动第 1/2/3 个转盘，记录顺序；正确序列 `[3,1,2]` → `dials_solved`，播放石门开启音效（WebAudio 合成，无网络文件）。
- 错误组合：转盘短暂震动 + Zork 式文案提示，不惩罚、可重试（对齐"错误选择不丢物品，可重来"）。

### 4.7 知识条目（知识数据文件，8 条，含用户给的样例并扩展）

必须包含用户给的 `book_A16_023` 原型，扩展字段：`id, zoneId, objectId, cameraId, title, topics, content, sources, confidence, relatedObjectIds?, spoilerLevel?`。
至少覆盖：书房建筑、提灯来历、油画、镜子、淋浴门/暗门、浮雕符号学、洗手台刻文、密室石台。`sources` 必填（可为"本项目设定集/参考链接"），`confidence` ∈ `verified | inferred | uncertain`。

### 4.8 信息导航（ECO 的落点）

- 档案检索面板（Tab 打开）：关键词 + topic 过滤 → 结果列表（标题/主题/置信度）。
- 点击结果：`focusObject(objectId)` → 3D 高亮（描边或发光贴图标）+ 相机 tween 到对应 `cameraId` + 底部叙事卡。
- "导览"按钮：按 stage 顺序自动镜头巡游 3 个点。
- 检索与空间 ID 的映射必须走**数据驱动表**（`knowledge.json` 的 objectId/cameraId），不得硬编码在 UI 里。

### 4.9 受控 Agent（本地 stub，接口对齐将来 LLM）

- 面板：输入问题 → 回答；回答必须**引用知识条目**（显示 `[条目 id]` + sources）。
- 前端工具（stub 实现即可，但工具定义要完整）：
  1. `search_knowledge(query, filters?)` → 条目列表
  2. `focus_object(objectId, opts?)` → 相机/高亮
  3. `highlight_object(objectId, durationMs?)`
  4. `show_narration(text, sourceIds?)`
  5. `get_player_state()`（只读）
  6. `list_zone_objects(zoneId)`
  7. `request_hint(level: 1|2|3)` → 返回当前 stage 提示，计入 `hintsUsed`
- 约束：只读游戏状态；禁止改 flags/stage/inventory；工具调用需参数校验与白名单；无匹配时明确说"档案中没有记录"，不编造。
- 降级策略：无 LLM key 时使用**关键词/主题匹配 + 卡片模板**；接入 LLM 时把以上工具按 JSON Schema 暴露（文档给 function calling schema）。

### 4.10 UI/交互清单

- 首屏：标题《提灯与暗门》+ "开始探索/继续" + 操作说明。
- HUD：目标（当前 stage 文案）、交互提示（E）、背包、提灯状态、日记按钮、检索按钮、暂停。
- 叙事日志：底部滚动文字（房间进入描述、调查结果、Zork 式语气）。
- 暂停菜单：继续 / 导出存档 / 导入存档 / 设置（灵敏度、音量、画质）/ 重新开始。
- 结局面板：结局文本 + 统计（用时、提示次数）+ "重新开始"。
- 键盘：WASD 移动、鼠标视角、Shift 跑、E 交互、L 提灯、Tab 档案、J 日记、Esc 暂停。
- 移动端可暂不支持（文档说明二期），但布局不得崩。

### 4.11 验收（硬性）

1. `node <pnpm> install` 成功，`node <pnpm> build` 成功（tsc 无错）。
2. `node --experimental-strip-types --test tests/*.test.ts` 通过：至少覆盖 7 步主线推进、错误条件不推进、暗门/结局条件、存档序列化往返。
3. `node <pnpm> dev --port 5180` 起服务后 `curl http://127.0.0.1:5180/` 返回 200 且 HTML 含 root 挂载点；build 产物 `dist/` 可 `preview` 访问。
4. 代码中无 TODO 占位导致主流程中断；无 `console.error` 启动报错（build 时不要求浏览器运行验证）。
5. README（demo/README.md）说明运行方式、操作、文件结构、与文档的对应关系。

---

## 5. 主文档要求（doc-writer）

**产出**：`docs/01-总体设计与实施方案.md`（单一完整文档，中文，目标 ≥18000 汉字，结构清晰可跳读；可含附录）。

必须覆盖章节（可按需微调，但不得缺项）：

1. 文档说明、术语表、给不同读者的阅读路径
2. 项目定位：3D 叙事空间是什么 / 与普通 3D 网站、游戏、数字展馆的区别；ECO 信息组织 × ZORK 探索感的融合；**自由度与可扩展性**（每模块给"替换点/扩展点"）
3. 需求拆解：用户 14 条诉求 → 可执行需求矩阵（编号、优先级、验收）
4. 总体架构：开发期管线图 + 运行期架构图（mermaid）、模块边界表、数据流（资产/知识/剧情/进度）
5. 技术选型与理由：TS/R3F/Zustand/Blender/gltf-transform/FastAPI/pgvector；替代方案（如 Babylon.js、Unity、Cesium）与取舍；版本与性能预算
6. 内容与信息模型：ECO 三层组织（定义清楚）、空间 ID 规范、知识条目 schema（含用户样例 + 校验规则 + 生成流程）、剧情数据 schema、资产清单 schema
7. Demo《提灯与暗门》完整设计：情景图（mermaid stateDiagram + flowchart）、空间/对象/线索/相机表、解谜条件表、提示三级、结局；与代码文件一一对应
8. 叙事系统设计：触发器/条件/任务/存档；状态机与 TS 类型；存档 schema/版本迁移/导出导入；服务端进度同步 API
9. 3D 交互与信息导航：第一人称控制、碰撞、射线/距离/朝向判定（引用 Zork 的 doorway 评分思路）、检索→空间 ID→高亮/镜头定位/导览；可访问性
10. Agent 设计（受控）：两种 Agent（开发期编排 Agent / 运行期叙事 Agent）；RAG 流程（pgvector）、工具清单一览表 + JSON Schema、权限/白名单/防越权、提示词结构、评测与降级；**遵循 agent-experience 原则**（最小上下文、能力可发现、输出有界、约束前置、局部性）
11. 开发期资产管线（Lux3D）：资料→编排 Agent→Lux3D MCP→Blender Python 规范（比例 1 单位=1m、原点在物体底部中心、Y-up 前向 -Z、命名、材质 PBR、碰撞体命名 `UCX_`）→ gltf-transform（draco/meshopt、纹理压缩）→ 场景摆放/知识/剧情；目录结构、验收清单、性能预算（Draw call/三角形/纹理 MB）
12. 后端与数据：Node 还是 FastAPI 的分工建议、API 清单（GET/POST 表格）、PostgreSQL + pgvector 表结构 DDL、检索 SQL 示例、缓存/限流/鉴权、埋点与运营
13. 实施路线：M0 垂直切片（本次）→ M1 内容管线 → M2 Agent/RAG → M3 多章节平台；里程碑、人力估算、风险与对策
14. 附录：完整 JSON 示例（知识/场景/剧情/存档）、Blender 脚本片段、gltf-transform 命令、FastAPI 骨架片段、参考资料（**链接必须给出**：官网、GitHub、微信文章；微信文章按标题+公众号链接引用，说明抓取时间）

**写作规范**：
- 中文；术语中英对照；图表用 mermaid 代码块；数据/接口用代码块；关键结论给表格。
- 所有"参考事实"必须来自本简报第 3 节或 `research/` 下文件；不得编造 Zork 项目细节、版本号或未验证数据。不确定处标注"待验证/建议"。
- 每个模块结尾加「替换点 / 扩展点 / 验收点」三小节，体现自由度。
- 不要复制大段原文；可以引用短句并注明来源。
- 文档开头放"执行摘要"（1 页内），结尾放"一页速查表"。

---

## 6. 参考实现深挖要求（researcher）

产出两个文件（中文）：
1. `research/01-zork-reference.md`：逐模块分析 Zork 仓库（`types.ts`/`campaign.ts`/`main.ts`/`darkness.ts`/`interaction-target.ts`/`world.ts`/`models.ts`/`ui.ts`/`tests`），给出：数据模型、房间/出口/对象如何组织、交互判定、光照/黑暗、存档、日记/提示、UI/触控、测试策略；每条附"证据（文件/行号或代码片段摘要）+ 对我们的适配建议（R3F/Zustand/pgvector 语境）"。用 GitHub API 读取（raw.githubusercontent 在本环境不可直连，用 api.github.com contents 接口，分支 `codex/public-release`）。
2. `research/02-experience-patterns.md`：从 Zork 官网与微信文章中提炼"探索感"设计模式清单（至少 12 条，如：逐房间文案、黑暗惩罚、物品谜题、日记自动记录、三级提示、地图/指南针、存档迁移、难度、触控…），并给出在我们 Demo 中的落点（stage/object/UI）与取舍说明。
3. 附加（可选）：快速检索 "ECO 信息组织" 是否有公认定义；若无定论，明确写"本文采用的工作定义"，不要硬编。

要求：引用真实代码路径；不要复制整段源码（择要摘录 ≤10 行）；给出可复核的链接。

---

## 7. Agent Teams 协作规则

- 只允许 Lead 创建 teammate；teammate 之间不互相 spawn。需要对方配合时，写文件 + 在完成报告里说明。
- 开工前：`team_task_get` 读任务 → `team_task_update` action=claim（用当前 revision）→ 执行 → `complete`。
- 完成时给 Lead 发 `send_message`（target=lead），内容：任务 id、产出文件、验证命令与结果、风险/未完成项、给其他角色的交接说明。
- 不修改别人写作用域文件；发现冲突立即报告 Lead。
- 不要创建本简报之外的临时文件到 `docs/`、`demo/`、`research/` 根之外；临时文件放 `$env:TEMP`。
- 所有命令使用第 2.4 节的运行时路径；不要 `pip install`/`npm -g` 等污染环境。
- 时间预算：researcher ≤ 25 分钟；doc-writer ≤ 60 分钟；demo-engineer ≤ 75 分钟。到点先交可验收版本，再迭代。

---

## 8. 沟通与报告模板

```
【任务】<task id> <subject>
【状态】完成 / 部分完成 / 阻塞
【产出】<文件路径列表 + 每个文件一句话说明>
【验证】<命令 + 结果>
【风险/未完成】<...>
【交接】<给 Lead / 其他角色的注意点>
```
