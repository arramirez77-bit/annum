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
    reminders.tsx              O4c Want a few reminders? → Today (estimate)
  (tabs)/
    _layout.tsx                Native tabs: Today · Review · Money (bar hidden on review steps, S2 Taxes and S9, as in the frames)
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

### 01 Today (`/`) — Figma 01, 01c, 02, E1, E2, O5, P2 Today
- **Header**: "Sep 23 · Updated 7:02 AM" (only "Updated Sep 20" when out of date, and only the time on the small screen) · StatusPill · ProfileButton → `/settings`. The update time is the trust signal — always visible.
- **Hero**: "You can spend" / `$ATS` (Hero, counts up) / "until your next invoice on {date}. About ${perDay} a day." Salary: "until payday on {date}." Estimate/stale: "You can spend about". Heads-up folds the cause into the sentence: "until Oct 13. The Contoso statement lands before your invoice does." / "until Oct 22. The Northwind Studio invoice is 4 days late, so we stretched it."
- **Sheet facts** (LedgerRow light): Runway ("4.2 months", "Up 0.2 months this week · target 5 months", or "Target 6 months ($15,000)" before a first week), Taxes (freelance only, "Next payment Jan 15"; tap → S2), "Next paycheck" (salary: "Oct 5 · every 2 weeks"), "What would this do?" ("Try a purchase before you buy it") → `/what-if`. Mixed lists use BucketDot `none` so titles align.
- **Button**: Field "Start weekly review" (on-track) · Caution "See what I can move" (heads-up) · "Start my first review" (estimate) · Caution "Change the invoice date" (late invoice → S4 edit).
- **States**: on-track (green field); heads-up 02 (umber, cross-fade 600ms; rows: "{card} statement · Due Sep 28 · paying in full avoids interest", "Runway stays · If you pay it from Free, not savings"); estimate O5 ("About 6 months · Estimated from your accounts", Taxes "Not yet · You'll set this when your first deposit lands"); stale E1 (heads-up note "Woodgrove hasn't synced since Sep 20, so this may be off by a few purchases. Tap to reconnect." — taps reconnect the bank or open Import; no What would this do? row); late invoice E2 (rows "{source} invoice · Expected Oct 13 · 4 days late" and "Per day · Stretched to Oct 22"); salary P2 (no tax row).
- Light TabBar floats over the sheet.

### 03 Money (`/money`) — Figma 58:62, E3 70:1119, P2 Money 71:1407
- Title "Money", subtitle "What your savings are set aside for." (E3: "Your savings aren't split into buckets yet.")
- Savings total; BucketBar; BucketRow (card) × 5 in fixed order: Taxes "Next payment Jan 15", Bills "6 due in 30 days", Runway "4.2 months · target 5 months", Invest "Starts when Runway is full" (amount in secondary; opens S6 when it holds money), Free "Counts toward what you can spend"; pending invest moves (S6); grouped links "All transactions" → S1, "Taxes · 2026" → S2 (hidden if Tax off).
- **E3 not split yet**: muted bar, info note "A split could look like this: $3,000 for taxes, $2,000 for bills, $1,000 to spend, and the rest in Runway. That's about 4.2 months.", Primary "Split my savings now".

### Weekly Review (`/review/1…6`) — Figma 04–08, 07b
Top bar on every step: Back (not on step 1) · StepIndicator · "Finish later" (saves progress, returns to Today).
1. **04 Check your balances**: "Synced this morning at 7:02. Anything that didn't connect is marked."; LedgerRows ("Synced 7:02 AM", "Synced 7:02 AM · split into buckets", "Statement due Sep 28", "Entered by hand · updated Sep 1"); heads-up note "… are entered by hand. Tap one to update it if the balance changed."; Primary "Looks right".
2. **05 What were these?**: "12 new this week. We guessed a category for each one. Fix any that are wrong, and tap Work expense for anything you bought for work."; TransactionCards ("Mon Sep 21 · Contoso", unsigned amount) with the suggestion **pre-selected** and the Work expense chip last; Primary "Looks right". Corrections write merchant rules.
3. **06 Your week** ("What changed since last Sunday."): delta cards Free to spend ("Down $400 this week"), Runway ("Up 0.2 months"), Taxes ("On track for Jan 15"); info note "You spent $50 more on dining than your 4-week average. That came out of Free, not savings, so there's nothing to fix."
4. **07b How much do you usually move?** (first review only; "First review only. After this, Annum starts from your habit and suggests changes."): AmountInput "I usually move" ("From savings to checking.") + cadence; note "Next, we'll check it against this week: the Contoso statement and two bills land, so you'll likely need about $1,050."; Primary "Continue".
5. **07 Move money to checking** ("You usually move $1,000. This week needs about the same."): "Move" / `$suggestion` (Display) / "from savings to checking." + "Change amount"; rows "Bills due this week" (names) and "Weekly spending · About $50 a day for a week"; info note "Move it in {bank}, then come back. We'll show it as pending until it arrives."; Primary "Open {bank} to move it" (known banks), Secondary/Primary "I already moved it" → marks transfer **pending**.
6. **08 Week reviewed** ("Here's the short version."): "You spent" / $X (Display) + bar ("$50 over your $350 weekly amount. Free covered it, so your savings weren't touched."); "Where it went" ("$50 more than usual", "About the same as usual"); "What's left": Free to spend ("20 days until your Oct 13 invoice") + "Move to checking · Pending until it shows up in {bank}"; "Next review Sunday, Sep 27. We'll remind you."; Primary "Done". Sets `isEstimate=false` after the first completion.

### 10–11 What would this do? (`/what-if`) — Figma 60:416, 60:463
- Cancel; Title 2; AmountInput "If I spend" ("Nothing is saved. This is only a preview."); result rows recompute on every keystroke with count-up.
- **Fits**: "Free to spend · Was $1,000", "Per day until Oct 13 · Was $50", "Runway · Unchanged"; info "This fits. It comes out of Free, and your savings stay where they are."; Primary "Got it", Quiet "Try another amount".
- **Guardrail**: "Free to spend", "Runway · The rest would come from savings", "Your Runway target · $15,000 · 5 months"; heads-up "… Your invoice lands Oct 13, and if you wait until then, your savings stay whole. We'll ask you again when it lands." (S7); Primary "Wait until {date}" (creates a DeferredPurchase), Quiet "Buy anyway".

### O6 + 09 Deposit (`/deposit/:id/setup`, `/deposit/:id`)
- **O6** (first deposit only): SegmentedControl tax % (25/30/35), SegmentedControl Runway target (3/5/6 months × monthlySpend); info note with live consequence; Primary "See the split".
- **09 Split**: "$10,000 just landed"; BucketBar (animates); BucketRow split × 5 with editable amount chips (Free absorbs changes); info note; Primary "Confirm split", Quiet "Edit amounts".

### Onboarding
- **O1 Welcome**: mark, wordmark, "Money, by the year.", three promises with bucket dots, Primary "Get started", Quiet "How your data stays private", "About 3 minutes. Every step can be skipped." 
- **Header**: Back · "Step N of 4" · Skip (O2 1, O3/O4 2, O4b 3, O4c 4). Skip does what the quiet choice does: O2 keeps freelance, O3 enters balances by hand (hidden once a bank connects), O4 continues, O4b and O4c are "Not now".
- **O2 How do you get paid?** ("This decides which parts of Annum you'll see. You can change it later."): OptionCards Freelance ("Money comes in from invoices, at different times. You'll also get a Taxes bucket.") · Salary ("A paycheck with taxes already taken out.") · Both ("A paycheck plus freelance work on the side.") → `incomeType` and modules.
- **O3 Connect your banks** ("Annum uses Plaid, a secure bank connection, to read your balances and transactions. It can see your money but can never move it."): numbered steps (Choose your bank · Most US banks and credit unions → Sign in on your bank's secure page · Annum never sees your password → Your accounts appear here · Balances and up to two years of history), note "Free and read-only. Annum keeps your data on this phone. Plaid holds your bank connection so it can sync."; Primary "Connect a bank" (Plaid Link), Secondary "Import a file" → S11, Quiet "Enter a balance by hand". Before Link opens, a confirmation names the cost in connections: "This uses 1 of your 10 bank connections. 7 left for both phones." (see **Bank connections** below). **E4** (71:953): "That bank didn't connect", "Nothing was saved, and nothing is wrong with your account. Some banks need a second try, and a few aren't supported yet. No bank login was used." + heads-up "If it keeps happening, import a file from your bank's website instead. It takes about a minute."; Primary "Try again", Quiet "Import a file instead".
- **O4 {n} accounts connected** ("From Woodgrove and Contoso. Investment accounts and loans usually don't connect, so add those by hand." — the banks that connected; the sample bank has no names): LedgerRows "Checking · connected", "Brokerage · entered by hand", "Loan · tap to add balance" / "Add" (→ S10); Secondary "Add another bank" (same confirmation as O3); monthly spending; Primary "Continue".
- **O4b Face ID**: lock symbol, "Keep it private with Face ID", passcode-fallback note; Primary "Turn on Face ID", Quiet "Not now".
- **O4c Want a few reminders?** ("Annum only reminds you when something needs you. You can change these later in Settings."): Weekly review ("Sundays at 10 AM. Takes about 10 minutes."), Card statements ("Two days before they're due"), Quarterly taxes ("A week before each payment"), Deposits and late invoices ("When money lands or an invoice is late"); Primary "Turn on reminders" (system permission prompt), Quiet "Not now" → Today in estimate state.

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
