/**
 * GLB 预加载（T-025 B2）：标题屏阶段预热全部已登记 GLB。
 *
 * 动机：17 件共 ~22MB 无预加载时，进入地下室瞬间 8 件并发下载，
 * Suspense fallback（程序化几何）会在叙事高潮处"啪"地换成 GLB。
 * 在标题页（用户阅读操作说明的窗口期）就把网络与解析做掉。
 *
 * - useGLTF.preload 走与运行期同一缓存（drei useGLTF 内部 useLoader），
 *   游戏内再次加载为零网络等待；
 * - 全部 fire-and-forget：任何失败不影响开局（PropAsset 三层兜底仍在）；
 * - assetRegistry 为唯一事实源（自动生成文件，只读其导出）。
 */
import { useGLTF } from '@react-three/drei'
import { ASSET_REGISTRY } from './assetRegistry.ts'

let warmed = false

/** 幂等预热：标题屏挂载时调用一次即可。 */
export function preloadRegisteredGlbs(): void {
  if (warmed) return
  warmed = true
  for (const url of Object.values(ASSET_REGISTRY)) {
    try {
      useGLTF.preload(url, false, true) // 与 AssetModel 一致：禁 CDN Draco + 开 Meshopt 解码（P1-A3）
    } catch {
      // 预热失败静默：运行期 PropAsset 的 HEAD 探测/兜底仍会接管
    }
  }
}
