/**
 * Slot stores for this plugin's two surfaces. The apply-world effect is the only
 * writer; components read through `props.useStore`.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import { DEFAULTS, type Config } from '../config.ts'
import type { BalancePayload } from '../balance.ts'

/** Settings-card state mirrored from this plugin's durable scope. */
export interface NordSettingsState extends Config {
  /** Scope revision; -1 until the first sync so revision 0 lands as a change. */
  revision: number
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Whether the Host serves this namespace at all. */
  served: boolean
  /** Failure code of the last rejected write, empty otherwise. */
  error: string
}

/** Declared write surface of the settings card. */
type NordSettingsActions = {
  sync: (draft: NordSettingsState, value: Config, revision: number, writable: boolean, served: boolean) => void
  failed: (draft: NordSettingsState, error: string) => void
}

/**
 * Declares the settings-card state and write surface.
 * @returns the store handle.
 */
export function createNordSettingsStore(): EngineStoreHandle<NordSettingsState, NordSettingsActions> {
  return defineStore({
    init: (): NordSettingsState => ({ ...DEFAULTS, revision: -1, writable: false, served: false, error: '' }),
    actions: {
      sync: (d, value, revision, writable, served) => {
        if (revision < d.revision) return
        Object.assign(d, value)
        d.revision = revision
        d.writable = writable
        d.served = served
        d.error = ''
      },
      failed: (d, error) => { d.error = error },
    },
  })
}

/** Sync phase of the balance bar. */
export type BalancePhase = 'idle' | 'loading' | 'ready' | 'error'

/** Balance-bar state mirrored from the Host route. */
export interface NordBalanceState {
  phase: BalancePhase
  currency: string
  total: string
  /** Granted (promotional) part of the balance. */
  granted: string
  /** Topped-up part of the balance. */
  toppedUp: string
  available: boolean
  /** Epoch milliseconds of the read the bar is showing; 0 before the first success. */
  fetchedAt: number
  /** Failure code resolved through the `error.*` dictionary keys. */
  error: string
  /**
   * Balance endpoint the poll is configured against. The panel's usage link
   * falls back to it when the Session carries no model selection, so the
   * endpoint travels with the reading rather than with the settings page.
   */
  baseURL: string
}

/** Declared write surface of the balance bar. */
type NordBalanceActions = {
  clear: (draft: NordBalanceState) => void
  endpoint: (draft: NordBalanceState, baseURL: string) => void
  loading: (draft: NordBalanceState) => void
  ready: (draft: NordBalanceState, payload: BalancePayload) => void
  failed: (draft: NordBalanceState, error: string) => void
}

/**
 * Declares the balance-bar state and write surface.
 * @returns the store handle.
 */
export function createNordBalanceStore(): EngineStoreHandle<NordBalanceState, NordBalanceActions> {
  return defineStore({
    init: (): NordBalanceState => ({
      phase: 'idle',
      currency: 'CNY',
      total: '0',
      granted: '0',
      toppedUp: '0',
      available: true,
      fetchedAt: 0,
      error: '',
      baseURL: DEFAULTS.baseURL,
    }),
    actions: {
      clear: (d) => { d.phase = 'idle'; d.error = '' },
      endpoint: (d, baseURL) => { d.baseURL = baseURL },
      // A refresh keeps the last reading on screen — the bar is a status strip,
      // and swapping the numbers for a pending label every interval would blank
      // an open panel. Only a first load, or one after a failure, is pending.
      loading: (d) => {
        if (d.phase !== 'ready') d.phase = 'loading'
        d.error = ''
      },
      ready: (d, payload) => {
        d.phase = 'ready'
        d.currency = payload.currency
        d.total = payload.total
        d.granted = payload.granted
        d.toppedUp = payload.toppedUp
        d.available = payload.available
        d.fetchedAt = payload.fetchedAt
        d.error = ''
      },
      failed: (d, error) => { d.phase = 'error'; d.error = error },
    },
  })
}
