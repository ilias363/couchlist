"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Settings, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
}

export function MobileMenu({ open, onClose, navItems }: MobileMenuProps) {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close menu on route change (only when path actually changes)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Trap focus & handle Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 md:hidden",
        // Always in DOM, toggle pointer-events & visibility via CSS
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Backdrop — opacity transition only, no blur to avoid GPU stalls */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />

      {/* Slide-in panel from the right */}
      <div
        ref={panelRef}
        className={cn(
          "absolute inset-y-0 right-0 w-[min(80vw,320px)] flex flex-col",
          "bg-background/95 backdrop-blur-xl border-l border-border/40",
          "shadow-[-4px_0_20px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_30px_rgba(0,0,0,0.3)]",
          // GPU-composited slide transition
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <span className="font-display text-lg tracking-tight text-foreground">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors duration-200"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col px-3 py-3 gap-0.5 overflow-y-auto overscroll-contain">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-medium",
                  "transition-colors duration-200",
                  "active:scale-[0.98] active:transition-transform",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                {/* Active left accent */}
                {isActive && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 w-0.75 h-5 rounded-full bg-primary" />
                )}
                <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                {item.label}
              </Link>
            );
          })}

          <div className="my-2 mx-3 h-px bg-border/80" />

          <Link
            href="/settings"
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-[15px] font-medium",
              "transition-colors duration-200",
              "active:scale-[0.98] active:transition-transform",
              pathname === "/settings"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            {pathname === "/settings" && (
              <span className="absolute left-1 top-1/2 -translate-y-1/2 w-0.75 h-5 rounded-full bg-primary" />
            )}
            <Settings
              className={cn("h-5 w-5 shrink-0", pathname === "/settings" && "text-primary")}
            />
            Settings
          </Link>
        </nav>

        {/* Bottom ambient line */}
        <div className="h-px mx-4 bg-linear-to-r from-transparent via-border/40 to-transparent" />
        <div className="px-5 py-4 text-xs text-muted-foreground/60 text-center">CouchList</div>
      </div>
    </div>
  );
}
