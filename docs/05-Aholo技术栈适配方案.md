# 05 · Aholo 技术栈适配方案（比"只用 Lux3D"更合适的用法）

> 背景：赛事海报列出五项核心能力——**Aholo Lux3D（3D 生成）、SpatialGen（世界生成）、Aholo Viewer（3DGS 浏览器）、LuxReal（AI 视频）、Aholo Reality（重建）**。
> 当前 Demo 只用了 Lux3D（1/5），不是不能用更多，而是**要把每个能力放在它真正擅长的体验层**，否则会变成"技术堆砌"。
> 本文件给出五能力 × 四层的适配矩阵、推荐路线、接入步骤与风险。最后更新：2026-11-03 · DSH

---

## 1. 核心判断：不要"五个都塞进主玩法"，要按体验分层

| 层 | 需要什么 | 最适合的 Aholo 能力 | 不适合放什么 |
|---|---|---|---|
| **交互层**（可玩） | 状态机、碰撞、交互、存档、Agent | **不交给生成模型**，由 R3F 引擎负责 | 3DGS/视频（不可交互） |
| **资产层**（物件） | 可加载、可动画、材质统一 | **Lux3D**（+ part split / material transfer） | SpatialGen（太重） |
| **记忆层**（看完的奖励） | 可环视、氛围强、移动端可看 | **SpatialGen + Viewer**（3DGS） | Lux3D（单物体不够沉浸） |
| **真实层**（应用价值故事） | 真实空间可信、可展示 | **Reality / World 重建**（照片→3DGS） | 塞进主线（工期/性能不可控） |
| **影像层**（传播/必交视频） | 多镜头一致、可剪辑 | **LuxReal** | 替代可玩 Demo |

> 一句话：**Lux3D 负责"造物"，SpatialGen/Viewer 负责"造境"，Reality 负责"回到真实"，LuxReal 负责"讲出去"。**

---

## 2. 五能力适配矩阵（推荐版）

| 能力 | 现在用了没 | 更合适的用法 | 落点（Demo/报告/视频） | 优先级 | 风险 |
|---|---|---|---|---|---|
| **Lux3D** | ✅ 2 件资产 | ① 17 件资产全量；② `part_split` 把暗门/转盘拆成可动部件；③ `material_transfer` 统一材质；④ `multi_format_export` 导 3MF 做"3D 打印"彩蛋 | Demo 场景；报告证据链；3D 打印奖可选 | **P0** | 生成质量/时间 |
| **SpatialGen**（World 生成） | ❌ | 用**一张密室概念图/文案**生成 3DGS"记忆片场"；结局后进入"记忆回廊"环视 | Demo 结局奖励；3DGS 页面 | **P1** | 质量/体积未知 |
| **Aholo Viewer** | ❌ | 开源 3DGS 渲染器（`@manycore/aholo-viewer` npm，MIT），在结局面板/独立页加载生成的 3DGS | "记忆回廊"页面（移动端可用） | **P1** | 嵌入成本/性能 |
| **LuxReal** | ❌ | 90 秒宣传片 + 多机位一致性 + 3 条社媒短片；可选游戏内"记忆闪回" | 必交视频；小红书/X | **P0** | API 开放形态待确认（工作台） |
| **Reality**（World 重建） | ❌ | 手机环拍真实房间（≥20 图）→ 3DGS 重建；做"真实空间 → 叙事空间"对照 | 报告/视频；可选第二场景 | **P2** | 拍摄/重建时间 |
| **MCP / Skill**（接入层） | ❌ | 官方 `@manycore/aholo-sdk-mcp`（26 tools：world_generate / world_reconstruct_space_from_files / lux3d_*）接入 DSH 或 ZCode，对话式驱动 | 两个 Agent 的工具链 | **P1** | 配置成本低，建议做 |

---

## 3. 推荐路线：**"一个主玩法 + 三个出口"**

```
主玩法（R3F 引擎，不变）
  ├── 17 件 Lux3D 资产（P0）
  ├── 暗门/转盘 part_split 后的真动画（P0）
  └── 材质统一 material_transfer（P1 可选）

出口 1：结局后的「记忆回廊」——SpatialGen 生成 3DGS + Viewer 渲染（P1）
出口 2：「真实空间版」——Reality 重建一间真实房间，做对照/视频（P2）
出口 3：90 秒宣传片——LuxReal 多机位一致（P0）
```

**为什么这样最优**：
1. **不破坏完成度**：主玩法不依赖未验证的 3DGS/视频能力，交付永远有保底。
2. **技术栈应用从 1/5 变成 4/5**：Lux3D（资产）+ SpatialGen/Viewer（空间）+ Reality（真实）+ LuxReal（影像），每项都有明确的体验位置。
3. **有故事可讲**：报告里可以写"从真实空间（Reality）→ 生成资产（Lux3D）→ 生成世界（SpatialGen）→ 影像表达（LuxReal）"，一条完整的空间智能链路。
4. **风险可控**：P1/P2 都是"加法"，失败只是少一个出口，不影响必交三件套。

---

## 4. 具体接入方法

### 4.1 Lux3D 进阶（P0，低成本高收益）

| 能力 | 调用 | 用途 |
|---|---|---|
| `lux3d_part_split` | 输入 GLB → 输出按部件拆分的 GLB | 暗门拆成"门板/门框/铜盘"；转盘拆成"盘面/指针"。R3F 里按下正确顺序旋转对应节点，比整体模型代码旋转更真实 |
| `lux3d_material_transfer` | 参考图材质 → 迁移到 GLB | 把整套书房统一成"深胡桃木 + 做旧黄铜"的调性，解决逐件生成的材质不一致 |
| `lux3d_multi_format_export` | GLB → 3MF/STL | "3D 打印应用奖"彩蛋：把提灯/转盘打印出来拍照，作为报告素材 |

接入位置：`pipeline/lux3d/` 增加 `post-process.mjs`（part split / material transfer / export），产物仍落 `demo/public/models/`。

### 4.2 SpatialGen「记忆回廊」（P1，最有"哇"感）

**流程**：
1. 用一张密室概念图（可以是我们 Demo 里石台的截图，或 Lux3D 生成的石台渲染图）+ 文案：
   `"A candlelit stone chamber beneath an old study, carved walls, a stone pedestal with a manuscript, cold blue light from above, cinematic"`
2. 调用 World 生成（MCP `world_generate` 或 API `POST /world/v1/generations`）。
3. 轮询 `GET /world/v1/{worldId}`，拿 `assets.splats.urls`（PLY/SPZ/LOD）与 `panoUrl`。
4. 下载 SPZ/PLY 到 `demo/public/splats/`。
5. 用 Aholo Viewer（npm `@manycore/aholo-viewer`）在结局面板/独立页渲染；若嵌入成本高，先做独立页 `/memory.html`，从结局面板新窗口打开（保底）。

**体验设计**：石台调查完成 → 结局面板出现「进入记忆回廊」按钮 → 3DGS 场景淡入，玩家可环视，字幕"这是上一任屋主留下的空间记忆"。

**验收**：3DGS 页面在桌面 + 手机 4G 各打开一次；首帧 <5s；可环视不卡顿。

### 4.3 Reality「真实空间版」（P2，最强应用价值故事）

**流程**：
1. 用手机环拍一间真实房间/展厅（**≥20 张**，覆盖四周与地面；或拍一段视频）。
2. MCP `world_reconstruct_space_from_files` 或 API `POST /world/v1/reconstructions`（`taskQuality: high`）。
3. 得到 3DGS 场景（PLY/SPZ），用 Viewer 展示。
4. 用途（不必进主 Demo）：
   - 90 秒视频的"真实空间 → 虚拟叙事空间"转场；
   - 报告对比图："同一间房，真实重建 vs Lux3D 叙事版"；
   - 未来产品故事：展陈/文旅"先重建现场，再叠加叙事内容"。

**验收**：重建场景可看、无明显破面；报告里写明拍摄条件与耗时。

### 4.4 LuxReal（P0 影像）

- **公开 API 状态待确认**（Aholo Skills 目前只列 Aholo World / Lux3D）；比赛期走官方工作台。
- 输入：我们 Demo 的截图/录屏 + 分镜表（见 `docs/02` §5.5）。
- 输出：90 秒多机位一致片；3 条 15 秒社媒短片；可选 5–8 秒"记忆闪回"。
- 关键要求：**必须含真实运行画面**（赛事规定），AI 影像可以作为补充镜头。

### 4.5 MCP / Skill 接入（P1，两个 Agent 都能用）

官方 MCP `@manycore/aholo-sdk-mcp`（stdio，26 tools），可配到 DSH 或 ZCode：

```json
{
  "mcpServers": {
    "aholo-sdk-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@manycore/aholo-sdk-mcp"],
      "env": { "AHOLO_API_KEY": "<环境变量注入，不写死>", "AHOLO_REGION": "cn" }
    }
  }
}
```

好处：两个 Agent 都能"用对话驱动" World 生成/重建、Lux3D 生成/拆分/导出，不必每次手写脚本。
文档：<https://labs.aholo3d.cn/api-docs/mcp>

---

## 5. 优先级与时间（16 天约束）

| 阶段 | 内容 | 估算 | 退出标准 |
|---|---|---|---|
| P0 | Lux3D 补 6 件高光资产 + part_split 暗门/转盘 + LuxReal 90s | 4–6 天 | Demo 可玩、视频有真机画面 |
| P1 | SpatialGen 生成 1 个 3DGS 场景 + Viewer 页面 | 2–3 天 | 结局可打开记忆回廊 |
| P1 | MCP 接入（DSH/ZCode 任一） | 0.5 天 | 对话可列任务/生成 |
| P2 | Reality 重建真实房间 + 对照视频 | 1–2 天 | 报告/视频有真实→虚拟转场 |

**如果只能做一件额外的事**：做 **P1 的 SpatialGen+Viewer 记忆回廊**——它最能体现"空间智能"与"叙事奖励"，且不动主玩法。

---

## 6. 评审收益对照

| 评审维度 | 只用 Lux3D | 五能力分层适配后 |
|---|---|---|
| 群核技术栈应用 | 1 项能力 | 4 项能力，各有体验落点 + 证据链 |
| 作品有趣程度 | 提灯/机关 | 再加"结局后的记忆回廊"（3DGS 环视） |
| 创新性 | 检索/Agent 叙事 | 可讲"真实空间→生成世界→影像表达"的完整链路 |
| 完成度 | 高（保底） | 主玩法不变，出口是加法，不牺牲完成度 |
| 应用价值 | 叙事空间模板 | 可复用到文旅"现场重建→叙事叠加" |

---

## 7. 风险与诚实边界

1. **SpatialGen 质量/体积未知**：先做 1 次小实验（≤1 天），失败则退回"仅 LuxReal 视频"。
2. **Viewer 嵌入成本**：开源可自托管，但集成未知；保底方案是独立页/新窗口。
3. **LuxReal API 未确认**：以工作台出片为准，不承诺脚本化。
4. **Reality 拍摄依赖人类**：需要手机环拍 ≥20 张；室内光线不足会影响质量。
5. **不要为了用而用**：每个能力必须回答"它解决了哪个体验问题"，否则砍掉。

---

## 8. 参考链接

- Aholo World（SpatialGen / 3DGS 重建）Skill：<https://labs.aholo3d.cn/api-docs/skills/aholo-3dgs-reconstruction>
- Aholo MCP（26 tools）：<https://labs.aholo3d.cn/api-docs/mcp>
- Lux3D Skill：<https://labs.aholo3d.cn/api-docs/skills/lux3d>
- Aholo Viewer（开源，MIT）：<https://github.com/manycoretech/aholo-viewer>
- LuxReal 与 SpatialGen（人民网）：<http://finance.people.com.cn/n1/2026/0719/c1004-40763564.html>
- 3DGS 浏览器开源的报道（央广网）：<https://tech.cnr.cn/techph/20260525/t20260525_527635231.shtml>
