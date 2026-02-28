import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export function createStandupRoutes(contentRoot: string): Router {
  const router = Router();
  const standupPath = path.join(contentRoot, 'data', 'standup.json');

  router.get('/standup', (_req, res) => {
    try {
      if (fs.existsSync(standupPath)) {
        const data = JSON.parse(fs.readFileSync(standupPath, 'utf-8'));
        res.json(data);
      } else {
        res.json({ date: null, agents: {} });
      }
    } catch {
      res.json({ date: null, agents: {} });
    }
  });

  return router;
}
