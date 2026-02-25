FROM semgrep/semgrep:1.74.0

WORKDIR /app

COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

# Disable remote checks to keep the analyzer fully offline.
ENV SEMGREP_ENABLE_VERSION_CHECK=0 \
    SEMGREP_DISABLE_VERSION_CHECK=1 \
    SEMGREP_APP_TOKEN= \
    SEMGREP_URL= \
    WORKSPACE=/workspace \
    OUT_DIR=/out \
    PYTHONUNBUFFERED=1

ENTRYPOINT ["/app/entrypoint.sh"]
