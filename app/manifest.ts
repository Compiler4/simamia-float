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
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],

    categories: [
      "business",
      "finance",
      "productivity",
    ],

    shortcuts: [
      {
        name: "Secure Login",
        short_name: "Login",
        description: "Open Simamia Float login.",
        url: "/login",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Staff Dashboard",
        short_name: "Staff",
        description: "Open the staff operations workspace.",
        url: "/staff/dashboard",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Accounting",
        short_name: "Accounting",
        description: "Open the accountant control workspace.",
        url: "/accountant",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Company Verification",
        short_name: "Verify",
        description: "Open company proof verification.",
        url: "/company-admin/verification-centre",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
