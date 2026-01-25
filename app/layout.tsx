import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/convex-client-provider";
import { RQProvider } from "@/components/providers/query-client-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { shadcn } from "@clerk/themes";

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
  title: "CouchList - Track Your Movies & TV Shows",
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
      <body className={`${dmSans.variable} ${playfair.variable} font-sans antialiased`}>
        <ThemeProvider>
          <ClerkProvider appearance={{ theme: shadcn }}>
            <ConvexClientProvider>
              <RQProvider>{children}</RQProvider>
            </ConvexClientProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
