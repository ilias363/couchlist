"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between animate-fade-up",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tighter">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="mt-3 flex items-center gap-3 sm:mt-0">{actions}</div>}
    </div>
  );
}
