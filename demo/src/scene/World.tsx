import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoomShell } from './RoomShell.tsx'
import { ZoneProps, HighlightHalo } from './Props.tsx'
import { ZoneLighting } from './Lighting.tsx'
import { StudyRoomLighting } from './StudyRoomLighting.tsx'
import { Player } from './Player.tsx'
import { CameraRig } from './CameraRig.tsx'
import { useGameStore } from '../game/store.ts'
import { enableInteractionBVH } from './bvh.ts'

/** 只渲染当前 zone（三个 zone 不在同一个世界坐标里，切换即“传送”）。 */
export function World() {
  const zone = useGameStore((state) => state.game.zone)
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)

  const background = zone === 'zone_study' ? '#0a0806' : zone === 'zone_basement' ? '#030506' : '#06050b'
  const fogNear = zone === 'zone_basement' ? 1.5 : 2.5
  const fogFar = zone === 'zone_study' ? 24 : zone === 'zone_basement' ? 15 : 18

  // T-028 拾取加速：zone 挂载完成后对该场景 mesh 建 BVH（幂等；geometry 缓存共享仅首次有成本）
  useEffect(() => {
    if (scene) enableInteractionBVH(scene)
  }, [zone, scene])

  // 任务②档2：PMREM + RoomEnvironment 生成 scene.environment（零 CDN，three 内置合成环境）——
  // GLB 的 MeshStandardMaterial 有了 IBL 反射，金属/高光面不再死板；一次性生成，全局共享。
  useEffect(() => {
    if (!gl || !scene) return
    const pmrem = new THREE.PMREMGenerator(gl)
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTexture
    scene.environmentIntensity = 0.35 // 压低环境反射强度——保持暗调氛围，只提材质层次
    pmrem.dispose()
    return () => {
      scene.environment = null
      envTexture.dispose()
    }
  }, [gl, scene])

  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, fogNear, fogFar]} />
      <ZoneLighting zone={zone} />
      {zone === 'zone_study' && <StudyRoomLighting />}
      <RoomShell zone={zone} />
      <ZoneProps zone={zone} />
      <HighlightHalo />
      <Player key={zone} />
      <CameraRig />
    </>
  )
}
