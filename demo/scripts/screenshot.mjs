#!/usr/bin/env node
/**
 * Demo UI 截图脚本（T-017 固化）：Edge headless + Chrome DevTools Protocol。
 *
 * 生成 4 张 1600×900 的 UI 截图到 `assets/screenshots/`：
 *   ui-01-title.png       标题页（全新存档）
 *   ui-02-hud-study.png   书房 HUD（开始新游戏后的第一屏，含叙事日志逐行 reveal）
 *   ui-03-journal.png     日记面板（手稿纸质感 + 已收集条目）
 *   ui-04-ending.png      结局面板（密室石台 → 结局长文 + 统计）
 *
 * 用法（在 demo/ 下，先启动 dev server）：
 *   node "C:\...\pnpm.mjs" dev --port 5180
 *   node --experimental-strip-types scripts/screenshot.mjs
 *
 * 可选参数：
 *   --base-url <url>   页面地址，默认 http://127.0.0.1:5180/
 *   --out <dir>        截图输出目录，默认 <repo>/assets/screenshots
 *   --edge <path>      浏览器可执行文件；默认 EDGE_PATH 或常见 Edge/Chrome 路径
 *   --keep-profile     保留临时浏览器 profile（排障用，默认删除）
 *
 * 说明：
 * - 不访问外网，只连接本机 dev server 与 CDP；
 * - 临时 profile 写在 os.tmpdir()，脚本结束删除；不写任何密钥/敏感数据；
 * - headless 环境不允许 Pointer Lock，结局面板通过 dev server 暴露的 store 模块派发一次
 *   “调查石台”交互来打开真实 EndingPanel（仅截图驱动，不修改任何源码与游戏状态文件）。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const demoDir = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(demoDir, '..')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function parseArgs(argv) {
  const options = {
    baseUrl: 'http://127.0.0.1:5180/',
    outDir: path.join(repoRoot, 'assets', 'screenshots'),
    edgePath: process.env.EDGE_PATH || '',
    keepProfile: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      console.log('用法: node --experimental-strip-types scripts/screenshot.mjs [--base-url URL] [--out DIR] [--edge PATH] [--keep-profile]')
      process.exit(0)
    }
    if (arg === '--base-url') options.baseUrl = argv[++index]
    else if (arg === '--out') options.outDir = path.resolve(argv[++index])
    else if (arg === '--edge') options.edgePath = argv[++index]
    else if (arg === '--keep-profile') options.keepProfile = true
    else throw new Error(`未知参数: ${arg}`)
  }
  if (!options.baseUrl.endsWith('/')) options.baseUrl += '/'
  return options
}

function findBrowser(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error('未找到 Edge/Chrome 可执行文件，请用 --edge 指定路径或设置 EDGE_PATH')
}

async function waitForDevTools(profileDir, child) {
  const portFile = path.join(profileDir, 'DevToolsActivePort')
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`浏览器提前退出（code=${child.exitCode}）`)
    if (existsSync(portFile)) {
      const content = readFileSync(portFile, 'utf8').trim().split(/\r?\n/)
      const port = Number(content[0])
      if (Number.isFinite(port) && port > 0) {
        const base = `http://127.0.0.1:${port}`
        try {
          const version = await fetch(`${base}/json/version`)
          if (version.ok) return base
        } catch {
          // 端口已写但 HTTP 尚未就绪
        }
      }
    }
    await sleep(250)
  }
  throw new Error('等待 Edge DevTools endpoint 超时')
}

async function ensureDevServer(baseUrl) {
  try {
    const response = await fetch(baseUrl, { method: 'GET' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    throw new Error(`dev server 不可用（${baseUrl}）：${error.message}\n请先在 demo/ 下运行 pnpm dev --port 5180`)
  }
}

function createCdpClient(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl)
  const pending = new Map()
  let seq = 0
  const ready = new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = () => reject(new Error('CDP WebSocket 连接失败'))
  })
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  return { ready, send, close: () => socket.close() }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  await ensureDevServer(options.baseUrl)
  mkdirSync(options.outDir, { recursive: true })

  const edgePath = findBrowser(options.edgePath)
  const profileDir = mkdtempSync(path.join(tmpdir(), 'lux3d-screenshot-'))
  const browser = spawn(
    edgePath,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--window-size=1600,900',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-first-run',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true, detached: false },
  )

  let client = null
  let debugBase = ''
  try {
    debugBase = await waitForDevTools(profileDir, browser)
    const targets = await (await fetch(`${debugBase}/json/list`)).json()
    const page = targets.find((target) => target.type === 'page')
    if (!page) throw new Error('没有可用的页面 target')
    client = createCdpClient(page.webSocketDebuggerUrl)
    await client.ready
    const { send } = client

    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error(`页面脚本失败: ${JSON.stringify(result.exceptionDetails)}`)
      return result.result?.value
    }
    const waitReady = async () => {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        try {
          if ((await evaluate('document.readyState')) === 'complete') return
        } catch {
          // 页面切换中
        }
        await sleep(150)
      }
    }
    const reloadWithInjectedStorage = async (script, settleMs) => {
      const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', { source: script })
      await send('Page.reload', { ignoreCache: true })
      await sleep(1200)
      await waitReady()
      await sleep(settleMs)
      await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
    }
    const screenshot = async (name) => {
      const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
      const file = path.join(options.outDir, name)
      writeFileSync(file, Buffer.from(result.data, 'base64'))
      console.log(`[shot] ${path.relative(repoRoot, file)}`)
      return file
    }
    const clickButton = (selector, index) =>
      evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}]?.click()`)
    const pressKey = async (code, key, keyCode) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: keyCode })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: keyCode })
    }

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })

    const load = (relative) => import(pathToFileURL(path.join(demoDir, 'src', relative)).href)
    const { createInitialState } = await load('game/save.ts')
    const { JOURNAL_ENTRIES } = await load('data/narrative.ts')
    const baseState = createInitialState()
    const seedSave = (mutate) => {
      const state = structuredClone(baseState)
      mutate(state)
      return JSON.stringify(state)
    }

    const journalEntries = [
      'diary_half',
      'lantern_found',
      'outline_seen',
      'mural_symbols',
      'basin_inscription',
      'previous_owner',
      'eco_three_symbols',
      'secret_door_origin',
    ].map((id) => JOURNAL_ENTRIES[id])
    const studyFlags = {
      clue_diary: true,
      has_lantern: true,
      cellar_open: true,
      saw_secret_outline: true,
      clue_symbols: true,
      clue_basin: true,
    }
    const chamberFlags = { ...studyFlags, dials_solved: true, secret_open: true }

    const journalSave = seedSave((state) => {
      state.stage = 'illuminate'
      state.zone = 'zone_basement'
      state.lanternLit = true
      state.flags = { ...state.flags, ...studyFlags }
      state.inventory = ['lantern']
      state.position = [3.4, 1.65, 3.0]
      state.yaw = 0.85
      state.visited = ['zone_study', 'zone_basement']
      state.playTime = 754
      state.hintsUsed = 2
      state.journal = journalEntries
    })

    const endingSave = seedSave((state) => {
      state.stage = 'chamber'
      state.zone = 'zone_chamber'
      state.lanternLit = true
      state.flags = { ...state.flags, ...chamberFlags }
      state.inventory = ['lantern']
      state.position = [0, 1.65, 0.4]
      state.yaw = 0
      state.visited = ['zone_study', 'zone_basement', 'zone_chamber']
      state.playTime = 1123
      state.hintsUsed = 1
      state.journal = journalEntries
    })

    // 1) 标题页
    await send('Page.navigate', { url: options.baseUrl })
    await sleep(1500)
    await waitReady()
    await reloadWithInjectedStorage("localStorage.removeItem('lux3d.save.v1')", 3400)
    await screenshot('ui-01-title.png')

    // 2) 书房 HUD
    await reloadWithInjectedStorage("localStorage.removeItem('lux3d.save.v1')", 3000)
    await clickButton('.title-actions button', 0)
    await sleep(3200)
    await screenshot('ui-02-hud-study.png')

    // 3) 日记面板
    await reloadWithInjectedStorage(`localStorage.setItem('lux3d.save.v1', ${JSON.stringify(journalSave)})`, 3000)
    await clickButton('.title-actions button', 1)
    await sleep(2600)
    await pressKey('KeyJ', 'j', 74)
    await sleep(900)
    await screenshot('ui-03-journal.png')

    // 4) 结局面板：headless 不支持 Pointer Lock，通过 store 派发真实交互（不改源码）
    await reloadWithInjectedStorage(`localStorage.setItem('lux3d.save.v1', ${JSON.stringify(endingSave)})`, 3000)
    await clickButton('.title-actions button', 1)
    await sleep(2800)
    const endingResult = await evaluate(`(async () => {
      const { useGameStore } = await import('/src/game/store.ts')
      const store = useGameStore.getState()
      store.dispatch({ type: 'inspect', objectId: 'obj_chamber_pedestal' })
      return { panel: useGameStore.getState().panel, stage: useGameStore.getState().game.stage }
    })()`)
    if (endingResult?.panel !== 'ending') throw new Error(`结局面板未打开：${JSON.stringify(endingResult)}`)
    await sleep(1600)
    await screenshot('ui-04-ending.png')

    console.log(`[done] 4 张截图已生成到 ${path.relative(repoRoot, options.outDir) || options.outDir}`)
  } finally {
    if (client) client.close()
    // 优先通过 CDP Browser.close 优雅关闭浏览器，失败再 taskkill 处理进程树
    try {
      if (debugBase) {
        const version = await (await fetch(`${debugBase}/json/version`)).json()
        const browserClient = createCdpClient(version.webSocketDebuggerUrl)
        await browserClient.ready
        await browserClient.send('Browser.close').catch(() => {})
        browserClient.close()
        await sleep(600)
      }
    } catch {
      // 忽略优雅关闭失败
    }
    try {
      if (browser.pid && browser.exitCode === null) {
        spawn('taskkill', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      }
    } catch {
      // 忽略强杀失败
    }
    await sleep(500)
    if (!options.keepProfile) {
      try {
        rmSync(profileDir, { recursive: true, force: true })
      } catch {
        // profile 可能仍被占用，忽略
      }
    }
  }
}

main().catch((error) => {
  console.error(`[error] ${error.message}`)
  process.exit(1)
})
