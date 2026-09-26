# 03 — Data model, formulas, and test cases

All money is **integer cents** in code. Examples below use dollars for readability.

## Types (`src/domain/types.ts`)

```ts
export type Cents = number;               // integer
export type ISODate = string;             // 'YYYY-MM-DD', local calendar date
export type IncomeType = 'freelance' | 'salary' | 'both';
export type BucketKey = 'tax' | 'bills' | 'runway' | 'invest' | 'free';

export interface Settings {
  incomeType: IncomeType;
  taxRate: number;                        // 0.25 | 0.30 | 0.35 (freelance only)
  runwayTarget: Cents;
  monthlySpend: Cents;                    // estimated, then learned from 90 days of spending
  habitTransfer: { amount: Cents; cadence: 'weekly' | 'biweekly' | 'monthly' };
  modules: { tax: boolean; debt: boolean; invest: boolean };
  isEstimate: boolean;                    // true until the first weekly review completes
}

export interface Account {
  id: string; name: string;
  type: 'checking' | 'savings' | 'card' | 'brokerage' | 'loan';
  balance: Cents;                         // cards/loans: amount owed, positive
  statementBalance?: Cents; statementDue?: ISODate;   // cards
  lastSynced?: string;                    // ISO datetime
  source: 'teller' | 'import' | 'manual';
  tellerAccountId?: string; enrollmentId?: string;
  status: 'ok' | 'stale' | 'disconnected';
}

export interface Buckets { tax: Cents; bills: Cents; runway: Cents; invest: Cents; free: Cents }  // sum === savings.balance

export interface Bill { id: string; name: string; amount: Cents; due: ISODate; cadence: 'weekly' | 'biweekly' | 'monthly'; confirmed: boolean; payFrom: 'checking' }

export interface ExpectedIncome { id: string; source: string; amount: Cents; date: ISODate; received?: boolean }

export interface Transaction {
  id: string; accountId: string; date: ISODate; merchant: string; amount: Cents;   // negative = money out
  category?: string; suggestedCategory?: string; tax: boolean; taxCategory?: string;
  reviewed: boolean;
}

export interface Deposit { id: string; date: ISODate; amount: Cents; source?: string; split?: Buckets; confirmed: boolean }
export interface DeferredPurchase { id: string; label: string; amount: Cents; waitUntil: ISODate; status: 'waiting' | 'bought' | 'dropped' }
export type TodayStatus = 'on-track' | 'heads-up' | 'estimate';
export interface WeekStart { date: ISODate; availableToSpend: Cents; runway: Cents }  // snapshot saved when the review week starts
```

## Core formulas (`src/domain/money.ts`)

**Next income date** = the earliest `ExpectedIncome.date ≥ today` not received. If the date has passed without a matching deposit, the invoice is **late**: assume arrival 5 days after today (configurable) and flag it.

**Available to Spend (ATS)** — money not spoken for before the next income:

```
ATS = checking.balance
    + buckets.free
    − Σ bills (confirmed, payFrom=checking) due in [today, nextIncomeDate)
    − Σ card statementBalance with statementDue in [today, nextIncomeDate)
ATS is floored at 0 for display; keep the raw value for rules.
```

**Per day** = `ATS / daysUntil(nextIncomeDate)` where `daysUntil` counts calendar days from today (exclusive) to the income date (exclusive of today, inclusive of income day): Sep 23 → Oct 13 = 20. Round down to whole dollars for display.

**Runway months** = `buckets.runway / monthlySpend`, one decimal.

**Salary mode**: identical math; "next income" is the next paycheck from the pay schedule; Tax bucket is 0 and hidden.

**Date windows** (local calendar dates). "Next N days" windows include their last day; the ATS window does not include the income day.

| Window | Range | Seed (today Sep 23) |
| --- | --- | --- |
| Available to Spend: bills and card statements | `[today, nextIncomeDate)`: the income day is **excluded**, because money arriving that day covers bills due that day | Sep 23 – Oct 12 |
| "Next 7 days" (weekly transfer) | today through today + 7, **inclusive** | Sep 23 – Sep 30 |
| "Next 30 days" (deposit Bills step) | today through today + 30, **inclusive** | Sep 23 – Oct 23 |

## Deposit waterfall (`src/domain/waterfall.ts`)

For a new deposit `D`, propose a split in this order (each step takes `min(remaining, need)`):

1. **Tax** = `round(D × taxRate)` (freelance/both only)
2. **Bills** = `max(0, bills due in the next 30 days − buckets.bills)` (today through today + 30, inclusive)
3. **Runway** = `runwayTarget − buckets.runway` (min 0)
4. **Invest** = only if Runway is at target after step 3: `remaining × investShare` (default 50%, a setting)
5. **Free** = everything left

The user may edit any amount; **Free absorbs the difference** so the total always equals `D`. If an edit makes Free negative, reduce the most recently edited field instead and show a heads-up line. Repeating the same manual edit twice makes it the new default rule.

## What would this do? (`src/domain/whatIf.ts`)

For a purchase `p`:
- `newATS = ATS − p`; `newPerDay = max(newATS,0) / daysUntilIncome`
- If `p > ATS`: `shortfall = p − ATS`, taken from Runway → `newRunwayMonths = (runway − shortfall) / monthlySpend`
- **Guardrail** shows when a purchase would reduce Runway at all. Copy: cause + suggestion to wait until the next income date.

## Weekly transfer suggestion (`src/domain/transfer.ts`)

```
suggestion = Σ card statements + bills due in the next 7 days
           + perDay × 7
```
"Next 7 days" is today through today + 7, inclusive. Show it relative to the habit: "You usually move $1,000. This week needs $1,050." If the suggestion is below the habit 3 weeks in a row, offer to lower the habit. The transfer is **pending** until a matching checking deposit appears in a later sync.

## Status rules (`src/domain/status.ts`)

- `estimate` if `settings.isEstimate`.
- `heads-up` if raw ATS < any card statement due before next income, **or** perDay < $20, **or** the next income is late.
- otherwise `on-track`.
- Sync staleness (any account `lastSynced` > 48h) doesn't change the status by itself but shows the stale note and prefixes numbers with "about."

## Weekly report (`src/domain/report.ts`)

- `spent` = Σ outflows this review week (excluding transfers, card payments, and savings moves)
- `allowance` = perDay × 7 at the start of the week, where that perDay = `weekStart.availableToSpend / daysUntil(nextIncomeDate)` counted from `weekStart.date`, rounded down to whole dollars. Seed: 1,400 / 26 days → $53 → $371.
- Top 3 categories by spend, each compared with the 4-week average: "more than usual" if > +20%, "less than usual" if < −20%, else "about usual."

**What changed this week** (06 What changed, and Today's Runway subtitle), measured against the `weekStart` snapshot:
- **Free-to-spend change** = ATS now − `weekStart.availableToSpend`. Seed: 1,000 − 1,400 = −400 → "Down $400 — what you spent this week."
- **Runway change** = (`buckets.runway` − `weekStart.runway`) ÷ `monthlySpend`, one decimal. Seed: (12,600 − 12,000) ÷ 3,000 = +0.2 → "Up 0.2 months" on 06; Today's subtitle reads "Up 0.2 this week · $15k target" (target in compact thousands).

## Estimates (first run, unsplit savings)

While `settings.isEstimate` is true and savings aren't split yet (every bucket is 0):
- **Estimated spend** = checking − bills and card statements due before the next income (the ATS formula with Free = 0). Per day as usual. First-run: 3,800 − 2,000 − 500 = $1,300.
- **Estimated Runway** = savings ÷ `monthlySpend`, shown as "~N months" rounded to the nearest whole month. First-run: 19,100 ÷ 3,000 = 6.37 → "~6 months".
- **Unsplit preview** (E3 on Money) uses the first-split rule, and the four amounts add up to the savings balance:
  1. **Tax** = `round(taxRate × income received this calendar quarter)` (freelance/both only). Income received = income transactions plus landed deposits, each counted once. Seed: $5,000 (Sep 21) + $10,000 (Sep 23) = $15,000 → $4,500.
  2. **Bills** = bills due in the next 30 days (inclusive) → $2,000.
  3. **Runway** = the rest → $12,600 (4.2 months).
  4. **Free** = $0.

## Test cases (must pass in Jest via `jest-expo`)

Using `fixtures/seed.json` (today = 2026-09-23):

| # | Case | Expected |
| --- | --- | --- |
| 1 | ATS | 2,000 + 1,500 − 2,000 − 500 = **$1,000** |
| 2 | Days until income | Sep 23 → Oct 13 = **20** |
| 3 | Per day | 1,000 / 20 = **$50** |
| 4 | Runway months | 12,600 / 3,000 = **4.2** |
| 5 | Status | **on-track** (ATS 1,000 ≥ Contoso Card 500; $50/day ≥ $20) |
| 6 | What if $200 | ATS **$800**, per day **$40**, Runway unchanged, no guardrail |
| 7 | What if $2,000 | shortfall 1,000 → Runway 11,600 / 3,000 = **3.9 mo**, guardrail shown |
| 8 | Weekly transfer | bills by Sep 30 (150 + 50) + Contoso Card 500 + 50×7 (350) = **$1,050** |
| 9 | Deposit $10,000 split (tax 30%, runway target 15,000) | Tax **3,000**; Bills **0** (2,000 due in the next 30 days − 2,000 held); Runway **2,400** (reaches the 15,000 target); Invest **2,300** (Runway now full, so 50% of the remaining 4,600); Free **2,300**; total **= 10,000** |
| 10 | Edit split: Tax → 2,500 | Free increases by 500 (2,300 → 2,800); total still 10,000 |
| 11 | Heads-up scenario (checking 1,200) | ATS **$200** → status **heads-up** (200 < Contoso Card 500) |
| 12 | Salary scenario | ATS 1,700 + 1,000 − 1,600 (rent) = **$1,100**, next paycheck Oct 5 → 12 days → **$91/day** (91.67 rounded down); no tax values exposed |
| 13 | Late invoice (today Oct 17, not received) | status **heads-up**, income assumed Oct 22, per day recomputed |
| 14 | Stale sync (Woodgrove checking synced Sep 20, today Sep 23) | `isStale` true; status unchanged |
| 15 | Money precision | 3 × $0.10 + $0.70 = exactly $1.00 (cents math) |
| 16 | Timezone | "days until" is identical at 11:59 PM and 12:01 AM local on the same date |
| 17 | Bill due on day 30 (seed + a confirmed $300 bill due Oct 23 = today + 30); deposit $10,000 | Included in "next 30 days": Bills **300** (2,300 due − 2,000 held); Tax 3,000; Runway 2,400; Invest **2,150** (50% of the remaining 4,300); Free **2,150**; total **= 10,000** |
| 18 | Bill due on the income date (seed + a confirmed $300 bill due Oct 13) | Excluded from ATS (window is Sep 23 – Oct 12): ATS stays **$1,000**, not $700; per day **$50** |
| 19 | Allowance at start of week (weekStart Sep 17: $1,400, 26 days to Oct 13) | per day **$53** → allowance **$371**; spent $400 → **$29 over** |
| 20 | Free-to-spend change this week | 1,000 − 1,400 = **−$400** → "Down $400 — what you spent this week" |
| 21 | Runway change this week | (12,600 − 12,000) ÷ 3,000 = **+0.2** → "Up 0.2 months"; Today subtitle "Up 0.2 this week · $15k target" |
| 22 | Tax items (S2) | Equipment **3** · Software **12** · Home office **4** · Travel **2** (21 items, $3,800) |
| 23 | Late invoice amounts (late-invoice scenario: checking 175, card statement paid, Free 0) | ATS **$175**; Oct 17 → assumed Oct 22 = 5 days → **$35/day**; status **heads-up** |
| 24 | First-run estimate (first-run scenario: checking 3,800, savings 19,100 unsplit) | Estimated spend 3,800 − 2,000 − 500 = **$1,300** (per day **$65**); Runway 19,100 ÷ 3,000 = 6.37 → **"~6 months"**; status **estimate** |
| 25 | Unsplit preview (E3, first-run scenario) | Income this quarter 5,000 + 10,000 = 15,000 → Tax **4,500**; Bills **2,000**; Runway **12,600** (4.2 months); Free **0**; total **= 19,100** |

Scenario overrides live in `fixtures/scenarios.json`.
