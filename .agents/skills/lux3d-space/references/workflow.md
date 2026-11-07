# 任务工作流与文件边界

## 1. 角色

- **ZCode**：主开发（Front-end / R3F / UI / 部署 / 修 bug / 补测试）。
- **DSH**：检查、验收、资产管线、文档、提交物、契约变更审批。

## 2. 任务生命周期

```
pending → claim → in_progress → done → verified
                 │                 │
                 └── block ────────┘（reopen 回到 pending）
```

- `claim` 后你是唯一写者；其他人只读。
- `done` 只代表你自测通过；`verify` 由 DSH 亲自重跑验收命令后执行。
- 同一文件被两个任务同时 claim → 后到者必须 block。

## 3. 写文件规则

1. 先完整读取目标文件，禁止凭记忆重写。
2. 优先 `edit` 精确替换；整文件重写必须在汇报里说明原因。
3. 不引入新依赖（除非任务明确允许，且先问 DSH）。
4. 改动只落在任务 scope；出现 scope 外改动必须 block 说明。
5. 大改（>3 文件或 >200 行）先拆任务、先说明计划。

## 4. 提交前自检

- `git status` / 列出改动文件（若仓库有 git）。
- 搜索敏感串：`AHOLO_API_KEY`、`token`、私有 IP/域名。
- 确认验收命令全部通过（见 `verification.md`）。
