import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "hjem",
    short_name: "hjem",
    description: "Calendars, tasks, meals and rewards for our home.",
    start_url: "/",
    display: "standalone",
    background_color: "#EEF1EF",
    theme_color: "#EEF1EF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
