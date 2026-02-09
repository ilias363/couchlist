"use client";

import { CategorySection } from "@/components/home/category-section";
import { Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-12 relative">
      {/* Ambient background effect */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-150 h-150 bg-gradient-radial from-primary/5 to-transparent rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-1/4 right-0 w-100 h-100 bg-gradient-radial from-primary/8 to-transparent rounded-full blur-3xl opacity-40" />
      </div>

      {/* Page Header */}
      <div className="space-y-3 animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter">Discover</h1>
            <p className="text-muted-foreground mt-0.5 text-sm sm:text-base">
              Explore trending and popular movies & TV series
            </p>
          </div>
        </div>
      </div>

      {/* Trending Section */}
      <div className="space-y-10">
        <CategorySection
          title="Trending Movies"
          subtitle="What everyone's watching this week"
          type="movie"
          category="trending"
        />
        <CategorySection
          title="Trending TV Shows"
          subtitle="The hottest series right now"
          type="tv"
          category="trending"
        />
      </div>

      {/* Popular Section */}
      <div className="space-y-10">
        <CategorySection
          title="Popular Movies"
          subtitle="Fan favorites and crowd pleasers"
          type="movie"
          category="popular"
          defer
        />
        <CategorySection
          title="Popular TV Shows"
          subtitle="Binge-worthy series everyone loves"
          type="tv"
          category="popular"
          defer
        />
      </div>

      {/* Top Rated Section */}
      <div className="space-y-10">
        <CategorySection
          title="Top Rated Movies"
          subtitle="Critically acclaimed masterpieces"
          type="movie"
          category="top_rated"
          defer
        />
        <CategorySection
          title="Top Rated TV Shows"
          subtitle="The best of television"
          type="tv"
          category="top_rated"
          defer
        />
      </div>

      {/* Now Playing / Airing Section */}
      <div className="space-y-10">
        <CategorySection
          title="Now Playing"
          subtitle="Currently in theaters"
          type="movie"
          category="now_playing"
          defer
        />
        <CategorySection
          title="Airing Today"
          subtitle="New episodes available now"
          type="tv"
          category="airing_today"
          defer
        />
      </div>
    </div>
  );
}
