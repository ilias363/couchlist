"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { Unauthenticated } from "convex/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Film, Tv, BarChart3, Search } from "lucide-react";

export default function Welcome() {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      redirect("/home");
    }
  }, [isSignedIn]);

  return (
    <Unauthenticated>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <header className="flex items-center justify-between p-6">
          <div className="flex items-center gap-2">
            <Film className="size-8 text-primary" />
            <h1 className="text-2xl font-bold">CouchList</h1>
          </div>
          <ThemeToggle />
        </header>

        <main className="container mx-auto px-6 py-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Track Your Entertainment
              <span className="block text-primary mt-2">Never Miss a Beat</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Keep track of your favorite movies and TV shows, discover new content, and analyze
              your viewing habits all in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <SignUpButton mode="modal">
                <Button size="lg" className="text-md px-6 py-4 hover:cursor-pointer">
                  Get Started Free
                </Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-md px-6 py-4 hover:cursor-pointer"
                >
                  Sign In
                </Button>
              </SignInButton>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Film className="size-6 text-primary" />
                  </div>
                  <CardTitle>Movie Tracking</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Keep track of movies you&apos;ve watched and want to watch, and build your
                  personal collection.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Tv className="size-6 text-primary" />
                  </div>
                  <CardTitle>TV Series Management</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Track your progress through TV series, mark episodes as watched, and never lose
                  your place again.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Search className="size-6 text-primary" />
                  </div>
                  <CardTitle>Smart Discovery</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Discover new movies and shows based on your preferences and what&apos;s trending
                  in the community.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="size-6 text-primary" />
                  </div>
                  <CardTitle>Viewing Analytics</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Get insights into your viewing habits, see statistics, and track your
                  entertainment journey.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </main>

        <footer className="border-t py-6">
          <div className="container mx-auto px-6 text-center text-muted-foreground">
            Movie and TV show data provided by{" "}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              The Movie Database API (TMDB)
            </a>
          </div>
        </footer>
      </div>
    </Unauthenticated>
  );
}
