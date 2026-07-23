FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

ENV PORT=8787
ENV DB_PATH=/data/calibration.sqlite

EXPOSE 8787
VOLUME ["/data"]

CMD ["pnpm", "exec", "tsx", "index.ts"]
