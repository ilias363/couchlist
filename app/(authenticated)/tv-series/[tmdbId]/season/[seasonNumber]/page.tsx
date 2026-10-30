import { redirect } from "next/navigation";

export default async function SeasonDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tmdbId: string; seasonNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ tmdbId, seasonNumber }, query] = await Promise.all([params, searchParams]);
  const nextSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach(item => nextSearchParams.append(key, item));
    else if (value !== undefined) nextSearchParams.set(key, value);
  }
  nextSearchParams.set("season", seasonNumber);
  redirect(`/tv-series/${encodeURIComponent(tmdbId)}?${nextSearchParams}#episodes`);
}
