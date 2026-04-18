import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { searchNearby } from '../services/foursquare';
import { rank } from '../services/ranker';

export const router = Router();

const bodySchema = z.object({
  intent: z.enum(['eat_out', 'cook_dine_in']),
  location: z.object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
    accuracy: z.number().positive().optional(),
  }),
  filters: z
    .object({
      budget: z.enum(['low', 'medium', 'high']).optional(),
      open_now: z.boolean().optional(),
      time_minutes: z.number().int().positive().optional(),
      goal: z.enum(['quick', 'healthy', 'high_protein', 'cheap']).optional(),
    })
    .optional(),
});

router.post('/recommendations', async (req: Request, res: Response) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
    return;
  }

  const { intent, location, filters } = parsed.data;

  if (location.accuracy != null && location.accuracy > 500) {
    res.status(400).json({ error: 'location_accuracy_too_low', accuracy: location.accuracy });
    return;
  }

  try {
    const places = await searchNearby({
      lat: location.lat,
      lng: location.lng,
      intent,
      filters,
    });

    if (places.length === 0) {
      res.json({ best_option: null, alternatives: [] });
      return;
    }

    const ranked = rank(places, intent, filters);
    const [best, ...rest] = ranked;

    res.json({
      best_option: best,
      alternatives: rest.slice(0, 3),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(502).json({ error: 'upstream_failure', message });
  }
});
