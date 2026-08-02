# ─────────────────────────────────────────────────────────────────────────────
# CloudOps AI — Frontend Dockerfile  (multi-stage)
#
# Stage 1 — builder : Node 20 Alpine  → npm ci + vite build
# Stage 2 — runtime : nginx Alpine    → serve the static dist/
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first so npm ci is cached unless dependencies change
COPY package.json package-lock.json ./

# ci = clean, reproducible install from lock-file (faster than npm install)
RUN npm ci --silent

# Copy source
COPY . .

# VITE_API_URL is a build-time argument.
# The browser (not the container) makes API calls, so this must be the
# URL the *user's browser* can reach — i.e. the host's localhost:8000.
# The default matches the existing development default in api.js so no
# code change is required.
ARG VITE_API_URL=http://localhost:8000/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove the default nginx config and replace with our SPA-friendly one
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the production build from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# ── Health check ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1
