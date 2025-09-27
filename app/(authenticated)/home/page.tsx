"use client";

import { CategorySection } from "@/components/home/category-section";
import { api } from "@/convex/_generated/api";
import { useQueries } from "convex/react";

export default function HomePage() {
  const { allMovieStatuses, allTvStatuses } = useQueries({
    allMovieStatuses: { query: api.movie.listAllMovieStatuses, args: {} },
    allTvStatuses: { query: api.tv.listAllTvStatuses, args: {} },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Home</h1>
        <p className="text-sm text-muted-foreground">Trending and popular movies & TV series.</p>
      </div>
      <div className="space-y-10">
        <CategorySection
          title="Trending Movies"
          type="movie"
          category="trending"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
        />
        <CategorySection
          title="Trending TV"
          type="tv"
          category="trending"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
        />
        <CategorySection
          title="Popular Movies"
          type="movie"
          category="popular"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
        <CategorySection
          title="Popular TV"
          type="tv"
          category="popular"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
        <CategorySection
          title="Top Rated Movies"
          type="movie"
          category="top_rated"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
        <CategorySection
          title="Top Rated TV"
          type="tv"
          category="top_rated"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
        <CategorySection
          title="Now Playing"
          type="movie"
          category="now_playing"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
        <CategorySection
          title="Airing Today"
          type="tv"
          category="airing_today"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
      </div>
    </div>
  );
}
