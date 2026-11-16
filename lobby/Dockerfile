# Imagen del lobby: sirve el cliente web y hace el matchmaking con Agones.
#   docker build -f lobby/Dockerfile -t astro-lobby .
FROM node:22-alpine

WORKDIR /app
COPY lobby/package.json lobby/package-lock.json lobby/
RUN cd lobby && npm ci --omit=dev && npm cache clean --force

COPY shared/ shared/
COPY client/ client/
COPY lobby/src/ lobby/src/

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080
USER node
CMD ["node", "lobby/src/index.js"]
