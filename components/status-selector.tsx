"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmButton } from "./confirm-dialog";
import {
  Bookmark,
  CheckCircle2,
  Eye,
  Trash2,
  CircleX,
  CirclePause,
  HelpCircle,
} from "lucide-react";
import { useState, ReactNode } from "react";
import { WatchedDateDialog } from "@/components/watched-date-dialog";
import type { WatchStatus } from "@/lib/tmdb/types";

interface StatusOption {
  value: WatchStatus;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  className: string;
  tvOnly?: boolean;
}

const WATCH_STATUS_OPTIONS: StatusOption[] = [
  {
    value: "want_to_watch",
    label: "Want to Watch",
    icon: <Bookmark className="h-4 w-4" />,
    iconColor: "text-blue-500",
    className:
      "hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-600 dark:data-[active=true]:text-blue-400",
  },
  {
    value: "currently_watching",
    label: "Watching",
    icon: <Eye className="h-4 w-4" />,
    iconColor: "text-amber-500",
    className:
      "hover:bg-amber-500/20 hover:text-amber-600 dark:hover:text-amber-400 data-[active=true]:bg-amber-500/20 data-[active=true]:text-amber-600 dark:data-[active=true]:text-amber-400",
    tvOnly: true,
  },
  {
    value: "watched",
    label: "Watched",
    icon: <CheckCircle2 className="h-4 w-4" />,
    iconColor: "text-green-500",
    className:
      "hover:bg-green-500/20 hover:text-green-600 dark:hover:text-green-400 data-[active=true]:bg-green-500/20 data-[active=true]:text-green-600 dark:data-[active=true]:text-green-400",
  },
  {
    value: "on_hold",
    label: "On Hold",
    icon: <CirclePause className="h-4 w-4" />,
    iconColor: "text-orange-500",
    className:
      "hover:bg-orange-500/20 hover:text-orange-600 dark:hover:text-orange-400 data-[active=true]:bg-orange-500/20 data-[active=true]:text-orange-600 dark:data-[active=true]:text-orange-400",
  },
  {
    value: "dropped",
    label: "Dropped",
    icon: <CircleX className="h-4 w-4" />,
    iconColor: "text-red-500",
    className:
      "hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 data-[active=true]:bg-red-500/20 data-[active=true]:text-red-600 dark:data-[active=true]:text-red-400",
  },
];

export interface StatusSelectorProps {
  type: "movie" | "tv";
  currentStatus?: string;
  disabled?: boolean;
  onChange: (status: string, watchedAt?: number) => void;
  onRemove?: () => Promise<void>;
  children?: ReactNode;
  className?: string;
}

export function StatusSelector({
  type,
  currentStatus,
  disabled,
  onChange,
  onRemove,
  children,
  className,
}: StatusSelectorProps) {
  const statuses =
    type === "movie" ? WATCH_STATUS_OPTIONS.filter(s => !s.tvOnly) : WATCH_STATUS_OPTIONS;

  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [defaultMs, setDefaultMs] = useState<number | undefined>(undefined);

  const handleClick = (status: string) => {
    if (status === currentStatus) return;
    if (status === "watched") {
      setPendingStatus(status);
      setDefaultMs(Date.now());
      setOpen(true);
    } else {
      onChange(status);
    }
  };

  const handleConfirm = (ms?: number) => {
    if (!pendingStatus) return;
    onChange(pendingStatus, ms);
    setOpen(false);
    setPendingStatus(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map(status => {
          const isActive = currentStatus === status.value;
          return (
            <Button
              key={status.value}
              variant="outline"
              size="sm"
              disabled={disabled}
              data-active={isActive}
              className={cn("transition-all duration-200", status.className, isActive && "ring-1")}
              onClick={() => handleClick(status.value)}
            >
              <span className={status.iconColor}>{status.icon}</span>
              <span className="ml-1.5 hidden sm:inline">{status.label}</span>
            </Button>
          );
        })}
        {currentStatus && onRemove && (
          <ConfirmButton
            variant="ghost"
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
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Remove</span>
          </ConfirmButton>
        )}
        {/* Help icon with legend dropdown - visible only on mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="sm:hidden text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            <div className="flex flex-col gap-1.5 p-2">
              {statuses.map(status => (
                <div key={status.value} className="flex items-center gap-2">
                  <span className={status.iconColor}>{status.icon}</span>
                  <span className="text-sm">{status.label}</span>
                </div>
              ))}
              {currentStatus && onRemove && (
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="text-sm">Remove</span>
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <WatchedDateDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
        defaultValueMs={defaultMs}
      >
        {children}
      </WatchedDateDialog>
    </div>
  );
}
