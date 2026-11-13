# Koyeb — Dockerfile untuk backend KerjaYuk (opsional: Koyeb juga bisa pakai Buildpack Node)
# Build:  npm ci && npx prisma generate
# Run:    node src/server.js

# ── Tahap build ──
FROM node:22-alpine AS build

WORKDIR /app

# Salin manifest dependency dulu agar layer cache efisien
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Salin sumber + skema Prisma
COPY prisma ./prisma
COPY src ./src
COPY .aislop ./.aislop

# Generate Prisma Client (wajib sebelum runtime)
RUN npx prisma generate

# ── Tahap runtime (ramping) ──
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src

# Koyeb mengatur PORT lewat env
EXPOSE 3000

# Seed hanya dijalankan manual; runtime hanya start server
CMD ["node", "src/server.js"]
