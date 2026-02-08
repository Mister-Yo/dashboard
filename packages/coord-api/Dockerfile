FROM node:22-alpine

WORKDIR /app
COPY packages/coord-api/server.js ./server.js

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
