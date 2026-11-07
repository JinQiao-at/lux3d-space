#!/usr/bin/env node
/**
 * collab/cli.mjs — DSH × ZCode 共用的文件任务板。
 * 零依赖，Node ≥18。并发安全：.board.lock（10s 过期）+ 原子写入。
 * 用法见 collab/README.md。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOARD = path.join(__dirname, 'board.json')
const HANDOFFS = path.join(__dirname, 'handoffs')
const LOCK = path.join(__dirname, '.board.lock')

const args = process.argv.slice(2)
const cmd = args[0]
const positional = args.slice(1).filter((a) => !a.startsWith('--'))
const opt = (name, fallback = undefined) => {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return fallback
  const v = args[i + 1]
  return v !== undefined && !v.startsWith('--') ? v : true
}
const has = (name) => args.includes(`--${name}`)
const now = () => new Date().toISOString()
const ARROW = '  '

async function readBoard() {
  return JSON.parse(await fs.readFile(BOARD, 'utf8'))
}

async function writeBoard(board) {
  board.updatedAt = now()
  const tmp = `${BOARD}.${process.pid}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(board, null, 2)}\n`, 'utf8')
  await fs.rename(tmp, BOARD)
}

async function withLock(fn) {
  const started = Date.now()
  for (;;) {
    try {
      await fs.writeFile(LOCK, String(process.pid), { flag: 'wx' })
      break
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      try {
        const stat = await fs.stat(LOCK)
        if (Date.now() - stat.mtimeMs > 10_000) {
          await fs.unlink(LOCK).catch(() => {})
          continue
        }
      } catch {
        continue
      }
      if (Date.now() - started > 8_000) throw new Error('任务板被锁定超过 8 秒，请重试')
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
  try {
    return await fn()
  } finally {
    await fs.unlink(LOCK).catch(() => {})
  }
}

function findTask(board, id) {
  const task = board.tasks.find((t) => t.id === id)
  if (!task) {
    console.error(`[error] 找不到任务 ${id}`)
    process.exit(1)
  }
  return task
}

function addNote(task, text) {
  task.notes.push({ at: now(), text })
  task.updatedAt = now()
}

function printTable(tasks) {
  if (tasks.length === 0) {
    console.log('（没有匹配任务）')
    return
  }
  const order = { pending: 0, in_progress: 1, blocked: 2, done: 3, verified: 4 }
  const rows = [...tasks].sort((a, b) => (order[a.status] - order[b.status]) || (a.priority - b.priority) || a.id.localeCompare(b.id))
  console.log('ID'.padEnd(7) + '状态'.padEnd(13) + '负责人'.padEnd(8) + 'P'.padEnd(3) + '标题')
  for (const t of rows) {
    console.log(
      String(t.id).padEnd(7) +
        String(t.status).padEnd(13) +
        String(t.owner ?? '-').padEnd(8) +
        String(t.priority).padEnd(3) +
        t.title +
        (t.scope?.length ? `  [${t.scope.join(', ')}]` : ''),
    )
  }
  const counts = rows.reduce((acc, t) => ((acc[t.status] = (acc[t.status] ?? 0) + 1), acc), {})
  console.log(`\n共 ${rows.length} 个：` + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join('  '))
}

async function cmdList() {
  const board = await readBoard()
  let tasks = board.tasks
  if (!has('all')) tasks = tasks.filter((t) => t.status !== 'verified' || has('verified'))
  if (opt('status')) tasks = tasks.filter((t) => t.status === opt('status'))
  if (opt('owner')) tasks = tasks.filter((t) => t.owner === opt('owner'))
  printTable(tasks)
}

async function cmdNext() {
  const board = await readBoard()
  const owner = opt('owner')
  const candidates = board.tasks
    .filter((t) => t.status === 'pending' && (t.blockedBy ?? []).length === 0)
    .sort((a, b) => (a.priority - b.priority) || a.id.localeCompare(b.id))
  const task = candidates[0]
  if (!task) {
    console.log('没有可领取的 pending 任务。')
    return
  }
  console.log(`推荐任务: ${task.id}  ${task.title}`)
  console.log(`  优先级=${task.priority} scope=${(task.scope ?? []).join(', ') || '-'}`)
  console.log(`  验收: ${task.acceptance ?? '-'}`)
  console.log(`\n领取: node collab/cli.mjs claim ${task.id} --owner ${owner ?? 'zcode'}`)
}

async function cmdShow() {
  const board = await readBoard()
  const task = findTask(board, positional[0])
  console.log(JSON.stringify(task, null, 2))
}

async function cmdClaim() {
  const owner = String(opt('owner', 'zcode'))
  const id = positional[0]
  await withLock(async () => {
    const board = await readBoard()
    const task = findTask(board, id)
    if (task.status === 'in_progress' && task.owner && task.owner !== owner) {
      console.error(`[error] ${id} 已被 ${task.owner} 领取；请先 release 或换任务`)
      process.exit(1)
    }
    if (['done', 'verified'].includes(task.status) && !has('force')) {
      console.error(`[error] ${id} 状态为 ${task.status}；如需重做请先 reopen`)
      process.exit(1)
    }
    task.status = 'in_progress'
    task.owner = owner
    task.claimedAt = now()
    task.updatedAt = now()
    addNote(task, `claim by ${owner}`)
    await writeBoard(board)
    console.log(`[ok] ${id} 已由 ${owner} 领取。只修改 scope: ${(task.scope ?? []).join(', ') || '-'}`)
  })
}

async function cmdRelease() {
  const id = positional[0]
  const force = has('force')
  await withLock(async () => {
    const board = await readBoard()
    const task = findTask(board, id)
    if (task.status !== 'in_progress') {
      console.error(`[error] ${id} 不是 in_progress`)
      process.exit(1)
    }
    task.status = 'pending'
    addNote(task, `release${force ? ' --force' : ''} (was ${task.owner})`)
    task.owner = null
    task.claimedAt = null
    task.updatedAt = now()
    await writeBoard(board)
    console.log(`[ok] ${id} 已释放回 pending`)
  })
}

async function cmdNote() {
  const id = positional[0]
  const text = args.slice(args.indexOf(id) + 1).filter((a) => !a.startsWith('--')).join(' ') || String(opt('text', ''))
  if (!text) {
    console.error('[error] 用法: note <id> "内容"')
    process.exit(1)
  }
  await withLock(async () => {
    const board = await readBoard()
    const task = findTask(board, id)
    addNote(task, text)
    await writeBoard(board)
    console.log(`[ok] ${id} 已记录`)
  })
}

async function cmdDone() {
  const id = positional[0]
  const summary = String(opt('summary', '') || '')
  const files = String(opt('files', '') || '')
  await withLock(async () => {
    const board = await readBoard()
    const task = findTask(board, id)
    task.status = 'done'
    task.doneAt = now()
    task.updatedAt = now()
    addNote(task, `done${summary ? `: ${summary}` : ''}`)
    await writeBoard(board)

    await fs.mkdir(HANDOFFS, { recursive: true })
    const fileList = files
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
    const handoff = `# ${id} ${task.title}

- owner: ${task.owner ?? '-'}
- 开始: ${task.claimedAt ?? '-'}
- 完成: ${task.doneAt}
- 摘要: ${summary || '(待补)'}
- 改动文件:
${fileList.length ? fileList.map((f) => `  - ${f}`).join('\n') : '  - (待补)'}
- 验收命令与结果:
  - (待补：请填写实际命令与输出摘要)
- 风险/未完成:
  - (待补)
- 给 Lead 的注意点:
  - (待补)
`
    const handoffPath = path.join(HANDOFFS, `${id}.md`)
    await fs.writeFile(handoffPath, handoff, 'utf8')
    console.log(`[ok] ${id} → done。交接单: collab/handoffs/${id}.md（请补全验收结果）`)
  })
}

async function cmdVerify() {
  const id = positional[0]
  await withLock(async () => {
    const board = await readBoard()
    const task = findTask(board, id)
    if (task.status !== 'done') {
      console.error(`[error] ${id} 状态为 ${task.status}，只能 verify done 状态的任务`)
      process.exit(1)
    }
    task.status = 'verified'
    task.verifiedAt = now()
    task.updatedAt = now()
    addNote(task, `verified by ${opt('owner', 'dsh')}`)
    await writeBoard(board)
    console.log(`[ok] ${id} → verified`)
  })
}

async function cmdBlock() {
  const id = positional[0]
  const reason = String(opt('reason', '') || '未提供原因')
  await withLock(async () => {
    const board = await readBoard()
    const task = findTask(board, id)
    task.status = 'blocked'
    task.blockedReason = reason
    task.updatedAt = now()
    addNote(task, `blocked: ${reason}`)
    await writeBoard(board)
    console.log(`[ok] ${id} → blocked（${reason}）`)
  })
}

async function cmdReopen() {
  const id = positional[0]
  const reason = String(opt('reason', '') || '验收未通过')
  await withLock(async () => {
    const board = await readBoard()
    const task = findTask(board, id)
    task.status = 'pending'
    task.owner = null
    task.claimedAt = null
    task.updatedAt = now()
    addNote(task, `reopen: ${reason}`)
    await writeBoard(board)
    console.log(`[ok] ${id} → pending（${reason}）`)
  })
}

async function cmdAdd() {
  const title = String(opt('title', '') || '')
  if (!title) {
    console.error('[error] 用法: add --title "..." --scope demo/src --priority 2 --acceptance "..."')
    process.exit(1)
  }
  await withLock(async () => {
    const board = await readBoard()
    const maxId = board.tasks.reduce((max, t) => Math.max(max, Number(String(t.id).replace(/\D/g, '')) || 0), 0)
    const id = `T-${String(maxId + 1).padStart(3, '0')}`
    const scope = String(opt('scope', '') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const task = {
      id,
      title,
      status: 'pending',
      owner: opt('owner', null),
      priority: Number(opt('priority', 3)) || 3,
      scope,
      acceptance: String(opt('acceptance', '') || ''),
      blockedBy: [],
      notes: [],
      createdAt: now(),
      updatedAt: now(),
    }
    board.tasks.push(task)
    await writeBoard(board)
    console.log(`[ok] 已创建 ${id} ${title}`)
  })
}

async function cmdStats() {
  const board = await readBoard()
  const counts = board.tasks.reduce((acc, t) => ((acc[t.status] = (acc[t.status] ?? 0) + 1), acc), {})
  console.log(`任务总数 ${board.tasks.length}：` + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join('  '))
}

async function main() {
  switch (cmd) {
    case 'list':
      return cmdList()
    case 'next':
      return cmdNext()
    case 'show':
      return cmdShow()
    case 'claim':
      return cmdClaim()
    case 'release':
      return cmdRelease()
    case 'note':
      return cmdNote()
    case 'done':
      return cmdDone()
    case 'verify':
      return cmdVerify()
    case 'block':
      return cmdBlock()
    case 'reopen':
      return cmdReopen()
    case 'add':
      return cmdAdd()
    case 'stats':
      return cmdStats()
    default:
      console.log(`用法:
  node collab/cli.mjs list [--all] [--status <s>] [--owner <o>]
  node collab/cli.mjs next [--owner <o>]
  node collab/cli.mjs show <id>
  node collab/cli.mjs claim <id> --owner <name>
  node collab/cli.mjs release <id> [--force]
  node collab/cli.mjs note <id> "内容"
  node collab/cli.mjs done <id> --summary "..." --files "a.ts,b.ts"
  node collab/cli.mjs verify <id>
  node collab/cli.mjs block <id> --reason "..."
  node collab/cli.mjs reopen <id> --reason "..."
  node collab/cli.mjs add --title "..." --scope a,b --priority 2 --acceptance "..."
  node collab/cli.mjs stats`)
  }
}

main().catch((error) => {
  console.error('[fatal]', error?.message ?? error)
  process.exit(1)
})
