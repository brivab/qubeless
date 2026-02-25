FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl \
  && corepack enable \
  && corepack prepare pnpm@8.12.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

ENV CYPRESS_INSTALL_BINARY=0

RUN pnpm install --frozen-lockfile --filter @qubeless/api... --filter @qubeless/shared...

COPY . .

RUN pnpm --filter @qubeless/shared... build
# Prisma CLI is only a devDependency of @qubeless/api; run via workspace script
RUN pnpm --filter @qubeless/api... run prisma:generate
RUN pnpm --filter @qubeless/api... build

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@8.12.0 --activate

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/scripts ./apps/api/scripts
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/analyzers ./analyzers
COPY --from=builder /root/.local/share/pnpm /root/.local/share/pnpm

RUN chmod +x /app/apps/api/scripts/docker-entrypoint.sh

EXPOSE 3001

CMD ["sh", "/app/apps/api/scripts/docker-entrypoint.sh"]
