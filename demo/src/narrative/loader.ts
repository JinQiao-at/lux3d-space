/**
 * 剧本加载器（T-027）：import JSON → zod 校验 → 产出类型化剧本。
 *
 * 失败策略（对齐用户规格）：
 * - 校验失败：console.error 输出具体字段与期望，fallback 到内置最小剧本（不白屏、不卡死）；
 * - 字段缺失：zod default 补齐，console.warn 列出补了哪些默认字段；
 * - 篡改（类型不符的非法字段）：zod 报 issue → 按 default 补 → warn，不抛异常。
 */
import rawContent from './narrative-content.json' with { type: 'json' }
import rawAgent from './narrative-agent.json' with { type: 'json' }
import { NarrativeAgentSchema, NarrativeContentSchema, type NarrativeAgent, type NarrativeContent } from './schema.ts'

/** 校验失败时的最小兜底剧本：保证游戏可开、可玩、可结局（白屏防线）。 */
const MINIMAL_CONTENT: NarrativeContent = {
  stageMeta: {},
  openingLines: ['你是被雨声吵醒的。', '这间书房的故事暂时无法加载——但灯还亮着。'],
  zoneEnterLines: {},
  zoneFirstEnterLines: {},
  objectSuccess: {},
  journalEntries: {},
  blockedDefault: '你看了看。什么也没有发生。',
  tapestryHiddenLines: { felt: [], revealed: [] },
  dialWrongTexts: ['顺序不对。铜盘转了回来。'],
  dialFirstTexts: [],
  hints: {},
  ending: { title: '灯还在亮', subtitle: '', lines: ['（剧本数据缺失——这是最小兜底结局。）'], achievement: '' },
  endingVariants: {},
  ambientLines: {},
  hiddenPages: { pages: {}, assembly: { prompt: '', lines: [], achievement: '' } },
  endingStatsLabels: { playTime: '探索用时', hints: '使用提示', zones: '抵达区域', journal: '日记条目' },
  title: '提灯与暗门',
  titleEn: 'The Lantern and the Hidden Door',
  archiveEmptyText: '档案中没有相关记录。',
  agentNoKnowledgeText: '档案中没有记录。我不会为这个问题编造答案。',
  agentDisclaimer: '',
  bookshelfKeyLines: [],
  basinCompartmentLines: [],
  useItemWrongLines: ['这里用不上它。'],
  sceneTexts: {},
  initialFlags: {},
  initialInventory: [],
}

const MINIMAL_AGENT: NarrativeAgent = {
  persona: { role: '档案管理员', tone: '克制、温和、只依据档案回答', tabooWords: [], responseStyle: '' },
  knowledgeBoundaries: {
    archivePath: 'server/app/seed_knowledge.json',
    entryCount: 0,
    rules: [],
    unknownResponse: '档案里没有找到与这个问题相关的记录。',
    groundedTemplate: '',
  },
  llm: {
    provider: 'zhipu',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    temperature: 0.3,
    responseFormat: 'json_object',
    maxTokens: 400,
    timeoutS: 20,
    maxToolRounds: 2,
  },
  fallbackLines: { withHits: '', withHitsProgressAppend: '', progressStages: [], noHits: '档案里没有找到与这个问题相关的记录。' },
  knowledgeEntryIds: [],
}

function reportIssues(source: string, result: { success: boolean; error?: { issues: { path: (string | number | symbol)[]; message: string }[] } }): void {
  for (const issue of result.error?.issues ?? []) {
    console.error(
      `[narrative] ${source} 字段校验失败: path=${issue.path.join('.') || '(root)'} — ${issue.message}（期望见 schema.ts，已按默认值兜底）`,
    )
  }
}

function parseWithReport<T>(
  source: string,
  schema: { safeParse(v: unknown): { success: boolean; data?: T; error?: { issues: { path: (string | number | symbol)[]; message: string }[] } } },
  raw: unknown,
  fallback: T,
): T {
  const result = schema.safeParse(raw)
  if (result.success && result.data !== undefined) {
    // 缺字段被 default 补齐的场景：对比顶层键给出 warn（zod 不区分 default 触发，用键差近似）
    const rawKeys = new Set(Object.keys((raw ?? {}) as object))
    const parsed = result.data as Record<string, unknown>
    const defaulted = Object.keys(parsed).filter((key) => !rawKeys.has(key))
    if (defaulted.length > 0) {
      console.warn(`[narrative] ${source} 缺失字段已按 schema 默认值补齐: ${defaulted.join(', ')}`)
    }
    return result.data
  }
  reportIssues(source, result)
  return fallback
}

export const narrativeContent: NarrativeContent = parseWithReport(
  'narrative-content.json',
  NarrativeContentSchema,
  rawContent,
  MINIMAL_CONTENT,
)

export const narrativeAgent: NarrativeAgent = parseWithReport(
  'narrative-agent.json',
  NarrativeAgentSchema,
  rawAgent,
  MINIMAL_AGENT,
)
