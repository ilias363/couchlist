import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export function KeyValue({
  label,
  value,
  emphasize,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  emphasize?: boolean;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          "font-semibold text-sm",
          emphasize ? "text-emerald-600 dark:text-emerald-400 text-base" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}
