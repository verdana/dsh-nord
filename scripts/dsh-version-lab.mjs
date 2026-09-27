#!/usr/bin/env node
/**
 * dsh-version-lab —— 把第二个 dsh 版本并排装到**仓库外**，再拿它跑本仓库的探针。
 *
 * 为什么必须装在仓库外：`dsh-nord` 自己处在一个 pnpm workspace 里
 * （`pnpm-workspace.yaml` 就在仓库根）。在仓库里 `pnpm add` 会被当成往这个 workspace
 * 加依赖 —— 整棵新版本的依赖树会链接进仓库的 `node_modules`，`pnpm-lock.yaml` 被重解析
 * （传递依赖按 caret 往上跳，`npm run typecheck` 会跟着漂），而仓库真正的包管理器是 npm
 * （`package-lock.json` 是唯一入库的那份）。所以这里固定在 `~/.dsh-versions/<版本>/`：
 * 与仓库、与全局那份 `dsh` 三方互不影响。
 *
 * 装好的可执行文件与全局 `dsh` 是两个独立入口。配上不同的 `DSH_HOME` 与不同的端口，
 * 两份 dsh 可以同时在跑。仓库里的探针脚本认 `DSH_BIN` 这个环境变量。
 *
 * 用法：
 *   node scripts/dsh-version-lab.mjs 0.1.7-rc.2
 *       装好并打印可执行文件路径与手动起实例的命令。
 *   node scripts/dsh-version-lab.mjs 0.1.7-rc.2 -- node scripts/shots/verify-compat.mjs
 *       装好，带着 DSH_BIN 跑给定的命令（探针、`release-lab.mjs` 都行）。
 *   node scripts/dsh-version-lab.mjs --list
 *       列出已经装过哪些版本。
 *   node scripts/dsh-version-lab.mjs 0.1.7-rc.2 --force
 *       已经装过也重装一次。
 *
 * 依赖：`pnpm` 在 PATH 上。构建脚本（node-pty / koffi / protobufjs 这些）登记为不构建 ——
 * 探针用不到终端与原生绑定，关掉可以省一次原生编译，也让安装不必依赖本机工具链。
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PKG = '@deepseek-ai/dsh'
const LAB = join(homedir(), '.dsh-versions')
const BIN_NAME = process.platform === 'win32' ? 'dsh.cmd' : 'dsh'

const HELP = `用法: node scripts/dsh-version-lab.mjs <版本> [--force] [-- <命令> [参数...]]
      node scripts/dsh-version-lab.mjs --list

  <版本>      要并排安装的 dsh 版本，例如 0.1.7-rc.2。装到 ${LAB}\\<版本>\\
  --force     已经装过也重装一次
  --           后面的命令会带上 DSH_BIN 跑（探针脚本因此换用这个版本）
  --list      列出已经装过哪些版本
`

// ── CLI ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const sep = argv.indexOf('--')
const head = sep === -1 ? argv : argv.slice(0, sep)
const tail = sep === -1 ? [] : argv.slice(sep + 1)

if (head.includes('--help') || head.includes('-h')) {
  process.stdout.write(HELP)
  process.exit(0)
}

function fail(message) {
  process.stderr.write(`dsh-version-lab: ${message}\n`)
  process.exit(2)
}

/** lab 里某个版本的可执行文件与清单路径。 */
const dirOf = (version) => join(LAB, version)
const binOf = (version) => join(dirOf(version), 'node_modules', '.bin', BIN_NAME)
const manifestOf = (version) => join(dirOf(version), 'node_modules', ...PKG.split('/'), 'package.json')

if (head.includes('--list')) {
  const installed = existsSync(LAB)
    ? readdirSync(LAB).filter((name) => existsSync(manifestOf(name)))
    : []
  process.stdout.write(installed.length === 0
    ? `还没装过任何版本（${LAB} 是空的）\n`
    : `${LAB}\n${installed.map((v) => `  ${v}`).join('\n')}\n`)
  process.exit(0)
}

const version = (head.find((arg) => !arg.startsWith('-')) ?? '').trim()
const force = head.includes('--force')
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`需要一个明确的版本号，收到「${version}」\n       例：node scripts/dsh-version-lab.mjs 0.1.7-rc.2`)
}

// ── 小工具 ───────────────────────────────────────────────────────────────────

/** 跑一条命令，收 stdout+stderr，不抛异常。`inherit` 时让子进程直接接管终端。 */
function run(command, args, options = {}) {
  return new Promise((settle) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? LAB,
      env: options.env ?? process.env,
      shell: process.platform === 'win32',
      windowsHide: true,
      stdio: options.inherit ? 'inherit' : 'pipe',
    })
    let out = ''
    child.stdout?.on('data', (chunk) => { out += chunk })
    child.stderr?.on('data', (chunk) => { out += chunk })
    child.on('error', (error) => settle({ code: -1, out: `${out}${error.message}` }))
    child.on('close', (code) => settle({ code: code ?? -1, out }))
  })
}

/**
 * 从 pnpm 的报错里抠出被拦下的构建脚本包名。
 * 形如 `Ignored build scripts: @scope/a@1.0.0, b@2.0.0`：按逗号切开，再去掉尾部的 `@版本`。
 * 作用域包名自带一个 `@`，所以只能从**最后一个** `@` 往前砍。
 */
function ignoredBuilds(text) {
  const match = /Ignored build scripts:\s*(?<list>[^\n]+)/.exec(text)
  if (match === null) return []
  return match.groups.list
    .split(',')
    .map((entry) => entry.trim().replace(/@[^@]*$/, ''))
    .filter(Boolean)
}

/**
 * lab 自己的 `pnpm-workspace.yaml`：一来把 pnpm 的向根查找停在 lab 目录，二来登记
 * 允许 / 不允许构建的依赖。只写 `allowBuilds`，值一律 false。
 */
function writeLabWorkspace(deny) {
  const file = join(LAB, 'pnpm-workspace.yaml')
  const lines = existsSync(file)
    ? readFileSync(file, 'utf8').split('\n').map((line) => line.trimEnd())
    : ['# dsh-version-lab 的 workspace 根：把 pnpm 的向上查找停在这里，别碰仓库那一层。']
  const rows = deny.map((name) => `  '${name}': false`)
  const at = lines.findIndex((line) => /^allowBuilds:\s*$/.test(line))
  if (at === -1) {
    lines.push('allowBuilds:', ...rows)
  } else {
    for (const [offset, row] of rows.entries()) {
      if (!lines.some((line) => line.trim() === row.trim())) lines.splice(at + 1 + offset, 0, row)
    }
  }
  writeFileSync(file, `${lines.join('\n').replace(/\s*$/, '')}\n`)
}

// ── 安装 ─────────────────────────────────────────────────────────────────────

mkdirSync(LAB, { recursive: true })
writeLabWorkspace([])

const installed = existsSync(manifestOf(version)) ? JSON.parse(readFileSync(manifestOf(version), 'utf8')).version : null
if (installed === version && !force) {
  process.stdout.write(`已经有了：${PKG}@${version}\n`)
} else {
  const dir = dirOf(version)
  mkdirSync(dir, { recursive: true })
  if (!existsSync(join(dir, 'package.json'))) {
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ name: 'dsh-version-lab', private: true }, null, 2)}\n`)
  }
  process.stdout.write(`装 ${PKG}@${version} → ${dir}\n`)
  let added = await run('pnpm', ['add', '--dir', dir, `${PKG}@${version}`])
  if (added.code !== 0) {
    const blocked = ignoredBuilds(added.out)
    if (blocked.length === 0) fail(`安装失败:\n${added.out.trim().split('\n').slice(-12).join('\n')}`)
    process.stdout.write(`  pnpm 拦下了 ${blocked.join(', ')} 的构建脚本，登记为 false 后重试\n`)
    writeLabWorkspace(blocked)
    added = await run('pnpm', ['add', '--dir', dir, `${PKG}@${version}`])
    if (added.code !== 0) fail(`登记构建脚本后仍失败:\n${added.out.trim().split('\n').slice(-12).join('\n')}`)
  }
  const got = existsSync(manifestOf(version)) ? JSON.parse(readFileSync(manifestOf(version), 'utf8')).version : null
  if (got !== version) fail(`装完解出的是 ${got ?? '（没有）'}，不是 ${version}`)
}

const bin = binOf(version)
if (!existsSync(bin)) fail(`没找到可执行文件 ${bin}`)

// ── 可选：带着 DSH_BIN 跑后面的命令 ──────────────────────────────────────────

if (tail.length === 0) {
  process.stdout.write([
    '',
    `DSH_BIN=${bin}`,
    '',
    '手动并排起一份实例（本机那份 GUI 在 3080 上，两份互不影响）：',
    `  $env:DSH_HOME = "$env:USERPROFILE\\.dsh-${version}"`,
    `  & "${bin}" --port 3180`,
    '',
    '拿它跑本仓库的探针：',
    `  node scripts/dsh-version-lab.mjs ${version} -- node scripts/shots/verify-compat.mjs`,
    '',
  ].join('\n'))
  process.exit(0)
}

const [command, ...rest] = tail
const settled = await run(command, rest, { cwd: process.cwd(), env: { ...process.env, DSH_BIN: bin }, inherit: true })
process.exit(settled.code)
