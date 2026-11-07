import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ZoneId } from '../game/types.ts'
import { ZONES } from '../data/scene.ts'
import { useGameStore } from '../game/store.ts'

interface FlickerLightProps {
  position: [number, number, number]
  color: string
  intensity: number
  distance: number
  seed: number
  speed?: number
}

/** 火焰/烛光：按正弦叠加抖动强度的点光源。 */
function FlickerLight({ position, color, intensity, distance, seed, speed = 7 }: FlickerLightProps) {
  const light = useRef<THREE.PointLight>(null)
  useFrame((state) => {
    if (!light.current) return
    const t = state.clock.elapsedTime
    light.current.intensity =
      intensity * (0.86 + Math.sin(t * speed + seed) * 0.09 + Math.sin(t * speed * 2.3 + seed * 1.7) * 0.05)
  })
  return <pointLight ref={light} position={position} color={color} intensity={intensity} distance={distance} decay={1.6} />
}

/** 按 zone 布置光照：书房暖光、地下室依赖提灯、密室冷光烛火。 */
export function ZoneLighting({ zone }: { zone: ZoneId }) {
  const lanternLit = useGameStore((state) => state.game.lanternLit)
  const flags = useGameStore((state) => state.game.flags)
  const zoneDef = ZONES[zone]

  const ambientColor = zone === 'zone_study' ? '#ffd9b0' : zone === 'zone_basement' ? '#8fa6b8' : '#b9c8ff'

  return (
    <>
      <ambientLight intensity={zoneDef.ambient} color={ambientColor} />
      <hemisphereLight
        intensity={zone === 'zone_study' ? 0.35 : 0.14}
        color={zone === 'zone_study' ? '#ffe4bb' : '#cdd9ff'}
        groundColor="#111111"
      />

      {zone === 'zone_study' && (
        <>
          <FlickerLight position={[4.1, 0.85, 0.6]} color="#ff9a4d" intensity={2.4} distance={8} seed={1.3} speed={9} />
          <FlickerLight position={[0, 1.35, -2.4]} color="#ffcf8a" intensity={1.1} distance={4.5} seed={2.1} speed={3} />
          <pointLight position={[-2.6, 2.4, -4.6]} color="#5f7bd6" intensity={0.5} distance={9} decay={2} />
        </>
      )}

      {zone === 'zone_basement' && (
        <>
          {lanternLit && <pointLight position={[0, 2.35, 0]} color="#ffc98d" intensity={0.35} distance={10} decay={1.8} />}
          {flags.dials_solved && (
            <FlickerLight position={[3.9, 1.4, -2.4]} color="#7fd8ff" intensity={1.2} distance={5} seed={3.7} speed={2.4} />
          )}
          <pointLight position={[-3.0, 2.1, -2.4]} color="#5a7fa0" intensity={lanternLit ? 0.18 : 0.05} distance={6} decay={2} />
        </>
      )}

      {zone === 'zone_chamber' && (
        <>
          <FlickerLight position={[-2.3, 1.5, -2.5]} color="#ffb066" intensity={1.5} distance={7} seed={0.6} speed={5.5} />
          <FlickerLight position={[2.3, 1.5, -2.5]} color="#ffb066" intensity={1.5} distance={7} seed={1.9} speed={4.8} />
          <pointLight position={[0, 1.6, -1.6]} color="#9fe7ff" intensity={1.8} distance={8} decay={2} />
          <FlickerLight position={[0, 3.2, 0]} color="#7fa0ff" intensity={0.8} distance={9} seed={4.4} speed={1.6} />
        </>
      )}
    </>
  )
}
