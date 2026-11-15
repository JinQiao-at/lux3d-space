import { useEffect, useState } from 'react'
import { STAGE_META } from '../data/narrative.ts'
import { useGameStore } from '../game/store.ts'

/**
 * 电影化章节转场（沉浸式呈现重做）：stage 变化时黑场渐入 → 章节大字幕浮现 → 渐隐回到场景。
 * - arrival（开局）不触发（开场由 OpeningOverlay 承担）；
 * - complete 由 EndingPanel 承担；
 * - 纯表现层：不改状态机，转场期间剧情照常推进。
 */
export function ChapterTransition() {
  const stage = useGameStore((state) => state.game.stage)
  const [active, setActive] = useState<string | null>(null)
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden')

  useEffect(() => {
    if (stage === 'arrival' || stage === 'complete') return
    if (active === stage) return
    // stage 变化：黑场+章节字幕 in → 2.4s 后 out → 0.6s 后隐藏
    setActive(stage)
    setPhase('in')
    const t1 = setTimeout(() => setPhase('out'), 2400)
    const t2 = setTimeout(() => setPhase('hidden'), 3000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [stage, active])

  if (phase === 'hidden' || !active) return null
  const meta = STAGE_META[active as keyof typeof STAGE_META]
  if (!meta) return null

  return (
    <div className={`chapter-transition phase-${phase}`} aria-hidden="true">
      <p className="chapter-kicker">CHAPTER · {meta.title}</p>
      <p className="chapter-title">{meta.objective}</p>
    </div>
  )
}
