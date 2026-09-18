FROM node:20-alpine AS backend
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
COPY web/js/data ./web/js/data
ENV NODE_ENV=production
ENV PORT=8080
ENV SERVE_WEB=0
ENV DB_DRIVER=postgres
EXPOSE 8080
CMD ["node", "server/src/index.js"]

FROM nginx:1.27-alpine AS web
COPY deploy/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY privacy.html /usr/share/nginx/html/privacy.html
COPY manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest
COPY .well-known /usr/share/nginx/html/.well-known
COPY web /usr/share/nginx/html/web
COPY assets /usr/share/nginx/html/assets
EXPOSE 80
