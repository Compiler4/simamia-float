import type {
  Metadata,
  Viewport,
} from "next";

import type {
  ReactNode,
} from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Simamia Float ERP",
    template:
      "%s | Simamia Float ERP",
  },

  description:
    "Enterprise cash flow, float, accounting, staff, broker and financial management system.",

  applicationName:
    "Simamia Float ERP",

  manifest:
    "/manifest.webmanifest",

  icons: {
    icon: [
      {
        url: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },

  appleWebApp: {
    capable: true,
    title: "Simamia Float",
    statusBarStyle: "default",
  },

  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#087054",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}