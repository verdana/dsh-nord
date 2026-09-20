/** Balance payloads exchanged between the Host route and the browser half. */

/** Successful balance response. */
export interface BalancePayload {
  /** ISO currency code reported by the provider. */
  currency: string
  /** Total remaining balance, as the provider spells it. */
  total: string
  /** Granted (promotional) part of the balance. */
  granted: string
  /** Topped-up part of the balance. */
  toppedUp: string
  /** Whether the account can currently serve requests. */
  available: boolean
  /** Epoch milliseconds of the upstream read. */
  fetchedAt: number
}

/**
 * Failed balance response. `error` is a stable code; the browser half owns the
 * copy, so the Host never sends display text.
 */
export interface BalanceFailure {
  /** Failure code: `disabled`, `credentials-missing`, `credentials-unavailable`, `upstream-failed`, `malformed-response`, or `request-failed`. */
  error: string
  /** Upstream HTTP status, present on `upstream-failed`. */
  status?: number
  /** Diagnostic text from a thrown transport error. */
  detail?: string
}

/**
 * Discriminate one route response.
 * @param value - parsed JSON body.
 * @returns whether the body is a failure payload.
 */
export function isBalanceFailure(value: BalancePayload | BalanceFailure): value is BalanceFailure {
  return 'error' in value
}

/** Upstream `/user/balance` document, read field by field at the JSON boundary. */
export interface BalanceDocument {
  /** Whether the account can currently serve requests. */
  is_available?: unknown
  /** Per-currency balance entries; the first one is the account's. */
  balance_infos?: unknown
}

/** One `balance_infos` entry, as the upstream spells it. */
interface BalanceInfo {
  currency?: unknown
  total_balance?: unknown
  granted_balance?: unknown
  topped_up_balance?: unknown
}

/**
 * Project one upstream document onto the payload the browser renders. Every
 * field is read defensively: the document comes from a third-party HTTP
 * response, and the browser half has no way to recover from a bad projection.
 * @param document - parsed upstream JSON.
 * @param fetchedAt - epoch milliseconds of the read.
 * @returns the payload, or undefined when the document carries no balance entry.
 */
export function parseBalance(document: BalanceDocument, fetchedAt: number): BalancePayload | undefined {
  const infos = Array.isArray(document.balance_infos) ? document.balance_infos : []
  const entry: unknown = infos[0]
  if (typeof entry !== 'object' || entry === null) return undefined
  const info = entry as BalanceInfo
  return {
    currency: typeof info.currency === 'string' ? info.currency : 'CNY',
    total: String(info.total_balance ?? '0'),
    granted: String(info.granted_balance ?? '0'),
    toppedUp: String(info.topped_up_balance ?? '0'),
    available: document.is_available !== false,
    fetchedAt,
  }
}
