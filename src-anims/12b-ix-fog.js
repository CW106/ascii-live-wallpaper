// 起霧的玻璃（ix-fog）：窗外是夜晚的城市（變化款：清晨的雪林、下雨的街道），窗玻璃起了一層霧。
// 按住滑鼠就像用手指在霧上畫畫：擦過的地方看得見清楚、鮮豔的窗外，霧裡只看得到模糊、暗一點的光暈；
// 筆畫邊緣會聚集小水珠，偶爾有一顆水珠在筆畫底下長大、沿著玻璃歪歪扭扭地流下去；擦過的地方過一陣子又會從邊緣慢慢起霧。
// 只用滑鼠：按住拖曳畫線、點一下按一個指印、滾輪調整手指粗細（不用鍵盤、不用右鍵）。沒人操作時，看不見的手指會自己畫小塗鴉。
// 霧是平滑的整格色塊（█）加上每格一點明暗顆粒；後面的景縮小、模糊、退色，燈在霧裡散成圓圓的光斑。
// 流下來的水珠一停一走、偏向已經濕的路、吞掉路上的小水珠、互相合併，身後留下清楚的水痕和零星的小水珠。
(() => {
/* ════════════ 小工具 ════════════ */
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
// 真彩模式（預設配色＋hue: true，或彩虹配色）才用寫實顏色；換成其他配色時一律交給主題的 C(亮度)
const hueOn = f => f.H(0, 0.6) !== f.H(120, 0.6);
const sst = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
const hsh = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const wideCh = c => { const k = c.codePointAt(0); return k >= 0x2e80 && k < 0xff61; };
const lumOf = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
function grad(stops, v, out) {           // stops: [[位置, r, g, b], ...]（位置由小到大）
  let k = 0;
  while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
  const a = stops[k], b = stops[k + 1], u = clamp((v - a[0]) / (b[0] - a[0]), 0, 1);
  out[0] = a[1] + (b[1] - a[1]) * u; out[1] = a[2] + (b[2] - a[2]) * u; out[2] = a[3] + (b[3] - a[3]) * u;
  return out;
}
// 寫字：全形字占兩格，第二格清掉
function txt(g, x, y, s, col) {
  x = Math.floor(x);
  for (const c of s) { const w = wideCh(c); if (c !== ' ') { g.set(x, y, c, col); if (w) g.set(x + 1, y, ' ', col); } x += w ? 2 : 1; }
}
function blank(g, x, y, w, col) { x = Math.floor(x); for (let k = 0; k < w; k++) g.set(x + k, y, ' ', col); }

/* ════════════ 窗外的景（底圖是靜態的，每格再疊上會動的東西） ════════════ */
// 景裡用到的字元：0 是整格方塊（大部分的景都是一格一格的色塊），其他是小細節（只畫在顏色接近背景的地方，字的周圍才不會露出一塊暗框）
const SG = ['█', '·', '.', '+', '*', '•', '|', "'", ':', '▪', '▀', '▄', ',', '`', '-'];
const G_DOT = 1, G_PER = 2, G_PLUS = 3, G_STAR = 4, G_BUL = 5, G_BAR = 6, G_APO = 7, G_SQ = 9, G_UP = 10, G_LO = 11, G_COM = 12, G_GRV = 13, G_DASH = 14;

function bpx(s, x, y, r, g, b, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= s.W || y >= s.H) return;
  const i = y * s.W + x; s.bR[i] = r; s.bG[i] = g; s.bB[i] = b; s.bC[i] = c || 0;
}
function bmix(s, x, y, r, g, b, a) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= s.W || y >= s.H || !(a > 0)) return;
  if (a > 1) a = 1;
  const i = y * s.W + x; s.bR[i] += (r - s.bR[i]) * a; s.bG[i] += (g - s.bG[i]) * a; s.bB[i] += (b - s.bB[i]) * a;
}
function cpx(s, x, y, r, g, b, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= s.W || y >= s.H) return;
  const i = y * s.W + x; s.cR[i] = r; s.cG[i] = g; s.cB[i] = b; s.cC[i] = c || 0;
}
function cmix(s, x, y, r, g, b, a) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= s.W || y >= s.H || !(a > 0)) return;
  if (a > 1) a = 1;
  const i = y * s.W + x; s.cR[i] += (r - s.cR[i]) * a; s.cG[i] += (g - s.cG[i]) * a; s.cB[i] += (b - s.cB[i]) * a;
}
// 小細節（星星、雪花、雨絲）：底色接近背景就畫字，亮的地方改成把色塊調亮一點
function cdot(s, x, y, gi, r, g, b, a) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= s.W || y >= s.H) return;
  const i = y * s.W + x, L = lumOf(s.cR[i], s.cG[i], s.cB[i]);
  if (s.cC[i] === 0 && L < s.bgL + 16 && L > s.bgL - 14) { s.cC[i] = gi; s.cR[i] = r; s.cG[i] = g; s.cB[i] = b; }
  else { a *= 0.5; s.cR[i] += (r - s.cR[i]) * a; s.cG[i] += (g - s.cG[i]) * a; s.cB[i] += (b - s.cB[i]) * a; }
}
// 光源（霧裡會變成一團柔和的光暈）：靜態的放在 s.lights，會動的每格放進固定大小的 s.dl
const mkLight = (x, y, r, g, b, I, R) => ({ x, y, r, g, b, I, R });
function addL(s, x, y, r, g, b, I, R) {
  if (s.dn >= s.dl.length) return;
  const L = s.dl[s.dn++]; L.x = x; L.y = y; L.r = r; L.g = g; L.b = b; L.I = I; L.R = R;
}
// 一團光暈畫進底圖（清楚的景裡燈的周圍也亮一點）
function bglow(s, cx, cy, R, r, g, b, a) {
  const A = s.A, x0 = Math.floor(cx - R * A), x1 = Math.ceil(cx + R * A), y0 = Math.floor(cy - R), y1 = Math.ceil(cy + R);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot((x + 0.5 - cx) / A, y + 0.5 - cy) / R;
    if (d < 1) bmix(s, x, y, r, g, b, a * (1 - d) * (1 - d));
  }
}

// 雨街一樓的櫥窗：暖色的室內、窗框，裡面有吊燈、書架、桌椅或盆栽
const BOOKC = [[170, 60, 60], [60, 100, 160], [200, 170, 80], [80, 130, 90], [150, 90, 150], [220, 200, 170], [190, 110, 60]];
function shopWindow(s, x0, x1, y0, y1, fc, kind) {
  const H = y1 - y0 + 1, kick = Math.max(1, Math.round(H * 0.16)), gy1 = y1 - kick, mul = Math.max(6, Math.round(rnd(8, 12) * s.sc + 2));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (y > gy1) { bpx(s, x, y, fc[0] * 0.75, fc[1] * 0.75, fc[2] * 0.75, 0); continue; }
    const v = (y - y0) / Math.max(1, gy1 - y0), e = Math.min(x - x0, x1 - x) / 6, vig = 0.78 + 0.22 * Math.min(1, e);
    bpx(s, x, y, (150 + 80 * Math.sin(v * 2.4)) * vig, (90 + 60 * Math.sin(v * 2.4)) * vig, (50 + 34 * Math.sin(v * 2.4)) * vig, 0);
  }
  const gh = gy1 - y0 + 1;
  if (kind === 0) {          // 書店：一層層書架，五顏六色的書背
    for (let y = gy1 - 1; y > y0 + 1; y -= 3) for (let x = x0 + 1; x < x1; x++) {
      bpx(s, x, y, 92, 58, 38, 0);
      if (Math.random() < 0.82) { const c = pick(BOOKC), k = rnd(0.7, 1); bpx(s, x, y - 1, c[0] * k, c[1] * k, c[2] * k, 0); if (Math.random() < 0.5) bpx(s, x, y - 2, c[0] * k * 0.9, c[1] * k * 0.9, c[2] * k * 0.9, 0); }
    }
  } else if (kind === 1) {   // 咖啡館：桌子、椅子、坐著的人、盆栽
    for (let tx = x0 + 3; tx < x1 - 4; tx += rint(9, 13)) {
      const ty = gy1 - Math.max(1, Math.round(gh * 0.28));
      for (let q = 0; q < 4; q++) bpx(s, tx + q, ty, 70, 44, 30, 0);
      for (let y = ty + 1; y <= gy1; y++) bpx(s, tx + 1, y, 60, 38, 28, 0);
      if (Math.random() < 0.6) { const px = tx + (Math.random() < 0.5 ? -2 : 5); bpx(s, px, ty - 2, 40, 28, 30, 0); bpx(s, px, ty - 1, 52, 36, 40, 0); bpx(s, px, ty, 52, 36, 40, 0); bpx(s, px, ty + 1, 40, 28, 30, 0); }
      if (Math.random() < 0.4) bpx(s, tx + 2, ty - 1, 240, 236, 220, 0);
    }
    if (x1 - x0 > 8) { const px = x1 - 2; bpx(s, px, gy1, 120, 70, 50, 0); bpx(s, px, gy1 - 1, 60, 110, 60, 0); bpx(s, px - 1, gy1 - 2, 60, 110, 60, 0); bpx(s, px + 1, gy1 - 2, 50, 96, 52, 0); bpx(s, px, gy1 - 3, 70, 124, 66, 0); }
  } else {                   // 花店：一桶桶的花
    for (let bx = x0 + 2; bx < x1 - 2; bx += rint(4, 6)) {
      const fc2 = pick([[230, 90, 110], [250, 200, 80], [240, 150, 190], [200, 120, 230], [250, 250, 240]]);
      bpx(s, bx, gy1, 60, 70, 90, 0); bpx(s, bx + 1, gy1, 60, 70, 90, 0);
      for (let q = 0; q < 4; q++) { const fx = bx + rint(-1, 2), fy = gy1 - rint(1, 3); bpx(s, fx, fy, fc2[0], fc2[1], fc2[2], 0); }
      bpx(s, bx, gy1 - 1, 50, 100, 50, 0);
    }
  }
  // 吊燈
  for (let lx = x0 + rint(3, 6); lx < x1 - 2; lx += rint(10, 16)) {
    const ly = y0 + Math.max(1, Math.round(gh * 0.18));
    for (let y = y0; y < ly; y++) bpx(s, lx, y, 70, 46, 32, 0);
    bglow(s, lx + 0.5, ly + 0.5, Math.max(1.5, gh * 0.25), 255, 220, 150, 0.35);
    bpx(s, lx, ly, 255, 232, 170, 0); bpx(s, lx + 1, ly, 255, 232, 170, 0);
  }
  // 窗框
  for (let x = x0; x <= x1; x++) bpx(s, x, y0, fc[0] * 0.6, fc[1] * 0.6, fc[2] * 0.6, 0);
  for (let y = y0; y <= gy1; y++) { bpx(s, x0, y, fc[0] * 0.6, fc[1] * 0.6, fc[2] * 0.6, 0); bpx(s, x1, y, fc[0] * 0.6, fc[1] * 0.6, fc[2] * 0.6, 0); }
  for (let x = x0 + mul; x < x1 - 2; x += mul) for (let y = y0; y <= gy1; y++) bpx(s, x, y, fc[0] * 0.55, fc[1] * 0.55, fc[2] * 0.55, 0);
  return gy1;
}
// 3×5 的點陣字（雨街招牌用）
const PIX = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], Z: ['###', '..#', '.#.', '#..', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'],
};

/* ──────── 城市夜景 ──────── */
const WIN_C = [[255, 196, 110], [255, 212, 148], [250, 170, 92], [255, 228, 176], [255, 186, 120], [168, 204, 255], [200, 226, 255], [255, 150, 172]];
const WIN_W = [5, 4, 3, 2, 3, 1.4, 1, 0.5];
function pickW() { let r = Math.random() * 20.3; for (let k = 0; k < WIN_W.length; k++) { r -= WIN_W[k]; if (r <= 0) return k; } return 0; }
function buildCity(s, f) {
  const { W, H, A } = s, c3 = [0, 0, 0];
  const yS = s.yS = Math.round(H * 0.8);
  const SKY = [[0, 16, 19, 34], [0.25, 18, 24, 56], [0.55, 40, 32, 86], [0.8, 96, 52, 104], [1, 176, 96, 104]];
  for (let y = 0; y < yS; y++) {
    grad(SKY, y / (yS - 1), c3);
    for (let x = 0; x < W; x++) { const d = (hsh(x, y) - 0.5) * 5; bpx(s, x, y, c3[0] + d, c3[1] + d, c3[2] + d, 0); }
  }
  // 月亮（右上），淡淡的月暈
  const mx = W * 0.79, my = H * 0.14, mR = Math.max(1.2, H * 0.045);
  for (let y = Math.floor(my - mR * 3.4); y <= my + mR * 3.4; y++) for (let x = Math.floor(mx - mR * 3.4 * A); x <= mx + mR * 3.4 * A; x++) {
    const d = Math.hypot((x + 0.5 - mx) / A, y + 0.5 - my);
    if (d < mR) {
      const cr = Noise.n3(x * 0.3, y * 0.6, 3.3), k = (cr > 0.18 ? 0.88 : 1) * (1 - 0.1 * sst(0.4, 1, d / mR));
      bpx(s, x, y, 248 * k, 240 * k, 214 * k, 0);
    } else bmix(s, x, y, 104, 100, 140, Math.pow(Math.max(0, 1 - (d - mR) / (2.4 * mR)), 2) * 0.4);
  }
  s.lights.push(mkLight(mx, my, 235, 228, 200, 0.6, mR * 1.3));
  // 星星（只在上半部的天空；之後每格閃一閃）
  const st = [];
  for (let y = 0; y < yS * 0.5; y++) for (let x = 0; x < W; x++) {
    if (hsh(x * 7 + 3, y * 13 + 5) > 0.012 || Math.hypot((x - mx) / A, y - my) < mR * 2.6) continue;
    const h = hsh(x, y * 3), gi = h < 0.66 ? G_DOT : h < 0.88 ? G_PER : h < 0.97 ? G_PLUS : G_STAR;
    bpx(s, x, y, 180, 190, 230, gi); st.push(y * W + x);
  }
  s.stars = Int32Array.from(st); s.starP = Float32Array.from(st, () => rnd(TAU)); s.starS = Float32Array.from(st, () => rnd(0.6, 2.4)); s.starB = Float32Array.from(st, () => rnd(0.45, 1));
  // 遠處的大樓（偏紫的剪影，窗戶稀疏又暗）
  const sw = Math.max(1, W / 320);
  for (let x = -rint(0, 4); x < W;) {
    const w = Math.max(3, Math.round(rnd(5, 15) * sw)), h = Math.round(H * rnd(0.17, 0.42)), top = yS - h;
    const br = rnd(36, 48), bg = rnd(30, 38), bb = rnd(62, 78);
    for (let y = top; y < yS; y++) for (let xx = x; xx < x + w; xx++) bpx(s, xx, y, br, bg, bb, 0);
    if (Math.random() < 0.35 && w > 5) { const w2 = Math.round(w * rnd(0.35, 0.6)), x2 = x + Math.round((w - w2) / 2), h2 = Math.max(1, Math.round(H * rnd(0.02, 0.05))); for (let y = top - h2; y < top; y++) for (let xx = x2; xx < x2 + w2; xx++) bpx(s, xx, y, br, bg, bb, 0); }
    for (let y = top + 2; y < yS - 1; y += 2) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (Math.random() < 0.18) { const c = WIN_C[pickW()], k = rnd(0.35, 0.55); bpx(s, xx, y, br + (c[0] - br) * k, bg + (c[1] - bg) * k, bb + (c[2] - bb) * k, 0); }
    x += w + rint(-2, 1);
  }
  // 近處的大樓：顏色接近背景，窗戶用小方塊字（字的周圍露出的背景色剛好就是大樓的顏色）；窗戶記下來，之後隨機開關燈
  s.win = [];
  const towers = [];
  for (let x = -rint(1, 6); x < W;) {
    const w = Math.max(5, Math.round(rnd(10, 26) * sw)), tall = Math.random() < 0.16 && Math.abs(x + w / 2 - mx) > mR * A * 2 + w / 2, h = Math.round(H * (tall ? rnd(0.52, 0.64) : rnd(0.24, 0.5))), top = yS - h;
    const k0 = rnd(-2, 2), body = [16 + k0, 19 + k0, 32 + k0];
    for (let y = top; y < yS; y++) for (let xx = x; xx < x + w; xx++) bpx(s, xx, y, body[0], body[1], body[2], 0);
    for (let xx = x; xx < x + w; xx++) bpx(s, xx, top, 40, 36, 60, 0);                 // 屋頂邊線
    for (let y = top + 1; y < yS; y++) bpx(s, x + w - 1, y, 26, 26, 44, 0);           // 一側的邊光
    const style = rint(0, 3), glyph = [G_SQ, G_UP, G_SQ, G_LO][style], lit = rnd(0.3, 0.66), warm = Math.random() < 0.8;
    const stepX = style === 2 ? 3 : 2;
    for (let y = top + 2; y < yS - 1; y += 2) for (let xx = x + 1; xx < x + w - 2; xx += stepX) {
      const ww = style === 2 ? 2 : 1;
      const on = Math.random() < lit, ci = warm ? pickW() : rint(4, 6), c = WIN_C[ci];
      const o = { i: y * W + xx, w: Math.min(ww, x + w - 2 - xx), on, c, g: glyph };
      s.win.push(o); paintWin(s, o);
    }
    if (tall) towers.push({ x: x + Math.floor(w / 2), top });
    else if (Math.random() < 0.3 && w > 8) {   // 屋頂水塔
      const tx = x + rint(2, w - 5);
      for (let y = top - 3; y < top - 1; y++) for (let xx = tx; xx < tx + 3; xx++) bpx(s, xx, y, 46, 36, 40, 0);
      bpx(s, tx, top - 1, 40, 32, 36, 0); bpx(s, tx + 2, top - 1, 40, 32, 36, 0);
    }
    x += w + rint(0, 3);
  }
  // 高樓的天線和紅色航空燈（之後一閃一閃）
  s.ant = [];
  for (const tw of towers) {
    const ah = Math.max(2, Math.round(H * 0.07));
    for (let y = tw.top - ah; y < tw.top; y++) bpx(s, tw.x, y, 40, 40, 58, 0);
    s.ant.push({ x: tw.x, y: tw.top - ah - 1, ph: rnd(1) });
  }
  // 街道：人行道、路面、分道線、路燈
  for (let y = yS; y < H; y++) for (let x = 0; x < W; x++) {
    const v = (y - yS) / Math.max(1, H - yS - 1);
    if (y === yS) bpx(s, x, y, 48, 44, 58, 0);
    else bpx(s, x, y, 24 - v * 6 + (hsh(x, y) - 0.5) * 3, 24 - v * 6, 34 - v * 8, 0);
  }
  const yM = s.yM = yS + Math.round((H - yS) * 0.52);
  for (let x = 0; x < W; x++) if ((x % 11) < 5) bpx(s, x, yM, 84, 82, 76, 0);
  s.lanes = [yS + Math.max(2, Math.round((H - yS) * 0.34)), Math.min(H - 1, yS + Math.round((H - yS) * 0.8))];
  const nl = Math.max(3, Math.round(W / 64)), lh = Math.max(3, Math.round(H * 0.13));
  for (let k = 0; k < nl; k++) {
    const lx = Math.round(W * (k + 0.5) / nl + rnd(-2, 2)), ly = yS - lh;
    for (let y = ly; y <= yS; y++) bpx(s, lx, y, 42, 42, 54, 0);
    bpx(s, lx + 1, ly, 42, 42, 54, 0); bpx(s, lx + 2, ly, 42, 42, 54, 0);
    bglow(s, lx + 2.5, ly + 1, Math.max(2.5, H * 0.07), 255, 200, 130, 0.5);
    bglow(s, lx + 2.5, yS + 1, Math.max(2, H * 0.06), 255, 196, 120, 0.35);
    bpx(s, lx + 2, ly + 1, 255, 222, 160, 0); bpx(s, lx + 3, ly + 1, 255, 222, 160, 0);
    s.lights.push(mkLight(lx + 3, ly + 1, 255, 170, 90, 1, Math.max(1.6, H * 0.03)));
  }
  s.cars = [];
  s.ct = 0.5;
}
function paintWin(s, o) {
  const W = s.W, x = o.i % W, y = (o.i / W) | 0;
  for (let k = 0; k < o.w; k++) {
    if (o.on) bpx(s, x + k, y, o.c[0], o.c[1], o.c[2], o.g);
    else bpx(s, x + k, y, 30, 32, 52, o.g);
  }
}
const CAR_C = [[150, 38, 48], [44, 72, 140], [196, 188, 170], [52, 54, 64], [178, 124, 44], [60, 120, 110]];
function carStep(s, f, laneRows, dirs, maxN) {
  const dt = f.dt, W = s.W, sc = s.sc;
  s.ct -= dt;
  if (s.ct <= 0 && s.cars.length < maxN) {
    const lane = rint(0, laneRows.length - 1), dir = dirs[lane], len = Math.max(4, Math.round(rnd(7, 10) * Math.max(0.6, W / 320)));
    s.cars.push({ x: dir > 0 ? -len - 2 : W + 2, y: laneRows[lane], dir, v: rnd(9, 20) * Math.max(0.5, W / 320), len, c: pick(CAR_C) });
    s.ct = rnd(1.4, 5);
  }
  for (let k = s.cars.length - 1; k >= 0; k--) {
    const c = s.cars[k];
    c.x += c.dir * c.v * dt;
    if (c.x < -c.len - 30 || c.x > W + 30) { s.cars.splice(k, 1); continue; }
    const x0 = Math.round(c.x), y = c.y, L = c.len, front = c.dir > 0 ? x0 + L - 1 : x0, back = c.dir > 0 ? x0 : x0 + L - 1;
    // 車頭燈照在前面的路上
    for (let q = 1; q <= 9 * sc + 3; q++) { const a = 0.32 * (1 - q / (9 * sc + 4)); cmix(s, front + c.dir * q, y, 210, 200, 160, a); cmix(s, front + c.dir * q, y - 1, 210, 200, 160, a * 0.35); }
    const k1 = 0.55;
    for (let q = 0; q < L; q++) cpx(s, x0 + q, y, c.c[0] * k1, c.c[1] * k1, c.c[2] * k1, 0);
    for (let q = 2; q < L - 2; q++) cpx(s, x0 + q, y - 1, q === 2 || q === L - 3 ? c.c[0] * 0.45 : 70, q === 2 || q === L - 3 ? c.c[1] * 0.45 : 88, q === 2 || q === L - 3 ? c.c[2] * 0.45 : 118, 0);
    cpx(s, front, y, 255, 246, 214, 0); cpx(s, back, y, 255, 46, 40, 0);
    addL(s, front + c.dir * 0.5, y + 0.5, 255, 240, 200, 1, 1.3 * sc + 0.4);
    addL(s, back, y + 0.5, 255, 40, 30, 0.75, 1 * sc + 0.3);
  }
}
function dynCity(s, f) {
  const { t, dt } = f, W = s.W;
  for (let k = 0; k < s.stars.length; k++) {
    const i = s.stars[k], b = s.starB[k] * (0.6 + 0.4 * Math.sin(t * s.starS[k] + s.starP[k]));
    s.cR[i] = 60 + 170 * b; s.cG[i] = 64 + 176 * b; s.cB[i] = 90 + 160 * b;
  }
  // 窗戶隨機開關燈（底圖直接改）
  s.wt = (s.wt || 0) - dt;
  while (s.wt <= 0 && s.win.length) { s.wt += rnd(0.2, 0.7) * 320 / Math.max(160, W); const o = pick(s.win); o.on = !o.on; if (o.on) o.c = WIN_C[pickW()]; paintWin(s, o); }
  for (const a of s.ant) {
    const on = fract(t * 0.55 + a.ph) < 0.16;
    if (on) { cdot(s, a.x, a.y, G_BUL, 255, 70, 60, 1); cmix(s, a.x, a.y + 1, 255, 70, 60, 0.35); addL(s, a.x + 0.5, a.y + 0.5, 255, 50, 40, 0.8, 0.9 + 0.6 * s.sc); }
    else cdot(s, a.x, a.y, G_BUL, 90, 30, 34, 1);
  }
  carStep(s, f, s.lanes, [1, -1], 5);
  // 偶爾一顆流星
  if (!s.met && Math.random() < dt / 40) s.met = { x: rnd(W * 0.1, W * 0.7), y: rnd(1, s.yS * 0.3), u: 0, vx: rnd(30, 50) * (Math.random() < 0.5 ? -1 : 1) };
  if (s.met) {
    const m = s.met; m.u += dt;
    for (let q = 0; q < 8; q++) { const a = (1 - q / 8) * (1 - m.u / 0.9); cdot(s, m.x + m.vx * m.u - Math.sign(m.vx) * q * 1.2, m.y + m.u * 9 - q * 0.25, q ? G_DASH : G_STAR, 230 * a + 20, 230 * a + 20, 255 * a, a); }
    if (m.u > 0.9) s.met = null;
  }
}

/* ──────── 清晨雪林 ──────── */
function pine(s, cx, baseY, h, dark, lit, snow, snowSh, trunk) {
  const A = s.A, tiers = Math.max(2, Math.round(h / 7)), top = baseY - h, trunkH = Math.max(1, Math.round(h * 0.1)), crownB = baseY - trunkH, ch = crownB - top, W0 = h * 0.27;
  const hw = y => {
    const v = (y + 0.5 - top) / ch; if (v < 0 || v > 1) return -1;
    const tf = v * tiers, ti = Math.min(tiers - 1, Math.floor(tf)), u = tf - ti;
    return ti === 0 ? W0 * v * (0.5 + 0.5 * u) * 1.6 : W0 * (v * 0.62 + 0.38 * u);
  };
  for (let y = Math.floor(top); y < crownB; y++) {
    const w = hw(y); if (w < 0) continue;
    const wa = hw(y - 1), xa = Math.floor(cx - w * A), xb = Math.ceil(cx + w * A);
    for (let x = xa; x <= xb; x++) {
      const dx = (x + 0.5 - cx) / A; if (Math.abs(dx) > w) continue;
      const exposed = wa < 0 || Math.abs(dx) > wa - 0.15;
      const side = dx / Math.max(0.3, w);
      if (exposed) { const c = side < -0.2 ? snowSh : snow; bpx(s, x, y, c[0], c[1], c[2], 0); }
      else { const c = side > 0.15 ? lit : dark, n = (hsh(x, y) - 0.5) * 6; bpx(s, x, y, c[0] + n, c[1] + n, c[2] + n, 0); }
    }
  }
  for (let y = crownB; y < baseY; y++) for (let x = Math.round(cx - 0.6); x <= Math.round(cx + 0.4); x++) bpx(s, x, y, trunk[0], trunk[1], trunk[2], 0);
}
function buildSnow(s, f) {
  const { W, H, A } = s, c3 = [0, 0, 0];
  const yG = s.yG = Math.round(H * 0.7);            // 雪地上緣
  const SKY = [[0, 36, 42, 92], [0.3, 82, 74, 134], [0.55, 168, 118, 152], [0.75, 236, 168, 150], [0.9, 250, 204, 160], [1, 252, 222, 178]];
  for (let y = 0; y < yG; y++) {
    grad(SKY, y / (H * 0.66), c3);
    for (let x = 0; x < W; x++) { const d = (hsh(x, y) - 0.5) * 5; bpx(s, x, y, c3[0] + d, c3[1] + d, c3[2] + d, 0); }
  }
  // 快消失的星星
  for (let y = 0; y < H * 0.22; y++) for (let x = 0; x < W; x++) if (hsh(x * 5 + 1, y * 11 + 2) < 0.008) bmix(s, x, y, 230, 230, 250, 0.45 * (1 - y / (H * 0.22)));
  // 遠山的稜線（太陽先畫，山再蓋上去：太陽剛從山後面探出頭）
  const seed = rnd(100);
  const ridge = x => H * (0.43 + 0.1 * Noise.fbm(x * 0.011 + seed, 0.5, 1.3, 4) + 0.035 * Math.sin(x * 0.02 + seed));
  // 太陽（剛從山後面升起）與光暈
  const sx = W * 0.63, sR = Math.max(1.4, H * 0.055), sy = ridge(sx) + sR * 0.15;
  for (let y = Math.floor(sy - sR * 6); y <= sy + sR * 6; y++) for (let x = Math.floor(sx - sR * 6 * A); x <= sx + sR * 6 * A; x++) {
    const d = Math.hypot((x + 0.5 - sx) / A, y + 0.5 - sy);
    if (d < sR) bpx(s, x, y, 255, 244, 214, 0);
    else bmix(s, x, y, 255, 222, 176, Math.pow(Math.max(0, 1 - (d - sR) / (5 * sR)), 2) * 0.6);
  }
  s.lights.push(mkLight(sx, sy, 255, 226, 180, 1, sR * 1.5));
  // 遠山（淡紫，山頂有雪）
  for (let x = 0; x < W; x++) {
    const ry = ridge(x), sl = ridge(x + 1) - ridge(x - 1);
    for (let y = Math.floor(ry); y < yG; y++) {
      const dep = y - ry, haze = sst(H * 0.5, H * 0.68, y) * 0.55;
      let r = 120, g = 108, b = 162;
      if (sl > 0.05) { r -= 14; g -= 12; b -= 10; } else if (sl < -0.05) { r += 10; g += 6; b += 4; }
      if (ry < H * 0.475 && dep < 2.5 + 2 * Noise.n3(x * 0.2, seed, 0.1)) { r = sl > 0.05 ? 196 : 232; g = sl > 0.05 ? 190 : 222; b = sl > 0.05 ? 222 : 240; }
      r += (226 - r) * haze; g += (176 - g) * haze; b += (180 - b) * haze;
      bpx(s, x, y, r, g, b, 0);
    }
  }
  // 近一點的丘陵與遠處的一排小樹
  const hill = x => H * (0.6 + 0.03 * Noise.n3(x * 0.018, seed + 5, 0.7));
  for (let x = 0; x < W; x++) {
    const hy = hill(x);
    for (let y = Math.floor(hy); y < yG; y++) bpx(s, x, y, 104 + (y - hy) * 2, 104 + (y - hy) * 1.5, 152, 0);
    if (hsh(x, 77) < 0.5) { const th = 1 + Math.floor(hsh(x, 78) * 3 * s.sc + 0.5); for (let q = 1; q <= th; q++) bpx(s, x, hy - q + 0.6, 68, 76, 118, 0); }
  }
  // 小木屋和中景雪松的位置先決定好：低低的太陽把它們的影子長長地投在雪地上
  const cw = Math.max(9, Math.round(W * 0.062)), ch = Math.max(3, Math.round(H * 0.075)), cx0 = Math.round(W * 0.27), cyB = Math.round(H * 0.82);
  const mids = [], mid = Math.max(3, Math.round(W / 40));
  for (let k = 0; k < mid; k++) {
    const x = rnd(W * 0.04, W * 0.96); if (Math.abs(x - (cx0 + cw / 2)) < cw * 0.9) continue;
    mids.push([x, Math.round(H * rnd(0.72, 0.78)), H * rnd(0.1, 0.2)]);
  }
  // 影子：從太陽的方向放射出來（太陽在正前方的地平線上，影子朝我們這邊拉長、往兩旁散開），越遠越細
  const casts = [];
  const addCast = (bx, by, hw, len) => { const ddx = (bx - sx) / A, ddy = by - sy, r0 = Math.hypot(ddx, ddy); if (ddy > 0.5) casts.push([Math.atan2(ddy, ddx), Math.atan(hw / r0), r0, len]); };
  for (const [x, by, h] of mids) addCast(x, by + 0.5, h * 0.27, h * 3.4);
  addCast(cx0 + cw / 2, cyB, cw / A / 2 + 0.5, ch * 5);
  // 雪地：遠處被晨光照成粉橘，越近越冷、越藍（近處在山和樹的陰影裡）；擦開時才和白白的霧分得出來
  for (let y = yG; y < H; y++) for (let x = 0; x < W; x++) {
    const v = (y - yG) / Math.max(1, H - yG), n = Noise.n3(x * 0.035, y * 0.22, seed) * 12;
    let r = 248 - v * 40 + n, g = 228 - v * 36 + n, b = 222 - v * 2 + n * 0.6;
    let shd = sst(0.15, 1, v) * 0.5 + 0.12 * (Noise.n3(x * 0.012, y * 0.05, seed + 9) + 0.5);
    const ddx = (x + 0.5 - sx) / A, ddy = y + 0.5 - sy, rr = Math.hypot(ddx, ddy), an = Math.atan2(ddy, ddx);
    for (let k = 0; k < casts.length; k++) {
      const c = casts[k], dr = rr - c[2];
      if (dr < -0.6 || dr > c[3]) continue;
      const tp = 1 - Math.max(0, dr) / c[3], ha = c[1] * (0.3 + 0.7 * tp), da = Math.abs(an - c[0]);
      if (da < ha) shd = Math.max(shd, 0.82 * (1 - sst(ha * 0.55, ha, da)) * Math.min(1, tp * 4));
    }
    shd = Math.min(1, shd);
    r += (112 - r) * shd; g += (124 - g) * shd; b += (198 - b) * shd;
    bpx(s, x, y, r, g, b, 0);
  }
  // 一串腳印從小木屋的門口走過來（一左一右，越近間隔越大）
  {
    const dx0 = cx0 + cw - Math.max(2, Math.round(cw * 0.28)) - 1, span = Math.max(1, H - cyB);
    let side = 1, y = cyB + 1;
    while (y < H) {
      const v = (y - cyB) / span, px = dx0 + v * span * 1.6 * A * 0.5 + Math.sin(v * 3.4) * 2.5 * s.sc + side * (0.5 + v * 1.2 * s.sc);
      const wpr = 1 + Math.round((0.6 + v * 1.2) * s.sc);
      for (let q = 0; q < wpr; q++) bmix(s, px + q, y, 92, 100, 168, q === 0 || q === wpr - 1 ? 0.45 : 0.62);
      side = -side; y += Math.max(1, Math.round((0.7 + v * 1.4) * s.sc));
    }
  }
  // 小木屋（屋頂積雪、窗戶透出暖光、煙囪冒煙）
  const ry = Math.max(2, Math.round(H * 0.06));
  for (let y = cyB - ch; y < cyB; y++) for (let x = cx0; x < cx0 + cw; x++) { const log = (y & 1) ? 0.86 : 1; bpx(s, x, y, 122 * log, 72 * log, 50 * log, 0); }
  for (let q = 0; q < ry; q++) {           // 屋頂：三角形，上面一層厚厚的雪
    const y = cyB - ch - 1 - q, half = (cw / 2 + 2) * (1 - q / ry);
    for (let x = Math.floor(cx0 + cw / 2 - half); x <= Math.ceil(cx0 + cw / 2 + half - 1); x++) bpx(s, x, y, q === 0 ? 60 : 244, q === 0 ? 44 : 242, q === 0 ? 46 : 252, 0);
  }
  for (let x = cx0 - 2; x < cx0 + cw + 2; x++) bpx(s, x, cyB - ch - 1, 70, 50, 50, 0);
  const chx = cx0 + cw - 3, chy = cyB - ch - Math.round(ry * 0.7) - 2;
  for (let y = chy; y < cyB - ch - 1; y++) for (let x = chx; x < chx + 2; x++) bpx(s, x, y, 100, 66, 58, 0);
  bpx(s, chx, chy - 1, 240, 240, 250, 0); bpx(s, chx + 1, chy - 1, 240, 240, 250, 0);
  s.smokeX = chx + 1; s.smokeY = chy - 1.5;
  const wx = cx0 + 2, wy = cyB - ch + 1, ww = Math.max(2, Math.round(cw * 0.3)), wh = Math.max(1, Math.round(ch * 0.4));
  s.cabWin = [];
  for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) { bpx(s, x, y, 255, 206, 120, 0); s.cabWin.push(y * W + x); }
  if (ww >= 3) for (let y = wy; y < wy + wh; y++) bpx(s, wx + (ww >> 1), y, 90, 54, 36, 0);
  s.cabWin = Int32Array.from(s.cabWin.filter(i => s.bR[i] > 200));
  const dx = cx0 + cw - Math.max(2, Math.round(cw * 0.28)) - 1;
  for (let y = cyB - Math.max(2, Math.round(ch * 0.7)); y < cyB; y++) for (let x = dx; x < dx + Math.max(1, Math.round(cw * 0.16)); x++) bpx(s, x, y, 70, 40, 30, 0);
  bglow(s, wx + ww / 2, cyB + 1, Math.max(2, H * 0.05), 255, 196, 120, 0.4);
  s.lights.push(mkLight(wx + ww / 2, wy + wh / 2, 255, 196, 110, 0.9, Math.max(1.2, H * 0.025)));
  // 雪松：中景小棵、兩側近景大棵（像畫框一樣）
  const dark = [22, 50, 58], lit = [40, 76, 76], snow = [230, 236, 250], snowSh = [178, 190, 226], trunk = [70, 48, 42];
  for (const [x, by, h] of mids) pine(s, x, by, h, [36, 64, 78], [54, 88, 96], snow, snowSh, trunk);
  const big = [[0.035, 0.86], [0.11, 0.62], [0.9, 0.7], [0.965, 0.9], [0.5 + rnd(-0.05, 0.08), 0.3]];
  for (const [u, hh] of big) pine(s, W * u + rnd(-2, 2), H + 1, H * hh * rnd(0.92, 1.05), dark, lit, snow, snowSh, trunk);
  // 雪花
  const nf = Math.max(14, Math.round(W * H / 110));
  s.flk = new Float32Array(nf * 4);
  for (let k = 0; k < nf; k++) { s.flk[k * 4] = rnd(W); s.flk[k * 4 + 1] = rnd(H); s.flk[k * 4 + 2] = Math.random() < 0.22 ? rnd(2.6, 4.2) : rnd(1, 2.4); s.flk[k * 4 + 3] = rnd(TAU); }
  s.smoke = [];
  s.smk = 0;
  // 雪地上一閃一閃的冰晶（只在擦開的地方看得到）
  const sp = [];
  for (let y = yG + 1; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (s.bB[i] > 170 && s.bR[i] > 90 && hsh(x * 13 + 7, y * 17 + 3) < 0.03) sp.push(i); }
  s.spk = Int32Array.from(sp); s.spkP = Float32Array.from(sp, () => rnd(TAU)); s.spkS = Float32Array.from(sp, () => rnd(0.5, 1.6));
}
function dynSnow(s, f) {
  const { t, dt } = f, W = s.W, H = s.H, F = s.flk, n = F.length >> 2, wind = 2.2 + 1.6 * Math.sin(t * 0.13), sc = s.sc;
  // 窗戶裡的爐火忽明忽暗
  const fl = 0.85 + 0.15 * Noise.n3(t * 1.7, 3.1, 0.2);
  for (let k = 0; k < s.cabWin.length; k++) { const i = s.cabWin[k]; s.cR[i] = 255 * fl; s.cG[i] = 200 * fl; s.cB[i] = 112 * fl; }
  // 煙囪的煙
  s.smk -= dt;
  if (s.smk <= 0) { s.smoke.push({ x: s.smokeX, y: s.smokeY, u: 0, r: rnd(0.4, 0.8) }); s.smk = rnd(0.35, 0.7); }
  for (let k = s.smoke.length - 1; k >= 0; k--) {
    const p = s.smoke[k]; p.u += dt / 7; p.y -= dt * 1.4 * sc; p.x += dt * (wind * 0.8 + Math.sin(t + k) * 0.5);
    if (p.u >= 1) { s.smoke.splice(k, 1); continue; }
    const R = (p.r + p.u * 2.2) * sc + 0.4, a = 0.42 * (1 - p.u) * sst(0, 0.08, p.u);
    for (let y = Math.floor(p.y - R); y <= p.y + R; y++) for (let x = Math.floor(p.x - R * s.A); x <= p.x + R * s.A; x++) {
      const ex = (x + 0.5 - p.x) / s.A, ey = y + 0.5 - p.y, d = Math.sqrt(ex * ex + ey * ey) / R; if (d < 1) cmix(s, x, y, 214, 208, 222, a * (1 - d));
    }
  }
  // 雪花（大片的近、快、晃得多）
  for (let k = 0; k < n; k++) {
    const o = k * 4, v = F[o + 2];
    F[o + 1] += v * dt * sc * 1.1; F[o] += (wind * v * 0.35 + Math.sin(t * 1.3 + F[o + 3]) * v * 0.5) * dt;
    if (F[o + 1] > H) { F[o + 1] = -1; F[o] = rnd(-W * 0.1, W); }
    if (F[o] > W + 1) F[o] -= W + 2;
    const big = v > 2.5;
    cdot(s, F[o], F[o + 1], big ? G_BUL : G_DOT, 250, 252, 255, big ? 0.85 : 0.5);
  }
}
// 冰晶在霧的模糊視野算完之後才閃（透過霧看不到這麼小的閃光，也不會讓霧跟著閃）
function dynSnowPost(s, f) {
  const t = f.t, P = s.spk, PP = s.spkP, PS = s.spkS;
  for (let k = 0; k < P.length; k++) {
    const w = Math.sin(t * PS[k] + PP[k]); if (w < 0.93) continue;
    const i = P[k], a = (w - 0.93) / 0.07 * 0.85;
    s.cR[i] += (255 - s.cR[i]) * a; s.cG[i] += (255 - s.cG[i]) * a; s.cB[i] += (255 - s.cB[i]) * a;
  }
}

/* ──────── 雨夜街道 ──────── */
const SIGNS = ['CAFE', 'BAR', 'BOOKS', 'OPEN', 'JAZZ', '24H', 'RAMEN'];
const NEON = [[255, 84, 170], [90, 226, 255], [255, 186, 80], [130, 255, 160], [190, 120, 255]];
const FACADE = [[64, 34, 36], [26, 44, 52], [40, 38, 52], [62, 52, 44], [44, 30, 48]];
const AWN = [[150, 46, 50], [44, 108, 84], [46, 70, 140], [170, 110, 40]];
function buildRain(s, f) {
  const { W, H, A } = s, sc = s.sc;
  const yB = s.yB = Math.round(H * 0.64);          // 人行道
  const yA = Math.round(H * 0.36);                 // 遮雨棚
  for (let y = 0; y < yB; y++) for (let x = 0; x < W; x++) { const n = Noise.n3(x * 0.03, y * 0.15, 4.4) * 6; bpx(s, x, y, 22 + n + y * 0.1, 26 + n + y * 0.1, 40 + n, 0); }
  s.neon = [];
  let x = -rint(0, 3), bi = rint(0, FACADE.length - 1), si = rint(0, SIGNS.length - 1), sn = 0;
  const signsOn = H >= 34;
  while (x < W) {
    const w = Math.max(14, Math.round(W * rnd(0.17, 0.27))), top = Math.round(H * rnd(0.03, 0.14)), fc = FACADE[bi++ % FACADE.length];
    for (let y = top; y < yB; y++) for (let xx = x; xx < x + w; xx++) { const n = (hsh(xx, y) - 0.5) * 6; bpx(s, xx, y, fc[0] + n, fc[1] + n, fc[2] + n, 0); }
    for (let xx = x - 1; xx <= x + w; xx++) { bpx(s, xx, top, fc[0] * 1.5 + 14, fc[1] * 1.5 + 14, fc[2] * 1.5 + 14, 0); bpx(s, xx, top + 1, fc[0] * 0.6, fc[1] * 0.6, fc[2] * 0.6, 0); }
    // 樓上的窗戶（暖光、窗簾、花台）
    const wwin = Math.max(3, Math.round(W * 0.03)), hwin = Math.max(2, Math.round((yA - top) * 0.5)), nw = Math.max(1, Math.floor((w - 2) / (wwin + Math.max(3, Math.round(W * 0.02)))));
    const gap = (w - nw * wwin) / (nw + 1), wy0 = Math.round(top + (yA - top - hwin) * 0.5);
    for (let k = 0; k < nw; k++) {
      const wx0 = Math.round(x + gap + k * (wwin + gap)), on = Math.random() < 0.7, cur = pick([[120, 40, 50], [60, 90, 70], [150, 110, 60]]);
      for (let y = wy0; y < wy0 + hwin; y++) for (let xx = wx0; xx < wx0 + wwin; xx++) {
        const v = (y - wy0) / Math.max(1, hwin - 1);
        let r = on ? 170 + 70 * v : 26, g = on ? 110 + 60 * v : 30, b = on ? 60 + 40 * v : 44;
        if (on && (xx === wx0 || xx === wx0 + wwin - 1) && wwin >= 4) { r = cur[0]; g = cur[1]; b = cur[2]; }
        if (xx === wx0 + (wwin >> 1) || y === wy0 + (hwin >> 1)) { r *= 0.3; g *= 0.3; b *= 0.3; }
        bpx(s, xx, y, r, g, b, 0);
      }
      for (let xx = wx0 - 1; xx <= wx0 + wwin; xx++) bpx(s, xx, wy0 + hwin, fc[0] * 1.6 + 20, fc[1] * 1.6 + 20, fc[2] * 1.6 + 20, 0);
      if (Math.random() < 0.45) for (let xx = wx0; xx < wx0 + wwin; xx++) bpx(s, xx, wy0 + hwin - 1, ...(hsh(xx, 9) < 0.5 ? [220, 70, 90] : [70, 130, 70]), 0);
      if (on) s.lights.push(mkLight(wx0 + wwin / 2, wy0 + hwin / 2, 240, 160, 90, 0.2, hwin * 0.4));
    }
    // 遮雨棚（條紋、底下一排小燈泡）
    const ac = AWN[rint(0, AWN.length - 1)], ah = Math.max(2, Math.round(H * 0.045));
    for (let y = yA; y < yA + ah; y++) for (let xx = x; xx < x + w; xx++) { const st = ((xx - x) >> 1) & 1, sh = 0.7 + 0.3 * (y - yA) / ah; bpx(s, xx, y, (st ? ac[0] : 196) * sh, (st ? ac[1] : 184) * sh, (st ? ac[2] : 164) * sh, 0); }
    for (let xx = x; xx < x + w; xx += 2) { const st = ((xx - x) >> 1) & 1; bpx(s, xx, yA + ah, st ? ac[0] * 0.7 : 150, st ? ac[1] * 0.7 : 140, st ? ac[2] * 0.7 : 126, 0); }
    const bulbs = Math.random() < 0.6;
    // 一樓的店面：暖色的大櫥窗、門
    const sy0 = yA + ah + 1, door = Math.max(2, Math.round(w * 0.16)), dx0 = x + w - door - 2;
    for (let y = sy0; y < yB; y++) for (let xx = dx0; xx < dx0 + door; xx++) { const gl = y < sy0 + (yB - sy0) * 0.45 && xx > dx0 && xx < dx0 + door - 1; bpx(s, xx, y, gl ? 220 : 52, gl ? 150 : 34, gl ? 80 : 30, 0); }
    // 招牌先決定好，店裡的樣子跟著招牌（書店有書架、咖啡館和酒吧有桌子）
    const hasSign = signsOn && sn < 3 && Math.random() < 0.85, word = hasSign ? SIGNS[si++ % SIGNS.length] : '';
    const sill = shopWindow(s, x + 1, dx0 - 2, sy0, yB - 1, fc, word === 'BOOKS' ? 0 : /CAFE|BAR|JAZZ|RAMEN/.test(word) ? 1 : rint(0, 2));
    // 櫥窗裡有一隻貓
    if (Math.random() < 0.5 && dx0 - x > 10) {
      const kx = x + rint(3, dx0 - x - 7), ky = sill;
      const CAT = ['#.#.', '###.', '####', '#####'];
      for (let r = 0; r < CAT.length; r++) for (let q = 0; q < CAT[r].length; q++) if (CAT[r][q] === '#') bpx(s, kx + q, ky - CAT.length + 1 + r, 34, 24, 26, 0);
    }
    s.lights.push(mkLight(x + (dx0 - x) / 2, (sy0 + yB) / 2, 255, 190, 120, 0.2, Math.max(1.5, (yB - sy0) * 0.4)));
    if (bulbs) for (let xx = x + 1; xx < x + w - 1; xx += 3) { bpx(s, xx, yA + ah + 1, 255, 226, 150, 0); s.lights.push(mkLight(xx + 0.5, yA + ah + 1.5, 255, 214, 140, 0.22, 0.6 + 0.4 * sc)); }
    // 霓虹招牌
    if (hasSign) {
      const col = NEON[(si + bi) % NEON.length], sw = word.length * 4 - 1;
      if (sw + 4 < w) {
        const sx = x + Math.round((w - sw) / 2), sy = Math.max(top + 3, yA - 7);
        const cells = [];
        bglow(s, sx + sw / 2, sy + 2.5, Math.max(3, sw / A * 0.7), col[0], col[1], col[2], 0.35);
        for (let k = 0; k < word.length; k++) { const P = PIX[word[k]]; if (!P) continue; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (P[r][q] === '#') { bpx(s, sx + k * 4 + q, sy + r, col[0], col[1], col[2], 0); cells.push((sy + r) * W + sx + k * 4 + q); } }
        const L = mkLight(sx + sw / 2, sy + 2.5, col[0], col[1], col[2], 0.9, Math.max(1.8, sw / A * 0.45));
        s.lights.push(L);
        s.neon.push({ cells: Int32Array.from(cells), col, L, flick: 0, next: rnd(3, 12) });
        sn++;
      }
    }
    x += w + rint(0, 2);
  }
  // 人行道、路緣、濕的馬路
  for (let y = yB; y < H; y++) for (let xx = 0; xx < W; xx++) {
    if (y < yB + 2) bpx(s, xx, y, 40 + (xx % 9 === 0 ? -8 : 0), 40, 52, 0);
    else if (y === yB + 2) bpx(s, xx, y, 66, 64, 74, 0);
    else bpx(s, xx, y, 13, 15, 23, 0);
  }
  s.road0 = yB + 3;
  // 路燈（左邊）與紅綠燈（右邊）
  const lx = Math.round(W * 0.07), ly = Math.round(H * 0.2);
  for (let y = ly; y < yB + 1; y++) bpx(s, lx, y, 34, 34, 40, 0);
  for (let q = 1; q <= 3; q++) bpx(s, lx + q, ly, 34, 34, 40, 0);
  bglow(s, lx + 3.5, ly + 1, Math.max(3, H * 0.09), 255, 206, 140, 0.45);
  bpx(s, lx + 3, ly + 1, 255, 228, 170, 0); bpx(s, lx + 4, ly + 1, 255, 228, 170, 0);
  s.lights.push(mkLight(lx + 4, ly + 1.5, 255, 176, 96, 1, Math.max(1.8, H * 0.035)));
  const tx = Math.round(W * 0.9), ty = Math.round(H * 0.24), th = Math.max(5, Math.round(H * 0.11));
  for (let y = ty + th; y < yB + 1; y++) bpx(s, tx + 1, y, 34, 34, 40, 0);
  for (let y = ty; y < ty + th; y++) for (let q = 0; q < 3; q++) bpx(s, tx + q, y, 22, 22, 26, 0);
  s.tl = { x: tx + 1, ys: [ty + Math.round(th * 0.18), ty + Math.round(th * 0.5), ty + Math.round(th * 0.82)], st: 2, tt: rnd(2, 8) };
  // 雨絲與水花
  const nr = Math.max(30, Math.round(W * H / 50));
  s.rain = new Float32Array(nr * 4);
  for (let k = 0; k < nr; k++) { s.rain[k * 4] = rnd(W); s.rain[k * 4 + 1] = rnd(-H, H); s.rain[k * 4 + 2] = rnd(0.6, 1); s.rain[k * 4 + 3] = rnd(H * 0.3, H); }
  s.spl = new Float32Array(64 * 3); s.spn = 0;
  // 倒影左右晃動用的表：sin(ph + 0.13x) = sin(ph)·cos(0.13x) + cos(ph)·sin(0.13x)，每列只要算一次 sin、cos
  s.rSin = new Float64Array(W); s.rCos = new Float64Array(W);
  for (let q = 0; q < W; q++) { s.rSin[q] = Math.sin(q * 0.13); s.rCos[q] = Math.cos(q * 0.13); }
  s.peds = []; s.pt = rnd(2, 8);
  s.cars = []; s.ct = rnd(3, 8);
}
const TL_C = [[255, 50, 40], [255, 190, 40], [60, 255, 140]];
function dynRain(s, f) {
  const { t, dt } = f, W = s.W, H = s.H, A = s.A, sc = s.sc, yB = s.yB;
  // 霓虹招牌偶爾「滋」地暗一兩下（慢慢的，每秒不到 3 次）；霧裡的光暈只跟著稍微暗一點、平滑地變，大片的霧才不會一閃一閃
  for (const nb of s.neon) {
    nb.next -= dt;
    if (nb.next <= 0) { nb.flick = rnd(0.25, 0.75); nb.next = rnd(5, 16); }
    let on = 1;
    if (nb.flick > 0) { nb.flick -= dt; on = Math.sin(nb.flick * 14) > 0.1 ? 1 : 0.18; }
    if (on < 1) for (let k = 0; k < nb.cells.length; k++) { const i = nb.cells[k]; s.cR[i] *= on; s.cG[i] *= on; s.cB[i] *= on; }
    nb.L.I += (0.9 * (on < 1 ? 0.6 : 1) - nb.L.I) * Math.min(1, dt * 4);
  }
  // 紅綠燈：綠 → 黃 → 紅
  const tl = s.tl; tl.tt -= dt;
  if (tl.tt <= 0) { tl.st = tl.st === 2 ? 1 : tl.st === 1 ? 0 : 2; tl.tt = tl.st === 1 ? 2.2 : rnd(7, 11); }
  for (let k = 0; k < 3; k++) { const on = k === tl.st, c = TL_C[k], kk = on ? 1 : 0.16; cpx(s, tl.x, tl.ys[k], c[0] * kk, c[1] * kk, c[2] * kk, 0); if (on) { cmix(s, tl.x - 1, tl.ys[k], c[0], c[1], c[2], 0.25); cmix(s, tl.x + 1, tl.ys[k], c[0], c[1], c[2], 0.25); addL(s, tl.x + 0.5, tl.ys[k] + 0.5, c[0], c[1], c[2], 1, 1.2 + 0.8 * sc); } }
  // 撐傘的路人走過人行道
  s.pt -= dt;
  if (s.pt <= 0 && s.peds.length < 3) { const d = Math.random() < 0.5 ? 1 : -1; s.peds.push({ x: d > 0 ? -6 : W + 6, d, v: rnd(3, 5.5) * Math.max(0.6, W / 320), c: pick([[200, 50, 60], [230, 190, 60], [60, 110, 200], [220, 220, 230], [120, 70, 160]]), ph: rnd(TAU) }); s.pt = rnd(6, 16); }
  for (let k = s.peds.length - 1; k >= 0; k--) {
    const p = s.peds[k]; p.x += p.d * p.v * dt;
    if (p.x < -10 || p.x > W + 10) { s.peds.splice(k, 1); continue; }
    const px = Math.round(p.x), py = yB + 1, step = Math.floor(t * p.v * 0.9 + p.ph) & 1, c = p.c, k1 = 0.8;
    for (let q = -1; q <= 1; q++) cpx(s, px + q, py - 5, c[0] * k1, c[1] * k1, c[2] * k1, 0);
    for (let q = -3; q <= 3; q++) cpx(s, px + q, py - 4, c[0] * k1 * (q === -3 || q === 3 ? 0.8 : 1), c[1] * k1, c[2] * k1, 0);
    cpx(s, px, py - 3, 30, 28, 36, 0); cpx(s, px, py - 2, 30, 28, 36, 0); cpx(s, px - p.d, py - 2, 40, 36, 44, 0);
    cpx(s, px - (step ? 1 : 0), py - 1, 24, 22, 28, 0); cpx(s, px + (step ? 0 : 1), py - 1, 24, 22, 28, 0);
  }
  // 車
  carStep(s, f, [Math.min(H - 1, s.road0 + Math.max(2, Math.round((H - s.road0) * 0.45)))], [Math.random() < 0.5 ? 1 : -1], 2);
  // 濕馬路的倒影：把上面的景上下顛倒、拉長，加上一點左右晃動
  const r0 = s.road0, SX = s.rSin, CX = s.rCos;
  for (let y = r0; y < H; y++) {
    const dy = y - r0, sy = yB - 1 - Math.floor(dy * 0.55), fade = 0.3 * (1 - dy / (H - r0 + 4));
    if (sy < 0) continue;
    const ph = t * 2.2 + y * 1.7, sp = Math.sin(ph), cp = Math.cos(ph), amp = 0.6 + dy * 0.06;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (s.cR[i] > 40) continue;         // 車子本身不要被倒影蓋掉
      let sx = x + Math.round((sp * CX[x] + cp * SX[x]) * amp); sx = sx < 0 ? 0 : sx > W - 1 ? W - 1 : sx;
      const j = sy * W + sx;
      s.cR[i] += s.cR[j] * fade; s.cG[i] += s.cG[j] * fade; s.cB[i] += s.cB[j] * fade;
    }
  }
}
// 雨絲和水花：在霧的模糊視野算完之後才畫（細細的、會動的雨絲透過霧本來就看不見；
// 算進模糊裡反而會讓整片霧的顏色每格一直跳），所以只出現在擦乾淨的地方
function dynRainPrecip(s, f) {
  const dt = f.dt, W = s.W, H = s.H, sc = s.sc, yB = s.yB;
  const R = s.rain, nr = R.length >> 2, wind = 0.12;
  for (let k = 0; k < nr; k++) {
    const o = k * 4; R[o + 1] += (34 + 22 * R[o + 2]) * sc * dt * 1.1; R[o] += wind * 30 * dt * R[o + 2];
    if (R[o + 1] > R[o + 3]) {
      if (R[o + 3] > yB && s.spn < 64) { const q = s.spn++ * 3; s.spl[q] = R[o]; s.spl[q + 1] = R[o + 3]; s.spl[q + 2] = 0; }
      R[o + 1] = rnd(-6, 0); R[o] = rnd(-4, W); R[o + 3] = Math.random() < 0.45 ? rnd(yB, H) : rnd(H * 0.2, H);
    }
    const a = 0.5 * R[o + 2], c = 150 + 60 * R[o + 2];
    cdot(s, R[o], R[o + 1], G_BAR, c * 0.78, c * 0.86, c, a);
    if (R[o + 2] > 0.8) cdot(s, R[o] - wind, R[o + 1] - 1, G_APO, c * 0.6, c * 0.68, c * 0.8, a * 0.6);
  }
  // 水花
  for (let k = s.spn - 1; k >= 0; k--) {
    const q = k * 3; s.spl[q + 2] += dt;
    if (s.spl[q + 2] > 0.22) { s.spn--; s.spl[q] = s.spl[s.spn * 3]; s.spl[q + 1] = s.spl[s.spn * 3 + 1]; s.spl[q + 2] = s.spl[s.spn * 3 + 2]; continue; }
    const u = s.spl[q + 2] / 0.22;
    cdot(s, s.spl[q], s.spl[q + 1], u < 0.5 ? G_PER : G_COM, 170, 190, 220, 0.6);
    if (u > 0.4) { cdot(s, s.spl[q] - 1, s.spl[q + 1], G_GRV, 120, 140, 170, 0.4); cdot(s, s.spl[q] + 1, s.spl[q + 1], G_APO, 120, 140, 170, 0.4); }
  }
}

// 每個景的霧：bg 背景色、tint 霧本身散射的光（amb 強度，warm = 左下角室內暖光的顏色）、dim/sat 霧後面的景變暗、退色多少、
// bokeh 點光源在霧裡散開的光斑強度、grain 顆粒明暗差、spk 比較亮的小水氣比例、ambVar 霧的亮度不均勻、ambBot 底部比較濃比較亮、drops 水珠多寡
const SCENES = {
  city: { build: buildCity, dyn: dynCity, bg: [16, 19, 32], tint: [118, 132, 162], warm: [168, 136, 108], amb: 0.42, dim: 0.85, sat: 0.8, bokeh: 0.7, grain: 0.09, spk: 0.03, ambVar: 0.3, ambBot: 0.22, drops: 1 },
  snow: { build: buildSnow, dyn: dynSnow, post: dynSnowPost, bg: [104, 98, 136], tint: [228, 232, 246], warm: [244, 214, 190], amb: 0.5, dim: 0.52, sat: 0.42, bokeh: 0.3, grain: 0.05, spk: 0.022, ambVar: 0.16, ambBot: 0.3, drops: 0.7 },
  rain: { build: buildRain, dyn: dynRain, post: dynRainPrecip, bg: [14, 17, 28], tint: [110, 128, 154], warm: [160, 130, 104], amb: 0.42, dim: 0.7, sat: 0.78, bokeh: 0.75, grain: 0.09, spk: 0.03, ambVar: 0.3, ambBot: 0.22, drops: 1.6 },
};

/* ════════════ 霧 ════════════ */
// 霧一律用整格的 █（App 會把連續的 █ 畫成平滑的色塊）；░▒▓ 在實際的字型大小下會出現橫紋和斜線，看起來像紗窗，所以不用。
// 霧的顆粒感交給每格固定的一點明暗差（GR）和零星幾格比較亮的小水氣（G2）。
// 筆畫邊緣的小水珠：大小 1 只是霧上一點反光（整格），2、3 用字元畫成透明的小圓珠（小畫面一律只用反光）
const BEAD = ['', '.', '∘', 'o'];
const D0 = 0.14, D1 = 0.46;          // 霧濃度低於 D0 = 完全擦乾淨；D0–D1 之間是邊緣、正在起霧的地方；以上 = 霧

// 用手指擦過一段（膠囊形狀：兩端是圓的）。R = 半徑（以列為單位；橫向自動乘上字高比）
const RIDGE = 0.2;
function wipeSeg(s, x0, y0, x1, y1, R, hold) {
  const A = s.A, W = s.W, H = s.H, F = s.F, T = s.T, HD = s.HD, BD = s.BD;
  const ax = x0 / A, ay = y0, bx = x1 / A, by = y1, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, ext = R * 1.6, iR = 1 / R;
  const xa = Math.max(0, Math.floor((Math.min(ax, bx) - ext) * A)), xb = Math.min(W - 1, Math.ceil((Math.max(ax, bx) + ext) * A));
  const ya = Math.max(0, Math.floor(Math.min(ay, by) - ext)), yb = Math.min(H - 1, Math.ceil(Math.max(ay, by) + ext));
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5, ro = y * W;
    for (let x = xa; x <= xb; x++) {
      const px = (x + 0.5) / A;
      let u = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = px - ax - dx * u, ey = py - ay - dy * u, q = Math.sqrt(ex * ex + ey * ey) * iR;
      if (q >= 1.55) continue;
      const i = ro + x;
      if (q >= 1.2) {      // 手指把水氣推到旁邊：筆畫外面一圈霧比較厚、比較亮（之後慢慢回到原本的濃度）
        const rg = T[i] + RIDGE * (1 - Math.abs(q - 1.36) / 0.19);
        if (F[i] >= T[i] * 0.9 && F[i] < rg) F[i] = rg;
        continue;
      }
      const lim = q < 0.72 ? 0 : T[i] * sst(0.72, 1.2, q);
      if (F[i] > lim) F[i] = lim;
      const h = hold * (1 - q * 0.8);
      if (HD[i] < h) HD[i] = h;
      if (q < 0.92) BD[i] = 0;
    }
  }
}
// 筆畫的邊緣聚集小水珠（沿著線段每隔一段放幾顆，數量和長度成正比）
function rimBeads(s, x0, y0, x1, y1, R, rate) {
  const A = s.A, len = Math.hypot((x1 - x0) / A, y1 - y0), n = len / (R * 0.45) + (len === 0 ? 3 : 0);
  let k = Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0);
  const nx = len > 0 ? -(y1 - y0) / len : 0, ny = len > 0 ? (x1 - x0) / A / len : 1;
  while (k-- > 0) {
    if (Math.random() > rate * s.bk) continue;
    const u = Math.random(), cx = x0 + (x1 - x0) * u, cy = y0 + (y1 - y0) * u;
    let ox, oy;
    if (len === 0) { const a = rnd(TAU); ox = Math.cos(a); oy = Math.sin(a); } else { const sd = Math.random() < 0.5 ? -1 : 1, a = rnd(-0.5, 0.5); ox = (nx * Math.cos(a) - ny * Math.sin(a) * 0.3) * sd; oy = (ny * Math.cos(a) + nx * Math.sin(a) * 0.3) * sd; }
    const d = R * rnd(1.02, 1.28), bx = Math.floor(cx + ox * d * A), by = Math.floor(cy + oy * d);
    if (bx < 0 || by < 0 || bx >= s.W || by >= s.H) continue;
    const i = by * s.W + bx;
    if (s.F[i] < s.T[i] * 0.45 || s.BD[i] > 0) continue;
    s.BD[i] = rnd(25, 80); s.BS[i] = Math.random() < 0.55 ? 1 : Math.random() < 0.7 ? 2 : 3;
  }
}
// 一筆的開始、經過、結束：記下最低點，結束時有機會在最低點長出一顆水珠
function strokeBegin(s, x, y) { const k = s.stk; k.on = true; k.len = 0; k.lx = x; k.ly = y; }
function strokeSeg(s, x0, y0, x1, y1, R, hold, beadRate) {
  wipeSeg(s, x0, y0, x1, y1, R, hold);
  rimBeads(s, x0, y0, x1, y1, R, beadRate);
  const k = s.stk, L = Math.hypot((x1 - x0) / s.A, y1 - y0);
  k.len += L; k.R = R;
  s.wet += L / s.H * s.cf.drops;          // 擦掉的水氣累積起來，夠多了才在筆畫底下聚成一顆會流的水珠
  if (y1 > k.ly) { k.ly = y1; k.lx = x1; }
  if (s.wet > s.wetAt * 2) { s.wet -= s.wetAt; s.wetAt = rnd(1, 1.8); spawnDrop(s, k.lx, k.ly + R * 0.95, 0.25, rnd(2.5, 6)); k.ly = -1e9; }
}
function strokeEnd(s) {
  const k = s.stk; if (!k.on) return; k.on = false;
  if (s.wet > s.wetAt && k.ly > -1e8) { s.wet -= s.wetAt; s.wetAt = rnd(1, 1.8); spawnDrop(s, k.lx, k.ly + (k.R || 1) * 0.95, 0.3, rnd(1.5, 4.5)); }
}

/* ──────── 流下來的水珠 ──────── */
const MAX_DROPS = 18, WET_OFS = [-1, 1, -2, 2];
function spawnDrop(s, x, y, m0, grow) {
  if (s.drops.length >= MAX_DROPS || y >= s.H - 2 || y < 0 || x < 0 || x >= s.W) return;
  s.drops.push({ x, y, m: m0, gr: (1 - m0) / grow, st: 0, vy: 0, pause: 0, ph: rnd(TAU), side: 0, row: Math.floor(y) });
}
function dropStep(s, f) {
  const dt = f.dt, W = s.W, H = s.H, sc = s.sc, F = s.F, T = s.T;
  // 自然凝結的水珠：霧夠濃的地方偶爾自己長一顆
  s.nt -= dt * s.cf.drops;
  if (s.nt <= 0) {
    s.nt = rnd(8, 18);
    for (let k = 0; k < 6; k++) { const x = rnd(2, W - 2), y = rnd(H * 0.03, H * 0.65), i = Math.floor(y) * W + Math.floor(x); if (F[i] > T[i] * 0.85) { spawnDrop(s, x, y, 0.15, rnd(3, 7)); break; } }
  }
  const BD = s.BD, BS = s.BS, drops = s.drops;
  for (let k = drops.length - 1; k >= 0; k--) {
    const d = drops[k];
    if (d.st === 0) { d.m += d.gr * dt; if (d.m >= 1) { d.m = 1; d.st = 1; d.vy = 0.5; d.row = Math.floor(d.y); } continue; }
    // 一頓一頓地往下流（黏住、滑下去）：越小的水珠越容易卡住；左右稍微歪來歪去
    if (!(d.row >= -1)) d.row = Math.floor(d.y);
    const mm = Math.min(1.6, d.m);
    if (d.pause > 0) { d.pause -= dt; d.vy *= Math.exp(-dt * 12); }
    else if (Math.random() < dt * 0.5 * Math.max(0.35, 1.5 - mm)) d.pause = rnd(0.15, 0.8) * Math.max(0.15, 1.4 - mm);
    else { const vt = (2.2 + 9 * mm * mm) * sc; d.vy += (vt - d.vy) * Math.min(1, dt * 3); }
    const ny = Math.min(H, d.y + d.vy * dt);
    if (Math.random() < dt * 1.3) d.side = rnd(-1, 1) * 1.6;
    d.side *= Math.exp(-dt * 0.8);
    let nx = clamp(d.x + (d.side + Math.sin(f.t * 1.7 + d.ph) * 0.4) * dt * d.vy * 0.25, 0.5, W - 1.5), lb = -1;
    // 每往下一列：偏向已經濕的（霧比較薄的）路、吞掉路上的小水珠、吸一點霧裡的水、偶爾在身後留下一顆小水珠
    while (d.row < Math.floor(ny) && d.row < H - 1) {
      d.row++;
      const ro = d.row * W, xi = Math.floor(nx);
      if (xi > 1 && xi < W - 2) {     // 旁邊兩格內有已經濕的路（霧明顯比較薄）就往那邊靠
        const fc = F[ro + xi] - 0.3;
        let dir = 0, best = fc;
        for (const o of WET_OFS) { const v = F[ro + xi + o] + (o > 1 || o < -1 ? 0.05 : 0); if (v < best) { best = v; dir = o; } }
        if (dir) nx += dir > 0 ? 0.35 : -0.35;
      }
      nx = clamp(nx, 0.5, W - 1.5);
      const x = Math.floor(nx), i = ro + x;
      for (let dx = -1; dx <= 1; dx++) { const j = i + dx; if (x + dx >= 0 && x + dx < W && BD[j] > 0) { d.m += 0.025 * BS[j]; BD[j] = 0; } }
      d.m += Math.min(F[i], T[i]) * 0.006 / sc - rnd(0.012, 0.024) / sc;
      if (Math.random() < 0.12 && d.m > 0.45 && d.row > 2 && lb < 0) { lb = i - 2 * W; d.m -= 0.012; }
      if (d.m < 0.32) break;
    }
    // 流過的地方擦出一條細細的水痕（上面有一層水膜，比較久才會再起霧）
    wipeSeg(s, d.x, d.y, nx, ny, 0.42 + 0.25 * Math.min(1.4, d.m), rnd(3, 9));
    if (lb >= 0 && !BD[lb]) { BD[lb] = rnd(15, 45); BS[lb] = 1; }     // 身後留下的小水珠（擦完水痕再放，才不會被自己擦掉）
    d.x = nx; d.y = ny;
    if (d.y >= H - 0.5) { drops.splice(k, 1); continue; }
    if (d.m < 0.32) {   // 水用完了：停下來變成一顆小水珠
      const j = Math.min(H - 1, Math.floor(d.y)) * W + Math.floor(d.x); BD[j] = rnd(30, 70); BS[j] = 2;
      drops.splice(k, 1);
    }
  }
  // 兩顆碰在一起就合併（流下來的水珠撞上正在長大的那顆，會把它一起帶走）
  for (let a = 0; a < drops.length; a++) for (let b = drops.length - 1; b > a; b--) {
    const p = drops[a], q = drops[b];
    if (Math.abs(p.x - q.x) < 1.7 && Math.abs(p.y - q.y) < 1.1 && (p.st || q.st)) {
      if (q.y > p.y) { p.x = q.x; p.y = q.y; p.row = q.row; }
      p.m = Math.min(1.8, p.m + q.m * 0.9); p.vy = Math.max(p.vy, q.vy); p.pause = 0;
      if (p.st === 0) { p.st = 1; p.row = Math.floor(p.y); }
      drops.splice(b, 1);
    }
  }
}

/* ════════════ 塗鴉（示範模式：看不見的手指畫的） ════════════ */
// 形狀用「高度 1」的單位畫（x 也是同樣的單位），畫的時候再乘上字高比；item = ['s', 點列] 一筆，或 ['t', [x, y]] 點一下
function arcP(cx, cy, rx, ry, a0, a1, n) {
  const o = []; n = n || Math.max(10, Math.ceil(Math.abs(a1 - a0) * 9));
  for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return o;
}
const PI = Math.PI;
// 手寫的小寫字母（基線 y = 1，x 高 0.42，上伸到 0，下伸到 1.32）
const LET = {
  h: { w: 0.46, it: () => [['s', [[0, 0], [0, 1], [0, 0.68], ...arcP(0.23, 0.68, 0.23, 0.25, PI, 2 * PI), [0.46, 1]]]] },
  i: { w: 0.1, it: () => [['s', [[0.05, 0.44], [0.05, 1]]], ['t', [0.05, 0.18]]] },
  l: { w: 0.14, it: () => [['s', [[0.06, 0], [0.06, 0.92], [0.14, 1]]]] },
  o: { w: 0.5, it: () => [['s', arcP(0.25, 0.71, 0.25, 0.29, -PI / 2, -PI / 2 - 2 * PI - 0.25)]] },
  v: { w: 0.48, it: () => [['s', [[0, 0.42], [0.24, 1], [0.48, 0.42]]]] },
  e: { w: 0.48, it: () => [['s', [[0.03, 0.72], [0.46, 0.72], ...arcP(0.245, 0.72, 0.215, 0.28, 0, -2 * PI + 0.75)]]] },
  k: { w: 0.42, it: () => [['s', [[0, 0], [0, 1]]], ['s', [[0.4, 0.44], [0.03, 0.74], [0.42, 1]]]] },
  y: { w: 0.48, it: () => [['s', [[0, 0.42], [0.23, 0.98]]], ['s', [[0.48, 0.42], [0.2, 1.16], [0.08, 1.32]]]] },
  // 你、好（各佔 1×1 的方格）
  你: { w: 1, it: () => [['s', [[0.24, 0], [0.04, 0.4]]], ['s', [[0.15, 0.24], [0.15, 1]]], ['s', [[0.52, 0], [0.36, 0.32]]], ['s', [[0.43, 0.17], [0.96, 0.17], [0.86, 0.34]]],
    ['s', [[0.68, 0.33], [0.68, 0.96], [0.58, 0.9]]], ['s', [[0.48, 0.56], [0.36, 0.8]]], ['s', [[0.84, 0.56], [0.97, 0.8]]]] },
  好: { w: 1, it: () => [['s', [[0.22, 0], [0.08, 0.52], [0.42, 0.98]]], ['s', [[0.38, 0.28], [0.32, 0.62], [0.04, 0.96]]], ['s', [[0, 0.42], [0.47, 0.42]]],
    ['s', [[0.56, 0.1], [0.93, 0.1], [0.76, 0.3]]], ['s', [[0.76, 0.3], [0.76, 0.96], [0.66, 0.9]]], ['s', [[0.52, 0.52], [1, 0.52]]]] },
};
function heartItems(cx, cy, h) {
  const o = [];
  for (let k = 0; k <= 72; k++) { const t = k / 72 * 2 * PI, x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); o.push([cx + x / 29 * h, cy + (y - 2.5) / 29 * h]); }
  return [['s', o]];
}
function wordItems(word) {
  const it = []; let x = 0;
  for (const c of word) {
    if (c === ' ') { x += 0.3; continue; }
    if (c === '♡') { it.push(...heartItems(x + 0.42, 0.6, 0.56)); x += 0.9; continue; }
    const L = LET[c]; if (!L) continue;
    const sl = rnd(-0.03, 0.03), by = rnd(-0.03, 0.03);
    const tf = p => [x + p[0] - (p[1] - 0.5) * 0.12 + sl * (0.5 - p[1]), p[1] + by];   // 一點點斜體，每個字母再歪一點點
    for (const [k, v] of L.it()) it.push(k === 't' ? ['t', tf(v)] : ['s', v.map(tf)]);
    x += L.w + (wideCh(c) ? 0.16 : 0.17);
  }
  return it;
}
const DOODLES = {
  heart: () => heartItems(0.55, 0.5, 1),
  smile: () => [['s', arcP(0.5, 0.5, 0.5, 0.5, -PI / 2 - 0.3, -PI / 2 - 0.3 + 2 * PI + 0.35)], ['s', [[0.35, 0.3], [0.35, 0.42]]], ['s', [[0.65, 0.3], [0.65, 0.42]]], ['s', arcP(0.5, 0.52, 0.28, 0.24, 0.45, PI - 0.45)]],
  sun: () => {
    const it = [['s', arcP(0.5, 0.5, 0.3, 0.3, -PI / 2, 3 * PI / 2 + 0.3)]];
    for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; it.push(['s', [[0.5 + Math.cos(a) * 0.4, 0.5 + Math.sin(a) * 0.4], [0.5 + Math.cos(a) * 0.52, 0.5 + Math.sin(a) * 0.52]]]); }
    it.push(['t', [0.41, 0.44]], ['t', [0.59, 0.44]], ['s', arcP(0.5, 0.5, 0.14, 0.13, 0.45, PI - 0.45)]);
    return it;
  },
  star: () => { const p = []; for (let k = 0; k <= 10; k++) { const a = -PI / 2 + k * PI / 5, r = k % 2 ? 0.22 : 0.5; p.push([0.5 + Math.cos(a) * r, 0.53 + Math.sin(a) * r]); } return [['s', p]]; },
  swirl: () => { const p = []; for (let k = 0; k <= 140; k++) { const u = k / 140, a = u * 3.1 * 2 * PI; p.push([0.5 + Math.cos(a) * (0.03 + 0.47 * u), 0.5 + Math.sin(a) * (0.03 + 0.47 * u)]); } return [['s', p]]; },
  // 井字遊戲：X 先下、O 擋一步，最後 X 連成一線，再畫一條線劃過去（一盤小小的勝利）
  ttt: () => {
    const it = [['s', [[0.34, 0], [0.33, 1]]], ['s', [[0.67, 0], [0.68, 1]]], ['s', [[0, 0.34], [1, 0.33]]], ['s', [[0, 0.67], [1, 0.68]]]];
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]], win = pick(lines);
    const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(c => !win.includes(c)).sort(() => Math.random() - 0.5);
    const cell = c => [((c % 3) + 0.5) / 3, (Math.floor(c / 3) + 0.5) / 3], r = 0.095;
    const X = c => { const [cx, cy] = cell(c); it.push(['s', [[cx - r, cy - r], [cx + r, cy + r]]], ['s', [[cx + r, cy - r], [cx - r, cy + r]]]); };
    const O = c => { const [cx, cy] = cell(c); it.push(['s', arcP(cx, cy, r * 1.15, r * 1.15, -PI / 2, 3 * PI / 2 + 0.3)]); };
    X(win[0]); O(free[0]); X(win[2]); O(free[1]); X(win[1]);
    const a = cell(win[0]), b = cell(win[2]), ex = (b[0] - a[0]) * 0.28, ey = (b[1] - a[1]) * 0.28;
    it.push(['s', [[a[0] - ex, a[1] - ey], [b[0] + ex, b[1] + ey]]]);
    return it;
  },
  cat: () => [
    ['s', [[0.2, 0.44], [0.22, 0.06], [0.42, 0.3]]], ['s', [[0.58, 0.3], [0.78, 0.06], [0.8, 0.44]]],
    ['s', arcP(0.5, 0.6, 0.36, 0.32, -PI / 2 - 0.35, -PI / 2 - 0.35 + 2 * PI + 0.15)],
    ['t', [0.37, 0.56]], ['t', [0.63, 0.56]],
    ['s', [[0.42, 0.7], [0.46, 0.76], [0.5, 0.71], [0.54, 0.76], [0.58, 0.7]]],
    ['s', [[0.2, 0.64], [-0.1, 0.6]]], ['s', [[0.2, 0.73], [-0.08, 0.78]]], ['s', [[0.8, 0.64], [1.1, 0.6]]], ['s', [[0.8, 0.73], [1.08, 0.78]]],
  ],
  flower: () => [   // 鬱金香：花苞、莖、兩片葉子
    ['s', [[0.24, 0.06], ...arcP(0.5, 0.2, 0.26, 0.3, PI, 0, 16).slice(1), [0.76, 0.06], [0.63, 0.17], [0.5, 0.02], [0.37, 0.17], [0.24, 0.06]]],
    ['s', [[0.5, 0.5], [0.5, 1.05]]],
    ['s', [[0.5, 0.92], [0.36, 0.78], [0.2, 0.7], [0.3, 0.86], [0.5, 0.92]]], ['s', [[0.5, 0.8], [0.64, 0.66], [0.8, 0.6], [0.7, 0.75], [0.5, 0.8]]],
  ],
  house: () => [['s', [[0.15, 0.48], [0.15, 1], [0.85, 1], [0.85, 0.48]]], ['s', [[0.06, 0.54], [0.5, 0.1], [0.94, 0.54]]], ['s', [[0.42, 1], [0.42, 0.74], [0.58, 0.74], [0.58, 1]]], ['s', [[0.68, 0.18], [0.68, 0.3]]], ['t', [0.28, 0.66]]],
  moon: () => [['s', [...arcP(0.5, 0.5, 0.5, 0.5, -PI / 2 - 0.25, PI / 2 + 0.25, 30).reverse().map(([x, y]) => [1 - x, y]), ...arcP(0.68, 0.46, 0.4, 0.42, PI * 0.62, PI * 1.38 + 0.0, 20).reverse()]], ['t', [0.92, 0.2]], ['t', [0.78, 0.82]]],
  umbrella: () => [['s', arcP(0.5, 0.48, 0.5, 0.4, PI, 2 * PI)], ['s', [...arcP(0.833, 0.48, 0.167, 0.07, 0, -PI, 8), ...arcP(0.5, 0.48, 0.167, 0.07, 0, -PI, 8), ...arcP(0.167, 0.48, 0.167, 0.07, 0, -PI, 8)]], ['s', [[0.5, 0.08], [0.5, 0.94], ...arcP(0.42, 0.94, 0.08, 0.07, 0, PI, 8)]]],
  snowman: () => [['s', arcP(0.5, 0.7, 0.3, 0.3, -PI / 2, 3 * PI / 2 + 0.2)], ['s', arcP(0.5, 0.25, 0.19, 0.19, -PI / 2, 3 * PI / 2 + 0.2)], ['t', [0.44, 0.22]], ['t', [0.56, 0.22]], ['s', [[0.5, 0.29], [0.64, 0.31]]], ['t', [0.5, 0.58]], ['t', [0.5, 0.72]], ['s', [[0.24, 0.6], [0.02, 0.44]]], ['s', [[0.76, 0.6], [0.98, 0.44]]]],
  tree: () => [['s', [[0.5, 0], [0.24, 0.3], [0.38, 0.3], [0.14, 0.6], [0.32, 0.6], [0.06, 0.88], [0.94, 0.88], [0.68, 0.6], [0.86, 0.6], [0.62, 0.3], [0.76, 0.3], [0.5, 0]]], ['s', [[0.5, 0.88], [0.5, 1.05]]]],
};
const DOODLE_SETS = {
  city: ['heart', 'smile', 'star', 'moon', 'swirl', 'ttt', 'cat', 'word', 'word', 'house', 'heart'],
  snow: ['heart', 'smile', 'sun', 'snowman', 'tree', 'star', 'word', 'word', 'flower', 'cat'],
  rain: ['heart', 'smile', 'umbrella', 'cat', 'flower', 'ttt', 'word', 'word', 'swirl', 'sun'],
};
// 每種塗鴉的大小（畫面高度的比例）與至少要有幾個指寬高（細節多的要畫大一點，才不會糊成一團）
const DSIZE = { heart: [0.3, 0.42, 5], smile: [0.32, 0.42, 6], star: [0.32, 0.42, 5.5], swirl: [0.3, 0.4, 6], moon: [0.32, 0.42, 5], sun: [0.4, 0.5, 8],
  cat: [0.42, 0.52, 8.5], flower: [0.44, 0.54, 8.5], house: [0.36, 0.46, 6], umbrella: [0.36, 0.46, 6], snowman: [0.46, 0.56, 9], tree: [0.36, 0.46, 6], ttt: [0.48, 0.56, 9], word: [0.24, 0.3, 4.5] };
const SMALL_SET = ['heart', 'smile', 'star', 'swirl', 'word', 'heart'];
function makeShape(kind, f, small, ai) {
  let it;
  if (kind === 'word') {
    // 同一個字不要連著寫兩次（上一個還沒被霧蓋掉）
    const list = small ? ['hi', 'hi', 'love', 'hi ♡'] : f.lang === 'en' ? ['hi', 'love', 'hello', 'hey', 'hi ♡', 'love'] : ['hi', 'love', '你好', '你好', 'hi ♡', '你好♡'];
    let w = pick(list);
    for (let k = 0; k < 8 && ai && w.replace(/ ?♡/, '') === ai.lastWord; k++) w = pick(list);
    if (ai) ai.lastWord = w.replace(/ ?♡/, '');
    it = wordItems(w);
  }
  else it = DOODLES[kind]();
  // 正規化：高度 = 1，左上角 = (0, 0)
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [k, v] of it) for (const p of k === 't' ? [v] : v) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const sc = 1 / Math.max(0.01, y1 - y0);
  const items = it.map(([k, v]) => [k, k === 't' ? [(v[0] - x0) * sc, (v[1] - y0) * sc] : v.map(p => [(p[0] - x0) * sc, (p[1] - y0) * sc])]);
  return { kind, w: (x1 - x0) * sc, items };
}
// 把形狀放到畫面上，轉成手指的動作：筆畫（細分、加一點手抖）和點一下
function compileShape(s, sh, ox, oy, Hd) {
  const A = s.A, ops = [], seed = rnd(100);
  let lx = null, ly = null, arc = 0;
  for (const [k, v] of sh.items) {
    if (k === 't') {
      const x = ox + v[0] * Hd * A, y = oy + v[1] * Hd;
      ops.push({ k: 2, x, y, pre: travel(lx, ly, x, y, A) }); lx = x; ly = y; continue;
    }
    const P = [];
    for (let q = 0; q < v.length; q++) {
      const a = v[q], b = v[q + 1];
      const n = b ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05)) : 1;
      for (let e = 0; e < n; e++) {
        const u = b ? e / n : 0, px = b ? a[0] + (b[0] - a[0]) * u : a[0], py = b ? a[1] + (b[1] - a[1]) * u : a[1];
        if (P.length) arc += Math.hypot(px - P[P.length - 1][2], py - P[P.length - 1][3]);
        const wx = Noise.n3(arc * 2.3, seed, 0.3) * 0.016, wy = Noise.n3(seed, arc * 2.3, 1.7) * 0.016;
        P.push([ox + (px + wx) * Hd * A, oy + (py + wy) * Hd, px, py]);
        if (!b) break;
      }
    }
    const X = new Float32Array(P.length), Y = new Float32Array(P.length), L = new Float32Array(P.length);
    for (let q = 0; q < P.length; q++) { X[q] = P[q][0]; Y[q] = P[q][1]; if (q) L[q] = L[q - 1] + Math.hypot((X[q] - X[q - 1]) / A, Y[q] - Y[q - 1]); }
    ops.push({ k: 1, X, Y, L, len: L[L.length - 1], pre: travel(lx, ly, X[0], Y[0], A) });
    lx = X[X.length - 1]; ly = Y[Y.length - 1];
  }
  return ops;
}
const travel = (x0, y0, x1, y1, A) => (x0 === null ? 0.1 : 0.1 + Math.hypot((x1 - x0) / A, y1 - y0) / 70) + rnd(0.04, 0.2);
// 找一塊霧最濃的地方畫下一個塗鴉（避開左上角的桌面圖示和最底下的提示列）
function planDoodle(s, f) {
  const ai = s.ai, W = s.W, H = s.H, A = s.A;
  const small = H < 40, set = small ? SMALL_SET : DOODLE_SETS[s.scene];      // 縮圖這種小畫面只畫簡單的形狀，才看得出來
  let kind;
  for (let k = 0; k < 8; k++) { kind = pick(set); if (!ai.recent.includes(kind) || kind === 'word') break; }
  const sh = makeShape(kind, f, small, ai);
  const sz = DSIZE[kind] || DSIZE.heart;
  // 大小以「同樣大小的橫向螢幕的高度」為準（直立的螢幕很高，用高度算會大到佔滿整個寬度、一個疊一個）
  const HE = Math.min(H, 85 * s.ls);
  let Hd = Math.max(HE * rnd(sz[0], sz[1]), s.R0 * 2 * sz[2]);
  Hd = Math.min(Hd, H * 0.8, W * 0.8 / Math.max(0.3, sh.w * A));
  const w = sh.w * Hd * A, pad = s.R0 * 1.4;
  let best = [clamp((W - w) / 2, 0, W), clamp((H - Hd) / 2, 0, H)], bs = -1e9, bestOv = 0;
  // 最近畫過的幾個塗鴉（還沒完全被霧蓋掉的）：新的盡量不要疊上去，越新的越要避開
  const boxes = ai.boxes, now = f.t, AGE = 80, FRESH = 45;
  for (let k = 0; k < 40; k++) {
    const ox = rnd(Math.min(W * 0.09, Math.max(pad * A, W - w - pad * A)), Math.max(pad * A, W - w - pad * A)), oy = rnd(pad, Math.max(pad, H - 2 - pad - Hd));
    let sum = 0, n = 0;
    for (let q = 0; q < 30; q++) { const x = Math.floor(ox + ((q % 6) + Math.random()) / 6 * w), y = Math.floor(oy + (((q / 6) | 0) + Math.random()) / 5 * Hd); if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x; sum += s.F[i] / Math.max(0.05, s.T[i]); n++; }
    let ov = 0, ovF = 0;
    for (const bx of boxes) {
      const age = now - bx.t; if (age > AGE) continue;
      const ix = Math.min(ox + w + pad * A, bx.x1) - Math.max(ox - pad * A, bx.x0), iy = Math.min(oy + Hd + pad, bx.y1) - Math.max(oy - pad, bx.y0);
      if (ix > 0 && iy > 0) ov += ix * iy / Math.max(1, Math.min((w + 2 * pad * A) * (Hd + 2 * pad), (bx.x1 - bx.x0) * (bx.y1 - bx.y0))) * (1 - 0.6 * age / AGE);
      if (age < FRESH) {        // 和還很清楚的塗鴉本身（不含留白）重疊多少
        const pa = bx.pa || 0, jx = Math.min(ox + w, bx.x1 - pa * A) - Math.max(ox, bx.x0 + pa * A), jy = Math.min(oy + Hd, bx.y1 - pa) - Math.max(oy, bx.y0 + pa);
        if (jx > 0 && jy > 0) ovF = Math.max(ovF, jx * jy / Math.max(1, Math.min(w * Hd, (bx.x1 - bx.x0 - 2 * pa * A) * (bx.y1 - bx.y0 - 2 * pa))));
      }
    }
    const sc = (n ? sum / n : 0) - ov * 8 + Math.random() * 0.05 - (ox < W * 0.08 && oy < H * 0.6 ? 0.3 : 0);
    if (sc > bs) { bs = sc; best = [ox, oy]; bestOv = ovF; }
  }
  // 找不到空位（最好的位置還是會蓋到一個剛畫好的塗鴉一大塊）：先等幾秒，讓舊的再淡一點再找（最多等兩次）
  if (bestOv > 0.25 && (ai.retry || 0) < 2) { ai.retry = (ai.retry || 0) + 1; ai.wait = rnd(3, 6); return false; }
  ai.retry = 0;
  ai.recent.push(kind); if (ai.recent.length > 3) ai.recent.shift();
  boxes.push({ x0: best[0] - pad * A, y0: best[1] - pad, x1: best[0] + w + pad * A, y1: best[1] + Hd + pad, t: now, pa: pad });
  if (boxes.length > 6) boxes.shift();
  ai.ops = compileShape(s, sh, best[0], best[1], Hd);
  ai.oi = 0; ai.ph = 0; ai.tt = 0; ai.seg = 0;
  ai.v = clamp(Hd * rnd(1.25, 1.7), 5, 70) * (kind === 'word' ? 0.85 : 1);
  ai.R = s.R0 * rnd(0.9, 1.12);
  return true;
}
// 示範的手指：一筆一筆地畫，筆畫中間抬起來移到下一筆
function aiStep(s, f) {
  const ai = s.ai, dt = f.dt;
  if (ai.wait > 0) { ai.wait -= dt; return; }
  if (!ai.ops) { planDoodle(s, f); return; }
  if (ai.oi >= ai.ops.length) { ai.ops = null; ai.wait = rnd(4, 10); return; }
  const op = ai.ops[ai.oi];
  if (ai.ph === 0) {
    ai.tt += dt; if (ai.tt < op.pre) return;
    ai.ph = 1; ai.tt = 0; ai.u = 0; ai.seg = 0;
    if (op.k === 2) { wipeSeg(s, op.x, op.y, op.x, op.y, ai.R * 0.85, rnd(5, 9)); rimBeads(s, op.x, op.y, op.x, op.y, ai.R * 0.85, 0.5); ai.down = true; ai.x = op.x; ai.y = op.y; }
    else { strokeBegin(s, op.X[0], op.Y[0]); strokeSeg(s, op.X[0], op.Y[0], op.X[0], op.Y[0], ai.R, rnd(6, 11), 0.2); ai.down = true; ai.x = op.X[0]; ai.y = op.Y[0]; }
    return;
  }
  if (op.k === 2) { ai.tt += dt; if (ai.tt > 0.14) { ai.down = false; ai.oi++; ai.ph = 0; ai.tt = 0; } return; }
  // 沿著筆畫往前：頭尾慢、中間快
  const len = op.len, u0 = ai.u, e = Math.min(1, 0.35 + 0.65 * Math.min(u0, len - u0) / Math.max(0.5, Math.min(len * 0.15, ai.v * 0.12)));
  const u1 = Math.min(len, u0 + ai.v * e * dt);
  const X = op.X, Y = op.Y, L = op.L, hold = rnd(6, 11);
  let k = ai.seg, px = ai.x, py = ai.y;
  while (k < L.length - 1 && L[k + 1] <= u1) { k++; strokeSeg(s, px, py, X[k], Y[k], ai.R, hold, 0.2); px = X[k]; py = Y[k]; }
  if (k < L.length - 1) { const w = (u1 - L[k]) / Math.max(1e-6, L[k + 1] - L[k]), nx = X[k] + (X[k + 1] - X[k]) * w, ny = Y[k] + (Y[k + 1] - Y[k]) * w; strokeSeg(s, px, py, nx, ny, ai.R, hold, 0.2); px = nx; py = ny; }
  ai.seg = k; ai.u = u1; ai.x = px; ai.y = py;
  if (u1 >= len) { ai.down = false; strokeEnd(s); ai.oi++; ai.ph = 0; ai.tt = 0; }
}

/* ════════════ 每格：霧的模糊視野（低解析度、再模糊一次、加上光暈） ════════════ */
function blurPass(src, dst, w, h, horiz, r) {
  const n = 2 * r + 1, inv = 1 / n;
  if (horiz) {
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[o + clamp(k, 0, w - 1)];
      for (let x = 0; x < w; x++) { dst[o + x] = acc * inv; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[clamp(k, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { dst[y * w + x] = acc * inv; acc += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x]; }
    }
  }
}
function prepFog(s) {
  const W = s.W, H = s.H, lw = s.lw, lh = s.lh, LR = s.LR, LG = s.LG, LB = s.LB, TM = s.TM, bxO = s.bxO, byO = s.byO, cR = s.cR, cG = s.cG, cB = s.cB, cf = s.cf;
  const LW = s.LW;
  LR.fill(0); LG.fill(0); LB.fill(0); LW.fill(0);
  // 縮小時亮的格子比重大一點（一扇亮著的窗戶在霧裡仍然是一小團光，不會被周圍的暗色平均掉）
  for (let y = 0; y < H; y++) {
    const ro = byO[y] * lw, io = y * W;
    for (let x = 0; x < W; x++) {
      const j = ro + bxO[x], i = io + x, r = cR[i], g = cG[i], b = cB[i], w = 1 + (0.3 * r + 0.59 * g + 0.11 * b) * 0.012;
      LR[j] += r * w; LG[j] += g * w; LB[j] += b * w; LW[j] += w;
    }
  }
  const N = lw * lh;
  for (let j = 0; j < N; j++) { const k = 1 / LW[j]; LR[j] *= k; LG[j] *= k; LB[j] *= k; }
  for (const ch of [LR, LG, LB]) { blurPass(ch, TM, lw, lh, true, 2); blurPass(TM, ch, lw, lh, false, 2); blurPass(ch, TM, lw, lh, true, 1); blurPass(TM, ch, lw, lh, false, 1); }
  // 退色、變暗
  const sat = cf.sat, dim = cf.dim;
  for (let j = 0; j < N; j++) { const m = (LR[j] + LG[j] + LB[j]) / 3; LR[j] = (m + (LR[j] - m) * sat) * dim; LG[j] = (m + (LG[j] - m) * sat) * dim; LB[j] = (m + (LB[j] - m) * sat) * dim; }
  // 光源在霧裡散成柔和的光斑（散景）：平平的圓盤、邊緣柔和，外面再一圈淡淡的光暈
  const bw = s.bw, bh = s.bh, A = s.A, bk = cf.bokeh;
  const splat = L => {
    const cx = L.x / bw - 0.5, cy = L.y / bh - 0.5, sx = L.R * A / bw, sy = L.R / bh, k = L.I * bk;
    if (!(k > 0)) return;
    const x0 = Math.max(0, Math.floor(cx - sx * 2.4)), x1 = Math.min(lw - 1, Math.ceil(cx + sx * 2.4)), y0 = Math.max(0, Math.floor(cy - sy * 2.4)), y1 = Math.min(lh - 1, Math.ceil(cy + sy * 2.4));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / sx, dy = (y - cy) / sy, q = dx * dx + dy * dy;
      if (q > 5.76) continue;
      const rr = Math.sqrt(q) * 0.68, e = ((rr < 0.7 ? 1 : rr > 1.05 ? 0 : 1 - sst(0.7, 1.05, rr)) * 0.55 + Math.exp(-q * 0.5) * 0.45) * k, j = y * lw + x;
      LR[j] += L.r * e; LG[j] += L.g * e; LB[j] += L.b * e;
    }
  };
  for (const L of s.lights) splat(L);
  for (let k = 0; k < s.dn; k++) splat(s.dl[k]);
}

/* ════════════ 註冊 ════════════ */
const FS_MIN = 0.5, FS_MAX = 2.2;
A({ id: 'ix-fog', name: '起霧的玻璃', cat: '互動', theme: 'ice', hue: true, interactive: true, sound: true,
  desc: '按住滑鼠用手指在起霧的窗上畫畫，擦開的地方看得見窗外；滾輪調整手指粗細',
  params: { scene: 'city' },
  variants: [
    { id: 'snow', name: '雪林清晨', desc: '清晨的雪林與小木屋：按住滑鼠在霧上畫畫，滾輪調整手指粗細', theme: 'lavender', params: { scene: 'snow' } },
    { id: 'rain', name: '雨夜街角', desc: '下雨的街角，霓虹和車燈在霧裡暈開：按住滑鼠畫畫，水珠會流得比較多', theme: 'cyber', params: { scene: 'rain' } },
  ],
  init(s, f) {
    const W = f.cols, H = f.rows, n = W * H, A = f.aspect;
    s.W = W; s.H = H; s.A = A; s.n = n; s.sc = H / 85; s.small = H < 40; s.bk = s.small ? 0.4 : 1;
    s.scene = SCENES[f.p.scene] ? f.p.scene : 'city';
    const cf = s.cf = SCENES[s.scene];
    s.bgc = cf.bg; s.bgL = lumOf(cf.bg[0], cf.bg[1], cf.bg[2]);
    s.bR = new Float32Array(n); s.bG = new Float32Array(n); s.bB = new Float32Array(n); s.bC = new Uint8Array(n);
    s.cR = new Float32Array(n); s.cG = new Float32Array(n); s.cB = new Float32Array(n); s.cC = new Uint8Array(n);
    s.lights = []; s.dl = []; for (let k = 0; k < 24; k++) s.dl.push(mkLight(0, 0, 0, 0, 0, 0, 1)); s.dn = 0;
    cf.build(s, f);
    // 霧的低解析度格子（大約 80×43，和畫面大小無關）
    s.bw = Math.max(1, Math.round(W / 80)); s.bh = Math.max(1, Math.round(H / 42));
    const lw = s.lw = Math.ceil(W / s.bw), lh = s.lh = Math.ceil(H / s.bh);
    s.LR = new Float32Array(lw * lh); s.LG = new Float32Array(lw * lh); s.LB = new Float32Array(lw * lh); s.TM = new Float32Array(lw * lh); s.LW = new Float32Array(lw * lh);
    s.bxO = new Int32Array(W); s.byO = new Int32Array(H);
    for (let x = 0; x < W; x++) s.bxO[x] = Math.min(lw - 1, Math.floor(x / s.bw));
    for (let y = 0; y < H; y++) s.byO[y] = Math.min(lh - 1, Math.floor(y / s.bh));
    s.lx0 = new Int32Array(W); s.lx1 = new Int32Array(W); s.lwx = new Float32Array(W);
    for (let x = 0; x < W; x++) { const fx = clamp((x + 0.5) / s.bw - 0.5, 0, lw - 1), x0 = Math.floor(fx); s.lx0[x] = x0; s.lx1[x] = Math.min(lw - 1, x0 + 1); s.lwx[x] = fx - x0; }
    s.RR = new Float32Array(lw); s.RG = new Float32Array(lw); s.RB = new Float32Array(lw);
    // 霧：濃度 F、目標濃度 T（雜訊讓它不均勻，底部比較濃）、擦過後暫停起霧的時間 HD、顆粒 GR、水珠 BD/BS、各處起霧快慢 RJ、室內暖光 TW
    s.F = new Float32Array(n); s.T = new Float32Array(n); s.HD = new Float32Array(n); s.GR = new Float32Array(n); s.G2 = new Float32Array(n);
    s.BD = new Float32Array(n); s.BS = new Uint8Array(n); s.RJ = new Float32Array(n); s.TW = new Float32Array(n); s.AM = new Float32Array(n);
    const sd = rnd(50);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, v = y / H, u = x / W;
      const nz = Noise.fbm(x * 0.016 / Math.max(0.5, W / 320), y * 0.034 / Math.max(0.5, s.sc), sd, 3);
      s.T[i] = clamp(0.8 + nz * 0.42 + sst(0.68, 1, v) * 0.28 + sst(0.86, 1, Math.abs(2 * u - 1)) * 0.06, 0.55, 1);
      // 霧本身的亮度：跟著濃度的雜訊有一點不均勻，越往下越濃、越亮（水氣往下聚）
      const n2 = Noise.n3(x * 0.045 / Math.max(0.5, W / 320), y * 0.09 / Math.max(0.5, s.sc), sd + 3);
      s.AM[i] = clamp(1 + cf.ambVar * (nz * 0.8 + n2 * 0.5) + cf.ambBot * sst(0.5, 1, v), 0.6, 1.6);
      s.GR[i] = hsh(x * 3 + 1, y * 7 + 2); s.G2[i] = hsh(x * 11 + 5, y * 5 + 9);
      s.RJ[i] = clamp(0.55 + (Noise.n3(x * 0.05, y * 0.1, sd + 7) + 0.5) * 0.7 + sst(0.6, 1, v) * 0.6, 0.35, 2);
      s.TW[i] = Math.pow(Math.max(0, 1 - Math.hypot((u - 0.0) * 1.1, (v - 1) * 1.4)), 2) * 0.55;
    }
    s.F.set(s.T);
    s.sq = 0;
    s.drops = []; s.nt = rnd(2, 6); s.wet = 0.6; s.wetAt = rnd(1, 1.8);
    s.stk = { on: false, len: 0, lx: 0, ly: 0, R: 1 };
    // 手指和塗鴉的大小跟著「螢幕有多大」：橫的螢幕看高度；直立的螢幕（高比寬多）改看面積，手指和塗鴉才不會大到佔滿整個寬度
    s.ls = Math.min(s.sc, Math.sqrt(W * H / (320 * 85)));
    s.R0 = clamp(1.6 * s.ls, 0.62, 6); s.fs = 1; s.showFs = 0; s.restT = 1;
    s.hue = hueOn(f);
    s.user = { down: false, x: 0, y: 0 };
    s.ai = { ops: null, oi: 0, ph: 0, tt: 0, u: 0, seg: 0, x: W / 2, y: H / 2, down: false, wait: 0.6, recent: [], boxes: [], v: 20, R: s.R0 };
    s.wasPlaying = false;
    // 開場：玻璃上已經有一個快要被霧蓋掉的舊塗鴉，和一兩條水痕
    {
      planDoodle(s, f);
      const ai = s.ai;
      ai.boxes[0].t -= 35;          // 這個舊塗鴉已經半被霧蓋住了
      for (const op of ai.ops) {
        if (op.k === 2) wipeSeg(s, op.x, op.y, op.x, op.y, ai.R * 0.85, 0);
        else for (let q = 1; q < op.X.length; q++) { wipeSeg(s, op.X[q - 1], op.Y[q - 1], op.X[q], op.Y[q], ai.R, 0); rimBeads(s, op.X[q - 1], op.Y[q - 1], op.X[q], op.Y[q], ai.R, 0.12); }
      }
      ai.ops = null;
      const nt = rint(1, 3);
      for (let k = 0; k < nt; k++) {
        let x = rnd(W * 0.1, W * 0.9), y = rnd(0, H * 0.4);
        while (y < H - 1) { const ny = y + rnd(0.6, 1.4); const nx = x + rnd(-0.5, 0.5) * (Math.random() < 0.15 ? 3 : 0.6); wipeSeg(s, x, y, nx, ny, 0.5, 0); x = nx; y = ny; if (Math.random() < 0.012) break; }
      }
      const age = rnd(0.35, 0.5);
      for (let i = 0; i < n; i++) { s.HD[i] = 0; if (s.F[i] < s.T[i]) s.F[i] += (s.T[i] - s.F[i]) * age; }
    }
  },
  frame(s, f) {
    const { g, dt } = f, W = s.W, H = s.H, n = s.n, A = s.A;
    const m = f.mouse;
    // 按住不動時 idle 不會更新：按著就算還在玩（60 秒保險）
    const playing = m.idle < 6 || (!!m.down && m.idle < 60);
    if (playing !== s.wasPlaying) {
      if (s.ai.down) { s.ai.down = false; strokeEnd(s); }
      s.ai.ops = null; s.ai.wait = rnd(1.5, 3);
      if (!playing && s.user.down) { s.user.down = false; strokeEnd(s); }
      s.wasPlaying = playing;
    }
    // ── 滾輪：手指粗細 ──
    // 依滾動量調整（一格滾輪 ≈ 100 → 13%）：觸控板、高解析度滾輪的小量滾動也只變一點點
    if (playing && m.wheel && Number.isFinite(m.wheel)) { const st = clamp(-m.wheel / 100, -4, 4); s.fs = clamp(s.fs * Math.pow(1.13, st), FS_MIN, FS_MAX); s.showFs = 1.8; }
    if (s.showFs > 0) s.showFs -= dt;
    const R = Math.max(0.62, s.R0 * s.fs);       // 最細也要擦得出一條線（小畫面上半徑太小，橫線會剛好落在兩列中間、什麼都擦不到）
    // ── 玩家的手指 ──
    if (playing) {
      const u = s.user, down = !!m.down && m.on, x = m.x, y = m.y;
      let pc = null; for (const c of m.clicks) if (!c.button) pc = c;     // 這一格之間手指按下去的位置（引擎記下的確切位置）
      if (down && u.down && pc) { strokeEnd(s); u.down = false; }       // 在同一格裡放開又按下：是新的一筆，不要跟上一筆連起來
      if (down) {
        if (!u.down) {
          // 從按下去的那一點開始畫（手常常一邊按一邊已經在動，不然一筆的開頭會少一截）
          const sx = pc ? pc.x : x, sy = pc ? pc.y : y;
          strokeBegin(s, sx, sy); strokeSeg(s, sx, sy, sx, sy, R, rnd(7, 11), 0.5);
          if (sx !== x || sy !== y) strokeSeg(s, sx, sy, x, y, R, rnd(7, 11), 0.22);
          s.restT = 1;
        } else if (x === u.x && y === u.y) {
          // 手指按著不動：指尖下面一直保持乾淨（大約每秒補擦一次）
          if ((s.restT -= dt) <= 0) { wipeSeg(s, x, y, x, y, R, rnd(7, 11)); s.restT = 1; }
        } else {
          s.restT = 1;
          strokeSeg(s, u.x, u.y, x, y, R, rnd(7, 11), 0.22);
          // 手指在玻璃上滑得快時，偶爾「啾」一聲（很小聲，最多每秒 4 次）
          const v = Math.hypot((x - u.x) / A, y - u.y) / Math.max(dt, 1e-3) / s.sc;
          s.sq -= dt;
          if (v > 14 && s.sq <= 0 && typeof f.sfx === 'function') { f.sfx('blip', clamp(0.025 + v * 0.0006, 0.025, 0.06), clamp(x / W * 2 - 1, -1, 1), clamp(1.6 + v * 0.008, 1.6, 2.3)); s.sq = rnd(0.25, 0.45); }
        }
      } else if (u.down) {
        // 放開的那一格：引擎如果有記下放開的位置（m.ups，目前的版本沒有），把最後一小段也畫上
        const up = m.ups && m.ups[0];
        if (up && m.on && Number.isFinite(up.x) && Number.isFinite(up.y) && (up.x !== u.x || up.y !== u.y)) strokeSeg(s, u.x, u.y, up.x, up.y, R, rnd(7, 11), 0.22);
        strokeEnd(s);
      }
      for (const c of m.clicks) if (!c.button && !down && !u.down) { wipeSeg(s, c.x, c.y, c.x, c.y, R * 0.95, rnd(6, 9)); rimBeads(s, c.x, c.y, c.x, c.y, R * 0.95, 0.5); }
      u.down = down; u.x = x; u.y = y;
    } else aiStep(s, f);
    // ── 水珠、起霧 ──
    dropStep(s, f);
    {
      const F = s.F, T = s.T, HD = s.HD, RJ = s.RJ, K0 = 0.0105, KD = 0.2, K1 = 0.0035, WH = A * A, WN = 1 / (2 * WH + 2);
      for (let y = 0; y < H; y++) {
        const ro = y * W;
        for (let x = 0; x < W; x++) {
          const i = ro + x, f0 = F[i], tg = T[i];
          if (f0 >= tg) { if (f0 > tg) F[i] = f0 - dt * 0.005 > tg ? f0 - dt * 0.005 : tg; continue; }
          if (HD[i] > 0) { HD[i] -= dt; if (HD[i] > 0) continue; }
          const nb = ((x > 0 ? F[i - 1] : f0) + (x < W - 1 ? F[i + 1] : f0)) * WH + (y > 0 ? F[i - W] : f0) + (y < H - 1 ? F[i + W] : f0);
          const lap = nb * WN - f0;
          const v = f0 + ((tg - f0) * K0 * RJ[i] + K1 * RJ[i] + (lap > 0 ? lap * KD : 0)) * dt;
          F[i] = v > tg ? tg : v;
        }
      }
    }
    // ── 窗外的景 ──
    s.cR.set(s.bR); s.cG.set(s.bG); s.cB.set(s.bB); s.cC.set(s.bC);
    s.dn = 0;
    s.cf.dyn(s, f);
    prepFog(s);
    if (s.cf.post) s.cf.post(s, f);       // 只出現在擦乾淨的地方的細節（雨絲）
    // ── 畫：清楚的景 ↔ 霧 ──
    const hue = s.hue, C = f.C, ch = g.ch, co = g.co, cf = s.cf;
    const F = s.F, TT = s.T, GR = s.GR, G2 = s.G2, BD = s.BD, BS = s.BS, TW = s.TW, AM = s.AM, cR = s.cR, cG = s.cG, cB = s.cB, cC = s.cC;
    const bgR = s.bgc[0], bgG = s.bgc[1], bgB = s.bgc[2];
    const GK0 = 1 - cf.grain, GK1 = 2 * cf.grain, SPK_K = cf.spk, brT = 128, small = s.small, BT = BEAD;
    const tR = cf.tint[0] * cf.amb, tG = cf.tint[1] * cf.amb, tB = cf.tint[2] * cf.amb, wR = cf.warm[0] * cf.amb - tR, wG = cf.warm[1] * cf.amb - tG, wB = cf.warm[2] * cf.amb - tB;
    const lw = s.lw, LR = s.LR, LG = s.LG, LB = s.LB, RR = s.RR, RG = s.RG, RB = s.RB, lx0 = s.lx0, lx1 = s.lx1, lwx = s.lwx, iD = 1 / (D1 - D0), iDim = 1 / cf.dim;
    if (hue) f.bg = rgb(bgR, bgG, bgB);
    const col = hue ? (r, gg, b) => rgb(r, gg, b) : (r, gg, b) => C((0.3 * r + 0.59 * gg + 0.11 * b) / 250);
    for (let y = 0; y < H; y++) {
      const fy = clamp((y + 0.5) / s.bh - 0.5, 0, s.lh - 1), y0 = Math.floor(fy), y1 = Math.min(s.lh - 1, y0 + 1), wy = fy - y0, o0 = y0 * lw, o1 = y1 * lw;
      for (let k = 0; k < lw; k++) { RR[k] = LR[o0 + k] + (LR[o1 + k] - LR[o0 + k]) * wy; RG[k] = LG[o0 + k] + (LG[o1 + k] - LG[o0 + k]) * wy; RB[k] = LB[o0 + k] + (LB[o1 + k] - LB[o0 + k]) * wy; }
      const ro = y * W;
      for (let x = 0; x < W; x++) {
        const i = ro + x, d = F[i];
        let r = 0, gg = 0, b = 0, c = '█';     // 先給數字初值：JIT 才能把它們當成純數字（不然每格都會產生暫時的物件）
        if (d < D0) { r = cR[i]; gg = cG[i]; b = cB[i]; c = SG[cC[i]]; }
        else {
          const a0 = lx0[x], a1 = lx1[x], u = lwx[x], tw = TW[i], k = 1 - 0.3 * d, ex = d > TT[i] ? d - TT[i] : 0, hz = d * (1 + ex * 3) * AM[i];
          const lr = RR[a0] + (RR[a1] - RR[a0]) * u, lg = RG[a0] + (RG[a1] - RG[a0]) * u, lb = RB[a0] + (RB[a1] - RB[a0]) * u;
          let fr = lr * k + (tR + wR * tw) * hz;
          let fg = lg * k + (tG + wG * tw) * hz;
          let fb = lb * k + (tB + wB * tw) * hz;
          let fogCell = true;
          if (d < D1) {
            const p = (d - D0) * iD, mm = 0.25 + p * 0.6;
            // 還看得到景的格子（字的細節也還在）。字元格會露出暗的背景色，周圍已經霧白了就像一個黑洞，所以字只在剛開始起霧時留著
            if (G2[i] >= p && (cC[i] === 0 || p < 0.15)) {
              fogCell = false; c = SG[cC[i]];
              r = cR[i] + (fr - cR[i]) * mm; gg = cG[i] + (fg - cG[i]) * mm; b = cB[i] + (fb - cB[i]) * mm;
            } else if (cC[i]) {        // 已經起霧的格子，原本是字（雨絲、窗戶、星星）：從字周圍的景（模糊的）變成霧，不要整格塗成字的顏色
              const sR = lr * iDim, sG = lg * iDim, sB = lb * iDim;
              fr = sR + (fr - sR) * mm; fg = sG + (fg - sG) * mm; fb = sB + (fb - sB) * mm;
            } else { fr = cR[i] + (fr - cR[i]) * mm; fg = cG[i] + (fg - cG[i]) * mm; fb = cB[i] + (fb - cB[i]) * mm; }
          }
          if (fogCell) {
            // 霧：整格 █，每格固定的一點明暗差當顆粒（相對背景色縮放，暗處、亮處的顆粒感差不多）
            const ic = GK0 + GK1 * GR[i];
            r = bgR + (fr - bgR) * ic; gg = bgG + (fg - bgG) * ic; b = bgB + (fb - bgB) * ic; c = '█';
            // 零星幾格凝結得比較厚的小水氣：亮一點、白一點（只改顏色，不用字元）
            const g2 = G2[i];
            if (g2 < SPK_K * d - 0.012) { const m3 = (r + gg + b) / 3, kk = 1.05 + 1.5 * (SPK_K * d - 0.012 - g2); r = (m3 + (r - m3) * 0.8) * kk + 3; gg = (m3 + (gg - m3) * 0.8) * kk + 3; b = (m3 + (b - m3) * 0.8) * kk + 5; }
          }
        }
        // 水珠：小的（BS 1）是霧上一點反光（整格 █；用字元的話旁邊會露出暗的背景色，一顆顆看起來像壞掉的像素），
        // 大一點的（BS 2、3）是透明的小圓珠（∘、o：看得到後面暗的景，外圈反光），最大的下面一格稍微暗一點
        const bd = BD[i];
        if (bd > 0) {
          BD[i] = bd - dt;
          const fade = bd < 4 ? bd / 4 : 1, bs = BS[i];
          if (c === '█' && 0.3 * r + 0.59 * gg + 0.11 * b > brT) {
            // 亮的霧上（雪景）：整格改成「透明的水珠」：看得到後面清楚的景，上緣一點反光
            const k = (0.45 + 0.12 * bs) * fade;
            r += (cR[i] * 1.08 + 26 - r) * k; gg += (cG[i] * 1.08 + 28 - gg) * k; b += (cB[i] * 1.08 + 34 - b) * k;
          } else {
            const hr = 150 + cR[i] * 0.5, hg = 162 + cG[i] * 0.5, hb = 182 + cB[i] * 0.45;
            if (bs === 1 || small) { const k = (small ? 0.22 + 0.1 * bs : 0.32) * fade; r += (hr - r) * k; gg += (hg - gg) * k; b += (hb - b) * k; }
            else { r += (hr - r) * fade; gg += (hg - gg) * fade; b += (hb - b) * fade; c = BT[bs] || '∘'; }
          }
        } else if (!small && y > 0 && BD[i - W] > 0 && d >= D0 && BS[i - W] === 3) { r *= 0.9; gg *= 0.9; b *= 0.9; }
        ch[i] = c; co[i] = col(r, gg, b);
      }
    }
    // ── 正在流（或正在長大）的水珠：亮的小點＋一圈暗邊（水珠把旁邊的霧吸乾了一點） ──
    const darken = (j, k) => { if (ch[j] !== '█') return; const c3 = hexToRgb(co[j]); co[j] = col(c3[0] * k, c3[1] * k, c3[2] * (k + 0.04)); };
    const lum = j => { const c3 = hexToRgb(co[j]); return 0.3 * c3[0] + 0.59 * c3[1] + 0.11 * c3[2]; };
    for (const d of s.drops) {
      const x = Math.floor(d.x), y = Math.floor(d.y); if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x, hr = 170 + cR[i] * 0.45, hg = 182 + cG[i] * 0.45, hb = 200 + cB[i] * 0.4;
      if (ch[i] === '█' && lum(i) > brT) {
        // 亮的霧上：整格變成透明、發亮的水珠（字元會露出暗的背景色），左右一點暗邊
        const k = d.st === 0 ? 0.35 + 0.4 * d.m : 0.8;
        const c3 = hexToRgb(co[i]); co[i] = col(c3[0] + (cR[i] * 1.1 + 40 - c3[0]) * k, c3[1] + (cG[i] * 1.1 + 42 - c3[1]) * k, c3[2] + (cB[i] * 1.1 + 50 - c3[2]) * k);
        if (d.m > 0.45) { if (x > 0) darken(i - 1, 0.8); if (x < W - 1) darken(i + 1, 0.8); if (y < H - 1) darken(i + W, 0.74); }
        continue;
      }
      const gch = small ? (d.st === 0 && d.m < 0.6 ? '·' : '•') : d.st === 0 ? (d.m < 0.45 ? '.' : d.m < 0.8 ? '∘' : 'o') : d.m > 0.9 ? 'O' : 'o';
      ch[i] = gch; co[i] = col(hr, hg, hb);
      // 暗邊：左右和下面
      const dk = small ? 0.8 : 0.58;
      if (d.m > 0.45 || !small) { if (x > 0) darken(i - 1, dk); if (x < W - 1) darken(i + 1, dk); if (y < H - 1) darken(i + W, dk); }
      if (!small && d.st === 1 && y > 0 && F[i - W] < D0) { ch[i - W] = "'"; co[i - W] = col(hr * 0.7, hg * 0.7, hb * 0.75); }
    }
    // ── 滾輪調整時：游標周圍畫出手指大小、右上角顯示粗細 ──
    if (s.showFs > 0 && playing) {
      const a = Math.min(1, s.showFs / 0.5), ring = col(220 * a + 20, 228 * a + 20, 240 * a + 20);
      // 圈出手指的大小：霧上把那一圈調亮（整格色塊），清楚的地方畫小點
      const N = Math.max(16, Math.round(R * 14));
      for (let k = 0; k < N; k++) {
        const an = k / N * TAU, x = Math.floor(m.x + Math.cos(an) * R * A), y = Math.floor(m.y + Math.sin(an) * R);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (ch[i] === '█') { const c3 = hexToRgb(co[i]); co[i] = col(c3[0] + (235 - c3[0]) * 0.55 * a, c3[1] + (240 - c3[1]) * 0.55 * a, c3[2] + (250 - c3[2]) * 0.55 * a); }
        else g.set(x, y, '·', ring);
      }
      const lv = clamp(Math.round(Math.log(s.fs / FS_MIN) / Math.log(FS_MAX / FS_MIN) * 6) + 1, 1, 7);
      const label = tr(f, '手指粗細 ', 'Finger size ') + '█'.repeat(lv) + '░'.repeat(7 - lv);
      const w = g.textW(label), x0 = W - w - 2;
      blank(g, x0 - 1, 0, w + 2, '#000000'); txt(g, x0, 0, label, col(225, 232, 245));
    }
    // ── 示範模式的提示 ──
    if (!playing) {
      let s2 = tr(f, '按住滑鼠在玻璃上畫畫・滾輪調整手指粗細', 'Hold the mouse button and draw on the glass · Scroll to change finger size');
      if (g.textW(s2) + 4 > W) s2 = tr(f, '按住滑鼠在玻璃上畫畫', 'Hold the mouse button and draw');
      const w = g.textW(s2), x0 = Math.floor((W - w) / 2);
      const hb = s.bgc, hk = 0.48;
      blank(g, x0 - 2, H - 1, w + 4, '#000000'); txt(g, x0, H - 1, s2, col(hb[0] + (232 - hb[0]) * hk, hb[1] + (236 - hb[1]) * hk, hb[2] + (248 - hb[2]) * hk));
    }
  },
});
// 英文介面的名稱與說明在 zz-i18n-en.js（tools/i18n-build.js 產生）
})();
