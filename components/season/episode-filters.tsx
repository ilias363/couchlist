import { Button } from "@/components/ui/button";
import { Filter, Eye, EyeOff, List } from "lucide-react";

export function EpisodeFilters({
  filter,
  setFilter,
}: {
  filter: "all" | "watched" | "unwatched";
  setFilter: (f: "all" | "watched" | "unwatched") => void;
}) {
  const options: { key: typeof filter; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All", icon: <List className="h-4 w-4" /> },
    { key: "watched", label: "Watched", icon: <Eye className="h-4 w-4" /> },
    { key: "unwatched", label: "Unwatched", icon: <EyeOff className="h-4 w-4" /> },
  ];

  return (
    <div className="flex items-center gap-3">
      {options.map(o => (
        <Button
          key={o.key}
          size="sm"
          variant={filter === o.key ? "default" : "outline"}
          onClick={() => setFilter(o.key)}
          className="gap-1.5 rounded-full"
        >
          {o.icon}
          {o.label}
        </Button>
      ))}
    </div>
  );
}
