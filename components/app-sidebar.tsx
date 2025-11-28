"use client";

import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Home,
  Search,
  Clapperboard,
  Tv,
  BarChart3,
  LucideIcon,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "./theme/theme-toggle";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import Image from "next/image";

const NAV_ITEMS: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Search", href: "/search", icon: Search },
  { label: "Movies", href: "/movies", icon: Clapperboard },
  { label: "TV Series", href: "/tv-series", icon: Tv },
  { label: "Statistics", href: "/stats", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  const displayName =
    user?.username ||
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Account";

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Image src="/logo.png" alt="CouchList Logo" width={64} height={64} className="w-6.5 h-6.5" />
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">CouchList</span>
            <span className="text-xs text-muted-foreground">Track your Movies & TV Shows</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {NAV_ITEMS.map(item => {
            const isActive = pathname.startsWith(item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    "relative",
                    isActive && "bg-sidebar-accent/60 dark:bg-sidebar-accent/40"
                  )}
                >
                  <Link href={item.href} className="flex items-center">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 h-full w-1 rounded-r bg-primary group-data-[collapsible=icon]:hidden"
                      />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t mt-auto">
        <div className="flex items-center gap-2 rounded-md bg-muted/40 dark:bg-muted/10">
          <UserButton
            appearance={{
              elements: { userButtonAvatarBox: "size-9" },
            }}
          />
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium truncate leading-tight">{displayName}</span>
            {user?.primaryEmailAddress?.emailAddress && (
              <span className="text-xs text-muted-foreground truncate">
                {user.primaryEmailAddress.emailAddress}
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1 group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
