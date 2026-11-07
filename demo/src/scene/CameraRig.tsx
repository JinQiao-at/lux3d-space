import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EYE_HEIGHT, getCameraAnchor } from '../data/scene.ts'
import { useGameStore } from '../game/store.ts'

/** 档案检索/Agent/导览触发的镜头定位 tween；结束时把镜头交还给玩家位姿。 */
export function CameraRig() {
  const camera = useThree((state) => state.camera)
  const focus = useGameStore((state) => state.focus)
  const goal = useRef<{ position: THREE.Vector3; quaternion: THREE.Quaternion; returning: boolean } | null>(null)
  const lastCameraId = useRef<string | null>(null)

  useEffect(() => {
    if (focus) {
      const anchor = getCameraAnchor(focus.cameraId)
      if (!anchor) return
      const position = new THREE.Vector3(anchor.position[0], anchor.position[1], anchor.position[2])
      const lookAt = new THREE.Vector3(anchor.lookAt[0], anchor.lookAt[1], anchor.lookAt[2])
      const matrix = new THREE.Matrix4().lookAt(position, lookAt, new THREE.Vector3(0, 1, 0))
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix)
      goal.current = { position, quaternion, returning: false }
      lastCameraId.current = focus.cameraId
      return
    }
    if (!lastCameraId.current) return
    const game = useGameStore.getState().game
    const position = new THREE.Vector3(game.position[0], EYE_HEIGHT, game.position[2])
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, game.yaw, 0, 'YXZ'))
    goal.current = { position, quaternion, returning: true }
    lastCameraId.current = null
  }, [focus])

  useFrame((_, delta) => {
    const target = goal.current
    if (!target) return
    const alpha = 1 - Math.exp(-6.5 * Math.min(0.08, delta))
    camera.position.lerp(target.position, alpha)
    camera.quaternion.slerp(target.quaternion, alpha)
    if (target.returning) {
      const settled =
        camera.position.distanceTo(target.position) < 0.02 && camera.quaternion.angleTo(target.quaternion) < 0.02
      if (settled) {
        camera.position.copy(target.position)
        camera.quaternion.copy(target.quaternion)
        goal.current = null
      }
    }
  })

  return null
}
