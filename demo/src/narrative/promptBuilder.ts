/**
 * system prompt 拼装器（T-027）：按 narrative-agent.json 的角色/边界/记忆/场景
 * 动态拼 system prompt，顺序对齐用户规格：红线 → 人设 → 边界 → 记忆 → 场景 → 玩家态 → 输入。
 *
 * - 记忆段：knowledgeEntryIds + 条目标题摘要（标题由调用方传入或按 id 列出）；
 * - unknown 判定放代码层：keywordsHit() 做条目 title/topics 词面匹配，
 *   全部未命中 → 回答用 unknownResponse 原话，不依赖模型自觉；
 * - 与 server/app/agent.py 的拼装结果保持同构（python 侧同规则实现）。
 */
import { narrativeAgent } from './loader.ts'

export interface PromptPlayerState {
  stage: string
  zone: string
  lanternLit: boolean
}

export interface PromptEntrySummary {
  id: string
  title: string
  topics?: string[]
}

const GROUNDING_RULE = '只依据检索到的知识条目回答，不要编造。'

/** 红线段：不可逾越的只读与不编造约束。 */
function buildGrounding(): string {
  return `你是${narrativeAgent.persona.role}。${GROUNDING_RULE}`
}

/** 人设段：角色 + 语气 + 回答风格。 */
function buildPersona(): string {
  const { role, tone, responseStyle, tabooWords } = narrativeAgent.persona
  const lines = [`人设：${role}。语气：${tone}。`]
  if (responseStyle) lines.push(`回答风格：${responseStyle}。`)
  if (tabooWords.length > 0) lines.push(`禁词：${tabooWords.join('、')}。`)
  return lines.join('\n')
}

/** 边界段：知识边界规则 + 档案范围 + unknown 兜底。 */
function buildBoundaries(): string {
  const { rules, unknownResponse, entryCount } = narrativeAgent.knowledgeBoundaries
  const lines = [`知识边界：档案共 ${entryCount} 条（${narrativeAgent.knowledgeEntryIds.slice(0, 6).join('、')} 等）。`]
  for (const rule of rules) lines.push(`- ${rule}`)
  lines.push(`无命中时的固定回答（原话输出）：「${unknownResponse}」`)
  return lines.join('\n')
}

/** 记忆段：档案条目清单（id+标题），供模型引用与对齐。 */
function buildMemory(entries: PromptEntrySummary[]): string {
  if (entries.length === 0) return `记忆：知识条目清单见检索结果（${narrativeAgent.knowledgeEntryIds.length} 条）。`
  return `记忆（档案条目清单）：\n${entries.map((entry) => `- ${entry.id}：《${entry.title}》${entry.topics?.length ? `（${entry.topics.join('/')}）` : ''}`).join('\n')}`
}

/** 场景段：当前 zone 与可引导对象（轻量，详细场景数据留在 scene.ts 工程层）。 */
function buildScene(playerState: PromptPlayerState): string {
  return `场景：玩家当前在 ${playerState.zone}；需要引导玩家视线时建议 focus_object / highlight_object。`
}

/** 玩家态段：只读状态摘要（stage/zone/提灯），用于防剧透与进度相关回答。 */
function buildPlayerState(playerState: PromptPlayerState): string {
  return `玩家态（只读）：stage=${playerState.stage}，zone=${playerState.zone}，提灯${playerState.lanternLit ? '已点亮' : '未点亮'}。不剧透玩家尚未到达的进度。`
}

/** 输入段：本轮玩家问题与检索命中的条目 id。 */
function buildInput(question: string, hitIds: string[]): string {
  const hits = hitIds.length > 0 ? `检索命中条目：${hitIds.join('、')}。` : '检索命中条目：无。'
  return `玩家输入：「${question}」\n${hits}`
}

/**
 * 拼 system prompt（不含本轮输入；输入走 messages 的 user/tool 消息）。
 * 顺序：红线 → 人设 → 边界 → 记忆 → 场景 → 玩家态。
 */
export function buildSystemPrompt(entries: PromptEntrySummary[], playerState: PromptPlayerState): string {
  return [buildGrounding(), buildPersona(), buildBoundaries(), buildMemory(entries), buildScene(playerState), buildPlayerState(playerState)].join('\n\n')
}

/** 拼完整首轮消息（system + user，含输入段）。 */
export function buildFirstMessages(question: string, entries: PromptEntrySummary[], hitIds: string[], playerState: PromptPlayerState): { system: string; user: string } {
  return {
    system: buildSystemPrompt(entries, playerState),
    user: buildInput(question, hitIds),
  }
}

/**
 * unknown 判定（代码层，不依赖模型自觉）：
 * 问题词面与任一条目的 title/topics 存在公共词（≥2 字的中文连续子串或英文词）即视为命中。
 * 全部未命中 → 调用方应直接输出 unknownResponse 并记录命中路径。
 */
export function keywordsHit(question: string, entries: PromptEntrySummary[]): { hit: boolean; matchedIds: string[] } {
  const normalized = question.toLowerCase()
  const matchedIds: string[] = []
  for (const entry of entries) {
    const surfaces = [entry.title, ...(entry.topics ?? [])]
    for (const surface of surfaces) {
      const clean = surface.toLowerCase().replace(/[《》·—：:，,。]/g, '')
      if (clean.length >= 2 && normalized.includes(clean.slice(0, Math.min(clean.length, 8)))) {
        matchedIds.push(entry.id)
        break
      }
    }
  }
  return { hit: matchedIds.length > 0, matchedIds }
}
