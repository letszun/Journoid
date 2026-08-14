# Journoid App Guide

## Product Direction

- The visual direction is a quiet, whitespace-heavy, monochrome mobile photo journal with loose physical polaroids, restrained typography, and date-led photo groups.
- The app must begin with an empty travel collection. Never hardcode a sample trip title such as `8월의 충칭` as the user's trip.
- The user creates a trip by entering a country, city, and start/end dates. Both the home list and the new/edit trip form derive their title in the form `{month}월의 {city}`. The trip page keeps the city as its heading and places the country beside the date range.
- Imported photos should be selected in batches and grouped by captured date and time of day.
- A 2D polaroid never shows capture time, placeholder copy, or comments on its frame. Saved comments appear below the polaroid in small dark gray text.
- Tapping a 2D polaroid opens a full-screen white 3D model. Tapping the model opens photo doodling and short-comment editing.
- Use only Helvetica/Pretendard-style sans-serif typography and a neutral black, white, and gray palette. Do not use orange accent colors or decorative serif fonts.
- Do not display the provided reference image or other copied reference imagery in the product.
- The current visual language is monochrome editorial: oversized numerals and Korean display type, deconstructed alignment, hard rules, square controls, and staggered photo grids. Avoid generic rounded cards and soft lifestyle-app styling.
- Photo windows and their surrounding polaroid frames follow each source image's aspect ratio across home previews, the 2D gallery, the 3D model, and the doodle editor. Persist detected ratios per photo and lazily backfill older saved photos without requiring re-import.
- Batch imports must stay responsive beyond five files: process at most two images concurrently, append completed batches immediately, encode asynchronously, yield between batches, and debounce persistent serialization.
- The gallery is photo-first and grid-aligned: use a 4px base unit, 16px mobile gutters, 40px primary controls, 18px line icons, and 1px neutral rules. Do not use drop shadows, random rotations, staggered rows, or oversized date typography around the polaroids.
- Use deliberate Helvetica/Pretendard typography: display tracking around `-0.055em`, body tracking around `-0.012em`, compact display leading around `0.94`, and readable body leading around `1.45–1.5`. Align labels, counts, and titles to shared left and baseline anchors.
- The doodle editor supports 1×–3× zoom, two-finger pinch, and panning with the move tool. Frame color changes are saved per photo; the default UI stays monochrome while a custom color picker remains available.
- The doodle editor offers a crisp pressure-aware pen, textured pencil, and translucent highlighter. Every brush supports preset and custom colors without changing the app's neutral interface palette.
- Saved comments appear centered near the top of the full-screen 3D model view. The model uses front, back, and all four edge planes so its surface remains visible through every allowed rotation angle.
- Preserve EXIF GPS coordinates when importing supported photos. In the 3D model view, show the coordinate label first in pale gray at the existing centered note position, with any saved comment directly below it. Photos without embedded GPS stay visually unchanged.
- Batch photo imports use a dedicated full-screen progress view. Keep the underlying gallery out of sight until the responsive two-file batch pipeline has finished.
- Persist the full journal, including image and drawing data, in the `journoid` IndexedDB database. Keep `journoid.storage` as the permanent unversioned local-storage pointer, automatically migrate `journoid-trips-v2` and `journey-polaroid-trips-v1`, and use `journoid.trips` only as a fallback when IndexedDB is unavailable.
- Keep drawing input low-latency: never synchronously encode PNG data at pointer-down, collect coalesced pointer samples, smooth pressure, render the active stroke on a separate canvas, and composite translucent marker strokes only once so segment joins do not form dark dots.
- Keep the home collection free of redundant masthead copy such as `여행`; the first journal row begins directly below the compact app header with no reserved spacer or duplicate rule.
- Keep trip galleries airy and compact: use three small 2D polaroids per mobile row, four on wider screens, a thin 4px frame inset, at least 12px horizontal separation, and 32px row spacing.
- Home journey rows use restrained 20–30px titles and compact 52px photo previews; they should read as an index rather than a second gallery.
- Inside a trip, show the city without a redundant `{month}월의` eyebrow. Date group headers show only the zero-padded day and weekday, never the month already present in the trip range.
- Trip country, city, start date, and end date remain editable from the trip's three-dot menu without replacing its photos or other saved content.
- Group photos in this display order and at these exact boundaries: 아침 05:00–11:29, 점심 11:30–14:29, 오후 14:30–17:29, 저녁 17:30–21:29, 밤 21:30–01:59, 새벽 02:00–04:59.
- Put the current semantic `APP_VERSION` inside the three-dot settings menu instead of displaying it in headers. Increment it for each published update and record user-visible changes in `CHANGELOG.md` so a home-screen installation can be checked against the latest deployment.
- Offer a persistent monochrome dark theme from the three-dot settings menu and store the preference at the stable `journoid.theme` local-storage key.
- Photo deletion belongs in the full-screen photo detail menu and must require an explicit confirmation before removing the IndexedDB-backed record.

## Current Runtime Override

- The user explicitly requested a standalone installable web app with no simulated iPhone/Pixel frame, device picker, status bar, or keyboard chrome.
- `src/App.tsx` mounts the app directly. The legacy mobile runtime remains in the repository only for its existing fixture tests and is not part of the product UI.
- Preserve the PWA manifest, safe-area padding, and `viewport-fit=cover` behavior so the GitHub Pages URL works cleanly when added to a phone home screen.

## Prototype Instructions

In ChatGPT Work Mode, run `sites-preview start "$PWD"`, open `http://terminal.local:4173/` in the cloud browser, and verify the rendered app and its primary interactions. Keep that preview open and tell the user to inspect it in the cloud browser; do not present the local URL as a user-facing chat link. In Codex Desktop, run the local server yourself, open the preview in the in-app browser, and provide the clickable local URL. Do not deploy to Sites unless the user explicitly asks to share, publish, or deploy. Do not give the user server-start instructions when you can run it.

Before planning or implementing any mobile-app change, read this `AGENTS.md` in full. It is the source of truth for the template's runtime and component guidance.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Editing Boundary

- Build app-specific UI in `src/Prototype.tsx` and `src/prototype.css`.
- Treat `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/mobile/`, `public/assets/iphone/`, `public/assets/android/`, `public/assets/status/`, `vite.config.ts`, `worker/index.js`, and `scripts/prepare-sites-build.mjs` as protected runtime files. Do not edit, replace, remove, or recreate them unless the user explicitly asks to change the mobile runtime itself. For an explicit runtime change, update the affected lock hashes only after verifying the new runtime behavior.
- Run `npm run check:runtime` before preview or handoff. If it fails, restore the protected runtime instead of weakening or bypassing the check.
- `npm run build` preserves the mobile runtime and prepares the static Cloudflare Worker output required by Sites. Before a Sites handoff, confirm `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and source `.openai/hosting.json` exist, then run `npm run test:sites`. Do not replace this project with a Vinext starter.

## Legacy Runtime Contract

The following contract applies only to files under `src/mobile/` and their fixture tests. It no longer describes the Journoid product shell.

- Preserve the mobile device runtime unless the user's task explicitly asks otherwise. Do not replace it with a standalone page. Visual fidelity applies to app-owned content inside the device screen, not to template-owned device chrome.
- Keep `App` composed around `PhoneFrame` -> `KeyboardProvider`, with `StatusBar`, app content, `HomeIndicator`, and `KeyboardDock` mounted inside the phone frame. `StatusBar` and the iOS home indicator are overlaid device chrome. When the Android keyboard is closed, the app viewport reserves the protected navigation-bar region instead of painting behind it. When the Android keyboard is open, preserve the current full-screen keyboard layout: its asset includes the IME navigation strip and the separate black navigation bar is hidden. iOS screens continue to paint behind the home-indicator area and own their safe-area content padding.
- Preserve the `iPhone` / `Pixel 10` device picker and both calibrated device presets. The Pixel screen is `427 x 952`; its `32 x 32` camera circle and `public/assets/android/navigation-bar.svg` bottom navigation bar are protected device chrome, not app content.
- Preserve the device picker's intentionally lightweight Codex styling in the top-right corner: its trigger wrapper is borderless and transparent, its trigger sizes to content, and its right-aligned menu uses the compact 3px inset plus the specified hairline and elevation shadow layers. Keep the prototype root and default app screen white.
- Preserve `StatusBar` as live device chrome, including its platform-specific typography, source status-icon assets, and spacing. Pixel 10 uses Roboto, Android indicators, and 32px top, left, and right padding. iPhone uses its iOS indicators, system typography, and calibrated spacing. Do not hardcode screenshot times like `9:41` into the status bar, replace its real-time clock, or move status bar content into app markup unless the user explicitly asks for a fixed/mock device time.
- `PhoneFrame` owns the calibrated device frame, screen portal, device picker, camera cutout, and custom cursor. Keep device assets in `public/assets/iphone/` and `public/assets/android/`; if an asset fails to load, repair the asset path or restore the asset instead of removing the frame, keyboard, or image render.
- Use `MobileScroll` directly for simple single-screen prototypes. Use `FlowStack` for conventional multi-screen flows whose routes can own their fixed header and footer; when using it, define each route as a `FlowScreen`: `{ id, header?, headerHeight?, footer?, footerHeight?, render }`, and use `flow.push(screen)`, `flow.pop()`, and `flow.replace(screen)` from `FlowStack` render callbacks or `useFlow()` instead of introducing another router.
- Use `Carousel` for a carousel, horizontal rail, swipeable cards, image or media strip, horizontally scrollable cards, chip rail, or other horizontal collection.
- For a layered app shell—such as a persistent composer, independently presented sheet, pushed/peek sidebar, or app-wide transition—compose directly in `Prototype.tsx` rather than forcing it through `FlowStack`. Keep app-owned fixed chrome as sibling layers outside `MobileScroll`.
- When using `FlowScreen`, put route-owned fixed headers or footers in `FlowScreen.header` or `FlowScreen.footer`. Set `headerHeight` to the visible app-toolbar height; `FlowStack` adds the device's top safe-area/status-bar inset automatically. Do not include `StatusBar` or its height in the header. Set `footerHeight` to the full app-footer height. `FlowScreen.footer` is an overlay, not reserved layout space; screens using it must add their own bottom content padding such as `padding-bottom: calc(var(--flow-footer-height) + var(--mobile-safe-area-height) + 24px)` so final content can scroll above the footer while still painting behind it.
- Render only scrollable content inside `MobileScroll`; it is for content that should move with scroll and rubber-band overscroll. Keep app-owned headers, nav bars, tabs, composers, and overlays outside it. This keeps scroll physics, safe areas, keyboard insets, scrollbars, and drag click suppression active without letting content paint under fixed chrome.
- Buttons, links, cards, and images inside `MobileScroll` should still allow drag scrolling when the pointer moves beyond tap slop. Use `data-scroll-drag="ignore"` only for rare controls that must own the drag gesture themselves.
- Do not add `var(--keyboard-height)` to ordinary screen/content padding inside `MobileScroll`; the scroll viewport already shrinks above the simulated keyboard. For custom fixed composers, search bars, or toast chrome, use `useKeyboardInsets().bottomInset`. It is relative to the app viewport: Android returns `0` while the closed-keyboard viewport already reserves navigation, then returns the keyboard height while open; iOS continues to clear the home indicator while closed and ride directly above the keyboard while open. Do not pin custom bottom chrome to `bottom: 0` or only `keyboardHeight`.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for every text-entry control. A raw `input` or `textarea` disconnects focus, keyboard animation, safe-area insets, and attached surfaces.
- Use `BottomSheet` for phone-scoped sheets. Its props are `open`, `onOpenChange`, `title`, optional `description`, optional `snap`, and `children`; it renders through the phone screen portal and dismisses the keyboard before opening.

## Horizontal Carousels

- Use `Carousel` for horizontally draggable cards, images, media, chips, or other horizontal collections. Do not recreate these with `overflow-x`, custom pointer handlers, or a generic div.
- `Carousel` can be nested directly inside `MobileScroll`. It owns horizontal gestures and automatically yields vertical gestures to the parent.
- Never put `data-scroll-drag="ignore"` on or around a `Carousel`; doing so prevents vertical parent scrolling when a gesture begins inside it.
- Do not add CSS scroll snapping to `Carousel`; its runtime owns momentum and release motion.
- Use `data-scroll-drag="ignore"` only when a control must prevent parent scrolling in every drag direction.

See `src/mobile/COMPONENTS.md` for the full component and gesture contract.

## Keyboard Rule

The simulated keyboard is a separate top-layer component. Before presenting anything that behaves like iOS navigation or modal UI, dismiss it first.

Call `keyboard.hide()` before:

- pushing, popping, or replacing FlowStack routes
- opening bottom sheets, action sheets, dialogs, menus, or navigation sheets
- starting transitions where the destination should not inherit text-input focus

`FlowStack` already hides the keyboard for `push`, `pop`, and `replace`. `BottomSheet` already hides it before opening. If you add new modal/sheet/navigation primitives, follow the same rule.

When a composer, search surface, or other keyboard-attached component closes, call `keyboard.hide()` in the same event before changing that component's open state. Position attached surfaces from `useKeyboardInsets()` rather than a separate timer or visibility flag so both dismiss together.

When any text-entry control loses focus, dismiss the simulated keyboard. If the control is custom or does not use the runtime's keyboard-aware fields, handle its blur event and call `keyboard.hide()` explicitly. Keep the keyboard open only when focus is moving directly to another text-entry control that should share the same keyboard session.

## Interaction Rules

- Do not trigger buttons or inputs after a pointer has become a drag. Preserve the drag suppression behavior in `MobileScroll`.
- Do not allow native browser image/file dragging inside the phone frame. Preserve the phone-level `dragstart` suppression and non-draggable image styles so scroll drags that begin on images still scroll the prototype.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for text entry so the simulated keyboard and safe-area insets stay connected.
- Fixed phone chrome should not animate with pushed screens. Screen content can animate; the status bar, camera cutout, and preview chrome should stay put.
- Keep the keyboard below the home indicator/safe area layer in z-index, and above ordinary app UI while visible.
- Keep the home indicator as the topmost safe-area layer in the z-index above everything else in the prototype.
