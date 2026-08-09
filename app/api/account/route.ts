import {
  checkRecentAuth,
  getSignInUrl,
  getWorkOS,
  withAuth,
} from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

export async function DELETE(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { user, accessToken } = await withAuth();
  if (!user || !accessToken) {
    return NextResponse.json({ error: "You need to sign in again." }, { status: 401 });
  }

  const { isStale } = await checkRecentAuth({ maxAge: 300 });
  if (isStale) {
    const reauthUrl = await getSignInUrl({ returnTo: "/settings", maxAge: 0 });
    return NextResponse.json({ reauthUrl }, { status: 428 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "Account deletion is unavailable." }, { status: 503 });
  }

  let dataDeleted = false;

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(accessToken);
    await convex.mutation(api.account.deleteAccountData, {});
    dataDeleted = true;

    await getWorkOS().userManagement.deleteUser(user.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Failed to delete account", error);
    return NextResponse.json(
      {
        error: dataDeleted
          ? "Your CouchList data was deleted, but the account could not be removed. Please try again."
          : "The account could not be deleted. Please try again.",
      },
      { status: 500 },
    );
  }
}
