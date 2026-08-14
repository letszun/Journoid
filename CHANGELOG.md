# Journoid changelog

## 0.8.0 — 2026-08-14

- Added private, on-device extraction of embedded EXIF GPS coordinates during photo import.
- Placed the saved location in pale gray above the photo comment in the full-screen 3D model view.
- Kept photos without GPS metadata unchanged and preserved location data in the existing IndexedDB journal record.

## 0.7.1 — 2026-08-14

- Changed both home-list and trip-form titles back to the `{month}월의 {city}` format.
- Kept country names in trip input and beside the date range on the individual trip page.

## 0.7.0 — 2026-08-14

- Made every 2D, preview, 3D, and doodle polaroid frame follow its source photo's aspect ratio.
- Added country names to trip details and changed home titles to the `{month}월의 {country}` format.
- Added editing for a trip's country, city, start date, and end date from the three-dot menu.
- Made batch imports skip unreadable image formats instead of stopping the entire selection.

## 0.6.0 — 2026-08-14

- Added wider spacing and slightly smaller frames to the 2D polaroid gallery.
- Reduced home trip-title typography and photo-preview size.
- Removed repeated month labels from trip headings and date groups.
- Split captured photos into six precise time-of-day periods.

## 0.5.1 — 2026-08-14

- Removed the leftover spacer between the home header and the first trip.
- Reduced 2D polaroids to a compact three-column mobile gallery with thinner frames.

## 0.5.0 — 2026-08-14

- Moved the version label into a compact three-dot settings menu.
- Added a persistent monochrome dark theme.
- Added photo deletion with an explicit confirmation step in photo detail.
- Removed the redundant `여행` masthead so the journal list begins immediately.

## 0.4.0 — 2026-08-14

- Removed synchronous PNG encoding from the start of every brush stroke.
- Added coalesced pointer sampling and pressure smoothing for continuous pen input.
- Moved active strokes to a separate canvas so translucent marker joins stay even instead of forming dots.
- Added a visible version mark to each app header.

## 0.3.0 — 2026-08-14

- Moved full journal data to IndexedDB with a permanent `journoid.storage` pointer.
- Added automatic migration from the previous local-storage keys.

## 0.2.0 — 2026-08-14

- Added pen, textured pencil, translucent marker, and brush color controls.
- Added the full-screen batch import progress view.
- Added centered model comments and complete 3D edge geometry.

## 0.1.0 — 2026-08-14

- Added editable trips, multi-photo import, date and time grouping, 3:4 polaroids, 3D viewing, doodling, comments, zoom, and frame colors.
