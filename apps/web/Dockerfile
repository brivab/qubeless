FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@8.12.0 --activate

ARG VITE_API_URL
ARG WEB_CSP_CONNECT_SRC
ENV VITE_API_URL=${VITE_API_URL}
ENV CYPRESS_INSTALL_BINARY=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --filter @qubeless/web... --filter @qubeless/shared...

COPY . .

RUN pnpm --filter @qubeless/shared... build
RUN pnpm --filter @qubeless/web... build

FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

ARG WEB_CSP_CONNECT_SRC

COPY --from=builder /app/apps/web/dist ./
COPY --from=builder /app/apps/web/nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i "s|__WEB_CSP_CONNECT_SRC__|${WEB_CSP_CONNECT_SRC:-http://localhost:3001 http://127.0.0.1:3001}|g" /etc/nginx/conf.d/default.conf

EXPOSE 8081

CMD ["nginx", "-g", "daemon off;"]
