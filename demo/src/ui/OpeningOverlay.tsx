import { useEffect, useState } from 'react'
import { OPENING_LINES, STAGE_META } from '../data/narrative.ts'
import { useGameStore } from '../game/store.ts'

/**
 * Zork 式开场字幕浮层（任务：3D 叙事呈现相似化）——OPENING_LINES 居中逐行浮现于
 * 3D 场景之上，章节标签取 STAGE_META.arrival；点击/按键后淡出进入 HUD 漫游模式。
 * 纯表现层：叙事内容仍同步走 NarrationLog（log），浮层消失不影响状态机。
 */
export function OpeningOverlay() {
  const [lineCount, setLineCount] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  // 逐行浮现：每 1.1s 亮起一行
  useEffect(() => {
    if (lineCount >= OPENING_LINES.length) return
    const timer = setTimeout(() => setLineCount((n) => n + 1), 1100)
    return () => clearTimeout(timer)
  }, [lineCount])

  const dismiss = () => {
    if (dismissed) return
    setDismissed(true)
  }

  // Esc/点击均可退出
  useEffect(() => {
    if (dismissed) return
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape' || event.code === 'Space' || event.code === 'Enter') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (dismissed) return null
  const meta = STAGE_META.arrival

  return (
    <div className="opening-overlay" onClick={dismiss} role="presentation">
      <div className="opening-chapter">{meta.title} · {meta.objective}</div>
      <div className="opening-lines" aria-live="polite">
        {OPENING_LINES.slice(0, lineCount).map((line, index) => (
          <p key={index} className="opening-line">{line}</p>
        ))}
      </div>
      {lineCount >= OPENING_LINES.length && (
        <button className="ghost-button opening-continue" onClick={dismiss}>
          开始漫游（点击画面继续）
        </button>
      )}
      <div className="opening-brand">THE LANTERN AND THE HIDDEN DOOR · A16</div>
    </div>
  )
}

/** 挂载条件包装：游戏已开始、仍处 arrival 阶段、无面板打开。 */
export function OpeningOverlayGate() {
  const started = useGameStore((state) => state.started)
  const stage = useGameStore((state) => state.game.stage)
  const panel = useGameStore((state) => state.panel)
  if (!started || stage !== 'arrival' || panel !== 'none') return null
  return <OpeningOverlay />
}
