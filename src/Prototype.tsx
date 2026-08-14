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
  Cross1Icon,
  ImageIcon,
  MinusIcon,
  Pencil1Icon,
  PlusIcon,
  ResetIcon,
  TrashIcon,
} from "@radix-ui/react-icons";

type PhotoRecord = {
  id: string;
  name: string;
  dataUrl: string;
  capturedAt: string;
  caption: string;
  drawing?: string;
};

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
  dateLabel: string;
  weekday: string;
  periods: { label: string; photos: PhotoRecord[] }[];
};

const STORAGE_KEY = "journoid-trips-v2";
const LEGACY_STORAGE_KEY = "journey-polaroid-trips-v1";

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
      dateLabel: new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date),
      weekday: new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date),
      periods: Array.from(periodMap.entries()).map(([label, periodPhotos]) => ({ label, photos: periodPhotos })),
    };
  });
}

export default function Prototype() {
  const [trips, setTrips] = useState<TripRecord[]>(readSavedTrips);
  const [view, setView] = useState<View>({ name: "home" });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    } catch {
      // Keep the current session usable if browser storage is full.
    }
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

  const updatePhoto = (tripId: string, photoId: string, next: Pick<PhotoRecord, "caption" | "drawing">) => {
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
      )}
    </main>
  );
}

function TripPreview({ trip }: { trip: TripRecord }) {
  if (trip.photos.length === 0) return <span className="journey-photo-count">0</span>;
  return (
    <span className="preview-stack" aria-label={`${trip.photos.length}장의 사진`}>
      {trip.photos.slice(-2).map((photo, index) => (
        <span className="preview-polaroid" key={photo.id} style={{ "--preview-index": index } as CSSProperties}>
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
  onUpdatePhoto: (photoId: string, next: Pick<PhotoRecord, "caption" | "drawing">) => void;
}) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedPhoto = trip?.photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  const groups = useMemo(() => groupPhotos(trip?.photos ?? []), [trip?.photos]);

  if (!trip) return null;

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      onAddPhotos(await Promise.all(files.map(toPhotoRecord)));
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
            <ImageIcon />
            <input ref={fileInput} type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} onClick={(event) => { event.currentTarget.value = ""; }} />
          </label>
        </header>
        <section className="trip-heading">
          <h1>{tripTitle(trip.city, trip.startDate)}</h1>
          <span>{formatTripRange(trip.startDate, trip.endDate)}</span>
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
                <header><strong>{group.dateLabel}</strong><span>{group.weekday}</span></header>
                {group.periods.map((period) => (
                  <div className="period" key={`${group.key}-${period.label}`}>
                    <span className="period-label">{period.label}</span>
                    <div className="polaroid-grid">
                      {period.photos.map((photo, index) => (
                        <article className="polaroid-entry" key={photo.id}>
                          <button
                            className="flat-polaroid"
                            type="button"
                            style={{ "--tilt": `${[-2.1, 1.25, -0.65, 2.4][index % 4]}deg` } as CSSProperties}
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
  onSave: (next: Pick<PhotoRecord, "caption" | "drawing">) => void;
}) {
  const [mode, setMode] = useState<"model" | "edit">("model");
  const [rotation, setRotation] = useState({ x: -5, y: -16 });
  const [caption, setCaption] = useState(photo.caption);
  const [drawing, setDrawing] = useState(photo.drawing ?? "");
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
    onSave({ caption: caption.trim(), drawing: drawing || undefined });
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
          <div className="polaroid-model" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
            <div className="model-face model-front">
              <ModelPhoto photo={photo} drawing={drawing} />
            </div>
            <div className="model-face model-back" />
            <span className="model-edge edge-right" />
            <span className="model-edge edge-bottom" />
          </div>
        </div>
      ) : (
        <PhotoEditor photo={photo} drawing={drawing} onDrawingChange={setDrawing} caption={caption} onCaptionChange={setCaption} />
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

function PhotoEditor({
  photo,
  drawing,
  onDrawingChange,
  caption,
  onCaptionChange,
}: {
  photo: PhotoRecord;
  drawing: string;
  onDrawingChange: (value: string) => void;
  caption: string;
  onCaptionChange: (value: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(4);
  const drawingRef = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<string[]>([]);

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

  const pointFor = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (event.currentTarget.width / rect.width),
      y: (event.clientY - rect.top) * (event.currentTarget.height / rect.height),
    };
  };

  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    history.current.push(canvasRef.current?.toDataURL() ?? "");
    drawingRef.current = true;
    lastPoint.current = pointFor(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPoint.current) return;
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;
    const point = pointFor(event);
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

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPoint.current = null;
    onDrawingChange(canvasRef.current?.toDataURL("image/png") ?? "");
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
      <div className="editor-polaroid">
        <div className="editor-photo">
          <img src={photo.dataUrl} alt="편집할 여행 사진" />
          <canvas
            ref={canvasRef}
            width="1000"
            height="1000"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="사진 위에 낙서하기"
          />
        </div>
      </div>
      <div className="drawing-tools" aria-label="낙서 도구">
        <button type="button" onClick={() => setBrushSize((size) => Math.max(2, size - 2))} aria-label="펜 가늘게"><MinusIcon /></button>
        <span className="brush-preview" style={{ width: brushSize + 4, height: brushSize + 4 }} />
        <button type="button" onClick={() => setBrushSize((size) => Math.min(14, size + 2))} aria-label="펜 굵게"><PlusIcon /></button>
        <span className="tool-divider" />
        <button type="button" onClick={undo} aria-label="되돌리기"><ResetIcon /></button>
        <button type="button" onClick={clear} aria-label="낙서 지우기"><TrashIcon /></button>
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
    return canvas.toDataURL("image/jpeg", 0.76);
  } catch {
    return fileToDataUrl(file);
  }
}

function fileToDataUrl(file: File) {
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
