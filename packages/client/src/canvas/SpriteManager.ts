import { Assets, Texture } from 'pixi.js';

export type SpriteState = 'idle' | 'working' | 'walking' | 'talking' | 'meeting';

interface SpriteConfig {
  texture: Texture;
  animations: Record<SpriteState, Texture[]>;
}

export class SpriteManager {
  private sprites = new Map<string, SpriteConfig>();
  private fallbackTexture: Texture | null = null;

  async loadPlaceholders(): Promise<void> {
    this.fallbackTexture = Texture.WHITE;
  }

  async loadAgentSprite(agentKey: string, spritePath?: string): Promise<void> {
    if (!spritePath) return;
    try {
      const texture = await Assets.load(spritePath);
      this.sprites.set(agentKey, {
        texture,
        animations: {
          idle: [texture],
          working: [texture],
          walking: [texture],
          talking: [texture],
          meeting: [texture],
        },
      });
    } catch {
      console.warn(`Failed to load sprite for ${agentKey}, using fallback`);
    }
  }

  getTexture(agentKey: string, state: SpriteState = 'idle'): Texture {
    const config = this.sprites.get(agentKey);
    if (config?.animations[state]?.[0]) return config.animations[state][0];
    if (config?.texture) return config.texture;
    return this.fallbackTexture || Texture.WHITE;
  }

  hasSprite(agentKey: string): boolean {
    return this.sprites.has(agentKey);
  }
}
