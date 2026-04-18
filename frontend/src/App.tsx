import { useMemo, useState } from 'react';

type LocationMode = 'home' | 'onRoad' | 'airport';

type EnergyMode = 'low' | 'steady' | 'high';

interface QuickSwap {
  avoid: string;
  choose: string;
}

const quickSwaps: QuickSwap[] = [
  { avoid: 'Sugary energy drink', choose: 'Unsweetened cold brew + nuts' },
  { avoid: 'Bag of chips', choose: 'Popcorn + jerky combo' },
  { avoid: 'Pastry breakfast', choose: 'Greek yogurt + fruit cup' },
  { avoid: 'Creamy pasta late night', choose: 'Protein bowl with greens' },
];

const dayTimeline = [
  { time: '07:00', title: 'Hydration check', action: 'Start with 16oz water before caffeine.' },
  { time: '12:30', title: 'Road meal audit', action: 'Aim for protein + produce + fiber.' },
  { time: '18:15', title: 'Late assignment backup', action: 'Choose a portable snack before deadlines.' },
];

function buildCoachTip(location: LocationMode, energy: EnergyMode, notes: string): string {
  const locationTip = {
    home: 'You are home, so use your kitchen advantage: build a 3-part plate (protein, color, carb).',
    onRoad: 'On the road, order by structure: grilled protein first, then add produce, then carbs.',
    airport: 'At the airport, anchor every meal with protein and skip liquid calories.',
  }[location];

  const energyTip = {
    low: 'Low energy mode: prioritize stable fuel, not sugar spikes.',
    steady: 'Steady energy mode: maintain balance and avoid heavy meals before work blocks.',
    high: 'High output mode: add extra carbs around active windows for recovery.',
  }[energy];

  if (!notes.trim()) {
    return `${locationTip} ${energyTip}`;
  }

  return `${locationTip} ${energyTip} Based on your note, start with one realistic win in the next 60 minutes: ${notes.trim()}.`;
}

export default function App() {
  const [location, setLocation] = useState<LocationMode>('onRoad');
  const [energy, setEnergy] = useState<EnergyMode>('steady');
  const [notes, setNotes] = useState('I have a live segment in 90 minutes and only a gas station nearby.');

  const coachMessage = useMemo(() => buildCoachTip(location, energy, notes), [location, energy, notes]);

  return (
    <div className="min-h-screen p-5 md:p-9 app-shell">
      <div className="ambient-layer" aria-hidden="true" />

      <main className="mx-auto max-w-6xl">
        <header className="rounded-3xl panel p-6 md:p-8 mb-6 reveal-up">
          <p className="kicker">Perimeter Coach v1</p>
          <h1 className="title mt-3 mb-3">Healthy Decisions In Real Time, Even On Deadline</h1>
          <p className="subtitle max-w-3xl">
            Built for national correspondents with unpredictable schedules. Describe your context and get practical, immediate nutrition guidance you can follow in the real world.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="panel rounded-3xl p-6 md:p-8 reveal-up delay-1">
            <h2 className="section-title mb-5">What Is Your Situation Right Now?</h2>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <label className="control">
                <span>Location</span>
                <select value={location} onChange={(e) => setLocation(e.target.value as LocationMode)}>
                  <option value="home">At home</option>
                  <option value="onRoad">On the road</option>
                  <option value="airport">Airport / transit</option>
                </select>
              </label>

              <label className="control">
                <span>Energy level</span>
                <select value={energy} onChange={(e) => setEnergy(e.target.value as EnergyMode)}>
                  <option value="low">Low</option>
                  <option value="steady">Steady</option>
                  <option value="high">High output</option>
                </select>
              </label>
            </div>

            <label className="control mb-5">
              <span>Context note</span>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Example: I only have 10 minutes and need something filling before filming."
              />
            </label>

            <div className="coach-card">
              <p className="coach-label">Live Coach Suggestion</p>
              <p className="coach-text">{coachMessage}</p>
            </div>
          </article>

          <aside className="space-y-6 reveal-up delay-2">
            <article className="panel rounded-3xl p-6">
              <h3 className="section-title mb-4">Quick Swaps</h3>
              <ul className="space-y-3">
                {quickSwaps.map((swap) => (
                  <li key={swap.avoid} className="swap-row">
                    <p className="swap-avoid">Skip: {swap.avoid}</p>
                    <p className="swap-choose">Choose: {swap.choose}</p>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel rounded-3xl p-6">
              <h3 className="section-title mb-4">Today&apos;s Coach Timeline</h3>
              <ul className="space-y-3">
                {dayTimeline.map((entry) => (
                  <li key={entry.time} className="timeline-row">
                    <p className="timeline-time">{entry.time}</p>
                    <div>
                      <p className="timeline-title">{entry.title}</p>
                      <p className="timeline-action">{entry.action}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </aside>
        </section>
      </main>
    </div>
  );
}
