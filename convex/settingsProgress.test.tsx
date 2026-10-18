import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Doc, Id } from "./_generated/dataModel";

const state = vi.hoisted(() => ({ operation: null as Doc<"dataOperations"> | null }));
vi.mock("convex/react", () => ({
  useConvex: () => ({}), useConvexAuth: () => ({ isAuthenticated: true }), useQuery: () => state.operation, useMutation: () => vi.fn(),
}));
import SettingsPage from "../app/(authenticated)/settings/page";
function job(fields: Partial<Doc<"dataOperations">>) {
  const zero = { movies: 0, tvSeries: 0, episodes: 0 };
  state.operation = {
    _id: "job" as Id<"dataOperations">, _creationTime: 1, userId: "owner", kind: "import", mode: "replace", phase: "upload",
    expected: { ...zero, episodes: 205 }, uploaded: { ...zero, episodes: 100 }, inserted: zero, updated: zero,
    position: -1, revision: 0, processed: 0, deleted: 0, startedAt: 1, expiresAt: 2, cursor: null, ...fields,
  };
  return renderToStaticMarkup(<SettingsPage />);
}
test("preparation, running, failure, discarded and completed states have distinct feedback", () => {
  let html = job({});
  expect(html).toContain("Your library is unchanged");
  expect(html).toContain("Discard preparation");
  expect(html).not.toContain("Import complete");
  html = job({ phase: "summaries", processed: 205, error: "Please retry this batch" });
  expect(html).toContain("Please retry this batch");
  expect(html).toContain("Resume operation");
  expect(html).not.toContain("Import complete");
  html = job({ phase: "complete", cancelled: true });
  expect(html).toContain("Preparation discarded");
  expect(html).not.toContain("Import complete");
  html = job({ phase: "complete", inserted: { movies: 0, tvSeries: 0, episodes: 205 } });
  expect(html).toContain("Import complete");
  expect(html).toContain("205");
  html = job({ kind: "account", phase: "awaiting_identity" });
  expect(html).toContain("retry Delete account");
  expect(html).not.toContain("Data deletion complete");
});
