import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { IsometricScene } from './IsometricScene';
import { useAgentStore } from '../stores/agentStore';
import { useUIStore } from '../stores/uiStore';

export function OfficeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<IsometricScene | null>(null);
  const agents = useAgentStore((s) => s.agents);
  const openAgentPanel = useUIStore((s) => s.openAgentPanel);

  useEffect(() => {
    if (!containerRef.current || Object.keys(agents).length === 0) return;

    const container = containerRef.current;
    const app = new Application();
    appRef.current = app;

    let destroyed = false;

    (async () => {
      await app.init({
        resizeTo: container,
        background: 0x1a1a2e,
        antialias: true,
      });

      if (destroyed) { app.destroy(true); return; }

      container.appendChild(app.canvas);

      const scene = new IsometricScene(app, agents);
      sceneRef.current = scene;

      scene.on('agentClick', (agentKey: string) => {
        openAgentPanel(agentKey);
      });

      scene.render();
    })();

    return () => {
      destroyed = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [agents, openAgentPanel]);

  return <div ref={containerRef} className="w-full h-full" />;
}
