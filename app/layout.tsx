import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NoSSRWrapper from "@/app/NoSSRWrapper";
import { PostHogProvider } from "@/app/providers";
import { Toaster } from "@/components/ui/sonner";
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import ConvexClientProvider from "@/app/ConvexClientProvider";
import { Navbar } from "@/components/Navbar";

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
                <header
                  className={
                    "flex h-14 items-center justify-between px-2 sm:h-16 sm:px-4"
                  }
                >
                  <Navbar />
                  <div className="ml-auto flex items-center gap-2 sm:gap-4">
                    <SignedOut>
                      <SignInButton>
                        <Button
                          className={"text-xs sm:text-sm"}
                          size={"sm"}
                          aria-label="Sign in"
                        >
                          Sign In
                        </Button>
                      </SignInButton>
                    </SignedOut>
                    <SignedIn>
                      <UserButton />
                    </SignedIn>
                  </div>
                </header>
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
