import { expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("server-only", () => ({}));
mock.module("next/font/google", () => ({
  Playfair_Display: () => ({ variable: "font-display" }),
  DM_Sans: () => ({ variable: "font-sans" }),
}));

let session = { user: null };
mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: async () => session,
}));
process.env.NEXT_PUBLIC_CONVEX_URL ??= "https://example.convex.cloud";

const { default: RootLayout } = await import("../app/layout");
const { useAuth } = await import("@workos-inc/authkit-nextjs/components");

function AuthProbe() {
  const { user, loading } = useAuth();
  return createElement("span", {
    "data-loading": loading,
    "data-user-id": user?.id ?? "signed-out",
  });
}

test("startup has the server-checked session before client auth requests resolve", async () => {
  for (const user of [{ id: "user_startup" }, null]) {
    session = { user, sessionId: "session_startup", accessToken: "server-only-token" };
    const layout = await RootLayout({ children: createElement(AuthProbe) });
    const html = renderToStaticMarkup(layout);

    expect(html).toContain('data-loading="false"');
    expect(html).toContain(`data-user-id="${user?.id ?? "signed-out"}"`);
    expect(JSON.stringify(layout)).not.toContain("server-only-token");
  }
});
