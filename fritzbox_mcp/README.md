# FRITZ!Box MCP Server Add-on

Home Assistant add-on providing an MCP (Model Context Protocol) server plus a simple REST API for AVM FRITZ!Box routers.

Based on the architecture of [ghbalf/mcp-fritzbox](https://github.com/ghbalf/mcp-fritzbox) (MIT), extended with full TR-064 WLAN/Mesh diagnostics for real-world Mesh instability (DFS, auto-channel, weak 5 GHz).

## Features

| Area | Capabilities |
|------|----------------|
| Smart Home | List devices, thermostat, switch, stats |
| WAN | Status, bandwidth, reconnect |
| System | Model/firmware, device log |
| WLAN | Radios, channel/auto-channel/DFS heuristic, set fixed channel, associated clients + signal |
| Mesh | Topology JSON via `X_AVM-DE_GetMeshListPath` |
| Misc | Guest WiFi, Wake-on-LAN |

## Important TR-064 limits

- **Fixed 5 GHz channel** on the **main box** works via `WLANConfiguration:2` → `SetChannel` (e.g. 36–48, non-DFS).
- **Mesh repeaters** usually **follow the master**. Per-repeater auto-channel/DFS is **not** cleanly controllable over TR-064 — use the FRITZ! UI for stubborn repeaters (e.g. Repeater04).
- Signal quality messages like *“waiting for better quality”* correlate with low `signalStrength` on `list_wlan_clients` and/or DFS/auto-channel churn in the log/Mesh topology.

## Installation

1. Add repository: `https://github.com/Qlimuli/ha-addon-fritzbox-mcp`
2. Install **FRITZ!Box MCP Server**
3. Configure host (`fritz.box` or IP), user with **Smart Home** + **FRITZ!Box Settings**, port `3000`
4. Start the add-on

## REST API (no SSE required)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness |
| `/api/system` | GET | Model / firmware |
| `/api/wan` | GET | WAN status |
| `/api/bandwidth` | GET | Counters / rates |
| `/api/log?count=N` | GET | System log |
| `/api/devices` | GET | Smart home + hosts |
| `/api/wlan` | GET | All WLAN radios |
| `/api/wlan/channel?instance=2` | GET | Channel info |
| `/api/wlan/channel` | POST | `{ "instance": 2, "channel": 36 }` |
| `/api/wlan/clients` | GET | Associated clients |
| `/api/mesh` | GET | Mesh topology JSON |

## MCP tools

`list_devices`, `set_thermostat`, `toggle_switch`, `get_device_stats`, `get_system_info`, `get_wan_status`, `get_bandwidth_stats`, `toggle_guest_wifi`, `get_device_log`, `reconnect_wan`, `get_wlan_info`, `get_channel_info`, `set_wlan_channel`, `set_wlan_enable`, `list_wlan_clients`, `get_mesh_topology`, `wake_on_lan`

SSE: `http://<ha-ip>:3000/sse`
