# Home Assistant Add-on: FRITZ!Box MCP Server

MCP + REST for AVM FRITZ!Box — Smart Home, WAN, WLAN/Mesh, HostFilter, DSL, diagnostics.

## Install

1. Add repository: `https://github.com/Qlimuli/ha-addon-fritzbox-mcp`
2. Install **FRITZ!Box MCP Server** (v1.2.0+)
3. Configure host + user (Smart Home + Settings)
4. Port **3000**

## Quick diagnostics

```bash
curl http://homeassistant.local:3000/api/diagnostics
curl http://homeassistant.local:3000/api/wlan
curl http://homeassistant.local:3000/api/mesh
```

See `fritzbox_mcp/README.md` for the full tool list.
