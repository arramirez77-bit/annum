# worker — Annum's Plaid proxy (M7)

A tiny Cloudflare Worker on the **free plan**. It holds the Plaid keys as Cloudflare secrets and forwards a short allowlist of read-only Plaid requests for the app. See `docs/02-ARCHITECTURE.md`, "The Worker".

- **Address:** `https://annum.highdesert.workers.dev`
- **Stores only one number:** bank connections used on the Plaid Trial (Workers KV key `connections-used`), so both phones show the same "7 of 10 left". No bank names, tokens, account numbers, balances or transactions.
- **Logs nothing:** no `console` calls in the code, Workers Logs off (`observability.enabled: false`), no Logpush.
- **Phones need the access key** (`X-Annum-Key`), which each phone scans as a QR code. A wrong key gets `401 key-refused`. Both rate limits count all callers together and never record addresses.

## What it forwards

| Route (POST, with the key) | Plaid call | Notes |
| --- | --- | --- |
| `/v1/status` | — | `{ used, limit, left, sandbox, production }` |
| `/v1/link-token` | `/link/token/create` | New connection: Trial products only (transactions; card statements if the bank has them), 730 days of history, refused at 10. With `access_token`: update mode (repairs), always allowed |
| `/v1/exchange` | `/item/public_token/exchange` | Adds 1 to the count (real banks only) |
| `/v1/transactions/sync` | same | |
| `/v1/accounts/get`, `/v1/accounts/balance/get` | same | Cached / live balances |
| `/v1/liabilities/get` | same | Card statements |
| `/v1/item/get` | same | |
| `/v1/item/remove` | same | Only from "Also end my bank connections at Plaid" |
| `/v1/sandbox/connect`, `/v1/sandbox/item/reset_login` | Sandbox only | Automated tests: a test connection without Link; force "sign in again" |

Public (no key): `/.well-known/apple-app-site-association` (so OAuth banks can return to the app) and `/plaid/oauth` (the OAuth redirect page).

The environment comes from each token's prefix (`access-sandbox-…`, `public-production-…`). **Real banks are impossible until `PLAID_SECRET_PRODUCTION` is set**: development builds use Sandbox, TestFlight builds use real banks.

## Secrets

Set from your Mac, in this folder. Wrangler asks for the value and hides it; never paste it anywhere else.

| Secret | Where to find it | When |
| --- | --- | --- |
| `PLAID_CLIENT_ID` | Plaid Dashboard → Developers → Keys | Once |
| `PLAID_SECRET_SANDBOX` | Same page, Sandbox secret | Once |
| `PLAID_SECRET_PRODUCTION` | Same page, Production secret | Only when you say go for real banks |
| `ANNUM_WORKER_KEY` | Made by `npm run worker:rotate-key` | Never by hand |

```sh
cd ~/Desktop/Dev/Git/annum/worker
npx wrangler secret put PLAID_CLIENT_ID
npx wrangler secret put PLAID_SECRET_SANDBOX
```

## Commands (from the `annum` folder)

| Command | What it does |
| --- | --- |
| `npm run worker:deploy` | Publishes the Worker (after a code change) |
| `npm run worker:rotate-key` | New access key + QR code for the phones (see `PROGRESS.md`, "If a phone is lost") |
| `cd worker && npx wrangler kv key get connections-used --binding COUNT --remote` | Read the count |
| `cd worker && npx wrangler kv key put connections-used 4 --binding COUNT --remote` | Correct the count to match Plaid's Dashboard → Usage (the real number) |

## Tests

`tests/plaid-worker.test.ts` runs `src/handler.ts` against a fake Plaid in the main `npm test`.
