# Final stage - debian-based production image
FROM debian:12-slim

# Install runtime dependencies
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
    x11-xserver-utils \
    net-tools \
    chromium \
    chromium-driver \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
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
COPY dist-binaries/server-linux-${TARGETARCH} ./server

# Copy scripts and configuration
COPY scripts/health-check.sh ./health-check.sh
COPY vnc-autostart.sh ./vnc-autostart.sh
COPY verify-display.sh ./verify-display.sh
RUN chmod +x ./server ./health-check.sh ./vnc-autostart.sh ./verify-display.sh && \
    chown eliza:eliza ./server ./health-check.sh ./vnc-autostart.sh ./verify-display.sh

# Create directories with correct permissions
RUN mkdir -p /app/data /app/logs /app/knowledge /home/eliza/.vnc && \
    chown -R eliza:eliza /app /home/eliza

# Copy the docker startup script
COPY --chown=eliza:eliza docker-startup.sh ./docker-startup.sh
RUN chmod +x ./docker-startup.sh

# Copy public folder for web UI
COPY --chown=eliza:eliza public ./public

# Create the virtual display startup script
RUN echo '#!/bin/bash\n\
echo "[DISPLAY] Starting X virtual framebuffer..."\n\
Xvfb :99 -screen 0 1280x720x24 -nolisten tcp &\n\
export DISPLAY=:99\n\
echo "[DISPLAY] Waiting for Xvfb to start..."\n\
sleep 3\n\
\n\
echo "[DISPLAY] Starting window manager..."\n\
fluxbox &\n\
sleep 2\n\
\n\
echo "[DISPLAY] Starting VNC server on port 5900..."\n\
x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb -ncache 10 -forever -shared &\n\
echo "[DISPLAY] VNC server started, accessible on port 5900"\n\
\n\
echo "[DISPLAY] Display services ready, starting main process..."\n\
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
    XVFB_SCREEN_SIZE=1280x720x24

# Use dumb-init with virtual display wrapper
ENTRYPOINT ["dumb-init", "--", "/app/start-with-display.sh"]
CMD ["./docker-startup.sh"]