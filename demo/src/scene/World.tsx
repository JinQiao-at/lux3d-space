import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { RoomShell } from './RoomShell.tsx'
import { ZoneProps, HighlightHalo } from './Props.tsx'
import { ZoneLighting } from './Lighting.tsx'
import { Player } from './Player.tsx'
import { CameraRig } from './CameraRig.tsx'
import { useGameStore } from '../game/store.ts'
import { enableInteractionBVH } from './bvh.ts'

/** 只渲染当前 zone（三个 zone 不在同一个世界坐标里，切换即“传送”）。
 *
 * 一致性验收结论（docs/scene-consistency-check.md）：scene.environment（RoomEnvironment 白光 IBL）
 * 是全场景平涂白化的根因——深色材质被白环境光洗白，与四场景暗调配方冲突，已整体移除。
 * 材质层次改由 ZoneLighting 的多光暖/冷对比承担（图二基准配方）。
 */
export function World() {
  const zone = useGameStore((state) => state.game.zone)
  const scene = useThree((state) => state.scene)

  const background = zone === 'zone_study' ? '#0a0806' : zone === 'zone_basement' ? '#030506' : '#06050b'
  const fogNear = zone === 'zone_basement' ? 1.5 : 2.5
  // 任务③：书房雾与密室同构（far 20，比密室 18 略低密度适配雨夜大房间）
  const fogFar = zone === 'zone_study' ? 20 : zone === 'zone_basement' ? 15 : 18

  // T-028 拾取加速：zone 挂载完成后对该场景 mesh 建 BVH（幂等；geometry 缓存共享仅首次有成本）
  useEffect(() => {
    if (scene) enableInteractionBVH(scene)
  }, [zone, scene])

  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, fogNear, fogFar]} />
      <ZoneLighting zone={zone} />
      <RoomShell zone={zone} />
      <ZoneProps zone={zone} />
      <HighlightHalo />
      <Player key={zone} />
      <CameraRig />
    </>
  )
}
