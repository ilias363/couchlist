"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function formatDateTimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

interface WatchedDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (watchedAtMs: number) => void;
  title?: string;
  label?: string;
  defaultValueMs?: number;
  confirmText?: string;
  cancelText?: string;
}

export function WatchedDateDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Watched date",
  label = "Select when you watched it",
  defaultValueMs,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: WatchedDateDialogProps) {
  const [value, setValue] = useState(formatDateTimeLocal(new Date()));

  useEffect(() => {
    const date = defaultValueMs ? new Date(defaultValueMs) : new Date();
    setValue(formatDateTimeLocal(date));
  }, [defaultValueMs, open]);

  const handleConfirm = () => {
    const dt = new Date(value);
    const ms = isNaN(dt.getTime()) ? Date.now() : dt.getTime();
    onConfirm(ms);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">{label}</label>
          <input
            type="datetime-local"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button onClick={handleConfirm}>{confirmText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
