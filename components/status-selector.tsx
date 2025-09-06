"use client";

import { Button } from "@/components/ui/button";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";

export interface StatusSelectorProps {
  type: "movie" | "tv";
  currentStatus?: string;
  disabled?: boolean;
  onChange: (status: string) => void;
}

export function StatusSelector({ type, currentStatus, disabled, onChange }: StatusSelectorProps) {
  const STATUSES =
    type === "movie"
      ? WATCH_STATUSES.filter(s => s.value !== "currently_watching")
      : WATCH_STATUSES;
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Select Status</h2>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => {
          const active = currentStatus === s.value;
          return (
            <Button
              key={s.value}
              variant={active ? "default" : "outline"}
              size="sm"
              disabled={disabled}
              onClick={() => onChange(s.value)}
              className="text-xs"
            >
              {s.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
