// Generates build/icon.png (256x256) and build/icon.ico: the amber shelf mark on a warm near-black rounded square
// (the same mark as the website favicon, docs/site/img/icon.svg).
// Pure Node rasterizer (4x4 supersampling) + png-to-ico.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', 'build');
fs.mkdirSync(out, { recursive: true });

function render(N) {
  const S = 4; // supersampling
  const px = new Float32Array(N * N * 4);
  const u = N / 32; // design grid is 32x32 (same as the in-app logo)
  // shape list: [x, y, w, h, r, color[r,g,b,a], rotateDeg?] — icon.svg's bars, mapped through translate(4 4) scale(.75)
  const amber = (a) => [242, 177, 76, a];
  const shapes = [
    [6.25, 7.75, 3.75, 15, 0.9, amber(0.55)],
    [11.125, 6.25, 3.75, 16.5, 0.9, amber(0.8)],
    [16, 8.5, 3.75, 14.25, 0.9, amber(1)],
    [20.95, 7.375, 3.75, 15.375, 0.9, amber(0.7), 8],
    [5.5, 23.5, 21, 2.25, 0.9, amber(1)],
  ];
  const inRRect = (x, y, rx, ry, w, h, r) => {
    const cx = Math.min(Math.max(x, rx + r), rx + w - r);
    const cy = Math.min(Math.max(y, ry + r), ry + h - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= rx && x <= rx + w && y >= ry && y <= ry + h;
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let acc = [0, 0, 0, 0];
    for (let sj = 0; sj < S; sj++) for (let si = 0; si < S; si++) {
      const gx = (i + (si + 0.5) / S) / u, gy = (j + (sj + 0.5) / S) / u;
      let c = [0, 0, 0, 0];
      if (inRRect(gx, gy, 0, 0, 32, 32, 7)) {
        c = [21, 18, 14, 1]; // #15120e
        // a faint warm lift toward the top, like light on a shelf
        const hl = Math.max(0, 1 - gy / 20) * 0.05;
        c = [c[0] + (242 - c[0]) * hl, c[1] + (177 - c[1]) * hl, c[2] + (76 - c[2]) * hl, 1];
        for (const [x, y, w, h, r, col, rot] of shapes) {
          let qx = gx, qy = gy;
          if (rot) {
            const cx = x + w / 2, cy = y + h / 2, a = (-rot * Math.PI) / 180;
            const dx = gx - cx, dy = gy - cy;
            qx = cx + dx * Math.cos(a) - dy * Math.sin(a);
            qy = cy + dx * Math.sin(a) + dy * Math.cos(a);
          }
          if (inRRect(qx, qy, x, y, w, h, r)) {
            const a = col[3];
            c = [c[0] * (1 - a) + col[0] * a, c[1] * (1 - a) + col[1] * a, c[2] * (1 - a) + col[2] * a, 1];
          }
        }
      }
      acc = [acc[0] + c[0] * c[3], acc[1] + c[1] * c[3], acc[2] + c[2] * c[3], acc[3] + c[3]];
    }
    const k = (j * N + i) * 4, n = S * S;
    const a = acc[3] / n;
    px[k] = a ? acc[0] / acc[3] : 0; px[k + 1] = a ? acc[1] / acc[3] : 0; px[k + 2] = a ? acc[2] / acc[3] : 0; px[k + 3] = a * 255;
  }
  return px;
}

function png(N, px) {
  const raw = Buffer.alloc(N * (N * 4 + 1));
  for (let j = 0; j < N; j++) {
    raw[j * (N * 4 + 1)] = 0;
    for (let i = 0; i < N * 4; i++) raw[j * (N * 4 + 1) + 1 + i] = Math.round(Math.max(0, Math.min(255, px[j * N * 4 + i])));
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const sizes = [256, 128, 64, 48, 32, 16];
const pngs = sizes.map((n) => png(n, render(n)));
fs.writeFileSync(path.join(out, 'icon.png'), pngs[0]);
fs.writeFileSync(path.join(out, 'icon.ico'), await pngToIco(pngs));
console.log('wrote build/icon.png and build/icon.ico');
