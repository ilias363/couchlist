import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ withAuth: vi.fn(), fetch: vi.fn() }));
vi.mock("@workos-inc/authkit-nextjs", () => ({ withAuth: mocks.withAuth }));
vi.mock("server-only", () => ({}));

import { GET } from "./route";
import { tmdbClient } from "@/lib/tmdb/client-api";
import { tmdbServerClient } from "@/lib/tmdb/server-api";

const request = (endpoint: string) => new NextRequest(`http://localhost/api/tmdb${endpoint}`);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TMDB_API_KEY", "server-secret");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.withAuth.mockResolvedValue({ user: { id: "owner" } });
  mocks.fetch.mockImplementation(async () => Response.json({ results: [], id: 42 }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("authentication is required before any upstream request", async () => {
  mocks.withAuth.mockResolvedValue({ user: null });
  const response = await GET(request("/movie/42"));
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.fetch).not.toHaveBeenCalled();
});

test.each([
  "/account", "/authentication/token/new", "/movie/42/account_states",
  "//attacker.example/movie/42", "/movie/%2F42", "/movie/0", "/tv/NaN", "/tv/42/season/-1",
  "/movie/42?api_key=attacker", "/movie/42?access_token=attacker",
  "/movie/42?append_to_response=account_states", "/movie/42?language=en",
  "/movie/popular?page=0", "/movie/popular?page=501", "/movie/popular?page=1.5",
  "/movie/popular?page=1&page=2", "/search/movie", "/search/movie?query=%20",
  "/search/movie?query=one&query=two", `/search/movie?query=${"x".repeat(501)}`,
])("rejects unsupported paths and parameters: %s", async endpoint => {
  expect((await GET(request(endpoint))).status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

test("every existing client operation works through the proxy without browser credentials", async () => {
  const controller = new AbortController();
  const operations = [
    () => tmdbClient.searchMovies("A & B?", 2, controller.signal),
    () => tmdbClient.searchTVSeries("series"),
    () => tmdbClient.searchMulti("both"),
    () => tmdbClient.getMovieDetails(42),
    () => tmdbClient.getExtendedMovieDetails(42),
    () => tmdbClient.getTVSeriesDetails(42),
    () => tmdbClient.getExtendedTVSeriesDetails(42),
    () => tmdbClient.getSeasonDetails(42, 0),
    () => tmdbClient.getSeasonDetails(42, 1),
    () => tmdbClient.getTrendingMovies(),
    () => tmdbClient.getTrendingTv(),
    () => tmdbClient.getPopularMovies(),
    () => tmdbClient.getPopularTv(),
    () => tmdbClient.getTopRatedMovies(),
    () => tmdbClient.getTopRatedTv(),
    () => tmdbClient.getNowPlayingMovies(),
    () => tmdbClient.getAiringTodayTv(),
  ];
  for (const operation of operations) {
    mocks.fetch.mockClear();
    await operation();
    const [browserUrl, browserOptions] = mocks.fetch.mock.calls[0];
    expect(browserUrl.startsWith("/api/tmdb/")).toBe(true);
    expect(browserUrl).not.toContain("api_key");
    expect(browserUrl).not.toContain("server-secret");
    if (browserUrl.includes("A%20%26%20B")) expect(browserOptions.signal).toBe(controller.signal);

    const response = await GET(new NextRequest(`http://localhost${browserUrl}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ results: [], id: 42 });
    const [upstreamUrl, upstreamOptions] = mocks.fetch.mock.calls[1];
    expect(upstreamUrl.origin).toBe("https://api.themoviedb.org");
    expect(upstreamUrl.pathname).toBe(`/3${new URL(browserUrl, "http://localhost").pathname.slice("/api/tmdb".length)}`);
    expect(upstreamUrl.searchParams.get("api_key")).toBe("server-secret");
    expect(upstreamUrl.searchParams.getAll("api_key")).toHaveLength(1);
    expect(upstreamOptions.redirect).toBe("error");
    expect(upstreamOptions.next).toEqual({ revalidate: 300 });
    if (browserUrl.includes("A%20%26%20B")) expect(upstreamUrl.searchParams.get("query")).toBe("A & B?");
  }
});

test("metadata uses the server transport directly", async () => {
  await tmdbServerClient.getMovieDetails(42);
  await tmdbServerClient.getTVSeriesDetails(42);
  expect(mocks.fetch.mock.calls.map(([url]) => url.pathname)).toEqual(["/3/movie/42", "/3/tv/42"]);
  expect(mocks.withAuth).not.toHaveBeenCalled();
});

test("missing configuration and upstream failures never expose credentials", async () => {
  vi.stubEnv("TMDB_API_KEY", "");
  expect((await GET(request("/movie/42"))).status).toBe(503);
  expect(mocks.fetch).not.toHaveBeenCalled();
  await expect(tmdbServerClient.getMovieDetails(42)).rejects.toThrow("TMDB_API_KEY is not configured");

  vi.stubEnv("TMDB_API_KEY", "server-secret");
  for (const status of [401, 404, 429, 500]) {
    mocks.fetch.mockResolvedValueOnce(new Response("server-secret", {
      status, headers: { location: "https://example.com?api_key=server-secret" },
    }));
    const response = await GET(request("/movie/42"));
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("server-secret");
    expect(response.headers.get("location")).toBeNull();
  }
  mocks.fetch.mockRejectedValueOnce(new Error("Failed to fetch ?api_key=server-secret"));
  const unavailable = await GET(request("/movie/42"));
  expect(unavailable.status).toBe(502);
  expect(await unavailable.text()).not.toContain("server-secret");
});
