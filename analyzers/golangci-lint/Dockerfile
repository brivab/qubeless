FROM golangci/golangci-lint:v1.61.0-alpine

WORKDIR /app

# Install Python for transformation script
USER root
RUN apk add --no-cache python3 bash

COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

# Environment variables
ENV WORKSPACE=/workspace \
    OUT_DIR=/out \
    PYTHONUNBUFFERED=1

ENTRYPOINT ["/app/entrypoint.sh"]
