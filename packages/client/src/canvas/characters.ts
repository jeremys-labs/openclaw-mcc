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
      // Headband arc
      g.arc(0, -32, 8, Math.PI, 0);
      g.stroke({ width: 2, color: 0x333333 });
      // Ear circles
      g.circle(-8, -28, 3);
      g.fill(0x333333);
      g.circle(8, -28, 3);
      g.fill(0x333333);
      // Mic arm
      g.moveTo(-8, -28);
      g.lineTo(-10, -22);
      g.lineTo(-8, -20);
      g.stroke({ width: 1.5, color: 0x333333 });
      break;
    }
    case 'headphones': {
      // Headband arc
      g.arc(0, -32, 9, Math.PI, 0);
      g.stroke({ width: 2.5, color: 0x222222 });
      // Ear cup rectangles (larger)
      g.roundRect(-12, -31, 5, 7, 1);
      g.fill(0x222222);
      g.roundRect(7, -31, 5, 7, 1);
      g.fill(0x222222);
      break;
    }
    case 'coffee-mug': {
      // White mug at right hand
      g.roundRect(9, -12, 6, 7, 1);
      g.fill(0xffffff);
      // Handle arc
      g.arc(15, -8, 3, -Math.PI / 2, Math.PI / 2, false);
      g.stroke({ width: 1.5, color: 0xffffff });
      // Steam curves
      g.moveTo(10, -13);
      g.bezierCurveTo(10, -16, 12, -16, 12, -13);
      g.stroke({ width: 1, color: 0xcccccc, alpha: 0.6 });
      g.moveTo(13, -13);
      g.bezierCurveTo(13, -17, 15, -17, 15, -14);
      g.stroke({ width: 1, color: 0xcccccc, alpha: 0.5 });
      break;
    }
    case 'glasses-notepad': {
      // Two circle outlines for glasses
      g.circle(-3, -28, 3);
      g.stroke({ width: 1, color: 0x555555 });
      g.circle(3, -28, 3);
      g.stroke({ width: 1, color: 0x555555 });
      // Bridge
      g.moveTo(0, -28);
      g.lineTo(0, -28);
      g.moveTo(-0.5, -28);
      g.lineTo(0.5, -28);
      g.stroke({ width: 1, color: 0x555555 });
      // Yellow notepad in left hand
      g.roundRect(-16, -14, 7, 9, 1);
      g.fill(0xeeee55);
      // Lines on notepad
      for (let i = 0; i < 4; i++) {
        g.moveTo(-15, -12 + i * 2);
        g.lineTo(-11, -12 + i * 2);
        g.stroke({ width: 0.5, color: 0x888855 });
      }
      break;
    }
    case 'tablet': {
      // Dark rectangle held in front
      g.roundRect(-5, -16, 10, 13, 1);
      g.fill(0x222233);
      // Blue screen
      g.roundRect(-4, -15, 8, 10, 1);
      g.fill(0x4488cc);
      break;
    }
    case 'chef-hat': {
      // Tall white toque
      g.roundRect(-6, -46, 12, 14, 3);
      g.fill(0xffffff);
      // Brim
      g.roundRect(-8, -34, 16, 3, 1);
      g.fill(0xf0f0f0);
      // White apron overlay on body
      g.roundRect(-6, -20, 12, 12, 1);
      g.fill({ color: 0xffffff, alpha: 0.7 });
      break;
    }
    case 'headband': {
      // Red arc over head
      g.arc(0, -30, 8, Math.PI + 0.3, -0.3);
      g.stroke({ width: 2.5, color: 0xcc2222 });
      break;
    }
    case 'glasses-tie': {
      // Circle outlines for glasses
      g.circle(-3, -28, 3);
      g.stroke({ width: 1, color: 0x444444 });
      g.circle(3, -28, 3);
      g.stroke({ width: 1, color: 0x444444 });
      // Bridge
      g.moveTo(-0.5, -28);
      g.lineTo(0.5, -28);
      g.stroke({ width: 1, color: 0x444444 });
      // Red diamond tie shape
      g.poly([
        { x: 0, y: -20 },
        { x: -3, y: -15 },
        { x: 0, y: -8 },
        { x: 3, y: -15 },
      ]);
      g.fill(0xcc2222);
      break;
    }
    case 'backpack': {
      // Green rectangle behind body
      g.roundRect(-9, -22, 18, 16, 2);
      g.fill(0x337744);
      // Shoulder straps
      g.moveTo(-5, -22);
      g.lineTo(-5, -14);
      g.stroke({ width: 2, color: 0x225533 });
      g.moveTo(5, -22);
      g.lineTo(5, -14);
      g.stroke({ width: 2, color: 0x225533 });
      break;
    }
    case 'lanyard': {
      // Blue curve from neck
      g.moveTo(-2, -21);
      g.bezierCurveTo(-4, -14, 0, -10, 0, -6);
      g.stroke({ width: 1.5, color: 0x3366aa });
      g.moveTo(2, -21);
      g.bezierCurveTo(4, -14, 0, -10, 0, -6);
      g.stroke({ width: 1.5, color: 0x3366aa });
      // Badge rectangle hanging
      g.roundRect(-3, -7, 6, 5, 1);
      g.fill(0xeeeeee);
      g.roundRect(-2, -6, 4, 2, 0);
      g.fill(0x3366aa);
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
