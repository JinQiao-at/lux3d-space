# pipeline/blender — Blender 修整组装管线（T-021）

> 链路第②环：Lux3D 原始 GLB → **Blender headless bpy 修整/拆分** → parts GLB → R3F 部件动画（T-011）。
> Blender 4.2.23 LTS portable：`C:/Users/王潇/.dsh/tools/blender/blender.exe`（南大镜像 zip；winget 官方源 403 已绕过）。

## 用法（在仓库根执行）

```powershell
# 转盘拆分（盘体 / 指针）
& "C:\Users\王潇\.dsh\tools\blender\blender.exe" --background --python pipeline\blender\split_parts.py -- ^
  --input demo\public\models\obj_basement_dial_1.glb ^
  --out-dir demo\public\models\parts ^
  --prefix obj_basement_dial_1
```

- 脚本逻辑：导入 GLB → 按「连通体（loose parts）」分离 → 按包围盒体积排序，**最大件=body（盘体/门体），其余合并=pointer（指针/活动件）** → 各自导出 GLB 并打印 bbox（供 T-005 校准方法复核）。
- 单连通体（拆不开）时：输出 `SINGLE_PART` 警告并整件复制为 body——调用方据此降级（如指针改程序化叠加）。
- 产物：`demo/public/models/parts/<prefix>_body.glb` / `<prefix>_pointer.glb`；**不改动** `public/models/` 原件与 `assetRegistry.ts`。

## 暗门

`obj_basement_secret_door.glb` 同法处理（门体/门轴分离）。若连通体不可分（雕刻一体），记录原因降级——暗门动画改由 R3F 层做整体开合（绕门轴 rotation），不阻塞 T-011。

## 红线继承

不写密钥；不改 `assetRegistry.ts`；产物只进 `demo/public/models/parts/`；脚本本身不依赖网络。
