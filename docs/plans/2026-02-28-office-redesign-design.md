# Office Visual Redesign — Design

## Goal

Replace the placeholder isometric checkerboard + emoji circles with a proper pixel art office featuring furniture, rooms, and role-based characters — all drawn procedurally with PixiJS Graphics.

## Style

Modern pixel art (32x32 character sprites, clean geometric furniture). Higher resolution than retro 8-bit, closer to Celeste/Hyper Light Drifter aesthetic. 2-3 shading tones per object. No external asset files — everything code-drawn.

## Office Layout

Four zones separated by wall segments:

```
┌─────────────────────────────────────────┐
│           MAIN WORKSPACE                │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐       │
│  │D1│ │D2│ │D3│ │D4│ │D5│ │D6│       │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘       │
│         (desks in rows)                │
├──────────────┬──────────────┬──────────┤
│  CONFERENCE  │    LOUNGE    │ KITCHEN  │
│  ┌────────┐  │  couch,     │  counter │
│  │ table  │  │  plants,    │  stove   │
│  │        │  │  coffee tbl │  fridge  │
│  └────────┘  │             │          │
└──────────────┴──────────────┴──────────┘
```

- **Main workspace** (top): Desks with monitors for most agents
- **Conference room** (bottom-left): Long table, chairs, whiteboard
- **Lounge** (bottom-center): Couch, coffee table, potted plants
- **Kitchen** (bottom-right): Counter, stovetop, fridge — Remy's zone

Floor color varies by zone: carpet (workspace), tile (kitchen), wood (lounge), carpet (conference).

## Furniture (Procedural)

Each piece is a function like `drawDesk(g, x, y, color)`:

- **Desk unit**: L-shaped surface, monitor (bright rect with glow), keyboard, chair
- **Conference table**: Long oval, 6 chairs, dark wood
- **Kitchen**: Counter with backsplash, stovetop, fridge, shelves
- **Lounge**: L-shaped couch, low coffee table, potted plants, bookshelf
- **Decorative**: Plants, whiteboard, water cooler, ceiling light glow

## Characters (32x32 Procedural)

Base humanoid: round head, rectangle body, two leg rectangles. Shirt color from `agent.color.from`.

Role-based accessories:

| Agent | Role | Accessory |
|-------|------|-----------|
| Isla | Chief of Staff | Headset |
| Marcus | Dev Manager | Headphones |
| Harper | QA Manager | Coffee mug |
| Eli | Software Architect | Dual monitors at desk |
| Sage | Market Researcher | Glasses, notepad |
| Julie | Marketing | Tablet in hand |
| Remy | Personal Chef | Chef hat, apron |
| Lena | Gym Coach | Headband, tank top |
| Val | Finance Manager | Glasses, tie |
| Atlas | Travel Planner | Backpack |
| Nova | HR Advisor | Lanyard/badge |

Characters sit at assigned desk/station. 3/4 isometric facing. Highlight on hover.

## Technical Architecture

### File structure

```
canvas/
  OfficeCanvas.tsx      (keep unchanged)
  IsometricScene.ts     (rewrite — zone-based layout)
  tiles.ts              (keep — iso math)
  furniture.ts          (new — procedural furniture drawing)
  characters.ts         (new — procedural character drawing)
  rooms.ts              (new — zone layout definitions, walls)
```

### Rendering order (back-to-front)

1. Floor tiles per zone
2. Back walls
3. Furniture (y-sorted)
4. Characters (y-sorted)
5. Front walls / glass dividers

### Data flow

- `agent.position.zone` maps agent to a room
- `agent.position.x/y` are relative grid coords within the room
- Zone definitions in `rooms.ts` specify floor bounds, wall segments, furniture placement
- `IsometricScene` iterates zones, draws floor → walls → furniture → characters

### Interactions preserved

- Pan (drag), zoom (wheel/pinch) — unchanged
- Agent click → `agentClick` event → opens panel — unchanged
- Hover highlight on characters

### Performance

- All graphics drawn once on init
- Redraw only on resize
- No per-frame animation in v1
