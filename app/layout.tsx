import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "@radix-ui/themes/styles.css";
import "@workos-inc/widgets/styles.css";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${playfair.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <ConvexClientProvider>
            <RQProvider>{children}</RQProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
