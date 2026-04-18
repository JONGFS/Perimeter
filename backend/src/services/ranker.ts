import type { Filters, Intent, Place } from './foursquare';

export type Ranked = Place & {
  score: number;
  reason: string;
};

type Component = { key: string; weight: number; value: number };

const MAX_DISTANCE_M: Record<Intent, number> = {
  eat_out: 3200,
  cook_dine_in: 6400,
};

const EAT_OUT_TYPE_FIT: Record<string, number> = {
  Restaurant: 1,
  Cafe: 0.7,
  'Fast Food': 0.85,
};

const COOK_TYPE_FIT: Record<string, number> = {
  Supermarket: 1,
  'Grocery Store': 0.9,
  'Convenience Store': 0.5,
};

const REASONS: Record<string, string> = {
  distance: 'closest option to you',
  open_now: 'open right now',
  type_fit: 'best match for what you want',
  rating: 'highest rated nearby',
  price_fit: 'best fit for your budget',
  category_match: 'best store for a full grocery run',
  budget_fit: 'best fit for your budget',
  stop_suitability: 'good quality stop',
};

function priceFit(price: Place['price'], budget: Filters['budget']): number {
  if (price == null) return 0.5;
  if (!budget) return 1 - (price - 1) / 4;
  const target = budget === 'low' ? 1 : budget === 'medium' ? 2 : 3;
  const diff = Math.abs(price - target);
  return Math.max(0, 1 - diff / 3);
}

function score(place: Place, intent: Intent, filters: Filters): { score: number; components: Component[] } {
  const distNorm = 1 - Math.min(1, place.distance_meters / MAX_DISTANCE_M[intent]);
  const openNow = place.open_now === true ? 1 : place.open_now === false ? 0 : 0.5;
  const ratingNorm = place.rating != null ? place.rating / 10 : 0.5;

  let components: Component[];

  if (intent === 'eat_out') {
    const typeFit = EAT_OUT_TYPE_FIT[place.type] ?? 0.6;
    components = [
      { key: 'distance', weight: 0.30, value: distNorm },
      { key: 'open_now', weight: 0.20, value: openNow },
      { key: 'type_fit', weight: 0.20, value: typeFit },
      { key: 'rating', weight: 0.15, value: ratingNorm },
      { key: 'price_fit', weight: 0.15, value: priceFit(place.price, filters.budget) },
    ];
  } else {
    const categoryMatch = COOK_TYPE_FIT[place.type] ?? 0.5;
    components = [
      { key: 'category_match', weight: 0.30, value: categoryMatch },
      { key: 'distance', weight: 0.20, value: distNorm },
      { key: 'budget_fit', weight: 0.20, value: priceFit(place.price, filters.budget) },
      { key: 'open_now', weight: 0.15, value: openNow },
      { key: 'stop_suitability', weight: 0.15, value: ratingNorm },
    ];
  }

  const total = components.reduce((sum, c) => sum + c.weight * c.value, 0);
  return { score: total, components };
}

function dominantReason(components: Component[]): string {
  const top = [...components].sort((a, b) => b.weight * b.value - a.weight * a.value)[0];
  return REASONS[top.key] ?? 'good overall match';
}

export function rank(places: Place[], intent: Intent, filters: Filters = {}): Ranked[] {
  return places
    .map((p) => {
      const { score: s, components } = score(p, intent, filters);
      return { ...p, score: s, reason: dominantReason(components) };
    })
    .sort((a, b) => b.score - a.score);
}
