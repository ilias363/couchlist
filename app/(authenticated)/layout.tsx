import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-6">{children}</main>
      <Footer />
    </div>
  );
}
