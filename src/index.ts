/**
 * Host half: serves the DeepSeek account balance to the browser half and owns
 * this plugin's settings namespace.
 *
 * The API key never leaves this process — the route answers with balance fields
 * only, and it is reachable only through the same browser-session fence that
 * guards every other page of the Web GUI.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import { parseBalance, type BalanceFailure, type BalancePayload } from './balance.ts'
import { BALANCE_PATH, type Config as NordConfig } from './config.ts'
import { Config } from './schema.ts'

export const name = 'dsh-nord'
export { Config }

/** Credential reference holding the DeepSeek API key. */
const API_KEY_REF = credentialRef('DEEPSEEK_API_KEY')

/** Upstream deadline; the browser receives the failure as an error payload. */
const REQUEST_TIMEOUT_MS = 15_000

/**
 * dsh hands a `.volatile()` field over as a `Volatile<T>` wrapper whose `.get()`
 * answers the value standing right now — that is how a preference can change
 * without the plugin being remounted, and it is why `ui-theme` reads
 * `config.preference.get()` rather than `config.preference`. A plain value never
 * carries a callable `get`, so one unwrapper covers both shapes.
 */
function live<T>(value: T | { get(): T }): T {
  return typeof (value as { get?: unknown }).get === 'function' ? (value as { get(): T }).get() : value as T
}

/** Read every field through {@link live}, so no wrapper reaches a check or a URL. */
function resolved(config: NordConfig): NordConfig {
  const out = { ...config } as Record<string, unknown>
  for (const key of Object.keys(out)) out[key] = live(out[key])
  return out as unknown as NordConfig
}

/**
 * Mount the settings namespace and the balance route.
 * @param ctx - Host plugin context.
 * @param config - composition entry used as the settings base layer.
 */
export function apply(ctx: Context, config: NordConfig): void {
  // Re-read per request. The wrapper handed to `apply` is stable and its `.get()`
  // tracks accepted writes, so no hook is needed to stay live.
  const source = (): NordConfig => resolved(config)

  ctx.inject(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings

    // `SettingsForms` projects the `Config` this module exports into one form per
    // Loader entry, keyed by the profile entry id — this plugin's row id,
    // `dsh-nord`, the same string the browser half asks `configForms.get()` for.
    // Nothing has to be installed; what is left to say is that this plugin ships
    // its OWN page, so the generated one must not be composed beside it.
    //
    // Owned by this plugin's fiber and disposed with it — the shape the shipped
    // preference owners use.
    settingsCtx.effect(() => settings.configure({ auto: false }, ctx.fiber))
  })

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: BALANCE_PATH,
      handler: (req, res) => handleBalance(ctx, source, req, res),
    }), 'dsh-nord: balance route')
  })
}

/**
 * Answer one balance request.
 * @param ctx - context holding the optional credential provider.
 * @param source - current resolved configuration.
 * @param req - the balance request; only its method is read.
 * @param res - response owner.
 * @returns completion after the response is ended.
 */
async function handleBalance(
  ctx: Context,
  source: () => NordConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET')
    res.statusCode = 405
    res.end()
    return
  }
  const config = source()
  if (!config.balanceEnabled) return sendJson(res, { error: 'disabled' } satisfies BalanceFailure)
  const credentials = ctx.get('credentials')
  if (credentials === undefined) return sendJson(res, { error: 'credentials-unavailable' } satisfies BalanceFailure)

  // Every failure below — including a throwing credential lookup, which used to
  // escape this handler and surface as an empty 400 — leaves as one payload.
  let outcome: BalancePayload | BalanceFailure
  try {
    const resolved = await credentials.resolve(API_KEY_REF)
    if (resolved === undefined) outcome = { error: 'credentials-missing' }
    else {
      const url = `${config.baseURL.replace(/\/+$/, '')}/user/balance`
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${resolved.value}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) outcome = { error: 'upstream-failed', status: response.status }
      else {
        const payload = parseBalance(await response.json(), Date.now())
        outcome = payload ?? { error: 'malformed-response' }
      }
    }
  } catch (error) {
    outcome = { error: 'request-failed', detail: errorMessage(error) }
  }
  return sendJson(res, outcome)
}

/**
 * Write one JSON response. The route answers a private account read, so it is
 * marked uncacheable rather than left to a cache's heuristic.
 */
function sendJson(res: ServerResponse, body: BalancePayload | BalanceFailure): void {
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

/** Render any thrown value as a diagnostic string. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
