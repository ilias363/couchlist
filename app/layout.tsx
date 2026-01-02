import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/convex-client-provider";
import { RQProvider } from "@/components/query-client-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { shadcn } from "@clerk/themes";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
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
      <body className={`${inter.variable} font-sans antialiased`}>
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
