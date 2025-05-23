# Multi-stage Docker build for MCP SuperAssistant Chrome Extension

# Stage 1: Base Node.js environment with pnpm
FROM node:22.12.0-alpine AS base

# Set environment variables for pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install pnpm globally
RUN npm install -g pnpm@9.15.1
RUN apk add bash

# Set working directory
WORKDIR /app

# Copy package manager configuration
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json eslint.config.ts ./
COPY bash-scripts ./bash-scripts

# Stage 2: Dependencies installation
FROM base AS deps

# Create workspace directory structure and copy package.json files
COPY packages/dev-utils/*.json ./packages/dev-utils/
COPY packages/env/*.json ./packages/env/
COPY packages/hmr/*.json ./packages/hmr/
COPY packages/i18n/*.json ./packages/i18n/
COPY packages/module-manager/*.json ./packages/module-manager/
COPY packages/shared/*.json ./packages/shared/
COPY packages/storage/*.json ./packages/storage/
COPY packages/tailwind-config/*.json ./packages/tailwind-config/
COPY packages/tsconfig/*.json ./packages/tsconfig/
COPY packages/ui/*.json ./packages/ui/
COPY packages/vite-config/*.json ./packages/vite-config/
COPY packages/zipper/*.json ./packages/zipper/
COPY chrome-extension/*.json ./chrome-extension/
COPY pages/content/*.json ./pages/content/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

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
COPY --from=builder /app/pages/content/dist ./pages/
COPY --from=builder /app/package.json ./

# Copy utility scripts if needed
COPY --from=base /app/bash-scripts ./bash-scripts

# Create a simple script to zip the extension
RUN echo '#!/bin/sh' > /app/create-zip.sh && \
    echo 'cd /app && tar -czf mcp-superassistant-chrome-extension.tar.gz chrome-extension/dist' >> /app/create-zip.sh && \
    chmod +x /app/create-zip.sh

# Default command
CMD ["./create-zip.sh"]
