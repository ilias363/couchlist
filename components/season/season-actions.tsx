"use client";

import { useRef, useState } from "react";
import { Check, Ellipsis, LoaderCircle, X } from "lucide-react";
import type { TMDBSeason } from "@/lib/tmdb/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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

export function SeasonActions({
  season,
  watchedCount,
  bulkUpdating,
  onMarkAllWatched,
  onMarkAllUnwatched,
}: {
  season: TMDBSeason;
  watchedCount: number;
  bulkUpdating: boolean;
  onMarkAllWatched: () => void | Promise<void>;
  onMarkAllUnwatched: () => void | Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<"watch" | "unwatch" | null>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const total = season.episodes.length;
  const allWatched = total > 0 && watchedCount === total;
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    menuTrigger.current?.focus();
  };
  const confirmAction = async () => {
    if (!pendingAction || bulkUpdating) return;
    await (pendingAction === "watch" ? onMarkAllWatched() : onMarkAllUnwatched());
    setPendingAction(null);
  };

  if (total === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={menuTrigger} variant="ghost" size="icon" aria-label="Season actions" aria-busy={bulkUpdating} disabled={bulkUpdating}>
            {bulkUpdating ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Ellipsis aria-hidden="true" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={event => { if (pendingAction) event.preventDefault(); }}>
          <DropdownMenuGroup>
            {!allWatched && (
              <DropdownMenuItem disabled={total === 0} onSelect={() => setPendingAction("watch")}>
                <Check aria-hidden="true" />Mark season watched
              </DropdownMenuItem>
            )}
            {watchedCount > 0 && (
              <DropdownMenuItem onSelect={() => setPendingAction("unwatch")}>
                <X aria-hidden="true" />Unwatch season
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={pendingAction !== null} onOpenChange={open => { if (!open && !bulkUpdating) setPendingAction(null); }}>
        <AlertDialogContent onCloseAutoFocus={restoreFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction === "unwatch" ? "Unwatch all episodes?" : "Mark All Episodes as Watched?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "unwatch"
                ? "This will remove all watched dates for this season."
                : "Already-watched episodes keep their dates. Newly watched episodes will have unknown dates."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={bulkUpdating} onClick={event => { event.preventDefault(); void confirmAction(); }}>
              {bulkUpdating ? "Updating..." : pendingAction === "unwatch" ? "Unwatch All" : "Watch All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
