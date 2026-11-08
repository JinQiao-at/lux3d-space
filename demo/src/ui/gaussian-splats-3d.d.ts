/** @mkkellogg/gaussian-splats-3d 的最小类型声明（包本体未随带 .d.ts，T-010）。 */
declare module '@mkkellogg/gaussian-splats-3d' {
  export interface ViewerOptions {
    gpuRenderer: unknown
    camera: unknown
    sharedMemoryForWorkers?: boolean
    [key: string]: unknown
  }
  export interface AddSplatSceneOptions {
    /** 运行时为数字枚举（Splat=0/KSplat=1/Ply=2/Spz=3）；扩展名字符串会被 0.4.7 的分发器拒绝 */
    format?: number
    dynamicScene?: boolean
    sceneRevealMode?: number
    [key: string]: unknown
  }
  export class Viewer {
    constructor(options: ViewerOptions)
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>
    start(): void
    stop(): void
    dispose(): void
  }
}
