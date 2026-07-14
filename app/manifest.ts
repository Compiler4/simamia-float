import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",

    name: "Simamia Float Management",

    short_name: "Simamia Float",

    description:
      "Company float, accounting, staff, broker and financial management system.",

    start_url: "/login",

    scope: "/",

    display: "standalone",

    background_color: "#f4f8f6",

    theme_color: "#087054",

    orientation: "any",

    icons: [
      {
        src: "/icons/float.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/money.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}