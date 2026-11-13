import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "INVENTRA – Construction Centering ERP | AJAY ENTERPRISES",
  description:
    "Enterprise Inventory, Rental, Asset, Logistics, and Accounting Management System for AJAY ENTERPRISES",
  icons: {
    icon: "/assets/inventra-logo.png",
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
        {children}
      </body>
    </html>
  );
}

