# ─── Stage 1: Build the React frontend ────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output: /build/dist

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM ubuntu:22.04

LABEL maintainer="Game Server Manager"
LABEL description="Steam CMD Game Server Manager – Docker Edition"

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/app/data

# ── System dependencies (Node 20, SteamCMD 32-bit libs) ───────────────────────
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lib32gcc-s1 \
        libsdl2-2.0-0:i386 \
        libstdc++6:i386 \
        wget \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── SteamCMD ──────────────────────────────────────────────────────────────────
RUN mkdir -p /opt/steamcmd && \
    cd /opt/steamcmd && \
    wget -q https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz && \
    tar xf steamcmd_linux.tar.gz && \
    rm steamcmd_linux.tar.gz && \
    chmod +x /opt/steamcmd/steamcmd.sh

# ── Non-root user ─────────────────────────────────────────────────────────────
RUN useradd -ms /bin/bash gsm

# ── Application ───────────────────────────────────────────────────────────────
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY --from=frontend-builder /build/dist ./public

# ── Directories & permissions ─────────────────────────────────────────────────
RUN mkdir -p /app/data/uploads /opt/servers && \
    chown -R gsm:gsm /app /opt/servers /opt/steamcmd

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/api/auth/status || exit 1

USER gsm
CMD ["node", "server.js"]
