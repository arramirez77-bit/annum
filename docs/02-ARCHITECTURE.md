# 02 — Architecture: how the app works

## One-paragraph summary

Annum is a **native iPhone app with no database server**. Everything lives on the phone: an encrypted SQLite database holds accounts, transactions and buckets; the encryption key and the Teller access tokens live in the iOS **Keychain**. Bank data comes from **Teller** (free developer tier, up to 100 live connections). Teller requires a client certificate (mTLS) that must never ship inside an app, so a tiny **stateless Cloudflare Worker** (free tier) holds the certificate and forwards read-only requests. The Worker stores nothing. Banks that won't connect use **CSV/OFX file import**; Brokerage accounts and loans are **entered by hand**. All math (Available to Spend, buckets, runway, guardrails) runs in a pure TypeScript **domain engine**. After each sync the app writes a tiny read-only **snapshot** to a shared App Group so the **widgets** can show "You can spend $1,000" on the lock screen without opening the app.

```
 iPhone
┌───────────────────────────────────────────────────────────────┐
│  Annum app (Expo / React Native)                              │
│   Screens (Expo Router)  ←─ selectors ─  Zustand store        │
│                                            │                   │
│                             Domain engine (pure TS: formulas, │
│                             waterfall, status, report, rules) │
│                                            │                   │
│   Data layer ── expo-sqlite (SQLCipher encrypted) ◄── key ─┐  │
│        │                                                    │  │
│        │ HTTPS (read-only)        Keychain (expo-secure-store)│
│        ▼                          • DB key • Teller tokens   │  │
│   Cloudflare Worker (stateless, holds Teller mTLS cert)      │  │
│        ▼                          (Face ID gated)            │  │
│   Teller API ─► your banks                                   │  │
│        │                                                       │
│        └─► writes snapshot.json ─► App Group ─► WidgetKit ext. │
│   Local notifications (Sunday review, tax dates, statements)  │
│   Background refresh (iOS decides timing)                     │
└───────────────────────────────────────────────────────────────┘
```

## Layers

| Layer | Folder | Responsibility | Rules |
| --- | --- | --- | --- |
| Domain engine | `src/domain/` | Types, formulas, waterfall, what-if, transfer, status, report, scenarios, categorization rules, recurring detection | Pure TS. No React Native, no I/O. Money in integer cents. 100% unit-tested. |
| Data | `src/data/` | SQLite schema + migrations, repositories, Teller client (via Worker), CSV/OFX importer, sync, export/import, widget snapshot writer | All reads/writes go through repositories. Secrets only via `src/data/secure.ts`. |
| Services | `src/services/` | Face ID lock, notifications scheduler, background refresh, haptics wrapper | Thin wrappers over Expo modules so they can be mocked in tests. |
| State | `src/state/` | Zustand store + selectors that call the domain engine (`useToday()`, `useMoney()`, `useWhatIf(p)`…) | Screens never do money math. |
| UI | `src/ui/components/`, `app/` (Expo Router) | Components from `04-DESIGN-SYSTEM.md`; routes from `05-SCREENS.md` | Theme tokens only. Every screen handles its states. |
| Widget | `targets/widget/` (Swift) | Lock-screen rectangular + circular, home small | Reads `snapshot.json` from the App Group. Never reads the database. |
| Worker | `worker/` (Cloudflare) | Stateless Teller proxy with mTLS certificate binding | Allowlisted Teller paths only, no storage, no logging of bodies/tokens. |

## Two modes

1. **Demo mode** — loads `fixtures/seed.json`; the **scenario switcher** (long-press the status pill; also `app/dev/scenarios.tsx` in dev builds) applies overrides from `fixtures/scenarios.json`. Used to build and test every screen before real data.
2. **Real mode** — after onboarding connects banks through Teller (or imports files). Same domain engine, real data.

## Bank data (Teller via a free Worker, plus import and manual)

**Connecting (onboarding O3):**
- "Connect a bank" opens **Teller Connect** (Teller's hosted sign-in) in a `react-native-webview` sheet, configured with Andy's Teller application ID and environment (`sandbox` while building, then the free real-data environment).
- On success Teller returns an **enrollment** with an **access token** (one per bank). The app stores tokens in the Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Tokens never touch SQLite, logs, or analytics.
- Andy confirms account types in O4 and adds the brokerage account and the student loan by hand (S10).

**Syncing:**
- The app calls the Worker: `POST /teller/{path}` with the access token in the `Authorization` header and an `X-Annum-Key` header (a per-install key set in the Worker's secrets, to stop anyone else using the certificate).
- The Worker allowlists only read endpoints (`/accounts`, `/accounts/{id}/balances`, `/accounts/{id}/transactions`), attaches the Teller client certificate through a Cloudflare **mTLS certificate binding**, forwards to `api.teller.io` with Basic auth (token as username), and returns the JSON. No storage, no request logging, rate-limited.
- When: on app open if the last sync was > 6 hours ago, on pull-to-refresh, and opportunistically via background refresh. Show "Updated 7:02 AM", never "live".
- Mapping: Teller accounts → `Account` (type from Teller's `type/subtype`); transactions → `Transaction`, deduped by Teller transaction ID; pending transactions shown but excluded from the weekly report until posted.

**Fallbacks:**
- **Import a file (S11):** `expo-document-picker` plus a share-extension-free "Open in Annum" document type. Parse CSV (column mapping remembered per bank) and OFX/QFX. Dedupe by date + amount + normalized merchant.
- **By hand (S10):** balance-only accounts (brokerage, loans), updated in Weekly Review step 1.

**Failures are states:** Teller Connect cancelled or failed → E4 "That bank didn't connect" (Try again / Import a file instead); an enrollment needs re-auth → that account shows "Reconnect" and the stale note; > 48h old → E1; offline → "Offline — showing what's on this phone."

**Verify in M6** against Teller's current docs before coding: Connect options, environments and their limits, endpoints and fields, and that Cloudflare mTLS certificate bindings are available on the free Workers plan. Report findings to Andy before writing the Worker.

## Storage & security

- **Database:** `expo-sqlite` with SQLCipher enabled (via the module's config plugin option). Tables: `accounts`, `transactions`, `bills`, `expected_income`, `deposits`, `splits`, `reviews`, `rules`, `deferred`, `settings`, `meta`.
- **Key:** 256-bit random key generated on first run, stored in the Keychain. Retrieval is gated by Face ID (`requireAuthentication`) so data can't be read unless Andy unlocks.
- **Lock:** Face ID on cold start and after 5 minutes in the background (`expo-local-authentication`), device passcode fallback. Screens S5/E6. `NSFaceIDUsageDescription`: "Annum uses Face ID to keep your money private."
- **Privacy screen:** blur/cover the app in the App Switcher snapshot.
- **Backups:** iCloud device backup includes the encrypted DB; the key is `ThisDeviceOnly`, so **restoring to a new phone needs an export**. Provide *Export all data* (encrypted file via the share sheet) and *Import backup* in Settings. Document this plainly for Andy.
- **Exports:** CSV of tax-tagged transactions for the accountant (share sheet); PDF summary via `expo-print`.
- **Delete everything:** wipes the DB file, Keychain entries (including Teller tokens), scheduled notifications, and the widget snapshot. Offer to disconnect banks at Teller too.

## Notifications (local only — no push server)

Scheduled with `expo-notifications`, rescheduled after each sync or settings change:
- Weekly review — Sunday 10 AM (user-adjustable): "Your weekly review is ready — about 10 minutes."
- Card statement due — 2 days before: "Contoso Card statement ($500) is due Wednesday. You're covered."
- Quarterly tax — 7 days before each IRS estimated-tax date (freelance only).
- Late invoice — the morning after an expected income date passes without a matching deposit.
- Deposit landed — after a sync finds a new income deposit: "$10,000 landed. Split it?" (opens `/deposit/[id]`).
Copy follows the voice rules: calm, specific, never alarming. Ask permission at the end of onboarding with one line of explanation, never on first launch.

## Widgets (M8)

- Built as a **WidgetKit extension in Swift/SwiftUI**, added to the Expo project with a config plugin (e.g. `@bacons/apple-targets`) so `expo prebuild` keeps it.
- Shared **App Group** (`group.com.<you>.annum`). After every sync or edit, the app writes `snapshot.json`: `{ ats, perDay, nextIncomeLabel, runwayMonths, runwayTarget, status, updatedAt, isEstimate }` — no account names, no transactions.
- Widgets: **Lock rectangular** ("$1,000 to spend · $50/day · till Oct 13"), **Lock circular** (Runway ring in months), **Home small** (full color, mark + free to spend). Timeline refresh when the app writes a new snapshot (`WidgetCenter.reloadAllTimelines` via a small native call) plus a daily entry at midnight so "days until" stays correct.
- Privacy: widgets show on the lock screen, so Settings gets a toggle: "Show amounts on lock screen" (off → "Tap to see what you can spend").

## Haptics

Light impact on: split confirmed, week reviewed, transfer marked moved. Selection feedback on chip taps. **Never** on heads-up states.

## Distribution & cost

| Item | Cost | Notes |
| --- | --- | --- |
| Apple Developer Program | Already paid by Andy | Enables TestFlight, App Groups (widgets), 1-year signing |
| Expo SDK & tools | Free | |
| Builds | Free | Local builds on Andy's Mac (`npx expo run:ios`) are unlimited; EAS cloud builds are free up to the monthly Free-plan quota — use them for TestFlight releases |
| Teller | Free | Developer tier, up to 100 live bank connections |
| Cloudflare Worker | Free | Free Workers plan; one tiny Worker |
| SQLCipher, Face ID, Keychain, notifications, widgets, SF Symbols | Free | |
| **Total new cost** | **$0** | |

- Bundle ID `com.highdesert.annum`; App Group `group.com.highdesert.annum`.
- Development builds on Andy's iPhone from M0. **TestFlight** internal testing for Andy and the second user from M7 (builds expire after 90 days — re-upload).
- The second user installs via TestFlight with their own Apple ID; their data (and their Teller enrollments) are separate by design.

## Decisions for Andy (defaults chosen; change any)

1. **iPhone only, dark mode only** for v1. Default: yes.
2. **One device per person** with export/import for moving phones. Default: yes.
3. **Lock-screen amounts visible** by default, with the privacy toggle. Default: visible.
4. **Bundle ID / App Group names** under your studio: `com.highdesert.annum`. Default: yes.
5. **Teller + free Worker** for bank data, file import and manual entry as fallbacks. Decided.
