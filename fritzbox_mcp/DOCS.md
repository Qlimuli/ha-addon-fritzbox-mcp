# FRITZ!Box MCP Server

## Configuration

| Option | Description |
|--------|-------------|
| host | Hostname or IP of the FRITZ!Box (default: fritz.box) |
| username | FRITZ!Box username |
| password | FRITZ!Box password |
| port | Port the MCP server listens on (default: 3000) |

Create a dedicated user in the FRITZ!Box under System → FRITZ!Box Users and grant:
- Smart Home
- FRITZ!Box Settings

## Available tools (via MCP)

- list_devices
- set_thermostat
- toggle_switch
- get_device_stats
- get_system_info
- get_wan_status
- get_bandwidth_stats
- toggle_guest_wifi
- get_device_log
- reconnect_wan

See the upstream project for full details.
