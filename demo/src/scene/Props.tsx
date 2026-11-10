import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ZoneId } from '../game/types.ts'
import { OBJECTS } from '../data/scene.ts'
import { useGameStore } from '../game/store.ts'
import { PropAsset } from './AssetModel.tsx'
import { DialPartSlot } from './DialParts.tsx'

/**
 * 场景陈设。每个可交互物件都包在 <PropAsset objectId="..."> 里：
 * - public/models/<objectId>.glb 存在时：加载真实 Lux3D GLB（底部中心归一化到该物件的放置点）；
 * - 缺失/加载失败时：渲染下面的程序化几何（与纯程序化版本完全一致）。
 * 交互高亮由 OBJECTS[objectId].position 驱动（见 HighlightHalo），与使用哪种视觉表现无关。
 */

const BOOK_COLORS = ['#6d2f2f', '#2f4a63', '#5a5330', '#3a3a44', '#704b2a', '#2d4d3f', '#4b2f56', '#5b3b25']

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

/** P1-A2：书架书 InstancedMesh 数据（45 本，伪随机与原逐 mesh 版完全同分布）。 */
interface BookInstance {
  x: number
  y: number
  z: number
  tiltZ: number
  scaleX: number
  scaleY: number
  scaleZ: number
  color: string
}

const SHELF_YS = [0.1, 0.62, 1.14, 1.66, 2.18]

function buildBookInstances(): BookInstance[] {
  return SHELF_YS.flatMap((y, shelf) =>
    Array.from({ length: 9 }, (_, index) => {
      const seed = shelf * 17 + index * 3.7
      const height = 0.26 + pseudoRandom(seed) * 0.12
      const depth = 0.16 + pseudoRandom(seed + 1) * 0.08
      return {
        x: 0.34,
        y: y + height / 2 + 0.03,
        z: -1.45 + index * 0.33,
        tiltZ: pseudoRandom(seed + 2) > 0.9 ? 0.14 : 0,
        scaleX: depth,
        scaleY: height,
        scaleZ: 0.08 + pseudoRandom(seed + 3) * 0.08,
        color: BOOK_COLORS[(shelf * 9 + index) % BOOK_COLORS.length],
      }
    }),
  )
}

/** 45 本书合批：单 boxGeometry + 单 vertexColors 材质 + 逐实例矩阵/颜色（P1-A2，45 draw call → 1）。 */
function BookshelfBooks() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const books = useMemo(buildBookInstances, [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const temp = new THREE.Object3D()
    const color = new THREE.Color()
    books.forEach((book, i) => {
      temp.position.set(book.x, book.y, book.z)
      temp.rotation.set(0, 0, book.tiltZ)
      temp.scale.set(book.scaleX, book.scaleY, book.scaleZ)
      temp.updateMatrix()
      mesh.setMatrixAt(i, temp.matrix)
      color.set(book.color)
      mesh.setColorAt(i, color)
    })
    // 模板三坑：矩阵与颜色写入后必须置 needsUpdate，材质必须 vertexColors
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [books])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, books.length]} frustumCulled>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors roughness={0.85} />
    </instancedMesh>
  )
}

/** 书房陈设：书桌、日记、书架、壁炉、油画、落地镜、地板暗门。 */
function StudyProps() {
  const lanternLit = useGameStore((state) => state.game.lanternLit)
  const cellarOpen = useGameStore((state) => state.game.flags.cellar_open)

  return (
    <group>
      {/* 地毯（非交互装饰，始终程序化） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0.2]}>
        <planeGeometry args={[3.6, 2.6]} />
        <meshStandardMaterial color="#4a2028" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.2]}>
        <ringGeometry args={[1.0, 1.06, 4]} />
        <meshStandardMaterial color="#7c5a3a" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* 书桌 */}
      <PropAsset objectId="obj_study_desk" position={[0, 0, -2.6]}>
        <group position={[0, 0, -2.6]}>
          <mesh position={[0, 0.78, 0]}>
            <boxGeometry args={[2.4, 0.08, 1.1]} />
            <meshStandardMaterial color="#5a3d26" roughness={0.55} metalness={0.05} />
          </mesh>
          {[
            [-1.05, 0.4, -0.45],
            [1.05, 0.4, -0.45],
            [-1.05, 0.4, 0.45],
            [1.05, 0.4, 0.45],
          ].map(([x, y, z], index) => (
            <mesh key={`desk-leg-${index}`} position={[x as number, y as number, z as number]}>
              <boxGeometry args={[0.1, 0.8, 0.1]} />
              <meshStandardMaterial color="#3f2a19" roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[0.55, 0.63, 0.1]}>
            <boxGeometry args={[0.7, 0.24, 0.55]} />
            <meshStandardMaterial color="#4a3220" roughness={0.65} />
          </mesh>
          {/* 墨水瓶 */}
          <mesh position={[-0.45, 0.9, 0.1]}>
            <cylinderGeometry args={[0.06, 0.07, 0.12, 10]} />
            <meshStandardMaterial color="#1d2733" metalness={0.4} roughness={0.3} />
          </mesh>
          {/* 黄铜台灯 */}
          <group position={[0.85, 0.82, -0.25]}>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.1, 0.13, 0.04, 12]} />
              <meshStandardMaterial color="#8a6a35" metalness={0.8} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.22, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.4, 8]} />
              <meshStandardMaterial color="#9c7a3e" metalness={0.85} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.46, 0]}>
              <coneGeometry args={[0.2, 0.2, 14, 1, true]} />
              <meshStandardMaterial color="#2f6b4f" emissive="#7bd6a0" emissiveIntensity={0.45} roughness={0.5} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="#ffe7ad" />
            </mesh>
          </group>
        </group>
      </PropAsset>

      {/* 摊开的日记（独立资产槽：obj_study_diary） */}
      <PropAsset objectId="obj_study_diary" position={[0.28, 0.84, -2.52]}>
        <group position={[0.28, 0.84, -2.52]}>
          <mesh rotation={[-Math.PI / 2, 0, 0.06]}>
            <boxGeometry args={[0.42, 0.03, 0.3]} />
            <meshStandardMaterial color="#e8dcc0" emissive="#c8b98e" emissiveIntensity={0.18} roughness={0.9} />
          </mesh>
          <mesh position={[0.22, 0.002, 0.06]} rotation={[-Math.PI / 2, 0, 0.06]}>
            <boxGeometry args={[0.06, 0.012, 0.28]} />
            <meshStandardMaterial color="#6b5136" roughness={0.8} />
          </mesh>
        </group>
      </PropAsset>

      {/* 椅子（书桌配套装饰，始终程序化） */}
      <group position={[0, 0, -1.35]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.46, 0]}>
          <boxGeometry args={[0.55, 0.07, 0.55]} />
          <meshStandardMaterial color="#3e2a1b" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.78, -0.24]}>
          <boxGeometry args={[0.55, 0.6, 0.07]} />
          <meshStandardMaterial color="#3a2719" roughness={0.7} />
        </mesh>
        {[-0.22, 0.22].map((x) =>
          [-0.22, 0.22].map((z) => (
            <mesh key={`chair-leg-${x}-${z}`} position={[x, 0.22, z]}>
              <boxGeometry args={[0.06, 0.44, 0.06]} />
              <meshStandardMaterial color="#2e1f14" roughness={0.8} />
            </mesh>
          )),
        )}
      </group>

      {/* 书架（西墙，GLB 宽面绕 Y +90° 朝室内） */}
      <PropAsset objectId="obj_study_bookshelf" position={[-4.55, 0, -0.8]} rotationYDeg={90}>
        <group position={[-4.55, 0, -0.8]}>
          <mesh position={[0, 1.3, 0]}>
            <boxGeometry args={[0.42, 2.6, 3.3]} />
            <meshStandardMaterial color="#3c2a1c" roughness={0.8} />
          </mesh>
          {[0.1, 0.62, 1.14, 1.66, 2.18].map((y) => (
            <mesh key={`shelf-${y}`} position={[0.24, y, 0]}>
              <boxGeometry args={[0.12, 0.05, 3.2]} />
              <meshStandardMaterial color="#5c3f27" roughness={0.7} />
            </mesh>
          ))}
          <BookshelfBooks />
          {/* 第三层暗格（提灯取出后留下缝隙） */}
          <mesh position={[0.4, 1.18, 0.55]}>
            <boxGeometry args={[0.1, 0.32, 0.5]} />
            <meshStandardMaterial color="#1b120b" roughness={1} />
          </mesh>
          {lanternLit && (
            <pointLight position={[0.45, 1.2, 0.55]} color="#ffcf8a" intensity={0.25} distance={1.4} />
          )}
        </group>
      </PropAsset>

      {/* 壁炉（东墙，GLB 宽面绕 Y -90° 朝室内） */}
      <PropAsset objectId="obj_study_fireplace" position={[4.55, 0, 0.6]} rotationYDeg={-90}>
        <group position={[4.55, 0, 0.6]}>
          <mesh position={[-0.2, 0.95, 0]}>
            <boxGeometry args={[0.5, 1.9, 2.2]} />
            <meshStandardMaterial color="#4d4a45" roughness={0.9} />
          </mesh>
          <mesh position={[-0.45, 0.62, 0]}>
            <boxGeometry args={[0.18, 1.05, 1.4]} />
            <meshStandardMaterial color="#141210" roughness={1} />
          </mesh>
          <mesh position={[-0.52, 0.1, 0]}>
            <boxGeometry args={[0.4, 0.2, 1.7]} />
            <meshStandardMaterial color="#5a564f" roughness={0.9} />
          </mesh>
          <mesh position={[-0.5, 0.62, 0]}>
            <boxGeometry args={[0.14, 0.5, 1.1]} />
            <meshStandardMaterial color="#ff7a2a" emissive="#ff6a1a" emissiveIntensity={1.7} transparent opacity={0.85} />
          </mesh>
          {[-0.3, 0, 0.3].map((z) => (
            <mesh key={`log-${z}`} position={[-0.52, 0.18, z]} rotation={[0, z * 0.4, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, 0.55, 6]} />
              <meshStandardMaterial color="#241610" roughness={1} />
            </mesh>
          ))}
          <mesh position={[-0.9, 1.28, 0]}>
            <boxGeometry args={[0.16, 0.16, 2.3]} />
            <meshStandardMaterial color="#5f5a52" roughness={0.85} />
          </mesh>
          {/* 炉膛刻字 */}
          <mesh position={[-0.37, 0.95, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.7, 0.02, 0.02]} />
            <meshStandardMaterial color="#d8b06a" emissive="#a87c3a" emissiveIntensity={0.4} />
          </mesh>
        </group>
      </PropAsset>

      {/* 油画（北墙，近方形 GLB 按高 1.17 归一，底边 1.3 顶部 2.47 对齐程序化跨度） */}
      <PropAsset objectId="obj_study_painting" position={[-1.6, 1.3, -4.91]}>
        <group position={[-1.6, 1.9, -4.91]}>
          <mesh>
            <boxGeometry args={[1.7, 1.2, 0.08]} />
            <meshStandardMaterial color="#7a5f34" metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[1.5, 1.0]} />
            <meshStandardMaterial color="#1d2a24" roughness={0.85} />
          </mesh>
          <mesh position={[-0.3, -0.1, 0.06]}>
            <boxGeometry args={[0.5, 0.6, 0.01]} />
            <meshStandardMaterial color="#31473a" roughness={0.9} />
          </mesh>
          <mesh position={[0.35, -0.2, 0.06]}>
            <boxGeometry args={[0.3, 0.45, 0.01]} />
            <meshStandardMaterial color="#5a3a24" roughness={0.9} />
          </mesh>
          <mesh position={[0.5, 0.28, 0.06]}>
            <sphereGeometry args={[0.08, 10, 10]} />
            <meshStandardMaterial color="#8a6a4a" roughness={0.9} />
          </mesh>
        </group>
      </PropAsset>

      {/* 落地镜（东墙，含支架整体落地 y=0，绕 Y -90° 面向室内） */}
      <PropAsset objectId="obj_study_mirror" position={[4.9, 0, -2.0]} rotationYDeg={-90}>
        <group position={[4.9, 1.7, -2.0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh position={[0, 0, -0.04]}>
            <boxGeometry args={[1.3, 2.1, 0.08]} />
            <meshStandardMaterial color="#6b5330" metalness={0.4} roughness={0.55} />
          </mesh>
          <mesh>
            <planeGeometry args={[1.1, 1.9]} />
            <meshStandardMaterial color="#8ea6b8" metalness={1} roughness={0.06} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <planeGeometry args={[1.1, 1.9]} />
            <meshBasicMaterial color="#aebfcc" transparent opacity={0.12} />
          </mesh>
        </group>
      </PropAsset>

      {/* 地板暗门（点亮提灯后显形；打开后露出向下阶梯） */}
      {lanternLit && (
        <PropAsset objectId="obj_study_floor_door" position={[-2.4, 0.02, 0.9]}>
          <group position={[-2.4, 0.03, 0.9]}>
            {!cellarOpen && (
              <mesh>
                <boxGeometry args={[1.15, 0.06, 1.15]} />
                <meshStandardMaterial color="#3a2a1b" roughness={0.7} metalness={0.1} />
              </mesh>
            )}
            {!cellarOpen && (
              <mesh position={[0, 0.04, 0]}>
                <torusGeometry args={[0.12, 0.02, 6, 16]} />
                <meshStandardMaterial color="#b08b48" metalness={0.9} roughness={0.3} />
              </mesh>
            )}
            {cellarOpen && (
              <>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
                  <planeGeometry args={[1.2, 1.2]} />
                  <meshBasicMaterial color="#020202" />
                </mesh>
                {[0, 1, 2, 3].map((step) => (
                  <mesh key={`hatch-step-${step}`} position={[0, -0.22 - step * 0.24, 0.35 + step * 0.28]}>
                    <boxGeometry args={[1.0, 0.08, 0.3]} />
                    <meshStandardMaterial color="#3d2c1c" roughness={0.85} />
                  </mesh>
                ))}
                <mesh position={[0.62, 0.05, 0.62]}>
                  <boxGeometry args={[1.15, 0.06, 1.15]} />
                  <meshStandardMaterial color="#3a2a1b" roughness={0.7} />
                </mesh>
                <pointLight position={[0, -0.4, 0.4]} color="#5b6b7a" intensity={0.6} distance={3} />
              </>
            )}
          </group>
        </PropAsset>
      )}
    </group>
  )
}

/** 地下室：淋浴间玻璃门、石壁浮雕、铜管洗手台、三个转盘、暗门、石阶。 */
function BasementProps() {
  const dialOrder = useGameStore((state) => state.game.dialOrder)
  const dialsSolved = useGameStore((state) => state.game.flags.dials_solved)
  const secretOpen = useGameStore((state) => state.game.flags.secret_open)

  return (
    <group>
      {/* 淋浴间（西北角） */}
      <PropAsset objectId="obj_basement_shower" position={[-3.0, 0, -2.8]}>
        <group position={[-3.0, 0, -2.8]}>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[1.8, 0.12, 1.7]} />
            <meshStandardMaterial color="#4c5357" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.1, -0.82]}>
            <boxGeometry args={[1.8, 2.2, 0.08]} />
            <meshStandardMaterial color="#5a6165" roughness={0.85} />
          </mesh>
          {[-0.86, 0.86].map((x) => (
            <mesh key={`shower-side-${x}`} position={[x, 1.1, -0.05]}>
              <boxGeometry args={[0.08, 2.2, 1.5]} />
              <meshStandardMaterial color="#4e5559" roughness={0.9} />
            </mesh>
          ))}
          {/* 磨砂玻璃门 */}
          <mesh position={[0, 1.05, 0.72]}>
            <boxGeometry args={[1.68, 2.0, 0.04]} />
            <meshStandardMaterial color="#9fb7c0" transparent opacity={0.22} roughness={0.25} metalness={0.1} />
          </mesh>
          <mesh position={[0.62, 1.0, 0.76]}>
            <cylinderGeometry args={[0.02, 0.02, 0.34, 6]} />
            <meshStandardMaterial color="#b9a05f" metalness={0.9} roughness={0.3} />
          </mesh>
          {/* 花洒 */}
          <mesh position={[0, 2.05, -0.35]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.7, 8]} />
            <meshStandardMaterial color="#8a8f92" metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[0, 2.02, -0.62]}>
            <cylinderGeometry args={[0.13, 0.13, 0.05, 12]} />
            <meshStandardMaterial color="#9aa0a3" metalness={0.85} roughness={0.3} />
          </mesh>
          {/* 灯照时玻璃后的暗门轮廓 */}
          <mesh position={[0, 1.15, -0.75]}>
            <boxGeometry args={[1.0, 1.9, 0.03]} />
            <meshStandardMaterial color="#3a3f42" roughness={0.9} emissive="#4f6f80" emissiveIntensity={0.25} />
          </mesh>
        </group>
      </PropAsset>

      {/* 石壁浮雕（北墙，GLB 底边对齐到 0.7m 高） */}
      <PropAsset objectId="obj_basement_mural" position={[-0.65, 0.7, -3.9]}>
        <group position={[-0.65, 0, -3.9]}>
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[2.4, 1.5, 0.14]} />
            <meshStandardMaterial color="#4a4f52" roughness={0.92} />
          </mesh>
          {/* 三角 */}
          <mesh position={[-0.65, 1.75, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.06, 3]} />
            <meshStandardMaterial color="#8a9a9f" emissive="#5d7f8f" emissiveIntensity={0.5} roughness={0.7} />
          </mesh>
          <mesh position={[-0.25, 1.75, 0.1]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshStandardMaterial color="#c9b27a" emissive="#8a6f2d" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[-0.16, 1.75, 0.1]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshStandardMaterial color="#c9b27a" emissive="#8a6f2d" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[-0.07, 1.75, 0.1]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshStandardMaterial color="#c9b27a" emissive="#8a6f2d" emissiveIntensity={0.5} />
          </mesh>
          {/* 圆环 */}
          <mesh position={[-0.65, 1.4, 0.1]}>
            <torusGeometry args={[0.15, 0.035, 8, 20]} />
            <meshStandardMaterial color="#8a9a9f" emissive="#5d7f8f" emissiveIntensity={0.5} roughness={0.7} />
          </mesh>
          <mesh position={[-0.25, 1.4, 0.1]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshStandardMaterial color="#c9b27a" emissive="#8a6f2d" emissiveIntensity={0.5} />
          </mesh>
          {/* 方框 */}
          <mesh position={[-0.65, 1.05, 0.1]}>
            <boxGeometry args={[0.3, 0.3, 0.06]} />
            <meshStandardMaterial color="#8a9a9f" emissive="#5d7f8f" emissiveIntensity={0.5} roughness={0.7} />
          </mesh>
          {[-0.25, -0.16].map((x) => (
            <mesh key={`box-dot-${x}`} position={[x, 1.05, 0.1]}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshStandardMaterial color="#c9b27a" emissive="#8a6f2d" emissiveIntensity={0.5} />
            </mesh>
          ))}
        </group>
      </PropAsset>

      {/* 铜管洗手台（东墙，GLB 正面绕 Y -90° 朝室内） */}
      <PropAsset objectId="obj_basement_basin" position={[4.1, 0, 1.4]} rotationYDeg={-90}>
        <group position={[4.1, 0, 1.4]}>
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.75, 0.12, 1.1]} />
            <meshStandardMaterial color="#4f565a" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.18, 0.24, 0.76, 10]} />
            <meshStandardMaterial color="#3f4548" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.86, 0]}>
            <cylinderGeometry args={[0.3, 0.34, 0.14, 16, 1, true]} />
            <meshStandardMaterial color="#5d6669" roughness={0.5} metalness={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-0.2, 1.15, 0]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
            <meshStandardMaterial color="#a98d52" metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh position={[-0.02, 1.0, 0]}>
            <boxGeometry args={[0.02, 0.26, 0.5]} />
            <meshStandardMaterial color="#6b5840" roughness={0.8} />
          </mesh>
          {/* 刻文（发光细线示意反向刻字） */}
          <mesh position={[0.05, 0.55, 0.34]}>
            <boxGeometry args={[0.02, 0.18, 0.02]} />
            <meshStandardMaterial color="#d8b06a" emissive="#a87c3a" emissiveIntensity={0.6} />
          </mesh>
        </group>
      </PropAsset>

      {/* 三个转盘（北墙）：Blender 拆分盘体优先（T-011 动画），程序化兜底 */}
      {[
        { x: 1.3, value: 1, symbol: '三角' },
        { x: 1.9, value: 2, symbol: '圆环' },
        { x: 2.5, value: 3, symbol: '方框' },
      ].map((dial) => {
        const index = dialOrder.indexOf(dial.value)
        const angle = index >= 0 ? (index + 1) * 1.05 : 0
        const procedural = (
          <group position={[dial.x, 1.35, -3.9]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
              <meshStandardMaterial color="#7d6835" metalness={0.85} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0, 0.08]} rotation={[0, 0, angle]}>
              <boxGeometry args={[0.05, 0.3, 0.03]} />
              <meshStandardMaterial color="#e0c479" metalness={0.7} roughness={0.3} emissive="#a8842f" emissiveIntensity={index >= 0 ? 0.8 : 0.1} />
            </mesh>
            <mesh position={[0, 0, 0.06]}>
              <torusGeometry args={[0.23, 0.014, 6, 24]} />
              <meshStandardMaterial color="#c9a85c" emissive={dialsSolved ? '#ffd27a' : '#6a5420'} emissiveIntensity={dialsSolved ? 0.9 : 0.2} />
            </mesh>
            <pointLight color="#c8a860" intensity={0.12} distance={0.8} />
          </group>
        )
        return (
          <DialPartSlot key={`dial-asset-${dial.value}`} dialIndex={dial.value} position={[dial.x, 1.13, -3.9]} fallback={procedural} />
        )
      })}

      {/* 暗门（东墙，GLB 绕 Y -90° 面向室内） */}
      <PropAsset objectId="obj_basement_secret_door" position={[4.5, 0, -2.4]} rotationYDeg={-90}>
        <group position={[4.5, 0, -2.4]}>
          <mesh position={[0, 1.3, 0]}>
            <boxGeometry args={[0.16, 2.2, 1.45]} />
            <meshStandardMaterial
              color={secretOpen ? '#101214' : '#3d4245'}
              emissive={dialsSolved ? '#2e7fa8' : '#000000'}
              emissiveIntensity={dialsSolved ? 0.5 : 0}
              roughness={0.9}
            />
          </mesh>
          {!secretOpen && (
            <>
              {[-0.5, 0, 0.5].map((offset) => (
                <mesh key={`door-seam-${offset}`} position={[-0.1, 1.3, offset]}>
                  <boxGeometry args={[0.02, 2.0, 0.02]} />
                  <meshStandardMaterial color="#8fb4c4" emissive="#6fb4d8" emissiveIntensity={dialsSolved ? 1.2 : 0.25} />
                </mesh>
              ))}
            </>
          )}
          {secretOpen && (
            <>
              <mesh rotation={[0, 0, 0]} position={[0.1, 1.3, 0.85]}>
                <boxGeometry args={[0.1, 2.1, 1.3]} />
                <meshStandardMaterial color="#262a2d" roughness={0.95} />
              </mesh>
              <pointLight position={[-0.6, 1.4, 0]} color="#9fe7ff" intensity={1.4} distance={5} />
            </>
          )}
        </group>
      </PropAsset>

      {/* 石阶（回到书房） */}
      <PropAsset objectId="obj_basement_stairs" position={[3.5, 0, 3.4]}>
        <group position={[3.5, 0, 3.4]}>
          {[0, 1, 2, 3, 4, 5].map((step) => (
            <mesh key={`ladder-step-${step}`} position={[0, 0.1 + step * 0.26, -step * 0.22]}>
              <boxGeometry args={[0.9, 0.08, 0.24]} />
              <meshStandardMaterial color="#4a3421" roughness={0.85} />
            </mesh>
          ))}
          {[-0.42, 0.42].map((x) => (
            <mesh key={`ladder-rail-${x}`} position={[x, 1.1, -0.55]} rotation={[0.55, 0, 0]}>
              <boxGeometry args={[0.08, 2.1, 0.08]} />
              <meshStandardMaterial color="#3d2b1b" roughness={0.85} />
            </mesh>
          ))}
        </group>
      </PropAsset>
    </group>
  )
}

/** 密室：石台、手稿、发光石、挂毯、烛台。 */
function ChamberProps() {
  return (
    <group>
      {/* 石台 */}
      <PropAsset objectId="obj_chamber_pedestal" position={[0, 0, -1.6]}>
        <group position={[0, 0, -1.6]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.62, 0.72, 0.24, 8]} />
            <meshStandardMaterial color="#3c3a4c" roughness={0.8} metalness={0.1} />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <cylinderGeometry args={[0.4, 0.5, 0.6, 8]} />
            <meshStandardMaterial color="#343244" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.6, 0.5, 0.16, 8]} />
            <meshStandardMaterial color="#45425a" roughness={0.7} metalness={0.15} />
          </mesh>
          {/* 手稿 */}
          <mesh position={[0, 1.0, 0.05]} rotation={[-Math.PI / 2, 0, 0.1]}>
            <boxGeometry args={[0.42, 0.02, 0.32]} />
            <meshStandardMaterial color="#e6dcc4" emissive="#b8a982" emissiveIntensity={0.12} />
          </mesh>
          {/* 发光石 */}
          <mesh position={[0, 1.22, 0]}>
            <octahedronGeometry args={[0.14]} />
            <meshStandardMaterial color="#9fe7ff" emissive="#5fd0ff" emissiveIntensity={1.6} roughness={0.2} />
          </mesh>
          <pointLight position={[0, 1.25, 0]} color="#8fe2ff" intensity={1.6} distance={4.5} decay={2} />
        </group>
      </PropAsset>

      {/* 挂毯（北墙，GLB 底边对齐到 1.15m 高） */}
      <PropAsset objectId="obj_chamber_tapestry" position={[0, 1.15, -3.5]}>
        <group position={[0, 2.1, -3.5]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[2.4, 1.9, 0.05]} />
            <meshStandardMaterial color="#2b1a30" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.1, 0.04]}>
            <planeGeometry args={[1.9, 1.3]} />
            <meshStandardMaterial color="#3a2246" roughness={0.9} />
          </mesh>
          <mesh position={[0.2, -0.2, 0.05]}>
            <circleGeometry args={[0.38, 20]} />
            <meshStandardMaterial color="#6a3d5c" roughness={0.9} />
          </mesh>
          {[-0.5, -0.2, 0.1, 0.4].map((x) => (
            <mesh key={`tapestry-line-${x}`} position={[x, 0.45, 0.05]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.02, 0.4, 0.01]} />
              <meshStandardMaterial color="#8a6a4a" emissive="#55402a" emissiveIntensity={0.2} />
            </mesh>
          ))}
          <mesh position={[0, 0.98, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 2.6, 8]} />
            <meshStandardMaterial color="#7d6835" metalness={0.8} roughness={0.4} />
          </mesh>
        </group>
      </PropAsset>

      {/* 烛台（装饰，始终程序化） */}
      {[-2.3, 2.3].map((x) => (
        <group key={`candle-${x}`} position={[x, 0, -2.5]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.06, 0.12, 1.1, 8]} />
            <meshStandardMaterial color="#2f2c26" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.18, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.18, 8]} />
            <meshStandardMaterial color="#e8d9b0" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.3, 0]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial color="#ffcf7a" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function ZoneProps({ zone }: { zone: ZoneId }) {
  if (zone === 'zone_study') return <StudyProps />
  if (zone === 'zone_basement') return <BasementProps />
  return <ChamberProps />
}

/** 检索/Agent 高亮：围绕目标对象的脉动线框球 + 点光。 */
export function HighlightHalo() {
  const highlight = useGameStore((state) => state.highlight)
  const zone = useGameStore((state) => state.game.zone)
  const mesh = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const object = highlight ? OBJECTS[highlight.objectId] : undefined

  useFrame((state) => {
    const active = Boolean(highlight && object && object.zoneId === zone && Date.now() < highlight.until)
    if (mesh.current) {
      mesh.current.visible = active
      mesh.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 5) * 0.07)
      mesh.current.rotation.y += 0.012
    }
    if (light.current) {
      light.current.intensity = active ? 1.1 : 0
    }
  })

  if (!object || object.zoneId !== zone) return null

  return (
    <group position={object.position}>
      <mesh ref={mesh}>
        <sphereGeometry args={[0.55, 16, 12]} />
        <meshBasicMaterial color="#ffd27a" wireframe transparent opacity={0.45} />
      </mesh>
      <pointLight ref={light} color="#ffd27a" intensity={0} distance={2.6} />
    </group>
  )
}
