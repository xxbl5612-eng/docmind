# ── Stage 1: Build frontend ──
FROM node:22-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build backend ──
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared
RUN curl -fsSL -o /usr/local/bin/cloudflared \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
    && chmod +x /usr/local/bin/cloudflared

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e "."

COPY src/ ./src/
COPY --from=frontend-builder /frontend/dist/ ./frontend/dist/
COPY docker/start.sh ./start.sh
RUN chmod +x ./start.sh

RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app
USER app

EXPOSE 8000

ENV USE_DEV_FALLBACK=true
ENV APP_ENV=production
ENV APP_DEBUG=false

CMD ["./start.sh"]
