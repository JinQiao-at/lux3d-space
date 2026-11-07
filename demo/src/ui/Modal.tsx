import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

/** 通用 HTML overlay 面板（Esc / 关闭按钮关闭；中文文本全部走 HTML，不依赖字体文件）。 */
export function Modal({ title, subtitle, onClose, children, wide = false }: ModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal-card ${wide ? 'modal-wide' : ''}`}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-footer">
          <span className="modal-esc">Esc 关闭</span>
        </footer>
      </div>
    </div>
  )
}
