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
import { Config } from './schema.ts'

export const name = 'dsh-nord'
export { Config }

/** Credential reference holding the DeepSeek API key. */
const API_KEY_REF = credentialRef('DEEPSEEK_API_KEY')

/** Upstream deadline; the browser receives the failure as an error payload. */
const REQUEST_TIMEOUT_MS = 15_000

/**
 * Mount the settings namespace and the balance route.
 * @param ctx - Host plugin context.
 * @param config - composition entry used as the settings base layer.
 */
export function apply(ctx: Context, config: NordConfig): void {
  let source = (): NordConfig => config

  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NS, Config, config, {
      setSource: (current) => { source = current },
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
