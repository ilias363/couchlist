"use client";

import * as React from "react";
import { Calendar, Star, Building2, Globe, Languages, Tv } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinksCard } from "@/components/details-shared/links-card";
import { LogoImage } from "@/components/media/tmdb-image";
import { cn } from "@/lib/utils";
import type {
  ProductionCompany,
  ProductionCountry,
  SpokenLanguage,
  Network,
  TvSeriesExternalIDs,
} from "@/lib/tmdb/types";

interface TvDetailsGridProps {
  firstAirDate: string;
  status: string;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  voteAverage: number;
  voteCount: number;
  productionCompanies: ProductionCompany[];
  productionCountries: ProductionCountry[];
  spokenLanguages: SpokenLanguage[];
  networks: Network[];
  seriesId: number;
  externalIds: TvSeriesExternalIDs;
  homepage: string | null;
  className?: string;
}

export function TvDetailsGrid({
  firstAirDate,
  status,
  numberOfSeasons,
  numberOfEpisodes,
  voteAverage,
  voteCount,
  productionCompanies,
  productionCountries,
  spokenLanguages,
  networks,
  seriesId,
  externalIds,
  homepage,
  className,
}: TvDetailsGridProps) {
  const formattedDate = firstAirDate
    ? new Date(firstAirDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  const hasNetworks = networks.length > 0;

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {/* Facts Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Facts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">First Air Date</span>
            <span>{formattedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span>{status || "Unknown"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Seasons / Episodes</span>
            <span>
              {numberOfSeasons} / {numberOfEpisodes}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rating</span>
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              {voteAverage.toFixed(1)} ({voteCount.toLocaleString()} votes)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Production Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Production
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Companies</p>
            <div className="flex flex-wrap gap-1">
              {productionCompanies.length > 0 ? (
                productionCompanies.map(company => (
                  <Badge key={company.id} variant="outline" className="text-xs">
                    {company.name}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Unknown</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Countries</p>
            <div className="flex flex-wrap gap-1">
              {productionCountries.length > 0 ? (
                productionCountries.map(country => (
                  <Badge key={country.iso_3166_1} variant="outline" className="text-xs">
                    <Globe className="h-3 w-3 mr-1" />
                    {country.name}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Unknown</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Languages Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Languages className="h-4 w-4" />
            Languages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {spokenLanguages.length > 0 ? (
              spokenLanguages.map(lang => (
                <Badge key={lang.iso_639_1} variant="outline" className="text-xs">
                  {lang.english_name}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Unknown</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Networks Card */}
      {hasNetworks && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tv className="h-4 w-4" />
              Networks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {networks.map(network => (
                <div key={network.id} className="flex items-center gap-2">
                  <LogoImage
                    src={network.logo_path}
                    alt={network.name}
                    size="w154"
                    className="rounded-none"
                  />
                  <span className="text-sm">{network.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links Card */}
      <LinksCard
        tmdbId={seriesId}
        externalIds={externalIds}
        homepage={homepage}
        type="tv"
        className={hasNetworks ? "" : "md:col-span-2 lg:col-span-3"}
      />
    </div>
  );
}
