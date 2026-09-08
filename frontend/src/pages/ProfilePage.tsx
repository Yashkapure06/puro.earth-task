import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AppMasthead } from "@/components/AppMasthead";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAccount,
  useCurrentUser,
  useLogout,
  useRevealCard,
} from "@/hooks/useBanking";
import { ApiRequestError } from "@/lib/api";
import { bankingErrorMessage } from "@/lib/banking-errors";
import { DEMO_AUTHORIZE_PIN } from "@/lib/authorize-pin";

export function ProfilePage() {
  const navigate = useNavigate();
  const userQuery = useCurrentUser();
  const accountQuery = useAccount(userQuery.data?.role === "customer");
  const logout = useLogout();
  const revealCard = useRevealCard();
  const [pin, setPin] = useState("");
  const [cardNumber, setCardNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (userQuery.data.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // Session is cleared client-side even if the network call fails.
    }
    navigate("/login", { replace: true });
  };

  const onReveal = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await revealCard.mutateAsync(pin);
      setCardNumber(result.cardNumber);
      setPin("");
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? bankingErrorMessage(err.code)
          : "Something went wrong. Try again",
      );
    }
  };

  const account = accountQuery.data;

  return (
    <main className="mx-auto min-h-screen max-w-[720px] px-4 py-8 md:py-12">
      <AppMasthead
        userName={userQuery.data.name}
        onSignOut={handleLogout}
        signOutPending={logout.isPending}
      />

      <p className="mb-6">
        <Link
          to="/dashboard"
          className="text-sm text-muted underline-offset-4 hover:underline"
        >
          Back to statement
        </Link>
      </p>

      <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">
        Profile
      </h1>

      <section className="mt-8 space-y-3 text-sm">
        <p>
          <span className="text-muted">Name</span>
          <br />
          {userQuery.data.name}
        </p>
        <p>
          <span className="text-muted">Email</span>
          <br />
          {userQuery.data.email}
        </p>
      </section>

      {accountQuery.isLoading ? (
        <p className="mt-8 text-sm text-muted">Loading account…</p>
      ) : accountQuery.isError || !account ? (
        <p className="mt-8 text-sm text-destructive">Unable to load account.</p>
      ) : (
        <section className="mt-8 space-y-3 text-sm">
          <h2 className="font-serif text-2xl font-medium tracking-tight text-ink">
            Current account
          </h2>
          <p>
            <span className="text-muted">Sort code</span>
            <br />
            <span className="tabular-nums">{account.sortCode}</span>
          </p>
          <p>
            <span className="text-muted">Account number</span>
            <br />
            <span className="tabular-nums">{account.accountNumber}</span>
          </p>
          <p>
            <span className="text-muted">Status</span>
            <br />
            <StatusPill closed={account.closed} />
          </p>
          <p>
            <span className="text-muted">Debit card</span>
            <br />
            <span className="tabular-nums">
              {cardNumber ?? account.maskedCardNumber}
            </span>
          </p>

          {account.closed || cardNumber ? null : (
            <form onSubmit={onReveal} className="max-w-xs space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN to show card number</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={pin}
                  onChange={(event) =>
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                />
                <p className="text-xs text-muted">
                  Demo PIN {DEMO_AUTHORIZE_PIN}. Checked on the server; the
                  full number is not sent with the account payload.
                </p>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={revealCard.isPending}>
                {revealCard.isPending ? "Checking…" : "Show card number"}
              </Button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
