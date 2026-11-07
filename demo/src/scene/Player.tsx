import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Vec3 } from '../game/types.ts'
import { EYE_HEIGHT, ZONES, zoneObjects } from '../data/scene.ts'
import { findInteractionCandidate, hasMetConditions, resolveMovement } from '../game/interaction.ts'
import { useGameStore } from '../game/store.ts'

const WALK_SPEED = 2.15
const RUN_SPEED = 3.7

/** 第一人称玩家：drei PointerLockControls（鼠标视角）+ WASD + AABB 碰撞 + 交互候选检测。 */
export function Player() {
  const camera = useThree((state) => state.camera)
  const zone = useGameStore((state) => state.game.zone)
  const started = useGameStore((state) => state.started)
  const focus = useGameStore((state) => state.focus)
  const panel = useGameStore((state) => state.panel)
  const sensitivity = useGameStore((state) => state.game.settings.sensitivity)
  const zoneDef = ZONES[zone]
  const objects = useMemo(() => zoneObjects(zone), [zone])
  const keys = useRef<Record<string, boolean>>({})
  const interactionAcc = useRef(0)
  const poseAcc = useRef(0)

  const setInteraction = useGameStore((state) => state.setInteraction)
  const syncPose = useGameStore((state) => state.syncPose)

  // 进入 zone（组件按 zone 重新挂载）时把相机放到该 zone 的存档位置/朝向
  useEffect(() => {
    const state = useGameStore.getState()
    camera.position.set(state.game.position[0], EYE_HEIGHT, state.game.position[2])
    camera.rotation.set(0, state.game.yaw, 0, 'YXZ')
    keys.current = {}
    interactionAcc.current = 0
    poseAcc.current = 0
  }, [camera, zone])

  useEffect(() => {
    const isTyping = (target: EventTarget | null): boolean => {
      const element = target as HTMLElement | null
      if (!element) return false
      return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      keys.current[event.code] = true
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        event.preventDefault()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keys.current[event.code] = false
    }
    const onBlur = () => {
      keys.current = {}
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    if (!started || focus || panel !== 'none') setInteraction(null)
  }, [started, focus, panel, setInteraction])

  useFrame((_, delta) => {
    const state = useGameStore.getState()
    const canExplore = state.started && !state.focus && state.panel === 'none' && state.locked
    if (!canExplore) return

    const dt = Math.min(0.05, delta)
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1)
    forward.normalize()
    const right = new THREE.Vector3(-forward.z, 0, forward.x)

    const move = new THREE.Vector3()
    if (keys.current.KeyW || keys.current.ArrowUp) move.add(forward)
    if (keys.current.KeyS || keys.current.ArrowDown) move.sub(forward)
    if (keys.current.KeyD || keys.current.ArrowRight) move.add(right)
    if (keys.current.KeyA || keys.current.ArrowLeft) move.sub(right)

    if (move.lengthSq() > 0) {
      move.normalize()
      const running = Boolean(keys.current.ShiftLeft || keys.current.ShiftRight)
      const speed = running ? RUN_SPEED : WALK_SPEED
      const current: Vec3 = [camera.position.x, camera.position.y, camera.position.z]
      const desired: Vec3 = [camera.position.x + move.x * speed * dt, camera.position.y, camera.position.z + move.z * speed * dt]
      const resolved = resolveMovement(current, desired, zoneDef)
      camera.position.set(resolved[0], EYE_HEIGHT, resolved[2])
    }

    interactionAcc.current += dt
    if (interactionAcc.current > 0.1) {
      interactionAcc.current = 0
      const lookForward = camera.getWorldDirection(new THREE.Vector3())
      const pose = {
        position: [camera.position.x, camera.position.y, camera.position.z] as Vec3,
        forward: [lookForward.x, lookForward.y, lookForward.z] as Vec3,
      }
      const candidate = findInteractionCandidate(objects, pose, state.game)
      setInteraction(
        candidate ? { objectId: candidate.object.id, ready: hasMetConditions(candidate.object, state.game) } : null,
      )
    }

    poseAcc.current += dt
    if (poseAcc.current > 0.25) {
      poseAcc.current = 0
      const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      syncPose([camera.position.x, EYE_HEIGHT, camera.position.z], euler.y)
    }
  })

  return (
    <>
      <PointerLockControls
        selector="#scene-root"
        makeDefault
        enabled={Boolean(started && !focus && panel === 'none')}
        pointerSpeed={sensitivity}
        onLock={() => useGameStore.getState().setLocked(true)}
        onUnlock={() => useGameStore.getState().setLocked(false)}
      />
      <HandLantern />
    </>
  )
}

/** 手持提灯（程序化几何 + 跟随相机的点光源）。 */
function HandLantern() {
  const camera = useThree((state) => state.camera)
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const flame = useRef<THREE.Mesh>(null)
  const hasLantern = useGameStore((state) => state.game.flags.has_lantern)
  const lanternLit = useGameStore((state) => state.game.lanternLit)

  useFrame((state) => {
    if (!group.current) return
    const offset = new THREE.Vector3(0.34, -0.3, -0.55).applyQuaternion(camera.quaternion)
    group.current.position.copy(camera.position).add(offset)
    group.current.quaternion.copy(camera.quaternion)
    if (light.current) {
      light.current.intensity = lanternLit
        ? 2.7 + Math.sin(state.clock.elapsedTime * 9.3) * 0.22 + Math.sin(state.clock.elapsedTime * 17.1) * 0.08
        : 0
    }
    if (flame.current) {
      const scale = lanternLit ? 1 + Math.sin(state.clock.elapsedTime * 12) * 0.08 : 0.5
      flame.current.scale.setScalar(scale)
    }
  })

  if (!hasLantern) return null

  return (
    <group ref={group} position={[0.34, -0.3, -0.55]}>
      <mesh position={[0, 0.14, 0]}>
        <torusGeometry args={[0.055, 0.012, 8, 16]} />
        <meshStandardMaterial color="#b98b4a" metalness={0.9} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.075, 0.09, 0.17, 10, 1, true]} />
        <meshStandardMaterial color="#8f6a35" metalness={0.85} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={flame} position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshBasicMaterial color={lanternLit ? '#ffd27a' : '#4a443c'} transparent opacity={lanternLit ? 0.95 : 0.5} />
      </mesh>
      <mesh position={[0, -0.045, 0]}>
        <cylinderGeometry args={[0.09, 0.075, 0.02, 10]} />
        <meshStandardMaterial color="#6f5128" metalness={0.8} roughness={0.5} />
      </mesh>
      {lanternLit && <pointLight ref={light} color="#ffc978" intensity={2.6} distance={10} decay={1.4} />}
    </group>
  )
}
