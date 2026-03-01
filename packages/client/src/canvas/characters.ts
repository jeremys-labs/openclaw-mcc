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
      // Headband arc on top of head
      g.arc(0, -35, 7, Math.PI, 0);
      g.stroke({ width: 2.5, color: 0x444444 });
      // Ear pads at head sides
      g.circle(-7, -29, 3);
      g.fill(0x444444);
      g.circle(7, -29, 3);
      g.fill(0x444444);
      // Mic boom — extends visibly outward from left ear
      g.moveTo(-7, -29);
      g.lineTo(-13, -24);
      g.lineTo(-12, -21);
      g.stroke({ width: 2, color: 0x555555 });
      // Bright green mic tip (distinguishes from headphones)
      g.circle(-12, -21, 2.5);
      g.fill(0x44dd44);
      break;
    }
    case 'headphones': {
      // Thicker headband arc
      g.arc(0, -35, 8, Math.PI, 0);
      g.stroke({ width: 3, color: 0x222222 });
      // Larger ear cups — clearly visible
      g.roundRect(-11, -33, 5, 8, 2);
      g.fill(0x222222);
      g.roundRect(6, -33, 5, 8, 2);
      g.fill(0x222222);
      // Inner ear cup detail (colored accent)
      g.roundRect(-10, -31, 3, 4, 1);
      g.fill(0x4444aa);
      g.roundRect(7, -31, 3, 4, 1);
      g.fill(0x4444aa);
      break;
    }
    case 'coffee-mug': {
      // Large white mug held in right hand, clearly right of body
      g.roundRect(12, -20, 9, 11, 2);
      g.fill(0xffffff);
      // Dark coffee inside (brown fill visible from top)
      g.roundRect(13, -19, 7, 5, 1);
      g.fill(0x553311);
      // Handle on right
      g.arc(21, -15, 4, -Math.PI / 2, Math.PI / 2, false);
      g.stroke({ width: 2.5, color: 0xdddddd });
      // Steam wisps — taller and more visible
      g.moveTo(15, -21);
      g.bezierCurveTo(14, -27, 17, -27, 16, -21);
      g.stroke({ width: 2, color: 0xcccccc, alpha: 0.8 });
      g.moveTo(18, -22);
      g.bezierCurveTo(17, -26, 20, -26, 19, -22);
      g.stroke({ width: 1.5, color: 0xcccccc, alpha: 0.6 });
      break;
    }
    case 'glasses-notepad': {
      // Glasses — filled white lenses with colored frames (much more visible)
      g.roundRect(-6, -30, 5, 4, 1);
      g.fill({ color: 0xffffff, alpha: 0.3 });
      g.roundRect(-6, -30, 5, 4, 1);
      g.stroke({ width: 2, color: 0xddddff });
      g.roundRect(1, -30, 5, 4, 1);
      g.fill({ color: 0xffffff, alpha: 0.3 });
      g.roundRect(1, -30, 5, 4, 1);
      g.stroke({ width: 2, color: 0xddddff });
      // Bridge
      g.moveTo(-1, -28);
      g.lineTo(1, -28);
      g.stroke({ width: 2, color: 0xddddff });
      // Large yellow notepad held in left hand
      g.roundRect(-17, -14, 8, 10, 1);
      g.fill(0xffff44);
      // Lines on notepad
      for (let i = 0; i < 4; i++) {
        g.moveTo(-16, -12 + i * 2);
        g.lineTo(-11, -12 + i * 2);
        g.stroke({ width: 0.7, color: 0x888844 });
      }
      break;
    }
    case 'tablet': {
      // Larger tablet with bright glowing screen
      g.roundRect(-5, -19, 10, 13, 2);
      g.fill(0x111122);
      // Bright screen with gradient-like glow
      g.roundRect(-4, -18, 8, 10, 1);
      g.fill(0x55aaff);
      // Screen content lines
      g.moveTo(-2, -16);
      g.lineTo(2, -16);
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
      g.moveTo(-2, -14);
      g.lineTo(2, -14);
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
      break;
    }
    case 'chef-hat': {
      // Tall white toque sitting on head (head top at y=-35)
      g.roundRect(-7, -49, 14, 15, 4);
      g.fill(0xffffff);
      // Brim resting on head
      g.roundRect(-8, -35, 16, 3, 1);
      g.fill(0xf0f0f0);
      // White apron overlay on body
      g.roundRect(-6, -20, 12, 12, 1);
      g.fill({ color: 0xffffff, alpha: 0.75 });
      break;
    }
    case 'headband': {
      // Bright red band across forehead — taller for visibility
      g.roundRect(-8, -34, 16, 5, 1);
      g.fill(0xff2222);
      // Knot tails on right side — larger
      g.poly([
        { x: 8, y: -34 },
        { x: 14, y: -30 },
        { x: 12, y: -31 },
        { x: 14, y: -35 },
      ]);
      g.fill(0xdd1111);
      break;
    }
    case 'glasses-tie': {
      // Glasses — filled white lenses with colored frames
      g.roundRect(-6, -30, 5, 4, 1);
      g.fill({ color: 0xffffff, alpha: 0.3 });
      g.roundRect(-6, -30, 5, 4, 1);
      g.stroke({ width: 2, color: 0xddddff });
      g.roundRect(1, -30, 5, 4, 1);
      g.fill({ color: 0xffffff, alpha: 0.3 });
      g.roundRect(1, -30, 5, 4, 1);
      g.stroke({ width: 2, color: 0xddddff });
      // Bridge
      g.moveTo(-1, -28);
      g.lineTo(1, -28);
      g.stroke({ width: 2, color: 0xddddff });
      // Red tie — wider and more prominent
      g.poly([
        { x: 0, y: -21 },
        { x: -3, y: -16 },
        { x: 0, y: -7 },
        { x: 3, y: -16 },
      ]);
      g.fill(0xcc2222);
      // Tie knot
      g.circle(0, -20, 2);
      g.fill(0xaa1111);
      break;
    }
    case 'backpack': {
      // Green pack behind body — much wider to peek out clearly on sides
      g.roundRect(-13, -23, 26, 18, 3);
      g.fill(0x44bb66);
      // Front pocket detail
      g.roundRect(-8, -19, 16, 10, 2);
      g.fill(0x339955);
      // Shoulder straps visible on top of body
      g.moveTo(-5, -22);
      g.lineTo(-5, -12);
      g.stroke({ width: 3, color: 0x227744 });
      g.moveTo(5, -22);
      g.lineTo(5, -12);
      g.stroke({ width: 3, color: 0x227744 });
      // Top flap peeking above shoulders
      g.roundRect(-9, -26, 18, 5, 2);
      g.fill(0x339955);
      break;
    }
    case 'lanyard': {
      // Bright blue V-shaped cord from neck down to mid-body
      g.moveTo(-4, -21);
      g.lineTo(0, -12);
      g.stroke({ width: 3, color: 0x55bbff });
      g.moveTo(4, -21);
      g.lineTo(0, -12);
      g.stroke({ width: 3, color: 0x55bbff });
      // Large white badge on body (centered, above legs)
      g.roundRect(-5, -13, 10, 8, 2);
      g.fill(0xf0f0f0);
      // Blue stripe on badge
      g.roundRect(-4, -11, 8, 3, 0);
      g.fill(0x55bbff);
      // Name text line
      g.moveTo(-3, -7);
      g.lineTo(3, -7);
      g.stroke({ width: 1, color: 0x888888 });
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
