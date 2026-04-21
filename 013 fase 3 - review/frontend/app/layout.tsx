import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteHeader from "../components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NautiCost - Voyage Cost Estimator",
  description: "Estimate superyacht voyage costs using machine learning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200/60 bg-white/60 backdrop-blur-sm py-4">
          <p className="text-center text-xs text-gray-400">
            NautiCost &mdash; Voyage Cost Prediction &mdash; LOG650 Research Project
          </p>
        </footer>
      </body>
    </html>
  );
}
