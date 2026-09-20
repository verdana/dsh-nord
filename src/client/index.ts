/**
 * Browser half: folds the Nord token layer over the active base palette,
 * replaces both font stacks, contributes the plugin-configuration card, and
 * polls the Host balance route for the readout under the composer.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { isBalanceFailure, type BalanceFailure, type BalancePayload } from '../balance.ts'
import { BALANCE_PATH, DEFAULTS, NS, type Config } from '../config.ts'
import { BalanceBar } from './BalanceBar.tsx'
import { en, LOCALE_NS, zh } from './locales.ts'
import { FONT_STYLE_ID, fontStylesheet, nordTokens, SURFACE_STYLE_ID, surfaceStylesheet, TOKEN_SOURCE } from './nord.ts'
import { NordCard } from './NordCard.tsx'
import { createNordBalanceStore, createNordSettingsStore } from './stores.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Nord plugin card and balance-bar copy. */
    dshNord: import('./locales.ts').NordKey
  }
}

/** Required services: the theme registry, slots, copy, and the durable settings scope. */
export const inject = ['theme', 'slots', 'locale', 'settingsScope']

/** Nord preference-row order inside the General section. */
const ROW_ORDER = 20

/** Balance-bar order among the composer dock entries. */
const BAR_ORDER = 10

/**
 * Mount the theme layer, the font stacks, the settings card, and the balance bar.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const scope = ctx.settingsScope.bind<Config>({ namespace: NS })
  const settingsStore = createNordSettingsStore()
  const balanceStore = createNordBalanceStore()

  /** Durable section folded over the composition defaults. */
  const effective = (): Config => ({ ...DEFAULTS, ...scope.getSnapshot().value })

  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-nord: dictionaries')

  // Font stacks ride one `:root` rule: every composite family is declared there
  // as `var(--dsw-font-family)`, so a body-level token override cannot reach it.
  ctx.effect(() => {
    const element = document.createElement('style')
    element.id = FONT_STYLE_ID
    document.head.append(element)
    const sync = (): void => { element.textContent = effective().fontEnabled ? fontStylesheet() : '' }
    const unsubscribe = scope.subscribe(sync)
    sync()
    return () => { unsubscribe(); element.remove() }
  }, 'dsh-nord: font stacks')

  // A second `<style>` carries the balance surfaces: the dock row that puts the
  // readout beside the shipped stats pill, the readout's own skin, and its
  // panel. See `surfaceStylesheet` for why they are not inline styles.
  ctx.effect(() => {
    const element = document.createElement('style')
    element.id = SURFACE_STYLE_ID
    element.textContent = surfaceStylesheet()
    document.head.append(element)
    return () => { element.remove() }
  }, 'dsh-nord: balance surfaces')

  // The colour layer, folded over whichever base palette is active.
  ctx.effect(() => {
    let applied: (() => void) | undefined
    const sync = (): void => {
      applied?.()
      applied = undefined
      if (effective().themeEnabled) applied = ctx.theme.overrideTokens(TOKEN_SOURCE, nordTokens())
    }
    const unsubscribe = scope.subscribe(sync)
    sync()
    return () => { unsubscribe(); applied?.() }
  }, 'dsh-nord: nord tokens')

  // Settings-card mirror.
  let settingsBound: BoundActions<typeof settingsStore> | undefined
  const syncSettings = (): void => {
    const snapshot = scope.getSnapshot()
    settingsBound?.sync(
      { ...DEFAULTS, ...snapshot.value },
      snapshot.revision ?? -1,
      snapshot.writable,
      snapshot.status !== 'unavailable',
    )
  }
  ctx.effect(() => {
    const unsubscribe = scope.subscribe(syncSettings)
    syncSettings()
    return unsubscribe
  }, 'dsh-nord: settings mirror')

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: NS,
    order: ROW_ORDER,
    locale: LOCALE_NS,
    store: settingsStore,
    inject: (actions: BoundActions<typeof settingsStore>) => {
      settingsBound = actions
      syncSettings()
      return {
        save: (field: string, value: unknown): void => {
          void scope.set(field, value).catch((cause: unknown) => {
            settingsBound?.failed(cause instanceof Error ? cause.message : String(cause))
          })
        },
      }
    },
  }, NordCard))

  // Balance polling. The bar binds its actions when the slot declares, which
  // can land after this effect runs, so the restart hooks are shared.
  let balanceBound: BoundActions<typeof balanceStore> | undefined
  /** Restart only when a field the poll reads has actually moved. */
  let syncBalance = (): void => {}
  /** Restart unconditionally, for the first read the bar can receive. */
  let bindBalance = (): void => {}

  ctx.effect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    let generation = 0
    let applied: Config | undefined
    const stop = (): void => {
      if (timer === undefined) return
      clearInterval(timer)
      timer = undefined
    }

    const refresh = async (): Promise<void> => {
      const mine = ++generation
      balanceBound?.loading()
      try {
        const response = await fetch(BALANCE_PATH, { headers: { accept: 'application/json' } })
        const body = await response.json() as BalancePayload | BalanceFailure
        if (mine !== generation) return
        if (isBalanceFailure(body)) balanceBound?.failed(body.error)
        else balanceBound?.ready(body)
      } catch {
        // Any transport failure is one user-visible outcome; the Host route
        // already reports upstream failures as `upstream-failed` payloads.
        if (mine === generation) balanceBound?.failed('request-failed')
      }
    }

    const start = (value: Config): void => {
      stop()
      if (!value.balanceEnabled) {
        balanceBound?.clear()
        return
      }
      void refresh()
      timer = setInterval(() => { void refresh() }, value.refreshSeconds * 1000)
    }

    // One accepted write publishes twice (the optimistic value, then the Host's
    // confirmed one), and a theme or font write touches no field the poll reads.
    // Comparing against the last applied config keeps both from re-querying
    // upstream.
    syncBalance = (): void => {
      const value = effective()
      if (applied !== undefined
        && applied.balanceEnabled === value.balanceEnabled
        && applied.refreshSeconds === value.refreshSeconds
        && applied.baseURL === value.baseURL) return
      applied = value
      start(value)
    }

    // The initial read is issued before the bar can bind its actions, so its
    // result has nowhere to land; the bind issues the one that counts.
    bindBalance = (): void => {
      const value = effective()
      applied = value
      start(value)
    }

    const unsubscribe = scope.subscribe(syncBalance)
    syncBalance()
    return () => {
      unsubscribe()
      stop()
      generation += 1
      syncBalance = () => {}
      bindBalance = () => {}
    }
  }, 'dsh-nord: balance polling')

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'nord-balance',
    order: BAR_ORDER,
    locale: LOCALE_NS,
    store: balanceStore,
    inject: (_sessionId, actions: BoundActions<typeof balanceStore>) => {
      balanceBound = actions
      bindBalance()
      return {}
    },
  }, BalanceBar))
}
