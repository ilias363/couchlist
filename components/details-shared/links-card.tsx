"use client";

import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getExternalLinks } from "@/lib/tmdb/utils";
import type { MovieExternalIDs, TvSeriesExternalIDs } from "@/lib/tmdb/types";

interface LinksCardProps {
  tmdbId: number;
  externalIds: MovieExternalIDs | TvSeriesExternalIDs;
  homepage: string | null;
  type: "movie" | "tv";
  className?: string;
}

export function LinksCard({ tmdbId, externalIds, homepage, type, className }: LinksCardProps) {
  const links = getExternalLinks({
    externalIds,
    homepage,
    tmdbId,
    type,
  });

  if (links.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ExternalLink className="h-4 w-4" />
          Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-2 grid grid-cols-2">
          {links.map(l => (
            <div key={l.key}>
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {l.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
          {links.length === 0 && <span className="text-muted-foreground">No external links</span>}
        </div>
      </CardContent>
    </Card>
  );
}
