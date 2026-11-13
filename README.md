# Home Assistant Add-on: FRITZ!Box MCP Server

Repository for the **FRITZ!Box MCP Server** Home Assistant add-on.

This add-on provides a [Model Context Protocol](https://modelcontextprotocol.io/) server so AI assistants (Claude, ChatGPT, Cursor, etc.) can control and query your AVM FRITZ!Box router and its smart-home devices.

## Quick install

1. In Home Assistant go to **Settings → Add-ons → Add-on store → ⋮ → Repositories**
2. Add: `https://github.com/Qlimuli/ha-addon-fritzbox-mcp`
3. Install **FRITZ!Box MCP Server**
4. Configure host, username and password of a FRITZ!Box user that has Smart Home + Settings rights
5. Start the add-on

The MCP HTTP/SSE endpoint will be available on port 3000 (configurable).

Based on [ghbalf/mcp-fritzbox](https://github.com/ghbalf/mcp-fritzbox) (MIT).
