import { Router, Request, Response } from 'express';
import { router as recommendationsRouter } from './recommendations';

export const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use(recommendationsRouter);
