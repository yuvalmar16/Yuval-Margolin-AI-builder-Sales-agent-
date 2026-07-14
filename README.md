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

## Environment variables

Copy `.env.example` to `.env.local` and fill in whichever values you have. Every variable is optional — see the comments in `.env.example` for what each one enables and what the app falls back to when it's unset.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Running with Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url> \
  --build-arg NEXT_PUBLIC_VAPI_PUBLIC_KEY=<your-vapi-public-key> \
  -t alta-app .

docker run -p 3000:3000 --env-file .env.local alta-app
```

`NEXT_PUBLIC_*` variables are inlined into the client JS bundle at build time, so they're passed as `--build-arg`, not through `--env-file`. Every other variable (`OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CALENDAR_*`) is read server-side at request time and comes from `--env-file` at `docker run`. See `.env.example` for the full list and what each one enables.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
