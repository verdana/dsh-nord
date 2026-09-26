/**
 * 兼容性探针：把这枚插件在**当前这个 dsh 版本**上用到的每一个上游接口实测一遍。
 *
 *   node scripts/shots/verify-compat.mjs
 *
 * 和 `verify-settings.mjs` 的分工：那个走的是「插件自己那一页 + 字体选择器」这条功能
 * 路径，这个走的是「插件站在哪些上游接口上」这条版本路径 —— 主题 token、字体 token、
 * dock 槽位与它那条 `:has()` 规则、余额面板与「用量信息」座位、三枚插件样式表。
 * 升级 dsh 之后先跑这个，能过的接口就是真的还在，而不是「类型上还在」。
 *
 * 隔离 home（`.shot-lab/home`）与本地余额 mock，真实 home 全程不被触碰。配色偏好写成
 * `system`，于是两套调色板可以用 `emulateMedia` 各驱动一次。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  createBalanceMock, dismissWelcome, ensureProfile, HOME, openPage, prepareHome, ROOT, sleep,
  startServer, stopServer, writeBalancePatch,
} from './lab.mjs'

const SESSION_ID = 'session-21e5be96-b57d-4c7d-93bb-a887cbafc64a'
const SESSION_TITLE = 'dsh插件多方式安装测试脚本'
const REAL = join(homedir(), '.dsh')

/** mock 返回的余额，用来确认读数已经到位。 */
const EXPECTED = '42.50'

/**
 * 主题层的抽样：`[token, 亮色, 暗色]`。覆盖三层里的每一层 —— alias（语义面）、
 * static（绕过 alias 的裸色阶）、specific（具名表面），外加那枚超出 Nord 十六色的
 * `faint` 台阶。
 */
const TOKENS = [
  ['--dsw-alias-bg-base', '#ECEFF4', '#2E3440'],
  ['--dsw-alias-label-primary', '#2E3440', '#ECEFF4'],
  ['--dsw-alias-label-tertiary', '#4C566A', '#7B88A1'],
  ['--dsw-alias-brand-primary', '#5E81AC', '#88C0D0'],
  ['--dsw-alias-state-error-primary', '#BF616A', '#BF616A'],
  ['--dsw-static-neutral-00', '#ECEFF4', '#2E3440'],
  ['--dsw-static-deepseek-500', '#5E81AC', '#88C0D0'],
  ['--dsw-specific-sidebar-fill', '#E5E9F0', '#3B4252'],
  ['--dsw-specific-input-major', '#ECEFF4', '#3B4252'],
]

/** 一个颜色字符串的规范形，用于跨 hex / rgb() 比较。 */
const normalize = (value) => {
  const text = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{6})$/.exec(text)
  if (hex === null) return text
  const n = Number.parseInt(hex[1], 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

/** 屏幕上的一行断言。 */
const ok = (label, value) => console.log(`  ✔ ${label}: ${value}`)

/** 等到条件成立，否则报错。 */
async function waitFor(page, label, check, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return
    await sleep(300)
  }
  throw new Error(`等不到「${label}」`)
}

/** 按 `document.body` 上的内联覆盖读取一批 token。 */
const readTokens = (names) => {
  const style = getComputedStyle(document.body)
  return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]))
}

prepareHome({
  workspace: ROOT,
  session: {
    id: SESSION_ID,
    title: 'dsh-nord',
    source: join(REAL, 'sessions', '--D-deepseek-harness-dsh-nord--', SESSION_ID, 'session.v3.jsonl.zstd'),
    projection: join(REAL, 'storages', 'session_projcache', 'sessions', `${SESSION_ID}.json`),
  },
})
// 配色写成 system，这样两套调色板都能用 emulateMedia 驱动。
writeFileSync(join(HOME, 'settings.yaml'), [
  'ui-theme:',
  '  preference: system',
  'locale:',
  '  preference: zh',
  'ui-onboarding:',
  '  welcomeNoticeVersion: 2026-08-13.1',
  '',
].join('\n'))
await ensureProfile()
writeBalancePatch()
const mock = await createBalanceMock()
const server = await startServer({ workspace: ROOT })

let browser, page, problems
try {
  ;({ browser, page, problems } = await openPage(server.url))
  await sleep(2500)
  await dismissWelcome(page)

  // ── 插件在页面上活着 ───────────────────────────────────────────────────
  await waitFor(page, '模块加载器', () => page.evaluate(() => typeof window.__ModuleLoader__ === 'object'))
  const sheets = await page.evaluate(() => ({
    fonts: document.querySelector('#dsh-nord-fonts')?.textContent ?? '',
    surfaces: document.querySelector('#dsh-nord-surfaces')?.textContent?.length ?? 0,
    tables: document.querySelector('#dsh-nord-tables')?.textContent ?? '',
  }))
  if (!sheets.fonts.includes('--dsw-font-family') || !sheets.fonts.includes('--ds-font-family-code')) {
    throw new Error(`字体规则不对：${sheets.fonts}`)
  }
  if (sheets.surfaces < 500) throw new Error(`余额表面样式表缺失或过短：${sheets.surfaces}`)
  if (!sheets.tables.includes('.md-table-wide')) throw new Error(`宽表格补丁缺失：${sheets.tables}`)
  ok('三枚插件样式表', `字体 ${sheets.fonts.length}B / 表面 ${sheets.surfaces}B / 宽表格 ${sheets.tables.length}B`)

  const font = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dsw-font-family').trim())
  if (!font.startsWith("'Maple Mono'")) throw new Error(`字体 token 没生效：${font}`)
  ok('字体 token', font.slice(0, 34) + '…')

  // ── 主题层：两套调色板 ─────────────────────────────────────────────────
  const names = TOKENS.map(([name]) => name)
  for (const [scheme, index] of [['dark', 2], ['light', 1]]) {
    await page.emulateMedia({ colorScheme: scheme })
    await waitFor(page, `${scheme} 调色板`, () => page.evaluate(([probe, want]) => {
      const got = getComputedStyle(document.body).getPropertyValue(probe).trim().toLowerCase()
      return got === want.toLowerCase()
    }, [TOKENS[0][0], TOKENS[0][index]]))
    const actual = await page.evaluate(readTokens, names)
    const wrong = TOKENS.filter(([name, light, dark]) => normalize(actual[name]) !== normalize(index === 1 ? light : dark))
    if (wrong.length > 0) {
      throw new Error(`${scheme} 下这些 token 不是 Nord：\n${wrong.map(([n, l, d]) => `  ${n} = ${actual[n]}（应为 ${index === 1 ? l : d}）`).join('\n')}`)
    }
    ok(`${scheme === 'dark' ? '暗色' : '亮色'} token 抽样`, `${TOKENS.length} 项全部命中`)
  }

  // 回到暗色（后面截图/读数按暗色核对）
  await page.emulateMedia({ colorScheme: 'dark' })

  // ── 打开载体会话：dock 槽位与余额条 ────────────────────────────────────
  await page.locator('div, button, li, a').filter({ hasText: SESSION_TITLE }).last().click()
  await waitFor(page, 'composer.dock 挂载', () => page.evaluate(() =>
    document.querySelector('[data-slot="conversation.composer.dock"]') !== null))

  const dock = await page.evaluate(() => {
    const outlet = document.querySelector('[data-slot="conversation.composer.dock"]')
    const bar = outlet?.querySelector('[data-dsh-nord-bar]')
    return {
      outletDisplay: outlet === null ? null : getComputedStyle(outlet).display,
      barTag: bar?.tagName ?? null,
      barText: bar?.innerText ?? '',
      siblings: outlet?.children.length ?? 0,
    }
  })
  if (dock.barTag !== 'BUTTON' && dock.barTag !== 'SPAN') throw new Error(`余额条没挂在 dock 里：${JSON.stringify(dock)}`)
  // 插件自己那条 :has() 规则把出口从 contents 掰成 flex
  if (dock.outletDisplay !== 'flex') throw new Error(`dock 出口的计算值仍是 ${dock.outletDisplay}，:has() 规则没生效`)
  ok('dock 槽位', `出口 display=${dock.outletDisplay}，${dock.siblings} 个子节点，读数「${dock.barText.trim()}」`)

  await waitFor(page, `余额读数 ${EXPECTED}`, () => page.evaluate((total) => {
    const bar = document.querySelector('[data-dsh-nord-bar]')
    return bar !== null && bar.tagName === 'BUTTON' && (bar.innerText ?? '').includes(total)
  }, EXPECTED))
  ok('余额读数', (await page.locator('[data-dsh-nord-bar]').first().innerText()).replace(/\s+/g, ' '))

  // ── 明细面板与「用量信息」座位 ─────────────────────────────────────────
  await page.locator('button[data-dsh-nord-bar]').first().click()
  await waitFor(page, '余额明细面板', () => page.evaluate(() =>
    document.querySelector('[data-dsh-nord-panel]') !== null))
  const panel = await page.evaluate(() => {
    const el = document.querySelector('[data-dsh-nord-panel]')
    const r = el.getBoundingClientRect()
    const link = el.querySelector('[data-dsh-nord-usage] a')
    return {
      role: el.getAttribute('role'),
      width: Math.round(r.width),
      height: Math.round(r.height),
      rows: [...el.querySelectorAll('dt')].map((dt) => dt.innerText.trim()),
      usage: link?.getAttribute('href') ?? null,
    }
  })
  if (panel.role !== 'dialog') throw new Error(`面板不是 dialog：${panel.role}`)
  if (panel.rows.length !== 4) throw new Error(`明细行数不对：${JSON.stringify(panel.rows)}`)
  // 这一行活着就说明 ui-session 的 useProjection 座位还在投递
  if (panel.usage === null) throw new Error('「用量信息」行没渲染 —— ui-session 的 modelSelection 座位可能变了')
  ok('余额明细面板', `${panel.width}×${panel.height}，${panel.rows.join(' / ')}`)
  ok('用量信息座位', panel.usage)

  await page.keyboard.press('Escape')
  await sleep(600)
  const closed = await page.evaluate(() => document.querySelector('[data-dsh-nord-panel]') === null)
  if (!closed) throw new Error('Escape 没有关掉面板')
  ok('Escape 关闭面板', 'ok')

  // ── 页面无报错 ─────────────────────────────────────────────────────────
  if (problems.length > 0) throw new Error(`页面报错：\n${problems.join('\n')}`)
  ok('页面无 console 报错', problems.length)

  const version = readFileSync(join(ROOT, 'package.json'), 'utf8').match(/"version": "([^"]+)"/)?.[1]
  console.log(`\n全部通过（dsh-nord ${version}）`)
} finally {
  await browser?.close()
  await stopServer(server)
  mock.server.close()
}
