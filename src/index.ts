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
import { BALANCE_PATH, NS, type Config as NordConfig } from './config.ts'
import { Config, PlainConfig } from './schema.ts'

export const name = 'dsh-nord'
export { Config }

/** Credential reference holding the DeepSeek API key. */
const API_KEY_REF = credentialRef('DEEPSEEK_API_KEY')

/** Upstream deadline; the browser receives the failure as an error payload. */
const REQUEST_TIMEOUT_MS = 15_000

/**
 * dsh 0.1.7 hands a `.volatile()` field over as a `Volatile<T>` wrapper whose
 * `.get()` answers the value standing right now — that is how a preference can
 * change without the plugin being remounted, and it is why `ui-theme` reads
 * `config.preference.get()` rather than `config.preference`.
 *
 * 0.1.5 has no notion of the marker in its cordis, cosmokit or `dsh-settings`,
 * but it still *resolves this entry through the schema this module exports* —
 * so the `config` reaching `apply` there carries wrappers too. Hence one
 * unwrapper for both, rather than a version test. A plain value never carries a
 * callable `get`.
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
  // Re-read per request. On 0.1.7 the wrapper handed to `apply` is stable and
  // its `.get()` tracks accepted writes, so no hook is needed to stay live.
  let source = (): NordConfig => resolved(config)

  ctx.inject(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings

    // dsh 0.1.7 deleted `installSection`. Its `SettingsForms` projects the
    // `Config` this module exports into one form per Loader entry, keyed by the
    // profile entry id — this plugin's row id, `dsh-nord`, the same string the
    // browser half asks `configForms.get()` for. There is nothing to install;
    // what is left to say is that this plugin ships its OWN page, so the
    // generated one must not be composed beside it.
    if (typeof settings.installSection !== 'function') {
      const configure = (settings as unknown as {
        configure?: (presentation: { auto?: boolean }, owner?: unknown) => () => void
      }).configure
      // Owned by this plugin's fiber and disposed with it — the shape the
      // shipped preference owners use.
      if (configure !== undefined) settingsCtx.effect(() => configure({ auto: false }, ctx.fiber))
      return
    }

    // `PlainConfig`, not `Config`: 0.1.5 resolves the namespace through whatever
    // schema it is handed and keeps the result as the wire value, so the
    // volatile marker would replace every field with a `{ get() {} }` shell the
    // browser cannot decode — writes would persist and never come back. See
    // `src/schema.ts`.
    //
    // The base layer is the UNWRAPPED composition entry, not `config` itself:
    // 0.1.5's `describe()` does `structuredClone(registration.base)`, and a
    // `Volatile` wrapper carries functions — cloning one throws `DataCloneError`,
    // which empties the whole namespace list and leaves the browser half
    // reporting `unavailable` with no clue as to why.
    settings.installSection(ctx, NS, PlainConfig, resolved(config), {
      // 0.1.5 hands back its own live source; unwrap it the same way, so a host
      // that later grows the marker cannot leak a wrapper into `source()`.
      setSource: (current) => { source = () => resolved(current()) },
      // The route reads `source()` per request and the browser half reads its
      // own scope snapshot, so an accepted change needs no rebuild here.
      onChange: () => {},
    })
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
