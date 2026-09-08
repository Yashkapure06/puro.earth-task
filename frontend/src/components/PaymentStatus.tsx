import { paymentProgressCopy, type MoneyMode } from "@/lib/payment-copy";
import { MONEY_PROCESSING_MIN_MS } from "@/lib/processing";
import type { Payee } from "@/types/api";

type PaymentStatusProps = {
  phase: "processing" | "receipt";
  mode: MoneyMode;
  amountLabel: string;
  payee: Payee | null;
};

function CheckMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StepDot({
  state,
}: {
  state: "done" | "current" | "pending";
}) {
  if (state === "done") {
    return (
      <span className="mt-0.5 flex h-4 w-4 items-center justify-center text-ink">
        <CheckMark className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="mt-1.5 flex h-4 w-4 items-center justify-center">
        <span className="puro-step-current block h-1.5 w-1.5 rounded-full bg-ink" />
      </span>
    );
  }
  return (
    <span className="mt-1.5 flex h-4 w-4 items-center justify-center">
      <span className="block h-1.5 w-1.5 rounded-full bg-hairline" />
    </span>
  );
}

export function PaymentStatus({
  phase,
  mode,
  amountLabel,
  payee,
}: PaymentStatusProps) {
  const progress = paymentProgressCopy(mode, amountLabel, payee);

  if (phase === "receipt") {
    return (
      <div aria-live="polite">
        <p className="font-serif text-3xl font-medium tracking-tight tabular-nums text-ink">
          {amountLabel}
        </p>
        <ol className="mt-6 space-y-3 text-sm">
          <li className="flex gap-3 text-ink">
            <StepDot state="done" />
            <span>PIN authorised</span>
          </li>
          <li className="flex gap-3 text-ink">
            <StepDot state="done" />
            <span>Posted to the ledger</span>
          </li>
          <li className="flex gap-3 text-ink">
            <StepDot state="done" />
            <span>On your statement</span>
          </li>
        </ol>
      </div>
    );
  }

  const postingLabel = (() => {
    switch (mode) {
      case "deposit":
        return "Posting the deposit";
      case "withdraw":
        return "Posting the withdrawal";
      case "transfer":
        return "Sending the payment";
      default: {
        const _exhaustive: never = mode;
        return _exhaustive;
      }
    }
  })();

  return (
    <div>
      <p
        role="status"
        aria-live="polite"
        className="font-serif text-2xl font-medium tracking-tight tabular-nums text-ink"
      >
        {progress.status}
      </p>
      <div
        role="progressbar"
        aria-label="Posting payment"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext="In progress"
        className="mt-5 h-0.5 w-full overflow-hidden bg-hairline"
      >
        <div
          className="puro-progress-fill h-0.5 w-full bg-ink"
          style={{ animationDuration: `${MONEY_PROCESSING_MIN_MS}ms` }}
        />
      </div>
      <ol className="mt-6 space-y-3 text-sm">
        <li className="flex gap-3 text-ink">
          <StepDot state="done" />
          <span>PIN authorised</span>
        </li>
        <li className="flex gap-3 text-ink">
          <StepDot state="current" />
          <span>{postingLabel}</span>
        </li>
        <li className="flex gap-3 text-muted">
          <StepDot state="pending" />
          <span>Updating your statement</span>
        </li>
      </ol>
    </div>
  );
}
