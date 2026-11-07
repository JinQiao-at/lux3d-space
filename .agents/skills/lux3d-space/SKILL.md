---
name: lux3d-space
description: 在 lux3d-space 项目（Aholo Lux3D 驱动的 3D 叙事空间《提灯与暗门》）里开发时使用。涉及修改 demo/ 前端、接入 Lux3D GLB 资产、跑验收命令、领取 collab 任务板任务、修复 build/单测失败、准备比赛提交物时触发。
---

# lux3d-space 项目技能

> 本技能是 ZCode 在本工作区的操作说明。命中任务后先读 §1，再按 §2 流程执行。
> 详细规范见 `references/` 与仓库 `docs/06-ZCode工程提示词.md`。

## 1. 必读（每次载入技能时）

1. `AGENTS.md`（工作区契约：状态、硬约束、命令）
2. `collab/board.json`（任务板）
3. `references/contracts.md`（不可破坏的契约）
4. `references/verification.md`（验收命令与期望输出）

按任务类型加读：

- 涉及 GLB 资产（接入/校准/朝向/尺寸）→ `references/asset-calibration.md`（bbox 校准方法论 + 朝向约定，T-005 验证）
- 需要自动化截图/无指针锁驱动游戏 → `references/automation-recipe.md`（种子存档技法 + 已踩坑）

## 2. 标准工作流

1. `node collab/cli.mjs next` → 看最高优先级 pending 任务；
2. `node collab/cli.mjs show <ID>` → 确认 scope / acceptance；
3. `node collab/cli.mjs claim <ID> --owner zcode`；
4. 只改 scope 内文件（见 `references/workflow.md`）；
5. 跑 acceptance 命令，**亲自跑**，保留输出；
6. `node collab/cli.mjs done <ID> --summary "..." --files "..."`；
7. 补全 `collab/handoffs/<ID>.md` 的验收结果与交接说明。

## 3. 硬约束（违反即失败）

- 不写任何密钥/token/私有链接到文件或日志；`AHOLO_API_KEY` 只用环境变量。
- 不改 `demo/src/scene/assetRegistry.ts` 的生成语义（pipeline 会覆盖它）。
- 不改 `server/` 的 API 字段与 7 个 Agent 工具名（需 DSH 批准）。
- 不改 7 步主线语义与既有 21 个单测断言（可新增测试；2026-11-04 起为 21 项，历史口径 19）。
- 不编造性能/体积/评分数据；不确定标「待验证」。

## 4. 常用命令

```powershell
# Demo（pnpm 用 DSH 捆绑运行时，与全局 pnpm 版本可能不同）
$PNPM = "C:\Users\王潇\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs"
cd demo
node $PNPM install
node $PNPM build
node --experimental-strip-types --test tests/state-machine.test.ts   # 期望 21/21
node $PNPM dev -- --port 5180

# 任务板
node collab/cli.mjs list
node collab/cli.mjs next
node collab/cli.mjs claim T-005 --owner zcode
node collab/cli.mjs done T-005 --summary "..." --files "demo/src/scene/Props.tsx"
```

## 5. 汇报格式

【任务】ID 标题
【状态】完成/部分完成/阻塞
【改动】文件列表
【验收】命令 + 实际输出摘要
【风险/交接】是否改契约、需人工确认的点
