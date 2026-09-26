# Screen values

The numbers the Figma screens below show, computed by a script from `fixtures/seed.json` and `fixtures/scenarios.json` using the rules in `docs/03-DATA-MODEL.md`. Nothing here is estimated. If a fixture or rule changes, recompute; don't edit these by hand.

Today is **Sep 23, 2026** unless a scenario says otherwise. Money is shown in whole dollars except transaction amounts. Per day is rounded down to whole dollars.

## 05 Tag · S1 Transactions · S9 Transaction detail

| ID | Merchant | Date | Account | Amount | Suggested category | Tax |
| --- | --- | --- | --- | --- | --- | --- |
| t1 | Litware | Sep 21 | Contoso Card | −$20.00 | Software | Yes · Software |
| t2 | Corner Market | Sep 22 | Woodgrove checking | −$80.00 | Groceries | No |
| t3 | Fuel Stop | Sep 22 | Contoso Card | −$50.00 | Gas | No |
| t4 | Green Bowl | Sep 21 | Contoso Card | −$15.00 | Dining | No |
| t5 | Northwind Studio | Sep 21 | Savings | +$5,000.00 | — (categorized: Income) | No |

## 06 What changed

| Value | Shows |
| --- | --- |
| Free to spend: change this week | **Not in the fixtures** (see Open items) |
| Free to spend: one-line reason | **Not in the fixtures** (see Open items) |
| Runway: change this week | **Not in the fixtures** (see Open items) |
| Notable category | Dining: $150 this week vs $100 4-week average (+$50, +50%) |

Notable category = the category furthest from its 4-week average. Dining is furthest by both percentage and dollars.

## 08 Week reviewed

| Value | Shows |
| --- | --- |
| Spent this week | $400 |
| Weekly allowance (per day × 7) | $350 ($50 × 7) |
| Over / under | $50 over |

| # | Category | This week | 4-week average | Change | Label |
| --- | --- | --- | --- | --- | --- |
| 1 | Dining | $150 | $100 | +50% | more than usual |
| 2 | Groceries | $120 | $120 | 0% | about usual |
| 3 | Gas | $40 | $60 | −33.3% | less than usual |

Spent and categories come from `thisWeek` in the seed (the full week, starting Sep 17). The sample transactions above are a subset: their outflows total $165. The allowance uses today's per day, because the fixtures hold a single snapshot.

## 01 Today

| Value | Shows |
| --- | --- |
| Runway subtitle: change this week ("Up $X this week") | **Not in the fixtures** (see Open items) |

## 07 Move money

Items due in the next 7 days (Sep 23 – Sep 30, inclusive).

| Item | Due | Amount |
| --- | --- | --- |
| Car insurance (bill) | Sep 29 | $150 |
| Phone (bill) | Sep 30 | $50 |
| Contoso Card statement | Sep 28 | $500 |

## S2 Taxes · 2026

Tagged total: **$3,800**

| Tax category | Total | Items |
| --- | --- | --- |
| Equipment | $2,000 | **Not in the fixtures** (see Open items) |
| Software | $1,000 | **Not in the fixtures** (see Open items) |
| Home office | $500 | **Not in the fixtures** (see Open items) |
| Travel | $300 | **Not in the fixtures** (see Open items) |

Only one sample transaction is tax-tagged (Litware, Software), so item counts can't come from the transactions either.

## E2 Late invoice (today Oct 17)

| Value | Shows |
| --- | --- |
| Available to Spend | $3,500 |
| Per day | $700 (5 days) |
| Assumed arrival | Oct 22 (today + 5 days) |

Note: this scenario only moves "today". Balances keep their Sep 23 values, and every seed bill and the card statement fall due before Oct 17, so nothing is subtracted. That's why per day rises (from $50 to $700) instead of stretching.

## O5 First run (estimate)

| Value | Shows |
| --- | --- |
| Estimated spend ("You can spend about") | $0 (raw −$500: checking $2,000 + Free $0 − bills $2,000 − Contoso Card $500) |
| Estimated Runway | 0.0 months (Runway bucket is $0 because savings of $19,100 aren't split yet) |

## P2 Salary

| Value | Shows |
| --- | --- |
| Paycheck | $2,500, every 2 weeks |
| Next paycheck | Oct 5 |
| Savings total | $7,600 |
| Bills bucket | $1,600 |
| Runway bucket | $5,000 |
| Invest bucket | $0 |
| Free bucket | $1,000 |
| Runway | 2.0 months |
| Runway target | $15,000 (6 months) |
| Available to Spend | $1,100 |
| Per day | $91 (12 days) |

## Open items

Items 1 and 2 need data the fixtures don't have yet, so nothing was guessed. Item 3 is computed correctly, but may not be what the design intends.

1. **Weekly changes** (06 Free to spend change + reason, 06 Runway change, 01 "Up $X this week"): the fixtures hold only today's state, with no start-of-week snapshot to compare against.
2. **S2 item counts:** `taxYear.byCategory` has yearly totals but no counts.
3. **E2 and O5 read oddly as computed** (per day rises on the late invoice; first run shows $0 and 0.0 months). The scenarios may need adjusting.