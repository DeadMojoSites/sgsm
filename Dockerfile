FROM python:3.12-slim

LABEL maintainer="SGSM" \
      description="Steam Game Server Manager"

# System dependencies (SteamCMD requires 32-bit libs on 64-bit systems)
RUN dpkg --add-architecture i386 \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       lib32gcc-s1 \
       libstdc++6:i386 \
       wget \
       curl \
       tar \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create default data / server / steamcmd directories
RUN mkdir -p /data /servers /steamcmd

ENV SGSM_DATA_DIR=/data \
    SGSM_SERVERS_DIR=/servers \
    SGSM_STEAMCMD_DIR=/steamcmd \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["python", "run.py"]
