# collab · 双 Agent 任务板

> 文件即任务：DSH 与 ZCode 共用 `board.json`，用 `cli.mjs` 领取/汇报。
> 规则与角色见 `../docs/03-双Agent协同开发手册.md`。

## 命令

```powershell
node collab/cli.mjs list                 # 全部任务
node collab/cli.mjs next                 # 推荐下一个（最高优先级 pending）
node collab/cli.mjs show T-001
node collab/cli.mjs claim T-001 --owner zcode
node collab/cli.mjs note T-001 "说明"
node collab/cli.mjs done T-001 --summary "做了什么" --files "a.ts,b.ts"
node collab/cli.mjs verify T-001      # 仅 Lead/DSH
node collab/cli.mjs block T-001 --reason "等资产"
node collab/cli.mjs reopen T-001 --reason "验收未过"
node collab/cli.mjs add --title "标题" --scope demo/src --priority 2 --acceptance "验收命令"
node collab/cli.mjs stats
```

## 约定

- 状态：`pending → in_progress → done → verified`（可 `blocked` / `reopen` / `release`）。
- 单写者：claim 后 owner 独占 scope；其他人只读。
- `done` 会在 `handoffs/<id>.md` 生成交接单，请补全"验收命令与结果"。
- `verify` 只能由 DSH 执行，且必须亲自重跑验收命令。
- `.board.lock` 为并发锁，不进仓库。
