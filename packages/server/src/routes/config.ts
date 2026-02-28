import { Router } from 'express';
import type { AppConfig } from '../types/config.js';

export function createConfigRouter(config: AppConfig): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    // Strip gateway secrets before sending to client
    const { gateway: _gateway, ...safeConfig } = config;
    res.json(safeConfig);
  });

  return router;
}
