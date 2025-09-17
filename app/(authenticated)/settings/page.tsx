"use client";

import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useConvex, useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ConfirmButton } from "@/components/confirm-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ImportedDataResult, ImportMode } from "@/lib/types";

export default function SettingsPage() {
  const convex = useConvex();
  const importData = useMutation(api.importExport.importData);

  const [mode, setMode] = useState<ImportMode>("merge");
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ImportedDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputId = `file-${Math.random().toString(36).slice(2)}`;

  const handleDownload = async () => {
    setError(null);
    setExporting(true);
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

  const doImport = async (replace: boolean) => {
    setError(null);
    setResult(null);
    const input = document.getElementById(fileInputId) as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setError("Please choose a backup file first.");
      return;
    }
    setBusy(true);
    try {
      const raw = await readFile(file);
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schema !== "couchlist.export") {
        throw new Error("This file doesn't look like a CouchList backup.");
      }
      const res = await importData({ payload: parsed, mode: replace ? "replace" : mode });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Import or export your tracked data.</p>
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Export</h2>
          <p className="text-sm text-muted-foreground">
            Download a JSON backup of your movies, TV series, and episode progress.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={handleDownload} disabled={exporting}>
            {exporting ? "Preparing…" : "Download backup"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Import</h2>
          <p className="text-sm text-muted-foreground">
            Restore from a CouchList backup file. Merge keeps your existing items; Replace clears
            them first.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <label htmlFor={fileInputId} className="text-sm font-medium">
              Backup file
            </label>
            <div className="flex items-center gap-2">
              <Input
                id={fileInputId}
                type="file"
                accept="application/json,.json"
                onChange={e => setSelectedFileName(e.target.files?.[0]?.name ?? "")}
                disabled={busy}
              />
              {selectedFileName && (
                <span
                  className="text-xs text-muted-foreground truncate max-w-[220px]"
                  title={selectedFileName}
                >
                  {selectedFileName}
                </span>
              )}
            </div>
          </div>

          <RadioGroup
            value={mode}
            onValueChange={v => setMode(v as ImportMode)}
            className="grid grid-cols-2 gap-4 max-w-xs"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="merge" disabled={busy} aria-label="Merge" />
              Merge
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="replace" disabled={busy} aria-label="Replace" />
              Replace
            </label>
          </RadioGroup>

          <div className="flex items-center gap-2">
            {mode === "replace" ? (
              <ConfirmButton
                title="Replace all your data?"
                description="This will delete all your tracked movies, TV series, and episodes before importing."
                confirmText="Yes, replace"
                onConfirm={() => doImport(true)}
                disabled={busy}
              >
                Import (Replace)
              </ConfirmButton>
            ) : (
              <Button onClick={() => doImport(false)} disabled={busy}>
                Import (Merge)
              </Button>
            )}
            {busy && <span className="text-xs text-muted-foreground">Importing…</span>}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {result && (
            <div className="text-sm text-muted-foreground">
              <div>
                Mode: <b>{result.mode}</b>
              </div>
              <div>
                Movies: inserted {result.movies.inserted}, updated {result.movies.updated}, total{" "}
                {result.movies.total}
              </div>
              <div>
                TV: inserted {result.tvSeries.inserted}, updated {result.tvSeries.updated}, total{" "}
                {result.tvSeries.total}
              </div>
              <div>
                Episodes: inserted {result.episodes.inserted}, updated {result.episodes.updated},
                total {result.episodes.total}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
