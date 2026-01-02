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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Menu Content */}
      <div className="fixed inset-x-0 top-0 bg-background border-b shadow-lg animate-in slide-in-from-top-5 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-bold text-lg">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>

        <nav className="flex flex-col p-4 gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

          <div className="my-2 h-px bg-border" />

          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === "/settings" && "bg-accent text-accent-foreground"
            )}
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </nav>
      </div>
    </div>
  );
}
