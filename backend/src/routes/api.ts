import { Router, Request, Response } from 'express';

export const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/items', (_req: Request, res: Response) => {
  res.json([
    { id: 1, name: 'Item One' },
    { id: 2, name: 'Item Two' },
  ]);
});

router.post('/items', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json({ id: Date.now(), name });
});
