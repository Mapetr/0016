"use client";

import { usePathname } from "next/navigation";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";

// Header of the main uploading site. Hidden on the Glypho gallery, which has
// its own chrome — both when served at /site and on the gallery subdomain
// (where the middleware rewrite keeps the browser path at "/").
export function MainHeader() {
  const pathname = usePathname();

  const galleryHost = process.env.NEXT_PUBLIC_GALLERY_HOST;
  const onGalleryHost =
    typeof window !== "undefined" &&
    !!galleryHost &&
    window.location.hostname === galleryHost;

  if (pathname.startsWith("/site") || onGalleryHost) return null;

  return (
    <header
      className={"flex h-14 items-center justify-between px-2 sm:h-16 sm:px-4"}
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
  );
}
