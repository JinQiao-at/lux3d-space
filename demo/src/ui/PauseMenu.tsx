import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { formatPlayTime } from '../game/save.ts'
import { useGameStore } from '../game/store.ts'
import { Modal } from './Modal.tsx'
import { downloadTextFile, readTextFile, requestScenePointerLock } from './dom.ts'

/** 暂停菜单：继续 / 存档导出导入 / 设置 / 重新开始。 */
export function PauseMenu() {
  const game = useGameStore((state) => state.game)
  const closePanel = useGameStore((state) => state.closePanel)
  const setPanel = useGameStore((state) => state.setPanel)
  const exportSave = useGameStore((state) => state.exportSave)
  const importSave = useGameStore((state) => state.importSave)
  const restart = useGameStore((state) => state.restart)
  const saveNow = useGameStore((state) => state.saveNow)
  const updateSettings = useGameStore((state) => state.updateSettings)
  const pushLog = useGameStore((state) => state.pushLog)
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState('')

  const handleExport = () => {
    const { filename, json } = exportSave()
    downloadTextFile(filename, json)
    saveNow()
    setStatus(`已导出 ${filename}`)
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await readTextFile(file)
      const ok = importSave(text)
      setStatus(ok ? '导入成功，已回到该存档。' : '导入失败：存档格式不合法或版本不符。')
      if (ok) setPanel('none')
    } catch {
      setStatus('导入失败：无法读取文件。')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <Modal
      title="暂停"
      subtitle="游戏已暂停 · 存档保存在 localStorage['lux3d.save.v1']"
      onClose={() => {
        closePanel()
        requestScenePointerLock()
      }}
    >
      <section className="panel-section">
        <div className="menu-grid">
          <button
            className="primary-button"
            onClick={() => {
              closePanel()
              requestScenePointerLock()
            }}
          >
            继续探索
          </button>
          <button className="ghost-button" onClick={handleExport}>
            导出存档 JSON
          </button>
          <button className="ghost-button" onClick={() => fileInput.current?.click()}>
            导入存档 JSON
          </button>
          <button
            className="ghost-button"
            onClick={() => {
              if (window.confirm('重新开始会清空当前进度与本地存档，确定吗？')) {
                restart()
                requestScenePointerLock()
              }
            }}
          >
            重新开始
          </button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
        {status && <p className="status-text">{status}</p>}
        <p className="muted">
          提示：存档也可以直接导出 JSON 贴进文档/交接给其他人。导入非法存档会被拒绝，不会破坏当前进度。
        </p>
      </section>

      <section className="panel-section">
        <h3>设置</h3>
        <label className="setting-row">
          <span>鼠标灵敏度</span>
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.05}
            value={game.settings.sensitivity}
            onChange={(event) => updateSettings({ sensitivity: Number(event.target.value) })}
          />
          <span className="setting-value">{game.settings.sensitivity.toFixed(2)}</span>
        </label>
        <label className="setting-row">
          <span>音量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={game.settings.volume}
            onChange={(event) => updateSettings({ volume: Number(event.target.value) })}
          />
          <span className="setting-value">{Math.round(game.settings.volume * 100)}%</span>
        </label>
        <label className="setting-row">
          <span>画质</span>
          <select
            className="select-input"
            value={game.settings.quality}
            onChange={(event) => updateSettings({ quality: event.target.value as 'high' | 'balanced' })}
          >
            <option value="high">高</option>
            <option value="balanced">均衡</option>
          </select>
        </label>
        <p className="muted">音效全部由 WebAudio 实时合成，无外部音频文件；中文 UI 为 HTML overlay，不加载字体文件。</p>
      </section>

      <section className="panel-section">
        <h3>本局统计</h3>
        <ul className="stats-list">
          <li>阶段：{game.stage}</li>
          <li>已抵达区域：{game.visited.join('、')}</li>
          <li>日记条目：{game.journal.length}</li>
          <li>提示次数：{game.hintsUsed}</li>
          <li>已探索：{formatPlayTime(game.playTime)}</li>
        </ul>
        <button
          className="ghost-button"
          onClick={() => {
            saveNow()
            pushLog('存档已保存到 localStorage。', 'system')
            setStatus('已保存')
          }}
        >
          立即保存
        </button>
      </section>
    </Modal>
  )
}
