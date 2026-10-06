import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CouchList",
    short_name: "CouchList",
    description: "Track your movies, TV shows, and watched episodes.",
    start_url: "/launch",
    scope: "/",
    display: "standalone",
    background_color: "#fdf9f6",
    theme_color: "#fdf9f6",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
