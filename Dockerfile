# Multi-stage Docker build for MCP SuperAssistant Chrome Extension

# Stage 1: Base Node.js environment with pnpm
FROM node:22.12.0-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm@9.15.1

# Set working directory
WORKDIR /app

# Copy package manager configuration
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Stage 2: Dependencies installation
FROM base AS deps

# Copy all package.json files from workspace packages
COPY packages/*/package.json ./packages/*/
COPY chrome-extension/package.json ./chrome-extension/
COPY pages/*/package.json ./pages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 3: Development environment
FROM base AS development

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/chrome-extension/node_modules ./chrome-extension/node_modules
COPY --from=deps /app/pages ./pages

# Copy source code
COPY . .

# Install turbo globally
RUN pnpm install -g turbo@2.4.2

# Expose development server port (if applicable)
EXPOSE 3000 5173

# Default command for development
CMD ["pnpm", "dev"]

# Stage 4: Build environment
FROM development AS builder

# Set environment variables for production build
ENV NODE_ENV=production

# Run the build process
RUN pnpm build

# Stage 5: Production/Distribution
FROM alpine:latest AS production

# Install Node.js runtime (minimal)
RUN apk add --no-cache nodejs npm

# Create app directory
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/chrome-extension/dist ./chrome-extension/dist
COPY --from=builder /app/pages/*/dist ./pages/
COPY --from=builder /app/package.json ./

# Copy utility scripts if needed
COPY --from=builder /app/bash-scripts ./bash-scripts

# Create a simple script to zip the extension
RUN echo '#!/bin/sh' > /app/create-zip.sh && \
    echo 'cd /app && tar -czf mcp-superassistant-chrome-extension.tar.gz chrome-extension/dist' >> /app/create-zip.sh && \
    chmod +x /app/create-zip.sh

# Default command
CMD ["./create-zip.sh"]
