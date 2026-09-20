/** Settings namespace, composition defaults, and config type shared by both halves. */

/** Namespace owning this plugin's settings; also the settings-row key. */
export const NS = 'dsh-nord'

/** Balance endpoint path served by the Host half. */
export const BALANCE_PATH = '/nord/balance'

/** Plugin configuration: composition defaults, overridable from the settings row. */
export interface Config {
  /** Fold the Nord token layer over the active base palette. */
  themeEnabled: boolean
  /** Fold the Maple Mono font stacks over the active base palette. */
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
  balanceEnabled: true,
  refreshSeconds: 60,
  baseURL: 'https://api.deepseek.com',
}
