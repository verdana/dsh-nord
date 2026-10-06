/**
 * This plugin's settings transport, adapted across two dsh generations.
 *
 * dsh `0.1.5-rc.3` hands a browser plugin its durable namespace through
 * `ctx.settingsScope.bind({ namespace })`. `0.1.7-rc.2` deleted that service and
 * ships `ctx.configForms.get(entryId)` instead — which constructs the very same
 * controller keyed by the namespace (`{ namespace: entryId }`), so it is a
 * rename, not a redesign. The snapshot carries identical fields, and the three
 * write methods differ only in their settlement: 0.1.5 resolves `void` and
 * signals refusal by rejecting, 0.1.7 and later resolve `boolean`.
 *
 * Neither service name may go into the plugin's `inject`. An entry's `inject` is
 * a hard activation gate — the shell reports `pending (waiting for service: …)`
 * and runs nothing at all — so listing both names stalls on whichever generation
 * lacks one, and listing one breaks the other. {@link mountSettings} therefore
 * registers an optional injection per name and mounts on whichever resolves.
 *
 * Only one generation's declarations can be loaded at a time — their two
 * `SlotMap` module augmentations collide (the `settings.section` owner props
 * differ between them) — so exactly one side is imported and every other is
 * declared structurally. This repo builds against `0.2.0-rc.2`, so the imported
 * side is `configForms` and the declared side is 0.1.5's `settingsScope`;
 * `0.2.0-rc.2` deleted that service *and* its declarations, so the older side has
 * nothing left to import even if the pin moved. `verify-compat` is what actually
 * proves the runtime side, not the compiler — see DEVELOPMENT.md.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'

/**
 * The snapshot fields this plugin reads. Taken from the declarations this repo
 * builds against — 0.2.0's `ConfigFormSnapshot` — because the four fields are
 * field-for-field what 0.1.5's `SettingsScopeSnapshot` carried, and that name no
 * longer exists in the package at all (0.2.0 deleted `settingsScope` and its
 * types along with it). Taking them from the generation that still ships keeps
 * the compiler honest about the rest.
 */
export type SettingsSnapshot<T> = Pick<ConfigFormSnapshot<T>, 'status' | 'value' | 'revision' | 'writable'>

/** One namespace's durable settings, whichever generation is hosting. */
export interface SettingsTransport<T> {
  /** @returns the current sync snapshot (stable reference until the next change). */
  getSnapshot(): SettingsSnapshot<T>
  /**
   * Observe snapshot replacements.
   * @param listener - invoked after each snapshot change.
   * @returns the disposer removing this listener.
   */
  subscribe(listener: () => void): () => void
  /**
   * Queue one field write.
   * @param field - scalar field inside the namespace section.
   * @param value - JSON-shaped value selected by the user.
   * @returns whether the Host accepted the write. On 0.1.5, which has no such
   *   answer, a resolution means acceptance — refusal rejects instead.
   */
  set(field: string, value: unknown): Promise<boolean>
}

/** The 0.1.7 per-namespace form, as this plugin uses it. */
interface ConfigForm<T> {
  getSnapshot(): SettingsSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
}

/** The 0.1.7 settings-transport service (`ctx.configForms`). */
interface ConfigForms {
  get<T>(entryId: string): ConfigForm<T>
}

/**
 * The 0.1.5 per-namespace scope (`ctx.settingsScope.bind`), as this plugin uses
 * it.
 *
 * Declared rather than imported: dsh 0.2.0 deleted both the `settingsScope`
 * service and its `SettingsScope` / `SettingsScopeSnapshot` declarations, so
 * there is nothing left to import while the runtime shape this adapter serves is
 * unchanged. Everything below is duck-typed at the service read anyway, so this
 * is the same kind of view the 0.1.7 side already carries — only its write
 * method differs, resolving `void` and rejecting to signal a refusal.
 */
interface LegacySettingsScope<T> {
  getSnapshot(): SettingsSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

/** The 0.1.5 settings-transport service (`ctx.settingsScope`). */
interface SettingsScopeBinder {
  bind<T>(spec: { namespace: string }): LegacySettingsScope<T>
}

/** The only context surface this module needs: a service lookup. */
interface ServiceReader {
  get(name: string): unknown
}

/** `ctx.inject` viewed as "watch these plain service names", without the service map. */
type InjectService = (deps: readonly string[], callback: (scope: ServiceReader) => void) => unknown

/**
 * Narrow a service read to 0.1.7's binder, or `undefined` when this generation
 * does not ship it. Duck-typed on the one method that is actually called, so a
 * future renaming of everything else still fails loudly at the call site rather
 * than silently mounting nothing.
 */
function asConfigForms(value: unknown): ConfigForms | undefined {
  return typeof (value as ConfigForms | undefined)?.get === 'function' ? value as ConfigForms : undefined
}

/** Narrow a service read to 0.1.5's binder, or `undefined`. See {@link asConfigForms}. */
function asScopeBinder(value: unknown): SettingsScopeBinder | undefined {
  return typeof (value as SettingsScopeBinder | undefined)?.bind === 'function' ? value as SettingsScopeBinder : undefined
}

/** Adapt 0.1.5's scope: a resolution is acceptance, a rejection is the failure. */
function adaptScope<T>(scope: LegacySettingsScope<T>): SettingsTransport<T> {
  return {
    getSnapshot: () => scope.getSnapshot(),
    subscribe: (listener) => scope.subscribe(listener),
    set: async (field, value) => {
      await scope.set(field, value)
      return true
    },
  }
}

/** Adapt 0.1.7's form: the boolean settlement already says whether it was accepted. */
function adaptForm<T>(form: ConfigForm<T>): SettingsTransport<T> {
  return {
    getSnapshot: () => form.getSnapshot(),
    subscribe: (listener) => form.subscribe(listener),
    set: (field, value) => form.set(field, value),
  }
}

/**
 * Mount `install` on the first settings transport this generation provides.
 *
 * Both optional injections are registered up front; only the one whose service
 * exists on the hosting dsh ever resolves, and the first resolution wins, so a
 * generation that ships both still mounts exactly once.
 * @param ctx - client root context.
 * @param namespace - the settings namespace this plugin's Host half installed.
 * @param install - receives the adapted transport; runs once, on whichever
 *   injection resolves first.
 */
export function mountSettings<T>(
  ctx: ClientContext,
  namespace: string,
  install: (settings: SettingsTransport<T>) => void,
): void {
  let mounted = false
  const once = (settings: SettingsTransport<T>): void => {
    if (mounted) return
    mounted = true
    install(settings)
  }
  const inject = ctx.inject as unknown as InjectService
  inject(['configForms'], (scope) => {
    const forms = asConfigForms(scope.get('configForms'))
    if (forms !== undefined) once(adaptForm(forms.get<T>(namespace)))
  })
  inject(['settingsScope'], (scope) => {
    const binder = asScopeBinder(scope.get('settingsScope'))
    if (binder !== undefined) once(adaptScope(binder.bind<T>({ namespace })))
  })
}
