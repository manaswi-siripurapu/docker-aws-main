FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app
COPY Backend/package*.json ./
RUN npm ci --omit=dev
COPY Backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
