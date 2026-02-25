FROM python:3.11-slim

WORKDIR /app

# Install Mypy
RUN pip install --no-cache-dir mypy==1.8.0

COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

# Disable Python bytecode generation to keep the analyzer clean
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKSPACE=/workspace \
    OUT_DIR=/out

ENTRYPOINT ["/app/entrypoint.sh"]
