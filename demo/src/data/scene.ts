/**
 * 场景数据：3 个 zone、17 个可交互对象、14 个相机定位点。
 *
 * 约定（与 00-brief §4.2 一致）：
 * - zoneId:   zone_<slug>
 * - objectId: obj_<zone>_<slug>
 * - cameraId: cam_<zone>_<slug>
 * - 只渲染当前 zone，因此所有坐标都是“zone 内局部坐标”；
 *   camera 定位时直接使用局部坐标（当前 zone 内的 camera 与玩家同一坐标空间）。
 */
import type { Aabb, CameraAnchor, SceneObjectDef, Vec3, ZoneDef, ZoneId } from '../game/types.ts'
import { ZONE_IDS } from '../game/types.ts'

export const DIAL_SEQUENCE: readonly number[] = [3, 1, 2] as const

const studyObjects: SceneObjectDef[] = [
  {
    id: 'obj_study_desk',
    zoneId: 'zone_study',
    name: '橡木书桌',
    action: 'inspect',
    position: [0, 1.0, -1.98],
    interactDistance: 2.6,
    cameraId: 'cam_study_desk',
    knowledgeIds: ['kb_study_room'],
    blockedText: '',
    description: '桌面被雨水泡得发亮，摊开的日记压在黄铜墨水瓶下。',
  },
  {
    id: 'obj_study_diary',
    zoneId: 'zone_study',
    name: '摊开的日记',
    action: 'read',
    position: [0.5, 0.98, -2.05],
    interactDistance: 2.2,
    cameraId: 'cam_study_desk',
    knowledgeIds: [],
    blockedText: '',
    description: '纸页停在半句话上，墨迹还没干透。',
  },
  {
    id: 'obj_study_bookshelf',
    zoneId: 'zone_study',
    name: '顶到天花板的书架',
    action: 'search',
    position: [-4.0, 1.35, -0.8],
    interactDistance: 2.8,
    cameraId: 'cam_study_bookshelf',
    knowledgeIds: ['book_A16_023', 'kb_lantern_origin'],
    conditions: { flags: ['clue_diary'] },
    blockedText: '书架高得够不到顶。你还不知道要找什么——先看看书桌上那本摊开的日记。',
    description: '霉味、皮革与旧纸。第三层的书脊上有一道新鲜的缝隙。',
  },
  {
    id: 'obj_study_fireplace',
    zoneId: 'zone_study',
    name: '壁炉',
    action: 'inspect',
    position: [3.9, 1.1, 0.6],
    interactDistance: 2.6,
    cameraId: 'cam_study_fireplace',
    knowledgeIds: [],
    conditions: { flags: ['has_lantern'] },
    blockedText: '壁炉里只剩冷灰。你需要先找到能照明的东西，才能看清炉膛里的刻痕。',
    description: '冷灰里埋着一小截没有烧尽的木柴。',
  },
  {
    id: 'obj_study_floor_door',
    zoneId: 'zone_study',
    name: '地板暗门',
    action: 'use',
    position: [-2.4, 0.3, 0.9],
    interactDistance: 2.8,
    cameraId: 'cam_study_floor_door',
    knowledgeIds: ['kb_study_room'],
    conditions: { flags: ['clue_diary'], lanternLit: true },
    visibleWhen: { lanternLit: true },
    blockedText: '地板看上去严丝合缝。日记里的那句话，也许得等你手里有光才看得懂。',
    description: '提灯的光斜切过地板，一圈细细的缝隙显了出来。',
  },
  {
    id: 'obj_study_mirror',
    zoneId: 'zone_study',
    name: '落地镜',
    action: 'inspect',
    position: [4.1, 1.7, -2.0],
    interactDistance: 2.6,
    cameraId: 'cam_study_mirror',
    knowledgeIds: ['kb_mirror'],
    blockedText: '',
    description: '镜面蒙着擦不掉的雾，雾里像有人比你先站定。',
  },
  {
    id: 'obj_study_painting',
    zoneId: 'zone_study',
    name: '暗色调油画',
    action: 'inspect',
    position: [-1.6, 1.8, -4.2],
    interactDistance: 2.6,
    cameraId: 'cam_study_painting',
    knowledgeIds: ['kb_painting'],
    blockedText: '',
    description: '画的是这间书房，可画里的书架向左滑开，露出一段向下的阶梯。',
  },
]

const basementObjects: SceneObjectDef[] = [
  {
    id: 'obj_basement_stairs',
    zoneId: 'zone_basement',
    name: '来时的石阶',
    action: 'use',
    position: [3.5, 0.8, 3.3],
    interactDistance: 2.4,
    cameraId: 'cam_basement_stairs',
    knowledgeIds: [],
    conditions: { flags: ['cellar_open'] },
    blockedText: '头顶只有石头。你记不清自己是怎么下来的。',
    description: '螺旋石阶向上通回书房，阶脚积着水。',
  },
  {
    id: 'obj_basement_shower',
    zoneId: 'zone_basement',
    name: '淋浴间玻璃门',
    action: 'inspect',
    position: [-3.0, 1.15, -1.6],
    interactDistance: 2.6,
    cameraId: 'cam_basement_shower',
    knowledgeIds: ['kb_shower', 'kb_secret_door'],
    conditions: { lanternLit: true },
    blockedText: '黑暗里你只能听见滴水声。没有灯，你什么也看不清。',
    description: '磨砂玻璃后似乎还有另一层轮廓。',
  },
  {
    id: 'obj_basement_mural',
    zoneId: 'zone_basement',
    name: '石壁浮雕',
    action: 'inspect',
    position: [-0.65, 1.5, -3.55],
    interactDistance: 2.8,
    cameraId: 'cam_basement_mural',
    knowledgeIds: ['kb_mural_symbols'],
    conditions: { lanternLit: true },
    blockedText: '黑暗里你只能听见滴水声。没有灯，你什么也看不清。',
    description: '三角、圆环、方框，自上而下排着，旁边各有几点刻痕。',
  },
  {
    id: 'obj_basement_basin',
    zoneId: 'zone_basement',
    name: '铜管洗手台',
    action: 'inspect',
    position: [3.6, 1.0, 1.4],
    interactDistance: 2.6,
    cameraId: 'cam_basement_basin',
    knowledgeIds: ['kb_basin_inscription', 'kb_basin_compartment'],
    conditions: { lanternLit: true },
    blockedText: '黑暗里你只能听见滴水声。没有灯，你什么也看不清。',
    description: '铜管下方有一行反向的刻字，边缘被水垢吃掉了一半。',
  },
  {
    id: 'obj_basement_dial_1',
    zoneId: 'zone_basement',
    name: '转盘 · 一',
    action: 'dial',
    position: [1.3, 1.35, -3.55],
    interactDistance: 2.8,
    cameraId: 'cam_basement_dials',
    knowledgeIds: ['kb_mural_symbols', 'kb_basin_inscription'],
    conditions: { flags: ['clue_symbols', 'clue_basin'], lanternLit: true },
    blockedText: '转盘纹丝不动。你还没读懂它们的规则。',
    description: '第一个铜盘，盘面刻着罗马数字，盘心铸着一只鸟首。',
    dialValue: 1,
  },
  {
    id: 'obj_basement_dial_2',
    zoneId: 'zone_basement',
    name: '转盘 · 二',
    action: 'dial',
    position: [1.9, 1.35, -3.55],
    interactDistance: 2.8,
    cameraId: 'cam_basement_dials',
    knowledgeIds: ['kb_mural_symbols', 'kb_basin_inscription'],
    conditions: { flags: ['clue_symbols', 'clue_basin'], lanternLit: true },
    blockedText: '转盘纹丝不动。你还没读懂它们的规则。',
    description: '第二个铜盘，盘面刻着罗马数字，盘心铸着一柄斧刃。',
    dialValue: 2,
  },
  {
    id: 'obj_basement_dial_3',
    zoneId: 'zone_basement',
    name: '转盘 · 三',
    action: 'dial',
    position: [2.5, 1.35, -3.55],
    interactDistance: 2.8,
    cameraId: 'cam_basement_dials',
    knowledgeIds: ['kb_mural_symbols', 'kb_basin_inscription'],
    conditions: { flags: ['clue_symbols', 'clue_basin'], lanternLit: true },
    blockedText: '转盘纹丝不动。你还没读懂它们的规则。',
    description: '第三个铜盘，盘面刻着罗马数字，盘心铸着一把钥匙。',
    dialValue: 3,
  },
  {
    id: 'obj_basement_secret_door',
    zoneId: 'zone_basement',
    name: '封死的暗门',
    action: 'use',
    position: [4.15, 1.2, -2.4],
    interactDistance: 2.8,
    cameraId: 'cam_basement_secret_door',
    knowledgeIds: ['kb_secret_door'],
    conditions: { flags: ['dials_solved'], lanternLit: true },
    blockedText: '石门嵌在墙里，纹丝不动。也许机关还没解开。',
    description: '石缝里的铜盘正在发烫，门轴深处传来一声轻响。',
  },
]

const chamberObjects: SceneObjectDef[] = [
  {
    id: 'obj_chamber_pedestal',
    zoneId: 'zone_chamber',
    name: '石台',
    action: 'inspect',
    position: [0, 1.25, -1.6],
    interactDistance: 2.6,
    cameraId: 'cam_chamber_pedestal',
    knowledgeIds: ['kb_chamber_altar'],
    blockedText: '',
    description: '石台上放着一本没有书名的册子，封面落着薄薄一层灰。',
  },
  {
    id: 'obj_chamber_tapestry',
    zoneId: 'zone_chamber',
    name: '挂毯',
    action: 'inspect',
    position: [0, 2.0, -3.2],
    interactDistance: 2.8,
    cameraId: 'cam_chamber_tapestry',
    knowledgeIds: ['kb_tapestry'],
    blockedText: '',
    description: '挂毯织着一座陌生城市的鸟瞰图，中央的位置与书房镜像对称。',
  },
]

export const OBJECT_LIST: SceneObjectDef[] = [...studyObjects, ...basementObjects, ...chamberObjects]

export const OBJECTS: Record<string, SceneObjectDef> = Object.fromEntries(
  OBJECT_LIST.map((object) => [object.id, object]),
)

// AABB 对齐 GLB 实测 bbox（T-005/asset-calibration 数据；放置点=底部中心，下同）
// 书桌 GLB 0.98(X)×0.72(Z) @ [0,0,-2.6]；书架 2.23(X,rotY90 后贴墙向 Z)×0.72(Z) @ [-4.55,0,-0.8]；
// 壁炉 1.51(X)×0.82(Z) @ [4.55,0,0.6]。
const studyColliders: Aabb[] = [
  { id: 'col_desk', min: [-0.5, 0, -3.05], max: [0.5, 0.85, -2.15] },
  { id: 'col_bookshelf', min: [-4.9, 0, -1.92], max: [-4.2, 2.6, 0.32] },
  { id: 'col_fireplace', min: [4.3, 0, 0.2], max: [4.9, 1.61, 1.0] },
]

// 地下室：淋浴门 GLB 1.03×0.19 @ [-3.0,0,-2.8]；洗手台 0.59(X,rotY-90 后 Z 向)×0.50 @ [4.1,0,1.4]；
// 转盘挂北墙 1.23 高处不参与地面碰撞；暗门 0.92(X,rotY-90)×0.47 嵌东墙 @ [4.5,0,-2.4]；石阶 1.13×1.10 @ [3.5,0,3.4]。
const basementColliders: Aabb[] = [
  { id: 'col_shower', min: [-3.55, 0, -2.95], max: [-2.45, 2.0, -2.65] },
  { id: 'col_basin', min: [3.85, 0, 1.1], max: [4.35, 0.95, 1.7] },
  { id: 'col_secret_door', min: [4.27, 0, -2.86], max: [4.73, 2.2, -1.94] },
  { id: 'col_stairs', min: [2.94, 0, 2.85], max: [4.06, 1.5, 3.95] },
]

const chamberColliders: Aabb[] = [
  { id: 'col_pedestal', min: [-0.65, 0, -2.25], max: [0.65, 1.5, -0.95] },
]

export const ZONES: Record<ZoneId, ZoneDef> = {
  zone_study: {
    id: 'zone_study',
    name: '神秘书房',
    subtitle: '暖光 · 雨声 · 旧书',
    bounds: { min: [-4.55, 0, -4.55], max: [4.55, 3.4, 4.55] },
    spawn: [0, 0, 3.2],
    spawnYaw: 0,
    colliders: studyColliders,
    objectIds: studyObjects.map((object) => object.id),
    cameraIds: [
      'cam_study_desk',
      'cam_study_bookshelf',
      'cam_study_fireplace',
      'cam_study_painting',
      'cam_study_mirror',
      'cam_study_floor_door',
    ],
    needsLantern: false,
    ambient: 0.55,
    description: '雨点敲着窗。你在一间不该出现的书房里醒来。',
  },
  zone_basement: {
    id: 'zone_basement',
    name: '地下室盥洗室',
    subtitle: '全黑 · 滴水 · 石灰味',
    bounds: { min: [-4.55, 0, -4.05], max: [4.55, 3.0, 4.05] },
    spawn: [3.4, 0, 3.0],
    spawnYaw: 0.85,
    colliders: basementColliders,
    objectIds: basementObjects.map((object) => object.id),
    cameraIds: [
      'cam_basement_shower',
      'cam_basement_mural',
      'cam_basement_basin',
      'cam_basement_dials',
      'cam_basement_secret_door',
      'cam_basement_stairs',
    ],
    needsLantern: true,
    ambient: 0.06,
    description: '提灯的光只够照亮你脚前三步。水滴声从四个方向同时传回来。',
  },
  zone_chamber: {
    id: 'zone_chamber',
    name: '密室',
    subtitle: '冷光 · 烛火 · 石台',
    bounds: { min: [-3.55, 0, -3.55], max: [3.55, 4.2, 3.55] },
    spawn: [0, 0, 2.6],
    spawnYaw: 0,
    colliders: chamberColliders,
    objectIds: chamberObjects.map((object) => object.id),
    cameraIds: ['cam_chamber_pedestal', 'cam_chamber_tapestry'],
    needsLantern: false,
    ambient: 0.16,
    description: '门在身后合拢。这里比地下室更冷，却有一种奇异的干净。',
  },
}

export const CAMERA_LIST: CameraAnchor[] = [
  { id: 'cam_study_desk', zoneId: 'zone_study', title: '书桌', position: [0.8, 1.6, 1.0], lookAt: [0, 0.9, -2.6] },
  { id: 'cam_study_bookshelf', zoneId: 'zone_study', title: '书架', position: [-2.4, 1.6, -0.8], lookAt: [-4.6, 1.3, -0.8] },
  { id: 'cam_study_fireplace', zoneId: 'zone_study', title: '壁炉', position: [2.8, 1.6, 0.6], lookAt: [4.7, 0.9, 0.6] },
  { id: 'cam_study_painting', zoneId: 'zone_study', title: '油画', position: [-1.6, 1.7, -2.2], lookAt: [-1.6, 1.8, -5.0] },
  { id: 'cam_study_mirror', zoneId: 'zone_study', title: '落地镜', position: [3.0, 1.7, -2.0], lookAt: [5.0, 1.7, -2.0] },
  { id: 'cam_study_floor_door', zoneId: 'zone_study', title: '地板暗门', position: [0.4, 1.4, 0.9], lookAt: [-2.4, 0.1, 0.9] },
  { id: 'cam_basement_shower', zoneId: 'zone_basement', title: '淋浴间', position: [-1.7, 1.6, -1.2], lookAt: [-3.0, 1.15, -2.8] },
  { id: 'cam_basement_mural', zoneId: 'zone_basement', title: '石壁浮雕', position: [-0.65, 1.6, -1.6], lookAt: [-0.65, 1.5, -3.9] },
  { id: 'cam_basement_basin', zoneId: 'zone_basement', title: '洗手台', position: [2.4, 1.5, 1.4], lookAt: [4.3, 1.0, 1.4] },
  { id: 'cam_basement_dials', zoneId: 'zone_basement', title: '三个转盘', position: [1.9, 1.6, -1.8], lookAt: [1.9, 1.35, -3.9] },
  { id: 'cam_basement_secret_door', zoneId: 'zone_basement', title: '暗门', position: [1.5, 1.5, -2.4], lookAt: [4.46, 1.25, -2.4] },
  { id: 'cam_basement_stairs', zoneId: 'zone_basement', title: '石阶', position: [2.0, 1.7, 2.2], lookAt: [3.5, 1.0, 3.3] },
  { id: 'cam_chamber_pedestal', zoneId: 'zone_chamber', title: '石台', position: [0, 1.7, 0.9], lookAt: [0, 1.2, -1.6] },
  { id: 'cam_chamber_tapestry', zoneId: 'zone_chamber', title: '挂毯', position: [0, 1.8, -1.0], lookAt: [0, 2.0, -3.5] },
]

export const CAMERA_ANCHORS: Record<string, CameraAnchor> = Object.fromEntries(
  CAMERA_LIST.map((anchor) => [anchor.id, anchor]),
)

export function getCameraAnchor(cameraId: string): CameraAnchor | undefined {
  return CAMERA_ANCHORS[cameraId]
}

export function zoneObjects(zoneId: ZoneId): SceneObjectDef[] {
  return OBJECT_LIST.filter((object) => object.zoneId === zoneId)
}

/** 数据驱动的 zone ↔ camera ↔ knowledge 映射表（检索面板不得硬编码映射）。 */
export const ZONE_CAMERA_MAP: Record<ZoneId, readonly string[]> = {
  zone_study: ZONES.zone_study.cameraIds,
  zone_basement: ZONES.zone_basement.cameraIds,
  zone_chamber: ZONES.zone_chamber.cameraIds,
}

/** 玩家眼睛高度（米）。 */
export const EYE_HEIGHT = 1.65

/** 玩家碰撞半径（米）。 */
export const PLAYER_RADIUS = 0.32

/** 各 zone 的出生点（含眼睛高度）。 */
export function spawnPose(zoneId: ZoneId): { position: Vec3; yaw: number } {
  const zone = ZONES[zoneId]
  return {
    position: [zone.spawn[0], EYE_HEIGHT, zone.spawn[2]],
    yaw: zone.spawnYaw,
  }
}

/** 用于测试/文档：列出所有 zone。 */
export const ALL_ZONE_IDS: readonly ZoneId[] = ZONE_IDS
