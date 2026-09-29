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
  account/[id]/index.tsx       One account's Transactions (S1 filtered; from a Settings account row)
  transaction/[id].tsx         S9 from one account's Transactions (root stack, above Settings)
  add-account.tsx              S12 Add an account (light sheet)  presentation: 'formSheet'
  import.tsx                   S11 Import a file (CSV/OFX)
  pair.tsx                     Pair this phone (opened by the QR code from `npm run worker:rotate-key`)
  bank/connect.tsx             Connect a bank: "uses 1 of your 10" → Plaid Link · E4 · Reconnect (?item=)  presentation: 'formSheet'
  invest.tsx                   S6 Invest handoff                 presentation: 'modal'
  deferred/[id].tsx            S7 Waited-on purchase             presentation: 'formSheet'
  account/new.tsx              S13 Add an account by hand (from S12)  presentation: 'formSheet'
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
- **S1 Transactions** (Figma 64:656): Title 1; filters All · "Needs a tag · N" · "Work expense" (Tax chip, hidden when Tax is off); grouped by day ("Today", "Yesterday", weekday this past week, then "Sep 14"); LedgerRows without chevrons (merchant, "Category · Work expense · Account", "$80.00" spent / "+$5,000.00" received). Tap → S9. Quiet "Add one by hand" (no frame, kept). **For one account** (from a Settings account row): the account's name as the title, its transactions only, no account name on rows. **E5 none yet** (Figma 71:992): "No transactions yet. They show up after your first sync, usually within an hour of connecting a bank." + Secondary "Import a file".
- **S9 Transaction detail** (Figma 99:1244): Title 2 merchant, Display amount, Callout date · account; Category chips; Taxes group (Work expense toggle; the Tax category row's list isn't designed yet, so the categories stay as chips); a switch "Always treat {merchant} this way" (on writes the rule, off forgets it); "Split this charge" once designed; Footnote "In your 2026 tax list. Changes save as you go." (tagged) or "Changes save as you go.", replaced by a quiet "Saved." after each change.
- **S10 Edit balance** (sheet): account name, AmountInput "Balance today" with last-updated helper; Primary "Save", Quiet "Stop tracking this account".
- **S11 Import a file** (Figma 99:1325): Title 1 "Import from your bank"; Callout "For banks that don't connect. Works with the CSV or OFX file most banks let you download."; three numbered steps (Download transactions · Choose the file · Check what we found, each with a Footnote line); "Last import" row ("Woodgrove checking", "Aug 1 to Sep 22 · 214 new, 12 skipped", "Added"); pinned Primary "Choose file", Quiet "How to download from your bank" (the bank's name isn't known).
- **S2 Taxes** (Figma 64:716): Title 1 "Taxes · 2026"; Callout "$3,800 in work expenses tagged this year. Your accountant gets this list, sorted."; categories; "Set aside" (Subhead) with the Taxes row (bucket dot, "Next quarterly payment Jan 15"); Primary "Share with my accountant" (CSV via share sheet), Quiet "Save as PDF" (`expo-print`).
- **S3 Settings** (Figma 64:765, scrolls): Title 1; "Turn off features you don't use" (Taxes, Debt "Coming later", Invest); Your numbers (Monthly spending, Bills with "N to look at" when files suggested some, Expected income "Add" → S4, then Set aside for taxes, Runway target, Usual transfer, Paycheck — tap to edit); Accounts ("5 accounts" on the right): one card per bank ("Connected · synced 7:02 AM"; a bank that needs signing in again shows **Reconnect**, which repairs it without using a new one), "From files" ("Updated when you import a file"), "Entered by hand" ("You update these balances"); bank and file accounts open that account's Transactions, accounts by hand open S10; "Add an account" → S12; Footnote "8 of 10 bank logins left. Refreshing a bank you already connected doesn't use one." (+ "Test banks don't count." in development builds). Reminders (Weekly review "Sun 10 AM", Card statements, Quarterly taxes, Deposits and late invoices). Privacy (Face ID lock, Show amounts on lock screen, Export all data, Restore from a backup, Delete everything). The app version sits at the bottom (no frame).
- **S12 Add an account** (Figma 117:1778, light sheet): Title 2 + Close; Connect a bank → bank/connect (O3 confirmation), Enter a balance by hand → S13, Import a file → S11, Scan an access code → Pair ("Pair this phone with the code from your laptop."); Footnote "8 of 10 bank logins left." (+ the development hint).
- **S4 Add expected income**: AmountInput, source, date; info note about late invoices; Primary "Add".
- **S5 Locked / E6**: mark, "Your money stays on this phone.", Secondary "Unlock with Face ID"; failure → "Face ID didn't recognize you." + Quiet "Use passcode".
- **S6 Invest handoff** (Figma 65:829; opens after a split that puts money in Invest, and from Money's Invest card): Close; "Runway is full"; Hero amount; Sentence "is ready to invest. Your savings now cover 5 months, which was your target."; Runway ("Hit its target with this deposit") and Invest ("Waiting to be moved") rows with dots; info "Annum doesn't pick investments. Move it in {first brokerage account}, then mark it here so your buckets stay accurate."; Primary "I moved it", Quiet "Remind me tomorrow" (one local reminder at 9 AM, no amounts). After "I moved it" (no frame): "Moved $X to {account}", "Pending until it leaves {savings bank}…", a one-tap "Add $X to {account}" when that account is entered by hand, Primary "Done". See docs/03 "Invest handoff".
- **S7 Waited-on purchase** (Figma 65:864, sheet; opens after an invoice's split when a purchase is waiting): "Your invoice landed"; "On Sep 23 you waited on a $2,000 purchase. It fits now." ("Earlier you…" for waits saved before the date was kept); rows "If you buy it now" (Comes out of Free / "$X of it comes out of Runway") and "Runway after"; Primary "Buy it", Secondary "Wait again" (to the next income date), Quiet "I don't need it".
- **09 / 09b / S14 split sheet** (Figma 58:137, 129:1913, 129:1771; fits its content): centered Title 2 ("$10,000 just landed" / "$19,100 in savings") and Callout ("Here's where it goes…" / "Here's a starting split…"); BucketBar; flat bucket rows with amount chips (tap one to change the split); info note (Runway fills / is $X short); Primary "Confirm split", Quiet "Edit amounts" (09) or "Not now" (S14). **09b "Change the split"**: "Tap an amount to change it."; editable chips outlined in statusOk (Free isn't editable: it absorbs every change, updating live); note "Whatever you don't place goes to Free."; Primary "Save split" (back to the split, never blocked), Quiet "Use the suggested split". After confirming: S7 if a purchase is waiting, else S6 if Invest got money.
- **O6 quick setup** (Figma 70:960): centered title ("Your first deposit: $10,000", or "Before your first split" for unsplit savings) and "Two quick choices before we split it. You can change both later in Settings."; tax and Runway segmented controls; note; Primary "See the split".
- **S13 Add an account by hand** (Figma 129:2559, sheet from S12): Name ("Cash, car loan, brokerage…"), "I have this / I owe this" (an other-asset account or a loan: neither changes the daily amount or buckets), Balance today with "You update this balance yourself. It shows up in your weekly review so it stays current."; Primary "Add account", Quiet "Cancel". Onboarding keeps S10's add mode (it picks checking or savings).
- **S8 Delete everything** (Figma 71:1066): Cancel; Title 2 "Delete everything?"; what goes, with counts (Accounts and balances · Transactions and tags "Including N work expenses" · Buckets and settings "All"); when banks are connected, a switch "End my bank logins at Plaid too" (off by default) with the line under it: off "Your bank logins stay open at Plaid, so a backup can bring them back without using any of your 10.", on "Ended logins still count against your 10, and a backup can't bring them back."; heads-up "This can't be undone. Export first if you want a copy for your accountant."; large field "Type DELETE to confirm" with "Deletes everything from this phone. Your iCloud backup can't open it without this phone's key."; Secondary "Export my data first"; Destructive "Delete everything", disabled until the field equals DELETE.

### Bank connections (Plaid Trial — the limit is for life)
Annum runs on Plaid's free Trial: **10 bank logins in total, for life, shared by both phones**. Ending a connection doesn't give it back. So:
- Every new connection is confirmed first, with the count ("This uses 1 of your 10 bank connections. 7 left for both phones."). With none left, "Connect a bank" explains why and offers "Import a file" instead.
- A broken connection (the bank asks you to sign in again) is always repaired in place (**Reconnect**, Plaid's update mode), never by connecting again.
- The count comes from the Worker, so both phones see the same number.
- Backups carry the connections, so restoring on a new phone uses none.
- **Access key:** a phone talks to the Worker only with the key it scanned from Andy's laptop. When the key is replaced (a lost phone), connected accounts show "Scan the new code from your laptop" (heads-up, not an error), and Settings → Accounts has "Scan a new access code". Scanning opens **Pair this phone**: "This phone can reach your banks again." Nothing about the bank connections changes. The scanned code is checked with the Worker before it's saved: a code the Worker refuses (an old one, or a made-up link) or one that can't be checked (offline) changes nothing, and the phone keeps the code it has.

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
