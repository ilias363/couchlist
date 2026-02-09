"use client";

import * as React from "react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useConvex, useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/common/confirm-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ImportedDataResult, ImportMode } from "@/lib/types";
import { Download, Upload, Trash2, AlertTriangle, FileJson, Loader2 } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";

export default function SettingsPage() {
  const convex = useConvex();
  const importData = useMutation(api.importExport.importData);
  const clearMovies = useMutation(api.movie.clearAllMovies);
  const clearTv = useMutation(api.tv.clearAllTvData);

  const [mode, setMode] = useState<ImportMode>("merge");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ImportedDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownload = async () => {
    setExporting(true);
    setError(null);
    setSuccessMessage(null);
    setResult(null);
    try {
      const data = await convex.query(api.importExport.exportData, {});
      if (!data) {
        throw new Error("Unable to export data. Are you signed in?");
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setError("Please select a valid JSON file");
      return;
    }

    setError(null);
    setResult(null);
    setSuccessMessage(null);
    setBusy(true);
    try {
      const raw = await readFile(file);
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schema !== "couchlist.export") {
        throw new Error("This file doesn't look like a CouchList backup.");
      }
      const res = await importData({ payload: parsed, mode });
      setResult(res);
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
    <div className="max-w-3xl mx-auto">
      <PageTitle title="Settings" subtitle="Manage your tracked data" className="mb-4" />

      {/* Error Display */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6">
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
                    Your backup includes all movies, TV series, and episode watch history. Use this
                    to transfer your data or as a safety backup.
                  </p>
                </div>
                <Button onClick={handleDownload} disabled={exporting} className="whitespace-nowrap">
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
                <div className="rounded-lg border p-4 bg-green-500/10 text-sm">
                  <p className="font-medium text-green-600 dark:text-green-400">Export Complete</p>
                  <p className="text-muted-foreground">
                    Your backup file has been downloaded successfully.
                  </p>
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
            <CardDescription>Restore from a previously exported backup file</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Import a CouchList backup file to restore your watch history. Choose to merge
                    with existing data or replace it completely.
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
                    disabled={busy}
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
                  value={mode}
                  onValueChange={v => setMode(v as ImportMode)}
                  className="flex flex-col sm:flex-row gap-4"
                >
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="merge" disabled={busy} />
                    <div>
                      <span className="font-medium">Merge</span>
                      <p className="text-xs text-muted-foreground">
                        Add new items, keep existing ones
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="replace" disabled={busy} />
                    <div>
                      <span className="font-medium">Replace</span>
                      <p className="text-xs text-muted-foreground">
                        Delete all existing data first
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              {/* Import Result */}
              {result && (
                <div className="rounded-lg border p-4 bg-green-500/10 text-sm">
                  <p className="font-medium mb-2">Import Complete</p>
                  <div className="text-muted-foreground space-y-1">
                    <p>
                      Movies: {result.movies.inserted} added, {result.movies.updated} updated
                    </p>
                    <p>
                      TV Series: {result.tvSeries.inserted} added, {result.tvSeries.updated} updated
                    </p>
                    <p>
                      Episodes: {result.episodes.inserted} added, {result.episodes.updated} updated
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/50">
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
                onConfirm={async () => {
                  await clearMovies({});
                  setError(null);
                  setResult(null);
                  setSuccessMessage("All movies have been cleared successfully.");
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
                  Remove all TV series and episode history. This cannot be undone.
                </p>
              </div>
              <ConfirmButton
                title="Clear ALL tracked TV data?"
                description="This will delete all your tracked TV series and episodes permanently."
                confirmText="Delete TV data"
                confirmPhrase="delete tv"
                variant="destructive"
                onConfirm={async () => {
                  await clearTv({});
                  setError(null);
                  setResult(null);
                  setSuccessMessage("All TV series and episodes have been cleared successfully.");
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear TV Data
              </ConfirmButton>
            </div>

            {/* Clear Success */}
            {successMessage && successMessage !== "Data exported successfully!" && (
              <div className="rounded-lg border p-4 bg-green-500/10 text-sm">
                <p className="font-medium text-green-600 dark:text-green-400">Operation Complete</p>
                <p className="text-muted-foreground">{successMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
