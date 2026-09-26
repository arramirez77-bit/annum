# Annum

A calm personal-finance iPhone app for freelancers, built with Expo (React Native + TypeScript). It answers one question: **how much can I spend today and still be safe?**

**Status:** planning kit only. Docs, design tokens and demo data exist; the app is built one milestone at a time (see `docs/06-BUILD-PLAN.md`). Setup steps for running the app arrive with milestone M0.

- `START-HERE.md`: how the project is run
- `CLAUDE.md`: rules and stack for Claude Code
- `docs/`: product, architecture, data model, design system, screens, build plan
- `fixtures/`: fictional demo data and test scenarios

## After cloning (once)

Turn on the secret-scanning pre-commit hook:

```sh
brew install gitleaks
git config core.hooksPath .githooks
```

## Security & privacy

This repository is **public**. The app handles personal finances, so the repo holds code, docs and fictional demo data only.

**What's public**
- Source code, docs, design tokens, CI configuration
- Demo data in `fixtures/`. Every name and amount in it is fictional (for example "Northwind Studio", "Woodgrove Bank", "Contoso Card")

**What's never committed**
- Secrets: `.env` files, API keys, the Worker key, Teller access tokens, the Teller client certificate and private key, Apple signing certificates and profiles
- Real financial data: real account names, balances and transactions, bank exports (CSV/OFX/QFX), databases, backups, or screenshots taken with real data
- The screen PNG exports from the private Figma file (`docs/screens/` is git-ignored)

**Where secrets live instead**

| Secret | Lives in |
| --- | --- |
| Local development values | `.env` on your Mac (git-ignored); copy `.env.example`, which lists the names only |
| Worker key | Cloudflare: `wrangler secret put ANNUM_WORKER_KEY` |
| Teller client certificate + private key | Uploaded to Cloudflare with `wrangler mtls-certificate upload`, run from a folder **outside** this repo. Never stored here |
| Values needed by app builds | EAS environment variables (`eas env:create`) |
| Teller access tokens, database key | The iPhone Keychain, per person, created at runtime |

Anything bundled into the app can be read by someone who has the installed app. The Worker key only stops casual misuse of the Worker. The real protections are the per-person Teller tokens in the Keychain and the Worker's read-only allowlist and rate limit.

**Guards (three layers)**
1. `.gitignore` excludes secret and personal-data file types.
2. A **pre-commit hook** (`.githooks/pre-commit`) runs gitleaks on staged changes and blocks the commit if anything looks like a secret.
3. **CI** (`.github/workflows/ci.yml`) runs gitleaks over the full git history on every push and pull request, plus lint and Jest once the app exists. GitHub secret scanning with push protection adds a final check on GitHub itself.

**If a secret is ever committed:** rotate it first (revoke and replace it at the provider), because removing it from git history doesn't un-leak it. Then clean it out of the repo.

**Reporting a vulnerability:** see [SECURITY.md](SECURITY.md).

## License

No license is granted. All rights reserved.
