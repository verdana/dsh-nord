/**
 * Durable settings schema. Host-only: importing this module is what pulls
 * schemastery into a build, so the browser half takes the interface and the
 * defaults from `config.ts` and never reaches this file.
 *
 * Two generations, two schemas, one field table.
 *
 * dsh **0.1.7** discovers a plugin's settings namespace from the `Config` this
 * module exports: `SettingsForms.describe()` projects each Loader entry's schema
 * through `volatileForm()`, which keeps ONLY fields carrying `meta.volatile`
 * and drops the entry outright when none does. Without the marker the namespace
 * never reaches the browser, which reports it `unavailable`.
 *
 * dsh **0.1.5** has no notion of the marker in its cordis, its cosmokit or its
 * `dsh-settings` — but it is not indifferent to it either, which is the trap.
 * It resolves the namespace through whatever schema it is handed and keeps the
 * result as the wire value, so a volatile field there resolves to a bare
 * `{ get() {} }` shell that does not survive JSON: the browser's decode rejects
 * the section, nothing comes back, and every write fails silently while the
 * Host happily persists it. So 0.1.5 must be handed a schema WITHOUT the
 * marker — hence {@link PlainConfig}.
 *
 * Every field carries a default in both, so a `cordis.patch.yml` entry — which
 * replaces the whole `config` block — written before a field existed still
 * resolves instead of failing validation.
 */
import z from '@deepseek-ai/schemastery'
import { DEFAULTS, type Config as NordConfig } from './config.ts'

/** Every field, declared once: the two schemas differ only in the marker. */
const FIELDS = {
  themeEnabled: () => z.boolean().default(DEFAULTS.themeEnabled),
  fontEnabled: () => z.boolean().default(DEFAULTS.fontEnabled),
  uiFont: () => z.string().default(DEFAULTS.uiFont),
  uiFontCustom: () => z.string().default(DEFAULTS.uiFontCustom),
  codeFont: () => z.string().default(DEFAULTS.codeFont),
  codeFontCustom: () => z.string().default(DEFAULTS.codeFontCustom),
  balanceEnabled: () => z.boolean().default(DEFAULTS.balanceEnabled),
  refreshSeconds: () => z.number().step(1).min(15).max(3600).default(DEFAULTS.refreshSeconds),
  baseURL: () => z.string().default(DEFAULTS.baseURL),
}

/**
 * Build the object schema.
 * @param volatile - whether every field carries the `.volatile()` marker.
 * @returns the schema node, typed by the caller.
 */
function build(volatile: boolean): unknown {
  return z.object(Object.fromEntries(
    Object.entries(FIELDS).map(([key, make]) => [key, volatile ? make().volatile() : make()]),
  ))
}

/**
 * The schema dsh 0.1.7 discovers, and the one `src/index.ts` exports as this
 * entry's `Config`: every field volatile, because without a single marked field
 * the whole namespace is filtered out of `describe()`.
 *
 * The annotation is a 0.1.5-side view. schemastery types a `.volatile()` field
 * as `Volatile<T>` — which is what 0.1.7 resolves to, and precisely what the
 * {@link PlainConfig} handed to 0.1.5 does not — so the two views are stated
 * apart rather than one being bent to fit.
 */
export const Config = build(true) as z<NordConfig>

/** The schema registered through 0.1.5's `installSection`, whose wire carries plain values. */
export const PlainConfig = build(false) as z<NordConfig>
