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
    const movie = await tmdbClient.getMovieDetails(Number(tmdbId));
    const year = movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : "";
    const title = `${movie.title}${year}`;
    const description = movie.overview || `Track ${movie.title} on CouchList.`;
    const image = getTMDBImgUrl(movie.backdrop_path ?? movie.poster_path, "w780");
    return {
      title,
      description,
      openGraph: {
        title: `${title} · CouchList`,
        description,
        images: image ? [{ url: image }] : undefined,
        type: "video.movie",
      },
    };
  } catch {
    return { title: "Movie" };
  }
}

export default function MovieDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
