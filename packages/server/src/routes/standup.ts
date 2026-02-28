import { Router } from 'express';
import fs from 'fs';
import path from 'path';

interface RawUpdate {
  agent: string;
  name?: string;
  status?: string;
  workingOn?: string[] | string;
  working_on?: string[] | string;
  blockers?: string | string[];
  learned?: string | string[] | null;
  notes?: string;
}

interface NormalizedAgent {
  status: 'completed' | 'pending' | 'blocked';
  today?: string;
  blockers?: string;
  learned?: string;
}

function normalizeStatus(raw: string | undefined): 'completed' | 'pending' | 'blocked' {
  if (!raw) return 'pending';
  const lower = raw.toLowerCase();
  if (['blocked', 'critical'].some((s) => lower.includes(s))) return 'blocked';
  if (['green', 'deployed', 'completed', 'done', 'ready'].some((s) => lower.includes(s))) return 'completed';
  return 'pending';
}

function toStringList(val: string | string[] | null | undefined): string {
  if (!val) return '';
  if (Array.isArray(val)) return val.join('; ');
  return val;
}

export function createStandupRoutes(contentRoot: string): Router {
  const router = Router();

  const standupPaths = [
    path.join(contentRoot, 'workspace', 'office', 'standup.json'),
    path.join(contentRoot, 'workspace', 'office', 'data', 'state', 'standup.json'),
    path.join(contentRoot, 'data', 'standup.json'),
  ];

  router.get('/standup', (_req, res) => {
    for (const p of standupPaths) {
      try {
        if (!fs.existsSync(p)) continue;
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));

        // Already in normalized format
        if (raw.agents && !raw.updates) {
          res.json(raw);
          return;
        }

        // Transform updates array to agents record
        const updates = (raw.updates || []) as RawUpdate[];
        const agents: Record<string, NormalizedAgent> = {};

        for (const u of updates) {
          const workingOn = toStringList(u.workingOn || u.working_on);
          const blockers = toStringList(u.blockers);
          const learned = toStringList(u.learned);

          agents[u.agent] = {
            status: normalizeStatus(u.status),
            today: workingOn || undefined,
            blockers: blockers && blockers.toLowerCase() !== 'none' ? blockers : undefined,
            learned: learned || undefined,
          };
        }

        res.json({
          date: raw.date || null,
          agents,
        });
        return;
      } catch {
        continue;
      }
    }
    res.json({ date: null, agents: {} });
  });

  return router;
}
