/**
 * Zustand store：游戏状态（可持久化）+ 运行时 UI 状态（日志/面板/镜头/高亮/Agent）。
 *
 * 约定：所有剧情推进必须经过 dispatch(action) → applyAction 纯函数；
 * 镜头/高亮/面板等表现层状态单独存放，不写入存档。
 */
import { create } from 'zustand'
import type { Action, Effect, GameState, JournalEntry, KnowledgeEntry, Vec3 } from './types.ts'
import { DEFAULT_SETTINGS } from './types.ts'
import { OBJECTS, getCameraAnchor, zoneObjects } from '../data/scene.ts'
import { OPENING_LINES, STAGE_META } from '../data/narrative.ts'
import { applyAction } from './actions.ts'
import {
  clearStorage,
  createInitialState,
  exportFileName,
  loadFromStorage,
  normalizeSave,
  parseSave,
  saveToStorage,
  serializeSave,
} from './save.ts'
import { answerQuestion } from './agent.ts'
import type { AgentCitation, AgentToolCall } from './agent.ts'
import { askServerAgent } from './serverAgent.ts'
import { playSound, setMasterVolume } from './audio.ts'

export type Panel = 'none' | 'journal' | 'archive' | 'agent' | 'pause' | 'ending' | 'map' | 'memory'

export type LogKind = 'narration' | 'system' | 'clue' | 'hint' | 'agent' | 'focus'

export interface LogLine {
  id: number
  text: string
  kind: LogKind
}

export interface FocusTarget {
  cameraId: string
  objectId: string | null
  title: string
  kind: 'knowledge' | 'object' | 'tour'
  entry?: KnowledgeEntry
}

export interface AgentMessage {
  id: number
  role: 'user' | 'agent'
  text: string
  citations?: AgentCitation[]
  tools?: AgentToolCall[]
}

export interface TourStop {
  cameraId: string
  objectId: string | null
  title: string
}

export interface TourState {
  stops: TourStop[]
  index: number
}

export interface InteractionState {
  objectId: string
  /** 条件是否满足；不满足时 HUD 显示“还不行”。 */
  ready: boolean
}

export interface GameStore {
  game: GameState
  started: boolean
  panel: Panel
  log: LogLine[]
  focus: FocusTarget | null
  highlight: { objectId: string; until: number } | null
  dialShakeAt: number
  darknessAt: number
  locked: boolean
  saveExists: boolean
  interaction: InteractionState | null
  tour: TourState | null
  agentMessages: AgentMessage[]
  toast: string | null

  beginNewGame: () => void
  continueGame: () => boolean
  loadGame: (state: GameState, note?: string) => void
  dispatch: (action: Action) => void
  setPanel: (panel: Panel) => void
  openPanel: (panel: Exclude<Panel, 'none'>) => void
  closePanel: () => void
  setLocked: (locked: boolean) => void
  setInteraction: (interaction: InteractionState | null) => void
  syncPose: (position: Vec3, yaw: number) => void
  focusKnowledge: (entry: KnowledgeEntry) => void
  focusObjectId: (objectId: string, durationMs?: number) => void
  focusCamera: (cameraId: string, title: string, objectId?: string | null, entry?: KnowledgeEntry) => void
  clearFocus: () => void
  highlightObject: (objectId: string, durationMs?: number) => void
  tick: (seconds: number) => void
  saveNow: () => boolean
  exportSave: () => { filename: string; json: string }
  importSave: (raw: string) => boolean
  restart: () => void
  updateSettings: (settings: Partial<GameState['settings']>) => void
  askAgent: (question: string) => void
  startTour: () => void
  advanceTour: () => void
  stopTour: () => void
  clearToast: () => void
  pushLog: (text: string, kind?: LogKind) => void
  /** 内部：effects 分发（暴露给类型，便于测试/调试时复用）。 */
  handleEffects: (effects: Effect[]) => void
}

let nextId = 1
const newId = (): number => nextId++

const MAX_LOG = 60

function initialGame(): GameState {
  return createInitialState()
}

function initialSaveExists(): boolean {
  return loadFromStorage() !== null
}

function appendLog(log: LogLine[], text: string, kind: LogKind = 'narration'): LogLine[] {
  const line: LogLine = { id: newId(), text, kind }
  const next = [...log, line]
  return next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next
}

function formatJournalToast(entry: JournalEntry): string {
  return `【日记】${entry.title}`
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: initialGame(),
  started: false,
  panel: 'none',
  log: [],
  focus: null,
  highlight: null,
  dialShakeAt: 0,
  darknessAt: 0,
  locked: false,
  saveExists: initialSaveExists(),
  interaction: null,
  tour: null,
  agentMessages: [],
  toast: null,

  beginNewGame: () => {
    const game = initialGame()
    const log = OPENING_LINES.reduce<LogLine[]>((acc, line) => appendLog(acc, line), [])
    set({
      game,
      started: true,
      panel: 'none',
      log: appendLog(log, `【目标】${STAGE_META[game.stage].objective}`, 'system'),
      focus: null,
      highlight: null,
      interaction: null,
      tour: null,
      toast: '按提示探索：WASD 移动 · 鼠标环视 · E 调查',
    })
    setMasterVolume(game.settings.volume)
    const saved = saveToStorage(game)
    set({ saveExists: saved || get().saveExists })
  },

  continueGame: () => {
    const saved = loadFromStorage()
    if (!saved) return false
    get().loadGame(saved, '载入了上次的存档。')
    return true
  },

  loadGame: (state, note) => {
    const normalized = normalizeSave(state)
    if (!normalized) {
      get().beginNewGame()
      return
    }
    let log: LogLine[] = []
    if (note) log = appendLog(log, note, 'system')
    log = appendLog(log, `【目标】${STAGE_META[normalized.stage].objective}`, 'system')
    set({
      game: normalized,
      started: true,
      panel: 'none',
      log,
      focus: null,
      highlight: null,
      interaction: null,
      tour: null,
      agentMessages: [],
    })
    setMasterVolume(normalized.settings.volume)
    saveToStorage(normalized)
    set({ saveExists: true })
  },

  dispatch: (action) => {
    const current = get().game
    const result = applyAction(current, action)
    if (result.state !== current) {
      set({ game: result.state })
      if (result.state.zone !== current.zone) {
        set({ focus: null, tour: null, interaction: null })
      }
    }
    get().handleEffects(result.effects)
    if (result.state !== current) {
      const saved = saveToStorage(result.state)
      if (saved) set({ saveExists: true })
    }
  },

  setPanel: (panel) => {
    if (panel !== 'none' && typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock()
    }
    set({ panel, interaction: panel === 'none' ? get().interaction : null })
  },

  openPanel: (panel) => {
    get().setPanel(panel)
    playSound('ui')
  },

  closePanel: () => {
    set({ panel: 'none' })
  },

  setLocked: (locked) => {
    set({ locked })
    if (!locked && get().started && get().panel === 'none' && !get().focus) {
      set({ panel: 'pause' })
    }
  },

  setInteraction: (interaction) => {
    const current = get().interaction
    if (
      current?.objectId === interaction?.objectId &&
      current?.ready === interaction?.ready
    ) {
      return
    }
    set({ interaction })
  },

  syncPose: (position, yaw) => {
    const game = get().game
    set({ game: { ...game, position, yaw } })
  },

  focusKnowledge: (entry) => {
    const anchor = getCameraAnchor(entry.cameraId)
    const objectId = entry.objectId ?? entry.relatedObjectIds?.[0] ?? null
    const target: FocusTarget = {
      cameraId: anchor ? entry.cameraId : 'cam_study_desk',
      objectId,
      title: entry.title,
      kind: 'knowledge',
      entry,
    }
    set({ focus: target, panel: 'none', tour: null, interaction: null })
    set({
      log: appendLog(
        get().log,
        `【镜头定位】${entry.title} · [${entry.id}] · 来源：${entry.sources.join('；')}`,
        'focus',
      ),
    })
    if (objectId) get().highlightObject(objectId, 6000)
    playSound('ui')
  },

  focusObjectId: (objectId, durationMs = 5000) => {
    const object = OBJECTS[objectId]
    if (!object) return
    get().focusCamera(object.cameraId, object.name, objectId)
    get().highlightObject(objectId, durationMs)
  },

  focusCamera: (cameraId, title, objectId = null, entry) => {
    if (!getCameraAnchor(cameraId)) return
    set({
      focus: { cameraId, objectId, title, kind: entry ? 'knowledge' : 'object', entry },
      panel: 'none',
      tour: null,
      interaction: null,
    })
    set({ log: appendLog(get().log, `【镜头定位】${title}`, 'focus') })
  },

  clearFocus: () => {
    if (get().focus) {
      set({ focus: null, tour: null })
      set({ log: appendLog(get().log, '你回到自己的视线里。', 'narration') })
    }
  },

  highlightObject: (objectId, durationMs = 4000) => {
    if (!OBJECTS[objectId]) return
    set({ highlight: { objectId, until: Date.now() + Math.min(10000, Math.max(500, durationMs)) } })
  },

  tick: (seconds) => {
    const game = get().game
    set({ game: { ...game, playTime: game.playTime + Math.max(0, seconds) } })
  },

  saveNow: () => {
    const saved = saveToStorage(get().game)
    if (saved) set({ saveExists: true })
    return saved
  },

  exportSave: () => {
    const json = serializeSave(get().game)
    return { filename: exportFileName(), json }
  },

  importSave: (raw) => {
    const parsed = parseSave(raw)
    if (!parsed) return false
    get().loadGame(parsed, '导入存档成功。')
    return true
  },

  restart: () => {
    clearStorage()
    get().beginNewGame()
    set({ panel: 'none', saveExists: true })
  },

  updateSettings: (settings) => {
    const current = get().game
    const result = applyAction(current, { type: 'set_settings', settings })
    set({ game: result.state })
    setMasterVolume(result.state.settings.volume)
    saveToStorage(result.state)
  },

  askAgent: (question) => {
    const game = get().game
    const userMessage: AgentMessage = { id: newId(), role: 'user', text: question }
    set({ agentMessages: [...get().agentMessages, userMessage] })

    // server Agent 接线（可选增强）：FastAPI 可达走真检索（带来源引用），否则降级本地规则引擎；
    // 两条路的回答都只经 AgentReply 副作用管道生效，只读边界不变。
    void (async () => {
      const reply =
        (await askServerAgent(question, {
          stage: game.stage,
          zone: game.zone,
          lanternLit: game.lanternLit,
          flags: game.flags,
        })) ?? answerQuestion(question, { state: game })
      const agentMessage: AgentMessage = {
        id: newId(),
        role: 'agent',
        text: reply.text,
        citations: reply.citations,
        tools: reply.toolCalls,
      }
      set({ agentMessages: [...get().agentMessages, agentMessage] })

      if (reply.hintLevel) {
        get().dispatch({ type: 'request_hint', level: reply.hintLevel })
      }
      if (reply.focus) {
        get().focusCamera(reply.focus.cameraId, reply.focus.title, reply.focus.objectId ?? undefined)
      }
      if (reply.highlightObjectId) {
        get().highlightObject(reply.highlightObjectId, 4000)
      }
      if (reply.narration) {
        set({ log: appendLog(get().log, `【Agent】${reply.narration}`, 'agent') })
      }
      playSound('ui')
    })()
  },

  startTour: () => {
    const game = get().game
    const stops: TourStop[] = [
      { cameraId: 'cam_study_desk', objectId: 'obj_study_desk', title: '书桌与日记' },
      { cameraId: 'cam_study_bookshelf', objectId: 'obj_study_bookshelf', title: '书架暗格' },
    ]
    if (game.flags.cellar_open) {
      stops.push(
        { cameraId: 'cam_basement_shower', objectId: 'obj_basement_shower', title: '淋浴门后的暗门' },
        { cameraId: 'cam_basement_mural', objectId: 'obj_basement_mural', title: '石壁浮雕' },
      )
    }
    if (game.flags.secret_open || game.flags.dials_solved) {
      stops.push({ cameraId: 'cam_chamber_pedestal', objectId: 'obj_chamber_pedestal', title: '密室石台' })
    }
    const first = stops[0]
    set({ tour: { stops, index: 0 }, panel: 'none' })
    set({ focus: { cameraId: first.cameraId, objectId: first.objectId, title: first.title, kind: 'tour' } })
    set({ log: appendLog(get().log, `【导览】第 1/${stops.length} 站：${first.title}`, 'focus') })
    if (first.objectId) get().highlightObject(first.objectId, 5000)
    playSound('ui')
  },

  advanceTour: () => {
    const tour = get().tour
    if (!tour) return
    const nextIndex = tour.index + 1
    if (nextIndex >= tour.stops.length) {
      set({ tour: null, focus: null })
      set({ log: appendLog(get().log, '【导览】结束。你回到自己的视线里。', 'focus') })
      return
    }
    const stop = tour.stops[nextIndex]
    set({ tour: { ...tour, index: nextIndex } })
    set({ focus: { cameraId: stop.cameraId, objectId: stop.objectId, title: stop.title, kind: 'tour' } })
    set({ log: appendLog(get().log, `【导览】第 ${nextIndex + 1}/${tour.stops.length} 站：${stop.title}`, 'focus') })
    if (stop.objectId) get().highlightObject(stop.objectId, 5000)
  },

  stopTour: () => {
    set({ tour: null, focus: null })
  },

  clearToast: () => set({ toast: null }),

  pushLog: (text, kind = 'narration') => {
    set({ log: appendLog(get().log, text, kind) })
  },

  /** 内部：把状态机 effects 分发给音频/镜头/日志/结局面板。 */
  handleEffects: (effects: Effect[]) => {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'narration':
          set({ log: appendLog(get().log, effect.text, 'narration') })
          break
        case 'journal':
          set({ log: appendLog(get().log, formatJournalToast(effect.entry), 'clue'), toast: formatJournalToast(effect.entry) })
          break
        case 'sound':
          playSound(effect.sound)
          break
        case 'stage':
          set({ log: appendLog(get().log, `【目标】${effect.objective}`, 'system') })
          break
        case 'dialShake':
          set({ dialShakeAt: Date.now() })
          break
        case 'darkness':
          set({ darknessAt: Date.now() })
          break
        case 'ending':
          set({ panel: 'ending' })
          break
        case 'hint':
          set({ toast: `提示 L${effect.level}` })
          break
        case 'highlight':
          get().highlightObject(effect.objectId, effect.durationMs)
          break
        default:
          break
      }
    }
  },
}))

// 上一次存档的版本信息：仅用于 UI 提示，不进入 store 状态。
export const SAVE_META = { key: 'lux3d.save.v1', version: 1, settingsDefault: DEFAULT_SETTINGS }

/** 是否处于“黑屏”状态（地下室且提灯未点亮，或刚触发黑暗反馈）。 */
export function isDark(game: GameState, darknessAt: number): boolean {
  if (game.zone === 'zone_basement' && !game.lanternLit) return true
  return Date.now() - darknessAt < 1600
}

/** 当前 zone 的可交互对象（供玩家/HUD 使用）。 */
export function currentZoneObjects(game: GameState) {
  return zoneObjects(game.zone)
}

export { newId as nextLogId }
