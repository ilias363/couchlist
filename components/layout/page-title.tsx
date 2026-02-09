"use client";

import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageTitle({ title, subtitle, actions, className }: PageTitleProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div>
        <h1 className="font-display text-2xl sm:text-3xl tracking-tighter">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
