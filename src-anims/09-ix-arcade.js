// 互動街機（ix- 開頭）：用滑鼠就能玩的小遊戲桌布——打地鼠、打磚塊、乒乓、拍翅小鳥、接星星、游標貪食蛇。
// 只用滑鼠（移動、左鍵點擊、按住）；沒人操作（idle ≥ 6 秒）時電腦自己示範，一動滑鼠就交給玩家。
(() => {
/* ════════════ 共用小工具 ════════════ */
const parseFont = o => { const r = {}; for (const k in o) r[k] = o[k].split(','); return r; };
// 5×7 點陣字（數字、大寫字母、少數符號）
const F5 = parseFont({
  '0': '01110,10001,10011,10101,11001,10001,01110', '1': '00100,01100,00100,00100,00100,00100,01110',
  '2': '01110,10001,00001,00010,00100,01000,11111', '3': '11111,00010,00100,00010,00001,10001,01110',
  '4': '00010,00110,01010,10010,11111,00010,00010', '5': '11111,10000,11110,00001,00001,10001,01110',
  '6': '00110,01000,10000,11110,10001,10001,01110', '7': '11111,00001,00010,00100,01000,01000,01000',
  '8': '01110,10001,10001,01110,10001,10001,01110', '9': '01110,10001,10001,01111,00001,00010,01100',
  'A': '01110,10001,10001,11111,10001,10001,10001', 'B': '11110,10001,10001,11110,10001,10001,11110',
  'C': '01110,10001,10000,10000,10000,10001,01110', 'D': '11100,10010,10001,10001,10001,10010,11100',
  'E': '11111,10000,10000,11110,10000,10000,11111', 'F': '11111,10000,10000,11110,10000,10000,10000',
  'G': '01110,10001,10000,10111,10001,10001,01111', 'H': '10001,10001,10001,11111,10001,10001,10001',
  'I': '01110,00100,00100,00100,00100,00100,01110', 'J': '00111,00010,00010,00010,00010,10010,01100',
  'K': '10001,10010,10100,11000,10100,10010,10001', 'L': '10000,10000,10000,10000,10000,10000,11111',
  'M': '10001,11011,10101,10101,10001,10001,10001', 'N': '10001,10001,11001,10101,10011,10001,10001',
  'O': '01110,10001,10001,10001,10001,10001,01110', 'P': '11110,10001,10001,11110,10000,10000,10000',
  'Q': '01110,10001,10001,10001,10101,10010,01101', 'R': '11110,10001,10001,11110,10100,10010,10001',
  'S': '01111,10000,10000,01110,00001,00001,11110', 'T': '11111,00100,00100,00100,00100,00100,00100',
  'U': '10001,10001,10001,10001,10001,10001,01110', 'V': '10001,10001,10001,10001,10001,01010,00100',
  'W': '10001,10001,10001,10101,10101,10101,01010', 'X': '10001,10001,01010,00100,01010,10001,10001',
  'Y': '10001,10001,01010,00100,00100,00100,00100', 'Z': '11111,00001,00010,00100,01000,10000,11111',
  ':': '0,1,1,0,1,1,0', '.': '0,0,0,0,0,0,1', '!': '1,1,1,1,1,0,1', ' ': '000,000,000,000,000,000,000',
  '-': '00000,00000,00000,11111,00000,00000,00000',
});
function fontW(str, font) { let w = 0; for (const c of str) w += (font[c] || font[' '])[0].length + 1; return Math.max(0, w - 1); }
function drawBig(g, str, x0, y0, sx, sy, col, font = F5, ch = '█') {
  let x = Math.round(x0); const y = Math.round(y0);
  for (const c of str) {
    const gl = font[c] || font[' '], w = gl[0].length, h = gl.length;
    for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
      if (gl[r][q] !== '1') continue;
      for (let yy = 0; yy < sy; yy++) for (let xx = 0; xx < sx; xx++) g.set(x + q * sx + xx, y + r * sy + yy, ch, col);
    }
    x += (w + 1) * sx;
  }
}
function bigFit(str, maxW, maxH, aspect, font = F5) {
  const pw = fontW(str, font), ph = font['0'].length;
  const sy = Math.max(1, Math.floor(Math.min(maxH / ph, maxW / (pw * aspect))));
  let sx = Math.max(1, Math.round(sy * aspect));
  if (pw * sx > maxW) sx = Math.max(1, Math.floor(maxW / pw));
  return { sx, sy, w: pw * sx, h: ph * sy };
}
// 寫字：全形字的第二格也清掉，底下的背景才不會蓋住字的右半邊
const wideCh = c => { const k = c.codePointAt(0); return k >= 0x2e80 && k < 0xff61; };
// solid：空白也蓋掉底下的東西（英文字之間有空白，畫在背景上時才不會被雲、星星穿過去）
function txt(g, x, y, s, col, solid) {
  x = Math.floor(x);
  for (const c of s) { const w = wideCh(c); if (c !== ' ') { g.set(x, y, c, col); if (w) g.set(x + 1, y, ' ', col); } else if (solid) g.set(x, y, ' ', col); x += w ? 2 : 1; }
}
function fillRect(g, x0, y0, w, h, ch, col) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(g.rows, Math.floor(y0 + h)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(g.cols, Math.floor(x0 + w)); x++) { const i = y * g.cols + x; g.ch[i] = ch; g.co[i] = col; }
}
function box(g, x0, y0, w, h, col) {
  for (let x = 1; x < w - 1; x++) { g.set(x0 + x, y0, '─', col); g.set(x0 + x, y0 + h - 1, '─', col); }
  for (let y = 1; y < h - 1; y++) { g.set(x0, y0 + y, '│', col); g.set(x0 + w - 1, y0 + y, '│', col); }
  g.set(x0, y0, '┌', col); g.set(x0 + w - 1, y0, '┐', col); g.set(x0, y0 + h - 1, '└', col); g.set(x0 + w - 1, y0 + h - 1, '┘', col);
}
const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 介面語言：f.lang === 'en' 時畫英文，其他（含舊版沒有 f.lang）都畫中文
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
const fold = (v, lo, hi) => { const L = hi - lo; if (L <= 0) return lo; let m = (v - lo) % (2 * L); if (m < 0) m += 2 * L; return lo + (m > L ? 2 * L - m : m); };
const angD = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };

// ── 互動共用 ──
const IDLE = 6;                                         // 幾秒沒操作就換電腦示範
const userOn = f => f.mouse.idle < IDLE;                // Infinity（沒人碰過）也是 false
const ptrOk = m => m.on && Number.isFinite(m.x) && Number.isFinite(m.y);   // 游標座標可用（防呆：不是數字就不理）
const clickOk = c => Number.isFinite(c.x) && Number.isFinite(c.y);
const stepDt = f => Math.min(0.1, Math.max(0, f.dt || 0));
const hudRow = f => (f.rows >= 40 ? 1 : 0);
// 右上角的小資訊列：segs = [[文字, 顏色], ...]
function hud(f, segs) {
  const g = f.g; let w = 0;
  for (const s of segs) w += g.textW(s[0]);
  let x = Math.max(1, f.cols - w - 2); const y = hudRow(f);
  fillRect(g, x - 1, y, w + 2, 1, ' ', f.C(0));
  for (const s of segs) { txt(g, x, y, s[0], s[1]); x += g.textW(s[0]); }
}
// 示範模式：底部正中一行暗暗的提示（玩家在玩時不顯示）
function hint(f, str) {
  if (userOn(f)) return;
  const g = f.g, w = g.textW(str), x = Math.floor((f.cols - w) / 2), y = f.rows - 1;
  fillRect(g, x - 1, y, w + 2, 1, ' ', f.C(0));
  txt(g, x, y, str, f.C(0.3 + 0.06 * Math.sin(f.t * 2)));
}
// 結算看板：大點陣字 + 一行說明，底下清空並加細框
function banner(f, big, sub, cy) {
  const { g, cols, rows, C } = f;
  const fit = bigFit(big, cols * 0.6, Math.max(7, rows * 0.15), f.aspect);
  const sw = sub ? g.textW(sub) : 0, w = Math.max(fit.w, sw), h = fit.h + (sub ? 2 : 0);
  const y0 = Math.round((cy === undefined ? rows * 0.45 : cy) - h / 2);
  const px = Math.floor((cols - w) / 2) - 3, py = y0 - 2;
  fillRect(g, px, py, w + 6, h + 4, ' ', C(0));
  box(g, px, py, w + 6, h + 4, C(0.4));
  drawBig(g, big, Math.floor((cols - fit.w) / 2), y0, fit.sx, fit.sy, C(0.95));
  if (sub) txt(g, Math.floor((cols - sw) / 2), y0 + fit.h + 1, sub, C(0.72));
}
// 結算看板的說明行：「得分 N　新紀錄！」或「得分 N　最高 M」
const bestTail = (f, s) => (s.newBest && s.score > 0 ? tr(f, '　新紀錄！', '  New best!') : tr(f, '　最高 ', '  Best ') + s.best);
const overLine = (f, s) => tr(f, '得分 ', 'Score ') + s.score + bestTail(f, s);
// 飄字：{ x, y, s, t, life, col }；s 可以是 [中文, 英文]，畫的時候才依語言挑
function fxText(list, x, y, s, col, life = 0.9) { if (list.length < 40) list.push({ x, y, s, t: 0, life, col }); }
function drawTexts(f, list, dt, rise) {
  const g = f.g;
  for (let k = list.length - 1; k >= 0; k--) {
    const q = list[k]; q.t += dt; q.y -= rise * dt;
    if (q.t >= q.life) { list[k] = list[list.length - 1]; list.pop(); continue; }
    const str = typeof q.s === 'string' ? q.s : tr(f, q.s[0], q.s[1]), en = f.lang === 'en', x = q.x - g.textW(str) / 2;
    txt(g, en ? clamp(x, 0, g.cols - g.textW(str)) : x, q.y, str, q.col, en);   // 英文比較長：不讓它超出畫面左右邊
  }
}
// 粒子：{ x, y, vx, vy, l, l0, ch, hue }（hue < 0 表示用主題色）
function addPart(list, x, y, vx, vy, l, ch, hue, cap = 400) { if (list.length < cap) list.push({ x, y, vx, vy, l, l0: l, ch, hue }); }
function drawParts(f, list, dt, grav) {
  const { g, C, H } = f;
  for (let k = list.length - 1; k >= 0; k--) {
    const q = list[k]; q.l -= dt;
    if (q.l <= 0) { list[k] = list[list.length - 1]; list.pop(); continue; }
    q.vy += grav * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    const a = q.l / q.l0;
    g.set(q.x, q.y, a > 0.4 ? q.ch : '·', q.hue < 0 ? C(0.3 + a * 0.6) : H(q.hue, 0.35 + a * 0.6));
  }
}
// 半格點陣小圖：pix 每個 '#' 是 1 欄寬、半列高的點；k 倍放大後用 ▀▄█ 拼出來，中心對齊 (x, y)
function pxSprite(g, x, y, pix, k, col) {
  const pw = pix[0].length, ph = pix.length, Hh = ph * k, x0 = Math.round(x - (pw * k) / 2), y0 = Math.round(y - Hh / 4);
  for (let r = 0; r * 2 < Hh; r++) {
    const pt = ((r * 2) / k) | 0, pb = ((r * 2 + 1) / k) | 0, rowT = pix[pt], rowB = r * 2 + 1 < Hh ? pix[pb] : null;
    for (let c = 0; c < pw * k; c++) {
      const q = (c / k) | 0, t = rowT[q] === '#', b = !!rowB && rowB[q] === '#';
      if (t || b) g.set(x0 + c, y0 + r, t && b ? '█' : t ? '▀' : '▄', col);
    }
  }
}
// 靜態背景層：init 時算好「格子位置、字元、顏色編號」，每格只要照表貼上（顏色每格現算，換主題也跟著變）
function mkLayer() { return { i: [], c: [], k: [] }; }
function layerPut(L, g, x, y, ch, k) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return; L.i.push(y * g.cols + x); L.c.push(ch); L.k.push(k); }
function layerDraw(L, g, pal) { const I = L.i, Cc = L.c, K = L.k, gc = g.ch, go = g.co; for (let n = 0; n < I.length; n++) { gc[I[n]] = Cc[n]; go[I[n]] = pal[K[n]]; } }

/* ════════════ 1. 打地鼠 ════════════ */
const WK_GRASS = [',', '\'', '"', '.', '`', ','];
const WK_RISE = 0.13, WK_FALL = 0.16, WK_HOLE = rgb(7, 5, 3), WK_EYE = rgb(12, 9, 7);
// 依畫面比例選出讓地鼠最大的洞口排法（同樣大小時偏好接近方陣）
function wkFit(N, fw, fh, A) {
  let best = null;
  for (let ny = 1; ny <= N; ny++) {
    const nx = Math.ceil(N / ny), sw = fw / nx, sh = fh / ny;
    const r = Math.min(sw / 3.5, (sh - 1.5) * A / 2.7), sc = r * (1 - 0.04 * Math.abs(nx - ny));
    if (!best || sc > best.sc) best = { nx, ny, r, sw, sh, sc };
  }
  return best;
}
const wkCan = h => (h.st === 1 && h.up > 0.35) || h.st === 2 || (h.st === 3 && h.up > 0.3);
function wkRound(s, p) { s.score = 0; s.combo = 0; s.time = p.time; s.phase = 'play'; s.overT = 0; s.spawnT = 0.6; s.newBest = false; }
function wkWhack(s, f, x, y) {
  const ham = s.ham;
  ham.swing = 0.17; ham.sx = x; ham.sy = y;
  s.booms.push({ x, y, t: 0 }); if (s.booms.length > 6) s.booms.shift();
  if (s.phase !== 'play') return;
  let hit = null;
  for (const h of s.holes) {
    if (!wkCan(h)) continue;
    const hgt = h.up * s.ry * 1.75;
    if (Math.abs(x - h.cx) <= s.rx * 1.3 && y >= h.rim - hgt - 1.5 && y <= h.rim + s.oh + 1) { hit = h; break; }
  }
  if (hit) {
    s.combo++;
    const mult = s.combo >= 10 ? 3 : s.combo >= 5 ? 2 : 1, pts = (hit.kind ? 50 : 10) * mult;
    s.score += pts; hit.st = 4; hit.t = 0.42;
    if (s.score > s.best) { s.best = s.score; s.newBest = true; }
    const ty = hit.rim - s.ry * 1.75 - 1.5;
    fxText(s.texts, hit.cx, ty, '+' + pts + (mult > 1 ? ' ×' + mult : ''), hit.kind ? f.H(48, 1) : f.C(1));
    for (let k = 0; k < (hit.kind ? 14 : 7); k++) { const a = rnd(0, TAU), v = rnd(4, 12) * Math.max(1, s.rx / 8); addPart(s.parts, hit.cx, ty + 1, Math.cos(a) * v * 1.6, Math.sin(a) * v * 0.6 - 3, rnd(0.35, 0.7), hit.kind ? '✦' : '*', hit.kind ? 48 : 55, 120); }
  } else { s.combo = 0; fxText(s.texts, x, y - 1.5, ['落空', 'Miss'], f.C(0.45), 0.6); }
}
function wkAI(s, f, dt) {
  const ai = s.ai, ham = s.ham, p = f.p;
  ai.cool -= dt;
  let h = ai.tgt >= 0 ? s.holes[ai.tgt] : null;
  if (h && !wkCan(h) && !ai.late) { ai.tgt = -1; h = null; ai.cool = rnd(0.05, 0.2); }
  if (!h && ai.cool <= 0 && s.phase === 'play') {
    let best = -1, bs = -1e9;
    for (let k = 0; k < s.holes.length; k++) {
      const q = s.holes[k]; if (!wkCan(q)) continue;
      const d = Math.hypot(q.cx - ham.x, (q.rim - ham.y) * f.aspect), sc = (q.kind ? 60 : 0) - d * 0.3 - (q.st === 3 ? 12 : 0) + rnd(0, 6);
      if (sc > bs) { bs = sc; best = k; }
    }
    if (best >= 0) {
      ai.tgt = best; h = s.holes[best];
      ai.react = rnd(0.12, 0.4) / p.ai;                                  // 反應時間
      const miss = Math.random() < 0.12 / p.ai;                         // 偶爾手滑敲歪
      ai.ox = miss ? (Math.random() < 0.5 ? -1 : 1) * s.rx * rnd(1.6, 2.1) : gauss() * s.rx * 0.15;
      ai.oy = -s.ry * rnd(0.5, 1.1); ai.late = Math.random() < 0.5;      // 地鼠縮回去時，有時還是會晚一步敲下去
    }
  }
  if (h) {
    if (ai.react > 0) { ai.react -= dt; return; }
    const tx = h.cx + ai.ox, ty = h.rim + ai.oy, k = 1 - Math.exp(-dt * 12 * p.ai);
    ham.x += (tx - ham.x) * k; ham.y += (ty - ham.y) * k;
    if (Math.abs(tx - ham.x) < Math.max(1, s.rx * 0.25) && Math.abs(ty - ham.y) < 1 && ham.swing <= 0) {
      wkWhack(s, f, ham.x, ham.y); ai.tgt = -1; ai.cool = rnd(0.08, 0.25) / p.ai;
    }
  } else {
    const tx = f.cols * (0.5 + 0.22 * Math.sin(s.t * 0.37)), ty = f.rows * (0.5 + 0.12 * Math.sin(s.t * 0.53)), k = 1 - Math.exp(-dt * 1.2);
    ham.x += (tx - ham.x) * k; ham.y += (ty - ham.y) * k;
  }
}
function wkMole(g, f, s, h) {
  if (h.up <= 0.02) return;
  const rx = s.rx, ry = s.ry, top = h.rim - h.up * ry * 1.75, cx = h.cx, gold = h.kind === 1, hue = gold ? 46 : 24;
  const cB = f.H(hue, gold ? 0.8 : 0.48), cS = f.H(hue - 6, gold ? 0.55 : 0.3), cL = f.H(hue + 6, gold ? 0.98 : 0.64);
  const y0 = Math.max(0, Math.floor(top)), y1 = h.rim;
  for (let y = y0; y < y1; y++) {
    const yc = y + 0.5 - top;
    let hw = rx;
    if (yc < ry) { const d = (ry - yc) / ry; hw = rx * Math.sqrt(Math.max(0, 1 - d * d)); }
    if (hw < 0.45) continue;
    const ch = y === y0 && y + 1 - top < 0.55 ? '▄' : '█', xa = Math.round(cx - hw), xb = Math.round(cx + hw);
    for (let x = xa; x < xb; x++) {
      const u = (x + 0.5 - cx) / rx;
      g.set(x, y, ch, u > 0.62 ? cS : u < -0.15 && u > -0.8 && yc < ry * 0.8 ? cL : cB);
    }
  }
  // 臉：眼睛、淺色口鼻、粉紅鼻子、門牙、鬍鬚（大尺寸時五官跟著放大）
  const hit = h.st >= 4, vis = y => y >= y0 && y < y1 && y >= top + 0.3, white = f.C(1);
  const ey = Math.floor(top + ry * 0.6), ex = Math.max(1, Math.round(rx * 0.36));
  const ew = Math.max(1, Math.round(rx * 0.14)), eh = Math.max(1, Math.round((ew / f.aspect) * 1.3));
  const ny = Math.max(ey + eh, Math.floor(top + ry * 1.05)), nw = Math.max(1, Math.round(rx * 0.1));
  if (rx >= 7) {   // 口鼻部位淺一點
    const mx = rx * 0.42, my = Math.max(1, ry * 0.32), mcy = ny + my * 0.5, cM = f.H(hue + 8, gold ? 1 : 0.68);
    for (let y = Math.floor(mcy - my); y <= mcy + my; y++) {
      if (!vis(y)) continue;
      const d = (y + 0.5 - mcy) / my; if (Math.abs(d) > 1) continue;
      const hw = mx * Math.sqrt(1 - d * d);
      for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) g.set(x, y, '█', cM);
    }
  }
  for (const sd of [-1, 1]) {
    const x0 = sd < 0 ? cx - ex - ew + 1 : cx + ex - 1;
    if (ew * eh === 1) { if (vis(ey)) g.set(x0, ey, hit ? '×' : '●', white); continue; }
    for (let y = ey; y < ey + eh; y++) if (vis(y)) for (let x = x0; x < x0 + ew; x++) g.set(x, y, '█', WK_EYE);   // 黑眼珠
    if (vis(ey)) { if (hit) g.set(x0 + (ew >> 1), ey + (eh >> 1), '×', white); else g.set(x0 + ew - 1, ey, '●', white); }
  }
  if (vis(ny)) {
    for (let x = cx - nw; x < cx + nw; x++) g.set(x, ny, rx >= 14 ? '█' : '▄', f.H(345, 0.78));
    if (rx >= 9) { const wl = Math.round(rx * 0.3); for (let k = 0; k < wl; k++) { g.set(cx - nw - 2 - k, ny, '─', f.C(0.8)); g.set(cx + nw + 1 + k, ny, '─', f.C(0.8)); } }
  }
  if (rx >= 6 && vis(ny + 1)) { const tw = rx >= 14 ? 2 : 1; for (let k = 0; k < tw; k++) { g.set(cx - 1 - k, ny + 1, rx >= 14 ? '█' : '▀', white); g.set(cx + k, ny + 1, rx >= 14 ? '█' : '▀', white); } }
  if (hit) for (let k = 0; k < 3; k++) { const a = s.t * 7 + k * TAU / 3; g.set(cx + Math.cos(a) * rx * 0.75, top - 0.7 + Math.sin(a) * 0.6, '✦', f.H(55, 0.95)); }
  else if (gold) for (let k = 0; k < 2; k++) { const q = hash((s.t * 6) | 0, k + h.cx); g.set(cx + (q - 0.5) * rx * 2.6, top + hash(k, (s.t * 6) | 0) * ry * 1.4 - 0.5, q > 0.5 ? '✦' : '·', f.C(1)); }
}
function wkHammer(g, f, s, x, y, slam) {
  const hw = s.hw, hh = s.hh;
  const x0 = Math.round(x - hw / 2) + (slam ? 0 : Math.round(hw * 0.35)), y1 = Math.round(y) - (slam ? 0 : Math.round(hh * 1.4 + 1)), y0 = y1 - hh + 1;
  const wood = f.H(32, 0.5), woodHi = f.H(36, 0.66), woodLo = f.H(28, 0.36), cHead = f.H(4, 0.6), cHi = f.H(10, 0.85), cLo = f.H(0, 0.36);
  const L = Math.max(3, Math.round(hh * 1.7));
  if (slam) {
    // 敲下去的瞬間：握柄橫躺在錘頭右邊（不會斜斜穿過地鼠的臉）
    const t = Math.max(1, Math.round(hh * 0.3)), ya = y0 + Math.max(0, Math.floor((hh - t) / 2)), len = Math.max(4, Math.round(hw * 1.1));
    for (let r = 0; r < t; r++) for (let k = 0; k < len; k++) g.set(x0 + hw + k, ya + r, '█', t > 1 && r === 0 ? woodHi : t > 1 && r === t - 1 ? woodLo : wood);
  } else {
    // 舉起來時：粗粗的握柄從錘頭往右上斜（每列兩格一階）
    const w = Math.max(2, Math.round(hh * 0.45)), hx = x0 + Math.round(hw * 0.6) - (w >> 1);
    for (let k = 1; k <= L; k++) for (let q = 0; q < w; q++) g.set(hx + (k - 1) * 2 + q, y0 - k, '█', q === 0 ? woodHi : q === w - 1 ? woodLo : wood);
  }
  for (let yy = y0; yy <= y1; yy++) for (let xx = 0; xx < hw; xx++) {
    const ch = hh >= 2 && yy === y0 ? '▄' : hh >= 2 && yy === y1 ? '▀' : '█';
    g.set(x0 + xx, yy, ch, xx === hw - 1 ? cLo : yy === y0 + (hh > 2 ? 1 : 0) ? cHi : cHead);
  }
}
const WK_RAYS = [[1, 0, '─'], [-1, 0, '─'], [0, -1, '│'], [0.7, -0.7, '╱'], [-0.7, -0.7, '╲'], [0.7, 0.7, '╲'], [-0.7, 0.7, '╱'], [0, 1, '│']];
A({ id: 'ix-whack', name: '打地鼠', cat: '街機', theme: 'forest', hue: true, interactive: true,
  desc: '點一下敲冒出來的地鼠，連續敲中分數加倍；沒人玩時會自己示範',
  params: { holes: 9, speed: 1, time: 45, multi: 1, gold: 0.08, ai: 1 },
  variants: [
    { id: 'fast', name: '快手', theme: 'amber', desc: '地鼠一閃就縮回去，30 秒限時挑戰', params: { speed: 1.75, time: 30, ai: 1.3 } },
    { id: 'many', name: '鼠滿為患', theme: 'sunset', desc: '十二個洞，地鼠成群冒出，金地鼠更多', params: { holes: 12, multi: 3, gold: 0.14 } },
  ],
  init(s, f) {
    const { g, cols, rows, aspect: A, p } = f;
    const N = Math.max(3, p.holes | 0), top = rows >= 40 ? 4 : 2, bot = rows - 1;
    const fx0 = cols * 0.04, fw = cols * 0.92, fh = Math.max(4, bot - top), L = wkFit(N, fw, fh, A);
    s.rx = Math.max(2.2, Math.min(L.r, cols * 0.09)); s.ry = s.rx / A;
    s.oh = Math.max(0.6, s.ry * 0.24); s.mh = s.oh * 1.5 + Math.max(1, s.ry * 0.2);
    s.hw = clamp(Math.round(s.rx * 1.05), 4, 40); s.hh = Math.max(2, Math.round(s.hw / A * 0.7));
    s.holes = [];
    for (let j = 0; j < L.ny; j++) {
      const cnt = Math.floor(N / L.ny) + (j < N % L.ny ? 1 : 0), rim = Math.round(top + (j + 1) * L.sh - s.mh - s.oh * 0.5 - 0.6);
      for (let i = 0; i < cnt; i++) s.holes.push({ cx: Math.round(fx0 + fw / 2 + (i - (cnt - 1) / 2) * L.sw), rim, st: 0, up: 0, t: 0, kind: 0, cd: 0 });
    }
    // 靜態層：草地 + 土堆 + 洞口（洞口留空 = 黑）。土堆中心比洞口低一點：後緣薄、前緣厚，看起來才像地上的洞
    const mask = new Uint8Array(cols * rows), lay = mkLayer();
    const mw = s.rx * 1.5, mh = s.mh, ow = s.rx * 1.15, oh = s.oh, mc = oh * 0.5;
    for (const h of s.holes) {
      const inM = (x, y) => { const ex = (x + 0.5 - h.cx) / mw, ey = (y + 0.5 - h.rim - mc) / mh; return ex * ex + ey * ey <= 1; };
      for (let y = Math.floor(h.rim + mc - mh - 1); y <= h.rim + mc + mh + 1; y++) for (let x = Math.floor(h.cx - mw - 1); x <= h.cx + mw + 1; x++) {
        if (!inM(x, y) || x < 0 || y < 0 || x >= cols || y >= rows) continue;
        mask[y * cols + x] = 1;
        const ex = (x + 0.5 - h.cx) / ow, ey = (y + 0.5 - h.rim) / oh;
        if (ex * ex + ey * ey <= 1) { layerPut(lay, g, x, y, '█', 10); continue; }   // 洞裡比草地更暗
        const v = (y + 0.5 - h.rim - mc) / mh, ch = !inM(x, y - 1) ? '▄' : !inM(x, y + 1) ? '▀' : hash(x, y) < 0.22 ? '▓' : '█';
        layerPut(lay, g, x, y, ch, ey < 0 ? 7 : v > 0.55 ? 9 : 8);
      }
    }
    for (let y = top - 1; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (mask[y * cols + x]) continue;
      const hv = hash(x, y * 7 + 3);
      if (hv < 0.055) layerPut(lay, g, x, y, WK_GRASS[((hv * 1000) | 0) % WK_GRASS.length], ((hv * 77) | 0) % 4);
      else if (hv < 0.0585) layerPut(lay, g, x, y, '*', 4 + (((hv * 5000) | 0) % 3));
    }
    s.lay = lay; s.pal = new Array(11).fill('#000000');
    s.ham ={ x: cols * 0.6, y: rows * 0.5, swing: 0, sx: 0, sy: 0 };
    s.ai = { tgt: -1, react: 0, cool: 0.5, ox: 0, oy: 0, late: false };
    s.texts = []; s.parts = []; s.booms = []; s.best = 0; s.user = false; s.t = 0;
    wkRound(s, p);
  },
  frame(s, f) {
    const { g, C, H, p } = f, dt = stepDt(f), m = f.mouse, playing = userOn(f);
    if (playing && !s.user) { s.user = true; if (s.phase === 'play') wkRound(s, p); }   // 玩家接手：重新開一局給他
    else if (!playing && s.user) s.user = false;
    s.t += dt;
    const prog = clamp(1 - s.time / p.time, 0, 1);
    if (s.phase === 'play') {
      s.time -= dt;
      if (s.time <= 0) { s.time = 0; s.phase = 'over'; s.overT = 0; s.combo = 0; for (const h of s.holes) if (h.st === 1 || h.st === 2) h.st = 3; }
      s.spawnT -= dt;
      if (s.spawnT <= 0 && s.phase === 'play') {
        let act = 0; for (const h of s.holes) if (h.st) act++;
        if (act < p.multi + (prog > 0.55 ? 1 : 0)) {
          const free = s.holes.filter(h => !h.st && h.cd <= 0);
          if (free.length) { const h = pick(free); h.st = 1; h.up = 0; h.kind = Math.random() < p.gold ? 1 : 0; h.t = rnd(0.75, 1.25) * (1 - 0.4 * prog) / p.speed * (h.kind ? 0.7 : 1); }
        }
        s.spawnT = rnd(0.3, 0.8) * (1 - 0.35 * prog) / p.speed / (p.multi > 1 ? 1.5 : 1);
      }
    } else { s.overT += dt; if (s.overT > 4.5) wkRound(s, p); }
    for (const h of s.holes) {
      h.cd -= dt;
      if (h.st === 1) { h.up += dt / WK_RISE; if (h.up >= 1) { h.up = 1; h.st = 2; } }
      else if (h.st === 2) { h.t -= dt; if (h.t <= 0) h.st = 3; }
      else if (h.st === 3) { h.up -= dt / WK_FALL; if (h.up <= 0) { h.up = 0; h.st = 0; h.cd = 0.3; if (s.phase === 'play') s.combo = 0; } }   // 讓牠跑了：連擊中斷
      else if (h.st === 4) { h.t -= dt; if (h.t <= 0) h.st = 5; }
      else if (h.st === 5) { h.up -= dt / 0.12; if (h.up <= 0) { h.up = 0; h.st = 0; h.cd = 0.35; } }
    }
    const ham = s.ham;
    if (s.user) {
      if (ptrOk(m)) { ham.x = clamp(m.x, 0, f.cols); ham.y = clamp(m.y, 0, f.rows); }
      for (const c of m.clicks) if (clickOk(c)) wkWhack(s, f, c.x, c.y);
    } else wkAI(s, f, dt);
    // ── 畫：整片底色是暗暗的草地，洞口是更暗的黑洞 ──
    f.bg = C(0.05);
    const P = s.pal;
    P[0] = C(0.14); P[1] = C(0.18); P[2] = C(0.22); P[3] = C(0.27); P[4] = H(330, 0.55); P[5] = H(52, 0.6); P[6] = H(200, 0.5);
    P[7] = H(32, 0.42); P[8] = H(28, 0.32); P[9] = H(24, 0.22); P[10] = WK_HOLE;
    layerDraw(s.lay, g, P);
    for (const h of s.holes) wkMole(g, f, s, h);
    for (let k = s.booms.length - 1; k >= 0; k--) {
      const b = s.booms[k]; b.t += dt;
      if (b.t > 0.22) { s.booms.splice(k, 1); continue; }
      const R = s.hw * (0.55 + b.t * 2.5), col = C(1 - b.t * 2.5);
      for (const [dx, dy, ch] of WK_RAYS) { g.set(b.x + dx * R, b.y + dy * R / f.aspect, ch, col); g.set(b.x + dx * R * 1.25, b.y + dy * R * 1.25 / f.aspect, ch, col); }
    }
    drawParts(f, s.parts, dt, 20);
    drawTexts(f, s.texts, dt, 3);
    ham.swing = Math.max(0, ham.swing - dt);
    if (!s.user || ptrOk(m)) { const sl = ham.swing > 0; wkHammer(g, f, s, sl ? ham.sx : ham.x, sl ? ham.sy : ham.y, sl); }
    const lb = C(0.4), segs = [];
    if (!s.user) segs.push([tr(f, '示範  ', 'Demo  '), C(0.32)]);
    segs.push([tr(f, '時間 ', 'Time '), lb], [String(Math.ceil(s.time)).padStart(2, ' '), s.time < 10 && s.phase === 'play' ? H(5, 0.8) : C(0.85)], [tr(f, '  得分 ', '  Score '), lb], [String(s.score), C(0.95)]);
    if (s.combo >= 2) segs.push([tr(f, '  連擊 ', '  Combo '), lb], [String(s.combo), H(45, 0.9)]);
    segs.push([tr(f, '  最高 ', '  Best '), lb], [String(s.best), C(0.7)]);
    hud(f, segs);
    hint(f, tr(f, '點一下敲地鼠 ── 移動滑鼠到桌面上就能玩', 'Click to whack a mole ── move the mouse over the desktop to play'));
    if (s.phase === 'over' && s.overT > 0.4) banner(f, 'TIME UP', overLine(f, s));
  } });

/* ════════════ 2. 打磚塊 ════════════ */
const BK_LAYOUTS = ['rows', 'pyramid', 'diamond', 'checker', 'wave', 'holes'];
function bkCell(kind, i, j, nx, ny, lvl) {
  const u = (i + 0.5) / nx * 2 - 1, v = (j + 0.5) / ny * 2 - 1;
  switch (kind) {
    case 'pyramid': return Math.abs(u) <= (j + 1) / ny + 0.02 ? (j < ny * 0.3 ? 2 : 1) : 0;
    case 'diamond': { const d = Math.abs(u) + Math.abs(v); return d <= 1 ? (d < 0.4 ? 3 : d < 0.7 ? 2 : 1) : 0; }
    case 'checker': return j < 2 ? 2 : (i + j) % 2 ? 2 : 1;
    case 'wave': { const c = 0.45 * Math.sin(u * Math.PI * 2 + lvl); return Math.abs(v - c) < 0.45 ? 1 : 0; }
    case 'holes': return hash(i, j + lvl * 31) < 0.8 ? 1 : 0;
    default: return j < 2 && lvl > 3 ? 2 : 1;
  }
}
const BK_BALL = ['##', '##'], BK_NX = 14, BK_NY = 6;
const BK_CAP = { W: ['(寬)', 190, '(Wide)'], M: ['(多)', 300, '(Multi)'], '+': ['(♥)', 350, '(♥)'] };   // 道具膠囊：直接寫出效果（[中文, 色相, 英文]）
function bkBall(s) { return { x: s.px, y: s.py * s.A - s.r - 0.3, vx: 0, vy: 0, held: true, hT: 0, off: 0, hue: rnd(0, 360), aimK: -1, err: 0, jit: 0 }; }
function bkErr(s, b, p) { b.jit = gauss() * 0.06; b.err = Math.random() < p.aiMiss ? (Math.random() < 0.5 ? -1 : 1) * s.pw * rnd(0.75, 1) : 0; }
function bkLevel(s, f) {
  const p = f.p; s.level++;
  const kind = BK_LAYOUTS[(s.level - 1) % BK_LAYOUTS.length];
  for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) s.hp[j * s.nx + i] = bkCell(kind, i, j, s.nx, s.ny, s.level);
  s.kind = kind; s.sp = s.sp0 * Math.min(1.45, 1 + 0.07 * (s.level - 1));
  s.balls = [bkBall(s)]; s.caps.length = 0; s.wideT = 0; s.msg = ''; s.msgT = 0;
  bkErr(s, s.balls[0], p);
}
function bkNew(s, f) { s.score = 0; s.lives = 3; s.level = 0; s.newBest = false; bkLevel(s, f); }
function bkLaunch(s, b, a) { b.held = false; b.vx = Math.sin(a) * s.sp; b.vy = -Math.cos(a) * s.sp; b.aimK = -1; }
function bkHit(s, f, i, j) {
  const k = j * s.nx + i, p = f.p;
  s.hp[k]--; s.score += 10;
  if (s.hp[k]) return;
  s.score += 40;
  const x0 = s.x0 + i * s.bw, y0 = s.by0 + j * s.bh;
  for (let q = 0; q < 5; q++) addPart(s.parts, x0 + rnd(0, s.bw - 1), y0 + rnd(0, s.bh), rnd(-8, 8), rnd(-6, 2), rnd(0.5, 1.1), '▪', -1, 300);
  if (p.power && Math.random() < 0.14) { const r = Math.random(); s.caps.push({ x: x0 + s.bw / 2, y: y0, k: r < 0.42 ? 'W' : r < 0.86 ? 'M' : '+' }); }
}
function bkAI(s, f, dt) {
  const A = s.A, Yp = s.py * A, r = s.r, L = s.x0, R = s.x0 + s.W;
  let trk = null, bt = 1e9;
  for (const b of s.balls) if (!b.held && b.vy > 0) { const t = (Yp - r - b.y) / b.vy; if (t < bt) { bt = t; trk = b; } }
  let goal = s.px;
  if (trk) {
    if (trk.aimK < 0) { let n = 0; for (let k = 0; k < s.hp.length; k++) if (s.hp[k] && Math.random() < 1 / ++n) trk.aimK = k; if (trk.aimK < 0) trk.aimK = 0; }
    const lx = fold(trk.x + trk.vx * bt, L + r, R - r), ai = trk.aimK % s.nx, aj = (trk.aimK / s.nx) | 0;
    const tx = s.x0 + (ai + 0.5) * s.bw, ty = (s.by0 + (aj + 0.5) * s.bh) * A;
    const off = clamp(Math.atan2(tx - lx, Yp - ty) / 1.05, -0.85, 0.85);
    goal = lx - (trk.err ? trk.err : clamp(off * s.pw / 2 + trk.jit * s.pw, -s.pw * 0.42, s.pw * 0.42));
  } else if (s.caps.length) { let c = s.caps[0]; for (const q of s.caps) if (q.y > c.y) c = q; goal = c.x; }
  else if (s.balls.length) goal = s.balls[0].held ? s.x0 + s.W * (0.5 + 0.3 * Math.sin(s.t * 0.7)) : s.balls[0].x;
  s.goal += (goal - s.goal) * (1 - Math.exp(-dt * 7));               // 反應有一點延遲
  const mv = s.W * 1.15 * dt;
  s.px += clamp(s.goal - s.px, -mv, mv);
}
A({ id: 'ix-breakout', name: '打磚塊', cat: '街機', theme: 'synth', hue: true, interactive: true,
  desc: '左右移動滑鼠控制球拍，點一下發球，把磚牆全部打掉',
  params: { speed: 1, power: 0, aiMiss: 0.012 },
  variants: [
    { id: 'power', name: '道具戰', theme: 'cyber', desc: '打碎磚塊會掉道具，用球拍接住：加寬球拍、分裂多球、多一條命', params: { power: 1, aiMiss: 0.012 } },
  ],
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    s.A = A; s.top = hudRow(f) + 2;
    // 磚牆最多 14×6 塊：大畫面把磚塊做大，不是加更多塊（不然一關要打好幾分鐘）
    const bh0 = Math.max(1, Math.round(rows / 44)), bw0 = Math.max(5, Math.round(bh0 * A * 3.3)), wallH = rows * 0.27;
    s.nx = clamp(Math.floor((cols - 4) / bw0), 4, BK_NX); s.bw = Math.max(5, Math.floor((cols - 4) / s.nx));
    s.ny = clamp(Math.floor(wallH / bh0), 4, BK_NY); s.bh = Math.max(1, Math.round(wallH / s.ny));
    s.W = s.nx * s.bw; s.x0 = Math.floor((cols - s.W) / 2);
    s.by0 = s.top + Math.max(1, Math.round(rows * 0.07));
    s.py = rows - 2; s.pw0 = Math.max(7, Math.round(s.W * 0.1)); s.pw = s.pw0;
    s.bsz = rows >= 60 ? Math.max(1, Math.round(rows / 75)) : 0;                 // 大畫面的球用 2k×k 格的方塊
    s.px = s.x0 + s.W / 2; s.ppx = s.px; s.pv = 0; s.goal = s.px; s.r = s.bsz ? s.bsz * 0.95 : 0.6;
    s.sp0 = rows * A * 0.72 * f.p.speed; s.hp = new Uint8Array(s.nx * s.ny);
    s.parts = []; s.caps = []; s.texts = []; s.best = 0; s.user = false; s.t = 0;
    bkNew(s, f);
  },
  frame(s, f) {
    const { g, C, H, p, rows } = f, dt = stepDt(f), m = f.mouse, playing = userOn(f), A = s.A;
    if (playing && !s.user) s.user = true; else if (!playing && s.user) s.user = false;
    s.t += dt;
    if (s.msgT > 0) { s.msgT -= dt; if (s.msgT <= 0) { if (s.msg === 'over') bkNew(s, f); else bkLevel(s, f); } }
    s.wideT = Math.max(0, s.wideT - dt);
    s.pw = Math.round(s.pw0 * (s.wideT > 0 ? 1.6 : 1));
    const L = s.x0, R = s.x0 + s.W, half = s.pw / 2, nx = s.nx, ny = s.ny, Yp = s.py * A, r = s.r;
    if (s.user) { if (ptrOk(m)) s.px = m.x; } else bkAI(s, f, dt);
    s.px = clamp(s.px, L + half, R - half);
    s.pv = lerp(s.pv, (s.px - s.ppx) / Math.max(dt, 1e-3), 0.5); s.ppx = s.px;
    // 發球：玩家點一下，電腦等一下就發
    const launch = s.user && m.clicks.length > 0;
    for (const b of s.balls) if (b.held) {
      b.hT += dt; b.x = clamp(s.px + b.off, L + r, R - r); b.y = Yp - r - 0.3;
      if (s.msgT <= 0 && (s.user ? launch : b.hT > 0.9)) bkLaunch(s, b, s.user ? clamp(s.pv / (s.W * 3), -0.4, 0.4) + rnd(-0.12, 0.12) : rnd(-0.45, 0.45));
    }
    // 球
    if (s.msgT <= 0) for (let bi = s.balls.length - 1; bi >= 0; bi--) {
      const b = s.balls[bi];
      b.hue = (b.hue + dt * 40) % 360;
      if (b.held) continue;
      const sp = Math.hypot(b.vx, b.vy), n = Math.max(1, Math.ceil((sp * dt) / 0.45)), h = dt / n;
      for (let k = 0; k < n; k++) {
        const ox = b.x, oy = b.y;
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x - r < L && b.vx < 0) { b.x = 2 * (L + r) - b.x; b.vx = -b.vx; }
        if (b.x + r > R && b.vx > 0) { b.x = 2 * (R - r) - b.x; b.vx = -b.vx; }
        if (b.y - r < s.top * A && b.vy < 0) { b.y = 2 * (s.top * A + r) - b.y; b.vy = -b.vy; }
        // 用球前緣（往前 r）判斷有沒有撞到磚塊
        const ex = (b.vx / sp) * r, ey = (b.vy / sp) * r;
        const i = Math.floor((b.x + ex - s.x0) / s.bw), j = Math.floor(((b.y + ey) / A - s.by0) / s.bh);
        if (i >= 0 && i < nx && j >= 0 && j < ny && s.hp[j * nx + i]) {
          const pi = Math.floor((ox + ex - s.x0) / s.bw), pj = Math.floor(((oy + ey) / A - s.by0) / s.bh);
          if (pi !== i && pj === j) b.vx = -b.vx; else if (pj !== j && pi === i) b.vy = -b.vy; else { b.vx = -b.vx; b.vy = -b.vy; }
          b.x = ox; b.y = oy;
          bkHit(s, f, i, j);
          if (Math.random() < 0.3) b.aimK = -1;
          break;
        }
        if (b.vy > 0 && oy + r <= Yp && b.y + r > Yp && Math.abs(b.x - s.px) <= s.pw / 2 + 0.8) {
          const off = clamp((b.x - s.px) / (s.pw / 2), -1, 1), ang = off * 1.05, nsp = Math.min(sp * 1.012, s.sp * 1.4);
          b.vx = Math.sin(ang) * nsp; b.vy = -Math.cos(ang) * nsp; b.y = Yp - r; b.aimK = -1; bkErr(s, b, p);
        }
      }
      if (b.y > (rows + 1) * A) s.balls.splice(bi, 1);
    }
    if (s.msgT <= 0 && !s.balls.length) {
      s.lives--;
      if (s.lives <= 0) { s.msg = 'over'; s.msgT = 3.8; if (s.score > s.best) { s.best = s.score; s.newBest = true; } }
      else { s.balls.push(bkBall(s)); bkErr(s, s.balls[0], p); fxText(s.texts, s.px, s.py - 2, '-1 ♥', H(350, 0.8), 1.2); }
    }
    let left = 0; for (let k = 0; k < s.hp.length; k++) if (s.hp[k]) left++;
    if (!left && s.msgT <= 0) { s.msg = 'clear'; s.msgT = 2.4; s.score += 500; }
    if (s.score > s.best) { s.best = s.score; s.newBest = true; }               // 最高分即時更新
    // 道具
    for (let k = s.caps.length - 1; k >= 0; k--) {
      const q = s.caps[k], oy = q.y; q.y += rows * 0.22 * dt;
      if (oy < s.py && q.y >= s.py && Math.abs(q.x - s.px) <= s.pw / 2 + 1.5) {
        if (q.k === 'W') s.wideT = 12;
        else if (q.k === '+') s.lives = Math.min(6, s.lives + 1);
        else { const add = []; for (const b of s.balls) if (!b.held && s.balls.length + add.length < 9) for (const da of [-0.35, 0.35]) { const a = Math.atan2(b.vx, -b.vy) + da, v = Math.hypot(b.vx, b.vy); add.push({ ...b, vx: Math.sin(a) * v, vy: -Math.abs(Math.cos(a) * v), hue: rnd(0, 360) }); } s.balls.push(...add); }
        fxText(s.texts, q.x, s.py - 2, q.k === 'W' ? ['加寬！', 'Wider!'] : q.k === 'M' ? ['多球！', 'Multiball!'] : '+1 ♥', C(1));
        s.caps.splice(k, 1); continue;
      }
      if (q.y > rows) s.caps.splice(k, 1);
    }
    // ── 畫：磚牆用主題漸層（每關換方向），彩色只留給球和道具 ──
    const by = s.by0, flip = s.level % 2 === 0;
    for (let j = 0; j < ny; j++) {
      const u = 0.36 + 0.3 * ((flip ? ny - 1 - j : j) / Math.max(1, ny - 1)), c1 = C(u), c2 = C(u + 0.14), c3 = C(u + 0.22), cE = C(u - 0.16);
      for (let i = 0; i < nx; i++) {
        const v = s.hp[j * nx + i]; if (!v) continue;
        const x0 = s.x0 + i * s.bw, y0 = by + j * s.bh, ch = v === 2 ? '▓' : '█', col = v >= 3 ? c3 : v === 2 ? c2 : c1;
        for (let yy = 0; yy < s.bh; yy++) for (let xx = 0; xx < s.bw - 1; xx++) g.set(x0 + xx, y0 + yy, s.bh > 1 && yy === s.bh - 1 ? '▀' : ch, s.bh > 1 && yy === s.bh - 1 ? cE : col);
      }
    }
    drawParts(f, s.parts, dt, 30);
    const wc = C(0.45);
    for (let x = L - 1; x <= R; x++) g.set(x, s.top - 1, '▄', wc);
    for (let y = s.top; y < rows; y++) { g.set(L - 1, y, '▐', wc); g.set(R, y, '▌', wc); }
    for (const q of s.caps) { const cp = BK_CAP[q.k], lab = tr(f, cp[0], cp[2]); txt(g, q.x - g.textW(lab) / 2, q.y, lab, H(cp[1], 0.85 + 0.15 * Math.sin(s.t * 10))); }
    const pc = s.wideT > 0 ? H(190, 0.9) : C(0.95), pa = Math.round(s.px - s.pw / 2), pb = Math.round(s.px + s.pw / 2);
    for (let x = pa; x < pb; x++) g.set(x, s.py, '█', pc);
    g.set(pa - 1, s.py, '▐', C(0.7)); g.set(pb, s.py, '▌', C(0.7));
    for (const b of s.balls) {
      const col = H(b.hue, 1);
      if (s.bsz) pxSprite(g, b.x, b.y / A, BK_BALL, s.bsz, col); else g.set(b.x, b.y / A, '●', col);
      if (!b.held && !s.bsz) g.set(b.x - b.vx * 0.03, b.y / A - b.vy * 0.03 / A, '·', H(b.hue, 0.5));
    }
    if (s.user && s.msgT <= 0 && s.balls.some(b => b.held)) { const sv = tr(f, '點一下發球', 'Click to serve'); txt(g, s.px - g.textW(sv) / 2, s.py - 2, sv, C(0.6), f.lang === 'en'); }
    drawTexts(f, s.texts, dt, 2);
    const lb = C(0.4), segs = [];
    if (!s.user) segs.push([tr(f, '示範  ', 'Demo  '), C(0.32)]);
    segs.push([tr(f, '第 ', 'Level '), lb], [String(s.level), C(0.85)], [tr(f, ' 關  ', '  '), lb], ['♥'.repeat(Math.max(0, s.lives)), H(350, 0.8)], [tr(f, '  得分 ', '  Score '), lb], [String(s.score), C(0.95)], [tr(f, '  最高 ', '  Best '), lb], [String(s.best), C(0.7)]);
    hud(f, segs);
    hint(f, tr(f, '移動滑鼠控制球拍，點一下發球', 'Move the mouse to steer the paddle, click to serve'));
    if (s.msgT > 0) {
      if (s.msg === 'over') { if (s.msgT < 3.5) banner(f, 'GAME OVER', overLine(f, s), rows * 0.62); }
      else banner(f, 'CLEAR!', tr(f, '第 ' + s.level + ' 關完成　+500', 'Level ' + s.level + ' cleared  +500'), rows * 0.62);
    }
  } });

/* ════════════ 3. 乒乓對打 ════════════ */
function pnErr(s, p) {
  for (const pd of s.pads) {
    pd.err = gauss() * s.len * 0.16;
    if (Math.random() < p.miss) pd.err = (Math.random() < 0.5 ? -1 : 1) * s.len * rnd(0.62, 1.0);
  }
}
function pnServe(s, side, p) {   // side：球往哪一邊發（0 左、1 右）
  const b = s.ball, a = rnd(-0.45, 0.45);
  b.x = s.w / 2; b.y = s.Hv * rnd(0.3, 0.7); b.wait = 0.9; b.tn = 0;
  b.vx = Math.cos(a) * s.speed0 * (side ? 1 : -1); b.vy = Math.sin(a) * s.speed0;
  pnErr(s, p);
}
function pnAI(s, k, dt, p) {
  const pd = s.pads[k], b = s.ball, toward = k === 0 ? b.vx < 0 : b.vx > 0;
  let goal = s.Hv / 2 + Math.sin(s.t * 0.8 + k * 2) * s.Hv * 0.06, spd = 0.35;
  if (b.wait <= 0 && toward) {
    pd.react -= dt;
    if (pd.react <= 0) {
      const plane = k === 0 ? s.XL + s.r : s.XR - s.r, t = (plane - b.x) / b.vx;
      if (t > 0) { goal = fold(b.y + b.vy * t, s.r, s.Hv - s.r) + pd.err; spd = 1; }
    }
  } else pd.react = rnd(0.1, 0.28) / p.ai;
  const half = s.len / 2, mv = s.Hv * 0.95 * p.ai * dt * spd;
  pd.pos = clamp(pd.pos + clamp(goal - pd.pos, -mv, mv), half, s.Hv - half);
}
function pnStep(s, dt, p) {
  const b = s.ball, r = s.r;
  if (b.wait > 0) { b.wait -= dt; return; }
  const sp0 = Math.hypot(b.vx, b.vy), n = Math.max(1, Math.ceil((sp0 * dt) / (r * 0.7))), h = dt / n;
  for (let k = 0; k < n; k++) {
    const px = b.x;
    b.x += b.vx * h; b.y += b.vy * h;
    if (b.y - r < 0 && b.vy < 0) { b.y = 2 * r - b.y; b.vy = -b.vy; }
    if (b.y + r > s.Hv && b.vy > 0) { b.y = 2 * (s.Hv - r) - b.y; b.vy = -b.vy; }
    for (let q = 0; q < 2; q++) {
      const pd = s.pads[q], pl = q === 0 ? s.XL : s.XR;
      const cross = q === 0 ? b.vx < 0 && px - r >= pl - 1e-6 && b.x - r < pl : b.vx > 0 && px + r <= pl + 1e-6 && b.x + r > pl;
      if (!cross || Math.abs(b.y - pd.pos) > s.len / 2 + r) continue;
      const off = clamp((b.y - pd.pos) / (s.len / 2), -1, 1), ang = off * 1.0, nsp = Math.min(sp0 * 1.045, s.speed0 * 1.9);
      b.vx = Math.cos(ang) * nsp * (q === 0 ? 1 : -1); b.vy = Math.sin(ang) * nsp;
      b.x = q === 0 ? pl + r : pl - r;
      pd.hit = 0.3; s.rally++; s.bestRally = Math.max(s.bestRally, s.rally);
      pnErr(s, p);
      break;
    }
  }
  b.acc = (b.acc || 0) + dt;
  while (b.acc >= 1 / 40) { b.acc -= 1 / 40; b.tr[b.ti * 2] = b.x; b.tr[b.ti * 2 + 1] = b.y; b.ti = (b.ti + 1) % (b.tr.length / 2); b.tn = Math.min(b.tr.length / 2, b.tn + 1); }
  if (b.x < -3 * r || b.x > s.w + 3 * r) {
    const who = b.x < 0 ? 1 : 0;                                   // 左邊漏接 → 右邊得分
    s.sc[who]++; s.flash[who] = 1; s.rally = 0;
    if (s.sc[who] >= p.win) { s.phase = 'over'; s.overT = 0; s.winner = who; b.wait = 99; }
    else pnServe(s, 1 - who, p);                                   // 發給剛失分的一方
  }
}
A({ id: 'ix-pong', name: '乒乓對打', cat: '街機', theme: 'mono', hue: false, interactive: true,
  desc: '上下移動滑鼠控制右邊的球拍，和電腦比賽，先得 7 分獲勝',
  params: { pad: 0.2, speed: 1, miss: 0.2, ai: 1, win: 7 },
  variants: [
    { id: 'hard', name: '高手', theme: 'ice', desc: '球更快、球拍更短，電腦也更難纏', params: { pad: 0.15, speed: 1.3, miss: 0.1, ai: 1.35 } },
  ],
  init(s, f) {
    const { cols, rows, aspect: A, p } = f;
    s.A = A; s.X0 = 2; s.Y0 = hudRow(f) + 2; s.w = cols - 4; s.h = Math.max(6, rows - s.Y0 - 2); s.Hv = s.h * A;
    const u = Math.min(s.w / 100, s.h / 28);
    s.bw = Math.max(1, Math.round(u * 0.7)); s.bh = Math.max(1, Math.round(s.bw / A));
    s.r = Math.max(s.bw * 0.5, s.bh * A * 0.5) * 0.9; s.pw = s.bw; s.XL = 1 + s.pw; s.XR = s.w - 1 - s.pw;
    s.len = s.Hv * p.pad; s.speed0 = Math.max(s.w, s.Hv) * 0.4 * p.speed;
    s.pads = [0, 1].map(() => ({ pos: s.Hv / 2, err: 0, react: 0, hit: 0 }));
    s.ball = { x: s.w / 2, y: s.Hv / 2, vx: 0, vy: 0, wait: 1, tr: new Float32Array(16), ti: 0, tn: 0, acc: 0 };
    s.sc = [0, 0]; s.flash = [0, 0]; s.rally = 0; s.bestRally = 0; s.phase = 'play'; s.overT = 0; s.winner = 0; s.user = false; s.t = 0;
    // 靜態層：淡淡的球桌點紋
    const lay = mkLayer();
    for (let y = 2; y < s.h; y += 4) for (let x = 5 + (((y / 4) | 0) % 2) * 5; x < s.w - 2; x += 10) layerPut(lay, f.g, s.X0 + x, s.Y0 + y, '·', 0);
    s.lay = lay; s.pal = ['#000000'];
    pnServe(s, Math.random() < 0.5 ? 0 : 1, p);
  },
  frame(s, f) {
    const { g, C, p } = f, dt = stepDt(f), m = f.mouse, playing = userOn(f), A = s.A, X0 = s.X0, Y0 = s.Y0, w = s.w, h = s.h;
    if (playing && !s.user) { s.user = true; if (s.phase === 'play') { s.sc[0] = s.sc[1] = 0; s.rally = 0; } }   // 玩家接手：比分歸零
    else if (!playing && s.user) s.user = false;
    s.t += dt;
    for (let k = 0; k < 2; k++) { s.flash[k] = Math.max(0, s.flash[k] - dt * 0.8); s.pads[k].hit = Math.max(0, s.pads[k].hit - dt); }
    if (s.phase === 'over') {
      s.overT += dt;
      if (s.overT > 4) { s.phase = 'play'; s.sc[0] = s.sc[1] = 0; s.rally = 0; pnServe(s, s.winner, p); }
    }
    pnAI(s, 0, dt, p);
    const half = s.len / 2;
    if (s.user) { if (ptrOk(m)) s.pads[1].pos = clamp((m.y - Y0) * A, half, s.Hv - half); }
    else pnAI(s, 1, dt, p);
    if (s.phase === 'play') pnStep(s, dt, p);
    // ── 畫：球桌紋理、中圈、牆、中線 ──
    s.pal[0] = C(0.12); layerDraw(s.lay, g, s.pal);
    const wc = C(0.5), nc = C(0.25);
    for (let x = -1; x <= w; x++) { g.set(X0 + x, Y0 - 1, '▄', wc); g.set(X0 + x, Y0 + h, '▀', wc); }
    for (let y = 0; y < h; y += 2) g.set(X0 + (w >> 1), Y0 + y, '│', nc);
    const small = h < 18, gap = small ? 3 : Math.round(w * 0.06), sy = clamp(Math.round(h / 40), 1, 5), sx = Math.round(sy * A);   // 比分大小跟著球桌高度
    const score = (k, x, align) => {
      const str = String(s.sc[k]), col = C(0.3 + s.flash[k] * 0.6);
      if (small) { txt(g, align < 0 ? x - str.length : x, Y0 + 1, str, col); return; }
      const W = fontW(str, F5) * sx;
      drawBig(g, str, align < 0 ? x - W : x, Y0 + 2, sx, sy, col);
    };
    score(0, X0 + (w >> 1) - gap, -1); score(1, X0 + (w >> 1) + gap + 1, 1);
    const ly = small ? Y0 + 2 : Y0 + 3 + 7 * sy, cpu = tr(f, '電腦', 'CPU'), who = s.user ? tr(f, '你', 'YOU') : cpu;
    txt(g, X0 + (w >> 1) - gap - g.textW(cpu), ly, cpu, C(0.3)); txt(g, X0 + (w >> 1) + gap + 1, ly, who, s.user ? C(0.6) : C(0.3));
    const b = s.ball, N = b.tr.length / 2;
    if (b.wait <= 0 || ((s.t * 4) | 0) % 2) {
      if (b.wait <= 0) for (let k = 1; k < b.tn; k++) { const idx = (b.ti - 1 - k + N * 2) % N; g.set(X0 + b.tr[idx * 2], Y0 + b.tr[idx * 2 + 1] / A, k < 3 ? '•' : '·', C(0.6 - k * 0.07)); }
      if (s.bw === 1 && s.bh === 1) g.set(X0 + b.x, Y0 + b.y / A, '●', C(1));
      else fillRect(g, X0 + Math.round(b.x - s.bw / 2), Y0 + Math.round(b.y / A - s.bh / 2), s.bw, s.bh, '█', C(1));
    }
    for (let k = 0; k < 2; k++) {
      const pd = s.pads[k], col = C(0.82 + pd.hit * 0.6), top = (pd.pos - half) / A, bot = (pd.pos + half) / A, xa = k === 0 ? 1 : w - 1 - s.pw;
      for (let y = Math.floor(top); y < Math.ceil(bot); y++) {
        const ch = y === Math.floor(top) && top - y > 0.5 ? '▄' : y === Math.ceil(bot) - 1 && bot - y < 0.5 ? '▀' : '█';
        for (let q = 0; q < s.pw; q++) g.set(X0 + xa + q, Y0 + y, ch, col);
      }
    }
    const lb = C(0.4), segs = [];
    if (!s.user) segs.push([tr(f, '示範  ', 'Demo  '), C(0.32)]);
    segs.push([tr(f, '先得 ', 'First to '), lb], [String(p.win), C(0.8)], [tr(f, ' 分勝  連續 ', '  Rally '), lb], [String(s.rally), C(0.9)], [tr(f, ' 拍  最高 ', '  Best '), lb], [String(s.bestRally), C(0.7)]);
    hud(f, segs);
    hint(f, tr(f, '上下移動滑鼠控制右邊的球拍', 'Move the mouse up and down to steer the right paddle'));
    if (s.phase === 'over' && s.overT > 0.3) {
      const big = s.user ? (s.winner === 1 ? 'YOU WIN' : 'CPU WINS') : (s.winner === 1 ? 'RIGHT WINS' : 'LEFT WINS');
      banner(f, big, s.sc[0] + ' : ' + s.sc[1] + tr(f, '　馬上再來一局', '  New game coming up'), Y0 + h * 0.55);
    }
  } });

/* ════════════ 4. 拍翅小鳥 ════════════ */
// 大尺寸小鳥：橢圓身體 + 會上下拍的翅膀 + 眼睛 + 嘴，跟著畫面大小縮放（hw 欄、hh 列是半寬半高）
function fpEllipse(g, cx, cy, hw, hh, col, colLo) {
  for (let y = Math.floor(cy - hh); y <= cy + hh; y++) {
    const dy = y + 0.5 - cy, d = dy / hh; if (Math.abs(d) > 1) continue;
    const half = hw * Math.sqrt(1 - d * d), ch = dy < -hh + 0.55 ? '▄' : dy > hh - 0.55 ? '▀' : '█';
    for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) g.set(x, y, ch, colLo && d > 0.35 ? colLo : col);
  }
}
function fpBird(g, f, s, x, y, alive, down) {
  const { C, H } = f, hh = s.bhh, hw = s.bhw;
  fpEllipse(g, x, y, hw, hh, alive ? H(50, 0.82) : C(0.45), alive ? H(54, 0.98) : C(0.55));
  fpEllipse(g, x - hw * 0.22, y + (down ? 0.4 : -0.5) * hh, hw * 0.5, Math.max(0.6, hh * 0.5), alive ? H(40, 1) : C(0.65));
  const ew = Math.max(2, Math.round(hw * 0.3)), eh = Math.max(1, Math.round(hh * 0.6)), ex = Math.round(x + hw * 0.3), ey = Math.round(y - hh * 0.55);
  for (let r = 0; r < eh; r++) for (let k = 0; k < ew; k++) g.set(ex + k, ey + r, alive ? (k === ew - 1 && r === eh - 1 ? ' ' : '█') : '×', C(1));
  const bk = Math.max(2, Math.round(hw * 0.45)), bx0 = Math.round(x + hw * 0.78), by0 = Math.round(y - hh * 0.05);
  for (let k = 0; k < bk; k++) g.set(bx0 + k, by0, k === bk - 1 ? '▌' : '█', H(22, 0.85));
  if (hh >= 2) for (let k = 0; k < bk - 1; k++) g.set(bx0 + k, by0 + 1, '▀', H(14, 0.65));
}
function fpReset(s, f) {
  s.pipes.length = 0; s.score = 0; s.y = f.rows * 0.42; s.vy = 0; s.phase = 'ready'; s.readyT = 0; s.deadT = 0; s.flapT = 0;
  s.ai.pid = -1; s.ai.err = 0; s.newBest = false;
}
function fpGap(s, q, ahead = 0) { return q.amp ? clamp(q.gc + Math.sin((s.t + ahead) * 1.1 + q.ph) * q.amp, s.ceil + s.gh / 2 + 1, s.gy - s.gh / 2 - 1) : q.gc; }
// 縫隙的整數列範圍 [top, top + gh)：畫水管和判斷碰撞都用同一組，看到的縫就是實際的縫
const fpTop = (s, q, ahead) => Math.round(fpGap(s, q, ahead) - s.gh / 2);
// 橢圓（中心 cx, cy，半軸 a, b）和矩形 [x0, x1) × [y0, y1) 有沒有重疊
function ellRect(cx, cy, a, b, x0, x1, y0, y1) { const dx = (clamp(cx, x0, x1) - cx) / a, dy = (clamp(cy, y0, y1) - cy) / b; return dx * dx + dy * dy < 1; }
function fpAI(s, f, dt) {
  const ai = s.ai;
  ai.cool -= dt; ai.think -= dt;
  let nx = null; for (const q of s.pipes) if (q.x + s.pw + 1 > s.bx - s.bw2) { nx = q; break; }
  if (nx && nx.id !== ai.pid) {
    ai.pid = nx.id; ai.err = gauss() * s.gh * 0.05;
    if (Math.random() < f.p.aiMiss) ai.err = (Math.random() < 0.5 ? -1 : 1) * s.gh * rnd(0.45, 0.6);   // 偶爾看錯高度
  }
  // 讓上下擺動的範圍（一次拍翅升高 rise）置中在縫隙中央；會動的水管看稍微未來一點的位置
  const rise = (s.FV * s.FV) / (2 * s.G);
  const target = (nx ? fpTop(s, nx, 0.25) + s.gh / 2 : f.rows * 0.45) + rise * 0.5 + ai.err;
  if (ai.think <= 0) {
    ai.think = rnd(0.03, 0.08);
    if (s.y + s.vy * 0.1 > target && ai.cool <= 0) { s.vy = -s.FV; s.flapT = 0.2; ai.cool = rnd(0.14, 0.22); }
  }
}
A({ id: 'ix-flappy', name: '拍翅小鳥', cat: '街機', theme: 'ocean', hue: true, interactive: true,
  desc: '點一下拍翅膀往上飛，鑽過水管之間的縫隙',
  params: { gap: 0.3, speed: 1, move: 0, aiMiss: 0.05 },
  variants: [
    { id: 'tight', name: '窄縫', theme: 'sunset', desc: '縫隙更窄、速度更快，水管還會上下移動', params: { gap: 0.25, speed: 1.12, move: 1, aiMiss: 0.07 } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.big = rows >= 45; s.bx = Math.round(cols * 0.26); s.gy = rows - (s.big ? 4 : 3);
    s.G = rows * 1.6; s.FV = rows * 0.55; s.v = cols * 0.13 * p.speed;
    s.pw = Math.max(4, Math.round(cols * 0.055)); s.space = Math.max(s.pw * 3, cols * 0.3);
    s.gh = Math.round(Math.max(6, rows * p.gap)); s.ceil = hudRow(f) + 1;      // 最上面的資訊列不畫水管
    s.bhh = Math.max(1.5, rows * 0.03); s.bhw = s.bhh * f.aspect * 1.25;          // 大鳥的半高（列）、半寬（欄）
    s.bw2 = s.big ? s.bhw * 0.88 : 1.2; s.bh2 = s.big ? Math.min(s.bhh * 0.82, s.bhh - 0.5) : 0.45;   // 碰撞橢圓一定落在畫出來的身體裡
    s.pipes = []; s.pid = 0; s.wx = 0; s.t = 0; s.best = 0; s.user = false; s.texts = []; s.feathers = [];
    s.ai = { cool: 0, think: 0, pid: -1, err: 0 };
    s.clouds = Array.from({ length: Math.max(4, Math.round(cols / 45)) }, (_, k) => ({ x: rnd(0, cols), y: rows * rnd(0.08, 0.4), w: cols * rnd(0.04, 0.08), z: rnd(0.1, 0.25), k }));
    fpReset(s, f);
  },
  frame(s, f) {
    const { g, C, H, p, cols, rows } = f, dt = stepDt(f), m = f.mouse, playing = userOn(f);
    if (!playing) s.user = false;
    const clicked = playing && m.clicks.length > 0;
    if (clicked) s.user = true;                                     // 第一下點擊就接手（只移動滑鼠時電腦繼續飛）
    s.t += dt; s.flapT = Math.max(0, s.flapT - dt);
    if (s.phase === 'ready' || s.phase === 'fly') s.wx += s.v * dt;
    if (s.phase === 'ready') {
      s.readyT += dt; s.y = rows * 0.42 + Math.sin(s.t * 4) * 0.6; s.vy = 0;
      if (s.user ? clicked : !playing && s.readyT > 0.8) { s.phase = 'fly'; s.vy = -s.FV; s.flapT = 0.2; }
    } else if (s.phase === 'fly') {
      if (s.user) { if (clicked) { s.vy = -s.FV; s.flapT = 0.2; } } else fpAI(s, f, dt);
      s.vy += s.G * dt; s.y += s.vy * dt;
      const yMin = s.ceil + (s.big ? s.bhh : s.bh2);
      if (s.y < yMin) { s.y = yMin; if (s.vy < 0) s.vy = 0; }
      for (const q of s.pipes) q.x -= s.v * dt;
      while (s.pipes.length && s.pipes[0].x + s.pw < -2) s.pipes.shift();
      const last = s.pipes[s.pipes.length - 1];
      if (!last || last.x < cols - s.space) {
        const prev = last ? last.gc : rows / 2, amp = p.move ? rows * 0.07 : 0;
        const gc = clamp(prev + rnd(-1, 1) * rows * 0.26, s.ceil + s.gh / 2 + 2 + amp, s.gy - s.gh / 2 - Math.max(3, rows * 0.1) - amp);
        s.pipes.push({ x: last ? last.x + s.space : cols * 0.72, gc, amp, ph: rnd(0, TAU), id: s.pid++, passed: false });
      }
      let hit = s.y + s.bh2 >= s.gy;
      const by = Math.floor(s.y);                                     // 小鳥畫在這一列（小畫面）
      for (const q of s.pipes) {
        const t0 = fpTop(s, q), b0 = t0 + s.gh;
        if (s.big) {                                                  // 大畫面：用比身體小一點的橢圓碰水管（含管口加寬的兩列）
          const X = Math.round(q.x), a = s.bw2, b = s.bh2, pw = s.pw;
          if (ellRect(s.bx, s.y, a, b, X, X + pw, -1e4, t0 - 2) || ellRect(s.bx, s.y, a, b, X - 1, X + pw + 1, t0 - 2, t0) ||
              ellRect(s.bx, s.y, a, b, X - 1, X + pw + 1, b0, b0 + 2) || ellRect(s.bx, s.y, a, b, X, X + pw, b0 + 2, 1e4)) hit = true;
        }
        else if (by < t0 || by >= b0) {                               // 小畫面：小鳥那三格碰到畫出來的水管格才算撞到
          const X = Math.round(q.x), cap = by >= t0 - 2 && by < b0 + 2;
          if (s.bx + 1 >= X - (cap ? 1 : 0) && s.bx - 1 <= X + s.pw - 1 + (cap ? 1 : 0)) hit = true;
        }
        if (!q.passed && q.x + s.pw / 2 < s.bx) { q.passed = true; s.score++; fxText(s.texts, s.bx, s.y - 2, '+1', C(1), 0.6); if (s.score > s.best) { s.best = s.score; s.newBest = true; } }
      }
      if (hit) {
        s.phase = 'dead'; s.deadT = 0; s.vy = -s.FV * 0.35;
        for (let k = 0; k < 10; k++) addPart(s.feathers, s.bx, s.y, rnd(-1, 1) * cols * 0.05, rnd(-1, 0.4) * rows * 0.3, rnd(0.5, 1.1), '~', 48, 40);
      }
    } else {
      s.deadT += dt;
      if (s.y < s.gy - s.bh2) { s.vy += s.G * dt; s.y = Math.min(s.gy - s.bh2, s.y + s.vy * dt); }
      if (s.deadT > 3.4 || (s.user && clicked && s.deadT > 1.2)) fpReset(s, f);
    }
    // ── 畫：雲、遠山、水管、地面、小鳥 ──
    for (const c of s.clouds) {
      const x = ((c.x - s.wx * c.z) % (cols * 1.2) + cols * 1.2) % (cols * 1.2) - cols * 0.1, ch2 = Math.max(1, c.w / f.aspect * 0.5);
      for (let yy = -Math.ceil(ch2); yy <= Math.ceil(ch2); yy++) {
        const k = 1 - (yy / (ch2 + 0.5)) ** 2; if (k <= 0 || c.y + yy < s.ceil) continue;   // 雲也不進資訊列
        const hw = c.w * Math.sqrt(k);
        for (let xx = Math.round(x - hw); xx < x + hw; xx++) g.set(xx, c.y + yy, Math.abs(xx - x) < hw * 0.55 && Math.abs(yy) < ch2 * 0.6 ? '▒' : '░', C(0.22));
      }
    }
    for (let x = 0; x < cols; x++) {
      const wx = x + s.wx * 0.3, hh = rows * (0.1 + 0.05 * Math.sin(wx * 0.05) + 0.035 * Math.sin(wx * 0.17 + 1));
      const y0 = Math.floor(s.gy - hh);
      for (let y = y0; y < s.gy; y++) g.set(x, y, y === y0 ? '▄' : '█', H(150, y === y0 ? 0.16 : 0.12));
    }
    const pw = s.pw;
    for (const q of s.pipes) {
      const t0 = fpTop(s, q), b0 = t0 + s.gh, X = Math.round(q.x);
      for (let y = s.ceil; y < s.gy; y++) {
        if (y >= t0 && y < b0) continue;
        const cap = y >= t0 - 2 && y < b0 + 2;
        for (let k = cap ? -1 : 0; k < pw + (cap ? 1 : 0); k++) g.set(X + k, y, '█', H(105, k < 1 ? 0.42 : k < 2 ? 0.78 : k > pw - 2 ? 0.34 : cap ? 0.62 : 0.56));
      }
    }
    for (let x = 0; x < cols; x++) {
      const wx = Math.floor(x + s.wx);
      g.set(x, s.gy, '▀', ((wx >> 2) & 1) ? H(95, 0.62) : H(95, 0.5));
      for (let y = s.gy + 1; y < rows; y++) g.set(x, y, (wx + y * 2) % 6 < 3 ? '▒' : '░', H(35, 0.24));
    }
    drawParts(f, s.feathers, dt, rows * 0.6);
    // 小鳥
    if (s.phase !== 'dead' || s.deadT < 3) {
      const alive = s.phase !== 'dead', by = Math.floor(s.y), wingDown = s.vy < 0 && s.flapT > 0.05;
      const cB = alive ? H(50, 0.82) : C(0.45), cW = alive ? H(42, 1) : C(0.6), cK = H(22, 0.85), cE = C(1);
      if (s.big) fpBird(g, f, s, s.bx, s.y, alive, wingDown);
      else {
        g.set(s.bx - 1, by, wingDown ? '▄' : '▀', cW); g.set(s.bx, by, alive ? '█' : '×', alive ? cB : cE); g.set(s.bx + 1, by, '►', cK);
      }
    }
    drawTexts(f, s.texts, dt, 3);
    const py = Math.round(s.y) - (s.big ? Math.ceil(s.bhh) + 2 : 2);
    if (s.phase === 'ready' && (s.user || playing)) { const t = tr(f, '點一下開始', 'Click to start'); txt(g, s.bx - g.textW(t) / 2, py, t, C(0.65), f.lang === 'en'); }
    else if (s.phase === 'fly' && playing && !s.user) { const t = tr(f, '點一下接手', 'Click to take over'); txt(g, s.bx - g.textW(t) / 2, py, t, C(0.5), f.lang === 'en'); }   // 只移動滑鼠時電腦還在飛
    const lb = C(0.4), segs = [];
    if (!s.user) segs.push([tr(f, '示範  ', 'Demo  '), C(0.32)]);
    segs.push([tr(f, '得分 ', 'Score '), lb], [String(s.score), C(0.95)], [tr(f, '  最高 ', '  Best '), lb], [String(s.best), C(0.7)]);
    hud(f, segs);
    hint(f, tr(f, '點一下拍翅膀，鑽過水管的縫隙', 'Click to flap and fly through the gaps between the pipes'));
    if (s.phase === 'dead' && s.deadT > 0.7) banner(f, 'GAME OVER', tr(f, '穿過 ' + s.score + ' 根水管', 'Passed ' + s.score + (s.score === 1 ? ' pipe' : ' pipes')) + bestTail(f, s), rows * 0.4);
  } });

/* ════════════ 5. 接星星 ════════════ */
// 大尺寸物件：半格點陣圖（每個 # 是 1 欄 × 半列），依畫面大小 k 倍放大
const CT_STAR = ['..#..', '..#..', '#####', '.###.', '.#.#.', '#...#'], CT_BALL = ['.###.', '#####', '#####', '#####', '.###.', '.....'];
const CT_VAL = [10, 5, 50, 0];
// 炸彈固定用深灰色（不跟主題、不跟水果撞色）＋淺灰反光＋頂蓋＋閃爍的引信火花
const CT_BOMB = rgb(62, 62, 76), CT_BOMB_HI = rgb(150, 150, 168), CT_BOMB_CAP = rgb(105, 105, 120), CT_BOMB_SM = rgb(150, 150, 166), C_FUSE = rgb(170, 140, 100);
function ctBomb(g, f, s, x, y, k) {
  const x0 = Math.round(x - 2.5 * k), y0 = Math.round(y - 1.5 * k), spark = ((s.t * 12) | 0) % 2;
  pxSprite(g, x, y, CT_BALL, k, CT_BOMB);
  const sh = Math.max(1, Math.round(k / 2));                                       // 左上角的反光
  for (let r = 0; r < sh; r++) for (let q = 0; q < k; q++) g.set(x0 + k + q, y0 + (k > 1 ? 1 : 0) + r, '▓', CT_BOMB_HI);
  const cl = x0 + Math.round(2.5 * k - k / 2);                                      // 頂蓋（置中）
  for (let q = 0; q < k; q++) g.set(cl + q, y0 - 1, '▄', CT_BOMB_CAP);
  g.set(cl + k, y0 - 1, '╯', C_FUSE); g.set(cl + k, y0 - 2, spark ? '✦' : '*', spark ? f.C(1) : f.H(40, 1));
}
function ctNew(s) { s.score = 0; s.lives = 3; s.level = 1; s.lt = 0; s.spawnT = 0.5; s.phase = 'play'; s.overT = 0; s.items.length = 0; s.combo = 0; s.newBest = false; s.pile.length = 0; }
function ctSpawn(s, f) {
  const { cols, rows, p } = f, lv = s.level - 1, r = Math.random();
  const pb = Math.min(0.4, (0.12 + 0.025 * lv) * p.bomb), k = r < pb ? 3 : r < pb + 0.05 ? 2 : r < pb + 0.35 ? 1 : 0;
  const it = { x: rnd(3, cols - 3), y: hudRow(f) + 1, vy: rows * rnd(0.15, 0.23) * (1 + 0.1 * lv) * p.fall, vx: 0, k, hue: pick([0, 25, 95, 280, 330]), ph: rnd(0, TAU), careless: Math.random() < 0.08 + 0.015 * lv };
  if (p.slant) it.vx = (Math.random() < 0.5 ? -1 : 1) * it.vy * f.aspect * rnd(0.25, 0.6);
  it.x0 = it.x; s.items.push(it);
}
function ctAI(s, f, dt) {
  const ai = s.ai, hw = s.bw / 2;
  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = rnd(0.15, 0.3);                                       // 人一樣隔一下才重新判斷
    let best = null, bs = -1e9;
    for (const it of s.items) {
      if (it.k === 3 || it.y > s.by) continue;
      const t = (s.by - it.y) / it.vy, xl = fold(it.x + it.vx * t, 1, f.cols - 1);
      if (Math.abs(xl - s.bx) - hw > s.vmax * t * 0.9) continue;
      const val = CT_VAL[it.k] / (t + 0.5);
      if (val > bs) { bs = val; best = xl; }
    }
    ai.goal = best !== null ? best + gauss() * s.bw * 0.1 : lerp(ai.goal, f.cols / 2, 0.2);
    for (const it of s.items) {
      if (it.k !== 3 || it.y > s.by || it.careless) continue;
      const t = (s.by - it.y) / it.vy; if (t > 0.9) continue;
      const xl = fold(it.x + it.vx * t, 1, f.cols - 1);
      if (Math.abs(xl - ai.goal) < hw + 2) ai.goal = xl + (ai.goal >= xl ? 1 : -1) * (hw + 3);
    }
    ai.goal = clamp(ai.goal, hw, f.cols - hw);
  }
  const mv = s.vmax * dt, d = ai.goal - s.bx;
  s.bx += clamp(d * Math.min(1, dt * 10), -mv, mv);
}
A({ id: 'ix-catch', name: '接星星', cat: '街機', theme: 'lavender', hue: true, interactive: true,
  desc: '左右移動滑鼠帶動籃子，接住星星和水果，別接到炸彈',
  params: { rate: 1, fall: 1, bomb: 1, slant: 0 },
  variants: [
    { id: 'storm', name: '流星雨', theme: 'fire', desc: '星星和水果斜斜飛落，又快又多，炸彈也變多了', params: { rate: 1.5, fall: 1.3, bomb: 1.4, slant: 1 } },
  ],
  init(s, f) {
    const { g, cols, rows } = f;
    s.big = rows >= 45; s.k = Math.max(1, Math.round(rows / 75)); s.gy = rows - 2; s.bh = s.big ? Math.max(3, Math.round(rows / 28)) : 2; s.by = s.gy - s.bh;
    s.bw = Math.max(7, Math.round(cols * 0.075)); s.bx = cols / 2; s.vmax = cols * 0.8;
    s.items = []; s.parts = []; s.texts = []; s.pile = []; s.best = 0; s.user = false; s.t = 0; s.shake = 0;
    s.ai = { think: 0, goal: cols / 2 };
    s.dust = Array.from({ length: Math.round((cols * rows) / 110) }, () => ({ x: rnd(0, cols), y: rnd(0, rows * 0.75), p: rnd(0, TAU), v: rnd(0.3, 1.2) }));
    // 靜態層：月亮、山丘、地面
    const lay = mkLayer(), mx = cols * 0.13, my = rows * 0.2, mr = Math.max(2, rows * 0.07);
    for (let y = Math.floor(my - mr); y <= my + mr; y++) for (let x = Math.floor(mx - mr * f.aspect); x <= mx + mr * f.aspect; x++) {
      const d = Math.hypot((x + 0.5 - mx) / f.aspect, y + 0.5 - my) / mr, d2 = Math.hypot((x + 0.5 - mx - mr * 0.45 * f.aspect) / f.aspect, y + 0.5 - my + mr * 0.2) / mr;
      if (d <= 1 && d2 > 0.85) layerPut(lay, g, x, y, d > 0.9 ? '▓' : '█', 0);
    }
    for (let x = 0; x < cols; x++) {
      const h1 = rows * (0.06 + 0.05 * Noise.fbm(x * 0.012, 3.1, 0, 3) + 0.025 * Math.sin(x * 0.03)), y1 = Math.floor(s.gy - h1);
      for (let y = y1; y < s.gy; y++) layerPut(lay, g, x, y, y === y1 ? '▄' : '█', y === y1 ? 2 : 1);
      layerPut(lay, g, x, s.gy, '▀', 3);
      for (let y = s.gy + 1; y < rows; y++) layerPut(lay, g, x, y, hash(x, y) < 0.5 ? '░' : '▒', 4);
    }
    s.lay = lay; s.pal = new Array(5).fill('#000000');
    ctNew(s);
  },
  frame(s, f) {
    const { g, C, H, p, cols, rows } = f, dt = stepDt(f), m = f.mouse, playing = userOn(f), hw = s.bw / 2;
    if (playing && !s.user) s.user = true; else if (!playing && s.user) s.user = false;
    s.t += dt; s.shake = Math.max(0, s.shake - dt);
    if (s.phase === 'play') {
      s.lt += dt;
      if (s.lt > 15) { s.lt = 0; s.level++; fxText(s.texts, cols / 2, rows * 0.35, ['加速！第 ' + s.level + ' 級', 'Faster! Level ' + s.level], C(0.9), 1.5); }
      s.spawnT -= dt;
      if (s.spawnT <= 0) { ctSpawn(s, f); s.spawnT = rnd(0.45, 0.9) / (1 + 0.15 * (s.level - 1)) / p.rate * (s.big ? 1 : 1.25); }
    } else { s.overT += dt; if (s.overT > 4) ctNew(s); }
    if (s.user) { if (ptrOk(m)) s.bx = m.x; } else ctAI(s, f, dt);
    s.bx = clamp(s.bx, hw, cols - hw);
    // 落下與接住
    const tol = hw + (s.big ? 1.5 * s.k : 0.5);
    for (let k = s.items.length - 1; k >= 0; k--) {
      const it = s.items[k], oy = it.y;
      it.y += it.vy * dt; it.x += it.vx * dt;
      if (it.x < 1 || it.x > cols - 1) { it.vx = -it.vx; it.x = clamp(it.x, 1, cols - 1); }
      const sx = it.k === 0 && !p.slant ? Math.sin(s.t * 2 + it.ph) * 1.2 : 0;
      if (s.phase === 'play' && oy < s.by + 0.5 && it.y >= s.by + 0.5 && Math.abs(it.x + sx - s.bx) <= tol) {
        if (it.k === 3) {
          s.lives--; s.combo = 0; s.shake = 0.35;
          for (let q = 0; q < 24; q++) { const a = rnd(0, TAU), v = rnd(6, 22); addPart(s.parts, s.bx, s.by, Math.cos(a) * v * 1.6, Math.sin(a) * v * 0.6 - 4, rnd(0.4, 0.9), pick(['*', '▓', '░']), 20, 200); }
          fxText(s.texts, s.bx, s.by - 2, ['轟！ -1 ♥', 'Boom! -1 ♥'], H(5, 0.85), 1.1);
          if (s.lives <= 0) { s.phase = 'over'; s.overT = 0; if (s.score > s.best) { s.best = s.score; s.newBest = true; } }
        } else {
          s.combo++;
          const pts = CT_VAL[it.k] * (s.combo >= 8 ? 2 : 1);
          s.score += pts; if (s.score > s.best) { s.best = s.score; s.newBest = true; }
          fxText(s.texts, s.bx, s.by - 2, '+' + pts, it.k === 2 ? H(48, 1) : C(1), 0.7);
          s.pile.push(it.k === 1 ? it.hue : it.k === 2 ? 48 : 55); if (s.pile.length > 40) s.pile.shift();
        }
        s.items.splice(k, 1); continue;
      }
      if (it.y >= s.gy) {
        if (it.k === 3) for (let q = 0; q < 8; q++) addPart(s.parts, it.x, s.gy - 0.5, rnd(-10, 10), rnd(-8, -2), rnd(0.3, 0.6), '*', 25, 200);
        else if (s.phase === 'play') s.combo = 0;
        s.items.splice(k, 1);
      }
    }
    // ── 畫 ──
    for (const d of s.dust) { const b = 0.5 + 0.5 * Math.sin(s.t * d.v * 1.7 + d.p); if (b > 0.25) g.set(d.x, d.y, b > 0.85 ? '+' : '.', C(0.12 + b * 0.22)); }
    const P = s.pal; P[0] = C(0.75); P[1] = C(0.1); P[2] = C(0.17); P[3] = C(0.34); P[4] = C(0.13);   // 山丘、地面都跟著主題
    layerDraw(s.lay, g, P);
    for (const it of s.items) {
      const sx = it.k === 0 && !p.slant ? Math.sin(s.t * 2 + it.ph) * 1.2 : 0, x = it.x + sx, y = it.y, tw = 0.75 + 0.25 * Math.sin(s.t * 9 + it.ph);
      const col = it.k === 0 ? H(55, tw) : it.k === 1 ? H(it.hue, 0.72) : it.k === 2 ? H(46, 0.8 + 0.2 * tw) : CT_BOMB_SM;
      if (p.slant) for (let q = 1; q <= (s.big ? 6 : 3); q++) g.set(x - it.vx * q * 0.04, y - it.vy * q * 0.04, q < 3 ? '•' : '·', it.k === 3 ? rgb(110 - q * 10, 110 - q * 10, 120 - q * 10) : H(40, 0.55 - q * 0.06));
      if (s.big) {
        const k = s.k, top = Math.round(y - (6 * k) / 4);
        if (it.k === 3) ctBomb(g, f, s, x, y, k);                                          // 炸彈：深灰圓球＋頂蓋＋引信
        else pxSprite(g, x, y, it.k === 1 ? CT_BALL : CT_STAR, k, col);
        if (it.k === 1) g.set(x, top - 1, '╻', H(110, 0.55));                              // 水果的梗
        if (it.k === 2) for (let q = 0; q < 2; q++) { const a = s.t * 5 + q * Math.PI; g.set(x + Math.cos(a) * 4 * k, y + Math.sin(a) * 1.6 * k, '·', C(1)); }
      } else {
        g.set(x, y, it.k === 3 ? '◉' : it.k === 1 ? '●' : '✦', col);
        if (it.k === 3) { const sp = ((s.t * 12) | 0) % 2; g.set(x + 1, y - 1, sp ? '*' : '·', sp ? C(1) : H(40, 1)); }
        if (it.k === 2) g.set(x + ((s.t * 8) | 0) % 3 - 1, y - 1, '·', C(1));
      }
    }
    drawParts(f, s.parts, dt, 25);
    // 籃子
    // 籃子全用整格字元（半格字元的另一半會露出黑底，疊在山丘前面很難看）
    const shx = s.shake > 0 ? Math.round(Math.sin(s.t * 60) * 1.5) : 0, xa = Math.round(s.bx - hw) + shx, xb = xa + s.bw - 1;
    const cw = H(30, 0.62), cd = H(28, 0.42), cr = H(32, 0.8);
    for (let x = xa; x <= xb; x++) {
      const side = x === xa || x === xb;
      for (let r = 0; r < s.bh; r++) {
        const open = r < Math.max(1, Math.round(s.bh * 0.34)), solid = r >= s.bh - Math.max(1, Math.round(s.bh * 0.2));
        if (open && !side) continue;                                      // 籃口是空的
        g.set(x, s.by + r, side || solid ? '█' : (x - xa + r) % 2 ? '▓' : '▒', side ? cr : solid ? cw : cd);
      }
    }
    const pn = Math.min(s.pile.length, s.bw - 2);
    for (let k = 0; k < pn; k++) g.set(xa + 1 + k, s.by + Math.max(1, Math.round(s.bh * 0.34)) - 1, '•', H(s.pile[s.pile.length - 1 - k], 0.7));
    drawTexts(f, s.texts, dt, 3);
    const lb = C(0.4), segs = [];
    if (!s.user) segs.push([tr(f, '示範  ', 'Demo  '), C(0.32)]);
    segs.push([tr(f, '第 ', 'Level '), lb], [String(s.level), C(0.85)], [tr(f, ' 級  ', '  '), lb], ['♥'.repeat(Math.max(0, s.lives)), H(350, 0.8)], [tr(f, '  得分 ', '  Score '), lb], [String(s.score), C(0.95)]);
    if (s.combo >= 3) segs.push([tr(f, '  連續 ', '  Streak '), lb], [String(s.combo), H(50, 0.9)]);
    segs.push([tr(f, '  最高 ', '  Best '), lb], [String(s.best), C(0.7)]);
    hud(f, segs);
    hint(f, tr(f, '左右移動滑鼠接星星，躲開炸彈', 'Move the mouse left and right to catch stars and dodge bombs'));
    if (s.phase === 'over' && s.overT > 0.4) banner(f, 'GAME OVER', overLine(f, s), rows * 0.42);
  } });

/* ════════════ 6. 游標貪食蛇 ════════════ */
// 座標用「欄寬」當單位：x 是欄，y 是列 × aspect，轉彎和距離看起來才是圓的
const SN_CAP = 4096;
function snPush(s, x, y) { s.head = (s.head + 1) % SN_CAP; s.px[s.head] = x; s.py[s.head] = y; s.n = Math.min(SN_CAP, s.n + 1); }
const snIdx = (s, k) => (s.head - k + SN_CAP) % SN_CAP;
const snCount = s => Math.min(s.n, Math.ceil(s.len / s.sp));
function snSpawn(s) {
  s.x = s.W * rnd(0.35, 0.65); s.y = s.Hv * rnd(0.4, 0.6);
  s.a = Math.atan2(s.Hv / 2 - s.y, s.W / 2 - s.x) + rnd(-0.6, 0.6);
  s.len = s.L0; s.score = 0; s.alive = true; s.deadT = 0; s.acc = 0; s.n = 0; s.head = 0; s.newBest = false; s.dashT = 0; s.orb = 0;
  if (s.ai) { s.ai.tf = null; s.ai.chase = 0; s.ai.skipT = 0; }
  const N = Math.ceil(s.len / s.sp) + 1;
  for (let k = N; k >= 0; k--) snPush(s, clamp(s.x - Math.cos(s.a) * k * s.sp, s.rb, s.W - s.rb), clamp(s.y - Math.sin(s.a) * k * s.sp, s.rb, s.Hv - s.rb));
}
function snFood(s, fd) {
  for (let tries = 0; tries < 20; tries++) {
    fd.x = rnd(s.rb * 3, s.W - s.rb * 3); fd.y = rnd(s.top + s.rb * 2, s.Hv - s.rb * 3);
    if (Math.hypot(fd.x - s.x, fd.y - s.y) > s.W * 0.12 && !snNear(s, fd.x, fd.y, s.rb * 3, 0)) break;
  }
  fd.gold = Math.random() < 0.08; fd.hue = rnd(0, 360); fd.ph = rnd(0, TAU); fd.born = 0;
}
function snNear(s, x, y, R, from) {   // 身體（第 from 點以後）有沒有點在 R 以內
  const nb = snCount(s), R2 = R * R;
  for (let k = from; k < nb; k++) { const i = snIdx(s, k), dx = s.px[i] - x, dy = s.py[i] - y; if (dx * dx + dy * dy < R2) return true; }
  return false;
}
// 空間格子：每次 AI 思考時把身體點放進去，查「前方有沒有身體」只要看附近 3×3 格
function snGrid(s) {
  const gs = s.gs, nb = snCount(s); s.stamp++;
  for (let k = s.neck; k < nb; k++) {
    const i = snIdx(s, k), c = clamp(Math.floor(s.py[i] / gs), 0, s.gh - 1) * s.gw + clamp(Math.floor(s.px[i] / gs), 0, s.gw - 1);
    if (s.gSt[c] !== s.stamp) { s.gSt[c] = s.stamp; s.gHd[c] = -1; }
    s.gNx[i] = s.gHd[c]; s.gHd[c] = i;
  }
}
function snHit(s, x, y, R) {
  const gs = s.gs, cx = Math.floor(x / gs), cy = Math.floor(y / gs), R2 = R * R;
  for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
    if (xx < 0 || yy < 0 || xx >= s.gw || yy >= s.gh) continue;
    const c = yy * s.gw + xx; if (s.gSt[c] !== s.stamp) continue;
    for (let i = s.gHd[c]; i >= 0; i = s.gNx[i]) { const dx = s.px[i] - x, dy = s.py[i] - y; if (dx * dx + dy * dy < R2) return true; }
  }
  return false;
}
// 往 a 方向看出去：前方有牆或身體就回傳扣分（越近扣越多）
function snProbe(s, a) {
  for (let j = 1; j <= 7; j++) {
    const d = j * s.rb * 1.6, x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d;
    if (x < s.rb || y < s.rb || x > s.W - s.rb || y > s.Hv - s.rb) return 6 / j;
    if (snHit(s, x, y, s.rb * 1.9)) return 30 / j;
  }
  return 0;
}
// 想往 want 走，但避開牆和自己的身體：want 本身暢通就直接走，不然在前方扇形裡挑最接近又安全的方向
function snSteer(s, want) {
  snGrid(s);
  if (Math.abs(angD(want, s.a)) <= 1.4 && !snProbe(s, want)) return want;
  let best = s.a, bc = 1e18;
  for (let c = -5; c <= 5; c++) {
    const a = s.a + c * 0.28, cost = Math.abs(angD(want, a)) + snProbe(s, a);
    if (cost < bc) { bc = cost; best = a; }
  }
  return best;
}
function snAI(s, dt) {
  const ai = s.ai; ai.t -= dt; ai.chase += dt; ai.skipT -= dt;
  if (ai.t > 0) return ai.a;
  ai.t = rnd(0.07, 0.14);
  let tf = null, bd = 1e18;
  for (const fd of s.food) {
    if (fd === ai.skip && ai.skipT > 0) continue;                  // 追太久吃不到的那顆先放著
    const d = (fd.x - s.x) ** 2 + (fd.y - s.y) ** 2 * 1.1 - (fd.gold ? s.W * s.W * 0.02 : 0); if (d < bd) { bd = d; tf = fd; }
  }
  if (tf !== ai.tf) { ai.tf = tf; ai.chase = 0; }
  else if (tf && ai.chase > 5) { ai.skip = tf; ai.skipT = 4; ai.tf = null; ai.chase = 0; }
  let want = s.a + 0.4;
  if (tf) {
    // 食物落在轉彎圈裡面時一直轉只會繞著它打轉：先直走拉開距離，再大彎繞回來
    const dx = tf.x - s.x, dy = tf.y - s.y, d = Math.hypot(dx, dy), R = s.v / s.turn, th = angD(Math.atan2(dy, dx), s.a);
    const side = th >= 0 ? 1 : -1, cx = s.x - Math.sin(s.a) * R * side, cy = s.y + Math.cos(s.a) * R * side;
    const inCircle = Math.hypot(tf.x - cx, tf.y - cy) < R * 1.12 && d > s.rb * 2.1;
    want = inCircle ? s.a : s.a + th;
  }
  ai.a = snSteer(s, want) + gauss() * 0.05;
  return ai.a;
}
// 游標停著不動時：繞著游標畫圈（圈長比蛇身長，頭就不會撞到尾巴），圈放不進畫面時再靠 snSteer 閃身體
function snOrbit(s, cx, cy) {
  const R = s.v / s.turn, lim = Math.min(s.W, s.Hv - s.top) / 2 - s.rb * 2;
  const Ro = Math.max(R * 1.2, Math.min(lim, s.len / TAU + s.rb * 2));
  const ox = clamp(cx, Math.min(s.W / 2, Ro + s.rb), Math.max(s.W / 2, s.W - Ro - s.rb)), oy = clamp(cy, Math.min((s.top + s.Hv) / 2, s.top + Ro + s.rb), Math.max((s.top + s.Hv) / 2, s.Hv - Ro - s.rb));
  const dx = s.x - ox, dy = s.y - oy, r = Math.hypot(dx, dy) || 1e-6, phi = Math.atan2(dy, dx);
  if (!s.orb) s.orb = dx * Math.sin(s.a) - dy * Math.cos(s.a) >= 0 ? 1 : -1;      // 順著現在的方向繞
  return r > Ro ? phi + Math.PI - s.orb * Math.asin(Math.min(1, Ro / r)) : phi + s.orb * (Math.PI / 2 - ((Ro - r) / Ro) * 1.2);
}
function snDisc(g, x, y, R, A, cIn, cRim, ch) {   // x 欄、y 列；R 欄寬單位
  const rr = R / A;
  for (let yy = Math.floor(y - rr); yy <= y + rr; yy++) {
    const dy = (yy + 0.5 - y) * A; if (Math.abs(dy) > R) continue;
    const hw = Math.sqrt(R * R - dy * dy);
    for (let xx = Math.ceil(x - hw - 0.5); xx <= Math.floor(x + hw - 0.5); xx++) {
      const dx = xx + 0.5 - x;
      g.set(xx, yy, ch, (dx * dx + dy * dy) > R * R * 0.45 ? cRim : cIn);
    }
  }
}
A({ id: 'ix-snake', name: '游標貪食蛇', cat: '街機', theme: 'mint', hue: true, interactive: true,
  desc: '小蛇的頭會追著游標走，帶它去吃東西；點一下衝刺，別咬到自己',
  params: { speed: 1, turn: 1 },
  init(s, f) {
    const { g, cols, rows, aspect: A } = f;
    s.A = A; s.W = cols; s.Hv = rows * A; s.top = (hudRow(f) + 1) * A;
    s.rb = Math.max(0.55, rows * 0.0125) * A; s.sp = Math.max(0.8, s.rb * 0.6); s.thin = s.rb / A < 0.75;
    s.v = Math.max(9, cols * 0.11) * f.p.speed; s.turn = 3.1 * f.p.turn;
    s.L0 = Math.max(s.rb * 9, cols * 0.09); s.grow = Math.max(s.rb * 2.5, cols * 0.022);
    s.px = new Float32Array(SN_CAP); s.py = new Float32Array(SN_CAP); s.n = 0; s.head = 0;
    s.neck = Math.ceil((s.rb * 2.6) / s.sp) + 2;
    s.gs = s.rb * 2; s.gw = Math.ceil(s.W / s.gs) + 1; s.gh = Math.ceil(s.Hv / s.gs) + 1;
    s.gSt = new Int32Array(s.gw * s.gh); s.gHd = new Int32Array(s.gw * s.gh); s.gNx = new Int32Array(SN_CAP); s.stamp = 0;
    s.ai = { t: 0, a: 0, tf: null, chase: 0, skip: null, skipT: 0 }; s.parts = []; s.texts = []; s.best = 0; s.user = false; s.t = 0; s.hue0 = rnd(0, 360);
    s.dashT = 0; s.dashCD = 0; s.still = 0; s.orb = 0;
    snSpawn(s);
    s.food = Array.from({ length: clamp(Math.round((cols * rows) / 3500), 3, 9) }, () => ({}));
    for (const fd of s.food) snFood(s, fd);
    // 背景：淡淡的點陣棋盤（每隔一格稍亮一點）
    const lay = mkLayer(), sx = 8, sy = 4;
    for (let y = hudRow(f) + 2; y < rows - 1; y += sy) for (let x = sx >> 1; x < cols; x += sx) layerPut(lay, g, x, y, ((x / sx + y / sy) | 0) % 2 ? '·' : '+', ((x / sx + y / sy) | 0) % 2);
    s.lay = lay; s.pal = ['#000000', '#000000'];
  },
  frame(s, f) {
    const { g, C, H, cols, rows } = f, dt = stepDt(f), m = f.mouse, playing = userOn(f), A = s.A;
    if (playing && !s.user) s.user = true; else if (!playing && s.user) s.user = false;
    s.t += dt;
    if (s.alive) {
      // 衝刺：點一下衝 1.2 秒（不用按住拖曳，桌面才不會拉出藍色選取框），之後要等一下才能再衝
      s.dashT = Math.max(0, s.dashT - dt); s.dashCD = Math.max(0, s.dashCD - dt);
      if (s.user) for (const c of m.clicks) if (clickOk(c) && s.dashCD <= 0) { s.dashT = 1.2; s.dashCD = 2; }
      const dash = s.user && s.dashT > 0, speed = s.v * (dash ? 1.7 : 1);
      let want = s.a;
      if (s.user) {
        if (m.moved || !ptrOk(m)) { s.still = 0; s.orb = 0; s.ai.t = 0; } else s.still += dt;
        if (ptrOk(m)) {
          const cx = clamp(m.x, 0, cols), cy = clamp(m.y, 0, rows) * A, dx = cx - s.x, dy = cy - s.y;
          if (s.still > 0.4) {                                        // 游標停住：繞著它轉圈，不直直衝過去再折返咬到自己
            s.ai.t -= dt;
            if (s.ai.t <= 0) { s.ai.t = 0.06; s.ai.a = snSteer(s, snOrbit(s, cx, cy)); }
            want = s.ai.a;
          } else if (dx * dx + dy * dy > (s.rb * 1.5) ** 2) want = Math.atan2(dy, dx);
        }
      } else want = snAI(s, dt);
      const mt = s.turn * dt * (dash ? 1.3 : 1);
      s.a += clamp(angD(want, s.a), -mt, mt);
      let dist = speed * dt;
      for (let guard = 0; dist > 1e-6 && guard < 64; guard++) {
        const st = Math.min(dist, s.sp - s.acc);
        s.x += Math.cos(s.a) * st; s.y += Math.sin(s.a) * st;
        // 撞到邊緣就沿著牆滑（反彈會讓頭直接掉頭咬到自己）
        if (s.x < s.rb || s.x > s.W - s.rb) { s.x = clamp(s.x, s.rb, s.W - s.rb); s.a = Math.sin(s.a) >= 0 ? Math.PI / 2 : -Math.PI / 2; }
        if (s.y < s.rb || s.y > s.Hv - s.rb) { s.y = clamp(s.y, s.rb, s.Hv - s.rb); s.a = Math.cos(s.a) >= 0 ? 0 : Math.PI; }
        s.acc += st; dist -= st;
        if (s.acc >= s.sp - 1e-6) { s.acc = 0; snPush(s, s.x, s.y); }
      }
      // 吃東西
      for (const fd of s.food) {
        fd.born += dt;
        const rf = s.rb * 0.9;
        if (Math.hypot(fd.x - s.x, fd.y - s.y) < s.rb * 1.2 + rf) {
          const pts = fd.gold ? 5 : 1; s.score += pts; s.len = Math.min(s.len + s.grow * (fd.gold ? 2 : 1), (SN_CAP - 4) * s.sp); s.ai.chase = 0;
          if (s.score > s.best) { s.best = s.score; s.newBest = true; }
          fxText(s.texts, fd.x, fd.y / A - 1.5, '+' + pts, fd.gold ? H(48, 1) : C(1), 0.7);
          for (let q = 0; q < 10; q++) { const a = q * TAU / 10; addPart(s.parts, fd.x, fd.y / A, Math.cos(a) * s.rb * 6, Math.sin(a) * s.rb * 6 / A, 0.4, '·', fd.gold ? 48 : fd.hue, 200); }
          snFood(s, fd);
        }
      }
      // 咬到自己
      if (snNear(s, s.x, s.y, s.rb * 1.5, s.neck)) {
        s.alive = false; s.deadT = 0;
        const nb = snCount(s), step = Math.max(1, Math.floor(nb / 120));
        for (let k = 0; k < nb; k += step) { const i = snIdx(s, k), a = rnd(0, TAU), v = rnd(2, 10) * Math.max(1, s.rb); addPart(s.parts, s.px[i], s.py[i] / A, Math.cos(a) * v, Math.sin(a) * v / A, rnd(0.6, 1.4), '▪', (s.hue0 + k * 3) % 360, 300); }
        if (s.score > s.best) s.best = s.score;
      }
    } else {
      s.deadT += dt;
      if (s.deadT > 3.2) snSpawn(s);
    }
    // ── 畫 ──
    s.pal[0] = C(0.11); s.pal[1] = C(0.15); layerDraw(s.lay, g, s.pal);
    for (const fd of s.food) {
      const x = fd.x, y = fd.y / A, pulse = 0.5 + 0.5 * Math.sin(s.t * 5 + fd.ph), grow = Math.min(1, fd.born * 3);
      const col = fd.gold ? H(48, 0.85 + 0.15 * pulse) : H(fd.hue, 0.6 + 0.3 * pulse);
      if (s.thin || grow < 1) g.set(x, y, fd.gold ? '✦' : '◆', col);
      else { snDisc(g, x, y, s.rb * 0.85, A, col, fd.gold ? H(40, 0.6) : H(fd.hue, 0.4), '█'); if (fd.gold) g.set(x + s.rb * 1.2, y - 1, pulse > 0.5 ? '✦' : '·', C(1)); }
    }
    if (s.alive) {
      const nb = snCount(s);
      for (let k = nb - 1; k >= 1; k--) {
        const i = snIdx(s, k), x = s.px[i], y = s.py[i] / A, band = ((k / 3) | 0) % 2, hue = s.hue0 + k * 1.5;
        if (s.thin) { g.set(x, y, '█', H(hue, band ? 0.62 : 0.5)); continue; }
        snDisc(g, x, y, s.rb, A, H(hue, band ? 0.68 : 0.56), H(hue, 0.32), '█');
      }
      // 頭、眼睛、舌頭
      const hx = s.x, hy = s.y / A, ca = Math.cos(s.a), sa = Math.sin(s.a), hl = s.dashT > 0 ? 0.95 : 0.8;   // 衝刺時頭比較亮、舌頭吐出來
      if (s.thin) g.set(hx, hy, '█', H(s.hue0, hl + 0.05));
      else {
        snDisc(g, hx, hy, s.rb * 1.2, A, H(s.hue0, hl), H(s.hue0, 0.45), '█');
        for (const sd of [-1, 1]) g.set(hx + (ca * 0.45 - sa * 0.6 * sd) * s.rb, hy + (sa * 0.45 + ca * 0.6 * sd) * s.rb / A, '●', C(1));
        if (s.dashT > 0 || (s.t % 1.6) < 0.25) g.set(hx + ca * s.rb * 1.9, hy + sa * s.rb * 1.9 / A, Math.abs(ca) > 0.5 ? '~' : '¦', H(350, 0.75));
      }
    }
    drawParts(f, s.parts, dt, 0);
    drawTexts(f, s.texts, dt, 3);
    const lb = C(0.4), segs = [];
    if (!s.user) segs.push([tr(f, '示範  ', 'Demo  '), C(0.32)]);
    segs.push([tr(f, '長度 ', 'Length '), lb], [String(Math.round(s.len / s.sp)), C(0.85)], [tr(f, '  得分 ', '  Score '), lb], [String(s.score), C(0.95)], [tr(f, '  最高 ', '  Best '), lb], [String(s.best), C(0.7)]);
    hud(f, segs);
    hint(f, tr(f, '移動滑鼠帶小蛇去吃東西，點一下衝刺', 'Move the mouse to lead the snake to food, click to dash'));
    if (!s.alive && s.deadT > 0.6) banner(f, 'GAME OVER', tr(f, '得分 ' + s.score + '　長度 ', 'Score ' + s.score + '  Length ') + Math.round(s.len / s.sp) + bestTail(f, s), rows * 0.45);
  } });
})();
