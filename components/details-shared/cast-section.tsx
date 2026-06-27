import { ProfileImage } from "@/components/media/tmdb-image";
import type { CastMember } from "@/lib/tmdb/types";

interface CastSectionProps {
  cast: CastMember[] | undefined;
  title?: string;
  limit?: number;
}

export function CastSection({
  cast,
  title = "Top Cast",
  limit = 20,
}: CastSectionProps) {
  const people = (cast ?? []).slice(0, limit);
  if (people.length === 0) return null;

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-linear-to-l from-primary/50 to-transparent" />
        <h2 className="font-display text-2xl tracking-tight shrink-0">
          {title}
        </h2>
        <div className="h-px flex-1 bg-linear-to-r from-primary/50 to-transparent" />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40 -mx-2 px-2">
        {people.map(person => (
          <div
            key={person.credit_id}
            className="w-28 sm:w-32 shrink-0 snap-start overflow-hidden rounded-xl border border-border/50 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10"
          >
            <ProfileImage
              src={person.profile_path}
              alt={person.name}
              size="w185"
              rounded={false}
              hoverZoom
            />
            <div className="p-2.5">
              <p className="line-clamp-2 min-h-8 text-xs font-semibold leading-tight tracking-tight">
                {person.name}
              </p>
              {person.character && (
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {person.character}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
