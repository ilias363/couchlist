import { Suspense } from "react";
import Image from "next/image";
import { LastPageTracker } from "@/components/last-page-tracker";

export default function LaunchPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background">
      <div role="status">
        <Image src="/logo.png" alt="" width={96} height={96} preload unoptimized />
        <span className="sr-only">Loading CouchList</span>
      </div>
      <Suspense fallback={null}>
        <LastPageTracker />
      </Suspense>
    </main>
  );
}
