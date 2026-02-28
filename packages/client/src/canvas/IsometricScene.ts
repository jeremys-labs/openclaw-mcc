import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import EventEmitter from 'eventemitter3';
import type { AgentConfig } from '../types/agent';
import { TILE_WIDTH, TILE_HEIGHT, isoToScreen } from './tiles';

export class IsometricScene extends EventEmitter {
  private app: Application;
  private world: Container;
  private agents: Record<string, AgentConfig>;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private worldStart = { x: 0, y: 0 };

  constructor(app: Application, agents: Record<string, AgentConfig>) {
    super();
    this.app = app;
    this.agents = agents;
    this.world = new Container();
    this.app.stage.addChild(this.world);
    this.setupPanZoom();
  }

  render(): void {
    this.drawFloor(12, 10);
    this.drawAgents();
    // Center the world
    this.world.x = this.app.screen.width / 2;
    this.world.y = 100;
  }

  private drawFloor(cols: number, rows: number): void {
    const floor = new Graphics();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const { x, y } = isoToScreen(c, r);
        const color = (r + c) % 2 === 0 ? 0x2d2d4a : 0x25253e;
        floor.poly([
          { x, y },
          { x: x + TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 },
          { x, y: y + TILE_HEIGHT },
          { x: x - TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 },
        ]);
        floor.fill(color);
        floor.stroke({ width: 1, color: 0x3d3d5a, alpha: 0.3 });
      }
    }
    this.world.addChild(floor);
  }

  private drawAgents(): void {
    for (const [key, agent] of Object.entries(this.agents)) {
      const pos = agent.position || { x: 1, y: 1 };
      const { x, y } = isoToScreen(pos.x, pos.y);

      const container = new Container();
      container.x = x;
      container.y = y;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      // Colored circle as placeholder avatar
      const circle = new Graphics();
      circle.circle(0, -16, 20);
      circle.fill(parseInt(agent.color.from.replace('#', ''), 16));
      container.addChild(circle);

      // Emoji label
      const label = new Text({
        text: agent.emoji,
        style: new TextStyle({ fontSize: 24 }),
      });
      label.anchor.set(0.5, 0.5);
      label.y = -16;
      container.addChild(label);

      // Name below
      const nameText = new Text({
        text: agent.name,
        style: new TextStyle({ fontSize: 10, fill: 0xf1f5f9 }),
      });
      nameText.anchor.set(0.5, 0);
      nameText.y = 8;
      container.addChild(nameText);

      container.on('pointerdown', (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        this.emit('agentClick', key);
      });
      this.world.addChild(container);
    }
  }

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

    stage.on('pointerup', () => { this.isDragging = false; });
    stage.on('pointerupoutside', () => { this.isDragging = false; });

    // Zoom with mouse wheel
    this.app.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const scale = this.world.scale.x;
      const newScale = Math.max(0.3, Math.min(3, scale - e.deltaY * 0.001));
      this.world.scale.set(newScale);
    }, { passive: false });
  }

  destroy(): void {
    this.world.destroy({ children: true });
  }
}
