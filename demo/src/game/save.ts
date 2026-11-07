/**
 * 存档：版本化 localStorage 持久化 + 导出/导入 JSON。
 * 对坏存档做兜底：任何字段缺失/类型错误 → 返回 null，由调用方回落到 arrival。
 */
import type { GameSettings, GameState, Stage, Vec3, ZoneId } from './types.ts'
import {
  DEFAULT_SETTINGS,
  FLAG_KEYS,
  SAVE_KEY,
  SAVE_VERSION,
  STAGES,
  ZONE_IDS,
  emptyFlags,
} from './types.ts'
import { EYE_HEIGHT, ZONES } from '../data/scene.ts'

/** 对应浏览器 localStorage 的最小接口，便于 Node 单测注入 mock。 */
export interface KVStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function createInitialState(): GameState {
  const spawn = ZONES.zone_study.spawn
  const position: Vec3 = [spawn[0], EYE_HEIGHT, spawn[2]]
  return {
    version: SAVE_VERSION,
    stage: 'arrival',
    zone: 'zone_study',
    position,
    yaw: ZONES.zone_study.spawnYaw,
    inventory: [],
    lanternLit: false,
    flags: emptyFlags(),
    visited: ['zone_study'],
    journal: [],
    dialOrder: [],
    hintsUsed: 0,
    playTime: 0,
    settings: { ...DEFAULT_SETTINGS },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number' && Number.isFinite(item))
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 校验并归一化存档。合法返回完整 GameState（补齐新增 flags 的默认值），
 * 非法返回 null。版本号必须为 1；未来版本应在这里加迁移分支。
 */
export function normalizeSave(value: unknown): GameState | null {
  if (!isRecord(value)) return null
  if (value.version !== SAVE_VERSION) return null

  const stage = value.stage
  if (typeof stage !== 'string' || !(STAGES as readonly string[]).includes(stage)) return null

  const zone = value.zone
  if (typeof zone !== 'string' || !(ZONE_IDS as readonly string[]).includes(zone)) return null

  if (!isVec3(value.position)) return null
  if (!isNumber(value.yaw)) return null
  if (!isStringArray(value.inventory)) return null
  if (typeof value.lanternLit !== 'boolean') return null
  if (!isRecord(value.flags)) return null
  if (!isStringArray(value.visited)) return null
  if (!Array.isArray(value.journal)) return null
  if (!Array.isArray(value.dialOrder) || !value.dialOrder.every(isNumber)) return null
  if (!isNumber(value.hintsUsed) || value.hintsUsed < 0) return null
  if (!isNumber(value.playTime) || value.playTime < 0) return null

  const journal = value.journal.filter(
    (entry): entry is { id: string; title: string; text: string } =>
      isRecord(entry) && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.text === 'string',
  )
  if (journal.length !== value.journal.length) return null

  const rawSettings = isRecord(value.settings) ? value.settings : {}
  const quality = rawSettings.quality === 'high' || rawSettings.quality === 'balanced' ? rawSettings.quality : 'balanced'
  const settings: GameSettings = {
    sensitivity: isNumber(rawSettings.sensitivity) ? rawSettings.sensitivity : DEFAULT_SETTINGS.sensitivity,
    volume: isNumber(rawSettings.volume) ? rawSettings.volume : DEFAULT_SETTINGS.volume,
    quality,
  }

  const flags = emptyFlags()
  for (const key of FLAG_KEYS) {
    if (typeof value.flags[key] === 'boolean') flags[key] = value.flags[key] as boolean
  }

  return {
    version: SAVE_VERSION,
    stage: stage as Stage,
    zone: zone as ZoneId,
    position: value.position,
    yaw: value.yaw,
    inventory: value.inventory,
    lanternLit: value.lanternLit,
    flags,
    visited: value.visited,
    journal,
    dialOrder: value.dialOrder,
    hintsUsed: value.hintsUsed,
    playTime: value.playTime,
    settings,
  }
}

export function isValidSave(value: unknown): value is GameState {
  return normalizeSave(value) !== null
}

export function serializeSave(state: GameState): string {
  return JSON.stringify(state)
}

/** 解析 JSON 字符串；坏 JSON / 坏结构 / 版本不符均返回 null。 */
export function parseSave(raw: string): GameState | null {
  try {
    return normalizeSave(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

function resolveStorage(storage?: KVStorage | null): KVStorage | null {
  if (storage !== undefined) return storage
  try {
    const local = globalThis.localStorage
    return local ?? null
  } catch {
    return null
  }
}

export function saveToStorage(state: GameState, storage?: KVStorage | null): boolean {
  const target = resolveStorage(storage)
  if (!target) return false
  try {
    target.setItem(SAVE_KEY, serializeSave(state))
    return true
  } catch {
    return false
  }
}

export function loadFromStorage(storage?: KVStorage | null): GameState | null {
  const target = resolveStorage(storage)
  if (!target) return null
  try {
    const raw = target.getItem(SAVE_KEY)
    return raw ? parseSave(raw) : null
  } catch {
    return null
  }
}

export function clearStorage(storage?: KVStorage | null): void {
  const target = resolveStorage(storage)
  if (!target) return
  try {
    target.removeItem(SAVE_KEY)
  } catch {
    // 忽略不可写存储（隐私模式等）
  }
}

export function hasSave(storage?: KVStorage | null): boolean {
  return loadFromStorage(storage) !== null
}

/** 导出文件名（含本地时间戳，便于区分多次导出）。 */
export function exportFileName(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
  return `lux3d-lantern-save-${stamp}.json`
}

/** 秒 → 中文时长文本。 */
export function formatPlayTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) return `${hours} 小时 ${minutes} 分 ${secs} 秒`
  if (minutes > 0) return `${minutes} 分 ${secs} 秒`
  return `${secs} 秒`
}
