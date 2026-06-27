import Link from "next/link";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Cinematic ambient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 h-160 w-240 -translate-x-1/2 rounded-full bg-gradient-radial from-primary/15 via-primary/5 to-transparent blur-3xl opacity-60" />
        <div className="absolute bottom-[-10%] right-[-10%] h-120 w-120 rounded-full bg-gradient-radial from-primary/10 to-transparent blur-3xl" />
      </div>

      <Logo href="/" className="mb-10" />

      <p className="gradient-text font-display text-7xl font-bold leading-none sm:text-8xl">
        404
      </p>

      <h1 className="mt-5 text-2xl font-bold tracking-tighter sm:text-3xl">
        This scene didn&apos;t make the cut
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <Link href="/">
          <Button
            size="lg"
            className="w-full gap-2 rounded-xl font-semibold sm:w-auto"
          >
            <Home className="h-4 w-4" />
            Back home
          </Button>
        </Link>
        <Link href="/search">
          <Button
            variant="outline"
            size="lg"
            className="w-full gap-2 rounded-xl sm:w-auto hover:border-primary/40 hover:bg-primary/5"
          >
            <Search className="h-4 w-4" />
            Search titles
          </Button>
        </Link>
      </div>

      {/* Decorative film strip */}
      <div className="film-strip absolute bottom-0 left-0 w-full opacity-20" />
    </div>
  );
}
