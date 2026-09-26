# Screen values

The numbers the Figma screens below show, computed by a script from `fixtures/seed.json` and `fixtures/scenarios.json` using the rules in `docs/03-DATA-MODEL.md`. Nothing here is guessed. If a fixture or rule changes, recompute; don't edit these by hand.

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
| Free to spend: change this week | Down $400 ($1,000 now − $1,400 on Sep 17) |
| Free to spend: one-line reason | "Down $400 — what you spent this week" |
| Runway: change this week | Up 0.2 months (($12,600 now − $12,000 on Sep 17) ÷ $3,000) |
| Notable category | Dining: $150 this week vs $100 4-week average (+$50, +50%) |

Notable category = the category furthest from its 4-week average. Dining is furthest by both percentage and dollars.

## 08 Week reviewed

| Value | Shows |
| --- | --- |
| Spent this week | $400 |
| Weekly allowance (per day × 7) | $371 ($53 × 7; $1,400 spendable on Sep 17 ÷ 26 days) |
| Over / under | $29 over |

| # | Category | This week | 4-week average | Change | Label |
| --- | --- | --- | --- | --- | --- |
| 1 | Dining | $150 | $100 | +50% | more than usual |
| 2 | Groceries | $120 | $120 | 0% | about usual |
| 3 | Gas | $40 | $60 | −33.3% | less than usual |

Spent and categories come from `thisWeek` in the seed (the full week, starting Sep 17). The sample transactions above are a subset: their outflows total $165. The allowance uses per day at the start of the week, from `weekStart`.

## 01 Today

| Value | Shows |
| --- | --- |
| Runway subtitle | "Up 0.2 this week · $15k target" |

## 07 Move money

Items due in the next 7 days (Sep 23 – Sep 30, inclusive).

| Item | Due | Amount |
| --- | --- | --- |
| Car insurance (bill) | Sep 29 | $150 |
| Phone (bill) | Sep 30 | $50 |
| Contoso Card statement | Sep 28 | $500 |

## S2 Taxes · 2026

Tagged total: **$3,800** (21 items)

| Tax category | Total | Items |
| --- | --- | --- |
| Equipment | $2,000 | 3 |
| Software | $1,000 | 12 |
| Home office | $500 | 4 |
| Travel | $300 | 2 |

## E2 Late invoice (today Oct 17)

| Value | Shows |
| --- | --- |
| Available to Spend | $175 |
| Per day | $35 (5 days) |
| Assumed arrival | Oct 22 (today + 5 days) |

## O5 First run (estimate)

| Value | Shows |
| --- | --- |
| Estimated spend ("You can spend about") | $1,300 (checking $3,800 − bills $2,000 − Contoso Card statement $500) |
| Per day | about $65 (20 days) |
| Estimated Runway | ~6 months (savings $19,100 ÷ $3,000 = 6.37) |

## E3 Money · not split yet (first run)

Unsplit preview of the $19,100 in savings.

| Bucket | Amount | How |
| --- | --- | --- |
| Tax | $4,500 | 30% of $15,000 income this quarter ($5,000 on Sep 21 + $10,000 on Sep 23) |
| Bills | $2,000 | bills due in the next 30 days (Sep 23 – Oct 23) |
| Runway | $12,600 | the rest, about 4.2 months |
| Free | $0 | — |
| Total | $19,100 | equals savings |

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
