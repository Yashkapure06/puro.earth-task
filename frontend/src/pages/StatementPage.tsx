import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ActivityTable } from "@/components/ActivityTable";
import { AppMasthead } from "@/components/AppMasthead";
import { MoneyDialog, type MoneyMode } from "@/components/MoneyDialog";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  useAccount,
  useCurrentUser,
  useLogout,
  useTransactions,
} from "@/hooks/useBanking";
import { formatMoney } from "@/lib/money";

export function StatementPage() {
  const navigate = useNavigate();
  const userQuery = useCurrentUser();
  const accountQuery = useAccount(userQuery.data?.role === "customer");
  const transactionsQuery = useTransactions(userQuery.data?.role === "customer");
  const logout = useLogout();
  const [moneyMode, setMoneyMode] = useState<MoneyMode | null>(null);

  if (userQuery.isLoading) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-10">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return <Navigate to="/login" replace />;
  }

  // Staff have no customer account. Do not show a balance here.
  if (userQuery.data.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  const user = userQuery.data;

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // Session is cleared client-side even if the network call fails.
    }
    navigate("/login", { replace: true });
  };

  return (
    <main className="mx-auto min-h-screen max-w-[720px] px-4 py-8 md:py-12">
      <AppMasthead
        userName={user.name}
        onSignOut={handleLogout}
        signOutPending={logout.isPending}
        profileTo="/profile"
      />

      {accountQuery.isLoading ? (
        <p className="mb-8 text-sm text-muted">Loading balance…</p>
      ) : accountQuery.isError || !accountQuery.data ? (
        <p className="mb-8 text-sm text-destructive">
          Unable to load your account.
        </p>
      ) : (
        <section className="mb-8 rounded-md border border-hairline bg-paper p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-muted">Available</p>
            <StatusPill closed={accountQuery.data.closed} />
          </div>
          <h1 className="mt-1 font-serif text-5xl font-medium tracking-tight tabular-nums text-ink">
            {formatMoney(
              accountQuery.data.balance.amount,
              accountQuery.data.balance.currency,
            )}
          </h1>
          <dl className="mt-6 grid max-w-sm grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted">Sort code</dt>
              <dd className="mt-1 tabular-nums">{accountQuery.data.sortCode}</dd>
            </div>
            <div>
              <dt className="text-muted">Account number</dt>
              <dd className="mt-1 tabular-nums">
                {accountQuery.data.accountNumber}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">Account type</dt>
              <dd className="mt-1">Sterling current account</dd>
            </div>
          </dl>
        </section>
      )}

      {accountQuery.data?.closed ? (
        <p className="mb-10 text-sm text-muted">
          This account is closed. Deposits, withdrawals, and transfers are
          blocked.
        </p>
      ) : (
      <div className="mb-10 flex flex-wrap gap-3">
        <Button
          type="button"
          className="min-h-11 min-w-[7.5rem]"
          onClick={() => setMoneyMode("deposit")}
        >
          Deposit
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-[7.5rem]"
          onClick={() => setMoneyMode("withdraw")}
        >
          Withdraw
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 min-w-[7.5rem]"
          onClick={() => setMoneyMode("transfer")}
        >
          Transfer
        </Button>
      </div>
      )}

      <Separator className="mb-8" />

      <h2 className="mb-4 font-serif text-2xl font-medium tracking-tight text-ink">
        Activity
      </h2>
      <ActivityTable
        transactions={transactionsQuery.data}
        isLoading={transactionsQuery.isLoading}
        isError={transactionsQuery.isError}
        onRetry={() => {
          void transactionsQuery.refetch();
        }}
      />

      <MoneyDialog
        open={moneyMode !== null}
        mode={moneyMode}
        onOpenChange={(next) => {
          if (!next) setMoneyMode(null);
        }}
      />
    </main>
  );
}
