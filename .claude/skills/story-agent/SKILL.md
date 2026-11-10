---
name: story-agent
description: 在 lux3d-space《提灯与暗门》里接入或模拟叙事 Agent 时使用。把 AGENT_TOOLS 七工具 schema 接到任意 LLM function-calling、编写 Agent 回答逻辑、或校验 Agent 只读约束时触发。源定义 demo/src/game/agent.ts（唯一事实源，schema 变更以它为准）。
---

# 叙事 Agent 七工具（story-agent）

> 本文件是 `demo/src/game/agent.ts` 的 `AGENT_TOOLS` 快照（2026-11-07，对应 27 单测基线）。
> 接入真实 LLM：把这 7 个定义原样放进 `tools` 参数；执行层复用 Zustand store 的白名单分发（见契约）。

## 硬契约（违反即错误实现）

1. **只读**：工具只允许「镜头定位 / 高亮 / 叙事日志 / 只读状态读取」；`request_hint` 仅累加 `hintsUsed`（唯一例外）。
2. **不得推进剧情**：Agent 不得构造 `inspect/read/search/use/dial/use_item_on/enter_zone` 等游戏 Action——那是玩家与 `applyAction` 状态机的专属通道（docs/10 §L4）。单测断言：Agent 回答前后存档字节完全一致。
3. **无命中不编造**：检索无结果时固定回答「档案中没有记录。我不会为这个问题编造答案。」，不返回 citation。
4. **引用格式**：回答引用 `[条目 id]` 与 `sources` 字段；`confidence`（verified/inferred/uncertain）必须透传。

## 七工具 Schema（可直接作为 function-calling tools）

```json
[
  {
    "name": "search_knowledge",
    "description": "按关键词与可选过滤器检索项目知识档案，返回条目列表（含 id/title/topics/sources/confidence）。",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "检索关键词（中文/英文均可）" },
        "filters": {
          "type": "object",
          "properties": {
            "topic": { "type": "string" },
            "zoneId": { "type": "string", "enum": ["zone_study", "zone_basement", "zone_chamber"] },
            "maxSpoiler": { "type": "number" }
          }
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "focus_object",
    "description": "把镜头平滑移动到指定对象的 cameraId 机位，并高亮该对象。仅 readOnly 观察工具。",
    "parameters": {
      "type": "object",
      "properties": {
        "objectId": { "type": "string", "description": "场景对象 id，如 obj_study_desk" },
        "cameraId": { "type": "string", "description": "可选，默认取对象绑定的 cameraId" }
      },
      "required": ["objectId"]
    }
  },
  {
    "name": "highlight_object",
    "description": "在 3D 场景中高亮指定对象一段时间。",
    "parameters": {
      "type": "object",
      "properties": {
        "objectId": { "type": "string" },
        "durationMs": { "type": "number", "minimum": 500, "maximum": 10000, "default": 3000 }
      },
      "required": ["objectId"]
    }
  },
  {
    "name": "show_narration",
    "description": "把一段叙事文本显示在底部叙事日志，并引用来源条目 id。",
    "parameters": {
      "type": "object",
      "properties": {
        "text": { "type": "string" },
        "sourceIds": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["text"]
    }
  },
  {
    "name": "get_player_state",
    "description": "只读返回当前阶段、所在区域、背包、关键 flags、提示次数与用时。",
    "parameters": { "type": "object", "properties": {} }
  },
  {
    "name": "list_zone_objects",
    "description": "列出指定 zone（默认当前 zone）中的可交互对象及其 id / 名称 / 动作。",
    "parameters": {
      "type": "object",
      "properties": { "zoneId": { "type": "string", "enum": ["zone_study", "zone_basement", "zone_chamber"] } }
    }
  },
  {
    "name": "request_hint",
    "description": "返回当前阶段的三级提示之一，并计入 hintsUsed（唯一允许的“计数”写入，仍不修改剧情状态）。",
    "parameters": {
      "type": "object",
      "properties": { "level": { "type": "integer", "enum": [1, 2, 3] } },
      "required": ["level"]
    }
  }
]
```

## 执行层对接（Zustand 白名单）

工具调用落到 store 的映射：`search_knowledge → searchKnowledge()`（demo/src/data/knowledge.ts）；`focus_object/highlight_object → focusCamera()/highlightObject()`；`show_narration → pushLog()`；`get_player_state/list_zone_objects` 纯读；`request_hint → dispatch({type:'request_hint', level})`。示例实现：`demo/src/game/agent.ts` 的 `answerQuestion`（本地规则引擎 stub，可直接替换为模型调用）。

## 二期执行层（P1-B 已落地，roadmap T-026~T-032）

- **双结局**：Action `blow_lantern`/`keep_lantern`（仅 complete 阶段；自由旗标 `ending_blow/ending_keep` 不进 FLAG_KEYS、不持久化）。文案在 narrative-content.json `endingVariants{kept,blew}`；UI 入口 EndingPanel 抉择区
- **环境叙事**：`ambientLines`（objectId→一句话）——调查成功后一次性追加 narration（自由键 `ambient_seen_<objectId>` 会话内去重）；新增线索只改 JSON
- **音频三层**：environment（rain/drip/pad）·sfx（playSound）·music（chamber 低吟 55/55.4Hz 拍频 pad）；`startChamberPad/stopChamberPad` 由 App 按 zone 起停
- **Agent 回答契约新增**：`knowledgeBoundaries.unknownResponse`（narrative-agent.json）——检索零命中时代码层直接原话输出（0.02s，不依赖模型自觉）；system prompt 由同文件 persona/boundaries 拼装（python 侧 agent.py `_build_system_prompt` 同构实现）
- 手册：`.agents/skills/lux3d-space/references/roadmap-optimization.md`；路线图：`docs/15-二期路线图.md`

## 深入阅读

- 契约全文：`docs/10-故事技术栈定义.md` §L3-L4
- 护栏单测：`demo/tests/state-machine.test.ts`「受控 Agent」「Agent 不能推进剧情」两项
- 优化方向：issue #3（ink 管线 / 更多支线 / 服务端存档）
