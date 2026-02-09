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
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Cinematic background effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Primary spotlight */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-300 h-200 bg-gradient-radial from-primary/15 via-primary/5 to-transparent rounded-full blur-3xl opacity-60" />
        {/* Secondary accent glow */}
        <div className="absolute bottom-[-10%] right-[-10%] w-150 h-150 bg-gradient-radial from-primary/10 to-transparent rounded-full blur-3xl" />
        {/* Ambient left glow */}
        <div className="absolute top-1/2 left-[-10%] w-100 h-200 bg-gradient-radial from-primary/8 to-transparent rounded-full blur-3xl opacity-40" />
        {/* Film grain texture overlay */}
        <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/30 bg-background/80 backdrop-blur-2xl supports-backdrop-filter:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2.5 font-bold text-xl group">
            <Image
              src="/logo.png"
              alt="CouchList"
              width={32}
              height={32}
              className="w-8 h-8 drop-shadow-md group-hover:scale-110 transition-transform duration-300"
            />
            <span className="tracking-tight font-display">CouchList</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <ThemeToggle />
            <SignInButton mode="modal">
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex hover:bg-primary/10 hover:text-primary transition-colors"
              >
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm" className="transition-all duration-300">
                Get Started
              </Button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-28 relative">
        <div className="max-w-4xl mx-auto text-center space-y-8 sm:space-y-10">
          {/* Floating badge */}
          <div
            className="inline-flex items-center gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full glass-card text-xs sm:text-sm text-primary font-medium animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            <Sparkles className="h-4 w-4 sm:h-4.5 sm:w-4.5 animate-pulse" />
            <span>Your personal entertainment companion</span>
          </div>

          {/* Main heading with display font */}
          <h1
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] animate-fade-up text-shadow"
            style={{ animationDelay: "0.2s" }}
          >
            Track Everything
            <br />
            <span className="gradient-text">You Watch</span>
          </h1>

          <p
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2 animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            Never lose track of your favorite movies and TV shows. Build your personal library,
            track your progress, and discover what to watch next.
          </p>

          {/* CTA buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 sm:gap-5 justify-center items-center pt-4 sm:pt-6 animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            <SignUpButton mode="modal">
              <Button
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base px-8 sm:px-10 py-6 sm:py-7 gap-2.5 rounded-xl shadow-2xl shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-300 font-semibold"
              >
                <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
                Start Tracking Free
              </Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base px-8 sm:px-10 py-6 sm:py-7 rounded-xl border-2 hover:bg-primary/5 hover:border-primary/40 transition-all duration-300 font-medium"
              >
                Sign In to Your Account
              </Button>
            </SignInButton>
          </div>

          {/* Quick stats with refined styling */}
          <div
            className="flex flex-row flex-wrap justify-center gap-6 sm:gap-10 pt-8 sm:pt-12 text-sm text-muted-foreground animate-fade-up"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="flex items-center justify-center gap-2.5 group">
              <div className="p-1 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <CheckCircle2 className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary" />
              </div>
              <span className="font-medium">Free forever</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 group">
              <div className="p-1 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <CheckCircle2 className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary" />
              </div>
              <span className="font-medium">No ads</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 group">
              <div className="p-1 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <CheckCircle2 className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary" />
              </div>
              <span className="font-medium">Sync across devices</span>
            </div>
          </div>
        </div>
      </section>

      {/* Decorative film strip divider */}
      <div className="film-strip w-full opacity-30" />

      {/* Features Section */}
      <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 relative">
        {/* Section spotlight */}
        <div className="absolute inset-0 -z-10 spotlight opacity-50" />

        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tighter mb-4 sm:mb-5">
            Everything you need to
            <br />
            <span className="gradient-text">manage your watchlist</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto px-2">
            Powerful features designed to make tracking your entertainment effortless and enjoyable.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 max-w-6xl mx-auto">
          <FeatureCard
            icon={Film}
            title="Movie Tracking"
            description="Keep a complete record of movies you've watched, want to watch, or dropped. Rate and organize your collection."
            delay={0.1}
          />
          <FeatureCard
            icon={Tv}
            title="TV Series Progress"
            description="Track episodes and seasons with precision. Never forget where you left off in any series."
            delay={0.2}
          />
          <FeatureCard
            icon={Search}
            title="Smart Discovery"
            description="Search millions of movies and TV shows powered by TMDB. Find your next favorite easily."
            delay={0.3}
          />
          <FeatureCard
            icon={BarChart3}
            title="Viewing Analytics"
            description="Get beautiful insights into your viewing habits with detailed statistics and charts."
            delay={0.4}
          />
          <FeatureCard
            icon={Clock}
            title="Watch Time Tracking"
            description="See how much time you've invested in your entertainment. Track minutes, hours, and days."
            delay={0.5}
          />
          <FeatureCard
            icon={Sparkles}
            title="Personalized Experience"
            description="Your data, your way. Export backups, import from other services, and stay in control."
            delay={0.6}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto text-center glass-card rounded-2xl sm:rounded-3xl p-8 sm:p-12 md:p-16 relative overflow-hidden border-gradient">
          {/* Background glow */}
          <div className="absolute inset-0 -z-10 bg-gradient-radial from-primary/10 via-transparent to-transparent opacity-60" />

          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tighter mb-4 sm:mb-5">
            Ready to start tracking?
          </h2>
          <p className="text-muted-foreground text-sm sm:text-lg mb-8 sm:mb-10 max-w-xl mx-auto">
            Join CouchList today and take control of your entertainment journey. It only takes a few
            seconds to get started.
          </p>
          <SignUpButton mode="modal">
            <Button
              size="lg"
              className="w-full sm:w-auto text-sm sm:text-base px-8 sm:px-10 py-6 sm:py-7 gap-2.5 rounded-xl shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] transition-all duration-300 font-semibold"
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
  delay?: number;
}

function FeatureCard({ icon: Icon, title, description, delay = 0 }: FeatureCardProps) {
  return (
    <div
      className="group relative p-6 sm:p-8 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-500 animate-fade-up hover-lift"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/5 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-500" />

      <div className="relative space-y-4 sm:space-y-5">
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <h3 className="text-lg sm:text-xl font-semibold tracking-tight">{title}</h3>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
