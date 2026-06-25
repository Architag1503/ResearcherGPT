FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN apk add --no-cache chromium

RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
