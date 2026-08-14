import {
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  ColorWheelIcon,
  Cross1Icon,
  ImageIcon,
  MinusIcon,
  MoveIcon,
  Pencil1Icon,
  PlusIcon,
  ResetIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@radix-ui/react-icons";

type PhotoRecord = {
  id: string;
  name: string;
  dataUrl: string;
  capturedAt: string;
  caption: string;
  drawing?: string;
  frameColor?: string;
};

type PhotoUpdate = Pick<PhotoRecord, "caption" | "drawing" | "frameColor">;

type TripRecord = {
  id: string;
  city: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  photos: PhotoRecord[];
};

type View =
  | { name: "home" }
  | { name: "new-trip" }
  | { name: "trip"; tripId: string };

type PhotoGroup = {
  key: string;
  day: string;
  month: string;
  weekday: string;
  count: number;
  periods: { label: string; photos: PhotoRecord[] }[];
};

const STORAGE_KEY = "journoid-trips-v2";
const LEGACY_STORAGE_KEY = "journey-polaroid-trips-v1";
const DEFAULT_FRAME_COLOR = "#ffffff";
const FRAME_COLORS = ["#ffffff", "#eeeeeb", "#d5d5d1", "#777775", "#111111"];

function readSavedTrips(): TripRecord[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as TripRecord[]) : [];
  } catch {
    return [];
  }
}

function tripTitle(city: string, startDate: string) {
  if (!city.trim() || !startDate) return "";
  const month = new Date(`${startDate}T12:00:00`).getMonth() + 1;
  return `${month}월의 ${city.trim()}`;
}

function tripMonth(startDate: string) {
  return new Date(`${startDate}T12:00:00`).getMonth() + 1;
}

function formatTripRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" });
  return `${formatter.format(new Date(`${startDate}T12:00:00`))} — ${formatter.format(new Date(`${endDate}T12:00:00`))}`;
}

function groupPhotos(photos: PhotoRecord[]): PhotoGroup[] {
  const byDate = new Map<string, PhotoRecord[]>();
  [...photos]
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    .forEach((photo) => {
      const date = new Date(photo.capturedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      byDate.set(key, [...(byDate.get(key) ?? []), photo]);
    });

  return Array.from(byDate.entries()).map(([key, dayPhotos]) => {
    const date = new Date(`${key}T12:00:00`);
    const periodMap = new Map<string, PhotoRecord[]>();
    dayPhotos.forEach((photo) => {
      const hour = new Date(photo.capturedAt).getHours();
      const label = hour < 6 ? "새벽" : hour < 12 ? "아침" : hour < 18 ? "오후" : "저녁";
      periodMap.set(label, [...(periodMap.get(label) ?? []), photo]);
    });

    return {
      key,
      day: String(date.getDate()).padStart(2, "0"),
      month: new Intl.DateTimeFormat("ko-KR", { month: "long" }).format(date),
      weekday: new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date),
      count: dayPhotos.length,
      periods: Array.from(periodMap.entries()).map(([label, periodPhotos]) => ({ label, photos: periodPhotos })),
    };
  });
}

export default function Prototype() {
  const [trips, setTrips] = useState<TripRecord[]>(readSavedTrips);
  const [view, setView] = useState<View>({ name: "home" });

  useEffect(() => {
    const saveTimer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
      } catch {
        // Keep the current session usable if browser storage is full.
      }
    }, 650);
    return () => window.clearTimeout(saveTimer);
  }, [trips]);

  const addTrip = (city: string, startDate: string, endDate: string) => {
    const id = `trip-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
    const trip: TripRecord = {
      id,
      city: city.trim(),
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
      photos: [],
    };
    setTrips((current) => [trip, ...current]);
    setView({ name: "trip", tripId: id });
  };

  const appendPhotos = (tripId: string, photos: PhotoRecord[]) => {
    setTrips((current) => current.map((trip) => (
      trip.id === tripId ? { ...trip, photos: [...trip.photos, ...photos] } : trip
    )));
  };

  const updatePhoto = (tripId: string, photoId: string, next: PhotoUpdate) => {
    setTrips((current) => current.map((trip) => (
      trip.id === tripId
        ? { ...trip, photos: trip.photos.map((photo) => photo.id === photoId ? { ...photo, ...next } : photo) }
        : trip
    )));
  };

  return (
    <div className="app-shell">
      {view.name === "home" ? (
        <Home trips={trips} onAdd={() => setView({ name: "new-trip" })} onOpen={(tripId) => setView({ name: "trip", tripId })} />
      ) : null}
      {view.name === "new-trip" ? <NewTrip onBack={() => setView({ name: "home" })} onSave={addTrip} /> : null}
      {view.name === "trip" ? (
        <TripDetail
          trip={trips.find((trip) => trip.id === view.tripId)}
          onBack={() => setView({ name: "home" })}
          onAddPhotos={(photos) => appendPhotos(view.tripId, photos)}
          onUpdatePhoto={(photoId, next) => updatePhoto(view.tripId, photoId, next)}
        />
      ) : null}
    </div>
  );
}

function Home({ trips, onAdd, onOpen }: { trips: TripRecord[]; onAdd: () => void; onOpen: (tripId: string) => void }) {
  return (
    <main className="screen home-screen">
      <header className="topbar">
        <span className="wordmark">journoid</span>
        <button className="icon-button" type="button" onClick={onAdd} aria-label="새 여행 추가"><PlusIcon /></button>
      </header>

      {trips.length === 0 ? (
        <section className="home-empty">
          <span>아직 여행이 없습니다.</span>
          <button className="text-action" type="button" onClick={onAdd}>첫 여행 추가</button>
        </section>
      ) : (
        <>
          <section className="home-masthead">
            <h1>여행</h1>
            <span>{String(trips.length).padStart(2, "0")}</span>
          </section>
          <section className="journey-list" aria-label="여행 목록">
            {trips.map((trip, index) => (
              <button className="journey-row" type="button" key={trip.id} onClick={() => onOpen(trip.id)}>
                <div className="journey-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="journey-copy">
                  <strong>{tripTitle(trip.city, trip.startDate)}</strong>
                  <span>{formatTripRange(trip.startDate, trip.endDate)}</span>
                </div>
                <TripPreview trip={trip} />
              </button>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function TripPreview({ trip }: { trip: TripRecord }) {
  if (trip.photos.length === 0) return <span className="journey-photo-count">0</span>;
  return (
    <span className="preview-stack" aria-label={`${trip.photos.length}장의 사진`}>
      {trip.photos.slice(-2).map((photo, index) => (
        <span
          className="preview-polaroid"
          key={photo.id}
          style={{ "--preview-index": index, "--frame-color": photo.frameColor ?? DEFAULT_FRAME_COLOR } as CSSProperties}
        >
          <img src={photo.dataUrl} alt="" />
          {photo.drawing ? <img className="drawing-layer" src={photo.drawing} alt="" /> : null}
        </span>
      ))}
    </span>
  );
}

function NewTrip({ onBack, onSave }: { onBack: () => void; onSave: (city: string, startDate: string, endDate: string) => void }) {
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const title = tripTitle(city, startDate);

  const save = () => {
    if (!city.trim() || !startDate || !endDate) return setError("도시와 날짜를 모두 입력해 주세요.");
    if (endDate < startDate) return setError("여행 종료일을 확인해 주세요.");
    onSave(city, startDate, endDate);
  };

  return (
    <main className="screen form-screen">
      <header className="topbar">
        <button className="icon-button" type="button" onClick={onBack} aria-label="뒤로"><ArrowLeftIcon /></button>
        <button className="icon-button" type="button" onClick={save} aria-label="저장"><CheckIcon /></button>
      </header>
      <section className="trip-form">
        <h1>{title || "새 여행"}</h1>
        <label>
          <span>도시</span>
          <input value={city} onChange={(event) => { setCity(event.target.value); setError(""); }} placeholder="도시 이름" autoFocus />
        </label>
        <div className="date-grid">
          <label>
            <span>시작</span>
            <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setEndDate((current) => current && current >= event.target.value ? current : event.target.value); setError(""); }} />
          </label>
          <label>
            <span>종료</span>
            <input type="date" min={startDate || undefined} value={endDate} onChange={(event) => { setEndDate(event.target.value); setError(""); }} />
          </label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}

function TripDetail({
  trip,
  onBack,
  onAddPhotos,
  onUpdatePhoto,
}: {
  trip?: TripRecord;
  onBack: () => void;
  onAddPhotos: (photos: PhotoRecord[]) => void;
  onUpdatePhoto: (photoId: string, next: PhotoUpdate) => void;
}) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedPhoto = trip?.photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  const groups = useMemo(() => groupPhotos(trip?.photos ?? []), [trip?.photos]);

  if (!trip) return null;

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    try {
      let done = 0;
      for (let index = 0; index < files.length; index += 2) {
        const batch = await Promise.all(files.slice(index, index + 2).map(toPhotoRecord));
        onAddPhotos(batch);
        done += batch.length;
        setUploadProgress({ done, total: files.length });
        await yieldToBrowser();
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <main className="screen trip-screen">
        <header className="topbar sticky-topbar">
          <button className="icon-button" type="button" onClick={onBack} aria-label="여행 목록"><ArrowLeftIcon /></button>
          <label className={`icon-button import-button ${uploading ? "is-loading" : ""}`} aria-label="사진 추가">
            {uploading ? <span className="upload-progress">{uploadProgress.done}/{uploadProgress.total}</span> : <ImageIcon />}
            <input ref={fileInput} type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} onClick={(event) => { event.currentTarget.value = ""; }} />
          </label>
        </header>
        <section className="trip-heading">
          <span className="trip-eyebrow">{tripMonth(trip.startDate)}월의</span>
          <h1>{trip.city}</h1>
          <div className="trip-meta">
            <span>{formatTripRange(trip.startDate, trip.endDate)}</span>
            <span>{String(trip.photos.length).padStart(2, "0")}</span>
          </div>
        </section>

        {trip.photos.length === 0 ? (
          <button className="photo-empty" type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>
            <PlusIcon />
            <span>{uploading ? "불러오는 중" : "사진 추가"}</span>
          </button>
        ) : (
          <div className="timeline">
            {groups.map((group) => (
              <section className="date-section" key={group.key}>
                <header className="date-heading">
                  <strong className="date-number">{group.day}</strong>
                  <span className="date-meta"><b>{group.month}</b>{group.weekday}</span>
                  <span className="date-count">{String(group.count).padStart(2, "0")}</span>
                </header>
                {group.periods.map((period) => (
                  <div className="period" key={`${group.key}-${period.label}`}>
                    <span className="period-label">{period.label}</span>
                    <div className="polaroid-grid">
                      {period.photos.map((photo) => (
                        <article className="polaroid-entry" key={photo.id}>
                          <button
                            className="flat-polaroid"
                            type="button"
                            style={{ "--frame-color": photo.frameColor ?? DEFAULT_FRAME_COLOR } as CSSProperties}
                            onClick={() => setSelectedPhotoId(photo.id)}
                            aria-label="폴라로이드 열기"
                          >
                            <span className="flat-photo">
                              <img src={photo.dataUrl} alt={photo.caption || "여행 사진"} />
                              {photo.drawing ? <img className="drawing-layer" src={photo.drawing} alt="사진 위 낙서" /> : null}
                            </span>
                          </button>
                          {photo.caption ? <p className="photo-comment">{photo.caption}</p> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </main>

      {selectedPhoto ? (
        <PhotoViewer
          photo={selectedPhoto}
          onClose={() => setSelectedPhotoId(null)}
          onSave={(next) => onUpdatePhoto(selectedPhoto.id, next)}
        />
      ) : null}
    </>
  );
}

function PhotoViewer({
  photo,
  onClose,
  onSave,
}: {
  photo: PhotoRecord;
  onClose: () => void;
  onSave: (next: PhotoUpdate) => void;
}) {
  const [mode, setMode] = useState<"model" | "edit">("model");
  const [rotation, setRotation] = useState({ x: -5, y: -16 });
  const [caption, setCaption] = useState(photo.caption);
  const [drawing, setDrawing] = useState(photo.drawing ?? "");
  const [frameColor, setFrameColor] = useState(photo.frameColor ?? DEFAULT_FRAME_COLOR);
  const drag = useRef<{ id: number; x: number; y: number; distance: number } | null>(null);

  useEffect(() => {
    document.body.classList.add("viewer-open");
    return () => document.body.classList.remove("viewer-open");
  }, []);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const deltaX = event.clientX - current.x;
    const deltaY = event.clientY - current.y;
    drag.current = { id: current.id, x: event.clientX, y: event.clientY, distance: current.distance + Math.abs(deltaX) + Math.abs(deltaY) };
    setRotation((value) => ({ x: Math.max(-68, Math.min(68, value.x - deltaY * 0.32)), y: value.y + deltaX * 0.4 }));
  };

  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    const wasTap = drag.current.distance < 9;
    drag.current = null;
    if (wasTap) setMode("edit");
  };

  const save = () => {
    onSave({ caption: caption.trim(), drawing: drawing || undefined, frameColor });
    setMode("model");
  };

  return (
    <div className={`fullscreen-viewer ${mode === "edit" ? "is-editing" : ""}`} role="dialog" aria-modal="true" aria-label="폴라로이드 상세">
      <header className="viewer-header">
        <button className="icon-button" type="button" onClick={mode === "edit" ? () => setMode("model") : onClose} aria-label={mode === "edit" ? "모델로 돌아가기" : "닫기"}>
          {mode === "edit" ? <ArrowLeftIcon /> : <Cross1Icon />}
        </button>
        {mode === "edit" ? <button className="save-text-button" type="button" onClick={save}>저장</button> : null}
      </header>

      {mode === "model" ? (
        <div className="model-stage" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }}>
          <div
            className="polaroid-model"
            style={{
              "--frame-color": frameColor,
              transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            } as CSSProperties}
          >
            <div className="model-face model-front">
              <ModelPhoto photo={photo} drawing={drawing} />
            </div>
            <div className="model-face model-back" />
            <span className="model-edge edge-right" />
            <span className="model-edge edge-bottom" />
          </div>
        </div>
      ) : (
        <PhotoEditor
          photo={photo}
          drawing={drawing}
          onDrawingChange={setDrawing}
          caption={caption}
          onCaptionChange={setCaption}
          frameColor={frameColor}
          onFrameColorChange={setFrameColor}
        />
      )}
    </div>
  );
}

function ModelPhoto({ photo, drawing }: { photo: PhotoRecord; drawing: string }) {
  return (
    <div className="model-photo">
      <img src={photo.dataUrl} alt={photo.caption || "여행 사진"} />
      {drawing ? <img className="drawing-layer" src={drawing} alt="사진 위 낙서" /> : null}
    </div>
  );
}

type EditorGesture =
  | { kind: "draw"; pointerId: number }
  | { kind: "pan"; pointerId: number; start: { x: number; y: number }; pan: { x: number; y: number } }
  | {
    kind: "pinch";
    pointerIds: [number, number];
    distance: number;
    zoom: number;
    contentPoint: { x: number; y: number };
  };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMidpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function PhotoEditor({
  photo,
  drawing,
  onDrawingChange,
  caption,
  onCaptionChange,
  frameColor,
  onFrameColorChange,
}: {
  photo: PhotoRecord;
  drawing: string;
  onDrawingChange: (value: string) => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  frameColor: string;
  onFrameColorChange: (value: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorPhotoRef = useRef<HTMLDivElement>(null);
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<"draw" | "move">("draw");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const drawingRef = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<string[]>([]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<EditorGesture | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!drawing) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = drawing;
  }, [drawing]);

  const clampPan = (next: { x: number; y: number }, nextZoom = zoomRef.current) => {
    const rect = editorPhotoRef.current?.getBoundingClientRect();
    if (!rect || nextZoom <= 1) return { x: 0, y: 0 };
    const maxX = (rect.width * (nextZoom - 1)) / 2;
    const maxY = (rect.height * (nextZoom - 1)) / 2;
    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  };

  const updatePan = (next: { x: number; y: number }, nextZoom = zoomRef.current) => {
    const bounded = clampPan(next, nextZoom);
    panRef.current = bounded;
    setPan(bounded);
  };

  const updateZoom = (next: number) => {
    const bounded = clamp(next, 1, 3);
    zoomRef.current = bounded;
    setZoom(bounded);
    updatePan(panRef.current, bounded);
    if (bounded === 1) setTool("draw");
  };

  const resetView = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setTool("draw");
  };

  const pointFor = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const rect = editorPhotoRef.current?.getBoundingClientRect();
    if (!canvas || !rect) return { x: 0, y: 0 };
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const localX = ((clientX - rect.left - centerX - panRef.current.x) / zoomRef.current) + centerX;
    const localY = ((clientY - rect.top - centerY - panRef.current.y) / zoomRef.current) + centerY;
    return {
      x: clamp(localX / rect.width, 0, 1) * canvas.width,
      y: clamp(localY / rect.height, 0, 1) * canvas.height,
    };
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPoint.current = null;
    onDrawingChange(canvasRef.current?.toDataURL("image/png") ?? "");
  };

  const startDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    history.current.push(canvasRef.current?.toDataURL() ?? "");
    drawingRef.current = true;
    lastPoint.current = pointFor(event.clientX, event.clientY);
    gesture.current = { kind: "draw", pointerId: event.pointerId };
  };

  const moveDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current || !lastPoint.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const point = pointFor(event.clientX, event.clientY);
    context.strokeStyle = "#111111";
    context.lineWidth = brushSize;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(lastPoint.current.x, lastPoint.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPoint.current = point;
  };

  const beginPinch = () => {
    const entries = Array.from(pointers.current.entries());
    if (entries.length < 2) return;
    finishDrawing();
    const [[firstId, first], [secondId, second]] = entries;
    const rect = editorPhotoRef.current?.getBoundingClientRect();
    if (!rect) return;
    const midpoint = pointerMidpoint(first, second);
    const focus = { x: midpoint.x - rect.left - rect.width / 2, y: midpoint.y - rect.top - rect.height / 2 };
    gesture.current = {
      kind: "pinch",
      pointerIds: [firstId, secondId],
      distance: Math.max(1, pointerDistance(first, second)),
      zoom: zoomRef.current,
      contentPoint: {
        x: (focus.x - panRef.current.x) / zoomRef.current,
        y: (focus.y - panRef.current.y) / zoomRef.current,
      },
    };
  };

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      beginPinch();
      return;
    }
    if (tool === "move") {
      gesture.current = {
        kind: "pan",
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        pan: panRef.current,
      };
      return;
    }
    startDrawing(event);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const currentGesture = gesture.current;
    if (!currentGesture) return;
    if (currentGesture.kind === "pinch") {
      const first = pointers.current.get(currentGesture.pointerIds[0]);
      const second = pointers.current.get(currentGesture.pointerIds[1]);
      const rect = editorPhotoRef.current?.getBoundingClientRect();
      if (!first || !second || !rect) return;
      const nextZoom = clamp(currentGesture.zoom * (pointerDistance(first, second) / currentGesture.distance), 1, 3);
      const midpoint = pointerMidpoint(first, second);
      const focus = { x: midpoint.x - rect.left - rect.width / 2, y: midpoint.y - rect.top - rect.height / 2 };
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      updatePan({
        x: focus.x - currentGesture.contentPoint.x * nextZoom,
        y: focus.y - currentGesture.contentPoint.y * nextZoom,
      }, nextZoom);
      return;
    }
    if (currentGesture.kind === "pan" && currentGesture.pointerId === event.pointerId) {
      updatePan({
        x: currentGesture.pan.x + event.clientX - currentGesture.start.x,
        y: currentGesture.pan.y + event.clientY - currentGesture.start.y,
      });
      return;
    }
    if (currentGesture.kind === "draw" && currentGesture.pointerId === event.pointerId) moveDrawing(event);
  };

  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const currentGesture = gesture.current;
    if (currentGesture?.kind === "draw" && currentGesture.pointerId === event.pointerId) finishDrawing();
    pointers.current.delete(event.pointerId);
    if (currentGesture?.kind !== "pinch" || pointers.current.size < 2) gesture.current = null;
  };

  const undo = () => {
    const previous = history.current.pop();
    if (previous !== undefined) onDrawingChange(previous);
  };

  const clear = () => {
    history.current.push(canvasRef.current?.toDataURL() ?? "");
    onDrawingChange("");
  };

  return (
    <div className="editor-page">
      <div className="editor-polaroid" style={{ "--frame-color": frameColor } as CSSProperties}>
        <div
          ref={editorPhotoRef}
          className={`editor-photo ${tool === "move" ? "is-panning" : "is-drawing"}`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
          onDoubleClick={() => { if (zoomRef.current === 1) updateZoom(2); else resetView(); }}
        >
          <div
            className="editor-zoom-surface"
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
          >
            <img src={photo.dataUrl} alt="편집할 여행 사진" />
            <canvas ref={canvasRef} width="900" height="1200" aria-label="사진 위에 낙서하기" />
          </div>
        </div>
      </div>
      <div className="editor-controls">
        <div className="drawing-tools" aria-label="낙서 도구">
          <button className={tool === "draw" ? "is-active" : ""} type="button" onClick={() => setTool("draw")} aria-label="펜" aria-pressed={tool === "draw"}><Pencil1Icon /></button>
          <button className={tool === "move" ? "is-active" : ""} type="button" onClick={() => setTool("move")} aria-label="확대한 사진 이동" aria-pressed={tool === "move"} disabled={zoom <= 1}><MoveIcon /></button>
          <span className="tool-divider" />
          <button type="button" onClick={() => setBrushSize((size) => Math.max(2, size - 2))} aria-label="펜 가늘게"><MinusIcon /></button>
          <span className="brush-preview" style={{ width: brushSize + 4, height: brushSize + 4 }} />
          <button type="button" onClick={() => setBrushSize((size) => Math.min(14, size + 2))} aria-label="펜 굵게"><PlusIcon /></button>
          <span className="tool-divider" />
          <button type="button" onClick={undo} aria-label="되돌리기"><ResetIcon /></button>
          <button type="button" onClick={clear} aria-label="낙서 지우기"><TrashIcon /></button>
        </div>
        <div className="zoom-tools" aria-label="사진 확대 도구">
          <button type="button" onClick={() => updateZoom(zoomRef.current - 0.25)} aria-label="축소" disabled={zoom <= 1}><ZoomOutIcon /></button>
          <button className="zoom-readout" type="button" onClick={resetView} aria-label="확대 초기화">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => updateZoom(zoomRef.current + 0.25)} aria-label="확대" disabled={zoom >= 3}><ZoomInIcon /></button>
        </div>
      </div>
      <div className="frame-colors" aria-label="폴라로이드 프레임 색상">
        <ColorWheelIcon aria-hidden="true" />
        {FRAME_COLORS.map((color) => (
          <button
            className="frame-swatch"
            type="button"
            key={color}
            style={{ "--swatch": color } as CSSProperties}
            onClick={() => onFrameColorChange(color)}
            aria-label={`프레임 색상 ${color}`}
            aria-pressed={frameColor.toLowerCase() === color}
          />
        ))}
        <label className="frame-color-custom" aria-label="사용자 지정 프레임 색상">
          <PlusIcon />
          <input type="color" value={frameColor} onChange={(event) => onFrameColorChange(event.target.value)} />
        </label>
      </div>
      <label className="comment-editor">
        <Pencil1Icon />
        <textarea value={caption} maxLength={80} rows={2} onChange={(event) => onCaptionChange(event.target.value)} placeholder="코멘트" />
      </label>
    </div>
  );
}

async function toPhotoRecord(file: File): Promise<PhotoRecord> {
  const capturedAt = (await readExifDate(file)) ?? new Date(file.lastModified || Date.now());
  return {
    id: `photo-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`,
    name: file.name,
    dataUrl: await resizeImage(file),
    capturedAt: capturedAt.toISOString(),
    caption: "",
    frameColor: DEFAULT_FRAME_COLOR,
  };
}

async function resizeImage(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxSide = 900;
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await canvasToDataUrl(canvas);
  } catch {
    return fileToDataUrl(file);
  }
}

function canvasToDataUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Image encoding failed"));
      fileToDataUrl(blob).then(resolve, reject);
    }, "image/jpeg", 0.74);
  });
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readExifDate(file: File): Promise<Date | null> {
  if (!/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
  try {
    const buffer = await file.slice(0, 512 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if ((marker & 0xff00) !== 0xff00) break;
      const segmentLength = view.getUint16(offset, false);
      if (segmentLength < 2 || offset + segmentLength > view.byteLength) break;
      if (marker === 0xffe1 && segmentLength >= 10) {
        const payload = offset + 2;
        if (view.getUint8(payload) === 0x45 && view.getUint8(payload + 1) === 0x78 && view.getUint8(payload + 2) === 0x69 && view.getUint8(payload + 3) === 0x66) {
          return parseExifTiff(view, payload + 6);
        }
      }
      offset += segmentLength;
    }
  } catch {
    return null;
  }
  return null;
}

function parseExifTiff(view: DataView, tiffStart: number): Date | null {
  if (tiffStart + 8 >= view.byteLength) return null;
  const endianMark = view.getUint16(tiffStart, false);
  const little = endianMark === 0x4949;
  if (!little && endianMark !== 0x4d4d) return null;
  const uint16 = (offset: number) => view.getUint16(offset, little);
  const uint32 = (offset: number) => view.getUint32(offset, little);
  const firstIfd = tiffStart + uint32(tiffStart + 4);
  const readAscii = (entryOffset: number, count: number) => {
    const start = count <= 4 ? entryOffset + 8 : tiffStart + uint32(entryOffset + 8);
    if (start < 0 || start + count > view.byteLength) return "";
    let value = "";
    for (let index = 0; index < count; index += 1) {
      const char = view.getUint8(start + index);
      if (char === 0) break;
      value += String.fromCharCode(char);
    }
    return value;
  };
  const parseIfd = (ifdOffset: number, wantedTags: number[]) => {
    if (ifdOffset < 0 || ifdOffset + 2 > view.byteLength) return new Map<number, { value: number; text: string }>();
    const count = Math.min(uint16(ifdOffset), 256);
    const result = new Map<number, { value: number; text: string }>();
    for (let index = 0; index < count; index += 1) {
      const entry = ifdOffset + 2 + index * 12;
      if (entry + 12 > view.byteLength) break;
      const tag = uint16(entry);
      if (!wantedTags.includes(tag)) continue;
      result.set(tag, { value: uint32(entry + 8), text: uint16(entry + 2) === 2 ? readAscii(entry, uint32(entry + 4)) : "" });
    }
    return result;
  };
  const root = parseIfd(firstIfd, [0x0132, 0x8769]);
  const exifPointer = root.get(0x8769)?.value;
  const exif = exifPointer ? parseIfd(tiffStart + exifPointer, [0x9003, 0x9004]) : new Map();
  const raw = exif.get(0x9003)?.text || exif.get(0x9004)?.text || root.get(0x0132)?.text;
  const match = raw?.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? null : date;
}
