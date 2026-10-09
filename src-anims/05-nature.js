// 自然與天氣場景（na- 開頭）。整個檔案包在函式裡，輔助常數不會和其他模組撞名。
(() => {
/* ───────── 共用工具 ───────── */
// 可無縫平鋪的 256×256 碎形雜訊貼圖（數值 0–1、分布已拉平），取樣比 Noise.n3 快很多
const TN = 256;
let TX = null;
function tex() {
  if (TX) return TX;
  const T = new Float32Array(TN * TN);
  let seed = 4242;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let amp = 1;
  for (const P of [4, 8, 16, 32, 64]) {
    const L = new Float32Array(P * P);
    for (let i = 0; i < L.length; i++) L[i] = r();
    const cs = TN / P;
    for (let y = 0; y < TN; y++) {
      const gy = y / cs, iy = Math.floor(gy), a0 = gy - iy, fy = a0 * a0 * (3 - 2 * a0), r0 = (iy % P) * P, r1 = ((iy + 1) % P) * P;
      for (let x = 0; x < TN; x++) {
        const gx = x / cs, ix = Math.floor(gx), b0 = gx - ix, fx = b0 * b0 * (3 - 2 * b0), c0 = ix % P, c1 = (ix + 1) % P;
        const a = L[r0 + c0], b = L[r0 + c1], c = L[r1 + c0], d = L[r1 + c1];
        T[y * TN + x] += amp * (a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy);
      }
    }
    amp *= 0.48;
  }
  // 依排名重新對應成 0–1 均勻分布，覆蓋率門檻比較好算
  const idx = new Uint32Array(T.length);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  const sorted = Array.from(idx).sort((a, b) => T[a] - T[b]);
  const out = new Float32Array(T.length);
  for (let k = 0; k < sorted.length; k++) out[sorted[k]] = k / (sorted.length - 1);
  return (TX = out);
}
// 雙線性取樣（座標以貼圖像素為單位，自動循環）
function nz(x, y) {
  const T = TX, xf = Math.floor(x), yf = Math.floor(y), fx = x - xf, fy = y - yf;
  const x0 = xf & 255, x1 = (xf + 1) & 255, y0 = (yf & 255) << 8, y1 = ((yf + 1) & 255) << 8;
  const a = T[y0 + x0], b = T[y0 + x1], c = T[y1 + x0], d = T[y1 + x1];
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}
// 現在是不是真彩模式（預設配色＋hue:true 或彩虹配色）；是的話用寫實顏色，否則全部交給主題的 C()
const hueOn = f => f.H(0, 0.6) !== f.H(120, 0.6);
// 調色盤：stops 由暗到亮的 [r,g,b]；非真彩時改用主題亮度 a→b
function pal(f, hue, stops, a, b, n) {
  n = n || 40;
  const out = new Array(n);
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    if (!hue) { out[k] = f.C(a + (b - a) * t); continue; }
    const u = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(u)), fr = u - i, A0 = stops[i], B0 = stops[i + 1];
    out[k] = rgb(A0[0] + (B0[0] - A0[0]) * fr, A0[1] + (B0[1] - A0[1]) * fr, A0[2] + (B0[2] - A0[2]) * fr);
  }
  return out;
}
const pc = (P, v) => P[v <= 0 ? 0 : v >= 1 ? P.length - 1 : (v * (P.length - 1) + 0.5) | 0];
const bgc = (f, hue, c) => { if (hue) f.bg = rgb(c[0], c[1], c[2]); };
const smooth = v => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
// 從陣列裡快速移除（和最後一個交換）
const kill = (arr, k) => { arr[k] = arr[arr.length - 1]; arr.pop(); };
const R10 = ' .:-=+*#%@';
const rc = (str, v) => str[v <= 0 ? 0 : v >= 1 ? str.length - 1 : (v * (str.length - 1) + 0.5) | 0];
// 剪影（山、林線）：top[x] 是每一欄的頂端 y（可為小數），頂端用 1/8 方塊畫出平滑邊緣
const EIGHTH = ' ▁▂▃▄▅▆▇█';
function sil(g, top, P, lo, hi, tex2, y1) {
  const { cols, ch, co } = g, rows = y1 === undefined ? g.rows : y1;
  for (let x = 0; x < cols; x++) {
    const tp = top[x];
    if (tp >= rows) continue;
    const ty = Math.max(0, Math.floor(tp));
    for (let y = ty; y < rows; y++) {
      const i = y * cols + x;
      if (y === ty && tp > 0) {
        const k = Math.round((ty + 1 - tp) * 8);
        if (k <= 0) continue;
        ch[i] = EIGHTH[k]; co[i] = pc(P, hi);
      } else { ch[i] = '█'; co[i] = pc(P, tex2 ? lo + (hi - lo) * 0.5 * nz(x * 0.9, y * 1.7) : lo); }
    }
  }
}
// 在格子上點一個小粒子：如果那格是實心方塊就只改顏色（避免挖出背景色的洞）
function dot(g, x, y, c, col) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return;
  const i = y * g.cols + x, o = g.ch[i], k = o.charCodeAt(0);
  if (k >= 0x2580 && k <= 0x259f) g.co[i] = col; else { g.ch[i] = c; g.co[i] = col; }
}
// 一維地形：給 0–1 的位置，回傳 0–1 的高度（多層取樣）
const ridge = (u, row, sharp) => {
  const a = nz(u, row) * 0.62 + nz(u * 2.7, row + 31) * 0.28 + nz(u * 7.3, row + 67) * 0.1;
  return sharp ? 1 - Math.abs(a * 2 - 1) : a;
};
// 尖峰山形（寬大的山體＋少量細節）
const peak = (u, row) => Math.pow(1 - Math.abs(nz(u * 0.55, row) * 2 - 1), 1.5) * 0.74 + (1 - Math.abs(nz(u * 1.7, row + 5) * 2 - 1)) * 0.2 + nz(u * 5, row + 11) * 0.06;

/* ═════════ 1. 流雲天空 ═════════ */
A({ id: 'na-clouds', name: '流雲天空', cat: '自然', theme: 'ice', hue: true, desc: '雲朵隨風飄過太陽與藍天',
  params: { mode: 'day', cover: 0.5, scale: 1, sx: 1, speed: 1, body: 'sun', bx: 0.76, by: 0.2, rays: 0, cells: 0, persp: 0, wisp: 0, land: 0.1, top: 0 },
  variants: [
    { id: 'moon', name: '月夜', desc: '月光鑲亮雲邊，雲隙透出星光', params: { mode: 'night', body: 'moon', cover: 0.46, speed: 0.6, bx: 0.3, by: 0.24 } },
    { id: 'cirrus', name: '卷雲', desc: '高空細長的絲狀卷雲', params: { sx: 0.2, cover: 0.42, scale: 1.2, wisp: 1, speed: 1.6, bx: 0.2, by: 0.3, land: 0.06 } },
    { id: 'gloom', name: '烏雲', desc: '低垂的灰色雲層快速翻湧', params: { mode: 'grey', body: 'none', cover: 0.72, speed: 3.2, scale: 0.75, land: 0.13 } },
    { id: 'mackerel', name: '魚鱗天', desc: '一片片排列整齊的高積雲', params: { cells: 1, cover: 0.62, speed: 0.7, scale: 1, bx: 0.5, by: 0.1 } },
    { id: 'rays', name: '雲隙光', desc: '陽光從雲縫灑下一道道光束', params: { rays: 1, cover: 0.7, by: 0.15, bx: 0.55, speed: 0.5, mode: 'soft', top: 0.38 } },
    { id: 'dusk', name: '晚霞', desc: '夕陽把雲底染成橘紅與粉紫', params: { mode: 'dusk', by: 0.76, bx: 0.5, cover: 0.58, sx: 0.5, speed: 0.6, land: 0.12, top: 0.56 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.stars = [];
    for (let k = 0, n = (cols * rows / 55) | 0; k < n; k++) s.stars.push([rint(0, cols - 1), rint(0, rows - 1), rnd(0, TAU), Math.random()]);
    s.land = new Float32Array(cols);
    for (let x = 0; x < cols; x++) s.land[x] = rows * (1 - p.land * (0.3 + 0.9 * ridge((x / cols) * 150, 211)));
    s.E = new Float32Array(cols * rows);
    s.key = null;
  },
  pals(s, f) {
    const p = f.p, h = (s.hue = hueOn(f)), m = p.mode;
    s.key = f.C;
    const S = {
      day: { bg: [30, 84, 160], cl: [[78, 104, 150], [150, 172, 206], [226, 234, 248], [255, 255, 255]], body: [[255, 214, 120], [255, 250, 225]], land: [[10, 34, 24], [36, 80, 46]], star: [[200, 210, 255], [255, 255, 255]] },
      soft: { bg: [36, 62, 104], cl: [[50, 62, 88], [112, 126, 152], [206, 210, 220], [255, 248, 232]], body: [[255, 214, 140], [255, 252, 235]], land: [[10, 22, 20], [30, 54, 40]], star: [[200, 210, 255], [255, 255, 255]] },
      night: { bg: [4, 7, 20], cl: [[22, 26, 46], [56, 64, 96], [140, 152, 190], [236, 240, 255]], body: [[170, 176, 160], [250, 248, 230]], land: [[1, 2, 6], [8, 12, 22]], star: [[110, 120, 170], [255, 255, 255]] },
      grey: { bg: [18, 20, 26], cl: [[30, 33, 40], [62, 66, 76], [110, 114, 124], [168, 172, 182]], body: [[200, 200, 200], [255, 255, 255]], land: [[6, 8, 8], [22, 26, 24]], star: [[110, 120, 170], [255, 255, 255]] },
      dusk: { bg: [30, 10, 42], cl: [[48, 22, 60], [136, 56, 106], [246, 118, 104], [255, 214, 150]], body: [[255, 110, 40], [255, 236, 170]], land: [[6, 2, 10], [22, 8, 26]], star: [[160, 120, 200], [255, 230, 255]] },
    }[m];
    s.bg = S.bg;
    s.Pc = pal(f, h, S.cl, 0.12, 1);
    s.Pb = pal(f, h, S.body, 0.6, 1);
    s.Pl = pal(f, h, S.land, 0.03, 0.2);
    s.Ps = pal(f, h, S.star, 0.25, 0.9);
    s.Pc2 = pal(f, h, [[30, 16, 52], [86, 48, 118], [176, 108, 188], [240, 200, 240]], 0.12, 0.9);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, p } = f;
    if (s.key !== f.C) this.pals(s, f);
    bgc(f, s.hue, s.bg);
    const ch = g.ch, co = g.co, E = s.E, Pc = s.Pc, Pb = s.Pb, night = p.mode === 'night', dusk = p.mode === 'dusk';
    const k = (100 / cols) * p.scale, kx = k * p.sx, ky = k * aspect * 1.6, sp = t * p.speed * 2.4;
    const th = 1 - p.cover, gain = p.wisp ? 5 : 3, top = p.top;
    const bx = cols * p.bx, by = rows * p.by, R = Math.max(1.6, rows * aspect * 0.07), R2 = R * R;
    const hasBody = p.body !== 'none', moon = p.body === 'moon', rays = p.rays, cells = p.cells, wisp = p.wisp, persp = p.persp;
    let lx = (p.bx - 0.5) * 2, ly = (p.by - 0.5) * 2;
    const ll = Math.hypot(lx, ly) || 1;
    lx = (lx / ll) * 2.2; ly = (ly / ll) * 2.2;
    if (dusk) { lx = 0; ly = 2.6; }
    const hz = rows * (1 - p.land * 0.7), cx = cols * 0.5;
    for (let y = 0; y < rows; y++) {
      const yf = y / rows, zf = 1 + 0.8 * yf * yf, sub = top ? Math.max(0, yf - top) * 5 : 0;
      for (let x = 0, i = y * cols; x < cols; x++, i++) {
        E[i] = 0;
        if (y >= s.land[x]) continue;
        let u, v, fade = 1;
        if (persp) {
          const dy = (hz - y) / rows;
          if (dy < 0.03) continue;
          const z = 1 / dy;
          u = (x - cx) * k * z * 1.1;
          v = z * 48 - sp * 1.2;
          fade = smooth((dy - 0.03) * 5);
        } else { u = (x - cx) * kx * zf + sp; v = y * ky * zf; }
        let d = nz(u, v) * 0.8 + nz(u * 2.6 + 91 - sp * 0.45, v * 2.6 + 37) * 0.2;
        if (cells) {
          const w = nz(u * 0.5 + 50, v * 0.5) * 3;
          const m = (0.5 + 0.5 * Math.cos(u * 0.62 + w + 1.3 * Math.sin(v * 0.15))) * (0.5 + 0.5 * Math.cos(v * 0.34 + w * 0.6));
          d = d * 0.78 + Math.sqrt(m) * 0.42 - 0.17;
        }
        let e = ((d - th) * gain - sub) * fade;
        let bl = 0, bch = '';
        if (hasBody) {
          const dx = x + 0.5 - bx, dy = (y + 0.5 - by) * aspect, dd = dx * dx + dy * dy;
          if (dd < R2) {
            bl = 1; bch = dd < R2 * 0.55 ? '@' : '#';
            if (moon) { const cr = nz(dx * 0.9 + 40, dy * 0.9 + 40); if (cr > 0.68) bch = '%'; else if (cr < 0.22) bch = 'O'; }
          } else if (dd < R2 * 9) bl = 0.42 * (1 - Math.sqrt(dd / (R2 * 9))) ** 1.6;
          if (rays && e < 0.3 && dy > R) {
            const a = Math.atan2(dy, dx), dist = Math.sqrt(dd);
            const w = Math.sin(a * 34 + nz(a * 20, t * 0.25) * 9);
            const r = w > 0.55 ? (w - 0.55) * 2.2 * nz(a * 60 + 7, t * 0.4) : 0;
            if (r > 0) {
              const rl = r * Math.max(0, 1 - dist / (rows * aspect * 1.1)) * (1 - Math.max(0, e) * 3);
              if (rl > 0.06 && rl > bl) { const ad = a - Math.PI / 2; bl = rl; bch = Math.abs(ad) < 0.3 ? '|' : Math.abs(ad) > 1.2 ? '-' : ad < 0 ? '\\' : '/'; }
            }
          }
        }
        if (e <= 0) {
          if (bl > 0.06) { ch[i] = bch || rc(' .:-=+', bl * 1.8); co[i] = pc(Pb, bl * 0.9); }
          continue;
        }
        if (e > 1) e = 1;
        E[i] = e;
        const u2 = u + lx, v2 = v + ly;
        const d2 = nz(u2, v2) * 0.72 + nz(u2 * 2.4 + 91 - sp * 0.45, v2 * 2.4 + 37) * 0.28;
        const lit = clamp(0.5 + (d - d2) * 10, 0, 1);
        let lum = e * (0.3 + 0.7 * lit);
        if (bl > 0) lum += bl * (1 - e) * 1.6;
        if (night) lum *= 0.72 + bl * 1.5;
        if (bl >= 1 && e < 0.6) { ch[i] = bch; co[i] = pc(Pb, 1 - e * 0.5); continue; }
        if (lum < 0.05) continue;
        const L = lum > 1 ? 1 : lum;
        ch[i] = wisp ? rc(' .-~=≈', L) : R10[Math.min(9, 1 + ((L * 9) | 0))];
        co[i] = dusk && y < hz * 0.55 ? pc(s.Pc2, L * (0.5 + yf)) : pc(Pc, L);
      }
    }
    if (night || dusk) {
      const Ps = s.Ps;
      for (const st of s.stars) {
        const [x, y, ph, b] = st, i = y * cols + x;
        if (y >= s.land[x] - 1 || E[i] > 0.04 || ch[i] !== ' ' || (dusk && y > rows * 0.45)) continue;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.6 + b) + ph));
        ch[i] = b > 0.93 ? '+' : b > 0.7 ? '·' : '.'; co[i] = pc(Ps, tw * (0.4 + b * 0.6));
      }
    }
    sil(g, s.land, s.Pl, 0.25, 0.9, true);
  } });

/* ═════════ 2. 層巒晨昏 ═════════ */
// 各時段的配色：lo = 太陽低（或夜晚），hi = 太陽高
const VISTA = {
  dawn: { lo: { bg: [34, 18, 56], haze: [246, 146, 118], far: [146, 92, 136], near: [22, 12, 36], sun: [255, 128, 56], glow: [255, 170, 110] },
          hi: { bg: [56, 104, 168], haze: [210, 220, 236], far: [116, 144, 178], near: [16, 34, 46], sun: [255, 244, 210], glow: [255, 236, 190] } },
  dusk: { lo: { bg: [28, 8, 36], haze: [255, 112, 76], far: [118, 52, 100], near: [16, 6, 20], sun: [255, 86, 40], glow: [255, 120, 70] },
          hi: { bg: [74, 52, 112], haze: [255, 186, 140], far: [148, 104, 150], near: [32, 18, 40], sun: [255, 210, 140], glow: [255, 190, 130] } },
  night: { lo: { bg: [3, 5, 14], haze: [44, 54, 92], far: [34, 42, 70], near: [5, 7, 14], sun: [244, 242, 222], glow: [120, 130, 170] },
           hi: { bg: [4, 7, 18], haze: [54, 64, 104], far: [40, 50, 80], near: [6, 8, 16], sun: [250, 248, 230], glow: [150, 160, 200] } },
  day: { lo: { bg: [44, 92, 150], haze: [190, 210, 230], far: [104, 140, 160], near: [20, 54, 26], sun: [255, 244, 200], glow: [255, 250, 220] },
         hi: { bg: [36, 96, 170], haze: [200, 220, 240], far: [96, 138, 168], near: [18, 60, 26], sun: [255, 252, 230], glow: [255, 252, 230] } },
  snow: { lo: { bg: [40, 76, 140], haze: [190, 206, 236], far: [104, 122, 164], near: [22, 28, 44], sun: [255, 240, 210], glow: [255, 240, 220] },
          hi: { bg: [44, 98, 176], haze: [204, 218, 244], far: [112, 132, 176], near: [26, 32, 50], sun: [255, 252, 236], glow: [255, 250, 236] } },
  sea: { lo: { bg: [30, 26, 70], haze: [255, 170, 150], far: [88, 72, 120], near: [18, 16, 40], sun: [255, 150, 80], glow: [255, 180, 140] },
         hi: { bg: [52, 100, 176], haze: [226, 230, 246], far: [86, 108, 150], near: [16, 26, 48], sun: [255, 246, 214], glow: [255, 240, 210] } },
};
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 顏色往另一色淡出（倒影用）：每個（目標色, 程度）一張快取表，逐格查表不用組字串
const DIMC = new Map();
function dimMap(to, k) {
  const kq = Math.round(k * 40), key = to + kq;
  let m = DIMC.get(key);
  if (m === undefined) { if (DIMC.size > 400) DIMC.clear(); m = new Map(); m.to = parseInt(to.slice(1), 16); m.k = kq / 40; DIMC.set(key, m); }
  return m;
}
function dimc2(m, c) {
  let r = m.get(c);
  if (r === undefined) {
    const a = parseInt(c.slice(1), 16), b = m.to, k = m.k;
    const f = s => ((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k;
    r = rgb(f(16), f(8), f(0));
    m.set(c, r);
  }
  return r;
}
A({ id: 'na-vista', name: '層巒晨昏', cat: '場景', theme: 'sunset', hue: true, desc: '層層山巒與晨霧，太陽緩緩升起',
  params: { mode: 'dawn', L: 6, top: 0.36, bot: 0.86, amp: 1, sharp: 0, mist: 0.7, lake: 0, sea: 0, bow: 0, snow: 0, stars: 0, birds: 0, boat: 0, trees: 2, pan: 1, elLo: 0.02, elHi: 0.55, period: 150, sunX: 0.62, sun: 1, ink: 0 },
  variants: [
    { id: 'dusk', name: '夕照湖', desc: '夕陽沉入山後，湖面映著餘暉', params: { mode: 'dusk', L: 5, top: 0.38, bot: 0.62, lake: 0.66, birds: 1, mist: 0.35, elLo: 0.02, elHi: 0.4, sunX: 0.42, period: 130 } },
    { id: 'sea', name: '雲海', theme: 'lavender', desc: '尖峰探出翻騰的雲海', params: { mode: 'sea', L: 6, top: 0.26, bot: 0.94, sharp: 1, amp: 1.5, sea: 0.56, mist: 0.25, trees: 1, elLo: 0.35, elHi: 0.62, sunX: 0.3, pan: 0.5 } },
    { id: 'stars', name: '星湖', theme: 'ocean', desc: '銀河與月光倒映在靜謐湖面', params: { mode: 'night', L: 4, top: 0.44, bot: 0.62, lake: 0.66, stars: 1, mist: 0.2, elLo: 0.45, elHi: 0.62, sunX: 0.72, pan: 0.3, amp: 0.8 } },
    { id: 'bow', name: '雨後', theme: 'forest', desc: '陣雨過後，綠色山丘掛起彩虹', params: { mode: 'day', L: 5, top: 0.56, bot: 0.88, bow: 1, mist: 0.3, amp: 0.7, elLo: 0.5, elHi: 0.62, sun: 0 } },
    { id: 'snow', name: '雪嶺', theme: 'ice', desc: '覆雪的鋸齒山脈，細雪紛飛', params: { mode: 'snow', L: 5, top: 0.3, bot: 0.84, sharp: 1, amp: 1.6, snow: 1, mist: 0.35, trees: 1, elLo: 0.45, elHi: 0.6, sunX: 0.82, pan: 0.4 } },
    { id: 'ink', name: '水墨', theme: 'paper', hue: false, desc: '白紙上的水墨山水與一葉扁舟', params: { mode: 'dawn', L: 5, top: 0.3, bot: 0.62, lake: 0.68, mist: 1, boat: 1, birds: 1, sharp: 1, amp: 1.4, elLo: 0.3, elHi: 0.4, sunX: 0.78, pan: 0.5, ink: 1, trees: 1, sun: 0 } },
    { id: 'fold', name: '千山', theme: 'synth', desc: '十多層山稜一路疊到天邊', params: { mode: 'dusk', L: 11, top: 0.32, bot: 0.92, amp: 0.55, mist: 0.9, trees: 0, elLo: 0.1, elHi: 0.32, sunX: 0.5, pan: 0.6 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.lay = [];
    for (let k = 0; k < p.L; k++) {
      const q = p.L > 1 ? k / (p.L - 1) : 1;
      let base = rows * (p.top + (p.bot - p.top) * Math.pow(q, 1.15));
      if (p.sea && k < p.L - 1) base = rows * (p.top + (p.sea + 0.1 - p.top) * (k / (p.L - 2)));
      s.lay.push({ base, amp: rows * (0.1 + 0.1 * (1 - q)) * (p.sea && k === p.L - 1 ? 0.6 : p.amp), span: 70 + 90 * q, row: 17 + k * 23,
        spd: p.pan * (0.25 + 3.2 * q * q), off: rnd(0, 1000), trees: k >= p.L - p.trees, q });
    }
    s.T = new Float32Array(p.L * cols);
    s.minT = new Float32Array(cols);
    s.stars = [];
    for (let k = 0, n = (cols * rows / (p.stars ? 18 : 60)) | 0; k < n; k++) s.stars.push([rint(0, cols - 1), rint(0, rows - 1), rnd(0, TAU), Math.random()]);
    s.birds = []; s.fx = [];
    s.boatX = rnd(0.2, 0.6) * cols;
    s.P = [];
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, hue = hueOn(f);
    const cyc = 0.5 - 0.5 * Math.cos((t / p.period + 0.22) * TAU);
    const el = p.elLo + (p.elHi - p.elLo) * cyc, elc = clamp(el * 1.6, 0, 1);
    const V = VISTA[p.mode], lo = V.lo, hi = V.hi;
    const cBg = mix3(lo.bg, hi.bg, elc), cHz = mix3(lo.haze, hi.haze, elc), cFar = mix3(lo.far, hi.far, elc), cNear = mix3(lo.near, hi.near, elc), cSun = mix3(lo.sun, hi.sun, elc), cGl = mix3(lo.glow, hi.glow, elc);
    if (hue) f.bg = rgb(cBg[0], cBg[1], cBg[2]);
    const bgS = hue ? f.bg : f.C(0);
    const wl = p.lake ? Math.floor(rows * p.lake) : rows, y1 = Math.min(wl, rows);
    const L = s.lay.length, T = s.T, minT = s.minT;
    // 先算出每一層山的稜線
    minT.fill(rows);
    for (let k = 0; k < L; k++) {
      const ly = s.lay[k], off = ly.off + t * ly.spd, o = k * cols;
      for (let x = 0; x < cols; x++) {
        const u = ((x + off) / cols) * ly.span;
        let h = ly.base - ly.amp * (p.sharp ? peak(u, ly.row) * 1.35 : ridge(u, ly.row));
        if (ly.trees) {
          const tw = 2 + ly.q * 3, cell = Math.floor((x + off) / tw), fr = (x + off) / tw - cell, hh = hash2(cell, k);
          if (hh > 0.3) h -= (1 - Math.abs(fr * 2 - 1)) * (0.8 + hh * 2.2) * (0.6 + ly.q * 0.8) * (rows / 60);
        }
        T[o + x] = h;
        if (h < minT[x]) minT[x] = h;
      }
    }
    const horizon = p.lake ? wl : rows * (p.top + 0.08);
    const night = p.mode === 'night';
    const sx = cols * p.sunX + (night ? 0 : (cyc - 0.5) * cols * 0.12), sy = horizon - horizon * (0.1 + el * 1.05);
    const R = Math.max(1.5, rows * aspect * (night ? 0.05 : 0.065));
    const Pg = pal(f, hue, [cBg, cGl], 0.08, 0.5, 24), Psun = pal(f, hue, [cGl, cSun], 0.6, 1, 12);
    // 天空：光暈＋地平線霞光
    const glowK = !p.sun ? 0 : night ? 0.5 : 1.1 - elc * 0.55, rr2 = (rows * aspect * 0.55) ** 2 * 0.12;
    for (let y = 0; y < y1; y++) {
      const hb = Math.exp(-Math.max(0, horizon - y) / (rows * 0.16)) * (night ? 0.18 : 0.5 * (1 - elc * 0.7));
      for (let x = 0, i = y * cols; x < cols; x++, i++) {
        if (y >= minT[x] - 1) continue;
        const dx = x - sx, dy = (y - sy) * aspect, d2 = dx * dx + dy * dy;
        if (p.sun && d2 < R * R) { ch[i] = night ? (nz(dx + 40, dy + 40) > 0.62 ? '%' : '@') : '@'; co[i] = pc(Psun, 1 - (d2 / (R * R)) * 0.4); continue; }
        let gl = hb + glowK * Math.exp(-d2 / rr2) * 0.6;
        if (gl < 0.1) continue;
        gl += hash2(x, y) * 0.22 - 0.11;
        if (gl < 0.1) continue;
        ch[i] = gl > 0.62 ? '=' : gl > 0.42 ? '-' : gl > 0.25 ? ':' : '.';
        co[i] = pc(Pg, gl);
      }
    }
    // 星空與銀河
    if (p.stars || night) {
      const Pst = pal(f, hue, [[80, 90, 140], [255, 255, 255]], 0.2, 0.95, 12);
      for (const st of s.stars) {
        const [x, y, ph, b] = st;
        if (y >= minT[x] - 1 || y >= y1) continue;
        const i = y * cols + x;
        if (ch[i] !== ' ') continue;
        let br = 0.3 + 0.7 * b;
        if (p.stars) br *= Math.abs(y / rows - (0.08 + 0.55 * (x / cols))) < 0.12 ? 1.25 : 0.7;
        ch[i] = b > 0.96 ? '*' : b > 0.8 ? '+' : b > 0.5 ? '·' : '.'; co[i] = pc(Pst, br * (0.55 + 0.45 * Math.sin(t * (1 + b * 2) + ph)));
      }
      if (p.stars) {
        const Pmw = pal(f, hue, [[30, 30, 70], [160, 150, 210]], 0.1, 0.45, 12);
        for (let y = 0; y < y1; y++) for (let x = 0; x < cols; x++) {
          const band = Math.abs(y / rows - (0.08 + 0.55 * (x / cols)));
          if (band > 0.11 || y >= minT[x] - 1) continue;
          const i = y * cols + x;
          if (ch[i] !== ' ') continue;
          const v = nz(x * 0.5, y * 1.1) * (1 - band * 9);
          if (v > 0.3 && hash2(x, y) < v * 0.85) { ch[i] = v > 0.55 ? ':' : '.'; co[i] = pc(Pmw, v); }
        }
      }
    }
    // 彩虹：陣雨→彩虹→淡去，循環
    if (p.bow) {
      const ph = fract(t / 60 + 0.3), rain = ph < 0.35 ? smooth((0.35 - ph) / 0.12) : 0, bow = smooth((ph - 0.22) / 0.15) * smooth((1 - ph) / 0.2);
      if (bow > 0.02) {
        const bcx = cols * 0.5, bcy = rows * 1.08, Rb = cols * 0.46, w = Math.max(2.5, cols * 0.045);
        for (let y = 0; y < y1; y++) for (let x = 0; x < cols; x++) {
          if (y >= minT[x] - 0.5) continue;
          const d = Math.hypot(x - bcx, (y - bcy) * aspect), b = (Rb - d) / w;
          if (b < 0 || b > 1) continue;
          const i = y * cols + x, a = bow * (0.55 + 0.45 * Math.sin(b * Math.PI)) * (0.45 + 0.55 * smooth((bcy - y) / (rows * 0.6)));
          if (a < 0.15) continue;
          ch[i] = a > 0.6 ? '▒' : '░'; co[i] = f.H(b * 270, 0.35 + a * 0.45);
        }
      }
      const want = (rain * cols * rows) / 25;
      while (s.fx.length < want) s.fx.push({ x: rnd(0, cols * 1.2), y: rnd(-rows, 0), v: rnd(30, 45) });
      const rc2 = pc(pal(f, hue, [[150, 170, 200], [200, 215, 235]], 0.3, 0.6, 4), 0.5);
      for (let k = s.fx.length - 1; k >= 0; k--) {
        const d = s.fx[k];
        d.y += d.v * dt; d.x -= d.v * dt * 0.15;
        if (d.y > rows) { if (s.fx.length > want) { kill(s.fx, k); continue; } d.y = rnd(-5, 0); d.x = rnd(0, cols * 1.2); }
        g.set(d.x, d.y, '/', rc2);
      }
    }
    // 山巒：每格找出最前面蓋到它的那一層
    for (let k = 0; k < L; k++) {
      const q = s.lay[k].q;
      const lc = mix3(cFar, cNear, Math.pow(q, 0.8));
      s.P[k] = pal(f, hue, [lc, cHz], p.ink ? 0.12 + 0.55 * q : 0.2 + 0.68 * q, p.ink ? 0 : 0.06, 16);
    }
    const snowC = hue ? [rgb(238, 244, 255), rgb(150, 166, 204)] : [f.C(0.95), f.C(0.62)];
    const seaK = p.sea ? L - 1 : L;
    for (let x = 0; x < cols; x++) {
      const y0 = Math.max(0, Math.floor(minT[x]));
      for (let y = y0; y < y1; y++) {
        let k = L - 1;
        while (k >= 0 && T[k * cols + x] > y + 1) k--;
        if (k < 0) continue;
        const tp = T[k * cols + x], i = y * cols + x;
        let kd = k;
        if (y < tp) {
          // 稜線那一格：後面有山就整格補上，後面是天空就用 1/8 方塊
          let kb = k - 1;
          while (kb >= 0 && T[kb * cols + x] > y + 0.5) kb--;
          const cover = y + 1 - tp;
          if (kb < 0) { const kk = Math.round(cover * 8); if (kk <= 0) continue; ch[i] = EIGHTH[kk]; co[i] = s.P[k][0]; continue; }
          if (cover < 0.5) kd = kb;
        }
        const ly = s.lay[kd], tpd = T[kd * cols + x];
        const dep = (y - tpd) / (rows * 0.16);
        let m = 0;
        if (p.mist > 0) m = p.mist * (1 - ly.q * 0.35) * clamp(dep * 0.55 + (nz(x * 0.06 + t * 0.6 + kd * 30, y * 0.35) - 0.5) * 1.4 * Math.min(1, dep * 2), 0, 1);
        if (p.snow && kd < L - 2 && y < ly.base - ly.amp * (0.5 + 0.3 * nz((x + ly.off + t * ly.spd) * (100 / cols) * 0.5, kd * 7) + 0.08 * Math.sin((x + ly.off + t * ly.spd) * 0.9 + y * 1.7))) {
          const sw = Math.max(2, Math.round(cols / 60)), sl = T[kd * cols + Math.min(cols - 1, x + sw)] - T[kd * cols + Math.max(0, x - sw)];
          ch[i] = '█'; co[i] = snowC[sl > 0 ? 0 : 1];
          continue;
        }
        if (p.ink && m > 0.35) { ch[i] = m > 0.8 ? '░' : m > 0.6 ? '▒' : '▓'; co[i] = s.P[kd][0]; continue; }
        ch[i] = '█'; co[i] = pc(s.P[kd], m);
      }
    }
    if (p.sea) this.cloudSea(s, f, hue, cGl, seaK);
    // 湖面倒影＋日月的光帶
    if (p.lake && wl < rows) {
      const Pw = pal(f, hue, [cBg, cHz], 0.1, 0.4, 8), Pgl = pal(f, hue, [cGl, cSun], 0.5, 1, 8);
      const fadeK = night ? 0.22 : p.ink ? 0.5 : 0.36;
      for (let y = wl; y < rows; y++) {
        const dd = y - wl, sy2 = wl - 1 - Math.floor(dd * 1.1), amp = 0.4 + dd * 0.22, gw = (1.5 + dd * 0.5) * R * 0.5, dm = dimMap(bgS, fadeK + (dd / (rows - wl)) * 0.2);
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          const wv = nz(x * 0.05 + t * 0.2, y * 1.7 - t * 0.5);
          const gx = Math.abs(x - sx);
          if (p.sun && gx < gw && sy < wl) {
            const a = (nz(x * 0.9 + 13, y * 2.3 + t * 1.6) - 0.52) * 4 * (1 - gx / gw);
            if (a > 0.12) { ch[i] = a > 0.6 ? '=' : '-'; co[i] = pc(Pgl, a); continue; }
          }
          const sx2 = Math.round(x + (wv - 0.5) * amp * 2.5);
          if (sy2 >= 0 && sx2 >= 0 && sx2 < cols) {
            const j = sy2 * cols + sx2, c = ch[j];
            if (c !== ' ') {
              ch[i] = c.charCodeAt(0) >= 0x2580 && c.charCodeAt(0) <= 0x2593 ? (wv > 0.68 ? '~' : '█') : c === '@' ? '~' : c;
              co[i] = dimc2(dm, co[j]);
              continue;
            }
          }
          if (wv > 0.66) { ch[i] = '-'; co[i] = pc(Pw, 0.3 + (wv - 0.66) * 2); }
        }
      }
    }
    if (p.boat && p.lake) {
      s.boatX += dt * 1.2;
      if (s.boatX > cols + 12) s.boatX = -12;
      const by2 = Math.floor(wl + (rows - wl) * 0.35), bc = hue ? rgb(20, 16, 24) : f.C(0.92);
      g.text(s.boatX + 2, by2 - 2, '|', bc);
      g.text(s.boatX + 2, by2 - 1, '|\\', bc);
      g.text(s.boatX, by2, '\\___/', bc);
      g.text(s.boatX - 2, by2 + 1, '~  ~ ~', f.C(0.35));
    }
    if (p.birds) {
      if (s.birds.length === 0 && Math.random() < dt * 0.1) {
        const n = rint(3, 7), y0 = rnd(0.12, 0.3) * rows, dir = Math.random() < 0.5 ? 1 : -1;
        for (let k = 0; k < n; k++) s.birds.push({ x: dir > 0 ? -3 - k * 3 : cols + 3 + k * 3, y: y0 + Math.abs(k - n / 2) * 0.8, v: dir * rnd(5, 6.5), ph: rnd(0, TAU) });
      }
      const bcol = hue ? rgb(cNear[0] * 0.6, cNear[1] * 0.6, cNear[2] * 0.6) : f.C(0.85);
      for (let k = s.birds.length - 1; k >= 0; k--) {
        const b = s.birds[k];
        b.x += b.v * dt; b.y += Math.sin(t * 0.7 + b.ph) * dt * 0.3;
        if (b.x < -25 || b.x > cols + 25) { kill(s.birds, k); continue; }
        g.set(b.x, b.y, Math.sin(t * 7 + b.ph) > 0 ? 'v' : '^', bcol);
      }
    }
    if (p.snow) {
      const want = (cols * rows) / 45;
      while (s.fx.length < want) s.fx.push({ x: rnd(0, cols), y: rnd(0, rows), v: rnd(2, 6), ph: rnd(0, TAU) });
      const sc = hue ? rgb(250, 252, 255) : f.C(1);
      for (const d of s.fx) {
        d.y += d.v * dt; d.x += Math.sin(t + d.ph) * dt * 1.5 + dt * 1.2;
        if (d.y > rows) { d.y = -1; d.x = rnd(0, cols); }
        if (d.x > cols) d.x -= cols;
        dot(g, d.x, d.y, d.v > 4.5 ? '*' : '·', sc);
      }
    }
  },
  // 雲海：蓋住山腳，只留下高峰；最前面一層（前景山稜）之後再畫
  cloudSea(s, f, hue, cGl, kFront) {
    const { g, cols, rows, t, p } = f, ch = g.ch, co = g.co, T = s.T;
    const Pc = pal(f, hue, [[70, 70, 110], [170, 170, 205], mix3([255, 255, 255], cGl, 0.45), [255, 255, 255]], 0.2, 1, 32);
    const base = rows * p.sea, ks = 110 / cols, ky = ks * f.aspect * 1.7, H = rows * 0.14, sp = t * 1.3;
    const dens = (u, v) => nz(u, v) * 0.7 + nz(u * 2.3 + 50, v * 2.3 - t * 0.3) * 0.3;
    for (let x = 0; x < cols; x++) {
      const u = x * ks + sp, front = T[kFront * cols + x];
      for (let y = Math.max(0, Math.floor(base - H * 1.1)); y < rows; y++) {
        if (y >= front) break;
        const v = y * ky, n = dens(u, v), d = n + (y - base) / H * 0.5, e = (d - 0.5) * 3.2;
        if (e <= 0) continue;
        const i = y * cols + x, lit = clamp(0.5 + (n - dens(u - 0.6, v - 2.2)) * 7 + (e < 0.6 ? 0.3 : 0), 0, 1);
        const lum = Math.min(1, e) * (0.42 + 0.58 * lit) * (1 - clamp((y - base) / (H * 4), 0, 0.35));
        if (lum < 0.06) continue;
        ch[i] = R10[Math.min(9, 1 + ((lum * 9) | 0))];
        co[i] = pc(Pc, lum);
      }
    }
  } });

/* ═════════ 3. 燭火搖曳 ═════════ */
// 單一火焰：cx 中心欄、by 底部列、W 半寬（欄）、Hh 高（列）；P 是火焰調色盤（暗→亮）
function flameAt(g, f, P, cx, by, W, Hh, seed, blueC) {
  const { t, rows, cols } = f, ch = g.ch, co = g.co;
  const H = Hh * (1 + (nz(t * 2.2 + seed * 13, seed) - 0.5) * 0.4);
  const sw = (nz(t * 0.9 + seed * 7, seed + 50) - 0.5) * 2.2;
  const y0 = Math.max(0, Math.floor(by - H - 1)), y1 = Math.min(rows - 1, Math.floor(by));
  for (let y = y0; y <= y1; y++) {
    const v = (by - y - 0.5) / H;
    if (v > 1) continue;
    const vv = v < 0 ? 0 : v;
    const w = W * (vv < 0.28 ? 0.4 + 0.6 * Math.sqrt(vv / 0.28) : Math.pow(1 - (vv - 0.28) / 0.72, 1.15)) + 0.35;
    const off = cx + sw * W * 1.3 * vv * vv + (nz(t * 4 + seed, y * 0.45) - 0.5) * W * 0.6 * vv;
    const xa = Math.max(0, Math.floor(off - w - 1)), xb = Math.min(cols - 1, Math.ceil(off + w + 1));
    for (let x = xa; x <= xb; x++) {
      const dx = Math.abs(x + 0.5 - off) / w;
      if (dx >= 1) continue;
      const I = (1 - dx * dx) * (1 - vv * 0.62) + (nz(x * 0.7 + seed * 3, y * 0.5 + t * 7) - 0.5) * 0.45 * vv;
      if (I < 0.1) continue;
      const i = y * cols + x;
      ch[i] = I > 0.78 ? '@' : I > 0.58 ? '#' : I > 0.4 ? '*' : I > 0.24 ? '+' : ':';
      co[i] = blueC && vv < 0.12 && dx > 0.45 ? blueC : pc(P, I);
    }
  }
}
// 柔和光暈：只畫在空格上
function glowPass(g, f, Pg, L, k, thr) {
  const { cols, rows, aspect } = f, ch = g.ch, co = g.co, n = L.length;
  for (let y = 0; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
    if (ch[i] !== ' ') continue;
    let I = 0;
    for (let j = 0; j < n; j++) { const l = L[j], dx = x - l.x, dy = (y - l.y) * aspect; I += l.a / (1 + (dx * dx + dy * dy) / l.r2); }
    I *= k;
    if (I < thr || hash2(x, y) > (I - thr) * 2.2) continue;
    ch[i] = I > thr * 4 ? ':' : I > thr * 2.2 ? '·' : '.';
    co[i] = pc(Pg, I);
  }
}
const lightAt = (L, x, y, aspect) => { let I = 0; for (const l of L) { const dx = x - l.x, dy = (y - l.y) * aspect; I += l.a / (1 + (dx * dx + dy * dy) / l.r2); } return I; };
A({ id: 'na-flame', name: '燭火搖曳', cat: '場景', theme: 'fire', hue: true, desc: '一支蠟燭靜靜燃燒，火光搖曳',
  params: { mode: 'candle' },
  variants: [
    { id: 'row', name: '燭陣', desc: '高高低低的一排蠟燭', params: { mode: 'row' } },
    { id: 'camp', name: '營火', desc: '星空下的營火，火星往上飄', params: { mode: 'camp' } },
    { id: 'torch', name: '火炬', theme: 'amber', desc: '石牆上的火炬照亮磚縫', params: { mode: 'torch' } },
    { id: 'lamp', name: '油燈', theme: 'gold', desc: '輕輕搖晃的吊掛油燈', params: { mode: 'lamp' } },
    { id: 'lantern', name: '天燈', theme: 'sunset', desc: '滿天天燈緩緩升上夜空', params: { mode: 'lantern' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.parts = []; s.t0 = 0;
    s.stars = Array.from({ length: (cols * rows / 70) | 0 }, () => [rint(0, cols - 1), rint(0, rows - 1), rnd(0, TAU), Math.random()]);
    if (p.mode === 'row') {
      s.cand = [];
      for (const [yy, sc] of [[0.72, 0.62], [0.9, 1]]) {
        const n = clamp(Math.round(cols / (sc > 0.8 ? 24 : 18)), 3, 16);
        for (let k = 0; k < n; k++) s.cand.push({ x: cols * (k + 0.5 + rnd(-0.25, 0.25)) / n, y: rows * yy, w: Math.max(2, Math.round(cols * 0.03 * sc * rnd(0.8, 1.3))), h: rows * sc * rnd(0.12, 0.34), sc, seed: rnd(0, 100) });
      }
    }
    if (p.mode === 'camp') {
      s.tongues = Array.from({ length: 9 }, (_, k) => ({ o: rnd(-0.55, 0.55), h: rnd(0.55, 1), w: rnd(0.16, 0.3), seed: k * 7.7 + rnd(0, 5) }));
      s.trees = new Float32Array(cols);
      for (let x = 0; x < cols; x++) {
        const e = Math.min(x, cols - 1 - x) / cols, tw = 3 + (rows / 30), cell = Math.floor(x / tw), fr = x / tw - cell;
        s.trees[x] = e < 0.22 ? rows * (0.25 + e * 2.4) + (Math.abs(fr * 2 - 1)) * rows * 0.12 * (0.6 + hash2(cell, 3)) : rows;
      }
    }
    if (p.mode === 'wisp') {
      s.wisps = Array.from({ length: clamp((cols / 22) | 0, 4, 14) }, (_, k) => ({ x: rnd(0.08, 0.92) * cols, y: rnd(0.35, 0.72) * rows, seed: k * 13.1, sz: rnd(0.6, 1.2) }));
      s.reeds = Array.from({ length: (cols / 3) | 0 }, () => ({ x: rint(0, cols - 1), h: rnd(0.04, 0.16) * rows, ph: rnd(0, TAU) }));
    }
    if (p.mode === 'lantern') {
      s.lan = [];
      const n = clamp((cols * rows / 380) | 0, 14, 90);
      for (let k = 0; k < n; k++) s.lan.push(this.mkLan(f, true));
      s.lan.sort((a, b) => a.z - b.z);
      s.mtn = new Float32Array(cols);
      for (let x = 0; x < cols; x++) s.mtn[x] = rows * (0.84 - 0.12 * ridge((x / cols) * 120, 77));
    }
  },
  mkLan(f, first) {
    const z = Math.pow(Math.random(), 1.8) * 0.85 + 0.15;
    return { z, x: rnd(0, f.cols), y: first ? rnd(0, f.rows) : f.rows * rnd(0.85, 1.05), vx: rnd(-0.6, 0.9), ph: rnd(0, TAU), seed: rnd(0, 99) };
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Pf = pal(f, h, [[110, 14, 0], [214, 64, 8], [255, 146, 28], [255, 214, 96], [255, 250, 226]], 0.28, 1, 32);
    s.Pblue = pal(f, h, [[0, 30, 70], [10, 110, 200], [90, 210, 255], [230, 255, 255]], 0.25, 1, 32);
    s.Pg = pal(f, h, [[24, 8, 0], [120, 50, 10], [230, 130, 50]], 0.06, 0.5, 24);
    s.Pgb = pal(f, h, [[0, 10, 24], [10, 60, 100], [60, 160, 210]], 0.06, 0.5, 24);
    s.Pwax = pal(f, h, [[40, 24, 16], [150, 110, 80], [236, 210, 170], [255, 244, 220]], 0.1, 0.85, 32);
    s.Pwood = pal(f, h, [[20, 8, 2], [90, 46, 20], [190, 110, 50], [255, 190, 110]], 0.05, 0.7, 32);
    s.Pst = pal(f, h, [[60, 66, 100], [230, 236, 255]], 0.12, 0.7, 12);
    s.Pmetal = pal(f, h, [[30, 20, 8], [130, 96, 40], [230, 190, 110], [255, 240, 190]], 0.12, 0.85, 24);
    s.blue = h ? rgb(60, 120, 255) : f.C(0.5);
  },
  candle(s, f, cx, ty, cw, hc, seed, L) {
    const { g, aspect } = f, Pw = s.Pwax, yt = Math.round(ty - hc), half = cw / 2;
    for (let y = yt; y < ty; y++) for (let x = Math.floor(cx - half); x < cx + half; x++) {
      const xr = (x + 0.5 - cx) / half;
      if (Math.abs(xr) > 1) continue;
      const li = lightAt(L, x, y, aspect);
      const v = (0.25 + 0.45 * Math.sqrt(1 - xr * xr) + 0.1 * (nz(x * 3 + seed, y * 0.3) - 0.5)) * (0.4 + Math.min(1, li) * 0.8);
      g.set(x, y, y === yt ? '▄' : '█', y === yt ? pc(s.Pf, 0.55 + 0.2 * Math.sin(f.t * 3 + seed)) : pc(Pw, v));
    }
    g.set(cx, yt - 1, '|', pc(s.Pwood, 0.15));
    return yt - 1;
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co;
    if (s.key !== f.C) this.pals(s, f);
    const m = p.mode, hue = s.hue;
    if (m === 'candle') {
      const ty = Math.floor(rows * 0.84), cx = Math.floor(cols / 2) + 0.5, cw = Math.max(3, Math.round(cols * 0.055));
      // 蠟燭慢慢燒短；燒完時火焰熄滅冒一縷煙，新蠟燭從燭台上長出來後再點燃（不會突然跳一下）
      const per = 240, lt = ((t % per) + per) % per, life = lt / per;
      let hc = rows * (0.46 - 0.24 * life), fl = 1;
      if (lt > per - 3) fl = (per - lt) / 3;
      else if (lt < 3) { hc = rows * (0.22 + 0.24 * smooth(lt / 2)); fl = smooth((lt - 2) / 1); }
      const H = Math.max(4, rows * 0.22), W = Math.max(1.2, cw * 0.4), by = ty - hc - 1;
      const L = [{ x: cx, y: by - H * 0.4, a: 0.12 + 0.88 * fl, r2: (rows * aspect * 0.35) ** 2 }];
      // 桌面
      for (let y = ty; y < rows; y++) for (let x = 0; x < cols; x++) {
        const li = lightAt(L, x, y, aspect), gr = nz(x * 0.15, y * 3.1);
        g.set(x, y, y === ty ? '=' : gr > 0.6 ? '-' : gr > 0.4 ? '_' : '.', pc(s.Pwood, li * (y === ty ? 0.9 : 0.55)));
      }
      glowPass(g, f, s.Pg, L, 0.55, 0.09);
      // 燭台
      const pw = cw * 1.5;
      for (let x = Math.floor(cx - pw); x < cx + pw; x++) g.set(x, ty - 1, '▄', pc(s.Pmetal, 0.35 + 0.5 * lightAt(L, x, ty - 1, aspect)));
      const wy = this.candle(s, f, cx, ty - 1, cw, hc, 1, L);
      if (fl > 0.02) flameAt(g, f, s.Pf, cx, wy, W * (0.4 + 0.6 * fl), H * fl, 3, s.blue);
      // 熄滅後的一縷輕煙
      const sm = lt > per - 3 ? 1 - fl : lt < 2.5 ? 1 - lt / 2.5 : 0;
      if (sm > 0.02) for (let k = 1; k < rows * 0.3; k++) {
        const q = k / (rows * 0.3), x = cx + Math.sin(k * 0.45 - t * 2.2) * q * 2.5 + q * q * 3;
        if (hash2(k, (t * 6) | 0) > 0.85 - q * 0.3) continue;
        g.set(x, wy - k, q < 0.3 ? '|' : Math.sin(k * 0.45 - t * 2.2) > 0 ? ')' : '(', pc(s.Pst, sm * (0.7 - q * 0.5)));
      }
      return;
    }
    if (m === 'row') {
      const L = s.cand.map(c => ({ x: c.x, y: c.y - c.h - rows * 0.06 * c.sc, a: 0.45 * c.sc, r2: (rows * aspect * 0.18) ** 2 }));
      const ty = Math.floor(rows * 0.9);
      for (let y = ty; y < rows; y++) for (let x = 0; x < cols; x++) g.set(x, y, y === ty ? '=' : '_', pc(s.Pwood, lightAt(L, x, y, aspect) * 0.6));
      glowPass(g, f, s.Pg, L, 0.6, 0.1);
      for (const c of s.cand) {
        const wy = this.candle(s, f, c.x, c.y, c.w, c.h, c.seed, L);
        flameAt(g, f, s.Pf, c.x, wy, Math.max(0.8, c.w * 0.32), Math.max(2.5, rows * 0.11 * c.sc), c.seed, c.sc > 0.8 ? s.blue : null);
      }
      return;
    }
    if (m === 'camp') {
      const gy = Math.floor(rows * 0.8), cx = cols / 2, rx = Math.max(6, cols * 0.13), apex = gy - rows * 0.14;
      const L = [{ x: cx, y: gy - rows * 0.12, a: 1.1 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3), r2: (rows * aspect * 0.45) ** 2 }];
      for (const [x, y, ph, b] of s.stars) if (y < gy - rows * 0.2 && s.trees[x] > y) g.set(x, y, b > 0.9 ? '+' : '.', pc(s.Pst, (0.3 + 0.5 * b) * (0.6 + 0.4 * Math.sin(t * 1.3 + ph))));
      glowPass(g, f, s.Pg, L, 0.5, 0.12);
      // 樹林剪影（被火光微微照亮）
      for (let x = 0; x < cols; x++) for (let y = Math.max(0, Math.floor(s.trees[x])); y < gy; y++) g.set(x, y, '█', pc(s.Pwood, 0.01 + lightAt(L, x, y, aspect) * 0.06));
      for (let y = gy; y < rows; y++) for (let x = 0; x < cols; x++) {
        const li = lightAt(L, x, y, aspect), n = nz(x * 0.5, y * 1.9);
        g.set(x, y, n > 0.7 ? ',' : n > 0.45 ? '.' : n > 0.3 ? '`' : ' ', pc(s.Pwood, li * 0.7));
      }
      // 石圈（後半）
      const stones = Math.max(10, Math.round(rx * 1.4));
      const ring = front => { for (let k = 0; k < stones; k++) { const a = (k / stones) * TAU, sy = Math.sin(a); if ((sy > 0) !== front) continue; const x = cx + Math.cos(a) * rx * 0.85, y = gy + sy * rx * 0.85 / aspect * 0.5; g.set(x, y, k % 3 ? 'O' : '@', pc(s.Pwood, 0.25 + 0.4 * lightAt(L, x, y, aspect))); g.set(x + 1, y, ')', pc(s.Pwood, 0.2 + 0.3 * lightAt(L, x, y, aspect))); } };
      ring(false);
      // 木柴
      for (let k = -2; k <= 2; k++) { const bx = cx + k * rx * 0.28; g.line(bx, gy, cx + k * 0.6, apex, k < 0 ? '/' : k > 0 ? '\\' : '|', pc(s.Pwood, 0.45)); }
      for (let x = Math.floor(cx - rx * 0.7); x < cx + rx * 0.7; x++) g.set(x, gy, '=', pc(s.Pwood, 0.5));
      // 火舌
      for (const tg of s.tongues) flameAt(g, f, s.Pf, cx + tg.o * rx * 0.75, gy - 0.5, rx * tg.w, rows * 0.36 * tg.h * (1 - Math.abs(tg.o) * 0.6), tg.seed, null);
      for (let x = Math.floor(cx - rx * 0.6); x < cx + rx * 0.6; x++) if (hash2(x, (t * 6) | 0) > 0.4) g.set(x, gy, '▄', pc(s.Pf, 0.45 + 0.3 * hash2(x, (t * 4) | 0)));
      ring(true);
      // 火星
      if (s.parts.length < 160 && Math.random() < dt * 22) s.parts.push({ x: cx + rnd(-rx * 0.3, rx * 0.3), y: gy - rows * 0.15, vx: rnd(-2, 2), vy: rnd(-12, -6), l: rnd(1.2, 3.5), l0: 0 });
      for (let k = s.parts.length - 1; k >= 0; k--) {
        const q = s.parts[k];
        q.l -= dt; if (q.l <= 0 || q.y < 0) { kill(s.parts, k); continue; }
        q.vx += (nz(q.x * 0.1, q.y * 0.1 + t) - 0.5) * 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy *= 1 - dt * 0.2;
        g.set(q.x, q.y, q.l > 1.5 ? '*' : '.', pc(s.Pf, 0.3 + Math.min(0.6, q.l * 0.25)));
      }
      return;
    }
    if (m === 'torch') {
      const nT = cols > 150 ? 3 : 2, ty = Math.floor(rows * 0.46), H = rows * 0.3, W = Math.max(1.6, cols * 0.022);
      const tx = Array.from({ length: nT }, (_, k) => Math.round(cols * (k + 0.5) / nT));
      const L = tx.map((x, k) => ({ x, y: ty - H * 0.4, a: 1 + 0.12 * Math.sin(t * 7 + k * 2) * Math.sin(t * 4.1 + k), r2: (rows * aspect * 0.3) ** 2 }));
      // 磚牆
      const bh = Math.max(2, Math.round(rows / 22)), bw = bh * 4 + 1, floorY = Math.floor(rows * 0.86);
      for (let y = 0; y < floorY; y++) {
        const course = Math.floor(y / bh), mort = y % bh === bh - 1, shift = (course & 1) * (bw >> 1);
        for (let x = 0; x < cols; x++) {
          const li = lightAt(L, x, y, aspect);
          if (li < 0.06) continue;
          const joint = (x + shift) % bw === 0, n = nz(x * 2.9, y * 4.3) * 0.6 + hash2(x, y) * 0.4;
          const c = mort ? '_' : joint ? '|' : n > 0.7 ? ':' : n > 0.56 ? '.' : ' ';
          if (c === ' ') continue;
          g.set(x, y, c, pc(s.Pwood, Math.min(1, li * 1.4) * (mort || joint ? 0.62 : 0.42) * (0.8 + 0.4 * hash2(Math.floor((x + shift) / bw), course))));
        }
      }
      for (let y = floorY; y < rows; y++) for (let x = 0; x < cols; x++) {
        const li = lightAt(L, x, y, aspect);
        g.set(x, y, y === floorY ? '=' : (x + y * 3) % 9 === 0 ? '/' : '_', pc(s.Pwood, li * 0.5));
      }
      tx.forEach((x, k) => {
        for (let y = ty + 1; y < ty + rows * 0.16; y++) g.set(x, y, '█', pc(s.Pwood, 0.3));
        g.text(x - 2, ty, '\\___/', pc(s.Pmetal, 0.7));
        g.set(x - 3, ty + Math.round(rows * 0.08), '[', pc(s.Pmetal, 0.5)); g.set(x + 3, ty + Math.round(rows * 0.08), ']', pc(s.Pmetal, 0.5));
        for (let xx = x - 2; xx <= x + 2; xx++) g.set(xx, ty + Math.round(rows * 0.08), '=', pc(s.Pmetal, 0.55));
        flameAt(g, f, s.Pf, x + 0.5, ty - 0.5, W, H, k * 17 + 3, null);
      });
      return;
    }
    if (m === 'lamp') {
      const th = 0.14 * Math.sin(t * 1.15) + 0.03 * Math.sin(t * 2.7), hx = cols / 2, hy = 0;
      const top = Math.round(rows * 0.26), Hl = Math.round(rows * 0.44), wl = Math.max(5, Math.round(Hl * aspect * 0.32));
      const X = (dx, dy) => hx + dx + dy * aspect * Math.sin(th);
      const fx = X(0, top + Hl * 0.55), fyy = top + Hl * 0.55;
      const L = [{ x: fx, y: fyy - Hl * 0.12, a: 1.15, r2: (rows * aspect * 0.42) ** 2 }];
      // 木板牆
      const pw = Math.max(6, Math.round(cols / 14));
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const li = lightAt(L, x, y, aspect);
        if (li < 0.07) continue;
        // 木紋：細長的直條紋（高頻雜訊＋每格雜湊），不會整片一樣
        const n = hash2(x, y >> 1) * 0.65 + nz(x * 5.3 + 7, y * 0.7) * 0.35;
        const c = x % pw === 0 ? '|' : n > 0.66 ? ':' : n > 0.54 ? '.' : ' ';
        if (c !== ' ') g.set(x, y, c, pc(s.Pwood, li * 0.42));
      }
      for (let y = 0; y < top; y++) g.set(X(0, y), y, y % 2 ? '8' : '|', pc(s.Pmetal, 0.4));
      const rowsDef = [];
      rowsDef.push([0, '_/^\\_']);
      const cap = Math.max(1, Math.round(Hl * 0.12));
      for (let k = 1; k <= cap; k++) rowsDef.push([k, '/' + '‾'.repeat(Math.max(1, wl - 2 + k * 2 - 2)) + '\\']);
      const gl0 = cap + 1, gl1 = Math.round(Hl * 0.78);
      for (const [dy, str] of rowsDef) g.text(X(-(str.length >> 1), top + dy), top + dy, str, pc(s.Pmetal, 0.75));
      for (let dy = gl0; dy < gl1; dy++) {
        const yy = top + dy, bul = Math.sin(((dy - gl0) / (gl1 - gl0)) * Math.PI), hw = Math.round(wl * 0.42 + bul * wl * 0.18);
        g.set(X(-hw - 1, yy), yy, '(', pc(s.Pmetal, 0.65)); g.set(X(hw + 1, yy), yy, ')', pc(s.Pmetal, 0.65));
        for (let dx = -hw; dx <= hw; dx++) { const li = 0.3 * (1 - Math.abs(dx) / (hw + 1)); if (hash2(dx + 99, yy + ((t * 3) | 0)) < 0.25) g.set(X(dx, yy), yy, '.', pc(s.Pg, li + 0.15)); }
      }
      const W = Math.max(1, wl * 0.16), H = (gl1 - gl0) * 0.62;
      flameAt(g, f, s.Pf, X(0, top + gl1 - 1) + 0.5, top + gl1 - 1, W, H, 5, s.blue);
      for (let dy = gl1; dy < Hl; dy++) {
        const yy = top + dy, hw = Math.round(wl * 0.55 - (dy - gl1) * 0.3);
        const str = dy === gl1 ? '[' + '='.repeat(hw * 2 + 1) + ']' : dy === Hl - 1 ? '\\' + '_'.repeat(hw * 2 + 1) + '/' : '|' + '#'.repeat(hw * 2 + 1) + '|';
        g.text(X(-hw - 1, yy), yy, str, pc(s.Pmetal, dy === gl1 ? 0.8 : 0.45));
      }
      glowPass(g, f, s.Pg, L, 0.45, 0.1);
      return;
    }
    if (m === 'wisp') {
      const gy = Math.floor(rows * 0.78);
      const L = s.wisps.map(w => ({ x: w.x, y: w.y - 2, a: 0.6 * w.sz, r2: (rows * aspect * 0.14) ** 2 }));
      for (const [x, y, ph, b] of s.stars) if (y < gy - 2) g.set(x, y, '.', pc(s.Pst, 0.15 + 0.2 * b * (0.6 + 0.4 * Math.sin(t + ph))));
      // 水面與倒影
      for (let y = gy; y < rows; y++) for (let x = 0; x < cols; x++) {
        const n = nz(x * 0.08 + t * 0.3, y * 2.2), li = lightAt(L, x, gy - (y - gy) * 1.5, aspect);
        if (n > 0.6 || li > 0.25) g.set(x, y, li > 0.3 && n > 0.45 ? '~' : '-', pc(s.Pgb, Math.min(0.9, 0.08 + li * 0.8 * (n + 0.3))));
      }
      for (const r of s.reeds) {
        const sway = Math.sin(t * 0.9 + r.ph + r.x * 0.05) * 0.8;
        for (let k = 0; k < r.h; k++) g.set(r.x + sway * (k / r.h), gy - k, k > r.h - 1.5 ? (sway > 0.3 ? '/' : sway < -0.3 ? '\\' : '|') : '|', pc(s.Pgb, 0.08 + lightAt(L, r.x, gy - k, aspect) * 0.35));
      }
      glowPass(g, f, s.Pgb, L, 0.7, 0.08);
      for (const w of s.wisps) {
        w.x += (nz(w.seed, t * 0.15) - 0.5) * dt * 6; w.y += (nz(w.seed + 30, t * 0.13) - 0.5) * dt * 2.5;
        w.x = (w.x + cols) % cols; w.y = clamp(w.y, rows * 0.25, gy - 3);
        const bob = Math.sin(t * 1.3 + w.seed) * 0.6, a = 0.6 + 0.4 * Math.sin(t * 0.7 + w.seed * 2);
        flameAt(g, f, s.Pblue, w.x, w.y + bob, (1 + cols * 0.012) * w.sz, (3 + rows * 0.11) * w.sz * a, w.seed, null);
      }
      return;
    }
    if (m === 'lantern') {
      for (const [x, y, ph, b] of s.stars) g.set(x, y, b > 0.92 ? '+' : '.', pc(s.Pst, (0.12 + 0.35 * b) * (0.6 + 0.4 * Math.sin(t * 1.2 + ph))));
      for (let x = 0; x < cols; x++) {
        const tp = s.mtn[x];
        for (let y = Math.floor(tp); y < rows; y++) {
          const i = y * cols + x;
          if (y > rows * 0.9 && hash2(x, y) > 0.93) { ch[i] = '.'; co[i] = pc(s.Pf, 0.5 + 0.3 * hash2(x, y + ((t * 2) | 0))); }
          else { ch[i] = y === Math.floor(tp) ? EIGHTH[clamp(Math.round((y + 1 - tp) * 8), 1, 8)] : '█'; co[i] = pc(s.Pwood, 0.04); }
        }
      }
      for (let k = 0; k < s.lan.length; k++) {
        const l = s.lan[k], z = l.z;
        l.y -= (0.6 + z * 2.2) * dt * (rows / 40); l.x += (l.vx + Math.sin(t * 0.3 + l.ph) * 0.6) * dt * z;
        const hgt = z * rows * 0.15;
        if (l.y < -hgt - 2) { s.lan[k] = Object.assign(this.mkLan(f, false), { z: l.z }); continue; }
        const fl = 0.75 + 0.25 * Math.sin(t * 6 + l.seed) * Math.sin(t * 3.7 + l.seed * 2);
        if (hgt < 2.2) { g.set(l.x, l.y, hgt < 1 ? '·' : '▲', pc(s.Pf, (0.35 + z * 0.6) * fl)); continue; }
        const hh = Math.round(hgt), wTop = hgt * aspect * 0.32, wBot = wTop * 0.72;
        for (let r = 0; r < hh; r++) {
          const q = r / (hh - 1), hw = wTop + (wBot - wTop) * q, y = Math.floor(l.y + r);
          for (let x = Math.floor(l.x - hw); x <= l.x + hw; x++) {
            const e = Math.abs(x + 0.5 - l.x) / hw;
            if (e > 1) continue;
            const I = (0.35 + 0.55 * q) * (1 - e * e * 0.5) * fl * (0.6 + 0.4 * z);
            g.set(x, y, r === 0 ? '▄' : '█', pc(s.Pf, I));
          }
        }
        g.set(l.x, l.y + hh, '*', pc(s.Pf, 0.95 * fl));
      }
    }
  } });

/* ═════════ 4. 裊裊輕煙 ═════════ */
// 旋度雜訊：用雜訊當流函數，算出不會發散的漩渦速度場（回傳寫進 out）
function curl(x, y, sc, tz, out) {
  const e = 0.6, a = nz(x * sc, y * sc + tz), b = nz((x + e) * sc, y * sc + tz), c = nz(x * sc, (y + e) * sc + tz);
  const k = 220 / (e * sc); out[0] = (c - a) * k; out[1] = -(b - a) * k;
}
const CV = [0, 0];
A({ id: 'na-smoke', name: '裊裊輕煙', cat: '自然', theme: 'lavender', hue: true, desc: '線香升起細煙，在空中捲曲散開',
  params: { mode: 'incense' },
  variants: [
    { id: 'tea', name: '茶煙', theme: 'mono', desc: '熱茶冒出柔柔的白色蒸氣', params: { mode: 'tea' } },
    { id: 'chimney', name: '炊煙', theme: 'ice', desc: '月夜小村，煙囪的煙被風吹斜', params: { mode: 'chimney' } },
    { id: 'beacon', name: '狼煙', theme: 'sunset', desc: '山頭烽火台升起濃濃煙柱', params: { mode: 'beacon' } },
    { id: 'rings', name: '煙圈', theme: 'cyber', desc: '一個個煙圈旋轉著往上飄', params: { mode: 'rings' } },
    { id: 'temple', name: '香爐', theme: 'amber', desc: '廟前大香爐香火鼎盛', params: { mode: 'temple' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f, m = p.mode;
    s.D = new Float32Array(cols * rows);
    s.pt = []; s.src = []; s.acc = 0; s.rings = []; s.nextRing = 0;
    // 煙粒數量和格子大小無關，小格子每格會收到多很多煙：沉積量依格子面積縮放，縮圖才不會整片糊成 %
    s.dk = Math.min(1, Math.pow((cols * rows) / (320 * 88), 0.92));
    const gy = rows * 0.86;
    const add = o => s.src.push(Object.assign({ x: cols / 2, y: gy, rate: 40, sx: 0.2, rise: 5, turbH: rows * 0.25, turb: 1, amt: 0.3, life: 7, wind: 0, acc: 0 }, o));
    if (m === 'incense') {
      s.sticks = [-0.3, 0, 0.32].map((a, k) => ({ a, len: rows * (0.3 - Math.abs(a) * 0.08) }));
      s.cx = cols / 2; s.by = Math.floor(rows * 0.8);
      for (const st of s.sticks) add({ x: s.cx + Math.sin(st.a) * st.len * f.aspect * 0.5, y: s.by - Math.cos(st.a) * st.len, rate: 30, sx: 0.12, rise: 4.5, turbH: rows * 0.26, turb: 2.2, amt: 0.06 });
    } else if (m === 'tea') {
      s.cx = cols / 2; s.cw = Math.max(10, Math.round(cols * 0.2)); s.cy = Math.floor(rows * 0.62);
      add({ x: s.cx, y: s.cy, rate: 34, sx: s.cw * 0.3, rise: 3.2, turbH: rows * 0.04, turb: 1.1, amt: 0.2, life: 5 });
    } else if (m === 'chimney') {
      s.houses = []; s.gy = Math.floor(rows * 0.84);
      let x = rnd(2, 6);
      while (x < cols - 8) {
        const w = Math.max(8, Math.round(cols * rnd(0.06, 0.1))), h = Math.round(rows * rnd(0.1, 0.18));
        const hs = { x, w, h, roof: Math.round(w * 0.35), win: Math.random(), chim: Math.random() < 0.7 ? x + Math.round(w * rnd(0.6, 0.8)) : -1 };
        s.houses.push(hs);
        if (hs.chim >= 0) add({ x: hs.chim + 0.5, y: s.gy - h - hs.roof - 2, rate: 26, sx: 0.4, rise: 3.5, turbH: rows * 0.08, amt: 0.3, life: 9, wind: 3.5 });
        x += w + rint(3, Math.max(4, cols * 0.06));
      }
      s.stars = Array.from({ length: (cols * rows / 60) | 0 }, () => [rint(0, cols - 1), rint(0, rows * 0.7), rnd(0, TAU)]);
    } else if (m === 'beacon') {
      s.hill = new Float32Array(cols);
      for (let x = 0; x < cols; x++) s.hill[x] = rows * (0.78 - 0.22 * Math.exp(-(((x / cols) - 0.3) ** 2) / 0.03) - 0.06 * ridge((x / cols) * 90, 41));
      s.tx = Math.round(cols * 0.3); s.ty = Math.floor(s.hill[s.tx]) - Math.round(rows * 0.12);
      add({ x: s.tx + 0.5, y: s.ty, rate: 110, sx: 1.2, rise: 7, turbH: rows * 0.12, turb: 1.3, amt: 0.11, life: 10, wind: 4 });
      s.tx2 = Math.round(cols * 0.82); s.ty2 = Math.floor(rows * 0.7);
      add({ x: s.tx2 + 0.5, y: s.ty2, rate: 40, sx: 0.5, rise: 4, turbH: rows * 0.05, amt: 0.1, life: 8, wind: 4 });
    } else if (m === 'fog') {
      s.trunks = Array.from({ length: Math.max(6, (cols / 14) | 0) }, () => ({ x: rnd(0, cols), w: rnd(1, 4), z: Math.random() })).sort((a, b) => a.z - b.z);
      for (let k = 0; k < 5; k++) add({ x: -2, y: rows * (0.6 + k * 0.07), rate: 26, sx: 0, sy: rows * 0.04, rise: 0, turbH: 0, turb: 1.8, amt: 0.017, life: 30, wind: 0, fog: 1 });
    } else if (m === 'temple') {
      s.cx = cols / 2; s.top = Math.floor(rows * 0.6);
      s.sticks = Array.from({ length: 14 }, (_, k) => ({ x: s.cx + (k - 6.5) * Math.max(1, cols * 0.008) + rnd(-0.4, 0.4), h: rnd(0.08, 0.14) * rows }));
      for (const st of s.sticks) add({ x: st.x, y: s.top - st.h, rate: 12, sx: 0.2, rise: 5, turbH: rows * 0.16, turb: 2.4, amt: 0.03, life: 8 });
    }
    // 先跑一段時間，一開場畫面就有煙
    for (let k = 0, K = m === 'fog' ? 90 : 50; k < K; k++) this.step(s, f, (k - K) * 0.14, 0.14);
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), m = f.p.mode;
    s.key = f.C;
    const smk = { incense: [[30, 26, 50], [110, 100, 150], [200, 196, 230], [250, 248, 255]], tea: [[40, 40, 44], [130, 130, 136], [220, 220, 224], [255, 255, 255]],
      chimney: [[20, 26, 40], [80, 90, 120], [170, 180, 205], [230, 235, 250]], beacon: [[90, 70, 70], [60, 48, 50], [36, 30, 34], [20, 16, 20]],
      rings: [[0, 40, 60], [0, 140, 190], [120, 230, 255], [240, 255, 255]], fog: [[20, 34, 30], [80, 110, 96], [170, 196, 180], [230, 244, 236]],
      temple: [[40, 30, 20], [130, 110, 90], [210, 196, 176], [250, 244, 232]] }[m];
    s.Ps = pal(f, h, smk, 0.12, 0.95, 32);
    s.Pf = pal(f, h, [[110, 14, 0], [214, 64, 8], [255, 146, 28], [255, 214, 96], [255, 250, 226]], 0.4, 1, 24);
    s.Pd = pal(f, h, [[6, 6, 10], [40, 34, 40], [110, 90, 80], [190, 160, 120]], 0.05, 0.6, 24);
    s.Pw = pal(f, h, [[60, 40, 10], [200, 140, 40], [255, 220, 120]], 0.4, 0.9, 12);
    s.Pcup = pal(f, h, [[40, 50, 70], [120, 140, 170], [220, 230, 240], [255, 255, 255]], 0.2, 0.9, 24);
    s.Pg = pal(f, h, [[20, 40, 20], [50, 90, 40], [90, 120, 60]], 0.05, 0.3, 12);
    s.bg = { incense: [10, 8, 18], tea: [12, 12, 14], chimney: [4, 8, 20], beacon: [140, 110, 110], rings: [2, 8, 14], fog: [8, 16, 14], temple: [16, 10, 6] }[m];
  },
  step(s, f, t, dt) {
    const { cols, rows, aspect, p } = f, D = s.D, m = p.mode;
    const dec = Math.exp(-dt * (m === 'fog' ? 0.5 : m === 'tea' ? 1.8 : m === 'beacon' ? 0.55 : m === 'rings' ? 3.5 : 0.9));
    for (let i = 0; i < D.length; i++) D[i] *= dec;
    const pt = s.pt, cap = m === 'beacon' ? 3200 : 2400;
    // 噴出新的煙粒
    for (const sr of s.src) {
      sr.acc += sr.rate * dt * (m === 'chimney' ? 0.7 + 0.3 * Math.sin(t * 0.5 + sr.x) : 1);
      while (sr.acc >= 1 && pt.length < cap) {
        sr.acc -= 1;
        pt.push({ x: sr.fog ? rnd(-4, cols) : sr.x + gauss() * sr.sx, y: sr.y + (sr.sy ? gauss() * sr.sy : 0), vx: sr.fog ? rnd(2.5, 5) * cols / 160 : 0, vy: -sr.rise * rnd(0.8, 1.2) * rows / 45, age: 0, life: sr.life * rnd(0.7, 1.2), sr, h0: sr.y });
      }
      if (sr.acc > 1) sr.acc = 1;
    }
    // 煙圈：直接把每個圈算成一個斜看的甜甜圈（環管截面＋滾動的紋理），留下的煙跡交給 D 的衰減
    if (m === 'rings') {
      s.nextRing -= dt;
      if (s.nextRing <= 0) {
        s.nextRing = rnd(3, 4);
        const R = Math.max(10, cols * 0.09);
        s.side = s.side > 0 ? -1 : 1;
        s.rings.push({ x: cols * (0.5 + s.side * rnd(0.04, 0.2)), y: rows + (R * 0.5 + R * 0.28) / aspect, R, vy: rows * 0.11, tilt: rnd(-0.14, 0.14), age: 0, sd: rnd(0, 200) });
      }
      for (let k = s.rings.length - 1; k >= 0; k--) {
        const r = s.rings[k];
        r.age += dt; r.y -= r.vy * dt; r.vy *= 1 - dt * 0.08; r.R += dt * cols * 0.003; r.x += (nz(r.age * 0.3, r.sd) - 0.5) * dt * 6;
        const R = r.R, a = R * 0.28, eR = R * 0.5, Ry = (eR + a) / aspect;
        if (r.y < -Ry - 1 || r.age > 18) { kill(s.rings, k); continue; }
        const amp = Math.min(1, r.age * 1.5) * Math.min(1, (18 - r.age) / 5) * 1.15;
        const x0 = Math.max(0, Math.floor(r.x - (R + a) * 1.25)), x1 = Math.min(cols - 1, Math.ceil(r.x + (R + a) * 1.25));
        const y0 = Math.max(0, Math.floor(r.y - Ry * 1.35)), y1 = Math.min(rows - 1, Math.ceil(r.y + Ry * 1.35));
        const roll = r.age * 2.4, sk = R * 0.22;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0, i = y * cols + x0; x <= x1; x++, i++) {
            const dx = x + 0.5 - r.x, dy = (y + 0.5 - r.y) * aspect - r.tilt * dx;
            const u = dx / R, v = dy / eR, rr = Math.sqrt(u * u + v * v) + 1e-6;
            const th = Math.atan2(v, u);
            const sd = (rr - 1) * Math.sqrt(dx * dx + dy * dy) / rr + (nz(th * 5 + r.sd, r.age * 0.7) - 0.5) * a * 0.6;
            const q = Math.abs(sd) / a;
            if (q > 1.6) continue;
            let I;
            if (q < 1) {
              const depth = Math.sqrt(1 - q * q), phi = Math.atan2(depth, sd / a);
              const sw = nz(th * sk + 40, phi * 2.2 - roll + r.sd);
              I = (0.3 + 0.7 * depth) * (0.45 + 0.75 * sw) * (v > 0 ? 1 : 0.72);
            } else {
              const n = nz(x * 0.9 + r.sd, y * 1.6 - r.age * 2.5);
              I = n > 0.55 ? (1.6 - q) * (n - 0.55) * 2.2 : 0;
            }
            I *= amp;
            if (I > D[i]) D[i] = I;
          }
        }
      }
    }
    // 粒子移動：越往上越亂
    const Sx = cols / 160, Sy = rows / 45, sc = 0.26 / Sx, tz = t * 0.35;
    for (let k = pt.length - 1; k >= 0; k--) {
      const q = pt[k], sr = q.sr;
      q.age += dt;
      if (q.age > q.life || q.y < -3 || q.x < -5 || q.x > cols + 5 || q.y > rows + 2) { kill(pt, k); continue; }
      const h = sr.fog ? 1 : clamp((q.h0 - q.y) / Math.max(1, sr.turbH) - 0.3, 0, 1.6);
      curl(q.x, q.y * aspect, sc, tz, CV);
      const tb = sr.turb * h * Sx, c0 = CV[0], c1 = CV[1];
      curl(q.x + 77, q.y * aspect, sc * 2.7, tz * 1.8, CV);
      let vx = (c0 + CV[0] * 0.55) * tb + sr.wind * Sx * Math.min(1, h + 0.2) + gauss() * h * 1.5 * Sx, vy = (c1 + CV[1] * 0.55) * tb / aspect;
      if (sr.fog) { vx += q.vx; vy += (sr.y - q.y) * 0.15; }
      else vy += q.vy * (1 - Math.min(0.3, h * 0.2));
      q.x += vx * dt; q.y += vy * dt;
      const xi = q.x | 0, yi = q.y | 0;
      if (xi >= 0 && yi >= 0 && xi < cols && yi < rows) {
        const a = sr.amt * dt * 30 * s.dk * (1 - q.age / q.life) * (m === 'tea' ? Math.min(1, q.age * 2) : 1);
        D[yi * cols + xi] += a;
        if (h > 0.4 && xi + 1 < cols) D[yi * cols + xi + 1] += a * 0.35;
      }
    }
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, D = s.D, m = p.mode;
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) {
      if (m === 'beacon') { const k = 0.5 + 0.5 * Math.sin(t * 0.03); f.bg = rgb(lerp(150, 200, k), lerp(110, 150, k), lerp(110, 130, k)); }
      else f.bg = rgb(s.bg[0], s.bg[1], s.bg[2]);
    }
    this.step(s, f, t, dt);
    // 背景物件（煙的後面）
    if (m === 'chimney') {
      for (const [x, y, ph] of s.stars) g.set(x, y, '.', pc(s.Ps, 0.2 + 0.15 * Math.sin(t + ph)));
      const mx = cols * 0.8, my = rows * 0.2, mr = rows * aspect * 0.06;
      for (let y = Math.floor(my - mr / aspect); y <= my + mr / aspect; y++) for (let x = Math.floor(mx - mr); x <= mx + mr; x++) { const dx = x + 0.5 - mx, dy = (y + 0.5 - my) * aspect; if (dx * dx + dy * dy < mr * mr) g.set(x, y, '@', pc(s.Ps, 0.95)); }
    }
    if (m === 'beacon') {
      const sx = cols * 0.75, sy = rows * 0.35, sr = rows * aspect * 0.07;
      for (let y = Math.floor(sy - sr); y <= sy + sr; y++) for (let x = Math.floor(sx - sr * 1.2); x <= sx + sr * 1.2; x++) { const dx = x + 0.5 - sx, dy = (y + 0.5 - sy) * aspect; if (dx * dx + dy * dy < sr * sr) g.set(x, y, '@', pc(s.Pf, 0.7)); }
    }
    if (m === 'fog') {
      for (const tr of s.trunks) if (tr.z < 0.5) this.trunk(s, f, tr);
    }
    // 煙
    const Ps = s.Ps, n = cols * rows, thr = 0.06;
    for (let i = 0; i < n; i++) {
      const d = D[i];
      if (d < thr) continue;
      const v = Math.min(1, d * 0.9);
      ch[i] = v > 0.85 ? '%' : v > 0.65 ? '*' : v > 0.48 ? '+' : v > 0.34 ? '=' : v > 0.22 ? '~' : v > 0.12 ? ':' : '.';
      co[i] = pc(Ps, 0.15 + v * 0.85);
    }
    // 前景物件
    if (m === 'incense') {
      const { cx, by } = s, bw = Math.max(8, Math.round(cols * 0.09));
      for (const st of s.sticks) {
        const x1 = cx + Math.sin(st.a) * st.len * aspect * 0.5, y1 = by - Math.cos(st.a) * st.len;
        g.line(cx + Math.sin(st.a) * 2, by - 1, x1, y1 + 1, Math.abs(st.a) < 0.1 ? '|' : st.a > 0 ? '/' : '\\', pc(s.Pd, 0.35));
        g.set(x1, y1, '*', pc(s.Pf, 0.65 + 0.35 * Math.sin(t * 5 + st.a * 9)));
      }
      for (let k = 0; k < 4; k++) {
        const hw = bw - k * Math.max(1, bw * 0.1), y = by + k;
        for (let x = Math.floor(cx - hw); x <= cx + hw; x++) g.set(x, y, k === 0 ? (x === Math.floor(cx - hw) ? '\\' : x >= Math.floor(cx + hw) ? '/' : '_') : '█', k === 0 ? pc(s.Pd, 0.6) : pc(s.Pd, 0.3 + 0.2 * Math.sin((x - cx) / hw * 1.5)));
      }
      for (let x = Math.floor(cx - bw * 0.7); x <= cx + bw * 0.7; x++) g.set(x, by + 4, x % 3 ? '▀' : ' ', pc(s.Pd, 0.25));
      for (let x = Math.floor(cx - bw * 0.9); x <= cx + bw * 0.9; x++) if (hash2(x, 5) > 0.55) g.set(x, by - 1, '.', pc(s.Pd, 0.5));
    } else if (m === 'tea') {
      const { cx, cw, cy } = s, hh = Math.round(rows * 0.18), hw = cw / 2;
      for (let y = cy; y < cy + hh; y++) {
        const q = (y - cy) / hh, w = hw * (1 - Math.pow(q, 3) * 0.35);
        for (let x = Math.floor(cx - w); x <= cx + w; x++) {
          const xr = (x + 0.5 - cx) / w;
          if (Math.abs(xr) > 1) continue;
          g.set(x, y, y === cy ? (Math.abs(xr) > 0.9 ? '█' : '~') : '█', y === cy ? pc(s.Pw, 0.5 + 0.3 * Math.sin(x * 0.7 + t * 2)) : pc(s.Pcup, 0.35 + 0.55 * Math.sqrt(1 - xr * xr) * (1 - q * 0.4)));
        }
        if (q > 0.15 && q < 0.7) { const hx = Math.round(cx + hw + 1 + Math.sin(((q - 0.15) / 0.55) * Math.PI) * Math.max(2, cw * 0.12)); g.set(hx, y, q < 0.42 ? ')' : ')', pc(s.Pcup, 0.7)); g.set(hx - 1, y, q > 0.2 && q < 0.65 ? ' ' : '_', pc(s.Pcup, 0.6)); }
      }
      for (let x = Math.floor(cx - cw * 0.85); x <= cx + cw * 0.85; x++) { g.set(x, cy + hh, '▀', pc(s.Pcup, 0.6)); g.set(x, cy + hh + 1, x === Math.floor(cx - cw * 0.85) || x >= Math.floor(cx + cw * 0.85) ? ' ' : '▀', pc(s.Pcup, 0.3)); }
      for (let x = 0; x < cols; x++) g.set(x, cy + hh + 2, '_', pc(s.Pd, 0.25));
    } else if (m === 'chimney') {
      const gy = s.gy;
      for (const hs of s.houses) {
        const top = gy - hs.h;
        for (let y = top; y < gy; y++) for (let x = hs.x; x < hs.x + hs.w; x++) {
          const wy = y - top, wx = x - hs.x, win = wy % 3 === 1 && wx % 4 === 2 && wx < hs.w - 1 && hash2(x, y) < 0.55 + hs.win * 0.3;
          g.set(x, y, win ? '▪' : '█', win ? pc(s.Pw, 0.6 + 0.3 * hash2(x, ((t * 0.2) | 0) + y)) : pc(s.Pd, 0.06));
        }
        for (let r = 0; r < hs.roof; r++) { const y = top - 1 - r; for (let x = hs.x + r; x < hs.x + hs.w - r; x++) g.set(x, y, x === hs.x + r ? '/' : x === hs.x + hs.w - r - 1 ? '\\' : '█', pc(s.Pd, x === hs.x + r || x === hs.x + hs.w - r - 1 ? 0.25 : 0.08)); }
        if (hs.chim >= 0) for (let y = top - hs.roof - 2; y < top - 1; y++) g.set(hs.chim, y, '█', pc(s.Pd, 0.12));
      }
      for (let y = gy; y < rows; y++) for (let x = 0; x < cols; x++) g.set(x, y, y === gy ? '▀' : (hash2(x, y) > 0.8 ? '.' : ' '), pc(s.Pd, 0.1));
    } else if (m === 'beacon') {
      for (let x = 0; x < cols; x++) for (let y = Math.max(0, Math.floor(s.hill[x])); y < rows; y++) g.set(x, y, y === Math.floor(s.hill[x]) ? EIGHTH[clamp(Math.round((y + 1 - s.hill[x]) * 8), 1, 8)] : '█', pc(s.Pd, 0.03));
      const tw = Math.max(3, Math.round(cols * 0.018));
      for (let y = s.ty + 1; y < s.hill[s.tx] + 1; y++) for (let x = s.tx - tw; x <= s.tx + tw; x++) g.set(x, y, (y + (x & 1)) % 2 ? '█' : '▓', pc(s.Pd, 0.08));
      for (let x = s.tx - tw - 1; x <= s.tx + tw + 1; x++) g.set(x, s.ty + 1, x % 2 ? '▀' : '█', pc(s.Pd, 0.1));
      flameAt(g, f, s.Pf, s.tx + 0.5, s.ty + 0.5, tw * 0.6, rows * 0.06, 4, null);
      g.set(s.tx2, s.ty2, '▲', pc(s.Pd, 0.05)); g.set(s.tx2, s.ty2 - 1, '*', pc(s.Pf, 0.6 + 0.3 * Math.sin(t * 6)));
    } else if (m === 'fog') {
      for (const tr of s.trunks) if (tr.z >= 0.5) this.trunk(s, f, tr);
      for (let x = 0; x < cols; x++) g.set(x, rows - 1, hash2(x, 1) > 0.5 ? ',' : '.', pc(s.Pg, 0.5));
    } else if (m === 'temple') {
      const { cx, top } = s, bw = Math.max(12, Math.round(cols * 0.16)), bh = Math.round(rows * 0.22);
      for (const st of s.sticks) { for (let y = Math.round(top - st.h) + 1; y < top; y++) g.set(st.x, y, '|', pc(s.Pd, 0.45)); g.set(st.x, top - st.h, '*', pc(s.Pf, 0.6 + 0.4 * Math.sin(t * 4 + st.x))); }
      for (let y = top; y < top + bh; y++) {
        const q = (y - top) / bh, w = bw * (q < 0.15 ? 1.05 : 1 - Math.pow((q - 0.15) / 0.85, 2) * 0.35);
        for (let x = Math.floor(cx - w); x <= cx + w; x++) {
          const xr = (x + 0.5 - cx) / w;
          if (Math.abs(xr) > 1) continue;
          const pat = q > 0.3 && q < 0.6 && ((x + y) % 4 === 0) ? '▒' : '█';
          g.set(x, y, q < 0.08 ? '▄' : pat, pc(s.Pw, 0.25 + 0.4 * Math.sqrt(1 - xr * xr) * (q < 0.15 ? 1.2 : 1)));
        }
      }
      for (const d of [-0.7, 0.7]) for (let y = top + bh; y < Math.min(rows, top + bh + rows * 0.08); y++) g.text(cx + d * bw - 1, y, '██', pc(s.Pw, 0.3));
      for (let x = Math.floor(cx - bw - 2); x <= cx + bw + 2; x++) { g.set(x, top - 1, '_', pc(s.Pw, 0.55)); }
      g.text(cx - bw - 3, top + 1, '(', pc(s.Pw, 0.5)); g.text(cx + bw + 2, top + 1, ')', pc(s.Pw, 0.5));
    }
  },
  trunk(s, f, tr) {
    const { g, rows } = f, w = Math.max(1, Math.round(tr.w * (0.5 + tr.z))), c = pc(s.Pd, 0.03 + tr.z * 0.12);
    for (let y = 0; y < rows; y++) for (let k = 0; k < w; k++) g.set(tr.x + k, y, '█', c);
  } });

/* ═════════ 5. 飛瀑流泉 ═════════ */
A({ id: 'na-falls', name: '飛瀑流泉', cat: '場景', theme: 'ocean', hue: true, desc: '瀑布從山崖傾瀉而下，水霧瀰漫',
  params: { kind: 'single', w: 0.2, top: 0.14, pool: 0.8, mist: 1, night: 0, bow: 0, fore: 0, sp: 1 },
  variants: [
    { id: 'tiers', name: '三疊', theme: 'mint', desc: '水流在岩階間連跌三段', params: { kind: 'tiers', w: 0.13, top: 0.08, pool: 0.84, mist: 0.7 } },
    { id: 'wide', name: '寬瀑', theme: 'blueprint', desc: '弧形的寬闊水幕與漫天水霧', params: { kind: 'wide', w: 0.78, top: 0.26, pool: 0.74, mist: 1.6 } },
    { id: 'ribbons', name: '細瀑', theme: 'mono', desc: '高聳崖壁垂下一條條細瀑', params: { kind: 'ribbons', top: 0.04, pool: 0.88, mist: 0.28, sp: 0.8 } },
    { id: 'night', name: '月瀑', theme: 'ice', desc: '月光下銀白色的瀑布', params: { kind: 'single', w: 0.12, top: 0.3, pool: 0.82, night: 1, mist: 0.9 } },
    { id: 'bow', name: '虹霧', theme: 'rainbow', desc: '陽光在水霧裡映出彩虹', params: { kind: 'single', w: 0.3, top: 0.1, pool: 0.7, bow: 1, mist: 1.5 } },
    { id: 'forest', name: '林瀑', theme: 'forest', desc: '從樹林間望見遠處的瀑布', params: { kind: 'single', w: 0.1, top: 0.2, pool: 0.76, fore: 1, mist: 0.8, sp: 0.8 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    const top = Math.round(rows * p.top), pool = Math.round(rows * p.pool);
    s.top = top; s.pool = pool;
    const seg = [];
    if (p.kind === 'tiers') {
      const n = 3, h = (pool - top) / n;
      for (let k = 0; k < n; k++) seg.push({ cx: cols * (0.36 + 0.14 * ((k % 2) ? 1 : 0) + k * 0.04), y0: Math.round(top + k * h + (k ? 2 : 0)), y1: Math.round(top + (k + 1) * h), w: cols * p.w * (1 + k * 0.25) });
    } else if (p.kind === 'ribbons') {
      const n = clamp(Math.round(cols / 22), 4, 12);
      for (let k = 0; k < n; k++) seg.push({ cx: cols * (k + 0.5 + rnd(-0.25, 0.25)) / n, y0: Math.round(rows * rnd(0.04, 0.35)), y1: pool, w: Math.max(1.2, cols * rnd(0.006, 0.016)), thin: 1 });
    } else seg.push({ cx: cols * (p.fore ? 0.55 : 0.5), y0: top, y1: pool, w: cols * p.w });
    s.seg = seg;
    // 岩壁頂線（植被），瀑布口附近低一點
    s.rim = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {
      let r = top - 1 - rows * 0.08 * ridge((x / cols) * 90, 5) - rows * 0.03;
      if (p.kind === 'ribbons') r = rows * 0.03 + rows * 0.03 * ridge((x / cols) * 90, 5);
      s.rim[x] = r;
    }
    s.stars = Array.from({ length: (cols * rows / 50) | 0 }, () => [rint(0, cols - 1), rint(0, Math.max(1, top - 2)), rnd(0, TAU)]);
    s.drops = [];
    if (p.fore) {
      s.trunks = [{ x: cols * 0.08, w: cols * 0.05 }, { x: cols * 0.24, w: cols * 0.025 }, { x: cols * 0.86, w: cols * 0.06 }, { x: cols * 0.97, w: cols * 0.03 }];
    }
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), n = f.p.night;
    s.key = f.C;
    s.Pr = pal(f, h, n ? [[6, 8, 14], [24, 30, 44], [50, 58, 80]] : [[22, 22, 20], [56, 54, 48], [96, 92, 80]], 0.03, 0.18, 24);
    s.Pm = pal(f, h, n ? [[8, 16, 20], [20, 40, 50]] : [[20, 46, 22], [54, 100, 44], [110, 160, 70]], 0.1, 0.35, 16);
    s.Pw = pal(f, h, n ? [[30, 50, 90], [120, 150, 200], [210, 225, 250], [255, 255, 255]] : [[30, 80, 130], [100, 170, 220], [210, 236, 255], [255, 255, 255]], 0.3, 1, 32);
    s.Pp = pal(f, h, n ? [[6, 14, 30], [30, 50, 90], [150, 170, 210]] : [[8, 40, 70], [30, 100, 150], [170, 220, 245]], 0.15, 0.7, 24);
    s.Pmist = pal(f, h, n ? [[40, 50, 80], [140, 155, 190], [220, 230, 250]] : [[120, 150, 170], [200, 220, 235], [250, 252, 255]], 0.25, 0.85, 24);
    s.Pst = pal(f, h, [[80, 90, 130], [240, 245, 255]], 0.2, 0.8, 8);
    s.Ptr = pal(f, h, [[6, 10, 6], [20, 30, 18]], 0.02, 0.12, 8);
    s.bg = n ? [4, 7, 18] : [70, 128, 186];
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co;
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.bg[0], s.bg[1], s.bg[2]);
    const pool = s.pool, rim = s.rim, Pr = s.Pr, Pw = s.Pw, sp = p.sp * (rows / 30);
    // 天空：夜晚的星與月
    if (p.night) {
      for (const [x, y, ph] of s.stars) if (y < rim[x] - 1) g.set(x, y, '.', pc(s.Pst, 0.4 + 0.4 * Math.sin(t * 1.4 + ph)));
      const mx = cols * 0.8, my = rows * 0.12, mr = Math.max(1.5, rows * aspect * 0.05);
      for (let y = Math.floor(my - mr); y <= my + mr; y++) for (let x = Math.floor(mx - mr * 1.2); x <= mx + mr * 1.2; x++) { const dx = x + 0.5 - mx, dy = (y + 0.5 - my) * aspect; if (dx * dx + dy * dy < mr * mr && y < rim[clamp(x, 0, cols - 1)]) g.set(x, y, '@', pc(s.Pst, 1)); }
    }
    // 岩壁（整片填滿）＋崖頂植被
    for (let x = 0; x < cols; x++) {
      const r0 = rim[x];
      for (let y = Math.max(0, Math.floor(r0)); y < pool; y++) {
        const i = y * cols + x, n = nz(x * 0.35, y * 0.7), n2 = nz(x * 1.3 + 50, y * 2.1);
        if (y - r0 < 1.2 + n2 * 2.5) { ch[i] = y < r0 ? '▄' : n2 > 0.5 ? '♣' : '█'; co[i] = pc(s.Pm, 0.3 + n * 0.7); continue; }
        ch[i] = '█'; co[i] = pc(Pr, n * 0.75 + (n2 > 0.8 ? 0.25 : 0));
        if (n2 < 0.12) { ch[i] = '▓'; }
      }
    }
    // 瀑布本體
    for (const sg of s.seg) {
      const H = Math.max(1, sg.y1 - sg.y0);
      for (let y = Math.max(0, sg.y0 - (sg.thin ? 0 : 2)); y < sg.y1 && y < rows; y++) {
        const q = clamp((y - sg.y0) / H, 0, 1);
        const curve = p.kind === 'wide' ? 1 - 0.06 * Math.cos(((y - sg.y0) / H) * 0.5) : 1;
        const hw = sg.w * 0.5 * (1 + q * (sg.thin ? 0.8 : 0.12)) * curve, sv = Math.sqrt(q) * H * 2.2 * (30 / rows);
        for (let x = Math.floor(sg.cx - hw - 1); x <= sg.cx + hw + 1; x++) {
          if (x < 0 || x >= cols) continue;
          const e = (x + 0.5 - sg.cx) / hw, edge = Math.abs(e) + (nz(x * 0.5, y * 0.4 - t * sp * 0.6) - 0.5) * 0.3;
          if (edge > 1) continue;
          const i = y * cols + x;
          if (y < sg.y0) { ch[i] = y === sg.y0 - 1 ? '~' : '_'; co[i] = pc(Pw, 0.55 + 0.3 * nz(x * 0.6 - t * 3, 5)); continue; }
          const xs = x * (100 / cols) * (sg.thin ? 9 : 7);
          const n = nz(xs + 31, sv * 0.5 - t * 8 * p.sp) * 0.6 + nz(xs * 1.7 + 97, sv * 1.1 - t * 18 * p.sp) * 0.4;
          let I = 0.3 + n * 1.0 - (edge > 0.8 ? (edge - 0.8) * 2 : 0) + q * q * 0.15;
          if (q < 0.06) I = 0.75 + n * 0.25;
          if (I < 0.2) { ch[i] = '.'; co[i] = pc(Pw, 0.2); continue; }
          ch[i] = I > 0.82 ? '|' : I > 0.62 ? '!' : I > 0.45 ? ':' : I > 0.32 ? "'" : '.';
          co[i] = pc(Pw, I);
        }
        // 階梯落點的水花
        if (p.kind === 'tiers' && y === sg.y1 - 1 && sg !== s.seg[s.seg.length - 1]) {
          const nx = s.seg[s.seg.indexOf(sg) + 1];
          const xa = Math.min(sg.cx - hw, nx.cx - nx.w / 2) - 2, xb = Math.max(sg.cx + hw, nx.cx + nx.w / 2) + 2;
          for (let x = Math.floor(xa); x <= xb; x++) for (let yy = sg.y1 - 1; yy <= sg.y1 + 1; yy++) g.set(x, yy, yy === sg.y1 + 1 ? '▀' : nz(x * 0.8 - t * 4, yy) > 0.5 ? '~' : '=', yy === sg.y1 + 1 ? pc(Pr, 0.6) : pc(Pw, 0.5 + 0.4 * nz(x * 0.8 + t * 5, yy * 3)));
        }
      }
    }
    // 水潭：從落水點往外擴散的波紋
    const segL = s.seg[s.seg.length - 1];
    for (let y = pool; y < rows; y++) {
      const dy = (y - pool + 1) * aspect * 1.6;
      for (let x = 0, i = y * cols; x < cols; x++, i++) {
        let best = 1e9;
        for (const sg of s.seg) if (sg.y1 >= pool - 1) { const d = Math.hypot(Math.max(0, Math.abs(x - sg.cx) - sg.w * 0.5), dy); if (d < best) best = d; }
        const w = Math.sin(best * 0.55 - t * 4 * p.sp) * 0.5 + 0.5, n = nz(x * 0.15 + t * 0.4, y * 1.3);
        const I = (w * 0.55 + n * 0.45) * (0.4 + 0.6 * Math.exp(-best / (cols * 0.25)));
        if (I < 0.2) continue;
        ch[i] = I > 0.62 ? '≈' : I > 0.45 ? '~' : I > 0.32 ? '-' : '.';
        co[i] = pc(s.Pp, I);
      }
      
    }
    // 水霧
    if (p.mist > 0) {
      const Pm = s.Pmist, mh = rows * 0.22 * p.mist;
      for (const sg of s.seg) {
        if (sg.y1 < pool - 1 && p.kind !== 'tiers') continue;
        const by = sg.y1, rx = sg.w * 0.6 + cols * 0.09 * p.mist, ry = rows * 0.16 * p.mist;
        for (let y = Math.max(0, Math.floor(by - ry * 1.6)); y < Math.min(rows, by + ry * 0.7); y++) for (let x = Math.max(0, Math.floor(sg.cx - rx * 1.3)); x < Math.min(cols, sg.cx + rx * 1.3); x++) {
          const dx = (x - sg.cx) / rx, dyy = (y - by) / ry;
          const fall = Math.exp(-(dx * dx + dyy * dyy) * 1.4);
          const n = nz(x * (90 / cols) * 1.2 + t * 0.8, y * (90 / cols) * 3 - t * 1.5);
          const I = fall * (0.35 + n * 1.1) - 0.25;
          if (I < 0.06) continue;
          const i = y * cols + x;
          ch[i] = I > 0.7 ? 'O' : I > 0.5 ? 'o' : I > 0.32 ? '°' : I > 0.18 ? ':' : '.';
          co[i] = pc(Pm, 0.3 + I);
        }
      }
      // 水花
      if (s.drops.length < 260) for (let k = 0; k < dt * 60; k++) { const sg = pick(s.seg); if (sg.y1 >= pool - 1) s.drops.push({ x: sg.cx + rnd(-0.5, 0.5) * sg.w, y: pool - 1, vx: rnd(-8, 8), vy: rnd(-14, -5) * (rows / 40), l: rnd(0.4, 1.2) }); }
      for (let k = s.drops.length - 1; k >= 0; k--) {
        const d = s.drops[k];
        d.l -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 30 * (rows / 40) * dt;
        if (d.l <= 0 || d.y > pool) { kill(s.drops, k); continue; }
        g.set(d.x, d.y, d.l > 0.6 ? "'" : '.', pc(Pw, 0.7));
      }
    }
    // 彩虹
    if (p.bow) {
      const bx = segL.cx + cols * 0.05, by = pool + rows * 0.25, R = cols * 0.24, w = Math.max(2.5, cols * 0.05), k = 0.6 + 0.4 * Math.sin(t * 0.15);
      for (let y = Math.max(0, Math.floor(by - R / aspect - 2)); y < pool; y++) for (let x = Math.max(0, Math.floor(bx - R - w)); x < Math.min(cols, bx + R + w); x++) {
        const b = (R - Math.hypot(x - bx, (y - by) * aspect)) / w;
        if (b < 0 || b > 1) continue;
        const i = y * cols + x, inMist = ch[i] !== '█' && ch[i] !== '▓' && ch[i] !== '♣' && ch[i] !== '▄';
        if (!inMist) continue;
        ch[i] = ch[i] === ' ' ? '░' : ch[i]; co[i] = f.H(b * 270, 0.45 + 0.35 * k);
      }
    }
    // 前景樹幹與枝葉
    if (p.fore) {
      for (const tr of s.trunks) for (let y = 0; y < rows; y++) for (let x = Math.floor(tr.x - tr.w / 2); x < tr.x + tr.w / 2; x++) g.set(x + Math.sin(y * 0.15) * 0.6, y, '█', pc(s.Ptr, 0.3 + 0.4 * nz(x * 0.5, y * 0.2)));
      for (let y = 0; y < rows * 0.2; y++) for (let x = 0; x < cols; x++) {
        const n = nz(x * 0.12 + Math.sin(t * 0.5) * 0.8, y * 0.4 + 60) - y / (rows * 0.2) * 0.5;
        if (n > 0.42) g.set(x, y, n > 0.6 ? '█' : n > 0.5 ? '♣' : '*', pc(s.Pm, 0.15 + (n - 0.42) * 1.2));
      }
      for (let x = 0; x < cols; x++) { const h = Math.round(rows * 0.08 * nz(x * 0.2, 9)); for (let y = rows - h; y < rows; y++) g.set(x, y, (x + y) % 3 ? '/' : '\\', pc(s.Pm, 0.3 + 0.3 * nz(x * 0.4, y))); }
    }
  } });

/* ═════════ 6. 溪石流水（俯瞰） ═════════ */
A({ id: 'na-stream', name: '溪石流水', cat: '自然', theme: 'mint', hue: true, desc: '俯瞰小溪，水流繞過石頭留下水紋',
  params: { kind: 'rocks', nRock: 6, rMin: 0.025, rMax: 0.05, U: 9, meander: 0, foam: 1, leaves: 0, koi: 0, rain: 0, stones: 0, width: 0.36 },
  variants: [
    { id: 'leaves', name: '落葉溪', theme: 'sunset', desc: '紅黃落葉順著溪水漂流', params: { nRock: 4, U: 6, leaves: 1, foam: 0.6 } },
    { id: 'meander', name: '蜿蜒', theme: 'forest', desc: '彎彎曲曲的溪流穿過草地', params: { nRock: 4, rMin: 0.015, rMax: 0.03, meander: 1, width: 0.17, U: 8 } },
    { id: 'koi', name: '錦鯉池', theme: 'ocean', desc: '錦鯉在睡蓮間悠游', params: { nRock: 3, U: 1.2, koi: 1, foam: 0, width: 0.4 } },
    { id: 'rain', name: '雨中溪', theme: 'blueprint', desc: '雨點落在緩緩溪面泛起漣漪', params: { nRock: 3, U: 3, rain: 1, foam: 0.3 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f, n = cols * rows;
    const yc = new Float32Array(cols), hw = new Float32Array(cols);
    const ph = rnd(0, TAU);
    for (let x = 0; x < cols; x++) {
      const u = x / cols;
      yc[x] = rows * 0.5 + (p.meander ? rows * 0.24 * Math.sin(u * TAU * 1.1 + ph) : rows * 0.05 * (nz(u * 40, 3) - 0.5) * 2);
      hw[x] = rows * p.width * (1 + 0.15 * (nz(u * 60, 9) - 0.5) * 2);
    }
    s.yc = yc; s.hw = hw;
    // 石頭
    const rocks = [];
    if (p.stones) {
      const k = Math.max(5, Math.round(rows * p.width * 2 / 5));
      for (let j = 0; j < k; j++) { const x = cols * 0.5 + (j % 2 ? 2 : -2) + rnd(-1, 1); rocks.push({ x, y: yc[x | 0] - hw[x | 0] * 0.95 + (j + 0.5) * (hw[x | 0] * 1.9 / k), r: Math.max(2.2, rows * p.width * 2 / k * aspect * 0.42), flat: 1 }); }
    }
    for (let tries = 0; rocks.length < p.nRock + (p.stones ? rocks.length : 0) && tries < 500; tries++) {
      const x = rnd(0.06, 0.94) * cols, r = Math.max(1.5, cols * rnd(p.rMin, p.rMax)), xi = x | 0, y = yc[xi] + rnd(-0.8, 0.8) * (hw[xi] - r / aspect);
      if (rocks.some(o => Math.hypot(o.x - x, (o.y - y) * aspect) < (o.r + r) * 1.3)) continue;
      rocks.push({ x, y, r });
    }
    s.rocks = rocks;
    // 速度場（靜態，先算好）
    s.vx = new Float32Array(n); s.vy = new Float32Array(n); s.kind = new Uint8Array(n); s.dir = new Array(n); s.shade = new Float32Array(n);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, d = (y + 0.5 - yc[x]) / hw[x];
      if (Math.abs(d) > 1) { s.kind[i] = 0; s.shade[i] = nz(x * 0.5, y * 1.1); continue; }
      const slope = (yc[Math.min(cols - 1, x + 1)] - yc[Math.max(0, x - 1)]) / 2;
      const len = Math.hypot(1, slope * aspect), U = p.U * (cols / 160) * (1 - d * d * 0.55);
      let ux = U / len, uy = (U * slope * aspect) / len;
      let inRock = -1;
      for (let j = 0; j < rocks.length; j++) {
        const o = rocks[j], dx = x + 0.5 - o.x, dy = (y + 0.5 - o.y) * aspect * (o.flat ? 1.6 : 1), r2 = dx * dx + dy * dy, R2 = o.r * o.r;
        if (r2 < R2) { inRock = j; s.shade[i] = clamp(0.55 - (dx + dy) / o.r * 0.35 + (nz(x * 0.9, y * 1.7) - 0.5) * 0.4, 0, 1); break; }
        const r4 = r2 * r2, k = R2 / r4;
        const ux0 = ux, uy0 = uy;
        ux -= (ux0 * (dx * dx - dy * dy) + uy0 * 2 * dx * dy) * k;
        uy -= (ux0 * 2 * dx * dy - uy0 * (dx * dx - dy * dy)) * k;
      }
      if (inRock >= 0) { s.kind[i] = 2; continue; }
      s.kind[i] = 1; s.vx[i] = ux; s.vy[i] = uy / aspect;
      const a = Math.atan2(uy, ux), sp = Math.hypot(ux, uy);
      s.dir[i] = sp < 0.3 ? '~' : Math.abs(a) < 0.35 || Math.abs(a) > 2.8 ? (hash2(x, y) > 0.5 ? '~' : '-') : Math.abs(Math.abs(a) - Math.PI / 2) < 0.4 ? '|' : a * 1 > 0 ? (a < Math.PI / 2 ? '\\' : '/') : (a > -Math.PI / 2 ? '/' : '\\');
    }
    s.B = new Float32Array(n);
    s.pt = Array.from({ length: clamp((n / 11) | 0, 200, 3200) }, () => this.spawn(s, f, true));
    s.foam = []; s.ring = []; s.leaf = [];
    if (p.leaves) s.leaf = Array.from({ length: clamp((cols / 6) | 0, 8, 50) }, () => ({ x: rnd(0, cols), y: 0, set: 0, rot: rnd(0, TAU), w: rnd(-2, 2), hue: pick([5, 18, 30, 42, 55]) }));
    if (p.koi) {
      s.koi = Array.from({ length: clamp((cols / 30) | 0, 3, 9) }, (_, k) => ({ x: rnd(0.1, 0.9) * cols, y: rows / 2 + rnd(-0.6, 0.6) * rows * p.width, a: rnd(0, TAU), seed: k * 11.3, hist: [], col: k % 3 }));
      s.pads = Array.from({ length: clamp((cols / 14) | 0, 4, 22) }, () => ({ x: rnd(0, cols), y: rows / 2 + rnd(-0.9, 0.9) * rows * p.width, r: rnd(1.5, 3.5) * (cols / 160) + 1, fl: Math.random() < 0.3 }));
    }
  },
  spawn(s, f, any) {
    const { cols, rows } = f;
    for (let k = 0; k < 20; k++) {
      const x = any ? rnd(0, cols) : rnd(0, 2), xi = Math.min(cols - 1, x | 0), y = s.yc[xi] + rnd(-1, 1) * s.hw[xi];
      const i = clamp(y | 0, 0, rows - 1) * cols + xi;
      if (s.kind[i] === 1) return { x, y, age: rnd(0, 3) };
    }
    return { x: 0, y: s.yc[0], age: 0 };
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), p = f.p;
    s.key = f.C;
    s.Pw = pal(f, h, p.koi ? [[10, 40, 40], [40, 110, 110], [160, 220, 210], [240, 255, 250]] : [[14, 60, 74], [40, 130, 150], [170, 230, 236], [250, 255, 255]], 0.12, 1, 32);
    s.Pr = pal(f, h, [[30, 30, 32], [80, 80, 78], [150, 148, 140], [214, 210, 200]], 0.18, 0.85, 24);
    s.Pg = pal(f, h, p.leaves ? [[40, 30, 10], [100, 80, 30], [170, 130, 60]] : [[14, 40, 12], [40, 90, 30], [100, 150, 60]], 0.06, 0.4, 16);
    s.Psand = pal(f, h, [[70, 60, 40], [150, 130, 100], [210, 196, 160]], 0.15, 0.55, 16);
    s.Pf = pal(f, h, [[150, 200, 210], [255, 255, 255]], 0.7, 1, 8);
    s.bg = p.koi ? [8, 30, 34] : [10, 44, 58];
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, B = s.B, n = cols * rows;
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.bg[0], s.bg[1], s.bg[2]);
    const dec = Math.exp(-dt * (p.koi ? 1.2 : 2.6));
    for (let i = 0; i < n; i++) B[i] *= dec;
    // 水流粒子
    const vx = s.vx, vy = s.vy, kind = s.kind, dep = 0.2 * dt * 30;
    for (let k = 0; k < s.pt.length; k++) {
      const q = s.pt[k];
      const i = (q.y | 0) * cols + (q.x | 0);
      if (q.x < 0 || q.x >= cols || q.y < 0 || q.y >= rows || kind[i] !== 1 || (q.age += dt) > 12) { s.pt[k] = this.spawn(s, f, q.x < cols - 1 && Math.random() < 0.3); continue; }
      const j = Math.random() * 0.4;
      q.x += vx[i] * dt * (0.8 + j); q.y += vy[i] * dt * (0.8 + j) + (nz(q.x * 0.2, q.y * 0.5 + t) - 0.5) * dt * 0.6;
      B[i] += dep;
    }
    // 石頭下游的白沫
    if (p.foam > 0) for (const o of s.rocks) {
      for (let e = dt * 10 * p.foam * Math.min(2, o.r / 3); e > 0; e--) {
        if (e < 1 && Math.random() > e) break;
        const a = rnd(-1.2, 1.2), x = o.x + Math.cos(a) * o.r * 1.05, y = o.y + Math.sin(a) * o.r / aspect;
        if (s.foam.length < 900) s.foam.push({ x, y, l: rnd(0.4, 1.4) * Math.min(1.5, p.foam) });
      }
    }
    for (let k = s.foam.length - 1; k >= 0; k--) {
      const q = s.foam[k], i = clamp(q.y | 0, 0, rows - 1) * cols + clamp(q.x | 0, 0, cols - 1);
      q.l -= dt;
      if (q.l <= 0 || kind[i] !== 1) { kill(s.foam, k); continue; }
      q.x += vx[i] * dt * 0.75 + rnd(-1, 1) * dt * 9; q.y += vy[i] * dt * 0.75 + rnd(-1, 1) * dt * 4;
      B[i] += 0.5 * dt * 30 * Math.min(1, q.l);
    }
    // 雨滴漣漪
    if (p.rain) {
      if (Math.random() < dt * cols * 0.12) { const x = rnd(0, cols), y = rnd(0, rows); const i = (y | 0) * cols + (x | 0); if (kind[i] === 1) s.ring.push({ x, y, r: 0, l: rnd(1.2, 2) }); }
    }
    // 繪製：河岸、水、石頭
    const Pw = s.Pw, Pr = s.Pr, Pg = s.Pg, Ps = s.Psand, dir = s.dir, sh = s.shade, yc = s.yc, hw = s.hw;
    for (let y = 0; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
      const kd = kind[i];
      if (kd === 0) {
        const d = Math.abs(y + 0.5 - yc[x]) - hw[x], v = sh[i];
        if (d < 1.4 + v * 1.5) { ch[i] = v > 0.82 ? '▓' : '█'; co[i] = pc(Ps, (d < 0.7 ? 0.15 : 0.35) + v * 0.5); }
        else { const sw = Math.sin(t * 1.3 + x * 0.12 + y * 0.25) > 0.75; ch[i] = v > 0.86 ? (sw ? '▒' : '▓') : '█'; co[i] = pc(Pg, 0.1 + v * 0.6 + (v > 0.86 ? 0.25 : 0)); }
        continue;
      }
      if (kd === 2) { const v = sh[i]; ch[i] = v > 0.75 ? '@' : v > 0.5 ? '%' : v > 0.3 ? '#' : '█'; co[i] = pc(Pr, v); continue; }
      const b = B[i], sp2 = nz(x * 0.35 - t * p.U * 0.15, y * 1.3) - 0.5;
      const L = Math.min(1, b * 0.6 + sp2 * 0.25 + 0.12);
      if (L < 0.1) continue;
      ch[i] = b > 1.6 && p.foam > 0 ? (b > 2.6 ? 'o' : '°') : L < 0.2 ? '.' : dir[i];
      co[i] = pc(Pw, L);
    }
    // 漣漪
    for (let k = s.ring.length - 1; k >= 0; k--) {
      const r = s.ring[k];
      r.l -= dt; r.r += dt * 7 * (cols / 160);
      if (r.l <= 0) { kill(s.ring, k); continue; }
      const m = Math.max(8, Math.round(r.r * 7)), c = pc(Pw, 0.4 + r.l * 0.4);
      g.set(r.x, r.y, r.r < 1 ? 'o' : ' ', c);
      for (let a = 0; a < m; a++) { const an = (a / m) * TAU, x = r.x + Math.cos(an) * r.r, y = r.y + (Math.sin(an) * r.r) / aspect; const i = (y | 0) * cols + (x | 0); if (x >= 0 && y >= 0 && x < cols && y < rows && kind[i] === 1) { ch[i] = Math.abs(Math.sin(an)) > 0.7 ? '-' : Math.cos(an) * Math.sin(an) > 0 ? '\\' : '/'; co[i] = c; } }
    }
    // 落葉
    for (const lf of s.leaf) {
      const i = clamp(lf.y | 0, 0, rows - 1) * cols + clamp(lf.x | 0, 0, cols - 1);
      if (!lf.set || lf.x > cols + 1 || kind[i] !== 1) { const sp = this.spawn(s, f, !lf.set); lf.x = sp.x - (lf.set ? 2 : 0); lf.y = sp.y; lf.set = 1; continue; }
      lf.x += vx[i] * dt * 0.9; lf.y += vy[i] * dt * 0.9; lf.rot += lf.w * dt;
      const c = f.H(lf.hue, 0.6), r = ((lf.rot % TAU) + TAU) % TAU;
      g.set(lf.x, lf.y, '◆', c);
      g.set(lf.x + (Math.cos(r) > 0 ? 1 : -1), lf.y, Math.cos(r) > 0 ? '>' : '<', f.H(lf.hue, 0.45));
    }
    // 睡蓮與錦鯉
    if (p.koi) {
      for (const pd of s.pads) {
        for (let y = Math.floor(pd.y - pd.r / aspect); y <= pd.y + pd.r / aspect; y++) for (let x = Math.floor(pd.x - pd.r); x <= pd.x + pd.r; x++) {
          const dx = x + 0.5 - pd.x, dy = (y + 0.5 - pd.y) * aspect, a = Math.atan2(dy, dx);
          if (dx * dx + dy * dy < pd.r * pd.r && !(a > 0.2 && a < 0.8)) g.set(x, y, dx * dx + dy * dy < pd.r * pd.r * 0.5 ? '█' : '▓', f.H(110, 0.35 + 0.15 * nz(x, y)));
        }
        if (pd.fl) { g.set(pd.x, pd.y, '*', f.H(330, 0.8)); g.set(pd.x - 1, pd.y, '(', f.H(330, 0.65)); g.set(pd.x + 1, pd.y, ')', f.H(330, 0.65)); }
      }
      for (const k of s.koi) {
        k.a += (nz(k.seed, t * 0.2) - 0.5) * dt * 3;
        const xi = clamp(k.x | 0, 0, cols - 1), off = (k.y - yc[xi]) / hw[xi];
        if (Math.abs(off) > 0.75) k.a += Math.sign(Math.sin(k.a)) * (off > 0 ? 1 : -1) * dt * 2.5;
        const sp = (2.5 + 1.5 * Math.sin(t * 0.7 + k.seed)) * (cols / 160);
        k.x += Math.cos(k.a) * sp * dt; k.y += (Math.sin(k.a) * sp * dt) / aspect;
        if (k.x < -6) k.x = cols + 5; if (k.x > cols + 6) k.x = -5;
        const L = Math.max(5, Math.round(cols / 24)), ca = Math.cos(k.a), sa = Math.sin(k.a);
        const cA = [f.H(25, 0.62), f.H(5, 0.55), f.H(40, 0.75)][k.col], cB = s.hue ? rgb(250, 248, 240) : f.C(0.95);
        for (let j = L; j >= 0; j--) {
          const w = Math.sin(t * 5 + k.seed - j * 0.7) * j * 0.12, px = k.x - ca * j * 0.95 - sa * w, py = k.y - (sa * j * 0.95 - ca * w) / aspect;
          const c = j === L ? (ca > 0 ? '<' : '>') : j === 0 ? (ca > 0 ? ')' : '(') : j < L * 0.5 ? '█' : j < L * 0.8 ? '▓' : '▒';
          g.set(px, py, c, (j + k.col * 2) % 4 < 2 ? cA : cB);
        }
      }
    }
  } });

/* ═════════ 7. 雷暴天空 ═════════ */
// 閃電路徑：中點位移＋分岔，回傳線段 [x0,y0,x1,y1,粗細等級]
function boltPath(x0, y0, x1, y1, disp, depth, out, lvl) {
  const segs = [[x0, y0, x1, y1]];
  for (let it = 0; it < depth; it++) {
    const nx = [];
    for (const [a, b, c, d] of segs) {
      const mx = (a + c) / 2 + (Math.random() - 0.5) * disp, my = (b + d) / 2 + (Math.random() - 0.5) * disp * 0.25;
      nx.push([a, b, mx, my], [mx, my, c, d]);
    }
    segs.length = 0; segs.push(...nx); disp *= 0.55;
  }
  for (const sg of segs) out.push([sg[0], sg[1], sg[2], sg[3], lvl]);
  return segs;
}
const segCh = (dx, dy) => { const a = Math.abs(dx), b = Math.abs(dy) * 2.1; return b > a * 2 ? '|' : a > b * 2 ? (dy === 0 ? '_' : '-') : (dx > 0) === (dy > 0) ? '\\' : '/'; };
A({ id: 'na-storm', name: '雷暴天空', cat: '自然', theme: 'lavender', hue: true, desc: '翻滾的雷雨雲，雨幕與落雷',
  params: { kind: 'plain', base: 0.42, rain: 1, every: 7, wind: 0.25 },
  variants: [
    { id: 'far', name: '遠雷', theme: 'synth', desc: '遠方積雨雲內部一閃一閃', params: { kind: 'far', rain: 0, every: 2.5 } },
    { id: 'twister', name: '龍捲', theme: 'mono', desc: '烏雲下垂出旋轉的龍捲風', params: { kind: 'twister', base: 0.34, rain: 0.4, every: 9 } },
    { id: 'pour', name: '暴雨', theme: 'ice', desc: '狂風暴雨，雨幕一陣陣掃過', params: { kind: 'plain', base: 0.3, rain: 3, every: 14, wind: 0.8 } },
    { id: 'spider', name: '雷網', theme: 'neon', desc: '低垂雲層下，閃電橫向蔓延成網', params: { kind: 'spider', base: 0.5, rain: 0.3, every: 3, wind: 0.1 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.gy = Math.floor(rows * (p.kind === 'sea' ? 0.72 : 0.86));
    s.ground = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {
      const u = (x / cols) * 120;
      s.ground[x] = p.kind === 'peaks' ? rows * (0.95 - 0.55 * peak(u * 0.7, 61)) : p.kind === 'far' ? rows * (0.9 - 0.06 * ridge(u, 5))
        : p.kind === 'spider' ? rows * (0.9 - 0.035 * ridge(u * 0.6, 23)) : s.gy - rows * 0.04 * ridge(u * 2, 8);
    }
    // 雷網：遠方平原上零星的燈火
    s.lights = p.kind === 'spider' ? Array.from({ length: Math.max(6, (cols / 9) | 0) }, () => { const x = rint(0, cols - 1); return [x, Math.ceil(s.ground[x]) + rint(0, Math.max(1, (rows * 0.05) | 0)), Math.random()]; }) : [];
    s.drops = []; s.bolt = null; s.fl = 0; s.next = 1.5; s.glow = null;
    s.stars = Array.from({ length: (cols * rows / 50) | 0 }, () => [rint(0, cols - 1), rint(0, rows * 0.6), rnd(0, TAU)]);
    s.debris = p.kind === 'twister' ? Array.from({ length: 160 }, () => ({ a: rnd(0, TAU), r: rnd(0.3, 1.6), h: rnd(0, 1), v: rnd(1.5, 4) })) : [];
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), k = f.p.kind;
    s.key = f.C;
    s.Pc = k === 'spider' ? pal(f, h, [[12, 10, 24], [36, 32, 62], [78, 70, 120], [170, 156, 230]], 0.07, 0.62, 32)
      : pal(f, h, k === 'far' ? [[30, 16, 50], [90, 50, 110], [200, 140, 190], [255, 230, 240]] : [[34, 36, 52], [84, 88, 112], [146, 150, 178], [222, 224, 242]], 0.12, 0.85, 32);
    s.Pl = pal(f, h, [[120, 70, 20], [255, 190, 90]], 0.3, 0.6, 8);
    s.Pb = pal(f, h, [[120, 90, 255], [200, 190, 255], [255, 255, 255]], 0.6, 1, 16);
    s.Pr = pal(f, h, [[70, 82, 104], [140, 156, 184], [205, 218, 242]], 0.2, 0.6, 12);
    s.Pg = pal(f, h, k === 'sea' ? [[4, 12, 22], [20, 50, 70], [90, 130, 160]] : [[6, 10, 8], [20, 32, 24], [60, 80, 70]], 0.03, 0.4, 16);
    s.Pst = pal(f, h, [[60, 66, 100], [220, 226, 255]], 0.12, 0.7, 8);
    s.bg = k === 'far' ? [6, 4, 16] : k === 'sea' ? [12, 18, 30] : k === 'spider' ? [8, 8, 16] : [20, 22, 32];
  },
  strike(s, f) {
    const { cols, rows, p } = f, k = p.kind, base = rows * p.base, segs = [];
    if (k === 'far') { s.glow = { x: cols * rnd(0.35, 0.65), y: rows * rnd(0.3, 0.6), r: cols * rnd(0.06, 0.14) }; s.bolt = null; return; }
    if (k === 'spider') {
      const y = base + rnd(-0.02, 0.03) * rows, x0 = cols * rnd(0.02, 0.3), x1 = cols * rnd(0.7, 0.98);
      const main = boltPath(x0, y, x1, y + rnd(-2, 2), rows * 0.3, 6, segs, 0);
      for (let b = 0; b < 12; b++) { const sg = pick(main); boltPath(sg[0], sg[1], sg[0] + rnd(-0.14, 0.14) * cols, sg[1] + rnd(-0.16, 0.14) * rows, rows * 0.12, 4, segs, 1); }
      s.bolt = { segs, x: (x0 + x1) / 2, x1: (x0 + x1) / 2, y, crawl: 1, xa: Math.min(x0, x1), xb: Math.max(x0, x1) };
    } else {
      let x0 = cols * rnd(0.15, 0.85), y0 = base - rows * 0.08, x1 = x0 + rnd(-0.12, 0.12) * cols;
      if (k === 'peaks') { let best = 0; for (let x = 0; x < cols; x++) if (s.ground[x] < s.ground[best] - rnd(0, 3)) best = x; x1 = best; x0 = x1 + rnd(-0.1, 0.1) * cols; }
      const xi = clamp(Math.round(x1), 0, cols - 1), y1 = s.ground[xi];
      const main = boltPath(x0, y0, x1, y1, cols * 0.12, 6, segs, 0);
      for (let b = 0; b < 5; b++) { const sg = main[rint(4, main.length - 10)]; boltPath(sg[0], sg[1], sg[0] + rnd(-0.1, 0.1) * cols, sg[1] + rnd(0.08, 0.2) * rows, cols * 0.05, 4, segs, 1); }
      s.bolt = { segs, x: x0, y: y0, x1, y1 };
    }
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, k = p.kind;
    if (s.key !== f.C) this.pals(s, f);
    // 閃電時間軸：一次閃光平滑衰減（不頻閃），間隔數秒
    s.next -= dt;
    const spider = k === 'spider';
    if (s.next <= 0) { this.strike(s, f); s.fl = 1; s.age = 0; s.next = spider ? rnd(2.5, 3.5) : p.every * rnd(0.7, 1.4); }
    s.age = (s.age || 0) + dt;
    s.fl = Math.max(0, s.fl - dt * (k === 'far' ? 2.2 : 2.6));
    // 雷網不重閃，改成沿著電光留下約 1.5 秒慢慢變暗的餘光
    const fl = s.fl, re = !spider && s.age > 0.18 && s.age < 0.45 ? 0.35 * Math.sin(((s.age - 0.18) / 0.27) * Math.PI) : 0, F = Math.min(1, fl + re);
    const aft = spider && s.bolt ? 0.5 * Math.max(0, 1 - s.age / 2.4) : 0;
    if (s.hue) { const b = s.bg, e = k === 'far' ? 0 : F * (spider ? 0.08 : 0.18); f.bg = rgb(b[0] + 120 * e, b[1] + 120 * e, b[2] + 150 * e); }
    const base = rows * (p.base || 0.4), ks = 110 / cols, sp = t * (spider ? 1.2 : 2.2), FC = spider ? F * 0.5 : F;
    const bx = s.bolt ? s.bolt.x : s.glow ? s.glow.x : cols / 2, by = s.bolt ? s.bolt.y : s.glow ? s.glow.y : 0, R2 = (cols * (spider ? 0.2 : 0.3)) ** 2;
    // 星空（遠雷）
    if (k === 'far') for (const [x, y, ph] of s.stars) g.set(x, y, '.', pc(s.Pst, 0.35 + 0.3 * Math.sin(t * 1.3 + ph)));
    // 雲層
    const Pc = s.Pc;
    const cx0 = cols * 0.5, tw = k === 'twister' ? 1 : 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0, i = y * cols; x < cols; x++, i++) {
        let edge;
        if (k === 'far') {
          // 積雨雲：塔狀雲柱＋平頂砧狀雲
          const dx = Math.abs(x - cx0) / cols, yy = y / rows;
          const half = yy < 0.22 ? 0.42 - (0.22 - yy) * 0.6 : yy < 0.3 ? 0.18 + (0.3 - yy) * 3 : 0.12 + (yy - 0.3) * 0.5;
          if (yy < 0.12 || yy > 0.82) continue;
          edge = (half - dx) * 8 + (nz(x * ks * 2 + sp * 0.1, y * ks * 4) - 0.5) * 1.6;
        } else {
          const bump = (nz(x * ks * 0.3 + sp * 0.15, 9) - 0.5) * rows * (spider ? 0.03 : 0.1) + (nz(x * ks * 1.2 + sp * 0.4, 19) - 0.5) * rows * 0.03;
          let cb = base + bump;
          if (tw) cb += Math.max(0, 1 - Math.abs(x - cx0) / (cols * 0.18)) * rows * 0.08;
          edge = (cb - y) / (rows * 0.08);
        }
        if (edge < -0.2) continue;
        const u = x * ks + sp * (k === 'far' ? 0.05 : 1), v = y * ks * aspect * 1.4;
        const d = nz(u, v) * 0.65 + nz(u * 2.4 + 40, v * 2.4 - t * 0.5) * 0.35;
        let e = clamp(edge, 0, 1) * (0.55 + d * 0.8);
        if (e < 0.12) continue;
        const lit = d - nz(u, v - 1.5) * 0.65 - nz(u * 2.4 + 40, (v - 1.5) * 2.4 - t * 0.5) * 0.35;
        let L = e * (0.3 + d * 0.48) + lit * 2.4 * e;
        if (FC > 0) { const dx = x - bx, dy = (y - by) * aspect; L += FC * Math.exp(-(dx * dx + dy * dy) / (k === 'far' && s.glow ? s.glow.r ** 2 * 2 : R2)) * (0.8 + d * 0.4); }
        if (aft > 0 && x > s.bolt.xa - 4 && x < s.bolt.xb + 4) { const dy = (y - s.bolt.y) / (rows * 0.12); if (dy > -1 && dy < 1) L += aft * (1 - dy * dy) * (0.25 + d * 0.5); }
        if (L < 0.06) { if (k === 'far') { ch[i] = '█'; co[i] = Pc[0]; } continue; }
        ch[i] = R10[Math.min(9, 1 + ((L * 9) | 0))];
        co[i] = pc(Pc, Math.min(1, L));
      }
    }
    // 地面／海面
    const Pg = s.Pg, sea = k === 'sea';
    for (let x = 0; x < cols; x++) {
      const top = s.ground[x];
      for (let y = Math.max(0, Math.floor(top)); y < rows; y++) {
        const i = y * cols + x;
        if (sea) {
          const q = (y - top) / (rows - top), w = nz(x * 0.12 * (1 + q) + t * 0.6, y * 1.5 - t * 0.8);
          let L = 0.15 + w * 0.5 * (0.5 + q);
          if (s.bolt && F > 0) L += F * Math.max(0, 1 - Math.abs(x - s.bolt.x1) / (2 + q * 6)) * 0.8;
          ch[i] = w > 0.7 ? '~' : w > 0.45 ? '-' : w > 0.25 ? '.' : '_'; co[i] = pc(Pg, L);
          continue;
        }
        const lt = F * 0.25 * Math.exp(-((x - (s.bolt ? s.bolt.x1 : bx)) ** 2) / R2);
        ch[i] = y === Math.floor(top) ? EIGHTH[clamp(Math.round((y + 1 - top) * 8), 1, 8)] : '█';
        co[i] = pc(Pg, 0.08 + lt + (k === 'peaks' ? nz(x * 0.4, y * 0.8) * 0.15 : 0));
      }
      if (!sea && k !== 'peaks' && k !== 'far' && !spider) { const ty = Math.floor(top) - 1, sw = (nz(x * 0.25 - t * 2, 5) - 0.5) * 3 * (p.wind + 0.3) - p.wind * 0.6; g.set(x, ty, sw > 0.35 ? '/' : sw < -0.35 ? '\\' : '|', pc(Pg, 0.2 + F * 0.3)); }
    }
    // 曠野上的一棵孤樹
    if (spider) for (const [x, y, ph] of s.lights) g.set(x, y, ph > 0.8 ? '+' : '.', pc(s.Pl, 0.5 + 0.3 * Math.sin(t * (0.5 + ph) + ph * 9)));
    if (k === 'plain') {
      const tx = Math.round(cols * 0.78), gy0 = Math.floor(s.ground[tx]), th = Math.round(rows * 0.12), cr = Math.max(4, cols * 0.045), cy = gy0 - th - cr / aspect * 0.6;
      const tc = pc(Pg, 0.1 + F * 0.25);
      for (let y = gy0 - th; y < gy0; y++) g.set(tx, y, '█', tc);
      for (let y = Math.floor(cy - cr / aspect); y <= cy + cr / aspect; y++) for (let x = Math.floor(tx - cr * 1.3); x <= tx + cr * 1.3; x++) {
        const dx = (x - tx) / (cr * 1.3), dy = (y - cy) * aspect / cr, sw = Math.sin(t * 1.7 + y) * 0.08 * p.wind;
        if ((dx - sw) * (dx - sw) + dy * dy < 0.85 + (nz(x * 0.6, y * 1.3) - 0.5) * 0.5) g.set(x, y, '█', tc);
      }
    }
    // 龍捲風
    if (tw) {
      const top = base + rows * 0.06, bot = s.ground[cols >> 1] - 0.5, H = bot - top;
      for (let y = Math.floor(top); y < bot; y++) {
        const q = (y - top) / H, xc = cx0 + Math.sin(t * 0.5 + q * 2.2) * cols * 0.05 * q + Math.sin(t * 0.23) * cols * 0.08;
        const w = cols * (0.09 * Math.pow(1 - q, 2.2) + 0.008);
        for (let x = Math.floor(xc - w - 1); x <= xc + w + 1; x++) {
          const r = (x + 0.5 - xc) / w;
          if (Math.abs(r) > 1) continue;
          const ph = Math.asin(clamp(r, -1, 1)) * 3 + t * 9 - y * 0.5, L = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(ph)) * Math.sqrt(1 - r * r) + F * 0.3;
          g.set(x, y, Math.sin(ph) > 0.3 ? ')' : Math.sin(ph) < -0.3 ? '(' : '|', pc(Pc, L));
        }
      }
      for (const d of s.debris) {
        d.a += dt * d.v; d.h = (d.h + dt * 0.12) % 1;
        const xc = cx0 + Math.sin(t * 0.23) * cols * 0.08, r = d.r * cols * 0.04 * (1 + d.h), x = xc + Math.cos(d.a) * r, y = bot - d.h * rows * 0.12 + Math.sin(d.a) * r * 0.25 / aspect;
        g.set(x, y, d.r > 1 ? '.' : ',', pc(Pc, 0.35 + (Math.sin(d.a) > 0 ? 0.2 : 0)));
      }
    }
    // 雨
    const want = Math.round((cols * rows / 18) * p.rain);
    while (s.drops.length < want) s.drops.push({ x: rnd(-cols * 0.3, cols * 1.1), y: rnd(base - rows * 0.06, rows), v: rnd(0.9, 1.3), r: Math.random() });
    if (s.drops.length > want) s.drops.length = want;
    const Pr = s.Pr, wind = p.wind + 0.2 * Math.sin(t * 0.3), vy = rows * 1.1, rch = wind > 0.5 ? '/' : wind > 0.15 ? '/' : '|';
    for (const d of s.drops) {
      d.y += vy * d.v * dt; d.x -= wind * vy * d.v * dt * 0.5;
      const xi = clamp(d.x | 0, 0, cols - 1);
      if (d.y >= s.ground[xi] || d.x < -2) {
        d.y = base - rows * 0.06 + rnd(0, rows * 0.05); d.x = rnd(0, cols * 1.3);
        if (k === 'far') d.x = cols * 0.5 + rnd(-0.1, 0.1) * cols;
        continue;
      }
      const shaft = nz(d.x * (150 / cols) + t * 2, 3.3);
      // 雨幕：每滴有固定的門檻，雨柱邊緣是漸漸變稀，不是一刀切齊
      if (p.rain < 2 && d.r > smooth((shaft - 0.15) / 0.35)) continue;
      g.set(d.x, d.y, rch, pc(Pr, 0.45 + shaft * 0.55 + F * 0.3));
    }
    // 閃電本體
    if (s.bolt && (fl > 0.02 || re > 0.02 || aft > 0.02)) {
      const b = s.bolt, n = b.segs.length, show = b.crawl ? Math.min(n, Math.floor(n * Math.min(1, s.age / 0.5))) : n, FB = Math.max(F, aft);
      for (let j = 0; j < show; j++) {
        const [x0, y0, x1, y1, lv] = b.segs[j];
        const c = segCh(x1 - x0, y1 - y0), I = lv ? FB * 0.7 : FB;
        if (I < 0.08) continue;
        if (!lv) g.line(x0 + 1, y0, x1 + 1, y1, ':', pc(s.Pb, I * 0.45));
        g.line(x0, y0, x1, y1, c, pc(s.Pb, I));
      }
    }
  } });

/* ═════════ 8. 沙丘風痕 ═════════ */
// 沙丘剖面：迎風面緩、背風面陡（風從左邊吹來）
function duneH(u, row) {
  const ph = u * 0.014 + nz(u * 0.02, row + 3) * 1.2, fr = ph - Math.floor(ph);
  const sh = fr < 0.74 ? smooth(fr / 0.74) : 1 - smooth((fr - 0.74) / 0.26);
  return sh * (0.45 + 0.75 * nz(u * 0.05, row)) + nz(u * 0.3, row + 7) * 0.08;
}
function camel(g, x, yb, H, ph, col, aspect) {
  const W = H * aspect * 1.15, legs = Math.sin(ph);
  const inE = (px, py, cx, cy, rx, ry) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 < 1;
  for (let y = Math.floor(yb - H * 1.05); y <= yb; y++) for (let xx = Math.floor(x - W * 0.6); xx <= x + W * 0.75; xx++) {
    const px = xx + 0.5, py = (y + 0.5);
    let on = inE(px, py, x, yb - H * 0.58, W * 0.42, H * 0.17) || inE(px, py, x - W * 0.14, yb - H * 0.72, W * 0.16, H * 0.14) || inE(px, py, x + W * 0.14, yb - H * 0.7, W * 0.13, H * 0.12)
      || inE(px, py, x + W * 0.58, yb - H * 0.92, W * 0.11, H * 0.07);
    if (!on) { // 脖子
      const t2 = (px - (x + W * 0.36)) / (W * 0.22);
      if (t2 >= 0 && t2 <= 1 && Math.abs(py - (yb - H * (0.6 + 0.3 * t2))) < H * 0.07) on = true;
    }
    if (!on && py > yb - H * 0.45) { // 四條腿
      for (const [lx, s2] of [[-0.3, 1], [-0.2, -1], [0.22, -1], [0.32, 1]]) {
        const q = (py - (yb - H * 0.45)) / (H * 0.45), cx2 = x + W * lx + legs * s2 * W * 0.07 * q;
        if (Math.abs(px - cx2) < Math.max(0.5, W * 0.035)) on = true;
      }
    }
    if (on) g.set(xx, y, '█', col);
  }
}
A({ id: 'na-dunes', name: '沙丘風痕', cat: '自然', theme: 'amber', hue: true, desc: '烈日下層層沙丘，沙粒隨風揚起',
  params: { mode: 'day', L: 4, top: 0.42, bot: 0.8, amp: 1, blow: 1, storm: 0, caravan: 0, oasis: 0, ripple: 0, pan: 1, sunX: 0.24 },
  variants: [
    { id: 'night', name: '月夜', theme: 'ice', desc: '月光與星空下的冷色沙丘', params: { mode: 'night', blow: 0.4, sunX: 0.72, pan: 0.5 } },
    { id: 'storm', name: '沙暴', theme: 'fire', desc: '漫天黃沙席捲而來', params: { mode: 'storm', storm: 1, blow: 3, pan: 2.5 } },
    { id: 'caravan', name: '駝隊', theme: 'sunset', desc: '夕陽下沿著沙脊行走的駱駝隊', params: { mode: 'dusk', caravan: 1, L: 3, top: 0.5, bot: 0.78, sunX: 0.5, pan: 0.6, blow: 0.5 } },
    { id: 'oasis', name: '綠洲', theme: 'mint', desc: '沙丘間的一汪清水與椰影', params: { mode: 'day', oasis: 1, L: 3, top: 0.4, bot: 0.62, pan: 0.2, blow: 0.6 } },
    { id: 'dawn', name: '晨光', theme: 'lavender', desc: '日出時沙丘一明一暗的稜線', params: { mode: 'dawn', L: 5, top: 0.36, bot: 0.86, amp: 1.3, sunX: 0.12, pan: 0.4, blow: 0.3 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.T = new Float32Array(p.L * cols);
    s.lay = Array.from({ length: p.L }, (_, k) => { const q = p.L > 1 ? k / (p.L - 1) : 1; return { q, base: rows * (p.top + (p.bot - p.top) * q), amp: rows * (0.09 + 0.12 * q) * p.amp, span: 260 - 120 * q, row: 31 + k * 17, spd: p.pan * (0.3 + 3 * q * q), off: rnd(0, 500) }; });
    s.sand = []; s.stars = Array.from({ length: (cols * rows / 45) | 0 }, () => [rint(0, cols - 1), rint(0, rows * 0.6), rnd(0, TAU), Math.random()]);
    s.camels = p.caravan ? Array.from({ length: 5 }, (_, k) => ({ d: k * 1.6, ph: k * 1.3 })) : [];
    s.cx = cols * 0.2;
    s.palms = p.oasis ? [{ x: 0.36, h: 0.28, lean: -0.15 }, { x: 0.44, h: 0.22, lean: 0.1 }, { x: 0.6, h: 0.3, lean: 0.2 }, { x: 0.66, h: 0.18, lean: -0.05 }] : [];
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), m = f.p.mode;
    s.key = f.C;
    const C = {
      day: { bg: [64, 132, 206], lit: [246, 200, 130], sh: [176, 106, 60], haze: [236, 214, 186], sun: [255, 250, 220] },
      night: { bg: [4, 8, 22], lit: [96, 116, 168], sh: [24, 30, 58], haze: [40, 50, 86], sun: [240, 240, 220] },
      storm: { bg: [120, 70, 30], lit: [214, 150, 80], sh: [130, 74, 36], haze: [200, 130, 70], sun: [255, 220, 160] },
      dusk: { bg: [70, 26, 54], lit: [255, 150, 84], sh: [96, 40, 56], haze: [240, 120, 100], sun: [255, 200, 120] },
      dawn: { bg: [40, 30, 70], lit: [255, 190, 150], sh: [70, 50, 96], haze: [200, 150, 170], sun: [255, 236, 200] },
    }[m] || {};
    s.C = C;
    s.Pl = []; for (let k = 0; k < f.p.L; k++) { const q = f.p.L > 1 ? k / (f.p.L - 1) : 1; s.Pl.push(pal(f, h, [mix3(C.sh, C.haze, 0.6 * (1 - q)), mix3(C.lit, C.haze, 0.5 * (1 - q))], 0.12 + 0.25 * q, 0.4 + 0.5 * q, 24)); }
    s.Ps = pal(f, h, [C.haze, C.sun], 0.5, 1, 16);
    s.Pst = pal(f, h, [[80, 90, 130], [240, 245, 255]], 0.2, 0.8, 8);
    s.Pg = pal(f, h, [[10, 50, 20], [40, 120, 40], [120, 190, 80]], 0.2, 0.7, 16);
    s.Pw = pal(f, h, [[20, 80, 110], [80, 170, 190], [200, 240, 250]], 0.2, 0.8, 16);
    s.Pr = pal(f, h, [[60, 30, 10], [170, 110, 60], [240, 196, 140], [255, 236, 200]], 0.1, 0.9, 32);
    s.dark = h ? rgb(C.sh[0] * 0.25, C.sh[1] * 0.25, C.sh[2] * 0.25) : f.C(0.9);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co;
    if (s.key !== f.C) this.pals(s, f);
    if (p.ripple) return this.ripples(s, f);
    if (s.hue) f.bg = rgb(s.C.bg[0], s.C.bg[1], s.C.bg[2]);
    const L = s.lay.length, T = s.T, night = p.mode === 'night';
    // 太陽／月亮與天空
    const sx = cols * p.sunX, sy = rows * (p.mode === 'dusk' ? 0.4 : p.mode === 'dawn' ? 0.36 : 0.16), R = Math.max(2, rows * aspect * (p.mode === 'dusk' ? 0.11 : 0.065));
    if (night || p.mode === 'dawn') for (const [x, y, ph, b] of s.stars) if (night || y < rows * 0.15) g.set(x, y, b > 0.92 ? '+' : '.', pc(s.Pst, (0.25 + 0.6 * b) * (0.6 + 0.4 * Math.sin(t * 1.4 + ph)) * (night ? 1 : 0.5)));
    for (let y = 0; y < rows * 0.7; y++) for (let x = 0; x < cols; x++) {
      const dx = x + 0.5 - sx, dy = (y + 0.5 - sy) * aspect, d2 = dx * dx + dy * dy;
      if (d2 < R * R) { g.set(x, y, night ? (nz(dx + 30, dy + 30) > 0.65 ? '%' : '@') : '@', pc(s.Ps, 1)); continue; }
      const gl = Math.exp(-d2 / (R * R * 6)) * 0.8 + (p.mode === 'dusk' || p.mode === 'dawn' ? Math.exp(-Math.abs(y - rows * 0.5) / (rows * 0.12)) * 0.25 : 0);
      if (gl > 0.1 && hash2(x, y) < gl) g.set(x, y, gl > 0.5 ? ':' : '.', pc(s.Ps, gl));
    }
    // 沙丘稜線
    for (let k = 0; k < L; k++) {
      const ly = s.lay[k], off = ly.off + t * ly.spd, o = k * cols;
      for (let x = 0; x < cols; x++) T[o + x] = ly.base - ly.amp * duneH(((x + off) / cols) * ly.span, ly.row);
    }
    const litLeft = p.sunX < 0.5;
    for (let x = 0; x < cols; x++) {
      let mn = rows;
      for (let k = 0; k < L; k++) mn = Math.min(mn, T[k * cols + x]);
      for (let y = Math.max(0, Math.floor(mn)); y < rows; y++) {
        let k = L - 1;
        while (k >= 0 && T[k * cols + x] > y + 1) k--;
        if (k < 0) continue;
        const i = y * cols + x, tp = T[k * cols + x], ly = s.lay[k];
        if (y < tp) {
          let kb = k - 1;
          while (kb >= 0 && T[kb * cols + x] > y + 0.5) kb--;
          if (kb < 0) { const kk = Math.round((y + 1 - tp) * 8); if (kk > 0) { ch[i] = EIGHTH[kk]; co[i] = pc(s.Pl[k], 0.7); } continue; }
          if (y + 1 - tp < 0.5) k = kb;
        }
        const o = k * cols, sl = T[o + Math.min(cols - 1, x + 1)] - T[o + Math.max(0, x - 1)];
        const facing = litLeft ? -sl : sl;
        const dep = (y - T[o + x]) / rows;
        let v = clamp(0.55 + facing * 0.9, 0.05, 1);
        const rip = Math.sin((y - T[o + x]) * 2.2 + x * 0.35 * (1 + s.lay[k].q) + nz(x * 0.1, y * 0.2) * 4);
        v *= 0.86 + 0.14 * rip;
        v *= 1 - Math.min(0.35, dep * 1.2);
        ch[i] = '█'; co[i] = pc(s.Pl[k], v);
      }
    }
    // 綠洲：水池與椰子樹
    if (p.oasis) this.oasis(s, f);
    // 駝隊
    if (p.caravan) {
      const k = L - 1, o = k * cols, H = rows * 0.09;
      s.cx += dt * cols * 0.012;
      if (s.cx > cols * 1.15) s.cx = -cols * 0.1;
      for (const c of s.camels) {
        const x = s.cx - c.d * H * aspect * 1.4, xi = clamp(Math.round(x), 0, cols - 1);
        camel(g, x, T[o + xi] + 0.6, H, t * 3 + c.ph, s.dark, aspect);
      }
    }
    // 揚沙
    const want = Math.round(cols * rows / 60 * p.blow);
    const Pl = s.Pl[L - 1];
    while (s.sand.length < want) s.sand.push({ x: rnd(-5, cols), y: rnd(rows * 0.35, rows), v: rnd(0.6, 1.4), l: rnd(0, 3) });
    if (s.sand.length > want) s.sand.length = want;
    const wv = cols * 0.08 * (p.storm ? 3 : 1);
    for (const q of s.sand) {
      q.x += wv * q.v * dt; q.y += Math.sin(t * 3 + q.x * 0.2) * dt * 0.8 + dt * 0.4; q.l -= dt;
      if (q.x > cols + 2 || q.l < 0) { q.x = rnd(-6, cols * 0.8); const k = rint(0, L - 1); q.y = T[k * cols + clamp(q.x | 0, 0, cols - 1)] - rnd(0, 2); q.l = rnd(1, 4); }
      dot(g, q.x, q.y, q.v > 1.2 ? '-' : q.v > 0.9 ? '~' : '.', pc(Pl, 0.8 + q.v * 0.15));
    }
    // 沙暴霧氣
    if (p.storm) {
      const Ph = s.Pr;
      for (let y = 0; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
        const n = nz(x * (90 / cols) * 0.6 - t * 9, y * (90 / cols) * 3.5) * 0.7 + nz(x * (90 / cols) * 1.5 - t * 22, y * (90 / cols) * 9) * 0.3;
        const d = n * 1.3 - 0.35 + (y / rows) * 0.2;
        if (d < 0.3) continue;
        ch[i] = d > 0.85 ? '▓' : d > 0.6 ? '▒' : d > 0.45 ? '░' : ':';
        co[i] = pc(Ph, 0.35 + d * 0.5);
      }
    }
  },
  oasis(s, f) {
    const { g, cols, rows, aspect, t } = f, cx = cols * 0.5, cy = rows * 0.82, rx = cols * 0.22, ry = rows * 0.07;
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 4); x <= cx + rx + 4; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 1) { const w = nz(x * 0.2 + t * 0.4, y * 1.3); g.set(x, y, w > 0.62 ? '~' : '█', w > 0.62 ? pc(s.Pw, 0.9) : pc(s.Pw, 0.25 + 0.35 * (1 - d))); }
      else if (d < 1.5 && hash2(x, y) > 0.35) g.set(x, y, hash2(x + 1, y) > 0.5 ? '"' : ',', pc(s.Pg, 0.4 + 0.4 * hash2(x, y + 1)));
    }
    for (const pm of s.palms) {
      const bx = cols * pm.x, by = cy - ry * 0.4, H = rows * pm.h, sway = Math.sin(t * 0.9 + pm.x * 9) * 0.04;
      let tx = bx, ty = by;
      for (let k = 0; k <= H; k++) { const q = k / H; tx = bx + (pm.lean + sway) * q * q * H * aspect; ty = by - k; g.set(tx, ty, '█', pc(s.Pr, 0.25 + (k % 2) * 0.1)); }
      for (let a = 0; a < 7; a++) {
        const an = -Math.PI * 0.95 + (a / 6) * Math.PI * 0.9 + sway * 3, Lf = H * 0.55 * (0.8 + 0.3 * Math.sin(a * 2.3));
        let px = tx, py = ty;
        for (let j = 1; j <= Lf; j++) {
          const q = j / Lf, nx = tx + Math.cos(an) * j * aspect * 0.55, ny = ty + Math.sin(an) * j * 0.5 + q * q * Lf * 0.55;
          g.set(nx, ny, Math.abs(Math.cos(an)) < 0.3 ? '|' : (Math.cos(an) > 0) === (q > 0.5) ? '\\' : '/', pc(s.Pg, 0.5 + 0.3 * (1 - q)));
          px = nx; py = ny;
        }
      }
    }
  },
  ripples(s, f) {
    const { g, cols, rows, aspect, t, dt } = f, ch = g.ch, co = g.co, Pr = s.Pr, k = 100 / cols;
    if (s.hue) f.bg = rgb(90, 50, 20);
    for (let y = 0; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
      const w = nz(x * k * 0.55 + 20, y * k * aspect * 0.6) * 16 + nz(x * k * 1.6, y * k * aspect * 1.8) * 3;
      const ph = (x * k * 0.95 + w + y * k * aspect * 0.25) - t * 0.25, sn = Math.sin(ph * 1.4), c = Math.cos(ph * 1.4);
      const v = 0.5 + 0.5 * sn;
      ch[i] = c > 0.5 ? (sn > 0 ? ')' : '|') : c < -0.6 ? ' ' : v > 0.7 ? '(' : v > 0.4 ? ':' : '.';
      co[i] = pc(Pr, 0.2 + v * 0.75 + (c > 0.5 ? 0.1 : 0));
    }
    const want = Math.round(cols * rows / 80);
    while (s.sand.length < want) s.sand.push({ x: rnd(0, cols), y: rnd(0, rows), v: rnd(0.5, 1.5), h: 0, l: rnd(0, 2) });
    for (const q of s.sand) {
      q.l -= dt; q.x += cols * 0.05 * q.v * dt * (q.l % 1 > 0.5 ? 1 : 0.2);
      if (q.x > cols || q.l < 0) { q.x = rnd(-3, cols); q.y = rnd(0, rows); q.l = rnd(1, 3); }
      g.set(q.x, q.y, '·', pc(Pr, 1));
    }
  } });

/* ═════════ 9. 風吹草浪 ═════════ */
A({ id: 'na-grass', name: '風吹草浪', cat: '自然', theme: 'forest', hue: true, desc: '一陣陣風吹過草原，草浪起伏發亮',
  params: { kind: 'grass', hz: 0.38, wind: 1, sky: 'day', tree: 0 },
  variants: [
    { id: 'wheat', name: '麥浪', theme: 'gold', desc: '金黃麥田在風中翻起麥浪', params: { kind: 'wheat', hz: 0.34 } },
    { id: 'reed', name: '芒草坡', theme: 'lavender', desc: '秋天山坡上銀白的芒草花穗', params: { kind: 'reed', hz: 0.3, sky: 'dusk', wind: 0.8 } },
    { id: 'flowers', name: '花海', theme: 'rainbow', desc: '五顏六色的花田隨風搖擺', params: { kind: 'flowers', hz: 0.36, wind: 0.7 } },
    { id: 'paddy', name: '稻田', theme: 'mint', desc: '一行行秧苗倒映著天空', params: { kind: 'paddy', hz: 0.32, wind: 0.6 } },
    { id: 'moon', name: '月下草原', theme: 'ice', desc: '月光下草浪泛著銀光', params: { kind: 'grass', sky: 'night', hz: 0.42, tree: 1 } },
    { id: 'dandelion', name: '蒲公英', theme: 'toxic', desc: '蒲公英種子乘風飛起', params: { kind: 'dandelion', hz: 0.4, wind: 0.8 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.stars = Array.from({ length: (cols * rows / 40) | 0 }, () => [rint(0, cols - 1), rint(0, rows * p.hz), rnd(0, TAU), Math.random()]);
    s.hill = new Float32Array(cols);
    for (let x = 0; x < cols; x++) s.hill[x] = rows * p.hz - rows * (p.kind === 'reed' ? 0.12 : 0.05) * ridge((x / cols) * 100, 23) - (p.tree ? 0 : 0);
    s.seeds = [];
    s.egret = { x: cols * 0.7, y: rows * 0.7, ph: 0 };
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), p = f.p, k = p.kind, night = p.sky === 'night';
    s.key = f.C;
    const G = {
      grass: night ? [[4, 14, 18], [20, 50, 60], [90, 130, 150], [200, 225, 240]] : [[16, 50, 16], [44, 110, 34], [130, 180, 70], [226, 240, 170]],
      wheat: [[70, 40, 10], [160, 110, 30], [230, 190, 80], [255, 240, 180]],
      reed: [[50, 30, 40], [120, 90, 90], [210, 190, 190], [255, 248, 240]],
      flowers: [[16, 50, 16], [44, 110, 34], [110, 170, 60], [200, 230, 140]],
      paddy: [[16, 60, 30], [40, 130, 50], [110, 200, 90], [200, 250, 170]],
      dandelion: [[20, 56, 20], [50, 120, 40], [130, 190, 80], [220, 240, 170]],
    }[k];
    s.Pg = pal(f, h, G, 0.12, 1, 40);
    const sky = night ? { bg: [6, 10, 26], cl: [[20, 26, 46], [80, 90, 120]] } : p.sky === 'dusk' ? { bg: [60, 40, 80], cl: [[110, 70, 110], [255, 190, 150]] } : { bg: [70, 140, 210], cl: [[170, 196, 226], [255, 255, 255]] };
    s.bg = night ? sky.bg : { grass: [12, 34, 12], wheat: [56, 34, 8], reed: [36, 22, 32], flowers: [12, 34, 12], paddy: [10, 36, 24], dandelion: [14, 38, 14] }[k];
    s.Psky = pal(f, h, p.sky === 'dusk' ? [[50, 30, 80], [150, 80, 120], [255, 170, 120]] : [[30, 90, 180], [90, 160, 230], [190, 220, 245]], 0.04, 0.3, 32);
    s.Pcb = pal(f, h, p.sky === 'dusk' ? [[120, 70, 110], [255, 200, 160]] : [[190, 205, 225], [255, 255, 255]], 0.3, 0.55, 16);
    s.Pc = pal(f, h, sky.cl, 0.2, 0.6, 16);
    s.Pw = pal(f, h, [sky.bg.map(v => v * 0.8), sky.cl[1]], 0.15, 0.55, 16);
    s.Ph = pal(f, h, night ? [[4, 8, 16], [14, 22, 36]] : k === 'reed' ? [[60, 40, 70], [110, 80, 110]] : [[60, 100, 110], [110, 150, 160]], 0.06, 0.25, 8);
    s.Pm = pal(f, h, [[200, 200, 180], [255, 255, 240]], 0.7, 1, 8);
    s.Pseed = pal(f, h, [[180, 190, 180], [255, 255, 255]], 0.5, 1, 8);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, k = p.kind, night = p.sky === 'night';
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.bg[0], s.bg[1], s.bg[2]);
    const hz = Math.floor(rows * p.hz), hill = s.hill;
    // 天空：雲、星、月
    if (night) {
      for (const [x, y, ph, b] of s.stars) if (y < hill[x] - 1) g.set(x, y, b > 0.9 ? '+' : '.', pc(s.Pm, 0.3 + 0.5 * b * (0.6 + 0.4 * Math.sin(t + ph))));
      const mx = cols * 0.7, my = rows * 0.14, mr = Math.max(1.5, rows * aspect * 0.06);
      for (let y = Math.floor(my - mr); y <= my + mr; y++) for (let x = Math.floor(mx - mr); x <= mx + mr; x++) { const dx = x + 0.5 - mx, dy = (y + 0.5 - my) * aspect; if (dx * dx + dy * dy < mr * mr) g.set(x, y, nz(dx + 9, dy) > 0.65 ? '%' : '@', pc(s.Pm, 1)); }
    }
    const kc = 100 / cols;
    for (let y = 0; y < hz; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
      if (y >= hill[x] || ch[i] !== ' ') continue;
      const d = nz(x * kc * 0.8 + t * 1.2, y * kc * aspect * 1.8) * 0.75 + nz(x * kc * 2 + t * 2, y * kc * aspect * 4) * 0.25;
      const e = (d - (night ? 0.62 : 0.55)) * 3.5 * (1 - y / hz * 0.5);
      if (night) { if (e < 0.08) continue; ch[i] = R10[Math.min(9, 1 + ((e * 7) | 0))]; co[i] = pc(s.Pc, Math.min(1, e)); continue; }
      // 白天：用方塊畫出漸層天空與雲
      ch[i] = '█'; co[i] = e > 0.1 ? pc(s.Pcb, Math.min(1, e * 1.3)) : pc(s.Psky, y / hz);
    }
    // 遠山
    for (let x = 0; x < cols; x++) for (let y = Math.max(0, Math.floor(hill[x])); y < hz; y++) g.set(x, y, y === Math.floor(hill[x]) ? EIGHTH[clamp(Math.round((y + 1 - hill[x]) * 8), 1, 8)] : '█', pc(s.Ph, 0.5));
    if (p.tree) {
      const tx = Math.round(cols * 0.28), th = Math.round(rows * 0.16), cr = Math.max(4, cols * 0.05), cy = hz - th;
      for (let y = cy; y < hz + 1; y++) g.set(tx, y, '█', pc(s.Ph, 0.2));
      for (let y = Math.floor(cy - cr / aspect * 1.4); y < cy + cr / aspect * 0.5; y++) for (let x = Math.floor(tx - cr * 1.4); x < tx + cr * 1.4; x++) {
        const dx = (x - tx) / (cr * 1.4), dy = (y - (cy - cr / aspect * 0.5)) * aspect / cr, sw = Math.sin(t * 1.1 + y * 0.5) * 0.05;
        if ((dx - sw) ** 2 + dy * dy < 0.8 + (nz(x * 0.7, y * 1.5) - 0.5) * 0.4) g.set(x, y, '█', pc(s.Ph, 0.15));
      }
    }
    // 草原：透視＋風浪
    const Pg = s.Pg, H = rows - hz, cx = cols / 2;
    const near = k === 'reed' ? '}{|/' : '|/', wind = p.wind;
    for (let y = hz; y < rows; y++) {
      const dz = (y - hz + 1) / H, z = 1 / dz, Z = z * 6;
      const fog = 1 - Math.min(1, dz * 2.2);
      for (let x = 0, i = y * cols; x < cols; x++, i++) {
        const X = (x - cx) * kc * z * 0.5;
        const gust = 0.5 + 0.5 * Math.sin(Z * 0.55 + X * 0.08 + t * 2.1 * wind + nz(X * 0.04, Z * 0.06) * 5);
        const w = clamp(0.55 * nz(X * 0.12 - t * 0.6 * wind, Z * 0.3 + t * 1.2 * wind + 40) + 0.55 * gust * gust - 0.05, 0, 1);
        let L = 0.25 + dz * 0.25 + w * 0.5 + fog * 0.15;
        let c;
        const hsh = hash2(x, y);
        if (k === 'paddy') {
          const rowp = fract(Z * 0.5 + X * 0.04);
          if (H * dz * dz / 3 > 2.2 && rowp > 0.62) { const wv = nz(x * 0.3 + t * 0.5, y * 1.5); ch[i] = wv > 0.7 ? '~' : '█'; co[i] = wv > 0.7 ? pc(s.Pw, 1) : pc(s.Psky, 0.3 + wv * 0.35); continue; }
        }
        if (dz < 0.12) c = hsh > 0.5 ? '.' : ',';
        else if (dz < 0.35) c = w > 0.55 ? '/' : w > 0.3 ? "'" : hsh > 0.5 ? '"' : ',';
        else c = w > 0.78 ? '_' : w > 0.45 ? '/' : w > 0.22 ? (hsh > 0.4 ? '/' : '|') : '|';
        if (k === 'wheat' && dz > 0.3 && hsh > 0.72) { c = w > 0.5 ? 'y' : 'Y'; L += 0.15; }
        if (k === 'reed' && dz > 0.25 && hsh > 0.66) { c = w > 0.5 ? '~' : near[(hsh * 7 | 0) % 2]; L = 0.75 + w * 0.25; }
        if (k === 'flowers' && dz > 0.15 && hsh > 0.8 - dz * 0.15) {
          const hu = [0, 30, 50, 280, 320, 200][(hash2(x + 7, y) * 6) | 0];
          ch[i] = dz > 0.6 ? (hsh > 0.93 ? '@' : '*') : hsh > 0.9 ? 'o' : '.'; co[i] = f.H(hu, 0.45 + 0.25 * w + 0.1 * dz); continue;
        }
        if (k === 'dandelion' && dz > 0.3 && hsh > 0.9) { ch[i] = 'o'; co[i] = pc(s.Pseed, 0.6 + 0.3 * w); continue; }
        if (night) L = 0.18 + w * 0.8 * (0.5 + 0.5 * dz) + fog * 0.12;
        ch[i] = c; co[i] = pc(Pg, Math.min(1, L));
      }
    }
    // 白鷺（稻田）
    if (k === 'paddy') {
      const e = s.egret;
      e.ph += dt;
      const fly = fract(e.ph / 28) > 0.78;
      if (fly) { e.x += dt * cols * 0.05; e.y -= dt * rows * 0.02; if (e.x > cols + 5) { e.x = -5; e.y = rows * 0.75; } }
      else if (e.y < hz + 2) e.y = rows * rnd(0.6, 0.8);
      const c = s.hue ? rgb(250, 250, 245) : f.C(1);
      if (fly) { g.text(e.x - 2, e.y, Math.sin(t * 6) > 0 ? '\\_v_/' : '_/v\\_', c); }
      else { g.text(e.x, e.y - 2, ' ,', c); g.text(e.x, e.y - 1, '(\\', c); g.text(e.x, e.y, ' ||', c); }
    }
    // 蒲公英種子
    if (k === 'dandelion') {
      const want = Math.round(cols * rows / 90);
      while (s.seeds.length < want) s.seeds.push({ x: rnd(-cols * 0.2, cols), y: rnd(hz, rows), vx: rnd(3, 8), vy: rnd(-3, -0.5), ph: rnd(0, TAU) });
      for (const q of s.seeds) {
        q.x += q.vx * dt * (cols / 160) * (0.6 + 0.6 * Math.sin(t * 0.7 + q.ph)); q.y += q.vy * dt * (rows / 45) + Math.sin(t * 2 + q.ph) * dt;
        if (q.x > cols + 2 || q.y < -2) { q.x = rnd(-10, cols * 0.6); q.y = rnd(hz + (rows - hz) * 0.3, rows); }
        g.set(q.x, q.y, q.y < hz ? '+' : '*', pc(s.Pseed, 0.6 + 0.4 * Math.sin(t * 3 + q.ph)));
      }
    }
  } });

/* ═════════ 10. 秋葉飄零 ═════════ */
// 遞迴長出一棵樹（存成節點清單，每格依風重新計算位置）
function growTree(nodes, parent, ang, len, depth, maxD, bend, spread) {
  const id = nodes.length;
  nodes.push({ parent, ang, len, depth, w: Math.max(1, (maxD - depth) * 0.55), ph: rnd(0, TAU) });
  if (depth >= maxD) return;
  const n = depth < 2 ? 2 : rint(2, 3);
  for (let k = 0; k < n; k++) {
    const a = (k - (n - 1) / 2) * spread * rnd(0.7, 1.3) + rnd(-0.15, 0.15) + bend;
    growTree(nodes, id, a, len * rnd(0.66, 0.8), depth + 1, maxD, bend * 0.7, spread);
  }
}
// 依目前的風算出每個節點的端點（視覺座標，y 向上為負）
function layoutTree(nodes, x0, y0, rootAng, t, wind, out) {
  for (let k = 0; k < nodes.length; k++) {
    const nd = nodes[k], sw = (Math.sin(t * 1.1 + nd.ph) * 0.02 + wind * 0.04) * nd.depth;
    let ax, ay, a;
    if (nd.parent < 0) { ax = x0; ay = y0; a = rootAng + nd.ang + sw; }
    else { const pp = out[nd.parent]; ax = pp.x1; ay = pp.y1; a = pp.a + nd.ang + sw; }
    out[k] = { x0: ax, y0: ay, x1: ax + Math.cos(a) * nd.len, y1: ay - Math.sin(a) * nd.len, a, w: nd.w, depth: nd.depth };
  }
  return out;
}
function drawTree(g, segs, aspect, col, minD) {
  for (const sg of segs) {
    if (sg.depth < (minD || 0)) continue;
    const ch = segCh(sg.x1 - sg.x0, (sg.y1 - sg.y0) / aspect);
    const w = sg.w;
    if (w > 1.5) { for (let o = -w / 2; o <= w / 2; o += 0.5) g.line(sg.x0 + o, sg.y0 / aspect, sg.x1 + o, sg.y1 / aspect, '█', col); }
    else g.line(sg.x0, sg.y0 / aspect, sg.x1, sg.y1 / aspect, w > 1 ? '█' : ch, col);
  }
}
A({ id: 'na-leaves', name: '秋葉飄零', cat: '自然', theme: 'sunset', hue: true, desc: '紅葉在枝頭與空中翻飛飄落',
  params: { kind: 'maple', n: 1, wind: 0.3, gust: 0.5, hues: [0, 12, 24, 36], branch: 1, pile: 1 },
  variants: [
    { id: 'ginkgo', name: '銀杏道', theme: 'gold', desc: '金黃銀杏葉鋪滿林蔭道', params: { kind: 'ginkgo', hues: [44, 50, 56], branch: 0, trunks: 1, n: 1.2 } },
    { id: 'gale', name: '秋風', theme: 'amber', desc: '一陣陣強風把落葉橫掃過畫面', params: { kind: 'maple', wind: 2.4, gust: 1.5, n: 2.6, branch: 0, pile: 1, edge: 1 } },
    { id: 'path', name: '林徑', theme: 'forest', desc: '樹林小徑上紛紛落葉', params: { kind: 'path', n: 1, branch: 0, hues: [20, 34, 46, 8] } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f;
    s.gy = Math.floor(rows * (p.kind === 'pond' ? 0.7 : 0.9));
    s.leaves = [];
    const n = clamp(Math.round((cols * rows / 140) * p.n), 12, 600);
    for (let k = 0; k < n; k++) s.leaves.push(this.mk(s, f, true));
    s.gH = Math.max(2, Math.round(rows * 0.08));
    s.pile = new Int16Array(cols * s.gH).fill(-1);
    s.rings = [];
    if (p.branch || p.trunks) s.br = Array.from({ length: Math.max(3, Math.round(cols / 40)) }, () => { const x = rnd(0, cols), l = rnd(0.15, 0.3) * rows; return { x, y: 0, x1: x + rnd(-0.15, 0.15) * cols, y1: l }; });
    // 一開始地上就鋪著一些落葉
    if (p.pile) for (let x = 0; x < cols; x++) { const h = Math.floor(s.gH * (0.3 + 0.6 * nz(x * 0.3, 5))); for (let r = 0; r < h; r++) s.pile[r * cols + x] = pick(p.hues); }
    if (p.trunks || p.kind === 'path') s.trunks = Array.from({ length: Math.max(4, Math.round(cols / 18)) }, (_, k) => { const side = k % 2 ? 1 : -1, d = rnd(0.1, 1); return { x: cols / 2 + side * cols * (0.12 + 0.4 * d), w: Math.max(1, cols * 0.03 * d), d }; }).sort((a, b) => a.d - b.d);
  },
  mk(s, f, first) {
    const { cols, rows, p } = f, z = Math.pow(Math.random(), 1.15);
    const l = { x: rnd(-cols * 0.1, cols * 1.1), y: first ? rnd(-rows * 0.2, rows) : rnd(-rows * 0.3, -1), z, ph: rnd(0, TAU), om: rnd(1.2, 2.6), spin: rnd(0, TAU), sv: rnd(-3, 3), hue: pick(p.hues), lit: rnd(0.62, 0.85), fl: 0 };
    if (p.kind === 'whirl') { l.a = rnd(0, TAU); l.h = first ? rnd(0, 1) : 0; l.r = rnd(0.2, 1); }
    if (p.kind === 'pond') l.fl = 0;
    if (p.wind > 1.5) { l.x = first ? l.x : rnd(-cols * 0.4, -2); l.y = first ? l.y : rnd(-rows * 0.2, rows * 0.8); }
    return l;
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), k = f.p.kind;
    s.key = f.C;
    s.Pb = pal(f, h, [[14, 8, 6], [40, 24, 16], [70, 44, 30]], 0.06, 0.22, 12);
    s.Pw = pal(f, h, [[10, 30, 50], [40, 90, 120], [150, 200, 220]], 0.1, 0.5, 16);
    s.Pg = pal(f, h, k === 'path' ? [[30, 20, 10], [80, 60, 30], [130, 100, 60]] : [[24, 14, 8], [60, 36, 20], [100, 66, 40]], 0.05, 0.25, 12);
    s.Psh = pal(f, h, [[60, 60, 30], [255, 240, 180]], 0.1, 0.3, 8);
    s.bg = { maple: [18, 10, 14], ginkgo: [20, 16, 8], whirl: [26, 16, 10], pond: [8, 14, 20], path: [10, 14, 8] }[k];
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, k = p.kind, gy = s.gy;
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.bg[0], s.bg[1], s.bg[2]);
    const gust = p.wind + p.gust * Math.max(0, nz(t * 0.15, 3.7) * 2 - 0.8);
    // 背景：樹幹（林徑會有透視光束）
    if (s.trunks) {
      if (k === 'path') {
        for (let y = Math.floor(rows * 0.55); y < rows; y++) { const q = (y - rows * 0.55) / (rows * 0.45), hw = cols * (0.03 + 0.3 * q); for (let x = Math.floor(cols / 2 - hw); x < cols / 2 + hw; x++) g.set(x, y, hash2(x, y) > 0.6 ? '.' : ' ', pc(s.Pg, 0.5 + q * 0.4)); }
        for (let x = 0; x < cols; x++) for (let y = 0; y < rows * 0.7; y++) { const b = Math.sin(x * 0.05 - y * 0.08 + 1) * Math.sin(x * 0.013 + t * 0.05); if (b > 0.75 && hash2(x, y) > 0.5) g.set(x, y, '/', pc(s.Psh, (b - 0.75) * 4)); }
      }
      for (const tr of s.trunks) for (let y = 0; y < gy + 1; y++) for (let o = 0; o < tr.w; o++) g.set(tr.x + o, y, '█', pc(s.Pb, 0.2 + tr.d * 0.5 + (o === 0 ? 0.2 : 0)));
    }
    // 頭頂的樹冠（枝條＋滿滿的葉子）
    if (s.br) {
      const bc = pc(s.Pb, 0.45), kc = 100 / cols, top = p.trunks ? 0.16 : 0.22;
      for (const br of s.br) { g.line(br.x, 0, br.x1, br.y1, '█', bc); g.line(br.x1, br.y1, br.x1 + (br.x1 - br.x) * 0.6, br.y1 * 1.3, segCh(br.x1 - br.x, br.y1 * 0.3), bc); }
      for (let y = 0; y < rows * (top + 0.12); y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
        const sx = x + Math.sin(t * 0.7 + y * 0.3) * 0.6 * (1 + gust * 0.5);
        const edge = (rows * top + rows * 0.2 * (nz(sx * kc * 1.1, 7) - 0.45) - y) / (rows * 0.06);
        const n = nz(sx * kc * 2.2, y * kc * aspect * 3.4 + 50), d = n * 1.1 + edge * 0.4 - 0.62;
        if (d < 0) continue;
        const hh = hash2(x, y);
        ch[i] = d < 0.12 ? (hh > 0.5 ? '◆' : '*') : hh > 0.55 ? '◆' : hh > 0.25 ? '█' : '*';
        co[i] = f.H(p.hues[(hh * p.hues.length) | 0], Math.min(0.7, 0.28 + d * 0.45));
      }
    }
    // 池面
    if (k === 'pond') {
      for (let y = gy; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) { const w = nz(x * 0.15 + t * 0.3, y * 1.4); if (w > 0.55) { ch[i] = w > 0.7 ? '~' : '-'; co[i] = pc(s.Pw, 0.2 + w * 0.6); } }
      for (let x = 0; x < cols; x++) g.set(x, gy - 1, '▄', pc(s.Pg, 0.6));
    } else {
      for (let y = gy; y < rows; y++) for (let x = 0; x < cols; x++) { const n = nz(x * 0.4, y * 1.3), hh = hash2(x, y); g.set(x, y, '█', hh > 0.45 ? f.H(p.hues[(hh * 7 | 0) % p.hues.length], 0.15 + n * 0.2) : pc(s.Pg, 0.3 + 0.4 * n)); }
    }
    // 落葉堆
    const gH = s.gH, pile = s.pile;
    if (p.pile) {
      for (let r = 0; r < gH; r++) for (let x = 0; x < cols; x++) { const v = pile[r * cols + x]; if (v >= 0) { const top = r === gH - 1 || pile[(r + 1) * cols + x] < 0; g.set(x, gy - r, top ? (hash2(x, r) > 0.5 ? '▄' : '◆') : '█', f.H(v, 0.32 + 0.16 * hash2(x, r + 9))); } }
      for (let e = dt * cols * 0.06; e > 0; e--) {
        if (e < 1 && Math.random() > e) break; const x = rint(0, cols - 1); for (let r = gH - 1; r >= 0; r--) if (pile[r * cols + x] >= 0) { if (r > 0 || Math.random() < 0.3) pile[r * cols + x] = -1; break; } }
    }
    // 漣漪
    for (let j = s.rings.length - 1; j >= 0; j--) {
      const r = s.rings[j];
      r.r += dt * 4 * (cols / 160); r.l -= dt;
      if (r.l <= 0) { kill(s.rings, j); continue; }
      for (let a = 0, m = Math.max(8, Math.round(r.r * 6)); a < m; a++) { const an = (a / m) * TAU, x = r.x + Math.cos(an) * r.r, y = r.y + (Math.sin(an) * r.r) / aspect * 0.5; if (y >= gy) g.set(x, y, Math.abs(Math.sin(an)) > 0.7 ? '-' : '.', pc(s.Pw, 0.3 + r.l * 0.4)); }
    }
    // 兩側被風吹彎的大樹
    if (p.edge) for (const side of [0, 1]) {
      const bx = side ? cols * 0.95 : cols * 0.05, tc = pc(s.Pb, 0.35), bend = gust * 0.06 * (1 + Math.sin(t * 1.7 + side));
      for (let y = 0; y < gy; y++) { const q = 1 - y / gy, x = bx + bend * q * q * rows * aspect * 0.6; for (let o = -1; o <= 1; o++) g.set(x + o, y, '█', tc); }
      const ccx = bx + bend * rows * aspect * 0.45, ccy = rows * 0.22, r = cols * 0.13;
      for (let y = 0; y < rows * 0.5; y++) for (let x = Math.floor(ccx - r * 1.3); x < ccx + r * 1.3; x++) {
        const dx = (x - ccx) / r, dy = (y - ccy) * aspect / r, n = nz(x * 0.4 + t * gust * 0.8, y * 0.9);
        if (dx * dx + dy * dy > 0.6 + n * 0.8) continue;
        const hh = hash2(x, y);
        g.set(x, y, hh > 0.55 ? '◆' : hh > 0.25 ? '█' : '*', f.H(p.hues[(hh * p.hues.length) | 0], 0.3 + n * 0.3));
      }
    }
    // 落葉
    const cx = cols * 0.5 + Math.sin(t * 0.2) * cols * 0.15;
    for (let j = 0; j < s.leaves.length; j++) {
      const l = s.leaves[j], sz = 0.35 + l.z * 0.9, sp = rows * (0.07 + l.z * 0.12);
      l.ph += l.om * dt; l.spin += l.sv * dt;
      if (k === 'whirl') {
        l.a += dt * (2.5 + 2 * (1 - l.h)); l.h += dt * 0.08 * (0.6 + l.z);
        const R = cols * (0.05 + 0.3 * l.h) * l.r, yb = gy - l.h * rows * 0.85;
        l.x = cx + Math.cos(l.a) * R; l.y = yb + Math.sin(l.a) * R * 0.18 / aspect;
        if (l.h > 1.05) Object.assign(l, this.mk(s, f, false), { h: 0, y: gy });
      } else if (l.fl) {
        l.x += dt * (1.5 + gust) * (cols / 160); l.fl -= dt;
        if (l.fl <= 0 || l.x > cols + 2) Object.assign(l, this.mk(s, f, false));
      } else {
        const wx = (gust * (0.6 + nz(l.y * 0.05, t * 0.3 + j) * 0.8) * cols * 0.06) * (0.5 + l.z);
        l.x += (Math.cos(l.ph) * sp * 0.8 + wx) * dt; l.y += sp * (0.45 + 0.55 * Math.abs(Math.sin(l.ph))) * dt;
        if (l.x > cols * 1.15 || l.x < -cols * 0.2) { Object.assign(l, this.mk(s, f, false)); continue; }
        if (l.y >= gy - 0.5 && l.z > 0.25) {
          if (k === 'pond') { l.fl = rnd(8, 18); l.y = gy + rnd(0, rows - gy - 1); s.rings.push({ x: l.x, y: l.y, r: 0.5, l: 1.4 }); }
          else if (p.pile) { const x = clamp(l.x | 0, 0, cols - 1); for (let r = 0; r < gH; r++) if (pile[r * cols + x] < 0) { pile[r * cols + x] = l.hue; break; } Object.assign(l, this.mk(s, f, false)); }
          else Object.assign(l, this.mk(s, f, false));
          continue;
        }
        if (l.y > rows + 1) { Object.assign(l, this.mk(s, f, false)); continue; }
      }
      // 畫葉子：遠的一個點、近的會翻轉的小葉片
      const face = Math.abs(Math.cos(l.spin)), col = f.H(l.hue, l.lit * (0.75 + 0.25 * face) * (0.7 + 0.3 * l.z));
      if (sz < 0.6) { g.set(l.x, l.y, face > 0.5 ? '*' : '.', col); continue; }
      if (sz < 0.95) { g.set(l.x, l.y, face > 0.6 ? '◆' : segCh(Math.cos(l.ph), Math.sin(l.ph) * 0.5), col); continue; }
      const len = 1 + (sz - 0.9) * 6 * (cols / 200), wid = 0.35 + face * 0.65;
      const ca = Math.cos(l.ph * 0.7), sa = Math.sin(l.ph * 0.7);
      for (let yy = Math.floor(l.y - 2); yy <= l.y + 2; yy++) for (let xx = Math.floor(l.x - len - 1); xx <= l.x + len + 1; xx++) {
        const dx = xx + 0.5 - l.x, dy = (yy + 0.5 - l.y) * aspect, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        const e = (u / len) ** 2 + (v / (len * 0.55 * wid)) ** 2;
        if (e > 1) continue;
        g.set(xx, yy, Math.abs(v) < 0.5 && e < 0.7 ? segCh(ca, sa * 0.5) : '█', Math.abs(v) < 0.5 && e < 0.7 ? f.H(l.hue, 0.35) : col);
      }
    }
  } });

/* ═════════ 11. 落櫻繽紛 ═════════ */
A({ id: 'na-sakura', name: '落櫻繽紛', cat: '自然', theme: 'sakura', hue: true, desc: '盛開的櫻花樹，花瓣隨風飄落',
  params: { kind: 'tree', n: 1, wind: 0.6 },
  variants: [
    { id: 'night', name: '夜櫻', theme: 'blood', desc: '燈籠照亮夜裡的櫻花', params: { kind: 'night', n: 0.8, wind: 0.4 } },
    { id: 'storm', name: '櫻花雨', theme: 'lavender', desc: '一陣風捲起滿天花瓣', params: { kind: 'storm', n: 9, wind: 2.2 } },
    { id: 'river', name: '河畔', theme: 'ocean', desc: '花瓣落在河面隨水流走', params: { kind: 'river', n: 1.2, wind: 0.5 } },
    { id: 'branch', name: '一枝', theme: 'paper', desc: '近看一枝櫻花與花苞', params: { kind: 'branch', n: 0.7, wind: 0.4 } },
    { id: 'plum', name: '寒梅', theme: 'ice', desc: '雪中綻放的白梅與紅梅', params: { kind: 'plum', n: 0.6, wind: 0.3 } },
    { id: 'avenue', name: '櫻花道', theme: 'neon', desc: '兩旁櫻花樹交織成粉色隧道', params: { kind: 'avenue', n: 1.6, wind: 0.5 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f, k = p.kind;
    s.gy = Math.floor(rows * (k === 'river' ? 0.58 : 0.9));
    s.nodes = []; s.segs = []; s.tips = [];
    if (k === 'tree' || k === 'night') growTree(s.nodes, -1, 0, rows * aspect * 0.2, 0, 6, 0, 0.5);
    if (k === 'plum') growTree(s.nodes, -1, 0.1, rows * aspect * 0.18, 0, 6, 0.25, 0.8);
    if (k === 'branch') growTree(s.nodes, -1, 0, cols * 0.26, 0, 5, -0.2, 0.55);
    s.petals = Array.from({ length: clamp(Math.round((cols * rows / 90) * p.n), 10, 2000) }, () => this.mk(s, f, true));
    s.pile = new Uint8Array(cols);
    s.snow = k === 'plum' ? Array.from({ length: (cols * rows / 70) | 0 }, () => ({ x: rnd(0, cols), y: rnd(0, rows), v: rnd(2, 5), ph: rnd(0, TAU) })) : [];
    s.far = Array.from({ length: Math.max(5, Math.round(cols / 14)) }, () => ({ x: rnd(0, cols), r: rnd(0.05, 0.1) * cols }));
    s.float = [];
  },
  mk(s, f, first) {
    const { cols, rows } = f, z = Math.pow(Math.random(), 1.3);
    let x = rnd(-cols * 0.1, cols), y = first ? rnd(0, rows) : rnd(-rows * 0.2, 0);
    if (!first && s.tips.length && f.p.kind !== 'storm' && f.p.kind !== 'avenue') { const tp = pick(s.tips); x = tp[0]; y = tp[1]; }
    if (f.p.kind === 'storm' && !first) { x = rnd(-cols * 0.3, -1); y = rnd(-rows * 0.2, rows * 0.9); }
    return { x, y, z, ph: rnd(0, TAU), om: rnd(1.5, 3.5), hue: rnd(-12, 8), wob: rnd(0.5, 1.5) };
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), k = f.p.kind;
    s.key = f.C;
    s.Pp = pal(f, h, k === 'plum' ? [[120, 30, 50], [230, 120, 140], [255, 240, 245]] : k === 'branch' ? [[150, 30, 80], [220, 80, 130], [245, 140, 175]] : [[120, 40, 80], [240, 140, 180], [255, 220, 236], [255, 250, 252]], 0.25, 1, 32);
    s.Pt = pal(f, h, [[16, 8, 10], [50, 28, 30], [90, 56, 52]], 0.1, 0.5, 12);
    s.Pw = pal(f, h, [[10, 30, 50], [40, 90, 130], [140, 190, 220]], 0.1, 0.5, 16);
    s.Plan = pal(f, h, [[120, 20, 10], [255, 90, 40], [255, 210, 120]], 0.4, 1, 16);
    s.Psn = pal(f, h, [[160, 170, 190], [255, 255, 255]], 0.5, 1, 8);
    s.Ph = pal(f, h, [[40, 30, 60], [110, 80, 120]], 0.05, 0.25, 8);
    s.bg = { tree: [30, 34, 64], night: [6, 4, 14], storm: [44, 30, 64], river: [26, 36, 60], branch: [236, 232, 226], plum: [20, 26, 40], avenue: [30, 20, 44] }[k];
  },
  blossom(g, f, s, x, y, r, seed) {
    const { aspect, t } = f, ry = r / aspect;
    for (let yy = Math.floor(y - ry); yy <= y + ry; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
      const dx = xx - x, dy = (yy - y) * aspect, n = nz(xx * 0.6 + seed, yy * 1.2);
      if (dx * dx + dy * dy > r * r * (0.45 + n * 0.8)) continue;
      const hh = hash2(xx, yy), lit = 0.45 + n * 0.4 + (dy < 0 ? 0.1 : -0.05);
      g.set(xx, yy, hh > 0.7 ? '@' : hh > 0.35 ? '*' : hh > 0.15 ? 'o' : '█', pc(s.Pp, lit));
    }
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, k = p.kind, gy = s.gy;
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.bg[0], s.bg[1], s.bg[2]);
    const wind = p.wind + 0.6 * Math.max(0, nz(t * 0.12, 9) * 2 - 1) * (k === 'storm' ? 2 : 1);
    s.tips.length = 0;
    // 遠山／遠樹
    if (k === 'tree' || k === 'storm' || k === 'river' || k === 'plum') {
      for (let x = 0; x < cols; x++) { const h = rows * (0.62 - 0.1 * ridge((x / cols) * 80, 3)); for (let y = Math.floor(h); y < gy; y++) g.set(x, y, '█', pc(s.Ph, 0.4 + 0.2 * (y - h) / rows)); }
    }
    if (k === 'river') {
      for (const ft of s.far) this.blossom(g, f, s, ft.x, gy - ft.r / aspect * 0.8, ft.r, ft.x);
      for (let y = gy; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) { const w = nz(x * 0.1 - t * 0.8, y * 1.6); ch[i] = w > 0.62 ? '~' : w > 0.45 ? '-' : '█'; co[i] = w > 0.45 ? pc(s.Pw, 0.5 + w * 0.5) : pc(s.Pw, 0.15 + w * 0.2); }
    }
    // 櫻花道：左右成排的樹往遠處縮小
    if (k === 'avenue') {
      const hz = rows * 0.42, cx = cols / 2;
      for (let y = Math.floor(hz); y < rows; y++) { const q = (y - hz) / (rows - hz), hw = cols * 0.02 + q * cols * 0.28; for (let x = 0; x < cols; x++) g.set(x, y, Math.abs(x - cx) < hw ? (hash2(x, y) > 0.92 ? '.' : ' ') : '█', Math.abs(x - cx) < hw ? pc(s.Pp, 0.4) : pc(s.Ph, 0.3 + q * 0.3)); }
      for (let j = 9; j >= 1; j--) {
        const z = j * 0.55, sc = 1 / z;
        for (const side of [-1, 1]) {
          const x = cx + side * cols * 0.42 * sc, base = hz + (rows - hz) * 0.9 * sc, th = rows * 0.5 * sc, r = cols * 0.2 * sc;
          for (let y = Math.floor(base - th); y < base; y++) for (let o = 0; o < Math.max(1, cols * 0.012 * sc); o++) g.set(x + o, y, '█', pc(s.Pt, 0.4));
          this.blossom(g, f, s, x - side * r * 0.4, base - th, r, j * 7 + side);
          s.tips.push([x - side * r * 0.4, base - th]);
        }
      }
    }
    // 樹
    if (s.nodes.length) {
      const bx = k === 'branch' ? -2 : cols * (k === 'plum' ? 0.42 : 0.5), by = k === 'branch' ? rows * aspect * 0.12 : gy * aspect, ang = k === 'branch' ? -0.25 : Math.PI / 2;
      layoutTree(s.nodes, bx, by, ang, t, wind * 0.5, s.segs);
      drawTree(g, s.segs, aspect, pc(s.Pt, k === 'branch' ? 0.85 : 0.45));
      const minD = k === 'plum' ? 2 : 3;
      for (const sg of s.segs) {
        if (sg.depth < minD) continue;
        const x = sg.x1, y = sg.y1 / aspect;
        s.tips.push([x, y]);
        if (k === 'plum') {
          for (let q = 0.3; q <= 1; q += 0.35) { const fx = sg.x0 + (sg.x1 - sg.x0) * q, fy = (sg.y0 + (sg.y1 - sg.y0) * q) / aspect, hh = hash2(fx | 0, fy | 0); if (hh > 0.35) { g.set(fx, fy, hh > 0.8 ? '@' : '*', hh > 0.62 ? f.H(345, 0.55) : pc(s.Psn, 0.9)); } }
        } else if (k === 'branch') {
          if (sg.depth >= 3) for (let q = 0.5; q <= 1; q += 0.5) {
            const fx = sg.x0 + (sg.x1 - sg.x0) * q, fy = (sg.y0 + (sg.y1 - sg.y0) * q) / aspect, open = hash2(sg.depth, fx | 0) > 0.3;
            if (open) { const c = pc(s.Pp, 0.55), cc = f.H(50, 0.6); g.text(fx - 2, fy - 1, ' o o', c); g.text(fx - 2, fy, 'o', c); g.set(fx, fy, '*', cc); g.text(fx + 1, fy, ' o', c); g.text(fx - 2, fy + 1, " 'o'", c); }
            else g.set(fx, fy, '●', pc(s.Pp, 0.75));
          }
        } else this.blossom(g, f, s, x, y, cols * (sg.depth >= 5 ? 0.03 : 0.024), sg.depth * 13 + (x | 0));
      }
    }
    // 夜櫻的燈籠串
    if (k === 'night') {
      const n = Math.max(5, Math.round(cols / 24));
      for (let j = 0; j <= cols; j++) { const y = rows * 0.08 + Math.sin((j / cols) * Math.PI * (n / 2)) ** 2 * rows * 0.05; g.set(j, y, '-', pc(s.Pt, 0.5)); }
      for (let j = 0; j < n; j++) {
        const x = ((j + 0.5) / n) * cols, y = rows * 0.08 + Math.sin(((j + 0.5) / n) * Math.PI * (n / 2)) ** 2 * rows * 0.05 + 1, fl = 0.75 + 0.25 * Math.sin(t * 4 + j * 1.7);
        for (let r = 0; r < 3; r++) g.text(x - 1, y + r, r === 1 ? '(█)' : r === 0 ? ' ▄ ' : ' ▀ ', pc(s.Plan, (r === 1 ? 0.9 : 0.5) * fl));
        for (let a = 0; a < 10; a++) { const gx = x + Math.cos(a) * 4, gy2 = y + 1 + Math.sin(a) * 1.6; if (hash2(gx | 0, gy2 | 0) > 0.5) dot(g, gx, gy2, '.', pc(s.Plan, 0.35 * fl)); }
      }
    }
    // 地面花毯
    if (k !== 'river' && k !== 'avenue' && k !== 'branch') {
      for (let y = gy; y < rows; y++) for (let x = 0; x < cols; x++) g.set(x, y, '█', k === 'plum' ? pc(s.Psn, 0.55 + 0.2 * nz(x * 0.4, y)) : k === 'branch' ? pc(s.Pt, 0.1) : pc(s.Ph, 0.3 + 0.2 * nz(x * 0.3, y)));
      if (k !== 'branch') for (let x = 0; x < cols; x++) { const h = s.pile[x]; for (let r = 0; r < h; r++) g.set(x, gy - r, r === h - 1 ? '▄' : '█', pc(s.Pp, 0.5 + 0.2 * hash2(x, r))); }
      for (let e = dt * cols * 0.08; e > 0; e--) { if (e < 1 && Math.random() > e) break; const x = rint(0, cols - 1); if (s.pile[x]) s.pile[x]--; }
    }
    // 雪
    for (const q of s.snow) { q.y += q.v * dt; q.x += Math.sin(t + q.ph) * dt; if (q.y > rows) { q.y = -1; q.x = rnd(0, cols); } dot(g, q.x, q.y, '·', pc(s.Psn, 0.8)); }
    // 河面花筏
    for (let j = s.float.length - 1; j >= 0; j--) { const q = s.float[j]; q.x += dt * cols * 0.03; if (q.x > cols + 1) { kill(s.float, j); continue; } g.set(q.x, q.y, ',', pc(s.Pp, 0.7)); }
    // 花瓣
    for (const q of s.petals) {
      q.ph += q.om * dt;
      const sp = rows * (0.05 + 0.08 * q.z);
      q.x += (Math.sin(q.ph) * sp * 0.9 * q.wob + wind * cols * 0.05 * (0.5 + q.z)) * dt;
      q.y += (sp * (0.5 + 0.5 * Math.abs(Math.cos(q.ph))) + (k === 'storm' ? Math.sin(q.x * 0.04 + t * 0.9) * rows * 0.12 : 0)) * dt;
      if (q.x > cols + 2 || q.y > rows) { Object.assign(q, this.mk(s, f, false)); continue; }
      if (q.y >= gy - (s.pile[clamp(q.x | 0, 0, cols - 1)] || 0) && q.z > 0.3) {
        const x = clamp(q.x | 0, 0, cols - 1);
        if (k === 'river') { if (s.float.length < 300) s.float.push({ x: q.x, y: rnd(gy, rows - 1) }); }
        else if (k !== 'avenue' && k !== 'branch' && s.pile[x] < 3) s.pile[x]++;
        Object.assign(q, this.mk(s, f, false));
        continue;
      }
      const c = Math.cos(q.ph), big = q.z > 0.8 && k === 'branch';
      const pcol = pc(s.Pp, 0.6 + q.z * 0.4);
      if (k === 'storm' && q.z > 0.75) { g.set(q.x, q.y, c > 0 ? '*' : 'o', pcol); g.set(q.x + 1, q.y, c > 0.3 ? ')' : '.', pc(s.Pp, 0.5)); continue; }
      dot(g, q.x, q.y, big ? (c > 0 ? 'o' : '0') : q.z < 0.3 ? '.' : c > 0.5 ? "'" : c > -0.2 ? '*' : ',', pcol);
    }
  } });

/* ═════════ 12. 竹林聽風 ═════════ */
A({ id: 'na-bamboo', name: '竹林聽風', cat: '自然', theme: 'forest', hue: true, desc: '層層翠竹隨風搖曳，光線穿過竹葉',
  params: { kind: 'day', n: 1, sway: 1, mist: 0.3, rays: 1, snow: 0, path: 0, ink: 0 },
  variants: [
    { id: 'moon', name: '月竹', theme: 'ice', desc: '月光從竹林縫隙灑落', params: { kind: 'moon', rays: 0, mist: 0.4 } },
    { id: 'mist', name: '霧竹', theme: 'mint', desc: '濃霧在竹林間緩緩流動', params: { kind: 'mist', rays: 0, mist: 1.4, n: 1.2 } },
    { id: 'snow', name: '雪竹', theme: 'mono', desc: '竹葉積雪，細雪無聲落下', params: { kind: 'snow', snow: 1, rays: 0, mist: 0.3, sway: 0.5 } },
    { id: 'ink', name: '墨竹', theme: 'paper', hue: false, desc: '白紙上的水墨竹子', params: { kind: 'ink', ink: 1, n: 0.45, rays: 0, mist: 0 } },
    { id: 'path', name: '竹徑', theme: 'gold', desc: '竹林間一條石板小徑', params: { kind: 'day', path: 1, rays: 1, mist: 0.4 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    const n = Math.round((cols / 5) * p.n);
    s.culms = [];
    for (let k = 0; k < n; k++) {
      const z = Math.pow(Math.random(), 0.8);
      let x = rnd(-0.02, 1.02) * cols;
      if (p.path && z > 0.25) { const side = Math.random() < 0.5 ? -1 : 1; x = cols / 2 + side * cols * rnd(0.12 + z * 0.1, 0.55); }
      const w = p.ink ? 1 + z * 3.5 : 0.8 + z * z * 5.5 * (cols / 200);
      const c = { x, z, w, ph: rnd(0, TAU), nodeH: Math.max(3, rows * (0.08 + 0.1 * z)), nodeOff: rnd(0, 10), lean: rnd(-0.04, 0.04), leaves: [] };
      const nl = p.ink ? rint(1, 3) : rint(2, 5);
      for (let j = 0; j < nl; j++) {
        const yy = rnd(0.05, 0.6) * rows, side = Math.random() < 0.5 ? -1 : 1, m = rint(3, 6);
        for (let q = 0; q < m; q++) c.leaves.push({ y: yy + rnd(-1, 2), side, len: (2 + z * 7) * rnd(0.7, 1.3) * (cols / 200) + 1, ang: side * rnd(0.15, 0.9), seed: rnd(0, 99) });
      }
      s.culms.push(c);
    }
    s.culms.sort((a, b) => a.z - b.z);
    s.fx = p.snow ? Array.from({ length: (cols * rows / 50) | 0 }, () => ({ x: rnd(0, cols), y: rnd(0, rows), v: rnd(1.5, 4), ph: rnd(0, TAU) })) : [];
    s.fly = [];
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), k = f.p.kind;
    s.key = f.C;
    const C = {
      day: { bg: [16, 30, 18], far: [90, 130, 96], near: [70, 140, 50], dark: [24, 60, 22], node: [170, 200, 110], leaf: [[30, 80, 30], [90, 170, 60], [170, 220, 120]], mist: [180, 210, 180], ray: [255, 250, 200] },
      moon: { bg: [4, 10, 18], far: [30, 50, 70], near: [40, 80, 90], dark: [8, 20, 26], node: [110, 150, 170], leaf: [[10, 30, 40], [40, 90, 100], [120, 170, 190]], mist: [60, 80, 110], ray: [200, 220, 255] },
      mist: { bg: [40, 52, 46], far: [120, 140, 128], near: [50, 100, 60], dark: [20, 46, 26], node: [150, 180, 140], leaf: [[30, 60, 36], [80, 130, 80], [150, 190, 150]], mist: [190, 205, 195], ray: [255, 255, 255] },
      snow: { bg: [24, 30, 40], far: [110, 120, 136], near: [50, 90, 60], dark: [18, 36, 24], node: [200, 210, 220], leaf: [[30, 60, 40], [70, 120, 80], [150, 190, 160]], mist: [190, 200, 215], ray: [255, 255, 255] },
      ink: { bg: [243, 239, 228], far: [160, 160, 150], near: [20, 20, 20], dark: [0, 0, 0], node: [60, 60, 60], leaf: [[20, 20, 20], [60, 60, 60], [90, 90, 90]], mist: [240, 240, 235], ray: [255, 255, 255] },
    }[k];
    s.C = C;
    s.Pl = pal(f, h, C.leaf, 0.3, 0.95, 24);
    s.Pray = pal(f, h, [C.bg, C.ray], 0.05, 0.35, 12);
    s.Pm = pal(f, h, [C.bg, C.mist], 0.05, 0.4, 16);
    s.Psn = pal(f, h, [[180, 190, 210], [255, 255, 255]], 0.6, 1, 8);
    s.Pst = pal(f, h, [[60, 70, 90], [130, 110, 80], [190, 170, 130]], 0.15, 0.5, 12);
    s.Pc = s.culms.map(c => { const tint = c.z; return pal(f, h, [mix3(C.bg, mix3(C.far, C.dark, tint), 0.4 + tint * 0.6), mix3(C.far, C.near, tint), mix3(C.far, C.node, tint)], f.p.ink ? 0.08 + tint * 0.6 : 0.12 + tint * 0.3, f.p.ink ? 0.2 + tint * 0.75 : 0.25 + tint * 0.65, 16); });
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co;
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.C.bg[0], s.C.bg[1], s.C.bg[2]);
    const gust = p.sway * (0.6 + 0.6 * nz(t * 0.2, 4.4));
    // 光束（斜射）
    if (p.rays) for (let y = 0; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
      const b = Math.sin((x + y * aspect * 0.55) * 0.045 + 1.3) * Math.sin((x + y * aspect * 0.55) * 0.013 + t * 0.07);
      if (b > 0.55 && hash2(x, y) < (b - 0.55) * 2.5) { ch[i] = '/'; co[i] = pc(s.Pray, (b - 0.55) * 2.4); }
    }
    if (p.kind === 'moon') {
      const mx = cols * 0.62, my = rows * 0.2, mr = Math.max(2, rows * aspect * 0.08);
      for (let y = Math.floor(my - mr); y <= my + mr; y++) for (let x = Math.floor(mx - mr); x <= mx + mr; x++) { const dx = x + 0.5 - mx, dy = (y + 0.5 - my) * aspect; if (dx * dx + dy * dy < mr * mr) g.set(x, y, '@', pc(s.Psn, 1)); }
    }
    if (p.path) {
      const hz = rows * 0.5;
      for (let y = Math.floor(hz); y < rows; y++) { const q = (y - hz + 1) / (rows - hz), z = 1 / q, hw = cols * (0.01 + 0.3 * q * q + 0.05 * q), slab = fract(z * 1.6); for (let x = Math.floor(cols / 2 - hw * 1.3); x < cols / 2 + hw * 1.3; x++) { const e = Math.abs(x - cols / 2) / hw + (nz(x * 0.4, y * 1.3) - 0.5) * 0.4; if (e > 1.25) continue; const stone = slab < 0.62 && e < 1; g.set(x, y, stone ? '█' : e < 1.05 ? '.' : ',', stone ? pc(s.Pst, 0.25 + q * 0.45 + nz(x * 0.7, y) * 0.15) : pc(s.Pst, 0.15)); } }
    }
    // 竹子（遠→近），中間穿插霧帶
    const nC = s.culms.length;
    let mistDone = 0;
    for (let ci = 0; ci < nC; ci++) {
      const c = s.culms[ci], P = s.Pc[ci];
      if (p.mist > 0 && !mistDone && c.z > 0.45) { this.mist(s, f); mistDone = 1; }
      const amp = (0.8 + c.z * 1.5) * gust * (cols / 160), base = rows + 2;
      const sw = Math.sin(t * (0.9 + c.z * 0.3) + c.ph) * amp + gust * amp * 0.6;
      const xAt = y => c.x + c.lean * (base - y) + sw * ((base - y) / base) ** 2;
      const hw = c.w / 2;
      for (let y = 0; y < rows; y++) {
        const xc = xAt(y), node = ((y + c.nodeOff) % c.nodeH) < 1;
        for (let x = Math.floor(xc - hw); x <= xc + hw; x++) {
          if (x < 0 || x >= cols) continue;
          const e = (x + 0.5 - xc) / Math.max(0.5, hw);
          const i = y * cols + x;
          if (c.w < 1.6) { ch[i] = node ? (p.ink ? '=' : '+') : '|'; co[i] = pc(P, node ? 0.95 : 0.6); continue; }
          if (Math.abs(e) > 1) continue;
          ch[i] = node ? (Math.abs(e) > 0.85 ? '▀' : '▄') : '█';
          co[i] = node ? pc(P, 1) : pc(P, 0.35 + 0.45 * (1 - Math.abs(e + 0.35)) + (e > -0.55 && e < -0.25 ? 0.25 : 0));
        }
      }
      // 葉叢
      for (const lf of c.leaves) {
        const x0 = xAt(lf.y) + lf.side * hw, fl = Math.sin(t * (2 + gust) + lf.seed) * 0.12 * (0.5 + gust * 0.5);
        const a = lf.ang + fl + gust * 0.12, dx = Math.cos(a) * lf.side, dy = Math.sin(Math.abs(a)) * 0.55 + 0.25;
        const L = lf.len;
        const lc = pc(s.Pl, 0.35 + c.z * 0.6), cch = segCh(dx, dy / aspect * 2);
        for (let j = 1; j <= L; j++) {
          const x = x0 + dx * j * 1.1, y = lf.y + dy * j * (j / L) * 0.9;
          g.set(x, y, p.ink && j < L * 0.6 ? '█' : cch, lc);
          if (p.snow && j < L * 0.7 && hash2(lf.seed * 10 | 0, j) > 0.4) g.set(x, y - 1, '▄', pc(s.Psn, 0.9));
        }
      }
      if (p.snow) for (let y = 0; y < rows; y++) if (((y + c.nodeOff) % c.nodeH) < 1 && c.w >= 1.6) { const xc = xAt(y); for (let x = Math.floor(xc - hw); x <= xc + hw; x++) g.set(x, y - 1, '▄', pc(s.Psn, 0.85)); }
    }
    if (p.mist > 0 && !mistDone) this.mist(s, f);
    // 風中飛舞的竹葉
    if (p.sway > 2 && s.fly.length < 120 && Math.random() < dt * 25) s.fly.push({ x: rnd(-5, cols * 0.5), y: rnd(0, rows * 0.7), vx: rnd(10, 25) * (cols / 160), vy: rnd(-2, 4), ph: rnd(0, TAU) });
    for (let j = s.fly.length - 1; j >= 0; j--) { const q = s.fly[j]; q.x += q.vx * dt; q.y += (q.vy + Math.sin(t * 4 + q.ph) * 4) * dt; q.ph += dt * 6; if (q.x > cols + 2 || q.y > rows) { kill(s.fly, j); continue; } g.set(q.x, q.y, Math.sin(q.ph) > 0 ? '-' : '~', pc(s.Pl, 0.8)); }
    for (const q of s.fx) { q.y += q.v * dt; q.x += (Math.sin(t + q.ph) + gust * 0.5) * dt; if (q.y > rows) { q.y = -1; q.x = rnd(0, cols); } dot(g, q.x, q.y, '·', pc(s.Psn, 0.85)); }
  },
  mist(s, f) {
    const { g, cols, rows, t, p } = f, ch = g.ch, co = g.co, k = 100 / cols;
    for (let y = 0; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
      const n = nz(x * k * 0.7 + t * 0.9, y * k * 3.4) * 0.7 + nz(x * k * 2 + t * 1.6, y * k * 7) * 0.3;
      const band = 0.5 + 0.5 * Math.sin(y / rows * 5 + 1.5);
      const d = (n - 0.42) * 2.2 * p.mist * (0.4 + band * 0.6);
      if (d < 0.12 || hash2(x, y) > d * 1.6) continue;
      ch[i] = d > 0.7 ? '▒' : d > 0.45 ? '░' : d > 0.25 ? ':' : '.';
      co[i] = pc(s.Pm, Math.min(1, d));
    }
  } });

/* ═════════ 13. 潮汐海岸（俯瞰） ═════════ */
A({ id: 'na-beach', name: '潮汐海岸', cat: '自然', theme: 'ocean', hue: true, desc: '俯瞰沙灘，浪花一波波湧上又退去',
  // shore 海岸線位置、seed 海岸線形狀、slope 斜向海岸、bay 弧形海灣深度
  params: { kind: 'sand', T: 9, A: 0.16, shore: 0.46, seed: 11, slope: 0, bay: 0, crest: 1, rocks: 0, steps: 0, crabs: 0, isle: 0, moon: 0, spray: 0 },
  variants: [
    { id: 'storm', name: '黑沙浪', theme: 'mono', desc: '強風把浪花吹成一道道白痕', params: { kind: 'black', T: 5.5, A: 0.2, crest: 2.2, shore: 0.6, slope: 0.4, seed: 53, spray: 1 } },
    { id: 'steps', name: '足跡', theme: 'sunset', desc: '有人沿著海灣散步留下腳印', params: { kind: 'dusk', steps: 1, T: 10, A: 0.12, shore: 0.36, bay: 0.24, seed: 71 } },
    { id: 'crabs', name: '退潮', theme: 'amber', desc: '退潮後的濕沙地，小螃蟹橫行', params: { kind: 'sand', crabs: 1, shore: 0.34, A: 0.08, T: 12 } },
    { id: 'isle', name: '小島', theme: 'mint', desc: '海浪從四面拍上圓圓的小沙洲', params: { kind: 'sand', isle: 1, T: 8, A: 0.1 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f;
    s.K = p.isle ? 180 : cols;
    s.reach = new Float32Array(s.K);
    s.rocks = [];
    if (p.rocks) for (let k = 0; k < Math.max(4, cols / 25); k++) s.rocks.push({ x: rnd(0, cols), y: rows * (p.shore + rnd(-0.05, 0.12)), r: rnd(2, 5) * (cols / 160) + 1 });
    s.prints = []; s.walk = 0;
    s.crabs = p.crabs ? Array.from({ length: Math.max(3, Math.round(cols / 40)) }, () => ({ x: rnd(0, cols), y: rnd(0.5, 0.9) * rows, d: Math.random() < 0.5 ? 1 : -1, w: rnd(0, 5) })) : [];
    s.palm = { x: cols / 2, y: rows / 2 };
    // 海岸線是固定的：先算好每格離岸距離與所屬的海岸段
    s.D0 = new Float32Array(cols * rows); s.KK = new Uint16Array(cols * rows);
    s.SY = new Float32Array(cols);
    for (let x = 0; x < cols; x++) { const u = x / cols - 0.5; s.SY[x] = rows * p.shore + rows * 0.07 * (nz(x * (100 / cols) * 0.6, p.seed) - 0.5) * 2 + u * rows * p.slope + p.bay * rows * (1 - 4 * u * u); }
    s.spray = p.spray ? Array.from({ length: Math.max(20, (cols * rows / 110) | 0) }, () => this.mkSpray(f, s, true)) : [];
    const cx = cols / 2, cy = rows / 2, R = rows * 0.24;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (p.isle) { const dx = x - cx, dy = (y - cy) * aspect, a = Math.atan2(dy, dx); s.D0[i] = (R * aspect - Math.hypot(dx, dy)) / aspect + (nz(a * 3 + 9, 4) - 0.5) * rows * 0.06; s.KK[i] = (((a / TAU) + 1) * s.K | 0) % s.K; }
      else { s.D0[i] = y - s.SY[x]; s.KK[i] = x; }
    }
  },
  mkSpray(f, s, first) {
    const { cols, rows } = f, x = rnd(-0.1, 1) * cols, sy = s.SY[clamp(x | 0, 0, cols - 1)];
    return { x, y: sy - rnd(0, rows * 0.3), l: first ? rnd(0, 1.6) : 0, L: rnd(0.8, 1.8), v: rnd(0.7, 1.3), n: rint(3, 7) };
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), k = f.p.kind;
    s.key = f.C;
    const C = {
      sand: { sea: [[6, 50, 90], [10, 120, 160], [60, 200, 210], [180, 240, 240]], foam: [[200, 230, 235], [255, 255, 255]], dry: [[200, 176, 130], [244, 226, 186]], wet: [[150, 126, 90], [186, 160, 120]], bg: [4, 40, 74] },
      tears: { sea: [[2, 8, 20], [6, 20, 40], [10, 40, 70], [30, 80, 120]], foam: [[0, 120, 200], [120, 240, 255]], dry: [[20, 20, 26], [40, 40, 48]], wet: [[12, 14, 20], [24, 26, 34]], bg: [2, 6, 14] },
      black: { sea: [[10, 16, 22], [30, 50, 60], [80, 110, 120], [170, 190, 196]], foam: [[200, 206, 210], [255, 255, 255]], dry: [[30, 30, 32], [56, 56, 58]], wet: [[16, 16, 18], [30, 30, 32]], bg: [8, 14, 20] },
      dusk: { sea: [[30, 20, 60], [80, 50, 110], [220, 110, 110], [255, 190, 150]], foam: [[255, 210, 190], [255, 245, 235]], dry: [[190, 130, 110], [236, 180, 150]], wet: [[130, 80, 80], [170, 110, 100]], bg: [24, 14, 46] },
    }[k];
    s.C = C;
    s.Ps = pal(f, h, C.sea, 0.12, 0.7, 32);
    s.Pf = pal(f, h, C.foam, 0.6, 1, 16);
    s.Pd = pal(f, h, C.dry, 0.15, 0.4, 16);
    s.Pw = pal(f, h, C.wet, 0.08, 0.22, 16);
    s.Pr = pal(f, h, [[20, 20, 24], [70, 70, 76], [130, 130, 136]], 0.1, 0.5, 16);
    s.Pg = pal(f, h, [[20, 80, 30], [60, 150, 60]], 0.2, 0.6, 8);
    s.Pc = pal(f, h, [[160, 40, 20], [240, 90, 50]], 0.5, 0.9, 8);
    s.Pmoon = pal(f, h, [[60, 80, 110], [190, 210, 230], [255, 255, 240]], 0.3, 0.95, 12);
    s.Pman = pal(f, h, [[40, 20, 30], [90, 50, 60]], 0.06, 0.2, 4);
  },
  swash(p) { return p < 0.32 ? Math.sin((p / 0.32) * Math.PI / 2) : Math.pow(Math.cos(((p - 0.32) / 0.68) * Math.PI / 2), 1.4); },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, K = s.K, tears = p.kind === 'tears';
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.C.bg[0], s.C.bg[1], s.C.bg[2]);
    const A = rows * p.A, cx = cols / 2, cy = rows / 2, R = rows * 0.24;
    // 每一段海岸的浪相位與目前浪頭位置
    const sw = s.sw || (s.sw = new Float32Array(K)), adv = s.adv || (s.adv = new Uint8Array(K));
    for (let k = 0; k < K; k++) {
      const u = p.isle ? k / K * 40 : k * (100 / cols);
      const ph = t / p.T + nz(u * 0.5, 3) * 0.9, fr = ph - Math.floor(ph);
      sw[k] = A * this.swash(fr) * (0.7 + 0.5 * nz(u * 0.6, Math.floor(ph) * 1.7));
      adv[k] = fr < 0.32 ? 1 : 0;
      if (sw[k] > s.reach[k]) s.reach[k] = sw[k]; else s.reach[k] = Math.max(sw[k], s.reach[k] - dt * A * 0.04);
    }
    const SY = s.SY, shoreY = x => SY[clamp(x | 0, 0, cols - 1)];
    const Ps = s.Ps, Pf = s.Pf, Pd = s.Pd, Pw = s.Pw, moon = p.moon, spray = p.spray, mx = cols * 0.66;
    for (let y = 0; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
      const d0 = s.D0[i], k = s.KK[i];
      const w = sw[k], dd = w - d0;
      if (dd > 0) {
        // 水裡：浪頭白沫、碎浪線、深淺
        const u = x * (100 / cols), n = nz(u * 1.2 + t * 0.3, y * (100 / cols) * aspect * 1.2 - t * 0.4);
        if (dd < 1.2 + n * 1.5 && (adv[k] || n > 0.55)) {
          ch[i] = dd < 0.6 ? '▒' : n > 0.5 ? 'o' : '°';
          // 藍眼淚：只有正在碎開的浪頭發亮，後面的泡沫暗暗的
          co[i] = tears ? (dd < 0.6 && adv[k] ? pc(Pf, 0.75 + 0.25 * Math.sin(t * 3 + x * 0.3)) : pc(Ps, 0.55 + n * 0.45)) : pc(Pf, 0.6 + n * 0.4);
          continue;
        }
        const depth = Math.max(0, -d0), cph = depth / (rows * 0.075) + t / p.T * 3 + nz(u * 0.35, 5) * 1.6, crest = cph - Math.floor(cph);
        const seg = nz(u * 0.9 + Math.floor(cph) * 3.1, 77);
        if (crest < 0.09 * p.crest && seg > 0.38 && depth < rows * 0.42) { const b = (1 - depth / (rows * 0.42)) * (seg - 0.2); ch[i] = crest < 0.045 * p.crest && b > 0.3 ? '≈' : '~'; co[i] = tears ? pc(Ps, 0.45 + b * 0.5) : pc(Pf, 0.35 + b * 0.7); continue; }
        // 月光倒影：一條閃爍的光帶從畫面頂端一路延伸到岸邊
        if (moon) {
          const wp = cols * (0.025 + 0.06 * clamp(y / SY[x], 0, 1)), dx = Math.abs(x - mx - Math.sin(y * 0.7 + t * 0.8) * 1.2) / wp;
          if (dx < 1 && hash2(x * 7 + ((t * 5) | 0), y) < 0.55 * (1 - dx) + 0.1) { ch[i] = dx < 0.35 && n > 0.5 ? '=' : n > 0.45 ? '-' : '.'; co[i] = pc(s.Pmoon, (1 - dx) * (0.5 + 0.5 * n)); continue; }
        }
        // 強風把海面吹出一條條白色泡沫紋
        if (spray) {
          const fl = 1 - Math.abs(nz(u * 0.22 - t * 0.35, y * (100 / cols) * aspect * 3.2 + u * 0.4) * 2 - 1);
          if (fl > 0.86) { ch[i] = fl > 0.94 ? '=' : '-'; co[i] = pc(Pf, 0.25 + (fl - 0.86) * 4); continue; }
        }
        const L = clamp(1 - depth / (rows * 0.36), 0, 1);
        ch[i] = n > 0.66 ? '~' : n > 0.45 ? '-' : hash2(x, y) > 0.5 ? '.' : ' ';
        co[i] = pc(Ps, 0.12 + L * 0.7 + (n - 0.5) * 0.25);
        continue;
      }
      // 陸地：濕沙／乾沙
      const wet = d0 < s.reach[k] + 0.8, g2 = nz(x * 0.6, y * 1.4);
      ch[i] = '█'; co[i] = wet ? pc(Pw, 0.3 + g2 * 0.4 + (d0 < s.reach[k] - 0.5 ? 0 : 0.2)) : pc(Pd, 0.3 + g2 * 0.5);
      if (!wet && hash2(x, y) > 0.988) co[i] = pc(Pd, 1);
    }
    // 小島上的椰子樹
    if (p.isle) {
      const tcol = pc(s.Pg, 0.6);
      for (let a = 0; a < 6; a++) { const an = a / 6 * TAU + Math.sin(t * 0.8) * 0.1; for (let j = 1; j < rows * 0.12 * aspect; j++) g.set(cx + Math.cos(an) * j, cy + Math.sin(an) * j / aspect, j % 3 ? (Math.abs(Math.cos(an)) > 0.7 ? '-' : '/') : '*', tcol); }
      g.set(cx, cy, '@', pc(s.Pr, 0.6));
    }
    // 礁石
    for (const r of s.rocks) for (let y = Math.floor(r.y - r.r / aspect); y <= r.y + r.r / aspect; y++) for (let x = Math.floor(r.x - r.r); x <= r.x + r.r; x++) {
      const dx = x + 0.5 - r.x, dy = (y + 0.5 - r.y) * aspect, n = nz(x * 0.8, y * 1.6), e = (dx * dx + dy * dy) / (r.r * r.r) - n * 0.5;
      if (e < 0.75) g.set(x, y, '█', pc(s.Pr, 0.3 + 0.5 * (1 - e) - (dx + dy) / r.r * 0.15));
      else if (e < 1.25) { const i = y * cols + x; if (x >= 0 && y >= 0 && x < cols && y < rows && ch[i] !== '█') { ch[i] = n > 0.5 ? 'o' : '°'; co[i] = pc(Pf, 0.7 + 0.3 * Math.sin(t * 2 + x)); } }
    }
    // 被強風吹上岸的浪花水沫
    for (const q of s.spray) {
      q.l += dt;
      if (q.l > q.L || q.x > cols + 8 || q.y > rows) { Object.assign(q, this.mkSpray(f, s, false)); continue; }
      q.x += q.v * dt * cols * 0.16; q.y += q.v * dt * rows * 0.05;
      const a = Math.sin((q.l / q.L) * Math.PI), c = pc(Pf, 0.3 + a * 0.5);
      for (let j = 0; j < q.n; j++) g.set(q.x - j * 1.6, q.y - j * 0.12, j === 0 ? '·' : j < q.n * 0.5 ? '-' : '.', c);
    }
    // 腳印：有人沿著沙灘走過，浪一打就消失
    if (p.steps) {
      s.walk += dt * cols * 0.025;
      if (s.walk > cols * 1.3) { s.walk = -cols * 0.1; s.prints.length = 0; }
      const stepL = Math.max(2.5, cols * 0.022);
      while (s.prints.length < Math.floor(s.walk / stepL)) {
        const n = s.prints.length, x = n * stepL;
        const y = shoreY(x) + A * 0.75 + rows * 0.05 * Math.sin(x * 0.02) + (n % 2 ? 0.8 : -0.8);
        s.prints.push({ x, y, ok: 1 });
      }
      for (const pr of s.prints) {
        if (!pr.ok) continue;
        const k = clamp(pr.x | 0, 0, cols - 1);
        if (sw[k] > pr.y - shoreY(pr.x) - 0.5) { pr.ok = 0; continue; }
        g.set(pr.x, pr.y, '0', pc(Pw, 0.2)); g.set(pr.x + 1, pr.y, 'o', pc(Pw, 0.15));
      }
      // 走在最前面的小人（腳步交替）
      const wx = s.walk, wy = shoreY(wx) + A * 0.75 + rows * 0.05 * Math.sin(wx * 0.02), st = Math.sin(t * 7) > 0, mc = pc(s.Pman, 0.8);
      g.sprite(wx - 1, wy - 3, [' @ ', '/|\\', st ? '/ \\' : ' | '], mc);
      g.set(wx + 1, wy, '.', pc(Pw, 0.25));
    }
    // 小螃蟹
    for (const c of s.crabs) {
      c.w -= dt;
      if (c.w < 0) { c.x += c.d * dt * cols * 0.03; if (Math.random() < dt * 0.4) { c.w = rnd(0.5, 3); if (Math.random() < 0.4) c.d = -c.d; } }
      if (c.x < 2 || c.x > cols - 4) c.d = c.x < 2 ? 1 : -1;
      const k = clamp(c.x | 0, 0, cols - 1);
      if (c.y - shoreY(c.x) < sw[k] + 2) c.y += dt * 3; else if (c.y > rows - 2) c.y -= dt;
      const leg = Math.sin(t * 12) > 0;
      g.text(c.x - 2, c.y, leg ? '\\(oo)/' : '/(oo)\\', pc(s.Pc, 0.8));
    }
  } });

/* ═════════ 14. 水下光影 ═════════ */
// 水底光紋：兩層「脊狀」雜訊交疊成會游動的亮線網
function caustic(u, v, t) {
  const a = 1 - Math.abs(nz(u + t * 1.3, v + t * 0.7) * 2 - 1), b = 1 - Math.abs(nz(u * 1.27 - t * 1.1 + 57, v * 1.27 + t * 0.9 + 31) * 2 - 1);
  const a2 = a * a, b2 = b * b;
  return Math.min(1, a2 * a2 * a2 * 0.75 + b2 * b2 * b2 * 0.75 + a2 * b2 * 0.4);
}
A({ id: 'na-reef', name: '水下光影', cat: '自然', theme: 'ocean', hue: true, desc: '海藻林裡光線搖曳，水底光紋流動',
  params: { kind: 'kelp', floor: 0.72, rays: 1, kelp: 1 },
  variants: [
    { id: 'caustic', name: '光紋', theme: 'cyber', desc: '俯看淺水沙底，光紋不停游動', params: { kind: 'caustic', rays: 0, kelp: 0 } },
    { id: 'pool', name: '泳池', theme: 'ice', desc: '泳池磁磚上晃動的水光', params: { kind: 'pool', rays: 0, kelp: 0 } },
    { id: 'manta', name: '鬼蝠魟', theme: 'blueprint', desc: '深藍光束中滑過的鬼蝠魟', params: { kind: 'manta', floor: 0.9, rays: 2, kelp: 0 } },
    { id: 'coral', name: '珊瑚礁', theme: 'rainbow', desc: '色彩繽紛的珊瑚與熱帶魚', params: { kind: 'coral', floor: 0.7, rays: 1, kelp: 0 } },
    { id: 'jelly', name: '水母', theme: 'neon', desc: '發光水母一縮一放地漂浮', params: { kind: 'jelly', floor: 1.1, rays: 0, kelp: 0 } },
    { id: 'school', name: '魚群', theme: 'mint', desc: '成千小魚聚成旋轉的魚球', params: { kind: 'school', floor: 0.92, rays: 1, kelp: 0 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f, k = p.kind;
    s.kelp = p.kelp ? Array.from({ length: Math.max(5, Math.round(cols / 14)) }, () => ({ x: rnd(0, cols), z: Math.random(), h: rnd(0.5, 0.95), ph: rnd(0, TAU) })).sort((a, b) => a.z - b.z) : [];
    s.bub = []; s.snow = Array.from({ length: (cols * rows / 60) | 0 }, () => ({ x: rnd(0, cols), y: rnd(0, rows), v: rnd(0.3, 1.2) }));
    s.fish = Array.from({ length: k === 'coral' ? Math.max(6, cols / 14 | 0) : k === 'kelp' ? 5 : 0 }, () => ({ x: rnd(0, cols), y: rnd(0.25, 0.65) * rows, v: rnd(3, 8) * (Math.random() < 0.5 ? 1 : -1), hue: pick([30, 50, 190, 330, 0, 280]), ph: rnd(0, TAU) }));
    // 水母：前景的大水母＋幾隻遠處的小水母（顏色較暗、游得較慢）
    if (k === 'jelly') s.jel = [...Array.from({ length: 3 }, () => this.mkJ(f, true, true)), ...Array.from({ length: Math.max(7, Math.round(cols / 20)) }, () => this.mkJ(f, true, false))];
    // 淺水光紋：游過沙底的小魚影子
    s.shad = k === 'caustic' ? Array.from({ length: Math.max(4, Math.round(cols / 32)) }, () => ({ x: rnd(0, cols), y: rnd(0, rows), a: rnd(0, TAU), v: rnd(0.7, 1.2), ph: rnd(0, TAU), sd: rnd(0, 100) })) : [];
    if (k === 'school') s.sch = Array.from({ length: clamp((cols * rows / 25) | 0, 150, 1400) }, () => ({ a: rnd(0, TAU), r: Math.sqrt(Math.random()), h: rnd(-1, 1), sp: rnd(0.8, 1.2) }));
    if (k === 'coral') {
      s.corals = [];
      for (let x = 2; x < cols; x += rint(4, Math.max(6, cols / 14))) s.corals.push({ x, kind: rint(0, 2), h: rnd(0.08, 0.22) * rows, hue: pick([0, 20, 40, 300, 330, 180, 270]), nodes: [] });
      for (const c of s.corals) if (c.kind === 0) growTree(c.nodes, -1, 0, c.h * f.aspect * 0.45, 0, 4, 0, 0.7);
    }
    s.manta = { x: cols * 0.25, y: rows * 0.42 };
  },
  mkJ(f, first, far) {
    const { cols, rows } = f, r = far ? rnd(0.018, 0.028) * cols + 1 : rnd(0.04, 0.075) * cols + 2;
    return { x: clamp(rnd(0, cols), r + 1, cols - r - 1), y: first ? rnd(0, rows) : rows + rnd(1, rows * 0.45), r, ph: rnd(0, TAU), hue: pick([300, 320, 190, 270, 30]), far, sp: (far ? 0.45 : 1) * rnd(0.75, 1.25) };
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), k = f.p.kind;
    s.key = f.C;
    const deep = { kelp: [2, 30, 46], caustic: [10, 80, 110], pool: [20, 110, 150], manta: [10, 46, 96], coral: [4, 50, 80], jelly: [2, 4, 14], school: [2, 36, 60] }[k];
    s.bg = deep;
    s.Pw = pal(f, h, [deep, [60, 170, 200], [210, 250, 255]], 0.1, 1, 32);
    s.Psand = pal(f, h, k === 'pool' ? [[40, 120, 170], [120, 200, 230], [230, 255, 255]] : [[60, 80, 70], [160, 170, 130], [250, 245, 210]], 0.15, 1, 32);
    s.Pk = pal(f, h, [[40, 70, 20], [110, 150, 40], [200, 210, 90]], 0.25, 0.75, 16);
    s.Pf = pal(f, h, [[100, 120, 130], [220, 235, 240]], 0.4, 0.9, 8);
    s.Pm = pal(f, h, [[1, 6, 18], [10, 30, 60]], 0.05, 0.2, 8);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, k = p.kind;
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.bg[0], s.bg[1], s.bg[2]);
    const kc = 100 / cols;
    // 俯看：整面光紋
    if (k === 'caustic' || k === 'pool') {
      const tile = Math.max(4, Math.round(cols / 18));
      for (let y = 0; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
        const c = caustic(x * kc * 3.4, y * kc * aspect * 3.4, t * 1.6);
        if (k === 'pool') {
          const gx = x % tile === 0, gy = y % Math.max(2, Math.round(tile / aspect)) === 0, lane = Math.abs(x - cols * 0.5) < tile * 0.3;
          ch[i] = c > 0.45 ? (c > 0.7 ? '█' : '▓') : gx || gy ? (gx && gy ? '+' : gx ? '|' : '-') : lane ? '█' : '░';
          co[i] = lane && c < 0.45 ? pc(s.Pm, 1) : pc(s.Psand, 0.25 + c * 0.75 + (gx || gy ? -0.1 : 0));
        } else {
          const rip = 0.5 + 0.5 * Math.sin(x * kc * 2.2 + nz(x * kc * 0.4, y * kc * 0.8) * 6);
          ch[i] = c > 0.6 ? '@' : c > 0.42 ? '%' : c > 0.28 ? '+' : rip > 0.7 ? '~' : '.';
          co[i] = pc(s.Psand, 0.18 + c * 0.82 + rip * 0.08);
        }
      }
      // 小魚的影子：俯看時魚身是一團暗影，尾巴左右擺動，慢慢轉向
      const Lf = Math.max(8, cols * 0.05), shc = pc(s.Psand, 0.06), shc2 = pc(s.Psand, 0.14);
      for (const q of s.shad) {
        q.a += (nz(t * 0.15, q.sd) - 0.5) * dt * 2.4;
        q.x += Math.cos(q.a) * q.v * dt * cols * 0.045; q.y += Math.sin(q.a) * q.v * dt * cols * 0.045 / aspect;
        if (q.x < -Lf) q.x += cols + Lf * 2; else if (q.x > cols + Lf) q.x -= cols + Lf * 2;
        if (q.y < -Lf / aspect) q.y += rows + Lf * 2 / aspect; else if (q.y > rows + Lf / aspect) q.y -= rows + Lf * 2 / aspect;
        const ca = Math.cos(q.a), sa = Math.sin(q.a), wig = Math.sin(t * 7 * q.v + q.ph), R = Lf * 0.9;
        for (let y = Math.floor(q.y - R / aspect); y <= q.y + R / aspect; y++) {
          if (y < 0 || y >= rows) continue;
          for (let x = Math.floor(q.x - R); x <= q.x + R; x++) {
            if (x < 0 || x >= cols) continue;
            const dx = x + 0.5 - q.x, dy = (y + 0.5 - q.y) * aspect, u = (dx * ca + dy * sa) / Lf, v0 = (-dx * sa + dy * ca) / Lf;
            const v = v0 - (u < 0 ? wig * u * u * 0.5 : 0), body = (u * u) / 0.25 + (v * v) / 0.036, tail = u < -0.4 && u > -0.72 && Math.abs(v) < (-0.4 - u) * 0.75;
            if (body > 1 && !tail) continue;
            const i = y * cols + x;
            ch[i] = body < 0.45 ? '█' : '▓'; co[i] = body < 0.45 ? shc : shc2;
          }
        }
      }
      return;
    }
    const floor = Math.floor(rows * p.floor);
    // 水面光斑
    for (let x = 0; x < cols; x++) { const w = nz(x * kc * 1.5 + t * 0.8, t * 0.3); g.set(x, 0, w > 0.6 ? '~' : '-', pc(s.Pw, 0.5 + w * 0.5)); if (w > 0.7) g.set(x, 1, '.', pc(s.Pw, 0.6)); }
    // 光束
    if (p.rays) {
      for (let y = 1; y < Math.min(rows, floor); y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
        const xr = (x - y * aspect * 0.35) * kc;
        const r = nz(xr * 0.9 + t * 0.15, 7.7) * 0.7 + nz(xr * 2.4 - t * 0.2, 3.3) * 0.3;
        const I = (r - 0.47) * 2.8 * (1 - y / rows * 0.75) * (p.rays > 1 ? 1.5 : 1);
        if (I < 0.08 || hash2(x, y) > I * 1.6) continue;
        ch[i] = I > 0.5 ? '|' : I > 0.3 ? ':' : '.'; co[i] = pc(s.Pw, 0.2 + I * 0.6);
      }
    }
    // 漂浮的海雪
    for (const q of s.snow) { q.y += q.v * dt * 0.6; q.x += Math.sin(t * 0.4 + q.y) * dt * 0.3; if (q.y > rows) { q.y = 0; q.x = rnd(0, cols); } g.set(q.x, q.y, '.', pc(s.Pw, 0.3)); }
    // 鬼蝠魟
    if (k === 'manta') {
      const m = s.manta;
      m.x += dt * cols * 0.03; m.y += Math.sin(t * 0.25) * dt * 0.6; if (m.x > cols * 1.35) { m.x = -cols * 0.35; m.y = rows * rnd(0.3, 0.6); }
      const W = cols * 0.18, flap = Math.sin(t * 1.3);
      for (let y = Math.floor(m.y - W / aspect * 0.5); y <= m.y + W / aspect * 0.5; y++) for (let x = Math.floor(m.x - W * 0.4); x <= m.x + W * 0.6; x++) {
        const u = (x - m.x) / W, v = (y - m.y) * aspect / W;
        // 翼前緣往後掠、後緣內凹，前方有兩片頭鰭
        const av = Math.abs(v), lead = 0.42 - av * 0.75, trail = -0.3 + av * 0.25 + av * av * 0.9, wing = av + flap * 0.1 * av * (u < 0 ? 2 : 1);
        const body = u < lead && u > trail && wing < 0.52, horn = u > 0.38 && u < 0.5 && av > 0.05 && av < 0.12;
        if (body || horn) g.set(x, y, '█', pc(s.Pm, 0.75 + 0.25 * (1 - av * 2)));
        else if (u < -0.3 && u > -0.85 && Math.abs(v) < 0.02 + 0.01 * Math.sin(u * 20 + t * 3)) g.set(x, y, '-', pc(s.Pm, 0.8));
      }
    }
    // 魚群（魚球）
    if (k === 'school') {
      const cx = cols * 0.5 + Math.sin(t * 0.13) * cols * 0.18, cy = rows * 0.45 + Math.sin(t * 0.21) * rows * 0.1, R = Math.min(cols * 0.22, rows * aspect * 0.3);
      for (const q of s.sch) {
        q.a += dt * 0.9 * q.sp / (0.4 + q.r);
        const r = R * (0.3 + 0.7 * q.r) * (1 + 0.15 * Math.sin(t * 0.7 + q.h * 3)), x = cx + Math.cos(q.a) * r, y = cy + (Math.sin(q.a) * r * 0.45 + q.h * R * 0.35) / aspect;
        const facing = Math.sin(q.a) > 0 ? '<' : '>', depth = 0.5 + 0.5 * Math.cos(q.a);
        g.set(x, y, depth > 0.7 ? facing : depth > 0.35 ? '-' : '.', pc(s.Pf, 0.3 + depth * 0.7));
      }
    }
    // 水母
    if (k === 'jelly') {
      for (let j = 0; j < s.jel.length; j++) {
        const q = s.jel[j], pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + q.ph);
        q.y -= dt * (0.4 + pulse * 1.6) * (rows / 40) * q.sp; q.x = clamp(q.x + Math.sin(t * 0.3 + q.ph) * dt * 0.8, q.r + 1, cols - q.r - 1);
        if (q.y < -q.r * 2) { s.jel[j] = this.mkJ(f, false, q.far); continue; }
        const dim = q.far ? 0.55 : 1;
        const rw = q.r * (0.85 + 0.2 * (1 - pulse)), rh = q.r * (0.55 + 0.25 * pulse) / aspect;
        for (let y = Math.floor(q.y - rh); y <= q.y; y++) for (let x = Math.floor(q.x - rw); x <= q.x + rw; x++) {
          const u = (x + 0.5 - q.x) / rw, v = (y + 0.5 - q.y) / rh, e = u * u + v * v;
          if (e > 1) continue;
          g.set(x, y, e > 0.72 ? '█' : e > 0.4 ? '▒' : '░', f.H(q.hue, (0.25 + 0.4 * e + 0.15 * pulse) * dim));
        }
        const nt = Math.max(3, Math.round(rw * 0.8)), L = q.r * 1.6 / aspect * 2;
        for (let tt = 0; tt < nt; tt++) {
          const bx = q.x - rw * 0.75 + (tt / (nt - 1)) * rw * 1.5;
          for (let j2 = 1; j2 < L; j2++) g.set(bx + Math.sin(j2 * 0.5 - t * 3 + tt) * (j2 / L) * 1.5, q.y + j2, j2 % 3 === 0 ? ':' : '|', f.H(q.hue, (0.45 - (j2 / L) * 0.3) * dim));
        }
      }
    }
    // 海底：沙＋光紋
    for (let y = floor; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
      const q = (y - floor) / Math.max(1, rows - floor), c = caustic(x * kc * 3.6, (y - floor) * kc * aspect * 7 + 10, t * 1.6);
      ch[i] = c > 0.55 ? '=' : c > 0.35 ? '-' : hash2(x, y) > 0.5 ? '.' : '_';
      co[i] = pc(s.Psand, 0.15 + q * 0.2 + c * 0.6);
    }
    // 珊瑚
    if (k === 'coral') for (const c of s.corals) {
      const base = floor + 1;
      if (c.kind === 0) {
        const segs = layoutTree(c.nodes, c.x, base * aspect, Math.PI / 2, t * 0.6, 0, []);
        for (const sg of segs) g.line(sg.x0, sg.y0 / aspect, sg.x1, sg.y1 / aspect, sg.depth > 2 ? 'Y' : '|', f.H(c.hue, 0.45 + sg.depth * 0.06));
      } else if (c.kind === 1) {
        const r = c.h * aspect * 0.5;
        for (let y = Math.floor(base - c.h * 0.6); y <= base; y++) for (let x = Math.floor(c.x - r); x <= c.x + r; x++) { const u = (x - c.x) / r, v = (y - base) * aspect / (c.h * aspect * 0.6); if (u * u + v * v < 1) g.set(x, y, Math.sin(u * 9 + v * 7) > 0 ? '@' : '%', f.H(c.hue, 0.4 + 0.2 * (1 - v * v))); }
      } else {
        const nt = Math.max(4, Math.round(c.h * 0.8));
        for (let tt = 0; tt < nt; tt++) { const a = (tt / nt - 0.5) * 1.6; for (let j = 0; j < c.h * 0.7; j++) { const sw = Math.sin(t * 1.5 + j * 0.3 + tt) * j * 0.08; g.set(c.x + Math.sin(a) * j * 0.8 + sw, base - j * Math.cos(a) * 0.9, j > c.h * 0.6 ? 'o' : '|', f.H(c.hue, 0.5 + j * 0.01)); } }
      }
    }
    // 海帶
    for (const kp of s.kelp) {
      const H = (rows - 2) * kp.h, base = rows - 1, kc2 = pc(s.Pk, 0.3 + kp.z * 0.6);
      for (let j = 0; j < H; j++) {
        const q = j / H, x = kp.x + Math.sin(t * 0.8 + kp.ph + j * 0.12) * q * q * 4 * (cols / 160) + Math.sin(t * 0.5) * q * 2, y = base - j;
        g.set(x, y, '|', kc2);
        if (kp.z > 0.5) g.set(x + 1, y, '|', kc2);
        if (j % 3 === 0 && j > 2) { const side = (j / 3) % 2 ? 1 : -1, L = 1 + Math.round((1 - q * 0.5) * 3 * (0.5 + kp.z)); for (let l = 1; l <= L; l++) g.set(x + side * l, y - l * 0.4 + Math.sin(t * 2 + j) * 0.3, side > 0 ? '/' : '\\', kc2); }
      }
    }
    // 熱帶魚
    for (const fi of s.fish) {
      fi.x += fi.v * dt * (cols / 160); fi.y += Math.sin(t + fi.ph) * dt * 0.5;
      if (fi.x > cols + 6) fi.x = -6; if (fi.x < -6) fi.x = cols + 6;
      const c = f.H(fi.hue, 0.6);
      g.text(fi.x, fi.y, k === 'coral' ? (fi.v > 0 ? '><(((°>' : '<°)))><') : fi.v > 0 ? '><>' : '<><', c);
    }
    // 氣泡
    if (Math.random() < dt * 4 && s.bub.length < 80) s.bub.push({ x: rnd(0, cols), y: rows - 1, v: rnd(2, 5) * (rows / 40) });
    for (let j = s.bub.length - 1; j >= 0; j--) { const b = s.bub[j]; b.y -= b.v * dt; b.x += Math.sin(t * 3 + j) * dt; if (b.y < 1) { kill(s.bub, j); continue; } g.set(b.x, b.y, b.y < rows * 0.3 ? 'O' : b.y < rows * 0.6 ? 'o' : '°', pc(s.Pw, 0.7)); }
  } });

/* ═════════ 15. 火山熔岩 ═════════ */
A({ id: 'na-volcano', name: '火山熔岩', cat: '自然', theme: 'fire', hue: true, desc: '夜裡的火山噴出熔岩，岩漿沿坡流下',
  params: { kind: 'erupt', plume: 1, fount: 1 },
  variants: [
    { id: 'lake', name: '熔岩湖', theme: 'blood', desc: '俯看熔岩湖，地殼裂縫透出紅光', params: { kind: 'lake' } },
    { id: 'river', name: '熔岩河', theme: 'sunset', desc: '近看緩緩流動的熔岩河', params: { kind: 'river' } },
    { id: 'storm', name: '火山雷', theme: 'synth', desc: '巨大火山灰雲裡閃電交錯', params: { kind: 'ash', plume: 3, fount: 0 } },
    { id: 'sea', name: '入海', theme: 'ocean', desc: '熔岩流入大海，冒出大片蒸氣', params: { kind: 'sea', plume: 0 } },
    { id: 'fissure', name: '火簾', theme: 'amber', desc: '裂縫一字排開噴出火泉', params: { kind: 'fissure', plume: 0.5 } },
    { id: 'plinian', name: '煙柱', theme: 'mono', desc: '白天高聳入天的火山灰柱', params: { kind: 'plinian', plume: 3, fount: 0 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f, k = p.kind;
    s.cx = cols * (k === 'sea' ? 0.3 : 0.5); s.top = rows * (k === 'plinian' ? 0.55 : k === 'ash' ? 0.6 : k === 'sea' ? 0.48 : 0.42);
    s.cone = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {
      const dx = Math.abs(x - s.cx) / cols, crater = dx < 0.035 ? (0.035 - dx) * rows * 0.6 : 0;
      s.cone[x] = Math.min(rows * 0.97, s.top + dx * rows * (k === 'plinian' ? 0.9 : k === 'ash' ? 1.2 : 1.5) + crater + (nz(x * 0.15, 3) - 0.5) * rows * 0.05);
    }
    // 熔岩流：從火山口往下坡隨機漫流
    s.flows = [];
    if (k === 'erupt' || k === 'sea' || k === 'ash') for (let j = 0; j < (k === 'sea' ? 4 : k === 'ash' ? 3 : 5); j++) {
      const path = [];
      let x = s.cx + rnd(-0.02, 0.02) * cols, y = s.cone[x | 0] + 0.5;
      const dir = k === 'sea' ? 1 : (j % 2 ? 1 : -1);
      const drift = k === 'sea' ? 1.1 : dir * rnd(0.1, 0.45), stopY = k === 'sea' ? rows * 0.78 : rows - 0.5;
      for (let n = 0; n < rows * 8 && y < stopY; n++) {
        x += drift + rnd(-0.6, 0.6); x = clamp(x, 0, cols - 1);
        y = Math.max(y + rnd(0.08, 0.32), s.cone[x | 0] + 0.4);
        path.push([x, y]);
      }
      s.flows.push(path);
    }
    s.pt = []; s.bolts = []; s.next = 0.8;
    // 火山雷：從灰雲底下飄落的火山灰
    s.fall = k === 'ash' ? Array.from({ length: (cols * rows / 40) | 0 }, () => this.mkAsh(f, s, true)) : [];
    s.stars = Array.from({ length: (cols * rows / 60) | 0 }, () => [rint(0, cols - 1), rint(0, rows * 0.5), rnd(0, TAU)]);
    if (k === 'lake') { s.G = Math.max(6, Math.round(cols / 12)); s.gw = Math.ceil(cols / s.G) + 2; s.gh = Math.ceil(rows * aspect / s.G) + 2; s.seeds = Array.from({ length: s.gw * s.gh }, () => [rnd(0.15, 0.85), rnd(0.15, 0.85), rnd(0, TAU)]); }
    if (k === 'fissure') s.vents = Array.from({ length: Math.max(6, Math.round(cols / 10)) }, (_, j, a) => ({ x: cols * (0.12 + 0.76 * j / Math.max(1, Math.round(cols / 10) - 1)), seed: rnd(0, 50) }));
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), k = f.p.kind;
    s.key = f.C;
    s.Pl = pal(f, h, [[40, 4, 0], [150, 20, 0], [240, 80, 0], [255, 180, 40], [255, 245, 200]], 0.15, 1, 40);
    s.Pr = pal(f, h, k === 'plinian' ? [[40, 44, 40], [80, 84, 76]] : [[10, 6, 6], [30, 20, 20]], 0.03, 0.15, 12);
    s.Pa = pal(f, h, k === 'plinian' ? [[60, 58, 56], [120, 116, 110], [200, 196, 190]] : [[24, 18, 20], [70, 50, 50], [130, 100, 90]], 0.08, 0.55, 24);
    s.Psm = pal(f, h, [[80, 90, 100], [200, 210, 220], [255, 255, 255]], 0.3, 0.95, 16);
    s.Pw = pal(f, h, [[6, 14, 30], [30, 60, 90], [120, 150, 180]], 0.08, 0.45, 16);
    s.Pb = pal(f, h, [[150, 120, 255], [255, 255, 255]], 0.6, 1, 8);
    s.Pst = pal(f, h, [[60, 50, 70], [220, 210, 230]], 0.1, 0.6, 8);
    s.bg = { erupt: [12, 4, 8], lake: [20, 2, 0], river: [16, 4, 2], sea: [10, 8, 20], fissure: [14, 6, 4], plinian: [120, 150, 180], ash: [8, 4, 8] }[k];
    s.Pash = pal(f, h, [[12, 9, 11], [40, 28, 30], [92, 50, 40], [196, 92, 42], [255, 168, 80]], 0.05, 0.62, 32);
    s.Pglow = pal(f, h, [[80, 60, 150], [180, 160, 255], [255, 255, 255]], 0.5, 1, 16);
    s.Pfall = pal(f, h, [[44, 38, 40], [110, 98, 96]], 0.1, 0.3, 8);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, k = p.kind;
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.bg[0], s.bg[1], s.bg[2]);
    const kc = 100 / cols, Pl = s.Pl;
    if (k === 'lake') return this.lake(s, f);
    if (k === 'river') return this.river(s, f);
    if (k !== 'plinian') for (const [x, y, ph] of s.stars) g.set(x, y, '.', pc(s.Pst, 0.3 + 0.3 * Math.sin(t + ph)));
    const cx = s.cx, top = s.top, glow = 0.7 + 0.3 * nz(t * 0.8, 2);
    // 火山灰柱
    if (k === 'ash') this.ashCloud(s, f);
    else if (p.plume > 0) {
      const H = top * 0.98, pw = cols * 0.035;
      for (let y = 0; y < top; y++) {
        const q = (top - y) / H, w = pw + q * q * cols * (k === 'plinian' ? 0.42 : 0.2) * Math.min(1.4, p.plume), um = k === 'plinian' && q > 0.7 ? (q - 0.7) * cols * 0.7 : 0;
        const xc = cx + Math.sin(t * 0.2 + q * 2) * q * cols * 0.03 + q * q * cols * 0.05;
        for (let x = Math.max(0, Math.floor(xc - w - um)); x < Math.min(cols, xc + w + um); x++) {
          const e = Math.abs(x - xc) / (w + um), n = nz(x * kc * 1.4, y * kc * aspect * 1.4 + t * 1.8) * 0.65 + nz(x * kc * 3.5 + t * 0.4, y * kc * aspect * 3.5 + t * 3) * 0.35;
          const d = (n - e * 0.75) * 2 - 0.1;
          if (d < 0.08) continue;
          const i = y * cols + x, lit = k === 'plinian' ? 0.35 + (nz(x * kc * 1.4 - 0.8, y * kc * aspect * 1.4 + t * 1.8 - 0.8) - n) * -4 : 0;
          const red = k === 'plinian' ? 0 : Math.max(0, 1 - q * 2.2) * glow;
          ch[i] = R10[Math.min(9, 2 + ((d * 7) | 0))];
          co[i] = red > 0.25 && hash2(x, y) < red ? pc(Pl, 0.25 + red * 0.35) : pc(s.Pa, clamp(0.3 + d * 0.4 + lit * 0.4, 0, 1));
        }
      }
    }
    // 山體
    const fis = k === 'fissure', sea = k === 'sea';
    for (let x = 0; x < cols; x++) {
      const tp = fis ? rows * 0.66 + (nz(x * kc * 0.5, 4) - 0.5) * rows * 0.06 : sea ? Math.min(s.cone[x], rows * 0.78) : s.cone[x];
      for (let y = Math.max(0, Math.floor(tp)); y < rows; y++) {
        if (sea && x > cols * 0.62 && y >= rows * 0.78) break;
        const i = y * cols + x, ty = Math.floor(tp);
        const heat = k === 'plinian' ? 0 : Math.max(0, 1 - Math.hypot(x - cx, (y - top) * aspect) / (cols * 0.25)) * 0.35 * glow;
        ch[i] = y === ty ? EIGHTH[clamp(Math.round((y + 1 - tp) * 8), 1, 8)] : '█';
        co[i] = heat > 0.08 && hash2(x, y) < heat * 2 ? pc(Pl, heat * 0.8) : pc(s.Pr, 0.3 + 0.7 * nz(x * 0.5, y * 1.2));
      }
    }
    // 海與蒸氣
    if (sea) {
      const sl = Math.floor(rows * 0.78), ex = cols * 0.64;
      for (let y = sl; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (x < cols * 0.62 + (y - sl) * 0.8) continue;
        const w = nz(x * kc * 2 + t * 0.4, y * 1.5 - t * 0.6), hot = Math.exp(-Math.abs(x - ex) / (cols * 0.04)) * (1 - (y - sl) / (rows - sl));
        ch[i] = w > 0.62 ? '~' : w > 0.4 ? '-' : '█'; co[i] = hot > 0.25 && w > 0.5 ? pc(Pl, hot * 0.7) : w > 0.4 ? pc(s.Pw, 0.5 + w * 0.5) : pc(s.Pw, 0.1);
      }
      // 蒸氣雲：從入海處翻滾上升、往右飄
      for (let y = 0; y < sl; y++) {
        const dy = (sl - y) / (rows * 0.8), xc = ex + dy * dy * cols * 0.3, w = cols * (0.09 + dy * 0.2);
        for (let x = Math.max(0, Math.floor(xc - w)); x < Math.min(cols, xc + w); x++) {
          const e = Math.abs(x - xc) / w, n = nz(x * kc * 1.3 - t * 0.6, y * kc * aspect * 1.3 + t * 1.4) * 0.7 + nz(x * kc * 3 - t, y * kc * aspect * 3 + t * 2.5) * 0.3;
          const d = n * 1.3 - e * 1.1 - dy * 0.95 + 0.25;
          if (d < 0.08) continue;
          const i = y * cols + x;
          ch[i] = R10[Math.min(9, 1 + ((d * 9) | 0))]; co[i] = dy < 0.12 && hash2(x, y) < 0.35 ? pc(Pl, 0.55) : pc(s.Psm, 0.25 + d * 0.75);
        }
      }
    }
    // 熔岩流
    for (const path of s.flows) {
      for (let n = 0; n < path.length; n++) {
        const [x, y] = path[n], fl = 0.55 + 0.45 * Math.sin(n * 0.35 - t * 3) * nz(n * 0.2, t * 0.5);
        const cool = Math.min(0.6, n / path.length * 0.7);
        g.set(x, y, fl > 0.7 ? '█' : '▓', pc(Pl, (fl - cool) * 0.9));
      }
    }
    // 裂縫火泉
    if (fis) {
      for (let x = 0; x < cols; x++) { const y = rows * 0.66 + (nz(x * kc * 0.5, 4) - 0.5) * rows * 0.06; if (x > cols * 0.1 && x < cols * 0.9) g.set(x, y, '▄', pc(Pl, 0.6 + 0.3 * nz(x * 0.3, t * 2))); }
      for (const v of s.vents) {
        const hgt = rows * (0.12 + 0.35 * nz(v.seed, t * 0.25)), y0 = rows * 0.66 + (nz(v.x * kc * 0.5, 4) - 0.5) * rows * 0.06;
        for (let e = dt * 55 * (hgt / rows) * (cols / 160); e > 0; e--) { if (e < 1 && Math.random() > e) break; s.pt.push({ x: v.x + rnd(-1, 1), y: y0, vx: rnd(-3, 3), vy: -Math.sqrt(2 * 60 * hgt) * rnd(0.7, 1), l: 0 }); }
        flameAt(g, f, Pl, v.x, y0, 1.5 + cols * 0.006, hgt * 0.35, v.seed, null);
      }
    }
    // 噴發的熔岩彈
    if (k === 'erupt' && p.fount > 0) for (let e = dt * 70 * p.fount * (cols / 160); e > 0; e--) { if (e < 1 && Math.random() > e) break; s.pt.push({ x: cx + rnd(-1.5, 1.5), y: top + 1, vx: gauss() * cols * 0.05, vy: -rnd(0.4, 1) * rows * 1.5, l: 0 }); }
    if (sea) for (let e = dt * 20; e > 0; e--) { if (e < 1 && Math.random() > e) break; s.pt.push({ x: cx + rnd(-1, 1), y: top + 1, vx: rnd(-3, 3), vy: -rnd(8, 18), l: 0 }); }
    const gk = 60;
    for (let j = s.pt.length - 1; j >= 0; j--) {
      const q = s.pt[j];
      q.l += dt; q.vy += gk * dt * (rows / 45); q.x += q.vx * dt; q.y += q.vy * dt;
      const xi = clamp(q.x | 0, 0, cols - 1), gnd = fis ? rows * 0.7 : s.cone[xi];
      if (q.y > gnd || q.y > rows || q.l > 6) { kill(s.pt, j); continue; }
      g.set(q.x, q.y, q.l < 0.5 ? '*' : q.l < 1.2 ? 'o' : '.', pc(Pl, Math.max(0.3, 1 - q.l * 0.35)));
    }
    if (s.pt.length > 2500) s.pt.splice(0, s.pt.length - 2500);
    // 火山口光暈
    if (k !== 'plinian') for (let a = 0; a < 40; a++) { const r = rnd(0, cols * 0.06), an = rnd(Math.PI, TAU); dot(g, cx + Math.cos(an) * r, top + Math.sin(an) * r / aspect, '.', pc(Pl, 0.5 * glow)); }
  },
  mkAsh(f, s, first) {
    const { cols, rows } = f;
    return { x: s.cx + rnd(-0.48, 0.48) * cols, y: first ? rnd(0.1, 0.95) * rows : rows * rnd(0.12, 0.42), v: rnd(0.5, 1.3), ph: rnd(0, TAU) };
  },
  // 火山雷：佔滿上半部的巨大灰雲，底部被火山口映紅，雲裡不時劈出閃電、照亮一小團灰
  ashCloud(s, f) {
    const { g, cols, rows, aspect, t, dt } = f, ch = g.ch, co = g.co, kc = 100 / cols, cx = s.cx, top = s.top, glow = 0.7 + 0.3 * nz(t * 0.8, 2);
    s.next -= dt;
    if (s.next <= 0) {
      s.next = rnd(1.1, 2.6);
      const segs = [], x0 = cx + rnd(-0.3, 0.3) * cols, y0 = rows * rnd(0.05, 0.26), x1 = x0 + rnd(-0.12, 0.12) * cols, y1 = Math.min(top - 2, y0 + rows * rnd(0.12, 0.26));
      boltPath(x0, y0, x1, y1, cols * 0.05, 5, segs, 0);
      for (let b = 0; b < 2; b++) { const sg = segs[rint(4, segs.length - 6)]; boltPath(sg[0], sg[1], sg[0] + rnd(-0.07, 0.07) * cols, sg[1] + rnd(0.04, 0.1) * rows, cols * 0.03, 3, segs, 1); }
      s.bolts.push({ segs, bt: 0.75, x: (x0 + x1) / 2, y: (y0 + y1) / 2, r2: (cols * 0.12) ** 2 });
    }
    for (let j = s.bolts.length - 1; j >= 0; j--) { s.bolts[j].bt -= dt; if (s.bolts[j].bt <= 0) kill(s.bolts, j); }
    const B = s.bolts, nb = B.length;
    const H = top * 0.98, pw = cols * 0.04;
    for (let y = 0; y < top; y++) {
      const q = (top - y) / H, um = q > 0.45 ? (q - 0.45) * cols * 1.1 : 0, ww = pw + Math.pow(q, 1.6) * cols * 0.34 + um;
      const red = Math.max(0, 1 - q * 1.4) * glow;
      const xc = cx + Math.sin(t * 0.17 + q * 2) * q * cols * 0.03;
      const vy = y * kc * aspect * 1.3 + t * 1.2, vy2 = y * kc * aspect * 3.4 + t * 2.4, vyb = (y + 1.2) * kc * aspect * 1.3 + t * 1.2, vya = (y - 1.2) * kc * aspect * 1.3 + t * 1.2;
      for (let x = Math.max(0, Math.floor(xc - ww)), x1 = Math.min(cols, xc + ww); x < x1; x++) {
        const e = Math.abs(x - xc) / ww, n1 = nz(x * kc * 1.3, vy), n2 = nz(x * kc * 3.4 + t * 0.3, vy2), n = n1 * 0.65 + n2 * 0.35;
        const d = (n * 0.8 + 0.4 - e) * 3;
        if (d < 0.05) continue;
        // 團塊的上緣微亮、下緣被火光映紅，看得出一球一球翻滾的灰雲
        const under = clamp((n1 - nz(x * kc * 1.3, vyb)) * 6, 0, 1), over = clamp((n1 - nz(x * kc * 1.3, vya)) * 5, 0, 1);
        let G = 0;
        for (let j = 0; j < nb; j++) { const b = B[j], dx = x - b.x, dy = (y - b.y) * aspect; G += Math.min(1, b.bt * 2.2) * Math.exp(-(dx * dx + dy * dy) / b.r2); }
        const i = y * cols + x, L = Math.min(1, d) * (0.08 + n2 * n2 * 0.4 + over * 0.22 + red * (0.15 + under * 0.7)) + G * 0.7;
        if (L < 0.06) continue;
        ch[i] = R10[Math.min(9, 1 + ((L * 9) | 0))];
        co[i] = G > 0.22 ? pc(s.Pglow, G * (0.5 + n * 0.5)) : pc(s.Pash, L * 1.1);
      }
    }
    // 飄落的火山灰
    for (const a of s.fall) {
      a.y += a.v * dt * rows / 26; a.x += (Math.sin(t * 0.7 + a.ph) * 0.8 + 0.6) * dt * cols / 100;
      const xi = clamp(a.x | 0, 0, cols - 1);
      if (a.y > s.cone[xi] || a.y >= rows || a.x >= cols) { Object.assign(a, this.mkAsh(f, s, false)); continue; }
      const i = (a.y | 0) * cols + xi;
      if (a.x >= 0 && ch[i] === ' ') { ch[i] = a.v > 1.1 ? ',' : a.v > 0.8 ? '.' : '`'; co[i] = pc(s.Pfall, 0.4 + 0.6 * (a.v - 0.5)); }
    }
    // 閃電本體
    for (const b of B) { const I = Math.min(1, b.bt * 2.4); for (const [x0, y0, x1, y1, lv] of b.segs) g.line(x0, y0, x1, y1, segCh(x1 - x0, y1 - y0), pc(s.Pb, lv ? I * 0.7 : I)); }
  },
  lake(s, f) {
    const { g, cols, rows, aspect, t } = f, ch = g.ch, co = g.co, G = s.G, gw = s.gw, gh = s.gh, seeds = s.seeds, Pl = s.Pl;
    const OX = s.OX || (s.OX = new Float32Array(seeds.length)), OY = s.OY || (s.OY = new Float32Array(seeds.length));
    for (let j = 0; j < seeds.length; j++) { const sd = seeds[j]; OX[j] = (sd[0] + Math.sin(t * 0.3 + sd[2]) * 0.12) * G; OY[j] = (sd[1] + Math.cos(t * 0.25 + sd[2]) * 0.12) * G; }
    const shift = t * 0.6 * (cols / 160);
    for (let y = 0; y < rows; y++) {
      const Y = y * aspect, gy = Math.floor(Y / G);
      for (let x = 0, i = y * cols; x < cols; x++, i++) {
        const X = x + shift, gx = Math.floor(X / G);
        let d1 = 1e9, d2 = 1e9, id = 0;
        for (let oy = -1; oy <= 1; oy++) {
          const cyg = gy + oy, row = (((cyg % gh) + gh) % gh) * gw, by = cyg * G;
          for (let ox = -1; ox <= 1; ox++) {
            const cxg = gx + ox, j = row + (((cxg % gw) + gw) % gw);
            const dx = X - cxg * G - OX[j], dy = Y - by - OY[j], d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; d1 = d; id = j; } else if (d < d2) d2 = d;
          }
        }
        const edge = Math.sqrt(d2) - Math.sqrt(d1), heat = nz(x * 0.08 + t * 0.2, y * 0.2);
        if (edge < 1.1 + heat * 1.4) { const I = 1 - edge / (2.5 + heat); ch[i] = I > 0.7 ? '█' : I > 0.45 ? '▓' : '▒'; co[i] = pc(Pl, 0.45 + I * 0.5 * (0.7 + 0.3 * Math.sin(t * 2 + id * 0.7))); }
        else { const n = nz(x * 0.4, y * 0.9); ch[i] = n > 0.66 ? '%' : n > 0.4 ? '#' : '█'; co[i] = n > 0.4 ? pc(s.Pr, 0.6 + n * 0.4) : pc(Pl, 0.08 + 0.06 * Math.sin(t + id * 0.9)); }
      }
    }
    // 冒泡噴濺
    if (Math.random() < f.dt * 3) s.pt.push({ x: rnd(0, cols), y: rnd(0, rows), r: 0, l: 1 });
    for (let j = s.pt.length - 1; j >= 0; j--) { const b = s.pt[j]; b.l -= f.dt; b.r += f.dt * 6; if (b.l <= 0) { kill(s.pt, j); continue; } for (let a = 0; a < 10; a++) { const an = a / 10 * TAU; g.set(b.x + Math.cos(an) * b.r, b.y + Math.sin(an) * b.r / aspect, '*', pc(Pl, 0.6 + b.l * 0.4)); } }
  },
  river(s, f) {
    const { g, cols, rows, aspect, t } = f, ch = g.ch, co = g.co, Pl = s.Pl, kc = 100 / cols;
    for (let x = 0; x < cols; x++) {
      const yt = rows * 0.22 + (nz(x * kc * 0.4, 5) - 0.5) * rows * 0.12, yb = rows * 0.82 + (nz(x * kc * 0.4, 8) - 0.5) * rows * 0.12;
      for (let y = 0; y < rows; y++) {
        const i = y * cols + x;
        if (y < yt || y > yb) {
          // 河岸岩石：兩種不同尺度的雜訊疊在一起，避免貼圖重複的紋路太明顯
          const dist = y < yt ? yt - y : y - yb, n = nz(x * kc * 1.5, y * kc * aspect * 2);
          const n2 = nz(x * 0.9 + 13, y * 1.9 + 7) * 0.6 + nz(x * 2.3 + 50, y * 4.1 + 90) * 0.4;
          const heat = Math.exp(-dist / (rows * 0.05)) * (0.8 + 0.2 * Math.sin(t * 2 + x * 0.1));
          ch[i] = n2 > 0.66 ? '▓' : '█';
          co[i] = heat > 0.3 && n2 > 0.35 ? pc(Pl, heat * 0.55) : pc(s.Pr, 0.25 + n * 0.75);
          continue;
        }
        // 河面：小塊的冷卻硬殼順流漂動，硬殼之間是發亮的熔岩，邊緣一圈紅光
        const q = (y - yt) / (yb - yt), sp = 1.2 - Math.abs(q - 0.5) * 1.2;
        const U = x * kc * 5.5 - t * 10 * sp, V = y * kc * aspect * 6;
        const n = nz(U + V * 0.31, V - U * 0.27), n2 = nz(U * 2.2 + 40 + V * 0.2, V * 2.2 - U * 0.3);
        const thr = 0.72 - Math.abs(q - 0.5) * 0.3, m = n - thr;
        if (m > 0) {
          if (m < 0.045) { ch[i] = '▒'; co[i] = pc(Pl, 0.6); }
          else { ch[i] = n2 > 0.6 ? '%' : '#'; co[i] = pc(s.Pr, 0.7 + n2 * 0.3); }
          continue;
        }
        const I = 0.45 + n2 * 0.55 - (m > -0.04 ? 0 : 0.08);
        ch[i] = m > -0.04 ? '█' : I > 0.62 ? '█' : n2 < 0.25 ? '≈' : '▓';
        co[i] = pc(Pl, m > -0.04 ? 0.95 : I);
      }
    }
  } });

/* ═════════ 16. 墨染清水 ═════════ */
A({ id: 'na-ink', name: '墨染清水', cat: '自然', theme: 'paper', desc: '墨滴落入清水，旋成渦環再分岔散開',
  params: { kind: 'drop', every: 6, R: 0.05, decay: 2.2 },
  variants: [
    { id: 'color', name: '彩墨', theme: 'rainbow', hue: true, desc: '彩色墨滴在暗水中交融', params: { kind: 'drop', every: 3, R: 0.045, decay: 2.2, color: 1 } },
    { id: 'rain', name: '墨雨', theme: 'mono', desc: '一陣小墨滴紛紛落下', params: { kind: 'drop', every: 0.45, R: 0.018, decay: 2.5 } },
    { id: 'smoke', name: '墨煙', theme: 'lavender', desc: '墨汁像煙一樣往上捲升', params: { kind: 'smoke', decay: 0.6 } },
    { id: 'marble', name: '墨流', theme: 'sakura', hue: true, desc: '一圈圈墨紋被新墨滴推開', params: { kind: 'marble' } },
    { id: 'vortex', name: '漩渦', theme: 'ocean', desc: '墨汁被水流捲成螺旋', params: { kind: 'vortex', decay: 0.5 } },
    { id: 'bloom', name: '暈染', theme: 'sunset', hue: true, desc: '水彩在濕紙上慢慢暈開', params: { kind: 'bloom' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.D = new Float32Array(cols * rows); s.Hh = new Float32Array(cols * rows);
    s.rings = []; s.pt = []; s.next = 0.5; s.drops = []; s.blots = []; s.cycle = 0;
    if (p.kind === 'marble') s.next = 0;
    if (p.kind === 'bloom') for (let j = 0; j < 3; j++) s.blots.push({ x: rnd(0.15, 0.85) * cols, y: rnd(0.2, 0.8) * rows, R: rnd(0.1, 0.2) * cols, r: 0, age: rnd(3, 12), hue: pick([200, 340, 20, 45, 280]), seed: rnd(0, 200) });
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), k = f.p.kind;
    s.key = f.C;
    s.Pi = pal(f, h, [[40, 40, 60], [20, 20, 30], [0, 0, 0]], 0.25, 1, 32);
    s.bg = k === 'bloom' || k === 'marble' ? [243, 238, 226] : f.p.color ? [6, 10, 18] : [230, 236, 238];
  },
  ring(f, x, y, R, vy, lvl, hue) {
    const n = Math.min(300, Math.round(40 + R * 10));
    const ps = new Float32Array(n * 3);
    for (let j = 0; j < n; j++) { ps[j * 3] = Math.random() * TAU; ps[j * 3 + 1] = Math.random() * TAU; ps[j * 3 + 2] = 0.6 + Math.random() * 0.8; }
    return { x, y, R, vy, vy0: vy, a: R * 0.3, lvl, hue, age: 0, ps, split: 0, tilt: rnd(-0.15, 0.15) };
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, D = s.D, Hh = s.Hh, n = cols * rows, k = p.kind;
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(s.bg[0], s.bg[1], s.bg[2]);
    if (k === 'marble') return this.marble(s, f);
    if (k === 'bloom') return this.bloom(s, f);
    const dec = Math.exp(-dt * p.decay);
    for (let i = 0; i < n; i++) D[i] *= dec;
    const dep = (x, y, a, hue) => { const xi = x | 0, yi = y | 0; if (xi < 0 || yi < 0 || xi >= cols || yi >= rows) return; const i = yi * cols + xi; D[i] += a; if (hue !== undefined) Hh[i] = Hh[i] * 0.85 + hue * 0.15; };
    const Sx = cols / 160;
    if (k === 'drop') {
      s.next -= dt;
      if (s.next <= 0) {
        s.next = p.every * rnd(0.7, 1.3);
        const R = Math.max(1.5, cols * p.R * rnd(0.8, 1.2));
        s.rings.push(this.ring(f, rnd(0.15, 0.85) * cols, rnd(0.02, 0.12) * rows, R, rows * rnd(0.22, 0.3), 0, rnd(0, 360)));
      }
      for (let j = s.rings.length - 1; j >= 0; j--) {
        const r = s.rings[j];
        r.age += dt; r.y += r.vy * dt; r.vy *= Math.exp(-dt * 0.55); r.R += dt * (0.4 + r.R * 0.06); r.a = r.R * 0.32;
        if (!r.split && r.vy < r.vy0 * 0.45 && r.lvl < 2) {
          r.split = 1;
          const m = rint(3, 5);
          for (let q = 0; q < m; q++) { const th = (q / m) * TAU + rnd(-0.3, 0.3); s.rings.push(this.ring(f, r.x + Math.cos(th) * r.R, r.y + Math.sin(th) * r.R * 0.3 / aspect, r.R * 0.38, r.vy0 * 0.75, r.lvl + 1, r.hue + rnd(-20, 20))); }
        }
        const life = r.lvl === 2 ? 9 : 7;
        if (r.age > life || r.y > rows + 5) { kill(s.rings, j); continue; }
        const fade = Math.min(1, r.age * 3) * Math.max(0, 1 - r.age / life) * (r.split ? 0.4 : 1), ps = r.ps, amt = 0.045 * fade / (1 + r.lvl * 0.2);
        // 渦環邊走邊甩出墨絲（自由粒子），慢慢擴散成尾巴
        for (let e = dt * (25 + r.R * 3) * fade; e > 0; e--) { if (e < 1 && Math.random() > e) break; if (s.pt.length > 4000) break; const th = Math.random() * TAU; s.pt.push({ x: r.x + Math.cos(th) * r.R, y: r.y + Math.sin(th) * r.R * 0.3 / aspect, age: 0, life: rnd(5, 10), hue: r.hue, vy: r.vy * 0.15 }); }
        for (let q = 0; q < ps.length; q += 3) {
          ps[q + 1] += dt * 2.2 * ps[q + 2];
          const rr = r.R + Math.cos(ps[q + 1]) * r.a, th = ps[q] + Math.sin(t * 0.3 + q) * 0.02;
          dep(r.x + Math.cos(th) * rr, r.y + (Math.sin(th) * rr * 0.3 + Math.sin(ps[q + 1]) * r.a + Math.cos(th) * rr * r.tilt) / aspect, amt, r.hue);
        }
      }
      for (let j = s.pt.length - 1; j >= 0; j--) {
        const q = s.pt[j];
        q.age += dt;
        if (q.age > q.life || q.y > rows + 2) { kill(s.pt, j); continue; }
        curl(q.x, q.y * aspect, 0.3 / Sx, t * 0.2, CV);
        q.x += CV[0] * 1.2 * Sx * dt; q.y += (q.vy + CV[1] * 1.2 * Sx / aspect) * dt; q.vy *= Math.exp(-dt * 0.8);
        dep(q.x, q.y, 0.028 * (1 - q.age / q.life), q.hue);
      }
    } else if (k === 'smoke' || k === 'vortex') {
      const cx = cols / 2, cy = rows / 2;
      const rate = k === 'smoke' ? 110 : 160;
      for (let e = rate * dt * Sx; e > 0; e--) {
        if (e < 1 && Math.random() > e) break;
        if (k === 'smoke') s.pt.push({ x: cx + gauss() * 1.5 * Sx, y: rows + 0.5, age: 0, life: rnd(6, 10) });
        else { const a = Math.random() < 0.5 ? 0.3 : 0.3 + Math.PI; s.pt.push({ x: cx + Math.cos(a) * cols * 0.4 + gauss(), y: cy + Math.sin(a) * rows * 0.4 + gauss() * 0.4, age: 0, life: rnd(14, 22) }); }
      }
      for (let j = s.pt.length - 1; j >= 0; j--) {
        const q = s.pt[j];
        q.age += dt;
        if (q.age > q.life || q.y < -2 || q.x < -3 || q.x > cols + 3) { kill(s.pt, j); continue; }
        let vx, vy;
        if (k === 'smoke') {
          curl(q.x, q.y * aspect, 0.26 / Sx, t * 0.35, CV);
          const h = Math.min(1.5, (rows - q.y) / (rows * 0.2)), c0 = CV[0], c1 = CV[1];
          curl(q.x + 50, q.y * aspect, 0.7 / Sx, t * 0.6, CV);
          vx = (c0 + CV[0] * 0.5) * h * 2.4 * Sx + gauss() * h * 10 * Sx; vy = -rows * 0.1 + (c1 + CV[1] * 0.5) * h * 2.4 * Sx / aspect;
        } else {
          const dx = q.x - cx, dy = (q.y - cy) * aspect, r = Math.hypot(dx, dy) + 2, w = 0.28 * Math.sqrt(cols * 0.4 / r) * r;
          curl(q.x, q.y * aspect, 0.3 / Sx, t * 0.2, CV);
          vx = -dy / r * w - dx / r * 5 * Sx + CV[0] * 1.2 * Sx + gauss() * 4 * Sx; vy = (dx / r * w - dy / r * 5 * Sx) / aspect + CV[1] * 1.2 * Sx / aspect;
        }
        q.x += vx * dt; q.y += vy * dt;
        dep(q.x, q.y, (k === 'smoke' ? 0.06 : 0.035) * dt * 30 * (1 - q.age / q.life));
      }
    }
    // 繪製濃度
    const Pi = s.Pi, color = p.color;
    for (let i = 0; i < n; i++) {
      const d = D[i];
      if (d < 0.05) continue;
      const v = Math.min(1, d * 0.8);
      ch[i] = v > 0.88 ? '@' : v > 0.7 ? '%' : v > 0.52 ? '#' : v > 0.38 ? '*' : v > 0.26 ? '+' : v > 0.16 ? '~' : v > 0.09 ? ':' : '.';
      co[i] = color ? f.H(Hh[i], 0.3 + v * 0.55) : pc(Pi, 0.15 + v * 0.85);
    }
  },
  // 墨流（墨流し）：每滴新墨把舊的紋路往外推（反推每格回到滴下前的位置）
  marble(s, f) {
    const { g, cols, rows, aspect, t, dt } = f, ch = g.ch, co = g.co, hue = s.hue;
    s.cycle += dt;
    if (s.cycle > 70) { s.cycle = 0; s.drops.length = 0; s.next = 0; s.src = null; }
    s.next -= dt;
    if (!s.src || s.cycle === 0) s.src = [[rnd(0.25, 0.45), rnd(0.3, 0.7)], [rnd(0.55, 0.78), rnd(0.3, 0.7)], [rnd(0.4, 0.6), rnd(0.2, 0.8)]];
    if (s.next <= 0 && s.drops.length < 24) {
      s.next = rnd(1.2, 2.2);
      const n = s.drops.length, sc = s.src[n % 3], ink = Math.floor(n / 3) % 2 === 0;
      s.drops.push({ x: sc[0] * cols + rnd(-1, 1), y: sc[1] * rows * aspect + rnd(-1, 1), r: 0, R: rnd(0.045, 0.075) * cols, c: ink ? (Math.floor(n / 6) + n) % 3 : 3 });
    }
    for (const d of s.drops) d.r = Math.min(d.R, d.r + dt * d.R * 1.2);
    const fade = Math.min(1, (70 - s.cycle) / 3, s.cycle * 2), sw = 0.06 * Math.sin(t * 0.07);
    const inks = hue ? [rgb(30, 50, 110), rgb(190, 50, 70), rgb(24, 24, 30)] : [f.C(0.85), f.C(0.5), f.C(1)];
    const nd = s.drops.length;
    for (let y = 0; y < rows; y++) for (let x = 0, i = y * cols; x < cols; x++, i++) {
      // 先反推一個緩慢的整體旋轉／梳理
      let px = x + Math.sin(y * aspect * 0.04 + t * 0.05) * cols * 0.02 * Math.sin(t * 0.03), py = y * aspect;
      const ccx = cols / 2, ccy = rows * aspect / 2, rx = px - ccx, ry = py - ccy;
      px = ccx + rx * Math.cos(sw) - ry * Math.sin(sw); py = ccy + rx * Math.sin(sw) + ry * Math.cos(sw);
      let hit = -1;
      for (let j = nd - 1; j >= 0; j--) {
        const d = s.drops[j], dx = px - d.x, dy = py - d.y, r2 = dx * dx + dy * dy, rr = d.r * d.r;
        if (r2 < rr) { hit = j; break; }
        const k2 = Math.sqrt(1 - rr / r2);
        px = d.x + dx * k2; py = d.y + dy * k2;
      }
      if (hit < 0 || fade <= 0) continue;
      const d = s.drops[hit];
      if (d.c === 3) continue;
      if (fade < 1 && hash2(x, y) > fade) continue;
      const dd = Math.hypot(px - d.x, py - d.y) / Math.max(0.5, d.r);
      ch[i] = dd > 0.85 ? '█' : '▓'; co[i] = inks[d.c];
    }
  },
  // 暈染：水彩在濕紙上擴散，邊緣顏色較深
  bloom(s, f) {
    const { g, cols, rows, aspect, t, dt } = f, ch = g.ch, co = g.co, hue = s.hue;
    s.next -= dt;
    if (s.next <= 0 && s.blots.length < 6) { s.next = rnd(2, 4); s.blots.push({ x: rnd(0.1, 0.9) * cols, y: rnd(0.15, 0.85) * rows, R: rnd(0.08, 0.2) * cols, r: 0, age: 0, hue: pick([200, 220, 340, 20, 45, 280, 160]), seed: rnd(0, 200) }); }
    for (let j = s.blots.length - 1; j >= 0; j--) {
      const b = s.blots[j];
      b.age += dt; b.r = b.R * (1 - Math.exp(-b.age * 0.35));
      const life = 26, fade = Math.min(1, (life - b.age) / 5);
      if (b.age > life) { kill(s.blots, j); continue; }
      const ry = (b.r * 1.35) / aspect;
      for (let y = Math.max(0, Math.floor(b.y - ry)); y < Math.min(rows, b.y + ry); y++) for (let x = Math.max(0, Math.floor(b.x - b.r * 1.35)); x < Math.min(cols, b.x + b.r * 1.35); x++) {
        const dx = x - b.x, dy = (y - b.y) * aspect, dist = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const edge = b.r * (1 + 0.3 * (nz(a * 7 + b.seed, b.seed) - 0.5) * 2 + 0.12 * (nz(a * 26 + b.seed, b.seed + 5) - 0.5) * 2);
        const q = dist / edge;
        if (q > 1) continue;
        const ring = Math.pow(q, 6) * 0.6, I = (0.25 + ring + 0.15 * nz(x * 0.3, y * 0.6 + b.seed)) * fade;
        if (fade < 1 && hash2(x, y) > fade) continue;
        const i = y * cols + x;
        ch[i] = I > 0.7 ? '█' : I > 0.45 ? '▓' : I > 0.3 ? '▒' : '░';
        co[i] = hue ? f.H(b.hue, 0.62 - Math.min(0.4, I * 0.45)) : f.C(0.25 + I * 0.7);
      }
    }
  } });


})();
