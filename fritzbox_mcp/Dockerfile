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
    && rm -rf /tmp/mcp-fritzbox

# Patch getDeviceLog to be more robust (try multiple TR-064 actions)
RUN python3 - <<'PY'
from pathlib import Path
p = Path("/app/src/client/tr064.ts")
text = p.read_text()
old = '''  async getDeviceLog(count = 20): Promise<string[]> {
    // GetDeviceLog is an action on DeviceInfo:1, not a separate service
    const result = await this.soapCall(
      "DeviceInfo:1",
      "GetDeviceLog",
      "/upnp/control/deviceinfo"
    );
    const lines = String(result.NewDeviceLog).split("\n").filter(Boolean);
    return lines.slice(0, count);
  }'''
new = '''  async getDeviceLog(count = 20): Promise<string[]> {
    // Try several known TR-064 log actions – FRITZ!OS versions differ
    const attempts: Array<{ service: string; action: string; path: string; field: string }> = [
      { service: "DeviceInfo:1", action: "GetDeviceLog", path: "/upnp/control/deviceinfo", field: "NewDeviceLog" },
      { service: "DeviceInfo:1", action: "X_AVM-DE_GetDeviceLog", path: "/upnp/control/deviceinfo", field: "NewDeviceLog" },
      { service: "DeviceInfo:1", action: "X_AVM-DE_GetDeviceLogPath", path: "/upnp/control/deviceinfo", field: "NewDeviceLogPath" },
    ];

    let lastError: unknown;
    for (const a of attempts) {
      try {
        const result = await this.soapCall(a.service, a.action, a.path);
        const raw = result[a.field] ?? result.NewDeviceLog ?? result.NewX_AVM_DE_DeviceLog ?? "";
        if (typeof raw === "string" && raw.length > 0) {
          // If we got a path instead of content, return a helpful message
          if (a.action.includes("LogPath") && raw.startsWith("/")) {
            return [`[info] Log path returned: ${raw} (content fetch not implemented in this version)`];
          }
          const lines = String(raw).split("\n").filter(Boolean);
          return lines.slice(0, count);
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new Error("All GetDeviceLog attempts failed");
  }'''
if old in text:
    p.write_text(text.replace(old, new))
    print("Patched getDeviceLog successfully")
else:
    print("WARNING: could not find exact getDeviceLog block – leaving original")
PY

# Also add a simple /health endpoint by patching index.ts
RUN python3 - <<'PY'
from pathlib import Path
p = Path("/app/src/index.ts")
text = p.read_text()
old = '''    const httpServer = createServer(async (req, res) => {
      if (req.url === "/sse") {
        sseTransport = new SSEServerTransport("/messages", res);
        await server.connect(sseTransport);
      } else if (req.url?.startsWith("/messages") && req.method === "POST") {
        if (sseTransport) {
          await sseTransport.handlePostMessage(req, res);
        } else {
          res.writeHead(400);
          res.end("No SSE connection established");
        }
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });'''
new = '''    const httpServer = createServer(async (req, res) => {
      if (req.url === "/health" || req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", service: "mcp-fritzbox", host: config.fritzbox.host }));
        return;
      }
      if (req.url === "/sse") {
        sseTransport = new SSEServerTransport("/messages", res);
        await server.connect(sseTransport);
      } else if (req.url?.startsWith("/messages") && req.method === "POST") {
        if (sseTransport) {
          await sseTransport.handlePostMessage(req, res);
        } else {
          res.writeHead(400);
          res.end("No SSE connection established");
        }
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });'''
if old in text:
    p.write_text(text.replace(old, new))
    print("Patched health endpoint successfully")
else:
    print("WARNING: could not patch health endpoint")
PY

RUN npm install \
    && npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force \
    && rm -rf /root/.npm node_modules/.cache

COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
