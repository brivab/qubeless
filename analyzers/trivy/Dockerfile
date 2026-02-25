FROM aquasec/trivy:0.58.1

WORKDIR /app

# Install Python for transformation script
USER root
RUN apk add --no-cache python3 py3-pip bash

COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

# Environment variables
ENV WORKSPACE=/workspace \
    OUT_DIR=/out \
    PYTHONUNBUFFERED=1 \
    TRIVY_OFFLINE_SCAN=false \
    TRIVY_CACHE_DIR=/tmp/trivy

ENTRYPOINT ["/app/entrypoint.sh"]
