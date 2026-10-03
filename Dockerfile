# syntax=docker/dockerfile:1
# Waypoint: Next.js app + API in one image. Node 24 runs the TypeScript
# migration/seed script directly (built-in type stripping).

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S waypoint && adduser -S waypoint -G waypoint
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Seed inputs and the framework-free server modules the setup script imports.
COPY --from=build /app/data ./data
COPY --from=build /app/scripts/db-setup.ts ./scripts/db-setup.ts
COPY --from=build /app/src/server ./src/server
COPY --from=build /app/src/lib/planning ./src/lib/planning
COPY --from=build /app/package.json ./package.json
USER waypoint
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
# Apply the schema, seed an empty database, then serve.
CMD ["sh", "-c", "node scripts/db-setup.ts && node server.js"]
