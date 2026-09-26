/**
 * 设置面的实测脚本：本插件自己那一页 + 字体选择器。隔离实例 + headless Edge，不碰主 home。
 *
 *   node scripts/shots/verify-settings.mjs
 *
 * 走一遍用户在设置面板里会做的事，并把每一步的结果打在屏幕上：左栏入口 → 「通用设置」里
 * 确实没有本插件的行 → 自己那一页的标题、分组与几何 → 读默认字体 → 从菜单里换界面字体
 * → 换代码字体 → 「跟随界面字体」 → 自定义字段的取消、恶意串与正常串。最后核对落盘的
 * `settings.yaml`。
 *
 * profile 的 patch 故意只写旧有的五个键：`cordis.patch.yml` 是整段替换 `config`，
 * 所以这一条同时验证新字段的 `.default()` 能不能把旧文档补全。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { FONT_PRESETS, presetPreview } from '../../lib/fonts.js'
import {
  dismissWelcome, ensureProfile, HOME, openPage, prepareHome, ROOT, sleep, startServer, stopServer,
} from './lab.mjs'

const PROFILE = 'shots'

/** 旧 patch 的键集：新增的四个字体字段一律由 schema 默认值补上。 */
const LEGACY_PATCH = [
  '# 验证用：只写旧键集，字体字段交给 schema 默认值',
  '- id: dsh-nord',
  '  config:',
  '    themeEnabled: true',
  '    fontEnabled: true',
  '    balanceEnabled: false',
  '    refreshSeconds: 15',
  '    baseURL: http://127.0.0.1:3099',
  '',
].join('\n')

/** `:root` 上两个字体 token 的计算值。 */
const tokens = () => {
  const style = getComputedStyle(document.documentElement)
  return {
    ui: style.getPropertyValue('--dsw-font-family').trim(),
    code: style.getPropertyValue('--ds-font-family-code').trim(),
  }
}

/** 插件那枚 `<style>` 的正文。 */
const sheet = () => document.querySelector('#dsh-nord-fonts')?.textContent ?? ''

/** 等到条件成立，否则报错。 */
async function waitFor(page, label, check, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return
    await sleep(300)
  }
  throw new Error(`等不到「${label}」`)
}

/** 屏幕上的一行断言。 */
const ok = (label, value) => console.log(`  ✔ ${label}: ${value}`)

prepareHome()
await ensureProfile(PROFILE)
writeFileSync(join(HOME, 'profiles', PROFILE, 'cordis.patch.yml'), LEGACY_PATCH)
const server = await startServer({ profile: PROFILE, workspace: ROOT })

let browser, page, problems
try {
  ;({ browser, page, problems } = await openPage(server.url))
  await sleep(2500)
  await dismissWelcome(page)
  await sleep(2500)

  await page.locator('button, [role="button"], a').filter({ hasText: /^设置$/ }).first().click()
  await waitFor(page, '设置面板', () => page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"]')].some((el) => el.innerText.includes('通用设置'))))

  // ── 左栏多了一行自己的入口，插件设置不再挤在「通用」里 ──────────────────
  const navNames = () => page.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"] nav button')].map((el) => el.innerText.trim()))
  const nav = await navNames()
  console.log(`      左栏：${nav.join(' | ')}`)
  if (!nav.includes('Nord 主题')) throw new Error(`左栏没有「Nord 主题」：${JSON.stringify(nav)}`)
  for (const shipped of ['通用设置', '模型', '插件']) {
    if (nav.indexOf('Nord 主题') < nav.indexOf(shipped)) {
      throw new Error(`「Nord 主题」应排在官方分区「${shipped}」之后：${JSON.stringify(nav)}`)
    }
  }
  ok('左栏入口', nav.join(' / '))

  const bodyText = () => page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '')
  const LEAKED = ['Nord 配色', '底部余额条', '界面字体', 'API 地址']
  await page.getByRole('button', { name: '通用设置', exact: true }).click()
  await sleep(500)
  const general = await bodyText()
  const leaked = LEAKED.filter((line) => general.includes(line))
  if (leaked.length > 0) throw new Error(`「通用」里还留着本插件的行：${JSON.stringify(leaked)}`)
  ok('「通用」已清空', `不见 ${LEAKED.join(' / ')}`)

  // ── 新页面 ─────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Nord 主题', exact: true }).click()
  await waitFor(page, 'Nord 页面', () => page.locator('[data-dsh-nord-settings]').count().then((n) => n === 1))
  const page1 = await page.evaluate(() => {
    const root = document.querySelector('[data-dsh-nord-settings]')
    // 内容列是离页面最近的 `overflow-y:auto` 祖先（槽位渲染还会包一层），别假设 parentElement。
    let column = root.parentElement
    while (column !== null && getComputedStyle(column).overflowY !== 'auto') column = column.parentElement
    const r = root.getBoundingClientRect()
    return {
      heading: root.querySelector('h2')?.innerText ?? '',
      groups: [...root.querySelectorAll('h3')].map((el) => el.innerText),
      columnScrolls: column === null ? null : column.scrollHeight > column.clientHeight,
      columnWidth: column?.clientWidth ?? 0,
      columnHeight: column?.clientHeight ?? 0,
      rootHeight: r.height,
      rootWidth: r.width,
    }
  })
  if (page1.heading !== 'Nord 主题') throw new Error(`页面标题不对：${page1.heading}`)
  if (page1.rootWidth > page1.columnWidth + 1) throw new Error(`页面把内容列撑出了横向滚动：${JSON.stringify(page1)}`)
  if (page1.columnScrolls === true) throw new Error(`整页放不进内容列，列出现纵向滚动：${JSON.stringify(page1)}`)
  ok('独立页面', `标题「${page1.heading}」，分组 ${page1.groups.join(' / ')}`)
  ok('整页落在内容列内', `高 ${Math.round(page1.rootHeight)}px / 列 ${page1.columnHeight}px，宽 ${Math.round(page1.rootWidth)}px，无滚动`)

  // ── 旧 patch 的键集必须被 schema 默认值补全 ─────────────────────────────
  const initial = await page.evaluate(tokens)
  if (!initial.ui.startsWith("'Maple Mono'")) throw new Error(`默认界面字体不是 Maple Mono：${initial.ui}`)
  if (!initial.code.includes('ui-monospace')) throw new Error(`默认代码字体没有等宽回退：${initial.code}`)
  ok('旧 patch + 默认值 → 界面', initial.ui)
  ok('旧 patch + 默认值 → 代码', initial.code)

  const openFontMenu = async (name) => {
    await page.getByRole('button', { name, exact: true }).click()
    await waitFor(page, `${name} 菜单`, () => page.locator('[role="menu"]').count().then((n) => n > 0))
    const rows = await page.locator('[role="menu"] [role="menuitem"]').allInnerTexts()
    return rows
  }
  const pick = async (text) => {
    await page.locator('[role="menu"] [role="menuitem"]').filter({ hasText: text }).first().click()
    await sleep(900)
  }
  /**
   * 菜单里每一行标签的实际字体族（取最内层的文本 span——Menu 自己还包了一层
   * `.itemLabel`，那一层的字体是全局的，不是样本），以及触发按钮上的那一行。
   */
  const rowFonts = () => page.evaluate(() => ({
    rows: [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].map((row) => {
      const inner = [...row.querySelectorAll('span')].filter((el) => el.children.length === 0 && el.innerText.trim() !== '')
      return { text: row.innerText.trim(), font: getComputedStyle(inner.at(-1) ?? row).fontFamily }
    }),
    trigger: getComputedStyle(document.querySelector('button[aria-haspopup="menu"][aria-expanded="true"] span span') ?? document.body).fontFamily,
  }))

  // ── 界面字体：菜单内容与选择 ────────────────────────────────────────────
  const uiRows = await openFontMenu('界面字体')
  ok('界面字体菜单行数', uiRows.length)
  console.log(`      ${uiRows.join(' | ')}`)
  if (uiRows.length !== 10) throw new Error(`界面字体菜单应有 10 行（跟随系统 + 8 预设 + 自定义），实际 ${uiRows.length}`)
  if (uiRows.includes('跟随界面字体')) throw new Error('界面字体菜单不应出现「跟随界面字体」')

  // 每一行用它自己选的字体渲染：没装的话看到的就是回退，行本身就是样品。
  // 计算值会被规范化（引号按需保留、单名去引号），所以两边都去掉引号再比。
  const normalize = (value) => value.replace(/["']/g, '').toLowerCase()
  const specimens = await rowFonts()
  const rows = specimens.rows
  for (const [index, preset] of FONT_PRESETS.entries()) {
    const row = rows[index + 1]
    if (row === undefined) throw new Error(`菜单少了第 ${index + 1} 行预设`)
    const expected = normalize(presetPreview(preset.id, 'ui'))
    if (!normalize(row.font).startsWith(expected)) {
      throw new Error(`「${row.text}」没有用自己的字体渲染：\n  实际 ${row.font}\n  期望以 ${expected} 开头`)
    }
  }
  ok('菜单行即样本', `${FONT_PRESETS.length} 行各自带自己的字体栈`)
  ok('触发按钮用当前栈', specimens.trigger.slice(0, 34) + '…')

  // 菜单是 portal 出来的，不能被设置面板的 overflow 裁掉
  const menuBox = await page.locator('[role="menu"]').first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  const viewport = page.viewportSize()
  const inside = menuBox.x >= 0 && menuBox.y >= 0
    && menuBox.x + menuBox.w <= viewport.width && menuBox.y + menuBox.h <= viewport.height
  if (!inside) throw new Error(`菜单被裁出视口：${JSON.stringify(menuBox)} vs ${JSON.stringify(viewport)}`)
  ok('菜单完整落在视口内', `${Math.round(menuBox.w)}×${Math.round(menuBox.h)} @ ${Math.round(menuBox.x)},${Math.round(menuBox.y)}`)

  await pick('JetBrains Mono')
  const jetbrains = await page.evaluate(tokens)
  if (!jetbrains.ui.startsWith("'JetBrains Mono'")) throw new Error(`换成 JetBrains Mono 没生效：${jetbrains.ui}`)
  if (jetbrains.code !== initial.code) throw new Error('改界面字体不该动到代码字体')
  ok('界面字体 → JetBrains Mono', jetbrains.ui)

  // ── 代码字体：独立选择，且有「跟随界面字体」 ────────────────────────────
  const codeRows = await openFontMenu('代码字体')
  ok('代码字体菜单行数', codeRows.length)
  if (!codeRows.includes('跟随界面字体')) throw new Error('代码字体菜单缺「跟随界面字体」')
  await pick('Cascadia Code')
  const cascadia = await page.evaluate(tokens)
  if (!cascadia.code.startsWith("'Cascadia Code'")) throw new Error(`换成 Cascadia Code 没生效：${cascadia.code}`)
  if (cascadia.ui !== jetbrains.ui) throw new Error('改代码字体不该动到界面字体')
  ok('代码字体 → Cascadia Code', cascadia.code)

  await openFontMenu('代码字体')
  await pick('跟随界面字体')
  const inherited = await page.evaluate(tokens)
  if (inherited.code !== inherited.ui) throw new Error('「跟随界面字体」没有把两个 token 对齐')
  ok('代码字体 → 跟随界面字体', inherited.code.slice(0, 40) + '…')

  // ── 自定义：打开后不输入就离开 = 取消，原字体不变 ────────────────────────
  await openFontMenu('界面字体')
  await pick('自定义')
  const field = page.getByLabel('自定义字体栈')
  await waitFor(page, '自定义输入框', () => field.count().then((n) => n > 0))
  const beforeCancel = await page.evaluate(tokens)
  await page.keyboard.press('Tab')
  await sleep(800)
  const afterCancel = await page.evaluate(tokens)
  if (afterCancel.ui !== beforeCancel.ui) throw new Error(`空自定义被当成提交了：${afterCancel.ui}`)
  if (await field.count() !== 0) throw new Error('取消后自定义字段没有收起')
  ok('空自定义 = 取消', afterCancel.ui.slice(0, 30) + '…')

  // ── 自定义：恶意串进不了样式表 ─────────────────────────────────────────
  const hostile = 'Arial; } html { --pwn: 1px !important; } :root {'
  await openFontMenu('界面字体')
  await pick('自定义')
  await waitFor(page, '自定义输入框', () => field.count().then((n) => n > 0))
  await field.fill(hostile)
  await page.keyboard.press('Tab')
  await sleep(1200)

  const injected = await page.evaluate(tokens)
  const sheetText = await page.evaluate(sheet)
  const braces = (sheetText.match(/[{}]/g) ?? []).length
  const pwn = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pwn').trim())
  if (braces !== 2) throw new Error(`样式表里出现了 ${braces} 个花括号（应为一对）：${sheetText}`)
  if (pwn !== '') throw new Error(`恶意串注入了 --pwn = ${pwn}`)
  if (!injected.ui.includes('sans-serif')) throw new Error(`全部被拒后应回退到尾栈：${injected.ui}`)
  ok('恶意自定义串被丢弃', `花括号 ${braces} 个，--pwn 为空，回落 ${injected.ui.slice(0, 32)}…`)

  // ── 自定义：正常串生效 ─────────────────────────────────────────────────
  await field.fill("'LXGW WenKai', Microsoft YaHei, sans-serif")
  await page.keyboard.press('Tab')
  await sleep(1200)
  const custom = await page.evaluate(tokens)
  if (!custom.ui.startsWith("'LXGW WenKai', 'Microsoft YaHei', sans-serif")) {
    throw new Error(`自定义串没按预期拼装：${custom.ui}`)
  }
  ok('自定义串生效', custom.ui)

  // ── 落盘 ───────────────────────────────────────────────────────────────
  const stored = readFileSync(join(HOME, 'settings.yaml'), 'utf8')
  const section = stored.slice(stored.indexOf('dsh-nord:')).split('\n').slice(0, 8).join('\n')
  console.log('\n=== settings.yaml ===')
  console.log(section)
  for (const expected of ['uiFont: custom', 'codeFont: inherit', 'uiFontCustom:']) {
    if (!stored.includes(expected)) throw new Error(`settings.yaml 缺少 ${expected}`)
  }
  ok('落盘字段', 'uiFont / uiFontCustom / codeFont')

  if (problems.length > 0) throw new Error(`页面报错：\n${problems.join('\n')}`)
  ok('页面无 console 报错', problems.length)
  console.log('\n全部通过')
} finally {
  await browser?.close()
  await stopServer(server)
}
