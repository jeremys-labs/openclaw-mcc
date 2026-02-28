import { Container, Graphics } from 'pixi.js';
import { TILE_WIDTH, TILE_HEIGHT, isoToScreen } from './tiles';

// --- Color palette ---
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

// Suppress unused-variable warnings for palette entries used indirectly
void DESK_SHADOW;
void DESK_EDGE;
void MONITOR_GLOW;
void TABLE_DARK;
void FRIDGE_DARK;

// Helper: draw an isometric diamond shape
function isoDiamond(
  g: Graphics,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  fillColor: number,
): void {
  g.poly([
    { x: cx, y: cy - halfH },
    { x: cx + halfW, y: cy },
    { x: cx, y: cy + halfH },
    { x: cx - halfW, y: cy },
  ]);
  g.fill(fillColor);
}

// Helper: draw a small chair circle
function drawChairCircle(g: Graphics, cx: number, cy: number, radius: number): void {
  g.circle(cx, cy, radius);
  g.fill(CHAIR_SEAT);
  g.stroke({ width: 1, color: CHAIR_BACK, alpha: 0.8 });
}

/**
 * Isometric desk with surface, legs, monitor, keyboard, and chair.
 */
export function drawDesk(
  parent: Container,
  col: number,
  row: number,
  monitorColor: number = MONITOR_SCREEN,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const hw = TILE_WIDTH * 0.4;
  const hh = TILE_HEIGHT * 0.4;

  // Desk surface
  isoDiamond(g, x, y, hw, hh, DESK_SURFACE);
  g.stroke({ width: 1, color: DESK_EDGE });

  // Four legs
  const legOffsets = [
    { dx: 0, dy: -hh },
    { dx: hw, dy: 0 },
    { dx: 0, dy: hh },
    { dx: -hw, dy: 0 },
  ];
  for (const off of legOffsets) {
    g.moveTo(x + off.dx, y + off.dy);
    g.lineTo(x + off.dx, y + off.dy + 6);
    g.stroke({ width: 2, color: DESK_SHADOW });
  }

  // Monitor
  const mw = 10;
  const mh = 8;
  g.rect(x - mw / 2, y - hh - mh - 2, mw, mh);
  g.fill(MONITOR_FRAME);
  g.rect(x - mw / 2 + 1, y - hh - mh - 1, mw - 2, mh - 2);
  g.fill(monitorColor);

  // Monitor stand
  g.moveTo(x, y - hh - 2);
  g.lineTo(x, y - hh + 1);
  g.stroke({ width: 2, color: MONITOR_FRAME });

  // Keyboard
  g.rect(x - 6, y - 2, 12, 4);
  g.fill(KEYBOARD_COLOR);

  // Chair behind desk
  drawChairCircle(g, x, y + hh + 6, 5);

  parent.addChild(g);
}

/**
 * Desk with two side-by-side monitors (wider surface).
 */
export function drawDualMonitorDesk(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const hw = TILE_WIDTH * 0.45;
  const hh = TILE_HEIGHT * 0.45;

  // Desk surface
  isoDiamond(g, x, y, hw, hh, DESK_SURFACE);
  g.stroke({ width: 1, color: DESK_EDGE });

  // Legs
  const legOffsets = [
    { dx: 0, dy: -hh },
    { dx: hw, dy: 0 },
    { dx: 0, dy: hh },
    { dx: -hw, dy: 0 },
  ];
  for (const off of legOffsets) {
    g.moveTo(x + off.dx, y + off.dy);
    g.lineTo(x + off.dx, y + off.dy + 6);
    g.stroke({ width: 2, color: DESK_SHADOW });
  }

  // Two monitors side by side
  const mw = 9;
  const mh = 7;
  const gap = 2;
  for (const side of [-1, 1]) {
    const mx = x + side * (mw / 2 + gap / 2);
    g.rect(mx - mw / 2, y - hh - mh - 2, mw, mh);
    g.fill(MONITOR_FRAME);
    g.rect(mx - mw / 2 + 1, y - hh - mh - 1, mw - 2, mh - 2);
    g.fill(MONITOR_SCREEN);
    // Stand
    g.moveTo(mx, y - hh - 2);
    g.lineTo(mx, y - hh + 1);
    g.stroke({ width: 2, color: MONITOR_FRAME });
  }

  // Keyboard
  g.rect(x - 6, y - 2, 12, 4);
  g.fill(KEYBOARD_COLOR);

  // Chair
  drawChairCircle(g, x, y + hh + 6, 5);

  parent.addChild(g);
}

/**
 * Large conference table with chairs around it.
 */
export function drawConferenceTable(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const hw = TILE_WIDTH * 0.9;
  const hh = TILE_HEIGHT * 0.55;

  // Table ellipse
  g.ellipse(x, y, hw, hh);
  g.fill(TABLE_WOOD);
  g.stroke({ width: 1, color: TABLE_DARK });

  // 6 chairs evenly around the table
  const chairCount = 6;
  for (let i = 0; i < chairCount; i++) {
    const angle = (i / chairCount) * Math.PI * 2;
    const cx = x + Math.cos(angle) * (hw + 8);
    const cy = y + Math.sin(angle) * (hh + 8);
    drawChairCircle(g, cx, cy, 4);
  }

  parent.addChild(g);
}

/**
 * Kitchen counter with front face and top surface.
 */
export function drawKitchenCounter(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const hw = TILE_WIDTH * 0.4;
  const hh = TILE_HEIGHT * 0.3;
  const height = 8;

  // Front face
  g.poly([
    { x: x - hw, y: y },
    { x, y: y + hh },
    { x, y: y + hh + height },
    { x: x - hw, y: y + height },
  ]);
  g.fill(COUNTER_FRONT);

  // Right face
  g.poly([
    { x, y: y + hh },
    { x: x + hw, y: y },
    { x: x + hw, y: y + height },
    { x, y: y + hh + height },
  ]);
  g.fill(COUNTER_FRONT);

  // Top surface
  isoDiamond(g, x, y, hw, hh, COUNTER_TOP);
  g.stroke({ width: 1, color: COUNTER_FRONT });

  parent.addChild(g);
}

/**
 * Stove with body and 4 burner circles.
 */
export function drawStove(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const hw = TILE_WIDTH * 0.35;
  const hh = TILE_HEIGHT * 0.3;

  // Body
  isoDiamond(g, x, y, hw, hh, STOVE_COLOR);
  g.stroke({ width: 1, color: 0x2a2a2a });

  // 4 burners in a 2x2 grid on the surface
  const burnerOffsets = [
    { dx: -hw * 0.3, dy: -hh * 0.3 },
    { dx: hw * 0.3, dy: -hh * 0.3 },
    { dx: -hw * 0.3, dy: hh * 0.3 },
    { dx: hw * 0.3, dy: hh * 0.3 },
  ];
  for (const off of burnerOffsets) {
    g.circle(x + off.dx, y + off.dy, 3);
    g.fill(STOVE_BURNER);
  }

  parent.addChild(g);
}

/**
 * Tall fridge with door split line and handles.
 */
export function drawFridge(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const w = 16;
  const h = 24;

  // Body
  g.rect(x - w / 2, y - h, w, h);
  g.fill(FRIDGE_COLOR);
  g.stroke({ width: 1, color: FRIDGE_DARK });

  // Door split line
  g.moveTo(x - w / 2 + 1, y - h * 0.4);
  g.lineTo(x + w / 2 - 1, y - h * 0.4);
  g.stroke({ width: 1, color: FRIDGE_DARK });

  // Handles
  g.moveTo(x + w / 2 - 3, y - h * 0.55);
  g.lineTo(x + w / 2 - 3, y - h * 0.45);
  g.stroke({ width: 2, color: 0xaaaabb });

  g.moveTo(x + w / 2 - 3, y - h * 0.35);
  g.lineTo(x + w / 2 - 3, y - h * 0.2);
  g.stroke({ width: 2, color: 0xaaaabb });

  parent.addChild(g);
}

/**
 * Couch with base, cushions, and armrests.
 */
export function drawCouch(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const bw = 28;
  const bh = 12;

  // Base rectangle
  g.rect(x - bw / 2, y - bh / 2, bw, bh);
  g.fill(COUCH_BASE);
  g.stroke({ width: 1, color: 0x3a2a4a });

  // Two cushions
  const cushionW = 11;
  g.rect(x - bw / 2 + 2, y - bh / 2 + 2, cushionW, bh - 4);
  g.fill(COUCH_CUSHION);

  g.rect(x - bw / 2 + cushionW + 4, y - bh / 2 + 2, cushionW, bh - 4);
  g.fill(COUCH_CUSHION);

  // Armrests
  g.rect(x - bw / 2 - 2, y - bh / 2, 3, bh);
  g.fill(COUCH_BASE);
  g.stroke({ width: 1, color: 0x3a2a4a });

  g.rect(x + bw / 2 - 1, y - bh / 2, 3, bh);
  g.fill(COUCH_BASE);
  g.stroke({ width: 1, color: 0x3a2a4a });

  parent.addChild(g);
}

/**
 * Small coffee table with a mug on top.
 */
export function drawCoffeeTable(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const hw = TILE_WIDTH * 0.2;
  const hh = TILE_HEIGHT * 0.15;

  // Small iso diamond
  isoDiamond(g, x, y, hw, hh, TABLE_WOOD);
  g.stroke({ width: 1, color: TABLE_DARK });

  // Coffee mug (small circle on top)
  g.circle(x + 2, y - 2, 3);
  g.fill(0xeeeeee);
  g.stroke({ width: 1, color: 0xcccccc });
  // Handle
  g.moveTo(x + 5, y - 3);
  g.lineTo(x + 6, y - 1);
  g.stroke({ width: 1, color: 0xcccccc });

  parent.addChild(g);
}

/**
 * Potted plant with leaves. size parameter scales the plant.
 */
export function drawPlant(
  parent: Container,
  col: number,
  row: number,
  size: number = 1.0,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const potW = 8 * size;
  const potH = 6 * size;

  // Pot
  g.rect(x - potW / 2, y - potH, potW, potH);
  g.fill(PLANT_POT);
  g.stroke({ width: 1, color: 0x7a5a3a });

  // Leaf circles
  const leafR = 5 * size;
  g.circle(x, y - potH - leafR, leafR);
  g.fill(PLANT_GREEN);

  g.circle(x - leafR * 0.7, y - potH - leafR * 0.6, leafR * 0.8);
  g.fill(PLANT_DARK_GREEN);

  g.circle(x + leafR * 0.7, y - potH - leafR * 0.6, leafR * 0.8);
  g.fill(PLANT_GREEN);

  g.circle(x, y - potH - leafR * 1.6, leafR * 0.6);
  g.fill(PLANT_DARK_GREEN);

  parent.addChild(g);
}

/**
 * Whiteboard with frame, white background, and scribble lines.
 */
export function drawWhiteboard(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const w = 26;
  const h = 18;

  // Frame
  g.rect(x - w / 2 - 2, y - h - 4, w + 4, h + 4);
  g.fill(WHITEBOARD_FRAME);

  // White background
  g.rect(x - w / 2, y - h - 2, w, h);
  g.fill(WHITEBOARD_BG);

  // Scribble lines
  g.moveTo(x - w / 2 + 3, y - h + 2);
  g.lineTo(x + w / 2 - 5, y - h + 2);
  g.stroke({ width: 1, color: 0x4466aa });

  g.moveTo(x - w / 2 + 3, y - h + 6);
  g.lineTo(x + w / 2 - 8, y - h + 6);
  g.stroke({ width: 1, color: 0xaa4444 });

  g.moveTo(x - w / 2 + 3, y - h + 10);
  g.lineTo(x + w / 2 - 3, y - h + 10);
  g.stroke({ width: 1, color: 0x44aa44 });

  parent.addChild(g);
}

/**
 * Bookshelf with wood frame, shelves, and deterministic colored books.
 */
export function drawBookshelf(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const w = 22;
  const h = 24;

  // Wood frame
  g.rect(x - w / 2, y - h, w, h);
  g.fill(BOOKSHELF_WOOD);
  g.stroke({ width: 1, color: 0x4a3020 });

  // 3 shelves
  const shelfCount = 3;
  const shelfH = h / shelfCount;
  for (let s = 0; s < shelfCount; s++) {
    const sy = y - h + s * shelfH + shelfH;
    // Shelf line
    g.moveTo(x - w / 2 + 1, sy);
    g.lineTo(x + w / 2 - 1, sy);
    g.stroke({ width: 1, color: 0x4a3020 });

    // Books on this shelf (deterministic colors)
    const bookCount = 4;
    const bookW = (w - 4) / bookCount;
    for (let b = 0; b < bookCount; b++) {
      const colorIdx = ((s * 4 + b) * 7) % BOOK_COLORS.length;
      const bx = x - w / 2 + 2 + b * bookW;
      const bookH = shelfH - 3;
      g.rect(bx, sy - bookH, bookW - 1, bookH);
      g.fill(BOOK_COLORS[colorIdx]);
    }
  }

  parent.addChild(g);
}

/**
 * Water cooler with base, blue water jug, and spout.
 */
export function drawWaterCooler(
  parent: Container,
  col: number,
  row: number,
): void {
  const g = new Graphics();
  const { x, y } = isoToScreen(col, row);

  const baseW = 10;
  const baseH = 12;
  const jugR = 5;

  // Base
  g.rect(x - baseW / 2, y - baseH, baseW, baseH);
  g.fill(0x888899);
  g.stroke({ width: 1, color: 0x777788 });

  // Water jug (circle on top)
  g.circle(x, y - baseH - jugR + 1, jugR);
  g.fill(0x88bbee);
  g.stroke({ width: 1, color: 0x6699cc });

  // Spout
  g.rect(x - 1, y - 4, 2, 3);
  g.fill(0xaaaaaa);

  // Drip tray
  g.rect(x - 3, y - 1, 6, 2);
  g.fill(0x666677);

  parent.addChild(g);
}
