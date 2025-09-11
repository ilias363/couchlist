import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserButton } from "@clerk/nextjs";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="md:hidden flex h-14 items-center gap-2 border-b px-2 sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-20">
          <SidebarTrigger />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">CouchList</span>
            <span className="text-xs text-muted-foreground">Track your Movies & TV Shows</span>
          </div>
          <div className="ml-auto">
            <UserButton />
          </div>
        </div>
        <div className="p-2 md:p-4 space-y-4 md:space-y-6 mx-auto w-full overflow-x-hidden">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
