// 太空主題（sp- 開頭）。整個檔案包在函式裡，輔助常數和函式不會和其他模組撞名。
(() => {
/* ───────── 共用工具 ───────── */
// 可無縫平鋪的 256×256 碎形雜訊貼圖（數值 0–1、分布已拉平），取樣比 Noise.n3 快很多
const TN = 256;
let TX = null;
function tex() {
  if (TX) return TX;
  const T = new Float32Array(TN * TN);
  let seed = 7331;
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
    amp *= 0.5;
  }
  const idx = new Uint32Array(T.length);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  const sorted = Array.from(idx).sort((a, b) => T[a] - T[b]);
  const out = new Float32Array(T.length);
  for (let k = 0; k < sorted.length; k++) out[sorted[k]] = k / (sorted.length - 1);
  return (TX = out);
}
// 雙線性取樣（座標以貼圖像素為單位，自動循環；x 方向 256 一圈，可用來包住經度）
function nz(x, y) {
  const T = TX, xf = Math.floor(x), yf = Math.floor(y), fx = x - xf, fy = y - yf;
  const x0 = xf & 255, x1 = (xf + 1) & 255, y0 = (yf & 255) << 8, y1 = ((yf + 1) & 255) << 8;
  const a = T[y0 + x0], b = T[y0 + x1], c = T[y1 + x0], d = T[y1 + x1];
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}
// 脊狀雜訊（細絲）
const rz = (x, y) => 1 - Math.abs(nz(x, y) * 2 - 1);
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
const smooth = v => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const kill = (arr, k) => { arr[k] = arr[arr.length - 1]; arr.pop(); };
const R10 = ' .:-=+*#%@';
const rc = (str, v) => str[v <= 0 ? 0 : v >= 1 ? str.length - 1 : (v * (str.length - 1) + 0.5) | 0];
// 依線段方向挑字（dy 以列為單位，畫面上的角度會乘上字格高寬比）
const slopeCh = (dx, dy, asp) => '-\\|/'[(((Math.atan2(dy * asp, dx) / Math.PI) * 4 + 8.5) | 0) % 4];
// 兩色混合的一組調色盤：回傳 steps+1 條，第 k 條是 cA→cB 混 k/steps 的顏色，由暗（×a）到亮（×b）
function mixPal(f, hue, cA, cB, steps, a, b, lo, hi) {
  const out = [];
  for (let k = 0; k <= steps; k++) { const c = mixc(cA, cB, k / steps); out.push(pal(f, hue, [[c[0] * a, c[1] * a, c[2] * a], [c[0] * b, c[1] * b, c[2] * b]], lo, hi, 32)); }
  return out;
}
const mp = (P, w, v) => { const n = P.length - 1, P2 = P[w <= 0 ? 0 : w >= 1 ? n : (w * n + 0.5) | 0]; return P2[v <= 0 ? 0 : v >= 1 ? 31 : (v * 31 + 0.5) | 0]; };
// 把 [r,g,b] 乘上亮度後轉成顏色（shd／mixShd 直接吃數字，逐格迴圈裡不用建立陣列）
const shade = (c, k) => rgb(c[0] * k, c[1] * k, c[2] * k);
const shd = (r, g, b, k) => rgb(r * k, g * k, b * k);
const mixShd = (r1, g1, b1, r2, g2, b2, t, k) => rgb((r1 + (r2 - r1) * t) * k, (g1 + (g2 - g1) * t) * k, (b1 + (b2 - b1) * t) * k);
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// 文字（先清掉底下的格子，全形字的右半格才不會被蓋住）
function txt(g, x, y, s, col) {
  x = Math.floor(x); y = Math.floor(y);
  if (y < 0 || y >= g.rows) return;
  const w = g.textW(s);
  for (let k = 0; k < w; k++) if (x + k >= 0 && x + k < g.cols) g.ch[y * g.cols + x + k] = ' ';
  g.text(x, y, s, col);
}
// 置中文字
const ctext = (g, x, y, s, col) => txt(g, Math.round(x - g.textW(s) / 2), y, s, col);
// 介面語言：f.lang === 'en' 時畫英文，其他（含舊版沒有 f.lang）一律畫中文
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
// 一次寫出整批標籤 [x, y, 字串, 顏色, ...]；和先寫的標籤重疊的就略過，字才不會互相蓋掉一半
function flushLabels(g, labs, st) {
  const cols = g.cols, rows = g.rows, n = cols * rows;
  if (!st.lbm || st.lbm.length !== n) st.lbm = new Uint8Array(n); else st.lbm.fill(0);
  const M = st.lbm;
  for (let j = 0; j < labs.length; j += 4) {
    const str = labs[j + 2];
    if (!str) continue;
    const x = Math.floor(labs[j]), y = Math.floor(labs[j + 1]);
    if (y < 0 || y >= rows) continue;
    const w = g.textW(str);
    let ok = true;
    for (let k = -1; k <= w && ok; k++) { const xx = x + k; if (xx >= 0 && xx < cols && M[y * cols + xx]) ok = false; }
    if (!ok) continue;
    for (let k = 0; k < w; k++) { const xx = x + k; if (xx >= 0 && xx < cols) M[y * cols + xx] = 1; }
    txt(g, x, y, str, labs[j + 3]);
  }
}
// 這一格是不是全形字的右半格（看起來是空格，其實被左邊的字占著）
const wideL = (ch, i, x) => { if (x <= 0) return false; const k = ch[i - 1].charCodeAt(0); return k >= 0x2e80 && k < 0xff61; };
// '#rrggbb' → [r,g,b]（有快取）；兩個顏色字串混合
const HXC = new Map();
function hexRGB(c) {
  let v = HXC.get(c);
  if (!v) { const n = parseInt(c.slice(1), 16) || 0; v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; if (HXC.size > 40000) HXC.clear(); HXC.set(c, v); }
  return v;
}
function mixHex(a, b, t) {
  t = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const A0 = hexRGB(a), B0 = hexRGB(b);
  return rgb(A0[0] + (B0[0] - A0[0]) * t, A0[1] + (B0[1] - A0[1]) * t, A0[2] + (B0[2] - A0[2]) * t);
}
// 疊加：把 b 以 t 的強度加亮到 a 上（用在 █ 色塊內的發光物）
function addHex(a, b, t) {
  t = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const A0 = hexRGB(a), B0 = hexRGB(b);
  return rgb(Math.max(A0[0], A0[0] * (1 - t) + B0[0] * t), Math.max(A0[1], A0[1] * (1 - t) + B0[1] * t), Math.max(A0[2], A0[2] * (1 - t) + B0[2] * t));
}
// 背景星星：座標存成 0–1，[x, y, 相位, 亮度]
function mkStars(n) {
  const S = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) { S[k * 4] = Math.random(); S[k * 4 + 1] = Math.random(); S[k * 4 + 2] = rnd(0, TAU); S[k * 4 + 3] = Math.pow(Math.random(), 2.4); }
  return S;
}
const STAR_STOPS = [[40, 46, 80], [120, 130, 175], [210, 218, 255], [255, 255, 255]];
// 英文標籤的字距：左右都有字、而且至少一邊是英文字母或數字的空格（中文標籤沒有字距，不用管）
const isAlnum = c => { const k = c.charCodeAt(0); return (k >= 48 && k <= 57) || (k >= 65 && k <= 90) || (k >= 97 && k <= 122); };
const lblGap = (ch, i, xi, cols) => xi > 0 && xi < cols - 1 && ch[i - 1] !== ' ' && ch[i + 1] !== ' ' && (isAlnum(ch[i - 1]) || isAlnum(ch[i + 1]));
// 畫星星（只畫在空格上）。ox/oy：整片星空的位移（格），dim：整體亮度
// 英文模式不把星星畫進標籤的字距（例如 Waxing Crescent 中間），中文模式照舊
function drawStars(f, S, P, ox, oy, dim) {
  const { g, cols, rows, t } = f, ch = g.ch, co = g.co, en = f.lang === 'en';
  ox = ox || 0; oy = oy || 0; dim = dim === undefined ? 1 : dim;
  for (let j = 0; j < S.length; j += 4) {
    let x = (S[j] * cols + ox) % cols, y = (S[j + 1] * rows + oy) % rows;
    if (x < 0) x += cols;
    if (y < 0) y += rows;
    const xi = x | 0, i = (y | 0) * cols + xi;
    if (ch[i] !== ' ' || wideL(ch, i, xi) || (en && lblGap(ch, i, xi, cols))) continue;
    const b = S[j + 3], ph = S[j + 2];
    const tw = b * (0.7 + 0.3 * Math.sin(t * (0.8 + ph * 0.4) + ph * 7)) * dim;
    if (tw < 0.02) continue;
    ch[i] = b > 0.82 ? '*' : b > 0.5 ? '+' : b > 0.2 ? '·' : '.';
    co[i] = pc(P, 0.12 + tw * 0.88);
  }
}
// 點字（2×4 點）字元快取
const BRL = [];
for (let k = 0; k < 256; k++) BRL.push(String.fromCharCode(0x2800 + k));
const BRL_BIT = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];
// 太陽／恆星色（溫度 0 冷紅 → 1 熱藍白）
const STAR_T = [[255, 120, 70], [255, 190, 120], [255, 240, 210], [220, 230, 255], [160, 190, 255]];
function starRGB(temp) {
  const u = clamp(temp, 0, 1) * 4, i = Math.min(3, Math.floor(u));
  return mixc(STAR_T[i], STAR_T[i + 1], u - i);
}
// 同上，直接回傳乘上亮度 k 的顏色字串（不配置陣列）
function starShd(temp, k) {
  const u = clamp(temp, 0, 1) * 4, i = Math.min(3, Math.floor(u)), A0 = STAR_T[i], B0 = STAR_T[i + 1], fr = u - i;
  return rgb((A0[0] + (B0[0] - A0[0]) * fr) * k, (A0[1] + (B0[1] - A0[1]) * fr) * k, (A0[2] + (B0[2] - A0[2]) * fr) * k);
}
// 小球（行星、衛星）：中心 (x,y) 以格為單位、半徑 r 以欄寬為單位；(lx,ly,lz) 指向光源（畫面座標，y 向下）
// c 是真彩 [r,g,b]；非真彩時用主題亮度。回傳是否有畫到。
function ball(f, hue, x, y, r, lx, ly, lz, c, amb, chars) {
  const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co;
  chars = chars || '.:-=+*#%@';
  amb = amb === undefined ? 0.06 : amb;
  const nC = chars.length - 1;
  const col = v => (hue ? shade(c, 0.2 + 0.85 * v) : f.C(0.12 + 0.88 * v));
  const xi = Math.floor(x), yi = Math.floor(y);
  if (r < 0.9) {
    if (xi < 0 || yi < 0 || xi >= cols || yi >= rows) return false;
    const v = clamp(amb + Math.max(0, lz * 0.6 + 0.4), 0, 1);
    ch[yi * cols + xi] = r < 0.5 ? '·' : 'o'; co[yi * cols + xi] = col(Math.max(0.5, v));
    return true;
  }
  const ry = r / aspect;
  const y0 = Math.max(0, Math.floor(y - ry)), y1 = Math.min(rows - 1, Math.floor(y + ry));
  const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(cols - 1, Math.floor(x + r));
  let any = false;
  for (let yy = y0; yy <= y1; yy++) {
    const v = ((yy + 0.5 - y) * aspect) / r;
    for (let xx = x0; xx <= x1; xx++) {
      const u = (xx + 0.5 - x) / r, d2 = u * u + v * v;
      if (d2 > 1) continue;
      const w = Math.sqrt(1 - d2);
      const l = clamp(amb + Math.max(0, u * lx + v * ly + w * lz) * (1 - amb), 0, 1);
      const i = yy * cols + xx;
      ch[i] = chars[Math.max(0, Math.min(nC, (l * nC + 0.5) | 0))]; co[i] = col(l);
      if (ch[i] === ' ') ch[i] = '.';
      any = true;
    }
  }
  if (!any && xi >= 0 && yi >= 0 && xi < cols && yi < rows) { ch[yi * cols + xi] = 'O'; co[yi * cols + xi] = col(0.8); any = true; }
  return any;
}
// 發光的恆星圓盤＋光暈＋放射光芒。P 為 0–1 調色盤
function sunGlow(f, x, y, R, P, rays, halo) {
  const { g, cols, rows, aspect, t } = f, ch = g.ch, co = g.co;
  halo = halo || 2.6;
  const ext = R * halo, ry = ext / aspect;
  const y0 = Math.max(0, Math.floor(y - ry)), y1 = Math.min(rows - 1, Math.floor(y + ry));
  const x0 = Math.max(0, Math.floor(x - ext)), x1 = Math.min(cols - 1, Math.floor(x + ext));
  for (let yy = y0; yy <= y1; yy++) {
    const dy = (yy + 0.5 - y) * aspect;
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx + 0.5 - x, d = Math.sqrt(dx * dx + dy * dy) / R, i = yy * cols + xx;
      if (d < 1) {
        const limb = Math.sqrt(1 - d * d), gr = nz(dx * 0.9 + t * 3, dy * 0.9 + 40);
        ch[i] = gr > 0.72 ? '%' : limb > 0.5 ? '@' : '#';
        co[i] = pc(P, 0.72 + 0.28 * limb - (gr > 0.72 ? 0.1 : 0));
        continue;
      }
      if (d > halo || ch[i] !== ' ') continue;
      const a = Math.atan2(dy, dx);
      let gl = 0.9 / (d * d * d) ;
      if (rays) gl *= 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(a * rays + t * 0.4)), 3) + 0.3 * nz(a * 40.7, t * 2);
      gl *= 1 - smooth((d - halo * 0.7) / (halo * 0.3));
      if (gl < 0.08) continue;
      ch[i] = rc(' .:-=+*', gl * 1.15);
      co[i] = pc(P, 0.18 + gl * 0.6);
    }
  }
}
// 在累積陣列上畫線（每格 +1）
function accLine(buf, cols, rows, x0, y0, x1, y1, add) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
  let last = -1;
  for (let k = 0; k <= n; k++) {
    const x = Math.floor(x0 + ((x1 - x0) * k) / n), y = Math.floor(y0 + ((y1 - y0) * k) / n);
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const i = y * cols + x;
    if (i === last) continue;
    last = i; buf[i] += add;
  }
}
// 解克卜勒方程 M = E - e sinE
function keplerE(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

/* ═════════ 1. 行星軌道 ═════════ */
const PLAN = [
  { n: '水星', en: 'Mercury', r: 0.55, c: [190, 176, 160], au: 0.387 },
  { n: '金星', en: 'Venus', r: 0.9, c: [240, 210, 150], au: 0.723 },
  { n: '地球', en: 'Earth', r: 1, c: [90, 150, 245], au: 1, moon: 1 },
  { n: '火星', en: 'Mars', r: 0.72, c: [232, 112, 70], au: 1.524 },
  { n: '木星', en: 'Jupiter', r: 2.1, c: [226, 190, 150], au: 5.2 },
  { n: '土星', en: 'Saturn', r: 1.75, c: [236, 214, 160], au: 9.54, ring: 1 },
  { n: '天王星', en: 'Uranus', r: 1.25, c: [160, 226, 236], au: 19.2 },
  { n: '海王星', en: 'Neptune', r: 1.2, c: [96, 128, 250], au: 30.1 },
];
const JMOON = [
  { n: '木衛一', en: 'Io', r: 0.85, c: [236, 206, 96] },
  { n: '木衛二', en: 'Europa', r: 0.75, c: [226, 214, 196] },
  { n: '木衛三', en: 'Ganymede', r: 1.15, c: [176, 166, 156] },
  { n: '木衛四', en: 'Callisto', r: 1.05, c: [128, 116, 104] },
];
// 天體名稱（依介面語言）
const bodyName = (f, d) => tr(f, d.n, d.en);
A({ id: 'sp-orrery', name: '行星軌道', cat: '太空', theme: 'gold', hue: true, desc: '八大行星沿傾斜軌道繞日公轉',
  params: { mode: 'sys', tilt: 0.55, belt: 0, center: 'sun', spd: 1 },
  variants: [
    { id: 'spiro', name: '行星花紋', desc: '兩行星連線織出玫瑰圖樣', params: { mode: 'spiro' } },
    { id: 'retro', name: '逆行迴圈', desc: '以地球為中心看行星逆行繞圈', params: { mode: 'retro' } },
    { id: 'kepler', name: '等面積律', desc: '橢圓軌道相同時間掃過相同面積', params: { mode: 'kepler' } },
    { id: 'transit', name: '凌日觀測', desc: '行星掠過恆星，下方畫出亮度曲線', params: { mode: 'transit' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.key = null; s.T = 0;
    s.stars = mkStars(Math.max(30, (cols * rows / 45) | 0));
    s.cx = cols / 2; s.cy = rows / 2;
    if (p.mode === 'sys') this.initSys(s, f);
    else if (p.mode === 'spiro') this.initSpiro(s, f);
    else if (p.mode === 'retro') this.initRetro(s, f);
    else if (p.mode === 'kepler') this.initKepler(s, f);
    else this.initTransit(s, f);
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.55);
    s.Po = pal(f, h, [[40, 40, 60], [96, 96, 130], [170, 170, 210]], 0.1, 0.45);
    s.Psun = pal(f, h, [[110, 30, 0], [240, 120, 20], [255, 210, 90], [255, 250, 220]], 0.35, 1);
    s.Pt = pal(f, h, [[90, 90, 110], [210, 210, 230]], 0.3, 0.75);
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    if (s.hue) f.bg = rgb(3, 4, 12);
    s.T += f.dt * f.p.spd;
    const m = f.p.mode;
    // 行星名稱先記下來，所有東西畫完才寫，後畫的行星、光暈、星星就不會蓋到字
    const labs = s.labs || (s.labs = []);
    labs.length = 0;
    if (m === 'sys') this.frameSys(s, f);
    else if (m === 'spiro') this.frameSpiro(s, f);
    else if (m === 'retro') this.frameRetro(s, f);
    else if (m === 'kepler') this.frameKepler(s, f);
    else {
      // 凌日：星星先畫，行星剪影清成空格後才不會又被星星填回去
      drawStars(f, s.stars, s.Ps);
      this.frameTransit(s, f);
      return;
    }
    drawStars(f, s.stars, s.Ps);
    flushLabels(f.g, labs, s);
  },
  // ── 太陽系／木衛系 ──
  initSys(s, f) {
    const { cols, rows, aspect, p } = f, giant = p.center === 'giant';
    s.R = Math.min(cols * 0.47, (rows * 0.45 * aspect) / p.tilt);
    s.ty = p.tilt / aspect;
    s.ps = Math.max(0.8, s.R / 48);
    const n = giant ? 4 : 8;
    s.orb = [];
    for (let k = 0; k < n; k++) {
      const fr = giant ? 0.36 + 0.64 * Math.pow(k / 3, 1.2) : 0.13 + 0.87 * Math.pow((k + 1) / n, 1.25);
      const r = s.R * fr, per = giant ? [1, 2, 4, 9.4][k] * 3.4 : Math.pow(PLAN[k].au, 0.78) * 7.5;
      const m = Math.max(24, Math.ceil(TAU * r * 0.9)), idx = new Int32Array(m), back = new Uint8Array(m);
      for (let j = 0; j < m; j++) {
        const a = (j / m) * TAU, x = s.cx + r * Math.cos(a), y = s.cy + r * Math.sin(a) * s.ty;
        idx[j] = x >= 0 && y >= 0 && x < cols && y < rows ? (y | 0) * cols + (x | 0) : -1;
        back[j] = Math.sin(a) < 0 ? 1 : 0;
      }
      s.orb.push({ r, per, ph: rnd(0, TAU), idx, back, d: giant ? JMOON[k] : PLAN[k] });
    }
    s.belt = null;
    if (p.belt > 0 && !giant) {
      const N = Math.max(150, ((cols * rows) / 9) * p.belt) | 0, B = new Float32Array(N * 4);
      const r3 = s.orb[3].r, r4 = s.orb[4].r, j4 = s.orb[4];
      for (let k = 0; k < N; k++) {
        const troj = k < N * 0.18;
        let fr;
        do { fr = rnd(0.12, 0.85); } while (Math.abs(fr - 0.42) < 0.035 || Math.abs(fr - 0.62) < 0.03);
        const r = troj ? j4.r * (1 + gauss() * 0.03) : r3 + (r4 - r3) * fr;
        B[k * 4] = r;
        B[k * 4 + 1] = troj ? (k % 2 ? 1 : -1) * Math.PI / 3 + gauss() * 0.22 : rnd(0, TAU);
        B[k * 4 + 2] = troj ? -1 : TAU / (j4.per * Math.pow(r / j4.r, 1.5));
        B[k * 4 + 3] = Math.random();
      }
      s.belt = B;
    }
  },
  frameSys(s, f) {
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, T = s.T, hue = s.hue, giant = p.center === 'giant';
    const cx = s.cx, cy = s.cy, ty = s.ty, Po = s.Po;
    for (const o of s.orb) {
      const idx = o.idx, back = o.back, cb = pc(Po, 0.3), cf = pc(Po, 0.55);
      for (let j = 0; j < idx.length; j += 2) {
        const i = idx[j];
        if (i < 0 || ch[i] !== ' ') continue;
        ch[i] = back[j] ? '.' : '·'; co[i] = back[j] ? cb : cf;
      }
    }
    if (s.belt) {
      const B = s.belt, j4 = s.orb[4], ja = j4.ph + (T * TAU) / j4.per;
      for (let k = 0; k < B.length; k += 4) {
        const a = B[k + 2] < 0 ? ja + B[k + 1] + 0.05 * Math.sin(T * 0.3 + B[k + 3] * 20) : B[k + 1] + T * B[k + 2];
        const x = cx + B[k] * Math.cos(a), y = cy + B[k] * Math.sin(a) * ty;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = (y | 0) * cols + (x | 0);
        if (ch[i] !== ' ') continue;
        ch[i] = B[k + 3] > 0.85 ? '·' : '.'; co[i] = pc(s.Pt, 0.25 + B[k + 3] * 0.5);
      }
    }
    const L = [];
    for (const o of s.orb) {
      const a = o.ph + (T * TAU) / o.per;
      L.push({ o, x: cx + o.r * Math.cos(a), y: cy + o.r * Math.sin(a) * ty, z: Math.sin(a), a });
    }
    L.sort((A0, B0) => A0.z - B0.z);
    const drawP = q => {
      const d = q.o.d, pr = d.r * s.ps;
      let lx, ly, lz;
      if (giant) { lx = -0.85; ly = 0; lz = 0.5; }
      else { const dx = cx - q.x, dy = (cy - q.y) * aspect, dd = Math.hypot(dx, dy) || 1; lx = (dx / dd) * 0.9; ly = (dy / dd) * 0.9; lz = 0.35; }
      if (d.ring && pr >= 1) this.ringPass(f, q.x, q.y, pr, true);
      ball(f, hue, q.x, q.y, pr, lx, ly, lz, d.c, 0.04);
      if (d.ring && pr >= 1) this.ringPass(f, q.x, q.y, pr, false);
      if (d.moon) {
        const ma = T * 4.2, mx = q.x + pr * 2.4 * Math.cos(ma), my = q.y + pr * 2.4 * Math.sin(ma) * Math.max(ty, 0.25);
        g.set(mx, my, pr > 1.4 ? '•' : '·', hue ? rgb(210, 210, 200) : f.C(0.7));
      }
      if (cols >= 150) {
        // 英文名稱較長：右邊放不下時改寫在行星左邊（中文照舊）
        const nm = bodyName(f, d), w = g.textW(nm);
        s.labs.push(f.lang === 'en' && q.x < cols && q.x + pr + 2 + w > cols ? q.x - pr - 1 - w : q.x + pr + 2, q.y, nm, pc(s.Pt, 0.5));
      }
    };
    for (const q of L) if (q.z < 0) drawP(q);
    if (giant) this.giantBall(f, s, cx, cy, s.R * 0.2);
    else sunGlow(f, cx, cy, Math.max(1.6, s.R * 0.075), s.Psun, 6, 3.2);
    for (const q of L) if (q.z >= 0) drawP(q);
    if (giant && cols >= 150) { const jl = tr(f, '木星', 'Jupiter'); s.labs.push(cx - g.textW(jl) / 2, Math.min(rows - 1, cy + (s.R * 0.2) / aspect + 2), jl, pc(s.Pt, 0.6)); }
  },
  ringPass(f, x, y, pr, back) {
    const { g, aspect } = f, hue = f.H(0, 0.6) !== f.H(120, 0.6);
    for (const [rr, chh, lv] of [[2.3, '-', 0.7], [1.75, '=', 0.9]]) {
      const rw = pr * rr, m = Math.ceil(TAU * rw * 1.5);
      for (let j = 0; j < m; j++) {
        const a = (j / m) * TAU, sb = Math.sin(a) < 0;
        if (sb !== back) continue;
        const xx = x + rw * Math.cos(a), yy = y + (rw * Math.sin(a) * 0.38) / aspect;
        if (back) { const i = Math.floor(yy) * g.cols + Math.floor(xx); if (xx < 0 || yy < 0 || xx >= g.cols || yy >= g.rows || g.ch[i] !== ' ' && g.ch[i] !== '·' && g.ch[i] !== '.') continue; }
        else if (Math.hypot(xx - x, (yy - y) * aspect) < pr * 0.98 && Math.sin(a) < 0) continue;
        g.set(xx, yy, chh, hue ? rgb(220 * lv, 196 * lv, 140 * lv) : f.C(lv * 0.8));
      }
    }
  },
  giantBall(f, s, x, y, R) {
    const { g, cols, rows, aspect, t } = f, ch = g.ch, co = g.co, hue = s.hue;
    const ry = R / aspect, y0 = Math.max(0, Math.floor(y - ry)), y1 = Math.min(rows - 1, Math.floor(y + ry));
    const x0 = Math.max(0, Math.floor(x - R)), x1 = Math.min(cols - 1, Math.floor(x + R));
    const C1 = [236, 220, 190], C2 = [176, 112, 70];
    for (let yy = y0; yy <= y1; yy++) {
      const v = ((yy + 0.5 - y) * aspect) / R;
      for (let xx = x0; xx <= x1; xx++) {
        const u = (xx + 0.5 - x) / R, d2 = u * u + v * v;
        if (d2 > 1) continue;
        const w = Math.sqrt(1 - d2), lon = Math.atan2(u, w) / TAU * 256 + t * 6;
        const bnd = 0.5 + 0.5 * Math.sin(v * 11 + (nz(lon * 0.5, v * 30) - 0.5) * 3);
        const l = clamp(0.06 + Math.max(0, -u * 0.8 + w * 0.6) * 0.94, 0, 1) * (0.75 + 0.25 * bnd);
        const i = yy * cols + xx;
        ch[i] = R10[Math.max(1, Math.min(9, (l * 9.5) | 0))];
        co[i] = hue ? shade(mixc(C2, C1, bnd), 0.25 + 0.85 * l) : f.C(0.1 + 0.85 * l);
      }
    }
  },
  // ── 行星花紋 ──
  initSpiro(s, f) {
    const { cols, rows, aspect } = f, nP = cols >= 70 ? 3 : 1;
    const pairs = [[1, 2, [255, 170, 90]], [0, 1, [120, 200, 255]], [2, 3, [255, 110, 150]]];
    s.pan = [];
    for (let k = 0; k < nP; k++) {
      const pr = pairs[k], R = Math.min((cols / nP) * 0.46, rows * 0.46 * aspect);
      s.pan.push({ cx: (cols * (k + 0.5)) / nP, R, a: pr[0], b: pr[1], c: pr[2], r1: (R * PLAN[pr[0]].au) / PLAN[pr[1]].au, ph1: rnd(0, TAU), ph2: rnd(0, TAU) });
    }
    s.cnt = new Uint16Array(cols * rows);
    s.cid = new Uint8Array(cols * rows);
    s.done = 0; s.T = 0;
  },
  spiroPos(q, T) {
    const Y = 3.2, a1 = q.ph1 + (T * TAU) / (Y * Math.pow(PLAN[q.a].au, 1.5)), a2 = q.ph2 + (T * TAU) / (Y * Math.pow(PLAN[q.b].au, 1.5));
    return [q.r1 * Math.cos(a1), q.r1 * Math.sin(a1), q.R * Math.cos(a2), q.R * Math.sin(a2)];
  },
  frameSpiro(s, f) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, cy = s.cy, hue = s.hue, step = 3.2 / 40;
    if (s.T > 46) { this.initSpiro(s, f); return; }
    const fade = s.T > 42 ? 1 - (s.T - 42) / 4 : 1;
    const want = Math.min(40 * 15, Math.floor(s.T / step));
    while (s.done < want) {
      const tt = s.done * step;
      s.pan.forEach((q, k) => {
        const P = this.spiroPos(q, tt);
        const n0 = s.cnt.length;
        accLine(s.cnt, cols, rows, q.cx + P[0], cy + P[1] / aspect, q.cx + P[2], cy + P[3] / aspect, 1);
        void n0;
      });
      s.done++;
    }
    const cnt = s.cnt;
    for (let i = 0; i < cnt.length; i++) {
      const c = cnt[i];
      if (!c) continue;
      const x = i % cols, k = s.pan.length === 1 ? 0 : Math.min(s.pan.length - 1, Math.floor((x / cols) * s.pan.length));
      const v = Math.min(1, Math.log(1 + c) / 3.2) * fade;
      if (v < 0.05) continue;
      ch[i] = R10[Math.max(1, Math.min(9, (v * 9.4) | 0))];
      co[i] = hue ? shade(s.pan[k].c, 0.2 + 0.8 * v) : f.C(0.12 + 0.8 * v);
    }
    for (const q of s.pan) {
      for (const R of [q.r1, q.R]) {
        const m = Math.ceil(TAU * R * 0.6);
        for (let j = 0; j < m; j++) {
          const a = (j / m) * TAU, x = q.cx + R * Math.cos(a), y = cy + (R * Math.sin(a)) / aspect, i = (y | 0) * cols + (x | 0);
          if (x >= 0 && y >= 0 && x < cols && y < rows && ch[i] === ' ') { ch[i] = '·'; co[i] = pc(s.Po, 0.35); }
        }
      }
      const P = this.spiroPos(q, s.T);
      g.line(q.cx + P[0], cy + P[1] / aspect, q.cx + P[2], cy + P[3] / aspect, '·', hue ? rgb(255, 255, 255) : f.C(0.9));
      ball(f, hue, q.cx + P[0], cy + P[1] / aspect, 1.2 * Math.max(0.8, q.R / 50), -P[0], -P[1], 0.4, PLAN[q.a].c);
      ball(f, hue, q.cx + P[2], cy + P[3] / aspect, 1.3 * Math.max(0.8, q.R / 50), -P[2], -P[3], 0.4, PLAN[q.b].c);
      sunGlow(f, q.cx, cy, Math.max(1, q.R * 0.05), s.Psun, 0, 2);
      if (cols >= 150) { const L = bodyName(f, PLAN[q.a]) + ' × ' + bodyName(f, PLAN[q.b]); s.labs.push(q.cx - g.textW(L) / 2, Math.min(rows - 1, cy + q.R / aspect + 1), L, pc(s.Pt, 0.5)); }
    }
  },
  // ── 逆行迴圈（地心視角） ──
  initRetro(s, f) {
    const { cols, rows, aspect } = f;
    s.R = Math.min(cols * 0.47, (rows * 0.45 * aspect) / 0.62);
    s.ty = 0.62 / aspect;
    s.bod = [{ au: 0, c: [255, 214, 110], n: '太陽', en: 'Sun' }, PLAN[0], PLAN[1], PLAN[3], PLAN[4], PLAN[5]];
    s.HN = 1000;
    s.hx = new Float32Array(s.bod.length * s.HN); s.hy = new Float32Array(s.bod.length * s.HN);
    s.hn = 0; s.hp = 0; s.T = rnd(0, 20); s.lastT = -1;
  },
  frameRetro(s, f) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, hue = s.hue, Y = 4, T = s.T, NB = s.bod.length, HN = s.HN;
    const ea = (T * TAU) / Y, ex = Math.cos(ea), ey = Math.sin(ea), pos = [];
    for (let b = 0; b < NB; b++) {
      const d = s.bod[b];
      let vx = -ex, vy = -ey;
      if (d.au) { const a = (T * TAU) / (Y * Math.pow(d.au, 1.5)) + b * 1.7; vx += d.au * Math.cos(a); vy += d.au * Math.sin(a); }
      const dist = Math.hypot(vx, vy) || 1, rr = s.R * Math.sqrt(dist / 10.6);
      pos.push([s.cx + (rr * vx) / dist, s.cy + (rr * vy) / dist * s.ty]);
    }
    if (T - s.lastT > 0.025) {
      s.lastT = T;
      for (let b = 0; b < NB; b++) { s.hx[b * HN + s.hp] = pos[b][0]; s.hy[b * HN + s.hp] = pos[b][1]; }
      s.hp = (s.hp + 1) % HN; s.hn = Math.min(HN, s.hn + 1);
    }
    for (let b = 0; b < NB; b++) {
      const c = s.bod[b].c;
      let px = -1, py = -1;
      for (let k = 0; k < s.hn; k++) {
        const j = (s.hp - s.hn + k + HN) % HN, x = s.hx[b * HN + j], y = s.hy[b * HN + j], age = k / s.hn;
        const v = 0.1 + 0.75 * age * age;
        const col = hue ? shade(c, 0.15 + 0.8 * v) : f.C(0.1 + 0.75 * v), chh = age > 0.85 ? ':' : '.';
        if (px >= 0 && Math.abs(x - px) + Math.abs(y - py) > 1.2) {
          const n = Math.ceil(Math.max(Math.abs(x - px), Math.abs(y - py)));
          for (let q = 1; q <= n; q++) {
            const xx = px + ((x - px) * q) / n, yy = py + ((y - py) * q) / n;
            if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) { const i = (yy | 0) * cols + (xx | 0); ch[i] = chh; co[i] = col; }
          }
        } else if (x >= 0 && y >= 0 && x < cols && y < rows) { const i = (y | 0) * cols + (x | 0); ch[i] = chh; co[i] = col; }
        px = x; py = y;
      }
    }
    const ps = Math.max(0.8, s.R / 70);
    for (let b = 0; b < NB; b++) {
      const d = s.bod[b], [x, y] = pos[b];
      if (b === 0) sunGlow(f, x, y, Math.max(1.2, ps * 1.6), s.Psun, 0, 2);
      else ball(f, hue, x, y, d.r * ps * 0.9, s.cx - x, (s.cy - y) * aspect, 0.5, d.c);
      if (cols >= 150) s.labs.push(x + ps * 2 + 1, y, bodyName(f, d), pc(s.Pt, 0.55));
    }
    ball(f, hue, s.cx, s.cy, ps * 1.4, -0.6, -0.3, 0.7, PLAN[2].c);
    if (cols >= 150) { const el = bodyName(f, PLAN[2]); s.labs.push(s.cx - g.textW(el) / 2, s.cy + 2, el, pc(s.Pt, 0.7)); }
  },
  // ── 等面積律 ──
  initKepler(s, f) {
    const { cols, rows, aspect } = f;
    s.e = 0.72;
    s.a = Math.min(cols * 0.46, (rows * 0.44 * aspect) / Math.sqrt(1 - s.e * s.e));
    s.b = s.a * Math.sqrt(1 - s.e * s.e);
    s.sx = s.cx + s.a * s.e;
    s.P = 18; s.lab = new Uint8Array(cols * rows); s.lastE = 0; s.lap = 0;
    const m = Math.ceil(TAU * s.a), oi = new Int32Array(m);
    for (let j = 0; j < m; j++) {
      const E = (j / m) * TAU, x = s.sx + s.a * (Math.cos(E) - s.e), y = s.cy + (s.b * Math.sin(E)) / aspect;
      oi[j] = x >= 0 && y >= 0 && x < cols && y < rows ? (y | 0) * cols + (x | 0) : -1;
    }
    s.oi = oi;
  },
  frameKepler(s, f) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, hue = s.hue, lab = s.lab;
    const Mt = (s.T * TAU) / s.P, lap = Math.floor(Mt / TAU), M = Mt - lap * TAU;
    if (lap !== s.lap) { s.lap = lap; lab.fill(0); s.lastE = 0; }
    const E = keplerE(M, s.e), sec = Math.floor(M / (TAU / 12));
    const steps = Math.max(1, Math.ceil((E - s.lastE) / 0.006));
    for (let k = 1; k <= steps; k++) {
      const EE = s.lastE + ((E - s.lastE) * k) / steps;
      const MM = EE - s.e * Math.sin(EE), sk = Math.floor(MM / (TAU / 12)) % 12;
      const x1 = s.sx + s.a * (Math.cos(EE) - s.e), y1 = s.cy + (s.b * Math.sin(EE)) / aspect;
      const n = Math.ceil(Math.max(Math.abs(x1 - s.sx), Math.abs(y1 - s.cy)));
      for (let q = 0; q <= n; q++) {
        const xx = s.sx + ((x1 - s.sx) * q) / n, yy = s.cy + ((y1 - s.cy) * q) / n;
        if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
        const i = (yy | 0) * cols + (xx | 0);
        if (!lab[i]) lab[i] = sk + 1;
      }
    }
    s.lastE = E;
    const PA = [[255, 190, 80], [90, 170, 255]];
    for (let i = 0; i < lab.length; i++) {
      const l = lab[i];
      if (!l) continue;
      const odd = l & 1, v = 0.35 + 0.25 * (((l - 1) >> 1) % 3) / 2;
      ch[i] = odd ? ':' : '.';
      co[i] = hue ? shade(PA[odd], v + (l - 1 === sec ? 0.3 : 0)) : f.C(v * (odd ? 0.9 : 0.6) + (l - 1 === sec ? 0.2 : 0));
    }
    for (let j = 0; j < s.oi.length; j++) { const i = s.oi[j]; if (i >= 0) { ch[i] = '·'; co[i] = pc(s.Po, 0.7); } }
    const px = s.sx + s.a * (Math.cos(E) - s.e), py = s.cy + (s.b * Math.sin(E)) / aspect;
    g.line(s.sx, s.cy, px, py, slopeCh(px - s.sx, py - s.cy, aspect), hue ? rgb(255, 255, 255) : f.C(1));
    sunGlow(f, s.sx, s.cy, Math.max(1.4, s.a * 0.045), s.Psun, 6, 2.6);
    ball(f, hue, px, py, Math.max(1, s.a / 45), s.sx - px, (s.cy - py) * aspect, 0.3, PLAN[2].c);
    if (cols >= 150) {
      txt(g, 2, rows - 2, tr(f, '相等時間  掃過相等面積', 'Equal areas in equal times'), pc(s.Pt, 0.6));
      txt(g, 2, rows - 3, tr(f, '第 ' + (sec + 1) + ' 段', 'Sector ' + (sec + 1)), pc(s.Pt, 0.45));
    }
  },
  // ── 凌日觀測 ──
  initTransit(s, f) {
    const { cols, rows, aspect } = f;
    s.scy = rows * 0.37;
    s.Rs = Math.min(rows * 0.27 * aspect, cols * 0.16);
    s.pl = [];
    const sz = [0.09, 0.15, 0.11, 0.19], hu = [[200, 150, 110], [120, 170, 240], [220, 120, 90], [180, 200, 160]];
    for (let k = 0; k < 4; k++) {
      const r = s.Rs * (1.4 + k * 0.6), per = 5 * Math.pow(r / s.Rs, 1.5);
      s.pl.push({ r: Math.min(r, cols * 0.47), per, ph: rnd(0, TAU), pr: s.Rs * sz[k], b: (k % 2 ? 1 : -1) * (0.1 + 0.15 * k) * s.Rs / aspect, c: hu[k] });
    }
    s.lc = new Float32Array(cols * 2).fill(1); s.lcT = 0; s.pos = null;
  },
  frameTransit(s, f) {
    const { g, cols, rows, aspect, t, dt } = f, ch = g.ch, co = g.co, hue = s.hue, cx = s.cx, cy = s.scy, Rs = s.Rs;
    if (!s.pos) s.pos = s.pl.map(q => ({ q, x: 0, y: 0, z: 0 }));
    const pos = s.pos;
    for (const P of pos) { const q = P.q, a = q.ph + (s.T * TAU) / q.per; P.x = cx + q.r * Math.cos(a); P.y = cy + q.b + (q.r * Math.sin(a) * 0.1) / aspect; P.z = Math.sin(a); }
    let flux = 1;
    for (const P of pos) {
      if (P.z < 0) continue;
      const d = Math.hypot(P.x - cx, (P.y - cy) * aspect), pr = P.q.pr;
      const inside = clamp((Rs + pr - d) / (2 * pr), 0, 1);
      const ld = 0.6 + 0.4 * Math.sqrt(Math.max(0, 1 - (d / Rs) ** 2));
      flux -= inside * (pr / Rs) ** 2 * ld * 1.4;
    }
    s.lcT += dt;
    while (s.lcT > 0.05) { s.lcT -= 0.05; s.lc.copyWithin(0, 1); s.lc[s.lc.length - 1] = flux + (Math.random() - 0.5) * 0.004; }
    for (const q of s.pl) {
      const m = Math.ceil(TAU * q.r * 0.5);
      for (let j = 0; j < m; j++) {
        const a = (j / m) * TAU, x = cx + q.r * Math.cos(a), y = cy + q.b + (q.r * Math.sin(a) * 0.1) / aspect, i = (y | 0) * cols + (x | 0);
        if (x >= 0 && y >= 0 && x < cols && y < rows && ch[i] === ' ') { ch[i] = '.'; co[i] = pc(s.Po, 0.3); }
      }
    }
    const drawPl = P => {
      const q = P.q;
      ball(f, hue, P.x, P.y, q.pr, cx - P.x, (cy - P.y) * aspect, -P.z * 0.8, q.c, 0.03);
    };
    for (const P of pos) if (P.z < 0) drawPl(P);
    // 恆星（周邊變暗＋米粒紋）
    const ry = Rs / aspect, y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(rows - 1, Math.floor(cy + ry));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * aspect;
      for (let x = Math.max(0, Math.floor(cx - Rs)); x <= Math.min(cols - 1, Math.floor(cx + Rs)); x++) {
        const dx = x + 0.5 - cx, d2 = (dx * dx + dy * dy) / (Rs * Rs);
        if (d2 > 1) continue;
        const mu = Math.sqrt(1 - d2), gr = nz(x * 0.8 + t * 1.5, y * 1.7), v = (0.35 + 0.65 * mu) * (0.85 + 0.3 * gr);
        const i = y * cols + x;
        ch[i] = v > 0.9 ? '@' : v > 0.75 ? '#' : v > 0.6 ? '*' : v > 0.45 ? '+' : '=';
        co[i] = hue ? shd(255, 150, 80, 0.45 + 0.6 * v) : f.C(0.35 + 0.6 * v);
      }
    }
    for (const P of pos) {
      if (P.z < 0) continue;
      drawPl(P);
      const q = P.q, pry = q.pr / aspect;
      for (let y = Math.floor(P.y - pry); y <= P.y + pry; y++) for (let x = Math.floor(P.x - q.pr); x <= P.x + q.pr; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const dx = x + 0.5 - P.x, dy = (y + 0.5 - P.y) * aspect;
        if (dx * dx + dy * dy > q.pr * q.pr) continue;
        if ((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) * aspect) ** 2 < Rs * Rs) ch[y * cols + x] = ' ';
      }
    }
    // 亮度曲線（點字）
    const top = Math.floor(rows * 0.76), h = Math.max(2, rows - 1 - top), Hd = h * 4, W = cols * 2;
    let lo = 1;
    for (let k = 0; k < W; k++) lo = Math.min(lo, s.lc[k]);
    lo = Math.min(0.94, lo - 0.01);
    if (!s.bits || s.bits.length !== cols * h) s.bits = new Uint8Array(cols * h); else s.bits.fill(0);
    const bits = s.bits;
    let prev = -1;
    for (let k = 0; k < W; k++) {
      const v = clamp((s.lc[k] - lo) / (1.005 - lo), 0, 1), yd = Math.round((1 - v) * (Hd - 1));
      const a = prev < 0 ? yd : Math.min(prev, yd), b = prev < 0 ? yd : Math.max(prev, yd);
      for (let q = a; q <= b; q++) bits[(q >> 2) * cols + (k >> 1)] |= BRL_BIT[q & 3][k & 1];
      prev = yd;
    }
    const lcCol = hue ? rgb(255, 210, 140) : f.C(0.8);
    for (let y = 0; y < h; y++) for (let x = 0; x < cols; x++) {
      const b = bits[y * cols + x], i = (top + y) * cols + x;
      if (b) { ch[i] = BRL[b]; co[i] = lcCol; }
      else if (y === h - 1 && x % 4 === 0) { ch[i] = '.'; co[i] = pc(s.Po, 0.3); }
    }
    if (cols >= 150) txt(g, 2, top - 1, tr(f, '相對亮度', 'Relative brightness'), pc(s.Pt, 0.5));
  },
});

/* ═════════ 2. 環狀行星 ═════════ */
const EIGHTH = ' ▁▂▃▄▅▆▇█';
const RING_R = '.:-=≡≡#';
// 環的密度剖面（256 格，對應內緣到外緣）
function ringProfile(kind) {
  const P = new Float32Array(256);
  for (let k = 0; k < 256; k++) {
    const u = k / 255;
    let d;
    if (kind === 'thin') {
      d = 0;
      for (const c of [0.1, 0.3, 0.52, 0.72, 0.93]) d = Math.max(d, Math.exp(-(((u - c) / 0.035) ** 2)) * (c === 0.93 ? 1 : 0.8));
      d += 0.05 * nz(u * 200, 9);
    } else if (kind === 'faint') {
      d = 0.25 + 0.35 * nz(u * 30, 4) + 0.35 * Math.exp(-(((u - 0.55) / 0.2) ** 2));
      if (u < 0.05 || u > 0.97) d *= 0.3;
    } else {
      if (u < 0.17) d = 0.18 + u * 1.2;
      else if (u < 0.58) d = 0.82 + 0.15 * Math.sin(u * 60);
      else if (u < 0.645) d = 0.05;
      else if (u < 0.92) d = Math.abs(u - 0.86) < 0.008 ? 0.04 : 0.62;
      else d = Math.abs(u - 0.975) < 0.01 ? 0.75 : 0.02;
      d *= 0.82 + 0.36 * nz(u * 180, 3);
    }
    P[k] = clamp(d, 0, 1);
  }
  return P;
}
A({ id: 'sp-ringed', name: '環狀行星', cat: '太空', theme: 'gold', hue: true, desc: '光環投下陰影、緩緩自轉的行星',
  params: { inc: 0.42, roll: -0.16, R: 0.3, px: 0.5, py: 0.5, lx: -0.55, ly: 0.42, lz: 0.72, rin: 1.25, rout: 2.3, prof: 'sat', look: 'sat', moons: 2, swing: 0, land: 0, back: 0, spokes: 0 },
  variants: [
    { id: 'edge', name: '側看光環', desc: '環面幾乎平視，陰影橫過星球', params: { inc: 0.045, roll: 0.05, lx: -0.5, ly: 0.6, lz: 0.62, R: 0.36, moons: 3 } },
    { id: 'backlit', name: '逆光', desc: '太陽在背後，只剩亮邊與發光的環', params: { lx: 0.3, ly: 0.18, lz: -0.94, back: 1, inc: 0.3, roll: 0.12 } },
    { id: 'ice', name: '直立細環', desc: '青藍色冰巨星與細窄的直立環', params: { look: 'ice', prof: 'thin', roll: 1.3, inc: 0.5, R: 0.33, rin: 1.5, rout: 2.1, moons: 1 } },
    { id: 'orbit', name: '環繞飛行', desc: '視角繞著星球上下翻轉', params: { swing: 1, R: 0.27 } },
    { id: 'close', name: '環面特寫', desc: '巨大的環弧橫越整個畫面', params: { px: 0.04, py: 1.35, R: 0.9, inc: 0.3, roll: 0.25, moons: 0, spokes: 1, lx: -0.3, ly: 0.5, lz: 0.81 } },
    { id: 'sky', name: '衛星地平', desc: '從衛星表面仰望升起的環狀行星', params: { land: 1, py: 0.66, R: 0.34, inc: 0.2, roll: -0.08, moons: 1 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.key = null;
    s.stars = mkStars(Math.max(30, (cols * rows / 40) | 0));
    s.prof = ringProfile(p.prof);
    s.zb = new Float32Array(cols * rows);
    s.moons = [];
    for (let k = 0; k < p.moons; k++) s.moons.push({ r: (p.rout + 0.4 + k * (p.moons > 3 ? 0.55 : 0.9)), ph: rnd(0, TAU), sz: rnd(0.05, 0.11), c: pick([[200, 196, 186], [222, 206, 170], [170, 170, 180], [236, 226, 210]]) });
    s.land = null;
    if (p.land) {
      s.land = new Float32Array(cols);
      for (let x = 0; x < cols; x++) {
        const u = (x / cols) * 60;
        s.land[x] = rows * (0.8 - 0.07 * nz(u, 77) - 0.05 * nz(u * 3.1, 91) + 0.04 * Math.pow(Math.abs(Math.sin(x / cols * 3.2 + 1)), 6));
      }
    }
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f)), ice = f.p.look === 'ice';
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.6);
    s.Z1 = ice ? [176, 232, 240] : [244, 224, 176];
    s.Z2 = ice ? [110, 180, 214] : [196, 150, 100];
    s.RC = ice ? [170, 186, 200] : [236, 214, 170];
    s.Pl = pal(f, h, [[14, 12, 14], [52, 46, 48], [110, 100, 96]], 0.03, 0.3);
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, zb = s.zb, prof = s.prof;
    if (hue) f.bg = rgb(2, 3, 8);
    let inc = p.inc + 0.035 * Math.sin(t * 0.05), roll = p.roll + 0.03 * Math.sin(t * 0.031);
    if (p.swing) { inc = 0.62 * Math.sin(t * 0.08); roll = p.roll + 0.25 * Math.sin(t * 0.045); }
    if (Math.abs(inc) < 0.025) inc = inc < 0 ? -0.025 : 0.025;
    const ci = Math.cos(inc), si = Math.sin(inc), cr = Math.cos(roll), sr = Math.sin(roll);
    const nx = -sr * ci, ny = cr * ci, nzv = si;
    let e1x = ny, e1y = -nx;
    const el = Math.hypot(e1x, e1y) || 1;
    e1x /= el; e1y /= el;
    const e2x = ny * 0 - nzv * e1y, e2y = nzv * e1x - nx * 0, e2z = nx * e1y - ny * e1x;
    let lx = p.lx, ly = p.ly, lz = p.lz;
    const ll = Math.hypot(lx, ly, lz);
    lx /= ll; ly /= ll; lz /= ll;
    const nL = nx * lx + ny * ly + nzv * lz;
    const sameSide = nL * nzv > 0;
    const Rp = p.R * rows * aspect, cx = cols * p.px, cy = rows * p.py;
    const rin = p.rin, rout = p.rout, rspan = rout - rin;
    const rot = t * 0.035;
    const Z1 = s.Z1, Z2 = s.Z2, RC = s.RC;
    // 外框
    const ro = rout * Rp;
    const bx = Math.max(Rp * 1.12, ro * Math.hypot(e1x, e2x)), by = Math.max(Rp * 1.12, ro * Math.hypot(e1y, e2y));
    const x0 = Math.max(0, Math.floor(cx - bx)), x1 = Math.min(cols - 1, Math.ceil(cx + bx));
    const y0 = Math.max(0, Math.floor(cy - by / aspect)), y1 = Math.min(rows - 1, Math.ceil(cy + by / aspect));
    zb.fill(-1e9);
    for (let y = y0; y <= y1; y++) {
      const Y = -(y + 0.5 - cy) * aspect;
      for (let x = x0; x <= x1; x++) {
        const X = x + 0.5 - cx, i = y * cols + x;
        const d2 = X * X + Y * Y, inP = d2 < Rp * Rp;
        const zp = inP ? Math.sqrt(Rp * Rp - d2) : -1e9;
        // 環
        const zr = -(nx * X + ny * Y) / nzv;
        const rho = Math.sqrt(d2 + zr * zr) / Rp;
        let ringV = -1;
        if (rho > rin && rho < rout && (!inP || zr > zp)) {
          const u = (rho - rin) / rspan;
          let D = prof[(u * 255) | 0];
          const ax = X * e1x + Y * e1y, ay = X * e2x + Y * e2y + zr * e2z;
          const az = Math.atan2(ay, ax);
          D *= 0.85 + 0.3 * nz((az / TAU) * 256 * 2 - rot * 40 / (rho * rho), u * 40);
          if (p.spokes) D *= 1 - 0.45 * smooth((nz((az / TAU) * 256 * 4 - rot * 60, u * 6 + 50) - 0.62) * 6);
          if (D > 0.03) {
            let lit = sameSide ? 0.35 + 0.65 * Math.sqrt(Math.abs(nL)) : p.back ? 0.75 : 0.22;
            const rx = X, ry = Y, rz = zr, pl = rx * lx + ry * ly + rz * lz;
            if (pl < 0 && rx * rx + ry * ry + rz * rz - pl * pl < Rp * Rp) lit *= 0.07;
            ringV = clamp(D * lit * (p.back ? 1.25 : 1.05), 0, 1);
            if (ringV > 0.02) {
              if (ringV > 0.28 && (u < 0.035 || u > 0.965)) {
                // 只有內外緣用斜線勾邊，環面本身用亮度字元，整圈才會像一片連續的環
                const sa = Math.sin(az), ca = Math.cos(az), TX = -sa * e1x + ca * e2x, TY = -sa * e1y + ca * e2y;
                const sc = slopeCh(TX, -TY / aspect, aspect);
                ch[i] = sc === '-' ? (ringV > 0.6 ? '=' : '-') : sc;
              } else ch[i] = RING_R[ringV >= 0.86 ? 6 : (ringV * 7) | 0];
              co[i] = hue ? shade(RC, 0.12 + 0.95 * ringV) : f.C(0.06 + 0.9 * ringV);
              zb[i] = zr;
              continue;
            }
          }
        }
        if (inP) {
          const Nx = X / Rp, Ny = Y / Rp, Nz = zp / Rp;
          let dif = Nx * lx + Ny * ly + Nz * lz;
          // 環的影子
          if (dif > 0) {
            const Sx = X, Sy = Y, Sz = zp, tt = -(nx * Sx + ny * Sy + nzv * Sz) / nL;
            if (tt > 0) {
              const qx = Sx + tt * lx, qy = Sy + tt * ly, qz = Sz + tt * lz, rq = Math.sqrt(qx * qx + qy * qy + qz * qz) / Rp;
              if (rq > rin && rq < rout) dif *= 1 - 0.8 * prof[(((rq - rin) / rspan) * 255) | 0];
            }
          }
          const lat = Nx * nx + Ny * ny + Nz * nzv;
          const qa = Nx * e1x + Ny * e1y, qb = Nx * e2x + Ny * e2y + Nz * e2z;
          const lon = Math.atan2(qb, qa);
          const bn = 0.5 + 0.5 * Math.sin(lat * 15 + (nz((lon / TAU) * 256 + t * 2.2, lat * 50) - 0.5) * 3.2);
          let v = Math.max(0, dif) * (0.72 + 0.28 * bn);
          if (p.back) v += Math.pow(1 - Nz, 4) * 0.55 * (0.5 + 0.5 * (Nx * lx + Ny * ly) / Math.hypot(lx, ly));
          v = clamp(v + 0.025, 0, 1);
          ch[i] = R10[Math.max(1, Math.min(9, (v * 9.6) | 0))];
          co[i] = hue ? shade(mixc(Z2, Z1, bn), 0.18 + 0.9 * v) : f.C(0.05 + 0.92 * v);
          zb[i] = zp;
          continue;
        }
        if (p.back && d2 < Rp * Rp * 1.22) {
          const rr = Math.sqrt(d2) / Rp, gl = (1 - (rr - 1) / 0.105) * 0.55 * (0.4 + 0.6 * Math.max(0, (X * lx + Y * ly) / (Math.sqrt(d2) * Math.hypot(lx, ly))));
          if (gl > 0.05) { ch[i] = gl > 0.3 ? ':' : '.'; co[i] = hue ? shd(255, 220, 170, 0.3 + gl) : f.C(0.2 + gl); }
        }
      }
    }
    // 衛星
    for (const m of s.moons) {
      const a = m.ph + t * 0.35 / Math.pow(m.r, 1.5), rr = m.r * Rp;
      const MX = rr * (Math.cos(a) * e1x + Math.sin(a) * e2x), MY = rr * (Math.cos(a) * e1y + Math.sin(a) * e2y), MZ = rr * Math.sin(a) * e2z;
      const mx = cx + MX, my = cy - MY / aspect, mr = Math.max(0.6, m.sz * Rp);
      if (mx < -mr || mx > cols + mr) continue;
      const mry = mr / aspect;
      for (let y = Math.floor(my - mry); y <= my + mry; y++) for (let x = Math.floor(mx - mr); x <= mx + mr; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const u = (x + 0.5 - mx) / mr, v = (-(y + 0.5 - my) * aspect) / mr, d2 = u * u + v * v;
        if (d2 > 1 && !(x === Math.floor(mx) && y === Math.floor(my))) continue;
        const i = y * cols + x;
        if (zb[i] > MZ) continue;
        const w = Math.sqrt(Math.max(0, 1 - d2)), l = clamp(0.05 + Math.max(0, u * lx + v * ly + w * lz), 0, 1);
        ch[i] = l > 0.7 ? '@' : l > 0.45 ? 'O' : l > 0.2 ? 'o' : '.';
        co[i] = hue ? shade(m.c, 0.25 + 0.8 * l) : f.C(0.1 + 0.85 * l);
      }
    }
    if (s.land) {
      const Pl = s.Pl;
      for (let x = 0; x < cols; x++) {
        const tp = s.land[x], ty = Math.floor(tp);
        for (let y = Math.max(0, ty); y < rows; y++) {
          const i = y * cols + x;
          if (y === ty) { const k = Math.round((ty + 1 - tp) * 8); if (k <= 0) continue; ch[i] = EIGHTH[k]; co[i] = pc(Pl, 0.5); continue; }
          const n = nz(x * 0.7, y * 1.6), dd = (y - tp) / (rows - tp + 1);
          ch[i] = n > 0.8 ? '▓' : '█';
          co[i] = pc(Pl, (0.1 + 0.3 * n + (y - tp < 1.5 ? 0.25 : 0)) * (1 - dd * 0.6));
        }
      }
    }
    drawStars(f, s.stars, s.Ps);
  },
});

/* ═════════ 3. 氣態巨星 ═════════ */
const wrapA = a => a - TAU * Math.floor((a + Math.PI) / TAU);
const GLOOK = {
  jup: { z: [240, 228, 204], b: [176, 112, 72], st: [214, 104, 66], pole: [150, 140, 130] },
  ice: { z: [120, 176, 244], b: [44, 84, 190], st: [16, 30, 90], pole: [70, 110, 200] },
  hot: { z: [255, 214, 130], b: [226, 96, 40], st: [255, 240, 200], pole: [200, 80, 40] },
  sat: { z: [246, 230, 186], b: [200, 160, 106], st: [255, 250, 230], pole: [140, 170, 160] },
};
A({ id: 'sp-giant', name: '氣態巨星', cat: '太空', theme: 'amber', hue: true, desc: '雲帶翻湧、巨大風暴緩緩旋轉',
  params: { view: 'sphere', look: 'jup', R: 0.47, px: 0.56, lx: -0.62, ly: -0.25, lz: 0.74, tilt: 0.12, storms: 1, red: 1, turb: 1, moons: 2, flash: 0, tail: 0, hex: 0 },
  variants: [
    { id: 'ice', name: '冰巨星', desc: '深藍星球上的暗斑與白色雲條', params: { look: 'ice', red: 0, storms: 3, turb: 0.6, lx: 0.55, ly: -0.2, px: 0.45, moons: 1 } },
    { id: 'hot', name: '熾熱巨星', desc: '緊貼恆星的熱木星大氣逸散', params: { look: 'hot', px: 0.64, R: 0.36, lx: -1, ly: 0, lz: 0.15, red: 0, storms: 0, tail: 1, moons: 0 } },
    { id: 'pole', name: '極地六角', desc: '從北極上空看六角形噴流', params: { view: 'pole', look: 'sat', px: 0.5, R: 0.46, red: 0, storms: 0, hex: 1, lx: -0.4, ly: -0.3, lz: 0.86, moons: 0 } },
    { id: 'horizon', name: '雲頂地平', desc: '貼近雲頂飛行，雲帶延伸到天邊', params: { view: 'horizon', storms: 3, moons: 2 } },
    { id: 'map', name: '雲帶展開', desc: '攤平的雲帶與渦旋不停流動', params: { view: 'map', storms: 6, red: 1, moons: 0 } },
    { id: 'crescent', name: '新月相', desc: '背光的巨星只剩一彎亮邊', params: { lx: 0.88, ly: -0.2, lz: -0.42, px: 0.42, R: 0.8, moons: 1, tilt: 0.35 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f, n = cols * rows;
    s.key = null;
    s.stars = mkStars(Math.max(30, (n / 40) | 0));
    // 雲帶剖面與各緯度的風速
    s.BAND = new Float32Array(512); s.SPD = new Float32Array(512);
    const nb = rint(13, 17), edges = [0];
    for (let k = 1; k < nb; k++) edges.push(k / nb + rnd(-0.25, 0.25) / nb);
    edges.push(1);
    const vals = edges.map((_, k) => (k % 2 ? rnd(0.12, 0.42) : rnd(0.7, 1)));
    const sp = edges.map((_, k) => (k % 2 ? 1 : -1) * rnd(0.03, 0.1));
    for (let j = 0; j < 512; j++) {
      const u = j / 511;
      let k = 0;
      while (k < nb - 1 && u > edges[k + 1]) k++;
      const fr = (u - edges[k]) / (edges[k + 1] - edges[k]);
      const v0 = vals[k], v1 = vals[Math.min(nb - 1, k + 1)], sm = smooth((fr - 0.8) / 0.2);
      const lat = (u - 0.5) * Math.PI, polar = smooth((Math.abs(lat) - 1.05) / 0.4);
      s.BAND[j] = lerp(lerp(v0, v1, sm), 0.45, polar);
      s.SPD[j] = lerp(sp[k], sp[Math.min(nb - 1, k + 1)], sm) * (1 - polar * 0.7);
    }
    s.st = [];
    if (p.red) s.st.push({ L0: rnd(0, TAU), lat: -0.38, a: 0.3, b: 0.13, k: 'red', seed: 11 });
    for (let k = 0; k < p.storms; k++) {
      const lat = rnd(-1, 1) * 0.95, big = p.look === 'ice' && k === 0;
      s.st.push({ L0: rnd(0, TAU), lat, a: big ? 0.28 : rnd(0.05, 0.12), b: big ? 0.12 : rnd(0.025, 0.05), k: big ? 'dark' : 'white', seed: rnd(0, 200) });
    }
    for (const q of s.st) q.sp = s.SPD[clamp(((q.lat / Math.PI + 0.5) * 511) | 0, 0, 511)];
    s.lat = new Float32Array(n); s.lon = new Float32Array(n); s.dif = new Float32Array(n); s.msk = new Uint8Array(n);
    s.cx = cols * p.px; s.cy = rows * 0.5;
    s.Rp = Math.min(p.R * rows * aspect, cols * 0.45);
    let lx = p.lx, ly = p.ly, lz = p.lz;
    const ll = Math.hypot(lx, ly, lz);
    lx /= ll; ly /= ll; lz /= ll;
    s.L = [lx, ly, lz];
    if (p.view === 'sphere' || p.view === 'pole') {
      // 自轉軸
      let ax, ay, az;
      if (p.view === 'pole') { ax = 0; ay = 0.32; az = 0.95; } else { ax = Math.sin(p.tilt); ay = Math.cos(p.tilt) * 0.97; az = 0.24; }
      const al = Math.hypot(ax, ay, az);
      ax /= al; ay /= al; az /= al;
      let e1x = ay, e1y = -ax, e1z = 0;
      const el = Math.hypot(e1x, e1y) || 1;
      e1x /= el; e1y /= el;
      const e2x = ay * e1z - az * e1y, e2y = az * e1x - ax * e1z, e2z = ax * e1y - ay * e1x;
      const Rp = s.Rp;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x, X = (x + 0.5 - s.cx) / Rp, Y = (-(y + 0.5 - s.cy) * aspect) / Rp, d2 = X * X + Y * Y;
        if (d2 >= 1) { if (d2 < 1.2) { s.msk[i] = 2; s.dif[i] = (1.2 - d2) / 0.2; s.lat[i] = Math.max(0, (X * lx - Y * ly) / Math.sqrt(d2)); } continue; }
        const Z = Math.sqrt(1 - d2);
        s.msk[i] = 1;
        s.lat[i] = Math.asin(clamp(X * ax + Y * ay + Z * az, -1, 1));
        s.lon[i] = Math.atan2(X * e2x + Y * e2y + Z * e2z, X * e1x + Y * e1y + Z * e1z);
        const dd = X * lx - Y * ly + Z * lz;
        s.dif[i] = dd;
      }
    } else if (p.view === 'horizon') {
      // 透視：相機在雲頂上方
      const h = 0.45, Cy = 1 + h, pitch = 0.95, fy = 0.5, fx = (fy * cols) / (rows * aspect);
      const fwd = [0, -Math.sin(pitch), Math.cos(pitch)], up = [0, Math.cos(pitch), Math.sin(pitch)];
      let px0 = 0.55, py0 = 0.35, pz0 = 0.76;
      const pl = Math.hypot(px0, py0, pz0);
      px0 /= pl; py0 /= pl; pz0 /= pl;
      let q1x = py0, q1y = -px0, q1z = 0;
      const ql = Math.hypot(q1x, q1y);
      q1x /= ql; q1y /= ql;
      const q2x = py0 * q1z - pz0 * q1y, q2y = pz0 * q1x - px0 * q1z, q2z = px0 * q1y - py0 * q1x;
      s.hz = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x, sx = ((x + 0.5) / cols - 0.5) * 2 * fx, sy = -((y + 0.5) / rows - 0.5) * 2 * fy;
        let dx = sx, dy = fwd[1] + sy * up[1], dz = fwd[2] + sy * up[2];
        const dl = Math.hypot(dx, dy, dz);
        dx /= dl; dy /= dl; dz /= dl;
        const b = Cy * dy, c = Cy * Cy - 1, disc = b * b - c;
        if (disc <= 0 || -b - Math.sqrt(disc) <= 0) {
          const closest = Math.sqrt(Math.max(0, Cy * Cy - b * b));
          if (closest < 1.03) { s.msk[i] = 2; s.dif[i] = 1 - (closest - 1) / 0.03; s.lat[i] = 0.6; }
          continue;
        }
        const tt = -b - Math.sqrt(disc), Px = tt * dx, Py = Cy + tt * dy, Pz = tt * dz;
        s.msk[i] = 1;
        s.lat[i] = Math.asin(clamp(Px * px0 + Py * py0 + Pz * pz0, -1, 1));
        s.lon[i] = Math.atan2(Px * q2x + Py * q2y + Pz * q2z, Px * q1x + Py * q1y + Pz * q1z);
        s.dif[i] = clamp(0.25 + 0.85 * (Px * -0.45 + Py * 0.75 + Pz * 0.5), 0.05, 1) * (0.55 + 0.45 * Math.sqrt(Math.max(0, -(Px * dx + (Py) * dy + Pz * dz))));
      }
    } else {
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        s.msk[i] = 1; s.lat[i] = ((y + 0.5) / rows - 0.5) * Math.PI * 0.92; s.lon[i] = ((x + 0.5) / cols) * TAU * 1.5; s.dif[i] = 1;
      }
    }
    s.tail = [];
    s.flashes = [];
    s.mo = [];
    for (let k = 0; k < p.moons; k++) s.mo.push({ r: rnd(1.25, 1.7) + k * 0.25, ph: rnd(0, TAU), sp: rnd(0.08, 0.16) * (k % 2 ? 1 : 0.8), sz: rnd(0.035, 0.06), c: pick([[210, 200, 180], [180, 176, 170], [236, 210, 120]]) });
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.6);
    s.G = GLOOK[f.p.look];
    s.Psun = pal(f, h, [[120, 40, 0], [255, 140, 40], [255, 220, 140], [255, 255, 235]], 0.35, 1);
    s.Pt = pal(f, h, [[80, 30, 10], [255, 120, 40], [255, 220, 160]], 0.15, 0.7);
    const G = s.G, mx = (c, k) => mixc(c, G.st, k);
    s.GP = mixPal(f, h, G.b, G.z, 8, 0.2, 1.05, 0.06, 0.98);
    s.GS = mixPal(f, h, mx(G.b, 0.7), mx(G.z, 0.7), 8, 0.2, 1.05, 0.06, 0.98);
    s.GH1 = mixPal(f, h, [60, 90, 110], [170, 200, 190], 8, 0.2, 1.05, 0.06, 0.98);
    s.GH2 = mixPal(f, h, [40, 80, 110], [120, 170, 190], 8, 0.2, 1.05, 0.06, 0.98);
    s.GN = pal(f, h, [[190 * 0.2, 50 * 0.2, 20 * 0.2], [200, 52, 21]], 0.06, 0.98, 32);
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, dt, p } = f, ch = g.ch, co = g.co, hue = s.hue, n = cols * rows;
    const G = s.G, BAND = s.BAND, SPD = s.SPD, lat = s.lat, lon = s.lon, dif = s.dif, msk = s.msk, st = s.st;
    if (hue) f.bg = p.look === 'hot' ? rgb(10, 4, 4) : rgb(2, 3, 9);
    const rot = p.view === 'map' ? t * 0.05 : t * 0.07, turb = p.turb, view = p.view, hot = p.look === 'hot', hex = p.hex;
    const night = hot ? 0.12 : 0;
    if (hot) sunGlow(f, -s.Rp * 0.55, rows * 0.5, s.Rp * 1.05, s.Psun, 9, 2.1);
    // 雷光（只在夜面、偶爾、很小）
    if (p.flash) {
      if (Math.random() < dt * 0.7) {
        for (let tries = 0; tries < 30; tries++) {
          const i = rint(0, n - 1);
          if (msk[i] === 1 && dif[i] < -0.05) { s.flashes.push({ x: i % cols, y: (i / cols) | 0, life: 0.25 }); break; }
        }
      }
      for (const q of s.flashes) q.life -= dt;
      s.flashes = s.flashes.filter(q => q.life > 0);
    }
    for (let i = 0; i < n; i++) {
      const m = msk[i];
      if (!m) continue;
      if (m === 2) {
        const gl = dif[i] * (view === 'horizon' ? 0.85 : 0.25 + 0.6 * lat[i]);
        if (gl < 0.08) continue;
        ch[i] = gl > 0.6 ? ':' : '.';
        co[i] = hue ? shade(view === 'horizon' ? [150, 190, 255] : G.z, 0.15 + gl * 0.7) : f.C(0.1 + gl * 0.6);
        continue;
      }
      const la = lat[i], lo = lon[i];
      const bi = ((la / Math.PI + 0.5) * 511) | 0, sp = SPD[bi];
      const L = lo + rot + t * sp, tu = (L / TAU) * 512;
      let v, reg = 0;
      if (hex) {
        const cl = Math.PI / 2 - la, ang = lo + rot;
        const sec = Math.PI / 3, a6 = ((((ang % sec) + sec) % sec) - sec / 2);
        const hr = 0.36 / Math.cos(a6), dh = Math.abs(cl - hr);
        const w = nz(tu * 1.5, cl * 90 - t * 2) - 0.5;
        if (cl < hr - 0.03) {
          const sw = nz((ang / TAU) * 512 * 2 + Math.log(cl + 0.02) * 60 - t * 6, cl * 30);
          v = 0.35 + 0.5 * sw * smooth(cl / 0.08);
          reg = 1;
        } else if (dh < 0.05) { v = 0.2 + w * 0.3; reg = 2; }
        else v = BAND[clamp(((la + w * 0.03) / Math.PI + 0.5) * 511, 0, 511) | 0] + w * 0.3;
      } else {
        const w = nz(tu * 0.5 + 13, la * 40 + t * 0.3) - 0.5;
        const la2 = la + w * 0.09 * turb;
        v = BAND[clamp(((la2 / Math.PI + 0.5) * 511) | 0, 0, 511)];
        v += (nz(tu * 2 + w * 30, la * 170) - 0.5) * 0.35 * turb;
      }
      let sw = 0;
      for (let k = 0; k < st.length; k++) {
        const q = st[k], dl = la - q.lat;
        if (dl > q.b * 1.7 || dl < -q.b * 1.7) continue;
        const dlo = wrapA(lo + rot + t * q.sp - q.L0) * Math.cos(q.lat);
        if (dlo > q.a * 1.7 || dlo < -q.a * 1.7) continue;
        const ex = dlo / q.a, ey = dl / q.b, e = ex * ex + ey * ey;
        if (e > 2.6) continue;
        if (e < 1) {
          const th = (1 - e) * (1 - e) * 4 + t * 0.6, cs = Math.cos(th), sn = Math.sin(th);
          const rx = ex * cs - ey * sn, ry = ex * sn + ey * cs;
          const swirl = nz(rx * 18 + q.seed, ry * 18 + 40);
          const wgt = Math.sqrt(1 - e);
          if (q.k === 'red') { v = lerp(v, 0.35 + swirl * 0.45, wgt); sw = wgt; }
          else if (q.k === 'dark') { v = lerp(v, 0.06 + swirl * 0.2, wgt); sw = -wgt; }
          else { v = lerp(v, 0.85 + swirl * 0.2, wgt); sw = 0; }
        } else v = lerp(v, q.k === 'dark' ? 1 : 0.95, (1 - (e - 1) / 1.6) * (q.k === 'dark' ? 0.5 : 0.35));
      }
      v = clamp(v, 0, 1);
      let d = dif[i], b;
      if (view === 'map' || view === 'horizon') b = d * (0.4 + 0.6 * v);
      else {
        const lit = d > 0 ? Math.pow(d, 0.8) : 0;
        b = lit * (0.45 + 0.55 * v);
        if (hot) b = Math.max(b, night * (0.4 + 0.6 * nz(tu * 0.6, la * 30)) * (1 - lit));
        if (p.lz < 0 && d > -0.25) b = Math.max(b, (1 - Math.abs(d + 0.05) / 0.2) * 0.25);
      }
      if (b < 0.035) {
        if (view === 'sphere' || view === 'pole') {
          if (p.lz < 0) { ch[i] = '█'; co[i] = hue ? rgb(5, 5, 10) : f.C(0); }
          else { ch[i] = '.'; co[i] = hue ? shade(G.b, 0.12) : f.C(0.04); }
        }
        continue;
      }
      ch[i] = R10[Math.max(1, Math.min(9, (b * 9.6) | 0))];
      if (hue) {
        if (hot && d < 0.1) co[i] = pc(s.GN, b);
        else co[i] = mp(reg === 1 ? s.GH1 : reg === 2 ? s.GH2 : Math.abs(sw) > 0.35 ? s.GS : s.GP, v, b);
      } else co[i] = f.C(0.06 + 0.92 * b);
    }
    for (const q of s.flashes) {
      const k = q.life / 0.25;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = q.x + dx, y = q.y + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows || msk[y * cols + x] !== 1) continue;
        const r = Math.hypot(dx, dy * 2) / 2.5;
        if (r > 1) continue;
        g.set(x, y, r < 0.4 ? '*' : '+', hue ? shd(200, 220, 255, (1 - r) * k + 0.2) : f.C(0.4 + 0.6 * k * (1 - r)));
      }
    }
    // 大氣逸散的尾巴（熱木星）
    if (p.tail) {
      const Rp = s.Rp;
      for (let k = 0; k < 6; k++) {
        const a = rnd(-1.3, 1.3);
        s.tail.push({ x: s.cx + Rp * Math.cos(a) * 1.02, y: s.cy - (Rp * Math.sin(a)) / aspect, vx: rnd(4, 9), vy: rnd(-1, 1) - Math.sin(a) * 1.5, life: rnd(4, 8) });
      }
      for (let k = s.tail.length - 1; k >= 0; k--) {
        const q = s.tail[k];
        q.life -= dt; q.vx += dt * 3; q.x += q.vx * dt; q.y += (q.vy * dt) / aspect + Math.sin(t + q.x * 0.05) * dt * 0.3;
        if (q.life <= 0 || q.x >= cols) { kill(s.tail, k); continue; }
        const i = (q.y | 0) * cols + (q.x | 0);
        if (q.y < 0 || q.y >= rows || ch[i] !== ' ') continue;
        const v = Math.min(1, q.life / 6);
        ch[i] = v > 0.6 ? ':' : '.'; co[i] = pc(s.Pt, v);
      }
    }
    // 衛星
    if (view === 'sphere' || view === 'pole') {
      const Rp = s.Rp, [lx, ly, lz] = s.L;
      for (const m of s.mo) {
        const a = m.ph + t * m.sp, mx = s.cx + Math.cos(a) * m.r * Rp, my = s.cy + (Math.sin(a) * m.r * Rp * 0.12) / aspect;
        const behind = Math.sin(a) < 0 && Math.abs(mx - s.cx) < Rp;
        if (behind) continue;
        ball(f, hue, mx, my, Math.max(0.8, m.sz * Rp), lx, ly, lz, m.c);
      }
    } else if (view === 'horizon') {
      const [mx1, my1] = [cols * 0.72, rows * 0.12], [mx2, my2] = [cols * 0.28, rows * 0.2];
      ball(f, hue, mx1 + Math.sin(t * 0.02) * 3, my1, Math.max(1, rows * aspect * 0.05), -0.8, 0.2, 0.4, [220, 210, 190]);
      if (s.mo.length > 1) ball(f, hue, (((mx2 - t * 0.15) % cols) + cols) % cols, my2, Math.max(0.8, rows * aspect * 0.025), -0.8, 0.2, 0.4, [236, 210, 120]);
    }
    if (view !== 'map') drawStars(f, s.stars, s.Ps);
  },
});

/* ═════════ 4. 黑洞 ═════════ */
// 整數雜湊 → 0–1
const hash2 = (x, y) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const HOT = [[30, 4, 0], [150, 30, 4], [240, 100, 20], [255, 180, 80], [255, 236, 190], [255, 255, 255]];
A({ id: 'sp-blackhole', name: '黑洞', cat: '太空', theme: 'fire', hue: true, desc: '吸積盤繞著事件視界，光線被彎折成拱',
  params: { mode: 'disk', open: 0.14, rs: 0.17, roll: 0 },
  variants: [
    { id: 'tilted', name: '斜望', desc: '從較高角度俯看傾斜的吸積盤', params: { open: 0.42, rs: 0.14 } },
    { id: 'face', name: '正面漩渦', desc: '正對吸積盤，螺旋氣流捲進黑洞', params: { mode: 'face', open: 1, rs: 0.13 } },
    { id: 'lens', name: '重力透鏡', desc: '背景星空被扭曲成愛因斯坦環', params: { mode: 'lens', rs: 0.12 } },
    { id: 'tde', name: '潮汐撕裂', desc: '恆星靠近黑洞被拉成細長氣流', params: { mode: 'tde', rs: 0.06 } },
    { id: 'jets', name: '相對論噴流', desc: '類星體從兩極噴出高速電漿', params: { mode: 'jets', open: 0.2, rs: 0.07, roll: 0.42 } },
    { id: 'merge', name: '雙洞合併', desc: '兩個黑洞旋近合併，時空網格起漣漪', params: { mode: 'merge', rs: 0.05 } },
    { id: 'infall', name: '墜落旋流', desc: '無數氣團拖著尾巴盤旋墜入', params: { mode: 'infall', rs: 0.09, open: 0.7 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f, n = cols * rows;
    s.key = null;
    s.cx = cols / 2; s.cy = rows / 2;
    s.rs = Math.max(2, p.rs * rows * aspect);
    s.stars = [];
    for (let k = 0, N = Math.max(40, (n / 30) | 0); k < N; k++) s.stars.push([rnd(-1, 1), rnd(-1, 1), Math.pow(Math.random(), 2.5), rnd(0, TAU)]);
    s.B = new Float32Array(n); s.Bc = new Float32Array(n);
    s.P = []; s.T = 0; s.phase = 0; s.flare = 0; s.age = 0;
    if (p.mode === 'tde') this.tdeReset(s, f);
    if (p.mode === 'merge') { s.mt = 0; }
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ph = pal(f, h, HOT, 0.05, 1, 64);
    s.Ps = pal(f, h, STAR_STOPS, 0.1, 0.7);
    s.Pb = pal(f, h, [[10, 20, 60], [60, 90, 200], [160, 200, 255], [255, 255, 255]], 0.05, 0.9);
    s.Pg = pal(f, h, [[20, 24, 50], [70, 80, 140], [150, 170, 230]], 0.08, 0.5);
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const m = f.p.mode;
    if (s.hue) f.bg = rgb(0, 0, 0);
    s.T += f.dt;
    if (m === 'disk' || m === 'face' || m === 'jets') this.frameDisk(s, f);
    else if (m === 'lens') this.frameLens(s, f);
    else if (m === 'tde' || m === 'infall') this.framePart(s, f);
    else this.frameMerge(s, f);
  },
  // 背景星（含簡單透鏡位移）
  lensStars(s, f, thE, drift) {
    const { g, cols, rows, aspect, t } = f, cx = s.cx, cy = s.cy, ch = g.ch, co = g.co, W = cols * 0.55, Hh = (rows * aspect) * 0.55;
    for (const st of s.stars) {
      let bx = st[0] * W + drift, by = st[1] * Hh;
      bx = ((bx + W) % (2 * W) + 2 * W) % (2 * W) - W;
      const b = Math.hypot(bx, by) || 0.01;
      for (const sg of [1, -1]) {
        const th = (b + sg * Math.sqrt(b * b + 4 * thE * thE)) / 2;
        if (Math.abs(th) < s.rs * 1.05) continue;
        const x = cx + (bx / b) * th, y = cy - ((by / b) * th) / aspect;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = (y | 0) * cols + (x | 0);
        if (ch[i] !== ' ') continue;
        const mag = Math.min(2.5, 1 + (thE * thE) / (Math.abs(th - thE) * thE + 1e-3) * 0.08), v = st[2] * mag * (sg < 0 ? 0.45 : 1) * (0.75 + 0.25 * Math.sin(t * 1.3 + st[3]));
        if (v < 0.04) continue;
        ch[i] = v > 0.75 ? '*' : v > 0.45 ? '+' : v > 0.2 ? '·' : '.';
        co[i] = pc(s.Ps, v);
      }
    }
  },
  frameDisk(s, f) {
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, Ph = s.Ph, hue = s.hue;
    const cx = s.cx, cy = s.cy, rs = s.rs, face = p.mode === 'face', jets = p.mode === 'jets';
    const o = p.open, rin = rs * 1.55, rout = face ? cols * 0.75 : cols * 0.47, rph = rs * 1.035;
    const cR = Math.cos(p.roll), sR = Math.sin(p.roll);
    const yB = face || jets ? rows : Math.min(rows, Math.ceil((rout * o + rs * 2.4) / aspect) + 1);
    const y0 = Math.max(0, Math.floor(cy - yB)), y1 = Math.min(rows - 1, Math.ceil(cy + yB));
    for (let y = y0; y <= y1; y++) {
      const Y0 = -(y + 0.5 - cy) * aspect;
      for (let x = 0; x < cols; x++) {
        const X0 = x + 0.5 - cx, X = X0 * cR + Y0 * sR, Y = -X0 * sR + Y0 * cR;
        const b = Math.sqrt(X * X + Y * Y), i = y * cols + x;
        let I = 0, heat = 0;
        // 主影像（盤面）
        const w = Y / o, r = Math.sqrt(X * X + w * w);
        if (r > rin * 0.92 && r < rout && (w < 0 || b > rs * 1.02 || face)) {
          const az = Math.atan2(w, X), om = Math.pow(rin / r, 1.5);
          let tx = (az / TAU) * 256 - t * om * 9;
          if (face) tx += Math.log(r / rin) * 34;
          const tu = nz(tx, (r / rout) * (face ? 90 : 140)), tv = face ? 0.45 + 0.1 * tu : nz(tx * 2 + 50, (r / rout) * 300);
          const em = smooth((r - rin * 0.92) / (rin * 0.35)) * Math.pow(rin / r, face ? 0.9 : 1.15);
          const dop = face ? 1 : 1 + 0.6 * (-X / r) * Math.sqrt(rin / r);
          I = em * dop * (0.35 + 0.9 * tu * tu + 0.35 * tv) * (face ? 1 : 1.1) * (1 - smooth((r - rout * 0.75) / (rout * 0.25)));
          heat = em;
        }
        // 繞過頭頂／底下的透鏡像
        if (b > rs * 1.0 && b < rs * 2.6) {
          const sn = Y / (b || 1);
          const H = face ? rs * 0.32 : rs * (0.16 + 0.55 * Math.max(0, sn) + 0.08 * Math.max(0, -sn));
          const q = (b - rph) / H;
          if (q > 0 && q < 1) {
            const rr = rin * (1 + q * 1.4), az = Math.atan2(Y, X);
            const tu = nz((az / TAU) * 256 - t * Math.pow(rin / rr, 1.5) * 9, (rr / rout) * 140);
            const dop = face ? 1 : 1 - 0.45 * (X / b);
            const Ih = (1 - q) * (0.6 + 0.7 * tu) * dop * (face ? 0.7 : 0.95);
            if (Ih > I && (w > 0 || b > rs * 1.15 || face)) { I = Math.max(I, Ih); heat = Math.max(heat, 1 - q); }
          }
        }
        // 光子環
        const pr = Math.abs(b - rph);
        if (pr < 1.4) { const v = (1 - pr / 1.4) * 0.9; if (v > I) { I = v; heat = 1; } }
        if (b < rs && !(w < 0 && r > rin * 0.92 && r < rout && I > 0.05 && !face)) { if (I < 0.05) continue; }
        // 噴流
        if (jets) {
          const a = Math.abs(Y), side = Y > 0 ? 1 : -1;
          if (a > rs * 0.8) {
            const wj = rs * 0.18 + a * 0.05, dj = X / wj;
            const knot = 0.45 + 0.75 * nz(a * 0.12 - t * 9 * side, side * 40 + 7);
            let J = Math.exp(-dj * dj) * knot * (side > 0 ? 1 : 0.55) * Math.min(1, rs * 6 / a + 0.25);
            const lob = Math.max(cols, rows * aspect) * 0.42, dl = (a - lob) / (lob * 0.22);
            if (dl > -1.6) { const lx = X / (lob * 0.25); const L = Math.max(0, 1 - (dl * dl + lx * lx)) * (0.4 + 0.8 * nz(X * 0.15 + side * 30, a * 0.1 + t * 0.6)); J = Math.max(J, L * 0.7); }
            if (J > I) { I = J; heat = -1; }
          }
        }
        if (I < 0.05) continue;
        I = Math.min(1, I);
        ch[i] = R10[Math.max(1, Math.min(9, (I * 9.5) | 0))];
        co[i] = heat < 0 ? pc(s.Pb, I) : pc(Ph, I * (0.55 + 0.45 * Math.min(1, heat + 0.3)));
      }
    }
    this.lensStars(s, f, rs * 1.6, t * (face ? 1.5 : 2.5));
  },
  frameLens(s, f) {
    const { g, cols, rows, aspect, t } = f, ch = g.ch, co = g.co, hue = s.hue;
    const cx = s.cx, cy = s.cy, rs = s.rs, thE = rs * 2.1, thE2 = thE * thE;
    const gx = Math.sin(t * 0.045) * cols * 0.45, gy = Math.cos(t * 0.033) * rows * aspect * 0.08, gs = rows * aspect * 0.1;
    const dx = t * 3.5;
    for (let y = 0; y < rows; y++) {
      const Y = -(y + 0.5 - cy) * aspect;
      for (let x = 0; x < cols; x++) {
        const X = x + 0.5 - cx, b2 = X * X + Y * Y, i = y * cols + x;
        if (b2 < rs * rs) continue;
        const k = 1 - thE2 / b2, BX = X * k, BY = Y * k;
        // 光子環
        const b = Math.sqrt(b2), pr = Math.abs(b - rs * 1.05);
        let v = 0, c = 0;
        // 背景星雲
        const ux = (BX + dx) * 0.35, uy = BY * 0.35;
        const neb = nz(ux, uy) * 0.7 + nz(ux * 3 + 40, uy * 3) * 0.3;
        const nv = Math.max(0, neb - 0.55) * 1.6;
        if (nv > v) { v = nv; c = 1; }
        // 背景星系（滑過時形成愛因斯坦環）
        const ex = (BX - gx) / gs, ey = (BY - gy) / (gs * 0.6), ge = Math.exp(-(ex * ex + ey * ey) * 1.2) * 1.1;
        if (ge > v) { v = ge; c = 2; }
        // 背景星（雜湊）
        const sx = Math.floor(BX + dx + 10000), sy = Math.floor(BY / aspect + 10000), hh = hash2(sx, sy);
        if (hh < 0.012) { const sv = 0.4 + hh * 50; if (sv > v) { v = sv; c = 3; } }
        if (pr < 1.5) { const pv = (1 - pr / 1.5) * 0.85; if (pv > v) { v = pv; c = 2; } }
        if (v < 0.06) continue;
        v = Math.min(1, v);
        if (c === 3) { ch[i] = v > 0.8 ? '*' : v > 0.6 ? '+' : '·'; co[i] = pc(s.Ps, v); }
        else { ch[i] = R10[Math.max(1, Math.min(9, (v * 9.4) | 0))]; co[i] = c === 2 ? pc(s.Ph, 0.3 + v * 0.7) : pc(s.Pg, v); }
      }
    }
  },
  // ── 粒子：潮汐撕裂／墜落旋流 ──
  tdeReset(s, f) {
    const { cols, rows, aspect } = f, rs = s.rs, GM = Math.pow(rows * aspect * 0.3, 3) * 1.1;
    s.GM = GM; s.P = []; s.B.fill(0);
    const rp = rs * 3.2, r0 = cols * 0.42;
    for (let k = 0; k < 260; k++) { const a = rnd(0, TAU), r = rs * rnd(2, 5.5), vc = Math.sqrt(GM / r); s.P.push({ x: r * Math.cos(a), y: r * Math.sin(a), vx: -vc * Math.sin(a), vy: vc * Math.cos(a), h: 0, d: 0 }); }
    // 拋物線軌道：起點在左上方
    const ang = rnd(2.1, 2.6), v0 = Math.sqrt((2 * GM) / r0);
    const lAng = Math.sqrt(2 * GM * rp), vt = lAng / r0, vr = -Math.sqrt(Math.max(0, v0 * v0 - vt * vt));
    s.star = { x: r0 * Math.cos(ang), y: r0 * Math.sin(ang), vx: vr * Math.cos(ang) - vt * Math.sin(ang), vy: vr * Math.sin(ang) + vt * Math.cos(ang), alive: 1 };
    s.flare = 0; s.age = 0;
  },
  framePart(s, f) {
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, B = s.B, Bc = s.Bc, n = cols * rows;
    const cx = s.cx, cy = s.cy, rs = s.rs, tde = p.mode === 'tde', o = tde ? 0.55 : p.open;
    const dt = Math.min(f.dt, 0.05), GM = s.GM || (s.GM = Math.pow(rows * aspect * 0.3, 3) * 0.35), eps = rs * 0.6;
    const dec = Math.exp(-dt * (tde ? 1.6 : 3.2));
    for (let i = 0; i < n; i++) { B[i] *= dec; }
    s.age = (s.age || 0) + dt;
    if (tde) {
      const S = s.star;
      if (S.alive) {
        for (let k = 0; k < 6; k++) {
          const h = dt / 6, r = Math.hypot(S.x, S.y), a = -GM / (r * r * r);
          S.vx += S.x * a * h; S.vy += S.y * a * h; S.x += S.vx * h; S.y += S.vy * h;
        }
        const r = Math.hypot(S.x, S.y);
        if (r < rs * 7) {
          S.alive = 0;
          const N = Math.min(1600, Math.max(400, (n / 18) | 0));
          for (let k = 0; k < N; k++) {
            const ox = gauss() * rs * 0.5, oy = gauss() * rs * 0.5, rr = Math.hypot(S.x, S.y), ux = S.x / rr, uy = S.y / rr;
            const sp = (ox * ux + oy * uy) / (rs * 0.5);
            s.P.push({ x: S.x + ox, y: S.y + oy, vx: S.vx * (1 + sp * 0.12), vy: S.vy * (1 + sp * 0.12), h: Math.random(), d: 1 });
          }
        }
      }
      if (s.age > 42 || (!S.alive && s.P.length < 20)) this.tdeReset(s, f);
    } else {
      const want = Math.min(2200, (n / 10) | 0);
      for (let k = 0; k < 12 && s.P.length < want; k++) {
        const a = (k % 3) * TAU / 3 + s.age * 0.07 + gauss() * 0.06, r = rnd(0.88, 1) * cols * 0.5, vc = Math.sqrt(GM / r);
        s.P.push({ x: r * Math.cos(a), y: r * Math.sin(a), vx: -vc * Math.sin(a) * 0.9, vy: vc * Math.cos(a) * 0.9, h: Math.random(), d: 1 });
      }
    }
    const P = s.P;
    for (let k = P.length - 1; k >= 0; k--) {
      const q = P[k];
      const sub = 3;
      let ox = cx + q.x, oy = cy - (q.y * o) / aspect;
      for (let j = 0; j < sub; j++) {
        const h = dt / sub, r2 = q.x * q.x + q.y * q.y + eps * eps, r = Math.sqrt(r2), a = -GM / (r2 * r);
        q.vx += q.x * a * h; q.vy += q.y * a * h;
        const damp = q.d * (tde ? (r < rs * 9 ? 0.25 : 0.02) : 0.2);
        q.vx *= 1 - damp * h; q.vy *= 1 - damp * h;
        q.x += q.vx * h; q.y += q.vy * h;
      }
      const r = Math.hypot(q.x, q.y);
      if (r < rs * 1.1 || r > cols * 1.5) { if (r < rs * 1.1) s.flare = Math.min(1, s.flare + (tde ? 0.004 : 0.0012)); kill(P, k); continue; }
      const sx = cx + q.x, sy = cy - (q.y * o) / aspect;
      const sp = Math.min(1, Math.hypot(q.vx, q.vy) / Math.sqrt(GM / (rs * 3)));
      const nn = Math.ceil(Math.max(Math.abs(sx - ox), Math.abs(sy - oy)));
      for (let j = 0; j <= nn; j++) {
        const xx = ox + ((sx - ox) * j) / (nn || 1), yy = oy + ((sy - oy) * j) / (nn || 1);
        if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
        const i = (yy | 0) * cols + (xx | 0);
        B[i] = Math.min(4, B[i] + (tde ? 0.07 : 0.06)); Bc[i] = sp;
      }
    }
    s.flare *= Math.exp(-dt * 0.8);
    // 盤＋影子＋光子環
    for (let y = 0; y < rows; y++) {
      const Y = -(y + 0.5 - cy) * aspect;
      for (let x = 0; x < cols; x++) {
        const X = x + 0.5 - cx, i = y * cols + x, bb = Math.sqrt(X * X + Y * Y);
        let v = 1 - Math.exp(-B[i] * 1.1), c = Bc[i];
        if (bb < rs) { if (Y / o > 0 || v < 0.1) continue; }
        const pr = Math.abs(bb - rs * 1.04);
        if (pr < 1.3) { const pv = (1 - pr / 1.3) * (0.55 + s.flare * 0.4); if (pv > v) { v = pv; c = 1; } }
        const gR = tde ? rs * 5 : rs * 2.6;
        if (bb < gR && bb > rs) { const gl = (1 - bb / gR) * s.flare * 0.8; if (gl > v) { v = gl; c = 0.8; } }
        if (v < 0.06) continue;
        v = Math.min(1, v);
        ch[i] = R10[Math.max(1, Math.min(9, (v * 9.4) | 0))];
        co[i] = pc(s.Ph, v * (0.45 + 0.55 * c));
      }
    }
    if (tde && s.star.alive) {
      const S = s.star, sx = cx + S.x, sy = cy - (S.y * o) / aspect, r = Math.hypot(S.x, S.y), st = 1 + Math.max(0, (rs * 14 - r) / (rs * 7)) * 0.8;
      const rr = Math.max(1.2, rs * 0.55);
      for (let y = Math.floor(sy - rr); y <= sy + rr; y++) for (let x = Math.floor(sx - rr * st); x <= sx + rr * st; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const ux = (x + 0.5 - sx) / (rr * st), uy = ((y + 0.5 - sy) * aspect) / rr, d = ux * ux + uy * uy;
        if (d > 1) continue;
        g.set(x, y, d < 0.4 ? '@' : d < 0.75 ? '#' : '*', hue ? rgb(255, 245, 210) : f.C(0.95));
      }
    }
    this.lensStars(s, f, rs * 1.6, t * 1.2);
  },
  // ── 雙黑洞合併 ──
  frameMerge(s, f) {
    const { g, cols, rows, aspect, t, dt } = f, ch = g.ch, co = g.co, hue = s.hue, cx = s.cx, cy = s.cy;
    const TM = 26, TR = 10;
    s.mt += dt;
    if (s.mt > TM + TR) s.mt = 0;
    const mt = s.mt, rs0 = s.rs;
    const pre = mt < TM, tau = Math.min(1, mt / TM);
    const d = pre ? rows * aspect * 0.32 * Math.pow(1 - tau * 0.985, 0.25) : 0;
    const phase = pre ? (1 - Math.pow(1 - tau * 0.985, 0.625)) * 160 : 0;
    const Om = pre ? Math.pow(rows * aspect * 0.32 / Math.max(d, 1), 1.5) * 0.35 : 0;
    const holes = pre ? [[d / 2 * Math.cos(phase), d / 2 * Math.sin(phase)], [-d / 2 * Math.cos(phase), -d / 2 * Math.sin(phase)]] : [[0, 0]];
    const rsH = pre ? rs0 : rs0 * 1.6;
    const ring = pre ? 0 : Math.exp(-(mt - TM) * 0.5);
    const amp = pre ? 0.6 + 4 * tau * tau : 5 * ring;
    const sp = Math.max(4, Math.round(cols / 28)), spy = Math.max(2, Math.round(sp / aspect));
    const kk = pre ? 0.05 + Om * 0.02 : 0.12;
    const ph2 = pre ? phase * 2 : (mt - TM) * 8;
    for (let y = 0; y < rows; y++) {
      const Y = -(y + 0.5 - cy) * aspect;
      for (let x = 0; x < cols; x++) {
        const X = x + 0.5 - cx, i = y * cols + x, r = Math.sqrt(X * X + Y * Y) + 1, a = Math.atan2(Y, X);
        const wv = (amp / Math.sqrt(r * 0.08 + 1)) * Math.cos(2 * a - ph2 + r * kk);
        let Xd = X + (X / r) * wv, Yd = Y + (Y / r) * wv;
        let near = 1e9;
        for (const hp of holes) {
          const hx = X - hp[0], hy = Y - hp[1], hd2 = hx * hx + hy * hy, hd = Math.sqrt(hd2);
          near = Math.min(near, hd);
          const pull = (rsH * rsH * 2.2) / (hd + 0.5);
          Xd -= (hx / (hd + 0.01)) * Math.min(pull, hd * 0.8); Yd -= (hy / (hd + 0.01)) * Math.min(pull, hd * 0.8);
        }
        if (near < rsH) continue;
        const pr = Math.abs(near - rsH * 1.08);
        if (pr < 1.5) { const v = (1 - pr / 1.5) * (0.6 + ring * 0.4); ch[i] = v > 0.5 ? '@' : '*'; co[i] = pc(s.Ph, 0.5 + v * 0.5); continue; }
        if (near < rsH * 2.2) { const v = (1 - (near - rsH) / (rsH * 1.2)) * 0.5; if (v > 0.08) { ch[i] = v > 0.3 ? '+' : ':'; co[i] = pc(s.Ph, 0.35 + v); continue; } }
        const gx = Xd / sp, gy = Yd / aspect / spy;
        const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy);
        const onX = fx < 0.16 || fx > 0.94, onY = fy < 0.34 || fy > 0.9;
        if (!onX && !onY) continue;
        const w = Math.min(1, Math.abs(wv) / 3);
        ch[i] = onX && onY ? '+' : onX ? '¦' : '-';
        if (onX && !onY) ch[i] = ':';
        co[i] = hue ? rgb(40 + 140 * w, 60 + 120 * w, 120 + 135 * w) : f.C(0.18 + 0.5 * w);
      }
    }
    if (cols >= 150) txt(g, 2, rows - 2, pre ? tr(f, '旋近中', 'Inspiral') : tr(f, '合併後振盪', 'Ringdown'), pc(s.Pg, 0.6));
  },
});

/* ═════════ 5. 星雲 ═════════ */
// 亮星加上十字繞射芒
function spikeStar(f, x, y, len, c, hue) {
  const { g } = f;
  const col = k => (hue ? shade(c, k) : f.C(0.2 + 0.8 * k));
  const ly = Math.max(1, Math.round(len / f.aspect));
  for (let k = 1; k <= len; k++) { const v = 1 - k / (len + 1); g.set(x - k, y, k < len * 0.5 ? '-' : '·', col(v)); g.set(x + k, y, k < len * 0.5 ? '-' : '·', col(v)); }
  for (let k = 1; k <= ly; k++) { const v = 1 - k / (ly + 1); g.set(x, y - k, '|', col(v)); g.set(x, y + k, '|', col(v)); }
  g.set(x, y, '✦', col(1));
}
A({ id: 'sp-nebula', name: '星雲', cat: '太空', theme: 'neon', hue: true, desc: '紅色氫氣與青色氧氣交織的發光雲氣',
  params: { mode: 'emit', drift: 1, scale: 1 },
  variants: [
    { id: 'pillars', name: '創生之柱', desc: '暗色塵埃柱被背後的光勾出亮邊', params: { mode: 'pillars' } },
    { id: 'ring', name: '環狀星雲', desc: '白矮星周圍一圈層層發光的殼', params: { mode: 'ring' } },
    { id: 'remnant', name: '超新星殘骸', desc: '爆炸後的纖維狀殼層不斷膨脹', params: { mode: 'remnant' } },
    { id: 'reflect', name: '反射星雲', desc: '藍色薄霧圍繞一群明亮的年輕星', params: { mode: 'reflect', drift: 0.5 } },
    { id: 'veil', name: '面紗星雲', desc: '纏繞飄動的細長發光絲縷', params: { mode: 'veil', drift: 1.4, scale: 0.8 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f;
    s.key = null;
    s.stars = mkStars(Math.max(30, (cols * rows / 30) | 0));
    s.big = [];
    const nb = p.mode === 'reflect' ? 7 : p.mode === 'dark' ? 3 : 5;
    for (let k = 0; k < nb; k++) {
      const cl = p.mode === 'reflect';
      s.big.push({ x: cl ? cols * (0.5 + gauss() * 0.12) : rnd(0.05, 0.95) * cols, y: cl ? rows * (0.5 + gauss() * 0.14) : rnd(0.1, 0.9) * rows, b: rnd(0.6, 1), c: starRGB(cl ? rnd(0.7, 1) : rnd(0.2, 1)) });
    }
    s.T = 0; s.hz = null; s.bd = null; s.dD = null;
    if (p.mode === 'dark') {
      // 暗星雲背後的濃密星場：每顆星有自己的浮點位置，平移時各自在不同時間跨格，不會整片一起跳
      const N = Math.ceil(cols * rows * 0.195), DS = new Float32Array(N * 3);
      for (let k = 0; k < N; k++) { DS[k * 3] = rnd(0, cols); DS[k * 3 + 1] = rint(0, rows - 1); DS[k * 3 + 2] = rnd(0, 0.195); }
      s.dstar = DS;
    }
    if (p.mode === 'pillars') {
      s.pil = [];
      const n = cols >= 70 ? 3 : 2;
      for (let k = 0; k < n; k++) s.pil.push({ bx: (n === 3 ? [0.22, 0.5, 0.76][k] : [0.3, 0.68][k]) * cols, w: cols * [0.075, 0.05, 0.06][k], top: rows * [0.18, 0.36, 0.52][k], lean: [0.12, -0.05, 0.08][k] * aspect, seed: k * 37 });
      // 柱子形狀固定，先算好每格的「邊緣亮度」（-1 = 柱外）與紋理
      s.pm = new Float32Array(cols * rows).fill(-1); s.pt = new Float32Array(cols * rows);
      for (let y = 0; y < rows; y++) for (const P of s.pil) {
        if (y < P.top) continue;
        const cap = rows * 0.12, fr = (y - P.top) / (rows - P.top);
        let hw = P.w * (0.55 + 0.5 * fr) * (0.8 + 0.45 * nz(y * 0.4 + P.seed, P.seed));
        if (y - P.top < cap) hw *= Math.sqrt(Math.max(0, (y - P.top) / cap));
        const xc = P.bx + (P.lean * (rows - y)) / aspect, up = y - P.top < cap * 1.4 ? 1 : 0.45;
        for (let x = Math.max(0, Math.floor(xc - hw)); x <= Math.min(cols - 1, Math.ceil(xc + hw)); x++) {
          const e = hw - Math.abs(x - xc), i = y * cols + x;
          if (e <= 0) continue;
          s.pm[i] = Math.max(s.pm[i], Math.exp(-e / 1.6) * up);
          s.pt[i] = nz(x * 0.45, y * 1.1);
        }
      }
    }
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.1, 0.8);
    // 兩種氣體顏色的混合，先做成 9 條調色盤（混合比例 0–1）
    const m = f.p.mode, HA = m === 'pillars' ? [240, 150, 70] : [255, 70, 110], O3 = m === 'pillars' ? [70, 190, 200] : [50, 200, 220];
    s.PE = [];
    for (let k = 0; k <= 8; k++) { const c = mixc(HA, O3, k / 8); s.PE.push(pal(f, h, [[c[0] * 0.18, c[1] * 0.18, c[2] * 0.18], [c[0] * 1.13, c[1] * 1.13, c[2] * 1.13]], 0.08, 0.98, 32)); }
    s.PR = pal(f, h, [[40 * 0.25, 70 * 0.25, 200 * 0.25], [60, 95, 220], [180, 210, 255]], 0.08, 0.98, 40);
    s.PRg = mixPal(f, h, [70, 200, 230], [255, 90, 60], 8, 0.2, 1.15, 0.08, 0.98);
    s.PRh = pal(f, h, [[190 * 0.2, 40 * 0.2, 70 * 0.2], [218, 46, 80]], 0.08, 0.98, 32);
    s.PRm = mixPal(f, h, [255, 80, 60], [150, 190, 255], 8, 0.2, 1.15, 0.08, 0.98);
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode;
    s.T += f.dt;
    if (hue) f.bg = m === 'reflect' ? rgb(2, 4, 14) : m === 'dark' ? rgb(2, 2, 6) : rgb(4, 2, 10);
    const k = ((100 / cols) * p.scale) * 0.9, dr = t * 0.9 * p.drift, ky = k * aspect;
    const cx = cols / 2, cy = rows / 2;
    if (m === 'emit' || m === 'veil' || m === 'pillars') {
      const veil = m === 'veil', pil = m === 'pillars';
      const HA = pil ? [240, 150, 70] : [255, 70, 110], O3 = pil ? [70, 190, 200] : [50, 200, 220];
      const hw2 = (cols >> 1) + 2;
      if (!s.ra || s.ra.length !== hw2) { s.ra = new Float32Array(hw2); s.rb = new Float32Array(hw2); }
      const RA = s.ra, RB = s.rb;
            for (let y = 0; y < rows; y++) {
        const v = (y - cy) * ky;
        // 半解析度計算雲氣（每兩欄算一次，中間內插）
        for (let xs = 0; xs < hw2; xs++) {
          const u = (xs * 2 - cx) * k + dr;
          const q1 = nz(u * 0.45 + 7, v * 0.45 + t * 0.04), q2 = nz(u * 0.45 + 61 - t * 0.03, v * 0.45 + 23);
          let a, b;
          if (veil) {
            a = Math.pow(rz(u * 0.6 + q1 * 34, v * 0.6 + q2 * 20), 7);
            b = Math.pow(rz(u * 0.6 + 47 + q2 * 30, v * 0.6 + 13 + q1 * 24), 7);
            a += Math.pow(rz(u * 1.4 + 90 + q2 * 20, v * 1.4 + q1 * 10), 9) * 0.6;
          } else {
            a = smooth((nz(u + q1 * 38, v + q2 * 38) - 0.4) / 0.5);
            b = smooth((nz(u * 1.25 + 101 + q2 * 30, v * 1.25 + 57 + q1 * 30) - 0.5) / 0.42);
          }
          const d = nz(u * 3 + 33, v * 3 + 77);
          const dust = veil || pil ? 0 : smooth((nz(u * 0.7 + 200, v * 0.7 + 5) - 0.6) / 0.16) * 0.85;
          RA[xs] = a * (0.65 + 0.6 * d) * (1 - dust); RB[xs] = b * (0.6 + 0.6 * d) * (1 - dust);
        }
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x, xs = x >> 1, fx = (x & 1) * 0.5;
          let A0 = RA[xs] + (RA[xs + 1] - RA[xs]) * fx, B0 = RB[xs] + (RB[xs + 1] - RB[xs]) * fx;
          if (pil) {
            A0 = A0 * 0.8 + 0.18 * (1 - y / rows); B0 = B0 * 0.9 + 0.25 * (y / rows);
            const pm = s.pm[i];
            if (pm >= 0) {
              const tx = s.pt[i], rim = pm > 0.05 ? pm * (0.6 + 0.6 * nz(x * 0.5, y * 0.9 + t * 0.3)) : 0;
              ch[i] = rim > 0.25 ? R10[Math.min(9, 3 + ((rim * 7) | 0))] : tx > 0.6 ? '%' : '#';
              co[i] = hue ? (rim > 0.25 ? shd(255, 170, 90, 0.3 + 0.8 * rim) : shd(60, 30, 24, 0.5 + tx)) : f.C(rim > 0.25 ? 0.3 + 0.7 * rim : 0.05 + 0.08 * tx);
              continue;
            }
          }
          let L = Math.max(A0, B0 * 0.95);
          if (L < 0.06) continue;
          L = Math.min(1, L);
          ch[i] = R10[Math.max(1, Math.min(9, (L * 9.6) | 0))];
          co[i] = pc(s.PE[Math.round((B0 / (A0 + B0 + 1e-6)) * 8)], L);
        }
      }
    } else if (m === 'ring' || m === 'remnant') {
      const rem = m === 'remnant', T = 46, ph = rem ? (s.T % T) / T : 0;
      const Rr = rem ? Math.min(cols * 0.46, rows * aspect * 0.62) * Math.pow(Math.max(0.001, ph), 0.45) : cols * 0.23 * (1 + 0.015 * Math.sin(t * 0.4));
      const ax = Rr, by = rem ? Rr : Rr * 0.74, rot = rem ? 0 : t * 0.012, cr = Math.cos(rot), sr = Math.sin(rot);
      const fade = rem ? (ph < 0.85 ? 1 : 1 - (ph - 0.85) / 0.15) : 1;
      const hw2 = (cols >> 1) + 2;
      if (!s.ra || s.ra.length !== hw2) { s.ra = new Float32Array(hw2); s.rb = new Float32Array(hw2); }
      const RA = s.ra, RB = s.rb;
      for (let y = 0; y < rows; y++) {
        const Y0 = (y + 0.5 - cy) * aspect;
        for (let xs = 0; xs < hw2; xs++) {
          const X0 = xs * 2 + 0.5 - cx, X = X0 * cr + Y0 * sr, Y = -X0 * sr + Y0 * cr;
          const rho = Math.sqrt((X / ax) ** 2 + (Y / by) ** 2);
          let L = 0, w = 0;
          if (rem) {
            if (rho < 1.12) {
              const ang = Math.atan2(Y, X);
              const fil = Math.pow(rz((ang / TAU) * 256 * 2, rho * 22 + ph * 6), 4) * (0.6 + 0.6 * nz((ang / TAU) * 256, 40));
              const sh = Math.exp(-(((rho - 1) / 0.07) ** 2));
              L = (sh * (0.4 + 0.9 * fil) + (rho < 1 ? 0.3 * fil * rho * rho + 0.1 * nz(X * 0.2, Y * 0.2) * rho : 0)) * fade;
              w = smooth((rho - 0.7) / 0.3);
            }
          } else if (rho < 2.1) {
            const ang = Math.atan2(Y, X);
            const fil = rz((ang / TAU) * 256 * 3, rho * 14 - t * 0.3);
            const sh = Math.exp(-(((rho - 1) / 0.2) ** 2)) * (0.55 + 0.6 * fil);
            const inner = rho < 0.95 ? 0.32 * (0.6 + 0.6 * nz(X * 0.12 + 40, Y * 0.12)) * smooth(rho / 0.5) : 0;
            const halo = rho > 1.15 ? Math.pow(rz((ang / TAU) * 256, rho * 6 + 9), 6) * 0.45 * (1 - (rho - 1.15) / 0.95) : 0;
            L = Math.max(sh, inner, halo);
            w = sh >= inner ? (halo > sh ? 1.2 : smooth((rho - 0.75) / 0.4)) : 0;
          }
          RA[xs] = L; RB[xs] = w;
        }
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x, xs = x >> 1, fx = (x & 1) * 0.5;
          let L = RA[xs] + (RA[xs + 1] - RA[xs]) * fx;
          if (L < 0.06) continue;
          const w = fx && Math.abs(RB[xs + 1] - RB[xs]) > 0.5 ? RB[xs] : RB[xs] + (RB[xs + 1] - RB[xs]) * fx;
          L = Math.min(1, L);
          ch[i] = R10[Math.max(1, Math.min(9, (L * 9.6) | 0))];
          co[i] = rem ? mp(s.PRm, w, L) : w > 1 ? pc(s.PRh, L) : mp(s.PRg, w, L);
        }
      }
      if (rem) {
        const fl = ph < 0.06 ? Math.sin((ph / 0.06) * Math.PI * 0.5) : Math.exp(-(ph - 0.06) * 25);
        const R = 1 + fl * rows * aspect * 0.12;
        sunGlow(f, cx, cy, Math.max(0.8, R * 0.4), pal(f, hue, [[120, 140, 255], [255, 255, 255]], 0.5, 1, 12), 0, 3);
        if (Math.sin(t * 6) > 0.6) g.set(cx, cy, '*', hue ? rgb(200, 220, 255) : f.C(1));
      } else {
        g.set(cx, cy, '@', hue ? rgb(230, 240, 255) : f.C(1));
        g.set(cx - 1, cy, '-', hue ? rgb(160, 180, 255) : f.C(0.7)); g.set(cx + 1, cy, '-', hue ? rgb(160, 180, 255) : f.C(0.7));
      }
    } else if (m === 'dark') {
      const hw2 = (cols >> 1) + 2, n = cols * rows;
      if (!s.ra || s.ra.length !== hw2) { s.ra = new Float32Array(hw2); s.rb = new Float32Array(hw2); }
      const RA = s.ra, RB = s.rb;
      if (!s.bd || s.bd.length !== n) { s.bd = new Float32Array(n); for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const b0 = (y - cy - (x - cx) * 0.18) / (rows * 0.32); s.bd[y * cols + x] = Math.exp(-b0 * b0); } }
      if (!s.dD || s.dD.length !== n) s.dD = new Float32Array(n);
      const BD = s.bd, DD = s.dD;
      for (let y = 0; y < rows; y++) {
        const v = (y - cy) * ky;
        for (let xs = 0; xs < hw2; xs++) {
          const u = (xs * 2 - cx) * k + dr * 0.6;
          RA[xs] = smooth((nz(u * 0.55, v * 0.55) * 0.68 + nz(u * 1.8 + 30, v * 1.8) * 0.32 - 0.47) / 0.11);
          RB[xs] = nz(u * 1.2 + 70, v * 1.2 + 9);
        }
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x, xs = x >> 1, fx = (x & 1) * 0.5;
          const D = RA[xs] + (RA[xs + 1] - RA[xs]) * fx, nn = RB[xs] + (RB[xs + 1] - RB[xs]) * fx;
          DD[i] = D;
          const band = BD[i];
          const glow = band * (0.18 + 0.3 * nn) * (1 - D);
          const rim = D > 0.3 && D < 0.75 ? (1 - Math.abs(D - 0.5) / 0.25) * band * 0.35 : 0;
          const G2 = Math.max(glow, rim);
          if (G2 < 0.1) continue;
          ch[i] = G2 > 0.25 ? ':' : '.'; co[i] = hue ? (rim > glow ? shd(200, 90, 60, 0.3 + G2 * 1.3) : shd(200, 180, 160, 0.2 + G2)) : f.C(0.06 + G2 * 0.6);
        }
      }
      // 星場跟著塵埃帶一起平移（速度只有塵埃的一半，遠近有視差）
      const shift = ((dr * 0.6) / k) * 0.5, DS = s.dstar;
      for (let j = 0; j < DS.length; j += 3) {
        let x = (DS[j] - shift) % cols;
        if (x < 0) x += cols;
        const i = DS[j + 1] * cols + (x | 0), hh = DS[j + 2], band = BD[i], dens = 0.035 + 0.16 * band;
        if (hh >= dens * (1 - DD[i])) continue;
        let L = 0.25 + (hh / dens) * 0.75;
        L *= 0.75 + 0.25 * Math.sin(t * 2 + hh * 500);
        ch[i] = L > 0.85 ? '*' : L > 0.6 ? '+' : L > 0.4 ? '·' : '.'; co[i] = hue ? starShd((hh * 30) % 1, 0.3 + 0.7 * L) : f.C(0.2 + 0.8 * L);
      }
    } else {
      // 反射星雲：亮星周圍的霧氣強度固定，先算好
      const B = s.big, nb = B.length;
      if (!s.hz || s.hz.length !== cols * rows) {
        s.hz = new Float32Array(cols * rows);
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          let hz = 0;
          for (let j = 0; j < nb; j++) { const dx = (x - B[j].x) / cols, dy = ((y - B[j].y) * aspect) / cols; hz += B[j].b / (1 + (dx * dx + dy * dy) * 160); }
          s.hz[y * cols + x] = hz - 0.12;
        }
      }
      const HZ = s.hz;
      for (let y = 0; y < rows; y++) {
        const v = (y - cy) * ky;
        const hw2 = (cols >> 1) + 2;
        if (!s.ra || s.ra.length !== hw2) s.ra = new Float32Array(hw2);
        const RS = s.ra;
        for (let xs = 0; xs < hw2; xs++) { const u = (xs * 2 - cx) * k; RS[xs] = nz(u * 0.35 + dr * 0.3 + 11, v * 1.8 + u * 0.25) * 0.65 + nz(u * 1.2 + 70, v * 4 + u * 0.8) * 0.35; }
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x, hz = HZ[i];
          if (hz < 0.05) continue;
          const xs = x >> 1, st = x & 1 ? (RS[xs] + RS[xs + 1]) * 0.5 : RS[xs];
          const L = Math.min(1, hz * (0.25 + 1.1 * st * st) * 1.25);
          if (L < 0.07) continue;
          ch[i] = R10[Math.max(1, Math.min(9, (L * 9.6) | 0))];
          co[i] = pc(s.PR, L);
        }
      }
    }
    if (m !== 'dark') {
      drawStars(f, s.stars, s.Ps);
      for (const q of s.big) {
        if (m === 'remnant' || m === 'ring') continue;
        const tw = 0.85 + 0.15 * Math.sin(t * 1.5 + q.x);
        spikeStar(f, Math.floor(q.x), Math.floor(q.y), Math.max(2, Math.round(cols / 40 * q.b * tw)), q.c, hue);
      }
    }
  },
});

/* ═════════ 6. 彗星 ═════════ */
// 旋轉矩陣（body → view），由三個角度組成
function rotM(a, b, c) {
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  return [cb * cc, sa * sb * cc - ca * sc, ca * sb * cc + sa * sc, cb * sc, sa * sb * sc + ca * cc, ca * sb * sc - sa * cc, -sb, sa * cb, ca * cb];
}
// 隨機坑洞（body 座標的單位向量＋角半徑的 cos）
function mkCraters(n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    let x = gauss(), y = gauss(), z = gauss();
    const l = Math.hypot(x, y, z) || 1;
    const r = rnd(0.1, 0.3) * (k < 2 ? 1.5 : 1);
    out.push([x / l, y / l, z / l, Math.cos(r)]);
  }
  return out;
}
// 不規則岩塊：中心 (cx,cy) 格；三軸半徑 a,b,c（欄寬單位）；M 旋轉；L 光線（view，y 向上）
// col(亮度) → 顏色；zb（可省略）深度緩衝：只在比較近時才畫
function rock(f, cx, cy, a, b, c, M, L, cr, seed, col, zb, zoff) {
  const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co;
  const R = Math.max(a, b, c), Zf = R * 2;
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(cols - 1, Math.ceil(cx + R));
  const y0 = Math.max(0, Math.floor(cy - R / aspect)), y1 = Math.min(rows - 1, Math.ceil(cy + R / aspect));
  if (x0 > x1 || y0 > y1) return;
  // 視線方向 (0,0,-1) 轉到 body：d = M^T (0,0,-1)
  const dx = -M[6] / a, dy = -M[7] / b, dz = -M[8] / c, AA = dx * dx + dy * dy + dz * dz;
  const nC = cr ? cr.length : 0;
  let hit = 0;
  for (let y = y0; y <= y1; y++) {
    const Y = -(y + 0.5 - cy) * aspect;
    for (let x = x0; x <= x1; x++) {
      const X = x + 0.5 - cx;
      // 原點 (X,Y,Zf) 轉到 body 並縮放
      const ox = (M[0] * X + M[3] * Y + M[6] * Zf) / a, oy = (M[1] * X + M[4] * Y + M[7] * Zf) / b, oz = (M[2] * X + M[5] * Y + M[8] * Zf) / c;
      const BB = 2 * (ox * dx + oy * dy + oz * dz), CC = ox * ox + oy * oy + oz * oz - 1, disc = BB * BB - 4 * AA * CC;
      if (disc < 0) continue;
      const sh = (-BB - Math.sqrt(disc)) / (2 * AA), z = Zf - sh + (zoff || 0);
      const i = y * cols + x;
      if (zb && zb[i] > z) continue;
      const px = ox + sh * dx, py = oy + sh * dy, pz = oz + sh * dz; // 單位球上的點
      let nx = px / a, ny = py / b, nzz = pz / c;
      const nl = Math.hypot(nx, ny, nzz);
      nx /= nl; ny /= nl; nzz /= nl;
      const Nx = M[0] * nx + M[1] * ny + M[2] * nzz, Ny = M[3] * nx + M[4] * ny + M[5] * nzz, Nz = M[6] * nx + M[7] * ny + M[8] * nzz;
      let l = Nx * L[0] + Ny * L[1] + Nz * L[2];
      const bump = nz(px * 21 + seed, py * 21 + pz * 15) - 0.5;
      l += bump * 0.5;
      for (let k = 0; k < nC; k++) {
        const C = cr[k], d = px * C[0] + py * C[1] + pz * C[2];
        if (d > C[3]) {
          const q = (1 - d) / (1 - C[3]);
          l = q > 0.8 ? l + 0.22 * Math.max(0, l) : l * (0.5 + 0.5 * q * q) - 0.05 * (1 - q);
        }
      }
      l = clamp(l, 0, 1);
      ch[i] = l > 0.03 ? R10[Math.max(1, Math.min(9, (l * 9.6) | 0))] : '.';
      co[i] = col(l);
      if (zb) zb[i] = z;
      hit++;
    }
  }
  return hit;
}
A({ id: 'sp-comet', name: '彗星', cat: '太空', theme: 'ice', hue: true, desc: '藍色離子尾與金色塵埃尾拖過星空',
  params: { mode: 'close', ion: 1, dust: 1, frag: 0 },
  variants: [
    { id: 'dusk', name: '黃昏彗星', desc: '山丘上空，長尾彎彎劃過暮色', params: { mode: 'dusk' } },
    { id: 'swarm', name: '彗星群', desc: '許多彗星繞著太陽，尾巴向外放射', params: { mode: 'swarm' } },
    { id: 'breakup', name: '核心分裂', desc: '彗核碎成一串，各自拖著尾巴', params: { frag: 5 } },
    { id: 'grazer', name: '掠日彗星', desc: '俯衝擦過太陽，尾巴隨之甩向', params: { mode: 'grazer' } },
    { id: 'nucleus', name: '彗核特寫', desc: '自轉的冰岩核噴出一道道氣柱', params: { mode: 'nucleus' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f, n = cols * rows;
    s.key = null;
    s.stars = mkStars(Math.max(30, (n / 40) | 0));
    s.Bi = new Float32Array(n); s.Bd = new Float32Array(n);
    s.P = []; s.T = 0; s.acc = 0;
    s.rate = Math.max(0.35, cols / 320);
    const m = p.mode;
    s.W = cols; s.Hh = rows * aspect;
    if (m === 'orbit' || m === 'swarm') {
      s.sx = m === 'swarm' ? cols / 2 : 0; s.sy = rows / 2;
      s.cm = [];
      const nC = m === 'swarm' ? 6 : 1;
      for (let k = 0; k < nC; k++) {
        const e = m === 'swarm' ? rnd(0.55, 0.9) : 0.86;
        let a = m === 'swarm' ? rnd(0.35, 0.95) : 1;
        const lim = Math.min(cols * 0.47, (rows * aspect * 0.46) / Math.sqrt(1 - e * e));
        a *= m === 'swarm' ? Math.min(cols * 0.48 / (1 + e), rows * aspect * 0.48 / Math.sqrt(1 - e * e)) * 1.3 : lim;
        const P = m === 'swarm' ? 9 * Math.pow(a / (cols * 0.3), 1.5) + 4 : 22;
        s.cm.push({ a, e, w: m === 'swarm' ? rnd(0, TAU) : 0, P, M0: rnd(0, TAU), GM: (a * a * a * TAU * TAU) / (P * P), prev: null });
      }
      if (m === 'orbit') s.sx = cols / 2 + s.cm[0].a * s.cm[0].e;
    }
    if (m === 'nucleus') { s.cr = mkCraters(9); s.jets = []; for (let k = 0; k < 5; k++) { let x = gauss(), y = gauss(), z = gauss(); const l = Math.hypot(x, y, z); s.jets.push([x / l, y / l, z / l]); } }
    if (m === 'dusk') {
      s.land = new Float32Array(cols);
      for (let x = 0; x < cols; x++) { const u = (x / cols) * 40; s.land[x] = rows * (0.84 - 0.06 * nz(u, 21) - 0.04 * nz(u * 3, 5)); }
      s.trees = [];
      for (let k = 0; k < Math.max(3, cols / 14); k++) s.trees.push([rnd(0, cols), rnd(0.6, 1.4)]);
    }
    if (m === 'grazer') this.grazeReset(s, f);
  },
  // 掠日彗星：拋物線軌道（解析解）。太陽在左邊，彗星從左上俯衝、貼著太陽右側擦過再甩回左下，尾巴像探照燈掃過整個畫面
  grazeReset(s, f) {
    const { cols, rows, aspect } = f, Hh = rows * aspect;
    s.gq = Hh * rnd(0.15, 0.18);
    s.sunR = s.gq / rnd(1.18, 1.32);
    s.sx = cols * 0.1; s.sy = rows * 0.5; s.sy0 = Hh * 0.5;
    s.gTilt = rnd(-0.22, 0.22);
    s.GM = 0.8 * s.gq * s.gq * s.gq;
    s.gk = Math.sqrt((2 * s.gq * s.gq * s.gq) / s.GM);
    let D = -8;
    for (; D < 0; D += 0.01) { this.grazeAt(s, D); const y = s.cmy; if (s.cmx > -2 && s.cmx < cols + 2 && y > -2 && y < Hh + 2) break; }
    D -= 0.06;
    s.gtau = s.gk * (D + (D * D * D) / 3);
    this.grazeAt(s, D);
    s.gt = 0; s.gwait = 0;
  },
  // 由拋物線參數 D = tan(ν/2) 算位置與速度（欄寬單位，y 向上）
  grazeAt(s, D) {
    const q = s.gq, dD = 1 / (s.gk * (1 + D * D)), c = Math.cos(s.gTilt), sn = Math.sin(s.gTilt);
    const xr = q * (1 - D * D), yr = -2 * q * D, vxr = -2 * q * D * dD, vyr = -2 * q * dD;
    s.cmx = s.sx + xr * c - yr * sn; s.cmy = s.sy0 + xr * sn + yr * c;
    s.cvx = vxr * c - vyr * sn; s.cvy = vxr * sn + vyr * c;
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.55);
    s.Pi = pal(f, h, [[10, 30, 80], [40, 110, 220], [140, 210, 255], [235, 250, 255]], 0.12, 0.95);
    s.Pd = pal(f, h, [[60, 40, 10], [200, 150, 70], [255, 220, 150], [255, 250, 230]], 0.1, 0.9);
    s.Psun = pal(f, h, [[110, 30, 0], [240, 120, 20], [255, 210, 90], [255, 250, 220]], 0.35, 1);
    s.Pl = pal(f, h, [[4, 6, 14], [16, 18, 34]], 0.02, 0.12);
    s.Pg = pal(f, h, [[20, 20, 60], [130, 60, 90], [250, 140, 80]], 0.05, 0.4);
  },
  // 從 (x,y)（格）放出粒子；ax,ay：反太陽方向（欄寬單位，y 向上）；vx0,vy0 彗星本身速度（欄/秒，y 向上）
  emit(s, f, x, y, ax, ay, k, vx0, vy0, grav) {
    const { cols, t } = f, p = f.p, W = cols;
    const px = -ay, py = ax;
    // 掠日彗星的尾巴轉向很快：離子跑得更快、壽命更短，尾巴才會是一道筆直甩動的光，而不是散成一大片
    const gz = p.mode === 'grazer';
    const ni = Math.round(k * p.ion * s.rate * (0.6 + Math.random())), nd = Math.round(k * 1.3 * p.dust * s.rate * (p.mode === 'swarm' ? 0.3 : gz ? 0.55 : 1) * (0.6 + Math.random()));
    const gust = Math.sin(t * 1.3) * 0.5 + Math.sin(t * 0.47 + 2) * 0.5;
    for (let j = 0; j < ni; j++) {
      const v = W * rnd(0.16, 0.3) * (gz ? 1.8 : 1), sp = p.ion > 1 ? pick([-0.04, -0.02, 0, 0.02, 0.04]) + gauss() * 0.004 : gauss() * 0.03, lat = sp + gust * (p.ion > 1 ? 0.035 : gz ? 0.02 : 0.05);
      s.P.push({ x, y, vx: vx0 * 0.3 + (ax + px * lat) * v, vy: vy0 * 0.3 + (ay + py * lat) * v, life: gz ? rnd(1.2, 1.9) : rnd(2.5, 4), ion: 1, g: 0 });
    }
    for (let j = 0; j < nd; j++) {
      const v = W * rnd(0.015, 0.07), sp = gauss() * 0.35;
      s.P.push({ x, y, vx: vx0 + (ax + px * sp) * v, vy: vy0 + (ay + py * sp) * v, life: gz ? rnd(3, 5.5) : rnd(5, 9), ion: 0, g: grav ? rnd(0.15, 0.85) : 0, cx: px, cy: py });
    }
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, n = cols * rows, Bi = s.Bi, Bd = s.Bd;
    const dt = Math.min(f.dt, 0.06), m = p.mode;
    s.T += dt;
    if (hue) f.bg = m === 'dusk' ? rgb(6, 8, 26) : rgb(1, 3, 10);
    const dec = Math.exp(-dt * 2.6);
    for (let i = 0; i < n; i++) { Bi[i] *= dec; Bd[i] *= dec; }
    const heads = [];
    const rate = dt * 60;
    // ── 依模式決定彗頭位置與放粒子 ──
    if (m === 'close' || m === 'dusk') {
      const dusk = m === 'dusk';
      const cyc = dusk ? (s.T % 70) / 70 : 0;
      const fr = !!p.frag, hx = dusk ? cols * 0.64 : cols * (fr ? 0.3 : 0.18) + Math.sin(t * 0.13) * cols * 0.015;
      const hy = dusk ? rows * (0.42 + cyc * 0.3) : rows * (fr ? 0.5 : 0.66) + Math.sin(t * 0.17) * rows * 0.02;
      let ax = dusk ? -0.55 : 1, ay = dusk ? 1 : fr ? 0.12 : 0.42;
      const al = Math.hypot(ax, ay);
      ax /= al; ay /= al;
      const nf = p.frag || 1, ph = (s.T % 36);
      const sep = p.frag ? Math.max(0, ph - 1) * cols * 0.007 : 0;
      for (let j = 0; j < nf; j++) {
        const o = (j - (nf - 1) / 2) * sep * (1 + 0.15 * Math.sin(j * 3.1));
        const fx = hx - ay * o * 0.9 - ax * Math.abs(o) * 0.25, fy = hy - (ax * o * 0.9 - ay * Math.abs(o) * 0.25) / aspect;
        heads.push([fx, fy, j === 0 || !p.frag ? 1 : 0.6]);
        let em = rate * 2.2 / nf * (p.frag && j ? 1.2 : 1);
        if (p.ion > 1 && s.T % 13 < 1.3) em *= 0.02;
        this.emit(s, f, fx, fy, ax, ay, em, 0, 0, 0);
      }
      s.ax = ax; s.ay = ay;
    } else if (m === 'orbit' || m === 'swarm') {
      for (const c of s.cm) {
        const Mt = c.M0 + (s.T * TAU) / c.P, E = keplerE(((Mt % TAU) + TAU) % TAU, c.e);
        const xo = c.a * (Math.cos(E) - c.e), yo = c.a * Math.sqrt(1 - c.e * c.e) * Math.sin(E);
        const cw = Math.cos(c.w), sw = Math.sin(c.w), X = xo * cw - yo * sw, Y = xo * sw + yo * cw;
        const r = Math.hypot(X, Y);
        const vx = c.prev ? (X - c.prev[0]) / dt : 0, vy = c.prev ? (Y - c.prev[1]) / dt : 0;
        c.prev = [X, Y];
        const hx = s.sx + X, hy = s.sy - Y / aspect;
        const q = c.a * (1 - c.e), act = clamp(Math.pow(q / r, 1.6), 0.03, 1.2);
        heads.push([hx, hy, 0.4 + 0.6 * Math.min(1, act)]);
        if (c.prev && Math.abs(vx) < cols * 5) this.emit(s, f, hx, hy, X / r, Y / r, rate * Math.max(act, m === 'swarm' ? 0.25 : 0) * (m === 'swarm' ? 2.4 : 2.2), vx, vy, 1);
        c.GMs = c.GM;
      }
    } else if (m === 'grazer') {
      s.gt += dt;
      if (s.gwait > 0) { s.gwait -= dt; if (s.gwait <= 0) this.grazeReset(s, f); }
      else {
        s.gtau += dt;
        const M = s.gtau / s.gk, A1 = 1.5 * M, B1 = Math.sqrt(A1 * A1 + 1);
        this.grazeAt(s, Math.cbrt(A1 + B1) + Math.cbrt(A1 - B1));
        const dx = s.cmx - s.sx, dy = s.cmy - s.sy0, r = Math.hypot(dx, dy);
        const hx = s.cmx, hy = rows - s.cmy / aspect;
        const off = hx < -cols * 0.06 || hx > cols * 1.06 || hy < -rows * 0.12 || hy > rows * 1.12;
        if ((s.gtau > 0 && off) || s.gt > 30) s.gwait = rnd(2, 3);
        else {
          const act = clamp(Math.pow((s.sunR * 1.6) / r, 2), 0.05, 1.5);
          heads.push([hx, hy, 0.5 + 0.5 * Math.min(1, act)]);
          this.emit(s, f, hx, hy, dx / r, dy / r, rate * act * 2.2, s.cvx, s.cvy, 1);
        }
      }
    } else if (m === 'nucleus') {
      const R = Math.min(rows * aspect * 0.3, cols * 0.2), cx = cols * 0.3, cy = rows * 0.52;
      const M = rotM(t * 0.11, t * 0.23 + 0.4, 0.3);
      const L = [-0.85, 0.25, 0.45], ll = Math.hypot(...L);
      L[0] /= ll; L[1] /= ll; L[2] /= ll;
      s.nuc = { cx, cy, R, M, L };
      for (const J of s.jets) {
        const Nx = M[0] * J[0] + M[1] * J[1] + M[2] * J[2], Ny = M[3] * J[0] + M[4] * J[1] + M[5] * J[2], Nz = M[6] * J[0] + M[7] * J[1] + M[8] * J[2];
        const lit = Nx * L[0] + Ny * L[1] + Nz * L[2];
        if (lit < 0.15) continue;
        const ex = cx + Nx * R * 1.05, ey = cy - (Ny * R * 1.05 * 0.8) / aspect;
        const nk = Math.round(rate * 3 * lit * s.rate + Math.random());
        for (let j = 0; j < nk; j++) {
          const v = cols * rnd(0.05, 0.11), sp = gauss() * 0.12;
          s.P.push({ x: ex, y: ey, vx: (Nx + sp) * v, vy: (Ny + sp) * v, life: rnd(4, 7), ion: Math.random() < 0.25 ? 1 : 0, g: -1 });
        }
      }
    }
    // ── 粒子更新與累積 ──
    const P = s.P, Wc = cols;
    for (let k = P.length - 1; k >= 0; k--) {
      const q = P[k];
      q.life -= dt;
      if (q.g > 0) {
        if (m === 'grazer') {
          const dx = q.x - s.sx, dy = rows * aspect - q.y * aspect - s.sy0, r2 = dx * dx + dy * dy, r = Math.sqrt(r2), a = (-s.GM * (1 - q.g)) / (r2 * r);
          q.vx += dx * a * dt; q.vy += dy * a * dt;
          if (r < s.sunR) q.life = 0;
        } else {
          const c = s.cm[0], GM = (s.cm.length > 1 ? s.cm.reduce((A0, B0) => A0 + B0.GM, 0) / s.cm.length : c.GM);
          const dx = q.x - s.sx, dy = -(q.y - s.sy) * aspect, r2 = dx * dx + dy * dy + 4, r = Math.sqrt(r2), a = (-GM * (1 - q.g)) / (r2 * r);
          q.vx += dx * a * dt; q.vy += dy * a * dt;
        }
      } else if (q.g < 0) {
        q.vx += Wc * 0.06 * dt; q.vy *= 1 - dt * 0.3;
      } else if (!q.ion) {
        const cs = m === 'dusk' ? 1 : -1, kk = Wc * 0.014 * dt;
        q.vx += cs * -s.ay * kk; q.vy += cs * s.ax * kk;
      }
      q.x += q.vx * dt; q.y -= (q.vy * dt) / aspect;
      if (q.life <= 0 || q.x < -cols * 0.3 || q.x > cols * 1.3 || q.y < -rows * 0.5 || q.y > rows * 1.5) { kill(P, k); continue; }
      if (q.x < 0 || q.y < 0 || q.x >= cols || q.y >= rows) continue;
      const i = (q.y | 0) * cols + (q.x | 0), fade = Math.min(1, q.life * 0.6);
      if (q.ion) Bi[i] += 0.11 * fade; else Bd[i] += 0.075 * fade;
    }
    // ── 背景元素 ──
    if (m === 'orbit' || m === 'swarm') {
      sunGlow(f, s.sx, s.sy, Math.max(1.5, rows * aspect * 0.05), s.Psun, 8, 3);
      if (m === 'orbit') {
        const c = s.cm[0], N = Math.ceil(c.a * 4);
        for (let j = 0; j < N; j++) {
          const E = (j / N) * TAU, x = s.sx + c.a * (Math.cos(E) - c.e), y = s.sy - (c.a * Math.sqrt(1 - c.e * c.e) * Math.sin(E)) / aspect;
          const i = (y | 0) * cols + (x | 0);
          if (x >= 0 && y >= 0 && x < cols && y < rows && ch[i] === ' ' && j % 2 === 0) { ch[i] = '·'; co[i] = pc(s.Pg, 0.5); }
        }
        for (const r of [0.12, 0.2, 0.28]) {
          const rr = c.a * r, N2 = Math.ceil(rr * 4);
          for (let j = 0; j < N2; j += 2) { const a = (j / N2) * TAU; g.set(s.sx + rr * Math.cos(a), s.sy + (rr * Math.sin(a)) / aspect, '.', pc(s.Pg, 0.35)); }
        }
      }
    }
    if (m === 'grazer') sunGlow(f, s.sx, s.sy, s.sunR, s.Psun, 12, 2.3);
    // ── 黃昏：地平線上的暮光色帶先畫好（█），尾巴與彗頭進到色帶裡時把顏色混進去，不會挖出黑洞 ──
    const dusk = m === 'dusk';
    if (dusk) {
      if (!s.bk || s.bk.length !== n) s.bk = new Float32Array(n);
      const BK = s.bk, Pg = s.Pg;
      BK.fill(-1);
      for (let x = 0; x < cols; x++) {
        const tp = s.land[x];
        for (let y = Math.max(0, Math.floor(tp - rows * 0.2)); y < Math.floor(tp); y++) {
          const i = y * cols + x, hgt = (tp - y) / (rows * 0.2), k = Math.pow(1 - hgt, 1.6) * 0.95;
          BK[i] = k; ch[i] = '█'; co[i] = pc(Pg, k);
        }
      }
    }
    // ── 尾巴 ──
    const Pi = s.Pi, Pd = s.Pd, BK = s.bk;
    for (let i = 0; i < n; i++) {
      const a = Bi[i], b = Bd[i], tot = a + b;
      if (tot < 0.05) continue;
      const v = 1 - Math.exp(-tot * 1.3);
      if (v < 0.06) continue;
      const c = a > b ? pc(Pi, v) : pc(Pd, v);
      if (dusk && BK[i] >= 0) { co[i] = mixHex(pc(s.Pg, BK[i]), c, Math.min(1, v * 1.25)); continue; }
      ch[i] = R10[Math.max(1, Math.min(9, (v * 9.5) | 0))];
      co[i] = c;
    }
    // ── 彗頭（彗髮＋彗核）：指數衰減，只在比尾巴亮的地方蓋上去，和尾巴自然接在一起 ──
    const cR = Math.max(1.8, cols * 0.014);
    for (let h = 0; h < heads.length; h++) {
      const hx = heads[h][0], hy = heads[h][1], br = heads[h][2], R = cR * 3 * br;
      for (let y = Math.floor(hy - R / aspect); y <= hy + R / aspect; y++) for (let x = Math.floor(hx - R); x <= hx + R; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const d = Math.hypot(x + 0.5 - hx, (y + 0.5 - hy) * aspect) / (cR * br);
        const v = br * 1.1 * Math.exp(-d * 0.85);
        if (v < 0.12) continue;
        const i = y * cols + x, tv = 1 - Math.exp(-(Bi[i] + Bd[i]) * 1.3);
        if (v <= tv) continue;
        const vv = Math.min(1, v), c = hue ? mixShd(120, 200, 255, 255, 255, 255, vv, 0.3 + 0.75 * vv) : f.C(0.3 + 0.7 * vv);
        if (dusk && BK[i] >= 0) { co[i] = mixHex(pc(s.Pg, BK[i]), c, Math.min(1, v * 1.3)); continue; }
        ch[i] = v > 0.85 ? '@' : v > 0.6 ? '#' : v > 0.4 ? '*' : v > 0.25 ? '+' : v > 0.17 ? ':' : '.';
        co[i] = c;
      }
    }
    if (m === 'nucleus') {
      const N = s.nuc;
      rock(f, N.cx, N.cy, N.R, N.R * 0.72, N.R * 0.62, N.M, N.L, s.cr, 7, l => (hue ? shd(150, 140, 130, 0.12 + 0.95 * l) : f.C(0.06 + 0.9 * l)));
    }
    // ── 黃昏地景（山丘與樹的剪影） ──
    if (dusk) {
      const Pl = s.Pl, cl = pc(Pl, 0.3);
      for (let x = 0; x < cols; x++) for (let y = Math.floor(s.land[x]); y < rows; y++) { const i = y * cols + x; ch[i] = '█'; co[i] = cl; }
      for (const [tx, sc] of s.trees) {
        const base = s.land[Math.min(cols - 1, Math.floor(tx))], h = rows * 0.12 * sc;
        for (let k = 0; k < h; k++) {
          const w = (k / h) * h * 0.35 * 0.9;
          const y = Math.floor(base - h + k);
          for (let x = Math.floor(tx - w); x <= tx + w; x++) g.set(x, y, '█', cl);
        }
      }
    }
    drawStars(f, s.stars, s.Ps, m === 'close' ? -t * 0.4 : 0, 0, m === 'dusk' ? 0.8 : 1);
  },
});

/* ═════════ 7. 小行星 ═════════ */
const ROCKC = [[150, 140, 130], [130, 120, 110], [170, 150, 120], [120, 116, 120], [160, 130, 105]];
A({ id: 'sp-asteroid', name: '小行星', cat: '太空', theme: 'amber', hue: true, desc: '穿越翻滾岩塊組成的小行星帶',
  params: { mode: 'fly', n: 26, spd: 1, size: 1, ice: 0, roll: 0, streak: 0 },
  variants: [
    { id: 'tumble', name: '翻滾巨岩', desc: '坑坑洞洞的巨岩在眼前自轉', params: { mode: 'tumble' } },
    { id: 'impact', name: '撞擊碎裂', desc: '兩顆岩塊相撞，碎片四散', params: { mode: 'impact' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f, n = cols * rows;
    s.key = null; s.T = 0;
    s.stars = mkStars(Math.max(30, (n / 40) | 0));
    s.zb = new Float32Array(n);
    s.R = [];
    s.dust = [];
    const m = p.mode;
    const mk = () => ({ a: rnd(0.8, 1.2), b: rnd(0.55, 0.85), c: rnd(0.5, 0.75), r0: rnd(0, TAU), r1: rnd(0, TAU), r2: rnd(0, TAU), w0: rnd(-0.6, 0.6), w1: rnd(-0.5, 0.5), cr: mkCraters(rint(3, 7)), seed: rnd(0, 200), col: pick(ROCKC) });
    s.mk = mk;
    if (m === 'fly') {
      for (let k = 0; k < p.n; k++) s.R.push(this.spawnFly(s, f, Object.assign(mk(), {}), rnd(0.5, 6)));
    } else if (m === 'drift') {
      for (let k = 0; k < 34; k++) { const q = mk(); q.layer = k < 16 ? 0 : k < 27 ? 1 : 2; this.spawnDrift(s, f, q, rnd(-0.1, 1.1)); s.R.push(q); }
    } else if (m === 'tumble') {
      s.big = Object.assign(mk(), { a: 1, b: 0.72, c: 0.6, cr: mkCraters(16) });
    } else if (m === 'ring') {
      for (let k = 0; k < Math.max(80, (n / 70) | 0); k++) s.R.push(this.spawnRing(s, f, mk(), rnd(0.3, 12)));
    } else if (m === 'impact') this.impReset(s, f);
    else if (m === 'binary') this.binReset(s, f);
  },
  // 動態殘影：從 (x0,y0) 拉到 (x1,y1)，只畫在空格上，越靠近目前位置越亮
  streak(f, x0, y0, x1, y1, P, br) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co;
    const n = Math.min(60, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    if (n < 2 || br < 0.05) return;
    const sc = slopeCh(x1 - x0, y1 - y0, aspect);
    for (let k = 0; k < n; k++) {
      const u = k / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const i = (y | 0) * cols + (x | 0);
      if (ch[i] !== ' ') continue;
      const v = br * u;
      if (v < 0.06) continue;
      ch[i] = v > 0.28 ? sc : v > 0.14 ? ':' : '.'; co[i] = pc(P, 0.1 + v);
    }
  },
  spawnFly(s, f, q, z) {
    const sz = f.p.size;
    q.z = z === undefined ? rnd(5, 7) : z;
    let x, y;
    do { x = rnd(-3.2, 3.2); y = rnd(-1.8, 1.8); } while (Math.abs(x) < 0.5 && Math.abs(y) < 0.4);
    q.x = x; q.y = y; q.s = rnd(0.12, 0.42) * sz * (Math.random() < 0.12 ? 2 : 1);
    return q;
  },
  spawnDrift(s, f, q, fx) {
    const { cols, rows, aspect } = f, L = q.layer;
    q.s = rows * aspect * [0.03, 0.07, 0.16][L] * rnd(0.6, 1.4);
    q.x = fx * cols + (fx > 1 ? q.s : 0); q.y = rnd(0.05, 0.95) * rows;
    q.v = cols * [0.012, 0.03, 0.07][L] * rnd(0.8, 1.2);
  },
  spawnRing(s, f, q, z) {
    q.z = z; q.x = rnd(-6, 6); q.y = -0.35 + gauss() * 0.06; q.s = rnd(0.02, 0.12) * (Math.random() < 0.08 ? 3 : 1);
    q.col = [rint(200, 240), rint(215, 245), 255];
    return q;
  },
  impReset(s, f) {
    const { cols, rows, aspect } = f, mk = s.mk;
    const r = rows * aspect * 0.2;
    s.R = [Object.assign(mk(), { x: cols * 0.05, y: rows * 0.45, vx: cols * 0.06, vy: 0, s: r, z: 0 }), Object.assign(mk(), { x: cols * 0.95, y: rows * 0.55, vx: -cols * 0.05, vy: 0, s: r * 0.8, z: 0 })];
    s.frag = []; s.dust = []; s.it = 0; s.hit = false;
  },
  binReset(s, f) {
    const mk = s.mk;
    s.pri = Object.assign(mk(), { a: 1, b: 0.85, c: 0.8, cr: mkCraters(10) });
    s.moon = Object.assign(mk(), { a: 1, b: 0.7, c: 0.65 });
    s.bt = 0; s.hit = false; s.dust = []; s.mph = rnd(0, TAU);
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.6);
    s.Pd = pal(f, h, [[60, 50, 40], [170, 150, 130], [255, 235, 200]], 0.1, 0.7);
    s.Pp = pal(f, h, [[80, 50, 30], [220, 140, 80], [255, 220, 160]], 0.2, 0.9);
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode;
    const dt = Math.min(f.dt, 0.06);
    s.T += dt;
    if (hue) f.bg = m === 'ring' ? rgb(2, 4, 12) : rgb(3, 3, 6);
    let L = [-0.62, 0.45, 0.64];
    const colF = (c, k) => l => (hue ? shade(c, (0.1 + 0.95 * l) * k) : f.C((0.05 + 0.9 * l) * k));
    if (m === 'fly' || m === 'ring') {
      const cx = cols / 2, cy = rows * (m === 'ring' ? 0.42 : 0.5), F = cols * 0.42, v = (m === 'ring' ? 1.1 : 1.3) * p.spd;
      if (m === 'ring') {
        // 天上的巨大行星
        const pr = rows * aspect * 0.9, pcx = cols * 0.62, pcy = -pr / aspect * 0.62;
        const ry = pr / aspect;
        for (let y = 0; y < Math.min(rows, Math.ceil(pcy + ry)); y++) for (let x = 0; x < cols; x++) {
          const u = (x + 0.5 - pcx) / pr, w = ((y + 0.5 - pcy) * aspect) / pr, d2 = u * u + w * w;
          if (d2 > 1) continue;
          const z = Math.sqrt(1 - d2), l = clamp(-u * 0.5 + w * 0.3 + z * 0.75, 0, 1), bnd = 0.5 + 0.5 * Math.sin(w * 22 + nz(x * 0.2, y * 0.6) * 2);
          const i = y * cols + x;
          ch[i] = R10[Math.max(1, Math.min(9, (l * (0.6 + 0.4 * bnd) * 9) | 0))];
          co[i] = hue ? mixShd(190, 150, 110, 240, 220, 180, bnd, 0.15 + 0.7 * l) : f.C(0.05 + 0.6 * l);
        }
        // 環面（遠處的細紋）
        for (let y = Math.ceil(cy); y < rows; y++) {
          const dz = (y + 0.5 - cy) / rows;
          const z = 0.35 / Math.max(0.004, dz * 2.1);
          let lb = 0;
          for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            let band;
            if (x & 1) band = lb;
            else { const wx = ((x - cx) / F) * z, lane = nz(wx * 70 + 500, 7); band = lb = lane * lane * 0.75 + nz(wx * 160 + 90, z * 10 + s.T * v * 10) * 0.35; }
            if (ch[i] !== ' ') continue;
            if (band < 0.12) continue;
            const fd = Math.min(1, 2.2 / z);
            ch[i] = band > 0.75 ? '=' : band > 0.5 ? '-' : band > 0.3 ? ':' : '.'; co[i] = hue ? shd(150, 170, 205, (0.15 + 0.45 * band) * (0.4 + 0.6 * fd)) : f.C((0.08 + 0.3 * band) * (0.5 + 0.5 * fd));
          }
        }
        L = [-0.3, 0.6, 0.74];
      }
      for (const q of s.R) {
        q.z -= v * dt;
        if (m === 'ring') { if (q.z < 0.25) this.spawnRing(s, f, q, rnd(10, 12)); }
        else if (q.z < 0.3) this.spawnFly(s, f, q);
      }
      s.R.sort((A0, B0) => B0.z - A0.z);
      // 側滾：整個視野繞畫面中心轉，光線方向也跟著轉
      const ra = p.roll ? 0.75 * Math.sin(t * 0.09) + 0.3 * Math.sin(t * 0.23 + 1) : 0, rc = Math.cos(ra), rs = Math.sin(ra);
      if (p.roll) L = [L[0] * rc - L[1] * rs, L[0] * rs + L[1] * rc, L[2]];
      const PX = (x, y, z) => { const X = (x / z) * F, Y = (y / z) * F; return cx + X * rc - Y * rs; };
      const PY = (x, y, z) => { const X = (x / z) * F, Y = (y / z) * F; return cy - (X * rs + Y * rc) / aspect; };
      for (const q of s.R) {
        const sx = PX(q.x, q.y, q.z), sy = PY(q.x, q.y, q.z), r = (q.s / q.z) * F;
        // 近距離擦身而過的岩塊拖出殘影
        if (p.streak && q.z < 2.6 && r >= 0.8) { const z0 = q.z + v * 0.32; this.streak(f, PX(q.x, q.y, z0), PY(q.x, q.y, z0), sx, sy, s.Pd, 0.7 * clamp(1.4 - q.z / 2.6, 0, 1)); }
        if (sx + r < 0 || sx - r > cols || sy + r / aspect < 0 || sy - r / aspect > rows) { if (q.z < 3 && m !== 'ring') this.spawnFly(s, f, q); continue; }
        const fog = clamp(1.25 - q.z / (m === 'ring' ? 11 : 7), 0.12, 1);
        if (r < 1.2) {
          const i = (sy | 0) * cols + (sx | 0);
          if (sy >= 0 && sy < rows && sx >= 0 && sx < cols) { ch[i] = r < 0.5 ? '.' : r < 0.8 ? '·' : 'o'; co[i] = hue ? shade(q.col, 0.3 + 0.6 * fog) : f.C(0.15 + 0.6 * fog); }
          continue;
        }
        const M = rotM(q.r0 + t * q.w0, q.r1 + t * q.w1, q.r2);
        rock(f, sx, sy, r * q.a, r * q.b, r * q.c, M, L, q.cr, q.seed, colF(q.col, fog * (p.ice ? 1.15 : 1)));
      }
      // 速度感的細塵
      if (m === 'fly') {
        while (s.dust.length < Math.max(40, (cols * rows) / 160) * p.spd) s.dust.push({ x: rnd(-3, 3), y: rnd(-2, 2), z: rnd(0.5, 6) });
        for (const d of s.dust) {
          d.z -= v * 1.4 * dt;
          if (d.z < 0.2) { d.x = rnd(-3, 3); d.y = rnd(-2, 2); d.z = 6; }
          const sx = PX(d.x, d.y, d.z), sy = PY(d.x, d.y, d.z);
          if (p.streak && d.z < 3.2) { const z0 = d.z + v * 0.2; this.streak(f, PX(d.x, d.y, z0), PY(d.x, d.y, z0), sx, sy, s.Pd, 0.6 * clamp(1.2 - d.z / 3.2, 0, 1)); }
          if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) continue;
          const i = (sy | 0) * cols + (sx | 0);
          if (ch[i] !== ' ') continue;
          ch[i] = d.z < 1.5 ? '·' : '.'; co[i] = pc(s.Pd, clamp(1.2 - d.z / 6, 0, 1) * 0.6);
        }
      }
    } else if (m === 'drift') {
      for (const q of s.R) {
        q.x -= q.v * dt;
        if (q.x < -q.s * 1.2) this.spawnDrift(s, f, q, 1.05);
      }
      for (let Lr = 0; Lr < 3; Lr++) for (const q of s.R) {
        if (q.layer !== Lr) continue;
        const r = q.s, M = rotM(q.r0 + t * q.w0 * 0.6, q.r1 + t * q.w1 * 0.6, q.r2);
        if (r < 1.2) { g.set(q.x, q.y, '·', colF(q.col, 0.5)(0.6)); continue; }
        rock(f, q.x, q.y, r * q.a, r * q.b, r * q.c, M, L, q.cr, q.seed, colF(q.col, [0.4, 0.7, 1][Lr]));
      }
    } else if (m === 'tumble') {
      const q = s.big, R = Math.min(rows * aspect * 0.44, cols * 0.3), cx = cols * 0.5, cy = rows * 0.5;
      const M = rotM(t * 0.09 + q.r0, t * 0.15 + q.r1, 0.35 + Math.sin(t * 0.05) * 0.3);
      s.zb.fill(-1e9);
      // 探測器
      const pa = t * 0.35, px = cx + Math.cos(pa) * R * 1.45, py = cy + (Math.sin(pa) * R * 0.35) / aspect, pz = Math.sin(pa) * R;
      const drawProbe = () => { txt(g, px - 2, py, '=[#]=', hue ? rgb(220, 230, 255) : f.C(0.9)); if (Math.sin(t * 3) > 0.7) g.set(px, py - 1, '*', hue ? rgb(255, 80, 80) : f.C(1)); };
      if (pz < 0) drawProbe();
      rock(f, cx, cy, R * q.a, R * q.b, R * q.c, M, L, q.cr, q.seed, colF(q.col, 1), s.zb, 0);
      if (pz >= 0) drawProbe();
    } else if (m === 'impact') {
      s.it += dt;
      const it = s.it, R = s.R;
      if (!s.hit) {
        for (const q of R) q.x += q.vx * dt;
        const dx = (R[1].x - R[0].x), dy = (R[1].y - R[0].y) * aspect;
        if (Math.hypot(dx, dy) < (R[0].s + R[1].s) * 0.82) {
          s.hit = true; s.hx = (R[0].x * R[1].s + R[1].x * R[0].s) / (R[0].s + R[1].s); s.hy = (R[0].y + R[1].y) / 2;
          for (const q of R) for (let k = 0; k < 9; k++) {
            const a = rnd(0, TAU), v = cols * rnd(0.01, 0.06), fr = Object.assign(s.mk(), { x: q.x + Math.cos(a) * q.s * 0.4, y: q.y - (Math.sin(a) * q.s * 0.4) / aspect, vx: Math.cos(a) * v + q.vx * 0.3, vy: -(Math.sin(a) * v) / aspect, s: q.s * rnd(0.12, 0.38), col: q.col, w0: rnd(-1.5, 1.5), w1: rnd(-1.5, 1.5) });
            s.frag.push(fr);
          }
          for (let k = 0; k < 900; k++) { const a = rnd(0, TAU), v = cols * rnd(0.02, 0.2); s.dust.push({ x: s.hx, y: s.hy, vx: Math.cos(a) * v, vy: (-Math.sin(a) * v) / aspect, life: rnd(2, 7) }); }
          s.flash = 1;
        }
      }
      if (it > 26) { this.impReset(s, f); return; }
      if (!s.hit) for (const q of R) rock(f, q.x, q.y, q.s * q.a, q.s * q.b, q.s * q.c, rotM(q.r0 + t * 0.3, q.r1 + t * 0.2, q.r2), L, q.cr, q.seed, colF(q.col, 1));
      for (const d of s.dust) {
        d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 1 - dt * 0.15; d.vy *= 1 - dt * 0.15;
        if (d.life <= 0 || d.x < 0 || d.y < 0 || d.x >= cols || d.y >= rows) continue;
        const i = (d.y | 0) * cols + (d.x | 0), v = Math.min(1, d.life / 4);
        ch[i] = v > 0.6 ? '*' : v > 0.3 ? ':' : '.'; co[i] = pc(s.Pp, v);
      }
      for (const q of s.frag) {
        q.x += q.vx * dt; q.y += q.vy * dt;
        rock(f, q.x, q.y, q.s * q.a, q.s * q.b, q.s * q.c, rotM(q.r0 + t * q.w0, q.r1 + t * q.w1, q.r2), L, q.cr, q.seed, colF(q.col, 1));
      }
      if (s.hit && s.flash > 0) {
        s.flash -= dt * 1.2;
        sunGlow(f, s.hx, s.hy, Math.max(1, rows * aspect * 0.06 * s.flash), s.Pp, 0, 2.5);
      }
    } else if (m === 'binary') {
      s.bt += dt;
      if (s.bt > 30) this.binReset(s, f);
      const bt = s.bt;
      const cx = cols * 0.42, cy = rows * 0.5, R = Math.min(rows * aspect * 0.3, cols * 0.18);
      const ang = s.mph + bt * 0.3, orbR = R * 2.3;
      const mx = cx + Math.cos(ang) * orbR, my = cy + (Math.sin(ang) * orbR * 0.3) / aspect, mz = Math.sin(ang) * orbR, mR = R * 0.32;
      s.zb.fill(-1e9);
      // 撞擊器：從右側飛向衛星
      const T0 = 14, sx0 = cols * 1.05, sy0 = rows * 0.15;
      if (!s.hit) {
        const k = Math.min(1, bt / T0), px = lerp(sx0, mx, k), py = lerp(sy0, my, k);
        if (bt >= T0) {
          s.hit = true;
          for (let j = 0; j < 700; j++) { const a = Math.PI * 0.25 + gauss() * 0.45, v = cols * rnd(0.01, 0.12); s.dust.push({ x: mx + mR * 0.6, y: my - mR * 0.2 / aspect, vx: Math.cos(a) * v, vy: (-Math.sin(a) * v) / aspect, life: rnd(3, 10) }); }
        } else {
          txt(g, px - 1, py, '<o>', hue ? rgb(220, 230, 255) : f.C(0.95));
          g.line(px + 2, py - 0.3, px + 5, py - 1.2, '-', hue ? rgb(120, 140, 200) : f.C(0.5));
        }
      }
      const pr = s.pri, M1 = rotM(bt * 0.25 + pr.r0, pr.r1, 0.3), M2 = rotM(ang, s.moon.r1, 0.2);
      rock(f, cx, cy, R * pr.a, R * pr.b, R * pr.c, M1, L, pr.cr, pr.seed, colF(pr.col, 1), s.zb, 0);
      rock(f, mx, my, mR, mR * 0.7, mR * 0.65, M2, L, s.moon.cr, s.moon.seed, colF(s.moon.col, 1), s.zb, mz);
      for (const d of s.dust) {
        d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.life <= 0 || d.x < 0 || d.y < 0 || d.x >= cols || d.y >= rows) continue;
        const i = (d.y | 0) * cols + (d.x | 0), v = Math.min(1, d.life / 6);
        if (ch[i] !== ' ' && s.zb[i] > -1e8) continue;
        ch[i] = v > 0.6 ? ':' : '.'; co[i] = pc(s.Pd, v);
      }
      if (cols >= 150) txt(g, 2, rows - 2, s.hit ? tr(f, '撞擊完成・觀測軌道變化', 'Impact complete · tracking orbit change') : tr(f, '撞擊倒數 ' + Math.max(0, Math.ceil(T0 - bt)) + ' 秒', 'Impact in ' + Math.max(0, Math.ceil(T0 - bt)) + 's'), pc(s.Pd, 0.6));
    }
    drawStars(f, s.stars, s.Ps, m === 'drift' ? -t * 0.6 : 0, 0);
  },
});

/* ═════════ 8. 流星雨 ═════════ */
A({ id: 'sp-meteor', name: '流星雨', cat: '太空', theme: 'ice', hue: true, desc: '流星從輻射點劃過山稜上的夜空',
  params: { land: 'mount', rate: 1.8, rx: 0.68, ry: 0.2, trails: 0, bolide: 0, milky: 0, hz: 0.76 },
  variants: [
    { id: 'trails', name: '星軌', desc: '長時間曝光，星星畫出同心圓弧', params: { trails: 1, rate: 0.7, land: 'ridge', hz: 0.8 } },
    { id: 'camp', name: '營火', desc: '營帳與營火旁看流星劃過', params: { land: 'camp', rate: 1.4, hz: 0.86, rx: 0.3, ry: 0.15 } },
    { id: 'milky', name: '銀河夜', desc: '銀河拱橋橫跨天空，流星偶現', params: { milky: 1, rate: 0.7, land: 'mount', hz: 0.82, rx: 0.8 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f, n = cols * rows;
    s.key = null; s.T = 0; s.acc = 0; s.M = []; s.tr = []; s.sp = []; s.bt = rnd(3, 6);
    s.hz = p.hz * rows;
    // 天空的星（繞天極轉）
    s.pole = [cols * 0.18, -rows * 0.4];
    // 星星分布在天極周圍的整個環帶上，轉多久都會填滿畫面
    const px = s.pole[0], py = s.pole[1] * aspect, W = cols, Hh = rows * aspect;
    const r1 = Math.max(0, Math.hypot(Math.max(0, -px, px - W), Math.max(0, -py, py - Hh)));
    let r2 = 0;
    for (const [qx, qy] of [[0, 0], [W, 0], [0, Hh], [W, Hh]]) r2 = Math.max(r2, Math.hypot(qx - px, qy - py));
    const area = Math.PI * (r2 * r2 - r1 * r1), N = Math.min(9000, Math.max(80, ((n / 26) * area) / (W * Hh)) | 0);
    s.st = new Float32Array(N * 4);
    for (let k = 0; k < N; k++) {
      s.st[k * 4] = Math.sqrt(rnd(r1 * r1, r2 * r2)); s.st[k * 4 + 1] = rnd(0, TAU); s.st[k * 4 + 2] = Math.pow(Math.random(), 2.6); s.st[k * 4 + 3] = rnd(0, TAU);
    }
    const Rmax = r2;
    void Rmax;
    s.ex = p.trails ? new Float32Array(n) : null; s.et = 0;
    // 地景
    s.land = new Float32Array(cols); s.land2 = new Float32Array(cols);
    const L = p.land;
    for (let x = 0; x < cols; x++) {
      const u = (x / cols) * 50;
      if (L === 'mount' || L === 'ridge') {
        s.land2[x] = s.hz - rows * (0.3 * Math.pow(1 - Math.abs(nz(u * 1.1, 3) * 2 - 1), 1.6) + 0.06 * nz(u * 4, 7));
        s.land[x] = s.hz - rows * (0.1 * nz(u * 0.9, 13) + 0.04 * nz(u * 4, 17)) + rows * 0.06;
      } else if (L === 'dunes') {
        s.land2[x] = s.hz - rows * 0.06 * (0.5 + 0.5 * Math.sin(x / cols * 9 + nz(u, 3) * 3));
        s.land[x] = s.hz + rows * 0.05 - rows * 0.08 * Math.pow(0.5 + 0.5 * Math.sin(x / cols * 5.3 + 1 + nz(u, 9) * 2), 2);
      } else if (L === 'forest' || L === 'camp') {
        s.land2[x] = s.hz - rows * 0.05 * nz(u * 0.8, 3);
        s.land[x] = s.hz + rows * 0.04 - rows * 0.04 * nz(u * 1.5, 19);
      } else { s.land[x] = s.land2[x] = s.hz; }
    }
    if (L === 'forest' || L === 'camp') {
      const nt = Math.max(6, (cols / (L === 'camp' ? 9 : 4)) | 0);
      for (let k = 0; k < nt; k++) {
        const tx = rnd(0, cols), th = rows * rnd(0.08, 0.2), tw = th * aspect * rnd(0.18, 0.28);
        if (L === 'camp' && Math.abs(tx - cols * 0.62) < cols * 0.16) continue;
        for (let x = Math.floor(tx - tw); x <= tx + tw; x++) {
          if (x < 0 || x >= cols) continue;
          const top = s.land2[x] - th * (1 - Math.abs(x - tx) / tw) - 1;
          s.land2[x] = Math.min(s.land2[x], top);
        }
      }
    }
    if (L === 'zenith') {
      const tree = [];
      for (let k = 0; k < 18; k++) tree.push([rnd(0, TAU), rnd(0.05, 0.13), rnd(0.07, 0.17)]);
      s.zm = new Uint8Array(n);
      const cx = cols / 2, cy = rows / 2;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const dx = (x + 0.5 - cx) / (cols / 2), dy = (y + 0.5 - cy) / (rows / 2), r = Math.hypot(dx, dy * 0.92), a = Math.atan2(dy, dx);
        let edge = 1.0;
        for (const [ta, tw, th] of tree) {
          const da = Math.abs(wrapA(a - ta));
          if (da < tw) edge = Math.min(edge, 1.02 - th * (1 - da / tw) - 0.06 * nz(r * 30, a * 40));
        }
        edge -= 0.04 * nz(a * 60, 3);
        if (r > edge) s.zm[y * cols + x] = r - edge < 0.02 ? 2 : 1;
      }
    }
    s.fire = [];
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.65);
    s.Pm = pal(f, h, [[40, 60, 120], [140, 180, 255], [230, 240, 255], [255, 255, 255]], 0.15, 1);
    s.Pg = pal(f, h, [[20, 80, 40], [90, 255, 140], [220, 255, 230]], 0.15, 1);
    s.Po = pal(f, h, [[90, 30, 10], [255, 140, 40], [255, 230, 160]], 0.2, 1);
    s.Pl = pal(f, h, [[2, 3, 8], [12, 14, 26], [30, 34, 56]], 0.02, 0.18);
    s.Pr = pal(f, h, [[10, 20, 40], [70, 100, 150], [170, 200, 240]], 0.06, 0.45);
    s.Pw = pal(f, h, [[24, 22, 40], [90, 90, 120], [200, 190, 220]], 0.05, 0.4);
    s.Phz = pal(f, h, [[3, 5, 16], [16, 24, 52], [44, 46, 82]], 0.01, 0.1);
  },
  spawn(s, f, big) {
    const { cols, rows, aspect, p } = f;
    const rx = cols * p.rx, ry = rows * p.ry, zen = p.land === 'zenith';
    for (let tries = 0; tries < 8; tries++) {
      const a = rnd(0, TAU), d0 = zen ? rnd(0.02, 0.25) * cols : rnd(0.04, 0.5) * cols;
      const dx = Math.cos(a), dy = Math.sin(a);
      const x = rx + dx * d0, y = ry + (dy * d0) / aspect;
      if (x < 0 || x >= cols || y < 0 || (!zen && y > s.hz - 3)) continue;
      const v = big ? cols * rnd(0.12, 0.18) : cols * rnd(0.45, 1.1) * (zen ? 0.6 + d0 / cols : 1);
      const kind = big ? 3 : Math.random() < 0.12 ? 1 : Math.random() < 0.08 ? 2 : 0;
      s.M.push({ x, y, dx, dy, v, age: 0, life: big ? rnd(2.6, 3.4) : rnd(0.4, 1), len: big ? cols * 0.18 : rnd(0.07, 0.2) * cols, k: kind, b: big ? 1 : rnd(0.5, 1) });
      return;
    }
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, n = cols * rows;
    const dt = Math.min(f.dt, 0.1);
    s.T += dt;
    let glow = 0;
    for (const m of s.M) if (m.k === 3) glow = Math.max(glow, Math.sin((m.age / m.life) * Math.PI) * 0.6);
    if (hue) { const k = glow * 0.12; f.bg = p.land === 'camp' ? rgb(8 + 60 * k, 8 + 50 * k, 22 + 60 * k) : rgb(3 + 60 * k, 5 + 70 * k, 16 + 90 * k); }
    // 生成流星
    s.acc += dt * p.rate * (0.6 + 0.8 * Math.max(0, Math.sin(t * 0.21) * 0.5 + 0.5));
    while (s.acc > 1) { s.acc -= rnd(0.6, 1.4); this.spawn(s, f, false); }
    if (p.bolide) { s.bt -= dt; if (s.bt <= 0) { s.bt = rnd(10, 16); this.spawn(s, f, true); } }
    // 星軌模式的曝光緩衝
    const ex = s.ex;
    if (ex) {
      s.et += dt;
      if (s.et > 48) { for (let i = 0; i < n; i++) ex[i] *= Math.exp(-dt * 3); if (s.et > 50.5) { ex.fill(0); s.et = 0; } }
    }
    // 地平線附近的微光先鋪好（█ 色塊）；之後的星星、流星落在這幾列時把顏色混進色塊，不會挖出黑格
    const zen = p.land === 'zenith';
    if (!s.hb || s.hb.length !== n) { s.hb = new Float32Array(n); s.hzC = new Array(rows).fill(null); }
    const hb = s.hb, hzC = s.hzC;
    hb.fill(0); hzC.fill(null);
    let hy0 = rows, hy1 = rows;
    if (!zen) {
      const H0 = rows * 0.15, base = p.land === 'sea' ? Math.floor(s.hz) : s.hz + rows * 0.02;
      hy0 = Math.max(0, Math.floor(base - H0)); hy1 = Math.min(rows, Math.ceil(base));
      for (let y = hy0; y < hy1; y++) {
        const k = Math.pow(Math.max(0, 1 - (base - y) / H0), 2), c = pc(s.Phz, k + glow * 0.3);
        hzC[y] = c;
        for (let x = 0, i = y * cols; x < cols; x++, i++) { ch[i] = '█'; co[i] = c; }
      }
    }
    // 在色塊裡的亮點：只改顏色（亮度 v 0–1）
    const hzPut = (i, col, v) => { const y = (i / cols) | 0; co[i] = mixHex(hzC[y], col, Math.min(1, v)); if (v > hb[i]) hb[i] = v; };
    // 銀河
    if (p.milky) {
      for (let y = 0; y < Math.floor(s.hz); y++) for (let x = 0; x < cols; x++) {
        const u = x / cols - 0.5, yc = rows * (0.12 + 1.6 * u * u) + Math.sin(x * 0.02) * rows * 0.03;
        const d = (y - yc) / (rows * 0.17), band = Math.exp(-d * d);
        if (band < 0.05) continue;
        const dust = smooth((nz(x * 0.12, y * 0.35) - 0.45) / 0.2) * Math.exp(-(((d + 0.1) / 0.35) ** 2));
        const gl = band * (0.35 + 0.65 * nz(x * 0.07 + 30, y * 0.2)) * (1 - dust * 0.95);
        const hh = hash2(x, y);
        const i = y * cols + x, inH = y >= hy0 && y < hy1;
        if (inH) { if (gl >= 0.18) hzPut(i, pc(s.Pw, gl), gl * 0.45); continue; }
        if (hh < band * 0.18 * (1 - dust)) { ch[i] = hh < band * 0.03 ? '+' : '·'; co[i] = pc(s.Ps, 0.35 + gl * 0.6); continue; }
        if (gl < 0.18) continue;
        ch[i] = gl > 0.55 ? ':' : '.'; co[i] = pc(s.Pw, gl);
      }
    }
    // 星空（繞天極慢慢轉）
    const ang = -t * 0.012, P0 = s.pole, st = s.st;
    for (let k = 0; k < st.length; k += 4) {
      const a = st[k + 1] + ang, x = P0[0] + st[k] * Math.cos(a), y = P0[1] + (st[k] * Math.sin(a)) / aspect;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const yi = y | 0, i = yi * cols + (x | 0), b = st[k + 2];
      if (ex) { ex[i] = Math.max(ex[i], 0.25 + b * 0.75); continue; }
      const tw = b * (0.7 + 0.3 * Math.sin(t * (1 + st[k + 3]) + st[k + 3] * 9));
      // 大氣消光：地平線微光裡只看得到較亮的星
      if (yi >= hy0 && yi < hy1) { if (b >= 0.5 && ch[i] === '█') hzPut(i, pc(s.Ps, 0.12 + tw * 0.88), tw * 0.85); continue; }
      if (ch[i] !== ' ') continue;
      ch[i] = b > 0.8 ? '*' : b > 0.45 ? '+' : b > 0.15 ? '·' : '.';
      co[i] = pc(s.Ps, 0.12 + tw * 0.88);
    }
    if (ex) {
      for (let i = 0; i < n; i++) {
        const v = ex[i];
        if (v < 0.05) continue;
        const y = (i / cols) | 0;
        if (y >= hy0 && y < hy1) { if (v > 0.5) hzPut(i, pc(s.Ps, v * 0.9), v * 0.7); continue; }
        ch[i] = v > 0.85 ? '-' : v > 0.5 ? '·' : '.'; co[i] = pc(s.Ps, v * 0.9);
      }
    }
    // 流星
    const pals = [s.Pm, s.Pg, s.Po, s.Po];
    for (let k = s.M.length - 1; k >= 0; k--) {
      const m = s.M[k];
      m.age += dt;
      if (m.age >= m.life) {
        if ((m.b > 0.85 && m.k !== 3) || m.k === 3) s.tr.push({ x0: m.x + m.dx * m.v * m.life * 0.2, y0: m.y + (m.dy * m.v * m.life * 0.2) / aspect, x1: m.x + m.dx * m.v * m.life, y1: m.y + (m.dy * m.v * m.life) / aspect, age: 0, life: m.k === 3 ? 7 : 2.2, seed: rnd(0, 100), big: m.k === 3 });
        kill(s.M, k); continue;
      }
      const e = Math.sin((m.age / m.life) * Math.PI) * m.b, d = m.v * m.age;
      const hx = m.x + m.dx * d, hy = m.y + (m.dy * d) / aspect;
      const L = Math.min(m.len, d), P = pals[m.k], sc = slopeCh(m.dx, m.dy / aspect, aspect);
      const nn = Math.ceil(L);
      for (let j = nn; j >= 0; j--) {
        const fr = j / Math.max(1, nn), x = hx - m.dx * j, y = hy - (m.dy * j) / aspect;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const yi = y | 0, i = yi * cols + (x | 0), v = e * (1 - fr) * (1 - fr * 0.3);
        if (v < 0.06) continue;
        if (ex) { ex[i] = Math.max(ex[i], v); }
        if (yi >= hy0 && yi < hy1) { if (ch[i] === '█') hzPut(i, pc(P, v), v); continue; }
        ch[i] = j === 0 ? (m.k === 3 ? '@' : '*') : v > 0.5 ? sc : v > 0.25 ? (sc === '-' ? '-' : ':') : '.';
        co[i] = pc(P, v);
      }
      if (m.k === 3) {
        // 火球：發光的頭與碎火花
        const R = Math.max(1.5, cols * 0.012) * (0.6 + e);
        for (let yy = Math.floor(hy - R / aspect); yy <= hy + R / aspect; yy++) for (let xx = Math.floor(hx - R); xx <= hx + R; xx++) {
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          const dd = Math.hypot(xx + 0.5 - hx, (yy + 0.5 - hy) * aspect) / R;
          if (dd > 1) continue;
          const i = yy * cols + xx, c = pc(s.Po, 1 - dd * 0.5);
          if (yy >= hy0 && yy < hy1) { hzPut(i, c, 1 - dd * 0.6); continue; }
          ch[i] = dd < 0.4 ? '@' : dd < 0.7 ? '#' : '*'; co[i] = c;
        }
        for (let j = 0; j < 3; j++) s.sp.push({ x: hx, y: hy, vx: -m.dx * m.v * rnd(0.05, 0.3) + gauss() * 3, vy: (-m.dy * m.v * rnd(0.05, 0.3)) / aspect + gauss(), life: rnd(0.4, 1.2) });
      }
    }
    for (let k = s.sp.length - 1; k >= 0; k--) {
      const q = s.sp[k];
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += dt * 2;
      if (q.life <= 0) { kill(s.sp, k); continue; }
      if (q.x < 0 || q.y < 0 || q.x >= cols || q.y >= rows) continue;
      const yi = q.y | 0, i = yi * cols + (q.x | 0);
      if (yi >= hy0 && yi < hy1) { if (ch[i] === '█') hzPut(i, pc(s.Po, q.life), q.life * 0.6); continue; }
      ch[i] = q.life > 0.6 ? '*' : '.'; co[i] = pc(s.Po, q.life);
    }
    // 流星留下的餘痕（慢慢飄散）
    for (let k = s.tr.length - 1; k >= 0; k--) {
      const q = s.tr[k];
      q.age += dt;
      if (q.age > q.life) { kill(s.tr, k); continue; }
      const e = (1 - q.age / q.life) * (q.big ? 0.55 : 0.3), nn = Math.ceil(Math.hypot(q.x1 - q.x0, q.y1 - q.y0));
      for (let j = 0; j <= nn; j += q.big ? 1 : 2) {
        const fr = j / Math.max(1, nn), w = Math.sin(fr * 9 + q.seed + q.age * 0.8) * q.age * (q.big ? 1.2 : 0.6);
        const x = q.x0 + (q.x1 - q.x0) * fr + w * 0.5, y = q.y0 + (q.y1 - q.y0) * fr + (w * 0.4) / aspect + q.age * 0.15;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = (y | 0) * cols + (x | 0);
        if (ch[i] !== ' ' && ch[i] !== '.') continue;
        ch[i] = e > 0.3 ? '~' : '.'; co[i] = pc(q.big ? s.Pw : s.Pr, e * 1.6);
      }
    }
    // ── 地景 ──
    const Pl = s.Pl, lit = 0.25 + glow * 0.5;
    if (zen) {
      const zm = s.zm, c1 = pc(Pl, lit + 0.15), c2 = pc(Pl, lit * 0.6);
      for (let i = 0; i < n; i++) { const z = zm[i]; if (z) { ch[i] = '█'; co[i] = z === 2 ? c1 : c2; } }
    } else if (p.land === 'sea') {
      const hz = Math.floor(s.hz);
      for (let y = hz; y < rows; y++) {
        const dy = y - hz;
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x, sy = hz - 1 - dy, wob = Math.round(Math.sin(y * 1.3 + t * 1.7 + x * 0.05) * (1 + dy * 0.15));
          const sx = x + wob;
          ch[i] = ' ';
          if (sy < 0 || sx < 0 || sx >= cols) continue;
          const j = sy * cols + sx;
          let c = ch[j], hv = 0;
          // 微光色塊裡的格子：只有混進亮點的才會有倒影
          if (c === '█') { hv = hb[j]; if (hv < 0.3) c = ' '; }
          if (c === ' ') { if (hash2(x, y + Math.floor(t * 2)) < 0.025) { ch[i] = '-'; co[i] = pc(s.Pr, 0.2); } continue; }
          const br = hv ? (hv > 0.6 ? 0.9 : 0.55) : c === '*' || c === '@' || c === '+' ? 0.9 : c === '·' || c === ':' ? 0.55 : 0.35;
          ch[i] = br > 0.8 ? '=' : br > 0.5 ? '-' : '~';
          co[i] = pc(s.Pr, br * (1 - dy / (rows - hz + 2) * 0.6));
        }
      }
    } else {
      const dun = p.land === 'dunes';
      // 稜線：上緣那一格用 1/8 高度的方塊字；若背後是微光色塊，改成 █ 並混色，才不會露出黑底
      const pass = (arr, lv, x) => {
        const tp = arr[x], ty = Math.floor(tp);
        for (let y = Math.max(0, ty); y < rows; y++) {
          const i = y * cols + x;
          if (y === ty) {
            const k = Math.round((ty + 1 - tp) * 8);
            if (k <= 0) continue;
            if (ch[i] === '█' && hzC[y]) { co[i] = mixHex(co[i], pc(Pl, lit * lv), k / 8); continue; }
            if (ch[i] === '█') { if (k >= 4) co[i] = pc(Pl, lit * lv); continue; }
            ch[i] = EIGHTH[k]; co[i] = pc(Pl, lit * lv); continue;
          }
          ch[i] = '█'; co[i] = pc(Pl, lit * lv * (dun ? 0.8 + 0.4 * nz(x * 0.3, y) : 1));
        }
      };
      for (let x = 0; x < cols; x++) { pass(s.land2, 0.7, x); pass(s.land, 0.35, x); }
      if (p.land === 'camp') {
        const tx = Math.floor(cols * 0.56), ty = Math.floor(s.land[tx]) , th = Math.max(3, Math.round(rows * 0.12));
        for (let k = 0; k < th; k++) {
          const w = Math.round((k + 1) * aspect * 0.55);
          const yy = ty - th + k + 1;
          if (yy < 0 || yy >= rows) continue;
          const eC = hue ? rgb(120, 100, 80) : f.C(0.35), bC = hue ? rgb(70 + glow * 50, 50, 40) : f.C(0.15), dC = hue ? rgb(30, 22, 18) : f.C(0.06);
          for (let x = -w; x <= w; x++) {
            const xx = tx + x, i = yy * cols + xx;
            if (xx < 0 || xx >= cols) continue;
            // 帳篷整塊用 █；斜邊落在微光色塊上時用混色的 █，落在夜空才用斜線字
            if (Math.abs(x) === w) { if (ch[i] === '█') co[i] = mixHex(co[i], eC, 0.6); else { ch[i] = x < 0 ? '/' : '\\'; co[i] = eC; } }
            else { ch[i] = '█'; co[i] = x === 0 && k > th * 0.45 ? dC : bC; }
          }
        }
        // 營火
        const fx = cols * 0.72, fy = s.land[Math.floor(fx)] - 0.5;
        if (s.fire.length < 70) for (let k = 0; k < 3; k++) s.fire.push({ x: fx + gauss() * 1.2, y: fy, vy: -rnd(2, 6), life: rnd(0.4, 1.2), vx: gauss() * 0.6 });
        for (let k = s.fire.length - 1; k >= 0; k--) {
          const q = s.fire[k];
          q.life -= dt; q.y += q.vy * dt; q.x += q.vx * dt + Math.sin(t * 7 + k) * dt;
          if (q.life <= 0) { kill(s.fire, k); continue; }
          if (q.x < 0 || q.y < 0 || q.x >= cols || q.y >= rows) continue;
          const yi = q.y | 0, i = yi * cols + (q.x | 0);
          if (ch[i] === '█') { co[i] = mixHex(co[i], pc(s.Po, q.life), q.life * 0.8); continue; }
          ch[i] = q.life > 0.8 ? '^' : q.life > 0.4 ? '*' : '.'; co[i] = pc(s.Po, q.life);
        }
        for (let x = -2; x <= 2; x++) g.set(fx + x, fy + 0.6, '█', hue ? rgb(90 + 30 * (x & 1), 50, 30) : f.C(0.3));
        for (let k = 1; k <= 4; k++) { const fl = 0.5 + 0.5 * Math.sin(t * 5 + k); for (let x = -k * 3; x <= k * 3; x += 2) { const i = Math.floor(fy + 1 + k * 0.5) * cols + Math.floor(fx + x); if (i >= 0 && i < n && ch[i] === '█') co[i] = pc(s.Po, (0.18 - k * 0.03) * (0.7 + 0.3 * fl)); } }
      }
    }
  },
});

/* ═════════ 9. 月相 ═════════ */
// 月面貼圖（經度 256 × 緯度 128）：反照率 MA 與高度 MH
const MW = 256, MHh = 128;
let MA = null, MH = null;
function moonMap() {
  if (MA) return;
  tex();
  MA = new Float32Array(MW * MHh); MH = new Float32Array(MW * MHh);
  let seed = 99;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < MHh; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x;
    const m = smooth((nz(x * 0.9 + 30, y * 1.8) * 0.7 + nz(x * 2.3, y * 4.6 + 50) * 0.3 - 0.56) / 0.07);
    MA[i] = 0.66 + 0.1 * (nz(x * 4, y * 8 + 90) - 0.5) - 0.3 * m;
    MH[i] = -m * 0.4 + 0.15 * nz(x * 3 + 11, y * 6);
  }
  for (let k = 0; k < 260; k++) {
    const cx = r() * MW, cy = 8 + r() * (MHh - 16), rad = 1.2 + Math.pow(r(), 3.2) * 13, dep = 0.6 + r() * 0.5, young = r() < 0.08;
    const lat = (cy / MHh - 0.5) * Math.PI, sx = 1 / Math.max(0.25, Math.cos(lat));
    const ext = young ? rad * 4 : rad * 1.4;
    for (let y = Math.floor(cy - ext); y <= cy + ext; y++) {
      if (y < 0 || y >= MHh) continue;
      for (let x = Math.floor(cx - ext * sx); x <= cx + ext * sx; x++) {
        const xx = ((x % MW) + MW) % MW, dx = (x - cx) / sx, dy = y - cy, d = Math.hypot(dx, dy) / rad, i = y * MW + xx;
        if (d < 1) { MH[i] -= dep * (1 - d * d); MA[i] -= 0.05 * (1 - d); }
        else if (d < 1.35) { MH[i] += dep * 0.45 * (1 - Math.abs(d - 1.1) / 0.25); MA[i] += 0.04; }
        if (young && d > 1 && d < 4) { const a = Math.atan2(dy, dx), ray = Math.pow(0.5 + 0.5 * Math.cos(a * 7 + k), 10); MA[i] += 0.16 * ray * (1 - (d - 1) / 3); }
      }
    }
  }
}
function mSample(A, u, v) {
  const x = u - Math.floor(u / MW) * MW, y = clamp(v, 0, MHh - 1.001), xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, x1 = (xi + 1) % MW, y1 = Math.min(MHh - 1, yi + 1);
  const a = A[yi * MW + xi], b = A[yi * MW + x1], c = A[y1 * MW + xi], d = A[y1 * MW + x1];
  return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
}
const PHASES = ['新月', '眉月', '上弦月', '盈凸月', '滿月', '虧凸月', '下弦月', '殘月'];
const PHASES_EN = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
const phaseName = (ph, f) => tr(f, PHASES, PHASES_EN)[(Math.round((((ph % TAU) + TAU) % TAU) / (Math.PI / 4)) % 8)];
// 畫月球：(cx,cy) 格，R 欄寬單位；L=[x,y,z]（y 向上）光線；rot 經度旋轉；opt.shadow(x,y) → 0–1 遮蔽；opt.relief 地形陰影強度
// opt.cache：傳入一個物件就把每格的幾何與貼圖取樣存起來（月球不動時每格只剩打光計算）
function moonDisk(f, hue, cx, cy, R, L, rot, opt) {
  const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co;
  opt = opt || {};
  const rel = opt.relief || 2.2, es = opt.earthshine === undefined ? 0.05 : opt.earthshine, tint = opt.tint || [214, 208, 196];
  const ry = R / aspect;
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(rows - 1, Math.ceil(cy + ry));
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(cols - 1, Math.ceil(cx + R));
  let C = opt.cache;
  const key = cx + ',' + cy + ',' + R + ',' + rot + ',' + cols + ',' + rows;
  if (!C || C.key !== key) {
    const idx = [], dat = [];
    for (let y = y0; y <= y1; y++) {
      const Ny = -((y + 0.5 - cy) * aspect) / R;
      for (let x = x0; x <= x1; x++) {
        const Nx = (x + 0.5 - cx) / R, d2 = Nx * Nx + Ny * Ny;
        if (d2 > 1) continue;
        const Nz = Math.sqrt(1 - d2), lv = Math.atan2(Nx, Nz), lon = lv + rot, lat = Math.asin(Ny);
        const u = (lon / TAU) * MW, v = (lat / Math.PI + 0.5) * MHh;
        const alb = mSample(MA, u, v);
        const gx = mSample(MH, u + 1, v) - mSample(MH, u - 1, v), gy = mSample(MH, u, v + 1) - mSample(MH, u, v - 1);
        const cl = Math.cos(lv), sl = Math.sin(lv), sla = Math.sin(lat), cla = Math.cos(lat);
        idx.push(y * cols + x);
        // 法線、地形梯度投影到「東」「北」後合成的擾動向量
        dat.push(Nx, Ny, Nz, alb, gx * cl - gy * sla * sl, gy * cla, -gx * sl - gy * sla * cl);
      }
    }
    C = { key, idx: Int32Array.from(idx), dat: Float32Array.from(dat) };
    if (opt.cache) Object.assign(opt.cache, C);
  }
  const idx = C.idx, dat = C.dat, n = idx.length, k = rel * 0.5;
  for (let j = 0, q = 0; j < n; j++, q += 7) {
    const i = idx[j], alb = dat[q + 3];
    const dif = dat[q] * L[0] + dat[q + 1] * L[1] + dat[q + 2] * L[2];
    let b;
    if (dif > 0) {
      const pert = dat[q + 4] * L[0] + dat[q + 5] * L[1] + dat[q + 6] * L[2];
      const lit = clamp(dif - k * pert * (0.4 + 0.6 * smooth(1 - dif * 3)), 0, 1.2);
      b = alb * Math.pow(lit, 0.75) + es * alb;
    } else b = es * alb;
    let c = tint;
    if (opt.shadow) { const x = i % cols, y = (i / cols) | 0, sh = opt.shadow(x, y); if (sh > 0) { b *= 1 - sh * 0.88; c = mixc(tint, [190, 70, 30], Math.min(1, sh * 1.3)); b += sh * 0.06 * alb; } }
    if (b < 0.035) { ch[i] = '.'; co[i] = hue ? shade(c, 0.1) : f.C(0.03); continue; }
    if (b > 1) b = 1;
    ch[i] = R10[Math.max(1, Math.min(9, (b * 9.6) | 0))];
    co[i] = hue ? shade(c, 0.12 + 0.95 * b) : f.C(0.05 + 0.92 * b);
  }
}
A({ id: 'sp-moon', name: '月相', cat: '太空', theme: 'mono', hue: true, desc: '坑洞清晰的月亮由新月轉到滿月',
  params: { mode: 'cycle', period: 48 },
  variants: [
    { id: 'eclipse', name: '月全食', desc: '地球影子掃過，滿月染成古銅紅', params: { mode: 'eclipse' } },
    { id: 'row', name: '月相輪轉', desc: '一排八個月亮依序盈虧', params: { mode: 'row', period: 32 } },
    { id: 'clouds', name: '雲間月', desc: '雲朵飄過明月，月暈若隱若現', params: { mode: 'clouds' } },
    { id: 'earthrise', name: '地出', desc: '藍色地球從月面地平線升起', params: { mode: 'earthrise' } },
    { id: 'terminator', name: '晨昏線', desc: '近看明暗交界，坑洞投下長影', params: { mode: 'terminator' } },
  ],
  init(s, f) {
    moonMap();
    const { cols, rows } = f;
    s.key = null;
    s.stars = mkStars(Math.max(30, (cols * rows / 40) | 0));
    s.T = rnd(0, 10); s.mc = null; s.mcs = null;
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.6);
    s.Pt = pal(f, h, [[80, 80, 90], [200, 200, 210]], 0.3, 0.7);
    s.Pc = pal(f, h, [[20, 22, 34], [90, 94, 120], [200, 204, 222], [255, 255, 255]], 0.05, 0.85);
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode;
    s.T += f.dt;
    const T = s.T;
    if (hue) f.bg = rgb(2, 3, 8);
    const lab = col => pc(s.Pt, col);
    const Lph = ph => [Math.sin(ph), 0, -Math.cos(ph)];
    let starDim = 1;
    if (m === 'cycle') {
      const ph = ((T / p.period) * TAU) % TAU, R = Math.min(rows * 0.43 * aspect, cols * 0.3);
      moonDisk(f, hue, cols / 2, rows * 0.47, R, Lph(ph), 0.15, { cache: s.mc || (s.mc = {}) });
      if (cols >= 120) ctext(g, cols / 2, Math.min(rows - 1, rows * 0.47 + R / aspect + 1.5), phaseName(ph, f), lab(0.6));
    } else if (m === 'eclipse') {
      const R = Math.min(rows * 0.36 * aspect, cols * 0.22), cx = cols / 2, cy = rows / 2, cyc = 56, u = (T % cyc) / cyc;
      const Ru = R * 2.6, Rpn = R * 4.4, span = Rpn + R * 1.2, ux = cx - span + u * 2 * span, uy = cy + (R * 0.25) / aspect;
      const shadow = (x, y) => {
        const d = Math.hypot(x + 0.5 - ux, (y + 0.5 - uy) * aspect);
        if (d > Rpn) return 0;
        if (d > Ru) return 0.35 * (1 - (d - Ru) / (Rpn - Ru));
        return 0.6 + 0.4 * smooth((Ru - d) / (R * 0.6));
      };
      const dc = Math.hypot(cx - ux, (cy - uy) * aspect);
      starDim = 1 + (dc < Ru ? 0.6 : 0);
      moonDisk(f, hue, cx, cy, R, [0.05, 0.02, 1], 0, { shadow, earthshine: 0, cache: s.mc || (s.mc = {}) });
      if (cols >= 120) ctext(g, cx, Math.min(rows - 1, cy + R / aspect + 1.5), dc < Ru - R ? tr(f, '全食', 'Totality') : dc < Ru + R ? tr(f, '偏食', 'Partial eclipse') : dc < Rpn + R ? tr(f, '半影食', 'Penumbral eclipse') : tr(f, '滿月', 'Full Moon'), lab(0.6));
    } else if (m === 'row') {
      // 兩列各四個（窄畫面兩列各兩個），由左到右、由上到下依序盈虧
      const n = cols >= 60 ? 8 : 4, nc = n / 2, R = Math.min((cols / nc) * 0.38, rows * 0.2 * aspect);
      for (let k = 0; k < n; k++) {
        const ph = ((T / p.period) * TAU + (k * TAU) / n) % TAU, x = (cols * ((k % nc) + 0.5)) / nc, y = rows * (k < nc ? 0.25 : 0.7);
        if (!s.mcs) s.mcs = [];
        moonDisk(f, hue, x, y, R, Lph(ph), k * 0.7, { relief: 1.5, cache: s.mcs[k] || (s.mcs[k] = {}) });
        if (cols >= 120) ctext(g, x, Math.min(rows - 1, y + R / aspect + 1.5), phaseName(ph, f), lab(0.55));
      }
    } else if (m === 'clouds') {
      const R = Math.min(rows * 0.26 * aspect, cols * 0.16), cx = cols * 0.62, cy = rows * 0.4;
      // 月暈
      const hr = R * 3.1;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * aspect), i = y * cols + x;
        let v = 0;
        if (d > R && d < R * 2.2) v = 0.35 * Math.pow(1 - (d - R) / (R * 1.2), 2);
        const hv = Math.exp(-(((d - hr) / (R * 0.12)) ** 2)) * 0.22;
        v = Math.max(v, hv);
        if (v > 0.06) { ch[i] = v > 0.2 ? ':' : '.'; co[i] = pc(s.Pc, v * 1.2); }
      }
      moonDisk(f, hue, cx, cy, R, Lph(Math.PI * 0.86), 0.2, { relief: 1.6, cache: s.mc || (s.mc = {}) });
      // 雲
      const sp = T * 1.6, kc = 70 / cols;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const u = x * kc + sp, v = y * kc * aspect * 1.4 + 40;
        const dsty = smooth((nz(u, v) * 0.7 + nz(u * 3.2 + 30, v * 3.2) * 0.3 - 0.47) / 0.2);
        if (dsty < 0.1) continue;
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * aspect) / R;
        const lit = 0.32 + 0.8 * Math.exp(-Math.max(0, d - 0.8) * 0.6);
        const i = y * cols + x, b = dsty * lit;
        if (dsty < 0.45 && ch[i] !== ' ' && ch[i] !== '.' && ch[i] !== ':') continue;
        ch[i] = b > 0.62 ? '@' : b > 0.48 ? '%' : b > 0.36 ? '#' : b > 0.26 ? '+' : b > 0.17 ? '=' : b > 0.09 ? '-' : '.';
        co[i] = pc(s.Pc, b * 0.9);
      }
    } else if (m === 'earthrise') {
      const hz = rows * 0.68, cyc = 70, u = (T % cyc) / cyc;
      const ER = Math.min(rows * 0.2 * aspect, cols * 0.13), ex = cols * 0.58, ey = hz + ER / aspect * 1.1 - u * (hz - rows * 0.12 + ER / aspect);
      // 地球
      const ry = ER / aspect, rot = T * 0.06;
      for (let y = Math.max(0, Math.floor(ey - ry)); y <= Math.min(rows - 1, ey + ry); y++) for (let x = Math.max(0, Math.floor(ex - ER)); x <= Math.min(cols - 1, ex + ER); x++) {
        const Nx = (x + 0.5 - ex) / ER, Ny = -((y + 0.5 - ey) * aspect) / ER, d2 = Nx * Nx + Ny * Ny;
        if (d2 > 1) continue;
        const Nz = Math.sqrt(1 - d2), lon = Math.atan2(Nx, Nz) + rot, lat = Math.asin(Ny);
        const tu = (lon / TAU) * 256, tv = (lat / Math.PI + 0.5) * 128;
        const land = nz(tu * 0.8, tv * 1.4) > 0.6, cloud = smooth((nz(tu * 1.6 + 70 - T * 0.4, tv * 3) - 0.55) / 0.15), ice = Math.abs(lat) > 1.2;
        const dif = clamp(Nx * 0.92 + Nz * 0.3 + Ny * 0.1, 0, 1), b = 0.05 + 0.95 * dif;
        const i = y * cols + x, br = b * (cloud > 0.3 || ice ? 1 : 0.75);
        ch[i] = br < 0.08 ? '.' : R10[Math.max(1, Math.min(9, (br * 9.5) | 0))];
        co[i] = hue ? (ice ? mixShd(235, 240, 250, 245, 248, 255, cloud * 0.85, 0.1 + 0.95 * br) : land ? mixShd(90, 130, 70, 245, 248, 255, cloud * 0.85, 0.1 + 0.95 * br) : mixShd(40, 80, 190, 245, 248, 255, cloud * 0.85, 0.1 + 0.95 * br)) : f.C(0.05 + 0.9 * br);
      }
      for (let y = 0; y < rows; y++) {
        const yy = y + 0.5;
        for (let x = 0; x < cols; x++) {
          const curve = hz + Math.pow((x - cols / 2) / cols, 2) * rows * 0.25 - nz(x * 0.3, 5) * 1.6;
          if (yy < curve) continue;
          const i = y * cols + x, z = 1 / Math.max(0.02, (yy - hz) / rows + 0.02);
          const tx = (x - cols / 2) * 0.02 * z * 3, tz = z * 4;
          const cr = nz(tx + 40, tz), hgt = nz(tx * 3 + 9, tz * 3);
          const b = clamp(0.25 + 0.55 * hgt + (cr > 0.7 ? -0.2 : cr > 0.62 ? 0.15 : 0), 0, 1) * (0.45 + 0.55 * Math.min(1, 6 / z));
          ch[i] = R10[Math.max(1, Math.min(9, (b * 9) | 0))];
          co[i] = hue ? shd(180, 176, 170, 0.15 + 0.8 * b) : f.C(0.05 + 0.75 * b);
        }
      }
    } else if (m === 'terminator') {
      const R = cols * 0.75, cx = cols * 0.42, cy = rows * 0.5 + R / aspect * 0.05;
      const ph = Math.PI * 0.55 + 0.3 * Math.sin(T * 0.03);
      moonDisk(f, hue, cx, cy, R, Lph(ph), 0.3, { relief: 4.5, earthshine: 0.03, cache: s.mc || (s.mc = {}) });
    } else {
      // 公轉圖解
      const ph = ((T / p.period) * TAU) % TAU;
      const dw = cols * 0.6, ecx = dw * 0.55, ecy = rows / 2, orR = Math.min(dw * 0.4, rows * 0.4 * aspect);
      for (let y = 2; y < rows; y += 5) for (let x = 2; x < dw - 4; x += 14) g.set(x + ((y * 5 + Math.floor(T * 3)) % 14), y, '→', hue ? rgb(110, 92, 40) : f.C(0.18));
      const N = Math.ceil(orR * 5);
      for (let j = 0; j < N; j += 2) { const a = (j / N) * TAU; g.set(ecx + orR * Math.cos(a), ecy + (orR * Math.sin(a)) / aspect, '·', pc(s.Pt, 0.4)); }
      const er = Math.max(1.5, orR * 0.17);
      ball(f, hue, ecx, ecy, er, -1, 0, 0.25, [70, 130, 230], 0.05);
      // 月球位置：相位 0（新月）在地球和太陽之間（左側）
      for (let k = 0; k < 8; k++) {
        const a = Math.PI + (k * TAU) / 8, mx = ecx + orR * Math.cos(a), my = ecy - (orR * Math.sin(a)) / aspect;
        g.set(mx, my, 'o', pc(s.Pt, 0.3));
      }
      const a = Math.PI + ph, mx = ecx + orR * Math.cos(a), my = ecy - (orR * Math.sin(a)) / aspect;
      ball(f, hue, mx, my, Math.max(1, er * 0.55), -1, 0, 0.1, [220, 215, 200], 0.03);
      g.line(ecx, ecy, mx, my, '.', pc(s.Pt, 0.3));
      const R = Math.min(cols * 0.17, rows * 0.36 * aspect), ix = cols * 0.8;
      moonDisk(f, hue, ix, rows * 0.45, R, Lph(ph), 0, { relief: 1.6, cache: s.mc || (s.mc = {}) });
      if (cols >= 120) {
        ctext(g, ix, Math.min(rows - 1, rows * 0.45 + R / aspect + 1.5), tr(f, '從地球看：' + phaseName(ph, f), 'Seen from Earth: ' + phaseName(ph, f)), lab(0.65));
        txt(g, 2, rows - 2, tr(f, '陽光 →', 'Sunlight →'), lab(0.5));
      }
    }
    drawStars(f, s.stars, s.Ps, 0, 0, m === 'clouds' ? 0.7 : starDim);
  },
});

/* ═════════ 10. 日食 ═════════ */
// 兩圓重疊面積占第一個圓的比例
function overlapFrac(R, r, d) {
  if (d >= R + r) return 0;
  if (d <= Math.abs(R - r)) return r >= R ? 1 : (r * r) / (R * R);
  const a = Math.acos(clamp((d * d + R * R - r * r) / (2 * d * R), -1, 1)), b = Math.acos(clamp((d * d + r * r - R * R) / (2 * d * r), -1, 1));
  const area = R * R * a + r * r * b - 0.5 * Math.sqrt(Math.max(0, (-d + R + r) * (d + R - r) * (d - R + r) * (d + R + r)));
  return area / (Math.PI * R * R);
}
A({ id: 'sp-eclipse', name: '日食', cat: '太空', theme: 'gold', hue: true, desc: '月球遮住太陽，日冕在黑暗中展開',
  params: { mode: 'total', rm: 1.06, cyc: 50 },
  variants: [
    { id: 'annular', name: '海上金環', desc: '海上夕陽被月亮遮成一圈火環', params: { mode: 'annular', rm: 0.88, cyc: 50 } },
    { id: 'horizon', name: '地景日食', desc: '天色驟暗，四周地平線泛起晚霞', params: { mode: 'horizon', cyc: 60 } },
    { id: 'transit', name: '行星凌日', desc: '小黑點緩緩橫越布滿黑子的日面', params: { mode: 'transit', cyc: 60 } },
    { id: 'space', name: '太空俯瞰', desc: '月影在地球表面掠過', params: { mode: 'space', cyc: 40 } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f;
    s.key = null; s.T = rnd(0, 4);
    s.stars = mkStars(Math.max(30, (cols * rows / 40) | 0));
    s.str = [];
    for (let k = 0; k < 14; k++) s.str.push([rnd(0, TAU), rnd(0.3, 1), rnd(0.05, 0.2)]);
    s.prom = [];
    for (let k = 0; k < 5; k++) s.prom.push([rnd(0, TAU), rnd(0.04, 0.09), rnd(0.03, 0.08)]);
    if (p.mode === 'pinhole') {
      s.spots = [];
      const n = Math.max(10, (cols * rows / 380) | 0);
      for (let k = 0; k < n; k++) s.spots.push({ x: rnd(0, cols), y: rnd(0, rows), r: rnd(4, 8) * Math.max(0.8, cols / 220), ph: rnd(0, TAU) });
    }
    if (p.mode === 'transit') {
      s.spotsS = [];
      for (let k = 0; k < 7; k++) s.spotsS.push([rnd(-1, 1) * 1.2, rnd(-0.45, 0.45), rnd(0.02, 0.06)]);
    }
    if (p.mode === 'horizon') {
      s.land = new Float32Array(cols);
      for (let x = 0; x < cols; x++) s.land[x] = rows * (0.8 - 0.07 * nz((x / cols) * 30, 4) - 0.04 * nz((x / cols) * 90, 9));
      s.people = [];
      for (let k = 0; k < Math.max(2, cols / 30); k++) s.people.push(rnd(0.1, 0.9) * cols);
    }
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.6);
    s.Psun = pal(f, h, [[150, 60, 0], [255, 170, 40], [255, 230, 140], [255, 255, 235]], 0.45, 1);
    s.Pco = pal(f, h, [[20, 24, 50], [90, 100, 150], [200, 210, 240], [255, 255, 255]], 0.06, 0.9);
    s.Ppr = pal(f, h, [[90, 10, 30], [255, 60, 110], [255, 170, 200]], 0.3, 0.9);
    s.Pg = pal(f, h, [[30, 50, 30], [90, 120, 60], [160, 170, 100]], 0.05, 0.3);
    s.Pl = pal(f, h, [[4, 4, 8], [20, 20, 30]], 0.02, 0.12);
    s.EPi = mixPal(f, h, [235, 240, 250], [245, 248, 255], 4, 0.08, 1.03, 0.04, 0.94);
    s.EPl = mixPal(f, h, [100, 140, 70], [245, 248, 255], 4, 0.08, 1.03, 0.04, 0.94);
    s.EPo = mixPal(f, h, [30, 80, 200], [245, 248, 255], 4, 0.08, 1.03, 0.04, 0.94);
    s.Pcl = mixPal(f, h, [120, 90, 150], [255, 170, 90], 6, 0.25, 1.05, 0.06, 0.6);
  },
  // 太陽＋月亮＋日冕（共用）
  disc(f, s, cx, cy, R, mx, my, Rm, opt) {
    const { g, cols, rows, aspect, t } = f, ch = g.ch, co = g.co, hue = s.hue;
    const d = Math.hypot(mx - cx, (my - cy) * aspect), cov = overlapFrac(R, Rm, d);
    const tot = Rm >= R && d < Rm - R * 0.995;
    const cVis = smooth((cov - 0.93) / 0.07) * (Rm >= R ? 1 : 0.25);
    const ext = R * (opt.ext || 4), ry = ext / aspect;
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(rows - 1, Math.ceil(cy + ry));
    const x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(cols - 1, Math.ceil(cx + ext));
    const moonCol = hue ? rgb(3, 3, 7) : f.C(0);
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) * aspect, mdy = (y + 0.5 - my) * aspect;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, b = Math.sqrt(dx * dx + dy * dy), i = y * cols + x;
        const mdx = x + 0.5 - mx, bm = Math.sqrt(mdx * mdx + mdy * mdy);
        if (bm < Rm) { ch[i] = '█'; co[i] = moonCol; continue; }
        if (b < R) {
          const mu = Math.sqrt(1 - (b * b) / (R * R)), gr = nz(x * 0.9 + t * 2, y * 1.8);
          const v = 0.55 + 0.45 * mu * (0.85 + 0.3 * gr);
          ch[i] = v > 0.92 ? '@' : v > 0.8 ? '#' : v > 0.68 ? '%' : '*';
          co[i] = pc(s.Psun, v);
          continue;
        }
        const r = b / R, a = Math.atan2(dy, dx);
        let I = 0, pk = 0;
        if (cVis > 0) {
          let st = 0.35;
          for (const S of s.str) { let da = Math.abs(a - S[0]); if (da > Math.PI) da = TAU - da; st += S[1] * Math.exp(-((da / (S[2] * (1 + (r - 1) * 0.6))) ** 2)); }
          st *= 0.75 + 0.5 * nz((a / TAU) * 256 * 3, r * 4 - t * 0.05);
          I = Math.max(I, Math.min(1, Math.pow(1 / r, 3.2) * st * 1.4) * cVis);
          for (const P of s.prom) { let da = Math.abs(a - P[0]); if (da > Math.PI) da = TAU - da; const h = (r - 1) / P[2]; if (da < P[1] && h < 1 - (da / P[1]) ** 2 + 0.2 * Math.sin(t + P[0] * 5) && h > -0.1) { pk = Math.max(pk, (1 - h * 0.6) * cVis); } }
          if (r < 1.035) pk = Math.max(pk, 0.6 * cVis);
        }
        const glare = (1 - cov) * 0.6 / (r * r * r) * (opt.glare === undefined ? 1 : opt.glare);
        if (pk > 0.2) { ch[i] = pk > 0.6 ? '#' : '*'; co[i] = pc(s.Ppr, pk); continue; }
        const v = Math.max(I, glare);
        if (v < 0.06) continue;
        ch[i] = R10[Math.max(1, Math.min(8, (v * 9) | 0))];
        co[i] = glare > I ? pc(s.Psun, 0.35 + glare * 0.5) : pc(s.Pco, v);
      }
    }
    // 鑽石環：接觸前後的一瞬間
    if (Rm >= R) {
      const edge = d - (Rm - R);
      if (edge > -R * 0.02 && edge < R * 0.08 && d > 0.001) {
        const k = Math.max(0, 1 - Math.abs(edge - R * 0.02) / (R * 0.06));
        const ux = (cx - mx) / d, uy = ((cy - my) * aspect) / d, px = cx + ux * R, py = cy + (uy * R) / aspect;
        const L = Math.round(R * 0.9 * k);
        for (let j = 1; j <= L; j++) {
          const v = k * (1 - j / (L + 1));
          const c = pc(s.Psun, 0.5 + v * 0.5);
          g.set(px + j, py, '-', c); g.set(px - j, py, '-', c); g.set(px, py + j / aspect, '|', c); g.set(px, py - j / aspect, '|', c);
        }
        if (k > 0.05) g.set(px, py, '✦', pc(s.Psun, 1));
      }
    }
    return { cov, tot };
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode;
    s.T += f.dt;
    const u = (s.T % p.cyc) / p.cyc;
    if (m === 'total' || m === 'horizon') {
      const hor = m === 'horizon';
      const R = hor ? Math.max(2, rows * 0.085 * aspect) : Math.min(rows * 0.24 * aspect, cols * 0.14);
      const cx = hor ? cols * 0.6 : cols / 2, cy = hor ? rows * 0.3 : rows / 2;
      const Rm = R * p.rm, span = (R + Rm) * 1.25, w = 1 - 2 * u, ew = Math.sign(w) * Math.pow(Math.abs(w), 2.2), mx = cx + span * ew, my = cy + (-ew * R * 0.12) / aspect;
      const d0 = Math.hypot(mx - cx, (my - cy) * aspect), cov = overlapFrac(R, Rm, d0);
      const dark = Math.pow(cov, 6);
      if (hue) f.bg = hor ? rgb(70 * (1 - dark) + 6, 110 * (1 - dark) + 8, 170 * (1 - dark) + 20) : rgb(30 * (1 - dark) + 2, 50 * (1 - dark) + 3, 100 * (1 - dark) + 8);
      this.disc(f, s, cx, cy, R, mx, my, Rm, { ext: hor ? 9 : 4, glare: hor ? 0.5 : 1 });
      if (hor) {
        // 地平線一圈晚霞（█ 色塊）：畫在日冕之後；落在色塊裡的日冕字改成 █ 並把亮度混進去，不會挖出黑格
        for (let x = 0; x < cols; x++) {
          const tp = s.land[x];
          for (let y = Math.max(0, Math.floor(tp - rows * 0.16)); y < tp; y++) {
            const h = (tp - y) / (rows * 0.16), v = dark * (1 - h) * 0.9;
            if (v < 0.05) continue;
            const i = y * cols + x, bc = hue ? rgb(255 * v, 120 * v, 50 * v + 20 * (1 - v)) : f.C(v * 0.5), c0 = ch[i];
            if (c0 === ' ') { ch[i] = '█'; co[i] = bc; }
            else if (c0 !== '█') { const k = R10.indexOf(c0); ch[i] = '█'; co[i] = addHex(bc, co[i], 0.3 + 0.6 * (k > 0 ? k / 9 : 0.6)); }
          }
        }
        const Pl = s.Pl;
        for (let x = 0; x < cols; x++) for (let y = Math.max(0, Math.floor(s.land[x])); y < rows; y++) { const i = y * cols + x; ch[i] = '█'; co[i] = pc(Pl, 0.3 + 0.3 * (1 - dark)); }
        // 觀測的人：兩格高的剪影
        for (const px of s.people) { const y = Math.floor(s.land[Math.floor(px)]) - 1; g.set(px, y, '█', pc(Pl, 0.12)); g.set(px, y - 1, '█', pc(Pl, 0.12)); }
        if (dark > 0.3) g.set(cols * 0.3, rows * 0.22, '*', hue ? rgb(255 * dark, 250 * dark, 230 * dark) : f.C(dark));
      }
      drawStars(f, s.stars, s.Ps, 0, 0, dark);
      if (cols >= 120 && !hor) ctext(g, cx, rows - 2, cov > 0.999 && p.rm >= 1 ? tr(f, '全食', 'Totality') : cov > 0.85 && p.rm < 1 && d0 < R - Rm ? tr(f, '金環', 'Annular') : cov > 0.02 ? tr(f, '食分 ', 'Coverage ') + Math.round(cov * 100) + '%' : '', pc(s.Pco, 0.5));
    } else if (m === 'annular') {
      // 海上金環：夕陽低懸在海平面上，月亮把它遮成一圈火環，海面拉出一道金色倒影
      const hz = Math.floor(rows * 0.63);
      const R = Math.min(rows * 0.19 * aspect, cols * 0.11), cx = cols * 0.5, cy = rows * 0.38;
      const Rm = R * p.rm, span = (R + Rm) * 1.3, w = 1 - 2 * u, ew = Math.sign(w) * Math.pow(Math.abs(w), 2.2), mx = cx + span * ew, my = cy + (ew * R * 0.18) / aspect;
      const d0 = Math.hypot(mx - cx, (my - cy) * aspect), cov = overlapFrac(R, Rm, d0), dark = Math.pow(cov / ((Rm * Rm) / (R * R)), 3) * 0.6;
      if (hue) f.bg = rgb(lerp(62, 22, dark), lerp(30, 14, dark), lerp(46, 34, dark));
      // 晚霞雲條：幾層細長的橫條（每層一條雜訊），靠近太陽的被照成金橘色
      const Pcl = s.Pcl, kx = 150 / cols, th = Math.max(0.8, rows * 0.02);
      for (let j = 0; j < 7; j++) {
        const yc = hz * (0.1 + 0.115 * j) + Math.sin(j * 2.3) * rows * 0.02, y0 = Math.max(0, Math.floor(yc - th * 2)), y1 = Math.min(hz - 1, Math.ceil(yc + th * 2));
        for (let y = y0; y < y1; y++) {
          const vy = Math.exp(-(((y + 0.5 - yc) / th) ** 2));
          if (vy < 0.2) continue;
          for (let x = 0; x < cols; x++) {
            const c = nz(x * kx + j * 37 + t * (0.8 + j * 0.15), j * 19.3 + (y - yc) * 0.8) * 0.75 + nz(x * kx * 3 - t * 0.5, j * 7 + y * 0.9) * 0.25;
            const v = smooth((c - 0.56) / 0.2) * vy;
            if (v < 0.15) continue;
            const i = y * cols + x, dd = Math.hypot(x - cx, (y - cy) * aspect) / (cols * 0.45);
            const lit = clamp((1 - dd) * (1 - dark * 0.8), 0, 1);
            ch[i] = v > 0.65 ? '=' : v > 0.38 ? '-' : '.';
            co[i] = mp(Pcl, lit, 0.25 + 0.6 * v);
          }
        }
      }
      this.disc(f, s, cx, cy, R, mx, my, Rm, { ext: 3.2, glare: 0.8 });
      // 遠方的島
      const Pl = s.Pl;
      for (let x = Math.floor(cols * 0.72); x < cols; x++) {
        const hh = Math.max(0, rows * 0.07 * Math.sin(((x - cols * 0.72) / (cols * 0.28)) * Math.PI * 0.9) + rows * 0.02 * (nz(x * 0.4, 5) - 0.5));
        for (let y = Math.max(0, Math.floor(hz - hh)); y < hz; y++) { const i = y * cols + x; ch[i] = '█'; co[i] = pc(Pl, 0.18); }
      }
      // 海面：倒影（上下顛倒、隨波晃動）＋太陽正下方的金色光柱
      for (let y = hz; y < rows; y++) {
        const dy = y - hz, depth = dy / (rows - hz);
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x, wob = Math.round(Math.sin(y * 1.9 + t * 1.6 + x * 0.07) * (0.6 + dy * 0.35));
          const sy = hz - 1 - Math.floor(dy * 1.15), sx = x + wob;
          let c = ' ', sc = null;
          if (sy >= 0 && sx >= 0 && sx < cols) { const j = sy * cols + sx; c = ch[j]; sc = co[j]; }
          ch[i] = ' ';
          if (c !== ' ' && c !== '█' && hash2(x, y * 3 + Math.floor(t * 4)) > 0.25) {
            const k = R10.indexOf(c), b = k > 0 ? k / 9 : c === '=' ? 0.6 : 0.4;
            ch[i] = b > 0.65 ? '=' : b > 0.35 ? '-' : '~'; co[i] = mixHex(sc, hue ? rgb(20, 14, 30) : f.C(0.05), 0.25 + 0.4 * depth);
            continue;
          }
          const gw = R * (0.7 + depth * 1.6), gx = Math.abs(x + 0.5 - cx);
          if (gx < gw) {
            const sh = (1 - gx / gw) * (1 - cov * 0.7);
            if (hash2(x + Math.floor(t * 3), y) < 0.25 + sh * 0.6) { ch[i] = sh > 0.5 ? '=' : '-'; co[i] = pc(s.Psun, 0.3 + sh * 0.6); continue; }
          }
          if (hash2(x, y + Math.floor(t * 2)) < 0.04) { ch[i] = '~'; co[i] = pc(s.Pco, 0.15 + 0.1 * (1 - depth)); }
        }
      }
      if (cols >= 120) ctext(g, cx, rows - 2, cov > 0.6 && d0 < R - Rm ? tr(f, '金環食', 'Annular eclipse') : cov > 0.02 ? tr(f, '食分 ', 'Coverage ') + Math.round(cov * 100) + '%' : '', pc(s.Pco, 0.55));
    } else if (m === 'pinhole') {
      // 樹蔭下：地面＋晃動的葉影光斑，每個光斑都是日食的月牙形
      if (hue) f.bg = rgb(16, 20, 12);
      const dmax = 2.2, dd = dmax * Math.abs(Math.cos(u * Math.PI)) + 0.18, ang = 0.6;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const n = nz(x * 0.5 + t * 0.3, y * 1.1);
        if (n < 0.45) continue;
        const i = y * cols + x;
        ch[i] = n > 0.75 ? ':' : '.'; co[i] = pc(s.Pg, (n - 0.45) * 0.8);
      }
      for (const q of s.spots) {
        const sx = q.x + Math.sin(t * 0.7 + q.ph) * 1.2 + nz(t * 0.4 + q.ph * 10, 3) * 2, sy = q.y + Math.cos(t * 0.5 + q.ph) * 0.4;
        const r = q.r, ry = r / aspect, ox = Math.cos(ang) * dd * r * 0.5, oy = Math.sin(ang) * dd * r * 0.5;
        for (let y = Math.floor(sy - ry); y <= sy + ry; y++) for (let x = Math.floor(sx - r); x <= sx + r; x++) {
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const dx = x + 0.5 - sx, dy = (y + 0.5 - sy) * aspect;
          if (dx * dx + dy * dy > r * r) continue;
          const ex = dx - ox, ey = dy - oy;
          if (ex * ex + ey * ey < r * r * 1.02) continue;
          const v = 0.75 + 0.25 * (1 - Math.hypot(dx, dy) / r);
          g.set(x, y, v > 0.9 ? '@' : '#', hue ? shd(255, 236, 170, v) : f.C(v));
        }
      }
    } else if (m === 'transit') {
      if (hue) f.bg = rgb(0, 0, 0);
      const R = Math.min(cols * 0.47, rows * 0.7 * aspect), cx = cols / 2, cy = rows * 0.5 + R / aspect * 0.18;
      const pr = Math.max(1, R * 0.035), px = cx + R * 1.1 * (1 - 2 * u), py = cy - R * 0.45 / aspect + (u * R * 0.12) / aspect;
      const rot = s.T * 0.004, SP = [];
      for (const S of s.spotsS) {
        const sxp = S[0] + rot * 2, lz = Math.cos(sxp) * Math.cos(S[1]);
        if (lz > 0) SP.push([Math.sin(sxp) * Math.cos(S[1]), Math.sin(S[1]), S[2]]);
      }
      for (let y = 0; y < rows; y++) {
        const dy = (y + 0.5 - cy) * aspect;
        for (let x = 0; x < cols; x++) {
          const dx = x + 0.5 - cx, b2 = dx * dx + dy * dy, i = y * cols + x;
          if (b2 > R * R * 1.2) continue;
          if (b2 > R * R) { const v = (1.2 - b2 / (R * R)) * 1.5; if (v > 0.08) { ch[i] = '.'; co[i] = pc(s.Psun, 0.2 + v * 0.3); } continue; }
          const mu = Math.sqrt(1 - b2 / (R * R)), nx = dx / R, ny = dy / R;
          const gr = nz(x * 0.8 + t * 0.6, y * 1.7 + t * 0.3) * 0.6 + nz(x * 2.1, y * 4.2 - t) * 0.4;
          let v = (0.4 + 0.6 * mu) * (0.82 + 0.3 * gr);
          for (let k = 0; k < SP.length; k++) {
            const S = SP[k], ddx = nx - S[0], ddy = ny - S[1];
            if (ddx > S[2] * 2.2 || ddx < -S[2] * 2.2) continue;
            const dd = Math.sqrt(ddx * ddx + ddy * ddy) / S[2];
            if (dd < 1) v *= 0.2 + 0.3 * smooth(dd / 0.55);
            else if (dd < 2.2) v *= 0.75 + 0.25 * smooth((dd - 1) / 1.2);
          }
          ch[i] = v > 0.88 ? '@' : v > 0.74 ? '#' : v > 0.6 ? '%' : v > 0.45 ? '*' : v > 0.3 ? '+' : v > 0.18 ? '=' : '-';
          co[i] = pc(s.Psun, v);
        }
      }
      for (let y = Math.floor(py - pr / aspect) - 1; y <= py + pr / aspect + 1; y++) for (let x = Math.floor(px - pr) - 1; x <= px + pr + 1; x++) {
        if (Math.hypot(x + 0.5 - px, (y + 0.5 - py) * aspect) < pr) g.set(x, y, '█', hue ? rgb(4, 4, 8) : f.C(0));
      }
      if (cols >= 120) txt(g, 2, rows - 2, tr(f, '凌日進度 ', 'Transit progress ') + Math.round(u * 100) + '%', pc(s.Pco, 0.5));
    } else if (m === 'space') {
      if (hue) f.bg = rgb(1, 2, 6);
      const R = Math.min(rows * 0.62 * aspect, cols * 0.4), cx = cols * 0.6, cy = rows * 0.62, rot = s.T * 0.03;
      // 左上方的月球（逆光的黑色圓盤＋亮邊）
      const mR = Math.max(1.5, R * 0.16), mx0 = cols * 0.16, my0 = rows * 0.22;
      for (let y = Math.floor(my0 - mR / aspect) - 1; y <= my0 + mR / aspect + 1; y++) for (let x = Math.floor(mx0 - mR) - 1; x <= mx0 + mR + 1; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const d = Math.hypot(x + 0.5 - mx0, (y + 0.5 - my0) * aspect) / mR;
        if (d < 0.92) g.set(x, y, '█', hue ? rgb(6, 6, 10) : f.C(0.02));
        else if (d < 1.12 && x + 0.5 < mx0 + mR * 0.3) g.set(x, y, ':', pc(s.Pco, 0.6));
      }
      for (let k = 0; k < 40; k++) { const u2 = k / 40, x = lerp(mx0 + mR, cx - R * 0.3, u2), y = lerp(my0, cy, u2); if ((k & 1) === 0) g.set(x, y, '.', pc(s.Pco, 0.25)); }
      const ux = R * 1.5 * (1 - 2 * u), uy = R * 0.25 * (u - 0.5), ur = R * 0.1, pr = R * 0.55;
      for (let y = 0; y < rows; y++) {
        const Y = -(y + 0.5 - cy) * aspect;
        for (let x = 0; x < cols; x++) {
          const X = x + 0.5 - cx, d2 = (X * X + Y * Y) / (R * R), i = y * cols + x;
          if (d2 > 1) { if (d2 < 1.1) { ch[i] = '.'; co[i] = hue ? rgb(60, 110, 220) : f.C(0.3); } continue; }
          const Nx = X / R, Ny = Y / R, Nz = Math.sqrt(1 - d2), lon = Math.atan2(Nx, Nz) + rot, lat = Math.asin(Ny);
          const tu = (lon / TAU) * 256, tv = (lat / Math.PI + 0.5) * 128;
          const land = nz(tu * 0.7 + 3, tv * 1.3) > 0.58, cloud = smooth((nz(tu * 1.5 + 60 - s.T * 0.5, tv * 2.6) - 0.52) / 0.2), ice = Math.abs(lat) > 1.15;
          let b = clamp(Nx * -0.2 + Ny * 0.15 + Nz * 0.95, 0, 1);
          const sd = Math.hypot(X - ux, Y - uy) / (Nz + 0.3);
          const um = sd < ur ? 1 : 0, pn = sd < pr ? 1 - sd / pr : 0;
          b *= (1 - 0.7 * pn * pn) * (1 - 0.92 * um);
          ch[i] = b < 0.05 ? '.' : R10[Math.max(1, Math.min(9, (b * (cloud > 0.4 || ice ? 1 : 0.8) * 9.5) | 0))];
          co[i] = hue ? mp(ice ? s.EPi : land ? s.EPl : s.EPo, cloud * 0.8, b) : f.C(0.04 + 0.9 * b);
        }
      }
      if (cols >= 120) txt(g, 2, rows - 2, tr(f, '月球本影', "Moon's umbra"), pc(s.Pco, 0.5));
    } else {
      // 貝利珠：月緣特寫
      if (hue) f.bg = rgb(1, 1, 4);
      const Rb = cols * 1.4, cx = cols * 0.5, sy0 = rows * 0.55 + Rb / aspect;
      const off = Math.cos(u * TAU) * rows * aspect * 0.06 + rows * aspect * 0.015;
      const my0 = sy0 + off / aspect;
      if (!s.mt || s.mt.length !== cols) s.mt = new Float32Array(cols);
      for (let x = 0; x < cols; x++) { const am = (x + 0.5 - cx) / Rb; s.mt[x] = (nz(am * 900 + 20, 5) * 0.7 + nz(am * 3000, 9) * 0.3) * rows * aspect * 0.045; }
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const dx = x + 0.5 - cx, dy = (y + 0.5 - sy0) * aspect, bs = Math.sqrt(dx * dx + dy * dy);
        const mdy = (y + 0.5 - my0) * aspect, bm = Math.sqrt(dx * dx + mdy * mdy);
        const mtn = s.mt[x];
        const Rm = Rb - rows * aspect * 0.02 + mtn;
        if (bm < Rm) { ch[i] = '█'; co[i] = hue ? rgb(3, 3, 6) : f.C(0); continue; }
        const h = bs - Rb;
        if (h < 0) { const v = 0.8 + 0.2 * nz(x * 0.6, y * 1.3 + t); ch[i] = v > 0.9 ? '@' : '#'; co[i] = pc(s.Psun, v); continue; }
        if (h < aspect * 1.2) { ch[i] = '='; co[i] = pc(s.Ppr, 0.75); continue; }
        const ang = Math.atan2(dx, -dy);
        const pro = Math.pow(Math.max(0, nz(ang * 400 + 7, 2) - 0.55) * 2.2, 1.5) * rows * aspect * 0.25 * (0.8 + 0.2 * Math.sin(t * 0.5 + ang * 300));
        if (h < pro) { const v = 1 - h / (pro + 1); ch[i] = v > 0.6 ? '%' : v > 0.3 ? '*' : '+'; co[i] = pc(s.Ppr, 0.4 + 0.5 * v); continue; }
        const cor = Math.pow(1 / (1 + h / (rows * aspect * 0.18)), 2.4) * (0.6 + 0.6 * nz(ang * 500, h * 0.05 - t * 0.02));
        if (cor < 0.07) continue;
        ch[i] = R10[Math.max(1, Math.min(7, (cor * 8) | 0))]; co[i] = pc(s.Pco, cor);
      }
    }
  },
});

/* ═════════ 11. 脈衝星 ═════════ */
// 點字畫布：寬 cols*2、高 rows*4 個點
function brlClear(s, cols, rows) {
  if (!s.brl || s.brl.length !== cols * rows) s.brl = new Uint8Array(cols * rows);
  else s.brl.fill(0);
  return s.brl;
}
const brlDot = (B, cols, rows, xd, yd) => {
  if (xd < 0 || yd < 0 || xd >= cols * 2 || yd >= rows * 4) return;
  B[(yd >> 2) * cols + (xd >> 1)] |= BRL_BIT[yd & 3][xd & 1];
};
// 磁偶極場的一條場線：在磁軸座標中 r = L sin²θ
function dipoleLines(f, s, cx, cy, rs, mx, my, mz, u1, u2, shells, nAz, twist, P, br) {
  const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co;
  for (let j = 0; j < nAz; j++) {
    const psi0 = (j / nAz) * TAU;
    for (const Lk of shells) {
      const L = Lk * rs, th0 = Math.asin(Math.min(1, Math.sqrt(rs / L)));
      const N = Math.ceil(L * 1.6);
      for (let q = 0; q <= N; q++) {
        const th = th0 + ((Math.PI - 2 * th0) * q) / N, r = L * Math.sin(th) * Math.sin(th);
        const psi = psi0 + twist * Math.cos(th);
        const sx = Math.sin(th) * Math.cos(psi), sy = Math.sin(th) * Math.sin(psi), sz = Math.cos(th);
        const X = r * (sx * u1[0] + sy * u2[0] + sz * mx), Y = r * (sx * u1[1] + sy * u2[1] + sz * my), Z = r * (sx * u1[2] + sy * u2[2] + sz * mz);
        if (Z < 0 && X * X + Y * Y < rs * rs) continue;
        const x = cx + X, y = cy - Y / aspect;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = (y | 0) * cols + (x | 0), v = (0.3 + 0.35 * (Z / r + 1)) * (1 - (Lk - shells[0]) / (shells[shells.length - 1] * 1.4)) * br;
        if (ch[i] !== ' ' && ch[i] !== '.') continue;
        ch[i] = v > 0.55 ? '·' : '.'; co[i] = pc(P, v);
      }
    }
  }
}
A({ id: 'sp-pulsar', name: '脈衝星', cat: '太空', theme: 'ice', hue: true, desc: '中子星自轉，兩道光束掃過太空',
  params: { mode: '3d', spin: 1.5, alpha: 0.55, twist: 0 },
  variants: [
    { id: 'lighthouse', name: '宇宙燈塔', desc: '長長的光束像燈塔一樣掃過星塵', params: { mode: 'lighthouse', spin: 0.9 } },
    { id: 'plot', name: '脈衝瀑布', desc: '一條條脈衝訊號堆疊成起伏山脊', params: { mode: 'plot' } },
    { id: 'binary', name: '雙脈衝星', desc: '兩顆脈衝星互繞，各自射出光束', params: { mode: 'binary' } },
    { id: 'pwn', name: '脈衝星風雲', desc: '環狀波紋與噴流從中心向外湧出', params: { mode: 'pwn' } },
    { id: 'radio', name: '電波接收', desc: '電波望遠鏡收到規律的脈衝', params: { mode: 'radio' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f;
    s.key = null; s.T = 0;
    s.stars = mkStars(Math.max(30, (cols * rows / 36) | 0));
    s.flares = [];
    s.lines = [];
    if (p.mode === 'plot') { for (let k = 0; k < 40; k++) s.lines.push(this.mkLine()); s.pt = 0; }
    if (p.mode === 'radio') { s.sig = new Float32Array(cols * 2); s.sigT = 0; s.land = new Float32Array(cols); for (let x = 0; x < cols; x++) s.land[x] = rows * (0.72 - 0.05 * nz(x / cols * 20, 3)); s.waves = []; }
    if (p.mode === 'lighthouse') { s.dust = []; for (let k = 0; k < (cols * rows) / 9; k++) s.dust.push([rnd(0, cols), rnd(0, rows), Math.random()]); }
  },
  mkLine() {
    const comps = [];
    const n = rint(1, 3);
    for (let k = 0; k < n; k++) comps.push([gauss() * 0.08, rnd(0.05, 0.14), Math.random() < 0.15 ? rnd(0.8, 1.5) : rnd(0.2, 0.75)]);
    return { comps, seed: rnd(0, 255) };
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.6);
    s.Pb = pal(f, h, [[10, 30, 80], [60, 140, 255], [180, 230, 255], [255, 255, 255]], 0.08, 1);
    s.Pf = pal(f, h, [[40, 20, 90], [130, 90, 230], [220, 200, 255]], 0.1, 0.8);
    s.Pm = pal(f, h, [[80, 20, 40], [255, 90, 120], [255, 220, 230]], 0.15, 1);
    s.Pn = pal(f, h, [[10, 20, 50], [70, 120, 220], [200, 230, 255]], 0.05, 0.9);
    s.Pr = pal(f, h, [[60, 15, 25], [200, 60, 80], [255, 170, 160]], 0.05, 0.6);
    s.Pl = pal(f, h, [[4, 6, 10], [24, 28, 40], [70, 76, 96]], 0.02, 0.3);
  },
  // 中子星＋兩道光束（3D 投影）
  star3d(f, s, cx, cy, rs, ang, alpha, twist, Lb, br) {
    const { g, cols, rows, aspect, t } = f, ch = g.ch, co = g.co;
    const ti = 0.38, ox = 0, oy = Math.cos(ti), oz = Math.sin(ti);
    const e1 = [1, 0, 0], e2 = [0, -oz, oy];
    const ca = Math.cos(alpha), sa = Math.sin(alpha), c = Math.cos(ang), sn = Math.sin(ang);
    const mx = ca * ox + sa * (c * e1[0] + sn * e2[0]), my = ca * oy + sa * (c * e1[1] + sn * e2[1]), mz = ca * oz + sa * (c * e1[2] + sn * e2[2]);
    // 磁軸的正交基底
    let u1 = [my * 0 - mz * 1, mz * 0 - mx * 0, mx * 1 - my * 0];
    let ul = Math.hypot(u1[0], u1[1], u1[2]) || 1;
    u1 = [u1[0] / ul, u1[1] / ul, u1[2] / ul];
    const u2 = [my * u1[2] - mz * u1[1], mz * u1[0] - mx * u1[2], mx * u1[1] - my * u1[0]];
    // 光束
    const beams = [[mx, my, mz], [-mx, -my, -mz]];
    const ext = Lb + rs * 2;
    const y0 = Math.max(0, Math.floor(cy - ext / aspect)), y1 = Math.min(rows - 1, Math.ceil(cy + ext / aspect));
    const x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(cols - 1, Math.ceil(cx + ext));
    // 兩道光束的方向攤平成一個小陣列（逐格迴圈裡不能用解構，否則每格都會配置迭代器）
    const bp = s.bp || (s.bp = new Float64Array(8));
    for (let k = 0; k < 2; k++) { const B = beams[k], l = Math.hypot(B[0], B[1]) || 1e-3; bp[k * 4] = B[0] / l; bp[k * 4 + 1] = B[1] / l; bp[k * 4 + 2] = l; bp[k * 4 + 3] = B[2]; }
    for (let y = y0; y <= y1; y++) {
      const Y = -(y + 0.5 - cy) * aspect;
      for (let x = x0; x <= x1; x++) {
        const X = x + 0.5 - cx, i = y * cols + x;
        let I = 0;
        for (let k = 0; k < 8; k += 4) {
          const dx = bp[k], dy = bp[k + 1], l = bp[k + 2], dz = bp[k + 3];
          const al = X * dx + Y * dy;
          if (al < rs * 0.8) continue;
          const len = Lb * Math.max(0.12, l), w = rs * 0.35 + al * (0.08 + 0.25 * (1 - l));
          const pp = (-X * dy + Y * dx) / w;
          if (pp > 3 || pp < -3) continue;
          const face = 1 + 1.6 * Math.pow(Math.max(0, dz), 6);
          let v = Math.exp(-pp * pp) * Math.max(0, 1 - al / len) * face * (dz < 0 ? 0.6 : 1);
          if (v * 1.1 < Math.max(I, 0.045)) continue;
          v *= 0.8 + 0.3 * nz(al * 0.3 - t * 20, pp * 4 + 50);
          if (v > I) I = v;
        }
        if (I < 0.05) continue;
        I = Math.min(1, I * br);
        ch[i] = I > 0.85 ? '#' : I > 0.6 ? '*' : I > 0.4 ? '+' : I > 0.22 ? ':' : '.';
        co[i] = pc(s.Pb, I);
      }
    }
    dipoleLines(f, s, cx, cy, rs, mx, my, mz, u1, u2, [2.2, 3.4, 5.2, 8], 6, twist, s.Pf, br);
    // 星體：磁極熱點
    const flash = Math.pow(Math.max(Math.abs(mz), 0), 8);
    const R = rs * (1 + flash * 0.35), ry = R / aspect;
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - R - 2); x <= cx + R + 2; x++) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const X = (x + 0.5 - cx) / R, Y = (-(y + 0.5 - cy) * aspect) / R, d2 = X * X + Y * Y, i = y * cols + x;
      if (d2 > 1) { if (d2 < 2.2) { const v = (2.2 - d2) / 1.2 * (0.4 + flash * 0.5) * br; if (v > 0.1 && (ch[i] === ' ' || ch[i] === '.')) { ch[i] = v > 0.5 ? '+' : ':'; co[i] = pc(s.Pb, v); } } continue; }
      const Z = Math.sqrt(1 - d2), hot = Math.max(0, Math.abs(X * mx + Y * my + Z * mz) - 0.75) * 4;
      const v = Math.min(1, 0.55 + 0.25 * Z + hot * 0.5);
      ch[i] = v > 0.85 ? '@' : '#'; co[i] = pc(s.Pb, v);
    }
    return [mx, my, mz];
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode, dt = Math.min(f.dt, 0.1);
    s.T += dt;
    if (hue) f.bg = m === 'radio' ? rgb(4, 6, 16) : rgb(1, 2, 8);
    if (m === '3d') {
      const rs = Math.max(1.5, rows * aspect * 0.045), cx = cols / 2, cy = rows / 2;
      const ang = s.T * p.spin * TAU / 3;
      const M = this.star3d(f, s, cx, cy, rs, ang, p.alpha, p.twist, Math.max(cols * 0.48, rows * aspect * 0.5), 1);
      if (p.twist) {
        // 磁星：星震漣漪與沿場線竄出的閃焰
        if (Math.random() < dt * 0.5) s.flares.push({ age: 0, a: rnd(0, TAU), L: rnd(3, 7) });
        for (let k = s.flares.length - 1; k >= 0; k--) {
          const q = s.flares[k];
          q.age += dt;
          if (q.age > 2.5) { kill(s.flares, k); continue; }
          const rr = rs * (1.5 + q.age * 5), N = Math.ceil(rr * 4);
          for (let j = 0; j < N; j += 2) { const a = (j / N) * TAU; g.set(cx + rr * Math.cos(a), cy + (rr * Math.sin(a)) / aspect, '.', pc(s.Pm, (1 - q.age / 2.5) * 0.6)); }
          const L = q.L * rs, nn = Math.ceil(L * 2), k0 = q.age / 1.2;
          for (let j = 0; j <= nn; j++) {
            const th = 0.25 + (Math.PI - 0.5) * (j / nn), r = L * Math.sin(th) ** 2;
            if (r < rs || Math.abs(j / nn - k0) > 0.25) continue;
            const x = cx + r * Math.sin(th) * Math.cos(q.a) * 1.0, y = cy - (r * Math.cos(th) + r * Math.sin(th) * Math.sin(q.a) * 0.3) / aspect;
            g.set(x, y, '*', pc(s.Pm, 1 - Math.abs(j / nn - k0) * 3));
          }
        }
      }
      void M;
    } else if (m === 'lighthouse') {
      const cx = cols / 2, cy = rows * 0.5, ang = s.T * p.spin * TAU / 6;
      const bx = Math.sin(ang), bz = Math.cos(ang), el = 0.12;
      const dirs = [[bx, el, bz], [-bx, -el, -bz]];
      for (const q of s.dust) {
        const X = q[0] - cx, Y = -(q[1] - cy) * aspect;
        let I = 0;
        for (let k = 0; k < 2; k++) {
          const dx0 = dirs[k][0], dy0 = dirs[k][1], dz = dirs[k][2];
          const l = Math.hypot(dx0, dy0) || 1e-3, dx = dx0 / l, dy = dy0 / l, al = X * dx + Y * dy;
          if (al <= 0) continue;
          const w = 1 + al * (0.05 + 0.5 * (1 - l)), pp = (-X * dy + Y * dx) / w;
          I = Math.max(I, Math.exp(-pp * pp) * (0.4 + 0.6 * Math.max(0, dz + 0.3)));
        }
        const i = (q[1] | 0) * cols + (q[0] | 0), v = I * (0.5 + 0.5 * q[2]) + 0.06 * q[2];
        if (v < 0.07) continue;
        ch[i] = v > 0.6 ? '*' : v > 0.35 ? '+' : v > 0.15 ? '·' : '.'; co[i] = pc(s.Pb, v);
      }
      this.star3d(f, s, cx, cy, Math.max(1.5, rows * aspect * 0.035), ang * 0 + Math.PI / 2, 0, 0, 0, 0.8);
      for (const [dx0, dy0, dz] of dirs) {
        const l = Math.hypot(dx0, dy0), L = Math.max(cols, rows * aspect) * 0.6 * Math.max(0.1, l);
        const n = Math.ceil(L);
        for (let j = 2; j < n; j++) {
          const x = cx + (dx0 / l) * j, y = cy - ((dy0 / l) * j) / aspect, v = (1 - j / n) * (0.5 + 0.5 * Math.max(0, dz)) * (0.6 + 0.4 * l);
          if (v < 0.08) continue;
          g.set(x, y, v > 0.5 ? '=' : '-', pc(s.Pb, v + 0.15));
        }
      }
    } else if (m === 'plot') {
      // 脈衝瀑布：前面的線遮住後面的線
      const B = brlClear(s, cols, rows), W = cols * 2, H = rows * 4;
      s.pt += dt;
      if (s.pt > 0.6) { s.pt -= 0.6; s.lines.unshift(this.mkLine()); s.lines.length = 40; }
      const fr = s.pt / 0.6, N = Math.max(10, Math.min(32, Math.floor(rows * 0.36))), sp = (H * 0.72) / N, amp = sp * 4;
      if (!s.minY || s.minY.length !== W) s.minY = new Float32Array(W);
      const minY = s.minY;
      minY.fill(1e9);
      const xa = W * 0.18, xb = W * 0.82;
      for (let k = 0; k < N; k++) {
        const L = s.lines[k], base = H * 0.9 - (k + fr) * sp;
        if (base < 0) break;
        let prev = -1;
        for (let xd = Math.floor(xa); xd < xb; xd++) {
          if (!L.pf || L.pf.length !== W) {
            L.pf = new Float32Array(W);
            for (let q = 0; q < W; q++) { const uu = (q - W / 2) / (W * 0.32); let vv = (nz(q * 0.9 + L.seed, L.seed) - 0.5) * 0.06; for (const [c0, w0, a0] of L.comps) vv += a0 * Math.exp(-(((uu - c0) / w0) ** 2)); L.pf[q] = vv; }
          }
          const v = L.pf[xd];
          const edge = Math.min(1, (xd - xa) / (W * 0.04), (xb - xd) / (W * 0.04));
          const yd = Math.round(base - v * amp * edge);
          if (yd < minY[xd]) {
            const a = prev < 0 ? yd : Math.min(prev, yd), b = prev < 0 ? yd : Math.min(Math.max(prev, yd), minY[xd] - 1);
            for (let q = a; q <= b; q++) brlDot(B, cols, rows, xd, q);
            minY[xd] = yd;
            prev = yd;
          } else prev = -1;
        }
      }
      for (let i = 0; i < B.length; i++) if (B[i]) { ch[i] = BRL[B[i]]; co[i] = pc(s.Pb, 0.55 + 0.45 * (((i / cols) | 0) / rows)); }
      if (cols >= 120) { ctext(g, cols / 2, rows - 2, tr(f, '脈衝相位 →', 'Pulse phase →'), pc(s.Pf, 0.5)); txt(g, Math.floor(cols * 0.09), Math.floor(rows * 0.5), tr(f, '時間 ↑', 'Time ↑'), pc(s.Pf, 0.5)); }
    } else if (m === 'binary') {
      const cx = cols / 2, cy = rows / 2, a = Math.min(cols * 0.22, rows * aspect * 0.32), ph = s.T * 0.5;
      const pos = [[Math.cos(ph) * a, Math.sin(ph) * a * 0.35, Math.sin(ph)], [-Math.cos(ph) * a, -Math.sin(ph) * a * 0.35, -Math.sin(ph)]];
      // 軌道
      const N = Math.ceil(a * 6);
      for (let j = 0; j < N; j += 2) { const q = (j / N) * TAU; g.set(cx + Math.cos(q) * a, cy - (Math.sin(q) * a * 0.35) / aspect, '·', pc(s.Pf, 0.35)); }
      const order = pos[0][2] < pos[1][2] ? [0, 1] : [1, 0];
      for (const k of order) {
        const P = pos[k], rs = Math.max(1.2, rows * aspect * 0.03) * (1 + P[2] * 0.1);
        this.star3d(f, s, cx + P[0], cy - P[1] / aspect, rs, s.T * (k ? 2.4 : 1.7) * TAU / 3, k ? 0.8 : 0.5, 0, Math.max(cols, rows * aspect) * 0.3, 0.85);
      }
    } else if (m === 'pwn') {
      const cx = cols / 2, cy = rows / 2, R0 = Math.min(cols * 0.12, rows * aspect * 0.17), inc = 0.42;
      const hw2 = (cols >> 1) + 2;
      if (!s.ra || s.ra.length !== hw2) { s.ra = new Float32Array(hw2); s.rb = new Uint8Array(hw2); }
      const RA = s.ra, RB = s.rb;
      for (let y = 0; y < rows; y++) {
        const Y = -(y + 0.5 - cy) * aspect;
        for (let xs = 0; xs < hw2; xs++) {
          const X = xs * 2 + 0.5 - cx;
          const er = Math.sqrt(X * X + (Y / inc) * (Y / inc)) / R0, ph0 = fract(s.T * 0.12) + 0.4;
          let I = 0, c = 0;
          const kr = Math.round(er - ph0);
          if (kr >= 0 && kr < 4) {
            const rr = kr + ph0, dd = (er - rr) / 0.12;
            if (dd < 2.5 && dd > -2.5) I = Math.exp(-dd * dd) * Math.max(0, 1 - rr / 4.4) * (0.7 + 0.5 * nz(Math.atan2(Y / inc, X) * 40 + kr * 30, rr * 3));
          }
          const ax = Math.abs(Y), jw = 1 + ax * 0.08;
          if (ax > 2 && ax < R0 * 3.5 && Math.abs(X) < jw * 3) { const j = Math.exp(-((X / jw) ** 2)) * (0.5 + 0.7 * nz(ax * 0.25 - s.T * 4 * Math.sign(Y), Y > 0 ? 7 : 70)) * (1 - ax / (R0 * 3.5)) * (Y > 0 ? 1 : 0.7); if (j > I) I = j; }
          const rr2 = Math.hypot(X, Y * 1.3) / (R0 * 4.2);
          if (rr2 < 1 && I < 0.3) { const haze = (1 - rr2) * 0.3 * (0.6 + 0.6 * nz(X * 0.15 + 9, Y * 0.15)); if (haze > I) I = haze; }
          if (rr2 > 0.75 && rr2 < 1.25) { const fil = Math.pow(rz(Math.atan2(Y, X) * 60, rr2 * 20), 6) * (1 - Math.abs(rr2 - 1) / 0.25) * 0.7; if (fil > I) { I = fil; c = 1; } }
          RA[xs] = I; RB[xs] = c;
        }
        for (let x = 0; x < cols; x++) {
          const xs = x >> 1, fx = (x & 1) * 0.5, i = y * cols + x;
          let I = RA[xs] + (RA[xs + 1] - RA[xs]) * fx;
          if (I < 0.06) continue;
          I = Math.min(1, I);
          ch[i] = R10[Math.max(1, Math.min(9, (I * 9.5) | 0))]; co[i] = RB[xs] ? pc(s.Pr, I) : pc(s.Pn, I);
        }
      }
      g.set(cx, cy, '@', pc(s.Pb, 1));
    } else {
      // 電波接收：地面的碟形天線＋訊號軌跡
      const hz = rows * 0.72, px = cols * 0.78, py = rows * 0.18, per = 1.4;
      const pulse = Math.exp(-((s.T % per) / 0.08));
      g.set(px, py, pulse > 0.3 ? '*' : '+', pc(s.Pb, 0.4 + 0.6 * pulse));
      if (pulse > 0.95 && (!s.lastP || s.T - s.lastP > per * 0.5)) { s.lastP = s.T; s.waves.push(0); }
      const dx0 = cols * 0.3, dy0 = hz - rows * 0.2;
      for (let k = s.waves.length - 1; k >= 0; k--) {
        s.waves[k] += dt * 0.5;
        const fr = s.waves[k];
        if (fr > 1) { s.waves.splice(k, 1); continue; }
        const wx = lerp(px, dx0, fr), wy = lerp(py, dy0, fr), ang = Math.atan2((dy0 - py) * aspect, dx0 - px);
        for (let j = -5; j <= 5; j++) g.set(wx + Math.cos(ang + Math.PI / 2) * j * 1.2, wy + (Math.sin(ang + Math.PI / 2) * j * 1.2) / aspect, ')', pc(s.Pb, 0.5 * (1 - fr) + 0.2));
      }
      for (let x = 0; x < cols; x++) for (let y = Math.floor(s.land[x]); y < rows; y++) { const i = y * cols + x; ch[i] = '█'; co[i] = pc(s.Pl, 0.25); }
      // 天線（拋物面＋支架）
      const D = Math.max(6, Math.round(cols * 0.09)), bx = Math.round(dx0), by = Math.round(s.land[Math.min(cols - 1, bx)]);
      const th = 0.45, cth = Math.cos(th), sth = Math.sin(th), Cx = bx, Cy = by - (D / aspect) * 1.5;
      const rot2 = (lx, ly) => [Cx + lx * cth + ly * sth, Cy - (-lx * sth + ly * cth) / aspect];
      const dc = hue ? rgb(200, 205, 215) : f.C(0.75), dd2 = hue ? rgb(90, 96, 110) : f.C(0.35);
      for (let j = -D * 2; j <= D * 2; j++) {
        const u = j / (D * 2), [x1, y1] = rot2(u * D, u * u * D * 0.55), [x2, y2] = rot2(u * D, D * 0.55);
        g.line(x1, y1, x2, y2, ':', dd2);
      }
      for (let j = -D * 2; j <= D * 2; j++) { const u = j / (D * 2), [x1, y1] = rot2(u * D, u * u * D * 0.55); g.set(x1, y1, '#', dc); }
      const [fx, fy] = rot2(0, D * 0.9);
      g.line(Cx, Cy, fx, fy, '|', dc); g.set(fx, fy, 'o', dc);
      g.line(bx, Cy + 1, bx, by - 1, '|', dc);
      g.line(bx - 2, by - 1, bx + 2, by - 1, '^', hue ? rgb(150, 155, 165) : f.C(0.5));
      // 訊號軌跡（點字）
      s.sigT += dt;
      while (s.sigT > 0.02) { s.sigT -= 0.02; s.sig.copyWithin(0, 1); const ph = (s.T % per) / per; s.sig[s.sig.length - 1] = Math.exp(-(((ph - 0.02) / 0.02) ** 2)) * rnd(0.6, 1) + gauss() * 0.06; }
      const B = brlClear(s, cols, rows), top = Math.floor(rows * 0.8), Hd = (rows - top - 1) * 4;
      for (let i = (top - 1) * cols; i < rows * cols; i++) { ch[i] = ' '; }
      for (let x = 0; x < cols; x++) { ch[(top - 1) * cols + x] = '─'; co[(top - 1) * cols + x] = pc(s.Pl, 0.9); }
      let prev = -1;
      for (let xd = 0; xd < cols * 2; xd++) {
        const yd = top * 4 + Math.round((1 - clamp(s.sig[xd], -0.1, 1.1) * 0.85 - 0.08) * (Hd - 1));
        const a = prev < 0 ? yd : Math.min(prev, yd), b = prev < 0 ? yd : Math.max(prev, yd);
        for (let q = a; q <= b; q++) brlDot(B, cols, rows, xd, q);
        prev = yd;
      }
      for (let i = top * cols; i < B.length; i++) if (B[i]) { ch[i] = BRL[B[i]]; co[i] = pc(s.Pb, 0.8); }
      if (cols >= 120) txt(g, 2, top - 2, tr(f, '週期 ' + per.toFixed(3) + ' 秒', 'Period ' + per.toFixed(3) + ' s'), pc(s.Pb, 0.55));
      drawStars(f, s.stars, s.Ps, 0, 0, 0.8);
      return;
    }
    drawStars(f, s.stars, s.Ps);
  },
});

/* ═════════ 12. 重力之舞 ═════════ */
const GCOL = [[255, 120, 90], [110, 200, 255], [255, 220, 110], [170, 255, 150], [230, 140, 255], [255, 255, 255]];
A({ id: 'sp-gravity', name: '重力之舞', cat: '太空', theme: 'cyber', hue: true, desc: '三顆恆星在混沌引力中糾纏繞行',
  params: { mode: 'three' },
  variants: [
    { id: 'eight', name: '八字舞', desc: '三星沿著同一條8字形軌道追逐', params: { mode: 'eight' } },
    { id: 'collide', name: '星系碰撞', desc: '兩個盤狀星系擦身而過拉出潮汐尾', params: { mode: 'collide' } },
    { id: 'trojan', name: '特洛伊群', desc: '小天體在拉格朗日點附近擺盪', params: { mode: 'trojan' } },
    { id: 'cluster', name: '球狀星團', desc: '數百顆恆星在星團重力井中穿梭', params: { mode: 'cluster' } },
    { id: 'transfer', name: '質量轉移', desc: '巨星的氣體流向伴星的吸積盤', params: { mode: 'transfer' } },
    { id: 'planets', name: '行星形成', desc: '微行星互相碰撞合併成行星', params: { mode: 'planets' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f, n = cols * rows;
    s.key = null; s.T = 0;
    s.stars = mkStars(Math.max(30, (n / 50) | 0));
    s.B = new Float32Array(n); s.Bc = new Uint8Array(n);
    const m = p.mode;
    if (m === 'three') this.threeReset(s);
    else if (m === 'eight') {
      const x1 = 0.97000436, y1 = -0.24308753, vx3 = -0.93240737, vy3 = -0.86473146;
      s.b = [{ x: x1, y: y1, vx: -vx3 / 2, vy: -vy3 / 2, m: 1 }, { x: -x1, y: -y1, vx: -vx3 / 2, vy: -vy3 / 2, m: 1 }, { x: 0, y: 0, vx: vx3, vy: vy3, m: 1 }];
    } else if (m === 'collide') this.galReset(s, f);
    else if (m === 'trojan') this.trojReset(s, f);
    else if (m === 'cluster') {
      s.P = [];
      const N = Math.min(900, Math.max(250, (n / 40) | 0));
      for (let k = 0; k < N; k++) {
        const r = 1 / Math.sqrt(Math.pow(rnd(0.02, 0.98), -2 / 3) - 1) * 0.35;
        let x = gauss(), y = gauss(), z = gauss();
        const l = Math.hypot(x, y, z);
        x *= r / l; y *= r / l; z *= r / l;
        const ve = Math.sqrt(2 / Math.sqrt(r * r + 0.35 * 0.35)) * rnd(0.3, 0.7);
        let vx = gauss(), vy = gauss(), vz = gauss();
        const vl = Math.hypot(vx, vy, vz);
        s.P.push({ x, y, z, vx: (vx / vl) * ve, vy: (vy / vl) * ve, vz: (vz / vl) * ve, c: Math.random() < 0.15 ? 1 : Math.random() < 0.5 ? 2 : 0 });
      }
    } else if (m === 'transfer') { s.S = []; }
    else if (m === 'planets') this.planReset(s);
  },
  threeReset(s) {
    s.b = [];
    let px = 0, py = 0;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + rnd(-0.4, 0.4), r = rnd(0.6, 1);
      const b = { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: -Math.sin(a) * rnd(0.2, 0.55), vy: Math.cos(a) * rnd(0.2, 0.55), m: rnd(0.8, 1.2) };
      px += b.vx * b.m; py += b.vy * b.m; s.b.push(b);
    }
    const M = s.b.reduce((a, b) => a + b.m, 0);
    for (const b of s.b) { b.vx -= px / M; b.vy -= py / M; }
    s.age = 0;
  },
  galReset(s, f) {
    const N = Math.min(1600, Math.max(500, (f.cols * f.rows / 14) | 0));
    s.cores = [{ x: -1.6, y: 0.9, z: 0, vx: 0.42, vy: -0.25, vz: 0, m: 1 }, { x: 1.6, y: -0.9, z: 0, vx: -0.42, vy: 0.25, vz: 0, m: 1 }];
    s.P = [];
    for (let g2 = 0; g2 < 2; g2++) {
      const C = s.cores[g2], inc = g2 ? 0.9 : 0.35, rot = g2 ? -1 : 1;
      for (let k = 0; k < N / 2; k++) {
        const r = 0.12 + Math.pow(Math.random(), 0.8) * 0.75, a = rnd(0, TAU), v = Math.sqrt(C.m * r * r / Math.pow(r * r + 0.04, 1.5)) * rot;
        const lx = Math.cos(a) * r, ly = Math.sin(a) * r, lvx = -Math.sin(a) * v, lvy = Math.cos(a) * v;
        s.P.push({ x: C.x + lx, y: C.y + ly * Math.cos(inc), z: ly * Math.sin(inc), vx: C.vx + lvx, vy: C.vy + lvy * Math.cos(inc), vz: lvy * Math.sin(inc), c: g2 });
      }
    }
    s.age = 0;
  },
  trojReset(s, f) {
    s.mu = 0.012; s.P = [];
    const N = Math.min(500, Math.max(150, (f.cols * f.rows / 50) | 0));
    for (let k = 0; k < N; k++) {
      const sg = k % 2 ? 1 : -1, a = sg * Math.PI / 3 + gauss() * 0.12, r = 1 + gauss() * 0.012;
      s.P.push({ x: r * Math.cos(a) - s.mu, y: r * Math.sin(a), vx: gauss() * 0.01, vy: gauss() * 0.01, c: k % 3 });
    }
    s.age = 0;
  },
  planReset(s) {
    s.b = [];
    for (let k = 0; k < 170; k++) {
      const r = rnd(0.25, 1), a = rnd(0, TAU), v = Math.sqrt(1 / r) * rnd(0.97, 1.03);
      s.b.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: -Math.sin(a) * v, vy: Math.cos(a) * v, m: rnd(0.5, 1.5) * 4e-5 });
    }
    s.age = 0;
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.5);
    s.PP = GCOL.map((c, k) => pal(f, h, [[c[0] * 0.15, c[1] * 0.15, c[2] * 0.15], c, [255, 255, 255]], 0.1 + k * 0.02, 1, 32));
    s.Pt = pal(f, h, [[60, 70, 100], [180, 190, 220]], 0.25, 0.7);
  },
  dep(s, cols, rows, x, y, v, c) {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = (y | 0) * cols + (x | 0);
    s.B[i] += v; s.Bc[i] = c;
  },
  // 沿線段累積（避免快速移動時斷線）
  depLine(s, cols, rows, x0, y0, x1, y1, v, c) {
    const n = Math.min(60, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k++) this.dep(s, cols, rows, x0 + ((x1 - x0) * k) / (n || 1), y0 + ((y1 - y0) * k) / (n || 1), v, c);
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode, n = cols * rows, B = s.B, Bc = s.Bc;
    const dt = Math.min(f.dt, 0.06);
    s.T += dt;
    if (hue) f.bg = rgb(2, 3, 9);
    const cx = cols / 2, cy = rows / 2;
    const decay = { three: 0.25, eight: 0.6, collide: 6, trojan: 1.5, cluster: 5, transfer: 4, planets: 1.6 }[m];
    const dk = Math.exp(-dt * decay);
    for (let i = 0; i < n; i++) B[i] *= dk;
    const bodies = [];
    if (m === 'three' || m === 'eight') {
      const sc = m === 'eight' ? Math.min(cols * 0.44 / 1.08, rows * aspect * 0.44 / 0.35) : Math.min(cols * 0.2, rows * aspect * 0.3);
      const simT = dt * (m === 'eight' ? 1.25 : 0.7), sub = 40, h = simT / sub, eps2 = m === 'eight' ? 0 : 0.01, b = s.b;
      const prev = b.map(q => [cx + q.x * sc, cy - (q.y * sc) / aspect]);
      for (let k = 0; k < sub; k++) {
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
          const dx = b[j].x - b[i].x, dy = b[j].y - b[i].y, r2 = dx * dx + dy * dy + eps2, inv = 1 / (r2 * Math.sqrt(r2));
          b[i].vx += dx * inv * b[j].m * h; b[i].vy += dy * inv * b[j].m * h; b[j].vx -= dx * inv * b[i].m * h; b[j].vy -= dy * inv * b[i].m * h;
        }
        for (const q of b) { q.x += q.vx * h; q.y += q.vy * h; }
      }
      if (m === 'three') {
        s.age += dt;
        let far = false, mx = 0, my = 0, M = 0;
        for (const q of b) { mx += q.x * q.m; my += q.y * q.m; M += q.m; }
        for (const q of b) if (Math.hypot(q.x - mx / M, q.y - my / M) > 2.6) far = true;
        if (far || s.age > 70) { this.threeReset(s); B.fill(0.0); }
      }
      b.forEach((q, k) => {
        const x = cx + q.x * sc, y = cy - (q.y * sc) / aspect;
        this.depLine(s, cols, rows, prev[k][0], prev[k][1], x, y, 0.5, k);
        bodies.push([x, y, (m === 'eight' ? 1.3 : 1 + q.m) * Math.max(1, cols / 200), k]);
      });
    } else if (m === 'collide') {
      s.age += dt;
      if (s.age > 48) { this.galReset(s, f); B.fill(0); }
      const sc = Math.min(cols * 0.17, rows * aspect * 0.27), simT = dt * 0.32, sub = 3, h = simT / sub, C = s.cores;
      const view = s.T * 0.03, cv = Math.cos(view), sv = Math.sin(view);
      for (let k = 0; k < sub; k++) {
        const dx = C[1].x - C[0].x, dy = C[1].y - C[0].y, dz = C[1].z - C[0].z, r2 = dx * dx + dy * dy + dz * dz + 0.05, inv = 1 / (r2 * Math.sqrt(r2));
        C[0].vx += dx * inv * h; C[0].vy += dy * inv * h; C[0].vz += dz * inv * h; C[1].vx -= dx * inv * h; C[1].vy -= dy * inv * h; C[1].vz -= dz * inv * h;
        for (const c of C) { c.x += c.vx * h; c.y += c.vy * h; c.z += c.vz * h; }
        for (const q of s.P) {
          for (const c of C) {
            const ex = c.x - q.x, ey = c.y - q.y, ez = c.z - q.z, rr = ex * ex + ey * ey + ez * ez + 0.04, iv = c.m / (rr * Math.sqrt(rr));
            q.vx += ex * iv * h; q.vy += ey * iv * h; q.vz += ez * iv * h;
          }
          q.x += q.vx * h; q.y += q.vy * h; q.z += q.vz * h;
        }
      }
      for (const q of s.P) {
        const X = q.x * cv + q.z * sv;
        this.dep(s, cols, rows, cx + X * sc, cy - (q.y * sc) / aspect, 0.22, q.c ? 1 : 2);
      }
      for (const c of C) bodies.push([cx + (c.x * cv + c.z * sv) * sc, cy - (c.y * sc) / aspect, 1.6, 5]);
    } else if (m === 'trojan') {
      s.age += dt;
      const mu = s.mu, sc = Math.min(cols * 0.42, rows * aspect * 0.44), sub = 6, h = (dt * 1.6) / sub;
      for (const q of s.P) {
        const x0 = cx + q.x * sc, y0 = cy - (q.y * sc) / aspect;
        for (let k = 0; k < sub; k++) {
          const r1x = q.x + mu, r2x = q.x - 1 + mu, r1 = Math.pow(r1x * r1x + q.y * q.y, 1.5), r2 = Math.pow(r2x * r2x + q.y * q.y + 1e-4, 1.5);
          const ax = 2 * q.vy + q.x - ((1 - mu) * r1x) / r1 - (mu * r2x) / r2, ay = -2 * q.vx + q.y - ((1 - mu) * q.y) / r1 - (mu * q.y) / r2;
          q.vx += ax * h; q.vy += ay * h; q.x += q.vx * h; q.y += q.vy * h;
        }
        if (Math.hypot(q.x, q.y) > 1.6 || Math.hypot(q.x, q.y) < 0.4) { const sg = Math.random() < 0.5 ? 1 : -1, a = sg * Math.PI / 3 + gauss() * 0.1; q.x = Math.cos(a) - mu; q.y = Math.sin(a); q.vx = q.vy = 0; continue; }
        this.depLine(s, cols, rows, x0, y0, cx + q.x * sc, cy - (q.y * sc) / aspect, 0.05, q.c);
      }
      // 行星軌道與拉格朗日點
      const N = Math.ceil(sc * 5);
      for (let j = 0; j < N; j += 3) { const a = (j / N) * TAU, x = cx + Math.cos(a) * sc, y = cy - (Math.sin(a) * sc) / aspect, i = (y | 0) * cols + (x | 0); if (x >= 0 && y >= 0 && x < cols && y < rows && B[i] < 0.05) { B[i] = 0.06; Bc[i] = 5; } }
      bodies.push([cx - mu * sc, cy, Math.max(2, sc * 0.08), 2], [cx + (1 - mu) * sc, cy, Math.max(1.2, sc * 0.035), 1]);
      s.lab = [['L4', 0.5 - mu, 0.866], ['L5', 0.5 - mu, -0.866], ['L1', 0.78, 0], ['L2', 1.23, 0], ['L3', -1.03, 0]].map(([nm, x, y]) => [nm, cx + x * sc, cy - (y * sc) / aspect]);
    } else if (m === 'cluster') {
      const sc = Math.min(cols * 0.3, rows * aspect * 0.42), h = dt * 0.5, a2 = 0.35 * 0.35, view = s.T * 0.05, cv = Math.cos(view), sv = Math.sin(view);
      for (const q of s.P) {
        const r2 = q.x * q.x + q.y * q.y + q.z * q.z + a2, iv = -1 / (r2 * Math.sqrt(r2));
        q.vx += q.x * iv * h; q.vy += q.y * iv * h; q.vz += q.z * iv * h; q.x += q.vx * h; q.y += q.vy * h; q.z += q.vz * h;
        const X = q.x * cv + q.z * sv;
        this.dep(s, cols, rows, cx + X * sc, cy - (q.y * sc) / aspect, 0.35, q.c);
      }
    } else if (m === 'transfer') {
      // 質量轉移雙星：在共轉座標中畫，整體旋轉
      const sc = Math.min(cols * 0.3, rows * aspect * 0.5), ang = s.T * 0.35, ca = Math.cos(ang), sa = Math.sin(ang), ci = 0.55;
      const toS = (x, y) => [cx + (x * ca - y * sa) * sc, cy - ((x * sa + y * ca) * ci * sc) / aspect];
      const D = [-0.55, 0], Acc = [0.62, 0], L1 = [0.12, 0], Rd = 0.42, Rdisk = 0.3;
      // 氣流粒子
      for (let k = 0; k < 6; k++) s.S.push({ u: 0, sp: rnd(0.35, 0.55), j: gauss() * 0.02 });
      for (let k = s.S.length - 1; k >= 0; k--) {
        const q = s.S[k];
        q.u += dt * q.sp;
        if (q.u > 1) { kill(s.S, k); continue; }
        const u = q.u, ctrl = [0.45, -0.35];
        const x = (1 - u) * (1 - u) * L1[0] + 2 * (1 - u) * u * ctrl[0] + u * u * (Acc[0] - 0.05), y = (1 - u) * (1 - u) * L1[1] + 2 * (1 - u) * u * ctrl[1] + u * u * (Acc[1] - Rdisk * 0.95) + q.j;
        const [sx, sy] = toS(x, y);
        this.dep(s, cols, rows, sx, sy, 0.2, 2);
      }
      // 吸積盤（每格算）
      const [ax2, ay2] = toS(Acc[0], Acc[1]), ext = Rdisk * sc * 1.1;
      for (let y = Math.max(0, Math.floor(ay2 - ext / aspect)); y <= Math.min(rows - 1, ay2 + ext / aspect); y++) for (let x = Math.max(0, Math.floor(ax2 - ext)); x <= Math.min(cols - 1, ax2 + ext); x++) {
        const X = (x + 0.5 - cx) / sc, Y = (-(y + 0.5 - cy) * aspect) / (sc * ci);
        const ox = X * ca + Y * sa - Acc[0], oy = -X * sa + Y * ca - Acc[1], r = Math.hypot(ox, oy) / Rdisk;
        if (r > 1 || r < 0.08) continue;
        const az = Math.atan2(oy, ox), tw = nz((az / TAU) * 256 - s.T * 30 / (r + 0.3), r * 30);
        const v = (1 - r) * (0.5 + 0.7 * tw) + Math.max(0, 1 - Math.hypot(ox + 0.02, oy + Rdisk * 0.95) / 0.07) * 0.8;
        this.dep(s, cols, rows, x + 0.5, y + 0.5, v * 0.3, r < 0.3 ? 5 : 1);
      }
      // 巨星（朝伴星拉長的淚滴形）
      const [dx2, dy2] = toS(D[0], D[1]);
      const extD = Rd * 1.6 * sc;
      for (let y = Math.max(0, Math.floor(dy2 - extD / aspect)); y <= Math.min(rows - 1, dy2 + extD / aspect); y++) for (let x = Math.max(0, Math.floor(dx2 - extD)); x <= Math.min(cols - 1, dx2 + extD); x++) {
        const X = (x + 0.5 - cx) / sc, Y = (-(y + 0.5 - cy) * aspect) / (sc * ci);
        const ox = X * ca + Y * sa - D[0], oy = -X * sa + Y * ca - D[1], r = Math.hypot(ox, oy), ph = Math.atan2(oy, ox);
        const R = Rd * (1 + 0.62 * Math.pow(Math.max(0, Math.cos(ph)), 7));
        if (r > R) continue;
        const z = Math.sqrt(1 - (r / R) ** 2), v = 0.35 + 0.65 * z * (0.85 + 0.3 * nz(ox * 40 + s.T, oy * 40));
        const i = y * cols + x;
        ch[i] = R10[Math.max(2, Math.min(9, (v * 9.5) | 0))]; co[i] = hue ? shd(255, 120, 60, 0.3 + 0.75 * v) : f.C(0.15 + 0.8 * v);
      }
      const [qx, qy] = toS(Acc[0], Acc[1]);
      bodies.push([qx, qy, 1.2, 5]);
    } else if (m === 'planets') {
      s.age += dt;
      const b = s.b, sc = Math.min(cols * 0.46, rows * aspect * 0.46), sub = 2, h = (dt * 0.9) / sub;
      for (let k = 0; k < sub; k++) {
        const N = b.length;
        for (let i = 0; i < N; i++) {
          const q = b[i], r2 = q.x * q.x + q.y * q.y, iv = -1 / (r2 * Math.sqrt(r2));
          q.ax = q.x * iv; q.ay = q.y * iv;
        }
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
          const A0 = b[i], B0 = b[j], dx = B0.x - A0.x, dy = B0.y - A0.y, r2 = dx * dx + dy * dy + 1e-4, iv = 1 / (r2 * Math.sqrt(r2));
          A0.ax += dx * iv * B0.m * 30; A0.ay += dy * iv * B0.m * 30; B0.ax -= dx * iv * A0.m * 30; B0.ay -= dy * iv * A0.m * 30;
        }
        for (const q of b) { q.vx += q.ax * h; q.vy += q.ay * h; q.x += q.vx * h; q.y += q.vy * h; }
        // 碰撞合併
        for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
          const A0 = b[i], B0 = b[j], rr = 0.012 * (Math.cbrt(A0.m / 4e-5) + Math.cbrt(B0.m / 4e-5));
          if (Math.abs(A0.x - B0.x) > rr || Math.abs(A0.y - B0.y) > rr || Math.hypot(A0.x - B0.x, A0.y - B0.y) > rr) continue;
          const M = A0.m + B0.m;
          A0.x = (A0.x * A0.m + B0.x * B0.m) / M; A0.y = (A0.y * A0.m + B0.y * B0.m) / M; A0.vx = (A0.vx * A0.m + B0.vx * B0.m) / M; A0.vy = (A0.vy * A0.m + B0.vy * B0.m) / M; A0.m = M;
          b.splice(j, 1); j--;
        }
      }
      for (let k = b.length - 1; k >= 0; k--) { const r = Math.hypot(b[k].x, b[k].y); if (r < 0.08 || r > 2.5) b.splice(k, 1); }
      if (b.length < 7 || s.age > 75) { this.planReset(s); B.fill(0); }
      for (const q of s.b) {
        const big = Math.cbrt(q.m / 4e-5), x = cx + q.x * sc, y = cy - (q.y * sc) / aspect;
        this.dep(s, cols, rows, x, y, 0.12 + big * 0.05, big > 3 ? 2 : big > 1.8 ? 0 : 1);
        if (big > 2.2) bodies.push([x, y, Math.min(3, big * 0.45) * Math.max(1, cols / 220), big > 3 ? 2 : 0]);
      }
      bodies.push([cx, cy, Math.max(1.5, sc * 0.05), 2]);
    }
    // ── 軌跡 ──
    const PP = s.PP;
    for (let i = 0; i < n; i++) {
      const v0 = B[i];
      if (v0 < 0.03) continue;
      const v = 1 - Math.exp(-v0 * 1.6);
      if (v < 0.05) continue;
      if (ch[i] !== ' ') continue;
      ch[i] = R10[Math.max(1, Math.min(9, (v * 9.5) | 0))];
      co[i] = pc(PP[Bc[i]], v);
    }
    for (const [x, y, r, c] of bodies) ball(f, hue, x, y, r, -0.4, -0.5, 0.75, GCOL[c], 0.35);
    if (m === 'trojan' && cols >= 100 && s.lab) for (const [nm, x, y] of s.lab) txt(g, x - 1, y - 1, nm, pc(s.Pt, 0.6));
    drawStars(f, s.stars, s.Ps);
  },
});

/* ═════════ 13. 星座連線 ═════════ */
const CN1 = '銀玉霜雲夜琉晨暮星月風雪琴燭', CN2 = '狐鹿鯨鶴舟弓鏡燈冠劍蝶貓魚角';
const CE1 = ['Silver', 'Jade', 'Frost', 'Cloud', 'Night', 'Glass', 'Dawn', 'Dusk', 'Star', 'Moon', 'Wind', 'Snow', 'Lyre', 'Candle'];
const CE2 = ['Fox', 'Deer', 'Whale', 'Crane', 'Boat', 'Bow', 'Mirror', 'Lamp', 'Crown', 'Sword', 'Moth', 'Cat', 'Fish', 'Horn'];
// 隨機星座名稱：中英文同一組（亂數用量和 pick() 一樣），畫的時候用 cnm(f, 名稱) 依語言取字
const cname = () => { const a = (Math.random() * CN1.length) | 0, b = (Math.random() * CN2.length) | 0; return { zh: CN1[a] + CN2[b] + '座', en: CE1[a] + ' ' + CE2[b] }; };
const cnm = (f, N) => tr(f, N.zh, N.en);
// Prim 最小生成樹：回傳依加入順序排列的邊 [a, b]
function primEdges(pts, aspect) {
  const n = pts.length, inT = new Uint8Array(n), best = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1), out = [];
  best[0] = 0;
  for (let it = 0; it < n; it++) {
    let k = -1;
    for (let i = 0; i < n; i++) if (!inT[i] && (k < 0 || best[i] < best[k])) k = i;
    inT[k] = 1;
    if (from[k] >= 0) out.push([from[k], k]);
    for (let i = 0; i < n; i++) {
      if (inT[i]) continue;
      const d = Math.hypot(pts[i][0] - pts[k][0], (pts[i][1] - pts[k][1]) * aspect);
      if (d < best[i]) { best[i] = d; from[i] = k; }
    }
  }
  return out;
}
// 畫一段線（只畫在空格上，依斜率挑字），fr 0–1 表示畫到哪裡
function seg(f, x0, y0, x1, y1, col, fr, dotted) {
  const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co;
  const sc = slopeCh(x1 - x0, y1 - y0, aspect), n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * (fr === undefined ? 1 : fr));
  const L = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
  for (let k = 1; k < n; k++) {
    if (dotted && k % 2) continue;
    const x = x0 + ((x1 - x0) * k) / L, y = y0 + ((y1 - y0) * k) / L;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const i = (y | 0) * cols + (x | 0);
    if (ch[i] !== ' ' && ch[i] !== '.') continue;
    ch[i] = sc; co[i] = col;
  }
}
A({ id: 'sp-constel', name: '星座連線', cat: '太空', theme: 'ice', hue: true, desc: '星星一顆顆連成新的星座又淡去',
  params: { mode: 'figures' },
  variants: [
    { id: 'sphere', name: '天球儀', desc: '帶經緯網格的天球緩緩轉動', params: { mode: 'sphere' } },
    { id: 'plexus', name: '星網', desc: '漂移的星點彼此靠近就連線', params: { mode: 'plexus' } },
    { id: 'atlas', name: '古星圖', desc: '白紙墨線的星圖慢慢捲動', theme: 'paper', hue: false, params: { mode: 'atlas' } },
    { id: 'polar', name: '北天極', desc: '星座繞著北極星旋轉', params: { mode: 'polar' } },
    { id: 'tree', name: '星樹生長', desc: '從一顆星長出連遍全天的樹', params: { mode: 'tree' } },
    { id: 'scope', name: '巡天望遠鏡', desc: '準星在星間移動並標示座標', params: { mode: 'scope' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, aspect, p } = f, m = p.mode;
    s.key = null; s.T = 0;
    const N = Math.max(50, ((cols * rows) / (m === 'plexus' ? 110 : 34)) | 0);
    s.st = [];
    for (let k = 0; k < N; k++) s.st.push({ x: rnd(0, cols), y: rnd(0, rows), b: Math.pow(Math.random(), 2.4), ph: rnd(0, TAU), vx: gauss() * 0.5, vy: gauss() * 0.2, used: 0 });
    s.cons = []; s.next = 0.5;
    if (m === 'sphere' || m === 'polar') {
      s.sp = [];
      for (let k = 0; k < (m === 'sphere' ? 700 : Math.max(120, (cols * rows) / 16)); k++) {
        if (m === 'polar') { const z = rnd(0.25, 1), a = rnd(0, TAU), r = Math.sqrt(1 - z * z); s.sp.push([r * Math.cos(a), r * Math.sin(a), z, Math.pow(Math.random(), 2.3), rnd(0, TAU)]); continue; }
        let x = gauss(), y = gauss(), z = gauss();
        const l = Math.hypot(x, y, z);
        s.sp.push([x / l, y / l, z / l, Math.pow(Math.random(), 2.3), rnd(0, TAU)]);
      }
      if (m === 'polar') {
        s.land = new Float32Array(cols).fill(0);
        for (let x = 0; x < cols; x++) s.land[x] = rows * (0.88 - 0.04 * nz((x / cols) * 30, 3));
        for (let k = 0; k < cols / 5; k++) {
          const tx = rnd(0, cols), th = rows * rnd(0.05, 0.14), tw = th * aspect * rnd(0.16, 0.26);
          for (let x = Math.floor(tx - tw); x <= tx + tw; x++) if (x >= 0 && x < cols) s.land[x] = Math.min(s.land[x], rows * 0.88 - th * (1 - Math.abs(x - tx) / tw));
        }
      }
      // 預先找好幾個星座（亮星之間的最小生成樹）
      s.groups = [];
      const bright = s.sp.map((q, i) => [q, i]).filter(([q]) => q[3] > 0.45);
      const used = new Set();
      for (const [q, i] of bright) {
        if (used.has(i) || s.groups.length > (m === 'sphere' ? 14 : 9)) continue;
        if (m === 'polar' && q[2] < 0.15) continue;
        const near = bright.filter(([q2, j]) => !used.has(j) && (q2[0] - q[0]) ** 2 + (q2[1] - q[1]) ** 2 + (q2[2] - q[2]) ** 2 < 0.12).slice(0, 7);
        if (near.length < 3) continue;
        for (const [, j] of near) used.add(j);
        const ids = near.map(([, j]) => j);
        const edges = primEdges(ids.map(j => [s.sp[j][0], s.sp[j][1] + s.sp[j][2]]), 1).map(([a, b]) => [ids[a], ids[b]]);
        s.groups.push({ ids, edges, name: cname() });
      }
    }
    if (m === 'tree') this.treeReset(s, f);
    if (m === 'scope') { s.tg = this.pickTarget(s, f, null); s.from = { x: cols / 2, y: rows / 2 }; s.tt = 0; }
    if (m === 'atlas') {
      s.ast = [];
      const W = cols * 3;
      for (let k = 0; k < (W * rows) / 45; k++) s.ast.push({ x: rnd(0, W), y: rnd(1, rows - 2), b: Math.pow(Math.random(), 2.2) });
      s.aW = W;
      s.agr = [];
      const br = s.ast.filter(q => q.b > 0.42);
      const usedA = new Set();
      for (const q of br) {
        if (usedA.has(q)) continue;
        const near = br.filter(q2 => !usedA.has(q2) && Math.hypot(q2.x - q.x, (q2.y - q.y) * aspect) < cols * 0.16).slice(0, 7);
        if (near.length < 3) continue;
        for (const q2 of near) usedA.add(q2);
        s.agr.push({ pts: near, edges: primEdges(near.map(q2 => [q2.x, q2.y]), aspect), name: cname() });
      }
    }
  },
  treeReset(s, f) {
    const { cols, rows, aspect } = f;
    s.tst = [];
    for (let k = 0; k < Math.max(30, (cols * rows) / 90); k++) s.tst.push([rnd(1, cols - 1), rnd(1, rows - 1), Math.pow(Math.random(), 2)]);
    s.tst.sort((a, b) => Math.hypot(a[0] - cols / 2, (a[1] - rows / 2) * aspect) - Math.hypot(b[0] - cols / 2, (b[1] - rows / 2) * aspect));
    s.ted = primEdges(s.tst, aspect);
    s.depth = new Int32Array(s.tst.length);
    for (const [a, b] of s.ted) s.depth[b] = s.depth[a] + 1;
    s.maxD = Math.max(1, ...s.depth);
    s.ord = new Int32Array(s.tst.length).fill(-1);
    s.ted.forEach((e, j) => { s.ord[e[1]] = j; });
    s.tt = 0;
  },
  pickTarget(s, f, prev) {
    const c = s.st.filter(q => q.b > 0.35 && q !== prev && q.x > 6 && q.x < f.cols - 6 && q.y > 3 && q.y < f.rows - 3);
    const q = c.length ? pick(c) : pick(s.st);
    return { q, id: 'SKY-' + (1000 + ((Math.random() * 8999) | 0)), ra: ((q.x / f.cols) * 24).toFixed(2), de: ((0.5 - q.y / f.rows) * 120).toFixed(1), mag: (6 - q.b * 5.5).toFixed(1) };
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.1, 1);
    s.Pl = pal(f, h, [[30, 50, 90], [90, 140, 220], [170, 210, 255]], 0.12, 0.65);
    s.Pg = pal(f, h, [[20, 30, 50], [50, 70, 110]], 0.06, 0.25);
    s.Pt = pal(f, h, [[90, 110, 150], [200, 220, 255]], 0.3, 0.75);
    s.Ph = pal(f, h, [[60, 30, 0], [255, 170, 60], [255, 230, 170]], 0.3, 0.95);
    s.Pt2 = Array.from({ length: 12 }, (_, k) => (h ? rgb(...hsl2rgb(200 + k * 14, 0.7, 0.62)) : f.C(0.4 + k * 0.03)));
  },
  starCh(b) { return b > 0.8 ? '✦' : b > 0.55 ? '*' : b > 0.3 ? '+' : b > 0.12 ? '·' : '.'; },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode, dt = Math.min(f.dt, 0.1);
    s.T += dt;
    if (hue) f.bg = rgb(2, 4, 12);
    const tw = q => q.b * (0.75 + 0.25 * Math.sin(t * (0.7 + q.b) + q.ph));
    // 星座名稱最後才寫（txt 會先清掉底下的格子），線和星星就不會蓋到全形字的右半格
    const labs = s.labs || (s.labs = []);
    labs.length = 0;
    if (m === 'figures') {
      s.next -= dt;
      const maxC = cols >= 120 ? 4 : 2;
      if (s.next <= 0 && s.cons.length < maxC) {
        s.next = rnd(1.5, 3.5);
        const free = s.st.filter(q => q.b > 0.4 && !q.used);
        if (free.length) {
          const seed = pick(free), Rc = Math.max(12, cols * 0.13);
          const near = free.filter(q => Math.hypot(q.x - seed.x, (q.y - seed.y) * aspect) < Rc).sort((a, b) => Math.hypot(a.x - seed.x, a.y - seed.y) - Math.hypot(b.x - seed.x, b.y - seed.y)).slice(0, rint(4, 8));
          if (near.length >= 3) {
            for (const q of near) q.used = 1;
            s.cons.push({ pts: near, edges: primEdges(near.map(q => [q.x, q.y]), aspect), age: 0, name: cname() });
          }
        }
      }
      for (let k = s.cons.length - 1; k >= 0; k--) {
        const C = s.cons[k];
        C.age += dt;
        const drawT = C.edges.length * 0.45, life = drawT + 7, fade = C.age > life ? 1 - (C.age - life) / 1.5 : 1;
        if (fade <= 0) { for (const q of C.pts) q.used = 0; kill(s.cons, k); continue; }
        C.edges.forEach(([a, b], j) => {
          const fr = clamp((C.age - j * 0.45) / 0.45, 0, 1);
          if (fr > 0) seg(f, C.pts[a].x, C.pts[a].y, C.pts[b].x, C.pts[b].y, pc(s.Pl, 0.25 + 0.6 * fade), fr);
        });
        if (C.age > drawT && cols >= 80) {
          let mx = 0, my = -1e9;
          for (const q of C.pts) { mx += q.x; my = Math.max(my, q.y); }
          const nm = cnm(f, C.name); labs.push(mx / C.pts.length - g.textW(nm) / 2, Math.min(rows - 1, my + 2), nm, pc(s.Pt, fade * Math.min(1, (C.age - drawT) / 1.5)));
        }
        for (const q of C.pts) g.set(q.x, q.y, this.starCh(Math.max(0.6, q.b)), pc(s.Ps, 0.6 + 0.4 * fade));
      }
      for (const q of s.st) { const i = (q.y | 0) * cols + (q.x | 0); if (ch[i] === ' ') { const v = tw(q); ch[i] = this.starCh(v); co[i] = pc(s.Ps, 0.1 + v * 0.8); } }
    } else if (m === 'sphere' || m === 'polar') {
      const pol = m === 'polar';
      const R = pol ? Math.max(cols * 0.62, rows * aspect * 1.1) : Math.min(rows * 0.47 * aspect, cols * 0.32), cx = cols / 2, cy = pol ? rows * 0.12 : rows / 2;
      const rot = s.T * (pol ? 0.03 : 0.08), tilt = pol ? 0 : 0.42;
      const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st2 = Math.sin(tilt);
      // 轉換：繞 z（天極）轉，再傾斜。polar 模式下天極朝向觀者
      const proj = (x, y, z) => {
        const x1 = x * cr - y * sr, y1 = x * sr + y * cr;
        if (pol) return [cx + x1 * R, cy - (y1 * R) / aspect, z];
        const y2 = z * ct - y1 * st2, z2 = z * st2 + y1 * ct;
        return [cx + x1 * R, cy - (y2 * R) / aspect, z2];
      };
      if (!pol) {
        // 經緯線
        for (let la = -60; la <= 60; la += 30) {
          const z = Math.sin((la * Math.PI) / 180), rr = Math.cos((la * Math.PI) / 180), N = Math.ceil(R * rr * 5);
          for (let j = 0; j < N; j += 2) { const a = (j / N) * TAU, P = proj(rr * Math.cos(a), rr * Math.sin(a), z); if (P[2] > 0) g.set(P[0], P[1], '·', pc(s.Pg, 0.9)); }
        }
        for (let lo = 0; lo < 6; lo++) {
          const a = (lo / 6) * Math.PI, N = Math.ceil(R * 5);
          for (let j = 0; j < N; j += 2) { const b = (j / N) * TAU, P = proj(Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)); if (P[2] > 0) g.set(P[0], P[1], '·', pc(s.Pg, 0.9)); }
        }
        // 球的外緣
        const NE = Math.ceil(R * 7);
        for (let j = 0; j < NE; j++) { const a = (j / NE) * TAU; g.set(cx + Math.cos(a) * R, cy + (Math.sin(a) * R) / aspect, '.', pc(s.Pl, 0.4)); }
        // 黃道（傾斜 23°）
        const N = Math.ceil(R * 6), e = 0.41;
        for (let j = 0; j < N; j++) { const a = (j / N) * TAU, P = proj(Math.cos(a), Math.sin(a) * Math.cos(e), Math.sin(a) * Math.sin(e)); if (P[2] > 0) g.set(P[0], P[1], '-', pc(s.Ph, 0.5)); }
      }
      // 投影結果放在重複使用的陣列裡（每格不配置新陣列）
      const NS = s.sp.length;
      if (!s.spx || s.spx.length !== NS) { s.spx = new Float32Array(NS); s.spy = new Float32Array(NS); s.spz = new Float32Array(NS); }
      const SX = s.spx, SY = s.spy, SZ = s.spz;
      for (let k = 0; k < NS; k++) {
        const q = s.sp[k], x1 = q[0] * cr - q[1] * sr, y1 = q[0] * sr + q[1] * cr;
        if (pol) {
          if (q[2] <= 0) { SZ[k] = -1; continue; }
          const kk = (R * 1.1) / (1 + q[2]);
          SX[k] = cx + x1 * kk; SY[k] = cy + (y1 * kk) / aspect; SZ[k] = 1;
        } else {
          SX[k] = cx + x1 * R; SY[k] = cy - ((q[2] * ct - y1 * st2) * R) / aspect; SZ[k] = q[2] * st2 + y1 * ct;
        }
      }
      for (const G of s.groups) {
        for (const [a, b] of G.edges) { if (SZ[a] < 0 || SZ[b] < 0) continue; seg(f, SX[a], SY[a], SX[b], SY[b], pc(s.Pl, 0.55)); }
        if (cols >= 100) {
          const a = G.ids[0];
          if (SZ[a] > (pol ? 0 : 0.55)) {
            // 英文名稱比較長：星星轉出畫面就不寫，右邊放不下時改寫在星星左邊（中文照舊）
            const nm = cnm(f, G.name), w = g.textW(nm);
            if (f.lang !== 'en') labs.push(SX[a] + 2, SY[a] - 1, nm, pc(s.Pt, 0.55));
            else if (SX[a] >= 0 && SX[a] < cols) labs.push(SX[a] + 2 + w > cols ? SX[a] - 1 - w : SX[a] + 2, SY[a] - 1, nm, pc(s.Pt, 0.55));
          }
        }
      }
      for (let k = 0; k < NS; k++) {
        if (SZ[k] < 0) continue;
        const x = SX[k], y = SY[k];
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const q = s.sp[k], v = q[3] * (0.75 + 0.25 * Math.sin(t * (0.6 + q[3]) + q[4]));
        g.set(x, y, this.starCh(v), pc(s.Ps, 0.15 + 0.85 * v));
      }
      if (pol) {
        g.set(cx, cy, '✦', pc(s.Ph, 1));
        if (cols >= 100) labs.push(cx + 2, cy, tr(f, '北極星', 'Polaris'), pc(s.Pt, 0.6));
        for (let x = 0; x < cols; x++) {
          const h = s.land[x];
          for (let y = Math.max(0, Math.floor(h)); y < rows; y++) { const i = y * cols + x; ch[i] = '█'; co[i] = hue ? rgb(5, 7, 14) : f.C(0.03); }
        }
        // 落到地面剪影裡的名稱不寫
        for (let j = 0; j < labs.length; j += 4) {
          const lx = Math.floor(labs[j]), ly = Math.floor(labs[j + 1]);
          if (lx >= 0 && lx < cols && ly >= s.land[lx] - 1) labs[j + 2] = '';
          // 英文名稱較長：整串任何一格碰到山稜就不寫（中文只看開頭那格，照舊）
          else if (f.lang === 'en' && labs[j + 2]) { const x1 = Math.min(cols, lx + g.textW(labs[j + 2])); for (let x = Math.max(0, lx); x < x1; x++) if (ly >= s.land[x] - 1) { labs[j + 2] = ''; break; } }
        }
        if (cols >= 80) { const nl = tr(f, '北', 'N'); labs.push(cx - g.textW(nl) / 2, rows - 1, nl, pc(s.Pt, 0.5)); }
      }
    } else if (m === 'plexus') {
      const thr = Math.max(10, cols * 0.08), S = s.st;
      for (const q of S) {
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.x < 0) q.x += cols; if (q.x >= cols) q.x -= cols; if (q.y < 0) q.y += rows; if (q.y >= rows) q.y -= rows;
      }
      for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
        const dx = S[j].x - S[i].x;
        if (dx > thr || dx < -thr) continue;
        const dy = (S[j].y - S[i].y) * aspect;
        if (dy > thr || dy < -thr) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > thr) continue;
        seg(f, S[i].x, S[i].y, S[j].x, S[j].y, pc(s.Pl, 0.15 + 0.75 * (1 - d / thr)), 1, d > thr * 0.6);
      }
      for (const q of S) { const v = Math.max(0.35, tw(q)); g.set(q.x, q.y, v > 0.6 ? '@' : 'o', pc(s.Ps, 0.3 + 0.7 * v)); }
    } else if (m === 'atlas') {
      const off = (s.T * Math.max(1.5, cols * 0.012)) % s.aW;
      const X = x => { let v = x - off; if (v < -cols * 0.5) v += s.aW; return v; };
      // 赤緯線與赤經線
      for (let y = 2; y < rows - 1; y += Math.max(3, Math.round(rows / 6))) for (let x = 0; x < cols; x += 2) { const i = y * cols + x; ch[i] = '·'; co[i] = f.C(0.25); }
      const hw = s.aW / 24;
      for (let h2 = 0; h2 < 24; h2++) {
        const x = Math.round(X(h2 * hw));
        if (x < 0 || x >= cols) continue;
        for (let y = 1; y < rows - 1; y++) if (y % 2 === 0) { const i = y * cols + x; ch[i] = '¦'; co[i] = f.C(0.25); }
        txt(g, x - 1, 0, h2 + 'h', f.C(0.6));
      }
      for (const G of s.agr) {
        for (const [a, b] of G.edges) { const A0 = G.pts[a], B0 = G.pts[b], xa = X(A0.x), xb = X(B0.x); if (Math.abs(xa - xb) > cols) continue; seg(f, xa, A0.y, xb, B0.y, f.C(0.55)); }
        const A0 = G.pts[0], xa = X(A0.x);
        const nm = cnm(f, G.name);
        if (xa > 2 && xa < cols - Math.max(8, g.textW(nm) + 2) && cols >= 80) labs.push(xa + 1, Math.min(rows - 2, A0.y + 1.5), nm, f.C(0.75));
      }
      for (const q of s.ast) { const x = X(q.x); if (x < 0 || x >= cols) continue; g.set(x, q.y, q.b > 0.7 ? '●' : q.b > 0.4 ? '•' : q.b > 0.15 ? '·' : '.', f.C(0.4 + q.b * 0.6)); }
      for (let x = 0; x < cols; x++) { g.set(x, rows - 1, '═', f.C(0.5)); }
    } else if (m === 'tree') {
      s.tt += dt;
      if (s.doneAt && s.tt - s.doneAt > 6) { s.doneAt = 0; this.treeReset(s, f); }
      const rate = Math.max(6, s.ted.length / 14), nShow = Math.min(s.ted.length, s.tt * rate), done = nShow >= s.ted.length;
      if (done && !s.doneAt) s.doneAt = s.tt;
      const fade = s.doneAt ? clamp(1 - (s.tt - s.doneAt - 4) / 2, 0, 1) : 1;
      for (let j = 0; j < Math.ceil(nShow); j++) {
        const [a, b] = s.ted[j], A0 = s.tst[a], B0 = s.tst[b], fr = Math.min(1, nShow - j);
        const col = s.Pt2[Math.min(11, Math.floor((s.depth[b] / s.maxD) * 11))];
        seg(f, A0[0], A0[1], B0[0], B0[1], fade < 1 ? pc(s.Pl, fade * 0.7) : col, fr);
      }
      s.tst.forEach((q, k) => { const lit = k === 0 || s.ord[k] < nShow; g.set(q[0], q[1], lit ? (k === 0 ? '@' : '*') : '.', pc(s.Ps, lit ? 0.5 + q[2] * 0.5 * fade : 0.25)); });
      for (const q of s.st) { const i = (q.y | 0) * cols + (q.x | 0); if (ch[i] === ' ' && q.b < 0.3) { ch[i] = '.'; co[i] = pc(s.Ps, 0.1 + q.b); } }
    } else {
      // 巡天望遠鏡
      s.tt += dt;
      const mv = 2.2, hold = 3.5, cyc = mv + hold;
      if (s.tt > cyc) { s.tt -= cyc; s.from = { x: s.tg.q.x, y: s.tg.q.y }; s.tg = this.pickTarget(s, f, s.tg.q); }
      const k = smooth(Math.min(1, s.tt / mv)), rx = lerp(s.from.x, s.tg.q.x, k), ry = lerp(s.from.y, s.tg.q.y, k);
      const lock = s.tt > mv, R = lock ? Math.max(3, cols * 0.025) : Math.max(5, cols * 0.045);
      for (const q of s.st) { const i = (q.y | 0) * cols + (q.x | 0); const v = tw(q); ch[i] = this.starCh(v); co[i] = pc(s.Ps, 0.1 + v * 0.8); }
      const hc = pc(s.Ph, 0.55), hd = pc(s.Ph, 0.25);
      for (let x = 0; x < cols; x += 3) if (Math.abs(x - rx) > R + 2) g.set(x, ry, '-', hd);
      for (let y = 0; y < rows; y += 2) if (Math.abs(y - ry) * aspect > R + 2) g.set(rx, y, '|', hd);
      const N = Math.ceil(R * 7);
      for (let j = 0; j < N; j++) { const a = (j / N) * TAU; g.set(rx + Math.cos(a) * R, ry + (Math.sin(a) * R) / aspect, lock ? 'o' : '.', hc); }
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.set(rx + sx * R * 1.4, ry + (sy * R * 1.4) / aspect, sx * sy > 0 ? '\\' : '/', hc); }
      if (lock && cols >= 80) {
        const tx = rx + R * 1.6 + 2 > cols - 26 ? rx - R * 1.6 - 26 : rx + R * 1.6 + 2, ty = clamp(ry - 2, 0, rows - 5);
        const T2 = s.tg, show = Math.min(4, Math.floor((s.tt - mv) * 6));
        const L = [tr(f, '目標 ', 'Target ') + T2.id, tr(f, '赤經 ', 'RA ') + T2.ra + 'h', tr(f, '赤緯 ', 'Dec ') + (T2.de > 0 ? '+' : '') + T2.de + '°', tr(f, '星等 ', 'Mag ') + T2.mag];
        for (let j = 0; j < show; j++) txt(g, tx, ty + j, L[j], pc(s.Ph, 0.8));
      }
      if (cols >= 80) txt(g, 2, rows - 1, lock ? tr(f, '鎖定', 'Locked') : tr(f, '移動中…', 'Slewing…'), pc(s.Ph, 0.5));
    }
    flushLabels(g, labs, s);
  },
});

/* ═════════ 14. 衛星軌道 ═════════ */
// 程序生成的「類地行星」表面顏色：lon、lat 弧度
// 結果顏色寫進 ECOL（重複使用，不配置新陣列），回傳亮度係數
const ECOL = new Float64Array(3);
function earthCol(lon, lat, T) {
  const tu = (lon / TAU) * 256, tv = (lat / Math.PI + 0.5) * 128;
  const h = nz(tu * 0.7 + 3, tv * 1.3), land = h > 0.58, ice = Math.abs(lat) > 1.2 - 0.1 * nz(tu * 3, 9);
  const cloud = smooth((nz(tu * 1.5 + 60 - T * 0.4, tv * 2.6) - 0.55) / 0.2), k = cloud * 0.85;
  let r, g, b;
  if (ice) { r = 235; g = 240; b = 250; } else if (land) { if (h > 0.75) { r = 150; g = 130; b = 90; } else { r = 90; g = 135; b = 70; } } else { r = 30; g = 80; b = 200; }
  ECOL[0] = r + (245 - r) * k; ECOL[1] = g + (248 - g) * k; ECOL[2] = b + (255 - b) * k;
  return land || ice || cloud > 0.4 ? 1 : 0.75;
}
A({ id: 'sp-sats', name: '衛星軌道', cat: '太空', theme: 'cyber', hue: true, desc: '各種傾角的人造衛星繞著行星轉',
  params: { mode: 'mix' },
  variants: [
    { id: 'mega', name: '巨型星座', desc: '數百顆衛星組成會動的網格', params: { mode: 'mega' } },
    { id: 'track', name: '星下點', desc: '任務地圖上的正弦軌跡與晨昏線', params: { mode: 'track' } },
    { id: 'station', name: '環形太空站', desc: '旋轉的輪形太空站與來訪的太空船', params: { mode: 'station' } },
    { id: 'elevator', name: '太空電梯', desc: '纜繩直通天際，升降艙上上下下', params: { mode: 'elevator' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows, p } = f, m = p.mode;
    s.key = null; s.T = 0;
    s.stars = mkStars(Math.max(30, (cols * rows / 40) | 0));
    s.O = [];
    const add = (a, inc, node, n, c, sz) => { for (let k = 0; k < n; k++) s.O.push({ a, inc, node, ph: (k / n) * TAU + rnd(-0.05, 0.05), c, sz }); };
    s.paths = [];
    if (m === 'mix') {
      const L = [[1.3, 0.9, 0.2], [1.38, 1.5, 1.4], [1.25, 0.35, 2.6]];
      L.forEach(([a, i, n], k) => { add(a, i, n, 5, k, 1); s.paths.push([a, i, n, k]); });
      add(2.2, 0.96, 0.8, 6, 3, 1); s.paths.push([2.2, 0.96, 0.8, 3]);
      add(3.3, 0.02, 0, 4, 4, 2); s.paths.push([3.3, 0.02, 0, 4]);
    } else if (m === 'geo') {
      add(3.2, 0.0, 0, 24, 4, 1); s.paths.push([3.2, 0, 0, 4]);
      s.xfer = 0;
    } else if (m === 'mega') {
      for (let pl = 0; pl < 18; pl++) add(1.18, 0.93, (pl / 18) * TAU, 20, pl % 3, 0);
      s.O.forEach((q, k) => { q.ph += ((k / 20) | 0) * 0.17; });
    } else if (m === 'debris') {
      for (let k = 0; k < Math.min(1700, Math.max(500, (cols * rows) / 16)); k++) s.O.push({ a: 1.08 + Math.pow(Math.random(), 1.5) * 0.7, inc: Math.acos(rnd(-1, 1)), node: rnd(0, TAU), ph: rnd(0, TAU), c: 5, sz: 0 });
      s.burst = []; s.bt = 3;
    } else if (m === 'track') {
      s.trk = [[0.9, 0.4, 1, 'A-1'], [1.2, 2.1, 0.8, 'B-7'], [0.5, 4, 1.3, 'C-3']];
    } else if (m === 'station') {
      s.ship = 0;
    } else if (m === 'elevator') {
      s.cl = [];
      for (let k = 0; k < 5; k++) s.cl.push({ y: Math.random(), v: rnd(0.02, 0.05) * (k % 2 ? 1 : -1) });
    }
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.55);
    s.PO = GCOL.map(c => pal(f, h, [[c[0] * 0.2, c[1] * 0.2, c[2] * 0.2], c, [255, 255, 255]], 0.15, 1, 24));
    s.Pt = pal(f, h, [[60, 90, 120], [170, 220, 255]], 0.25, 0.75);
    s.Pd = pal(f, h, [[70, 70, 80], [180, 180, 190], [255, 240, 220]], 0.12, 0.8);
    s.Pm = pal(f, h, [[10, 25, 30], [30, 90, 110], [120, 220, 230]], 0.05, 0.6);
  },
  // 畫面下方的大行星弧面（幾何先算好存起來）
  bigPlanet(f, s, PR, pcx, pcy, lonK, latK, latOff, lx, ly, rotP) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, hue = s.hue;
    const key = cols + ',' + rows + ',' + PR;
    if (!s.pg || s.pg.key !== key) {
      const idx = [], lon = [], lat = [], li = [], rim = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const dx = (x + 0.5 - pcx) / PR, dy = ((y + 0.5 - pcy) * aspect) / PR, d2 = dx * dx + dy * dy;
        if (d2 > 1) { if (d2 < 1.005) rim.push(y * cols + x); continue; }
        const z = Math.sqrt(1 - d2);
        idx.push(y * cols + x); lon.push(Math.atan2(dx, z) * lonK); lat.push(clamp(Math.asin(-dy) * latK - latOff, -1.5, 1.5)); li.push(clamp(0.3 + dx * lx - dy * ly, 0, 1));
      }
      s.pg = { key, idx: Int32Array.from(idx), lon: Float32Array.from(lon), lat: Float32Array.from(lat), li: Float32Array.from(li), rim: Int32Array.from(rim) };
    }
    const P = s.pg;
    // 行星轉得很慢：每 3 格才重算一次顏色
    s.pgf = (s.pgf || 0) + 1;
    if (!P.ch || s.pgf % 3 === 0 || P.hue !== hue || P.C !== f.C) {
      P.ch = P.ch || new Array(P.idx.length); P.co = P.co || new Array(P.idx.length); P.hue = hue; P.C = f.C;
      for (let j = 0; j < P.idx.length; j++) {
        const k = earthCol(P.lon[j] + rotP, P.lat[j], s.T), l = P.li[j] * k;
        P.ch[j] = R10[Math.max(1, Math.min(9, (l * 9) | 0))]; P.co[j] = hue ? shade(ECOL, 0.12 + 0.8 * l) : f.C(0.05 + 0.7 * l);
      }
    }
    for (let j = 0; j < P.idx.length; j++) { const i = P.idx[j]; ch[i] = P.ch[j]; co[i] = P.co[j]; }
    const rc = hue ? rgb(90, 160, 255) : f.C(0.4);
    for (let j = 0; j < P.rim.length; j++) { ch[P.rim[j]] = '~'; co[P.rim[j]] = rc; }
  },
  planet(f, s, cx, cy, R, va, el, rot) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, hue = s.hue;
    const ce = Math.cos(el), se = Math.sin(el), cv = Math.cos(va), sv = Math.sin(va);
    const ry = R / aspect;
    for (let y = Math.max(0, Math.floor(cy - ry - 1)); y <= Math.min(rows - 1, cy + ry + 1); y++) for (let x = Math.max(0, Math.floor(cx - R - 1)); x <= Math.min(cols - 1, cx + R + 1); x++) {
      const sx = (x + 0.5 - cx) / R, sy = (-(y + 0.5 - cy) * aspect) / R, d2 = sx * sx + sy * sy, i = y * cols + x;
      if (d2 > 1) { if (d2 < 1.15) { ch[i] = '.'; co[i] = hue ? rgb(70, 130, 255) : f.C(0.3); } continue; }
      const d = Math.sqrt(1 - d2), z = sy * ce + d * se, y1 = sy * se - d * ce, xw = sx * cv + y1 * sv, yw = -sx * sv + y1 * cv;
      const k = earthCol(Math.atan2(yw, xw) + rot, Math.asin(clamp(z, -1, 1)), s.T);
      const l = clamp(sx * -0.55 + sy * 0.35 + d * 0.75, 0, 1), b = (0.06 + 0.94 * l) * k;
      ch[i] = R10[Math.max(1, Math.min(9, (b * 9.5) | 0))]; co[i] = hue ? shade(ECOL, 0.1 + 0.95 * l) : f.C(0.05 + 0.9 * b);
    }
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode, dt = Math.min(f.dt, 0.1);
    s.T += dt;
    if (hue) f.bg = rgb(1, 3, 10);
    const cx = cols / 2, cy = rows / 2;
    if (m === 'mix' || m === 'geo' || m === 'mega' || m === 'debris') {
      const far = m === 'geo' || m === 'mix' ? 3.5 : 1.9;
      const R = Math.min(cols * 0.47 / far, (rows * 0.47 * aspect) / (far * 0.55 + 0.45)), va = s.T * 0.05, el = m === 'mega' ? 0.5 : 0.32;
      const rot = s.T * (m === 'geo' ? 0.3 : 0.12);
      // 投影寫進重複使用的小陣列 PP：[畫面 x, 畫面 y, 深度, 是否落在行星圓盤內]（每顆衛星不配置新陣列）
      const cva = Math.cos(va), sva = Math.sin(va), cel = Math.cos(el), sel = Math.sin(el);
      const PP = s.pp || (s.pp = new Float64Array(4));
      const P = (x, y, z) => {
        const x1 = x * cva - y * sva, y1 = x * sva + y * cva, v1 = z * cel + y1 * sel;
        PP[0] = cx + x1 * R; PP[1] = cy - (v1 * R) / aspect; PP[2] = -y1 * cel + z * sel; PP[3] = x1 * x1 + v1 * v1 < 1 ? 1 : 0;
      };
      const PO = (q, u) => {
        const ci = Math.cos(q.inc), si = Math.sin(q.inc), cn = Math.cos(q.node), sn = Math.sin(q.node), cu = Math.cos(u), su = Math.sin(u);
        const y0 = su * ci;
        P(q.a * (cu * cn - y0 * sn), q.a * (cu * sn + y0 * cn), q.a * su * si);
      };
      // 軌道線（後半先畫）
      const drawPath = (a, inc, node, c, front) => {
        const q = { a, inc, node }, N = Math.ceil(a * R * 5), col = pc(s.PO[c], front ? 0.35 : 0.2), chh = front ? '·' : '.';
        for (let j = 0; j < N; j += 2) {
          PO(q, (j / N) * TAU);
          if ((PP[2] >= 0) !== front || (PP[2] < 0 && PP[3])) continue;
          g.set(PP[0], PP[1], chh, col);
        }
      };
      for (const [a, i, n, c] of s.paths) drawPath(a, i, n, c, false);
      const NO = s.O.length;
      if (!s.ix || s.ix.length < NO) { const cap = NO + 256; s.ix = new Float32Array(cap); s.iy = new Float32Array(cap); s.id = new Float32Array(cap); s.iq = new Int32Array(cap); }
      const IX = s.ix, IY = s.iy, ID = s.id, IQ = s.iq;
      let ni = 0;
      for (let k = 0; k < NO; k++) {
        const q = s.O[k], w = m === 'geo' && q.a > 3 ? 0.3 : 0.9 / Math.pow(q.a, 1.5);
        PO(q, q.ph + s.T * w);
        if (PP[2] < 0 && PP[3]) continue;
        IX[ni] = PP[0]; IY[ni] = PP[1]; ID[ni] = PP[2]; IQ[ni] = k; ni++;
      }
      // 背面的先畫，行星，前面的後畫
      for (let k = 0; k < ni; k++) if (ID[k] < 0) this.satDraw(g, s, IX[k], IY[k], s.O[IQ[k]], 0.45, hue, f);
      if (m === 'mega') {
        // 星間雷射連結：同軌道面相鄰的衛星
        const lc = pc(s.PO[1], 0.3);
        for (let k = 0; k < ni - 1; k++) { if (s.O[IQ[k]].node !== s.O[IQ[k + 1]].node || ID[k] < 0 || ID[k + 1] < 0) continue; seg(f, IX[k], IY[k], IX[k + 1], IY[k + 1], lc, 1, true); }
      }
      this.planet(f, s, cx, cy, R, va, el, rot);
      for (const [a, i, n, c] of s.paths) drawPath(a, i, n, c, true);
      for (let k = 0; k < ni; k++) if (ID[k] >= 0) this.satDraw(g, s, IX[k], IY[k], s.O[IQ[k]], 1, hue, f);
      if (m === 'geo') {
        // 霍曼轉移：從低軌道的橢圓爬升到同步軌道
        const cyc = 14, u = (s.T % cyc) / cyc, a1 = 1.25, a2 = 3.2, at = (a1 + a2) / 2, e = (a2 - a1) / (a2 + a1);
        const N = 120;
        for (let j = 0; j <= N; j += 3) {
          const nu = (j / N) * Math.PI, r = (at * (1 - e * e)) / (1 + e * Math.cos(nu));
          P(r * Math.cos(nu + 0.5), r * Math.sin(nu + 0.5), 0);
          const x = PP[0], y = PP[1];
          if (PP[2] < 0 && Math.hypot((x - cx) / R, ((y - cy) * aspect) / R) < 1) continue;
          g.set(x, y, '-', pc(s.PO[2], 0.4));
        }
        const E = keplerE(u * Math.PI - 0.0001, 0), nu = u * Math.PI, r = (at * (1 - e * e)) / (1 + e * Math.cos(nu));
        void E;
        P(r * Math.cos(nu + 0.5), r * Math.sin(nu + 0.5), 0);
        const x = PP[0], y = PP[1], d = PP[2];
        if (!(d < 0 && Math.hypot((x - cx) / R, ((y - cy) * aspect) / R) < 1)) {
          g.set(x, y, '◆', pc(s.PO[2], 1));
          if (u < 0.06 || u > 0.94) g.set(x - 1, y, '*', pc(s.PO[0], 1));
          if (cols >= 120) txt(g, x + 2, y, u < 0.06 ? tr(f, '點火', 'Burn') : u > 0.94 ? tr(f, '圓化', 'Circularize') : tr(f, '轉移中', 'Transfer orbit'), pc(s.Pt, 0.7));
        }
      }
      if (m === 'debris') {
        s.bt -= dt;
        if (s.bt <= 0) {
          s.bt = rnd(6, 11);
          const src = pick(s.O);
          for (let k = 0; k < 90; k++) s.O.push({ a: src.a * rnd(0.97, 1.05), inc: src.inc + gauss() * 0.04, node: src.node + gauss() * 0.04, ph: src.ph + s.T * (0.9 / Math.pow(src.a, 1.5)) * 0 + gauss() * 0.02, c: 0, sz: 0, born: s.T });
          s.burst.push({ q: src, age: 0 });
          if (s.O.length > 2100) s.O.splice(0, s.O.length - 2100);
        }
        for (let k = s.burst.length - 1; k >= 0; k--) {
          const B0 = s.burst[k];
          B0.age += dt;
          if (B0.age > 1.2) { s.burst.splice(k, 1); continue; }
          PO(B0.q, B0.q.ph + s.T * 0.9 / Math.pow(B0.q.a, 1.5));
          if (PP[2] >= 0) sunGlow(f, PP[0], PP[1], 1 + B0.age * 3, s.PO[0], 0, 2);
        }
        for (const q of s.O) if (q.c === 0 && s.T - q.born > 20) q.c = 5;
      }
    } else if (m === 'track') {
      // 任務地圖
      const rotE = s.T * 0.05, sunL = -s.T * 0.05;
      const H = rows - 1;
      if (!s.lm || s.lm.length !== cols * rows) {
        s.lm = new Uint8Array(cols * rows);
        for (let y = 0; y < H; y++) for (let x = 0; x < cols; x++) { earthCol(((x + 0.5) / cols - 0.5) * TAU + 1, (0.5 - (y + 0.5) / H) * Math.PI * 0.9, 0); s.lm[y * cols + x] = ECOL[1] > ECOL[2] ? 1 : 0; }
      }
      for (let y = 0; y < H; y++) {
        const lat = (0.5 - (y + 0.5) / H) * Math.PI * 0.9;
        for (let x = 0; x < cols; x++) {
          const lon = ((x + 0.5) / cols - 0.5) * TAU, i = y * cols + x;
          const land = s.lm[i];
          const day = Math.cos(lat) * Math.cos(lon - sunL) > -0.05 ? 1 : 0.35;
          const grid = (x % Math.max(1, Math.round(cols / 12)) === 0) || (y % Math.max(1, Math.round(H / 6)) === 0);
          if (land) { ch[i] = day > 0.5 ? '#' : '+'; co[i] = pc(s.Pm, day > 0.5 ? 0.75 : 0.35); }
          else if (grid) { ch[i] = '·'; co[i] = pc(s.Pm, 0.3); }
          else if (day > 0.5) { ch[i] = '.'; co[i] = pc(s.Pm, 0.12); }
        }
      }
      const colsC = [0, 2, 4];
      s.trk.forEach(([inc, n0, sp, name], k) => {
        const per = 22 / sp, u0 = (s.T / per) * TAU;
        let px = -1, py = -1;
        const N = 240;
        for (let j = 0; j <= N; j++) {
          const u = u0 - (j / N) * TAU * 1.2, tt = u / TAU * per;
          const lat = Math.asin(Math.sin(inc) * Math.sin(u)), lon = Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u)) + n0 - tt * 0.05 * 3;
          const x = ((((lon / TAU + 0.5) % 1) + 1) % 1) * cols, y = (0.5 - lat / (Math.PI * 0.9)) * H;
          if (px >= 0 && Math.abs(x - px) < cols / 2 && j % 2 === 0) g.set(x, y, '·', pc(s.PO[colsC[k]], 0.75 - (j / N) * 0.5));
          if (j === 0) {
            const r = Math.max(3, cols * 0.035), M = Math.ceil(r * 6);
            for (let q = 0; q < M; q += 2) { const a = (q / M) * TAU; g.set(x + Math.cos(a) * r, y + (Math.sin(a) * r) / aspect, '.', pc(s.PO[colsC[k]], 0.5)); }
            g.set(x, y, '◎', pc(s.PO[colsC[k]], 1));
            if (cols >= 100) txt(g, x + 2, y - 1, name, pc(s.PO[colsC[k]], 0.85));
          }
          px = x; py = y;
        }
        void py;
      });
      if (cols >= 100) txt(g, 1, rows - 1, tr(f, '衛星追蹤  晨昏線向西移動', 'Satellite tracking · terminator moving west'), pc(s.Pt, 0.6));
    } else if (m === 'station') {
      // 下方的行星弧面
      const PR = cols * 1.4, pcy = rows + PR / aspect * 0.86;
      this.bigPlanet(f, s, PR, cx, pcy, 5, 4, 1.2, -0.3, 0.5, s.T * 0.02);
      // 環形太空站（點雲＋深度緩衝）
      if (!s.zb || s.zb.length !== cols * rows) s.zb = new Float32Array(cols * rows);
      const zb = s.zb;
      zb.fill(-1e9);
      const Rt = Math.min(cols * 0.3, rows * aspect * 0.55), rt = Rt * 0.11, scx = cols * 0.5, scy = rows * 0.42;
      const tilt = 1.05, ct = Math.cos(tilt), st2 = Math.sin(tilt), spin = s.T * 0.25;
      const L = [-0.5, 0.6, 0.62];
      const put = (X, Y, Z, nx, ny, nz2, glow) => {
        const y1 = Y * ct - Z * st2, z1 = Y * st2 + Z * ct, x = scx + X, y = scy - y1 / aspect;
        if (x < 0 || y < 0 || x >= cols || y >= rows) return;
        const i = (y | 0) * cols + (x | 0);
        if (zb[i] > z1) return;
        zb[i] = z1;
        const ny1 = ny * ct - nz2 * st2, nz1 = ny * st2 + nz2 * ct;
        let l = clamp(nx * L[0] + ny1 * L[1] + nz1 * L[2], 0, 1) * 0.85 + 0.12;
        if (glow) { ch[i] = '▪'; co[i] = hue ? rgb(255, 230, 150) : f.C(1); return; }
        ch[i] = R10[Math.max(2, Math.min(9, (l * 9.5) | 0))]; co[i] = hue ? shd(200, 205, 215, 0.2 + 0.85 * l) : f.C(0.1 + 0.85 * l);
      };
      const NU = Math.ceil(TAU * Rt * 0.8), NV = Math.max(8, Math.ceil(TAU * rt * 0.5));
      for (let a = 0; a < NU; a++) {
        const u = (a / NU) * TAU + spin, cu = Math.cos(u), su = Math.sin(u);
        const win = a % Math.max(3, Math.round(NU / 48)) === 0;
        for (let b = 0; b < NV; b++) {
          const v = (b / NV) * TAU, cvv = Math.cos(v), svv = Math.sin(v), r = Rt + rt * cvv;
          put(r * cu, r * su, rt * svv, cvv * cu, cvv * su, svv, win && b === 0);
        }
      }
      // 輪輻與中心
      for (let k = 0; k < 4; k++) {
        const u = spin + (k * TAU) / 4, cu = Math.cos(u), su = Math.sin(u);
        for (let r = rt * 1.6; r < Rt - rt; r += 0.6) put(r * cu, r * su, 0, cu, su, 0.3, false);
      }
      for (let z = -rt * 1.8; z <= rt * 1.8; z += 0.8) for (let a = 0; a < 20; a++) { const u = (a / 24) * TAU; put(Math.cos(u) * rt * 1.4, Math.sin(u) * rt * 1.4, z, Math.cos(u), Math.sin(u), 0, false); }
      // 來訪的太空船：沿轉軸靠近
      const cyc = 20, uu = (s.T % cyc) / cyc, dist = uu < 0.6 ? (1 - uu / 0.6) * Rt * 1.6 + rt * 2 : rt * 2;
      const shx = scx, shy = scy - ((dist * st2) / aspect) * 1.0;
      if (uu < 0.9) { txt(g, shx - 2, shy, '<=#=>', hue ? rgb(230, 235, 245) : f.C(0.9)); if (uu < 0.6 && Math.sin(s.T * 10) > 0) g.set(shx, shy - 1, '*', hue ? rgb(255, 200, 120) : f.C(1)); }
    } else {
      // 太空電梯
      const PR = cols * 1.2, pcy = rows + PR / aspect * 0.8, rotP = s.T * 0.015;
      const topY = rows * 0.07, baseX = cols * 0.5;
      this.bigPlanet(f, s, PR, baseX, pcy, 5, 4, 1.0, 0.4, 0.4, rotP);
      const surfY = pcy - PR / aspect;
      const sway = x0 => Math.sin(s.T * 0.3) * 0.6 * x0;
      for (let y = Math.floor(topY); y < surfY; y++) { const fr = (y - topY) / (surfY - topY); g.set(baseX + sway(fr * (1 - fr) * 4), y, '│', hue ? rgb(170, 180, 200) : f.C(0.55)); }
      for (const q of s.cl) {
        q.y += q.v * dt;
        if (q.y > 1 || q.y < 0) { q.v = -q.v; q.y = clamp(q.y, 0, 1); }
        const y = topY + 2 + q.y * (surfY - topY - 4), fr = (y - topY) / (surfY - topY);
        txt(g, baseX + sway(fr * (1 - fr) * 4) - 1, y, '[■]', hue ? rgb(255, 210, 120) : f.C(0.9));
        if (Math.sin(s.T * 4 + q.v * 100) > 0.6) g.set(baseX + sway(fr * (1 - fr) * 4) + 2, y, '·', hue ? rgb(255, 80, 80) : f.C(1));
      }
      // 頂端配重站
      const W = Math.max(4, Math.round(cols * 0.04));
      for (let x = -W; x <= W; x++) g.set(baseX + x, topY, x === -W || x === W ? 'O' : '=', hue ? rgb(210, 215, 230) : f.C(0.8));
      g.set(baseX, topY - 1, '▲', hue ? rgb(255, 230, 160) : f.C(1));
      txt(g, baseX - 2, surfY - 1, '/███\\', hue ? rgb(120, 130, 150) : f.C(0.5));
      if (cols >= 120) { txt(g, baseX + W + 2, topY, tr(f, '配重站', 'Counterweight'), pc(s.Pt, 0.6)); txt(g, baseX + 4, surfY - 2, tr(f, '海上基座', 'Ocean platform'), pc(s.Pt, 0.6)); }
    }
    drawStars(f, s.stars, s.Ps);
  },
  satDraw(g, s, x, y, q, k, hue, f) {
    if (q.sz === 0) { g.set(x, y, k > 0.6 ? '·' : '.', pc(s.PO[q.c], 0.4 + 0.5 * k)); return; }
    const col = pc(s.PO[q.c], 0.5 + 0.5 * k);
    g.set(x, y, '◆', col);
    if (q.sz > 1 || f.cols >= 150) { g.set(x - 1, y, '-', pc(s.PO[q.c], 0.4 * k + 0.2)); g.set(x + 1, y, '-', pc(s.PO[q.c], 0.4 * k + 0.2)); }
  },
});

/* ═════════ 15. 火箭發射 ═════════ */
// 火箭圖：寬 w（奇數）、高 h 列；回傳 { lines, split }，split 是一二節分界的列
function rocketArt(w, h) {
  w = Math.max(3, w | 1);
  const L = [], half = (w - 1) >> 1, nose = Math.max(2, Math.round(h * 0.18));
  for (let j = 0; j < nose; j++) {
    const k = Math.round((j / (nose - 1)) * half);
    L.push(' '.repeat(half - k) + (k === 0 ? '^' : '/' + '█'.repeat(2 * k - 1) + '\\') + ' '.repeat(half - k));
  }
  const body = Math.max(3, h - nose - 1), split = nose + Math.round(body * 0.38);
  for (let j = 0; j < body; j++) {
    const r = nose + j, fill = r === split ? '=' : (r - nose) % 5 === 2 && w > 4 ? '▒' : '█';
    let row = '|' + fill.repeat(w - 2) + '|';
    if (j >= body - 2) row = row.slice(0, 1) + row.slice(1, -1) + row.slice(-1);
    L.push(row);
  }
  L.push(' ' + 'V'.repeat(w - 2) + ' ');
  return { lines: L, split, w, fins: body };
}
A({ id: 'sp-launch', name: '火箭發射', cat: '太空', theme: 'amber', hue: true, desc: '倒數、點火、升空、節分離一氣呵成',
  params: { mode: 'launch', night: 0 },
  variants: [
    { id: 'night', name: '夜間發射', desc: '遠眺海岸夜射，火光映亮雲層與海面', theme: 'fire', params: { mode: 'coast' } },
    { id: 'landing', name: '垂直回收', desc: '助推器點火減速，穩穩降落在海上平台', params: { mode: 'landing' } },
    { id: 'far', name: '遠眺升空', desc: '暮色中劃出長長的弧形尾跡', params: { mode: 'far' } },
    { id: 'stages', name: '軌道分離', desc: '太空中逐節分離，衛星展開太陽板', params: { mode: 'stages' } },
    { id: 'lander', name: '月面降落', desc: '登月艇揚起塵土著陸後再起飛', params: { mode: 'lander' } },
    { id: 'reentry', name: '返回艙', desc: '燃燒著穿越大氣，開傘落入海中', params: { mode: 'reentry' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows } = f;
    s.key = null; s.T = 0; s.P = [];
    s.stars = mkStars(Math.max(30, (cols * rows / 40) | 0));
    s.D = new Float32Array(cols * rows);
    s.land = new Float32Array(cols);
    for (let x = 0; x < cols; x++) s.land[x] = nz((x / cols) * 40, 7);
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.6);
    s.Pf = pal(f, h, [[120, 20, 0], [255, 110, 20], [255, 210, 90], [255, 255, 230]], 0.35, 1);
    s.Pk = pal(f, h, [[40, 40, 46], [120, 120, 130], [210, 210, 215], [250, 250, 250]], 0.1, 0.75);
    s.Pg = pal(f, h, [[10, 14, 12], [40, 50, 44], [90, 100, 90]], 0.04, 0.3);
    s.Pt = pal(f, h, [[200, 200, 210], [255, 255, 255]], 0.5, 0.95);
    s.Pw = pal(f, h, [[6, 20, 50], [30, 70, 130], [120, 180, 230]], 0.05, 0.45);
    s.Pm = pal(f, h, [[60, 60, 64], [150, 150, 156], [220, 220, 224]], 0.08, 0.8);
    s.PCc = mixPal(f, h, [80, 90, 120], [255, 150, 70], 8, 0.2, 1.15, 0.04, 0.85);
  },
  // 粒子：k 0 火焰 1 煙 2 塵 3 火花 4 長尾跡
  puff(s, x, y, vx, vy, life, k) { if (s.P.length < 4000) s.P.push({ x, y, vx, vy, life, max: life, k }); },
  stepP(s, f, camY, G, wind) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, dt = Math.min(f.dt, 0.06), D = s.D;
    D.fill(0);
    // 火焰格子放在重複使用的陣列裡：fI 格子索引、fA 剩餘壽命比例、fK 種類；回傳數量
    if (!s.fI) { s.fI = new Int32Array(4096); s.fA = new Float32Array(4096); s.fK = new Uint8Array(4096); }
    let nf = 0;
    for (let k = s.P.length - 1; k >= 0; k--) {
      const q = s.P[k];
      q.life -= dt;
      if (q.life <= 0) { kill(s.P, k); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.k === 1 || q.k === 4) { q.vx = q.vx * (1 - dt * 0.8) + wind * dt; q.vy *= 1 - dt * 0.9; if (q.k === 1) q.vy += dt * 0.6; }
      if (q.k === 2) { q.vy -= dt * 2; q.vx *= 1 - dt * 0.6; }
      if (q.k === 3) q.vy -= dt * 8;
      if (q.y < 0 && q.k !== 4) { q.y = 0; q.vy = Math.abs(q.vy) * 0.2; q.vx *= 1.05; }
      const sx = q.x, sy = G - (q.y - camY);
      if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) continue;
      const i = (sy | 0) * cols + (sx | 0), a = q.life / q.max;
      if (q.k === 1 || q.k === 4 || q.k === 2) {
        const r = q.k === 2 ? 0 : (1 - a) * (q.k === 4 ? 3 : 2.2);
        const v = q.k === 2 ? 0.5 * a : 0.45 * Math.min(1, a * 2.5);
        D[i] += v;
        if (r > 0.8) { if (sx >= 1) D[i - 1] += v * 0.5; if (sx < cols - 1) D[i + 1] += v * 0.5; if (sy >= 1) D[i - cols] += v * 0.35; if (sy < rows - 1) D[i + cols] += v * 0.35; }
        if (r > 1.8) { if (sx >= 2) D[i - 2] += v * 0.3; if (sx < cols - 2) D[i + 2] += v * 0.3; }
      } else if (nf < 4096) { s.fI[nf] = i; s.fA[nf] = a; s.fK[nf] = q.k; nf++; }
    }
    return nf;
  },
  drawSmoke(s, f, glowX, glowY, glow, lit) {
    const { g, cols, rows } = f, ch = g.ch, co = g.co, D = s.D, n = cols * rows;
    for (let i = 0; i < n; i++) {
      const d = D[i];
      if (d < 0.08) continue;
      const v = 1 - Math.exp(-d * 1.4);
      let c = pc(s.Pk, v * (lit || 1));
      if (glow > 0) {
        const x = i % cols, y = (i / cols) | 0, dd = Math.hypot(x - glowX, (y - glowY) * 2.1);
        const gl = glow * Math.max(0, 1 - dd / (cols * 0.25));
        if (gl > 0.08) c = pc(s.Pf, 0.2 + gl * 0.6 * v + 0.2 * v);
      }
      // 落在地面／平台（█）上的煙：把顏色混進色塊，不要變成露出天空底色的字
      if (ch[i] === '█') { co[i] = mixHex(co[i], c, Math.min(1, 0.2 + v)); continue; }
      ch[i] = v > 0.85 ? '@' : v > 0.7 ? '%' : v > 0.55 ? '#' : v > 0.4 ? 'O' : v > 0.28 ? 'o' : v > 0.16 ? ':' : '.';
      co[i] = c;
    }
  },
  drawFlames(s, f, nf) {
    const { g } = f, ch = g.ch, co = g.co;
    for (let j = 0; j < nf; j++) {
      const i = s.fI[j], a = s.fA[j], k = s.fK[j], c = pc(s.Pf, k === 3 ? a : 0.3 + a * 0.7);
      if (ch[i] === '█') { co[i] = addHex(co[i], c, 0.4 + 0.5 * a); continue; }
      ch[i] = k === 3 ? '*' : a > 0.75 ? '@' : a > 0.5 ? '#' : a > 0.3 ? '*' : a > 0.15 ? '+' : ':'; co[i] = c;
    }
  },
  sky(f, s, alt, night) {
    if (!s.hue) return;
    const k = clamp(alt, 0, 1);
    f.bg = night ? rgb(3, 4, 12) : rgb(lerp(70, 2, k), lerp(120, 3, k), lerp(200, 12, k));
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode, dt = Math.min(f.dt, 0.06);
    s.T += dt;
    if (m === 'launch') this.fLaunch(s, f, dt);
    else if (m === 'landing') this.fLanding(s, f, dt);
    else if (m === 'far') this.fFar(s, f, dt);
    else if (m === 'coast') this.fCoast(s, f, dt);
    else if (m === 'stages') this.fStages(s, f, dt);
    else if (m === 'lander') this.fLander(s, f, dt);
    else this.fReentry(s, f, dt);
    void ch; void co; void hue; void t; void aspect;
  },
  fLaunch(s, f, dt) {
    const { g, cols, rows, aspect, p } = f, ch = g.ch, co = g.co, hue = s.hue, night = p.night;
    const CY = 41, T = s.T % CY;
    if (T < s.lastT) { s.P = []; }
    s.lastT = T;
    const H = Math.max(9, Math.round(rows * 0.42)), W = Math.max(3, Math.round(cols * 0.028) | 1), art = rocketArt(W, H);
    const G = rows * (night ? 0.8 : 0.86), rx = cols * 0.5;
    const tIgn = 6, tLift = 8;
    const alt = T < tLift ? 0 : 0.5 * 4.5 * (T - tLift) ** 2 + (T - tLift) * 1.5;
    const camY = Math.max(0, alt - rows * 0.3);
    const tSep = 24, sepAlt = 0.5 * 4.5 * (tSep - tLift) ** 2 + (tSep - tLift) * 1.5;
    this.sky(f, s, camY / (rows * 6), night);
    if (camY > rows * 1.5 || night) drawStars(f, s.stars, s.Ps, 0, camY * 0.2, night ? 0.8 : clamp((camY - rows * 1.5) / (rows * 3), 0, 1));
    // 地面、發射塔
    const gy = G + camY;
    if (gy < rows + 2) {
      for (let x = 0; x < cols; x++) { const top = Math.floor(gy - s.land[x] * 1.5); for (let y = Math.max(0, top); y < rows; y++) { const i = y * cols + x; ch[i] = '█'; co[i] = pc(s.Pg, night ? 0.25 : 0.55); } }
      if (night) for (let x = 0; x < cols; x++) for (let y = Math.max(0, Math.floor(gy + 2)); y < rows; y++) { const i = y * cols + x; ch[i] = (x + y * 3 + Math.floor(s.T * 3)) % 7 ? '~' : '-'; co[i] = pc(s.Pw, 0.3); }
      const tx = rx + W + 2, th = H + 3;
      for (let k = 0; k < th; k++) { const y = gy - 1 - k; g.set(tx, y, '#', pc(s.Pk, 0.5)); g.set(tx + 2, y, '#', pc(s.Pk, 0.5)); g.set(tx + 1, y, k % 2 ? 'X' : '-', pc(s.Pk, 0.35)); }
      if (T < tLift) for (let k = 2; k < th; k += 4) g.set(tx - 1, gy - 1 - k, '=', pc(s.Pk, 0.45));
      if (night) for (let k = 0; k < 3; k++) g.set(tx + 1, gy - th - 1, Math.sin(s.T * 2 + k) > 0 ? '*' : '+', pc(s.Pf, 0.9));
    }
    // 噴流粒子
    const rocketBot = alt;
    if (T > tIgn - 0.3 && T < tSep) {
      const thr = T < tIgn ? 0.3 : 1;
      const nf = Math.round(14 * thr * Math.max(0.5, cols / 200));
      for (let k = 0; k < nf; k++) this.puff(s, rx + gauss() * W * 0.3, rocketBot + 0.6 - rnd(0, 1.5), gauss() * 3, -rnd(18, 40), rnd(0.15, 0.4), 0);
      const ns = Math.round((alt < 6 ? 10 : 3) * Math.max(0.5, cols / 200));
      for (let k = 0; k < ns; k++) {
        if (alt < 4) { const sg = Math.random() < 0.5 ? -1 : 1; this.puff(s, rx + gauss(), Math.max(0, rocketBot - 1), sg * rnd(6, 26) * (cols / 200 + 0.5), rnd(0, 2), rnd(3, 7), 1); }
        else this.puff(s, rx + gauss() * 0.8, rocketBot - 2, gauss() * 1.5, -rnd(2, 5), rnd(2.5, 5), 1);
      }
    }
    if (T < tIgn && T > 1) if (Math.random() < 0.4) this.puff(s, rx + (Math.random() < 0.5 ? -W : W) * 0.6, H * 0.5, gauss() * 2, rnd(0, 1), rnd(1, 2), 1);
    let upAlt = alt, upOn = false;
    if (T > tSep) {
      const ts = T - tSep;
      upAlt = sepAlt + (alt - sepAlt) + ts * ts * 1.5;
      upOn = ts > 1.2;
      if (upOn) for (let k = 0; k < 6; k++) this.puff(s, rx + gauss() * 0.4, upAlt + (art.lines.length - art.split - 1) - rnd(0, 1), gauss() * 2, -rnd(15, 30), rnd(0.12, 0.3), 0);
    }
    const fl = this.stepP(s, f, camY, G, 2.5);
    this.drawSmoke(s, f, rx, G - (rocketBot - camY), T > tIgn && T < tSep ? (night ? 1 : 0.5) : 0, night ? 0.6 : 1);
    this.drawFlames(s, f, fl);
    // 火箭本體
    const col = hue ? rgb(235, 235, 240) : f.C(0.85), col2 = hue ? rgb(200, 60, 40) : f.C(0.6);
    const drawPart = (lines, x0, yb, from, to) => {
      for (let r = from; r < to; r++) {
        const y = yb - (to - 1 - r) - 1;
        if (y < 0 || y >= rows) continue;
        const L = lines[r];
        for (let k = 0; k < L.length; k++) if (L[k] !== ' ') g.set(x0 + k, y, L[k], L[k] === '=' || L[k] === '▒' ? col2 : col);
      }
      if (to === lines.length) { g.set(x0 - 1, yb - 2, '/', col); g.set(x0 + art.w, yb - 2, '\\', col); }
    };
    const x0 = Math.round(rx - (art.w - 1) / 2);
    if (T <= tSep) drawPart(art.lines, x0, G - (alt - camY), 0, art.lines.length);
    else {
      const ts = T - tSep, lowAlt = sepAlt + (alt - sepAlt) * 0 + (T - tSep) * 18 - ts * ts * 6;
      const upB = G - (upAlt + (art.lines.length - art.split) - camY);
      drawPart(art.lines, x0, upB, 0, art.split + 1);
      drawPart(art.lines, x0 + Math.round(ts * 1.2), G - (lowAlt - camY), art.split + 1, art.lines.length);
    }
    // 倒數
    if (T < tLift + 1 && cols >= 60) {
      const n = Math.ceil(tIgn - T), s2 = T < tIgn ? 'T-' + n : tr(f, '升空', 'Liftoff');
      ctext(g, cols / 2, Math.max(1, rows * 0.1), s2, pc(s.Pt, 0.9));
    }
    if (T > tSep - 0.5 && T < tSep + 3 && cols >= 100) ctext(g, cols / 2, 2, tr(f, '一二節分離', 'Stage separation'), pc(s.Pt, 0.8));
    if (T > CY - 3) { const k = (CY - T) / 3; for (let i = 0; i < ch.length; i++) if (ch[i] !== ' ' && hash2(i, 77) > k) ch[i] = ' '; }
  },
  fLanding(s, f, dt) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, hue = s.hue;
    const CY = 30, T = s.T % CY;
    if (T < (s.lastT || 0)) s.P = [];
    s.lastT = T;
    if (hue) f.bg = rgb(40, 70, 120);
    const H = Math.max(8, Math.round(rows * 0.36)), W = Math.max(3, Math.round(cols * 0.024) | 1), art = rocketArt(W, H);
    const sea = rows * 0.82, rx = cols * 0.5, land = 16;
    const u = clamp(T / land, 0, 1), alt = T < land ? (1 - u) * (1 - u) * (rows * 1.1) : 0;
    // 海
    for (let y = Math.floor(sea); y < rows; y++) for (let x = 0; x < cols; x++) { const i = y * cols + x, w = Math.sin(x * 0.3 + s.T * 2 + y) + Math.sin(x * 0.11 - s.T); ch[i] = w > 1 ? '~' : w > 0 ? '-' : '.'; co[i] = pc(s.Pw, 0.3 + 0.15 * w); }
    // 平台
    const bw = Math.max(8, Math.round(cols * 0.12));
    for (let x = -bw; x <= bw; x++) { g.set(rx + x, sea - 1, '▄', hue ? rgb(60, 60, 70) : f.C(0.35)); g.set(rx + x, sea, '█', hue ? rgb(40, 40, 46) : f.C(0.25)); }
    // 平台上的降落標記：亮色 █，不用字元（字元格會露出天空底色）
    if (cols >= 80) for (let k = -1; k <= 1; k++) g.set(rx + k, sea, '█', hue ? rgb(170, 170, 160) : f.C(0.6));
    const burn = T > 4 && T < land + 0.4;
    if (burn) {
      const nf = Math.round(10 * Math.max(0.5, cols / 200));
      for (let k = 0; k < nf; k++) this.puff(s, rx + gauss() * 0.6, alt + (rows - sea) * 0 - 0.5, gauss() * 4, -rnd(15, 30), rnd(0.1, 0.3), 0);
      if (alt < 8) for (let k = 0; k < 6; k++) { const sg = Math.random() < 0.5 ? -1 : 1; this.puff(s, rx + gauss(), 0.5, sg * rnd(8, 30), rnd(0, 2), rnd(2, 4), 1); }
    }
    const fl = this.stepP(s, f, 0, sea - 1, 1.5);
    this.drawSmoke(s, f, rx, sea, burn ? 0.4 : 0, 1);
    this.drawFlames(s, f, fl);
    // 助推器（只有一節，加上著陸腳）
    const col = hue ? rgb(235, 235, 240) : f.C(0.85), lines = art.lines.slice(art.split + 1);
    const yb = sea - 1 - alt, x0 = Math.round(rx - (art.w - 1) / 2);
    for (let r = 0; r < lines.length; r++) { const y = yb - (lines.length - r); for (let k = 0; k < lines[r].length; k++) if (lines[r][k] !== ' ') g.set(x0 + k, y, lines[r][k], col); }
    txt(g, x0, yb - lines.length - 1, '‾'.repeat(art.w), col);
    const legs = clamp((T - (land - 5)) / 2, 0, 1);
    if (legs > 0) { const L = Math.round(1 + legs * art.w * 0.8); g.line(x0, yb - 2, x0 - L, yb - 0.5, '/', col); g.line(x0 + art.w - 1, yb - 2, x0 + art.w - 1 + L, yb - 0.5, '\\', col); }
    if (T > land && cols >= 80) ctext(g, cols / 2, 2, tr(f, '著陸成功', 'Landing successful'), pc(s.Pt, 0.9));
  },
  fFar(s, f, dt) {
    const { g, cols, rows } = f, ch = g.ch, co = g.co, hue = s.hue, n = cols * rows;
    const CY = 40, T = s.T % CY;
    if (T < (s.lastT || 0)) s.P = [];
    s.lastT = T;
    if (hue) f.bg = rgb(8, 12, 34);
    const hz = rows * 0.74, by0 = Math.floor(rows * 0.38), hzI = Math.floor(hz);
    // 暮光漸層（█ 色塊）。尾跡、火焰進到這幾列時把顏色混進色塊裡，不會變成一條黑帶
    if (!s.tm || s.tm.length !== n) { s.tm = new Uint8Array(n); s.bandC = new Array(rows).fill(null); }
    const TM = s.tm, BC = s.bandC;
    TM.fill(0); BC.fill(null);
    for (let y = by0; y < hz && y < rows; y++) {
      const h = (hz - y) / (hz - rows * 0.38), c = hue ? rgb(lerp(230, 10, Math.pow(h, 0.6)), lerp(110, 14, Math.pow(h, 0.7)), lerp(70, 40, h)) : f.C((1 - h) * 0.35);
      BC[y] = c;
      for (let x = 0, i = y * cols; x < cols; x++, i++) { ch[i] = '█'; co[i] = c; }
    }
    drawStars(f, s.stars, s.Ps, 0, 0, 0.7);
    // 火箭沿重力轉向的弧線飛行
    const u = clamp(T / 30, 0, 1);
    const px = cols * (0.18 + 0.75 * u * u), py = hz - 1 - (rows * 0.95) * Math.sin(u * 1.25) * (1 - u * 0.25);
    if (T < 30) {
      const sunlit = py < rows * 0.35;
      for (let k = 0; k < 4; k++) this.puff(s, px, hz - py, gauss() * (sunlit ? 1.5 : 0.4), gauss() * (sunlit ? 0.8 : 0.2), rnd(12, 22), 4);
      for (let k = 0; k < 3; k++) this.puff(s, px, hz - py, gauss() * 4, -rnd(3, 8), rnd(0.1, 0.3), 0);
    }
    const nf = this.stepP(s, f, 0, hz, 0.4);
    const D = s.D;
    for (let i = 0; i < n; i++) {
      const d = D[i];
      if (d < 0.06) continue;
      const y = (i / cols) | 0, lit = clamp((rows * 0.45 - y) / (rows * 0.25), 0, 1), v = 1 - Math.exp(-d * 1.2);
      const c = hue ? rgb(lerp(160, 150, lit) * (0.4 + v), lerp(150, 220, lit) * (0.4 + v), lerp(150, 255, lit) * (0.4 + v)) : f.C(0.2 + v * 0.6);
      TM[i] = 1;
      if (BC[y] && ch[i] === '█') { co[i] = mixHex(BC[y], c, Math.min(1, 0.25 + v * 0.9)); continue; }
      ch[i] = v > 0.6 ? '%' : v > 0.4 ? '*' : v > 0.22 ? ':' : '.';
      co[i] = c;
    }
    // 火焰：色塊裡改成更亮的 █
    for (let j = 0; j < nf; j++) {
      const i = s.fI[j], a = s.fA[j], y = (i / cols) | 0, c = pc(s.Pf, 0.3 + a * 0.7);
      TM[i] = 1;
      if (BC[y] && ch[i] === '█') { co[i] = addHex(co[i], c, 0.5 + 0.5 * a); continue; }
      ch[i] = a > 0.75 ? '@' : a > 0.5 ? '#' : a > 0.3 ? '*' : a > 0.15 ? '+' : ':'; co[i] = c;
    }
    if (T < 30 && px >= 0 && py >= 0 && px < cols && py < rows) {
      const i = (py | 0) * cols + (px | 0);
      TM[i] = 1;
      if (BC[py | 0] && ch[i] === '█') co[i] = pc(s.Pf, 1); else { ch[i] = '*'; co[i] = pc(s.Pf, 1); }
    }
    // 海面與倒影（倒影看的是尾跡記號，不是字元，色塊裡的尾跡也照得出來）
    for (let y = hzI; y < rows; y++) {
      const dy = y - hz;
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x, sy = Math.floor(hz - 1 - dy * 1.6), sx = x + Math.round(Math.sin(y * 1.7 + s.T * 2) * (1 + dy * 0.3));
        ch[i] = ' ';
        if (sy >= 0 && sy < hzI && sx >= 0 && sx < cols) {
          const j = sy * cols + sx;
          if (TM[j] || (ch[j] !== ' ' && ch[j] !== '█')) { ch[i] = '~'; co[i] = TM[j] ? mixHex(co[j], hue ? rgb(20, 40, 90) : f.C(0.1), 0.45) : pc(s.Pw, 0.45); continue; }
          if (ch[j] === '█' && dy < 3) { ch[i] = '-'; co[i] = hue ? rgb(120, 60, 50) : f.C(0.15); continue; }
        }
        if (hash2(x, y + Math.floor(s.T * 3)) < 0.05) { ch[i] = '-'; co[i] = pc(s.Pw, 0.2); }
      }
    }
    const lc = hue ? rgb(5, 6, 12) : f.C(0.02);
    for (let x = 0; x < cols * 0.25; x++) { const h = Math.floor(hz - 1 - s.land[x] * 2 - (x < cols * 0.18 ? 1 : 0)); for (let y = h; y < hz; y++) g.set(x, y, '█', lc); }
    // 發射塔：細細的剪影
    for (let k = 2; k <= 4; k++) g.set(cols * 0.18, hz - k, '█', hue ? rgb(26, 26, 34) : f.C(0.06));
  },
  // 夜間發射：從遠方海岸看，火光把低雲由下往上照亮，穿雲後在雲層留下一個洞
  fCoast(s, f, dt) {
    const { g, cols, rows, aspect, t } = f, ch = g.ch, co = g.co, hue = s.hue, n = cols * rows;
    const CY = 30, T = s.T % CY;
    if (T < (s.lastT || 0)) { s.P = []; s.passT = -1; }
    s.lastT = T;
    const hz = rows * 0.66, hzI = Math.floor(hz), rx = cols * 0.42, G = hz - 1;
    const tIgn = 5, tLift = 6.5, tau = Math.max(0, T - tLift);
    const alt = T < tLift ? 0 : rows * (0.0055 * tau * tau + 0.01 * tau);
    const lean = Math.pow(alt / rows, 2) * cols * 0.05, rxx = rx + lean, ry = G - alt;
    const burn = T < tIgn ? 0 : clamp((T - tIgn) / 0.8, 0, 1) * (T < tLift ? 0.6 : 1);
    // 雲層：底在 cb(x)，頂在 ct
    const ct = rows * 0.04, cbm = rows * 0.36;
    if (s.passT === undefined) s.passT = -1;
    if (s.passT < 0 && ry < cbm) { s.passT = T; s.holeX = rxx; }
    // 火光強度：離雲越遠越弱；飛出雲頂後慢慢淡掉
    let Gl = burn;
    if (ry < ct) Gl *= clamp(1 - (ct - ry) / (rows * 0.45), 0, 1);
    const fadeEnd = T > CY - 3 ? (CY - T) / 3 : 1;
    if (hue) { const k = Gl * clamp(1.2 - alt / (rows * 0.8), 0.25, 1); f.bg = rgb(4 + 22 * k, 5 + 10 * k, 14 + 3 * k); }
    // 噴流、蒸汽、尾跡
    if (T > tIgn - 0.3 && ry > -rows * 0.2) {
      const sc = Math.max(0.5, cols / 200);
      for (let k = 0; k < Math.round(6 * sc); k++) this.puff(s, rxx + gauss() * 0.4, alt + 0.3 - rnd(0, 0.8), gauss() * 1.5, -rnd(10, 22), rnd(0.12, 0.3), 0);
      if (alt < 3) { for (let k = 0; k < Math.round(2 * sc); k++) { const sg = Math.random() < 0.5 ? -1 : 1; this.puff(s, rx + gauss(), 0.2, sg * rnd(3, 11) * (cols / 200 + 0.5), rnd(0, 1.2), rnd(3, 6), 1); } }
      else if (T > tLift && Math.random() < 0.7) this.puff(s, rxx + gauss() * 0.3, alt - 1, gauss() * 0.25, gauss() * 0.15, rnd(9, 14), 4);
    }
    const nf = this.stepP(s, f, 0, G, 0.6);
    const D = s.D;
    for (let i = 0; i < n; i++) {
      const d = D[i];
      if (d < 0.07) continue;
      if (fadeEnd < 1 && hash2(i, 77) > fadeEnd) continue;
      const x = i % cols, y = (i / cols) | 0, v = 1 - Math.exp(-d * 1.3);
      const dd = Math.hypot(x - rxx, (y - ry) * aspect) / (cols * 0.22), gl = Gl * Math.max(0, 1 - dd);
      ch[i] = v > 0.75 ? '%' : v > 0.55 ? '#' : v > 0.4 ? 'o' : v > 0.25 ? ':' : '.';
      co[i] = mp(s.PCc, clamp(gl * 1.4, 0, 1), 0.15 + v * 0.5 + gl * 0.3);
    }
    this.drawFlames(s, f, nf);
    // 火箭（很小，被下方火光照亮）
    if (T >= tLift - 1 && ry > -2) {
      // 遠景：小畫面只有一格寬，大畫面才畫出三格寬的箭身
      const L = s.cArt || (s.cArt = rows < 50 ? ['^', '█', '█'] : rocketArt(3, Math.max(4, Math.round(rows * 0.06))).lines), rcol = hue ? rgb(230, 200, 170) : f.C(0.8), ox = (L[0].length - 1) >> 1;
      for (let r = 0; r < L.length; r++) { const y = Math.round(ry) - (L.length - r); for (let k = 0; k < L[r].length; k++) if (L[r][k] !== ' ') g.set(rxx - ox + k, y, L[r][k], rcol); }
    }
    // 雲：蓋在尾跡與火箭前面；被火光由下照亮，火箭穿過之後留下逐漸擴大的洞
    const kx = 90 / cols, ky = 25 / Math.max(4, rows * 0.32), PC = s.PCc;
    const hole = s.passT >= 0, hw = hole ? 1 + (T - s.passT) * cols * 0.006 : 0, hx = s.holeX || rxx, hk = 0.92 * clamp((CY - T) / 4, 0, 1);
    for (let y = 0; y < Math.ceil(cbm + rows * 0.05); y++) {
      for (let x = 0; x < cols; x++) {
        const cb = cbm + rows * 0.035 * (nz(x * 0.07, 3) - 0.5) * 2;
        if (y > cb + 1) continue;
        const env = smooth((cb - y) / (rows * 0.06)) * smooth((y - ct + rows * 0.02) / (rows * 0.1));
        if (env < 0.05) continue;
        let dn = smooth((nz(x * kx + t * 0.35, y * ky + 11) * 0.7 + nz(x * kx * 2.7 - t * 0.2, y * ky * 2 + 40) * 0.3 - 0.36) / 0.24) * env;
        if (hole && y > ry) dn *= 1 - hk * Math.exp(-(((x - hx) / hw) ** 2));
        if (dn < 0.08) continue;
        const i = y * cols + x;
        if (dn < 0.45 && ch[i] !== ' ') continue;
        // 照明：靠近火箭（尤其在雲裡）很亮；雲底整片被下方火光照到
        const dist = Math.hypot((x - rxx) / aspect, y - ry);
        let L = Gl * (Math.exp(-dist / (rows * 0.1)) * 1.3 + Math.exp(-dist / (rows * 0.45)) * 0.55);
        L *= 0.55 + 0.45 * smooth((y - (cb - rows * 0.12)) / (rows * 0.12));
        const b = dn * (0.14 + 0.95 * L);
        ch[i] = R10[Math.max(1, Math.min(9, (b * 9.5 + 0.5) | 0))];
        co[i] = mp(PC, clamp(L * 1.6, 0, 1), 0.12 + b * 0.85);
      }
    }
    drawStars(f, s.stars, s.Ps, 0, 0, 0.6);
    // 遠方海岸與發射台
    const lc = hue ? rgb(6, 7, 13) : f.C(0.03);
    for (let x = 0; x < cols; x++) {
      const u = x / cols, h = rows * (0.012 + 0.03 * nz(x * 0.06, 8) + (u < 0.22 ? 0.07 * Math.sin((u / 0.22) * Math.PI * 0.5 + 0.3) : 0));
      for (let y = Math.max(0, Math.floor(hz - h)); y < hzI; y++) { const i = y * cols + x; ch[i] = '█'; co[i] = lc; }
    }
    const tH = Math.max(3, Math.round(rows * 0.09)), tx = Math.round(rx + 3);
    for (let k = 1; k <= tH; k++) g.set(tx, G - k + 1, '█', hue ? rgb(22, 22, 30) : f.C(0.05));
    const blink = Math.sin(t * 3) > 0.3;
    g.set(tx, G - tH, blink ? '*' : '·', hue ? rgb(255, 60, 50) : f.C(blink ? 0.9 : 0.4));
    g.set(rx - 6, G, '·', hue ? rgb(255, 230, 180) : f.C(0.7)); g.set(rx + 9, G, '·', hue ? rgb(255, 230, 180) : f.C(0.7));
    // 海面：倒影＋火光在水面拉出的光柱
    const pw = Gl * clamp(1.3 - alt / (rows * 0.7), 0.15, 1);
    for (let y = hzI; y < rows; y++) {
      const dy = y - hz, depth = dy / (rows - hz);
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x, sy = Math.floor(hz - 1 - dy * 1.25), sx = x + Math.round(Math.sin(y * 1.9 + t * 1.7 + x * 0.06) * (0.8 + dy * 0.3));
        ch[i] = ' ';
        if (sy >= 0 && sy < hzI && sx >= 0 && sx < cols) {
          const j = sy * cols + sx, c = ch[j];
          if (c !== ' ' && c !== '█' && hash2(x, y * 5 + Math.floor(t * 4)) > 0.3) { ch[i] = '-'; co[i] = mixHex(co[j], hue ? rgb(8, 14, 34) : f.C(0.05), 0.35 + 0.4 * depth); continue; }
        }
        const gx = Math.abs(x + 0.5 - rxx), gw = cols * (0.015 + 0.06 * depth);
        if (pw > 0.05 && gx < gw && hash2(x + Math.floor(t * 5), y) < 0.2 + 0.6 * pw * (1 - gx / gw)) { ch[i] = gx < gw * 0.4 ? '=' : '-'; co[i] = pc(s.Pf, 0.25 + 0.6 * pw * (1 - gx / gw)); continue; }
        if (hash2(x, y + Math.floor(t * 2)) < 0.035) { ch[i] = '~'; co[i] = pc(s.Pw, 0.12 + 0.12 * (1 - depth)); }
      }
    }
    if (cols >= 100) txt(g, 2, rows - 2, T < tIgn ? tr(f, '發射倒數 T-', 'Countdown T-') + Math.ceil(tIgn - T) : T < tLift ? tr(f, '點火', 'Ignition') : ry > cbm ? tr(f, '升空', 'Liftoff') : ry > ct ? tr(f, '穿越雲層', 'Through the clouds') : '', pc(s.Pt, 0.75));
  },
  fStages(s, f, dt) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, hue = s.hue;
    const CY = 36, T = s.T % CY;
    if (T < (s.lastT || 0)) s.P = [];
    s.lastT = T;
    if (hue) f.bg = rgb(1, 2, 8);
    drawStars(f, s.stars, s.Ps, -s.T * cols * 0.03, 0);
    // 地球弧面
    const PR = cols * 1.5, pcy = rows + PR / aspect * 0.9;
    for (let y = Math.floor(rows * 0.6); y < rows; y++) for (let x = 0; x < cols; x++) {
      const dx = (x + 0.5 - cols * 0.5) / PR, dy = ((y + 0.5 - pcy) * aspect) / PR, d2 = dx * dx + dy * dy, i = y * cols + x;
      if (d2 > 1) { if (d2 < 1.003) { ch[i] = '~'; co[i] = hue ? rgb(80, 160, 255) : f.C(0.4); } continue; }
      const k = earthCol((dx * 6 + s.T * 0.01) % TAU, clamp(Math.asin(-dy) * 4 - 1.2, -1.5, 1.5), s.T);
      const l = clamp(0.35 + dx * 0.4, 0, 1) * k;
      ch[i] = R10[Math.max(1, Math.min(9, (l * 9) | 0))]; co[i] = hue ? shade(ECOL, 0.12 + 0.8 * l) : f.C(0.05 + 0.7 * l);
    }
    const cx = cols * 0.42, cy = rows * 0.36, Ls = Math.max(12, Math.round(cols * 0.16)), Hh = Math.max(1, Math.round(rows * 0.035));
    const col = hue ? rgb(230, 232, 238) : f.C(0.85), col2 = hue ? rgb(190, 60, 40) : f.C(0.55);
    const hbar = (x0, y, len, c, ch2) => { for (let k = 0; k < len; k++) g.set(x0 + k, y, ch2 || '█', c); };
    const t1 = 8, t2 = 16, t3 = 22;
    // 一節
    const d1 = T > t1 ? (T - t1) * cols * 0.025 : 0, s1x = cx - Ls * 0.55 - d1, s1y = cy + (T > t1 ? (T - t1) * 0.25 : 0);
    for (let r = -Hh; r <= Hh; r++) hbar(s1x, s1y + r, Math.round(Ls * 0.55), r === 0 ? col2 : col);
    if (T < t1) for (let k = 0; k < 6; k++) this.puff(s, s1x - 1, rows - s1y + gauss() * 0.4, -rnd(25, 45), gauss() * 1.5, rnd(0.1, 0.35), 0);
    // 二節＋整流罩
    const s2x = cx;
    for (let r = -Hh; r <= Hh; r++) hbar(s2x, cy + r, Math.round(Ls * 0.35), col);
    if (T > t1 + 1.5) for (let k = 0; k < 5; k++) this.puff(s, s2x - 1, rows - cy + gauss() * 0.3, -rnd(20, 35), gauss(), rnd(0.1, 0.3), 0);
    const fx = s2x + Math.round(Ls * 0.35);
    if (T < t2) { for (let r = -Hh; r <= Hh; r++) { const w = Math.round((Hh - Math.abs(r) + 1) * 2.2); hbar(fx, cy + r, w, col, '▓'); } }
    else {
      const d = (T - t2) * 1.2;
      for (let r = 0; r <= Hh; r++) { const w = Math.round((Hh - r + 1) * 2.2); hbar(fx + d * 0.5, cy - r - d / aspect, w, col, '▓'); hbar(fx + d * 0.5, cy + r + d / aspect, w, col, '▓'); }
      // 酬載：衛星展開太陽板
      const open = clamp((T - t3) / 3, 0, 1), px = fx + 2 + (T > t3 ? (T - t3) * 1.5 : 0);
      txt(g, px, cy, '[■]', hue ? rgb(255, 210, 120) : f.C(0.95));
      const pw = Math.round(open * Ls * 0.3);
      for (let k = 1; k <= pw; k++) { g.set(px - k, cy, '▦', hue ? rgb(60, 90, 200) : f.C(0.5)); g.set(px + 2 + k, cy, '▦', hue ? rgb(60, 90, 200) : f.C(0.5)); }
    }
    const fl = this.stepP(s, f, 0, rows, 0);
    this.drawFlames(s, f, fl);
    if (cols >= 100) { const L2 = T < t1 ? tr(f, '一節燃燒', 'First stage burn') : T < t2 ? tr(f, '一二節分離', 'Stage separation') : T < t3 ? tr(f, '整流罩分離', 'Fairing separation') : tr(f, '衛星部署', 'Satellite deployed'); txt(g, 2, rows - 2, L2, pc(s.Pt, 0.8)); }
  },
  fLander(s, f, dt) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, hue = s.hue;
    const CY = 34, T = s.T % CY;
    if (T < (s.lastT || 0)) s.P = [];
    s.lastT = T;
    if (hue) f.bg = rgb(0, 0, 0);
    drawStars(f, s.stars, s.Ps);
    ball(f, hue, cols * 0.8, rows * 0.2, Math.max(2, rows * aspect * 0.07), -0.9, 0, 0.3, [70, 130, 230], 0.04);
    const G = rows * 0.8, rx = cols * 0.45;
    // 月面
    for (let x = 0; x < cols; x++) {
      const top = Math.floor(G - s.land[x] * 2.5 + 1);
      // 月面：上緣用下半格方塊接住天空；零星的暗色小坑也用 █（深色），不露出底色
      for (let y = Math.max(0, top); y < rows; y++) { const i = y * cols + x, n2 = nz(x * 0.6, y * 2), hh = hash2(x, y); ch[i] = y === top ? '▄' : '█'; co[i] = pc(s.Pm, hh < 0.05 && y > top ? 0.06 : 0.22 + 0.25 * n2 - (y - top) * 0.01); }
    }
    const down = 13, ascent = 20;
    let alt = T < down ? Math.pow(1 - T / down, 2) * rows * 0.9 : 0, upAlt = T > ascent ? 0.5 * 2.5 * (T - ascent) ** 2 : 0;
    const col = hue ? rgb(220, 200, 120) : f.C(0.8), col2 = hue ? rgb(200, 200, 205) : f.C(0.7);
    const base = G - alt;
    if (T < down + 0.3 && T > 1) {
      for (let k = 0; k < 6; k++) this.puff(s, rx + gauss() * 0.6, G - base + 1, gauss() * 3, -rnd(8, 18), rnd(0.1, 0.25), 0);
      if (alt < 10) for (let k = 0; k < 8; k++) { const sg = Math.random() < 0.5 ? -1 : 1; this.puff(s, rx + sg * rnd(0, 2), 0.2, sg * rnd(10, 40), rnd(1, 4), rnd(0.8, 2), 2); }
    }
    if (T > ascent) for (let k = 0; k < 5; k++) this.puff(s, rx + gauss() * 0.5, upAlt + 2.5, gauss() * 2, -rnd(8, 16), rnd(0.1, 0.25), 0);
    const fl = this.stepP(s, f, 0, G, 0);
    const D = s.D, n = cols * rows;
    for (let i = 0; i < n; i++) { const d = D[i]; if (d < 0.06) continue; const c = pc(s.Pm, 0.4 + Math.min(0.5, d)); if (ch[i] === '█') { co[i] = mixHex(co[i], c, Math.min(0.8, 0.2 + d)); continue; } ch[i] = d > 0.4 ? ':' : '.'; co[i] = c; }
    this.drawFlames(s, f, fl);
    // 登月艇：上升段＋下降段
    const top2 = ['  _|_  ', ' [___] '], bot = [' /|_|\\ ', '/  |  \\'];
    const x0 = Math.round(rx - 3);
    g.sprite(x0, Math.round(base - 2), bot, col2);
    g.sprite(x0, Math.round(base - 4 - (upAlt)), top2, col);
    if (T > down && T < ascent && cols >= 80) ctext(g, cols / 2, 2, tr(f, '著陸完成', 'Touchdown'), pc(s.Pt, 0.8));
  },
  fReentry(s, f, dt) {
    const { g, cols, rows, aspect } = f, ch = g.ch, co = g.co, hue = s.hue;
    const CY = 36, T = s.T % CY;
    if (T < (s.lastT || 0)) s.P = [];
    s.lastT = T;
    const sea = rows * 0.84;
    const k1 = clamp(T / 10, 0, 1);
    if (hue) f.bg = rgb(lerp(3, 60, k1), lerp(4, 100, k1), lerp(14, 170, k1));
    if (k1 < 0.6) drawStars(f, s.stars, s.Ps, 0, 0, 1 - k1 / 0.6);
    // 位置：先斜向高速，再開傘緩降
    let x, y;
    if (T < 10) { const u = T / 10; x = cols * (0.1 + 0.45 * u); y = rows * (0.02 + 0.4 * u); }
    else { const u = clamp((T - 10) / 18, 0, 1); x = cols * 0.55 + Math.sin(T * 0.4) * 2; y = rows * 0.42 + (sea - 3 - rows * 0.42) * u; }
    const hot = T < 9 ? Math.sin((T / 9) * Math.PI) : 0;
    if (hot > 0.05) for (let k = 0; k < 10; k++) this.puff(s, x - rnd(0, 2), rows - y + rnd(0, 1.5), -rnd(4, 14) - cols * 0.04, rnd(1, 5), rnd(0.2, 0.6) * (0.4 + hot), 0);
    if (T > 9 && T < 12) for (let k = 0; k < 2; k++) this.puff(s, x - 2, rows - y + 1, -rnd(2, 6), rnd(0, 2), rnd(1, 3), 1);
    for (let yy = Math.floor(sea); yy < rows; yy++) for (let xx = 0; xx < cols; xx++) { const i = yy * cols + xx, w = Math.sin(xx * 0.25 + s.T * 1.5 + yy * 2); ch[i] = w > 0.6 ? '~' : w > -0.2 ? '-' : ' '; co[i] = pc(s.Pw, 0.25 + 0.2 * w); }
    const fl = this.stepP(s, f, 0, rows, 0.5);
    this.drawSmoke(s, f, x, y, 0, 1);
    this.drawFlames(s, f, fl);
    const col = hue ? rgb(210, 210, 215) : f.C(0.8);
    const cap = ['  /\\  ', ' /  \\ ', '/____\\'];
    const cx0 = Math.round(x - 3), cy0 = Math.round(y - 2);
    if (T > 11) {
      // 主傘三頂
      const op = clamp((T - 11) / 1.5, 0, 1), R = Math.max(3, Math.round(cols * 0.035 * op));
      for (let k = -1; k <= 1; k++) {
        const px = x + k * (R * 2 + 1), py = y - Math.max(4, rows * 0.22) * op;
        for (let a = 0; a <= 12; a++) { const th = Math.PI * (a / 12); g.set(px + Math.cos(th) * R, py - (Math.sin(th) * R * 0.9) / aspect * 1.6, a === 0 || a === 12 ? '.' : '‾', hue ? (k === 0 ? rgb(240, 120, 60) : rgb(240, 240, 240)) : f.C(0.8)); }
        g.line(px - R, py, x - 1, cy0, '\\', hue ? rgb(150, 150, 150) : f.C(0.4));
        g.line(px + R, py, x + 1, cy0, '/', hue ? rgb(150, 150, 150) : f.C(0.4));
      }
    }
    g.sprite(cx0, cy0, cap, col);
    if (hot > 0.3) { for (let k = 0; k < 6; k++) g.set(cx0 + k, cy0 + 3, '@', pc(s.Pf, hot)); }
    if (T > 28) { const r = (T - 28) * 4; for (let a = 0; a < 20; a++) { const th = (a / 20) * TAU; g.set(x + Math.cos(th) * r, sea + (Math.sin(th) * r) / aspect * 0.4, '~', pc(s.Pw, 0.6 * (1 - (T - 28) / 8))); } }
    if (cols >= 100) txt(g, 2, rows - 2, T < 9 ? tr(f, '重返大氣', 'Reentry') : T < 11 ? tr(f, '減速傘', 'Drogue chute') : T < 28 ? tr(f, '主傘展開', 'Main chutes deployed') : tr(f, '濺落', 'Splashdown'), pc(s.Pt, 0.8));
  },
});

/* ═════════ 16. 太陽 ═════════ */
// 沃羅諾伊（Worley）場（每兩欄算一次）：E = 到第二近點與最近點的距離差（顆粒邊界為 0），F = 最近距離；cs 為細胞大小（欄寬單位）
function worley(s, f, cs, t, sp, x0, x1, y0, y1) {
  const { cols, rows, aspect } = f, n = cols * rows;
  if (!s.wE || s.wE.length !== n) { s.wE = new Float32Array(n); s.wF = new Float32Array(n); }
  const gw = Math.ceil(cols / cs) + 3, gh = Math.ceil((rows * aspect) / cs) + 3;
  if (!s.wp || s.wp.length !== gw * gh * 2) s.wp = new Float32Array(gw * gh * 2);
  const P = s.wp;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const h1 = hash2(gx, gy), h2 = hash2(gx + 57, gy + 113), k = (gy * gw + gx) * 2;
    P[k] = (gx - 1 + 0.5 + 0.36 * Math.sin(t * sp * (0.6 + h2) + h1 * TAU)) * cs;
    P[k + 1] = (gy - 1 + 0.5 + 0.36 * Math.cos(t * sp * (0.5 + h1) + h2 * TAU)) * cs;
  }
  const E = s.wE, F = s.wF;
  x0 = x0 || 0; x1 = x1 === undefined ? cols : x1; y0 = y0 || 0; y1 = y1 === undefined ? rows : y1;
  for (let y = y0; y < y1; y++) {
    const Y = (y + 0.5) * aspect, gy0 = Math.floor(Y / cs) + 1;
    for (let x = x0; x < x1; x += 2) {
      const X = x + 0.5, gx0 = Math.floor(X / cs) + 1;
      let f1 = 1e9, f2 = 1e9;
      for (let dy = -1; dy <= 1; dy++) {
        const gy = gy0 + dy;
        if (gy < 0 || gy >= gh) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const gx = gx0 + dx;
          if (gx < 0 || gx >= gw) continue;
          const k = (gy * gw + gx) * 2, ex = P[k] - X, ey = P[k + 1] - Y, d = ex * ex + ey * ey;
          if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
        }
      }
      const i = y * cols + x, a = Math.sqrt(f1), b = Math.sqrt(f2);
      E[i] = (b - a) / cs; F[i] = a / cs;
    }
    // 中間那一欄用左右兩欄內插（不是直接複製），顆粒邊緣才不會出現成對的重複字
    for (let x = x0 + 1; x < x1; x += 2) {
      const i = y * cols + x;
      if (x + 1 < x1) { E[i] = (E[i - 1] + E[i + 1]) * 0.5; F[i] = (F[i - 1] + F[i + 1]) * 0.5; }
      else { E[i] = E[i - 1]; F[i] = F[i - 1]; }
    }
  }
}
A({ id: 'sp-sun', name: '太陽', cat: '太空', theme: 'fire', hue: true, desc: '翻騰的日面、黑子與噴發的日珥',
  params: { mode: 'disk' },
  variants: [
    { id: 'limb', name: '日珥', desc: '日面邊緣，電漿沿磁力線拱起流動', params: { mode: 'limb' } },
    { id: 'granule', name: '米粒組織', desc: '對流胞像沸騰的米粒不停翻滾', params: { mode: 'granule' } },
    { id: 'flare', name: '閃焰噴發', desc: '冕環增亮後拋出日冕物質', params: { mode: 'flare' } },
    { id: 'wind', name: '太陽風', desc: '帶電粒子吹向地球磁層與極光', params: { mode: 'wind' } },
    { id: 'giant', name: '紅巨星', desc: '巨大對流胞起伏，外層緩緩脈動', params: { mode: 'giant' } },
    { id: 'spot', name: '黑子特寫', desc: '黑子本影與放射狀半影纖維', params: { mode: 'spot' } },
  ],
  init(s, f) {
    tex();
    const { cols, rows } = f, m = f.p.mode;
    s.key = null; s.T = rnd(0, 20);
    s.stars = mkStars(Math.max(30, (cols * rows / 50) | 0));
    s.spots = [];
    for (let k = 0; k < 6; k++) s.spots.push([rnd(0, TAU), (Math.random() < 0.5 ? -1 : 1) * rnd(0.15, 0.5), rnd(0.03, 0.08)]);
    s.prom = [];
    for (let k = 0; k < 6; k++) s.prom.push([rnd(0, TAU), rnd(0.04, 0.12), rnd(0.05, 0.14)]);
    s.loops = [];
    const nl = m === 'flare' ? 12 : 5;
    for (let k = 0; k < nl; k++) s.loops.push({ x: m === 'flare' ? 0.3 + (k / nl) * 0.4 : rnd(0.1, 0.9), w: m === 'flare' ? 0.06 + k * 0.012 : rnd(0.05, 0.14), h: m === 'flare' ? 0.18 + k * 0.025 : rnd(0.2, 0.5), ph: rnd(0, 1) });
    s.P = []; s.fl = 0; s.cme = -1; s.rings = [];
  },
  pals(s, f) {
    const h = (s.hue = hueOn(f));
    s.key = f.C;
    s.Ps = pal(f, h, STAR_STOPS, 0.08, 0.5);
    s.Psun = pal(f, h, [[60, 8, 0], [190, 50, 0], [255, 140, 20], [255, 215, 110], [255, 250, 225]], 0.15, 1, 64);
    s.Pr = pal(f, h, [[40, 0, 0], [140, 20, 6], [230, 70, 20], [255, 150, 70]], 0.1, 0.9, 48);
    s.Pp = pal(f, h, [[90, 10, 30], [255, 60, 90], [255, 170, 190]], 0.25, 1);
    s.Pc = pal(f, h, [[40, 30, 10], [200, 160, 60], [255, 240, 180]], 0.08, 0.85);
    s.Pw = pal(f, h, [[20, 30, 60], [100, 150, 230], [220, 240, 255]], 0.1, 0.8);
    s.Pa = pal(f, h, [[10, 60, 30], [60, 255, 140], [200, 255, 220]], 0.2, 1);
  },
  frame(s, f) {
    if (s.key !== f.C) this.pals(s, f);
    const { g, cols, rows, aspect, t, p } = f, ch = g.ch, co = g.co, hue = s.hue, m = p.mode, dt = Math.min(f.dt, 0.1);
    s.T += dt;
    const T = s.T;
    if (hue) f.bg = m === 'granule' || m === 'spot' ? rgb(30, 6, 0) : rgb(4, 1, 2);
    const cx = cols / 2, cy = rows / 2;
    const Ps = s.Psun;
    const put = (i, v) => { ch[i] = v > 0.9 ? '@' : v > 0.78 ? '%' : v > 0.66 ? '#' : v > 0.54 ? '*' : v > 0.42 ? '+' : v > 0.3 ? '=' : v > 0.18 ? '-' : v > 0.08 ? ':' : '.'; co[i] = pc(Ps, v); };
    if (m === 'disk') {
      const R = Math.min(rows * 0.46 * aspect, cols * 0.3), rot = T * 0.02;
      const SP = s.spots.map(([lo, la, r]) => { const l2 = lo + rot; return [Math.sin(l2) * Math.cos(la), Math.sin(la), Math.cos(l2) * Math.cos(la), r]; }).filter(q => q[2] > 0);
      for (let y = 0; y < rows; y++) {
        const Y = -(y + 0.5 - cy) * aspect;
        for (let x = 0; x < cols; x++) {
          const X = x + 0.5 - cx, b = Math.sqrt(X * X + Y * Y), i = y * cols + x;
          if (b < R) {
            const nx = X / R, ny = Y / R, mu = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
            const gr = nz(x * 1.3 + T * 1.3, y * 2.7);
            let v = (0.42 + 0.58 * mu) * (0.8 + 0.35 * gr);
            for (const q of SP) {
              const dx = nx - q[0], dy = ny - q[1];
              if (Math.abs(dx) > q[3] * 2.4) continue;
              const d = Math.sqrt(dx * dx + dy * dy) / q[3];
              if (d < 1) v *= 0.15 + 0.35 * smooth(d / 0.55); else if (d < 2) v *= 0.7 + 0.3 * smooth(d - 1);
            }
            if (mu < 0.35) v += 0.12 * Math.max(0, nz(x * 0.5, y * 1.2 + 40) - 0.6) * 3;
            put(i, clamp(v, 0, 1));
            continue;
          }
          if (b > R * 1.42) continue;
          const r = b / R, a = Math.atan2(Y, X), r2 = 1 / (r * r);
          let I = r2 * r2 * r2 * 0.7;
          if (I > 0.05) I *= 0.7 + 0.5 * nz((a / TAU) * 256 * 2, r * 3 - T * 0.1);
          for (let k = 0; k < s.prom.length; k++) {
            const PR = s.prom[k], pa = PR[0], pw = PR[1], ph = PR[2];
            let da = Math.abs(a - pa - Math.sin(T * 0.05) * 0.02);
            if (da > Math.PI) da = TAU - da;
            if (da > pw * 1.2) continue;
            const hh = (r - 1) / ph, arch = Math.sqrt(Math.max(0, 1 - (da / pw) ** 2));
            if (hh < arch && hh > arch - 0.45 - 0.2 * nz(a * 300, T * 0.5)) I = Math.max(I, 0.9 * (1 - hh * 0.4));
          }
          if (I < 0.07) continue;
          ch[i] = I > 0.6 ? '*' : I > 0.35 ? '+' : I > 0.18 ? ':' : '.'; co[i] = I > 0.6 ? pc(s.Pp, I) : pc(s.Pc, I);
        }
      }
      drawStars(f, s.stars, s.Ps);
    } else if (m === 'granule' || m === 'spot' || m === 'giant') {
      const giant = m === 'giant', spot = m === 'spot';
      const cs = giant ? Math.max(14, cols * 0.11) : Math.max(9, cols * 0.045);
      let R = 0, gcx = cx, gcy = cy;
      if (giant) { R = Math.min(rows * 0.6 * aspect, cols * 0.42) * (1 + 0.03 * Math.sin(T * 0.4)); gcy = rows * 0.55; }
      const yA = giant ? Math.max(0, Math.floor(gcy - R / aspect)) : 0, yB = giant ? Math.min(rows, Math.ceil(gcy + R / aspect)) : rows;
      const xA = giant ? Math.max(0, Math.floor(gcx - R)) : 0, xB = giant ? Math.min(cols, Math.ceil(gcx + R)) : cols;
      worley(s, f, cs, T, giant ? 0.15 : 0.35, xA, xB, yA, yB);
      const E = s.wE, F = s.wF;
      const ur = spot ? Math.min(rows * 0.3 * aspect, cols * 0.13) : 0, pr = ur * 2.1;
      for (let y = yA; y < yB; y++) {
        const Y = (y + 0.5 - gcy) * aspect;
        for (let x = xA; x < xB; x++) {
          const X = x + 0.5 - gcx, i = y * cols + x;
          let v = smooth(E[i] * (giant ? 2.2 : 3.2)) * (0.7 + 0.3 * (1 - F[i])) * (spot ? 1 : 0.9 + 0.2 * nz(x * 0.4 + T, y * 0.8));
          if (giant) {
            const d = Math.hypot(X, Y) / R;
            if (d > 1) {
              if (d < 1.25) { const gl = (1.25 - d) * 1.6; ch[i] = gl > 0.25 ? ':' : '.'; co[i] = pc(s.Pr, gl * 0.6); }
              continue;
            }
            const mu = Math.sqrt(1 - d * d);
            v = (0.25 + 0.75 * mu) * (0.4 + 0.6 * v);
            ch[i] = v > 0.75 ? '@' : v > 0.6 ? '%' : v > 0.48 ? '#' : v > 0.36 ? '*' : v > 0.26 ? '+' : v > 0.16 ? '=' : '-';
            co[i] = pc(s.Pr, v);
            continue;
          }
          if (spot && X * X + Y * Y < pr * pr * 1.4) {
            const d = Math.hypot(X, Y), a = Math.atan2(Y, X), wob = 1 + 0.12 * (nz((a / TAU) * 256 * 2, 3) - 0.5);
            const du = d / (ur * wob), dp = d / (pr * wob);
            if (du < 1) {
              const lb = Math.abs(Y * Math.cos(0.5) - X * Math.sin(0.5)) < ur * 0.06 * (1 + nz(d * 0.3, 9)) ? 0.35 : 0;
              v = 0.06 + 0.06 * nz(x * 0.6, y * 1.2) + lb;
            } else if (dp < 1) {
              const fil = nz((a / TAU) * 256 * 6, d * 0.08 - T * 0.05);
              v = 0.25 + 0.4 * fil * fil + 0.15 * (dp - 0.5);
            }
          }
          put(i, clamp(v, 0, 1));
        }
      }
      if (giant) {
        if (Math.random() < dt * 0.25) s.rings.push(0);
        for (let k = s.rings.length - 1; k >= 0; k--) {
          s.rings[k] += dt * 0.08;
          const rr = R * (1.05 + s.rings[k]);
          if (s.rings[k] > 1.2) { s.rings.splice(k, 1); continue; }
          const N = Math.ceil(rr * 5);
          for (let j = 0; j < N; j += 2) { const a = (j / N) * TAU, x = gcx + Math.cos(a) * rr, y = gcy + (Math.sin(a) * rr) / aspect, ii = (y | 0) * cols + (x | 0); if (x >= 0 && y >= 0 && x < cols && y < rows && ch[ii] === ' ') { ch[ii] = '.'; co[ii] = pc(s.Pr, 0.5 * (1 - s.rings[k] / 1.2)); } }
        }
        drawStars(f, s.stars, s.Ps);
      }
    } else if (m === 'limb' || m === 'flare') {
      const flare = m === 'flare';
      const LR = cols * 1.6, lcy = rows * (flare ? 0.72 : 0.78) + LR / aspect;
      // 日面（粒狀＋周邊變暗）只算弧下方的區域
      const top = Math.max(0, Math.floor(lcy - LR / aspect) - 1);
      worley(s, f, Math.max(4, cols * 0.028), T, 0.4, 0, cols, top, rows);
      const E = s.wE;
      for (let y = top; y < rows; y++) {
        const Y = (y + 0.5 - lcy) * aspect;
        for (let x = 0; x < cols; x++) {
          const X = x + 0.5 - cx, d = Math.sqrt(X * X + Y * Y), i = y * cols + x, h = d - LR;
          if (h > 0) continue;
          const mu = Math.min(1, Math.sqrt(Math.max(0, -h) / (rows * aspect * 0.25)));
          const v = (0.35 + 0.55 * mu) * (0.55 + 0.45 * smooth(E[i] * 3));
          put(i, clamp(v, 0, 1));
        }
      }
      // 針狀體：弧線上方的短刺
      for (let x = 0; x < cols; x++) {
        const X = x + 0.5 - cx, ys = lcy - Math.sqrt(Math.max(0, LR * LR - X * X)) / aspect;
        const hgt = 1 + Math.floor(nz(x * 0.7, T * 2) * 2.5);
        for (let k = 1; k <= hgt; k++) g.set(x, ys - k, k === hgt ? '\'' : '|', pc(s.Pp, 0.5 - k * 0.1));
      }
      // 磁環：每個環上有流動的電漿團
      const flareK = flare ? Math.max(0, Math.sin(((T % 18) / 18) * Math.PI * 2 - 0.4)) ** 6 : 0;
      for (const L of s.loops) {
        const ax = cols * (L.x - L.w), bx = cols * (L.x + L.w), H = rows * aspect * L.h, N = Math.ceil((bx - ax + H) * 2);
        for (let j = 0; j <= N; j++) {
          const u = j / N, th = Math.PI * u, x = (ax + bx) / 2 - Math.cos(th) * (bx - ax) / 2;
          const X = x - cx, ys = lcy - Math.sqrt(Math.max(0, LR * LR - X * X)) / aspect, y = ys - (Math.sin(th) * H) / aspect;
          const flow = Math.pow(0.5 + 0.5 * Math.cos((u * 6 - T * 0.8 - L.ph * 6) * Math.PI), 4);
          const v = (flare ? 0.3 + 0.5 * flareK : 0.25) + flow * 0.6;
          if (v < 0.2) continue;
          g.set(x, y, v > 0.75 ? '@' : v > 0.5 ? '*' : v > 0.35 ? '+' : ':', flare ? pc(s.Pc, v) : pc(s.Pp, v));
        }
      }
      if (!flare) {
        // 噴發型日珥：慢慢升起、拉長、脫離
        const cyc = 26, u = (T % cyc) / cyc, ex = cols * 0.68, R0 = rows * aspect * (0.08 + u * 0.7);
        for (let j = 0; j <= 80; j++) {
          const th = Math.PI * (j / 80), X = ex - cx, ys = lcy - Math.sqrt(Math.max(0, LR * LR - X * X)) / aspect;
          const x = ex - Math.cos(th) * R0 * 0.6, y = ys - (Math.sin(th) * R0 + u * rows * aspect * 0.15) / aspect;
          const v = (1 - u) * (0.5 + 0.5 * nz(j * 0.3, T));
          if (v > 0.12) g.set(x, y, v > 0.5 ? '%' : v > 0.3 ? '*' : ':', pc(s.Pp, v));
        }
      } else {
        if (flareK > 0.6 && s.cme < 0) s.cme = 0;
        if (s.cme >= 0) {
          s.cme += dt;
          const R1 = rows * aspect * (0.1 + s.cme * 0.12), ccx = cols * 0.5, ccy = rows * 0.55 - (s.cme * rows * 0.06);
          const N = Math.ceil(R1 * 6);
          for (let j = 0; j < N; j++) {
            const a = Math.PI + (j / N) * Math.PI, x = ccx + Math.cos(a) * R1 * 1.3, y = ccy + (Math.sin(a) * R1) / aspect;
            const v = Math.max(0, 1 - s.cme / 9) * (0.5 + 0.5 * nz(j * 0.2, s.cme));
            if (v > 0.1) g.set(x, y, v > 0.5 ? '*' : ':', pc(s.Pc, v));
          }
          if (s.cme > 9) s.cme = -1;
        }
      }
      drawStars(f, s.stars, s.Ps, 0, 0, 0.5);
    } else {
      // 太陽風與地球磁層
      const sr = rows * 0.9 * aspect;
      sunGlow(f, -sr * 0.7, cy, sr, Ps, 12, 1.25);
      const ex = cols * 0.74, ey = cy, er = Math.max(2, rows * aspect * 0.06);
      const bs = er * 3.2;
      // 弓形震波 x = ex - bs + k y²
      const inBow = (x, y) => { const Y = (y - ey) * aspect; return x > ex - bs + (Y * Y) / (bs * 2.6); };
      if (s.P.length < (cols * rows) / 14) for (let k = 0; k < 20; k++) s.P.push({ x: rnd(0, cols * 0.3), y: rnd(0, rows), vx: rnd(14, 26) * (cols / 200 + 0.5), vy: 0 });
      for (let k = s.P.length - 1; k >= 0; k--) {
        const q = s.P[k];
        if (inBow(q.x + q.vx * dt, q.y)) { const Y = (q.y - ey) * aspect; q.vy += (Y >= 0 ? 1 : -1) * 30 * dt; q.vx *= 0.97; }
        q.x += q.vx * dt; q.y += (q.vy * dt) / aspect;
        if (q.x >= cols || q.y < 0 || q.y >= rows) { kill(s.P, k); continue; }
        const i = (q.y | 0) * cols + (q.x | 0);
        if (ch[i] !== ' ') continue;
        ch[i] = '-'; co[i] = pc(s.Pw, 0.4 + 0.3 * Math.min(1, Math.abs(q.vy) / 10));
      }
      // 磁力線：向陽面壓縮、背陽面拉成長尾
      for (let L = 1.6; L <= 6; L += 0.9) {
        for (let j = 0; j <= 120; j++) {
          const th = 0.15 + (Math.PI - 0.3) * (j / 120);
          for (const side of [-1, 1]) {
            let r = L * er * Math.sin(th) ** 2;
            const xx = Math.sin(th) * r * side, yy = Math.cos(th) * r;
            let x = ex + xx, y = yy;
            if (side < 0) x = ex + xx * (0.55 + 0.45 / L);
            else x = ex + xx * (1 + L * 0.9);
            const sy = ey - y / aspect;
            if (Math.hypot(x - ex, y) < er) continue;
            g.set(x, sy, '·', pc(s.Pw, 0.55 - L * 0.05));
          }
        }
      }
      for (let yy = 0; yy < rows; yy++) { const Y = (yy + 0.5 - ey) * aspect, x = ex - bs + (Y * Y) / (bs * 2.6); if (x > 0 && x < cols) g.set(x, yy, ')', pc(s.Pw, 0.75)); }
      ball(f, hue, ex, ey, er, -1, 0, 0.3, [70, 130, 230], 0.05);
      for (const sg of [-1, 1]) for (let k = -3; k <= 3; k++) g.set(ex + k * 0.7, ey + (sg * (er * 0.95 + 0.6)) / aspect, '~', pc(s.Pa, 0.6 + 0.4 * Math.sin(T * 2 + k)));
      if (cols >= 100) { txt(g, ex - 6, ey + er / aspect + 3, tr(f, '地球磁層', 'Magnetosphere'), pc(s.Pw, 0.6)); txt(g, Math.round(ex - bs) - 6, 1, tr(f, '弓形震波', 'Bow shock'), pc(s.Pw, 0.6)); }
    }
  },
});
})();
