import { TITLE, TITLE_EN } from '../data/narrative.ts'
import { ensureAudio } from '../game/audio.ts'
import { useGameStore } from '../game/store.ts'

/** 首屏：标题 + 开始探索/继续 + 操作说明。 */
export function TitleScreen() {
  const saveExists = useGameStore((state) => state.saveExists)
  const beginNewGame = useGameStore((state) => state.beginNewGame)
  const continueGame = useGameStore((state) => state.continueGame)
  const pushLog = useGameStore((state) => state.pushLog)

  const startNew = () => {
    ensureAudio()
    beginNewGame()
  }

  const startContinue = () => {
    ensureAudio()
    if (!continueGame()) {
      pushLog('没有找到可用存档，开始新的探索。', 'system')
      beginNewGame()
    }
  }

  return (
    <div className="title-overlay">
      <div className="title-content">
        <p className="title-kicker">LUX3D · 叙事空间垂直切片</p>
        <h1>{TITLE}</h1>
        <p className="title-en">{TITLE_EN}</p>
        <p className="title-lead">
          雨夜，你在一间不该出现的书房里醒来。
          <br />
          找到光，向下走，解开石壁上的机关——然后看看这间屋子究竟藏着什么。
        </p>
        <div className="title-actions">
          <button className="primary-button" onClick={startNew}>
            开始探索
          </button>
          <button className="ghost-button" onClick={startContinue} disabled={!saveExists}>
            继续（{saveExists ? '读取本地存档' : '暂无存档'}）
          </button>
        </div>
        <div className="title-controls">
          <h3>操作</h3>
          <ul>
            <li>
              <kbd>WASD</kbd> 移动 · <kbd>鼠标</kbd> 环视 · <kbd>Shift</kbd> 快走
            </li>
            <li>
              <kbd>E</kbd> 调查/交互 · <kbd>L</kbd> 点亮/熄灭提灯
            </li>
            <li>
              <kbd>Tab</kbd> 档案检索 · <kbd>J</kbd> 日记与提示 · <kbd>F</kbd> 叙事 Agent
            </li>
            <li>
              <kbd>Esc</kbd> 暂停 / 设置 / 导出导入存档
            </li>
          </ul>
          <p className="muted">
            点击画面开始漫游（光标常显，无需锁定）。所有场景、音效均为程序化生成，不加载任何网络资产。
          </p>
        </div>
      </div>
    </div>
  )
}
