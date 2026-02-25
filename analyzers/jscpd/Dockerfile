FROM node:20-bookworm-slim

WORKDIR /app

# Install necessary tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install jscpd globally
RUN npm install -g jscpd@4.0.5

# Environment variables
ENV WORKSPACE=/workspace \
    OUT_DIR=/out \
    NODE_ENV=production

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
