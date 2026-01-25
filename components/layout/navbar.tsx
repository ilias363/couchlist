"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Film, Home, Menu, Search, Settings, TrendingUp, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { MobileMenu } from "./mobile-menu";

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/tv-series", label: "TV Series", icon: Tv },
  { href: "/stats", label: "Stats", icon: TrendingUp },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-2xl supports-backdrop-filter:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <Link href="/home" className="flex items-center gap-2.5 font-bold text-xl group">
            <Image
              src="/logo.png"
              alt="CouchList"
              width={32}
              height={32}
              className="w-8 h-8 drop-shadow-lg group-hover:scale-110 transition-transform duration-300"
            />
            <span className="hidden sm:inline-block tracking-tight">CouchList</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-primary/10 hover:text-primary",
                    isActive && "bg-primary/10 text-primary shadow-sm",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-transform duration-300",
                      isActive && "scale-110",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <Link href="/settings" className="hidden md:flex">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "hover:cursor-pointer hover:bg-primary/10 hover:text-primary transition-all duration-300",
                  pathname === "/settings" && "bg-primary/10 text-primary",
                )}
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
              </Button>
            </Link>
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden hover:bg-primary/10 hover:text-primary transition-all duration-300"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navItems={navItems}
      />
    </>
  );
}
