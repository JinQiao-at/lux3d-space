# Aholo Lux3D 资产管线

把《提灯与暗门》的 17 个可交互物件从「程序化几何占位」升级为「Lux3D 生成的真实 GLB 资产」。

```
assets-manifest.json（物件 + 英文提示词 + 尺寸提示）
   ↓ ① 多模态生图（multimodalToImage）
参考图 runs/<时间戳>/refs/<objectId>.<png|jpg|webp>（自动按文件头识别格式）
   ↓ ② 图生 3D（imgTo3d，G1 / G1-Turbo，PBR，输出 GLB）
任务轮询（tasks.waitFor）
   ↓ ③ 下载原始 GLB 备份到 runs/<时间戳>/raw/
   ↓ ④ gltf-transform 压缩（quantize + simplify 0.35 + WebP 1024）
demo/public/models/<objectId>.glb
   ↓ ⑤ 回写 manifest + 生成 demo/src/scene/assetRegistry.ts
运行期：R3F 的 useGLTF 优先加载 GLB，缺失/失败自动回退程序化几何
```

> 实测：`obj_study_diary` 原始 10.52MB / 118,488 三角面 → 压缩后 **1.18MB（-89%）/ 41,470 三角面**。

## 1. 准备 API Key（不要写进代码）

1. 登录控制台创建 Key：国内站 <https://labs.aholo3d.cn> ／国际站 <https://labs.aholo.ai>
2. 只在当前终端设置环境变量：

```powershell
$env:AHOLO_API_KEY = "你的Key"
$env:AHOLO_REGION  = "cn"    # 或 com
```

> 安全纪律：Key 只存在于环境变量；`.gitignore` 已忽略 `.env*`、`runs/`；脚本不会打印 Key。

## 2. 联通性检查（不消耗额度）

```powershell
node check-key.mjs
# [check] OK  region=cn (国内站 api.aholo3d.cn)  最近任务数=...
```

## 3. 生成资产

```powershell
# 先看计划（不调用 API、不消耗额度）
node generate-assets.mjs --dry-run

# 先生成一两个低成本资产验证链路（G1-Turbo 更快）
node generate-assets.mjs --only obj_study_diary --version G1-Turbo

# 全量生成（断点续跑：已完成会跳过；--force 强制重做）
node generate-assets.mjs
node generate-assets.mjs --force --only obj_basement_mural
```

参数：

| 参数 | 说明 |
|---|---|
| `--dry-run` | 只打印计划与清单状态 |
| `--only <objectId>` | 只处理指定物件（可重复） |
| `--force` | 已完成也重新生成 |
| `--max <n>` | 本次最多处理 n 个 |
| `--region cn\|com` | 覆盖 region（默认取 manifest / 环境变量） |
| `--version G1\|G1-Turbo` | 覆盖 3D 生成版本（G1 质量高、G1-Turbo 快） |

产物：

- `demo/public/models/<objectId>.glb`
- `runs/<时间戳>/refs/*.png`（生成的参考图，写报告时做“资产迭代对比”正好用）
- `runs/<时间戳>/report.json`（任务 ID、耗时、URL、失败原因）
- `assets-manifest.json` 中每个物件的 `status / taskId / bytes / updatedAt`
- `demo/src/scene/assetRegistry.ts`（供 Demo 优先加载）

## 4. 与比赛要求对齐

比赛要求「必须使用 Aholo Lux3D 且参与核心 3D 内容或关键创作流程」。这条管线就是证据链：

1. 报告书放 `runs/*/refs` 里参考图 → 3DGS/Mesh → GLB 的迭代对比；
2. 保留任务 ID 与调用日志（report.json）；
3. 演示视频里展示「同一物件的程序化占位 → Lux3D 真实资产」对比。

## 5. 备用/降级流程（如果 API 不可用）

1. **官方 ComfyUI 节点**：在 ComfyUI 里跑 Lux3D（参考图 → GLB），产物同样落到 `public/models/`；
2. **控制台手工生成**：网页工作台逐件生成并导出 GLB，命名对齐 manifest 的 objectId；
3. **纯程序化兜底**：Demo 始终可运行（assetRegistry 为空时行为不变），不会因资产缺失而崩。

## 6. 目录

```
pipeline/lux3d/
├── assets-manifest.json   # 17 个物件的提示词与状态（断点续跑）
├── check-key.mjs          # 联通性/鉴权检查（只读）
├── generate-assets.mjs    # 生成 → 下载 → 归档 → 回写清单
├── runs/                  # 运行记录（gitignore）
└── README.md
```

## 7. 已知边界

- 生成质量取决于提示词与参考图；家具/道具类（书桌、书架、提灯）通常比带文字/复杂符号的物件稳。
- 单件可能 1–5 分钟；17 件建议分批（先 1 件验证 → 再并行 3–4 件）。
- API 额度以控制台为准；报名/组队积分是主要算力来源。
