import { TMDBMovie } from "@/lib/tmdb/types";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export function MovieMetaCards({ movie }: { movie: TMDBMovie }) {
  return (
    <section className="grid gap-6 md:grid-cols-3">
      <InfoCard title="Facts">
        <div className="grid grid-cols-2">
          <ul className="text-xs space-y-1">
            <li>
              <span className="text-muted-foreground">Runtime:</span> {movie.runtime ?? "—"} min
            </li>
            <li>
              <span className="text-muted-foreground">Status:</span> {movie.status || "—"}
            </li>
            <li>
              <span className="text-muted-foreground">Popularity:</span>{" "}
              {Math.round(movie.popularity)}
            </li>
            <li>
              <span className="text-muted-foreground">Language:</span>{" "}
              {movie.original_language ? movie.original_language.toUpperCase() : "—"}
            </li>
          </ul>
          <ul className="text-xs space-y-1">
            <li>
              <span className="text-muted-foreground">Budget:</span> {formatCurrency(movie.budget)}
            </li>
            <li>
              <span className="text-muted-foreground">Revenue:</span>{" "}
              {formatCurrency(movie.revenue)}
            </li>
            <li>
              <span className="text-muted-foreground">Rating:</span> {movie.vote_average.toFixed(1)}{" "}
              / 10
            </li>
            <li>
              <span className="text-muted-foreground">Votes:</span>{" "}
              {movie.vote_count.toLocaleString()}
            </li>
          </ul>
        </div>
      </InfoCard>
      <InfoCard title="Spoken Languages">
        <p className="text-xs text-muted-foreground min-h-4">
          {movie.spoken_languages?.map(l => l.english_name).join(" • ") || "—"}
        </p>
      </InfoCard>
      <InfoCard title="Production Companies">
        <p className="text-xs text-muted-foreground">
          {movie.production_companies.map(c => c.name).join(" • ") || "—"}
        </p>
      </InfoCard>
      <InfoCard title="Production Countries" className="md:col-span-3">
        <p className="text-xs text-muted-foreground">
          {movie.production_countries?.map(c => c.name).join(" • ") || "—"}
        </p>
      </InfoCard>
      <InfoCard title="External" className="md:col-span-3">
        <div className="flex flex-wrap gap-3 text-xs">
          {movie.imdb_id && (
            <Link
              href={`https://www.imdb.com/title/${movie.imdb_id}`}
              target="_blank"
              className="underline text-primary"
              rel="noopener noreferrer"
            >
              IMDb
            </Link>
          )}
          {movie.homepage && (
            <Link
              href={movie.homepage}
              target="_blank"
              className="underline text-primary"
              rel="noopener noreferrer"
            >
              Homepage
            </Link>
          )}
        </div>
      </InfoCard>
    </section>
  );
}

function InfoCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 shadow-sm ${className || ""}`}>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
