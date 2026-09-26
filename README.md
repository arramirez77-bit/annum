# Annum

A calm personal-finance iPhone app for freelancers, built with Expo (React Native + TypeScript). It answers one question: **how much can I spend today and still be safe?**

**Status:** M0 (project setup) is done: a dark Annum shell with three native tabs runs on iPhone as a development build. The app is built one milestone at a time (see `docs/06-BUILD-PLAN.md`).

- `START-HERE.md`: how the project is run
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
npm test           # Jest: the 25 docs/03 test cases + fixture and theme checks
npm run lint       # ESLint + Prettier
npm run typecheck  # TypeScript
npx expo-doctor    # Expo project health
```

## How the project is organized

| Folder | What's in it |
| --- | --- |
| `app/` | Screens and navigation (Expo Router). `app/(tabs)/` holds Today, Review and Money |
| `src/theme/` | Design tokens: colors, type, spacing, motion, SF Symbols. The only place raw values live |
| `src/domain/` | The money engine (M1): pure TypeScript formulas from `docs/03-DATA-MODEL.md` |
| `src/data/`, `src/services/`, `src/state/`, `src/ui/` | Storage and bank data, device services, app state, components (later milestones) |
| `tests/spec/` | The docs/03 test cases. Until M1 they run against a test-only reference; M1 switches them to `src/domain/` |
| `fixtures/` | Fictional demo data and scenarios |
| `worker/` | Cloudflare Worker for Teller (M6) |

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

## Pushing to GitHub

`main` is protected: a commit can land on `main` only after the `secrets` and `checks` CI jobs pass for it, and force-pushes and deletion are blocked. So push to a branch first, then move `main` to the same commit:

```sh
git push origin HEAD:refs/heads/ci-check     # CI runs on this branch
gh run watch                                 # wait until it's green
git push origin HEAD:main                    # now main accepts the commit
git push origin --delete ci-check            # tidy up
```

`npm install` turns on the pre-commit hook automatically. If you cloned without running it, turn it on by hand with `git config core.hooksPath .githooks` (needs `brew install gitleaks`).

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
