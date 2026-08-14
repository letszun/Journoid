# jours. — 여행 기록

도시와 여행 날짜를 직접 입력해 여행 기록을 만들고, 사진을 촬영 날짜와 시간대별로 정리하는 모바일 프로토타입입니다.

## 현재 구현

- 비어 있는 여행 목록에서 새 일정 추가
- 도시·출발일·도착일 입력
- 입력한 시작 월과 도시를 조합해 `{month}월의 {city}` 제목 생성
- 브라우저에 여행 목록 저장
- 갤러리 이미지 여러 장 불러오기
- JPEG EXIF 촬영 시각 우선 사용, 메타데이터가 없으면 파일 수정 시각 사용
- 날짜 및 새벽·아침·오후·저녁별 사진 분류
- 겹친 2D 폴라로이드 타임라인
- 드래그로 돌리는 3D 폴라로이드 앞·뒷면
- 사진마다 80자 이내 코멘트 저장

## 실행

Node.js가 설치된 환경에서 다음 명령을 실행합니다.

```bash
npm install
npm run dev
```

배포용 HTML·CSS·JavaScript를 만들려면 다음 명령을 실행합니다.

```bash
npm run build
```

## 주요 파일

- `src/Prototype.tsx`: 일정, 사진 분류, 3D 폴라로이드 동작
- `src/prototype.css`: 앱 화면 디자인
- `public/app-data.json`: 초기 데이터 구조
- `public/empty-polaroid-stack.png`: 빈 화면용 폴라로이드 이미지
- `dist/client/`: `npm run build` 실행 후 생성되는 HTML·CSS·JavaScript

사진은 모바일 브라우저 저장소에 보관되므로 대량 보관용 정식 버전에서는 IndexedDB 또는 별도 저장소로 교체하는 것을 권장합니다.
