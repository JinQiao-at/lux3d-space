/**
 * 受控 Agent（本地规则引擎 stub，接口对齐将来的 LLM function calling）。
 *
 * 硬约束（00-brief §4.9）：
 * - 只读游戏状态：Agent 不能返回任何会修改 stage/flags/inventory 的指令；
 * - 回答必须引用知识条目 id 与 sources，无命中时必须明确说“档案中没有记录”，不得编造；
 * - 7 个前端工具定义完整，参数白名单 + 校验；真正执行由 store 侧完成（只读/焦点类）。
 */
import type { GameState, KnowledgeEntry, ZoneId } from './types.ts'
import { KNOWLEDGE_BASE, focusTargetOf, searchKnowledge } from '../data/knowledge.ts'
import { OBJECTS, ZONES, zoneObjects } from '../data/scene.ts'
import { AGENT_DISCLAIMER, AGENT_NO_KNOWLEDGE_TEXT, HINTS, STAGE_META } from '../data/narrative.ts'

export type ToolName =
  | 'search_knowledge'
  | 'focus_object'
  | 'highlight_object'
  | 'show_narration'
  | 'get_player_state'
  | 'list_zone_objects'
  | 'request_hint'

export interface ToolDefinition {
  name: ToolName
  description: string
  parameters: Record<string, unknown>
  /** 是否只读（不改变游戏进度状态）。 */
  readOnly: boolean
}

/** 7 个工具定义：可直接复制进 LLM function-calling 的 tools 字段。 */
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'search_knowledge',
    description: '按关键词与可选过滤器检索项目知识档案，返回条目列表（含 id/title/topics/sources/confidence）。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索关键词（中文/英文均可）' },
        filters: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            zoneId: { type: 'string', enum: ['zone_study', 'zone_basement', 'zone_chamber'] },
            maxSpoiler: { type: 'number' },
          },
        },
      },
      required: ['query'],
    },
    readOnly: true,
  },
  {
    name: 'focus_object',
    description: '把镜头平滑移动到指定对象的 cameraId 机位，并高亮该对象。仅 readOnly 观察工具。',
    parameters: {
      type: 'object',
      properties: {
        objectId: { type: 'string', description: '场景对象 id，如 obj_study_desk' },
        cameraId: { type: 'string', description: '可选，默认取对象绑定的 cameraId' },
      },
      required: ['objectId'],
    },
    readOnly: true,
  },
  {
    name: 'highlight_object',
    description: '在 3D 场景中高亮指定对象一段时间。',
    parameters: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        durationMs: { type: 'number', minimum: 500, maximum: 10000, default: 3000 },
      },
      required: ['objectId'],
    },
    readOnly: true,
  },
  {
    name: 'show_narration',
    description: '把一段叙事文本显示在底部叙事日志，并引用来源条目 id。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        sourceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['text'],
    },
    readOnly: true,
  },
  {
    name: 'get_player_state',
    description: '只读返回当前阶段、所在区域、背包、关键 flags、提示次数与用时。',
    parameters: { type: 'object', properties: {} },
    readOnly: true,
  },
  {
    name: 'list_zone_objects',
    description: '列出指定 zone（默认当前 zone）中的可交互对象及其 id / 名称 / 动作。',
    parameters: {
      type: 'object',
      properties: { zoneId: { type: 'string', enum: ['zone_study', 'zone_basement', 'zone_chamber'] } },
    },
    readOnly: true,
  },
  {
    name: 'request_hint',
    description: '返回当前阶段的三级提示之一，并计入 hintsUsed（唯一允许的“计数”写入，仍不修改剧情状态）。',
    parameters: {
      type: 'object',
      properties: { level: { type: 'integer', enum: [1, 2, 3] } },
      required: ['level'],
    },
    readOnly: false,
  },
]

export interface AgentCitation {
  id: string
  title: string
  sources: string[]
  confidence: string
}

export interface AgentToolCall {
  tool: ToolName
  args: Record<string, unknown>
  result: string
}

export interface AgentFocus {
  objectId: string | null
  cameraId: string
  title: string
}

export interface AgentReply {
  text: string
  citations: AgentCitation[]
  toolCalls: AgentToolCall[]
  hintLevel?: 1 | 2 | 3
  focus?: AgentFocus
  highlightObjectId?: string
  narration?: string
  narrationSourceIds?: string[]
}

export interface AgentContext {
  state: GameState
  entries?: KnowledgeEntry[]
}

function toCitation(entry: KnowledgeEntry): AgentCitation {
  return { id: entry.id, title: entry.title, sources: entry.sources, confidence: entry.confidence }
}

function clampLevel(value: number): 1 | 2 | 3 {
  if (value <= 1) return 1
  if (value >= 3) return 3
  return 2
}

function parseHintLevel(question: string, state: GameState): 1 | 2 | 3 {
  const match = question.match(/([123一二三])\s*级?/) ?? question.match(/L\s*([123])/i)
  if (match) {
    const raw = match[1]
    const map: Record<string, number> = { 1: 1, 2: 2, 3: 3, 一: 1, 二: 2, 三: 3 }
    return clampLevel(map[raw] ?? 1)
  }
  return clampLevel(state.hintsUsed + 1)
}

function formatPlayerState(state: GameState): string {
  const meta = STAGE_META[state.stage]
  const flags = Object.entries(state.flags)
    .filter(([, value]) => value)
    .map(([key]) => key)
  const inventory = state.inventory.length > 0 ? state.inventory.join('、') : '（空）'
  const dial = state.dialOrder.length > 0 ? state.dialOrder.join(' → ') : '无'
  return [
    `阶段：${state.stage}（${meta.title}）`,
    `目标：${meta.objective}`,
    `区域：${ZONES[state.zone].name}`,
    `背包：${inventory}`,
    `提灯：${state.lanternLit ? '已点亮' : state.flags.has_lantern ? '未点亮' : '尚未获得'}`,
    `线索 flags：${flags.length > 0 ? flags.join(', ') : '（暂无）'}`,
    `转盘序列：${dial}`,
    `提示次数：${state.hintsUsed}`,
    `用时：${Math.floor(state.playTime)} 秒`,
  ].join('\n')
}

function resolveObject(objectId: string): { objectId: string; cameraId: string; title: string } | null {
  const object = OBJECTS[objectId]
  if (!object) return null
  return { objectId, cameraId: object.cameraId, title: object.name }
}

function buildKnowledgeAnswer(entries: KnowledgeEntry[], question: string): { text: string; citations: AgentCitation[] } {
  const top = entries.slice(0, 2)
  const citations = top.map(toCitation)
  const lines: string[] = []
  lines.push(`根据档案（问题：${question.trim()}）：`)
  top.forEach((entry, index) => {
    lines.push(`${index + 1}. [${entry.id}]《${entry.title}》：${entry.content}`)
    lines.push(`   来源：${entry.sources.join('；')}`)
  })
  lines.push(`（置信度：${top.map((entry) => `${entry.id}=${entry.confidence}`).join('；')}）`)
  if (entries.length > top.length) {
    lines.push(`另有 ${entries.length - top.length} 条相关条目，可在档案面板（Tab）中查看。`)
  }
  return { text: lines.join('\n'), citations }
}

/**
 * 本地规则引擎：意图识别 → 调工具 → 组织带引用的回答。
 * 不执行任何状态修改；hintLevel / focus 等由 store 按只读白名单执行。
 */
export function answerQuestion(question: string, context: AgentContext): AgentReply {
  const state = context.state
  const entries = context.entries ?? KNOWLEDGE_BASE
  const trimmed = question.trim()
  const toolCalls: AgentToolCall[] = []

  if (trimmed.length === 0) {
    return {
      text: '请输入一个问题，例如：“提灯有什么来历？”或“带我去看浮雕”。',
      citations: [],
      toolCalls,
    }
  }

  // 0) 工具定义类问题：让 Agent 能介绍自己的 7 个工具
  if (/工具|tool|能做什么|能力/i.test(trimmed) && /什么|哪些|list|工具/i.test(trimmed)) {
    toolCalls.push({
      tool: 'get_player_state',
      args: {},
      result: 'read-only context loaded',
    })
    return {
      text: `我只能在只读权限内行动，当前注册了 7 个前端工具：\n${AGENT_TOOLS.map(
        (tool) => `- ${tool.name}：${tool.description}`,
      ).join('\n')}\n${AGENT_DISCLAIMER}`,
      citations: [],
      toolCalls,
    }
  }

  // 1) 提示意图
  if (/提示|hint|卡住|怎么办|怎么做|不知道|帮帮我|下一步/i.test(trimmed)) {
    const level = parseHintLevel(trimmed, state)
    const hintText = HINTS[state.stage][level - 1]
    toolCalls.push({ tool: 'request_hint', args: { level }, result: hintText })
    return {
      text: `【提示 L${level}】${hintText}\n（提示已计入 hintsUsed；本回答不含任何剧情推进。）`,
      citations: [],
      toolCalls,
      hintLevel: level,
      narration: hintText,
    }
  }

  // 2) 玩家状态 / 进度意图
  if (/进度|目标|状态|我在哪|当前位置|背包|提示次数|用时|还要做什么/i.test(trimmed)) {
    const result = formatPlayerState(state)
    toolCalls.push({ tool: 'get_player_state', args: {}, result: 'ok' })
    return {
      text: `当前只读状态：\n${result}\n${AGENT_DISCLAIMER}`,
      citations: [],
      toolCalls,
    }
  }

  // 3) 对象清单意图
  if (/清单|有哪些|列表|列一下|对象|可交互/i.test(trimmed)) {
    const zoneId: ZoneId = state.zone
    const objects = zoneObjects(zoneId)
    toolCalls.push({ tool: 'list_zone_objects', args: { zoneId }, result: `${objects.length} objects` })
    return {
      text: `当前区域「${ZONES[zoneId].name}」的可交互对象：\n${objects
        .map((object) => `- ${object.id}：${object.name}（${object.action}）`)
        .join('\n')}\n${AGENT_DISCLAIMER}`,
      citations: [],
      toolCalls,
    }
  }

  // 4) 定位/高亮意图（检索 → focus_object → highlight_object）
  const focusIntent = /带我去|在哪|哪里|位置|定位|看看|高亮|聚焦|focus|带我/i.test(trimmed)

  const searchResult = searchKnowledge(trimmed, {}, entries)
  toolCalls.push({
    tool: 'search_knowledge',
    args: { query: trimmed },
    result: `${searchResult.length} hits`,
  })

  if (focusIntent) {
    if (searchResult.length === 0) {
      toolCalls.push({ tool: 'focus_object', args: {}, result: 'no match' })
      return {
        text: AGENT_NO_KNOWLEDGE_TEXT,
        citations: [],
        toolCalls,
      }
    }
    const entry = searchResult[0]
    const target = focusTargetOf(entry)
    const resolved = target.objectId ? resolveObject(target.objectId) : null
    toolCalls.push({
      tool: 'focus_object',
      args: { objectId: target.objectId, cameraId: target.cameraId },
      result: resolved ? `focused ${resolved.title}` : 'camera only',
    })
    if (target.objectId) {
      toolCalls.push({ tool: 'highlight_object', args: { objectId: target.objectId, durationMs: 4000 }, result: 'highlighted' })
    }
    return {
      text: `我找到了档案 [${entry.id}]《${entry.title}》。\n${entry.content}\n已为你定位到 ${target.cameraId}${
        resolved ? `，并高亮「${resolved.title}」` : ''
      }。\n来源：${entry.sources.join('；')}`,
      citations: [toCitation(entry)],
      toolCalls,
      focus: { objectId: target.objectId, cameraId: target.cameraId, title: entry.title },
      highlightObjectId: target.objectId ?? undefined,
      narration: `档案定位：${entry.title}（${entry.id}）`,
      narrationSourceIds: [entry.id],
    }
  }

  // 5) 一般知识问答
  if (searchResult.length === 0) {
    return {
      text: AGENT_NO_KNOWLEDGE_TEXT,
      citations: [],
      toolCalls,
    }
  }

  const { text, citations } = buildKnowledgeAnswer(searchResult, trimmed)
  toolCalls.push({
    tool: 'show_narration',
    args: { text: `档案回答：${citations[0]?.title ?? ''}`, sourceIds: citations.map((item) => item.id) },
    result: 'narration shown',
  })
  return {
    text: `${text}\n${AGENT_DISCLAIMER}`,
    citations,
    toolCalls,
    narration: citations[0] ? `${citations[0].title}（${citations[0].id}）` : undefined,
    narrationSourceIds: citations.map((item) => item.id),
  }
}

/** 工具参数白名单校验（供未来 LLM 工具调用层复用）。 */
export function validateToolCall(tool: ToolName, args: Record<string, unknown>): { ok: boolean; reason?: string } {
  const definition = AGENT_TOOLS.find((item) => item.name === tool)
  if (!definition) return { ok: false, reason: `未注册的工具：${tool}` }
  if (tool === 'focus_object' || tool === 'highlight_object') {
    const objectId = args.objectId
    if (typeof objectId !== 'string' || !OBJECTS[objectId]) return { ok: false, reason: 'objectId 不在场景白名单内' }
  }
  if (tool === 'request_hint') {
    const level = args.level
    if (level !== 1 && level !== 2 && level !== 3) return { ok: false, reason: 'level 必须是 1/2/3' }
  }
  if (tool === 'list_zone_objects' && args.zoneId !== undefined) {
    const zoneId = args.zoneId
    if (zoneId !== 'zone_study' && zoneId !== 'zone_basement' && zoneId !== 'zone_chamber') {
      return { ok: false, reason: 'zoneId 不在白名单内' }
    }
  }
  return { ok: true }
}
