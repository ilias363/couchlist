import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  withAuth: vi.fn(), checkRecentAuth: vi.fn(), getSignInUrl: vi.fn(),
  mutation: vi.fn(), query: vi.fn(), setAuth: vi.fn(), deleteUser: vi.fn(),
}));
vi.mock("@workos-inc/authkit-nextjs", () => ({ ...mocks, getWorkOS: () => ({ userManagement: { deleteUser: mocks.deleteUser } }) }));
vi.mock("convex/browser", () => ({ ConvexHttpClient: class {
  mutation = mocks.mutation; query = mocks.query; setAuth = mocks.setAuth;
} }));
import { DELETE } from "./route";
const request = (origin = "http://localhost") => new NextRequest("http://localhost/api/account", { method: "DELETE", headers: { origin } });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  mocks.withAuth.mockResolvedValue({ user: { id: "workos-user" }, accessToken: "token" });
  mocks.checkRecentAuth.mockResolvedValue({ isStale: false });
  mocks.getSignInUrl.mockResolvedValue("/reauth");
  mocks.mutation.mockResolvedValue("job-id");
});
test("identity deletion waits for the actual terminal cleanup checkpoint", async () => {
  mocks.query.mockResolvedValue({ phase: "delete_episodes", processed: 100 });
  const pending = await DELETE(request());
  expect(pending.status).toBe(202);
  expect(await pending.json()).toMatchObject({ pending: true, processed: 100 });
  expect(mocks.deleteUser).not.toHaveBeenCalled();
  mocks.query.mockResolvedValue({ phase: "awaiting_identity", processed: 500 });
  const done = await DELETE(request());
  expect(done.status).toBe(200);
  expect(await done.json()).toEqual({ deleted: true });
  expect(mocks.deleteUser).toHaveBeenCalledWith("workos-user");
  expect(mocks.query.mock.invocationCallOrder[1]).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0]);
  expect(done.headers.get("set-cookie")).toContain("wos-session=");
});
test("failed checkpoints resume and identity failures keep an actionable retry", async () => {
  mocks.query.mockResolvedValue({ phase: "delete_stats", processed: 50, error: "transient failure" });
  expect((await DELETE(request())).status).toBe(202);
  expect(mocks.mutation).toHaveBeenCalledTimes(2);
  expect(mocks.deleteUser).not.toHaveBeenCalled();
  mocks.query.mockResolvedValue({ phase: "awaiting_identity", processed: 50 });
  mocks.deleteUser.mockRejectedValueOnce(new Error("WorkOS unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const failed = await DELETE(request());
    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toContain("data was deleted");
    expect((await DELETE(request())).status).toBe(200);
  } finally { log.mockRestore(); }
});
test("CSRF, authentication and recent-auth checks precede all data changes", async () => {
  expect((await DELETE(request("http://attacker"))).status).toBe(403);
  expect(mocks.withAuth).not.toHaveBeenCalled();
  mocks.withAuth.mockResolvedValueOnce({ user: null });
  expect((await DELETE(request())).status).toBe(401);
  mocks.checkRecentAuth.mockResolvedValueOnce({ isStale: true });
  const stale = await DELETE(request());
  expect(stale.status).toBe(428);
  expect(await stale.json()).toEqual({ reauthUrl: "/reauth" });
  expect(mocks.mutation).not.toHaveBeenCalled();
  expect(mocks.deleteUser).not.toHaveBeenCalled();
});
test("a WorkOS identity already removed by a prior retry is completion", async () => {
  mocks.query.mockResolvedValue({ phase: "awaiting_identity", processed: 500 });
  mocks.deleteUser.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
  const response = await DELETE(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ deleted: true });
});
