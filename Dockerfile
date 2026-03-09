FROM oven/bun:latest

# Install bash and git (for potential debugging)
USER root
RUN apt-get update && apt-get install -y bash git && rm -rf /var/lib/apt/lists/*
USER bun

WORKDIR /app

# Copy package files first for better caching
COPY --chown=bun:bun package.json ./
COPY --chown=bun:bun L3-model-server/package.json L3-model-server/
COPY --chown=bun:bun L13-workbench/vinxi-app/package.json L13-workbench/vinxi-app/

# Install dependencies
RUN bun install

# Copy the rest of the project
COPY --chown=bun:bun . .

ENV NODE_ENV=production
ENV MODEL_SERVER_PORT=4000

# Derive cache-bust prefix from package.json version and write .env
# Bun auto-loads .env from CWD, so both `bun run build` (vinxi) and the runtime server pick it up.
RUN bun -e 'const v = require("./package.json").version; require("fs").writeFileSync("/app/.env", "CACHE_BUST_PATH_PREFIX=" + v + "\n")' && \
    cat /app/.env && \
    bun run build

CMD ["bun", "run", "L3-model-server/server.ts"]

EXPOSE 4000
