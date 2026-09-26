# Security policy

Annum is a personal-finance iPhone app built in the open. It keeps all financial data on the user's phone. The only server is a small, stateless Cloudflare Worker that forwards read-only requests to Teller. Security reports are welcome.

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Report privately through GitHub: open this repository's **Security** tab and click **Report a vulnerability**. Only the maintainer can see the report.

Include what you found, how to reproduce it, and what it could affect. You'll get a reply as soon as practical. This is a one-person project, so please allow some time.

## In scope

- The iOS app (Expo / React Native code in this repo)
- The Cloudflare Worker in `worker/` (Teller proxy)
- The CI workflows in `.github/`

## Never in this repo

- Secrets: API keys, the Worker key, Teller access tokens, the Teller client certificate and private key, signing certificates, provisioning profiles, `.env` files
- Real financial data: account names, balances, transactions, bank exports (CSV/OFX/QFX), databases, backups, or screenshots taken with real data

Demo data in `fixtures/` is fictional. If you find anything that looks like a real secret or real personal data, please report it privately as described above.
