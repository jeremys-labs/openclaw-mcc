import { Router, Request, Response } from 'express';
import { ChatDB } from '../db.js';

export function createSearchRouter(db: ChatDB): Router {
  const router = Router();

  /**
   * GET /api/search?agent=<agent>&q=<query>
   *
   * Search through an agent's message history.
   * Returns messages where content (case-insensitive) contains the query string.
   */
  router.get('/', (req: Request, res: Response) => {
    const agent = req.query.agent as string;
    const rawQuery = req.query.q as string;
    const query = rawQuery?.trim();

    // Validation
    if (!agent) {
      res.status(400).json({ error: 'agent parameter required' });
      return;
    }

    if (!query) {
      res.status(400).json({ error: 'q parameter required' });
      return;
    }

    // Get all messages for this agent
    const messages = db.getMessages(agent);

    // Filter by query (case-insensitive)
    const queryLower = query.toLowerCase();
    const results = messages.filter((msg) => msg.content.toLowerCase().includes(queryLower));

    res.json({
      agent,
      query,
      total: results.length,
      results: results.map((msg) => ({
        seq: msg.seq,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        agent: msg.agent,
      })),
    });
  });

  return router;
}
