import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./glypho.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-glypho-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "glypho — gif + image host",
  description: "Public gif and image collage, powered by 0016.cz",
};

export default function GlyphoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={jetbrainsMono.variable}>{children}</div>;
}
