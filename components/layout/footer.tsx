"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t py-6 mt-auto">
      <div className="container px-4 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Image
            src="/logo.png"
            alt="CouchList"
            width={24}
            height={24}
            className="w-6 h-6 opacity-60"
          />
          <span>&copy; {new Date().getFullYear()} CouchList</span>
        </div>
        <p className="flex items-center gap-1">
          Movie and TV show data by{" "}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            TMDB
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
    </footer>
  );
}
