/**
 * 重拍 README 三张截图（暗色）。
 *
 *   node scripts/shots/capture.mjs
 *
 * 隔离实例由 `./lab.mjs` 起（`DSH_HOME` 指向 `.shot-lab/home`，不碰主 home）。
 * 截图的载体是 dsh-nord 工作区里一个真实会话：整份拷贝到隔离 home，只读。
 * 余额走 `tests/balance-mock.mjs`，所以数字固定是 42.50 CNY。
 *
 * 产出覆盖 `assets/`（目标像素与旧图一致）：
 *   01-theme.png    1440×900  整页：侧栏 + 会话 + composer
 *   02-settings.png  816×816  设置 → 通用，Nord 主题卡
 *   03-balance.png   900×221  余额条与明细面板
 * 一律按 deviceScaleFactor 2 渲染，再用 sharp 精确降到目标像素（等价 2x 清晰度）。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import {
  createBalanceMock, dismissWelcome, ensureProfile, openPage, OUT, prepareHome,
  ROOT, sleep, startServer, stopServer, writeBalancePatch,
} from './lab.mjs'

/** 载体会话：dsh-nord 工作区里的「dsh插件多方式安装测试脚本」。 */
const SESSION_ID = 'session-21e5be96-b57d-4c7d-93bb-a887cbafc64a'
const SESSION_TITLE = 'dsh插件多方式安装测试脚本'
const REAL = join(homedir(), '.dsh')

/** mock 返回的余额，用来确认读数已经到位再截图。 */
const EXPECTED_BALANCE = '42.50'
const EXPECTED_CURRENCY = 'CNY'

/** 页面的逻辑像素尺寸（deviceScaleFactor 之后实际是两倍）。 */
const PAGE = { width: 1440, height: 900 }

/** 各图的逻辑像素目标尺寸；局部图按这个长宽比裁剪，缩放时不变形。 */
const TARGETS = {
  '01-theme.png': { width: 1440, height: 900 },
  '02-settings.png': { width: 816, height: 816 },
  '03-balance.png': { width: 900, height: 221 },
}

/**
 * 在页面内取一块与目标尺寸同长宽比的裁剪区：以内容为中心，
 * 不够的部分吸附到视口内。这样 `resize(target)` 是等比缩放，不会拉伸。
 */
function clipFor(content, target) {
  const aspect = target.width / target.height
  let height = content.height
  let width = height * aspect
  if (width < content.width) {
    width = content.width
    height = width / aspect
  }
  if (height > PAGE.height) {
    height = PAGE.height
    width = height * aspect
  }
  if (width > PAGE.width) {
    width = PAGE.width
    height = width / aspect
  }
  const centerX = content.x + content.width / 2
  const centerY = content.y + content.height / 2
  const x = Math.max(0, Math.min(PAGE.width - width, centerX - width / 2))
  const y = Math.max(0, Math.min(PAGE.height - height, centerY - height / 2))
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
}

/** 等到条件成立或超时。 */
async function waitFor(page, label, check, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return true
    await sleep(400)
  }
  throw new Error(`等不到「${label}」（${timeoutMs}ms）`)
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
await ensureProfile()
writeBalancePatch()
const balanceMock = await createBalanceMock()
const server = await startServer({ workspace: ROOT })

let browser, page
try {
  ;({ browser, page } = await openPage(server.url, { width: 1440, height: 900, scale: 2 }))
  await sleep(2500)
  await dismissWelcome(page)
  await sleep(5000)

  // ── 打开载体会话 ────────────────────────────────────────────────────────
  const row = page.locator('div, button, li, a').filter({ hasText: SESSION_TITLE }).last()
  if (await row.count() === 0) throw new Error(`侧栏里找不到会话「${SESSION_TITLE}」`)
  await row.click()
  await waitFor(page, 'composer.dock 挂载', () => page.evaluate(() => document.querySelector('[data-slot="conversation.composer.dock"]') !== null))
  console.log('会话已打开，composer.dock 已挂载')

  // ── 等余额读数真正到位（不能拍到「查询中」或错误态）────────────────────
  await waitFor(page, `余额读数 ${EXPECTED_BALANCE}`, () => page.evaluate(([currency, total]) => {
    const bar = document.querySelector('[data-dsh-nord-bar]')
    if (bar === null) return false
    const text = bar.innerText
    return bar.tagName === 'BUTTON' && text.includes(currency) && text.includes(total)
  }, [EXPECTED_CURRENCY, EXPECTED_BALANCE]))
  console.log('余额读数已到位:', await page.locator('[data-dsh-nord-bar]').first().innerText())

  // ── 01 整页主题 ────────────────────────────────────────────────────────
  const barBox = await page.locator('[data-slot="conversation.composer.dock"]').evaluate((el) => el.getBoundingClientRect().top)
  console.log('composer dock 顶部 y =', Math.round(barBox))
  await page.screenshot({ path: join(OUT, '01-theme.png') })
  console.log('拍到 01-theme.png')

  // ── 03 余额条与明细面板 ────────────────────────────────────────────────
  const bar = page.locator('button[data-dsh-nord-bar]').first()
  await bar.click()
  await waitFor(page, '余额明细面板可见', () => page.evaluate(() => {
    const panel = document.querySelector('[data-dsh-nord-panel]')
    if (panel === null) return false
    const r = panel.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(panel).visibility !== 'hidden'
  }))

  const box = (locator) => locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  const barRect = await box(bar)
  const panelRect = await box(page.locator('[data-dsh-nord-panel]').first())
  const clip = clipFor({
    x: Math.min(barRect.x, panelRect.x),
    y: Math.min(barRect.y, panelRect.y),
    width: Math.max(barRect.x + barRect.width, panelRect.x + panelRect.width) - Math.min(barRect.x, panelRect.x),
    height: Math.max(barRect.y + barRect.height, panelRect.y + panelRect.height) - Math.min(barRect.y, panelRect.y),
  }, TARGETS['03-balance.png'])
  console.log('余额条 rect:', JSON.stringify(barRect))
  console.log('明细面板 rect:', JSON.stringify(panelRect))
  console.log('裁剪:', JSON.stringify(clip))
  await page.screenshot({ path: join(OUT, '03-balance.png'), clip })
  console.log('拍到 03-balance.png')
  await page.keyboard.press('Escape')
  await sleep(800)

  // ── 02 设置页 ──────────────────────────────────────────────────────────
  const settings = page.locator('button, [role="button"], a').filter({ hasText: /^设置$/ })
  await settings.first().click()
  await waitFor(page, '设置对话框与左栏入口', () => page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"] nav button')].some((el) => el.innerText.trim() === 'Nord 主题')))
  // 本插件有自己的一页：点开左栏那一行再拍，拍到的是页面本身而不是「通用」里的卡片。
  await page.getByRole('button', { name: 'Nord 主题', exact: true }).click()
  await waitFor(page, 'Nord 设置页', () => page.locator('[data-dsh-nord-settings]').count().then((n) => n === 1))
  await sleep(800)
  const dialogRect = await box(page.locator('[role="dialog"]').last())
  const settingsClip = clipFor(dialogRect, TARGETS['02-settings.png'])
  console.log('设置对话框 rect:', JSON.stringify(dialogRect), '→ 裁剪', JSON.stringify(settingsClip))
  await page.screenshot({ path: join(OUT, '02-settings.png'), clip: settingsClip })
  console.log('拍到 02-settings.png')
} finally {
  await browser?.close()
  await stopServer(server)
  balanceMock.server.close()
}

// ── 精确降到目标像素并落盘 assets/ ───────────────────────────────────────────
console.log('\n=== 降采样并覆盖 assets/ ===')
mkdirSync(join(ROOT, 'assets'), { recursive: true })
const { renameSync } = await import('node:fs')
for (const [name, size] of Object.entries(TARGETS)) {
  const source = join(OUT, name)
  if (!existsSync(source)) throw new Error(`缺产物 ${source}`)
  const target = join(ROOT, 'assets', name)
  const meta = await sharp(source).metadata()
  // 裁剪区已按目标长宽比取好，这里等比缩到目标像素即可
  const info = await sharp(source).resize(size.width, size.height).png({ compressionLevel: 9 }).toFile(`${target}.tmp`)
  renameSync(`${target}.tmp`, target)
  console.log(`${name}: ${meta.width}×${meta.height} → ${info.width}×${info.height}, ${(info.size / 1024).toFixed(1)}kB`)
}
