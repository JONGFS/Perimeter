import { useEffect, useRef, useState } from 'react';
import stageOneMascot from './assets/stage-1-mascot.png';
import { api } from './api/client';

type VisionFoodItem = {
  name: string;
  quantity?: string | null;
  portion_size?: string | null;
};

type VisionResult = {
  success: boolean;
  food_items: VisionFoodItem[];
  visible_labels?: string[];
  non_food_items?: string[];
  confidence?: string;
  notes?: string | null;
  error?: string | null;
};

type FridgeResult = {
  ingredients_detected: { name: string; category?: string; confidence?: number }[];
  likely_meals: { name: string; ingredients_used: string[]; effort: string; notes?: string }[];
};

type Recommendation = {
  recommendation_type: string;
  primary_recommendation: string;
  alternative_options: string[];
  foods_to_avoid: string[];
  rationale: string;
  nutrition_goal_fit: string;
  constraints_considered: string[];
};

type SpriteLine = {
  line: string;
  mood: string;
  followup_prompt?: string;
};

const homeActions = [
  {
    title: 'Eat In',
    description: 'Build something from what you already have and get a calmer, home-base plan.',
    nextPage: 'eat-in-camera' as const,
  },
  {
    title: 'Eat Out',
    description: 'Find a strong option on the go with guidance for menus, takeout, or quick stops.',
    nextPage: 'eat-out-pick' as const,
  },
];

type LocationContext = 'airport' | 'campus' | 'downtown' | 'suburb' | 'home' | 'other';
type Page = 'welcome' | 'eat-in-camera' | 'eat-in-results' | 'eat-out-pick' | 'eat-out-results';

const locationOptions: { key: LocationContext; label: string; description: string }[] = [
  { key: 'airport', label: 'Airport', description: 'Gates, food courts, limited but scannable.' },
  { key: 'campus', label: 'Campus', description: 'Dining halls, cafes, quick grab-and-go.' },
  { key: 'downtown', label: 'Downtown', description: 'Restaurants, takeout, coffee shops.' },
  { key: 'suburb', label: 'Suburb', description: 'Chains, drive-thru, supermarket deli.' },
  { key: 'other', label: 'Somewhere else', description: 'Whatever is within reach.' },
];
type CameraStatus = 'idle' | 'requesting' | 'ready' | 'blocked' | 'captured';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('welcome');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const [analysisStage, setAnalysisStage] = useState<
    'idle' | 'vision' | 'fridge' | 'recommend' | 'sprite' | 'done' | 'error'
  >('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionResult | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [sprite, setSprite] = useState<SpriteLine | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (!streamRef.current) {
      return;
    }

    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('blocked');
      setCameraError('Camera access is not supported in this browser.');
      return;
    }

    stopCamera();
    setCameraStatus('requesting');
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus('ready');
    } catch (error) {
      setCameraStatus('blocked');
      setCameraError(
        error instanceof Error
          ? error.message
          : 'Camera permission was denied or the device camera is unavailable.',
      );
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const imageData = canvas.toDataURL('image/jpeg', 0.92);

    setCapturedPhoto(imageData);
    setCameraStatus('captured');
    stopCamera();
    setVision(null);
    setRecommendation(null);
    setSprite(null);
    setAnalysisError(null);
    setAnalysisStage('idle');
    setCurrentPage('eat-in-results');
    void runAnalysis(imageData);
  };

  const runAnalysis = async (dataUrl: string) => {
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

      setAnalysisStage('vision');
      const visionRes = await api.post<VisionResult>('/images/analyze', { image: base64 });
      setVision(visionRes);
      if (!visionRes.success || visionRes.food_items.length === 0) {
        throw new Error(visionRes.error ?? 'No food items detected in the photo.');
      }

      setAnalysisStage('fridge');
      const raw_ingredients = visionRes.food_items.map((f) => ({
        name: f.name,
        confidence: 0.9,
      }));
      const fridgeRes = await api.post<FridgeResult>('/fridge-interpretation', {
        raw_ingredients,
      });

      setAnalysisStage('recommend');
      const recRes = await api.post<Recommendation>('/location-recommendation', {
        location: { context: 'home' },
        preferences: { goals: [], dietary_restrictions: [] },
        fridge_data: fridgeRes,
      });
      setRecommendation(recRes);

      setAnalysisStage('sprite');
      const spriteRes = await api.post<SpriteLine>('/sprite/speak', {
        occasion: 'recommendation',
        recommendation: recRes,
        user_goal: 'balanced',
        location_context: 'home',
      });
      setSprite(spriteRes);

      setAnalysisStage('done');
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed.');
      setAnalysisStage('error');
    }
  };

  const runEatOut = async (ctx: LocationContext) => {
    setVision(null);
    setRecommendation(null);
    setSprite(null);
    setAnalysisError(null);
    setCurrentPage('eat-out-results');
    try {
      setAnalysisStage('recommend');
      const recRes = await api.post<Recommendation>('/location-recommendation', {
        location: { context: ctx },
        preferences: { goals: [], dietary_restrictions: [] },
      });
      setRecommendation(recRes);

      setAnalysisStage('sprite');
      const spriteRes = await api.post<SpriteLine>('/sprite/speak', {
        occasion: 'recommendation',
        recommendation: recRes,
        user_goal: 'balanced',
        location_context: ctx,
      });
      setSprite(spriteRes);

      setAnalysisStage('done');
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed.');
      setAnalysisStage('error');
    }
  };

  useEffect(() => {
    if (currentPage === 'eat-in-camera') {
      void startCamera();
    } else if (cameraStatus !== 'captured') {
      stopCamera();
      setCameraStatus('idle');
      setCameraError(null);
    }

    return () => {
      stopCamera();
    };
  }, [currentPage]);

  return (
    <div className="welcome-shell">
      <div className="welcome-glow welcome-glow-left" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-right" aria-hidden="true" />

      <main className="welcome-layout">
        {currentPage === 'welcome' ? (
          <section className="hero-content">
            <h1 className="hero-title">Nourish Orbit</h1>
            <p className="hero-copy">
              Small, smart food decisions for the part of your day you are in right now.
            </p>

            <div className="hero-speaker">
              <div className="question-bubble">
                <div className="bubble-tail" aria-hidden="true" />
                <p className="question-label">What would you like to do today?</p>

                <div className="action-grid action-grid-stacked">
                  {homeActions.map((action) => (
                    <button
                      key={action.title}
                      type="button"
                      className="action-button action-button-compact"
                      onClick={() => setCurrentPage(action.nextPage)}
                    >
                      <span className="action-title">{action.title}</span>
                      <span className="action-description">{action.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <img src={stageOneMascot} alt="Stage 1 mascot" className="mascot-sprite mascot-sprite-large" />
            </div>
          </section>
        ) : null}

        {currentPage === 'eat-in-camera' ? (
          <section className="flow-page">
            <button type="button" className="back-button" onClick={() => setCurrentPage('welcome')}>
              Back
            </button>

            <div className="flow-content">
              <p className="placeholder-kicker">Eat In Flow</p>
              <h1 className="placeholder-title">Take a picture of what you have on hand</h1>
              <p className="placeholder-copy">
                Use your camera to capture the ingredients you have available. After the photo is
                taken, the future agent will inspect what is on hand and suggest what you can make.
              </p>

              <div className="camera-stage">
                <video
                  ref={videoRef}
                  className="camera-preview"
                  autoPlay
                  muted
                  playsInline
                />
                <canvas ref={canvasRef} className="camera-canvas" />

                {cameraStatus === 'requesting' ? (
                  <div className="camera-overlay">
                    <p className="camera-overlay-title">Opening camera...</p>
                    <p className="camera-overlay-copy">
                      Grant camera permission so we can capture what you have on hand.
                    </p>
                  </div>
                ) : null}

                {cameraStatus === 'blocked' ? (
                  <div className="camera-overlay">
                    <p className="camera-overlay-title">Camera unavailable</p>
                    <p className="camera-overlay-copy">
                      {cameraError ??
                        'We could not access your camera. Check your browser permissions and try again.'}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="camera-actions">
                <button
                  type="button"
                  className="camera-button camera-button-primary"
                  onClick={handleCapture}
                  disabled={cameraStatus !== 'ready'}
                >
                  Take Photo
                </button>
                <button
                  type="button"
                  className="camera-button"
                  onClick={() => void startCamera()}
                  disabled={cameraStatus === 'requesting'}
                >
                  Use Phone
                </button>
              </div>

              <p className="camera-footnote">
                The meal suggestion agent is not implemented yet. After capture, you will land on a
                placeholder results page where that agent will eventually live.
              </p>
            </div>
          </section>
        ) : null}

        {currentPage === 'eat-in-results' ? (
          <section className="flow-page">
            <button
              type="button"
              className="back-button"
              onClick={() => setCurrentPage('eat-in-camera')}
            >
              Back
            </button>

            <div className="flow-content results-layout">
              <div className="results-main">
                <p className="placeholder-kicker">Eat In Results</p>
                <h1 className="placeholder-title">What you have on hand</h1>

                {capturedPhoto ? (
                  <div className="captured-photo-card">
                    <img src={capturedPhoto} alt="Captured ingredients preview" className="captured-photo" />
                  </div>
                ) : null}

                {analysisStage !== 'idle' && analysisStage !== 'done' && analysisStage !== 'error' ? (
                  <p className="agent-copy" style={{ marginTop: 12 }}>
                    {analysisStage === 'vision' && 'Scanning photo for ingredients…'}
                    {analysisStage === 'fridge' && 'Cleaning up the ingredient list…'}
                    {analysisStage === 'recommend' && 'Deciding the best meal for you…'}
                    {analysisStage === 'sprite' && 'Orbit is thinking…'}
                  </p>
                ) : null}

                {analysisStage === 'error' ? (
                  <p className="agent-copy" style={{ color: '#c0392b', marginTop: 12 }}>
                    {analysisError}
                    <br />
                    <button
                      type="button"
                      className="camera-button"
                      style={{ marginTop: 8 }}
                      onClick={() => capturedPhoto && void runAnalysis(capturedPhoto)}
                    >
                      Retry
                    </button>
                  </p>
                ) : null}

                {vision && vision.food_items.length > 0 ? (
                  <div className="captured-photo-card" style={{ marginTop: 16, padding: 16 }}>
                    <p className="agent-label">Detected ingredients</p>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {vision.food_items.map((f, i) => (
                        <li key={i} className="agent-copy">
                          {f.name}
                          {f.quantity ? ` — ${f.quantity}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <aside className="mascot-column">
                <img src={stageOneMascot} alt="Stage 1 mascot" className="mascot-sprite mascot-sprite-panel" />

                <div className="chat-bubble">
                  <div className="chat-bubble-tail" aria-hidden="true" />
                  <p className="agent-label">Orbit{sprite ? ` · ${sprite.mood}` : ''}</p>
                  <p className="agent-copy">
                    {sprite
                      ? sprite.line
                      : analysisStage === 'done'
                        ? 'No response from Orbit.'
                        : 'Orbit will react once we know what you have on hand.'}
                  </p>
                  {sprite?.followup_prompt ? (
                    <p className="agent-copy" style={{ opacity: 0.75, marginTop: 8 }}>
                      {sprite.followup_prompt}
                    </p>
                  ) : null}
                </div>

                <div className="store-panel">
                  <p className="agent-label">Meal suggestion</p>
                  {recommendation ? (
                    <>
                      <p className="agent-copy" style={{ fontWeight: 600 }}>
                        {recommendation.primary_recommendation}
                      </p>
                      <p className="agent-copy">{recommendation.rationale}</p>
                      {recommendation.alternative_options.length > 0 ? (
                        <p className="agent-copy" style={{ marginTop: 8 }}>
                          <strong>Alternatives:</strong>{' '}
                          {recommendation.alternative_options.join(', ')}
                        </p>
                      ) : null}
                      {recommendation.foods_to_avoid.length > 0 ? (
                        <p className="agent-copy" style={{ marginTop: 4 }}>
                          <strong>Avoid:</strong> {recommendation.foods_to_avoid.join(', ')}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="agent-copy">
                      The meal agent will recommend something once the photo is analyzed.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          </section>
        ) : null}

        {currentPage === 'eat-out-pick' ? (
          <section className="flow-page">
            <button type="button" className="back-button" onClick={() => setCurrentPage('welcome')}>
              Back
            </button>

            <div className="flow-content">
              <p className="placeholder-kicker">Eat Out Flow</p>
              <h1 className="placeholder-title">Where are you right now?</h1>
              <p className="placeholder-copy">
                Pick the context that's closest — Orbit will coach you through the best play for this
                spot.
              </p>

              <div className="action-grid action-grid-stacked" style={{ marginTop: 24 }}>
                {locationOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className="action-button action-button-compact"
                    onClick={() => void runEatOut(opt.key)}
                  >
                    <span className="action-title">{opt.label}</span>
                    <span className="action-description">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {currentPage === 'eat-out-results' ? (
          <section className="flow-page">
            <button
              type="button"
              className="back-button"
              onClick={() => setCurrentPage('eat-out-pick')}
            >
              Back
            </button>

            <div className="flow-content results-layout">
              <div className="results-main">
                <p className="placeholder-kicker">Eat Out Results</p>
                <h1 className="placeholder-title">Your coach's call</h1>

                {analysisStage !== 'idle' && analysisStage !== 'done' && analysisStage !== 'error' ? (
                  <p className="agent-copy" style={{ marginTop: 12 }}>
                    {analysisStage === 'recommend' && 'Scanning nearby options…'}
                    {analysisStage === 'sprite' && 'Orbit is thinking…'}
                  </p>
                ) : null}

                {analysisStage === 'error' ? (
                  <p className="agent-copy" style={{ color: '#c0392b', marginTop: 12 }}>
                    {analysisError}
                  </p>
                ) : null}
              </div>

              <aside className="mascot-column">
                <img src={stageOneMascot} alt="Stage 1 mascot" className="mascot-sprite mascot-sprite-panel" />

                <div className="chat-bubble">
                  <div className="chat-bubble-tail" aria-hidden="true" />
                  <p className="agent-label">Orbit{sprite ? ` · ${sprite.mood}` : ''}</p>
                  <p className="agent-copy">
                    {sprite
                      ? sprite.line
                      : analysisStage === 'done'
                        ? 'No response from Orbit.'
                        : 'Your coach is warming up…'}
                  </p>
                  {sprite?.followup_prompt ? (
                    <p className="agent-copy" style={{ opacity: 0.75, marginTop: 8 }}>
                      {sprite.followup_prompt}
                    </p>
                  ) : null}
                </div>

                <div className="store-panel">
                  <p className="agent-label">Meal suggestion</p>
                  {recommendation ? (
                    <>
                      <p className="agent-copy" style={{ fontWeight: 600 }}>
                        {recommendation.primary_recommendation}
                      </p>
                      <p className="agent-copy">{recommendation.rationale}</p>
                      {recommendation.alternative_options.length > 0 ? (
                        <p className="agent-copy" style={{ marginTop: 8 }}>
                          <strong>Alternatives:</strong>{' '}
                          {recommendation.alternative_options.join(', ')}
                        </p>
                      ) : null}
                      {recommendation.foods_to_avoid.length > 0 ? (
                        <p className="agent-copy" style={{ marginTop: 4 }}>
                          <strong>Avoid:</strong> {recommendation.foods_to_avoid.join(', ')}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="agent-copy">Working on a recommendation…</p>
                  )}
                </div>
              </aside>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
