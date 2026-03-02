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

# Default: run tests
CMD ["bun", "test", "--bail"]
