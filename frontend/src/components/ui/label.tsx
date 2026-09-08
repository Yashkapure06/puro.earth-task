import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** shadcn/ui Label. Primitive only. Screens own the banking UI. */

function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-sm text-muted", className)}
      {...props}
    />
  );
}

export { Label };
