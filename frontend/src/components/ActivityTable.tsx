import type { Transaction } from "@/types/api";
import { formatRelativeDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { activityDescription, formatTransactionRef } from "@/lib/activity";
import { Button } from "@/components/ui/button";

type ActivityTableProps = {
  transactions: Transaction[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function ActivityTable({
  transactions,
  isLoading,
  isError,
  onRetry,
}: ActivityTableProps) {
  if (isLoading) {
    return <p className="py-8 text-sm text-muted">Loading activity…</p>;
  }

  if (isError) {
    return (
      <div className="py-8">
        <p className="text-sm text-destructive">Unable to load activity</p>
        <Button
          type="button"
          variant="link"
          className="h-auto px-0"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return <p className="py-8 text-sm text-muted">No activity yet</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">Recent activity</caption>
      <thead>
        <tr className="border-b border-hairline text-muted">
          <th className="py-2 pr-4 font-medium">Date</th>
          <th className="py-2 pr-4 font-medium">Description</th>
          <th className="py-2 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((txn) => {
          const debit = txn.signedAmount.amount < 0;
          return (
            <tr key={txn.id} className="border-b border-hairline">
              <td className="py-3 pr-4 text-muted whitespace-nowrap">
                {formatRelativeDate(txn.createdAt)}
              </td>
                  <td className="py-3 pr-4 text-ink">
                    <p>{activityDescription(txn)}</p>
                    <p className="mt-1 tabular-nums text-xs text-muted">
                      <span className="sr-only">Transaction reference </span>
                      {formatTransactionRef(txn.id)}
                    </p>
                  </td>
              <td
                className={
                  debit
                    ? "py-3 text-right tabular-nums text-debit font-medium whitespace-nowrap"
                    : "py-3 text-right tabular-nums text-credit font-medium whitespace-nowrap"
                }
              >
                <span className="sr-only">{debit ? "Debit" : "Credit"} </span>
                {formatMoney(txn.signedAmount.amount, txn.signedAmount.currency, {
                  signed: true,
                })}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
