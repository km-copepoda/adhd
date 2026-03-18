// scripts/gen-icon.js
// パープルひびたまごアイコンをPNGとして生成（依存パッケージ不要）
'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─── CRC32 ────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = (c >>> 8) ^ CRC_TABLE[(c ^ b) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG writer ───────────────────────────────────────────
function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf  = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
function encodePNG(rgba, w, h) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8]=8; ihdr[9]=6; // 8-bit RGBA
  const raw = [];
  for (let y = 0; y < h; y++) {
    raw.push(0); // filter: None
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw.push(rgba[i], rgba[i+1], rgba[i+2], rgba[i+3]);
    }
  }
  const idat = zlib.deflateSync(Buffer.from(raw), { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// ─── Egg pixel art (32×32) ────────────────────────────────
const CX=15, CY=14, RX=11, RY_TOP=11, RY_BOT=12;
function computeEgg() {
  const rows = new Array(32).fill(null);
  for (let r = 0; r < 32; r++) {
    const dy = r - CY;
    const ry = dy <= 0 ? RY_TOP : RY_BOT;
    if (Math.abs(dy) >= ry) continue;
    const xh = Math.round(RX * Math.sqrt(Math.max(0, 1 - (dy/ry)**2)));
    if (xh > 0) rows[r] = [CX - xh, CX + xh];
  }
  return rows;
}
const EGG     = computeEgg();
const EGG_TOP = EGG.findIndex(r => r !== null);
const EGG_BOT = 31 - [...EGG].reverse().findIndex(r => r !== null);
const EGG_H   = EGG_BOT - EGG_TOP + 1;

// ─── Crack pixels (アニメ風放射ひびわれ) ─────────────────
const CRACK = new Set();
const cp = (r, c) => CRACK.add(`${r},${c}`);
cp(CY-8,CX+1);
cp(CY-7,CX); cp(CY-7,CX+2); cp(CY-7,CX+3);
cp(CY-6,CX); cp(CY-6,CX-1); cp(CY-6,CX+2); cp(CY-6,CX-3);
cp(CY-5,CX-1); cp(CY-5,CX); cp(CY-5,CX-2); cp(CY-5,CX-3);
cp(CY-4,CX-1); cp(CY-4,CX-2); cp(CY-4,CX-3); cp(CY-4,CX-4);
cp(CY-8,CX+4);
cp(CY-3,CX-1);
cp(CY-2,CX);
cp(CY-1,CX-1);
cp(CY,  CX-1); cp(CY,CX+1); cp(CY,CX+2);
cp(CY+1,CX); cp(CY+1,CX+3);
cp(CY+2,CX); cp(CY+2,CX+3); cp(CY+2,CX-1);
cp(CY+3,CX+1); cp(CY+3,CX-2);
cp(CY+4,CX+1);

function pixelType(row, col) {
  const r = EGG[row];
  if (!r) return 'bg';
  const [s, e] = r;
  if (col < s || col > e) return 'bg';
  if (col === s || col === e) return 'border';
  if (CRACK.has(`${row},${col}`)) return 'crack';
  const inner = col - s - 1;
  const span  = Math.max(1, e - s - 1);
  const xR    = inner / span;
  const yR    = (row - EGG_TOP) / Math.max(1, EGG_H - 1);
  if (row <= EGG_TOP + 3 && inner <= 1) return 'hl';
  const shade = xR * 0.55 + yR * 0.45;
  if (shade < 0.20) return 'light';
  if (shade < 0.48) return 'fill';
  if (shade < 0.72) return 'dark';
  return 'shadow';
}

// ─── Purple palette (RGBA) ────────────────────────────────
const PAL = {
  bg:     [15,  15,  35,  255],
  border: [0,   0,   0,   255],
  hl:     [243, 232, 255, 255],
  light:  [192, 132, 252, 255],
  fill:   [124, 58,  237, 255],
  dark:   [76,  29,  149, 255],
  shadow: [32,  0,   96,  255],
  crack:  [0,   0,   0,   255],
};

function drawBase32() {
  const buf = new Uint8Array(32 * 32 * 4);
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 32; col++) {
      const c = PAL[pixelType(row, col)];
      const i = (row * 32 + col) * 4;
      buf[i]=c[0]; buf[i+1]=c[1]; buf[i+2]=c[2]; buf[i+3]=c[3];
    }
  }
  return buf;
}

function scale(src, srcW, srcH, factor) {
  const dstW = srcW * factor, dstH = srcH * factor;
  const dst = new Uint8Array(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const si = (Math.floor(y/factor) * srcW + Math.floor(x/factor)) * 4;
      const di = (y * dstW + x) * 4;
      dst[di]=src[si]; dst[di+1]=src[si+1]; dst[di+2]=src[si+2]; dst[di+3]=src[si+3];
    }
  }
  return { buf: dst, w: dstW, h: dstH };
}

// ─── ICO writer (32×32 BGRA bitmap inside ICO) ───────────
function encodeICO(rgba32) {
  // BITMAPINFOHEADER (40 bytes): height=64 for XOR+AND masks
  const bih = Buffer.alloc(40);
  bih.writeUInt32LE(40, 0);   // biSize
  bih.writeInt32LE(32, 4);    // biWidth
  bih.writeInt32LE(64, 8);    // biHeight (doubled)
  bih.writeUInt16LE(1, 12);   // biPlanes
  bih.writeUInt16LE(32, 14);  // biBitCount
  // XOR mask: 32×32 BGRA (bottom-up)
  const xor = Buffer.alloc(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const src = ((31 - y) * 32 + x) * 4; // flip vertical
      const dst = (y * 32 + x) * 4;
      xor[dst+0] = rgba32[src+2]; // B
      xor[dst+1] = rgba32[src+1]; // G
      xor[dst+2] = rgba32[src+0]; // R
      xor[dst+3] = rgba32[src+3]; // A
    }
  }
  // AND mask: all zeros (use alpha channel for transparency)
  const andMask = Buffer.alloc(32 * 4);
  const imgData = Buffer.concat([bih, xor, andMask]);
  const imgSize = imgData.length; // 40 + 4096 + 128 = 4264

  // ICO header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1=icon
  header.writeUInt16LE(1, 4); // count: 1 image

  // Directory entry (16 bytes)
  const dir = Buffer.alloc(16);
  dir[0] = 32;  // width
  dir[1] = 32;  // height
  dir[2] = 0;   // colorCount
  dir[3] = 0;   // reserved
  dir.writeUInt16LE(1, 4);        // planes
  dir.writeUInt16LE(32, 6);       // bitCount
  dir.writeUInt32LE(imgSize, 8);  // bytesInRes
  dir.writeUInt32LE(22, 12);      // imageOffset = 6 + 16

  return Buffer.concat([header, dir, imgData]);
}

// ─── Generate ─────────────────────────────────────────────
const base = drawBase32();
const pub  = path.join(__dirname, '..', 'public');
const app  = path.join(__dirname, '..', 'src', 'app');

// 192×192 (6×)
const img192 = scale(base, 32, 32, 6);
fs.writeFileSync(path.join(pub, 'icon-192.png'), encodePNG(img192.buf, img192.w, img192.h));
console.log('✓ public/icon-192.png (192×192)');

// 512×512 (16×)
const img512 = scale(base, 32, 32, 16);
fs.writeFileSync(path.join(pub, 'icon-512.png'), encodePNG(img512.buf, img512.w, img512.h));
console.log('✓ public/icon-512.png (512×512)');

// favicon.ico (32×32 ICO)
const ico = encodeICO(base);
fs.writeFileSync(path.join(app, 'favicon.ico'), ico);
console.log('✓ src/app/favicon.ico (32×32 ICO)');

// src/app/icon.png (Next.js App Router 用)
const img32 = scale(base, 32, 32, 1);
fs.writeFileSync(path.join(app, 'icon.png'), encodePNG(img32.buf, 32, 32));
console.log('✓ src/app/icon.png (32×32 PNG)');

console.log('\nDone!');
