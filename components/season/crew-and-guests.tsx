import { Stars, Users } from "lucide-react";
import { ProfileImage } from "../tmdb-image";
import { TMDBSeason } from "@/lib/tmdb/types";

export function CrewAndGuests({ season }: { season: TMDBSeason }) {
  const crewMap = new Map<
    number,
    { id: number; name: string; job: string; profile_path: string | null }
  >();
  const guestMap = new Map<
    number,
    { id: number; name: string; character: string; profile_path: string | null }
  >();
  for (const ep of season.episodes) {
    for (const c of ep.crew) {
      if (!crewMap.has(c.id))
        crewMap.set(c.id, { id: c.id, name: c.name, job: c.job, profile_path: c.profile_path });
    }
    for (const g of ep.guest_stars) {
      if (!guestMap.has(g.id))
        guestMap.set(g.id, {
          id: g.id,
          name: g.name,
          character: g.character,
          profile_path: g.profile_path,
        });
    }
  }
  const crew = Array.from(crewMap.values()).slice(0, 24);
  const guests = Array.from(guestMap.values()).slice(0, 24);
  if (!crew.length && !guests.length) return null;
  return (
    <div className="space-y-8">
      {crew.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Crew
          </h3>
          <PeopleGrid people={crew} secondaryKey="job" />
        </div>
      )}
      {guests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Stars className="h-4 w-4" /> Guest Stars
          </h3>
          <PeopleGrid people={guests} secondaryKey="character" />
        </div>
      )}
    </div>
  );
}

function PeopleGrid({
  people,
  secondaryKey,
}: {
  people: Array<{
    id: number;
    name: string;
    profile_path: string | null;
    job?: string;
    character?: string;
  }>;
  secondaryKey: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {people.map(p => (
        <div
          key={p.id}
          className="flex gap-3 rounded-md border p-2 bg-card/50 hover:bg-card transition"
        >
          <div className="w-12 rounded overflow-hidden bg-muted flex items-center justify-center">
            <ProfileImage src={p.profile_path} alt={p.name} className="w-full" rounded={false} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{p.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {p[secondaryKey as keyof typeof p] || "—"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
