import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
      <body className="min-h-full flex flex-col bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold text-blue-600">NautiCost</span>
              </Link>
              <nav className="flex gap-6 text-sm">
                <Link href="/" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/registry" className="text-gray-600 hover:text-gray-900">
                  Registry
                </Link>
                <Link href="/forecast" className="text-gray-600 hover:text-gray-900">
                  Forecast
                </Link>
                <Link href="/about" className="text-gray-600 hover:text-gray-900">
                  About
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 bg-white py-4">
          <p className="text-center text-xs text-gray-400">
            NautiCost &mdash; Voyage Cost Prediction &mdash; LOG650 Research Project
          </p>
        </footer>
      </body>
    </html>
  );
}
