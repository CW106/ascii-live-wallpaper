// 互動射擊（ix- 開頭）：用滑鼠瞄準、點擊、劃過的小遊戲。
// 沒人碰滑鼠時由 AI 自己示範（虛擬游標照同一套規則玩）；一移動或點擊就立刻換你玩，6 秒沒動作 AI 再接手。
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
// 寫字：全形字的第二格也清掉，底下的東西才不會蓋住字的右半邊
const wideCh = c => { const k = c.codePointAt(0); return k >= 0x2e80 && k < 0xff61; };
// solid：空白也蓋掉底下的東西（英文字之間有空白，畫在星空、背景上時才清楚）
function txt(g, x, y, s, col, solid) {
  x = Math.floor(x);
  for (const c of s) { const w = wideCh(c); if (c !== ' ') { g.set(x, y, c, col); if (w) g.set(x + 1, y, ' ', col); } else if (solid) g.set(x, y, ' ', col); x += w ? 2 : 1; }
}
const ctextAt = (g, cx, y, s, col, solid) => txt(g, Math.floor(cx - g.textW(s) / 2), y, s, col, solid);
// 介面語言：f.lang === 'en' 時畫英文，其他（含舊版沒有 f.lang）都畫中文
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = x => x * x * (3 - 2 * x);
const unitOf = f => Math.min(f.cols / 100, f.rows / 28);
function fillRect(g, x0, y0, w, h, ch, col) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(g.rows, Math.floor(y0 + h)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(g.cols, Math.floor(x0 + w)); x++) { const i = y * g.cols + x; g.ch[i] = ch; g.co[i] = col; }
}
function box(g, x0, y0, w, h, col) {
  for (let x = 1; x < w - 1; x++) { g.set(x0 + x, y0, '─', col); g.set(x0 + x, y0 + h - 1, '─', col); }
  for (let y = 1; y < h - 1; y++) { g.set(x0, y0 + y, '│', col); g.set(x0 + w - 1, y0 + y, '│', col); }
  g.set(x0, y0, '╭', col); g.set(x0 + w - 1, y0, '╮', col); g.set(x0, y0 + h - 1, '╰', col); g.set(x0 + w - 1, y0 + h - 1, '╯', col);
}
// 陣列裡標了 dead 的項目就地移除（不配置新陣列）
function sweep(a) { let j = 0; for (let i = 0; i < a.length; i++) if (!a[i].dead) a[j++] = a[i]; a.length = j; }
// 最高分（可有可無；沒有 localStorage 時就只記在記憶體）
function bestGet(k) { try { if (typeof localStorage !== 'undefined') return +(localStorage.getItem('ix-best-' + k) || 0) || 0; } catch (e) { /* 忽略 */ } return 0; }
function bestPut(k, v) { try { if (typeof localStorage !== 'undefined') localStorage.setItem('ix-best-' + k, String(v)); } catch (e) { /* 忽略 */ } }

// 半格點陣：一個字元格分成上下兩個「像素」，用 ▀ ▄ █ 畫出圓滑的邊
const HB = { m: new Uint8Array(1), c: [], idx: [] };
function hbPlot(g, x, y, col) {
  const cx = Math.floor(x), h2 = Math.floor(y * 2), cy = h2 >> 1;
  if (cx < 0 || h2 < 0 || cx >= g.cols || cy >= g.rows) return;
  if (HB.m.length !== g.n) { HB.m = new Uint8Array(g.n); HB.c = new Array(g.n); HB.idx.length = 0; }
  const i = cy * g.cols + cx;
  if (!HB.m[i]) HB.idx.push(i);
  HB.m[i] |= h2 & 1 ? 2 : 1; HB.c[i] = col;
}
function hbFlush(g) {
  const m = HB.m, c = HB.c;
  for (const i of HB.idx) { const b = m[i]; if (i < g.n) g.setI(i, b === 3 ? '█' : b === 1 ? '▀' : '▄', c[i]); m[i] = 0; }
  HB.idx.length = 0;
}
// 粗線（半格解析度），w 是粗細（欄寬單位）
function thick(g, x0, y0, x1, y1, w, A, col) {
  const dx = x1 - x0, dy = (y1 - y0) * A, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const n = Math.ceil(L / 0.35), m = Math.max(1, Math.ceil(w / 0.4));
  for (let i = 0; i <= n; i++) for (let j = 0; j < m; j++) {
    const o = m === 1 ? 0 : (j / (m - 1) - 0.5) * w, t = (L * i) / n;
    hbPlot(g, x0 + ux * t - uy * o, y0 + (uy * t + ux * o) / A, col);
  }
}
// 大字（5×7 點陣、半格像素，所以像素接近正方形）；會先清出一塊底
function bigText(g, str, cx, cy, maxW, maxH, col) {
  const pw = fontW(str, F5), n = Math.max(1, Math.floor(Math.min(maxW / pw, (maxH * 2) / 7)));
  const w = pw * n, h2 = 7 * n, x0 = Math.round(cx - w / 2), y2 = Math.round(cy * 2 - h2 / 2);
  fillRect(g, x0 - 2, Math.floor(y2 / 2) - 1, w + 4, Math.ceil(h2 / 2) + 3, ' ', col);
  let x = x0;
  for (const c of str) {
    const gl = F5[c] || F5[' '], gw = gl[0].length;
    for (let r = 0; r < 7; r++) for (let q = 0; q < gw; q++) if (gl[r][q] === '1')
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) hbPlot(g, x + q * n + b, (y2 + r * n + a) / 2, col);
    x += (gw + 1) * n;
  }
  hbFlush(g);
  return Math.ceil((y2 + h2) / 2);
}
// 實心圓（上下半格解析度）：shade(nx, ny, o) 回傳顏色，回傳 null 就不畫那一格
function blob(g, cx, cy, R, A, shade, o) {
  const ry = R / A, R2 = R * R;
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(g.rows - 1, Math.floor(cy + ry));
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(g.cols - 1, Math.floor(cx + R));
  for (let y = y0; y <= y1; y++) {
    const dT = (y + 0.25 - cy) * A, dB = (y + 0.75 - cy) * A, dM = (y + 0.5 - cy) * A;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, t = dx * dx + dT * dT <= R2, b = dx * dx + dB * dB <= R2;
      if (!t && !b) continue;
      const col = shade(dx / R, (t && b ? dM : t ? dT : dB) / R, o);
      if (col) g.setI(y * g.cols + x, t && b ? '█' : t ? '▀' : '▄', col);
    }
  }
}
// 圓周路徑：沿著圓走一圈得到相鄰（上下左右）的格子序列，之後用 ╭─╮│╰╯ 畫出圓圈
const RX = new Int32Array(6000), RY = new Int32Array(6000);
function ringPath(cx, cy, r, A) {
  const N = Math.min(2600, Math.max(12, Math.ceil(TAU * r * 2.4)));
  let n = 0, lx = -1e9, ly = -1e9;
  const corner = (x, y) => {
    const e1 = Math.abs(Math.hypot(x + 0.5 - cx, (ly + 0.5 - cy) * A) - r), e2 = Math.abs(Math.hypot(lx + 0.5 - cx, (y + 0.5 - cy) * A) - r);
    if (e1 <= e2) { RX[n] = x; RY[n] = ly; } else { RX[n] = lx; RY[n] = y; }
    n++;
  };
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU, x = Math.floor(cx + Math.cos(a) * r), y = Math.floor(cy + (Math.sin(a) * r) / A);
    if (x === lx && y === ly) continue;
    if (n && x !== lx && y !== ly) corner(x, y);
    RX[n] = x; RY[n] = y; n++; lx = x; ly = y;
  }
  if (n > 2) {
    const x = RX[0], y = RY[0];
    if (x === lx && y === ly) n--;
    else if (x !== lx && y !== ly) corner(x, y);
  }
  return n;
}
const RING_CH = []; RING_CH[3] = '─'; RING_CH[12] = '│'; RING_CH[5] = '╭'; RING_CH[6] = '╮'; RING_CH[9] = '╰'; RING_CH[10] = '╯';
const dirBit = (dx, dy) => (dy === 0 ? (dx === 1 ? 1 : dx === -1 ? 2 : 0) : dx === 0 ? (dy === 1 ? 4 : dy === -1 ? 8 : 0) : 0);
function ringCh(i, n) {
  const p = i ? i - 1 : n - 1, q = i + 1 < n ? i + 1 : 0;
  return RING_CH[dirBit(RX[p] - RX[i], RY[p] - RY[i]) | dirBit(RX[q] - RX[i], RY[q] - RY[i])] || '·';
}
// 線段 a→b 和圓（圓心 c、半徑 R，單位都是欄寬；y 乘 A）第一次相交的位置 0..1，沒碰到回傳 -1
function segCircle(ax, ay, bx, by, cx, cy, R, A) {
  const dx = bx - ax, dy = (by - ay) * A, fx = ax - cx, fy = (ay - cy) * A;
  const c = fx * fx + fy * fy - R * R;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return -1;
  const b = 2 * (fx * dx + fy * dy), disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}
// 點到線段的距離（欄寬單位）
function segDist(px, py, ax, ay, bx, by, A) {
  const dx = bx - ax, dy = (by - ay) * A, fx = px - ax, fy = (py - ay) * A, L = dx * dx + dy * dy;
  const t = L > 1e-9 ? clamp((fx * dx + fy * dy) / L, 0, 1) : 0;
  return Math.hypot(fx - dx * t, fy - dy * t);
}
// 粒子：vx, vy 以「欄寬/秒」為單位，y 方向除以 A 換成列
function burst(P, x, y, n, spd, hue, life, grav, max) {
  for (let k = 0; k < n && P.length < (max || 700); k++) {
    const a = Math.random() * TAU, v = spd * (0.25 + 0.75 * Math.random());
    P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: life * (0.5 + 0.5 * Math.random()), l0: life, hue: hue + rnd(-18, 18), g: grav || 0 });
  }
}
function stepParts(P, dt, A) {
  const dmp = 1 - Math.min(0.9, 1.6 * dt);
  for (let k = P.length - 1; k >= 0; k--) {
    const q = P[k];
    q.l -= dt;
    if (q.l <= 0) { P[k] = P[P.length - 1]; P.pop(); continue; }
    q.vx *= dmp; if (q.g) q.vy += q.g * dt; else q.vy *= dmp;
    q.x += q.vx * dt; q.y += (q.vy * dt) / A;
  }
}
function drawParts(g, P, H, ch) {
  for (let k = 0; k < P.length; k++) { const q = P[k], u = q.l / q.l0; g.set(q.x, q.y, ch[u > 0.6 ? 2 : u > 0.3 ? 1 : 0], H(q.hue, 0.3 + 0.65 * u)); }
}
// 往上飄、慢慢變淡的小字（+20 之類）；s 可以是 [中文, 英文]，畫的時候才依語言挑
function addText(T, x, y, s, hue, life) { if (T.length < 40) T.push({ x, y, s, hue, t: 0, life: life || 1 }); }
function drawTexts(g, T, dt, H, f) {
  for (let k = T.length - 1; k >= 0; k--) {
    const q = T[k]; q.t += dt;
    if (q.t >= q.life) { T.splice(k, 1); continue; }
    const u = q.t / q.life, str = typeof q.s === 'string' ? q.s : tr(f, q.s[0], q.s[1]);
    ctextAt(g, clamp(q.x, g.textW(str) / 2 + 1, g.cols - g.textW(str) / 2 - 1), Math.round(q.y - u * 2), str, H(q.hue, 0.95 - 0.5 * u), f.lang === 'en');
  }
}
// 右上角的小資訊列：parts = [[字, 顏色, 和前一段的間距(預設 2)], ...]
function hud(g, parts, y = 0) {
  let w = 0;
  for (let k = 0; k < parts.length; k++) w += g.textW(parts[k][0]) + (k ? (parts[k][2] === undefined ? 2 : parts[k][2]) : 0);
  let x = g.cols - 2 - w;
  fillRect(g, x - 1, y, w + 2, 1, ' ', '#000000');
  for (let k = 0; k < parts.length; k++) {
    if (k) x += parts[k][2] === undefined ? 2 : parts[k][2];
    txt(g, x, y, parts[k][0], parts[k][1]); x += g.textW(parts[k][0]);
  }
}
// 示範模式的提示：底部中央一行暗字
function hint(g, f, str) {
  const w = g.textW(str), x = Math.floor((f.cols - w) / 2), y = f.rows - 1;
  fillRect(g, x - 2, y, w + 4, 1, ' ', '#000000');
  txt(g, x, y, str, f.C(0.42));
}
// 置中的小框（結算畫面）
function panel(g, f, lines, cy, border) {
  let w = 0; for (const L of lines) w = Math.max(w, g.textW(L[0]));
  const bw = w + 6, bh = lines.length + 2, x0 = Math.floor((f.cols - bw) / 2), y0 = Math.floor(cy - bh / 2);
  fillRect(g, x0, y0, bw, bh, ' ', border);
  box(g, x0, y0, bw, bh, border);
  for (let k = 0; k < lines.length; k++) ctextAt(g, x0 + bw / 2, y0 + 1 + k, lines[k][0], lines[k][1]);
}
// 結算行：「分數 N　最高 M」（沒有最高分時只寫分數）
const scoreBest = (f, s) => tr(f, '分數 ', 'Score ') + s.score + (s.best ? tr(f, '　最高 ', '  Best ') + s.best : '');
// 準星（十字）與瞄準框
function crossHair(g, x, y, col, big) {
  const cx = Math.floor(x), cy = Math.floor(y), a = big ? 4 : 2, b = big ? 2 : 1;
  for (let k = 1; k <= a; k++) { g.set(cx - k, cy, '─', col); g.set(cx + k, cy, '─', col); }
  for (let k = 1; k <= b; k++) { g.set(cx, cy - k, '│', col); g.set(cx, cy + k, '│', col); }
  g.set(cx, cy, '┼', col);
}
function bracket(g, x, y, col, big) {
  const cx = Math.floor(x), cy = Math.floor(y), a = big ? 4 : 2, b = big ? 2 : 1;
  g.set(cx - a, cy - b, '┌', col); g.set(cx + a, cy - b, '┐', col); g.set(cx - a, cy + b, '└', col); g.set(cx + a, cy + b, '┘', col);
  if (big) { g.set(cx - a + 1, cy - b, '─', col); g.set(cx + a - 1, cy - b, '─', col); g.set(cx - a + 1, cy + b, '─', col); g.set(cx + a - 1, cy + b, '─', col); }
  g.set(cx, cy, '·', col);
}

/* ════════════ 共用：玩家／AI 輸入 ════════════ */
// 每格只用一個「指標」I：有人在玩就是真的滑鼠，沒人玩就是 AI 的虛擬滑鼠（照同一套規則玩）
const mkAi = f => ({ x: f.cols * 0.5, y: f.rows * 0.45, vx: 0, vy: 0, down: false, clicks: [], cool: 0.6, react: 0, tgt: null, ex: 0, ey: 0, st: 0, t: 0 });
const mkI = f => ({ x: f.cols * 0.5, y: f.rows * 0.45, px: f.cols * 0.5, py: f.rows * 0.45, down: false, clicks: [], user: false, taken: false, left: false, aiT: 0 });
function ixIn(s, f, aiFn) {
  const m = f.mouse, I = s.I, ai = s.ai, play = m.idle < 6 && m.on;
  I.taken = play && !I.user; I.left = !play && I.user; I.user = play;
  I.px = I.x; I.py = I.y;
  if (play) {
    if (I.taken) I.aiT = s.aiT || 0;
    s.aiT = 0;
    I.x = +m.x || 0; I.y = +m.y || 0; I.down = !!m.down; I.clicks = m.clicks || [];
  } else {
    if (I.left) { ai.x = clamp(I.x, 0, f.cols); ai.y = clamp(I.y, 0, f.rows); ai.vx = ai.vy = 0; ai.down = false; ai.tgt = null; ai.st = 0; }
    s.aiT = (s.aiT || 0) + f.dt;
    ai.clicks.length = 0;
    aiFn(s, f, ai);
    I.x = ai.x; I.y = ai.y; I.down = ai.down; I.clicks = ai.clicks;
  }
  if (I.taken) { I.px = I.x; I.py = I.y; }
  return I;
}
// 玩家離開、AI 接手的那一格：先把玩家到目前為止的分數記成最高分，之後 AI 拿到的分數就不算玩家的
function ixLeft(s, I, score, key) {
  if (!I.left) return;
  if (s.mine && score > s.best) { s.best = score; bestPut(key, score); }
  s.mine = false;
}
// AI 游標：像人手一樣加速、減速靠近目標（vmax 單位：欄寬/秒）；tvx/tvy 是目標本身的速度（跟著移動目標走）
function seek(ai, tx, ty, dt, vmax, A, tvx, tvy, gain) {
  const dx = tx - ai.x, dy = (ty - ai.y) * A, d = Math.hypot(dx, dy);
  const sp = Math.min(vmax, d * (gain || 6)), k = Math.min(1, dt * 10);
  const wx = (d > 1e-6 ? (dx / d) * sp : 0) + (tvx || 0), wy = (d > 1e-6 ? (dy / d) * sp : 0) + (tvy || 0);
  ai.vx += (wx - ai.vx) * k; ai.vy += (wy - ai.vy) * k;
  ai.x += ai.vx * dt; ai.y += (ai.vy * dt) / A;
  return d;
}
const wander = (s, f, ai, yk) => seek(ai, f.cols * (0.5 + 0.28 * Math.sin(s.t * 0.37)), f.rows * (yk || 0.42) + f.rows * 0.08 * Math.sin(s.t * 0.53), f.dt, f.cols * 0.25, f.aspect);

/* ════════════ 1. 太空砲台 ════════════ */
const TU_PTS = [0, 100, 50, 20];
const tuR = (s, lvl) => (lvl === 3 ? Math.max(2.6, 2.3 * s.u) : lvl === 2 ? Math.max(1.7, 1.45 * s.u) : Math.max(1.05, 0.85 * s.u));
function tuRock(s, f, x, y, lvl, vx, vy) {
  if (vy === undefined) {
    vy = f.rows * s.A * rnd(0.045, 0.07) * (1 + 0.07 * (s.lvl - 1)) * (f.p.fast || 1);
    vx = rnd(-1, 1) * vy * 0.3 + (f.cols / 2 - x) * 0.012;
  }
  const l = new Float32Array(8);
  for (let k = 0; k < 8; k++) l[k] = rnd(-1, 1);
  const cr = [];
  for (let k = 0; k < 3; k++) cr.push({ x: rnd(-0.5, 0.5), y: rnd(-0.5, 0.5), r: rnd(0.18, 0.32) });
  return { x, y, vx, vy, lvl, R: tuR(s, lvl), l, cr, rot: rnd(0, TAU), vr: rnd(-0.9, 0.9), hit: 0, claim: 0, dead: false };
}
const tuAng = (T, x, y, A) => { const a = Math.atan2((y - T.py) * A, x - T.x); return a > 0 ? (x < T.x ? -Math.PI + 0.1 : -0.1) : clamp(a, -Math.PI + 0.1, -0.1); };
function tuInit(s, f) {
  const { cols, rows, p } = f, A = f.aspect, u = unitOf(f);
  s.A = A; s.u = u; s.t = 0; s.lvl = 1;
  s.gy = rows - Math.max(2, Math.round(rows * 0.07));
  s.VB = Math.max(cols * 0.75, rows * A * 1.15);
  const n = p.turrets || 1, rx = Math.max(3, 2.3 * u);
  s.tur = [];
  for (let k = 0; k < n; k++) s.tur.push({ x: n === 1 ? cols / 2 : cols * (k ? 0.74 : 0.26), rx, py: s.gy + 0.25 - (rx / A) * 0.45, L: rx * 0.5 + Math.max(2.8, 2.4 * u), bw: Math.max(0.8, 0.6 * u), ang: -Math.PI / 2, cool: 0, kick: 0 });
  s.stars = [];
  const ns = Math.round((cols * s.gy) / 42);
  for (let k = 0; k < ns; k++) s.stars.push({ x: rnd(0, cols), y: rnd(0, s.gy), z: Math.random(), ph: rnd(0, TAU) });
  s.rocks = []; s.shots = []; s.parts = []; s.blasts = []; s.texts = [];
  s.ai = mkAi(f); s.I = mkI(f); s.best = bestGet('turret');
  tuNew(s, f, true);
}
function tuNew(s, f, first) {
  s.score = 0; s.shield = 5; s.lvl = 1; s.time = 0; s.over = 0; s.spawnT = first ? 1 : 1.5; s.hold = 0; s.mine = false;
  s.msg = first ? '' : '新的一局'; s.msgEn = first ? '' : 'New game'; s.msgT = first ? 0 : 1.5;
  if (!first) {
    // 上一局留下的隕石和砲彈全部碎掉清空：新的一局從乾淨的天空、第 1 關的速度開始
    for (const r of s.rocks) { r.dead = true; burst(s.parts, r.x, r.y, 3 + r.lvl * 3, r.R * 3 + 4, 35, 0.6, 0); }
    s.rocks.length = 0; s.shots.length = 0; s.ai.tgt = null;
  }
  const n = first ? 3 : 2, y1 = first ? 0.45 : 0.22;
  for (let k = 0; k < n; k++) s.rocks.push(tuRock(s, f, rnd(0.15, 0.85) * f.cols, rnd(0.04, y1) * f.rows, rint(2, 3)));
}
function tuFire(s, f, x, y) {
  let any = false;
  for (const T of s.tur) {
    if (T.cool > 0) continue;
    const a = tuAng(T, x, y, s.A), c = Math.cos(a), sn = Math.sin(a);
    s.shots.push({ x: T.x + c * T.L, y: T.py + (sn * T.L) / s.A, vx: c * s.VB, vy: sn * s.VB, dead: false });
    T.cool = 0.13; T.kick = 1; any = true;
  }
  if (any) s.hold = 0.24;
  return any;
}
function tuBreak(s, f, r) {
  r.dead = true;
  if (!s.over) { const pts = TU_PTS[r.lvl]; s.score += pts; addText(s.texts, r.x, r.y - r.R / s.A - 1, '+' + pts, 190, 0.9); }
  burst(s.parts, r.x, r.y, 5 + r.lvl * 5, r.R * 4 + 6, 35, 0.8, 0);
  if (r.lvl > 1) {
    const n = f.p.split || 2, sp = Math.hypot(r.vx, r.vy), base = Math.atan2(r.vy, r.vx), off = rnd(0.45, 0.75);
    for (let k = 0; k < n; k++) {
      const a = base + (n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * off), v = sp * rnd(1.1, 1.35);
      const vx = Math.cos(a) * v, vy = Math.max(sp * 0.35, Math.sin(a) * v), side = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2;
      const c = tuRock(s, f, r.x - Math.sin(base) * side * r.R * 0.45, r.y + (Math.cos(base) * side * r.R * 0.45) / s.A, r.lvl - 1, vx, vy);
      c.hit = 0.35;   // 剛裂開的碎塊亮一下
      s.rocks.push(c);
    }
  }
}
function tuImpact(s, f, r) {
  r.dead = true;
  s.blasts.push({ x: r.x, R: r.R * 1.6 + 1, t: 0 });
  burst(s.parts, r.x, s.gy - 0.5, 6 + r.lvl * 4, r.R * 3 + 5, 20, 0.9, 0);
  if (s.over) return;
  s.shield--;
  if (s.shield <= 0) {
    s.shield = 0; s.over = 0.001;
    if (s.mine && s.score > s.best) { s.best = s.score; bestPut('turret', s.best); }
  }
}
function tuAi(s, f, ai) {
  const A = s.A, dt = f.dt, cols = f.cols;
  ai.cool -= dt; ai.react -= dt;
  if (s.over) { wander(s, f, ai); return; }
  let r = ai.tgt;
  if (r && (r.dead || r.claim > 0 || r.y > s.tur[0].py - 2)) r = ai.tgt = null;
  if (!r) {
    let best = 1e9;
    for (const q of s.rocks) {
      if (q.dead || q.y < f.rows * 0.1 || q.claim > 0 || q.y > s.tur[0].py - 3 - q.R / A) continue;
      const tti = ((s.gy - q.y) * A) / Math.max(1, q.vy), d = Math.hypot(q.x - ai.x, (q.y - ai.y) * A);
      const k = tti + (d / cols) * 3 + Math.random() * 0.5;
      if (k < best) { best = k; r = q; }
    }
    if (r) {
      ai.tgt = r; ai.react = rnd(0.06, 0.2);
      ai.ex = Math.random() < 0.1 ? (Math.random() < 0.5 ? -1 : 1) * r.R * rnd(1.2, 1.7) : gauss() * r.R * 0.3;
      ai.ey = (gauss() * r.R * 0.3) / A;
    }
  }
  if (!r) { wander(s, f, ai, 0.35); return; }
  let T = s.tur[0];
  for (const q of s.tur) if (Math.abs(q.x - r.x) < Math.abs(T.x - r.x)) T = q;
  let X = r.x, Y = r.y, tt = 0;
  for (let it = 0; it < 4; it++) { tt = Math.hypot(X - T.x, (Y - T.py) * A) / s.VB; X = r.x + r.vx * tt; Y = r.y + (r.vy * tt) / A; }
  const ax = X + ai.ex, ay = Y + ai.ey;
  seek(ai, ax, ay, dt, Math.max(70, cols * 1.1), A, r.vx, r.vy);
  const want = Math.atan2((ay - T.py) * A, ax - T.x), have = Math.atan2((ai.y - T.py) * A, ai.x - T.x), dist = Math.hypot(ax - T.x, (ay - T.py) * A);
  if (ai.cool <= 0 && ai.react <= 0 && Math.abs(want - have) < Math.atan2(r.R * 0.6, dist) + 0.004) {
    ai.clicks.push({ x: ai.x, y: ai.y, button: 0 });
    ai.cool = rnd(0.18, 0.38); r.claim = tt + 0.3; ai.tgt = null;
  }
}
function tuDrawRock(g, f, r) {
  const A = f.aspect, R = r.R, Rm = R * 1.18, ry = Rm / A, C = f.C;
  const y0 = Math.max(0, Math.floor(r.y - ry)), y1 = Math.min(g.rows - 1, Math.floor(r.y + ry));
  const x0 = Math.max(0, Math.floor(r.x - Rm)), x1 = Math.min(g.cols - 1, Math.floor(r.x + Rm));
  const c = Math.cos(r.rot), sn = Math.sin(r.rot);
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - r.y) * A;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - r.x, d = Math.hypot(dx, dy);
      if (d > Rm) continue;
      let a = (Math.atan2(dy, dx) - r.rot) / TAU; a = (a - Math.floor(a)) * 8;
      const k = a | 0, lump = r.l[k] + (r.l[(k + 1) & 7] - r.l[k]) * smooth(a - k), Rt = R * (1 + 0.15 * lump);
      if (d > Rt) continue;
      const lx = (dx * c + dy * sn) / R, ly = (-dx * sn + dy * c) / R;
      let cr = 0;
      for (const q of r.cr) { const e = Math.hypot(lx - q.x, ly - q.y); if (e < q.r) cr = Math.max(cr, 1 - e / q.r); }
      let lt = 0.55 - ((dx * 0.55 + dy * 0.8) / Rt) * 0.45 - cr * 0.4;
      if (Rt - d < 0.9) lt -= 0.12;
      const ch = lt > 0.72 ? '█' : lt > 0.5 ? '▓' : lt > 0.28 ? '▒' : '░';
      g.setI(y * g.cols + x, ch, C(clamp(0.22 + lt * 0.6 + r.hit, 0, 1)));
    }
  }
}
const tuDome = (nx, ny, f) => f.C(clamp(0.52 - ny * 0.22 - nx * 0.12, 0.25, 0.85));
function tuFrame(s, f) {
  const { g, cols, rows, C, H, p } = f, A = s.A, dt = f.dt;
  const I = ixIn(s, f, tuAi);
  ixLeft(s, I, s.score, 'turret');
  if (I.user) s.mine = true;
  if (I.taken && (I.aiT > 15 || s.over)) tuNew(s, f);
  s.t += dt;
  if (s.over) { s.over += dt; if (s.over > 5) tuNew(s, f); }
  else {
    s.time += dt;
    const lv = Math.min(9, 1 + Math.floor(s.time / 30));
    if (lv > s.lvl) { s.lvl = lv; s.msg = '第 ' + lv + ' 關' + (s.shield < 5 ? '　護盾 +1' : ''); s.msgEn = 'Level ' + lv + (s.shield < 5 ? '  Shield +1' : ''); s.shield = Math.min(5, s.shield + 1); s.msgT = 1.8; }
  }
  if (s.msgT > 0) s.msgT -= dt;
  // 瞄準與開砲
  for (const T of s.tur) { T.ang = tuAng(T, I.x, I.y, A); T.cool -= dt; T.kick = Math.max(0, T.kick - dt * 5); }
  if (!s.over) {
    for (const c of I.clicks) tuFire(s, f, c.x, c.y);
    s.hold -= dt;
    if (I.down && s.hold <= 0) tuFire(s, f, I.x, I.y);
  } else if (s.over > 1.5 && I.clicks.length) tuNew(s, f);
  // 產生隕石
  if (!s.over) {
    s.spawnT -= dt;
    if (s.spawnT <= 0) {
      const cap = Math.round((4 + (cols * rows) / 2800) * (1 + 0.1 * s.lvl) * ((p.rate || 1) > 1 ? 1.25 : 1));
      if (s.rocks.length < cap) s.rocks.push(tuRock(s, f, rnd(0.08, 0.92) * cols, -tuR(s, 3) / A, Math.random() < 0.7 ? 3 : 2));
      s.spawnT = rnd(1.8, 3.4) / ((p.rate || 1) * (1 + 0.15 * (s.lvl - 1)));
    }
  }
  for (const r of s.rocks) {
    r.x += r.vx * dt; r.y += (r.vy * dt) / A; r.rot += r.vr * dt;
    if (r.hit > 0) r.hit = Math.max(0, r.hit - dt * 3);
    if (r.claim > 0) r.claim -= dt;
    if (r.x < r.R && r.vx < 0) r.vx = -r.vx;
    if (r.x > cols - r.R && r.vx > 0) r.vx = -r.vx;
    if (r.y + (r.R * 0.7) / A >= s.gy) tuImpact(s, f, r);
  }
  for (const b of s.shots) {
    const ox = b.x, oy = b.y;
    b.x += b.vx * dt; b.y += (b.vy * dt) / A;
    let hit = null, ht = 2;
    for (const r of s.rocks) {
      if (r.dead) continue;
      const t = segCircle(ox, oy, b.x, b.y, r.x, r.y, r.R * 1.08, A);
      if (t >= 0 && t < ht) { ht = t; hit = r; }
    }
    if (hit) { b.dead = true; tuBreak(s, f, hit); }
    else if (b.x < -2 || b.x > cols + 2 || b.y < -2) b.dead = true;
  }
  sweep(s.rocks); sweep(s.shots);
  stepParts(s.parts, dt, A);
  // ── 繪圖 ──
  for (const st of s.stars) {
    st.y += dt * (0.1 + st.z * 0.35);
    if (st.y >= s.gy) { st.y -= s.gy; st.x = rnd(0, cols); }
    const b = 0.5 + 0.5 * Math.sin(s.t * (0.6 + st.z) + st.ph);
    if (b > 0.2) g.set(st.x, st.y, st.z > 0.9 && b > 0.75 ? '+' : st.z > 0.5 ? '·' : '.', C(0.08 + st.z * 0.25 * b));
  }
  for (const r of s.rocks) tuDrawRock(g, f, r);
  for (const b of s.shots) {
    const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
    g.set(b.x - ux * 2, b.y - (uy * 2) / A, '·', H(190, 0.45));
    g.set(b.x - ux, b.y - uy / A, '·', H(190, 0.7));
    g.set(b.x, b.y, '•', H(190, 1));
  }
  for (const T of s.tur) {
    const L = T.L * (1 - T.kick * 0.15), c = Math.cos(T.ang), sn = Math.sin(T.ang);
    thick(g, T.x, T.py, T.x + c * L, T.py + (sn * L) / A, T.bw, A, C(0.78));
    hbFlush(g);
    blob(g, T.x, s.gy + 0.25, T.rx, A, tuDome, f);
    if (T.kick > 0.7) g.set(T.x + c * (L + 1), T.py + (sn * (L + 1)) / A, '✶', H(50, 1));
  }
  // 地面（撞擊處短暫發亮）
  for (let y = s.gy; y < rows; y++) for (let x = 0; x < cols; x++) {
    const h = hash(x, y);
    g.setI(y * cols + x, y === s.gy ? '▀' : h < 0.22 ? '▒' : '░', y === s.gy ? C(0.32) : C(0.1 + h * 0.08));
  }
  for (let k = s.blasts.length - 1; k >= 0; k--) {
    const e = s.blasts[k]; e.t += dt;
    if (e.t > 0.7) { s.blasts.splice(k, 1); continue; }
    const R = e.R * (0.5 + e.t), lum = 1 - e.t / 0.7;
    for (let x = Math.floor(e.x - R); x <= e.x + R; x++) {
      const q = 1 - Math.abs(x + 0.5 - e.x) / R;
      if (q <= 0) continue;
      g.set(x, s.gy, '▀', H(25, 0.3 + 0.7 * q * lum));
      if (q > 0.5) g.set(x, s.gy - 1, '▄', H(35, 0.2 + 0.6 * q * lum));
    }
  }
  drawParts(g, s.parts, H, '·•*');
  drawTexts(g, s.texts, dt, H, f);
  if (!s.over) bracket(g, I.x, I.y, I.user ? C(0.85) : C(0.5), rows >= 50);
  hud(g, [[tr(f, '第 ' + s.lvl + ' 關', 'Level ' + s.lvl), C(0.45)], [tr(f, '分數 ', 'Score ') + s.score, C(0.85)], ['■'.repeat(s.shield) + '□'.repeat(5 - s.shield), H(190, 0.75)]]);
  if (s.over) {
    const by = bigText(g, 'GAME OVER', cols / 2, rows * 0.36, cols * 0.62, rows * 0.16, C(0.9));
    ctextAt(g, cols / 2, by + 1, scoreBest(f, s), C(0.7), f.lang === 'en');
  } else if (s.msgT > 0) ctextAt(g, cols / 2, Math.round(rows * 0.3), tr(f, s.msg, s.msgEn), C(0.8), f.lang === 'en');
  if (!I.user) hint(g, f, tr(f, '移動滑鼠瞄準，點一下開砲（按住連發）', 'Move the mouse to aim, click to fire (hold for rapid fire)'));
}
A({ id: 'ix-turret', name: '太空砲台', cat: '街機', theme: 'ice', hue: true, interactive: true,
  desc: '移動滑鼠瞄準、點一下開砲，把落下的隕石打碎',
  params: { turrets: 1, rate: 1, split: 2 },
  variants: [
    { id: 'twin', name: '雙砲台', theme: 'cyber', desc: '兩座砲台一起朝游標開火，隕石更多更快', params: { turrets: 2, rate: 1.7, fast: 1.25, split: 2 } },
  ],
  init(s, f) { tuInit(s, f); },
  frame(s, f) { tuFrame(s, f); },
});

/* ════════════ 2. 飛彈防衛 ════════════ */
function msCity(cw, ch) {
  const hh = new Array(cw);
  let x = 0;
  while (x < cw) {
    const w = rint(1, Math.max(1, Math.round(cw / 4))), h = rint(Math.max(1, ch), ch * 2);
    for (let k = 0; k < w && x < cw; k++, x++) hh[x] = x === 0 || x === cw - 1 ? Math.max(1, h - 1) : h;
  }
  const out = [];
  for (let r = 0; r < ch; r++) {
    const lo = 2 * (ch - 1 - r);
    let row = '';
    for (let c = 0; c < cw; c++) row += hh[c] > lo + 1 ? (hh[c] > lo + 3 && c % 2 && hash(c * 3 + cw, r) < 0.5 ? '▪' : '█') : hh[c] > lo ? '▄' : ' ';
    out.push(row);
  }
  return out;
}
function msInit(s, f) {
  const { cols, rows, p } = f, A = f.aspect, u = unitOf(f);
  s.A = A; s.u = u; s.t = 0;
  s.gy = rows - Math.max(2, Math.round(rows * 0.075));
  s.R = Math.max(3.2, 3.1 * u);
  s.vi = Math.max(cols * 0.5, rows * A * 1.05);
  s.mh = Math.max(1, Math.round(0.6 * u));
  const nb = p.bases || 3, bx = nb === 3 ? [0.07, 0.5, 0.93] : [0.5];
  s.bases = bx.map(t => ({ x: Math.round(t * cols), ammo: 0, alive: true }));
  const cx = [];
  if (nb === 3) for (let k = 1; k <= 3; k++) { cx.push(lerp(0.07, 0.5, k / 4)); cx.push(lerp(0.5, 0.93, k / 4)); }
  else { const h = Math.max(1, Math.round((p.cities || 4) / 2)); for (let k = 1; k <= h; k++) { cx.push(lerp(0.05, 0.5, k / (h + 1))); cx.push(lerp(0.5, 0.95, k / (h + 1))); } }
  cx.sort((a, b) => a - b);
  s.cw = clamp(Math.round(4.6 * u), 5, 42); s.ch = clamp(Math.round(1.6 * u), 2, 16);
  s.cities = cx.map(t => ({ x: Math.round(t * cols - s.cw / 2), alive: true, bmp: msCity(s.cw, s.ch) }));
  // 地面高度：發射台底下有小土丘
  s.hm = new Int16Array(cols);
  const mw = Math.max(4, 3.6 * u);
  for (let x = 0; x < cols; x++) { let h = 0; for (const b of s.bases) h = Math.max(h, Math.round(s.mh * smooth(clamp(1 - Math.abs(x + 0.5 - b.x) / mw, 0, 1)) + 0.2)); s.hm[x] = h; }
  s.stars = [];
  const ns = Math.round((cols * s.gy) / 60);
  for (let k = 0; k < ns; k++) s.stars.push({ x: rnd(0, cols), y: rnd(0, s.gy * 0.85), z: Math.random(), ph: rnd(0, TAU) });
  s.ms = []; s.ic = []; s.ex = []; s.parts = []; s.texts = [];
  s.ai = mkAi(f); s.I = mkI(f); s.best = bestGet('missile' + nb);
  msNew(s, f);
}
function msNew(s, f) {
  s.score = 0; s.wave = 0; s.mine = false; s.dry = 0;
  for (const c of s.cities) { c.alive = true; c.bmp = msCity(s.cw, s.ch); }
  s.ms.length = 0; s.ic.length = 0;
  msWave(s, f);
}
function msWave(s, f) {
  const { cols, rows, p } = f;
  s.wave++;
  s.left = Math.min(50, Math.round((6 + 3 * s.wave) * clamp(cols / 220, 0.6, 1.4)));
  s.spawnT = 0.4; s.phase = 'play'; s.msg = 'WAVE ' + s.wave; s.msgT = 1.8;
  s.mv = rows * s.A * (0.055 + 0.007 * Math.min(s.wave, 12)) * (p.speed || 1);
  s.mirv = Math.min(0.35, 0.08 * (s.wave - 1));
  for (const b of s.bases) { b.alive = true; b.ammo = p.ammo || 10; }
}
function msSpawn(s, f, x0, y0) {
  const tg = [];
  for (const c of s.cities) if (c.alive) tg.push(c.x + s.cw / 2, s.gy - 1);
  for (const b of s.bases) if (b.alive && Math.random() < 0.6) tg.push(b.x, s.gy - s.mh - 1);
  if (!tg.length) return;
  const k = rint(0, tg.length / 2 - 1) * 2;
  s.ms.push({ x0, y0, x: x0, y: y0, tx: tg[k] + rnd(-1, 1), ty: tg[k + 1], v: s.mv * rnd(0.85, 1.15), split: Math.random() < s.mirv ? rnd(0.3, 0.55) * s.gy : 0, cov: 0, dead: false });
}
const msFireY = s => s.gy - s.mh - 2;
function msFire(s, f, x, y) {
  const tx = clamp(x, 0.5, f.cols - 0.5), ty = clamp(y, 1, s.gy - s.mh - 3);
  let b = null, bd = 1e9;
  for (const q of s.bases) if (q.alive && q.ammo > 0) { const d = Math.abs(q.x - tx); if (d < bd) { bd = d; b = q; } }
  if (!b) { s.dry = 1.2; return false; }
  b.ammo--;
  s.ic.push({ x0: b.x, y0: msFireY(s), x: b.x, y: msFireY(s), tx, ty, dead: false });
  return true;
}
// 順著方向的線條字元（dy 已經乘過 A）
function dirCh(dx, dy) {
  const m = ((Math.atan2(dy, dx) % Math.PI) + Math.PI) % Math.PI;
  return m < Math.PI / 8 || m > (Math.PI * 7) / 8 ? '─' : m < (Math.PI * 3) / 8 ? '╲' : m < (Math.PI * 5) / 8 ? '│' : '╱';
}
// 飛彈尾跡：較舊的一段是暗點，靠近彈頭的一段（最多 rec 欄寬、約四成）用順著飛行方向的線條，彈頭用 ◆
function msTrail(g, q, A, rec, cOld, cNew, head, cHead) {
  const dx = q.x - q.x0, dy = (q.y - q.y0) * A, L = Math.hypot(dx, dy);
  if (L > 0.5) {
    const t = Math.max(0, 1 - Math.min(rec, L * 0.4) / L), mx = lerp(q.x0, q.x, t), my = lerp(q.y0, q.y, t);
    if (t > 0) g.line(q.x0, q.y0, mx, my, '·', cOld);
    g.line(mx, my, q.x, q.y, dirCh(dx, dy), cNew);
  }
  g.set(q.x, q.y, head, cHead);
}
function msBoom(s, x, y, R, kind) { if (s.ex.length < 80) s.ex.push({ x, y, R, t: 0, r: 0, kind }); }
function msImpact(s, f, q) {
  q.dead = true;
  msBoom(s, q.tx, q.ty, s.R * 0.7, 'hit');
  burst(s.parts, q.tx, q.ty, 10, s.R * 3, 15, 1, 0);
  for (const c of s.cities) if (c.alive && Math.abs(c.x + s.cw / 2 - q.tx) < s.cw * 0.6 + 1) c.alive = false;
  for (const b of s.bases) if (b.alive && Math.abs(b.x - q.tx) < 3) { b.alive = false; b.ammo = 0; }
}
function msAi(s, f, ai) {
  const A = s.A, dt = f.dt, cols = f.cols;
  ai.cool -= dt; ai.react -= dt;
  if (s.phase !== 'play' || !s.ms.length) { wander(s, f, ai, 0.4); return; }
  let q = null, best = 1e9;
  for (const m of s.ms) {
    if (m.dead || m.cov > 0 || m.y < f.rows * 0.06) continue;
    const tti = Math.hypot(m.tx - m.x, (m.ty - m.y) * A) / m.v;
    if (tti < best) { best = tti; q = m; }
  }
  if (!q) { const m = s.ms[0]; seek(ai, m.x, Math.max(m.y, f.rows * 0.2) + f.rows * 0.1, dt, cols * 0.3, A); return; }
  if (ai.tgt !== q) {
    ai.tgt = q; ai.react = rnd(0.08, 0.25);
    ai.ex = gauss() * s.R * 0.22; ai.ey = (gauss() * s.R * 0.22) / A;
    if (Math.random() < 0.1) ai.ex += (Math.random() < 0.5 ? -1 : 1) * s.R * rnd(1, 1.5);
  }
  const dx = q.tx - q.x, dy = (q.ty - q.y) * A, d = Math.hypot(dx, dy) || 1, ux = (dx / d) * q.v, uy = ((dy / d) * q.v) / A;
  const vmax = Math.max(60, cols * 0.8), fy = msFireY(s);
  let px = q.x, py = q.y, b = null;
  for (let it = 0; it < 4; it++) {
    b = null; let bd = 1e9;
    for (const o of s.bases) if (o.alive && o.ammo > 0) { const e = Math.abs(o.x - px); if (e < bd) { bd = e; b = o; } }
    if (!b) break;
    const tc = (Math.hypot(px - ai.x, (py - ai.y) * A) / vmax) * 0.7 + Math.max(0, ai.react), tf = Math.hypot(px - b.x, (py - fy) * A) / s.vi;
    const T = Math.min(tc + tf + 0.2, d / q.v);
    px = q.x + ux * T; py = q.y + uy * T;
  }
  if (!b) { wander(s, f, ai, 0.4); return; }
  py = Math.min(py, s.gy - s.mh - 3);
  const dd = seek(ai, px + ai.ex, py + ai.ey, dt, vmax, A, ux, uy * A);
  if (dd < Math.max(1.2, s.R * 0.2) && ai.cool <= 0 && ai.react <= 0) {
    ai.clicks.push({ x: ai.x, y: ai.y, button: 0 });
    ai.cool = rnd(0.2, 0.5);
    const tf = Math.hypot(ai.x - b.x, (ai.y - fy) * A) / s.vi + 0.3;
    for (const m of s.ms) {
      const mdx = m.tx - m.x, mdy = (m.ty - m.y) * A, md = Math.hypot(mdx, mdy) || 1;
      const mx = m.x + (mdx / md) * m.v * tf, my = m.y + ((mdy / md) * m.v * tf) / A;
      if (m === q || Math.hypot(mx - ai.x, (my - ai.y) * A) < s.R * 0.7) m.cov = tf + 1.3;
    }
  }
}
function msFrame(s, f) {
  const { g, cols, rows, C, H, p } = f, A = s.A, dt = f.dt;
  const I = ixIn(s, f, msAi);
  ixLeft(s, I, s.score, 'missile' + (p.bases || 3));
  if (I.user) s.mine = true;
  if (I.taken && (I.aiT > 15 || s.phase === 'over')) {
    for (const q of s.ms) msBoom(s, q.x, q.y, s.R * 0.35, 'pop');
    s.ex = s.ex.filter(e => e.kind === 'pop');
    msNew(s, f);
  }
  s.t += dt;
  if (s.msgT > 0) s.msgT -= dt;
  if (s.dry > 0) s.dry -= dt;
  // 點擊：從最近、還有彈藥的發射台射出攔截彈，飛到點擊位置爆炸
  if (s.phase === 'play') for (const c of I.clicks) msFire(s, f, c.x, c.y);
  else if (s.phase === 'over' && s.oT > 1.5 && I.clicks.length) msNew(s, f);
  // 來襲飛彈
  if (s.phase === 'play' && s.left > 0 && s.msgT < 1) {
    s.spawnT -= dt;
    if (s.spawnT <= 0) {
      const n = Math.min(s.left, Math.random() < 0.25 ? rint(2, 3) : 1);
      for (let k = 0; k < n; k++) { msSpawn(s, f, rnd(0, cols), 0); s.left--; }
      s.spawnT = rnd(0.6, 1.9) / (1 + s.wave * 0.1) / clamp(cols / 220, 1, 1.4);   // 寬畫面飛彈也來得密一點
    }
  }
  const nm = s.ms.length;
  for (let k = 0; k < nm; k++) {
    const q = s.ms[k];
    if (q.dead) continue;
    const dx = q.tx - q.x, dy = (q.ty - q.y) * A, d = Math.hypot(dx, dy), st = q.v * dt;
    if (q.cov > 0) q.cov -= dt;
    if (d <= st) { msImpact(s, f, q); continue; }
    q.x += (dx / d) * st; q.y += ((dy / d) * st) / A;
    if (q.split && q.y >= q.split) {
      q.split = 0;
      const n = rint(1, 2);
      for (let j = 0; j < n; j++) msSpawn(s, f, q.x, q.y);
    }
  }
  for (const q of s.ic) {
    const dx = q.tx - q.x, dy = (q.ty - q.y) * A, d = Math.hypot(dx, dy), st = s.vi * dt;
    if (d <= st) { q.dead = true; msBoom(s, q.tx, q.ty, s.R, 'ic'); continue; }
    q.x += (dx / d) * st; q.y += ((dy / d) * st) / A;
  }
  for (const e of s.ex) {
    e.t += dt;
    e.r = e.t < 0.4 ? (e.t / 0.4) * e.R : e.t < 0.85 ? e.R : Math.max(0, e.R * (1 - (e.t - 0.85) / 0.45));
    if (e.t > 1.3) { e.dead = true; continue; }
    if (e.kind === 'hit' || e.kind === 'pop') continue;
    for (const q of s.ms) {
      if (q.dead || Math.hypot(q.x - e.x, (q.y - e.y) * A) >= e.r) continue;
      q.dead = true;
      if (s.phase === 'play') { const pts = 25 * Math.ceil(s.wave / 2); s.score += pts; addText(s.texts, q.x, q.y - 1, '+' + pts, 50, 0.8); }
      msBoom(s, q.x, q.y, s.R * 0.55, 'chain');
    }
  }
  sweep(s.ms); sweep(s.ic); sweep(s.ex);
  stepParts(s.parts, dt, A);
  // 波次流程
  if (s.phase === 'play') {
    if (!s.cities.some(c => c.alive)) {
      s.phase = 'over'; s.oT = 0;
      if (s.mine && s.score > s.best) { s.best = s.score; bestPut('missile' + (p.bases || 3), s.best); }
    } else if (s.left <= 0 && !s.ms.length && !s.ic.length && !s.ex.some(e => e.kind !== 'pop')) {
      const nc = s.cities.filter(c => c.alive).length, na = s.bases.reduce((a, b) => a + (b.alive ? b.ammo : 0), 0);
      s.tally = [nc, nc * 100, na, na * 5]; s.score += nc * 100 + na * 5;
      s.phase = 'tally'; s.tT = 0;
    }
  } else if (s.phase === 'tally') {
    s.tT += dt;
    if (s.tT > 3) {
      if (s.wave % 2 === 0) { const dead = s.cities.filter(c => !c.alive); if (dead.length) { const c = pick(dead); c.alive = true; c.bmp = msCity(s.cw, s.ch); } }
      msWave(s, f);
    }
  } else if (s.phase === 'over') { s.oT += dt; if (s.oT > 5.5) msNew(s, f); }
  // ── 繪圖 ──
  for (const st of s.stars) { const b = 0.5 + 0.5 * Math.sin(s.t * (0.5 + st.z) + st.ph); if (b > 0.25) g.set(st.x, st.y, st.z > 0.85 ? '·' : '.', C(0.07 + st.z * 0.2 * b)); }
  const rec = Math.max(6, 14 * s.u);
  for (const q of s.ms) msTrail(g, q, A, rec, H(345, 0.32), H(350, 0.62), '◆', H(5, 1));
  for (const q of s.ic) {
    msTrail(g, q, A, rec, H(190, 0.32), H(190, 0.62), '◆', H(185, 1));
    if ((s.t * 6) % 2 < 1.4) g.set(q.tx, q.ty, '×', H(190, 0.85));
  }
  for (const e of s.ex) {
    const R = e.r;
    if (R < 0.3) continue;
    const ry = R / A, fade = e.t > 0.85 ? 1 - (e.t - 0.85) / 0.45 : 1, hue0 = e.kind === 'hit' ? 8 : e.kind === 'pop' ? 200 : 40;
    for (let y = Math.floor(e.y - ry); y <= Math.floor(e.y + ry); y++) for (let x = Math.floor(e.x - R); x <= Math.floor(e.x + R); x++) {
      const d = Math.hypot(x + 0.5 - e.x, (y + 0.5 - e.y) * A) / R;
      if (d > 1) continue;
      const n = hash(x * 7 + ((s.t * 10) | 0), y);
      g.set(x, y, d < 0.45 ? '█' : d < 0.7 ? (n > 0.5 ? '▓' : '█') : d < 0.88 ? '▒' : '░', H(hue0 + n * 25 - d * 25 + e.t * 20, (1 - d * 0.45) * (0.4 + 0.6 * fade)));
    }
  }
  // 地面、城市、發射台
  for (let x = 0; x < cols; x++) {
    const top = s.gy - s.hm[x];
    for (let y = Math.max(0, top); y < rows; y++) {
      if (y <= s.gy) g.setI(y * cols + x, y === s.gy && top === s.gy ? '▀' : '█', C(0.36));
      else g.setI(y * cols + x, hash(x, y) < 0.3 ? '▒' : '░', C(0.14 + hash(y, x) * 0.06));
    }
  }
  for (const c of s.cities) {
    if (c.alive) {
      for (let r = 0; r < s.ch; r++) {
        const row = c.bmp[r], y = s.gy - s.ch + r;
        for (let k = 0; k < row.length; k++) { const ch = row[k]; if (ch !== ' ') g.set(c.x + k, y, ch, ch === '▪' ? H(50, 0.8) : H(195, 0.5 + (r / s.ch) * 0.15)); }
      }
    } else for (let k = 0; k < s.cw; k++) g.set(c.x + k, s.gy - 1, '▁▂▃'[(hash(k, c.x) * 3) | 0], C(0.3));
  }
  const pipY = Math.min(s.gy + 1, rows - 2);
  for (const b of s.bases) {
    const y = s.gy - s.mh - 1;
    if (b.alive) {
      g.set(b.x, y, '▲', b.ammo ? C(0.9) : C(0.35));
      g.set(b.x - 1, y, '◢', C(0.6)); g.set(b.x + 1, y, '◣', C(0.6));
      if (b.ammo > 12) txt(g, b.x - 1, pipY, String(b.ammo), H(50, 0.85));
      else for (let k = 0; k < b.ammo; k++) g.set(b.x - Math.floor(b.ammo / 2) + k, pipY, '▮', H(50, 0.8));
      if (!b.ammo) txt(g, b.x - 1, pipY, 'OUT', C(0.4));
    } else { g.set(b.x - 1, y, '▂', C(0.3)); g.set(b.x, y, '▃', C(0.3)); g.set(b.x + 1, y, '▁', C(0.3)); }
  }
  drawParts(g, s.parts, H, '·•*');
  drawTexts(g, s.texts, dt, H, f);
  if (s.phase !== 'over') crossHair(g, I.x, I.y, I.user ? H(190, 0.95) : H(190, 0.6), rows >= 50);
  const hp = [[tr(f, '第 ' + s.wave + ' 波', 'Wave ' + s.wave), C(0.5)], [tr(f, '分數 ', 'Score ') + s.score, C(0.85)]];
  if (s.dry > 0) hp.unshift([tr(f, '彈藥用完', 'Out of ammo'), H(0, 0.85)]);
  hud(g, hp);
  if (s.phase === 'play' && s.msgT > 0) bigText(g, s.msg, cols / 2, rows * 0.33, cols * 0.4, rows * 0.13, C(0.85));
  else if (s.phase === 'tally') panel(g, f, [[tr(f, '第 ' + s.wave + ' 波守住了', 'Wave ' + s.wave + ' defended'), C(0.9)], [tr(f, '城市 ×' + s.tally[0] + '　+', 'Cities ×' + s.tally[0] + '  +') + s.tally[1], H(195, 0.8)], [tr(f, '剩餘彈藥 ×' + s.tally[2] + '　+', 'Ammo left ×' + s.tally[2] + '  +') + s.tally[3], H(50, 0.8)]], rows * 0.38, C(0.5));
  else if (s.phase === 'over') {
    const by = bigText(g, 'THE END', cols / 2, rows * 0.35, cols * 0.55, rows * 0.16, H(5, 0.85));
    ctextAt(g, cols / 2, by + 1, tr(f, '撐到第 ' + s.wave + ' 波　', 'Survived to wave ' + s.wave + '  ') + scoreBest(f, s), C(0.7), f.lang === 'en');
  }
  if (!I.user) hint(g, f, tr(f, '點一下發射攔截飛彈，保護城市', 'Click to launch interceptors and protect the cities'));
}
A({ id: 'ix-missile', name: '飛彈防衛', cat: '街機', theme: 'synth', hue: true, interactive: true,
  desc: '點一下設定爆炸點，攔截彈從最近的發射台射出，保護城市',
  params: { bases: 3, cities: 6, ammo: 10, speed: 1 },
  variants: [
    { id: 'solo', name: '孤城死守', theme: 'fire', desc: '只剩中央一座發射台和四座城市，飛彈更快', params: { bases: 1, cities: 4, ammo: 24, speed: 1.3 } },
  ],
  init(s, f) { msInit(s, f); },
  frame(s, f) { msFrame(s, f); },
});

/* ════════════ 3. 射擊遊樂場 ════════════ */
// 點陣圖：每個字母是一種顏色（[色相, 亮度]，色相 -1 表示用主題色），'.' 透明
const GL_ART = {
  duck: { pts: 10, pal: { Y: [48, 0.74], O: [22, 0.66], W: [40, 0.5] }, rows: [
    '.......YYY....',
    '......YYYYY...',
    '......YY.YYOOO',
    'Y......YYYY...',
    'YY...YYYYYYYY.',
    'YYYYYYWWWWYYY.',
    '.YYYYYYWWWYY..',
    '...YYYYYYYY...'] },
  bull: { pts: 20, pal: { W: [-1, 0.95], R: [355, 0.62] }, rows: [
    '..WWWWW..',
    '.WRRRRRW.',
    'WRWWWWWRW',
    'WRWRRRWRW',
    'WRWRRRWRW',
    'WRWWWWWRW',
    '.WRRRRRW.',
    '..WWWWW..'] },
  // 最小尺寸（每個像素 1 欄 × 半格）時一格只能有一種顏色，所以顏色要以「兩列一組」對齊，圈圈才看得出來
  bull1: { pts: 20, name: 'bull', pal: { W: [-1, 0.95], R: [355, 0.62] }, rows: [
    '..RRRRR..',
    '.WRRRRRW.',
    'WRWRRRWRW',
    'WRWRRRWRW',
    'WRWRRRWRW',
    'WRWRRRWRW',
    '.WRRRRRW.',
    '..RRRRR..'] },
  star: { pts: 50, pal: { S: [50, 0.9], s: [40, 0.62] }, rows: [
    '....S....',
    '...SSS...',
    'SSSSSSSSS',
    '.SSSSSSS.',
    '..SSsSS..',
    '.SSSSSSS.',
    '.SSS.SSS.',
    'SS.....SS'] },
};
const GL_SPR = {};
for (const k in GL_ART) {
  const d = GL_ART[k], h = d.rows.length, w = Math.max(...d.rows.map(r => r.length)), keys = Object.keys(d.pal), px = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = keys.indexOf(d.rows[y][x] || '.'); px[y * w + x] = i >= 0 ? i + 1 : 0; }
  GL_SPR[k] = { w, h, px, pal: keys.map(q => d.pal[q]), pts: d.pts, name: d.name || k };
}
// 半格點陣貼圖：每個像素 k 欄寬 × k 個半格高；sq 是被打中時往下壓扁的比例
function glBlit(g, S, x0, y0, k, flip, cols, sq) {
  x0 = Math.round(x0);
  const H2 = S.h * k, base2 = Math.round(y0 * 2), vis = Math.max(1, Math.round(H2 * sq)), top2 = base2 + H2 - vis;
  for (let h2 = top2 - (top2 & 1); h2 < top2 + vis; h2 += 2) {
    const cy = h2 >> 1;
    if (cy < 0 || cy >= g.rows) continue;
    const ra = h2 >= top2 ? Math.floor(((h2 - top2) * S.h) / vis) : -1, rb = h2 + 1 < top2 + vis ? Math.floor(((h2 + 1 - top2) * S.h) / vis) : -1;
    for (let cx = 0; cx < S.w * k; cx++) {
      const X = x0 + cx;
      if (X < 0 || X >= g.cols) continue;
      const sx = flip ? S.w - 1 - Math.floor(cx / k) : Math.floor(cx / k);
      const a = ra >= 0 ? S.px[ra * S.w + sx] : 0, b = rb >= 0 ? S.px[rb * S.w + sx] : 0;
      if (!a && !b) continue;
      g.setI(cy * g.cols + X, a && b ? '█' : a ? '▀' : '▄', cols[(a || b) - 1]);
    }
  }
}
function glPix(S, k, flip, lx, lh) {
  const px = Math.floor(lx / k), py = Math.floor(lh / k);
  if (px < 0 || py < 0 || px >= S.w || py >= S.h) return 0;
  return S.px[py * S.w + (flip ? S.w - 1 - px : px)];
}
function glInit(s, f) {
  const { cols, rows, p } = f, A = f.aspect, u = unitOf(f);
  s.A = A; s.u = u; s.t = 0;
  s.ah = Math.max(3, Math.round(rows * 0.045));   // 遮陽棚別太厚：桌面圖示的白字就在最上面
  s.cy = rows - clamp(Math.round(rows * 0.08), 3, 12);
  s.cw = Math.max(2, Math.round(cols * 0.018));
  s.L = s.cw; s.Rr = cols - s.cw;
  const top = s.ah, bot = s.cy - 1;
  // 四排標靶要夠高才放得下；畫面太矮（縮圖）時退回三排
  const kinds = p.rails === 4 && (bot - top) / 4 >= 5.8 ? ['star', 'duck', 'bull', 'duck'] : ['star', 'bull', 'duck'], sp = (bot - top) / kinds.length;
  s.k = Math.max(1, Math.min(Math.floor((sp * 2 * 0.72) / 8), Math.floor((cols * 0.14) / 14)));
  s.sw = Math.max(4, Math.round(cols / 24));
  s.rails = kinds.map((kind, i) => {
    const S = GL_SPR[kind === 'bull' && s.k === 1 ? 'bull1' : kind], w = S.w * s.k, y = Math.round(top + sp * (i + 1)) - 1;
    const stick = clamp(Math.round(sp - (S.h * s.k) / 2 - 1.5), 1, Math.max(1, Math.round(1.6 * s.k)));
    const v = cols * (kind === 'star' ? 0.1 : kind === 'bull' ? 0.07 : 0.05) * (1 + 0.1 * i);
    const loop = s.Rr - s.L + 2 * w + 2, gap = w * (kind === 'star' ? 3.4 : kind === 'bull' ? 2.5 : 1.9), n = Math.max(2, Math.floor(loop / gap)), spc = loop / n;
    const ts = [];
    for (let j = 0; j < n; j++) ts.push({ x: s.L - w + j * spc + rnd(-0.1, 0.1) * spc, hitT: -1, down: false });
    return { kind, S, w, y, stick, v, dir: (kinds.length - 1 - i) % 2 ? -1 : 1, loop, ts, top: y - stick - (S.h * s.k) / 2 };
  });
  s.holes = []; s.parts = []; s.texts = [];
  s.ai = mkAi(f); s.I = mkI(f); s.best = bestGet('gallery' + (p.timer ? 't' : ''));
  s.total = 0; s.round = 0;
  glRound(s, f, false);
}
function glRound(s, f, next) {
  const p = f.p;
  if (!next) { s.round = 0; s.total = 0; s.mine = false; }
  s.round++;
  s.ammo = p.ammo || 12; s.shots = 0; s.hits = 0; s.rscore = 0; s.phase = 'play'; s.endT = 0; s.resT = 0; s.flash = 0;
  s.goal = Math.round((s.ammo * (p.timer ? 7.5 : 9) * (1 + 0.2 * (s.round - 1))) / 10) * 10;
  s.timeLeft = p.timer || 0;
  s.spd = (p.speed || 1) * (1 + 0.12 * (s.round - 1));
  for (const R of s.rails) for (const t of R.ts) { t.hitT = -1; t.down = false; }
  s.msg = '第 ' + s.round + ' 輪　目標 ' + s.goal + ' 分'; s.msgEn = 'Round ' + s.round + '  Goal ' + s.goal + ' pts'; s.msgT = 2;
}
function glShoot(s, f, x, y) {
  if (s.phase !== 'play' || s.ammo <= 0) return false;
  s.ammo--; s.shots++; s.flash = 0.1;
  for (let ri = s.rails.length - 1; ri >= 0; ri--) {
    const R = s.rails[ri], S = R.S, k = s.k;
    for (const t of R.ts) {
      if (t.down || t.hitT >= 0) continue;
      const lx = x - Math.round(t.x), lh = (y - Math.round(R.top * 2) / 2) * 2;
      if (lx < -1 || lx > R.w + 1 || lh < -1 || lh > S.h * k + 1 || x < s.L || x >= s.Rr) continue;
      const tol = Math.max(0.6, k * 0.5);
      if (glPix(S, k, R.dir < 0, lx, lh) || glPix(S, k, R.dir < 0, lx - tol, lh) || glPix(S, k, R.dir < 0, lx + tol, lh) || glPix(S, k, R.dir < 0, lx, lh - tol) || glPix(S, k, R.dir < 0, lx, lh + tol)) {
        t.hitT = 0; s.hits++; s.rscore += S.pts; s.total += S.pts;
        burst(s.parts, x, y, 8 + S.pts / 5, 10 + s.u * 4, S.name === 'duck' ? 48 : S.name === 'star' ? 50 : 355, 0.7, 0);
        addText(s.texts, Math.round(t.x) + R.w / 2, R.top - 1, '+' + S.pts, S.name === 'star' ? 50 : 30, 0.9);
        return true;
      }
    }
  }
  if (s.holes.length > 28) s.holes.shift();
  s.holes.push({ x, y, t: 0 });
  return false;
}
function glAi(s, f, ai) {
  const A = s.A, dt = f.dt, cols = f.cols;
  ai.cool -= dt; ai.react -= dt;
  if (s.phase !== 'play' || s.ammo <= 0) { wander(s, f, ai, 0.5); return; }
  let tg = ai.tgt;
  const vis = (R, t) => t.x > s.L + 1 && t.x + R.w < s.Rr - 1;
  if (tg && (tg.t.down || tg.t.hitT >= 0 || !vis(tg.R, tg.t))) tg = ai.tgt = null;
  if (!tg) {
    let best = -1e9;
    for (const R of s.rails) for (const t of R.ts) {
      if (t.down || t.hitT >= 0 || !vis(R, t)) continue;
      const room = R.dir > 0 ? s.Rr - (t.x + R.w) : t.x - s.L, stay = room / (R.v * s.spd);
      if (stay < 0.6) continue;
      const cx = t.x + R.w / 2, cy = R.top + (R.S.h * s.k) / 4, d = Math.hypot(cx - ai.x, (cy - ai.y) * A);
      const v = Math.log(R.S.pts) * 0.6 - (d / cols) * 3 + Math.random() * 1.2;
      if (v > best) { best = v; tg = { R, t }; }
    }
    if (tg) {
      const shaky = 1 + (s.spd - 1) * 0.7;   // 標靶越快越難瞄
      ai.tgt = tg; ai.react = rnd(0.15, 0.35);
      ai.ex = gauss() * tg.R.w * 0.13 * shaky; ai.ey = gauss() * 0.25 * shaky;
      if (Math.random() < 0.1 * shaky) ai.ex = (Math.random() < 0.5 ? -1 : 1) * tg.R.w * rnd(0.5, 0.7);
    }
  }
  if (!tg) { wander(s, f, ai, 0.5); return; }
  const R = tg.R, vx = R.dir * R.v * s.spd;
  const tx = tg.t.x + R.w / 2 + vx * 0.08 + ai.ex, ty = R.top + (R.S.h * s.k) / 4 * (R.kind === 'duck' ? 1.25 : 1) + ai.ey;
  seek(ai, tx, ty, dt, Math.max(50, cols * 0.7), A, vx, 0);
  if (ai.cool <= 0 && ai.react <= 0 && Math.abs(ai.x - tx) < R.w * 0.1 + 0.6 && Math.abs(ai.y - ty) < 0.6) {
    ai.clicks.push({ x: ai.x, y: ai.y, button: 0 });
    // 示範時慢慢打（每一輪久一點，畫面不會一直跳結算）；限時版要趕時間，間隔短一些
    ai.cool = f.p.timer ? rnd(0.45, 1.0) : rnd(0.8, 1.6); ai.tgt = null;
  }
}
function glFrame(s, f) {
  const { g, cols, rows, C, H, p } = f, A = s.A, dt = f.dt;
  const I = ixIn(s, f, glAi);
  ixLeft(s, I, s.total, 'gallery' + (p.timer ? 't' : ''));
  if (I.user) s.mine = true;
  if (I.taken && (I.aiT > 15 || s.phase === 'result')) glRound(s, f, false);
  s.t += dt;
  if (s.msgT > 0) s.msgT -= dt;
  if (s.flash > 0) s.flash -= dt;
  if (s.phase === 'play') {
    for (const c of I.clicks) glShoot(s, f, c.x, c.y);
    if (p.timer) { s.timeLeft -= dt; if (s.timeLeft <= 0) { s.timeLeft = 0; s.ammo = 0; } }
    if (s.ammo <= 0) { s.endT += dt; if (s.endT > 0.8) { s.phase = 'result'; s.resT = 0; s.pass = s.rscore >= s.goal; if (!s.pass && s.mine && s.total > s.best) { s.best = s.total; bestPut('gallery' + (p.timer ? 't' : ''), s.best); } } }
  } else {
    s.resT += dt;
    if (s.resT > (s.pass ? 2.2 : 4.5) || (s.resT > 1.2 && I.clicks.length)) glRound(s, f, s.pass);
  }
  // 標靶移動、繞回來時重新立起
  for (const R of s.rails) {
    const v = R.dir * R.v * s.spd * dt;
    for (const t of R.ts) {
      t.x += v;
      let wrap = false;
      if (R.dir > 0 && t.x > s.Rr) { t.x -= R.loop; wrap = true; }
      if (R.dir < 0 && t.x + R.w < s.L) { t.x += R.loop; wrap = true; }
      if (wrap) { t.down = false; t.hitT = -1; }
      if (t.hitT >= 0) { t.hitT += dt; if (t.hitT > 0.3) { t.down = true; t.hitT = -1; } }
    }
  }
  stepParts(s.parts, dt, A);
  // ── 繪圖 ──
  const wood = H(28, 0.32), woodD = H(25, 0.16);
  // 後牆：淡淡的菱格點
  for (let y = s.ah + 1, r = 0; y < s.cy; y += 3, r++) for (let x = s.L + 2 + (r % 2) * 4; x < s.Rr; x += 8) g.set(x, y, '·', C(0.13));
  for (const R of s.rails) {
    const pal = R.S.pal.map(q => (q[0] < 0 ? C(q[1]) : H(q[0], q[1])));
    for (let x = s.L; x < s.Rr; x++) g.set(x, R.y, '═', C(0.3));
    for (const t of R.ts) {
      const X = Math.round(t.x), mid = X + Math.floor(R.w / 2);
      if (X > s.Rr || X + R.w < s.L) continue;
      for (let y = Math.ceil(R.top + (R.S.h * s.k) / 2); y < R.y; y++) g.set(mid, y, '│', wood);
      if (t.down) { g.set(mid, R.y - 1, '╻', wood); continue; }
      glBlit(g, R.S, X, R.top, s.k, R.dir < 0, pal, t.hitT >= 0 ? 1 - t.hitT / 0.3 : 1);
    }
  }
  for (let k = s.holes.length - 1; k >= 0; k--) { const h = s.holes[k]; h.t += dt; if (h.t > 6) { s.holes.splice(k, 1); continue; } g.set(h.x, h.y, '•', C(0.28 * (1 - h.t / 6) + 0.06)); }
  drawParts(g, s.parts, H, '·+✦');
  drawTexts(g, s.texts, dt, H, f);
  // 布幕
  for (let y = s.ah; y < s.cy; y++) for (let x = 0; x < s.cw; x++) {
    const fold = 0.5 + 0.5 * Math.cos((x / s.cw) * Math.PI * 2 + y * 0.05);
    g.set(x, y, fold > 0.5 ? '█' : '▓', H(352, 0.22 + 0.16 * fold));
    g.set(cols - 1 - x, y, fold > 0.5 ? '█' : '▓', H(352, 0.22 + 0.16 * fold));
  }
  // 條紋遮陽棚與燈泡
  for (let y = 0; y < s.ah; y++) for (let x = 0; x < cols; x++) {
    const st = Math.floor(x / s.sw) % 2, px = x % s.sw, col = st ? H(355, 0.3) : C(0.5);
    if (y < s.ah - 1) g.setI(y * cols + x, y === 0 ? '▓' : '█', col);
    else if (px > 0 && px < s.sw - 1) g.setI(y * cols + x, '▀', col);
  }
  const party = s.phase === 'result' && s.pass;   // 過關時燈泡跑快一點
  for (let i = 1, x = s.sw; x < cols; i++, x += s.sw) g.set(x, s.ah - 1, '●', H((i * 47) % 360, 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(s.t * (party ? 9 : 2.2) - i * 0.9))));
  // 櫃台
  for (let y = s.cy; y < rows; y++) for (let x = 0; x < cols; x++) g.setI(y * cols + x, y === s.cy ? '▄' : hash(x, y) < 0.35 ? '▒' : '░', y === s.cy ? wood : woodD);
  if (s.cy + 1 < rows - 1) { const sg = tr(f, '★ 射擊遊樂場 ★', '★ SHOOTING GALLERY ★'), w = g.textW(sg); fillRect(g, (cols - w) / 2 - 1, s.cy + 1, w + 2, 1, ' ', wood); ctextAt(g, cols / 2, s.cy + 1, sg, H(45, 0.8)); }
  if (s.phase === 'play') crossHair(g, I.x, I.y, s.flash > 0 ? H(50, 1) : I.user ? H(0, 0.95) : H(0, 0.7), rows >= 50);
  // 窄畫面 HUD 精簡：不寫第幾輪（開場橫幅已經講過），子彈改成數字
  const max = p.ammo || 12, narrow = cols < 160;
  const hp = [[tr(f, '目標 ', 'Goal ') + s.goal, C(0.55)], [tr(f, '分數 ', 'Score ') + s.rscore, s.rscore >= s.goal ? H(120, 0.85) : C(0.9)], narrow ? [tr(f, '彈 ', 'Ammo ') + s.ammo + '/' + max, H(45, 0.85)] : ['▮'.repeat(s.ammo) + '▯'.repeat(Math.max(0, max - s.ammo)), H(45, 0.85)]];
  if (!narrow) hp.unshift([tr(f, '第 ' + s.round + ' 輪', 'Round ' + s.round), C(0.55)]);
  if (p.timer) hp.splice(hp.length - 2, 0, [tr(f, '剩 ' + Math.ceil(s.timeLeft) + ' 秒', Math.ceil(s.timeLeft) + 's left'), s.timeLeft < 5 ? H(0, 0.9) : C(0.7)]);
  hud(g, hp);
  // 遮陽棚下的一行橫幅：每輪開場的目標、過關時的成績（過關不再用整個畫面的大字）
  const banner = s.phase === 'play' && s.msgT > 0 ? tr(f, s.msg, s.msgEn) : s.phase === 'result' && s.pass ? tr(f, '過關！本輪 ' + s.rscore + ' 分（命中 ' + s.hits + '/' + s.shots + '）　總分 ' + s.total, 'Cleared! Round score ' + s.rscore + ' (hits ' + s.hits + '/' + s.shots + ')  Total ' + s.total) : '';
  if (banner) { const w = g.textW(banner) + 4; fillRect(g, (cols - w) / 2, s.ah, w, 1, ' ', wood); ctextAt(g, cols / 2, s.ah, banner, C(0.9)); }
  if (s.phase === 'result' && !s.pass) {
    const by = bigText(g, 'GAME OVER', cols / 2, rows * 0.36, cols * 0.5, rows * 0.15, H(0, 0.85));
    const lines = [[tr(f, '命中 ' + s.hits + '/' + s.shots + '　本輪 ' + s.rscore + ' 分（目標 ' + s.goal + '）', 'Hits ' + s.hits + '/' + s.shots + '  Round score ' + s.rscore + ' (goal ' + s.goal + ')'), C(0.85)]];
    lines.push([tr(f, '總分 ', 'Total ') + s.total + (s.best ? tr(f, '　最高 ', '  Best ') + s.best : ''), C(0.7)]);
    panel(g, f, lines, by + 2.5, C(0.5));
  }
  if (!I.user) hint(g, f, tr(f, '移動準星，點一下射擊', 'Move the crosshair, click to shoot'));
}
A({ id: 'ix-gallery', name: '射擊遊樂場', cat: '街機', theme: 'sunset', hue: true, interactive: true,
  desc: '移動準星瞄準移動的鴨子、靶子和星星，點一下射擊，子彈有限',
  params: { rails: 3, speed: 1, ammo: 12, timer: 0 },
  variants: [
    { id: 'rapid', name: '快槍手', theme: 'gold', desc: '四排標靶跑得更快，限時 25 秒、20 發子彈', params: { rails: 4, speed: 1.5, ammo: 20, timer: 25 } },
  ],
  init(s, f) { glInit(s, f); },
  frame(s, f) { glFrame(s, f); },
});

/* ════════════ 4. 戳泡泡 ════════════ */
function bbInit(s, f) {
  const { cols, rows, p } = f, A = f.aspect, u = unitOf(f);
  s.A = A; s.u = u; s.t = 0;
  s.sea = rows - Math.max(2, Math.round(rows * 0.07));
  s.cap = Math.round((8 + (cols * rows) / 1100) * (p.density || 1));
  s.weeds = [];
  const nw = Math.max(3, Math.round(cols / 15));
  for (let k = 0; k < nw; k++) s.weeds.push({ x: rnd(1, cols - 2), h: Math.max(3, rnd(0.06, 0.17) * rows), ph: rnd(0, TAU), hue: rnd(100, 160) });
  s.specks = [];
  const ns = Math.round((cols * rows) / 100);
  for (let k = 0; k < ns; k++) s.specks.push({ x: rnd(0, cols), y: rnd(0, s.sea), v: rnd(0.3, 1.2), ph: rnd(0, TAU) });
  s.bs = []; s.pops = []; s.drops = []; s.texts = []; s.ripples = [];
  s.uf = new Int16Array(1024);
  s.ai = mkAi(f); s.I = mkI(f); s.best = bestGet('bubbles' + (p.mode || ''));
  bbNew(s, f, true);
}
function bbNew(s, f, first) {
  const p = f.p;
  s.score = 0; s.combo = 0; s.comboT = 9; s.maxCombo = 0; s.timeLeft = p.time || 60; s.miss = 0; s.over = 0; s.time = 0; s.spawnT = 0.3; s.mine = false;
  if (first) { let k = 0; while (s.bs.length < s.cap * 0.7 && k++ < 100) bbSpawn(s, f, rnd(f.rows * 0.15, s.sea)); }
  for (const b of s.bs) b.free = true;   // 上一局留下來的泡泡飄走不算漏掉
}
function bbSpawn(s, f, y0) {
  const n = Math.random() < 0.45 ? rint(2, 4) : 1, u = s.u;
  let x = rnd(0.06, 0.94) * f.cols, y = y0 === undefined ? s.sea + 1 : y0, prev = null;
  for (let k = 0; k < n && s.bs.length < s.cap && s.bs.length < 1000; k++) {
    const q = Math.random(), r = Math.max(1.6, u * (q < 0.45 ? rnd(1.3, 2) : q < 0.85 ? rnd(2, 3) : rnd(3, 4.2)));
    if (prev) { const a = rnd(Math.PI * 0.6, Math.PI * 2.4), d = prev.r + r + 0.25; x = clamp(prev.x + Math.cos(a) * d, r, f.cols - r); y = prev.y + (Math.sin(a) * d) / s.A; }
    const b = { x, y, r, vx: 0, vy: 0, ph: rnd(0, TAU), fr: rnd(0.6, 1.4), amp: u * rnd(1, 2.6), rise: f.rows * s.A * rnd(0.05, 0.08) * (0.85 + (0.3 * r) / (3 * u)), hue: rnd(0, 360), popT: 0, cs: 1, dead: false };
    b.vy = -b.rise;
    s.bs.push(b); prev = b;
  }
}
function bbPop(s, f, b) {
  if (b.dead) return;
  b.dead = true;
  const A = s.A;
  s.pops.push({ x: b.x, y: b.y, r: b.r, t: 0, hue: b.hue });
  const nd = Math.round(4 + b.r * 1.5);
  for (let k = 0; k < nd && s.drops.length < 500; k++) {
    const a = rnd(0, TAU), v = rnd(0.5, 1.2) * (b.r * 3 + 4);
    s.drops.push({ x: b.x + Math.cos(a) * b.r * 0.8, y: b.y + (Math.sin(a) * b.r * 0.8) / A, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, l: rnd(0.4, 0.9), hue: b.hue });
  }
  for (const o of s.bs) if (!o.dead && !o.popT && Math.hypot(o.x - b.x, (o.y - b.y) * A) < o.r + b.r + 0.5) o.popT = 0.09;
  if (s.over) return;
  s.combo = s.comboT < 0.9 ? s.combo + 1 : 1; s.comboT = 0; s.maxCombo = Math.max(s.maxCombo, s.combo);
  const base = b.r < s.u * 2 ? 30 : b.r < s.u * 3 ? 20 : 10, pts = base * Math.min(s.combo, 12);
  s.score += pts;
  addText(s.texts, b.x, b.y - b.r / A, s.combo > 1 ? '+' + pts + ' ×' + s.combo : '+' + pts, b.hue, 1);
}
function bbClick(s, f, x, y) {
  const A = s.A;
  for (let k = s.bs.length - 1; k >= 0; k--) {
    const b = s.bs[k];
    if (!b.dead && Math.hypot(x - b.x, (y - b.y) * A) < b.r + 0.5) { bbPop(s, f, b); return true; }
  }
  s.ripples.push({ x, y, t: 0 }); s.comboT = 9; s.combo = 0;
  return false;
}
function bbAi(s, f, ai) {
  const A = s.A, dt = f.dt, flood = f.p.mode === 'flood';
  ai.cool -= dt; ai.react -= dt;
  if (s.over) { wander(s, f, ai, 0.5); return; }
  let b = ai.tgt;
  if (b && (b.dead || b.popT > 0 || b.y < f.rows * (flood ? 0.025 : 0.06))) b = ai.tgt = null;
  if (!b) {
    let best = -1e9;
    // 泡泡潮：等泡泡浮到上面六成才戳（畫面會先滿起來），快飄出去的也要追
    const ymax = s.sea * (flood ? 0.6 : 0.7), ymin = f.rows * (flood ? 0.05 : 0.12);
    for (const q of s.bs) {
      if (q.dead || q.popT > 0 || q.y < ymin || q.y > ymax) continue;
      const d = Math.hypot(q.x - ai.x, (q.y - ai.y) * A);
      const v = Math.min(q.cs, 6) * 2.2 + (flood ? (1 - q.y / f.rows) * 5 : 0) - (d / f.cols) * 4 + Math.random() + (q.r < s.u * 2 ? 0.4 : 0);
      if (v > best) { best = v; b = q; }
    }
    if (b) {
      ai.tgt = b; ai.react = rnd(0.12, 0.3);
      ai.ex = gauss() * b.r * 0.22; ai.ey = (gauss() * b.r * 0.22) / A;
      if (Math.random() < 0.08) ai.ex = (Math.random() < 0.5 ? -1 : 1) * b.r * rnd(1.2, 1.5);
    }
  }
  if (!b) { wander(s, f, ai, 0.5); return; }
  const tx = b.x + b.vx * 0.12 + ai.ex, ty = b.y + (b.vy * 0.12) / A + ai.ey;
  const d = seek(ai, tx, ty, dt, Math.max(45, f.cols * 0.55), A, b.vx, b.vy);
  if (d < Math.max(0.6, b.r * 0.3) && ai.cool <= 0 && ai.react <= 0) {
    ai.clicks.push({ x: ai.x, y: ai.y, button: 0 });
    ai.cool = flood ? rnd(0.3, 0.7) : rnd(0.5, 1.3); ai.tgt = null;
  }
}
// 泡泡外框：小泡泡用圓角框（╭─╮ ╰─╯），大泡泡沿圓周畫；左上方比較亮，顏色沿著外框慢慢變（肥皂泡的虹彩）
function bbDraw(g, b, A, t, H, C) {
  const hot = b.popT > 0 ? 0.25 : 0, hue0 = b.hue + t * 25;
  const colAt = (x, y) => {
    let a = Math.atan2((y + 0.5 - b.y) * A, x + 0.5 - b.x); if (a < 0) a += TAU;
    return H(hue0 + a * 23, 0.42 + 0.35 * Math.max(0, Math.cos(a - Math.PI * 1.25)) + hot);
  };
  if (b.r < 3.2) {
    const w = Math.max(3, Math.round(2 * b.r)), h = (2 * b.r) / A < 2.3 ? 2 : 3, x0 = Math.round(b.x - w / 2), y0 = Math.round(b.y - h / 2);
    for (let j = 0; j < h; j++) {
      const y = y0 + j, top = j === 0, bot = j === h - 1;
      for (let i = 0; i < w; i++) {
        const x = x0 + i, edge = i === 0 || i === w - 1;
        if (!top && !bot && !edge) continue;
        const ch = top ? (i === 0 ? '╭' : i === w - 1 ? '╮' : '─') : bot ? (i === 0 ? '╰' : i === w - 1 ? '╯' : '─') : '│';
        g.set(x, y, ch, colAt(x, y));
      }
    }
    if (h === 3 && w >= 5) g.set(x0 + 1, y0 + 1, '·', C(0.8));
    return;
  }
  const ni = ringPath(b.x, b.y, b.r * 0.66, A);
  for (let i = 0; i < ni; i++) { const a = (i / ni) * TAU; if (a > Math.PI * 1.08 && a < Math.PI * 1.42) g.set(RX[i], RY[i], ringCh(i, ni), C(0.75 + hot)); }
  const nr = ringPath(b.x, b.y, b.r, A);
  for (let i = 0; i < nr; i++) g.set(RX[i], RY[i], ringCh(i, nr), colAt(RX[i], RY[i]));
}
function bbFind(uf, i) { while (uf[i] !== i) { uf[i] = uf[uf[i]]; i = uf[i]; } return i; }
function bbFrame(s, f) {
  const { g, cols, rows, C, H, p } = f, A = s.A, dt = f.dt, flood = p.mode === 'flood';
  const I = ixIn(s, f, bbAi);
  ixLeft(s, I, s.score, 'bubbles' + (p.mode || ''));
  if (I.user) s.mine = true;
  if (I.taken && (I.aiT > 15 || s.over)) bbNew(s, f);
  s.t += dt; s.comboT += dt;
  if (s.comboT > 0.9) s.combo = 0;
  if (!s.over) {
    s.time += dt;
    if (!flood) s.timeLeft -= dt;
    if ((!flood && s.timeLeft <= 0) || (flood && s.miss >= (p.miss || 10))) {
      s.timeLeft = 0; s.over = 0.001;
      if (s.mine && s.score > s.best) { s.best = s.score; bestPut('bubbles' + (p.mode || ''), s.best); }
    }
  } else { s.over += dt; if (s.over > 5.5) bbNew(s, f); }
  for (const c of I.clicks) {
    if (s.over) { if (s.over > 1.5) bbNew(s, f); break; }
    bbClick(s, f, c.x, c.y);
  }
  // 產生泡泡
  const speedK = flood ? 0.7 + s.time / 100 : 1;   // 泡泡潮：一開始浮得慢、越來越快
  s.spawnT -= dt;
  if (s.spawnT <= 0) {
    if (s.bs.length < s.cap * (flood ? Math.min(2, 1 + s.time / 150) : 1)) bbSpawn(s, f);
    s.spawnT = flood ? rnd(0.5, 1.3) / (1 + s.time / 80) : rnd(0.35, 1.0);   // 泡泡潮：越冒越快
  }
  // 移動：左右搖擺上升；碰在一起的泡泡會黏住（速度互相拉近）
  const bs = s.bs, n = bs.length, uf = s.uf.length >= 2 * n ? s.uf : (s.uf = new Int16Array(n * 2 + 64));
  for (let i = 0; i < n; i++) {
    const b = bs[i], k = Math.min(1, dt * 1.5);
    uf[i] = i;
    b.vx += (b.amp * Math.cos(s.t * b.fr + b.ph) - b.vx) * k;
    b.vy += (-b.rise * speedK - b.vy) * k;
  }
  const ks = Math.min(1, dt * 3);
  for (let i = 0; i < n; i++) {
    const a = bs[i];
    if (a.dead) continue;
    for (let j = i + 1; j < n; j++) {
      const b = bs[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = (b.y - a.y) * A, rr = a.r + b.r;
      if (dx > rr + 1 || dx < -rr - 1 || dy > rr + 1 || dy < -rr - 1) continue;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d > rr + 0.8) continue;
      const nx = dx / d, ny = dy / d, wa = (b.r * b.r) / (a.r * a.r + b.r * b.r), wb = 1 - wa;
      const sep = rr + 0.25;
      if (d < sep) { const o = sep - d; a.x -= nx * o * wa; a.y -= (ny * o * wa) / A; b.x += nx * o * wb; b.y += (ny * o * wb) / A; }
      else { const o = Math.min(0.3, d - sep) * dt * 2; a.x += nx * o; a.y += (ny * o) / A; b.x -= nx * o; b.y -= (ny * o) / A; }
      const mvx = (a.vx + b.vx) / 2, mvy = (a.vy + b.vy) / 2;
      a.vx += (mvx - a.vx) * ks; b.vx += (mvx - b.vx) * ks; a.vy += (mvy - a.vy) * ks; b.vy += (mvy - b.vy) * ks;
      if (d < rr + 0.5) { const ra = bbFind(uf, i), rb = bbFind(uf, j); if (ra !== rb) uf[ra] = rb; }
    }
  }
  for (let i = 0; i < n; i++) uf[n + i] = 0;
  for (let i = 0; i < n; i++) uf[n + bbFind(uf, i)]++;
  for (let i = 0; i < n; i++) {
    const b = bs[i];
    b.cs = uf[n + bbFind(uf, i)];
    if (b.dead) continue;
    b.x += b.vx * dt; b.y += (b.vy * dt) / A;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x > cols - b.r) { b.x = cols - b.r; b.vx = -Math.abs(b.vx); }
    if (b.popT > 0 && (b.popT -= dt) <= 0) bbPop(s, f, b);
    if (b.y + b.r / A < -0.5) { b.dead = true; if (flood && !s.over && !b.free) { s.miss++; addText(s.texts, b.x, 1.5, ['漏掉了', 'Missed'], 0, 0.8); } }
  }
  sweep(bs);
  // ── 繪圖 ──
  for (const q of s.specks) {
    q.y -= q.v * dt * 0.8;
    if (q.y < 0) { q.y += s.sea; q.x = rnd(0, cols); }
    g.set(q.x + Math.sin(s.t * 0.7 + q.ph) * 0.6, q.y, q.v > 1 ? '°' : '·', C(0.1 + q.v * 0.08));
  }
  // 海草：左右交錯的 ( ) 隨水流擺動
  for (const w of s.weeds) {
    for (let j = 0; j < w.h; j++) {
      const k = j / w.h, x = w.x + Math.sin(s.t * 0.8 + j * 0.3 + w.ph) * k * 1.4 * s.u + (j % 2) * 0.9;
      g.set(x, s.sea - 1 - j, j % 2 ? ')' : '(', H(w.hue, 0.2 + 0.18 * k));
    }
  }
  // 泡泡先畫，海底沙地蓋在上面：剛冒出來的泡泡像是從沙裡浮出
  for (const b of bs) bbDraw(g, b, A, s.t, H, C);
  for (let y = s.sea; y < rows; y++) for (let x = 0; x < cols; x++) {
    const h = hash(x, y);
    g.setI(y * cols + x, y === s.sea ? (h < 0.5 ? '▁' : '▂') : h < 0.3 ? '▒' : '░', y === s.sea ? H(42, 0.3) : H(40, 0.12 + h * 0.08));
  }
  for (let k = s.pops.length - 1; k >= 0; k--) {
    const e = s.pops[k]; e.t += dt;
    if (e.t > 0.3) { s.pops.splice(k, 1); continue; }
    const nr = ringPath(e.x, e.y, e.r * (1 + e.t * 3), A);
    for (let i = 0; i < nr; i += 2) g.set(RX[i], RY[i], i % 4 ? '·' : '˙', H(e.hue, 0.9 - e.t * 2));
  }
  for (let k = s.drops.length - 1; k >= 0; k--) {
    const q = s.drops[k]; q.l -= dt;
    if (q.l <= 0) { s.drops[k] = s.drops[s.drops.length - 1]; s.drops.pop(); continue; }
    q.vy += 30 * dt; q.vx *= 1 - dt; q.x += q.vx * dt; q.y += (q.vy * dt) / A;
    g.set(q.x, q.y, q.l > 0.5 ? '•' : q.vy > 0 ? ',' : '·', H(q.hue, 0.4 + q.l * 0.6));
  }
  for (let k = s.ripples.length - 1; k >= 0; k--) {
    const e = s.ripples[k]; e.t += dt;
    if (e.t > 0.35) { s.ripples.splice(k, 1); continue; }
    const nr = ringPath(e.x, e.y, 0.8 + e.t * 6, A);
    for (let i = 0; i < nr; i += 2) g.set(RX[i], RY[i], '·', C(0.5 - e.t));
  }
  drawTexts(g, s.texts, dt, H, f);
  if (!I.user && !s.over) g.set(I.x, I.y, '+', C(0.6));
  const hp = [[tr(f, '分數 ', 'Score ') + s.score, C(0.9)]];
  if (s.combo > 1) hp.unshift([tr(f, '連擊 ×', 'Combo ×') + s.combo, H(50, 0.9)]);
  hp.unshift(flood ? [tr(f, '漏掉 ', 'Missed ') + s.miss + '/' + (p.miss || 10), s.miss >= (p.miss || 10) - 3 ? H(0, 0.85) : C(0.55)] : [tr(f, '剩 ' + Math.ceil(s.timeLeft) + ' 秒', Math.ceil(s.timeLeft) + 's left'), s.timeLeft < 10 ? H(20, 0.85) : C(0.55)]);
  hud(g, hp);
  if (s.over) {
    const by = bigText(g, flood ? 'GAME OVER' : 'TIME UP', cols / 2, rows * 0.36, cols * 0.5, rows * 0.15, C(0.9));
    panel(g, f, [[tr(f, '分數 ' + s.score + '　最大連擊 ×', 'Score ' + s.score + '  Best combo ×') + s.maxCombo, C(0.85)], [s.best ? tr(f, '最高 ', 'Best ') + s.best : tr(f, '再來一局！', 'One more round!'), C(0.6)]], by + 2.5, C(0.45));
  }
  if (!I.user) hint(g, f, tr(f, '點一下戳破泡泡，黏在一起的會連鎖爆開', 'Click to pop bubbles, ones stuck together burst in a chain'));
}
A({ id: 'ix-bubbles', name: '戳泡泡', cat: '街機', theme: 'ocean', hue: true, interactive: true,
  desc: '點一下戳破上升的泡泡，黏在一起的會連鎖爆開、連擊加倍',
  params: { mode: 'time', time: 60, density: 1 },
  variants: [
    { id: 'flood', name: '泡泡潮', theme: 'mint', desc: '沒有時間限制但泡泡越冒越快，漏掉 10 顆就結束', params: { mode: 'flood', miss: 10, density: 1.25 } },
  ],
  init(s, f) { bbInit(s, f); },
  frame(s, f) { bbFrame(s, f); },
});

/* ════════════ 5. 切水果 ════════════ */
// 外皮色相 rh / 亮度 rl，果肉色相 fh / 亮度 fl，大小 sz
const SL_FRUIT = [
  { rh: 125, rl: 0.42, fh: 355, fl: 0.66, sz: 1.3, stripe: 1, seed: 1 },
  { rh: 28, rl: 0.66, fh: 35, fl: 0.8, sz: 1.0 },
  { rh: 0, rl: 0.52, fh: 50, fl: 0.85, sz: 1.0, stem: 1 },
  { rh: 55, rl: 0.66, fh: 58, fl: 0.88, sz: 0.9 },
  { rh: 30, rl: 0.3, fh: 95, fl: 0.62, sz: 0.85, seed: 1 },
  { rh: 285, rl: 0.42, fh: 45, fl: 0.72, sz: 0.95, stem: 1 },
];
let SLH = null;   // 這一格的 f.H（給著色函式用）
function slFruitShade(nx, ny, q) {
  const T = SL_FRUIT[q.type];
  let l = T.rl + 0.2 * (-nx * 0.55 - ny * 0.8);
  const sx = nx + 0.38, sy = ny + 0.45;
  if (sx * sx + sy * sy < 0.06) l += 0.28;
  if (T.stripe && Math.sin((nx * Math.cos(q.rot) + ny * Math.sin(q.rot)) * 9) > 0.35) l -= 0.15;
  if (nx * nx + ny * ny > 0.8) l -= 0.08;
  return SLH(T.rh, clamp(l, 0.05, 1));
}
function slHalfShade(nx, ny, q) {
  const dot = (nx * q.nx + ny * q.ny) * q.side;
  if (dot < 0.05) return null;
  const T = SL_FRUIT[q.type];
  if (dot < 0.45) {
    if (T.seed && dot > 0.12 && dot < 0.35 && hash(Math.floor(nx * 7 + 9), Math.floor(ny * 5 + 9)) < 0.18) return SLH(T.fh, 0.12);
    return SLH(T.fh, T.fl - dot * 0.3);
  }
  return SLH(T.rh, clamp(T.rl + 0.18 * (-nx * 0.55 - ny * 0.8), 0.05, 1));
}
function slBombShade(nx, ny) {
  let v = 0.2 + 0.22 * (-nx * 0.55 - ny * 0.8);
  const sx = nx + 0.35, sy = ny + 0.4;
  if (sx * sx + sy * sy < 0.05) v += 0.35;
  const c = clamp(v, 0, 1) * 255;
  return rgb(c * 0.92, c * 0.9, c);
}
function slInit(s, f) {
  const { cols, rows, p } = f, A = f.aspect, u = unitOf(f);
  s.A = A; s.u = u; s.t = 0;
  s.gr = rows * 0.62;
  s.thr = Math.max(28, cols * 0.22);
  s.ph = Math.max(5, Math.round(rows / 6));
  s.grain = [];
  for (let y = 0, band = 0; y < rows; y += s.ph, band++) {
    const pw = Math.max(34, Math.round(cols / 3)), off = (band % 2) * (pw >> 1) + rint(0, pw >> 2);
    for (let x = off % pw; x < cols; x += pw) s.grain.push({ v: 1, x, y: y + 1, len: s.ph - 1 });
    for (let k = 0; k < cols / 50; k++) s.grain.push({ v: 0, x: rint(0, cols - 4), y: y + rint(1, s.ph - 1), len: rint(3, 7) });
  }
  s.fr = []; s.halves = []; s.parts = []; s.stains = []; s.texts = []; s.queue = []; s.marks = [];
  s.trail = []; for (let k = 0; k < 16; k++) s.trail.push({ x: 0, y: 0, t: -9, on: false });
  s.ti = 0; s.fastT = 9;
  s.ai = mkAi(f); s.I = mkI(f); s.best = bestGet('slice' + (p.zen ? 'z' : ''));
  slNew(s, f, true);
}
function slNew(s, f, first) {
  s.score = 0; s.strikes = 0; s.phase = 'play'; s.oT = 0; s.time = 0; s.tossT = first ? 0.3 : 1; s.mine = false;
  s.swipe = 0; s.swipeT = 9; s.timeLeft = f.p.zen ? 60 : 0; s.queue.length = 0; s.blast = null;
  for (const q of s.fr) q.safe = true;
}
function slToss(s, f, bomb) {
  const { cols, rows } = f, A = s.A, u = s.u, type = rint(0, SL_FRUIT.length - 1);
  const R = bomb ? Math.max(2.5, 2.3 * u) : Math.max(2.8, 2.5 * u) * SL_FRUIT[type].sz;
  const x = rnd(0.12, 0.88) * cols, y = rows + R / A + 0.5, apex = rows * rnd(0.1, 0.42);
  const vy = -Math.sqrt(2 * s.gr * (y - apex)), T = (-2 * vy) / s.gr;
  const vx = ((rnd(0.25, 0.75) * cols - x) / T) * rnd(0.6, 1.1);
  s.fr.push({ x, y, vx, vy, R, type, bomb: !!bomb, rot: rnd(0, TAU), vr: rnd(-2.5, 2.5), dead: false, safe: false, skip: 0 });
}
function slCut(s, f, q, dx, dy) {
  q.dead = true;
  const A = s.A, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux, T = SL_FRUIT[q.type], sep = 5 + q.R * 2;
  for (let side = -1; side <= 1; side += 2)
    s.halves.push({ x: q.x + nx * side * q.R * 0.15, y: q.y + (ny * side * q.R * 0.15) / A, vx: q.vx + nx * side * sep, vy: q.vy + (ny * side * sep) / A, R: q.R, type: q.type, nx, ny, side, vr: side * rnd(1, 3), dead: false });
  for (let k = 0; k < 10 + q.R * 2 && s.parts.length < 600; k++) {
    const a = Math.atan2(uy, ux) + (Math.random() < 0.5 ? 0 : Math.PI) + rnd(-0.6, 0.6), v = rnd(4, 14) + q.R * 2;
    s.parts.push({ x: q.x, y: q.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: rnd(0.3, 0.8), l0: 0.8, hue: T.fh + rnd(-10, 10), g: 40 });
  }
  if (s.stains.length > 9) s.stains.shift();
  s.stains.push({ x: q.x, y: q.y, R: q.R * 1.35, hue: T.fh, t: 0, seed: rint(0, 999) });
  if (s.phase === 'play') { s.score++; s.swipe++; addText(s.texts, q.x, q.y - q.R / A - 1, '+1', T.fh, 0.7); }
}
function slBomb(s, f, q) {
  q.dead = true;
  s.blast = { x: q.x, y: q.y, t: 0, R: Math.max(6, 5 * s.u) };
  burst(s.parts, q.x, q.y, 40, 20 + s.u * 8, 30, 1.2, 0);
  for (const o of s.fr) if (!o.dead) { o.safe = true; const dx = o.x - q.x, dy = (o.y - q.y) * s.A, d = Math.hypot(dx, dy) || 1; o.vx += (dx / d) * 25; o.vy += (dy / d) * 10 - 5; }
  if (s.phase === 'play' && !f.p.zen) { s.strikes++; addText(s.texts, q.x, q.y - 2, ['炸彈！', 'Bomb!'], 10, 1.2); }
}
// 預測 t 秒後的位置（拋物線）
const slAt = (s, q, t) => [q.x + q.vx * t, q.y + q.vy * t + 0.5 * s.gr * t * t];
function slAi(s, f, ai) {
  const A = s.A, dt = f.dt, cols = f.cols, rows = f.rows;
  if (ai.st === 2) {
    ai.cutT += dt;
    const u = Math.min(1, ai.cutT / ai.cutD), e = smooth(u);
    ai.x = lerp(ai.sx, ai.ex2, e); ai.y = lerp(ai.sy, ai.ey2, e); ai.down = true;
    if (u >= 1) { ai.st = 3; ai.rest = rnd(0.03, 0.2); ai.down = false; ai.vx = ai.vy = 0; }
    return;
  }
  ai.down = false;
  if (ai.st === 3) { ai.rest -= dt; if (ai.rest > 0) return; ai.st = 0; }
  if (s.phase !== 'play') { wander(s, f, ai, 0.5); return; }
  const vA = Math.max(60, cols * 1.1);
  if (ai.st === 1) {
    const q = ai.tgt, left = ai.tc - s.t;
    if (!q || q.dead || left < -0.15) ai.st = 0;
    else {
      // 路上有炸彈就放慢（慢速移動不會切到東西）
      let vmax = vA;
      for (const b of s.fr) if (b.bomb && !b.dead && segDist(b.x, b.y, ai.x, ai.y, ai.sx, ai.sy, A) < b.R + 3) vmax = s.thr * 0.5;
      const d = seek(ai, ai.sx, ai.sy, dt, vmax, A, 0, 0, 14);
      if (d < 1.5 && left <= ai.cutD / 2 + 0.02) { ai.st = 2; ai.cutT = 0; ai.sx = ai.x; ai.sy = ai.y; }
      return;
    }
  }
  // 規劃下一刀：挑「最快要掉出畫面、但還來得及」的水果，預測它的位置，
  // 再選一條不會碰到炸彈、最好能順便多切幾顆的刀路
  let q = null, bv = -1e9, tq = 0, busy = 0;
  for (const o of s.fr) if (!o.dead && !o.bomb && !o.safe) busy++;
  for (const o of s.fr) {
    if (o.dead || o.bomb || o.skip > s.t || o.safe) continue;
    const Y = rows + o.R / A, tExit = (-o.vy + Math.sqrt(Math.max(0, o.vy * o.vy + 2 * s.gr * (Y - o.y)))) / s.gr;
    const d = Math.hypot(o.x - ai.x, (o.y - ai.y) * A), tReach = d / vA + 0.38;
    if (tExit < tReach + 0.15) continue;
    const v = -(tExit - tReach) - (d / cols) * 0.5 + Math.random() * 0.25;
    // 不忙的時候像人一樣等水果飛到最高點附近才切；水果一多就見一顆切一顆
    const early = tReach + rnd(0.04, 0.12), apex = -o.vy / s.gr + rnd(-0.3, 0.3);
    if (v > bv) { bv = v; q = o; tq = clamp(busy >= 3 ? early : busy === 2 ? Math.min(apex, early + 0.3) : apex, early, tExit - 0.2); }
  }
  if (!q) { wander(s, f, ai, 0.45); return; }
  const tc = tq + Math.abs(gauss()) * 0.04;
  const [px, py] = slAt(s, q, tc);
  if (py > rows - 0.6 || px < 1 || px > cols - 1) { q.skip = s.t + 0.5; return; }
  // 順著水果的飛行方向切最不怕時間抓不準，所以先試這個角度
  const vyq = (q.vy + s.gr * tc) * A, sp = Math.hypot(q.vx, vyq), L = q.R * 1.7 + 3 + sp * 0.05, a0 = rnd(0, TAU), cand = [Math.atan2(vyq, q.vx) + gauss() * 0.25];
  for (let k = 0; k < 6; k++) cand.push(a0 + (k * Math.PI) / 6);
  for (const o of s.fr) if (o !== q && !o.dead && !o.bomb) { const [ox, oy] = slAt(s, o, tc); if (Math.hypot(ox - px, (oy - py) * A) < cols * 0.3) cand.push(Math.atan2((oy - py) * A, ox - px)); }
  let best = null, bc = -1;
  for (const a of cand) {
    const cx = Math.cos(a), cy = Math.sin(a);
    // 刀路往兩邊延伸，盡量涵蓋同一條線上的其他水果
    let lo = -L, hi = L;
    for (const o of s.fr) {
      if (o === q || o.dead || o.bomb) continue;
      const [ox, oy] = slAt(s, o, tc), rx = ox - px, ry = (oy - py) * A, along = rx * cx + ry * cy;
      if (Math.abs(-rx * cy + ry * cx) < o.R * 0.7 && Math.abs(along) < cols * 0.3) { lo = Math.min(lo, along - o.R - 2); hi = Math.max(hi, along + o.R + 2); }
    }
    const sx = px + cx * lo, sy = py + (cy * lo) / A, ex = px + cx * hi, ey = py + (cy * hi) / A;
    if (sy < 0.5 || ey < 0.5 || sy > rows - 0.5 || ey > rows - 0.5 || sx < 0 || ex < 0 || sx > cols || ex > cols) continue;
    let ok = true, cnt = 0;
    for (const o of s.fr) {
      if (o.dead || o === q) continue;
      const [ox, oy] = slAt(s, o, tc), dd = segDist(ox, oy, sx, sy, ex, ey, A);
      if (o.bomb && dd < o.R + 2.5) { ok = false; break; }
      if (!o.bomb && dd < o.R * 0.8) cnt++;
    }
    if (ok && cnt > bc) { bc = cnt; best = [sx, sy, ex, ey]; }
  }
  if (!best) { q.skip = s.t + 0.5; return; }
  const off = gauss() * q.R * 0.3, ang = Math.atan2((best[3] - best[1]) * A, best[2] - best[0]), ox = -Math.sin(ang) * off, oy = (Math.cos(ang) * off) / A;
  if (Math.random() < 0.5) { ai.sx = best[0] + ox; ai.sy = best[1] + oy; ai.ex2 = best[2] + ox; ai.ey2 = best[3] + oy; }
  else { ai.sx = best[2] + ox; ai.sy = best[3] + oy; ai.ex2 = best[0] + ox; ai.ey2 = best[1] + oy; }
  ai.cutD = clamp(Math.hypot(ai.ex2 - ai.sx, (ai.ey2 - ai.sy) * A) / Math.max(120, cols * 1.6), 0.08, 0.22);
  ai.tc = s.t + tc + gauss() * 0.03; ai.tgt = q; ai.st = 1;
}
function slFrame(s, f) {
  const { g, cols, rows, C, H, p } = f, A = s.A, dt = f.dt, zen = !!p.zen;
  SLH = H;
  const I = ixIn(s, f, slAi);
  ixLeft(s, I, s.score, 'slice' + (zen ? 'z' : ''));
  if (I.user) s.mine = true;
  if (I.taken && (I.aiT > 15 || s.phase === 'over')) slNew(s, f);
  s.t += dt;
  if (s.phase === 'play') {
    s.time += dt;
    if (zen) { s.timeLeft -= dt; if (s.timeLeft <= 0) s.timeLeft = 0; }
    if ((!zen && s.strikes >= 3) || (zen && s.timeLeft <= 0)) {
      s.phase = 'over'; s.oT = 0;
      if (s.mine && s.score > s.best) { s.best = s.score; bestPut('slice' + (zen ? 'z' : ''), s.best); }
    }
  } else { s.oT += dt; if (s.oT > 5.5 || (s.oT > 1.5 && I.clicks.length)) slNew(s, f); }
  // 拋水果
  if (s.phase === 'play') {
    s.tossT -= dt;
    if (s.tossT <= 0) {
      // 寬畫面每一波至少丟兩顆（禪模式最多再多一顆），砧板才不會空蕩蕩
      const lv = 1 + Math.floor(s.time / 20), wide = cols > 200;
      const n = rint(wide ? 2 : 1, Math.min(6, 2 + Math.floor((lv - 1) / 2) + (zen ? 1 : 0) + (zen && wide ? 1 : 0)));
      const bomb = !zen && Math.random() < Math.min(0.45, 0.18 + 0.03 * lv) ? rint(0, n) : -1;
      for (let k = 0; k <= n; k++) if (k < n || k === bomb) s.queue.push({ at: s.t + (Math.random() < 0.4 ? 0 : k * rnd(0.12, 0.3)), bomb: k === bomb });
      s.tossT = rnd(1.2, 2.4) / (1 + 0.06 * lv) / (zen ? 1.3 : 1);
    }
  }
  for (let k = s.queue.length - 1; k >= 0; k--) if (s.queue[k].at <= s.t) { slToss(s, f, s.queue[k].bomb); s.queue.splice(k, 1); }
  // 刀光：移動得夠快（或按住拖曳）就會切
  // 游標離開桌面（移到視窗或工作列上）再從別處回來時，第一格會「瞬移」一大段：
  // 沒按住、前一刻也沒在快速移動，卻一格就跳很遠，就當成瞬移，不算刀光
  const dx = I.x - I.px, dy = (I.y - I.py) * A, dl = Math.hypot(dx, dy), sp = dl / Math.max(dt, 1e-3);
  const fast = sp > s.thr, jump = !I.down && dl > Math.max(12, cols * 0.2) && s.fastT > 0.12;
  const on = !I.taken && dl > 0.05 && (I.down || fast) && !jump;
  s.fastT = fast && !jump ? 0 : s.fastT + dt;
  const tp = s.trail[s.ti = (s.ti + 1) % s.trail.length];
  tp.x = I.x; tp.y = I.y; tp.t = s.t; tp.on = on;
  if (on) {
    s.swipeT = 0;
    for (const q of s.fr) {
      if (q.dead || segCircle(I.px, I.py, I.x, I.y, q.x, q.y, q.R + 0.4, A) < 0) continue;
      if (q.bomb) slBomb(s, f, q); else slCut(s, f, q, dx, dy);
    }
  } else {
    s.swipeT += dt;
    if (s.swipeT > 0.25 && s.swipe) {
      if (s.swipe >= 3 && s.phase === 'play') { s.score += s.swipe; addText(s.texts, I.x, I.y - 2, [s.swipe + ' 連切！+' + s.swipe, s.swipe + '-fruit combo! +' + s.swipe], 50, 1.3); }
      s.swipe = 0;
    }
  }
  // 物理
  for (const q of s.fr) {
    if (q.dead) continue;
    q.vy += s.gr * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    if (q.vy > 0 && q.y - q.R / A > rows) {
      q.dead = true;
      if (!q.bomb && !q.safe && s.phase === 'play' && !zen) { s.strikes++; s.marks.push({ x: clamp(q.x, 2, cols - 3), t: 0 }); }
    }
  }
  for (const h of s.halves) {
    h.vy += s.gr * dt; h.x += h.vx * dt; h.y += h.vy * dt;
    const a = h.vr * dt, c = Math.cos(a), sn = Math.sin(a), nx = h.nx * c - h.ny * sn; h.ny = h.nx * sn + h.ny * c; h.nx = nx;
    if (h.y - h.R / A > rows) h.dead = true;
  }
  sweep(s.fr); sweep(s.halves);
  stepParts(s.parts, dt, A);
  // ── 繪圖 ──
  // 木紋砧板：橫向接縫、交錯的直縫、淡淡的木紋
  for (let y = s.ph; y < rows; y += s.ph) for (let x = 0; x < cols; x++) g.setI(y * cols + x, '─', C(0.1));
  for (const q of s.grain) {
    if (q.v) { for (let y = q.y; y < q.y + q.len && y < rows; y++) g.set(q.x, y, '│', C(0.08)); }
    else for (let x = q.x; x < q.x + q.len; x++) g.set(x, q.y, '-', C(0.055));
  }
  for (let k = s.stains.length - 1; k >= 0; k--) {
    const e = s.stains[k]; e.t += dt;
    if (e.t > 5) { s.stains.splice(k, 1); continue; }
    const R = e.R, ry = R / A, fade = 1 - e.t / 5;
    for (let y = Math.floor(e.y - ry); y <= e.y + ry; y++) for (let x = Math.floor(e.x - R); x <= e.x + R; x++) {
      const d = Math.hypot(x + 0.5 - e.x, (y + 0.5 - e.y) * A) / R;
      if (d < 0.55 + 0.45 * hash(x + e.seed, y)) g.set(x, y, d < 0.5 ? '▒' : '░', H(e.hue, 0.32 * fade + 0.05));
    }
  }
  for (const h of s.halves) blob(g, h.x, h.y, h.R, A, slHalfShade, h);
  for (const q of s.fr) {
    if (q.bomb) {
      blob(g, q.x, q.y, q.R, A, slBombShade, q);
      const tx = q.x + Math.sin(q.rot) * q.R * 0.9, ty = q.y - (Math.cos(q.rot) * q.R * 0.9) / A - 0.6;
      g.set(tx, ty, '╿', C(0.5));
      g.set(tx + rnd(-0.6, 0.6), ty - 0.8, pick(['✶', '*', '+', '✷']), H(rnd(20, 55), 1));
    } else {
      blob(g, q.x, q.y, q.R, A, slFruitShade, q);
      // 蒂頭固定在果實頂端（光影也是固定從左上照），只跟著旋轉微微擺動
      if (SL_FRUIT[q.type].stem) g.set(q.x + Math.sin(q.rot) * 0.6, q.y - q.R / A - 0.25, '╻', H(30, 0.35));
    }
  }
  drawParts(g, s.parts, H, '·•●');
  if (s.blast) {
    const e = s.blast; e.t += dt;
    if (e.t > 0.9) s.blast = null;
    else {
      const R = e.R * Math.min(1, e.t / 0.25), fade = e.t < 0.4 ? 1 : 1 - (e.t - 0.4) / 0.5;
      for (let y = Math.floor(e.y - R / A); y <= e.y + R / A; y++) for (let x = Math.floor(e.x - R); x <= e.x + R; x++) {
        const d = Math.hypot(x + 0.5 - e.x, (y + 0.5 - e.y) * A) / Math.max(0.1, R);
        if (d > 1) continue;
        g.set(x, y, d < 0.5 ? '█' : d < 0.75 ? '▓' : '░', H(40 - d * 30, (1 - d * 0.5) * fade));
      }
    }
  }
  // 刀光軌跡
  const nT = s.trail.length;
  for (let k = 0; k < nT - 1; k++) {
    const a = s.trail[(s.ti - k - 1 + nT * 2) % nT], b = s.trail[(s.ti - k + nT) % nT], age = s.t - b.t;
    if (!a.on || !b.on || age > 0.2 || s.t - a.t > 0.25) continue;
    const ang = Math.atan2((b.y - a.y) * A, b.x - a.x), m = ((ang % Math.PI) + Math.PI) % Math.PI;
    const ch = m < Math.PI / 8 || m > (Math.PI * 7) / 8 ? '─' : m < (Math.PI * 3) / 8 ? '╲' : m < (Math.PI * 5) / 8 ? '│' : '╱';
    g.line(a.x, a.y, b.x, b.y, ch, age < 0.07 ? C(1) : C(0.9 - age * 2.5));
  }
  for (let k = s.marks.length - 1; k >= 0; k--) { const m = s.marks[k]; m.t += dt; if (m.t > 1.2) { s.marks.splice(k, 1); continue; } g.set(m.x, rows - 2, '✕', H(0, 1 - m.t * 0.5)); }
  drawTexts(g, s.texts, dt, H, f);
  if (zen) hud(g, [[tr(f, '剩 ' + Math.ceil(s.timeLeft) + ' 秒', Math.ceil(s.timeLeft) + 's left'), s.timeLeft < 10 ? H(10, 0.85) : C(0.55)], [tr(f, '分數 ', 'Score ') + s.score, C(0.9)]]);
  else hud(g, [[tr(f, '分數 ', 'Score ') + s.score, C(0.9)], ['✕', s.strikes > 0 ? H(0, 0.9) : C(0.3)], ['✕', s.strikes > 1 ? H(0, 0.9) : C(0.3), 1], ['✕', s.strikes > 2 ? H(0, 0.9) : C(0.3), 1]]);
  if (s.phase === 'over') {
    const by = bigText(g, zen ? 'TIME UP' : 'GAME OVER', cols / 2, rows * 0.36, cols * 0.5, rows * 0.15, C(0.95));
    panel(g, f, [[scoreBest(f, s), C(0.85)]], by + 2, C(0.5));
  }
  if (!I.user) hint(g, f, zen ? tr(f, '快速劃過水果把它切開', 'Swipe quickly across the fruit to slice it') : tr(f, '快速劃過水果把它切開，小心炸彈', 'Swipe quickly across the fruit to slice it, but avoid the bombs'));
}
A({ id: 'ix-slice', name: '切水果', cat: '街機', theme: 'amber', hue: true, interactive: true,
  desc: '滑鼠快速劃過（或按住拖曳）切開飛起的水果，別碰到炸彈',
  params: { zen: 0 },
  variants: [
    { id: 'zen', name: '禪模式', theme: 'forest', desc: '沒有炸彈也不會失誤，60 秒內能切多少就切多少', params: { zen: 1 } },
  ],
  init(s, f) { slInit(s, f); },
  frame(s, f) { slFrame(s, f); },
});
})();
