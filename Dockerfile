# Build stage
FROM node:22-slim AS build
WORKDIR /app

# Copy dependency specifications first to leverage Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Public Firebase/Maps client configuration is sourced at build time from the
# committed firebase-applet-config.json (imported by src/services/firebase.ts)
# and baked into the Vite browser bundle. It is deliberately NOT declared here
# as ARG/ENV: those vary nothing on any current build path (no build args are
# passed in CI) and the key names trip Docker's SecretsUsedInArgOrEnv check.
# Server-side secrets are none of these - they are runtime-only process.env
# values injected via Cloud Run Secret Manager (Gemini/Maps API keys, admin
# emails, service-account JSON) and never enter this Dockerfile.
#
# G3 semantic retrieval client gate (Vite build-time). Default off; the deploy
# pipeline passes --build-arg VITE_ENABLE_SEMANTIC_RETRIEVAL=true for the
# production image only so the browser bundle enables G3 client calls there.
ARG VITE_ENABLE_SEMANTIC_RETRIEVAL=false
ENV VITE_ENABLE_SEMANTIC_RETRIEVAL=$VITE_ENABLE_SEMANTIC_RETRIEVAL
RUN npm run build

# Runtime stage
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy package files & install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy built frontend assets and server bundle
COPY --from=build /app/dist ./dist

# Use non-root node user for container security
USER node

EXPOSE 3000 8080

CMD ["node", "dist/server.cjs"]
