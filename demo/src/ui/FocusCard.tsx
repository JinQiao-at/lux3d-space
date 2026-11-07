import { useGameStore } from '../game/store.ts'

/** 镜头定位浮层：覆盖全屏，防止点击误锁定指针；点击空白/按钮返回漫游。 */
export function FocusCard() {
  const focus = useGameStore((state) => state.focus)
  const tour = useGameStore((state) => state.tour)
  const clearFocus = useGameStore((state) => state.clearFocus)
  const stopTour = useGameStore((state) => state.stopTour)
  const advanceTour = useGameStore((state) => state.advanceTour)

  if (!focus) return null

  return (
    <div
      className="focus-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          if (tour) stopTour()
          else clearFocus()
        }
      }}
    >
      <div className="focus-top">
        <span>镜头定位 · {focus.title}</span>
        <span>{tour ? `导览 ${tour.index + 1}/${tour.stops.length}` : '按 Esc 或点击空白处返回漫游'}</span>
      </div>
      <div className="focus-card">
        <h3>{focus.title}</h3>
        {focus.entry ? (
          <>
            <p className="focus-meta">
              [{focus.entry.id}] · {focus.entry.topics.join(' / ')} · 来源：{focus.entry.sources.join('；')}
            </p>
            <p className="focus-content">{focus.entry.content}</p>
          </>
        ) : (
          <p className="focus-content">镜头已经对准这个物件。返回漫游后可以走近调查。</p>
        )}
        <div className="focus-actions">
          {tour && (
            <button className="primary-button" onClick={advanceTour}>
              下一站
            </button>
          )}
          <button
            className="ghost-button"
            onClick={() => {
              if (tour) stopTour()
              else clearFocus()
            }}
          >
            {tour ? '结束导览' : '返回漫游'}
          </button>
        </div>
      </div>
    </div>
  )
}
