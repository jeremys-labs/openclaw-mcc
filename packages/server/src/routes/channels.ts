import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export function createChannelRoutes(contentRoot: string): Router {
  const router = Router();
  const interactionsPath = path.join(contentRoot, 'memory', 'agent-interactions.json');

  router.get('/channels', (_req, res) => {
    try {
      if (fs.existsSync(interactionsPath)) {
        const data = JSON.parse(fs.readFileSync(interactionsPath, 'utf-8'));
        res.json(data);
      } else {
        res.json({ channels: [], interactions: [] });
      }
    } catch {
      res.json({ channels: [], interactions: [] });
    }
  });

  return router;
}
