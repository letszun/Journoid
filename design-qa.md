# Design QA

## Comparison Target

- Source visual direction:
  - `https://www.behance.net/gallery/74387467/Mathieu-Levesque-Website` — deconstructed monochrome grid, oversized animated typography, image-first presentation.
  - `https://www.peopleofdesign.ru/ru/2025/03/six-made-by-six/` — *Our Time* mobile photography archive, numeric navigation, black-and-white editorial hierarchy.
  - `https://www.behance.net/gallery/166284193/Instax-Printer-App-Redesign` — image-first mobile photo workflow and restrained controls.
- Implementation: `https://letszun.github.io/Journoid/` at commit `49a16cd5cf50e0dd12d47e274a1f51882434c5db`.
- Implementation screenshot evidence: browser-emitted content-only captures of the public home and trip-detail screens. The browser share volume was read-only, so the inspected screenshot bytes could not be persisted to a filesystem path.
- Capture size: `680 × 936` pixels for the centered app content, matching `680 × 936` CSS pixels at browser density `1`.
- States: home with one journey; trip detail with dated photo group; 3D viewer; doodle/comment editor; seven-file batch import.

## Full-view Comparison Evidence

- The home capture uses a large Korean display heading, strict black rules, vertical index, small numeric metadata, and an asymmetrical stacked `3:4` preview.
- The trip capture uses an oversized city name and day number, compact month/weekday metadata, black time-of-day label, and staggered portrait polaroids.
- The overall hierarchy matches the selected references' editorial traits without copying their imagery or branded components.

## Focused Region Comparison Evidence

- Polaroid image windows report computed CSS `aspect-ratio: 3 / 4` in the list and editor.
- The 3D model uses the same portrait photo window with a taller physical frame and blank lower border.
- Controls use square black rules and Radix icons; no color accent, gradient, rounded card system, copied reference imagery, or decorative serif remains.

## Required Fidelity Surfaces

- Fonts and typography: Helvetica/Pretendard-style sans serif only. Large display weights use `800` with tight negative tracking; metadata uses compact `9–11px` weights with tabular numerals. No actionable wrapping or truncation issue was visible.
- Spacing and layout rhythm: hard horizontal rules, oversized type, staggered photo rows, and deliberately uneven whitespace create the intended deconstructed grid. Persistent controls remained visible.
- Colors and visual tokens: UI uses black, white, and neutral gray only. Imported photos retain their original color by design.
- Image quality and asset fidelity: photo windows use `object-fit: cover` at `3:4`; async JPEG encoding is `0.74` quality with a `900px` long edge. No placeholder or reference image ships in the UI.
- Copy and content: only journey title, date range, date grouping, period label, saved comments, and essential actions are visible.

## Functional Verification

- Created and opened an existing journey.
- Selected seven files in one chooser; multiple selection was reported as supported.
- Completed images appeared incrementally in two-file batches; synthetic `900 × 1200` fixtures produced the first visible batch in `35ms` and all seven in `92ms` in the verification browser. These timings validate the progressive path but are not camera-photo benchmarks.
- Opened a portrait polaroid, entered the full-screen 3D viewer, and opened the doodle/comment editor.
- Checked public-page console warnings and errors: none from `letszun.github.io/Journoid`.
- GitHub Pages build for the implementation commit completed successfully.

## Findings

- No actionable P0, P1, or P2 issue remained in the inspected states.
- [P3] Real multi-megabyte HEIC/JPEG imports will remain device-dependent even with batched async encoding; a future IndexedDB/blob pipeline could improve very large archives.

## Comparison History

- Pass 1: the first rendered comparison found no actionable P0/P1/P2 mismatch against the selected editorial direction, so no visual fix loop was required.

## Implementation Checklist

- [x] Monochrome editorial hierarchy
- [x] Deconstructed, staggered photo grid
- [x] `3:4` portrait photo windows across all surfaces
- [x] Responsive seven-file progressive import
- [x] Full-screen 3D and editor flow preserved
- [x] Public console and Pages deployment verified

final result: passed
