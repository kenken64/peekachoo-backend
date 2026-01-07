# Build stage
# Build: 2026-01-07-v4
FROM node:18-alpine AS builder

# Install required packages for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for building native modules)
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
# These are not needed at runtime since we run "node src/server.js" directly
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /opt/yarn-* \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/lib/node_modules/corepack \
    /usr/local/bin/corepack

# Copy node_modules and source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

# Create data directory for SQLite database
RUN mkdir -p data && chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Expose port (Railway will set PORT env variable)
EXPOSE 3000

# Start the application directly with node (not npm)
CMD ["node", "src/server.js"]
