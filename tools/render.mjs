/* HARTEMPORÁRIO — renderiza um recorte de um PNG como ASCII de luminância.
   Uso: node tools/render.mjs <png> <x0> <y0> <x1> <y1> [cols] [rows]        */
import zlib from "node:zlib";
import fs from "node:fs";

function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const off = y * stride, prevOff = off - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[off + x - channels] : 0;
      const b = y > 0 ? out[prevOff + x] : 0;
      const c = (y > 0 && x >= channels) ? out[prevOff + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      out[off + x] = v & 255;
    }
  }
  return { w, h, channels, data: out };
}

const [file, x0f, y0f, x1f, y1f, colsArg, rowsArg] = process.argv.slice(2);
const img = decodePNG(fs.readFileSync(file));
const cols = Number(colsArg || 128), rows = Number(rowsArg || 44);
const x0 = Math.floor(Number(x0f) * img.w), x1 = Math.floor(Number(x1f) * img.w);
const y0 = Math.floor(Number(y0f) * img.h), y1 = Math.floor(Number(y1f) * img.h);
const chars = " .:-=+*#%@";
const buckets = new Float64Array(cols * rows);
const counts = new Float64Array(cols * rows);
for (let y = y0; y < y1; y++) {
  const r = Math.min(rows - 1, Math.floor(((y - y0) / (y1 - y0)) * rows));
  for (let x = x0; x < x1; x++) {
    const c = Math.min(cols - 1, Math.floor(((x - x0) / (x1 - x0)) * cols));
    const i = (y * img.w + x) * img.channels;
    const l = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    const k = r * cols + c;
    buckets[k] += l; counts[k]++;
  }
}
let sum = 0, n = 0, min = 255, max = 0;
for (let r = 0; r < rows; r++) {
  let line = "";
  for (let c = 0; c < cols; c++) {
    const k = r * cols + c;
    const v = counts[k] ? buckets[k] / counts[k] : 0;
    sum += v; n++; if (v < min) min = v; if (v > max) max = v;
    line += chars[Math.min(9, Math.floor(v / 25.6))];
  }
  console.log(line);
}
console.log("[avg " + Math.round(sum / n) + " | min " + Math.round(min) + " | max " + Math.round(max) + "] " +
  file.split(/[\\/]/).pop() + " " + x0f + "," + y0f + " → " + x1f + "," + y1f);
