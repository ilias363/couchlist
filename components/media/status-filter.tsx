"use client";

import { cn } from "@/lib/utils";
import { StatusOption } from "@/lib/tmdb/types";

interface StatusFilterProps {
  options: StatusOption[];
  value: string | null | undefined;
  onChange: (value: string | undefined) => void;
  allLabel?: string;
}

export function StatusFilter({ options, value, onChange, allLabel = "All" }: StatusFilterProps) {
  return (
    <>
      {/* Mobile Filter - Horizontal Scroll Pills */}
      <div className="md:hidden -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => onChange(undefined)}
            className={cn(
              "shrink-0 px-4 py-2 text-sm font-medium rounded-full border transition-colors",
              !value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground/20"
            )}
          >
            {allLabel}
          </button>
          {options.map(s => (
            <button
              key={s.value}
              onClick={() => onChange(s.value)}
              className={cn(
                "shrink-0 px-4 py-2 text-sm font-medium rounded-full border transition-colors whitespace-nowrap",
                value === s.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/20"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Filter Tabs */}
      <div className="hidden md:block">
        <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-1">
          <button
            onClick={() => onChange(undefined)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              !value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {allLabel}
          </button>
          {options.map(s => (
            <button
              key={s.value}
              onClick={() => onChange(s.value)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                value === s.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
