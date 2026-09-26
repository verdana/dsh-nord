/**
 * Font catalog and resolver: the preset families the settings row offers, the
 * fallback tails every stack ends with, and the one function that turns a stored
 * preference into the two CSS family lists.
 *
 * Free of the DOM and of React, so the Node build emits it on its own and
 * `npm test` drives it directly — the split `balance.ts` and `usage.ts` already
 * use. It earns that split more than either of them: a family list is
 * user-typed text that ends up inside a stylesheet, so the parsing below is a
 * boundary rather than a formatting detail. Nothing typed is ever interpolated
 * verbatim — {@link parseFamilies} rebuilds the list out of names that pass an
 * allowlist and drops the rest, so a stored value cannot close the `:root` rule
 * it is written into. The two tails are literals this module owns, not input.
 */
import type { FontConfig } from './config.ts'
import type { NordKey } from './client/locales.ts'

/** Stored choice: the upstream `base.css` stacks, left exactly as they ship. */
export const SYSTEM_FONT = 'system'

/** Stored choice: whatever the sibling `<role>FontCustom` field holds. */
export const CUSTOM_FONT = 'custom'

/** Code-only choice: the stack the interface resolved to, tail and all. */
export const INHERIT_FONT = 'inherit'

/**
 * Upstream `base.css` interface stack, verbatim — the `system` choice, and the
 * stack this plugin leaves in place when its font layer is off.
 */
export const SYSTEM_UI_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', "
  + "'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif"

/** Upstream `base.css` code stack, verbatim. */
export const SYSTEM_CODE_FONT = "'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, "
  + "'Liberation Mono', Menlo, Courier, 'PingFang SC', 'Microsoft YaHei'"

/**
 * Tail every interface stack ends with: the platform UI faces, then the CJK
 * ones, then `sans-serif`.
 *
 * A chosen family with no Chinese coverage still has to render Chinese, and a
 * machine that has none of the chosen families still has to render at all — so
 * this is the platform's own UI face first, never a bare `serif`, which would
 * take the whole interface somewhere the user did not ask for.
 */
const UI_TAIL = "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', "
  + "'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif"

/**
 * Tail every code stack ends with: the platform monospace faces the upstream
 * code stack already trusts, then the CJK ones.
 *
 * The bare `monospace` generic is deliberately absent for the reason
 * `base.css` records for the upstream stack — on Windows its CJK fallback is
 * SimSun. `ui-monospace` is not that generic: it names the platform's own UI
 * monospace face, and it is what upstream falls back to.
 */
const CODE_TAIL = "ui-monospace, 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, "
  + "'Liberation Mono', Menlo, Courier, 'PingFang SC', 'Microsoft YaHei'"

/**
 * Names a stylesheet has to leave unquoted. Quoting a generic family turns it
 * from a keyword into a family-name lookup that matches nothing —
 * `font-family: 'sans-serif'` is a silent no-op — and `sans-serif` is exactly
 * what users type by hand in the custom field.
 */
const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji',
  'fangsong', 'inherit', 'initial', 'unset', 'revert', 'revert-layer',
])

/**
 * How one family name may be spelled in the custom field: a letter, digit, dot,
 * underscore, plus, hyphen or non-ASCII character to start, then those plus
 * spaces.
 *
 * Every CSS-significant character sits outside that class — `;`, `{`, `}`,
 * `"`, `'`, backslash, parentheses, `@`, `!`, `#`, `/` and `*` are all below
 * U+00C0 — so a name able to close the rule it is written into never survives
 * the test. CJK, accented Latin and full-width forms are above it and pass.
 */
const FAMILY_NAME = /^[A-Za-z0-9._+\-\u00C0-\uFFFF][A-Za-z0-9 ._+\-\u00C0-\uFFFF]*$/

/** Longest custom list accepted, counted in characters. */
const CUSTOM_MAX_LENGTH = 240

/** Most names one custom list may contribute. */
const CUSTOM_MAX_FAMILIES = 12

/**
 * Rebuild a user-typed family list out of its accepted names.
 *
 * Splitting on commas is enough: one layer of surrounding quotes is stripped,
 * and a name carrying anything outside {@link FAMILY_NAME} is dropped on its
 * own rather than escaped or failing the whole list, so one bad entry does not
 * throw away the rest of what the user wrote.
 * @param input - the raw stored string.
 * @returns the accepted names in order, deduplicated, possibly empty.
 */
export function parseFamilies(input: string): string[] {
  const names: string[] = []
  for (const part of input.slice(0, CUSTOM_MAX_LENGTH).split(',')) {
    const name = part.trim().replace(/^["']+|["']+$/g, '').trim()
    if (name === '' || !FAMILY_NAME.test(name) || names.includes(name)) continue
    names.push(name)
    if (names.length === CUSTOM_MAX_FAMILIES) break
  }
  return names
}

/**
 * Render one already-validated family name as CSS text.
 * @param name - a preset family or a name from {@link parseFamilies}.
 * @returns the name, quoted unless it is a generic family keyword.
 */
function serialize(name: string): string {
  return GENERIC_FAMILIES.has(name.toLowerCase()) ? name.toLowerCase() : `'${name}'`
}

/**
 * Join family names into one CSS list.
 * @param names - validated names, in preference order.
 * @returns comma-separated CSS text, empty when there are no names.
 */
function familyList(names: readonly string[]): string {
  return names.map(serialize).join(', ')
}

/** One selectable stack in the settings menu. */
export interface FontPreset {
  /** Stored value, and the menu row id. */
  readonly id: string
  /** Locale key for the row label. */
  readonly label: NordKey
  /** Families tried in order, ahead of the role's own tail. */
  readonly families: readonly string[]
}

/**
 * The offered stacks. Every entry is a family list rather than a single name: a
 * machine missing the first family keeps reading in the next one instead of
 * dropping to the browser default, which is what makes a preset safe to pick
 * without knowing what is installed.
 *
 * `maple` leads because it is what this plugin shipped before the choice
 * existed; the rest are ordered by how common they are among the editors and
 * terminals this GUI sits next to.
 */
export const FONT_PRESETS: readonly FontPreset[] = [
  { id: 'maple', label: 'font.maple', families: ['Maple Mono', 'Maple Mono NF CN'] },
  { id: 'jetbrains', label: 'font.jetbrains', families: ['JetBrains Mono'] },
  { id: 'cascadia', label: 'font.cascadia', families: ['Cascadia Code', 'Cascadia Mono'] },
  { id: 'fira', label: 'font.fira', families: ['Fira Code', 'Fira Mono'] },
  { id: 'sarasa', label: 'font.sarasa', families: ['Sarasa Gothic SC', 'Sarasa UI SC', 'Sarasa Mono SC'] },
  { id: 'lxgw', label: 'font.lxgw', families: ['LXGW WenKai', 'LXGW WenKai Screen'] },
  { id: 'harmony', label: 'font.harmony', families: ['HarmonyOS Sans SC', 'HarmonyOS Sans'] },
  { id: 'misans', label: 'font.misans', families: ['MiSans'] },
]

/**
 * Whether a stored value names a preset this build still offers.
 * @param id - stored choice.
 * @returns true for a known preset id.
 */
export function isPreset(id: string): boolean {
  return FONT_PRESETS.some(entry => entry.id === id)
}

/**
 * Resolve one role's stack: the preset behind the choice, the custom list when
 * the choice is `custom` — or when it is an id this build does not know, which
 * is what a document written by a newer version, or a hand-edited
 * `settings.yaml`, looks like — followed by the role's own tail.
 * @param choice - stored choice.
 * @param custom - the raw companion string, read only outside the preset set.
 * @param tail - the role's own fallback tail.
 * @returns one complete family list.
 */
function resolve(choice: string, custom: string, tail: string): string {
  const preset = FONT_PRESETS.find(entry => entry.id === choice)
  const leading = familyList(preset === undefined ? parseFamilies(custom) : preset.families)
  // A custom list that validated down to nothing still leaves a usable stack
  // rather than an empty declaration, which would drop the role to the browser
  // default with no trace of why.
  return leading === '' ? tail : `${leading}, ${tail}`
}

/** The two family lists one stored font preference resolves to. */
export interface FontStacks {
  /** Value for `--dsw-font-family`. */
  readonly ui: string
  /** Value for `--ds-font-family-code`. */
  readonly code: string
}

/**
 * Resolve both font tokens from one settings section.
 * @param config - the four stored font fields.
 * @returns both family lists; neither is ever empty.
 */
export function fontStacks(config: FontConfig): FontStacks {
  const ui = config.uiFont === SYSTEM_FONT
    ? SYSTEM_UI_FONT
    : resolve(config.uiFont, config.uiFontCustom, UI_TAIL)
  // `inherit` is literal: the code token becomes the stack the interface
  // resolved to, tail included. That is what 「跟随界面字体」 promises — a user
  // who wants code to fall back to a monospace face picks one from the menu.
  const code = config.codeFont === INHERIT_FONT ? ui
    : config.codeFont === SYSTEM_FONT ? SYSTEM_CODE_FONT
      : resolve(config.codeFont, config.codeFontCustom, CODE_TAIL)
  return { ui, code }
}

/**
 * The stack one menu row previews in: the preset's own families plus the role's
 * tail, so the row shows what picking it would actually produce — including the
 * fallback a machine without that family would read instead.
 * @param id - preset id.
 * @param role - which token the row selects, and so which tail applies.
 * @returns a family list for the row's label, or `''` for a non-preset id.
 */
export function presetPreview(id: string, role: 'ui' | 'code'): string {
  const preset = FONT_PRESETS.find(entry => entry.id === id)
  if (preset === undefined) return ''
  return `${familyList(preset.families)}, ${role === 'ui' ? UI_TAIL : CODE_TAIL}`
}
