import { expect, test } from '@playwright/test'
import { act, startGame } from './helpers/hooks'

test.describe('主线 7 步', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page)
  })

  test('WebGL 可用性冒烟', async ({ page }) => {
    const gl = await page.evaluate(() => {
      const c = document.createElement('canvas')
      return !!c.getContext('webgl2') || !!c.getContext('webgl')
    })
    expect(gl).toBe(true)
  })

  test('①读日记 → ②书架提灯 → ③点灯 → ④下地下室', async ({ page }) => {
    let s = await act(page, { type: 'read', objectId: 'obj_study_diary' })
    expect(s.stage).toBe('find_light')
    expect(s.flags.clue_diary).toBe(true)
    expect(s.journalCount).toBeGreaterThanOrEqual(1)

    s = await act(page, { type: 'search', objectId: 'obj_study_bookshelf' })
    expect(s.stage).toBe('light_it')
    expect(s.inventory).toContain('lantern')

    // 书房视觉回归（提灯入手，3D 渲染稳定后）
    await page.waitForTimeout(3000)
    await expect(page).toHaveScreenshot('study-room.png', { maxDiffPixelRatio: 0.05 })

    s = await act(page, { type: 'toggle_lantern' })
    expect(s.stage).toBe('descend')
    expect(s.lanternLit).toBe(true)

    s = await act(page, { type: 'use', objectId: 'obj_study_floor_door' })
    expect(s.stage).toBe('illuminate')
    expect(s.zone).toBe('zone_basement')
  })

  test('⑤转盘 3-1-2 → ⑥暗门 → 密室', async ({ page }) => {
    // 快进到 illuminate（复用受控钩子链）
    await act(page, { type: 'read', objectId: 'obj_study_diary' })
    await act(page, { type: 'search', objectId: 'obj_study_bookshelf' })
    await act(page, { type: 'toggle_lantern' })
    let s = await act(page, { type: 'use', objectId: 'obj_study_floor_door' })
    expect(s.zone).toBe('zone_basement')
    // 三线索（转盘 conditions 依赖）
    await act(page, { type: 'inspect', objectId: 'obj_basement_shower' })
    await act(page, { type: 'inspect', objectId: 'obj_basement_mural' })
    await act(page, { type: 'inspect', objectId: 'obj_basement_basin' })

    // 地下室视觉回归（提灯照亮）
    await page.waitForTimeout(5000)
    await expect(page).toHaveScreenshot('basement-lit.png', { maxDiffPixelRatio: 0.05 })

    s = await act(page, { type: 'dial', objectId: 'obj_basement_dial_3' })
    s = await act(page, { type: 'dial', objectId: 'obj_basement_dial_1' })
    s = await act(page, { type: 'dial', objectId: 'obj_basement_dial_2' })
    expect(s.stage).toBe('chamber')
    expect(s.flags.dials_solved).toBe(true)

    s = await act(page, { type: 'use', objectId: 'obj_basement_secret_door' })
    expect(s.zone).toBe('zone_chamber')
    expect(s.flags.secret_open).toBe(true)
  })

  test('⑦石台结局 → complete', async ({ page }) => {
    await act(page, { type: 'read', objectId: 'obj_study_diary' })
    await act(page, { type: 'search', objectId: 'obj_study_bookshelf' })
    await act(page, { type: 'toggle_lantern' })
    await act(page, { type: 'use', objectId: 'obj_study_floor_door' })
    // 三线索 inspect（转盘 conditions 依赖 clue_symbols/clue_basin——同测试 ⑤ 的护栏链）
    await act(page, { type: 'inspect', objectId: 'obj_basement_shower' })
    await act(page, { type: 'inspect', objectId: 'obj_basement_mural' })
    await act(page, { type: 'inspect', objectId: 'obj_basement_basin' })
    await act(page, { type: 'dial', objectId: 'obj_basement_dial_3' })
    await act(page, { type: 'dial', objectId: 'obj_basement_dial_1' })
    await act(page, { type: 'dial', objectId: 'obj_basement_dial_2' })
    await act(page, { type: 'use', objectId: 'obj_basement_secret_door' })
    const s = await act(page, { type: 'use', objectId: 'obj_chamber_pedestal' })
    expect(s.stage).toBe('complete')
    expect(s.flags.ending_seen).toBe(true)
  })
})
