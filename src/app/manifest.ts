import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "hjem",
    short_name: "hjem",
    description: "One calm place for your household: shared calendars, tasks, meals and groceries.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F4EF",
    theme_color: "#F6F4EF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
