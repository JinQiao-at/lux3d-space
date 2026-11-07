import { HINTS, JOURNAL_ENTRIES, STAGE_META } from '../data/narrative.ts'
import { useGameStore } from '../game/store.ts'
import { Modal } from './Modal.tsx'

/**
 * 日记 + 三级提示（Zork 式 hint system）。
 * 结构改为“手稿纸”质感：纸色底、衬线正文、首行缩进、行间横线；
 * 提示区仍是工具性 UI，保持清晰可点。文案内容来自 data/narrative.ts，面板不写死文本。
 */
export function JournalPanel() {
  const game = useGameStore((state) => state.game)
  const closePanel = useGameStore((state) => state.closePanel)
  const dispatch = useGameStore((state) => state.dispatch)
  const hints = HINTS[game.stage]

  return (
    <Modal
      title="日记"
      subtitle={`当前阶段：${STAGE_META[game.stage].title} · ${STAGE_META[game.stage].objective}`}
      onClose={closePanel}
    >
      <section className="journal-manuscript" aria-label="日记手稿">
        <header className="journal-manuscript-head">
          <span className="journal-manuscript-mark">手稿 · MANUSCRIPT</span>
          <span className="journal-manuscript-count">
            已收集 {game.journal.length} / {Object.keys(JOURNAL_ENTRIES).length} 页
          </span>
        </header>

        {game.journal.length === 0 ? (
          <p className="journal-empty">日记还是空的。调查周围的东西，重要线索会自动记下来。</p>
        ) : (
          <ol className="journal-pages">
            {game.journal.map((entry, index) => (
              <li className="journal-page" key={entry.id}>
                <div className="journal-page-head">
                  <span className="journal-page-index">{String(index + 1).padStart(2, '0')}</span>
                  <h4>{entry.title}</h4>
                </div>
                <p className="journal-page-text">{entry.text}</p>
              </li>
            ))}
          </ol>
        )}

        <footer className="journal-manuscript-foot">灯亮起时，向低处看。</footer>
      </section>

      <section className="panel-section journal-hints">
        <h3>提示（已使用 {game.hintsUsed} 次）</h3>
        <p className="muted">三级提示逐级具体。使用提示不会影响主线推进，可以放心卡关。</p>
        <div className="hint-buttons">
          {[1, 2, 3].map((level) => (
            <button
              key={level}
              className="ghost-button"
              onClick={() => dispatch({ type: 'request_hint', level: level as 1 | 2 | 3 })}
            >
              提示 L{level}
            </button>
          ))}
        </div>
        <ol className="hint-preview">
          {hints.map((hint, index) => (
            <li key={index} className={index < Math.min(game.hintsUsed, 3) ? '' : 'muted'}>
              L{index + 1}：{index < Math.min(game.hintsUsed, 3) ? hint : '（使用后显示）'}
            </li>
          ))}
        </ol>
      </section>
    </Modal>
  )
}
