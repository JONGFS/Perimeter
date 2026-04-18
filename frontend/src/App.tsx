const actionCards = [
  {
    title: 'Eat In',
    description: 'Build something from what you already have and get a calmer, home-base plan.',
  },
  {
    title: 'Eat Out',
    description: 'Find a strong option on the go with guidance for menus, takeout, or quick stops.',
  },
];

export default function App() {
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

          <div className="question-block">
            <p className="question-label">What would you like to do today?</p>

            <div className="action-grid">
              {actionCards.map((action) => (
                <button key={action.title} type="button" className="action-button">
                  <span className="action-title">{action.title}</span>
                  <span className="action-description">{action.description}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
