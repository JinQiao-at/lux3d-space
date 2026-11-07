/**
 * 转盘部件渲染（T-011）：Blender 拆分的 body GLB + 拨盘角度动画。
 *
 * - parts 产物：pipeline/blender/split_parts.py 产出 /models/parts/obj_basement_dial_N_body.glb；
 *   探测命中 → 渲染真实盘体并按 dialOrder 平滑旋转到目标角度（Zork 式转盘机关：拨对转一格）；
 * - 探测未命中/加载失败 → 回退 Props.tsx 原程序化转盘（兜底机制复用）；
 * - 纯渲染层：不改 stage/flags/dialOrder 语义（状态机仍是唯一入口）。
 */
import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import type { Group } from 'three'
import type { Vec3 } from '../game/types.ts'
import { useGameStore } from '../game/store.ts'
import { useAssetAvailability } from './AssetModel.tsx'

const FIT_SIZE = 0.45 // 与 ASSET_FIT_SIZE_HINTS 的转盘口径一致

function bodyUrl(dialIndex: number): string {
  return `/models/parts/obj_basement_dial_${dialIndex}_body.glb`
}

interface PreparedBody {
  scene: Group
  scale: number
  offset: Vec3
}

function usePreparedBody(url: string): PreparedBody | null {
  const gltf = useGLTF(url, false)
  return useMemo(() => {
    const source = gltf.scene
    if (!source || source.children.length === 0) return null
    const scene = source.clone(true)
    scene.updateMatrixWorld(true)
    const box = new Box3().setFromObject(scene)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    if (!Number.isFinite(size.x) || size.x + size.y + size.z <= 1e-6) return null
    const maxDimension = Math.max(size.x, size.y, size.z)
    const scale = FIT_SIZE / maxDimension
    const offset: Vec3 = [-center.x, -box.min.y, -center.z]
    scene.traverse((child) => {
      child.castShadow = false
      child.receiveShadow = false
    })
    return { scene, scale, offset }
  }, [gltf.scene])
}

/** 单个真实转盘：盘体绕自身法线（Z）平滑转向 dialOrder 决定的目标角度。 */
function DialBody({ dialIndex, position }: { dialIndex: number; position: Vec3 }) {
  const prepared = usePreparedBody(bodyUrl(dialIndex))
  const group = useRef<Group>(null)
  const dialOrder = useGameStore((state) => state.game.dialOrder)
  const dialsSolved = useGameStore((state) => state.game.flags.dials_solved)

  useFrame((_, delta) => {
    if (!group.current) return
    const orderIndex = dialOrder.indexOf(dialIndex)
    const target = dialsSolved || orderIndex >= 0 ? (orderIndex + 1) * 1.05 : 0
    // 指数平滑：拨动时盘体转过去，而不是瞬移
    group.current.rotation.z += (target - group.current.rotation.z) * Math.min(1, delta * 6)
  })

  if (!prepared) return null
  return (
    <group position={position}>
      <group ref={group} scale={prepared.scale}>
        <primitive object={prepared.scene} position={prepared.offset} />
      </group>
    </group>
  )
}

/**
 * 转盘部件槽：parts GLB 可用 → DialBody；否则渲染 fallback（原程序化转盘）。
 */
export function DialPartSlot({
  dialIndex,
  position,
  fallback,
}: {
  dialIndex: number
  position: Vec3
  fallback: React.ReactNode
}) {
  const url = bodyUrl(dialIndex)
  const availability = useAssetAvailability(url)
  if (availability !== 'present') return <>{fallback}</>
  return (
    <Suspense fallback={fallback}>
      <DialBody dialIndex={dialIndex} position={position} />
    </Suspense>
  )
}
