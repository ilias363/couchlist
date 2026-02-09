import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:ring-2 focus-visible:ring-primary/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-300 overflow-hidden shadow-sm",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-primary/20 [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-white shadow-destructive/20 [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/80",
        outline:
          "text-foreground border-border/50 [a&]:hover:bg-primary/5 [a&]:hover:border-primary/30 [a&]:hover:text-primary",
        want_to_watch:
          "border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400 dark:bg-blue-500/20",
        currently_watching:
          "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20",
        watched:
          "border-transparent bg-green-500/15 text-green-600 dark:text-green-400 dark:bg-green-500/20",
        up_to_date:
          "border-transparent bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 dark:bg-cyan-500/20",
        on_hold:
          "border-transparent bg-orange-500/15 text-orange-600 dark:text-orange-400 dark:bg-orange-500/20",
        dropped:
          "border-transparent bg-red-500/15 text-red-600 dark:text-red-400 dark:bg-red-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    // @ts-ignore — Radix Slot ref type mismatch with React 19
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
