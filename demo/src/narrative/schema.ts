/**
 * 叙事剧本 schema（T-027）：按 narrative-content.json / narrative-agent.json 实际结构定义。
 *
 * 原则（对齐用户规格）：
 * - 按 JSON 实际结构建模，不按想象的结构；
 * - 缺失字段用 default()/optional() 补默认值（默认值全部来自现有硬编码迁移源，零编造）；
 * - 冗余/未知字段 passthrough 保留（如 $note/$migratedFrom、seed 的 relatedObjectIds 漂移字段）。
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// narrative-content.json
// ---------------------------------------------------------------------------

export const StageMetaSchema = z.object({
  stage: z.string(),
  title: z.string(),
  objective: z.string(),
})

const JournalEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
})

export const NarrativeContentSchema = z
  .object({
    stageMeta: z.record(z.string(), StageMetaSchema).default({}),
    openingLines: z.array(z.string()).default([]),
    zoneEnterLines: z.record(z.string(), z.array(z.string())).default({}),
    zoneFirstEnterLines: z.record(z.string(), z.array(z.string())).default({}),
    objectSuccess: z.record(z.string(), z.array(z.string())).default({}),
    journalEntries: z.record(z.string(), JournalEntrySchema).default({}),
    blockedDefault: z.string().default('你看了看。什么也没有发生。'),
    tapestryHiddenLines: z
      .object({ felt: z.array(z.string()).default([]), revealed: z.array(z.string()).default([]) })
      .default({ felt: [], revealed: [] }),
    dialWrongTexts: z.array(z.string()).default([]),
    dialFirstTexts: z.array(z.string()).default([]),
    hints: z.record(z.string(), z.tuple([z.string(), z.string(), z.string()])).default({}),
    ending: z
      .object({
        title: z.string().default('灯还在亮'),
        subtitle: z.string().default(''),
        lines: z.array(z.string()).default([]),
        achievement: z.string().default(''),
      })
      .default({ title: '灯还在亮', subtitle: '', lines: [], achievement: '' }),
    // P1-B 双结局变体（keep_lantern / blow_lantern）
    endingVariants: z
      .record(
        z.string(),
        z.object({
          key: z.string(),
          flag: z.string(),
          title: z.string(),
          lines: z.array(z.string()),
          achievement: z.string(),
        }),
      )
      .default({}),
    // P1-B 环境叙事：调查既有物件时一次性追加的静默线索（$note 会被 passthrough 保留）
    ambientLines: z.record(z.string(), z.string()).default({}),
    // T-028 隐藏结局：残页三段调查 + 集齐触发守灯人低语
    hiddenPages: z
      .object({
        pages: z
          .record(
            z.string(),
            z.object({
              flag: z.string(),
              prompt: z.string(),
              lines: z.array(z.string()),
              pageLabel: z.string(),
            }),
          )
          .default({}),
        assembly: z
          .object({ prompt: z.string().default(''), lines: z.array(z.string()).default([]), achievement: z.string().default('') })
          .default({ prompt: '', lines: [], achievement: '' }),
      })
      .default({ pages: {}, assembly: { prompt: '', lines: [], achievement: '' } }),
    // （保持原位）
    endingStatsLabels: z
      .object({ playTime: z.string(), hints: z.string(), zones: z.string(), journal: z.string() })
      .default({ playTime: '探索用时', hints: '使用提示', zones: '抵达区域', journal: '日记条目' }),
    title: z.string().default('提灯与暗门'),
    titleEn: z.string().default('The Lantern and the Hidden Door'),
    archiveEmptyText: z.string().default('档案中没有相关记录。'),
    agentNoKnowledgeText: z.string().default('档案中没有记录。我不会为这个问题编造答案。'),
    agentDisclaimer: z.string().default(''),
    bookshelfKeyLines: z.array(z.string()).default([]),
    basinCompartmentLines: z.array(z.string()).default([]),
    useItemWrongLines: z.array(z.string()).default([]),
    sceneTexts: z
      .record(z.string(), z.object({ name: z.string(), description: z.string(), blockedText: z.string().optional() }))
      .default({}),
    initialFlags: z.record(z.string(), z.boolean()).default({}),
    initialInventory: z.array(z.string()).default([]),
  })
  .passthrough()

export type NarrativeContent = z.infer<typeof NarrativeContentSchema>

// ---------------------------------------------------------------------------
// narrative-agent.json
// ---------------------------------------------------------------------------

export const NarrativeAgentSchema = z
  .object({
    persona: z
      .object({
        role: z.string().default('档案管理员'),
        tone: z.string().default('克制、温和、只依据档案回答'),
        tabooWords: z.array(z.string()).default([]),
        responseStyle: z.string().default(''),
      })
      .default({ role: '档案管理员', tone: '克制、温和、只依据档案回答', tabooWords: [], responseStyle: '' }),
    knowledgeBoundaries: z
      .object({
        archivePath: z.string().default('server/app/seed_knowledge.json'),
        entryCount: z.number().default(0),
        rules: z.array(z.string()).default([]),
        unknownResponse: z.string().default('档案里没有找到与这个问题相关的记录。'),
        groundedTemplate: z.string().default(''),
      })
      .default({
        archivePath: 'server/app/seed_knowledge.json',
        entryCount: 0,
        rules: [],
        unknownResponse: '档案里没有找到与这个问题相关的记录。',
        groundedTemplate: '',
      }),
    llm: z
      .object({
        provider: z.string().default('zhipu'),
        apiUrl: z.string().default('https://open.bigmodel.cn/api/paas/v4/chat/completions'),
        model: z.string().default('glm-4-flash'),
        temperature: z.number().default(0.3),
        responseFormat: z.string().default('json_object'),
        maxTokens: z.number().default(400),
        timeoutS: z.number().default(20),
        maxToolRounds: z.number().default(2),
      })
      .default({
        provider: 'zhipu',
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        model: 'glm-4-flash',
        temperature: 0.3,
        responseFormat: 'json_object',
        maxTokens: 400,
        timeoutS: 20,
        maxToolRounds: 2,
      }),
    fallbackLines: z
      .object({
        withHits: z.string().default(''),
        withHitsProgressAppend: z.string().default(''),
        progressStages: z.array(z.string()).default([]),
        noHits: z.string().default('档案里没有找到与这个问题相关的记录。'),
      })
      .default({
        withHits: '',
        withHitsProgressAppend: '',
        progressStages: [],
        noHits: '档案里没有找到与这个问题相关的记录。',
      }),
    knowledgeEntryIds: z.array(z.string()).default([]),
  })
  .passthrough()

export type NarrativeAgent = z.infer<typeof NarrativeAgentSchema>
