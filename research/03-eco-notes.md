# 03 · 「ECO 信息组织」核查与工作定义（待 Lead/doc-writer 确认）

> 结论先行：**截至 2026-11-03 的公开检索，未发现「ECO 信息组织」在 HCI / 信息架构 / 知识组织 / 数字展馆领域有公认定义**。英文 "ECO" 的既有公认含义均与本项目语境无关（见 §1）。因此本文件给出**项目内工作定义**（§2），并明确标注「非公认术语、可被 Lead 修订」，供 `docs/01-总体设计与实施方案.md` 第 2/6 章统一口径使用。
> 检索时间：2026-11-03；检索手段：`web_search`（3 组查询，见 §1）+ 对 00-brief 的语义分析。**没有把任何二手说法包装成定义。**
>
> **最终口径（Lead 裁决）**：`docs/01-总体设计与实施方案.md` 已采用 **ECO = Environment（空间层）/ Content（内容层）/ Object（物件层）**（见文档第 6.1 节，因为 O 层要直接映射 `objectId` 与知识条目）。本文件 §2 的 "O = Orchestration" 为历史建议版本，两版可语义映射（Orchestration 层中的"主线/触发器/提示"在文档里归入第 8 章叙事系统）；**以文档为准**，本文件作为检索与论证记录保留。

---

## 1. 核查记录（可复核）

检索查询（本次会话）：
1. `"ECO" 信息组织 概念 定义`
2. `ECO information organization knowledge space design`
3. `"ECO" 信息架构 数字展馆 信息组织`

结果与判断：

| 候选含义 | 出处 | 与本项目是否相关 |
|---|---|---|
| **Evidence & Conclusion Ontology (ECO)** | <https://evidenceontology.org/about_eco/> | 否。生物医学本体，用于标注「证据/结论」类型（如实验证据、推断证据），属于本体工程，不是「信息组织方法论」 |
| Economic Cooperation Organization（经济合作组织） | 常见公开资料 | 否，纯缩写碰撞 |
| Ecology / ecosystem 的简称 | 常见公开资料 | 否，除非用户原意是「生态式信息组织」，但无证据 |
| HCI/IA 中的某种「ECO 框架」 | 检索未命中 | **未找到**；未发现学术或行业通用定义 |

> 说明：微信技术拆解文（<https://mp.weixin.qq.com/s/lPK9t2SSz9hn5oA6v71M3w>）与 Zork 官网均未出现 "ECO" 概念，说明它**不是 Zork 参考项目的一部分**，而是用户对「知识/信息如何组织」的自有提法（00-brief §1.3「体现 ECO 的信息组织」、§5 第 6 章要求「ECO 三层组织（定义清楚）」）。

## 2. 本文工作定义（项目内口径，非公认）

**工作定义（建议采用）**：
> **ECO = Environment（空间/环境层）— Content（知识内容层）— Orchestration（组织/编排层）**。
> 一种「以 3D 空间为索引、以知识条目为原子、以叙事/任务编排为路径」的信息组织方式：**信息不是被"页面"组织，而是被"空间位置 + 对象 + 状态"组织**；检索的终点不是文档列表，而是**空间 ID**（可高亮、可镜头定位、可被 Agent 引用）。

三层职责（与 00-brief 的产物一一对应）：

| 层 | 名称 | 内容 | 数据落点（本 Demo） | 关键约束 |
|---|---|---|---|---|
| **E** | Environment 空间层 | `zoneId / objectId / cameraId / viewId` + 空间关系与可达性 | `scene.json`（zones/objects/exits/cameras） | 每个知识条目**必须**绑定 `objectId`（可空则绑定 `zoneId`）+ `cameraId`；空间 ID 命名见 00-brief §4.2 |
| **C** | Content 知识层 | 知识条目：`id/title/topics/content/sources/confidence/relatedObjectIds/spoilerLevel` | `knowledge.json`（≥8 条） | `sources` 必填、`confidence ∈ verified/inferred/uncertain`；不编造（对齐 00-brief §4.7） |
| **O** | Orchestration 组织/编排层 | 主线 stage、触发器/条件、任务、提示、Agent 检索路径与工具调用 | `quests.json` + `hints` + Agent 工具表 | 状态只由玩家交互推进；Agent 只读（00-brief §4.5/§4.9） |

为什么这样定义（可辩护理由，不引用未证实来源）：
1. **贴合用户原始诉求**：00-brief §1.6 明确「检索 + 空间 ID → 3D 导航（不是把检索结果丢给 Agent 就完了）」；§4.8 要求「检索与空间 ID 的映射必须走数据驱动表」。ECO 若只等于"主题分类"，就无法解释"空间 ID"为何是一等公民。
2. **贴合 Zork 参考实现**：Zork 用 `RoomDef/ExitDef/ObjectDef/GameState` 把「空间—内容—进度」三层数据化（见 `01-zork-reference.md` §1–§3），我们的 ECO 三层正是它的产品化表述（差异：我们多了「检索/知识条目」这一层，因为我们的产品是**叙事空间 + 信息检索**，不是纯游戏）。
3. **可验收**：每层都有明确的数据文件与校验规则，可写测试（如「每条知识条目都能解析到存在的 objectId」「每个 stage 都有知识条目支撑」）。

**备选读法（若 Lead 有原始出处，请以原始出处为准）**：
- `Experience–Content–Object`：从玩家体验出发组织内容与对象——与上面三层可互相映射（Experience≈O 层、Content=C、Object=E），**不冲突**，文档中可做一句对照。
- 若用户原意是某个具体产品/论文的 ECO，请 Lead 提供链接；本文件届时以一手出处覆盖工作定义。

## 3. 与「普通信息架构」的区别（写文档用）

| 维度 | 普通 3D 官网/展馆 | ECO 信息组织（本定义） |
|---|---|---|
| 信息寻址 | URL / 页面 / 分类树 | **空间 ID**（zone/object/camera）+ 主题 |
| 检索终点 | 文档 / 列表页 | **空间中的可见对象**（高亮 + 镜头定位 + 叙事卡） |
| 组织方式 | 导航菜单 | **空间关系 + 条件/状态 + 叙事编排**（同一对象随 stage 变化语义） |
| Agent 角色 | 搜索框 | 受控助手：检索知识 → 返回 objectId/cameraId + 引用 sources，**不直接改状态** |
| 数据形态 | CMS 页面 | `scene.json` / `knowledge.json` / `quests.json` 三件套 + 向量索引（pgvector） |

## 4. 交接给 doc-writer 的写法建议

1. 第 2 章写「ECO × ZORK 融合」时，用一句话声明：**「ECO 在本项目中指 Environment–Content–Orchestration 三层信息组织（工作定义，非行业通用术语）」**，避免读者误解。
2. 第 6 章「ECO 三层组织」直接采用 §2 的表格，并补：每层的 schema、校验规则、生成流程（内容管线）、替换点/扩展点（换 zone 不动知识层；换知识库不动空间层）。
3. 第 10 章 Agent 检索流程可写成：`query → topics 过滤 → knowledge entries → objectId/cameraId → focus_object + show_narration`，并强调「**没有匹配时说'档案中没有记录'**」（00-brief §4.9）。
4. **不要**在任何地方声称 ECO 是「业内公认框架」；如必须引用，标注「本项目工作定义」。

## 5. 风险 / 未完成

- 未找到用户「ECO」提法的原始出处（可能来自用户内部资料/口头概念）。本文件是**可辩护的工作定义**，不是考据结论。
- 若后续拿到一手出处，只需替换 §2 的定义句与 §1 的核查表，三层结构可直接复用作落地模型。
