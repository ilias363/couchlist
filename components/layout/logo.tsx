"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  showText?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function Logo({
  href,
  showText = true,
  className,
  size = "md",
}: LogoProps) {
  const imageSize = size === "sm" ? "w-7 h-7 sm:w-8 sm:h-8" : "w-8 h-8";

  const content = (
    <>
      <Image
        src="/logo.png"
        alt="CouchList"
        width={32}
        height={32}
        className={cn(
          imageSize,
          "drop-shadow-md group-hover:scale-110 transition-transform duration-300 shrink-0"
        )}
      />
      {showText && (
        <span
          className={cn(
            "tracking-tight font-display transition-all duration-500",
            "bg-clip-text bg-linear-to-r from-foreground to-foreground group-hover:from-primary group-hover:to-primary/70"
          )}
        >
          CouchList
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2.5 font-bold text-xl group",
          className
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 font-bold text-xl group",
        className
      )}
    >
      {content}
    </div>
  );
}
