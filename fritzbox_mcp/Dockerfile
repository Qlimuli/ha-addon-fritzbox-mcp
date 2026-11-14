ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.20
FROM $BUILD_FROM

ENV LANG=C.UTF-8

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    bash \
    curl \
    jq \
    && node --version \
    && npm --version

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install \
    && npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force \
    && rm -rf /root/.npm node_modules/.cache src

COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
