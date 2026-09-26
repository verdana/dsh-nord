// The font resolver, run against the built `lib/fonts.js`.
//
// Two of its inputs are user-typed text that ends up inside a `<style>` rule, so
// the parsing is the part under test: what survives into the stylesheet, and what
// never does. The rest checks that each stored choice still resolves to a usable
// stack — an empty or truncated declaration is the failure mode that would leave
// code blocks in a proportional font with nothing on screen explaining why.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_FONT,
  FONT_PRESETS,
  INHERIT_FONT,
  isPreset,
  fontStacks,
  parseFamilies,
  presetPreview,
  SYSTEM_CODE_FONT,
  SYSTEM_FONT,
  SYSTEM_UI_FONT,
} from '../lib/fonts.js'

/** One stored preference, with the fields a test does not care about at rest. */
const config = (over = {}) => ({
  uiFont: 'maple',
  uiFontCustom: '',
  codeFont: 'maple',
  codeFontCustom: '',
  ...over,
})

test('the shipped default keeps Maple Mono on both tokens', () => {
  const { ui, code } = fontStacks(config())
  for (const stack of [ui, code]) {
    assert.match(stack, /^'Maple Mono', 'Maple Mono NF CN', /)
  }
  // The two roles still fall back differently: the interface to the platform UI
  // face, code to the platform monospace face.
  assert.match(ui, /ui-sans-serif/)
  assert.match(ui, /sans-serif$/)
  assert.match(code, /ui-monospace/)
  assert.doesNotMatch(code, /ui-sans-serif/)
})

test('system is the upstream stack, character for character', () => {
  const { ui, code } = fontStacks(config({ uiFont: SYSTEM_FONT, codeFont: SYSTEM_FONT }))
  assert.equal(ui, SYSTEM_UI_FONT)
  assert.equal(code, SYSTEM_CODE_FONT)
})

test('inherit hands the code token the interface stack it resolved to', () => {
  const { ui, code } = fontStacks(config({ codeFont: INHERIT_FONT }))
  assert.equal(code, ui)
  const custom = fontStacks(config({ uiFont: CUSTOM_FONT, uiFontCustom: 'JetBrains Mono', codeFont: INHERIT_FONT }))
  assert.equal(custom.code, custom.ui)
  assert.match(custom.code, /^'JetBrains Mono', /)
})

test('a preset resolves to its families, then the role tail', () => {
  const { code } = fontStacks(config({ codeFont: 'cascadia' }))
  assert.match(code, /^'Cascadia Code', 'Cascadia Mono', ui-monospace, /)
})

test('an unknown preset id is read as the custom list it must have been', () => {
  const { ui } = fontStacks(config({ uiFont: 'a-preset-from-a-newer-build', uiFontCustom: 'MiSans' }))
  assert.match(ui, /^'MiSans', /)
})

test('a custom list is rebuilt from its accepted names', () => {
  const { ui } = fontStacks(config({ uiFont: CUSTOM_FONT, uiFontCustom: ' "LXGW WenKai" , Microsoft YaHei ' }))
  assert.match(ui, /^'LXGW WenKai', 'Microsoft YaHei', /)
})

test('an empty custom list still leaves a usable stack', () => {
  const { ui, code } = fontStacks(config({ uiFont: CUSTOM_FONT, codeFont: CUSTOM_FONT }))
  assert.equal(ui.includes("'"), true)
  assert.match(ui, /sans-serif$/)
  assert.match(code, /ui-monospace/)
  assert.equal(code.includes('Maple Mono'), false)
})

test('quotes are stripped once, in either style', () => {
  assert.deepEqual(parseFamilies("'Maple Mono', \"Fira Code\""), ['Maple Mono', 'Fira Code'])
  assert.deepEqual(parseFamilies("''Maple Mono''"), ['Maple Mono'])
  assert.deepEqual(parseFamilies("'unclosed"), ['unclosed'])
})

test('a name carrying a CSS-significant character is dropped, not escaped', () => {
  for (const hostile of ['Evil; }', 'html{color:red}', 'a}b', 'url(evil)', '@import x', 'a!b', '#id', 'a/*b*/', 'a\\b']) {
    assert.deepEqual(parseFamilies(hostile), [], hostile)
  }
})

test('one bad entry does not discard the rest of the list', () => {
  assert.deepEqual(parseFamilies('Good, bad{name}, Also Good'), ['Good', 'Also Good'])
})

test('no resolved stack can close the rule it is written into', () => {
  const hostile = 'x}, html{--pwn:1; }'
  const { ui, code } = fontStacks(config({
    uiFont: CUSTOM_FONT,
    uiFontCustom: hostile,
    codeFont: CUSTOM_FONT,
    codeFontCustom: hostile,
  }))
  for (const stack of [ui, code]) {
    assert.doesNotMatch(stack, /[;{}]/)
  }
})

test('a generic family stays unquoted, so it still resolves', () => {
  assert.deepEqual(parseFamilies('sans-serif, monospace'), ['sans-serif', 'monospace'])
  const { ui } = fontStacks(config({ uiFont: CUSTOM_FONT, uiFontCustom: 'Maple Mono, sans-serif' }))
  assert.match(ui, /'Maple Mono', sans-serif, /)
  assert.doesNotMatch(ui, /'sans-serif'/)
})

test('CJK, accented and hyphen-leading names survive', () => {
  assert.deepEqual(parseFamilies('更纱黑体, LXGW WenKai, -apple-system, Émigré'), [
    '更纱黑体', 'LXGW WenKai', '-apple-system', 'Émigré',
  ])
})

test('the list is deduplicated and capped', () => {
  assert.deepEqual(parseFamilies('A, A, a, A'), ['A', 'a'])
  const many = Array.from({ length: 20 }, (_, index) => `F${index}`).join(', ')
  assert.equal(parseFamilies(many).length, 12)
})

test('an over-long list is read up to its character cap', () => {
  const names = parseFamilies(`Maple Mono, ${'x'.repeat(400)}`)
  assert.equal(names[0], 'Maple Mono')
  assert.ok(names[1].length <= 240)
  assert.ok(names.length <= 12)
})

test('every offered preset resolves to a non-empty stack in both roles', () => {
  for (const preset of FONT_PRESETS) {
    for (const role of ['ui', 'code']) {
      const preview = presetPreview(preset.id, role)
      assert.notEqual(preview, '', `${preset.id}/${role}`)
      assert.equal(preview.includes('undefined'), false, `${preset.id}/${role}`)
    }
    assert.notEqual(fontStacks(config({ uiFont: preset.id, codeFont: preset.id })).ui, '')
  }
})

test('a non-preset row has no specimen stack of its own', () => {
  assert.equal(presetPreview(SYSTEM_FONT, 'ui'), '')
  assert.equal(presetPreview(CUSTOM_FONT, 'ui'), '')
  assert.equal(isPreset(SYSTEM_FONT), false)
  assert.equal(isPreset('cascadia'), true)
})
