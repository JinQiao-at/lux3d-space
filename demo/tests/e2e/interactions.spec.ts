import { expect, test } from '@playwright/test'
import { act, getState, startGame } from './helpers/hooks'

/** T-034 交互验收：无指针锁后——点击不弹暂停 / Esc 开关暂停 / 灵敏度滑条生效。 */
test.describe('交互验收（无指针锁）', () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page)
  })

  test('点击画布不弹暂停（pointer lock 移除后核心验收）', async ({ page }) => {
    await page.mouse.click(640, 400)
    await page.waitForTimeout(800)
    const s = await getState(page)
    expect(s.panel, '点击画布不得打开暂停菜单').toBe('none')
    // 点击仍可正常交互（画布中心对准书桌附近触发剧情）
    await act(page, { type: 'read', objectId: 'obj_study_diary' })
    const after = await getState(page)
    expect(after.stage).toBe('find_light')
    expect(after.panel).toBe('none')
  })

  test('Esc 单独按 → 打开暂停；再按 → 关闭', async ({ page }) => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    expect((await getState(page)).panel).toBe('pause')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    expect((await getState(page)).panel).toBe('none')
  })

  test('暂停菜单「继续探索」正常关闭并恢复交互', async ({ page }) => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    const resume = page.getByRole('button', { name: '继续探索' })
    await expect(resume).toBeVisible()
    await resume.click()
    await page.waitForTimeout(600)
    const s = await getState(page)
    expect(s.panel).toBe('none')
    // 恢复后剧情可继续（不被锁死）
    const after = await act(page, { type: 'read', objectId: 'obj_study_diary' })
    expect(after.stage).toBe('find_light')
  })

  test('灵敏度滑条功能保留（调整后写入 settings）', async ({ page }) => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    const slider = page.locator('input[type="range"]').first()
    await slider.fill('1.8')
    await page.waitForTimeout(400)
    // 灵敏度存于 game.settings.sensitivity——通过存档 JSON 验证
    const saved = await page.evaluate(() => localStorage.getItem('lux3d.save.v1'))
    expect(saved).toContain('"sensitivity"')
    const parsed = JSON.parse(saved!) as { settings: { sensitivity: number } }
    expect(parsed.settings.sensitivity).toBe(1.8)
  })
})
