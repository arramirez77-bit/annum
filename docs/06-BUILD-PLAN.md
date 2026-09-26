# 06 — Build plan (Expo)

Nine milestones. Each ends with something Andy can open on his iPhone and check. Build strictly in order: the domain engine comes before any UI, UI runs on demo data before real bank data, and widgets come last. Paste each milestone's prompt into Claude Code to start it.

| # | Milestone | Andy can check | Rough size |
| --- | --- | --- | --- |
| M0 | Project setup & dev build | A dark "Annum" screen running on his iPhone | small |
| M1 | Domain engine | Test report: all 16 cases pass | medium |
| M2 | Design system components | Component gallery on his phone | medium |
| M3 | Today, Money, What would this do? | Tabs work on demo data; scenario switcher flips states | medium |
| M4 | Weekly Review + Deposit split | Full review flow; editable split | large |
| M5 | Onboarding, encrypted storage, Face ID, Settings | Data survives restarts; Face ID lock; export/delete | large |
| M6 | Real bank data (Teller + Worker + file import), background refresh, notifications | Real balances on Today; Sunday reminder arrives | large |
| M7 | Polish, accessibility, TestFlight | App installed from TestFlight on both phones | medium |
| M8 | Widgets | "You can spend" on the lock screen | medium |

Andy's prerequisites: Apple Developer Program (already has it) before M0; free Teller developer account and free Cloudflare account before M6. **Budget: $0 new costs** — Claude Code must not add paid services.

---

## M0 — Project setup & development build

**Goal:** an empty but real app on Andy's iPhone, with tooling in place.

Acceptance:
- Expo (latest stable SDK), TypeScript strict, Expo Router with native tabs, iOS only, dark appearance, bundle ID `com.highdesert.annum`.
- Folders per `02-ARCHITECTURE.md`; `fixtures/` copied in; `src-starter/theme.ts` → `src/theme/index.ts`; path alias `@/`.
- Installed: Zustand, Reanimated, react-native-svg, safe-area-context, expo-symbols, expo-haptics (others added in their milestone).
- Jest (`jest-expo`), ESLint, Prettier; `npm test` works.
- EAS configured; a **development build** installed on Andy's iPhone; hot reload works.
- README explains setup step by step, including the Apple Developer steps Andy must click through.

> **Prompt:** "Read CLAUDE.md and all of docs/. Then do milestone M0 from docs/06-BUILD-PLAN.md. Check the current Expo SDK docs first and tell me the SDK version you're using. List the files and commands before you start, and tell me exactly when I need to do something on my phone or on developer.apple.com."

## M1 — Domain engine

**Goal:** all money logic, pure and tested, before any UI.

Acceptance:
- `src/domain/`: types, money (ATS, per day, runway), dates (local calendar math), waterfall, whatIf, transfer, status, report, scenarios (deep-merge loader), categorize (rules), recurring (detection).
- All 16 test cases in `03-DATA-MODEL.md` pass, plus edge cases: no expected income, income today, negative ATS, empty transactions, DST change.
- Integer cents throughout; no React Native imports in `src/domain/`.

> **Prompt:** "Do M1. Implement src/domain exactly per docs/03-DATA-MODEL.md, test-first with Jest. Show me the test output. If any formula is ambiguous, ask me before choosing."

## M2 — Design system components

**Goal:** every component in `04-DESIGN-SYSTEM.md`, theme-only.

Acceptance:
- All components and variants; Annum mark in SVG; SF Symbols via expo-symbols.
- `app/dev/components.tsx` gallery (dev only) with every state, viewable on the phone.
- No raw colors/sizes outside `src/theme` (grep check included in `npm run lint`).
- VoiceOver labels, 44pt targets, Dynamic Type caps, Reduce Motion respected.

> **Prompt:** "Do M2. Build the components in docs/04-DESIGN-SYSTEM.md in order, with the dev gallery. Compare against the PNGs in docs/screens/. Prove with a grep that no hardcoded colors exist outside src/theme."

## M3 — Today, Money, What would this do?

**Goal:** the daily loop on demo data, fully state-driven.

Acceptance:
- Native tabs (Today · Review · Money); Today, Money, `what-if` modal; settings button routes to a stub.
- Store loads `seed.json`; scenario switcher (long-press pill + `app/dev/scenarios.tsx`) applies each scenario with no hard-coded screens.
- Today: $1,000 / $50 on track; $200 heads-up with a 600ms umber cross-fade and Caution button; stale, late, estimate, and salary per `05-SCREENS.md`.
- What would this do?: typing 200 → $800 and $40/day; 2,000 → Runway 3.9 mo + guardrail; "Wait until" creates a deferred purchase.
- Count-up numbers (400ms, ease-out expo) with Reduce Motion fallback.
- Maestro flow for each scenario.

> **Prompt:** "Do M3. Build Today, Money and What would this do? from docs/05-SCREENS.md with M2 components and M1 selectors, plus the scenario switcher. Add Maestro flows for all six scenarios and show me they pass."

## M4 — Weekly Review + Deposit split + Transactions/Taxes

Acceptance:
- `review/[step]` stack with Back, StepIndicator, "Finish later" (progress saved); 07b only on the first review.
- Tagging pre-selects suggestions; corrections write merchant rules; Tax chip updates the Taxes total; selection haptics.
- Move money: computed suggestion ($1,050 on seed) vs habit; "Open Woodgrove" via Linking; "I already moved it" → pending transfer shown on step 6.
- Week reviewed report (scrolls): spent-vs-allowance bar, top 3 categories, pending transfer, next review date; light haptic on Done.
- Deposit: O6 quick setup (first time) → 09 split form sheet; editing any amount keeps the total; bar animates; confirm updates buckets (haptic).
- Transactions list with filters; Taxes screen with CSV export (share sheet) and PDF (expo-print).

> **Prompt:** "Do M4 per docs/05-SCREENS.md. Follow the split-editing rule in docs/03-DATA-MODEL.md exactly (Free absorbs changes; total never changes). Add Maestro coverage for a full review and a deposit split."

## M5 — Onboarding, encrypted storage, Face ID, Settings

Acceptance:
- First run: Welcome → Income → Connect (demo path, "Import a file", "Enter balances by hand") → Accounts → O4b Face ID → O4c Reminders → Today in estimate state.
- S9 Transaction detail, S10 Edit balance, and the compact Today layout (01c) for screens under 700pt tall.
- expo-sqlite with SQLCipher; key generated on first run and stored in the Keychain (Face ID gated); migrations in place.
- Lock screen on cold start and after 5 min in background; passcode fallback; App Switcher snapshot blurred.
- Settings: modules hide features everywhere; numbers editable; export encrypted backup + import; Delete everything wipes DB, Keychain, notifications, snapshot.
- Salary mode verified end to end.

> **Prompt:** "Do M5. Follow the storage and security section of docs/02-ARCHITECTURE.md exactly. Explain in plain language where my data lives and what happens if I get a new phone. Show that a restart keeps data and Delete everything removes it."

## M6 — Real bank data, background refresh, notifications

Acceptance:
- **Worker** (`worker/`): Cloudflare Worker on the free plan with the Teller client certificate as an mTLS certificate binding; allowlisted read-only Teller paths; `X-Annum-Key` check; rate limit; no storage; no logging of bodies or tokens. Deployed with `wrangler`; README explains the one-time certificate upload.
- **Teller Connect** in a WebView sheet from O3 (sandbox first, then real data); access tokens saved in the Keychain; E4 on cancel/failure.
- Sync through the Worker: accounts, balances, transactions; dedupe by Teller ID; pending vs posted handled; "Updated 7:02 AM" on Today.
- Sync on open (>6h), pull-to-refresh, and background refresh; re-auth needed → "Reconnect" state.
- **File import** (S11): CSV (remembered column mapping per bank) and OFX/QFX; dedupe; result summary.
- **Manual accounts** (S10) for brokerage and loans.
- Recurring bills proposed; categorization rules applied.
- Local notifications per `02-ARCHITECTURE.md` with deep links; rescheduled after each sync.
- Verified with Andy's real accounts, with his go-ahead; demo mode still available in dev builds.

> **Prompt:** "Do M6. First read Teller's current docs (Connect, environments and free-tier limits, accounts/balances/transactions endpoints, mTLS) and Cloudflare's docs on mTLS certificate bindings for Workers, and confirm both work on free plans. Tell me what you found before writing any code. Keep the total cost at $0. Never log tokens, balances, or transactions."

## M7 — Polish, accessibility, TestFlight

Acceptance:
- Motion pass per the interaction table (count-ups, field cross-fade, sheets, bar resize) with Reduce Motion fallbacks; haptics per `04-DESIGN-SYSTEM.md`.
- Accessibility: VoiceOver walkthrough of Today, What would this do?, and the Weekly Review; largest Dynamic Type size before accessibility sizes doesn't clip; AA contrast.
- App icon from the mark, layered for iOS 26 appearances; launch screen `bgBase`.
- EAS production build → TestFlight internal testing; installed on Andy's and the second user's iPhones.
- README: install via TestFlight, back up/restore, what to do every 90 days (TestFlight expiry).

> **Prompt:** "Do M7 and run the full Definition of Done from CLAUDE.md. Then walk me through adding my wife as a TestFlight tester."

## M8 — Widgets

Acceptance:
- WidgetKit extension (SwiftUI) added via an Expo config plugin so it survives `expo prebuild`; App Group shared with the app.
- App writes `snapshot.json` after each sync/edit and asks WidgetKit to reload; a midnight timeline entry keeps "days until" correct.
- Lock rectangular ("$1,000 to spend · $50/day · till Oct 13"), Lock circular (Runway ring), Home small (mark + free to spend), matching the Figma **Widgets** page.
- "Show amounts on lock screen" setting respected.
- Heads-up and estimate states reflected in widget copy; no account names or transactions in the snapshot.

> **Prompt:** "Do M8. Add the widget extension per the Widgets section of docs/02-ARCHITECTURE.md. Explain the App Group setup I need to confirm on developer.apple.com, and show me each widget on my lock screen."

---

## Test plan with real people (after M5 and after M7)

- **First run:** can each person finish without asking anything? Time it against "about 3 minutes."
- **Findability:** "Find last week's grocery spending."
- **Trust:** after tagging with pre-selected suggestions, would they trust the Taxes total?
- **Salary mode:** the second user confirms nothing mentions freelancing or taxes.
- **Glance (after M8):** does the lock-screen widget change how often they open the app?
