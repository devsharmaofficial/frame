FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/web ./apps/web
RUN corepack enable && pnpm install --filter @frame/web && pnpm --filter @frame/web build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web ./
EXPOSE 3200
CMD ["npm", "run", "start", "--", "-p", "3200"]
