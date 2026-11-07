/**
 * Aholo MCP 启动器（T-012）：读本机 gitignored 凭据文件 → 注入环境变量 → 启动官方 MCP server（stdio 透传）。
 *
 * 凭据文件：本目录 .env.aholo（已被 .gitignore 忽略，不进仓库），内容两行：
 *   AHOLO_API_KEY=...
 *   AHOLO_REGION=cn
 *
 * 密钥红线：Key 只存在于 (1) 本机 gitignored 文件 (2) 进程环境变量；不进代码/文档/日志。
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const envFile = join(here, '.env.aholo')

if (!existsSync(envFile)) {
  console.error(`[aholo-mcp] 缺少凭据文件 ${envFile}（gitignored）。请创建并写入 AHOLO_API_KEY=... 与 AHOLO_REGION=cn`)
  process.exit(2)
}

const env = { ...process.env, AHOLO_REGION: 'cn' }
for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (match) env[match[1]] = match[2]
}
if (!env.AHOLO_API_KEY) {
  console.error('[aholo-mcp] 凭据文件里没有 AHOLO_API_KEY')
  process.exit(2)
}

const serverEntry = join(here, 'node_modules', '@manycore', 'aholo-sdk-mcp', 'dist', 'index.js')
const child = spawn(process.execPath, [serverEntry], { env, stdio: ['inherit', 'inherit', 'inherit'] })
child.on('exit', (code) => process.exit(code ?? 0))
