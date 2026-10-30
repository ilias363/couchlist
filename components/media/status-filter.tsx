"use client";

import { cn } from "@/lib/utils";
import { StatusOption } from "@/lib/tmdb/types";
import { getStatusClasses } from "@/lib/status-colors";

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
        <div role="group" aria-label="Filter by watch status" className="flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            aria-pressed={!value}
            onClick={() => onChange(undefined)}
            className={cn(
              "min-h-11 shrink-0 px-4 py-2 text-sm font-medium rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              !value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground/20",
            )}
          >
            {allLabel}
          </button>
          {options.map(s => {
            const active = value === s.value;
            const colors = getStatusClasses(s.value);
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(s.value)}
                className={cn(
                  "min-h-11 shrink-0 px-4 py-2 text-sm font-medium rounded-full border transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? cn(colors.bg, colors.text, "border-transparent")
                    : "bg-background text-muted-foreground border-border hover:border-foreground/20",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop Filter Tabs */}
      <div className="hidden md:block">
        <div role="group" aria-label="Filter by watch status" className="inline-flex flex-wrap items-center rounded-lg bg-muted p-1 gap-1">
          <button
            type="button"
            aria-pressed={!value}
            onClick={() => onChange(undefined)}
            className={cn(
              "min-h-9 px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              !value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50",
            )}
          >
            {allLabel}
          </button>
          {options.map(s => {
            const active = value === s.value;
            const colors = getStatusClasses(s.value);
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(s.value)}
                className={cn(
                  "min-h-9 px-3 py-1.5 text-sm font-medium rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? cn(colors.bg, colors.text, "shadow-sm")
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
