/** "What would this do?" — docs/03. */
import { availableToSpend, perDayFor, runwayMonths } from './money';
import type { AppData, Cents, ISODate } from './types';

export interface WhatIfResult {
  purchase: Cents;
  /** Available to Spend after the purchase, floored at 0. */
  ats: Cents;
  perDay: Cents;
  /** Runway months after the purchase (unchanged unless it dips into Runway). */
  runwayMonths: number;
  /** How much would come out of Runway. */
  shortfall: Cents;
  /** True when the purchase would reduce Runway at all. */
  guardrail: boolean;
  /** The next income date, for "Wait until {date}". */
  waitUntil: ISODate;
}

export function whatIf(data: AppData, purchase: Cents): WhatIfResult {
  const ats = availableToSpend(data);
  const after = ats.raw - purchase;
  const shortfall = Math.max(purchase - Math.max(ats.raw, 0), 0);
  return {
    purchase,
    ats: Math.max(after, 0),
    perDay: perDayFor(after, ats.days),
    runwayMonths: runwayMonths(data, data.buckets.runway - shortfall),
    shortfall,
    guardrail: shortfall > 0,
    waitUntil: ats.nextIncome.date,
  };
}
