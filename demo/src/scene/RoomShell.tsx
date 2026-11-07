import type { ZoneId } from '../game/types.ts'
import { ZONES } from '../data/scene.ts'

/** 房间壳：地板/天花板/四面墙/踢脚线 + 各 zone 的建筑特征。全部程序化几何，无外部资产。 */
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
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#3b2b1e" roughness={0.85} metalness={0.02} />
        </mesh>
        {/* 木地板条 */}
        {Array.from({ length: 11 }, (_, index) => (
          <mesh key={`plank-${index}`} position={[centerX, 0.006, minZ + 0.5 + index * 0.9]}>
            <boxGeometry args={[width - 0.1, 0.012, 0.86]} />
            <meshStandardMaterial color={index % 2 === 0 ? '#4a3524' : '#43301f'} roughness={0.8} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, height, centerZ]}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#2a2018" roughness={0.95} />
        </mesh>
        {/* 墙 */}
        <mesh position={[centerX, height / 2, minZ - wall / 2]}>
          <boxGeometry args={[width + wall * 2, height, wall]} />
          <meshStandardMaterial color="#4a3b2c" roughness={0.9} />
        </mesh>
        <mesh position={[centerX, height / 2, maxZ + wall / 2]}>
          <boxGeometry args={[width + wall * 2, height, wall]} />
          <meshStandardMaterial color="#413327" roughness={0.9} />
        </mesh>
        <mesh position={[minX - wall / 2, height / 2, centerZ]}>
          <boxGeometry args={[wall, height, depth]} />
          <meshStandardMaterial color="#443629" roughness={0.9} />
        </mesh>
        <mesh position={[maxX + wall / 2, height / 2, centerZ]}>
          <boxGeometry args={[wall, height, depth]} />
          <meshStandardMaterial color="#3f3226" roughness={0.9} />
        </mesh>
        {/* 天花板横梁 */}
        {[-3.2, 0, 3.2].map((x) => (
          <mesh key={`beam-${x}`} position={[x, height - 0.12, centerZ]}>
            <boxGeometry args={[0.22, 0.24, depth]} />
            <meshStandardMaterial color="#241a12" roughness={0.95} />
          </mesh>
        ))}
        {/* 北墙窗（雨夜） */}
        <mesh position={[2.65, 2.0, minZ + 0.02]}>
          <boxGeometry args={[1.7, 1.35, 0.06]} />
          <meshStandardMaterial color="#1e2b3f" emissive="#2c4a72" emissiveIntensity={0.55} roughness={0.2} />
        </mesh>
        {[-0.5, 0, 0.5].map((offset) => (
          <mesh key={`rain-${offset}`} position={[2.65 + offset, 2.0, minZ + 0.06]}>
            <boxGeometry args={[0.02, 1.2, 0.01]} />
            <meshBasicMaterial color="#9fc3ff" transparent opacity={0.32} />
          </mesh>
        ))}
        <mesh position={[2.65, 1.3, minZ + 0.1]}>
          <boxGeometry args={[1.85, 0.1, 0.18]} />
          <meshStandardMaterial color="#2b2118" roughness={0.8} />
        </mesh>
        {/* 踢脚线 */}
        {[
          [centerX, 0.09, minZ + 0.04, width, 0.18, 0.08],
          [centerX, 0.09, maxZ - 0.04, width, 0.18, 0.08],
          [minX + 0.04, 0.09, centerZ, 0.08, 0.18, depth],
          [maxX - 0.04, 0.09, centerZ, 0.08, 0.18, depth],
        ].map(([x, y, z, w, h, d], index) => (
          <mesh key={`base-${index}`} position={[x as number, y as number, z as number]}>
            <boxGeometry args={[w as number, h as number, d as number]} />
            <meshStandardMaterial color="#2b2016" roughness={0.85} />
          </mesh>
        ))}
      </group>
    )
  }

  if (zone === 'zone_basement') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#34383b" roughness={0.95} />
        </mesh>
        {/* 地砖缝 */}
        {Array.from({ length: 8 }, (_, index) => (
          <mesh key={`tile-x-${index}`} position={[minX + 0.6 + index * 1.1, 0.004, centerZ]}>
            <boxGeometry args={[0.03, 0.008, depth]} />
            <meshStandardMaterial color="#22262a" roughness={1} />
          </mesh>
        ))}
        {Array.from({ length: 7 }, (_, index) => (
          <mesh key={`tile-z-${index}`} position={[centerX, 0.004, minZ + 0.6 + index * 1.1]}>
            <boxGeometry args={[width, 0.008, 0.03]} />
            <meshStandardMaterial color="#22262a" roughness={1} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, height, centerZ]}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#262a2d" roughness={1} />
        </mesh>
        <mesh position={[centerX, height / 2, minZ - wall / 2]}>
          <boxGeometry args={[width + wall * 2, height, wall]} />
          <meshStandardMaterial color="#4a5054" roughness={0.95} />
        </mesh>
        <mesh position={[centerX, height / 2, maxZ + wall / 2]}>
          <boxGeometry args={[width + wall * 2, height, wall]} />
          <meshStandardMaterial color="#3f4549" roughness={0.95} />
        </mesh>
        <mesh position={[minX - wall / 2, height / 2, centerZ]}>
          <boxGeometry args={[wall, height, depth]} />
          <meshStandardMaterial color="#454b4f" roughness={0.95} />
        </mesh>
        <mesh position={[maxX + wall / 2, height / 2, centerZ]}>
          <boxGeometry args={[wall, height, depth]} />
          <meshStandardMaterial color="#454b4f" roughness={0.95} />
        </mesh>
        {/* 墙面水渍/石缝 */}
        {Array.from({ length: 10 }, (_, index) => (
          <mesh key={`stain-${index}`} position={[minX + 0.5 + ((index * 1.7) % (width - 1)), 0.9 + ((index * 0.37) % 1.6), maxZ - 0.03]}>
            <boxGeometry args={[0.5 + (index % 3) * 0.4, 0.5 + (index % 2) * 0.5, 0.01]} />
            <meshStandardMaterial color="#2f3538" roughness={1} transparent opacity={0.6} />
          </mesh>
        ))}
        {/* 管道 */}
        <mesh position={[centerX, 2.72, minZ + 0.35]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, width - 0.4, 8]} />
          <meshStandardMaterial color="#5b5247" metalness={0.65} roughness={0.55} />
        </mesh>
        <mesh position={[minX + 0.35, 2.0, centerZ]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, depth - 0.4, 8]} />
          <meshStandardMaterial color="#4d463d" metalness={0.6} roughness={0.6} />
        </mesh>
      </group>
    )
  }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1b1a24" roughness={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[centerX, height, centerZ]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#13121a" roughness={1} />
      </mesh>
      {/* 石壁 */}
      <mesh position={[centerX, height / 2, minZ - wall / 2]}>
        <boxGeometry args={[width + wall * 2, height, wall]} />
        <meshStandardMaterial color="#2c2a3a" roughness={0.9} />
      </mesh>
      <mesh position={[centerX, height / 2, maxZ + wall / 2]}>
        <boxGeometry args={[width + wall * 2, height, wall]} />
        <meshStandardMaterial color="#272534" roughness={0.9} />
      </mesh>
      <mesh position={[minX - wall / 2, height / 2, centerZ]}>
        <boxGeometry args={[wall, height, depth]} />
        <meshStandardMaterial color="#2a2836" roughness={0.9} />
      </mesh>
      <mesh position={[maxX + wall / 2, height / 2, centerZ]}>
        <boxGeometry args={[wall, height, depth]} />
        <meshStandardMaterial color="#2a2836" roughness={0.9} />
      </mesh>
      {/* 角落石柱 */}
      {[
        [minX + 0.5, minZ + 0.5],
        [maxX - 0.5, minZ + 0.5],
        [minX + 0.5, maxZ - 0.5],
        [maxX - 0.5, maxZ - 0.5],
      ].map(([x, z], index) => (
        <mesh key={`pillar-${index}`} position={[x as number, height / 2, z as number]}>
          <cylinderGeometry args={[0.32, 0.4, height, 8]} />
          <meshStandardMaterial color="#343144" roughness={0.85} metalness={0.05} />
        </mesh>
      ))}
      {/* 地面符文圆环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.015, centerZ]}>
        <torusGeometry args={[1.9, 0.035, 8, 64]} />
        <meshStandardMaterial color="#4d6f8a" emissive="#2e7fa8" emissiveIntensity={0.9} roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.014, centerZ]}>
        <torusGeometry args={[1.45, 0.02, 8, 64]} />
        <meshStandardMaterial color="#3d5a70" emissive="#255f80" emissiveIntensity={0.7} roughness={0.6} />
      </mesh>
    </group>
  )
}
