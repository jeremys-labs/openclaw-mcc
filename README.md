# OpenClaw MCC Dashboard

A web dashboard for interacting with [OpenClaw](https://openclaw.ai) AI agents. Features an isometric pixel-art office view, real-time chat with streaming responses, file browsing, voice communication, and agent status monitoring. All agent definitions, branding, and content live outside the codebase in a configurable content directory.

**Key features:**
- Real-time streaming chat with multiple agents via SSE
- Isometric PixiJS office scene with animated agent sprites
- File browser for agent-generated documents (inbox/approved/archive)
- Voice input (Whisper STT) and output (Kokoro/Edge TTS)
- Agent memory viewer with markdown rendering
- Custom data tabs with chart/table/markdown renderers
- SQLite chat persistence with WAL mode

## Prerequisites

- **Node.js 20+**
- **OpenClaw Gateway** running and accessible (default port 18789)
- **Xcode Command Line Tools** (macOS) — required to compile `better-sqlite3`
  ```bash
  xcode-select --install
  ```

## Quick Start

```bash
git clone git@github.com:jeremys-labs/openclaw-mcc.git
cd openclaw-mcc
npm install

# Create your content directory and config
mkdir -p ~/.openclaw
cp config.yaml.example ~/.openclaw/config.yaml   # Edit with your agents
# Or create config.yaml from scratch — see Configuration below

npm run dev
```

The client runs on `http://localhost:3001` and the server on `http://localhost:8081`.

## Configuration

All configuration lives under `CONTENT_ROOT` (default: `~/.openclaw`).

### config.yaml (required)

```yaml
branding:
  name: "My AI Office"        # Dashboard title
  shortName: "MCC"             # Abbreviated name

gateway:
  url: "http://127.0.0.1:18789"
  token: "your-gateway-token"

agents:
  researcher:
    name: Ada                  # Display name
    fullName: Ada Lovelace     # Optional full name
    role: Research Lead        # Job title shown in UI
    emoji: "🔬"                # Fallback when no sprite
    sprite: ada                # Sprite sheet name in assets/ (optional)
    color:
      from: "#8b5cf6"         # Gradient start (hex)
      to: "#7c3aed"           # Gradient end (hex)
    channel: "#research"       # Channel identifier
    greeting: "What should we investigate?"
    quote: "The more I study, the more I know."  # Optional
    voice: "en-US-AriaNeural"  # Edge TTS voice (optional)
    position:
      zone: desk               # Office zone
      x: 3                     # Grid position
      y: 2
    tabs:
      - id: findings
        label: Findings
        icon: clipboard
        source: "file:findings.json"     # JSON file in CONTENT_ROOT/data/
      - id: metrics
        label: Metrics
        icon: chart
        source: "file:metrics.json"
        renderer: chart                  # chart | table | markdown | default
      - id: memory
        label: Memory
        icon: brain
        source: memory                   # Agent's memory file
        renderer: markdown
```

**Agent keys** (e.g., `researcher`) are used as session identifiers when communicating with the Gateway.

### openclaw.json (optional)

Maps agents to LLM models for display in the chat header:

```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "anthropic/claude-haiku-4-5" }
    },
    "list": [
      { "id": "researcher", "model": { "primary": "anthropic/claude-sonnet-4-6" } }
    ]
  }
}
```

Model IDs use `provider/model` format. The dashboard auto-formats them for display (e.g., `anthropic/claude-sonnet-4-6` → "Sonnet 4.6").

## Content Directory

`CONTENT_ROOT` (default `~/.openclaw`) holds all runtime data. The server auto-creates this structure on first start:

```
~/.openclaw/
├── config.yaml          # You create this (required)
├── openclaw.json        # You create this (optional)
├── data/                # JSON data files referenced by agent tabs
│   └── token-usage/     # Auto-generated token tracking
├── files/               # Agent-generated documents
│   ├── inbox/           # New files for review
│   ├── approved/        # Approved files
│   └── archive/         # Archived files
├── databases/           # SQLite chat history (auto-created)
├── memory/
│   └── agents/          # Per-agent memory markdown files
└── assets/              # Custom sprite sheets (optional)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTENT_ROOT` | `~/.openclaw` | Path to content directory |
| `SERVER_PORT` | `8081` | Server port |
| `CLIENT_PORT` | `3001` | Vite dev server port |
| `GATEWAY_PORT` | `18789` | OpenClaw Gateway port (overrides config.yaml) |
| `GATEWAY_TOKEN` | — | Gateway auth token (overrides config.yaml) |
| `WHISPER_SERVER_URL` | `http://127.0.0.1:8090/inference` | Whisper HTTP server for STT |
| `WHISPER_CLI` | auto-detected | Path to whisper CLI binary |
| `FFMPEG_BIN` | auto-detected | Path to ffmpeg binary |
| `KOKORO_URL` | `http://127.0.0.1:8880` | Kokoro TTS server URL |

Copy `.env.example` to `.env` to set these locally.

## Production Deployment

Build and serve both client and server from port 8081:

```bash
npm run build
node packages/server/dist/index.js
```

### launchd (macOS)

Create `~/Library/LaunchAgents/com.openclaw.mcc.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.openclaw.mcc</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/openclaw-mcc/packages/server/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CONTENT_ROOT</key>
    <string>/Users/you/.openclaw</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/openclaw-mcc.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/openclaw-mcc.err</string>
</dict>
</plist>
```

```bash
# Load the service
launchctl load ~/Library/LaunchAgents/com.openclaw.mcc.plist

# After rebuilding, restart with:
npm run build && launchctl kickstart -k gui/$(id -u)/com.openclaw.mcc
```

**Note:** Update the `node` path if using a version manager (nvm, fnm, Homebrew). Hardcoded paths break on upgrades — use `which node` to find your current path.

## Development

```bash
npm run dev                  # Both client + server with hot reload
npm run dev -w packages/client   # Client only (port 3001)
npm run dev -w packages/server   # Server only (port 8081)

npm run test:server          # Vitest unit tests
npm run test:e2e             # Playwright e2e tests (from packages/client)
```

### Project Structure

```
openclaw-mcc/
├── packages/
│   ├── client/              # Vite + React 19 + Tailwind v4 + PixiJS 8
│   │   ├── src/
│   │   │   ├── canvas/      # Isometric office scene
│   │   │   ├── components/  # React UI (chat, sidebar, panels)
│   │   │   ├── hooks/       # useChat, useSSE, useConfig, useVoice
│   │   │   ├── stores/      # Zustand state management
│   │   │   └── layouts/     # Responsive dashboard layout
│   │   └── e2e/             # Playwright tests
│   └── server/              # Express 5 + SQLite + WebSocket
│       └── src/
│           ├── gateway/     # WebSocket client to OpenClaw Gateway
│           ├── services/    # Chat (SSE streaming), voice (TTS/STT)
│           ├── routes/      # REST API endpoints
│           └── db.ts        # SQLite with WAL mode
└── docs/plans/              # Design documents
```

## Voice Services (Optional)

Voice features require external services. All are optional — the dashboard works without them.

**Speech-to-text** — requires one of:
- [Whisper.cpp server](https://github.com/ggerganov/whisper.cpp) running on port 8090 (recommended)
- Whisper CLI binary installed locally

**Text-to-speech** — uses one of (in priority order):
1. [Kokoro TTS](https://github.com/remsky/Kokoro-FastAPI) — local neural TTS
2. Edge TTS — Microsoft's free cloud TTS (no setup, works out of the box)

Set the corresponding environment variables to configure service URLs and binary paths. See the Environment Variables table above.

## License

MIT
