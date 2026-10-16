import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { withAuth } from "@workos-inc/authkit-nextjs";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/convex-client-provider";
import { RQProvider } from "@/components/providers/query-client-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "CouchList — Track Your Movies & TV Shows",
    template: "%s · CouchList",
  },
  description:
    "Your personal entertainment tracker. Discover, track, and analyze your viewing journey with CouchList.",
  keywords: ["movies", "tv shows", "tracking", "watchlist", "entertainment"],
  appleWebApp: {
    capable: true,
    title: "CouchList",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reuse the proxy-checked session instead of fetching it again on mount.
  const { accessToken: _accessToken, ...initialAuth } = await withAuth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${playfair.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <ConvexClientProvider initialAuth={initialAuth}>
            <RQProvider>
              <div className="relative isolate z-0">{children}</div>
            </RQProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
