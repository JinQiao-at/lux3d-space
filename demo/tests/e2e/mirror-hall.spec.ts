import { expect, test } from '@playwright/test'
import { act, getState, startGame } from './helpers/hooks'

test.describe('钩子 A16-025 → 镜厅', () => {
  test('WebGL 可用性冒烟', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    const gl = await page.evaluate(() => {
      const c = document.createElement('canvas')
      return !!c.getContext('webgl2') || !!c.getContext('webgl')
    })
    expect(gl).toBe(true)
  })

  test('complete 后进入记忆回廊 → 镜厅预览加载', async ({ page }) => {
    await startGame(page)
    // 快进到 complete
    await act(page, { type: 'read', objectId: 'obj_study_diary' })
    await act(page, { type: 'search', objectId: 'obj_study_bookshelf' })
    await act(page, { type: 'toggle_lantern' })
    await act(page, { type: 'use', objectId: 'obj_study_floor_door' })
    await act(page, { type: 'inspect', objectId: 'obj_basement_shower' })
    await act(page, { type: 'inspect', objectId: 'obj_basement_mural' })
    await act(page, { type: 'inspect', objectId: 'obj_basement_basin' })
    await act(page, { type: 'dial', objectId: 'obj_basement_dial_3' })
    await act(page, { type: 'dial', objectId: 'obj_basement_dial_1' })
    await act(page, { type: 'dial', objectId: 'obj_basement_dial_2' })
    await act(page, { type: 'use', objectId: 'obj_basement_secret_door' })
    const s = await act(page, { type: 'use', objectId: 'obj_chamber_pedestal' })
    expect(s.stage).toBe('complete')

    // 进记忆回廊 → 切镜厅预览 → 全景真实加载
    await page.evaluate(() => {
      const store = (window as unknown as { __store?: { getState: () => { setPanel: (p: string) => void } } }).__store
      store!.getState().setPanel('memory')
    })
    await page.waitForTimeout(900)
    const mirrorBtn = page.getByRole('button', { name: /镜厅预览/ })
    await expect(mirrorBtn).toBeVisible()
    await mirrorBtn.click()
    await page.waitForTimeout(2500)
    const img = page.locator('.memory-pano')
    await expect(img).toHaveAttribute('src', /mirror-hall-pano\.jpg/)
    const loaded = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth > 0)
    expect(loaded).toBe(true)
    await expect(page.locator('.memory-mirror-note')).toContainText('A16-025')
    // 钩子状态仍在密室/终局（镜厅是预览层不改变剧情）
    const state = await getState(page)
    expect(['chamber', 'complete']).toContain(state.stage)
  })
})
