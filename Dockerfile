FROM node:24-alpine@sha256:91aa1bb6b5f57ec5109155332f4af2aa5d73ff7b4512c8e5dfce5dc88dbbae0e

WORKDIR /app

COPY package*.json ./

# npm ci honours the lockfile, matching what CI installs. sharp resolves its
# musl prebuilt binary here, which is why node_modules must not be mounted over.
RUN npm ci

EXPOSE 8000

CMD ["node", "serve.js"]
