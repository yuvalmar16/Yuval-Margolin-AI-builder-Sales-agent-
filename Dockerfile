# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` refuses to run here: the lockfile (generated on Windows) never
# resolved @tailwindcss/oxide-wasm32-wasi's bundled @emnapi/* sub-deps,
# since that wasm fallback binary is only pulled in on platforms lacking a
# native oxide build -- Alpine has its own (oxide-linux-x64-musl) and never
# needs it, but `ci`'s completeness check doesn't know that. `install` is
# fine since we don't need byte-for-byte lockfile reproduction in the image.
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client JS bundle at build time,
# so they must be supplied as build args -- setting them only at `docker run`
# has no effect on already-built client code. Everything else (OpenAI key,
# Supabase service role key, Vapi/Google OAuth secrets) is read server-side
# at request time and belongs in `docker run --env-file` instead.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_VAPI_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_VAPI_PUBLIC_KEY=$NEXT_PUBLIC_VAPI_PUBLIC_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
