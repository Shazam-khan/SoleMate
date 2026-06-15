# syntax=docker/dockerfile:1

# ---- Build / install stage -------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
# Only the manifests first, so layer caching skips reinstalls on code-only edits.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Runtime stage ---------------------------------------------------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as a non-root user.
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend ./backend

USER app
EXPOSE 5000

# Basic container healthcheck hitting the liveness endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/index.js"]
