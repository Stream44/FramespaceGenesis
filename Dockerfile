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

# Derive cache-bust prefix from package.json version and bake it in.
# This ensures each release busts browser caches for the UI.
RUN export CACHE_BUST_PATH_PREFIX=$(bun -e "console.log(require('./package.json').version)") && \
    echo "CACHE_BUST_PATH_PREFIX=$CACHE_BUST_PATH_PREFIX" && \
    CACHE_BUST_PATH_PREFIX=$CACHE_BUST_PATH_PREFIX bun run build && \
    echo "$CACHE_BUST_PATH_PREFIX" > /app/.cache-bust-prefix
ENV CACHE_BUST_PATH_PREFIX=""
# Set the prefix at runtime from the baked-in file
CMD ["sh", "-c", "export CACHE_BUST_PATH_PREFIX=$(cat /app/.cache-bust-prefix) && exec bun run L3-model-server/server.ts"]

EXPOSE 4000
