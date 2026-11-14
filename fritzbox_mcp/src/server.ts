import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SmartHomeClient } from "./client/smart-home.js";
import type { TR064Client } from "./client/tr064.js";
import type { Tr064Extra } from "./client/tr064-extra.js";
import {
  FritzAuthError,
  FritzConnectionError,
  FritzDeviceNotFoundError,
  FritzInvalidParameterError,
} from "./types/errors.js";

type FullTr064 = TR064Client & Tr064Extra;

export function createMcpServer(smartHome: SmartHomeClient, tr064: FullTr064): McpServer {
  const server = new McpServer({ name: "mcp-fritzbox", version: "1.2.0" });

  const tool = (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    fn: (args: any) => Promise<unknown>
  ) => {
    server.tool(name, description, schema, async (args) => {
      try {
        return ok(await fn(args));
      } catch (error) {
        return handleError(error);
      }
    });
  };

  tool("list_devices", "List smart home actors and network devices", {}, async () => ({
    smartHomeDevices: await smartHome.listDevices(),
    networkDevices: await tr064.listNetworkDevices(),
  }));

  tool(
    "set_thermostat",
    "Set FRITZ!DECT thermostat target temperature",
    {
      ain: z.string(),
      temperature: z.union([z.enum(["ON", "OFF"]), z.coerce.number()]),
    },
    ({ ain, temperature }) => smartHome.setThermostat(ain, temperature)
  );

  tool(
    "toggle_switch",
    "Turn FRITZ!DECT switch on/off",
    { ain: z.string(), state: z.boolean() },
    ({ ain, state }) => smartHome.toggleSwitch(ain, state)
  );

  tool("get_device_stats", "Smart home device statistics", { ain: z.string() }, ({ ain }) =>
    smartHome.getDeviceStats(ain)
  );

  tool("get_system_info", "Model, firmware, serial", {}, () => tr064.getSystemInfo());
  tool("get_wan_status", "WAN IP and link status", {}, () => tr064.getWanStatus());
  tool("get_bandwidth_stats", "Bandwidth counters and line rates", {}, () =>
    tr064.getBandwidthStats()
  );
  tool("toggle_guest_wifi", "Enable/disable guest WiFi", { enable: z.boolean() }, ({ enable }) =>
    tr064.toggleGuestWifi(enable)
  );
  tool(
    "get_device_log",
    "System log (DFS/WLAN events)",
    { count: z.number().optional().default(40) },
    ({ count }) => tr064.getDeviceLog(count)
  );
  tool("reconnect_wan", "Force WAN reconnect / new external IP", {}, () => tr064.reconnectWan());

  tool("get_wlan_info", "All WLAN radios: channel, auto-channel, DFS heuristic", {}, () =>
    tr064.listWlanConfigs()
  );
  tool(
    "get_channel_info",
    "Channel details for one WLAN instance",
    { instance: z.number().int().min(1).max(4) },
    ({ instance }) => tr064.getChannelInfo(instance)
  );
  tool(
    "set_wlan_channel",
    "Fixed channel on main box (prefer 5 GHz 36–48 non-DFS). Mesh repeaters usually follow master.",
    { instance: z.number().int().min(1).max(4), channel: z.number().int().min(1).max(196) },
    ({ instance, channel }) => tr064.setChannel(instance, channel)
  );
  tool(
    "set_wlan_enable",
    "Enable/disable one WLAN radio",
    { instance: z.number().int().min(1).max(4), enable: z.boolean() },
    ({ instance, enable }) => tr064.setWlanEnable(instance, enable)
  );
  tool(
    "list_wlan_clients",
    "Associated WiFi clients with signal/speed",
    { instance: z.number().int().min(1).max(4).optional() },
    ({ instance }) => tr064.listAssociatedDevices(instance)
  );
  tool("get_mesh_topology", "Mesh topology JSON", {}, () => tr064.getMeshTopology());
  tool("wake_on_lan", "WoL by MAC", { mac: z.string() }, ({ mac }) => tr064.wakeOnLan(mac));

  tool("get_lan_config", "DHCP range, DNS, subnet", {}, () => tr064.getLanConfig());
  tool("get_lan_stats", "LAN interface byte/packet counters", {}, () => tr064.getLanStats());
  tool("get_dsl_info", "DSL rates, SNR, attenuation (empty on cable/fiber)", {}, () =>
    tr064.getDslInfo()
  );
  tool("get_update_info", "Firmware update availability", {}, () => tr064.getUpdateInfo());
  tool("check_update", "Trigger firmware update check", {}, () => tr064.checkUpdate());
  tool("get_box_time", "NTP / local time on the box", {}, () => tr064.getBoxTime());

  tool(
    "get_host",
    "Lookup one host by IP or MAC",
    { ip: z.string().optional(), mac: z.string().optional() },
    async ({ ip, mac }) => {
      if (ip) return tr064.getHostByIp(ip);
      if (mac) return tr064.getHostByMac(mac);
      throw new FritzInvalidParameterError("Provide ip or mac");
    }
  );
  tool(
    "get_wan_access",
    "Whether a host IP is allowed WAN access",
    { ip: z.string() },
    ({ ip }) => tr064.getWanAccessByIp(ip)
  );
  tool(
    "set_wan_access",
    "Block or allow WAN access for a host IP (HostFilter)",
    { ip: z.string(), disallow: z.boolean().describe("true = block Internet") },
    ({ ip, disallow }) => tr064.setWanAccessByIp(ip, disallow)
  );
  tool(
    "set_host_name",
    "Set friendly hostname by MAC",
    { mac: z.string(), name: z.string() },
    ({ mac, name }) => tr064.setHostFriendlyName(mac, name)
  );

  tool(
    "get_wlan_night_control",
    "WLAN night schedule status",
    { instance: z.number().int().min(1).max(4).optional() },
    ({ instance }) => tr064.getWlanNightControl(instance)
  );
  tool(
    "set_wlan_global_enable",
    "Global WLAN on/off (like physical WLAN button)",
    { enable: z.boolean() },
    ({ enable }) => tr064.setWlanGlobalEnable(enable)
  );
  tool(
    "start_wps",
    "Start WPS push-button pairing",
    { instance: z.number().int().min(1).max(4).optional().default(1) },
    ({ instance }) => tr064.startWps(instance)
  );

  tool(
    "reboot_box",
    "Reboot the FRITZ!Box (brief outage)",
    {},
    () => tr064.reboot()
  );

  tool(
    "get_diagnostics",
    "One-shot snapshot: system, WAN, WLAN, clients, mesh, DSL, log, update + hints for DFS/auto-channel/weak signal",
    {},
    () => tr064.getDiagnosticsSnapshot()
  );

  return server;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function handleError(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  if (error instanceof FritzDeviceNotFoundError || error instanceof FritzInvalidParameterError) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.code, message: error.message }, null, 2) }],
    };
  }
  if (error instanceof FritzAuthError) {
    return {
      content: [{ type: "text", text: `Authentication failed: ${error.message}` }],
      isError: true,
    };
  }
  if (error instanceof FritzConnectionError) {
    return {
      content: [{ type: "text", text: `Connection failed: ${error.message}` }],
      isError: true,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `Unexpected error: ${message}` }], isError: true };
}
