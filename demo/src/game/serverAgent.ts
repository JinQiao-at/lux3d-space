/**
 * server Agent 接线（可选增强）：探测 FastAPI（/api/health → /api/agent/ask），
 * 可达时回答走真检索（带来源引用与工具建议），不可达时返回 null 由调用方降级本地规则引擎。
 *
 * - server 地址默认 http://127.0.0.1:25432（server/README 的 uvicorn 端口；5182 落在本机 Windows TCP
 *   排除段），可用 VITE_SERVER_URL 覆盖；
 * - 探测结果缓存 30 秒，避免每次提问都探测；
 * - 只读边界不变：server 只返回答案/引用/工具建议，副作用仍由 store 按 AgentReply 执行；
 * - 不可达/超时/异常一律静默返回 null，不打断游戏。
 */
import type { AgentCitation, AgentReply, ToolName } from './agent.ts'
import { OBJECTS } from '../data/scene.ts'

const SERVER_BASE = ((import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://127.0.0.1:25432').replace(
  /\/$/,
  '',
)
const PROBE_TTL_MS = 30_000
const PROBE_TIMEOUT_MS = 1_200
const ASK_TIMEOUT_MS = 4_000

let probe: { ok: boolean; checkedAt: number } | null = null

interface ServerCitation {
  id: string
  title: string
  sources: string[]
  confidence?: string
}

interface ServerToolSuggestion {
  name: string
  arguments: Record<string, unknown>
}

interface ServerAskResponse {
  answer: string
  citations: ServerCitation[]
  suggestedTools: ServerToolSuggestion[]
  grounded: boolean
}

async function fetchJson(path: string, init?: RequestInit, timeoutMs = ASK_TIMEOUT_MS): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${SERVER_BASE}${path}`, { ...init, signal: controller.signal })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function serverAgentAvailable(): Promise<boolean> {
  if (probe && Date.now() - probe.checkedAt < PROBE_TTL_MS) return probe.ok
  const result = await fetchJson('/api/health', undefined, PROBE_TIMEOUT_MS)
  probe = { ok: result !== null, checkedAt: Date.now() }
  return probe.ok
}

/** 请求 server 受控 Agent；不可达/超时返回 null（调用方降级本地引擎）。 */
export async function askServerAgent(
  question: string,
  context: { stage: string; zone: string; lanternLit: boolean; flags: Record<string, boolean> },
): Promise<AgentReply | null> {
  if (!(await serverAgentAvailable())) return null
  const data = (await fetchJson('/api/agent/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      playerState: { stage: context.stage, zone: context.zone, lanternLit: context.lanternLit, flags: context.flags },
    }),
  })) as ServerAskResponse | null
  if (!data || typeof data.answer !== 'string') return null

  const citations: AgentCitation[] = data.citations.map((entry) => ({
    id: entry.id,
    title: entry.title,
    sources: entry.sources,
    confidence: entry.confidence ?? 'inferred',
  }))

  // server 的工具建议映射为本地副作用（与本地 reply 的 focus/highlight/narration 同管道）；
  // cameraId 缺失的建议直接跳过——cameraId 命名无机械规则，不猜测伪造。
  let hintLevel: 1 | 2 | 3 | undefined
  let focus: AgentReply['focus'] | undefined
  let highlightObjectId: string | undefined
  let narration: string | undefined
  let narrationSourceIds: string[] | undefined

  for (const suggestion of data.suggestedTools) {
    const name = suggestion?.name as ToolName
    const args = suggestion?.arguments ?? {}
    switch (name) {
      case 'focus_object': {
        const objectId = typeof args.objectId === 'string' ? args.objectId : null
        const cameraId = typeof args.cameraId === 'string' ? args.cameraId : ''
        if (objectId && cameraId) {
          focus = { objectId, cameraId, title: OBJECTS[objectId]?.name ?? objectId }
        }
        break
      }
      case 'highlight_object': {
        if (typeof args.objectId === 'string') highlightObjectId = args.objectId
        break
      }
      case 'show_narration': {
        if (typeof args.text === 'string') {
          narration = args.text
          narrationSourceIds = Array.isArray(args.sourceIds)
            ? args.sourceIds.filter((id): id is string => typeof id === 'string')
            : undefined
        }
        break
      }
      case 'request_hint': {
        const level = typeof args.level === 'number' ? Math.round(args.level) : 0
        hintLevel = level === 1 ? 1 : level === 2 ? 2 : 3
        break
      }
      default:
        break
    }
  }

  return {
    text: data.answer,
    citations,
    toolCalls: [],
    hintLevel,
    focus,
    highlightObjectId,
    narration,
    narrationSourceIds,
  }
}
