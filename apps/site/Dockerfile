FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@8.12.0 --activate

ARG VITE_DOMAIN_APP
ARG VITE_DOCS_URL
ARG VITE_GITHUB_URL
ARG VITE_SWAGGER_UI_URL
ARG VITE_API_URL

ENV VITE_DOMAIN_APP=${VITE_DOMAIN_APP}
ENV VITE_DOCS_URL=${VITE_DOCS_URL}
ENV VITE_GITHUB_URL=${VITE_GITHUB_URL}
ENV VITE_SWAGGER_UI_URL=${VITE_SWAGGER_UI_URL}
ENV VITE_API_URL=${VITE_API_URL}
ENV CYPRESS_INSTALL_BINARY=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/site/package.json apps/site/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --filter @qubeless/site...

COPY . .

RUN pnpm --filter @qubeless/site... build

FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

COPY --from=builder /app/apps/site/dist ./
COPY --from=builder /app/apps/site/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8082 || exit 1

CMD ["nginx", "-g", "daemon off;"]
