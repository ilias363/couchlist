// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { useCatchUpData } from "./use-catch-up-data";

const state = vi.hoisted(() => ({ view: {} as ReturnType<typeof useCatchUpData>, hook: vi.fn() }));
vi.mock("./use-catch-up-data", () => ({ useCatchUpData: () => { state.hook(); return state.view; } }));
vi.mock("@workos-inc/authkit-nextjs/components", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@/components/media/tmdb-image", () => ({ PosterImage: () => null }));
vi.mock("@/components/media/media-carousel", () => ({ MediaCarousel: ({ title }: { title: string }) => <p>{title}</p> }));
import CatchUpPage from "../app/(authenticated)/tv-series/catch-up/page";
import { CatchUpSection } from "../components/home/catch-up-section";
import { CatchUpBoundary } from "../components/catch-up/catch-up-boundary";

function view(overrides: Partial<ReturnType<typeof useCatchUpData>> = {}) {
  state.view = { catchUpItems: [], isLoading: false, isComplete: false, isUpdating: false, failedShows: 0, retry: vi.fn(),
    canLoadMore: false, loadMore: vi.fn(), totalUpToDate: 25, totalNeedingAttention: 0,
    totalUnwatchedEpisodes: 0, totalUpcoming: 0, ...overrides };
  return renderToStaticMarkup(<CatchUpPage />);
}
test("loading, partial pagination and failure never announce caught up; completed cards stay visible", () => {
  expect(view({ isLoading: true })).not.toContain("all caught up");
  const page = view({ canLoadMore: true });
  expect(page).toContain("Partial totals"); expect(page).toContain("Load more shows");
  expect(page).toContain("0+"); expect(page).not.toContain("all caught up");
  const failed = view({ failedShows: 1 });
  expect(failed).toContain("Results are incomplete"); expect(failed).toContain("Retry failed checks");
  expect(failed).not.toContain("all caught up");
  expect(view({ isUpdating: true, isLoading: true })).toContain("Your library is being updated");
  const progressive = view({ isLoading: true, catchUpItems: [{
    tvSeriesId: 1, name: "Ready show", posterPath: null, tmdbStatus: "Returning Series",
    totalEpisodes: 1, watchedEpisodes: 0, unwatchedEpisodes: 1, unknownDateEpisodes: 0, unwatchedSeasons: [], upcomingSeasons: [],
  }] });
  expect(progressive).toContain("Ready show"); expect(progressive).toContain("Partial totals");
  expect(view({ isComplete: true })).toContain("all caught up");
});

test("home keeps viewport deferral and links to all checks when results are partial", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  view({ canLoadMore: true }); state.hook.mockClear();
  let activate!: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { activate = callback; }
    observe = vi.fn(); unobserve = vi.fn(); disconnect = disconnect;
  });
  const element = document.createElement("div"); document.body.append(element);
  const root = createRoot(element);
  try {
    await act(async () => root.render(<CatchUpSection />));
    expect(state.hook).not.toHaveBeenCalled();
    await act(async () => activate([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
    expect(state.hook).toHaveBeenCalled(); expect(element.textContent).toContain("View all catch-up checks");
  } finally { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); }
  expect(disconnect).toHaveBeenCalled();
});

test("a pagination failure stays local and offers a fresh retry", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  let failed = true;
  function Check() { if (failed) throw new Error("query unavailable"); return <p>Checked</p>; }
  const element = document.createElement("div"); const root = createRoot(element);
  try {
    await act(async () => root.render(<CatchUpBoundary><Check /></CatchUpBoundary>));
    expect(element.textContent).toContain("Results are incomplete");
    failed = false;
    await act(async () => element.querySelector("button")!.click());
    expect(element.textContent).toBe("Checked");
  } finally { await act(async () => root.unmount()); log.mockRestore(); }
});
