FROM python:3.11-slim

WORKDIR /app

# Install Bandit with all dependencies
# Note: pbr is required but not automatically installed in some environments
RUN pip install --no-cache-dir pbr bandit[toml]==1.7.5

COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

# Disable Python bytecode generation to keep the analyzer clean
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKSPACE=/workspace \
    OUT_DIR=/out

ENTRYPOINT ["/app/entrypoint.sh"]
