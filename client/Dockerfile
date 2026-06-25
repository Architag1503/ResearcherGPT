FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .

EXPOSE 3000

# Next.js development server running port
CMD ["npm", "run", "dev"]
