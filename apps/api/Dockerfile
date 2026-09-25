# syntax=docker/dockerfile:1
# FinPilot API: build context is the repository root.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# ---- build: install, compile, then produce a production-only bundle --------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @finpilot/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @finpilot/api... build
# Self-contained folder: package.json, dist/ and production node_modules only.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @finpilot/api deploy --prod --legacy /out

# ---- runtime ----------------------------------------------------------------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Migrations and the supplied CSVs, for the one-off migrate/seed job.
COPY --chown=node:node db/migrations ./db/migrations
COPY --chown=node:node data/raw ./data/raw
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.js"]
