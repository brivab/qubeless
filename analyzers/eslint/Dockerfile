FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends rsync ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Pre-bundle ESLint and TS parser/plugins to stay offline-friendly.
RUN npm install --prefix /opt/eslint --no-package-lock --no-save \
  eslint@8.57.0 \
  @typescript-eslint/parser@6.21.0 \
  @typescript-eslint/eslint-plugin@6.21.0 \
  typescript@5.4.5 \
  eslint-plugin-security@2.1.0

ENV PATH="/opt/eslint/node_modules/.bin:${PATH}" \
    WORKSPACE=/workspace \
    OUT_DIR=/out \
    NODE_ENV=production

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
