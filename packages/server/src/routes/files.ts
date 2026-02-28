import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export function createFileRoutes(contentRoot: string): Router {
  const router = Router();
  const filesDir = path.join(contentRoot, 'files');

  router.get('/files', (_req, res) => {
    const result: Record<string, string[]> = {};
    for (const folder of ['inbox', 'approved', 'archive']) {
      const dir = path.join(filesDir, folder);
      try {
        result[folder] = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
      } catch {
        result[folder] = [];
      }
    }
    res.json(result);
  });

  router.get('/files/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    if (!['inbox', 'approved', 'archive'].includes(folder as string)) {
      res.status(400).json({ error: 'Invalid folder' });
      return;
    }
    const filePath = path.join(filesDir, folder as string, filename as string);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.sendFile(filePath);
  });

  router.post('/files/:folder/:filename/move', (req, res) => {
    const { folder, filename } = req.params;
    const { to } = req.body;
    if (!['inbox', 'approved', 'archive'].includes(to)) {
      res.status(400).json({ error: 'Invalid destination' });
      return;
    }
    const src = path.join(filesDir, folder as string, filename as string);
    const dest = path.join(filesDir, to, filename as string);
    try {
      fs.renameSync(src, dest);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
