import type { Place, RecommendationsResponse } from '../api/client';

type Props = {
  data: RecommendationsResponse;
  onReset: () => void;
};

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.1) return `${Math.round(meters)} m`;
  return `${miles.toFixed(1)} mi`;
}

function Card({ place, highlight }: { place: Place; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        highlight ? 'border-2 border-blue-600 bg-blue-50' : 'border border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-gray-900">{place.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">{place.type}</div>
        </div>
        <div className="text-sm font-medium text-gray-700">
          {formatDistance(place.distance_meters)}
        </div>
      </div>
      <div className="mt-3 text-sm text-gray-600">{place.reason}</div>
      {place.address && (
        <div className="mt-2 text-xs text-gray-400">{place.address}</div>
      )}
    </div>
  );
}

export function Results({ data, onReset }: Props) {
  if (!data.best_option) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-gray-600">No options found nearby.</p>
        <button
          type="button"
          onClick={onReset}
          className="mt-3 text-sm text-blue-600 hover:underline"
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Best option</div>
        <Card place={data.best_option} highlight />
      </div>

      {data.alternatives.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Alternatives</div>
          <div className="space-y-2">
            {data.alternatives.map((p) => (
              <Card key={p.fsq_id} place={p} />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
      >
        Start over
      </button>
    </div>
  );
}
