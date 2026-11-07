#!/usr/bin/env node
/**
 * ZCode PreToolUse Hook：隐形约束守卫（本地执行，无网络）。
 *
 * 作用：
 * 1) 拒绝 Write/Edit 触碰受保护路径（生成物/密钥/契约文件）；
 * 2) 拒绝 Bash 执行高风险命令（rm -rf、git reset --hard、force push 等）。
 *
 * 配置：见 zcode/hooks.example.json；项目 Hook 需先 `zcode hooks trust review/grant`。
 * 协议：读取 stdin JSON 事件；输出 deny JSON 或静默退出 0。
 */
let input = ''
for await (const chunk of process.stdin) input += chunk

let event = {}
try {
  event = JSON.parse(input || '{}')
} catch {
  process.exit(0) // 解析失败不阻断，交给 ZCode 常规诊断
}

const hookEvent = event.hook_event_name ?? event.hookEventName ?? ''
if (hookEvent !== 'PreToolUse') process.exit(0)

const toolName = String(event.tool_name ?? event.toolName ?? '')
const toolInput = event.tool_input ?? event.toolInput ?? {}
const cwd = String(event.cwd ?? event.workspace ?? process.cwd())

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
  process.exit(0) // 协议要求：拒绝通过 JSON 表达，进程正常退出
}

function normalize(p) {
  return String(p ?? '').replace(/\\/g, '/')
}

const filePath = normalize(toolInput.file_path ?? toolInput.path ?? toolInput.abs_path ?? '')

const PROTECTED = [
  { pattern: /demo\/src\/scene\/assetRegistry\.ts$/, reason: 'assetRegistry.ts 由 pipeline/lux3d/generate-assets.mjs 生成，禁止手改；请改管线或让 DSH 处理。' },
  { pattern: /pipeline\/lux3d\/assets-manifest\.json$/, reason: '资产清单由管线维护（断点续跑/证据链）；修改需 DSH 批准并在任务板 block。' },
  { pattern: /(^|\/)\.env(\.|$)/, reason: '禁止由 Agent 写入 .env 类文件（密钥零落盘约束）。' },
  { pattern: /server\/app\/(agent|main|models)\.py$/, reason: '后端 API/工具契约变更需 DSH 批准；先 block 并在任务板说明。' },
  { pattern: /collab\/board\.json$/, reason: '任务板只能通过 collab/cli.mjs 变更（保证并发安全）。' },
]

if (/^(Write|Edit|MultiEdit)$/.test(toolName) && filePath) {
  for (const item of PROTECTED) {
    if (item.pattern.test(filePath)) deny(`${item.reason}（路径：${filePath}）`)
  }
}

if (toolName === 'Bash') {
  const command = String(toolInput.command ?? '')
  const DANGEROUS = [
    { pattern: /(^|\s)rm\s+(-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*)\s+(\/|~|[A-Za-z]:\\)/i, reason: '禁止递归删除根目录/盘符。' },
    { pattern: /git\s+reset\s+--hard/i, reason: '禁止 git reset --hard；用任务拆分或备份回滚。' },
    { pattern: /git\s+clean\s+-[a-z]*f/i, reason: '禁止 git clean -f；可能删除未跟踪交付物。' },
    { pattern: /git\s+push\s+.*(--force|-f)(\s|$)/i, reason: '禁止 force push。' },
    { pattern: /(AHOLO_API_KEY|Authorization)\s*[:=].{0,80}(curl|Invoke-WebRequest|fetch)/i, reason: '疑似密钥外发/写入请求，拒绝。' },
  ]
  for (const item of DANGEROUS) {
    if (item.pattern.test(command)) deny(`${item.reason}（命令：${command.slice(0, 120)}）`)
  }
}

process.exit(0)
