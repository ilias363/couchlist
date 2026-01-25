"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-8 mt-auto relative overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-primary/2 to-transparent" />

      {/* Film strip decoration */}
      <div className="film-strip w-full opacity-20 absolute top-0" />

      <div className="container px-4 flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground group">
          <Image
            src="/logo.png"
            alt="CouchList"
            width={24}
            height={24}
            className="w-6 h-6 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300"
          />
          <span className="font-medium">&copy; {new Date().getFullYear()} CouchList</span>
        </div>
        <p className="flex items-center gap-1.5">
          Movie and TV show data by{" "}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors font-medium"
          >
            TMDB
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
    </footer>
  );
}
