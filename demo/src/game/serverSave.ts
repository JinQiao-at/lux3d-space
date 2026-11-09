/**
 * server 存档接线（A2，可选增强）：server 可达时把 localStorage 存档同步到
 * /api/progress（跨设备/重装恢复用），不可达时静默跳过——localStorage 始终是主存档。
 *
 * - playerId 固定 'lux3d_local_player'（单机无账号体系）；
 * - 上传前先 GET 拿服务器端 save_version，+1 写入（服务端乐观并发：版本不减才接受 state）；
 * - 与 serverAgent.ts 共用 server 地址与降级约定：任何失败返回 null，不打断游戏。
 */
import { parseSave, serializeSave } from './save.ts'
import type { GameState } from './types.ts'

const SERVER_BASE = ((import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://127.0.0.1:25432').replace(
  /\/$/,
  '',
)
const PLAYER_ID = 'lux3d_local_player'
const SYNC_TIMEOUT_MS = 3_000

async function serverFetch(path: string, init?: RequestInit): Promise<unknown | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
  try {
    const response = await fetch(`${SERVER_BASE}${path}`, { ...init, signal: controller.signal })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 上传当前存档；server 不可达/失败静默返回 false。 */
export async function pushSaveToServer(state: GameState): Promise<boolean> {
  const existing = (await serverFetch(`/api/progress/${PLAYER_ID}`)) as
    | { progress?: { saveVersion?: number } }
    | null
  const nextVersion = (existing?.progress?.saveVersion ?? 0) + 1
  const result = await serverFetch(`/api/progress/${PLAYER_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: JSON.parse(serializeSave(state)),
      saveVersion: nextVersion,
      playedSeconds: state.playTime,
    }),
  })
  return result !== null
}

/** 拉取云端存档并解析为 GameState；无存档/不可达/格式不合法返回 null。 */
export async function fetchSaveFromServer(): Promise<GameState | null> {
  const data = (await serverFetch(`/api/progress/${PLAYER_ID}`)) as
    | { progress?: { state?: unknown } }
    | null
  const raw = data?.progress?.state
  if (!raw) return null
  return parseSave(JSON.stringify(raw))
}
