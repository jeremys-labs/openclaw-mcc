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
      const fileName = source.slice(5);
      const baseName = fileName.replace(/\.[^.]+$/, '');

      // Search order: agent-specific workspace dir, then global data dir
      const searchDirs = [
        path.join(contentRoot, 'workspace', 'agents', agentKey as string),
        path.join(contentRoot, 'data'),
      ];

      // Try exact filename, then alternate extension (.md↔.json)
      const candidates = [
        fileName,
        ...(fileName.endsWith('.json') ? [`${baseName}.md`] : [`${baseName}.json`]),
      ];

      let resolved: string | null = null;
      for (const dir of searchDirs) {
        for (const candidate of candidates) {
          const p = path.join(dir, candidate);
          if (fs.existsSync(p)) { resolved = p; break; }
        }
        if (resolved) break;
      }

      if (!resolved) { res.json(null); return; }

      const ext = path.extname(resolved);
      if (ext === '.json') {
        res.json(JSON.parse(fs.readFileSync(resolved, 'utf-8')));
      } else {
        res.type('text/plain').send(fs.readFileSync(resolved, 'utf-8'));
      }
      return;
    }

    if (source === 'about') {
      const aboutPath = path.join(contentRoot, 'workspace', 'agents', agentKey as string, 'about.md');
      if (fs.existsSync(aboutPath)) {
        res.type('text/plain').send(fs.readFileSync(aboutPath, 'utf-8'));
      } else {
        // Fallback until the agent creates their about.md
        const lines = [
          `# ${agent.name}`,
          '',
          `**Role:** ${agent.role}`,
          '',
        ];
        if (agent.quote) lines.push(`> ${agent.quote}`, '');
        lines.push(`**Channel:** ${agent.channel}`);
        res.type('text/plain').send(lines.join('\n'));
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
