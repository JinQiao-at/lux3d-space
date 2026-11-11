/**
 * 断言式状态机：applyAction(state, action) -> { state, effects, ok } 纯函数。
 *
 * 设计要点（00-brief §4.5）：
 * - 这是唯一的剧情推进入口；UI 只能 dispatch Action，Agent 不得直接改 stage/flags/inventory。
 * - 阶段只前进不回退（STAGE_INDEX 单调），条件不满足时操作被拒绝并给出 Zork 式反馈。
 * - 所有副作用（音效、镜头、日志、日记）以 Effect[] 形式返回，方便单测断言。
 */
import type {
  Action,
  ActionResult,
  Effect,
  GameState,
  SceneObjectDef,
  Stage,
  ZoneId,
} from './types.ts'
import { STAGE_INDEX } from './types.ts'
import { DIAL_SEQUENCE, OBJECTS, ZONES, spawnPose } from '../data/scene.ts'
import {
  BASIN_COMPARTMENT_LINES,
  BLOCKED_DEFAULT,
  BOOKSHELF_KEY_LINES,
  DIAL_FIRST_TEXTS,
  DIAL_WRONG_TEXTS,
  HINTS,
  JOURNAL_ENTRIES,
  OBJECT_SUCCESS,
  AMBIENT_LINES,
  ENDING_VARIANTS,
  HIDDEN_PAGES,
  HIDDEN_PAGE_FLAGS,
  HIDDEN_PAGES_ASSEMBLY,
  TAPESTRY_HIDDEN_LINES,
  STAGE_META,
  USE_ITEM_WRONG_LINES,
  ZONE_ENTER_LINES,
  ZONE_FIRST_ENTER_LINES,
} from '../data/narrative.ts'
import { conditionsMet } from './interaction.ts'
import { createInitialState } from './save.ts'

function cloneState(state: GameState): GameState {
  return structuredClone(state)
}

function narrate(effects: Effect[], lines: string | string[] | undefined): void {
  if (!lines) return
  const list = Array.isArray(lines) ? lines : [lines]
  for (const line of list) {
    if (line.trim().length > 0) effects.push({ kind: 'narration', text: line })
  }
}

function recordJournal(state: GameState, effects: Effect[], entryId: string): void {
  const entry = JOURNAL_ENTRIES[entryId]
  if (!entry) return
  if (state.journal.some((item) => item.id === entryId)) return
  state.journal = [...state.journal, entry]
  effects.push({ kind: 'journal', entry })
}

/** 阶段推进（只前进、不回退），并附带 HUD 目标更新 effect。 */
function advanceStage(state: GameState, target: Stage, effects: Effect[]): boolean {
  if (STAGE_INDEX[target] <= STAGE_INDEX[state.stage]) return false
  state.stage = target
  effects.push({ kind: 'stage', stage: target, objective: STAGE_META[target].objective })
  return true
}

function pushStageObjective(state: GameState, effects: Effect[]): void {
  effects.push({ kind: 'stage', stage: state.stage, objective: STAGE_META[state.stage].objective })
}

function enterZone(state: GameState, zoneId: ZoneId, effects: Effect[]): boolean {
  const zone = ZONES[zoneId]
  if (zoneId === state.zone) return true

  if (zone.needsLantern && !state.lanternLit) {
    effects.push({ kind: 'darkness', text: '你伸出去的手什么也摸不到。没有灯，你不敢往下走。' })
    narrate(effects, '黑暗像一堵实心的墙。你退回了光里——先想办法点亮提灯。')
    return false
  }
  if (zoneId === 'zone_basement' && !state.flags.cellar_open) {
    narrate(effects, '地板暗门还关着。')
    return false
  }
  if (zoneId === 'zone_chamber' && !state.flags.secret_open) {
    narrate(effects, '暗门还没打开。')
    return false
  }
  if (zoneId === 'zone_study' && !state.flags.cellar_open) {
    narrate(effects, '你已经在书房里了。')
    return true
  }

  const pose = spawnPose(zoneId)
  const firstVisit = !state.visited.includes(zoneId)
  state.zone = zoneId
  state.position = pose.position
  state.yaw = pose.yaw
  if (firstVisit) state.visited = [...state.visited, zoneId]
  // T-019：Zork 式房间描述——首访与重访使用不同文案表
  narrate(effects, firstVisit ? ZONE_FIRST_ENTER_LINES[zoneId] : ZONE_ENTER_LINES[zoneId])
  effects.push({ kind: 'sound', sound: 'door' })

  if (zoneId === 'zone_basement') advanceStage(state, 'illuminate', effects)
  if (zoneId === 'zone_chamber') advanceStage(state, 'chamber', effects)
  return true
}

type InteractionOutcome = { ok: boolean; state: GameState; effects: Effect[] }

function interact(state: GameState, objectId: string): InteractionOutcome {
  const effects: Effect[] = []
  const object = OBJECTS[objectId]
  if (!object) {
    narrate(effects, '这里没有可以调查的东西。')
    return { ok: false, state, effects }
  }
  if (object.zoneId !== state.zone) {
    narrate(effects, '那不在这里。')
    return { ok: false, state, effects }
  }
  if (object.action === 'dial') {
    return dial(state, object)
  }
  if (!conditionsMet(object.visibleWhen, state) || !conditionsMet(object.conditions, state)) {
    narrate(effects, object.blockedText || BLOCKED_DEFAULT)
    effects.push({ kind: 'sound', sound: 'ui' })
    return { ok: false, state, effects }
  }

  switch (objectId) {
    case 'obj_study_desk':
    case 'obj_study_diary': {
      narrate(effects, objectId === 'obj_study_diary' ? OBJECT_SUCCESS.obj_study_diary : OBJECT_SUCCESS.obj_study_desk)
      effects.push({ kind: 'sound', sound: 'ui' })
      if (!state.flags.clue_diary) {
        state.flags = { ...state.flags, clue_diary: true }
        recordJournal(state, effects, 'diary_half')
        advanceStage(state, 'find_light', effects)
      }
      return { ok: true, state, effects }
    }

    case 'obj_study_bookshelf': {
      narrate(effects, OBJECT_SUCCESS.obj_study_bookshelf)
      if (!state.flags.has_lantern) {
        state.flags = { ...state.flags, has_lantern: true }
        if (!state.inventory.includes('lantern')) state.inventory = [...state.inventory, 'lantern']
        recordJournal(state, effects, 'lantern_found')
        // 灯座刻着三符号：顺手把「ECO 三符号」这一页收进日记（不涉及 stage/flags）
        recordJournal(state, effects, 'eco_three_symbols')
        advanceStage(state, 'light_it', effects)
        effects.push({ kind: 'sound', sound: 'pickup' })
      } else {
        // T-019 支线：持灯后再次搜索暗格，绒布夹层里还有一枚黄铜钥匙（不动 stage/主线 flags）
        if (!state.inventory.includes('brass_key')) {
          state.inventory = [...state.inventory, 'brass_key']
          narrate(effects, BOOKSHELF_KEY_LINES)
          effects.push({ kind: 'sound', sound: 'pickup' })
        } else {
          narrate(effects, '暗格已经空了。提灯在你手里，钥匙也在你手里。')
          effects.push({ kind: 'sound', sound: 'ui' })
        }
      }
      return { ok: true, state, effects }
    }

    case 'obj_study_fireplace': {
      narrate(effects, OBJECT_SUCCESS.obj_study_fireplace)
      recordJournal(state, effects, 'hearth_inscription')
      if (!state.lanternLit) narrate(effects, '炉膛很暗。你需要先把提灯点亮。')
      effects.push({ kind: 'sound', sound: 'stone' })
      return { ok: true, state, effects }
    }

    case 'obj_study_floor_door': {
      if (!state.flags.cellar_open) {
        state.flags = { ...state.flags, cellar_open: true }
        narrate(effects, OBJECT_SUCCESS.obj_study_floor_door)
        // 掀开地板的那一刻，你确认了这间屋子有上一任屋主（纯日记，不改 stage/flags）
        recordJournal(state, effects, 'previous_owner')
        effects.push({ kind: 'sound', sound: 'door' })
      }
      const ok = enterZone(state, 'zone_basement', effects)
      return { ok, state, effects }
    }

    case 'obj_study_mirror': {
      narrate(effects, OBJECT_SUCCESS.obj_study_mirror)
      recordJournal(state, effects, 'mirror_echo')
      effects.push({ kind: 'sound', sound: 'bell' }) // T-025：镜子叙事的核心意象「三声钟响」首次有了声音
      return { ok: true, state, effects }
    }

    case 'obj_study_painting': {
      narrate(effects, OBJECT_SUCCESS.obj_study_painting)
      recordJournal(state, effects, 'previous_owner')
      effects.push({ kind: 'sound', sound: 'ui' })
      return { ok: true, state, effects }
    }

    case 'obj_basement_stairs': {
      const ok = enterZone(state, 'zone_study', effects)
      return { ok, state, effects }
    }

    case 'obj_basement_shower': {
      narrate(effects, OBJECT_SUCCESS.obj_basement_shower)
      if (!state.flags.saw_secret_outline) {
        state.flags = { ...state.flags, saw_secret_outline: true }
        recordJournal(state, effects, 'outline_seen')
      }
      effects.push({ kind: 'sound', sound: 'stone' })
      return { ok: true, state, effects }
    }

    case 'obj_basement_mural': {
      narrate(effects, OBJECT_SUCCESS.obj_basement_mural)
      if (!state.flags.clue_symbols) {
        state.flags = { ...state.flags, clue_symbols: true }
        recordJournal(state, effects, 'mural_symbols')
      }
      effects.push({ kind: 'sound', sound: 'stone' })
      if (state.flags.clue_basin) advanceStage(state, 'solve_dials', effects)
      return { ok: true, state, effects }
    }

    case 'obj_basement_basin': {
      narrate(effects, OBJECT_SUCCESS.obj_basement_basin)
      if (!state.flags.clue_basin) {
        state.flags = { ...state.flags, clue_basin: true }
        recordJournal(state, effects, 'basin_inscription')
      }
      effects.push({ kind: 'sound', sound: 'stone' })
      if (state.flags.clue_symbols) advanceStage(state, 'solve_dials', effects)
      return { ok: true, state, effects }
    }

    case 'obj_basement_secret_door': {
      if (!state.flags.dials_solved) {
        narrate(effects, object.blockedText)
        return { ok: false, state, effects }
      }
      narrate(effects, OBJECT_SUCCESS.obj_basement_secret_door)
      state.flags = { ...state.flags, secret_open: true }
      recordJournal(state, effects, 'secret_opened')
      // 暗门的来历：配重、错序余量、上一任屋主的反复尝试（纯日记，不改 stage/flags）
      recordJournal(state, effects, 'secret_door_origin')
      effects.push({ kind: 'sound', sound: 'unlock' })
      const ok = enterZone(state, 'zone_chamber', effects)
      return { ok, state, effects }
    }

    case 'obj_chamber_pedestal': {
      narrate(effects, OBJECT_SUCCESS.obj_chamber_pedestal)
      effects.push({ kind: 'sound', sound: 'ending' })
      if (!state.flags.ending_seen) {
        state.flags = { ...state.flags, ending_seen: true }
        recordJournal(state, effects, 'chamber_ending')
        advanceStage(state, 'complete', effects)
        effects.push({ kind: 'ending' })
      }
      return { ok: true, state, effects }
    }

    case 'obj_chamber_tapestry': {
      narrate(effects, OBJECT_SUCCESS.obj_chamber_tapestry)
      // B2 支线：挂毯背面硬物（两段 search；自由旗标不持久化，与 basin_compartment_open 同款约定）
      if (!state.flags.tapestry_looked) {
        state.flags = { ...state.flags, tapestry_looked: true }
        narrate(effects, TAPESTRY_HIDDEN_LINES.felt)
        effects.push({ kind: 'sound', sound: 'ui' })
        return { ok: true, state, effects }
      }
      narrate(effects, TAPESTRY_HIDDEN_LINES.revealed)
      effects.push({ kind: 'sound', sound: 'stone' })
      return { ok: true, state, effects }
    }

    default: {
      narrate(effects, object.description)
      effects.push({ kind: 'sound', sound: 'ui' })
      return { ok: true, state, effects }
    }
  }
}

function dial(state: GameState, object: SceneObjectDef): InteractionOutcome {
  const effects: Effect[] = []
  if (!conditionsMet(object.conditions, state)) {
    narrate(effects, object.blockedText || BLOCKED_DEFAULT)
    effects.push({ kind: 'sound', sound: 'ui' })
    return { ok: false, state, effects }
  }
  if (state.flags.dials_solved) {
    narrate(effects, '三个铜盘已经对齐，机关解开了。')
    return { ok: true, state, effects }
  }
  if (object.dialValue === undefined) {
    return { ok: false, state, effects }
  }

  const nextOrder = [...state.dialOrder, object.dialValue]
  state.dialOrder = nextOrder
  effects.push({ kind: 'sound', sound: 'dial' })
  narrate(effects, object.description)

  if (nextOrder.length < 3) {
    narrate(effects, DIAL_FIRST_TEXTS[nextOrder.length - 1] ?? '铜盘转过一格。')
    return { ok: true, state, effects }
  }

  const solved = nextOrder.length === DIAL_SEQUENCE.length && nextOrder.every((value, index) => value === DIAL_SEQUENCE[index])
  if (solved) {
    state.flags = { ...state.flags, dials_solved: true }
    narrate(effects, DIAL_FIRST_TEXTS[2])
    narrate(effects, '东墙上传来闷响——暗门向内让开一道缝。')
    effects.push({ kind: 'sound', sound: 'unlock' })
    advanceStage(state, 'chamber', effects)
    return { ok: true, state, effects }
  }

  const attempt = nextOrder.reduce((sum, value) => sum + value, 0)
  const text = DIAL_WRONG_TEXTS[attempt % DIAL_WRONG_TEXTS.length] ?? DIAL_WRONG_TEXTS[0]
  state.dialOrder = []
  narrate(effects, text)
  effects.push({ kind: 'sound', sound: 'dial_wrong' })
  effects.push({ kind: 'dialShake' })
  return { ok: true, state, effects }
}

/**
 * T-019：Zork 式物品使用谜题（inventory-use）。
 * 把背包物品用在物件上：正确组合触发支线；错误组合温和失败、不消耗物品；
 * 本机制不动 stage 与主线 9 flags（支线旗标走非 FLAG_KEYS 的自由键）。
 */
function useItemOn(state: GameState, objectId: string, itemId: string): InteractionOutcome {
  const effects: Effect[] = []
  const object = OBJECTS[objectId]
  if (!object || object.zoneId !== state.zone) {
    narrate(effects, '那不在这里。')
    return { ok: false, state, effects }
  }
  if (!state.inventory.includes(itemId)) {
    narrate(effects, '你的背包里没有这样东西。')
    effects.push({ kind: 'sound', sound: 'ui' })
    return { ok: false, state, effects }
  }

  if (objectId === 'obj_basement_basin' && itemId === 'brass_key') {
    if (state.flags.basin_compartment_open) {
      narrate(effects, '暗格开着。里面的纸你已经取读过了。')
      return { ok: true, state, effects }
    }
    state.flags = { ...state.flags, basin_compartment_open: true }
    narrate(effects, BASIN_COMPARTMENT_LINES)
    effects.push({ kind: 'sound', sound: 'unlock' })
    return { ok: true, state, effects }
  }

  narrate(effects, USE_ITEM_WRONG_LINES)
  effects.push({ kind: 'sound', sound: 'ui' })
  return { ok: false, state, effects }
}

function toggleLantern(state: GameState): InteractionOutcome {
  const effects: Effect[] = []
  if (!state.flags.has_lantern || !state.inventory.includes('lantern')) {
    narrate(effects, '你手上还没有能点亮的东西。')
    effects.push({ kind: 'sound', sound: 'ui' })
    return { ok: false, state, effects }
  }

  if (!state.lanternLit) {
    state.lanternLit = true
    narrate(effects, [
      '灯芯“噗”地一声亮了。',
      '暖黄色的光从灯罩里漫出来，把最近的一圈地板照得发白。',
    ])
    if (state.zone === 'zone_study' && !state.flags.cellar_open) {
      // 方位以实际场景坐标为准：地板暗门在书房西侧（x=-2.4），炉火正对着它
      narrate(effects, '炉火正对的那面墙根，地板边缘浮出一圈细细的缝隙。')
    }
    effects.push({ kind: 'sound', sound: 'lantern_on' })
    if (state.stage === 'light_it') advanceStage(state, 'descend', effects)
    return { ok: true, state, effects }
  }

  state.lanternLit = false
  narrate(effects, ['你拧灭灯芯。黑暗立刻合拢上来，只剩灯罩一点余温。'])
  effects.push({ kind: 'sound', sound: 'lantern_off' })
  if (state.zone === 'zone_basement') {
    effects.push({ kind: 'darkness', text: '黑暗像水一样漫过脚踝。你几乎立刻后悔了。' })
  }
  return { ok: true, state, effects }
}

function requestHint(state: GameState, level: 1 | 2 | 3): InteractionOutcome {
  const effects: Effect[] = []
  const hints = HINTS[state.stage]
  const text = hints[level - 1] ?? hints[0]
  state.hintsUsed += 1
  effects.push({ kind: 'hint', level, text })
  narrate(effects, [`【提示 L${level}】${text}`])
  effects.push({ kind: 'sound', sound: 'hint' })
  return { ok: true, state, effects }
}

function updateSettings(state: GameState, settings: Partial<GameState['settings']>): InteractionOutcome {
  const effects: Effect[] = []
  const merged = { ...state.settings, ...settings }
  merged.sensitivity = Math.min(2, Math.max(0.2, merged.sensitivity))
  merged.volume = Math.min(1, Math.max(0, merged.volume))
  if (merged.quality !== 'high' && merged.quality !== 'balanced') merged.quality = 'balanced'
  state.settings = merged
  return { ok: true, state, effects }
}

/** 唯一的状态入口。纯函数：不修改入参 state，返回新状态。 */
export function applyAction(state: GameState, action: Action): ActionResult {
  switch (action.type) {
    case 'inspect':
    case 'read':
    case 'search':
    case 'use': {
      const next = cloneState(state)
      const outcome = interact(next, action.objectId)
      // P1-B 环境叙事：调查成功后一次性追加静默线索（自由键不持久化——每次会话可再触发）
      if (outcome.ok) {
        const ambientKey = `ambient_seen_${action.objectId}`
        const ambient = AMBIENT_LINES[action.objectId]
        if (ambient && !next.flags[ambientKey]) {
          next.flags = { ...next.flags, [ambientKey]: true }
          outcome.effects.push({ kind: 'narration', text: ambient })
        }
        // T-028 隐藏结局：二次调查同一物件触发残页（自由键 hidden_page_*）
        const page = HIDDEN_PAGES[action.objectId]
        if (page) {
          const firstVisitKey = `searched_once_${action.objectId}`
          if (!next.flags[firstVisitKey]) {
            next.flags = { ...next.flags, [firstVisitKey]: true }
          } else if (!next.flags[page.flag]) {
            next.flags = { ...next.flags, [page.flag]: true }
            narrate(outcome.effects, page.prompt)
            narrate(outcome.effects, page.lines)
            outcome.effects.push({ kind: 'sound', sound: 'hint' })
          }
        }
        // 集齐判定独立于残页发放：三页全在手、且本次调查尚未触发过 → 守灯人低语（一次性）
        if (
          HIDDEN_PAGE_FLAGS.length > 0 &&
          HIDDEN_PAGE_FLAGS.every((key) => next.flags[key]) &&
          !next.flags.hidden_assembly_done
        ) {
          next.flags = { ...next.flags, hidden_assembly_done: true }
          narrate(outcome.effects, HIDDEN_PAGES_ASSEMBLY.prompt)
          narrate(outcome.effects, HIDDEN_PAGES_ASSEMBLY.lines)
          narrate(outcome.effects, HIDDEN_PAGES_ASSEMBLY.achievement)
          outcome.effects.push({ kind: 'sound', sound: 'bell' })
        }
      }
      return { state: outcome.state, effects: outcome.effects, ok: outcome.ok }
    }
    case 'dial': {
      const next = cloneState(state)
      const object = OBJECTS[action.objectId]
      if (!object || object.zoneId !== next.zone) {
        const effects: Effect[] = []
        narrate(effects, '这里没有可以拨动的东西。')
        return { state: next, effects, ok: false }
      }
      const outcome = dial(next, object)
      return { state: outcome.state, effects: outcome.effects, ok: outcome.ok }
    }
    case 'use_item_on': {
      const next = cloneState(state)
      const outcome = useItemOn(next, action.objectId, action.itemId)
      return { state: outcome.state, effects: outcome.effects, ok: outcome.ok }
    }
    case 'toggle_lantern': {
      const next = cloneState(state)
      const outcome = toggleLantern(next)
      return { state: outcome.state, effects: outcome.effects, ok: outcome.ok }
    }
    case 'enter_zone': {
      const next = cloneState(state)
      const effects: Effect[] = []
      const ok = enterZone(next, action.zoneId, effects)
      return { state: next, effects, ok }
    }
    case 'request_hint': {
      if (action.level !== 1 && action.level !== 2 && action.level !== 3) {
        return { state: cloneState(state), effects: [], ok: false }
      }
      const next = cloneState(state)
      const outcome = requestHint(next, action.level)
      return { state: outcome.state, effects: outcome.effects, ok: outcome.ok }
    }
    case 'tick': {
      const next = cloneState(state)
      next.playTime += Math.max(0, action.seconds)
      return { state: next, effects: [], ok: true }
    }
    case 'set_settings': {
      const next = cloneState(state)
      const outcome = updateSettings(next, action.settings)
      return { state: outcome.state, effects: outcome.effects, ok: outcome.ok }
    }
    case 'reset': {
      return { state: createInitialState(), effects: [], ok: true }
    }
    case 'blow_lantern':
    case 'keep_lantern': {
      // P1-B 双结局：complete 阶段的最终选择。自由旗标（不进 FLAG_KEYS，不持久化——与
      // tapestry_looked 同款约定）；文案走 ENDING_VARIANTS（narrative-content.json）。
      const next = cloneState(state)
      const effects: Effect[] = []
      if (next.stage !== 'complete') {
        narrate(effects, '还不是做这个决定的时候。')
        effects.push({ kind: 'sound', sound: 'ui' })
        return { state: next, effects, ok: false }
      }
      const blew = action.type === 'blow_lantern'
      const flag = blew ? 'ending_blow' : 'ending_keep'
      if (next.flags[flag]) {
        narrate(effects, '这个选择你已经做过了。')
        return { state: next, effects, ok: true }
      }
      next.flags = { ...next.flags, [flag]: true }
      const variant = ENDING_VARIANTS[blew ? 'blew' : 'kept']
      narrate(effects, `${variant.title}。`)
      narrate(effects, variant.lines)
      narrate(effects, variant.achievement)
      effects.push({ kind: 'sound', sound: blew ? 'blow' : 'bell' })
      return { state: next, effects, ok: true }
    }
    default: {
      return { state: cloneState(state), effects: [], ok: false }
    }
  }
}

/** 供 UI/测试使用：当前阶段目标文案。 */
export function currentObjective(state: GameState): string {
  return STAGE_META[state.stage].objective
}

/** 供 HUD 使用：拨盘当前序列（显示用）。 */
export function dialProgressText(state: GameState): string {
  if (state.flags.dials_solved) return '机关已解开（3 → 1 → 2）'
  if (state.dialOrder.length === 0) return '尚未拨动'
  return state.dialOrder.join(' → ')
}

export { pushStageObjective }
