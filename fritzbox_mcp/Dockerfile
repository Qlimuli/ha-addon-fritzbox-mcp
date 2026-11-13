ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.20
FROM $BUILD_FROM

ENV LANG=C.UTF-8

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Node.js and build tools
RUN apk add --no-cache \
    nodejs \
    npm \
    git \
    python3 \
    make \
    g++ \
    bash \
    curl \
    jq \
    && node --version \
    && npm --version \
    && git --version

WORKDIR /app

# Clone and build mcp-fritzbox
RUN git clone --depth 1 https://github.com/ghbalf/mcp-fritzbox.git /tmp/mcp-fritzbox \
    && cp -a /tmp/mcp-fritzbox/. /app/ \
    && rm -rf /tmp/mcp-fritzbox \
    && npm install \
    && npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force \
    && rm -rf /root/.npm node_modules/.cache

COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
