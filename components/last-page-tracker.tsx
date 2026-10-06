"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { syncLastPage } from "@/lib/last-page";

export function LastPageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const userId = user?.id;
  const query = searchParams.toString();

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      // Reload through the auth proxy if the client auth check failed.
      if (pathname === "/launch") window.location.replace("/home");
      return;
    }

    const path = pathname + (query ? `?${query}` : "");
    const destination = syncLastPage(path, userId);
    if (destination) router.replace(destination);
  }, [pathname, query, router, userId, loading]);

  return null;
}
