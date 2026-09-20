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
