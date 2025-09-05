"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Film, Tv } from "lucide-react";
import { BackdropSize, PosterSize, StillSize } from "@/lib/tmdb/types";
import { getTMDBBackdropImgUrl, getTMDBPosterImgUrl, getTMDBStillImgUrl } from "@/lib/tmdb/utils";

interface TMDBImageProps {
  src: string | null | undefined;
  alt: string;
  type?: "poster" | "backdrop" | "still";
  posterSize?: PosterSize;
  backdropSize?: BackdropSize;
  stillSize?: StillSize;
  className?: string;
  fallbackType?: "movie" | "tv";
  priority?: boolean;
  hoverZoom?: boolean;
}

export function TMDBImage({
  src,
  alt,
  type = "poster",
  posterSize = "w500",
  backdropSize = "w1280",
  stillSize = "w300",
  className,
  fallbackType = "movie",
  priority = false,
  hoverZoom = false,
}: TMDBImageProps) {
  const [hasError, setHasError] = useState(false);

  const imageUrl =
    type === "poster"
      ? getTMDBPosterImgUrl(src, posterSize)
      : type === "backdrop"
      ? getTMDBBackdropImgUrl(src, backdropSize)
      : getTMDBStillImgUrl(src, stillSize);

  if (!imageUrl || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          type === "poster" ? "aspect-[2/3]" : "aspect-[16/9]",
          className
        )}
      >
        {fallbackType === "movie" ? <Film className="h-8 w-8" /> : <Tv className="h-8 w-8" />}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        type === "poster" ? "aspect-[2/3]" : "aspect-[16/9]",
        hoverZoom && "group",
        className
      )}
    >
      <Image
        src={imageUrl}
        alt={alt}
        fill
        sizes={
          type === "poster"
            ? "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        }
        className={cn(
          "object-cover transition-all duration-300",
          hoverZoom && "group-hover:scale-105"
        )}
        onError={() => setHasError(true)}
        priority={priority}
      />
    </div>
  );
}
