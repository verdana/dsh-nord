/** Settings namespace, composition defaults, and config type shared by both halves. */

/** Namespace owning this plugin's settings; also the settings-row key. */
export const NS = 'dsh-nord'

/** Balance endpoint path served by the Host half. */
export const BALANCE_PATH = '/nord/balance'

/**
 * The four stored fields one font preference is made of. Split out from
 * {@link Config} so `fonts.ts` can take exactly these and nothing else.
 */
export interface FontConfig {
  /** Interface stack: `system`, a preset id, or `custom`. See `fonts.ts`. */
  uiFont: string
  /** Raw family list backing `uiFont === 'custom'`. */
  uiFontCustom: string
  /** Code stack: a preset id, `system`, `inherit`, or `custom`. */
  codeFont: string
  /** Raw family list backing `codeFont === 'custom'`. */
  codeFontCustom: string
}

/** Plugin configuration: composition defaults, overridable from the settings row. */
export interface Config extends FontConfig {
  /** Fold the Nord token layer over the active base palette. */
  themeEnabled: boolean
  /** Fold this plugin's font stacks over the active base palette at all. */
  fontEnabled: boolean
  /** Serve and display the account balance readout. */
  balanceEnabled: boolean
  /** Balance refresh interval in seconds. */
  refreshSeconds: number
  /** DeepSeek API origin used for the balance request. */
  baseURL: string
}

/** Composition defaults, shared by the Host schema and the browser half's pre-load state. */
export const DEFAULTS: Config = {
  themeEnabled: true,
  fontEnabled: true,
  // Maple Mono on both tokens is what this plugin shipped before the choice
  // existed, so a document written back then keeps rendering as it did — code
  // included, which `inherit` would not: the interface tail is proportional.
  uiFont: 'maple',
  uiFontCustom: '',
  codeFont: 'maple',
  codeFontCustom: '',
  balanceEnabled: true,
  refreshSeconds: 60,
  baseURL: 'https://api.deepseek.com',
}
