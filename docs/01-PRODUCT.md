# 01 — Product

## What Annum is

A calm money app that answers one question: **how much can I spend today and still be safe?** It splits savings into five labeled buckets, shows one trustworthy number, explains every number in a sentence, and walks the user through a short weekly review. Dark-first native iPhone app built with Expo (React Native), with lock-screen and home-screen widgets.

## Who it's for

| Persona | Situation | What must be true for them |
| --- | --- | --- |
| **Marco** (primary) | Freelance designer. ~$10k/month in lumpy invoices. Income lands in savings; he moves a fixed amount to checking. Has credit cards, a student loan, a brokerage account. Uses an accountant; last year reconstructed expenses from memory. Wants ~30 min/week of guided upkeep. | Glance at one sentence and trust it. Tag work expenses in one tap. See runway in months. Weekly review well under 30 minutes. |
| **Dana** (secondary) | Salaried, paid every 2 weeks. Uses her **own separate instance** (her own device/data). Wants ~10 min/week. | With income type = Salary, every tax feature disappears and nothing feels freelancer-specific. |

The app is single-user per instance. No shared household data.

## The five buckets (reserved vocabulary)

Savings is one real bank account; Annum **labels** its dollars. Bucket balances always sum to the savings balance.

| Bucket | Meaning | Color token |
| --- | --- | --- |
| Tax | Set aside for taxes (freelance only) | `--bucket-tax` |
| Bills | Due before the next income | `--bucket-bills` |
| Runway | Cushion, measured in months | `--bucket-runway` |
| Invest | Unlocked only once Runway is full | `--bucket-invest` |
| Free | Yours to spend | `--bucket-free` |

## Principles (non-negotiable)

1. **One number, in a sentence.** "You can spend $1,000 until your next invoice on Oct 13. About $50 a day."
2. **Every heads-up names a cause and one action.** Never red, never "error/warning." Money states are *on track*, *heads up*, or *estimate*.
3. **Bucket colors mean exactly one bucket**, everywhere. Never decorative.
4. **One primary action per screen.**
5. **Advice warns but never blocks.** The user can always proceed with one extra tap.
6. **Start rough, get honest.** Before real data exists, values say "about" and the pill says "Estimate."
7. **Modules disappear when off.** Tax, Debt, Invest hide everywhere when toggled off (and Tax is off for salary users).
8. **Suggestions are rules the user set, not financial advice.** Annum never recommends investments.
9. **People avoid checking money when they expect bad news** (ostrich effect). Looking must never feel dangerous: warm umber, calm copy, no alarms, no haptic on heads-up.

## Voice & copy rules

Annum sounds like a calm friend who is good with money: plain, specific, never alarmed.

- Numbers live inside sentences.
- Cause first, then one action or consequence.
- Only these terms are taught: Runway, buckets (Tax, Bills, Runway, Invest, Free), Free to spend, Heads up, Weekly review.
- Never: "error", "failed", "warning", "budget exceeded", "invalid". Use "couldn't", "heads up", "that didn't work".
- Estimates say "about" until real data replaces them.
- Button labels are outcomes: "Confirm split", "Looks right · Next", "Open Woodgrove to move it", "Finish later".
- Top-bar patterns: pushed screens → chevron + parent name; flows → Back · progress · Skip/Finish later; modals & sheets → Cancel.

| Say | Not |
| --- | --- |
| You can spend $200 until Oct 13. The Contoso Card statement lands before your invoice does. | WARNING: Low balance. |
| That token didn't work. Nothing was saved. | Error: authentication failed. |
| Money for taxes | Estimated tax liability |
| Woodgrove hasn't synced since Sep 20, so this may be off by a few purchases. | Sync failed. |

## Out of scope for v1

Receipt OCR, shared household, investment holdings, Debt & Goals modules (design exists as toggles; ship them off), light mode, Android, iPad layouts, AI-written insights, bill negotiation. (Widgets are in scope as milestone M8.)
