/**
 * T-028 拾取加速：three-mesh-bvh 引导层。
 *
 * - 一次性扩展 three 原型（acceleratedRaycast + computeBoundsTree），全局生效；
 * - enableInteractionBVH(scene)：对场景内 mesh 建.boundsTree（幂等，已建跳过）；
 *   只在 PropAsset/RoomShell 挂载后调用（World useEffect），几何缓存共享故仅首次有成本。
 * R3F 的 raycast 走 three 原生 → 加速后交互判定（ClickHint/HighlightHalo/interactDistance）
 * 全部自动受益，行为契约不变。
 */
import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'

let extended = false

export function extendRaycastWithBVH(): void {
  if (extended) return
  extended = true
  // three-mesh-bvh 自带的三 module 类型声明与本处 import 版本签名差异，用断言对齐（运行时兼容）
  THREE.Mesh.prototype.raycast = acceleratedRaycast as unknown as typeof THREE.Mesh.prototype.raycast
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree as unknown as typeof THREE.BufferGeometry.prototype.computeBoundsTree
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree as unknown as typeof THREE.BufferGeometry.prototype.disposeBoundsTree
}

export function enableInteractionBVH(scene: THREE.Object3D): number {
  extendRaycastWithBVH()
  let built = 0
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if ((mesh as unknown as { isMesh?: boolean }).isMesh && mesh.geometry && !mesh.geometry.boundsTree) {
      mesh.geometry.computeBoundsTree()
      built += 1
    }
  })
  return built
}
