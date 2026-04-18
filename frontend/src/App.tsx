import { useEffect, useRef, useState } from 'react';
import stageOneMascot from './assets/stage-1-mascot.png';
import { api } from './api/client';

const homeActions = [
  {
    title: 'Eat In',
    description: 'Build something from what you already have and get a calmer, home-base plan.',
    nextPage: 'eat-in-camera' as const,
  },
  {
    title: 'Eat Out',
    description: 'Find a strong option on the go with guidance for menus, takeout, or quick stops.',
    nextPage: 'eat-out-intro' as const,
  },
];

type Page =
  | 'welcome'
  | 'eat-in-camera'
  | 'eat-in-results'
  | 'eat-out-intro'
  | 'eat-out-results';
type CameraStatus = 'idle' | 'requesting' | 'ready' | 'blocked' | 'captured';
type LocationStatus = 'idle' | 'requesting' | 'granted' | 'blocked';
type AnalysisStage = 'idle' | 'vision' | 'fridge' | 'recommend' | 'sprite' | 'done' | 'error';

type VisionFoodItem = {
  name: string;
  quantity?: string | null;
  category?: string | null;
  confidence?: number | null;
};

type VisionResult = {
  success: boolean;
  food_items?: VisionFoodItem[];
  error?: string | null;
};

type FridgeResult = {
  ingredients_detected?: { name: string; category?: string; confidence?: number }[];
  likely_meals?: { name: string; ingredients_used?: string[]; effort?: string; notes?: string }[];
  missing_ingredients?: { meal: string; need?: string[]; impact?: string }[];
  perishability_priority?: string[];
};

type Recommendation = {
  recommendation_type?: string;
  primary_recommendation?: string;
  alternative_options?: string[];
  foods_to_avoid?: string[];
  rationale?: string;
  nutrition_goal_fit?: string;
  constraints_considered?: string[];
};

type SpriteLine = {
  line?: string;
  mood?: string;
  followup_prompt?: string;
};

const DEFAULT_PREFERENCES = {
  goals: ['balanced'],
  dietary_restrictions: [],
  budget_usd: null as number | null,
  time_minutes: null as number | null,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('welcome');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  // Agent pipeline state
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionResult | null>(null);
  const [fridge, setFridge] = useState<FridgeResult | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [sprite, setSprite] = useState<SpriteLine | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selectedDeviceIdRef = useRef<string | null>(null);

  const stopCamera = () => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const loadDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices(all.filter((d) => d.kind === 'videoinput'));
    } catch {
      // enumerateDevices not supported — settings panel will show empty
    }
  };

  const openSettings = async () => {
    setShowCameraSettings((v) => !v);
    await loadDevices();
  };

  const startCamera = async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('blocked');
      setCameraError('Camera access is not supported in this browser.');
      return;
    }

    stopCamera();
    setCameraStatus('requesting');
    setCameraError(null);

    const activeDeviceId = deviceId ?? selectedDeviceIdRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: activeDeviceId
          ? { deviceId: { ideal: activeDeviceId } }
          : { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current === stream) {
          selectedDeviceIdRef.current = null;
          setSelectedDeviceId(null);
          void startCamera();
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus('ready');
      await loadDevices();
    } catch (error) {
      setCameraStatus('blocked');
      setCameraError(
        error instanceof Error
          ? error.message
          : 'Camera permission was denied or the device camera is unavailable.',
      );
    }
  };

  const handleSelectDevice = async (deviceId: string) => {
    selectedDeviceIdRef.current = deviceId;
    setSelectedDeviceId(deviceId);
    setShowCameraSettings(false);
    await startCamera(deviceId);
  };

  const runEatInPipeline = async (dataUrl: string) => {
    setAnalysisError(null);
    setVision(null);
    setFridge(null);
    setRecommendation(null);
    setSprite(null);

    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

      setAnalysisStage('vision');
      const visionRes = await api.post<VisionResult>('/images/analyze', { image: base64 });
      setVision(visionRes);
      if (!visionRes.success || !visionRes.food_items?.length) {
        throw new Error(visionRes.error || 'No food items detected in the photo.');
      }

      setAnalysisStage('fridge');
      const fridgeRes = await api.post<FridgeResult>('/fridge-interpretation', {
        raw_ingredients: visionRes.food_items.map((f) => ({
          name: f.name,
          category: f.category ?? null,
          confidence: f.confidence ?? null,
        })),
        preferences: DEFAULT_PREFERENCES,
      });
      setFridge(fridgeRes);

      setAnalysisStage('recommend');
      const recRes = await api.post<Recommendation>('/location-recommendation', {
        location: { context: 'home' },
        preferences: DEFAULT_PREFERENCES,
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
      setAnalysisStage('error');
      setAnalysisError(err instanceof Error ? err.message : String(err));
    }
  };

  const runEatOutPipeline = async (coords: { latitude: number; longitude: number }) => {
    setAnalysisError(null);
    setRecommendation(null);
    setSprite(null);

    try {
      setAnalysisStage('recommend');
      const recRes = await api.post<Recommendation>('/location-recommendation', {
        location: {
          context: 'other',
          lat: coords.latitude,
          lng: coords.longitude,
          notes: 'User is out and about — GPS coords provided.',
        },
        preferences: DEFAULT_PREFERENCES,
      });
      setRecommendation(recRes);

      setAnalysisStage('sprite');
      const spriteRes = await api.post<SpriteLine>('/sprite/speak', {
        occasion: 'recommendation',
        recommendation: recRes,
        user_goal: 'balanced',
        location_context: `lat ${coords.latitude.toFixed(3)}, lng ${coords.longitude.toFixed(3)}`,
      });
      setSprite(spriteRes);

      setAnalysisStage('done');
    } catch (err) {
      setAnalysisStage('error');
      setAnalysisError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, width, height);
    const imageData = canvas.toDataURL('image/jpeg', 0.92);

    setCapturedPhoto(imageData);
    setCameraStatus('captured');
    stopCamera();
    setCurrentPage('eat-in-results');
    void runEatInPipeline(imageData);
  };

  const requestLocationRecommendations = () => {
    if (!navigator.geolocation) {
      setLocationStatus('blocked');
      setLocationError('Location access is not supported in this browser.');
      return;
    }

    setLocationStatus('requesting');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationStatus('granted');
        setLocationLabel(
          `Lat ${coords.latitude.toFixed(3)}, Lng ${coords.longitude.toFixed(3)}`,
        );
        setCurrentPage('eat-out-results');
        void runEatOutPipeline({ latitude: coords.latitude, longitude: coords.longitude });
      },
      (error) => {
        setLocationStatus('blocked');
        setLocationError(error.message || 'Location permission was denied.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
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

  const stageMessage = (() => {
    switch (analysisStage) {
      case 'vision':
        return 'Scanning your photo for ingredients...';
      case 'fridge':
        return 'Figuring out what you can realistically cook...';
      case 'recommend':
        return 'Picking the best meal for right now...';
      case 'sprite':
        return 'Writing your coaching line...';
      default:
        return null;
    }
  })();

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
                Capture the ingredients you have available. Orbit will scan the photo, figure out
                what you can make, and coach you toward the best pick.
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
                  onClick={() => void openSettings()}
                  aria-expanded={showCameraSettings}
                >
                  Camera Settings
                </button>
              </div>

              {showCameraSettings ? (
                <div className="camera-settings-panel">
                  <p className="camera-settings-title">Vision Device</p>
                  <p className="camera-settings-hint">
                    On Mac, connect your iPhone via Continuity Camera (Bluetooth + WiFi) and it
                    will appear below as a selectable device.
                  </p>
                  {availableDevices.length === 0 ? (
                    <p className="camera-settings-empty">
                      No devices found. Grant camera permission first.
                    </p>
                  ) : (
                    <ul className="camera-device-list">
                      {availableDevices.map((device, i) => (
                        <li key={device.deviceId}>
                          <button
                            type="button"
                            className={`camera-device-item${selectedDeviceId === device.deviceId ? ' camera-device-item-active' : ''}`}
                            onClick={() => void handleSelectDevice(device.deviceId)}
                          >
                            {device.label || `Camera ${i + 1}`}
                            {selectedDeviceId === device.deviceId ? ' ✓' : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
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

                {stageMessage ? (
                  <p className="status-copy">{stageMessage}</p>
                ) : null}

                {analysisStage === 'error' && analysisError ? (
                  <p className="status-copy">Something went wrong: {analysisError}</p>
                ) : null}

                {vision?.food_items?.length ? (
                  <div className="chat-bubble">
                    <p className="agent-label">Detected ingredients</p>
                    <p className="agent-copy">
                      {vision.food_items.map((f) => f.name).join(', ')}
                    </p>
                  </div>
                ) : null}

                {fridge?.likely_meals?.length ? (
                  <div className="chat-bubble">
                    <p className="agent-label">Likely meals</p>
                    {fridge.likely_meals.slice(0, 3).map((m) => (
                      <p key={m.name} className="agent-copy">
                        <strong>{m.name}</strong>
                        {m.notes ? ` — ${m.notes}` : ''}
                      </p>
                    ))}
                  </div>
                ) : null}

                {recommendation?.primary_recommendation ? (
                  <div className="chat-bubble">
                    <p className="agent-label">Orbit&apos;s pick</p>
                    <p className="agent-copy">
                      <strong>{recommendation.primary_recommendation}</strong>
                    </p>
                    {recommendation.rationale ? (
                      <p className="agent-copy">{recommendation.rationale}</p>
                    ) : null}
                    {recommendation.alternative_options?.length ? (
                      <p className="agent-copy">
                        Alternatives: {recommendation.alternative_options.join(', ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <aside className="mascot-column">
                <img src={stageOneMascot} alt="Stage 1 mascot" className="mascot-sprite mascot-sprite-panel" />

                <div className="chat-bubble">
                  <div className="chat-bubble-tail" aria-hidden="true" />
                  <p className="agent-label">Orbit — your coach</p>
                  <p className="agent-copy">
                    {sprite?.line
                      ? sprite.line
                      : analysisStage === 'done'
                        ? 'Ready when you are.'
                        : 'Hang tight — I&apos;m looking at what you have and picking your best move.'}
                  </p>
                  {sprite?.followup_prompt ? (
                    <p className="agent-copy">{sprite.followup_prompt}</p>
                  ) : null}
                </div>
              </aside>
            </div>
          </section>
        ) : null}

        {currentPage === 'eat-out-intro' ? (
          <section className="flow-page">
            <button type="button" className="back-button" onClick={() => setCurrentPage('welcome')}>
              Back
            </button>

            <div className="flow-content eat-out-layout">
              <div className="eat-out-bubble">
                <div className="bubble-tail" aria-hidden="true" />
                <p className="question-label">
                  Please enable location access so that I can recommend you the best restaurants in
                  the area.
                </p>

                <button
                  type="button"
                  className="action-button action-button-compact"
                  onClick={requestLocationRecommendations}
                  disabled={locationStatus === 'requesting'}
                >
                  <span className="action-title">Give Me Recommendations</span>
                  <span className="action-description">
                    I&apos;ll use your location to build a nearby restaurant list.
                  </span>
                </button>

                {locationStatus === 'requesting' ? (
                  <p className="status-copy">Requesting your location now...</p>
                ) : null}

                {locationStatus === 'blocked' && locationError ? (
                  <p className="status-copy">{locationError}</p>
                ) : null}
              </div>

              <img
                src={stageOneMascot}
                alt="Stage 1 mascot"
                className="mascot-sprite mascot-sprite-large"
              />
            </div>
          </section>
        ) : null}

        {currentPage === 'eat-out-results' ? (
          <section className="flow-page">
            <button
              type="button"
              className="back-button"
              onClick={() => setCurrentPage('eat-out-intro')}
            >
              Back
            </button>

            <div className="flow-content results-layout eat-out-results-layout">
              <div className="results-main eat-out-results-main">
                <p className="placeholder-kicker">Eat Out Results</p>
                <h1 className="placeholder-title">Nearby meal picks</h1>
                <p className="placeholder-copy">
                  {locationLabel
                    ? `Using ${locationLabel} as your location, Orbit is picking the best real-time meal for you.`
                    : 'Once location access is granted, Orbit will pick the best real-time meal for you.'}
                </p>

                {stageMessage ? <p className="status-copy">{stageMessage}</p> : null}

                {analysisStage === 'error' && analysisError ? (
                  <p className="status-copy">Something went wrong: {analysisError}</p>
                ) : null}

                {recommendation?.primary_recommendation ? (
                  <div className="chat-bubble eat-out-chat-bubble">
                    <div className="chat-bubble-tail" aria-hidden="true" />
                    <p className="agent-label">Orbit&apos;s pick</p>
                    <p className="agent-copy">
                      <strong>{recommendation.primary_recommendation}</strong>
                    </p>
                    {recommendation.rationale ? (
                      <p className="agent-copy">{recommendation.rationale}</p>
                    ) : null}
                    {recommendation.alternative_options?.length ? (
                      <p className="agent-copy">
                        Alternatives: {recommendation.alternative_options.join(', ')}
                      </p>
                    ) : null}
                    {recommendation.foods_to_avoid?.length ? (
                      <p className="agent-copy">
                        Skip: {recommendation.foods_to_avoid.join(', ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <aside className="mascot-column eat-out-mascot-column">
                <img
                  src={stageOneMascot}
                  alt="Stage 1 mascot"
                  className="mascot-sprite mascot-sprite-panel"
                />

                <div className="chat-bubble">
                  <div className="chat-bubble-tail" aria-hidden="true" />
                  <p className="agent-label">Orbit — your coach</p>
                  <p className="agent-copy">
                    {sprite?.line
                      ? sprite.line
                      : analysisStage === 'done'
                        ? 'Ready when you are.'
                        : 'Hang tight — finding your best play right now.'}
                  </p>
                  {sprite?.followup_prompt ? (
                    <p className="agent-copy">{sprite.followup_prompt}</p>
                  ) : null}
                </div>
              </aside>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
