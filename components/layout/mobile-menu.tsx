"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function MobileMenu({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();

  return (
    <SheetContent
      aria-modal="true"
      className="w-[min(85vw,20rem)] gap-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <SheetHeader className="border-b border-border/30 px-5 py-5 pr-16">
        <SheetTitle>Menu</SheetTitle>
        <SheetDescription className="sr-only">
          Navigate your watchlist, discover titles, and manage your account.
        </SheetDescription>
      </SheetHeader>

      <nav
        aria-label="Mobile navigation"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {[
          ...navItems,
          { href: "/settings", label: "Settings", icon: Settings },
        ].map(item => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <SheetClose key={item.href} asChild>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  item.href === "/settings" && "mt-2 border-t border-border/50",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </SheetClose>
          );
        })}
      </nav>

      <div className="mx-4 border-t border-border/40 px-5 py-4 text-center text-xs text-muted-foreground">
        CouchList
      </div>
    </SheetContent>
  );
}
