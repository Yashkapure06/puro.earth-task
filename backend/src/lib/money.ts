/**
 * Money is stored and moved as integer minor units (pence for GBP).
 * Never use floating-point arithmetic for financial calculations.
 */

export type Currency = "GBP";

export function isPositiveMinorUnits(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && Number.isSafeInteger(amount);
}
