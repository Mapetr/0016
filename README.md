This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Glypho — public gallery subdomain

`/site` hosts **Glypho**, a public masonry collage of images that users opt
into publishing via the "Add to Glypho" checkbox on the uploader (requires an
account; the upload is also saved to it).

To serve it on its own subdomain, point the subdomain at the same deployment
and set:

- `NEXT_PUBLIC_GALLERY_HOST` — hostname of the gallery (e.g. `glypho.0016.cz`).
  The middleware rewrites requests for this host to `/site`.
- `NEXT_PUBLIC_GALLERY_URL` — full URL of the gallery (e.g.
  `https://glypho.0016.cz`), used by the uploader to link to it.
- `NEXT_PUBLIC_MAIN_SITE_URL` — full URL of the main uploader (e.g.
  `https://0016.cz`), used by the gallery to link back.

Without these set, the gallery is still reachable at `/site` and links fall
back to relative paths.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
