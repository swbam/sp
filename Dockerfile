# Multi-stage Dockerfile for MySetlist Production
# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set build arguments
ARG NODE_ENV=production
ARG BUILD_DATE
ARG VCS_REF

# Add build metadata
LABEL org.opencontainers.image.created=${BUILD_DATE} \
      org.opencontainers.image.revision=${VCS_REF} \
      org.opencontainers.image.source="https://github.com/mysetlist/mysetlist" \
      org.opencontainers.image.title="MySetlist" \
      org.opencontainers.image.description="Concert setlist voting platform" \
      org.opencontainers.image.vendor="MySetlist" \
      org.opencontainers.image.version="1.0.0"

# Install security updates and dependencies
RUN apk update && \
    apk add --no-cache \
        dumb-init \
        ca-certificates \
        tzdata && \
    rm -rf /var/cache/apk/*

# Create app directory with non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with production optimizations
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy source code
COPY --chown=nextjs:nodejs . .

# Remove development files
RUN rm -rf \
    .git \
    .github \
    .vscode \
    *.md \
    test* \
    *.test.* \
    *.spec.* \
    coverage \
    .nyc_output \
    docs

# Build the application
RUN npm run build

# Remove dev dependencies and clean up
RUN npm prune --production && \
    rm -rf .next/cache

# Stage 2: Production stage
FROM node:20-alpine AS runner

# Install security updates and runtime dependencies
RUN apk update && \
    apk add --no-cache \
        dumb-init \
        ca-certificates \
        tzdata \
        tini && \
    rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Create necessary directories with proper permissions
RUN mkdir -p /app/.next /app/logs /tmp && \
    chown -R nextjs:nodejs /app /tmp

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./

# Copy runtime configuration files
COPY --from=builder --chown=nextjs:nodejs /app/middleware.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/types*.ts ./

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NEXT_TELEMETRY_DISABLED=1

# Security: Set file permissions
RUN chmod -R 755 /app && \
    chmod -R 777 /tmp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/sync/health || exit 1

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Use tini as init system for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["npm", "start"]

# Production security best practices applied:
# - Multi-stage build to minimize image size
# - Non-root user execution
# - Minimal base image (Alpine)
# - Security updates installed
# - Proper file permissions
# - Health check included
# - Init system for signal handling
# - Build metadata for traceability
# - Development files removed
# - Cache layers optimized