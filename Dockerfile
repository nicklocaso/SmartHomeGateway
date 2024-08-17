FROM node:20.9.0

WORKDIR /app

RUN npm install -g pnpm@9.7.1

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

# EXPOSE 3000

CMD ["pnpm", "start"]
