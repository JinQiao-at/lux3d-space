/**
 * 交互判定（Zork 的 doorway 评分思路的 R3F 简化版）与 AABB 碰撞。
 *
 * 判定 = 距离 ≤ 对象交互半径 且 视线方向与“玩家→对象”夹角 ≤ 阈值；
 * 多个候选时取“朝向对齐度 - 距离惩罚”最高者。背对对象时不会给出提示。
 */
import type { Aabb, GameState, ObjectConditions, SceneObjectDef, Vec3, ZoneDef } from './types.ts'
import { PLAYER_RADIUS } from '../data/scene.ts'

/** 视线与目标方向的最小余弦对齐度（≈ 35°）。 */
export const MIN_INTERACTION_ALIGNMENT = 0.82

export interface LookPose {
  position: Vec3
  forward: Vec3
}

export interface InteractionCandidate {
  object: SceneObjectDef
  distance: number
  alignment: number
  score: number
}

export function conditionsMet(conditions: ObjectConditions | undefined, state: GameState): boolean {
  if (!conditions) return true
  if (conditions.zone && conditions.zone !== state.zone) return false
  if (conditions.lanternLit !== undefined && conditions.lanternLit !== state.lanternLit) return false
  if (conditions.flags) {
    for (const flag of conditions.flags) {
      if (!state.flags[flag]) return false
    }
  }
  if (conditions.notFlags) {
    for (const flag of conditions.notFlags) {
      if (state.flags[flag]) return false
    }
  }
  return true
}

/** 对象是否在当前场景可见/可交互（含 visibleWhen 显形规则，例如未点灯时看不到地板暗门）。 */
export function isObjectVisible(object: SceneObjectDef, state: GameState): boolean {
  if (object.zoneId !== state.zone) return false
  return conditionsMet(object.visibleWhen, state)
}

export function hasMetConditions(object: SceneObjectDef, state: GameState): boolean {
  return conditionsMet(object.conditions, state)
}

function normalize3(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (length < 1e-8) return [0, 0, -1]
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

export function distance3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/**
 * 返回当前视线下最合适的交互对象；没有则 null。
 * 注意：条件不满足的对象仍会返回（用于 HUD 显示“E · 调查（还不行）”并给 blockedText），
 * 但 visibleWhen 未满足的对象（如未点灯的地板暗门）完全不参与判定。
 */
export function findInteractionCandidate(
  objects: SceneObjectDef[],
  pose: LookPose,
  state: GameState,
  options: { minAlignment?: number } = {},
): InteractionCandidate | null {
  const minAlignment = options.minAlignment ?? MIN_INTERACTION_ALIGNMENT
  const forward = normalize3(pose.forward)
  let best: InteractionCandidate | null = null

  for (const object of objects) {
    if (object.zoneId !== state.zone) continue
    if (!isObjectVisible(object, state)) continue

    const toObject: Vec3 = [
      object.position[0] - pose.position[0],
      object.position[1] - pose.position[1],
      object.position[2] - pose.position[2],
    ]
    const distance = Math.hypot(toObject[0], toObject[1], toObject[2])
    if (distance > object.interactDistance || distance < 0.05) continue

    const direction = normalize3(toObject)
    const alignment = forward[0] * direction[0] + forward[1] * direction[1] + forward[2] * direction[2]
    if (alignment < minAlignment) continue

    const score = alignment * 2 - distance * 0.15
    if (!best || score > best.score) {
      best = { object, distance, alignment, score }
    }
  }

  return best
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 把 XZ 位置限制在房间可行走矩形内（保留碰撞半径）。 */
export function clampToZoneBounds(position: Vec3, zone: ZoneDef, radius: number = PLAYER_RADIUS): Vec3 {
  const minX = zone.bounds.min[0] + radius
  const maxX = zone.bounds.max[0] - radius
  const minZ = zone.bounds.min[2] + radius
  const maxZ = zone.bounds.max[2] - radius
  return [clamp(position[0], minX, maxX), position[1], clamp(position[2], minZ, maxZ)]
}

function resolveAgainstCollider(position: Vec3, collider: Aabb, radius: number): Vec3 {
  const minX = collider.min[0]
  const maxX = collider.max[0]
  const minZ = collider.min[2]
  const maxZ = collider.max[2]

  const closestX = clamp(position[0], minX, maxX)
  const closestZ = clamp(position[2], minZ, maxZ)
  const dx = position[0] - closestX
  const dz = position[2] - closestZ
  const distSq = dx * dx + dz * dz

  if (distSq >= radius * radius) return position

  if (distSq > 1e-10) {
    const dist = Math.sqrt(distSq)
    const push = radius - dist
    return [position[0] + (dx / dist) * push, position[1], position[2] + (dz / dist) * push]
  }

  // 圆心落在 AABB 内部：选穿透最浅的一侧推出
  const pushLeft = position[0] - minX + radius
  const pushRight = maxX - position[0] + radius
  const pushBack = position[2] - minZ + radius
  const pushFront = maxZ - position[2] + radius
  const minPush = Math.min(pushLeft, pushRight, pushBack, pushFront)

  if (minPush === pushLeft) return [minX - radius, position[1], position[2]]
  if (minPush === pushRight) return [maxX + radius, position[1], position[2]]
  if (minPush === pushBack) return [position[0], position[1], minZ - radius]
  return [position[0], position[1], maxZ + radius]
}

/**
 * 带 AABB 碰撞的移动求解：
 * 1) 先夹到房间边界内；2) 对每个碰撞体做圆-矩形推出，迭代两次处理墙角。
 * 只处理 XZ，Y 保持当前值（本 Demo 无跳跃/高度差）。
 */
export function resolveMovement(
  current: Vec3,
  desired: Vec3,
  zone: ZoneDef,
  radius: number = PLAYER_RADIUS,
): Vec3 {
  let position: Vec3 = [desired[0], current[1], desired[2]]
  position = clampToZoneBounds(position, zone, radius)
  for (let pass = 0; pass < 2; pass += 1) {
    for (const collider of zone.colliders) {
      position = resolveAgainstCollider(position, collider, radius)
    }
    position = clampToZoneBounds(position, zone, radius)
  }
  return position
}

/** 由 yaw 计算水平前向（three.js 约定：yaw=0 看向 -Z）。 */
export function forwardFromYaw(yaw: number): Vec3 {
  return [-Math.sin(yaw), 0, -Math.cos(yaw)]
}

/** 由相机/玩家位置与方向构造 LookPose。 */
export function makeLookPose(position: Vec3, forward: Vec3): LookPose {
  return { position, forward }
}
