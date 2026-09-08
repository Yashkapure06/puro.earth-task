import type { Transaction } from "../types/api";

/** Last 8 hex of the UUID. Not a second unique column. */
export function formatTransactionRef(id: string): string {
  const hex = id.replace(/-/g, "").toUpperCase();
  if (hex.length <= 8) {
    return hex;
  }
  const tail = hex.slice(-8);
  return `${tail.slice(0, 4)} ${tail.slice(4)}`;
}

/** In vs out from `signedAmount`. The API already scoped this to the session account. */
export function activityDescription(transaction: Transaction): string {
  switch (transaction.type) {
    case "DEPOSIT":
      return transaction.counterpartyName ?? "Deposit";
    case "WITHDRAWAL":
      return transaction.counterpartyName ?? "Withdrawal";
    case "TRANSFER": {
      const name = transaction.counterpartyName ?? "someone";
      return transaction.signedAmount.amount < 0
        ? `Transfer to ${name}`
        : `Transfer from ${name}`;
    }
    default: {
      const _exhaustive: never = transaction.type;
      return _exhaustive;
    }
  }
}
