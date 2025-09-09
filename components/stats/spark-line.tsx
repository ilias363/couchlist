export function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);

  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((value, i) => {
        const height = (value / max) * 100;
        return (
          <div
            key={i}
            className="flex-1 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-sm transition-all hover:from-emerald-600 hover:to-emerald-500"
            style={{ height: `${height}%` }}
            title={`${value} items`}
          />
        );
      })}
    </div>
  );
}
