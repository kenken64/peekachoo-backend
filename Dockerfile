# Use Node.js LTS version
# Build: 2026-01-07-v3
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

# Install dependencies
RUN npm ci --only=production

# Copy application source
COPY . .

# Create data directory for SQLite database
RUN mkdir -p data

# Expose port (Railway will set PORT env variable)
EXPOSE 3000

# Note: Railway handles health checks externally, Docker HEALTHCHECK can conflict
# HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
#   CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Start the application
CMD ["npm", "start"]
