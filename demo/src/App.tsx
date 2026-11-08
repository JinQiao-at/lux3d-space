import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import type { Action } from './game/types.ts'
import { EYE_HEIGHT, OBJECTS } from './data/scene.ts'
import { useGameStore } from './game/store.ts'
import { ensureAudio, setMasterVolume, startRain, stopRain, startDrip, stopDrip } from './game/audio.ts'
import { World } from './scene/World.tsx'
import { DarknessOverlay, HUD } from './ui/HUD.tsx'
import { ClickHint, NarrationLog } from './ui/Overlays.tsx'
import { TitleScreen } from './ui/TitleScreen.tsx'
import { JournalPanel } from './ui/JournalPanel.tsx'
import { ArchivePanel } from './ui/ArchivePanel.tsx'
import { AgentPanel } from './ui/AgentPanel.tsx'
import { PauseMenu } from './ui/PauseMenu.tsx'
import { EndingPanel } from './ui/EndingPanel.tsx'
import { MapPanel } from './ui/MapPanel.tsx'
import { MemoryPanel } from './ui/MemoryPanel.tsx'
import { FocusCard } from './ui/FocusCard.tsx'
import { requestScenePointerLock } from './ui/dom.ts'
import { preloadRegisteredGlbs } from './scene/preloadGlbs.ts'

export default function App() {
  const started = useGameStore((state) => state.started)
  const panel = useGameStore((state) => state.panel)
  const tour = useGameStore((state) => state.tour)
  const volume = useGameStore((state) => state.game.settings.volume)
  const zone = useGameStore((state) => state.game.zone)

  useEffect(() => {
    setMasterVolume(volume)
  }, [volume])

  // 全局快捷键（E/L/Tab/J/F/Esc）；输入框内只处理 Esc。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const store = useGameStore.getState()
      if (!store.started) return
      const target = event.target as HTMLElement | null
      const typing =
        Boolean(target) &&
        (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable)

      if (event.code === 'Escape') {
        event.preventDefault()
        if (store.panel === 'ending') return
        if (store.panel !== 'none') {
          store.closePanel()
          requestScenePointerLock()
          return
        }
        if (store.focus) {
          store.clearFocus()
          return
        }
        store.openPanel('pause')
        return
      }

      if (typing || store.panel !== 'none') return

      switch (event.code) {
        case 'KeyE': {
          const interaction = store.interaction
          if (!interaction) return
          const object = OBJECTS[interaction.objectId]
          if (!object) return
          if (object.action === 'dial') {
            store.dispatch({ type: 'dial', objectId: object.id })
          } else {
            const actionType = object.action as 'inspect' | 'read' | 'search' | 'use'
            const action: Action = { type: actionType, objectId: object.id }
            store.dispatch(action)
          }
          break
        }
        case 'KeyL':
          store.dispatch({ type: 'toggle_lantern' })
          break
        case 'Tab':
          event.preventDefault()
          store.openPanel('archive')
          break
        case 'KeyJ':
          store.openPanel('journal')
          break
        case 'KeyM':
          store.openPanel('map')
          break
        case 'KeyK': {
          // T-019：物品使用谜题入口——对准星目标使用黄铜钥匙（当前唯一可用物品；
          // 组合是否成立由 use_item_on 状态机判定，错误组合温和失败不消耗）
          const interaction = store.interaction
          if (interaction && store.game.inventory.includes('brass_key')) {
            store.dispatch({ type: 'use_item_on', objectId: interaction.objectId, itemId: 'brass_key' })
          }
          break
        }
        case 'KeyF':
          store.openPanel('agent')
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // GLB 预热（T-025 B2）：标题屏阅读操作说明的窗口期把网络+解析做掉，消除 zone 切换换装跳变
  useEffect(() => {
    preloadRegisteredGlbs()
  }, [])

  // 环境声循环随 zone 切换（T-025）：书房雨声 / 地下室滴水；面板打开时静音省资源
  useEffect(() => {
    if (!started) {
      stopRain()
      stopDrip()
      return
    }
    if (panel !== 'none' && panel !== 'ending') {
      stopRain()
      stopDrip()
      return
    }
    if (zone === 'zone_study') {
      startRain()
      stopDrip()
    } else if (zone === 'zone_basement') {
      stopRain()
      startDrip()
    } else {
      stopRain()
      stopDrip()
    }
  }, [started, panel, zone])

  // 游戏内计时（暂停/结局/镜头定位时不计时）。
  useEffect(() => {
    const timer = setInterval(() => {
      const store = useGameStore.getState()
      if (!store.started) return
      if (store.panel === 'pause' || store.panel === 'ending' || store.focus) return
      store.tick(1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 自动存档：每 12 秒 + 页面隐藏时。
  useEffect(() => {
    const timer = setInterval(() => {
      const store = useGameStore.getState()
      if (store.started) store.saveNow()
    }, 12000)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') useGameStore.getState().saveNow()
    }
    window.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      window.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // 导览：每 4.2 秒自动进下一站。
  useEffect(() => {
    if (!tour) return
    const timer = setTimeout(() => useGameStore.getState().advanceTour(), 4200)
    return () => clearTimeout(timer)
  }, [tour])

  return (
    <div className="app" onPointerDown={ensureAudio}>
      <div id="scene-root" className="scene-root">
        <Canvas
          camera={{ fov: 72, near: 0.05, far: 120, position: [0, EYE_HEIGHT, 3.2] }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <World />
          </Suspense>
        </Canvas>
      </div>

      {!started && <TitleScreen />}
      {started && <HUD />}
      {started && <NarrationLog />}
      {started && <ClickHint />}
      <DarknessOverlay />
      {started && <FocusCard />}

      {panel === 'journal' && <JournalPanel />}
      {panel === 'map' && <MapPanel />}
      {panel === 'memory' && <MemoryPanel />}
      {panel === 'archive' && <ArchivePanel />}
      {panel === 'agent' && <AgentPanel />}
      {panel === 'pause' && <PauseMenu />}
      {panel === 'ending' && <EndingPanel />}
    </div>
  )
}
