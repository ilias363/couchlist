"use client";

import { type ReactNode, useId, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

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
  const dateId = useId();
  const errorId = useId();
  const dateInput = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(() => {
    const date = new Date(defaultValueMs ?? Date.now());
    return formatDateTimeLocal(date);
  });
  const [isUnknown, setIsUnknown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (hideDatePicker || isUnknown) {
      onConfirm(undefined);
      return;
    }

    // Validate the visible input too: native partial date edits can be invalid
    // before a change event updates the controlled value.
    const visibleValue = dateInput.current?.value ?? value;
    const ms = new Date(visibleValue).getTime();
    if (!visibleValue || !Number.isFinite(ms) || dateInput.current?.validity.valid === false) {
      setValue(visibleValue);
      setError("Enter a valid watch date or select unknown.");
      return;
    }
    onConfirm(ms);
  };

  return (
    <>
      {!hideDatePicker && (
        <div className="flex flex-col gap-2" data-invalid={Boolean(error)}>
          <label htmlFor={dateId} className="text-xs text-muted-foreground">{label}</label>
          <Input
            ref={dateInput}
            id={dateId}
            type="datetime-local"
            value={value}
            onChange={e => {
              setValue(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            disabled={isUnknown}
          />
          {error && <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id={checkboxId}
              checked={isUnknown}
              onCheckedChange={checked => {
                setIsUnknown(checked === true);
                setError(null);
              }}
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
