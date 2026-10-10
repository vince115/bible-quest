import type { Metadata } from "next";
import { Geist, Geist_Mono, Permanent_Marker } from "next/font/google";
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

/** Bold brush lettering for the rarity mark on the cards (open-source, OFL). */
const brush = Permanent_Marker({
  variable: "--font-brush",
  weight: "400",
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
      className={`${geistSans.variable} ${geistMono.variable} ${brush.variable} h-full antialiased`}
    >
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before React loads;
          this only ignores attribute differences on <body> itself, not on anything inside it. */}
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-100" suppressHydrationWarning>
        <LanguageToggle />
        {children}
      </body>
    </html>
  );
}
