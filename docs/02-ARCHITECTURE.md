# 02 — Architecture: how the app works

## One-paragraph summary

Annum is a **native iPhone app with no database server**. Everything lives on the phone: an encrypted SQLite database holds accounts, transactions, buckets and the bank access tokens; the encryption key lives in the iOS **Keychain**. Bank data comes from **Plaid's free Trial plan**: 10 bank logins for life, shared by both phones. Plaid's API secret must never ship inside an app, so a tiny **Cloudflare Worker** (free plan) holds it and forwards a short list of read-only requests. The Worker stores no financial data; it keeps one number (connections used) so both phones share the count. Banks that won't connect, or connections we'd rather not spend, use **CSV/OFX file import**; brokerage accounts and loans are **entered by hand**. All math (Available to Spend, buckets, runway, guardrails) runs in a pure TypeScript **domain engine**. After each sync the app writes a tiny read-only **snapshot** to a shared App Group so the **widgets** can show "You can spend $1,000" on the lock screen without opening the app.

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
│        │        (also holds Plaid access tokens)            │  │
│        │ HTTPS (read-only)        Keychain (expo-secure-store)│
│        ▼                          • DB key (this device only)│  │
│   Cloudflare Worker (holds Plaid keys; one KV counter)       │  │
│        ▼                          App opens with Face ID     │  │
│   Plaid API (Trial) ─► your banks                            │  │
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
| Data | `src/data/` | SQLite schema + migrations, repositories, Plaid client (via Worker), CSV/OFX importer, sync, export/import, widget snapshot writer | All reads/writes go through repositories. Secrets only via `src/data/secure.ts`. |
| Services | `src/services/` | Face ID lock, notifications scheduler, background refresh, haptics wrapper | Thin wrappers over Expo modules so they can be mocked in tests. |
| State | `src/state/` | Zustand store + selectors that call the domain engine (`useToday()`, `useMoney()`, `useWhatIf(p)`…) | Screens never do money math. |
| UI | `src/ui/components/`, `app/` (Expo Router) | Components from `04-DESIGN-SYSTEM.md`; routes from `05-SCREENS.md` | Theme tokens only. Every screen handles its states. |
| Widget | `targets/widget/` (Swift) | Lock-screen rectangular + circular, home small | Reads `snapshot.json` from the App Group. Never reads the database. |
| Worker | `worker/` (Cloudflare) | Plaid proxy holding the Plaid keys; counts connections | Allowlisted Plaid calls and Trial products only; one KV number, no financial data; no logging of bodies/tokens. |

## Two modes

1. **Demo mode** — loads `fixtures/seed.json`; the **scenario switcher** (long-press the status pill; also `app/dev/scenarios.tsx` in dev builds) applies overrides from `fixtures/scenarios.json`. Used to build and test every screen before real data.
2. **Real mode** — after onboarding connects banks through Plaid (or imports files, or takes balances by hand). Same domain engine, real data.

## Bank data (Plaid Trial via a free Worker, plus import and manual)

**The plan:** Plaid's free **Trial**: real bank data, **10 bank logins (Items) for life, shared by both phones**. Removing a connection doesn't give the slot back, and connecting the same bank again makes a new Item. Sandbox (fake banks) is free and unlimited and is used while building. Never apply for "Production access" in the Plaid Dashboard: it's one-way and starts monthly billing. Never add paid products.

**Connecting (O3, O4 "Add another bank", Settings → Accounts):**
- Before Link opens, Annum confirms the cost: "This uses 1 of your 10 bank connections. 7 left for both phones." With none left, it explains and offers file import.
- The app asks the Worker for a link token. The Worker checks the connection count, then calls `/link/token/create` with `client_name: "Annum"`, `products: ["transactions"]`, `country_codes: ["US"]`, `language: "en"`, a random per-phone `user.client_user_id` (no personal data), `transactions.days_requested: 730` (fixed once the Item exists), and the OAuth `redirect_uri`.
- **Plaid Link** runs through Plaid's React Native SDK (`react-native-plaid-link-sdk`, built on Expo Modules; works in development builds). It isn't yet tested by Plaid on Expo 57 / iOS 27, so M7 starts with a short spike; the fallback is Plaid's **Hosted Link** in an `ASWebAuthenticationSession` (no native module). WebViews are deprecated by Plaid.
- **OAuth banks** (Chase, Bank of America, Wells Fargo, Capital One…) need an https redirect that opens the app (a universal link). The Worker serves the `apple-app-site-association` file on its workers.dev address; the app declares that domain in `ios.associatedDomains`, and the exact redirect URI is registered in the Plaid Dashboard.
- On success the app sends the `public_token` to the Worker, which exchanges it (`/item/public_token/exchange`), adds 1 to the connection count, and returns the access token and Item ID. The app stores them in the encrypted database (`connections` table) with the sync cursor. Plaid recommends keeping tokens on a server; Annum has no server by design, so tokens live only on the phone, encrypted, and in encrypted backups (so a lost phone doesn't lose a connection that can never be replaced).
- **Repairs never use a new connection:** when Plaid says a connection needs the person to sign in again (`ITEM_LOGIN_REQUIRED` and similar), the account shows **Reconnect**, which opens Link in **update mode** (link token created with the existing `access_token`, no products). Update mode is always allowed, even with 0 connections left.

**Syncing:**
- `/transactions/sync` per connection, from the saved cursor: loop while `has_more`; store `next_cursor`; on `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` restart from the original cursor. `added`/`modified`/`removed` map to `Transaction`, deduped by Plaid's `transaction_id`; a posted transaction replaces its pending one (`pending_transaction_id`). Right after linking, a sync may be empty or `NOT_READY`; that's a calm "Getting your transactions…" state.
- Balances from `/accounts/get` (cached by Plaid, refreshed about daily) on each sync; a pull-to-refresh can ask for live balances (`/accounts/balance/get`, free on Trial). Card statement balance and due date from `/liabilities/get` (Liabilities is included in the Trial).
- When: on app open if the last sync was over 6 hours ago, on pull-to-refresh, and opportunistically via background refresh. Show "Updated 7:02 AM", never "live". No webhooks (no server to receive them).
- Imported files and hand-entered accounts keep working next to connected banks.

**The Worker (Cloudflare, free plan):**
- Holds `PLAID_CLIENT_ID`, `PLAID_SECRET` and `ANNUM_WORKER_KEY` as Cloudflare secrets; `PLAID_ENV` is `sandbox` or `production`.
- Accepts only requests with the right `X-Annum-Key` (the Worker URL is public; without this anyone could create link tokens and use up connections), rate-limits them, and forwards only an allowlist: link token (Trial products only), token exchange, transactions sync, accounts, balance, liabilities, item get, and item remove (only when the person chooses "end my bank connections").
- **One number in Workers KV:** connections used in production. New connections are refused at 10. KV is eventually consistent (two phones connecting within about a minute could both see the same number), so Plaid's Dashboard **Usage** page is the source of truth, and the Worker's number can be corrected with one `wrangler kv` command.
- Logs nothing from request bodies or responses; no tokens, balances or transactions are stored.

**Fallbacks:**
- **Import a file (S11):** `expo-document-picker` plus "Open in Annum" document types. CSV (column mapping remembered per bank) and OFX/QFX. Dedupe by bank ID, else date + amount + normalized merchant. Also the way to add a bank without spending a connection.
- **By hand (S10):** balance-only accounts (brokerage, loans), updated in Weekly Review step 1.

**Failures are states:** Link cancelled or failed → E4 "That bank didn't connect" (nothing saved, no connection used; Try again / Import a file instead); a connection needs signing in again → Reconnect and the stale note; > 48h old → E1; offline → "Offline — showing what's on this phone."

## Storage & security

- **Database:** `expo-sqlite` with SQLCipher enabled (via the module's config plugin option). Tables: `accounts`, `transactions`, `bills`, `expected_income`, `deposits`, `splits`, `reviews`, `rules`, `deferred`, `settings`, `meta`, and (M7) `connections` for Plaid Items: access token, item ID, sync cursor, status.
- **Key:** 256-bit random key generated on first run, stored in the Keychain as "when unlocked, this device only" (protected by the iPhone passcode). The app itself is gated by Face ID (below). The key isn't behind Face ID directly: expo-secure-store's Face ID option loses the item whenever Face ID changes and has no passcode fallback (M5 decision).
- **Lock:** Face ID on cold start and after 5 minutes in the background (`expo-local-authentication`), device passcode fallback. Screens S5/E6. `NSFaceIDUsageDescription`: "Annum uses Face ID to keep your money private."
- **Privacy screen:** blur/cover the app in the App Switcher snapshot.
- **Backups:** iCloud device backup includes the encrypted DB; the key is `ThisDeviceOnly`, so **restoring to a new phone needs an export**. *Export all data* (a copy encrypted with a passphrase, via the share sheet) and *Import backup* in Settings. The backup includes the Plaid access tokens, so a restore reconnects banks **without using any of the 10 connections**; because of that, a backup with bank connections needs a passphrase of at least 12 characters.
- **Exports:** CSV of tax-tagged transactions for the accountant (share sheet); PDF summary via `expo-print`.
- **Delete everything:** wipes the DB file (with the Plaid tokens), Keychain entries, scheduled notifications, and the widget snapshot. It warns first that reconnecting banks later uses new connections (with the count), and offers "Also end my bank connections at Plaid" (off by default: ending them means a backup can't bring them back, and ended connections still count).

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
| Plaid | Free | Trial plan: 10 bank logins for life (shared by both phones). Never upgrade; never add paid products |
| Cloudflare Worker + KV | Free | Free Workers plan; one tiny Worker and one KV number |
| SQLCipher, Face ID, Keychain, notifications, widgets, SF Symbols | Free | |
| **Total new cost** | **$0** | |

- Bundle ID `com.highdesert.annum`; App Group `group.com.highdesert.annum`.
- Development builds on Andy's iPhone from M0. **TestFlight** internal testing for Andy and the second user from M7 (builds expire after 90 days — re-upload).
- The second user installs via TestFlight with their own Apple ID; their data and bank connections are separate by design, but both phones share the Trial's 10 connections.

## Decisions for Andy (defaults chosen; change any)

1. **iPhone only, dark mode only** for v1. Default: yes.
2. **One device per person** with export/import for moving phones. Default: yes.
3. **Lock-screen amounts visible** by default, with the privacy toggle. Default: visible.
4. **Bundle ID / App Group names** under your studio: `com.highdesert.annum`. Default: yes.
5. **Plaid Trial + free Worker** for bank data, file import and manual entry as fallbacks. Decided (Andy, 2026-09-26; Teller appears to have withdrawn its API in July 2026).
