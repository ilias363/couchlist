import type { Metadata } from "next";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { getTMDBImgUrl } from "@/lib/tmdb/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tmdbId: string }>;
}): Promise<Metadata> {
  const { tmdbId } = await params;
  try {
    const series = await tmdbClient.getTVSeriesDetails(Number(tmdbId));
    const year = series.first_air_date ? ` (${series.first_air_date.slice(0, 4)})` : "";
    const title = `${series.name}${year}`;
    const description = series.overview || `Track ${series.name} on CouchList.`;
    const image = getTMDBImgUrl(series.backdrop_path ?? series.poster_path, "w780");
    return {
      title,
      description,
      openGraph: {
        title: `${title} · CouchList`,
        description,
        images: image ? [{ url: image }] : undefined,
        type: "video.tv_show",
      },
    };
  } catch {
    return { title: "TV Series" };
  }
}

export default function TvSeriesDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
