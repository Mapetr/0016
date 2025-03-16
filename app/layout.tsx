import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NoSSRWrapper from "@/app/NoSSRWrapper";
import { Toaster } from "@/components/ui/toaster";
import { PostHogProvider } from "@/app/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "0016.cz",
  description: "File uploading"
};

export default function RootLayout({
                                     children
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
    <head>
      <meta name="darkreader-lock" />
    </head>
    <body
      className={`${geistSans.variable} ${geistMono.variable} dark antialiased`}
    >
    <NoSSRWrapper>
      <PostHogProvider>
        {children}
      </PostHogProvider>
    </NoSSRWrapper>
    <Toaster />
    </body>
    </html>
  );
}
