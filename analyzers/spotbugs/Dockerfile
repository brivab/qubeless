FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Install Maven, Gradle, Python (for parsing), and common build tools
RUN apt-get update && apt-get install -y \
    maven \
    gradle \
    python3 \
    python3-pip \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install SpotBugs CLI
ENV SPOTBUGS_VERSION=4.8.3
RUN wget -q https://github.com/spotbugs/spotbugs/releases/download/${SPOTBUGS_VERSION}/spotbugs-${SPOTBUGS_VERSION}.tgz \
    && tar -xzf spotbugs-${SPOTBUGS_VERSION}.tgz \
    && mv spotbugs-${SPOTBUGS_VERSION} /opt/spotbugs \
    && rm spotbugs-${SPOTBUGS_VERSION}.tgz \
    && chmod +x /opt/spotbugs/bin/* \
    && ln -s /opt/spotbugs/bin/spotbugs /usr/local/bin/spotbugs

COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

ENV WORKSPACE=/workspace \
    OUT_DIR=/out \
    JAVA_HOME=/opt/java/openjdk

ENTRYPOINT ["/app/entrypoint.sh"]
