// Minimal stand-in for https://api.deepseek.com/user/balance.
// Returns the exact upstream field names so the Host half's parsing is what is
// under test, not a fabricated shape of our own.
import { createServer } from 'node:http'

const PORT = 3099

createServer((req, res) => {
  if (req.url !== '/user/balance') {
    res.writeHead(404).end()
    return
  }
  const authorized = req.headers.authorization === 'Bearer test-key'
  res.setHeader('content-type', 'application/json')
  if (!authorized) {
    res.writeHead(401).end(JSON.stringify({ error: { message: 'unauthorized' } }))
    return
  }
  res.end(JSON.stringify({
    is_available: true,
    balance_infos: [
      { currency: 'CNY', total_balance: '42.50', granted_balance: '2.50', topped_up_balance: '40.00' },
    ],
  }))
}).listen(PORT, '127.0.0.1', () => { console.log(`balance mock on ${String(PORT)}`) })
