import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SmartHomeClient } from "./client/smart-home.js";
import { TR064Client } from "./client/tr064.js";
import {
  FritzAuthError,
  FritzConnectionError,
  FritzDeviceNotFoundError,
  FritzInvalidParameterError,
} from "./types/errors.js";

export function createMcpServer(
  smartHome: SmartHomeClient,
  tr064: TR064Client
): McpServer {
  const server = new McpServer({
    name: "mcp-fritzbox",
    version: "1.1.0",
  });

  server.tool(
    "list_devices",
    "List all smart home actors and network devices connected to the FRITZ!Box",
    {},
    async () => {
      try {
        const [smartHomeDevices, networkDevices] = await Promise.all([
          smartHome.listDevices(),
          tr064.listNetworkDevices(),
        ]);
        return ok({ smartHomeDevices, networkDevices });
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "set_thermostat",
    "Set the target temperature on a FRITZ!DECT thermostat",
    {
      ain: z.string().describe("Actor Identification Number of the thermostat"),
      temperature: z
        .union([z.enum(["ON", "OFF"]), z.coerce.number()])
        .describe("Target temperature in °C (8.0–28.0), or 'ON' / 'OFF'"),
    },
    async ({ ain, temperature }) => {
      try {
        return ok(await smartHome.setThermostat(ain, temperature));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "toggle_switch",
    "Turn a FRITZ!DECT smart plug on or off",
    {
      ain: z.string().describe("Actor Identification Number of the switch"),
      state: z.boolean().describe("true = on, false = off"),
    },
    async ({ ain, state }) => {
      try {
        return ok(await smartHome.toggleSwitch(ain, state));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "get_device_stats",
    "Get temperature history or energy consumption statistics for a smart home device",
    { ain: z.string().describe("Actor Identification Number of the device") },
    async ({ ain }) => {
      try {
        return ok(await smartHome.getDeviceStats(ain));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "get_system_info",
    "Get FRITZ!Box system information including model, firmware version, and serial number",
    {},
    async () => {
      try {
        return ok(await tr064.getSystemInfo());
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "get_wan_status",
    "Get WAN connection status including external IP, uptime, and link state",
    {},
    async () => {
      try {
        return ok(await tr064.getWanStatus());
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "get_bandwidth_stats",
    "Get total bandwidth usage and max line rates",
    {},
    async () => {
      try {
        return ok(await tr064.getBandwidthStats());
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "toggle_guest_wifi",
    "Enable or disable the FRITZ!Box guest WiFi network",
    { enable: z.boolean().describe("true = enable, false = disable") },
    async ({ enable }) => {
      try {
        return ok(await tr064.toggleGuestWifi(enable));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "get_device_log",
    "Get recent FRITZ!Box system log entries (useful for DFS/radar and WLAN events)",
    {
      count: z
        .number()
        .optional()
        .default(40)
        .describe("Number of log entries to return (default: 40)"),
    },
    async ({ count }) => {
      try {
        return ok(await tr064.getDeviceLog(count));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "reconnect_wan",
    "Force a WAN reconnect to obtain a new external IP address",
    {},
    async () => {
      try {
        return ok(await tr064.reconnectWan());
      } catch (error) {
        return handleError(error);
      }
    }
  );

  // --- WLAN / Mesh diagnostics (core for unstable 5 GHz / Mesh issues) ---

  server.tool(
    "get_wlan_info",
    "List WLAN radios on the FRITZ!Box (2.4 / 5 GHz / guest): SSID, channel, auto-channel, DFS heuristic, BSSID",
    {},
    async () => {
      try {
        return ok(await tr064.listWlanConfigs());
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "get_channel_info",
    "Get channel details for one WLANConfiguration instance (1=2.4GHz, 2=5GHz typical)",
    {
      instance: z
        .number()
        .int()
        .min(1)
        .max(4)
        .describe("WLANConfiguration instance: 1=2.4GHz, 2=5GHz, 3=guest"),
    },
    async ({ instance }) => {
      try {
        return ok(await tr064.getChannelInfo(instance));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "set_wlan_channel",
    "Set a fixed WLAN channel on the main FRITZ!Box radio (disables auto-channel for that band). Prefer non-DFS 5 GHz channels 36–48. Mesh repeaters usually follow the master; per-repeater channel control is not reliably available via TR-064.",
    {
      instance: z
        .number()
        .int()
        .min(1)
        .max(4)
        .describe("WLANConfiguration instance: 1=2.4GHz, 2=5GHz"),
      channel: z
        .number()
        .int()
        .min(1)
        .max(196)
        .describe("Target channel (e.g. 36, 40, 44, 48 for non-DFS 5 GHz)"),
    },
    async ({ instance, channel }) => {
      try {
        return ok(await tr064.setChannel(instance, channel));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "set_wlan_enable",
    "Enable or disable a WLAN radio instance on the FRITZ!Box",
    {
      instance: z.number().int().min(1).max(4),
      enable: z.boolean(),
    },
    async ({ instance, enable }) => {
      try {
        return ok(await tr064.setWlanEnable(instance, enable));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "list_wlan_clients",
    "List Wi‑Fi clients associated to the FRITZ!Box APs with signal strength and link speed (helps explain 'waiting for better quality')",
    {
      instance: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe("Optional: limit to one WLAN instance; omit for all"),
    },
    async ({ instance }) => {
      try {
        return ok(await tr064.listAssociatedDevices(instance));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "get_mesh_topology",
    "Fetch FRITZ! Mesh topology JSON (repeaters, links, nodes). Primary diagnostic for Mesh/Repeater instability.",
    {},
    async () => {
      try {
        return ok(await tr064.getMeshTopology());
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.tool(
    "wake_on_lan",
    "Send Wake-on-LAN to a host by MAC address via the FRITZ!Box",
    {
      mac: z.string().describe("MAC address, e.g. AA:BB:CC:DD:EE:FF"),
    },
    async ({ mac }) => {
      try {
        return ok(await tr064.wakeOnLan(mac));
      } catch (error) {
        return handleError(error);
      }
    }
  );

  return server;
}

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function handleError(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  if (
    error instanceof FritzDeviceNotFoundError ||
    error instanceof FritzInvalidParameterError
  ) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error.code,
              message: error.message,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (error instanceof FritzAuthError) {
    return {
      content: [
        {
          type: "text",
          text: `Authentication failed: ${error.message}. Check FRITZBOX_USERNAME and FRITZBOX_PASSWORD.`,
        },
      ],
      isError: true,
    };
  }

  if (error instanceof FritzConnectionError) {
    return {
      content: [
        {
          type: "text",
          text: `Connection failed: ${error.message}. Verify FRITZBOX_HOST is reachable.`,
        },
      ],
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `Unexpected error: ${message}` }],
    isError: true,
  };
}
