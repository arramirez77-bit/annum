# 05 — Screens and routes

Screen IDs match the Figma frame names and the PNG filenames in `docs/screens/`. Figma copy is the source for wording; **numbers always come from the domain engine**, never from the mocks. The mocks show the same fictional sample data as `fixtures/seed.json`.

## Route map (Expo Router files)

```
app/
  _layout.tsx                  Root stack: providers, Face ID lock gate, first-run redirect
  lock.tsx                     S5 Locked · E6 Face ID failed
  (onboarding)/
    welcome.tsx                O1
    income.tsx                 O2 (Step 1 of 2)
    connect.tsx                O3 Connect (Plaid Link) · E4 bank didn't connect (Step 2 of 2)
    accounts.tsx               O4 Accounts found (+ add brokerage/loan by hand)
    face-id.tsx                O4b Keep it private with Face ID
    reminders.tsx              O4c Want a nudge on Sundays? → Today (estimate)
  (tabs)/
    _layout.tsx                Native tabs: Today · Review · Money
    index.tsx                  01 Today (+02 heads-up, O5 estimate, E1 stale, E2 late, P2 salary, 01c compact)
    review/
      _layout.tsx              Stack; progress saved on "Finish later"
      [step].tsx               04 Balances · 05 Tag · 06 What changed · 07b Habit (first review) · 07 Move money · 08 Week reviewed
    money/
      _layout.tsx              Stack
      index.tsx                03 Money · E3 not split yet · P2 Money salary
      transactions.tsx         S1 · E5 none yet
      transaction/[id].tsx     S9 Transaction detail (category, tax, rule, split)
      taxes.tsx                S2 (hidden when Tax module off)
  what-if.tsx                  10 fits · 11 guardrail            presentation: 'modal'
  deposit/[id]/setup.tsx       O6 first-deposit quick setup      presentation: 'formSheet'
  deposit/[id]/index.tsx       09 Deposit split                  presentation: 'formSheet'
  income/new.tsx               S4 Add expected income            presentation: 'modal'
  account/[id]/balance.tsx     S10 Edit balance (manual accounts) presentation: 'formSheet'
  import.tsx                   S11 Import a file (CSV/OFX)
  pair.tsx                     Pair this phone (opened by the QR code from `npm run worker:rotate-key`)
  bank/connect.tsx             Connect a bank: "uses 1 of your 10" → Plaid Link · E4 · Reconnect (?item=)  presentation: 'formSheet'
  invest.tsx                   S6 Invest handoff
  deferred/[id].tsx            S7 Waited-on purchase             presentation: 'formSheet'
  settings/index.tsx           S3 Settings (pushed from Today header)
  settings/delete.tsx          S8 Delete everything              presentation: 'modal'
  dev/scenarios.tsx            Scenario switcher (__DEV__ / demo mode only)
  dev/components.tsx           Component gallery (__DEV__ only)
```

Deep links from notifications: `annum://review/1`, `annum://deposit/{id}`, `annum://` (Today).

## Screen specs

### 01 Today (`/`)
- **Header**: "Sep 23 · Updated 7:02 AM" (or "Updated Sep 20" when stale) · StatusPill · settings symbol → `/settings`. The update time is the trust signal — always visible.
- **Hero**: "You can spend" / `$ATS` (Hero, counts up) / "until your next invoice on {date}. About ${perDay} a day." Salary: "until payday on {date}." Estimate/stale: "You can spend about".
- **Sheet facts** (LedgerRow light): Runway (bucket dot, months, "Up X this week · ${target} target"), Tax reserve (freelance only, next quarterly date; tap → S2 Taxes), "What would this do?" row → `/what-if`. Mixed lists use BucketDot `none` so titles align.
- **Button**: Field "Start weekly review" (on-track) · Caution "See what I can move" (heads-up) · "Do my first weekly review" (estimate).
- **States**: on-track (green field), heads-up (umber, cross-fade 600ms, cause sentence e.g. the Contoso Card statement), estimate (pill "Estimate"), stale (light heads-up GuardrailNote on the sheet), late invoice (umber, "{source} invoice is N days late", per-day stretched, button "See my options"), salary (no tax row).
- Light TabBar floats over the sheet.

### 03 Money (`/money`)
- Title "Money", subtitle "Where every dollar in savings is spoken for."
- Savings total; BucketBar; BucketRow (card) × 5 in fixed order with notes; grouped links "All transactions" → S1, "Taxes · 2026" → S2 (hidden if Tax off).
- **E3 not split yet**: muted bar, info note showing what a split would look like, Primary "Split my savings now" → deposit split for the unsplit balance.

### Weekly Review (`/review/1…6`)
Top bar on every step: Back (not on step 1) · StepIndicator · "Finish later" (saves progress, returns to Today).
1. **04 Balances**: LedgerRows per account (synced time or "Entered by hand"); heads-up note for manual accounts; Primary "Looks right". Tap a manual account to edit its balance.
2. **05 Tag**: "12 new this week. We've guessed each category…"; TransactionCards with the suggested category **pre-selected**; Tax chip last; Primary "Looks right · Next". Corrections write merchant rules.
3. **06 What changed**: three stacked delta cards (Free to spend, Runway, Tax reserve) with bucket dots, big values, one-line deltas; an info note for the week's notable change.
4. **07b Habit** (first review only): AmountInput "I usually move" + SegmentedControl cadence; info note previewing this week's suggestion.
5. **07 Move money**: "Move" / `$suggestion` (Display) / "from savings to checking." + "Change amount"; breakdown LedgerRows; heads-up note when above habit; Primary "Open {bank} to move it" (`Linking.openURL` to the bank app if installed, else its website), Secondary "I already moved it" → marks transfer **pending**.
6. **08 Week reviewed** (scrolls): "You spent $X" (Display) + spent-vs-allowance bar (Free segment + heads-up overflow); "Where it went" top 3 categories vs usual; "What's left": Free to spend + pending transfer row; "Next review Sunday, Sep 27. We'll remind you." (local notification); Primary "Done". Sets `isEstimate=false` after the first completion.

### 10–11 What would this do? (`/what-if`)
- Cancel; title; AmountInput (focused, numeric keypad) "If I spend"; result LedgerRows (Free to spend, per day, Runway) recompute on every keystroke with count-up.
- **Fits**: info note; Primary "Got it", Quiet "Try another amount".
- **Guardrail** (Runway would drop): heads-up note naming the wait-until date; Primary "Wait until {date}" (creates a DeferredPurchase), Quiet "Buy anyway".

### O6 + 09 Deposit (`/deposit/:id/setup`, `/deposit/:id`)
- **O6** (first deposit only): SegmentedControl tax % (25/30/35), SegmentedControl Runway target (3/5/6 months × monthlySpend); info note with live consequence; Primary "See the split".
- **09 Split**: "$10,000 just landed"; BucketBar (animates); BucketRow split × 5 with editable amount chips (Free absorbs changes); info note; Primary "Confirm split", Quiet "Edit amounts".

### Onboarding
- **O1 Welcome**: mark, wordmark, "Money, by the year.", three promises with bucket dots, Primary "Get started", Quiet "How your data stays private", "About 3 minutes. Every step can be skipped." 
- **O2 Income type** (Step 1 of 2): OptionCards Freelance · Salary · Both → sets `incomeType` and modules.
- **O3 Connect** (Step 2 of 2): numbered steps (Choose your bank → Sign in on your bank's secure page → Accounts appear), privacy note ("Free and read-only…"); Primary "Connect a bank" (Plaid Link), Secondary "Import a file from my bank" → S11, Quiet "Enter balances by hand". Before Link opens, a confirmation names the cost in connections: "This uses 1 of your 10 bank connections. 7 left for both phones." (see **Bank connections** below). **E4**: "That bank didn't connect" — nothing was saved and no connection was used; Primary "Try again", Quiet "Import a file instead".
- **O4 Accounts found**: LedgerRows; brokerage and loans marked "entered by hand" / "tap to add balance" (→ S10); Secondary "Add another bank" (same confirmation as O3); Primary "Continue".
- **O4b Face ID**: lock symbol, "Keep it private with Face ID", passcode-fallback note; Primary "Turn on Face ID", Quiet "Not now".
- **O4c Reminders**: the four reminder types with timing; Primary "Turn on reminders" (system permission prompt), Quiet "Not now" → Today in estimate state.

### Supporting
- **S1 Transactions**: filters (Chip), grouped by day, LedgerRows (merchant, "Category · Tax · Account", amount). Tap → S9.
- **S9 Transaction detail**: merchant, amount (Display), date · account; category chips; Taxes group (Work expense toggle, Tax category); "Always treat {merchant} this way" (writes a rule); "Split this charge"; autosaves with a quiet confirmation note.
- **S10 Edit balance** (sheet): account name, AmountInput "Balance today" with last-updated helper; Primary "Save", Quiet "Stop tracking this account".
- **S11 Import a file**: three numbered steps, last-import result row (range, new, duplicates skipped); Primary "Choose file", Quiet "How to download from {bank}". **E5 empty**: info note + Secondary "Add one by hand".
- **S2 Taxes**: tagged total sentence; categories; Tax reserve row; Primary "Export for my accountant" (CSV via share sheet), Quiet "Export as PDF" (`expo-print`).
- **S3 Settings** (scrolls): Modules toggles; Your numbers (tax %, Runway target, usual transfer, paycheck, monthly spending, bills — tap to edit); Accounts (each account; "Bank connections: 7 of 10 left"; a connection that needs signing in again shows **Reconnect**, which repairs it without using a new one; "Add a bank" with the O3 confirmation; "Add an account by hand"; "Import a file"); Notifications (Weekly review day/time, Card statements, Quarterly taxes, Deposits and late invoices). Privacy (Face ID lock, Show amounts on lock screen, Export all data, Import backup, Delete everything).
- **S4 Add expected income**: AmountInput, source, date; info note about late invoices; Primary "Add".
- **S5 Locked / E6**: mark, "Your money stays on this phone.", Secondary "Unlock with Face ID"; failure → "Face ID didn't recognize you." + Quiet "Use passcode".
- **S6 Invest handoff**: "$X is ready to invest" (Hero); LedgerRows Runway/Invest with dots; info note (Annum doesn't pick investments); Primary "I moved it", Quiet "Remind me tomorrow"; Close.
- **S7 Waited-on purchase** (sheet): "Your invoice landed"; LedgerRows; Buy it / Wait again / Drop it.
- **S8 Delete everything**: what goes; heads-up note; when banks are connected, a second heads-up: "Reconnecting banks later uses new connections — 7 of 10 left for both phones. A backup brings these connections back without using any." and a toggle "Also end my bank connections at Plaid" (off by default; turning it on means a backup can't bring them back); AmountInput "Type DELETE to confirm"; Secondary "Export my data first"; Destructive button disabled until the field equals DELETE.

### Bank connections (Plaid Trial — the limit is for life)
Annum runs on Plaid's free Trial: **10 bank logins in total, for life, shared by both phones**. Ending a connection doesn't give it back. So:
- Every new connection is confirmed first, with the count ("This uses 1 of your 10 bank connections. 7 left for both phones."). With none left, "Connect a bank" explains why and offers "Import a file" instead.
- A broken connection (the bank asks you to sign in again) is always repaired in place (**Reconnect**, Plaid's update mode), never by connecting again.
- The count comes from the Worker, so both phones see the same number.
- Backups carry the connections, so restoring on a new phone uses none.
- **Access key:** a phone talks to the Worker only with the key it scanned from Andy's laptop. When the key is replaced (a lost phone), connected accounts show "Scan the new code from your laptop" (heads-up, not an error), and Settings → Accounts has "Scan a new access code". Scanning opens **Pair this phone**: "This phone can reach your banks again." Nothing about the bank connections changes.

## States checklist (every screen)

| State | Treatment |
| --- | --- |
| Loading / syncing | Skeleton rows in surface color; never a bare spinner. Numbers keep their last value with an "Updating…" footnote; pull-to-refresh triggers a sync. |
| Empty | Explain why + the first action (E3, E5 patterns) |
| Stale (>48h) | Heads-up note naming the bank and date; "about" prefix |
| Offline | Footnote "Offline — showing what's on this phone." Actions that need the network are disabled with a reason. |
| Locked | Content hidden behind S5; App Switcher snapshot blurred |
| Connection problem | E4 pattern: nothing was saved (and no bank connection used), what to do next. A connection that needs signing in again → Reconnect |
| Heads up | Umber, cause + one action; never red |
