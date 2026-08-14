import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { parseExifTiff } = await server.ssrLoadModule("/src/Prototype.tsx");
  const buffer = new ArrayBuffer(256);
  const view = new DataView(buffer);
  const writeEntry = (offset, tag, type, count, value) => {
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, count, true);
    view.setUint32(offset + 8, value, true);
  };
  const writeRationals = (offset, values) => {
    values.forEach(([numerator, denominator], index) => {
      view.setUint32(offset + index * 8, numerator, true);
      view.setUint32(offset + index * 8 + 4, denominator, true);
    });
  };

  view.setUint8(0, 0x49);
  view.setUint8(1, 0x49);
  view.setUint16(2, 0x002a, true);
  view.setUint32(4, 8, true);

  view.setUint16(8, 2, true);
  writeEntry(10, 0x8769, 4, 1, 64);
  writeEntry(22, 0x8825, 4, 1, 104);

  view.setUint16(64, 1, true);
  writeEntry(66, 0x9003, 2, 20, 84);
  new TextEncoder().encodeInto("2026:08:14 12:34:56\0", new Uint8Array(buffer, 84, 20));

  view.setUint16(104, 4, true);
  writeEntry(106, 0x0001, 2, 2, 0);
  view.setUint8(114, 0x4e);
  writeEntry(118, 0x0002, 5, 3, 160);
  writeEntry(130, 0x0003, 2, 2, 0);
  view.setUint8(138, 0x45);
  writeEntry(142, 0x0004, 5, 3, 184);
  writeRationals(160, [[48, 1], [12, 1], [30, 1]]);
  writeRationals(184, [[16, 1], [22, 1], [25, 1]]);

  const metadata = parseExifTiff(view, 0);
  assert.equal(metadata.capturedAt?.getFullYear(), 2026);
  assert.equal(metadata.capturedAt?.getMonth(), 7);
  assert.ok(metadata.location);
  assert.ok(Math.abs(metadata.location.latitude - 48.2083333333) < 0.000001);
  assert.ok(Math.abs(metadata.location.longitude - 16.3736111111) < 0.000001);
  assert.equal(metadata.location.source, "exif");
  process.stdout.write("EXIF date and GPS metadata check passed.\n");
} finally {
  await server.close();
}
