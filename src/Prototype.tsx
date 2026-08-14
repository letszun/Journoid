import {
  createContext,
  type CSSProperties,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeftIcon,
  Cross1Icon,
  ImageIcon,
  Pencil1Icon,
  PlusIcon,
  ResetIcon,
} from "@radix-ui/react-icons";
import {
  BottomSheet,
  FlowStack,
  KeyboardInput,
  KeyboardTextarea,
  MobileScroll,
  type FlowControls,
  type FlowScreen,
} from "./mobile";

type PhotoRecord = {
  id: string;
  name: string;
  dataUrl: string;
  capturedAt: string;
  caption: string;
};

type TripRecord = {
  id: string;
  city: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  photos: PhotoRecord[];
};

type TravelStoreValue = {
  trips: TripRecord[];
  activeTripId: string | null;
  setActiveTripId: (id: string | null) => void;
  addTrip: (city: string, startDate: string, endDate: string) => string;
  appendPhotos: (tripId: string, photos: PhotoRecord[]) => void;
  updatePhotoCaption: (tripId: string, photoId: string, caption: string) => void;
};

const STORAGE_KEY = "journey-polaroid-trips-v1";
const EMPTY_POLAROID_STACK = `${import.meta.env.BASE_URL}empty-polaroid-stack.png`;
const TravelStoreContext = createContext<TravelStoreValue | null>(null);

function useTravelStore() {
  const store = useContext(TravelStoreContext);
  if (!store) throw new Error("useTravelStore must be used inside TravelStore");
  return store;
}

function readSavedTrips(): TripRecord[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as TripRecord[]) : [];
  } catch {
    return [];
  }
}

function TravelStore({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<TripRecord[]>(readSavedTrips);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    } catch {
      // The prototype keeps working in memory if browser storage is full.
    }
  }, [trips]);

  const value = useMemo<TravelStoreValue>(
    () => ({
      trips,
      activeTripId,
      setActiveTripId,
      addTrip: (city, startDate, endDate) => {
        const id = `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const nextTrip: TripRecord = {
          id,
          city: city.trim(),
          startDate,
          endDate,
          createdAt: new Date().toISOString(),
          photos: [],
        };
        setTrips((current) => [nextTrip, ...current]);
        setActiveTripId(id);
        return id;
      },
      appendPhotos: (tripId, photos) => {
        setTrips((current) =>
          current.map((trip) =>
            trip.id === tripId
              ? {
                  ...trip,
                  photos: [...trip.photos, ...photos].sort(
                    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
                  ),
                }
              : trip,
          ),
        );
      },
      updatePhotoCaption: (tripId, photoId, caption) => {
        setTrips((current) =>
          current.map((trip) =>
            trip.id === tripId
              ? {
                  ...trip,
                  photos: trip.photos.map((photo) =>
                    photo.id === photoId ? { ...photo, caption } : photo,
                  ),
                }
              : trip,
          ),
        );
      },
    }),
    [activeTripId, trips],
  );

  return <TravelStoreContext.Provider value={value}>{children}</TravelStoreContext.Provider>;
}

function tripTitle(city: string, startDate: string) {
  if (!city.trim() || !startDate) return "";
  const month = new Date(`${startDate}T12:00:00`).getMonth() + 1;
  return `${month}월의 ${city.trim()}`;
}

function formatTripRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const startText = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(start);
  const endText = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(end);
  return `${startText} — ${endText}`;
}

function tripScreen(): FlowScreen {
  return {
    id: "trip-detail",
    headerHeight: 58,
    header: (flow) => <TripHeader flow={flow} />,
    render: () => <TripDetailScreen />,
  };
}

function newTripScreen(): FlowScreen {
  return {
    id: "new-trip",
    headerHeight: 58,
    header: (flow) => <SimpleHeader title="새 여행" onBack={flow.pop} />,
    render: (flow) => <NewTripScreen flow={flow} />,
  };
}

function homeScreen(): FlowScreen {
  return {
    id: "home",
    render: (flow) => <HomeScreen flow={flow} />,
  };
}

function SimpleHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="app-header">
      <button className="header-icon-button" type="button" onClick={onBack} aria-label="뒤로 가기">
        <ArrowLeftIcon width="20" height="20" />
      </button>
      <strong>{title}</strong>
      <span className="header-spacer" aria-hidden="true" />
    </div>
  );
}

function TripHeader({ flow }: { flow: FlowControls }) {
  const { trips, activeTripId } = useTravelStore();
  const trip = trips.find((item) => item.id === activeTripId);

  return (
    <div className="app-header trip-app-header">
      <button className="header-icon-button" type="button" onClick={flow.pop} aria-label="여행 목록으로 돌아가기">
        <ArrowLeftIcon width="20" height="20" />
      </button>
      <strong>{trip?.city ?? "여행"}</strong>
      <span className="header-spacer" aria-hidden="true" />
    </div>
  );
}

function HomeScreen({ flow }: { flow: FlowControls }) {
  const { trips, setActiveTripId } = useTravelStore();

  const openTrip = (id: string) => {
    setActiveTripId(id);
    flow.push(tripScreen());
  };

  return (
    <MobileScroll className="app-scroll">
      <main className="home-screen">
        <header className="home-topbar">
          <span className="wordmark">jours.</span>
          <button className="round-add-button" type="button" onClick={() => flow.push(newTripScreen())} aria-label="새 여행 추가">
            <PlusIcon width="20" height="20" />
          </button>
        </header>

        {trips.length === 0 ? (
          <section className="empty-state" aria-labelledby="empty-title">
            <img
              className="empty-stack-image"
              src={EMPTY_POLAROID_STACK}
              alt="여행 풍경이 담긴 폴라로이드 사진 더미"
              draggable={false}
            />
            <div className="empty-copy">
              <p className="section-kicker">YOUR JOURNEYS</p>
              <h1 id="empty-title">여행의 장면을<br />한곳에 모아보세요.</h1>
              <p>도시와 날짜를 먼저 적고, 그 여행의 사진을 천천히 채워보세요.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => flow.push(newTripScreen())}>
              <PlusIcon width="17" height="17" />
              첫 여행 추가
            </button>
          </section>
        ) : (
          <section className="trip-list" aria-labelledby="trip-list-title">
            <div className="list-heading">
              <div>
                <p className="section-kicker">YOUR JOURNEYS</p>
                <h1 id="trip-list-title">나의 여행</h1>
              </div>
              <span>{trips.length} TRIPS</span>
            </div>
            <div className="trip-cards">
              {trips.map((trip) => (
                <button className="trip-card" type="button" key={trip.id} onClick={() => openTrip(trip.id)}>
                  <div className="trip-card-copy">
                    <strong>{tripTitle(trip.city, trip.startDate)}</strong>
                    <span>{formatTripRange(trip.startDate, trip.endDate)}</span>
                    <small>{trip.photos.length}장의 사진</small>
                  </div>
                  <TripCardPhotos trip={trip} />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </MobileScroll>
  );
}

function TripCardPhotos({ trip }: { trip: TripRecord }) {
  if (trip.photos.length === 0) {
    return <div className="trip-card-empty"><ImageIcon width="21" height="21" /></div>;
  }

  return (
    <div className="trip-card-photos" aria-hidden="true">
      {trip.photos.slice(0, 3).map((photo) => (
        <img key={photo.id} src={photo.dataUrl} alt="" draggable={false} />
      ))}
    </div>
  );
}

function NewTripScreen({ flow }: { flow: FlowControls }) {
  const { addTrip } = useTravelStore();
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const generatedTitle = tripTitle(city, startDate);

  const saveTrip = () => {
    if (!city.trim() || !startDate || !endDate) {
      setError("도시와 여행 날짜를 모두 입력해 주세요.");
      return;
    }

    if (endDate < startDate) {
      setError("돌아오는 날짜가 출발 날짜보다 빠릅니다.");
      return;
    }

    addTrip(city, startDate, endDate);
    flow.replace(tripScreen());
  };

  return (
    <MobileScroll className="app-scroll form-scroll">
      <main className="new-trip-screen">
        <p className="section-kicker">NEW JOURNEY</p>
        <div className={`title-preview ${generatedTitle ? "is-ready" : ""}`}>
          {generatedTitle || "도시와 날짜를 적으면\n여행 제목이 생겨요."}
        </div>

        <div className="trip-form">
          <label className="field-label" htmlFor="trip-city">
            <span>도시</span>
            <KeyboardInput
              id="trip-city"
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setError("");
              }}
              placeholder="예: 충칭, 비엔나, 제주"
              autoComplete="off"
            />
          </label>

          <div className="date-fields">
            <label className="field-label" htmlFor="trip-start">
              <span>출발</span>
              <input
                id="trip-start"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (!endDate || endDate < event.target.value) setEndDate(event.target.value);
                  setError("");
                }}
              />
            </label>
            <label className="field-label" htmlFor="trip-end">
              <span>도착</span>
              <input
                id="trip-end"
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setError("");
                }}
              />
            </label>
          </div>

          <p className="form-help">제목은 시작 월과 도시를 조합해 자동으로 만들어집니다.</p>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>

        <button className="primary-button form-submit" type="button" onClick={saveTrip}>
          여행 만들기
        </button>
      </main>
    </MobileScroll>
  );
}

function TripDetailScreen() {
  const { trips, activeTripId, appendPhotos, updatePhotoCaption } = useTravelStore();
  const trip = trips.find((item) => item.id === activeTripId);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  if (!trip) {
    return <MobileScroll className="app-scroll"><p className="missing-trip">여행을 찾을 수 없습니다.</p></MobileScroll>;
  }

  const selectedPhoto = trip.photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  const groups = groupPhotos(trip.photos);

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setUploadMessage("");
    const imported = await Promise.all(files.slice(0, 24).map(toPhotoRecord));
    appendPhotos(trip.id, imported);
    setUploading(false);
    setUploadMessage(`${imported.length}장을 촬영 시간순으로 정리했습니다.`);
  };

  return (
    <>
      <MobileScroll className="app-scroll detail-scroll">
        <main className="trip-detail-screen">
          <header className="trip-title-block">
            <p className="section-kicker">TRAVEL ARCHIVE</p>
            <h1>{tripTitle(trip.city, trip.startDate)}</h1>
            <p>{formatTripRange(trip.startDate, trip.endDate)}</p>
          </header>

          <label className={`photo-import-button ${uploading ? "is-busy" : ""}`}>
            <ImageIcon width="18" height="18" />
            <span>{uploading ? "사진을 정리하는 중…" : "사진 불러오기"}</span>
            <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} />
          </label>
          {uploadMessage ? <p className="upload-message" role="status">{uploadMessage}</p> : null}

          {trip.photos.length === 0 ? (
            <section className="photo-empty-state">
              <img src={EMPTY_POLAROID_STACK} alt="겹쳐 놓은 여행 폴라로이드" draggable={false} />
              <p>아직 사진이 없습니다.</p>
              <span>갤러리에서 불러오면 날짜와 시간대별로 나눠드려요.</span>
            </section>
          ) : (
            <div className="photo-timeline">
              {groups.map((group) => (
                <section className="date-group" key={group.key}>
                  <header>
                    <strong>{group.dateLabel}</strong>
                    <span>·</span>
                    <span>{group.weekday}</span>
                  </header>
                  {group.periods.map((period) => (
                    <div className="time-group" key={`${group.key}-${period.label}`}>
                      <p>{period.label}</p>
                      <div className="polaroid-row">
                        {period.photos.map((photo, index) => (
                          <button
                            className="mini-polaroid"
                            type="button"
                            key={photo.id}
                            onClick={() => setSelectedPhotoId(photo.id)}
                            style={{ "--photo-tilt": `${[-2.4, 1.1, -0.8, 2][index % 4]}deg` } as CSSProperties}
                          >
                            <img src={photo.dataUrl} alt={photo.caption || `${formatPhotoTime(photo.capturedAt)}에 촬영한 사진`} draggable={false} />
                            <span>{formatPhotoTime(photo.capturedAt)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </main>
      </MobileScroll>

      <PhotoViewer
        photo={selectedPhoto}
        open={Boolean(selectedPhoto)}
        onClose={() => setSelectedPhotoId(null)}
        onSave={(caption) => {
          if (!selectedPhoto) return;
          updatePhotoCaption(trip.id, selectedPhoto.id, caption);
          setSelectedPhotoId(null);
        }}
      />
    </>
  );
}

type PhotoGroup = {
  key: string;
  dateLabel: string;
  weekday: string;
  periods: { label: string; photos: PhotoRecord[] }[];
};

function groupPhotos(photos: PhotoRecord[]): PhotoGroup[] {
  const byDate = new Map<string, PhotoRecord[]>();

  photos.forEach((photo) => {
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
      weekday: new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(date),
      periods: Array.from(periodMap.entries()).map(([label, periodPhotos]) => ({ label, photos: periodPhotos })),
    };
  });
}

function formatPhotoTime(capturedAt: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(capturedAt),
  );
}

function PhotoViewer({
  photo,
  open,
  onClose,
  onSave,
}: {
  photo: PhotoRecord | null;
  open: boolean;
  onClose: () => void;
  onSave: (caption: string) => void;
}) {
  const [rotation, setRotation] = useState({ x: -5, y: -14 });
  const [caption, setCaption] = useState("");
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!photo) return;
    setCaption(photo.caption);
    setRotation({ x: -5, y: -14 });
  }, [photo]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    setRotation((current) => ({
      x: Math.max(-70, Math.min(70, current.x - deltaY * 0.35)),
      y: current.y + deltaX * 0.42,
    }));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <BottomSheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} title="폴라로이드" description={photo ? `${formatPhotoTime(photo.capturedAt)} 촬영` : undefined} snap={0.92}>
      {photo ? (
        <div className="photo-viewer-content">
          <button className="sheet-close" type="button" onClick={onClose} aria-label="사진 닫기">
            <Cross1Icon width="16" height="16" />
          </button>
          <div
            className="polaroid-stage"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div
              className="polaroid-model"
              style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}
              aria-label="드래그해서 돌려볼 수 있는 폴라로이드"
            >
              <div className="model-face model-front">
                <img src={photo.dataUrl} alt={photo.caption || "여행 사진"} draggable={false} />
                <p>{caption || "한 줄을 남겨보세요."}</p>
                <span>{formatPhotoTime(photo.capturedAt)}</span>
              </div>
              <div className="model-face model-back">
                <strong>JOURNEY NOTE</strong>
                <small>{new Date(photo.capturedAt).toLocaleDateString("ko-KR")}</small>
                <p>{caption || "이 사진의 기억은 아직 비어 있습니다."}</p>
              </div>
              <span className="model-edge edge-right" aria-hidden="true" />
              <span className="model-edge edge-bottom" aria-hidden="true" />
            </div>
          </div>
          <button className="reset-model" type="button" onClick={() => setRotation({ x: -5, y: -14 })}>
            <ResetIcon width="14" height="14" /> 제자리
          </button>
          <label className="caption-field" htmlFor="photo-caption">
            <span><Pencil1Icon width="14" height="14" /> 사진 코멘트</span>
            <KeyboardTextarea
              id="photo-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value.slice(0, 80))}
              placeholder="한두 줄로 이 순간을 적어보세요."
              rows={2}
            />
            <small>{caption.length}/80</small>
          </label>
          <button className="primary-button viewer-save" type="button" onClick={() => onSave(caption.trim())}>
            코멘트 저장
          </button>
        </div>
      ) : null}
    </BottomSheet>
  );
}

async function toPhotoRecord(file: File): Promise<PhotoRecord> {
  const capturedAt = (await readExifDate(file)) ?? new Date(file.lastModified || Date.now());
  const dataUrl = await resizeImage(file);
  return {
    id: `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    dataUrl,
    capturedAt: capturedAt.toISOString(),
    caption: "",
  };
}

async function resizeImage(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxSide = 1100;
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.82);
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
        if (
          view.getUint8(payload) === 0x45 &&
          view.getUint8(payload + 1) === 0x78 &&
          view.getUint8(payload + 2) === 0x69 &&
          view.getUint8(payload + 3) === 0x66
        ) {
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
      const type = uint16(entry + 2);
      const itemCount = uint32(entry + 4);
      result.set(tag, {
        value: uint32(entry + 8),
        text: type === 2 ? readAscii(entry, itemCount) : "",
      });
    }
    return result;
  };

  const root = parseIfd(firstIfd, [0x0132, 0x8769]);
  const exifPointer = root.get(0x8769)?.value;
  const exif = exifPointer ? parseIfd(tiffStart + exifPointer, [0x9003, 0x9004]) : new Map();
  const raw = exif.get(0x9003)?.text || exif.get(0x9004)?.text || root.get(0x0132)?.text;
  if (!raw) return null;

  const match = raw.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function Prototype() {
  return (
    <TravelStore>
      <FlowStack initial={homeScreen()} />
    </TravelStore>
  );
}
