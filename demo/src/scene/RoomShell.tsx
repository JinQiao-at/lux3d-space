import * as THREE from 'three'
import type { ZoneId } from '../game/types.ts'
import { ZONES } from '../data/scene.ts'

/** 房间壳：地板/天花板/四面墙/踢脚线 + 各 zone 的建筑特征。全部程序化几何，无外部资产。
 *
 * 任务③ 性能优化：材质池化——原 74 个逐 mesh 内联 material 实例改为模块级共享常量（唯一键 ~30）。
 * 通过 material={MAT.x} 属性传入的外部材质不会被 R3F 在 zone 卸载时 dispose，跨 zone 切换复用零重建成本。
 * 绘制参数（颜色/roughness/emissive/金属度）与池化前逐字一致，渲染表现不变。
 */

const std = (color: string, roughness: number, extra?: Partial<THREE.MeshStandardMaterialParameters>) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra })

const MAT = {
  // 书房
  studyFloor: std('#3b2b1e', 0.85, { metalness: 0.02 }),
  plankA: std('#4a3524', 0.8),
  plankB: std('#43301f', 0.8),
  studyCeil: std('#2a2018', 0.95),
  wallStudyN: std('#4a3b2c', 0.9),
  wallStudyS: std('#413327', 0.9),
  wallStudyW: std('#443629', 0.9),
  wallStudyE: std('#3f3226', 0.9),
  beam: std('#241a12', 0.95),
  window: std('#1e2b3f', 0.2, { emissive: '#2c4a72', emissiveIntensity: 0.9 }),
  sill: std('#2b2118', 0.8),
  base: std('#2b2016', 0.85),
  // 地下室
  bFloor: std('#34383b', 0.95),
  tile: std('#22262a', 1),
  bCeil: std('#262a2d', 1),
  wallBN: std('#4a5054', 0.95),
  wallBS: std('#3f4549', 0.95),
  wallBW: std('#454b4f', 0.95),
  stain: std('#2f3538', 1, { transparent: true, opacity: 0.6 }),
  pipeA: std('#5b5247', 0.55, { metalness: 0.65 }),
  pipeB: std('#4d463d', 0.6, { metalness: 0.6 }),
  // 密室
  cFloor: std('#1b1a24', 0.9),
  cCeil: std('#13121a', 1),
  wallCN: std('#2c2a3a', 0.9),
  wallCS: std('#272534', 0.9),
  wallCW: std('#2a2836', 0.9),
  pillar: std('#343144', 0.85, { metalness: 0.05 }),
  runeA: std('#4d6f8a', 0.5, { emissive: '#2e7fa8', emissiveIntensity: 0.9 }),
  runeB: std('#3d5a70', 0.6, { emissive: '#255f80', emissiveIntensity: 0.7 }),
  // 雨丝（basic）
  rain: new THREE.MeshBasicMaterial({ color: '#9fc3ff', transparent: true, opacity: 0.32 }),
}

/** 房间壳（只读渲染层；材质共享，geometry 仍逐 mesh）。 */
export function RoomShell({ zone }: { zone: ZoneId }) {
  const zoneDef = ZONES[zone]
  const minX = zoneDef.bounds.min[0]
  const maxX = zoneDef.bounds.max[0]
  const minZ = zoneDef.bounds.min[2]
  const maxZ = zoneDef.bounds.max[2]
  const height = zoneDef.bounds.max[1]
  const width = maxX - minX
  const depth = maxZ - minZ
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const wall = 0.2

  if (zone === 'zone_study') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={MAT.studyFloor}>
          <planeGeometry args={[width, depth]} />
        </mesh>
        {/* 木地板条 */}
        {Array.from({ length: 11 }, (_, index) => (
          <mesh
            key={`plank-${index}`}
            position={[centerX, 0.006, minZ + 0.5 + index * 0.9]}
            material={index % 2 === 0 ? MAT.plankA : MAT.plankB}
          >
            <boxGeometry args={[width - 0.1, 0.012, 0.86]} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, height, centerZ]} material={MAT.studyCeil}>
          <planeGeometry args={[width, depth]} />
        </mesh>
        {/* 墙 */}
        <mesh position={[centerX, height / 2, minZ - wall / 2]} material={MAT.wallStudyN}>
          <boxGeometry args={[width + wall * 2, height, wall]} />
        </mesh>
        <mesh position={[centerX, height / 2, maxZ + wall / 2]} material={MAT.wallStudyS}>
          <boxGeometry args={[width + wall * 2, height, wall]} />
        </mesh>
        <mesh position={[minX - wall / 2, height / 2, centerZ]} material={MAT.wallStudyW}>
          <boxGeometry args={[wall, height, depth]} />
        </mesh>
        <mesh position={[maxX + wall / 2, height / 2, centerZ]} material={MAT.wallStudyE}>
          <boxGeometry args={[wall, height, depth]} />
        </mesh>
        {/* 天花板横梁 */}
        {[-3.2, 0, 3.2].map((x) => (
          <mesh key={`beam-${x}`} position={[x, height - 0.12, centerZ]} material={MAT.beam}>
            <boxGeometry args={[0.22, 0.24, depth]} />
          </mesh>
        ))}
        {/* 北墙窗（雨夜） */}
        <mesh position={[2.65, 2.0, minZ + 0.02]} material={MAT.window}>
          <boxGeometry args={[1.7, 1.35, 0.06]} />
        </mesh>
        {[-0.5, 0, 0.5].map((offset) => (
          <mesh key={`rain-${offset}`} position={[2.65 + offset, 2.0, minZ + 0.06]} material={MAT.rain}>
            <boxGeometry args={[0.02, 1.2, 0.01]} />
          </mesh>
        ))}
        <mesh position={[2.65, 1.3, minZ + 0.1]} material={MAT.sill}>
          <boxGeometry args={[1.85, 0.1, 0.18]} />
        </mesh>
        {/* 踢脚线 */}
        {[
          [centerX, 0.09, minZ + 0.04, width, 0.18, 0.08],
          [centerX, 0.09, maxZ - 0.04, width, 0.18, 0.08],
          [minX + 0.04, 0.09, centerZ, 0.08, 0.18, depth],
          [maxX - 0.04, 0.09, centerZ, 0.08, 0.18, depth],
        ].map(([x, y, z, w, h, d], index) => (
          <mesh key={`base-${index}`} position={[x as number, y as number, z as number]} material={MAT.base}>
            <boxGeometry args={[w as number, h as number, d as number]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (zone === 'zone_basement') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={MAT.bFloor}>
          <planeGeometry args={[width, depth]} />
        </mesh>
        {/* 地砖缝 */}
        {Array.from({ length: 8 }, (_, index) => (
          <mesh key={`tile-x-${index}`} position={[minX + 0.6 + index * 1.1, 0.004, centerZ]} material={MAT.tile}>
            <boxGeometry args={[0.03, 0.008, depth]} />
          </mesh>
        ))}
        {Array.from({ length: 7 }, (_, index) => (
          <mesh key={`tile-z-${index}`} position={[centerX, 0.004, minZ + 0.6 + index * 1.1]} material={MAT.tile}>
            <boxGeometry args={[width, 0.008, 0.03]} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, height, centerZ]} material={MAT.bCeil}>
          <planeGeometry args={[width, depth]} />
        </mesh>
        <mesh position={[centerX, height / 2, minZ - wall / 2]} material={MAT.wallBN}>
          <boxGeometry args={[width + wall * 2, height, wall]} />
        </mesh>
        <mesh position={[centerX, height / 2, maxZ + wall / 2]} material={MAT.wallBS}>
          <boxGeometry args={[width + wall * 2, height, wall]} />
        </mesh>
        <mesh position={[minX - wall / 2, height / 2, centerZ]} material={MAT.wallBW}>
          <boxGeometry args={[wall, height, depth]} />
        </mesh>
        <mesh position={[maxX + wall / 2, height / 2, centerZ]} material={MAT.wallBW}>
          <boxGeometry args={[wall, height, depth]} />
        </mesh>
        {/* 墙面水渍/石缝 */}
        {Array.from({ length: 10 }, (_, index) => (
          <mesh
            key={`stain-${index}`}
            position={[minX + 0.5 + ((index * 1.7) % (width - 1)), 0.9 + ((index * 0.37) % 1.6), maxZ - 0.03]}
            material={MAT.stain}
          >
            <boxGeometry args={[0.5 + (index % 3) * 0.4, 0.5 + (index % 2) * 0.5, 0.01]} />
          </mesh>
        ))}
        {/* 管道 */}
        <mesh position={[centerX, 2.72, minZ + 0.35]} rotation={[0, 0, Math.PI / 2]} material={MAT.pipeA}>
          <cylinderGeometry args={[0.07, 0.07, width - 0.4, 8]} />
        </mesh>
        <mesh position={[minX + 0.35, 2.0, centerZ]} rotation={[Math.PI / 2, 0, 0]} material={MAT.pipeB}>
          <cylinderGeometry args={[0.05, 0.05, depth - 0.4, 8]} />
        </mesh>
      </group>
    )
  }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={MAT.cFloor}>
        <planeGeometry args={[width, depth]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, height, centerZ]} material={MAT.cCeil}>
        <planeGeometry args={[width, depth]} />
      </mesh>
      {/* 石壁 */}
      <mesh position={[centerX, height / 2, minZ - wall / 2]} material={MAT.wallCN}>
        <boxGeometry args={[width + wall * 2, height, wall]} />
      </mesh>
      <mesh position={[centerX, height / 2, maxZ + wall / 2]} material={MAT.wallCS}>
        <boxGeometry args={[width + wall * 2, height, wall]} />
      </mesh>
      <mesh position={[minX - wall / 2, height / 2, centerZ]} material={MAT.wallCW}>
        <boxGeometry args={[wall, height, depth]} />
      </mesh>
      <mesh position={[maxX + wall / 2, height / 2, centerZ]} material={MAT.wallCW}>
        <boxGeometry args={[wall, height, depth]} />
      </mesh>
      {/* 角落石柱 */}
      {[
        [minX + 0.5, minZ + 0.5],
        [maxX - 0.5, minZ + 0.5],
        [minX + 0.5, maxZ - 0.5],
        [maxX - 0.5, maxZ - 0.5],
      ].map(([x, z], index) => (
        <mesh key={`pillar-${index}`} position={[x as number, height / 2, z as number]} material={MAT.pillar}>
          <cylinderGeometry args={[0.32, 0.4, height, 8]} />
        </mesh>
      ))}
      {/* 地面符文圆环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.015, centerZ]} material={MAT.runeA}>
        <torusGeometry args={[1.9, 0.035, 8, 64]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.014, centerZ]} material={MAT.runeB}>
        <torusGeometry args={[1.45, 0.02, 8, 64]} />
      </mesh>
    </group>
  )
}
