import { useEffect, useState } from 'react'
import type { LogLine } from '../game/store.ts'
import { useGameStore } from '../game/store.ts'
import { TITLE_EN } from '../data/narrative.ts'

/** 是否开启“减少动态效果”（系统偏好）；typewriter / 淡入会因此关闭。 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 单行叙事：逐字 reveal（打字机式，轻量 state）。
 * - 每行挂载时从 0 开始露出，完成后停止定时器；
 * - 系统 prefers-reduced-motion: reduce 时直接整行显示；
 * - aria-label 提供完整文本，屏幕阅读器不会被逐字刷新打扰。
 */
function NarrationLine({ line }: { line: LogLine }) {
  const [revealed, setRevealed] = useState(() => (prefersReducedMotion() ? line.text.length : 0))

  useEffect(() => {
    if (prefersReducedMotion()) {
      setRevealed(line.text.length)
      return
    }
    setRevealed(0)
    const total = line.text.length
    // 长句加速：约 42 帧内完成一行（22ms/帧 ≈ 1s），避免长文本拖慢节奏
    const step = Math.max(1, Math.ceil(total / 42))
    let cursor = 0
    const timer = window.setInterval(() => {
      cursor = Math.min(total, cursor + step)
      setRevealed(cursor)
      if (cursor >= total) window.clearInterval(timer)
    }, 22)
    return () => window.clearInterval(timer)
  }, [line.id, line.text])

  const done = revealed >= line.text.length

  return (
    <p
      className={`narration-line kind-${line.kind} ${done ? 'is-complete' : ''}`}
      aria-label={line.text}
    >
      <span aria-hidden="true">{line.text.slice(0, revealed)}</span>
      {!done && <span className="narration-caret" aria-hidden="true" />}
    </p>
  )
}

/** 底部居中叙事气泡（用户模板样式：12vh 处半透明黑底单条 + serif + 打字机 reveal）。
 * aria-live 容器保留（E2E/读屏依赖）；历史多条仍可在日记面板查阅。 */
export function NarrationLog() {
  const log = useGameStore((state) => state.log)
  const visible = log.slice(-1)
  if (visible.length === 0) return null
  return (
    <div className="narration-log" aria-live="polite">
      {visible.map((line) => (
        <NarrationLine key={line.id} line={line} />
      ))}
    </div>
  )
}

/** 漫游键位提示（T-034：无指针锁后常显轻提示，不拦截点击）。 */
export function ClickHint() {
  const started = useGameStore((state) => state.started)
  const panel = useGameStore((state) => state.panel)
  const focus = useGameStore((state) => state.focus)
  if (!started || panel !== 'none' || focus) return null
  return (
    <div className="click-hint" aria-hidden="true">
      点击画面调查 · Esc 暂停
      <span>{TITLE_EN}</span>
    </div>
  )
}
