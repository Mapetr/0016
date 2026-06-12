import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Requests for the gallery subdomain (e.g. glypho.0016.cz) are rewritten to
// the /site route group, which hosts the public Glypho collage.
export default clerkMiddleware((auth, req) => {
  const galleryHost = process.env.NEXT_PUBLIC_GALLERY_HOST;
  const host = req.headers.get('host')?.split(':')[0];

  if (galleryHost && host === galleryHost) {
    const url = req.nextUrl.clone();
    if (!url.pathname.startsWith('/site')) {
      url.pathname = `/site${url.pathname === '/' ? '' : url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|ingest|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
