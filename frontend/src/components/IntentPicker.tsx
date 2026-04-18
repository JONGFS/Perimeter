import type { Intent } from '../api/client';

type Props = {
  value: Intent | null;
  onChange: (intent: Intent) => void;
};

const OPTIONS: Array<{ value: Intent; title: string; subtitle: string; emoji: string }> = [
  { value: 'eat_out', title: 'Eat out', subtitle: 'Restaurants, cafes, takeout', emoji: '🍽️' },
  { value: 'cook_dine_in', title: 'Cook and dine in', subtitle: 'Grocery stores nearby', emoji: '🛒' },
];

export function IntentPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              active
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">{opt.emoji}</div>
            <div className="font-semibold text-gray-900">{opt.title}</div>
            <div className="text-xs text-gray-500 mt-1">{opt.subtitle}</div>
          </button>
        );
      })}
    </div>
  );
}
