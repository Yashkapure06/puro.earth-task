const COPY: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Not enough available funds",
  INVALID_AMOUNT: "Enter a valid amount",
  DESTINATION_ACCOUNT_NOT_FOUND:
    "No Puro account matches that sort code and account number",
  SAME_ACCOUNT_TRANSFER: "You cannot pay your own account",
  UNAUTHORIZED: "Incorrect email or password",
  EMAIL_TAKEN: "That email is already registered",
  FORBIDDEN: "You cannot do that",
  INVALID_PIN: "Incorrect PIN",
  ACCOUNT_CLOSED: "This account is closed",
  VALIDATION_ERROR: "Check the details and try again",
};

/** Map API `error.code` to statement copy. Unknown codes stay generic. */
export function bankingErrorMessage(code: string): string {
  return COPY[code] ?? "Something went wrong. Try again";
}
