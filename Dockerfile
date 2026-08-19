# Production Dockerfile with FFmpeg & Node.js
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build frontend and compile backend
RUN npm run build

# Production Stage
FROM node:20-bullseye-slim AS runner

WORKDIR /app

# Install FFmpeg & FFprobe & system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled build artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/metadata.json ./metadata.json

# Create uploads and database directories with permissions
RUN mkdir -p /app/uploads/thumbnails /app/data && chmod -R 777 /app/uploads /app/data

VOLUME ["/app/uploads", "/app/data"]

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
