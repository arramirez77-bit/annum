# Spikes (M0.5)

Short feasibility checks on the risky parts before building on them. Evidence comes from the iOS 27 Simulator (iPhone 18 Pro) with Expo SDK 57 and Xcode 27. Public repo: no real names, balances or secrets here; real banks are "Bank A", "Bank B"…

| Spike | Status | Where |
| --- | --- | --- |
| 1. SQLCipher (encrypted local database) | ✅ Proven | `main` (commit "M0.5: SQLCipher spike…") |
| 2. Widgets (lock screen + home screen) | ✅ Plumbing proven · visual check on device pending | branch `spike/widgets` (not merged) |
| 3. Bank sync | ⏸ **Pending: provider undecided** | `src/data/sync/provider.ts` (interface only) |

## 1. SQLCipher — proven

**Question:** can `expo-sqlite` on SDK 57 encrypt the database with SQLCipher under Xcode 27 / iOS 27, with the key held in the Keychain?

**How:**
- Config plugin `["expo-sqlite", { "useSQLCipher": true }]` in `app.json`.
- Key: 32 bytes from `expo-crypto` (`getRandomBytesAsync`), hex, stored with `expo-secure-store` as `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (`src/data/secure.ts`).
- Open with `PRAGMA key = "x'<64 hex>'"` as the very first statement (`src/data/db.ts`).
- Development builds: long-press the status pill → **Spikes (M0.5)** → **Run SQLCipher check**. Flow: `maestro/spikes/sqlcipher.yaml`.

**Results (all pass):**

| Check | Result |
| --- | --- |
| Key in Keychain | 32 random bytes, this device only |
| SQLCipher linked | `PRAGMA cipher_version` → **4.7.0 community** (plain SQLite would return nothing) |
| Write and read with the key | sum = 12,412 ✓ |
| Open without the key | refused: "Error code 26: file is not a database" |
| Open with a wrong key | refused: same error |
| Reopen with the right key | sum = 12,412 ✓ |
| File on disk (`Documents/SQLite/annum-spike.db`) | first bytes `451f b080 e204 1ea8…` — no `SQLite format 3` header; **0** readable table or column names |

**Gotchas:** use the raw hex key form (skips SQLCipher's passphrase derivation). `PRAGMA key` must run before anything else touches the file. SQLCipher is compiled into the ExpoSQLite pod (`expo.sqlite.useSQLCipher` in `ios/Podfile.properties.json`), so the first native build is slower.

**Not proven here:** the Face ID gate on the key (`requireAuthentication`) — the Simulator has no enrolled face. Checked on Andy's iPhone in M5 (H7).

**Next (M5):** schema and migrations, Face ID-gated key, lock screen, "Delete everything" removes the database and the key.

## 2. Widgets — plumbing proven, visual check pending

**Question:** can Annum ship lock-screen and home-screen widgets on SDK 57 + Xcode 27, with the iOS 27 scene-support setting on, sharing data through the App Group?

**Approach tried:** **`expo-widgets`** (Expo-maintained, which CLAUDE.md prefers) with `@expo/ui` SwiftUI components. Widgets are written in React with a `'widget'` directive; the app pushes data with `updateSnapshot` / `updateTimeline` / `reload`. `docs/02` names `@bacons/apple-targets` + Swift; that stays the fallback.

**Results:**
- `expo prebuild` creates the `ExpoWidgetsTarget` extension; the build succeeds with `enableSceneSupport` on, and the scene manifest stays on the app only (the extension doesn't use the app's scene delegate — the collision Expo warns about).
- Built app contains `PlugIns/ExpoWidgetsTarget.appex`: a WidgetKit extension (`com.apple.widgetkit-extension`), bundle ID `com.highdesert.annum.widgets`.
- App **and** extension carry the App Group `group.com.highdesert.annum`.
- `updateSnapshot` wrote the widget layout and its data (`$1,000` · `$50` · `Oct 13` · Runway 4.2 of 5 months) into the App Group's shared defaults — the place the extension reads from.
- Supported sizes include `accessoryRectangular`, `accessoryCircular`, `systemSmall`. `@expo/ui` has `Gauge` (Runway ring), `Shapes` (mark arcs) and `AccessoryWidgetBackground`.

**Not proven:** the widget drawing on screen. Adding a widget through the Simulator's home-screen editor with Maestro was unreliable, so this is checked on Andy's iPhone in M8 (H7).

**Constraints for M8:**
- Widget functions run isolated: no hooks, no imports at runtime, no module-scope values. Theme colors and copy must arrive as props from the app, which keeps the token rule intact.
- `docs/02`'s `snapshot.json` becomes the widget props (same fields: `ats`, `perDay`, `nextIncomeLabel`, `runwayMonths`, `runwayTarget`, `status`, `updatedAt`, `isEstimate`) — still no account names or transactions.
- "Days until" at midnight: an `updateTimeline` entry at local midnight.
- On a real iPhone the App Group must be registered to the team (H6). Xcode's automatic signing may register it; otherwise it's a few clicks on developer.apple.com.
- **Proposal for Andy (M8):** use `expo-widgets` instead of `@bacons/apple-targets`, and update `docs/02` then.

## 3. Bank sync — pending: provider undecided

Teller has no public sign-up right now (Andy, 2026-09-25), so no provider is chosen. Until then the data path is **file import (S11)** and **accounts entered by hand (S10)**.

**Interface (`src/data/sync/provider.ts`):** `SyncProvider` with `listAccounts()`, `listTransactions(accountId, since)`, `disconnect()`, `needsNetwork`. Problems are typed — `needs-reauth`, `offline`, `provider-unavailable`, `unknown` — and map to the calm Reconnect, Offline and E4 states. `manualProvider` exists; `bankProvider` is `null`. Screens and the domain never see a provider.

**A provider must supply:** accounts with type and balance (plus card statement balance and due date), transactions with stable IDs and a pending flag, and a "needs re-auth" signal.

**Decision at M7 (stop condition):**
- **Teller** — if Andy gains access (needs the Cloudflare Worker for its mTLS certificate).
- **Plaid** free Trial — verify its current limits and terms first.
- **SimpleFIN** — about $15 a year; needs Andy's approval (the budget is $0).
- **File import only** — $0.
