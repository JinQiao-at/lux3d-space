/**
 * 记忆回廊面板（T-010）：结局后可进入的「上一任屋主留下的空间记忆」。
 *
 * 双层呈现：
 * - 主视觉（默认）：SpatialGen 生成的全景图（panoUrl，1.06MB）+ 指针拖动环视——零加载风险，首帧快；
 * - 实验增强（可切换）：3DGS 点云实时渲染（@mkkellogg/gaussian-splats-3d 动态 chunk，
 *   PLY 18.4MB；黑屏问题排查中，标记 experimental，不影响验收主链）。
 * 纯渲染层：不改 stage/flags 语义。
 */
import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../game/store.ts'
import { Modal } from './Modal.tsx'

const PANO_URL = './splats/memory-corridor-pano.jpg'
const SPLAT_URL = './splats/memory-corridor-hd.ply'

/** 3DGS 实时点云为实验模式（黑屏排查中）；默认全景图，按钮可切换供 DSH/Owner 验收。 */

export function MemoryPanel() {
  const setPanel = useGameStore((state) => state.setPanel)
  const canvasHost = useRef<HTMLDivElement>(null)
  const panoRef = useRef<HTMLImageElement>(null)
  const [mode, setMode] = useState<'pano' | 'splat'>('pano')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const offset = useRef({ x: 50, y: 50 })
  const dragging = useRef<{ x: number; y: number } | null>(null)

  // 全景环视：指针拖动改变背景定位（百分比）
  useEffect(() => {
    if (mode !== 'pano') return
    const el = panoRef.current
    if (!el) return
    const apply = () => {
      el.style.objectPosition = `${offset.current.x}% ${offset.current.y}%`
    }
    apply()
    const onDown = (event: PointerEvent) => {
      dragging.current = { x: event.clientX, y: event.clientY }
      el.setPointerCapture(event.pointerId)
    }
    const onMove = (event: PointerEvent) => {
      if (!dragging.current || !panoRef.current) return
      const dx = event.clientX - dragging.current.x
      const dy = event.clientY - dragging.current.y
      dragging.current = { x: event.clientX, y: event.clientY }
      const width = panoRef.current.clientWidth || 1
      const height = panoRef.current.clientHeight || 1
      offset.current.x = Math.min(100, Math.max(0, offset.current.x - (dx / width) * 55))
      offset.current.y = Math.min(100, Math.max(0, offset.current.y - (dy / height) * 30))
      apply()
    }
    const onUp = () => {
      dragging.current = null
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [mode])

  // 实验模式：3DGS 点云 viewer（资源管理：StrictMode 双挂载安全，await 期间卸载也无条件清理）
  useEffect(() => {
    if (mode !== 'splat') return
    let disposed = false
    const resources: {
      viewer?: { start: () => void; stop: () => void; dispose: () => void }
      renderer?: { dispose: () => void; domElement: HTMLCanvasElement }
    } = {}
    let resizeHandler: (() => void) | undefined

    const disposeAll = () => {
      if (resizeHandler) window.removeEventListener('resize', resizeHandler)
      resources.viewer?.stop()
      resources.viewer?.dispose()
      const renderer = resources.renderer
      if (renderer) {
        renderer.dispose()
        const host = canvasHost.current
        if (host && renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
      }
      resources.viewer = undefined
      resources.renderer = undefined
    }

    void (async () => {
      try {
        const THREE = await import('three')
        const { Viewer } = await import('@mkkellogg/gaussian-splats-3d')
        const host = canvasHost.current
        if (disposed || !host) return

        const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
        renderer.setSize(host.clientWidth, host.clientHeight)
        host.appendChild(renderer.domElement)
        resources.renderer = renderer

        const camera = new THREE.PerspectiveCamera(60, host.clientWidth / host.clientHeight, 0.1, 2000)
        // Aholo/SpatialGen splat = OpenCV 坐标系（-Y up，docs/13 §0）。
        // A1（相机 up 翻转）实测无效 → A2：直接把 splat 网格绕 X 翻 π（-Y up → three 的 +Y up），
        // 相机回归常规位（正前方看向原点）。
        camera.position.set(0, 0, 4)
        camera.lookAt(new THREE.Vector3(0, 0, 0))

        const viewer = new Viewer({ gpuRenderer: renderer, camera, sharedMemoryForWorkers: false })
        resources.viewer = viewer

        await viewer.addSplatScene(SPLAT_URL, {
          dynamicScene: false,
          sceneRevealMode: 1, // FadeIn
          // format 不传：按 .ply/.spz 扩展名自动识别（枚举值是数字，传字符串会落空）
        })

        if (disposed) {
          disposeAll()
          return
        }
        // A2：OpenCV(-Y up) → three(+Y up) 的网格级翻转
        const mesh = (viewer as unknown as { splatMesh?: { rotation: { x: number } } }).splatMesh
        if (mesh) mesh.rotation.x = Math.PI
        viewer.start()
      } catch (error) {
        disposeAll()
        if (!disposed) {
          setStatus('error')
          setErrorMessage(String((error as Error)?.message ?? error))
        }
      }
    })()

    return () => {
      disposed = true
      disposeAll()
    }
  }, [mode])

  return (
    <Modal
      title="记忆回廊"
      subtitle="这是上一任屋主留下的空间记忆 · 拖动画面环视"
      onClose={() => setPanel('ending')}
    >
      {mode === 'pano' ? (
        <div className="memory-stage">
          <img
            ref={panoRef}
            className="memory-pano"
            src={PANO_URL}
            alt="上一任屋主留下的空间记忆全景"
            draggable={false}
          />
        </div>
      ) : (
        <div className="memory-stage" ref={canvasHost} aria-label="3DGS 场景">
          {status !== 'error' && status !== 'ready' && (
            <div className="memory-status">
              <p className="muted">正在浮现空间记忆…（实验模式，加载约 18MB）</p>
            </div>
          )}
          {status === 'error' && (
            <div className="memory-status">
              <p className="muted">空间记忆没能浮现（{errorMessage}）。它属于下一章。</p>
            </div>
          )}
        </div>
      )}
      <p className="muted memory-foot">
        A16-025 · 下一站，镜厅。（SpatialGen 3DGS · Aholo）
        {' '}·{' '}
        {mode === 'pano' ? (
          <button
            className="ghost-button memory-experiment"
            onClick={() => {
              setStatus('loading')
              setMode('splat')
            }}
          >
            实验模式：3DGS 点云
          </button>
        ) : (
          <button
            className="ghost-button memory-experiment"
            onClick={() => setMode('pano')}
          >
            返回全景
          </button>
        )}
      </p>
    </Modal>
  )
}
