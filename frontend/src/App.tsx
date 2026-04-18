import { useState } from 'react';
import { api } from './api/client';

type LocationContext = 'airport' | 'campus' | 'downtown' | 'suburb' | 'home' | 'other';
type NutritionGoal =
  | 'high_protein'
  | 'low_calorie'
  | 'energy_focus'
  | 'balanced'
  | 'vegetarian'
  | 'budget';

type Recommendation = {
  recommendation_type: string;
  primary_recommendation: string;
  alternative_options: string[];
  foods_to_avoid: string[];
  rationale: string;
  nutrition_goal_fit: string;
  constraints_considered: string[];
};

type FridgeResult = {
  ingredients_detected: { name: string; category: string; confidence: number }[];
  confidence_summary: { high: number; medium: number; low: number; dropped: number };
  likely_meals: { name: string; ingredients_used: string[]; effort: string; notes: string }[];
  missing_ingredients: { meal: string; need: string[]; impact: string }[];
  perishability_priority: string[];
};

type SpriteLine = {
  line: string;
  mood: 'cheerful' | 'encouraging' | 'playful' | 'gentle' | 'proud';
  followup_prompt: string;
};

type Flow = 'landing' | 'eat_out' | 'eat_in' | 'result';

const locationChoices: { value: LocationContext; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'campus', label: 'Campus' },
  { value: 'airport', label: 'Airport' },
  { value: 'downtown', label: 'Downtown' },
  { value: 'suburb', label: 'Suburb' },
  { value: 'other', label: 'Other' },
];

const goalChoices: { value: NutritionGoal; label: string }[] = [
  { value: 'high_protein', label: 'High protein' },
  { value: 'low_calorie', label: 'Low calorie' },
  { value: 'energy_focus', label: 'Energy / focus' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'budget', label: 'Budget' },
];

const actionCards = [
  {
    key: 'eat_in' as const,
    title: 'Eat In',
    description: 'Build something from what you already have and get a calmer, home-base plan.',
  },
  {
    key: 'eat_out' as const,
    title: 'Eat Out',
    description: 'Find a strong option on the go with guidance for menus, takeout, or quick stops.',
  },
];

export default function App() {
  const [flow, setFlow] = useState<Flow>('landing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [fridgeResult, setFridgeResult] = useState<FridgeResult | null>(null);
  const [sprite, setSprite] = useState<SpriteLine | null>(null);

  const [location, setLocation] = useState<LocationContext>('campus');
  const [goals, setGoals] = useState<NutritionGoal[]>(['balanced']);
  const [ingredientsText, setIngredientsText] = useState('');

  const reset = () => {
    setFlow('landing');
    setRecommendation(null);
    setFridgeResult(null);
    setSprite(null);
    setError(null);
    setLoading(false);
  };

  const toggleGoal = (g: NutritionGoal) => {
    setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  };

  const runEatOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const rec = await api.post<Recommendation>('/location-recommendation', {
        location: { context: location },
        preferences: { goals, dietary_restrictions: [] },
      });
      setRecommendation(rec);
      const spoken = await api.post<SpriteLine>('/sprite/speak', {
        occasion: 'recommendation',
        recommendation: rec,
        user_goal: goals[0] ?? 'balanced',
        location_context: location,
      });
      setSprite(spoken);
      setFlow('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const runEatIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = ingredientsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
      if (raw.length === 0) {
        setError('Add at least one ingredient.');
        setLoading(false);
        return;
      }
      const fridge = await api.post<FridgeResult>('/fridge-interpretation', {
        raw_ingredients: raw,
        preferences: { goals, dietary_restrictions: [] },
      });
      setFridgeResult(fridge);
      const rec = await api.post<Recommendation>('/location-recommendation', {
        location: { context: 'home' },
        preferences: { goals, dietary_restrictions: [] },
        fridge_data: fridge,
      });
      setRecommendation(rec);
      const spoken = await api.post<SpriteLine>('/sprite/speak', {
        occasion: 'recommendation',
        recommendation: rec,
        user_goal: goals[0] ?? 'balanced',
        location_context: 'home',
      });
      setSprite(spoken);
      setFlow('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="welcome-shell">
      <div className="welcome-glow welcome-glow-left" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-right" aria-hidden="true" />

      <main className="welcome-layout">
        <section className="hero-content">
          <h1 className="hero-title">Nourish Orbit</h1>
          <p className="hero-copy">
            Small, smart food decisions for the part of your day you are in right now.
          </p>

          {flow === 'landing' && (
            <div className="question-block">
              <p className="question-label">What would you like to do today?</p>
              <div className="action-grid">
                {actionCards.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="action-button"
                    onClick={() => setFlow(action.key)}
                  >
                    <span className="action-title">{action.title}</span>
                    <span className="action-description">{action.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {flow === 'eat_out' && (
            <div className="flow-panel">
              <button type="button" className="back-link" onClick={reset}>
                ← Back
              </button>
              <h2 className="panel-title">Where are you right now?</h2>
              <div className="chip-row">
                {locationChoices.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`chip ${location === c.value ? 'chip-on' : ''}`}
                    onClick={() => setLocation(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <h2 className="panel-title">What matters most?</h2>
              <div className="chip-row">
                {goalChoices.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`chip ${goals.includes(g.value) ? 'chip-on' : ''}`}
                    onClick={() => toggleGoal(g.value)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={runEatOut}
                disabled={loading}
              >
                {loading ? 'Thinking…' : 'Get a recommendation'}
              </button>
              {error && <p className="error-text">{error}</p>}
            </div>
          )}

          {flow === 'eat_in' && (
            <div className="flow-panel">
              <button type="button" className="back-link" onClick={reset}>
                ← Back
              </button>
              <h2 className="panel-title">What's in your fridge?</h2>
              <p className="panel-hint">One per line, or comma-separated.</p>
              <textarea
                className="ingredient-input"
                rows={5}
                placeholder="eggs&#10;spinach&#10;rice&#10;feta"
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
              />
              <h2 className="panel-title">What matters most?</h2>
              <div className="chip-row">
                {goalChoices.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`chip ${goals.includes(g.value) ? 'chip-on' : ''}`}
                    onClick={() => toggleGoal(g.value)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={runEatIn}
                disabled={loading}
              >
                {loading ? 'Thinking…' : 'Plan a meal'}
              </button>
              {error && <p className="error-text">{error}</p>}
            </div>
          )}

          {flow === 'result' && recommendation && (
            <div className="flow-panel result-panel">
              <button type="button" className="back-link" onClick={reset}>
                ← Start over
              </button>

              {sprite && (
                <div className="sprite-slot">
                  <div className="sprite-placeholder" aria-hidden="true" />
                  <div className="sprite-text">
                    <p className="sprite-line">{sprite.line}</p>
                    {sprite.followup_prompt && (
                      <p className="sprite-followup">{sprite.followup_prompt}</p>
                    )}
                  </div>
                </div>
              )}

              <h2 className="panel-title">{recommendation.primary_recommendation}</h2>
              <p className="panel-rationale">{recommendation.rationale}</p>

              {recommendation.alternative_options?.length > 0 && (
                <div className="result-row">
                  <span className="result-label">Also good</span>
                  <span className="result-value">
                    {recommendation.alternative_options.join(' · ')}
                  </span>
                </div>
              )}
              {recommendation.foods_to_avoid?.length > 0 && (
                <div className="result-row">
                  <span className="result-label">Skip</span>
                  <span className="result-value">
                    {recommendation.foods_to_avoid.join(' · ')}
                  </span>
                </div>
              )}

              {fridgeResult && fridgeResult.likely_meals?.length > 0 && (
                <div className="result-row">
                  <span className="result-label">From your fridge</span>
                  <span className="result-value">
                    {fridgeResult.likely_meals.map((m) => m.name).join(' · ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
