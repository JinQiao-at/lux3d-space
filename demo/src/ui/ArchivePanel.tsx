import { useMemo, useState } from 'react'
import type { ZoneId } from '../game/types.ts'
import { ZONE_NAMES } from '../game/types.ts'
import { KNOWLEDGE_BASE, focusTargetOf, listTopics, searchKnowledge } from '../data/knowledge.ts'
import { useGameStore } from '../game/store.ts'
import { Modal } from './Modal.tsx'

const CONFIDENCE_LABEL: Record<string, string> = {
  verified: '已验证',
  inferred: '推断',
  uncertain: '待验证',
}

/** 档案检索：关键词 + topic 过滤 → 点击结果高亮对象 + 镜头 tween；另带自动导览。 */
export function ArchivePanel() {
  const closePanel = useGameStore((state) => state.closePanel)
  const focusKnowledge = useGameStore((state) => state.focusKnowledge)
  const startTour = useGameStore((state) => state.startTour)
  const game = useGameStore((state) => state.game)
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('')
  const [zone, setZone] = useState<'' | ZoneId>('')

  const topics = useMemo(() => listTopics(KNOWLEDGE_BASE), [])
  const results = useMemo(
    () =>
      searchKnowledge(query, {
        topic: topic || undefined,
        zoneId: zone || undefined,
      }),
    [query, topic, zone],
  )

  return (
    <Modal
      title="档案检索"
      subtitle={`ECO 信息组织：${KNOWLEDGE_BASE.length} 条知识条目 · 检索结果可直接定位到 3D 空间`}
      onClose={closePanel}
      wide
    >
      <div className="archive-controls">
        <input
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索关键词，例如：提灯 / 符号 / 浮雕 / 暗门 / A16-023"
          aria-label="档案关键词"
          autoFocus
        />
        <select className="select-input" value={zone} onChange={(event) => setZone(event.target.value as '' | ZoneId)}>
          <option value="">全部区域</option>
          {(Object.keys(ZONE_NAMES) as ZoneId[]).map((zoneId) => (
            <option key={zoneId} value={zoneId}>
              {ZONE_NAMES[zoneId]}
            </option>
          ))}
        </select>
        <button className="primary-button" onClick={startTour}>
          自动导览
        </button>
      </div>

      <div className="topic-chips">
        <button className={`topic-chip ${topic === '' ? 'is-active' : ''}`} onClick={() => setTopic('')}>
          全部主题
        </button>
        {topics.map((item) => (
          <button
            key={item}
            className={`topic-chip ${topic === item ? 'is-active' : ''}`}
            onClick={() => setTopic(item === topic ? '' : item)}
          >
            {item}
          </button>
        ))}
      </div>

      <p className="muted archive-count">
        命中 {results.length} 条{game.zone ? ` · 当前位于「${ZONE_NAMES[game.zone]}」` : ''}
      </p>

      <ul className="archive-results">
        {results.map((entry, index) => {
          const target = focusTargetOf(entry)
          return (
            <li key={entry.id}>
              <button
                className="archive-result"
                onClick={() => focusKnowledge(entry)}
                title={`定位到 ${target.cameraId}`}
              >
                <div className="archive-result-head">
                  <span className="archive-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="archive-title">{entry.title}</span>
                  <span className={`confidence confidence-${entry.confidence}`}>{CONFIDENCE_LABEL[entry.confidence]}</span>
                  {(entry.spoilerLevel ?? 0) >= 2 && <span className="spoiler-tag">剧透 L{entry.spoilerLevel}</span>}
                  <span className="archive-id">[{entry.id}]</span>
                </div>
                <p className="archive-content">{entry.content}</p>
                <div className="archive-meta">
                  <span className="archive-meta-chip">主题 · {entry.topics.join(' / ')}</span>
                  <span className="archive-meta-chip">区域 · {ZONE_NAMES[entry.zoneId]}</span>
                  <span className="archive-meta-chip archive-locate">点击定位 → {target.cameraId}</span>
                </div>
                <p className="archive-source">来源：{entry.sources.join('；')}</p>
              </button>
            </li>
          )
        })}
        {results.length === 0 && <li className="empty-state">档案中没有匹配的记录。</li>}
      </ul>
    </Modal>
  )
}
