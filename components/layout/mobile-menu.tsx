"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Settings, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

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

  // Close menu on route change
  useEffect(() => {
    onClose();
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Menu Content */}
      <div className="fixed inset-x-0 top-0 bg-background/95 backdrop-blur-2xl border-b border-border/40 shadow-2xl animate-in slide-in-from-top-5 duration-300">
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <span className="font-bold text-lg tracking-tight">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-primary/10 hover:text-primary"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>

        <nav className="flex flex-col p-4 gap-1.5">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-all duration-300 hover:bg-primary/10 hover:text-primary",
                  isActive && "bg-primary/10 text-primary",
                  "animate-fade-up",
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-300",
                    isActive && "scale-110",
                  )}
                />
                {item.label}
              </Link>
            );
          })}

          <div className="my-3 h-px bg-border/50" />

          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-all duration-300 hover:bg-primary/10 hover:text-primary animate-fade-up",
              pathname === "/settings" && "bg-primary/10 text-primary",
            )}
            style={{ animationDelay: `${navItems.length * 0.05}s` }}
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </nav>
      </div>
    </div>
  );
}
