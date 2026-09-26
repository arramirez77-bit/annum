# worker — Plaid proxy (M7)

A tiny Cloudflare Worker (free plan) that holds the Plaid client ID and secret as Cloudflare secrets and forwards a short allowlist of Plaid requests for the app. It stores no financial data and logs no request bodies or tokens. The one thing it keeps is a single number in Workers KV: how many bank connections have been made, so both phones show the same "7 of 10 left". See `docs/02-ARCHITECTURE.md`.

Secrets are set with `wrangler secret put` from your Mac. They are never stored in this repo.
