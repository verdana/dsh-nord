/**
 * This plugin's settings transport: the browser's durable namespace, read and
 * written through dsh's shared config-form controller.
 *
 * The shell hands a browser plugin `ctx.configForms.get(entryId)`, keyed by the
 * namespace (this plugin's profile entry id, `dsh-nord`). The snapshot carries
 * status/value/revision/writable, and `set(field, value)` resolves whether the
 * Host accepted the write. The service is resolved through an optional
 * injection rather than declared in the plugin's `inject`: an entry's `inject`
 * is a hard activation gate — the shell reports `pending (waiting for service:
 * …)` and runs nothing — so a shell assembled without the settings UI would take
 * the whole plugin down with it.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'

/**
 * The snapshot fields this plugin reads. Taken from dsh's `ConfigFormSnapshot`,
 * which carries these four alongside fields the plugin deliberately ignores.
 */
export type SettingsSnapshot<T> = Pick<ConfigFormSnapshot<T>, 'status' | 'value' | 'revision' | 'writable'>

/** One namespace's durable settings, adapted to the shape the card consumes. */
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
   * @returns whether the Host accepted the write.
   */
  set(field: string, value: unknown): Promise<boolean>
}

/**
 * Mount `install` once the shell's config-form service is available.
 * @param ctx - client root context.
 * @param namespace - the settings namespace this plugin's Host half installed.
 * @param install - receives the adapted transport; runs once when the optional
 *   injection resolves.
 */
export function mountSettings<T>(
  ctx: ClientContext,
  namespace: string,
  install: (settings: SettingsTransport<T>) => void,
): void {
  ctx.inject(['configForms'], (settingsCtx) => {
    const form = settingsCtx.configForms.get<T>(namespace)
    install({
      getSnapshot: () => form.getSnapshot(),
      subscribe: listener => form.subscribe(listener),
      set: (field, value) => form.set(field, value),
    })
  })
}
