# OpenClaw MCC Dashboard - Design Document

**Date:** 2026-02-28
**Status:** Approved

## Overview

A web dashboard with an isometric pixel art office interface for interacting with OpenClaw agents. Users chat with agents individually, review agent-generated files, monitor daily standups, and observe agent-to-agent communication. The codebase is fully separated from content, enabling distribution to other users with their own agent configurations.

## Architecture

### Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, PixiJS (isometric office)
- **State:** Zustand
- **Middleware:** Node.js, Express, WebSocket, SSE
- **Database:** SQLite (chat persistence)
- **Voice:** Whisper (STT), edge-tts (TTS), streaming duplex
- **PWA:** vite-plugin-pwa
- **Charts:** Recharts

### System Topology

```
Browser (React + PixiJS)
    ↕ HTTP/SSE/WebSocket
Express Middleware (port 8081)
    ↕ WebSocket
OpenClaw Gateway (port 18789)
```

## Project Structure

### Application Code (git repo)

```
openclaw-mcc/
├── packages/
│   ├── client/                  # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/      # React UI (panels, chat, widgets)
│   │   │   ├── canvas/          # PixiJS isometric office scene
│   │   │   ├── hooks/           # React hooks (useChat, useAgent, useVoice)
│   │   │   ├── stores/          # Zustand state stores
│   │   │   ├── types/           # TypeScript interfaces
│   │   │   └── utils/
│   │   ├── public/              # Default sprites, PWA icons
│   │   └── vite.config.ts
│   └── server/                  # Express middleware
│       ├── src/
│       │   ├── routes/          # chat, files, standup, voice, config
│       │   ├── gateway/         # OpenClaw Gateway WebSocket client
│       │   ├── services/        # voice pipeline, file management
│       │   ├── middleware/      # rate limiting, error handling
│       │   └── types/
│       └── package.json
├── package.json                 # npm workspaces root
└── docs/plans/
```

### Content Root (outside git repo, user-configurable)

```
~/.openclaw/                     # Default CONTENT_ROOT
├── config.yaml                  # Agent definitions, branding, all configuration
├── data/
│   ├── standup.json             # Daily standup data
│   ├── action-items.json        # Task items
│   └── token-usage/             # Daily token snapshots
├── memory/agents/               # Per-agent memory markdown files
├── files/                       # Agent-generated files for review
│   ├── inbox/                   # New files pending review
│   ├── approved/                # Reviewed and approved
│   └── archive/                 # Archived files
├── databases/
│   └── chat.db                  # SQLite message history
└── assets/                      # User-customizable sprites (optional overrides)
```

The content root path is set via `CONTENT_ROOT` environment variable (defaults to `~/.openclaw`). The git repo contains zero user content - only application code.

## Isometric Pixel Office (PixiJS)

### Rendering
- PixiJS Application rendered in a full-screen WebGL canvas
- Tile-based isometric grid for the office floor, walls, furniture
- React components overlaid on top with managed pointer-events

### Agent Sprites
- Each agent has a sprite sheet with states: idle, working, walking, talking, meeting
- Sourced from open-source isometric asset packs, supplemented with AI-generated sprites
- Custom sprites loadable from content root `assets/` directory

### Zones
- Desks (default agent positions)
- Conference table (standup/meetings)
- Kitchen, specialized corners per agent role
- All zone positions defined in config

### Interaction
- Click agent or desk to open their panel
- Click conference table to view standup
- Camera: pan (drag), zoom (scroll/pinch), snap-to-zone navigation
- On mobile: tap to interact, pinch-zoom

### Agent Behavior
- Idle: sitting at desk, subtle idle animation
- Active chat: talking animation, glow effect
- Standup: walks to conference table
- Agent-to-agent: brief chat bubble icon above sprite

## Communication System

### 1. Direct Chat (User ↔ Agent)

- Slide-out panel on agent click
- Messages stream via SSE from middleware
- Middleware proxies to OpenClaw Gateway WebSocket
- SQLite persistence with deduplication and sequencing
- Draft messages saved in localStorage
- Markdown rendering with syntax highlighting
- **Interruption:** Cancel in-progress responses (abort signal to Gateway, stop SSE)
- **Image/screenshot support:** Drag-and-drop, paste, or file picker upload; forwarded to Gateway as attachments

### 2. Agent-to-Agent Channels (Read-only)

- Dedicated "Channels" view, Slack-like layout
- Auto-created channels based on agent interactions
- Real-time updates via WebSocket
- Unread indicators
- Distinct and separate from direct chat

### 3. Voice Communication

- Real-time duplex voice per agent
- **Inbound:** Browser audio capture → stream to middleware → Whisper STT → text to Gateway
- **Outbound:** Gateway text response → middleware → edge-tts streaming → audio playback in browser
- Voice mode toggle per agent in chat panel
- Push-to-talk or voice-activity-detection options
- Visual indicator on agent sprite during voice mode

## Agent Configuration

All agent setup is in `config.yaml` at the content root:

```yaml
branding:
  name: "OpenClaw Office"
  shortName: "MCC"

gateway:
  url: "http://127.0.0.1:18789"
  token: "..."

agents:
  isla:
    name: Isla
    fullName: Isla
    role: Chief of Staff
    emoji: "\U0001F3DD"
    sprite: isla          # sprite sheet name in assets/
    color:
      from: "#0ea5e9"
      to: "#06b6d4"
    channel: "#hq"
    greeting: "Hey! What can I help you with?"
    position:
      zone: desk
      x: 3
      y: 2
    tabs:
      - id: action-items
        label: Actions
        icon: clipboard
        source: "file:action-items.json"
      - id: sprint
        label: Sprint
        icon: chart
        source: "file:sprint.json"
        renderer: chart

  remy:
    name: Remy
    role: Personal Chef
    tabs:
      - id: meal-plan
        label: Meal Plan
        icon: calendar
        source: "file:meal-plan.json"
      - id: recipes
        label: Recipes
        icon: book
        source: "file:recipes.json"
      - id: cooking-tips
        label: Tips
        icon: lightbulb
        source: "api:remy/tips"
```

### Tab Source Types
- `file:<path>` - JSON/markdown from content directory
- `api:<endpoint>` - custom middleware endpoint
- `memory` - agent's memory file

### Tab Renderers
- `default` - formatted list/table
- `chart` - recharts visualization
- `markdown` - markdown content
- `table` - structured data table

## Standup System

### Live Mode
- At standup time, agents visually walk to the conference table in the isometric scene
- Speech bubbles or side panel shows each agent's update as it streams
- Animated gathering creates a visual event

### Summary Mode (Persistent)
- Dashboard widget always showing today's standup status
- Per-agent: yesterday's work, today's plan, blockers
- Status indicators: completed, pending, blocked
- Expandable detail per agent
- Data persisted in content root `data/standup.json`

## File Review System

- Top-level "Files" view and dashboard widget showing count
- Files live in content root `files/` directory (completely outside git repo)
- Subdirectories: `inbox/` (new), `approved/`, `archive/`
- Built-in viewers: markdown, code (syntax highlighted), images, PDFs, JSON
- Actions: approve, comment, flag for revision (metadata stored alongside)
- Files can be attached to agent conversations

## PWA & Mobile

- `vite-plugin-pwa` for service worker, manifest, offline caching
- Responsive layout:
  - Desktop: full office scene with overlay panels
  - Mobile: office scene fullscreen, bottom nav bar, panels slide up as modals
- Touch: tap agent, pinch-zoom office
- Push notifications: standup completion, agent messages, file review requests
- Served on local port, accessible via Tailscale IP
- Apple PWA meta tags for iPhone/iPad standalone mode

## State Management (Zustand)

Key stores:
- `agentStore` - agent configs, online status, positions
- `chatStore` - messages per agent, streaming state, drafts
- `channelStore` - agent-to-agent channel messages
- `standupStore` - standup data and status
- `fileStore` - file review queue
- `uiStore` - panel state, active agent, camera position
- `voiceStore` - voice mode state, audio streams

## Key Design Decisions

1. **PixiJS for office, React for UI** - Keeps game-like rendering separate from standard UI components
2. **Content root outside repo** - Zero risk of committing user data; enables distribution
3. **SSE for chat streaming** - Simpler than WebSocket for unidirectional server→client streaming, with WebSocket reserved for bidirectional needs
4. **Config-driven everything** - Agents, tabs, renderers, zones all defined in YAML, not code
5. **Express middleware** - Full control over Gateway integration, voice pipeline, file management
6. **Zustand over Redux** - Simpler, less boilerplate, sufficient for this use case
