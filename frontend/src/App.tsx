import { useEffect, useState } from 'react';
import { api } from './api/client';

interface Item {
  id: number;
  name: string;
}

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Item[]>('/items')
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      const created = await api.post<Item>('/items', { name: newItem.trim() });
      setItems((prev) => [...prev, created]);
      setNewItem('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Fullstack Template</h1>

        <form onSubmit={addItem} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="New item name..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </form>

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                {item.name}
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-gray-400 text-sm text-center py-4">No items yet.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
