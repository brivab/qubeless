FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Install Python (for parsing), wget, and common build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install PMD CLI
ENV PMD_VERSION=7.9.0
RUN wget -q https://github.com/pmd/pmd/releases/download/pmd_releases%2F${PMD_VERSION}/pmd-dist-${PMD_VERSION}-bin.zip \
    && unzip -q pmd-dist-${PMD_VERSION}-bin.zip \
    && mv pmd-bin-${PMD_VERSION} /opt/pmd \
    && rm pmd-dist-${PMD_VERSION}-bin.zip \
    && chmod +x /opt/pmd/bin/* \
    && ln -s /opt/pmd/bin/pmd /usr/local/bin/pmd

COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

ENV WORKSPACE=/workspace \
    OUT_DIR=/out \
    JAVA_HOME=/opt/java/openjdk

ENTRYPOINT ["/app/entrypoint.sh"]
