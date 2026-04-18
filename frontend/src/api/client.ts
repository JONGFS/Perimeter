const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};

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
  score: number;
  reason: string;
};

export type RecommendationsResponse = {
  best_option: Place | null;
  alternatives: Place[];
};

export function getRecommendations(body: {
  intent: Intent;
  location: { lat: number; lng: number; accuracy?: number };
  filters?: Filters;
}) {
  return api.post<RecommendationsResponse>('/recommendations', body);
}
