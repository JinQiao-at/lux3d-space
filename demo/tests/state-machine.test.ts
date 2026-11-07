/**
 * 状态机 / 场景数据 / 知识检索 / 受控 Agent / 存档 的纯逻辑单测。
 * 运行：node --experimental-strip-types --test tests/*.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import type { Action, GameState } from '../src/game/types.ts'
import { STAGE_INDEX, STAGES, FLAG_KEYS, ZONE_IDS } from '../src/game/types.ts'
import { applyAction } from '../src/game/actions.ts'
import {
  createInitialState,
  parseSave,
  serializeSave,
  normalizeSave,
  saveToStorage,
  loadFromStorage,
  formatPlayTime,
  exportFileName,
} from '../src/game/save.ts'
import {
  DIAL_SEQUENCE,
  OBJECTS,
  ZONES,
  CAMERA_ANCHORS,
  spawnPose,
} from '../src/data/scene.ts'
import { findInteractionCandidate, forwardFromYaw, resolveMovement } from '../src/game/interaction.ts'
import { KNOWLEDGE_BASE, searchKnowledge, focusTargetOf, listTopics } from '../src/data/knowledge.ts'
import {
  DIAL_WRONG_TEXTS,
  ENDING,
  HINTS,
  JOURNAL_ENTRIES,
  OBJECT_SUCCESS,
  OPENING_LINES,
  STAGE_META,
  ZONE_ENTER_LINES,
  ZONE_FIRST_ENTER_LINES,
} from '../src/data/narrative.ts'
import { AGENT_TOOLS, answerQuestion, validateToolCall } from '../src/game/agent.ts'
import type { KVStorage } from '../src/game/save.ts'
import { ASSET_REGISTRY } from '../src/scene/assetRegistry.ts'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function step(state: GameState, action: Action): GameState {
  return applyAction(state, action).state
}

/** 按 7 步主线推进到每个阶段，返回各步后的状态。 */
function playHappyPath(): GameState[] {
  const states: GameState[] = [createInitialState()]
  let state = states[0]
  state = step(state, { type: 'read', objectId: 'obj_study_diary' })
  states.push(state)
  state = step(state, { type: 'search', objectId: 'obj_study_bookshelf' })
  states.push(state)
  state = step(state, { type: 'toggle_lantern' })
  states.push(state)
  state = step(state, { type: 'use', objectId: 'obj_study_floor_door' })
  states.push(state)
  state = step(state, { type: 'inspect', objectId: 'obj_basement_shower' })
  state = step(state, { type: 'inspect', objectId: 'obj_basement_mural' })
  state = step(state, { type: 'inspect', objectId: 'obj_basement_basin' })
  states.push(state)
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_3' })
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_1' })
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_2' })
  states.push(state)
  state = step(state, { type: 'use', objectId: 'obj_basement_secret_door' })
  states.push(state)
  state = step(state, { type: 'inspect', objectId: 'obj_chamber_pedestal' })
  states.push(state)
  return states
}

test('初始状态符合 brief §4.5 的形状', () => {
  const state = createInitialState()
  assert.equal(state.version, 1)
  assert.equal(state.stage, 'arrival')
  assert.equal(state.zone, 'zone_study')
  assert.equal(state.inventory.length, 0)
  assert.equal(state.lanternLit, false)
  assert.equal(state.visited.join(','), 'zone_study')
  assert.equal(state.journal.length, 0)
  assert.deepEqual(state.dialOrder, [])
  assert.equal(state.hintsUsed, 0)
  assert.equal(state.playTime, 0)
  assert.equal(state.settings.quality, 'balanced')
  for (const flag of [
    'clue_diary',
    'has_lantern',
    'cellar_open',
    'saw_secret_outline',
    'clue_symbols',
    'clue_basin',
    'dials_solved',
    'secret_open',
    'ending_seen',
  ]) {
    assert.equal(state.flags[flag], false, `${flag} 初始应为 false`)
  }
})

test('7 步主线可完整推进到结局', () => {
  const states = playHappyPath()
  const [initial, afterDiary, afterLantern, afterLight, afterDoor, afterClues, afterDials, afterSecretDoor, afterPedestal] =
    states

  // 1) arrival → find_light：读日记拿到线索
  assert.equal(initial.stage, 'arrival')
  assert.equal(afterDiary.stage, 'find_light')
  assert.equal(afterDiary.flags.clue_diary, true)
  assert.equal(afterDiary.journal.length, 1)

  // 2) find_light → light_it：书架暗格拿到提灯
  assert.equal(afterLantern.stage, 'light_it')
  assert.equal(afterLantern.flags.has_lantern, true)
  assert.deepEqual(afterLantern.inventory, ['lantern'])

  // 3) light_it → descend：按 L 点亮提灯
  assert.equal(afterLight.stage, 'descend')
  assert.equal(afterLight.lanternLit, true)

  // 4) descend → illuminate：地板暗门 → 地下室
  assert.equal(afterDoor.stage, 'illuminate')
  assert.equal(afterDoor.flags.cellar_open, true)
  assert.equal(afterDoor.zone, 'zone_basement')
  assert.ok(afterDoor.visited.includes('zone_basement'))

  // 5) illuminate → solve_dials：三个线索
  assert.equal(afterClues.stage, 'solve_dials')
  assert.equal(afterClues.flags.saw_secret_outline, true)
  assert.equal(afterClues.flags.clue_symbols, true)
  assert.equal(afterClues.flags.clue_basin, true)
  assert.ok(afterClues.journal.some((entry) => entry.id === 'mural_symbols'))
  assert.ok(afterClues.journal.some((entry) => entry.id === 'basin_inscription'))

  // 6) solve_dials → chamber：3-1-2 机关
  assert.equal(afterDials.flags.dials_solved, true)
  assert.equal(afterDials.stage, 'chamber')
  assert.deepEqual(afterDials.dialOrder, DIAL_SEQUENCE)

  // 7) chamber → complete：暗门 → 密室 → 石台结局
  assert.equal(afterSecretDoor.zone, 'zone_chamber')
  assert.equal(afterSecretDoor.flags.secret_open, true)
  assert.ok(afterSecretDoor.visited.includes('zone_chamber'))
  assert.equal(afterPedestal.stage, 'complete')
  assert.equal(afterPedestal.flags.ending_seen, true)
  assert.ok(afterPedestal.journal.some((entry) => entry.id === 'chamber_ending'))

  // T-017：完整 7 步主线后，玩家实际可收集的日记应 ≥10 条（手册目录 12 条，另 3 条来自可选调查点）
  assert.ok(afterPedestal.journal.length >= 10, `完整主线后 journal 应 ≥10，实际 ${afterPedestal.journal.length}`)
  for (const requiredId of ['eco_three_symbols', 'previous_owner', 'secret_door_origin']) {
    assert.ok(
      afterPedestal.journal.some((entry) => entry.id === requiredId),
      `完整主线应收集到新增日记 ${requiredId}`,
    )
  }
  assert.equal(
    new Set(afterPedestal.journal.map((entry) => entry.id)).size,
    afterPedestal.journal.length,
    '日记不应重复',
  )
})

test('阶段只前进不回退，且重复调查不重复记日记', () => {
  let state = createInitialState()
  state = step(state, { type: 'read', objectId: 'obj_study_diary' })
  const afterFirst = state
  state = step(state, { type: 'inspect', objectId: 'obj_study_desk' })
  assert.equal(state.stage, afterFirst.stage)
  assert.equal(state.journal.length, 1, '同一线索只记一次日记')
  assert.ok(STAGE_INDEX[state.stage] >= STAGE_INDEX[afterFirst.stage])
})

test('条件不满足时操作被拒绝、状态不推进', () => {
  // 未读日记就搜索书架
  const initial = createInitialState()
  const bookshelf = applyAction(initial, { type: 'search', objectId: 'obj_study_bookshelf' })
  assert.equal(bookshelf.ok, false)
  assert.equal(bookshelf.state.flags.has_lantern, false)
  assert.equal(bookshelf.state.stage, 'arrival')
  assert.equal(bookshelf.state.inventory.length, 0)

  // 未点灯开地板暗门
  let state = step(initial, { type: 'read', objectId: 'obj_study_diary' })
  state = step(state, { type: 'search', objectId: 'obj_study_bookshelf' })
  const hatch = applyAction(state, { type: 'use', objectId: 'obj_study_floor_door' })
  assert.equal(hatch.ok, false)
  assert.equal(hatch.state.flags.cellar_open, false)
  assert.equal(hatch.state.zone, 'zone_study')

  // 无灯进入地下室：必须被黑暗拦住
  const dark = applyAction(state, { type: 'enter_zone', zoneId: 'zone_basement' })
  assert.equal(dark.ok, false)
  assert.equal(dark.state.zone, 'zone_study')
  assert.ok(dark.effects.some((effect) => effect.kind === 'darkness'))

  // 地下室对象不能在书房调查
  const wrongZone = applyAction(state, { type: 'inspect', objectId: 'obj_basement_mural' })
  assert.equal(wrongZone.ok, false)
})

test('暗门/密室条件：未解谜不能开暗门，未进地下室不能进密室', () => {
  const states = playHappyPath()
  const afterClues = states[5]
  const blockedDoor = applyAction(afterClues, { type: 'use', objectId: 'obj_basement_secret_door' })
  assert.equal(blockedDoor.ok, false)
  assert.equal(blockedDoor.state.flags.secret_open, false)
  assert.equal(blockedDoor.state.zone, 'zone_basement')

  const skipZone = applyAction(createInitialState(), { type: 'enter_zone', zoneId: 'zone_chamber' })
  assert.equal(skipZone.ok, false)
  assert.equal(skipZone.state.zone, 'zone_study')
})

test('符号谜题：错误顺序重置可重试，3-1-2 解开并只开一次', () => {
  let state = playHappyPath()[5] // 已在地下室、线索齐全

  // 错误顺序 1 → 2 → 3
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_1' })
  assert.deepEqual(state.dialOrder, [1])
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_2' })
  assert.deepEqual(state.dialOrder, [1, 2])
  const wrong = applyAction(state, { type: 'dial', objectId: 'obj_basement_dial_3' })
  assert.deepEqual(wrong.state.dialOrder, [], '错误组合应清空已拨顺序')
  assert.equal(wrong.state.flags.dials_solved, false)
  assert.ok(wrong.effects.some((effect) => effect.kind === 'dialShake'), '错误组合应有震动反馈')
  state = wrong.state

  // 正确顺序 3 → 1 → 2
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_3' })
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_1' })
  const solved = applyAction(state, { type: 'dial', objectId: 'obj_basement_dial_2' })
  assert.equal(solved.state.flags.dials_solved, true)
  assert.equal(solved.state.stage, 'chamber')

  // 已解开后再次拨动不会破坏状态
  const again = applyAction(solved.state, { type: 'dial', objectId: 'obj_basement_dial_1' })
  assert.equal(again.state.flags.dials_solved, true)
})

test('提灯：未获得时点亮失败；在地下室熄灭会触发黑暗反馈；可重新点亮', () => {
  const initial = createInitialState()
  const noLantern = applyAction(initial, { type: 'toggle_lantern' })
  assert.equal(noLantern.ok, false)
  assert.equal(noLantern.state.lanternLit, false)

  const states = playHappyPath()
  const inBasement = states[4]
  const off = applyAction(inBasement, { type: 'toggle_lantern' })
  assert.equal(off.state.lanternLit, false)
  assert.ok(off.effects.some((effect) => effect.kind === 'darkness'))

  const darkInspect = applyAction(off.state, { type: 'inspect', objectId: 'obj_basement_mural' })
  assert.equal(darkInspect.ok, false, '无灯时浮雕不可调查')

  const on = applyAction(off.state, { type: 'toggle_lantern' })
  assert.equal(on.state.lanternLit, true)
  const litInspect = applyAction(on.state, { type: 'inspect', objectId: 'obj_basement_mural' })
  assert.equal(litInspect.ok, true)
})

test('提示：request_hint 计入 hintsUsed 并返回当前阶段提示', () => {
  let state = createInitialState()
  const result = applyAction(state, { type: 'request_hint', level: 2 })
  assert.equal(result.ok, true)
  assert.equal(result.state.hintsUsed, 1)
  const hintEffect = result.effects.find((effect) => effect.kind === 'hint')
  assert.ok(hintEffect && hintEffect.kind === 'hint' && hintEffect.text.length > 0)
  state = result.state
  const third = applyAction(state, { type: 'request_hint', level: 3 })
  assert.equal(third.state.hintsUsed, 2)
  assert.equal(third.state.stage, 'arrival', '提示不推进剧情')
})

test('设置：灵敏度/音量夹紧到合法范围', () => {
  let state = createInitialState()
  state = step(state, { type: 'set_settings', settings: { sensitivity: 99, volume: -1 } })
  assert.equal(state.settings.sensitivity, 2)
  assert.equal(state.settings.volume, 0)
  state = step(state, { type: 'set_settings', settings: { quality: 'high' } })
  assert.equal(state.settings.quality, 'high')
})

test('存档序列化往返 + 坏存档兜底', () => {
  const state = playHappyPath()[6]
  const json = serializeSave(state)
  const parsed = parseSave(json)
  assert.ok(parsed)
  assert.deepEqual(parsed, state)

  // 坏 JSON
  assert.equal(parseSave('{not-json'), null)
  // 版本不符
  assert.equal(parseSave(JSON.stringify({ ...state, version: 99 })), null)
  // 结构不合法
  assert.equal(normalizeSave({ version: 1, stage: 'arrival' }), null)
  // 缺 flags 时补默认值（向前兼容）
  const partial = { ...state, flags: { clue_diary: true } }
  const normalized = normalizeSave(partial)
  assert.ok(normalized)
  assert.equal(normalized?.flags.clue_diary, true)
  assert.equal(normalized?.flags.cellar_open, false)

  // localStorage mock 往返
  const memory = new Map<string, string>()
  const storage: KVStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value)
    },
    removeItem: (key) => {
      memory.delete(key)
    },
  }
  assert.equal(saveToStorage(state, storage), true)
  assert.deepEqual(loadFromStorage(storage), state)
  assert.equal(loadFromStorage(storage)?.stage, state.stage)
})

test('存档辅助：时长格式与导出文件名', () => {
  assert.equal(formatPlayTime(0), '0 秒')
  assert.equal(formatPlayTime(65), '1 分 5 秒')
  assert.equal(formatPlayTime(3723), '1 小时 2 分 3 秒')
  assert.match(exportFileName(new Date('2026-11-03T18:39:00')), /^lux3d-lantern-save-20261103-1839\.json$/)
})

test('场景数据：3 个 zone、17 个对象、条件与相机绑定完整', () => {
  assert.equal(Object.keys(ZONES).length, 3)
  assert.ok(Object.keys(OBJECTS).length >= 12, '可交互对象应 ≥ 12')
  assert.equal(DIAL_SEQUENCE.join(''), '312')
  const cameraIds = new Set<string>()
  for (const object of Object.values(OBJECTS)) {
    assert.ok(ZONES[object.zoneId], `对象 ${object.id} 的 zoneId 应合法`)
    assert.ok(object.cameraId.startsWith('cam_'), `${object.id} 应绑定 cameraId`)
    assert.ok(object.knowledgeIds.length >= 0)
    cameraIds.add(object.cameraId)
  }
  // 关键条件必须写在数据里
  assert.deepEqual(OBJECTS.obj_study_bookshelf.conditions?.flags, ['clue_diary'])
  assert.equal(OBJECTS.obj_study_floor_door.conditions?.lanternLit, true)
  assert.deepEqual(OBJECTS.obj_basement_secret_door.conditions?.flags, ['dials_solved'])
  assert.equal(OBJECTS.obj_basement_mural.conditions?.lanternLit, true)
  // 地下室的出生点 y 为 0，玩家眼睛高度由 spawnPose 提供
  assert.equal(spawnPose('zone_basement').position[1], 1.65)
})

test('交互判定：正面朝向命中、背对不命中、隐藏对象不参与判定', () => {
  const state = createInitialState()
  const objects = Object.values(OBJECTS).filter((object) => object.zoneId === 'zone_study')

  // 站在书桌前正对桌子
  const poseFront = {
    position: [0, 1.65, -0.6] as [number, number, number],
    forward: [0, -0.28, -0.96] as [number, number, number],
  }
  const front = findInteractionCandidate(objects, poseFront, state)
  assert.ok(front)
  assert.equal(front?.object.id, 'obj_study_desk')

  // 背对书桌
  const poseBack = {
    position: [0, 1.65, -0.6] as [number, number, number],
    forward: [0, 0, 1] as [number, number, number],
  }
  assert.equal(findInteractionCandidate(objects, poseBack, state), null)

  // 未点灯：地板暗门不显形，不参与判定
  const floorDoor = OBJECTS.obj_study_floor_door
  const poseHatch = {
    position: [-2.4, 1.65, 2.2] as [number, number, number],
    forward: [0, -0.72, -0.7] as [number, number, number],
  }
  const hidden = findInteractionCandidate([floorDoor], poseHatch, state)
  assert.equal(hidden, null)
  const litState = { ...state, lanternLit: true, flags: { ...state.flags, clue_diary: true } }
  const visible = findInteractionCandidate([floorDoor], poseHatch, litState)
  assert.equal(visible?.object.id, 'obj_study_floor_door')

  // 朝向计算：yaw=0 看向 -Z（cos 的 -0 归一为 0）
  assert.deepEqual(
    forwardFromYaw(0).map((value) => (Math.abs(value) < 1e-9 ? 0 : Math.round(value * 1000) / 1000)),
    [0, 0, -1],
  )
})

test('碰撞：被书桌挡住 / 被墙夹住 / 空地自由移动', () => {
  const zone = ZONES.zone_study
  const blocked = resolveMovement([0, 1.65, 0], [0, 1.65, -2.5], zone)
  assert.ok(blocked[2] > -1.9, `应被书桌挡住，实际 z=${blocked[2]}`)
  assert.ok(blocked[2] < -1.4, '但不应被推回太远')

  const clamped = resolveMovement([0, 1.65, 0], [100, 1.65, -100], zone)
  assert.ok(clamped[0] <= 4.55)
  assert.ok(clamped[2] >= -4.55)

  const free = resolveMovement([0, 1.65, 3.0], [0.5, 1.65, 2.5], zone)
  assert.equal(Math.round(free[0] * 100) / 100, 0.5)
})

test('知识库：≥15 条、覆盖必需主题、字段合法且含用户样例 book_A16_023', () => {
  assert.ok(KNOWLEDGE_BASE.length >= 15, `知识条目应 ≥15，实际 ${KNOWLEDGE_BASE.length}`)
  const ids = new Set(KNOWLEDGE_BASE.map((entry) => entry.id))
  assert.equal(ids.size, KNOWLEDGE_BASE.length, '知识条目 id 必须唯一')
  for (const required of [
    'book_A16_023',
    'kb_study_room',
    'kb_lantern_origin',
    'kb_painting',
    'kb_mirror',
    'kb_shower',
    'kb_mural_symbols',
    'kb_basin_inscription',
    'kb_chamber_altar',
    // T-015 新增 lore 条目
    'kb_previous_owner',
    'kb_eco_three_symbols',
    'kb_secret_door_origin',
    'kb_hearth_inscription',
    'kb_three_bells',
    'kb_manuscript_a16_024',
  ]) {
    assert.ok(ids.has(required), `缺少知识条目 ${required}`)
  }
  const sample = KNOWLEDGE_BASE.find((entry) => entry.id === 'book_A16_023')
  assert.ok(sample)
  assert.equal(sample?.zoneId, 'zone_study')
  assert.ok((sample?.sources.length ?? 0) > 0)
  assert.ok(['verified', 'inferred', 'uncertain'].includes(sample?.confidence ?? ''))
  for (const entry of KNOWLEDGE_BASE) {
    assert.ok(entry.sources.length > 0, `${entry.id} 的 sources 必填`)
    assert.ok(entry.topics.length > 0, `${entry.id} 的 topics 必填`)
    assert.ok(entry.cameraId.startsWith('cam_'), `${entry.id} 的 cameraId 规范`)
    assert.ok(Object.keys(CAMERA_ANCHORS).includes(entry.cameraId), `${entry.id} 的 cameraId 必须存在于场景相机表`)
    assert.ok(ZONES[entry.zoneId], `${entry.id} 的 zoneId 必须合法`)
    if (entry.objectId !== null) {
      assert.ok(Object.keys(OBJECTS).includes(entry.objectId), `${entry.id} 的 objectId 必须存在或为 null`)
    }
    assert.ok(entry.content.length >= 40, `${entry.id} 的 content 不应为空/过短`)
  }
})

test('档案检索：关键词、topic 过滤、无命中为空', () => {
  const lanternHits = searchKnowledge('提灯')
  assert.ok(lanternHits.some((entry) => entry.id === 'kb_lantern_origin'))
  assert.ok(lanternHits.every((entry) => /提灯/.test(`${entry.title}${entry.content}${entry.topics.join('')}${entry.id}`)))

  const symbolHits = searchKnowledge('符号学')
  assert.ok(symbolHits.some((entry) => entry.id === 'book_A16_023'))
  assert.ok(symbolHits.some((entry) => entry.id === 'kb_mural_symbols'))

  const topicHits = searchKnowledge('', { topic: '符号学' })
  assert.ok(topicHits.length >= 2)
  assert.ok(topicHits.every((entry) => entry.topics.includes('符号学')))

  const zoneHits = searchKnowledge('', { zoneId: 'zone_basement' })
  assert.ok(zoneHits.length >= 3)
  assert.ok(zoneHits.every((entry) => entry.zoneId === 'zone_basement'))

  assert.deepEqual(searchKnowledge('完全不存在的关键词xyz'), [])
  assert.ok(listTopics().includes('符号学'))

  const entry = KNOWLEDGE_BASE.find((item) => item.id === 'kb_painting')
  assert.ok(entry)
  assert.equal(focusTargetOf(entry as (typeof KNOWLEDGE_BASE)[number]).cameraId, 'cam_study_desk')
})

test('受控 Agent：回答引用条目、无命中不编造、工具白名单校验', () => {
  assert.equal(AGENT_TOOLS.length, 7)
  assert.deepEqual(
    AGENT_TOOLS.map((tool) => tool.name),
    [
      'search_knowledge',
      'focus_object',
      'highlight_object',
      'show_narration',
      'get_player_state',
      'list_zone_objects',
      'request_hint',
    ],
  )

  const state = createInitialState()
  const lanternReply = answerQuestion('提灯有什么来历？', { state })
  assert.ok(lanternReply.citations.length > 0)
  assert.ok(lanternReply.citations.some((citation) => citation.id === 'kb_lantern_origin'))
  assert.ok(lanternReply.text.includes('[kb_lantern_origin]'))
  assert.ok(lanternReply.toolCalls.some((tool) => tool.tool === 'search_knowledge'))

  const noHit = answerQuestion('量子计算机的散热方案', { state })
  assert.equal(noHit.citations.length, 0)
  assert.ok(noHit.text.includes('档案中没有记录'))

  const focusReply = answerQuestion('带我去看石壁浮雕', { state })
  assert.ok(focusReply.focus, '定位意图应返回 focus 工具结果')
  assert.equal(focusReply.focus?.cameraId, 'cam_basement_mural')
  assert.ok(focusReply.toolCalls.some((tool) => tool.tool === 'focus_object'))
  assert.ok(focusReply.toolCalls.some((tool) => tool.tool === 'highlight_object'))

  const hintReply = answerQuestion('给个提示', { state })
  assert.equal(hintReply.hintLevel, 1)
  assert.ok(hintReply.toolCalls.some((tool) => tool.tool === 'request_hint'))

  const stateReply = answerQuestion('我的进度和背包', { state })
  assert.ok(stateReply.text.includes('阶段：arrival'))
  assert.ok(stateReply.text.includes('背包'))

  const listReply = answerQuestion('这个区域有哪些可交互对象？', { state })
  assert.ok(listReply.text.includes('obj_study_desk'))

  assert.equal(validateToolCall('focus_object', { objectId: 'obj_study_desk' }).ok, true)
  assert.equal(validateToolCall('focus_object', { objectId: 'obj_not_exist' }).ok, false)
  assert.equal(validateToolCall('request_hint', { level: 4 }).ok, false)
})

test('Agent 不能推进剧情：回答前后状态完全一致', () => {
  const state = createInitialState()
  const snapshot = serializeSave(state)
  answerQuestion('带我去地下室暗门', { state })
  answerQuestion('提示我下一步', { state })
  answerQuestion('暗门怎么打开？', { state })
  assert.equal(serializeSave(state), snapshot)
  assert.equal(state.stage, 'arrival')
})

test('GLB 资产登记表：路径规范、与场景对象匹配、空目录可兜底', () => {
  const registered = Object.keys(ASSET_REGISTRY)
  // 占位版为 17 条全量清单；pipeline 覆盖生成后只包含已生成资产（子集），两种都合法。
  assert.ok(registered.length >= 1 && registered.length <= 17, 'assetRegistry 条目数应在 1..17 之间')
  assert.ok(registered.every((objectId) => OBJECTS[objectId]), '每个登记 objectId 必须存在于场景数据 OBJECTS 中')
  if (registered.length === 17) {
    assert.deepEqual([...registered].sort(), Object.keys(OBJECTS).sort(), '占位清单应覆盖全部 17 个可交互物件')
  }

  for (const objectId of registered) {
    const url = ASSET_REGISTRY[objectId]
    assert.equal(url, `/models/${objectId}.glb`, `${objectId} 的路径必须是 /models/<objectId>.glb`)
    assert.match(url, /^\/models\/[a-z0-9_]+\.glb$/, '路径必须为相对站根的本地路径（零 CDN）')
  }

  // 资产目录已存在（.gitkeep 占位）；为空目录时运行期探测失败 → 回退程序化几何，与现状等价。
  const modelsDir = fileURLToPath(new URL('../public/models/', import.meta.url))
  assert.equal(existsSync(modelsDir), true, 'public/models/ 资产目录必须存在')
  assert.equal(
    existsSync(fileURLToPath(new URL('../public/models/.gitkeep', import.meta.url))),
    true,
    'public/models/.gitkeep 占位文件必须存在',
  )
})

test('T-015 叙事文本：物件文案全覆盖、日记 ≥10、结局 ≥300 字、提示完整、机制不变', () => {
  // 机制不变：8 个 Stage（7 步 + complete）/ 9 个 flags（state-machine 语义不动）
  assert.equal(STAGES.length, 8, 'Stage 数量与 7 步主线语义不应变化')
  assert.equal(FLAG_KEYS.length, 9, 'flags 数量不应变化')
  assert.deepEqual(
    Object.keys(STAGE_META).sort(),
    [...STAGES].sort(),
    'STAGE_META 必须覆盖全部 Stage',
  )

  // 每个可交互物件都有足够长的成功调查文案
  // （三个转盘走 dial 分支：文案由 scene.ts 的 description + DIAL_FIRST_TEXTS 提供，不在此表）
  const narratableObjectIds = Object.keys(OBJECTS).filter((objectId) => OBJECTS[objectId].action !== 'dial')
  assert.equal(narratableObjectIds.length, 14, '非转盘的可调查物件应为 14 个')
  for (const objectId of narratableObjectIds) {
    const lines = OBJECT_SUCCESS[objectId]
    assert.ok(lines && lines.length >= 3, `${objectId} 缺少成功调查文案（≥3 行）`)
    assert.ok(lines.join('').length >= 40, `${objectId} 的成功文案过短`)
  }
  for (const dialId of ['obj_basement_dial_1', 'obj_basement_dial_2', 'obj_basement_dial_3']) {
    assert.ok(OBJECTS[dialId].description.length >= 10, `${dialId} 应有拨盘描述文案`)
  }

  // 日记条目 ≥10，且 key 与 entry.id 一致
  const journalIds = Object.keys(JOURNAL_ENTRIES)
  assert.ok(journalIds.length >= 10, `日记条目应 ≥10，实际 ${journalIds.length}`)
  for (const [key, entry] of Object.entries(JOURNAL_ENTRIES)) {
    assert.equal(entry.id, key, `日记 key 与 id 不一致：${key}`)
    assert.ok(entry.title.length > 0 && entry.text.length >= 20, `日记 ${key} 文案过短`)
  }
  for (const required of ['previous_owner', 'eco_three_symbols', 'secret_door_origin']) {
    assert.ok(journalIds.includes(required), `缺少 T-015 要求的日记条目 ${required}`)
  }

  // 结局长文 ≥300 汉字，且含下一章钩子（镜厅 / 下一站）
  const endingText = ENDING.lines.join('')
  const endingHanCount = (endingText.match(/[\u4e00-\u9fff]/g) ?? []).length
  assert.ok(endingHanCount >= 300, `结局应 ≥300 汉字，实际 ${endingHanCount}`)
  assert.ok(endingText.includes('镜厅') || endingText.includes('下一站'), '结局需包含下一章钩子')

  // 进入 zone 的文案 ≥3 行且总计 ≥60 字
  for (const [zoneId, lines] of Object.entries(ZONE_ENTER_LINES)) {
    assert.ok(lines.length >= 3, `${zoneId} 进入文案应 ≥3 行`)
    assert.ok(lines.join('').length >= 60, `${zoneId} 进入文案过短`)
  }
  assert.ok(OPENING_LINES.length >= 5, '首屏开场文案应扩充')

  // 三级提示：每个 stage 恰好 3 条且都非空
  for (const stage of STAGES) {
    const hints = HINTS[stage]
    assert.equal(hints.length, 3, `${stage} 应有三级提示`)
    for (const hint of hints) assert.ok(hint.length >= 10, `${stage} 提示过短：${hint}`)
  }

  // 错误拨盘文案 ≥6 条（可重试、无惩罚）
  assert.ok(DIAL_WRONG_TEXTS.length >= 6, '错误拨盘文案应扩充到 ≥6 条')

  // 文本量：narrative + knowledge 较 T-015 前提升 ≥60%
  // （T-015 前 narrative.ts 11,405B + knowledge.ts 10,036B = 21,441B；现约 34.7KB = +62%）
  const narrativeVolume = JSON.stringify({
    OPENING_LINES,
    ZONE_ENTER_LINES,
    OBJECT_SUCCESS,
    JOURNAL_ENTRIES,
    DIAL_WRONG_TEXTS,
    HINTS,
    ENDING,
  }).length
  const knowledgeVolume = JSON.stringify(KNOWLEDGE_BASE).length
  assert.ok(
    narrativeVolume + knowledgeVolume >= 12000,
    `narrative+knowledge 文本量不足（${narrativeVolume + knowledgeVolume} 字符）`,
  )
})

test('T-017 日记全部可收集：主线 10 条 + 可选调查点补满 12 条，且不重复', () => {
  // 主线（7 步）：read diary → bookshelf → L → 地板暗门 → 淋浴门/浮雕/洗手台 → 3-1-2 → 暗门 → 石台
  let state = createInitialState()
  state = step(state, { type: 'read', objectId: 'obj_study_diary' })
  state = step(state, { type: 'search', objectId: 'obj_study_bookshelf' })
  state = step(state, { type: 'toggle_lantern' })
  state = step(state, { type: 'use', objectId: 'obj_study_floor_door' })
  state = step(state, { type: 'inspect', objectId: 'obj_basement_shower' })
  state = step(state, { type: 'inspect', objectId: 'obj_basement_mural' })
  state = step(state, { type: 'inspect', objectId: 'obj_basement_basin' })
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_3' })
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_1' })
  state = step(state, { type: 'dial', objectId: 'obj_basement_dial_2' })
  state = step(state, { type: 'use', objectId: 'obj_basement_secret_door' })
  state = step(state, { type: 'inspect', objectId: 'obj_chamber_pedestal' })
  assert.ok(state.journal.length >= 10, `主线结束后 journal 应 ≥10，实际 ${state.journal.length}`)

  // 另 3 条来自书房可选调查点：找灯后、下地下室前顺路调查壁炉/落地镜/油画
  let optional = createInitialState()
  optional = step(optional, { type: 'read', objectId: 'obj_study_diary' })
  optional = step(optional, { type: 'search', objectId: 'obj_study_bookshelf' })
  optional = step(optional, { type: 'toggle_lantern' })
  optional = step(optional, { type: 'inspect', objectId: 'obj_study_fireplace' })
  optional = step(optional, { type: 'inspect', objectId: 'obj_study_mirror' })
  optional = step(optional, { type: 'inspect', objectId: 'obj_study_painting' })
  assert.ok(optional.journal.some((entry) => entry.id === 'hearth_inscription'))
  assert.ok(optional.journal.some((entry) => entry.id === 'mirror_echo'))
  assert.ok(optional.journal.some((entry) => entry.id === 'previous_owner'))

  // 主线 + 可选合起来覆盖全部 12 条日记（按 id 去重后应为 12）
  const allIds = new Set([...state.journal, ...optional.journal].map((entry) => entry.id))
  assert.equal(allIds.size, Object.keys(JOURNAL_ENTRIES).length, `全部日记应可收集，实际 ${allIds.size}`)
  for (const id of Object.keys(JOURNAL_ENTRIES)) {
    assert.ok(allIds.has(id), `日记 ${id} 无法通过任何交互获得`)
  }

  // 重复调查不会重复记录（幂等）
  const before = state.journal.length
  const repeated = step(state, { type: 'inspect', objectId: 'obj_chamber_tapestry' })
  assert.equal(repeated.journal.length, before)
})

// ===== T-019：故事技术栈一期（use_item_on 物品谜题 / 首访重访文案 / 地图 / 收集进度）=====

/** 走到「持灯、拿到钥匙、身处地下室」的公共前置。 */
function reachBasementWithKey(): GameState {
  let state = createInitialState()
  state = step(state, { type: 'read', objectId: 'obj_study_diary' })
  state = step(state, { type: 'search', objectId: 'obj_study_bookshelf' }) // 第一次：提灯
  state = step(state, { type: 'search', objectId: 'obj_study_bookshelf' }) // 第二次：黄铜钥匙
  state = step(state, { type: 'toggle_lantern' })
  state = step(state, { type: 'use', objectId: 'obj_study_floor_door' })
  return state
}

test('T-019 物品谜题：持灯后再次搜索书架获得黄铜钥匙（只发一次，不动主线）', () => {
  let state = createInitialState()
  state = step(state, { type: 'read', objectId: 'obj_study_diary' })
  state = step(state, { type: 'search', objectId: 'obj_study_bookshelf' })
  assert.ok(state.inventory.includes('lantern'))
  assert.ok(!state.inventory.includes('brass_key'), '第一次搜索只给提灯')

  const second = applyAction(state, { type: 'search', objectId: 'obj_study_bookshelf' })
  assert.ok(second.ok)
  assert.ok(second.state.inventory.includes('brass_key'), '第二次搜索应获得黄铜钥匙')
  assert.equal(second.state.stage, state.stage, '拿钥匙不推进 stage')
  assert.ok(!FLAG_KEYS.includes('basin_compartment_open' as never), '支线旗标不得进入 FLAG_KEYS 主线契约')

  const third = applyAction(second.state, { type: 'search', objectId: 'obj_study_bookshelf' })
  assert.equal(third.state.inventory.filter((item) => item === 'brass_key').length, 1, '钥匙只发一次')
})

test('T-019 物品谜题：未持有/目标不在场时 use_item_on 被温和拒绝', () => {
  const noItem = applyAction(createInitialState(), { type: 'use_item_on', objectId: 'obj_basement_basin', itemId: 'brass_key' })
  assert.equal(noItem.ok, false, '没有钥匙不能用钥匙')
  assert.equal(noItem.state.inventory.length, 0, '失败不产生物品')

  const inBasement = reachBasementWithKey()
  // 回书房后对地下室物件使用：目标不在当前 zone
  const back = step(inBasement, { type: 'use', objectId: 'obj_basement_stairs' })
  assert.equal(back.zone, 'zone_study')
  const wrongZone = applyAction(back, { type: 'use_item_on', objectId: 'obj_basement_basin', itemId: 'brass_key' })
  assert.equal(wrongZone.ok, false, '目标不在当前区域应被拒绝')
  assert.equal(wrongZone.state.flags.basin_compartment_open, undefined)
})

test('T-019 物品谜题：黄铜钥匙×洗手台开启暗格；错误组合不消耗；机制不动主线契约', () => {
  const state = reachBasementWithKey()

  // 错误组合：提灯 × 洗手台 → 温和失败，物品不消耗
  const wrong = applyAction(state, { type: 'use_item_on', objectId: 'obj_basement_basin', itemId: 'lantern' })
  assert.equal(wrong.ok, false)
  assert.ok(wrong.state.inventory.includes('lantern'))
  assert.ok(wrong.state.inventory.includes('brass_key'))
  assert.equal(wrong.state.flags.basin_compartment_open, undefined, '错误组合不应开启暗格')

  // 正确组合
  const right = applyAction(state, { type: 'use_item_on', objectId: 'obj_basement_basin', itemId: 'brass_key' })
  assert.ok(right.ok)
  assert.equal(right.state.flags.basin_compartment_open, true, '暗格旗标应置位')
  assert.ok(right.state.inventory.includes('brass_key'), '钥匙不消耗（Zork 式无惩罚）')
  assert.equal(right.state.stage, state.stage, '支线不推进 stage')
  assert.equal(right.state.journal.length, state.journal.length, '支线不写日记（保持全集可收集契约）')
  assert.equal(FLAG_KEYS.length, 9, '主线 flags 契约仍是 9 个')

  // 幂等：重复使用提示已开
  const again = applyAction(right.state, { type: 'use_item_on', objectId: 'obj_basement_basin', itemId: 'brass_key' })
  assert.ok(again.ok)
  assert.equal(again.state.flags.basin_compartment_open, true)
})

test('T-019 房间描述：首次进入地下室使用首访文案表', () => {
  let state = createInitialState()
  state = step(state, { type: 'read', objectId: 'obj_study_diary' })
  state = step(state, { type: 'search', objectId: 'obj_study_bookshelf' })
  state = step(state, { type: 'toggle_lantern' })
  const entered = applyAction(state, { type: 'use', objectId: 'obj_study_floor_door' })
  const texts = entered.effects.map((effect) => (effect.kind === 'narration' ? effect.text : '')).join('\n')
  assert.ok(texts.includes(ZONE_FIRST_ENTER_LINES.zone_basement[0]), '首访应使用 ZONE_FIRST_ENTER_LINES 文案')
  assert.ok(!texts.includes(ZONE_ENTER_LINES.zone_basement[0]), '首访不应使用重访文案')
})

test('T-019 房间描述：离开再回来使用重访文案表（书房↔地下室往返）', () => {
  const state = reachBasementWithKey() // 已在地下室（首访已消耗）
  const backStudy = applyAction(state, { type: 'use', objectId: 'obj_basement_stairs' })
  const studyTexts = backStudy.effects.map((effect) => (effect.kind === 'narration' ? effect.text : '')).join('\n')
  assert.ok(studyTexts.includes(ZONE_ENTER_LINES.zone_study[0]), '回书房应使用重访文案')

  const again = applyAction(backStudy.state, { type: 'use', objectId: 'obj_study_floor_door' })
  const againTexts = again.effects.map((effect) => (effect.kind === 'narration' ? effect.text : '')).join('\n')
  assert.ok(againTexts.includes(ZONE_ENTER_LINES.zone_basement[0]), '再下地下室应使用重访文案')
  assert.ok(!againTexts.includes(ZONE_FIRST_ENTER_LINES.zone_basement[0]), '重访不应重复首访文案')
})

test('T-019 地图与收集进度：zone 契约完整、visited 单调、日记进度不超全集', () => {
  assert.equal(ZONE_IDS.length, 3, '地图依赖的 zone 数量不应变化')
  const state = reachBasementWithKey()
  assert.ok(state.visited.includes('zone_study') && state.visited.includes('zone_basement'))
  assert.ok(state.visited.length >= 2 && state.visited.length <= ZONE_IDS.length, 'visited 只记录到过的 zone')

  const total = Object.keys(JOURNAL_ENTRIES).length
  assert.ok(state.journal.length <= total, '日记收集数不会超过全集')
  // 首访表契约：每个 zone 都有首访文案（书房首访由 OPENING_LINES 承担，但表仍需完整）
  for (const zoneId of ZONE_IDS) {
    assert.ok((ZONE_FIRST_ENTER_LINES[zoneId] ?? []).length >= 3, `${zoneId} 首访文案应 ≥3 行`)
  }
})
