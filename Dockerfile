FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
ENV SERVE_WEB=1
ENV DB_DRIVER=postgres
EXPOSE 8080

CMD ["node", "server/src/index.js"]
