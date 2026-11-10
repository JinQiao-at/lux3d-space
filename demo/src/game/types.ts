/**
 * 《提灯与暗门》全局类型与常量。
 *
 * 设计约束：本文件不依赖 React / three / DOM，可被 Node 的
 * `--experimental-strip-types` 直接加载，供状态机单测使用。
 * 因此这里只允许“可擦除语法”（type/interface/const），不得使用 enum / namespace。
 */

export type Stage =
  | 'arrival'
  | 'find_light'
  | 'light_it'
  | 'descend'
  | 'illuminate'
  | 'solve_dials'
  | 'chamber'
  | 'complete'

/** 主线阶段顺序（assert 式状态机用它保证阶段只前进、不回退）。 */
export const STAGES: readonly Stage[] = [
  'arrival',
  'find_light',
  'light_it',
  'descend',
  'illuminate',
  'solve_dials',
  'chamber',
  'complete',
] as const

export const STAGE_INDEX: Record<Stage, number> = {
  arrival: 0,
  find_light: 1,
  light_it: 2,
  descend: 3,
  illuminate: 4,
  solve_dials: 5,
  chamber: 6,
  complete: 7,
}

export type ZoneId = 'zone_study' | 'zone_basement' | 'zone_chamber'

export const ZONE_IDS: readonly ZoneId[] = ['zone_study', 'zone_basement', 'zone_chamber'] as const

export const ZONE_NAMES: Record<ZoneId, string> = {
  zone_study: '神秘书房',
  zone_basement: '地下室盥洗室',
  zone_chamber: '密室',
}

export type FlagKey =
  | 'clue_diary'
  | 'has_lantern'
  | 'cellar_open'
  | 'saw_secret_outline'
  | 'clue_symbols'
  | 'clue_basin'
  | 'dials_solved'
  | 'secret_open'
  | 'ending_seen'

export const FLAG_KEYS: readonly FlagKey[] = [
  'clue_diary',
  'has_lantern',
  'cellar_open',
  'saw_secret_outline',
  'clue_symbols',
  'clue_basin',
  'dials_solved',
  'secret_open',
  'ending_seen',
] as const

export type ObjectAction = 'inspect' | 'read' | 'search' | 'use' | 'dial'

export type SoundName =
  | 'pickup'
  | 'lantern_on'
  | 'lantern_off'
  | 'stone'
  | 'dial'
  | 'dial_wrong'
  | 'unlock'
  | 'door'
  | 'ending'
  | 'ui'
  | 'hint'
  | 'footstep'
  | 'bell'
  | 'blow'

export type Vec3 = [number, number, number]

export interface JournalEntry {
  id: string
  title: string
  text: string
}

export interface GameSettings {
  sensitivity: number
  volume: number
  quality: 'high' | 'balanced'
}

/** 可被持久化的完整游戏状态（对应 00-brief §4.5 的 store 形状）。 */
export interface GameState {
  version: 1
  stage: Stage
  zone: ZoneId
  position: Vec3
  yaw: number
  inventory: string[]
  lanternLit: boolean
  flags: Record<string, boolean>
  visited: string[]
  journal: JournalEntry[]
  dialOrder: number[]
  hintsUsed: number
  playTime: number
  settings: GameSettings
}

export type Confidence = 'verified' | 'inferred' | 'uncertain'

/** 知识条目（00-brief §4.7；含用户样例 book_A16_023 的全字段扩展）。 */
export interface KnowledgeEntry {
  id: string
  zoneId: ZoneId
  /** 允许为 null：例如“书房空间结构”这类不绑定单一物件的条目（对齐后端 seed）。 */
  objectId: string | null
  cameraId: string
  title: string
  topics: string[]
  content: string
  sources: string[]
  confidence: Confidence
  relatedObjectIds?: string[]
  spoilerLevel?: number
}

/** 对象出现/交互条件；由数据声明，状态机校验，UI 只读复用。 */
export interface ObjectConditions {
  flags?: FlagKey[]
  notFlags?: FlagKey[]
  lanternLit?: boolean
  zone?: ZoneId
}

export interface SceneObjectDef {
  id: string
  zoneId: ZoneId
  name: string
  action: ObjectAction
  /** 交互判定用的世界坐标锚点（玩家视线指向它）。 */
  position: Vec3
  /** 交互半径（米）。 */
  interactDistance: number
  /** 检索结果点击后镜头定位到该相机点。 */
  cameraId: string
  knowledgeIds: string[]
  conditions?: ObjectConditions
  /** 满足条件时才在场景/交互提示中出现（如提灯点亮后的地板暗门）。 */
  visibleWhen?: ObjectConditions
  /** 条件不满足时给出的 Zork 式提示。 */
  blockedText: string
  description: string
  dialValue?: number
}

export interface CameraAnchor {
  id: string
  zoneId: ZoneId
  title: string
  position: Vec3
  lookAt: Vec3
}

export interface Aabb {
  id: string
  min: Vec3
  max: Vec3
}

export interface ZoneDef {
  id: ZoneId
  name: string
  subtitle: string
  bounds: { min: Vec3; max: Vec3 }
  spawn: Vec3
  spawnYaw: number
  colliders: Aabb[]
  objectIds: string[]
  cameraIds: string[]
  /** 进入该 zone 是否强制要求提灯点亮（00-brief §4.3：无灯不可进）。 */
  needsLantern: boolean
  ambient: number
  description: string
}

/** 所有会改变状态的玩家操作。Agent 只能读状态，不能构造这些 action。 */
export type Action =
  | { type: 'inspect'; objectId: string }
  | { type: 'read'; objectId: string }
  | { type: 'search'; objectId: string }
  | { type: 'use'; objectId: string }
  | { type: 'dial'; objectId: string }
  /** T-019：Zork 式物品使用谜题——把背包物品用在物件上（如黄铜钥匙×洗手台）。 */
  | { type: 'use_item_on'; objectId: string; itemId: string }
  | { type: 'toggle_lantern' }
  /** P1-B 双结局：complete 阶段的最终选择（吹灭/守着提灯）。自由旗标，不进 FLAG_KEYS。 */
  | { type: 'blow_lantern' }
  | { type: 'keep_lantern' }
  | { type: 'enter_zone'; zoneId: ZoneId }
  | { type: 'request_hint'; level: 1 | 2 | 3 }
  | { type: 'tick'; seconds: number }
  | { type: 'set_settings'; settings: Partial<GameSettings> }
  | { type: 'reset' }

/** 状态机返回给 UI / 音频 / 镜头层的副作用描述（纯数据，可直接单测）。 */
export type Effect =
  | { kind: 'narration'; text: string }
  | { kind: 'journal'; entry: JournalEntry }
  | { kind: 'sound'; sound: SoundName }
  | { kind: 'stage'; stage: Stage; objective: string }
  | { kind: 'dialShake' }
  | { kind: 'darkness'; text: string }
  | { kind: 'ending' }
  | { kind: 'hint'; level: number; text: string }
  | { kind: 'highlight'; objectId: string; durationMs: number }

export interface ActionResult {
  state: GameState
  effects: Effect[]
  /** 操作是否被接受（条件不满足时为 false，但 state 可能带少量反馈性变化）。 */
  ok: boolean
}

/** 空 flags 表（所有线索/机关标记均为 false）。 */
export function emptyFlags(): Record<string, boolean> {
  const flags: Record<string, boolean> = {}
  for (const key of FLAG_KEYS) flags[key] = false
  return flags
}

export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1,
  volume: 0.7,
  quality: 'balanced',
}

export const SAVE_VERSION = 1 as const

export const SAVE_KEY = 'lux3d.save.v1'
