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
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { MobileMenu } from "./mobile-menu";
import { HeaderShell } from "./header-shell";
import { Logo } from "./logo";

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

  const closeMobile = () => setMobileMenuOpen(false);
  const openMobile = () => setMobileMenuOpen(true);

  return (
    <>
      <HeaderShell>
        <Logo href="/home" size="sm" />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium",
                  "transition-all duration-300 ease-out",
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
                    isActive
                      ? "w-5 bg-primary"
                      : "w-0 bg-transparent",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-1.5">
          <Link href="/settings" className="hidden md:flex">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg hover:cursor-pointer transition-all duration-300",
                "hover:bg-primary/10 hover:text-primary",
                pathname === "/settings" &&
                  "bg-primary/10 text-primary",
              )}
            >
              <Settings
                className={cn(
                  "h-4 w-4 transition-transform duration-500",
                  pathname === "/settings" && "rotate-90",
                )}
              />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "md:hidden h-9 w-9 rounded-lg transition-all duration-300",
              "hover:bg-primary/10 hover:text-primary",
              mobileMenuOpen && "bg-primary/10 text-primary",
            )}
            onClick={openMobile}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </div>
      </HeaderShell>

      {/* Mobile Menu — always mounted, CSS-driven visibility */}
      <MobileMenu
        open={mobileMenuOpen}
        onClose={closeMobile}
        navItems={navItems}
      />
    </>
  );
}
