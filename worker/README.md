# worker — Teller proxy (M6)

A tiny, stateless Cloudflare Worker (free plan) that holds the Teller client certificate via an mTLS binding and forwards read-only requests. Nothing here yet; see `docs/02-ARCHITECTURE.md`.

The certificate and key are uploaded with `wrangler mtls-certificate upload` from a folder outside this repo. They are never stored here.
