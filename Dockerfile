FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=5173

WORKDIR /app

COPY package.json ./
COPY index.html ./
COPY css ./css
COPY js ./js
COPY assets ./assets
COPY tools ./tools

EXPOSE 5173

USER node

CMD ["node", "tools/serve.mjs"]
