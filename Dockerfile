# Build stage
# Build: 2026-01-07-v5
FROM node:18-alpine AS builder

# Install required packages for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy application source
COPY . .

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Accept build arguments from Railway
ARG PORT
ARG NODE_ENV
ARG JWT_SECRET
ARG ORIGIN
ARG RP_ID
ARG RP_NAME
ARG CORS_ORIGIN
ARG OPENAI_API_KEY
ARG DATABASE_PATH
ARG RAZORPAY_KEY_ID
ARG RAZORPAY_KEY_SECRET
ARG RAZORPAY_WEBHOOK_SECRET

# Set environment variables
ENV PORT=${PORT:-3000}
ENV NODE_ENV=${NODE_ENV:-production}
ENV JWT_SECRET=${JWT_SECRET}
ENV ORIGIN=${ORIGIN}
ENV RP_ID=${RP_ID}
ENV RP_NAME=${RP_NAME:-Peekachoo}
ENV CORS_ORIGIN=${CORS_ORIGIN}
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
ENV DATABASE_PATH=${DATABASE_PATH:-./data/peekachoo.db}
ENV RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
ENV RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
ENV RAZORPAY_WEBHOOK_SECRET=${RAZORPAY_WEBHOOK_SECRET}

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Remove npm, yarn, and corepack to eliminate vulnerabilities in system packages
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /opt/yarn-* \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/corepack

# Copy built application from builder stage
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/src ./src
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

# Create data directory for SQLite database with proper permissions
RUN mkdir -p data && chown -R appuser:nodejs /app/data

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check (optional, Railway handles this externally)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
#   CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application directly with node
CMD ["node", "src/server.js"]
