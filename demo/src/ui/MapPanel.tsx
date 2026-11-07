import { ZONES } from '../data/scene.ts'
import { ZONE_IDS, ZONE_NAMES } from '../game/types.ts'
import { useGameStore } from '../game/store.ts'
import { Modal } from './Modal.tsx'

/**
 * 地图面板（T-019，Zork 式 map/journal 导航）。
 * 纯数据驱动：zone 清单来自 scene.ts 的 ZONES；到访状态来自 state.visited；
 * 未到访的区域只显示名字与“未抵达”，不剧透内容。
 */
export function MapPanel() {
  const game = useGameStore((state) => state.game)
  const closePanel = useGameStore((state) => state.closePanel)

  return (
    <Modal title="屋子地图" subtitle={`已抵达 ${game.visited.length} / ${ZONE_IDS.length} 处 · M 或 Esc 关闭`} onClose={closePanel}>
      <section className="panel-section" aria-label="区域列表">
        <p className="muted">
          这间屋子的每一层都通向更低的一层。去过的位置会亮着；没去过的地方，先别想它。
        </p>
        <ol className="map-zones">
          {ZONE_IDS.map((zoneId, index) => {
            const zone = ZONES[zoneId]
            const visited = game.visited.includes(zoneId)
            const current = game.zone === zoneId
            return (
              <li key={zoneId} className={`map-zone ${visited ? 'map-zone-visited' : 'map-zone-locked'}`}>
                <div className="map-zone-head">
                  <span className="map-zone-index">{String(index + 1).padStart(2, '0')}</span>
                  <h4>
                    {ZONE_NAMES[zoneId]}
                    {current && <span className="map-zone-badge">· 当前位置</span>}
                  </h4>
                </div>
                <p className="map-zone-desc">
                  {visited ? zone.description : '尚未抵达。灯能到的地方，你才能到。'}
                </p>
                {visited && (
                  <p className="map-zone-meta muted">
                    {zone.subtitle} · 需要{zone.needsLantern ? '提灯' : '—'}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </Modal>
  )
}
