# ElizaOS Platform Docker Image
# Multi-stage build for production deployment

# Stage 1: Dependencies
FROM node:23.3.0-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/platform/package*.json ./packages/platform/
COPY packages/core/package*.json ./packages/core/
COPY packages/server/package*.json ./packages/server/

# Install dependencies
RUN npm ci --only=production

# Stage 2: Builder
FROM node:23.3.0-alpine AS builder
WORKDIR /app

# Copy source code
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Set build environment
ENV NODE_ENV=production
ENV BUILD_MODE=default
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN cd packages/platform && npm run build:platform

# Stage 3: Runner
FROM node:23.3.0-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 elizaos
RUN adduser --system --uid 1001 elizaos

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy built application
COPY --from=builder /app/packages/platform/.next/standalone ./
COPY --from=builder /app/packages/platform/.next/static ./.next/static
COPY --from=builder /app/packages/platform/public ./public

# Set up permissions
RUN chown -R elizaos:elizaos /app
USER elizaos

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]