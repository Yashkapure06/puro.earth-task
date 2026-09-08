/** Strip to digits while typing a UK sort code / account number. */
export function digitsOnly(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

export function formatSortCodeInput(value: string): string {
  const digits = digitsOnly(value, 6);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 4),
    digits.slice(4, 6),
  ].filter((part) => part.length > 0);
  return parts.join("-");
}

export function normalizeSortCode(value: string): string | null {
  const digits = digitsOnly(value, 6);
  return digits.length === 6 ? digits : null;
}

export function normalizeAccountNumber(value: string): string | null {
  const digits = digitsOnly(value, 8);
  return digits.length === 8 ? digits : null;
}
