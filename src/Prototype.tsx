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
  DotsHorizontalIcon,
  ImageIcon,
  MinusIcon,
  MoveIcon,
  OpacityIcon,
  Pencil1Icon,
  Pencil2Icon,
  PlusIcon,
  ResetIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@radix-ui/react-icons";

type PhotoLocation = {
  latitude: number;
  longitude: number;
  source: "exif";
};

type PhotoRecord = {
  id: string;
  name: string;
  dataUrl: string;
  capturedAt: string;
  caption: string;
  drawing?: string;
  frameColor?: string;
  aspectRatio?: number;
  location?: PhotoLocation;
};

type PhotoUpdate = Partial<Pick<PhotoRecord, "caption" | "drawing" | "frameColor" | "aspectRatio">>;

type TripRecord = {
  id: string;
  city: string;
  country?: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  photos: PhotoRecord[];
};

type TripDetails = {
  city: string;
  country: string;
  startDate: string;
  endDate: string;
};

type View =
  | { name: "home" }
  | { name: "new-trip" }
  | { name: "edit-trip"; tripId: string }
  | { name: "trip"; tripId: string };

type PhotoPeriod = "아침" | "점심" | "오후" | "저녁" | "밤" | "새벽";

type PhotoGroup = {
  key: string;
  day: string;
  weekday: string;
  count: number;
  periods: { label: PhotoPeriod; photos: PhotoRecord[] }[];
};

type Theme = "light" | "dark";

type ThemeProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

const STORAGE_POINTER_KEY = "journoid.storage";
const LOCAL_FALLBACK_KEY = "journoid.trips";
const THEME_STORAGE_KEY = "journoid.theme";
const LEGACY_STORAGE_KEYS = ["journoid-trips-v2", "journey-polaroid-trips-v1"];
const DATABASE_NAME = "journoid";
const DATABASE_VERSION = 1;
const TRIPS_STORE = "journal";
const TRIPS_RECORD_KEY = "trips";
const APP_VERSION = "0.8.0";
const DEFAULT_FRAME_COLOR = "#ffffff";
const DEFAULT_PHOTO_ASPECT = 3 / 4;
const FRAME_COLORS = ["#ffffff", "#eeeeeb", "#d5d5d1", "#777775", "#111111"];
const DEFAULT_DRAWING_COLOR = "#111111";
const DRAWING_COLORS = ["#111111", "#ffffff", "#ff453a", "#0a84ff", "#ffd60a"];
const PHOTO_PERIOD_ORDER: PhotoPeriod[] = ["아침", "점심", "오후", "저녁", "밤", "새벽"];

type BrushKind = "pen" | "pencil" | "marker";

type TripsStorageRecord = {
  id: typeof TRIPS_RECORD_KEY;
  schemaVersion: 1;
  updatedAt: string;
  trips: TripRecord[];
};

let storageWriteQueue = Promise.resolve();

function openStorageDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(TRIPS_STORE)) {
        request.result.createObjectStore(TRIPS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open storage"));
    request.onblocked = () => reject(new Error("Storage upgrade blocked"));
  });
}

async function readIndexedTrips() {
  const database = await openStorageDatabase();
  try {
    return await new Promise<TripRecord[] | null>((resolve, reject) => {
      const transaction = database.transaction(TRIPS_STORE, "readonly");
      const request = transaction.objectStore(TRIPS_STORE).get(TRIPS_RECORD_KEY);
      request.onsuccess = () => resolve((request.result as TripsStorageRecord | undefined)?.trips ?? null);
      request.onerror = () => reject(request.error ?? new Error("Could not read trips"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Storage read aborted"));
    });
  } finally {
    database.close();
  }
}

async function writeIndexedTrips(trips: TripRecord[]) {
  const database = await openStorageDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(TRIPS_STORE, "readwrite");
      const record: TripsStorageRecord = {
        id: TRIPS_RECORD_KEY,
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        trips,
      };
      transaction.objectStore(TRIPS_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save trips"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Storage write aborted"));
    });
  } finally {
    database.close();
  }
}

function readLocalTrips() {
  for (const key of [LOCAL_FALLBACK_KEY, ...LEGACY_STORAGE_KEYS]) {
    try {
      const saved = window.localStorage.getItem(key);
      if (!saved) continue;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as TripRecord[];
    } catch {
      // Try the next known key if an older entry is incomplete.
    }
  }
  return [];
}

async function readSavedTrips() {
  try {
    const indexedTrips = await readIndexedTrips();
    if (indexedTrips) return indexedTrips;
  } catch {
    // Fall through to the local-storage migration path.
  }

  const localTrips = readLocalTrips();
  if (localTrips.length) await persistTrips(localTrips);
  return localTrips;
}

async function persistTrips(trips: TripRecord[]) {
  try {
    await writeIndexedTrips(trips);
    window.localStorage.setItem(STORAGE_POINTER_KEY, JSON.stringify({
      driver: "indexedDB",
      database: DATABASE_NAME,
      schemaVersion: DATABASE_VERSION,
    }));
  } catch {
    try {
      window.localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(trips));
    } catch {
      // The in-memory session remains usable even when all browser storage is unavailable.
    }
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

function validPhotoAspect(value?: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.max(0.45, Math.min(2.4, value))
    : DEFAULT_PHOTO_ASPECT;
}

function polaroidFrameAspect(photoAspect: number) {
  return 1 / ((0.916 / validPhotoAspect(photoAspect)) + 0.217);
}

function photoFrameStyle(photo: Pick<PhotoRecord, "aspectRatio">, extra: CSSProperties = {}) {
  const aspectRatio = validPhotoAspect(photo.aspectRatio);
  return {
    ...extra,
    "--photo-aspect": aspectRatio,
    "--frame-aspect": polaroidFrameAspect(aspectRatio),
  } as CSSProperties;
}

function renderedImageAspect(image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight) return null;
  return validPhotoAspect(image.naturalWidth / image.naturalHeight);
}

function isDifferentAspect(current: number | undefined, next: number) {
  return !current || Math.abs(validPhotoAspect(current) - next) > 0.001;
}

function formatPhotoLocation(location?: PhotoLocation) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return "";
  const latitude = `${Math.abs(location.latitude).toFixed(4)}°${location.latitude >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(location.longitude).toFixed(4)}°${location.longitude >= 0 ? "E" : "W"}`;
  return `${latitude} · ${longitude}`;
}

function photoPeriod(date: Date): PhotoPeriod {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 300 && minutes < 690) return "아침";
  if (minutes >= 690 && minutes < 870) return "점심";
  if (minutes >= 870 && minutes < 1050) return "오후";
  if (minutes >= 1050 && minutes < 1290) return "저녁";
  if (minutes >= 1290 || minutes < 120) return "밤";
  return "새벽";
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
    const periodMap = new Map<PhotoPeriod, PhotoRecord[]>();
    dayPhotos.forEach((photo) => {
      const label = photoPeriod(new Date(photo.capturedAt));
      periodMap.set(label, [...(periodMap.get(label) ?? []), photo]);
    });

    return {
      key,
      day: String(date.getDate()).padStart(2, "0"),
      weekday: new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date),
      count: dayPhotos.length,
      periods: PHOTO_PERIOD_ORDER.flatMap((label) => {
        const periodPhotos = periodMap.get(label);
        return periodPhotos ? [{ label, photos: periodPhotos }] : [];
      }),
    };
  });
}

function readSavedTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function MenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button className="icon-button menu-button" type="button" onClick={onClick} aria-label="더 보기" aria-expanded={open}>
      <DotsHorizontalIcon />
    </button>
  );
}

function SettingsMenu({
  open,
  onClose,
  theme,
  onToggleTheme,
  onEditTrip,
  onDeletePhoto,
}: ThemeProps & {
  open: boolean;
  onClose: () => void;
  onEditTrip?: () => void;
  onDeletePhoto?: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmingDelete(false);
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="menu-scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="settings-menu" role="dialog" aria-modal="true" aria-label="앱 설정">
        {confirmingDelete ? (
          <div className="delete-confirmation">
            <p>이 사진을 삭제할까요?</p>
            <div className="delete-confirm-actions">
              <button type="button" onClick={() => setConfirmingDelete(false)}>취소</button>
              <button type="button" onClick={() => { onClose(); onDeletePhoto?.(); }}>삭제</button>
            </div>
          </div>
        ) : (
          <>
            {onEditTrip ? (
              <button className="settings-row" type="button" onClick={() => { onClose(); onEditTrip(); }}>
                <span>여행 정보 수정</span>
              </button>
            ) : null}
            <button className="settings-row" type="button" onClick={onToggleTheme}>
              <span>다크 테마</span>
              <b>{theme === "dark" ? "켜짐" : "꺼짐"}</b>
            </button>
            <div className="settings-row is-static">
              <span>버전</span>
              <b>v{APP_VERSION}</b>
            </div>
            {onDeletePhoto ? (
              <button className="settings-row delete-row" type="button" onClick={() => setConfirmingDelete(true)}>
                <span>사진 삭제</span>
              </button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

export default function Prototype() {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [view, setView] = useState<View>({ name: "home" });
  const [theme, setTheme] = useState<Theme>(readSavedTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme persistence is optional when browser storage is unavailable.
    }
    document.documentElement.dataset.journoidTheme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    let active = true;
    void readSavedTrips().then((savedTrips) => {
      if (!active) return;
      setTrips(savedTrips);
      setStorageReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const saveTimer = window.setTimeout(() => {
      storageWriteQueue = storageWriteQueue
        .catch(() => undefined)
        .then(() => persistTrips(trips));
    }, 650);
    return () => window.clearTimeout(saveTimer);
  }, [storageReady, trips]);

  const addTrip = ({ city, country, startDate, endDate }: TripDetails) => {
    const id = `trip-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
    const trip: TripRecord = {
      id,
      city: city.trim(),
      country: country.trim(),
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
      photos: [],
    };
    setTrips((current) => [trip, ...current]);
    setView({ name: "trip", tripId: id });
  };

  const updateTrip = (tripId: string, next: TripDetails) => {
    setTrips((current) => current.map((trip) => (
      trip.id === tripId
        ? { ...trip, city: next.city.trim(), country: next.country.trim(), startDate: next.startDate, endDate: next.endDate }
        : trip
    )));
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

  const deletePhoto = (tripId: string, photoId: string) => {
    setTrips((current) => current.map((trip) => (
      trip.id === tripId
        ? { ...trip, photos: trip.photos.filter((photo) => photo.id !== photoId) }
        : trip
    )));
  };

  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");

  if (!storageReady) return <div className="app-shell" data-theme={theme} aria-busy="true" />;

  return (
    <div className="app-shell" data-theme={theme}>
      {view.name === "home" ? (
        <Home
          trips={trips}
          onAdd={() => setView({ name: "new-trip" })}
          onOpen={(tripId) => setView({ name: "trip", tripId })}
          onUpdatePhotoAspect={(tripId, photoId, aspectRatio) => updatePhoto(tripId, photoId, { aspectRatio })}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : null}
      {view.name === "new-trip" ? (
        <TripForm onBack={() => setView({ name: "home" })} onSave={addTrip} theme={theme} onToggleTheme={toggleTheme} />
      ) : null}
      {view.name === "edit-trip" ? (
        <TripForm
          initialTrip={trips.find((trip) => trip.id === view.tripId)}
          onBack={() => setView({ name: "trip", tripId: view.tripId })}
          onSave={(next) => {
            updateTrip(view.tripId, next);
            setView({ name: "trip", tripId: view.tripId });
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : null}
      {view.name === "trip" ? (
        <TripDetail
          trip={trips.find((trip) => trip.id === view.tripId)}
          onBack={() => setView({ name: "home" })}
          onEdit={() => setView({ name: "edit-trip", tripId: view.tripId })}
          onAddPhotos={(photos) => appendPhotos(view.tripId, photos)}
          onUpdatePhoto={(photoId, next) => updatePhoto(view.tripId, photoId, next)}
          onDeletePhoto={(photoId) => deletePhoto(view.tripId, photoId)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : null}
    </div>
  );
}

function Home({
  trips,
  onAdd,
  onOpen,
  onUpdatePhotoAspect,
  theme,
  onToggleTheme,
}: {
  trips: TripRecord[];
  onAdd: () => void;
  onOpen: (tripId: string) => void;
  onUpdatePhotoAspect: (tripId: string, photoId: string, aspectRatio: number) => void;
} & ThemeProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="screen home-screen">
      <header className="topbar">
        <span className="wordmark">journoid</span>
        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={onAdd} aria-label="새 여행 추가"><PlusIcon /></button>
          <MenuButton open={menuOpen} onClick={() => setMenuOpen((current) => !current)} />
        </div>
      </header>

      <SettingsMenu open={menuOpen} onClose={() => setMenuOpen(false)} theme={theme} onToggleTheme={onToggleTheme} />

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
              <TripPreview trip={trip} onPhotoAspect={(photoId, aspectRatio) => onUpdatePhotoAspect(trip.id, photoId, aspectRatio)} />
            </button>
          ))}
        </section>
      )}
    </main>
  );
}

function TripPreview({
  trip,
  onPhotoAspect,
}: {
  trip: TripRecord;
  onPhotoAspect: (photoId: string, aspectRatio: number) => void;
}) {
  if (trip.photos.length === 0) return <span className="journey-photo-count">0</span>;
  return (
    <span className="preview-stack" aria-label={`${trip.photos.length}장의 사진`}>
      {trip.photos.slice(-2).map((photo, index) => (
        <span
          className="preview-polaroid"
          key={photo.id}
          style={photoFrameStyle(photo, {
            "--preview-index": index,
            "--frame-color": photo.frameColor ?? DEFAULT_FRAME_COLOR,
          } as CSSProperties)}
        >
          <span className="preview-photo">
            <img
              src={photo.dataUrl}
              alt=""
              onLoad={(event) => {
                const aspectRatio = renderedImageAspect(event.currentTarget);
                if (aspectRatio && isDifferentAspect(photo.aspectRatio, aspectRatio)) onPhotoAspect(photo.id, aspectRatio);
              }}
            />
            {photo.drawing ? <img className="drawing-layer" src={photo.drawing} alt="" /> : null}
          </span>
        </span>
      ))}
    </span>
  );
}

function TripForm({
  initialTrip,
  onBack,
  onSave,
  theme,
  onToggleTheme,
}: {
  initialTrip?: TripRecord;
  onBack: () => void;
  onSave: (details: TripDetails) => void;
} & ThemeProps) {
  const [city, setCity] = useState(initialTrip?.city ?? "");
  const [country, setCountry] = useState(initialTrip?.country ?? "");
  const [startDate, setStartDate] = useState(initialTrip?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialTrip?.endDate ?? "");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const title = tripTitle(city, startDate);

  const save = () => {
    if (!country.trim() || !city.trim() || !startDate || !endDate) return setError("나라, 도시와 날짜를 모두 입력해 주세요.");
    if (endDate < startDate) return setError("여행 종료일을 확인해 주세요.");
    onSave({ country, city, startDate, endDate });
  };

  return (
    <main className="screen form-screen">
      <header className="topbar">
        <button className="icon-button" type="button" onClick={onBack} aria-label="뒤로"><ArrowLeftIcon /></button>
        <div className="topbar-actions">
          <button className="icon-button" type="button" onClick={save} aria-label="저장"><CheckIcon /></button>
          <MenuButton open={menuOpen} onClick={() => setMenuOpen((current) => !current)} />
        </div>
      </header>
      <SettingsMenu open={menuOpen} onClose={() => setMenuOpen(false)} theme={theme} onToggleTheme={onToggleTheme} />
      <section className="trip-form">
        <h1>{title || (initialTrip ? "여행 수정" : "새 여행")}</h1>
        <label>
          <span>나라</span>
          <input value={country} onChange={(event) => { setCountry(event.target.value); setError(""); }} placeholder="나라 이름" autoFocus />
        </label>
        <label>
          <span>도시</span>
          <input value={city} onChange={(event) => { setCity(event.target.value); setError(""); }} placeholder="도시 이름" />
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
  onEdit,
  onAddPhotos,
  onUpdatePhoto,
  onDeletePhoto,
  theme,
  onToggleTheme,
}: {
  trip?: TripRecord;
  onBack: () => void;
  onEdit: () => void;
  onAddPhotos: (photos: PhotoRecord[]) => void;
  onUpdatePhoto: (photoId: string, next: PhotoUpdate) => void;
  onDeletePhoto: (photoId: string) => void;
} & ThemeProps) {
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [importNotice, setImportNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedPhoto = trip?.photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  const groups = useMemo(() => groupPhotos(trip?.photos ?? []), [trip?.photos]);

  if (!trip) return null;

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setImportNotice("");
    setUploadProgress({ done: 0, total: files.length });
    try {
      await yieldToBrowser();
      let done = 0;
      let failed = 0;
      for (let index = 0; index < files.length; index += 2) {
        const results = await Promise.allSettled(files.slice(index, index + 2).map(toPhotoRecord));
        const batch = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
        failed += results.length - batch.length;
        if (batch.length) onAddPhotos(batch);
        done += results.length;
        setUploadProgress({ done, total: files.length });
        await yieldToBrowser();
      }
      if (failed) setImportNotice(`${failed}장은 지원되지 않는 형식이라 제외했습니다.`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <main className="screen trip-screen">
        <header className="topbar sticky-topbar">
          <button className="icon-button" type="button" onClick={onBack} aria-label="여행 목록"><ArrowLeftIcon /></button>
          <div className="topbar-actions">
            <label className={`icon-button import-button ${uploading ? "is-loading" : ""}`} aria-label="사진 추가">
              <ImageIcon />
              <input ref={fileInput} type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} onClick={(event) => { event.currentTarget.value = ""; }} />
            </label>
            <MenuButton open={menuOpen} onClick={() => setMenuOpen((current) => !current)} />
          </div>
        </header>
        <SettingsMenu open={menuOpen} onClose={() => setMenuOpen(false)} theme={theme} onToggleTheme={onToggleTheme} onEditTrip={onEdit} />
        <section className="trip-heading">
          <h1>{trip.city}</h1>
          <div className="trip-meta">
            <span>{trip.country?.trim() ? `${trip.country.trim()} · ${formatTripRange(trip.startDate, trip.endDate)}` : formatTripRange(trip.startDate, trip.endDate)}</span>
            <span>{String(trip.photos.length).padStart(2, "0")}</span>
          </div>
          {importNotice ? <p className="import-notice" role="status">{importNotice}</p> : null}
        </section>

        {trip.photos.length === 0 ? (
          <button className="photo-empty" type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>
            <PlusIcon />
            <span>사진 추가</span>
          </button>
        ) : (
          <div className="timeline">
            {groups.map((group) => (
              <section className="date-section" key={group.key}>
                <header className="date-heading">
                  <strong className="date-number">{group.day}</strong>
                  <span className="date-meta">{group.weekday}</span>
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
                            style={photoFrameStyle(photo, { "--frame-color": photo.frameColor ?? DEFAULT_FRAME_COLOR } as CSSProperties)}
                            onClick={() => setSelectedPhotoId(photo.id)}
                            aria-label="폴라로이드 열기"
                          >
                            <span className="flat-photo">
                              <img
                                src={photo.dataUrl}
                                alt={photo.caption || "여행 사진"}
                                onLoad={(event) => {
                                  const aspectRatio = renderedImageAspect(event.currentTarget);
                                  if (aspectRatio && isDifferentAspect(photo.aspectRatio, aspectRatio)) onUpdatePhoto(photo.id, { aspectRatio });
                                }}
                              />
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

      {uploading ? <ImportOverlay done={uploadProgress.done} total={uploadProgress.total} /> : null}

      {selectedPhoto ? (
        <PhotoViewer
          photo={selectedPhoto}
          onClose={() => setSelectedPhotoId(null)}
          onSave={(next) => onUpdatePhoto(selectedPhoto.id, next)}
          onDelete={() => { onDeletePhoto(selectedPhoto.id); setSelectedPhotoId(null); }}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      ) : null}
    </>
  );
}

function ImportOverlay({ done, total }: { done: number; total: number }) {
  const progress = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="import-overlay" role="dialog" aria-modal="true" aria-label="사진 불러오기 진행 중">
      <div className="import-progress-card">
        <span>사진 불러오는 중</span>
        <strong>{String(done).padStart(2, "0")} / {String(total).padStart(2, "0")}</strong>
        <div className="import-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={Math.max(1, total)} aria-valuenow={done}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

function PhotoViewer({
  photo,
  onClose,
  onSave,
  onDelete,
  theme,
  onToggleTheme,
}: {
  photo: PhotoRecord;
  onClose: () => void;
  onSave: (next: PhotoUpdate) => void;
  onDelete: () => void;
} & ThemeProps) {
  const [mode, setMode] = useState<"model" | "edit">("model");
  const [rotation, setRotation] = useState({ x: -5, y: -16 });
  const [caption, setCaption] = useState(photo.caption);
  const [drawing, setDrawing] = useState(photo.drawing ?? "");
  const [frameColor, setFrameColor] = useState(photo.frameColor ?? DEFAULT_FRAME_COLOR);
  const [aspectRatio, setAspectRatio] = useState(validPhotoAspect(photo.aspectRatio));
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; distance: number } | null>(null);
  const drawingExporterRef = useRef<(() => Promise<string>) | null>(null);
  const locationLabel = formatPhotoLocation(photo.location);

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
    setRotation((value) => ({
      x: Math.max(-72, Math.min(72, value.x - deltaY * 0.32)),
      y: ((value.y + deltaX * 0.4 + 540) % 360) - 180,
    }));
  };

  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    const wasTap = drag.current.distance < 9;
    drag.current = null;
    if (wasTap) setMode("edit");
  };

  const rememberPhotoAspect = (image: HTMLImageElement) => {
    const nextAspect = renderedImageAspect(image);
    if (!nextAspect || !isDifferentAspect(aspectRatio, nextAspect)) return;
    setAspectRatio(nextAspect);
    onSave({ aspectRatio: nextAspect });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    let latestDrawing = drawing;
    try {
      if (drawingExporterRef.current) latestDrawing = await drawingExporterRef.current();
    } catch {
      // Fall back to the latest completed export if the canvas encoder is unavailable.
    }
    setDrawing(latestDrawing);
    onSave({ caption: caption.trim(), drawing: latestDrawing || undefined, frameColor, aspectRatio });
    setSaving(false);
    setMode("model");
  };

  return (
    <div className={`fullscreen-viewer ${mode === "edit" ? "is-editing" : ""}`} role="dialog" aria-modal="true" aria-label="폴라로이드 상세">
      <header className="viewer-header">
        <button className="icon-button" type="button" onClick={mode === "edit" ? () => setMode("model") : onClose} aria-label={mode === "edit" ? "모델로 돌아가기" : "닫기"}>
          {mode === "edit" ? <ArrowLeftIcon /> : <Cross1Icon />}
        </button>
        <div className="topbar-actions">
          {mode === "edit" ? <button className="save-text-button" type="button" onClick={save} disabled={saving}>저장</button> : null}
          <MenuButton open={menuOpen} onClick={() => setMenuOpen((current) => !current)} />
        </div>
      </header>

      <SettingsMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onDeletePhoto={onDelete}
      />

      {mode === "model" ? (
        <div className="model-stage" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }}>
          {locationLabel || caption.trim() ? (
            <div className="model-copy">
              {locationLabel ? <p className="model-location">{locationLabel}</p> : null}
              {caption.trim() ? <p className="model-caption">{caption.trim()}</p> : null}
            </div>
          ) : null}
          <div
            className="polaroid-model"
            style={photoFrameStyle({ aspectRatio }, {
              "--frame-color": frameColor,
              transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            } as CSSProperties)}
          >
            <div className="model-face model-front">
              <ModelPhoto photo={photo} drawing={drawing} onAspectChange={rememberPhotoAspect} />
            </div>
            <div className="model-face model-back" />
            <span className="model-edge edge-top" />
            <span className="model-edge edge-right" />
            <span className="model-edge edge-bottom" />
            <span className="model-edge edge-left" />
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
          aspectRatio={aspectRatio}
          onAspectChange={rememberPhotoAspect}
          drawingExporterRef={drawingExporterRef}
        />
      )}
    </div>
  );
}

function ModelPhoto({
  photo,
  drawing,
  onAspectChange,
}: {
  photo: PhotoRecord;
  drawing: string;
  onAspectChange: (image: HTMLImageElement) => void;
}) {
  return (
    <div className="model-photo">
      <img src={photo.dataUrl} alt={photo.caption || "여행 사진"} onLoad={(event) => onAspectChange(event.currentTarget)} />
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

function drawingCanvasSize(aspectRatio: number) {
  const aspect = validPhotoAspect(aspectRatio);
  return aspect >= 1
    ? { width: 1200, height: Math.max(1, Math.round(1200 / aspect)) }
    : { width: Math.max(1, Math.round(1200 * aspect)), height: 1200 };
}

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMidpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function drawLine(
  context: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number,
  color: string,
  alpha: number,
  offset = { x: 0, y: 0 },
  lineCap: CanvasLineCap = "round",
) {
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = lineCap;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(from.x + offset.x, from.y + offset.y);
  context.lineTo(to.x + offset.x, to.y + offset.y);
  context.stroke();
}

function drawBrushSegment(
  context: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  kind: BrushKind,
  color: string,
  size: number,
  pressure: number,
) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < 0.35) return;

  context.save();
  context.globalCompositeOperation = "source-over";

  if (kind === "marker") {
    drawLine(context, from, to, Math.max(24, size * 5), color, 1, { x: 0, y: 0 }, "square");
    context.restore();
    return;
  }

  if (kind === "pencil") {
    const normal = { x: -deltaY / distance, y: deltaX / distance };
    const grain = Math.max(0.55, size * 0.28);
    const textureWidth = Math.max(0.7, size * (0.2 + pressure * 0.16));
    const fibers = [
      { offset: -0.72, alpha: 0.16 },
      { offset: 0, alpha: 0.36 },
      { offset: 0.68, alpha: 0.14 },
    ];
    fibers.forEach((fiber, index) => {
      const phase = Math.sin((from.x + from.y * 0.7 + index * 19) * 0.045) * grain * 0.22;
      const amount = fiber.offset * grain + phase;
      drawLine(
        context,
        from,
        to,
        textureWidth,
        color,
        fiber.alpha + pressure * 0.06,
        { x: normal.x * amount, y: normal.y * amount },
      );
    });
    context.restore();
    return;
  }

  drawLine(context, from, to, size * (0.72 + pressure * 0.5), color, 1);
  context.restore();
}

type DrawingSnapshot = {
  canvas: HTMLCanvasElement;
  hasDrawing: boolean;
};

type DrawingExporterRef = {
  current: (() => Promise<string>) | null;
};

function PhotoEditor({
  photo,
  drawing,
  onDrawingChange,
  caption,
  onCaptionChange,
  frameColor,
  onFrameColorChange,
  aspectRatio,
  onAspectChange,
  drawingExporterRef,
}: {
  photo: PhotoRecord;
  drawing: string;
  onDrawingChange: (value: string) => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  frameColor: string;
  onFrameColorChange: (value: string) => void;
  aspectRatio: number;
  onAspectChange: (image: HTMLImageElement) => void;
  drawingExporterRef: DrawingExporterRef;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const editorPhotoRef = useRef<HTMLDivElement>(null);
  const [brushSize, setBrushSize] = useState(4);
  const [brushKind, setBrushKind] = useState<BrushKind>("pen");
  const [brushColor, setBrushColor] = useState(DEFAULT_DRAWING_COLOR);
  const [tool, setTool] = useState<"draw" | "move">("draw");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const drawingRef = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const lastPressure = useRef(0.5);
  const strokeMade = useRef(false);
  const activeBrush = useRef<BrushKind>("pen");
  const hasDrawing = useRef(Boolean(drawing));
  const drawingRevision = useRef(0);
  const lastPublishedDrawing = useRef("");
  const history = useRef<DrawingSnapshot[]>([]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<EditorGesture | null>(null);
  const canvasSize = drawingCanvasSize(aspectRatio);

  useEffect(() => {
    if (drawingRef.current || drawing === lastPublishedDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawing.current = Boolean(drawing);
    if (!drawing) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = drawing;
    return () => { cancelled = true; };
  }, [drawing, canvasSize.height, canvasSize.width]);

  useEffect(() => {
    const exporter = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawing.current) return "";
      return canvasToPngDataUrl(canvas);
    };
    drawingExporterRef.current = exporter;
    return () => {
      if (drawingExporterRef.current === exporter) drawingExporterRef.current = null;
    };
  }, [drawingExporterRef]);

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

  const pushHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snapshot = document.createElement("canvas");
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
    history.current.push({ canvas: snapshot, hasDrawing: hasDrawing.current });
    if (history.current.length > 12) history.current.shift();
  };

  const publishDrawing = () => {
    const canvas = canvasRef.current;
    const revision = ++drawingRevision.current;
    if (!canvas || !hasDrawing.current) {
      lastPublishedDrawing.current = "";
      onDrawingChange("");
      return;
    }
    void canvasToPngDataUrl(canvas).then((value) => {
      if (drawingRevision.current !== revision) return;
      lastPublishedDrawing.current = value;
      onDrawingChange(value);
    });
  };

  const finishDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPoint.current = null;
    const canvas = canvasRef.current;
    const strokeCanvas = strokeCanvasRef.current;
    if (strokeMade.current && canvas && strokeCanvas) {
      const context = canvas.getContext("2d");
      if (context) {
        context.save();
        context.globalAlpha = activeBrush.current === "marker" ? 0.24 : 1;
        context.drawImage(strokeCanvas, 0, 0);
        context.restore();
        hasDrawing.current = true;
        publishDrawing();
      }
    } else {
      history.current.pop();
    }
    strokeCanvas?.getContext("2d")?.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    strokeMade.current = false;
  };

  const startDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    pushHistory();
    const strokeCanvas = strokeCanvasRef.current;
    strokeCanvas?.getContext("2d")?.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    drawingRef.current = true;
    strokeMade.current = false;
    activeBrush.current = brushKind;
    lastPressure.current = event.pressure > 0 ? clamp(event.pressure, 0.2, 1) : 0.5;
    lastPoint.current = pointFor(event.clientX, event.clientY);
    gesture.current = { kind: "draw", pointerId: event.pointerId };
  };

  const moveDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current || !lastPoint.current) return;
    const strokeCanvas = strokeCanvasRef.current;
    if (!strokeCanvas) return;
    const context = strokeCanvas.getContext("2d");
    if (!context) return;
    const nativeEvent = event.nativeEvent;
    const samples = typeof nativeEvent.getCoalescedEvents === "function"
      ? nativeEvent.getCoalescedEvents()
      : [nativeEvent];
    samples.forEach((sample) => {
      if (!lastPoint.current) return;
      const point = pointFor(sample.clientX, sample.clientY);
      if (pointerDistance(lastPoint.current, point) < 0.35) return;
      const rawPressure = sample.pressure > 0 ? clamp(sample.pressure, 0.2, 1) : 0.5;
      const pressure = lastPressure.current * 0.68 + rawPressure * 0.32;
      drawBrushSegment(context, lastPoint.current, point, activeBrush.current, brushColor, brushSize, pressure);
      lastPressure.current = pressure;
      lastPoint.current = point;
      strokeMade.current = true;
    });
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
    const canvas = canvasRef.current;
    if (!previous || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(previous.canvas, 0, 0);
    hasDrawing.current = previous.hasDrawing;
    publishDrawing();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pushHistory();
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    const strokeCanvas = strokeCanvasRef.current;
    strokeCanvas?.getContext("2d")?.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    hasDrawing.current = false;
    publishDrawing();
  };

  const selectBrush = (kind: BrushKind) => {
    setBrushKind(kind);
    setTool("draw");
  };

  return (
    <div className="editor-page">
      <div className="editor-polaroid" style={photoFrameStyle({ aspectRatio }, { "--frame-color": frameColor } as CSSProperties)}>
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
            <img src={photo.dataUrl} alt="편집할 여행 사진" onLoad={(event) => onAspectChange(event.currentTarget)} />
            <canvas ref={canvasRef} className="drawing-canvas" width={canvasSize.width} height={canvasSize.height} aria-label="사진 위에 낙서하기" />
            <canvas
              ref={strokeCanvasRef}
              className="stroke-canvas"
              width={canvasSize.width}
              height={canvasSize.height}
              style={{ opacity: brushKind === "marker" ? 0.24 : 1 }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
      <div className="editor-controls">
        <div className="brush-tools" aria-label="브러시 종류">
          <button className={tool === "draw" && brushKind === "pen" ? "is-active" : ""} type="button" onClick={() => selectBrush("pen")} aria-label="펜" aria-pressed={tool === "draw" && brushKind === "pen"}><Pencil1Icon /></button>
          <button className={tool === "draw" && brushKind === "pencil" ? "is-active" : ""} type="button" onClick={() => selectBrush("pencil")} aria-label="연필" aria-pressed={tool === "draw" && brushKind === "pencil"}><Pencil2Icon /></button>
          <button className={tool === "draw" && brushKind === "marker" ? "is-active" : ""} type="button" onClick={() => selectBrush("marker")} aria-label="형광펜" aria-pressed={tool === "draw" && brushKind === "marker"}><OpacityIcon /></button>
          <span className="tool-divider" />
          <button className={tool === "move" ? "is-active" : ""} type="button" onClick={() => setTool("move")} aria-label="확대한 사진 이동" aria-pressed={tool === "move"} disabled={zoom <= 1}><MoveIcon /></button>
        </div>
        <div className="drawing-tools" aria-label="브러시 굵기와 편집">
          <button type="button" onClick={() => setBrushSize((size) => Math.max(2, size - 2))} aria-label="펜 가늘게"><MinusIcon /></button>
          <span
            className={`brush-preview is-${brushKind}`}
            style={{
              "--brush-color": brushColor,
              "--brush-opacity": brushKind === "marker" ? 0.28 : brushKind === "pencil" ? 0.7 : 1,
              width: brushKind === "marker" ? brushSize * 2 + 14 : brushSize + 6,
              height: brushKind === "marker" ? 8 : brushSize + 6,
            } as CSSProperties}
          />
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
      <div className="drawing-colors color-controls" aria-label="펜 색상">
        <Pencil1Icon aria-hidden="true" />
        {DRAWING_COLORS.map((color) => (
          <button
            className="color-swatch"
            type="button"
            key={color}
            style={{ "--swatch": color } as CSSProperties}
            onClick={() => setBrushColor(color)}
            aria-label={`펜 색상 ${color}`}
            aria-pressed={brushColor.toLowerCase() === color}
          />
        ))}
        <label className="color-custom" aria-label="사용자 지정 펜 색상">
          <PlusIcon />
          <input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} />
        </label>
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
  const metadata = await readExifMetadata(file);
  const capturedAt = metadata.capturedAt ?? new Date(file.lastModified || Date.now());
  const resized = await resizeImage(file);
  return {
    id: `photo-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`,
    name: file.name,
    dataUrl: resized.dataUrl,
    capturedAt: capturedAt.toISOString(),
    caption: "",
    frameColor: DEFAULT_FRAME_COLOR,
    aspectRatio: resized.aspectRatio,
    ...(metadata.location ? { location: metadata.location } : {}),
  };
}

async function resizeImage(file: File): Promise<{ dataUrl: string; aspectRatio: number }> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const aspectRatio = validPhotoAspect(bitmap.width / bitmap.height);
    const maxSide = 900;
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { dataUrl: await canvasToDataUrl(canvas), aspectRatio };
  } catch {
    const dataUrl = await fileToDataUrl(file);
    const aspectRatio = await dataUrlAspect(dataUrl);
    if (!aspectRatio) throw new Error("Unsupported image format");
    return { dataUrl, aspectRatio };
  } finally {
    bitmap?.close();
  }
}

function dataUrlAspect(dataUrl: string) {
  return new Promise<number | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(renderedImageAspect(image));
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

function canvasToDataUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Image encoding failed"));
      fileToDataUrl(blob).then(resolve, reject);
    }, "image/jpeg", 0.74);
  });
}

function canvasToPngDataUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Drawing encoding failed"));
      fileToDataUrl(blob).then(resolve, reject);
    }, "image/png");
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

type ExifMetadata = {
  capturedAt: Date | null;
  location?: PhotoLocation;
};

type TiffEntry = {
  entryOffset: number;
  type: number;
  count: number;
};

const EMPTY_EXIF_METADATA: ExifMetadata = { capturedAt: null };
const EXIF_SCAN_LIMIT = 1024 * 1024;

async function readExifMetadata(file: File): Promise<ExifMetadata> {
  try {
    const buffer = await file.slice(0, EXIF_SCAN_LIMIT).arrayBuffer();
    const view = new DataView(buffer);
    for (const tiffStart of findExifTiffStarts(view, file)) {
      const metadata = parseExifTiff(view, tiffStart);
      if (metadata.capturedAt || metadata.location) return metadata;
    }
  } catch {
    return EMPTY_EXIF_METADATA;
  }
  return EMPTY_EXIF_METADATA;
}

function isTiffStart(view: DataView, offset: number) {
  if (offset < 0 || offset + 4 > view.byteLength) return false;
  return (view.getUint8(offset) === 0x49 && view.getUint8(offset + 1) === 0x49 && view.getUint16(offset + 2, true) === 0x002a)
    || (view.getUint8(offset) === 0x4d && view.getUint8(offset + 1) === 0x4d && view.getUint16(offset + 2, false) === 0x002a);
}

function findExifTiffStarts(view: DataView, file: File) {
  const starts: number[] = [];
  const add = (offset: number) => {
    if (isTiffStart(view, offset) && !starts.includes(offset)) starts.push(offset);
  };

  if (view.byteLength >= 4 && view.getUint16(0, false) === 0xffd8) {
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if ((marker & 0xff00) !== 0xff00) break;
      const segmentLength = view.getUint16(offset, false);
      if (segmentLength < 2 || offset + segmentLength > view.byteLength) break;
      if (marker === 0xffe1 && segmentLength >= 10) {
        const payload = offset + 2;
        if (view.getUint8(payload) === 0x45 && view.getUint8(payload + 1) === 0x78 && view.getUint8(payload + 2) === 0x69 && view.getUint8(payload + 3) === 0x66) add(payload + 6);
      }
      offset += segmentLength;
    }
    return starts;
  }

  if (view.byteLength >= 12 && view.getUint32(0, false) === 0x89504e47) {
    let offset = 8;
    while (offset + 12 <= view.byteLength) {
      const length = view.getUint32(offset, false);
      if (length > view.byteLength - offset - 12) break;
      if (view.getUint32(offset + 4, false) === 0x65584966) add(offset + 8);
      offset += length + 12;
    }
    return starts;
  }

  const containerImage = /(?:heic|heif|avif|tiff?)/i.test(`${file.type} ${file.name}`);
  if (!containerImage) return starts;
  add(0);
  for (let offset = 0; offset + 4 <= view.byteLength && starts.length < 4; offset += 1) {
    if (isTiffStart(view, offset)) add(offset);
  }
  return starts;
}

export function parseExifTiff(view: DataView, tiffStart: number): ExifMetadata {
  if (tiffStart + 8 >= view.byteLength) return EMPTY_EXIF_METADATA;
  const endianMark = view.getUint16(tiffStart, false);
  const little = endianMark === 0x4949;
  if (!little && endianMark !== 0x4d4d) return EMPTY_EXIF_METADATA;
  const uint16 = (offset: number) => view.getUint16(offset, little);
  const uint32 = (offset: number) => view.getUint32(offset, little);
  const firstIfd = tiffStart + uint32(tiffStart + 4);

  const valueOffset = (entry: TiffEntry, byteLength: number) => (
    byteLength <= 4 ? entry.entryOffset + 8 : tiffStart + uint32(entry.entryOffset + 8)
  );
  const parseIfd = (ifdOffset: number, wantedTags: number[]) => {
    if (ifdOffset < 0 || ifdOffset + 2 > view.byteLength) return new Map<number, TiffEntry>();
    const count = Math.min(uint16(ifdOffset), 256);
    const result = new Map<number, TiffEntry>();
    for (let index = 0; index < count; index += 1) {
      const entry = ifdOffset + 2 + index * 12;
      if (entry + 12 > view.byteLength) break;
      const tag = uint16(entry);
      if (!wantedTags.includes(tag)) continue;
      result.set(tag, { entryOffset: entry, type: uint16(entry + 2), count: uint32(entry + 4) });
    }
    return result;
  };

  const readScalar = (entry?: TiffEntry) => {
    if (!entry || entry.count < 1) return null;
    if (entry.type === 3) return uint16(entry.entryOffset + 8);
    if (entry.type === 4) return uint32(entry.entryOffset + 8);
    return null;
  };
  const readAscii = (entry?: TiffEntry) => {
    if (!entry || entry.type !== 2 || entry.count < 1) return "";
    const start = valueOffset(entry, entry.count);
    if (start < 0 || start + entry.count > view.byteLength) return "";
    let value = "";
    for (let index = 0; index < entry.count; index += 1) {
      const char = view.getUint8(start + index);
      if (char === 0) break;
      value += String.fromCharCode(char);
    }
    return value;
  };
  const readRationals = (entry?: TiffEntry) => {
    if (!entry || entry.type !== 5 || entry.count < 1 || entry.count > 8) return [];
    const byteLength = entry.count * 8;
    const start = valueOffset(entry, byteLength);
    if (start < 0 || start + byteLength > view.byteLength) return [];
    const values: number[] = [];
    for (let index = 0; index < entry.count; index += 1) {
      const numerator = uint32(start + index * 8);
      const denominator = uint32(start + index * 8 + 4);
      if (!denominator) return [];
      values.push(numerator / denominator);
    }
    return values;
  };

  const root = parseIfd(firstIfd, [0x0132, 0x8769, 0x8825]);
  const exifPointer = readScalar(root.get(0x8769));
  const exif = exifPointer ? parseIfd(tiffStart + exifPointer, [0x9003, 0x9004]) : new Map();
  const raw = readAscii(exif.get(0x9003)) || readAscii(exif.get(0x9004)) || readAscii(root.get(0x0132));
  const match = raw?.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  let capturedAt: Date | null = null;
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    if (!Number.isNaN(date.getTime())) capturedAt = date;
  }

  const gpsPointer = readScalar(root.get(0x8825));
  const gps = gpsPointer ? parseIfd(tiffStart + gpsPointer, [0x0001, 0x0002, 0x0003, 0x0004]) : new Map<number, TiffEntry>();
  const latitudeValues = readRationals(gps.get(0x0002));
  const longitudeValues = readRationals(gps.get(0x0004));
  let location: PhotoLocation | undefined;
  if (latitudeValues.length >= 3 && longitudeValues.length >= 3) {
    const latitudeRef = readAscii(gps.get(0x0001)).toUpperCase();
    const longitudeRef = readAscii(gps.get(0x0003)).toUpperCase();
    const unsignedLatitude = latitudeValues[0] + latitudeValues[1] / 60 + latitudeValues[2] / 3600;
    const unsignedLongitude = longitudeValues[0] + longitudeValues[1] / 60 + longitudeValues[2] / 3600;
    const latitude = latitudeRef === "S" ? -unsignedLatitude : unsignedLatitude;
    const longitude = longitudeRef === "W" ? -unsignedLongitude : unsignedLongitude;
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      location = { latitude, longitude, source: "exif" };
    }
  }

  return location ? { capturedAt, location } : { capturedAt };
}
