# ---------- build stage ----------
FROM node:20-slim AS build
WORKDIR /app

# Install OpenSSL and CA certs for Prisma downloads and linking
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
# Generate Prisma client for the targets defined in schema.prisma
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# ---------- runtime stage ----------
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Runtime also needs openssl for the Prisma engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app ./
EXPOSE 3000
CMD ["npm","run","start:prod:db"]
