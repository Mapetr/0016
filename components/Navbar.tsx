"use client"

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList, navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu";
import { useIsMobile } from "@/lib/use-mobile";
import Link from "next/link";
import { useConvexAuth } from "convex/react";

export function Navbar() {
  const isMobile = useIsMobile();
  const { isAuthenticated } = useConvexAuth();

  if (!isAuthenticated) return null;

  return (
    <NavigationMenu className={"absolute top-0 left-0 p-2"} viewport={isMobile}>
      <NavigationMenuList className="flex-wrap">
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link href="/">Home</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link href="/files">Files</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}