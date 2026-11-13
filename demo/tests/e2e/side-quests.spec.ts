import { expect, test } from '@playwright/test'
import { act, getState, startGame } from './helpers/hooks'

test.describe('支线 3 条 + 隐藏残页', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page)
    // 书架暗格的 conditions 依赖 clue_diary——支线测试统一先读日记
    await act(page, { type: 'read', objectId: 'obj_study_diary' })
  })

  test('支线 1：二搜书架得黄铜钥匙', async ({ page }) => {
    await act(page, { type: 'search', objectId: 'obj_study_bookshelf' })
    const s = await act(page, { type: 'search', objectId: 'obj_study_bookshelf' })
    expect(s.inventory).toContain('brass_key')
  })

  test('支线 2：钥匙 × 洗手台暗格（需带灯到地下室）', async ({ page }) => {
    await act(page, { type: 'search', objectId: 'obj_study_bookshelf' })
    await act(page, { type: 'toggle_lantern' })
    await act(page, { type: 'use', objectId: 'obj_study_floor_door' })
    const s = await act(page, { type: 'use_item_on', objectId: 'obj_basement_basin', itemId: 'brass_key' })
    expect(s.flags.basin_compartment_open).toBe(true)
  })

  test('支线 3：挂毯两段 → A16-025 镜厅钩子', async ({ page }) => {
    // 快进到密室
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
    await act(page, { type: 'search', objectId: 'obj_chamber_tapestry' })
    const s = await act(page, { type: 'search', objectId: 'obj_chamber_tapestry' })
    expect(s.flags.tapestry_looked).toBe(true)
    expect(s.logTail.join(' ')).toContain('A16-025')
  })

  test('隐藏残页：画框二搜 + 集齐低语', async ({ page }) => {
    // 画框（书房）二搜得残页一
    await act(page, { type: 'search', objectId: 'obj_study_painting' })
    const p1 = await act(page, { type: 'search', objectId: 'obj_study_painting' })
    expect(p1.flags.hidden_page_painting).toBe(true)
    // 直接补 shower/basin 两页（自由键走 API），再调查任意对象触发集齐
    await page.evaluate(() => {
      const store = (window as unknown as { __store?: { getState: () => { game: { flags: Record<string, boolean> } } } }).__store
      const g = store!.getState().game
      g.flags.hidden_page_shower = true
      g.flags.hidden_page_basin = true
    })
    const third = await act(page, { type: 'inspect', objectId: 'obj_study_desk' })
    expect(third.flags.hidden_assembly_done).toBe(true)
    expect(third.logTail.join(' ')).toContain('A16-025')
    // getState 快照一致性
    const s = await getState(page)
    expect(s.stage).toBe(third.stage)
  })
})
