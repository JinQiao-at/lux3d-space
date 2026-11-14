import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 书房专属光照（任务②档1+：用户模板适配）——冷月光主光（castShadow）+ 台灯暖光 + 防死黑补光。
 * 仅 zone_study 挂载；阴影开启需 Canvas shadows（App.tsx 已配）。
 * 与 ZoneLighting 的火焰/氛围光叠加：fill 层级，不改暗调氛围。
 */
export function StudyRoomLighting() {
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const keyLight = useRef<THREE.DirectionalLight>(null)
  const lampLight = useRef<THREE.PointLight>(null)

  useEffect(() => {
    // ---- 主光：窗外冷月光 ----
    const key = keyLight.current
    if (key) {
      key.color.set('#5d7a9e')
      key.intensity = 1.2
      key.position.set(-6, 8, -4)
      key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      key.shadow.camera.left = -10
      key.shadow.camera.right = 10
      key.shadow.camera.top = 10
      key.shadow.camera.bottom = -10
      key.shadow.bias = -0.0005
      key.shadow.radius = 4
    }
    // ---- 辅光：台灯暖光 ----
    const lamp = lampLight.current
    if (lamp) {
      lamp.color.set('#ffb066')
      lamp.intensity = 8
      lamp.distance = 6
      lamp.decay = 2
      lamp.castShadow = false
    }
    // ---- 氛围：防死黑 hemisphere ----
    const hemi = new THREE.HemisphereLight('#1a2436', '#0d0a08', 0.25)
    scene.add(hemi)
    return () => {
      scene.remove(hemi)
    }
  }, [scene, gl])

  return (
    <>
      <directionalLight ref={keyLight} />
      <pointLight ref={lampLight} position={[1.2, 1.4, 0.5]} />
    </>
  )
}
