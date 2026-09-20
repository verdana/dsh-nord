// The upstream document projection, run against the built `lib/balance.js`.
// The Host route reads a third-party HTTP body, so every field here is a
// boundary read rather than a typed same-process call.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBalance } from '../lib/balance.js'

const document = {
  is_available: true,
  balance_infos: [
    { currency: 'CNY', total_balance: '42.50', granted_balance: '2.50', topped_up_balance: '40.00' },
  ],
}

test('projects the balance entry the readout renders', () => {
  assert.deepEqual(parseBalance(document, 1234), {
    currency: 'CNY',
    total: '42.50',
    granted: '2.50',
    toppedUp: '40.00',
    available: true,
    fetchedAt: 1234,
  })
})

test('reads the first entry when the provider reports several currencies', () => {
  const payload = parseBalance({
    balance_infos: [
      { currency: 'USD', total_balance: '1.00' },
      { currency: 'CNY', total_balance: '7.00' },
    ],
  }, 0)
  assert.equal(payload?.currency, 'USD')
  assert.equal(payload?.total, '1.00')
})

test('an unavailable account stays a payload, not a failure', () => {
  assert.equal(parseBalance({ ...document, is_available: false }, 0)?.available, false)
})

test('a missing is_available reads as available', () => {
  assert.equal(parseBalance({ balance_infos: [{ total_balance: '1' }] }, 0)?.available, true)
})

test('absent entry fields fall back to zero and the default currency', () => {
  assert.deepEqual(parseBalance({ balance_infos: [{}] }, 7), {
    currency: 'CNY',
    total: '0',
    granted: '0',
    toppedUp: '0',
    available: true,
    fetchedAt: 7,
  })
})

test('numeric balances are carried as the provider spells them', () => {
  assert.equal(parseBalance({ balance_infos: [{ total_balance: 42.5 }] }, 0)?.total, '42.5')
})

test('a non-string currency falls back rather than rendering an object', () => {
  assert.equal(parseBalance({ balance_infos: [{ currency: { code: 'CNY' } }] }, 0)?.currency, 'CNY')
})

test('a document without a usable entry reports malformed', () => {
  for (const value of [
    {},
    { balance_infos: [] },
    { balance_infos: null },
    { balance_infos: 'CNY' },
    { balance_infos: [null] },
    { balance_infos: ['CNY'] },
    { balance_infos: [42] },
  ]) {
    assert.equal(parseBalance(value, 0), undefined, JSON.stringify(value))
  }
})
