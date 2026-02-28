# Office Visual Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder isometric office (checkerboard + emoji circles) with a multi-room pixel art office with procedural furniture and role-based 32x32 characters.

**Architecture:** Create three new modules (`rooms.ts`, `furniture.ts`, `characters.ts`) that handle zone layout, furniture drawing, and character rendering respectively. Rewrite `IsometricScene.ts` to orchestrate zone-based rendering using these modules. Delete unused `SpriteManager.ts`. Keep `OfficeCanvas.tsx` and `tiles.ts` unchanged.

**Tech Stack:** PixiJS 8 (Graphics, Container, Text), TypeScript, existing isometric tile math from `tiles.ts`

---

### Task 1: Room Layout Definitions (`rooms.ts`)

**Files:**
- Create: `packages/client/src/canvas/rooms.ts`

**Step 1: Create the room/zone data structures and layout**

```typescript
// packages/client/src/canvas/rooms.ts
import { TILE_WIDTH, TILE_HEIGHT, isoToScreen } from './tiles';
import { Graphics } from 'pixi.js';

// ─── Zone type and layout constants ─────────────────────────────────

export interface ZoneDef {
  id: string;
  label: string;
  /** Top-left grid position of this zone */
  originCol: number;
  originRow: number;
  /** Size in grid tiles */
  cols: number;
  rows: number;
  /** Floor tile colors (alternating pair) */
  floorA: number;
  floorB: number;
  /** Wall segments: which edges have walls */
  walls: Array<{ side: 'top' | 'right' | 'bottom' | 'left'; from: number; to: number }>;
}

// Office grid is 16 cols x 12 rows total
// Top zone: Main workspace (rows 0-6)
// Bottom-left: Conference (rows 7-11, cols 0-5)
// Bottom-center: Lounge (rows 7-11, cols 6-10)
// Bottom-right: Kitchen (rows 7-11, cols 11-15)

export const ZONES: ZoneDef[] = [
  {
    id: 'workspace',
    label: 'Main Workspace',
    originCol: 0,
    originRow: 0,
    cols: 16,
    rows: 7,
    floorA: 0x2a2a45, // dark carpet
    floorB: 0x252540,
    walls: [
      { side: 'top', from: 0, to: 16 },
      { side: 'left', from: 0, to: 7 },
      { side: 'right', from: 0, to: 7 },
    ],
  },
  {
    id: 'conference',
    label: 'Conference Room',
    originCol: 0,
    originRow: 7,
    cols: 5,
    rows: 5,
    floorA: 0x2d2d48, // slightly different carpet
    floorB: 0x282843,
    walls: [
      { side: 'left', from: 0, to: 5 },
      { side: 'bottom', from: 0, to: 5 },
      { side: 'right', from: 0, to: 5 },
    ],
  },
  {
    id: 'lounge',
    label: 'Lounge',
    originCol: 5,
    originRow: 7,
    cols: 6,
    rows: 5,
    floorA: 0x3a2e1e, // warm wood floor
    floorB: 0x33281a,
    walls: [
      { side: 'bottom', from: 0, to: 6 },
    ],
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    originCol: 11,
    originRow: 7,
    cols: 5,
    rows: 5,
    floorA: 0x383848, // light tile
    floorB: 0x303040,
    walls: [
      { side: 'right', from: 0, to: 5 },
      { side: 'bottom', from: 0, to: 5 },
    ],
  },
];

/** Map zone id string (from agent config) to our zone id */
export function resolveZone(agentZone: string): string {
  // Agent config uses "desk" for workspace, "kitchen" for kitchen
  // Map any unrecognized zone to workspace
  const mapping: Record<string, string> = {
    desk: 'workspace',
    workspace: 'workspace',
    conference: 'conference',
    lounge: 'lounge',
    kitchen: 'kitchen',
  };
  return mapping[agentZone] || 'workspace';
}

// ─── Floor drawing ──────────────────────────────────────────────────

export function drawZoneFloor(g: Graphics, zone: ZoneDef): void {
  for (let r = 0; r < zone.rows; r++) {
    for (let c = 0; c < zone.cols; c++) {
      const col = zone.originCol + c;
      const row = zone.originRow + r;
      const { x, y } = isoToScreen(col, row);
      const color = (r + c) % 2 === 0 ? zone.floorA : zone.floorB;
      g.poly([
        { x, y },
        { x: x + TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 },
        { x, y: y + TILE_HEIGHT },
        { x: x - TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 },
      ]);
      g.fill(color);
      g.stroke({ width: 1, color: 0x3d3d5a, alpha: 0.15 });
    }
  }
}

// ─── Wall drawing ───────────────────────────────────────────────────

const WALL_HEIGHT = 24;
const WALL_COLOR = 0x4a4a6a;
const WALL_TOP_COLOR = 0x5a5a7a;

export function drawZoneWalls(g: Graphics, zone: ZoneDef): void {
  for (const wall of zone.walls) {
    if (wall.side === 'top') {
      // Wall along top edge (row = originRow)
      for (let c = wall.from; c < wall.to; c++) {
        const col = zone.originCol + c;
        const row = zone.originRow;
        drawWallSegmentTop(g, col, row);
      }
    } else if (wall.side === 'bottom') {
      for (let c = wall.from; c < wall.to; c++) {
        const col = zone.originCol + c;
        const row = zone.originRow + zone.rows;
        drawWallSegmentTop(g, col, row);
      }
    } else if (wall.side === 'left') {
      for (let r = wall.from; r < wall.to; r++) {
        const col = zone.originCol;
        const row = zone.originRow + r;
        drawWallSegmentLeft(g, col, row);
      }
    } else if (wall.side === 'right') {
      for (let r = wall.from; r < wall.to; r++) {
        const col = zone.originCol + zone.cols;
        const row = zone.originRow + r;
        drawWallSegmentLeft(g, col, row);
      }
    }
  }
}

function drawWallSegmentTop(g: Graphics, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  // Top-facing wall: a thin parallelogram along the top tile edge
  g.poly([
    { x, y - WALL_HEIGHT },
    { x: x + TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 - WALL_HEIGHT },
    { x: x + TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 },
    { x, y },
  ]);
  g.fill(WALL_COLOR);
  g.stroke({ width: 1, color: WALL_TOP_COLOR, alpha: 0.5 });
}

function drawWallSegmentLeft(g: Graphics, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  // Left-facing wall
  g.poly([
    { x, y - WALL_HEIGHT },
    { x, y },
    { x: x - TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 },
    { x: x - TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 - WALL_HEIGHT },
  ]);
  g.fill(WALL_COLOR);
  g.stroke({ width: 1, color: WALL_TOP_COLOR, alpha: 0.5 });
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | head -20`
Expected: No errors related to rooms.ts

**Step 3: Commit**

```bash
git add packages/client/src/canvas/rooms.ts
git commit -m "feat(office): add room/zone layout definitions and wall drawing"
```

---

### Task 2: Furniture Drawing Module (`furniture.ts`)

**Files:**
- Create: `packages/client/src/canvas/furniture.ts`

**Step 1: Create procedural furniture drawing functions**

```typescript
// packages/client/src/canvas/furniture.ts
import { Graphics, Container } from 'pixi.js';
import { isoToScreen, TILE_WIDTH, TILE_HEIGHT } from './tiles';

// ─── Color palette ──────────────────────────────────────────────────

const DESK_SURFACE = 0x5c4a3a;
const DESK_SHADOW = 0x4a3a2e;
const DESK_EDGE = 0x6b5a48;
const MONITOR_FRAME = 0x2a2a3a;
const MONITOR_SCREEN = 0x4488cc;
const MONITOR_GLOW = 0x3366aa;
const CHAIR_SEAT = 0x3a3a50;
const CHAIR_BACK = 0x4a4a60;
const KEYBOARD_COLOR = 0x2a2a35;
const TABLE_WOOD = 0x5a4530;
const TABLE_DARK = 0x4a3825;
const COUCH_BASE = 0x4a3a5a;
const COUCH_CUSHION = 0x5a4a6a;
const COUNTER_TOP = 0x888898;
const COUNTER_FRONT = 0x686878;
const FRIDGE_COLOR = 0x9a9aaa;
const FRIDGE_DARK = 0x7a7a8a;
const PLANT_POT = 0x8a6a4a;
const PLANT_GREEN = 0x4a8a3a;
const PLANT_DARK_GREEN = 0x3a6a2e;
const WHITEBOARD_BG = 0xe8e8e8;
const WHITEBOARD_FRAME = 0x6a6a7a;
const STOVE_COLOR = 0x3a3a3a;
const STOVE_BURNER = 0x8a3a2a;
const BOOKSHELF_WOOD = 0x5a4030;
const BOOK_COLORS = [0xcc4444, 0x4488cc, 0x44aa44, 0xccaa44, 0x8844aa];

// ─── Desk (with monitor, keyboard, chair) ───────────────────────────

export function drawDesk(parent: Container, col: number, row: number, monitorColor?: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Desk surface (isometric rectangle, ~1 tile)
  const hw = TILE_WIDTH * 0.4;
  const hh = TILE_HEIGHT * 0.4;
  g.poly([
    { x, y: y - 10 },
    { x: x + hw, y: y - 10 + hh },
    { x, y: y - 10 + hh * 2 },
    { x: x - hw, y: y - 10 + hh },
  ]);
  g.fill(DESK_SURFACE);
  g.stroke({ width: 1, color: DESK_EDGE, alpha: 0.6 });

  // Desk legs (4 short lines from corners)
  const legH = 8;
  for (const [lx, ly] of [[x, y - 10], [x + hw, y - 10 + hh], [x, y - 10 + hh * 2], [x - hw, y - 10 + hh]] as const) {
    g.moveTo(lx, ly);
    g.lineTo(lx, ly + legH);
    g.stroke({ width: 2, color: DESK_SHADOW });
  }

  // Monitor (small rectangle standing on desk)
  const mx = x;
  const my = y - 22;
  g.roundRect(mx - 8, my - 10, 16, 12, 1);
  g.fill(MONITOR_FRAME);
  g.roundRect(mx - 6, my - 8, 12, 8, 1);
  g.fill(monitorColor || MONITOR_SCREEN);
  // Monitor stand
  g.rect(mx - 2, my + 2, 4, 3);
  g.fill(MONITOR_FRAME);
  // Subtle glow
  g.circle(mx, my - 4, 8);
  g.fill({ color: monitorColor || MONITOR_GLOW, alpha: 0.08 });

  // Keyboard
  g.roundRect(x - 6, y - 10 + hh - 2, 12, 4, 1);
  g.fill(KEYBOARD_COLOR);

  // Chair (behind desk - small rounded rectangle)
  g.roundRect(x - 6, y + hh * 2 - 6, 12, 8, 2);
  g.fill(CHAIR_SEAT);
  // Chair back
  g.roundRect(x - 5, y + hh * 2 - 8, 10, 4, 2);
  g.fill(CHAIR_BACK);

  parent.addChild(g);
}

/** Dual-monitor desk variant (for Eli the architect) */
export function drawDualMonitorDesk(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Same desk surface
  const hw = TILE_WIDTH * 0.45; // slightly wider
  const hh = TILE_HEIGHT * 0.4;
  g.poly([
    { x, y: y - 10 },
    { x: x + hw, y: y - 10 + hh },
    { x, y: y - 10 + hh * 2 },
    { x: x - hw, y: y - 10 + hh },
  ]);
  g.fill(DESK_SURFACE);
  g.stroke({ width: 1, color: DESK_EDGE, alpha: 0.6 });

  // Legs
  const legH = 8;
  for (const [lx, ly] of [[x, y - 10], [x + hw, y - 10 + hh], [x, y - 10 + hh * 2], [x - hw, y - 10 + hh]] as const) {
    g.moveTo(lx, ly);
    g.lineTo(lx, ly + legH);
    g.stroke({ width: 2, color: DESK_SHADOW });
  }

  // Two monitors side by side
  for (const offset of [-9, 9]) {
    const mx = x + offset;
    const my = y - 22;
    g.roundRect(mx - 7, my - 9, 14, 11, 1);
    g.fill(MONITOR_FRAME);
    g.roundRect(mx - 5, my - 7, 10, 7, 1);
    g.fill(MONITOR_SCREEN);
    g.rect(mx - 2, my + 2, 4, 3);
    g.fill(MONITOR_FRAME);
  }
  // Combined glow
  g.circle(x, y - 26, 14);
  g.fill({ color: MONITOR_GLOW, alpha: 0.06 });

  // Keyboard
  g.roundRect(x - 6, y - 10 + hh - 2, 12, 4, 1);
  g.fill(KEYBOARD_COLOR);

  // Chair
  g.roundRect(x - 6, y + hh * 2 - 6, 12, 8, 2);
  g.fill(CHAIR_SEAT);
  g.roundRect(x - 5, y + hh * 2 - 8, 10, 4, 2);
  g.fill(CHAIR_BACK);

  parent.addChild(g);
}

// ─── Conference table ───────────────────────────────────────────────

export function drawConferenceTable(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Large oval table (~3 tiles long)
  const hw = TILE_WIDTH * 0.9;
  const hh = TILE_HEIGHT * 0.55;
  g.ellipse(x, y + 4, hw, hh);
  g.fill(TABLE_WOOD);
  g.stroke({ width: 2, color: TABLE_DARK });

  // Chairs around the table (6 small circles)
  const chairPositions = [
    { cx: x - hw + 6, cy: y + 4 },
    { cx: x - hw * 0.4, cy: y - hh + 2 },
    { cx: x + hw * 0.4, cy: y - hh + 2 },
    { cx: x + hw - 6, cy: y + 4 },
    { cx: x + hw * 0.4, cy: y + hh + 6 },
    { cx: x - hw * 0.4, cy: y + hh + 6 },
  ];
  for (const { cx, cy } of chairPositions) {
    g.circle(cx, cy, 5);
    g.fill(CHAIR_SEAT);
    g.stroke({ width: 1, color: CHAIR_BACK, alpha: 0.5 });
  }

  parent.addChild(g);
}

// ─── Kitchen furniture ──────────────────────────────────────────────

export function drawKitchenCounter(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Counter: long isometric rectangle
  const hw = TILE_WIDTH * 0.6;
  const hh = TILE_HEIGHT * 0.25;

  // Counter front face
  g.poly([
    { x: x - hw, y: y + hh },
    { x: x - hw, y: y + hh + 14 },
    { x, y: y + hh * 2 + 14 },
    { x, y: y + hh * 2 },
  ]);
  g.fill(COUNTER_FRONT);

  // Counter top surface
  g.poly([
    { x, y },
    { x: x + hw, y: y + hh },
    { x, y: y + hh * 2 },
    { x: x - hw, y: y + hh },
  ]);
  g.fill(COUNTER_TOP);
  g.stroke({ width: 1, color: 0x9a9aaa, alpha: 0.4 });

  parent.addChild(g);
}

export function drawStove(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Stove body
  g.roundRect(x - 12, y - 6, 24, 16, 2);
  g.fill(STOVE_COLOR);
  g.stroke({ width: 1, color: 0x5a5a5a, alpha: 0.5 });

  // Burners (4 small circles)
  for (const [bx, by] of [[-5, -2], [5, -2], [-5, 4], [5, 4]] as const) {
    g.circle(x + bx, y + by, 3);
    g.fill(STOVE_BURNER);
  }

  parent.addChild(g);
}

export function drawFridge(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Fridge body (tall rectangle)
  g.roundRect(x - 10, y - 28, 20, 32, 2);
  g.fill(FRIDGE_COLOR);
  g.stroke({ width: 1, color: FRIDGE_DARK, alpha: 0.6 });

  // Fridge door split line
  g.moveTo(x - 8, y - 12);
  g.lineTo(x + 8, y - 12);
  g.stroke({ width: 1, color: FRIDGE_DARK });

  // Handle
  g.roundRect(x + 5, y - 22, 2, 8, 1);
  g.fill(FRIDGE_DARK);
  g.roundRect(x + 5, y - 10, 2, 6, 1);
  g.fill(FRIDGE_DARK);

  parent.addChild(g);
}

// ─── Lounge furniture ───────────────────────────────────────────────

export function drawCouch(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Couch base (L-shape in iso)
  const hw = TILE_WIDTH * 0.5;
  const hh = TILE_HEIGHT * 0.35;

  // Seat
  g.roundRect(x - hw, y - 4, hw * 2, hh * 2 + 4, 3);
  g.fill(COUCH_BASE);

  // Cushions (2 rounded rects on top)
  g.roundRect(x - hw + 3, y - 2, hw - 4, hh * 2 - 2, 2);
  g.fill(COUCH_CUSHION);
  g.roundRect(x + 3, y - 2, hw - 4, hh * 2 - 2, 2);
  g.fill(COUCH_CUSHION);

  // Armrests
  g.roundRect(x - hw - 2, y - 6, 6, hh * 2 + 6, 2);
  g.fill(COUCH_BASE);
  g.roundRect(x + hw - 4, y - 6, 6, hh * 2 + 6, 2);
  g.fill(COUCH_BASE);

  parent.addChild(g);
}

export function drawCoffeeTable(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Small low table
  const hw = TILE_WIDTH * 0.25;
  const hh = TILE_HEIGHT * 0.2;
  g.poly([
    { x, y },
    { x: x + hw, y: y + hh },
    { x, y: y + hh * 2 },
    { x: x - hw, y: y + hh },
  ]);
  g.fill(TABLE_WOOD);
  g.stroke({ width: 1, color: TABLE_DARK, alpha: 0.5 });

  // Coffee mug on table
  g.roundRect(x - 2, y + hh - 4, 4, 5, 1);
  g.fill(0xdddddd);

  parent.addChild(g);
}

// ─── Decorative props ───────────────────────────────────────────────

export function drawPlant(parent: Container, col: number, row: number, size: 'small' | 'large' = 'small'): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();
  const s = size === 'large' ? 1.5 : 1;

  // Pot
  g.poly([
    { x: x - 5 * s, y: y },
    { x: x + 5 * s, y: y },
    { x: x + 4 * s, y: y + 8 * s },
    { x: x - 4 * s, y: y + 8 * s },
  ]);
  g.fill(PLANT_POT);

  // Leaves (overlapping circles)
  g.circle(x, y - 6 * s, 7 * s);
  g.fill(PLANT_GREEN);
  g.circle(x - 4 * s, y - 3 * s, 5 * s);
  g.fill(PLANT_DARK_GREEN);
  g.circle(x + 4 * s, y - 4 * s, 5 * s);
  g.fill(PLANT_GREEN);

  parent.addChild(g);
}

export function drawWhiteboard(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Board (wall-mounted, so drawn as flat rect in iso)
  g.roundRect(x - 18, y - 24, 36, 20, 1);
  g.fill(WHITEBOARD_FRAME);
  g.roundRect(x - 16, y - 22, 32, 16, 1);
  g.fill(WHITEBOARD_BG);

  // Some "writing" scribbles
  g.moveTo(x - 12, y - 18);
  g.lineTo(x + 8, y - 16);
  g.stroke({ width: 1, color: 0x4444aa, alpha: 0.4 });
  g.moveTo(x - 10, y - 14);
  g.lineTo(x + 10, y - 13);
  g.stroke({ width: 1, color: 0xaa4444, alpha: 0.3 });

  parent.addChild(g);
}

export function drawBookshelf(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Shelf frame
  g.roundRect(x - 14, y - 28, 28, 32, 1);
  g.fill(BOOKSHELF_WOOD);

  // 3 shelves
  for (let s = 0; s < 3; s++) {
    const sy = y - 24 + s * 10;
    g.rect(x - 12, sy, 24, 2);
    g.fill(0x4a3525);

    // Books on shelf
    let bx = x - 11;
    for (let b = 0; b < 4; b++) {
      const bw = 3 + Math.floor(Math.random() * 3);
      const bh = 6 + Math.floor(Math.random() * 3);
      const color = BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
      g.rect(bx, sy - bh, bw, bh);
      g.fill(color);
      bx += bw + 1;
    }
  }

  parent.addChild(g);
}

export function drawWaterCooler(parent: Container, col: number, row: number): void {
  const { x, y } = isoToScreen(col, row);
  const g = new Graphics();

  // Base
  g.roundRect(x - 6, y - 4, 12, 16, 2);
  g.fill(0x888899);

  // Water jug on top
  g.roundRect(x - 5, y - 16, 10, 14, 3);
  g.fill(0x88bbee);
  g.stroke({ width: 1, color: 0x6699cc, alpha: 0.5 });

  // Spout
  g.rect(x - 1, y - 4, 2, 3);
  g.fill(0x666677);

  parent.addChild(g);
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | head -20`
Expected: No errors related to furniture.ts

**Step 3: Commit**

```bash
git add packages/client/src/canvas/furniture.ts
git commit -m "feat(office): add procedural furniture drawing module"
```

---

### Task 3: Character Drawing Module (`characters.ts`)

**Files:**
- Create: `packages/client/src/canvas/characters.ts`

**Step 1: Create procedural character renderer with role accessories**

```typescript
// packages/client/src/canvas/characters.ts
import { Graphics, Container, Text, TextStyle } from 'pixi.js';

// ─── Types ──────────────────────────────────────────────────────────

export type RoleAccessory =
  | 'headset'      // Isla - Chief of Staff
  | 'headphones'   // Marcus - Dev Manager
  | 'coffee-mug'   // Harper - QA Manager
  | 'none'         // Eli - Software Architect (dual monitors at desk instead)
  | 'glasses-notepad' // Sage - Market Researcher
  | 'tablet'       // Julie - Marketing
  | 'chef-hat'     // Remy - Personal Chef
  | 'headband'     // Lena - Gym Coach
  | 'glasses-tie'  // Val - Finance Manager
  | 'backpack'     // Atlas - Travel Planner
  | 'lanyard';     // Nova - HR Advisor

/** Map agent role string to accessory type */
export function roleToAccessory(role: string): RoleAccessory {
  const lower = role.toLowerCase();
  if (lower.includes('chief of staff')) return 'headset';
  if (lower.includes('dev manager')) return 'headphones';
  if (lower.includes('qa')) return 'coffee-mug';
  if (lower.includes('architect')) return 'none'; // dual monitors instead
  if (lower.includes('research')) return 'glasses-notepad';
  if (lower.includes('marketing')) return 'tablet';
  if (lower.includes('chef')) return 'chef-hat';
  if (lower.includes('gym') || lower.includes('coach')) return 'headband';
  if (lower.includes('finance')) return 'glasses-tie';
  if (lower.includes('travel')) return 'backpack';
  if (lower.includes('hr')) return 'lanyard';
  return 'none';
}

// ─── Color helpers ──────────────────────────────────────────────────

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - amount);
  const g = Math.max(0, ((color >> 8) & 0xff) - amount);
  const b = Math.max(0, (color & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

// ─── Skin tone palette (deterministic from agent key) ───────────────

const SKIN_TONES = [0xf5d0a9, 0xe8b88a, 0xd4a06a, 0xc08a5a, 0xa0724a, 0x8a5a3a];

function skinToneFromKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return SKIN_TONES[Math.abs(hash) % SKIN_TONES.length];
}

// ─── Hair styles ────────────────────────────────────────────────────

const HAIR_COLORS = [0x2a1a0a, 0x4a3020, 0x8a6a3a, 0x1a1a2a, 0xaa4422, 0x6a3a2a];

function hairColorFromKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 3) + hash + key.charCodeAt(i)) | 0;
  }
  return HAIR_COLORS[Math.abs(hash) % HAIR_COLORS.length];
}

// ─── Character drawing ──────────────────────────────────────────────

export interface CharacterOpts {
  agentKey: string;
  shirtColor: string; // hex string from agent.color.from
  accessory: RoleAccessory;
}

/**
 * Draw a 32x32 pixel-style character at the given Container position (0,0).
 * The character is drawn centered horizontally, with feet at y=0.
 */
export function drawCharacter(parent: Container, opts: CharacterOpts): void {
  const g = new Graphics();
  const shirt = hexToNum(opts.shirtColor);
  const skin = skinToneFromKey(opts.agentKey);
  const hair = hairColorFromKey(opts.agentKey);
  const pants = 0x2a2a3a;
  const shoes = 0x1a1a25;

  // ── Legs & shoes (bottom) ──
  // Left leg
  g.rect(-5, -8, 4, 8);
  g.fill(pants);
  g.rect(-5, -2, 4, 2);
  g.fill(shoes);

  // Right leg
  g.rect(1, -8, 4, 8);
  g.fill(pants);
  g.rect(1, -2, 4, 2);
  g.fill(shoes);

  // ── Body / shirt ──
  g.roundRect(-7, -22, 14, 15, 2);
  g.fill(shirt);
  g.stroke({ width: 1, color: darken(shirt, 30), alpha: 0.4 });

  // ── Arms ──
  g.rect(-9, -20, 3, 10);
  g.fill(shirt);
  // Hands
  g.rect(-9, -10, 3, 2);
  g.fill(skin);

  g.rect(6, -20, 3, 10);
  g.fill(shirt);
  g.rect(6, -10, 3, 2);
  g.fill(skin);

  // ── Head ──
  g.circle(0, -28, 7);
  g.fill(skin);

  // ── Hair (top of head) ──
  g.arc(0, -28, 7, Math.PI, 0, false);
  g.fill(hair);
  // Side hair
  g.rect(-7, -30, 2, 5);
  g.fill(hair);
  g.rect(5, -30, 2, 5);
  g.fill(hair);

  // ── Eyes ──
  g.circle(-3, -28, 1);
  g.fill(0x1a1a2a);
  g.circle(3, -28, 1);
  g.fill(0x1a1a2a);

  parent.addChild(g);

  // ── Accessories ──
  drawAccessory(parent, opts.accessory, shirt, skin);
}

function drawAccessory(parent: Container, accessory: RoleAccessory, shirt: number, skin: number): void {
  const g = new Graphics();

  switch (accessory) {
    case 'headset': {
      // Headband over head
      g.arc(0, -30, 8, Math.PI, 0, false);
      g.stroke({ width: 2, color: 0x3a3a4a });
      // Ear pieces
      g.circle(-8, -28, 2);
      g.fill(0x3a3a4a);
      g.circle(8, -28, 2);
      g.fill(0x3a3a4a);
      // Mic arm
      g.moveTo(-8, -28);
      g.lineTo(-6, -22);
      g.stroke({ width: 1.5, color: 0x3a3a4a });
      g.circle(-6, -22, 1.5);
      g.fill(0x3a3a4a);
      break;
    }
    case 'headphones': {
      // Headband
      g.arc(0, -30, 9, Math.PI, 0, false);
      g.stroke({ width: 2, color: 0x2a2a3a });
      // Ear cups (larger than headset)
      g.roundRect(-11, -30, 5, 6, 1);
      g.fill(0x2a2a3a);
      g.roundRect(6, -30, 5, 6, 1);
      g.fill(0x2a2a3a);
      break;
    }
    case 'coffee-mug': {
      // Mug in right hand area
      g.roundRect(7, -12, 5, 6, 1);
      g.fill(0xdddddd);
      // Handle
      g.arc(12, -9, 2, -Math.PI / 2, Math.PI / 2, false);
      g.stroke({ width: 1.5, color: 0xcccccc });
      // Steam
      g.moveTo(8, -14);
      g.quadraticCurveTo(9, -17, 8, -19);
      g.stroke({ width: 0.5, color: 0xffffff, alpha: 0.4 });
      g.moveTo(11, -14);
      g.quadraticCurveTo(12, -17, 11, -19);
      g.stroke({ width: 0.5, color: 0xffffff, alpha: 0.3 });
      break;
    }
    case 'glasses-notepad': {
      // Glasses
      g.circle(-3, -28, 2.5);
      g.stroke({ width: 1, color: 0x4a4a5a });
      g.circle(3, -28, 2.5);
      g.stroke({ width: 1, color: 0x4a4a5a });
      g.moveTo(-0.5, -28);
      g.lineTo(0.5, -28);
      g.stroke({ width: 1, color: 0x4a4a5a });
      // Notepad in left hand
      g.roundRect(-12, -12, 5, 7, 0.5);
      g.fill(0xeeeebb);
      g.stroke({ width: 0.5, color: 0xaaaa88 });
      // Lines on notepad
      for (let i = 0; i < 3; i++) {
        g.moveTo(-11, -10 + i * 2);
        g.lineTo(-8, -10 + i * 2);
        g.stroke({ width: 0.5, color: 0x8888aa, alpha: 0.5 });
      }
      break;
    }
    case 'tablet': {
      // Tablet held in both hands
      g.roundRect(-4, -12, 8, 10, 1);
      g.fill(0x2a2a3a);
      g.roundRect(-3, -11, 6, 8, 0.5);
      g.fill(0x4488aa);
      break;
    }
    case 'chef-hat': {
      // Chef toque (tall white hat)
      g.roundRect(-6, -42, 12, 8, 3);
      g.fill(0xf0f0f0);
      g.roundRect(-7, -36, 14, 4, 1);
      g.fill(0xe8e8e8);
      // Apron (white overlay on body)
      g.roundRect(-5, -18, 10, 12, 1);
      g.fill({ color: 0xf0f0f0, alpha: 0.8 });
      g.stroke({ width: 0.5, color: 0xdddddd });
      break;
    }
    case 'headband': {
      // Athletic headband
      g.arc(0, -30, 7.5, Math.PI, 0, false);
      g.stroke({ width: 3, color: 0xee4444 });
      // Tank top effect: thinner shoulder straps
      g.rect(-7, -22, 2, 4);
      g.fill(skin);
      g.rect(5, -22, 2, 4);
      g.fill(skin);
      break;
    }
    case 'glasses-tie': {
      // Glasses
      g.circle(-3, -28, 2.5);
      g.stroke({ width: 1, color: 0x3a3a4a });
      g.circle(3, -28, 2.5);
      g.stroke({ width: 1, color: 0x3a3a4a });
      g.moveTo(-0.5, -28);
      g.lineTo(0.5, -28);
      g.stroke({ width: 1, color: 0x3a3a4a });
      // Tie
      g.poly([
        { x: 0, y: -21 },
        { x: 2, y: -16 },
        { x: 0, y: -10 },
        { x: -2, y: -16 },
      ]);
      g.fill(0xcc3333);
      break;
    }
    case 'backpack': {
      // Backpack behind body (drawn as rectangle behind)
      g.roundRect(-8, -22, 16, 14, 2);
      g.fill(0x4a6a3a);
      g.stroke({ width: 1, color: 0x3a5a2a, alpha: 0.5 });
      // Straps
      g.moveTo(-5, -20);
      g.lineTo(-5, -14);
      g.stroke({ width: 1.5, color: 0x3a5a2a });
      g.moveTo(5, -20);
      g.lineTo(5, -14);
      g.stroke({ width: 1.5, color: 0x3a5a2a });
      break;
    }
    case 'lanyard': {
      // Lanyard string around neck
      g.moveTo(-3, -22);
      g.quadraticCurveTo(0, -18, 3, -22);
      g.stroke({ width: 1, color: 0x2255aa });
      // Badge at bottom of lanyard
      g.roundRect(-2, -18, 4, 5, 0.5);
      g.fill(0xeeeedd);
      g.stroke({ width: 0.5, color: 0xaaaa88 });
      break;
    }
    case 'none':
    default:
      break;
  }

  parent.addChild(g);
}

/**
 * Draw the agent name label below the character.
 */
export function drawNameLabel(parent: Container, name: string, y: number): void {
  const label = new Text({
    text: name,
    style: new TextStyle({
      fontSize: 9,
      fill: 0xd0d0e0,
      fontFamily: 'monospace',
      dropShadow: {
        color: 0x000000,
        alpha: 0.6,
        blur: 2,
        distance: 1,
      },
    }),
  });
  label.anchor.set(0.5, 0);
  label.y = y;
  parent.addChild(label);
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | head -20`
Expected: No errors related to characters.ts

**Step 3: Commit**

```bash
git add packages/client/src/canvas/characters.ts
git commit -m "feat(office): add procedural character drawing with role accessories"
```

---

### Task 4: Rewrite IsometricScene to Use New Modules

**Files:**
- Modify: `packages/client/src/canvas/IsometricScene.ts` (full rewrite)

**Step 1: Rewrite IsometricScene.ts**

```typescript
// packages/client/src/canvas/IsometricScene.ts
import { Application, Container, Graphics } from 'pixi.js';
import EventEmitter from 'eventemitter3';
import type { AgentConfig } from '../types/agent';
import { isoToScreen } from './tiles';
import { ZONES, resolveZone, drawZoneFloor, drawZoneWalls } from './rooms';
import {
  drawDesk,
  drawDualMonitorDesk,
  drawConferenceTable,
  drawKitchenCounter,
  drawStove,
  drawFridge,
  drawCouch,
  drawCoffeeTable,
  drawPlant,
  drawWhiteboard,
  drawBookshelf,
  drawWaterCooler,
} from './furniture';
import {
  drawCharacter,
  drawNameLabel,
  roleToAccessory,
} from './characters';

export class IsometricScene extends EventEmitter {
  private app: Application;
  private world: Container;
  private agents: Record<string, AgentConfig>;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private worldStart = { x: 0, y: 0 };
  private lastPinchDist = 0;

  constructor(app: Application, agents: Record<string, AgentConfig>) {
    super();
    this.app = app;
    this.agents = agents;
    this.world = new Container();
    this.app.stage.addChild(this.world);
    this.setupPanZoom();
  }

  render(): void {
    this.drawFloors();
    this.drawBackWalls();
    this.drawFurniture();
    this.drawAgents();
    this.drawFrontWalls();

    // Center the world in the viewport
    this.world.x = this.app.screen.width / 2;
    this.world.y = 80;
  }

  // ─── Floor layer ────────────────────────────────────────────────

  private drawFloors(): void {
    const g = new Graphics();
    for (const zone of ZONES) {
      drawZoneFloor(g, zone);
    }
    this.world.addChild(g);
  }

  // ─── Walls (back = top + left, front = bottom + right) ─────────

  private drawBackWalls(): void {
    const g = new Graphics();
    for (const zone of ZONES) {
      // Only draw top and left walls as "back" walls (behind furniture/agents)
      const backZone = {
        ...zone,
        walls: zone.walls.filter((w) => w.side === 'top' || w.side === 'left'),
      };
      drawZoneWalls(g, backZone);
    }
    this.world.addChild(g);
  }

  private drawFrontWalls(): void {
    const g = new Graphics();
    for (const zone of ZONES) {
      const frontZone = {
        ...zone,
        walls: zone.walls.filter((w) => w.side === 'bottom' || w.side === 'right'),
      };
      drawZoneWalls(g, frontZone);
    }
    this.world.addChild(g);
  }

  // ─── Furniture layer ────────────────────────────────────────────

  private drawFurniture(): void {
    const furnitureLayer = new Container();

    // ── Main workspace: decorative plants, water cooler ──
    drawPlant(furnitureLayer, 0, 1, 'large');
    drawPlant(furnitureLayer, 15, 1, 'large');
    drawPlant(furnitureLayer, 0, 5, 'small');
    drawPlant(furnitureLayer, 15, 5, 'small');
    drawWaterCooler(furnitureLayer, 14, 0);

    // ── Conference room ──
    drawConferenceTable(furnitureLayer, 2, 9);
    drawWhiteboard(furnitureLayer, 1, 7);
    drawPlant(furnitureLayer, 4, 7, 'small');

    // ── Lounge ──
    drawCouch(furnitureLayer, 7, 9);
    drawCoffeeTable(furnitureLayer, 7, 10);
    drawBookshelf(furnitureLayer, 5, 8);
    drawPlant(furnitureLayer, 10, 8, 'large');
    drawPlant(furnitureLayer, 5, 10, 'small');

    // ── Kitchen ──
    drawKitchenCounter(furnitureLayer, 12, 8);
    drawStove(furnitureLayer, 13, 8);
    drawFridge(furnitureLayer, 15, 8);
    drawPlant(furnitureLayer, 11, 10, 'small');

    this.world.addChild(furnitureLayer);
  }

  // ─── Agent layer (desks + characters, y-sorted) ─────────────────

  private drawAgents(): void {
    // Collect all agent entries with their resolved positions
    const entries = Object.entries(this.agents).map(([key, agent]) => {
      const zone = resolveZone(agent.position?.zone || 'desk');
      const zoneDef = ZONES.find((z) => z.id === zone) || ZONES[0];
      // Agent x/y are relative grid positions within the zone
      const col = zoneDef.originCol + (agent.position?.x ?? 1);
      const row = zoneDef.originRow + (agent.position?.y ?? 1);
      return { key, agent, col, row };
    });

    // Sort by row (y) for correct isometric depth
    entries.sort((a, b) => a.row - b.row || a.col - b.col);

    for (const { key, agent, col, row } of entries) {
      const { x, y } = isoToScreen(col, row);

      const agentContainer = new Container();
      agentContainer.x = x;
      agentContainer.y = y;
      agentContainer.eventMode = 'static';
      agentContainer.cursor = 'pointer';

      // Draw desk (or dual-monitor desk for architect)
      const accessory = roleToAccessory(agent.role);
      if (agent.position?.zone === 'kitchen') {
        // Kitchen agents don't get a desk
      } else if (agent.role.toLowerCase().includes('architect')) {
        drawDualMonitorDesk(this.world, col, row);
      } else {
        drawDesk(this.world, col, row);
      }

      // Draw the character
      drawCharacter(agentContainer, {
        agentKey: key,
        shirtColor: agent.color.from,
        accessory,
      });

      // Name label
      drawNameLabel(agentContainer, agent.name, 4);

      // Hover highlight
      const highlight = new Graphics();
      highlight.circle(0, -14, 18);
      highlight.fill({ color: 0xffffff, alpha: 0 });
      agentContainer.addChild(highlight);

      agentContainer.on('pointerover', () => {
        highlight.clear();
        highlight.circle(0, -14, 18);
        highlight.fill({ color: 0xffffff, alpha: 0.1 });
      });
      agentContainer.on('pointerout', () => {
        highlight.clear();
        highlight.circle(0, -14, 18);
        highlight.fill({ color: 0xffffff, alpha: 0 });
      });

      agentContainer.on('pointerdown', (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        this.emit('agentClick', key);
      });

      this.world.addChild(agentContainer);
    }
  }

  // ─── Pan & Zoom (unchanged from original) ───────────────────────

  private setupPanZoom(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.app.screen;

    stage.on('pointerdown', (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.global.x, y: e.global.y };
      this.worldStart = { x: this.world.x, y: this.world.y };
    });

    stage.on('pointermove', (e) => {
      if (!this.isDragging) return;
      this.world.x = this.worldStart.x + (e.global.x - this.dragStart.x);
      this.world.y = this.worldStart.y + (e.global.y - this.dragStart.y);
    });

    stage.on('pointerup', () => {
      this.isDragging = false;
    });
    stage.on('pointerupoutside', () => {
      this.isDragging = false;
    });

    // Zoom with mouse wheel
    this.app.canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const scale = this.world.scale.x;
        const newScale = Math.max(0.3, Math.min(3, scale - e.deltaY * 0.001));
        this.world.scale.set(newScale);
      },
      { passive: false },
    );

    // Pinch-to-zoom for touch devices
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        }
      },
      { passive: false },
    );

    canvas.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (e.touches.length === 2 && this.lastPinchDist > 0) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const scaleFactor = dist / this.lastPinchDist;
          const scale = this.world.scale.x;
          const newScale = Math.max(0.3, Math.min(3, scale * scaleFactor));
          this.world.scale.set(newScale);
          this.lastPinchDist = dist;
        }
      },
      { passive: false },
    );

    canvas.addEventListener('touchend', () => {
      this.lastPinchDist = 0;
    });
  }

  destroy(): void {
    this.world.destroy({ children: true });
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/client/tsconfig.json 2>&1 | head -20`
Expected: No errors

**Step 3: Delete unused SpriteManager.ts**

```bash
rm packages/client/src/canvas/SpriteManager.ts
```

**Step 4: Verify no imports reference SpriteManager**

Run: `grep -r "SpriteManager" packages/client/src/`
Expected: No results

**Step 5: Visual test with Playwright**

Run: `cd packages/client && npx playwright test --headed --timeout 30000`
Expected: All 19 e2e tests pass. Office view shows rooms, furniture, and characters.

**Step 6: Commit**

```bash
git add packages/client/src/canvas/IsometricScene.ts
git rm packages/client/src/canvas/SpriteManager.ts
git commit -m "feat(office): rewrite IsometricScene with rooms, furniture, and pixel characters"
```

---

### Task 5: Visual Tuning and Final Polish

**Files:**
- Modify: `packages/client/src/canvas/rooms.ts` (tweak positions if needed)
- Modify: `packages/client/src/canvas/furniture.ts` (tweak positions if needed)
- Modify: `packages/client/src/canvas/characters.ts` (tweak if needed)

**Step 1: Open the dashboard in browser and visually inspect**

Run: Open `http://localhost:3001` in browser, navigate to Office view.

Check for:
- [ ] All 11 agents visible and clickable
- [ ] Agents positioned in correct zones (Remy in kitchen, rest at desks)
- [ ] Furniture not overlapping agents
- [ ] Walls framing rooms properly
- [ ] Floor colors distinct per zone
- [ ] Pan and zoom working
- [ ] Agent panel opens on character click
- [ ] Hover highlight on characters
- [ ] No console errors

**Step 2: Take a Playwright screenshot for reference**

```bash
cd packages/client && npx playwright test -g "page loads" --headed
```

**Step 3: Adjust positions in rooms.ts or furniture.ts if anything overlaps**

This is a manual tuning step. Common adjustments:
- Shift furniture positions by 1-2 grid units
- Adjust agent x/y in server config if desk positions don't match grid
- Tweak wall `from`/`to` ranges

**Step 4: Run full test suite**

Run: `cd /Volumes/Repo-Drive/src/openclaw-mcc && npm test`
Expected: 24 server tests + 21 client tests all pass.

Run: `cd packages/client && npx playwright test`
Expected: 19 e2e tests pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(office): visual tuning pass for office layout and character positions"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Room layout definitions + wall drawing | Create `rooms.ts` |
| 2 | Procedural furniture drawing | Create `furniture.ts` |
| 3 | Character renderer with role accessories | Create `characters.ts` |
| 4 | Rewrite IsometricScene to use new modules | Rewrite `IsometricScene.ts`, delete `SpriteManager.ts` |
| 5 | Visual tuning and final polish | Tweak positions in all canvas modules |

Tasks 1-3 are independent (can be done in parallel). Task 4 depends on all three. Task 5 depends on Task 4.
