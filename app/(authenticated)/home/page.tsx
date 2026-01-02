"use client";

import { CategorySection } from "@/components/home/category-section";
import { api } from "@/convex/_generated/api";
import { useQueries } from "convex/react";
import { Sparkles, TrendingUp, Star, Play, Calendar } from "lucide-react";

export default function HomePage() {
  const { allMovieStatuses, allTvStatuses } = useQueries({
    allMovieStatuses: { query: api.movie.listAllMovieStatuses, args: {} },
    allTvStatuses: { query: api.tv.listAllTvStatuses, args: {} },
  });

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
            <p className="text-muted-foreground">Explore trending and popular movies & TV series</p>
          </div>
        </div>
      </div>

      {/* Trending Section */}
      <div className="space-y-8">
        <CategorySection
          title="Trending Movies"
          subtitle="What everyone's watching this week"
          icon={TrendingUp}
          type="movie"
          category="trending"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
        />
        <CategorySection
          title="Trending TV Shows"
          subtitle="The hottest series right now"
          icon={TrendingUp}
          type="tv"
          category="trending"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
        />
      </div>

      {/* Popular Section */}
      <div className="space-y-8">
        <CategorySection
          title="Popular Movies"
          subtitle="Fan favorites and crowd pleasers"
          icon={Star}
          type="movie"
          category="popular"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
        <CategorySection
          title="Popular TV Shows"
          subtitle="Binge-worthy series everyone loves"
          icon={Star}
          type="tv"
          category="popular"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
      </div>

      {/* Top Rated Section */}
      <div className="space-y-8">
        <CategorySection
          title="Top Rated Movies"
          subtitle="Critically acclaimed masterpieces"
          icon={Star}
          type="movie"
          category="top_rated"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
        <CategorySection
          title="Top Rated TV Shows"
          subtitle="The best of television"
          icon={Star}
          type="tv"
          category="top_rated"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
      </div>

      {/* Now Playing / Airing Section */}
      <div className="space-y-8">
        <CategorySection
          title="Now Playing"
          subtitle="Currently in theaters"
          icon={Play}
          type="movie"
          category="now_playing"
          allMovieStatuses={allMovieStatuses}
          allTvStatuses={allTvStatuses}
          defer
        />
        <CategorySection
          title="Airing Today"
          subtitle="New episodes available now"
          icon={Calendar}
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
