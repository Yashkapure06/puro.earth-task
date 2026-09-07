import { randomBytes } from "node:crypto";

/**
 * UK-style sort code / 8-digit account number, plus a demo PAN.
 * Generated for the assessment. Not a real issuing scheme.
 */

function randomDigits(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const byte = bytes[i];
    if (byte === undefined) {
      throw new Error("Failed to generate digits");
    }
    out += String(byte % 10);
  }
  return out;
}

export function generateAccountNumber(): string {
  return randomDigits(8);
}

/** Demo PAN only. Last four is what GET /accounts/me returns. */
export function generateCardNumber(): { number: string; last4: string } {
  const number = `0000${randomDigits(12)}`;
  return { number, last4: number.slice(-4) };
}

export function formatCardNumber(number: string): string {
  return number.replace(/(.{4})/g, "$1 ").trim();
}

export function formatSortCode(digits: string): string {
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

export function normalizeSortCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

export function normalizeAccountNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

export function maskDigits(value: string): string {
  return `•••• ${value.slice(-4)}`;
}
