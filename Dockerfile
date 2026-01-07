# Build stage
# Build: 2026-01-07-v7
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

# Copy built application from builder stage
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/src ./src
COPY --from=builder --chown=appuser:nodejs /app/package.json ./

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data && chown -R appuser:nodejs /app/data

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Start the application directly with node (not npm, since we're running as non-root)
CMD ["node", "src/server.js"]
