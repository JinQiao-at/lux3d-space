# 02 · Zork 探索感设计模式清单（→《提灯与暗门》落点）

> 用途：为 `docs/01-总体设计与实施方案.md` 第 2 章（ECO × ZORK 融合）、第 7 章（Demo 设计）、第 9 章（交互与信息导航）提供**可引用的模式库**。
> 证据优先级：① 一手源码（[GitHub 仓库](https://github.com/emollick/zork-underground-empire)，分支 `codex/public-release`，2026-11-03 抓取）；② Zork 官网/README 一手文本（<https://zork-underground-empire.netlify.app/>，2026-11-03 抓取 HTML 与 `README.md`）；③ 微信技术拆解文《GPT-6 Astra 把经典文字冒险游戏 Zork 改成可以漫游的 3D 动作冒险游戏》（<https://mp.weixin.qq.com/s/lPK9t2SSz9hn5oA6v71M3w>，2026-11-03 抓取正文 34 行）。
> 行号引用均指上述快照；每条给「机制 → Demo 落点（stage/object/UI）→ 取舍」。

---

## 0. 来源清单（写文档时可直接引用）

| 编号 | 来源 | 类型 | 可复核位置 |
|---|---|---|---|
| S1 | Zork 在线版 | 官网 | <https://zork-underground-empire.netlify.app/>（HTML 标题/描述/操作说明） |
| S2 | 仓库 README | 一手文档 | `README.md`：Controls / Playing and saving / 30 areas、19 treasures、three difficulty、touch |
| S3 | 仓库源码 | 一手代码 | `src/*.ts`（本目录 `01-zork-reference.md` 有逐模块行号索引） |
| S4 | 微信文章 | 二手拆解 | 标题与链接见上；正文第 4–13 行（AI 开发方式）、14–18 行（玩法/区域/宝物）、19–33 行（系统清单） |
| S5 | 00-brief | 项目内 | `research/00-brief.md` §3（已核实事实）、§4（Demo 规格） |

> 注意：S4 是二手报道，凡与 S2/S3 冲突以代码/README 为准；本文所有机制描述均已用 S3 行号交叉验证（除标注「S4 报道」的条目）。

---

## 1. 模式总览（17 条 + 组合建议）

| # | 模式 | 主要来源 | Demo 优先级 |
|---|---|---|---|
| P1 | 逐房间文案与空间标题（进入即叙事） | S2/S3 `campaign.ts`、`ui.ts` | **必做** |
| P2 | 第一人称自由漫游 + 鼠标自由视角 | S2、S3 `main.ts` | **必做** |
| P3 | 情境交互（E 键）替代文字解析器 | S2、S3 `interaction-target.ts`/`main.ts` | **必做** |
| P4 | 光照即权限：黑暗遮蔽 + Grue 威胁 | S3 `darkness.ts`、S2 | **必做**（去死亡，留遮蔽） |
| P5 | 条件出口：物品/flag 门槛 + 被挡时的解释 | S3 `ExitDef`/`game.ts` | **必做** |
| P6 | 物品使用两段式：观察→选择→错误不惩罚 | S2/S3 `game.ts:66-79` | **必做**（转盘/书架） |
| P7 | 自动日记：发现即记录、幂等不重复 | S2/S3 `game.ts:46-48` | **必做** |
| P8 | 三级提示：暗示→机制→解法，换上下文重置 | S2/S3 `game.ts:553-707` | **必做** |
| P9 | 目标栏随状态更新（objective 纯函数） | S3 `game.ts:505-551` | **必做** |
| P10 | 地图/指南针/已访问可见性 + 安全点快速返回 | S2/S3 `ui.ts`、`game.ts` rest | 二期（本期简化） |
| P11 | 自动存档 + 导出/导入 + 坏档兜底 | S2/S3 `main.ts`/`game.ts:719-771` | **必做** |
| P12 | 三档难度（含黑暗宽限） | S2/S3 `darkness.ts:20-25`、`ui.ts:139` | 可选（只留设置项） |
| P13 | 死亡/失败不丢进度，回安全点 | S2/S3 `game.ts:23-35`、`ui.ts:246-249` | 轻量落地 |
| P14 | 触控自动适配（多指、文案替换） | S2/S3 `touch-controls.ts`、`ui.ts:93-107` | 二期 |
| P15 | 仪式感 UI（标题/加载/暂停/结局统计/合成音效） | S1/S3 `ui.ts`、`audio.ts` | **必做**（可精简） |
| P16 | 优质叙事底座优先，AI 负责实现 | S4 第 4–13 行 | 方法论（写进文档） |
| P17 | 可测试性 = 可玩性的保障 | S3 `tests/*`（77 test） | **必做**（验收相关） |

---

## 2. 逐条详解

### P1 逐房间文案与空间标题（进入即叙事）

- **机制**：每个房间有 `name / subtitle / description` 三段文案（`campaign.ts:99-101` 的 `room()` 工厂）。进入房间时：房间名卡淡入（`ui.ts:262-266` 的 `location()`，副标题 + 名称 + 装饰线，约 4.1 秒后消失）+ 底部 toast 打房间描述（`main.ts:128-131`）；HUD 左上常驻「区域名 + 房间名」。
- **来源**：S3 `campaign.ts`/`ui.ts`/`main.ts`；S2 README「Original Zork descriptions accompany the adventure」。
- **Demo 落点**：`zone_study`→「夜雨书房 / THE STUDY OF RAIN」、`zone_basement`→「地下室盥洗室 / BENEATH THE HOUSE」、`zone_chamber`→「密室 / THE HIDDEN CHAMBER」；进入 zone 触发 `enterZone` effect：卡面 + 底部叙事日志（Zork 式第二人称「你醒来时，壁炉只剩暗红的灰」）。目标栏与叙事日志用 00-brief §4.10 的 HUD。
- **取舍**：我们三个 zone 文案量小，**逐 zone 手写、不程序生成**；标题卡保留，是「探索感」里性价比最高的一环。

### P2 第一人称自由漫游 + 鼠标自由视角

- **机制**：WASD 移动、鼠标自由视角（不需要按住按钮）、方向键也可转向、Shift 跑、Space 跳；指针捕获失败时自动退化为「鼠标靠近屏幕边缘继续转」（`main.ts:68-85` 的 `lock()/canLook()`；README Controls 表）。
- **来源**：S2 README；S3 `main.ts`。
- **Demo 落点**：00-brief §4.10 的 WASD + 鼠标视角 + Shift 跑；建议**不做跳/跑/战斗**，保留 Shift 小跑（可选）。移动约束用 AABB collider（参考 `world.ts:228` 的 `collision()` 思路）。
- **取舍**：指针锁定在部分浏览器/iframe 会失败，需准备「按住拖拽转视角」兜底（比 Zork 的边缘转向更简单、更稳）。

### P3 情境交互（E 键）替代文字解析器

- **机制**：不解析玩家输入的文字，而是**就近 + 朝向评分**选中唯一目标，HUD 显示「E · 对象名 · 动作名」（对象/出口在同一分数空间竞争，`main.ts:155-196`）；出口用「孔径 + 纵深 + 朝向」门槛评分（`interaction-target.ts:6-20`），背对门口不提示。
- **来源**：S2 README「contextual interactions … in place of the original parser」；S3 两个文件。
- **Demo 落点**：`selectInteractable()` 纯函数（不依赖 three），E 键触发；交互提示条（00-brief §4.10 HUD「交互提示（E）」）。12 个对象 + 暗门/地板门足够用评分法，不必 raycast。**关键体验**：背对暗门不提示、太远不提示、黑暗时不提示——「找得到才提示」本身就是探索感。
- **取舍**：评分参数按我们房间尺寸（约 8×6m）缩放；不做「多目标轮换」，只显示最高分一个（Zork 也是单选，`main.ts:158-178` 取最小分）。

### P4 光照即权限：黑暗遮蔽 + Grue 威胁

- **机制**：黑暗房间 + 无光源 → 1.3 秒后弹出经典警告「It is pitch black. You are likely to be eaten by a grue.」并写入日记，随后按难度宽限/间隔扣血（`main.ts:348-356`、`darkness.ts:20-25`）；HUD 目标变成黑暗提示（`game.ts:506`）；渲染层用 `darkTime/7` 做渐暗遮罩（`main.ts:623`）。
- **来源**：S3 `darkness.ts`、`main.ts`；S2 README「Lantern … Dark areas … need light」。
- **Demo 落点**：00-brief §4.2/§4.4 的 `descend`/`illuminate` 两 stage：地下室 `lanternLit=false` 时近黑、只保留「返回书房 / 点亮提灯」提示；提灯照亮后：淋浴玻璃门轮廓显形 → `saw_secret_outline`、浮雕符号可读 → `clue_symbols`。用灯光/材质切换表现，不需要 Grue 死亡。
- **取舍**：去掉死亡惩罚（我们无战斗、无回血系统），只保留「信息遮蔽 + 轻微紧张（提示延迟 1.5s 出现）」；`hasLight()` 纯函数被目标/提示/渲染三处复用。

### P5 条件出口：物品/flag 门槛 + 被挡时的解释

- **机制**：出口数据带 `requires`（flag）与 `blocked`（拒绝文案）；条件不满足时 `travel()` 返回失败且**不改任何状态**（`game.ts:475-489`）；部分出口由 `via` 对象承载（窗/镜要两段式：先打开再穿过，`main.ts:167-168`、`campaign.ts:361-374`）。
- **来源**：S3 `types.ts:4-15`、`campaign.ts:295-353`、`game.ts:475-489`。
- **Demo 落点**：`obj_study_floor_door`（`cellar_open` + `lantern_lit` + `clue_diary`）、`obj_basement_secret_door`（`dials_solved`）、`zone_chamber` 进入条件（`secret_open`）。被挡时给 Zork 式文案（「地板严丝合缝，似乎需要先找到什么」），而不是静默。
- **取舍**：我们的门槛只有 flag，不需要 Zork 的「物品在手才能过」完整规则；但「条件 + 拒绝文案」必须数据化，方便验收与测试。

### P6 物品使用两段式：观察→选择→错误不惩罚

- **机制**：交互先返回「观察」文案 + 背包选择列表（`itemSelection`），玩家选错只得到失败反馈（`feedback`），**物品不消耗、可离开再来**（`game.ts:66-79`；`ui.ts:152-202` 为「重试保留焦点/滚动」做了专门处理）；README 明确「Unsuitable choices leave your possessions intact; Step away lets you return later」。
- **来源**：S2 README；S3 `game.ts`/`ui.ts`。
- **Demo 落点**：00-brief §4.6 转盘（错序 → 震动 + 文案「石盘发出干涩的摩擦声」，不惩罚、可重试）；书架暗格（有提灯线索后才可搜查）；淋浴门（需 `lanternLit`）。UI 上给「稍后再来/离开」按钮。
- **取舍**：我们的「物品」只有提灯，两段式主要用于**线索条件**与**转盘顺序**；保留「错误不惩罚」这一条即可获得同等心理体验。

### P7 自动日记：发现即记录、幂等不重复

- **机制**：`note(state,id,title,text)` 同 id 只写一次（`game.ts:46-48`）；首次进房、读线索、解谜、黑暗警告、休整都会写（全文 30+ 处）；日记面板倒序展示（`ui.ts:209`），走回头路不会重复记录（测试断言 journal 长度不变）。
- **来源**：S2 README「The journal records discoveries」；S3 `game.ts`/`ui.ts`。
- **Demo 落点**：00-brief §4.10 日记按钮（J）；6 类触发点：进入 zone、读到日记半页（`clue_diary`）、拿到提灯、点亮提灯、解开转盘（`dials_solved`）、进入密室。日记面板同时展示「当前目标 + 提示按钮」。
- **取舍**：我们只有 1 条主线，日记条目 10 条以内，**文案手写、含线索复读**（防止玩家忘了 3-1-2）；这正是「探索感」而非「任务清单感」的关键。

### P8 三级提示：暗示→机制→解法，换上下文重置

- **机制**：`hints(state)` 按上下文返回恰好 3 条（`game.ts:553-707`）；UI 按钮文案随已用级别变化（`ui.ts:208` 的「A nudge, please / A clearer hint / Show the solution / Repeat the solution」）；上下文键 = `room + 当前提示内容`（`game.ts:709`），换房间或进度推进后**从第 1 级重新开始**（`main.ts:437-441` 的 `hintProgress` map）。
- **来源**：S2 README「three optional hint levels, from a nudge to an explicit solution」；S3。
- **Demo 落点**：00-brief §4.9 的 `request_hint(level)` 工具 + §4.10 日记/提示 UI；`hintsForStage(stage)` 三级文案（例：`solve_dials` — ①「浮雕上的三个符号，与洗手台的刻字有关」②「刻字说：先三后一，最后二」③「按 3→1→2 的顺序拨动三个转盘」）。`hintsUsed` 计入结局统计。
- **取舍**：Zork 的提示函数 150 行按房间分支；我们按 **stage** 分支（7 个 stage × 3 条），更短且与验收对应。**Agent 的 `request_hint` 只能调用同一函数**（防编造）。

### P9 目标栏随状态更新（objective 纯函数）

- **机制**：`objective(state)` 按「黑暗 > 完成 > 收集度 > 当前房间 + flags」优先级返回 `{title,text}`（`game.ts:505-551`），HUD 常驻显示（`ui.ts:267`）；同一条信息也进日记左栏。
- **来源**：S3 `game.ts`/`ui.ts`。
- **Demo 落点**：00-brief §4.4 七步主线：`arrival`→「找到光源」…`chamber`→「调查石台」；目标文案与 stage 一一对应，**由 stage 纯函数派生**，不手写 state 字段（避免不一致）。
- **取舍**：我们的目标文案可以完全由 stage 映射，不需要 Zork 那么长的分支；但保留「黑暗/完成」的优先覆盖（黑暗中目标栏显示「伸手不见五指」比显示任务更沉浸）。

### P10 地图/指南针/已访问可见性 + 安全点快速返回

- **机制**：SVG 地图只画出「已访问房间 + 其一步邻居」，未访问显示「Unexplored route」；指南针 HUD 显示 8 向（`ui.ts:282-285`，`compass.ts`）；地图底部列「安全点」按钮，已休整过的壁炉/营地可一键返回（`ui.ts:228-229`，`main.ts:442-445`）。
- **来源**：S2 README「map (M) … return to unlocked safe points」；S3 `ui.ts`/`compass.ts`/`main.ts`。
- **Demo 落点**：本期可不做完整地图，但**检索面板（Tab）结果点击 → 镜头定位**本身就是「信息地图」；二期可加 zone 小地图 + 已访问 object 列表（数据来自 `knowledge.json` 的 zoneId/objectId）。
- **取舍**：3 个 zone 用不着 2D 地图；但「已访问/未发现」的可见性规则值得保留在检索面板：只显示已发现的知识条目，未发现的显示「档案中暂无记录」（也符合 Agent 不编造的要求）。

### P11 自动存档 + 导出/导入 + 坏档兜底

- **机制**：每 8 秒自动保存 + 关键动作后保存 + 暂停/导出前保存（`main.ts:615,143,89`）；版本号 + 白名单校验 + 数值 clamp + 派生状态重算（`game.ts:719-771`）；导出为 JSON 文件、导入限 1MB 且失败给明确错误（`main.ts:450-478`）；坏档回初始状态（`main.ts:26-29`）。
- **来源**：S2 README「Progress saves in your browser … Export/Import … to move a save between browsers」；S3。
- **Demo 落点**：00-brief §4.5 `localStorage['lux3d.save.v1']` + 暂停菜单导出/导入 + 坏档回 `arrival`；验收项 §4.11.2「存档序列化往返」。**建议**：再加「版本迁移函数骨架」（v1→v2 时才知道怎么改）。
- **取舍**：我们不需要多存档槽；但保留「version + 校验 + clamp + 派生重算」四件套，未来接 FastAPI 同步时服务端复用同一校验。

### P12 三档难度（含黑暗宽限）

- **机制**：Explorer / Adventurer / Veteran 三档（`ui.ts:139` 设置项）；影响战斗数值与 Grue 宽限/伤害/间隔（`darkness.ts:20-25`：16s/20/3.2s vs 10s/40/2.8s）；设置页可随时改。
- **来源**：S2 README「Choose Explorer, Adventurer, or Veteran in Settings」；S3。
- **Demo 落点**：00-brief §2.2/§4.10 设置里有「灵敏度/音量/画质」；三档难度本期可只保留 **设置项占位 + 黑暗提示延迟/伤害（无伤害则只影响提示延迟）**，或二期做「探索/标准」两档。
- **取舍**：无战斗时难度差异很弱，**不要为凑数硬做**；留设置项与文档说明即可（对齐 00-brief「扩展点」）。

### P13 死亡/失败不丢进度，回安全点

- **机制**：死亡页文案强调「Your discoveries and belongings are safe.」+「Return to <安全点>」（`ui.ts:246-249`）；`retryFromCheckpoint()` 重置生命/体力、把未击败敌人血量重置、**保留 flags/日记/已得物品**（`game.ts:23-35`）；休息点即检查点（`game.ts:323-329`）。
- **来源**：S3；S2 README「Rest at a hearth or safe camp to recover and unlock return travel」。
- **Demo 落点**：我们无死亡，但可以有「失败提示不惩罚」：转盘错序、黑暗太久、检索无结果，都用「你退后一步，没有损失」的语气；存档检查点 = 每次 stage 推进自动保存（等价于安全点）。
- **取舍**：去掉死亡页；保留**「失败无损失」的心理安全网**，这是 Zork 式探索敢乱点的前提。

### P14 触控自动适配（多指、文案替换）

- **机制**：`prefersTouchControls()` 用 `(pointer: coarse)` / `(hover: none)` 自动判定（`touch-controls.ts:13-15`）；左摇杆 + 右侧滑动视角 + 动作按钮；`TouchInput` 以 pointerId 管理多指所有权（`mobile-controls.test.ts` 7 个测试）；UI 文案自动把「Press E」替换为「Tap Interact」（`ui.ts:6-11` 的 `touchHint()`）。
- **来源**：S2 README「On a phone or tablet, touch controls appear automatically」；S3。
- **Demo 落点**：00-brief §4.10「移动端可暂不支持，但布局不得崩」——本期只做响应式布局 + 提示条可点击（触屏点 E 提示条 = 交互）；二期再接虚拟摇杆。
- **取舍**：不做多指/战斗按钮；但**交互提示条本身做成可点击按钮**（Zork 的 `#interact-prompt` 就是 button，`ui.ts:56`），手机用户就能玩，成本极低。

### P15 仪式感 UI（标题/加载/暂停/结局统计/合成音效）

- **机制**：标题页有 logo、副标题、Continue/Begin、Settings、About（`ui.ts:42-48`）；加载条（`ui.ts:41`）；进入房间的标题卡（P1）；结局页给「19 宝物 / 访问地点 / 分钟数」统计 + 继续探索/导出记录（`ui.ts:250-252`）；音效全部 WebAudio 合成、无网络文件（`audio.ts`，S2「sound created for this game」）。
- **来源**：S1（标题/描述文案）、S3；S2。
- **Demo 落点**：00-brief §4.10 首屏「标题 + 开始探索/继续 + 操作说明」、结局面板（用时/提示次数）、暂停菜单；音效用 WebAudio 合成（石门/提灯/转盘/点击），无网络资产。
- **取舍**：我们的仪式感可更「叙事」：开始前一小段雨声/壁炉声（合成噪声），结局用一段文字 + 统计；不追求 Zork 的插画级包装（无网络资产约束）。

### P16 优质叙事底座优先，AI 负责实现（方法论）

- **机制（S4 报道）**：Mollick 让 GPT-6 Astra 把 Zork I 改成 3D 游戏，**保留原版剧情/谜题/文案**（来自 Microsoft 2025 开源的 Zork I 源码），AI 负责 3D 实现、系统扩展与战斗；人类只给初始指令 + 少量 nudge + 测试微调。文章结论：有优质现成内容底座时，AI 能走得更远；反之 AI 不擅长从零写好长线叙事。
- **来源**：S4 第 4–13 行（引用 Mollick 原话）、第 9–11 行（成功原因）、第 31–33 行（总结）。
- **Demo 落点**：我们的「内容底座」= 00-brief §4（三 zone/12 对象/7 步主线/谜题条件表/知识条目 8 条）+ ECO 知识组织；「生成实现」= Lux3D/Blender/程序化几何/代码。**设计文档必须写明两者分层，不要一次生成整世界**（00-brief §3.2 已列为必写）。
- **取舍**：我们不是改编 Zork，而是原创《提灯与暗门》；因此「底座」必须自己先写扎实（剧本/线索/条件表），再让工具链生成资产——顺序不能反。

### P17 可测试性 = 可玩性的保障

- **机制**：77 个测试覆盖战役/谜题/存档/路线/黑暗/触控/模型（12 个文件，`node --experimental-strip-types --test`）；关键测试用「真实出口 BFS 走图」证明可通关、用「生产 selectTarget 转译」证明交互可用、用「坏档断言」证明存档安全。
- **来源**：S3 `tests/*`；S2 README「npm test # Campaign, puzzle, save, route, combat and touch-input checks」；S4 第 11 行（「有测试覆盖……而不是半成品」）。
- **Demo 落点**：00-brief §4.11.2 的验收测试（7 步主线、错误条件不推进、暗门/结局、存档往返）+ 建议加「Agent 只读」「坏存档回 arrival」。
- **取舍**：我们的测试只测纯函数状态机（不测 UI/渲染），与 00-brief §2.3 一致；不引入 Vitest/Jest。

---

## 3. 落到《提灯与暗门》的「模式 × stage」矩阵（给 doc-writer / demo-engineer 直接抄）

| stage | 用到的模式 | 具体表现 |
|---|---|---|
| `arrival` | P1、P2、P9、P15 | 雨夜书房标题卡 + 叙事日志；目标「找到光源」；首屏/操作说明 |
| `find_light` | P6、P7 | 书桌日记半页 → 书架暗格调查（观察→选择→错误不惩罚）→ 提灯入手，日记记录 |
| `light_it` | P4、P7、P9 | L 键点亮提灯；壁炉旁地板暗门显形；目标更新 |
| `descend` | P5、P4、P11 | 地板暗门（条件出口 + 拒绝文案）；进入地下室时无灯 → 近黑 + 返回提示；自动存档 |
| `illuminate` | P3、P4、P6、P7 | 提灯照亮淋浴玻璃门 → `saw_secret_outline`；石壁浮雕 → `clue_symbols`；交互评分只提示「看得见」的对象 |
| `solve_dials` | P6、P8、P13 | 转盘 3-1-2（错序不惩罚 + Zork 式文案）；三级提示；无损失失败 |
| `chamber` | P1、P9、P15 | 密室标题卡 + 冷光；石台结局面板（用时/提示次数） |
| 全程 | P11、P12、P14、P17 | 存档导出/导入；设置；触控提示条可点；状态机单测 |

## 4. 取舍结论（写进设计文档的「不做/二期」）

1. **不做**：战斗、死亡惩罚、30 区域规模、多存档槽、完整 2D 地图、程序化角色（P4 只留遮蔽）。
2. **本期简化**：P10 地图/安全点快速返回 → 用「检索→镜头定位 + 导览」替代；P12 难度 → 只留设置项；P14 触控 → 只保证布局 + 提示条可点。
3. **必须保留的体验内核**：**「看得见才提示、做过才记录、错了不惩罚、随时能重来」**——这 4 句是 Zork 探索感在我们 Demo 中的最小可行集，也是验收测试能直接断言的 4 条。
