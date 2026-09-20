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
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import type { BalanceFailure, BalancePayload } from './balance.ts'
import { BALANCE_PATH, Config, NS, type Config as NordConfig } from './config.ts'

export const name = 'dsh-nord'
export { Config }

/** Credential reference holding the DeepSeek API key. */
const API_KEY_REF = credentialRef('DEEPSEEK_API_KEY')

/** Upstream deadline; the browser receives the failure as an error payload. */
const REQUEST_TIMEOUT_MS = 15_000

/** Balance fields the upstream document is read for. */
interface BalanceInfo {
  currency?: unknown
  total_balance?: unknown
  granted_balance?: unknown
  topped_up_balance?: unknown
}

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
 * @param req - the balance request; its body is not read.
 * @param res - response owner.
 * @returns completion after the response is ended.
 */
async function handleBalance(
  ctx: Context,
  source: () => NordConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  void req
  const config = source()
  if (!config.balanceEnabled) return sendJson(res, { error: 'disabled' } satisfies BalanceFailure)
  const credentials = ctx.get('credentials')
  if (credentials === undefined) return sendJson(res, { error: 'credentials-unavailable' } satisfies BalanceFailure)
  const resolved = await credentials.resolve(API_KEY_REF)
  if (resolved === undefined) return sendJson(res, { error: 'credentials-missing' } satisfies BalanceFailure)

  const url = `${config.baseURL.replace(/\/+$/, '')}/user/balance`
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${resolved.value}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      return sendJson(res, { error: 'upstream-failed', status: response.status } satisfies BalanceFailure)
    }
    const payload = await response.json() as { is_available?: unknown; balance_infos?: unknown }
    const infos = Array.isArray(payload.balance_infos) ? payload.balance_infos : []
    const info = infos[0] as BalanceInfo | undefined
    if (info === undefined) return sendJson(res, { error: 'malformed-response' } satisfies BalanceFailure)
    return sendJson(res, {
      currency: typeof info.currency === 'string' ? info.currency : 'CNY',
      total: String(info.total_balance ?? '0'),
      granted: String(info.granted_balance ?? '0'),
      toppedUp: String(info.topped_up_balance ?? '0'),
      available: payload.is_available !== false,
      fetchedAt: Date.now(),
    } satisfies BalancePayload)
  } catch (error) {
    return sendJson(res, { error: 'request-failed', detail: errorMessage(error) } satisfies BalanceFailure)
  }
}

/** Write one JSON response. */
function sendJson(res: ServerResponse, body: BalancePayload | BalanceFailure): void {
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/** Render any thrown value as a diagnostic string. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
