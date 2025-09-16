"use client";

import { Button } from "@/components/ui/button";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import { ConfirmButton } from "./confirm-dialog";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { WatchedDateDialog } from "@/components/watched-date-dialog";

export interface StatusSelectorProps {
  type: "movie" | "tv";
  currentStatus?: string;
  disabled?: boolean;
  onChange: (status: string, watchedAt?: number) => void;
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

  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [defaultMs, setDefaultMs] = useState<number | undefined>(undefined);

  const handleClick = (status: string) => {
    if (status === "watched") {
      setPendingStatus(status);
      setDefaultMs(Date.now());
      setOpen(true);
    } else {
      onChange(status);
    }
  };

  const handleConfirm = (ms: number) => {
    if (!pendingStatus) return;
    onChange(pendingStatus, ms);
    setOpen(false);
    setPendingStatus(null);
  };

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
              onClick={() => handleClick(s.value)}
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

      <WatchedDateDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
        defaultValueMs={defaultMs}
      />
    </div>
  );
}
