import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import type { AppConfig } from '../types/config.js';

export function createAgentDataRoutes(config: AppConfig, contentRoot: string): Router {
  const router = Router();

  router.get('/agent-data/:agentKey/:tabId', (req, res) => {
    const { agentKey, tabId } = req.params;
    const agent = config.agents[agentKey as string];
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

    const tab = agent.tabs.find((t) => t.id === tabId);
    if (!tab) { res.status(404).json({ error: 'Tab not found' }); return; }

    const source = tab.source;

    if (source.startsWith('file:')) {
      const filePath = path.join(contentRoot, 'data', source.slice(5));
      if (!fs.existsSync(filePath)) { res.json(null); return; }
      const ext = path.extname(filePath);
      if (ext === '.json') {
        res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
      } else {
        res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
      }
      return;
    }

    if (source === 'memory') {
      const memPath = path.join(contentRoot, 'memory', 'agents', `${agentKey}.md`);
      if (fs.existsSync(memPath)) {
        res.type('text/plain').send(fs.readFileSync(memPath, 'utf-8'));
      } else {
        res.type('text/plain').send('');
      }
      return;
    }

    res.status(400).json({ error: `Unsupported source type: ${source}` });
  });

  return router;
}
