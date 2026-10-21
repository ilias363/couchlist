"use client";

import * as React from "react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmButton } from "@/components/common/confirm-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ImportMode } from "@/lib/types";
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  FileJson,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { parseBackup } from "@/convex/lib/backupFormat";
import { downloadBackup, uploadBackup } from "@/lib/data-operations-client";
import { PageTitle } from "@/components/layout/page-title";

const phaseLabels = {
  upload: "Validating backup", export: "Preparing backup", apply: "Restoring records",
  prune_movies: "Removing old movies", prune_tv: "Removing old TV shows", prune_episodes: "Removing old episode history",
  reset_summaries: "Updating watch history", summaries: "Updating watch history",
  delete_movies: "Removing movies", delete_tv: "Removing TV shows", delete_episodes: "Removing episode history",
  delete_stats: "Removing saved statistics", delete_stats_work: "Removing saved statistics", cleanup: "Finishing", complete: "Complete",
  awaiting_identity: "Ready to finish account deletion",
};

export default function SettingsPage() {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const operation = useQuery(api.dataOperations.current, isAuthenticated ? {} : "skip");
  const resume = useMutation(api.dataOperations.resume);
  const cancelPreparation = useMutation(api.dataOperations.cancelPreparation);
  const clearMovies = useMutation(api.movie.clearAllMovies);
  const clearTv = useMutation(api.tv.clearAllTvData);

  const [mode, setMode] = useState<ImportMode>("merge");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportCount, setExportCount] = useState(0);
  const active = operation && operation.phase !== "complete";
  const locked = busy || exporting || operation === undefined || !!active;
  const result = operation?.kind === "import" && operation.phase === "complete" && !operation.cancelled
    ? { movies: { inserted: operation.inserted.movies, updated: operation.updated.movies }, tvSeries: { inserted: operation.inserted.tvSeries, updated: operation.updated.tvSeries }, episodes: { inserted: operation.inserted.episodes, updated: operation.updated.episodes } }
    : null;
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownload = async () => {
    setExporting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      setExportCount(0);
      const blob = await downloadBackup(convex, setExportCount);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `couchlist-backup-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMessage("Data exported successfully!");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result ?? ""));
      fr.onerror = () => reject(fr.error ?? new Error("Failed to read file"));
      fr.readAsText(file);
    });

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setError("Please select a valid JSON file");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setBusy(true);
    try {
      const raw = await readFile(file);
      // Validate every record before starting any server-side preparation.
      const parsed = parseBackup(JSON.parse(raw));
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      await uploadBackup(convex, parsed, fingerprint, operation?.phase === "upload" ? operation.mode! : mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageTitle
        title="Settings"
        subtitle="Manage your tracked data"
        className="mb-6"
      />

      {/* Error Display */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {exporting && <p role="status" className="mb-4">Exporting {exportCount.toLocaleString()} records...</p>}
      {operation && active && (
        <Card className="mb-6" aria-live="polite">
          <CardHeader>
            <CardTitle>Data operation in progress</CardTitle>
            <CardDescription>
              {phaseLabels[operation.phase]}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p>
              {operation.kind === "import"
                ? `${operation.uploaded.movies + operation.uploaded.tvSeries + operation.uploaded.episodes} of ${operation.expected.movies + operation.expected.tvSeries + operation.expected.episodes} records validated; ${operation.inserted.movies + operation.inserted.tvSeries + operation.inserted.episodes + operation.updated.movies + operation.updated.tvSeries + operation.updated.episodes} restored; `
                : `${operation.processed.toLocaleString()} records processed; `}
              {operation.deleted.toLocaleString()} removed.
            </p>
            <p className="text-sm text-muted-foreground">
              {operation.phase === "upload"
                ? "Your library is unchanged. Reselect the same file to resume the upload, or discard it. Inactive uploads expire after 24 hours."
                : operation.phase === "export"
                  ? "Library changes are paused for a consistent backup. Download again or discard the export."
                  : operation.kind === "account"
                    ? "Account data cleanup runs in the background. Open Account settings and retry Delete account to finish removing your identity."
                    : "This continues in the background if you leave. Library changes are paused until completion. If progress stops, resume below."}
            </p>
            {operation.error && <p role="alert" className="text-destructive">{operation.error}</p>}
            {(operation.phase === "upload" || operation.phase === "export") ? (
              <Button variant="outline" disabled={busy || exporting} onClick={async () => {
                try { await cancelPreparation({ jobId: operation._id }); }
                catch (e) { setError(e instanceof Error ? e.message : String(e)); }
              }}>Discard preparation</Button>
            ) : operation.kind !== "account" && (
              <Button variant="outline" onClick={async () => {
                try { await resume({ jobId: operation._id }); }
                catch (e) { setError(e instanceof Error ? e.message : String(e)); }
              }}>Resume operation</Button>
            )}
          </CardContent>
        </Card>
      )}
      {operation?.phase === "complete" && ["clear_movies", "clear_tv", "delete_series"].includes(operation.kind) && (
        <p role="status" className="mb-4">Data deletion complete.</p>
      )}      {operation?.phase === "complete" && operation.cancelled && (        <p role="status" className="mb-4">Preparation discarded. Your library was unchanged.</p>      )}
      <div className="flex flex-col gap-8">
        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
            <CardDescription>
              Download a backup of all your movies, TV shows, and episodes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Your backup includes all movies, TV series, and episode
                    watch history. Use this to transfer your data or as a safety
                    backup.
                  </p>
                </div>
                <Button
                  onClick={handleDownload}
                  disabled={busy || exporting || operation === undefined || (!!active && operation?.phase !== "export")}
                  className="whitespace-nowrap"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileJson className="h-4 w-4 mr-2" />
                  )}
                  Export JSON
                </Button>
              </div>

              {/* Export Success */}
              {successMessage === "Data exported successfully!" && (
                <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      Export complete
                    </p>
                    <p className="text-muted-foreground">
                      Your backup file has been downloaded successfully.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
            <CardDescription>
              Restore from a previously exported backup file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Import a CouchList backup file to restore your watch
                    history. Choose to merge with existing data or replace it
                    completely.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="import-file"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || exporting || operation === undefined || (!!active && operation?.phase !== "upload")}
                    className="whitespace-nowrap"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Select File
                  </Button>
                </div>
              </div>

              {/* Import Mode Selection */}
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm font-medium mb-3">Import Mode</p>
                <RadioGroup
                  value={operation?.phase === "upload" ? operation.mode ?? mode : mode}
                  onValueChange={v => setMode(v as ImportMode)}
                  className="flex flex-col sm:flex-row gap-4"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="merge" disabled={locked} />
                    <div>
                      <span className="font-medium">Merge</span>
                      <p className="text-xs text-muted-foreground">
                        Add new items, keep existing ones
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="replace" disabled={locked} />
                    <div>
                      <span className="font-medium">Replace</span>
                      <p className="text-xs text-muted-foreground">
                        Safely restore the full backup, then remove old items
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Import Result */}
              {result && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm">
                  <p className="mb-2 flex items-center gap-2 font-medium text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    Import complete
                  </p>
                  <div className="text-muted-foreground space-y-1">
                    <p>
                      Movies: {result.movies.inserted} added,{" "}
                      {result.movies.updated} updated
                    </p>
                    <p>
                      TV Series: {result.tvSeries.inserted} added,{" "}
                      {result.tvSeries.updated} updated
                    </p>
                    <p>
                      Episodes: {result.episodes.inserted} added,{" "}
                      {result.episodes.updated} updated
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card id="danger-zone" className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions that will permanently delete your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
              <div>
                <p className="font-medium">Clear All Movies</p>
                <p className="text-sm text-muted-foreground">
                  Remove all movies from your library. This cannot be undone.
                </p>
              </div>
              <ConfirmButton
                title="Clear ALL tracked movies?"
                description="This will delete all your tracked movies permanently."
                confirmText="Delete movies"
                confirmPhrase="delete movies"
                variant="destructive"
                disabled={locked}
                onConfirm={async () => {
                  setError(null);
                  setSuccessMessage(null);
                  try { await clearMovies({}); }
                  catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Movies
              </ConfirmButton>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
              <div>
                <p className="font-medium">Clear All TV Data</p>
                <p className="text-sm text-muted-foreground">
                  Remove all TV series and episode history. This cannot be
                  undone.
                </p>
              </div>
              <ConfirmButton
                title="Clear ALL tracked TV data?"
                description="This will delete all your tracked TV series and episodes permanently."
                confirmText="Delete TV data"
                confirmPhrase="delete tv"
                variant="destructive"
                disabled={locked}
                onConfirm={async () => {
                  setError(null);
                  setSuccessMessage(null);
                  try { await clearTv({}); }
                  catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear TV Data
              </ConfirmButton>
            </div>

            {/* Clear Success */}
            {successMessage &&
              successMessage !== "Data exported successfully!" && (
                <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">
                      Operation complete
                    </p>
                    <p className="text-muted-foreground">{successMessage}</p>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
