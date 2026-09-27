#!/usr/bin/env node
/**
 * release-lab — 用隔离的 DSH_HOME 逐个验证插件的每一种安装方式。
 *
 * 为什么这么做：`dsh plugin add/remove` 会改 profile 的 package.json、node_modules
 * 与 pnpm-lock，反复在真实 profile 上装卸既慢又脏。这里把 `DSH_HOME` 指到一个
 * 临时目录（`@deepseek-ai/dsh-home-paths` 会读这个变量），每种安装方式配一个
 * 一次性 profile，跑完即弃；真实 `~/.dsh` 全程不被触碰。
 *
 * 每种方式依次做三件事：
 *   1. install —— `dsh plugin --profile <p> add <spec>`（git 方式会自动补 allowBuilds 后重试）
 *   2. layer   —— `dsh --profile <p> --dump-config`，确认 `# == <包名>` 层已挂上
 *   3. resolve —— profile 的 node_modules 里确实解出了本包装（不是空目录/软链失效）
 *   4. boot    —— 起一次 `dsh --profile <p> --no-open --port 0`，抓首页的
 *                `__DSH_BOOT__` payload，确认客户端半边进了 entries 且 inject 正确
 *
 * 用法：
 *   node scripts/release-lab.mjs                     # 全部方式
 *   node scripts/release-lab.mjs link tarball        # 只跑指定方式
 *   node scripts/release-lab.mjs npm --registry https://registry.npmjs.org/
 *   node scripts/release-lab.mjs --keep              # 保留 lab 目录（失败排查）
 *   node scripts/release-lab.mjs --no-boot           # 跳过启动检查（快很多）
 *   node scripts/release-lab.mjs --parallel          # 各 profile 并行安装
 *
 * 依赖：node >= 18（全局 fetch）、pnpm 在 PATH 上、`dsh` 在 PATH 上。
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LAB = join(ROOT, '.release-lab')
const LAB_HOME = join(LAB, 'home')
const ARTIFACTS = join(LAB, 'artifacts')

/**
 * 要驱动的那个 `dsh` 可执行文件。默认是 PATH 上的 `dsh`；想拿另一个版本跑同一套
 * 检查，把 `DSH_BIN` 指到那份安装的 bin。见 DEVELOPMENT.md「版本现实 · 并排装另一个 dsh 版本」。
 */
const DSH_BIN = process.env.DSH_BIN ?? 'dsh'

/** 包清单：参数解析（--help 文本要引用包名）与后续核查都要用，所以先读。 */
const reader = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const PKG_NAME = reader.name
const PKG_VERSION = reader.version

// ── CLI ──────────────────────────────────────────────────────────────────────

const ALL_METHODS = ['link', 'tarball', 'npm', 'git']

const opts = {
  methods: [],
  keep: false,
  boot: true,
  parallel: false,
  home: 'lab',
  registry: '',
  gitSpec: '',
  spec: '',
  minReleaseAge: '',
  bootTimeoutMs: 90_000,
}

const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]
  if (arg === '--keep') opts.keep = true
  else if (arg === '--no-boot') opts.boot = false
  else if (arg === '--parallel') opts.parallel = true
  else if (arg === '--registry') opts.registry = argv[++i] ?? ''
  else if (arg === '--spec') opts.spec = argv[++i] ?? ''
  else if (arg === '--git') opts.gitSpec = argv[++i] ?? ''
  else if (arg === '--min-release-age') opts.minReleaseAge = argv[++i] ?? ''
  else if (arg === '--home') opts.home = argv[++i] ?? 'lab'
  else if (arg === '--timeout') opts.bootTimeoutMs = Number(argv[++i] ?? 0) || opts.bootTimeoutMs
  else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0) }
  else if (arg.startsWith('-')) fail(`未知参数 ${arg}（--help 看用法）`)
  else opts.methods.push(arg)
}
if (opts.methods.length === 0) opts.methods = [...ALL_METHODS]
for (const method of opts.methods) {
  if (!ALL_METHODS.includes(method)) fail(`未知安装方式 ${method}；可选：${ALL_METHODS.join(', ')}`)
}
if (opts.home === 'real') {
  fail('--home real 会改动你自己的 profile，本脚本故意不提供：请手工在真实 profile 上装卸')
}

// ── 小工具 ───────────────────────────────────────────────────────────────────

function printHelp() {
  process.stdout.write(`用法: node scripts/release-lab.mjs [方式...] [选项]

方式: ${ALL_METHODS.join(' ')}（默认全部）

选项:
  --keep            保留 .release-lab/（含隔离 home、已装 profile、日志）
  --no-boot         跳过「起 dsh web 抓首页」这一步
  --parallel        各方式并行安装
  --registry <url>  npm 方式的 registry，例如 https://registry.npmjs.org/
  --spec <spec>     npm 方式装的 spec（默认 ${PKG_NAME}@latest）
  --min-release-age <seconds>
                    覆盖 pnpm 的新版本冷静期（pnpm 11+ 默认 24 小时，即不把「刚发布」
                    的版本纳入标签解析）。刚发完版时 @latest 会装到上一个版本，
                    传 0 才是「立刻装到最新版」；也可以改用显式范围 --spec ${PKG_NAME}@^<版本>。
  --git <spec>      git 方式的 spec，默认 github:<repository 或 remote 的 owner/repo>
  --timeout <ms>    启动检查的等待上限（默认 90000）

例子:
  node scripts/release-lab.mjs                          # 四种方式全跑
  node scripts/release-lab.mjs link tarball             # 发布前彩排（不碰网络）
  node scripts/release-lab.mjs npm --registry https://registry.npmjs.org/
  node scripts/release-lab.mjs npm --registry https://registry.npmjs.org/ --min-release-age 0
                                                        # 刚发完版，立刻验证新版
  node scripts/release-lab.mjs git --keep               # 留住现场排查
  node scripts/release-lab.mjs link --no-boot            # 只查装卸，不启服务
`)
}

function fail(message) {
  process.stderr.write(`release-lab: ${message}\n`)
  process.exit(2)
}

function log(message = '') {
  process.stdout.write(`${message}\n`)
}

/**
 * 每种方式的输出通道：串行时直写 stdout；并行时先攒起来，
 * 该方式跑完再整块吐出——否则几条方式的行会搅在一起没法看。
 */
function makeSink(parallel) {
  if (!parallel) return { emit: (line) => log(line), flush: () => {} }
  const buffer = []
  return { emit: (line) => buffer.push(line), flush: () => log(buffer.join('\n')) }
}

const paint = (code, text) => (process.stdout.isTTY ? `\u001B[${code}m${text}\u001B[0m` : text)
const dim = (text) => paint('2', text)
const bold = (text) => paint('1', text)
const green = (text) => paint('32', text)
const red = (text) => paint('31', text)
const yellow = (text) => paint('33', text)

/** 跑一条命令，返回 { code, stdout, stderr, ms }；不抛异常。 */
function run(command, args, options = {}) {
  return new Promise((settle) => {
    const started = Date.now()
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      env: { ...process.env, ...options.env },
      shell: process.platform === 'win32',
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => { stdout += chunk })
    child.stderr?.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => settle({ code: -1, stdout, stderr: `${stderr}${error.message}`, ms: Date.now() - started }))
    child.on('close', (code) => settle({ code: code ?? -1, stdout, stderr, ms: Date.now() - started }))
  })
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

// ── 隔离环境 ─────────────────────────────────────────────────────────────────

function prepareLab() {
  rmSync(LAB, { recursive: true, force: true })
  mkdirSync(LAB_HOME, { recursive: true })
  mkdirSync(ARTIFACTS, { recursive: true })
}

/** 跑 `dsh` 的统一入口：DSH_HOME 钉死在 lab 里。 */
function dsh(args, options = {}) {
  return run(DSH_BIN, args, { ...options, env: { DSH_HOME: options.home ?? LAB_HOME, ...options.env } })
}

const profileDir = (profile) => join(LAB_HOME, 'profiles', profile)
const profileManifest = (profile) => JSON.parse(readFileSync(join(profileDir(profile), 'package.json'), 'utf8'))

/** 让 profile 干净地回到「只剩模板」的状态：先摘掉插件，再删掉整个 profile 目录重建。 */
async function freshProfile(profile) {
  if (!existsSync(join(profileDir(profile), 'package.json'))) {
    const init = await dsh(['--profile', profile, '--from-default-profile', 'web', '--dump-config'])
    if (init.code !== 0) throw new Error(`初始化 profile ${profile} 失败:\n${init.stderr.trim()}`)
    return
  }
  await dsh(['plugin', '--profile', profile, 'remove', PKG_NAME])
  rmSync(profileDir(profile), { recursive: true, force: true })
  const init = await dsh(['--profile', profile, '--from-default-profile', 'web', '--dump-config'])
  if (init.code !== 0) throw new Error(`重建 profile ${profile} 失败:\n${init.stderr.trim()}`)
}

// ── git 方式的 allowBuilds 闸门 ──────────────────────────────────────────────

/**
 * 从 pnpm 的报错里抠出它要求粘贴的那一行 allowBuilds 键值。
 * pnpm 会按终端宽度折行（非 TTY 下折得更狠），URL 里不可能有空白，
 * 所以先删掉所有空白再匹配，折行就不影响。
 */
function findAllowBuildsKey(text) {
  const flat = text.replace(/\s+/g, '')
  const match = /(?<pkg>[A-Za-z0-9._-]+)@https:\/\/codeload\.github\.com\/(?<path>[A-Za-z0-9._/-]+?):true/.exec(flat)
  return match === null ? null : `${match.groups.pkg}@https://codeload.github.com/${match.groups.path}`
}

/**
 * 把 <key>: true 写进 profile 的 pnpm-workspace.yaml 的 allowBuilds 段。
 * 刻意用文本插入而不是 YAML 重写：注释与缩进原样保留，重复调用幂等。
 */
function allowBuilds(profile, key) {
  const file = join(profileDir(profile), 'pnpm-workspace.yaml')
  const entry = `  ${key}: true`
  let text = existsSync(file) ? readFileSync(file, 'utf8') : 'packages:\n  - .\n'
  if (text.includes(`${key}:`)) return
  const lines = text.replace(/\s*$/, '').split('\n')
  const at = lines.findIndex((line) => /^allowBuilds:\s*$/.test(line))
  if (at === -1) lines.push('allowBuilds:', entry)
  else lines.splice(at + 1, 0, entry)
  writeFileSync(file, `${lines.join('\n')}\n`)
}

// ── 新版本冷静期 ─────────────────────────────────────────────────────────────

/**
 * pnpm 11 起默认不把「发布不足 24 小时」的版本纳入标签解析（minimumReleaseAge）。
 * 于是刚发完版立刻 `add <包名>@latest` 装到的是上一个版本——lab 如果只看
 * `npm view version`（读的是 latest 标签）就会误报「一致」。这里把冷静期算出来，
 * 让报告说清楚「pnpm 实际会解析到哪个版本」。
 * @returns 秒数；显式设为 0 或读不出默认值时返回 null（视为不启用）。
 */
function pnpmMinimumReleaseAgeSeconds() {
  if (opts.minReleaseAge !== '') {
    const asked = Number(opts.minReleaseAge)
    return Number.isFinite(asked) && asked > 0 ? asked : null
  }
  const asked = spawnSync('pnpm', ['config', 'get', 'minimum-release-age'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' })
  const value = Number((asked.stdout ?? '').trim())
  if (Number.isFinite(value)) return value > 0 ? value : null
  // pnpm 不在 `config get` 里报默认值，只能按大版本推断：11 起默认 24 小时。
  const version = spawnSync('pnpm', ['--version'], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' })
  const major = Number(/^(\d+)/.exec((version.stdout ?? '').trim())?.[1] ?? 0)
  return major >= 11 ? 24 * 3600 : null
}

/**
 * 取 registry 上本包的 packument，返回 { latest, versions: [{ version, time }] }。
 * 刻意不用 `npm view`：那条路读的是 latest 标签，正好绕开我们要检查的东西。
 */
async function fetchRegistryVersions(registry) {
  const base = (registry || 'https://registry.npmjs.org/').replace(/\/+$/, '')
  const response = await fetch(`${base}/${PKG_NAME}`, { headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = await response.json()
  const versions = Object.keys(body.versions ?? {}).map((version) => ({
    version,
    time: Date.parse(body.time?.[version] ?? '') || 0,
  }))
  return { latest: body['dist-tags']?.latest ?? null, versions }
}

/** semver 的比较只需要「数字段 + 是否预发布」，不引 semver 依赖。 */
function parseVersion(version) {
  const [core, prerelease = ''] = version.split('-', 2)
  return { parts: core.split('.').map(Number), prerelease }
}

/** a > b 时返回正数。候选里已滤掉预发布，所以这里不需要处理 -beta 这类后缀。 */
function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  for (let i = 0; i < 3; i += 1) {
    const diff = (left.parts[i] ?? 0) - (right.parts[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * 报告「标签解析」与「冷静期过滤后实际会装到的版本」的差异。
 * 只在请求的是标签解析（默认 `@latest`，或只写包名）时才有意义：显式范围
 * （`^0.2.0`）与精确版本（`0.2.0`）都不受冷静期影响，能直接装到刚发布的版本。
 */
async function describeNpmResolution() {
  const spec = opts.spec || `${PKG_NAME}@latest`
  const asked = spec.startsWith(`${PKG_NAME}@`) ? spec.slice(PKG_NAME.length + 1) : spec
  if (asked !== 'latest' && asked !== PKG_NAME) return null
  let packument
  try {
    packument = await fetchRegistryVersions(opts.registry)
  } catch (error) {
    return yellow(`拿不到 registry 的版本列表（${error.message}）——跳过冷静期检查`)
  }
  const age = pnpmMinimumReleaseAgeSeconds()
  if (age === null) return null
  if (packument.latest === null) return null

  const newest = [...packument.versions].sort((a, b) => compareVersions(a.version, b.version)).at(-1) ?? null
  const newestTime = newest?.time ?? 0
  const cutoff = Date.now() - age * 1000
  const eligible = packument.versions
    .filter((entry) => entry.time !== 0 && entry.time <= cutoff && parseVersion(entry.version).prerelease === '')
    .map((entry) => entry.version)
    .sort(compareVersions)
  const selected = eligible.at(-1) ?? null
  if (selected === packument.latest) return null

  const ageHours = (age / 3600).toFixed(0)
  const ageOfNewest = newestTime === 0 ? '' : `（发布 ${((Date.now() - newestTime) / 3_600_000).toFixed(1)} 小时）`
  return yellow(`冷静期 ${ageHours}h：latest 是 ${packument.latest}${ageOfNewest}，` +
    `距上个版本不足 ${ageHours} 小时，标签解析会落到 ${selected ?? '（无可用版本）'}；` +
    `要立刻验证新版请加 --min-release-age 0，或装显式范围 ${PKG_NAME}@^${packument.latest}`)
}

// ── 各安装方式的 spec ────────────────────────────────────────────────────────

/** 从 package.json 的 repository 字段或 git remote 推 owner/repo，推不出就返回 null。 */
function gitSlug() {
  const url = typeof reader.repository === 'string' ? reader.repository : reader.repository?.url
  const match = typeof url === 'string' ? /github\.com[/:](?<slug>[^/]+\/[^/.#]+?)(?:\.git)?(?:#.*)?$/.exec(url) : null
  if (match?.groups?.slug) return match.groups.slug
  const remote = spawnSync('git', ['config', '--get', 'remote.origin.url'], { cwd: ROOT, encoding: 'utf8' })
  const fromRemote = /github\.com[/:](?<slug>[^/]+\/[^/.#]+?)(?:\.git)?$/.exec(remote.stdout?.trim() ?? '')
  return fromRemote?.groups?.slug ?? null
}

function tarballSpec() {
  const entries = existsSync(ARTIFACTS)
    ? readdirSync(ARTIFACTS).filter((name) => name.startsWith(`${PKG_NAME}-`) && name.endsWith('.tgz'))
    : []
  if (entries.length === 0) throw new Error(`没找到 tarball：${ARTIFACTS} 是空的`)
  return join(ARTIFACTS, entries[0])
}

const METHODS = {
  link: {
    profile: 'lab-link',
    title: '本地 link（开发循环用的那条路）',
    pre: () => null,
    spec: () => `link:${ROOT}`,
    expectDependency: (value) => value.startsWith('link:') || value.startsWith('file:'),
    note: 'profile 里是软链，指回工作树；构建产物一落盘就生效，不需要重装。',
  },
  tarball: {
    profile: 'lab-tarball',
    title: '本地 tarball（npm pack 彩排）',
    pre: async () => {
      const packed = await run('npm', ['pack', '--pack-destination', ARTIFACTS], { cwd: ROOT })
      if (packed.code !== 0) throw new Error(`npm pack 失败:\n${packed.stderr.trim()}`)
      return `npm pack → ${packed.stdout.trim().split('\n').pop()}`
    },
    spec: () => tarballSpec(),
    expectDependency: (value) => value.startsWith('file:'),
    note: '走 prepare 脚本重新构建，装的是包内实际文件（lib/ + cordis.patch.yml）。',
  },
  npm: {
    profile: 'lab-npm',
    title: 'npm registry（用户装的那条路）',
    pre: async () => {
      const args = ['view', PKG_NAME, 'version']
      if (opts.registry) args.push('--registry', opts.registry)
      const viewed = await run('npm', args, { cwd: ROOT })
      if (viewed.code !== 0) {
        const where = opts.registry || '默认 registry（本机是指向镜像的 ~/.npmrc）'
        throw new Error(`registry 上没有 ${PKG_NAME} —— 还没发布？当前查的是 ${where}。\n` +
          '       已发布的话加 --registry https://registry.npmjs.org/ 再看：\n' +
          viewed.stderr.trim().split('\n').slice(0, 3).map((line) => `       ${line}`).join('\n'))
      }
      const published = viewed.stdout.trim()
      const stale = published !== PKG_VERSION && !published.startsWith(`${PKG_VERSION}-`)
      const lines = [
        stale
          ? yellow(`registry 上是 ${published}，本地是 ${PKG_VERSION} —— 装到的是已发布版本，不是当前工作树`)
          : `registry 版本 ${published} 与本地一致`,
      ]
      const resolution = await describeNpmResolution()
      if (resolution !== null) lines.push(resolution)
      return lines.join('\n   ')
    },
    spec: () => opts.spec || `${PKG_NAME}@latest`,
    extraArgs: () => (opts.minReleaseAge === '' ? [] : [`--config.minimum-release-age=${opts.minReleaseAge}`]),
    env: () => (opts.registry ? { npm_config_registry: opts.registry } : {}),
    expectDependency: (value) => /^\^?\d/.test(value),
  },
  git: {
    profile: 'lab-git',
    title: 'GitHub 直装（最麻烦的一条：装依赖 + 构建）',
    pre: async () => {
      const slug = gitSlug()
      if (!slug) throw new Error('package.json 里没有可解析的 repository.github，请用 --git <spec> 指定')
      return `仓库 ${slug}`
    },
    spec: () => opts.gitSpec || `github:${gitSlug()}`,
    expectDependency: (value) => value.startsWith('github:') || value.includes('codeload.github.com'),
    note: '首次会被 pnpm 的 allowBuilds 闸门拦下，脚本抓到它要求的那一行后自动补进 profile 再重试。',
  },
}

// ── 校验 ─────────────────────────────────────────────────────────────────────

/** 1) profile 的 dsh.profile.bundles 里有本包。 */
function checkManifest(profile) {
  const manifest = profileManifest(profile)
  const bundles = manifest.dsh?.profile?.bundles ?? []
  if (!bundles.includes(PKG_NAME)) throw new Error(`dsh.profile.bundles 里没有 ${PKG_NAME}（bundles=${JSON.stringify(bundles)}）`)
  const dependency = manifest.dependencies?.[PKG_NAME]
  if (dependency === undefined) throw new Error(`package.json 的 dependencies 里没有 ${PKG_NAME}`)
  return `bundles 已追加；spec = ${dependency}`
}

/** 2) --dump-config 里出现 `# == <包名>` 层。 */
async function checkLayer(profile) {
  const dumped = await dsh(['--profile', profile, '--dump-config'])
  if (dumped.code !== 0) throw new Error(`--dump-config 失败:\n${dumped.stderr.trim()}`)
  if (!dumped.stdout.includes(`# == ${PKG_NAME}`)) throw new Error(`--dump-config 里没有 "# == ${PKG_NAME}" 层`)
  const row = /- id: ([^\n]+)\n\s+name: ([^\n]+)/g
  const hit = [...dumped.stdout.matchAll(row)].find((match) => match[2].trim() === PKG_NAME)
  return `层已挂上（id=${hit?.[1]?.trim() ?? PKG_NAME}）`
}

/** 3) profile 的 node_modules 里确实解出了本包，且 patch / 产物都在。 */
function checkResolve(profile) {
  const dir = join(profileDir(profile), 'node_modules', PKG_NAME)
  if (!existsSync(dir)) throw new Error(`node_modules/${PKG_NAME} 不存在`)
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) throw new Error(`node_modules/${PKG_NAME}/package.json 不存在`)
  const installed = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const patch = installed.dsh?.bundle?.patch
  if (patch === undefined) throw new Error('解出的包里没有 dsh.bundle.patch')
  if (!existsSync(join(dir, patch))) throw new Error(`解出的包里没有 ${patch}`)
  for (const file of ['lib/index.js', 'lib/client.js']) {
    if (!existsSync(join(dir, file))) throw new Error(`解出的包里没有 ${file}`)
  }
  if (!statSync(join(dir, 'lib/client.js')).size) throw new Error('lib/client.js 是空文件')
  const version = installed.version === PKG_VERSION ? installed.version : yellow(`${installed.version}（本地 ${PKG_VERSION}）`)
  return `解出 ${PKG_NAME}@${version}，patch + 两个半边齐全`
}

/** 4) 起一次 web，从首页的 __DSH_BOOT__ 里确认客户端半边进了 entries。 */
async function checkBoot(profile, emit = log) {
  const home = LAB_HOME
  const child = spawn(DSH_BIN, ['--profile', profile, '--no-open', '--port', '0'], {
    cwd: ROOT,
    env: { ...process.env, DSH_HOME: home },
    shell: process.platform === 'win32',
    windowsHide: true,
  })
  let output = ''
  child.stdout?.on('data', (chunk) => { output += chunk })
  child.stderr?.on('data', (chunk) => { output += chunk })

  const kill = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return
    if (process.platform === 'win32') await run('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    else child.kill('SIGTERM')
    await Promise.race([new Promise((done) => child.once('close', done)), sleep(5000)])
  }

  try {
    const deadline = Date.now() + opts.bootTimeoutMs
    let url
    while (Date.now() < deadline) {
      url = /dsh web: (?<url>http:\/\/\S+)/.exec(output)?.groups?.url
      if (url) break
      if (child.exitCode !== null) throw new Error(`dsh web 提前退出（code ${child.exitCode}）:\n${output.trim()}`)
      await sleep(400)
    }
    if (!url) throw new Error(`等 ${opts.bootTimeoutMs}ms 没等到 "dsh web: <url>"；输出:\n${output.trim()}`)

    // 首页需要一次性 token 换 cookie 再访问（`/` 无凭据是 401），所以手工跟一次重定向并带上 cookie。
    let current = url
    let cookie
    let html
    for (let hop = 0; hop < 5; hop += 1) {
      const response = await fetch(current, { redirect: 'manual', headers: cookie ? { cookie } : {} })
      cookie = response.headers.get('set-cookie')?.split(';')[0] ?? cookie
      if (response.status < 300 || response.status >= 400) {
        if (response.status !== 200) throw new Error(`首页返回 ${response.status}（${current}）`)
        html = await response.text()
        break
      }
      current = new URL(response.headers.get('location'), current).href
    }
    if (html === undefined) throw new Error('跟丢了首页重定向')

    const payload = /__DSH_BOOT__["']\]\s*=\s*(?<json>\{.*?\})\s*<\/script>/s.exec(html)?.groups?.json
    if (payload === undefined) throw new Error('首页里没有 __DSH_BOOT__ payload')
    const boot = JSON.parse(payload)
    const entry = boot.entries?.find((candidate) => candidate.id === PKG_NAME)
    if (entry === undefined) throw new Error(`__DSH_BOOT__ 的 entries 里没有 ${PKG_NAME}（客户端半边没注册）`)
    const declared = reader.dsh?.client?.inject ?? []
    const missing = declared.filter((specifier) => !(entry.inject ?? []).includes(specifier))
    if (missing.length > 0) throw new Error(`entry.inject 少了 ${missing.join(', ')}`)
    const asset = await fetch(new URL(entry.url, url), { redirect: 'manual', headers: cookie ? { cookie } : {} })
    if (asset.status !== 200) throw new Error(`客户端产物 ${entry.url} 返回 ${asset.status}`)
    const bundle = await asset.text()
    if (!bundle.includes(PKG_NAME)) throw new Error('客户端产物里没有本包 id')
    return `首页 payload 有 ${PKG_NAME}，inject ${entry.inject.length} 项齐全，产物 ${asset.status} / ${bundle.length}B`
  } finally {
    await kill()
  }
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

async function runMethod(method, emit = log) {
  const plan = METHODS[method]
  const steps = []
  const started = Date.now()
  const record = (ok, text) => {
    steps.push({ ok, text })
    emit(`   ${ok ? green('✓') : red('✗')} ${text}`)
  }

  try {
    await freshProfile(plan.profile)

    const note = await plan.pre()
    if (note) emit(dim(`   ${note}`))

    const addArgs = ['plugin', '--profile', plan.profile, 'add', plan.spec(), ...(plan.extraArgs?.() ?? [])]
    emit(dim(`   $ dsh ${addArgs.join(' ')}`))
    let installed = await dsh(addArgs, { env: plan.env?.() })
    if (installed.code !== 0) {
      const key = findAllowBuildsKey(`${installed.stdout}${installed.stderr}`)
      if (key === null) throw new Error(`安装失败:\n${installed.stderr.trim().split('\n').slice(-8).join('\n')}`)
      emit(dim('   pnpm 拦下了 git 包的构建脚本，补 allowBuilds 后重试：'))
      emit(dim(`     ${key}`))
      allowBuilds(plan.profile, key)
      installed = await dsh(addArgs, { env: plan.env?.() })
      if (installed.code !== 0) throw new Error(`补过 allowBuilds 后仍失败:\n${installed.stderr.trim().split('\n').slice(-8).join('\n')}`)
    }
    record(true, `安装完成（${(installed.ms / 1000).toFixed(1)}s）`)

    const manifest = profileManifest(plan.profile)
    const dependency = manifest.dependencies?.[PKG_NAME]
    if (!plan.expectDependency(dependency ?? '')) throw new Error(`dependencies 里的 spec 意外：${dependency}`)
    record(true, checkManifest(plan.profile))
    record(true, await checkLayer(plan.profile))
    record(true, checkResolve(plan.profile))
    if (opts.boot) record(true, await checkBoot(plan.profile, emit))
    else record(true, dim('（跳过启动检查）'))

    if (plan.note) emit(dim(`   ${plan.note}`))
    return { method, ok: true, ms: Date.now() - started, steps }
  } catch (error) {
    record(false, error.message)
    return { method, ok: false, ms: Date.now() - started, steps, error }
  }
}

async function main() {
  log(bold(`release-lab: ${PKG_NAME}@${PKG_VERSION}`))
  // 带上 dsh 版本：DSH_BIN 一换，同一份报告说的就是另一个 dsh 了，不写清楚会看串。
  const version = (await run(DSH_BIN, ['--version'])).stdout.trim().split('\n').pop()?.trim()
  log(dim(`  dsh: ${version || DSH_BIN}`))
  log(dim(`  隔离 home: ${LAB_HOME}`))
  log(dim(`  真实 home 未被触碰（DSH_HOME 已重定向）`))
  log()

  prepareLab()
  log(bold(`方式（${opts.methods.join(', ')}）`))
  log()

  const results = []
  if (opts.parallel) {
    const settled = await Promise.all(opts.methods.map(async (method) => {
      const sink = makeSink(true)
      const result = await runMethod(method, sink.emit)
      log(bold(`${method}${result.ok ? '' : ` ${red('FAIL')}`}`))
      sink.flush()
      log()
      return result
    }))
    results.push(...settled)
  } else {
    for (const method of opts.methods) {
      log(bold(`${method}`))
      results.push(await runMethod(method))
      log()
    }
  }

  log(bold('汇总'))
  for (const result of results) {
    const label = METHODS[result.method].title
    log(`  ${result.ok ? green('PASS') : red('FAIL')}  ${result.method.padEnd(8)} ${dim(label)} ${dim(`${(result.ms / 1000).toFixed(1)}s`)}`)
  }

  const failed = results.filter((result) => !result.ok)
  if (failed.length > 0) {
    log()
    log(red(`${failed.length}/${results.length} 种方式失败。`))
    if (!opts.keep) log(dim('提示：加 --keep 保留 .release-lab/，里面留着每个 profile 的 node_modules 与日志。'))
    else log(dim(`现场在 ${LAB}`))
    process.exitCode = 1
    return
  }

  log()
  log(green(`${results.length} 种方式全部通过。`))
  if (opts.keep) log(dim(`lab 保留在 ${LAB}`))
  else {
    rmSync(LAB, { recursive: true, force: true })
    log(dim('lab 已清理。'))
  }
}

await main()
