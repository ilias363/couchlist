"use client";

import { SignInButton, useAuth, UserButton, useUser } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";

export default function Home() {
  const user = useUser().user;
  return (
    <>
      <Authenticated>
        <UserButton />
        <div className="flex flex-col min-h-screen items-center justify-center">
          <h1>Home Page</h1>
          <p>Welcome, {user?.username || "User"}!</p>
        </div>
        ;
      </Authenticated>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
    </>
  );
}
