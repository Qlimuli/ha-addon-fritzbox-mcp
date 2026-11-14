# FRITZ!Box MCP Server

## Configuration

| Option | Description |
|--------|-------------|
| host | Hostname or IP (default: `fritz.box`) |
| username | FRITZ!Box user |
| password | Password |
| port | Listen port (default: 3000) |

Create a dedicated user under **System → FRITZ!Box Users** with:

- Smart Home
- FRITZ!Box Settings

Also enable **Heimnetz → Netzwerk → Netzwerkeinstellungen → Zugriff für Anwendungen zulassen** (TR-064) if needed.

## WLAN instances (typical)

| Instance | Role |
|----------|------|
| 1 | 2.4 GHz main |
| 2 | 5 GHz main |
| 3 | Guest |

## Recommended fix for DFS / unstable 5 GHz

1. `GET /api/wlan` — check `autoChannelEnabled` and `likelyDfsChannel`
2. `POST /api/wlan/channel` with `{ "instance": 2, "channel": 36 }` (or 40/44/48)
3. `GET /api/mesh` — verify repeaters / offline nodes
4. `GET /api/log?count=80` — look for radar / channel scan messages

Repeater-only auto scans may still need a fixed channel in the FRITZ! UI on that repeater.
