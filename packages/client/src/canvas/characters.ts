import { Container, Graphics, Text, TextStyle } from 'pixi.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoleAccessory =
  | 'headset'
  | 'headphones'
  | 'coffee-mug'
  | 'none'
  | 'glasses-notepad'
  | 'tablet'
  | 'chef-hat'
  | 'headband'
  | 'glasses-tie'
  | 'backpack'
  | 'lanyard';

export interface CharacterOpts {
  agentKey: string;
  shirtColor: string;
  accessory: RoleAccessory;
}

// ---------------------------------------------------------------------------
// Role → Accessory mapping
// ---------------------------------------------------------------------------

export function roleToAccessory(role: string): RoleAccessory {
  switch (role.toLowerCase()) {
    case 'chief of staff':
      return 'headset';
    case 'dev manager':
      return 'headphones';
    case 'qa':
      return 'coffee-mug';
    case 'architect':
      return 'none';
    case 'research':
      return 'glasses-notepad';
    case 'marketing':
      return 'tablet';
    case 'chef':
      return 'chef-hat';
    case 'gym':
    case 'coach':
      return 'headband';
    case 'finance':
      return 'glasses-tie';
    case 'travel':
      return 'backpack';
    case 'hr':
      return 'lanyard';
    default:
      return 'none';
  }
}

// ---------------------------------------------------------------------------
// Color helpers (private)
// ---------------------------------------------------------------------------

function hexToNum(hex: string): number {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  return parseInt(clean, 16);
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - amount);
  const g = Math.max(0, ((color >> 8) & 0xff) - amount);
  const b = Math.max(0, (color & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const SKIN_PALETTE = [0xf5d0a9, 0xe8b88a, 0xd4a06a, 0xc08a5a, 0xa0724a, 0x8a5a3a];
const HAIR_PALETTE = [0x2a1a0a, 0x4a3020, 0x8a6a3a, 0x1a1a2a, 0xaa4422, 0x6a3a2a];

function skinToneFromKey(key: string): number {
  return SKIN_PALETTE[hashKey(key) % SKIN_PALETTE.length];
}

function hairColorFromKey(key: string): number {
  return HAIR_PALETTE[hashKey(key + '_hair') % HAIR_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Accessory drawing (private)
// ---------------------------------------------------------------------------

function drawAccessory(g: Graphics, accessory: RoleAccessory, _skinColor: number): void {
  switch (accessory) {
    case 'headset': {
      // Headband — tight arc sitting on top of head (head top at y=-35)
      g.arc(0, -35, 6, Math.PI, 0);
      g.stroke({ width: 2, color: 0x333333 });
      // Ear pads at head sides (head center y=-28, radius 7)
      g.circle(-7, -29, 2.5);
      g.fill(0x333333);
      g.circle(7, -29, 2.5);
      g.fill(0x333333);
      // Mic arm curving down from left ear
      g.moveTo(-7, -29);
      g.lineTo(-9, -24);
      g.lineTo(-7, -22);
      g.stroke({ width: 1.5, color: 0x333333 });
      // Mic tip
      g.circle(-7, -22, 1.5);
      g.fill(0x444444);
      break;
    }
    case 'headphones': {
      // Headband — tight arc on top of head
      g.arc(0, -35, 7, Math.PI, 0);
      g.stroke({ width: 2, color: 0x222222 });
      // Ear cups flush against head sides
      g.roundRect(-10, -32, 4, 6, 1);
      g.fill(0x222222);
      g.roundRect(6, -32, 4, 6, 1);
      g.fill(0x222222);
      break;
    }
    case 'coffee-mug': {
      // Large white mug held up high (clearly above desk line)
      g.roundRect(11, -22, 7, 9, 1);
      g.fill(0xffffff);
      // Dark coffee inside
      g.roundRect(12, -21, 5, 4, 0);
      g.fill(0x664422);
      // Handle on right
      g.arc(18, -18, 3, -Math.PI / 2, Math.PI / 2, false);
      g.stroke({ width: 2, color: 0xeeeeee });
      // Steam wisps
      g.moveTo(13, -23);
      g.bezierCurveTo(13, -28, 15, -28, 15, -23);
      g.stroke({ width: 1.5, color: 0xcccccc, alpha: 0.7 });
      break;
    }
    case 'glasses-notepad': {
      // Glasses at eye level (eyes at y=-28)
      g.circle(-3, -28, 2.5);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      g.circle(3, -28, 2.5);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      // Bridge connecting lenses
      g.moveTo(-0.5, -28);
      g.lineTo(0.5, -28);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      // Arms extending to ears
      g.moveTo(-5.5, -28);
      g.lineTo(-7, -28);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      g.moveTo(5.5, -28);
      g.lineTo(7, -28);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      // Yellow notepad in left hand
      g.roundRect(-15, -12, 6, 8, 1);
      g.fill(0xeeee55);
      // Lines on notepad
      for (let i = 0; i < 3; i++) {
        g.moveTo(-14, -10 + i * 2);
        g.lineTo(-10, -10 + i * 2);
        g.stroke({ width: 0.5, color: 0x888855 });
      }
      break;
    }
    case 'tablet': {
      // Dark tablet held in front at body level
      g.roundRect(-4, -18, 8, 11, 1);
      g.fill(0x222233);
      // Blue screen
      g.roundRect(-3, -17, 6, 8, 1);
      g.fill(0x4488cc);
      break;
    }
    case 'chef-hat': {
      // Tall white toque sitting on head (head top at y=-35)
      g.roundRect(-6, -47, 12, 13, 3);
      g.fill(0xffffff);
      // Brim resting on head
      g.roundRect(-7, -35, 14, 3, 1);
      g.fill(0xf0f0f0);
      // White apron overlay on body
      g.roundRect(-6, -20, 12, 12, 1);
      g.fill({ color: 0xffffff, alpha: 0.7 });
      break;
    }
    case 'headband': {
      // Solid red filled band across the forehead (filled rect, not stroke)
      g.roundRect(-8, -33, 16, 4, 1);
      g.fill(0xff2222);
      // Knot tails on right side
      g.poly([
        { x: 8, y: -33 },
        { x: 12, y: -30 },
        { x: 11, y: -31 },
        { x: 12, y: -34 },
      ]);
      g.fill(0xdd1111);
      break;
    }
    case 'glasses-tie': {
      // Glasses at eye level
      g.circle(-3, -28, 2.5);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      g.circle(3, -28, 2.5);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      // Bridge
      g.moveTo(-0.5, -28);
      g.lineTo(0.5, -28);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      // Arms
      g.moveTo(-5.5, -28);
      g.lineTo(-7, -28);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      g.moveTo(5.5, -28);
      g.lineTo(7, -28);
      g.stroke({ width: 1.5, color: 0xaaaacc });
      // Red tie (narrower, centered on body)
      g.poly([
        { x: 0, y: -20 },
        { x: -2, y: -16 },
        { x: 0, y: -9 },
        { x: 2, y: -16 },
      ]);
      g.fill(0xcc2222);
      break;
    }
    case 'backpack': {
      // Green pack behind body — wider to peek out on sides
      g.roundRect(-10, -21, 20, 15, 2);
      g.fill(0x44aa66);
      // Darker center panel
      g.roundRect(-6, -19, 12, 10, 1);
      g.fill(0x338855);
      // Shoulder straps (visible on top of shirt)
      g.moveTo(-5, -21);
      g.lineTo(-5, -13);
      g.stroke({ width: 2.5, color: 0x225533 });
      g.moveTo(5, -21);
      g.lineTo(5, -13);
      g.stroke({ width: 2.5, color: 0x225533 });
      // Top flap peeking above shoulders
      g.roundRect(-7, -24, 14, 4, 1);
      g.fill(0x338855);
      break;
    }
    case 'lanyard': {
      // Bright blue V-shaped cord from neck (thicker, brighter)
      g.moveTo(-3, -21);
      g.bezierCurveTo(-4, -14, -1, -10, 0, -5);
      g.stroke({ width: 2.5, color: 0x55aaff });
      g.moveTo(3, -21);
      g.bezierCurveTo(4, -14, 1, -10, 0, -5);
      g.stroke({ width: 2.5, color: 0x55aaff });
      // Larger white badge hanging at bottom
      g.roundRect(-5, -6, 10, 8, 1);
      g.fill(0xf0f0f0);
      // Blue stripe on badge
      g.roundRect(-4, -4, 8, 3, 0);
      g.fill(0x55aaff);
      break;
    }
    case 'none':
      break;
  }
}

// ---------------------------------------------------------------------------
// Main drawing functions
// ---------------------------------------------------------------------------

export function drawCharacter(parent: Container, opts: CharacterOpts): void {
  const g = new Graphics();
  const shirtColor = hexToNum(opts.shirtColor);
  const skinColor = skinToneFromKey(opts.agentKey);
  const hairColor = hairColorFromKey(opts.agentKey);
  const pantsColor = 0x2a2a3a;
  const shoeColor = 0x1a1a25;

  // If backpack, draw it first (behind everything)
  if (opts.accessory === 'backpack') {
    drawAccessory(g, 'backpack', skinColor);
  }

  // 1. Legs: two 4px wide rectangles
  g.rect(-4, -7, 4, 10);
  g.fill(pantsColor);
  g.rect(1, -7, 4, 10);
  g.fill(pantsColor);

  // Shoes
  g.rect(-5, 3, 5, 3);
  g.fill(shoeColor);
  g.rect(1, 3, 5, 3);
  g.fill(shoeColor);

  // 2. Body: roundRect
  g.roundRect(-7, -22, 14, 15, 2);
  g.fill(shirtColor);

  // 3. Arms: 3px wide rectangles on each side
  g.rect(-11, -21, 3, 12);
  g.fill(shirtColor);
  g.rect(8, -21, 3, 12);
  g.fill(shirtColor);

  // Hands (skin-colored)
  g.rect(-11, -9, 3, 3);
  g.fill(skinColor);
  g.rect(8, -9, 3, 3);
  g.fill(skinColor);

  // 4. Head: circle
  g.circle(0, -28, 7);
  g.fill(skinColor);

  // 5. Hair: arc over top half + side hair rects
  g.arc(0, -28, 7, Math.PI, 0);
  g.fill(hairColor);
  // Side hair
  g.rect(-7, -30, 2, 4);
  g.fill(hairColor);
  g.rect(5, -30, 2, 4);
  g.fill(hairColor);

  // 6. Eyes: two tiny circles
  g.circle(-3, -28, 1);
  g.fill(0x1a1a2a);
  g.circle(3, -28, 1);
  g.fill(0x1a1a2a);

  // Draw accessory (skip backpack, already drawn)
  if (opts.accessory !== 'backpack') {
    drawAccessory(g, opts.accessory, skinColor);
  }

  // If headband, draw exposed skin on shoulders (tank top look)
  if (opts.accessory === 'headband') {
    g.rect(-11, -21, 3, 3);
    g.fill(skinColor);
    g.rect(8, -21, 3, 3);
    g.fill(skinColor);
  }

  parent.addChild(g);
}

export function drawNameLabel(parent: Container, name: string, y: number): void {
  const style = new TextStyle({
    fontSize: 9,
    fill: 0xd0d0e0,
    fontFamily: 'monospace',
    dropShadow: {
      color: 0x000000,
      alpha: 0.6,
      blur: 2,
      distance: 1,
    },
  });
  const text = new Text({ text: name, style });
  text.anchor.set(0.5, 0);
  text.y = y;
  parent.addChild(text);
}
