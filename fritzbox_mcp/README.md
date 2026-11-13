# FRITZ!Box MCP Server Add-on

This Home Assistant add-on runs an MCP (Model Context Protocol) server for your AVM FRITZ!Box router.

It is based on [ghbalf/mcp-fritzbox](https://github.com/ghbalf/mcp-fritzbox).

## Features

- Smart Home control (thermostats, switches)
- Network & WAN status
- Bandwidth statistics
- Guest WiFi toggle
- Device log
- WAN reconnect

## Installation

1. Add this repository to Home Assistant:
   `https://github.com/Qlimuli/ha-addon-fritzbox-mcp`

2. Install the **FRITZ!Box MCP Server** add-on.

3. Configure:
   - **host**: usually `fritz.box` or the IP of your router
   - **username** / **password**: a FRITZ!Box user with "Smart Home" and "FRITZ!Box Settings" permissions
   - **port**: default 3000

4. Start the add-on.

## Connecting an MCP Client

The server exposes HTTP/SSE on the configured port (default 3000).

SSE endpoint: `http://<homeassistant-ip>:3000/sse`  
Messages: `http://<homeassistant-ip>:3000/messages`

Example for Claude Desktop / mcp-remote:

```json
{
  "mcpServers": {
    "fritzbox": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://homeassistant.local:3000/sse", "--allow-http"]
    }
  }
}
```

## Requirements

- FRITZ!OS 8.20+ recommended
- A dedicated FRITZ!Box user with the necessary permissions
