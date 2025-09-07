import { Button } from "@/components/ui/button";

export function EpisodeFilters({
  filter,
  setFilter,
}: {
  filter: "all" | "watched" | "unwatched";
  setFilter: (f: "all" | "watched" | "unwatched") => void;
}) {
  const options: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "watched", label: "Watched" },
    { key: "unwatched", label: "Unwatched" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <Button
          key={o.key}
          size="sm"
          variant={filter === o.key ? "default" : "outline"}
          onClick={() => setFilter(o.key)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
