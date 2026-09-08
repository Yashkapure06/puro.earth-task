import { cn } from "@/lib/cn";

type StatusPillProps = {
  closed: boolean;
};

export function StatusPill({ closed }: StatusPillProps) {
  const label = closed ? "Closed" : "Open";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        closed ? "bg-hairline text-muted" : "bg-credit/15 text-credit",
      )}
    >
      {label}
    </span>
  );
}
