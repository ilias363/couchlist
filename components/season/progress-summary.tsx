import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export function ProgressSummary({ watched, total }: { watched: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((watched / total) * 100);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <CheckCircle2 className={cn("h-4 w-4", pct === 100 && "text-green-500")} />
      <span className="text-nowrap">
        {watched}/{total} ({pct}%)
      </span>
    </div>
  );
}
