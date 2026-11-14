# FRITZ!Box MCP Server Add-on (v1.2.0)

MCP + REST for AVM FRITZ!Box: Smart Home, WAN, **WLAN/Mesh**, **HostFilter**, DSL/LAN, reboot, firmware check, diagnostics.

## New in 1.2.0

| Capability | MCP tool | REST |
|------------|----------|------|
| Diagnostics snapshot | `get_diagnostics` | `GET /api/diagnostics` |
| Block/allow Internet per IP | `set_wan_access` / `get_wan_access` | `POST/GET /api/host/wan-access` |
| Host by IP/MAC | `get_host` | `GET /api/host?ip=` / `?mac=` |
| LAN DHCP config / stats | `get_lan_config` / `get_lan_stats` | `/api/lan`, `/api/lan/stats` |
| DSL line quality | `get_dsl_info` | `/api/dsl` |
| Firmware update info | `get_update_info` / `check_update` | `/api/update`, `POST /api/update/check` |
| Box time / NTP | `get_box_time` | `/api/time` |
| Global WLAN button | `set_wlan_global_enable` | — |
| WPS PBC | `start_wps` | — |
| Night control | `get_wlan_night_control` | — |
| Reboot | `reboot_box` | `POST /api/reboot` |

Still in 1.1: WLAN channel set/get, clients+signal, mesh topology, log, WAN, smart home.

## Limits (TR-064)

- Per-repeater channel / auto-scan: **not** fully controllable → FRITZ! UI for stubborn Mesh nodes.
- DSL endpoints empty on pure cable/fiber models.
- `reboot` / WAN block are disruptive — use deliberately.

## Install

Repository `https://github.com/Qlimuli/ha-addon-fritzbox-mcp` → install **FRITZ!Box MCP Server** ≥ 1.2.0.

User needs **Smart Home** + **FRITZ!Box Settings**; enable application access (TR-064) if required.
