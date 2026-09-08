import type { Currency } from "../types/api";

const MINOR_PER_MAJOR = 100;

/**
 * Format integer minor units as a GBP display string.
 * Never use floating-point division for business logic, only for display.
 */
export function formatMoney(
  amountMinor: number,
  currency: Currency = "GBP",
  options?: { signed?: boolean },
): string {
  if (!Number.isInteger(amountMinor)) {
    throw new Error("formatMoney expects integer minor units");
  }

  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);
  const major = Math.trunc(absolute / MINOR_PER_MAJOR);
  const minor = absolute % MINOR_PER_MAJOR;
  const number = `${major.toLocaleString("en-GB")}.${minor
    .toString()
    .padStart(2, "0")}`;

  const symbol = currency === "GBP" ? "£" : `${currency} `;
  const core = `${symbol}${number}`;

  if (options?.signed) {
    if (amountMinor > 0) return `+${core}`;
    if (amountMinor < 0) return `−${core}`;
    return core;
  }

  return negative ? `−${core}` : core;
}

/** Parse a user-entered major-unit string (e.g. "250.00") into minor units. */
export function parseMajorToMinor(input: string): number | null {
  const trimmed = input.trim().replace(/£/g, "").replace(/,/g, "");
  if (!trimmed) return null;

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;

  const major = Number(match[1]);
  const minorPart = (match[2] ?? "").padEnd(2, "0");
  const minor = Number(minorPart);

  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor)) {
    return null;
  }

  return major * MINOR_PER_MAJOR + minor;
}

/** Parse user input for deposit/withdraw/transfer. Zero is not a valid mutation. */
export function parsePositiveMinorUnits(input: string): number | null {
  const minor = parseMajorToMinor(input);
  if (minor === null || minor <= 0) return null;
  return minor;
}

export function majorUnitsLabel(amountMinor: number): string {
  const absolute = Math.abs(amountMinor);
  const major = Math.trunc(absolute / MINOR_PER_MAJOR);
  const minor = absolute % MINOR_PER_MAJOR;
  return `${major}.${minor.toString().padStart(2, "0")}`;
}
