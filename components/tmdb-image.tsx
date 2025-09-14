"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Film, Tv, ImageIcon } from "lucide-react";
import { BackdropSize, LogoSize, PosterSize, ProfileSize, StillSize } from "@/lib/tmdb/types";
import { getTMDBImgUrl } from "@/lib/tmdb/utils";

interface BaseProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
  hoverZoom?: boolean;
  aspect?: string;
  size: string;
  fallback?: React.ReactNode;
  sizesAttr?: string;
  overlay?: React.ReactNode;
}

function BaseTMDBImage({
  src,
  alt,
  className,
  priority,
  hoverZoom,
  aspect,
  size,
  fallback,
  sizesAttr,
  overlay,
}: BaseProps) {
  const [errored, setErrored] = useState(false);
  const url = getTMDBImgUrl(src, size);
  if (!url || errored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground overflow-hidden rounded-md",
          aspect,
          className
        )}
      >
        {fallback || <ImageIcon className="h-6 w-6 opacity-60" />}
      </div>
    );
  }
  return (
    <div
      className={cn("relative overflow-hidden rounded-md", aspect, hoverZoom && "group", className)}
    >
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizesAttr}
        className={cn(
          "object-cover",
          hoverZoom && "transition-transform duration-300 group-hover:scale-105"
        )}
        onError={() => setErrored(true)}
        priority={priority}
      />
      {overlay}
    </div>
  );
}

export interface PosterImageProps
  extends Omit<BaseProps, "size" | "aspect" | "fallback" | "sizesAttr"> {
  size?: PosterSize;
  fallbackType?: "movie" | "tv";
}
export function PosterImage({ size = "w500", fallbackType = "movie", ...rest }: PosterImageProps) {
  return (
    <BaseTMDBImage
      {...rest}
      size={size}
      aspect="aspect-[2/3]"
      fallback={
        fallbackType === "movie" ? <Film className="h-8 w-8" /> : <Tv className="h-8 w-8" />
      }
      sizesAttr="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
    />
  );
}

export interface BackdropImageProps
  extends Omit<BaseProps, "size" | "aspect" | "fallback" | "sizesAttr" | "overlay"> {
  size?: BackdropSize;
  gradient?: "none" | "top" | "bottom" | "both";
}
export function BackdropImage({ size = "w1280", gradient = "none", ...rest }: BackdropImageProps) {
  const overlay =
    gradient === "none" ? undefined : (
      <>
        {(gradient === "top" || gradient === "both") && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background/40" />
        )}
        {(gradient === "bottom" || gradient === "both") && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
        )}
      </>
    );
  return (
    <BaseTMDBImage
      {...rest}
      size={size}
      aspect="aspect-[16/9]"
      sizesAttr="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      overlay={overlay}
    />
  );
}

export interface StillImageProps
  extends Omit<BaseProps, "size" | "aspect" | "fallback" | "sizesAttr"> {
  size?: StillSize;
}
export function StillImage({ size = "w300", ...rest }: StillImageProps) {
  return (
    <BaseTMDBImage
      {...rest}
      size={size}
      aspect="aspect-[16/9]"
      sizesAttr="(max-width: 768px) 100vw, 50vw"
    />
  );
}

export interface LogoImageProps
  extends Omit<BaseProps, "size" | "aspect" | "fallback" | "sizesAttr"> {
  size?: LogoSize;
  transparentBg?: boolean;
}
export function LogoImage({
  size = "w185",
  transparentBg = true,
  className,
  ...rest
}: LogoImageProps) {
  return (
    <BaseTMDBImage
      {...rest}
      size={size}
      aspect="aspect-[4/1]"
      className={cn(
        "flex items-center justify-center p-2",
        transparentBg ? "bg-transparent" : "bg-muted",
        className
      )}
      sizesAttr="(max-width: 768px) 40vw, 20vw"
    />
  );
}

export interface ProfileImageProps
  extends Omit<BaseProps, "size" | "aspect" | "fallback" | "sizesAttr"> {
  size?: ProfileSize;
  rounded?: boolean;
}
export function ProfileImage({
  size = "w185",
  rounded = true,
  className,
  ...rest
}: ProfileImageProps) {
  return (
    <BaseTMDBImage
      {...rest}
      size={size}
      aspect="aspect-[2/3]"
      className={cn(rounded && "rounded-xl", className)}
      sizesAttr="(max-width: 768px) 33vw, 15vw"
    />
  );
}
