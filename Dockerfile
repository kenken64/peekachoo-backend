# Simple single-stage Dockerfile
# Build: 2026-01-07-v6
FROM node:18-alpine

# Install required packages for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
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

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source
COPY src ./src

# Create data directory for SQLite database
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/server.js"]
