import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TouchInput } from '../src/ui/touchInput.ts'

test('T-035 触屏分配：左半屏首指=摇杆、右半屏首指=视角，角色互不抢占', () => {
  const t = new TouchInput()
  t.down(1, 150, 400, 800) // 左半屏 → move
  t.down(2, 650, 400, 800) // 右半屏 → look
  // 第二根左指不抢占 move
  t.down(3, 100, 200, 800)
  const move = t.getMove()
  assert.equal(move.active, true)
  // move 指移动产生摇杆向量；look 指移动产生视角增量
  t.move(1, 180, 400) // 右推 30px（半径 56 内）
  const m = t.getMove()
  assert.ok(m.x > 0 && m.x <= 1, `摇杆 x 应为正 ${m.x}`)
  assert.equal(m.y, 0)
  const look = t.move(2, 700, 380) // look 指移动 dx=50, dy=-20
  assert.equal(look.lookDx, 50)
  assert.equal(look.lookDy, -20)
  // guard 指（3）移动不产生任何增量
  const guard = t.move(3, 200, 300)
  assert.equal(guard.lookDx, 0)
  assert.equal(guard.lookDy, 0)
})

test('T-035 摇杆增量语义：移动返回像素差值（非起点），半径钳制归一化', () => {
  const t = new TouchInput()
  t.down(1, 150, 400, 800)
  // 推远超半径（>56px）→ 向量钳制为长度 1
  t.move(1, 150, 300) // 上推 100px
  const m = t.getMove()
  assert.ok(m.y > 0.9 && m.y <= 1, `推远应钳制到 1（实际 ${m.y}）`)
  // 抬起回中
  t.up(1)
  assert.equal(t.getMove().active, false)
  assert.equal(t.getMove().x, 0)
})

test('T-035 多指独立：look 抬起后 move 不受影响；move 抬起后 look 继续工作', () => {
  const t = new TouchInput()
  t.down(1, 150, 400, 800) // move
  t.down(2, 650, 400, 800) // look
  t.up(2) // look 抬起
  t.move(1, 180, 400)
  assert.ok(t.getMove().x > 0, 'look 抬起不影响摇杆')
  // 重新按下 look（新 pointerId）
  t.down(4, 700, 500, 800)
  const look = t.move(4, 760, 500)
  assert.equal(look.lookDx, 60)
  t.up(1) // move 抬起
  t.move(4, 800, 500) // look 继续工作
  const look2 = t.move(4, 820, 500)
  assert.equal(look2.lookDx, 20)
})

test('T-035 未知 pointerId 移动安全返回零增量', () => {
  const t = new TouchInput()
  const r = t.move(99, 100, 100)
  assert.deepEqual(r, { lookDx: 0, lookDy: 0 })
  t.up(99) // 不抛异常
})
