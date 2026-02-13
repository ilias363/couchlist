"use client";

import { cn } from "@/lib/utils";

interface HeaderShellProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}

export function HeaderShell({
  children,
  className,
  innerClassName,
}: HeaderShellProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border/30 bg-background/80 backdrop-blur-2xl supports-backdrop-filter:bg-background/60",
        className
      )}
    >
      <div
        className={cn(
          "w-full max-w-7xl mx-auto flex h-16 items-center justify-between px-2 sm:px-4 lg:px-6",
          innerClassName
        )}
      >
        {children}
      </div>
    </header>
  );
}
