#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer } from "http";
import { resolveConfig } from "./types/config.js";
import { AuthProvider } from "./auth/auth-provider.js";
import { SmartHomeClient } from "./client/smart-home.js";
import { TR064Client } from "./client/tr064.js";
import { extendTr064 } from "./client/tr064-extra.js";
import { createMcpServer } from "./server.js";

async function main() {
  const config = resolveConfig(process.argv.slice(2));

  if (!config.fritzbox.username || !config.fritzbox.password) {
    console.error("Error: FRITZBOX_USERNAME and FRITZBOX_PASSWORD must be set");
    process.exit(1);
  }

  const authProvider = new AuthProvider(config.fritzbox);
  const smartHome = new SmartHomeClient(config.fritzbox.host, authProvider);
  const tr064 = extendTr064(new TR064Client(config.fritzbox.host, authProvider));
  const server = createMcpServer(smartHome, tr064);

  if (config.transport === "stdio") {
    await server.connect(new StdioServerTransport());
    return;
  }

  let sseTransport: SSEServerTransport | null = null;
  const json = (res: any, code: number, body: unknown) => {
    res.writeHead(code, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(body, null, 2));
  };

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${config.httpPort}`);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (path === "/health" || path === "/") {
      return json(res, 200, {
        status: "ok",
        service: "mcp-fritzbox",
        version: "1.2.0",
        host: config.fritzbox.host,
      });
    }

    try {
      if (path === "/api/system" && req.method === "GET") return json(res, 200, await tr064.getSystemInfo());
      if (path === "/api/wan" && req.method === "GET") return json(res, 200, await tr064.getWanStatus());
      if (path === "/api/bandwidth" && req.method === "GET") return json(res, 200, await tr064.getBandwidthStats());
      if (path === "/api/log" && req.method === "GET") {
        const count = Number(url.searchParams.get("count") || 40);
        const lines = await tr064.getDeviceLog(count);
        return json(res, 200, { count: lines.length, lines });
      }
      if (path === "/api/devices" && req.method === "GET") {
        const [smartHomeDevices, networkDevices] = await Promise.all([
          smartHome.listDevices().catch(() => []),
          tr064.listNetworkDevices(),
        ]);
        return json(res, 200, { smartHomeDevices, networkDevices });
      }
      if (path === "/api/wlan" && req.method === "GET") return json(res, 200, await tr064.listWlanConfigs());
      if (path === "/api/wlan/clients" && req.method === "GET") {
        const inst = url.searchParams.get("instance");
        return json(res, 200, await tr064.listAssociatedDevices(inst ? Number(inst) : undefined));
      }
      if (path === "/api/wlan/channel" && req.method === "GET") {
        return json(res, 200, await tr064.getChannelInfo(Number(url.searchParams.get("instance") || 2)));
      }
      if (path === "/api/wlan/channel" && req.method === "POST") {
        const body = await readJsonBody(req);
        return json(res, 200, await tr064.setChannel(Number(body.instance ?? 2), Number(body.channel)));
      }
      if (path === "/api/mesh" && req.method === "GET") return json(res, 200, await tr064.getMeshTopology());
      if (path === "/api/lan" && req.method === "GET") return json(res, 200, await tr064.getLanConfig());
      if (path === "/api/lan/stats" && req.method === "GET") return json(res, 200, await tr064.getLanStats());
      if (path === "/api/dsl" && req.method === "GET") return json(res, 200, await tr064.getDslInfo());
      if (path === "/api/update" && req.method === "GET") return json(res, 200, await tr064.getUpdateInfo());
      if (path === "/api/update/check" && req.method === "POST") return json(res, 200, await tr064.checkUpdate());
      if (path === "/api/time" && req.method === "GET") return json(res, 200, await tr064.getBoxTime());
      if (path === "/api/diagnostics" && req.method === "GET")
        return json(res, 200, await tr064.getDiagnosticsSnapshot());
      if (path === "/api/host" && req.method === "GET") {
        const ip = url.searchParams.get("ip");
        const mac = url.searchParams.get("mac");
        if (ip) return json(res, 200, await tr064.getHostByIp(ip));
        if (mac) return json(res, 200, await tr064.getHostByMac(mac));
        return json(res, 400, { error: "Provide ?ip= or ?mac=" });
      }
      if (path === "/api/host/wan-access" && req.method === "GET") {
        const ip = url.searchParams.get("ip");
        if (!ip) return json(res, 400, { error: "Provide ?ip=" });
        return json(res, 200, await tr064.getWanAccessByIp(ip));
      }
      if (path === "/api/host/wan-access" && req.method === "POST") {
        const body = await readJsonBody(req);
        return json(res, 200, await tr064.setWanAccessByIp(String(body.ip), Boolean(body.disallow)));
      }
      if (path === "/api/reboot" && req.method === "POST") {
        return json(res, 200, await tr064.reboot());
      }
    } catch (err: any) {
      return json(res, 500, { error: err?.message || String(err) });
    }

    if (path === "/sse") {
      sseTransport = new SSEServerTransport("/messages", res);
      await server.connect(sseTransport);
      return;
    }
    if (path.startsWith("/messages") && req.method === "POST") {
      if (sseTransport) await sseTransport.handlePostMessage(req, res);
      else {
        res.writeHead(400);
        res.end("No SSE connection established");
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(config.httpPort, () => {
    console.error(`MCP FRITZ!Box server v1.2.0 on http://0.0.0.0:${config.httpPort}`);
    console.error(`REST: /api/{system,wan,wlan,mesh,lan,dsl,update,diagnostics,host,reboot,…}`);
  });
}

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
