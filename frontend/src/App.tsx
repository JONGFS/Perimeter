import { useState } from 'react';
import {
  getRecommendations,
  type Filters as FiltersType,
  type Intent,
  type RecommendationsResponse,
} from './api/client';
import type { Coords } from './lib/geolocation';
import { IntentPicker } from './components/IntentPicker';
import { LocationStep } from './components/LocationStep';
import { Filters } from './components/Filters';
import { Results } from './components/Results';

export default function App() {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [filters, setFilters] = useState<FiltersType>({});
  const [results, setResults] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocation = async (coords: Coords) => {
    if (!intent) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getRecommendations({
        intent,
        location: coords,
        filters: Object.keys(filters).length ? filters : undefined,
      });
      setResults(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResults(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-6 pt-12">
      <div className="w-full max-w-md space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">Perimeter</h1>
          <p className="text-sm text-gray-500 mt-1">
            What are the best options around you right now?
          </p>
        </header>

        {!results && (
          <>
            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-gray-500">1. Pick a mode</div>
              <IntentPicker value={intent} onChange={setIntent} />
            </section>

            {intent && (
              <>
                <section className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500">
                    2. Tune (optional)
                  </div>
                  <Filters value={filters} onChange={setFilters} />
                </section>

                <section className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-gray-500">
                    3. Find options
                  </div>
                  <LocationStep onLocation={handleLocation} loading={loading} />
                </section>
              </>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </>
        )}

        {results && <Results data={results} onReset={reset} />}
      </div>
    </div>
  );
}
