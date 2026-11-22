FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/db ./packages/db
COPY apps/api ./apps/api
RUN corepack enable && pnpm install --filter @frame/api... && pnpm --filter @frame/db build && pnpm --filter @frame/api build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/packages/db/dist ../db/dist
COPY --from=build /app/packages/db/package.json ../db/package.json
COPY --from=build /app/node_modules ../node_modules
EXPOSE 4100
CMD ["node", "dist/server.js"]
