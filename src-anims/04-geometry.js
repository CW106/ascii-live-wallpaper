// 幾何模組（ge-）：demoscene 特效與數學幾何圖形。整個檔案包在函式裡，輔助常數不會和其他模組撞名。
(() => {
// ── 快速三角函數查表（每格大量呼叫時用） ──
const TS = 4096, TK = TS / TAU, SINT = new Float32Array(TS);
for (let i = 0; i < TS; i++) SINT[i] = Math.sin(i / TK);
const fsin = p => SINT[(p * TK) & 4095];
const fcos = p => SINT[(p * TK + 1024) & 4095];
// 快速 atan2（誤差約 1e-5 弧度）
const fatan2 = (y, x) => {
  const ax = Math.abs(x), ay = Math.abs(y), mx = ax > ay ? ax : ay, mn = ax > ay ? ay : ax;
  if (mx === 0) return 0;
  const a = mn / mx, q = a * a;
  let r = ((-0.0464964749 * q + 0.15931422) * q - 0.327622764) * q * a + a;
  if (ay > ax) r = 1.5707963 - r;
  if (x < 0) r = 3.1415927 - r;
  return y < 0 ? -r : r;
};
// ── 字元階梯 ──
const RS = ' .,:;-=+*#%@';          // 12 階（含空白）
const RL = '.,-~:;=!*#$@';          // 12 階打光用（不含空白）
const rc = (R, e) => R[e <= 0 ? 0 : e >= 1 ? R.length - 1 : (e * R.length) | 0];
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const hash2 = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
// 依切線方向（世界座標，y 向下）挑線條字元
const LINE_CH = ['-', '\\', '|', '/'];
const dirCh = (dx, dy) => { let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI; return LINE_CH[((a / Math.PI) * 4 + 0.5) & 3]; };

// ── 點字（braille）細點畫布：每格 2×4 個點，可以畫很細的線 ──
const BR = []; for (let b = 0; b < 256; b++) BR.push(String.fromCharCode(0x2800 + b));
const BBIT = [0x01, 0x08, 0x02, 0x10, 0x04, 0x20, 0x40, 0x80]; // 索引 = dy*2+dx
function Dots(cols, rows) {
  this.cols = cols; this.rows = rows; this.w = cols * 2; this.h = rows * 4;
  this.v = new Float32Array(this.w * this.h); this.hu = new Float32Array(this.w * this.h);
}
Dots.prototype.plot = function (x, y, a, h) {
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  const i = (y | 0) * this.w + (x | 0);
  this.v[i] += a; if (h !== undefined) this.hu[i] = h;
};
Dots.prototype.put = function (x, y, a, h) { // 取最大值（不累加）
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  const i = (y | 0) * this.w + (x | 0);
  if (a > this.v[i]) { this.v[i] = a; if (h !== undefined) this.hu[i] = h; }
};
Dots.prototype.line = function (x0, y0, x1, y1, a, h, mx) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
  if (n > 4000) return;
  for (let k = 0; k <= n; k++) { const u = k / n; if (mx) this.put(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, a, h); else this.plot(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, a, h); }
};
Dots.prototype.fade = function (k) { const v = this.v; for (let i = 0; i < v.length; i++) v[i] *= k; };
Dots.prototype.clear = function () { this.v.fill(0); };
// gain：亮度增益；thr：小於這個值的點不畫；H 為 null 時用 C 上色
Dots.prototype.render = function (g, C, H, gain, thr, lo) {
  const w = this.w, v = this.v, hu = this.hu, cols = this.cols, rows = this.rows, ch = g.ch, co = g.co;
  lo = lo === undefined ? 0.25 : lo;
  for (let cy = 0; cy < rows; cy++) {
    const r0 = cy * 4 * w;
    for (let cx = 0; cx < cols; cx++) {
      let bits = 0, mx = 0, hh = 0;
      const b0 = r0 + cx * 2;
      for (let k = 0; k < 8; k++) {
        const j = b0 + (k >> 1) * w + (k & 1), a = v[j];
        if (a > thr) { bits |= BBIT[k]; if (a > mx) { mx = a; hh = hu[j]; } }
      }
      if (!bits) continue;
      const i = cy * cols + cx, e = lo + (1 - lo) * (1 - Math.exp(-mx * gain));
      ch[i] = BR[bits]; co[i] = H ? H(hh, e) : C(e);
    }
  }
};

// ── 每格亮度畫布（粗筆、發光線） ──
function Glow(cols, rows) { this.cols = cols; this.rows = rows; this.v = new Float32Array(cols * rows); this.hu = new Float32Array(cols * rows); }
Glow.prototype.splat = function (x, y, a, h) { // 雙線性分配到四格，線條才會平順
  x -= 0.5; y -= 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, c = this.cols, r = this.rows, v = this.v;
  if (x0 < -1 || y0 < -1 || x0 >= c || y0 >= r) return;
  const put = (xx, yy, w) => { if (xx >= 0 && yy >= 0 && xx < c && yy < r && w > 0) { const i = yy * c + xx; v[i] += a * w; if (h !== undefined && w > 0.3) this.hu[i] = h; } };
  put(x0, y0, (1 - fx) * (1 - fy)); put(x0 + 1, y0, fx * (1 - fy)); put(x0, y0 + 1, (1 - fx) * fy); put(x0 + 1, y0 + 1, fx * fy);
};
Glow.prototype.fade = function (k) { const v = this.v; for (let i = 0; i < v.length; i++) v[i] *= k; };
Glow.prototype.render = function (g, C, H, gain, R, thr) {
  const v = this.v, hu = this.hu, ch = g.ch, co = g.co, n = v.length, L = R.length;
  for (let i = 0; i < n; i++) {
    const a = v[i];
    if (a <= thr) continue;
    const e = 1 - Math.exp(-a * gain);
    ch[i] = R[Math.min(L - 1, (e * L) | 0)]; co[i] = H ? H(hu[i], 0.15 + e * 0.85) : C(0.15 + e * 0.85);
  }
};

// ── 三角形光柵化（深度緩衝），多面體和曲面共用 ──
// P = [x, y, iz, a, u, v]，iz 越大越近；plot(i, a, u, v)
function raster(zb, cols, rows, P0, P1, P2, plot) {
  const x0 = P0[0], y0 = P0[1], x1 = P1[0], y1 = P1[1], x2 = P2[0], y2 = P2[1];
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(area) < 1e-6) return;
  if (Math.max(x0, x1, x2) < -1 || Math.min(x0, x1, x2) > cols + 1) return;
  const mny = Math.max(0, Math.ceil(Math.min(y0, y1, y2) - 0.5 - 1e-4)), mxy = Math.min(rows - 1, Math.floor(Math.max(y0, y1, y2) - 0.5 + 1e-4));
  if (mny > mxy) return;
  const ia = 1 / area, dw0 = (y1 - y2) * ia, dw1 = (y2 - y0) * ia;
  const z0 = P0[2], z1 = P1[2], z2 = P2[2], a0 = P0[3], a1 = P1[3], a2 = P2[3];
  const u0 = P0[4] || 0, u1 = P1[4] || 0, u2 = P2[4] || 0, v0 = P0[5] || 0, v1 = P1[5] || 0, v2 = P2[5] || 0;
  // 逐列算出三角形在這一列的左右邊界，只掃邊界內的格子
  for (let y = mny; y <= mxy; y++) {
    const py = y + 0.5;
    let xl = 1e9, xr = -1e9, q;
    if ((y0 <= py) !== (y1 <= py)) { q = x0 + ((py - y0) * (x1 - x0)) / (y1 - y0); if (q < xl) xl = q; if (q > xr) xr = q; }
    if ((y1 <= py) !== (y2 <= py)) { q = x1 + ((py - y1) * (x2 - x1)) / (y2 - y1); if (q < xl) xl = q; if (q > xr) xr = q; }
    if ((y2 <= py) !== (y0 <= py)) { q = x2 + ((py - y2) * (x0 - x2)) / (y0 - y2); if (q < xl) xl = q; if (q > xr) xr = q; }
    if (xl > xr) continue;
    const xa = Math.max(0, Math.ceil(xl - 0.5 - 1e-4)), xb = Math.min(cols - 1, Math.floor(xr - 0.5 + 1e-4));
    if (xa > xb) continue;
    const px = xa + 0.5;
    let w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * ia, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * ia;
    for (let x = xa, i = y * cols + xa; x <= xb; x++, i++, w0 += dw0, w1 += dw1) {
      const w2 = 1 - w0 - w1, iz = w0 * z0 + w1 * z1 + w2 * z2;
      if (iz <= zb[i]) continue;
      zb[i] = iz;
      plot(i, w0 * a0 + w1 * a1 + w2 * a2, w0 * u0 + w1 * u1 + w2 * u2, w0 * v0 + w1 * v1 + w2 * v2);
    }
  }
}
// 旋轉矩陣（依序繞 x、y、z 軸）
function rotM(ax, ay, az) {
  const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
  return [cb * cc, sa * sb * cc - ca * sc, ca * sb * cc + sa * sc, cb * sc, sa * sb * sc + ca * cc, ca * sb * sc - sa * cc, -sb, sa * cb, ca * cb];
}
// 每格的世界座標（以畫面中心為原點，y 已乘上字格高寬比）
function worldXY(s, f) {
  const { cols, rows, aspect } = f, n = cols * rows;
  if (!s.WX || s.WX.length !== n) { s.WX = new Float32Array(n); s.WY = new Float32Array(n); }
  for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) { s.WX[i] = x + 0.5 - cols / 2; s.WY[i] = (y + 0.5 - rows / 2) * aspect; }
  s.M = Math.min(cols, rows * aspect);
}
// 每格的極座標（r 以 M/2 為 1）
function polarRA(s, f) {
  worldXY(s, f);
  const n = f.cols * f.rows;
  if (!s.PR || s.PR.length !== n) { s.PR = new Float32Array(n); s.PA = new Float32Array(n); }
  const h = s.M / 2;
  for (let i = 0; i < n; i++) { s.PR[i] = Math.hypot(s.WX[i], s.WY[i]) / h; s.PA[i] = Math.atan2(s.WY[i], s.WX[i]); }
}

// ════════ 干涉波紋：多個波源、疊紋、都卜勒、相位陣列 ════════
A({ id: 'ge-wave', name: '干涉波紋', cat: '幾何', theme: 'ice', desc: '兩個漂移的波源交疊出干涉條紋',
  params: { mode: 'src', n: 2, waves: 9 },
  variants: [
    { id: 'phase', name: '三源相位', theme: 'neon', hue: true, desc: '三個波源，顏色代表波的相位', params: { mode: 'phase', n: 3, waves: 7 } },
    { id: 'moire', name: '疊紋圓環', theme: 'mono', desc: '兩組同心圓錯開疊出流動疊紋', params: { mode: 'moire' } },
    { id: 'grating', name: '線柵疊紋', theme: 'paper', desc: '兩片細線柵緩緩轉動錯開', params: { mode: 'grating' } },
    { id: 'spokes', name: '輻條疊紋', theme: 'amber', desc: '兩組放射線交錯出花瓣疊紋', params: { mode: 'spokes', spokes: 44 } },
    { id: 'doppler', name: '都卜勒', theme: 'ocean', desc: '移動的波源擠壓出前密後疏的波前', params: { mode: 'doppler' } },
    { id: 'array', name: '相位陣列', theme: 'matrix', desc: '一排波源合成左右掃描的波束', params: { mode: 'array', n: 9, waves: 10 } },
  ],
  init(s, f) {
    worldXY(s, f);
    const p = f.p, n = f.cols * f.rows;
    s.rings = []; s.emit = 0;
    if (p.mode === 'array') {
      const lam = s.M / p.waves, k = TAU / lam, by = (f.rows / 2) * f.aspect - 0.6 * f.aspect;
      s.ax = []; s.by = by;
      s.CS = new Float32Array(p.n * n); s.SN = new Float32Array(p.n * n); s.FA = new Float32Array(n);
      for (let j = 0; j < p.n; j++) {
        const ax = (j - (p.n - 1) / 2) * lam * 0.5; s.ax.push(ax);
        for (let i = 0; i < n; i++) { const d = Math.hypot(s.WX[i] - ax, s.WY[i] - by); s.CS[j * n + i] = Math.cos(k * d); s.SN[j * n + i] = Math.sin(k * d); }
      }
      for (let i = 0; i < n; i++) s.FA[i] = 1 / (1 + Math.hypot(s.WX[i], s.WY[i] - by) / (s.M * 1.1));
    }
  },
  frame(s, f) {
    const m = f.p.mode;
    if (m === 'src' || m === 'phase') this.wSrc(s, f);
    else if (m === 'doppler') this.wDoppler(s, f);
    else if (m === 'array') this.wArray(s, f);
    else this.wMoire(s, f);
  },
  wSrc(s, f) {
    const { g, cols, rows, aspect, t, C, H } = f, p = f.p, n = g.n, WX = s.WX, WY = s.WY, ch = g.ch, co = g.co;
    const k = (TAU * p.waves) / s.M, w = 2.4, ns = p.n, sx = [], sy = [];
    for (let j = 0; j < ns; j++) {
      const ph = j * 2.4;
      sx.push(cols * 0.3 * Math.sin(t * 0.17 * (1 + 0.29 * j) + ph));
      sy.push(rows * aspect * 0.3 * Math.cos(t * 0.13 * (1 + 0.37 * j) + ph * 1.3));
    }
    const fall = 1 / (s.M * 0.55);
    if (p.mode === 'src') {
      for (let i = 0; i < n; i++) {
        let v = 0, am = 0;
        for (let j = 0; j < ns; j++) { const dx = WX[i] - sx[j], dy = WY[i] - sy[j], d = Math.sqrt(dx * dx + dy * dy), a = 1 / (1 + d * fall); v += a * fcos(k * d - w * t); am += a; }
        const u = 0.5 + 0.5 * v / am, e = u * u;
        if (e < 0.04) continue;
        ch[i] = rc(RS, e); co[i] = C(0.12 + 0.88 * e);
      }
    } else {
      for (let i = 0; i < n; i++) {
        let re = 0, im = 0, am = 0;
        for (let j = 0; j < ns; j++) { const dx = WX[i] - sx[j], dy = WY[i] - sy[j], d = Math.sqrt(dx * dx + dy * dy), a = 1 / (1 + d * fall), ph = k * d - w * t; re += a * fcos(ph); im += a * fsin(ph); am += a; }
        const e = Math.sqrt(re * re + im * im) / am;
        if (e < 0.05) continue;
        ch[i] = rc(RS, e); co[i] = H(Math.atan2(im, re) * 57.2958 + 180, 0.2 + 0.8 * e);
      }
    }
    for (let j = 0; j < ns; j++) g.set(cols / 2 + sx[j], rows / 2 + sy[j] / aspect, '@', p.mode === 'phase' ? H(j * 120, 1) : C(1));
  },
  wMoire(s, f) {
    const { g, cols, rows, aspect, t, C } = f, p = f.p, n = g.n, WX = s.WX, WY = s.WY, ch = g.ch, co = g.co, ink = C(0.92);
    if (p.mode === 'moire') {
      const P = Math.max(2.6, s.M / 30), iP = 1 / P;
      const x1 = cols * 0.2 * Math.sin(t * 0.11), y1 = rows * aspect * 0.14 * Math.cos(t * 0.15);
      const x2 = -cols * 0.16 * Math.sin(t * 0.09 + 1), y2 = -rows * aspect * 0.12 * Math.cos(t * 0.13 + 2);
      for (let i = 0; i < n; i++) {
        const a = WX[i] - x1, b = WY[i] - y1, c = WX[i] - x2, d = WY[i] - y2;
        if ((((Math.sqrt(a * a + b * b) * iP) | 0) ^ ((Math.sqrt(c * c + d * d) * iP) | 0)) & 1) { ch[i] = '█'; co[i] = ink; }
      }
    } else if (p.mode === 'grating') {
      const P = Math.max(2.4, s.M / 42), a1 = t * 0.045, a2 = a1 + 0.07 + 0.05 * Math.sin(t * 0.23), P2 = P * (1 + 0.06 * Math.sin(t * 0.17));
      const c1 = Math.cos(a1) / P, s1 = Math.sin(a1) / P, c2 = Math.cos(a2) / P2, s2 = Math.sin(a2) / P2;
      const ox = t * 0.6, edge = C(0.45);
      for (let i = 0; i < n; i++) {
        const p1 = WX[i] * c1 + WY[i] * s1 + ox, p2 = WX[i] * c2 + WY[i] * s2;
        const f1 = p1 - Math.floor(p1), f2 = p2 - Math.floor(p2);
        if ((Math.floor(p1) + Math.floor(p2)) & 1) { ch[i] = '█'; co[i] = ink; }
        else if (f1 < 0.15 || f2 < 0.15) { ch[i] = '·'; co[i] = edge; }
      }
    } else {
      const N = p.spokes, kk = N / TAU, r1 = t * 0.35, r2 = -t * 0.28;
      const x1 = cols * 0.14 * Math.cos(t * 0.11), y1 = rows * aspect * 0.12 * Math.sin(t * 0.09);
      const glow = C(0.35);
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(WY[i] - y1, WX[i] - x1) * kk + r1, b = Math.atan2(WY[i] + y1, WX[i] + x1) * kk + r2;
        if ((Math.floor(a) + Math.floor(b)) & 1) { ch[i] = '█'; co[i] = ink; }
        else if (a - Math.floor(a) < 0.18) { ch[i] = '.'; co[i] = glow; }
      }
    }
  },
  wDoppler(s, f) {
    const { g, cols, rows, aspect, t, dt, C } = f, M = s.M, c = M * 0.22, maxR = Math.hypot(cols, rows * aspect);
    const sx = cols * 0.36 * Math.sin(t * 0.37), sy = rows * aspect * 0.3 * Math.sin(t * 0.53 + 1);
    s.emit -= dt;
    if (s.emit <= 0) { s.emit += 0.26; s.rings.push({ x: sx, y: sy, t0: t }); if (s.emit < -1) s.emit = 0.26; }
    s.rings = s.rings.filter(r => c * (t - r.t0) < maxR && t >= r.t0 - 1);
    const life = maxR / c;
    for (const r of s.rings) {
      const rad = c * (t - r.t0), age = (t - r.t0) / life, e = clamp(1 - age * 1.1, 0.12, 1);
      const col = C(0.25 + 0.75 * e), np = Math.ceil(TAU * rad * 0.9) + 8, cx = cols / 2 + r.x, cy = rows / 2 + r.y / aspect;
      for (let k = 0; k < np; k++) {
        const th = (k / np) * TAU, ct = Math.cos(th), st = Math.sin(th);
        const x = cx + rad * ct, y = cy + (rad * st) / aspect;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        g.set(x, y, dirCh(-st, ct), col);
      }
    }
    g.set(cols / 2 + sx, rows / 2 + sy / aspect, '@', C(1));
  },
  wArray(s, f) {
    const { g, cols, rows, t, C } = f, p = f.p, n = g.n, ns = p.n, ch = g.ch, co = g.co, CS = s.CS, SN = s.SN, FA = s.FA;
    const steer = 0.95 * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 0.71), dl = -Math.PI * Math.sin(steer), w = 3;
    const cp = [], sp = [];
    for (let j = 0; j < ns; j++) { const ps = j * dl - w * t; cp.push(Math.cos(ps)); sp.push(Math.sin(ps)); }
    for (let i = 0; i < n; i++) {
      let re = 0, im = 0;
      for (let j = 0, o = i; j < ns; j++, o += n) { const a = CS[o], b = SN[o]; re += a * cp[j] - b * sp[j]; im += b * cp[j] + a * sp[j]; }
      const env = Math.sqrt(re * re + im * im) / ns, cph = re / (env * ns + 1e-6);
      const e = Math.min(1, Math.pow(env, 1.4) * (0.3 + 0.7 * (0.5 + 0.5 * cph)) * (0.7 + 0.6 * FA[i]));
      if (e < 0.05) continue;
      ch[i] = rc(RS, e * 1.15); co[i] = C(0.1 + 0.9 * e);
    }
    for (const ax of s.ax) g.set(cols / 2 + ax, rows - 1, '▲', C(1));
  } });

// ════════ 旋轉縮放：各種磁磚材質一邊旋轉一邊縮放 ════════
const ROTO_TEX = {
  checker(u, v) {
    const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
    let e = (iu + iv) & 1 ? 0.8 : 0.34;
    if (fu > 0.9 || fv > 0.9) e -= 0.24; else if (fu < 0.1 || fv < 0.1) e += 0.2;
    return e + 0.12 * (0.5 - (fu + fv) * 0.5);
  },
  bricks(u, v, t, S) { // S：一個磁磚單位在畫面上是幾個世界單位；灰縫寬度以世界單位計，縮圖裡也看得到
    const row = Math.floor(v * 2), uu = u + (row & 1) * 0.5, iu = Math.floor(uu), fu = uu - iu, fv = v * 2 - row;
    const mu = Math.max(0.05, 1.1 / S), mv = Math.max(0.12, 2.8 / S);
    if (fu < mu || fv < mv) return 0.1;
    let e = 0.42 + 0.3 * hash2(iu, row);
    if (fv < mv + 0.12) e += 0.16; else if (fv > 0.86 || fu > 1 - mu * 0.8) e -= 0.16;
    return e + (hash2(Math.floor(uu * 9), Math.floor(v * 14)) - 0.5) * (S < 20 ? 0.07 : 0.14);
  },
  scales(u, v) {
    u *= 0.6; v *= 0.6;
    const r0 = Math.floor(v * 2), R = 0.62;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const off = (r & 1) * 0.5, cx = Math.round(u - off) + off, dx = u - cx, dy = v - r * 0.5, d = Math.sqrt(dx * dx + dy * dy);
      if (d < R) {
        if (d > R * 0.86) return 0.97;
        return 0.18 + 0.62 * clamp(dy / R + 0.35, 0, 1) * (0.55 + 0.45 * d / R) + 0.08 * hash2(cx * 2, r);
      }
    }
    return 0.1;
  },
  hex(u, v) {
    const S3 = 1.7320508;
    let ax = u - Math.round(u), ayc = Math.round(v / S3) * S3, ay = v - ayc, idA = Math.round(u) * 7 + ayc;
    const bu = u - 0.5, bv = v - S3 / 2, bxc = Math.round(bu), byc = Math.round(bv / S3) * S3, bx = bu - bxc, by = bv - byc;
    let lx = ax, ly = ay, id = idA;
    if (bx * bx + by * by < ax * ax + ay * ay) { lx = bx; ly = by; id = bxc * 7 + byc + 3.1; }
    const h = Math.max(Math.abs(lx), Math.abs(lx * 0.5 + ly * 0.866), Math.abs(lx * 0.5 - ly * 0.866));
    if (h > 0.445) return 0.06;
    let e = (0.4 + 0.35 * hash2(id, 1.7)) * (1 - 0.45 * (h / 0.5) * (h / 0.5));
    if (h > 0.36) e += lx + ly < 0 ? 0.25 : -0.12;
    return e;
  },
  weave(u, v) {
    const U = u, V = v, iu = Math.floor(U), iv = Math.floor(V), fu = U - iu, fv = V - iv;
    const hz = ((iu + iv) & 1) === 0, across = hz ? fv : fu, along = hz ? fu : fv;
    const sp = across * 2 - Math.floor(across * 2), prof = Math.sin(sp * Math.PI);
    if (prof < 0.3) return 0.04;
    return 0.15 + 0.82 * prof * (0.45 + 0.55 * Math.sin(along * Math.PI));
  },
  truchet(u, v) {
    const iu = Math.floor(u), iv = Math.floor(v); let fu = u - iu; const fv = v - iv;
    if (hash2(iu, iv) > 0.5) fu = 1 - fu;
    const d1 = Math.abs(Math.sqrt(fu * fu + fv * fv) - 0.5), d2 = Math.abs(Math.sqrt((1 - fu) * (1 - fu) + (1 - fv) * (1 - fv)) - 0.5), d = Math.min(d1, d2);
    return d < 0.15 ? 0.3 + 0.7 * (1 - d / 0.15) : 0.03;
  },
  dots(u, v, t) {
    const row = Math.floor(v), uu = u + (row & 1) * 0.5, iu = Math.floor(uu), fu = uu - iu - 0.5, fv = v - row - 0.5, d = Math.sqrt(fu * fu + fv * fv);
    const r = 0.24 + 0.17 * Math.sin(t * 1.4 + iu * 0.9 + row * 0.6);
    return d < r ? 0.98 - (0.5 * d) / r : d < r + 0.07 ? 0.26 : 0.03;
  },
};
A({ id: 'ge-roto', name: '旋轉縮放', cat: '幾何', theme: 'cyber', desc: '立體棋盤磁磚不停旋轉、拉近拉遠',
  params: { tex: 'checker', floor: 0 },
  variants: [
    { id: 'bricks', name: '紅磚牆', theme: 'blood', desc: '交錯砌起的磚牆在眼前旋轉', params: { tex: 'bricks' } },
    { id: 'scales', name: '魚鱗', theme: 'mint', desc: '層層疊疊的魚鱗紋旋轉縮放', params: { tex: 'scales' } },
    { id: 'weave', name: '編織', theme: 'sunset', desc: '一上一下交錯的竹籃編織紋', params: { tex: 'weave' } },
    { id: 'truchet', name: '弧線磚', theme: 'neon', desc: '隨機轉向的圓弧磚連成迷宮曲線', params: { tex: 'truchet' } },
    { id: 'floor', name: '無限地板', theme: 'ice', desc: '貼地飛過一望無際的棋盤地板', params: { tex: 'checker', floor: 1 } },
  ],
  init(s, f) { worldXY(s, f); s.px = 0; s.py = 0; },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, C } = f, p = f.p, tex = ROTO_TEX[p.tex], ch = g.ch, co = g.co, M = s.M;
    if (p.floor) {
      const yaw = t * 0.16 + 0.7 * Math.sin(t * 0.07), dx = Math.cos(yaw), dy = Math.sin(yaw);
      s.px += dx * dt * 2.2; s.py += dy * dt * 2.2;
      const hor = Math.floor(rows * 0.34), foc = M * 0.9, camH = 2.2, zAl = Math.sqrt((0.5 * camH * foc) / aspect);
      for (let y = 0; y < rows; y++) {
        if (y < hor) {
          const k = (hor - y) / hor;
          for (let x = 0, i = y * cols; x < cols; x++, i++) { if (y === hor - 1) { ch[i] = '_'; co[i] = C(0.45); } else { const h = hash2(x, y); if (h > 0.985) { ch[i] = h > 0.996 ? '+' : '.'; co[i] = C(0.25 + 0.5 * k * (0.6 + 0.4 * Math.sin(t * 2 + x))); } } }
          continue;
        }
        // 遠處磁磚縮到一格以下時，改成漸漸混成磁磚的平均亮度（不會出現疊紋），再往地平線慢慢變暗；地平線下方不會空一條
        const dz = (y + 0.5 - hor) * aspect, Z = (camH * foc) / dz, fog = clamp(1.25 - Z / (1.6 * zAl), 0, 1), dim = clamp(1.12 - Z / (8 * zAl), 0.2, 1);
        if (fog <= 0.02) {
          for (let x = 0, i = y * cols; x < cols; x++, i++) { const e = (0.55 + (hash2(x * 0.93, y * 1.7) - 0.5) * 0.12) * dim; ch[i] = rc(RS, e); co[i] = C(e); }
          continue;
        }
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          const L = ((x + 0.5 - cols / 2) * Z) / foc;
          const u = s.px + dx * Z - dy * L, v = s.py + dy * Z + dx * L;
          const e = (tex(u, v, t, foc / Z) * fog + 0.55 * (1 - fog)) * dim;
          ch[i] = rc(RS, e); co[i] = C(e);
        }
      }
      return;
    }
    const ang = t * 0.19 + 0.6 * Math.sin(t * 0.13), S = M * (0.16 + 0.08 * Math.sin(t * 0.27));
    const ca = Math.cos(ang) / S, sa = Math.sin(ang) / S, ox = t * 0.31 + 3 * Math.sin(t * 0.05), oy = t * 0.17;
    for (let y = 0, i = 0; y < rows; y++) {
      const Y = (y + 0.5 - rows / 2) * aspect;
      let u = (0.5 - cols / 2) * ca + Y * sa + ox, v = -(0.5 - cols / 2) * sa + Y * ca + oy;
      for (let x = 0; x < cols; x++, i++, u += ca, v -= sa) {
        const e = tex(u, v, t, S);
        if (e < 0.085) continue;
        ch[i] = rc(RS, e); co[i] = C(e);
      }
    }
  } });

// ════════ 萬花筒：鏡面折疊出對稱花紋 ════════
let KH = 0; // 圖樣順便算出的色相
const KAL_PAT = {
  sines(x, y, r, a, t) {
    const v = fsin(x * 8 + t * 0.9) + fsin(y * 11 - t * 0.7) + fsin((x - y) * 6 + t * 0.5) + fsin(r * 12 - t * 1.6);
    KH = v * 45 + t * 20;
    return 0.5 + 0.5 * fsin(v * 1.8 + t * 0.3);
  },
  kali(x, y, r, a, t, s) {
    let px = x * 0.5 + 0.05, py = y * 0.5, trap = 9, sum = 0;
    const cx = s.kc[0], cy = s.kc[1], kr = s.kc[2];
    for (let k = 0; k < 5; k++) {
      px = Math.abs(px); py = Math.abs(py);
      const d = px * px + py * py + 1e-4;
      px = px / d - cx; py = py / d - cy;
      const q = Math.abs(Math.sqrt(px * px + py * py) - kr); if (q < trap) { trap = q; sum = k; }
    }
    KH = sum * 55 + trap * 300 + t * 12;
    return clamp(1 - Math.sqrt(trap) * 1.6, 0, 1);
  },
  bloom(x, y, r, a, t, s) {
    const n = s.n, pet = 0.75 + 0.25 * fcos(a * n), u = (r / pet) * 1.6 - t * 0.3;
    const k = Math.floor(u), fr = u - k, band = 1 - Math.abs(fr - 0.5) * 2;
    const vein = Math.abs(a * n) < 0.12 && r > 0.08 ? 0.75 : 0;
    KH = k * 40 + t * 10;
    return Math.max(Math.pow(band, 2.2) * (0.55 + 0.45 * pet), vein * clamp(1.4 - r * 0.6, 0, 1));
  },
  glass(x, y, r, a, t, s) {
    const sx = s.gx, sy = s.gy;
    let d1 = 9, d2 = 9, k1 = 0;
    for (let k = 0; k < sx.length; k++) {
      const dx = x - sx[k], dy = y - sy[k], d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d;
    }
    const e1 = Math.sqrt(d1), e2 = Math.sqrt(d2);
    KH = k1 * 47 + t * 8;
    if (e2 - e1 < 0.035) return 0.02;
    return 0.35 + 0.6 * clamp(1 - e1 * 2.4, 0, 1);
  },
  rings(x, y, r, a, t) {
    const v = fsin(r * 10 - t * 2) + fsin(x * 7 + t) * fcos(y * 9 - t * 0.6) * 1.2;
    KH = v * 60 + r * 80;
    return clamp(0.5 + 0.33 * v, 0, 1);
  },
  star(x, y, r, a, t, s) {
    const K = 2.4 + 0.3 * Math.sin(t * 0.15), b = Math.PI / 2 - Math.PI / s.n, cb = Math.cos(b), sb = Math.sin(b), c2 = Math.cos(2 * b), s2 = Math.sin(2 * b);
    const d1 = Math.abs(fract(x * K - t * 0.08) - 0.5), d2 = Math.abs(fract((x * cb + y * sb) * K + 0.3 + t * 0.05) - 0.5), d3 = Math.abs(fract((x * c2 + y * s2) * K * 0.8 - t * 0.04) - 0.5);
    const d = Math.max(d1, d2, d3);
    KH = r * 90 + t * 10;
    return d > 0.39 ? 0.3 + 0.7 * (d - 0.39) / 0.11 : 0;
  },

};
A({ id: 'ge-kaleido', name: '萬花筒', cat: '幾何', theme: 'neon', hue: true, desc: '六面鏡子折射出不停流轉的花紋',
  params: { n: 6, pat: 'sines', tile: '', twist: 0 },
  variants: [
    { id: 'kali', name: '鏡像碎形', theme: 'synth', desc: '反覆鏡射折疊出的碎形星芒', params: { n: 8, pat: 'kali' } },
    { id: 'tri', name: '三角鏡', theme: 'ice', hue: false, desc: '三面鏡子拼出無限三角花磚', params: { tile: 'tri' } },
    { id: 'glass', name: '碎玻璃', theme: 'rainbow', desc: '彩色玻璃碎片在鏡中翻轉', params: { pat: 'glass' } },
    { id: 'twist', name: '漩渦鏡', theme: 'fire', hue: false, desc: '五重鏡像被捲成旋轉漩渦', params: { n: 5, pat: 'rings', twist: 1 } },
    { id: 'square', name: '方鏡', theme: 'mint', desc: '四面方鏡拼出的碎形地磚', params: { tile: 'square', pat: 'kali' } },
  ],
  init(s, f) { polarRA(s, f); s.n = f.p.n; s.gx = []; s.gy = []; s.kc = [0.6, 0.45, 0.8]; },
  frame(s, f) {
    const { g, t, C, H } = f, p = f.p, n = g.n, PR = s.PR, PA = s.PA, WX = s.WX, WY = s.WY, ch = g.ch, co = g.co;
    const pat = KAL_PAT[p.pat], N = p.n, seg = TAU / N, half = seg / 2, rot = t * 0.11 + 0.4 * Math.sin(t * 0.07);
    s.kc[0] = 0.49 + 0.09 * Math.sin(t * 0.13); s.kc[1] = 0.42 + 0.11 * Math.cos(t * 0.11); s.kc[2] = 0.8 + 0.18 * Math.sin(t * 0.23);
    if (p.pat === 'glass') {
      s.gx.length = 0; s.gy.length = 0;
      for (let k = 0; k < 9; k++) {
        const rr = 0.15 + 1.9 * fract(k * 0.618 + t * 0.025 * (1 + (k % 3) * 0.4)), aa = (0.5 + 0.48 * Math.sin(t * 0.3 + k * 1.7)) * half;
        s.gx.push(rr * Math.cos(aa)); s.gy.push(rr * Math.sin(aa));
      }
    }
    const zoom = 1 + 0.18 * Math.sin(t * 0.21), tw = p.twist ? 2.6 * Math.sin(t * 0.17) : 0;
    if (p.tile) {
      const S = s.M * (p.tile === 'tri' ? 0.44 + 0.1 * Math.sin(t * 0.19) : 0.36 + 0.08 * Math.sin(t * 0.19)), ca = Math.cos(rot) / S, sa = Math.sin(rot) / S, H3 = 0.8660254;
      for (let i = 0; i < n; i++) {
        let x = WX[i] * ca - WY[i] * sa + t * 0.05, y = WX[i] * sa + WY[i] * ca;
        if (p.tile === 'square') {
          x = Math.abs((x * 0.5 - Math.floor(x * 0.5)) * 2 - 1); y = Math.abs((y * 0.5 - Math.floor(y * 0.5)) * 2 - 1);
          if (y > x) { const q = x; x = y; y = q; }
        } else {
          for (let k = 0; k < 24; k++) {
            let moved = false;
            if (y < 0) { y = -y; moved = true; }
            let d = x * H3 - y * 0.5;
            if (d < 0) { x -= 2 * d * H3; y += d; moved = true; }
            d = (1 - x) * H3 - y * 0.5;
            if (d < 0) { x += 2 * d * H3; y += d; moved = true; }
            if (!moved) break;
          }
        }
        const r = Math.sqrt(x * x + y * y);
        const e = p.tile === 'square' ? pat(x * 1.6, y * 1.6, r, 0, t, s) : KAL_PAT.sines(x * 0.8, y * 0.8, r * 0.8, 0, t);
        if (e < 0.085) continue;
        ch[i] = rc(RS, e); co[i] = H(KH, 0.15 + 0.85 * e);
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      const r = PR[i] * zoom;
      let a = PA[i] + rot + r * tw;
      a -= seg * Math.floor(a / seg);
      if (a > half) a = seg - a;
      const e = pat(r * fcos(a), r * fsin(a), r, a, t, s);
      if (e < 0.085) continue;
      ch[i] = rc(RS, e); co[i] = H(KH, 0.15 + 0.85 * e);
    }
  } });

// ════════ 萬花尺：齒輪、諧波擺帶著筆慢慢畫出花紋 ════════
let PX = 0, PY = 0;
const gcd = (a, b) => { while (b) { const q = a % b; a = b; b = q; } return a; };
function spPt(P, th) {
  switch (P.type) {
    case 'hypo': { const q = ((1 - P.r) / P.r) * th; PX = (1 - P.r) * Math.cos(th) + P.d * Math.cos(q); PY = (1 - P.r) * Math.sin(th) - P.d * Math.sin(q); break; }
    case 'epi': { const q = ((1 + P.r) / P.r) * th; PX = (1 + P.r) * Math.cos(th) - P.d * Math.cos(q); PY = (1 + P.r) * Math.sin(th) - P.d * Math.sin(q); break; }
    case 'farris': PX = Math.cos(th) + P.A * Math.cos(P.k1 * th) - P.B * Math.sin(P.k2 * th); PY = Math.sin(th) + P.A * Math.sin(P.k1 * th) + P.B * Math.cos(P.k2 * th); break;
    case 'harmono': { const e1 = Math.exp(-P.d * th), e2 = Math.exp(-P.d2 * th); PX = Math.sin(P.f1 * th + P.p1) * e1 + P.a2 * Math.sin(P.f2 * th + P.p2) * e2; PY = Math.sin(P.f3 * th + P.p3) * e1 + P.a2 * Math.sin(P.f4 * th + P.p4) * e2; break; }
    default: { const e = Math.exp(-P.d * th), x = Math.sin(P.f1 * th + P.p1) * e + 0.3 * Math.sin(P.f3 * th) * e, y = Math.sin(P.f2 * th + P.p2) * e, w = P.w * th, c = Math.cos(w), s = Math.sin(w); PX = x * c - y * s; PY = x * s + y * c; }
  }
  PX *= P.kx; PY *= P.ky;
}
// small：小畫面（少畫幾圈，避免中心糊成一團）；wide：諧波擺在寬螢幕上橫向拉開的倍率
function spMake(type, idx, base, small, wide) {
  const P = { type, th: 0, hue: (base + idx * 120) % 360, done: false, kx: 1, ky: 1 };
  if (type === 'hypo' || type === 'epi') {
    let a, b;
    do { b = rint(5, 13); a = rint(1, Math.min(b - 1, 7)); } while (gcd(a, b) !== 1 || a * 2 === b || (type === 'epi' && a > 5));
    P.r = a / b; P.d = P.r * rnd(0.55, 1.25); P.end = TAU * a; P.T = clamp(5 + a * b * 0.2, 7, 14);
  } else if (type === 'farris') {
    const m = rint(3, 9), j1 = pick([-2, -1, 1, 2]); let j2; do { j2 = pick([-3, -2, -1, 1, 2, 3]); } while (j2 === j1);
    P.k1 = 1 + m * j1; P.k2 = 1 + m * j2; P.A = rnd(0.35, 0.7); P.B = rnd(0.2, 0.5); P.end = TAU; P.T = 9;
  } else if (type === 'harmono') {
    const [p, q] = pick([[2, 3], [3, 4], [1, 3], [3, 5], [2, 5], [1, 2], [3, 2]]);
    P.f1 = p; P.f2 = p * (1 + rnd(-0.012, 0.012)); P.f3 = q; P.f4 = q * (1 + rnd(-0.012, 0.012));
    // 同一軸的兩個擺錘相位接近，振幅才不會互相抵消成一條扁帶
    P.p1 = rnd(0, TAU); P.p2 = P.p1 + rnd(-0.6, 0.6); P.p3 = rnd(0, TAU); P.p4 = P.p3 + rnd(-0.6, 0.6);
    P.a2 = rnd(0.3, 0.8); P.d = rnd(0.032, 0.045) * (small ? 1.6 : 1); P.d2 = P.d * rnd(0.8, 1.3); P.end = Math.log(18) / P.d; P.T = 17;
  } else {
    const f = pick([2, 3, 3, 4]);
    P.f1 = f; P.f2 = f * (1 + rnd(-0.004, 0.004)); P.f3 = f * pick([0.5, 1.5, 2]); P.p1 = rnd(0, TAU); P.p2 = P.p1 + Math.PI / 2 + rnd(-0.6, 0.6);
    P.w = pick([1, -1]) * rnd(0.025, 0.06); P.d = rnd(0.018, 0.026) * (small ? 2 : 1); P.end = Math.log(16) / P.d; P.T = 18;
  }
  // 取樣：先算縮放比例（擺錘類每個軸各自撐滿），再算最大速度
  let mxX = 0, mxY = 0, vmax = 0, lx = 0, ly = 0;
  const N = 3000, perAxis = type === 'harmono' || type === 'rotary';
  for (let k = 0; k <= N; k++) { spPt(P, (P.end * k) / N); mxX = Math.max(mxX, Math.abs(PX)); mxY = Math.max(mxY, Math.abs(PY)); }
  if (perAxis) { P.kx = (type === 'harmono' ? wide || 1 : 1) / (mxX || 1); P.ky = 1 / (mxY || 1); }
  else { P.kx = P.ky = 1 / (Math.max(mxX, mxY) || 1); }
  P.k = Math.min(P.kx, P.ky);
  for (let k = 0; k <= N; k++) {
    spPt(P, (P.end * k) / N);
    if (k) vmax = Math.max(vmax, Math.hypot(PX - lx, PY - ly) / (P.end / N));
    lx = PX; ly = PY;
  }
  P.vmax = vmax * 1.3 + 0.01; P.rate = P.end / P.T;
  return P;
}
A({ id: 'ge-spiro', name: '萬花尺', cat: '幾何', theme: 'gold', desc: '齒輪帶著筆，一圈圈畫出內擺線花紋',
  params: { curve: 'hypo', pens: 1, bold: 0, gear: 0 },
  variants: [
    { id: 'epi', name: '外擺線', theme: 'ice', desc: '小圓繞著大圓外側滾出的花環', params: { curve: 'epi' } },
    { id: 'gear', name: '齒輪示意', theme: 'blueprint', desc: '看得見齒輪與連桿的萬花尺', params: { gear: 1 } },
    { id: 'trio', name: '三色筆', theme: 'rainbow', hue: true, desc: '三支彩色筆同時交織作畫', params: { pens: 3 } },
    { id: 'farris', name: '神秘曲線', theme: 'lavender', desc: '三個旋轉圓疊加出對稱奇花', params: { curve: 'farris' } },
    { id: 'harmono', name: '諧波擺', theme: 'amber', desc: '兩組擺錘慢慢衰減畫出的弦紋', params: { curve: 'harmono' } },
    { id: 'rotary', name: '旋轉擺', theme: 'sakura', desc: '紙在轉、擺在晃畫出的玫瑰窗', params: { curve: 'rotary' } },
    { id: 'neon', name: '霓虹粗筆', theme: 'synth', hue: true, desc: '發光粗筆畫出漸層色的花紋', params: { bold: 1 } },
  ],
  init(s, f) {
    s.D = new Dots(f.cols, f.rows); s.G = new Glow(f.cols, f.rows);
    this.newFig(s, f);
  },
  newFig(s, f) {
    const p = f.p, base = rnd(0, 360), small = f.cols < 160;
    const R0 = Math.min(f.cols / 2, (f.rows * f.aspect) / 2) * 0.93, wide = clamp((f.cols / 2) * 0.9 / R0, 1, 1.45);
    s.pens = [];
    if (p.pens > 1) {
      for (let k = 0; k < p.pens; k++) { const P = spMake('hypo', k, base, small); if (k) { P.T = s.pens[0].T; P.rate = P.end / P.T; } s.pens.push(P); }
    } else s.pens.push(spMake(p.curve, 0, base, small, wide));
    s.phase = 0; s.timer = 0; s.D.clear(); s.G.v.fill(0);
    // 先用很淡的點描出整個圖形，筆再沿著它描亮
    const { cols, rows, aspect } = f, D = s.D, R = Math.min(cols / 2, (rows * aspect) / 2) * 0.93, bx = R * 2, by = (R * 4) / aspect;
    for (const P of s.pens) {
      const n = Math.min(40000, Math.ceil((P.end * P.vmax * (p.bold ? R : Math.max(bx, by))) / 0.9));
      for (let k = 0; k <= n; k++) {
        spPt(P, (P.end * k) / n);
        if (p.bold) s.G.splat(cols / 2 + PX * R, rows / 2 + (PY * R) / aspect, 0.13, P.hue + ((P.end * k) / n) * 9);
        else D.put(D.w / 2 + PX * bx, D.h / 2 + PY * by, 0.07, P.hue);
      }
    }
  },
  frame(s, f) {
    const { g, cols, rows, aspect, dt, C, H } = f, p = f.p, D = s.D, G = s.G;
    const R = Math.min(cols / 2, (rows * aspect) / 2) * 0.93;
    const bx = R * 2, by = (R * 4) / aspect, hx = D.w / 2, hy = D.h / 2;
    if (s.phase === 0) {
      let all = true;
      for (const P of s.pens) {
        if (P.done) continue;
        all = false;
        const th1 = Math.min(P.end, P.th + P.rate * dt), span = th1 - P.th;
        const steps = clamp(Math.ceil((span * P.vmax * (p.bold ? R : Math.max(bx, by))) / 0.6), 1, 6000);
        spPt(P, P.th);
        let lx = PX, ly = PY;
        for (let k = 1; k <= steps; k++) {
          const th = P.th + (span * k) / steps;
          spPt(P, th);
          if (p.bold) { const ds = Math.hypot((PX - lx) * R, ((PY - ly) * R) / aspect); G.splat(cols / 2 + PX * R, rows / 2 + (PY * R) / aspect, ds * 0.9, P.hue + th * 9); }
          else D.put(hx + PX * bx, hy + PY * by, 1, P.hue);
          lx = PX; ly = PY;
        }
        P.th = th1;
        if (th1 >= P.end) P.done = true;
      }
      if (all) { s.phase = 1; s.timer = 2.8; }
      const k = Math.pow(0.5, dt / 16); D.fade(k); G.fade(k);
    } else if (s.phase === 1) {
      s.timer -= dt; const k = Math.pow(0.5, dt / 16); D.fade(k); G.fade(k);
      if (s.timer <= 0) { s.phase = 2; s.timer = 1.4; }
    } else {
      s.timer -= dt; const k = Math.pow(0.03, dt / 1.4); D.fade(k); G.fade(k);
      if (s.timer <= 0) this.newFig(s, f);
    }
    const hueOn = p.pens > 1;
    if (p.bold) G.render(g, C, H, 0.9, ' .:-=+*#%@', 0.04);
    else D.render(g, C, hueOn ? H : null, 2.4, 0.03, 0.2);
    if (s.phase === 0) {
      for (const P of s.pens) {
        if (P.done) continue;
        spPt(P, P.th);
        const x = cols / 2 + PX * R, y = rows / 2 + (PY * R) / aspect;
        if (p.gear && P.type === 'hypo') {
          // 外圈固定齒輪、滾動的小齒輪、連桿與筆
          const ring = R * P.k, n1 = Math.ceil(ring * 4);
          for (let k = 0; k < n1; k++) { const a = (k / n1) * TAU; g.set(cols / 2 + Math.cos(a) * ring, rows / 2 + (Math.sin(a) * ring) / aspect, k % 2 ? '·' : '+', C(0.35)); }
          const gx = cols / 2 + Math.cos(P.th) * (1 - P.r) * ring, gy = rows / 2 + (Math.sin(P.th) * (1 - P.r) * ring) / aspect, rr = P.r * ring, n2 = Math.ceil(rr * 5) + 8, spin = (-(1 - P.r) / P.r) * P.th;
          for (let k = 0; k < n2; k++) { const a = (k / n2) * TAU; g.set(gx + Math.cos(a) * rr, gy + (Math.sin(a) * rr) / aspect, (k + ((spin * n2) / TAU) | 0) % 3 === 0 ? 'o' : '.', C(0.6)); }
          g.line(gx, gy, x, y, '-', C(0.8));
          g.set(gx, gy, '+', C(0.9));
        }
        g.set(x, y, '@', p.pens > 1 ? H(P.hue, 1) : C(1));
      }
    }
  } });

// ════════ 數學曲線：立體李沙育、莫勒玫瑰、超級公式、蝴蝶線、乘法圓、李沙育表、傅立葉本輪 ════════
const LIS_SET = [[3, 2, 5], [5, 4, 3], [1, 2, 3], [3, 4, 7], [2, 3, 5], [5, 6, 1], [4, 3, 2]];
const SUPER_SET = [[6, 1, 1, 1, 1, 1], [5, 0.3, 0.3, 0.3, 1, 1], [8, 0.5, 0.5, 8, 1, 1], [3, 4.5, 10, 10, 1, 1], [7, 2, 8, 4, 1, 1], [12, 15, 20, 3, 1, 1], [4, 0.6, 0.6, 2.8, 1, 1], [9, 1.2, 4, 0.8, 1, 1]];
const DEP_R = '.:-=+*#%@';
function glowLine(G, x0, y0, x1, y1, a, h) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.4) || 1, w = a / 1.4;
  for (let k = 0; k <= n; k++) G.splat(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, w, h);
}
A({ id: 'ge-curve', name: '數學曲線', cat: '幾何', theme: 'cyber', desc: '立體李沙育曲線在空中翻轉變形',
  params: { mode: 'lissa' },
  variants: [
    { id: 'maurer', name: '莫勒玫瑰', theme: 'sakura', desc: '玫瑰線上的點連成交錯花網', params: { mode: 'maurer' } },
    { id: 'super', name: '超級公式', theme: 'toxic', hue: true, desc: '超級公式的形狀層層變形放大', params: { mode: 'super' } },
    { id: 'butterfly', name: '蝴蝶線', theme: 'sunset', desc: '光點沿著蝴蝶曲線飛行留下尾跡', params: { mode: 'butterfly' } },
    { id: 'times', name: '乘法圓', theme: 'ice', hue: true, desc: '圓上兩百點依乘法連線的包絡', params: { mode: 'times' } },
    { id: 'table', name: '李沙育表', theme: 'mint', desc: '不同頻率組合排成的李沙育圖表', params: { mode: 'table' } },
    { id: 'epicycle', name: '本輪', theme: 'blueprint', desc: '一串旋轉圓圈合力描出的圖形', params: { mode: 'epicycle' } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows } = f;
    s.D = new Dots(cols, rows); s.G = new Glow(cols, rows); s.zb = new Float32Array(cols * rows);
    s.R = Math.min(cols / 2, (rows * f.aspect) / 2) * 0.94;
    if (p.mode === 'super') {
      polarRA(s, f);
      s.AI = new Uint16Array(cols * rows);
      for (let i = 0; i < s.AI.length; i++) s.AI[i] = ((((s.PA[i] / TAU) * 1024) | 0) + 1024) & 1023;
      s.tabA = new Float32Array(1024); s.tabB = new Float32Array(1024); s.tab = new Float32Array(1024); s.si = -1;
    }
    if (p.mode === 'epicycle') this.newEpi(s);
    s.mn = 3; s.mt = 0;
  },
  superTab(tab, P) {
    const [m, n1, n2, n3, a, b] = P;
    let mx = 0;
    for (let k = 0; k < 1024; k++) {
      const ph = (k / 1024) * TAU, u = (m * ph) / 4;
      const r = Math.pow(Math.pow(Math.abs(Math.cos(u) / a), n2) + Math.pow(Math.abs(Math.sin(u) / b), n3), -1 / n1);
      tab[k] = isFinite(r) ? r : 0; if (tab[k] > mx) mx = tab[k];
    }
    for (let k = 0; k < 1024; k++) tab[k] = Math.max(0.05, tab[k] / (mx || 1));
  },
  newEpi(s) {
    // 頻率都取 1 + m·j，畫出來的圖形就有 m 重對稱
    const m = rint(3, 7), K = rint(4, 7), co = [];
    let sum = 0;
    for (let j = 0; j < K; j++) {
      const q = j === 0 ? 0 : (j % 2 ? -1 : 1) * Math.ceil(j / 2), k = 1 + m * q;
      const r = j === 0 ? 1 : rnd(0.2, 0.75) / Math.pow(Math.abs(k), 0.6);
      co.push({ k, r, ph: rnd(0, TAU) }); sum += r;
    }
    co.sort((a, b) => b.r - a.r);
    for (const c of co) c.r /= sum;
    s.co = co; s.eth = 0; s.ecnt = 0; s.D && s.D.clear();
  },
  frame(s, f) {
    const m = f.p.mode;
    if (m === 'lissa') this.fLissa(s, f);
    else if (m === 'super') this.fSuper(s, f);
    else this['f' + m[0].toUpperCase() + m.slice(1)](s, f);
  },
  fLissa(s, f) {
    const { g, cols, rows, aspect, t, C } = f, zb = s.zb, ch = g.ch, co = g.co;
    zb.fill(0);
    const per = 11, ph = t / per, i0 = Math.floor(ph) % LIS_SET.length, i1 = (i0 + 1) % LIS_SET.length, mix = smooth(0.7, 1, ph - Math.floor(ph));
    const A0 = LIS_SET[i0], A1 = LIS_SET[i1], d1 = t * 0.35, d2 = t * 0.23 + 1;
    // 相機距離 4.2、K = 2.35R：任何角度下曲線都留在畫面內
    const M = rotM(t * 0.21, t * 0.33, t * 0.07), K = s.R * 2.35, cx = cols / 2, cy = rows / 2;
    const N = Math.ceil(clamp(s.R * 60, 1500, 9000));
    for (let k = 0; k < N; k++) {
      const u = (k / N) * TAU;
      const x = lerp(Math.sin(A0[0] * u + d1), Math.sin(A1[0] * u + d1), mix), y = lerp(Math.sin(A0[1] * u), Math.sin(A1[1] * u), mix), z = lerp(Math.sin(A0[2] * u + d2), Math.sin(A1[2] * u + d2), mix);
      const X = M[0] * x + M[1] * y + M[2] * z, Y = M[3] * x + M[4] * y + M[5] * z, Z = M[6] * x + M[7] * y + M[8] * z + 4.2;
      const iz = 1 / Z, sx = cx + K * X * iz, sy = cy + (K * Y * iz) / aspect;
      if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) continue;
      const i = (sy | 0) * cols + (sx | 0);
      if (iz > zb[i]) { zb[i] = iz; const e = clamp((iz - 1 / 5.4) / (1 / 3.0 - 1 / 5.4), 0, 1); ch[i] = DEP_R[Math.min(8, (e * 9) | 0)]; co[i] = C(0.2 + 0.8 * e); }
    }
  },
  fMaurer(s, f) {
    const { g, cols, rows, aspect, t, dt, C } = f, G = s.G, R = s.R, ry = R / aspect, hx = cols / 2, hy = rows / 2;
    G.v.fill(0);
    s.mt += dt;
    if (s.mt > 16) { s.mt = 0; s.mn = pick([2, 3, 4, 5, 6, 7]); }
    const n = s.mn, d = (29 + t * 0.9) * (Math.PI / 180), rot = t * 0.05;
    let lx = 0, ly = 0;
    for (let k = 0; k <= 360; k++) {
      const th = k * d, r = Math.sin(n * th), x = r * Math.cos(th + rot), y = r * Math.sin(th + rot);
      if (k) glowLine(G, hx + lx * R, hy + ly * ry, hx + x * R, hy + y * ry, 0.06);
      lx = x; ly = y;
    }
    for (let k = 0; k <= 1500; k++) { const th = (k / 1500) * TAU, r = Math.sin(n * th); G.splat(hx + r * Math.cos(th + rot) * R, hy + r * Math.sin(th + rot) * ry, 0.6); }
    G.render(g, C, null, 0.75, RS, 0.05);
  },
  fSuper(s, f) {
    const { g, t, C, H } = f, ch = g.ch, co = g.co, n = g.n, PR = s.PR, AI = s.AI, tab = s.tab;
    const per = 9, ph = t / per, i0 = Math.floor(ph) % SUPER_SET.length;
    if (i0 !== s.si) { s.si = i0; this.superTab(s.tabA, SUPER_SET[i0]); this.superTab(s.tabB, SUPER_SET[(i0 + 1) % SUPER_SET.length]); }
    const mix = smooth(0.55, 1, ph - Math.floor(ph));
    for (let k = 0; k < 1024; k++) tab[k] = lerp(s.tabA[k], s.tabB[k], mix);
    const off = ((t * 0.04 * 1024) | 0) & 1023, zt = t * 0.35;
    for (let i = 0; i < n; i++) {
      const q = (PR[i] + 0.002) / (tab[(AI[i] + off) & 1023] * 0.92);
      const u = Math.log(q) * 3.2 - zt, k = Math.floor(u), fr = u - k, band = 1 - Math.abs(fr - 0.5) * 2;
      let e = Math.pow(band, 2.4) * clamp(1.6 - q * 0.35, 0.25, 1);
      if (q < 1 && q > 0.94) e = 1;
      if (e < 0.09) continue;
      ch[i] = rc(RS, e); co[i] = H(k * 37 + t * 12, 0.15 + 0.85 * e);
    }
  },
  fButterfly(s, f) {
    const { g, t, C } = f, D = s.D, R = s.R / 4.2, bx = R * 2, by = (R * 4) / f.aspect, hx = D.w / 2, hy = D.h / 2 + by * 0.35;
    D.clear();
    const rot = 0.25 * Math.sin(t * 0.1), cr = Math.cos(rot), sr = Math.sin(rot), END = 24 * Math.PI;
    const P = th => { const r = Math.exp(Math.sin(th)) - 2 * Math.cos(4 * th) + Math.pow(Math.sin((2 * th - Math.PI) / 24), 5); const x = r * Math.cos(th), y = -r * Math.sin(th); PX = x * cr - y * sr; PY = x * sr + y * cr; };
    const N = 6000;
    for (let k = 0; k <= N; k++) { P((k / N) * END); D.put(hx + PX * bx, hy + PY * by, 0.12); }
    for (let c = 0; c < 2; c++) {
      const head = ((t * 0.55 + c * 0.5 * END) % END), tail = 5.5, M2 = 900;
      for (let k = 0; k <= M2; k++) {
        const u = k / M2, th = head - tail * (1 - u);
        P(th < 0 ? th + END : th); D.put(hx + PX * bx, hy + PY * by, 0.2 + 1.8 * u * u);
      }
    }
    D.render(g, C, null, 1.5, 0.05, 0.2);
    for (let c = 0; c < 2; c++) { P((t * 0.55 + c * 0.5 * END) % END); g.set((hx + PX * bx) / 2, (hy + PY * by) / 4, '@', C(1)); }
  },
  fTimes(s, f) {
    const { g, cols, rows, aspect, t, C, H } = f, G = s.G, R = s.R, ry = R / aspect, hx = cols / 2, hy = rows / 2;
    G.v.fill(0);
    const N = 200, mul = 2 + ((t * 0.12) % 98), rot = -Math.PI / 2 + t * 0.03;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * TAU + rot, a1 = ((k * mul) / N) * TAU + rot;
      glowLine(G, hx + Math.cos(a0) * R, hy + Math.sin(a0) * ry, hx + Math.cos(a1) * R, hy + Math.sin(a1) * ry, 0.3, (k / N) * 360 + t * 8);
    }
    for (let k = 0; k < 900; k++) { const a = (k / 900) * TAU; G.splat(hx + Math.cos(a) * R, hy + Math.sin(a) * ry, 0.5, (k / 900) * 360 + t * 8); }
    G.render(g, C, H, 0.8, RS, 0.06);
    const lab = '× ' + mul.toFixed(2);
    g.text(2, f.rows - 2, lab, C(0.6));
  },
  fTable(s, f) {
    const { g, cols, rows, aspect, t, C } = f, D = s.D;
    D.clear();
    const nr = rows >= 60 ? 5 : rows >= 36 ? 4 : 3, nc = clamp(Math.round((nr * cols) / (rows * aspect)), nr, 12);
    const cw = D.w / (nc + 1), chh = D.h / (nr + 1), rx = cw * 0.4, ry = chh * 0.4, ph = t * 0.6;
    const dots = [];
    for (let j = 1; j <= nc; j++) { // 第一列：頻率圓
      const cx = (j + 0.5) * cw, cy = 0.5 * chh;
      for (let k = 0; k < 120; k++) { const a = (k / 120) * TAU; D.put(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.35); }
      dots.push([cx + Math.cos(j * ph) * rx, cy + Math.sin(j * ph) * ry]);
    }
    for (let i = 1; i <= nr; i++) {
      const cx = 0.5 * cw, cy = (i + 0.5) * chh;
      for (let k = 0; k < 120; k++) { const a = (k / 120) * TAU; D.put(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.35); }
      dots.push([cx + Math.cos(i * ph) * rx, cy + Math.sin(i * ph) * ry]);
    }
    for (let i = 1; i <= nr; i++) for (let j = 1; j <= nc; j++) {
      const cx = (j + 0.5) * cw, cy = (i + 0.5) * chh, N = 260, dl = t * 0.15 * (1 + ((i + j) % 3) * 0.2);
      let lx = cx + Math.cos(dl) * rx, ly = cy;
      for (let k = 1; k <= N; k++) {
        const u = (k / N) * TAU, x = cx + Math.cos(j * u + dl) * rx, y = cy + Math.sin(i * u) * ry;
        D.line(lx, ly, x, y, 0.9, 0, true); lx = x; ly = y;
      }
      dots.push([cx + Math.cos(j * ph + dl) * rx, cy + Math.sin(i * ph) * ry]);
    }
    D.render(g, C, null, 2, 0.05, 0.2);
    for (const [x, y] of dots) g.set(x / 2, y / 4, '@', C(1));
  },
  fEpicycle(s, f) {
    const { g, cols, rows, aspect, dt, C } = f, D = s.D, R = s.R, bx = R * 2, by = (R * 4) / aspect, hx = D.w / 2, hy = D.h / 2;
    const per = 13, w = TAU / per, th0 = s.eth, th1 = th0 + w * dt;
    const tip = th => { let x = 0, y = 0; for (const c of s.co) { x += c.r * Math.cos(c.k * th + c.ph); y += c.r * Math.sin(c.k * th + c.ph); } PX = x; PY = y; };
    D.fade(Math.pow(0.5, dt / 9));
    const steps = 24;
    tip(th0); let lx = PX, ly = PY;
    for (let k = 1; k <= steps; k++) { tip(th0 + ((th1 - th0) * k) / steps); D.line(hx + lx * bx, hy + ly * by, hx + PX * bx, hy + PY * by, 1, 0, true); lx = PX; ly = PY; }
    s.eth = th1;
    if (s.eth > TAU * 2.4) { s.ecnt++; this.newEpi(s); }
    D.render(g, C, null, 2.2, 0.04, 0.25);
    // 圓圈與連桿
    let x = 0, y = 0;
    for (const c of s.co) {
      const sx = cols / 2 + x * R, sy = rows / 2 + (y * R) / aspect, rr = c.r * R, n = Math.max(12, Math.ceil(rr * 4));
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU; g.set(sx + Math.cos(a) * rr, sy + (Math.sin(a) * rr) / aspect, '·', C(0.32)); }
      const nx = x + c.r * Math.cos(c.k * th1 + c.ph), ny = y + c.r * Math.sin(c.k * th1 + c.ph);
      g.line(sx, sy, cols / 2 + nx * R, rows / 2 + (ny * R) / aspect, '.', C(0.65));
      g.set(sx, sy, 'o', C(0.75));
      x = nx; y = ny;
    }
    g.set(cols / 2 + x * R, rows / 2 + (y * R) / aspect, '@', C(1));
  } });

// ════════ 歐普藝術：黑白錯覺圖形 ════════
A({ id: 'ge-opart', name: '歐普藝術', cat: '幾何', theme: 'mono', desc: '粗細起伏的黑白波紋，看久了會晃',
  params: { mode: 'waves' },
  variants: [
    { id: 'squares', name: '同心方框', theme: 'paper', desc: '一圈圈方框向外擴張的錯視隧道', params: { mode: 'squares' } },
    { id: 'bulge', name: '凸鏡棋盤', theme: 'ice', desc: '棋盤被兩顆看不見的透鏡撐起', params: { mode: 'bulge' } },
    { id: 'blaze', name: '鋸齒圓環', theme: 'amber', desc: '鋸齒狀的同心圓不停旋轉', params: { mode: 'blaze' } },
    { id: 'cafe', name: '咖啡牆', theme: 'blueprint', desc: '明明平行卻看起來歪斜的磚牆', params: { mode: 'cafe' } },
    { id: 'halftone', name: '網點波', theme: 'neon', desc: '網點大小起伏形成流動波紋', params: { mode: 'halftone' } },
    { id: 'warp', name: '扭曲格線', theme: 'lavender', desc: '方格線被漩渦慢慢扭轉', params: { mode: 'warp' } },
  ],
  init(s, f) { worldXY(s, f); },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C } = f, mode = f.p.mode, n = g.n, WX = s.WX, WY = s.WY, M = s.M, ch = g.ch, co = g.co;
    const ink = C(0.95);
    if (mode === 'waves') {
      const lam = M / 11, il = 1 / lam, k1 = TAU / (M * 0.55), k2 = TAU / (cols * 1.1);
      for (let y = 0, i = 0; y < rows; y++) {
        const Y = WY[i], amp = lam * (0.4 + 1.3 * (0.5 + 0.5 * Math.sin(Y * k2 * 2.1 - t * 0.3))), sh = amp * Math.sin(Y * k1 + t * 0.8);
        for (let x = 0; x < cols; x++, i++) {
          const X = WX[i], ph = (X + sh) * il, fr = ph - Math.floor(ph), duty = 0.5 + 0.28 * Math.sin(X * k2 + t * 0.25);
          if (fr < duty) { ch[i] = '█'; co[i] = ink; }
        }
      }
    } else if (mode === 'squares') {
      const cx = cols * 0.18 * Math.sin(t * 0.21), cy = rows * aspect * 0.16 * Math.sin(t * 0.17 + 1), k = 2.1 / Math.sqrt(M / 60);
      for (let i = 0; i < n; i++) {
        const d = Math.max(Math.abs(WX[i] - cx), Math.abs(WY[i] - cy));
        if (Math.floor(Math.sqrt(d) * k - t * 0.7) & 1) { ch[i] = '█'; co[i] = ink; }
      }
    } else if (mode === 'bulge') {
      const S = M / 9, iS = 1 / S, l1x = cols * 0.28 * Math.sin(t * 0.23), l1y = rows * aspect * 0.22 * Math.cos(t * 0.31);
      const l2x = -cols * 0.26 * Math.cos(t * 0.19), l2y = rows * aspect * 0.2 * Math.sin(t * 0.27 + 2), sg = 1 / (M * 0.32 * M * 0.32), mid = C(0.5);
      for (let i = 0; i < n; i++) {
        let X = WX[i], Y = WY[i];
        let dx = X - l1x, dy = Y - l1y, w = 1 + 1.6 * Math.exp(-(dx * dx + dy * dy) * sg);
        X = l1x + dx / w; Y = l1y + dy / w;
        dx = X - l2x; dy = Y - l2y; w = 1 + 1.3 * Math.exp(-(dx * dx + dy * dy) * sg);
        X = l2x + dx / w; Y = l2y + dy / w;
        const u = X * iS + t * 0.15, v = Y * iS, fu = u - Math.floor(u), fv = v - Math.floor(v);
        if ((Math.floor(u) + Math.floor(v)) & 1) { ch[i] = '█'; co[i] = ink; }
        else if (fu < 0.08 || fv < 0.08) { ch[i] = '·'; co[i] = mid; }
      }
    } else if (mode === 'blaze') {
      const lam = M / 16, N = 18, rot = t * 0.25;
      for (let i = 0; i < n; i++) {
        const r = Math.hypot(WX[i], WY[i]), a = Math.atan2(WY[i], WX[i]) * (N / TAU) + rot, tri = Math.abs(a - Math.floor(a) - 0.5) * 2;
        const rho = r + lam * 1.2 * (tri - 0.5) * Math.min(1, r / (lam * 3));
        if (Math.floor(rho / lam - t * 0.4) & 1) { ch[i] = '█'; co[i] = ink; }
      }
    } else if (mode === 'cafe') {
      const rh = Math.max(3, Math.round(rows / 9)), tw = Math.max(4, Math.round((rh * aspect) * 1.25)), grey = C(0.5);
      for (let y = 0, i = 0; y < rows; y++) {
        const row = Math.floor(y / rh), ry = y % rh;
        if (ry === rh - 1) { for (let x = 0; x < cols; x++, i++) { ch[i] = '─'; co[i] = grey; } continue; }
        const off = (row % 2 ? 1 : 0) * tw * (0.5 + 0.5 * Math.sin(t * 0.35)) + (row % 4 >= 2 ? tw * 0.5 : 0) * (0.5 + 0.5 * Math.sin(t * 0.35)) + t * 2 * (row % 2 ? 1 : -1);
        for (let x = 0; x < cols; x++, i++) {
          const u = (x + off) / tw;
          if (Math.floor(u) & 1) { ch[i] = '█'; co[i] = ink; }
        }
      }
    } else if (mode === 'halftone') {
      const R = ' .oO@', sp = 2, k = TAU / (M * 0.35), cx = cols * 0.2 * Math.sin(t * 0.2), cy = rows * aspect * 0.15 * Math.cos(t * 0.27);
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        if ((x + (y & 1)) % sp) continue;
        const X = WX[i], Y = WY[i], r = Math.hypot(X - cx, Y - cy), r2 = Math.hypot(X + cx, Y - cy * 0.5);
        const v = 0.5 + 0.25 * Math.sin(r * k - t * 2.2) + 0.25 * Math.sin(r2 * k * 0.8 - t * 1.6 + 1);
        if (v < 0.18) continue;
        ch[i] = R[Math.min(4, (v * 5) | 0)]; co[i] = C(0.35 + 0.65 * v);
      }
    } else {
      // 線寬以世界單位計（至少一格粗），扭轉幅度適中，格線才不會碎成片段
      const lam = Math.max(M / 5.5, 12), il = 1 / lam, sw = 1.1 * Math.sin(t * 0.21), sg = 1 / (M * 0.5 * M * 0.5), ca = Math.cos(t * 0.05), sa = Math.sin(t * 0.05), dot = C(0.45);
      for (let i = 0; i < n; i++) {
        const X0 = WX[i], Y0 = WY[i], r2 = X0 * X0 + Y0 * Y0, ang = sw * Math.exp(-r2 * sg) + 0.1 * Math.sin(t * 0.33 + r2 * sg * 2);
        const c = Math.cos(ang), sn = Math.sin(ang), X = X0 * c - Y0 * sn, Y = X0 * sn + Y0 * c;
        const u = (X * ca - Y * sa) * il + 0.5, v = (X * sa + Y * ca) * il + 0.5, fu = u - Math.floor(u), fv = v - Math.floor(v);
        const du = Math.min(fu, 1 - fu) * lam, dv = Math.min(fv, 1 - fv) * lam;
        if (du < 1.05 || dv < 1.4) { ch[i] = '█'; co[i] = ink; }
        else if (((Math.floor(u) + Math.floor(v)) & 1) && Math.abs(fu - 0.5) * lam < 0.8 && Math.abs(fv - 0.5) * lam < 1.2) { ch[i] = '+'; co[i] = dot; }
      }
    }
  } });

// ════════ 幾何隧道：方形、六角、三角、星形、網格、花瓣、光環航道 ════════
const TUBE_POLY = { square: [4, 0], hex: [6, 0], tri: [3, Math.PI / 2], grid: [4, 0] };
const POW14 = new Float32Array(257); for (let i = 0; i <= 256; i++) POW14[i] = Math.pow(i / 256, 1.4);
A({ id: 'ge-tube', name: '幾何隧道', cat: '幾何', theme: 'cyber', desc: '穿過一圈圈方框組成的線框隧道',
  params: { shape: 'square' },
  variants: [
    { id: 'hex', name: '六角隧道', theme: 'gold', desc: '六角形框架一層層迎面而來', params: { shape: 'hex' } },
    { id: 'tri', name: '三角隧道', theme: 'blood', desc: '旋轉的三角框架向深處延伸', params: { shape: 'tri' } },
    { id: 'star', name: '星形隧道', theme: 'neon', hue: true, desc: '五角星形的彩色光圈不斷湧出', params: { shape: 'star' } },
    { id: 'grid', name: '網格隧道', theme: 'blueprint', desc: '牆面布滿格線的方形長廊', params: { shape: 'grid' } },
    { id: 'petal', name: '花瓣漩渦', theme: 'sunset', desc: '花瓣形截面帶著螺旋條紋', params: { shape: 'petal' } },
    { id: 'gates', name: '光環航道', theme: 'ice', desc: '沿彎曲航道飛越一個個光環', params: { shape: 'gates' } },
  ],
  init(s, f) { worldXY(s, f); s.RH = new Float32Array(f.cols * f.rows); },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H } = f, sh = f.p.shape, n = g.n, WX = s.WX, WY = s.WY, M = s.M, ch = g.ch, co = g.co;
    if (sh === 'gates') return this.gates(s, f);
    const cx = cols * 0.13 * Math.sin(t * 0.37), cy = rows * aspect * 0.1 * Math.sin(t * 0.53 + 0.7);
    const rot = t * 0.12 + 0.5 * Math.sin(t * 0.21), Kd = M * 0.5, spd = t * 1.15, hole = M * 0.025;
    const poly = TUBE_POLY[sh];
    if (poly) {
      const N = poly[0], nc = [], ns = [], fch = [];
      const rr = sh === 'grid' ? rot * 0.25 : rot;
      for (let k = 0; k < N; k++) { const a = poly[1] + rr + (k * TAU) / N; nc.push(Math.cos(a)); ns.push(Math.sin(a)); fch.push(dirCh(-Math.sin(a), Math.cos(a))); }
      const grid = sh === 'grid', ringTh = grid ? 0.07 : 0.1, side = 2 * Math.tan(Math.PI / N);
      for (let i = 0; i < n; i++) {
        const dx = WX[i] - cx, dy = WY[i] - cy;
        let d1 = -1e9, d2 = -1e9, k1 = 0, k2 = 0;
        for (let k = 0; k < N; k++) { const d = dx * nc[k] + dy * ns[k]; if (d > d1) { d2 = d1; k2 = k1; d1 = d; k1 = k; } else if (d > d2) { d2 = d; k2 = k; } }
        if (d1 < hole) continue;
        const z = Kd / d1, w = z + spd, fw = w - Math.floor(w), e = clamp(1.3 / (0.3 + z * 0.33), 0.08, 1);
        const th = Math.min(Math.max(ringTh, (z * 1.1) / d1), (z * 2.4) / d1);
        if (th > 0.42) continue;
        if (fw < th || (grid && (z * 1.1) / d1 < 0.1 && (w * 2 - Math.floor(w * 2)) < Math.min(th * 2, (z * 2.2) / d1))) {
          const major = fw < th;
          ch[i] = d1 - d2 < 0.7 ? '+' : fch[k1]; co[i] = C(major ? e : e * 0.55);
          continue;
        }
        if (d1 - d2 < 0.75 * Math.max(0.6, 1 / (1 + z * 0.05))) { const ax = nc[k1] + nc[k2], ay = ns[k1] + ns[k2]; ch[i] = dirCh(ax, ay); co[i] = C(e * 0.8); continue; }
        if (grid) {
          const pp = (dx * -ns[k1] + dy * nc[k1]) / (d1 * side) + 0.5, q = pp * 3 - Math.floor(pp * 3);
          if (q < 0.06 * (1 + d1 / M * 2) || q > 1 - 0.06 * (1 + d1 / M * 2)) { ch[i] = dirCh(dx, dy); co[i] = C(e * 0.5); continue; }
        }
        if (fw > 0.5 && fw < 0.5 + ringTh * 0.5 && !grid) { ch[i] = '.'; co[i] = C(e * 0.35); }
      }
      return;
    }
    // 極座標形狀：星形或花瓣
    const star = sh === 'star', NS = star ? 5 : 6, amp = 0.2, seg = TAU / NS, hs = seg / 2, q = 0.48, qs = q * Math.sin(hs), ph0 = t * 0.5 - NS * rot, i6 = 6 / TAU;
    for (let i = 0; i < n; i++) {
      const dx = WX[i] - cx, dy = WY[i] - cy, r = Math.sqrt(dx * dx + dy * dy);
      if (r < hole) continue;
      const a = fatan2(dy, dx);
      let rho;
      if (star) { let fa = a - rot - Math.PI / 2; fa -= seg * Math.floor(fa / seg); if (fa > hs) fa = seg - fa; rho = r / (qs / (fsin(fa) - q * fsin(fa - hs))); }
      else rho = r / (1 + amp * fcos(NS * a + ph0));
      const z = Kd / rho, w = z + spd, e = clamp(1.3 / (0.3 + z * 0.33), 0.08, 1);
      if (star) {
        const fw = w - Math.floor(w), th = Math.min(Math.max(0.13, (z * 1.3) / rho), (z * 2.6) / rho);
        if (th > 0.45) continue;
        if (fw < th) { ch[i] = fw < th * 0.5 ? '*' : '+'; co[i] = H(Math.floor(w) * 47, e); }
        else if ((Math.floor(w) & 1) && ((i + (i / cols | 0)) & 1)) { ch[i] = '.'; co[i] = H(Math.floor(w) * 47, e * 0.4); }
      } else {
        const sp = w * 1.5 + a * i6 + fsin(z * 0.4 - t) * 0.2, fs = sp - Math.floor(sp), band = 1 - Math.abs(fs - 0.5) * 2;
        const v = POW14[(band * 256) | 0] * e;
        if (v < 0.07) continue;
        ch[i] = rc(RS, v); co[i] = C(v);
      }
    }
  },
  gates(s, f) {
    const { g, cols, rows, aspect, t, C } = f, M = s.M, F = M * 0.9, tr = t * 2.2, K = 15;
    const path = z => [Math.sin(z * 0.23) * 3.2 + Math.sin(z * 0.11) * 2, Math.sin(z * 0.17 + 1) * 2.2];
    // 相機沿著航道的切線方向看：近的光環留在畫面中央，只有遠的光環隨彎道偏移
    const p0 = path(tr), p1 = path(tr + 0.5), tx = (p1[0] - p0[0]) / 0.5, ty = (p1[1] - p0[1]) / 0.5, Rw = 1.4, frac = tr - Math.floor(tr);
    for (let k = K; k >= 1; k--) {
      const z = k - frac, zi = Math.floor(tr) + k, pz = path(tr + z);
      if (z < 0.6) continue;
      const ox = pz[0] - p0[0] - tx * z, oy = pz[1] - p0[1] - ty * z, sx = cols / 2 + (ox * F) / z, sy = rows / 2 + (oy * F) / z / aspect, rr = (Rw * F) / z;
      const e = clamp(1.6 / (0.4 + z * 0.3), 0.1, 1), hexg = zi % 3 === 0, sides = hexg ? 6 : 0, spin = zi * 0.5 + t * 0.3;
      const np = Math.ceil(TAU * rr * 1.2) + 12;
      for (let j = 0; j < np; j++) {
        const a = (j / np) * TAU;
        let rad = rr;
        if (sides) { const seg = TAU / sides, aa = (((a - spin) % seg) + seg) % seg - seg / 2; rad = (rr * Math.cos(Math.PI / sides)) / Math.cos(aa); }
        const x = sx + Math.cos(a) * rad, y = sy + (Math.sin(a) * rad) / aspect;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        g.set(x, y, z < 1.1 ? '#' : dirCh(-Math.sin(a), Math.cos(a)), C(e));
      }
      if (zi % 2 === 0) for (let q = 0; q < 4; q++) { const a = spin + q * (Math.PI / 2); g.set(sx + Math.cos(a) * rr * 0.92, sy + (Math.sin(a) * rr * 0.92) / aspect, 'o', C(e)); }
    }
    // 遠方的航道中心光點
    for (let k = 20; k < 60; k += 2) {
      const z = k - frac, pz = path(tr + z), x = cols / 2 + ((pz[0] - p0[0] - tx * z) * F) / z, y = rows / 2 + ((pz[1] - p0[1] - ty * z) * F) / z / aspect;
      g.set(x, y, '.', C(0.25));
    }
  } });

// ════════ 多面體：自動求凸包的正多面體、星形八面體、網格球、環面結、莫比烏斯帶 ════════
const PHI = (1 + Math.sqrt(5)) / 2;
const v3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const v3cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const v3norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// 暴力求凸包三角形（點數少，只在初始化時做一次），法向量朝外
function hullTris(V) {
  const T = [], n = V.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const nm = v3cross(v3sub(V[j], V[i]), v3sub(V[k], V[i]));
    if (Math.hypot(nm[0], nm[1], nm[2]) < 1e-6) continue;
    let pos = 0, neg = 0;
    for (let m = 0; m < n; m++) { const d = v3dot(nm, v3sub(V[m], V[i])); if (d > 1e-6) pos++; else if (d < -1e-6) neg++; }
    if (pos && neg) continue;
    T.push(pos ? [i, k, j] : [i, j, k]);
  }
  return T;
}
function shortEdges(V) {
  let mn = 1e9; const E = [];
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) mn = Math.min(mn, Math.hypot(...v3sub(V[i], V[j])));
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (Math.hypot(...v3sub(V[i], V[j])) < mn * 1.01) E.push([i, j]);
  return E;
}
function polyMesh(kind) {
  let V;
  if (kind === 'tetra') V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  else if (kind === 'octa') V = [[1.3, 0, 0], [-1.3, 0, 0], [0, 1.3, 0], [0, -1.3, 0], [0, 0, 1.3], [0, 0, -1.3]];
  else if (kind === 'ico' || kind === 'geo') { V = []; for (const a of [-1, 1]) for (const b of [-1, 1]) V.push([0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]); }
  else if (kind === 'dodeca') {
    const ip = 1 / PHI; V = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) { for (const c of [-1, 1]) V.push([a, b, c]); V.push([0, a * ip, b * PHI], [a * ip, b * PHI, 0], [a * PHI, 0, b * ip]); }
  }
  if (kind === 'stella') {
    const A = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], B = A.map(p => [-p[0], -p[1], -p[2]]);
    const TA = hullTris(A), TB = hullTris(B).map(t => t.map(i => i + 4));
    return { V: A.concat(B), T: TA.concat(TB), E: shortEdges(A).concat(shortEdges(B).map(e => [e[0] + 4, e[1] + 4])), grp: TA.map(() => 0).concat(TB.map(() => 1)) };
  }
  const T = hullTris(V), E = shortEdges(V);
  if (kind !== 'geo') return { V, T, E };
  // 網格球（測地線球）：每個三角形切成四塊，頂點推到球面上
  const mid = new Map(), VV = V.map(v3norm), TT = [];
  const m = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if (!mid.has(k)) { VV.push(v3norm([(VV[a][0] + VV[b][0]) / 2, (VV[a][1] + VV[b][1]) / 2, (VV[a][2] + VV[b][2]) / 2])); mid.set(k, VV.length - 1); } return mid.get(k); };
  for (const [a, b, c] of T) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); TT.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); }
  const EE = []; for (const [a, b, c] of TT) { if (a < b) EE.push([a, b]); if (b < c) EE.push([b, c]); if (c < a) EE.push([c, a]); }
  return { V: VV.map(v => v.map(x => x * 1.6)), T: TT, E: EE, smooth: true, geo: true };
}
function paramMesh(kind, nu, nv) {
  const V = [], UV = [], T = [];
  const P = kind === 'knot'
    ? (u, v) => { // (2,3) 環面結的管子
      const c = (uu) => { const r = 1 + 0.45 * Math.cos(3 * uu); return [r * Math.cos(2 * uu), r * Math.sin(2 * uu), 0.45 * Math.sin(3 * uu)]; };
      const p0 = c(u), p1 = c(u + 0.001), tg = v3norm(v3sub(p1, p0)), up = v3norm(v3cross(tg, [0, 0, 1])), bn = v3cross(tg, up), rr = 0.24;
      return [p0[0] + rr * (Math.cos(v) * up[0] + Math.sin(v) * bn[0]), p0[1] + rr * (Math.cos(v) * up[1] + Math.sin(v) * bn[1]), p0[2] + rr * (Math.cos(v) * up[2] + Math.sin(v) * bn[2])];
    }
    : (u, v) => { const w = (v / Math.PI - 1) * 0.55, r = 1.2 + w * Math.cos(u / 2); return [r * Math.cos(u), r * Math.sin(u), w * Math.sin(u / 2) * 1.2]; };
  const closedV = kind === 'knot';
  const nvv = closedV ? nv : nv + 1;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nvv; j++) { const u = (i / nu) * TAU, v = closedV ? (j / nv) * TAU : (j / nv) * TAU; V.push(P(u, v)); UV.push([i / nu, j / nv]); }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const i2 = (i + 1) % nu, j2 = closedV ? (j + 1) % nv : j + 1;
    let a = i * nvv + j, b = i2 * nvv + j, c = i2 * nvv + j2, d = i * nvv + j2;
    if (!closedV && i2 === 0) { b = (nv - j) + 0; c = (nv - j2) + 0; } // 莫比烏斯帶接回時要翻面
    T.push([a, b, c], [a, c, d]);
  }
  return { V, T, E: [], UV, smooth: true, twoSided: true, stripes: kind === 'mobius' };
}
A({ id: 'ge-poly', name: '多面體', cat: '幾何', theme: 'cyber', desc: '打光的正二十面體在空中翻滾',
  params: { mesh: 'ico', style: 'solid' },
  variants: [
    { id: 'tetra', name: '正四面體', theme: 'fire', desc: '四個三角面的金字塔翻轉', params: { mesh: 'tetra' } },
    { id: 'octa', name: '線框八面體', theme: 'blueprint', desc: '只有稜線的八面體，背面虛線', params: { mesh: 'octa', style: 'wire' } },
    { id: 'dodeca', name: '正十二面體', theme: 'neon', hue: true, desc: '十二個五邊形各有自己的顏色', params: { mesh: 'dodeca', style: 'hue' } },
    { id: 'stella', name: '星形八面體', theme: 'gold', desc: '兩個四面體交錯成八角星', params: { mesh: 'stella' } },
    { id: 'geo', name: '呼吸網格球', theme: 'mint', desc: '八十面網格球表面起伏呼吸', params: { mesh: 'geo' } },
    { id: 'knot', name: '環面結', theme: 'synth', desc: '光滑的三葉結管子緩緩轉動', params: { mesh: 'knot' } },
  ],
  init(s, f) {
    const { cols, rows } = f, p = f.p;
    const big = cols * rows > 6000;
    s.mesh = p.mesh === 'knot' ? paramMesh('knot', big ? 180 : 90, big ? 12 : 8) : p.mesh === 'mobius' ? paramMesh('mobius', big ? 120 : 60, big ? 8 : 5) : polyMesh(p.mesh);
    s.rad = Math.max(...s.mesh.V.map(v => Math.hypot(v[0], v[1], v[2])));
    // 每個三角形的色相取自物體座標的法向量（同一個面的三角形顏色一致）
    s.mesh.fh = s.mesh.T.map(([a, b, c]) => { const V = s.mesh.V, on = v3norm(v3cross(v3sub(V[b], V[a]), v3sub(V[c], V[a]))); return ((Math.atan2(on[1], on[0]) * 57.3 + on[2] * 100 + 720) % 360) | 0; });
    s.zb = new Float32Array(cols * rows);
    const nv = s.mesh.V.length; s.PX = new Float32Array(nv); s.PY = new Float32Array(nv); s.PZ = new Float32Array(nv); s.VX = new Float32Array(nv * 3); s.VI = new Float32Array(nv);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H } = f, p = f.p, me = s.mesh, V = me.V, nv = V.length, zb = s.zb, ch = g.ch, co = g.co;
    zb.fill(0);
    const M = rotM(t * 0.43 + 0.3 * Math.sin(t * 0.2), t * 0.31, t * 0.17), Dz = 4.6, R = Math.min(cols / 2, (rows * aspect) / 2) * 0.92;
    const K = (R * (Dz - s.rad * 0.6)) / s.rad, cx = cols / 2, cy = rows / 2 + Math.sin(t * 0.6) * rows * 0.02;
    const L = v3norm([-0.45, -0.65, -0.62]), Hh = v3norm([L[0], L[1], L[2] - 1]), VX = s.VX;
    for (let k = 0; k < nv; k++) {
      let x = V[k][0], y = V[k][1], z = V[k][2];
      if (me.geo) { const a = 1 + 0.12 * Math.sin(x * 2.6 + t * 1.7) * Math.cos(y * 2.2 - t * 1.3) + 0.06 * Math.sin(z * 4 + t * 2.3); x *= a; y *= a; z *= a; }
      const X = M[0] * x + M[1] * y + M[2] * z, Y = M[3] * x + M[4] * y + M[5] * z, Z = M[6] * x + M[7] * y + M[8] * z;
      VX[k * 3] = X; VX[k * 3 + 1] = Y; VX[k * 3 + 2] = Z;
      const iz = 1 / (Z + Dz); s.PX[k] = cx + K * X * iz; s.PY[k] = cy + (K * Y * iz) / aspect; s.PZ[k] = iz;
    }
    const shade = (nx, ny, nz) => {
      let d = nx * L[0] + ny * L[1] + nz * L[2];
      if (me.twoSided && nz > 0) { d = -d; nx = -nx; ny = -ny; nz = -nz; }
      const sp = Math.max(0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]);
      return clamp(0.1 + 0.72 * Math.max(0, d) + 0.45 * Math.pow(sp, 18), 0, 1);
    };
    if (me.smooth) { // 頂點法向量（相鄰面平均）
      const NX = s.NX || (s.NX = new Float32Array(nv * 3)); NX.fill(0);
      for (const [a, b, c] of me.T) {
        const ux = VX[b * 3] - VX[a * 3], uy = VX[b * 3 + 1] - VX[a * 3 + 1], uz = VX[b * 3 + 2] - VX[a * 3 + 2], wx = VX[c * 3] - VX[a * 3], wy = VX[c * 3 + 1] - VX[a * 3 + 1], wz = VX[c * 3 + 2] - VX[a * 3 + 2];
        const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        for (const q of [a, b, c]) { NX[q * 3] += nx; NX[q * 3 + 1] += ny; NX[q * 3 + 2] += nz; }
      }
      for (let k = 0; k < nv; k++) { const n3 = v3norm([NX[k * 3], NX[k * 3 + 1], NX[k * 3 + 2]]); s.VI[k] = shade(n3[0], n3[1], n3[2]); }
    }
    const wire = p.style === 'wire', P0 = [0, 0, 0, 0, 0, 0], P1 = [0, 0, 0, 0, 0, 0], P2 = [0, 0, 0, 0, 0, 0];
    let curCh = '', curE = 0, curHue = 0;
    const plotFlat = (i, a) => { if (wire) return; ch[i] = curCh; co[i] = p.style === 'hue' ? H(curHue, curE) : C(curE); };
    const plotSmooth = (i, a, u, v) => {
      let e = a;
      if (me.stripes) { const q = u * 24 - Math.floor(u * 24); if (q < 0.5) e *= 0.62; }
      ch[i] = RL[Math.min(11, (e * 12) | 0)]; co[i] = C(e);
    };
    for (let ti = 0; ti < me.T.length; ti++) {
      const [a, b, c] = me.T[ti];
      const ux = VX[b * 3] - VX[a * 3], uy = VX[b * 3 + 1] - VX[a * 3 + 1], uz = VX[b * 3 + 2] - VX[a * 3 + 2], wx = VX[c * 3] - VX[a * 3], wy = VX[c * 3 + 1] - VX[a * 3 + 1], wz = VX[c * 3 + 2] - VX[a * 3 + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      // 背面剔除（視線方向 = 頂點位置 + 相機距離）
      const vd = nx * VX[a * 3] + ny * VX[a * 3 + 1] + nz * (VX[a * 3 + 2] + Dz);
      if (vd > 0 && !me.twoSided) continue;
      P0[0] = s.PX[a]; P0[1] = s.PY[a]; P0[2] = s.PZ[a]; P1[0] = s.PX[b]; P1[1] = s.PY[b]; P1[2] = s.PZ[b]; P2[0] = s.PX[c]; P2[1] = s.PY[c]; P2[2] = s.PZ[c];
      if (me.smooth && !me.geo) {
        P0[3] = s.VI[a]; P1[3] = s.VI[b]; P2[3] = s.VI[c];
        if (me.UV) { P0[4] = me.UV[a][0]; P1[4] = me.UV[b][0]; P2[4] = me.UV[c][0]; if (P1[4] < P0[4] - 0.5) P1[4] += 1; if (P2[4] < P0[4] - 0.5) P2[4] += 1; if (P0[4] < P1[4] - 0.5) P0[4] += 1; }
        raster(zb, cols, rows, P0, P1, P2, plotSmooth);
      } else {
        curE = shade(nx, ny, nz); curCh = RL[Math.min(11, (curE * 12) | 0)];
        curHue = me.fh[ti];
        if (me.grp && me.grp[ti]) { curE = clamp(curE * 0.8 + 0.05, 0, 1); curCh = RL[Math.min(11, (curE * 12) | 0)]; }
        raster(zb, cols, rows, P0, P1, P2, plotFlat);
      }
    }
    // 稜線：深度測試後，看得見的畫亮線，被擋住的（線框模式）畫虛線
    if (me.E.length) {
      const E = me.E, lineC = me.geo ? C(0.7) : C(1), dimC = C(0.3);
      for (const [a, b] of E) {
        const x0 = s.PX[a], y0 = s.PY[a], x1 = s.PX[b], y1 = s.PY[b], z0 = s.PZ[a], z1 = s.PZ[b];
        const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.5) || 1, c1 = dirCh(x1 - x0, (y1 - y0) * aspect);
        for (let k = 0; k <= n; k++) {
          const u = k / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const i = (y | 0) * cols + (x | 0), iz = z0 + (z1 - z0) * u;
          if (iz >= zb[i] * 0.985) { ch[i] = c1; co[i] = lineC; }
          else if (wire && (k & 1)) { ch[i] = '·'; co[i] = dimC; }
        }
      }
      if (wire) for (let k = 0; k < nv; k++) g.set(s.PX[k], s.PY[k], 'O', lineC);
    }
  } });

// ════════ 波浪網格：3D 曲面（線框、實體、點陣）與山脊線 ════════
const MESH_H = {
  ripple(x, z, t) { const r = Math.hypot(x, z); return 0.32 * Math.cos(r * 9 - t * 2.4) * Math.exp(-r * 1.1); },
  saddle(x, z, t) { return 0.42 * (x * x - z * z) * Math.sin(t * 0.35) + 0.12 * Math.sin(x * 3 + t) * Math.cos(z * 3 - t * 0.7); },
  interf(x, z, t) { const a = Math.hypot(x - 0.55, z - 0.3), b = Math.hypot(x + 0.5, z + 0.35); return 0.1 * (Math.cos(a * 13 - t * 3) + Math.cos(b * 13 - t * 3)); },
  terrain(x, z, t, s) { const h = Noise.fbm(x * 1.4 + 3, (z + s.fly) * 1.4, 0.5, 4) * 0.9 + 0.1; return Math.max(h, -0.08); },
  crate(x, z, t) { return 0.2 * Math.sin(x * 4.5 + t) * Math.cos(z * 4.5 + t * 0.7) + 0.08 * Math.sin((x + z) * 7 - t * 1.6); },
  flag(x, z, t) { const k = (x + 1.4) / 2.8; return (0.16 * Math.sin(x * 3.6 - t * 3) + 0.05 * Math.sin(x * 7 + z * 4 - t * 4.2)) * (0.15 + k); },
};
A({ id: 'ge-mesh', name: '波浪網格', cat: '幾何', theme: 'matrix', desc: '線框曲面上，漣漪由中心擴散',
  params: { fn: 'ripple', style: 'grid' },
  variants: [
    { id: 'ridge', name: '山脊線', theme: 'sunset', desc: '一層層山稜線由遠而近推進', params: { fn: 'ridge', style: 'ridge' } },
    { id: 'saddle', name: '馬鞍面', theme: 'amber', desc: '實體打光的馬鞍面翻來覆去', params: { fn: 'saddle', style: 'solid' } },
    { id: 'interf', name: '雙波面', theme: 'ocean', desc: '兩個波源在網格上交錯起伏', params: { fn: 'interf', style: 'grid' } },
    { id: 'terrain', name: '飛越山谷', theme: 'forest', hue: true, desc: '低空飛過起伏的山谷與湖泊', params: { fn: 'terrain', style: 'solid' } },
    { id: 'dots', name: '點陣曲面', theme: 'synth', hue: true, desc: '蛋盒狀曲面只用點畫出', params: { fn: 'crate', style: 'dots' } },
    { id: 'flag', name: '飄揚布面', theme: 'sunset', desc: '一面條紋布在風中飄動', params: { fn: 'flag', style: 'flag' } },
  ],
  init(s, f) {
    const { cols, rows } = f, big = cols * rows > 6000, st = f.p.style;
    s.N = st === 'dots' ? (big ? 64 : 34) : st === 'flag' ? (big ? 44 : 22) : st === 'grid' ? (big ? 26 : 13) : big ? 44 : 24;
    if (f.p.fn === 'terrain') s.N = big ? 40 : 24;
    // 地形分兩段：近處細格、遠處粗格（NZ2 排），各自對齊世界格點
    s.NZ = f.p.fn === 'terrain' ? Math.round(s.N * 1.2) : s.N; s.NZ2 = f.p.fn === 'terrain' ? Math.round(s.N * 0.32) : 0;
    s.zb = new Float32Array(cols * rows); s.fly = 0;
    const nv = (s.N + 1) * (s.NZ + 1 + (s.NZ2 ? s.NZ2 + 1 : 0));
    s.XS = new Float32Array(nv); s.DD = new Float32Array(s.NZ + s.NZ2 + 2);
    s.PX = new Float32Array(nv); s.PY = new Float32Array(nv); s.PZ = new Float32Array(nv); s.HE = new Float32Array(nv); s.LI = new Float32Array(nv);
    s.top = new Float32Array(cols);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, C, H } = f, p = f.p;
    if (p.style === 'ridge') return this.ridge(s, f);
    if (p.fn === 'terrain') return this.terrain(s, f);
    const N = s.N, fn = MESH_H[p.fn], zb = s.zb, ch = g.ch, co = g.co, flag = p.style === 'flag';
    zb.fill(0); s.fly += dt * 0.35;
    const yaw = flag ? 0.35 * Math.sin(t * 0.15) - 0.15 : t * 0.13, pitch = flag ? 0.12 : 0.55;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // 相機在上方往下看：遠處（z1 大）在畫面上方、近處在下方
    const D = flag ? 3.4 : 3.1, ext = flag ? 1.4 : 1.25, cx = cols / 2;
    const K = flag ? Math.min(cols, rows * aspect * 1.6) * 0.95 : Math.min(cols * 0.78, rows * aspect * 1.1);
    const cy = flag ? rows / 2 : rows / 2 - (0.19 * K) / aspect;
    const L = v3norm([-0.5, 0.75, -0.45]), eps = 0.02;
    for (let j = 0, k = 0; j <= N; j++) for (let i = 0; i <= N; i++, k++) {
      const x = (i / N * 2 - 1) * ext, z = (j / N * 2 - 1) * (flag ? 0.85 : ext);
      let wx, wy, wz, nx, ny, nz;
      if (flag) {
        const d = fn(x, z, t, s), dx = (fn(x + eps, z, t, s) - d) / eps, dz = (fn(x, z + eps, t, s) - d) / eps;
        wx = x; wy = -z; wz = d; nx = -dx; ny = dz; nz = -1; s.HE[k] = z;
      } else {
        const h = fn(x, z, t, s), dx = (fn(x + eps, z, t, s) - h) / eps, dz = (fn(x, z + eps, t, s) - h) / eps;
        wx = x; wy = h; wz = z; nx = -dx; ny = 1; nz = -dz; s.HE[k] = h;
      }
      const nl = Math.hypot(nx, ny, nz); s.LI[k] = clamp(0.12 + 0.88 * Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / nl), 0, 1);
      const x1 = wx * cyw - wz * syw, z1 = wx * syw + wz * cyw, y2 = wy * cp + z1 * sp, z2 = -wy * sp + z1 * cp + D;
      const iz = 1 / Math.max(0.2, z2);
      s.PX[k] = cx + K * x1 * iz; s.PY[k] = cy - (K * y2 * iz) / aspect; s.PZ[k] = iz;
    }
    if (p.style === 'dots') {
      for (let k = 0; k < s.PX.length; k++) {
        const x = s.PX[k], y = s.PY[k]; if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = (y | 0) * cols + (x | 0), iz = s.PZ[k];
        if (iz <= zb[i]) continue; zb[i] = iz;
        const e = clamp((iz - 1 / 4.6) / (1 / 2 - 1 / 4.6), 0.1, 1);
        ch[i] = e > 0.75 ? 'O' : e > 0.5 ? 'o' : e > 0.3 ? '·' : '.'; co[i] = H(s.HE[k] * 500 + 200 + t * 10, 0.25 + 0.75 * e);
      }
      return;
    }
    const grid = p.style === 'grid', terr = false, P0 = [0, 0, 0, 0, 0, 0], P1 = [0, 0, 0, 0, 0, 0], P2 = [0, 0, 0, 0, 0, 0];
    const plotBlank = () => {};
    const plotSolid = (i, a, u, v) => {
      let e = a, hue = 0;
      if (terr) { const h = v; hue = h < -0.07 ? 210 : h < 0.12 ? 110 - h * 200 : h < 0.32 ? 35 : 0; if (h < -0.07) e = 0.35 + 0.25 * Math.sin(u * 3 + t * 2); if (h >= 0.32) e = Math.min(1, e + 0.25); }
      if (flag) { const q = v * 3 - Math.floor(v * 3); if (Math.floor(v * 3) === 1) e *= 0.55; if (q < 0.04) e *= 0.6; }
      ch[i] = RL[Math.min(11, (e * 12) | 0)]; co[i] = terr ? (hue === 0 ? C(e) : H(hue, e)) : C(e);
    };
    const W = N + 1;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * W + i, b = a + 1, c = a + W + 1, d = a + W;
      for (const [q0, q1, q2] of [[a, b, c], [a, c, d]]) {
        P0[0] = s.PX[q0]; P0[1] = s.PY[q0]; P0[2] = s.PZ[q0]; P0[3] = s.LI[q0];
        P1[0] = s.PX[q1]; P1[1] = s.PY[q1]; P1[2] = s.PZ[q1]; P1[3] = s.LI[q1];
        P2[0] = s.PX[q2]; P2[1] = s.PY[q2]; P2[2] = s.PZ[q2]; P2[3] = s.LI[q2];
        if (grid) raster(zb, cols, rows, P0, P1, P2, plotBlank);
        else {
          P0[4] = q0 % W; P1[4] = q1 % W; P2[4] = q2 % W; P0[5] = s.HE[q0]; P1[5] = s.HE[q1]; P2[5] = s.HE[q2];
          if (flag) { P0[5] = (s.HE[q0] / 0.85 + 1) / 2; P1[5] = (s.HE[q1] / 0.85 + 1) / 2; P2[5] = (s.HE[q2] / 0.85 + 1) / 2; }
          raster(zb, cols, rows, P0, P1, P2, plotSolid);
        }
      }
    }
    if (grid) { // 有深度測試的格線：被前面擋住的部分不畫
      const seg = (q0, q1) => {
        const x0 = s.PX[q0], y0 = s.PY[q0], x1 = s.PX[q1], y1 = s.PY[q1], z0 = s.PZ[q0], z1 = s.PZ[q1];
        const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.3) || 1, c1 = dirCh(x1 - x0, (y1 - y0) * aspect), col = C(0.25 + 0.75 * (s.LI[q0] + s.LI[q1]) * 0.5);
        for (let k = 0; k <= n; k++) {
          const u = k / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const i = (y | 0) * cols + (x | 0);
          if (z0 + (z1 - z0) * u >= zb[i] * 0.975) { ch[i] = c1; co[i] = col; }
        }
      };
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const a = j * W + i; if (i < N) seg(a, a + 1); if (j < N) seg(a, a + W); }
    }
    if (flag) { const x = s.PX[0], y0 = s.PY[0]; for (let y = Math.max(0, Math.floor(Math.min(y0, s.PY[N * W]) - 1)); y < rows; y++) g.set(x - 1, y, '|', C(0.6)); }
  },
  // 飛越山谷：相機固定高度往前飛，網格排成視錐形（每一排都橫跨整個畫面），遠處漸暗，地平線上有遠山與星星
  terrain(s, f) {
    const { g, cols, rows, aspect, t, dt, C, H } = f, ch = g.ch, co = g.co, zb = s.zb, NX = s.N, W = NX + 1;
    const HE = s.HE, LI = s.LI, PX = s.PX, PY = s.PY, PZ = s.PZ, XS = s.XS, DD = s.DD;
    zb.fill(0); s.fly += dt * 0.45;
    const Hc = 0.75, pitch = 0.3, cp = Math.cos(pitch), sp = Math.sin(pitch), K = rows * aspect, cx = cols / 2, cy = rows * 0.41;
    const roll = 0.07 * Math.sin(t * 0.06), cr = Math.cos(roll), sr = Math.sin(roll), xo = 1.5 * Math.sin(t * 0.04);
    const Ln = 0.12, L1 = 6, dz1 = (L1 - Ln) / s.NZ, dz2 = dz1 * 4, Lf = L1 - dz1 + s.NZ2 * dz2, hw0 = (cols / 2 / K) * 1.15;
    const La = -0.7, Lb = 0.6, Lc = 0.25, Ll = Math.hypot(La, Lb, Lc);
    const P0 = [0, 0, 0, 0, 0, 0], P1 = [0, 0, 0, 0, 0, 0], P2 = [0, 0, 0, 0, 0, 0];
    const plot = (i, a, u, v) => {
      let e = a, hue;
      if (v < -0.07) { hue = 210; e = a * (0.75 + 0.35 * Math.sin(u * 3 + t * 2)); }
      else if (v < 0.12) hue = 110 - v * 200;
      else if (v < 0.36) hue = 35;
      else { e = Math.min(1, e + 0.2); hue = -1; }
      e = clamp(e, 0.04, 1);
      ch[i] = RL[Math.min(11, (e * 12) | 0)]; co[i] = hue < 0 ? C(e) : H(hue, e);
    };
    const set = (P, q, bias) => { P[0] = PX[q]; P[1] = PY[q]; P[2] = PZ[q] * bias; P[3] = LI[q]; P[4] = q % W; P[5] = HE[q]; };
    // 兩段網格：每一排的世界 z 固定在格點上，往前捲動時地形不會晃動；遠段稍微讓深度，接縫處由近段蓋住
    for (let band = 0; band < 2; band++) {
      const NZ = band ? s.NZ2 : s.NZ, dz = band ? dz2 : dz1, d0 = band ? L1 - dz1 : Ln, base = band ? (s.NZ + 1) * W : 0, jb = band ? s.NZ + 1 : 0;
      const m0 = Math.floor(s.fly / dz), fr = s.fly / dz - m0, bias = band ? 0.97 : 1;
      for (let j = 0, k = base; j <= NZ; j++) {
        const d = d0 + (j - fr) * dz, zw = d0 + (m0 + j) * dz, hw = hw0 * (d * cp + Hc * sp) + 0.05;
        DD[jb + j] = d;
        for (let i = 0; i <= NX; i++, k++) {
          const x = (i / NX * 2 - 1) * hw;
          const h = Noise.fbm((x + xo) * 1.4 + 3, zw * 1.4, 0.5, band ? 3 : 4) * 0.9 + 0.1;
          HE[k] = h < -0.08 ? -0.08 : h; XS[k] = x;
        }
      }
      for (let j = 0, k = base; j <= NZ; j++) {
        const d = DD[jb + j], fog = clamp((Lf - d) / (Lf * 0.6), 0, 1), jm = j > 0 ? -W : 0, jp = j < NZ ? W : 0;
        for (let i = 0; i <= NX; i++, k++) {
          const im = i > 0 ? -1 : 0, ip = i < NX ? 1 : 0;
          const hx = (HE[k + ip] - HE[k + im]) / (XS[k + ip] - XS[k + im] || 1), hz = (HE[k + jp] - HE[k + jm]) / (((jp - jm) / W) * dz || 1);
          const nl = Math.hypot(hx, 1, hz), dl = (-hx * La + Lb - hz * Lc) / (nl * Ll);
          LI[k] = clamp(0.12 + 0.88 * Math.max(0, dl), 0, 1) * (0.2 + 0.8 * fog);
          const y = HE[k] - Hc, y2 = y * cp + d * sp, iz = 1 / Math.max(0.15, d * cp - y * sp);
          const px = K * XS[k] * iz, py = K * y2 * iz;
          PX[k] = cx + px * cr - py * sr; PY[k] = cy - (px * sr + py * cr) / aspect; PZ[k] = iz;
        }
      }
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const a = base + j * W + i, b = a + 1, c = a + W + 1, d = a + W;
        set(P0, a, bias); set(P1, b, bias); set(P2, c, bias); raster(zb, cols, rows, P0, P1, P2, plot);
        set(P1, c, bias); set(P2, d, bias); raster(zb, cols, rows, P0, P1, P2, plot);
      }
    }
    // 地平線上的遠山剪影與星星（只畫在沒有地形的格子）
    const top = s.top, Yh0 = (K * Math.tan(pitch)) / cr, tr = Math.tan(roll), rim = H(225, 0.36), hz1 = H(225, 0.16), hz2 = H(225, 0.26);
    for (let x = 0; x < cols; x++) { const X = x + 0.5 - cx; top[x] = cy - (X * tr + Yh0 + K * (0.008 + 0.075 * clamp(0.45 + Noise.fbm(X / K * 3.4 + xo * 0.15 + 7.3, 1.7, 0.2, 3) * 1.6, 0, 1))) / aspect; }
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      if (zb[i] > 0) continue;
      const tp = top[x];
      if (y >= tp) {
        if (y < tp + 1) { const sl = (x + 1 < cols ? top[x + 1] : tp) - (x > 0 ? top[x - 1] : tp); ch[i] = sl < -0.7 ? '/' : sl > 0.7 ? '\\' : tp - Math.floor(tp) < 0.5 ? '-' : '_'; co[i] = rim; continue; }
        // 遠山的霧氣：越往下越濃的點
        const q = (y - tp) / (rows * 0.12), hh = hash2(x * 0.77, y * 1.91);
        if (hh < 0.1 + 0.4 * Math.min(1, q)) { ch[i] = hh < 0.1 ? ':' : '.'; co[i] = hh < 0.1 ? hz2 : hz1; }
      } else {
        const hh = hash2(x * 1.3, y * 2.7);
        if (hh > 0.992) { const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + hh * 900); ch[i] = tw > 0.85 ? '+' : '.'; co[i] = C(0.25 + 0.4 * tw); }
      }
    }
  },
  ridge(s, f) {
    const { g, cols, rows, t, C } = f, top = s.top, nl = rows >= 50 ? 26 : 11, sp = (rows * 0.68) / nl, base = rows * 0.3, amp = rows * 0.3;
    const cur = s.cur || (s.cur = new Float32Array(cols)), iw = 1 / cols;
    top.fill(1e9);
    const off = (t * 0.4) % 1, first = Math.floor(t * 0.4);
    for (let k = 0; k <= nl; k++) { // k=0 為最前面；前面的線先畫，後面的線只畫在露出來的部分
      const id = first + nl - k, y0 = base + (nl - k + off) * sp;
      if (y0 > rows + amp * 0.3) continue;
      const fade = clamp(1.1 - (k / nl) * 0.85 - (k === nl ? (1 - off) * 0.2 : 0), 0.12, 1), col = C(fade);
      for (let x = 0; x < cols; x++) {
        const u = x * iw;
        // 橫跨整個畫面的山脈：大範圍起伏 × 山峰細節
        const env = 0.3 + 0.7 * clamp(0.55 + 1.3 * Noise.n3(u * 2.2 + 5.1, id * 0.07, 2.7), 0, 1);
        const h = env * clamp(0.2 + 0.8 * (0.5 + Noise.n3(u * 9 + id * 3.7, id * 0.61, t * 0.05) * 0.95) + 0.12 * Noise.n3(u * 40, id * 1.3, 0.5), 0, 1.1);
        cur[x] = y0 - h * amp;
      }
      for (let x = 0; x < cols; x++) {
        const y = cur[x];
        if (y >= top[x]) continue;
        const yn = x + 1 < cols ? cur[x + 1] : y, slope = yn - y, as = Math.abs(slope), iy = Math.floor(y);
        if (iy >= 0 && iy < rows) g.set(x, iy, as < 0.4 ? (y - iy < 0.5 ? '-' : '_') : as <= 1.3 ? (slope < 0 ? '/' : '\\') : '|', col);
        // 只有陡坡、而且兩端都沒被擋住時才補直線，不會在遮擋處留下短線頭
        if (as > 1.3 && x + 1 < cols && yn < top[x + 1]) {
          const yhi = Math.min(Math.max(y, yn), top[x]);
          for (let yy = Math.floor(Math.min(y, yn)) + 1; yy < yhi; yy++) if (yy >= 0 && yy < rows) g.set(x, yy, '|', col);
        }
      }
      for (let x = 0; x < cols; x++) if (cur[x] < top[x]) top[x] = cur[x];
    }
  } });

// ════════ 融球：等高線、輪廓、正負電荷、液態金屬、細胞分裂、網點、霓虹 ════════
A({ id: 'ge-blob', name: '融球幻影', cat: '幾何', theme: 'lavender', desc: '融合又分開的球體畫成一圈圈等高線',
  params: { mode: 'contour', n: 7 },
  variants: [
    { id: 'outline', name: '輪廓線', theme: 'cyber', desc: '只描出融球邊緣的線條', params: { mode: 'outline', n: 8 } },
    { id: 'charge', name: '正負電荷', theme: 'neon', hue: true, desc: '正負電荷之間的等電位線', params: { mode: 'charge', n: 6 } },
    { id: 'mercury', name: '液態金屬', theme: 'mono', desc: '反光的水銀珠互相吞併', params: { mode: 'mercury', n: 6 } },
    { id: 'mitosis', name: '細胞分裂', theme: 'mint', desc: '細胞一分為二又合而為一', params: { mode: 'mitosis', n: 8 } },
    { id: 'halftone', name: '網點融合', theme: 'gold', desc: '網點大小隨融球起伏', params: { mode: 'halftone', n: 7 } },
    { id: 'neon', name: '霓虹環舞', theme: 'synth', hue: true, desc: '繞圈跳舞的霓虹光環彼此融合', params: { mode: 'neon', n: 9 } },
  ],
  init(s, f) {
    worldXY(s, f);
    const p = f.p, n = f.cols * f.rows;
    s.F = new Float32Array(n);
    s.B = Array.from({ length: p.n }, (_, k) => ({ fx: rnd(0.11, 0.27), fy: rnd(0.09, 0.23), px: rnd(0, TAU), py: rnd(0, TAU), r: rnd(0.085, 0.14), q: k % 2 ? -1 : 1, x: 0, y: 0, r2: 0 }));
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H } = f, p = f.p, mode = p.mode, n = g.n, WX = s.WX, WY = s.WY, M = s.M, F = s.F, ch = g.ch, co = g.co, B = s.B, nb = B.length;
    const W = cols / 2, Hh = (rows * aspect) / 2;
    for (let k = 0; k < nb; k++) {
      const b = B[k];
      if (mode === 'neon') { const a = t * 0.35 + (k / nb) * TAU, rr = M * (0.3 + 0.12 * Math.sin(t * 0.6 + k * 2.1)); b.x = Math.cos(a) * rr * 1.5; b.y = Math.sin(a) * rr * 0.9; }
      else if (mode === 'mitosis') { const pair = k >> 1, side = k & 1 ? 1 : -1, cx = W * 0.62 * Math.sin(t * 0.09 + pair * 2.3), cy = Hh * 0.55 * Math.cos(t * 0.11 + pair * 1.7), sp = M * 0.13 * (0.5 + 0.5 * Math.sin(t * 0.5 + pair * 1.9)), a = t * 0.2 + pair; b.x = cx + side * Math.cos(a) * sp; b.y = cy + side * Math.sin(a) * sp; }
      else { b.x = W * 0.82 * Math.sin(t * b.fx + b.px); b.y = Hh * 0.78 * Math.sin(t * b.fy + b.py); }
      const r = b.r * M * (mode === 'mitosis' ? 0.8 : 1); b.r2 = r * r; b.rr = r;
    }
    if (mode === 'charge') {
      for (let i = 0; i < n; i++) { let v = 0; for (let k = 0; k < nb; k++) { const b = B[k], dx = WX[i] - b.x, dy = WY[i] - b.y; v += (b.q * b.rr) / (Math.sqrt(dx * dx + dy * dy) + 0.8); } F[i] = v; }
      for (let i = 0; i < n; i++) {
        const v = F[i] * 2.2, fr = v - Math.floor(v), d = Math.min(fr, 1 - fr), mag = Math.abs(F[i]);
        const e = d < 0.12 ? (1 - d / 0.12) * clamp(0.35 + mag * 0.5, 0, 1) : mag > 1.6 ? 0.25 : 0;
        if (e < 0.08) continue;
        ch[i] = d < 0.12 ? (d < 0.05 ? '#' : '+') : ':'; co[i] = H(F[i] > 0 ? 8 : 205, clamp(e, 0, 1));
      }
      for (const b of B) g.set(W + b.x, rows / 2 + b.y / aspect, b.q > 0 ? '+' : '-', H(b.q > 0 ? 8 : 205, 1));
      return;
    }
    for (let i = 0; i < n; i++) { let v = 0; const x = WX[i], y = WY[i]; for (let k = 0; k < nb; k++) { const b = B[k], dx = x - b.x, dy = y - b.y; v += b.r2 / (dx * dx + dy * dy + 1); } F[i] = v; }
    if (mode === 'contour') {
      // 等高線：到最近一條等高線的距離 ≈ |u − round(u)| / |∇u|，線寬在畫面上固定；球體內部改成平滑明暗
      const U = s.U || (s.U = new Float32Array(n));
      for (let i = 0; i < n; i++) U[i] = Math.log(F[i] > 0.05 ? F[i] : 0.05) * 3.2;
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        const v = F[i]; if (v < 0.12) continue;
        const u = U[i];
        if (u > 0.5) { const e = clamp(0.16 + u * 0.07, 0, 0.62); ch[i] = rc(RS, e); co[i] = C(e); continue; }
        const gx = (x + 1 < cols ? U[i + 1] : u) - (x > 0 ? U[i - 1] : u), gy = ((y + 1 < rows ? U[i + cols] : u) - (y > 0 ? U[i - cols] : u)) / aspect;
        const k = Math.round(u), d = Math.abs(u - k) / (0.5 * Math.sqrt(gx * gx + gy * gy) + 1e-6);
        if (d >= 0.85) continue;
        const lvl = k === 0 ? 1 : clamp(0.55 + k * 0.07, 0.22, 0.9);
        ch[i] = d < 0.55 ? dirCh(-gy, gx) : '.'; co[i] = C(lvl * (d < 0.55 ? 1 : 0.6));
      }
    } else if (mode === 'outline') {
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        const v = F[i] - 1, vr = x + 1 < cols ? F[i + 1] - 1 : v, vd = y + 1 < rows ? F[i + cols] - 1 : v;
        if (v * vr <= 0 && vr !== v || v * vd <= 0 && vd !== v) {
          const gx = (x + 1 < cols ? F[i + 1] : F[i]) - (x > 0 ? F[i - 1] : F[i]), gy = ((y + 1 < rows ? F[i + cols] : F[i]) - (y > 0 ? F[i - cols] : F[i])) / aspect;
          ch[i] = dirCh(-gy, gx); co[i] = C(1);
        } else if (v > 0 && (x % 4 === 0) && (y % 2 === 0)) { ch[i] = '.'; co[i] = C(0.3 + Math.min(0.4, v * 0.1)); }
      }
    } else if (mode === 'mercury') {
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        const v = F[i]; if (v < 0.8) { if (v > 0.5) { ch[i] = '.'; co[i] = C(0.15); } continue; }
        const gx = (x + 1 < cols ? F[i + 1] : v) - (x > 0 ? F[i - 1] : v), gy = ((y + 1 < rows ? F[i + cols] : v) - (y > 0 ? F[i - cols] : v)) / aspect;
        const h = Math.min(1, (v - 0.8) * 1.2), k = 1.6 / (0.25 + h), nx = -gx * k, ny = -gy * k, nl = Math.hypot(nx, ny, 1), nz = 1 / nl;
        const rx = nx / nl, ry = ny / nl, env = 0.5 + 0.5 * Math.sin(ry * 5 + rx * 2 + t * 0.5), spec = Math.pow(Math.max(0, -rx * 0.5 - ry * 0.6 + nz * 0.62), 14);
        const e = clamp(0.15 + 0.5 * env * nz + 0.7 * spec + (v < 1 ? -0.1 : 0), 0, 1);
        ch[i] = RL[Math.min(11, (e * 12) | 0)]; co[i] = C(e);
      }
    } else if (mode === 'mitosis') {
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        const v = F[i];
        if (v > 0.8 && v < 1.15) { ch[i] = v < 0.95 ? '.' : 'o'; co[i] = C(v < 0.95 ? 0.5 : 0.95); }
        else if (v >= 1.15) { if ((x * 3 + y * 5) % 7 === 0) { ch[i] = ':'; co[i] = C(0.35); } }
        else if (v > 0.45 && (x + y * 2) % 9 === 0) { ch[i] = '.'; co[i] = C(0.15); }
      }
      for (const b of B) { const x = W + b.x, y = rows / 2 + b.y / aspect; g.set(x, y, '@', C(1)); g.set(x - 1, y, '(', C(0.75)); g.set(x + 1, y, ')', C(0.75)); }
    } else if (mode === 'halftone') {
      const R = ' .:oO@';
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        if ((x + (y & 1)) & 1) continue;
        const v = clamp(F[i] * 0.75, 0, 1); if (v < 0.12) continue;
        ch[i] = R[Math.min(5, (v * 6) | 0)]; co[i] = C(0.3 + 0.7 * v);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const v = F[i], d = Math.abs(v - 1), e = Math.exp(-d * 5) * 0.95 + (v > 1 ? 0.06 : 0);
        if (e < 0.1) continue;
        ch[i] = d < 0.08 ? '#' : rc(RS, e); co[i] = H(Math.atan2(WY[i], WX[i]) * 57.3 + t * 30, e);
      }
    }
  } });

// ════════ 沃羅諾伊：會動的分區圖 ════════
// 找每格最近與第二近的種子；每種距離各寫一個迴圈，熱迴圈裡才不會有分支
function vorScan(s, kind, gv) {
  const WX = s.WX, WY = s.WY, n = WX.length, S = s.S, ns = S.length;
  if (!s.K1 || s.K1.length !== n) { s.K1 = new Int16Array(n); s.K2 = new Int16Array(n); s.D1 = new Float32Array(n); s.D2 = new Float32Array(n); s.SX = new Float64Array(128); s.SY = new Float64Array(128); s.SW = new Float64Array(128); }
  const SX = s.SX, SY = s.SY, SW = s.SW, K1 = s.K1, K2 = s.K2, D1 = s.D1, D2 = s.D2;
  for (let k = 0; k < ns; k++) { SX[k] = S[k].x; SY[k] = S[k].y; SW[k] = kind === 4 ? S[k].wt : kind === 5 ? S[k].born : 0; }
  for (let i = 0; i < n; i++) {
    const x = WX[i], y = WY[i];
    let d1 = 1e18, d2 = 1e18, k1 = 0, k2 = 0;
    // 街區/方形距離加一點點另一種距離打破平手，否則兩顆種子在對角線上時邊界會變成一整塊實心三角形
    if (kind === 1) for (let k = 0; k < ns; k++) { const ax = Math.abs(x - SX[k]), ay = Math.abs(y - SY[k]), d = ax + ay + 0.03 * (ax > ay ? ax : ay); if (d < d1) { d2 = d1; k2 = k1; d1 = d; k1 = k; } else if (d < d2) { d2 = d; k2 = k; } }
    else if (kind === 3) for (let k = 0; k < ns; k++) { const ax = Math.abs(x - SX[k]), ay = Math.abs(y - SY[k]), d = (ax > ay ? ax : ay) + 0.03 * (ax + ay); if (d < d1) { d2 = d1; k2 = k1; d1 = d; k1 = k; } else if (d < d2) { d2 = d; k2 = k; } }
    else if (kind === 4) for (let k = 0; k < ns; k++) { const dx = x - SX[k], dy = y - SY[k], d = dx * dx + dy * dy - SW[k]; if (d < d1) { d2 = d1; k2 = k1; d1 = d; k1 = k; } else if (d < d2) { d2 = d; k2 = k; } }
    else if (kind === 5) for (let k = 0; k < ns; k++) { const dx = x - SX[k], dy = y - SY[k], d = SW[k] + Math.sqrt(dx * dx + dy * dy) / gv; if (d < d1) { d2 = d1; k2 = k1; d1 = d; k1 = k; } else if (d < d2) { d2 = d; k2 = k; } }
    else { for (let k = 0; k < ns; k++) { const dx = x - SX[k], dy = y - SY[k], d = dx * dx + dy * dy; if (d < d1) { d2 = d1; k2 = k1; d1 = d; k1 = k; } else if (d < d2) { d2 = d; k2 = k; } } d1 = Math.sqrt(d1); d2 = Math.sqrt(d2); }
    K1[i] = k1; K2[i] = k2; D1[i] = d1; D2[i] = d2;
  }
}
A({ id: 'ge-cells', name: '沃羅諾伊', cat: '幾何', theme: 'ice', desc: '漂移的種子把畫面切成變形的細胞',
  params: { mode: 'cells', metric: 2 },
  variants: [
    { id: 'stained', name: '彩繪玻璃', theme: 'rainbow', hue: true, desc: '鉛條框起的彩色玻璃緩緩流動', params: { mode: 'stained' } },
    { id: 'manhattan', name: '曼哈頓', theme: 'toxic', desc: '用街區距離切出的直角分區', params: { mode: 'cells', metric: 1 } },
    { id: 'cheby', name: '方圓禪庭', theme: 'gold', desc: '方形距離畫出的同心方紋', params: { mode: 'rings', metric: 3 } },
    { id: 'grow', name: '晶體生長', theme: 'mint', desc: '晶核一顆顆冒出、長滿整面', params: { mode: 'grow' } },
    { id: 'foam', name: '泡沫', theme: 'ocean', desc: '大小起伏、互相推擠的泡泡', params: { mode: 'foam' } },
  ],
  init(s, f) {
    worldXY(s, f);
    const { cols, rows, aspect } = f, p = f.p, W = cols / 2, Hh = (rows * aspect) / 2;
    const n = p.mode === 'net' ? clamp(Math.round((cols * rows) / 380), 18, 80) : clamp(Math.round((cols * rows) / 1150), 12, 26);
    s.S = Array.from({ length: n }, (_, k) => ({ x: rnd(-W, W), y: rnd(-Hh, Hh), vx: rnd(-1, 1), vy: rnd(-1, 1), hue: (k * 137.5) % 360, w: rnd(0.6, 1.4), ph: rnd(0, TAU), born: 0 }));
    for (const q of s.S) { const sp = s.M * rnd(0.025, 0.06), a = rnd(0, TAU); q.vx = Math.cos(a) * sp; q.vy = Math.sin(a) * sp; }
    s.gt = 0; if (p.mode === 'grow') this.reseed(s, f);
  },
  reseed(s, f) {
    const W = f.cols / 2, Hh = (f.rows * f.aspect) / 2;
    for (const q of s.S) { q.x = rnd(-W, W); q.y = rnd(-Hh, Hh); q.born = rnd(0, 7); q.hue = rnd(0, 360); }
    const b0 = Math.min(...s.S.map(q => q.born)); for (const q of s.S) q.born -= b0; // 第一顆晶核馬上出現
    s.gt = 0; s.vs = false;
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, C, H } = f, p = f.p, mode = p.mode, n = g.n, WX = s.WX, WY = s.WY, M = s.M, ch = g.ch, co = g.co, S = s.S, ns = S.length;
    const W = cols / 2, Hh = (rows * aspect) / 2;
    if (mode !== 'grow' && mode !== 'crackle') for (const q of S) {
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.x < -W) { q.x = -W; q.vx = Math.abs(q.vx); } else if (q.x > W) { q.x = W; q.vx = -Math.abs(q.vx); }
      if (q.y < -Hh) { q.y = -Hh; q.vy = Math.abs(q.vy); } else if (q.y > Hh) { q.y = Hh; q.vy = -Math.abs(q.vy); }
    }
    if (mode === 'net') return this.net(s, f);
    if (mode === 'crackle') return this.crackle(s, f);
    const met = p.metric, foam = mode === 'foam', grow = mode === 'grow';
    let gv = 0;
    let thr = 0;
    if (grow) {
      // 晶核不動，一輪只需掃描一次；長滿後停留一下（生長紋仍在流動），再從外往內退回去
      s.gt += dt; gv = M * 0.09;
      if (!s.vs) { vorScan(s, 5, gv); s.vs = true; let mx = 0; for (let i = 0; i < n; i++) if (s.D1[i] > mx) mx = s.D1[i]; s.fullAt = mx; }
      const hold = s.fullAt + 2.5;
      thr = s.gt < hold ? s.gt : s.fullAt - (s.gt - hold) * 3;
      if (thr < -0.3) { this.reseed(s, f); vorScan(s, 5, gv); s.vs = true; let mx = 0; for (let i = 0; i < n; i++) if (s.D1[i] > mx) mx = s.D1[i]; s.fullAt = mx; thr = 0; }
    } else {
      if (foam) for (const q of S) q.wt = (M * 0.09 * (q.w + 0.35 * Math.sin(t * 0.8 + q.ph))) ** 2;
      vorScan(s, foam ? 4 : met === 2 ? 0 : met, gv);
    }
    const bw = Math.max(0.9, M / 70), K1 = s.K1, K2 = s.K2, D1 = s.D1, D2 = s.D2, lin = !grow && !foam && met !== 2;
    // 街區/方形距離：距離差除以它的局部斜率，才是到邊界的真正距離（兩顆種子幾乎對齊時，距離差在一大片區域都很小）
    const GP = lin ? s.GP && s.GP.length === n ? s.GP : (s.GP = new Float32Array(n)) : null;
    if (lin) for (let i = 0; i < n; i++) GP[i] = D2[i] - D1[i];
    for (let i = 0, xi = -1, yi = 0; i < n; i++) {
      if (++xi === cols) { xi = 0; yi++; }
      const x = WX[i], y = WY[i], k1 = K1[i], d1 = D1[i], d2 = D2[i], q1 = S[k1], q2 = S[K2[i]];
      if (grow) {
        if (d1 > thr) continue;
        const edge = (d2 - d1) * gv < bw * 1.1 && d2 <= thr + 0.4;
        const front = (thr - d1) * gv < bw * 1.2;
        if (edge) { ch[i] = dirCh(-(q2.y - q1.y), q2.x - q1.x); co[i] = C(0.95); }
        else if (front) { ch[i] = '*'; co[i] = C(0.9); }
        else { const e = 0.3 + 0.16 * ((k1 * 7) % 5) / 4 + 0.13 * fsin((d1 - q1.born) * 5 - t * 2.2 + k1); ch[i] = rc(RS, e); co[i] = C(e); }
        continue;
      }
      if (foam) {
        const e1 = d1 + q1.wt, r1 = Math.sqrt(Math.max(0, e1)), rad = Math.sqrt(q1.wt);
        const gap = (d2 - d1) / (2 * Math.hypot(q2.x - q1.x, q2.y - q1.y) + 1e-6);
        if (gap < bw * 0.55) { ch[i] = gap < bw * 0.3 ? 'O' : 'o'; co[i] = C(0.85); continue; }
        const hx = x - q1.x + rad * 0.35, hy = y - q1.y + rad * 0.35;
        if (Math.hypot(hx, hy) < rad * 0.18) { ch[i] = '*'; co[i] = C(1); continue; }
        if (r1 > rad * 0.82 && r1 < rad * 0.92) { ch[i] = '.'; co[i] = C(0.35); }
        continue;
      }
      // 邊界：兩個最近種子的距離差（歐氏距離換算成真正寬度）
      let gap;
      if (met === 2) gap = (d2 * d2 - d1 * d1) / (2 * Math.hypot(q2.x - q1.x, q2.y - q1.y) + 1e-6);
      else {
        const g0 = GP[i], gxm = Math.max(xi + 1 < cols ? Math.abs(GP[i + 1] - g0) : 0, xi > 0 ? Math.abs(g0 - GP[i - 1]) : 0);
        const gym = Math.max(yi + 1 < rows ? Math.abs(GP[i + cols] - g0) : 0, yi > 0 ? Math.abs(g0 - GP[i - cols]) : 0) / aspect;
        gap = (g0 / Math.max(0.35, Math.sqrt(gxm * gxm + gym * gym))) * 1.6;
      }
      if (gap < bw) {
        if (mode === 'stained') continue;
        ch[i] = met === 2 ? dirCh(-(q2.y - q1.y), q2.x - q1.x) : met === 1 ? (gap < bw * 0.5 ? '+' : '·') : '#';
        co[i] = C(met === 3 ? 0.95 : 0.9); continue;
      }
      if (mode === 'stained') {
        const e = clamp(0.95 - (d1 / (M * 0.32)) * 0.6, 0.3, 0.95);
        ch[i] = gap < bw * 1.8 ? '▓' : '█'; co[i] = H(q1.hue + t * 6, e * (gap < bw * 1.8 ? 0.7 : 1));
      } else if (mode === 'rings') {
        const u = d1 / (M * 0.065) - t * 0.6, fr = u - Math.floor(u);
        if (fr < 0.28) { ch[i] = ((Math.abs(x - q1.x) > Math.abs(y - q1.y)) ? '|' : '-'); co[i] = C(clamp(0.75 - d1 / (M * 0.5), 0.25, 0.75)); }
      } else {
        const e = clamp(0.62 - d1 / (M * 0.32), 0, 0.62);
        if (e > 0.08) { ch[i] = rc(RS, e); co[i] = C(e); }
      }
    }
    if (mode !== 'stained') for (const q of S) { if (grow && q.born > thr) continue; g.set(W + q.x, rows / 2 + q.y / aspect, '@', C(1)); }
  },
  crackle(s, f) {
    const { g, cols, rows, aspect, t, C } = f, n = g.n, WX = s.WX, WY = s.WY, M = s.M, ch = g.ch, co = g.co;
    const cs = M / 6.5, ic = 1 / cs, bw = Math.max(0.8, M / 90), drift = t * 0.05;
    // 每格網格點只算一次（含緩慢抖動）
    const gx0 = Math.floor(-cols / 2 * ic + drift) - 2, gy0 = Math.floor((-rows * aspect / 2) * ic) - 2;
    const GW = Math.ceil(cols * ic) + 5, GH = Math.ceil(rows * aspect * ic) + 5;
    if (!s.GPX || s.GPX.length !== GW * GH) { s.GPX = new Float32Array(GW * GH); s.GPY = new Float32Array(GW * GH); }
    const GPX = s.GPX, GPY = s.GPY;
    for (let yy = 0; yy < GH; yy++) for (let xx = 0; xx < GW; xx++) {
      const cx = gx0 + xx, cy = gy0 + yy, h1 = hash2(cx, cy), h2 = hash2(cy + 17.3, cx - 4.1), k = yy * GW + xx;
      GPX[k] = cx + 0.15 + 0.7 * h1 + 0.08 * Math.sin(t * 0.3 + h2 * 9); GPY[k] = cy + 0.15 + 0.7 * h2 + 0.08 * Math.cos(t * 0.27 + h1 * 9);
    }
    for (let i = 0; i < n; i++) {
      const x = WX[i] * ic + drift, y = WY[i] * ic, gx = Math.floor(x) - gx0, gy = Math.floor(y) - gy0;
      let d1 = 9, d2 = 9, a1 = 0, b1 = 0, a2 = 0, b2 = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const k = (gy + oy) * GW + gx + ox, px = GPX[k], py = GPY[k], dx = x - px, dy = y - py, d = dx * dx + dy * dy;
        if (d < d1) { d2 = d1; a2 = a1; b2 = b1; d1 = d; a1 = px; b1 = py; } else if (d < d2) { d2 = d; a2 = px; b2 = py; }
      }
      const gap = ((d2 - d1) / (2 * Math.hypot(a2 - a1, b2 - b1) + 1e-6)) * cs;
      if (gap < bw) { ch[i] = dirCh(-(b2 - b1), a2 - a1); co[i] = C(0.12); continue; }
      const r = Math.sqrt(d1), tex = fract((WX[i] * 12.9898 + WY[i] * 78.233) * 0.1731 + Math.floor(WX[i]) * 0.37);
      const e = 0.45 + 0.35 * (1 - r) + (gap < bw * 2.2 ? 0.2 : 0);
      ch[i] = tex > 0.82 ? ':' : tex > 0.5 ? '.' : gap < bw * 2.2 ? '=' : '-'; co[i] = C(clamp(e - tex * 0.15, 0.2, 1));
    }
  },
  net(s, f) {
    const { g, cols, rows, aspect, t, C } = f, S = s.S, ns = S.length, W = cols / 2, M = s.M, lim = M * 0.42;
    const sx = q => W + q.x, sy = q => rows / 2 + q.y / aspect;
    for (let a = 0; a < ns; a++) {
      const q = S[a], best = [];
      for (let b = 0; b < ns; b++) { if (b === a) continue; const d = Math.hypot(S[b].x - q.x, S[b].y - q.y); best.push([d, b]); }
      best.sort((u, v) => u[0] - v[0]);
      for (let k = 0; k < 3; k++) {
        const [d, b] = best[k]; if (d > lim) continue;
        const r = S[b], e = clamp(1 - d / lim, 0.15, 1), c1 = dirCh(sx(r) - sx(q), (sy(r) - sy(q)) * aspect);
        g.line(sx(q), sy(q), sx(r), sy(r), e > 0.6 ? c1 : '.', C(0.2 + 0.6 * e));
      }
    }
    for (const q of S) { const pulse = 0.5 + 0.5 * Math.sin(t * 2 + q.ph); g.set(sx(q), sy(q), pulse > 0.8 ? '@' : 'o', C(0.7 + 0.3 * pulse)); }
  } });

// ════════ 催眠螺旋：阿基米德、對數、雙向、向日葵、放射光芒、方形漩渦、渦流 ════════
const GOLD_ANG = Math.PI * (3 - Math.sqrt(5));
A({ id: 'ge-spiral', name: '催眠螺旋', cat: '幾何', theme: 'synth', desc: '雙臂阿基米德螺旋不停向內旋轉',
  params: { mode: 'arch' },
  variants: [
    { id: 'log', name: '對數螺旋', theme: 'gold', desc: '黑白分明的對數螺旋無限縮放', params: { mode: 'log' } },
    { id: 'twin', name: '雙向螺旋', theme: 'neon', hue: true, desc: '兩組反向螺旋疊出花格', params: { mode: 'twin' } },
    { id: 'burst', name: '放射光芒', theme: 'sunset', desc: '彎曲的光芒從中心向外迸射', params: { mode: 'burst' } },
    { id: 'squares', name: '方形漩渦', theme: 'paper', desc: '一層層微轉的方框捲成漩渦', params: { mode: 'squares' } },
    { id: 'vortex', name: '渦流', theme: 'ocean', desc: '中心扭轉來回擺盪的渦流', params: { mode: 'vortex' } },
  ],
  init(s, f) { polarRA(s, f); const n = f.cols * f.rows; s.LR = new Float32Array(n); for (let i = 0; i < n; i++) s.LR[i] = Math.log(s.PR[i] + 1e-3); },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H } = f, mode = f.p.mode, n = g.n, PR = s.PR, PA = s.PA, LR = s.LR, ch = g.ch, co = g.co;
    if (mode === 'sunflower') return this.sunflower(s, f);
    if (mode === 'squares') return this.squares(s, f);
    if (mode === 'arch') {
      const N = 2, k = 3.2, sp = -t * 0.55; // 相位隨時間增加，亮紋半徑變小：螺旋向內捲
      for (let i = 0; i < n; i++) {
        const r = PR[i], v = (N * PA[i]) / TAU + r * k - sp, e = (0.5 + 0.5 * fcos(TAU * v)) * clamp(r * 2.5, 0, 1) * clamp(1.6 - r * 0.25, 0.5, 1);
        if (e < 0.06) continue;
        ch[i] = rc(RS, e); co[i] = C(e);
      }
    } else if (mode === 'log') {
      const N = 4, k = 2.4, sp = t * 0.35, ink = C(0.95), edge = C(0.5);
      for (let i = 0; i < n; i++) {
        if (PR[i] < 0.03) continue;
        const v = (N * PA[i]) / TAU + LR[i] * k - sp, fr = v - Math.floor(v);
        if (fr < 0.5) { ch[i] = fr < 0.06 || fr > 0.44 ? '▓' : '█'; co[i] = fr < 0.06 || fr > 0.44 ? edge : ink; }
      }
    } else if (mode === 'twin') {
      const N = 6, k = 3.4;
      for (let i = 0; i < n; i++) {
        const r = PR[i], a = (N * PA[i]) / TAU, v1 = fcos(TAU * (a + r * k - t * 0.4)), v2 = fcos(TAU * (-a + r * k - t * 0.27)), v = v1 * v2;
        const e = Math.abs(v) * clamp(r * 3, 0, 1);
        if (e < 0.12) continue;
        ch[i] = rc(RS, e); co[i] = H(v > 0 ? 300 + r * 60 + t * 10 : 180 + r * 60 + t * 10, 0.2 + 0.8 * e);
      }
    } else if (mode === 'burst') {
      const N = 24;
      for (let i = 0; i < n; i++) {
        const r = PR[i], a = PA[i];
        const w1 = 0.5 + 0.5 * fcos(N * a + 0.9 * fsin(r * 4 - t * 1.6) + t * 0.25), w2 = 0.5 + 0.5 * fcos((N / 2) * a - t * 0.4 - r * 1.5);
        const rays = Math.pow(w1, 4) * 0.8 + Math.pow(w2, 6) * 0.45, glow = Math.exp(-r * 3.2) * (1.1 + 0.15 * Math.sin(t * 2));
        const pulse = 0.5 + 0.5 * fcos(r * 9 - t * 3);
        const e = clamp(rays * clamp(1.4 - r * 0.45, 0.25, 1) * (0.75 + 0.25 * pulse) + glow, 0, 1);
        if (e < 0.08) continue;
        ch[i] = rc(RS, e); co[i] = C(e);
      }
    } else {
      const N = 5, sw = 0.55 + 0.35 * Math.sin(t * 0.21);
      for (let i = 0; i < n; i++) {
        const r = PR[i] + 0.02, a = PA[i] + (sw * 1.2) / r - t * 0.6, v = (N * a) / TAU + r * 1.2, fr = v - Math.floor(v);
        const e = Math.pow(1 - Math.abs(fr - 0.5) * 2, 2.5) * clamp(r * 1.6, 0, 1) * clamp(1.5 - r * 0.3, 0.4, 1) + (r < 0.12 ? (0.12 - r) * 5 : 0);
        if (e < 0.08) continue;
        ch[i] = rc(RS, e); co[i] = C(e);
      }
    }
  },
  sunflower(s, f) {
    // 種子間距約 3 格，字形由中心的小點漸變成外圈的大圓；顏色依 21 條螺旋臂分組，螺旋才看得出來
    const { g, cols, rows, aspect, t, H } = f, Rm = Math.hypot(cols / 2, (rows * aspect) / 2), N = Math.round((Math.PI * Rm * Rm) / 24);
    const c = (Rm / Math.sqrt(N)) * (1 + 0.04 * Math.sin(t * 0.4)), rot = t * 0.06, cx = cols / 2, cy = rows / 2, R = '·:oO@', iN = 1 / N;
    for (let i = 1; i < N; i++) {
      const sq = Math.sqrt(i), rr = c * sq, a = i * GOLD_ANG + rot, x = cx + rr * Math.cos(a), y = cy + (rr * Math.sin(a)) / aspect;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const rn = Math.sqrt(i * iN), w = 0.5 + 0.5 * Math.sin(sq * 0.55 - t * 2.2), fam = i % 21;
      const e = clamp(0.3 + 0.45 * w + (fam & 1 ? 0 : 0.2), 0, 1);
      g.set(x, y, R[Math.min(4, (rn * 5.4) | 0)], H((fam * 360) / 21 + t * 8, e));
    }
  },
  squares(s, f) {
    const { g, cols, rows, aspect, t, C } = f, cx = cols / 2, cy = rows / 2, h0 = Math.hypot(cols / 2, (rows * aspect) / 2) * 1.02;
    const del = 0.09 + 0.07 * Math.sin(t * 0.23), q = 1 / (Math.cos(del) + Math.sin(del)), base = t * 0.12;
    let h = h0;
    for (let k = 0; h > 0.8 && k < 160; k++, h *= q) {
      const ang = base + k * del, e = 0.3 + 0.7 * fract((k - t * 2.5) / 7), col = C(0.25 + 0.75 * e);
      const pts = [];
      for (let j = 0; j < 4; j++) { const a = ang + j * (Math.PI / 2) + Math.PI / 4, rr = h * Math.SQRT2; pts.push([cx + rr * Math.cos(a), cy + (rr * Math.sin(a)) / aspect]); }
      for (let j = 0; j < 4; j++) { const [x0, y0] = pts[j], [x1, y1] = pts[(j + 1) % 4]; g.line(x0, y0, x1, y1, dirCh(x1 - x0, (y1 - y0) * aspect), col); }
    }
  } });

// ════════ 擺錘波：一排頻率略有不同的擺錘，時而成波、時而散開又對齊 ════════
const PEND_T = 60, PEND_K = 18;
const pendW = i => (TAU * (PEND_K + i)) / PEND_T;
function dpAcc(a1, a2, w1, w2, out) { // 雙擺（質量、長度都是 1）
  const g = 9.81, d = a1 - a2, den = 3 - Math.cos(2 * d);
  out[0] = (-g * 3 * Math.sin(a1) - g * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * (w2 * w2 + w1 * w1 * Math.cos(d))) / den;
  out[1] = (2 * Math.sin(d) * (w1 * w1 * 2 + g * 2 * Math.cos(a1) + w2 * w2 * Math.cos(d))) / den;
}
A({ id: 'ge-pend', name: '擺錘波', cat: '幾何', theme: 'amber', desc: '一排擺錘排出蛇形、分裂又重新對齊',
  params: { mode: '3d', n: 18 },
  variants: [
    { id: 'ring', name: '環形擺', theme: 'sakura', desc: '圍成一圈的擺錘拉出星形花瓣', params: { mode: 'ring', n: 36 } },
    { id: 'orbit', name: '同心軌道', theme: 'lavender', desc: '同心圓上的小球聚成旋臂又散開', params: { mode: 'orbit', n: 30 } },
    { id: 'grid', name: '擺錘陣列', theme: 'ocean', desc: '整片擺錘陣列盪出同心波紋', params: { mode: 'grid' } },
    { id: 'chaos', name: '混沌雙擺', theme: 'neon', hue: true, desc: '幾乎相同的雙擺漸漸分道揚鑣', params: { mode: 'chaos', n: 7 } },
    { id: 'ribbon', name: '光帶', theme: 'cyber', desc: '六十個擺錘連成扭動的光帶', params: { mode: 'ribbon', n: 60 } },
  ],
  init(s, f) {
    s.G = new Glow(f.cols, f.rows); s.out = [0, 0];
    if (f.p.mode === 'chaos') this.resetChaos(s, f);
  },
  resetChaos(s, f) {
    const n = f.p.n, a = rnd(1.8, 2.6), b = rnd(1.5, 3);
    s.dp = Array.from({ length: n }, (_, k) => ({ a1: a + k * 0.0015, a2: b, w1: 0, w2: 0, hue: (k * 360) / n }));
    s.ct = 0; s.G.v.fill(0);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, C, H } = f, p = f.p, mode = p.mode, n = p.n, G = s.G, tt = t + 3;
    if (mode === '3d') return this.view3d(s, f);
    if (mode === 'chaos') return this.chaos(s, f);
    if (mode === 'top') {
      // 殘影：沿著上一格到這一格的路徑塗亮（快的擺錘也是連續的線），寬度隨畫面放大；每個擺錘下方有淡淡的導軌
      G.fade(Math.pow(0.5, dt / 0.6));
      const A = rows * 0.42, wd = cols >= 200 ? 1 : 0, prev = s.py || (s.py = new Float32Array(n).fill(NaN)), guide = C(0.12);
      g.line(cols * 0.03, rows / 2, cols * 0.97, rows / 2, '·', C(0.2));
      for (let i = 0; i < n; i++) {
        const x = cols * (0.04 + (0.92 * i) / (n - 1)), y = rows / 2 + A * Math.cos(pendW(i) * tt), y0 = isNaN(prev[i]) ? y : prev[i];
        for (let yy = Math.ceil(rows / 2 - A); yy <= rows / 2 + A; yy++) g.set(x, yy, '·', guide);
        const steps = Math.min(60, Math.ceil(Math.abs(y - y0) * 2) + 1);
        for (let k = 1; k <= steps; k++) {
          const yk = y0 + ((y - y0) * k) / steps, a = (0.5 * Math.min(2, dt * 30)) / steps; // 像長時間曝光：停留越久越亮（擺動兩端最亮）
          G.splat(x, yk, a); if (wd) { G.splat(x - 1, yk, a * 0.55); G.splat(x + 1, yk, a * 0.55); }
        }
        prev[i] = y;
      }
      G.render(g, C, null, 0.9, ' .:-=+*#', 0.05);
      for (let i = 0; i < n; i++) {
        const x = cols * (0.04 + (0.92 * i) / (n - 1)), y = rows / 2 + A * Math.cos(pendW(i) * tt);
        g.set(x, y, 'O', C(1)); if (wd) { g.set(x - 1, y, '(', C(0.8)); g.set(x + 1, y, ')', C(0.8)); }
      }
    } else if (mode === 'ring') {
      const R0 = Math.min(cols / 2, (rows * aspect) / 2) * 0.55, A = R0 * 0.7, pts = [];
      for (let i = 0; i < n; i++) { const ph = (i / n) * TAU - Math.PI / 2 + t * 0.05, r = R0 + A * Math.cos(pendW(i % 18) * tt + (i >= 18 ? Math.PI : 0)); pts.push([cols / 2 + Math.cos(ph) * r, rows / 2 + (Math.sin(ph) * r) / aspect, ph]); }
      for (let i = 0; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]; g.line(x0, y0, x1, y1, dirCh(x1 - x0, (y1 - y0) * aspect), C(0.45)); }
      for (let i = 0; i < n; i++) { const ph = pts[i][2]; g.line(cols / 2 + Math.cos(ph) * R0 * 0.25, rows / 2 + (Math.sin(ph) * R0 * 0.25) / aspect, pts[i][0], pts[i][1], '.', C(0.18)); }
      for (const [x, y] of pts) g.set(x, y, 'O', C(1));
      g.set(cols / 2, rows / 2, '+', C(0.6));
    } else if (mode === 'orbit') {
      const R = Math.min(cols / 2, (rows * aspect) / 2) * 0.95, pts = [];
      for (let i = 0; i < n; i++) {
        const r = (R * (i + 1)) / n, m = Math.max(12, Math.ceil(r * 2));
        if (i % 6 === 5) for (let k = 0; k < m; k += 2) { const a = (k / m) * TAU; g.set(cols / 2 + Math.cos(a) * r, rows / 2 + (Math.sin(a) * r) / aspect, '.', C(0.14)); }
        const a = pendW(i) * tt * 0.25 - Math.PI / 2; pts.push([cols / 2 + Math.cos(a) * r, rows / 2 + (Math.sin(a) * r) / aspect]);
      }
      for (let i = 0; i + 1 < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; g.line(x0, y0, x1, y1, '·', C(0.4)); }
      pts.forEach(([x, y], i) => g.set(x, y, i % 5 === 4 ? '@' : 'o', C(0.6 + 0.4 * (i / n))));
    } else if (mode === 'grid') {
      const sx = 3, sy = 2, nx = Math.floor(cols / sx), ny = Math.floor(rows / sy), R = '.:-=+*#%@';
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const dx = (i - nx / 2) * sx, dy = (j - ny / 2) * sy * aspect, ri = Math.hypot(dx, dy) / (Math.min(cols, rows * aspect) * 0.5);
        const d = Math.cos((TAU * (PEND_K + ri * 14)) / PEND_T * tt), e = 0.5 + 0.5 * d;
        const x = i * sx + 1, y = j * sy + (d > 0 ? 0 : 1);
        g.set(x, y, R[Math.min(8, (e * 9) | 0)], C(0.15 + 0.85 * e));
        if (e > 0.75) { g.set(x - 1, y, '(', C(e * 0.7)); g.set(x + 1, y, ')', C(e * 0.7)); }
      }
    } else { // ribbon
      const A = rows * 0.38, echoes = 7;
      for (let k = echoes; k >= 0; k--) {
        const tk = tt - k * 0.07, e = k === 0 ? 1 : 0.55 * (1 - k / (echoes + 1)), col = C(e);
        let lx = 0, ly = 0;
        for (let i = 0; i < n; i++) {
          const x = cols * (0.03 + (0.94 * i) / (n - 1)), y = rows / 2 + A * Math.cos(pendW(i * 0.5) * tk);
          if (i) g.line(lx, ly, x, y, k === 0 ? dirCh(x - lx, (y - ly) * aspect) : '.', col);
          lx = x; ly = y;
        }
      }
      for (let i = 0; i < n; i += 3) { const x = cols * (0.03 + (0.94 * i) / (n - 1)), y = rows / 2 + A * Math.cos(pendW(i * 0.5) * tt); g.set(x, y, 'o', C(1)); }
    }
  },
  view3d(s, f) {
    const { g, cols, rows, aspect, t, C } = f, n = f.p.n, tt = t + 3;
    const yaw = 0.3 + 0.15 * Math.sin(t * 0.09), pitch = 0.38, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const D = 6.5, K = Math.min(cols * 1.45, rows * aspect * 2.6), cx = cols / 2, cy = rows * 0.1 + (K * Math.cos(pitch)) / (D * aspect);
    const proj = (x, y, z) => { const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp + D; return [cx + (K * x1) / z2, cy - (K * y2) / z2 / aspect, z2]; };
    const w0 = pendW(0), th0 = 0.42, bobs = [];
    for (let i = 0; i < n; i++) {
      const x = -1.9 + (3.8 * i) / (n - 1), L = 1.85 - (0.75 * i) / (n - 1), th = th0 * Math.cos(pendW(i) * tt);
      const piv = proj(x, 1, 0), bob = proj(x, 1 - L * Math.cos(th), L * Math.sin(th));
      bobs.push({ piv, bob });
    }
    const a = proj(-2.05, 1, 0), b = proj(2.05, 1, 0);
    g.line(a[0], a[1], b[0], b[1], '=', C(0.75));
    bobs.sort((u, v) => v.bob[2] - u.bob[2]);
    for (const { piv, bob } of bobs) {
      g.line(piv[0], piv[1], bob[0], bob[1], dirCh(bob[0] - piv[0], (bob[1] - piv[1]) * aspect), C(0.22));
      const rr = (K * 0.15) / bob[2], ry = rr / aspect, fog = clamp(1.6 - bob[2] * 0.15, 0.4, 1);
      for (let y = Math.floor(bob[1] - ry); y <= bob[1] + ry; y++) for (let x = Math.floor(bob[0] - rr); x <= bob[0] + rr; x++) {
        const dx = (x + 0.5 - bob[0]) / rr, dy = (y + 0.5 - bob[1]) / ry, d = dx * dx + dy * dy;
        if (d > 1) continue;
        const e = clamp(1 - Math.hypot(dx + 0.4, dy + 0.4) * 0.6, 0.1, 1) * fog;
        g.set(x, y, RL[Math.min(11, (e * 12) | 0)], C(e));
      }
      if (rr < 0.8) g.set(bob[0], bob[1], 'o', C(fog));
    }
  },
  chaos(s, f) {
    const { g, cols, rows, aspect, dt, C, H } = f, G = s.G, out = s.out, L = rows * aspect * 0.235, px = cols / 2, py = rows / 2;
    s.ct += dt;
    if (s.ct > 32) this.resetChaos(s, f);
    G.fade(Math.pow(0.5, dt / 1.4));
    const steps = 6, h = (dt * 1.1) / steps;
    for (const d of s.dp) {
      for (let k = 0; k < steps; k++) { // 半隱式歐拉，小步長
        dpAcc(d.a1, d.a2, d.w1, d.w2, out);
        d.w1 += out[0] * h; d.w2 += out[1] * h; d.a1 += d.w1 * h; d.a2 += d.w2 * h;
        const x2 = px + L * (Math.sin(d.a1) + Math.sin(d.a2)), y2 = py + (L * (Math.cos(d.a1) + Math.cos(d.a2))) / aspect;
        G.splat(x2, y2, 0.35, d.hue);
      }
    }
    G.render(g, C, H, 1.1, ' .:-=+*#', 0.04);
    for (const d of s.dp) {
      const x1 = px + L * Math.sin(d.a1), y1 = py + (L * Math.cos(d.a1)) / aspect, x2 = x1 + L * Math.sin(d.a2), y2 = y1 + (L * Math.cos(d.a2)) / aspect;
      g.line(px, py, x1, y1, '.', H(d.hue, 0.45)); g.line(x1, y1, x2, y2, '.', H(d.hue, 0.6));
      g.set(x1, y1, 'o', H(d.hue, 0.9)); g.set(x2, y2, '@', H(d.hue, 1));
    }
    g.set(px, py, '+', C(1));
  } });

// ════════ 克拉尼圖形：振動平板上的節線（砂子聚集處） ════════
const CHL_MODES = [[1, 2], [2, 3], [1, 4], [3, 4], [2, 5], [1, 5], [3, 5], [4, 5], [2, 7], [3, 7], [5, 6], [1, 6], [4, 7], [3, 8]];
const CHL_SAND = '.,:;';
const CHL_SMALL = CHL_MODES.filter(m => m[0] + m[1] <= 6); // 縮圖（列數少）只用低頻模態，節線才不會糊成一片
const SAND_MODES = [[1, 3], [2, 3], [1, 4], [2, 4], [1, 5], [2, 5]]; // 撒砂只用低頻模態（n+m ≤ 6），節線才看得清楚
const SAND_R = '.,:;=+*#%@';
function besselTab(n, xmax, N) { // J_n(x) 以積分式計算成表
  const T = new Float32Array(N + 1);
  for (let k = 0; k <= N; k++) {
    const x = (k / N) * xmax; let s = 0;
    for (let j = 0; j < 64; j++) { const tau = ((j + 0.5) / 64) * Math.PI; s += Math.cos(n * tau - x * Math.sin(tau)); }
    T[k] = s / 64;
  }
  return T;
}
// 依「到節線的距離 ≈ |u| / |∇u|」畫線，線寬在螢幕上固定，不會忽粗忽細
function chlNodal(s, f, wid, mask) {
  const { g, cols, rows, aspect, C } = f, U = s.U, TX = s.TX, ch = g.ch, co = g.co;
  for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
    if (mask && !mask[i]) continue;
    const u = U[i], gx = (x + 1 < cols ? U[i + 1] : u) - (x > 0 ? U[i - 1] : u), gy = ((y + 1 < rows ? U[i + cols] : u) - (y > 0 ? U[i - cols] : u)) / aspect;
    const d = Math.abs(u) / (0.5 * Math.sqrt(gx * gx + gy * gy) + 1e-6);
    if (d >= wid) continue;
    const e = 1 - d / wid;
    ch[i] = CHL_SAND[(TX[i] * 4) | 0]; co[i] = C(0.3 + 0.7 * e * (0.75 + 0.25 * TX[i]));
  }
}
A({ id: 'ge-chladni', name: '克拉尼圖形', cat: '幾何', theme: 'amber', desc: '振動平板上的砂子排出對稱節線',
  params: { mode: 'lines' },
  variants: [
    { id: 'sand', name: '撒砂', theme: 'gold', desc: '砂粒被震到節線上慢慢聚集', params: { mode: 'sand' } },
    { id: 'circle', name: '圓板', theme: 'ice', desc: '圓形平板上的放射與同心節線', params: { mode: 'circle' } },
    { id: 'amp', name: '振動場', theme: 'sunset', hue: true, desc: '板面一起一伏的正負振幅', params: { mode: 'amp' } },
    { id: 'hex', name: '六角駐波', theme: 'mint', desc: '三道波疊出六角形節線網', params: { mode: 'hex' } },
    { id: 'tiles', name: '標本板', theme: 'blueprint', desc: '一格格不同頻率的平板圖譜', params: { mode: 'tiles' } },
  ],
  init(s, f) {
    const { cols, rows, aspect } = f, n = cols * rows, p = f.p;
    worldXY(s, f);
    s.h = (rows * aspect) / 2;
    s.CX = new Float32Array(cols * 4); s.CY = new Float32Array(rows * 4); s.U = new Float32Array(n);
    s.TX = new Float32Array(n); for (let i = 0; i < n; i++) s.TX[i] = Math.random();
    if (p.mode === 'circle') { polarRA(s, f); s.bn = -1; }
    if (p.mode === 'tiles') s.MK = new Uint8Array(n);
    if (p.mode === 'sand') {
      const np = clamp(Math.round(n * 0.5), 1500, 14000);
      s.px = new Float32Array(np); s.py = new Float32Array(np);
      for (let k = 0; k < np; k++) { s.px[k] = rnd(-1, 1) * (cols / 2) / s.h; s.py[k] = rnd(-1, 1); }
      s.den = new Float32Array(n); s.kick = 1; s.lastK = -1;
    }
  },
  modeAt(t, per, L) { L = L || CHL_MODES; const ph = t / per, k = Math.floor(ph); return [L[(k * 5 + 3) % L.length], L[((k + 1) * 5 + 3) % L.length], smooth(0.72, 1, ph - k), k]; },
  fillCos(s, f, A, B) { // 每欄、每列的 cos(nπx) 先算好
    const { cols, rows } = f, h = s.h, CX = s.CX, CY = s.CY, ns = [A[0], A[1], B[0], B[1]];
    for (let q = 0; q < 4; q++) {
      for (let x = 0; x < cols; x++) CX[q * cols + x] = Math.cos(ns[q] * Math.PI * ((x + 0.5 - cols / 2) / h));
      for (let y = 0; y < rows; y++) CY[q * rows + y] = Math.cos(ns[q] * Math.PI * (((y + 0.5 - rows / 2) * f.aspect) / h));
    }
  },
  sparkle(s, f) { // 砂粒跳動：每格隨機換掉少數砂粒的樣子
    const TX = s.TX, k = Math.ceil(TX.length * f.dt * 0.6);
    for (let j = 0; j < k; j++) TX[(Math.random() * TX.length) | 0] = Math.random();
  },
  frame(s, f) {
    const { g, cols, rows, t, C, H } = f, mode = f.p.mode, ch = g.ch, co = g.co, U = s.U;
    this.sparkle(s, f);
    if (mode === 'circle') return this.circle(s, f);
    if (mode === 'hex') return this.hex(s, f);
    if (mode === 'tiles') return this.tiles(s, f);
    if (mode === 'sand') return this.sand(s, f);
    const small = rows < 40, [A, B, mix0] = this.modeAt(t, mode === 'mix' ? 6 : 8, small ? CHL_SMALL : CHL_MODES);
    const mix = mix0 + (1 - mix0) * 0.14 * (0.5 + 0.5 * Math.sin(t * 0.45)); // 平時也會微微變形
    this.fillCos(s, f, A, B);
    const CX = s.CX, CY = s.CY, sgA = (A[0] + A[1]) % 2 ? -1 : 1, sgB = (B[0] + B[1]) % 2 ? -1 : 1;
    for (let y = 0, i = 0; y < rows; y++) {
      const a0 = CY[y], a1 = CY[rows + y], b0 = CY[2 * rows + y], b1 = CY[3 * rows + y];
      for (let x = 0; x < cols; x++, i++) { const uA = CX[x] * a1 + sgA * CX[cols + x] * a0, uB = CX[2 * cols + x] * b1 + sgB * CX[3 * cols + x] * b0; U[i] = uA + (uB - uA) * mix; }
    }
    if (mode === 'lines') return chlNodal(s, f, 1.15);
    if (mode === 'amp') {
      const osc = Math.cos(t * 2.2);
      for (let i = 0; i < g.n; i++) {
        const v = U[i] * osc, e = Math.min(1, Math.abs(v) * 0.6);
        if (e < 0.08) continue;
        ch[i] = rc(RS, e); co[i] = H(v > 0 ? 20 : 200, 0.2 + 0.8 * e);
      }
      chlNodal(s, f, 0.6);
      return;
    }
    for (let i = 0; i < g.n; i++) { // mix：多層等高線
      const u = U[i], w = u * (small ? 1.7 : 2.6) + Math.sin(t * 0.3) * 0.3, fr = w - Math.floor(w), d = Math.min(fr, 1 - fr);
      if (d < 0.1) { ch[i] = d < 0.05 ? '=' : '-'; co[i] = C(clamp(0.3 + Math.abs(u) * 0.4, 0, 0.85)); }
    }
    chlNodal(s, f, 0.9);
  },
  sand(s, f) {
    const { g, cols, rows, aspect, dt, C } = f, t = f.t, h = s.h, px = s.px, py = s.py, np = px.length, den = s.den, ch = g.ch, co = g.co;
    const [A, B, mix, k] = this.modeAt(t, 9, SAND_MODES);
    if (s.lastK !== k) { s.lastK = k; s.kick = 1; }
    s.kick = Math.max(0, s.kick - dt * 0.7);
    // 平板對應到 [0,1]×[0,1]（橫向拉滿整個畫面），節線密度是舊版的一半
    const PI = Math.PI, W = (cols / 2) / h, kx = PI / (2 * W), ky = PI / 2, sgA = (A[0] + A[1]) % 2 ? -1 : 1, sgB = (B[0] + B[1]) % 2 ? -1 : 1;
    const nA = A[0], mA = A[1], nB = B[0], mB = B[1], step = Math.min(dt, 0.05);
    const k1 = Math.min(1, step * 2.2), jit0 = step * 6, kick = s.kick;
    for (let q = 0; q < np; q++) {
      let x = px[q], y = py[q];
      const ax = (x + W) * kx, ay = (y + 1) * ky;
      const c1 = fcos(nA * ax), s1 = fsin(nA * ax), c2 = fcos(mA * ax), s2 = fsin(mA * ax), c3 = fcos(nA * ay), s3 = fsin(nA * ay), c4 = fcos(mA * ay), s4 = fsin(mA * ay);
      const d1 = fcos(nB * ax), e1 = fsin(nB * ax), d2 = fcos(mB * ax), e2 = fsin(mB * ax), d3 = fcos(nB * ay), e3 = fsin(nB * ay), d4 = fcos(mB * ay), e4 = fsin(mB * ay);
      const uA = c1 * c4 + sgA * c2 * c3, uB = d1 * d4 + sgB * d2 * d3, u = uA + (uB - uA) * mix;
      const gAx = (-nA * s1 * c4 - sgA * mA * s2 * c3) * kx, gAy = (-mA * c1 * s4 - sgA * nA * c2 * s3) * ky;
      const gBx = (-nB * e1 * d4 - sgB * mB * e2 * d3) * kx, gBy = (-mB * d1 * e4 - sgB * nB * d2 * e3) * ky;
      const gx = gAx + (gBx - gAx) * mix, gy = gAy + (gBy - gAy) * mix, g2 = gx * gx + gy * gy + 1e-3;
      // 牛頓步：往節線（u=0）方向移動；離節線越遠抖得越厲害
      const jit = (Math.min(1, Math.abs(u)) * 0.05 + kick * 0.12) * jit0;
      const mx = clamp((u * gx / g2) * k1, -0.03, 0.03), my = clamp((u * gy / g2) * k1, -0.03, 0.03);
      x -= mx + (Math.random() - 0.5) * jit; y -= my + (Math.random() - 0.5) * jit;
      if (x < -W) x = -W; else if (x > W) x = W;
      if (y < -1) y = -1; else if (y > 1) y = 1;
      px[q] = x; py[q] = y;
    }
    // 持續累積、慢慢消退的密度：砂粒停留的地方越來越亮
    const n = den.length, fade = Math.pow(0.5, dt / 0.4), add = dt * 30;
    for (let i = 0; i < n; i++) den[i] *= fade;
    const hx = cols / 2, hy = rows / 2, sy = h / aspect;
    for (let q = 0; q < np; q++) { const cx = (hx + px[q] * h) | 0, cy = (hy + py[q] * sy) | 0; if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) den[cy * cols + cx] += add; }
    // 砂全部聚在節線上時，線上每格的密度約為 2·D0
    const D0 = (6 * np) / (cols + rows * aspect), iD = 1 / D0, lo = D0 * 0.08;
    for (let i = 0; i < n; i++) {
      const v = den[i];
      if (v <= lo) continue;
      const e = 1 - Math.exp(-v * iD);
      ch[i] = SAND_R[Math.min(9, (e * 10) | 0)]; co[i] = C(0.25 + 0.75 * e);
    }
  },
  circle(s, f) {
    const { g, t, C } = f, PR = s.PR, PA = s.PA, ch = g.ch, co = g.co, n = g.n, U = s.U;
    const per = 8, k = Math.floor(t / per), mix = smooth(0.72, 1, t / per - k);
    const md = q => { const a = [[0, 2], [1, 2], [2, 2], [3, 1], [2, 3], [4, 2], [5, 1], [0, 3], [3, 3], [6, 2]][((q % 10) + 10) % 10]; return { n: a[0], kk: Math.PI * (a[1] + a[0] / 2 + 0.25) }; };
    if (s.bn !== k) { s.bn = k; const a = md(k), b = md(k + 1); s.ma = a; s.mb = b; s.JA = besselTab(a.n, a.kk * 1.02, 512); s.JB = besselTab(b.n, b.kk * 1.02, 512); }
    const rot = t * 0.15, R0 = 0.95 * (s.h / (s.M / 2)), mask = s.CM || (s.CM = new Uint8Array(n)), wob = 0.06 * Math.sin(t * 0.5);
    for (let i = 0; i < n; i++) {
      const r = PR[i] / R0;
      mask[i] = r < 0.97 ? 1 : 0;
      if (r > 1.02) { U[i] = 1; continue; }
      if (r > 0.985) { ch[i] = 'o'; co[i] = C(0.4); U[i] = 1; continue; }
      const ia = Math.min(512, (r * 512) | 0);
      const uA = s.JA[ia] * fcos(s.ma.n * (PA[i] + rot)), uB = s.JB[ia] * fcos(s.mb.n * (PA[i] + rot)), mm = mix + (1 - mix) * (0.12 + wob);
      U[i] = uA + (uB - uA) * mm;
    }
    chlNodal(s, f, 1.1, mask);
  },
  hex(s, f) {
    const { g, t, C } = f, WX = s.WX, WY = s.WY, ch = g.ch, co = g.co, n = g.n, U = s.U;
    const K = (TAU / Math.max(s.M * 0.2, 17)) * (1 + 0.25 * Math.sin(t * 0.13)), rot = t * 0.04, cs = [], sn = [];
    for (let k = 0; k < 3; k++) { cs.push(Math.cos(rot + (k * Math.PI) / 3) * K); sn.push(Math.sin(rot + (k * Math.PI) / 3) * K); }
    const ph = 0.6 * Math.sin(t * 0.21), off = 0.5 * Math.sin(t * 0.17);
    for (let i = 0; i < n; i++) { const x = WX[i], y = WY[i]; U[i] = fcos(x * cs[0] + y * sn[0]) + fcos(x * cs[1] + y * sn[1] + ph) + fcos(x * cs[2] + y * sn[2] - ph) + off; }
    chlNodal(s, f, 1.1);
    for (let i = 0; i < n; i++) if (U[i] > 2.55 && ch[i] === ' ') { ch[i] = '*'; co[i] = C(0.4); }
  },
  tiles(s, f) {
    const { g, cols, rows, aspect, t, C } = f, U = s.U, MK = s.MK;
    const ny = rows >= 50 ? 3 : 2, tileH = Math.floor(rows / ny), nx = Math.max(2, Math.round(cols / (tileH * aspect))), tileW = Math.floor(cols / nx);
    const ox = Math.floor((cols - nx * tileW) / 2), oy = Math.floor((rows - ny * tileH) / 2);
    MK.fill(0); U.fill(1);
    const boxes = [];
    for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
      const id = ty * nx + tx, ph = t / 7 + id * 0.37, k = Math.floor(ph), mix = smooth(0.6, 1, ph - k);
      const MA = CHL_MODES[(id * 3 + k) % CHL_MODES.length], MB = CHL_MODES[(id * 3 + k + 1) % CHL_MODES.length], sa = (MA[0] + MA[1]) % 2 ? -1 : 1, sb = (MB[0] + MB[1]) % 2 ? -1 : 1, x0 = ox + tx * tileW, y0 = oy + ty * tileH;
      for (let y = 1; y < tileH - 1; y++) for (let x = 1; x < tileW - 2; x++) {
        const u0 = (x - 0.5) / (tileW - 3), v0 = (y - 0.5) / (tileH - 2), P = Math.PI;
        const uA = Math.cos(MA[0] * P * u0) * Math.cos(MA[1] * P * v0) + sa * Math.cos(MA[1] * P * u0) * Math.cos(MA[0] * P * v0);
        const uB = Math.cos(MB[0] * P * u0) * Math.cos(MB[1] * P * v0) + sb * Math.cos(MB[1] * P * u0) * Math.cos(MB[0] * P * v0);
        const i = (y0 + y) * cols + x0 + x; U[i] = uA + (uB - uA) * mix; MK[i] = 1;
      }
      boxes.push([x0, y0, mix < 0.5 ? MA : MB]);
    }
    chlNodal(s, f, 1.0, MK);
    for (const [x0, y0, M] of boxes) {
      for (let x = 0; x < tileW - 1; x++) { g.set(x0 + x, y0, '─', C(0.4)); g.set(x0 + x, y0 + tileH - 1, '─', C(0.4)); }
      for (let y = 0; y < tileH; y++) { g.set(x0, y0 + y, '│', C(0.4)); g.set(x0 + tileW - 2, y0 + y, '│', C(0.4)); }
      g.set(x0, y0, '┌', C(0.4)); g.set(x0 + tileW - 2, y0, '┐', C(0.4)); g.set(x0, y0 + tileH - 1, '└', C(0.4)); g.set(x0 + tileW - 2, y0 + tileH - 1, '┘', C(0.4));
      g.text(x0 + 2, y0 + tileH - 1, M[0] + '·' + M[1], C(0.75));
    }
  } });

// ════════ 光柵橫條：demoscene 的光條、正弦字幕、扭轉柱、疊影光牆 ════════
const FONT5_SRC = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.', C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.', E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#', I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..', K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#', O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....', Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..', U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.', 2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '#####|...#.|..#..|...#.|....#|#...#|.###.', 4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '..##.|.#...|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...', 8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|...#.|.##..', ' ': '.....|.....|.....|.....|.....|.....|.....', '.': '.....|.....|.....|.....|.....|.##..|.##..',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..', '*': '.....|..#..|#.#.#|.###.|#.#.#|..#..|.....', '-': '.....|.....|.....|.###.|.....|.....|.....',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....', '+': '.....|..#..|..#..|#####|..#..|..#..|.....', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
};
const FONT5 = {};
for (const k of Object.keys(FONT5_SRC)) FONT5[k] = FONT5_SRC[k].split('|').map(r => [...r].reduce((m, c, i) => m | (c === '#' ? 1 << i : 0), 0));
const fontRow = (c, r) => (FONT5[c] || FONT5[' '])[r];
const SCROLL_TXT = '   ASCII DEMO PARTY  *  GREETINGS TO EVERY PIXEL AND EVERY CHARACTER  *  SINE WAVES FOREVER  *  KEEP THE COPPER BARS ROLLING  *  EVERY FRAME HANDMADE FROM ASCII  *  ';
// 一條光條的亮度剖面：中間亮、兩邊暗
const copperE = d => { const a = 1 - Math.abs(d); return a <= 0 ? 0 : 0.15 + 0.85 * a * a * (3 - 2 * a); };
A({ id: 'ge-copper', name: '光柵橫條', cat: '幾何', theme: 'synth', hue: true, desc: '彩色光條上下穿梭、前後交疊',
  params: { mode: 'bars' },
  variants: [
    { id: 'scroll', name: '正弦字幕', theme: 'gold', hue: false, desc: '巨大字幕沿著正弦波捲過畫面', params: { mode: 'scroll' } },
    { id: 'twister', name: '扭轉柱', theme: 'cyber', desc: '方柱一邊旋轉一邊扭成麻花', params: { mode: 'twister' } },
    { id: 'kefrens', name: '疊影光牆', theme: 'fire', hue: false, desc: '一行行疊出的扭動光牆', params: { mode: 'kefrens' } },
    { id: 'vbars', name: '直立光柱', theme: 'ice', hue: false, desc: '直立光柱左右穿梭、隨掃描線晃動', params: { mode: 'vbars' } },
    { id: 'logo', name: '波動標誌', theme: 'neon', desc: '大字標誌隨掃描線左右擺動', params: { mode: 'logo' } },
    { id: 'plasma', name: '電漿光柵', theme: 'rainbow', desc: '每條掃描線都在流動的色帶', params: { mode: 'plasma' } },
  ],
  init(s, f) { s.LB = new Float32Array(f.cols); s.LH = new Float32Array(f.cols); },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H } = f, mode = f.p.mode, ch = g.ch, co = g.co;
    if (mode === 'bars' || mode === 'scroll' || mode === 'logo') this.hbars(s, f, mode === 'bars' ? 1 : 0.35);
    if (mode === 'scroll') return this.scroll(s, f);
    if (mode === 'logo') return this.logo(s, f);
    if (mode === 'twister') return this.twister(s, f);
    if (mode === 'kefrens') return this.kefrens(s, f);
    if (mode === 'vbars') {
      const nb = 6, T = Math.max(3, cols * 0.045);
      for (let y = 0; y < rows; y++) {
        const wob = Math.sin(y * 0.18 + t * 2.6) * cols * 0.012 + Math.sin(y * 0.05 - t) * cols * 0.02, bars = [];
        for (let k = 0; k < nb; k++) { const ph = t * (0.45 + k * 0.07) + k * 1.3; bars.push([Math.cos(ph), cols / 2 + Math.sin(ph) * cols * 0.4 + wob, k]); }
        bars.sort((a, b) => a[0] - b[0]);
        for (const [z, cx, k] of bars) {
          for (let x = Math.max(0, Math.floor(cx - T)); x <= Math.min(cols - 1, cx + T); x++) {
            const e = copperE((x + 0.5 - cx) / T) * (0.55 + 0.45 * (z * 0.5 + 0.5));
            if (e < 0.05) continue;
            const i = y * cols + x; ch[i] = '█'; co[i] = H(k * 60, e);
          }
        }
        if (y % 2 === 0) for (let x = 0; x < cols; x++) { const i = y * cols + x; if (ch[i] === ' ' && x % 3 === 0) { ch[i] = '.'; co[i] = C(0.08); } }
      }
    } else if (mode === 'plasma') {
      for (let y = 0, i = 0; y < rows; y++) {
        const sh = Math.sin(y * 0.11 + t * 0.9) * 3 + Math.sin(y * 0.031 - t * 0.4) * 5, base = y * 0.42 + t * 1.6;
        for (let x = 0; x < cols; x++, i++) {
          const u = base + Math.sin(x * 0.021 + sh * 0.3 + t * 0.5) * 2.4 + sh * 0.2, e = 0.5 + 0.5 * fsin(u);
          if (e < 0.12) continue;
          ch[i] = e > 0.55 ? '█' : e > 0.35 ? '▓' : '░'; co[i] = H(u * 25 + x * 0.3, 0.15 + 0.85 * e);
        }
      }
    }
  },
  hbars(s, f, amt) {
    const { g, cols, rows, t, C, H } = f, ch = g.ch, co = g.co, full = amt >= 1, nb = full ? 7 : 4, T = Math.max(1.2, rows * (full ? 0.075 : 0.045)), bars = [];
    for (let k = 0; k < nb; k++) { const ph = t * (0.55 + k * 0.06) + k * 0.9; bars.push([Math.cos(ph), rows / 2 + Math.sin(ph) * rows * 0.38, k]); }
    bars.sort((a, b) => a[0] - b[0]);
    for (const [z, cy, k] of bars) {
      for (let y = Math.max(0, Math.floor(cy - T)); y <= Math.min(rows - 1, cy + T); y++) {
        const e = copperE((y + 0.5 - cy) / T) * (0.5 + 0.5 * (z * 0.5 + 0.5)) * amt;
        if (e < 0.04) continue;
        const col = H(k * 51 + 10, e), wob = Math.round(Math.sin(y * 0.4 + t * 3) * 2);
        for (let x = 0; x < cols; x++) { const i = y * cols + x; if (full) { ch[i] = '█'; co[i] = col; } else if ((x + wob) % 3) { ch[i] = '─'; co[i] = col; } }
      }
    }
  },
  scroll(s, f) {
    const { g, cols, rows, aspect, t, C } = f, sy = Math.max(1, Math.round((rows * 0.34) / 7)), sx = Math.max(1, Math.round(sy * aspect * 0.85));
    const off = t * cols * 0.13, A = rows * 0.2, L = SCROLL_TXT.length, y0 = rows / 2 - 3.5 * sy;
    for (let x = 0; x < cols; x++) {
      const px = x + off, tc = Math.floor(px / sx), ci = Math.floor(tc / 6) % L, gx = tc % 6;
      if (gx === 5) continue;
      const c = SCROLL_TXT[ci], yo = A * Math.sin(px * 0.035 - t * 1.5);
      for (let r = 0; r < 7; r++) {
        if (!(fontRow(c, r) >> gx & 1)) continue;
        const e = 1 - r * 0.07;
        for (let k = 0; k < sy; k++) {
          const y = Math.round(y0 + yo + r * sy + k);
          if (y < 0 || y >= rows) continue;
          const i = y * cols + x; g.ch[i] = '█'; g.co[i] = C(e - (k / sy) * 0.08);
        }
      }
    }
  },
  logo(s, f) {
    const { g, cols, rows, aspect, t, C, H } = f, word = 'ASCII', sy = Math.max(1, Math.floor((rows * 0.62) / 7)), sx = Math.max(1, Math.min(Math.floor((cols * 0.84) / (word.length * 6)), Math.round(sy * aspect * 0.9)));
    const W = word.length * 6 * sx - sx, x0 = (cols - W) / 2, y0 = Math.floor((rows - 7 * sy) / 2);
    for (let r = 0; r < 7; r++) for (let k = 0; k < sy; k++) {
      const y = y0 + r * sy + k, wob = Math.sin(y * 0.35 + t * 2.4) * sx * 1.6 + Math.sin(t * 0.7) * sx;
      for (let ci = 0; ci < word.length; ci++) {
        const bits = fontRow(word[ci], r);
        for (let gx = 0; gx < 5; gx++) {
          if (!(bits >> gx & 1)) continue;
          for (let q = 0; q < sx; q++) {
            const x = Math.round(x0 + (ci * 6 + gx) * sx + q + wob);
            if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
            const i = y * cols + x; g.ch[i] = '█'; g.co[i] = H(y * 6 - t * 40, 0.55 + 0.45 * (1 - k / sy));
          }
        }
      }
    }
  },
  twister(s, f) {
    const { g, cols, rows, t, H } = f, ch = g.ch, co = g.co, n2 = cols > 140 ? 3 : 2, w = Math.min(cols / (n2 * 3.2), rows * 0.5);
    for (let q = 0; q < n2; q++) {
      const cx = cols * ((q + 0.5) / n2) + Math.sin(t * 0.5 + q) * cols * 0.03;
      for (let y = 0; y < rows; y++) {
        const a = t * (1.1 + q * 0.2) * (q % 2 ? -1 : 1) + Math.sin(y * 0.045 + t * 0.8 + q) * 2.4, xs = [];
        for (let k = 0; k < 4; k++) xs.push(cx + w * Math.sin(a + (k * Math.PI) / 2));
        for (let k = 0; k < 4; k++) {
          const x0 = xs[k], x1 = xs[(k + 1) % 4];
          if (x1 <= x0) continue;
          const mid = a + (k * Math.PI) / 2 + Math.PI / 4, e = 0.25 + 0.75 * Math.max(0, Math.cos(mid - Math.PI / 2 - 0.4)) ** 0.8;
          for (let x = Math.ceil(x0); x < x1; x++) {
            if (x < 0 || x >= cols) continue;
            const i = y * cols + x, edge = x - x0 < 0.9 || x1 - x < 0.9;
            ch[i] = edge ? '▓' : '█'; co[i] = H(k * 90 + q * 30, edge ? e * 0.6 : e);
          }
        }
      }
    }
  },
  kefrens(s, f) {
    const { g, cols, rows, t, H } = f, LB = s.LB, LH = s.LH, ch = g.ch, co = g.co, bw = Math.max(3, cols * 0.025);
    LB.fill(0);
    for (let y = 0; y < rows; y++) {
      const cx = cols / 2 + Math.sin(y * 0.07 + t * 1.3) * cols * 0.28 + Math.sin(y * 0.031 - t * 0.7) * cols * 0.14, hue = y * 7 + t * 30;
      for (let x = Math.max(0, Math.floor(cx - bw)); x <= Math.min(cols - 1, cx + bw); x++) { const e = copperE((x + 0.5 - cx) / bw); if (e > 0.05) { LB[x] = e; LH[x] = hue; } }
      for (let x = 0, i = y * cols; x < cols; x++, i++) { const e = LB[x]; if (e <= 0.05) continue; ch[i] = '█'; co[i] = H(LH[x], e); }
    }
  } });

// ════════ 點陣球體：由點組成、會打光的 3D 球與各種變形 ════════
const DOT_R = '.:oO@';
// 形變用的暫存座標（不每點配置新陣列，避免垃圾回收造成卡頓）
let SHX = 0, SHY = 0, SHZ = 0;
function morphShape(k, x, y, z) {
  if (k === 0) { SHX = x; SHY = y; SHZ = z; return; }
  if (k === 1) { const m = 0.8 / Math.max(Math.abs(x), Math.abs(y), Math.abs(z)); SHX = x * m; SHY = y * m; SHZ = z * m; return; }
  if (k === 2) { const a = Math.atan2(z, x), b = y * Math.PI, R0 = 0.72, r0 = 0.32, rr = R0 + r0 * Math.cos(b); SHX = rr * Math.cos(a); SHY = r0 * Math.sin(b); SHZ = rr * Math.sin(a); return; }
  if (k === 3) { const m = 1.05 / (Math.abs(x) + Math.abs(y) + Math.abs(z)); SHX = x * m; SHY = y * m; SHZ = z * m; return; }
  const a = Math.atan2(z, x); SHX = Math.cos(a) * 0.62; SHY = y * 0.95; SHZ = Math.sin(a) * 0.62;
}
A({ id: 'ge-sphere', name: '點陣球體', cat: '幾何', theme: 'ice', desc: '由上萬個點組成、會打光的旋轉球',
  params: { mode: 'fib' },
  variants: [
    { id: 'gyro', name: '陀螺儀', theme: 'gold', desc: '三道點環各自翻轉，包住中心小球', params: { mode: 'gyro' } },
    { id: 'morph', name: '形變', theme: 'neon', hue: true, desc: '點雲在球、方塊、圓環之間變形', params: { mode: 'morph' } },
    { id: 'orbit', name: '雙星', theme: 'sunset', desc: '兩顆點陣球互相繞行、彼此遮擋', params: { mode: 'orbit' } },
  ],
  init(s, f) {
    const { cols, rows, aspect } = f, p = f.p;
    s.R = Math.min(cols / 2, (rows * aspect) / 2) * (p.mode === 'orbit' ? 0.75 : p.mode === 'gyro' ? 0.84 : 0.9);
    const N = clamp(Math.round(Math.PI * s.R * s.R * (p.mode === 'shells' ? 1.4 : 1)), 600, 26000);
    s.N = N; s.P = new Float32Array(N * 3); s.zb = new Float32Array(cols * rows);
    for (let i = 0; i < N; i++) { // 費氏球面：點分布最均勻
      const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * GOLD_ANG;
      s.P[i * 3] = r * Math.cos(a); s.P[i * 3 + 1] = y; s.P[i * 3 + 2] = r * Math.sin(a);
    }
    if (p.mode === 'scatter') { s.Q = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) s.Q[i] = gauss() * 1.6; }
    if (p.mode === 'orbit') { // 軌道依螢幕寬高比橫向拉開，但要確保球（含透視放大）不會超出左右邊界
      const K = s.R * 2.4, hw = 0.97 * cols / 2, st = Math.min(1.7, cols / (rows * aspect));
      s.st = Math.min(st, this.fitSt(K, 3.4, hw, 0.95, 0.8)); s.stMoon = Math.min(s.st, this.fitSt(K, 3.4, hw, 1.7, 0.35));
    }
  },
  fitSt(K, D, hw, orb, sz) { // 二分搜尋：橫向拉伸倍率最大可以多少
    let lo = 1, hi = 1.7;
    for (let it = 0; it < 12; it++) {
      const m = (lo + hi) / 2; let mx = 0;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU, ca = Math.abs(Math.cos(a)) * orb * 1.25 * m, za = D + Math.sin(a) * orb * 0.9;
        for (let j = 0; j < 24; j++) { const q = (j / 24) * TAU, v = (K * (ca + sz * Math.cos(q))) / (za + sz * Math.sin(q)); if (v > mx) mx = v; }
      }
      if (mx <= hw) lo = m; else hi = m;
    }
    return lo;
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H } = f, mode = f.p.mode, zb = s.zb, P = s.P, N = s.N, ch = g.ch, co = g.co;
    zb.fill(0);
    const L = v3norm([-0.5, -0.6, -0.62]), D = 3.4, cx = cols / 2, cy = rows / 2;
    const K = (s.R * (D - 1)) / 1;
    // 畫一個點：x,y,z 已旋轉；nx,ny,nz 為打光用法向量
    const dot = (x, y, z, nx, ny, nz, hue, scale) => {
      const Z = z + D, iz = 1 / Z, sx = cx + K * x * iz, sy = cy + (K * y * iz) / aspect;
      if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) return;
      const i = (sy | 0) * cols + (sx | 0);
      if (iz <= zb[i]) return;
      zb[i] = iz;
      const front = nz < 0.15, d = nx * L[0] + ny * L[1] + nz * L[2], e = front ? clamp(0.22 + 0.78 * Math.max(0, d), 0, 1) * scale : 0.13;
      ch[i] = front ? DOT_R[Math.min(4, (e * 5) | 0)] : '.'; co[i] = hue === undefined ? C(e) : H(hue, Math.max(0.2, e));
    };
    if (mode === 'fib' || mode === 'spikes' || mode === 'morph' || mode === 'scatter') {
      const M = rotM(t * 0.21, t * 0.37, t * 0.11);
      let mix = 0, sA = 0, sB = 0, per = 7;
      if (mode === 'morph') { const ph = (t + 5) / per; sA = Math.floor(ph) % 5; sB = (sA + 1) % 5; mix = smooth(0.65, 1, ph - Math.floor(ph)); }
      if (mode === 'scatter') { const ph = ((t + 3) % 12) / 12; mix = ph < 0.35 ? 0 : ph < 0.55 ? smooth(0.35, 0.55, ph) : ph < 0.75 ? 1 : 1 - smooth(0.75, 0.97, ph); }
      for (let i = 0; i < N; i++) {
        let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = x, ny = y, nz = z, hue;
        if (mode === 'spikes') {
          const a = Math.atan2(z, x), r = 1 + 0.2 * Math.sin(5 * Math.acos(y) + t * 2) * Math.sin(4 * a - t * 1.5) + 0.08 * Math.sin(9 * y + t * 3);
          x *= r * 0.85; y *= r * 0.85; z *= r * 0.85;
        } else if (mode === 'morph') {
          morphShape(sA, x, y, z); const ax = SHX, ay = SHY, az = SHZ;
          if (mix > 0) { morphShape(sB, x, y, z); x = ax + (SHX - ax) * mix; y = ay + (SHY - ay) * mix; z = az + (SHZ - az) * mix; } else { x = ax; y = ay; z = az; }
          const l = Math.hypot(x, y, z) || 1; nx = x / l; ny = y / l; nz = z / l; hue = P[i * 3 + 1] * 140 + t * 20;
        } else if (mode === 'scatter') {
          x += (s.Q[i * 3] - x) * mix; y += (s.Q[i * 3 + 1] - y) * mix; z += (s.Q[i * 3 + 2] - z) * mix;
        }
        const X = M[0] * x + M[1] * y + M[2] * z, Y = M[3] * x + M[4] * y + M[5] * z, Z = M[6] * x + M[7] * y + M[8] * z;
        const NX = M[0] * nx + M[1] * ny + M[2] * nz, NY = M[3] * nx + M[4] * ny + M[5] * nz, NZ = M[6] * nx + M[7] * ny + M[8] * nz;
        if (mode === 'scatter' && mix > 0.02) { const Zs = Z + D; if (Zs < 0.4) continue; dot(X, Y, Z, 0, 0, -1, undefined, clamp(1.3 - mix * 0.5 - Zs * 0.08, 0.2, 1)); }
        else dot(X, Y, Z, NX, NY, NZ, hue, 1);
      }
    } else if (mode === 'gyro') {
      const core = 0.42, Mc = rotM(t * 0.3, t * 0.5, 0);
      for (let i = 0; i < N; i += 4) { const x = P[i * 3] * core, y = P[i * 3 + 1] * core, z = P[i * 3 + 2] * core, X = Mc[0] * x + Mc[1] * y + Mc[2] * z, Y = Mc[3] * x + Mc[4] * y + Mc[5] * z, Z = Mc[6] * x + Mc[7] * y + Mc[8] * z; dot(X, Y, Z, X / core, Y / core, Z / core, undefined, 1); }
      const nr = Math.ceil(s.R * 9);
      for (let r = 0; r < 3; r++) {
        const rad = 0.72 + r * 0.14, M = rotM(t * (0.4 + r * 0.23) + r, t * (0.3 - r * 0.17), r * 1.1);
        for (let k = 0; k < nr; k++) {
          const a = (k / nr) * TAU;
          for (const w of [-0.035, 0, 0.035]) {
            const x = Math.cos(a) * rad, y = w, z = Math.sin(a) * rad, X = M[0] * x + M[1] * y + M[2] * z, Y = M[3] * x + M[4] * y + M[5] * z, Z = M[6] * x + M[7] * y + M[8] * z;
            dot(X, Y, Z, X / rad, Y / rad, Z / rad, undefined, 1);
          }
        }
      }
    } else if (mode === 'orbit') {
      const bodies = [[0.95, 0, 0.8, 1], [0.95, Math.PI, 0.8, 1], [1.7, 1.3, 0.35, 0.6]];
      for (const [orb, ph, sz, sp] of bodies) {
        const a = t * 0.5 * sp + ph, ox = Math.cos(a) * orb * 1.25 * (sz < 0.5 ? s.stMoon : s.st), oz = Math.sin(a) * orb * 0.9, oy = Math.sin(a) * orb * (sz < 0.5 ? 0.25 : 0.5), M = rotM(t * 0.4 + ph, t * 0.6, 0), step = sz < 0.5 ? 3 : 1;
        for (let i = 0; i < N; i += step) {
          const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], X = M[0] * x + M[1] * y + M[2] * z, Y = M[3] * x + M[4] * y + M[5] * z, Z = M[6] * x + M[7] * y + M[8] * z;
          dot(X * sz + ox, Y * sz + oy, Z * sz + oz, X, Y, Z, undefined, 1);
        }
      }
    } else { // shells
      for (let sh = 0; sh < 3; sh++) {
        const rad = 1 - sh * 0.3, M = rotM(t * (0.2 + sh * 0.15) * (sh % 2 ? -1 : 1), t * (0.33 - sh * 0.08), sh), step = sh === 0 ? 2 : sh === 1 ? 2 : 3;
        for (let i = sh; i < N; i += step) {
          const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
          if (sh === 0 && Math.abs(y * 6 + Math.sin(t)) % 1 < 0.45) continue; // 外殼挖出條紋，裡層才看得到
          const X = M[0] * x + M[1] * y + M[2] * z, Y = M[3] * x + M[4] * y + M[5] * z, Z = M[6] * x + M[7] * y + M[8] * z;
          dot(X * rad, Y * rad, Z * rad, X, Y, Z, undefined, 0.7 + sh * 0.15);
        }
      }
    }
  } });

})();
