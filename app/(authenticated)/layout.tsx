import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { UserStatusProvider } from "@/components/providers/user-status-provider";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserStatusProvider>
      <div className="min-h-screen flex flex-col relative">
        {/* Subtle ambient background */}
        <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[32rem] h-[32rem] bg-gradient-radial from-primary/5 to-transparent rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[24rem] h-[24rem] bg-gradient-radial from-primary/8 to-transparent rounded-full blur-3xl opacity-30" />
        </div>

        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
        <Footer />
      </div>
    </UserStatusProvider>
  );
}
