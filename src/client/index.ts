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
import { FONT_STYLE_ID, fontStylesheet, nordTokens, SURFACE_STYLE_ID, surfaceStylesheet, TABLE_STYLE_ID, tableStylesheet, TOKEN_SOURCE } from './nord.ts'
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

/** Deadline for one balance read; the Host answers well inside it. */
const REQUEST_TIMEOUT_MS = 20_000

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

  // A third `<style>` restores ordinary scrolling on wide markdown tables:
  // upstream's hover-triggered reserve moves the wrapper out from under the
  // pointer. See `tableStylesheet`.
  ctx.effect(() => {
    const element = document.createElement('style')
    element.id = TABLE_STYLE_ID
    element.textContent = tableStylesheet()
    document.head.append(element)
    return () => { element.remove() }
  }, 'dsh-nord: wide-table scroll patch')

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
  //
  // The dock is session-scoped and every Session owns its own store instance, so
  // the poll keeps one writer per Session and publishes into all of them. A
  // single handle is not enough: the renderer caches an entry's inject result per
  // (entry × scope binding), so returning to an already-visited Session does NOT
  // run `inject` again — one handle would keep writing into the Session left
  // behind and freeze the readout the user is actually looking at.
  const balanceWriters = new Map<string, BoundActions<typeof balanceStore>>()
  /** Restart only when a field the poll reads has actually moved. */
  let syncBalance = (): void => {}
  /** Restart unconditionally, for the first read a newly bound readout can receive. */
  let bindBalance = (): void => {}

  ctx.effect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    /** Request counter, and the newest request whose result has been applied. */
    let sequence = 0
    let landed = 0
    let applied: Config | undefined
    const stop = (): void => {
      if (timer === undefined) return
      clearInterval(timer)
      timer = undefined
    }

    /** Fan one update out to every Session's readout. */
    const publish = (write: (actions: BoundActions<typeof balanceStore>) => void): void => {
      for (const actions of balanceWriters.values()) write(actions)
    }

    const refresh = async (): Promise<void> => {
      const mine = ++sequence
      publish(actions => { actions.loading() })
      try {
        const response = await fetch(BALANCE_PATH, {
          headers: { accept: 'application/json' },
          // A hung Host route would otherwise leave this read pending forever.
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        const body = await response.json().catch(() => undefined) as BalancePayload | BalanceFailure | undefined
        // Only a result that a NEWER request already superseded is dropped.
        // Dropping every read the next tick had merely started froze the readout
        // for as long as responses stayed slower than the interval.
        if (mine <= landed) return
        landed = mine
        if (body === undefined) publish(actions => { actions.failed('request-failed') })
        else if (isBalanceFailure(body)) publish(actions => { actions.failed(body.error) })
        else publish(actions => { actions.ready(body) })
      } catch {
        // Any transport failure is one user-visible outcome; the Host route
        // already reports upstream failures as `upstream-failed` payloads.
        if (mine <= landed) return
        landed = mine
        publish(actions => { actions.failed('request-failed') })
      }
    }

    const start = (value: Config): void => {
      stop()
      // The endpoint travels with the reading: the panel's usage link falls
      // back to it when the Session carries no model selection.
      publish(actions => { actions.endpoint(value.baseURL) })
      if (!value.balanceEnabled) {
        publish(actions => { actions.clear() })
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

    // A hidden tab's interval is throttled, and a discarded one stops firing
    // outright, so the moment the page is visible again re-reads immediately.
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible' && timer !== undefined) void refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const unsubscribe = scope.subscribe(syncBalance)
    syncBalance()
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stop()
      sequence += 1
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
    inject: (sessionId, actions) => {
      balanceWriters.set(sessionId, actions)
      bindBalance()
      return {}
    },
  }, BalanceBar))
}
