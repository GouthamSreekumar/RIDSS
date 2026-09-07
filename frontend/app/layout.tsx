import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RIDSS — Race Intelligence Decision Support System",
    template: "%s — RIDSS",
  },
  description:
    "Enterprise F1 team operations platform providing real-time race intelligence and decision support.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-graphite font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
