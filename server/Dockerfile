# Imagen del servidor de juego (se construye desde la raíz del repositorio):
#   docker build -f server/Dockerfile -t astro-gameserver .
FROM node:22-alpine

WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

COPY shared/ shared/
COPY server/src/ server/src/

ENV NODE_ENV=production \
    PORT=7777 \
    METRICS_PORT=9100

EXPOSE 7777 9100
USER node
CMD ["node", "server/src/index.js"]
