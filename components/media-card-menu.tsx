"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WATCH_STATUSES } from "@/lib/tmdb/utils";
import type { WatchStatus } from "@/lib/tmdb/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, MoreVertical, Trash2 } from "lucide-react";

type StatusOption = (typeof WATCH_STATUSES)[number];

interface MediaCardMenuProps {
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  statusLabel?: string;
  statusOptions: StatusOption[];
  currentStatus: WatchStatus | null;
  onStatusSelect: (status: WatchStatus) => void;
  updating: boolean;
  removeDialogOpen: boolean;
  onRemoveDialogOpenChange: (open: boolean) => void;
  onRemove: () => Promise<void> | void;
  removing: boolean;
  isMovie: boolean;
}

export function MediaCardMenu({
  menuOpen,
  onMenuOpenChange,
  statusLabel,
  statusOptions,
  currentStatus,
  onStatusSelect,
  updating,
  removeDialogOpen,
  onRemoveDialogOpenChange,
  onRemove,
  removing,
  isMovie,
}: MediaCardMenuProps) {
  return (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
      <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full border bg-background/80 text-muted-foreground transition hover:bg-background hover:text-foreground",
              updating ? "opacity-60" : ""
            )}
            aria-label="Manage status"
            disabled={updating}
          >
            {updating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="flex items-center justify-between space-x-1 text-xs uppercase tracking-wide">
            <span>Status</span>
            <span className="text-muted-foreground">{statusLabel ?? "Not set"}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {statusOptions.map(option => (
            <DropdownMenuItem
              key={option.value}
              className="cursor-pointer"
              onSelect={event => {
                event.preventDefault();
                onStatusSelect(option.value as WatchStatus);
              }}
              disabled={updating}
            >
              <span>{option.label}</span>
              {currentStatus === option.value ? (
                <Check className="ml-auto h-4 w-4 text-primary" />
              ) : null}
            </DropdownMenuItem>
          ))}
          {currentStatus ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                disabled={updating}
                onSelect={event => {
                  event.preventDefault();
                  onMenuOpenChange(false);
                  onRemoveDialogOpenChange(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Remove from my list
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={removeDialogOpen} onOpenChange={onRemoveDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from your list?</AlertDialogTitle>
            <AlertDialogDescription>
              {isMovie
                ? "This will delete this movie from your tracked list."
                : "This will delete this TV series and all its tracked episodes."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={() => {
                void onRemove();
              }}
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
