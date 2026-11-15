import { useEffect, useRef, useState } from 'react'
import { prefersTouchControls, TouchInput } from './touchInput.ts'
import { OBJECTS } from '../data/scene.ts'
import { useGameStore } from '../game/store.ts'

/**
 * 触屏控制层（T-035，Zork touch-controls 适配）：左下虚拟摇杆 + 右下动作按钮。
 * - 仅 prefersTouchControls() 为真时渲染（桌面完全不变）；
 * - 摇杆向量写入 store.touchMove（Player useFrame 读取并入 resolveMovement）；
 * - look 增量直接驱动相机（与 Player 的 mousemove 环视同管道 ×sensitivity）；
 * - 动作按钮 dispatch 等价键盘（E 交互 / L 提灯），不新增状态机分支。
 */

export const touchInput = new TouchInput()

/** 触屏开关（模块级一次性检测；SSR 安全）。 */
export const TOUCH_MODE = typeof window !== 'undefined' && prefersTouchControls()

/** 供 Player useFrame 读取的摇杆状态引用（避免每帧 store 订阅）。 */
export function getTouchMove(): { x: number; y: number; active: boolean } {
  return TOUCH_MODE ? touchInput.getMove() : { x: 0, y: 0, active: false }
}

/** look 增量暂存（Player useFrame 消费）。 */
const lookDelta = { dx: 0, dy: 0 }
export function consumeLookDelta(): { dx: number; dy: number } {
  const out = { dx: lookDelta.dx, dy: lookDelta.dy }
  lookDelta.dx = 0
  lookDelta.dy = 0
  return out
}

/** 触屏 HUD（摇杆 + 动作按钮）；panel 打开时隐藏。 */
export function TouchControls() {
  const panel = useGameStore((state) => state.panel)
  const started = useGameStore((state) => state.started)
  const focus = useGameStore((state) => state.focus)
  const dispatch = useGameStore((state) => state.dispatch)
  const interaction = useGameStore((state) => state.interaction)
  const lanternLit = useGameStore((state) => state.game.lanternLit)
  const hasLantern = useGameStore((state) => state.game.flags.has_lantern)
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const [visible] = useState(TOUCH_MODE)

  useEffect(() => {
    if (!visible) return
    const width = window.innerWidth
    const onDown = (event: PointerEvent) => {
      touchInput.down(event.pointerId, event.clientX, event.clientY, width)
      if (touchInput.getMove().active && stickRef.current) {
        stickRef.current.style.left = `${event.clientX - 64}px`
        stickRef.current.style.top = `${event.clientY - 64}px`
        stickRef.current.style.opacity = '0.55'
      }
    }
    const onMove = (event: PointerEvent) => {
      const { lookDx, lookDy } = touchInput.move(event.pointerId, event.clientX, event.clientY)
      if (lookDx || lookDy) {
        lookDelta.dx += lookDx
        lookDelta.dy += lookDy
      }
      const m = touchInput.getMove()
      if (m.active && knobRef.current) {
        const vx = Math.max(-1, Math.min(1, m.x))
        const vy = Math.max(-1, Math.min(1, m.y))
        knobRef.current.style.transform = `translate(${vx * 36}px, ${-vy * 36}px)`
      }
    }
    const onUp = (event: PointerEvent) => {
      touchInput.up(event.pointerId)
      if (!touchInput.getMove().active && stickRef.current) {
        stickRef.current.style.left = '28px'
        stickRef.current.style.top = ''
        stickRef.current.style.bottom = '28px'
        stickRef.current.style.opacity = '0.35'
        if (knobRef.current) knobRef.current.style.transform = 'none'
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [visible])

  if (!visible || !started || panel !== 'none' || focus) return null

  const tapInteract = () => {
    // 等价键盘 E：按物件 action 类型分派（dial/inspect/read/search/use）
    if (!interaction) return
    const object = OBJECTS[interaction.objectId]
    if (!object) return
    if (object.action === 'dial') {
      dispatch({ type: 'dial', objectId: object.id })
    } else {
      dispatch({ type: object.action as 'inspect' | 'read' | 'search' | 'use', objectId: object.id })
    }
  }

  return (
    <div className="touch-controls" aria-hidden="true">
      <div ref={stickRef} className="touch-stick">
        <div ref={knobRef} className="touch-knob" />
      </div>
      <div className="touch-actions">
        <button
          className="touch-btn"
          onClick={tapInteract}
          aria-label="交互"
          style={{ opacity: interaction ? 1 : 0.4 }}
        >
          交互
        </button>
        <button
          className="touch-btn"
          onClick={() => dispatch({ type: 'toggle_lantern' })}
          aria-label="提灯"
          style={{ opacity: hasLantern ? 1 : 0.3 }}
        >
          {lanternLit ? '熄灯' : '提灯'}
        </button>
      </div>
    </div>
  )
}
