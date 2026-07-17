# Motorcycle Companion — zero-dependency Node server.
# No npm install needed: the app has no dependencies (only Node's stdlib).
FROM node:20-alpine

WORKDIR /app

# App code (data/, css/, js/, index.html, server.js). userdata/ is excluded
# via .dockerignore — the data lives on a mounted volume at runtime.
COPY . .

# Cloud Run injects PORT (usually 8080); default for local `docker run`.
ENV PORT=8080
# Persist the JSON db outside the container filesystem. Point this at a
# mounted volume (GCS bucket on Cloud Run, or a bind mount on a VM).
ENV DATA_DIR=/data

EXPOSE 8080
VOLUME ["/data"]

# Run as the built-in non-root `node` user, and make sure it owns /data.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

# Simple healthcheck against the unauthenticated /healthz route.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["node", "server.js"]
