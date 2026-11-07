/** 指针锁定小工具：面板关闭后从用户手势里恢复漫游。 */
export function requestScenePointerLock(): void {
  if (typeof document === 'undefined') return
  const canvas = document.querySelector<HTMLCanvasElement>('#scene-root canvas')
  if (!canvas) return
  if (document.pointerLockElement !== canvas) {
    try {
      const result = canvas.requestPointerLock() as unknown
      if (result instanceof Promise) {
        void result.catch(() => {
          // 浏览器拒绝时忽略，玩家点击画面即可重新锁定
        })
      }
    } catch {
      // 忽略
    }
  }
}

export function exitScenePointerLock(): void {
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock()
  }
}

/** 触发下载文本文件（存档导出）。 */
export function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 读取用户选择的 JSON 文件内容。 */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsText(file)
  })
}
