# ElizaOS Agent Server - Optimized for self-contained binary
FROM debian:12-slim

# Install minimal runtime dependencies including PostgreSQL client for database management
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    dumb-init \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 eliza \
    && useradd -u 1001 -g eliza -m eliza

WORKDIR /app

# Copy the pre-built Linux binary and health check  
ARG TARGETARCH=arm64
# Map Docker's TARGETARCH to our binary naming convention
RUN echo "Target architecture: ${TARGETARCH}"
COPY dist-binaries/server-linux-${TARGETARCH} ./server
COPY scripts/health-check.sh ./health-check.sh

# Ensure executables are executable
RUN chmod +x ./server ./health-check.sh && \
    chown eliza:eliza ./server ./health-check.sh

# Create necessary directories
RUN mkdir -p /app/data /app/logs /app/knowledge && \
    chown -R eliza:eliza /app

# Copy startup script
COPY --chown=eliza:eliza docker-startup.sh ./docker-startup.sh
RUN chmod +x ./docker-startup.sh

# Switch to non-root user
USER eliza

# Health check endpoint with proper script
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD ["./health-check.sh"]

# Expose port
EXPOSE 7777

# Environment variables for production
ENV NODE_ENV=production \
    PORT=7777 \
    LOG_LEVEL=info \
    DOCKER_CONTAINER=true \
    POSTGRES_URL="postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza_game" \
    DATABASE_URL="postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza_game" \
    OLLAMA_BASE_URL="http://eliza-ollama:11434" \
    OLLAMA_API_ENDPOINT="http://eliza-ollama:11434/api" \
    KNOWLEDGE_PATH="/app/knowledge" \
    RESET_DB=false

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-startup.sh"]