/**
 * GLB 资产优先加载层（Aholo Lux3D 接入前置）。
 *
 * 设计目标：
 * - 优先加载 `public/models/<objectId>.glb`（真实 Lux3D 资产），失败/缺失时由调用方回退程序化几何；
 * - 包围盒归一化：1 单位 = 1 米，XZ 居中、底部对齐 y=0（对齐 00-brief §11 Blender 规范）；
 * - 零网络资产：不使用 drei 默认的 CDN Draco 解码器；GLB 全部来自 `demo/public/models/`。
 *
 * 运行期探测策略：
 * 为避免“文件不存在时 useGLTF 抛错 → 错误边界 → 回退”造成每帧报错/控制台噪音，先对 URL 做一次
 * HEAD 探测（同 URL 缓存结果）；探测为存在时才挂载读取 GLB 的组件（Suspense + ErrorBoundary 双保险）。
 * 空 `public/models/` 目录 → 全部探测缺失 → 与纯程序化版本行为完全一致。
 */
import { Component, Suspense, useEffect, useMemo, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import type { Vec3 } from '../game/types.ts'
import { ASSET_REGISTRY } from './assetRegistry.ts'

export type AssetAvailability = 'checking' | 'present' | 'missing'

/**
 * 资产期望的最大边长（米），来自 pipeline/lux3d/assets-manifest.json 的 `scaleHintM`。
 * 说明：Lux3D 输出的 GLB 尺寸不保证与场景 1:1，这里按“最大边归一化”保证每件资产落在合理尺度；
 * 若 pipeline 已按 1:1 米导出，可把对应值改成 undefined / 或调用处不传 fitSize 以关闭缩放。
 */
export const ASSET_FIT_SIZE_HINTS: Record<string, number> = {
  // 书桌 GLB 实测 bbox X=1.20/Y=1.02/Z=0.88；按 0.98 归一后高 ≈0.83m，
  // 与程序化桌面 0.82m 及交互锚点（desk y=1.0 / diary y=0.98）一致，避免日记埋进桌身。
  obj_study_desk: 0.98,
  obj_study_diary: 0.2,
  // 书架 GLB 实测 bbox X=2.06/Y=2.40/Z=0.50；按 2.6 归一保「顶天」高度（宽 2.23、贴墙留缝可接受）。
  obj_study_bookshelf: 2.6,
  obj_study_fireplace: 1.8,
  obj_study_floor_door: 1.15,
  obj_study_mirror: 2.2,
  obj_study_painting: 1.2,
  obj_basement_stairs: 2.0,
  obj_basement_shower: 2.0,
  obj_basement_mural: 1.5,
  obj_basement_basin: 0.9,
  obj_basement_dial_1: 0.45,
  obj_basement_dial_2: 0.45,
  obj_basement_dial_3: 0.45,
  obj_basement_secret_door: 2.2,
  obj_chamber_pedestal: 1.0,
  obj_chamber_tapestry: 2.0,
}

const availabilityCache = new Map<string, Promise<boolean>>()

/** objectId → 已登记的 GLB 路径；未登记返回 null。 */
export function assetUrlFor(objectId: string): string | null {
  return ASSET_REGISTRY[objectId] ?? null
}

/** 清空探测缓存（HMR/测试用）。 */
export function clearAssetProbeCache(): void {
  availabilityCache.clear()
}

async function probeAsset(url: string): Promise<boolean> {
  if (typeof fetch !== 'function') return false
  const cached = availabilityCache.get(url)
  if (cached) return cached

  const promise = (async () => {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        headers: { Accept: 'model/gltf-binary,application/octet-stream;q=0.9,*/*;q=0.1' },
      })
      if (!response.ok) return false
      const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
      // 静态托管/SPA fallback 可能对缺失文件返回 index.html（200），必须排除
      if (contentType.includes('text/html')) return false
      const length = Number(response.headers.get('content-length') ?? '0')
      if (Number.isFinite(length) && length > 0) return true
      return contentType.includes('gltf') || contentType.includes('octet-stream') || contentType.includes('binary')
    } catch {
      return false
    }
  })()

  availabilityCache.set(url, promise)
  return promise
}

/** 探测某个 GLB 是否可加载；`checking` 期间调用方应回退程序化几何。 */
export function useAssetAvailability(url: string | null): AssetAvailability {
  const [state, setState] = useState<AssetAvailability>(url ? 'checking' : 'missing')

  useEffect(() => {
    if (!url) {
      setState('missing')
      return
    }
    let alive = true
    setState('checking')
    void probeAsset(url).then((available) => {
      if (alive) setState(available ? 'present' : 'missing')
    })
    return () => {
      alive = false
    }
  }, [url])

  return state
}

export interface AssetModelProps {
  /** GLB 路径（一般来自 ASSET_REGISTRY）。 */
  src: string
  /** 父坐标系中的放置点（GLB 底部中心对齐到该点）。 */
  position?: Vec3
  /** 绕 Y 轴旋转（度）。 */
  rotationYDeg?: number
  /** 归一化目标最大边长（米）；不传则保持 GLB 原始尺寸，仅做底部中心对准。 */
  fitSize?: number
}

/**
 * 单个 GLB 模型：useGLTF 加载 + 包围盒归一化（XZ 居中、底部 y=0、可选等比缩放到 fitSize）。
 * 加载失败由外层 AssetErrorBoundary 兜底；模型为空时渲染 null。
 */
export function AssetModel({ src, position = [0, 0, 0], rotationYDeg = 0, fitSize }: AssetModelProps) {
  // 第二个参数传 false：禁用 drei 的 Draco CDN 解码器，保持“零网络资产”。
  // 若后续 pipeline 输出 Draco 压缩 GLB，请把解码器放到 public/draco/ 并改为传本地路径。
  const gltf = useGLTF(src, false)

  const prepared = useMemo(() => {
    const sourceScene = gltf.scene
    if (!sourceScene || sourceScene.children.length === 0) return null

    const scene = sourceScene.clone(true)
    scene.updateMatrixWorld(true)
    const box = new Box3().setFromObject(scene)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    if (!Number.isFinite(size.x) || size.x + size.y + size.z <= 1e-6) return null

    const maxDimension = Math.max(size.x, size.y, size.z)
    const scale = fitSize && fitSize > 0 && maxDimension > 1e-6 ? fitSize / maxDimension : 1
    const offset: Vec3 = [-center.x, -box.min.y, -center.z]

    scene.traverse((child) => {
      child.castShadow = false
      child.receiveShadow = false
    })

    return { scene, scale, offset }
  }, [gltf.scene, fitSize])

  if (!prepared) return null

  return (
    <group position={position} rotation={[0, (rotationYDeg * Math.PI) / 180, 0]}>
      <group scale={prepared.scale}>
        <primitive object={prepared.scene} position={prepared.offset} />
      </group>
    </group>
  )
}

interface AssetErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

/** GLB 读取/解析失败时回退程序化几何（只 warn 不 error，避免冒充运行时错误）。 */
export class AssetErrorBoundary extends Component<AssetErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[AssetModel] GLB 加载失败，已回退程序化几何：', error?.message ?? error, info.componentStack)
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export interface PropAssetProps {
  objectId: string
  /** GLB 放置点（底部中心，父坐标系）。默认与父 group 原点一致。 */
  position?: Vec3
  /** 绕 Y 轴旋转（度），用于贴墙/朝向修正。 */
  rotationYDeg?: number
  /** 覆盖 ASSET_FIT_SIZE_HINTS 的归一化尺寸；显式传 undefined 时使用内置提示。 */
  fitSize?: number
  /** 程序化几何兜底（资产缺失、探测中、加载中、加载失败时渲染）。 */
  children: ReactNode
}

/**
 * 每个可交互物件的资产槽：Registry 命中且 GLB 可用 → 渲染真实资产；
 * 否则渲染 children（原有程序化几何）。交互高亮/点击逻辑仍由场景数据驱动，不受影响。
 */
export function PropAsset({ objectId, position, rotationYDeg = 0, fitSize, children }: PropAssetProps) {
  const url = assetUrlFor(objectId)
  const availability = useAssetAvailability(url)
  const fallback = <>{children}</>

  if (!url || availability !== 'present') return fallback

  return (
    <AssetErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <AssetModel
          src={url}
          position={position}
          rotationYDeg={rotationYDeg}
          fitSize={fitSize ?? ASSET_FIT_SIZE_HINTS[objectId]}
        />
      </Suspense>
    </AssetErrorBoundary>
  )
}
