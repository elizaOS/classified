# ElizaOS Agent Container
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    bash \
    sqlite

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY ../../package*.json ../../
COPY ../../packages/core/package*.json ../../packages/core/
COPY ../../packages/server/package*.json ../../packages/server/
COPY ../../packages/plugin-*/package*.json ../../packages/plugin-*/

# Install dependencies
RUN npm ci --production

# Copy source code
COPY . .
COPY ../../packages/core ../../packages/core
COPY ../../packages/server ../../packages/server
COPY ../../packages/plugin-* ../../packages/plugin-*

# Build the application
RUN npm run build

# Create data directory with proper permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

# Switch to non-root user
USER node

# Expose port
EXPOSE 7777

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:7777/api/server/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data
ENV PGLITE_DATA_DIR=/app/data

# Start the agent
CMD ["node", "dist/server.js"]