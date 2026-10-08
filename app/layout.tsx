import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageToggle } from "@/components/LanguageToggle";
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
  title: "Bible Quest",
  description: "Scripture Card Adventure — gameplay prototype",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100">
        <LanguageToggle />
        {children}
      </body>
    </html>
  );
}
