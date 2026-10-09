// 碎形模組（fx-）：逃逸時間碎形、混沌遊戲與 IFS、遞迴曲線、L 系統植物、圓填充與碎形火焰。
// 整個檔案包在函式裡，輔助常數與函式不會和其他模組撞名。
(() => {
const SM = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const tri = x => { x -= Math.floor(x); return x < 0.5 ? x * 2 : 2 - x * 2; };

/* ═════════════ 逃逸時間引擎 ═════════════
   每格算一個值 ev（平滑迭代次數；-1 = 內部）與輔助值 ea（距離估計、條紋、收斂的根…）。
   有迭代預算 BUD（約 2 ns 一單位）：太貴時每格只重算隨機的 1/K 格，其餘沿用上一格
   （只有視角在動時會把舊值重投影到新位置），再不夠才降低最大迭代數。 */
const BUD = 0.6e6;
const COSL = new Float32Array(1025);
for (let k = 0; k <= 1024; k++) COSL[k] = 0.5 + 0.5 * Math.cos((k / 1024) * TAU);
const NB = 160, LK = NB / Math.log(1 + 6000);
let MI = 64, ITS = 0;
let KA = 0, KB = 0, KC = 0, KD = 0, KN = 2, KM = 0, KL = 1;
const RX = new Float64Array(8), RY = new Float64Array(8);
const SEQ = new Uint8Array(64); let SEQN = 2;
const RAMPS = [' .:-=+*#%@', ' .,:;=+x#@', ' ·:∙•●', ' ░▒▓█', ' .-~=≈≡', ' .\'^:;!|$', ' .oO0@', ' .:+xX#'];

function escInit(s, f) {
  const n = f.cols * f.rows;
  s.ev = new Float32Array(n); s.ea = new Float32Array(n);
  s.pv = new Float32Array(n); s.pa = new Float32Array(n);
  s.lv = new Float32Array(n); s.q = new Int32Array(n); s.eb = new Float32Array(n);
  s.wx = new Float64Array(n); s.wy = new Float64Array(n); s.wi = new Int32Array(n);
  s.rph = new Uint8Array(n); for (let i = 0; i < n; i++) s.rph[i] = (Math.random() * 840) | 0;
  s.hist = new Float32Array(NB); s.cdf = new Float32Array(NB + 1); s.cdfOk = false;
  s.gt = new Float32Array(257); s.gam = -1;
  s.ow = null; s.mi = 40; s.est = 0; s.fr = 0;
}
// mode 1：只有視角改變（可把上一格的值重投影過來）；mode 0：公式本身在變（沿用同位置的舊值）。
// 太貴時每格只重算 1/K 的格子，其餘沿用；再不夠就降低最大迭代數。
function escRender(s, f, kern, cx, cy, sc, rot, want, mode, asp) {
  const cols = f.cols, rows = f.rows, n = cols * rows;
  let tmp = s.ev; s.ev = s.pv; s.pv = tmp; tmp = s.ea; s.ea = s.pa; s.pa = tmp;
  const ow = s.ow, cap = ow ? (mode ? 8 : 4) : 1, est = s.est;
  if (est > BUD * cap) s.mi = Math.max(8, s.mi * clamp((BUD * cap) / est, 0.75, 0.97));
  else if (est < BUD * cap * 0.7 && s.mi < want) s.mi = Math.min(want, s.mi * 1.05 + 1);
  if (s.mi > want) s.mi = want;
  const K = cap > 1 ? clamp(Math.ceil(est / BUD), 1, cap) : 1;
  MI = Math.max(4, s.mi | 0); ITS = 0;
  const ev = s.ev, ea = s.ea, pv = s.pv, pa = s.pa, WX = s.wx, WY = s.wy, WI = s.wi, hx = cols / 2, hy = rows / 2;
  const cr = Math.cos(rot), sr = Math.sin(rot), dxs = sc * cr, dys = sc * sr;
  let ocx = 0, ocy = 0, ocr = 1, osr = 0, iosc = 1, ioscA = 1;
  const rp = K > 1 && mode;
  if (rp) { ocx = ow.cx; ocy = ow.cy; ocr = Math.cos(ow.rot); osr = Math.sin(ow.rot); iosc = 1 / ow.sc; ioscA = 1 / (ow.sc * ow.asp); }
  // 每格只重算「隨機相位」輪到的 1/K 格子，其餘沿用（不會出現規則的斜紋）
  const ph = s.fr++ % K, rph = s.rph;
  let N = 0;
  for (let y = 0, i = 0; y < rows; y++) {
    const v = (y + 0.5 - hy) * sc * asp, u0 = (0.5 - hx) * sc;
    let wx = cx + u0 * cr - v * sr, wy = cy + u0 * sr + v * cr;
    for (let x = 0; x < cols; x++, i++, wx += dxs, wy += dys) {
      if (K > 1 && (rph[i] + ph) % K !== 0) {
        if (!rp) { ev[i] = pv[i]; ea[i] = pa[i]; continue; }
        const dx = wx - ocx, dy = wy - ocy;
        const ox = Math.floor((dx * ocr + dy * osr) * iosc + hx), oy = Math.floor((dy * ocr - dx * osr) * ioscA + hy);
        if (ox >= 0 && oy >= 0 && ox < cols && oy < rows) { const j = oy * cols + ox; ev[i] = pv[j]; ea[i] = pa[j]; continue; }
      }
      WX[N] = wx; WY[N] = wy; WI[N++] = i;
    }
  }
  kern(N, WX, WY, WI, ev, ea);
  s.est = (ITS * n) / Math.max(1, N);
  const o = s.ow || (s.ow = {});
  o.cx = cx; o.cy = cy; o.sc = sc; o.rot = rot; o.asp = asp;
}
// 直方圖等化：把外部格子的 log(值) 轉成 0..1 的累積比例（隨時間平滑）
function escEq(s, f) {
  const n = f.cols * f.rows, ev = s.ev, lv = s.lv, h = s.hist, c = s.cdf;
  h.fill(0);
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    const v = ev[i];
    if (!(v >= 0)) { lv[i] = -1; continue; }
    let l = Math.log(1 + v) * LK;
    if (l > NB - 0.001) l = NB - 0.001;
    lv[i] = l; h[l | 0]++; cnt++;
  }
  const a = s.cdfOk ? 1 - Math.exp(-f.dt * 5) : 1;
  let acc = 0;
  for (let b = 0; b < NB; b++) { acc += h[b]; const tv = cnt ? acc / cnt : (b + 1) / NB; c[b + 1] += (tv - c[b + 1]) * a; }
  s.cdfOk = true;
}
function gamT(s, g) {
  if (s.gam !== g) { s.gam = g; for (let k = 0; k <= 256; k++) s.gt[k] = Math.pow(k / 256, g); }
  return s.gt;
}
// 內部畫法：inner 1 = 依軌道角度慢慢流動的淡條紋；2 = 一圈圈往內脈動的亮帶；3 = 均勻的淡點
function innerCell(ch, co, i, R, RL, a0, inner, ik, t, H, h0) {
  if (inner === 1) {
    const a = fract(a0 * ik + t * 0.04), e = 0.1 + 0.3 * tri(a);
    ch[i] = R[1 + ((a * 2) | 0)]; co[i] = H(h0 + 180 + a * 60, e);
  } else if (inner === 2) {
    const a = fract(a0 * ik - t * 0.15), e = 0.15 + 0.6 * Math.pow(tri(a), 3);
    ch[i] = R[1 + ((e * (RL - 1)) | 0)]; co[i] = H(h0 + 120 + a * 90, e);
  } else if (inner === 3) { ch[i] = R[1]; co[i] = H(h0 + 180, 0.14); }
  else if (inner === 4) {   // a0 = 到邊界的格數：一圈圈貼著邊界的回音紋慢慢往內走，越深越淡
    const w = tri(fract((a0 * ik) / 10 - t * 0.12));
    if (w < 0.5) return;
    ch[i] = R[w > 0.8 ? 2 : 1]; co[i] = H(h0 + 180 + a0 * 2, (0.12 + 0.4 * w * w) * (a0 < 40 ? 1 - a0 / 70 : 0.43));
  }
}
// 內部每格到最近外部格的距離（兩趟倒角距離轉換；縱向一格算 aspect 個單位）
function interiorDist(s, f, inside) {
  const cols = f.cols, rows = f.rows, n = cols * rows, A = f.aspect, Dg = Math.sqrt(1 + A * A);
  const d = s.dist && s.dist.length === n ? s.dist : (s.dist = new Float32Array(n));
  for (let i = 0; i < n; i++) d[i] = inside(i) ? 1e6 : 0;
  for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
    let v = d[i]; if (!v) continue;
    if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
    if (y > 0) { if (d[i - cols] + A < v) v = d[i - cols] + A; if (x > 0 && d[i - cols - 1] + Dg < v) v = d[i - cols - 1] + Dg; if (x < cols - 1 && d[i - cols + 1] + Dg < v) v = d[i - cols + 1] + Dg; }
    d[i] = v;
  }
  for (let y = rows - 1, i = n - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--, i--) {
    let v = d[i]; if (!v) continue;
    if (x < cols - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
    if (y < rows - 1) { if (d[i + cols] + A < v) v = d[i + cols] + A; if (x < cols - 1 && d[i + cols + 1] + Dg < v) v = d[i + cols + 1] + Dg; if (x > 0 && d[i + cols - 1] + Dg < v) v = d[i + cols - 1] + Dg; }
    d[i] = v;
  }
  return d;
}
// 一般上色：越接近邊界越亮；bk>0 時加上往外流動的條紋；inner 決定內部畫法
function shadeEsc(s, f, p) {
  escEq(s, f);
  const g = f.g, cols = f.cols, rows = f.rows, n = g.n, ch = g.ch, co = g.co, ev = s.ev, ea = s.ea, lv = s.lv, c = s.cdf, H = f.H, t = f.t, eb = s.eb;
  const gt = gamT(s, p.g), R = RAMPS[p.ramp], RL = R.length - 1, cut = p.cut, inv = RL / (1 - cut);
  const bk = p.bk, bv = p.bv, hs = p.hs, h0 = p.hu + t * p.hv, inner = p.inner, ik = p.ik, bl = p.blur, ib = p.ib;
  for (let i = 0; i < n; i++) { const l = lv[i]; if (l < 0) eb[i] = ib; else { const b = l | 0; eb[i] = c[b] + (c[b + 1] - c[b]) * (l - b); } }
  const IA = inner === 4 ? interiorDist(s, f, i => lv[i] < 0) : ea;
  for (let i = 0, x = 0, y = 0; i < n; i++, x = x + 1 === cols ? (y++, 0) : x + 1) {
    const l = lv[i];
    if (l < 0) { if (inner) innerCell(ch, co, i, R, RL, IA[i], inner, ik, t, H, h0); continue; }
    let E = eb[i];
    if (bl) E = E * (1 - bl) + ((x > 0 ? eb[i - 1] : E) + (x < cols - 1 ? eb[i + 1] : E) + (y > 0 ? eb[i - cols] : E) + (y < rows - 1 ? eb[i + cols] : E)) * 0.25 * bl;
    let e = gt[(E * 256) | 0];
    if (bk) { const w = ev[i] * bk - t * bv; e *= 0.35 + 0.65 * COSL[((w - Math.floor(w)) * 1024) | 0]; }
    if (e < cut) continue;
    let k = 1 + (((e - cut) * inv) | 0);
    if (k > RL) k = RL;
    ch[i] = R[k]; co[i] = H(h0 + E * hs, 0.12 + 0.88 * e);
  }
}
// 等高線：等化後的逃逸值切成很多層，層與層的交界畫成線，線會慢慢往外流
function shadeContour(s, f, p) {
  escEq(s, f);
  const { g, cols, rows, t, H } = f, ch = g.ch, co = g.co, lv = s.lv, c = s.cdf, q = s.q;
  const lev = p.lev, sp = t * p.bv, n = cols * rows, h0 = p.hu + t * p.hv;
  for (let i = 0; i < n; i++) {
    const l = lv[i];
    if (l < 0) { q[i] = -1 << 30; continue; }
    const b = l | 0, E = c[b] + (c[b + 1] - c[b]) * (l - b);
    lv[i] = E; q[i] = Math.floor((l * lev) / 20 - sp);
  }
  for (let y = 0, i = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++, i++) {
      const a = q[i];
      if (a === -1 << 30) continue;
      const dx = (x + 1 < cols ? q[i + 1] : a) - a, dy = (y + 1 < rows ? q[i + cols] : a) - a;
      const E = lv[i];
      if (!dx && !dy) {
        if (((x * 7 + y * 13 + a * 5) & 15) === 0 && E > 0.3) { ch[i] = '.'; co[i] = H(h0 + E * p.hs, 0.15 + 0.2 * E); }
        continue;
      }
      ch[i] = dx && dy ? ((dx > 0) === (dy > 0) ? '/' : '\\') : dx ? '|' : '-';
      co[i] = H(h0 + E * p.hs, 0.3 + 0.7 * E);
    }
  }
}
// 條紋平均上色：軌道每一步的 sin(4·arg z) 取平均（不用三角函數，直接由 x、y 算），外部呈現沿細絲流動的光紋
function shadeTrap(s, f, p) {
  escEq(s, f);
  const g = f.g, n = g.n, ch = g.ch, co = g.co, ea = s.ea, lv = s.lv, c = s.cdf, H = f.H, t = f.t;
  const R = RAMPS[p.ramp], RL = R.length - 1, h0 = p.hu + t * p.hv, ph = t * p.bv, inner = p.inner, ik = p.ik;
  for (let i = 0; i < n; i++) {
    const l = lv[i];
    if (l < 0) { if (inner) innerCell(ch, co, i, R, RL, ea[i], inner, ik, t, H, h0); continue; }
    const b = l | 0, E = c[b] + (c[b + 1] - c[b]) * (l - b);
    const v = ea[i], w = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin((v * 4 - ph) * TAU)) + 0.25 * v;
    const e = clamp(w, 0, 1) * (0.25 + 0.75 * E * E);
    if (e < 0.07) continue;
    ch[i] = R[Math.min(RL, 1 + ((e * RL) | 0))]; co[i] = H(h0 + v * p.hs + E * 30, 0.1 + 0.9 * e);
  }
}

/* ── 核心公式（批次：一次算完整份工作清單，迴圈保持單型才跑得快） ──
   ITS 以「約 1.8 ns」為一單位累計成本。 */
// 內部座標：吸引週期的乘數 λ（|λ|<1），d = −ln|λ| / 週期 ≈ 到邊界的遠近。
// 取 log(d)：內部畫出貼著邊界、越靠近越密的一圈圈紋路；主心形與二週期圓盤另外加上 arg λ，變成螺紋
function lamVal(lx, ly, per, ang) {
  const d = (-0.5 * Math.log(lx * lx + ly * ly + 1e-300)) / per;
  return (ang ? Math.atan2(ly, lx) / TAU + 0.5 : 0) + 0.3 * Math.log2(d > 1e-6 ? d : 1e-6);
}
function lamCard(cr, ci) {   // 主心形：λ = 1 − √(1 − 4c)
  const wx = 1 - 4 * cr, wy = -4 * ci, r = Math.sqrt(wx * wx + wy * wy);
  const sx = Math.sqrt(Math.max(0, (r + wx) / 2)), sy = (wy < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (r - wx) / 2));
  return lamVal(1 - sx, -sy, 1, 1);
}
function lamCyc(zx, zy, cr, ci, per) {   // 沿著已收斂的週期走一圈，乘出 λ = Π 2z
  let dx = 1, dy = 0;
  for (let k = 0; k < per; k++) { const nx = 2 * (zx * dx - zy * dy); dy = 2 * (zx * dy + zy * dx); dx = nx; const u = zx * zx - zy * zy + cr; zy = 2 * zx * zy + ci; zx = u; }
  return lamVal(dx, dy, per, 0);
}
// 還沒收斂到週期的內部點：多走 48 步，取 ln|2z| 的平均（軌道的李亞普諾夫指數 ≈ ln|λ| / 週期）
function lamRun(zx, zy, cr, ci) {
  let sum = 0, pr = 1;
  for (let k = 1; k <= 48; k++) {
    const u = zx * zx - zy * zy + cr; zy = 2 * zx * zy + ci; zx = u;
    pr *= 4 * (zx * zx + zy * zy);
    if ((k & 7) === 0) { sum += Math.log(pr + 1e-300); pr = 1; }
  }
  const d = -sum / 96;
  return 0.3 * Math.log2(d > 1e-6 ? d : 1e-6);
}
// 主心形與二週期圓盤直接判定（ea 填入內部座標）；回傳 true 表示是內部
function mShort(cr, ci, o, ev, ea) {
  const q = (cr - 0.25) * (cr - 0.25) + ci * ci;
  if (q * (q + (cr - 0.25)) <= 0.25 * ci * ci) { ev[o] = -1; ea[o] = lamCard(cr, ci); return true; }
  if ((cr + 1) * (cr + 1) + ci * ci <= 0.0625) { ev[o] = -1; ea[o] = lamVal(4 * cr + 4, 4 * ci, 2, 1); return true; }
  return false;
}
function kMandel(N, WX, WY, WI, ev, ea) {
  const mi = MI;
  let its = 0;
  outer: for (let j = 0; j < N; j++) {
    const cr = WX[j], ci = WY[j], o = WI[j];
    if (mShort(cr, ci, o, ev, ea)) { its += 16; continue; }
    let zx = 0, zy = 0, zx2 = 0, zy2 = 0, it = 0, px = 0, py = 0, pc = 0, pl = 8;
    while (zx2 + zy2 < 256) {
      if (++it > mi) { its += mi * 1.2 + 70; ev[o] = -1; ea[o] = lamRun(zx, zy, cr, ci); continue outer; }
      zy = 2 * zx * zy + ci; zx = zx2 - zy2 + cr; zx2 = zx * zx; zy2 = zy * zy;
      if (Math.abs(zx - px) + Math.abs(zy - py) < 1e-13) { its += it * 1.2 + pc * 2; ev[o] = -1; ea[o] = lamCyc(zx, zy, cr, ci, pc + 1); continue outer; }
      if (++pc === pl) { pc = 0; pl += pl; px = zx; py = zy; }
    }
    its += it * 1.2 + 14;
    const mu = it + 1 - Math.log2(0.5 * Math.log(zx2 + zy2));
    ev[o] = mu > 0 ? mu : 0; ea[o] = 0;
  }
  ITS += its;
}
// 同上，另外追蹤導數 dz 算距離估計（ea = 到集合邊界的世界距離）
function kMandelDE(N, WX, WY, WI, ev, ea) {
  const mi = MI;
  let its = 0;
  outer: for (let j = 0; j < N; j++) {
    const cr = WX[j], ci = WY[j], o = WI[j];
    if (mShort(cr, ci, o, ev, ea)) { its += 16; continue; }
    let zx = 0, zy = 0, zx2 = 0, zy2 = 0, dx = 0, dy = 0, it = 0, px = 0, py = 0, pc = 0, pl = 8;
    while (zx2 + zy2 < 1024) {
      if (++it > mi) { its += mi * 1.6 + 70; ev[o] = -1; ea[o] = lamRun(zx, zy, cr, ci); continue outer; }
      const ndx = 2 * (zx * dx - zy * dy) + 1;
      dy = 2 * (zx * dy + zy * dx); dx = ndx;
      zy = 2 * zx * zy + ci; zx = zx2 - zy2 + cr; zx2 = zx * zx; zy2 = zy * zy;
      if (Math.abs(zx - px) + Math.abs(zy - py) < 1e-13) { its += it * 1.6 + pc * 2; ev[o] = -1; ea[o] = lamCyc(zx, zy, cr, ci, pc + 1); continue outer; }
      if (++pc === pl) { pc = 0; pl += pl; px = zx; py = zy; }
    }
    its += it * 1.6 + 16;
    const r2 = zx2 + zy2, lr = 0.5 * Math.log(r2), mu = it + 1 - Math.log2(lr);
    ev[o] = mu > 0 ? mu : 0; ea[o] = (Math.sqrt(r2) * lr) / (Math.sqrt(dx * dx + dy * dy) + 1e-300);
  }
  ITS += its;
}
function kMandelTrap(N, WX, WY, WI, ev, ea) {
  const mi = MI;
  let its = 0;
  outer: for (let j = 0; j < N; j++) {
    const cr = WX[j], ci = WY[j], o = WI[j];
    if (mShort(cr, ci, o, ev, ea)) { its += 16; continue; }
    let zx = 0, zy = 0, zx2 = 0, zy2 = 0, it = 0, sum = 0, px = 0, py = 0, pc = 0, pl = 8;
    while (zx2 + zy2 < 1024) {
      if (++it > mi) { its += mi * 1.6 + 70; ev[o] = -1; ea[o] = lamRun(zx, zy, cr, ci); continue outer; }
      zy = 2 * zx * zy + ci; zx = zx2 - zy2 + cr; zx2 = zx * zx; zy2 = zy * zy;
      if (Math.abs(zx - px) + Math.abs(zy - py) < 1e-13) { its += it * 1.6 + pc * 2; ev[o] = -1; ea[o] = lamCyc(zx, zy, cr, ci, pc + 1); continue outer; }
      if (++pc === pl) { pc = 0; pl += pl; px = zx; py = zy; }
      const r2 = zx2 + zy2 + 1e-30, s2 = (2 * zx * zy) / r2, c2 = (zx2 - zy2) / r2;
      sum += 0.5 + s2 * c2;   // 0.5 + 0.5·sin(4θ)
    }
    its += it * 1.6 + 16;
    const mu = it + 1 - Math.log2(0.5 * Math.log(zx2 + zy2));
    ev[o] = mu > 0 ? mu : 0; ea[o] = sum / it;
  }
  ITS += its;
}
function kJulia(N, WX, WY, WI, ev, ea) {
  const mi = MI, a = KA, b = KB, d = KN, kl = KL, fx = KC, fy = KD, w = d === 2 ? 1.5 : d === 3 ? 1.6 : 2.2;
  let its = 0;
  outer: for (let j = 0; j < N; j++) {
    let zx = WX[j], zy = WY[j], zx2 = zx * zx, zy2 = zy * zy, it = 0, dx = 1, dy = 0;
    const o = WI[j];
    while (zx2 + zy2 < 1024) {
      if (++it > mi) { its += mi * w; ev[o] = -1; ea[o] = Math.hypot(zx - fx, zy - fy); continue outer; }
      if (d === 2) {
        const ndx = 2 * (zx * dx - zy * dy);
        dy = 2 * (zx * dy + zy * dx); dx = ndx;
        zy = 2 * zx * zy + b; zx = zx2 - zy2 + a;
      }
      else if (d === 3) { const nx = zx * (zx2 - 3 * zy2) + a; zy = zy * (3 * zx2 - zy2) + b; zx = nx; }
      else {
        const sx = zx2 - zy2, sy = 2 * zx * zy;
        let rx, ry;
        if (d === 4) { rx = sx * sx - sy * sy; ry = 2 * sx * sy; }
        else if (d === 5) { const qx = sx * sx - sy * sy, qy = 2 * sx * sy; rx = qx * zx - qy * zy; ry = qx * zy + qy * zx; }
        else { const qx = sx * sx - sy * sy, qy = 2 * sx * sy; rx = qx * sx - qy * sy; ry = qx * sy + qy * sx; }
        zx = rx + a; zy = ry + b;
      }
      zx2 = zx * zx; zy2 = zy * zy;
    }
    its += it * w + 14;
    const r2 = zx2 + zy2, lr = 0.5 * Math.log(r2), mu = it + 1 - Math.log(lr) * kl;
    ev[o] = mu > 0 ? mu : 0; ea[o] = d === 2 ? (Math.sqrt(r2) * lr) / (Math.sqrt(dx * dx + dy * dy) + 1e-300) : 0;
  }
  ITS += its;
}
// 燃燒船家族：KM 0 燃燒船、1 凱爾特、2 水牛、3 垂直；KC=1 為朱利亞版本 c=(KA,KB)
function kShip(N, WX, WY, WI, ev, ea) {
  const mi = MI, m = KM, jul = KC, ka = KA, kb = KB;
  let its = 0;
  outer: for (let j = 0; j < N; j++) {
    const o = WI[j];
    let zx, zy, cr, ci;
    if (jul) { zx = WX[j]; zy = WY[j]; cr = ka; ci = kb; } else { zx = 0; zy = 0; cr = WX[j]; ci = WY[j]; }
    let zx2 = zx * zx, zy2 = zy * zy, it = 0, mr = 1e9;
    while (zx2 + zy2 < 256) {
      if (++it > mi) { its += mi * 1.5; ev[o] = -1; ea[o] = 0.15 * Math.log2(mr + 1e-12); continue outer; }   // 內部：軌道最接近原點的距離
      let nx = zx2 - zy2, ny;
      if (m === 0) { ny = zx * zy; ny = ny < 0 ? -2 * ny : 2 * ny; }
      else if (m === 1) { if (nx < 0) nx = -nx; ny = 2 * zx * zy; }
      else if (m === 2) { if (nx < 0) nx = -nx; ny = zx * zy; ny = ny < 0 ? -2 * ny : 2 * ny; }
      else ny = -2 * zx * (zy < 0 ? -zy : zy);
      zx = nx + cr; zy = ny + ci; zx2 = zx * zx; zy2 = zy * zy;
      if (zx2 + zy2 < mr) mr = zx2 + zy2;
    }
    its += it * 1.5 + 14;
    const mu = it + 1 - Math.log2(0.5 * Math.log(zx2 + zy2));
    ev[o] = mu > 0 ? mu : 0; ea[o] = 0;
  }
  ITS += its;
}
// 多重曼德博：KN 次方，KM=1 取共軛，KC=1 用 1/c 反演平面（再平移 KD）；ea = 逃逸時虛部正負（二元分解）
function kMulti(N, WX, WY, WI, ev, ea) {
  const mi = MI, d = KN, cj = KM, inv = KC, sh = KD, kl = KL, w = d === 2 ? 1.1 : d === 3 ? 1.6 : 2.2;
  let its = 0;
  outer: for (let j = 0; j < N; j++) {
    const o = WI[j];
    let cr = WX[j], ci = WY[j];
    if (inv) { const q = cr * cr + ci * ci + 1e-12; cr = cr / q + sh; ci = -ci / q; }
    let zx = 0, zy = 0, zx2 = 0, zy2 = 0, it = 0;
    while (zx2 + zy2 < 256) {
      if (++it > mi) { its += mi * w; ev[o] = -1; ea[o] = Math.atan2(zy, zx) / TAU + 0.5; continue outer; }
      if (cj) zy = -zy;
      if (d === 2) { zy = 2 * zx * zy + ci; zx = zx2 - zy2 + cr; }
      else if (d === 3) { const nx = zx * (zx2 - 3 * zy2) + cr; zy = zy * (3 * zx2 - zy2) + ci; zx = nx; }
      else {
        const sx = zx2 - zy2, sy = 2 * zx * zy;
        let rx, ry;
        if (d === 4) { rx = sx * sx - sy * sy; ry = 2 * sx * sy; }
        else if (d === 5) { const qx = sx * sx - sy * sy, qy = 2 * sx * sy; rx = qx * zx - qy * zy; ry = qx * zy + qy * zx; }
        else { const qx = sx * sx - sy * sy, qy = 2 * sx * sy; rx = qx * sx - qy * sy; ry = qx * sy + qy * sx; }
        zx = rx + cr; zy = ry + ci;
      }
      zx2 = zx * zx; zy2 = zy * zy;
    }
    its += it * w + 14;
    const mu = it + 1 - Math.log(0.5 * Math.log(zx2 + zy2)) * kl;
    ev[o] = mu > 0 ? mu : 0; ea[o] = zy > 0 ? 1 : 0;
  }
  ITS += its;
}
// 牛頓法：根放在 RX/RY（KN 個），KA 鬆弛係數，KM=1 時每步加上 (KB,KC)（諾瓦）；ea = 收斂到第幾個根
function kNewton(N, WX, WY, WI, ev, ea) {
  const n = KN, a = KA, mi = MI, nova = KM, nb = KB, nc = KC, w = 3.5 + n * 1.5;
  let its = 0;
  outer: for (let j = 0; j < N; j++) {
    const o = WI[j];
    let x = WX[j], y = WY[j];
    for (let it = 0; it < mi; it++) {
      let sx = 0, sy = 0;
      for (let k = 0; k < n; k++) {
        const dx = x - RX[k], dy = y - RY[k], d = dx * dx + dy * dy;
        if (d < 1e-14) { ev[o] = it; ea[o] = k; its += it * w + 14; continue outer; }
        sx += dx / d; sy -= dy / d;
      }
      const d = sx * sx + sy * sy + 1e-30;
      let stx = (a * sx) / d, sty = (-a * sy) / d;
      if (nova) { stx -= nb; sty -= nc; }
      x -= stx; y -= sty;
      const s2 = stx * stx + sty * sty;
      if (s2 < 1e-7) {
        let bk = 0, bd = 1e9;
        if (nova) bk = ((Math.round((Math.atan2(y, x) / TAU) * n) % n) + n) % n;
        else for (let k = 0; k < n; k++) { const dx = x - RX[k], dy = y - RY[k], dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; bk = k; } }
        its += it * w + 16;
        const fr = Math.log(Math.log(s2 + 1e-300) / -16.1) / Math.LN2;
        ev[o] = it + 1 - (fr < 0 ? 0 : fr > 1 ? 1 : fr); ea[o] = bk;
        continue outer;
      }
    }
    its += mi * w; ev[o] = -1; ea[o] = -1;
  }
  ITS += its;
}
// 鳳凰碎形：z' = z^KN + c + p·z_前一步；c=(KA,KD)、p=(KB,KC)；KM=1 為參數平面版本
function kPhoenix(N, WX, WY, WI, ev, ea) {
  const mi = MI, pr = KB, pi = KC, d = KN, kl = KL, mand = KM, ka = KA, kd = KD, w = d === 2 ? 1.6 : 2;
  let its = 0;
  outer: for (let j = 0; j < N; j++) {
    const o = WI[j];
    let zx, zy, cr, ci;
    if (mand) { zx = 0; zy = 0; cr = WX[j]; ci = WY[j]; } else { zx = WX[j]; zy = WY[j]; cr = ka; ci = kd; }
    let px = 0, py = 0, it = 0, zx2 = zx * zx, zy2 = zy * zy, mr = 1e9;
    while (zx2 + zy2 < 64) {
      // 內部：軌道離原點最近的距離（取對數），畫出一圈圈的泡泡紋
      if (++it > mi) { its += mi * w; ev[o] = -1; ea[o] = 0.15 * Math.log2(mr + 1e-12); continue outer; }
      let nx, ny;
      if (d === 2) { nx = zx2 - zy2; ny = 2 * zx * zy; } else { nx = zx * (zx2 - 3 * zy2); ny = zy * (3 * zx2 - zy2); }
      nx += cr + pr * px - pi * py; ny += ci + pr * py + pi * px;
      px = zx; py = zy; zx = nx; zy = ny; zx2 = zx * zx; zy2 = zy * zy;
      if (zx2 + zy2 < mr) mr = zx2 + zy2;
    }
    its += it * w + 14;
    const mu = it + 1 - Math.log(0.5 * Math.log(zx2 + zy2)) * kl;
    ev[o] = mu > 0 ? mu : 0; ea[o] = 0;
  }
  ITS += its;
}
// 李亞普諾夫指數：r 依序列 SEQ 在 a（橫）與 b（直）之間切換；回傳 λ
function kLyap(N, WX, WY, WI, ev, ea) {
  const M = MI, L = SEQN;
  let its = 0;
  for (let j = 0; j < N; j++) {
    const a = WX[j], b = WY[j], o = WI[j];
    ea[o] = 0;
    if (a < 0.5 || b < 0.5 || a > 4 || b > 4) { its += 2; ev[o] = 3; continue; }
    let x = 0.5, q = 0;
    for (let k = 0; k < 24; k++) { const r = SEQ[q] ? b : a; x = r * x * (1 - x); if (++q === L) q = 0; }
    let lam = 0, prod = 1;
    for (let k = 1; k <= M; k++) {
      const r = SEQ[q] ? b : a;
      x = r * x * (1 - x);
      if (++q === L) q = 0;
      const dv = r - 2 * r * x;
      prod *= dv < 0 ? -dv : dv;
      if ((k & 7) === 0) { lam += Math.log(prod + 1e-300); prod = 1; }
    }
    lam += Math.log(prod + 1e-300);
    its += (M + 24) * 1.2 + 10;
    ev[o] = lam / M;
  }
  ITS += its;
}

// 共用的上色參數預設
const SHADE = { style: 0, ramp: 0, g: 2.4, cut: 0.06, hu: 200, hs: 0, hv: 0, bk: 0, bv: 0.3, inner: 0, ik: 1, lev: 14, tk: 30, dk: 0.2, fk: 0.5, blur: 0, ib: 1 };
function shadeBy(s, f, p, sc) {
  if (p.style === 1) shadeContour(s, f, p);
  else if (p.style === 2) shadeTrap(s, f, p);
  else if (p.style === 3) shadeDE(s, f, p, sc);
  else shadeEsc(s, f, p);
}
// 距離估計線稿：ea = 到集合的估計距離，換算成「幾格」後越近越亮；遠處只留淡淡的等時線
function shadeDE(s, f, p, sc) {
  const g = f.g, n = g.n, ch = g.ch, co = g.co, ev = s.ev, ea = s.ea, H = f.H, t = f.t;
  const R = RAMPS[p.ramp], RL = R.length - 1, isc = 1 / sc, h0 = p.hu + t * p.hv, dk = p.dk, fk = p.fk, fv = t * p.bv, hs = p.hs, inner = p.inner, ik = p.ik;
  for (let i = 0; i < n; i++) {
    const mu = ev[i];
    if (mu < 0) { if (inner) innerCell(ch, co, i, R, RL, ea[i], inner, ik, t, H, h0); continue; }
    const e = 1 - Math.log2(1 + ea[i] * isc) * dk;
    if (e < 0.1) {
      if (fk && fract(mu * fk - fv) < 0.17) { ch[i] = R[1]; co[i] = H(h0 + mu * 4, 0.22); }
      continue;
    }
    let k = 1 + ((e * RL) | 0);
    if (k > RL) k = RL;
    ch[i] = R[k]; co[i] = H(h0 + hs * (1 - e) + mu * 2, 0.15 + 0.85 * e);
  }
}
// 縮放巡航：深度在 0..depth（log10）之間來回；中心從全景慢慢收斂到目標點
function tour(f, p, t) {
  const z = p.depth * (0.5 - 0.5 * Math.cos((t / p.per + p.t0) * TAU));
  const k = Math.pow(10, -z), kc = p.hk ? Math.pow(k, p.hk) : k;   // hk>1：中等倍率時就對準目標點，畫面不會停在集合內部
  return { z, sc: Math.max(p.w0 / f.cols, p.fh / (f.rows * f.aspect)) * k, cx: p.tx + (p.hx - p.tx) * kc, cy: p.ty + (p.hy - p.ty) * kc };
}

/* ═════════════ 1. 曼德博漫遊 ═════════════ */
A({ id: 'fx-mandel', name: '曼德博漫遊', cat: '碎形', theme: 'ocean', desc: '緩緩潛入海馬谷的發光細絲',
  params: Object.assign({}, SHADE, { tx: -0.743643887037151, ty: 0.13182590420533, hx: -0.62, hy: 0, w0: 3.3, fh: 2.4, depth: 4.4, per: 150, t0: 0.17, rot: 0.012, mi0: 70, mik: 55, trap: 0, style: 3, ramp: 1, dk: 0.4, fk: 0.8, inner: 1, ik: 2, hk: 2 }),
  variants: [
    { id: 'elephant', name: '象谷', theme: 'gold', desc: '主心形旁一列列象鼻螺旋',
      params: { tx: 0.297595564700503, ty: 0.0180807041609511, hx: -0.5, depth: 4, per: 140, t0: 0.2, rot: -0.01, style: 0, ramp: 0, g: 2.6, inner: 3 } },
    { id: 'triple', name: '三重螺旋', theme: 'synth', hue: true, desc: '三臂螺旋層層相套',
      params: { tx: -0.0767500685871056, ty: 0.659504892546868, hx: -0.55, depth: 3.6, per: 130, t0: 0.22, rot: 0.02, hu: 300, hs: 140, hv: 3, dk: 0.33, ramp: 2, fk: 0.7, inner: 2, ik: 3, hk: 2 } },
    { id: 'minibrot', name: '迷你曼德博', theme: 'toxic', desc: '在觸角深處找到縮小的自己',
      params: { tx: -1.7548776662, ty: 0, hx: -0.9, depth: 2.05, per: 90, t0: 0.25, rot: 0, style: 0, ramp: 7, g: 2.2, inner: 1, ik: 3 } },
    { id: 'needle', name: '觸角針尖', theme: 'ice', desc: '沿著左側觸角一路放大',
      params: { tx: -1.98554037165413, ty: 0, hx: -0.8, depth: 4.6, per: 150, t0: 0.21, rot: 0, style: 0, ramp: 5, g: 2.6 } },
    { id: 'overview', name: '全景彩帶', theme: 'rainbow', hue: true, desc: '整個集合緩緩旋轉，彩帶外流',
      params: { tx: -0.6, ty: 0, depth: 0.25, per: 40, t0: 0, rot: 0.05, style: 0, ramp: 2, g: 1.2, bk: 0.5, bv: 0.6, hu: 0, hs: 300, hv: 12, cut: 0.1, inner: 1, ik: 2 } },
    { id: 'contour', name: '等高線', theme: 'blueprint', desc: '逃逸時間畫成流動的地形線',
      params: { tx: -1.3710987654321, ty: 0.0100913580246914, hx: -0.6, depth: 1.4, per: 90, t0: 0.15, rot: 0.02, style: 1, lev: 6, bv: 0.35, hs: 0 } },
    { id: 'spiral', name: '雙螺旋', theme: 'sunset', desc: '雙臂螺旋在深處反覆出現',
      params: { tx: -0.761857430269776, ty: -0.0854337448559671, hx: -0.6, depth: 3.8, per: 140, t0: 0.19, rot: 0.025, ramp: 6, dk: 0.36, inner: 1, ik: 3, fk: 0.8, hk: 2 } },
  ],
  init(s, f) { escInit(s, f); },
  frame(s, f) {
    const p = f.p, v = tour(f, p, f.t);
    if (p.trap) { KA = 0; KB = 0; }
    escRender(s, f, p.trap ? kMandelTrap : p.style === 3 ? kMandelDE : kMandel, v.cx, v.cy, v.sc, p.rot * f.t, p.mi0 + p.mik * v.z, 1, f.aspect);
    shadeBy(s, f, p, v.sc);
  } });

/* ═════════════ 2. 朱利亞家族 ═════════════ */
function juliaC(p, t) {
  const w = p.w * t + p.ph;
  if (p.path === 1) {               // 沿主心形邊界走
    const r = p.r + p.rr * Math.sin(t * 0.21);
    return [r * (0.5 * Math.cos(w) - 0.25 * Math.cos(2 * w)), r * (0.5 * Math.sin(w) - 0.25 * Math.sin(2 * w))];
  }
  if (p.path === 2) return [p.ca + p.r * Math.cos(w), p.cb + p.r * Math.sin(w * 1.618)];   // 利薩如
  return [p.ca + p.r * Math.cos(w), p.cb + p.r * Math.sin(w)];
}
A({ id: 'fx-julia', name: '朱利亞家族', cat: '碎形', theme: 'lavender', desc: '道迪兔子緩緩扭動耳朵',
  params: Object.assign({}, SHADE, { d: 2, path: 0, ca: -0.123, cb: 0.745, r: 0.03, rr: 0, w: 0.22, ph: 0, w0: 3.3, fh: 2.5, zb: 0.08, rot: 0.02, r0: 0, mi: 120, g: 2.4, cut: 0.08, ramp: 0, fix: 0 }),
  variants: [
    { id: 'dendrite', name: '樹枝', theme: 'forest', desc: '細枝分岔的樹狀朱利亞集',
      params: { ca: 0, cb: 1, r: 0.045, w: 0.17, ramp: 5, style: 3, dk: 0.3, fk: 0.6, w0: 3.6, rot: -0.015 } },
    { id: 'cardioid', name: '心形環遊', theme: 'rainbow', hue: true, desc: '參數沿心形邊界巡迴，千變萬化',
      params: { path: 1, r: 0.985, rr: 0.012, w: 0.05, ph: 1.2, hu: 30, hs: 200, hv: 6, g: 2.2, ramp: 2, rot: 0 } },
    { id: 'sanmarco', name: '聖馬可', theme: 'amber', desc: '左右對稱的大教堂穹頂',
      params: { ca: -0.75, cb: 0, r: 0.06, w: 0.12, path: 2, ramp: 1, g: 2.4, rot: 0, w0: 3.8, fh: 1.9, bk: 0.35, bv: 0.4 } },
    { id: 'siegel', name: '西格爾圓盤', theme: 'mint', desc: '內部一圈圈不變曲線緩緩旋轉',
      params: { ca: -0.390540870218, cb: -0.586787907346, r: 0.0, w: 0, fix: 1, inner: 2, ik: 7, ramp: 0, g: 2, cut: 0.12, mi: 90, rot: 0.03 } },
    { id: 'cubic', name: '三次方', theme: 'ice', desc: 'z³+c 的雙臂旋渦',
      params: { d: 3, ca: 0, cb: 0, r: 0.56, w: 0.06, ramp: 0, g: 2.3, w0: 3.1, fh: 2.4, rot: 0.03 } },
    { id: 'quartic', name: '四次方', theme: 'sakura', desc: '三重對稱的花瓣迷宮',
      params: { d: 4, ca: 0, cb: 0, r: 0.7, w: 0.05, ramp: 6, g: 2.3, w0: 3.0, fh: 2.5, rot: -0.025 } },
    { id: 'quintic', name: '四臂星芒', theme: 'neon', hue: true, desc: '四臂對稱的星芒碎形',
      params: { d: 5, ca: 0, cb: 0, r: 0.76, w: 0.045, ramp: 1, g: 2.3, hu: 290, hs: 90, w0: 2.9, fh: 2.5, rot: 0.02, bk: 0.25, bv: 0.3 } },
    { id: 'dust', name: '法圖塵', theme: 'blood', desc: '碎裂成塵埃的不連通集合',
      params: { ca: 0.3, cb: 0.48, r: 0.05, w: 0.15, ramp: 3, style: 3, dk: 0.28, fk: 0.4, mi: 80, w0: 3.0 } },
  ],
  init(s, f) { escInit(s, f); },
  frame(s, f) {
    const p = f.p, t = f.t, c = juliaC(p, t);
    KA = c[0]; KB = c[1]; KN = p.d; KL = 1 / Math.log(p.d);
    if (p.fix) {   // 不動點 z* = (1 - √(1-4c)) / 2
      const ux = 1 - 4 * KA, uy = -4 * KB, r = Math.hypot(ux, uy), sx = Math.sqrt((r + ux) / 2), sy = (uy < 0 ? -1 : 1) * Math.sqrt((r - ux) / 2);
      KC = (1 - sx) / 2; KD = -sy / 2;
    } else { KC = 0; KD = 0; }
    const zm = 1 + p.zb * Math.sin(t * 0.09);
    const sc = Math.max(p.w0 / f.cols, p.fh / (f.rows * f.aspect)) / zm;
    escRender(s, f, kJulia, 0, 0, sc, p.rot * t + p.r0, p.mi, 0, f.aspect);
    shadeBy(s, f, p, sc);
  } });

/* ═════════════ 3. 燃燒船 ═════════════ */
A({ id: 'fx-ship', name: '燃燒船', cat: '碎形', theme: 'fire', desc: '烈焰中的帆船從遠景浮現',
  params: Object.assign({}, SHADE, { m: 0, julia: 0, tx: -1.7621, ty: -0.0281, hx: -0.45, hy: -0.5, w0: 3.5, fh: 2.4, depth: 1.6, per: 90, t0: 0.18, rot: 0, mi0: 60, mik: 40, ca: 0, cb: 0, r: 0, w: 0, g: 2.3, ramp: 0, blur: 0.45 }),
  variants: [
    { id: 'buffalo', name: '水牛', theme: 'gold', desc: '雙重絕對值的牛角輪廓',
      params: { m: 2, tx: -0.498864197530864, ty: 0.365588477366255, hx: -0.4, hy: -0.2, hk: 2, depth: 1.2, per: 80, t0: 0.1, rot: -0.015, ramp: 6, g: 2.2, inner: 4, ik: 2.5 } },
    { id: 'perp', name: '垂直船', theme: 'cyber', desc: '垂直變體的尖塔與裂谷',
      params: { m: 3, tx: -1.48251851851852, ty: -0.00306172839506173, hx: -0.6, hy: 0, depth: 1.4, per: 90, t0: 0.15, ramp: 0, g: 2, bk: 0.3, bv: 0.5 } },
    { id: 'julia', name: '船影朱利亞', theme: 'sunset', desc: '四重對稱的蕾絲朱利亞集緩緩變形',
      params: { julia: 1, ca: -0.6, cb: -0.8, r: 0.04, w: 0.11, hx: 0, hy: 0, tx: 0, ty: 0, depth: 0, w0: 3.0, fh: 2.4, rot: 0, mi0: 90, ramp: 2, g: 2.4, blur: 0.3, inner: 4, ik: 3 } },
    { id: 'embers', name: '餘燼', theme: 'blood', desc: '整艘船化為流動的條紋餘燼',
      params: { tx: -0.6, ty: -0.5, hx: -0.6, hy: -0.5, depth: 0.15, per: 40, rot: 0.03, bk: 0.6, bv: 0.7, cut: 0.12, ramp: 3, g: 1.2, blur: 0 } },
  ],
  init(s, f) { escInit(s, f); },
  frame(s, f) {
    const p = f.p, t = f.t;
    KM = p.m; KC = p.julia;
    if (p.julia) {
      KA = p.ca + p.r * Math.cos(p.w * t); KB = p.cb + p.r * 0.6 * Math.sin(p.w * t * 1.3);
      const sc = Math.max(p.w0 / f.cols, p.fh / (f.rows * f.aspect)) / (1 + 0.1 * Math.sin(t * 0.1));
      escRender(s, f, kShip, 0, 0, sc, 0, p.mi0, 0, f.aspect);
    } else {
      const v = tour(f, p, t);
      escRender(s, f, kShip, v.cx, v.cy, v.sc, p.rot * t, p.mi0 + p.mik * v.z, 1, f.aspect);
    }
    shadeBy(s, f, p);
  } });

/* ═════════════ 4. 多重曼德博 ═════════════ */
A({ id: 'fx-multi', name: '多重曼德博', cat: '碎形', theme: 'mint', desc: 'z³+c：雙瓣對稱的曼德博',
  params: Object.assign({}, SHADE, { d: 3, cj: 0, inv: 0, sh: 0, cx: 0, cy: 0, w0: 3.0, fh: 2.6, zb: 0.12, rot: 0.04, r0: 0, mi: 110, g: 1.5, ramp: 0, bin: 0 }),
  variants: [
    { id: 'tricorn', name: '三角獸', theme: 'blood', desc: '取共軛的三角形曼德博',
      params: { d: 2, cj: 1, cx: -0.3, w0: 3.6, fh: 3.2, ramp: 1, g: 1.4, rot: -0.03 } },
    { id: 'quartic', name: '四次方', theme: 'gold', desc: '三瓣輪生的四次集合',
      params: { d: 4, w0: 2.9, fh: 2.6, ramp: 6, rot: 0.035 } },
    { id: 'quintic', name: '五次方', theme: 'sakura', desc: '四瓣十字形的五次集合',
      params: { d: 5, w0: 2.8, fh: 2.6, ramp: 2, rot: -0.04, bk: 0.3, bv: 0.4 } },
    { id: 'mosaic', name: '六次馬賽克', theme: 'cyber', desc: '二元分解拼出五瓣馬賽克',
      params: { d: 6, w0: 2.8, fh: 2.6, bin: 1, ramp: 7, rot: 0.03, g: 1.1, cut: 0.08 } },
    { id: 'multicorn', name: '多角獸', theme: 'synth', hue: true, desc: '共軛三次方的四角星形',
      params: { d: 3, cj: 1, w0: 3.0, fh: 2.6, ramp: 0, hu: 300, hs: 140, hv: 5, rot: -0.025 } },
    { id: 'inverse', name: '反演', theme: 'ice', desc: '把集合翻到外面的 1/c 平面',
      params: { d: 2, inv: 1, sh: -0.25, cx: 0.55, w0: 3.4, fh: 2.7, ramp: 5, g: 1.3, rot: 0.02, inner: 1, ik: 2 } },
  ],
  init(s, f) { escInit(s, f); },
  frame(s, f) {
    const p = f.p, t = f.t;
    KN = p.d; KM = p.cj; KC = p.inv; KD = p.sh; KL = 1 / Math.log(p.d);
    const sc = Math.max(p.w0 / f.cols, p.fh / (f.rows * f.aspect)) / (1 + p.zb * Math.sin(t * 0.08));
    escRender(s, f, kMulti, p.cx, p.cy, sc, p.rot * t + p.r0, p.mi, 1, f.aspect);
    if (p.bin) {
      shadeEsc(s, f, p);
      const g = f.g, ch = g.ch, ea = s.ea, n = g.n;
      for (let i = 0; i < n; i++) if (ch[i] !== ' ' && s.ev[i] >= 0 && ea[i] > 0.5) { ch[i] = ch[i] === '.' ? ' ' : '░'; }
    } else shadeBy(s, f, p);
  } });

/* ═════════════ 5. 牛頓碎形 ═════════════ */
const ROOTCH = ['o', '+', 'x', '*', '=', '#', '%', '@'];
A({ id: 'fx-newton', name: '牛頓碎形', cat: '碎形', theme: 'rainbow', hue: true, desc: 'z³−1 三個根的吸引盆交織',
  params: { n: 3, a: 1, aa: 0, mv: 0, nova: 0, nr: 0, w0: 3.4, fh: 2.6, zb: 0.25, rot: 0.03, mi: 40, g: 1.2, hu: 0, hv: 4, mark: 0, edge: 0 },
  variants: [
    { id: 'four', name: '四根', theme: 'neon', desc: 'z⁴−1 的十字花窗',
      params: { n: 4, rot: -0.025, mark: 1, w0: 3.2 } },
    { id: 'five', name: '五根', theme: 'synth', desc: 'z⁵−1 五瓣交界的珠鍊',
      params: { n: 5, rot: 0.02, w0: 2.8, g: 1.5 } },
    { id: 'relax', name: '鬆弛', theme: 'ocean', hue: true, desc: '鬆弛係數擺動，盆界開出新花',
      params: { n: 3, aa: 0.45, rot: 0, w0: 3.0, mi: 60, g: 1.3, hu: 180 } },
    { id: 'edge', name: '盆界線', theme: 'mono', desc: '只畫吸引盆的交界線',
      params: { n: 6, edge: 1, rot: 0.03, w0: 3.0, zb: 0.4 } },
  ],
  init(s, f) { escInit(s, f); },
  frame(s, f) {
    const p = f.p, t = f.t, n = p.n;
    KN = n; KA = p.a + p.aa * Math.sin(t * 0.25); KM = p.nova;
    if (p.nova) { KB = p.nr * Math.cos(t * 0.13) - 0.05; KC = p.nr * Math.sin(t * 0.17); }
    for (let k = 0; k < n; k++) {
      let a = (k / n) * TAU, r = 1;
      if (p.mv) { a += Math.sin(t * (0.11 + k * 0.037) + k * 2) * 1.1; r = 0.8 + 0.6 * Math.sin(t * (0.09 + k * 0.023) + k); }
      RX[k] = r * Math.cos(a); RY[k] = r * Math.sin(a);
    }
    const sc = Math.max(p.w0 / f.cols, p.fh / (f.rows * f.aspect)) / (1 + p.zb * Math.sin(t * 0.07));
    escRender(s, f, kNewton, 0, 0, sc, p.rot * t, p.mi, p.aa || p.mv || p.nova ? 0 : 1, f.aspect);
    escEq(s, f);
    const g = f.g, cols = f.cols, rows = f.rows, ch = g.ch, co = g.co, ev = s.ev, ea = s.ea, lv = s.lv, c = s.cdf, H = f.H;
    const gt = gamT(s, p.g), R = RAMPS[0], h0 = p.hu + t * p.hv, hn = 360 / n;
    for (let y = 0, i = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++, i++) {
        const l = lv[i], k = ea[i];
        if (l < 0) { ch[i] = '#'; co[i] = f.C(0.25); continue; }
        if (p.edge) {
          const kr = x + 1 < cols ? ea[i + 1] : k, kd = y + 1 < rows ? ea[i + cols] : k;
          if (kr === k && kd === k) {
            if (((x + y * 3) % 11) === 0) { ch[i] = '.'; co[i] = H(h0 + k * hn, 0.2); }
            continue;
          }
          const b = l | 0, E = c[b] + (c[b + 1] - c[b]) * (l - b);
          ch[i] = kr !== k && kd !== k ? '+' : kr !== k ? '|' : '-'; co[i] = H(h0 + k * hn, 0.45 + 0.55 * E);
          continue;
        }
        const b = l | 0, E = c[b] + (c[b + 1] - c[b]) * (l - b), e = gt[(E * 256) | 0];
        const lit = 0.16 + 0.84 * e * (p.mv || p.edge ? 1 : 0.75 + 0.25 * ((k / Math.max(1, n - 1)) || 0));
        ch[i] = p.mark && e < 0.35 ? ROOTCH[k & 7] : R[1 + Math.min(8, (e * 9) | 0)];
        co[i] = H(h0 + k * hn + E * 25, lit);
      }
    }
  } });

/* ═════════════ 6. 鳳凰碎形 ═════════════ */
A({ id: 'fx-phoenix', name: '鳳凰碎形', cat: '碎形', theme: 'fire', desc: '展翅的鳳凰在火光中呼吸',
  params: Object.assign({}, SHADE, { d: 2, mand: 0, ca: 0.5667, cb: 0, pa: -0.5, pb: 0, ra: 0.02, rp: 0.04, w: 0.13, w0: 3.3, fh: 1.75, cx: 0, cy: 0, zb: 0.06, rot: 0, r0: Math.PI / 2, mi: 110, g: 2.2, ramp: 0, emb: 0, blur: 0.3 }),
  variants: [
    { id: 'cubic', name: '三次鳳凰', theme: 'gold', desc: '三次方版本的雙鳳對望',
      params: { d: 3, ca: 0.2, pa: 0.5, ra: 0.05, rp: 0.05, w0: 3.0, fh: 2.4, r0: 0, ramp: 6, mi: 90, inner: 2, ik: 3 } },
    { id: 'plane', name: '參數平面', theme: 'ice', desc: '鳳凰公式的曼德博式全景',
      params: { mand: 1, pa: -0.5, rp: 0.08, w: 0.1, ra: 0, cx: 0.05, w0: 3.0, fh: 2.6, r0: 0, rot: 0.02, ramp: 5, g: 2.2 } },
    { id: 'emboss', name: '浮雕', theme: 'paper', desc: '光從左上打下的浮雕鳳凰',
      params: { emb: 1, ramp: 0, rp: 0.06, g: 1 } },
    { id: 'feather', name: '羽紋', theme: 'amber', desc: '流動條紋描出每一根羽毛',
      params: { bk: 0.7, bv: 0.5, ramp: 3, g: 1.0, cut: 0.1, rp: 0.03 } },
  ],
  init(s, f) { escInit(s, f); },
  frame(s, f) {
    const p = f.p, t = f.t, w = p.w * t;
    KN = p.d; KM = p.mand; KL = 1 / Math.log(p.d);
    KA = p.ca + p.ra * Math.sin(w * 0.7); KD = p.cb;
    KB = p.pa + p.rp * Math.sin(w); KC = p.pb + p.rp * 0.5 * Math.cos(w * 1.3);
    const sc = Math.max(p.w0 / f.cols, p.fh / (f.rows * f.aspect)) / (1 + p.zb * Math.sin(t * 0.1));
    escRender(s, f, kPhoenix, p.cx, p.cy, sc, p.r0 + p.rot * t, p.mi, 0, f.aspect);
    if (!p.emb) { shadeBy(s, f, p); return; }
    // 浮雕：用等化值的梯度打光
    escEq(s, f);
    const { g, cols, rows, C } = f, ch = g.ch, co = g.co, lv = s.lv, c = s.cdf, n = cols * rows, q = s.ev;
    for (let i = 0; i < n; i++) { const l = lv[i]; if (l < 0) { q[i] = 1.2; continue; } const b = l | 0; q[i] = c[b] + (c[b + 1] - c[b]) * (l - b); }
    const R = ' .:-=+*#%@';
    for (let y = 0, i = 0; y < rows; y++) {   // 每一格都處理，邊緣用自己代替超出範圍的鄰格（不會留下一圈空白框）
      for (let x = 0; x < cols; x++, i++) {
        const v = q[i];
        if (v > 1.1) { ch[i] = '@'; co[i] = C(0.95); continue; }
        const gx = (x < cols - 1 ? q[i + 1] : v) - (x > 0 ? q[i - 1] : v), gy = (y < rows - 1 ? q[i + cols] : v) - (y > 0 ? q[i - cols] : v);
        const e = clamp(0.25 + v * 0.35 + (gx + gy * 0.8) * 2.2, 0, 1);
        if (e < 0.08) continue;
        ch[i] = R[Math.min(9, (e * 10) | 0)]; co[i] = C(0.15 + 0.85 * e);
      }
    }
  } });

/* ═════════════ 7. 李亞普諾夫 ═════════════ */
A({ id: 'fx-lyap', name: '李亞普諾夫', cat: '碎形', theme: 'gold', desc: '鋯石城：AB 序列交織的金色尖塔',
  params: { seq: 'BBBBBBAAAAAA', ax: 3.4, ay: 2.5, bx: 4.0, by: 3.4, drift: 0.06, zoom: 0.35, rot: 0, N: 60, ls: 3, ramp: 0, hu: 45, hs: 30, h2: 220, dots: 1 },
  variants: [
    { id: 'swallow', name: '燕子', theme: 'amber', desc: '經典 AB 序列的燕尾形狀',
      params: { seq: 'AB', ax: 2.0, ay: 2.0, bx: 4.0, by: 4.0, zoom: 0.25, ramp: 1, dots: 0 } },
    { id: 'aabab', name: '尖塔', theme: 'ice', desc: 'AABAB 序列刺出冰晶尖塔',
      params: { seq: 'AABAB', ax: 2.5, ay: 2.5, bx: 4.0, by: 4.0, zoom: 0.3, ramp: 5, hu: 190, h2: 260 } },
    { id: 'bbaba', name: '水母', theme: 'ocean', desc: 'BBABA 序列漂浮的水母群',
      params: { seq: 'BBABA', ax: 2.5, ay: 2.5, bx: 4.0, by: 4.0, zoom: 0.4, ramp: 6, hu: 200, h2: 240, dots: 0 } },
    { id: 'zoom', name: '深入', theme: 'sunset', desc: '鑽進鋯石城尖塔之間的縫隙',
      params: { ax: 3.45, ay: 2.55, bx: 3.75, by: 3.0, zoom: 0.6, drift: 0.12, rot: 0.02, ramp: 3, N: 80 } },
    { id: 'aaab', name: '刀鋒', theme: 'blood', desc: 'AAAB 序列的鋒利刀刃',
      params: { seq: 'AAAB', ax: 2.5, ay: 2.5, bx: 4.0, by: 4.0, zoom: 0.35, ramp: 7, hu: 0, h2: 280 } },
  ],
  init(s, f) { escInit(s, f); },
  frame(s, f) {
    const p = f.p, t = f.t;
    SEQN = Math.min(64, p.seq.length);
    for (let i = 0; i < SEQN; i++) SEQ[i] = p.seq[i] === 'B' ? 1 : 0;
    // 視窗在區域內緩慢漂移與呼吸；b 軸朝上
    const W = p.bx - p.ax, Hh = p.by - p.ay, z = 1 + p.zoom * (0.5 - 0.5 * Math.cos(t * 0.05));
    // 視窗中心限制在區域內，畫面不會漂出有效範圍（0.5～4）而留下空白邊
    const mw = 0.5 - 0.5 / z, cx = p.ax + W * (0.5 + clamp(p.drift * Math.sin(t * 0.031), -mw, mw)), cy = p.ay + Hh * (0.5 + clamp(p.drift * Math.sin(t * 0.023 + 1), -mw, mw));
    const sc = W / f.cols / z, asp = -(Hh / f.rows) / (W / f.cols);
    escRender(s, f, kLyap, cx, cy, sc, p.rot * Math.sin(t * 0.05), p.N, 1, asp);
    const g = f.g, ch = g.ch, co = g.co, ev = s.ev, n = g.n, H = f.H, R = RAMPS[p.ramp], RL = R.length - 1, ls = p.ls;
    const ph = t * 0.5, cols = f.cols, rows = f.rows, L = s.lv, T = s.q, B = s.eb;
    // λ 先截在 −2..1，再做 3×3 平均：孤立的穩定格（雜點）會被周圍的混沌格稀釋掉，混沌區也變成平滑的淡紋
    for (let i = 0; i < n; i++) { const v = ev[i]; L[i] = v > 2 ? 9 : v < -2 ? -2 : v > 1 ? 1 : v; }
    const Tf = s.tf || (s.tf = new Float32Array(n));
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const c = L[i], l = x > 0 && L[i - 1] < 5 ? L[i - 1] : c, r = x < cols - 1 && L[i + 1] < 5 ? L[i + 1] : c;
      Tf[i] = c < 5 ? (l + c + r) / 3 : 9;
    }
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const c = Tf[i], u = y > 0 && Tf[i - cols] < 5 ? Tf[i - cols] : c, d = y < rows - 1 && Tf[i + cols] < 5 ? Tf[i + cols] : c;
      B[i] = c < 5 ? (u + c + d) / 3 : 9;
    }
    for (let i = 0; i < n; i++) {
      const lam = L[i], lb = B[i];
      if (lam > 5) continue;
      if (lam < -0.015 && lb < -0.03) {
        const m = 0.5 * (lam + lb), d = 1 - Math.exp(m * ls), e = 0.3 + 0.7 * d;
        ch[i] = R[Math.min(RL, 1 + ((e * RL) | 0))];
        co[i] = H(p.hu + p.hs * Math.sin(m * 2 + ph), 0.15 + 0.85 * e * (0.85 + 0.15 * Math.sin(m * 9 - ph * 2)));
      } else if (p.dots && lb > 0.02) {   // 混沌區：依 λ 大小畫很淡的 ' .:'
        const k = Math.min(1, lb * 1.6);
        ch[i] = k > 0.55 ? ':' : '.'; co[i] = H(p.h2, 0.08 + 0.16 * k);
      }
    }
  } });

/* ═════════════ 點字畫布與密度累積 ═════════════
   點字字元每格 2×4 點（點幾乎是正方形），用來畫細線與點雲。 */
const BRB = [1, 2, 4, 64, 8, 16, 32, 128];
const BRCH = [];
for (let k = 0; k < 256; k++) BRCH.push(k ? String.fromCharCode(0x2800 + k) : ' ');
const BOXR = [' ', '╵', '╶', '╰', '╷', '│', '╭', '├', '╴', '╯', '─', '┴', '╮', '┤', '┬', '┼'];   // 位元：1 上 2 右 4 下 8 左
const BOXS = [' ', '╵', '╶', '└', '╷', '│', '┌', '├', '╴', '┘', '─', '┴', '┐', '┤', '┬', '┼'];
const BOXD = [' ', '║', '═', '╚', '║', '║', '╔', '╠', '═', '╝', '═', '╩', '╗', '╣', '╦', '╬'];
// 簡單可重現的亂數
function mkRand(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function dotInit(s, f) {
  const n = f.cols * f.rows;
  s.DW = f.cols * 2; s.DH = f.rows * 4;
  s.dm = new Uint8Array(n); s.dv = new Float32Array(n); s.dhu = new Float32Array(n);
}
function dotClear(s) { s.dm.fill(0); s.dv.fill(0); }
function dotSet(s, cols, x, y, v, h) {
  if (x < 0 || y < 0 || x >= s.DW || y >= s.DH) return;
  x |= 0; y |= 0;
  const i = (y >> 2) * cols + (x >> 1);
  s.dm[i] |= BRB[((x & 1) << 2) | (y & 3)];
  if (v >= s.dv[i]) { s.dv[i] = v; s.dhu[i] = h; }
}
function dotLine(s, cols, x0, y0, x1, y1, v, h) {
  const dx = x1 - x0, dy = y1 - y0, ax = dx < 0 ? -dx : dx, ay = dy < 0 ? -dy : dy;
  const n = Math.ceil(ax > ay ? ax : ay) || 1;
  if (n > 3000) return;
  const ix = dx / n, iy = dy / n;
  for (let k = 0; k <= n; k++) dotSet(s, cols, x0 + ix * k, y0 + iy * k, v, h);
}
function dotCircle(s, cols, cx, cy, r, v, h) {
  const n = Math.max(8, Math.ceil(r * 7.5));
  const da = TAU / n, c = Math.cos(da), sn = Math.sin(da);
  let x = r, y = 0;
  for (let k = 0; k < n; k++) { dotSet(s, cols, cx + x, cy + y, v, h); const nx = x * c - y * sn; y = x * sn + y * c; x = nx; }
}
function dotFlush(f, s) {
  const g = f.g, ch = g.ch, co = g.co, n = g.n, dm = s.dm, dv = s.dv, dh = s.dhu, H = f.H;
  for (let i = 0; i < n; i++) { const m = dm[i]; if (!m) continue; ch[i] = BRCH[m]; co[i] = H(dh[i], dv[i]); }
}
// 密度累積（以點為單位），衰減後再輸出成點字或字元濃淡
function accInit(s, f) {
  s.DW = f.cols * 2; s.DH = f.rows * 4;
  s.acc = new Float32Array(s.DW * s.DH); s.ach = new Float32Array(s.DW * s.DH);
  s.amax = 1;
}
function accDecay(s, k) { if (k < 0.9999) { const a = s.acc; for (let i = 0; i < a.length; i++) a[i] *= k; } }
function accFlush(f, s, mode, R, lift, thr) {
  const { g, cols, rows, H } = f, ch = g.ch, co = g.co, acc = s.acc, ach = s.ach, DW = s.DW;
  const RL = R ? R.length - 1 : 0;
  let mx = 0;
  const lm = 1 / Math.log(1 + s.amax);
  for (let cy = 0, i = 0; cy < rows; cy++) {
    const r0 = cy * 4 * DW;
    for (let cx = 0; cx < cols; cx++, i++) {
      const d = r0 + cx * 2;
      let sum = 0, m = 0, best = 0, bh = 0;
      for (let dy = 0; dy < 4; dy++) {
        const q = d + dy * DW, a = acc[q], b = acc[q + 1];
        sum += a + b;
        if (a > thr) { m |= BRB[dy]; if (a > best) { best = a; bh = ach[q]; } }
        if (b > thr) { m |= BRB[4 + dy]; if (b > best) { best = b; bh = ach[q + 1]; } }
      }
      if (sum > mx) mx = sum;
      if (sum < thr) continue;
      const e = Math.min(1, Math.log(1 + sum) * lm);
      if (mode === 0) { if (!m) continue; ch[i] = BRCH[m]; }
      else { const k = 1 + ((e * RL) | 0); ch[i] = R[k > RL ? RL : k]; }
      co[i] = H(bh, lift + (1 - lift) * e);
    }
  }
  s.amax += (Math.max(4, mx) - s.amax) * 0.1;
}
// 把正規化座標（約 -1..1）轉成點座標：fit=1 撐滿全螢幕，fit=0 保持比例
function normMap(s, fit, mx, my) {
  if (fit) return [s.DW * mx, s.DH * my];
  const r = Math.min(s.DW * mx, s.DH * my);
  return [r, r];
}

/* ═════════════ 8. 混沌遊戲 ═════════════ */
function chaosVerts(p, ang) {
  const v = [];
  if (p.shape === 1) { // 正方形四角 + 邊中點
    v.push([-1, -1], [1, -1], [1, 1], [-1, 1]);
    if (p.mids) v.push([0, -1], [1, 0], [0, 1], [-1, 0]);
  } else if (p.shape === 2) { // 寬三角形（底邊撐滿）
    v.push([0, -1], [1, 1], [-1, 1]);
  } else {
    for (let k = 0; k < p.nv; k++) { const a = -Math.PI / 2 + (k * TAU) / p.nv + ang; v.push([Math.cos(a), Math.sin(a)]); }
    if (p.mids) for (let k = 0; k < p.nv; k++) { const a = v[k], b = v[(k + 1) % p.nv]; v.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
  }
  if (p.center) v.push([0, 0]);
  if (p.shape === 1 && ang) for (const q of v) { const x = q[0], y = q[1], c = Math.cos(ang), sn = Math.sin(ang); q[0] = x * c - y * sn; q[1] = x * sn + y * c; }
  return v;
}
A({ id: 'fx-chaos', name: '混沌遊戲', cat: '碎形', theme: 'mint', desc: '隨機跳半步，慢慢拼出謝爾賓斯基三角',
  params: { thr: 0.35, shape: 2, nv: 3, jf: 0.5, rule: 0, center: 0, mids: 0, fit: 1, spin: 0, jv: 0, decay: 0, style: 0, cyc: 28, rate: 250000, hs: 120, h0: 140, flip: 0 },
  variants: [
    { id: 'carpet', name: '地毯', theme: 'amber', desc: '八個點各跳三分之二，織出謝爾賓斯基地毯',
      params: { shape: 1, mids: 1, jf: 2 / 3, hs: 45, h0: 30 } },
    { id: 'vicsek', name: '十字雪花', theme: 'ice', desc: '四角加中心，長出維克塞克十字',
      params: { shape: 1, center: 1, jf: 2 / 3, hs: 60, h0: 190, fit: 0 } },
    { id: 'penta', name: '五角花', theme: 'sakura', desc: '五邊形黃金比例跳躍成五瓣花窗',
      params: { shape: 0, nv: 5, jf: 0.618, fit: 0, hs: 72, h0: 320 } },
    { id: 'norepeat', name: '不連跳', theme: 'neon', desc: '不准連跳同一角，正方形長出星芒',
      params: { shape: 1, rule: 1, jf: 0.5, hs: 90, h0: 280 } },
    { id: 'noneighbor', name: '避開鄰角', theme: 'gold', desc: '不准跳到右鄰，生成旋轉風車',
      params: { shape: 1, rule: 2, jf: 0.5, hs: 90, h0: 40, fit: 0 } },
    { id: 'hexa', name: '六角雪', theme: 'lavender', desc: '六角加中心，三分之二步拼出六角雪花',
      params: { shape: 0, nv: 6, center: 1, jf: 2 / 3, fit: 0, hs: 60, h0: 250 } },
    { id: 'morph', name: '步長漸變', theme: 'rainbow', hue: true, desc: '跳躍比例與方向不停變化，三角在呼吸',
      params: { shape: 0, nv: 3, jf: 0.5, jv: 0.12, spin: 0.15, decay: 3.5, fit: 0, rate: 400000, hs: 120, h0: 0, style: 1 } },
    { id: 'cloud', name: '雲霧五邊', theme: 'ocean', desc: '五邊形不准連跳，濃淡字元像雲霧',
      params: { shape: 0, nv: 5, rule: 1, jf: 0.5, fit: 0, style: 1, hs: 40, h0: 200 } },
  ],
  init(s, f) {
    accInit(s, f);
    s.px = 0; s.py = 0; s.prev = 0; s.ct = 0; s.ang = 0; s.cycN = 0;
    s.vs = chaosVerts(f.p, 0); s.trail = [];
  },
  frame(s, f) {
    const p = f.p, dt = f.dt, DW = s.DW, DH = s.DH, cols = f.cols;
    s.ct += dt;
    let rate, fade = 0;
    if (p.decay) { rate = p.rate; accDecay(s, Math.exp(-dt * p.decay)); }
    else {
      const ct = s.ct;
      rate = ct < 2.5 ? 12 + ct * 30 : p.rate * Math.min(1, ((ct - 2.5) / 5) ** 2) + 200;
      if (ct > p.cyc - 3) { fade = 1; rate = 0; accDecay(s, Math.exp(-dt * 2.2)); }
      if (ct > p.cyc) {
        s.ct = 0; s.cycN++; s.acc.fill(0); s.amax = 1;
        s.ang = p.shape === 1 ? (s.cycN % 4) * (Math.PI / 2) : s.cycN % 2 ? Math.PI / p.nv : 0;
        s.vs = chaosVerts(p, s.ang);
      }
    }
    if (p.spin) s.vs = chaosVerts(p, f.t * p.spin);
    const vs = s.vs, nv = vs.length, jf = p.jf + p.jv * Math.sin(f.t * 0.23), rule = p.rule, acc = s.acc, ach = s.ach;
    const [sx, sy] = normMap(s, p.fit, 0.47, 0.46), ox = DW / 2, oy = DH / 2, hs = p.hs, h0 = p.h0;
    let px = s.px, py = s.py, prev = s.prev, cnt = Math.floor(rate * dt * (s.ct < 2.5 && !p.decay ? 1 : (DW * DH) / 225280));
    const slow = cnt < 60 && !fade;
    const tr = s.trail;
    if (slow) tr.length = 0;
    for (let k = 0; k < cnt; k++) {
      let j = (Math.random() * nv) | 0;
      if (rule === 1) { while (j === prev) j = (Math.random() * nv) | 0; }
      else if (rule === 2) { while (j === (prev + 1) % nv) j = (Math.random() * nv) | 0; }
      const v = vs[j];
      px += (v[0] - px) * jf; py += (v[1] - py) * jf;
      prev = j;
      const X = ox + px * sx, Y = oy + py * sy;
      if (X >= 0 && Y >= 0 && X < DW && Y < DH) { const q = (Y | 0) * DW + (X | 0); acc[q] += 1; ach[q] = h0 + j * hs; }
      if (slow && k > cnt - 6) tr.push(X, Y, ox + v[0] * sx, oy + v[1] * sy);
    }
    s.px = px; s.py = py; s.prev = prev;
    accFlush(f, s, p.style, RAMPS[0], 0.3, p.thr);
    if (slow && tr.length) {   // 剛開始一點一點跳的時候，畫出「往頂點跳半步」的虛線
      const g = f.g;
      for (let k = 0; k < tr.length; k += 4) {
        const n = 10;
        for (let q = 1; q < n; q += 2) g.set((tr[k] + (tr[k + 2] - tr[k]) * q / n) / 2, (tr[k + 1] + (tr[k + 3] - tr[k + 1]) * q / n) / 4, '·', f.C(0.45));
        g.set(tr[k] / 2, tr[k + 1] / 4, '●', f.C(1));
      }
    }
    // 頂點標記
    if (!p.decay && s.ct < 6) for (const v of vs) f.g.set((ox + v[0] * sx) / 2, (oy + v[1] * sy) / 4, '◆', f.C(0.9));
  } });

/* ═════════════ 9. 迭代花園（IFS） ═════════════ */
const IFS = {
  fern: [[0, 0, 0, 0.16, 0, 0, 0.01], [0.85, 0.04, -0.04, 0.85, 0, 1.6, 0.85], [0.2, -0.26, 0.23, 0.22, 0, 1.6, 0.07], [-0.15, 0.28, 0.26, 0.24, 0, 0.44, 0.07]],
  mutant: [[0, 0, 0, 0.25, 0, -0.4, 0.02], [0.95, 0.005, -0.005, 0.93, -0.002, 0.5, 0.84], [0.035, -0.2, 0.16, 0.04, -0.09, 0.02, 0.07], [-0.04, 0.2, 0.16, 0.04, 0.083, 0.12, 0.07]],
  tree: [[0, 0, 0, 0.5, 0, 0, 0.05], [0.42, -0.42, 0.42, 0.42, 0, 0.2, 0.4], [0.42, 0.42, -0.42, 0.42, 0, 0.2, 0.4], [0.1, 0, 0, 0.1, 0, 0.2, 0.15]],
  maple: [[0.14, 0.01, 0, 0.51, -0.08, -1.31, 0.1], [0.43, 0.52, -0.45, 0.5, 1.49, -0.75, 0.35], [0.45, -0.49, 0.47, 0.47, -1.62, -0.74, 0.35], [0.49, 0, 0, 0.51, 0.02, 1.62, 0.2]],
  spiral: [[0.787879, -0.424242, 0.242424, 0.859848, 1.758647, 1.408065, 0.9], [-0.121212, 0.257576, 0.151515, 0.05303, -6.721654, 1.377236, 0.05], [0.181818, -0.136364, 0.090909, 0.181818, 6.086107, 1.568035, 0.05]],
  crystal: [[0.69697, -0.481061, -0.393939, -0.662879, 2.147003, 10.310288, 0.75], [0.090909, -0.443182, 0.515152, -0.094697, 4.286558, 2.925762, 0.25]],
  coral: [[0.307692, -0.531469, -0.461538, -0.293706, 5.401953, 8.655175, 0.4], [0.307692, -0.076923, 0.153846, -0.447552, -1.295248, 4.15299, 0.15], [0, 0.545455, 0.692308, -0.195804, -4.893637, 7.269794, 0.45]],
  dragon: [[0.824074, 0.281482, -0.212346, 0.864198, -1.88229, -0.110607, 0.787473], [0.088272, 0.520988, -0.463889, -0.377778, 0.78536, 8.095795, 0.212527]],
};
A({ id: 'fx-ifs', name: '迭代花園', cat: '碎形', theme: 'forest', desc: '三株巴恩斯利蕨一點一點長出，隨風輕擺',
  params: { ifs: 'fern', copies: 3, base: 1, sway: 0.18, ws: 0.55, pts: 60000, style: 0, hmode: 1, h0: 90, hs: 60, spin: 0, breathe: 0, cyc: 50 },
  variants: [
    { id: 'mutant', name: '突變蕨', theme: 'mint', desc: '細長彎垂的突變蕨葉',
      params: { ifs: 'mutant', copies: 4, sway: 0.15, h0: 150 } },
    { id: 'tree', name: '樅樹', theme: 'ice', desc: '分枝對稱的小樹林在風中搖',
      params: { ifs: 'tree', copies: 3, sway: 0.22, ws: 0.8, hmode: 0, hs: 50, h0: 180 } },
    { id: 'maple', name: '楓葉', theme: 'sunset', hue: true, desc: '四個變換拼出楓葉，字元濃淡',
      params: { ifs: 'maple', copies: 2, base: 0, sway: 0.08, breathe: 0.04, style: 1, hmode: 0, hs: 25, h0: 5 } },
    { id: 'spiral', name: '螺旋', theme: 'lavender', desc: '一條主臂捲出層層小螺旋',
      params: { ifs: 'spiral', copies: 1, base: 0, sway: 0.05, spin: 0.06, hmode: 0, hs: 120, h0: 260 } },
    { id: 'crystal', name: '冰晶', theme: 'blueprint', desc: '兩個變換折出鋸齒冰晶',
      params: { ifs: 'crystal', copies: 2, base: 0, sway: 0.06, breathe: 0.05, hmode: 0, hs: 80, h0: 200 } },
    { id: 'coral', name: '珊瑚', theme: 'ocean', hue: true, desc: '三向分岔的珊瑚礁在水流中搖',
      params: { ifs: 'coral', copies: 3, base: 1, sway: 0.2, ws: 0.4, hmode: 1, h0: 350, hs: 40, style: 1 } },
    { id: 'dragon', name: '捲龍', theme: 'fire', desc: '兩個變換捲成的火龍',
      params: { ifs: 'dragon', copies: 1, base: 0, sway: 0.05, spin: -0.05, hmode: 0, hs: 50, h0: 20 } },
  ],
  // 先算一大團固定的點雲（吸引子），每格只做彎曲／旋轉變形再畫上去：畫面穩定、隨風擺動
  init(s, f) {
    dotInit(s, f);
    const p = f.p, T = IFS[p.ifs] || IFS.fern, nt = T.length, cum = [];
    let c = 0;
    for (const m of T) { c += m[6]; cum.push(c); }
    const N = clamp(Math.round((p.pts * s.DW * s.DH) / 225280), 12000, 70000);   // 上限：5K 大畫面不會每格變換太多點
    s.N = N; s.X = new Float32Array(N); s.Y = new Float32Array(N); s.K = new Uint8Array(N);
    let x = 0, y = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = -40; i < N; i++) {
      const r = Math.random() * c;
      let k = 0;
      while (k < nt - 1 && r > cum[k]) k++;
      const m = T[k], nx = m[0] * x + m[1] * y + m[4];
      y = m[2] * x + m[3] * y + m[5]; x = nx;
      if (i < 0) continue;
      s.X[i] = x; s.Y[i] = y; s.K[i] = k;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    s.bb = [x0, x1, y0, y1];
    s.cnt = new Float32Array(f.cols * f.rows);
    s.ct = 0; s.lay = 0;
    this.layout(s, f);
  },
  layout(s, f) {
    const p = f.p, [x0, x1, y0, y1] = s.bb;
    const n = Math.max(1, Math.min(p.copies, Math.round((s.DW / s.DH) * 1.6 * (p.copies / 3)) || 1));
    s.cp = [];
    for (let c = 0; c < n; c++) {
      // 植物允許樹冠互相交疊（寬度上限放寬），讓高度決定大小、長滿整個畫面
      const sz = n === 1 ? 1 : rnd(0.8, 1), slot = s.DW / n;
      const sc = Math.min((s.DH * (p.base ? 0.95 : 0.9)) / (y1 - y0), (slot * (n === 1 ? 0.92 : p.base ? 1.8 : 1.12)) / (x1 - x0)) * sz;
      s.cp.push({ sc, cx: slot * (c + 0.5) + (n > 1 ? rnd(-0.07, 0.07) * slot : 0), mir: n > 1 && (c + s.lay) % 2 ? -1 : 1, ph: rnd(0, TAU) });
    }
  },
  frame(s, f) {
    const p = f.p, t = f.t, cols = f.cols, DW = s.DW, DH = s.DH, X = s.X, Y = s.Y, K = s.K, dm = s.dm, cnt = s.cnt, dh = s.dhu;
    const [x0, x1, y0, y1] = s.bb, mxc = (x0 + x1) / 2, myc = (y0 + y1) / 2, ih = 1 / (y1 - y0);
    s.ct += f.dt;
    if (s.ct > p.cyc) { s.ct = 0; s.lay++; this.layout(s, f); }
    // 生長：一開始一點一點冒出來，週期尾端縮回去
    const ct = s.ct, gr = ct < 1.5 ? (ct / 1.5) * 0.004 : ct < 8 ? 0.004 + 0.996 * SM((ct - 1.5) / 6.5) : ct > p.cyc - 3 ? SM((p.cyc - ct) / 3) : 1;
    const use = Math.floor(s.N * gr);
    dm.fill(0); cnt.fill(0);
    for (const c of s.cp) {
      const wind = Math.sin(t * p.ws + c.ph) + 0.35 * Math.sin(t * p.ws * 2.7 + c.ph * 1.3);
      const sc = c.sc, mir = c.mir, cx = c.cx;
      if (p.base) {   // 植物：越高越彎
        const B = p.sway * wind, by = DH * 0.985;
        for (let i = 0; i < use; i++) {
          const u = (Y[i] - y0) * ih, bx = X[i] - mxc + B * u * u * (y1 - y0);
          const px = cx + bx * sc * mir, py = by - (Y[i] - y0) * sc * (1 - 0.02 * B * u);
          if (px < 0 || py < 0 || px >= DW || py >= DH) continue;
          const xi = px | 0, yi = py | 0, ci = (yi >> 2) * cols + (xi >> 1);
          dm[ci] |= BRB[((xi & 1) << 2) | (yi & 3)]; cnt[ci]++;
          dh[ci] = p.hmode ? p.h0 + u * p.hs : p.h0 + K[i] * p.hs;
        }
      } else {        // 其他形狀：輕輕旋轉、呼吸
        const a = p.sway * wind + p.spin * t, ca = Math.cos(a), sa = Math.sin(a), z = sc * (1 + p.breathe * Math.sin(t * 0.4 + c.ph));
        for (let i = 0; i < use; i++) {
          const ux = (X[i] - mxc) * mir, uy = Y[i] - myc;
          const px = cx + (ux * ca - uy * sa) * z, py = DH / 2 - (ux * sa + uy * ca) * z;
          if (px < 0 || py < 0 || px >= DW || py >= DH) continue;
          const xi = px | 0, yi = py | 0, ci = (yi >> 2) * cols + (xi >> 1);
          dm[ci] |= BRB[((xi & 1) << 2) | (yi & 3)]; cnt[ci]++;
          dh[ci] = p.hmode ? p.h0 + (Y[i] - y0) * ih * p.hs : p.h0 + K[i] * p.hs;
        }
      }
    }
    // 依密度上色：點字（或字元濃淡）
    const g = f.g, ch = g.ch, co = g.co, n = g.n, H = f.H, R = RAMPS[1], RL = R.length - 1;
    let mx = 1;
    for (let i = 0; i < n; i++) if (cnt[i] > mx) mx = cnt[i];
    const lm = 1 / Math.log(1 + mx * 0.6);
    for (let i = 0; i < n; i++) {
      if (!dm[i]) continue;
      const e = Math.min(1, Math.log(1 + cnt[i]) * lm);
      if (p.style) { const k = 1 + ((e * RL) | 0); ch[i] = R[k > RL ? RL : k]; } else ch[i] = BRCH[dm[i]];
      co[i] = H(dh[i], 0.3 + 0.7 * e);
    }
  } });

/* ═════════════ 折線替換引擎（科赫、萊維、三龍…） ═════════════
   每一段 AB 換成生成器：一串「相對於 AB 的方向角」的單位步；s=0..1 時角度按比例放大，
   再把整串旋轉縮放到 AB 上，所以每一層可以從直線平滑地長出下一層。 */
const D2R = Math.PI / 180;
function genPts(ang, s, sign, out) {
  const m = ang.length, px = out.x, py = out.y;
  let x = 0, y = 0;
  px[0] = 0; py[0] = 0;
  for (let j = 0; j < m; j++) { const a = ang[j] * s * sign * D2R; x += Math.cos(a); y += Math.sin(a); px[j + 1] = x; py[j + 1] = y; }
  const d = x * x + y * y || 1;
  for (let j = 0; j <= m; j++) { const ax = px[j], ay = py[j]; px[j] = (ax * x + ay * y) / d; py[j] = (ay * x - ax * y) / d; }
}
function refine(src, n, dst, gp, gm, m, alt, sg) {
  let k = 0;
  for (let i = 0; i < n - 1; i++) {
    const ax = src[2 * i], ay = src[2 * i + 1], vx = src[2 * i + 2] - ax, vy = src[2 * i + 3] - ay;
    const neg = alt === 1 ? i & 1 : alt === 2 ? sg[i] : 0;
    const X = neg ? gm.x : gp.x, Y = neg ? gm.y : gp.y;
    for (let j = 0; j < m; j++) { dst[k++] = ax + X[j] * vx - Y[j] * vy; dst[k++] = ay + X[j] * vy + Y[j] * vx; }
  }
  dst[k++] = src[2 * n - 2]; dst[k++] = src[2 * n - 1];
  return k >> 1;
}
// 建立各層快取：L0 = 起始折線
function buildLevels(start, ang, Lmax, alt, signs) {
  const m = ang.length, gp = { x: new Float64Array(m + 1), y: new Float64Array(m + 1) }, gm = { x: new Float64Array(m + 1), y: new Float64Array(m + 1) };
  genPts(ang, 1, 1, gp); genPts(ang, 1, -1, gm);
  const lv = [{ P: Float64Array.from(start), n: start.length / 2 }];
  for (let L = 0; L < Lmax; L++) {
    const a = lv[L], dst = new Float64Array(((a.n - 1) * m + 1) * 2);
    lv.push({ P: dst, n: refine(a.P, a.n, dst, gp, gm, m, alt, signs && signs[L]) });
  }
  return lv;
}
// 層級動畫：往上一層一層長，到頂停住，再一層層收回
function lvlStep(st, dt, Lmax, tm, th, top, bottom, Lmin) {
  Lmin = Lmin || 0;
  if (st.hold > 0) { st.hold -= dt; return; }
  st.u += dt / (st.dir > 0 ? tm : tm * 0.55);
  if (st.u < 1) return;
  st.u = 0;
  if (st.dir > 0) { st.L++; st.hold = th; if (st.L >= Lmax) { st.L = Lmax; st.dir = -1; st.hold = top; } }
  else { st.L--; st.hold = th * 0.4; if (st.L <= Lmin) { st.L = Lmin; st.dir = 1; st.hold = bottom; } }
}
// 目前要顯示的折線（必要時做一次平滑替換）
function lvlShape(s, st, lv, ang, alt, signs, sOver) {
  if (st.hold > 0 || (st.dir > 0 && st.L >= lv.length - 1)) return lv[st.L];
  const base = st.dir > 0 ? st.L : st.L - 1, u = st.dir > 0 ? st.u : 1 - st.u, a = lv[base];
  const m = ang.length;
  if (!s.gp || s.gp.x.length !== m + 1) { s.gp = { x: new Float64Array(m + 1), y: new Float64Array(m + 1) }; s.gm = { x: new Float64Array(m + 1), y: new Float64Array(m + 1) }; }
  const sv = sOver !== undefined ? sOver : SM(u);
  genPts(ang, sv, 1, s.gp); genPts(ang, sv, -1, s.gm);
  const need = ((a.n - 1) * m + 1) * 2;
  if (!s.tmp || s.tmp.length < need) s.tmp = new Float64Array(need);
  return { P: s.tmp, n: refine(a.P, a.n, s.tmp, s.gp, s.gm, m, alt, signs && signs[base]) };
}
// 攝影機：平滑地把折線框進畫面（點座標，縱向乘 2/aspect）
// rot：畫的時候會旋轉的角度，外框用旋轉後的點來量，轉起來也不會出界
function camFit(s, f, P, n, margin, rate, rot) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
  for (let i = 0; i < n; i++) { const px = P[2 * i], py = P[2 * i + 1], x = px * cr - py * sr, y = px * sr + py * cr; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const ya = 2 / f.aspect, S = Math.min((s.DW * margin) / (x1 - x0 || 1e-9), (s.DH * margin) / (((y1 - y0) || 1e-9) * ya));
  const rx = (x0 + x1) / 2, ry = (y0 + y1) / 2, cx = rx * cr + ry * sr, cy = ry * cr - rx * sr;
  if (!s.cam) s.cam = { S, cx, cy };
  else { const k = 1 - Math.exp(-f.dt * rate); s.cam.S += (S - s.cam.S) * k; s.cam.cx += (cx - s.cam.cx) * k; s.cam.cy += (cy - s.cam.cy) * k; }
  s.cam.ya = ya;
}
// 畫折線（點字），色相沿著折線漸變；wave>0 時亮度有流動的光
function drawPoly(s, f, P, n, h0, hs, v0, v1, wave, cam, rot) {
  const cols = f.cols, S = cam.S, ya = cam.ya, cx = cam.cx, cy = cam.cy, ox = s.DW / 2, oy = s.DH / 2, t = f.t;
  const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
  let px = 0, py = 0;
  for (let i = 0; i < n; i++) {
    const wx = P[2 * i] - cx, wy = P[2 * i + 1] - cy;
    const X = ox + (wx * cr - wy * sr) * S, Y = oy + (wx * sr + wy * cr) * S * ya;
    if (i) {
      // wave>0：亮度整條是流動的光；wave<0：沿線漸亮，再疊上一道流過去的光
      const u = i / n, v = wave > 0 ? v0 + (v1 - v0) * (0.5 + 0.5 * Math.sin(u * wave - t * 1.5)) : wave < 0 ? v0 + (v1 - v0) * (0.55 * u + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(-u * wave - t * 1.5), 3)) : v0 + (v1 - v0) * u;
      dotLine(s, cols, px, py, X, Y, v, h0 + hs * u);
    }
    px = X; py = Y;
  }
}

/* ═════════════ 10. 龍形曲線 ═════════════ */
A({ id: 'fx-dragon', name: '龍形曲線', cat: '碎形', theme: 'fire', desc: '紙條一折再折，攤開成海威龍',
  params: { mode: 0, copies: 1, fold: 90, Kmax: 13, tm: 1.3, th: 0.5, top: 7, h0: 10, hs: 50, ang: [45, -45], alt: 1 },
  variants: [
    { id: 'twin', name: '雙龍', theme: 'synth', hue: true, desc: '背對背的兩條龍拼成雙龍',
      params: { copies: 2, h0: 280, hs: 120, Kmax: 12 } },
    { id: 'four', name: '四龍', theme: 'rainbow', hue: true, desc: '四條龍繞著同一點鋪滿平面',
      params: { copies: 4, h0: 0, hs: 90, Kmax: 11 } },
    { id: 'levy', name: '萊維C', theme: 'gold', desc: '每段長出直角尖帽的萊維 C 曲線',
      params: { mode: 1, ang: [45, -45], alt: 0, Kmax: 12, h0: 40, hs: 30 } },
    { id: 'ter', name: '三龍', theme: 'ice', desc: '一段換三段，扭成三角龍',
      params: { mode: 1, ang: [30, -90, 30], alt: 0, Kmax: 7, h0: 190, hs: 60 } },
    { id: 'box', name: '方塊龍', theme: 'matrix', desc: '格線上的龍一筆一筆畫出來',
      params: { mode: 2, Kmax: 12, h0: 120, hs: 40 } },
    { id: 'angle', name: '變角摺紙', theme: 'lavender', desc: '每輪換一個摺角，攤出不同的曲線',
      params: { fold: 72, Kmax: 12, h0: 260, hs: 80 } },
  ],
  init(s, f) {
    dotInit(s, f);
    const p = f.p;
    s.cyc = 0; s.cam = null;
    if (p.mode === 0) {
      const K = p.Kmax, cap = (1 << K) + 1;
      s.P = new Float64Array(cap * 2); s.Q = new Float64Array(cap * 2 * Math.max(1, p.copies));
      s.P[0] = 0; s.P[1] = 0; s.P[2] = 1; s.P[3] = 0; s.n = 2; s.k = 0; s.u = 0; s.dir = 1; s.hold = 0.5; s.fa = p.fold;
      for (; s.k < 4; s.k++) this.unfold(s, s.fa);
    } else if (p.mode === 1) {
      s.lv = buildLevels([0, 0, 1, 0], p.ang, p.Kmax, p.alt, null);
      s.st = { L: 2, u: 0, dir: 1, hold: 0.6 };
    } else {
      // 方塊龍：在格線上找最大的層數，依序畫出每一段
      const lx = Math.floor((f.cols - 2) / 2), ly = f.rows - 2;
      let K = p.Kmax, pts;
      for (; K >= 4; K--) {
        pts = [[0, 0], [1, 0]];
        for (let k = 0; k < K; k++) { const [px, py] = pts[pts.length - 1]; for (let i = pts.length - 2; i >= 0; i--) { const dx = pts[i][0] - px, dy = pts[i][1] - py; pts.push([px - dy, py + dx]); } }
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 - x0 <= lx && y1 - y0 <= ly) { s.box = { pts, x0: Math.floor((f.cols - (x1 - x0) * 2) / 2) - x0 * 2, y0: Math.floor((f.rows - (y1 - y0)) / 2) - y0 }; break; }
      }
      s.mask = new Uint8Array(f.cols * f.rows); s.age = new Float32Array(f.cols * f.rows); s.head = 0; s.ph = 2.6;
    }
  },
  frame(s, f) {
    const p = f.p, dt = f.dt, cols = f.cols;
    if (p.mode === 2) return this.boxFrame(s, f);
    dotClear(s);
    if (p.mode === 1) {
      lvlStep(s.st, dt, p.Kmax, p.tm * 1.2, p.th, p.top, 1.5, 2);
      const sh = lvlShape(s, s.st, s.lv, p.ang, p.alt, null), rot = 0.07 * Math.sin(f.t * 0.12);   // 輕輕擺動＋流光，停住的時候也在動
      camFit(s, f, sh.P, sh.n, 0.86, 2.5, rot);
      drawPoly(s, f, sh.P, sh.n, p.h0, p.hs, 0.45, 1, -6, s.cam, rot);
      dotFlush(f, s);
      return;
    }
    // 摺紙：把整條曲線以終點為軸旋轉 θ 複製一份，θ 從 0 慢慢轉到摺角
    if (s.hold > 0) s.hold -= dt;
    else {
      s.u += dt / (s.dir > 0 ? p.tm : p.tm * 0.5);
      if (s.u >= 1) {
        s.u = 0;
        if (s.dir > 0) {
          this.unfold(s, s.fa);
          s.k++; s.hold = p.th;
          if (s.k >= p.Kmax) { s.dir = -1; s.hold = p.top; }
        } else {
          s.n = (s.n + 1) >> 1; s.k--; s.hold = p.th * 0.3;
          if (s.k <= 3) { s.dir = 1; s.hold = 1.2; s.cyc++; if (p.fold !== 90) { s.fa = [72, 60, 100, 120, 80][s.cyc % 5]; s.n = 2; for (s.k = 0; s.k < 3; s.k++) this.unfold(s, s.fa); } }
        }
      }
    }
    // 組出要顯示的點列
    const P = s.P, n = s.n, Q = s.Q;
    let m = n;
    Q.set(P.subarray(0, n * 2));
    if (s.hold <= 0 && (s.dir > 0 ? s.k < p.Kmax : s.k > 3)) {
      if (s.dir > 0) {
        const th = s.fa * D2R * SM(s.u), c = Math.cos(th), sn = Math.sin(th), ax = P[2 * n - 2], ay = P[2 * n - 1];
        for (let i = n - 2; i >= 0; i--) { const dx = P[2 * i] - ax, dy = P[2 * i + 1] - ay; Q[2 * m] = ax + dx * c - dy * sn; Q[2 * m + 1] = ay + dx * sn + dy * c; m++; }
      } else {
        // 收回：後半段繞中點轉回去
        const h = (n + 1) >> 1, th = s.fa * D2R * (1 - SM(s.u)), c = Math.cos(th), sn = Math.sin(th), ax = P[2 * h - 2], ay = P[2 * h - 1];
        m = h;
        for (let i = h - 2; i >= 0; i--) { const dx = P[2 * i] - ax, dy = P[2 * i + 1] - ay; Q[2 * m] = ax + dx * c - dy * sn; Q[2 * m + 1] = ay + dx * sn + dy * c; m++; }
      }
    }
    // 多條龍：繞原點旋轉複製
    const cp = p.copies;
    if (cp > 1) for (let c = 1; c < cp; c++) { const a = (c * TAU) / cp, ca = Math.cos(a), sa = Math.sin(a); for (let i = 0; i < m; i++) { const x = Q[2 * i], y = Q[2 * i + 1]; Q[2 * (c * m + i)] = x * ca - y * sa; Q[2 * (c * m + i) + 1] = x * sa + y * ca; } }
    const rot = 0.07 * Math.sin(f.t * 0.12);
    camFit(s, f, Q, m * cp, 0.88, 2, rot);
    const tot = (1 << p.Kmax) + 1;
    for (let c = 0; c < cp; c++) {
      const sub = Q.subarray(c * m * 2, (c + 1) * m * 2);
      drawPoly(s, f, sub, m, p.h0 + (c * 360) / cp * (cp > 1 ? 0.5 : 0), (p.hs * m) / tot, 0.4, 1, -6, s.cam, rot);
    }
    dotFlush(f, s);
  },
  unfold(s, deg) {
    const P = s.P, n = s.n, ax = P[2 * n - 2], ay = P[2 * n - 1], th = deg * D2R, c = Math.cos(th), sn = Math.sin(th);
    let m = n;
    for (let i = n - 2; i >= 0; i--) { const dx = P[2 * i] - ax, dy = P[2 * i + 1] - ay; P[2 * m] = ax + dx * c - dy * sn; P[2 * m + 1] = ay + dx * sn + dy * c; m++; }
    s.n = m;
  },
  boxFrame(s, f) {
    const p = f.p, g = f.g, cols = f.cols, B = s.box;
    if (!B) return;
    const pts = B.pts, N = pts.length - 1, mask = s.mask, age = s.age, H = f.H;
    // 畫筆速度：約 26 秒畫完，停 4 秒，再 6 秒擦掉
    const T = 26, ph = (s.ph += f.dt) ;
    const draw = Math.min(N, Math.floor((ph / T) * N));
    const erase = ph > T + 4 ? Math.min(N, Math.floor(((ph - T - 4) / 6) * N)) : 0;
    if (ph > T + 10.5) { s.ph = T * 0.1; for (const q of pts) { const x = q[0]; q[0] = -q[1]; q[1] = x; } this.recenter(s, f); }
    mask.fill(0);
    const put = (x, y, b, i) => { if (x < 0 || y < 0 || x >= cols || y >= f.rows) return; const c = y * cols + x; mask[c] |= b; age[c] = i; };
    for (let i = erase; i < draw; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const X0 = B.x0 + ax * 2, Y0 = B.y0 + ay, X1 = B.x0 + bx * 2, Y1 = B.y0 + by;
      if (Y0 === Y1) { const lx = Math.min(X0, X1); put(lx, Y0, 2, i); put(lx + 1, Y0, 10, i); put(lx + 2, Y0, 8, i); }
      else { const ty = Math.min(Y0, Y1); put(X0, ty, 4, i); put(X0, ty + 1, 1, i); }
    }
    const n = g.n, ch = g.ch, co = g.co;
    for (let i = 0; i < n; i++) {
      const m = mask[i];
      if (!m) continue;
      const a = age[i], fresh = Math.max(0, 1 - (draw - a) / (N * 0.15)), pulse = 0.3 * Math.pow(0.5 + 0.5 * Math.sin((a / N) * 26 - f.t * 2.2), 8);
      ch[i] = BOXR[m]; co[i] = H(p.h0 + (a / N) * p.hs, Math.min(1, 0.33 + 0.42 * (a / N) + 0.2 * fresh + pulse));
    }
    if (draw > erase && draw < N) { const [hx, hy] = pts[draw]; g.set(B.x0 + hx * 2, B.y0 + hy, '█', f.C(1)); }
  },
  recenter(s, f) {
    const pts = s.box.pts;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if ((x1 - x0) * 2 > f.cols - 2 || y1 - y0 > f.rows - 2) { for (const q of pts) { const x = q[0]; q[0] = -q[1]; q[1] = x; } return this.recenter(s, f); }
    s.box.x0 = Math.floor((f.cols - (x1 - x0) * 2) / 2) - x0 * 2; s.box.y0 = Math.floor((f.rows - (y1 - y0)) / 2) - y0;
  } });

/* ═════════════ 11. 科赫雪花 ═════════════ */
function polyStart(kind) {
  if (kind === 1) return [-1, -1, 1, -1, 1, 1, -1, 1, -1, -1];      // 正方形（順時針，螢幕座標）
  if (kind === 2) return [-1.6, 0, 1.6, 0];                         // 一條橫線
  const r = 1, a0 = -Math.PI / 2, P = [];
  for (let k = 0; k <= 3; k++) { const a = a0 + (k * TAU) / 3; P.push(r * Math.cos(a), r * Math.sin(a)); }
  return P;
}
A({ id: 'fx-koch', name: '科赫雪花', cat: '碎形', theme: 'ice', desc: '三角形每邊長出尖角，一層層變成雪花',
  params: { start: 0, ang: [0, -60, 60, 0], Lmax: 5, tm: 1.6, th: 0.6, top: 6, rot: 0.05, h0: 190, hs: 40, mode: 0, fill: 0, sweep: 0 },
  variants: [
    { id: 'anti', name: '反雪花', theme: 'lavender', desc: '尖角往內長，成了反雪花',
      params: { ang: [0, 60, -60, 0], h0: 260, rot: -0.04 } },
    { id: 'island', name: '方形島', theme: 'ocean', desc: '八段生成器長出四方海岸線',
      params: { start: 1, ang: [0, 90, 0, -90, -90, 0, 90, 0], Lmax: 3, h0: 200, hs: 60, tm: 2 } },
    { id: 'cesaro', name: '撕裂方塊', theme: 'blood', desc: '85 度切口把正方形撕成碎布',
      params: { start: 1, ang: [0, 85, -85, 0], Lmax: 5, h0: 0, hs: 20, rot: 0.03 } },
    { id: 'sweep', name: '角度掃描', theme: 'neon', hue: true, desc: '尖角角度不停改變，雪花在變形',
      params: { mode: 1, Lmax: 4, h0: 280, hs: 160, rot: 0.06 } },
    { id: 'filled', name: '冰花填色', theme: 'mint', desc: '雪花內部填滿字元，像一片冰花',
      params: { fill: 1, h0: 150, hs: 30, rot: 0.04 } },
    { id: 'flurry', name: '雪花群', theme: 'mono', desc: '大小不一的科赫雪花緩緩飄落',
      params: { mode: 2, h0: 0, hs: 0 } },
    { id: 'ridge', name: '山稜', theme: 'sunset', desc: '隨機凹凸的科赫山脈層層疊疊',
      params: { mode: 3, Lmax: 5, h0: 20, hs: 30 } },
  ],
  init(s, f) {
    dotInit(s, f);
    const p = f.p;
    s.cam = null;
    if (p.mode === 0) { s.lv = buildLevels(polyStart(p.start), p.ang, p.Lmax, 0, null); s.st = { L: 0, u: 0, dir: 1, hold: 1.2 }; }
    else if (p.mode === 1) { s.lv = null; }
    else if (p.mode === 2) {
      // 預先算好單位雪花的 0..4 層
      s.lv = buildLevels(polyStart(0), [0, -60, 60, 0], 4, 0, null);
      const n = clamp(Math.round((f.cols * f.rows) / 900), 6, 26);
      s.fl = Array.from({ length: n }, () => this.flake(s, f, true));
    } else {
      // 三層山稜，每層的凹凸方向隨機
      s.ridges = [0, 1, 2].map(k => {
        const signs = [];
        for (let L = 0, n = 1; L < p.Lmax; L++, n *= 4) signs.push(Uint8Array.from({ length: n }, () => (L > 0 && Math.random() < 0.35 ? 1 : 0)));
        return { lv: buildLevels([0, 0, 1, 0], [0, -60, 60, 0], p.Lmax, 2, signs), signs, st: { L: 0, u: 0, dir: 1, hold: 0.5 + k * 1.3 }, k };
      });
      s.top = new Float32Array(f.cols);
      // 天空的星星（只出現在最遠的山稜上方）
      s.stars = Array.from({ length: Math.round((f.cols * f.rows) / 70) }, () => ({ x: rnd(0, f.cols), y: rnd(0, f.rows * 0.6), ph: rnd(0, TAU), sp: rnd(0.4, 1.6), b: rnd(0.3, 1) }));
    }
  },
  flake(s, f, first) {
    const sz = rnd(0.06, 0.2) * f.rows * 4;
    return { x: rnd(0, s.DW), y: first ? rnd(0, s.DH) : -sz, sz, a: rnd(0, TAU), w: rnd(-0.4, 0.4), v: rnd(3, 9) * (sz / 30), L: rint(1, 4), u: rnd(0, 1), sway: rnd(0, TAU), b: rnd(0.45, 1) };
  },
  frame(s, f) {
    const p = f.p, dt = f.dt, t = f.t, cols = f.cols;
    dotClear(s);
    if (p.mode === 0) {
      lvlStep(s.st, dt, p.Lmax, p.tm, p.th, p.top, 1.5);
      const sh = lvlShape(s, s.st, s.lv, p.ang, 0, null);
      camFit(s, f, sh.P, sh.n, 0.84, 3);
      drawPoly(s, f, sh.P, sh.n, p.h0, p.hs, 0.75, 1, 6, s.cam, p.rot * t);
      dotFlush(f, s);
      if (p.fill) this.fillPoly(s, f, sh.P, sh.n, p.rot * t);
      return;
    }
    if (p.mode === 1) {
      // 固定 4 層，尖角角度在 15°～88° 之間擺動
      const a = 52 + 36 * Math.sin(t * 0.25), ang = [0, -a, a, 0];
      s.lv = buildLevels(polyStart(0), ang, p.Lmax, 0, null);
      const sh = s.lv[p.Lmax];
      camFit(s, f, sh.P, sh.n, 0.84, 3);
      drawPoly(s, f, sh.P, sh.n, p.h0 + t * 8, p.hs, 0.5, 1, 9, s.cam, p.rot * t);
      dotFlush(f, s);
      return;
    }
    if (p.mode === 2) {
      // 雪花群：每片雪花各自旋轉、飄落、偶爾換層數
      const ya = 2 / f.aspect;
      for (let k = 0; k < s.fl.length; k++) {
        const q = s.fl[k];
        q.y += q.v * dt; q.x += Math.sin(t * 0.5 + q.sway) * dt * 3; q.a += q.w * dt; q.u += dt * 0.08;
        if (q.u > 1) { q.u = 0; q.L = (q.L % 4) + 1; }
        if (q.y - q.sz > s.DH) { s.fl[k] = this.flake(s, f, false); continue; }
        const lv = s.lv[q.L], P = lv.P, n = lv.n, ca = Math.cos(q.a), sa = Math.sin(q.a);
        let px = 0, py = 0;
        for (let i = 0; i < n; i++) {
          const x = P[2 * i], y = P[2 * i + 1], X = q.x + (x * ca - y * sa) * q.sz, Y = q.y + (x * sa + y * ca) * q.sz * ya;
          if (i) dotLine(s, cols, px, py, X, Y, q.b, 0);
          px = X; py = Y;
        }
      }
      dotFlush(f, s);
      return;
    }
    this.ridgeFrame(s, f);
  },
  ridgeFrame(s, f) {
    const p = f.p, g = f.g, cols = f.cols, rows = f.rows, H = f.H, top = s.top;
    const RS = ' .:-=+*#', t = f.t;
    // 閃爍的星星，往左慢慢漂
    for (const st of s.stars) {
      const x = ((st.x - t * 0.12) % cols + cols) % cols, w = 0.5 + 0.5 * Math.sin(t * st.sp + st.ph);
      g.set(x, st.y, st.b > 0.9 && w > 0.8 ? '*' : w > 0.5 ? '·' : '.', H(p.h0 + 200, (0.12 + 0.4 * w) * st.b));
    }
    for (let r = s.ridges.length - 1; r >= 0; r--) {
      const R = s.ridges[r];
      lvlStep(R.st, f.dt, p.Lmax, p.tm * 1.4, p.th, p.top + 4, 2);
      if (R.st.L > 0) R.fresh = false;
      else if (R.st.dir > 0 && !R.fresh) { // 每次重新長之前換一套地形
        R.fresh = true;
        R.signs.forEach((sg, L) => { for (let i = 0; i < sg.length; i++) sg[i] = L > 0 && Math.random() < 0.35 ? 1 : 0; });
        R.lv = buildLevels([0, 0, 1, 0], [0, -60, 60, 0], p.Lmax, 2, R.signs);
      }
      const sh = lvlShape(s, R.st, R.lv, [0, -60, 60, 0], 2, R.signs);
      // 第 r 層：越遠越高、越暗
      const base = rows * (0.5 + 0.17 * (2 - r)), amp = rows * 0.55, W = s.DW;
      // 視差：越近的山稜往左捲得越快（科赫折線兩端等高，可以無縫接成兩段）
      const off = fract(t * (0.0035 + 0.0032 * (2 - r))), shc = Math.round((off * (W + 4)) / 2);
      top.fill(1e9);
      const P = sh.P, n = sh.n;
      for (let rep = 0; rep < 2; rep++) {
        let px = 0, py = 0;
        for (let i = 0; i < n; i++) {
          const X = (P[2 * i] - off + rep) * (W + 4) - 2, Y = (base + P[2 * i + 1] * amp) * 4;
          if (i) {
            dotLine(s, cols, px, py, X, Y, 0.55 + 0.15 * (2 - r), p.h0 + r * 25);
            const steps = Math.ceil(Math.abs(X - px)) + 1;
            for (let k = 0; k <= steps; k++) { const xx = px + ((X - px) * k) / steps, yy = py + ((Y - py) * k) / steps, c = Math.floor(xx / 2); if (c >= 0 && c < cols && yy / 4 < top[c]) top[c] = yy / 4; }
          }
          px = X; py = Y;
        }
      }
      // 山體：稜線以下填字元，越往下越暗
      for (let x = 0; x < cols; x++) {
        const y0 = Math.ceil(top[x] + 0.6);
        for (let y = Math.max(0, y0); y < rows; y++) {
          const i = y * cols + x, d = (y - top[x]) / rows;
          s.dm[i] = 0;
          const e = (0.55 - d * 0.6 + ((Math.imul(y * 4099 + x + shc, 2654435761) >>> 24) / 255 - 0.5) * 0.12) * (0.5 + 0.25 * (2 - r));
          if (e < 0.05) { g.ch[i] = ' '; continue; }
          g.ch[i] = RS[Math.min(RS.length - 1, 1 + ((e * 6) | 0))]; g.co[i] = H(p.h0 + 300 + r * 20, 0.12 + e * 0.5);
        }
      }
    }
    dotFlush(f, s);
  },
  // 雪花內部填色（偶奇規則掃描線）
  fillPoly(s, f, P, n, rot) {
    const { g, cols, rows } = f, cam = s.cam, H = f.H, p = f.p;
    const xs = s.xs || (s.xs = new Float32Array(4096));
    const cr = Math.cos(rot), sr = Math.sin(rot), ox = s.DW / 2, oy = s.DH / 2;
    if (!s.fx || s.fx.length < n * 2) s.fx = new Float32Array(n * 2 + 16);
    const SX = s.fx;
    for (let i = 0; i < n; i++) { const wx = P[2 * i] - cam.cx, wy = P[2 * i + 1] - cam.cy; SX[2 * i] = (ox + (wx * cr - wy * sr) * cam.S) / 2; SX[2 * i + 1] = (oy + (wx * sr + wy * cr) * cam.S * cam.ya) / 4; }
    const R = ' .·:;+*';
    for (let y = 0; y < rows; y++) {
      const yc = y + 0.5;
      let m = 0;
      for (let i = 0; i < n - 1 && m < 4090; i++) {
        const y0 = SX[2 * i + 1], y1 = SX[2 * i + 3];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs[m++] = SX[2 * i] + ((yc - y0) / (y1 - y0)) * (SX[2 * i + 2] - SX[2 * i]);
      }
      const arr = xs.subarray(0, m).sort();
      for (let k = 0; k + 1 < m; k += 2) {
        for (let x = Math.ceil(arr[k]); x < arr[k + 1] && x < cols; x++) {
          if (x < 0) continue;
          const i = y * cols + x;
          if (g.ch[i] !== ' ') continue;
          const d = Math.min(x - arr[k], arr[k + 1] - x) / 6;
          const e = clamp(0.2 + 0.5 * Math.sin(d - f.t * 0.8) * 0.5 + 0.25, 0.1, 0.8);
          g.ch[i] = R[1 + ((e * 5.9) | 0)]; g.co[i] = H(p.h0 + 20, 0.18 + 0.35 * e);
        }
      }
    }
  } });


/* ═════════════ 12. L 系統植物 ═════════════
   文法展開成字串後編譯成「線段樹」：每段記住父段、相對轉角、離根幾段。
   每格重新算角度（加上風），所以整株植物會自然彎曲；生長＝只畫離根較近的線段。 */
const LSYS = {
  plant: { ax: 'X', r: { X: ['F+[[X]-X]-F[-FX]+X'], F: ['FF'] }, a: 25, n: 5 },
  bush: { ax: 'F', r: { F: ['FF+[+F-F-F]-[-F+F+F]'] }, a: 22.5, n: 4 },
  weed: { ax: 'F', r: { F: ['F[+F]F[-F]F'] }, a: 25.7, n: 4 },
  tree: { ax: 'X', r: { X: ['F[+X][-X]FX'], F: ['FF'] }, a: 24, n: 6 },
  stick: { ax: 'X', r: { X: ['F[+X]F[-X]+X'], F: ['FF'] }, a: 20, n: 6 },
  coral: { ax: 'F', r: { F: ['F[+F]F[-F][F]'] }, a: 20, n: 4 },
  rand: { ax: 'F', r: { F: ['F[+F]F[-F]F', 'F[+F]F', 'F[-F]F', 'F[+F][-F]F'] }, a: 26, n: 4 },
};
function lsCompile(def, rand, maxSeg) {
  let s = def.ax;
  for (let k = 0; k < def.n; k++) {
    let o = '';
    for (const c of s) { const r = def.r[c]; o += r ? r[r.length > 1 ? (rand() * r.length) | 0 : 0] : c; if (o.length > 120000) break; }
    s = o;
  }
  const par = [], turn = [], dep = [];
  const st = [];
  let cur = -1, acc = 0, d = 0;
  const A = def.a * D2R;
  for (const c of s) {
    if (c === 'F') {
      if (par.length >= maxSeg) break;
      par.push(cur); turn.push(acc + (rand() - 0.5) * 0.12); dep.push(d);
      cur = par.length - 1; acc = 0; d++;
    } else if (c === '+') acc += A;
    else if (c === '-') acc -= A;
    else if (c === '[') st.push(cur, acc, d);
    else if (c === ']') { d = st.pop(); acc = st.pop(); cur = st.pop(); }
  }
  const n = par.length, desc = new Float32Array(n), tip = new Uint8Array(n).fill(1);
  for (let i = n - 1; i >= 0; i--) { desc[i] += 1; if (par[i] >= 0) { desc[par[i]] += desc[i]; tip[par[i]] = 0; } }
  let md = 1;
  for (let i = 0; i < n; i++) if (dep[i] > md) md = dep[i];
  return { n, par: Int32Array.from(par), turn: Float32Array.from(turn), dep: Float32Array.from(dep), desc, tip, md };
}
// 計算靜止姿態的外框（以線段長 1 為單位，y 朝上）
function lsBox(T) {
  const n = T.n, ang = new Float32Array(n), ex = new Float32Array(n), ey = new Float32Array(n);
  let x0 = 0, x1 = 0, y1 = 0;
  for (let i = 0; i < n; i++) {
    const q = T.par[i], a = (q >= 0 ? ang[q] : Math.PI / 2) + T.turn[i], sx = q >= 0 ? ex[q] : 0, sy = q >= 0 ? ey[q] : 0;
    ang[i] = a; ex[i] = sx + Math.cos(a); ey[i] = sy + Math.sin(a);
    if (ex[i] < x0) x0 = ex[i]; if (ex[i] > x1) x1 = ex[i]; if (ey[i] > y1) y1 = ey[i];
  }
  return { x0, x1, y1: Math.max(1, y1) };
}
A({ id: 'fx-lsys', name: 'L系統植物', cat: '碎形', theme: 'forest', desc: '經典 L 系統蕨草從土裡長出，隨風搖擺',
  params: { g: 'plant', mix: '', copies: 3, amp: 0.35, ws: 0.7, wk: 1.2, h0: 30, hs: 90, leaf: '', lf: 1, petals: 0, cyc: 42, grow: 9, thick: 1, maxSeg: 9000, snow: 0 },
  variants: [
    { id: 'bush', name: '灌木叢', theme: 'gold', desc: '層層分岔的灌木在金色光裡晃動',
      params: { g: 'bush', copies: 3, amp: 0.25, h0: 40, hs: 30 } },
    { id: 'weed', name: '海草', theme: 'ocean', desc: '海草在水流中大幅擺盪',
      params: { g: 'weed', copies: 5, amp: 0.7, ws: 0.45, wk: 0.6, h0: 160, hs: 40, thick: 0 } },
    { id: 'blossom', name: '櫻花樹', theme: 'sakura', hue: true, desc: '枝頭開滿櫻花，花瓣隨風飄落',
      params: { g: 'tree', copies: 2, amp: 0.18, ws: 0.5, h0: 20, hs: 10, leaf: '✿*·', petals: 1, maxSeg: 7000 } },
    { id: 'meadow', name: '草原', theme: 'toxic', desc: '一整片高矮不一的小草迎風起伏',
      params: { g: 'weed', mix: 'weed,plant,stick,rand', copies: 11, amp: 0.45, ws: 0.9, wk: 2.5, h0: 70, hs: 50, maxSeg: 2500, thick: 0 } },
    { id: 'random', name: '隨機生長', theme: 'mint', desc: '隨機文法每輪長出不同的植物',
      params: { g: 'rand', copies: 3, amp: 0.3, h0: 120, hs: 60, leaf: '•', lf: 0.5 } },
    { id: 'coral', name: '珊瑚礁', theme: 'blood', desc: '珊瑚枝在暗流中慢慢晃動',
      params: { g: 'coral', copies: 4, amp: 0.25, ws: 0.35, h0: 350, hs: 40, leaf: 'o', lf: 0.3 } },
    { id: 'winter', name: '冬枝', theme: 'mono', desc: '光禿的枝椏與飄雪',
      params: { g: 'stick', copies: 3, amp: 0.12, ws: 0.4, h0: 0, hs: 0, snow: 1 } },
  ],
  init(s, f) {
    dotInit(s, f);
    s.ct = f.p.grow * 0.55; s.gen = 0;
    s.parts = [];
    this.plant(s, f);
  },
  plant(s, f) {
    const p = f.p, rand = mkRand(((Math.random() * 1e9) | 0) + s.gen * 7919);
    const names = p.mix ? p.mix.split(',') : [p.g];
    const n = Math.max(1, Math.round(p.copies * Math.min(1.3, (s.DW / s.DH) / 1.8)));
    const cache = {};
    s.pl = [];
    for (let c = 0; c < n; c++) {
      const name = names[c % names.length];
      const key = name + (name === 'rand' ? c : '');
      const T = cache[key] || (cache[key] = lsCompile(LSYS[name], rand, Math.floor(p.maxSeg / Math.max(1, n / 3))));
      const B = lsBox(T), slot = s.DW / n, big = n > 4 ? rnd(0.45, 1) : rnd(0.8, 1);
      const L = Math.min((s.DH * 0.9) / (B.y1 * (2 / f.aspect)), (slot * (n > 4 ? 2.2 : 1.25)) / Math.max(1, B.x1 - B.x0)) * big;
      const cx = slot * (c + 0.5) + rnd(-0.15, 0.15) * slot - ((B.x0 + B.x1) / 2) * L;
      s.pl.push({ T, L, cx, ph: rnd(0, TAU), ang: new Float32Array(T.n), ex: new Float32Array(T.n), ey: new Float32Array(T.n) });
    }
  },
  frame(s, f) {
    const p = f.p, t = f.t, dt = f.dt, g = f.g, cols = f.cols, H = f.H, DH = s.DH, ya = 2 / f.aspect;
    s.ct += dt;
    if (s.ct > p.cyc) { s.ct = p.grow * 0.3; s.gen++; this.plant(s, f); }
    const ct = s.ct, gr = ct < p.grow ? SM(ct / p.grow) : ct > p.cyc - 3 ? 0.25 + 0.75 * SM((p.cyc - ct) / 3) : 1;
    dotClear(s);
    const tips = [];
    for (const P of s.pl) {
      const T = P.T, n = T.n, par = T.par, turn = T.turn, dep = T.dep, md = T.md, ang = P.ang, ex = P.ex, ey = P.ey;
      const wind = Math.sin(t * p.ws - P.cx * 0.004 * p.wk + P.ph * 0.3) + 0.35 * Math.sin(t * p.ws * 2.3 + P.ph);
      const k = (p.amp * wind * 2) / (md * md), G = gr * (md + 1), L = P.L, base = DH - 1;
      for (let i = 0; i < n; i++) {
        const q = par[i], d = dep[i];
        const a = (q >= 0 ? ang[q] : Math.PI / 2) + turn[i] - k * d;
        ang[i] = a;
        const sx = q >= 0 ? ex[q] : P.cx, sy = q >= 0 ? ey[q] : base;
        if (d >= G) { ex[i] = sx; ey[i] = sy; continue; }
        const fr = G - d < 1 ? G - d : 1;
        const x = sx + Math.cos(a) * L * fr, y = sy - Math.sin(a) * L * fr * ya;
        ex[i] = x; ey[i] = y;
        const u = d / md, v = 0.45 + 0.55 * u, h = p.h0 + p.hs * u;
        dotLine(s, cols, sx, sy, x, y, v, h);
        if (p.thick && T.desc[i] > 40) {
          const w = T.desc[i] > 400 ? 2 : 1, ox = Math.sin(a), oy = Math.cos(a) * ya;
          for (let o = 1; o <= w; o++) dotLine(s, cols, sx + ox * o, sy + oy * o, x + ox * o, y + oy * o, v * 0.85, h);
        }
        if (p.leaf && T.tip[i] && fr === 1 && u > 0.35 && ((Math.imul(i + 7, 2654435761) >>> 24) / 256) < p.lf) tips.push(x, y, u);
      }
    }
    dotFlush(f, s);
    // 枝頭的花或葉
    if (p.leaf) {
      const Lc = p.leaf;
      for (let k = 0; k < tips.length; k += 3) {
        const x = tips[k] / 2, y = tips[k + 1] / 4, c = Lc[(((x * 7 + y * 13) | 0) % Lc.length + Lc.length) % Lc.length];
        g.set(x, y, c, H(p.h0 + 330 + ((x * 3) % 30), 0.75 + 0.25 * Math.sin(t + x)));
        if (p.petals && Math.random() < dt * 0.012) s.parts.push({ x, y, vx: rnd(0.5, 3), vy: rnd(1, 2.5), ph: rnd(0, TAU) });
      }
    }
    if (p.snow && Math.random() < dt * f.cols * 0.08) s.parts.push({ x: rnd(0, f.cols), y: -1, vx: rnd(-0.5, 0.5), vy: rnd(1.5, 4), ph: rnd(0, TAU) });
    // 飄落的花瓣／雪
    for (let k = s.parts.length - 1; k >= 0; k--) {
      const q = s.parts[k];
      q.x += (q.vx + Math.sin(t * 1.3 + q.ph) * 1.2) * dt; q.y += q.vy * dt;
      if (q.y >= f.rows || q.x >= f.cols || s.parts.length > 400) { s.parts[k] = s.parts[s.parts.length - 1]; s.parts.pop(); continue; }
      g.set(q.x, q.y, p.snow ? (q.vy > 3 ? '*' : '.') : '•', p.snow ? f.C(0.6 + 0.4 * Math.sin(q.ph + t)) : H(p.h0 + 340, 0.8));
    }
  } });

/* ═════════════ 13. 畢氏樹 ═════════════ */
A({ id: 'fx-pytree', name: '畢氏樹', cat: '碎形', theme: 'forest', hue: false, desc: '正方形上長正方形，整棵樹在風中搖',
  params: { a0: 45, D: 11, amp: 5, ws: 0.6, gust: 0, blow: 0, mode: 0, trees: 1, growT: 0, autumn: 0, h0: 30, hs: 90 },
  variants: [
    { id: 'lean', name: '斜生', theme: 'gold', desc: '三十度的不對稱畢氏樹，一邊高一邊低',
      params: { a0: 30, amp: 4, h0: 40, hs: 30 } },
    { id: 'wire', name: '線框', theme: 'cyber', desc: '只畫邊框的畢氏樹，線條細緻',
      params: { mode: 1, D: 11, amp: 5, h0: 180, hs: 140 } },
    { id: 'grow', name: '成長', theme: 'mint', desc: '一層一層長出來，長滿再重來',
      params: { growT: 1, amp: 4, h0: 120, hs: 40 } },
    { id: 'autumn', name: '秋楓', theme: 'sunset', hue: true, desc: '楓紅的樹梢落葉紛飛',
      params: { autumn: 1, a0: 40, amp: 6, h0: 25, hs: -25 } },
    { id: 'grove', name: '樹林', theme: 'lavender', desc: '大小不一的畢氏樹前後交疊',
      params: { trees: 3, D: 9, amp: 6, h0: 260, hs: 60 } },
  ],
  init(s, f) {
    dotInit(s, f);
    s.parts = []; s.streak = []; s.ct = 0;
    const p = f.p, cols = f.cols, rows = f.rows, asp = f.aspect;
    const n = Math.max(1, Math.round(p.trees * Math.min(1.25, (cols / (rows * asp)) / 1.7)));
    const cap = 1 << (p.D + 1);
    s.q = new Float64Array(cap * 5);
    // 每棵樹先用靜止姿態量一次真正的寬高（以樹幹邊長為單位），再決定大小與位置：不會被切掉、也不會偏一邊
    const szs = n > 1 ? Array.from({ length: n }, (_, k) => 1 - (0.4 * k) / (n - 1)) : [1];
    for (let k = n - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0, tmp = szs[k]; szs[k] = szs[j]; szs[j] = tmp; }
    s.tr = [];
    for (let k = 0; k < n; k++) {
      const a = n > 1 ? rnd(32, 58) : p.a0, E = this.ext(s, a, p.D, p.blow ? p.amp * 0.36 : 0);
      const sz = szs[k], hh = rows * asp * (n > 1 ? 0.8 : 0.97);
      const side = Math.min(((cols / n) * (n > 1 ? 2.1 : 0.96)) / (E.x1 - E.x0), hh / E.h) * sz;
      let cx = ((k + 0.5) / n) * cols;
      if (p.blow) cx -= side * E.h * 0.2;   // 狂風：樹冠會被吹向右邊，樹幹先往左放
      s.tr.push({ a, ph: rnd(0, TAU), sz, side, H: E.h, bx: cx - (side * (E.x0 + E.x1)) / 2 });
    }
    s.tr.sort((m, o) => m.sz - o.sz);   // 小的（遠的）先畫，大的蓋在前面
  },
  // 靜止姿態的外框：底邊在 (0,0)–(1,0)，y 往上；回傳 x 範圍與高度
  ext(s, a, D, bias) {
    const q = s.q;
    let head = 0, tail = 0, x0 = 0, x1 = 1, h = 1;
    q[tail++] = 0; q[tail++] = 0; q[tail++] = 1; q[tail++] = 0; q[tail++] = 0;
    while (head < tail) {
      const X0 = q[head], Y0 = q[head + 1], ux = q[head + 2], uy = q[head + 3], d = q[head + 4];
      head += 5;
      const nx = -uy, ny = ux, X1 = X0 + ux, Y1 = Y0 + uy, X2 = X1 + nx, Y2 = Y1 + ny, X3 = X0 + nx, Y3 = Y0 + ny;
      x0 = Math.min(x0, X2, X3); x1 = Math.max(x1, X2, X3); h = Math.max(h, Y2, Y3);
      if (d >= D) continue;
      const al = (a + bias * (0.3 + d / D)) * D2R, ca = Math.cos(al), sa = Math.sin(al);
      const lx = (ux * ca - uy * sa) * ca, ly = (ux * sa + uy * ca) * ca, ax = X3 + lx, ay = Y3 + ly;
      q[tail++] = X3; q[tail++] = Y3; q[tail++] = lx; q[tail++] = ly; q[tail++] = d + 1;
      q[tail++] = ax; q[tail++] = ay; q[tail++] = X2 - ax; q[tail++] = Y2 - ay; q[tail++] = d + 1;
    }
    return { x0, x1, h };
  },
  frame(s, f) {
    const p = f.p, t = f.t, dt = f.dt, g = f.g, rows = f.rows, cols = f.cols, asp = f.aspect, H = f.H;
    s.ct += dt;
    let D = p.D, gf = 1;
    if (p.growT) { const c = s.ct % 26; D = Math.min(p.D, Math.floor(c / 1.4)); gf = D < p.D ? SM((c % 1.4) / 1.4) : 1; if (c > 24) { D = p.D; gf = 1; } }
    if (p.mode === 1) dotClear(s);
    const CH = '█▓▒#*+:·';
    const gust = p.gust ? 0.6 + 0.4 * Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1) : 1;
    if (p.blow) this.wind(s, f, gust);
    for (const tr of s.tr) {
      const side = tr.side, bx = tr.bx, by = rows * asp, hh = side * tr.H;   // 樹幹左下角（x 為格，y 為乘上 asp 的「正方」座標，往下）
      // 狂風：越高的地方被推得越遠（樹幹彎曲），推力隨陣風變化
      const bend = p.blow ? (0.1 + 0.45 * gust + 0.05 * Math.sin(t * 2.3 + tr.ph)) * hh : 0;
      const shx = (x, y) => { if (!bend) return x; const r = (by - y) / hh; return x + bend * r * r; };
      s.lit = s.tr.length > 1 ? 0.55 + 0.45 * tr.sz : 1;
      const q = s.q;
      let head = 0, tail = 0;
      q[tail++] = bx; q[tail++] = by; q[tail++] = side; q[tail++] = 0; q[tail++] = 0;   // x, y, ux, uy, depth
      while (head < tail) {
        const x0 = q[head], y0 = q[head + 1], ux = q[head + 2], uy = q[head + 3], d = q[head + 4];
        head += 5;
        if (d > D) continue;
        // 正方形四角：底邊 p0→p1，往上（-y）長
        const nx = uy, ny = -ux;
        const x1 = x0 + ux, y1 = y0 + uy, x2 = x1 + nx, y2 = y1 + ny, x3 = x0 + nx, y3 = y0 + ny;
        const u = d / p.D;
        this.drawSq(s, f, shx(x0, y0), y0 / asp, shx(x1, y1), y1 / asp, shx(x2, y2), y2 / asp, shx(x3, y3), y3 / asp, CH[Math.min(7, Math.floor(u * 8))], u, p, d);
        if (d === D) {
          if (p.autumn && Math.random() < dt * 0.15) s.parts.push({ x: (x2 + x3) / 2, y: (y2 + y3) / 2 / asp, vx: rnd(-1, 2), vy: rnd(1, 3), ph: rnd(0, TAU), h: rnd(0, 40) });
          if (p.blow && Math.random() < dt * 0.02 * gust) s.parts.push({ x: shx((x2 + x3) / 2, y2), y: (y2 + y3) / 2 / asp, vx: rnd(8, 22) * (0.4 + gust), vy: rnd(-0.8, 1.6), ph: rnd(0, TAU), h: rnd(0, 40) });
          continue;
        }
        const wind = Math.sin(t * p.ws + tr.ph + d * 0.35) * gust + 0.3 * Math.sin(t * p.ws * 2.6 + d);
        // 狂風時角度整體偏向下風處（右子樹變大），整個樹冠被壓向右邊
        const al = (tr.a + p.amp * (p.blow ? 0.6 * gust + 0.3 * wind : wind) * (0.3 + u)) * D2R, ca = Math.cos(al), sa = Math.sin(al);
        // 左子正方形：從 p3 沿著底邊方向旋轉 al
        const lx = (ux * ca + uy * sa) * ca, ly = (-ux * sa + uy * ca) * ca;
        const ax = x3 + lx, ay = y3 + ly, k = d + 1 === D ? gf : 1;
        if (tail + 10 <= q.length) {
          q[tail++] = x3; q[tail++] = y3; q[tail++] = lx * k; q[tail++] = ly * k; q[tail++] = d + 1;
          q[tail++] = ax; q[tail++] = ay; q[tail++] = (x2 - ax) * k; q[tail++] = (y2 - ay) * k; q[tail++] = d + 1;
        }
      }
    }
    if (p.mode === 1) dotFlush(f, s);
    for (let k = s.parts.length - 1; k >= 0; k--) {
      const r = s.parts[k];
      r.x += (r.vx + Math.sin(t * 1.7 + r.ph) * 1.5) * dt; r.y += (r.vy + (p.blow ? Math.sin(t * 3.1 + r.ph) * 1.2 : 0)) * dt;
      if (r.y >= rows || r.x >= cols + 1 || s.parts.length > 300) { s.parts[k] = s.parts[s.parts.length - 1]; s.parts.pop(); continue; }
      g.set(r.x, r.y, '•*·'[(r.ph * 3 | 0) % 3], H(p.h0 + r.h - 20, 0.75));
    }
  },
  // 狂風的風痕：一道道橫向的線從左邊掃到右邊
  wind(s, f, gust) {
    const { g, cols, rows, dt, C } = f, L = s.streak;
    if (Math.random() < dt * rows * 0.5 * gust && L.length < 80) L.push({ x: -2, y: rint(0, rows - 1), v: cols * rnd(0.22, 0.45), len: rint(4, Math.max(6, cols / 10)), w: rnd(0, TAU) });
    for (let k = L.length - 1; k >= 0; k--) {
      const w = L[k];
      w.x += w.v * (0.5 + gust) * dt;
      if (w.x - w.len > cols) { L[k] = L[L.length - 1]; L.pop(); continue; }
      for (let j = 0; j < w.len; j++) {
        const x = Math.floor(w.x) - j, y = Math.floor(w.y + 0.6 * Math.sin(w.w + x * 0.15));
        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
        const e = 1 - j / w.len;
        g.set(x, y, j === 0 ? '~' : e > 0.5 ? '-' : '·', C(0.1 + 0.35 * e));
      }
    }
  },
  drawSq(s, f, x0, y0, x1, y1, x2, y2, x3, y3, chr, u, p, d) {
    const g = f.g, cols = f.cols, rows = f.rows, H = f.H;
    const col = H(p.h0 + p.hs * u, (0.35 + 0.6 * (p.autumn ? 0.6 + 0.4 * u : 1 - u * 0.35)) * (s.lit || 1));
    if (p.mode === 1) {
      const sx = 2, sy = 4, v = 0.45 + 0.55 * (1 - u * 0.5), h = p.h0 + p.hs * u;
      dotLine(s, cols, x0 * sx, y0 * sy, x1 * sx, y1 * sy, v, h); dotLine(s, cols, x1 * sx, y1 * sy, x2 * sx, y2 * sy, v, h);
      dotLine(s, cols, x2 * sx, y2 * sy, x3 * sx, y3 * sy, v, h); dotLine(s, cols, x3 * sx, y3 * sy, x0 * sx, y0 * sy, v, h);
      return;
    }
    const ymin = Math.max(0, Math.floor(Math.min(y0, y1, y2, y3))), ymax = Math.min(rows - 1, Math.floor(Math.max(y0, y1, y2, y3)));
    const xmn = Math.min(x0, x1, x2, x3), xmx = Math.max(x0, x1, x2, x3);
    if (xmx - xmn < 1.2 && ymax - ymin < 1) { g.set((xmn + xmx) / 2, (y0 + y2) / 2, chr, col); return; }
    const X = [x0, x1, x2, x3], Y = [y0, y1, y2, y3];
    for (let y = ymin; y <= ymax; y++) {
      const yc = y + 0.5;
      let lo = 1e9, hi = -1e9;
      for (let k = 0; k < 4; k++) {
        const ax = X[k], ay = Y[k], bx = X[(k + 1) & 3], by = Y[(k + 1) & 3];
        if ((ay <= yc && by >= yc) || (by <= yc && ay >= yc)) {
          const xx = by === ay ? Math.min(ax, bx) : ax + ((yc - ay) / (by - ay)) * (bx - ax);
          const xx2 = by === ay ? Math.max(ax, bx) : xx;
          if (xx < lo) lo = xx; if (xx2 > hi) hi = xx2;
        }
      }
      if (lo > hi) continue;
      for (let x = Math.max(0, Math.round(lo)); x <= Math.min(cols - 1, Math.round(hi) - (hi - lo > 1 ? 1 : 0)); x++) { const i = y * cols + x; g.ch[i] = chr; g.co[i] = col; }
    }
  } });


/* ═════════════ 14. 填充曲線 ═════════════ */
// 任意長方形的廣義希爾伯特曲線（gilbert2d）
function gilbert(W, H) {
  const out = [], sgn = v => (v > 0) - (v < 0);
  const gen = (x, y, ax, ay, bx, by) => {
    const w = Math.abs(ax + ay), h = Math.abs(bx + by), dax = sgn(ax), day = sgn(ay), dbx = sgn(bx), dby = sgn(by);
    if (h === 1) { for (let i = 0; i < w; i++) { out.push(x, y); x += dax; y += day; } return; }
    if (w === 1) { for (let i = 0; i < h; i++) { out.push(x, y); x += dbx; y += dby; } return; }
    let ax2 = Math.floor(ax / 2), ay2 = Math.floor(ay / 2), bx2 = Math.floor(bx / 2), by2 = Math.floor(by / 2);
    const w2 = Math.abs(ax2 + ay2), h2 = Math.abs(bx2 + by2);
    if (2 * w > 3 * h) {
      if (w2 % 2 && w > 2) { ax2 += dax; ay2 += day; }
      gen(x, y, ax2, ay2, bx, by);
      gen(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by);
    } else {
      if (h2 % 2 && h > 2) { bx2 += dbx; by2 += dby; }
      gen(x, y, bx2, by2, ax2, ay2);
      gen(x + bx2, y + by2, ax, ay, bx - bx2, by - by2);
      gen(x + (ax - dax) + (bx2 - dbx), y + (ay - day) + (by2 - dby), -bx2, -by2, -(ax - ax2), -(ay - ay2));
    }
  };
  if (W >= H) gen(0, 0, W, 0, 0, H); else gen(0, 0, 0, W, H, 0);
  return out;
}
// 奇數邊長長方形的皮亞諾式蛇行曲線：較長的一邊切成三條奇數寬的帶子，來回走
function peano(W, H) {
  const out = [];
  const odd3 = L => {
    let bq = 1, bd = 1e9;
    for (let q = 1; q * 2 < L; q += 2) { const d = Math.abs(L - 3 * q); if (d < bd) { bd = d; bq = q; } }
    return [bq, L - 2 * bq, bq];
  };
  const gen = (x0, y0, w, h, dx, dy) => {
    if (w === 1 && h === 1) { out.push(x0, y0); return; }
    if (w >= h) {
      const a = odd3(w);
      let x = x0;
      for (let k = 0; k < 3; k++) { gen(x, k % 2 ? y0 + (h - 1) * dy : y0, a[k], h, dx, k % 2 ? -dy : dy); x += a[k] * dx; }
    } else {
      const a = odd3(h);
      let y = y0;
      for (let k = 0; k < 3; k++) { gen(k % 2 ? x0 + (w - 1) * dx : x0, y, w, a[k], k % 2 ? -dx : dx, dy); y += a[k] * dy; }
    }
  };
  gen(0, 0, W, H, 1, 1);
  return out;
}
// 海龜 L 系統 → 點列
function turtle(ax, rules, ang, n) {
  let s = ax;
  for (let k = 0; k < n; k++) { let o = ''; for (const c of s) o += rules[c] || c; s = o; }
  const P = [0, 0], A = ang * D2R;
  let x = 0, y = 0, a = 0;
  for (const c of s) {
    if (c === 'A' || c === 'B' || c === 'F') { x += Math.cos(a); y += Math.sin(a); P.push(x, y); }
    else if (c === '+') a += A; else if (c === '-') a -= A;
  }
  return P;
}
function hilbertXY(order, d) {
  let x = 0, y = 0;
  for (let s = 1, t = d; s < 1 << order; s <<= 1) {
    const rx = 1 & (t >> 1), ry = 1 & (t ^ rx);
    if (!ry) { if (rx) { x = s - 1 - x; y = s - 1 - y; } const tmp = x; x = y; y = tmp; }
    x += s * rx; y += s * ry; t >>= 2;
  }
  return [x, y];
}
A({ id: 'fx-curve', name: '填充曲線', cat: '碎形', theme: 'cyber', hue: true, desc: '希爾伯特曲線一筆畫滿整個螢幕',
  params: { kind: 0, sx: 2, sy: 1, pens: 1, wave: 0, dbl: 0, T: 32, h0: 180, hs: 140 },
  variants: [
    { id: 'peano', name: '皮亞諾', theme: 'amber', hue: false, desc: '三分再三分的皮亞諾蛇行，一筆走遍',
      params: { kind: 1, T: 34 } },
    { id: 'pens', name: '六筆齊畫', theme: 'neon', desc: '六支筆同時沿著粗格希爾伯特曲線前進',
      params: { kind: 0, sx: 4, sy: 2, pens: 6, T: 16, h0: 280, hs: 200 } },
    { id: 'ribbon', name: '流光', theme: 'ocean', hue: false, desc: '雙線大格皮亞諾迷宮裡光脈衝流過',
      params: { kind: 1, wave: 1, sx: 4, sy: 2, dbl: 1 } },
    { id: 'arrow', name: '箭頭', theme: 'sunset', desc: '謝爾賓斯基箭頭曲線來回轉折',
      params: { kind: 3, T: 22, h0: 0, hs: 60 } },
    { id: 'orders', name: '階數生長', theme: 'lavender', hue: false, desc: '希爾伯特曲線一階一階細分變形',
      params: { kind: 4 } },
  ],
  init(s, f) {
    const p = f.p, cols = f.cols, rows = f.rows;
    s.ph = p.T * 0.12; s.cyc = 0;
    if (p.kind <= 1) {
      let W = Math.floor((cols - 2) / p.sx) + 1, H = Math.floor((rows - 1) / p.sy) + 1;
      if (p.kind === 0) { W -= W & 1; H -= H & 1; } else { W -= 1 - (W & 1); H -= 1 - (H & 1); }
      W = Math.max(2, W); H = Math.max(2, H);
      s.pts = p.kind === 0 ? gilbert(W, H) : peano(W, H);
      s.N = s.pts.length / 2 - 1;
      s.x0 = Math.floor((cols - (W - 1) * p.sx - 1) / 2); s.y0 = Math.floor((rows - (H - 1) * p.sy - 1) / 2);
      s.mask = new Uint8Array(cols * rows); s.age = new Float32Array(cols * rows);
    } else {
      dotInit(s, f);
      if (p.kind === 2) s.P = turtle('A', { A: 'A-B--B+A++AA+B-', B: '+A-AA++A+B--B-A' }, 60, f.cols * f.rows > 6000 ? 4 : 3);
      else if (p.kind === 3) s.P = turtle('A', { A: 'B-A-B', B: 'A+B+A' }, 60, f.cols * f.rows > 6000 ? 7 : 6);
      s.cam = null;
    }
  },
  frame(s, f) {
    const p = f.p;
    s.ph += f.dt;
    if (p.kind <= 1) return this.boxCurve(s, f);
    if (p.kind === 4) return this.orders(s, f);
    // 點字曲線：畫筆沿曲線前進，畫完停一下再從尾巴擦掉
    dotClear(s);
    const P = s.P, N = P.length / 2 - 1, T = p.T, ph = s.ph;
    if (ph > T + 13) { s.ph = T * 0.1; s.cyc++; }
    const draw = Math.min(N, Math.floor((Math.min(ph, T) / T) * N)), erase = ph > T + 5 ? Math.min(N, Math.floor(((ph - T - 5) / 7) * N)) : 0;
    if (!s.cam) camFit(s, f, P, N + 1, 0.9, 1);
    const cam = s.cam, cols = f.cols, S = cam.S, ya = cam.ya, ox = s.DW / 2, oy = s.DH / 2, rot = p.kind === 2 ? s.cyc * (Math.PI / 3) : 0;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    let px = 0, py = 0;
    for (let i = erase; i <= draw; i++) {
      const wx = P[2 * i] - cam.cx, wy = P[2 * i + 1] - cam.cy, X = ox + (wx * cr - wy * sr) * S, Y = oy + (wx * sr + wy * cr) * S * ya;
      if (i > erase) { const age = (draw - i) / N, pl = Math.pow(0.5 + 0.5 * Math.sin((i / N) * 22 - f.t * 2.4), 10); dotLine(s, cols, px, py, X, Y, Math.min(1, 0.35 + 0.65 * Math.max(0, 1 - age * 3) + 0.5 * pl), p.h0 + (p.hs * i) / N); }
      px = X; py = Y;
    }
    dotFlush(f, s);
    if (draw < N && draw > erase) f.g.set(px / 2, py / 4, '●', f.C(1));
  },
  boxCurve(s, f) {
    const p = f.p, g = f.g, cols = f.cols, rows = f.rows, pts = s.pts, N = s.N, mask = s.mask, age = s.age, H = f.H, t = f.t;
    mask.fill(0);
    const sx = p.sx, sy = p.sy, x0 = s.x0, y0 = s.y0;
    const put = (x, y, b, i) => { if (x < 0 || y < 0 || x >= cols || y >= rows) return; const c = y * cols + x; mask[c] |= b; age[c] = i; };
    const seg = i => {
      const X0 = x0 + pts[2 * i] * sx, Y0 = y0 + pts[2 * i + 1] * sy, X1 = x0 + pts[2 * i + 2] * sx, Y1 = y0 + pts[2 * i + 3] * sy;
      if (Y0 === Y1) { const lx = Math.min(X0, X1), rx = Math.max(X0, X1); put(lx, Y0, 2, i); for (let x = lx + 1; x < rx; x++) put(x, Y0, 10, i); put(rx, Y0, 8, i); }
      else if (X0 === X1) { const ty = Math.min(Y0, Y1), by = Math.max(Y0, Y1); put(X0, ty, 4, i); for (let y = ty + 1; y < by; y++) put(X0, y, 5, i); put(X0, by, 1, i); }
    };
    let heads = [];
    if (p.wave) for (let i = 0; i < N; i++) seg(i);
    else {
      const T = p.T, ph = s.ph, pens = p.pens, span = Math.ceil(N / pens);
      if (ph > T + 12) { s.ph = T * 0.1; s.cyc++; }
      const prog = Math.min(1, ph / T), er = ph > T + 5 ? Math.min(1, (ph - T - 5) / 6) : 0;
      for (let k = 0; k < pens; k++) {
        const a = k * span, b = Math.min(N, a + span), d = a + Math.floor((b - a) * prog), e = a + Math.floor((b - a) * er);
        for (let i = e; i < d; i++) seg(i);
        if (prog < 1 && d > e) heads.push(d);
      }
    }
    const ch = g.ch, co = g.co, n = g.n, mir = s.cyc & 1, GL = p.dbl ? BOXD : BOXR;
    for (let i = 0; i < n; i++) {
      const m = mask[i];
      if (!m) continue;
      const a = age[i], u = a / N;
      let e;
      if (p.wave) { const w = Math.sin(u * 60 - t * 1.6) * 0.5 + 0.5, w2 = Math.sin(u * 9 + t * 0.4) * 0.5 + 0.5; e = 0.18 + 0.82 * Math.pow(w, 6) * (0.4 + 0.6 * w2); }
      else e = Math.min(1, 0.38 + 0.42 * (mir ? 1 - u : u) + 0.4 * Math.pow(0.5 + 0.5 * Math.sin(u * 34 - t * 2), 12));   // 一道光沿著曲線跑
      ch[i] = GL[m]; co[i] = H(p.h0 + p.hs * u + t * 4, e);
    }
    for (const d of heads) g.set(x0 + pts[2 * d] * sx, y0 + pts[2 * d + 1] * sy, '█', f.C(1));
  },
  // 階數生長：希爾伯特曲線從 1 階平滑細分到 6 階（兩個正方形並排）
  orders(s, f) {
    const p = f.p, cols = f.cols;
    dotClear(s);
    const maxO = f.rows > 40 ? 6 : 5, per = 3.2, cyc = (maxO - 1) * per + 5;
    const ph = s.ph % cyc;
    const k = Math.min(maxO - 1, 1 + Math.floor(ph / per)), u = ph >= (maxO - 1) * per ? 1 : SM(Math.min(1, (ph % per) / (per * 0.7)));
    const ord = Math.min(maxO, k + 1), n = 1 << ord, n2 = n * n, np = 1 << (ord - 1);
    const side = Math.min(s.DW / 2.1, (s.DH * 0.94) / (2 / f.aspect)), ya = 2 / f.aspect, ox = s.DW / 2 - side, oy = s.DH / 2 + (side * ya) / 2;
    let px = 0, py = 0;
    for (let sq = 0; sq < 2; sq++) {
      for (let d = 0; d < n2; d++) {
        const [x1, y1] = hilbertXY(ord, d), [x0, y0] = hilbertXY(ord - 1, d >> 2);
        const fx = ((x0 + 0.5) / np) * (1 - u) + ((x1 + 0.5) / n) * u, fy = ((y0 + 0.5) / np) * (1 - u) + ((y1 + 0.5) / n) * u;
        const X = ox + (sq + fx) * side, Y = oy - fy * side * ya;
        const q = (sq * n2 + d) / (2 * n2);
        if (d || sq) dotLine(s, cols, px, py, X, Y, Math.min(1, 0.45 + 0.4 * q + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(q * 18 - f.t * 2), 10)), p.h0 + p.hs * q);
        px = X; py = Y;
      }
    }
    dotFlush(f, s);
  } });


/* ═════════════ 15. 阿波羅墊片 ═════════════
   笛卡兒圓定理：四個兩兩相切的圓，換掉其中一個得到新圓
   k' = 2(k1+k2+k3) − k4，(kz)' = 2(k1z1+k2z2+k3z3) − k4z4。直線用 k=0、kz=朝外的單位法向量。 */
function apGen(init, quads, minR, cap) {
  const C = init.slice();                 // 每個圓：[k, kx, ky, 世代]
  const Q = quads.slice();
  let h = 0;
  while (h < Q.length && C.length < cap) {
    const [a, b, c, d] = Q[h++];
    const A = C[a], B = C[b], Cc = C[c], D = C[d];
    const k = 2 * (A[0] + B[0] + Cc[0]) - D[0];
    if (k <= 1e-9 || 1 / k < minR) continue;
    C.push([k, 2 * (A[1] + B[1] + Cc[1]) - D[1], 2 * (A[2] + B[2] + Cc[2]) - D[2], Math.max(A[3], B[3], Cc[3]) + 1]);
    const e = C.length - 1;
    Q.push([e, a, b, c], [e, b, c, a], [e, a, c, b]);
  }
  return C;
}
// 外圓半徑 1，內部兩圓沿直徑相切（半徑 a 與 1−a），第三圓由笛卡兒定理決定
function apFamily(a, minR, cap) {
  const r1 = a, r2 = 1 - a, x1 = -1 + r1, x2 = 1 - r2;
  const k0 = -1, k1 = 1 / r1, k2 = 1 / r2, k3 = k0 + k1 + k2 + 2 * Math.sqrt(Math.max(0, k0 * k1 + k1 * k2 + k2 * k0));
  // k3 z3 = k1 z1 + k2 z2 + 2√(k1 k2 z1 z2)（z1 z2 < 0 → 純虛數）
  const kz3x = k1 * x1 + k2 * x2, kz3y = 2 * Math.sqrt(Math.max(0, -k1 * k2 * x1 * x2));
  const init = [[k0, 0, 0, 0], [k1, k1 * x1, 0, 0], [k2, k2 * x2, 0, 0], [k3, kz3x, kz3y, 1]];
  return apGen(init, [[3, 1, 2, 0], [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 3, 1]], minR, cap);
}
function apSym(minR, cap) {
  const r = 1 / (1 + 2 / Math.sqrt(3)), d = 1 - r, k = 1 / r, init = [[-1, 0, 0, 0]];
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i * TAU) / 3; init.push([k, k * d * Math.cos(a), k * d * Math.sin(a), 1]); }
  return apGen(init, [[1, 2, 3, 0], [0, 1, 2, 3], [0, 2, 3, 1], [0, 1, 3, 2]], minR, cap);
}
A({ id: 'fx-apollo', name: '阿波羅墊片', cat: '碎形', theme: 'gold', desc: '圓與圓相切，一代一代塞滿縫隙',
  params: { mode: 0, h0: 40, hs: 25, spin: 0.03, T: 16, hue2: 0 },
  variants: [
    { id: 'breathe', name: '呼吸', theme: 'ice', desc: '兩個大圓此消彼長，整片墊片跟著變形',
      params: { mode: 1, h0: 190, hs: 40, spin: 0.02 } },
    { id: 'solid', name: '實心', theme: 'sunset', hue: true, desc: '以字元填滿的實心圓，越小越亮',
      params: { mode: 2, h0: 330, hs: -60, spin: 0.02 } },
    { id: 'strip', name: '帶狀', theme: 'mint', desc: '夾在兩條直線之間的無限墊片緩緩捲動',
      params: { mode: 3, h0: 150, hs: 40 } },
    { id: 'pack', name: '隨機填充', theme: 'neon', hue: true, desc: '圓從隨機位置長大，碰到就停，直到塞滿',
      params: { mode: 4, h0: 280, hs: 120 } },
    { id: 'steiner', name: '史坦納鏈', theme: 'lavender', desc: '兩圓之間的圓環鏈一邊轉一邊變形，還套著小鏈',
      params: { mode: 5, h0: 260, hs: 60 } },
  ],
  init(s, f) {
    dotInit(s, f);
    const p = f.p;
    s.ct = 0;
    s.R = Math.min(s.DW / 2, (s.DH / 2) * (f.aspect / 2)) * 0.96;   // 外圓半徑（橫向點數）
    s.minR = 1.3 / s.R;
    if (p.mode === 0) s.C = apSym(s.minR, 2600);
    if (p.mode === 2) { s.C = apSym(0.8 / (s.R / 2), 1500); }
    if (p.mode === 3) {
      // 帶狀：上下兩條線 + 一排直徑 1 的圓，只算 0..1 之間的一個週期
      const init = [[0, 0, -1, 0], [0, 0, 1, 0], [2, 0, 1, 0], [2, 2, 1, 0]];
      s.C = apGen(init, [[0, 2, 3, 1], [1, 2, 3, 0]], 1.3 / (s.DH / (2 / f.aspect) * 0.5), 2500);
    }
    if (p.mode === 4) { s.pk = []; s.idle = 0; s.fade = 0; }
  },
  frame(s, f) {
    const p = f.p, t = f.t, cols = f.cols, ya = 2 / f.aspect, ox = s.DW / 2, oy = s.DH / 2, R = s.R;
    s.ct += f.dt;
    dotClear(s);
    if (p.mode === 4) return this.pack(s, f);
    if (p.mode === 5) return this.steiner(s, f);
    let C = p.mode === 1 ? apFamily(0.5 + 0.32 * Math.sin(t * 0.17), s.minR * 1.2, 1600) : s.C, show = C.length, rot = p.spin * t;
    if (p.mode === 0) {
      // 一代一代冒出來，滿了停一下再收回
      const c = s.ct % (p.T + 10), u = c < p.T ? c / p.T : c < p.T + 6 ? 1 : 1 - (c - p.T - 6) / 4;
      show = Math.max(4, Math.floor(C.length * Math.pow(Math.max(0, u), 1.6)));
    }
    if (p.mode === 3) {
      // 帶狀：圓直徑 = 螢幕高，橫向捲動
      const Hd = s.DH * 0.98, S = Hd / ya, off = (t * 0.05) % 1;
      const n0 = -1, n1 = Math.ceil(s.DW / S) + 1;
      dotLine(s, cols, 0, oy - Hd / 2, s.DW - 1, oy - Hd / 2, 0.6, p.h0); dotLine(s, cols, 0, oy + Hd / 2 - 1, s.DW - 1, oy + Hd / 2 - 1, 0.6, p.h0);
      for (let n = n0; n <= n1; n++) {
        for (let i = 2; i < C.length; i++) {
          const q = C[i]; if (q[0] <= 0) continue;
          const r = 1 / q[0], x = q[1] / q[0] + n - off, y = q[2] / q[0];
          if (i === 3) continue;
          const X = x * S, Y = oy - Hd / 2 + y * Hd;
          if (X + r * S < 0 || X - r * S > s.DW) continue;
          const e = Math.min(1, 0.45 + 0.18 * Math.log2(q[0]));
          this.ring(s, cols, X, Y, r * S, ya, e, p.h0 + p.hs * Math.log2(q[0]) * 0.3);
        }
      }
      dotFlush(f, s);
      return;
    }
    const cr = Math.cos(rot), sr = Math.sin(rot);
    if (p.mode === 2) { this.solid(s, f, C, rot); return; }
    for (let i = 0; i < show; i++) {
      const q = C[i], k = q[0];
      if (k < 0) { this.ring(s, cols, ox, oy, R, ya, 0.55, p.h0); continue; }
      const r = 1 / k, x = q[1] / k, y = q[2] / k, X = ox + (x * cr - y * sr) * R, Y = oy + (x * sr + y * cr) * R * ya;
      const fresh = p.mode === 0 && i > show - 30 ? 1 : 0;
      const e = Math.min(1, 0.4 + 0.12 * Math.log2(k) + 0.3 * fresh);
      this.ring(s, cols, X, Y, r * R, ya, e, p.h0 + p.hs * Math.log2(k) * 0.4 + q[3] * 4);
    }
    dotFlush(f, s);
  },
  ring(s, cols, X, Y, r, ya, v, h) {
    if (r < 0.7) { dotSet(s, cols, X, Y, v, h); return; }
    const n = Math.max(6, Math.ceil(r * 6.5)), da = TAU / n;
    for (let k = 0; k < n; k++) { const a = k * da; dotSet(s, cols, X + Math.cos(a) * r, Y + Math.sin(a) * r * ya, v, h); }
  },
  // 實心圓：大圓先畫，小圓蓋在上面，字元越小越密
  solid(s, f, C, rot) {
    const { g, cols, rows, aspect, H, t } = f, p = f.p, cr = Math.cos(rot), sr = Math.sin(rot);
    const Rc = s.R / 2, cx = cols / 2, cy = rows / 2, CH = ' .:-=+*#%@';
    for (let i = 1; i < C.length; i++) {
      const q = C[i], k = q[0], r = (1 / k) * Rc, x = q[1] / k, y = q[2] / k;
      const X = cx + (x * cr - y * sr) * Rc, Y = cy + ((x * sr + y * cr) * Rc) / aspect;
      const lk = Math.log2(k), e = clamp(0.25 + lk * 0.12, 0.2, 1), chr = CH[Math.min(9, 2 + Math.floor(lk * 1.2))];
      const col = H(p.h0 + p.hs * lk * 0.35 + t * 5, 0.25 + 0.7 * e);
      if (r < 0.8) { g.set(X, Y, chr, col); continue; }
      const ry = r / aspect, y0 = Math.max(0, Math.floor(Y - ry)), y1 = Math.min(rows - 1, Math.ceil(Y + ry));
      for (let yy = y0; yy <= y1; yy++) {
        const dy = (yy + 0.5 - Y) * aspect, w = r * r - dy * dy;
        if (w < 0) continue;
        const hw = Math.sqrt(w), xa = Math.max(0, Math.ceil(X - hw - 0.5)), xb = Math.min(cols - 1, Math.floor(X + hw - 0.5));
        for (let xx = xa; xx <= xb; xx++) {
          const i2 = yy * cols + xx, edge = Math.hypot(xx + 0.5 - X, dy) > r - 1.1;
          g.ch[i2] = edge ? '@' : chr; g.co[i2] = edge ? H(p.h0 + p.hs * lk * 0.35 + 20, Math.min(1, e + 0.2)) : col;
        }
      }
    }
  },
  // 隨機填充：圓從空位冒出、長大，碰到別的圓或邊界就停
  pack(s, f) {
    const p = f.p, dt = f.dt, cols = f.cols, ya = 2 / f.aspect, W = s.DW, Hh = s.DH / ya, L = s.pk;
    if (s.fade > 0) { s.fade -= dt; for (const c of L) c.r *= Math.exp(-dt * 1.8); if (s.fade <= 0) { L.length = 0; s.idle = 0; } }
    else {
      let born = 0;
      for (let a = 0; a < 25 && L.length < 600; a++) {
        const x = rnd(0, W), y = rnd(0, Hh);
        let ok = true;
        for (const c of L) { const dx = x - c.x, dy = y - c.y; if (dx * dx + dy * dy < (c.r + 1.5) * (c.r + 1.5)) { ok = false; break; } }
        if (ok) { L.push({ x, y, r: 0.5, g: 1, h: rnd(0, 1) }); born++; if (born > 2) break; }
      }
      s.idle = born ? 0 : s.idle + dt;
      if (s.idle > 2.5 || L.length >= 600) s.fade = 2.2;
      const v = Math.max(4, W * 0.02);
      for (const c of L) {
        if (!c.g) continue;
        c.r += v * dt * (0.6 + c.h);
        if (c.x - c.r < 0 || c.x + c.r > W || c.y - c.r < 0 || c.y + c.r > Hh) { c.g = 0; continue; }
        for (const o of L) { if (o === c) continue; const dx = c.x - o.x, dy = c.y - o.y, rr = c.r + o.r + 0.6; if (dx * dx + dy * dy < rr * rr) { c.g = 0; break; } }
      }
    }
    for (const c of L) this.ring(s, cols, c.x, c.y * ya, c.r, ya, c.g ? 1 : 0.55 + 0.3 * c.h, p.h0 + p.hs * c.h);
    dotFlush(f, s);
  },
  // 史坦納鏈：同心圓中的一圈圓，用圓盤自同構 z → (z−a)/(1−āz) 變成偏心，再在每顆圓裡套一層小鏈
  steiner(s, f) {
    const p = f.p, t = f.t, cols = f.cols, ya = 2 / f.aspect, ox = s.DW / 2, oy = s.DH / 2, R = s.R;
    const n = 7, sn = Math.sin(Math.PI / n), rho = (1 - sn) / (1 + sn);
    const am = 0.45 * Math.sin(t * 0.11), aa = t * 0.05, ax = am * Math.cos(aa), ay = am * Math.sin(aa);
    const mob = (x, y, bx, by) => {   // (z−b)/(1−b̄z)
      const nx = x - bx, ny = y - by, dx = 1 - (bx * x + by * y), dy = -(bx * y - by * x), d = dx * dx + dy * dy;
      return [(nx * dx + ny * dy) / d, (ny * dx - nx * dy) / d];
    };
    const circ = (cx, cy, r, bx, by) => {   // 圓在映射下的像：取三點求外接圓
      const P = [0, 2.0944, 4.18879].map(a => mob(cx + r * Math.cos(a), cy + r * Math.sin(a), bx, by));
      const [x1, y1] = P[0], [x2, y2] = P[1], [x3, y3] = P[2];
      const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) || 1e-9;
      const ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / d;
      const uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / d;
      return [ux, uy, Math.hypot(x1 - ux, y1 - uy)];
    };
    const draw = (cx, cy, r, v, h) => this.ring(s, cols, ox + cx * R, oy + cy * R * ya, r * R, ya, v, h);
    const chain = (CX, CY, CR, depth, phase, bx, by) => {
      // 在圓 (CX,CY,CR) 裡放一條鏈（座標先在單位圓裡算，再縮放平移）
      const [ix, iy, ir] = circ(0, 0, rho, bx, by);
      draw(CX + ix * CR, CY + iy * CR, ir * CR, 0.5, p.h0 + depth * 40);
      const mr = (1 - rho) / 2, md = (1 + rho) / 2;
      for (let k = 0; k < n; k++) {
        const a = phase + (k * TAU) / n, [x, y, r] = circ(md * Math.cos(a), md * Math.sin(a), mr, bx, by);
        const X = CX + x * CR, Y = CY + y * CR, Rr = r * CR;
        draw(X, Y, Rr, 0.95 - depth * 0.25, p.h0 + p.hs * (k / n) + depth * 40);
        if (depth < 1 && Rr * R > 6) chain(X, Y, Rr, depth + 1, -phase * 1.7 + k, bx * 0.6, -by * 0.6);
      }
    };
    draw(0, 0, 1, 0.6, p.h0);
    chain(0, 0, 1, 0, t * 0.25, ax, ay);
    dotFlush(f, s);
  } });

/* ═════════════ 16. 碎形火焰 ═════════════ */
// 變形函數（數字對應 FV 表）
function flameVar(v, x, y, out) {
  const r2 = x * x + y * y + 1e-9, r = Math.sqrt(r2);
  switch (v) {
    case 0: out[0] = x; out[1] = y; break;
    case 1: out[0] = Math.sin(x); out[1] = Math.sin(y); break;
    case 2: out[0] = x / r2; out[1] = y / r2; break;
    case 3: { const s = Math.sin(r2), c = Math.cos(r2); out[0] = x * s - y * c; out[1] = x * c + y * s; break; }
    case 4: out[0] = ((x - y) * (x + y)) / r; out[1] = (2 * x * y) / r; break;
    case 5: out[0] = Math.atan2(x, y) / Math.PI; out[1] = r - 1; break;
    case 6: { const th = Math.atan2(x, y); out[0] = r * Math.sin(th + r); out[1] = r * Math.cos(th - r); break; }
    case 7: { const th = Math.atan2(x, y); out[0] = r * Math.sin(th * r); out[1] = -r * Math.cos(th * r); break; }
    case 8: { const th = Math.atan2(x, y) / Math.PI; out[0] = th * Math.sin(Math.PI * r); out[1] = th * Math.cos(Math.PI * r); break; }
    case 9: { const th = Math.atan2(x, y); out[0] = (Math.cos(th) + Math.sin(r)) / r; out[1] = (Math.sin(th) - Math.cos(r)) / r; break; }
    case 10: { const th = Math.atan2(y, x) / 2 + (Math.random() < 0.5 ? 0 : Math.PI), sr = Math.sqrt(r); out[0] = sr * Math.cos(th); out[1] = sr * Math.sin(th); break; }
    default: { const k = 4 / (r2 + 4); out[0] = k * x; out[1] = k * y; }
  }
}
A({ id: 'fx-flame', name: '碎形火焰', cat: '碎形', theme: 'fire', hue: false, desc: '漩渦變形的碎形火焰緩緩翻捲',
  params: { seed: 7, nt: 3, vars: [3, 0], sym: 1, mirror: 0, rate: 400000, decay: 0.75, style: 0, drift: 0.12, h0: 20, hs: 50, zoom: 1 },
  variants: [
    { id: 'sphere', name: '球面', theme: 'ice', desc: '球面變形把光絲捲成泡泡',
      params: { seed: 21, nt: 3, vars: [2, 0], h0: 190, hs: 60 } },
    { id: 'sine', name: '正弦', theme: 'mint', desc: '正弦變形織出柔軟的網格紗',
      params: { seed: 5, nt: 4, vars: [1, 3], h0: 140, hs: 50, zoom: 1.1 } },
    { id: 'heart', name: '心形', theme: 'blood', desc: '心形變形層層疊出紅色花瓣',
      params: { seed: 45, nt: 3, vars: [7, 0], h0: 350, hs: 30 } },
    { id: 'five', name: '五瓣', theme: 'rainbow', hue: true, desc: '五重旋轉對稱的火焰花',
      params: { seed: 11, nt: 3, vars: [3, 1], sym: 5, h0: 0, hs: 300 } },
    { id: 'horse', name: '馬蹄', theme: 'gold', desc: '馬蹄與極座標變形的金色流線',
      params: { seed: 2, nt: 3, vars: [4, 5], h0: 40, hs: 20 } },
    { id: 'kerchief', name: '手帕', theme: 'lavender', desc: '手帕與圓盤變形，左右對稱',
      params: { seed: 31, nt: 3, vars: [6, 8], mirror: 1, h0: 260, hs: 70 } },
    { id: 'dots', name: '點字星雲', theme: 'cyber', hue: true, desc: '朱利亞變形的星雲，以點字細細描出',
      params: { seed: 9, nt: 3, vars: [10, 9], sym: 2, style: 1, h0: 180, hs: 160, rate: 170000 } },
  ],
  init(s, f) {
    const p = f.p, rand = mkRand(p.seed * 101);
    s.T = [];
    for (let k = 0; k < p.nt; k++) {
      const a = rand() * TAU, sc = 0.45 + rand() * 0.45, sk = (rand() - 0.5) * 0.6;
      s.T.push({ a0: a, sc, sk, e: (rand() - 0.5) * 1.4, f: (rand() - 0.5) * 1.4, w: [1 - rand() * 0.5, rand() * 0.8], c: k / Math.max(1, p.nt - 1), p: 0.5 + rand(), ph: rand() * TAU, M: [0, 0, 0, 0, 0, 0] });
    }
    let tot = 0;
    for (const T of s.T) tot += T.p;
    let acc = 0;
    for (const T of s.T) { acc += T.p / tot; T.cum = acc; }
    if (p.style) dotInit(s, f);
    const n = p.style ? f.cols * f.rows * 8 : f.cols * f.rows;
    s.h = new Float32Array(n); s.hc = new Float32Array(f.cols * f.rows); s.hn = new Float32Array(f.cols * f.rows);
    s.x = 0.1; s.y = 0.1; s.cc = 0.5; s.fr = 0;
    s.cam = { x0: -1.5, x1: 1.5, y0: -1.5, y1: 1.5 }; s.hmax = 10; s.buf = new Float32Array(2);
    s.sx = new Float32Array(1500); s.sy = new Float32Array(1500); s.si = 0; s.sn = 0; s.camOk = false;
  },
  frame(s, f) {
    const p = f.p, t = f.t, dt = f.dt, cols = f.cols, rows = f.rows, Ts = s.T, nt = Ts.length, out = s.buf, hh = s.h, hc = s.hc, hn = s.hn;
    // 各變換的係數緩慢漂移
    for (const T of Ts) {
      const a = T.a0 + p.drift * Math.sin(t * 0.07 + T.ph) * 3, sc = T.sc * (1 + p.drift * 0.6 * Math.sin(t * 0.05 + T.ph * 2));
      const ca = Math.cos(a) * sc, sa = Math.sin(a) * sc;
      T.M[0] = ca; T.M[1] = -sa + T.sk; T.M[2] = sa; T.M[3] = ca; T.M[4] = T.e + 0.25 * p.drift * Math.sin(t * 0.09 + T.ph); T.M[5] = T.f + 0.25 * p.drift * Math.cos(t * 0.08 + T.ph);
    }
    const k = Math.exp(-dt * p.decay);
    for (let i = 0; i < hh.length; i++) hh[i] *= k;
    for (let i = 0; i < hc.length; i++) { hc[i] *= k; hn[i] *= k; }
    // 視窗：用最近的樣本點取 3%～97% 範圍
    const cam = s.cam, W = p.style ? cols * 2 : cols, Hh = p.style ? rows * 4 : rows, ya = p.style ? 2 / f.aspect : 1 / f.aspect;
    const S = Math.min((W * 0.92) / (cam.x1 - cam.x0), (Hh * 0.92) / ((cam.y1 - cam.y0) * ya)) * p.zoom;
    const cx = (cam.x0 + cam.x1) / 2, cy = (cam.y0 + cam.y1) / 2;
    const vars = p.vars, sym = p.sym, sa = Math.sin(TAU / sym), ca = Math.cos(TAU / sym);
    let x = s.x, y = s.y, cc = s.cc;
    // 每格的點數跟 dt 成正比，但設上限：慢的電腦不會越跑越慢（密度靠時間衰減維持穩定）
    const cf = Math.min(1.6, (cols * rows) / 28160), N = Math.floor(Math.min(p.rate * dt, p.style ? 9000 : 14000) * cf);
    // 視窗取樣用環狀緩衝區跨格累積：縮圖（每格點數少）也能自動對準畫面
    const sxs = s.sx, sys = s.sy, ns = sxs.length, sm = N > 4000 ? 7 : 1;
    let si = s.si, sn = s.sn;
    for (let it = 0; it < N; it++) {
      const r = Math.random();
      let j = 0;
      while (j < nt - 1 && r > Ts[j].cum) j++;
      const T = Ts[j], M = T.M;
      const ax = M[0] * x + M[1] * y + M[4], ay = M[2] * x + M[3] * y + M[5];
      flameVar(vars[0], ax, ay, out);
      let nx = out[0] * T.w[0], ny = out[1] * T.w[0];
      if (vars[1] !== undefined && T.w[1] > 0.05) { flameVar(vars[1], ax, ay, out); nx += out[0] * T.w[1]; ny += out[1] * T.w[1]; }
      x = nx; y = ny;
      if (!(x * x + y * y < 1e6)) { x = Math.random() - 0.5; y = Math.random() - 0.5; continue; }
      cc = (cc + T.c) * 0.5;
      // 對稱：隨機旋轉整數倍角度；鏡像
      let px = x, py = y;
      if (sym > 1) { const m = (Math.random() * sym) | 0; for (let q = 0; q < m; q++) { const tx = px * ca - py * sa; py = px * sa + py * ca; px = tx; } }
      if (p.mirror && Math.random() < 0.5) px = -px;
      if (it < 20) continue;
      if ((it & sm) === 0) { sxs[si] = px; sys[si] = py; if (++si === ns) si = 0; if (sn < ns) sn++; }
      const X = (W >> 1) + (px - cx) * S, Y = (Hh >> 1) + (py - cy) * S * ya;
      if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue;
      const q = (Y | 0) * W + (X | 0);
      hh[q] += 1;
      const ci = p.style ? ((Y | 0) >> 2) * cols + ((X | 0) >> 1) : q;
      hc[ci] += cc; hn[ci] += 1;
    }
    s.x = x; s.y = y; s.cc = cc; s.si = si; s.sn = sn;
    // 每隔幾格更新視窗
    if (++s.fr % 12 === 1 && sn > 200) {
      const a = Array.from(sxs.subarray(0, sn)).sort((m, n) => m - n), b = Array.from(sys.subarray(0, sn)).sort((m, n) => m - n);
      const lo = Math.floor(sn * 0.03), hi = Math.floor(sn * 0.97);
      const tg = { x0: a[lo], x1: a[hi], y0: b[lo], y1: b[hi] }, kk = s.camOk ? 0.25 : 1;
      for (const key of ['x0', 'x1', 'y0', 'y1']) cam[key] += (tg[key] - cam[key]) * kk;
      s.camOk = true;
    }
    // 輸出：對數密度
    const g = f.g, ch = g.ch, co = g.co, H = f.H, R = ' .·:;=+*#%@', RL = R.length - 1;
    let mx = 1;
    if (!p.style) {
      for (let i = 0; i < hh.length; i++) if (hh[i] > mx) mx = hh[i];
      s.hmax += (mx - s.hmax) * 0.1;
      const lm = 1 / Math.log(1 + s.hmax);
      for (let i = 0; i < hh.length; i++) {
        const v = hh[i];
        if (v < 0.6) continue;
        const e = Math.pow(Math.min(1, Math.log(1 + v) * lm), 0.8);
        if (e < 0.08) continue;
        ch[i] = R[Math.min(RL, 1 + ((e * RL) | 0))]; co[i] = H(p.h0 + p.hs * (hc[i] / hn[i]), 0.15 + 0.85 * e);
      }
    } else {
      const DW = W, dm = s.dm, dv = s.dv, dh = s.dhu;
      dm.fill(0); dv.fill(0);
      for (let i = 0; i < hh.length; i++) if (hh[i] > mx) mx = hh[i];
      s.hmax += (mx - s.hmax) * 0.1;
      const lm = 1 / Math.log(1 + s.hmax);
      for (let yy = 0; yy < Hh; yy++) for (let xx = 0; xx < DW; xx++) {
        const q = yy * DW + xx, v = hh[q];
        if (v < 0.8) continue;
        const ci = (yy >> 2) * cols + (xx >> 1);
        dm[ci] |= BRB[((xx & 1) << 2) | (yy & 3)];
        const e = Math.min(1, Math.log(1 + v) * lm);
        if (e > dv[ci]) { dv[ci] = e; dh[ci] = p.h0 + p.hs * (hc[ci] / hn[ci]); }
      }
      for (let i = 0; i < g.n; i++) { if (!dm[i]) continue; ch[i] = BRCH[dm[i]]; co[i] = H(dh[i], 0.25 + 0.75 * dv[i]); }
    }
  } });


})();
