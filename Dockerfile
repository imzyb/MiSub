FROM node:20-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm install

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# 端口配置：默认8080与本地/VPS文档一致，平台可通过环境变量覆盖
ARG PORT=8080
ENV NODE_ENV=production
ENV PORT=${PORT}

RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN addgroup --system misub && adduser --system --ingroup misub misub
RUN mkdir -p /app/data && chown -R misub:misub /app/data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/functions ./functions
COPY --from=build /app/server ./server
COPY --from=build /app/schema.sql ./schema.sql
COPY --from=build /app/src/shared ./src/shared
COPY --from=build /app/package.json ./package.json

# 确保非 root 用户对数据目录有写权限
RUN chown -R misub:misub /app

USER misub

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:${PORT}/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# 暴露端口（与 ARG PORT 同步）
EXPOSE ${PORT}
CMD ["node", "server/index.mjs"]
