export type Intent = 'eat_out' | 'cook_dine_in';

export type Filters = {
  budget?: 'low' | 'medium' | 'high';
  open_now?: boolean;
  time_minutes?: number;
  goal?: 'quick' | 'healthy' | 'high_protein' | 'cheap';
};

export type Place = {
  fsq_id: string;
  name: string;
  type: string;
  distance_meters: number;
  rating?: number;
  price?: 1 | 2 | 3 | 4;
  open_now?: boolean;
  address?: string;
  lat: number;
  lng: number;
};

const FSQ_BASE = 'https://places-api.foursquare.com/places/search';
const FSQ_API_VERSION = '2025-06-17';

const CATEGORIES: Record<Intent, string[]> = {
  eat_out: [
    '4d4b7105d754a06374d81259',
    '4bf58dd8d48988d16d941735',
    '4bf58dd8d48988d16e941735',
  ],
  cook_dine_in: [
    '4bf58dd8d48988d118951735',
    '52f2ab2ebcbc57f1066b8b46',
    '4d954b0ea243a5684a65b473',
  ],
};

const RADIUS_METERS: Record<Intent, number> = {
  eat_out: 3200,
  cook_dine_in: 6400,
};

type FsqResponse = {
  results: Array<{
    fsq_place_id: string;
    name: string;
    distance?: number;
    categories?: Array<{ name: string; short_name?: string }>;
    latitude: number;
    longitude: number;
    location?: { formatted_address?: string };
  }>;
};

export async function searchNearby(args: {
  lat: number;
  lng: number;
  intent: Intent;
  filters?: Filters;
}): Promise<Place[]> {
  const { lat, lng, intent } = args;
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) throw new Error('FOURSQUARE_API_KEY is not set');

  const params = new URLSearchParams({
    ll: `${lat},${lng}`,
    fsq_category_ids: CATEGORIES[intent].join(','),
    radius: String(RADIUS_METERS[intent]),
    sort: 'DISTANCE',
    limit: '20',
    fields: 'fsq_place_id,name,distance,categories,latitude,longitude,location',
  });

  const res = await fetch(`${FSQ_BASE}?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Places-Api-Version': FSQ_API_VERSION,
      accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Foursquare search failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as FsqResponse;

  return data.results.map((r) => ({
    fsq_id: r.fsq_place_id,
    name: r.name,
    type: r.categories?.[0]?.short_name ?? r.categories?.[0]?.name ?? 'Place',
    distance_meters: r.distance ?? 0,
    address: r.location?.formatted_address,
    lat: r.latitude,
    lng: r.longitude,
  }));
}
