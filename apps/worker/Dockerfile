FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl \
  && corepack enable \
  && corepack prepare pnpm@8.12.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

ENV CYPRESS_INSTALL_BINARY=0

RUN pnpm install --frozen-lockfile --filter @qubeless/worker... --filter @qubeless/api... --filter @qubeless/shared...

COPY . .

# Build dependencies in order
RUN pnpm --filter @qubeless/shared build
RUN pnpm --filter @qubeless/api run prisma:generate

# Use tsc with build mode for project references
RUN pnpm --filter @qubeless/worker exec tsc --build --force

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl docker-cli \
  && corepack enable \
  && corepack prepare pnpm@8.12.0 --activate

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /root/.local/share/pnpm /root/.local/share/pnpm

CMD ["node", "apps/worker/dist/index.js"]
