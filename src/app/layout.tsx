import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { TopProgressBar } from "@/components/layout/top-progress-bar";
import { IosPwaLinkHandler } from "@/components/pwa/ios-pwa-link-handler";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
  themeColor: "#0B1E36",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://ajay-enterprises-gwen-tech.vercel.app"
  ),
  title: {
    default: "INVENTRA – Construction Centering ERP | AJAY ENTERPRISES",
    template: "%s | AJAY ENTERPRISES",
  },
  description:
    "Enterprise Inventory, Rental, Asset, Logistics, and Accounting Management System for AJAY ENTERPRISES",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "INVENTRA",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://ajay-enterprises-gwen-tech.vercel.app",
    siteName: "AJAY ENTERPRISES · INVENTRA ERP",
    title: "INVENTRA – Construction Centering ERP | AJAY ENTERPRISES",
    description:
      "Enterprise Inventory, Rental, Asset, Logistics, and Accounting Management System for AJAY ENTERPRISES",
    images: [
      {
        url: "/images/og/og-default.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "INVENTRA ERP – AJAY ENTERPRISES",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "INVENTRA – Construction Centering ERP | AJAY ENTERPRISES",
    description:
      "Enterprise Inventory, Rental, Asset, Logistics, and Accounting Management System for AJAY ENTERPRISES",
    images: ["/images/og/og-default.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "INVENTRA",
    "application-name": "INVENTRA",
    "format-detection": "telephone=no",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.variable} font-sans antialiased h-full`}>
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <IosPwaLinkHandler />
        {children}
      </body>
    </html>
  );
}
