"use client";

import { type ReactNode, useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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
  onConfirm: (watchedAtMs?: number) => void;
  title?: string;
  label?: string;
  defaultValueMs?: number;
  confirmText?: string;
  cancelText?: string;
  hideDatePicker?: boolean;
  children?: ReactNode;
}

interface WatchedDateDialogBodyProps {
  onConfirm: (watchedAtMs?: number) => void;
  onOpenChange: (open: boolean) => void;
  label: string;
  defaultValueMs?: number;
  confirmText: string;
  cancelText: string;
  hideDatePicker: boolean;
  children?: ReactNode;
}

function WatchedDateDialogBody({
  onConfirm,
  onOpenChange,
  label,
  defaultValueMs,
  confirmText,
  cancelText,
  hideDatePicker,
  children,
}: WatchedDateDialogBodyProps) {
  const checkboxId = useId();
  const [value, setValue] = useState(() => {
    const date = defaultValueMs ? new Date(defaultValueMs) : new Date();
    return formatDateTimeLocal(date);
  });
  const [isUnknown, setIsUnknown] = useState(false);

  const handleConfirm = () => {
    if (hideDatePicker || isUnknown) {
      onConfirm(undefined);
      return;
    }

    const dt = new Date(value);
    const ms = isNaN(dt.getTime()) ? Date.now() : dt.getTime();
    onConfirm(ms);
  };

  return (
    <>
      {!hideDatePicker && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">{label}</label>
          <input
            type="datetime-local"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={isUnknown}
          />
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id={checkboxId}
              checked={isUnknown}
              onCheckedChange={checked => setIsUnknown(checked === true)}
            />
            <label htmlFor={checkboxId} className="text-xs text-muted-foreground">
              Mark watched date as unknown
            </label>
          </div>
        </div>
      )}
      {children ? <div className="mt-2">{children}</div> : null}
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {cancelText}
        </Button>
        <Button onClick={handleConfirm}>{confirmText}</Button>
      </DialogFooter>
    </>
  );
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
  hideDatePicker = false,
  children,
}: WatchedDateDialogProps) {
  const resetKey = `${open}-${defaultValueMs ?? "now"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <WatchedDateDialogBody
          key={resetKey}
          onConfirm={onConfirm}
          onOpenChange={onOpenChange}
          label={label}
          defaultValueMs={defaultValueMs}
          confirmText={confirmText}
          cancelText={cancelText}
          hideDatePicker={hideDatePicker}
        >
          {children}
        </WatchedDateDialogBody>
      </DialogContent>
    </Dialog>
  );
}
