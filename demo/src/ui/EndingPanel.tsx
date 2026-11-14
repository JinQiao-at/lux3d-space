import { useState } from 'react'
import { ENDING, ENDING_VARIANTS, ENDING_STATS_LABELS, TITLE } from '../data/narrative.ts'
import { formatPlayTime } from '../game/save.ts'
import { ZONE_NAMES } from '../game/types.ts'
import { useGameStore } from '../game/store.ts'

/** 结局面板：结局文本 + 双结局选择（P1-B）+ 统计 + 重新开始/记忆回廊。 */
export function EndingPanel() {
  const game = useGameStore((state) => state.game)
  const closePanel = useGameStore((state) => state.closePanel)
  const restart = useGameStore((state) => state.restart)
  const dispatch = useGameStore((state) => state.dispatch)
  const [chosen, setChosen] = useState<'kept' | 'blew' | null>(
    game.flags.ending_keep ? 'kept' : game.flags.ending_blow ? 'blew' : null,
  )

  const choose = (variant: 'kept' | 'blew') => {
    dispatch({ type: variant === 'kept' ? 'keep_lantern' : 'blow_lantern' })
    setChosen(variant)
  }

  const variant = chosen ? ENDING_VARIANTS[chosen] : null

  return (
    <div className="modal-overlay ending-overlay" role="dialog" aria-modal="true" aria-label="结局">
      <div className="ending-card">
        <p className="ending-kicker">{TITLE} · 结局</p>
        <h2 className="ending-title">{ENDING.title}</h2>
        <p className="ending-subtitle">{ENDING.subtitle}</p>
        <div className="ending-lines">
          {ENDING.lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <p className="ending-achievement">{ENDING.achievement}</p>

        {/* P1-B 双结局：未选择时给出最终抉择，选择后展示变体文案 */}
        {!chosen && (
          <div className="ending-choice">
            <p className="muted">最后一件事：这盏灯，你打算怎么处理？</p>
            <div className="ending-actions">
              <button className="primary-button" onClick={() => choose('kept')}>
                守着灯（keep_lantern）
              </button>
              <button className="ghost-button" onClick={() => choose('blew')}>
                吹灭它（blow_lantern）
              </button>
            </div>
          </div>
        )}
        {variant && (
          <div className="ending-variant">
            <h3 className="ending-variant-title">· {variant.title} ·</h3>
            <div className="ending-lines">
              {variant.lines.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
            <p className="ending-achievement">{variant.achievement}</p>
          </div>
        )}

        <dl className="ending-stats">
          <div>
            <dt>{ENDING_STATS_LABELS.playTime}</dt>
            <dd>{formatPlayTime(game.playTime)}</dd>
          </div>
          <div>
            <dt>{ENDING_STATS_LABELS.hints}</dt>
            <dd>{game.hintsUsed} 次</dd>
          </div>
          <div>
            <dt>{ENDING_STATS_LABELS.zones}</dt>
            <dd>{game.visited.map((zoneId) => ZONE_NAMES[zoneId as keyof typeof ZONE_NAMES]).join(' / ')}</dd>
          </div>
          <div>
            <dt>{ENDING_STATS_LABELS.journal}</dt>
            <dd>{game.journal.length} 条</dd>
          </div>
        </dl>
        <div className="ending-actions">
          <button
            className="primary-button"
            onClick={() => {
              restart()
            }}
          >
            重新开始
          </button>
          <button
            className="ghost-button"
            onClick={() => useGameStore.getState().setPanel('memory')}
          >
            进入记忆回廊
          </button>
          <button
            className="ghost-button"
            onClick={() => {
              closePanel()
            }}
          >
            继续探索密室
          </button>
        </div>
      </div>
    </div>
  )
}
