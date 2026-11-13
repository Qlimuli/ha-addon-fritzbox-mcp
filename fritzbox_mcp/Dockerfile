ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm git

WORKDIR /app

# Clone and build mcp-fritzbox
RUN git clone --depth 1 https://github.com/ghbalf/mcp-fritzbox.git . \
    && npm install \
    && npm run build \
    && npm cache clean --force

# Copy run script
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
