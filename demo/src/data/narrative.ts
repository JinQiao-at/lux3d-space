/**
 * 叙事数据（T-027 改造为读取器壳）：本文件仍是全部消费者的 import 路径与类型来源，
 * 但数据本体已迁至 narrative-content.json（唯一剧本源），经 loader.ts zod 校验后在此 re-export。
 *
 * 文风约定（T-015）：第二人称、短句、具体感官，冷峻克制；留白优先于抒情。
 * 机制约束：本文件只提供文本数据。7 步 stage、9 个 flags、lanternLit 语义不得在此改变。
 */
import type { JournalEntry, Stage, ZoneId } from '../game/types.ts'
import { narrativeContent } from '../narrative/loader.ts'

export interface StageMeta {
  stage: Stage
  title: string
  objective: string
}

export const STAGE_META: Record<Stage, StageMeta> = narrativeContent.stageMeta as Record<Stage, StageMeta>

export const OPENING_LINES: string[] = narrativeContent.openingLines

export const ZONE_ENTER_LINES: Record<ZoneId, string[]> = narrativeContent.zoneEnterLines as Record<ZoneId, string[]>

/** 首次进入 zone 的描写（T-019，Zork「房间描述」机制）；书房首屏由 OPENING_LINES 承担。 */
export const ZONE_FIRST_ENTER_LINES: Record<ZoneId, string[]> = narrativeContent.zoneFirstEnterLines as Record<
  ZoneId,
  string[]
>

/** 条件满足时的对象调查文案（成功路径）。 */
export const OBJECT_SUCCESS: Record<string, string[]> = narrativeContent.objectSuccess

/** 日记条目（key 为稳定 id，与 state.journal[].id 对应）。 */
export const JOURNAL_ENTRIES: Record<string, JournalEntry> = narrativeContent.journalEntries as Record<
  string,
  JournalEntry
>

export const BLOCKED_DEFAULT = narrativeContent.blockedDefault

/** B2 支线：密室挂毯背面硬物（两段 search；旗标 tapestry_looked 为自由键，不持久化——与 basin_compartment_open 同款约定）。 */
export const TAPESTRY_HIDDEN_LINES: { felt: string[]; revealed: string[] } = narrativeContent.tapestryHiddenLines

export const DIAL_WRONG_TEXTS: string[] = narrativeContent.dialWrongTexts

export const DIAL_FIRST_TEXTS: string[] = narrativeContent.dialFirstTexts

/** 三级提示：每 stage 三条，逐级具体。 */
export const HINTS: Record<Stage, readonly [string, string, string]> = narrativeContent.hints as Record<
  Stage,
  readonly [string, string, string]
>

export interface EndingData {
  title: string
  subtitle: string
  lines: string[]
  achievement: string
}

export const ENDING: EndingData = narrativeContent.ending

/** P1-B 双结局变体：complete 阶段吹灯/守灯的分支文案（键：kept | blew）。 */
export const ENDING_VARIANTS: Record<
  string,
  { key: string; flag: string; title: string; lines: string[]; achievement: string }
> = narrativeContent.endingVariants

/** P1-B 环境叙事：调查既有物件时一次性追加的静默线索（objectId → 一句话）。 */
export const AMBIENT_LINES: Record<string, string> = narrativeContent.ambientLines

export interface HiddenPage {
  flag: string
  prompt: string
  lines: string[]
  pageLabel: string
}

/** T-028 隐藏结局：残页三段调查（objectId → 页数据）与集齐触发语。 */
export const HIDDEN_PAGES: Record<string, HiddenPage> = narrativeContent.hiddenPages.pages
export const HIDDEN_PAGES_ASSEMBLY: { prompt: string; lines: string[]; achievement: string } =
  narrativeContent.hiddenPages.assembly
/** 集齐所需的残页旗标清单（由 JSON 推导）。 */
export const HIDDEN_PAGE_FLAGS: string[] = Object.values(HIDDEN_PAGES).map((page) => page.flag)

export const ENDING_STATS_LABELS = narrativeContent.endingStatsLabels

export const TITLE = narrativeContent.title
export const TITLE_EN = narrativeContent.titleEn

export const ARCHIVE_EMPTY_TEXT = narrativeContent.archiveEmptyText
export const AGENT_NO_KNOWLEDGE_TEXT = narrativeContent.agentNoKnowledgeText
export const AGENT_DISCLAIMER = narrativeContent.agentDisclaimer

/** T-019 支线：持灯后再次搜索书架，暗格绒布下压着一枚黄铜钥匙。 */
export const BOOKSHELF_KEY_LINES: string[] = narrativeContent.bookshelfKeyLines

/** T-019 支线：黄铜钥匙 × 洗手台安装孔（use_item_on 成功）。 */
export const BASIN_COMPARTMENT_LINES: string[] = narrativeContent.basinCompartmentLines

/** T-019 支线：错误的物品组合（温和失败，不消耗物品）。 */
export const USE_ITEM_WRONG_LINES: string[] = narrativeContent.useItemWrongLines
