"use client";

import { Button } from "@/components/ui/button";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import { ConfirmButton } from "./ui/confirm-dialog";
import { Trash2 } from "lucide-react";

export interface StatusSelectorProps {
  type: "movie" | "tv";
  currentStatus?: string;
  disabled?: boolean;
  onChange: (status: string) => void;
  onRemove?: () => Promise<void>;
}

export function StatusSelector({
  type,
  currentStatus,
  disabled,
  onChange,
  onRemove,
}: StatusSelectorProps) {
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
        {currentStatus && onRemove && (
          <ConfirmButton
            variant="destructive"
            size="sm"
            onConfirm={onRemove}
            disabled={disabled}
            title="Remove from your list?"
            description={
              type === "movie"
                ? "This will delete this movie from your tracked list."
                : "This will delete this TV series and all its tracked episodes."
            }
            confirmText="Remove"
          >
            <Trash2 className="h-4 w-4" /> Remove
          </ConfirmButton>
        )}
      </div>
    </div>
  );
}
