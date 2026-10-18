/**
 * Dependency-free PWA icon generator.
 * Renders the MNM monogram ("M") on the brand background into PNG files under public/icons.
 * Re-run after changing BRAND/BG:  node scripts/generate-icons.mjs
 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'icons');

const BRAND = [166, 30, 87]; // #A61E57 rani-berry
const WHITE = [255, 255, 255];

/* ── tiny PNG encoder (truecolour + alpha) ── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ── drawing ── */
function canvas(size) {
  const buf = Buffer.alloc(size * size * 4);
  return {
    size,
    buf,
    set(x, y, [r, g, b], a = 255) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const i = (y * size + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    },
    fill(color) {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) this.set(x, y, color);
    },
    square(cx, cy, half, color) {
      for (let y = cy - half; y <= cy + half; y++) for (let x = cx - half; x <= cx + half; x++) this.set(x, y, color);
    },
    line(x0, y0, x1, y1, w, color) {
      // Bresenham with a square brush of radius ~w/2.
      const half = Math.floor(w / 2);
      let dx = Math.abs(x1 - x0);
      let dy = -Math.abs(y1 - y0);
      let sx = x0 < x1 ? 1 : -1;
      let sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      let x = x0;
      let y = y0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        this.square(x, y, half, color);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y += sy;
        }
      }
    },
  };
}

function drawM(c, pad) {
  const s = c.size;
  const inner = s - pad * 2;
  const stroke = Math.round(inner * 0.16);
  const top = pad + Math.round(inner * 0.2);
  const bottom = pad + Math.round(inner * 0.82);
  const leftX = pad + Math.round(inner * 0.16);
  const rightX = pad + inner - Math.round(inner * 0.16);
  const midX = Math.round(s / 2);
  const midY = pad + Math.round(inner * 0.6);
  // Left & right legs
  c.line(leftX, top, leftX, bottom, stroke, WHITE);
  c.line(rightX, top, rightX, bottom, stroke, WHITE);
  // The V in the middle
  c.line(leftX, top, midX, midY, stroke, WHITE);
  c.line(rightX, top, midX, midY, stroke, WHITE);
}

function makeIcon(size, { maskable = false } = {}) {
  const c = canvas(size);
  c.fill(BRAND);
  // Maskable icons need the mark inside the ~80% safe area.
  const pad = Math.round(size * (maskable ? 0.2 : 0.12));
  drawM(c, pad);
  return encodePng(size, size, c.buf);
}

fs.mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', makeIcon(192)],
  ['icon-512.png', makeIcon(512)],
  ['maskable-512.png', makeIcon(512, { maskable: true })],
  ['apple-touch-icon-180.png', makeIcon(180)],
  ['favicon-64.png', makeIcon(64)],
];
for (const [name, data] of files) {
  fs.writeFileSync(path.join(OUT, name), data);
  console.log(`✓ ${name} (${data.length} bytes)`);
}
console.log(`Icons written to ${OUT}`);
