import type { Payee } from "../types/api";

export type MoneyMode = "deposit" | "withdraw" | "transfer";

export function paymentProgressCopy(
  mode: MoneyMode,
  amountLabel: string,
  payee: Payee | null,
): { title: string; status: string; hint: string } {
  switch (mode) {
    case "deposit":
      return {
        title: "Adding funds",
        status: `Depositing ${amountLabel}`,
        hint: "Posting to your current account.",
      };
    case "withdraw":
      return {
        title: "Withdrawing funds",
        status: `Withdrawing ${amountLabel}`,
        hint: "Taking this from your available balance.",
      };
    case "transfer":
      return {
        title: "Sending payment",
        status: payee
          ? `Sending ${amountLabel} to ${payee.name}`
          : `Sending ${amountLabel}`,
        hint:
          payee?.rail === "external"
            ? "This payment leaves Puro."
            : "Posting to both accounts.",
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function paymentReceiptCopy(
  mode: MoneyMode,
  payee: Payee | null,
): { title: string; hint: string } {
  switch (mode) {
    case "deposit":
      return {
        title: "Deposit posted",
        hint: "Added to your available balance.",
      };
    case "withdraw":
      return {
        title: "Withdrawal posted",
        hint: "Taken from your available balance.",
      };
    case "transfer":
      return {
        title: "Payment sent",
        hint:
          payee?.rail === "external"
            ? "Debited from your Puro account."
            : payee
              ? `Sent to ${payee.name}.`
              : "Sent from your Puro account.",
      };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
