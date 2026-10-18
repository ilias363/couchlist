import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { fetchTMDB } from "@/lib/tmdb/server-api";

const privateHeaders = { "Cache-Control": "private, no-store" };

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: privateHeaders });
}

export async function GET(request: NextRequest) {
  const { user } = await withAuth();
  if (!user) return errorResponse("You need to sign in again.", 401);

  const path = request.nextUrl.pathname.slice("/api/tmdb".length);
  const isSearch = /^\/search\/(movie|tv|multi)$/.test(path);
  const isFeed = /^\/(trending\/(movie|tv)\/week|(movie|tv)\/(popular|top_rated)|movie\/now_playing|tv\/airing_today)$/.test(path);
  const isDetails = /^\/(movie|tv)\/[1-9]\d*$/.test(path);
  const isSeason = /^\/tv\/[1-9]\d*\/season\/(0|[1-9]\d*)$/.test(path);
  if (!isSearch && !isFeed && !isDetails && !isSeason) {
    return errorResponse("Unsupported TMDB endpoint.", 400);
  }

  const params = request.nextUrl.searchParams;
  for (const [key, value] of params) {
    const valid = params.getAll(key).length === 1 && (
      (key === "page" && (isSearch || isFeed) && /^[1-9]\d*$/.test(value) && Number(value) <= 500) ||
      (key === "query" && isSearch && value.trim().length > 0 && value.length <= 500) ||
      (key === "append_to_response" && isDetails && value === "external_ids,recommendations,similar,credits")
    );
    if (!valid) return errorResponse("Invalid TMDB parameters.", 400);
  }
  if (isSearch && !params.has("query")) {
    return errorResponse("A search query is required.", 400);
  }
  if (!process.env.TMDB_API_KEY) {
    return errorResponse("TMDB is unavailable.", 503);
  }

  try {
    const response = await fetchTMDB(`${path}${request.nextUrl.search}`, request.signal);
    if (!response.ok) {
      // Never forward upstream error bodies or headers that could expose credentials.
      return errorResponse("TMDB request failed.", response.status);
    }
    return NextResponse.json(await response.json(), { headers: privateHeaders });
  } catch {
    return errorResponse("TMDB is unavailable. Please try again.", 502);
  }
}
