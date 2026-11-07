import { ENDING, ENDING_STATS_LABELS, TITLE } from '../data/narrative.ts'
import { formatPlayTime } from '../game/save.ts'
import { ZONE_NAMES } from '../game/types.ts'
import { useGameStore } from '../game/store.ts'
import { requestScenePointerLock } from './dom.ts'

/** 结局面板：结局文本 + 统计 + 重新开始。 */
export function EndingPanel() {
  const game = useGameStore((state) => state.game)
  const closePanel = useGameStore((state) => state.closePanel)
  const restart = useGameStore((state) => state.restart)

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
              requestScenePointerLock()
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
              requestScenePointerLock()
            }}
          >
            继续探索密室
          </button>
        </div>
      </div>
    </div>
  )
}
