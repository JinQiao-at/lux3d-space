#!/usr/bin/env node
/**
 * Aholo Lux3D 资产管线：参考图（可选生成）→ 图生 3D → gltf-transform 优化 → GLB 归档 → 回写清单/注册表。
 *
 * 设计原则：
 * - 断点续跑：manifest 里 status=done 的默认跳过（--force 重做）；
 * - 不打印/不落盘 API Key（只从环境变量 AHOLO_API_KEY 读取）；
 * - 单个资产失败不影响其他资产，最终报告失败项并以非零码退出；
 * - 原始 GLB 备份到 runs/<ts>/raw/，优化后的 GLB 落到 demo/public/models/；
 * - 优化使用 gltf-transform：quantize + simplify(0.35) + webp(1024)，资产体积约降 80–90%；
 * - 运行期缺失该文件时 Demo 自动回退程序化几何。
 *
 * 用法见 README.md。
 */
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = path.join(__dirname, 'assets-manifest.json')
const GLTF_TRANSFORM_CLI = path.join(__dirname, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js')

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name, fallback = undefined) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const only = args.reduce((acc, cur, i) => (cur === '--only' && args[i + 1] ? [...acc, args[i + 1]] : acc), [])
const dryRun = flag('--dry-run')
const force = flag('--force')
const maxCount = Number(opt('--max', '0')) || 0
const regionOverride = opt('--region')
const versionOverride = opt('--version')
const concurrency = Math.max(1, Math.min(3, Number(opt('--concurrency', '1')) || 1))
const writeRegistryEnabled = !flag('--no-registry')
const optimizeEnabled = !flag('--no-optimize')

const OPTIMIZE_ARGS = [
  '--compress', 'quantize',
  '--simplify', 'true',
  '--simplify-ratio', '0.35',
  '--simplify-error', '0.001',
  '--texture-compress', 'webp',
  '--texture-size', '1024',
]

const IMAGE_MAGIC = [
  { ext: 'png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'webp', test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
]

const apiKey = process.env.AHOLO_API_KEY

function timestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function saveJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function detectImageExt(buffer) {
  for (const item of IMAGE_MAGIC) if (item.test(buffer)) return item.ext
  return 'png'
}

function pickUrls(value, out = []) {
  if (value == null) return out
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) out.push(value)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) pickUrls(item, out)
    return out
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) pickUrls(item, out)
  }
  return out
}

function pickUrl(value, extensions) {
  const urls = pickUrls(value)
  for (const ext of extensions) {
    const hit = urls.find((u) => u.toLowerCase().split('?')[0].endsWith(ext))
    if (hit) return hit
  }
  return urls[0] ?? null
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url.slice(0, 120)}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  await mkdir(path.dirname(dest), { recursive: true })
  await writeFile(dest, buffer)
  return buffer
}

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（>${Math.round(ms / 1000)}s）`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** SDK 的 create 返回 body.d，可能是字符串 taskId，也可能是对象。统一取字符串。 */
function normalizeTaskId(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const candidate = value.taskId ?? value.taskid ?? value.id ?? value.task_id
    if (candidate != null) return String(candidate)
  }
  throw new Error(`无法从返回值解析 taskId: ${JSON.stringify(value).slice(0, 200)}`)
}

async function ensureReference(client, asset, runDir, opts) {
  const refsDir = path.join(runDir, 'refs')
  await mkdir(refsDir, { recursive: true })
  // 复用已生成参考图（任意扩展名）
  if (opts.reuseRefs) {
    for (const ext of ['png', 'jpg', 'webp']) {
      const candidate = path.join(refsDir, `${asset.objectId}.${ext}`)
      try {
        const data = await readFile(candidate)
        if (data.length > 0) return { file: candidate, taskId: asset.referenceTaskId ?? null, reused: true }
      } catch {
        /* 继续 */
      }
    }
  }
  console.log(`  [image] 文生图: ${asset.objectId}（${asset.prompt.slice(0, 48)}…）`)
  const created = await client.multimodalToImage.create({ prompt: asset.prompt })
  const taskId = normalizeTaskId(created)
  const result = await withTimeout(client.tasks.waitFor(taskId), opts.pollTimeoutMs, '生图任务轮询')
  const url = pickUrl(result, ['.png', '.jpg', '.jpeg', '.webp'])
  if (!url) throw new Error(`生图结果中找不到图片 URL: ${JSON.stringify(result).slice(0, 300)}`)
  const tmp = path.join(refsDir, `${asset.objectId}.download`)
  const buffer = await download(url, tmp)
  const ext = detectImageExt(buffer)
  const finalFile = path.join(refsDir, `${asset.objectId}.${ext}`)
  await rename(tmp, finalFile)
  return { file: finalFile, taskId, reused: false, bytes: buffer.length, remoteUrl: url }
}

function runOptimize(input, output) {
  if (!optimizeEnabled) {
    copyFile(input, output)
    return { optimized: false, bytes: null }
  }
  const result = spawnSync(process.execPath, [GLTF_TRANSFORM_CLI, 'optimize', input, output, ...OPTIMIZE_ARGS], {
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
  })
  if (result.status !== 0) {
    console.warn(`  [optimize] gltf-transform 失败，保留原始 GLB：${String(result.stderr).slice(0, 300)}`)
    copyFile(input, output)
    return { optimized: false, bytes: null }
  }
  return { optimized: true, bytes: null }
}

async function toGlb(client, referenceFile, asset, opts, runDir) {
  console.log(`  [3d] 图生 3D: ${asset.objectId}（version=${asset.version || opts.version3d}）`)
  const baseParams = {
    version: asset.version || opts.version3d,
    faceCount: asset.faceCount || opts.faceCount,
    outputFormat: ['glb'],
    enablePbr: true,
    aiPredictSize: true,
  }
  let taskId
  try {
    const created = await client.imgTo3d.createFromFile(referenceFile, baseParams)
    taskId = normalizeTaskId(created)
  } catch (error) {
    // 兼容旧版 SDK：createFromFile 只接受 (file, { version })
    console.warn(`  [3d] 完整参数被拒绝（${error?.message ?? error}），降级为最小参数重试`)
    const created = await client.imgTo3d.createFromFile(referenceFile, { version: baseParams.version })
    taskId = normalizeTaskId(created)
  }
  const result = await withTimeout(client.tasks.waitFor(taskId), opts.pollTimeoutMs, '3D 任务轮询')
  const url = pickUrl(result, ['.glb'])
  if (!url) throw new Error(`3D 结果中找不到 GLB URL: ${JSON.stringify(result).slice(0, 300)}`)

  const rawDir = path.join(runDir, 'raw')
  await mkdir(rawDir, { recursive: true })
  const rawFile = path.join(rawDir, `${asset.objectId}.glb`)
  const rawBuffer = await download(url, rawFile)

  const outFile = path.join(opts.modelsDir, `${asset.objectId}.glb`)
  await mkdir(path.dirname(outFile), { recursive: true })
  const optimizeInfo = runOptimize(rawFile, outFile)
  const optimizedBytes = (await readFile(outFile)).length

  console.log(
    `  [glb] ${asset.objectId}: raw ${(rawBuffer.length / 1024 / 1024).toFixed(2)}MB → ` +
      `final ${(optimizedBytes / 1024 / 1024).toFixed(2)}MB（optimize=${optimizeInfo.optimized ? 'on' : 'off'}）`,
  )
  return { taskId, rawBytes: rawBuffer.length, bytes: optimizedBytes, outFile, rawFile, remoteUrl: url, optimized: optimizeInfo.optimized }
}

async function writeRegistry(manifest, opts) {
  const done = manifest.assets.filter((a) => a.status === 'done')
  const lines = done.map((a) => `  ${JSON.stringify(a.objectId)}: '/models/${a.objectId}.glb',`).join('\n')
  const content = `// AUTO-GENERATED by pipeline/lux3d/generate-assets.mjs — 请勿手改。\n// generatedAt: ${new Date().toISOString()}\n// 说明：只包含已生成成功的资产；运行期未命中时 Demo 自动回退程序化几何。\nexport const ASSET_REGISTRY: Record<string, string> = {\n${lines}\n}\n`
  await mkdir(path.dirname(path.resolve(__dirname, opts.registryFile)), { recursive: true })
  await writeFile(path.resolve(__dirname, opts.registryFile), content, 'utf8')
  console.log(`[registry] 已写入 ${opts.registryFile}（${done.length} 条）`)
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH)
  const region = regionOverride || process.env.AHOLO_REGION || manifest.region || 'cn'
  const defaults = manifest.defaults ?? {}
  const opts = {
    version3d: versionOverride || defaults.model3d || 'G1',
    faceCount: defaults.faceCount ?? 120000,
    modelsDir: path.resolve(__dirname, manifest.targets?.demoModelsDir ?? '../../demo/public/models'),
    registryFile: manifest.targets?.registryFile ?? '../../demo/src/scene/assetRegistry.ts',
    pollTimeoutMs: Number(process.env.LUX3D_POLL_TIMEOUT_MS ?? 15 * 60 * 1000),
    reuseRefs: !force,
  }

  const runDir = path.join(__dirname, manifest.targets?.runsDir ?? './runs', timestamp())
  await mkdir(runDir, { recursive: true })

  let queue = manifest.assets
  if (only.length > 0) queue = queue.filter((a) => only.includes(a.objectId))
  if (!force) queue = queue.filter((a) => a.status !== 'done')
  if (maxCount > 0) queue = queue.slice(0, maxCount)

  console.log(`[plan] region=${region} version=${opts.version3d} optimize=${optimizeEnabled} 待处理=${queue.length} dryRun=${dryRun}`)
  console.log(`[plan] models 输出目录: ${opts.modelsDir}`)

  if (dryRun) {
    for (const asset of queue) console.log(`  - ${asset.objectId}  (${asset.label}，优先级 ${asset.priority})`)
    console.log(`[plan] 已知完成 ${manifest.assets.filter((a) => a.status === 'done').length}/${manifest.assets.length}，全部明细见 assets-manifest.json`)
    return
  }

  if (!apiKey) {
    console.error('[error] 缺少 AHOLO_API_KEY 环境变量（不要写进代码；见 README.md 第 1 节）')
    process.exit(2)
  }

  const client = createLux3dClient({ region, apiKey })
  const report = { startedAt: new Date().toISOString(), region, version: opts.version3d, runDir, items: [], failures: [] }

  let index = 0
  const worker = async () => {
    while (index < queue.length) {
      const asset = queue[index++]
      const item = { objectId: asset.objectId, label: asset.label, startedAt: new Date().toISOString() }
      try {
        console.log(`\n[${asset.objectId}] 开始（${asset.label}）`)
        const ref = await ensureReference(client, asset, runDir, opts)
        item.reference = { taskId: ref.taskId, file: path.relative(runDir, ref.file), reused: ref.reused, bytes: ref.bytes }
        const glb = await toGlb(client, ref.file, asset, opts, runDir)
        item.glb = { taskId: glb.taskId, rawBytes: glb.rawBytes, bytes: glb.bytes, optimized: glb.optimized, remoteUrl: glb.remoteUrl }
        Object.assign(asset, {
          status: 'done',
          updatedAt: new Date().toISOString(),
          referencePath: path.relative(__dirname, ref.file),
          referenceTaskId: ref.taskId ?? null,
          glbPath: path.relative(path.resolve(__dirname, '../../'), glb.outFile),
          glbTaskId: glb.taskId,
          glbBytes: glb.bytes,
          glbRawBytes: glb.rawBytes,
          glbOptimized: glb.optimized,
        })
        console.log(`[${asset.objectId}] 完成 → ${asset.glbPath}`)
      } catch (error) {
        asset.status = 'error'
        asset.updatedAt = new Date().toISOString()
        asset.error = String(error?.message ?? error)
        item.error = asset.error
        report.failures.push({ objectId: asset.objectId, error: asset.error })
        console.error(`[${asset.objectId}] 失败: ${asset.error}`)
      }
      item.finishedAt = new Date().toISOString()
      report.items.push(item)
      await saveJson(MANIFEST_PATH, manifest)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))

  report.finishedAt = new Date().toISOString()
  await saveJson(path.join(runDir, 'report.json'), report)
  await saveJson(MANIFEST_PATH, manifest)
  if (writeRegistryEnabled) await writeRegistry(manifest, opts)

  const done = manifest.assets.filter((a) => a.status === 'done').length
  console.log(`\n[done] 成功 ${done}/${manifest.assets.length}，本次失败 ${report.failures.length}，报告: ${path.relative(process.cwd(), path.join(runDir, 'report.json'))}`)
  if (report.failures.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error('[fatal]', error?.stack ?? error)
  process.exit(1)
})
