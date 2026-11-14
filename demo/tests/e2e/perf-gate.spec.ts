import { expect, test } from '@playwright/test'
import { startGame } from './helpers/hooks'

/**
 * 性能守门（任务③）：DC<50 · Tris<1M · FPS≥30。
 * 基线（2026-11-13）：DC 40 · Tris 317k · FPS 39（书房，17 GLB 全载+材质池前）。
 * 任何渲染特性提交后此测试必须保持绿——反弹即 BLOCKED。
 */

interface GlInfo {
  render: { calls: number; triangles: number }
  memory: { geometries: number; textures: number }
}

async function readGlInfo(page: import('@playwright/test').Page): Promise<GlInfo | null> {
  return page.evaluate(() => (window as unknown as { __glInfo?: GlInfo }).__glInfo ?? null)
}

test.describe('性能守门', () => {
  test('书房场景：DC<50 / Tris<1M（GLB 全载稳定后）', async ({ page }) => {
    await startGame(page)
    await page.waitForTimeout(5000) // 17 GLB 加载 + 场景稳定
    const info = await readGlInfo(page)
    expect(info, 'window.__glInfo 未挂载（App.tsx onCreated）').toBeTruthy()
    expect(info!.render.calls, `DrawCall ${info!.render.calls} 应 < 50`).toBeLessThan(50)
    expect(info!.render.triangles, `Tris ${info!.render.triangles} 应 < 1M`).toBeLessThan(1_000_000)
  })

  test('书房场景：FPS ≥ 30（rAF 2s 采样）', async ({ page }) => {
    await startGame(page)
    await page.waitForTimeout(5000)
    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0
          const t0 = performance.now()
          const tick = () => {
            frames++
            if (performance.now() - t0 < 2000) requestAnimationFrame(tick)
            else resolve(Math.round(frames / ((performance.now() - t0) / 1000)))
          }
          requestAnimationFrame(tick)
        }),
    )
    expect(fps, `FPS ${fps} 应 ≥ 30`).toBeGreaterThanOrEqual(30)
  })
})
