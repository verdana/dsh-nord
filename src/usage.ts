/**
 * Which account the balance panel's usage link belongs to.
 *
 * The panel renders DeepSeek's own `/user/balance` projection, so a link to
 * DeepSeek's platform is only meaningful for a DeepSeek account. Two signals
 * decide that, consulted in this order: the Session's live model provider (the
 * Host's durable `modelSelection` projection, which a Session that has not
 * chosen a model yet does not carry), then the balance endpoint this plugin is
 * configured against — the endpoint the reading actually came from.
 */

/** DeepSeek's platform usage page. */
export const USAGE_URL = 'https://platform.deepseek.com/usage'

/**
 * Whether one provider route key is DeepSeek's.
 * @param provider - provider route key, e.g. `deepseek-official`.
 * @returns whether the route belongs to DeepSeek.
 */
export function isDeepSeekProvider(provider: string | undefined): boolean {
  return provider !== undefined && provider.toLowerCase().startsWith('deepseek')
}

/**
 * Whether one balance endpoint is DeepSeek's.
 * @param baseURL - configured balance API origin.
 * @returns whether the origin is `deepseek.com` or one of its subdomains.
 */
export function isDeepSeekHost(baseURL: string): boolean {
  let host: string
  try {
    host = new URL(baseURL).hostname.toLowerCase()
  } catch {
    // A draft or malformed address never grows a usage link.
    return false
  }
  return host === 'deepseek.com' || host.endsWith('.deepseek.com')
}

/**
 * Resolve the usage link for one reading; the module note records the order the
 * two signals are consulted in.
 * @param provider - provider route of the Session's next model, absent until the Session has one.
 * @param baseURL - configured balance API origin.
 * @returns the usage page for a DeepSeek account, otherwise undefined.
 */
export function usageLink(provider: string | undefined, baseURL: string): string | undefined {
  const deepseek = provider === undefined ? isDeepSeekHost(baseURL) : isDeepSeekProvider(provider)
  return deepseek ? USAGE_URL : undefined
}
