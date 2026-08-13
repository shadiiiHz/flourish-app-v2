# flourish

A server-rendered Next.js 15 (App Router) + React 19 + TypeScript storefront, with Tailwind CSS v4, Framer Motion, GSAP, and Lucide icons. The catalog (home page and menu) is fetched and rendered on the server for real SSR; the backend API lives in `server/`.

## Stack

- [Next.js](https://nextjs.org/) (App Router) — SSR, routing, image/font optimization
- [React 19](https://react.dev/) + React Compiler
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Framer Motion](https://motion.dev/) — animations
- [GSAP](https://gsap.com/) — animations
- [Lucide React](https://lucide.dev/) — icons

## Getting started

```bash
npm install
cp .env.example .env.local # set NEXT_PUBLIC_API_URL to your backend
npm run dev
```

## Scripts

- `npm run dev` — start the Next.js dev server
- `npm run build` — type-check and build for production
- `npm run start` — run the production server (after `build`)
- `npm run lint` — run eslint

## API layer

All requests to the backend go through the single client in `src/lib/api.ts` — every endpoint is a typed, named export (`getCatalog`, `adminGetProducts`, `createOrder`, …) instead of ad-hoc fetch calls scattered across components/pages.
