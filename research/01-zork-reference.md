# 01 · Zork 参考实现深挖（emollick/zork-underground-empire）

> 用途：为 `docs/01-总体设计与实施方案.md` 第 5/7/8/9/10/11 章提供**一手代码证据**与可落地的适配建议；为 `demo/` 实现提供参考结构。
> 约束：只分析公开源码，不复制大段原文；每条结论给「证据（文件:行）」与「对我们的适配建议（R3F / Zustand / pgvector 语境）」。
> 所有行号基于 **2026-11-03** 通过 GitHub API 抓取的分支 `codex/public-release`（树 SHA `057cdaf6ada8a98ae4baa84264e120cb359c8310`）快照。仓库：<https://github.com/emollick/zork-underground-empire>（MIT，默认分支 `codex/public-release`）。
> 抓取方式：`https://api.github.com/repos/emollick/zork-underground-empire/contents/<path>?ref=codex/public-release`（base64 解码；`raw.githubusercontent.com` 在本环境不可直连）。

---

## 0. 模块地图（为什么值得读）

| 文件 | 行数 | 职责 | 对我们的价值 |
|---|---:|---|---|
| `src/types.ts` | 47 | 全部核心类型：`RoomDef`/`ExitDef`/`ObjectDef`/`GameState`/`ActionResult`/`Collider` | **数据驱动世界模型**的现成范式 |
| `src/campaign.ts` | 402 | 30 区域、99 对象、74 条有向出口、19 宝物的**纯数据** | 场景/线索/条件表怎么写 |
| `src/game.ts` | 775 | 纯状态机：`createGame`/`interact`/`travel`/`objective`/`hints`/`serialize`/`deserialize` | **可单测的 applyAction 范式** |
| `src/main.ts` | 648 | 主循环：输入、目标选择、黑暗计时、存档定时、UI 事件绑定 | 交互判定与运行时胶水 |
| `src/darkness.ts` | 25 | 光源判定 + Grue 宽限/伤害/间隔 | 提灯/黑暗系统直接对照 |
| `src/interaction-target.ts` | 20 | 门口「朝向 + 孔径 + 距离」评分函数 | 我们「E 键交互判定」的数学原型 |
| `src/world.ts` | 2536 | 按 `room.kind` 程序化搭建环境 + 碰撞盒 + InstancedMesh 合批 | 程序化占位几何 + collider 生成 |
| `src/models.ts` | 1929 | `makeProp(type)` 道具工厂、`makeCreature(kind)`、`bake()` 几何合并 | 程序化资产的组织方式 |
| `src/ui.ts` | 295 | 纯 DOM overlay：标题/HUD/日记/地图/背包/暂停/结局 | 我们的 HTML overlay UI 同构参考 |
| `src/touch-controls.ts` / `touch-input.ts` | 157 / 60 | 虚拟摇杆、多指所有权、触控按钮 | 移动端二期方案 |
| `tests/*.test.ts` | 12 文件 / 77 个 `test()` | 战役/谜题/存档/路线/黑暗/触控/模型 | 测试策略与断言风格 |

关键事实：依赖仅 `three@0.180.0`、两个字体包（`package.json` 第 15–18 行），**纯静态前端、无后端、无 API key**；`npm test` = `node --experimental-strip-types --test tests/*.test.ts`（`package.json` 第 8–13 行）——与 00-brief §2.3 的测试选型完全一致，可直接沿用。

---

## 1. 数据模型（`src/types.ts`）

### 1.1 房间——静态地理与氛围

```ts
// src/types.ts:22-27
export interface RoomDef {
  id: string; name: string; subtitle: string; description: string;
  kind: RoomKind; size: Vec2; spawn: Vec2; yaw?: number;
  exits: ExitDef[]; objects: ObjectDef[]; enemy?: EnemyDef;
  dark?: boolean; map: Vec2;
}
```

- `kind` 是 **24 种枚举**（`forest/house/cellar/.../barrow`，第 3 行），运行时用来分派场景搭建函数（`world.ts:2507-2529` 的 `switch(room.kind)`）。
- `subtitle` 不是装饰：UI 上作为「区域小标题」（`ui.ts:263`），`map` 是二维地图格坐标（`ui.ts:210-229` 用它画 SVG 地图）。
- `dark?: boolean` 只有布尔：黑暗是房间级属性，**不是逐物体光照**（第 26 行）。

**适配建议（我们）**：Demo 的 `zone_study/zone_basement/zone_chamber` 可以简化 `kind` 为 `'study' | 'basement' | 'chamber'`，保留 `subtitle`（「THE EDGE OF THE EMPIRE」式的仪式感副标题可直接对位我们书房/地下室/密室的中文副题）；`map` 坐标保留，供「导览/小地图」二期使用；`dark` 变成 `lighting: 'warm' | 'none' | 'cold'` 三态，比布尔更贴合 00-brief §4.2 的三 zone 光照表。R3F 中 `RoomDef` 建议作为 `zones.ts` 的只读常量，**不进 Zustand**（静态数据与运行时状态分离）。

### 1.2 出口——条件、屏障、朝向与到达点

```ts
// src/types.ts:4-15（节选）
export interface ExitDef {
  id: string; to: string; label: string; position: Vec2;
  requires?: string; blocked?: string; district?: string;
  role?: 'passage' | 'water' | ... | 'mirror';
  barrier?: 'rubble' | 'sealed-wall' | ... | 'drop';
  via?: string; yaw?: number;
  arrival?: { position: Vec2; yaw: number };
}
```

- `requires` 是 **flag 名**（不是函数），`blocked` 是条件不满足时的文案 → 条件与提示文案都数据化（见 `game.ts:478`）。
- `barrier` 决定门口视觉形态（`world.ts` 的 `routeBarriers()` 用它画碎石/封墙/钉死门），`via` 表示「这条路线由某个 ObjectDef 承载交互」（window/mirror/rope 等），`arrival` 是**玩家从对向进来时的落点与朝向**（第 14 行）。
- 这一层把「旅行规则、门口外观、到达体验」拆成三条可独立演化的数据线（`campaign.ts:355-357` 注释明确说明）。

**适配建议（我们）**：`ExitDef` 直接映射为 `knowledge`/`scene` 数据中的 `exits`；`requires` 用 00-brief §4.5 的 `flags` 名（如 `cellar_open`、`secret_open`）；`arrival` 必须实现，否则「进入地下室后正对来路、E 键立刻提示返回」会造成交互误触（Zork 用测试强制了这一行为，见 §10）。**pgvector 侧**：出口不需要向量化，但 `to` 指向的 zoneId 应作为知识条目分区键；`via` 的 objectId 与知识条目 `objectId` 对齐，供「检索→空间 ID→镜头定位」反查。

### 1.3 对象——行为标签 + 可见性条件

```ts
// src/types.ts:16-20
export interface ObjectDef {
  id: string; label: string; type: string; position: Vec3;
  action: string; description?: string; requires?: string; hiddenIf?: string;
  item?: string; treasure?: boolean; district?: string; yaw?: number;
}
```

- `action` 是**分派键**：`take/read/inspect/use/say/rest/...`，`game.ts:304-471` 的 `switch(object.action)` 是唯一执行入口。
- `hiddenIf` / `requires` 是可见性条件：`objectVisible()` 一句话判定（`game.ts:40-42`），`hiddenIf` 表示「完成后隐藏」（如 `picked_lantern`），`requires` 表示「解锁后出现」（如 `cellar_hatch` 需要 `trapdoor_open`）。
- `item?: string` 让「世界里的拾取物」与 `ITEMS` 表分离：对象只是放置点，物品数据单表（`campaign.ts:56-62` 的 `pickup()` 工厂把二者缝合）。

**适配建议（我们）**：与 00-brief §4.3 的对象表一一对应，`action` 收敛为 `inspect/read/search/use/take`；`hiddenIf` 语义保留为「已取走/已消耗则隐藏」，`requires` 保留为「前置 flag 解锁才可见/可交互」；`item` 放进知识条目 schema 的 `objectId` 而非另起一套物品表（我们只有 1 件提灯 + 若干线索，物品表可省，`inventory: string[]` 足够）。注意 Zork 的 `useItem()` 把「检查」与「使用」拆成两步（见 §4.3），这对我们「书房调查 → 书架暗格」的节奏非常关键。

### 1.4 运行时状态

```ts
// src/types.ts:31-38
export interface GameState {
  version: number; room: string; position: Vec2; yaw: number;
  health: number; stamina: number; lantern: boolean;
  inventory: string[]; deposited: string[]; flags: Record<string, boolean>;
  visited: string[]; journal: JournalEntry[]; checkpoint: string;
  enemies: Record<string, number>; deaths: number; playTime: number;
  completed: boolean; settings: Settings;
}
```

- 单一可 JSON 化的状态对象 + `version: number`（存档迁移依据，见 §7）。
- `flags: Record<string, boolean>` 是**通用条件总线**：所有谜题进度都写 flag，不新增字段（`game.ts` 全文 60+ 处 `state.flags.xxx`）。`inventory/deposited` 分离（携带 vs 陈列），`visited` 数组、`journal` 幂等条目、`checkpoint` 安全点、`playTime/deaths` 统计。

**适配建议（我们）**：00-brief §4.5 的 `GameState` 基本是它的子集 + `stage/dialOrder/hintsUsed`。建议补三处：① `version: 1` 与迁移分支；② `journal` 条目 `{id,title,text}` 保留（我们叫「日记」）；③ 增加 `settings`（灵敏度/音量/画质）与 `playTime`（结局面板统计）。**不要把知识条目塞进 GameState**：知识检索是外部数据（将来 pgvector），运行时只存「已发现条目 id / 已高亮 objectId」，避免存档膨胀与版本耦合。

### 1.5 动作结果——UI 与状态机之间的协议

```ts
// src/types.ts:39-46
export interface ActionResult {
  message: string; title?: string; success: boolean; sound?: string;
  travel?: string; refresh?: boolean; ending?: boolean;
  choices?: { label: string; action: string }[];
  prompt?: { label: string; action: string; submit: string };
  itemSelection?: boolean; feedback?: string;
}
```

- **状态机不直接碰 UI**：`interact()` 只返回 `ActionResult`，主循环 `handleResult()`（`main.ts:133-144`）决定 toast / 弹窗 / 切场景 / 结局 / 存档。
- `choices`（按钮列表）、`prompt`（可输入文本，如对 Cyclops 说名字）、`itemSelection`（从背包选物品使用）、`feedback`（选错时的非惩罚反馈）覆盖了我们需要的全部交互形态。

**适配建议（我们）**：00-brief §4.5 的 `applyAction(state, action) -> { state, effects[] }` 建议直接演化为「`ActionResult` + `effects[]`」：`effects` 用**数据**描述表现（`{type:'sfx', id:'stone_door'}`, `{type:'focus', objectId}`, `{type:'journal', entry}`），R3F 侧执行器消费；这样 Agent 工具 `show_narration/focus_object` 也能复用同一 effects 管道，且纯函数状态机保持可单测（不 import three）。

---

## 2. 场景数据组织（`src/campaign.ts`）

### 2.1 四层工厂（数据即代码，代码即数据）

| 层 | 证据 | 说明 |
|---|---|---|
| 物品表 `ITEMS` | `campaign.ts:10-49` | 39 个 `ItemDef`，`treasure: true` 的 **19 件**（第 51 行 `TREASURES` 派生） |
| 对象工厂 `prop/pickup/inscription/rest` | `campaign.ts:53-98` | 位置默认 `[x,0,z]`；`pickup` 自动补 `item/hiddenIf:picked_<id>`；`inscription` 按 `cluePresentation` 选表现形态（道具/墙刻/纸条） |
| 房间工厂 `room()` | `campaign.ts:99-101` | 默认 `spawn=[0, size/2-5]`、`yaw=0`、`exits:[]`，出口后挂 |
| 图结构 `link/passage` | `campaign.ts:295-304` | `passage` 双向建边；`link` 单向 + `requires/blocked` |

统计（脚本核对 `campaign.ts:103-286`）：**30 房间 / 99 个 ObjectDef / 74 条有向出口 / 7 个 `dark:true` 房间**。规模正好是「一天可玩完」的完整游戏，不是 demo。

**适配建议（我们）**：把「工厂函数生成数据」保留为**构建期脚本**（`scripts/build-scene.ts` 读 `research`/设定表 → 生成 `demo/src/data/scene.ts` 或 `scene.json`），但**运行期只读 JSON**；否则 Blender/glTF 管线的导出物（位置/包围盒）没法写回 TypeScript 字面量。Zork 用 TS 字面量的原因是零构建依赖，我们有内容管线，应收敛为「JSON + zod 校验」。

### 2.2 出口元数据后置补全（避免重复书写）

`campaign.ts:355-387`：`routeDetails` 以 `exit.id` 为键，集中声明 `role/barrier/via/yaw/arrival`；`388-399` 统一回填，并做 **`via` 一致性断言**：

```ts
// campaign.ts:391-395
if (exit.via) {
  const object = room.objects.find(value => value.id === exit.via);
  if (!object) throw new Error(`Missing travel object for ${exit.id}`);
  exit.position = [object.position[0], object.position[2]];
}
```

`yaw` 也由位置自动推断（第 396–398 行：靠墙方向决定朝外角度）。这是「数据一处写、多处派生」的典型，**减少手写坐标错误**，并让旅行规则与门口模型共享同一坐标。

**适配建议（我们）**：Demo 的 `obj_study_floor_door`（地板暗门）与地下室入口属于同一 route：让 `exit.via = 'obj_study_floor_door'`，则交互对象与「去地下室」的出口共享位置；再用构建期断言检查「每个 `via` 都能在对象表找到」+「每条出口都有对向边」。**pgvector**：该类派生数据（`arrival`/`yaw`）不进知识库，只在场景数据里。

### 2.3 房间原型的「视觉—交互—叙事」三线合一

每个 `room()` 同时携带：`kind`（视觉原型）、`objects`（交互点）、`description`（进入时逐字打出的叙事文本）、`map`（地图位置）。`world.ts` 按 `kind` 建环境，`ui.ts:262-266` 弹房间标题卡，`main.ts:128-131` 进房时 toast 房间描述。**一次数据录入，三个系统消费**。

**适配建议（我们）**：`zone` 数据结构同样三线合一（`scene.json` 的 zone 节点 + `knowledge.json` 的 zone 条目），但**描述文案单独放 `narrative.ts`**（便于 Agent/翻译/审校），房间节点只存 `descriptionId`；这样受控 Agent 的 `show_narration` 能找到同一份文案源。

---

## 3. 状态机与交互执行（`src/game.ts`）

### 3.1 纯函数 + 可变草稿

`createGame()`（`game.ts:13-21`）返回带 `version` 的初始状态；`interact(state, objectId, choice?)`（`game.ts:300-473`）直接在传入 state 上改字段并返回 `ActionResult`。主循环每次调用后立即 `refresh()/save(true)`（`main.ts:143`）。**没有 reducer/immutable 拷贝**，简单但依赖调用纪律。

**适配建议（我们）**：00-brief 要求 `applyAction(state, action) -> {state, effects}` 纯函数 —— 用 **Zustand `set` 内调用纯函数 + 返回新对象**（`structuredClone` 或手写快照）实现，保留「状态机不 import three / 不碰 DOM」这一条即可；Zork 的「原地改 + 立即持久化」在 R3F 里会导致 React 渲染节流，不建议照抄。

### 3.2 交互分派大 switch（行为标签的代价）

`game.ts:304-471` 是约 170 行的 `switch(object.action)`：`take/read/mailbox/window/rug/.../default`。绝大多数 case 内聚为「检查前置 → 改 flags → 返回文案/选项」。复杂谜题抽成独立函数（`cyclops/eggLock/controls/ritual/basket/machine`，`game.ts:137-298`），需要物品选择的统一走 `useItem()`（第 66–79 行）。

**判断**：这是**可读但有上限**的写法——30 区域可维护，300 区域会失控。我们 Demo 只有 12 个对象，可以照抄；但设计文档要写清「规模上去后改为 `interaction handlers` 注册表 + 数据条件表达式」的替换点。

**适配建议（我们）**：`applyAction` 用 **handler 表**（`Record<objectId, Handler>`）而不是 switch，每个 handler 是纯函数 `(state, action) => Result`；这样 Agent 的只读工具（`list_zone_objects`、`get_player_state`）与玩家动作共享同一对象注册表，且便于按对象单测。

### 3.3 「检查—选择物品」两段式（错误不惩罚）

```ts
// game.ts:66-79（节选）
function useItem(state, choice, id, title, observation, refusal) {
  if (choice === `use:${id}` && hasItem(state, id)) return;   // 已选对，继续执行
  const selected = choice?.startsWith('use:') ? choice.slice(4) : undefined;
  return { success: choice === undefined, title, message: observation, itemSelection: true,
    choices: state.inventory.filter(...).map(item => ({ label: ITEMS[item].name, action: `use:${item}` })),
    feedback: ... };
}
```

- 第一次交互只「观察」并弹出背包选择（`itemSelection: true`）；选择错误 → `feedback` 文案，**物品不消耗、可无限重试**（`ui.ts:152-202` 专门为「重试时保留焦点与滚动位置」写了 50 行）。
- README 明确写：「Unsuitable choices leave your possessions intact; **Step away** lets you return later.」

**适配建议（我们）**：Demo 的书架暗格/提灯点亮/转盘是最适合复用此模式的三处：交互先给观察文案 + 选项，**错误不扣物品、不推进 flag**；这直接回应 00-brief §4.6「错误组合不惩罚、可重试」。UI 上保留「离开/稍后再来」按钮（`ui.ts:144` 的 `Step away`），降低玩家被卡住的挫败感。

### 3.4 旅行是「原子事务」

```ts
// game.ts:475-489（节选）
export function travel(state, exitId) {
  const exit = ROOMS[state.room]?.exits.find(...);
  if (!exit) return no('There is no passage that way.');
  if (exit.requires && !state.flags[exit.requires]) return no(exit.blocked ?? 'The way is not yet open.');
  const arrival = arrivalAt(destination.id, state.room);
  state.room = destination.id; state.position = arrival.position; state.yaw = arrival.yaw;
  if (!state.visited.includes(destination.id)) { state.visited.push(...); note(...); }
  return { success: true, travel: destination.id, ... };
}
```

- 条件失败时**不改任何字段**（`campaign.test.ts:261` 有「失败不制造进度」的断言）。
- 首次进入自动写日记（`place_<id>`，幂等 `note()`），并返回房间描述给 UI。

**适配建议（我们）**：`transitionZone(zoneId)` 同构；条件失败要返回原因文案（`blocked`），不要静默；进入 zone 时一次性执行「首次访问 → 日记 + 目标更新 + 黑暗检查」，避免分散在多个组件 effect 里导致重复触发。

### 3.5 目标（objective）与提示（hints）是纯函数

- `objective(state)`（`game.ts:505-551`）：按「黑暗 > 已完成 > 宝物集齐 > 当前房间 + flags」优先级返回 `{title, text}`，**HUD 目标栏只是它的渲染**（`ui.ts:267`）。
- `hints(state)`（`game.ts:553-707`）：同样按「黑暗/结局/全宝物/房间」优先级返回**恰好 3 条**字符串数组（从轻提示到完整解法），`campaign.test.ts:276` 有「每个 stage 都有有序三级提示」的断言。
- `hintKey(state) = JSON.stringify([state.room, hints(state)])`（`game.ts:709`）：用「房间 + 当前提示内容」做上下文键；`main.ts` 用 `hintProgress: Map<string, number>` 记住每上下文已看到第几级（`main.ts:437-441`）。**换房间/进度推进 → 提示重新从第 1 级开始**，不会一上来就给答案。

**适配建议（我们）**：Demo 的 `request_hint(level)` 工具直接落地为 `hintsForStage(stage): [string,string,string]` 纯函数；`hintsUsed` 计次；**Agent 只能读不能改 stage**（00-brief §4.9），提示也走同一只读函数。三级文案按「环境暗示 → 机制提示 → 明确操作」组织（Zork 的实际写法：`Have you examined...` / `The brass lantern is battery-powered.` / `Take the brass lantern ... press E`）。

---

## 4. 交互判定：门口评分（`src/interaction-target.ts` + `main.ts`）

### 4.1 评分函数（全文 20 行，两段式）

```ts
// interaction-target.ts:6-20（节选）
export function doorwayTargetScore(exit, position, forward) {
  const dx = position.x - exit.position[0], dz = position.z - exit.position[1];
  const yaw = exit.yaw ?? 0, sin = Math.sin(yaw), cos = Math.cos(yaw);
  const inward = dx * sin + dz * cos, across = dx * cos - dz * sin;
  const facingThrough = -(forward.x * sin + forward.z * cos);
  if (Math.abs(across) <= 1.25 && inward >= -1.1 && inward <= 1.5 && facingThrough > .45) {
    return Math.abs(inward) + Math.abs(across) * .25 + (1 - facingThrough) * 1.2 + .4;  // 门槛模式
  }
  const distance = Math.hypot(dx, dz);
  if (distance < .5 || distance >= 4.3) return Infinity;
  const dot = -(dx * forward.x + dz * forward.z) / distance;
  return dot > .68 ? distance + (1 - dot) * 2.5 + .4 : Infinity;  // 锥形模式
}
```

要点（均可复核）：
1. **门槛优先**：先转到出口局部坐标（`inward` 沿门轴、`across` 横向），孔径 ±1.25m、纵深 −1.1~+1.5m、面朝门的方向分量 >0.45 → 命中；分数随「偏离门中心 + 偏离朝向」增大（越小越好）。
2. **否则退化为「距离 + 点积」锥形**：0.5–4.3m 内、朝向点积 >0.68 才可用。
3. **背对门口不给提示**：`facingThrough` 门槛保证「刚从门口进来、背对来路」时不会误触返回（`interaction-target.test.ts:110-119` 对全部真实出口做了断言）。
4. **只是评分**：`selectTarget()`（`main.ts:155-196`）把「所有对象分数」与「所有出口分数」放在同一数值空间里竞争，取最小者；对象侧：`distance < 3.6 && dot > 0.72 → distance + (1-dot)*2.8`（`main.ts:168-169`），`via` 出口（窗/镜）改用门口评分（`main.ts:167-168`）。
5. 黑暗降级：黑暗超过 4 秒且无光时，**跳过绝大多数对象目标**，只保留已开的格栅与地板暗门（`main.ts:160`）——即「看不见就别提示能调查的东西」。

**适配建议（我们）**：Demo 只需一个 `selectInteractable(state)`：对每个 `ObjectDef` 用「距离 ≤3.0m + 前向点积 >0.72」打分，对门/暗门用同样的门槛模式（我们的门有明确朝向与开洞），取最小分。R3F 中不要用 raycast 独占：raycast 在移动端/低帧率会漏，**用「评分排序 + 单个最高亮」**更稳（也便于触屏点击提示条）。阈值可按我们 1 单位 = 1m 的房间尺寸（书房约 8×6m）缩放为：孔径 ±0.9m、纵深 −0.8~+1.2m、距离 3.0m、点积 0.7。**测试**：把 `selectInteractable` 抽成不依赖 three 的纯函数（输入位置/朝向/对象表），单测覆盖「背对暗门不提示」「隔墙不提示」「黑暗不给提示」。

### 4.2 测试把「真实 main.ts 函数」拿来做集成测试（重要技巧）

`tests/interaction-target.test.ts:16-30` 用 TypeScript Compiler API **从 `main.ts` 源码里抽出 `selectTarget` 函数体**、转译成可执行函数、注入依赖（ROOMS/评分函数/Vector3）后跑断言：

```ts
// interaction-target.test.ts:16-30（摘要）
const mainSource = ts.createSourceFile('main.ts', readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8'), ...);
const selector = mainSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'selectTarget') ...;
const compiledSelector = ts.transpileModule(selector.getText(mainSource), ...).outputText;
const select = new Function('ROOMS','doorwayTargetScore','hasLight','Vector3', `... ${compiledSelector} ...`)...
```

好处：UI/渲染边界（camera/UI stubs）之外，**用生产代码测生产行为**，避免「纯函数测得很开心、主循环接错」。代价：依赖 `typescript` devDependency 与源码字符串匹配，重构要同步改测试。

**适配建议（我们）**：我们的 `selectInteractable` 本来就设计为纯函数，直接单测即可；不必照抄源码抽取；但**建议保留一条「主循环 ↔ 状态机」集成测试**：用 fake view（位置/朝向）跑 `selectInteractable + applyAction`，确认按 E 真的推进了 stage，而不是只测 applyAction。

---

## 5. 光照 / 黑暗（`src/darkness.ts` + `main.ts`）

```ts
// darkness.ts:9-25（节选）
export function carriesLight(state) {
  return state.inventory.includes('torch') || state.lantern && state.inventory.includes('lantern');
}
export function hasLight(state) {
  if (carriesLight(state)) return true;
  return ROOMS[state.room].objects.some(object => object.type === 'torch'
    && !(object.hiddenIf && state.flags[object.hiddenIf]) && (!object.requires || state.flags[object.requires])
    && Math.hypot(object.position[0] - state.position[0], object.position[2] - state.position[1]) < 3.2);
}
export function grueTiming(state) { /* explorer 16s/20/3.2s, adventurer 12s/30/3s, veteran 10s/40/2.8s */ }
```

- 光源 = **携带物**（火把或「灯笼开关开 + 在背包」）**或房间内 3.2m 内的可点燃火把**；纯函数，不依赖渲染。
- 主循环（`main.ts:348-356`）：`darkTime += dt`；**1.3 秒后**弹 Grue 警告并写一次日记（`id:'grue'`，幂等）；`darkTime >= grace` 后按 `interval` 反复扣血，死亡走统一 `hurt()`；离开黑暗立刻 `darkTime = 0`。黑暗程度还会传给渲染层做遮罩（`main.ts:623`：`darkness: Math.min(1, darkTime/7)`）。
- 黑暗文案直接引用 MIT 的 Zork I 原文（`darkness.ts:4-7`），且 `hasLight` 也用于 HUD 目标（`game.ts:506`）和提示（`game.ts:555-557`）——**同一判定三处消费**。

**适配建议（我们）**：Demo 不需要 Grue 死亡；把「黑暗 = 信息遮蔽 + 风险提示」：
1. `basement` 在 `!lanternLit` 时：屏幕近黑、交互提示仅保留「点灯/返回」、目标栏显示「伸手不见五指」；
2. 1.5 秒缓冲后再弹提示（Zork 用 1.3s，避免瞬移误判）；
3. `hasLight` 类纯函数放 `logic/light.ts`，被目标/提示/渲染遮罩三处复用；
4. 提灯「点亮」是玩家显式动作（对应 Zork 的 L 键/拿灯自动亮两种路径——`take()` 里拿灯笼即 `state.lantern = true`，`game.ts:87-91`；我们按 00-brief 用 **L 键显式点亮**，更符合「照亮淋浴门」的解谜节奏）。**测试**：`hasLight` 的边界（有灯未点/点了没灯/房间火把）单独单测。

---

## 6. 存档（`game.ts:711-771` + `main.ts`）

### 6.1 序列化：直接 `JSON.stringify`，但**版本 + 校验 + 修复**全在反序列化

```ts
// game.ts:719-728（节选）
export function deserialize(raw: string): GameState | null {
  if (typeof raw !== 'string' || raw.length > 1_000_000) return null;
  const data: unknown = JSON.parse(raw);
  if (!plain(data) || ![1, SAVE_VERSION].includes(data.version) || typeof data.room !== 'string' || !Object.hasOwn(ROOMS, data.room)) return null;
  ...
}
```

值得照抄的细节（按行）：
- `SAVE_VERSION = 2`（`game.ts:9`），同时接受 v1 并**在读取时迁移**（第 723、734、737 行：v1 世界坐标转换 + `districtYaw` 旋转补偿）；测试 `continuity-darkness.test.ts:8-22` 断言「迁移只发生一次」。
- **ID 白名单**：`inventory` 每项必须在 `ITEMS` 里、`deposited` 必须在 `TREASURES` 里（第 725 行）；`flags` 键名过正则 `/^[a-z][a-z0-9_]{0,80}$/`，并显式拒绝 `constructor/prototype/__proto__`（第 742 行）——**防原型污染**。
- **去重与互斥**：背包/陈列各自无重复、且不交叉（第 727 行）；重复则整档作废。
- **数值 clamp**：位置按 `sceneBounds` 内缩 0.4m 夹紧、yaw 有限值、health/stamina 0–100、playTime 上限、音量/灵敏度/FOV 范围（第 713-714、736-738、760-766 行）。
- **journal 截断**：最多 300 条，每字段截断到 100/200/2000 字符（第 752 行）。
- **派生状态重算而非信任**：`picked_<id>` flag 由背包/陈列重推（第 745 行）；`completed` 必须同时满足「19 宝物、地图、已进 barrow」才为 true（第 768 行）——**防止改档直接跳结局**。
- 失败返回 `null`，主循环回退 `createGame()`（`main.ts:26-29`）。

### 6.2 自动保存与导出/导入（`main.ts`）

- `SAVE_KEY` 带版本前缀 `zork-expedition-v1`，QA 模式再拼 review id（`main.ts:24`）——**同一域名多存档槽隔离**。
- 保存节奏：每 **8 秒**自动保存（`main.ts:615`）+ 关键动作后 `save(true)`（`main.ts:143`）+ 暂停/返回标题/导出前保存（`main.ts:89, 449-451`）；`save()` 先把相机位置/yaw 写回 state（`main.ts:64`）。
- 导出：`Blob([serialize(state)], {type:'application/json'})` + `<a download>`（`main.ts:450-456`）；导入：`<input type=file>` → 限 1MB → `deserialize` 失败给明确错误（`main.ts:478`）。

**适配建议（我们）**：00-brief §4.5 要求 `localStorage['lux3d.save.v1']` + version + 导出/导入 + 坏档兜底——Zork 这份实现可**直接作为规范蓝本**：保留白名单校验（我们的 flags 清单固定，用 `FLAG_KEYS` 集合校验比正则更严）、位置 clamp 到 zone 包围盒、journal 截断、`stage` 反推校验（stage 与 flags 必须一致，不一致按 flags 重算）。版本迁移我们只需 `version: 1` + 未来 v2 的 `migrate()` 骨架。**服务端同步**（FastAPI）：导出 JSON 即同步载荷，服务端应重复同一套校验（不信任客户端），并加 `updatedAt` 乐观锁。

---

## 7. 日记与提示（`game.ts` + `ui.ts` + `main.ts`）

- **日记幂等**：`note(state, id, title, text)` 同 id 只写一次（`game.ts:46-48`）。触发点遍布：首次进入房间（`travel`）、读线索（`read` case）、谜题解决（各 handler）、黑暗（`main.ts:352`）、休整（`rest`）。全文 `note(` 调用 30+ 处；测试断言「走回头路不重复记录」（`continuity-darkness.test.ts:42-44` 断言 journal.length 不变）。
- **日记 = 自动记录 + 线索回看**：UI 左侧「YOUR OBSERVATIONS」显示当前目标 + 提示按钮，右侧倒序条目（`ui.ts:209`），并与地图/背包同面板三 tab（`ui.ts:203-234`）。
- **三级提示**：`hints(state)` 返回 3 条（见 §3.5）；按钮文案随级别变化：「A nudge, please → A clearer hint → Show the solution → Repeat the solution」（`ui.ts:208`），提示等级与内容按上下文键记忆（`main.ts:437-441`）。
- **触控文案适配**：`touchHint()` 把键盘提示里的「Press E / Press L」替换成「Tap Interact / tap Lamp」（`ui.ts:6-11`）——同一份提示文案双端复用，不是两套文案。

**适配建议（我们）**：日记条目 = 00-brief §4.5 的 `journal: {id,title,text}[]`，触发点建议 6 类：首次进入 zone、读到线索、获得提灯、点亮、解开转盘、进入密室；提示 = `hintsForStage(stage)` 3 条，`hintsUsed++`。**Agent 提示工具只能调用同一个 hints 函数**，防止 Agent 自造答案。UI 参考其「目标卡 + 提示按钮 + 倒序日志」的布局（我们中文文案，HTML overlay 实现）。

---

## 8. UI / 触控（`src/ui.ts`、`touch-controls.ts`、`touch-input.ts`）

### 8.1 纯 DOM overlay + 类封装（不依赖框架）

- `GameUI` 构造时一次性 `innerHTML` 出「canvas + loading + 标题页 + HUD + overlay + 导入 input + fatal-error」（`ui.ts:37-68`），之后只更新文本/class（`text()` 帮助函数，第 294 行）。**无 React**，但结构上就是「HUD 永远在 canvas 上方、弹窗用 overlay 互斥并设 `inert`」——与 R3F + HTML overlay 的布局模型一致。
- 弹窗统一 `open(panel, body, title)`（`ui.ts:125-132`）：设置 `aria-labelledby`、给 header 关闭按钮、打开时把 canvas/hud/title 设为 `inert`，`close()` 恢复。**可访问性**：overlay 内 Tab 焦点循环（第 83-91 行）、item 选择面板的焦点保留（第 176-201 行）。
- 交互结果三态渲染：普通文本 → toast（`ui.ts:253-261`）；`choices/prompt` → overlay 选择页（`ui.ts:141-151`）；`itemSelection` → 专用背包选择面板（`ui.ts:152-202`）。
- 暂停菜单包含：继续 / 日记地图 / 设置 / **导出 / 导入** / 存档并回标题（`ui.ts:135`）；设置含音量/灵敏度/FOV/画质/**难度**/镜头晃动（`ui.ts:139`）。
- 死亡页与结局页：死亡不显示惩罚数字，强调「你的发现与物品是安全的」+ 回安全点（`ui.ts:246-249`）；结局面板给统计（19 宝物、访问地点数、分钟数）与「继续探索/导出记录」（`ui.ts:250-252`）。

### 8.2 触控

- 自动检测：`prefersTouchControls() = matchMedia('(pointer: coarse)').matches || (maxTouchPoints>0 && matchMedia('(hover: none)').matches)`（`touch-controls.ts:13-15`）。
- 输入抽象：`TouchInput`（52 行）以 **pointerId 为键**管理多指角色（`move/look/guard/action`），桌面测试可直接单测（`mobile-controls.test.ts` 130 行 7 个测试：多指独立、第二根手指不能抢占、drag 增量而非起点等）。
- 触控 UI：左摇杆（推远=跑）+ 右侧滑动视角 + 动作按钮（interact/attack/guard/dodge/jump/lantern），`enabled` 时切换文案（`ui.ts:93-107` 的 `setTouchMode`）并隐藏鼠标提示。

**适配建议（我们）**：Demo 用 R3F `<Html>` 或 canvas 同级 DOM overlay 实现 HUD；**标题页/暂停/结局面板必须有**（00-brief §4.10 已列）。移动端只做「布局不崩 + 触控提示条可点」即可（00-brief 说明二期），但建议**提前把交互判定抽成纯函数**（不绑 mouse/keyboard 事件），二期接触控时只加输入适配层。可访问性抄三点：`inert` 模态、Tab 焦点循环、按钮 `aria-label`。

---

## 9. 世界与模型（`src/world.ts` / `src/models.ts`）

### 9.1 `Builder`：视觉 = 合批实例 + 碰撞盒 + 光源

- `Builder`（`world.ts:148-198`）构造时按 `room.id` 哈希出确定性随机种子（第 157-158 行），环境装饰随机但**可复现**。
- 几何不逐个建 Mesh，而是 `batch(geometry, material, position, scale, rotation)`（第 200-205 行）按「几何 uuid + 材质 uuid + 阴影」聚合矩阵；`finish()`（第 2487-2495 行）一次性生成 `InstancedMesh`。大量重复元素（石头/草/树叶/砖）→ **Draw call 数量级下降**。
- 碰撞不是物理引擎：`collision(x, z, w, d)` 只记录 AABB 数组（第 228 行），随 `finish()` 返回 `{group, colliders, animated, lights}`；移动时 `collidingPosition()` 用这些矩形推挤（main.ts:97-108、330-337）。`nearRoute()` 保证门口/出生点附近不生成挡路装饰（第 229-237 行）。
- `buildWorld(room)` 按 `room.kind` 分派（第 2505-2529 行），每个 kind 一个方法；`buildHouseExterior` 是特例（同一院子的 districts 共享一个外部世界）。
- `models.ts`：`makeProp(type)` 字符串分派（第 438 行起，覆盖 90+ 种类型）；`bake(root)` 把道具的多个 Mesh 按材质合并成少数几何（第 224-244 行），控制单物件 draw call；`makeCreature(kind)`（第 1582 行）程序化角色 + 动画回调。全部为 **Three.js 代码生成，无外部模型文件**。

**适配建议（我们）**：Demo 用程序化几何占位完全可行，且可复用这三条：① **确定性种子随机**（同一 zone 每次加载一致，便于截图/测试）；② **按材质合批**（书房的书架/书脊/石头用 InstancedMesh；12 个交互对象例外——它们要独立高亮，不能合批）；③ **AABB collider 数组**（比 R3F 物理引擎简单，12 个对象 + 3 个房间够用）。**替换路径**（写进文档）：`makeProp(type)` → `useGLTF('/assets/props/<type>.glb')` 的资产注册表，接口同名；Blender 导出的 `UCX_` 碰撞体在加载时转成 AABB 或 convex hull，接口与 `colliders` 对齐。

### 9.2 可迁移的性能纪律（不是结论，是纪律）

- 合批键含材质（同材质才 InstancedMesh），说明**材质数量直接影响 draw call**；灯是 `PointLight` 且随 flags 动态加（如 `world.ts:2424`），房间光源数量很少。
- 我方性能预算（00-brief §5 第 5 章要求）可借鉴：**每 zone 目标 draw call 数量级、三角形数量级、纹理 MB 上限**在实现时用 `renderer.info` 记录（Zork 的 QA 模式会显示 draws/fps/ms，见 `main.ts:632` 的 `#review-position` 调试输出——**自带性能观测面板**，值得抄）。

---

## 10. 测试策略（`tests/*.test.ts`：12 文件 77 个 test）

运行方式：`node --experimental-strip-types --test tests/*.test.ts`（package.json 第 12 行）；只用 `node:test` + `node:assert/strict`，**无测试框架依赖**。分类与代表断言：

| 文件 | 测试数 | 策略要点 |
|---|---:|---|
| `campaign.test.ts` | 16 | ①`go()` 用 BFS **只走真实出口**找到可行路线（`:15-46`），不允许直接改 `room` 制造进度；②`act()` 断言每次交互 `success`；③完整 19 宝物通关路线；④图完整性/双向边；⑤锁门失败不改变任何状态；⑥每 stage 三级提示有序；⑦坏存档拒绝（`:390`）；⑧难度缩放跨存档保持 |
| `interaction-target.test.ts` | 8 | 见 §4.2：转译生产 `selectTarget` 做集成测试；覆盖门口两侧/门槛内外、背对不提示、真实出口全量、锁门不透支、镜子两步开合 |
| `continuity-darkness.test.ts` | 11 | v1→v2 存档迁移只发生一次；户外 district 边界不闪烁；黑暗/光源/宽限时序 |
| `routes.test.ts` | 6 | 每条有向路线：到达点距入口 1–3.6m 且背对入口、在场景边界内、存档往返不变 |
| `inventory-use.test.ts` | 7 | 物品选择面板/错误不消耗/先去后取（`useItem` 语义） |
| `mobile-controls.test.ts` | 7 | pointerId 多指所有权、增量视角、guard 保持 |
| `combat.test.ts` / `compass.test.ts` / `prop-models.test.ts` / `coffin-pose.test.ts` / `dam-maintenance.test.ts` / `exterior-geography.test.ts` | 8/3/3/2/3/3 | 战斗数值、罗盘方位、道具包围盒（AABB 合理）、几何锚点、机关状态机、外部地理约束 |

**可复用的测试观**：
1. **状态机测试不 mock 世界**：`createGame()` + 真实 `ROOMS` 数据，直接跑逻辑；UI/渲染完全排除。
2. **「进度只能通过真实路径获得」**：BFS 走图 + 断言成功，避免测试自己造 flag 造成假阳性。
3. **负面断言同样重要**：失败不改变状态、背对门不提示、错档被拒、迁移不重复。
4. **几何/包围盒也测**（`prop-models.test.ts` 断言每个道具的 AABB 尺寸合理）——程序化几何没有视觉回归测试时的兜底。

**适配建议（我们）**：00-brief §4.11 要求「至少 7 步主线推进、错误条件不推进、暗门/结局条件、存档往返」——Zork 的模式 1/2/3 直接映射；建议再加两条：**「Agent 只读」测试**（工具调用后 state 不变）与 **「坏存档回 arrival」测试**。若时间允许，抄 `prop-models.test.ts` 的包围盒断言给我们的程序化几何占位。

---

## 11. 可直接复用的 10 条设计决策（一页速查）

| # | Zork 的做法 | 证据 | 我们的落点 |
|---|---|---|---|
| 1 | 房间/出口/对象/物品全部纯数据，逻辑只读数据 | `campaign.ts` 全文、`types.ts` | `scene.json` + `knowledge.json` 数据驱动；代码不硬编码 zone 内容 |
| 2 | 条件用 flag 名表达，不写函数 | `ExitDef.requires`、`ObjectDef.hiddenIf` | 00-brief §4.5 的 `flags` 表；构建期校验 flag 白名单 |
| 3 | 出口携带 `arrival`（落点+朝向），到达后背对来路 | `types.ts:14`、`campaign.ts:362-374` | 进 zone 时镜头朝前、暗门/楼梯在身后 |
| 4 | 门口评分 = 门槛模式（孔径/纵深/朝向）+ 锥形兜底 | `interaction-target.ts:6-20` | `selectInteractable()` 纯函数；E 键目标高亮 |
| 5 | 检查与使用分离，错误不消耗物品、可重试 | `game.ts:66-79`、`ui.ts:152-202` | 书架/转盘：先观察后选择；错序不惩罚 |
| 6 | 黑暗 = 房间布尔 + 光源纯函数 + 1.3s 警示 + 宽限 | `darkness.ts`、`main.ts:348-356` | 地下室无灯近黑、1.5s 警示、目标栏提示 |
| 7 | 日记幂等自动记录，提示按上下文给三级 | `game.ts:46-48,553-707` | 6 类触发点 + `hintsForStage` 三级 |
| 8 | 存档 version + 白名单 + clamp + 派生状态重算 | `game.ts:719-771` | `lux3d.save.v1` 同一套校验；导出/导入；服务端复校验 |
| 9 | 每 8s 自动保存 + 关键动作保存 + 暂停/导出前保存 | `main.ts:143,615,89` | Zustand subscribe 节流 5–8s + 交互后保存 |
| 10 | 纯 DOM overlay + 模态 `inert` + 焦点循环；测试只测逻辑 | `ui.ts:37-91,125-132`；`tests/*` | HTML overlay HUD；Node 原生 test 测纯函数 |

## 12. 不适用 / 风险提示（不要照抄的部分）

1. **战斗系统**（`combat.ts`、`enemy` 定义、`retryFromCheckpoint` 战斗重置）：我们 Demo 无战斗，不要引入；但「死亡不丢进度、回安全点」的**心理设计**可以借给「黑暗/失败提示」。
2. **30 区域 / 19 宝物 / 迷宫 / 石冢结局**：内容规模是我们的 10 倍以上；我们只做 3 zone 12 对象的垂直切片，数据量小到可以手写 JSON，不必上 Zork 的工厂 + 后置元数据回填那套（但可保留 `via` 一致性校验）。
3. **`interact()` 原地修改 state**：在 React/R3F 下不建议；我们要 `applyAction` 返回新状态 + effects。
4. **依赖 `typescript` 源码转译做测试**：技巧很好但耦合源码结构，我们不需要。
5. **性能数字未验证**：本文未实测其帧率/包体；00-brief 中的「约 30 区域、19 宝物、Three.js 0.180」来自 README/package.json 一手证据，**不要引申为「性能如何」**。
6. **资产许可**：Zork 改编代码 MIT，但 Zork 原作散文来自 Microsoft 2025 开源的 Zork I（MIT 声明在 `licenses/ZORK-MIT.txt`）；我们**不要复制其文案**，只参考结构（我们的《提灯与暗门》是原创设定）。

## 13. 证据索引（便于复核）

| 主题 | 文件 | 行号 |
|---|---|---|
| 类型定义 | `src/types.ts` | 4–47 |
| 物品表 / 工厂 | `src/campaign.ts` | 10–101 |
| 30 房间数据 | `src/campaign.ts` | 103–286 |
| 出口建图 / 元数据回填 | `src/campaign.ts` | 295–399 |
| 状态初始化 / 可见性 / 日记 | `src/game.ts` | 13–48 |
| 物品选择两段式 | `src/game.ts` | 66–79 |
| 交互分派 | `src/game.ts` | 300–473 |
| 旅行 | `src/game.ts` | 475–489 |
| 目标 / 提示 / 上下文键 | `src/game.ts` | 505–709 |
| 存档序列化与校验 | `src/game.ts` | 711–771 |
| 门口评分 | `src/interaction-target.ts` | 6–20 |
| 光源 / Grue | `src/darkness.ts` | 9–25 |
| 目标选择 / 黑暗计时 / 存档定时 / 导入导出 | `src/main.ts` | 62–67, 145–196, 348–356, 437–441, 450–478, 615 |
| UI 面板与可访问性 | `src/ui.ts` | 37–68, 125–132, 141–202, 203–242, 246–252 |
| 世界合批 / 碰撞 / 分派 | `src/world.ts` | 148–237, 2487–2529 |
| 道具工厂 / bake / 角色 | `src/models.ts` | 224–244, 438–, 1582– |
| 触控检测与输入 | `src/touch-controls.ts` | 13–15, 33– |
| 测试入口 | `package.json` | 8–13 |
| 集成测试技巧 | `tests/interaction-target.test.ts` | 14–30 |
