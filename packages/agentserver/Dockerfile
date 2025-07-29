# First stage - build stagehand server
FROM node:20-slim AS stagehand-builder

WORKDIR /stagehand

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy stagehand server source
COPY packages/plugin-stagehand/stagehand-server/package*.json ./
RUN npm ci

COPY packages/plugin-stagehand/stagehand-server/ ./
RUN npm run build

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Try to build the binary, but don't fail if it doesn't work
RUN npm run build:sea || echo "Binary build failed, will use Node.js fallback"

# Final stage - debian-based production image
FROM debian:12-slim

# Install runtime dependencies including Node.js for stagehand fallback
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    dumb-init \
    postgresql-client \
    procps \
    xvfb \
    x11vnc \
    ffmpeg \
    xterm \
    fluxbox \
    tmux \
    htop \
    x11-utils \
    nodejs \
    npm \
    # Chromium dependencies for Playwright/Stagehand
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1001 eliza \
    && useradd -u 1001 -g eliza -m eliza

WORKDIR /app

# Add cache busting argument
ARG CACHE_BUST=1
ARG TARGETARCH=arm64
RUN echo "Target architecture: ${TARGETARCH}"
RUN echo "Cache bust: ${CACHE_BUST}"

# Copy the prebuilt binary for the correct architecture
# Using a more explicit approach to ensure proper path resolution
COPY packages/agentserver/dist-binaries/server-linux-arm64 ./server-arm64
COPY packages/agentserver/dist-binaries/server-linux-amd64 ./server-amd64
RUN if [ "${TARGETARCH}" = "arm64" ]; then mv ./server-arm64 ./server && rm -f ./server-amd64; else mv ./server-amd64 ./server && rm -f ./server-arm64; fi

# Copy scripts and configuration
COPY packages/agentserver/scripts/health-check.sh ./health-check.sh
COPY packages/agentserver/vnc-autostart.sh ./vnc-autostart.sh
RUN chmod +x ./server ./health-check.sh ./vnc-autostart.sh && \
    chown eliza:eliza ./server ./health-check.sh ./vnc-autostart.sh

# Create directories with correct permissions
RUN mkdir -p /app/data /app/logs /app/knowledge /home/eliza/.vnc && \
    chown -R eliza:eliza /app /home/eliza

# Copy the docker startup script
COPY --chown=eliza:eliza packages/agentserver/docker-startup.sh ./docker-startup.sh
RUN chmod +x ./docker-startup.sh

# Copy public folder for web UI
COPY --chown=eliza:eliza packages/agentserver/public ./public

# Copy stagehand server from builder stage
# First create directories
RUN mkdir -p /app/stagehand-server/dist /usr/local/bin

# Copy the built JavaScript files
COPY --from=stagehand-builder --chown=eliza:eliza /stagehand/dist /app/stagehand-server/dist/
COPY --from=stagehand-builder --chown=eliza:eliza /stagehand/package*.json /app/stagehand-server/

# Copy node_modules for the stagehand server
COPY --from=stagehand-builder --chown=eliza:eliza /stagehand/node_modules /app/stagehand-server/node_modules/

# Copy Playwright browsers
COPY --from=stagehand-builder --chown=eliza:eliza /root/.cache/ms-playwright /home/eliza/.cache/ms-playwright

# Try to copy the binary if it was built successfully
# We use a script approach since COPY doesn't support || operator
RUN --mount=type=bind,from=stagehand-builder,source=/stagehand,target=/tmp/stagehand \
    if [ -f /tmp/stagehand/binaries/stagehand-server-linux ]; then \
        cp /tmp/stagehand/binaries/stagehand-server-linux /usr/local/bin/stagehand-server-linux && \
        chown eliza:eliza /usr/local/bin/stagehand-server-linux; \
    else \
        echo "No binary found, using Node.js fallback"; \
    fi

# Make binary executable if it exists
RUN if [ -f /usr/local/bin/stagehand-server-linux ]; then \
        chmod +x /usr/local/bin/stagehand-server-linux && \
        ln -sf /usr/local/bin/stagehand-server-linux /usr/local/bin/stagehand-server; \
    else \
        echo "#!/bin/bash" > /usr/local/bin/stagehand-server && \
        echo "cd /app/stagehand-server && node dist/index.js" >> /usr/local/bin/stagehand-server && \
        chmod +x /usr/local/bin/stagehand-server; \
    fi

# Create the virtual display startup script
RUN echo '#!/bin/bash\n\
Xvfb :99 -screen 0 1280x720x24 -nolisten tcp &\n\
export DISPLAY=:99\n\
sleep 2\n\
\n\
# Start window manager\n\
fluxbox &\n\
sleep 1\n\
\n\
# Start VNC server\n\
x11vnc -display :99 -nopw -listen localhost -xkb -ncache 10 -forever &\n\
\n\
exec "$@"' > /app/start-with-display.sh && \
    chmod +x /app/start-with-display.sh && \
    chown eliza:eliza /app/start-with-display.sh

# Switch to non-root user
USER eliza

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD ["./health-check.sh"]

# Expose ports
EXPOSE 7777 5900

# Set environment variables
ENV NODE_ENV=production \
    PORT=7777 \
    LOG_LEVEL=info \
    DOCKER_CONTAINER=true \
    POSTGRES_URL="postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza" \
    DATABASE_URL="postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza" \
    OLLAMA_BASE_URL="http://eliza-ollama:11434" \
    OLLAMA_API_ENDPOINT="http://eliza-ollama:11434/api" \
    KNOWLEDGE_PATH="/app/knowledge" \
    RESET_DB=false \
    DISPLAY=:99 \
    XVFB_SCREEN_SIZE=1280x720x24 \
    STAGEHAND_SERVER_PORT=8080 \
    BROWSER_HEADLESS=true \
    PLAYWRIGHT_BROWSERS_PATH=/home/eliza/.cache/ms-playwright

# Use dumb-init with virtual display wrapper
ENTRYPOINT ["dumb-init", "--", "/app/start-with-display.sh"]
CMD ["./docker-startup.sh"]