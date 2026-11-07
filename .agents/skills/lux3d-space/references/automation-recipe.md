# 自动化截图/驱动游戏技法（无指针锁环境，T-005 验证）

> 适用：Agent 自动化验收截图、headless 环境、无法真实点击锁定鼠标的场景。
> 前提：dev server 5180 已启动（`node $PNPM dev -- --port 5180`）。

## 0. 两条路线

| 路线 | 用途 | 依赖 |
|---|---|---|
| `node --experimental-strip-types scripts/screenshot.mjs` | 4 张标准 UI 图（标题/书房 HUD/日记面板/结局面板）输出到 `assets/screenshots/` | 本机 Edge/Chrome + CDP |
| **种子存档技法**（下文） | 任意机位的干净场景图（书房/地下室/密室随意） | 内置浏览器 evaluate 或 CDP |

## 1. 种子存档技法（确定性，已验证）

原理：游戏从 `localStorage['lux3d.save.v1']` 读存档，载入后相机直接放到存档的 `position/yaw`，无需指针锁定与走动。

```js
// ① reload 到标题页（关键：必须先 reload，见坑 A）
await tab.reload(); await waitForLoadState(); await sleep(4500);
// ② 注入种子存档（动态 import 会被 evaluate 转译，必须用 module script + window 回调）
await evaluate(`new Promise((resolve) => {
  window.__r = resolve;
  const s = document.createElement('script');
  s.type = 'module';
  s.textContent = "import('/src/game/save.ts').then(({ createInitialState }) => { " +
    "const st = structuredClone(createInitialState()); " +
    "st.stage='illuminate'; st.zone='zone_basement'; st.lanternLit=true; " +
    "Object.assign(st.flags, {clue_diary:true,has_lantern:true,cellar_open:true," +
    "saw_secret_outline:true,clue_symbols:true,clue_basin:true}); " +
    "st.inventory=['lantern']; st.position=[3.4,1.65,3.0]; st.yaw=0.85; " +
    "st.visited=['zone_study','zone_basement']; " +
    "localStorage.setItem('lux3d.save.v1', JSON.stringify(st)); resolve('ok'); })" +
    ".catch((e) => window.__r('err:'+e.message));";
  document.head.appendChild(s);
})`)
// ③ 点击「继续（读取本地存档）」——必须 JS click，见坑 B
await evaluate(`document.querySelectorAll('.title-actions button')[1].click()`)
await sleep(3500);
// ④ 游戏会在未锁指针时自动弹暂停面板——直接置空 store 的 panel（不碰任何游戏字段）
await evaluate(`(async () => { const { useGameStore } =
  await import('/src/game/store.ts'); useGameStore.setState({ panel: 'none' }); })()`)
// ⑤ 截图
```

常用机位存档参数（与 T-005 截图一致）：

| zone | stage | flags 追加 | position | yaw | 备注 |
|---|---|---|---|---|---|
| zone_study 近景 | arrival | — | `[0.3,1.65,-1.2]` | 0 | 书桌 1.4m 正面 |
| zone_basement | illuminate | 六项基础 flags + `lanternLit` | `[3.4,1.65,3.0]` | 0.85 | 看向北墙浮雕/暗门/转盘 |
| zone_chamber | chamber | 基础 + `dials_solved,secret_open` | `[0,1.65,0.4]` | 0 | 石台正前方 2m |

## 2. 已踩坑（全部真实发生过）

- **坑 A：种子被旧局自动存档覆盖**。游戏运行中每 12s/操作后自动写 localStorage；先注入后 reload 会被旧局回写冲掉。**必须先 reload 到标题页（无游戏运行）再注入，再点继续。**
- **坑 B：CUA 坐标点击与 Playwright locator 点击对 HTML 按钮都可能超时/无效**；标题按钮用 JS `btn.click()`（DSH screenshot.mjs 同款）100% 可靠。真实指针点击只对 canvas（锁指针）可靠。
- **坑 C：evaluate 里的动态 `import()` 会被转译报 `importModule is not defined`**；一律用 `document.createElement('script') type='module'` + `window.__resolve` 回调传结果。
- **坑 D：暂停面板自动弹出**（started 且未锁指针）。Esc 有时无效；`useGameStore.setState({ panel: 'none' })` 确定有效，且只动 UI 状态不碰游戏字段。
- **坑 E：截图偶发 30s 超时**。等 2–4s 重试一次即可，不要连续重试。
- **坑 F：走动类验证**（真实 WASD）需真实指针锁定（`state.locked`），锁定后可用合成 KeyboardEvent 驱动 `window` keydown/keyup；每次指针解锁都会触发暂停面板。

## 3. 验收口径

- 三 zone 各 1 张：书房（GLB 书架/书桌比例）、地下室（浮雕/暗门朝向）、密室（石台）。
- 截图存 `assets/screenshots/` 或贴进交接单；证据必须来自真实运行画面，不编造。
