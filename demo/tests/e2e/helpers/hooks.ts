/**
 * E2E 调试钩子工具（Playtest 工程师体系）。
 * 依赖 demo/src/game/store.ts 的 DEV 钩子：window.getPlaytestState / window.applyAction。
 */
import type { Page } from '@playwright/test'

export interface PlaytestState {
  started: boolean
  panel: string
  stage: string
  zone: string
  lanternLit: boolean
  flags: Record<string, boolean>
  inventory: string[]
  journalCount: number
  logTail: string[]
}

export async function getState(page: Page): Promise<PlaytestState> {
  return page.evaluate(() => (window as unknown as { getPlaytestState: () => PlaytestState }).getPlaytestState())
}

/** dispatch 一个动作并返回最新状态快照。 */
export async function act(page: Page, action: { type: string; objectId?: string; itemId?: string; zoneId?: string; level?: number }): Promise<PlaytestState> {
  return page.evaluate((a) => (window as unknown as { applyAction: (a: unknown) => PlaytestState }).applyAction(a), action)
}

/** 打开游戏（标题屏「开始探索」）。 */
export async function startGame(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(4000)
  const start = page.getByRole('button', { name: '开始探索' })
  const started = await page.evaluate(
    () => (window as unknown as { __store?: { getState: () => { started: boolean } } }).__store?.getState().started ?? false,
  )
  if ((await start.count()) > 0 && !started) {
    await start.click()
  }
  await page.waitForTimeout(1500)
}
