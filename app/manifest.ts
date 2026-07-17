import type { MetadataRoute } from "next";

/** PWA manifest — makes the app installable to a phone home screen with the
 *  Sentiment Research mark and name. Served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sentiment Research — Consumer Sentiment Hub",
    short_name: "Sentiment Hub",
    description:
      "Sentiment Research's consumer sentiment intelligence archive: qualitative research, searchable with full source traceability.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1e2a6b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
