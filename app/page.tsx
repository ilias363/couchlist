"use server";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  Film,
  Tv,
  BarChart3,
  Search,
  Sparkles,
  Play,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { Footer } from "@/components/layout/footer";

export default async function Welcome() {
  const authObject = await auth();
  if (authObject.isAuthenticated) {
    redirect("/home");
  } else {
    return <WelcomePageContent />;
  }
}

function WelcomePageContent() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background gradient effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 font-bold text-lg sm:text-xl">
            <Image
              src="/logo.png"
              alt="CouchList"
              width={32}
              height={32}
              className="w-7 h-7 sm:w-8 sm:h-8"
            />
            <span>CouchList</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Get Started</Button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-20">
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm text-primary">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Your personal entertainment companion</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            Track Everything
            <br />
            <span className="text-primary">You Watch</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2">
            Never lose track of your favorite movies and TV shows. Build your personal library,
            track your progress, and discover what to watch next.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-2 sm:pt-4">
            <SignUpButton mode="modal">
              <Button
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6 gap-2"
              >
                <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                Start Tracking Free
              </Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6"
              >
                Sign In to Your Account
              </Button>
            </SignInButton>
          </div>

          {/* Quick stats */}
          <div className="flex flex-row flex-wrap justify-center gap-3 sm:gap-8 pt-4 sm:pt-8 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span>Free forever</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span>No ads</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span>Sync across devices</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
            Everything you need to
            <br />
            <span className="text-primary">manage your watchlist</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
            Powerful features designed to make tracking your entertainment effortless and enjoyable.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
          <FeatureCard
            icon={Film}
            title="Movie Tracking"
            description="Keep a complete record of movies you've watched, want to watch, or dropped. Rate and organize your collection."
          />
          <FeatureCard
            icon={Tv}
            title="TV Series Progress"
            description="Track episodes and seasons with precision. Never forget where you left off in any series."
          />
          <FeatureCard
            icon={Search}
            title="Smart Discovery"
            description="Search millions of movies and TV shows powered by TMDB. Find your next favorite easily."
          />
          <FeatureCard
            icon={BarChart3}
            title="Viewing Analytics"
            description="Get beautiful insights into your viewing habits with detailed statistics and charts."
          />
          <FeatureCard
            icon={Clock}
            title="Watch Time Tracking"
            description="See how much time you've invested in your entertainment. Track minutes, hours, and days."
          />
          <FeatureCard
            icon={Sparkles}
            title="Personalized Experience"
            description="Your data, your way. Export backups, import from other services, and stay in control."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="max-w-4xl mx-auto text-center glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
            Ready to start tracking?
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg mb-6 sm:mb-8 max-w-xl mx-auto">
            Join CouchList today and take control of your entertainment journey. It only takes a few
            seconds to get started.
          </p>
          <SignUpButton mode="modal">
            <Button
              size="lg"
              className="w-full sm:w-auto text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6 gap-2"
            >
              Create Your Free Account
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </SignUpButton>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 rounded-xl sm:rounded-2xl transition-opacity duration-300" />
      <div className="relative space-y-3 sm:space-y-4">
        <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
