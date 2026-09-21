/**
 * 截图实验台：起一个与主 home 完全隔离的 dsh 实例，用 headless Edge 驱动。
 *
 * 隔离点：DSH_HOME 指向 `.shot-lab/home`。凭据不拷真的——余额走仓库自带的
 * `tests/balance-mock.mjs`，所以截图里的数字固定是 42.50 CNY，既不暴露真实账户，
 * 也和第二张旧截图（`assets/03` 里就是 42.50）保持同一套数字。
 *
 * 为什么要有这个东西：`conversation.composer.dock` 这个槽位只在真正的会话页里渲染，
 * 空会话的 hero 页没有它，所以余额条在 hero 页根本不挂载——截图必须落在一个会话里。
 */
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

export const ROOT = 'D:\\deepseek-harness\\dsh-nord'
export const LAB = join(ROOT, '.shot-lab')
export const HOME = join(LAB, 'home')
export const OUT = join(LAB, 'out')

/** mock 余额接口的端口与 key（与 tests/balance-mock.mjs 一致）。 */
export const MOCK_PORT = 3099
export const MOCK_KEY = 'test-key'

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/**
 * 起一个余额 mock。
 *
 * 为什么不用 `tests/balance-mock.mjs`：那个固定只认 `Bearer test-key`，而隔离 home
 * 里拷的是真实凭据文件——凭据是加密的引用式存储，自编一份格式不对（路由直接 401），
 * 拷真的又拿不到明文 key 去喂给 mock。所以这里只在「有没有带 Bearer」这一层校验，
 * 和仓库自带 mock 的宽松程度一致；真 key 既不进代码也不进日志。
 *
 * 返回的数值与 `tests/balance-mock.mjs` 完全一致（42.50 / 2.50 / 40.00），
 * 所以截图里的数字和旧图是同一套。
 */
export function createBalanceMock({ port = MOCK_PORT } = {}) {
  const hits = []
  const server = createServer((req, res) => {
    hits.push({ url: req.url, authorized: /^Bearer \S+$/.test(req.headers.authorization ?? '') })
    res.setHeader('content-type', 'application/json')
    if (req.url !== '/user/balance') { res.writeHead(404).end(); return }
    if (!/^Bearer \S+$/.test(req.headers.authorization ?? '')) {
      res.writeHead(401).end(JSON.stringify({ error: { message: 'unauthorized' } }))
      return
    }
    res.end(JSON.stringify({
      is_available: true,
      balance_infos: [
        { currency: 'CNY', total_balance: '42.50', granted_balance: '2.50', topped_up_balance: '40.00' },
      ],
    }))
  })
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => done({ server, hits }))
  })
}

/** 会话存储目录名：把绝对路径里的每个非字母数字字符折成 `-`。 */
export function workspaceSlug(path) {
  return `--${path.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}--`
}

/**
 * 铺隔离 home：暗色偏好、凭据、可选的会话载体与工作区清单。
 *
 * 凭据是引用式存储（`refs` 指向 `records`），所以这里整份拷真实 `.credentials.yaml`，
 * 而不是自己编一个——编的格式不对，余额路由会直接回 401。真实 key 因此在进程里，
 * 但余额请求被 profile 的 patch 指到本地 mock（见 {@link writeBalancePatch}），
 * 截图里的数字是 mock 的 42.50，不会暴露真实账户。
 * @param options.workspace - 要打开的 workspace 绝对路径
 * @param options.session - 要铺进去的会话 `{ id, source, title, projection }`
 */
export function prepareHome(options = {}) {
  rmSync(LAB, { recursive: true, force: true })
  mkdirSync(HOME, { recursive: true })
  mkdirSync(OUT, { recursive: true })

  writeFileSync(join(HOME, 'settings.yaml'), [
    'ui-theme:',
    '  preference: dark',
    'locale:',
    '  preference: zh',
    'ui-onboarding:',
    '  welcomeNoticeVersion: 2026-08-13.1',
    '',
  ].join('\n'))

  const realCredentials = join(homedir(), '.dsh', '.credentials.yaml')
  if (!existsSync(realCredentials)) throw new Error(`找不到真实凭据 ${realCredentials}`)
  copyFileSync(realCredentials, join(HOME, '.credentials.yaml'))

  if (options.workspace === undefined || options.session === undefined) return {}
  const slug = workspaceSlug(options.workspace)
  const sessionDir = join(HOME, 'sessions', slug, options.session.id)
  mkdirSync(sessionDir, { recursive: true })
  copyFileSync(options.session.source, join(sessionDir, 'session.v3.jsonl.zstd'))

  // 侧栏的摘要来自投影缓存，缺了它工作区会列不出这个会话
  if (options.session.projection !== undefined && existsSync(options.session.projection)) {
    const cacheDir = join(HOME, 'storages', 'session_projcache', 'sessions')
    mkdirSync(cacheDir, { recursive: true })
    copyFileSync(options.session.projection, join(cacheDir, `${options.session.id}.json`))
  }

  mkdirSync(join(HOME, 'storages'), { recursive: true })
  writeFileSync(join(HOME, 'storages', 'workspace.json'), JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, workspaceIds: ['w-shots'], archivedSessionIds: [] },
    tables: {
      workspaces: {
        'w-shots': {
          path: options.workspace,
          title: options.session.title ?? 'dsh-nord',
          sessionIds: [options.session.id],
          createdAt: '2026-09-21T07:19:26.676Z',
          updatedAt: '2026-09-21T07:19:26.676Z',
        },
      },
    },
  }, null, 2))
  return { slug, sessionDir }
}

/**
 * 给隔离 profile 写一层 patch：把余额查询指向本地 mock。
 * patch 是整段替换目标行的 config，所以五个键要写全。
 */
export function writeBalancePatch(profile = 'shots') {
  const file = join(HOME, 'profiles', profile, 'cordis.patch.yml')
  writeFileSync(file, [
    '# 截图用：把余额查询指到 tests/balance-mock.mjs，截图里的数字固定为 42.50 CNY',
    '- id: dsh-nord',
    '  config:',
    '    themeEnabled: true',
    '    fontEnabled: true',
    '    balanceEnabled: true',
    '    refreshSeconds: 15',
    `    baseURL: http://127.0.0.1:${String(MOCK_PORT)}`,
    '',
  ].join('\n'))
  return file
}

/** 在隔离 home 里备好 profile 并装上本插件（link，指回工作树）。 */
export async function ensureProfile(profile = 'shots') {
  const runDsh = (args) => new Promise((settle) => {
    const child = spawn('dsh', args, {
      cwd: ROOT, env: { ...process.env, DSH_HOME: HOME }, shell: true, windowsHide: true, stdio: 'pipe',
    })
    let out = ''
    child.stdout.on('data', (c) => { out += c })
    child.stderr.on('data', (c) => { out += c })
    child.on('close', (code) => settle({ code, out }))
  })
  const init = await runDsh(['--profile', profile, '--from-default-profile', 'web', '--dump-config'])
  if (init.code !== 0) throw new Error(`初始化 profile 失败:\n${init.out}`)
  const add = await runDsh(['plugin', '--profile', profile, 'add', `link:${ROOT}`])
  if (add.code !== 0) throw new Error(`安装插件失败:\n${add.out}`)
  return profile
}

/** 起隔离实例并等它打印 URL。 */
export async function startServer({ profile = 'shots', workspace = ROOT } = {}) {
  const child = spawn('dsh', ['--profile', profile, '--no-open', '--port', '0'], {
    cwd: workspace, env: { ...process.env, DSH_HOME: HOME }, shell: true, windowsHide: true,
  })
  let output = ''
  child.stdout.on('data', (c) => { output += c })
  child.stderr.on('data', (c) => { output += c })
  let url
  for (let i = 0; i < 80 && !url; i++) {
    await sleep(500)
    url = /dsh web: (?<u>http:\/\/\S+)/.exec(output)?.groups?.u
  }
  if (!url) throw new Error(`实例没起来:\n${output}`)
  return { child, url, pid: child.pid, output: () => output }
}

/** 杀掉实例（Windows 上连进程树一起杀）。 */
export async function stopServer(server) {
  if (server === undefined) return
  const closed = new Promise((done) => server.child.once('close', done))
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' })
  } else {
    server.child.kill('SIGTERM')
  }
  await Promise.race([closed, sleep(5000)])
}

/** 用 Edge 打开页面。 */
export async function openPage(url, { width = 1440, height = 900, scale = 1.5 } = {}) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${String(error).slice(0, 200)}`))
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 200)}`) })
  await page.goto(url, { waitUntil: 'load' })
  return { browser, context, page, problems }
}

/** 关掉「内测声明」弹窗（新 profile 首次启动会现，settings 里预置版本号可免）。 */
export async function dismissWelcome(page) {
  const dismiss = page.getByRole('button', { name: '继续' })
  if (await dismiss.count()) {
    await dismiss.first().click()
    await sleep(1200)
    return true
  }
  return false
}

/** 元素的视口矩形（不依赖任何 CSS 类名）。 */
export async function rectOf(locator) {
  return locator.first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
}

/** 页面可见文本，按行拆好，方便探针打印。 */
export async function visibleLines(page, limit = 30) {
  return (await page.evaluate(() => document.body.innerText))
    .split('\n').map((line) => line.trim()).filter(Boolean).slice(0, limit)
}
