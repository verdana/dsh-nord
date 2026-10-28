/**
 * `npm pack --json` 输出的解析。
 *
 * 单独成一个模块只有一个理由：这是发布闸门里唯一「形状会随 npm 版本变」的输入，
 * 而那道闸门恰好只在发版当天跑。
 *
 * 两个坑：
 *   - **形状**。npm 10 及更早吐以包名为键的对象（`{ "<name>": {...} }`），npm 11 起
 *     吐数组（`[{ name, ... }]`）。只按包名取键会在数组形状上炸，报错却看不出跟
 *     版本有关。
 *   - **前面的日志**。stdout 里先有构建输出，`tsdown` 的日志形如 `[dsh-nord] entry:`，
 *     所以「从第一个 `{` 或第一个 `[` 往后切」都可能切到日志里的括号上。这里把每个
 *     `{` / `[` 都当一次候选，取第一个能解析出带 `files` 的报告的位置。
 */

/**
 * 从 `npm pack --json` 的 stdout 里取出这个包的报告。
 *
 * @param stdout - 完整 stdout，允许前面混着构建日志。
 * @param packageName - 期望出现在报告里的包名。
 * @returns 该包的 pack 报告（至少含 `files` 数组）。
 * @throws 输出没有 JSON、JSON 不可解析、或报告里没有这个包 / 没有 `files` 时，抛出可读的错误。
 */
export function parsePackReport(stdout, packageName) {
  const candidates = []
  for (const marker of ['{', '[']) {
    for (let at = stdout.indexOf(marker); at !== -1; at = stdout.indexOf(marker, at + 1)) candidates.push(at)
  }
  if (candidates.length === 0) throw new Error(`npm pack --json 没吐出 JSON：${stdout.slice(0, 400)}`)
  candidates.sort((left, right) => left - right)

  let sawJson = false
  let lastError
  for (const start of candidates) {
    let payload
    try {
      payload = JSON.parse(stdout.slice(start))
    } catch (error) {
      lastError = error
      continue
    }
    sawJson = true
    const reports = Array.isArray(payload) ? payload : [payload?.[packageName]]
    const report = reports.find((entry) => entry?.name === packageName) ?? reports[0]
    if (report !== null && typeof report === 'object' && Array.isArray(report.files)) return report
  }

  if (!sawJson) throw new Error(`npm pack --json 的 JSON 解析失败（${lastError?.message}）：${stdout.slice(0, 400)}`)
  throw new Error(`npm pack --json 的报告里没有 ${packageName} 的 files：${stdout.slice(0, 400)}`)
}
