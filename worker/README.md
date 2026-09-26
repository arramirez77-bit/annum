# worker — Plaid proxy (M7)

A tiny Cloudflare Worker (free plan) that holds the Plaid client ID and secret as Cloudflare secrets and forwards a short allowlist of Plaid requests for the app. **It stores only the connection count:** one number in Workers KV (how many bank connections have been made, so both phones show the same "7 of 10 left"). No bank names, tokens, account numbers, balances or transactions, and no logs of request or response bodies (Workers Logs off). See `docs/02-ARCHITECTURE.md`.

The access key the phones use is replaced with `npm run worker:rotate-key` (see `PROGRESS.md`, "If a phone is lost").

Secrets are set with `wrangler secret put` from your Mac. They are never stored in this repo.
