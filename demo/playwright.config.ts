import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 配置（Playtest 工程师体系）。
 * - testDir ./tests/e2e 与 node:test 单测（tests/*.test.ts）隔离；
 * - baseURL 默认本地 dev 6120（Windows TCP 排除段外端口），可用 PLAYWRIGHT_BASE_URL 覆盖到生产/Preview；
 * - WebGL 三参数必配（3D 场景）；本机无 Chrome，用 Edge channel（同为 Chromium，零下载）。
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:6120',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      channel: 'msedge',
      args: [
        '--use-angle=default',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        // DNS 污染期防绕过：禁用浏览器内置异步解析器/Secure DNS（HTTPS RR 劫持源），强制系统解析
        '--disable-async-dns',
        // 污染层可能劫持 UDP/QUIC 到错误节点：禁 HTTP/3，强制 h2 over TCP
        '--disable-quic',
        // DNS 污染期可选映射：PLAYWRIGHT_HOST_MAP="host=ip,host2=ip2"（如 github.io→185.199.109.153）
        ...(process.env.PLAYWRIGHT_HOST_MAP
          ? [`--host-resolver-rules=${process.env.PLAYWRIGHT_HOST_MAP.split(',').map((m) => m.replace('=', ' ')).join(',')}`]
          : []),
      ],
    },
  },
  webServer: {
    command: 'pnpm exec vite --port 6120 --strictPort',
    url: 'http://127.0.0.1:6120',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'msedge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
})
