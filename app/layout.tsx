import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NoSSRWrapper from "@/app/NoSSRWrapper";
import { PostHogProvider } from "@/app/providers";
import { Toaster } from "@/components/ui/sonner";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/app/ConvexClientProvider";
import { MainHeader } from "@/components/MainHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "0016.cz",
  description: "File uploading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="darkreader-lock" />
        <title>0016.cz</title>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} dark antialiased`}
      >
        <NoSSRWrapper>
          <PostHogProvider>
            <ClerkProvider>
              <ConvexClientProvider>
                <MainHeader />
                {children}
              </ConvexClientProvider>
            </ClerkProvider>
          </PostHogProvider>
          <Toaster />
        </NoSSRWrapper>
      </body>
    </html>
  );
}
