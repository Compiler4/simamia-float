import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simamia Float ERP",
  description: "Enterprise Cash Flow, Float, Accounting and Workforce ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}