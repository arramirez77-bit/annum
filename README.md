# Annum

A calm personal-finance iPhone app for freelancers, built with Expo (React Native + TypeScript). It answers one question: **how much can I spend today and still be safe?**

**Status:** M0–M6 are done; M7 (bank connection through Plaid's free Trial, polish, TestFlight) is in progress. The app is built one milestone at a time (see `docs/06-BUILD-PLAN.md`; progress in `PROGRESS.md`).

- `START-HERE.md`: how the project is run
- `PROGRESS.md`, `SPIKES.md`: build log, open human checkpoints, and feasibility spikes
- `CLAUDE.md`: rules and stack for Claude Code
- `docs/`: product, architecture, data model, design system, screens, build plan
- `fixtures/`: fictional demo data and test scenarios

## Stack at a glance

Expo **SDK 57** (React Native 0.86, React 19.2), TypeScript strict, Expo Router with native tabs, iOS only, dark only. Bundle ID `com.highdesert.annum`. Builds are local on the Mac (free); EAS is configured for later TestFlight releases.

## Get back to this point from scratch

### 1. One-time Mac setup

| Tool | How | Check |
| --- | --- | --- |
| Xcode 27 | Mac App Store, open it once and accept the license | `xcodebuild -version` |
| Homebrew | [brew.sh](https://brew.sh) | `brew --version` |
| Node.js 22.13 or newer (24 LTS recommended) | `brew install node@24` | `node -v` |
| CocoaPods | `brew install cocoapods` | `pod --version` |
| gitleaks (secret scanner for commits) | `brew install gitleaks` | `gitleaks version` |
| GitHub CLI | `brew install gh`, then `gh auth login` | `gh auth status` |
| EAS CLI (only for EAS builds) | `npm install -g eas-cli`, then `eas login` | `eas whoami` |
| fastlane (only for local EAS builds) | `brew install fastlane` | `fastlane --version` |

### 2. One-time Apple and iPhone setup

1. **Xcode → Settings → Accounts:** add your Apple ID. Your team (ID `YHZESG76UG`) should appear. The team ID is already in `app.json`, so Xcode signs the app automatically.
2. **iPhone → Settings → Privacy & Security → Developer Mode:** turn it on. The phone restarts; confirm when asked.
3. **Pair the iPhone once:** plug it into the Mac with a cable, unlock it, and tap **Trust**. After that it also works over Wi‑Fi.
4. **developer.apple.com:** nothing to do. Automatic signing registers the app ID and your iPhone. (No "Trust developer" step is needed with a paid developer account.)

### 3. Get the code

```sh
git clone https://github.com/arramirez77-bit/annum.git
cd annum
npm install        # also turns on the secret-scanning pre-commit hook
```

### 4. Put Annum on your iPhone

Keep the iPhone unlocked and on the same Wi‑Fi as the Mac, then:

```sh
npm run ios:device   # pick your iPhone from the list
```

The first build takes several minutes. During it:
- If macOS asks **"codesign wants to access key…"**, type your Mac password and click **Always Allow** (it may ask 2–3 times).
- When Annum first opens, iOS asks to **find devices on your local network**. Tap **Allow**, or live reload can't connect.
- Expo shows a one-time **developer menu** intro. Tap **Continue**. The gear "Tools" button only exists in development builds, never in the real app.

**First build on a new Mac or a new iPhone only:** if the build stops with *"No profiles for 'com.highdesert.annum' were found"*, Xcode needs permission to create the signing profile once. Run this, then `npm run ios:device` again:

```sh
npx expo prebuild --platform ios
xcrun devicectl list devices    # copy your iPhone's Identifier (the UDID)
xcodebuild -workspace ios/Annum.xcworkspace -scheme Annum -configuration Debug \
  -destination id=PASTE_YOUR_UDID_HERE \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
```

(Or in Xcode: `xed ios` → select the **Annum** target → **Signing & Capabilities** → pick your team.)

To use the Simulator instead: `npm run ios`.

### 5. Every day after that

```sh
npm start          # starts the dev server (Metro) on port 8082
```

Open Annum on the iPhone. Edits to the code appear on the phone within a second or two. You only need to rebuild (step 4) when a native package or `app.json` changes.

Annum always uses **port 8082**, so it never clashes with other Expo projects on the default 8081. If Annum shows a list of servers, pick the one ending in **:8082**.

### 6. Checks

```sh
npm test           # Jest: the 25 docs/03 test cases, engine, view, store, component and export tests
npm run lint       # ESLint + Prettier + token check (no raw colors/sizes outside src/theme)
npm run typecheck  # TypeScript
npx expo-doctor    # Expo project health
SIM=<sim-udid> scripts/maestro.sh maestro/   # all flow tests on the Simulator (needs `npm start` running)
scripts/maestro-lock.sh <sim-udid>  # the Face ID lock flows (Maestro can't answer Face ID; this script does)
scripts/maestro-files.sh <sim-udid> # bank-file import flows (copies the fictional files in fixtures/bank-files)
scripts/maestro-bank.sh <sim-udid>  # bank connection flows in Plaid Sandbox (pairs the Simulator with a NEW access key: add --qr to re-pair phones in the same run)
```

Flow tests use [Maestro](https://maestro.mobile.dev): `brew install openjdk@17 mobile-dev-inc/tap/maestro`, and set `JAVA_HOME` to `$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home`.

**Demo scenarios and the component gallery (development builds):** long-press the status pill on Today (or the mark on Welcome and on the lock screen) to switch scenarios (on track, heads up, stale sync, late invoice, first run, salary). Demo data is never saved and never touches your own. The same screen has **Use my data** (back to this phone's data), **Erase this phone's Annum data and start over** (first launch again), links to the component gallery and the spikes (SPIKES.md), and a test-only "Lock after 5 seconds away".

**Test banks (development builds):** development builds connect to Plaid's **Sandbox** (fake banks, free, never counted against the 10). In Plaid Link pick any bank and sign in with `user_good` / `pass_good`. The connect sheet also has "Test bank without Link" for automated tests, and setup keeps "Use a sample bank" (made-up numbers that never sync). TestFlight builds connect real banks.

## How the project is organized

| Folder | What's in it |
| --- | --- |
| `app/` | Screens and navigation (Expo Router). `app/(tabs)/` holds Today, Review and Money |
| `src/theme/` | Design tokens: colors, type, spacing, motion, SF Symbols. The only place raw values live |
| `src/domain/` | The money engine: pure TypeScript formulas from `docs/03-DATA-MODEL.md`, with unit tests in `__tests__/` |
| `src/ui/components/` | Design system components (docs/04), theme tokens only |
| `src/data/`, `src/services/`, `src/state/` | Storage, demo data and bank data; device services (haptics…); app state |
| `maestro/` | Maestro flow tests |
| `scripts/check-tokens.js` | The token check `npm run lint` runs |
| `tests/spec/` | The docs/03 test cases, run against the engine in `src/domain/` with the demo fixtures |
| `fixtures/` | Fictional demo data and scenarios |
| `worker/` | Cloudflare Worker that holds the Plaid keys (M7) |

**`ios/` is generated, not stored in git.** `npx expo prebuild --clean` rebuilds it from `app.json`. Never edit it by hand; native settings go in `app.json` and config plugins.

**Why `enableSceneSupport` is in `app.json`:** apps built with Xcode 27 must use iOS's "scene" startup or they won't open on iOS 27. Expo SDK 57 needs this setting (`expo-build-properties` → `ios.enableSceneSupport`); SDK 58 does it automatically, so remove the setting when upgrading.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Annum shows "No development server found" or a list of servers | Run `npm start` on the Mac, and check iPhone → Settings → Privacy & Security → **Local Network** → Annum is on. Mac and phone must be on the same Wi‑Fi |
| The iPhone isn't in the device list | Unlock it, plug in the cable, tap **Trust** if asked |
| "No profiles for 'com.highdesert.annum' were found" | One-time signing step: see "First build on a new Mac" in step 4 |
| Other signing errors | Xcode → Settings → Accounts: check your Apple ID is signed in and the team is listed |
| Annum opens a different project | You picked another project's server in the list. Close Annum, reopen it, and pick the server ending in **:8082** |
| Blank screen after an upgrade | `npx expo prebuild --clean`, then `npm run ios:device` again |
| "Port 8082 is running … in another window" | Annum's dev server is already running in another Terminal window. Use that one, or close it first |
| Expo's gear "Tools" button covers the settings icon | Development builds only. Drag it aside, or turn it off in the developer menu (shake the phone) |
| After updating, a screen doesn't open or Face ID isn't asked | The phone has an older build without M5's native modules. Rebuild once: `npm run ios:device` |
| Annum shows Welcome, but you had data | Only after Delete everything or a fresh install. If you exported a backup, use **Restore from a backup** |

## Pushing to GitHub

`main` is protected: a commit can land on `main` only after the `secrets` and `checks` CI jobs pass for it, and force-pushes and deletion are blocked. `scripts/ship.sh` does all of this in one go. By hand: push to a branch first, then move `main` to the same commit:

```sh
git push origin HEAD:refs/heads/ci-check     # CI runs on this branch
gh run watch                                 # wait until it's green
git push origin HEAD:main                    # now main accepts the commit
git push origin --delete ci-check            # tidy up
```

`npm install` turns on the pre-commit hook automatically. If you cloned without running it, turn it on by hand with `git config core.hooksPath .githooks` (needs `brew install gitleaks`).

## Getting your numbers in

- **Connect a bank** (Plaid's free Trial): during setup, or Settings → Accounts → **Add a bank**. Annum first says what it costs: *"This uses 1 of your 10 bank connections. 7 left for both phones."* The 10 are for life and shared by both phones; ending one doesn't give it back. You sign in on your bank's own page inside Plaid; Annum never sees your password and can't move money. Annum then updates when you open it (if it's been over 6 hours), when you pull down on Today (live balances), and sometimes in the background.
- **If a bank asks you to sign in again**, Today says so and Settings → Accounts shows **Reconnect**. That repairs the same connection; it never uses a new one.
- **Each phone is paired once** with the Worker by scanning a QR code: on the Mac, in the `annum` folder, run `npm run worker:rotate-key` and point each iPhone's Camera at the code, then tap **Open in Annum**. A new code replaces the old one on every phone (see `PROGRESS.md`, "If a phone is lost").
- **Import a file:** on your bank's website, download the account's transactions as **CSV** or **OFX/QFX** (Quicken). In Annum: Money → **Import a file** → Choose file, or open the download from Files or Mail and pick **Annum**. Tell Annum which account it is and the balance today; it adds what's new and skips what it already has. The weekly review offers this first.
- **By hand:** Settings → Accounts for balances (brokerage, loans), Money → All transactions → **Add one by hand** for a purchase a file doesn't have.
- **Bills:** Money → Bills. Annum proposes bills it notices in checking; you confirm them.
- Bank files you open in Annum are deleted from the phone after they're read. Nothing is uploaded anywhere.

## Where your data lives

- **On your iPhone, in one encrypted file.** Balances, transactions, settings and reviews are saved in a SQLCipher-encrypted database inside Annum. There's no Annum account and no Annum server with your money data.
- **The key is in the iPhone Keychain, and it never leaves the phone.** Annum makes a random 256-bit key the first time you finish setup. Face ID (or your passcode) opens Annum; the key itself is protected by your iPhone passcode.
- **Every change saves by itself**, a moment after you make it and again when you leave the app. Quitting and reopening keeps everything.
- **Face ID lock (optional):** Annum asks when it opens and after 5 minutes away. While Annum isn't on screen (App Switcher, Face ID prompt), it shows a plain cover instead of your numbers.

**Getting a new phone:** your iCloud backup includes the encrypted file, but not its key (the key is "this device only"), so an iCloud restore alone can't open your data. Before you switch:
1. Old phone: Annum → Settings → **Export all data**. Choose a passphrase (at least 8 characters, or 12 when banks are connected) and save the file to Files or AirDrop it. Keep the passphrase somewhere safe; Annum can't recover it.
2. New phone: install Annum, tap **Restore from a backup** on the first screen, choose the file, type the passphrase. Your bank connections come back with it, **without using any of the 10**.
3. Pair the new phone: `npm run worker:rotate-key` on the Mac, then scan the code on every phone you use (the access key is never in a backup).

If a phone restored from iCloud ever shows "Annum can't open the data on this phone", that's this case: choose **Restore from a backup** (or **Start fresh**).

**Delete everything** (Settings → Privacy) removes the database (with the bank connections), the Keychain entries (including this phone's pairing), Annum's reminders, and any exported files from the phone. It can't be undone. With banks connected it first says that reconnecting later uses new connections, and offers "Also end my bank connections at Plaid" (off by default: a backup can bring un-ended connections back).

## Security & privacy

This repository is **public**. The app handles personal finances, so the repo holds code, docs and fictional demo data only.

**What's public**
- Source code, docs, design tokens, CI configuration
- Demo data in `fixtures/`. Every name and amount in it is fictional (for example "Northwind Studio", "Woodgrove Bank", "Contoso Card")

**What's never committed**
- Secrets: `.env` files, API keys (including the Plaid client ID and secret), the Worker key, Plaid access tokens, Apple signing certificates and profiles
- Real financial data: real account names, balances and transactions, bank exports (CSV/OFX/QFX), databases, backups, or screenshots taken with real data
- The screen PNG exports from the private Figma file (`docs/screens/` is git-ignored)

**Where secrets live instead**

| Secret | Lives in |
| --- | --- |
| Local development values | `.env` on your Mac (git-ignored); copy `.env.example`, which lists the names only |
| Worker access key | Made by `npm run worker:rotate-key`: stored as a Cloudflare secret and, on each phone, in the Keychain (scanned from a QR code). Never in the app bundle, backups, files, or this repo |
| Plaid client ID + secrets | Cloudflare secrets only: `npm run worker:set-plaid-keys` (client ID + Sandbox secret, checked with Plaid first), and (only on the go-ahead for real banks) `wrangler secret put PLAID_SECRET_PRODUCTION`. Never in the app, never in this repo. See `worker/README.md` |
| Values needed by app builds | EAS environment variables (`eas env:create`) |
| Database key | The iPhone Keychain, per person, created at runtime |
| Plaid access tokens (one per bank login) | Inside the encrypted database on each phone, so an Annum backup (itself encrypted with your passphrase) can carry them to a new phone without using new bank connections |

Anything bundled into the app can be read by someone who has the installed app, so the app carries only the Worker's address. The access key is per phone and can be replaced from the laptop in one command (see `PROGRESS.md`, "If a phone is lost"). The real protections are that the Plaid secret never leaves Cloudflare, each person's Plaid access tokens stay in their encrypted database, and the Worker allows only a short list of read-only Plaid requests, with a rate limit and a hard stop at the Trial's 10 bank connections.

**Guards (three layers)**
1. `.gitignore` excludes secret and personal-data file types.
2. A **pre-commit hook** (`.githooks/pre-commit`) runs gitleaks on staged changes and blocks the commit if anything looks like a secret. Its rules include Plaid client IDs and secrets (checked 2026-09-26 with fake values).
3. **CI** (`.github/workflows/ci.yml`) runs gitleaks over the full git history on every push and pull request, plus lint and Jest once the app exists. GitHub secret scanning with push protection adds a final check on GitHub itself.

**If a secret is ever committed:** rotate it first (revoke and replace it at the provider), because removing it from git history doesn't un-leak it. Then clean it out of the repo.

**Reporting a vulnerability:** see [SECURITY.md](SECURITY.md).

## License

No license is granted. All rights reserved.
