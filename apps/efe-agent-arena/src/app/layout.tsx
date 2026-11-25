import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });
const serif = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "EFE Agent Arena",
  description:
    "A scoreboard of published Embodied First Exam core results: pick two of the 11 ranked agents and see which core tests each solved that the other failed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
