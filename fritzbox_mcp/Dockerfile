ARG BUILD_FROM
FROM $BUILD_FROM

ENV LANG=C.UTF-8

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
    jq

WORKDIR /app

# Clone mcp-fritzbox
RUN git clone --depth 1 https://github.com/ghbalf/mcp-fritzbox.git /tmp/mcp-fritzbox \
    && cp -a /tmp/mcp-fritzbox/. /app/ \
    && rm -rf /tmp/mcp-fritzbox \
    && npm install --omit=dev \
    && npm run build \
    && npm cache clean --force \
    && rm -rf node_modules/.cache /root/.npm

# Copy run script
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
