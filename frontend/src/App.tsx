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
    nextPage: 'welcome' as const,
  },
];

type Page = 'welcome' | 'eat-in-camera' | 'eat-in-results';
type CameraStatus = 'idle' | 'requesting' | 'ready' | 'blocked' | 'captured';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('welcome');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

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
    setCurrentPage('eat-in-results');
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
      </main>
    </div>
  );
}
