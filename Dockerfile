# Build stage
FROM node:22-slim AS build
WORKDIR /app

# Copy dependency specifications first to leverage Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build args for public Vite configuration (VITE_ prefixed)
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_FIRESTORE_DATABASE_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_OAUTH_CLIENT_ID
ARG VITE_GOOGLE_MAPS_CLIENT_ID

ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_FIRESTORE_DATABASE_ID=$VITE_FIREBASE_FIRESTORE_DATABASE_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_OAUTH_CLIENT_ID=$VITE_FIREBASE_OAUTH_CLIENT_ID \
    VITE_GOOGLE_MAPS_CLIENT_ID=$VITE_GOOGLE_MAPS_CLIENT_ID

# Compile TypeScript server & build Vite production bundle
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
