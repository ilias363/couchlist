"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Film,
  Home,
  Menu,
  Search,
  Settings,
  TrendingUp,
  Tv,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useEffect, useState } from "react";
import { MobileMenu } from "./mobile-menu";
import { HeaderShell } from "./header-shell";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

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

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <HeaderShell>
        <Logo href="/home" size="sm" />

        {/* Desktop Navigation */}
        <nav
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-0.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium",
                  "transition-colors duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
                  "hover:text-primary",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Active pill background */}
                {isActive && (
                  <span className="absolute inset-0 rounded-lg bg-primary/10 dark:bg-primary/15" />
                )}
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "relative h-4 w-4 transition-colors duration-300",
                    isActive && "text-primary",
                  )}
                />
                <span className="relative">{item.label}</span>
                {/* Active bottom line */}
                <span
                  className={cn(
                    "absolute -bottom-2.25 left-1/2 h-0.5 -translate-x-1/2 rounded-full transition-all duration-400 ease-out",
                    isActive ? "w-5 bg-primary" : "w-0 bg-transparent",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-11 md:hidden"
          >
            <Link
              href="/search"
              aria-current={pathname === "/search" ? "page" : undefined}
            >
              <Search aria-hidden="true" />
              <span className="sr-only">Search movies and TV series</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              "hidden md:inline-flex size-9 rounded-lg hover:cursor-pointer transition-colors duration-300",
              "hover:bg-primary/10 hover:text-primary",
              pathname === "/settings" && "bg-primary/10 text-primary",
            )}
          >
            <Link
              href="/settings"
              aria-current={pathname === "/settings" ? "page" : undefined}
            >
              <Settings
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 transition-transform duration-500",
                  pathname === "/settings" && "rotate-90",
                )}
              />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>
          <ThemeToggle />
          <UserMenu />

          {/* Mobile Menu Button */}
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "md:hidden size-10 rounded-lg transition-colors duration-300",
                "hover:bg-primary/10 hover:text-primary",
                mobileMenuOpen && "bg-primary/10 text-primary",
              )}
            >
              <Menu className="size-5" aria-hidden="true" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
        </div>
      </HeaderShell>

      <MobileMenu navItems={navItems} />
    </Sheet>
  );
}
