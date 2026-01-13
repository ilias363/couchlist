"use client";

import { CategorySection } from "@/components/home/category-section";
import { Sparkles, TrendingUp, Star, Play, Calendar } from "lucide-react";

export default function HomePage() {
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
        />
        <CategorySection
          title="Trending TV Shows"
          subtitle="The hottest series right now"
          icon={TrendingUp}
          type="tv"
          category="trending"
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
          defer
        />
        <CategorySection
          title="Popular TV Shows"
          subtitle="Binge-worthy series everyone loves"
          icon={Star}
          type="tv"
          category="popular"
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
          defer
        />
        <CategorySection
          title="Top Rated TV Shows"
          subtitle="The best of television"
          icon={Star}
          type="tv"
          category="top_rated"
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
          defer
        />
        <CategorySection
          title="Airing Today"
          subtitle="New episodes available now"
          icon={Calendar}
          type="tv"
          category="airing_today"
          defer
        />
      </div>
    </div>
  );
}
