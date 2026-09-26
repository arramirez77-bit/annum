# Progress

Build log for Annum, one milestone at a time (`docs/06-BUILD-PLAN.md`). Public repo: no real names, balances, transactions or secrets here. Real banks are "Bank A", "Bank B"…

## Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| M0 Project setup & dev build | ✅ Done (268f564) | Runs on iPhone + iOS 27 Simulator; 33 tests; lint/typecheck/expo-doctor green; CI green |
| M0.5 Loop setup + spikes | ✅ Done | Baseline; this file; Human checkpoints. Spikes (SPIKES.md): **SQLCipher proven** (4.7.0 linked, file unreadable without key); **widgets plumbing proven** on branch `spike/widgets` (expo-widgets builds with scene support, extension embedded, App Group data written; on-screen render → device, M8); **bank sync pending: provider undecided** |
| M1 Domain engine | ✅ Done | `src/domain/` (13 modules, no RN imports); tests/spec now runs the 25 cases on the real engine, reference copy deleted; 81 tests (was 33); lint/typecheck/format green; Simulator still renders |
| M2 Design system components | ✅ Done | 19 components + Mark/Wordmark in `src/ui/components/`, native TopBar/Sheet presets; dev gallery `app/dev/components.tsx`; token check in `npm run lint`; 97 tests (was 81); Maestro `maestro/gallery.yaml` passes on the iOS 27 Simulator (split edit $2,500 → Free $2,800, Tax chip checked). Not visually compared to Figma screens (H1) |
| M3 Today, Money, What would this do? | ✅ Done | Zustand store + tested view builders (`src/state/`); Today (field cross-fade, count-up), Money (+E3, salary), What-if modal (fits/guardrail, Wait until → deferred purchase), scenario switcher, settings stub. 112 tests. Maestro: 6 scenario flows + what-if + gallery all pass on the iOS 27 Simulator |
| M4 Weekly Review + Deposit split | — | |
| M5 Onboarding, storage, Face ID, Settings | — | |
| M6 Real bank data, background refresh, notifications | — | |
| M7 Polish, accessibility, TestFlight | — | |
| M8 Widgets | — | |

## Baseline (M0.5, 2026-09-25)

- `main` = 268f564, working tree clean, local == origin.
- `npm test`: 33 passed (25 docs/03 spec cases + 5 bucket-sum checks + 3 theme checks). Lint, typecheck pass. CI on main: success.
- Expo SDK 57.0.25 still latest stable (58 in preview). Xcode 27 only → `ios.enableSceneSupport` stays on.
- Metro: port **8082** (8081 belongs to another project).

## Human checkpoints (open)

| # | Needed for | What | Status |
| --- | --- | --- | --- |
| H1 | M2+ visual checks | 40 screen PNGs in `docs/screens/` (git-ignored), **or** a link to the Figma file/branch that has the Screens, component, Tab Bar and Widgets pages. The connected Figma account only sees "Cover" and "Brand — Logo" in the Annum file. | Open |
| H2 | M7 | **Bank sync provider undecided** (Teller has no public sign-up). At M7 I stop with options: Teller (if access), Plaid free Trial (verify limits/terms), SimpleFIN (~$15/yr, needs approval), or file import only ($0) | Pending decision |
| H3 | M7 | Cloudflare account + `wrangler login` — only if the chosen provider needs a server-side proxy (Teller's mTLS does) | Pending H2 |
| H4 | M7 | Which banks to test (kept private; placeholders only in the repo) + go-ahead to use real accounts | Pending H2 |
| H5 | M7 | App Store Connect: create app record (Annum, `com.highdesert.annum`), invite the second user as a team user for internal TestFlight; optional API key (.p8 outside the repo) | Open |
| H6 | M8 | App Group `group.com.highdesert.annum` — likely registered automatically by Xcode; manual clicks only if that fails | Open |
| H7 | M5–M8 | On-device checks: Face ID, notification permission + Sunday reminder, VoiceOver walkthrough, adding lock-screen widgets | Open |
| H8 | M3+ | OK to install Maestro (Homebrew, free, needs Java) for flow tests — assumed yes unless told otherwise | Installed (Maestro 2.10 + OpenJDK 17 via Homebrew, M2) |

## Decisions log

- Milestone numbering follows `docs/06-BUILD-PLAN.md` (M0–M8). The loop instructions mentioned M0.5, TestFlight in "M6" and the App Group in "M9"; the rest of that message was cut off, so docs/06 wins until clarified.
- **Bank sync (Andy, 2026-09-25):** Teller has no public sign-up, so the provider is undecided. File import (S11) and manual accounts (S10) are the data path; sync sits behind a provider interface in `src/data/` so Teller, Plaid or SimpleFIN can plug in later without touching screens. The Teller-only Cloudflare Worker is on hold. At M7: stop and present the options.
- **M0.5 order:** the SQLCipher and widget spikes ran after M3 (they inform M5 storage and M8 widgets, not M1–M4).
- **Widgets approach (proposal, decide at M8):** `expo-widgets` (Expo-maintained) instead of `docs/02`'s `@bacons/apple-targets`; see SPIKES.md §2.

**M1 — defaults chosen where docs/03 is silent (please review):**
1. **No expected income recorded** (freelance): plan over the next **30 days** (`kind: 'none'`), so Today can say "over the next 30 days" and suggest adding an invoice.
2. **Income due today:** per day divides by **1 day**, never 0.
3. **Late invoice + another income due sooner:** the sooner income wins as the next income date; the late flag still triggers heads-up.
4. **What if with nothing spendable** (ATS ≤ 0): the whole purchase counts as coming from Runway.
5. **$0 card statements** (paid) are not subtracted and can't trigger the statement heads-up.
6. **Spending** excludes Income, Transfer, Card payment, Savings categories and pending transactions. **4-week average** = spend in the 28 days before the week ÷ 4.
7. **Split edit that would push Free below 0:** the edited field is capped at what fits (Free = 0) and a heads-up line shows. "Repeat the same edit twice → new default rule" is deferred to M4, where edits are recorded.
8. **Staleness** ignores accounts entered by hand (they're updated in the weekly review, not synced).
9. **Categorization:** merchants normalize (lowercase, store numbers/ref codes, punctuation and Inc/LLC removed); exact rule match wins, else the longest rule that prefixes the merchant. Latest correction replaces the old rule. Reviewed transactions are never re-suggested.
10. **Recurring bills:** ≥ 3 payments to the same merchant, every amount within ±10% of the typical amount, every gap 6–8 days (weekly), 13–15 (biweekly) or 27–32 (monthly); dropped if nothing for more than two cycles. Proposed bills stay unconfirmed until the user confirms.
11. **Money display** rounds down to whole dollars (never overstates what's spendable); transactions show cents.
12. **Demo data** loads through `src/data/demo.ts` (the only place that reads `fixtures/`), keeping `src/domain/` free of I/O.

**M2 — design system (please review; Figma screens not visible yet, see H1):**
1. **New tokens** (values from docs/04 unless marked): `size` (bucketDot 12, pillDot 7, noteDot 8, bucketBar 16, bucketBarGap 3, step 22×4, markMin 16, markLockup 72 from the Figma lockup, radio 22, icon 17, iconSmall 13, hairline 1), `fontScale` (1.3 / 2.0 from the theme comment), `opacity` (pressed 0.8; **disabled 0.4 proposed**), symbols `radioOff`/`radioOn`.
2. **Mark** uses the exact arc paths from Figma "Annum / Mark" (node 53:3), filled from bucket tokens (not a baked SVG), so bucket colors stay in the theme. Today dot: textPrimary on dark, textOnLight on light (matches the Figma "On light" lockup).
3. **Chip colors:** category unselected = raised surface; selected = primary action fill. Tax unselected = Tax-colored outline; selected = Tax fill + checkmark (docs/04).
4. **Button:** destructive = filled statusDestructive with dark text; quiet = secondary text; secondary on the light sheet = subtle dark overlay.
5. **Tab highlight color** stays `textPrimary`: the Figma Tab Bar component isn't visible to the connected account (H1), so it couldn't be checked.
6. **TopBar/Sheet** are native (docs/04 "prefer native"): presets in `src/ui/navigation.ts` (pushed header shown in the gallery; flow header and form sheet used from M3/M4).
7. **Number-pad inputs** have no Return key: screens with inputs use `keyboardDismissMode="on-drag"` and `automaticallyAdjustKeyboardInsets`.
8. **Split amount chip** is 36pt; a surrounding tap area focuses it so the target is 44pt.
9. **Tests:** React Native Testing Library 14 (async `render`/`fireEvent`); Jest mocks `react-native-worklets` and runs Reanimated's `setUpTests()` (`jest.setup.ts`).

**M3 — Today, Money, What would this do? (please review):**
1. **Copy** (docs/05 gives the pattern, not every sentence): late invoice hero "until Oct 22, when we expect the late invoice. About $35 a day." + cause "The Northwind Studio invoice is 4 days late."; statement cause "The Contoso Card statement ($500) lands before your invoice does." (salary: "before payday does"); no income recorded: "over the next 30 days"; low per day: "That's under $20 a day until your next invoice."
2. **Heads-up buttons** ("See what I can move", "See my options") and "Start weekly review" all go to the Review tab until M4 builds the review flow and options.
3. **Demo clock:** demo mode runs at 9:00 AM on the fixture's "today", so "Updated 7:02 AM" and staleness are stable.
4. **Fixture fixes:** the late-invoice scenario now syncs on its own date (Oct 17) and, like salary, has no start-of-week snapshot (`weekStart: null`) — otherwise it read as stale and salary showed "Down 2.8 this week". No test values changed.
5. **What-if bug fixed:** a purchase bigger than Free to spend plus all of Runway showed negative Runway. Runway now stops at 0.0 months and the note says how much more than both it is.
6. **Runway row in estimate mode:** "~6 mo · Estimated from savings · $15k target"; Tax reserve shows "Not set aside yet" until the first split.
7. **Unsplit Money (E3):** "Split my savings now" opens a stub until M4 builds the deposit split.
8. **Screens that scroll under the floating tab bar** use automatic content insets; Today keeps the light sheet color under the tab bar.

## Dependabot (Expo-owned transitive packages — not CI failures, don't downgrade Expo)

| Package | Via | Where it runs | Status |
| --- | --- | --- | --- |
| decode-uri-component 0.2.2 (medium) | expo-router → query-string | App (link parsing) | Open, waiting on Expo |
| uuid 7.0.3 (medium) | expo-splash-screen → @expo/config-plugins → xcode | Build tooling only | Open, waiting on Expo |
