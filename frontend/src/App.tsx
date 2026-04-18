import { useEffect, useRef, useState } from 'react';
import stageOneMascot from './assets/stage-1-mascot.png';
import stageOneMascotFrameTwo from './assets/stage-1-mascot-frame-2.png';
import stage1 from './assets/stage-1.png';
import stage2 from './assets/stage-2.png';
import stage3 from './assets/stage-3.png';
import stage4 from './assets/stage-4.png';
import stage5 from './assets/stage-5.png';
import { api } from './api/client';

const STAGE_SPRITES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: stage1,
  2: stage2,
  3: stage3,
  4: stage4,
  5: stage5,
};

const STAGE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Wilted — macros are rough',
  2: 'Hungry — below balanced',
  3: 'Steady — decent plate',
  4: 'Thriving — balanced macros',
  5: 'Peak form — nailed it',
};

type Macros = {
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  calories?: number | null;
};

function scoreMacros(m: Macros | null | undefined): 1 | 2 | 3 | 4 | 5 {
  if (!m) return 3;
  const protein = m.protein_g ?? 0;
  const fiber = m.fiber_g ?? 0;
  const calories = m.calories ?? 0;
  const carbs = m.carbs_g ?? 0;
  const fat = m.fat_g ?? 0;

  let score = 0;
  if (protein >= 30) score += 2;
  else if (protein >= 20) score += 1;

  if (fiber >= 8) score += 2;
  else if (fiber >= 4) score += 1;

  if (calories >= 400 && calories <= 850) score += 1;

  const carbFatOk = carbs > 0 && fat > 0 && carbs / Math.max(fat, 1) < 6;
  if (carbFatOk) score += 1;

  // Protein is a hard gate for the streak threshold (Stage 4). A low-protein
  // plate can't level past Stage 3 no matter how much fiber/balance it has,
  // so a carb-heavy meal breaks the streak instead of extending it.
  if (protein < 20) {
    if (protein < 10) return 1;
    if (score >= 3) return 3;
    if (score >= 2) return 2;
    return 1;
  }

  if (score >= 5) return 5;
  if (score >= 4) return 4;
  if (score >= 3) return 3;
  if (score >= 2) return 2;
  return 1;
}

function AnimatedMascot({ className }: { className: string }) {
  return (
    <div className={`mascot-animated ${className}`} aria-label="Stage 1 mascot animation" role="img">
      <img src={stageOneMascot} alt="" aria-hidden="true" className="mascot-frame mascot-frame-one" />
      <img
        src={stageOneMascotFrameTwo}
        alt=""
        aria-hidden="true"
        className="mascot-frame mascot-frame-two"
      />
    </div>
  );
}

function StageMascot({ stage, className }: { stage: 1 | 2 | 3 | 4 | 5; className: string }) {
  return (
    <img
      key={stage}
      src={STAGE_SPRITES[stage]}
      alt={STAGE_LABELS[stage]}
      className={`${className} stage-mascot stage-mascot-${stage}`}
    />
  );
}

function StageBadge({ stage }: { stage: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className={`stage-badge stage-badge-${stage}`}>
      <span className="stage-badge-pill">Stage {stage}/5</span>
      <span className="stage-badge-label">{STAGE_LABELS[stage]}</span>
    </div>
  );
}

type StreakState = { count: number; best: number; lastResult: 'extended' | 'broken' | 'idle' };
const STREAK_STORAGE_KEY = 'orbit.streak';
const STREAK_THRESHOLD = 4;

function loadStreak(): StreakState {
  if (typeof window === 'undefined') return { count: 0, best: 0, lastResult: 'idle' };
  try {
    const raw = window.localStorage.getItem(STREAK_STORAGE_KEY);
    if (!raw) return { count: 0, best: 0, lastResult: 'idle' };
    const parsed = JSON.parse(raw);
    return {
      count: Number(parsed.count) || 0,
      best: Number(parsed.best) || 0,
      lastResult: 'idle',
    };
  } catch {
    return { count: 0, best: 0, lastResult: 'idle' };
  }
}

function saveStreak(state: StreakState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    STREAK_STORAGE_KEY,
    JSON.stringify({ count: state.count, best: state.best }),
  );
}

function StreakBadge({ streak }: { streak: StreakState }) {
  const flame = streak.count >= 3 ? '🔥'.repeat(Math.min(3, Math.floor(streak.count / 3) + 1)) : '';
  return (
    <div className={`streak-badge streak-badge-${streak.lastResult}`}>
      <span className="streak-count">
        {flame ? <span className="streak-flame">{flame}</span> : null}
        {streak.count}
      </span>
      <span className="streak-label">
        {streak.lastResult === 'extended' && 'Streak +1 — keep it going'}
        {streak.lastResult === 'broken' && 'Streak broken — reset to 0'}
        {streak.lastResult === 'idle' &&
          (streak.count > 0
            ? `${streak.count}-meal streak · best ${streak.best}`
            : `No streak yet · best ${streak.best}`)}
      </span>
    </div>
  );
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function OrbitChatPanel({
  messages,
  draft,
  sending,
  onDraftChange,
  onSend,
  scrollRef,
  quickPrompts,
}: {
  messages: ChatMessage[];
  draft: string;
  sending: boolean;
  onDraftChange: (v: string) => void;
  onSend: (text?: string) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  quickPrompts: string[];
}) {
  return (
    <div className="orbit-chat">
      <div className="orbit-chat-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="orbit-chat-empty">
            Ask me anything — swaps, macros, what to add, how to stretch your streak.
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`orbit-chat-row orbit-chat-row-${m.role}`}>
              <div className={`orbit-chat-msg orbit-chat-msg-${m.role}`}>{m.content}</div>
            </div>
          ))
        )}
        {sending ? (
          <div className="orbit-chat-row orbit-chat-row-assistant">
            <div className="orbit-chat-msg orbit-chat-msg-assistant orbit-chat-typing">
              Orbit is thinking...
            </div>
          </div>
        ) : null}
      </div>

      {messages.length === 0 ? (
        <div className="orbit-chat-quick">
          {quickPrompts.map((q) => (
            <button
              key={q}
              type="button"
              className="orbit-chat-quick-button"
              onClick={() => onSend(q)}
              disabled={sending}
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="orbit-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <input
          type="text"
          className="orbit-chat-input"
          placeholder="Message Orbit..."
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          className="orbit-chat-send"
          disabled={sending || !draft.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

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
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  calories?: number | null;
};

type MacroTotals = {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  calories: number;
};

type VisionResult = {
  success: boolean;
  food_items?: VisionFoodItem[];
  total_macros?: MacroTotals | null;
  confidence?: string;
  notes?: string | null;
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
  estimated_macros?: MacroTotals | null;
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

function AnimatedMascot({ className }: { className: string }) {
  return (
    <div className={`mascot-animated ${className}`} aria-label="Stage 1 mascot animation" role="img">
      <img src={stageOneMascot} alt="" aria-hidden="true" className="mascot-frame mascot-frame-one" />
      <img
        src={stageOneMascotFrameTwo}
        alt=""
        aria-hidden="true"
        className="mascot-frame mascot-frame-two"
      />
    </div>
  );
}

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
  const [streak, setStreak] = useState<StreakState>(() => loadStreak());
  const [mealConfirmed, setMealConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const recordMeal = (stage: 1 | 2 | 3 | 4 | 5) => {
    setStreak((prev) => {
      const extended = stage >= STREAK_THRESHOLD;
      const nextCount = extended ? prev.count + 1 : 0;
      const nextBest = Math.max(prev.best, nextCount);
      const next: StreakState = {
        count: nextCount,
        best: nextBest,
        lastResult: extended ? 'extended' : 'broken',
      };
      saveStreak(next);
      return next;
    });
  };

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
      const cams = all.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(cams);
      // eslint-disable-next-line no-console
      console.log('[camera] devices:', cams.map((c) => `${c.label || '(no label)'} — ${c.deviceId.slice(0, 8)}`));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[camera] enumerateDevices failed', err);
    }
  };

  // Chrome/Safari cache the camera list — a fresh getUserMedia probe forces the
  // browser to re-poll the OS, which is required for a newly-connected iPhone
  // (Continuity Camera) to appear.
  const rescanDevices = async () => {
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      probe.getTracks().forEach((t) => t.stop());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[camera] probe getUserMedia failed', err);
    }
    await loadDevices();
  };

  const openSettings = async () => {
    setShowCameraSettings((v) => !v);
    await rescanDevices();
  };

  const tryGetStream = async (deviceId: string | null): Promise<MediaStream> => {
    // When user explicitly picks a device, pin it with `exact` so the browser can't silently
    // fall back to a built-in webcam. If that device is unavailable, retry with `ideal`.
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false,
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'OverconstrainedError' || name === 'NotFoundError') {
          return navigator.mediaDevices.getUserMedia({
            video: { deviceId: { ideal: deviceId } },
            audio: false,
          });
        }
        throw err;
      }
    }
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
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
      const stream = await tryGetStream(activeDeviceId);
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
      const macros = visionRes.total_macros;
      const macroSummary = macros
        ? `Detected plate macros — Calories: ${Math.round(macros.calories)} kcal, Protein: ${macros.protein_g}g, Carbs: ${macros.carbs_g}g, Fat: ${macros.fat_g}g, Fiber: ${macros.fiber_g}g. Flag any macro that falls short of a balanced meal (aim ~25-40g protein, ~8g fiber) and tell the user exactly what to add.`
        : null;
      const spriteRes = await api.post<SpriteLine>('/sprite/speak', {
        occasion: 'recommendation',
        recommendation: recRes,
        user_goal: 'balanced',
        location_context: 'home',
        note: macroSummary,
      });
      setSprite(spriteRes);

      if (macros) recordMeal(scoreMacros(macros));
      setAnalysisStage('done');
    } catch (err) {
      setAnalysisStage('error');
      setAnalysisError(err instanceof Error ? err.message : String(err));
    }
  };

  const GT_VENUES = [
    'Tin Drum Asian Kitchen (Tech Square) — build-your-own rice or noodle bowl, great for balancing protein + veggies',
    'Sweetgreen (Midtown) — grain bowls and salads, default balanced macros',
    'Chipotle (Tech Square) — build-a-bowl with double chicken/steak, brown rice, fajita veggies, black beans',
    'Panera Bread (Tech Square) — Mediterranean bowl, turkey chili, or green goddess salad',
    'Chick-fil-A (Student Center) — grilled chicken sandwich or grilled nuggets + fruit cup',
    'Waffle House (Tech Square) — cheese & eggs plate for cheap protein',
    "Ray's New York Pizza (Tech Square) — cheese slice + side salad, skip garlic knots",
    'Willy\'s Mexicana Grill (Tech Square) — chicken burrito bowl with black beans',
    'Einstein Bros Bagels (Student Center) — egg + avocado bagel thin for a faster protein breakfast',
    'Highland Bakery (near campus) — egg plate with grits and fruit',
  ];

  const runEatOutPipeline = async (coords: { latitude: number; longitude: number }) => {
    setAnalysisError(null);
    setRecommendation(null);
    setSprite(null);
    setMealConfirmed(false);

    try {
      setAnalysisStage('recommend');
      const recRes = await api.post<Recommendation>('/location-recommendation', {
        location: {
          context: 'campus',
          lat: coords.latitude,
          lng: coords.longitude,
          notes: `User is at Georgia Tech in Midtown Atlanta. Only recommend from this curated list of nearby spots:\n- ${GT_VENUES.join('\n- ')}\nPick ONE primary with a specific customization (e.g. "Tin Drum teriyaki chicken rice bowl, extra veggies") and two alternatives from this list.`,
        },
        preferences: DEFAULT_PREFERENCES,
      });
      setRecommendation(recRes);

      setAnalysisStage('sprite');
      const mac = recRes.estimated_macros;
      const macroNote = mac
        ? `Estimated macros for this pick — ${Math.round(mac.calories)} kcal, P: ${mac.protein_g}g, C: ${mac.carbs_g}g, F: ${mac.fat_g}g, Fiber: ${mac.fiber_g}g. Call out any shortfall vs a balanced meal (aim 25-40g protein, 8g+ fiber).`
        : null;
      const spriteRes = await api.post<SpriteLine>('/sprite/speak', {
        occasion: 'recommendation',
        recommendation: recRes,
        user_goal: 'balanced',
        location_context: 'Georgia Tech campus, Midtown Atlanta',
        note: macroNote,
      });
      setSprite(spriteRes);

      setAnalysisStage('done');
    } catch (err) {
      setAnalysisStage('error');
      setAnalysisError(err instanceof Error ? err.message : String(err));
    }
  };

  const buildChatContext = () => {
    const mac = recommendation?.estimated_macros ?? vision?.total_macros ?? null;
    const stage = mac ? scoreMacros(mac) : null;
    return {
      page: currentPage,
      recommendation: recommendation
        ? {
            primary: recommendation.primary_recommendation,
            alternatives: recommendation.alternative_options,
            avoid: recommendation.foods_to_avoid,
            rationale: recommendation.rationale,
          }
        : null,
      vision_items: vision?.food_items?.map((f) => f.name) ?? null,
      estimated_macros: mac,
      stage: stage ? `${stage}/5 — ${STAGE_LABELS[stage]}` : null,
      streak: { current: streak.count, best: streak.best, threshold: STREAK_THRESHOLD },
      meal_confirmed: mealConfirmed,
      gt_venues: currentPage === 'eat-out-results' ? GT_VENUES : null,
    };
  };

  const handleChatSend = async (overrideText?: string) => {
    const text = (overrideText ?? chatDraft).trim();
    if (!text || chatSending) return;

    const nextMessages: { role: 'user' | 'assistant'; content: string }[] = [
      ...chatMessages,
      { role: 'user', content: text },
    ];
    setChatMessages(nextMessages);
    setChatDraft('');
    setChatSending(true);

    try {
      const res = await api.post<{ reply: string }>('/sprite/chat', {
        messages: nextMessages,
        context: buildChatContext(),
      });
      setChatMessages((prev) => [...prev, { role: 'assistant', content: res.reply || 'Mm, say more.' }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Lost the signal there — try again? (${err instanceof Error ? err.message : 'unknown'})`,
        },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatOpen]);

  useEffect(() => {
    setChatOpen(false);
    setChatMessages([]);
    setChatDraft('');
  }, [currentPage]);

  const handleConfirmAte = async () => {
    if (!recommendation || mealConfirmed || confirming) return;
    setConfirming(true);
    try {
      const mac = recommendation.estimated_macros;
      const stage = mac ? scoreMacros(mac) : 3;
      recordMeal(stage);
      setMealConfirmed(true);

      const celebrateRes = await api.post<SpriteLine>('/sprite/speak', {
        occasion: 'celebrate',
        recommendation,
        user_goal: 'balanced',
        location_context: 'Georgia Tech campus, Midtown Atlanta',
        note: `User confirmed they ate ${recommendation.primary_recommendation}. Stage ${stage}/5.`,
      });
      setSprite(celebrateRes);
    } catch {
      // streak already recorded; silent failure on celebrate line is fine
    } finally {
      setConfirming(false);
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

  const FALLBACK_COORDS = { latitude: 33.7756, longitude: -84.3963, label: 'Georgia Tech' };

  const runEatOutWithFallback = () => {
    setLocationStatus('granted');
    setLocationLabel(FALLBACK_COORDS.label);
    setCurrentPage('eat-out-results');
    void runEatOutPipeline({
      latitude: FALLBACK_COORDS.latitude,
      longitude: FALLBACK_COORDS.longitude,
    });
  };

  const requestLocationRecommendations = () => {
    if (!navigator.geolocation) {
      runEatOutWithFallback();
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
      () => {
        runEatOutWithFallback();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
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

  useEffect(() => {
    if (currentPage !== 'eat-in-camera') return;
    if (!navigator.mediaDevices?.addEventListener) return;
    const handler = () => {
      // Slight delay — Continuity Camera fires devicechange before the device
      // is actually enumerable, so give the OS a beat before re-polling.
      setTimeout(() => void rescanDevices(), 400);
    };
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
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
          <section className="hero-content landing-hero">
            <div className="landing-top">
              <div className="landing-copy">
                <p className="landing-kicker">Nourish Orbit</p>
                <h1 className="hero-title">Feed your sprite. Level yourself up.</h1>
                <p className="hero-copy">
                  Snap a meal or pick a spot nearby. We score the macros and your sprite evolves
                  from wilted to peak form — one plate at a time.
                </p>
              </div>
              <AnimatedMascot className="mascot-sprite mascot-sprite-large landing-hero-mascot" />
            </div>

            <div className="landing-streak">
              <StreakBadge streak={{ ...streak, lastResult: 'idle' }} />
              <p className="streak-explainer">
                Every meal at <strong>Stage 4+</strong> extends your streak. Anything below Stage 4
                resets it to zero — so keep protein high, fiber steady, and carbs in check.
              </p>
            </div>

            <div className="landing-stages">
              <p className="landing-section-label">5 stages of evolution</p>
              <div className="stage-row">
                {([1, 2, 3, 4, 5] as const).map((s) => (
                  <div key={s} className={`stage-chip stage-chip-${s}`}>
                    <img src={STAGE_SPRITES[s]} alt={`Stage ${s}`} className="stage-chip-img" />
                    <span className="stage-chip-rank">Stage {s}</span>
                    <span className="stage-chip-label">{STAGE_LABELS[s].split(' — ')[0]}</span>
                  </div>
                ))}
              </div>

              <p className="landing-section-label landing-xp-label">How you earn XP</p>
              <div className="xp-grid">
                <div className="xp-card">
                  <span className="xp-points">+2 XP</span>
                  <span className="xp-title">Protein power</span>
                  <span className="xp-detail">Hit 30g+ in one meal.</span>
                  <span className="xp-foods">eggs · chicken · Greek yogurt · tofu</span>
                </div>
                <div className="xp-card">
                  <span className="xp-points">+2 XP</span>
                  <span className="xp-title">Fiber fuel</span>
                  <span className="xp-detail">Hit 8g+ in one meal.</span>
                  <span className="xp-foods">beans · oats · berries · leafy greens</span>
                </div>
                <div className="xp-card">
                  <span className="xp-points">+1 XP</span>
                  <span className="xp-title">Calorie sweet spot</span>
                  <span className="xp-detail">Land between 400 – 850 kcal.</span>
                  <span className="xp-foods">not too light · not too heavy</span>
                </div>
                <div className="xp-card">
                  <span className="xp-points">+1 XP</span>
                  <span className="xp-title">Macro harmony</span>
                  <span className="xp-detail">Keep carbs and fat in balance.</span>
                  <span className="xp-foods">no sugar bomb · no grease pit</span>
                </div>
              </div>

              <p className="landing-section-label landing-xp-label">Real-world examples</p>
              <div className="example-row">
                <div className="example-card example-card-1">
                  <span className="example-food">Pop-tart + iced coffee</span>
                  <span className="example-arrow">→</span>
                  <span className="example-stage">Stage 1</span>
                </div>
                <div className="example-card example-card-3">
                  <span className="example-food">Turkey sandwich + chips</span>
                  <span className="example-arrow">→</span>
                  <span className="example-stage">Stage 3</span>
                </div>
                <div className="example-card example-card-5">
                  <span className="example-food">Chipotle chicken bowl + veggies</span>
                  <span className="example-arrow">→</span>
                  <span className="example-stage">Stage 5</span>
                </div>
              </div>
            </div>

            <div className="landing-ctas">
              {homeActions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  className="landing-cta"
                  onClick={() => setCurrentPage(action.nextPage)}
                >
                  <span className="landing-cta-title">{action.title}</span>
                  <span className="landing-cta-sub">{action.description}</span>
                </button>
              ))}
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
                  <div className="camera-settings-header">
                    <p className="camera-settings-title">Vision Device</p>
                    <button
                      type="button"
                      className="camera-refresh-button"
                      onClick={() => void rescanDevices()}
                    >
                      Refresh
                    </button>
                  </div>
                  <p className="camera-settings-hint">
                    Continuity Camera: same Apple ID on both, Bluetooth + WiFi on, iPhone unlocked
                    and near your Mac. If it doesn&apos;t show in <strong>Photo Booth</strong> or{' '}
                    <strong>QuickTime</strong> at the OS level, the browser won&apos;t see it either.
                  </p>
                  <p className="camera-device-count">
                    {availableDevices.length} camera{availableDevices.length === 1 ? '' : 's'} detected
                  </p>
                  {availableDevices.length === 0 ? (
                    <p className="camera-settings-empty">
                      No devices found. Grant camera permission first, then Refresh.
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
                  <span className="stage-indicator">{stageMessage}</span>
                ) : null}

                {analysisStage === 'error' && analysisError ? (
                  <div className="analysis-error">
                    <span>Something went wrong: {analysisError}</span>
                    {capturedPhoto ? (
                      <button type="button" onClick={() => void runEatInPipeline(capturedPhoto)}>
                        Try again
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {vision?.food_items?.length ? (
                  <div className="chat-bubble">
                    <p className="agent-label">Detected ingredients</p>
                    <p className="agent-copy">
                      {vision.food_items.map((f) => f.name).join(', ')}
                    </p>
                  </div>
                ) : null}

                {vision?.total_macros ? (
                  <div className="macro-panel">
                    <p className="agent-label">Predicted macros</p>
                    <div className="macro-grid">
                      <div className="macro-cell macro-cell-calories">
                        <span className="macro-value">
                          {Math.round(vision.total_macros.calories)}
                        </span>
                        <span className="macro-label">kcal</span>
                      </div>
                      <div className="macro-cell">
                        <span className="macro-value">{vision.total_macros.protein_g}g</span>
                        <span className="macro-label">Protein</span>
                      </div>
                      <div className="macro-cell">
                        <span className="macro-value">{vision.total_macros.carbs_g}g</span>
                        <span className="macro-label">Carbs</span>
                      </div>
                      <div className="macro-cell">
                        <span className="macro-value">{vision.total_macros.fat_g}g</span>
                        <span className="macro-label">Fat</span>
                      </div>
                      <div className="macro-cell">
                        <span className="macro-value">{vision.total_macros.fiber_g}g</span>
                        <span className="macro-label">Fiber</span>
                      </div>
                    </div>
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
                {vision?.total_macros ? (
                  <>
                    <StageMascot
                      stage={scoreMacros(vision.total_macros)}
                      className="mascot-sprite mascot-sprite-panel"
                    />
                    <StageBadge stage={scoreMacros(vision.total_macros)} />
                    <StreakBadge streak={streak} />
                  </>
                ) : (
                  <AnimatedMascot className="mascot-sprite mascot-sprite-panel" />
                )}

                <div className="chat-bubble">
                  <div className="chat-bubble-tail" aria-hidden="true" />
                  <p className="agent-label">Orbit — your coach</p>
                  <p className="agent-copy">
                    {sprite?.line
                      ? sprite.line
                      : analysisStage === 'done'
                        ? 'Ready when you are.'
                        : "Hang tight — I'm looking at what you have and picking your best move."}
                  </p>
                  {sprite?.followup_prompt ? (
                    <p className="agent-copy">{sprite.followup_prompt}</p>
                  ) : null}
                  {analysisStage === 'done' ? (
                    <button
                      type="button"
                      className="chat-toggle-button"
                      onClick={() => setChatOpen((v) => !v)}
                    >
                      {chatOpen ? 'Close chat' : 'Chat with Orbit →'}
                    </button>
                  ) : null}
                </div>

                {chatOpen && analysisStage === 'done' ? (
                  <OrbitChatPanel
                    messages={chatMessages}
                    draft={chatDraft}
                    sending={chatSending}
                    onDraftChange={setChatDraft}
                    onSend={(text) => void handleChatSend(text)}
                    scrollRef={chatScrollRef}
                    quickPrompts={[
                      'What should I add?',
                      'Is this enough protein?',
                      'Give me a lower-calorie swap',
                    ]}
                  />
                ) : null}
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
                  Share your location and I&apos;ll pick the strongest nearby meal for you.
                </p>

                <button
                  type="button"
                  className="action-button action-button-compact"
                  onClick={requestLocationRecommendations}
                  disabled={locationStatus === 'requesting'}
                >
                  <span className="action-title">
                    {locationStatus === 'requesting' ? 'Finding you...' : 'Use my location'}
                  </span>
                  <span className="action-description">
                    I&apos;ll use your GPS to build a nearby meal list.
                  </span>
                </button>

                {locationStatus === 'requesting' ? (
                  <p className="status-copy">Requesting your location now...</p>
                ) : null}

                {locationStatus === 'blocked' && locationError ? (
                  <p className="status-copy">{locationError}</p>
                ) : null}

              </div>

              <AnimatedMascot className="mascot-sprite mascot-sprite-large" />
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
                    ? `Context: ${locationLabel}. Orbit is picking the strongest real-time meal for you.`
                    : 'Once location access is granted, Orbit will pick the strongest real-time meal for you.'}
                </p>

                {stageMessage ? <span className="stage-indicator">{stageMessage}</span> : null}

                {analysisStage === 'error' && analysisError ? (
                  <div className="analysis-error">
                    <span>Something went wrong: {analysisError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPage('eat-out-intro');
                        setAnalysisStage('idle');
                      }}
                    >
                      Pick a location again
                    </button>
                  </div>
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

                {recommendation?.estimated_macros ? (
                  <div className="macro-panel eat-out-macro-panel">
                    <p className="agent-label">Estimated macros</p>
                    <div className="macro-grid">
                      <div className="macro-cell macro-cell-calories">
                        <span className="macro-value">
                          {Math.round(recommendation.estimated_macros.calories)}
                        </span>
                        <span className="macro-label">kcal</span>
                      </div>
                      <div className="macro-cell">
                        <span className="macro-value">{recommendation.estimated_macros.protein_g}g</span>
                        <span className="macro-label">Protein</span>
                      </div>
                      <div className="macro-cell">
                        <span className="macro-value">{recommendation.estimated_macros.carbs_g}g</span>
                        <span className="macro-label">Carbs</span>
                      </div>
                      <div className="macro-cell">
                        <span className="macro-value">{recommendation.estimated_macros.fat_g}g</span>
                        <span className="macro-label">Fat</span>
                      </div>
                      <div className="macro-cell">
                        <span className="macro-value">{recommendation.estimated_macros.fiber_g}g</span>
                        <span className="macro-label">Fiber</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {recommendation?.primary_recommendation ? (
                  <div className="confirm-panel">
                    <p className="confirm-copy">
                      {mealConfirmed
                        ? "Logged — your sprite leveled up from this meal."
                        : "Ate it? Verify to log the meal and update your streak."}
                    </p>
                    <button
                      type="button"
                      className={`confirm-button${mealConfirmed ? ' confirm-button-done' : ''}`}
                      onClick={() => void handleConfirmAte()}
                      disabled={mealConfirmed || confirming}
                    >
                      {mealConfirmed
                        ? '✓ Meal logged'
                        : confirming
                          ? 'Logging...'
                          : 'I ate this — log it'}
                    </button>
                  </div>
                ) : null}
              </div>

              <aside className="mascot-column eat-out-mascot-column">
                {recommendation?.estimated_macros ? (
                  <>
                    <StageMascot
                      stage={scoreMacros(recommendation.estimated_macros)}
                      className="mascot-sprite mascot-sprite-panel"
                    />
                    <StageBadge stage={scoreMacros(recommendation.estimated_macros)} />
                    <StreakBadge streak={streak} />
                  </>
                ) : (
                  <AnimatedMascot className="mascot-sprite mascot-sprite-panel" />
                )}

                <div className="chat-bubble">
                  <div className="chat-bubble-tail" aria-hidden="true" />
                  <p className="agent-label">Orbit — your coach</p>
                  <p className="agent-copy">
                    {sprite?.line
                      ? sprite.line
                      : analysisStage === 'done'
                        ? 'Ready when you are.'
                        : "Hang tight — finding your best play right now."}
                  </p>
                  {sprite?.followup_prompt ? (
                    <p className="agent-copy">{sprite.followup_prompt}</p>
                  ) : null}
                  {analysisStage === 'done' ? (
                    <button
                      type="button"
                      className="chat-toggle-button"
                      onClick={() => setChatOpen((v) => !v)}
                    >
                      {chatOpen ? 'Close chat' : 'Chat with Orbit →'}
                    </button>
                  ) : null}
                </div>

                {chatOpen && analysisStage === 'done' ? (
                  <OrbitChatPanel
                    messages={chatMessages}
                    draft={chatDraft}
                    sending={chatSending}
                    onDraftChange={setChatDraft}
                    onSend={(text) => void handleChatSend(text)}
                    scrollRef={chatScrollRef}
                    quickPrompts={[
                      'What else is nearby?',
                      'Something cheaper?',
                      'Make it higher protein',
                    ]}
                  />
                ) : null}
              </aside>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
