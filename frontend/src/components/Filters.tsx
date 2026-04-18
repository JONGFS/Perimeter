import { useState } from 'react';
import type { Filters as FiltersType } from '../api/client';

type Props = {
  value: FiltersType;
  onChange: (filters: FiltersType) => void;
};

const BUDGETS: Array<{ value: NonNullable<FiltersType['budget']>; label: string }> = [
  { value: 'low', label: '$' },
  { value: 'medium', label: '$$' },
  { value: 'high', label: '$$$' },
];

const GOALS: Array<{ value: NonNullable<FiltersType['goal']>; label: string }> = [
  { value: 'quick', label: 'Quick' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'high_protein', label: 'High protein' },
  { value: 'cheap', label: 'Cheap' },
];

export function Filters({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
      >
        <span>Filters (optional)</span>
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <div className="text-xs text-gray-500 mb-2">Budget</div>
            <div className="flex gap-2">
              {BUDGETS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() =>
                    onChange({ ...value, budget: value.budget === b.value ? undefined : b.value })
                  }
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    value.budget === b.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-2">Priority</div>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() =>
                    onChange({ ...value, goal: value.goal === g.value ? undefined : g.value })
                  }
                  className={`px-3 py-1.5 rounded-full text-sm border ${
                    value.goal === g.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={value.open_now ?? false}
              onChange={(e) => onChange({ ...value, open_now: e.target.checked || undefined })}
            />
            Open now
          </label>
        </div>
      )}
    </div>
  );
}
