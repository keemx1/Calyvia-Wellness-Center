FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm ci

# Guarantee the nested workspace node_modules dir exists: npm hoists
# differently across versions, and a missing COPY source fails the build.
RUN mkdir -p /app/apps/api/node_modules

COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

RUN npm run build --workspace=@calyvia/shared
RUN npm run build --workspace=@calyvia/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
# Workspace deps that npm nests under apps/api (e.g. @whiskeysockets/baileys and
# its exclusive transitive deps) are NOT hoisted to /app/node_modules. Without
# this line the runner crashes on dynamic import at first WhatsApp use.
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Brand letterhead used as the base page for generated invoice PDFs.
COPY --from=builder /app/apps/api/assets ./apps/api/assets
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
