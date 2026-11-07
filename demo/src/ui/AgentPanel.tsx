import { useState } from 'react'
import { AGENT_DISCLAIMER, AGENT_NO_KNOWLEDGE_TEXT } from '../data/narrative.ts'
import { useGameStore } from '../game/store.ts'
import { Modal } from './Modal.tsx'

const QUICK_QUESTIONS = ['提灯有什么来历？', '带我去看石壁浮雕', '我现在该做什么？', '有哪些可交互对象？', '镜子里写着什么？']

/** 受控 Agent 面板：本地规则引擎 stub，回答强制引用知识条目 id + sources。 */
export function AgentPanel() {
  const closePanel = useGameStore((state) => state.closePanel)
  const askAgent = useGameStore((state) => state.askAgent)
  const messages = useGameStore((state) => state.agentMessages)
  const [input, setInput] = useState('')

  const send = (question: string) => {
    const trimmed = question.trim()
    if (!trimmed) return
    askAgent(trimmed)
    setInput('')
  }

  return (
    <Modal
      title="叙事 Agent"
      subtitle="受控只读助手 · 本地规则引擎（接口对齐 LLM function calling）"
      onClose={closePanel}
      wide
    >
      <div className="agent-quick">
        {QUICK_QUESTIONS.map((question) => (
          <button key={question} className="topic-chip" onClick={() => send(question)}>
            {question}
          </button>
        ))}
      </div>

      <div className="agent-messages">
        {messages.length === 0 && (
          <div className="agent-intro">
            <p>可以问我：知识档案里的内容、场景里有什么、当前位置与进度、或者要一条提示。</p>
            <p className="muted">
              我只做两件事：检索档案并引用条目；调用只读的观察工具（镜头定位/高亮）。我不能推进剧情，也不会编造档案里没有的记录。
            </p>
            <p className="muted">{AGENT_DISCLAIMER}</p>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`agent-message role-${message.role}`}>
            <div className="agent-role">{message.role === 'user' ? '你' : 'Agent'}</div>
            <div className="agent-bubble">
              <pre className="agent-text">{message.text}</pre>
              {message.tools && message.tools.length > 0 && (
                <div className="agent-tools">
                  {message.tools.map((tool, index) => (
                    <span key={`${tool.tool}-${index}`} className="tool-chip" title={JSON.stringify(tool.args)}>
                      🛠 {tool.tool}
                      {typeof tool.args.level === 'number' ? `(${tool.args.level})` : ''}
                    </span>
                  ))}
                </div>
              )}
              {message.citations && message.citations.length > 0 && (
                <div className="agent-citations">
                  {message.citations.map((citation) => (
                    <span key={citation.id} className="citation-chip">
                      [{citation.id}] {citation.title} · {citation.sources.join('；')} · {citation.confidence}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="muted">{AGENT_NO_KNOWLEDGE_TEXT}</p>}
      </div>

      <form
        className="agent-input-row"
        onSubmit={(event) => {
          event.preventDefault()
          send(input)
        }}
      >
        <input
          className="text-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="问一个问题，例如：暗门的机关怎么解？"
          aria-label="向 Agent 提问"
        />
        <button className="primary-button" type="submit">
          发送
        </button>
      </form>
    </Modal>
  )
}
