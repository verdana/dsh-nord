// The usage-link decision, run against the built `lib/usage.js`. Both inputs
// are boundary reads — a provider route key minted by whatever LLM adapter the
// deployment mounted, and a user-typed endpoint — so each is checked on its own
// before the two are combined.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDeepSeekHost, isDeepSeekProvider, usageLink, USAGE_URL } from '../lib/usage.js'

test('a provider route named after DeepSeek counts as DeepSeek', () => {
  for (const provider of ['deepseek', 'deepseek-official', 'DeepSeek']) {
    assert.equal(isDeepSeekProvider(provider), true, provider)
  }
})

test('another vendor never counts, and neither does an empty route', () => {
  for (const provider of ['anthropic', 'openai', 'moonshot', 'pi-ai', '']) {
    assert.equal(isDeepSeekProvider(provider), false, provider)
  }
})

test('an absent provider is not DeepSeek on its own', () => {
  assert.equal(isDeepSeekProvider(undefined), false)
})

test('deepseek.com and its subdomains are DeepSeek hosts', () => {
  for (const url of ['https://api.deepseek.com', 'https://deepseek.com', 'https://API.DeepSeek.com/']) {
    assert.equal(isDeepSeekHost(url), true, url)
  }
})

test('lookalike and unusable endpoints are not DeepSeek hosts', () => {
  for (const url of [
    'https://api.deepseek.com.evil.test',
    'https://notdeepseek.com',
    'https://example.com',
    'https://api.deepseek.com.cn',
    'api.deepseek.com',
    'http://localhost:8080',
    '',
  ]) {
    assert.equal(isDeepSeekHost(url), false, url)
  }
})

test('the live Session provider decides, the endpoint only fills in', () => {
  assert.equal(usageLink('deepseek-official', 'https://example.com'), USAGE_URL)
  assert.equal(usageLink('anthropic', 'https://api.deepseek.com'), undefined)
  assert.equal(usageLink(undefined, 'https://api.deepseek.com'), USAGE_URL)
  assert.equal(usageLink(undefined, 'https://example.com'), undefined)
})
