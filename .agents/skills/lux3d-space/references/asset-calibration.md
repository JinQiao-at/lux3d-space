# GLB 资产校准方法论（T-005 全程验证，2026-11-04）

> 适用：新 GLB 接入 Demo、比例/朝向不对、悬浮/穿墙/比例异常。
> 只改 `AssetModel.tsx` 的 `ASSET_FIT_SIZE_HINTS` 与 `Props.tsx` 的 `position/rotationYDeg`；**不碰 assetRegistry**。

## 1. 四步流程（每件资产都走全）

1. **实测 bbox**（不盲信 manifest 的 scaleHintM）：
   ```powershell
   cd pipeline/lux3d
   node node_modules/@gltf-transform/cli/bin/cli.js inspect "../../demo/public/models/<objectId>.glb"
   # 读 SCENES 表的 bboxMin/bboxMax → size = max-min，逐轴 X/Y/Z
   ```
2. **按场景语义定 fitSize**：`AssetModel` 按「最大边 = fitSize」等比归一、底部中心对齐放置点。
   先问"这件东西在该位置应该多高/多宽"，再看哪个轴是最大边，反推 fitSize = 语义尺寸 × (最大边/该轴)。
   常见语义锚点：桌面 0.82m、门高 2.2m、层架顶天 2.6m、浮雕底边 y=0.7、石台 1.0m。
3. **按朝向约定定 rotationYDeg**（见 §2）。
4. **截图目检**（`automation-recipe.md`）：确认无悬浮/穿墙/比例异常，交互提示锚点对得上。

## 2. 朝向约定（Lux3D GLB 正面 = +Z）

| 放置位置 | rotationYDeg | 依据 |
|---|---|---|
| 北墙（默认朝南/朝玩家） | 0（不传） | GLB 原生 +Z 朝向 |
| 西墙 | `90` | +Z → +X，正面朝室内 |
| 东墙 | `-90` | +Z → -X，正面朝室内 |

> 先按约定设值再截图微调；暗门 -90 是已验证的基准案例。

## 3. T-005 实测数据（8 件，bbox 为 GLB 原始尺寸 m）

| objectId | bbox (X×Y×Z) | max 边 | fitSize | rotY | 结论依据 |
|---|---|---|---|---|---|
| obj_study_desk | 1.20×1.02×0.88 | Y | **0.98** | 0 | 归一后高 0.83m ≈ 程序化桌面 0.82m，交互锚点 desk y=1.0 / diary y=0.98 |
| obj_study_diary | 0.21×0.06×0.16 | X | 0.2 | 0 | 近 1:1，桌面上方 6mm |
| obj_study_bookshelf | 2.06×2.40×0.50 | Y | **2.6** | **90** | 保「顶天」2.6m；宽 2.23 与 3.3m 墙槽留缝可接受 |
| obj_study_fireplace | 1.80×1.61×0.82 | X | 1.8 | **-90** | 高 1.61 略矮于程序化 1.9，可接受 |
| obj_basement_shower | 1.03×3.85×0.19 | Y | 2.0 | 0 | 是「独立门扇」非整间；2m 高门宽 1.06 合理 |
| obj_basement_mural | 0.60×1.32×0.19 | Y | 1.5 | 0 | 竖排三符号，底边 y=0.7 顶到 2.2 |
| obj_basement_secret_door | 0.92×1.20×0.47 | Y | 2.2 | -90 | 高 2.2；厚 0.87 凸入室内但不穿墙 |
| obj_chamber_pedestal | 0.71×0.90×0.71 | Y | 1.0 | 0 | 含手稿，锚点 y≈1.0 吻合 |

## 4. 历史坑

- **书桌 1.36m 事故**：manifest scaleHintM=1.6 按最大边归一 → 桌高 1.36m，日记(y=0.84)埋进桌身。教训：scaleHintM 是"期望尺寸"不是"归一化目标"，必须经 bbox 反算。
- **宽面资产贴侧墙忘 rotY**：书架/壁炉初版朝向错误，靠 ±90° 修正。
- **宁保高度不留缝**：贴墙槽位比 GLB 宽时按高度归一、接受两侧留缝，不要非等比拉伸。
