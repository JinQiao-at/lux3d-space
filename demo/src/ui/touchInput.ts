/**
 * 触屏输入抽象（T-035，Zork touch-controls 适配）：pointerId 多指角色分配。
 *
 * - 左半屏首指 → move（虚拟摇杆）；右半屏首指 → look（滑动视角）；其余指 guard（忽略）；
 * - 摇杆输出归一化向量（-1~1，推远=跑由 Player 按长度判定）；
 * - look 输出增量 dx/dy（像素，接环视管道 ×sensitivity）；
 * - 纯逻辑：不依赖 DOM，可直接 node:test 单测（多指独立/第二指不抢占/增量而非起点/回中）。
 */

export type TouchRole = 'move' | 'look'

export interface TouchMoveState {
  /** 摇杆向量 x（-1~1，屏幕左=负） */
  x: number
  /** 摇杆向量 y（-1~1，屏幕上=前进） */
  y: number
  active: boolean
}

interface PointerRecord {
  role: TouchRole
  lastX: number
  lastY: number
}

const JOYSTICK_RADIUS = 56

export class TouchInput {
  private pointers = new Map<number, PointerRecord>()
  private movePointer: number | null = null
  private lookPointer: number | null = null
  private moveCenter: { x: number; y: number } = { x: 0, y: 0 }
  private moveState: TouchMoveState = { x: 0, y: 0, active: false }

  /** 按下：按落点分配角色（左半屏=摇杆，右半屏=视角；同角色已被占用则 guard 忽略）。 */
  down(pointerId: number, x: number, y: number, viewportWidth: number): void {
    if (this.pointers.has(pointerId)) return
    const role: TouchRole = x <= viewportWidth / 2 ? 'move' : 'look'
    if (role === 'move' && this.movePointer !== null) return
    if (role === 'look' && this.lookPointer !== null) return
    this.pointers.set(pointerId, { role, lastX: x, lastY: y })
    if (role === 'move') {
      this.movePointer = pointerId
      this.moveCenter = { x, y }
      this.moveState = { x: 0, y: 0, active: true }
    } else {
      this.lookPointer = pointerId
    }
  }

  /** 移动：move 指更新摇杆向量；look 指返回视角增量（像素差值，非起点）。 */
  move(pointerId: number, x: number, y: number): { lookDx: number; lookDy: number } {
    const record = this.pointers.get(pointerId)
    if (!record) return { lookDx: 0, lookDy: 0 }
    const dx = x - record.lastX
    const dy = y - record.lastY
    record.lastX = x
    record.lastY = y
    if (record.role === 'move' && pointerId === this.movePointer) {
      const vx = x - this.moveCenter.x
      const vy = y - this.moveCenter.y
      const dist = Math.hypot(vx, vy) || 1
      const clamped = Math.min(dist, JOYSTICK_RADIUS)
      this.moveState = {
        x: (vx / dist) * (clamped / JOYSTICK_RADIUS) + 0,
        y: -(vy / dist) * (clamped / JOYSTICK_RADIUS) + 0,
        active: true,
      }
    }
    return record.role === 'look' && pointerId === this.lookPointer
      ? { lookDx: dx, lookDy: dy }
      : { lookDx: 0, lookDy: 0 }
  }

  /** 抬起：释放角色；摇杆回中。 */
  up(pointerId: number): void {
    const record = this.pointers.get(pointerId)
    if (!record) return
    if (record.role === 'move' && pointerId === this.movePointer) {
      this.movePointer = null
      this.moveState = { x: 0, y: 0, active: false }
    }
    if (record.role === 'look' && pointerId === this.lookPointer) {
      this.lookPointer = null
    }
    this.pointers.delete(pointerId)
  }

  getMove(): TouchMoveState {
    return { ...this.moveState }
  }

  /** 当前是否有视角指在屏（环视增量由 move() 返回值驱动，此状态供 UI 提示）。 */
  get looking(): boolean {
    return this.lookPointer !== null
  }
}

/** 触屏检测（Zork 同款公式）：粗指针设备或无悬停能力的多点触屏。 */
export function prefersTouchControls(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    (navigator.maxTouchPoints > 0 && window.matchMedia('(hover: none)').matches)
  )
}
