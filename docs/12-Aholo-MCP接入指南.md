# 12 · Aholo MCP 接入指南（T-012）

> 目的：把 Aholo 官方 MCP（26 工具）接入 ZCode/DSH，实现「对话直接生成 3D 资产 / 3DGS 场景」。
> 已验证：服务握手 ✅ + 26 工具列表 ✅（2026-11-06 冒烟测试，见 T-012 交接单）。最后更新：2026-11-06 · ZCode

## 1. 架构

```
ZCode / DSH（MCP 客户端）
   │ stdio（JSON-RPC）
   ▼
pipeline/mcp/launch.mjs   ← 启动器：读本机 .env.aholo 注入环境变量（Key 不落仓库）
   ▼
@manycore/aholo-sdk-mcp@1.9.0（官方包，26 工具）
   │ HTTPS
   ▼
Aholo API（region=cn，api.aholo3d.cn）
```

## 2. 26 个工具速览（冒烟实测）

- **Lux3D 链**：`lux3d_text_to_3d` / `lux3d_img_to_3d(_from_file)` / `lux3d_multimodal_to_image` / `lux3d_image_to_four_view` / `lux3d_material_transfer` / `lux3d_part_split`（官方拆分，Blender 管线外的另一选择）/ `lux3d_multi_format_export` / `lux3d_articulation_animation` / `lux3d_humanoid_auto_rig` / `lux3d_humanoid_animation_retarget` / 任务查询 `lux3d_list_tasks / get_task / wait_for_task`
- **SpatialGen 链（3DGS）**：`world_generate` / `world_get` / `world_wait_for` / `world_list` / `world_inspect_local_media`
- **Reality 链**：`world_reconstruct*` 系列（环拍重建）

## 3. 配置（本机已完成，重启 ZCode 后生效）

1. 依赖：`pipeline/mcp/node_modules`（`npm i @manycore/aholo-sdk-mcp`，已装）
2. 凭据：`pipeline/mcp/.env.aholo`（**gitignored**）：`AHOLO_API_KEY=…` + `AHOLO_REGION=cn`
3. 注册：`~/.zcode/cli/config.json` → `mcp.servers.aholo`（stdio，command=node，args=[pipeline/mcp/launch.mjs]，enabled=true）

**新机器复刻**：clone 仓库后 = 装 npm 包 → 建自己的 `.env.aholo`（Key 从 Aholo 控制台）→ 在自己的 `~/.zcode/cli/config.json` 加同名条目 → 重启。

## 4. 使用示例（重启 ZCode 后）

- 「用 lux3d_text_to_3d 生成一把维多利亚式黄铜钥匙」→ 任务号 → `lux3d_wait_for_task` → GLB URL
- 「world_generate 一个哥特石室密室 3DGS 场景」→ `world_wait_for` → splats（S5 记忆回廊数据源）
- 对话产物落 `runs/<ts>/` 或临时目录，**进游戏前必须走 bbox 校准 + build/单测门禁**（docs/10 流程不变）

## 5. 红线

- Key 只在 `.env.aholo`（gitignored）与环境变量；文档/代码/日志零密钥
- MCP 生成的资产进 `demo/public/models/` 前仍按红线走：bbox 校准（asset-calibration.md）+ 门禁 + 板上流程
- `lux3d_part_split` 与 Blender 拆分（T-021）并存：官方拆分适合标准件，Blender 适合定制修整——按件选择，不重复投入
