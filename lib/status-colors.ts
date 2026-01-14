export const STATUS_COLORS = {
  // User watch statuses
  want_to_watch: {
    bg: "bg-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    hex: "#3B82F6", // blue-500
    iconColor: "text-blue-500",
    hoverActive: "hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 data-[active=true]:bg-blue-500/20 data-[active=true]:text-blue-600 dark:data-[active=true]:text-blue-400",
  },
  currently_watching: {
    bg: "bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    hex: "#F59E0B", // amber-500
    iconColor: "text-amber-500",
    hoverActive: "hover:bg-amber-500/20 hover:text-amber-600 dark:hover:text-amber-400 data-[active=true]:bg-amber-500/20 data-[active=true]:text-amber-600 dark:data-[active=true]:text-amber-400",
  },
  watched: {
    bg: "bg-green-500/20",
    text: "text-green-600 dark:text-green-400",
    hex: "#22C55E", // green-500
    iconColor: "text-green-500",
    hoverActive: "hover:bg-green-500/20 hover:text-green-600 dark:hover:text-green-400 data-[active=true]:bg-green-500/20 data-[active=true]:text-green-600 dark:data-[active=true]:text-green-400",
  },
  up_to_date: {
    bg: "bg-cyan-500/20",
    text: "text-cyan-600 dark:text-cyan-400",
    hex: "#06B6D4", // cyan-500
    iconColor: "text-cyan-500",
    hoverActive: "hover:bg-cyan-500/20 hover:text-cyan-600 dark:hover:text-cyan-400 data-[active=true]:bg-cyan-500/20 data-[active=true]:text-cyan-600 dark:data-[active=true]:text-cyan-400",
  },
  on_hold: {
    bg: "bg-orange-500/20",
    text: "text-orange-600 dark:text-orange-400",
    hex: "#F97316", // orange-500
    iconColor: "text-orange-500",
    hoverActive: "hover:bg-orange-500/20 hover:text-orange-600 dark:hover:text-orange-400 data-[active=true]:bg-orange-500/20 data-[active=true]:text-orange-600 dark:data-[active=true]:text-orange-400",
  },
  dropped: {
    bg: "bg-red-500/20",
    text: "text-red-600 dark:text-red-400",
    hex: "#EF4444", // red-500
    iconColor: "text-red-500",
    hoverActive: "hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 data-[active=true]:bg-red-500/20 data-[active=true]:text-red-600 dark:data-[active=true]:text-red-400",
  },
} as const;

// Map from display labels to status keys
export const STATUS_LABEL_MAP: Record<string, keyof typeof STATUS_COLORS> = {
  "Want to Watch": "want_to_watch",
  "Currently Watching": "currently_watching",
  "Watched": "watched",
  "Up to Date": "up_to_date",
  "On Hold": "on_hold",
  "Dropped": "dropped",
};

// Get hex color from display label
export function getStatusHexFromLabel(label: string): string {
  const key = STATUS_LABEL_MAP[label];
  return key ? STATUS_COLORS[key].hex : "#6B7280"; // gray-500 fallback
}

// Get Tailwind classes from status key
export function getStatusClasses(status: string): {
  bg: string;
  text: string;
  iconColor: string;
  hoverActive: string;
} {
  const key = status as keyof typeof STATUS_COLORS;
  return STATUS_COLORS[key] || {
    bg: "bg-gray-500/20",
    text: "text-gray-600 dark:text-gray-400",
    iconColor: "text-gray-500",
    hoverActive: "hover:bg-gray-500/20 hover:text-gray-600 dark:hover:text-gray-400 data-[active=true]:bg-gray-500/20 data-[active=true]:text-gray-600 dark:data-[active=true]:text-gray-400",
  };
}

// Get colors array for chart distributions (by display labels)
export function getDistributionColors(labels: string[]): string[] {
  return labels.map(label => getStatusHexFromLabel(label));
}
