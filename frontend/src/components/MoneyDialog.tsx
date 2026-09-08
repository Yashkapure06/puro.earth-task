import { type FormEvent, useEffect, useState } from "react";
import { PaymentStatus } from "@/components/PaymentStatus";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useDeposit,
  useLookupPayee,
  useTransfer,
  useWithdraw,
} from "@/hooks/useBanking";
import { ApiRequestError } from "@/lib/api";
import { isValidAuthorizePin } from "@/lib/authorize-pin";
import { bankingErrorMessage } from "@/lib/banking-errors";
import { formatMoney, parsePositiveMinorUnits } from "@/lib/money";
import {
  digitsOnly,
  formatSortCodeInput,
  normalizeAccountNumber,
  normalizeSortCode,
} from "@/lib/payee";
import { paymentProgressCopy, paymentReceiptCopy, type MoneyMode } from "@/lib/payment-copy";
import { waitWithFloor } from "@/lib/processing";
import type { Payee } from "@/types/api";

export type { MoneyMode };
/** enter → review (transfer only) → PIN → processing → receipt. */
type DialogStep = "enter" | "review" | "authorize" | "processing" | "receipt";

type MoneyDialogProps = {
  open: boolean;
  mode: MoneyMode | null;
  onOpenChange: (open: boolean) => void;
};

const TITLES: Record<MoneyMode, string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  transfer: "Transfer",
};

/**
 * Deposit, withdraw, transfer. Transfer payee is sort code + account number,
 * never a customer dropdown.
 */
export function MoneyDialog({ open, mode, onOpenChange }: MoneyDialogProps) {
  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const transfer = useTransfer();
  const lookupPayee = useLookupPayee();

  const [amountInput, setAmountInput] = useState("");
  const [sortCodeInput, setSortCodeInput] = useState("");
  const [accountNumberInput, setAccountNumberInput] = useState("");
  const [payee, setPayee] = useState<Payee | null>(null);
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<DialogStep>("enter");
  const [error, setError] = useState<string | null>(null);
  const [receiptLine, setReceiptLine] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setAmountInput("");
    setSortCodeInput("");
    setAccountNumberInput("");
    setPayee(null);
    setPin("");
    setStep("enter");
    setError(null);
    setReceiptLine(null);
  }, [open]);

  const pending =
    deposit.isPending ||
    withdraw.isPending ||
    transfer.isPending ||
    lookupPayee.isPending;
  const busy = pending || step === "processing";
  const close = () => onOpenChange(false);

  const goToAuthorize = () => {
    setPin("");
    setError(null);
    setStep("authorize");
  };

  /** POST starts now. Amount is pence. Transfer is sort code + account number only. */
  const postPayment = async () => {
    if (!mode) return;
    const minor = parsePositiveMinorUnits(amountInput);
    if (minor === null) {
      throw new Error("Enter a valid amount");
    }
    switch (mode) {
      case "deposit":
        await deposit.mutateAsync(minor);
        setReceiptLine(formatMoney(minor));
        break;
      case "withdraw":
        await withdraw.mutateAsync(minor);
        setReceiptLine(formatMoney(minor));
        break;
      case "transfer": {
        const sortCode = normalizeSortCode(sortCodeInput);
        const accountNumber = normalizeAccountNumber(accountNumberInput);
        if (!sortCode || !accountNumber) {
          throw new Error("Enter the sort code and account number");
        }
        const result = await transfer.mutateAsync({
          sortCode,
          accountNumber,
          amount: minor,
        });
        setReceiptLine(
          `${formatMoney(minor)} to ${result.transfer.destinationHolderName}`,
        );
        break;
      }
      default: {
        const _exhaustive: never = mode;
        throw new Error(`Unhandled money mode: ${_exhaustive}`);
      }
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!mode) return;

    if (step === "receipt") {
      close();
      return;
    }

    if (step === "processing") {
      return;
    }

    if (step === "enter") {
      const minor = parsePositiveMinorUnits(amountInput);
      if (minor === null) {
        setError("Enter a valid amount");
        return;
      }
      if (mode === "transfer") {
        const sortCode = normalizeSortCode(sortCodeInput);
        const accountNumber = normalizeAccountNumber(accountNumberInput);
        if (!sortCode || !accountNumber) {
          setError("Enter the sort code and account number");
          return;
        }
        try {
          const confirmed = await lookupPayee.mutateAsync({
            sortCode,
            accountNumber,
          });
          setPayee(confirmed);
          setStep("review");
        } catch (err) {
          setError(
            err instanceof ApiRequestError
              ? bankingErrorMessage(err.code)
              : "Something went wrong. Try again",
          );
        }
        return;
      }
      goToAuthorize();
      return;
    }

    if (step === "review") {
      goToAuthorize();
      return;
    }

    if (step === "authorize") {
      if (!isValidAuthorizePin(pin)) {
        setError("Incorrect PIN");
        return;
      }
      setStep("processing");
      try {
        await waitWithFloor(postPayment());
        setError(null);
        setStep("receipt");
      } catch (err) {
        setError(
          err instanceof ApiRequestError
            ? `Declined. ${bankingErrorMessage(err.code)}`
            : "Something went wrong. Try again",
        );
        setStep("authorize");
      }
    }
  };

  if (!mode) return null;

  const reviewMinor = parsePositiveMinorUnits(amountInput);
  const amountLabel = formatMoney(reviewMinor ?? 0);
  const progressCopy = paymentProgressCopy(mode, amountLabel, payee);
  const receiptCopy = paymentReceiptCopy(mode, payee);

  const description = (() => {
    switch (step) {
      case "receipt":
        return receiptCopy.hint;
      case "processing":
        return progressCopy.hint;
      case "authorize":
        return "Enter your PIN to authorize.";
      case "review":
        return payee?.rail === "external"
          ? "This payment leaves Puro. Check the details, then authorize."
          : "Check the payee, then authorize.";
      case "enter":
        return mode === "transfer"
          ? "Pay a Puro account or another UK sort code and account number."
          : "Enter an amount in pounds.";
      default: {
        const _exhaustive: never = step;
        return _exhaustive;
      }
    }
  })();

  const submitLabel = (() => {
    if (lookupPayee.isPending) return "Checking…";
    if (step === "receipt") return "Done";
    if (step === "authorize") return "Authorize";
    return "Continue";
  })();

  const title = (() => {
    switch (step) {
      case "receipt":
        return receiptCopy.title;
      case "processing":
        return progressCopy.title;
      case "enter":
      case "review":
      case "authorize":
        return TITLES[mode];
      default: {
        const _exhaustive: never = step;
        return _exhaustive;
      }
    }
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {step === "receipt" ? (
            <PaymentStatus
              phase="receipt"
              mode={mode}
              amountLabel={receiptLine ?? amountLabel}
              payee={payee}
            />
          ) : step === "processing" ? (
            <PaymentStatus
              phase="processing"
              mode={mode}
              amountLabel={amountLabel}
              payee={payee}
            />
          ) : step === "authorize" ? (
            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(event) =>
                  setPin(digitsOnly(event.target.value, 4))
                }
              />
            </div>
          ) : mode === "transfer" && step === "review" ? (
            <div className="space-y-1 text-sm text-ink">
              <p>
                {reviewMinor !== null && payee
                  ? `${formatMoney(reviewMinor)} to ${payee.name}`
                  : "Confirm this transfer."}
              </p>
              {payee ? (
                <>
                  <p className="tabular-nums text-muted">
                    {payee.sortCode} / {payee.accountNumber}
                  </p>
                  {payee.rail === "external" ? (
                    <p className="text-muted">
                      The other bank is not on Puro. The debit still posts here.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {mode === "transfer" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sort-code">Sort code</Label>
                    <Input
                      id="sort-code"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="04-00-11"
                      value={sortCodeInput}
                      onChange={(event) =>
                        setSortCodeInput(formatSortCodeInput(event.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-number">Account number</Label>
                    <Input
                      id="account-number"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={8}
                      placeholder="8 digits"
                      value={accountNumberInput}
                      onChange={(event) =>
                        setAccountNumberInput(
                          digitsOnly(event.target.value, 8),
                        )
                      }
                    />
                  </div>
                </>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                />
              </div>
            </div>
          )}

          {error ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            {step === "receipt" || step === "processing" ? null : (
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                disabled={busy}
              >
                Cancel
              </Button>
            )}
            {step === "processing" ? null : (
              <Button type="submit" disabled={busy} aria-busy={busy}>
                {submitLabel}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
