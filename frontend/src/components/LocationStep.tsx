import { useState } from 'react';
import { getCurrentLocation, type Coords } from '../lib/geolocation';

type Props = {
  onLocation: (coords: Coords) => void;
  disabled?: boolean;
  loading?: boolean;
};

export function LocationStep({ onLocation, disabled, loading }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [address, setAddress] = useState('');

  const handleClick = async () => {
    setError(null);
    try {
      const coords = await getCurrentLocation();
      onLocation(coords);
    } catch (e) {
      setError((e as Error).message);
      setShowFallback(true);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className="w-full rounded-xl bg-blue-600 text-white px-4 py-3 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Finding options near you…' : '📍 Use my location'}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {showFallback && (
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <label className="text-xs text-gray-500">Or enter an address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Atlanta, GA"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400">
            Address lookup is coming soon. For now, please allow location access.
          </p>
        </div>
      )}
    </div>
  );
}
