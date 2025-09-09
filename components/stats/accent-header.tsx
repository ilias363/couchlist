import { LucideIcon } from "lucide-react";
import { CardDescription, CardHeader } from "../ui/card";

export function AccentHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <CardHeader className="border-b">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
        </div>
        {subtitle && <CardDescription className="text-xs">{subtitle}</CardDescription>}
      </div>
    </CardHeader>
  );
}
