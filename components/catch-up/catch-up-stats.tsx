import { Tv, AlertCircle, Eye, CalendarClock } from "lucide-react";

interface CatchUpStatsProps {
  totalUpToDate: number;
  totalNeedingAttention: number;
  totalUnwatchedEpisodes: number;
  totalUpcoming: number;
  isLoading: boolean;
}

export function CatchUpStats({
  totalUpToDate,
  totalNeedingAttention,
  totalUnwatchedEpisodes,
  totalUpcoming,
  isLoading,
}: CatchUpStatsProps) {
  return (
    <div
      className="animate-fade-up grid grid-cols-2 sm:grid-cols-4 gap-3"
      style={{ animationDelay: "80ms" }}
    >
      {!isLoading ? (
        <>
          <StatCard label="Up to Date" value={totalUpToDate} icon={Tv} accent="primary" />
          <StatCard
            label="Need Attention"
            value={totalNeedingAttention}
            icon={AlertCircle}
            accent={totalNeedingAttention > 0 ? "amber" : "primary"}
          />
          <StatCard
            label="Unwatched"
            value={totalUnwatchedEpisodes}
            icon={Eye}
            accent={totalUnwatchedEpisodes > 0 ? "amber" : "primary"}
          />
          <StatCard
            label="Upcoming"
            value={totalUpcoming}
            icon={CalendarClock}
            accent={totalUpcoming > 0 ? "cyan" : "primary"}
          />
        </>
      ) : (
        <>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
              <div className="h-4 w-16 rounded bg-muted mb-2" />
              <div className="h-7 w-10 rounded bg-muted" />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "amber" | "cyan";
}) {
  const accentStyles = {
    primary: {
      iconBg: "bg-primary/10",
      iconText: "text-primary",
      valueCn: "",
    },
    amber: {
      iconBg: "bg-amber-500/10",
      iconText: "text-amber-500",
      valueCn: "text-amber-500",
    },
    cyan: {
      iconBg: "bg-cyan-500/10",
      iconText: "text-cyan-500",
      valueCn: "text-cyan-500",
    },
  }[accent];

  return (
    <div className="glass-card rounded-xl p-3.5 sm:p-4 group hover:border-primary/30 transition-all duration-300">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${accentStyles.iconBg} ${accentStyles.iconText} transition-transform duration-300 group-hover:scale-110`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
          {label}
        </span>
      </div>
      <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${accentStyles.valueCn}`}>
        {value}
      </p>
    </div>
  );
}
