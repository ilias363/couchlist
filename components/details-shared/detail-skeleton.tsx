import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder that mirrors the real detail-page layout (hero with
 * poster + info, details grid, and a horizontal people/recommendation row)
 * so there's no layout shift when the content resolves.
 */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/60 to-muted/40" />
        <div className="px-4 pt-28 pb-10 sm:pt-52">
          <div className="flex flex-col gap-8 sm:flex-row sm:gap-10">
            <div className="shrink-0 mx-auto sm:mx-0">
              <Skeleton className="aspect-2/3 w-48 rounded-2xl sm:w-72" />
            </div>
            <div className="flex-1 space-y-5">
              <Skeleton className="mx-auto h-10 w-3/4 sm:mx-0 sm:h-12" />
              <Skeleton className="mx-auto h-5 w-1/2 sm:mx-0" />
              <div className="flex flex-wrap justify-center gap-2.5 sm:justify-start">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-20 rounded-lg" />
                ))}
              </div>
              <Skeleton className="mx-auto h-4 w-44 sm:mx-0" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2 sm:justify-start">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-28 rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Details grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>

      {/* People / recommendation row */}
      <div className="space-y-5">
        <Skeleton className="mx-auto h-7 w-40" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-52 w-28 shrink-0 rounded-xl sm:w-32"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
