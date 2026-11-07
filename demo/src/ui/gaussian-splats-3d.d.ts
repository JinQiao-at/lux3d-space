/** @mkkellogg/gaussian-splats-3d 的最小类型声明（包本体未随带 .d.ts，T-010）。 */
declare module '@mkkellogg/gaussian-splats-3d' {
  export interface ViewerOptions {
    gpuRenderer: unknown
    camera: unknown
    sharedMemoryForWorkers?: boolean
    [key: string]: unknown
  }
  export interface AddSplatSceneOptions {
    format?: 'ply' | 'spz' | 'splat' | 'ksplat'
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
