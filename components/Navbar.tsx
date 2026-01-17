"use client";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { useIsMobile } from "@/lib/use-mobile";
import Link from "next/link";
import { useConvexAuth } from "convex/react";

export function Navbar() {
  const isMobile = useIsMobile();
  const { isAuthenticated } = useConvexAuth();

  if (!isAuthenticated) return null;

  return (
    <NavigationMenu className={"flex-shrink-0"} viewport={isMobile}>
      <NavigationMenuList className="flex-wrap gap-1">
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link href="/" className="px-2 text-sm sm:px-3 sm:text-base">
              Home
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link href="/files" className="px-2 text-sm sm:px-3 sm:text-base">
              Files
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
