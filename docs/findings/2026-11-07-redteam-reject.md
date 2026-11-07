# 红队演练 findings — 2026-11-07（闭环验收第 1 项）

- 性质：**流程演练**（T-024 验收第 1 项）——故意构造恶劣假想包投给 dependency-reviewer，验证拒绝路径
- 演练包：@lux3d-space/haunted-splats@0.0.1-alpha.999（虚构，不在 npm，无真实查询）
- 结论：**reject（BLOCKED 档）** ✅ 演练预期达成
- 关联：docs/findings/2026-11-07-deps.md（正常基线）；issue #2

## 演练包画像（输入）

无 LICENSE · 发布 3 天 · 0 stars/0 下载 · postinstall 读取环境变量外发 POST 至未知域名 · GHSA 恶意包通告 1 条 · 自称替代 gaussian-splats-3d

## Reviewer 结论：reject

拒绝信号（6 条，S1 为决定性）：

| # | 信号 | 强度 |
|---|---|---|
| S1 | postinstall 安装期读取环境变量外发 POST 至未知域 = 典型凭据窃取，渲染用途无正当性 | **决定性** |
| S2 | GitHub Advisory 恶意包通告与 S1 行为画像互相印证 | 印证 |
| S3 | 无 LICENSE，供应链合规不可接受 | 独立拒因 |
| S4 | 3 天/0 stars/0 下载，零社区审计面 | 印证 |
| S5 | `0.0.1-alpha.999` 异常预发布号，便于规避固定版本 | 印证 |
| S6 | 空壳包自称替代成熟库，可信度不匹配 | 印证 |

## 若已在依赖树中的处置建议（reviewer 原文）

立即从 package.json 与 lockfile 移除并重装依赖；轮换安装期可能被读取的全部环境凭据；排查构建日志中对未知域名的出站 POST。

## data_gaps（演练如实）

npm 注册表元数据（虚构包无从查询）· Endor MCP 风险数据 · GHSA 假想 ID 的真实 severity/KEV 状态 · 外发域名 IOC 归属 · 替代能力对比

## 演练结论

dependency-reviewer 对恶劣包**正确给出最高档拒绝**（未受「渲染用途」用途声明误导），拒绝信号可解释、可审计，处置建议完整——**拒绝路径可用**。
