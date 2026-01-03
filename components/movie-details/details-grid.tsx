"use client";

import * as React from "react";
import { Calendar, Clock, Star, DollarSign, Building2, Globe, Languages } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinksCard } from "@/components/details-shared/links-card";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  ProductionCompany,
  ProductionCountry,
  SpokenLanguage,
  MovieExternalIDs,
} from "@/lib/tmdb/types";

interface MovieDetailsGridProps {
  releaseDate: string;
  status: string;
  runtime: number | null;
  voteAverage: number;
  voteCount: number;
  budget: number;
  revenue: number;
  productionCompanies: ProductionCompany[];
  productionCountries: ProductionCountry[];
  spokenLanguages: SpokenLanguage[];
  movieId: number;
  externalIds: MovieExternalIDs;
  homepage: string | null;
  className?: string;
}

export function MovieDetailsGrid({
  releaseDate,
  status,
  runtime,
  voteAverage,
  voteCount,
  budget,
  revenue,
  productionCompanies,
  productionCountries,
  spokenLanguages,
  movieId,
  externalIds,
  homepage,
  className,
}: MovieDetailsGridProps) {
  const formattedDate = releaseDate
    ? new Date(releaseDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  const hours = runtime ? Math.floor(runtime / 60) : 0;
  const minutes = runtime ? runtime % 60 : 0;
  const runtimeText = runtime ? `${hours > 0 ? `${hours}h ` : ""}${minutes}m` : "Unknown";

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
            <span className="text-muted-foreground">Release Date</span>
            <span>{formattedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span>{status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Runtime</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {runtimeText}
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

      {/* Financials Card */}
      {(budget > 0 || revenue > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-8">
              {budget > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Budget</p>
                  <p className="text-lg font-semibold">{formatCurrency(budget)}</p>
                </div>
              )}
              {revenue > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-lg font-semibold">{formatCurrency(revenue)}</p>
                </div>
              )}
              {budget > 0 && revenue > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Profit</p>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      revenue - budget >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {formatCurrency(revenue - budget)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links Card */}
      <LinksCard
        tmdbId={movieId}
        externalIds={externalIds}
        homepage={homepage}
        type="movie"
        className={budget > 0 || revenue > 0 ? "" : "md:col-span-2 lg:col-span-3"}
      />
    </div>
  );
}
