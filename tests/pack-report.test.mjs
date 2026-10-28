/**
 * `npm pack --json` 解析的规格。
 *
 * 这份规格存在的理由和第 4 道闸门一样：那是发版当天才跑的代码，形状一变就报
 * SyntaxError，而错误信息完全指不到 npm 版本上。npm 10 吐以包名为键的对象，
 * npm 11 吐数组 —— 两种都得认。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePackReport } from '../scripts/pack-report.mjs'

const report = {
  name: 'dsh-nord',
  version: '0.4.1',
  filename: 'dsh-nord-0.4.1.tgz',
  files: [{ path: 'package.json' }, { path: 'CHANGELOG.md' }],
}

test('npm 10 形状：以包名为键的对象', () => {
  const parsed = parsePackReport(JSON.stringify({ 'dsh-nord': report }), 'dsh-nord')
  assert.deepEqual(parsed.files.map((file) => file.path), ['package.json', 'CHANGELOG.md'])
})

test('npm 11 形状：数组', () => {
  const parsed = parsePackReport(JSON.stringify([report]), 'dsh-nord')
  assert.equal(parsed.version, '0.4.1')
})

test('前面混进构建日志时仍然能找到 JSON', () => {
  const stdout = `> dsh-nord@0.4.1 build\n> tsdown\n\n[build] 4 files\n${JSON.stringify([report])}\n`
  assert.equal(parsePackReport(stdout, 'dsh-nord').filename, 'dsh-nord-0.4.1.tgz')
})

test('没有 JSON、JSON 坏了、或没有 files 时抛出可读的错误', () => {
  assert.throws(() => parsePackReport('nothing here', 'dsh-nord'), /没吐出 JSON/)
  assert.throws(() => parsePackReport('[{"name":', 'dsh-nord'), /解析失败/)
  assert.throws(() => parsePackReport('[{"name":"dsh-nord"}]', 'dsh-nord'), /没有 dsh-nord 的 files/)
})