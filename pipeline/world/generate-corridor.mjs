/**
 * SpatialGen「记忆回廊」生成脚本（T-009）：编程式调用 Aholo MCP 包的 generateWorld（wait 模式），
 * 完成后提取 splats URL 并下载到 demo/public/splats/。
 *
 * 用法（仓库根）：
 *   node --experimental-strip-types pipeline/world/generate-corridor.mjs
 *
 * 前置：pipeline/mcp/.env.aholo（AHOLO_API_KEY / AHOLO_REGION，gitignored）。
 * 生成消耗 Aholo 额度且耗时数分钟到十几分钟；断点：同一 prompt 重复生成会重复计费，慎用 --force 思路。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const envFile = join(repoRoot, 'pipeline', 'mcp', '.env.aholo')
if (!existsSync(envFile)) {
  console.error('[world] 缺少 pipeline/mcp/.env.aholo（AHOLO_API_KEY）')
  process.exit(2)
}
const env = { AHOLO_REGION: 'cn' }
for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match) env[match[1]] = match[2]
}

process.env.AHOLO_API_KEY = env.AHOLO_API_KEY
process.env.AHOLO_REGION = env.AHOLO_REGION

const { generateWorld } = await import(pathToFileURL(join(repoRoot, 'pipeline', 'mcp', 'node_modules', '@manycore', 'aholo-sdk-mcp', 'dist', 'world-generate.js')).href)

const PROMPT =
  'A candlelit stone chamber beneath an old study, carved walls, a stone pedestal with a manuscript, cold blue light from above, cinematic'

console.log('[world] 提交生成（wait 模式，可能 5-20 分钟）…')
const result = await generateWorld({
  prompt: PROMPT,
  name: 'memory-corridor',
  wait: true,
  timeoutMs: 25 * 60 * 1000,
  region: env.AHOLO_REGION,
})

const textBlock = (result.content ?? []).find((block) => block.type === 'text')
const raw = textBlock ? textBlock.text : JSON.stringify(result)
writeFileSync(join(repoRoot, 'pipeline', 'world', 'last-result.json'), raw)
console.log('[world] 原始结果已存 pipeline/world/last-result.json')

let world = null
try {
  world = JSON.parse(raw)
} catch {
  console.log('[world] 返回不是 JSON，前 400 字：', raw.slice(0, 400))
}

const urls = []
const collect = (node, seen = new Set()) => {
  if (!node || typeof node !== 'object' || seen.has(node)) return
  seen.add(node)
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) urls.push({ key, url: value })
    else collect(value, seen)
  }
}
collect(world ?? result)

const spz = urls.filter((item) => /\.spz(\?|$)/i.test(item.url))
const ply = urls.filter((item) => /\.(ply|splat)(\?|$)/i.test(item.url))
console.log(`[world] URL 清单：${urls.length} 条；SPZ=${spz.length} PLY/SPLAT=${ply.length}`)
for (const item of urls.slice(0, 12)) console.log(`  ${item.key}: ${item.url.slice(0, 110)}`)

const outDir = join(repoRoot, 'demo', 'public', 'splats')
mkdirSync(outDir, { recursive: true })

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 80)}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
  console.log(`[world] 下载 ${dest.split(/[\\/]/).pop()}  ${(buf.length / 1024 / 1024).toFixed(2)}MB`)
}

const candidates = [...spz, ...ply]
if (candidates.length === 0) {
  console.log('[world] 未找到 splats 产物 URL——查看 last-result.json 判断（可能生成失败或字段名不同）')
  process.exit(1)
}
for (const item of candidates.slice(0, 3)) {
  const filename = item.url.split('?')[0].split('/').pop() || `corridor.${item.url.includes('.spz') ? 'spz' : 'ply'}`
  await download(item.url, join(outDir, filename))
}
console.log('[world] DONE')
