"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, Tv, BarChart3, Search } from "lucide-react";

export default function Home() {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      redirect("/dashboard");
    }
  }, [isSignedIn]);

  return (
    <>
      <Authenticated>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p>Redirecting to dashboard...</p>
          </div>
        </div>
      </Authenticated>
      <Unauthenticated>
        <div className="min-h-screen bg-gradient-to-br from-purple-700 via-blue-700 to-indigo-800">
          <div className="container mx-auto px-4 py-16">
            {/* Hero Section */}
            <div className="text-center text-white mb-16">
              <div className="flex items-center justify-center space-x-2 mb-6">
                <Film className="h-12 w-12" />
                <h1 className="text-6xl font-bold">CouchList</h1>
              </div>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Track your watched movies and TV shows, manage watch statuses, and view personal
                statistics all in one place.
              </p>
              <div className="flex flex-col items-center justify-center">
                <SignInButton>
                  <Button
                    size="lg"
                    className="bg-white text-purple-600 hover:bg-gray-100 hover:cursor-pointer"
                  >
                    Get Started - Sign In
                  </Button>
                </SignInButton>

                <SignUpButton>
                  <span className="underline text-sm text-muted-foreground hover:opacity-80 hover:cursor-pointer mt-2">
                    Already have an account? Sign Up
                  </span>
                </SignUpButton>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              <Card className="bg-white/10 border-white/20 text-white">
                <CardHeader className="text-center">
                  <Search className="h-8 w-8 mx-auto mb-2" />
                  <CardTitle className="text-lg">Search & Discovery</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-blue-100">
                    Search for movies and TV series using The Movie Database (TMDB) API.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white">
                <CardHeader className="text-center">
                  <Film className="h-8 w-8 mx-auto mb-2" />
                  <CardTitle className="text-lg">Movie Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-blue-100">
                    Track movies with statuses like Watched, Currently Watching, Want to Watch.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white">
                <CardHeader className="text-center">
                  <Tv className="h-8 w-8 mx-auto mb-2" />
                  <CardTitle className="text-lg">TV Series Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-blue-100">
                    Track individual episodes and seasons with detailed progress monitoring.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white">
                <CardHeader className="text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                  <CardTitle className="text-lg">Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-blue-100">
                    View comprehensive statistics about your watching habits and preferences.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            {/* Additional Info */}
            <div className="text-center text-blue-100">
              <p className="mb-4">
                Powered by The Movie Database (TMDB) for accurate and up-to-date content
                information.
              </p>
              <p className="text-sm">Sign in to start tracking your entertainment journey!</p>
            </div>
          </div>
        </div>
      </Unauthenticated>
    </>
  );
}
