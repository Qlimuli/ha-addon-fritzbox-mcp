# Home Assistant Add-on: FRITZ!Box MCP Server

MCP + REST interface for AVM FRITZ!Box routers: Smart Home, WAN, system log, **WLAN channels**, associated clients with signal, and **Mesh topology**.

## Quick install

1. **Settings → Add-ons → Add-on store → ⋮ → Repositories**
2. Add: `https://github.com/Qlimuli/ha-addon-fritzbox-mcp`
3. Install **FRITZ!Box MCP Server** (v1.1.0+)
4. Configure host, username, password (Smart Home + Settings rights)
5. Start the add-on — port **3000**

## Diagnose unstable 5 GHz / Mesh

```bash
curl http://homeassistant.local:3000/api/wlan
curl http://homeassistant.local:3000/api/mesh
curl http://homeassistant.local:3000/api/wlan/clients
curl -X POST http://homeassistant.local:3000/api/wlan/channel \
  -H 'Content-Type: application/json' \
  -d '{"instance":2,"channel":36}'
```

See `fritzbox_mcp/README.md` for full tool and REST documentation.

Inspired by [ghbalf/mcp-fritzbox](https://github.com/ghbalf/mcp-fritzbox) (MIT).
