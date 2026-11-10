import { useEffect } from 'react'
import { ZONES } from '../data/scene.ts'
import { STAGE_META } from '../data/narrative.ts'
import { OBJECTS } from '../data/scene.ts'
import { dialProgressText } from '../game/actions.ts'
import { isDark, useGameStore } from '../game/store.ts'

const ACTION_LABEL: Record<string, string> = {
  inspect: '调查',
  read: '阅读',
  search: '搜索',
  use: '使用',
  dial: '拨动',
}

/** 常驻 HUD：目标、区域、准星、交互提示、提灯状态、转盘进度、快捷键、Toast。 */
export function HUD() {
  const game = useGameStore((state) => state.game)
  const panel = useGameStore((state) => state.panel)
  const focus = useGameStore((state) => state.focus)
  const interaction = useGameStore((state) => state.interaction)
  const toast = useGameStore((state) => state.toast)
  const clearToast = useGameStore((state) => state.clearToast)
  const openPanel = useGameStore((state) => state.openPanel)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => clearToast(), 2800)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  const meta = STAGE_META[game.stage]
  const object = interaction ? OBJECTS[interaction.objectId] : null
  const dialText = dialProgressText(game)
  const exploring = !focus && panel === 'none'

  // P1-A1 开发期 GL 性能角标（renderer.info 每秒轮询；生产构建不渲染）
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const el = document.getElementById('gl-profiler')
    if (!el) return
    const timer = setInterval(() => {
      const info = (window as unknown as { __glInfo?: { render: { calls: number; triangles: number }; memory: { geometries: number; textures: number } } }).__glInfo
      if (info) el.textContent = `DC ${info.render.calls} · Tris ${(info.render.triangles / 1000).toFixed(0)}k · Geo ${info.memory.geometries}`
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      {/* 暗背景可读性：上下渐变 scrim，保证 HUD 不压在亮部上 */}
      <div className="hud-scrim hud-scrim-top" aria-hidden="true" />
      <div className="hud-scrim hud-scrim-bottom" aria-hidden="true" />
      {import.meta.env.DEV && <div id="gl-profiler" className="gl-profiler" aria-hidden="true" />}

      <div className="hud hud-top-left">
        <div className="zone-name">
          {ZONES[game.zone].name} <span className="zone-sub">{ZONES[game.zone].subtitle}</span>
        </div>
        <div className="objective">
          <span className="objective-label">目标 · {meta.title}</span>
          <span className="objective-text">{meta.objective}</span>
        </div>
      </div>

      <div className="hud hud-top-right">
        <button className="hud-button" onClick={() => openPanel('archive')}>
          档案 <kbd>Tab</kbd>
        </button>
        <button className="hud-button" onClick={() => openPanel('journal')}>
          日记 <kbd>J</kbd>
        </button>
        <button className="hud-button" onClick={() => openPanel('map')}>
          地图 <kbd>M</kbd>
        </button>
        <button className="hud-button" onClick={() => openPanel('agent')}>
          Agent <kbd>F</kbd>
        </button>
        <button className="hud-button" onClick={() => openPanel('pause')}>
          暂停 <kbd>Esc</kbd>
        </button>
      </div>

      {exploring && <div className="crosshair" aria-hidden="true" />}

      {exploring && object && (
        <div className={`interaction-prompt ${interaction?.ready ? '' : 'is-blocked'}`}>
          <kbd>E</kbd> {ACTION_LABEL[object.action] ?? '查看'} · {object.name}
          {!interaction?.ready && <span className="interaction-blocked">（条件未满足）</span>}
        </div>
      )}

      <div className="hud hud-bottom-left">
        <div className="controls-legend">
          <span>
            <kbd>WASD</kbd> 移动
          </span>
          <span>
            <kbd>鼠标</kbd> 环视
          </span>
          <span>
            <kbd>Shift</kbd> 快走
          </span>
          <span>
            <kbd>E</kbd> 交互
          </span>
          <span>
            <kbd>L</kbd> 提灯
          </span>
          <span>
            <kbd>Tab</kbd> 档案
          </span>
          <span>
            <kbd>J</kbd> 日记
          </span>
          <span>
            <kbd>M</kbd> 地图
          </span>
          {game.inventory.includes('brass_key') && (
            <span>
              <kbd>K</kbd> 用钥匙
            </span>
          )}
          <span>
            <kbd>F</kbd> Agent
          </span>
          <span>
            <kbd>Esc</kbd> 暂停
          </span>
        </div>
      </div>

      <div className="hud hud-bottom-right">
        <div className={`lantern-chip ${game.lanternLit ? 'is-lit' : game.flags.has_lantern ? 'is-held' : ''}`}>
          <span className="lantern-dot" />
          提灯：{game.lanternLit ? '已点亮' : game.flags.has_lantern ? '未点亮（L）' : '尚未获得'}
        </div>
        {game.zone === 'zone_basement' && <div className="dial-chip">转盘序列：{dialText}</div>}
        <div className="hint-chip">提示次数：{game.hintsUsed}</div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}

/** 地下室无光 / 黑暗反馈的全屏遮罩。 */
export function DarknessOverlay() {
  const game = useGameStore((state) => state.game)
  const darknessAt = useGameStore((state) => state.darknessAt)
  const dark = isDark(game, darknessAt)

  useEffect(() => {
    if (Date.now() - darknessAt >= 1600) return
    const timer = setTimeout(() => useGameStore.setState({ darknessAt: 0 }), 1700)
    return () => clearTimeout(timer)
  }, [darknessAt])

  if (!dark) return null

  return (
    <div className="darkness-overlay">
      <div className="darkness-text">
        伸手不见五指。
        <span>提灯是唯一能带下去的光。</span>
      </div>
    </div>
  )
}
