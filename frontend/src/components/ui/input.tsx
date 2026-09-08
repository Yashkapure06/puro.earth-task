import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** shadcn/ui Input. Primitive only. Screens own the banking UI. */

function Input({
  className,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-sm border border-hairline bg-paper px-3 text-sm text-ink tabular-nums placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
