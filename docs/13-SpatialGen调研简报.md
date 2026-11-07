# 13 · SpatialGen / 3DGS 已知坑与推荐参数（调研简报）

> 目的：定位并修复记忆回廊 3DGS 实验模式黑屏（T-010），沉淀 Aholo 3DGS 生态的官方事实。
> 方法：**agent-reach 体检**（gh CLI ✓ / yt-dlp ✓）→ GitHub 四仓调研 + 官方 aholojs.dev/llm 文档直读。
> YouTube 字幕因本机出口受阻未完成（如实标注）；官方 LLM 文档为更权威替代源。
> 归属：T-022（ZCode）。最后更新：2026-11-07

## 0. 结论先行：3DGS 黑屏根因（官方证据）

**Aholo/SpatialGen 的 splat 产物使用 OpenCV 坐标系（-Y up）**。官方 Getting Started 原文注释：

```ts
// The splat uses -Y up in OpenCV coordinates.
camera.up.set(0, -1, 0);
camera.position.set(-1.5, -0.5, 0);
camera.lookAt(new Vector3(0, 0, 0));
```

来源：<https://aholojs.dev/llm/manual/getting-started.md>（官方最小示例，SOG 格式）

我们 T-010 实验模式用 three.js 默认相机（up=+Y）看 -Y-up 的场景 → **场景在相机视野外/上下翻转 → 黑屏**。与「PLY 下载解码正常但画面黑」的现象完全吻合。

### 修复选项（按推荐排序）

| 方案 | 做法 | 成本 |
|---|---|---|
| **A（最小修复）** | mkkellogg viewer 保留：加载后对 splat 场景 `rotation.x = Math.PI`（或设 `camera.up.set(0,-1,0)` + 相机位置照官方值），一次翻转即对齐 | ~10 行改动 |
| **B（官方路线）** | 换 `@manycore/aholo-viewer`（板上 T-010 原备注）：官方 viewer 原生理解该坐标系 + 原生 SPZ/SOG 支持 + Chunked LOD 流式 | 重写 MemoryPanel 实验层（官方 skill 已给完整模板） |

## 1. 生态地图（GitHub 实查 2026-11-07）

| 仓库 | 角色 | 状态 |
|---|---|---|
| [manycore-research/SpatialGen](https://github.com/manycore-research/SpatialGen) | **模型本体**：Layout-guided 3D 室内场景生成（多视图多模态扩散），3DV 2026（arXiv 2509.14981），HF: SpatialGen-1.0 | MIT；最后 push 2026-04 |
| [manycoretech/aholo-spatial-sdk](https://github.com/manycoretech/aholo-spatial-sdk) | API/MCP SDK（我们 pipeline/mcp 用的 1.9.0 即其 typescript/mcp） | MIT；近 30 天 issues 仅 1 条（v1.8.0 release note）——issue 区不活跃，排错靠文档 |
| [manycoretech/aholo-viewer](https://github.com/manycoretech/aholo-viewer) | **官方渲染器**（npm @manycore/aholo-viewer@1.12.0，12MB unpacked）：3DGS+Mesh，Chunked Streaming LOD | 活跃（2026-11-06 仍在更新）；含 **docs/ai/skills/use-aholo-viewer/SKILL.md**（官方给 AI 的集成指南） |
| [manycoretech/splat-transform-test-suite](https://github.com/manycoretech/splat-transform-test-suite) | @manycore/aholo-splat-transform 转换链测试：`lod:auto --ratio 0.3` PLY/SOG→SPZ、`lod:auto-chunk` 出 ESZ 分块 LOD | 即 18.4MB PLY 的官方瘦身路径 |

## 2. 已知坑清单（全部带来源）

| # | 坑 | 证据/来源 |
|---|---|---|
| 1 | **splat 坐标系 = OpenCV -Y up**，three 默认相机直看必黑屏 | getting-started 原文注释（§0 引用） |
| 2 | 官方示例相机参数不是原点：`position(-1.5,-0.5,0) + up(0,-1,0) + lookAt(0,0,0)`——**生成场景的视觉中心不在原点**，我们「相机放原点」假设错误 | 同上 |
| 3 | **@mkkellogg/gaussian-splats-3d 0.4.7 的 `format` 选项是数字枚举**（Splat=0/KSplat=1/Ply=2/Spz=3），传字符串 `'ply'` 落空并 throw「File format not supported」；不传则按扩展名自动识别 | 本地 T-010 实测 + 包源码 `SceneFormat` 定义 |
| 4 | mkkellogg 0.4.7 SPZ 支持存在但生态未跟上；官方 SPZ 优化通道是 aholo-splat-transform（PLY→SPZ/ESZ） | splat-transform-test-suite README |
| 5 | React StrictMode 双挂载会双建 WebGL viewer（我们踩过：canvas×3 泄漏）→ 资源持有 + 无条件 disposeAll | 本地 T-010 实测 |
| 6 | 官方 viewer 要求「真实 DOM 容器有稳定尺寸再 createViewer；事件挂容器不挂引擎 canvas；显式 `viewer.render()` + `requestRenderHandler` 驱动」 | 官方 AI skill §Integration Workflow |
| 7 | aholo-spatial-sdk issues 区近乎不活跃（30 天 1 条），排错首选 aholojs.dev/llm 文档而非 issue 搜索 | gh api 实查 |
| 8 | Windows ESM：Node 里 import 绝对路径包必须 `pathToFileURL`（ERR_UNSUPPORTED_ESM_URL_SCHEME） | 本地 pipeline/world 实测 |

## 3. 推荐参数表

| 场景 | 参数 | 来源 |
|---|---|---|
| 相机（Aholo splat） | `up.set(0,-1,0)`；`position(-1.5,-0.5,0)`；`lookAt(0,0,0)`；fov 60；near 0.1 far 2000 | 官方示例 |
| 加载（mkkellogg 路线） | `addSplatScene(url, { dynamicScene:false, sceneRevealMode:1 })`，**不传 format**（扩展名自识别） | 本地实测+源码 |
| 体积优化 | `splat-transform lod:auto --ratio 0.3 in.ply out.spz`（18.4MB PLY → 预期 ~4.5MB SPZ 对齐官方 spzPath） | test-suite README |
| 大场景流式 | `lod:auto-chunk --type spz`（ESZ 分块 LOD，官方 viewer 消费） | 同上 |
| 官方 viewer 管线 | `Splatting.enabled:true` + `Background.basic.color` + `TAA.enabled:false` | 官方 skill 示例 |

## 4. 对我们项目的落点

1. **T-010 黑屏修复**：优先方案 A（mkkellogg + 翻转/相机 up）最小改动；若追求官方口径再评估方案 B（aholo-viewer 重写，官方 skill 模板齐备）——按板上流程单开任务
2. **18.4MB PLY 瘦身**：跑 aholo-splat-transform `lod:auto --ratio 0.3` → SPZ（官方 viewer B 路线可直用；mkkellogg A 路线 0.4.7 需验证 SPZ 数字枚举传法 `format: 3`）
3. **world_generate 产物三件套**（ply/spz/lodMeta + panoUrl）中 panoUrl 已用作主视觉——调研确认这是官方预期的轻量预览形态

## 5. 未完成项（如实）

- YouTube 官方频道字幕：本机出口对 YouTube/vercel.app/jina 全部受阻（DNS 污染），yt-dlp 搜索转后台未归——官方 LLM 文档已覆盖同等信息（参数+集成模式），标注为「非必要补充」；网络恢复后可 `agent-reach` video 渠道补拉
