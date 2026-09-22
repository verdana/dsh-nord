/**
 * 余额轮询失效复现：会话 A → 会话 B → 回到 A，看 A 的读数是否还继续更新。
 *
 *   node scripts/shots/poll-repro.mjs
 *
 * 怀疑对象：轮询只有一份写入句柄（`src/client/index.ts` 的 `balanceBound`），
 * 而 `conversation.composer.dock` 是 session 作用域、store 是每会话一个实例
 * （dsh-client-store 的 `defineStore.create()` 每次建新 `actions`），渲染侧的
 * inject 结果又按 (entry × 绑定) 缓存 —— 换回旧会话时 inject 不会再跑，写入
 * 仍然落在上一个会话的 store 上。
 *
 * 观测手法：mock 每次被请求就把余额 +1，所以条上的数字就是「这次读数有多新」。
 * 隔离 home（`.shot-lab/home`）+ 本地 mock，不碰真实账户。
 */
import { createServer } from 'node:http'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  dismissWelcome, ensureProfile, HOME, MOCK_PORT, openPage, prepareHome, ROOT,
  sleep, startServer, stopServer, workspaceSlug, writeBalancePatch,
} from './lab.mjs'

const REAL = join(homedir(), '.dsh')
const SLUG = workspaceSlug(ROOT)
const WORKSPACE_TITLE = 'dsh-nord 实验台'

/** 两个真实会话（只读拷贝进隔离 home），用来做 A → B → A 的切换。 */
const A = {
  id: 'session-21e5be96-b57d-4c7d-93bb-a887cbafc64a',
  title: 'dsh插件多方式安装测试脚本',
  probe: '安装方式通常有本地link',
}
const B = {
  id: 'session-f5a7f2f1-2ba4-4dd1-8850-ac392ff96a3c',
  title: '会话中余额查询失效排查',
  probe: '余额查询似乎会失效',
}

/** 每个阶段停留多久（毫秒）；轮询间隔是 writeBalancePatch 里的 15s。 */
const SETTLE_MS = 40_000

const sourceOf = (id) => join(REAL, 'sessions', SLUG, id, 'session.v3.jsonl.zstd')
const projectionOf = (id) => join(REAL, 'storages', 'session_projcache', 'sessions', `${id}.json`)

/** mock：每次带 Bearer 的 /user/balance 都让余额 +1，数字即新鲜度。 */
function createCountingMock({ port = MOCK_PORT } = {}) {
  let served = 0
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url !== '/user/balance') { res.writeHead(404).end(); return }
    if (!/^Bearer \S+$/.test(req.headers.authorization ?? '')) {
      res.writeHead(401).end(JSON.stringify({ error: { message: 'unauthorized' } }))
      return
    }
    served += 1
    res.end(JSON.stringify({
      is_available: true,
      balance_infos: [{
        currency: 'CNY',
        total_balance: `${String(40 + served)}.00`,
        granted_balance: '2.50',
        topped_up_balance: `${String(37 + served)}.50`,
      }],
    }))
  })
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => done({ server, count: () => served }))
  })
}

/** prepareHome 只铺一个会话，这里补第二个，并把工作区名改得与会话名不撞。 */
function addSecondSession(session) {
  const dir = join(HOME, 'sessions', SLUG, session.id)
  mkdirSync(dir, { recursive: true })
  copyFileSync(sourceOf(session.id), join(dir, 'session.v3.jsonl.zstd'))
  if (existsSync(projectionOf(session.id))) {
    copyFileSync(projectionOf(session.id), join(HOME, 'storages', 'session_projcache', 'sessions', `${session.id}.json`))
  }
  const file = join(HOME, 'storages', 'workspace.json')
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const workspace = data.tables.workspaces['w-shots']
  workspace.sessionIds = [A.id, B.id]
  workspace.title = WORKSPACE_TITLE
  writeFileSync(file, JSON.stringify(data, null, 2))
}

async function waitFor(label, check, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return true
    await sleep(500)
  }
  throw new Error(`等不到「${label}」（${String(timeoutMs)}ms）`)
}

/** composer 槽位挂上了没有（hero 页没有它）。 */
const dockMounted = (page) => page.evaluate(() =>
  document.querySelector('[data-slot="conversation.composer.dock"]') !== null)

/** 读数条文本；未挂载或 idle 时为 null。 */
const barText = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-dsh-nord-bar]')
  return el === null ? null : el.innerText.replace(/\s+/g, ' ').trim()
})

/** 条上的数字（余额），取不到给 NaN。 */
async function barAmount(page) {
  const found = /(\d+(?:\.\d+)?)/.exec((await barText(page)) ?? '')
  return found === null ? Number.NaN : Number(found[1])
}

/** 当前展示的是不是这个会话：会话头标题或正文串命中即可。 */
const showingSession = (page, session) => page.evaluate(({ title, probe }) => {
  const header = document.querySelector('[data-slot="conversation.session.header"]')
  if (header !== null && header.innerText.includes(title)) return true
  const body = document.querySelector('[data-slot="conversation.session"]')
  return body !== null && body.innerText.includes(probe)
}, { title: session.title, probe: session.probe })

const mark = (label, value) => console.log(`  ${label.padEnd(30)} ${value}`)

/** 点侧栏会话项（role=treeitem，行文本是「标题 + 相对时间」），再等真的换过去。 */
async function openSession(page, session) {
  // 侧栏行要几秒才渲染；工作区分组默认展开，别去点它（点一下反而折回去）
  await waitFor(`侧栏列出「${session.title}」`, () => page.evaluate((title) =>
    [...document.querySelectorAll('[role="treeitem"]')]
      .some((el) => (el.textContent ?? '').trim().startsWith(title)), session.title), 30_000)

  const row = page.locator('[role="treeitem"]').filter({ hasText: session.title }).last()
  await row.click({ timeout: 15_000 })
  await waitFor(`切到「${session.title}」`, () => showingSession(page, session))
  await waitFor(`「${session.title}」的 composer.dock`, () => dockMounted(page), 30_000)
}

prepareHome({
  workspace: ROOT,
  session: { id: A.id, title: A.title, source: sourceOf(A.id), projection: projectionOf(A.id) },
})
addSecondSession(B)
await ensureProfile()
writeBalancePatch('shots')
const mock = await createCountingMock()
const server = await startServer({ workspace: ROOT })

let browser, page
try {
  ;({ browser, page } = await openPage(server.url, { width: 1440, height: 900, scale: 1 }))
  await sleep(2500)
  await dismissWelcome(page)
  await sleep(4000)

  console.log('\n=== 1. 打开会话 A，等首个读数 ===')
  try {
    await openSession(page, A)
  } catch (error) {
    console.log('打开 A 失败，侧栏诊断：')
    console.log(JSON.stringify(await page.evaluate(() => ({
      tree: [...document.querySelectorAll('[role="tree"]')].map((el) => el.outerHTML.slice(0, 2500)),
      body: document.body.innerText.split('\n').filter(Boolean).slice(0, 25),
    })), null, 2))
    throw error
  }
  await waitFor('A 的余额读数', async () => Number.isFinite(await barAmount(page)))
  const a1 = await barAmount(page)
  mark('A 读数', `${String(a1)}   (mock 服务 ${String(mock.count())} 次)`)

  console.log(`\n=== 2. 留在 A ${String(SETTLE_MS / 1000)}s（对照：初始绑定应能刷新） ===`)
  await sleep(SETTLE_MS)
  const a2 = await barAmount(page)
  mark('A 读数', `${String(a2)}   (mock 服务 ${String(mock.count())} 次)`)

  console.log('\n=== 3. 切到会话 B（inject 重跑，写入句柄换到 B） ===')
  await openSession(page, B)
  await waitFor('B 的余额读数', async () => Number.isFinite(await barAmount(page)))
  const b1 = await barAmount(page)
  mark('B 读数', `${String(b1)}   (mock 服务 ${String(mock.count())} 次)`)

  console.log(`\n=== 4. 留在 B ${String(SETTLE_MS / 1000)}s（对照：B 应能刷新） ===`)
  await sleep(SETTLE_MS)
  const b2 = await barAmount(page)
  mark('B 读数', `${String(b2)}   (mock 服务 ${String(mock.count())} 次)`)

  console.log('\n=== 5. 切回会话 A ===')
  await openSession(page, A)
  await sleep(2000)
  const a3 = await barAmount(page)
  mark('A 读数', `${String(a3)}   (mock 服务 ${String(mock.count())} 次)`)

  console.log(`\n=== 6. 停在 A 上等 ${String(SETTLE_MS / 1000)}s（≥2 个轮询周期） ===`)
  const hitsBefore = mock.count()
  await sleep(SETTLE_MS)
  const a4 = await barAmount(page)
  const hitsAfter = mock.count()
  mark('A 读数', `${String(a4)}   (mock 服务 ${String(hitsAfter)} 次)`)

  console.log('\n=== 7. 再切到 B，看 B 的读数有多新 ===')
  await openSession(page, B)
  await sleep(2000)
  const b3 = await barAmount(page)
  mark('B 读数', `${String(b3)}   (mock 服务 ${String(mock.count())} 次)`)

  console.log('\n================ 结论 ================')
  mark('阶段 2：A 是否刷新', a2 > a1 ? `是（${String(a1)} → ${String(a2)}）` : `否（${String(a1)} → ${String(a2)}）`)
  mark('阶段 4：B 是否刷新', b2 > b1 ? `是（${String(b1)} → ${String(b2)}）` : `否（${String(b1)} → ${String(b2)}）`)
  mark('阶段 6：A 期间轮询次数', String(hitsAfter - hitsBefore))
  mark('阶段 6：A 是否刷新', a4 > a3 ? `是（${String(a3)} → ${String(a4)}）` : `否（${String(a3)} → ${String(a4)}）`)
  mark('B 的读数', String(b3))

  if (a2 > a1 && b2 > b1 && hitsAfter - hitsBefore > 0 && a4 === a3 && b3 > a4) {
    console.log('复现成功：轮询一直在跑（mock 持续被请求），但读数写进了 B 的 store，切回 A 后条冻住不动。')
  } else if (a4 > a3) {
    console.log('未复现：切回 A 后读数仍在刷新。')
  } else {
    console.log('不确定：看上面的探针数据。')
  }
} finally {
  await browser?.close()
  await stopServer(server)
  mock.server.close()
}
