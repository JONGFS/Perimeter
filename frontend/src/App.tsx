import { useEffect, useRef, useState } from 'react';
import stageOneMascot from './assets/stage-1-mascot.png';

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

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('welcome');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
<<<<<<< HEAD
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
=======
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
>>>>>>> main

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Ref keeps the selected device ID fresh inside async closures and effects
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
    // Refresh device list every time the panel opens so new devices appear
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

    // Prefer explicit arg, then ref (always fresh), then default
    const activeDeviceId = deviceId ?? selectedDeviceIdRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Use `ideal` (not `exact`) so it falls back gracefully if the device
        // is temporarily unavailable (e.g. right after stopping Continuity Camera)
        video: activeDeviceId
          ? { deviceId: { ideal: activeDeviceId } }
          : { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      streamRef.current = stream;

      // When the device disconnects (e.g. iPhone walks away), fall back to webcam
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
      // Labels are only available after permission is granted
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
    setCurrentPage('eat-in-results');
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
                <p className="placeholder-copy">
                  The captured photo is shown below. Once the backend agent is implemented, the
                  mascot will review what you have on hand and guide you toward recipe ideas and
                  next steps.
                </p>

                {capturedPhoto ? (
                  <div className="captured-photo-card">
                    <img src={capturedPhoto} alt="Captured ingredients preview" className="captured-photo" />
                  </div>
                ) : null}
              </div>

              <aside className="mascot-column">
                <img src={stageOneMascot} alt="Stage 1 mascot" className="mascot-sprite mascot-sprite-panel" />

                <div className="chat-bubble">
                  <div className="chat-bubble-tail" aria-hidden="true" />
                  <p className="agent-label">Chat Box Placeholder</p>
                  <p className="agent-copy">
                    This will become the mascot-connected text area where the user sees suggestions
                    and can ask follow-up questions about meals, substitutions, and next choices.
                  </p>
                </div>

                <div className="store-panel">
                  <p className="agent-label">Nearby Supermarkets Placeholder</p>
                  <p className="agent-copy">
                    This section will list supermarkets near the user, along with their locations,
                    so we can suggest where to pick up missing ingredients.
                  </p>
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
                <h1 className="placeholder-title">Nearby restaurant picks</h1>
                <p className="placeholder-copy">
                  {locationLabel
                    ? `Using ${locationLabel} as a placeholder location, the mascot will eventually recommend restaurants near you.`
                    : 'Once location access is granted, the mascot will recommend restaurants near you.'}
                </p>

                <div className="chat-bubble eat-out-chat-bubble">
                  <div className="chat-bubble-tail" aria-hidden="true" />
                  <p className="agent-label">Restaurant Recommendations Placeholder</p>
                  <p className="agent-copy">
                    I found a few nearby spots you could try:
                  </p>
                  <p className="agent-copy">Green Lantern Cafe, 0.6 miles away</p>
                  <p className="agent-copy">Sprout Kitchen, 1.1 miles away</p>
                  <p className="agent-copy">Sunny Bowl House, 1.8 miles away</p>
                </div>
              </div>

              <aside className="mascot-column eat-out-mascot-column">
                <img
                  src={stageOneMascot}
                  alt="Stage 1 mascot"
                  className="mascot-sprite mascot-sprite-panel"
                />
              </aside>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
