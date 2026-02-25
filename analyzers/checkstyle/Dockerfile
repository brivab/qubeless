FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Install Python (for parsing), wget, and common build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Checkstyle CLI
ENV CHECKSTYLE_VERSION=10.21.1
RUN wget -q https://github.com/checkstyle/checkstyle/releases/download/checkstyle-${CHECKSTYLE_VERSION}/checkstyle-${CHECKSTYLE_VERSION}-all.jar \
    -O /opt/checkstyle.jar \
    && chmod 644 /opt/checkstyle.jar

# Create wrapper script
RUN echo '#!/bin/sh\njava -jar /opt/checkstyle.jar "$@"' > /usr/local/bin/checkstyle \
    && chmod +x /usr/local/bin/checkstyle

# Copy default configuration (Google Java Style)
COPY google_checks.xml /app/google_checks.xml

COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

ENV WORKSPACE=/workspace \
    OUT_DIR=/out \
    JAVA_HOME=/opt/java/openjdk

ENTRYPOINT ["/app/entrypoint.sh"]
