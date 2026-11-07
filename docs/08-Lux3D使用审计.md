# 08 · Lux3D 使用审计（比赛"必须使用 Lux3D"的证据链）

> 目的：证明作品中**核心 3D 内容确实由 Aholo Lux3D 生成**，且可复核、可追溯。
> 审计时间：2026-11-04 12:50（Asia/Shanghai）｜审计人：DSH（Lead）
> 结论：**8 件可交互物件由 Lux3D G1 图生 3D 生成并已接入 Demo**（占 17 件中的 8 件；核心六件高光资产全部覆盖）。

---

## 1. 资产清单（真实 API 调用记录）

| # | objectId | 物件 | 参考图任务 | 3D 任务 | 原始体积 | 入库体积 | 压缩 | 运行目录 |
|---|---|---|---|---|---:|---:|---:|---|
| 1 | `obj_study_diary` | 半页日记 | 4625608 | 4625651 | 10.52 MB | 1.13 MB | -89% | `runs/20261103-225015` |
| 2 | `obj_study_desk` | 书桌 | 4625997 | 4626048 | 9.55 MB | 1.12 MB | -88% | `runs/20261103-225758` |
| 3 | `obj_study_bookshelf` | 整面书架 | 4639863 | 4639880 | 8.44 MB | 1.25 MB | -85% | `runs/20261104-123552` |
| 4 | `obj_study_fireplace` | 石壁炉 | 4640160 | 4640182 | 9.60 MB | 1.51 MB | -84% | `runs/20261104-124617` |
| 5 | `obj_basement_mural` | 石壁浮雕 | 4639862 | 4639882 | 9.70 MB | 1.12 MB | -88% | `runs/20261104-123552` |
| 6 | `obj_basement_shower` | 淋浴间玻璃门 | 4640161 | 4640189 | 8.68 MB | 1.06 MB | -88% | `runs/20261104-124617` |
| 7 | `obj_basement_secret_door` | 暗门 | 4639975 | 4640007 | 10.21 MB | 1.71 MB | -83% | `runs/20261104-123552` |
| 8 | `obj_chamber_pedestal` | 密室石台 | 4639985 | 4640016 | 12.88 MB | 3.22 MB | -75% | `runs/20261104-123552` |

> 原始体积 = Lux3D 返回的 GLB；入库体积 = gltf-transform 压缩（quantize + simplify 0.35 + WebP 1024）后的 GLB。
> 8 件均通过 `pipeline/lux3d/generate-assets.mjs` 生成；每件有提示词、参考图、任务 ID 与报告。

## 2. 证据链（每个环节可复现）

```
① 提示词/尺寸        pipeline/lux3d/assets-manifest.json（每件的 prompt 与 scaleHintM）
② 文生图（参考图）   runs/<时间>/refs/<objectId>.jpg（multimodalToImage 产物）
③ 图生 3D（G1/PBR）  runs/<时间>/report.json → items[].glb.taskId / remoteUrl
④ 原始 GLB           runs/<时间>/raw/<objectId>.glb
⑤ 压缩后 GLB         demo/public/models/<objectId>.glb（gltf-transform 输出）
⑥ 运行期注册         demo/src/scene/assetRegistry.ts（8 条）
⑦ 加载逻辑           demo/src/scene/AssetModel.tsx（HEAD 探测 + useGLTF + 失败回退）
```

复核命令：

```powershell
# 1) 清单状态（应显示 8/17 done）
node pipeline/lux3d/generate-assets.mjs --dry-run

# 2) 任务与体积记录
Get-Content pipeline/lux3d/runs/*/report.json

# 3) 运行期注册表
Get-Content demo/src/scene/assetRegistry.ts

# 4) 加载链路（dev server 起在 5180 后）
curl.exe -I http://127.0.0.1:5180/models/obj_study_bookshelf.glb
# → HTTP 200, Content-Type: model/gltf-binary
```

## 3. 运行期验证（本次实测）

- dev server `:5180` 启动后，8 个 `*.glb` 全部返回：`HTTP 200` + `Content-Type: model/gltf-binary`；
- `assetRegistry.ts` 含 8 条 `objectId → /models/<id>.glb`；
- `Props.tsx` 对这 8 个 objectId 走 `PropAsset`（GLB 优先），其余 9 件自动回退程序化几何；
- 首页 `GET /` 200。

## 4. 与比赛要求对齐

| 要求 | 我们的证据 |
|---|---|
| 必须使用 Aholo Lux3D | 8 件核心可交互物件由 Lux3D 图生 3D 生成；有任务 ID、参考图、原始/压缩对比 |
| 参与核心 3D 内容或关键创作流程 | 书房的书架/书桌/日记/壁炉、地下室的浮雕/淋浴门/暗门、密室的石台——均为**主线交互物件**（调查/线索/开门/结局） |
| 报告书需要过程截图与资产迭代对比 | `runs/*/raw/` 原始 GLB + `public/models/` 压缩 GLB + 参考图，可直接做"参考图 → 3DGS/Mesh → GLB"对比图 |
| 其他能力（SpatialGen/Viewer/LuxReal） | 规划见 `docs/05`，按优先级 P1/P2 推进 |

## 5. 剩余 9 件（待生成）

| objectId | 物件 | 优先级 |
|---|---|---|
| `obj_study_mirror` | 落地镜 | 2 |
| `obj_study_painting` | 黄昏油画 | 2 |
| `obj_study_floor_door` | 地板暗门 | 1 |
| `obj_basement_stairs` | 地下室阶梯 | 3 |
| `obj_basement_basin` | 洗手台 | 2 |
| `obj_basement_dial_1/2/3` | 三个铜转盘 | 2 |
| `obj_chamber_tapestry` | 密室挂毯 | 3 |

> 生成方式：`node dist？` 不需要——直接在 `pipeline/lux3d` 下 `node generate-assets.mjs --only <objectId>`（先设 `AHOLO_API_KEY` 环境变量）。
> 预算：单件约 3–6 分钟、入库约 1–3MB；13 天内可分批补齐。

## 6. 安全与合规

- API Key 仅从环境变量读取，不写入仓库/文档/日志；`.gitignore` 已忽略 `runs/` 与 `.env*`。
- 资产为 AI 生成，用于比赛展示；未使用第三方受版权保护的模型/贴图。
- 参考图由 Lux3D 多模态生图产生，随任务记录留档，便于评审复核。
