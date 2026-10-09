// 遊戲・實用・場景（ga- 開頭）：自己會玩的小遊戲、各式時鐘與計時器、生活小景。
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
  '-': '00000,00000,00000,11111,00000,00000,00000', '+': '00000,00100,00100,11111,00100,00100,00000',
  '/': '00001,00010,00010,00100,01000,01000,10000', '%': '11001,11010,00010,00100,01000,01011,10011',
  '?': '01110,10001,00001,00010,00100,00000,00100', '*': '00000,10101,01110,11111,01110,10101,00000',
});
// 3×5 小點陣數字
const F3 = parseFont({
  '0': '111,101,101,101,111', '1': '010,110,010,010,111', '2': '111,001,111,100,111', '3': '111,001,111,001,111',
  '4': '101,101,111,001,001', '5': '111,100,111,001,111', '6': '111,100,111,101,111', '7': '111,001,001,010,010',
  '8': '111,101,111,101,111', '9': '111,101,111,001,111', ':': '0,1,0,1,0', ' ': '0,0,0,0,0', '-': '000,000,111,000,000',
  '.': '0,0,0,0,1', '%': '101,001,010,100,101',
});
function fontW(str, font) { let w = 0; for (const c of str) w += (font[c] || font[' '])[0].length + 1; return Math.max(0, w - 1); }
// 用點陣字畫大字：每個點 sx 欄 × sy 列；col 可以是顏色字串或 (u,v)=>顏色
function drawBig(g, str, x0, y0, sx, sy, col, font = F5, ch = '█') {
  let x = Math.round(x0); const y = Math.round(y0), fn = typeof col === 'function';
  for (const c of str) {
    const gl = font[c] || font[' '], w = gl[0].length, h = gl.length;
    for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
      if (gl[r][q] !== '1') continue;
      const cc = fn ? col(q / w, r / h) : col;
      for (let yy = 0; yy < sy; yy++) for (let xx = 0; xx < sx; xx++) g.set(x + q * sx + xx, y + r * sy + yy, ch, cc);
    }
    x += (w + 1) * sx;
  }
}
// 在 maxW×maxH 的範圍裡能放多大的字
function bigFit(str, maxW, maxH, aspect, font = F5) {
  const pw = fontW(str, font), ph = font['0'].length;
  const sy = Math.max(1, Math.floor(Math.min(maxH / ph, maxW / (pw * aspect))));
  let sx = Math.max(1, Math.round(sy * aspect));
  if (pw * sx > maxW) sx = Math.max(1, Math.floor(maxW / pw));
  return { sx, sy, w: pw * sx, h: ph * sy };
}
// 寫字：全形字的第二格也清掉，底下的星點、地面才不會蓋住字的右半邊
const wideCh = c => { const k = c.codePointAt(0); return k >= 0x2e80 && k < 0xff61; };
// 不透明空白（英文字串的字間）：畫成真的空格、蓋掉底下的星點，效果和中文的全形空白「　」一樣；中文字串裡不會出現
const NB = '\u00a0';
function txt(g, x, y, s, col) {
  x = Math.floor(x);
  for (const c of s) { const w = wideCh(c); if (c === NB) g.set(x, y, ' ', col); else if (c !== ' ') { g.set(x, y, c, col); if (w) g.set(x + 1, y, ' ', col); } x += w ? 2 : 1; }
}
// 先清出一條空白底，再寫字（用在疊在風景上的資訊列）
function hudText(g, x, y, s, col, bg) { fillRect(g, Math.floor(x) - 1, y, g.textW(s) + 2, 1, ' ', bg); txt(g, x, y, s, col); }
const ctext = (g, y, s, col) => txt(g, Math.floor((g.cols - g.textW(s)) / 2), y, s, col);
const ctextAt = (g, cx, y, s, col) => txt(g, Math.floor(cx - g.textW(s) / 2), y, s, col);
const fold = (v, lo, hi) => { const L = hi - lo; if (L <= 0) return lo; let m = (v - lo) % (2 * L); if (m < 0) m += 2 * L; return lo + (m > L ? 2 * L - m : m); };
const pad2 = n => String(n).padStart(2, '0');
// 介面語言：f.lang === 'en' 時畫英文，其他（含舊版沒有 f.lang）一律畫中文
// 英文字串的空白換成不透明空白（opq），字和字之間才不會透出背景的星點
const opq = s => (typeof s === 'string' ? s.replace(/ /g, NB) : s);
const tr = (f, zh, en) => (f.lang === 'en' ? opq(en) : zh);
const enN = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
const EN_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = x => x * x * (3 - 2 * x);
function box(g, x0, y0, w, h, col, heavy) {
  const [tl, tr, bl, br, hz, vt] = heavy ? ['╔', '╗', '╚', '╝', '═', '║'] : ['┌', '┐', '└', '┘', '─', '│'];
  for (let x = 1; x < w - 1; x++) { g.set(x0 + x, y0, hz, col); g.set(x0 + x, y0 + h - 1, hz, col); }
  for (let y = 1; y < h - 1; y++) { g.set(x0, y0 + y, vt, col); g.set(x0 + w - 1, y0 + y, vt, col); }
  g.set(x0, y0, tl, col); g.set(x0 + w - 1, y0, tr, col); g.set(x0, y0 + h - 1, bl, col); g.set(x0 + w - 1, y0 + h - 1, br, col);
}
function fillRect(g, x0, y0, w, h, ch, col) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(g.rows, Math.floor(y0 + h)); y++)
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(g.cols, Math.floor(x0 + w)); x++) { const i = y * g.cols + x; g.ch[i] = ch; g.co[i] = col; }
}
// 背景淡淡的星點（讓畫面不會整片空白）
function mkDust(n, cols, rows) { return Array.from({ length: n }, () => ({ x: rnd(0, cols), y: rnd(0, rows), p: rnd(0, TAU), v: rnd(0.2, 1) })); }
function drawDust(g, d, t, C, lvl = 0.16, chars = '.·') {
  for (const s of d) { const b = 0.5 + 0.5 * Math.sin(t * s.v * 1.7 + s.p); if (b > 0.25) g.set(s.x, s.y, chars[(b > 0.8 && chars.length > 1) ? 1 : 0], C(lvl * (0.4 + b))); }
}

/* ════════════ 1. 乒乓對打 ════════════ */
// 座標：x 以欄為單位，y 以「欄寬」為單位（列 × aspect），這樣速度和角度看起來才是圓的
function pgMake(x0, y0, w, h, p, A) {
  const c = { x0, y0, w, h, A, Hv: h * A, mode: p.mode, pads: [], balls: [], walls: [1, 1, 1, 1], sc: [0, 0, 0, 0], flash: [0, 0, 0, 0], rally: 0, best: 0, t: 0 };
  const sides = p.mode === 'quad' ? [0, 1, 2, 3] : p.mode === 'vert' ? [2, 3] : p.mode === 'squash' ? [0] : [0, 1];
  for (const sd of sides) c.walls[sd] = 0;
  const u = Math.min(w / 100, h / 28);
  c.bw = Math.max(1, Math.round(u * 0.7)); c.bh = Math.max(1, Math.round(c.bw / A));
  c.r = Math.max(c.bw * 0.5, c.bh * A * 0.5) * 0.9;
  c.pw = c.bw;
  c.XL = 1 + c.pw; c.XR = w - 1 - c.pw; c.YT = 2 * A; c.YB = (h - 2) * A;
  for (const sd of sides) {
    const span = sd >= 2 ? w : c.Hv;
    c.pads.push({ sd, span, pos: span / 2, len: span * (p.padLen || (p.mode === 'quad' ? 0.2 : sd >= 2 ? 0.13 : 0.17)), err: 0, vmax: span * (p.padLen ? 1.3 : 0.8), hit: 0 });
  }
  c.speed0 = Math.max(w, c.Hv) * 0.4 * (p.speed || 1);
  const n = p.balls || 1;
  for (let k = 0; k < n; k++) c.balls.push(pgBall(c, p, null, k * 0.45));
  pgErr(c, p);
  return c;
}
function pgBall(c, p, b, wait) {
  b = b || { tr: new Float32Array(2 * Math.max(2, p.trail || 2)), tn: 0, ti: 0, acc: 0, hue: rnd(0, 360) };
  b.x = c.w / 2; b.y = c.Hv / 2; b.wait = 0.7 + (wait || 0); b.spin = 0; b.tn = 0; b.last = -1;
  let ang;
  if (c.mode === 'vert') ang = (Math.random() < 0.5 ? -1 : 1) * Math.PI / 2 + rnd(-0.45, 0.45);
  else if (c.mode === 'quad') ang = rint(0, 3) * Math.PI / 2 + Math.PI / 4 + rnd(-0.3, 0.3);
  else ang = (c.mode === 'squash' || Math.random() < 0.5 ? Math.PI : 0) + rnd(-0.45, 0.45);
  b.vx = Math.cos(ang) * c.speed0; b.vy = Math.sin(ang) * c.speed0;
  return b;
}
function pgErr(c, p) {
  for (const pd of c.pads) {
    pd.err = gauss() * pd.len * 0.16;
    if (Math.random() < (p.miss || 0.13)) pd.err = (Math.random() < 0.5 ? -1 : 1) * pd.len * rnd(0.62, 1.0);
  }
}
const pgPlane = (c, sd) => (sd === 0 ? c.XL : sd === 1 ? c.XR : sd === 2 ? c.YT : c.YB);
const pgToward = (sd, q) => (sd === 0 ? q.vx < 0 : sd === 1 ? q.vx > 0 : sd === 2 ? q.vy < 0 : q.vy > 0);
const pgReach = (c, sd, q) => (sd === 0 ? q.x - c.r <= c.XL : sd === 1 ? q.x + c.r >= c.XR : sd === 2 ? q.y - c.r <= c.YT : q.y + c.r >= c.YB);
function pgMove(q, h) {
  if (q.spin) {
    const a = q.spin * h, ca = Math.cos(a), sa = Math.sin(a), vx = q.vx;
    q.vx = vx * ca - q.vy * sa; q.vy = vx * sa + q.vy * ca; q.spin *= 1 - 1.3 * h;
  }
  q.x += q.vx * h; q.y += q.vy * h;
}
function pgWalls(c, b) {
  const r = c.r;
  if (c.walls[0] && b.x - r < 0 && b.vx < 0) { b.x = 2 * r - b.x; b.vx = -b.vx; }
  if (c.walls[1] && b.x + r > c.w && b.vx > 0) { b.x = 2 * (c.w - r) - b.x; b.vx = -b.vx; }
  if (c.walls[2] && b.y - r < 0 && b.vy < 0) { b.y = 2 * r - b.y; b.vy = -b.vy; }
  if (c.walls[3] && b.y + r > c.Hv && b.vy > 0) { b.y = 2 * (c.Hv - r) - b.y; b.vy = -b.vy; }
}
const PGQ = { x: 0, y: 0, vx: 0, vy: 0, spin: 0 };
function pgPredict(c, pd, b) { // 回傳 [時間, 落點]，算不出來回傳 null
  const q = PGQ; q.x = b.x; q.y = b.y; q.vx = b.vx; q.vy = b.vy; q.spin = b.spin;
  const h = 1 / 60;
  for (let k = 0; k < 300; k++) {
    for (const o of c.pads) if (pgToward(o.sd, q) && pgReach(c, o.sd, q)) return o === pd ? [k * h, o.sd >= 2 ? q.x : q.y] : null;
    pgMove(q, h); pgWalls(c, q);
  }
  return null;
}
function pgStep(c, dt, p) {
  c.t += dt;
  for (let k = 0; k < 4; k++) c.flash[k] = Math.max(0, c.flash[k] - dt * 0.8);
  for (const pd of c.pads) {
    let tgt = null, bt = 1e9;
    for (const b of c.balls) { if (b.wait > 0) continue; const r = pgPredict(c, pd, b); if (r && r[0] < bt) { bt = r[0]; tgt = r[1]; } }
    const half = pd.len / 2, goal = tgt === null ? pd.span / 2 + Math.sin(c.t * 0.9 + pd.sd) * pd.span * 0.08 : tgt + pd.err;
    const mv = pd.vmax * dt * (tgt === null ? 0.35 : 1);
    pd.pos = clamp(pd.pos + clamp(goal - pd.pos, -mv, mv), half, pd.span - half);
    pd.hit = Math.max(0, pd.hit - dt);
  }
  const r = c.r;
  for (const b of c.balls) {
    b.hue = (b.hue + dt * 25) % 360;
    if (b.wait > 0) { b.wait -= dt; continue; }
    const sp0 = Math.hypot(b.vx, b.vy), n = Math.max(1, Math.ceil((sp0 * dt) / (r * 0.7))), h = dt / n;
    for (let k = 0; k < n; k++) {
      const px = b.x, py = b.y;
      pgMove(b, h);
      // 有旋轉時別讓球變成幾乎垂直（或水平）來回彈
      const sp = Math.hypot(b.vx, b.vy);
      if (c.mode === 'duel' || c.mode === 'squash') { if (Math.abs(b.vx) < 0.42 * sp) { b.spin = 0; b.vx = Math.sign(b.vx || 1) * 0.42 * sp; b.vy = Math.sign(b.vy || 1) * 0.9075 * sp; } }
      else if (c.mode === 'vert') { if (Math.abs(b.vy) < 0.42 * sp) { b.spin = 0; b.vy = Math.sign(b.vy || 1) * 0.42 * sp; b.vx = Math.sign(b.vx || 1) * 0.9075 * sp; } }
      pgWalls(c, b);
      for (const pd of c.pads) {
        const sd = pd.sd, pl = pgPlane(c, sd);
        let cross;
        if (sd === 0) cross = b.vx < 0 && px - r >= pl - 1e-6 && b.x - r < pl;
        else if (sd === 1) cross = b.vx > 0 && px + r <= pl + 1e-6 && b.x + r > pl;
        else if (sd === 2) cross = b.vy < 0 && py - r >= pl - 1e-6 && b.y - r < pl;
        else cross = b.vy > 0 && py + r <= pl + 1e-6 && b.y + r > pl;
        if (!cross) continue;
        const along = sd >= 2 ? b.x : b.y;
        if (Math.abs(along - pd.pos) > pd.len / 2 + r) continue;
        const off = clamp((along - pd.pos) / (pd.len / 2), -1, 1), ang = off * 0.95;
        const nsp = Math.min(sp * 1.04, c.speed0 * 1.8), cs = Math.cos(ang) * nsp, sn = Math.sin(ang) * nsp;
        if (sd === 0) { b.vx = cs; b.vy = sn; b.x = pl + r; }
        else if (sd === 1) { b.vx = -cs; b.vy = sn; b.x = pl - r; }
        else if (sd === 2) { b.vy = cs; b.vx = sn; b.y = pl + r; }
        else { b.vy = -cs; b.vx = sn; b.y = pl - r; }
        b.spin = p.spin ? -off * p.spin * (sd === 0 || sd === 3 ? 1 : -1) : 0;
        b.last = sd; pd.hit = 0.3; c.rally++; c.best = Math.max(c.best, c.rally);
        pgErr(c, p);
        break;
      }
    }
    b.acc += dt;
    while (b.acc >= 1 / 60) {
      b.acc -= 1 / 60;
      const N = b.tr.length / 2; b.tr[b.ti * 2] = b.x; b.tr[b.ti * 2 + 1] = b.y; b.ti = (b.ti + 1) % N; b.tn = Math.min(N, b.tn + 1);
    }
    const m = 3 * r;
    let out = -1;
    if (b.x < -m) out = 0; else if (b.x > c.w + m) out = 1; else if (b.y < -m) out = 2; else if (b.y > c.Hv + m) out = 3;
    if (out >= 0) {
      let who = -1;
      if (c.mode === 'duel') who = out === 0 ? 1 : 0;
      else if (c.mode === 'vert') who = out === 2 ? 3 : 2;
      else if (c.mode === 'quad') who = b.last >= 0 && b.last !== out ? b.last : -1;
      if (who >= 0) { c.sc[who]++; c.flash[who] = 1; if (c.sc[who] > 11) c.sc.fill(0); }
      c.rally = 0;
      pgBall(c, p, b, 0.2);
      pgErr(c, p);
    }
  }
}
function pgDraw(c, f, p) {
  const { g, C, H } = f, A = c.A, X0 = c.x0, Y0 = c.y0, w = c.w, h = c.h, hue = !!p.hueBalls;
  const wc = C(0.5), nc = C(0.28);
  if (c.walls[2]) for (let x = -1; x <= w; x++) g.set(X0 + x, Y0 - 1, '▄', wc);
  if (c.walls[3]) for (let x = -1; x <= w; x++) g.set(X0 + x, Y0 + h, '▀', wc);
  if (c.walls[0]) for (let y = 0; y < h; y++) g.set(X0 - 1, Y0 + y, '▐', wc);
  if (c.walls[1]) for (let y = 0; y < h; y++) g.set(X0 + w, Y0 + y, '▌', wc);
  const small = h < 18 || (c.mode === 'quad' && h < 40);
  const sc = (k, x, y, align) => {
    const str = String(c.sc[k]), col = C(0.32 + c.flash[k] * 0.6);
    if (small) { txt(g, align < 0 ? x - str.length : align > 0 ? x : x - str.length / 2, y, str, col); return; }
    const sy = h > 60 ? 2 : 1, sx = Math.round(sy * A), W = fontW(str, F5) * sx;
    drawBig(g, str, align < 0 ? x - W : align > 0 ? x : x - W / 2, y, sx, sy, col);
  };
  if (c.mode === 'duel') {
    for (let y = 0; y < h; y += 2) g.set(X0 + (w >> 1), Y0 + y, '│', nc);
    const gap = small ? 3 : Math.round(w * 0.06);
    sc(0, X0 + (w >> 1) - gap, Y0 + 2, -1); sc(1, X0 + (w >> 1) + gap + 1, Y0 + 2, 1);
  } else if (c.mode === 'vert') {
    for (let x = 0; x < w; x += 3) g.set(X0 + x, Y0 + (h >> 1), '─', nc);
    const sy = h > 60 ? 2 : 1;
    sc(2, X0 + 3, Y0 + (h >> 1) - (small ? 2 : 2 + 7 * sy), 1); sc(3, X0 + 3, Y0 + (h >> 1) + 2, 1);
  } else if (c.mode === 'quad') {
    const R = Math.min(w, c.Hv) * 0.16;
    for (let a = 0; a < TAU; a += 0.05) g.set(X0 + w / 2 + Math.cos(a) * R, Y0 + (c.Hv / 2 + Math.sin(a) * R) / A, '·', nc);
    for (const [cx, cy, ch] of [[0, 0, '┌'], [w - 1, 0, '┐'], [0, h - 1, '└'], [w - 1, h - 1, '┘']]) g.set(X0 + cx, Y0 + cy, ch, wc);
    const sy = h > 60 ? 2 : 1, d = R + 4;
    sc(0, X0 + w / 2 - d, Y0 + h / 2 - (small ? 0 : 3.5 * sy), -1); sc(1, X0 + w / 2 + d, Y0 + h / 2 - (small ? 0 : 3.5 * sy), 1);
    const yTop = Y0 + h / 2 - R / A - (small ? 2 : 1 + 7 * sy), yBot = Y0 + h / 2 + R / A + 1;
    sc(2, X0 + w / 2, small ? yTop : Math.max(Y0 + 3, yTop), 0); sc(3, X0 + w / 2, small ? yBot : Math.min(Y0 + h - 3 - 7 * sy, yBot), 0);
  } else {
    // 壁球：發球線 + 背景大大的連續擊球數
    for (let y = 0; y < h; y += 2) g.set(X0 + Math.round(w * 0.55), Y0 + y, '┊', nc);
    const str = String(c.rally);
    if (small) txt(g, X0 + w * 0.75, Y0 + h / 2, str, C(0.3));
    else { const fit = bigFit(str, w * 0.3, h * 0.45, A); drawBig(g, str, X0 + w * 0.76 - fit.w / 2, Y0 + (h - fit.h) / 2, fit.sx, fit.sy, C(0.16 + c.flash[0] * 0.3)); }
    txt(g, X0 + Math.round(w * 0.6), Y0 + 1, tr(f, '最高 ', 'Best ') + c.best, C(0.45));
  }
  // 拖尾與球
  for (const b of c.balls) {
    if (b.wait > 0 && ((c.t * 4) | 0) % 2) continue;
    const N = b.tr.length / 2;
    if (N > 2 && b.wait <= 0) {
      for (let k = 0; k < b.tn; k++) {
        const idx = (b.ti - 1 - k + N * 2) % N, a = k / N;
        const x = b.tr[idx * 2], y = b.tr[idx * 2 + 1] / A;
        const col = hue ? H(b.hue - a * 140, 0.85 - a * 0.65) : C(0.75 - a * 0.6);
        g.set(X0 + x, Y0 + y, a < 0.15 ? 'o' : a < 0.5 ? '•' : '·', col);
      }
    }
    const col = hue ? H(b.hue, 1) : C(1);
    if (c.bw === 1 && c.bh === 1) g.set(X0 + b.x, Y0 + b.y / A, '●', col);
    else fillRect(g, X0 + Math.round(b.x - c.bw / 2), Y0 + Math.round(b.y / A - c.bh / 2), c.bw, c.bh, '█', col);
  }
  const PH = [130, 200, 330, 45];
  for (const pd of c.pads) {
    const col = p.hueBalls ? H(PH[pd.sd], 0.75 + pd.hit) : C(0.85 + pd.hit * 0.5);
    if (pd.sd < 2) {
      const top = (pd.pos - pd.len / 2) / A, bot = (pd.pos + pd.len / 2) / A;
      const xa = pd.sd === 0 ? 1 : w - 1 - c.pw;
      for (let y = Math.floor(top); y < Math.ceil(bot); y++) {
        const ch = y === Math.floor(top) && top - y > 0.5 ? '▄' : y === Math.ceil(bot) - 1 && bot - y < 0.5 ? '▀' : '█';
        for (let k = 0; k < c.pw; k++) g.set(X0 + xa + k, Y0 + y, ch, col);
      }
    } else {
      const l = pd.pos - pd.len / 2, rr = pd.pos + pd.len / 2, y = pd.sd === 2 ? 1 : h - 2;
      for (let x = Math.floor(l); x < Math.ceil(rr); x++) {
        const ch = x === Math.floor(l) && l - x > 0.5 ? '▐' : x === Math.ceil(rr) - 1 && rr - x < 0.5 ? '▌' : '█';
        g.set(X0 + x, Y0 + y, ch, col);
      }
    }
  }
}
A({ id: 'ga-pong', name: '乒乓對打', cat: '遊戲', theme: 'mono', desc: '兩支 AI 球拍你來我往對打',
  params: { mode: 'duel', balls: 1, trail: 2, courts: 1, spin: 0, speed: 1 },
  variants: [
    { id: 'multi', name: '三球亂鬥', theme: 'neon', hue: true, desc: '三顆彩球同時在場上亂飛', params: { balls: 3, trail: 6, hueBalls: 1 } },
    { id: 'quad', name: '四方混戰', theme: 'cyber', hue: true, desc: '四支球拍各守一面牆', params: { mode: 'quad', balls: 2, hueBalls: 1, trail: 5 } },
    { id: 'squash', name: '單人壁球', theme: 'amber', desc: '一支球拍對著牆不停練習', params: { mode: 'squash', trail: 12, miss: 0.06 } },
    { id: 'comet', name: '彗星弧線', theme: 'synth', hue: true, desc: '帶旋轉的球畫出彩色弧線', params: { trail: 70, spin: 1.5, hueBalls: 1, speed: 1.15 } },
    { id: 'vertical', name: '上下對決', theme: 'ice', desc: '球拍改在上下兩端對打', params: { mode: 'vert', trail: 4 } },
    { id: 'arcade', name: '街機牆', theme: 'matrix', desc: '一整面牆的小球場同時開打', params: { courts: 6, trail: 3 } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f;
    s.courts = [];
    if (p.courts > 1) {
      const nx = 3, ny = Math.ceil(p.courts / 3), gx = 3, gy = 2;
      const w = Math.floor((cols - gx * (nx + 1)) / nx), h = Math.floor((rows - gy * (ny + 1)) / ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s.courts.push(pgMake(gx + i * (w + gx), gy + j * (h + gy), w, h, p, aspect));
    } else if (p.courtH) {
      const h = Math.max(10, Math.round((rows - 2) * p.courtH)), y0 = Math.floor((rows - h) / 2);
      s.courts.push(pgMake(2, y0, cols - 4, h, p, aspect));
      s.band = [y0 - 2, y0 + h + 1];
      s.streaks = [];
      for (let y = 0; y < rows; y++) {
        if (y > s.band[0] && y < s.band[1]) continue;
        for (let k = 0; k < Math.max(2, Math.round(cols / 60)); k++) s.streaks.push({ y, x: rnd(0, cols), len: rnd(4, 18) * Math.max(1, cols / 120), m: rnd(0.4, 1.6) });
      }
    } else s.courts.push(pgMake(2, 1, cols - 4, rows - 2, p, aspect));
  },
  frame(s, f) {
    if (s.streaks) {
      const { g, C, cols } = f, c = s.courts[0];
      let vx = 0; for (const b of c.balls) if (b.wait <= 0) { vx = b.vx; break; }
      for (const q of s.streaks) {
        q.x += vx * q.m * 1.6 * f.dt;
        if (q.x > cols + q.len) q.x -= cols + q.len * 2; else if (q.x < -q.len) q.x += cols + q.len * 2;
        const dir = vx >= 0 ? 1 : -1, L = Math.max(1, Math.round(q.len * Math.min(1, Math.abs(vx) / Math.max(1, c.speed0))));
        for (let k = 0; k < L; k++) g.set(q.x - dir * k, q.y, k ? '─' : '·', C((0.06 + 0.12 * q.m) * (1 - k / L) + 0.03));
      }
      const str = tr(f, '連續 ' + c.rally + ' 拍　最高 ' + c.best, 'Rally ' + c.rally + '  Best ' + c.best);
      if (s.band[0] >= 1) hudText(g, Math.floor((cols - g.textW(str)) / 2), Math.floor(s.band[0] / 2), str, C(0.55), C(0));
    }
    for (const c of s.courts) { pgStep(c, f.dt, f.p); pgDraw(c, f, f.p); }
  } });

/* ════════════ 2. 打磚塊 ════════════ */
function boLayout(kind, i, j, nx, ny, s) {
  const u = (i + 0.5) / nx * 2 - 1, v = (j + 0.5) / ny * 2 - 1;
  switch (kind) {
    case 'pyramid': return Math.abs(u) <= (j + 1) / ny + 0.02 ? (j < ny * 0.3 ? 2 : 1) : 0;
    case 'diamond': { const d = Math.abs(u) + Math.abs(v); return d <= 1 ? (d < 0.4 ? 3 : d < 0.7 ? 2 : 1) : 0; }
    case 'heart': {
      const vw = nx * s.bw, vh = ny * s.bh * s.A, sc = Math.min(vw, vh * 1.15) / 2.7;
      const X = (i + 0.5 - nx / 2) * s.bw / sc, Y = 1.25 - (j + 0.5) * s.bh * s.A / sc;
      const q = X * X + Y * Y - 1; return q * q * q - X * X * Y * Y * Y <= 0 ? 1 : 0;
    }
    case 'checker': return j < 2 ? 3 : (i + j) % 2 ? 2 : 1;
    case 'wave': { const c = 0.45 * Math.sin(u * Math.PI * 2 + s.level); return Math.abs(v - c) < 0.42 ? 1 : 0; }
    case 'holes': return hash(i, j + s.level * 31) < 0.82 ? 1 : 0;
    default: return 1;
  }
}
function boLevel(s, p) {
  s.hp = new Uint8Array(s.nx * s.ny); s.rowOff = 0; s.descT = 0;
  for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) s.hp[j * s.nx + i] = boLayout(p.layout, i, j, s.nx, s.ny, s);
  s.balls = []; for (let k = 0; k < (p.balls || 1); k++) s.balls.push(boBall(s, k * 0.3));
  s.level++;
}
function boBall(s, wait) { const b = { x: s.px, y: (s.py - 0.6) * s.A, vx: 0, vy: 0, wait: 0.9 + wait, aim: null, err: 0, jit: 0, hue: rnd(0, 360) }; boErr(s, b); return b; }
function boErr(s, b) { b.jit = gauss() * 0.06; b.err = Math.random() < 0.02 ? (Math.random() < 0.5 ? -1 : 1) * s.pw * rnd(0.75, 1) : 0; }
function boLaunch(s, b) { const a = rnd(-0.5, 0.5), sp = s.sp0; b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp; }
function boPredict(s, b) { // 只算牆壁反彈的落點
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy; const Yp = s.py * s.A - s.r, L = s.x0 + s.r, R = s.x0 + s.W - s.r;
  if (vy <= 0) return null;
  const t = (Yp - y) / vy; return fold(x + vx * t, L, R);
}
A({ id: 'ga-breakout', name: '打磚塊', cat: '遊戲', theme: 'synth', hue: true, desc: 'AI 球拍瞄準磚塊一路清關',
  params: { layout: 'rows', balls: 1, tiny: 0, descend: 0 },
  variants: [
    { id: 'pyramid', name: '金字塔', theme: 'gold', hue: false, desc: '層層堆起的金色金字塔磚牆', params: { layout: 'pyramid' } },
    { id: 'diamond', name: '鑽石陣', theme: 'ice', hue: false, desc: '中心越硬的菱形磚陣', params: { layout: 'diamond' } },
    { id: 'multi', name: '多球狂歡', theme: 'fire', desc: '五顆球同時砸向磚牆', params: { balls: 5, layout: 'holes' } },
    { id: 'tiny', name: '細磚高牆', theme: 'mint', hue: false, desc: '密密麻麻的細小磚塊', params: { tiny: 1 } },
    { id: 'armor', name: '硬殼磚', theme: 'blueprint', hue: false, desc: '要敲好幾下才會碎的硬磚', params: { layout: 'checker' } },
    { id: 'descend', name: '步步進逼', theme: 'toxic', desc: '波浪磚牆不斷往下壓', params: { layout: 'wave', descend: 5 } },
  ],
  init(s, f) {
    const { cols, rows, aspect: A, p } = f;
    s.A = A;
    s.bh = p.tiny ? 1 : Math.max(1, Math.round(rows / 44));
    s.bw = p.tiny ? Math.max(3, Math.round(cols / 64)) : Math.max(4, Math.round(s.bh * A * 2.6));
    s.nx = Math.floor((cols - 4) / s.bw); s.W = s.nx * s.bw; s.x0 = Math.floor((cols - s.W) / 2);
    s.top = 2; s.by0 = s.top + Math.max(1, Math.round(rows * 0.07));
    s.ny = Math.max(4, Math.floor((rows * (p.tiny ? 0.3 : 0.36)) / s.bh));
    s.py = rows - 2; s.pw = Math.max(5, Math.round(s.W * (p.balls > 1 ? 0.14 : 0.1)));
    s.px = s.x0 + s.W / 2; s.goal = s.px; s.r = 0.6;
    s.sp0 = rows * A * 0.8; s.fireT = rnd(8, 14); s.score = 0; s.lives = 3; s.level = 0; s.parts = []; s.msg = ''; s.msgT = 0;
    boLevel(s, p);
  },
  frame(s, f) {
    const { g, dt, C, H, p, rows } = f, A = s.A, nx = s.nx, ny = s.ny, hue = !!f.p && this.hue;
    s.fireT -= dt;
    if (s.fireT <= 0) { s.fireT = rnd(14, 22); const live = s.balls.filter(b => b.wait <= 0); if (live.length) pick(live).fire = 4.5; }
    // 狀態訊息
    if (s.msgT > 0) { s.msgT -= dt; if (s.msgT <= 0) { if (s.msg === 'GAME OVER') { s.score = 0; s.lives = 3; s.level = 0; } boLevel(s, p); } }
    // 下壓
    if (p.descend && s.msgT <= 0) {
      s.descT += dt;
      if (s.descT > p.descend) {
        s.descT = 0; s.rowOff++;
        let low = -1; for (let j = ny - 1; j >= 0 && low < 0; j--) for (let i = 0; i < nx; i++) if (s.hp[j * nx + i]) { low = j; break; }
        if (low >= 0 && s.by0 + (low + s.rowOff + 1) * s.bh >= s.py - 3) { s.msg = 'GAME OVER'; s.msgT = 2.5; }
      }
    }
    const by = s.by0 + s.rowOff * s.bh, Yp = s.py * A, L = s.x0, R = s.x0 + s.W, r = s.r;
    // 球拍 AI：追最快落下的球，瞄準一塊還在的磚
    let trk = null, bt = 1e9;
    for (const b of s.balls) if (b.wait <= 0 && b.vy > 0) { const t = (Yp - r - b.y) / b.vy; if (t < bt) { bt = t; trk = b; } }
    if (trk) {
      if (!trk.aim) {
        const alive = []; for (let k = 0; k < s.hp.length; k++) if (s.hp[k]) alive.push(k);
        trk.aim = alive.length ? pick(alive) : 0;
      }
      const lx = boPredict(s, trk), ai = trk.aim % nx, aj = (trk.aim / nx) | 0;
      const tx = s.x0 + (ai + 0.5) * s.bw, ty = (by + (aj + 0.5) * s.bh) * A;
      const off = clamp(Math.atan2(tx - lx, Yp - ty) / 1.05, -0.85, 0.85);
      s.goal = lx - (trk.err ? trk.err : clamp(off * s.pw / 2 + trk.jit * s.pw, -s.pw * 0.44, s.pw * 0.44));
    } else { const b = s.balls[0]; if (b) s.goal = lerp(s.goal, b.x, dt * 2); }
    const mv = s.W * 1.1 * dt;
    s.px = clamp(s.px + clamp(s.goal - s.px, -mv, mv), L + s.pw / 2, R - s.pw / 2);
    // 球
    if (s.msgT <= 0) for (let bi = s.balls.length - 1; bi >= 0; bi--) {
      const b = s.balls[bi];
      b.hue = (b.hue + dt * 40) % 360;
      if (b.fire > 0) { b.fire -= dt; if (s.parts.length < 300) for (let q = 0; q < 2; q++) s.parts.push({ x: b.x + rnd(-0.6, 0.6), y: b.y / A + rnd(-0.4, 0.4), vx: rnd(-3, 3), vy: rnd(-4, 1), l: rnd(0.2, 0.55), j: -1 }); }
      if (b.wait > 0) { b.wait -= dt; b.x = s.px; b.y = Yp - r - 0.4; if (b.wait <= 0) boLaunch(s, b); continue; }
      const sp = Math.hypot(b.vx, b.vy), n = Math.max(1, Math.ceil((sp * dt) / 0.45)), h = dt / n;
      for (let k = 0; k < n; k++) {
        const ox = b.x, oy = b.y;
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x - r < L && b.vx < 0) { b.x = 2 * (L + r) - b.x; b.vx = -b.vx; }
        if (b.x + r > R && b.vx > 0) { b.x = 2 * (R - r) - b.x; b.vx = -b.vx; }
        if (b.y - r < s.top * A && b.vy < 0) { b.y = 2 * (s.top * A + r) - b.y; b.vy = -b.vy; }
        const i = Math.floor((b.x - s.x0) / s.bw), j = Math.floor((b.y / A - by) / s.bh);
        if (i >= 0 && i < nx && j >= 0 && j < ny && s.hp[j * nx + i]) {
          const k2 = j * nx + i;
          if (b.fire > 0) s.hp[k2] = 1;
          else {
            const pi = Math.floor((ox - s.x0) / s.bw), pj = Math.floor((oy / A - by) / s.bh);
            if (pi !== i && pj === j) b.vx = -b.vx; else if (pj !== j && pi === i) b.vy = -b.vy; else { b.vx = -b.vx; b.vy = -b.vy; }
            b.x = ox; b.y = oy;
          }
          s.hp[k2]--;
          s.score += 10;
          const bx0 = s.x0 + i * s.bw, by0 = by + j * s.bh;
          if (!s.hp[k2]) { s.score += 40; for (let q = 0; q < 5; q++) s.parts.push({ x: bx0 + rnd(0, s.bw - 1), y: by0 + rnd(0, s.bh), vx: rnd(-8, 8), vy: rnd(-6, 2), l: rnd(0.5, 1.2), j }); }
          if (Math.random() < 0.3) b.aim = null;
          if (b.fire > 0) continue;
          break;
        }
        if (b.vy > 0 && oy + r <= Yp && b.y + r > Yp && Math.abs(b.x - s.px) <= s.pw / 2 + 0.8) {
          const off = clamp((b.x - s.px) / (s.pw / 2), -1, 1), ang = off * 1.05, nsp = Math.min(sp * 1.015, s.sp0 * 1.35);
          b.vx = Math.sin(ang) * nsp; b.vy = -Math.cos(ang) * nsp; b.y = Yp - r; b.aim = null; boErr(s, b);
        }
      }
      if (b.y > (rows + 1) * A) {
        if (p.balls > 1) { s.balls[bi] = boBall(s, 0.2); continue; }
        s.balls.splice(bi, 1); s.lives--;
        if (s.lives <= 0) { s.msg = 'GAME OVER'; s.msgT = 2.5; } else s.balls.push(boBall(s, 0.3));
      }
    }
    let left = 0; for (let k = 0; k < s.hp.length; k++) if (s.hp[k]) left++;
    if (!left && s.msgT <= 0) { s.msg = 'CLEAR!'; s.msgT = 2.2; s.score += 1000; }
    // 畫磚塊
    const rowH = (j, lum) => hue ? H((j * 300) / ny + s.level * 47, lum) : C(lum * (0.55 + 0.45 * (1 - j / ny)));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = s.hp[j * nx + i]; if (!v) continue;
      const x0 = s.x0 + i * s.bw, y0 = by + j * s.bh;
      const ch = v >= 3 ? '█' : v === 2 ? (p.layout === 'checker' || p.layout === 'diamond' ? '▓' : '█') : p.layout === 'checker' || p.layout === 'diamond' ? '▒' : '█';
      const col = rowH(j, v >= 2 ? 0.95 : 0.8);
      for (let yy = 0; yy < s.bh; yy++) for (let xx = 0; xx < s.bw - 1; xx++) g.set(x0 + xx, y0 + yy, s.bh > 1 && yy === s.bh - 1 ? '▀' : p.tiny ? '▀' : ch, yy === s.bh - 1 && s.bh > 1 ? rowH(j, 0.5) : col);
    }
    // 碎片
    for (let k = s.parts.length - 1; k >= 0; k--) {
      const q = s.parts[k]; q.l -= dt; q.vy += 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.l <= 0 || q.y > rows) { s.parts[k] = s.parts[s.parts.length - 1]; s.parts.pop(); continue; }
      if (q.j < 0) { g.set(q.x, q.y, q.l > 0.35 ? '*' : q.l > 0.2 ? '+' : '.', hue ? H(15 + q.l * 70, 0.5 + q.l) : C(0.4 + q.l)); continue; }
      g.set(q.x, q.y, q.l > 0.6 ? '▪' : '.', rowH(q.j, 0.4 + q.l * 0.5));
    }
    // 牆與球拍
    const wc = C(0.45);
    for (let x = L - 1; x <= R; x++) g.set(x, s.top - 1, '▄', wc);
    for (let y = s.top; y < rows; y++) { g.set(L - 1, y, '▐', wc); g.set(R, y, '▌', wc); }
    for (let x = Math.round(s.px - s.pw / 2); x < Math.round(s.px + s.pw / 2); x++) g.set(x, s.py, '█', C(0.95));
    g.set(Math.round(s.px - s.pw / 2) - 1, s.py, '▐', C(0.7)); g.set(Math.round(s.px + s.pw / 2), s.py, '▌', C(0.7));
    for (const b of s.balls) g.set(b.x, b.y / A, b.fire > 0 ? '◉' : '●', b.fire > 0 ? (hue ? H(35, 1) : C(1)) : hue ? H(b.hue, 1) : C(1));
    // 計分板
    txt(g, L, 0, 'SCORE ' + String(s.score).padStart(6, '0'), C(0.7));
    ctext(g, 0, 'STAGE ' + s.level, C(0.55));
    if (!(p.balls > 1)) { const lv = '♥'.repeat(Math.max(0, s.lives)); txt(g, R - lv.length, 0, lv, hue ? H(350, 0.8) : C(0.8)); }
    if (s.msgT > 0) {
      const fit = bigFit(s.msg, s.W * 0.6, rows * 0.16, A), yy = Math.round(rows * 0.6);
      drawBig(g, s.msg, (f.cols - fit.w) / 2, yy, fit.sx, fit.sy, C(0.95));
    }
  } });

/* ════════════ 3. 方塊堆疊 ════════════ */
const TET_SRC = ['####', '##/##', '###/.#.', '.##/##.', '##./.##', '#../###', '..#/###'];
const PEN_SRC = ['.##/##./.#.', '#####', '####/#...', '##../.###', '##/##/#.', '###/.#./.#.', '#.#/###', '#../#../###', '#../##./.##', '.#./###/.#.', '####/.#..', '##./.#./.##'];
function tCells(str) { const out = []; str.split('/').forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') out.push([x, y]); }); return out; }
function tNorm(cells) { let mx = 1e9, my = 1e9; for (const [x, y] of cells) { mx = Math.min(mx, x); my = Math.min(my, y); } return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); }
const tKey = cells => cells.map(c => c.join(',')).join(';');
function tRots(cells) { const out = [], seen = new Set(); let c = tNorm(cells); for (let r = 0; r < 4; r++) { const k = tKey(c); if (!seen.has(k)) { seen.add(k); out.push(c); } c = tNorm(c.map(([x, y]) => [-y, x])); } return out; }
function tSet(srcs, mirror) {
  const set = [], seen = new Set();
  for (const src of srcs) {
    const base = tCells(src);
    for (const cells of mirror ? [base, base.map(([x, y]) => [-x, y])] : [base]) {
      const rots = tRots(cells), k = rots.map(tKey).sort()[0];
      if (seen.has(k)) continue; seen.add(k);
      set.push({ rots: rots.map(c => ({ c, w: Math.max(...c.map(q => q[0])) + 1, h: Math.max(...c.map(q => q[1])) + 1 })) });
    }
  }
  return set;
}
const TETS = tSet(TET_SRC, false), PENTS = tSet(PEN_SRC, true);
const GARB = 250;
function tbMake(W, H, set, o) {
  const b = { W, H, set, o, cells: new Uint8Array(W * H), tmp: new Uint8Array(W * H), full: new Uint8Array(H), top: new Int16Array(W), queue: [], cur: null,
    phase: 'spawn', acc: 0, t: 0, lines: 0, score: 0, n: 0, clr: [], clrT: 0, overT: 0, waitT: 0, gAcc: 0, trails: [], best: 0 };
  return b;
}
function tbReset(b) { b.cells.fill(0); b.best = Math.max(b.best, b.score); b.lines = 0; b.score = 0; b.n = 0; b.phase = 'spawn'; b.cur = null; b.gAcc = 0; if (b.o.prefill) tbPrefill(b, b.o.prefill); }
// 開局先鋪幾排「只缺一格」的底，消行馬上就開始
function tbPrefill(b, frac) {
  const W = b.W, H = b.H, n = Math.round(H * frac), ns = b.set.length;
  let hole = rint(0, W - 1);
  for (let y = H - n; y < H; y++) {
    if (Math.random() < 0.5) hole = rint(0, W - 1);
    let x = 0;
    while (x < W) { const len = rint(2, 4), id = rint(1, ns); for (let k = 0; k < len && x < W; k++, x++) b.cells[y * W + x] = x === hole ? 0 : id; }
  }
}
function tbNext(b) {
  while (b.queue.length < 5) {
    const bag = b.set.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    b.queue.push(...bag);
  }
  return b.queue.shift();
}
function tbFits(b, R, x, y) {
  for (const [cx, cy] of R.c) { const X = x + cx, Y = y + cy; if (X < 0 || X >= b.W || Y >= b.H) return false; if (Y >= 0 && b.cells[Y * b.W + X]) return false; }
  return true;
}
function tbTops(b) { for (let x = 0; x < b.W; x++) { let y = 0; while (y < b.H && !b.cells[y * b.W + x]) y++; b.top[x] = y; } }
function tbLand(b, R, x) { let y = 1e9; for (const [cx, cy] of R.c) y = Math.min(y, b.top[x + cx] - 1 - cy); return y; }
function tbEval(b, R, x, y) {
  const W = b.W, H = b.H, t = b.tmp, full = b.full, w = b.o.wts;
  t.set(b.cells);
  for (const [cx, cy] of R.c) t[(y + cy) * W + x + cx] = 1;
  let lines = 0;
  const y1 = Math.min(H, y + R.h);
  for (let yy = y; yy < y1; yy++) { let fl = 1; for (let i = yy * W, e = i + W; i < e; i++) if (!t[i]) { fl = 0; break; } full[yy] = fl; lines += fl; }
  let agg = 0, holes = 0, bump = 0, prev = -1, maxH = 0;
  for (let xx = 0; xx < W; xx++) {
    let first = -1, hl = 0;
    for (let yy = 0; yy < H; yy++) {
      if (yy >= y && yy < y1 && full[yy]) continue;
      const v = t[yy * W + xx];
      if (first < 0) { if (v) first = yy; } else if (!v) hl++;
    }
    let hgt = 0;
    if (first >= 0) { hgt = H - first; for (let yy = Math.max(first, y); yy < y1; yy++) if (full[yy]) hgt--; }
    agg += hgt; holes += hl; if (prev >= 0) bump += Math.abs(hgt - prev); prev = hgt; if (hgt > maxH) maxH = hgt;
  }
  return w[0] * agg + w[1] * lines + w[2] * holes + w[3] * bump - (maxH > H * 0.7 ? (maxH - H * 0.7) * 2 : 0);
}
function tbSpawn(b) {
  const id = tbNext(b), pc = b.set[id];
  tbTops(b);
  let best = -1e18, br = 0, bx = 0;
  for (let r = 0; r < pc.rots.length; r++) {
    const R = pc.rots[r];
    for (let x = 0; x + R.w <= b.W; x++) {
      const y = tbLand(b, R, x); if (y < 0) continue;
      const sc = tbEval(b, R, x, y) + (b.o.noise ? rnd(-b.o.noise, b.o.noise) : 0);
      if (sc > best) { best = sc; br = r; bx = x; }
    }
  }
  if (b.o.direct) { // 直接從目標欄的正上方落下
    if (best === -1e18 || !tbFits(b, pc.rots[br], bx, 0)) { b.phase = 'over'; b.overT = 0; return; }
    b.cur = { id, pc, r: br, x: bx, y: 0, tr: br, tx: bx, g: 0 }; b.n++; b.phase = 'drop'; return;
  }
  const R0 = pc.rots[0], sx = Math.floor((b.W - R0.w) / 2);
  if (best === -1e18 || !tbFits(b, R0, sx, 0)) { b.phase = 'over'; b.overT = 0; return; }
  b.cur = { id, pc, r: 0, x: sx, y: 0, tr: br, tx: bx, g: 0 };
  b.n++;
  if (b.o.instant) {
    const R = pc.rots[br], y = tbLand(b, R, bx);
    b.cur.r = br; b.cur.x = bx; b.cur.y = y;
    b.trails.push({ x: bx, w: R.w, y1: y, t: 0.35, id });
    tbLock(b); return;
  }
  b.phase = 'move';
}
function tbLock(b) {
  const c = b.cur, R = c.pc.rots[c.r];
  for (const [cx, cy] of R.c) { const Y = c.y + cy; if (Y < 0) { b.phase = 'over'; b.overT = 0; b.cur = null; return; } b.cells[Y * b.W + c.x + cx] = c.id + 1; }
  b.cur = null; b.clr.length = 0;
  for (let y = 0; y < b.H; y++) { let fl = true; for (let x = 0; x < b.W; x++) if (!b.cells[y * b.W + x]) { fl = false; break; } if (fl) b.clr.push(y); }
  if (b.clr.length) { b.phase = 'clear'; b.clrT = 0; b.lines += b.clr.length; b.score += [0, 100, 300, 500, 800, 1200][Math.min(5, b.clr.length)]; }
  else { b.phase = 'wait'; b.waitT = b.o.wait || 0; }
  b.score += 1;
}
function tbCollapse(b) {
  const W = b.W, keep = [];
  for (let y = 0; y < b.H; y++) if (!b.clr.includes(y)) keep.push(y);
  const nc = new Uint8Array(W * b.H);
  let dst = b.H - 1;
  for (let k = keep.length - 1; k >= 0; k--, dst--) nc.set(b.cells.subarray(keep[k] * W, keep[k] * W + W), dst * W);
  b.cells.set(nc); b.clr.length = 0;
}
function tbGarbage(b) {
  const W = b.W;
  for (let x = 0; x < W; x++) if (b.cells[x]) { b.phase = 'over'; b.overT = 0; return; }
  b.cells.copyWithin(0, W);
  const hole = b.lastHole !== undefined && Math.random() < 0.7 ? b.lastHole : rint(0, W - 1);
  b.lastHole = hole;
  for (let x = 0; x < W; x++) b.cells[(b.H - 1) * W + x] = x === hole ? 0 : GARB;
}
function tbUpdate(b, dt) {
  b.t += dt;
  for (let k = b.trails.length - 1; k >= 0; k--) { b.trails[k].t -= dt; if (b.trails[k].t <= 0) b.trails.splice(k, 1); }
  if (b.phase === 'over') { b.overT += dt; if (b.overT > 2.4) tbReset(b); return; }
  if (b.phase === 'clear') { b.clrT += dt; if (b.clrT < b.o.clearT) return; tbCollapse(b); b.phase = 'wait'; b.waitT = b.o.wait || 0; }
  if (b.phase === 'wait') {
    b.waitT -= dt; if (b.waitT > 0) return;
    if (b.o.garbage) { b.gAcc += Math.max(dt, b.o.wait || 0.05); }
    b.phase = 'spawn';
  }
  if (b.o.garbage && b.gAcc > b.o.garbage) { b.gAcc = 0; tbGarbage(b); if (b.phase === 'over') return; }
  if (b.phase === 'spawn') { tbSpawn(b); if (b.phase !== 'move' && b.phase !== 'drop') return; b.acc = 0; }
  b.acc += dt;
  for (let guard = 0; guard < 400 && (b.phase === 'move' || b.phase === 'drop'); guard++) {
    const step = b.phase === 'move' ? b.o.mt : b.o.dropT;
    if (b.acc < step) break;
    b.acc -= step;
    const c = b.cur, rots = c.pc.rots;
    if (b.phase === 'move') {
      if (c.r !== c.tr) { const nr = (c.r + 1) % rots.length; if (tbFits(b, rots[nr], c.x, c.y)) c.r = nr; else c.tr = c.r, c.tx = c.x; }
      else if (c.x !== c.tx) { const nx = c.x + Math.sign(c.tx - c.x); if (tbFits(b, rots[c.r], nx, c.y)) c.x = nx; else c.tx = c.x; }
      else b.phase = 'drop';
      c.g += step;
      if (c.g >= b.o.grav) { c.g = 0; if (tbFits(b, rots[c.r], c.x, c.y + 1)) c.y++; else { tbLock(b); break; } }
    } else if (tbFits(b, rots[c.r], c.x, c.y + 1)) c.y++;
    else { tbLock(b); break; }
  }
}
const T_HUES = [190, 55, 290, 120, 0, 225, 30, 160, 330, 90, 260, 15, 200, 75, 310, 140, 240, 45];
function tbCell(g, X, Y, cw, ch, st, cHi, cMid, cLo) {
  if (st === 'retro') {
    for (let dy = 0; dy < ch; dy++) for (let dx = 0; dx < cw; dx++) g.set(X + dx, Y + dy, dx === 0 ? '[' : dx === cw - 1 ? ']' : '=', cMid);
    return;
  }
  if (st === 'bevel') {
    for (let dy = 0; dy < ch; dy++) for (let dx = 0; dx < cw; dx++) {
      const e = dy === 0 || dx === 0 ? 2 : dy === ch - 1 || dx === cw - 1 ? 0 : 1;
      const inner = dx > 1 && dx < cw - 2 && dy > 0 && dy < ch - 1 && (dx + dy) % 3 === 0;
      g.set(X + dx, Y + dy, e === 1 ? (inner ? '▓' : '█') : '█', e === 2 ? cHi : e === 0 ? cLo : cMid);
    }
    return;
  }
  for (let dy = 0; dy < ch; dy++) for (let dx = 0; dx < cw; dx++) {
    const lastC = dx === cw - 1 && cw > 1, lastR = dy === ch - 1 && ch > 1;
    const c = lastR ? (lastC ? ' ' : '▀') : lastC ? '▌' : '█';
    if (c !== ' ') g.set(X + dx, Y + dy, c, dy === 0 && ch > 2 ? cHi : lastR ? cLo : cMid);
  }
}
function tbDraw(f, b, bx, by, cw, ch, st, label) {
  const { g, C, H } = f, W = b.W, Hh = b.H, hueOn = st !== 'retro';
  const colOf = (id, l) => (id === GARB ? C(0.3 * l + 0.1) : hueOn ? H(T_HUES[(id - 1) % T_HUES.length], l) : C(l));
  const bc = C(0.5), x1 = bx + W * cw, y1 = by + Hh * ch;
  fillRect(g, bx, by, W * cw, Hh * ch, ' ', bc);
  if (st === 'retro') {
    for (let y = by; y < y1; y++) { txt(g, bx - 2, y, '<!', bc); txt(g, x1, y, '!>', bc); }
    txt(g, bx - 2, y1, '<!' + '='.repeat(W * cw) + '!>', bc);
    txt(g, bx, y1 + 1, '\\/'.repeat((W * cw) >> 1), bc);
  } else {
    for (let y = by; y < y1; y++) { g.set(bx - 1, y, '║', bc); g.set(x1, y, '║', bc); }
    for (let x = bx; x < x1; x++) g.set(x, y1, '═', bc);
    g.set(bx - 1, y1, '╚', bc); g.set(x1, y1, '╝', bc);
  }
  const prog = b.phase === 'clear' ? b.clrT / b.o.clearT : 0, overRows = b.phase === 'over' ? Math.min(Hh, Math.floor((b.overT / 1.4) * Hh)) : 0;
  const ex = cw >> 1, ey = ch >> 1, dotC = C(0.13);
  for (let y = 0; y < Hh; y++) {
    const clearing = prog > 0 && b.clr.includes(y), over = y >= Hh - overRows;
    for (let x = 0; x < W; x++) {
      const v = b.cells[y * W + x], X = bx + x * cw, Y = by + y * ch;
      if (over && v) { tbCell(g, X, Y, cw, ch, st === 'retro' ? 'retro' : 'plain', C(0.3), C(0.25), C(0.15)); continue; }
      if (clearing) {
        if (Math.abs(x + 0.5 - W / 2) / (W / 2) < prog) continue;
        tbCell(g, X, Y, cw, ch, st, C(1), C(1), C(0.8)); continue;
      }
      if (v) tbCell(g, X, Y, cw, ch, st, colOf(v, 1), colOf(v, 0.78), colOf(v, 0.45));
      else g.set(X + ex, Y + ey, st === 'retro' ? '.' : '·', dotC);
    }
  }
  // 落點預覽與目前方塊
  const c = b.cur;
  if (c && b.phase !== 'over') {
    const R = c.pc.rots[c.r];
    let gy = c.y; while (tbFits(b, R, c.x, gy + 1)) gy++;
    if (st !== 'retro') for (const [cx, cy] of R.c) fillRect(g, bx + (c.x + cx) * cw, by + (gy + cy) * ch, cw - (cw > 1 ? 1 : 0), ch, '░', colOf(c.id + 1, 0.35));
    for (const [cx, cy] of R.c) if (c.y + cy >= 0) tbCell(g, bx + (c.x + cx) * cw, by + (c.y + cy) * ch, cw, ch, st, colOf(c.id + 1, 1), colOf(c.id + 1, 0.85), colOf(c.id + 1, 0.5));
  }
  for (const tr of b.trails) {
    const a = tr.t / 0.35;
    for (let x = tr.x * cw; x < (tr.x + tr.w) * cw - 1; x++) for (let y = 0; y < tr.y1 * ch; y++) {
      if (hash(x, y + ((b.t * 20) | 0)) > a * 0.6) continue;
      g.set(bx + x, by + y, '│', colOf(tr.id + 1, 0.25 + 0.5 * a * (y / (tr.y1 * ch))));
    }
  }
  if (label) ctextAt(g, bx + (W * cw) / 2, by - 2, label, C(0.7));
}
function tbPiece(f, pc, id, x, y, cw, ch, st) {
  const R = pc.rots[0];
  for (const [cx, cy] of R.c) tbCell(f.g, x + cx * cw, y + cy * ch, cw, ch, st, f.H(T_HUES[id % T_HUES.length], 1), f.H(T_HUES[id % T_HUES.length], 0.78), f.H(T_HUES[id % T_HUES.length], 0.45));
}
const T_WTS = [-0.510066, 0.760666, -0.35663, -0.184483];
A({ id: 'ga-tetris', name: '方塊堆疊', cat: '遊戲', theme: 'cyber', hue: true, desc: 'AI 自己轉方塊、找位置、消行',
  params: { layout: 'single', W: 10, H: 20, set: 'tet', style: 'plain', mt: 0.07, dropT: 0.025, grav: 0.4, clearT: 0.35, wait: 0.05, garbage: 0, instant: 0 },
  variants: [
    { id: 'wide', name: '寬版戰場', theme: 'ocean', desc: '整個螢幕寬的超大盤面', params: { layout: 'full', W: 0, H: 0, mt: 0.018, dropT: 0.012, grav: 0.3, garbage: 1.3 } },
    { id: 'trio', name: '三台對戰', theme: 'neon', desc: '三種個性的 AI 同時比賽', params: { layout: 'trio' } },
    { id: 'pento', name: '五格方塊', theme: 'sunset', desc: '十八種五格方塊的進階版', params: { set: 'pen', W: 12, H: 24 } },
    { id: 'turbo', name: '極速模式', theme: 'fire', desc: '一瞬間落下、拖出殘影', params: { instant: 1, wait: 0.07, clearT: 0.18, W: 14, layout: 'turbo' } },
    { id: 'retro', name: '終端機風', theme: 'amber', hue: false, desc: '用 [ ] 括號拼出的老派畫面', params: { style: 'retro', layout: 'retro' } },
    { id: 'garbage', name: '垃圾行', theme: 'blood', desc: '底部不斷冒出垃圾行', params: { garbage: 3.2 } },
    { id: 'giant', name: '巨型方塊', theme: 'lavender', desc: '超大立體方塊填滿畫面', params: { W: 8, H: 12, style: 'bevel', layout: 'giant', mt: 0.11, dropT: 0.045 } },
  ],
  init(s, f) {
    const { cols, rows, aspect: A, p } = f;
    const set = p.set === 'pen' ? PENTS : TETS;
    const o = (extra) => Object.assign({ wts: T_WTS, mt: p.mt, dropT: p.dropT, grav: p.grav, clearT: p.clearT, wait: p.wait, garbage: p.garbage, instant: p.instant, noise: 0 }, extra);
    s.boards = [];
    if (p.layout === 'trio') {
      let ch = Math.max(1, Math.floor((rows - 5) / p.H)), cw = Math.max(2, Math.round(ch * A));
      while (ch > 1 && 3 * (p.W * cw + 2) + 8 > cols) { ch--; cw = Math.max(2, Math.round(ch * A)); }
      const bwid = p.W * cw, gap = Math.floor((cols - 3 * bwid) / 4), by = Math.max(2, Math.floor((rows - p.H * ch - 1) / 2) + 1);
      const names = ['穩健型', '積極型', '隨性型'], namesEn = ['Steady', 'Aggressive', 'Carefree'];
      const opts = [o({}), o({ wts: [-0.3, 1.4, -0.5, -0.12] }), o({ noise: 1.6, mt: p.mt * 0.8 })];
      for (let k = 0; k < 3; k++) s.boards.push({ b: tbMake(p.W, p.H, set, opts[k]), x: gap + k * (bwid + gap), y: by, cw, ch, name: names[k], nameEn: namesEn[k] });
    } else if (p.layout === 'full') {
      const ch = Math.max(1, Math.round(rows / 30)), cw = Math.max(2, Math.round(ch * A));
      const H = Math.floor((rows - 3) / ch), W = Math.floor((cols - 4) / cw);
      const b = tbMake(W, H, set, o({ noise: 0.35, direct: 1, prefill: 0.35 }));
      tbPrefill(b, 0.35);
      s.boards.push({ b, x: Math.floor((cols - W * cw) / 2), y: 1, cw, ch });
    } else {
      let ch = Math.max(1, Math.floor((rows - 3) / p.H)), cw = Math.max(2, Math.round(ch * A));
      if (p.W * cw > cols * 0.8) { cw = Math.max(2, Math.floor((cols * 0.8) / p.W)); }
      const bx = Math.floor((cols - p.W * cw) / 2), by = Math.max(1, Math.floor((rows - 1 - p.H * ch) / 2));
      s.boards.push({ b: tbMake(p.W, p.H, set, o({})), x: bx, y: by, cw, ch });
    }
    s.dust = mkDust((cols * rows) / 90, cols, rows);
  },
  frame(s, f) {
    const { g, C, H, p, cols, rows, aspect: A, t } = f;
    if (p.layout !== 'full' && p.layout !== 'retro') drawDust(g, s.dust, t, C, 0.14);
    for (const B of s.boards) { tbUpdate(B.b, f.dt); tbDraw(f, B.b, B.x, B.y, B.cw, B.ch, p.style, tr(f, B.name, B.nameEn)); }
    if (p.layout === 'trio') {
      for (const B of s.boards) { const str = tr(f, '分數 ' + B.b.score + '　行 ' + B.b.lines, 'Score ' + B.b.score + '  Lines ' + B.b.lines); ctextAt(g, B.x + (B.b.W * B.cw) / 2, B.y + B.b.H * B.ch + 1, str, C(0.6)); }
      return;
    }
    const B = s.boards[0], b = B.b, x1 = B.x + b.W * B.cw + 2, lw = B.x - 3, en = f.lang === 'en';
    if (p.layout === 'full') {
      txt(g, B.x, 0, tr(f, '分數 ' + b.score + '　消除 ' + b.lines + ' 行　方塊 ' + b.n, 'Score ' + b.score + '  Lines ' + b.lines + '  Pieces ' + b.n), C(0.7));
      return;
    }
    // 左邊：分數 / 消除行數 / 方塊數；右邊：接下來的方塊
    const items = en ? [['Score', b.score], ['Lines', b.lines], ['Pieces', b.n], ['Best', Math.max(b.best, b.score)]]
      : [['分數', b.score], ['消除', b.lines], ['方塊', b.n], ['最高', Math.max(b.best, b.score)]];
    const bigOK = lw > 46 && rows > 40, sy = rows > 70 ? 2 : 1, sx = Math.round(sy * A);
    let y = B.y + 1;
    for (const [lab, val] of items) {
      const str = String(val);
      if (p.style === 'retro') { txt(g, Math.max(1, lw - 22), y, en ? (lab + ':').padEnd(8) + str : (lab + '：').padEnd(4) + str, C(0.8)); y += 2; continue; }
      if (bigOK) {
        const w = fontW(str, F3) * sx;
        txt(g, lw - g.textW(lab), y, lab, C(0.5));
        drawBig(g, str, lw - w, y + 2, sx, sy, C(0.85), F3);
        y += 5 * sy + 4;
      } else { txt(g, Math.max(1, lw - 12), y, lab, C(0.5)); txt(g, Math.max(1, lw - 12) + (en ? 7 : 5), y, str, C(0.85)); y += 2; }
    }
    const nx = x1 + 3, ncw = p.style === 'retro' ? 2 : Math.max(2, B.cw >> 1), nch = p.style === 'retro' ? 1 : Math.max(1, B.ch >> 1);
    if (nx + 4 * ncw < cols) {
      txt(g, nx, B.y + 1, p.style === 'retro' ? 'NEXT:' : tr(f, '下一個', 'Next'), C(0.5));
      let ny = B.y + 3;
      for (let k = 0; k < Math.min(3, b.queue.length); k++) {
        const id = b.queue[k], pc = b.set[id], R = pc.rots[0];
        if (ny + R.h * nch > rows - 1) break;
        if (p.style === 'retro') { for (const [cx, cy] of R.c) txt(g, nx + cx * 2, ny + cy, '[]', C(k ? 0.5 : 0.9)); }
        else tbPiece(f, pc, id, nx, ny, ncw, nch, p.style === 'bevel' ? 'plain' : p.style);
        ny += (R.h + 1) * nch + 1;
      }
    }
    if (p.layout === 'turbo') {
      const pps = b.n / Math.max(1, b.t);
      txt(g, nx, rows - 3, tr(f, '每秒 ' + pps.toFixed(1) + ' 塊', pps.toFixed(1) + ' pieces/s'), C(0.6));
    }
  } });

/* ════════════ 4. 太空射擊 ════════════ */
const SH = {
  shipL: ['    ▲    ', '   ▐█▌   ', ' ▄▄███▄▄ ', '◄██▀ ▀██►'],
  shipS: ['  ▲  ', ' ▐█▌ ', '◄█▀█►'],
  enL: [[' ▄███▄ ', '██▀█▀██', ' ▀▄ ▄▀ '], [' ▄███▄ ', '██▀█▀██', '▄▀   ▀▄'], ['▄▀▀▀▀▀▄', '█ ■ ■ █', ' ▀▄▀▄▀ '], ['▄▀▀▀▀▀▄', '█ ■ ■ █', '▀▄▀ ▀▄▀'],
    ['  ▄█▄  ', '▄█▀█▀█▄', '▀ ▀ ▀ ▀'], ['  ▄█▄  ', '▄█▀█▀█▄', ' ▀ ▀ ▀ ']],
  enS: [['▄█▀█▄', '▀▄ ▄▀'], ['▄█▀█▄', '▀   ▀'], ['█▀█▀█', '▀ ▀ ▀'], ['█▀█▀█', ' ▀ ▀ '], [' ▄█▄ ', '▀▀▀▀▀'], [' ▄█▄ ', '▀ ▀ ▀']],
};
const SH_T = [0.05, 0.15, 0.3, 0.45, 0.65, 0.9];
const SH_HUE = [120, 300, 45];
function shBoom(s, x, y, n, hue, spd) {
  for (let k = 0; k < n && s.parts.length < 900; k++) {
    const a = rnd(0, TAU), v = rnd(0.2, 1) * spd;
    s.parts.push({ x, y, vx: Math.cos(a) * v, vy: (Math.sin(a) * v) / s.A, l: rnd(0.4, 1.1), l0: 1.1, hue: hue + rnd(-20, 20) });
  }
}
function shBunkers(s, f) {
  const bw = s.big ? 16 : 8, bh = s.big ? 4 : 2, y = s.ships[0].y - bh - (s.big ? 3 : 2);
  s.bunk = [];
  for (let k = 0; k < 4; k++) {
    const x = Math.round((f.cols * (k + 1)) / 5 - bw / 2), cells = new Uint8Array(bw * bh);
    for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) {
      const corner = r === 0 && (c < bh / 2 || c >= bw - bh / 2), gap = r === bh - 1 && c > bw * 0.3 && c < bw * 0.7;
      cells[r * bw + c] = corner || gap ? 0 : 1;
    }
    s.bunk.push({ x, y, w: bw, h: bh, cells });
  }
}
function shBunkHit(s, x, y) {
  if (!s.bunk) return false;
  for (const b of s.bunk) {
    const c = Math.floor(x - b.x), r = Math.floor(y - b.y);
    if (c < 0 || r < 0 || c >= b.w || r >= b.h || !b.cells[r * b.w + c]) continue;
    b.cells[r * b.w + c] = 0;
    for (let k = 0; k < 3; k++) { const cc = c + rint(-1, 1), rr = r + rint(-1, 1); if (cc >= 0 && rr >= 0 && cc < b.w && rr < b.h && Math.random() < 0.5) b.cells[rr * b.w + cc] = 0; }
    return true;
  }
  return false;
}
function shBoss(s, f) {
  const { cols, rows } = f, w = (clamp(Math.round(cols * 0.32), 15, 71) >> 1) * 2 + 1, h = clamp(Math.round(rows * 0.22), 5, 17), half = (w + 1) >> 1, seed = rnd(0, 100);
  const mask = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - (w - 1) / 2) / half, dy = Math.abs((y / (h - 1)) * 2 - 1);
      const v = Noise.n3(Math.abs(x - (w - 1) / 2) * 0.3, y * 0.45, seed) + 0.55 * (1 - dx) - 0.35 * dy * dy - 0.1;
      row += v > 0.18 ? '█' : v > 0.08 ? '▓' : v > 0.02 ? '░' : ' ';
    }
    mask.push(row);
  }
  const ey = Math.floor(h * 0.45), ex = Math.floor(w * 0.3);
  const put = (x, y, c) => { mask[y] = mask[y].slice(0, x) + c + mask[y].slice(x + 1); };
  put(ex, ey, '●'); put(w - 1 - ex, ey, '●');
  s.boss = { w, h, mask, x: (cols - w) / 2, y: 2, hp: s.big ? 160 : 90, hp0: s.big ? 160 : 90, t: 0, pat: 0, emit: 0, ang: 0, flash: 0, dying: 0, hue: rnd(0, 360) };
}
function shWave(s, f) {
  const { cols, rows, p } = f, m = p.mode;
  s.wave++; s.en.length = 0; s.eb.length = 0;
  s.msg = m === 'boss' ? 'WARNING' : 'WAVE ' + s.wave; s.msgT = 1.8;
  if (m === 'formation' || m === 'bunker' || m === 'duo') {
    const nc = clamp(Math.floor((cols * (m === 'duo' ? 0.62 : 0.55)) / (s.ew + 2)), 5, 18), nr = s.big ? 5 : 4;
    s.fx = Math.floor((cols - nc * (s.ew + 2)) / 2); s.fy = 2; s.fdir = 1; s.total = nc * nr;
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) s.en.push({ gx: c * (s.ew + 2), gy: r * (s.eh + 1), type: r === 0 ? 2 : r < 3 ? 1 : 0, x: 0, y: 0, vx: 0, vy: 0 });
    if (m === 'bunker' && (!s.bunk || s.wave % 3 === 1)) shBunkers(s, f);
  } else if (m === 'swarm') {
    const n = s.big ? 26 : 13;
    s.path = { ax: rnd(0.3, 0.4) * cols, ay: rnd(0.15, 0.22) * rows, w1: rnd(0.35, 0.55), w2: rnd(0.7, 1.15), ph: rnd(0, TAU) };
    const lag = (1.5 * (s.ew + 2)) / (s.path.ax * s.path.w1);
    for (let k = 0; k < n; k++) s.en.push({ type: k % 3, lag: k * lag, dive: 0, x: -99, y: -99, vx: 0, vy: 0, dt: 0 });
  } else if (m === 'boss') shBoss(s, f);
  else if (m === 'hell') {
    const n = s.big ? 5 : 3;
    for (let k = 0; k < n; k++) shEmitter(s, f, k, n);
  }
}
function shEmitter(s, f, k, n) {
  s.en.push({ k, hx: (f.cols * (k + 0.5)) / n, hy: f.rows * rnd(0.15, 0.32), arms: rint(3, 7), spin: rnd(0.6, 1.6) * (Math.random() < 0.5 ? -1 : 1), hp: s.big ? 22 : 14, ph: rnd(0, TAU), rate: rnd(0.07, 0.12), acc: 0, hue: rnd(0, 360), x: 0, y: 0, vx: 0, vy: 0, w: 3, h: 1 });
}
function shShoot(s, x, y, ang, sp, hue, ch) {
  if (s.eb.length >= s.ebMax) return;
  s.eb.push({ x, y, vx: Math.cos(ang) * sp, vy: (Math.sin(ang) * sp) / s.A, hue, ch });
}
A({ id: 'ga-shooter', name: '太空射擊', cat: '遊戲', theme: 'cyber', hue: true, desc: '自動閃避、自動開火的太空射擊',
  params: { mode: 'formation' },
  variants: [
    { id: 'swarm', name: '蜂群來襲', theme: 'synth', desc: '敵機排成長蛇繞圈還會俯衝', params: { mode: 'swarm' } },
    { id: 'boss', name: '巨艦決戰', theme: 'blood', desc: '巨大母艦射出螺旋彈幕', params: { mode: 'boss' } },
    { id: 'hell', name: '彈幕花園', theme: 'neon', desc: '滿天花朵般的彈幕中穿梭', params: { mode: 'hell' } },
    { id: 'defense', name: '飛彈攔截', theme: 'fire', desc: '攔截飛彈保衛地面城市', params: { mode: 'defense' } },
    { id: 'bunker', name: '碉堡防線', theme: 'matrix', hue: false, desc: '躲在會被打穿的碉堡後方', params: { mode: 'bunker' } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f;
    s.A = aspect; s.t = 0; s.parts = [];
    s.stars = Array.from({ length: Math.round((cols * rows) / 55) }, () => ({ x: rnd(0, cols), y: rnd(0, rows), z: rint(0, 2) }));
    if (p.mode === 'defense') { dfInit(s, f); return; }
    s.big = rows >= 50;
    s.ss = s.big ? SH.shipL : SH.shipS; s.sw = s.ss[0].length; s.shh = s.ss.length;
    s.es = s.big ? SH.enL : SH.enS; s.ew = s.es[0][0].length; s.eh = s.es[0].length;
    s.ships = [];
    const n = p.mode === 'duo' ? 2 : 1;
    for (let k = 0; k < n; k++) s.ships.push({ x: (cols * (k + 1)) / (n + 1) - s.sw / 2, y: rows - s.shh - 1, cool: 0, dead: 0, inv: 0, hue: k ? 190 : 50, k, goal: cols / 2 });
    s.shots = []; s.eb = []; s.en = []; s.rocks = []; s.score = 0; s.hi = 0; s.wave = 0; s.msgT = 0; s.waveT = 0;
    s.shotV = rows * 0.75; s.ebMax = p.mode === 'hell' ? (s.big ? 1100 : 380) : 400; s.bunk = null; s.rockT = 0;
    if (p.mode === 'rocks') { s.msg = 'METEOR FIELD'; s.msgT = 1.8; } else shWave(s, f);
  },
  frame(s, f) {
    const { g, cols, rows, dt, C, H, p } = f, A = s.A;
    s.t += dt;
    // 星空
    for (const st of s.stars) {
      st.y += (1.5 + st.z * st.z * 4.5) * dt * (p.mode === 'rocks' ? 2 : 1);
      if (st.y >= rows) { st.y -= rows; st.x = rnd(0, cols); }
      g.set(st.x, st.y, st.z === 2 ? '·' : '.', C(0.12 + st.z * 0.12));
    }
    if (p.mode === 'defense') { dfFrame(s, f); return; }
    const m = p.mode, big = s.big, ew = s.ew, eh = s.eh;
    if (s.msgT > 0) s.msgT -= dt;
    // ── 敵人更新 ──
    if (m === 'formation' || m === 'bunker' || m === 'duo') {
      const alive = s.en.length, sp = cols * (0.035 + 0.12 * (1 - alive / s.total)) + s.wave * 0.6;
      s.fx += s.fdir * sp * dt;
      let mn = 1e9, mx = -1e9, my = 0;
      for (const e of s.en) { mn = Math.min(mn, e.gx); mx = Math.max(mx, e.gx + ew); my = Math.max(my, e.gy + eh); }
      if ((s.fdir > 0 && s.fx + mx > cols - 1) || (s.fdir < 0 && s.fx + mn < 1)) { s.fdir = -s.fdir; s.fy += 1; s.fx = clamp(s.fx, 1 - mn, cols - 1 - mx); }
      for (const e of s.en) { e.x = s.fx + e.gx; e.y = s.fy + e.gy; e.vx = s.fdir * sp; e.vy = 0; e.w = ew; e.h = eh; }
      if (alive && s.fy + my >= s.ships[0].y - 1) { for (const e of s.en) shBoom(s, e.x + ew / 2, e.y + eh / 2, 6, SH_HUE[e.type], 20); s.wave--; shWave(s, f); }
      if (alive && Math.random() < dt * (0.9 + s.wave * 0.12) * (big ? 1.6 : 1)) {
        const e = pick(s.en);
        let low = e; for (const o of s.en) if (o.gx === e.gx && o.gy > low.gy) low = o;
        shShoot(s, low.x + ew / 2, low.y + eh, Math.PI / 2, rows * 0.32 * A, SH_HUE[low.type], '!');
      }
    } else if (m === 'swarm') {
      const P = s.path;
      for (const e of s.en) {
        const tt = s.t - e.lag;
        const px = cols / 2 + P.ax * Math.sin(P.w1 * tt + P.ph) - ew / 2, py = rows * 0.3 + P.ay * Math.sin(P.w2 * tt) - eh / 2;
        if (tt < 0) { e.x = -99; continue; }
        if (e.dive === 0) {
          e.vx = (px - e.x) / Math.max(dt, 1e-3); e.vy = (py - e.y) / Math.max(dt, 1e-3);
          if (e.x < -50) { e.vx = e.vy = 0; } e.x = px; e.y = py;
          if (Math.random() < dt * 0.06 && e.y > 0) { e.dive = 1; e.vx = (s.ships[0].x + s.sw / 2 - e.x) * 0.35; e.vy = rows * 0.42; }
        } else if (e.dive === 1) {
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.y > rows + 1) { e.dive = 2; e.y = -eh - 1; e.dt = 0; }
        } else {
          e.dt += dt; const k = Math.min(1, e.dt / 1.4);
          e.x = lerp(e.x, px, k * 0.25 + 0.02); e.y = lerp(e.y, py, k * 0.25 + 0.02); e.vx = 0; e.vy = 0;
          if (k >= 1) e.dive = 0;
        }
        e.w = ew; e.h = eh;
        if (e.x > -50 && Math.random() < dt * 0.12) shShoot(s, e.x + ew / 2, e.y + eh, Math.atan2((s.ships[0].y - e.y) * A, s.ships[0].x - e.x), rows * 0.3 * A, SH_HUE[e.type], '•');
      }
      if (!s.en.length) { s.waveT += dt; if (s.waveT > 1.2) { s.waveT = 0; shWave(s, f); } }
    } else if (m === 'rocks') {
      s.rockT -= dt;
      if (s.rockT <= 0 && s.rocks.length < (big ? 26 : 12)) {
        s.rockT = rnd(0.35, 0.9) * (big ? 0.7 : 1.2);
        const r = big ? rint(2, 7) : rint(1, 3);
        s.rocks.push({ x: rnd(r, cols - r), y: -r / A - 1, r, vx: rnd(-3, 3), vy: rnd(3, 8) * (rows / 60), rot: rnd(0, 10), vr: rnd(-1, 1), hp: r * 2, seed: rnd(0, 99), hit: 0 });
      }
      for (let k = s.rocks.length - 1; k >= 0; k--) {
        const q = s.rocks[k]; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.hit = Math.max(0, q.hit - dt);
        if (q.y - q.r / A > rows || q.x < -q.r * 2 || q.x > cols + q.r * 2) s.rocks.splice(k, 1);
      }
    } else if (m === 'boss') {
      const b = s.boss;
      if (b) {
        b.t += dt; b.flash = Math.max(0, b.flash - dt);
        b.x = (cols - b.w) / 2 + Math.sin(b.t * 0.45) * (cols - b.w) * 0.42; b.y = 2 + Math.sin(b.t * 0.9) * (big ? 1.5 : 0.5);
        const cx = b.x + b.w / 2, cy = b.y + b.h * 0.7;
        if (b.dying > 0) {
          b.dying -= dt;
          if (Math.random() < dt * 25) shBoom(s, b.x + rnd(0, b.w), b.y + rnd(0, b.h), 10, rnd(0, 60), 30);
          if (b.dying <= 0) { shBoom(s, cx, cy, 120, 40, 60); s.boss = null; s.waveT = 0; s.score += 5000; }
        } else if (s.msgT <= 0) {
          b.pat = Math.floor(b.t / 5) % 4; b.emit -= dt;
          const sh0 = s.ships[0], aim = Math.atan2((sh0.y - cy) * A, sh0.x + s.sw / 2 - cx), sp = rows * 0.28 * A;
          if (b.emit <= 0) {
            if (b.pat === 0) { b.emit = 0.035; b.ang += 0.37; shShoot(s, cx, cy, b.ang, sp, b.hue, '•'); shShoot(s, cx, cy, b.ang + Math.PI, sp, b.hue + 60, '•'); }
            else if (b.pat === 1) { b.emit = 0.6; for (let k = -4; k <= 4; k++) shShoot(s, cx, cy, aim + k * 0.13, sp * 1.2, b.hue + 120, '◆'); }
            else if (b.pat === 2) { b.emit = 0.9; const n = big ? 30 : 18, o = rnd(0, 1); for (let k = 0; k < n; k++) shShoot(s, cx, cy, ((k + o) * TAU) / n, sp * 0.8, b.hue + 200, 'o'); }
            else { b.emit = 0.06; shShoot(s, b.x + rnd(0, b.w), b.y + b.h, Math.PI / 2 + rnd(-0.2, 0.2), sp * rnd(0.8, 1.3), b.hue + 280, '¦'); }
          }
        }
      } else { s.waveT += dt; if (s.waveT > 2.2) shWave(s, f); }
    } else if (m === 'hell') {
      for (let k = s.en.length - 1; k >= 0; k--) {
        const e = s.en[k];
        if (e.respawn !== undefined) { e.respawn -= dt; if (e.respawn <= 0) { const kk = e.k; s.en.splice(k, 1); shEmitter(s, f, kk, big ? 5 : 3); } continue; }
        e.ph += dt;
        e.x = e.hx + Math.sin(e.ph * 0.4) * cols * 0.06 - 1; e.y = e.hy + Math.sin(e.ph * 0.55) * rows * 0.05; e.vx = Math.cos(e.ph * 0.4) * 0.4 * cols * 0.06; e.vy = 0;
        e.acc += dt;
        if (s.msgT <= 0) while (e.acc > e.rate) {
          e.acc -= e.rate;
          const base = e.ph * e.spin;
          for (let a = 0; a < e.arms; a++) shShoot(s, e.x + 1, e.y + 0.5, base + (a * TAU) / e.arms, rows * 0.16 * A, e.hue + a * 12, '•');
        }
      }
    }
    // ── 戰機 AI ──
    const threats = s.thr || (s.thr = []);
    for (const sh of s.ships) {
      if (sh.dead > 0) { sh.dead -= dt; if (sh.dead <= 0) { sh.inv = 2; sh.x = cols / 2 - s.sw / 2; } continue; }
      sh.inv = Math.max(0, sh.inv - dt);
      const half = s.sw / 2, y0 = sh.y - 0.5, y1 = sh.y + s.shh + 0.5;
      threats.length = 0;
      const addT = (x, y, vx, vy, r) => {
        for (let k = 0; k < SH_T.length; k++) { const t = SH_T[k], yy = y + vy * t; if (yy >= y0 - r / A && yy <= y1 + r / A) threats.push(x + vx * t, r, 1.3 - t); }
      };
      for (const b of s.eb) if (b.y < y1 + 1) addT(b.x, b.y, b.vx, b.vy, 0.6);
      for (const q of s.rocks) addT(q.x, q.y, q.vx, q.vy, q.r);
      if (m === 'swarm') for (const e of s.en) if (e.dive === 1) addT(e.x + ew / 2, e.y + eh / 2, e.vx, e.vy, ew / 2);
      // 瞄準
      let aimX = cols / 2, bd = 1e9;
      const targets = m === 'rocks' ? s.rocks : m === 'boss' ? (s.boss && s.boss.dying <= 0 ? [{ x: s.boss.x, y: s.boss.y, w: s.boss.w, h: s.boss.h, vx: 0 }] : []) : s.en;
      for (const e of targets) {
        if (e.respawn !== undefined || e.x < -50) continue;
        const w = e.w !== undefined ? e.w : 0, hh = e.h !== undefined ? e.h : 0;
        const ex = m === 'rocks' ? e.x : e.x + w / 2, ey = m === 'rocks' ? e.y : e.y + hh / 2, tt = Math.max(0, (sh.y - ey) / s.shotV);
        const lead = ex + (e.vx || 0) * tt;
        if (lead < 1 || lead > cols - 1) continue;
        const d = Math.abs(lead - (sh.x + half)) - ey * 0.4 + (s.ships.length > 1 ? Math.abs(lead - cols * (sh.k ? 0.7 : 0.3)) * 0.5 : 0) + (m === 'rocks' ? -e.r * 3 : 0);
        if (d < bd) { bd = d; aimX = lead; }
      }
      const R = big ? 26 : 12;
      let best = sh.x, bc = 1e18;
      for (let c = Math.max(1, Math.floor(sh.x - R)); c <= Math.min(cols - s.sw - 1, Math.ceil(sh.x + R)); c++) {
        const cx = c + half;
        let dg = 0;
        for (let k = 0; k < threats.length; k += 3) if (Math.abs(threats[k] - cx) < half + threats[k + 1] + 1.2) dg += threats[k + 2];
        const cost = dg * 60 + Math.abs(cx - aimX) * 0.1 + Math.abs(c - sh.x) * 0.02 + (s.ships.length > 1 ? Math.max(0, 6 - Math.abs(cx - (s.ships[1 - sh.k].x + half))) * 3 : 0);
        if (cost < bc) { bc = cost; best = c; }
      }
      const mv = (big ? 75 : 32) * dt;
      sh.x = clamp(sh.x + clamp(best - sh.x, -mv, mv), 1, cols - s.sw - 1);
      sh.cool -= dt;
      if (sh.cool <= 0 && s.msgT <= 0.5) { sh.cool = m === 'hell' || m === 'boss' ? 0.09 : 0.2; s.shots.push({ x: sh.x + half - 0.5, y: sh.y - 1, hue: sh.hue }); }
    }
    // ── 子彈 ──
    for (let k = s.shots.length - 1; k >= 0; k--) {
      const q = s.shots[k], qy0 = q.y; q.y -= s.shotV * dt;
      let hit = q.y < 0 || shBunkHit(s, q.x, q.y);
      if (!hit && m === 'rocks') {
        for (let j = s.rocks.length - 1; j >= 0; j--) {
          const r = s.rocks[j];
          if (Math.hypot(q.x - r.x, (clamp(r.y, q.y, qy0) - r.y) * A) < r.r + 0.5) {
            hit = true; r.hp--; r.hit = 0.12; s.score += 5;
            if (r.hp <= 0) {
              shBoom(s, r.x, r.y, r.r * 6, 35, 18 + r.r * 4); s.rocks.splice(j, 1); s.score += 50 * r.r;
              if (r.r >= (big ? 3 : 2)) for (let d = -1; d <= 1; d += 2) { const nr = Math.floor(r.r / 2) + (big ? 1 : 0); s.rocks.push({ x: r.x + d * nr, y: r.y, r: nr, vx: r.vx + d * rnd(4, 9), vy: r.vy * rnd(0.8, 1.2), rot: 0, vr: rnd(-2, 2), hp: nr * 2, seed: rnd(0, 99), hit: 0 }); }
            }
            break;
          }
        }
      } else if (!hit && m === 'boss' && s.boss && s.boss.dying <= 0) {
        const b = s.boss, cx = Math.floor(q.x - b.x);
        let cy = -1;
        if (cx >= 0 && cx < b.w) for (let yy = Math.floor(qy0 - b.y); yy >= Math.floor(q.y - b.y); yy--) if (yy >= 0 && yy < b.h && b.mask[yy][cx] !== ' ') { cy = yy; break; }
        if (cy >= 0) { hit = true; b.hp--; if (b.flash <= 0 && b.t - (b.lastF === undefined ? -9 : b.lastF) > 0.4) { b.flash = 0.1; b.lastF = b.t; } s.score += 10; if (Math.random() < 0.3) shBoom(s, q.x, q.y, 3, 40, 12); if (b.hp <= 0) b.dying = 1.8; }
      } else if (!hit) {
        for (let j = s.en.length - 1; j >= 0; j--) {
          const e = s.en[j];
          if (e.respawn !== undefined || q.x < e.x - 0.5 || q.x > e.x + e.w + 0.5 || qy0 < e.y || q.y > e.y + e.h) continue;
          hit = true;
          if (m === 'hell') { e.hp--; if (e.hp <= 0) { shBoom(s, e.x + 1, e.y, 60, e.hue, 35); e.respawn = 1.5; s.score += 1000; } }
          else { shBoom(s, e.x + ew / 2, e.y + eh / 2, big ? 16 : 9, SH_HUE[e.type], big ? 22 : 12); s.en.splice(j, 1); s.score += [10, 20, 40][e.type] * 10; }
          break;
        }
        if ((m === 'formation' || m === 'bunker' || m === 'duo') && !s.en.length && s.msgT <= 0) shWave(s, f);
      }
      if (hit) s.shots.splice(k, 1);
    }
    for (let k = s.eb.length - 1; k >= 0; k--) {
      const b = s.eb[k]; b.x += b.vx * dt; b.y += b.vy * dt;
      let gone = b.y > rows || b.y < -2 || b.x < -1 || b.x > cols + 1 || shBunkHit(s, b.x, b.y);
      if (!gone) for (const sh of s.ships) {
        if (sh.dead > 0 || sh.inv > 0) continue;
        if (b.x > sh.x + 1 && b.x < sh.x + s.sw - 1 && b.y > sh.y && b.y < sh.y + s.shh) { gone = true; sh.dead = 1.6; shBoom(s, sh.x + s.sw / 2, sh.y + 1, 60, 30, 40); s.hi = Math.max(s.hi, s.score); }
      }
      if (gone) { s.eb[k] = s.eb[s.eb.length - 1]; s.eb.pop(); }
    }
    // 隕石或俯衝敵機撞到戰機
    for (const sh of s.ships) {
      if (sh.dead > 0 || sh.inv > 0) continue;
      for (const q of s.rocks) if (Math.abs(q.x - (sh.x + s.sw / 2)) < q.r + s.sw / 2 - 1 && Math.abs(q.y - (sh.y + 1)) * A < q.r + 1) { sh.dead = 1.6; shBoom(s, sh.x + s.sw / 2, sh.y + 1, 60, 30, 40); break; }
      if (m === 'swarm') for (const e of s.en) if (e.dive === 1 && Math.abs(e.x - sh.x) < s.sw - 1 && Math.abs(e.y - sh.y) < s.shh) { sh.dead = 1.6; shBoom(s, sh.x + s.sw / 2, sh.y + 1, 60, 30, 40); break; }
    }
    s.hi = Math.max(s.hi, s.score);
    // ── 繪圖 ──
    const fr = ((s.t * 2.5) | 0) & 1;
    if (s.bunk) for (const b of s.bunk) for (let r = 0; r < b.h; r++) for (let c = 0; c < b.w; c++) if (b.cells[r * b.w + c]) g.set(b.x + c, b.y + r, '█', C(0.55));
    if (m === 'rocks') for (const q of s.rocks) {
      const rr = q.r, ry = rr / A;
      for (let y = Math.floor(q.y - ry); y <= Math.ceil(q.y + ry); y++) for (let x = Math.floor(q.x - rr); x <= Math.ceil(q.x + rr); x++) {
        const dx = x + 0.5 - q.x, dy = (y + 0.5 - q.y) * A, d = Math.hypot(dx, dy) / rr;
        if (d > 1) continue;
        const a = Math.atan2(dy, dx) + q.rot, n = hash(Math.floor(a * 3 + q.seed), Math.floor(d * 3));
        const lum = 0.35 + 0.45 * (1 - d) + (dx < 0 && dy < 0 ? 0.15 : 0);
        g.set(x, y, d > 0.82 ? (n > 0.5 ? '#' : '%') : n > 0.66 ? '@' : n > 0.33 ? '#' : '*', q.hit > 0 ? C(1) : H(30 + n * 20, lum));
      }
    }
    if (m === 'boss' && s.boss) {
      const b = s.boss;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
        const c = b.mask[y][x]; if (c === ' ') continue;
        const fl = b.flash > 0 ? 0.18 : 0;
        const col = c === '●' ? H(b.hue + 180, 1) : H(b.hue + y * 4, (c === '█' ? 0.55 + 0.3 * (1 - y / b.h) : c === '▓' ? 0.45 : 0.3) + fl);
        g.set(b.x + x, b.y + y, c, col);
      }
      const bw = Math.round(cols * 0.5), bx = Math.round((cols - bw) / 2), fill = Math.round((bw * Math.max(0, b.hp)) / b.hp0);
      for (let k = 0; k < bw; k++) g.set(bx + k, rows - 1, k < fill ? '█' : '░', k < fill ? H(b.hue, 0.7) : C(0.2));
    }
    for (const e of s.en) {
      if (e.x < -50) continue;
      if (m === 'hell') {
        if (e.respawn !== undefined) continue;
        const sp = '✦*+'[((s.t * 8) | 0) % 3];
        g.set(e.x + 1, e.y, sp, H(e.hue, 1)); g.set(e.x, e.y, '<', H(e.hue, 0.7)); g.set(e.x + 2, e.y, '>', H(e.hue, 0.7));
        continue;
      }
      g.sprite(e.x, e.y, s.es[e.type * 2 + fr], H(SH_HUE[e.type] + (m === 'swarm' ? e.lag * 20 : 0), e.dive === 1 ? 1 : 0.8));
    }
    for (const q of s.shots) { g.set(q.x, q.y, '│', H(q.hue, 1)); if (big) g.set(q.x, q.y + 1, '│', H(q.hue, 0.6)); }
    for (const b of s.eb) g.set(b.x, b.y, b.ch, H(b.hue, 0.95));
    for (let k = s.parts.length - 1; k >= 0; k--) {
      const q = s.parts[k]; q.l -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 1.5; q.vy *= 1 - dt * 1.5;
      if (q.l <= 0) { s.parts[k] = s.parts[s.parts.length - 1]; s.parts.pop(); continue; }
      const a = q.l / q.l0;
      g.set(q.x, q.y, a > 0.7 ? '*' : a > 0.4 ? '+' : a > 0.2 ? '·' : '.', H(q.hue, 0.3 + a * 0.7));
    }
    for (const sh of s.ships) {
      if (sh.dead > 0 || (sh.inv > 0 && ((s.t * 6) | 0) % 2)) continue;
      g.sprite(sh.x, sh.y, s.ss, H(sh.hue, 0.95));
      const fl = ((s.t * 12) | 0) % 2 ? '▼' : 'v';
      g.set(sh.x + s.sw / 2 - (big ? 1.5 : 0.5), sh.y + s.shh, fl, H(20, 0.8)); if (big) g.set(sh.x + s.sw / 2 + 0.5, sh.y + s.shh, fl, H(20, 0.8));
    }
    txt(g, 1, 0, 'SCORE ' + String(s.score).padStart(7, '0'), C(0.7));
    txt(g, cols - 15, 0, 'HI ' + String(s.hi).padStart(7, '0'), C(0.55));
    if (s.msgT > 0) { const fit = bigFit(s.msg, cols * 0.5, rows * 0.13, A); drawBig(g, s.msg, (cols - fit.w) / 2, rows * 0.45, fit.sx, fit.sy, m === 'boss' ? H(0, 0.9) : C(0.9)); }
  } });

/* ── 飛彈攔截（飛彈指揮官式玩法） ── */
const DF_CITY_L = [' ▄█▄  ▄ ', '▐███▌██▄', '████████'], DF_CITY_S = ['▄█ ▄', '████'];
function dfInit(s, f) {
  const { cols, rows } = f;
  s.big = rows >= 50; s.gy = rows - (s.big ? 3 : 2);
  s.cityS = s.big ? DF_CITY_L : DF_CITY_S;
  const slots = 9, cw = s.cityS[0].length;
  s.cities = []; s.bases = [];
  for (let k = 0; k < slots; k++) {
    const x = Math.round(((k + 0.5) * cols) / slots);
    if (k % 4 === 0) s.bases.push({ x, ammo: 12, cool: 0 });
    else s.cities.push({ x: x - cw / 2, alive: true });
  }
  s.ms = []; s.ic = []; s.ex = []; s.wave = 0; s.score = 0; s.msgT = 0;
  dfWave(s, f);
}
function dfWave(s, f) {
  s.wave++; s.left = 10 + s.wave * 4; s.spawnT = 1.5; s.msg = 'WAVE ' + s.wave; s.msgT = 2;
  for (const b of s.bases) b.ammo = s.big ? 18 : 12;
}
function dfFrame(s, f) {
  const { g, cols, rows, dt, C, H } = f, A = s.A, gy = s.gy;
  if (s.msgT > 0) s.msgT -= dt;
  // 產生來襲飛彈
  s.spawnT -= dt;
  if (s.left > 0 && s.spawnT <= 0 && s.msgT <= 0.5) {
    s.spawnT = rnd(0.4, 1.5) / (1 + s.wave * 0.12); s.left--;
    const tg = [...s.cities.filter(c => c.alive).map(c => c.x + s.cityS[0].length / 2), ...s.bases.map(b => b.x)];
    const x0 = rnd(0, cols), tx = pick(tg);
    s.ms.push({ x0, y0: 0, x: x0, y: 0, tx, ty: gy, v: (rows * 0.09 + s.wave * 0.4) * A, mirv: Math.random() < 0.25 && s.wave > 1 ? rnd(0.25, 0.5) : 0, tgt: false });
  }
  for (let k = s.ms.length - 1; k >= 0; k--) {
    const q = s.ms[k], dx = q.tx - q.x, dy = (q.ty - q.y) * A, d = Math.hypot(dx, dy);
    const st = q.v * dt;
    if (d <= st) {
      s.ms.splice(k, 1); s.ex.push({ x: q.tx, y: q.ty, r: 0, R: s.big ? 7 : 4, t: 0, hue: 10 });
      for (const c of s.cities) if (c.alive && Math.abs(c.x + s.cityS[0].length / 2 - q.tx) < 3) { c.alive = false; }
      for (const b of s.bases) if (Math.abs(b.x - q.tx) < 2) b.ammo = 0;
      continue;
    }
    q.x += (dx / d) * st; q.y += (dy / d) * st / A;
    if (q.mirv && q.y > gy * q.mirv) {
      q.mirv = 0;
      const tg = s.cities.filter(c => c.alive);
      for (let n = 0; n < 2 && tg.length; n++) s.ms.push({ x0: q.x, y0: q.y, x: q.x, y: q.y, tx: pick(tg).x + s.cityS[0].length / 2, ty: gy, v: q.v, mirv: 0, tgt: false });
    }
  }
  // AI：替每顆還沒被鎖定的飛彈發射攔截彈
  for (const b of s.bases) b.cool -= dt;
  const icV = rows * 1.1 * A;
  const order = s.ms.filter(q => !q.tgt && q.y > rows * 0.12).sort((a, b) => b.y - a.y);
  for (const q of order) {
    let bb = null, bd = 1e9;
    for (const b of s.bases) if (b.ammo > 0 && b.cool <= 0) { const d = Math.abs(b.x - q.x); if (d < bd) { bd = d; bb = b; } }
    if (!bb) break;
    const dx = q.tx - q.x, dy = (q.ty - q.y) * A, d = Math.hypot(dx, dy) || 1, ux = (dx / d) * q.v, uy = (dy / d) * q.v / A;
    let px = q.x, py = q.y;
    for (let it = 0; it < 3; it++) { const t = Math.hypot(px - bb.x, (py - gy) * A) / icV + 0.25; px = q.x + ux * t; py = q.y + uy * t; }
    if (py > gy - 2) continue;
    s.ic.push({ x0: bb.x, y0: gy - 1, x: bb.x, y: gy - 1, tx: px + rnd(-0.5, 0.5), ty: py });
    bb.ammo--; bb.cool = 0.22; q.tgt = true;
  }
  for (let k = s.ic.length - 1; k >= 0; k--) {
    const q = s.ic[k], dx = q.tx - q.x, dy = (q.ty - q.y) * A, d = Math.hypot(dx, dy), st = icV * dt;
    if (d <= st) { s.ic.splice(k, 1); s.ex.push({ x: q.tx, y: q.ty, r: 0, R: s.big ? 6.5 : 3.6, t: 0, hue: 50 }); continue; }
    q.x += (dx / d) * st; q.y += (dy / d) * st / A;
  }
  for (let k = s.ex.length - 1; k >= 0; k--) {
    const e = s.ex[k]; e.t += dt;
    e.r = e.t < 0.5 ? (e.t / 0.5) * e.R : e.t < 0.8 ? e.R : Math.max(0, e.R * (1 - (e.t - 0.8) / 0.5));
    if (e.t > 1.3) { s.ex.splice(k, 1); continue; }
    for (let j = s.ms.length - 1; j >= 0; j--) {
      const q = s.ms[j];
      if (Math.hypot(q.x - e.x, (q.y - e.y) * A) < e.r) { s.ms.splice(j, 1); s.score += 25; s.ex.push({ x: q.x, y: q.y, r: 0, R: s.big ? 4 : 2.5, t: 0, hue: 30 }); }
    }
  }
  if (!s.cities.some(c => c.alive)) { s.msg = 'GAME OVER'; if (s.msgT <= 0 && !s.over) { s.over = 1; s.msgT = 3; } }
  if (s.over && s.msgT <= 0) { s.over = 0; for (const c of s.cities) c.alive = true; s.wave = 0; s.score = 0; s.ms.length = 0; dfWave(s, f); }
  else if (!s.over && s.left <= 0 && !s.ms.length && !s.ex.length) { s.score += 100 * s.cities.filter(c => c.alive).length; if (s.wave % 2 === 0) { const dead = s.cities.find(c => !c.alive); if (dead) dead.alive = true; } dfWave(s, f); }
  // 繪圖
  for (const q of s.ms) { g.line(q.x0, q.y0, q.x, q.y, '·', H(0, 0.45)); g.set(q.x, q.y, '◆', H(10, 1)); }
  for (const q of s.ic) { g.line(q.x0, q.y0, q.x, q.y, '.', H(200, 0.5)); g.set(q.x, q.y, '+', H(190, 1)); g.set(q.tx, q.ty, 'x', H(190, 0.5)); }
  for (const e of s.ex) {
    const R = e.r, ry = R / A;
    for (let y = Math.floor(e.y - ry); y <= Math.ceil(e.y + ry); y++) for (let x = Math.floor(e.x - R); x <= Math.ceil(e.x + R); x++) {
      const d = Math.hypot(x + 0.5 - e.x, (y + 0.5 - e.y) * A) / Math.max(0.01, R);
      if (d > 1) continue;
      const n = hash(x * 7 + ((e.t * 20) | 0), y);
      g.set(x, y, d > 0.8 ? '*' : n > 0.5 ? '▓' : '▒', H(e.hue + n * 40 - d * 20, 1 - d * 0.5));
    }
  }
  for (let x = 0; x < cols; x++) { g.set(x, gy, '▀', H(30, 0.35)); for (let y = gy + 1; y < rows; y++) g.set(x, y, hash(x, y) < 0.3 ? '░' : ' ', H(30, 0.2)); }
  for (const c of s.cities) {
    if (c.alive) g.sprite(c.x, gy - s.cityS.length, s.cityS, H(200, 0.7));
    else g.sprite(c.x, gy - 1, [s.cityS[s.cityS.length - 1].replace(/█/g, '▄').replace(/[▀▐▌]/g, ' ')], C(0.25));
  }
  for (const b of s.bases) {
    g.set(b.x, gy - 1, '▲', H(120, 0.85)); g.set(b.x - 1, gy - 1, '▄', H(120, 0.5)); g.set(b.x + 1, gy - 1, '▄', H(120, 0.5));
    const am = Math.min(b.ammo, 9); for (let k = 0; k < am; k++) g.set(b.x - 4 + k, rows - 1, '|', H(120, 0.6));
  }
  txt(g, 1, 0, 'SCORE ' + String(s.score).padStart(7, '0'), C(0.7));
  txt(g, cols - 12, 0, 'WAVE ' + s.wave, C(0.55));
  if (s.msgT > 0) { const fit = bigFit(s.msg, cols * 0.5, rows * 0.13, A); drawBig(g, s.msg, (cols - fit.w) / 2, rows * 0.35, fit.sx, fit.sy, C(0.9)); }
}

/* ════════════ 5. 迷宮追逐 ════════════ */
const CH_D = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const CH_GH = [0, 320, 185, 30, 275, 120, 55, 210, 340, 160, 95, 15];
function chMaze(mw, mh, kind) {
  const W = new Uint8Array(mw * mh).fill(1), id = (x, y) => y * mw + x;
  if (kind === 'cave') {
    for (let y = 1; y < mh - 1; y++) for (let x = 1; x < mw - 1; x++) W[id(x, y)] = Math.random() < 0.485 ? 1 : 0;
    const T = new Uint8Array(mw * mh);
    for (let it = 0; it < 5; it++) {
      T.set(W);
      for (let y = 1; y < mh - 1; y++) for (let x = 1; x < mw - 1; x++) {
        let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += T[id(x + dx, y + dy)];
        W[id(x, y)] = n >= 5 || (it < 2 && n <= 1) ? 1 : 0;
      }
    }
    // 只留最大的連通區
    const lab = new Int32Array(mw * mh).fill(-1), q = new Int32Array(mw * mh);
    let best = -1, bestN = 0;
    for (let s0 = 0; s0 < mw * mh; s0++) {
      if (W[s0] || lab[s0] >= 0) continue;
      let h = 0, t = 0; q[t++] = s0; lab[s0] = s0;
      while (h < t) { const c = q[h++], x = c % mw, y = (c / mw) | 0; for (const [dx, dy] of CH_D) { const n = id(x + dx, y + dy); if (!W[n] && lab[n] < 0) { lab[n] = s0; q[t++] = n; } } }
      if (t > bestN) { bestN = t; best = s0; }
    }
    for (let k = 0; k < mw * mh; k++) if (!W[k] && lab[k] !== best) W[k] = 1;
    return W;
  }
  const nI = (mw - 1) >> 1, nJ = (mh - 1) >> 1, half = (nI + 1) >> 1;
  const open = (x, y) => { W[id(x, y)] = 0; W[id(mw - 1 - x, y)] = 0; };
  const seen = new Uint8Array(nI * nJ), st = [];
  const si = rint(0, half - 1), sj = rint(0, nJ - 1);
  seen[sj * nI + si] = 1; open(2 * si + 1, 2 * sj + 1); st.push(si, sj);
  while (st.length) {
    const j = st[st.length - 1], i = st[st.length - 2], nb = [];
    for (const [di, dj] of CH_D) { const a = i + di, b = j + dj; if (a >= 0 && a < half && b >= 0 && b < nJ && !seen[b * nI + a]) nb.push(di, dj); }
    if (!nb.length) { st.length -= 2; continue; }
    const k = rint(0, nb.length / 2 - 1) * 2, di = nb[k], dj = nb[k + 1], a = i + di, b = j + dj;
    seen[b * nI + a] = 1; open(2 * i + 1 + di, 2 * j + 1 + dj); open(2 * a + 1, 2 * b + 1); st.push(a, b);
  }
  // 拆掉死路，再多開幾個環
  for (let j = 0; j < nJ; j++) for (let i = 0; i < half; i++) {
    const x = 2 * i + 1, y = 2 * j + 1, cl = [];
    for (const [dx, dy] of CH_D) { const wx = x + dx, wy = y + dy; if (wx > 0 && wy > 0 && wx < mw - 1 && wy < mh - 1 && W[id(wx, wy)]) cl.push(wx, wy); }
    if (cl.length >= 6) { const k = rint(0, cl.length / 2 - 1) * 2; open(cl[k], cl[k + 1]); }
  }
  const loops = kind === 'arena' ? 0.42 : 0.07;
  for (let y = 1; y < mh - 1; y++) for (let x = 1; x <= mw >> 1; x++) if (W[id(x, y)] && (x + y) % 2 === 1 && Math.random() < loops) open(x, y);
  if (kind === 'arena') for (let y = 2; y < mh - 2; y += 2) for (let x = 2; x <= mw >> 1; x += 2) if (Math.random() < 0.25) { open(x, y); }
  // 中央的鬼屋
  const cx = (mw - 1) >> 1, cy = (mh - 1) >> 1;
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 3; x <= cx; x++) if (y > 0 && y < mh - 1 && x > 0) open(x, y);
  return W;
}
function chBFS(m, srcs, dist, allow) {
  const { mw, W, q } = m, N = W.length; dist.fill(32000);
  let h = 0, t = 0;
  for (const s0 of srcs) if (s0 >= 0 && s0 < N && dist[s0] !== 0) { dist[s0] = 0; q[t++] = s0; }
  while (h < t) {
    const c = q[h++], x = c % mw, y = (c / mw) | 0, d = dist[c] + 1;
    for (let k = 0; k < 4; k++) {
      const n = (y + CH_D[k][1]) * mw + x + CH_D[k][0];
      if (n < 0 || n >= N || W[n] || dist[n] <= d || (allow && !allow(n, d))) continue;
      dist[n] = d; q[t++] = n;
    }
  }
}
function chNew(s, f) {
  const p = f.p, m = s.m;
  m.W = chMaze(m.mw, m.mh, p.maze);
  m.pel = new Uint8Array(m.mw * m.mh); m.seen = new Uint8Array(m.mw * m.mh);
  const cx = (m.mw - 1) >> 1, cy = (m.mh - 1) >> 1;
  m.home = cy * m.mw + cx;
  if (m.W[m.home]) { for (let k = 0; k < m.W.length; k++) if (!m.W[k]) { m.home = k; break; } }
  m.dh = new Int16Array(m.mw * m.mh); chBFS(m, [m.home], m.dh);
  let n = 0;
  for (let k = 0; k < m.W.length; k++) {
    if (m.W[k] || m.dh[k] >= 32000) continue;
    const x = k % m.mw, y = (k / m.mw) | 0;
    if (Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 1) continue;
    if (p.maze === 'cave' && (x + y) % 2) continue;
    m.pel[k] = 1; n++;
  }
  const corners = [[1, 1], [m.mw - 2, 1], [1, m.mh - 2], [m.mw - 2, m.mh - 2], [cx, 1], [cx, m.mh - 2], [1, cy], [m.mw - 2, cy]];
  for (const [x0, y0] of corners.slice(0, p.power || 4)) {
    let bk = -1, bd = 1e9;
    for (let k = 0; k < m.W.length; k++) if (m.pel[k]) { const d = Math.abs((k % m.mw) - x0) + Math.abs(((k / m.mw) | 0) - y0); if (d < bd) { bd = d; bk = k; } }
    if (bk >= 0) m.pel[bk] = 2;
  }
  m.left = n; m.level = (m.level || 0) + 1; m.clearT = 0;
  chReset(s, f);
}
function chReset(s, f) {
  const p = f.p, m = s.m;
  // 玩家從離家最遠的一半中挑一格出發
  let far = [];
  for (let k = 0; k < m.W.length; k++) if (!m.W[k] && m.dh[k] < 32000 && m.dh[k] > 6) far.push(k);
  if (!far.length) far = [m.home];
  s.pl = [];
  for (let k = 0; k < (p.players || 1); k++) {
    const c = pick(far);
    s.pl.push({ x: c % m.mw, y: (c / m.mw) | 0, dx: 0, dy: 0, p: 0, spd: p.pspd || 6.5, hue: k ? 185 : 55, score: 0, dead: 0, k });
  }
  s.gh = [];
  for (let k = 0; k < p.ghosts; k++) s.gh.push({ x: m.home % m.mw, y: (m.home / m.mw) | 0, dx: 0, dy: 0, p: 0, spd: 5.6, hue: CH_GH[k % CH_GH.length], st: 'wait', wait: 1 + k * 1.2, k, fr: 0 });
  s.frT = 0; s.combo = 0; s.dieT = 0;
}
function chDirPlayer(s, pl) {
  const m = s.m, mw = m.mw, W = m.W;
  const here = pl.y * mw + pl.x, ghostSrc = [];
  for (const g of s.gh) if (g.st === 'chase' || (g.st === 'fright' && s.frT < 1.2)) { ghostSrc.push(g.y * mw + g.x); if (!W[(g.y + g.dy) * mw + g.x + g.dx]) ghostSrc.push((g.y + g.dy) * mw + g.x + g.dx); }
  chBFS(m, ghostSrc, m.dg);
  const dg = m.dg, others = s.pl.filter(o => o !== pl && o.dead <= 0).map(o => o.y * mw + o.x);
  chBFS(m, [here], m.dp, (n, d) => dg[n] > d + 1);
  // 目標：最近的豆子（或還在害怕的鬼）
  let best = -1, bd = 32000;
  const fr = new Set(); for (const g of s.gh) if (g.st === 'fright' && s.frT > 2) fr.add(g.y * mw + g.x);
  for (let k = 0; k < W.length; k++) {
    const d = m.dp[k]; if (d >= bd || d === 0) continue;
    let want = m.pel[k] ? (m.pel[k] === 2 && s.frT <= 0 ? -6 : 0) : fr.has(k) && d < 12 ? -8 : 1e9;
    if (want > 1e8) continue;
    for (const o of others) if (Math.abs((o % mw) - (k % mw)) + Math.abs(((o / mw) | 0) - ((k / mw) | 0)) < 5) want += 4;
    if (d + want < bd) { bd = d + want; best = k; }
  }
  if (best >= 0) {
    let c = best;
    for (let guard = 0; guard < 5000; guard++) {
      const x = c % mw, y = (c / mw) | 0; let prev = -1;
      for (const [dx, dy] of CH_D) { const n = (y + dy) * mw + x + dx; if (!W[n] && m.dp[n] === m.dp[c] - 1) { prev = n; break; } }
      if (prev < 0 || prev === here) break;
      c = prev;
    }
    const x = c % mw, y = (c / mw) | 0;
    if (Math.abs(x - pl.x) + Math.abs(y - pl.y) === 1) return [x - pl.x, y - pl.y];
  }
  // 逃跑：往離鬼最遠的方向
  let bdir = null, bv = -1;
  for (const [dx, dy] of CH_D) { const n = (pl.y + dy) * mw + pl.x + dx; if (W[n]) continue; const v = dg[n] + Math.random() * 0.5; if (v > bv) { bv = v; bdir = [dx, dy]; } }
  return bdir || [0, 0];
}
function chDirGhost(s, g, t) {
  const m = s.m, mw = m.mw, W = m.W, opts = [];
  for (const [dx, dy] of CH_D) { if (W[(g.y + dy) * mw + g.x + dx]) continue; if (dx === -g.dx && dy === -g.dy && (g.dx || g.dy)) continue; opts.push([dx, dy]); }
  if (!opts.length) return [-g.dx, -g.dy];
  if (g.st === 'eyes') { let b = opts[0], bv = 1e9; for (const o of opts) { const v = m.dh[(g.y + o[1]) * mw + g.x + o[0]]; if (v < bv) { bv = v; b = o; } } return b; }
  if (g.st === 'fright') return pick(opts);
  // 目標格
  const alive = s.pl.filter(p => p.dead <= 0), pl = alive.length ? alive.reduce((a, b) => (Math.abs(a.x - g.x) + Math.abs(a.y - g.y) < Math.abs(b.x - g.x) + Math.abs(b.y - g.y) ? a : b)) : s.pl[0];
  const scatter = (t % 27) < 7, k = g.k % 4;
  let tx, ty;
  if (scatter) { tx = k & 1 ? m.mw : 0; ty = k & 2 ? m.mh : 0; }
  else if (k === 0) { tx = pl.x; ty = pl.y; }
  else if (k === 1) { tx = pl.x + pl.dx * 4; ty = pl.y + pl.dy * 4; }
  else if (k === 2) { const g0 = s.gh[0]; tx = 2 * (pl.x + pl.dx * 2) - g0.x; ty = 2 * (pl.y + pl.dy * 2) - g0.y; }
  else { const d = Math.hypot(pl.x - g.x, pl.y - g.y); if (d > 8) { tx = pl.x; ty = pl.y; } else { tx = 0; ty = m.mh; } }
  if (g.k >= 4) { tx = pl.x + Math.round(Math.sin(t * 0.3 + g.k) * 6); ty = pl.y + Math.round(Math.cos(t * 0.37 + g.k) * 4); }
  let b = opts[0], bv = 1e18;
  for (const o of opts) { const v = (g.x + o[0] - tx) ** 2 + (g.y + o[1] - ty) ** 2 + Math.random() * 0.1; if (v < bv) { bv = v; b = o; } }
  return b;
}
function chStep(s, e, dt, decide) {
  const m = s.m;
  if (!e.dx && !e.dy) { const d = decide(); e.dx = d[0]; e.dy = d[1]; e.p = 0; if (!e.dx && !e.dy) return; }
  e.p += e.spd * dt;
  let guard = 0;
  while (e.p >= 1 && guard++ < 4) {
    e.x += e.dx; e.y += e.dy; e.p -= 1;
    if (e.onTile) e.onTile();
    const d = decide(); e.dx = d[0]; e.dy = d[1];
    if (m.W[(e.y + e.dy) * m.mw + e.x + e.dx] || (!e.dx && !e.dy)) { e.dx = 0; e.dy = 0; e.p = 0; break; }
  }
}
// 以字元格畫一個圓形角色（dir：嘴巴方向；shape：0 吃豆人、1 鬼）
function chSprite(g, X, Y, tw, th, shape, dirA, mouth, col, eyeCol, t, eyesOnly) {
  for (let dy = 0; dy < th; dy++) for (let dx = 0; dx < tw; dx++) {
    const u = ((dx + 0.5) / tw) * 2 - 1;
    let top = false, bot = false;
    for (let hh = 0; hh < 2; hh++) {
      const v = ((dy + 0.25 + hh * 0.5) / th) * 2 - 1;
      let inside;
      if (shape === 0) {
        inside = u * u + v * v <= 1.02;
        if (inside && mouth > 0) { let a = Math.atan2(v, u) - dirA; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) < mouth) inside = false; }
      } else if (v < 0) inside = u * u + v * v <= 1.02;
      else inside = Math.abs(u) <= 1.0 && (v < 0.55 || fract((u + 1) * 1.5 + t * 3) < 0.55);
      if (hh) bot = inside; else top = inside;
    }
    if (!top && !bot) continue;
    const isEye = shape === 1 && Math.abs(Math.abs(u) - 0.42) < 0.3 && dy === Math.max(0, Math.floor(th * 0.35 - 0.01));
    if (isEye) { g.set(X + dx, Y + dy, 'o', eyeCol); continue; }
    if (eyesOnly) continue;
    g.set(X + dx, Y + dy, top && bot ? '█' : top ? '▀' : '▄', col);
  }
}
A({ id: 'ga-chase', name: '迷宮追逐', cat: '遊戲', theme: 'ocean', hue: true, desc: '在迷宮裡吃豆子、躲開四隻鬼',
  params: { maze: 'maze', ghosts: 4, players: 1, power: 4, tile: 0, style: 'line', fog: 0, pspd: 6.5 },
  variants: [
    { id: 'arena', name: '開闊廣場', theme: 'mint', desc: '牆少路寬的開放式場地', params: { maze: 'arena', ghosts: 5, gspd: 5 } },
    { id: 'dark', name: '摸黑探險', theme: 'lavender', desc: '只看得到身邊一小圈的迷宮', params: { fog: 1 } },
    { id: 'solid', name: '實心牆', theme: 'amber', desc: '實心磚牆的厚重迷宮', params: { style: 'solid' } },
    { id: 'cave', name: '天然洞窟', theme: 'forest', desc: '彎彎曲曲的天然洞穴地形', params: { maze: 'cave', ghosts: 4, style: 'solid', gspd: 4.8 } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f;
    const th = p.tile || Math.max(1, Math.round(rows / 30)), tw = Math.max(1, Math.round(th * aspect));
    let mw = Math.floor(cols / tw), mh = Math.floor((rows - 1) / th);
    if (p.maze !== 'cave') { let nI = (mw - 1) >> 1; if (nI % 2 === 0) nI--; mw = nI * 2 + 1; if (mh % 2 === 0) mh--; }
    s.m = { mw, mh, tw, th, x0: Math.floor((cols - mw * tw) / 2), y0: 1 + Math.floor((rows - 1 - mh * th) / 2), q: new Int32Array(mw * mh), dg: new Int16Array(mw * mh), dp: new Int16Array(mw * mh), level: 0 };
    s.lives = 3; s.t = 0;
    chNew(s, f);
  },
  frame(s, f) {
    const { g, dt, C, H, p, cols, rows, aspect } = f, m = s.m, mw = m.mw, tw = m.tw, th = m.th;
    s.t += dt;
    const t = s.t;
    // ── 遊戲邏輯 ──
    if (m.clearT > 0) { m.clearT -= dt; if (m.clearT <= 0) chNew(s, f); }
    else if (s.dieT > 0) {
      s.dieT -= dt;
      if (s.dieT <= 0) { if (s.lives <= 0) { s.lives = 3; for (const pl of s.pl) pl.score = 0; m.level = 0; chNew(s, f); } else chReset(s, f); }
    } else {
      s.frT = Math.max(0, s.frT - dt);
      for (const pl of s.pl) {
        pl.onTile = () => {
          const k = pl.y * mw + pl.x, v = m.pel[k];
          if (v) { m.pel[k] = 0; m.left--; pl.score += v === 2 ? 50 : 10; if (v === 2) { s.frT = 7; s.combo = 0; for (const gg of s.gh) if (gg.st === 'chase') { gg.st = 'fright'; if (gg.dx || gg.dy) { gg.x += gg.dx; gg.y += gg.dy; gg.dx = -gg.dx; gg.dy = -gg.dy; gg.p = 1 - gg.p; } } } }
        };
        chStep(s, pl, dt, () => chDirPlayer(s, pl));
      }
      if (s.frT <= 0) for (const gg of s.gh) if (gg.st === 'fright') gg.st = 'chase';
      for (const gg of s.gh) {
        if (gg.st === 'wait') { gg.wait -= dt; if (gg.wait <= 0) gg.st = 'chase'; continue; }
        gg.spd = gg.st === 'eyes' ? 13 : gg.st === 'fright' ? 3.6 : (p.gspd || 5.6) + m.level * 0.15;
        gg.onTile = () => { if (gg.st === 'eyes' && gg.y * mw + gg.x === m.home) gg.st = 'chase'; };
        chStep(s, gg, dt, () => chDirGhost(s, gg, t));
      }
      // 碰撞
      for (const pl of s.pl) {
        const px = pl.x + pl.dx * pl.p, py = pl.y + pl.dy * pl.p;
        for (const gg of s.gh) {
          if (gg.st === 'wait' || gg.st === 'eyes') continue;
          const gx = gg.x + gg.dx * gg.p, gy = gg.y + gg.dy * gg.p;
          if (Math.abs(px - gx) + Math.abs(py - gy) > 0.7) continue;
          if (gg.st === 'fright') { gg.st = 'eyes'; s.combo++; pl.score += 100 * (1 << Math.min(4, s.combo)); }
          else { s.dieT = 1.8; s.lives--; s.deadPl = pl; break; }
        }
        if (s.dieT > 0) break;
      }
      if (m.left <= 0 && s.dieT <= 0) m.clearT = 2.5;
    }
    // ── 繪圖 ──
    const X0 = m.x0, Y0 = m.y0, W = m.W;
    const lead = s.pl[0], lx = lead.x + lead.dx * lead.p, ly = lead.y + lead.dy * lead.p, R = Math.max(5, m.mh * 0.22);
    const vis = (x, y) => { if (!p.fog) return 1; let b = 0; for (const pl of s.pl) { const d = Math.hypot(x - (pl.x + pl.dx * pl.p), y - (pl.y + pl.dy * pl.p)) / R; b = Math.max(b, 1 - d); } return b; };
    const pulse = m.clearT > 0 ? 0.5 + 0.5 * Math.cos(m.clearT * TAU * 1.2) : 0;
    const cx0 = tw >> 1, cy0 = th >> 1;
    if (p.aura) for (const gg of s.gh) {
      if (gg.st === 'wait' || gg.st === 'eyes') continue;
      const gx = gg.x + gg.dx * gg.p, gy = gg.y + gg.dy * gg.p, pr = 3.4 + 0.9 * Math.sin(t * 2.6 + gg.k * 1.7);
      const ax = X0 + (gx + 0.5) * tw, ay = Y0 + (gy + 0.5) * th, rx = pr * tw, ry = pr * th, hu = gg.st === 'fright' ? 230 : gg.hue;
      for (let yy = Math.floor(ay - ry); yy <= ay + ry; yy++) for (let xx = Math.floor(ax - rx); xx <= ax + rx; xx++) {
        const d = Math.hypot((xx + 0.5 - ax) / rx, (yy + 0.5 - ay) / ry); if (d > 1) continue;
        const ring = Math.abs(d - 0.88) < 0.1;
        g.set(xx, yy, ring ? '·' : '░', H(hu, ring ? 0.4 : 0.08 + 0.14 * (1 - d)));
      }
    }
    for (let y = 0; y < m.mh; y++) for (let x = 0; x < mw; x++) {
      const k = y * mw + x, X = X0 + x * tw, Y = Y0 + y * th;
      let b = vis(x, y);
      if (p.fog) { if (b > 0.05) m.seen[k] = 1; else if (!m.seen[k]) { if (W[k]) g.set(X + cx0, Y + cy0, '·', C(0.1)); continue; } }
      if (W[k]) {
        const lum = (p.fog ? 0.15 + 0.6 * b : 0.62 + pulse * 0.38) * (p.style === 'solid' ? 0.5 : 1), col = C(lum);
        if (p.style === 'solid') {
          const shade = (W[k - mw] === 0 || y === 0) ? '█' : '▓';
          for (let dy = 0; dy < th; dy++) for (let dx = 0; dx < tw; dx++) g.set(X + dx, Y + dy, dy === 0 && th > 1 ? shade : '▓', dy === 0 ? C(lum * 1.2) : C(lum * 0.8));
          if (th === 1) for (let dx = 0; dx < tw; dx++) g.set(X + dx, Y, shade, C(shade === '█' ? lum : lum * 0.8));
          continue;
        }
        const n = x < mw - 1 && W[k + 1], w = x > 0 && W[k - 1], s2 = y < m.mh - 1 && W[k + mw], nn = y > 0 && W[k - mw];
        const jc = boxChar(nn, n, s2, w);
        g.set(X + cx0, Y + cy0, jc, col);
        if (w) for (let dx = 0; dx < cx0; dx++) g.set(X + dx, Y + cy0, '═', col);
        if (n) for (let dx = cx0 + 1; dx < tw; dx++) g.set(X + dx, Y + cy0, '═', col);
        if (nn) for (let dy = 0; dy < cy0; dy++) g.set(X + cx0, Y + dy, '║', col);
        if (s2) for (let dy = cy0 + 1; dy < th; dy++) g.set(X + cx0, Y + dy, '║', col);
        continue;
      }
      const v = m.pel[k];
      if (!v || (p.fog && b <= 0.05)) continue;
      if (v === 2) { if (((t * 3) | 0) % 3 !== 0 || th > 1) g.set(X + cx0 - (tw > 2 ? 0 : 0), Y + cy0, '●', H(30, 0.9 * (p.fog ? b + 0.2 : 1))); }
      else g.set(X + cx0, Y + cy0, '·', H(35, (p.fog ? b : 0.75)));
    }
    // 鬼
    for (const gg of s.gh) {
      const gx = gg.x + gg.dx * gg.p, gy = gg.y + gg.dy * gg.p, b = vis(gx, gy);
      if (p.fog && b <= 0.05) continue;
      const X = Math.round(X0 + gx * tw), Y = Math.round(Y0 + gy * th);
      const blink = gg.st === 'fright' && s.frT < 2 && ((t * 4) | 0) % 2;
      const col = gg.st === 'fright' ? (blink ? C(0.95) : H(230, 0.7)) : H(gg.hue, 0.75 * (p.fog ? 0.3 + b : 1));
      const eye = rgb(235, 240, 255);
      if (th === 1) { g.set(X + cx0, Y, gg.st === 'eyes' ? '"' : 'Ω', gg.st === 'eyes' ? eye : col); continue; }
      chSprite(g, X, Y, tw, th, 1, 0, 0, col, gg.st === 'fright' ? rgb(255, 200, 200) : eye, t + gg.k, gg.st === 'eyes');
    }
    // 吃豆人
    for (const pl of s.pl) {
      const px = pl.x + pl.dx * pl.p, py = pl.y + pl.dy * pl.p, X = Math.round(X0 + px * tw), Y = Math.round(Y0 + py * th);
      const dying = s.dieT > 0 && s.deadPl === pl, col = H(pl.hue, 1);
      let mouth = 0.15 + 0.6 * Math.abs(Math.sin(t * 9));
      if (dying) mouth = Math.min(Math.PI, (1 - s.dieT / 1.8) * Math.PI * 1.1);
      const dirA = Math.atan2(pl.dy * aspect, pl.dx || (pl.dy ? 0 : 1));
      if (th === 1) {
        const open = mouth > 0.45;
        const ch = dying ? (s.dieT > 0.6 ? '*' : '.') : !open ? 'O' : pl.dx > 0 ? '<' : pl.dx < 0 ? '>' : pl.dy > 0 ? '^' : pl.dy < 0 ? 'V' : 'O';
        g.set(X + cx0, Y, ch, col);
      } else if (!dying || s.dieT > 0.2) chSprite(g, X, Y, tw, th, 0, dirA, mouth, col, col, t, false);
    }
    // 計分
    const sc = s.pl.map(pl => String(pl.score).padStart(6, '0')).join(' : ');
    txt(g, X0, 0, 'SCORE ' + sc, C(0.8));
    ctext(g, 0, m.clearT > 0 ? 'STAGE CLEAR!' : 'LEVEL ' + m.level, C(0.6));
    const lv = '● '.repeat(Math.max(0, s.lives)).trim();
    txt(g, X0 + mw * tw - lv.length, 0, lv, H(55, 0.9));
  } });
function boxChar(n, e, s2, w) {
  const k = (n ? 1 : 0) | (e ? 2 : 0) | (s2 ? 4 : 0) | (w ? 8 : 0);
  return ['■', '║', '═', '╚', '║', '║', '╔', '╠', '═', '╝', '═', '╩', '╗', '╣', '╦', '╬'][k];
}

/* ════════════ 6. 無盡奔跑 ════════════ */
// 依線段方向挑字元（y 以視覺單位計）
function segCh(dx, dyv) {
  const ax = Math.abs(dx), ay = Math.abs(dyv);
  if (ay < ax * 0.42) return '-';
  if (ax < ay * 0.42) return '|';
  return (dx > 0) === (dyv < 0) ? '/' : '\\';
}
function seg(g, x0, y0, x1, y1, col, A) { g.line(x0, y0, x1, y1, segCh(x1 - x0, (y1 - y0) * A), col); }
// 火柴人：腳底在 (x, yF)，身高 hr 列；ph 跑步相位；air 是否在空中；lean 前傾
const BS = String.fromCharCode(92);
const STICK_S = { a: [' o ', '/|' + BS, '/ >'], b: [' o ', '<|/', ' |' + BS], c: [' o ', BS + '|<', '< ' + BS], j: [BS + 'o/', ' | ', '/ ' + BS], d: ['   ', '   ', '_o/' + BS + '_'] };
function stick(g, x, yF, hr, ph, air, col, A, pose) {
  if (hr <= 4) {
    const fr = pose === 'down' ? STICK_S.d : air ? STICK_S.j : [STICK_S.a, STICK_S.b, STICK_S.c, STICK_S.b][((ph / (Math.PI / 2)) | 0) & 3];
    g.sprite(Math.round(x) - 1, Math.round(yF) - 3, fr, col);
    return;
  }
  const L = hr * 0.27, hipY = yF - hr * 0.48, nx = x + hr * 0.06 * A, ny = yF - hr * 0.8;
  const leg = (a1, a2) => {
    const kx = x + Math.sin(a1) * L * A, ky = hipY + Math.cos(a1) * L;
    const fx = kx + Math.sin(a2) * L * A, fy = ky + Math.cos(a2) * L;
    seg(g, x, hipY, kx, ky, col, A); seg(g, kx, ky, fx, fy, col, A);
  };
  if (pose === 'down') { // 跌倒：整個人躺平
    seg(g, x - hr * 0.5 * A, yF - 0.5, x + hr * 0.3 * A, yF - 0.5, col, A);
    g.set(x + hr * 0.42 * A, yF - 1, 'o', col); g.set(x - hr * 0.4 * A, yF - 1.2, '/', col); g.set(x - hr * 0.15 * A, yF - 1.4, '\\', col);
    return;
  }
  if (air) { leg(1.1, -0.3); leg(0.5, -0.6); }
  else for (let k = 0; k < 2; k++) {
    const p = ph + k * Math.PI, a1 = Math.sin(p) * 0.75, a2 = a1 - 0.25 - 1.0 * Math.max(0, -Math.cos(p));
    leg(a1, a2);
  }
  seg(g, x, hipY, nx, ny, col, A);
  for (let k = 0; k < 2; k++) {
    const p = ph + k * Math.PI + Math.PI, a1 = air ? -2.2 + k * 0.6 : Math.sin(p) * 0.9, sl = hr * 0.22;
    const ex = nx + Math.sin(a1) * sl * A, ey = ny + 0.3 + Math.cos(a1) * sl, a2 = a1 + 1.3;
    seg(g, nx, ny + 0.3, ex, ey, col, A); seg(g, ex, ey, ex + Math.sin(a2) * sl * 0.9 * A, ey + Math.cos(a2) * sl * 0.9, col, A);
  }
  const hy = ny - hr * 0.1;
  if (hr >= 8) { g.set(nx - 1, hy, '(', col); g.set(nx, hy, '█', col); g.set(nx + 1, hy, ')', col); g.set(nx, hy - 1, '▄', col); }
  else g.set(nx, hy, 'O', col);
}
const RN_W = {
  desert: { sky: 'sun', far: 'mesa', mid: 'dune', farC: [15, 0.15], midC: [35, 0.24], obs: ['cactus', 'cactus', 'rock', 'weed'], ground: 40, gap: 0, deco: 'cloud' },
  night: { sky: 'moon', far: 'peak', mid: 'pine', farC: [240, 0.14], midC: [150, 0.17], obs: ['log', 'stump', 'rock'], ground: 100, gap: 0, deco: 'fly' },
  roof: { sky: 'moon', far: 'city', mid: 'none', farC: [230, 0.12], midC: [0, 0], obs: ['ac', 'chimney', 'ac'], ground: 220, gap: 0.55, deco: 'star', roofs: 1 },
  snow: { sky: 'sun2', far: 'peak', mid: 'pine', farC: [210, 0.3], midC: [160, 0.17], obs: ['snowman', 'ice', 'rock'], ground: 200, gap: 0, deco: 'snow' },
  lava: { sky: 'volcano', far: 'peak', mid: 'none', farC: [5, 0.13], midC: [0, 0], obs: ['rock', 'rock'], ground: 10, gap: 0.5, deco: 'ember', lava: 1 },
  platform: { sky: 'sun', far: 'hill', mid: 'none', farC: [120, 0.15], midC: [0, 0], obs: ['box'], ground: 110, gap: 0.3, deco: 'cloud', steps: 1 },
  paper: { sky: 'sun3', far: 'peak', mid: 'none', farC: [0, 0.2], midC: [0, 0], obs: ['box', 'cactus', 'rock'], ground: 0, gap: 0, deco: 'bird', ink: 1 },
};
function rnLane(f, y0, H, world) {
  const L = { y0, H, w: RN_W[world], world, gy: y0 + Math.round(H * 0.8), hr: H < 36 ? 3 : clamp(Math.round(H * 0.16), 5, 16), x: 0, spd0: f.cols * 0.12, segs: [], obs: [], coins: [], parts: [],
    rx: Math.round(f.cols * 0.2), y: 0, vy: 0, onG: true, ph: 0, crash: 0, dist: 0, best: 0, curH: 0, genX: 0, seed: rnd(0, 50), plan: null, score: 0 };
  L.spd = L.spd0; L.Hj = L.hr * 1.7; L.T = 0.8; L.G = (8 * L.Hj) / (L.T * L.T); L.vy0 = (4 * L.Hj) / L.T;
  L.segs.push({ x0: -1e5, x1: f.cols * 0.9, h: 0 }); L.genX = f.cols * 0.9;
  L.clouds = Array.from({ length: 6 }, () => ({ x: rnd(0, f.cols * 2), y: y0 + rnd(0.08, 0.4) * H, w: rnd(8, 22) * (f.cols / 160), sp: rnd(0.05, 0.15) }));
  L.fx = Array.from({ length: Math.round((f.cols * H) / 120) }, () => ({ x: rnd(0, f.cols), y: rnd(y0, y0 + H), p: rnd(0, TAU), v: rnd(0.5, 1.5) }));
  return L;
}
function rnGround(L, wx) {
  for (let k = L.segs.length - 1; k >= 0; k--) { const s = L.segs[k]; if (wx >= s.x0 && wx < s.x1) return s.gap ? null : s.h; }
  return 0;
}
function rnGen(L, f) {
  const span = L.spd * L.T, w = L.w;
  while (L.genX < L.x + f.cols * 1.6) {
    const flat = span * rnd(1.5, 3.2);
    let h = L.curH;
    if (w.steps) h = clamp(h + pick([-1, -0.5, 0.5, 1, 0]) * L.hr * 0.55, 0, L.hr * 2);
    else if (w.roofs) h = Math.round(rnd(0, L.hr * 0.5));
    L.segs.push({ x0: L.genX, x1: L.genX + flat, h, bld: w.roofs ? rint(0, 9999) : 0 });
    if (Math.random() < (w.gap ? 0.55 : 0.9)) {
      const type = pick(w.obs), oh = type === 'cactus' ? L.hr * rnd(0.7, 1.05) : type === 'chimney' ? L.hr * 0.9 : type === 'snowman' ? L.hr * 0.95 : L.hr * rnd(0.4, 0.65);
      const ow = type === 'log' ? L.hr * 1.4 : type === 'cactus' ? Math.max(3, L.hr * 0.7) : type === 'snowman' ? L.hr * 0.75 : L.hr * rnd(0.8, 1.2);
      L.obs.push({ x: L.genX + flat * rnd(0.45, 0.6), w: Math.round(ow), h: Math.max(2, Math.round(oh)), base: h, type, seed: rint(0, 999) });
    }
    if (w.steps && Math.random() < 0.6) { const cx = L.genX + flat * 0.5; for (let k = -2; k <= 2; k++) L.coins.push({ x: cx + k * span * 0.08, y: h + L.Hj * (1 - (k * k) / 6) * 0.9, got: 0 }); }
    L.genX += flat; L.curH = h;
    if (w.gap && Math.random() < w.gap) { const gl = span * rnd(0.25, 0.48); L.segs.push({ x0: L.genX, x1: L.genX + gl, h: 0, gap: true }); L.genX += gl; }
  }
  while (L.segs.length > 2 && L.segs[1].x1 < L.x - 20) L.segs.splice(1, 1);
  while (L.obs.length && L.obs[0].x + L.obs[0].w < L.x - 20) L.obs.shift();
  while (L.coins.length && L.coins[0].x < L.x - 20) L.coins.shift();
}
function rnStep(L, f, dt) {
  const span = L.spd * L.T, wx = L.x + L.rx;
  if (L.crash > 0) {
    L.crash -= dt; L.spd = Math.max(0, L.spd - L.spd0 * 1.5 * dt); L.x += L.spd * dt;
    if (L.crash <= 0) {
      L.best = Math.max(L.best, L.dist); L.dist = 0; L.spd = L.spd0;
      L.obs = L.obs.filter(o => o.x > wx + f.cols * 0.9);
      const gh = rnGround(L, wx);
      L.segs.push({ x0: wx - 10, x1: wx + span * 1.2, h: gh === null ? L.curH : gh });
      L.segs.sort((a, b) => a.x0 - b.x0);
      L.y = gh === null ? L.curH : gh; L.vy = 0; L.onG = true; L.plan = null;
    }
    return;
  }
  L.spd = Math.min(L.spd0 * 1.9, L.spd + L.spd0 * 0.01 * dt);
  L.x += L.spd * dt; L.dist += (L.spd * dt) / (f.cols * 0.01);
  L.ph += dt * L.spd / Math.max(1, L.hr * 0.9 * f.aspect) * 2.6;
  rnGen(L, f);
  const nwx = L.x + L.rx, gh = rnGround(L, nwx);
  // AI：找前方第一個需要跳的東西
  if (L.onG) {
    let jumpAt = null;
    for (const o of L.obs) { const c = o.x + o.w / 2; if (c > nwx - 1 && c < nwx + span * 1.5) { jumpAt = c - span * 0.5; break; } }
    for (const s of L.segs) {
      if (s.x0 <= nwx || s.x0 > nwx + span * 1.5) continue;
      const prev = rnGround(L, s.x0 - 0.01);
      let need = null;
      if (s.gap) need = s.x0 - Math.max(0.5, (span - (s.x1 - s.x0)) * 0.35);
      else if (prev !== null && s.h > prev + 0.3) need = s.x0 - span * 0.28;
      if (need !== null && (jumpAt === null || need < jumpAt)) jumpAt = need;
      break;
    }
    if (jumpAt !== null) {
      if (!L.plan || Math.abs(L.plan.at - jumpAt) > 1) L.plan = { at: jumpAt, err: Math.random() < 0.025 ? span * rnd(0.3, 0.5) * (Math.random() < 0.5 ? -1 : 1) : gauss() * span * 0.02 };
      if (nwx >= L.plan.at + L.plan.err) { L.onG = false; L.vy = L.vy0; L.plan = null; for (let k = 0; k < 4; k++) L.parts.push({ x: L.rx, y: L.y, vx: rnd(-6, -1), vy: rnd(1, 4), l: rnd(0.3, 0.6) }); }
    }
  }
  if (L.onG) {
    if (gh === null || gh < L.y - 0.05) L.onG = false;
    else if (gh > L.y + 0.3) { L.crash = 1.8; return; }
    else L.y = gh;
  }
  if (!L.onG) {
    L.vy -= L.G * dt; L.y += L.vy * dt;
    if (gh !== null && L.vy <= 0 && L.y <= gh) {
      if (L.y >= gh - L.Hj * 0.3) { L.y = gh; L.vy = 0; L.onG = true; for (let k = 0; k < 3; k++) L.parts.push({ x: L.rx + rnd(-1, 1), y: L.y, vx: rnd(-5, 5), vy: rnd(1, 3), l: rnd(0.2, 0.5) }); }
      else { L.crash = 1.8; return; }
    }
    if (L.y < -L.H * 0.35) { L.crash = 1.8; return; }
  }
  for (const o of L.obs) {
    if (o.x > nwx + 1.2 || o.x + o.w < nwx - 1.2) continue;
    if (L.y < o.base + o.h - 0.3 && L.y + L.hr * 0.85 > o.base) { L.crash = 1.8; L.vy = 0; return; }
  }
  for (const c of L.coins) if (!c.got && Math.abs(c.x - nwx) < 1.5 && Math.abs(c.y - (L.y + L.hr * 0.5)) < L.hr * 0.6) { c.got = 1; L.score++; }
}
function rnRidge(L, f, kind, amp, par, base, colTop, colFill, seed) {
  const { g, cols } = f;
  if (kind === 'none') return;
  for (let x = 0; x < cols; x++) {
    const wpos = L.x * par + x, wx = wpos * 0.02;
    let h;
    if (kind === 'mesa') { const n = Noise.n3(wx * 0.5, seed, 0.3); h = n > 0.05 ? amp * (0.55 + 0.4 * Math.round((n + 0.2) * 3) / 3) : amp * 0.15 * (1 + n); }
    else if (kind === 'dune') h = amp * (0.35 + 0.35 * Math.sin(wx * 1.3 + seed) + 0.2 * Noise.n3(wx, seed, 1));
    else if (kind === 'hill') h = amp * (0.45 + 0.4 * Math.sin(wx * 0.9 + seed) * Math.cos(wx * 0.37));
    else if (kind === 'pine') { const k = Math.floor(wpos / 7), r = hash(k, seed | 0), u = 1 - Math.abs(wpos / 7 - k - 0.5) * 2; h = amp * (0.25 + 0.1 * Math.sin(wx * 0.7) + (r < 0.8 ? u * (0.45 + r * 0.8) : 0)); }
    else if (kind === 'city') { const k = Math.floor(wpos / 9), r = hash(k, 77); h = amp * (0.3 + r * 0.7); }
    else h = amp * (0.5 + 0.5 * Noise.fbm(wx * 0.6, seed, 0.5, 3)) * 1.1;
    const topF = base - h, ty = Math.floor(topF);
    if (ty >= base) continue;
    g.set(x, ty, topF - ty < 0.5 ? '█' : '▄', colTop);
    for (let y = ty + 1; y < base; y++) {
      if (kind === 'city' && (y - ty) % 2 === 0 && Math.floor(wpos) % 3 === 1 && hash(Math.floor(wpos), y) > 0.6) g.set(x, y, '▪', f.H(45, 0.4));
      else g.set(x, y, '█', colFill);
    }
  }
}
function rnObs(g, o, X, Y, f, ink) {
  const { H, C } = f, w = o.w, h = o.h;
  const col = (hue, l) => (ink ? C(0.75) : H(hue, l));
  if (o.type === 'cactus') {
    const cx = X + Math.floor(w / 2);
    for (let y = 0; y < h; y++) { g.set(cx, Y - 1 - y, '█', col(125, 0.6)); if (w >= 4) g.set(cx + 1, Y - 1 - y, '▌', col(125, 0.45)); }
    const ay = Y - 1 - Math.floor(h * 0.45), by = Y - 1 - Math.floor(h * 0.6);
    for (let k = 1; k <= Math.max(1, (w >> 1) - 1); k++) { g.set(cx - k, ay, '▄', col(125, 0.55)); g.set(cx + k + 1, by, '▄', col(125, 0.55)); }
    for (let y = 1; y <= Math.max(1, h * 0.25); y++) { g.set(cx - Math.max(1, (w >> 1) - 1), ay - y, '█', col(125, 0.55)); g.set(cx + Math.max(1, (w >> 1) - 1) + 1, by - y, '█', col(125, 0.55)); }
  } else if (o.type === 'rock' || o.type === 'ice') {
    for (let y = 0; y < h; y++) {
      const t = 1 - y / h, half = (w / 2) * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)) * 0.6 + 0.4 * t);
      for (let x = Math.round(w / 2 - half); x < Math.round(w / 2 + half); x++) g.set(X + x, Y - 1 - y, y === h - 1 ? '▄' : o.type === 'ice' ? '▓' : (x + y + o.seed) % 4 ? '█' : '▓', o.type === 'ice' ? col(195, 0.75) : col(30, 0.35 + 0.2 * t));
    }
  } else if (o.type === 'weed') {
    const r = Math.max(1, Math.round(h / 2)), cy = Y - r, cx = X + w / 2;
    for (let y = -r; y <= r; y++) for (let x = -r * 2; x <= r * 2; x++) if (Math.hypot(x / 2, y) <= r + 0.3 && hash(x + o.seed, y) > 0.35) g.set(cx + x, cy + y, '@%&*'[(x * 7 + y * 3 + o.seed) & 3], col(35, 0.5));
  } else if (o.type === 'log') {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) g.set(X + x, Y - 1 - y, x === 0 ? '(' : x === w - 1 ? '@' : y === h - 1 ? '▄' : '═', col(25, x === w - 1 ? 0.7 : 0.45));
  } else if (o.type === 'stump') {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) g.set(X + x, Y - 1 - y, y === h - 1 ? '▄' : x === 0 || x === w - 1 ? '▐' : '█', col(25, y === h - 1 ? 0.7 : 0.4));
  } else if (o.type === 'snowman') {
    const r1 = Math.max(1, h * 0.3), r2 = Math.max(1, h * 0.2), cx = X + w / 2;
    for (const [cy, r] of [[Y - r1, r1], [Y - r1 * 2 - r2 * 0.9, r2]]) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r * f.aspect); x <= cx + r * f.aspect; x++) if (Math.hypot((x - cx) / f.aspect, y - cy) <= r) g.set(x, y, '█', col(200, 0.9));
    g.set(cx, Y - r1 * 2 - r2 * 0.9, '>', col(25, 0.8));
  } else if (o.type === 'ac' || o.type === 'box') {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      const edge = x === 0 || x === w - 1 || y === 0 || y === h - 1;
      g.set(X + x, Y - 1 - y, ink ? (edge ? (y === 0 || y === h - 1 ? '─' : '│') : (x + y) % 2 ? '/' : ' ') : edge ? '█' : o.type === 'ac' && y === (h >> 1) ? '═' : '▓', ink ? C(0.75) : o.type === 'box' ? H(35, edge ? 0.6 : 0.45) : H(210, edge ? 0.5 : 0.35));
    }
    if (ink) { g.set(X, Y - h, '┌', C(0.75)); g.set(X + w - 1, Y - h, '┐', C(0.75)); g.set(X, Y - 1, '└', C(0.75)); g.set(X + w - 1, Y - 1, '┘', C(0.75)); }
  } else if (o.type === 'chimney') {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.set(X + x, Y - 1 - y, y === h - 1 ? '▀' : (x + (y >> 1)) % 3 ? '█' : '▓', H(10, 0.35));
  }
}
function rnDraw(L, f) {
  const { g, cols, C, H, t } = f, A = f.aspect, w = L.w, y0 = L.y0, H0 = L.H, gy = L.gy, ink = !!w.ink;
  // 天空裝飾
  const sky = w.sky;
  if (w.deco === 'star' || sky === 'moon' || sky === 'volcano') for (const s of L.fx) if (s.y < gy - H0 * 0.25) { const b = 0.5 + 0.5 * Math.sin(t * s.v + s.p); g.set(s.x, s.y, b > 0.85 ? '+' : '.', C(0.15 + 0.3 * b)); }
  const sr = H0 * 0.09, sx = cols * 0.8, sy = y0 + H0 * 0.2;
  if (sky !== 'volcano') for (let y = Math.floor(sy - sr - 1); y <= sy + sr + 1; y++) for (let x = Math.floor(sx - sr * A - 2); x <= sx + sr * A + 2; x++) {
    const d = Math.hypot((x - sx) / A, y - sy) / sr;
    if (sky === 'sun3') { if (Math.abs(d - 1) < 0.18) g.set(x, y, '·', C(0.7)); continue; }
    if (d > 1) { if (sky === 'sun' && d < 1.6 && hash(x, y + ((t * 4) | 0)) < 0.12) g.set(x, y, '·', H(45, 0.5)); continue; }
    if (sky === 'moon') { const dd = Math.hypot((x - sx - sr * A * 0.45) / A, y - sy + sr * 0.2) / sr; if (dd < 0.85) continue; g.set(x, y, '█', H(55, 0.85)); }
    else g.set(x, y, d < 0.75 ? '█' : '▓', sky === 'sun2' ? C(0.9) : H(40, 0.8 + 0.2 * (1 - d)));
  }
  if (sky === 'volcano') {
    const vx = cols * 0.72, vb = gy - H0 * 0.05, vh = H0 * 0.55;
    for (let y = Math.round(vb - vh); y < vb; y++) { const k = (y - (vb - vh)) / vh, hw = (3 + k * vh * 1.6) * A * 0.5; for (let x = Math.round(vx - hw); x <= vx + hw; x++) g.set(x, y, Math.abs(x - vx) > hw - 1.5 ? (x < vx ? '/' : '\\') : '▓', H(5, 0.2 + 0.1 * k)); }
    for (let k = 0; k < 14; k++) { const a = fract(t * 0.07 + k / 14), x = vx + Math.sin(k * 3.7 + t * 0.3) * a * cols * 0.08, y = vb - vh - a * H0 * 0.35; g.set(x, y, a < 0.3 ? '@' : a < 0.7 ? 'o' : '.', C(0.35 * (1 - a) + 0.1)); }
  }
  if (w.deco === 'cloud') for (const c of L.clouds) {
    const x = ((c.x - L.x * c.sp) % (cols * 1.6) + cols * 1.6) % (cols * 1.6) - cols * 0.3, ch = Math.max(1, c.w / 6);
    for (let yy = -ch; yy <= ch * 0.3; yy++) for (let xx = -c.w; xx <= c.w; xx++) { const d = (xx / c.w) ** 2 + (yy / ch) ** 2 + Noise.n3(xx * 0.3, yy, c.y) * 0.3; if (d < 1) g.set(x + xx, c.y + yy, d < 0.5 ? '▒' : '░', C(0.28 + 0.15 * (1 - d))); }
  }
  if (w.deco === 'bird') for (let k = 0; k < 4; k++) { const x = (cols * 1.2 - ((t * (6 + k) + k * 37) % (cols * 1.4))), y = y0 + H0 * (0.15 + k * 0.06) + Math.sin(t + k) * 0.5; g.set(x, y, ((t * 4 + k) | 0) % 2 ? 'v' : '^', C(0.6)); }
  // 遠景、中景
  const fc = w.farC, mc = w.midC;
  rnRidge(L, f, w.far, H0 * (w.far === 'city' ? 0.42 : 0.4), 0.12, gy, ink ? C(0.25) : H(fc[0], fc[1] * 1.15), ink ? C(0.12) : H(fc[0], fc[1]), L.seed);
  rnRidge(L, f, w.mid, H0 * 0.22, 0.35, gy, ink ? C(0.4) : H(mc[0], mc[1] * 1.2), ink ? C(0.22) : H(mc[0], mc[1]), L.seed + 9);
  // 地面
  for (let x = 0; x < cols; x++) {
    const wx = L.x + x, gh = rnGround(L, wx);
    if (gh === null) {
      if (w.lava) for (let y = gy - 1; y < y0 + H0; y++) { const n = Noise.n3(wx * 0.15, y * 0.4, t * 0.8); g.set(x, y, y === gy - 1 ? (n > 0 ? '~' : '^') : n > 0.1 ? '▓' : '▒', H(15 + n * 30, 0.55 + 0.35 * n)); }
      else if (w.roofs) for (let y = gy; y < y0 + H0; y++) g.set(x, y, ' ', C(0));
      continue;
    }
    const top = gy - Math.round(gh);
    let sg = null; for (let k = L.segs.length - 1; k >= 0; k--) if (wx >= L.segs[k].x0 && wx < L.segs[k].x1) { sg = L.segs[k]; break; }
    g.set(x, top, ink ? '_' : w.steps ? '▀' : w.roofs ? '▄' : '▀', ink ? C(0.8) : w.steps ? H(110, 0.7) : H(w.ground, 0.6));
    for (let y = top + 1; y < y0 + H0; y++) {
      if (w.roofs) { const lit = sg && (y - top) % 3 === 1 && Math.floor(wx) % 4 === 1 && hash(Math.floor(wx), y + sg.bld) > 0.45; g.set(x, y, lit ? '▪' : '█', lit ? H(45, 0.75) : H(250, 0.22)); continue; }
      if (w.steps) { g.set(x, y, (Math.floor(wx) % 4 === 0 || (y - top) % 2 === 0) ? '▓' : '█', H(30, 0.3)); continue; }
      const n = hash(Math.floor(wx), y);
      if (n < (ink ? 0.06 : 0.22)) g.set(x, y, ink ? '/' : n < 0.07 ? ',' : '.', ink ? C(0.4) : H(w.ground, 0.25 + n));
    }
  }
  if (w.deco === 'snow') for (const s of L.fx) { s.y += dt0(f) * (3 + s.v * 3); s.x -= dt0(f) * (L.spd * 0.15 + 2); if (s.y > y0 + H0) s.y = y0; if (s.x < 0) s.x += cols; g.set(s.x, s.y, s.v > 1 ? '*' : '.', C(0.8)); }
  if (w.deco === 'fly') for (const s of L.fx) { if (s.y < gy - H0 * 0.4) continue; const b = 0.5 + 0.5 * Math.sin(t * s.v * 2 + s.p); if (b > 0.6) g.set(s.x + Math.sin(t * 0.3 + s.p) * 3, s.y, '·', H(70, 0.4 + b * 0.6)); }
  if (w.deco === 'ember') for (const s of L.fx) { s.y -= dt0(f) * (2 + s.v * 4); if (s.y < y0) s.y = y0 + H0; const x = s.x + Math.sin(t + s.p) * 2; g.set(x, s.y, s.v > 1.2 ? '*' : '.', H(20 + s.v * 20, 0.5 + 0.4 * Math.sin(t * 3 + s.p))); }
  // 障礙物與金幣
  for (const o of L.obs) { const X = Math.round(o.x - L.x); if (X > cols || X + o.w < 0) continue; rnObs(g, o, X, gy - Math.round(o.base), f, ink); }
  for (const c of L.coins) if (!c.got) { const X = c.x - L.x; if (X >= 0 && X < cols) g.set(X, gy - c.y, ((t * 6 + c.x) | 0) % 4 ? '◆' : '◇', H(50, 0.95)); }
  // 跑者
  for (let k = L.parts.length - 1; k >= 0; k--) { const q = L.parts[k]; q.l -= dt0(f); q.x += q.vx * dt0(f); q.y += q.vy * dt0(f); if (q.l <= 0) { L.parts.splice(k, 1); continue; } g.set(q.x, gy - q.y - 0.5, q.l > 0.3 ? 'o' : '.', C(0.5)); }
  const col = ink ? C(1) : L.crash > 0 ? H(0, 0.9) : H(w.ground + 180, 1);
  stick(g, L.rx, gy - L.y, L.hr, L.ph, !L.onG, col, A, L.crash > 0 && L.crash < 1.5 ? 'down' : null);
  if (L.crash > 1.4) txt(g, L.rx + 3, gy - L.y - L.hr - 1, tr(f, '哎呀！', 'Oops!'), C(0.9));
  const hud = f.lang === 'en'
    ? 'Distance ' + String(Math.floor(L.dist)).padStart(5, '0') + ' m' + (w.steps ? '  ◆ ' + L.score : '') + '  Best ' + Math.floor(Math.max(L.best, L.dist))
    : '距離 ' + String(Math.floor(L.dist)).padStart(5, '0') + ' 公尺' + (w.steps ? '　◆ ' + L.score : '') + '　最佳 ' + Math.floor(Math.max(L.best, L.dist));
  hudText(g, cols - g.textW(hud) - 2, y0, hud, C(0.6), C(0));
}
const dt0 = f => f.dt;
A({ id: 'ga-runner', name: '無盡奔跑', cat: '遊戲', theme: 'sunset', hue: true, desc: '火柴人在沙漠裡跳過仙人掌',
  params: { world: 'desert', lanes: 1 },
  variants: [
    { id: 'night', name: '夜林', theme: 'forest', desc: '螢火蟲飛舞的夜晚森林', params: { world: 'night' } },
    { id: 'roof', name: '屋頂跑酷', theme: 'cyber', desc: '在城市屋頂間飛躍', params: { world: 'roof' } },
    { id: 'lava', name: '熔岩地帶', theme: 'fire', desc: '火山下跳過岩漿池', params: { world: 'lava' } },
    { id: 'platform', name: '跳台金幣', theme: 'mint', desc: '高低起伏的跳台與金幣', params: { world: 'platform' } },
    { id: 'paper', name: '手繪本', theme: 'paper', hue: false, desc: '像畫在筆記本上的塗鴉', params: { world: 'paper' } },
    { id: 'duo', name: '雙線競跑', theme: 'neon', desc: '上下兩條跑道同時開跑', params: { lanes: 2 } },
  ],
  init(s, f) {
    const { rows, p } = f;
    s.lanes = p.lanes > 1 ? [rnLane(f, 0, Math.floor(rows / 2), 'desert'), rnLane(f, Math.floor(rows / 2), rows - Math.floor(rows / 2), 'night')] : [rnLane(f, 0, rows, p.world)];
  },
  frame(s, f) {
    for (const L of s.lanes) { rnStep(L, f, f.dt); rnDraw(L, f); }
    if (s.lanes.length > 1) for (let x = 0; x < f.cols; x++) f.g.set(x, s.lanes[1].y0, '═', f.C(0.4));
  } });

/* ════════════ 7. 公路賽車（偽 3D） ════════════ */
const RC_SEG = 200, RC_RW = 2000, RC_CAMH = 1000, RC_DEPTH = 0.84, RC_DRAW = 160;
const RC_LOOK = {
  day: { grass: 110, g1: 0.26, g2: 0.32, road: 0.2, sky: 'day', mtn: 140, objs: ['tree', 'tree', 'pole', 'bush'], lanes: 1 },
  night: { grass: 140, g1: 0.08, g2: 0.11, road: 0.12, sky: 'night', mtn: 240, objs: ['bush'], pairs: 'lamp', pairN: 12, lanes: 1, dark: 1 },
  desert: { grass: 38, g1: 0.32, g2: 0.37, road: 0.22, sky: 'hot', mtn: 18, objs: ['cactus', 'rock', 'cactus'], lanes: 1 },
  snow: { grass: 200, g1: 0.62, g2: 0.7, road: 0.25, sky: 'grey', mtn: 210, objs: ['pine', 'pine', 'pole'], lanes: 1, snow: 1 },
  neon: { grass: 290, g1: 0.05, g2: 0.05, road: 0.06, sky: 'synth', mtn: 300, objs: [], pairs: 'pylon', pairN: 12, lanes: 1, grid: 1, dark: 1 },
  rally: { grass: 95, g1: 0.22, g2: 0.26, road: 0.3, sky: 'day', mtn: 120, objs: ['pine', 'tree', 'pine', 'rock'], lanes: 0, dirt: 1, near: 1 },
  tunnel: { grass: 30, g1: 0.18, g2: 0.22, road: 0.16, sky: 'none', mtn: 0, objs: [], lanes: 1, tunnel: 1, dark: 1 },
  rain: { grass: 150, g1: 0.1, g2: 0.13, road: 0.1, sky: 'storm', mtn: 230, objs: ['lamp', 'pole'], pairs: 'lamp', pairN: 12, lanes: 1, rain: 1, dark: 1 },
};
function rcBuild(s, look) {
  const segs = [];
  const lastY = () => (segs.length ? segs[segs.length - 1].y2 : 0);
  const push = (curve, y) => { const y1 = lastY(); segs.push({ i: segs.length, curve, y1, y2: y, objs: [], clip: 0 }); };
  const io = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
  const road = (enter, hold, leave, curve, hill) => {
    const y0 = lastY(), y1 = y0 + hill * RC_SEG, tot = enter + hold + leave;
    for (let n = 0; n < enter; n++) push(io(0, curve, n / enter), io(y0, y1, n / tot));
    for (let n = 0; n < hold; n++) push(curve, io(y0, y1, (enter + n) / tot));
    for (let n = 0; n < leave; n++) push(io(curve, 0, n / leave), io(y0, y1, (enter + hold + n) / tot));
  };
  road(20, 40, 20, 0, 0);
  while (segs.length < 900) {
    const len = rint(15, 50), c = pick([0, 0, 2, -2, 3, -3, 5, -5, 6, -6]) * (look.tunnel ? 0.6 : 1), h = look.tunnel ? 0 : pick([0, 0, 10, -10, 20, -20, 30]);
    road(len, rint(20, 70), len, c, h);
  }
  road(40, 40, 40, 0, -lastY() / RC_SEG);
  for (const sg of segs) {
    if (look.objs.length && Math.random() < (look.near ? 0.5 : 0.35)) sg.objs.push({ off: (Math.random() < 0.5 ? -1 : 1) * rnd(1.25, look.near ? 1.7 : 2.6), type: pick(look.objs), seed: rnd(0, 1) });
    if (look.pairs === 'lamp' && sg.i % look.pairN === 0) sg.objs.push({ off: -1.18, type: 'lamp', seed: 0 }, { off: 1.18, type: 'lamp', seed: 0.5 });
    if (look.pairs === 'pylon' && sg.i % look.pairN === 0) sg.objs.push({ off: -1.3, type: 'pylon', seed: 0 }, { off: 1.3, type: 'pylon', seed: 0.5 });
  }
  return segs;
}
// 以字元畫一台車的背影：中心 cx、底部列 by、寬 w 欄
function rcCar(g, cx, by, w, A, hue, H, C, clip, brake) {
  w = Math.max(3, w);
  const h = Math.max(2, Math.round((w * 0.42) / A * 1.25)), x0 = Math.round(cx - w / 2), top = Math.round(by - h);
  for (let r = 0; r < h; r++) {
    const y = top + r; if (y >= clip) continue;
    const v = (r + 0.5) / h;
    for (let c = 0; c < w; c++) {
      const u = (c + 0.5) / w;
      let ch = '█', col = H(hue, 0.6);
      if (v < 0.36) { // 車頂與後窗
        const m = 0.17 + (0.36 - v) * 0.25; if (u < m || u > 1 - m) continue;
        ch = r === 0 ? '▄' : '█'; col = u > m + 0.06 && u < 1 - m - 0.06 && r > 0 ? C(0.12) : H(hue, 0.45);
      } else if (v < 0.78) {
        if ((u < 0.17 || u > 0.83) && v > 0.48 && v < 0.68) { col = brake ? H(0, 1) : H(0, 0.7); ch = '█'; }
        else if (u > 0.4 && u < 0.6 && v > 0.55) { col = C(0.85); ch = '▄'; }
        else col = H(hue, v < 0.5 ? 0.7 : 0.55);
      } else {
        if (u < 0.22 || u > 0.78) { col = C(0.08); ch = '█'; } else { col = H(hue, 0.3); ch = '▀'; }
      }
      g.set(x0 + c, y, ch, col);
    }
  }
}
function rcObj(g, o, x, by, sc, f, look, clip) {
  const { H, C } = f, A = f.aspect, unit = sc * RC_RW * f.cols * 0.5;
  if (unit > f.cols * 0.8 || x < -unit * 3 || x > f.cols + unit * 3 || by - unit * 3 > clip + unit * 3) return;
  const thin = o.type === 'pole' || o.type === 'lamp' || o.type === 'pylon';
  if (thin && unit < Math.max(0.6, f.cols * 0.04)) return; // 太遠的細桿子只會在地平線糊成一團
  const kf = thin ? clamp(unit / (f.cols * 0.15), 0.3, 1) : 1;
  const put = (xx, yy, ch, col) => { if (yy < clip) g.set(xx, yy, ch, col); };
  const tri = (cx, base, w, hh, col, ch) => { for (let r = 0; r < hh; r++) { const half = (w / 2) * ((r + 1) / hh); for (let k = Math.round(cx - half); k <= Math.round(cx + half); k++) put(k, base - hh + r, ch, col); } };
  if (o.type === 'tree' || o.type === 'bush') {
    const sz = unit * (o.type === 'bush' ? 0.35 : 0.9) * (0.8 + o.seed * 0.4), th = Math.max(1, Math.round((sz * 0.6) / A));
    if (o.type === 'tree') for (let r = 0; r < th; r++) put(x, by - 1 - r, '█', H(25, 0.3));
    const R = sz * 0.5, cy = by - (o.type === 'tree' ? th : 0) - R / A;
    for (let yy = Math.floor(cy - R / A); yy <= cy + R / A; yy++) for (let xx = Math.floor(x - R); xx <= x + R; xx++) { const d = Math.hypot((xx - x) / R, ((yy - cy) * A) / R); if (d <= 1) put(xx, yy, d > 0.8 ? '▓' : '█', H(look.grass + 10, 0.3 + 0.2 * (1 - d) + ((xx + yy) % 3 === 0 ? 0.05 : 0))); }
  } else if (o.type === 'pine') {
    const sz = unit * 1.1 * (0.8 + o.seed * 0.5), hh = Math.max(2, Math.round((sz * 1.4) / A));
    tri(x, by - Math.max(1, hh * 0.15), sz, hh, look.snow ? C(0.9) : H(140, 0.32), '█');
    for (let r = 0; r < Math.max(1, hh * 0.15); r++) put(x, by - 1 - r, '█', H(25, 0.3));
    if (look.snow) tri(x, by - Math.max(1, hh * 0.15) - hh * 0.45, sz * 0.5, Math.round(hh * 0.5), H(150, 0.3), '▓');
  } else if (o.type === 'pole' || o.type === 'lamp') {
    const hh = Math.max(2, Math.round((unit * 1.6) / A));
    for (let r = 0; r < hh; r++) put(x, by - 1 - r, '│', C(0.15 + 0.35 * kf));
    if (o.type === 'lamp') {
      const dir = o.off < 0 ? 1 : -1, arm = Math.max(1, Math.round(unit * 0.35));
      for (let k = 0; k <= arm; k++) put(x + dir * k, by - hh, '─', C(0.15 + 0.35 * kf));
      put(x + dir * arm, by - hh + 1, '●', H(50, 0.45 + 0.55 * kf));
    } else put(x, by - hh, '┬', C(0.2 + 0.4 * kf));
  } else if (o.type === 'cactus') {
    const hh = Math.max(2, Math.round((unit * 0.9) / A)), w = Math.max(1, Math.round(unit * 0.12));
    for (let r = 0; r < hh; r++) for (let k = 0; k < w; k++) put(x + k, by - 1 - r, '█', H(120, 0.4));
    const ay = by - Math.round(hh * 0.55), al = Math.max(1, Math.round(unit * 0.18));
    for (let k = 1; k <= al; k++) { put(x - k, ay, '▄', H(120, 0.4)); put(x + w - 1 + k, ay - 1, '▄', H(120, 0.4)); }
    for (let r = 1; r <= Math.max(1, hh * 0.25); r++) { put(x - al, ay - r, '█', H(120, 0.4)); put(x + w - 1 + al, ay - 1 - r, '█', H(120, 0.4)); }
  } else if (o.type === 'rock') {
    const w = unit * 0.5, hh = Math.max(1, Math.round((w * 0.5) / A));
    for (let r = 0; r < hh; r++) { const half = (w / 2) * Math.sqrt(1 - ((hh - r - 0.5) / hh) ** 2); for (let k = Math.round(x - half); k <= Math.round(x + half); k++) put(k, by - hh + r, r === 0 ? '▄' : '█', H(look.mtn, 0.25)); }
  } else if (o.type === 'pylon') {
    const hh = Math.max(2, Math.min(Math.round((unit * 2.2) / A), Math.round(by - f.rows * 0.16)));
    for (let r = 0; r < hh; r++) put(x, by - 1 - r, '║', H(300 + r * 3, (0.5 + 0.5 * (r / hh)) * kf));
    put(x, by - hh - 1, '◆', H(180, 0.4 + 0.6 * kf));
  }
}
A({ id: 'ga-racing', name: '公路賽車', cat: '遊戲', theme: 'sunset', hue: true, desc: '彎道與起伏不斷的偽 3D 公路',
  params: { look: 'day', cars: 14 },
  variants: [
    { id: 'night', name: '夜間公路', theme: 'ocean', desc: '路燈一盞盞掠過的夜路', params: { look: 'night' } },
    { id: 'desert', name: '沙漠公路', theme: 'amber', desc: '仙人掌與台地間奔馳', params: { look: 'desert', cars: 8 } },
    { id: 'snow', name: '雪國', theme: 'ice', desc: '下著雪的山間公路', params: { look: 'snow' } },
    { id: 'neon', name: '霓虹賽道', theme: 'synth', desc: '格線大地上的霓虹光柱', params: { look: 'neon', cars: 10 } },
    { id: 'rally', name: '林道拉力', theme: 'forest', desc: '樹林夾道的泥土路', params: { look: 'rally', cars: 5 } },
    { id: 'tunnel', name: '長隧道', theme: 'gold', desc: '燈管一路往後飛的隧道', params: { look: 'tunnel' } },
    { id: 'rain', name: '雨夜', theme: 'lavender', desc: '濕亮路面倒映車燈的雨夜', params: { look: 'rain' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f, look = RC_LOOK[p.look];
    s.look = look; s.segs = rcBuild(s, look); s.N = s.segs.length; s.len = s.N * RC_SEG;
    s.pos = 0; s.x = 0; s.tx = 0; s.spd = RC_SEG * 45; s.skyX = 0; s.t = 0; s.bob = 0;
    s.cars = Array.from({ length: p.cars }, (_, k) => ({ z: (k + 1) * s.len / (p.cars + 1) * 0.25 + rnd(0, 2000), off: pick([-0.66, 0, 0.66]), spd: RC_SEG * rnd(18, 32), hue: pick([0, 210, 50, 120, 280, 30, 180]) }));
    s.drops = Array.from({ length: Math.round((cols * rows) / 40) }, () => ({ x: rnd(0, cols), y: rnd(0, rows), v: rnd(0.6, 1.2) }));
    s.ry = new Float32Array(rows); s.rw = new Float32Array(rows); s.rseg = new Int32Array(rows); s.rfog = new Float32Array(rows);
  },
  frame(s, f) {
    const { g, cols, rows, dt, C, H, t } = f, A = f.aspect, look = s.look, N = s.N, segs = s.segs;
    const Hv = rows * A, horizon = rows * 0.4;
    // ── 駕駛 AI ──
    const pz = RC_CAMH * RC_DEPTH, myZ = s.pos + pz;
    let ahead = null;
    for (const c of s.cars) { let dz = c.z - myZ; if (dz < -s.len / 2) dz += s.len; if (dz > 0 && dz < RC_SEG * 22 && Math.abs(c.off - s.tx) < 0.4) { if (!ahead || dz < ahead.dz) ahead = { c, dz }; } }
    if (ahead) {
      const lanes = [-0.66, 0, 0.66].filter(l => !s.cars.some(c => { let dz = c.z - myZ; if (dz < -s.len / 2) dz += s.len; return dz > -RC_SEG * 4 && dz < RC_SEG * 26 && Math.abs(c.off - l) < 0.4; }));
      if (lanes.length) s.tx = lanes.reduce((a, b) => (Math.abs(b - s.x) < Math.abs(a - s.x) ? b : a));
    }
    const target = RC_SEG * (52 + 10 * Math.sin(t * 0.15)) * (ahead && ahead.dz < RC_SEG * 8 && Math.abs(ahead.c.off - s.tx) < 0.4 ? 0.5 : 1);
    const brake = target < s.spd - RC_SEG * 3;
    s.spd += clamp(target - s.spd, -RC_SEG * 40 * dt, RC_SEG * 12 * dt);
    s.x += clamp(s.tx - s.x, -1.2 * dt, 1.2 * dt);
    s.pos = (s.pos + s.spd * dt) % s.len;
    for (const c of s.cars) { c.z = (c.z + c.spd * dt) % s.len; }
    const base = segs[Math.floor(s.pos / RC_SEG) % N], bp = (s.pos % RC_SEG) / RC_SEG;
    s.skyX += base.curve * (s.spd / (RC_SEG * 60)) * dt * 6;
    const camY = RC_CAMH + lerp(base.y1, base.y2, bp), camX = s.x * RC_RW;
    // ── 天空與遠山 ──
    const sk = look.sky;
    if (sk !== 'none') {
      for (let y = 0; y < Math.ceil(horizon); y++) {
        const k = y / horizon;
        for (let x = 0; x < cols; x++) {
          let ch = ' ', col = null;
          if (sk === 'day' || sk === 'hot' || sk === 'grey') { if (k > 0.55 && hash(x, y) < (k - 0.55) * 1.4) { ch = k > 0.85 ? '-' : '.'; col = sk === 'hot' ? H(30, 0.3 + k * 0.3) : sk === 'grey' ? C(0.35 + k * 0.2) : H(200, 0.25 + k * 0.3); } }
          else if (sk === 'night' || sk === 'storm') { const hh = hash(x * 3, y * 7); if (hh < 0.012 && sk === 'night') { ch = hh < 0.004 ? '+' : '.'; col = C(0.4 + 0.3 * Math.sin(t * 2 + x)); } else if (k > 0.8 && hash(x, y) < 0.25) { ch = '.'; col = H(look.mtn, 0.2); } }
          else if (sk === 'synth') { if (k > 0.5 && (y % 3 === 0)) { ch = '─'; col = H(300 - k * 40, 0.25 + k * 0.25); } }
          if (col) g.set(x, y, ch, col);
        }
      }
      // 太陽或月亮
      const sr = rows * (sk === 'synth' ? 0.2 : 0.11), sx = cols * 0.5 - s.skyX * cols * 0.05 % cols, sy = horizon - sr * (sk === 'synth' ? 0.55 : 0.4);
      if (sk !== 'storm' && sk !== 'grey') for (let y = Math.floor(sy - sr); y < horizon; y++) for (let x = Math.floor(sx - sr * A); x <= sx + sr * A; x++) {
        const d = Math.hypot((x - sx) / A, y - sy) / sr; if (d > 1) continue;
        if (sk === 'synth' && (Math.floor(y) % 3 === 0) && y > sy) continue;
        g.set(((x % cols) + cols) % cols, y, d < 0.8 ? '█' : '▓', sk === 'night' ? C(0.8) : sk === 'synth' ? H(340 - (y - sy + sr) / (2 * sr) * 60, 0.65) : H(sk === 'hot' ? 25 : 45, 0.75 - d * 0.2));
      }
      // 遠山
      for (let x = 0; x < cols; x++) {
        const wx = (x + s.skyX * cols * 0.15) * 0.012;
        const h = rows * (sk === 'synth' ? 0.04 : 1) * (0.06 + 0.1 * (0.5 + 0.5 * Noise.fbm(wx, 3.3, 0, 3)));
        for (let y = Math.floor(horizon - h); y < horizon; y++) g.set(x, y, y === Math.floor(horizon - h) ? '▄' : '█', look.dark ? H(look.mtn, 0.1) : look.snow ? C(0.6 - (horizon - y) / h * 0.15) : H(look.mtn, 0.18 + 0.08 * ((horizon - y) / h)));
        const h2 = rows * (0.03 + 0.05 * (0.5 + 0.5 * Noise.n3((x + s.skyX * cols * 0.4) * 0.03, 7.7, 0)));
        for (let y = Math.floor(horizon - h2); y < horizon; y++) g.set(x, y, '█', look.dark ? H(look.mtn, 0.14) : H(look.grass, 0.18));
      }
    }
    // ── 路面（由近到遠，用 maxy 遮擋） ──
    let maxy = rows, x = 0, dx = -(base.curve * bp);
    const proj = (wx, wy, wz) => { const dz = wz; const sc = RC_DEPTH / dz; return { x: cols / 2 + sc * (wx - camX) * cols / 2, y: horizon - (sc * (wy - camY) * cols / 2) / A, w: sc * RC_RW * cols / 2, sc }; };
    const bi = Math.floor(s.pos / RC_SEG);
    for (let n = 0; n < RC_DRAW; n++) {
      const sg = segs[(bi + n) % N], loop = (bi + n) >= N ? s.len : 0;
      const z1 = sg.i * RC_SEG + loop - s.pos, z2 = z1 + RC_SEG;
      sg.clip = maxy;
      if (z1 <= RC_DEPTH * 0.6 && n > 0) { sg.p = null; x += dx; dx += sg.curve; continue; }
      const p1 = proj(x, sg.y1, Math.max(1, z1)), p2 = proj(x + dx, sg.y2, z2);
      sg.p = p1; sg.sc = p1.sc; sg.z = z1;
      x += dx; dx += sg.curve;
      if (p2.y >= maxy || p2.y >= p1.y) continue;
      const fog = Math.min(1, n / RC_DRAW), alt = Math.floor(sg.i / 3) % 2, lightK = 1 - fog * 0.75;
      const y0 = Math.max(0, Math.ceil(p2.y)), y1 = Math.min(maxy, Math.ceil(p1.y));
      for (let y = y0; y < y1; y++) {
        const k = (y - p2.y) / (p1.y - p2.y), cx = lerp(p2.x, p1.x, k), hw = Math.max(0.5, lerp(p2.w, p1.w, k));
        const row = y * cols;
        s.ry[y] = cx; s.rw[y] = hw; s.rseg[y] = sg.i; s.rfog[y] = lightK;
        for (let xx = 0; xx < cols; xx++) {
          const d = (xx + 0.5 - cx) / hw, ad = Math.abs(d);
          let ch, col;
          if (ad < 1) {
            if (look.lanes && alt && Math.abs(ad - 1 / 3) < Math.max(0.02, 0.6 / hw)) { ch = '█'; col = C(0.85 * lightK); }
            else if (look.dirt) { ch = hash(xx, Math.floor(sg.i * 7 + y)) < 0.3 ? ':' : '▓'; col = H(30, (0.3 + (alt ? 0.04 : 0)) * lightK + 0.05); }
            else if (look.rain) { const refl = Math.abs(d) < 0.9 && hash(xx, y) < 0.08; ch = refl ? '│' : '▓'; col = refl ? H(pick2(xx), 0.4 * lightK) : C((look.road + (alt ? 0.03 : 0)) * lightK + 0.06); }
            else if (look.grid) { ch = alt && Math.floor(sg.i) % 3 === 0 ? '─' : (Math.abs(d * 6 - Math.round(d * 6)) < 0.08 ? '│' : ' '); col = H(300, 0.6 * lightK); if (ch === ' ') continue; }
            else { ch = '▓'; col = C((look.road + (alt ? 0.03 : 0)) * lightK + 0.04); }
          } else if (ad < 1.13 && !look.dirt) { ch = '█'; col = look.grid ? H(180, 0.8 * lightK) : alt ? H(0, 0.55 * lightK) : C(0.8 * lightK); }
          else if (look.tunnel) { if (ad < 1.3) { ch = '▒'; col = H(30, 0.12 * lightK + 0.02); } else { const lamp = sg.i % 6 === 0 && ad < 1.6; ch = lamp ? '▌' : (alt ? '█' : '▓'); col = lamp ? H(45, 0.8 * lightK + 0.1) : H(30, (0.1 + 0.05 * alt) * lightK + 0.02); } }
          else if (look.grid) { const gx = Math.abs((d * 4) - Math.round(d * 4)) < 0.04 * ad || (alt && Math.floor(sg.i) % 3 === 0); if (!gx) continue; ch = gx && alt && Math.floor(sg.i) % 3 === 0 ? '─' : '·'; col = H(290, 0.4 * lightK); }
          else { const tex = hash(xx, y) < 0.5; ch = look.snow ? (tex ? '░' : ' ') : tex ? (alt ? '"' : ',') : (alt ? '.' : ' '); col = H(look.grass, (alt ? look.g2 : look.g1) * lightK + 0.02); if (look.snow) col = C((alt ? look.g2 : look.g1) * lightK); if (ch === ' ') { ch = '▒'; col = H(look.grass, (alt ? look.g2 : look.g1) * lightK * 0.5); } }
          g.ch[row + xx] = ch; g.co[row + xx] = col;
        }
      }
      maxy = Math.min(maxy, y0);
    }
    if (look.tunnel) for (let y = 0; y < Math.ceil(horizon); y++) {
      const yf = Math.min(rows - 1, Math.round(horizon + (horizon - y) * 1.25)), cx = s.ry[yf], hw = Math.max(0.5, s.rw[yf]), si = s.rseg[yf], lk = s.rfog[yf], alt = Math.floor(si / 3) % 2;
      for (let xx = 0; xx < cols; xx++) {
        const i = y * cols + xx, ad = Math.abs((xx + 0.5 - cx) / hw);
        let ch, col;
        if (ad < 1.3) { const tube = si % 6 === 0 && ad < 0.5; ch = tube ? '█' : ad > 1.22 ? '▀' : '▒'; col = tube ? H(50, 0.9 * lk + 0.1) : H(30, (0.08 + 0.04 * alt) * lk + 0.02); }
        else { const lamp = si % 6 === 0 && ad < 1.6; ch = lamp ? '▌' : alt ? '█' : '▓'; col = lamp ? H(45, 0.8 * lk + 0.1) : H(30, (0.1 + 0.05 * alt) * lk + 0.02); }
        g.ch[i] = ch; g.co[i] = col;
      }
    }
    // ── 路邊物件與其他車（遠到近） ──
    for (let n = RC_DRAW - 1; n > 0; n--) {
      const sg = segs[(bi + n) % N];
      if (!sg.p || sg.z <= 0) continue;
      const p = sg.p;
      for (const o of sg.objs) rcObj(g, o, Math.round(p.x + o.off * p.w), Math.round(p.y), p.sc, f, look, sg.clip);
      for (const c of s.cars) {
        let dz = c.z - (sg.i * RC_SEG); if (dz < 0) dz += s.len;
        if (dz >= RC_SEG) continue;
        const cw = p.w * 0.55, cx = p.x + c.off * p.w;
        if (cw > cols * 0.6 || cx < -cw || cx > cols + cw) continue;
        if (cw < 0.8) { if (p.y < sg.clip) g.set(cx, p.y - 1, '▪', H(0, 0.6)); continue; }
        rcCar(g, cx, Math.round(p.y), Math.round(cw), A, c.hue, H, C, sg.clip, false);
        if (look.dirt && cw > 3) for (let k = 0; k < 6; k++) { const a = hash(k, (t * 10) | 0); g.set(cx + (a - 0.5) * cw * 1.4, p.y - 1 - a * 2, '░', H(30, 0.35)); }
      }
    }
    // ── 玩家的車 ──
    s.bob += dt * s.spd / RC_SEG;
    const cw = Math.round(cols * 0.17), by = rows - 1 - (Math.floor(s.bob * 0.5) % 2 === 0 ? 0 : 0) - Math.round(rows * 0.03);
    const lean = (s.tx - s.x) * cols * 0.02;
    if (look.dark) for (let y = Math.round(rows * 0.55); y < by - 2; y++) { const k = (y - rows * 0.55) / (by - rows * 0.55), hw = cw * (0.3 + k * 0.5); for (let xx = Math.round(cols / 2 - hw); xx <= cols / 2 + hw; xx++) { const i = y * cols + xx; if (xx >= 0 && xx < cols && g.ch[i] === '▓') g.co[i] = C(look.road + 0.12 * k + 0.08); } }
    rcCar(g, cols / 2 + lean, by + ((s.bob * 3) | 0) % 2 * 0, cw, A, 200, H, C, rows + 1, brake);
    if (look.rain || look.snow) for (const d of s.drops) {
      d.y += dt * rows * (look.rain ? 1.6 : 0.25) * d.v; d.x += dt * (look.rain ? -cols * 0.02 : Math.sin(t + d.v * 9) * 3);
      if (d.y >= rows) { d.y = 0; d.x = rnd(0, cols); } if (d.x < 0) d.x += cols;
      g.set(d.x, d.y, look.rain ? '/' : d.v > 1 ? '*' : '.', look.rain ? C(0.45) : C(0.85));
    }
    const kmh = Math.round(s.spd / RC_SEG * 4.2);
    hudText(g, 2, rows - 2, String(kmh).padStart(3, ' ') + ' km/h', C(0.85), C(0));
  } });
function pick2(x) { return x % 7 === 0 ? 0 : x % 5 === 0 ? 45 : 210; }

/* ════════════ 8. 振翅穿梭 ════════════ */
const FL_CFG = {
  pipes: { g: 1.6, flap: 0.55, gap: 0.3, space: 0.32, pipe: 'pipe', bg: 'day', hue: 45 },
  cave: { g: 1.4, flap: 0.5, gap: 0, space: 0, pipe: 'cave', bg: 'cave', hue: 280 },
  flock: { g: 1.6, flap: 0.55, gap: 0.34, space: 0.3, pipe: 'pipe', bg: 'day', hue: 45, flock: 24, move: 1 },
  city: { g: 1.6, flap: 0.55, gap: 0.32, space: 0.34, pipe: 'tower', bg: 'night', hue: 190 },
  sea: { g: 0.7, flap: 0.32, gap: 0.33, space: 0.3, pipe: 'coral', bg: 'sea', hue: 20 },
  rocket: { g: 1.2, flap: 0.45, gap: 0.3, space: 0.33, pipe: 'rock', bg: 'space', hue: 0, rocket: 1 },
  tight: { g: 1.8, flap: 0.58, gap: 0.24, space: 0.26, pipe: 'pipe', bg: 'day', hue: 330, move: 1 },
  paper: { g: 1.6, flap: 0.55, gap: 0.3, space: 0.32, pipe: 'ink', bg: 'paper', hue: 0, ink: 1 },
};
function flBird(cfg, k) { return { y: 0, vy: 0, alive: true, dieT: 0, tol: k ? rnd(-1, 1) : 0, look: k ? rnd(0.1, 0.6) : 0.25, err: 0, pid: null, hue: k ? (k * 47) % 360 : cfg.hue, dist: 0, wing: 0 }; }
function flReset(s, f) {
  const { rows, cols } = f, c = s.cfg;
  s.pipes = []; s.score = 0; s.nextX = cols * 0.8; s.dist = 0;
  for (const b of s.birds) { b.y = rows * 0.45; b.vy = 0; b.alive = true; b.dieT = 0; b.dist = 0; }
  s.waitT = 0.8;
}
function flCave(s, wx) {
  const n = Noise.fbm(wx * 0.012, s.seed, 0, 3), m = Noise.n3(wx * 0.004, s.seed + 5, 0);
  const center = s.top + (s.bot - s.top) * (0.5 + n * 0.55 + m * 0.2), half = (s.bot - s.top) * Math.max(0.1, 0.23 + 0.05 * Math.sin(wx * 0.01) - s.dist * 0.000004 * (300 / (s.bot - s.top)));
  return [Math.max(s.top + 1, center - half), Math.min(s.bot - 1, center + half)];
}
A({ id: 'ga-flappy', name: '振翅穿梭', cat: '遊戲', theme: 'forest', hue: true, desc: '小鳥自動拍翅鑽過水管縫隙',
  params: { mode: 'pipes' },
  variants: [
    { id: 'cave', name: '蝙蝠洞', theme: 'lavender', desc: '在起伏的洞穴裡穿梭', params: { mode: 'cave' } },
    { id: 'flock', name: '進化鳥群', theme: 'mint', desc: '一整群鳥一代代學會飛', params: { mode: 'flock' } },
    { id: 'city', name: '夜城', theme: 'cyber', desc: '鑽過夜晚高樓的縫隙', params: { mode: 'city' } },
    { id: 'sea', name: '深海小魚', theme: 'ocean', desc: '小魚游過珊瑚礁的縫', params: { mode: 'sea' } },
    { id: 'rocket', name: '火箭穿越', theme: 'fire', desc: '小火箭噴火穿過隕石牆', params: { mode: 'rocket' } },
    { id: 'paper', name: '鉛筆畫', theme: 'paper', hue: false, desc: '筆記本上的塗鴉小鳥', params: { mode: 'paper' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f, c = FL_CFG[p.mode];
    s.cfg = c; s.big = rows >= 45; s.bx = Math.round(cols * 0.25); s.gy = rows - (s.big ? 3 : 2); s.top = c.pipe === 'cave' ? 2 : 1; s.bot = s.gy; s.seed = rnd(0, 50);
    s.v = cols * 0.13; s.gen = 1; s.best = 0; s.hi = 0; s.t = 0; s.wx = 0;
    s.birds = Array.from({ length: c.flock || 1 }, (_, k) => flBird(c, k));
    s.stars = Array.from({ length: Math.round((cols * rows) / 70) }, () => ({ x: rnd(0, cols), y: rnd(0, rows), z: rnd(0.2, 1) }));
    s.bub = [];
    flReset(s, f);
  },
  frame(s, f) {
    const { g, cols, rows, dt, C, H, t } = f, A = f.aspect, c = s.cfg, G = rows * c.g, FV = rows * c.flap, bx = s.bx;
    s.t += dt;
    const alive = s.birds.filter(b => b.alive);
    const moving = alive.length > 0 && s.waitT <= 0;
    if (s.waitT > 0) s.waitT -= dt;
    if (moving) { s.wx += s.v * dt; s.dist += s.v * dt; }
    // ── 障礙物 ──
    const pw = Math.max(4, Math.round(cols * (c.pipe === 'tower' ? 0.08 : 0.055)));
    if (c.pipe !== 'cave') {
      if (moving) for (const q of s.pipes) q.x -= s.v * dt;
      while (s.pipes.length && s.pipes[0].x + pw < -2) s.pipes.shift();
      const last = s.pipes[s.pipes.length - 1];
      if (!last || last.x < cols - cols * c.space) {
        const rise = (rows * c.flap) ** 2 / (2 * rows * c.g), gh = Math.max(6, c.flock ? rise * 1.15 + 1 : rise * 1.7 + 3, rows * c.gap - s.score * rows * (c.flock ? 0.006 : 0.004)), prev = last ? last.gc : rows / 2;
        const gc = clamp(prev + rnd(-1, 1) * rows * 0.28, s.top + gh / 2 + 2, s.bot - gh / 2 - 2);
        s.pipes.push({ x: last ? last.x + cols * c.space : cols, gc, gc0: gc, gh, ph: rnd(0, TAU), seed: rint(0, 999), passed: false });
      }
      for (const q of s.pipes) if (c.move) q.gc = clamp(q.gc0 + Math.sin(s.t * (1.3 + s.score * 0.02) + q.ph) * rows * 0.12, s.top + q.gh / 2 + 1, s.bot - q.gh / 2 - 1);
    }
    // ── 鳥的 AI 與物理 ──
    const gapAt = (b, ahead) => {
      if (c.pipe === 'cave') { const [a, z] = flCave(s, s.wx + bx + ahead); b.half = (z - a) / 2; return (a + z) / 2 + 0.5; }
      for (const q of s.pipes) if (q.x + pw > bx - 1) { if (b.pid !== q) { b.pid = q; b.err = Math.random() < (c.flock ? 0 : 0.03) ? rnd(0.6, 0.9) * (Math.random() < 0.5 ? -1 : 1) : 0; } b.half = q.gh / 2; return q.gc; }
      b.half = rows * 0.15; return rows / 2;
    };
    for (const b of s.birds) {
      if (!b.alive) { if (b.y < s.gy - 1) { b.vy += G * dt; b.y = Math.min(s.gy - 1, b.y + b.vy * dt); } b.dieT += dt; continue; }
      if (s.waitT > 0) { b.y = rows * 0.45 + Math.sin(s.t * 6) * 0.6; b.wing = s.t * 8; continue; }
      const rise = (FV * FV) / (2 * G), gc = gapAt(b, s.v * b.look), target = gc + rise * 0.5 + (b.tol * 1.4 + b.err) * Math.max(0, b.half - rise * 0.5);
      if (b.y + b.vy * b.look * 0.25 > target && b.vy > 0) { b.vy = -FV; b.wing = 0; if (c.ink === undefined && c.bg === 'sea') s.bub.push({ x: bx, y: b.y, l: 1 }); }
      b.vy += G * dt; b.y += b.vy * dt; b.wing += dt * (b.vy < 0 ? 14 : 5); b.dist += s.v * dt;
      // 碰撞
      let hit = b.y >= s.gy - 0.5 || b.y < 0;
      if (c.pipe === 'cave') { const [a, z] = flCave(s, s.wx + bx); if (b.y < a || b.y > z) hit = true; }
      else for (const q of s.pipes) if (bx + 1 >= q.x && bx - 1 <= q.x + pw && (b.y < q.gc - q.gh / 2 || b.y > q.gc + q.gh / 2)) hit = true;
      if (hit) { b.alive = false; b.vy = -FV * 0.3; }
    }
    for (const q of s.pipes) if (!q.passed && q.x + pw < bx) { q.passed = true; s.score++; }
    if (c.pipe === 'cave') s.score = Math.floor(s.dist / (cols * 0.05));
    if (!alive.length) {
      const dead = s.birds.every(b => b.dieT > 1.3);
      if (dead) {
        s.hi = Math.max(s.hi, s.score);
        if (c.flock) {
          const best = s.birds.reduce((a, b2) => (b2.dist > a.dist ? b2 : a));
          s.best = Math.max(s.best, s.score);
          s.birds = s.birds.map((_, k) => { const nb = flBird(c, k + 1); if (k === 0) { nb.tol = best.tol; nb.look = best.look; } else { nb.tol = clamp(best.tol + gauss() * 0.25, -1, 1); nb.look = clamp(best.look + gauss() * 0.05, 0.08, 0.5); } return nb; });
          s.gen++;
        }
        flReset(s, f);
      }
    }
    // ── 背景 ──
    const bg = c.bg;
    if (bg === 'night' || bg === 'space' || bg === 'cave') for (const st of s.stars) { const x = ((st.x - s.wx * st.z * (bg === 'space' ? 0.6 : 0.1)) % cols + cols) % cols; if (bg === 'cave' && hash(st.x | 0, st.y | 0) > 0.3) continue; g.set(x, st.y, st.z > 0.8 ? '+' : '.', C(0.15 + st.z * 0.3)); }
    if (bg === 'day' || bg === 'paper') {
      for (let k = 0; k < 5; k++) {
        const cw = cols * 0.08, cx = ((cols * 1.3 - ((s.wx * 0.15 + k * cols * 0.29) % (cols * 1.3))) - cols * 0.15), cy = rows * (0.12 + (k % 3) * 0.1);
        for (let yy = -2; yy <= 1; yy++) for (let xx = -cw; xx <= cw; xx++) { const d = (xx / cw) ** 2 + ((yy + 0.5) / 2) ** 2; if (d < 1) g.set(cx + xx, cy + yy, c.ink ? (d > 0.75 ? '~' : ' ') : d < 0.5 ? '▒' : '░', C(c.ink ? 0.45 : 0.3)); }
      }
      for (let x = 0; x < cols; x++) { const h = rows * (0.1 + 0.06 * Math.sin((x + s.wx * 0.3) * 0.08) + 0.04 * Math.sin((x + s.wx * 0.3) * 0.23)); for (let y = Math.floor(s.gy - h); y < s.gy; y++) g.set(x, y, c.ink ? (y === Math.floor(s.gy - h) ? '_' : ' ') : '█', c.ink ? C(0.5) : H(120, 0.12)); }
    }
    if (bg === 'night') for (let x = 0; x < cols; x++) { const k = Math.floor((x + s.wx * 0.25) / 7), h = rows * (0.15 + hash(k, 3) * 0.3); for (let y = Math.floor(s.gy - h); y < s.gy; y++) { const lit = (y % 2 === 0) && (Math.floor(x + s.wx * 0.25) % 3 === 1) && hash(Math.floor(x + s.wx * 0.25), y) > 0.6; g.set(x, y, lit ? '▪' : '█', lit ? H(45, 0.45) : C(0.07)); } }
    if (bg === 'sea') {
      for (let k = 0; k < 6; k++) { const x0 = ((k * cols / 5 - s.wx * 0.05) % (cols * 1.2) + cols * 1.2) % (cols * 1.2) - cols * 0.1; for (let y = 0; y < rows * 0.7; y++) { const x = x0 + y * 0.35 + Math.sin(t * 0.5 + k) * 2; if (hash(k, y) < 0.3) g.set(x, y, hash(k + 7, y) < 0.5 ? '░' : '·', C(0.07 + 0.04 * (1 - y / rows))); } }
      if (Math.random() < dt * 4) s.bub.push({ x: rnd(0, cols), y: rows, l: 1 });
      for (let k = s.bub.length - 1; k >= 0; k--) { const q = s.bub[k]; q.y -= dt * rows * 0.12; q.x += Math.sin(t * 3 + k) * dt - (q.l === 1 && q.x < bx + 2 ? s.v * dt * 0.3 : 0); if (q.y < 0) { s.bub.splice(k, 1); continue; } g.set(q.x, q.y, q.y < rows * 0.3 ? 'O' : q.y < rows * 0.6 ? 'o' : '°', C(0.5)); }
    }
    // ── 畫障礙物 ──
    if (c.pipe === 'cave') {
      for (let x = 0; x < cols; x++) {
        const wx = s.wx + x, [a, z] = flCave(s, wx);
        for (let y = 0; y < a; y++) { const n = hash(Math.floor(wx), y); g.set(x, y, y > a - 1.5 ? '▀' : n < 0.1 ? '▓' : '█', H(280, 0.14 + 0.1 * (y / a))); }
        for (let y = Math.ceil(z); y < rows; y++) { const n = hash(Math.floor(wx), y); g.set(x, y, y < z + 1 ? '▄' : n < 0.1 ? '▓' : '█', H(280, 0.14 + 0.1 * ((rows - y) / (rows - z)))); }
        if (hash(Math.floor(wx), 77) < 0.05) { const L = 1 + hash(Math.floor(wx), 5) * 4; for (let k = 0; k < L; k++) g.set(x, a + k, k === L - 1 ? 'v' : '|', H(280, 0.3)); }
      }
    } else for (const q of s.pipes) {
      const top = q.gc - q.gh / 2, bot = q.gc + q.gh / 2, X = Math.round(q.x);
      for (let y = 0; y < s.gy; y++) {
        if (y >= Math.floor(top) && y < Math.ceil(bot)) continue;
        const cap = Math.abs(y - top) < 2 || Math.abs(y - bot) < 2;
        for (let k = cap ? -1 : 0; k < pw + (cap ? 1 : 0); k++) {
          let ch = '█', col;
          if (c.pipe === 'pipe') { col = H(110, k < 1 ? 0.4 : k < 2 ? 0.75 : k > pw - 2 ? 0.35 : 0.55); if (cap && (y === Math.floor(top) - 1 || y === Math.ceil(bot))) ch = y < q.gc ? '▀' : '▄'; }
          else if (c.pipe === 'tower') { const lit = (y % 2 === 0) && k > 0 && k < pw - 1 && k % 2 === 1 && hash(q.seed + k, y) > 0.4; ch = lit ? '▪' : cap && y > q.gc ? '▀' : '█'; col = lit ? H(50, 0.8) : H(220, cap ? 0.4 : 0.22); if (cap && y < q.gc && y === Math.floor(top) - 1) { ch = '▀'; col = H(330, 0.7); } }
          else if (c.pipe === 'coral') {
            const n = hash(q.seed + k, y), stem = ((k % 3) + 3) % 3 === 1;
            ch = stem ? '║' : n < 0.3 ? 'Y' : '▒'; col = H(q.seed % 360, stem ? 0.6 : 0.3 + n * 0.25);
            if (cap) { ch = (k + y) % 2 ? '*' : 'o'; col = H((q.seed % 360) + 40, 0.75); }
          }
          else if (c.pipe === 'rock') { const n = hash(q.seed + k * 3, y); ch = n < 0.3 ? '@' : n < 0.6 ? '#' : n < 0.85 ? '%' : '*'; col = H(25, 0.3 + 0.3 * n); if (Math.abs(k - pw / 2) > pw / 2 - (hash(q.seed, y) * 2)) continue; }
          else { ch = k === -1 || k === pw ? '│' : k === 0 || k === pw - 1 ? '│' : (k + y) % 3 === 0 ? '/' : ' '; col = C(0.75); if (cap && (y === Math.floor(top) - 1 || y === Math.ceil(bot))) ch = '─'; if (ch === ' ') continue; }
          g.set(X + k, y, ch, col);
        }
      }
    }
    // 地面
    for (let x = 0; x < cols; x++) {
      const wx = Math.floor(x + s.wx);
      g.set(x, s.gy, c.ink ? '_' : c.bg === 'sea' ? '~' : '▀', c.ink ? C(0.8) : c.bg === 'sea' ? H(40, 0.4) : c.bg === 'cave' ? H(280, 0.3) : H(40, 0.55));
      for (let y = s.gy + 1; y < rows; y++) g.set(x, y, c.ink ? ((wx + y) % 4 === 0 ? '/' : ' ') : (wx + y * 2) % 6 < 3 ? '▒' : '░', c.ink ? C(0.4) : H(c.bg === 'sea' ? 40 : 35, 0.25));
    }
    // ── 鳥 ──
    for (const b of s.birds) {
      if (!b.alive && b.dieT > 1.5) continue;
      const y = Math.round(b.y), up = Math.sin(b.wing) > 0, col = b.alive ? H(b.hue, 0.95) : C(0.4);
      if (c.rocket) {
        const sp = s.big ? ['  ▄▄  ', '◄███▓►', '  ▀▀  '] : ['=>'];
        g.sprite(bx - (s.big ? 3 : 1), y - (s.big ? 1 : 0), sp, col);
        if (b.alive && b.vy < 0) for (let k = 1; k <= (s.big ? 4 : 2); k++) g.set(bx - (s.big ? 3 : 1) - k, y, k === 1 ? '▓' : k < 3 ? '▒' : '░', H(30 - k * 6, 0.9 - k * 0.12));
        continue;
      }
      if (c.bg === 'sea') {
        const sp = s.big ? (up ? ['  ▄█▄  ', '◄█████o', '  ▀█▀  '] : ['   ▄▄  ', '▶█████o', '   ▀▀  ']) : [up ? '}°>' : '(°>'];
        g.sprite(bx - (s.big ? 3 : 1), y - (s.big ? 1 : 0), sp, col); continue;
      }
      if (!s.big || c.flock) { txt(g, bx - 1, y, (up ? '^' : 'v') + (c.ink ? 'o' : 'O') + '>', col); continue; }
      const rx = rows >= 70 ? 5.5 : 3.5, ry = rx / A * 0.95, wo = Math.sin(b.wing) * ry * 0.6;
      for (let yy = Math.floor(b.y - ry - 1); yy <= b.y + ry + 1; yy++) for (let xx = Math.floor(bx - rx - 1); xx <= bx + rx + 1; xx++) {
        let top = 0, bot = 0;
        for (let hh = 0; hh < 2; hh++) {
          const py = yy + 0.25 + hh * 0.5, px = xx + 0.5;
          const inB = ((px - bx) / rx) ** 2 + ((py - b.y) / ry) ** 2 <= 1;
          const inW = ((px - (bx - rx * 0.35)) / (rx * 0.55)) ** 2 + ((py - (b.y - wo)) / (ry * 0.45)) ** 2 <= 1;
          const v = inW ? 2 : inB ? 1 : 0; if (hh) bot = v; else top = v;
        }
        if (!top && !bot) continue;
        const wing = top === 2 || bot === 2;
        g.set(xx, yy, top && bot ? '█' : top ? '▀' : '▄', wing ? (b.alive ? H(b.hue + 25, 0.65) : C(0.3)) : col);
      }
      g.set(bx + rx * 0.45, b.y - ry * 0.35, b.alive ? 'o' : 'x', C(1)); g.set(bx + rx + 0.5, b.y, '►', H(25, 0.9));
    }
    // ── 分數 ──
    const str = String(s.score), fit = { sx: s.big ? 4 : 2, sy: s.big ? 2 : 1 };
    drawBig(g, str, (cols - fontW(str, F5) * fit.sx) / 2, s.big ? 3 : 1, fit.sx, fit.sy, c.ink ? C(0.6) : C(0.85));
    if (c.flock) hudText(g, 2, 0, tr(f, '第 ' + s.gen + ' 代　存活 ' + alive.length + '/' + s.birds.length + '　最佳 ' + s.best, 'Gen ' + s.gen + '  Alive ' + alive.length + '/' + s.birds.length + '  Best ' + s.best), C(0.7), C(0));
    else hudText(g, 2, 0, tr(f, '最高 ', 'Best ') + s.hi, C(0.6), C(0));
  } });

/* ════════════ 9. 自動解謎 ════════════ */
const PZ = {};
const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const MS_HUE = [0, 220, 120, 0, 270, 330, 180, 60, 0];
// ── 踩地雷 ──
PZ.mines = {
  init(s, f) {
    const { cols, rows, p } = f;
    s.ch = p.tiny ? 1 : rows >= 60 ? 2 : 1; s.cw = p.tiny ? 2 : s.ch === 2 ? 4 : 3;
    s.W = Math.floor((cols - 2) / s.cw); s.H = Math.floor((rows - 2) / s.ch);
    s.x0 = Math.floor((cols - s.W * s.cw) / 2); s.y0 = 1 + Math.floor((rows - 1 - s.H * s.ch) / 2);
    this.reset(s);
  },
  reset(s) {
    const n = s.W * s.H;
    s.mine = new Uint8Array(n); s.rev = new Uint8Array(n); s.flag = new Uint8Array(n); s.num = new Uint8Array(n);
    s.placed = false; s.left = 0; s.state = 'play'; s.endT = 0; s.acc = 0; s.queue = []; s.flood = []; s.cur = -1; s.boom = -1; s.flags = 0;
    s.total = Math.round(n * 0.17);
  },
  nb(s, i, fn) { const x = i % s.W, y = (i / s.W) | 0; for (const [dx, dy] of N8) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < s.W && Y < s.H) fn(Y * s.W + X); } },
  place(s, safe) {
    const n = s.W * s.H, ban = new Set([safe]); this.nb(s, safe, j => ban.add(j));
    let k = 0; while (k < s.total) { const i = (Math.random() * n) | 0; if (s.mine[i] || ban.has(i)) continue; s.mine[i] = 1; k++; }
    for (let i = 0; i < n; i++) { let c = 0; this.nb(s, i, j => (c += s.mine[j])); s.num[i] = c; }
    s.left = n - s.total; s.placed = true;
  },
  reveal(s, i) {
    if (s.rev[i] || s.flag[i]) return;
    if (!s.placed) this.place(s, i);
    if (s.mine[i]) { s.state = 'boom'; s.boom = i; s.endT = 0; return; }
    s.rev[i] = 1; s.left--; this.touch(s, i);
    if (!s.num[i]) s.flood.push(i);
  },
  touch(s, i) { this.nb(s, i, j => { if (s.rev[j] && s.num[j]) s.queue.push(j); }); if (s.num[i]) s.queue.push(i); },
  step(s) { // 找一個確定的動作；找不到就猜
    while (s.queue.length) {
      const i = s.queue.pop();
      let fl = 0; const un = [];
      this.nb(s, i, j => { if (s.flag[j]) fl++; else if (!s.rev[j]) un.push(j); });
      if (!un.length) continue;
      if (fl === s.num[i]) { s.queue.push(i); s.cur = un[0]; this.reveal(s, un[0]); return; }
      if (fl + un.length === s.num[i]) { s.queue.push(i); s.cur = un[0]; s.flag[un[0]] = 1; s.flags++; this.touch(s, un[0]); return; }
    }
    // 猜：挑地雷機率估計最低的未知格
    const n = s.W * s.H; let best = -1, bp = 2;
    const base = (s.total - s.flags) / Math.max(1, n);
    for (let tries = 0; tries < 400; tries++) {
      const i = (Math.random() * n) | 0; if (s.rev[i] || s.flag[i]) continue;
      let pr = base, cnt = 0;
      this.nb(s, i, j => { if (s.rev[j] && s.num[j]) { let fl = 0, un = 0; this.nb(s, j, q => { if (s.flag[q]) fl++; else if (!s.rev[q]) un++; }); pr = Math.max(pr, (s.num[j] - fl) / Math.max(1, un)); cnt++; } });
      if (!s.placed) pr = 0;
      if (pr < bp) { bp = pr; best = i; }
    }
    if (best < 0) { for (let i = 0; i < n; i++) if (!s.rev[i] && !s.flag[i]) { best = i; break; } }
    if (best >= 0) { s.cur = best; this.reveal(s, best); }
  },
  frame(s, f) {
    const { g, dt, C, H, cols, rows, p } = f, W = s.W, cw = s.cw, chh = s.ch;
    if (s.state !== 'play') { s.endT += dt; if (s.endT > 3) this.reset(s); }
    else {
      // 擴散式翻開（一圈一圈）
      if (s.flood.length) { const nf = []; for (const i of s.flood) this.nb(s, i, j => { if (!s.rev[j] && !s.flag[j]) { s.rev[j] = 1; s.left--; this.touch(s, j); if (!s.num[j]) nf.push(j); } }); s.flood = nf; }
      else {
        s.acc += dt * (p.tiny ? 140 : 26);
        while (s.acc >= 1 && s.state === 'play' && !s.flood.length) { s.acc -= 1; this.step(s); }
        if (s.acc > 3) s.acc = 0;
      }
      if (s.left <= 0 && s.placed) { s.state = 'win'; s.endT = 0; }
    }
    const boom = s.state === 'boom';
    for (let i = 0; i < W * s.H; i++) {
      const X = s.x0 + (i % W) * cw, Y = s.y0 + ((i / W) | 0) * chh, cxx = X + ((cw - 1) >> 1), cyy = Y + ((chh - 1) >> 1);
      if (s.rev[i]) {
        const n = s.num[i];
        if (n) g.set(cxx, cyy, String(n), H(MS_HUE[n], 0.75));
        else if (cw > 2) g.set(cxx, cyy, '·', C(0.18));
        continue;
      }
      const showMine = (boom || s.state === 'win') && s.mine[i];
      const chk = ((i % W) + ((i / W) | 0)) % 2, col = i === s.cur ? C(0.8) : C(0.3 + chk * 0.08);
      for (let dy = 0; dy < chh; dy++) for (let dx = 0; dx < cw; dx++) g.set(X + dx, Y + dy, '█', col);
      if (s.flag[i]) g.set(cxx, cyy, '▲', showMine || !boom ? H(0, 0.9) : H(30, 1));
      else if (showMine) g.set(cxx, cyy, i === s.boom ? '@' : '*', i === s.boom ? H(10, 1) : C(0.95));
    }
    if (boom) {
      const bx = s.x0 + (s.boom % W) * cw, by = s.y0 + ((s.boom / W) | 0) * chh, R = s.endT * 18;
      for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU; g.set(bx + Math.cos(a) * R, by + (Math.sin(a) * R) / f.aspect, '*', H(20 + k * 3, Math.max(0, 1 - s.endT / 2))); }
    }
    const msg = s.state === 'win' ? tr(f, '完成！', 'Cleared!') : boom ? tr(f, '踩到地雷了', 'Hit a mine!') : '';
    txt(g, s.x0, 0, tr(f, '地雷 ' + s.total + '　已插旗 ' + s.flags + '　剩下 ' + Math.max(0, s.left) + ' 格', 'Mines ' + s.total + '  Flagged ' + s.flags + '  Left ' + Math.max(0, s.left)), C(0.65));
    if (msg) ctext(g, 0, msg, C(1));
  },
};
// ── 2048 ──
PZ.g2048 = {
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    const sizeV = Math.min(cols * 0.62, (rows - 4) * A);
    s.tw = Math.floor(sizeV / 4); s.th = Math.max(2, Math.floor(s.tw / A));
    s.bx = Math.floor((cols - s.tw * 4) / 2); s.by = Math.floor((rows - s.th * 4) / 2) + 1;
    this.reset(s);
  },
  reset(s) { s.b = new Array(16).fill(0); s.score = 0; s.best = s.best || 0; s.anim = null; s.t = 0; s.over = 0; this.add(s); this.add(s); s.moves = 0; },
  add(s) { const e = []; s.b.forEach((v, i) => { if (!v) e.push(i); }); if (!e.length) return -1; const i = pick(e); s.b[i] = Math.random() < 0.9 ? 2 : 4; s.pop = { i, t: 0 }; return i; },
  slide(b, dir) { // 回傳 { b, moves:[from,to,merged], gain, moved }
    const out = new Array(16).fill(0), moves = []; let gain = 0, moved = false;
    for (let l = 0; l < 4; l++) {
      const idx = []; for (let k = 0; k < 4; k++) { const a = dir === 0 ? l * 4 + k : dir === 1 ? l * 4 + 3 - k : dir === 2 ? k * 4 + l : (3 - k) * 4 + l; idx.push(a); }
      let w = 0, last = -1;
      for (let k = 0; k < 4; k++) {
        const v = b[idx[k]]; if (!v) continue;
        if (last >= 0 && out[idx[last]] === v && !moves.find(m => m[1] === idx[last] && m[2])) { out[idx[last]] = v * 2; gain += v * 2; moves.push([idx[k], idx[last], 1]); moved = true; continue; }
        out[idx[w]] = v; moves.push([idx[k], idx[w], 0]); if (idx[k] !== idx[w]) moved = true; last = w; w++;
      }
    }
    return { b: out, moves, gain, moved };
  },
  evalB(b) {
    let empty = 0, mono = 0, smooth = 0, max = 0;
    for (let i = 0; i < 16; i++) { if (!b[i]) empty++; max = Math.max(max, b[i]); }
    const L = v => (v ? Math.log2(v) : 0);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const a = L(b[r * 4 + c]), d = L(b[r * 4 + c + 1]); mono += a >= d ? 0 : (d - a); if (a && d) smooth -= Math.abs(a - d); }
    for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) { const a = L(b[r * 4 + c]), d = L(b[(r + 1) * 4 + c]); mono += a >= d ? 0 : (d - a); if (a && d) smooth -= Math.abs(a - d); }
    const corner = b[0] === max ? L(max) * 2 : 0;
    return empty * 2.7 + smooth * 0.1 - mono * 1.0 + corner;
  },
  best(s) {
    let bestD = -1, bv = -1e9;
    for (let d = 0; d < 4; d++) {
      const r = this.slide(s.b, d); if (!r.moved) continue;
      // 期望值：對每個空格放 2，取平均的最佳下一步
      const e = []; r.b.forEach((v, i) => { if (!v) e.push(i); });
      let tot = 0, n = 0;
      for (const i of e.length > 6 ? e.filter((_, k) => k % 2 === 0) : e) {
        r.b[i] = 2; let m = -1e9;
        for (let d2 = 0; d2 < 4; d2++) { const r2 = this.slide(r.b, d2); if (r2.moved) m = Math.max(m, this.evalB(r2.b) + r2.gain * 0.01); }
        r.b[i] = 0; tot += m > -1e9 ? m : -50; n++;
      }
      const v = (n ? tot / n : this.evalB(r.b)) + r.gain * 0.02 + Math.random() * 0.05;
      if (v > bv) { bv = v; bestD = d; }
    }
    return bestD;
  },
  frame(s, f) {
    const { g, dt, C, H, cols, rows, aspect: A } = f;
    s.t += dt;
    if (s.over) { s.over += dt; if (s.over > 3) this.reset(s); }
    else if (s.anim) { s.anim.t += dt; if (s.anim.t >= 0.12) { s.b = s.anim.b; s.score += s.anim.gain; s.best = Math.max(s.best, s.score); s.anim = null; this.add(s); s.wait = 0.08; } }
    else { s.wait = (s.wait || 0) - dt; if (s.wait <= 0) { const d = this.best(s); if (d < 0) s.over = 0.01; else { const r = this.slide(s.b, d); s.anim = { t: 0, b: r.b, moves: r.moves, gain: r.gain }; s.moves++; } } }
    if (s.pop) s.pop.t += dt;
    const tw = s.tw, th = s.th, bx = s.bx, by = s.by;
    // 底盤
    fillRect(g, bx - 1, by - 1, tw * 4 + 2, th * 4 + 2, '█', C(0.12));
    for (let i = 0; i < 16; i++) fillRect(g, bx + (i % 4) * tw + 1, by + ((i / 4) | 0) * th, tw - 2, th - 1, '█', C(0.18));
    const tile = (x, y, v, sc) => {
      const L = Math.log2(v), col = H((L * 37 + 20) % 360, 0.35 + Math.min(0.45, L * 0.04)), w = Math.max(1, Math.round((tw - 2) * sc)), h = Math.max(1, Math.round((th - 1) * sc));
      const X = Math.round(x + (tw - 2 - w) / 2) + 1, Y = Math.round(y + (th - 1 - h) / 2);
      fillRect(g, X, Y, w, h, '█', col);
      const str = String(v), sy = th >= 10 ? 2 : 1, sx = Math.max(1, Math.round(sy * A * (str.length > 3 ? 0.5 : 1)));
      const fw = fontW(str, F3) * sx;
      if (sc > 0.8 && th >= 6 && fw < w - 1) drawBig(g, str, X + (w - fw) / 2, Y + (h - 5 * sy) / 2, sx, sy, C(0.02 + (L > 6 ? 0 : 0)), F3);
      else if (sc > 0.8) { const tx = Math.floor(X + (w - str.length) / 2); fillRect(g, Math.max(X, tx - 1), Y + (h >> 1), Math.min(w, str.length + 2), 1, ' ', col); txt(g, tx, Y + (h >> 1), str, C(0.98)); }
    };
    if (s.anim) {
      const k = smooth(Math.min(1, s.anim.t / 0.12));
      for (const [a, b] of s.anim.moves) { const ax = bx + (a % 4) * tw, ay = by + ((a / 4) | 0) * th, bbx = bx + (b % 4) * tw, bby = by + ((b / 4) | 0) * th; tile(lerp(ax, bbx, k), lerp(ay, bby, k), s.b[a], 1); }
    } else for (let i = 0; i < 16; i++) if (s.b[i]) { const sc = s.pop && s.pop.i === i ? Math.min(1, 0.3 + s.pop.t * 6) : 1; tile(bx + (i % 4) * tw, by + ((i / 4) | 0) * th, s.b[i], sc); }
    txt(g, bx, by - 2 - (rows > 40 ? 1 : 0), tr(f, '分數 ' + s.score + '　最佳 ' + s.best + '　步數 ' + s.moves, 'Score ' + s.score + '  Best ' + s.best + '  Moves ' + s.moves), C(0.7));
    if (s.over) ctext(g, by + th * 4 + 1, tr(f, '沒有路可以走了，重新開始', 'No moves left, starting over'), C(0.9));
  },
};
// ── 數獨 ──
PZ.sudoku = {
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    s.cs = Math.max(2, Math.floor(Math.min((cols * 0.7) / 9 / A, (rows - 3) / 9)));
    s.cws = Math.max(3, Math.round(s.cs * A)); s.bx = Math.floor((cols - s.cws * 9) / 2); s.by = Math.floor((rows - s.cs * 9) / 2) + 1;
    this.reset(s);
  },
  ok(b, i, v) { const r = (i / 9) | 0, c = i % 9, br = r - (r % 3), bc = c - (c % 3); for (let k = 0; k < 9; k++) { if (b[r * 9 + k] === v || b[k * 9 + c] === v || b[(br + ((k / 3) | 0)) * 9 + bc + (k % 3)] === v) return false; } return true; },
  fill(b, i) { if (i === 81) return true; if (b[i]) return this.fill(b, i + 1); const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5); for (const d of ds) if (this.ok(b, i, d)) { b[i] = d; if (this.fill(b, i + 1)) return true; } b[i] = 0; return false; },
  reset(s) {
    const full = new Array(81).fill(0); this.fill(full, 0);
    s.giv = full.slice(); const idx = [...Array(81).keys()].sort(() => Math.random() - 0.5);
    for (let k = 0; k < 50; k++) s.giv[idx[k]] = 0;
    s.b = s.giv.slice(); s.empt = []; for (let i = 0; i < 81; i++) if (!s.b[i]) s.empt.push(i);
    s.k = 0; s.tryv = new Array(81).fill(0); s.steps = 0; s.back = 0; s.done = 0; s.acc = 0; s.bad = -1; s.badT = 0; s.cur = -1;
  },
  step(s) {
    if (s.k >= s.empt.length) { s.done = 0.01; return; }
    const i = s.empt[s.k]; s.cur = i;
    let v = s.tryv[i] + 1;
    s.b[i] = 0;
    while (v <= 9 && !this.ok(s.b, i, v)) v++;
    s.steps++;
    if (v <= 9) { s.b[i] = v; s.tryv[i] = v; s.k++; }
    else { s.tryv[i] = 0; s.k--; s.back++; s.bad = i; s.badT = 0.25; if (s.k < 0) { s.k = 0; } }
  },
  frame(s, f) {
    const { g, dt, C, H, cols, rows } = f, cs = s.cs, cw = s.cws, bx = s.bx, by = s.by;
    if (s.done) { s.done += dt; if (s.done > 3.5) this.reset(s); }
    else { s.acc += dt * 45 * (1 + s.steps / 400); let guard = 0; while (s.acc >= 1 && !s.done && guard++ < 300) { s.acc -= 1; this.step(s); } if (s.acc > 5) s.acc = 0; }
    s.badT = Math.max(0, s.badT - dt);
    // 格線
    for (let r = 0; r <= 9; r++) for (let x = 0; x <= 9 * cw; x++) g.set(bx + x, by + r * cs, r % 3 ? '─' : '═', r % 3 ? C(0.25) : C(0.6));
    const jn = (r, c) => {
      const tr = r % 3 === 0, tc = c % 3 === 0;
      if (r === 0) return c === 0 ? '╔' : c === 9 ? '╗' : tc ? '╦' : '╤';
      if (r === 9) return c === 0 ? '╚' : c === 9 ? '╝' : tc ? '╩' : '╧';
      if (c === 0) return tr ? '╠' : '╟';
      if (c === 9) return tr ? '╣' : '╢';
      return tr ? (tc ? '╬' : '╪') : tc ? '╫' : '┼';
    };
    for (let c = 0; c <= 9; c++) for (let y = 0; y <= 9 * cs; y++) { const onH = y % cs === 0, r = y / cs, tc = c % 3 === 0; g.set(bx + c * cw, by + y, onH ? jn(r, c) : tc ? '║' : '│', tc || (onH && r % 3 === 0) ? C(0.6) : C(0.25)); }
    for (let i = 0; i < 81; i++) {
      const v = s.b[i], X = bx + (i % 9) * cw, Y = by + ((i / 9) | 0) * cs;
      if (i === s.cur && !s.done) fillRect(g, X + 1, Y + 1, cw - 1, cs - 1, '░', H(200, 0.4));
      if (i === s.bad && s.badT > 0) fillRect(g, X + 1, Y + 1, cw - 1, cs - 1, '▒', H(0, 0.5));
      if (!v) continue;
      const str = String(v), given = !!s.giv[i], col = given ? C(0.95) : s.done ? H(120 + (s.done * 60 + i * 4) % 360, 0.75) : H(190, 0.8);
      if (cs >= 7 && cw >= 9) { const sy = Math.max(1, Math.floor((cs - 1) / 6)), sx = Math.max(1, Math.round(sy * f.aspect)); drawBig(g, str, X + 1 + (cw - 1 - 3 * sx) / 2, Y + 1 + (cs - 1 - 5 * sy) / 2, sx, sy, col, F3); }
      else g.set(X + (cw >> 1), Y + (cs >> 1), str, col);
    }
    txt(g, bx, by - 1 - (rows > 40 ? 1 : 0), tr(f, '嘗試 ' + s.steps + ' 步　回溯 ' + s.back + ' 次' + (s.done ? '　解開了！' : ''), 'Tries ' + s.steps + '  Backtracks ' + s.back + (s.done ? '  Solved!' : '')), C(0.7));
  },
};
// ── 數字推盤（拼圖） ──
PZ.slide = {
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    s.n = rows >= 50 ? 5 : 4;
    const size = Math.min(cols * 0.62, (rows - 3) * A);
    s.tw = Math.floor(size / s.n); s.th = Math.max(2, Math.floor(s.tw / A));
    s.bx = Math.floor((cols - s.tw * s.n) / 2); s.by = Math.floor((rows - s.th * s.n) / 2) + 1;
    s.pic = 0; this.reset(s);
  },
  reset(s) {
    const n = s.n; s.b = [...Array(n * n).keys()].map(k => (k + 1) % (n * n)); s.e = n * n - 1;
    s.seq = []; let prev = -1;
    for (let k = 0; k < n * n * 6; k++) { const opts = this.nbs(s, s.e).filter(j => j !== prev); const j = pick(opts); prev = s.e; this.swap(s, j); s.seq.push(prev); }
    s.mode = 'show'; s.t = 0; s.anim = null; s.pic = (s.pic + 1) % 4; s.moves = 0;
  },
  nbs(s, e) { const n = s.n, x = e % n, y = (e / n) | 0, o = []; if (x > 0) o.push(e - 1); if (x < n - 1) o.push(e + 1); if (y > 0) o.push(e - n); if (y < n - 1) o.push(e + n); return o; },
  swap(s, j) { s.b[s.e] = s.b[j]; s.b[j] = 0; s.e = j; },
  picCell(s, u, v, t) { // 圖案：回傳 [字元, 色相, 亮度]
    const cx = u - 0.5, cy = v - 0.5, r = Math.hypot(cx, cy), a = Math.atan2(cy, cx);
    switch (s.pic) {
      case 0: { const k = Math.sin(r * 26 - t * 2); return [k > 0.3 ? '█' : k > -0.3 ? '▓' : '░', (r * 400) % 360, 0.35 + 0.3 * k]; }
      case 1: { const sun = r < 0.18, hill = v > 0.62 + 0.08 * Math.sin(u * 9); return sun ? ['█', 45, 0.8] : hill ? ['▓', 120, 0.35 + 0.2 * (v - 0.6)] : ['░', 200, 0.3 + 0.3 * (1 - v)]; }
      case 2: { const k = Math.floor((a / TAU + 0.5) * 12 + r * 4); return [k % 2 ? '█' : '▒', (k * 30) % 360, 0.45]; }
      default: { const k = (Math.floor(u * 8) + Math.floor(v * 8)) % 2; return [k ? '█' : '▓', u * 300, 0.3 + v * 0.35]; }
    }
  },
  frame(s, f) {
    const { g, dt, C, H, t } = f, n = s.n, tw = s.tw, th = s.th, bx = s.bx, by = s.by, W = tw * n, Hh = th * n;
    s.t += dt;
    if (s.mode === 'show') { if (s.t > 1.2) { s.mode = 'solve'; s.t = 0; } }
    else if (s.mode === 'solve') {
      if (s.anim) { s.anim.t += dt; if (s.anim.t >= 0.16) { this.swap(s, s.anim.j); s.anim = null; s.moves++; } }
      else if (s.seq.length) s.anim = { j: s.seq.pop(), t: 0 };
      else { s.mode = 'done'; s.t = 0; }
    } else if (s.t > 3) this.reset(s);
    const drawTile = (val, X, Y) => {
      const k = val - 1, u0 = (k % n) / n, v0 = ((k / n) | 0) / n;
      for (let dy = 0; dy < th - 1; dy++) for (let dx = 0; dx < tw - 1; dx++) {
        const [ch, hue, l] = this.picCell(s, u0 + (dx + 0.5) / W, v0 + (dy + 0.5) / Hh, t);
        g.set(X + dx, Y + dy, ch, H(hue, l));
      }
      const lab = String(val); txt(g, X + 1, Y, lab, C(1));
    };
    fillRect(g, bx - 1, by - 1, W + 1, Hh + 1, '·', C(0.1));
    for (let i = 0; i < n * n; i++) {
      const v = s.b[i]; if (!v) continue;
      let X = bx + (i % n) * tw, Y = by + ((i / n) | 0) * th;
      if (s.anim && s.anim.j === i) { const k = smooth(s.anim.t / 0.16); X = lerp(X, bx + (s.e % n) * tw, k); Y = lerp(Y, by + ((s.e / n) | 0) * th, k); }
      drawTile(v, Math.round(X), Math.round(Y));
    }
    if (s.mode === 'done' || s.mode === 'show') { const X = bx + (s.e % n) * tw, Y = by + ((s.e / n) | 0) * th; if (s.mode === 'done') drawTile(n * n, X, Y); }
    box(g, bx - 2, by - 2, W + 3, Hh + 3, C(0.5), true);
    txt(g, bx, by - 3 > 0 ? by - 3 : 0, f.lang === 'en' ? opq((s.mode === 'done' ? 'Solved!' : s.mode === 'show' ? 'Shuffled…' : 'Solving') + '  Moves ' + s.moves)
      : (s.mode === 'done' ? '拼好了！' : s.mode === 'show' ? '打亂了…' : '整理中') + '　移動 ' + s.moves + ' 步', C(0.7));
  },
};
// ── 河內塔 ──
PZ.hanoi = {
  init(s, f) {
    const { cols, rows } = f;
    s.n = rows >= 50 ? 9 : 6; s.dh = Math.max(1, Math.floor((rows * 0.85 - 5) / (s.n + 2)));
    s.base = rows - 3; s.px = [cols * 0.2, cols * 0.5, cols * 0.8]; s.maxW = cols * 0.27;
    s.pegs = [[...Array(s.n).keys()].map(k => s.n - k), [], []]; s.from = 0; s.to = 2; s.mvs = []; this.plan(s); s.cur = null; s.count = 0;
  },
  plan(s) { const out = []; const rec = (k, a, b, c) => { if (!k) return; rec(k - 1, a, c, b); out.push([a, b]); rec(k - 1, c, b, a); }; rec(s.n, s.from, s.to, 3 - s.from - s.to); s.mvs = out; },
  frame(s, f) {
    const { g, dt, C, H, cols, rows } = f, n = s.n, dh = s.dh;
    const topY = s.base - (n + 2) * dh - 2, spd = n > 6 ? 0.28 : 0.4;
    if (!s.cur && s.mvs.length) { const [a, b] = s.mvs.shift(); s.cur = { d: s.pegs[a].pop(), a, b, t: 0 }; }
    else if (!s.cur) { s.from = s.to; s.to = (s.to + 1) % 3; this.plan(s); s.count = 0; }
    if (s.cur) { s.cur.t += dt / spd; if (s.cur.t >= 3) { s.pegs[s.cur.b].push(s.cur.d); s.cur = null; s.count++; } }
    const dw = d => Math.max(3, Math.round((s.maxW * d) / n)) | 1;
    const drawDisk = (d, cx, y) => { const w = dw(d), x0 = Math.round(cx - w / 2); for (let r = 0; r < dh; r++) for (let k = 0; k < w; k++) g.set(x0 + k, y + r, dh > 1 && r === dh - 1 ? '▀' : '█', H(d * (300 / n), r === dh - 1 && dh > 1 ? 0.35 : 0.6)); };
    for (let x = Math.round(cols * 0.05); x < cols * 0.95; x++) g.set(x, s.base, '▀', C(0.45));
    for (let k = 0; k < 3; k++) for (let y = topY + 2; y < s.base; y++) g.set(s.px[k], y, '║', C(0.3));
    for (let k = 0; k < 3; k++) s.pegs[k].forEach((d, j) => drawDisk(d, s.px[k], s.base - (j + 1) * dh));
    if (s.cur) {
      const c = s.cur, ya = s.base - (s.pegs[c.a].length + 1) * dh, yb = s.base - (s.pegs[c.b].length + 1) * dh, t = c.t;
      let x, y;
      if (t < 1) { x = s.px[c.a]; y = lerp(ya, topY, smooth(t)); } else if (t < 2) { x = lerp(s.px[c.a], s.px[c.b], smooth(t - 1)); y = topY; } else { x = s.px[c.b]; y = lerp(topY, yb, smooth(t - 2)); }
      drawDisk(c.d, x, Math.round(y));
    }
    const total = (1 << n) - 1;
    ctext(g, 1, tr(f, '河內塔　' + n + ' 層　第 ' + s.count + ' / ' + total + ' 步', 'Tower of Hanoi  ' + n + ' disks  Move ' + s.count + ' / ' + total), C(0.7));
  },
};
// ── 四子棋 ──
PZ.connect4 = {
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    s.cs = Math.max(2, Math.floor((rows - 4) / 6)); s.cw = Math.max(3, Math.round(s.cs * A));
    if (s.cw * 7 > cols * 0.9) { s.cw = Math.floor((cols * 0.9) / 7); s.cs = Math.max(1, Math.round(s.cw / A)); }
    s.bx = Math.floor((cols - s.cw * 7) / 2); s.by = Math.floor((rows - s.cs * 6) / 2) + 1;
    this.reset(s); s.wins = [0, 0];
  },
  reset(s) { s.b = new Int8Array(42); s.turn = 1; s.drop = null; s.win = null; s.endT = 0; s.think = 0.4; s.fall = 0; },
  winner(b) {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { const v = b[r * 7 + c]; if (!v) continue; for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { const cells = [r * 7 + c]; for (let k = 1; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || b[rr * 7 + cc] !== v) break; cells.push(rr * 7 + cc); } if (cells.length === 4) return { v, cells }; } }
    return null;
  },
  score(b, me) {
    let sc = 0;
    for (let r = 0; r < 6; r++) sc += (b[r * 7 + 3] === me ? 3 : b[r * 7 + 3] === -me ? -3 : 0);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const er = r + dr * 3, ec = c + dc * 3; if (er < 0 || er > 5 || ec < 0 || ec > 6) continue;
      let m = 0, o = 0; for (let k = 0; k < 4; k++) { const v = b[(r + dr * k) * 7 + c + dc * k]; if (v === me) m++; else if (v === -me) o++; }
      if (m && o) continue; if (m === 3) sc += 6; else if (m === 2) sc += 2; if (o === 3) sc -= 8; else if (o === 2) sc -= 2;
    }
    return sc;
  },
  rowOf(b, c) { for (let r = 5; r >= 0; r--) if (!b[r * 7 + c]) return r; return -1; },
  winAt(b, r, c) {
    const v = b[r * 7 + c];
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let n = 1;
      for (const sgn of [1, -1]) for (let k = 1; k < 4; k++) { const rr = r + dr * k * sgn, cc = c + dc * k * sgn; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || b[rr * 7 + cc] !== v) break; n++; }
      if (n >= 4) return true;
    }
    return false;
  },
  mm(b, d, a, be, me, turn, lr, lc) {
    if (this.winAt(b, lr, lc)) return b[lr * 7 + lc] === me ? 10000 + d : -10000 - d;
    if (d === 0) return this.score(b, me);
    let any = false, best = turn === me ? -1e9 : 1e9;
    for (const c of [3, 2, 4, 1, 5, 0, 6]) {
      const r = this.rowOf(b, c); if (r < 0) continue; any = true;
      b[r * 7 + c] = turn; const v = this.mm(b, d - 1, a, be, me, -turn, r, c); b[r * 7 + c] = 0;
      if (turn === me) { best = Math.max(best, v); a = Math.max(a, v); } else { best = Math.min(best, v); be = Math.min(be, v); }
      if (be <= a) break;
    }
    return any ? best : 0;
  },
  frame(s, f) {
    const { g, dt, C, H, cols, rows, aspect: A } = f, cs = s.cs, cw = s.cw, bx = s.bx, by = s.by;
    const PH = { 1: 0, '-1': 50 };
    if (s.win || s.full) { s.endT += dt; if (s.endT > 3) { s.fall += dt * 30; if (s.fall > rows) { s.full = false; this.reset(s); } } }
    else if (s.drop) {
      s.drop.vy += dt * 60; s.drop.y += s.drop.vy * dt;
      if (s.drop.y >= s.drop.r) { s.b[s.drop.r * 7 + s.drop.c] = s.drop.v; s.drop = null; s.win = this.winner(s.b); if (s.win) s.wins[s.win.v > 0 ? 0 : 1]++; else if (s.b.every(v => v)) s.full = true; s.turn = -s.turn; s.think = 0.35; }
    } else {
      s.think -= dt;
      if (s.think <= 0) {
        let bc = 3, bv = -1e18;
        for (const c of [3, 2, 4, 1, 5, 0, 6]) { const r = this.rowOf(s.b, c); if (r < 0) continue; s.b[r * 7 + c] = s.turn; const v = this.mm(s.b, s.turn > 0 ? 4 : 3, -1e9, 1e9, s.turn, -s.turn, r, c) + Math.random() * 3; s.b[r * 7 + c] = 0; if (v > bv) { bv = v; bc = c; } }
        s.drop = { c: bc, r: this.rowOf(s.b, bc), y: -1, vy: 0, v: s.turn };
      }
    }
    const disc = (cx, cy, hue, lum) => {
      const R = cw * 0.42;
      for (let yy = Math.floor(cy - R / A) - 1; yy <= cy + R / A + 1; yy++) for (let xx = Math.floor(cx - R) - 1; xx <= cx + R + 1; xx++) {
        let top = false, bot = false;
        for (let h = 0; h < 2; h++) { const inside = Math.hypot(xx + 0.5 - cx, (yy + 0.25 + h * 0.5 - cy) * A) <= R; if (h) bot = inside; else top = inside; }
        if (top || bot) g.set(xx, yy, top && bot ? '█' : top ? '▀' : '▄', H(hue, lum));
      }
    };
    const off = s.fall;
    // 棋盤框
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
      const v = s.b[r * 7 + c], cx = bx + c * cw + cw / 2, cy = by + r * cs + cs / 2 + off;
      if (v) disc(cx, cy, PH[v], s.win && s.win.cells.includes(r * 7 + c) ? 0.6 + 0.35 * Math.sin(s.endT * 5) : 0.65);
      else g.set(cx, by + r * cs + cs / 2, '○', C(0.25));
    }
    if (s.drop) disc(bx + s.drop.c * cw + cw / 2, by + s.drop.y * cs + cs / 2, PH[s.drop.v], 0.7);
    for (let y = by; y <= by + cs * 6; y++) { g.set(bx - 1, y, '█', H(220, 0.35)); g.set(bx + cw * 7, y, '█', H(220, 0.35)); }
    for (let x = bx - 2; x <= bx + cw * 7 + 1; x++) g.set(x, by + cs * 6, '▀', H(220, 0.35));
    ctext(g, 0, f.lang === 'en' ? opq('Red ' + s.wins[0] + ' : ' + s.wins[1] + ' Yellow' + (s.win ? '  ' + (s.win.v > 0 ? 'Red' : 'Yellow') + ' gets four in a row!' : s.full ? '  Draw' : ''))
      : '紅 ' + s.wins[0] + ' ： ' + s.wins[1] + ' 黃' + (s.win ? '　' + (s.win.v > 0 ? '紅' : '黃') + '方連成四子！' : s.full ? '　平手' : ''), C(0.75));
  },
};
// ── 八皇后 ──
PZ.queens = {
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    s.N = 8; s.cs = Math.max(1, Math.floor((rows - 3) / s.N)); s.cw = Math.max(2, Math.round(s.cs * A));
    s.bx = Math.floor((cols - s.cw * s.N) / 2); s.by = Math.floor((rows - s.cs * s.N) / 2) + 1;
    s.q = new Int8Array(s.N).fill(-1); s.row = 0; s.sol = 0; s.steps = 0; s.hold = 0; s.acc = 0;
  },
  safe(s, r, c) { for (let k = 0; k < r; k++) { const q = s.q[k]; if (q === c || Math.abs(q - c) === r - k) return false; } return true; },
  step(s) {
    const N = s.N;
    if (s.row === N) { s.sol++; s.hold = 2; s.row--; return; }
    if (s.row < 0) { s.q.fill(-1); s.row = 0; s.sol = 0; return; }
    let c = s.q[s.row] + 1; s.steps++;
    while (c < N && !this.safe(s, s.row, c)) c++;
    if (c < N) { s.q[s.row] = c; s.row++; }
    else { s.q[s.row] = -1; s.row--; }
  },
  frame(s, f) {
    const { g, dt, C, H } = f, N = s.N, cs = s.cs, cw = s.cw, bx = s.bx, by = s.by;
    if (s.hold > 0) s.hold -= dt; else { s.acc += dt * 14; while (s.acc >= 1 && s.hold <= 0) { s.acc -= 1; this.step(s); } }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let att = false; for (let k = 0; k < N; k++) { const q = s.q[k]; if (q >= 0 && k !== r && (q === c || Math.abs(q - c) === Math.abs(k - r))) att = true; }
      const dark = (r + c) % 2, X = bx + c * cw, Y = by + r * cs;
      const cur = r === s.row && s.hold <= 0;
      fillRect(g, X, Y, cw, cs, dark ? '▓' : '░', cur ? (att ? H(0, dark ? 0.35 : 0.28) : H(130, dark ? 0.35 : 0.28)) : C(dark ? 0.22 : 0.14));
      if (s.q[r] === c) {
        const col = s.hold > 0 ? H(50, 1) : r === s.row - 1 ? H(190, 1) : C(0.95);
        if (cs >= 4) { const sp = [' ▄ ▄ ▄ ', ' █▄█▄█ ', ' ▀███▀ ', '▀▀▀▀▀▀▀']; const sx = X + (cw - 7) / 2, sy = Y + (cs - 4) / 2; fillRect(g, sx, sy, 7, 4, ' ', col); g.sprite(sx, sy, sp, col); }
        else g.set(X + (cw >> 1), Y + (cs >> 1), 'Q', col);
      }
    }
    box(g, bx - 1, by - 1, cw * N + 2, cs * N + 2, C(0.5), true);
    ctext(g, 0, tr(f, '八皇后　第 ' + s.sol + ' 組解（共 92 組）　嘗試 ' + s.steps + ' 次' + (s.hold > 0 ? '　找到了！' : ''), 'Eight Queens  Solution ' + s.sol + ' of 92  Tries ' + s.steps + (s.hold > 0 ? '  Found one!' : '')), C(0.75));
  },
};
A({ id: 'ga-puzzle', name: '自動解謎', cat: '遊戲', theme: 'blueprint', hue: true, desc: '電腦自己玩踩地雷，邊推理邊插旗',
  params: { game: 'mines', tiny: 0 },
  variants: [
    { id: 'g2048', name: '2048', theme: 'sunset', desc: '自己滑動合併數字方塊', params: { game: 'g2048' } },
    { id: 'sudoku', name: '數獨', theme: 'paper', desc: '一格一格試、不行就回頭', params: { game: 'sudoku' } },
    { id: 'slide', name: '推盤拼圖', theme: 'neon', desc: '打亂的圖片一步步推回原樣', params: { game: 'slide' } },
    { id: 'hanoi', name: '河內塔', theme: 'gold', desc: '一層層搬動彩色圓盤', params: { game: 'hanoi' } },
    { id: 'connect4', name: '四子棋', theme: 'ocean', desc: '紅黃兩方 AI 對下四子棋', params: { game: 'connect4' } },
    { id: 'queens', name: '八皇后', theme: 'lavender', desc: '回溯法找出八皇后的所有解', params: { game: 'queens' } },
    { id: 'minesbig', name: '巨型雷區', theme: 'matrix', desc: '鋪滿整個螢幕的超大雷區', params: { game: 'mines', tiny: 1 } },
  ],
  init(s, f) { s.G = PZ[f.p.game]; s.G.init.call(s.G, s, f); },
  frame(s, f) { s.G.frame.call(s.G, s, f); } });

/* ════════════ 10. 物理玩具 ════════════ */
const PH = {};
const SHADE = ' .:-=+*#%@';
// 畫一顆有光影的球（x、y、r 都是視覺單位：欄，y 已乘 aspect）
function sphere(g, f, x, y, r, hue, mono, clipY) {
  const A = f.aspect, y0 = Math.floor((y - r) / A), y1 = Math.ceil((y + r) / A);
  for (let row = y0; row <= y1; row++) {
    if (row < 0 || row >= g.rows || (clipY !== undefined && row >= clipY)) continue;
    const vy = (row + 0.5) * A - y;
    for (let col = Math.floor(x - r); col <= x + r; col++) {
      if (col < 0 || col >= g.cols) continue;
      const vx = col + 0.5 - x, d2 = (vx * vx + vy * vy) / (r * r);
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2), nx = vx / r, ny = vy / r;
      const li = clamp(-nx * 0.45 - ny * 0.55 + nz * 0.7, 0, 1), sp = Math.pow(li, 12);
      const k = clamp(li * 0.85 + 0.12, 0, 1);
      const i = row * g.cols + col;
      g.ch[i] = r < 1.6 ? '●' : SHADE[Math.min(9, 2 + Math.round(k * 7))];
      g.co[i] = mono ? f.C(0.25 + k * 0.7 + sp * 0.3) : sp > 0.5 ? f.C(1) : f.H(hue, 0.2 + k * 0.6);
    }
  }
}
// ── 彈力球 ──
PH.balls = {
  init(s, f) {
    const { cols, rows, aspect: A } = f, u = Math.min(cols / 100, rows / 28);
    s.W = cols; s.Hv = rows * A; s.G = s.Hv * 0.35;
    s.b = [];
    for (let k = 0; k < 22; k++) {
      const r = rnd(1.6, 4.5) * u;
      let x, y, ok, tries = 0;
      do { x = rnd(r, cols - r); y = rnd(r, s.Hv * 0.7); ok = s.b.every(o => Math.hypot(o.x - x, o.y - y) > o.r + r + 0.5); } while (!ok && ++tries < 200);
      s.b.push({ x, y, vx: rnd(-1, 1) * cols * 0.25, vy: rnd(-1, 1) * s.Hv * 0.2, r, m: r * r, hue: (k * 37) % 360 });
    }
    s.E0 = this.energy(s);
  },
  energy(s) { let e = 0; for (const b of s.b) e += b.m * (0.5 * (b.vx * b.vx + b.vy * b.vy) + s.G * (s.Hv - b.y)); return e; },
  frame(s, f) {
    const { dt } = f, n = 4, h = dt / n;
    for (let it = 0; it < n; it++) {
      for (const b of s.b) {
        b.vy += s.G * h; b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < b.r && b.vx < 0) { b.x = b.r; b.vx = -b.vx; } if (b.x > s.W - b.r && b.vx > 0) { b.x = s.W - b.r; b.vx = -b.vx; }
        if (b.y < b.r && b.vy < 0) { b.y = b.r; b.vy = -b.vy; } if (b.y > s.Hv - b.r && b.vy > 0) { b.y = s.Hv - b.r; b.vy = -b.vy; }
      }
      for (let i = 0; i < s.b.length; i++) for (let j = i + 1; j < s.b.length; j++) {
        const a = s.b[i], c = s.b[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), md = a.r + c.r;
        if (d >= md || d === 0) continue;
        const nx = dx / d, ny = dy / d, ov = md - d, tm = a.m + c.m;
        a.x -= nx * ov * (c.m / tm); a.y -= ny * ov * (c.m / tm); c.x += nx * ov * (a.m / tm); c.y += ny * ov * (a.m / tm);
        const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny; if (rv > 0) continue;
        const imp = (2 * rv) / tm;
        a.vx += imp * c.m * nx; a.vy += imp * c.m * ny; c.vx -= imp * a.m * nx; c.vy -= imp * a.m * ny;
      }
    }
    // 能量校正，避免數值誤差讓球越跳越低或越跳越高
    const E = this.energy(s);
    let ke = 0; for (const b of s.b) ke += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);
    if (ke > 1) { const k = Math.sqrt(Math.max(0.2, (ke + (s.E0 - E)) / ke)); for (const b of s.b) { b.vx *= k; b.vy *= k; } }
    for (const b of s.b) {
      sphere(f.g, f, b.x, b.y, b.r, b.hue);
      const sy = f.rows - 1, w = b.r * (0.4 + 0.6 * (b.y / s.Hv));
      for (let x = Math.round(b.x - w); x <= b.x + w; x++) if (f.g.ch[sy * f.cols + x] === ' ' || f.g.ch[sy * f.cols + x] === undefined) f.g.set(x, sy, '_', f.C(0.12 + 0.1 * (b.y / s.Hv)));
    }
  },
};
// ── 撞球 ──
PH.pool = {
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    let tw = Math.min(cols - 6, rows * A * 1.9);
    for (let k = 0; k < 60; k++) { const r = tw / 56, cush = Math.max(1, Math.round(r * 1.2)), T = (rows * A - tw / 2) / 2; if (Math.floor(T / A) - Math.ceil(cush / A) - 2 >= 0) break; tw *= 0.97; }
    const th = tw / 2;
    s.L = (cols - tw) / 2; s.R = s.L + tw; s.T = (rows * A - th) / 2; s.B = s.T + th; s.r = tw / 56; s.A = A;
    s.pockets = []; for (const px of [s.L, (s.L + s.R) / 2, s.R]) for (const py of [s.T, s.B]) s.pockets.push({ x: px, y: py });
    this.rack(s);
  },
  rack(s) {
    const r = s.r, fx = s.L + (s.R - s.L) * 0.72, cy = (s.T + s.B) / 2, order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    s.b = [{ x: s.L + (s.R - s.L) * 0.25, y: cy, vx: 0, vy: 0, n: 0 }]; let k = 0;
    for (let c = 0; c < 5; c++) for (let j = 0; j <= c; j++) s.b.push({ x: fx + c * r * 1.75, y: cy + (j - c / 2) * r * 2.02, vx: 0, vy: 0, n: order[k++] });
    s.phase = 'aim'; s.t = 0; s.shots = 0; this.plan(s);
  },
  plan(s) {
    const cue = s.b.find(b => b.n === 0), r = s.r;
    let best = null;
    for (const b of s.b) { if (b.n === 0) continue; for (const p of s.pockets) {
      const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy), gx = b.x - (dx / d) * r * 2, gy = b.y - (dy / d) * r * 2;
      const ax = gx - cue.x, ay = gy - cue.y, ad = Math.hypot(ax, ay), cut = (ax * dx + ay * dy) / (ad * d);
      if (cut < 0.35) continue;
      const sc = cut * 2 - (d + ad) / (s.R - s.L);
      if (!best || sc > best.sc) best = { sc, ang: Math.atan2(ay, ax), pow: clamp((d + ad) / (s.R - s.L) * 1.6, 0.6, 1.4) };
    } }
    if (s.shots === 0) best = { ang: Math.atan2((s.T + s.B) / 2 - cue.y + rnd(-0.3, 0.3) * r, s.L + (s.R - s.L) * 0.72 - cue.x), pow: 2.4 };
    if (!best) best = { ang: rnd(0, TAU), pow: 1.2 };
    s.aim = best;
  },
  frame(s, f) {
    const { g, dt, C, H, cols, rows } = f, A = s.A, r = s.r;
    s.t += dt;
    if (s.phase === 'aim' && s.t > 1.1) {
      const cue = s.b.find(b => b.n === 0), sp = (s.R - s.L) * 1.05 * s.aim.pow;
      cue.vx = Math.cos(s.aim.ang) * sp; cue.vy = Math.sin(s.aim.ang) * sp; s.phase = 'roll'; s.shots++;
    }
    if (s.phase === 'roll') {
      const n = 6, h = dt / n; let moving = false;
      for (let it = 0; it < n; it++) {
        for (const b of s.b) {
          const v = Math.hypot(b.vx, b.vy);
          if (v > 0) { const nv = Math.max(0, v - (s.R - s.L) * 0.22 * h); b.vx *= nv / v; b.vy *= nv / v; }
          b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < s.L + r) { b.x = s.L + r; b.vx = Math.abs(b.vx) * 0.85; } if (b.x > s.R - r) { b.x = s.R - r; b.vx = -Math.abs(b.vx) * 0.85; }
          if (b.y < s.T + r) { b.y = s.T + r; b.vy = Math.abs(b.vy) * 0.85; } if (b.y > s.B - r) { b.y = s.B - r; b.vy = -Math.abs(b.vy) * 0.85; }
          if (Math.hypot(b.vx, b.vy) > 0.5) moving = true;
        }
        for (let i = 0; i < s.b.length; i++) for (let j = i + 1; j < s.b.length; j++) {
          const a = s.b[i], c = s.b[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
          if (d >= 2 * r || d === 0) continue;
          const nx = dx / d, ny = dy / d, ov = 2 * r - d; a.x -= nx * ov / 2; a.y -= ny * ov / 2; c.x += nx * ov / 2; c.y += ny * ov / 2;
          const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny; if (rv > 0) continue;
          a.vx += rv * nx; a.vy += rv * ny; c.vx -= rv * nx; c.vy -= rv * ny;
        }
        for (let k = s.b.length - 1; k >= 0; k--) { const b = s.b[k]; if (s.pockets.some(p => Math.hypot(p.x - b.x, p.y - b.y) < r * 1.7)) { if (b.n === 0) { b.x = s.L + (s.R - s.L) * 0.25; b.y = (s.T + s.B) / 2; b.vx = b.vy = 0; } else s.b.splice(k, 1); } }
      }
      if (!moving) { for (const b of s.b) b.vx = b.vy = 0; if (s.b.length <= 2 || s.shots > 30) this.rack(s); else { s.phase = 'aim'; s.t = 0; this.plan(s); } }
    }
    // 桌面
    const rL = Math.floor(s.L), rR = Math.ceil(s.R), rT = Math.floor(s.T / A), rB = Math.ceil(s.B / A), cush = Math.max(1, Math.round(r * 1.2));
    for (let y = rT - Math.ceil(cush / A) - 1; y <= rB + Math.ceil(cush / A); y++) for (let x = rL - cush - 1; x <= rR + cush; x++) {
      const inside = x >= rL && x < rR && y >= rT && y < rB;
      g.set(x, y, inside ? ((x + y) % 2 ? '░' : ' ') : '█', inside ? H(140, 0.22) : H(25, 0.32 + ((x + y) % 5 === 0 ? 0.05 : 0)));
    }
    for (const p of s.pockets) for (let y = Math.floor((p.y - r * 1.8) / A); y <= (p.y + r * 1.8) / A; y++) for (let x = Math.floor(p.x - r * 1.8); x <= p.x + r * 1.8; x++) if (Math.hypot(x + 0.5 - p.x, (y + 0.5) * A - p.y) < r * 1.8) g.set(x, y, '█', C(0.03));
    const BH = [0, 50, 220, 0, 270, 25, 140, 340, 0, 50, 220, 0, 270, 25, 140, 340];
    for (const b of s.b) {
      if (b.n === 0) sphere(g, f, b.x, b.y, r, 0, true);
      else if (b.n === 8) sphere(g, f, b.x, b.y, r, 0, true), g.set(b.x, b.y / A, '8', C(0.05));
      else { sphere(g, f, b.x, b.y, r, BH[b.n]); if (b.n > 8) g.set(b.x, b.y / A, '═', C(0.95)); }
    }
    if (s.phase === 'aim') {
      const cue = s.b.find(b => b.n === 0), a = s.aim.ang, pull = r * 2 + Math.max(0, Math.sin(s.t * 3)) * r * 2;
      for (let k = 0; k < r * 14; k += 0.5) { const x = cue.x - Math.cos(a) * (pull + k), y = cue.y - Math.sin(a) * (pull + k); g.set(x, y / A, segCh(Math.cos(a), Math.sin(a)), k < r * 2 ? C(0.9) : H(30, 0.55)); }
      for (let k = 2; k < 40; k += 2) { const x = cue.x + Math.cos(a) * r * k * 0.6, y = cue.y + Math.sin(a) * r * k * 0.6; if (x > s.L && x < s.R && y > s.T && y < s.B) g.set(x, y / A, '·', C(0.35)); }
    }
    txt(g, rL, Math.max(0, rT - Math.ceil(cush / A) - 2), tr(f, '第 ' + s.shots + ' 桿　檯面上 ' + (s.b.length - 1) + ' 顆球', 'Shot ' + s.shots + '  ' + enN(s.b.length - 1, 'ball') + ' on the table'), C(0.6));
  },
};
// ── 牛頓擺 ──
PH.cradle = {
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    s.n = 5; s.R = Math.min(cols * 0.055, rows * A * 0.09); s.L = rows * A * 0.5; s.top = rows * A * 0.12; s.cx = cols / 2; s.k = 1; s.ph = 0; s.amp = 0.75;
  },
  frame(s, f) {
    const { g, dt, C, H, cols, rows } = f, A = f.aspect, n = s.n, R = s.R, L = s.L;
    const w = Math.sqrt(9.8 / (L / (rows * A) * 2.2)) * 1.6;
    const prev = Math.sin(s.ph); s.ph += dt * w; const cur = Math.sin(s.ph);
    if (prev < 0 && cur >= 0 && Math.floor(s.ph / TAU) % 4 === 3) s.k = s.k % 3 + 1;
    const th = s.amp * Math.sin(s.ph);
    const px = k => s.cx + (k - (n - 1) / 2) * R * 2.02;
    // 支架
    const fy = Math.round(s.top / A), fl = Math.round(px(0) - R * 4), fr = Math.round(px(n - 1) + R * 4), base = Math.round((s.top + L + R * 2.5) / A);
    for (let x = fl; x <= fr; x++) { g.set(x, fy, '═', C(0.6)); g.set(x, base, '▀', C(0.45)); }
    for (let y = fy; y <= base; y++) { g.set(fl, y, '║', C(0.6)); g.set(fr, y, '║', C(0.6)); }
    g.set(fl, fy, '╔', C(0.6)); g.set(fr, fy, '╗', C(0.6));
    for (let k = 0; k < n; k++) {
      let a = 0;
      if (th < 0 && k < s.k) a = th; else if (th > 0 && k >= n - s.k) a = th;
      const bx = px(k) + Math.sin(a) * L, by = s.top + Math.cos(a) * L;
      for (const off of [-R * 0.6, R * 0.6]) { const sx = px(k) + off; g.line(sx, fy + 1, bx + off * 0.2, by / A - R / A * 0.8, segCh(bx - sx, by - (fy + 1) * A), C(0.35)); }
      sphere(g, f, bx, by, R, 0, true);
      const sh = Math.round(R * 0.8); for (let x = Math.round(bx - sh); x <= bx + sh; x++) g.set(x, base - 1, '_', C(0.1 + 0.1 * (1 - Math.abs(a))));
    }
    ctext(g, base + 2 < rows ? base + 2 : rows - 1, tr(f, '動量守恆　這次擺動 ' + s.k + ' 顆', 'Momentum is conserved  ' + enN(s.k, 'ball') + ' swinging'), C(0.5));
  },
};
// ── 高爾頓板 ──
PH.galton = {
  init(s, f) {
    const { cols, rows } = f;
    s.rowsN = rows >= 50 ? 14 : 9; s.dx = Math.max(2, Math.floor((cols * 0.5) / s.rowsN)); s.top = 2; s.dy = Math.max(1, Math.floor((rows * 0.45) / s.rowsN));
    s.binTop = s.top + s.rowsN * s.dy + 1; s.binH = rows - s.binTop - 1; s.cx = Math.floor(cols / 2);
    s.bins = new Array(s.rowsN + 1).fill(0); s.balls = []; s.acc = 0; s.total = 0; s.drain = 0;
  },
  frame(s, f) {
    const { g, dt, C, H, cols, rows } = f, N = s.rowsN;
    if (s.drain > 0) { s.drain -= dt; if (s.drain <= 0) { s.bins.fill(0); s.total = 0; } }
    else {
      s.acc += dt * (rows >= 50 ? 14 : 8);
      while (s.acc >= 1) { s.acc -= 1; s.balls.push({ r: -1, pos: 0, p: 0, hue: rnd(0, 360), next: 0 }); }
    }
    const spd = 4.5;
    for (let k = s.balls.length - 1; k >= 0; k--) {
      const b = s.balls[k]; b.p += dt * spd;
      while (b.p >= 1) { b.p -= 1; b.r++; b.pos += b.next; b.next = Math.random() < 0.5 ? -0.5 : 0.5; if (b.r >= N) break; }
      if (b.r >= N) { const bin = Math.round(b.pos + N / 2); s.bins[clamp(bin, 0, N)]++; s.total++; s.balls.splice(k, 1); continue; }
    }
    if (Math.max(...s.bins) >= s.binH * 2 - 1 && s.drain <= 0) s.drain = 1.2;
    // 釘子
    for (let r = 0; r < N; r++) for (let j = 0; j <= r; j++) g.set(s.cx + (j - r / 2) * s.dx * 2, s.top + r * s.dy + s.dy, '•', C(0.55));
    // 箱子
    for (let j = 0; j <= N + 1; j++) { const x = s.cx + (j - (N + 1) / 2) * s.dx * 2; for (let y = s.binTop; y < rows - 1; y++) g.set(x, y, '│', C(0.3)); }
    for (let x = Math.round(s.cx - (N + 1) * s.dx); x <= s.cx + (N + 1) * s.dx; x++) g.set(x, rows - 1, '▀', C(0.4));
    const drop = s.drain > 0 ? (1.2 - s.drain) * rows * 1.5 : 0;
    for (let j = 0; j <= N; j++) {
      const x = s.cx + (j - N / 2) * s.dx * 2, cnt = s.bins[j];
      for (let k = 0; k < cnt; k++) { const y = rows - 2 - Math.floor(k / 2) + drop; if (y < rows - 1) for (let w = -Math.floor(s.dx * 0.8) + 1; w < s.dx * 0.8; w++) if ((w + k) % 2 === 0 || s.dx < 3) g.set(x + w, y, 'o', H((j * 300) / N, 0.55 + 0.3 * (k / (s.binH * 2)))); }
      // 理論曲線
      let c = 1; for (let q = 0; q < j; q++) c = (c * (N - q)) / (q + 1);
      const exp = (s.total * c) / Math.pow(2, N), ey = rows - 2 - exp / 2;
      if (ey > s.binTop && ey < rows - 1) for (let w = -s.dx + 1; w < s.dx; w++) g.set(x + w, ey, '─', C(0.75));
    }
    for (const b of s.balls) {
      const y0 = s.top + (b.r + 1) * s.dy, x0 = s.cx + b.pos * s.dx * 2, x1 = x0 + b.next * s.dx * 2;
      const x = lerp(x0, x1, b.p), y = y0 - (b.r >= 0 ? Math.sin(b.p * Math.PI) * s.dy * 0.6 : 0) + b.p * s.dy - 0.5;
      g.set(x, b.r < 0 ? s.top + b.p * s.dy : y, '●', H(b.hue, 0.85));
    }
    txt(g, 2, 0, tr(f, '高爾頓板　已落下 ' + s.total + ' 顆　線條是二項分布的理論值', 'Galton board  ' + enN(s.total, 'bead') + ' dropped  Lines show the binomial prediction'), C(0.6));
  },
};
// ── 擺動波 ──
PH.wave = {
  init(s, f) { s.n = f.rows >= 50 ? 22 : 12; s.trail = []; },
  frame(s, f) {
    const { g, C, H, cols, rows, t } = f, A = f.aspect, n = s.n, T = 60, amp = cols * 0.38, R = Math.min(cols * 0.02, (rows / n) * A * 0.42);
    const cx = cols / 2, y0 = rows * 0.06, gap = (rows * 0.8) / (n - 1);
    for (let k = 0; k < n; k++) {
      const freq = (40 + k) / T, x = cx + amp * Math.cos(TAU * freq * t), y = y0 + k * gap;
      for (let xx = Math.round(cx - amp - R); xx <= cx + amp + R; xx += 2) g.set(xx, y, '·', C(0.12));
      g.set(cx, y, '┼', C(0.3));
      for (let j = 1; j <= 6; j++) { const xt = cx + amp * Math.cos(TAU * freq * (t - j * 0.035)); g.set(xt, y, '░', H((k * 360) / n, 0.5 - j * 0.06)); }
      sphere(g, f, x, (y + 0.5) * A, Math.max(0.9, R), (k * 360) / n);
    }
    const ph = (t % T) / T;
    txt(g, 2, rows - 1, tr(f, '擺長各不相同的 ' + n + ' 個擺　每 60 秒回到同一列　', n + ' pendulums of different lengths  Back in line every 60 s  ') + Math.round(ph * 100) + '%', C(0.5));
  },
};
// ── 氣體分子 ──
PH.gas = {
  init(s, f) {
    const { cols, rows } = f;
    s.W = cols; s.H = rows - 7; s.n = Math.min(1600, Math.round((cols * s.H) / 14)); s.wall = cols / 2; s.hole = s.H * 0.18;
    s.x = new Float32Array(s.n); s.y = new Float32Array(s.n); s.vx = new Float32Array(s.n); s.vy = new Float32Array(s.n); s.t = 0;
    for (let i = 0; i < s.n; i++) { const hot = i % 2 === 0, sp = hot ? cols * 0.45 : cols * 0.12, a = rnd(0, TAU); s.x[i] = hot ? rnd(1, s.wall - 1) : rnd(s.wall + 1, cols - 1); s.y[i] = rnd(0.5, s.H - 0.5); s.vx[i] = Math.cos(a) * sp * rnd(0.5, 1.5); s.vy[i] = Math.sin(a) * sp * rnd(0.5, 1.5) / f.aspect; }
    s.cell = new Int32Array(cols * s.H).fill(-1); s.open = 0;
  },
  frame(s, f) {
    const { g, dt, C, H, cols, rows } = f, A = f.aspect, n = s.n;
    s.t += dt; s.open = Math.min(1, s.t / 3);
    if (s.t > 70) this.init(s, f);
    const hole = s.hole * s.open, mid = s.H / 2;
    s.cell.fill(-1);
    for (let i = 0; i < n; i++) {
      const ox = s.x[i];
      s.x[i] += s.vx[i] * dt; s.y[i] += s.vy[i] * dt;
      if (s.x[i] < 0) { s.x[i] = -s.x[i]; s.vx[i] = -s.vx[i]; } if (s.x[i] >= cols) { s.x[i] = 2 * cols - s.x[i] - 0.01; s.vx[i] = -s.vx[i]; }
      if (s.y[i] < 0) { s.y[i] = -s.y[i]; s.vy[i] = -s.vy[i]; } if (s.y[i] >= s.H) { s.y[i] = 2 * s.H - s.y[i] - 0.01; s.vy[i] = -s.vy[i]; }
      if ((ox < s.wall) !== (s.x[i] < s.wall) && Math.abs(s.y[i] - mid) > hole) { s.x[i] = ox; s.vx[i] = -s.vx[i]; }
      const c = (s.y[i] | 0) * cols + (s.x[i] | 0), j = s.cell[c];
      if (j >= 0) { // 同格就做一次彈性碰撞（速度沿隨機方向交換）
        const a = rnd(0, TAU), nx = Math.cos(a), ny = Math.sin(a);
        const vi = s.vx[i] * nx + s.vy[i] * A * ny, vj = s.vx[j] * nx + s.vy[j] * A * ny, d = vj - vi;
        s.vx[i] += d * nx; s.vy[i] += (d * ny) / A; s.vx[j] -= d * nx; s.vy[j] -= (d * ny) / A;
      } else s.cell[c] = i;
    }
    const hist = new Array(24).fill(0), vmax = cols * 0.9;
    let eL = 0, eR = 0, nL = 0, nR = 0;
    for (let i = 0; i < n; i++) {
      const v = Math.hypot(s.vx[i], s.vy[i] * A), k = Math.min(1, v / vmax);
      if (s.x[i] < s.wall) { eL += v * v; nL++; } else { eR += v * v; nR++; }
      hist[Math.min(23, (k * 24) | 0)]++;
      g.set(s.x[i], s.y[i], k > 0.5 ? '•' : k > 0.25 ? '∙' : '·', H(240 - k * 240, 0.45 + k * 0.5));
    }
    for (let y = 0; y < s.H; y++) if (Math.abs(y + 0.5 - mid) > hole) g.set(s.wall, y, '█', C(0.4));
    for (let x = 0; x < cols; x++) g.set(x, s.H, '▀', C(0.35));
    // 速度分布長條圖
    const hb = rows - s.H - 2, mx = Math.max(...hist), bw = Math.max(1, Math.floor((cols * 0.5) / 24)), hx = Math.floor(cols * 0.45);
    for (let k = 0; k < 24; k++) { const h = (hist[k] / mx) * hb; for (let y = 0; y < Math.ceil(h); y++) for (let w = 0; w < bw - (bw > 1 ? 1 : 0); w++) g.set(hx + k * bw + w, rows - 1 - y, y + 1 > h && h % 1 < 0.5 ? '▄' : '█', H(240 - (k / 24) * 240, 0.6)); }
    const TL = nL ? eL / nL : 0, TR = nR ? eR / nR : 0, tmax = Math.max(TL, TR, 1);
    txt(g, 2, s.H + 2, tr(f, '左室溫度 ', 'Left chamber temp ') + Math.round((TL / tmax) * 100), H(15, 0.8)); txt(g, 2, s.H + 3, tr(f, '右室溫度 ', 'Right chamber temp ') + Math.round((TR / tmax) * 100), H(220, 0.8));
    if (rows - s.H > 5) txt(g, 2, s.H + 5, tr(f, '中間隔板開了個洞，冷熱分子慢慢混合', 'A hole in the divider lets hot and cold molecules slowly mix'), C(0.45));
  },
};
// ── 骨牌 ──
PH.domino = {
  init(s, f) {
    const { cols, rows } = f;
    s.shelves = rows >= 50 ? 5 : 3; s.dh = Math.max(3, Math.floor((rows / s.shelves) * 0.55)); s.sp = Math.max(2, Math.round(s.dh * f.aspect * 0.42));
    s.per = Math.floor((cols - 8) / s.sp); s.d = []; const N = s.per * s.shelves;
    for (let k = 0; k < N; k++) s.d.push({ a: 0, w: 0, on: false });
    s.d[0].on = true; s.d[0].w = 1.2; s.phase = 'fall'; s.t = 0; s.dir = 1;
  },
  pos(s, f, k) { const sh = Math.floor(k / s.per), j = k % s.per, rev = sh % 2 === 1; const x = 4 + (rev ? s.per - 1 - j : j) * s.sp; const base = Math.round(((sh + 1) * (f.rows - 1)) / s.shelves) - 1; return { x, base, dir: rev ? -1 : 1 }; },
  frame(s, f) {
    const { g, dt, C, H, cols, rows } = f, A = f.aspect, N = s.d.length, maxA = Math.asin(Math.min(1, s.sp / (s.dh * A))) ;
    s.t += dt;
    if (s.phase === 'fall') {
      let allDone = true;
      for (let k = 0; k < N; k++) {
        const d = s.d[k]; if (!d.on) { allDone = false; continue; }
        const lim = k === N - 1 ? Math.PI / 2 : maxA * 0.98;
        if (d.a < lim) { d.w += dt * 9 * Math.sin(Math.max(0.15, d.a)); d.a = Math.min(lim, d.a + d.w * dt); allDone = false; }
        if (k < N - 1 && !s.d[k + 1].on && d.a >= maxA * 0.9) { s.d[k + 1].on = true; s.d[k + 1].w = d.w * 0.8; }
        if (k < N - 1 && (k + 1) % s.per === 0 && !s.d[k + 1].on && d.a >= lim * 0.95) { s.d[k + 1].on = true; s.d[k + 1].w = 1; }
      }
      if (allDone) { s.phase = 'rest'; s.t = 0; }
    } else if (s.phase === 'rest') { if (s.t > 2) { s.phase = 'rise'; s.t = 0; } }
    else { const k = s.t / 3; for (let i = 0; i < N; i++) { const d = s.d[i], q = clamp(k * 1.6 - (1 - i / N) * 0.6, 0, 1); d.a = d.a * (1 - q); } if (s.t > 3.2) this.init(s, f); }
    for (let sh = 0; sh < s.shelves; sh++) { const base = Math.round(((sh + 1) * (rows - 1)) / s.shelves) - 1; for (let x = 1; x < cols - 1; x++) g.set(x, base + 1 > rows - 1 ? rows - 1 : base + 1, '▀', C(0.3)); }
    for (let k = 0; k < N; k++) {
      const d = s.d[k], p = this.pos(s, f, k), a = d.a * p.dir, len = s.dh * A;
      const x1 = p.x + Math.sin(a) * len, y1 = p.base + 1 - (Math.cos(a) * len) / A, col = H((k * 360) / N, 0.7);
      const tk = Math.max(1, Math.round(s.sp * 0.35)), ch = Math.abs(a) < 0.35 ? '█' : segCh(x1 - p.x, (y1 - p.base) * A);
      for (let o = 0; o < tk; o++) { const ox = -p.dir * o * Math.cos(a), oy = (-Math.sin(Math.abs(a)) * o) / A * 0; g.line(p.x + ox, p.base + oy, x1 + ox, y1 + oy, ch, H((k * 360) / N, o === 0 ? 0.75 : 0.5)); }
      g.set(x1, y1, '▪', C(0.95));
    }
    const fallen = s.d.filter(d => d.a > 0.05).length;
    txt(g, 2, 0, tr(f, '骨牌 ' + fallen + ' / ' + N + (s.phase === 'rise' ? '　倒帶中…' : ''), 'Dominoes ' + fallen + ' / ' + N + (s.phase === 'rise' ? '  Rewinding…' : '')), C(0.6));
  },
};
// ── 彈跳文字 ──
PH.words = {
  init(s, f) {
    const { cols, rows, aspect: A } = f, words = rows >= 40 ? ['ASCII', 'ART', 'BOUNCE', 'HELLO'] : ['ASCII', 'ART', 'HELLO'];
    const sy = Math.max(1, Math.floor(rows / 22)), sx = Math.max(1, Math.round(sy * A));
    s.w = words.map((wd, k) => { const w = fontW(wd, F5) * sx, h = 7 * sy; return { txt: wd, w, h, x: rnd(1, cols - w - 1), y: (k + 0.5) * rows / words.length - h / 2, vx: rnd(10, 20) * (k % 2 ? -1 : 1) * (cols / 100), vy: rnd(3, 7) * (k % 2 ? 1 : -1) * (rows / 28), hue: k * 90, sx, sy, tr: [] }; });
    for (const o of s.w) o.y = clamp(o.y, 0, rows - o.h);
  },
  frame(s, f) {
    const { g, dt, C, H, cols, rows } = f;
    for (const o of s.w) {
      o.x += o.vx * dt; o.y += o.vy * dt;
      let hit = false;
      if (o.x < 0 && o.vx < 0) { o.x = 0; o.vx = -o.vx; hit = true; } if (o.x + o.w > cols && o.vx > 0) { o.x = cols - o.w; o.vx = -o.vx; hit = true; }
      if (o.y < 0 && o.vy < 0) { o.y = 0; o.vy = -o.vy; hit = true; } if (o.y + o.h > rows && o.vy > 0) { o.y = rows - o.h; o.vy = -o.vy; hit = true; }
      if (hit) o.hue = (o.hue + 47) % 360;
      o.acc = (o.acc || 0) + dt;
      if (o.acc >= 0.05) { o.acc = 0; o.tr.unshift({ x: o.x, y: o.y }); if (o.tr.length > 6) o.tr.pop(); }
    }
    for (let i = 0; i < s.w.length; i++) for (let j = i + 1; j < s.w.length; j++) {
      const a = s.w[i], b = s.w[j], ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox <= 0 || oy <= 0) continue;
      if (ox / f.aspect < oy) { const s1 = a.x < b.x ? -1 : 1; a.x += s1 * ox / 2; b.x -= s1 * ox / 2; if ((b.vx - a.vx) * s1 > 0) { const t = a.vx; a.vx = b.vx; b.vx = t; } }
      else { const s1 = a.y < b.y ? -1 : 1; a.y += s1 * oy / 2; b.y -= s1 * oy / 2; if ((b.vy - a.vy) * s1 > 0) { const t = a.vy; a.vy = b.vy; b.vy = t; } }
      a.hue = (a.hue + 30) % 360; b.hue = (b.hue + 30) % 360;
    }
    for (const o of s.w) if (o.tr.length > 4) drawBig(g, o.txt, o.tr[4].x, o.tr[4].y, o.sx, o.sy, H(o.hue, 0.1), F5, '░');
    for (const o of s.w) drawBig(g, o.txt, o.x, o.y, o.sx, o.sy, (u, v) => H(o.hue + v * 40, 0.85 - v * 0.25));
  },
};
A({ id: 'ga-physics', name: '物理玩具', cat: '遊戲', theme: 'ice', hue: true, desc: '一群彈性球在重力下互相碰撞',
  params: { toy: 'balls' },
  variants: [
    { id: 'pool', name: '撞球開局', theme: 'forest', desc: '開球後一桿一桿把球打進袋', params: { toy: 'pool' } },
    { id: 'cradle', name: '牛頓擺', theme: 'mono', hue: false, desc: '金屬球左右傳遞的牛頓擺', params: { toy: 'cradle' } },
    { id: 'galton', name: '高爾頓板', theme: 'amber', desc: '落下的珠子堆出鐘形曲線', params: { toy: 'galton' } },
    { id: 'wave', name: '擺動波', theme: 'synth', desc: '長短不一的擺排出波浪', params: { toy: 'wave' } },
    { id: 'domino', name: '骨牌倒下', theme: 'sunset', desc: '一排排骨牌連鎖倒下再倒帶', params: { toy: 'domino' } },
    { id: 'words', name: '彈跳文字', theme: 'cyber', desc: '大字在螢幕裡四處彈跳', params: { toy: 'words' } },
  ],
  init(s, f) { s.P = PH[f.p.toy]; s.P.init.call(s.P, s, f); },
  frame(s, f) { s.P.frame.call(s.P, s, f); } });

/* ════════════ 11. 指針時鐘 ════════════ */
// 時區：回傳某城市此刻相對 UTC 的小時差（含夏令時間）
function nthSunday(y, m, n) { const d = new Date(Date.UTC(y, m, 1)); const first = (7 - d.getUTCDay()) % 7 + 1; return first + (n - 1) * 7; }
function lastSunday(y, m) { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); }
function tzOffset(zone, now) {
  const y = now.getUTCFullYear(), t = now.getTime();
  if (zone === 'eu' || zone === 'cet') { const a = Date.UTC(y, 2, lastSunday(y, 2), 1), b = Date.UTC(y, 9, lastSunday(y, 9), 1); return (zone === 'eu' ? 0 : 1) + (t >= a && t < b ? 1 : 0); }
  if (zone === 'us' || zone === 'usw') { const base = zone === 'us' ? -5 : -8, a = Date.UTC(y, 2, nthSunday(y, 2, 2), 2 - base), b = Date.UTC(y, 10, nthSunday(y, 10, 1), 1 - base); return base + (t >= a && t < b ? 1 : 0); }
  if (zone === 'au') { const a = Date.UTC(y, 3, nthSunday(y, 3, 1), 3 - 11), b = Date.UTC(y, 9, nthSunday(y, 9, 1), 2 - 10); return 10 + (t < a || t >= b ? 1 : 0); }
  return zone;
}
function cityTime(zone, now) { const off = tzOffset(zone, now), d = new Date(now.getTime() + off * 3600000); return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), ms: d.getUTCMilliseconds(), off, day: d.getUTCDay(), date: d.getUTCDate(), mon: d.getUTCMonth() }; }
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
// 由中心 (cx, cyv)（視覺單位）往角度 a（12 點鐘為 0、順時針）畫一支寬 w 的指針
function dHand(g, f, cx, cyv, a, len, back, w, ch, col) {
  const A = f.aspect, sx = Math.sin(a), sy = -Math.cos(a);
  if (w < 0.6) {
    const c = ch || segCh(sx, sy);
    for (let d = -back; d <= len; d += 0.35) g.set(cx + sx * d, (cyv + sy * d) / A, c, col);
    return;
  }
  for (let d = -back; d <= len; d += 0.35) {
    const ww = w * (d > len * 0.8 ? Math.max(0.35, (len - d) / (len * 0.2)) : 1);
    for (let o = -ww; o <= ww; o += 0.45) g.set(cx + sx * d - sy * o, (cyv + sy * d + sx * o) / A, ch || '█', col);
  }
}
function dRing(g, f, cx, cyv, r0, r1, a0, a1, chFn) {
  const A = f.aspect;
  const y0 = Math.max(0, Math.floor((cyv - r1) / A)), y1 = Math.min(g.rows - 1, Math.ceil((cyv + r1) / A));
  for (let y = y0; y <= y1; y++) for (let x = Math.max(0, Math.floor(cx - r1)); x <= Math.min(g.cols - 1, cx + r1); x++) {
    const dx = x + 0.5 - cx, dy = (y + 0.5) * A - cyv, d = Math.hypot(dx, dy);
    if (d < r0 || d > r1) continue;
    let a = Math.atan2(dx, -dy); if (a < 0) a += TAU;
    if (a < a0 || a > a1) continue;
    const r = chFn(a, (d - r0) / Math.max(0.01, r1 - r0), x, y); if (r) { const i = y * g.cols + x; g.ch[i] = r[0]; g.co[i] = r[1]; }
  }
}
function dFace(g, f, cx, cyv, R, opt) {
  const { C, H } = f, A = f.aspect, st = opt.style;
  // 外框
  dRing(g, f, cx, cyv, R * 0.965, R, 0, TAU, (a, k) => ['█', C(0.45 + 0.35 * Math.max(0, Math.cos(a - 5.5)))]);
  if (st === 'roman') dRing(g, f, cx, cyv, R * 0.9, R * 0.915, 0, TAU, () => ['·', C(0.4)]);
  // 刻度
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * TAU, hr = k % 5 === 0, sx = Math.sin(a), sy = -Math.cos(a);
    if (st === 'minimal' && !hr) continue;
    const r0 = R * (hr ? (st === 'minimal' ? 0.74 : 0.84) : 0.9), r1 = R * 0.94, w = hr ? Math.max(0.6, R * (st === 'minimal' ? 0.03 : 0.018)) : 0;
    if (hr) dHand(g, f, cx + sx * r0, cyv + sy * r0, a, r1 - r0, 0, w, '█', C(st === 'minimal' ? 0.85 : 0.75));
    else g.set(cx + sx * R * 0.92, (cyv + sy * R * 0.92) / A, st === 'roman' ? '|' : '·', C(0.45));
  }
  // 數字
  if (st === 'classic' || st === 'roman') for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU, rr = R * (st === 'roman' ? 0.7 : 0.72), x = cx + Math.sin(a) * rr, y = (cyv - Math.cos(a) * rr) / A;
    const lab = st === 'roman' ? ROMAN[k] : String(k || 12);
    if (R > 55) {
      const font = st === 'roman' ? F5 : F3, sy = st === 'roman' ? 1 : Math.max(1, Math.round(R / 70)), sx = st === 'roman' ? 1 : Math.round(sy * A);
      const w = fontW(lab, font) * sx, h = font['0'].length * sy;
      drawBig(g, lab, x - w / 2, y - h / 2, sx, sy, C(0.85), font);
    } else txt(g, x - lab.length / 2, y, lab, C(0.85));
  }
}
const DIAL_CITIES = [['台北', 8, 'Taipei'], ['東京', 9, 'Tokyo'], ['倫敦', 'eu', 'London'], ['紐約', 'us', 'New York'], ['雪梨', 'au', 'Sydney'], ['洛杉磯', 'usw', 'Los Angeles']];
A({ id: 'ga-dial', name: '指針時鐘', cat: '實用', theme: 'gold', desc: '即時走動的指針時鐘與秒針',
  params: { style: 'classic' },
  variants: [
    { id: 'minimal', name: '極簡', theme: 'paper', desc: '只有粗刻度的簡約鐘面', params: { style: 'minimal' } },
    { id: 'world', name: '世界時鐘', theme: 'ice', hue: true, desc: '台北東京倫敦紐約同時看', params: { style: 'world' } },
    { id: 'chrono', name: '計時碼錶', theme: 'mono', desc: '三個小錶盤的計時碼錶', params: { style: 'chrono' } },
    { id: 'gears', name: '齒輪機芯', theme: 'sunset', hue: true, desc: '看得到齒輪轉動的鏤空錶', params: { style: 'gears' } },
    { id: 'day24', name: '二十四小時', theme: 'ocean', hue: true, desc: '一天轉一圈、日月交替', params: { style: 'day24' } },
    { id: 'rings', name: '光環時鐘', theme: 'neon', hue: true, desc: '時分秒化成三道光環', params: { style: 'rings' } },
  ],
  init(s, f) { s.dust = mkDust((f.cols * f.rows) / 70, f.cols, f.rows); s.t0 = f.t; s.gearSeed = rnd(0, 10); },
  frame(s, f) {
    const { g, cols, rows, C, H, t, p } = f, A = f.aspect, st = p.style, now = new Date();
    drawDust(g, s.dust, t, C, st === 'minimal' ? 0.12 : 0.15);
    const hh = now.getHours(), mm = now.getMinutes(), ss = now.getSeconds() + now.getMilliseconds() / 1000;
    const R = Math.min(cols / 2, (rows * A) / 2) * 0.93, cx = cols / 2, cyv = (rows * A) / 2;
    const aH = ((hh % 12) + mm / 60 + ss / 3600) / 12 * TAU, aM = (mm + ss / 60) / 60 * TAU, aS = (ss / 60) * TAU;
    if (st === 'world') {
      const two = rows >= 50, n = two ? 6 : 4, per = two ? 3 : 4, nr = two ? 2 : 1, cities = DIAL_CITIES.slice(0, n), slot = cols / per;
      // 每個鐘一格：城市名（2 列）＋鐘面＋下方數字與時區（大數字 8 列 / 小字 3 列）
      const bigDig = rows >= 24, head = 2, foot = bigDig ? 8 : 3;
      const rr = Math.max(4, Math.min(slot / 2 - 3, (((rows - 1) / nr - head - foot - 2) * A) / 2));
      const blockR = head + Math.ceil((2 * rr) / A) + 1 + foot, t0 = Math.max(0, Math.floor((rows - nr * blockR) / 2));
      cities.forEach(([nameZh, zone, nameEn], k) => {
        const name = tr(f, nameZh, nameEn);
        const c = cityTime(zone, now), x = slot * ((k % per) + 0.5), yv = (t0 + Math.floor(k / per) * blockR + head) * A + rr, day = c.h >= 6 && c.h < 18;
        const hue = day ? 45 : 230;
        dRing(g, f, x, yv, rr * 0.93, rr, 0, TAU, () => ['█', H(hue, day ? 0.6 : 0.35)]);
        dRing(g, f, x, yv, 0, rr * 0.93, 0, TAU, (a, kk, xx, yy) => ((xx + yy) % 3 === 0 ? ['·', H(hue, day ? 0.25 : 0.12)] : null));
        for (let q = 0; q < 12; q++) { const a = (q / 12) * TAU; g.set(x + Math.sin(a) * rr * 0.82, (yv - Math.cos(a) * rr * 0.82) / A, q % 3 ? '·' : '■', H(hue, 0.8)); }
        const cs = c.s + c.ms / 1000;
        dHand(g, f, x, yv, ((c.h % 12) + c.m / 60) / 12 * TAU, rr * 0.5, 0, rr > 20 ? 0.9 : 0, null, H(hue, 0.95));
        dHand(g, f, x, yv, (c.m + cs / 60) / 60 * TAU, rr * 0.75, 0, rr > 20 ? 0.5 : 0, null, H(hue, 0.85));
        dHand(g, f, x, yv, (cs / 60) * TAU, rr * 0.82, rr * 0.15, 0, null, H(0, 0.8));
        g.set(x, yv / A, '●', C(1));
        const top = Math.floor((yv - rr) / A) - 2, bot = Math.ceil((yv + rr) / A) + 1;
        ctextAt(g, x, Math.max(0, top), name, C(0.95));
        const dig = pad2(c.h) + ':' + pad2(c.m), off = 'UTC' + (c.off >= 0 ? '+' : '') + c.off;
        if (bigDig) { const sy = 1, sx = slot >= 44 ? 2 : 1, w = fontW(dig, F3) * sx; drawBig(g, dig, x - w / 2, bot, sx, sy, H(hue, 0.9), F3); ctextAt(g, x, bot + 6, off + (day ? tr(f, '　白天', '  Day') : tr(f, '　夜晚', '  Night')), C(0.5)); }
        else { ctextAt(g, x, bot, dig, H(hue, 0.95)); ctextAt(g, x, bot + 1, off, C(0.5)); }
      });
      return;
    }
    if (st === 'rings') {
      const tracks = [[R * 0.82, R * 0.98, (hh % 12 + mm / 60) / 12, 330], [R * 0.62, R * 0.78, (mm + ss / 60) / 60, 120], [R * 0.42, R * 0.58, ss / 60, 190]];
      for (const [r0, r1, frac, hue] of tracks) dRing(g, f, cx, cyv, r0, r1, 0, TAU, (a, k) => {
        const on = a / TAU <= frac, head = Math.abs(a / TAU - frac) < 0.012;
        if (on) return [head ? '█' : k < 0.15 || k > 0.85 ? '▓' : '█', H(hue + (a / TAU) * 40, head ? 1 : 0.45 + 0.35 * (a / TAU) / Math.max(0.01, frac))];
        const sheen = 0.5 + 0.5 * Math.cos(a * 3 - t * 1.5);
        return ['░', H(hue, 0.1 + 0.08 * sheen)];
      });
      const str = pad2(hh) + ':' + pad2(mm), fit = bigFit(str, R * 0.62, R * 0.32 / A, A);
      drawBig(g, str, cx - fit.w / 2, cyv / A - fit.h / 2, fit.sx, fit.sy, (u, v) => H(200 - v * 60, 0.9));
      const sl = pad2(Math.floor(ss)) + tr(f, ' 秒', ' sec');
      hudText(g, Math.floor(cx - g.textW(sl) / 2), Math.round(cyv / A + fit.h / 2 + 1), sl, C(0.6), C(0));
      return;
    }
    if (st === 'gears') {
      const gears = [[0, 0, 0.42, 24, 1], [0.62, -0.3, 0.22, 13, -1], [-0.6, 0.25, 0.25, 14, -1], [0.3, 0.58, 0.18, 10, -1], [-0.35, -0.6, 0.16, 9, -1]];
      for (const [ox, oy, gr, teeth, dir] of gears) {
        const gx = cx + ox * R, gy = cyv + oy * R, rad = gr * R, sp = (dir * 0.25) / gr;
        dRing(g, f, gx, gy, rad * 0.25, rad * 1.12, 0, TAU, (a, k, xx, yy) => {
          const d = Math.hypot(xx + 0.5 - gx, (yy + 0.5) * A - gy), ph = a - t * sp;
          const tooth = Math.cos(ph * teeth) > 0.1, outer = rad * (tooth ? 1.12 : 0.98);
          if (d > outer) return null;
          if (d > rad * 0.85) return ['█', H(35, 0.45 + 0.15 * Math.cos(a - 5.5))];
          const spoke = Math.abs(Math.sin((ph * 5) / 2)) < 0.12 || d < rad * 0.35;
          return spoke ? ['▓', H(35, 0.35)] : null;
        });
        g.set(gx, gy / A, '●', H(20, 0.8));
      }
      dRing(g, f, cx, cyv, R * 0.96, R, 0, TAU, (a) => ['█', H(40, 0.55 + 0.3 * Math.max(0, Math.cos(a - 5.5)))]);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; dHand(g, f, cx + Math.sin(a) * R * 0.86, cyv - Math.cos(a) * R * 0.86, a, R * 0.08, 0, Math.max(0.6, R * 0.015), '█', H(45, 0.85)); }
    } else if (st === 'day24') {
      const a24 = ((hh + mm / 60 + ss / 3600) / 24) * TAU + Math.PI;
      dRing(g, f, cx, cyv, 0, R * 0.96, 0, TAU, (a, k, xx, yy) => {
        const hourAt = ((a - Math.PI + TAU) % TAU) / TAU * 24, day = hourAt >= 6 && hourAt < 18;
        const d = Math.hypot(xx + 0.5 - cx, (yy + 0.5) * A - cyv) / R;
        if (day) return [d > 0.85 ? '▓' : '░', H(45 + (1 - d) * 150, 0.18 + 0.15 * (1 - Math.abs(hourAt - 12) / 6))];
        return hash(xx, yy) < 0.04 ? [hash(xx + 1, yy) < 0.5 ? '.' : '+', C(0.3 + 0.3 * Math.sin(t * 2 + xx))] : [' ', C(0)];
      });
      dRing(g, f, cx, cyv, R * 0.96, R, 0, TAU, (a) => ['█', C(0.5)]);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * TAU + Math.PI, rr = R * 0.84, x = cx + Math.sin(a) * rr, y = (cyv - Math.cos(a) * rr) / A, lab = pad2(k);
        if (R > 55 && k % 3 === 0) drawBig(g, lab, x - 7, y - 2, 2, 1, C(0.85), F3); else txt(g, x - 1, y, lab, C(k % 6 === 0 ? 0.85 : 0.45));
      }
      dHand(g, f, cx, cyv, a24, R * 0.62, 0, Math.max(0.6, R * 0.025), null, C(0.9));
      const sxp = cx + Math.sin(a24) * R * 0.68, syp = cyv - Math.cos(a24) * R * 0.68, sun = hh >= 6 && hh < 18;
      dRing(g, f, sxp, syp, 0, Math.max(1.2, R * 0.08), 0, TAU, (a, k) => [k > 0.8 ? '▓' : '█', sun ? H(45, 0.9) : C(0.85)]);
      dHand(g, f, cx, cyv, aM, R * 0.5, 0, Math.max(0.5, R * 0.012), null, C(0.7));
      g.set(cx, cyv / A, '●', C(1));
      ctextAt(g, cx, Math.round((cyv + R * 0.35) / A), pad2(hh) + ':' + pad2(mm) + (hh < 6 ? tr(f, '　凌晨', '  Pre-dawn') : sun ? tr(f, '　白天', '  Day') : tr(f, '　夜晚', '  Night')), C(0.8));
      return;
    } else {
      dFace(g, f, cx, cyv, R, { style: st === 'chrono' ? 'classic' : st });
      // 鐘面的光澤
      if (st !== 'minimal') dRing(g, f, cx, cyv, R * 0.25, R * 0.62, 0, TAU, (a, k, xx, yy) => { const v = Math.cos(a - t * 0.4) * (1 - Math.abs(k - 0.5) * 2); return v > 0.75 && (xx + yy) % 2 ? ['·', C(0.12 + (v - 0.75) * 0.6)] : null; });
    }
    if (st === 'chrono') {
      const el = t - s.t0, subs = [[-0.42, 0, (ss % 60) / 60, '秒', 'SEC'], [0.42, 0, ((el / 60) % 30) / 30, '分', 'MIN'], [0, 0.42, ((el / 3600) % 12) / 12, '時', 'HR']];
      for (const [ox, oy, frac, labZh, labEn] of subs) {
        const x = cx + ox * R, yv = cyv + oy * R, rr = R * 0.2;
        dRing(g, f, x, yv, rr * 0.9, rr, 0, TAU, () => ['█', C(0.4)]);
        for (let q = 0; q < 12; q++) { const a = (q / 12) * TAU; g.set(x + Math.sin(a) * rr * 0.78, (yv - Math.cos(a) * rr * 0.78) / A, '·', C(0.6)); }
        dHand(g, f, x, yv, frac * TAU, rr * 0.75, 0, 0, null, C(1));
        if (R > 40) { if (f.lang === 'en') txt(g, x - labEn.length / 2, (yv + rr * 0.45) / A, labEn, C(0.5)); else txt(g, x - 1, (yv + rr * 0.45) / A, labZh, C(0.5)); }
      }
      if (R > 40) { const tl = 'TACHYMETRE'; for (let k = 0; k < tl.length; k++) { const a = -0.5 + k * 0.1; g.set(cx + Math.sin(a) * R * 0.88, (cyv - Math.cos(a) * R * 0.88) / A, tl[k], C(0.4)); } }
    }
    // 指針
    const hw = Math.max(0.6, R * (st === 'minimal' ? 0.02 : 0.03));
    if (st === 'roman') {
      dHand(g, f, cx, cyv, aH, R * 0.5, R * 0.1, 0, null, C(0.95));
      dHand(g, f, cx, cyv, aM, R * 0.75, R * 0.12, 0, null, C(0.95));
      for (const [a, l] of [[aH, R * 0.42], [aM, R * 0.66]]) dRing(g, f, cx + Math.sin(a) * l, cyv - Math.cos(a) * l, Math.max(0.6, R * 0.03), Math.max(1.2, R * 0.05), 0, TAU, () => ['█', C(0.95)]);
    } else {
      dHand(g, f, cx, cyv, aH, R * 0.5, R * 0.08, hw * 1.2, '█', st === 'gears' ? H(30, 0.9) : C(0.95));
      dHand(g, f, cx, cyv, aM, R * 0.78, R * 0.1, hw * 0.75, st === 'minimal' ? '█' : '▓', st === 'gears' ? H(40, 0.95) : C(0.9));
    }
    const sc = st === 'minimal' ? C(1) : H(0, 0.85);
    if (st === 'minimal') { const x = cx + Math.sin(aS) * R * 0.66, yv = cyv - Math.cos(aS) * R * 0.66; dRing(g, f, x, yv, 0, Math.max(1, R * 0.035), 0, TAU, () => ['█', C(1)]); }
    else { dHand(g, f, cx, cyv, st === 'chrono' ? (((t - s.t0) % 60) / 60) * TAU : aS, R * 0.86, R * 0.2, 0, null, st === 'chrono' || st === 'gears' ? H(10, 0.9) : sc); dRing(g, f, cx, cyv, 0, Math.max(1, R * 0.03), 0, TAU, () => ['█', st === 'gears' ? H(10, 0.9) : sc]); }
    if (st === 'classic' && R > 40) ctextAt(g, cx, Math.round((cyv + R * 0.3) / A), f.lang === 'en' ? opq(`${EN_DAY[now.getDay()]}, ${EN_MON[now.getMonth()]} ${now.getDate()}`) : `${now.getMonth() + 1} 月 ${now.getDate()} 日　星期${'日一二三四五六'[now.getDay()]}`, C(0.6));
  } });

/* ════════════ 12. 數字時鐘 ════════════ */
const DG = {};
const nowParts = () => { const d = new Date(); return { d, h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), ms: d.getMilliseconds() }; };
// 實心圓（視覺單位）
function disc(g, f, cx, cyv, r, ch, col) { dRing(g, f, cx, cyv, 0, r, 0, TAU, () => [ch, col]); }
// ── 二進位時鐘 ──
DG.binary = {
  frame(s, f) {
    const { g, cols, rows, C, H, t } = f, A = f.aspect, T = nowParts(), digs = [(T.h / 10) | 0, T.h % 10, (T.m / 10) | 0, T.m % 10, (T.s / 10) | 0, T.s % 10], bits = [2, 4, 3, 4, 3, 4];
    const colW = cols / 8.2, gapX = colW * 0.25, cell = Math.min(colW * 0.9, (rows * A * 0.7) / 4), r = cell * 0.36;
    const x0 = cols / 2 - (colW * 6 + gapX * 2) / 2 + colW / 2, yb = rows * A * 0.8;
    for (let k = 0; k < 6; k++) {
      const x = x0 + k * colW + Math.floor(k / 2) * gapX, hue = [200, 200, 140, 140, 320, 320][k];
      for (let b = 0; b < 4; b++) {
        const yv = yb - b * cell * 1.0 - cell * 0.5;
        if (b >= bits[k]) continue;
        const on = (digs[k] >> b) & 1;
        if (on) { const glow = 0.5 + 0.5 * Math.sin(t * 2 + k + b); dRing(g, f, x, yv, r * 1.05, r * 1.3, 0, TAU, () => ['░', H(hue, 0.2 + 0.15 * glow)]); disc(g, f, x, yv, r, '█', H(hue, 0.85)); }
        else dRing(g, f, x, yv, r * 0.8, r, 0, TAU, () => ['█', C(0.18)]);
      }
      const lab = String(digs[k]);
      if (rows > 40) drawBig(g, lab, x - 3, yb / A + 1, 2, 1, H(hue, 0.7), F3); else txt(g, x, Math.min(rows - 1, yb / A + 1), lab, H(hue, 0.8));
    }
    for (let b = 0; b < 4; b++) txt(g, Math.max(0, x0 - colW * 0.9), (yb - b * cell - cell * 0.5) / A, String(1 << b), C(0.4));
    ctext(g, 1, tr(f, '二進位時鐘　每一欄是一個數字（8・4・2・1）', 'Binary clock  Each column is one digit (8·4·2·1)'), C(0.45));
  },
};
// ── 中文字格時鐘 ──
const WC_LINES = [['現在', '是'], ['凌晨', '早上', '中午', '下午', '晚上'], ['一', '二', '三', '四', '五', '六'], ['七', '八', '九', '十', '十一', '十二', '點'], ['零', '二十', '三十', '四十', '五十'], ['十', '一', '二', '三', '四', '五'], ['六', '七', '八', '九', '分', '整']];
const WC_FILL = '天地日月山水風雲雨雪花草木林石光影心手口目耳言書文字時年春夏秋冬東西南北中上下左右大小多少長短高低遠近明暗來去開關生活夢想人家路門窗燈茶';
// 英文介面用的字母版（IT IS TEN FORTY TWO IN THE EVENING）：字母一格寬，所以格距較小
const WC_EN_LINES = [['IT', 'IS'], ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'], ['SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE'], ["O'CLOCK", 'OH', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY'],
  ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN'], ['FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'], ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'],
  ['IN', 'THE', 'MORNING', 'AFTERNOON', 'EVENING', 'AT', 'NIGHT']];
const WC_EN_FILL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const WC_EN_NUM = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
DG.word = {
  init(s, f) {
    if (f.lang === 'en') return this.initEn(s, f);
    s.en = false;
    const { cols, rows } = f;
    s.lx = rows >= 50 ? 5 : 4; s.ly = rows >= 50 ? 2 : 1;
    s.nx = Math.floor(cols / s.lx); s.ny = Math.floor((rows - (rows >= 50 ? 2 : 1)) / s.ly);
    s.fill = Array.from({ length: s.nx * s.ny }, () => WC_FILL[(Math.random() * WC_FILL.length) | 0]);
    s.tok = []; s.slot = new Int16Array(s.nx * s.ny).fill(-1);
    const L = WC_LINES.length;
    WC_LINES.forEach((line, li) => {
      const y = Math.round(((li + 0.6) * s.ny) / (L + 0.2)), total = line.reduce((a, w) => a + w.length, 0), gap = (s.nx - total) / (line.length + 1);
      let x = gap;
      line.forEach((w, wi) => { const tk = { line: li, idx: wi, word: w, x: Math.round(x), y }; for (let k = 0; k < w.length; k++) { const p = y * s.nx + tk.x + k; s.fill[p] = w[k]; s.slot[p] = s.tok.length; } s.tok.push(tk); x += w.length + gap; });
    });
  },
  lit(T) {
    const on = new Set(), find = (line, w) => { const k = WC_LINES[line].indexOf(w); return line * 100 + k; };
    on.add(find(0, '現在')); on.add(find(0, '是'));
    const h = T.h, per = h < 6 ? '凌晨' : h < 12 ? '早上' : h === 12 ? '中午' : h < 18 ? '下午' : '晚上';
    on.add(find(1, per));
    const h12 = h % 12 || 12, HW = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][h12];
    on.add(h12 <= 6 ? find(2, HW) : find(3, HW)); on.add(find(3, '點'));
    const m = T.m, U = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'], unit = w => (['一', '二', '三', '四', '五'].includes(w) ? find(5, w) : find(6, w));
    if (m === 0) on.add(find(6, '整'));
    else {
      if (m < 10) { on.add(find(4, '零')); on.add(unit(U[m])); }
      else if (m < 20) { on.add(find(5, '十')); if (m % 10) on.add(unit(U[m % 10])); }
      else { on.add(find(4, ['', '', '二十', '三十', '四十', '五十'][(m / 10) | 0])); if (m % 10) on.add(unit(U[m % 10])); }
      on.add(find(6, '分'));
    }
    return on;
  },
  initEn(s, f) {
    const { cols, rows } = f;
    s.en = true;
    s.lx = rows >= 50 ? 3 : 2; s.ly = rows >= 50 ? 2 : 1;
    s.nx = Math.floor(cols / s.lx);
    if (s.nx < 46) { s.lx = 1; s.nx = cols; }
    s.ny = Math.floor((rows - (rows >= 50 ? 2 : 1)) / s.ly);
    s.fill = Array.from({ length: s.nx * s.ny }, () => WC_EN_FILL[(Math.random() * WC_EN_FILL.length) | 0]);
    s.tok = []; s.slot = new Int16Array(s.nx * s.ny).fill(-1);
    const L = WC_EN_LINES.length;
    WC_EN_LINES.forEach((line, li) => {
      const y = Math.round(((li + 0.6) * s.ny) / (L + 0.2)), total = line.reduce((a, w) => a + w.length, 0), gap = Math.max(1, (s.nx - total) / (line.length + 1));
      let x = gap;
      line.forEach((w, wi) => { const tk = { line: li, idx: wi, word: w, x: Math.round(x), y }; for (let k = 0; k < w.length; k++) { const p = y * s.nx + tk.x + k; if (tk.x + k < s.nx) { s.fill[p] = w[k]; s.slot[p] = s.tok.length; } } s.tok.push(tk); x += w.length + gap; });
    });
  },
  litEn(T) {
    const on = new Set(), find = (line, w) => line * 100 + WC_EN_LINES[line].indexOf(w);
    on.add(find(0, 'IT')); on.add(find(0, 'IS'));
    const h = T.h, h12 = h % 12 || 12, m = T.m;
    on.add(h12 <= 6 ? find(1, WC_EN_NUM[h12]) : find(2, WC_EN_NUM[h12]));
    if (m === 0) on.add(find(3, "O'CLOCK"));
    else if (m < 10) { on.add(find(3, 'OH')); on.add(find(6, WC_EN_NUM[m])); }
    else if (m < 15) on.add(find(4, WC_EN_NUM[m]));
    else if (m < 20) on.add(find(5, WC_EN_NUM[m]));
    else { on.add(find(3, ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY'][(m / 10) | 0])); if (m % 10) on.add(find(6, WC_EN_NUM[m % 10])); }
    if (h < 6) { on.add(find(7, 'AT')); on.add(find(7, 'NIGHT')); }
    else { on.add(find(7, 'IN')); on.add(find(7, 'THE')); on.add(find(7, h < 12 ? 'MORNING' : h < 18 ? 'AFTERNOON' : 'EVENING')); }
    return on;
  },
  frameEn(s, f) {
    const { g, rows, C, H, t } = f, T = nowParts(), on = this.litEn(T), words = [];
    for (let y = 0; y < s.ny; y++) for (let x = 0; x < s.nx; x++) {
      const p = y * s.nx + x, ti = s.slot[p], tk = ti >= 0 ? s.tok[ti] : null, lit = tk && on.has(tk.line * 100 + tk.idx);
      const X = x * s.lx, Y = y * s.ly + (rows >= 50 ? 1 : 0);
      if (lit) {
        const hue = 40 + tk.line * 25, gl = 0.75 + 0.25 * Math.sin(t * 2 + tk.line), bg = H(hue, 0.22), last = x === tk.x + tk.word.length - 1;
        g.set(X, Y, s.fill[p], H(hue, gl));
        if (s.lx > 1) { g.set(X - 1, Y, x === tk.x ? '▐' : '█', bg); for (let k = 1; k < s.lx; k++) g.set(X + k, Y, last ? (k === 1 ? '▌' : ' ') : '█', bg); }
        if (s.ly > 1) g.set(X, Y + 1, '▀', H(hue, 0.35));
      } else { const w = 0.5 + 0.5 * Math.sin(t * 0.7 + x * 0.21 + y * 0.37); g.set(X, Y, s.fill[p], tk ? C(0.2 + 0.05 * w) : C(0.07 + 0.06 * w)); }
    }
    if (Math.random() < f.dt * 3) { const p = (Math.random() * s.fill.length) | 0; if (s.slot[p] < 0) s.fill[p] = WC_EN_FILL[(Math.random() * WC_EN_FILL.length) | 0]; }
    for (const tk of s.tok) if (on.has(tk.line * 100 + tk.idx)) words.push(tk.word);
    ctext(g, rows - 1, words.join(NB), C(0.6));
  },
  frame(s, f) {
    // 語言在執行中切換時，重新排一次字格
    if (!!s.en !== (f.lang === 'en')) this.init(s, f);
    if (s.en) return this.frameEn(s, f);
    const { g, cols, rows, C, H, t } = f, T = nowParts(), on = this.lit(T);
    const words = [];
    for (let y = 0; y < s.ny; y++) for (let x = 0; x < s.nx; x++) {
      const p = y * s.nx + x, ti = s.slot[p], tk = ti >= 0 ? s.tok[ti] : null, lit = tk && on.has(tk.line * 100 + tk.idx);
      const X = x * s.lx, Y = y * s.ly + (rows >= 50 ? 1 : 0);
      if (lit) { const hue = 40 + tk.line * 25, gl = 0.75 + 0.25 * Math.sin(t * 2 + tk.line); g.set(X, Y, s.fill[p], H(hue, gl)); g.set(X - 1, Y, x === tk.x ? '▐' : '█', H(hue, 0.22)); g.set(X + 2, Y, x === tk.x + tk.word.length - 1 ? '▌' : '█', H(hue, 0.22)); if (s.lx > 4) g.set(X + 3, Y, x === tk.x + tk.word.length - 1 ? ' ' : '█', H(hue, 0.22)); if (s.ly > 1) g.set(X, Y + 1, '▀', H(hue, 0.35)); }
      else { const w = 0.5 + 0.5 * Math.sin(t * 0.7 + x * 0.21 + y * 0.37); g.set(X, Y, s.fill[p], tk ? C(0.2 + 0.05 * w) : C(0.07 + 0.06 * w)); }
    }
    if (Math.random() < f.dt * 3) { const p = (Math.random() * s.fill.length) | 0; if (s.slot[p] < 0) s.fill[p] = WC_FILL[(Math.random() * WC_FILL.length) | 0]; }
    for (const tk of s.tok) if (on.has(tk.line * 100 + tk.idx)) words.push(tk.word);
    ctext(g, rows - 1, words.join(''), C(0.6));
  },
};
// ── 翻頁鐘 ──
DG.flip = {
  init(s, f) { s.cards = {}; },
  frame(s, f) {
    const { g, cols, rows, C, H, dt } = f, A = f.aspect, T = nowParts(), str = pad2(T.h) + pad2(T.m) + pad2(T.s);
    const big = Math.min((cols * 0.85) / (4 * 1.12 + 2 * 0.65 + 0.6), (rows * 0.62 * A) / 1.35);
    const cw = Math.floor(big), chh = Math.floor((big * 1.35) / A) | 1, sw = Math.floor(cw * 0.6), sh = Math.floor((sw * 1.35) / A) | 1;
    const layout = [[0, cw, chh], [1, cw, chh], [2, cw, chh], [3, cw, chh], [4, sw, sh], [5, sw, sh]];
    const gap = Math.max(1, Math.round(cw * 0.12)), totalW = cw * 4 + sw * 2 + gap * 3 + gap * 6;
    let x = Math.round((cols - totalW) / 2);
    const yTop = Math.round((rows - chh) / 2);
    for (const [k, w, h] of layout) {
      const d = str[k], c = s.cards[k] || (s.cards[k] = { cur: d, prev: d, ft: 1 });
      if (c.cur !== d) { c.prev = c.cur; c.cur = d; c.ft = 0; }
      c.ft = Math.min(1, c.ft + dt / 0.45);
      const y = k >= 4 ? yTop + chh - h : yTop, mid = Math.floor(h / 2);
      // 字形點陣
      const gw = Math.min(w * 0.66, h * 0.8 * A * (5 / 7) * 1.1), gh = h * 0.8, sx = gw / 5, sy = gh / 7, ox = (w - gw) / 2, oy = (h - gh) / 2;
      const px = (dig, cx, cy) => { const q = Math.floor((cx + 0.5 - ox) / sx), r = Math.floor((cy + 0.5 - oy) / sy); return q >= 0 && q < 5 && r >= 0 && r < 7 && F5[dig][r][q] === '1'; };
      const ph = c.ft;
      for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
        const corner = (cy === 0 || cy === h - 1) && (cx === 0 || cx === w - 1);
        if (corner) continue;
        let dig = c.cur, srcY = cy, shade = 0;
        if (ph < 1) {
          if (cy < mid) { // 上半：後面是新字，翻片是舊字往下壓
            const flapH = Math.max(0, (1 - ph * 2)) * mid;
            if (cy >= mid - flapH && ph < 0.5) { dig = c.prev; srcY = mid - (mid - cy) * (mid / Math.max(0.01, flapH)); shade = 0.15 * ph; }
          } else {
            const flapH = Math.max(0, ph * 2 - 1) * (h - mid);
            if (cy < mid + flapH) { dig = c.cur; srcY = mid + (cy - mid) * ((h - mid) / Math.max(0.01, flapH)); shade = 0.15 * (1 - ph); }
            else dig = c.prev;
          }
        }
        const on = px(dig, cx, Math.floor(srcY)), seam = cy === mid;
        g.set(x + cx, y + cy, seam ? '─' : on ? '█' : '█', seam ? C(0.05) : on ? C(0.92 - shade) : C(0.16 + (cy < mid ? 0.03 : 0) - shade * 0.5));
      }
      x += w + (k === 1 || k === 3 ? gap * 4 : gap);
      if (k === 1 || k === 3) { const cxx = x - gap * 2.5, dy = Math.round(chh * 0.18); g.set(cxx, yTop + mid - dy, '●', C(0.6)); g.set(cxx, yTop + mid + dy, '●', C(0.6)); }
    }
    ctext(g, Math.min(rows - 1, yTop + chh + 2), f.lang === 'en' ? opq(`${EN_DAY[T.d.getDay()]}, ${EN_MON[T.d.getMonth()]} ${T.d.getDate()}, ${T.d.getFullYear()}`) : `${T.d.getFullYear()} 年 ${T.d.getMonth() + 1} 月 ${T.d.getDate()} 日　星期${'日一二三四五六'[T.d.getDay()]}`, C(0.55));
  },
};
// ── 七段顯示器 ──
const SEG7 = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
function seg7(g, f, d, x, y, w, h, th, on, off) {
  const A = f.aspect, tv = Math.max(1, Math.round(th / A)), m = Math.floor(h / 2), bits = SEG7[d];
  const hb = (yy, b) => { for (let k = 0; k < tv; k++) for (let xx = th; xx < w - th; xx++) g.set(x + xx, yy + k, '█', bits & b ? on : off); };
  const vb = (xx, y0, y1, b) => { for (let yy = y0; yy < y1; yy++) for (let k = 0; k < th; k++) g.set(x + xx + k, yy, '█', bits & b ? on : off); };
  hb(y, 1); hb(y + m - (tv >> 1), 64); hb(y + h - tv, 8);
  vb(w - th, y + tv, y + m, 2); vb(w - th, y + m + 1, y + h - tv, 4); vb(0, y + m + 1, y + h - tv, 16); vb(0, y + tv, y + m, 32);
}
DG.seg = {
  frame(s, f) {
    const { g, cols, rows, C, H, t } = f, A = f.aspect, T = nowParts(), str = pad2(T.h) + pad2(T.m) + pad2(T.s);
    const dw = Math.floor(Math.min(cols / 8.9, (rows * 0.55 * A) / 1.8)), dh = Math.floor((dw * 1.8) / A), th = Math.max(1, Math.round(dw * 0.16)), gap = Math.round(dw * 0.25);
    const total = dw * 6 + gap * 5 + gap * 4;
    let x = Math.round((cols - total) / 2); const y = Math.round((rows - dh) / 2) - 1;
    const on = H(0, 0.75), off = C(0.07), blink = T.ms < 500;
    for (let k = 0; k < 6; k++) {
      seg7(g, f, +str[k], x, y, dw, dh, th, on, off);
      x += dw + gap;
      if (k === 1 || k === 3) { const cx = x + gap * 0.5, r = Math.max(1, th * 0.6); for (const fy of [0.3, 0.7]) disc(g, f, cx, (y + dh * fy) * A, r, '█', blink ? on : off); x += gap * 2; }
    }
    // 小字日期
    const ds = pad2(T.d.getMonth() + 1) + '-' + pad2(T.d.getDate()), w2 = Math.max(3, Math.floor(dw * 0.3)), h2 = Math.max(3, Math.floor((w2 * 1.8) / A)) | 1, th2 = Math.max(1, Math.round(w2 * 0.18));
    let x2 = Math.round(cols / 2 - (w2 * 4 + w2 * 0.4 * 3 + w2) / 2); const y2 = Math.min(rows - h2 - 1, y + dh + Math.max(2, Math.round(dh * 0.15)));
    if (w2 < 5 || h2 < 5) ctext(g, Math.min(rows - 2, y + dh + 2), ds, H(0, 0.55));
    else for (const ch of ds) { if (ch === '-') { for (let k = 0; k < w2 * 0.6; k++) g.set(x2 + k, y2 + (h2 >> 1), '█', H(0, 0.5)); x2 += w2; continue; } seg7(g, f, +ch, x2, y2, w2, h2, th2, H(0, 0.55), off); x2 += Math.round(w2 * 1.4); }
    // 掃描光
    const sy = Math.floor((t * 6) % (rows + 10)) - 5;
    for (let xx = 0; xx < cols; xx++) { const i = sy * cols + xx; if (sy >= 0 && sy < rows && g.ch[i] === '█') g.co[i] = H(0, 0.9); }
  },
};
// ── 輝光管 ──
DG.nixie = {
  frame(s, f) {
    const { g, cols, rows, C, H, t } = f, A = f.aspect, T = nowParts(), str = pad2(T.h) + pad2(T.m) + pad2(T.s);
    const tw = Math.floor(Math.min(cols / 8.2, (rows * 0.75 * A) / 1.9)), th = Math.floor((tw * 1.9) / A), gap = Math.round(tw * 0.15);
    const total = tw * 6 + gap * 5 + gap * 3;
    let x = Math.round((cols - total) / 2); const y = Math.round((rows - th) / 2);
    for (let k = 0; k < 6; k++) {
      // 玻璃管
      for (let yy = 0; yy < th; yy++) { g.set(x, y + yy, yy === 0 ? '┌' : yy === th - 1 ? '└' : '│', C(0.2)); g.set(x + tw - 1, y + yy, yy === 0 ? '┐' : yy === th - 1 ? '┘' : '│', C(0.2)); }
      for (let xx = 1; xx < tw - 1; xx++) { g.set(x + xx, y, '─', C(0.2)); g.set(x + xx, y + th - 1, '═', C(0.3)); }
      for (let xx = 2; xx < tw - 2; xx += 2) for (let yy = 2; yy < th - 2; yy += 2) g.set(x + xx, y + yy, '·', C(0.06));
      const sy = Math.max(1, Math.floor((th * 0.75) / 7)), sx = Math.max(1, Math.round(sy * A * 0.9)), ox = x + Math.floor((tw - 5 * sx) / 2), oy = y + Math.floor((th - 7 * sy) / 2);
      const d = str[k], fl = 0.9 + 0.1 * Math.sin(t * 9 + k * 7) * Math.sin(t * 1.7 + k);
      // 其他數字淡淡的疊在後面
      for (let dd = 0; dd < 10; dd++) { if (String(dd) === d) continue; const gl = F5[String(dd)]; for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (gl[r][q] === '1') { const edge = (q === 0 || gl[r][q - 1] === '0') || (r === 0 || gl[r - 1][q] === '0'); if (edge) g.set(ox + q * sx, oy + r * sy, '·', C(0.12)); } }
      const gl = F5[d];
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) {
        if (gl[r][q] !== '1') continue;
        for (let yy = 0; yy < sy; yy++) for (let xx = 0; xx < sx; xx++) {
          const X = ox + q * sx + xx, Y = oy + r * sy + yy, core = sx > 2 && xx > 0 && xx < sx - 1 && yy > 0 && yy < sy - 1;
          g.set(X, Y, core ? '▓' : '█', H(25, (core ? 0.75 : 1) * fl));
        }
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const X = ox + q * sx + (dx < 0 ? -1 : dx > 0 ? sx : 0), Y = oy + r * sy + (dy < 0 ? -1 : dy > 0 ? sy : 0); const i = Y * cols + X; if (Y >= 0 && Y < rows && X >= 0 && X < cols && g.ch[i] !== '█' && g.ch[i] !== '▓') g.set(X, Y, '░', H(20, 0.35 * fl)); }
      }
      x += tw + gap; if (k === 1 || k === 3) { for (const fy of [0.35, 0.65]) g.set(x + gap * 0.5, y + th * fy, '●', H(25, 0.6 * fl)); x += gap * 2; }
    }
    ctext(g, Math.min(rows - 1, y + th + 1), tr(f, '輝光管時鐘', 'Nixie tube clock'), C(0.35));
  },
};
// ── LED 點陣跑馬燈 ──
DG.led = {
  frame(s, f) {
    const { g, cols, rows, C, H, t } = f, T = nowParts(), wk = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][T.d.getDay()];
    const pitchX = 2, top = pad2(T.h) + ':' + pad2(T.m) + ':' + pad2(T.s), msg = '   ' + T.d.getFullYear() + '-' + pad2(T.d.getMonth() + 1) + '-' + pad2(T.d.getDate()) + '  ' + wk + '  HAVE A NICE DAY  ';
    const nx = Math.floor(cols / pitchX), ny = rows;
    const sc1 = Math.max(1, Math.min(Math.floor((ny * 0.5) / 8), Math.floor(nx / fontW(top, F5)))), sc2 = Math.max(1, Math.floor((ny * 0.3) / 8));
    const lit = new Uint8Array(nx * ny);
    const stamp = (str, x0, y0, sc, val) => { let x = x0; for (const c of str) { const gl = F5[c] || F5[' '], w = gl[0].length; for (let r = 0; r < 7; r++) for (let q = 0; q < w; q++) if (gl[r][q] === '1') for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) { const X = x + q * sc + xx, Y = y0 + r * sc + yy; if (X >= 0 && X < nx && Y >= 0 && Y < ny) lit[Y * nx + X] = val; } x += (w + 1) * sc; } };
    const tw = fontW(top, F5) * sc1, y1 = Math.max(1, Math.floor(ny * 0.12));
    stamp(top, Math.floor((nx - tw) / 2), y1, sc1, 1);
    const mw = fontW(msg, F5) * sc2, off = Math.floor((t * 26) % (mw + nx));
    const y2 = Math.min(ny - 7 * sc2 - 1, y1 + 7 * sc1 + Math.max(2, sc1 * 2));
    stamp(msg, nx - off, y2, sc2, 2);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const v = lit[y * nx + x];
      g.set(x * pitchX, y, v ? '●' : '·', v === 1 ? H(35, 0.9) : v === 2 ? H(130, 0.8) : C(0.08 + 0.05 * Math.max(0, Math.sin(x * 0.15 - t * 3))));
    }
  },
};
// ── 算盤時鐘 ──
DG.abacus = {
  init(s) { s.pos = new Float32Array(6 * 5); },
  frame(s, f) {
    const { g, cols, rows, C, H, dt } = f, A = f.aspect, T = nowParts(), digs = [(T.h / 10) | 0, T.h % 10, (T.m / 10) | 0, T.m % 10, (T.s / 10) | 0, T.s % 10];
    const fw = Math.min(cols * 0.9, rows * A * 1.6), x0 = Math.round((cols - fw) / 2), y0 = Math.max(1, Math.round(rows * 0.08)), y1 = rows - 3;
    const beam = Math.round(y0 + (y1 - y0) * 0.3), bw = Math.max(3, Math.round(fw / 9)), bh = Math.max(1, Math.round(bw / A * 0.55));
    // 框
    for (let x = x0; x <= x0 + fw; x++) { g.set(x, y0, '▀', H(25, 0.45)); g.set(x, y1, '▄', H(25, 0.45)); g.set(x, beam, '█', H(25, 0.4)); }
    for (let y = y0; y <= y1; y++) { g.set(x0, y, '█', H(25, 0.45)); g.set(x0 + fw, y, '█', H(25, 0.45)); }
    for (let k = 0; k < 6; k++) {
      const x = x0 + fw * ((k + 0.5 + Math.floor(k / 2) * 0.3) / 6.6) + fw * 0.02, d = digs[k];
      for (let y = y0 + 1; y < y1; y++) if (y !== beam) g.set(x, y, '│', C(0.35));
      // 目標位置：上珠（5）靠樑代表 +5，下珠往上推的個數代表 +1
      const up = d >= 5 ? 1 : 0, lo = d % 5;
      const tgt = [up ? beam - 1 - bh : y0 + 1];
      for (let b = 0; b < 4; b++) tgt.push(b < lo ? beam + 1 + b * bh : y1 - (4 - b) * bh);
      for (let b = 0; b < 5; b++) {
        const i = k * 5 + b; if (!s.pos[i]) s.pos[i] = tgt[b];
        s.pos[i] += (tgt[b] - s.pos[i]) * Math.min(1, dt * 10);
        const by = Math.round(s.pos[i]), hue = b === 0 ? 0 : 30, lit = b === 0 ? up : b - 1 < lo;
        for (let r = 0; r < bh; r++) for (let q = -bw / 2; q < bw / 2; q++) {
          const u = Math.abs(q + 0.5) / (bw / 2), edge = u > 0.75;
          g.set(x + q, by + r, bh > 1 && r === 0 ? (edge ? ' ' : '▄') : bh > 1 && r === bh - 1 ? (edge ? ' ' : '▀') : edge ? '▐' : '█', H(hue, lit ? 0.6 + 0.25 * (1 - u) : 0.25));
        }
      }
      if (rows > 40) txt(g, x - 1, y1 + 1, String(d), C(0.7));
    }
    ctext(g, 0, tr(f, '算盤時鐘　', 'Abacus clock  ') + pad2(T.h) + ':' + pad2(T.m) + ':' + pad2(T.s), C(0.6));
  },
};
// ── 粒子時鐘 ──
DG.swarm = {
  init(s, f) { s.p = []; s.key = ''; s.burst = 0; s.nextBurst = 12; },
  frame(s, f) {
    const { g, cols, rows, C, H, t, dt } = f, A = f.aspect, T = nowParts(), str = pad2(T.h) + ':' + pad2(T.m);
    const fit = bigFit(str, cols * 0.85, rows * 0.6, A), ox = (cols - fit.w) / 2, oy = (rows - fit.h) / 2;
    if (str !== s.key) {
      s.key = str; const tg = [];
      let x = ox;
      for (const c of str) { const gl = F5[c], w = gl[0].length; for (let r = 0; r < 7; r++) for (let q = 0; q < w; q++) if (gl[r][q] === '1') for (let yy = 0; yy < fit.sy; yy++) for (let xx = 0; xx < fit.sx; xx++) tg.push([x + q * fit.sx + xx, oy + r * fit.sy + yy]); x += (w + 1) * fit.sx; }
      while (s.p.length < tg.length) s.p.push({ x: rnd(0, cols), y: rnd(0, rows), vx: 0, vy: 0, tx: 0, ty: 0, ph: rnd(0, TAU) });
      s.p.length = tg.length;
      const order = tg.map((_, i) => i).sort(() => Math.random() - 0.5);
      s.p.forEach((q, i) => { q.tx = tg[order[i]][0]; q.ty = tg[order[i]][1]; });
      s.burst = 0.6;
    }
    s.nextBurst -= dt; if (s.nextBurst <= 0) { s.nextBurst = rnd(14, 22); s.burst = 0.5; }
    const bursting = s.burst > 0; if (bursting) s.burst -= dt;
    for (const q of s.p) {
      if (bursting) { const a = rnd(0, TAU), v = rnd(20, 60); q.vx += Math.cos(a) * v * dt * 4; q.vy += (Math.sin(a) * v * dt * 4) / A; }
      const wx = q.tx + Math.cos(t * 1.3 + q.ph) * 0.35, wy = q.ty + Math.sin(t * 1.7 + q.ph) * 0.2;
      q.vx += (wx - q.x) * dt * 8; q.vy += (wy - q.y) * dt * 8; q.vx *= 1 - dt * 3.5; q.vy *= 1 - dt * 3.5;
      q.x += q.vx * dt; q.y += q.vy * dt;
      const sp = Math.hypot(q.vx, q.vy * A), d = Math.hypot(q.x - q.tx, (q.y - q.ty) * A);
      g.set(q.x, q.y, d < 0.8 ? '█' : sp > 15 ? '*' : '•', H((q.tx / cols) * 200 + 160 + t * 10, d < 0.8 ? 0.8 : 0.55));
    }
    ctext(g, Math.min(rows - 1, Math.round(oy + fit.h + 1)), pad2(T.s) + tr(f, ' 秒', ' sec'), C(0.45));
  },
};
A({ id: 'ga-digits', name: '數字時鐘', cat: '實用', theme: 'cyber', hue: true, desc: '用一顆顆亮點表示的二進位時鐘',
  params: { kind: 'binary' },
  variants: [
    { id: 'word', name: '字格時鐘', theme: 'amber', desc: '滿版文字裡亮起現在的時刻', params: { kind: 'word' } },
    { id: 'flip', name: '翻頁鐘', theme: 'mono', hue: false, desc: '數字卡片啪嗒翻頁的時鐘', params: { kind: 'flip' } },
    { id: 'seg', name: '七段顯示', theme: 'blood', desc: '紅色七段 LED 數字鐘', params: { kind: 'seg' } },
    { id: 'nixie', name: '輝光管', theme: 'fire', desc: '橘色輝光管裡發亮的數字', params: { kind: 'nixie' } },
    { id: 'led', name: '跑馬燈', theme: 'matrix', desc: '點陣看板上捲動的日期', params: { kind: 'led' } },
    { id: 'abacus', name: '算盤時鐘', theme: 'gold', desc: '用算盤珠子撥出時分秒', params: { kind: 'abacus' } },
    { id: 'swarm', name: '粒子時鐘', theme: 'neon', desc: '粒子飛散又聚成時間', params: { kind: 'swarm' } },
  ],
  init(s, f) { s.K = DG[f.p.kind]; s.dust = mkDust((f.cols * f.rows) / 120, f.cols, f.rows); if (s.K.init) s.K.init(s, f); },
  frame(s, f) { if (f.p.kind !== 'word' && f.p.kind !== 'led') drawDust(f.g, s.dust, f.t, f.C, 0.13); s.K.frame.call(s.K, s, f); } });

/* ════════════ 13. 時光日曆 ════════════ */
const TM = {};
const WEEK = '日一二三四五六';
const WEEK_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];   // 兩個字母＝一個全形字寬，排版不變
const calTitle = (f, y, m) => (f.lang === 'en' ? opq(`${EN_MON[m]} ${y}`) : `${y} 年 ${m + 1} 月`);
// ── 月曆 ──
function calMonth(g, f, y, m, x0, y0, w, h, opt) {
  const { C, H, t } = f, A = f.aspect, today = new Date(), first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), start = first.getDay();
  const cw = w / 7, chh = (h - 2) / 6, wk = f.lang === 'en' ? WEEK_EN : WEEK;
  for (let k = 0; k < 7; k++) txt(g, x0 + k * cw + cw / 2 - 1, y0, wk[k], k === 0 ? H(0, 0.75) : k === 6 ? H(210, 0.75) : C(0.6));
  for (let d = 1; d <= days; d++) {
    const idx = start + d - 1, r = Math.floor(idx / 7), c = idx % 7, X = x0 + c * cw, Y = y0 + 2 + r * chh;
    const isToday = y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
    const col = c === 0 ? H(0, 0.7) : c === 6 ? H(210, 0.7) : C(0.8), str = String(d);
    if (isToday) { const pulse = 0.55 + 0.15 * Math.sin(t * 2.5); fillRect(g, Math.round(X + 1), Math.round(Y), Math.max(2, Math.round(cw - 2)), Math.max(1, Math.round(chh - 1)), '█', H(30, pulse)); }
    if (opt.big && chh >= 7 && cw >= 12) { const sy = 1, sx = 2, fw = fontW(str, F3) * sx; drawBig(g, str, X + (cw - fw) / 2, Y + (chh - 1 - 5) / 2, sx, sy, isToday ? C(0.02) : col, F3); }
    else txt(g, X + cw / 2 - str.length / 2, Y + Math.floor((chh - 1) / 2), str, isToday ? C(0.02) : col);
  }
  if (opt.grid) for (let r = 0; r <= 6; r++) for (let x = Math.round(x0); x < x0 + w; x++) g.set(x, Math.round(y0 + 2 + r * chh) - 1, '─', C(0.12));
}
TM.calendar = {
  frame(s, f) {
    const { g, cols, rows, C, H } = f, A = f.aspect, now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const side = cols >= 160, mw = side ? cols * 0.56 : cols * 0.9, mx = (cols - mw) / 2, top = rows >= 50 ? Math.round(rows * 0.2) : 3;
    // 標題
    const title = y + '-' + pad2(m + 1);
    if (rows >= 50) { const fit = bigFit(title, mw * 0.6, rows * 0.13, A); drawBig(g, title, cols / 2 - fit.w / 2, Math.max(1, top - fit.h - 2), fit.sx, fit.sy, (u, v) => H(30 + u * 40, 0.85 - v * 0.2)); }
    else ctext(g, 1, calTitle(f, y, m), C(0.9));
    calMonth(g, f, y, m, mx, top, mw, rows - top - 2, { big: true, grid: true });
    if (side) {
      const sw = cols * 0.17, sh = Math.min(rows * 0.35, 20);
      const pm = new Date(y, m - 1, 1), nm = new Date(y, m + 1, 1);
      ctextAt(g, cols * 0.11, top - 2, calTitle(f, pm.getFullYear(), pm.getMonth()), C(0.45));
      calMonth(g, f, pm.getFullYear(), pm.getMonth(), cols * 0.11 - sw / 2, top, sw, sh, {});
      ctextAt(g, cols * 0.89, top - 2, calTitle(f, nm.getFullYear(), nm.getMonth()), C(0.45));
      calMonth(g, f, nm.getFullYear(), nm.getMonth(), cols * 0.89 - sw / 2, top, sw, sh, {});
      const dayOfYear = Math.floor((now - new Date(y, 0, 1)) / 86400000) + 1, wk = Math.ceil((dayOfYear + new Date(y, 0, 1).getDay()) / 7);
      const info = f.lang === 'en'
        ? [`Today ${EN_DAY[now.getDay()].slice(0, 3)} ${EN_MON[m].slice(0, 3)} ${now.getDate()}`, `Day ${dayOfYear} of the year`, `Week ${wk}`, `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`].map(opq)
        : [`今天 ${m + 1}/${now.getDate()} 星期${WEEK[now.getDay()]}`, `今年第 ${dayOfYear} 天`, `第 ${wk} 週`, `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`];
      info.forEach((l, k) => { ctextAt(g, cols * 0.11, top + sh + 3 + k * 2, l, C(0.55)); });
    }
  },
};
// ── 跨年倒數 ──
TM.newyear = {
  init(s) { s.sp = []; },
  frame(s, f) {
    const { g, cols, rows, C, H, dt } = f, A = f.aspect, now = new Date(), ny = new Date(now.getFullYear() + 1, 0, 1), y0 = new Date(now.getFullYear(), 0, 1);
    let ms = ny - now; const d = Math.floor(ms / 86400000); ms -= d * 86400000;
    const hh = Math.floor(ms / 3600000), mm = Math.floor((ms % 3600000) / 60000), ss = Math.floor((ms % 60000) / 1000);
    ctext(g, Math.round(rows * 0.16), f.lang === 'en' ? opq(`Time left until ${now.getFullYear() + 1}`) : `距離 ${now.getFullYear() + 1} 年還有`, C(0.75));
    const l1 = String(d), l2 = pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss);
    const f1 = bigFit(l1 + '  ', cols * 0.5, rows * 0.28, A), f2 = bigFit(l2, cols * 0.8, rows * 0.22, A);
    drawBig(g, l1, cols / 2 - f1.w / 2 - 3, rows * 0.24, f1.sx, f1.sy, (u, v) => H(30 + v * 30, 0.9 - v * 0.2));
    txt(g, cols / 2 + fontW(l1, F5) * f1.sx / 2, rows * 0.24 + f1.h - 1, tr(f, '天', d === 1 ? 'day' : 'days'), C(0.8));
    drawBig(g, l2, cols / 2 - f2.w / 2, rows * 0.28 + f1.h + 2, f2.sx, f2.sy, (u, v) => H(190 + u * 60, 0.8));
    const frac = (now - y0) / (ny - y0), bw = Math.round(cols * 0.7), bx = Math.round((cols - bw) / 2), by = Math.min(rows - 3, Math.round(rows * 0.33 + f1.h + f2.h + 3));
    for (let k = 0; k < bw; k++) g.set(bx + k, by, k < frac * bw ? '█' : '░', k < frac * bw ? H(30 + (k / bw) * 300, 0.7) : C(0.15));
    ctextAt(g, cols / 2, by + 1, f.lang === 'en' ? opq(`${(frac * 100).toFixed(2)}% of this year has passed`) : `今年已經過了 ${(frac * 100).toFixed(2)}%`, C(0.55));
    // 小小的火花
    if (Math.random() < dt * 1.5) { const x = rnd(cols * 0.1, cols * 0.9), y = rnd(rows * 0.05, rows * 0.2), hue = rnd(0, 360); for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; s.sp.push({ x, y, vx: Math.cos(a) * rnd(6, 12), vy: (Math.sin(a) * rnd(6, 12)) / A, l: 1.2, hue }); } }
    for (let k = s.sp.length - 1; k >= 0; k--) { const p = s.sp[k]; p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 4 * dt; if (p.l <= 0) { s.sp.splice(k, 1); continue; } g.set(p.x, p.y, p.l > 0.6 ? '*' : '.', H(p.hue, p.l * 0.7)); }
  },
};
// ── 沙漏 ──
TM.hourglass = {
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    s.h = Math.max(12, (rows - 4) | 0); if (s.h % 2) s.h--; s.w = Math.max(10, Math.round(Math.min(cols * 0.5, s.h * A * 0.62))); s.x0 = Math.round((cols - s.w) / 2); s.y0 = Math.round((rows - s.h) / 2);
    s.mask = new Uint8Array(s.w * s.h); s.sand = new Uint8Array(s.w * s.h);
    const half = s.h / 2;
    for (let y = 0; y < s.h; y++) { const d = Math.abs(y + 0.5 - half) / half, wid = s.w / 2 * (0.06 + 0.94 * Math.pow(d, 0.7)); for (let x = 0; x < s.w; x++) if (Math.abs(x + 0.5 - s.w / 2) < wid) s.mask[y * s.w + x] = 1; }
    for (let y = 0; y < half * 0.92; y++) for (let x = 0; x < s.w; x++) if (s.mask[y * s.w + x] && y > half * 0.12) s.sand[y * s.w + x] = 1 + (hash(x, y) < 0.3 ? 1 : 0);
    s.total = s.sand.reduce((a, v) => a + (v ? 1 : 0), 0); s.flip = 0; s.acc = 0; s.dur = 60; s.el = 0;
  },
  frame(s, f) {
    const { g, cols, rows, C, H, dt } = f, W = s.w, Hh = s.h, half = Hh / 2;
    if (s.flip > 0) { s.flip -= dt; if (s.flip <= 0) { const n = new Uint8Array(W * Hh); for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) n[(Hh - 1 - y) * W + x] = s.sand[y * W + x]; s.sand = n; s.el = 0; } }
    else {
      s.el += dt;
      // 沙子的細胞自動機：由下往上更新
      const rate = s.total / s.dur; s.acc += rate * dt;
      for (let y = Hh - 2; y >= 0; y--) {
        const dir = (y + Math.floor(s.el * 10)) % 2 ? 1 : -1;
        for (let k = 0; k < W; k++) {
          const x = dir > 0 ? k : W - 1 - k, i = y * W + x; if (!s.sand[i]) continue;
          const neck = Math.abs(y + 1 - half) < 1;
          if (neck && s.acc < 1) continue;
          const below = i + W;
          if (s.mask[below] && !s.sand[below]) { s.sand[below] = s.sand[i]; s.sand[i] = 0; if (neck) s.acc--; continue; }
          const d = Math.random() < 0.5 ? 1 : -1;
          for (const dd of [d, -d]) { const xx = x + dd; if (xx < 0 || xx >= W) continue; const j = below + dd; if (s.mask[j] && !s.sand[j] && s.mask[i + dd]) { s.sand[j] = s.sand[i]; s.sand[i] = 0; if (neck) s.acc--; break; } }
        }
      }
      let topLeft = 0; for (let i = 0; i < W * Math.floor(half); i++) if (s.sand[i]) topLeft++;
      if (topLeft === 0 && s.el > 3) s.flip = 1.2;
    }
    const rot = s.flip > 0 ? Math.sin((1 - s.flip / 1.2) * Math.PI) : 0;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!s.mask[i]) continue;
      const X = s.x0 + x + Math.round(rot * (y - half) * 0.3), Y = s.y0 + y;
      const le = x === 0 || !s.mask[i - 1], re = x === W - 1 || !s.mask[i + 1];
      if (s.sand[i]) g.set(X, Y, s.sand[i] === 2 ? '▓' : '█', H(38, 0.55 + (s.sand[i] === 2 ? 0.1 : 0) + 0.15 * (1 - y / Hh)));
      if (le || re) { const top = y < half, ch = Math.abs(y + 0.5 - half) < 2 ? '│' : top === le ? BS : '/'; g.set(re ? X + 1 : X - 1, Y, ch, C(0.6)); }
    }
    for (let x = -3; x < W + 3; x++) { g.set(s.x0 + x, s.y0 - 1, '▄', H(25, 0.45)); g.set(s.x0 + x, s.y0 + Hh, '▀', H(25, 0.45)); }
    const left = Math.max(0, Math.ceil(s.dur - s.el));
    txt(g, s.x0 + W + 6, s.y0 + Hh / 2, s.flip > 0 ? tr(f, '翻面！', 'Flip!') : tr(f, '還剩 ' + left + ' 秒', left + 's left'), C(0.7));
  },
};
// ── 節拍器 ──
TM.metronome = {
  init(s) { s.ph = 0; s.bpmI = 2; s.beat = 0; s.flash = 0; s.bars = 0; s.lastSide = 1; },
  frame(s, f) {
    const { g, cols, rows, C, H, dt } = f, A = f.aspect, BPM = [60, 72, 90, 108, 120, 144], bpm = BPM[s.bpmI];
    s.ph += dt * Math.PI * (bpm / 60);
    const side = Math.sin(s.ph) >= 0 ? 1 : -1;
    if (side !== s.lastSide) { s.lastSide = side; s.beat = (s.beat + 1) % 4; s.flash = 0.18; if (s.beat === 0) { s.bars++; if (s.bars % 8 === 0) s.bpmI = (s.bpmI + 1) % BPM.length; } }
    s.flash = Math.max(0, s.flash - dt);
    const ang = Math.sin(s.ph) * 0.55, bx = cols / 2, base = rows - 2, top = Math.round(rows * 0.08), hgt = base - top, bwv = hgt * A * 0.55;
    // 機身（梯形）
    for (let y = top; y <= base; y++) { const k = (y - top) / hgt, half = (bwv * (0.22 + 0.78 * k)) / 2; for (let x = Math.round(bx - half); x <= bx + half; x++) { const edge = Math.abs(x - bx) > half - 1.2; g.set(x, y, edge ? '█' : (x + y) % 4 === 0 ? '░' : ' ', edge ? H(25, 0.45) : H(25, 0.18)); } }
    // 刻度
    for (let k = 0; k < 9; k++) { const y = top + 3 + k * (hgt * 0.55 / 9); txt(g, bx - 3, y, '─ ' + [40, 60, 72, 90, 108, 120, 144, 168, 208][k], C(0.35)); }
    // 擺桿
    const pv = base - hgt * 0.18, L = hgt * 0.95 * A, ex = bx + Math.sin(ang) * L, ey = pv - (Math.cos(ang) * L) / A;
    g.line(bx, pv, ex, ey, segCh(Math.sin(ang), -Math.cos(ang)), C(0.85));
    const wpos = 0.35 + ((bpm - 60) / 84) * 0.45, wx = bx + Math.sin(ang) * L * wpos, wy = pv - (Math.cos(ang) * L * wpos) / A, ww = Math.max(1, Math.round(hgt * 0.07));
    for (let dy = -Math.ceil(ww / A); dy <= Math.ceil(ww / A); dy++) for (let dx = -ww; dx <= ww; dx++) g.set(wx + dx, wy + dy, '█', H(45, 0.8));
    g.set(bx, pv, '●', C(1));
    // 拍子燈
    for (let k = 0; k < 4; k++) { const x = cols / 2 + (k - 1.5) * Math.max(4, cols * 0.04), lit = k === s.beat && s.flash > 0; g.set(x, 1, lit ? '●' : '○', lit ? H(k === 0 ? 0 : 120, 1) : C(0.3)); }
    const label = bpm + ' BPM', fit = bigFit(label, cols * 0.22, rows * 0.12, A);
    drawBig(g, label, cols * 0.04, rows * 0.4, fit.sx, fit.sy, H(45, 0.75));
    txt(g, cols * 0.04, rows * 0.4 + fit.h + 1, tr(f, '第 ' + (s.bars + 1) + ' 小節', 'Bar ' + (s.bars + 1)), C(0.5));
  },
};
// ── 時光進度條 ──
TM.progress = {
  frame(s, f) {
    const { g, cols, rows, C, H, t } = f, A = f.aspect, now = new Date(), y = now.getFullYear();
    const dayS = new Date(y, now.getMonth(), now.getDate()), wkS = new Date(dayS - now.getDay() * 86400000), moS = new Date(y, now.getMonth(), 1), yrS = new Date(y, 0, 1), dcS = new Date(y - (y % 10), 0, 1);
    const items = [[tr(f, '今天', 'Today'), (now - dayS) / 86400000, 30], [tr(f, '本週', 'This week'), (now - wkS) / (7 * 86400000), 90], [tr(f, '本月', 'This month'), (now - moS) / (new Date(y, now.getMonth() + 1, 1) - moS), 150], [tr(f, '今年', 'This year'), (now - yrS) / (new Date(y + 1, 0, 1) - yrS), 210], [tr(f, '這十年', 'This decade'), (now - dcS) / (new Date(y - (y % 10) + 10, 0, 1) - dcS), 280]];
    const n = items.length, slot = (rows - 2) / n, bw = Math.round(cols * 0.62), bx = Math.round(cols * 0.3);
    items.forEach(([lab, fr, hue], k) => {
      const yc = Math.round(1 + slot * (k + 0.5)), bh = Math.max(1, Math.round(slot * 0.35));
      const pct = (fr * 100).toFixed(rows >= 50 ? 3 : 1) + '%';
      if (rows >= 50) { const fit = bigFit(pct, cols * 0.22, slot * 0.55, A, F3); drawBig(g, pct, Math.round(cols * 0.28) - fit.w - 2, yc - fit.h / 2, fit.sx, fit.sy, H(hue, 0.85), F3); txt(g, Math.round(cols * 0.02), yc - Math.round(fit.h / 2) - 1, lab, C(0.7)); }
      else { txt(g, 1, yc, lab, C(0.7)); txt(g, bx - pct.length - 1, yc, pct, H(hue, 0.85)); }
      const fillW = fr * bw;
      for (let x = 0; x < bw; x++) for (let r = 0; r < bh; r++) {
        const yy = yc - Math.floor(bh / 2) + r, on = x < fillW, edge = on && x + 1 >= fillW;
        const sheen = 0.5 + 0.5 * Math.sin(x * 0.12 - t * 2.2 + k);
        g.set(bx + x, yy, on ? (edge ? '▌' : '█') : (x % 2 ? '░' : ' '), on ? H(hue + (x / bw) * 30, 0.45 + 0.25 * sheen) : C(0.12));
      }
    });
  },
};
// ── 月相 ──
const PHASE_NAMES = ['新月', '眉月', '上弦月', '盈凸月', '滿月', '虧凸月', '下弦月', '殘月'];
const PHASE_NAMES_EN = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
const moonAge = d => { const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14); return ((((d - ref) / 86400000) % syn) + syn) % syn; };
function drawMoon(g, f, cx, cyv, R, age, seed) {
  const { C, H } = f, A = f.aspect, ph = (age / 29.530588853) * TAU, Lx = Math.sin(ph), Lz = -Math.cos(ph);
  dRing(g, f, cx, cyv, 0, R, 0, TAU, (a, k, x, y) => {
    const nx = (x + 0.5 - cx) / R, ny = ((y + 0.5) * A - cyv) / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lit = nx * Lx + nz * Lz, mare = Noise.fbm(nx * 2.2 + seed, ny * 2.2, 3.1, 3);
    if (lit > 0) { const b = 0.45 + 0.5 * Math.min(1, lit * 1.5) - (mare > 0.12 ? 0.18 : 0); return [b > 0.75 ? '█' : b > 0.55 ? '▓' : '▒', C(clamp(b, 0.2, 1))]; }
    return [mare > 0.1 ? '░' : '·', C(0.09)];
  });
}
TM.moon = {
  init(s, f) { s.dust = mkDust((f.cols * f.rows) / 50, f.cols, f.rows); },
  frame(s, f) {
    const { g, cols, rows, C, H, t } = f, A = f.aspect, now = new Date(), age = moonAge(now), syn = 29.530588853;
    drawDust(g, s.dust, t, C, 0.25, '.+');
    const R = Math.min(cols * 0.3, rows * A * 0.36), cx = cols * 0.38, cyv = rows * A * 0.45;
    drawMoon(g, f, cx, cyv, R, age, 0);
    const ph8 = Math.floor(((age / syn) * 8 + 0.5)) % 8, illum = (1 - Math.cos((age / syn) * TAU)) / 2, name = tr(f, PHASE_NAMES[ph8], PHASE_NAMES_EN[ph8]);
    const tx = Math.round(cx + R + Math.max(4, cols * 0.06)), ty = Math.round(cyv / A - 4);
    txt(g, tx, ty, tr(f, '今晚的月亮', "Tonight's moon"), C(0.5)); txt(g, tx, ty + 2, name, C(1));
    txt(g, tx, ty + 4, tr(f, '亮面 ' + Math.round(illum * 100) + '%　月齡 ' + age.toFixed(1) + ' 天', 'Lit ' + Math.round(illum * 100) + '%  Age ' + age.toFixed(1) + ' days'), C(0.7));
    const toFull = ((syn / 2 - age) % syn + syn) % syn, toNew = syn - age;
    txt(g, tx, ty + 6, tr(f, '距離滿月 ' + toFull.toFixed(1) + ' 天', 'Full moon in ' + toFull.toFixed(1) + ' days'), C(0.6)); txt(g, tx, ty + 7, tr(f, '距離新月 ' + toNew.toFixed(1) + ' 天', 'New moon in ' + toNew.toFixed(1) + ' days'), C(0.6));
    // 未來七天
    const r2 = Math.max(1.5, Math.min(cols * 0.025, rows * A * 0.05)), yv = rows * A - r2 * 1.6;
    for (let k = 1; k <= 7; k++) { const x = cols * 0.1 + (k - 1) * (cols * 0.8 / 6); drawMoon(g, f, x, yv, r2, moonAge(new Date(now.getTime() + k * 86400000)), 0); if (rows > 40) ctextAt(g, x, Math.round(yv / A - r2 / A) - 2, '+' + tr(f, k + ' 天', enN(k, 'day')), C(0.4)); }
  },
};
// ── 日照弧 ──
TM.daylight = {
  init(s, f) { s.clouds = Array.from({ length: 5 }, () => ({ x: rnd(0, f.cols), y: rnd(0.1, 0.35), w: rnd(0.06, 0.12), v: rnd(0.5, 1.5) })); s.dust = mkDust((f.cols * f.rows) / 40, f.cols, f.rows); },
  frame(s, f) {
    const { g, cols, rows, C, H, t, dt } = f, A = f.aspect, now = new Date(), y = now.getFullYear();
    const N = Math.floor((now - new Date(y, 0, 0)) / 86400000), dec = 23.44 * Math.sin((TAU * (284 + N)) / 365) * Math.PI / 180, lat = 25.03 * Math.PI / 180;
    // 台北（東經 121.5 度、UTC+8）：用均時差修正正午；日出日落算到太陽上緣並含大氣折射（-0.833 度）
    const B = (TAU * (N - 81)) / 365, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const w0 = Math.acos(clamp((Math.sin((-0.833 * Math.PI) / 180) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec)), -1, 1));
    const dayLen = (2 * w0 * 180 / Math.PI) / 15, noon = 12 - (121.5 - 120) / 15 - eot / 60;
    const rise = noon - dayLen / 2, set = noon + dayLen / 2, hr = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const day = hr >= rise && hr <= set, k = day ? (hr - rise) / (set - rise) : 0;
    const hz = Math.round(rows * 0.72), cx = cols / 2, Rx = cols * 0.42, Ry = rows * 0.58;
    // 天空亮度
    const sunH = day ? Math.sin(k * Math.PI) : -0.3, sky = clamp(sunH * 1.2, 0, 1), dusk = day ? Math.max(0, 1 - Math.abs(sunH) * 5) : 0;
    for (let yy = 0; yy < hz; yy++) { const v = yy / hz; for (let x = 0; x < cols; x++) { const d = hash(x, yy); if (d < 0.18 + sky * 0.3) g.set(x, yy, sky > 0.3 ? (d < 0.08 ? '·' : ' ') : ' ', H(dusk > 0.3 ? 25 : 205, 0.1 + sky * 0.25 * v)); } }
    if (sky < 0.4) drawDust(g, s.dust.filter(p => p.y < hz), t, C, 0.3 * (1 - sky * 2), '.+');
    // 弧線
    for (let a = 0; a <= Math.PI; a += 0.01) g.set(cx - Math.cos(a) * Rx, hz - Math.sin(a) * Ry, '·', C(0.22));
    for (let hh = 6; hh <= 18; hh += 3) { const kk = (hh - rise) / (set - rise); if (kk < 0 || kk > 1) continue; const a = kk * Math.PI; txt(g, cx - Math.cos(a) * Rx - 1, hz - Math.sin(a) * Ry - 1, pad2(hh), C(0.35)); }
    // 太陽或月亮
    const a = day ? k * Math.PI : Math.PI * (((hr < rise ? hr + 24 : hr) - set) / (24 - dayLen));
    const bx = cx - Math.cos(a) * Rx, byv = (hz - Math.sin(a) * Ry) * A, br = Math.max(2, Math.min(cols * 0.04, rows * A * 0.07));
    if (day) { dRing(g, f, bx, byv, br * 1.2, br * 1.8, 0, TAU, (an) => (Math.floor(an / TAU * 16 + t) % 2 ? ['·', H(45, 0.6)] : null)); disc(g, f, bx, byv, br, '█', H(dusk > 0.3 ? 20 : 48, 0.85)); }
    else drawMoon(g, f, bx, byv, br, moonAge(now), 0);
    // 雲
    for (const c of s.clouds) { c.x += c.v * dt * cols * 0.004; if (c.x > cols * 1.2) c.x = -cols * 0.2; const cw = c.w * cols, cy = c.y * rows; for (let yy = -2; yy <= 1; yy++) for (let xx = -cw; xx <= cw; xx++) { const d = (xx / cw) ** 2 + ((yy + 0.5) / 2.2) ** 2; if (d < 1) g.set(c.x + xx, cy + yy, d < 0.45 ? '▒' : '░', C(0.15 + sky * 0.35)); } }
    // 地平線與遠山
    for (let x = 0; x < cols; x++) { const h = rows * (0.05 + 0.05 * (0.5 + 0.5 * Noise.fbm(x * 0.02, 1.7, 0, 3))); for (let yy = Math.round(hz - h); yy < rows; yy++) g.set(x, yy, yy < hz ? '█' : (x + yy) % 3 ? '▓' : '█', H(day ? 130 : 230, yy < hz ? 0.12 + sky * 0.12 : 0.08 + sky * 0.1)); }
    const fmt = v => pad2(Math.floor(v)) + ':' + pad2(Math.floor((v % 1) * 60));
    hudText(g, 2, rows - 2, tr(f, '日出 ' + fmt(rise) + '　日落 ' + fmt(set) + '　白天 ' + dayLen.toFixed(1) + ' 小時', 'Sunrise ' + fmt(rise) + '  Sunset ' + fmt(set) + '  Daylight ' + dayLen.toFixed(1) + ' h'), C(0.7), C(0));
    const ts = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    if (rows >= 50) { const fit = bigFit(ts, cols * 0.18, rows * 0.1, A); drawBig(g, ts, cols - fit.w - 3, rows - fit.h - 2, fit.sx, fit.sy, C(0.8)); } else hudText(g, cols - 7, rows - 2, ts, C(0.85), C(0));
  },
};
// ── 番茄鐘 ──
TM.pomodoro = {
  frame(s, f) {
    const { g, cols, rows, C, H, t } = f, A = f.aspect, now = new Date(), m = now.getMinutes() % 30, sec = m * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
    const focus = m < 25, len = focus ? 1500 : 300, el = focus ? sec : sec - 1500, left = Math.max(0, len - el), frac = el / len;
    const hue = focus ? 5 : 130, R = Math.min(cols / 2, rows * A / 2) * 0.86, cx = cols / 2, cyv = rows * A / 2;
    dRing(g, f, cx, cyv, R * 0.84, R, 0, TAU, (a, k) => {
      const on = a / TAU <= frac;
      if (on) return ['█', H(hue + (a / TAU) * 20, 0.45 + 0.3 * (a / TAU) / Math.max(0.01, frac))];
      return ['░', H(hue, 0.08 + 0.06 * (0.5 + 0.5 * Math.cos(a * 2 - t)))];
    });
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.set(cx + Math.sin(a) * R * 0.78, (cyv - Math.cos(a) * R * 0.78) / A, '·', C(0.4)); }
    const str = pad2(Math.floor(left / 60)) + ':' + pad2(Math.floor(left % 60)), fit = bigFit(str, R * 1.2, R * 0.45 / A, A);
    drawBig(g, str, cx - fit.w / 2, cyv / A - fit.h / 2, fit.sx, fit.sy, H(hue, 0.9));
    ctextAt(g, cx, Math.round(cyv / A - fit.h / 2 - 3), focus ? tr(f, '專注時間', 'Focus time') : tr(f, '休息一下', 'Take a break'), H(hue, 0.85));
    const cyc = Math.floor(now.getMinutes() / 30), tomatoes = (now.getHours() * 2 + cyc) % 4;
    const dots = '●'.repeat(tomatoes + (focus ? 0 : 1)) + '○'.repeat(Math.max(0, 3 - tomatoes - (focus ? 0 : 1))), expl = tr(f, '每小時兩輪：25 分專注＋5 分休息', 'Two rounds an hour: 25 min focus + 5 min break'), line = dots + tr(f, '　', '  ') + expl;
    if (g.textW(line) < R * 1.4) ctextAt(g, cx, Math.round(cyv / A + fit.h / 2 + 2), line, C(0.5));
    else { ctextAt(g, cx, Math.round(cyv / A + fit.h / 2 + 2), dots, C(0.5)); ctext(g, rows - 1, expl, C(0.4)); }
  },
};
A({ id: 'ga-timer', name: '時光日曆', cat: '實用', theme: 'amber', hue: true, desc: '標出今天的大月曆與前後月份',
  params: { kind: 'calendar' },
  variants: [
    { id: 'newyear', name: '跨年倒數', theme: 'synth', desc: '倒數到下一個新年的時間', params: { kind: 'newyear' } },
    { id: 'hourglass', name: '沙漏', theme: 'gold', desc: '細沙一粒粒落下的一分鐘沙漏', params: { kind: 'hourglass' } },
    { id: 'metronome', name: '節拍器', theme: 'sunset', desc: '左右擺動、會換速度的節拍器', params: { kind: 'metronome' } },
    { id: 'progress', name: '時光進度', theme: 'mint', desc: '今天本週今年各過了多少', params: { kind: 'progress' } },
    { id: 'moon', name: '今晚月相', theme: 'mono', hue: false, desc: '依日期算出的月亮圓缺', params: { kind: 'moon' } },
    { id: 'pomodoro', name: '番茄鐘', theme: 'blood', desc: '整點對齊的專注與休息循環', params: { kind: 'pomodoro' } },
  ],
  init(s, f) { s.K = TM[f.p.kind]; s.dust2 = mkDust((f.cols * f.rows) / 110, f.cols, f.rows); if (s.K.init) s.K.init(s, f); },
  frame(s, f) { const k = f.p.kind; if (k !== 'moon' && k !== 'daylight') drawDust(f.g, s.dust2, f.t, f.C, 0.13); s.K.frame.call(s.K, s, f); } });

/* ════════════ 14. 城市天際線 ════════════ */
const SK_CFG = {
  city: { P: 150, ground: 0.84, cars: 1, lamps: 1 },
  harbor: { P: 150, ground: 0.62, water: 1, boats: 1 },
  neon: { night: 1, ground: 0.86, neon: 1, fly: 1, cars: 1, tall: 1.25 },
  snow: { P: 150, ground: 0.82, houses: 'flat', snow: 1 },
  bridge: { P: 150, ground: 0.56, bridge: 1, water: 1 },
  village: { P: 150, ground: 0.9, houses: 'hill', flies: 1 },
  lapse: { P: 32, ground: 0.84, trails: 1, cars: 1, lamps: 1 },
  traffic: { night: 1, ground: 0.5, highway: 1 },
};
const DIMC = new Map();
function dimHex(hex, k) { const key = hex + (k > 0.55 ? 'a' : 'b'); let v = DIMC.get(key); if (v === undefined) { if (DIMC.size > 4096) DIMC.clear(); const n = parseInt(hex.slice(1), 16); v = rgb(((n >> 16) & 255) * k, ((n >> 8) & 255) * k, (n & 255) * k); DIMC.set(key, v); } return v; }
const SIGNS = ['BAR', 'HOTEL', 'CAFE', '24H', 'NOODLE', 'OPEN', '拉麵', '旅館', '茶', 'ARCADE', 'SUSHI', '書店'];
const SIGN_EN = { '拉麵': 'RAMEN', '旅館': 'INN', '茶': 'TEA', '書店': 'BOOKS' };   // 英文介面時的招牌
function skBuild(s, f) {
  const { cols, rows } = f, c = s.cfg, gy = s.gy;
  s.layers = [];
  if (c.houses) {
    s.houses = [];
    if (c.houses === 'flat') { for (let x = 2; x < cols - 6;) { const w = rint(7, 13) * (rows >= 50 ? 1.4 : 1) | 0, h = Math.round(w * 0.45); s.houses.push({ x, w, h, base: gy, seed: rint(0, 9999), tree: Math.random() < 0.3 }); x += w + rint(2, 8); } }
    else for (let k = 0; k < Math.round(cols / 9); k++) { const x = rnd(0, cols - 8), w = rint(5, 9) * (rows >= 50 ? 1.3 : 1) | 0; s.houses.push({ x, w, h: Math.round(w * 0.45), base: 0, seed: rint(0, 9999), hill: 1 }); }
    return;
  }
  const specs = c.highway ? [[0.12, 0.28, 0.1], [0.2, 0.42, 0.2]] : [[0.12, 0.3, 0.09], [0.2, 0.55, 0.16], ...(c.neon ? [[0.3, 0.7, 0.25]] : [])];
  specs.forEach(([h0, h1, lum], li) => {
    const L = []; let x = -rint(0, 6);
    while (x < cols) {
      const w = rint(6, 16) + (li ? 2 : 0), h = Math.round(rows * rnd(h0, h1) * (c.tall || 1) * (c.bridge || c.water ? 0.8 : 1));
      L.push({ x, w, h, roof: pick(['flat', 'flat', 'ant', 'spire', 'step', 'dome', 'tank']), seed: rint(0, 99999), sign: c.neon && li > 0 && Math.random() < 0.6 ? { text: pick(SIGNS), hue: pick([320, 190, 50, 280, 0, 140]), y: rnd(0.15, 0.6), blink: Math.random() < 0.3 } : null });
      x += w + rint(0, li ? 3 : 1);
    }
    s.layers.push({ L, lum, li });
  });
}
A({ id: 'ga-skyline', name: '城市天際線', cat: '場景', theme: 'ocean', hue: true, desc: '城市從白天到夜晚的一天',
  params: { scene: 'city' },
  variants: [
    { id: 'harbor', name: '港灣倒影', theme: 'ice', desc: '燈火倒映在港灣水面', params: { scene: 'harbor' } },
    { id: 'neon', name: '霓虹不夜城', theme: 'neon', desc: '招牌閃爍、飛車穿梭的夜城', params: { scene: 'neon' } },
    { id: 'snow', name: '雪夜小鎮', theme: 'lavender', desc: '下雪的小鎮與暖黃窗光', params: { scene: 'snow' } },
    { id: 'bridge', name: '跨海大橋', theme: 'blueprint', desc: '吊橋上車燈流動、橋下是海', params: { scene: 'bridge' } },
    { id: 'village', name: '山城', theme: 'forest', desc: '山坡上點點燈火的小村', params: { scene: 'village' } },
    { id: 'lapse', name: '縮時攝影', theme: 'sunset', desc: '三十秒過完一天、星軌轉動', params: { scene: 'lapse' } },
    { id: 'traffic', name: '光軌車流', theme: 'fire', desc: '長曝光下流動的車燈光軌', params: { scene: 'traffic' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f, c = SK_CFG[p.scene];
    s.cfg = c; s.gy = Math.round(rows * c.ground); s.u = c.night ? 0.02 : 0.42; s.t = 0;
    skBuild(s, f);
    s.cars = Array.from({ length: Math.round(cols / 18) }, () => ({ x: rnd(0, cols), v: rnd(6, 14) * (Math.random() < 0.5 ? -1 : 1) * (cols / 160), hue: pick([0, 210, 50, 120, 30, 280]) }));
    s.clouds = Array.from({ length: 6 }, () => ({ x: rnd(0, cols), y: rnd(0.05, 0.3) * rows, w: rnd(0.05, 0.12) * cols, v: rnd(0.5, 1.5) }));
    s.flakes = Array.from({ length: Math.round((cols * rows) / 45) }, () => ({ x: rnd(0, cols), y: rnd(0, rows), v: rnd(0.5, 1.5) }));
    s.smoke = []; s.fly = Array.from({ length: 10 }, () => ({ x: rnd(0, cols), y: rnd(0.1, 0.45) * rows, v: rnd(10, 30) * (Math.random() < 0.5 ? -1 : 1) * (cols / 160), hue: pick([190, 320, 50]) }));
    s.boats = Array.from({ length: 3 }, () => ({ x: rnd(0, cols), y: rnd(0.15, 0.7), v: rnd(1, 3) * (Math.random() < 0.5 ? -1 : 1) }));
    s.trails = Array.from({ length: 70 }, (_, k) => ({ lane: k % 6, p: rnd(0, 1), v: rnd(0.05, 0.09) }));
    s.bugs = Array.from({ length: 40 }, () => ({ x: rnd(0, cols), y: rnd(0.5, 0.95) * rows, ph: rnd(0, TAU) }));
  },
  frame(s, f) {
    const { g, cols, rows, dt, C, H, t } = f, A = f.aspect, c = s.cfg, gy = s.gy;
    s.t += dt;
    if (!c.night) s.u = (s.u + dt / c.P) % 1;
    const u = s.u, e = Math.sin(TAU * (u - 0.25)), day = clamp(e * 2 + 0.3, 0, 1), dark = 1 - day, dusk = Math.max(0, 1 - Math.abs(e) * 4);
    // 天空背景色
    const dk = dusk * 0.6, mx3 = (nv, dv, kv) => { const v = nv + (dv - nv) * day; return Math.round(v + (kv - v) * dk); };
    f.bg = rgb(mx3(4, 22, 70), mx3(6, 52, 32), mx3(16, 96, 46));
    // 星星（有縮時就畫星軌）
    if (dark > 0.2) {
      const pole = [cols * 0.75, rows * 0.05];
      for (let k = 0; k < (cols * rows) / 60; k++) {
        const sx = hash(k, 1) * cols, sy = hash(k, 2) * gy * 0.9, b = hash(k, 3);
        if (c.trails) { const r = Math.hypot(sx - pole[0], (sy - pole[1]) * A), a0 = Math.atan2((sy - pole[1]) * A, sx - pole[0]); for (let j = 0; j < 8; j++) { const a = a0 + t * 0.05 - j * 0.02; const x = pole[0] + Math.cos(a) * r, y = pole[1] + (Math.sin(a) * r) / A; if (y < gy) g.set(x, y, '·', C((0.15 + 0.3 * b) * dark * (1 - j / 8))); } }
        else g.set(sx, sy, b > 0.92 ? '+' : '.', C((0.15 + 0.35 * b * (0.6 + 0.4 * Math.sin(t * (1 + b * 3) + k))) * dark));
      }
    }
    // 太陽與月亮
    const arc = (k, el) => [cols * (0.06 + 0.88 * k), gy - Math.max(-0.2, el) * (gy - rows * 0.12)];
    if (e > -0.15 && !c.night) { const [sx, sy] = arc((u - 0.2) / 0.6, e), r = Math.max(2, rows * 0.07); dRing(g, f, sx, sy * A, 0, r * A * 0.5 * 2, 0, TAU, (a, k) => (sy < gy ? [k > 0.85 ? '▓' : '█', H(dusk > 0.3 ? 20 : 45, 0.75 + 0.2 * (1 - k))] : null)); }
    const mu = (u + 0.5) % 1, me = Math.sin(TAU * (mu - 0.25));
    if (me > -0.1) { const [mx, my] = c.night ? [cols * 0.8, rows * 0.15] : arc((mu - 0.2) / 0.6, me); drawMoon(g, f, mx, my * A, Math.max(2, rows * 0.05) * A * 0.9, 9, 0); }
    // 雲
    for (const cl of s.clouds) {
      cl.x += cl.v * dt * (c.trails ? 12 : 1.5); if (cl.x > cols + cl.w) cl.x = -cl.w;
      for (let yy = -2; yy <= 1; yy++) for (let xx = -cl.w; xx <= cl.w; xx++) { const d = (xx / cl.w) ** 2 + ((yy + 0.5) / 2.3) ** 2; if (d < 1 && cl.y + yy < gy) g.set(cl.x + xx, cl.y + yy, d < 0.4 ? '▒' : '░', dusk > 0.3 ? H(15, 0.2 + 0.2 * day) : C(0.08 + 0.3 * day)); }
    }
    // 黃昏地平線光
    if (dusk > 0.1) for (let y = Math.round(gy - rows * 0.15); y < gy; y++) for (let x = 0; x < cols; x++) if (hash(x, y) < 0.25 * dusk) g.set(x, y, '░', H(25, 0.25 * dusk + 0.05));
    const winOn = (seed, wx, wy) => { const h = hash(seed + wx * 7, wy); const slow = hash(seed + wx, wy + Math.floor(s.t / 9 + h * 5)); return h < dark * 0.75 && slow > 0.12; };
    // ── 房子（小鎮、山城） ──
    if (c.houses) {
      if (c.houses === 'hill') {
        for (const [amp, lum, sd, base] of [[0.35, 0.1, 1, 0.55], [0.3, 0.15, 2, 0.7], [0.25, 0.2, 3, 0.85]]) for (let x = 0; x < cols; x++) {
          const h = rows * amp * (0.5 + 0.5 * Noise.fbm(x * 0.012, sd * 3.1, 0, 3)), top = Math.round(rows * base - h);
          for (let y = Math.max(0, top); y < rows; y++) g.set(x, y, y === top ? '▄' : (y - top) % 4 === 1 && lum > 0.12 ? '≡' : '█', H(110 + sd * 10, (lum * (0.4 + 0.6 * day)) + (y === top ? 0.03 : 0)));
        }
        for (const hs of s.houses) { if (!hs.base) { const x = hs.x + hs.w / 2, h = rows * 0.25 * (0.5 + 0.5 * Noise.fbm(x * 0.012, 3 * 3.1, 0, 3)); hs.base = Math.round(rows * 0.85 - h) + 1; } }
      }
      if (c.houses === 'flat') { for (let x = 0; x < cols; x++) for (let y = gy; y < rows; y++) g.set(x, y, y === gy ? '▀' : hash(x, y) < 0.25 ? '·' : '▓', C(y === gy ? 0.7 : 0.25 + 0.15 * day + 0.06 * hash(x, y))); }
      for (const hs of s.houses) {
        const { x, w, h, base } = hs, roofH = Math.max(2, Math.round(w / 2.6)), top = base - h;
        for (let r = 0; r < roofH; r++) { const half = ((r + 1) / roofH) * (w / 2 + 1); for (let k = Math.round(x + w / 2 - half); k <= x + w / 2 + half; k++) g.set(k, top - roofH + r, c.snow ? (r < 2 ? '▄' : '█') : '█', c.snow && r < roofH * 0.6 ? C(0.85) : H(10, 0.25 + 0.15 * day)); }
        for (let y = top; y < base; y++) for (let k = 0; k < w; k++) {
          const isWin = (y - top) % 2 === 1 && k % 3 === 1 && k < w - 1 && y < base - 1, door = k === Math.floor(w / 2) && y >= base - 2;
          const on = isWin && winOn(hs.seed, k, y);
          g.set(x + k, y, door ? '▌' : isWin ? '▪' : '█', door ? H(25, 0.3) : on ? H(42, 0.85) : isWin ? C(0.12 + 0.15 * day) : H(30, 0.12 + 0.12 * day));
        }
        const cx = x + w - 2; g.set(cx, top - roofH, '█', H(10, 0.3));
        if (Math.random() < dt * 2) s.smoke.push({ x: cx, y: top - roofH - 1, l: rnd(2, 4) });
        if (hs.tree) { const tx = x + w + 2; for (let r = 0; r < h + roofH; r++) { const half = Math.max(0, ((r + 1) / (h + roofH)) * 2.5); for (let k = Math.round(tx - half); k <= tx + half; k++) g.set(k, base - h - roofH + r, c.snow && r % 3 === 0 ? '▄' : '█', c.snow && r % 3 === 0 ? C(0.8) : H(140, 0.25)); } }
      }
      for (let k = s.smoke.length - 1; k >= 0; k--) { const q = s.smoke[k]; q.l -= dt; q.y -= dt * 1.5; q.x += dt * (1 + Math.sin(t + k)); if (q.l <= 0) { s.smoke.splice(k, 1); continue; } g.set(q.x, q.y, q.l > 2.5 ? '°' : q.l > 1 ? 'o' : '.', C(0.25 + 0.1 * q.l)); }
      if (c.snow) for (const fl of s.flakes) { fl.y += dt * fl.v * 3; fl.x += dt * Math.sin(t * 0.7 + fl.v * 5) * 1.5; if (fl.y > rows) { fl.y = 0; fl.x = rnd(0, cols); } g.set(fl.x, fl.y, fl.v > 1.2 ? '*' : '.', C(0.7 + 0.3 * (fl.v - 0.5))); }
      if (c.flies && dark > 0.3) for (const b of s.bugs) { const bb = 0.5 + 0.5 * Math.sin(t * 2 + b.ph); if (bb > 0.6) g.set(b.x + Math.sin(t * 0.4 + b.ph) * 4, b.y + Math.cos(t * 0.3 + b.ph), '·', H(70, bb * dark)); }
      return;
    }
    // ── 大樓 ──
    for (const layer of s.layers) {
      for (const b of layer.L) {
        const top = gy - b.h, lum = layer.lum * (0.55 + 1.3 * day), bh = 215 + (b.seed % 5) * 8;
        for (let y = Math.max(0, top); y < gy; y++) for (let k = 0; k < b.w; k++) {
          const X = b.x + k; if (X < 0 || X >= cols) continue;
          const isWin = layer.li > 0 && (y - top) % 2 === 1 && k % 2 === 1 && k < b.w - 1 && y < gy - 1;
          let ch = '█', col = H(bh, lum + (k === 0 ? 0.03 : 0));
          if (isWin) { const on = winOn(b.seed, k, y); ch = '▪'; col = on ? H(45 - (b.seed % 3) * 8, 0.75) : day > 0.5 ? H(200, 0.25 + 0.1 * day) : H(225, lum * 0.5); }
          else if (layer.li === 0 && dark > 0.4 && (y - top) % 3 === 1 && k % 3 === 1 && hash(b.seed + k, y) < dark * 0.4) { ch = '·'; col = H(45, 0.5); }
          g.set(X, y, ch, col);
        }
        const cx = b.x + (b.w >> 1);
        if (b.roof === 'ant' || b.roof === 'spire') { const L = b.roof === 'spire' ? Math.round(b.h * 0.25) : Math.round(b.h * 0.12); for (let r = 1; r <= L; r++) g.set(cx, top - r, b.roof === 'spire' && r < L * 0.5 ? '█' : '│', H(225, lum + 0.05)); if (dark > 0.3 && ((s.t * 1.2 + b.seed) % 2) < 1) g.set(cx, top - L - 1, '•', H(0, 0.9)); }
        else if (b.roof === 'step') { for (let r = 1; r <= 2; r++) for (let k = r * 2; k < b.w - r * 2; k++) g.set(b.x + k, top - r, '█', H(225, lum)); }
        else if (b.roof === 'dome') { const R = b.w / 2; for (let k = 0; k < b.w; k++) { const hh = Math.round(Math.sqrt(Math.max(0, 1 - ((k + 0.5 - R) / R) ** 2)) * R / A); for (let r = 1; r <= hh; r++) g.set(b.x + k, top - r, '█', H(225, lum)); } }
        else if (b.roof === 'tank') { g.sprite(b.x + 1, top - 3, ['▄██▄', '████', '│  │'], H(25, lum + 0.05)); }
        if (b.sign) {
          const sy = Math.round(top + b.h * b.sign.y), stx = tr(f, b.sign.text, SIGN_EN[b.sign.text] || b.sign.text), tw = g.textW(stx) + 2, sx = b.x + Math.round((b.w - tw) / 2);
          const on = !b.sign.blink || Math.floor(s.t * 0.8 + b.seed) % 3 !== 0, col = on ? H(b.sign.hue, 0.95) : H(b.sign.hue, 0.25);
          box(g, sx - 1, sy - 1, tw + 2, 3, on ? H(b.sign.hue, 0.6) : H(b.sign.hue, 0.2)); fillRect(g, sx, sy, tw, 1, ' ', col); txt(g, sx + 1, sy, stx, col);
        }
      }
    }
    if (c.neon) for (let y = gy - Math.round(rows * 0.12); y < gy; y++) for (let x = 0; x < cols; x++) if (hash(x, y + Math.floor(t * 2)) < 0.08) g.set(x, y, '░', H(290, 0.2));
    if (c.fly) for (const q of s.fly) { q.x += q.v * dt; if (q.x < -10) q.x = cols + 10; if (q.x > cols + 10) q.x = -10; for (let k = 0; k < 8; k++) g.set(q.x - Math.sign(q.v) * k, q.y, k ? '─' : '■', H(q.hue, 0.9 - k * 0.1)); }
    // ── 地面：街道 / 水面 / 橋 / 高速公路 ──
    if (c.highway) {
      for (let y = gy; y < rows; y++) for (let x = 0; x < cols; x++) if (hash(x, y) < 0.05) g.set(x, y, '.', C(0.1));
      const lanes = 6, path = (lane, p) => { const x = p * (cols + 40) - 20, y = gy + (rows - gy) * (0.15 + lane * 0.13) + Math.sin(p * 4 + lane * 0.6) * rows * 0.05 - Math.cos(p * 2.2) * rows * 0.04; return [x, y]; };
      for (let l = 0; l < lanes; l++) for (let p = 0; p < 1; p += 0.004) { const [x, y] = path(l, p); g.set(x, y, '─', C(0.08)); }
      for (const q of s.trails) {
        const dir = q.lane < 3 ? 1 : -1; q.p += q.v * dt * dir; if (q.p > 1.05) q.p = -0.05; if (q.p < -0.05) q.p = 1.05;
        for (let k = 0; k < 40; k++) { const pp = q.p - dir * k * 0.004; const [x, y] = path(q.lane, pp); const a = 1 - k / 40; g.set(x, y, k === 0 ? '●' : '━', dir > 0 ? H(0, 0.3 + 0.6 * a) : H(48, 0.35 + 0.6 * a)); }
      }
      for (let x = 0; x < cols; x += Math.round(cols / 9)) for (let y = gy; y < gy + (rows - gy) * 0.9; y++) g.set(x, y, '║', C(0.12));
      return;
    }
    if (c.water) {
      const wy0 = c.bridge ? gy + 2 : gy;
      if (c.bridge) {
        const tx = [cols * 0.22, cols * 0.78], tt = Math.round(rows * 0.12), deck = gy;
        for (let x = 0; x < cols; x++) { g.set(x, deck, '▀', C(0.45)); g.set(x, deck + 1, '▀', C(0.2)); }
        for (const x of tx) for (let y = tt; y < rows * 0.9; y++) { g.set(x - 1, y, '█', H(10, 0.35 + 0.2 * day)); g.set(x + 1, y, '█', H(10, 0.35 + 0.2 * day)); if ((y - tt) % 6 === 0) g.set(x, y, '═', H(10, 0.35)); }
        const cable = x => { if (x < tx[0]) { const k = x / tx[0]; return tt + (deck - 2 - tt) * (1 - k) ** 2 * 0.95; } if (x > tx[1]) { const k = (cols - x) / (cols - tx[1]); return tt + (deck - 2 - tt) * (1 - k) ** 2 * 0.95; } const k = (x - tx[0]) / (tx[1] - tx[0]) * 2 - 1; return tt + (deck - 2 - tt) * 0.9 * (1 - k * k); };
        for (let x = 0; x < cols; x++) { const cy = cable(x); g.set(x, cy, '·', dark > 0.4 && x % 4 === 0 ? H(45, 0.9) : C(0.5)); if (x % 3 === 0) for (let y = Math.ceil(cy) + 1; y < deck; y++) g.set(x, y, '│', C(0.18)); }
        for (const car of s.cars) { car.x += car.v * dt * 1.5; if (car.x > cols + 3) car.x = -3; if (car.x < -3) car.x = cols + 3; g.set(car.x, deck - 1, '▄', dark > 0.3 ? (car.v > 0 ? H(0, 0.85) : H(50, 0.95)) : H(car.hue, 0.6)); }
      }
      for (let y = wy0; y < rows; y++) {
        const my = 2 * wy0 - y - 1, depth = (y - wy0) / (rows - wy0);
        for (let x = 0; x < cols; x++) {
          const sx = Math.round(x + Math.sin(y * 0.9 + t * 1.6) * (1 + depth * 2)), i = y * cols + x;
          if (my >= 0 && sx >= 0 && sx < cols && g.ch[my * cols + sx] !== ' ') { const src = g.ch[my * cols + sx], bright = src === '▪' || src === '•' || src === '·'; g.ch[i] = bright ? (hash(x, y) < 0.5 ? '-' : '~') : '░'; g.co[i] = dimHex(g.co[my * cols + sx], bright ? 0.65 : 0.45); }
          else if (hash(x, y + Math.floor(t * 2)) < 0.06) { g.ch[i] = '~'; g.co[i] = H(210, 0.12 + 0.15 * day); }
        }
      }
      if (c.boats) for (const b of s.boats) { b.x += b.v * dt; if (b.x > cols + 8) b.x = -8; if (b.x < -8) b.x = cols + 8; const y = Math.round(wy0 + (rows - wy0) * b.y); g.sprite(b.x, y - 1, ['  |  ', '▄███▄'], H(20, 0.4 + 0.2 * day)); if (dark > 0.3) g.set(b.x + 2, y - 2, '•', H(50, 1)); }
      return;
    }
    // 街道
    for (let x = 0; x < cols; x++) { g.set(x, gy, '▀', C(0.3 + 0.2 * day)); for (let y = gy + 1; y < rows; y++) g.set(x, y, y === gy + Math.round((rows - gy) / 2) && x % 6 < 3 ? '─' : ' ', C(0.3)); }
    if (c.lamps) for (let x = 4; x < cols; x += Math.round(cols / 12)) { for (let y = gy - 5; y < gy; y++) g.set(x, y, '│', C(0.35)); g.set(x, gy - 6, '╤', C(0.4)); if (dark > 0.3) { g.set(x, gy - 5, '●', H(45, 0.95)); for (let y = gy + 1; y < rows; y++) for (let k = -(y - gy); k <= y - gy; k++) if (hash(x + k, y) < 0.35) g.set(x + k, y, '░', H(45, 0.2 * dark)); } }
    if (c.cars) for (const car of s.cars) {
      car.x += car.v * dt; if (car.x > cols + 6) car.x = -6; if (car.x < -6) car.x = cols + 6;
      const y = car.v > 0 ? rows - 2 : gy + 1 + Math.max(0, Math.round((rows - gy) / 2) - 2), dir = Math.sign(car.v);
      g.sprite(car.x, y, rows >= 50 ? [' ▄██▄ ', '▀●▀▀●▀'] : ['▄█▄'], H(car.hue, 0.45 + 0.2 * day));
      if (dark > 0.3) { const fx = dir > 0 ? car.x + (rows >= 50 ? 6 : 3) : car.x - 1, bx = dir > 0 ? car.x - 1 : car.x + (rows >= 50 ? 6 : 3); g.set(fx, y, '►◄'[dir > 0 ? 0 : 1], H(50, 1)); g.set(bx, y, '■', H(0, 0.85)); }
    }
  } });

/* ════════════ 15. 小小風景 ════════════ */
const SC = {};
function stars(g, f, n, maxY, lvl) { for (let k = 0; k < n; k++) { const x = hash(k, 11) * f.cols, y = hash(k, 12) * maxY, b = hash(k, 13); g.set(x, y, b > 0.93 ? '+' : '.', f.C(lvl * (0.4 + 0.6 * b) * (0.7 + 0.3 * Math.sin(f.t * (1 + b * 2) + k)))); } }
function ridge(g, f, base, amp, freq, seed, ch, colFn, scroll, bottom) {
  for (let x = 0; x < f.cols; x++) { const h = amp * (0.5 + 0.5 * Noise.fbm((x + (scroll || 0)) * freq, seed, 0, 3)), top = Math.round(base - h); for (let y = Math.max(0, top); y < (bottom || f.rows); y++) g.set(x, y, y === top ? '▄' : ch, colFn(y - top, x)); }
}
// ── 燈塔 ──
SC.lighthouse = {
  init(s, f) { s.ships = [{ x: -20, v: 3 }]; s.fog = Array.from({ length: 5 }, () => ({ x: rnd(0, f.cols), y: rnd(0.4, 0.7) * f.rows, w: rnd(0.1, 0.2) * f.cols, v: rnd(0.5, 1.5) })); },
  frame(s, f) {
    const { g, cols, rows, C, H, t, dt } = f, A = f.aspect, sea = Math.round(rows * 0.62);
    stars(g, f, (cols * rows) / 50, sea, 0.45);
    drawMoon(g, f, cols * 0.15, rows * 0.16 * A, Math.max(2, rows * 0.06) * A * 0.9, 11, 0);
    // 海
    for (let y = sea; y < rows; y++) { const d = (y - sea) / (rows - sea); for (let x = 0; x < cols; x++) { const w = Math.sin(x * 0.15 / (1 + d * 2) + t * 1.2 + y * 1.7) + Math.sin(x * 0.05 - t * 0.6 + y); if (w > 0.9) g.set(x, y, w > 1.5 ? '~' : '-', H(215, 0.18 + 0.2 * d)); } }
    // 月光倒影
    for (let y = sea; y < rows; y++) for (let k = -3; k <= 3; k++) { const x = cols * 0.15 + k * (1 + (y - sea) * 0.4) + Math.sin(y * 2 + t * 2) * 1.5; if (hash(Math.round(x), y + Math.floor(t * 3)) < 0.4) g.set(x, y, '-', C(0.55)); }
    // 船
    for (const sh of s.ships) { sh.x += sh.v * dt * (cols / 160); if (sh.x > cols + 20) { sh.x = -20; sh.v = rnd(2, 4); } const y = sea + 2; g.sprite(sh.x, y - 2, ['   |   ', ' __|__ ', '\\_____/'.replace(/\\/g, BS)], C(0.25)); g.set(sh.x + 3, y - 3, '•', H(0, 0.9)); g.set(sh.x + 1, y - 1, '·', H(50, 0.8)); g.set(sh.x + 5, y - 1, '·', H(50, 0.8)); }
    // 懸崖
    const cx0 = cols * 0.66;
    for (let x = Math.floor(cx0); x < cols; x++) { const k = (x - cx0) / (cols - cx0), top = Math.round(sea - rows * 0.22 * Math.min(1, k * 3) - Noise.n3(x * 0.1, 2, 0) * 2); for (let y = top; y < rows; y++) g.set(x, y, y === top ? '▄' : hash(x, y) < 0.15 ? '▓' : '█', H(30, 0.07 + (y === top ? 0.05 : 0))); }
    // 燈塔
    const lx = Math.round(cols * 0.8), base = Math.round(sea - rows * 0.22), th = Math.round(rows * 0.3), tw = Math.max(3, Math.round(th * A * 0.12));
    for (let r = 0; r < th; r++) { const w = Math.round(tw * (1.2 - 0.4 * (r / th))), y = base - r; for (let k = -w; k <= w; k++) g.set(lx + k, y, '█', Math.floor(r / Math.max(2, th / 6)) % 2 ? H(0, 0.55) : C(0.85)); }
    const ly = base - th - 1;
    for (let k = -tw; k <= tw; k++) { g.set(lx + k, ly + 1, '▀', C(0.4)); g.set(lx + k, ly - 2, '▄', H(0, 0.5)); }
    const ang = t * 0.9, cs = Math.cos(ang), sn = Math.sin(ang);
    g.set(lx, ly, sn > 0.6 ? '█' : '●', H(50, 0.7 + 0.3 * Math.max(0, sn))); g.set(lx - 1, ly, '│', C(0.5)); g.set(lx + 1, ly, '│', C(0.5));
    // 光束：側面時長、正對時短
    const len = Math.abs(cs) * cols * 0.85, dir = Math.sign(cs) || 1, spread = 0.09;
    for (let d = 2; d < len; d += 1) {
      const half = d * spread, y0 = ly - half / A * 0.6, y1 = ly + half / A * 0.6, x = lx + dir * d, a = 1 - d / (len + 1);
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) { if (y >= sea && hash(Math.round(x), y) < 0.7) continue; const core = Math.abs(y - ly) < (y1 - y0) * 0.2 + 0.5; g.set(x, y, core ? '▒' : '░', H(50, (core ? 0.45 : 0.25) * a + 0.05)); }
    }
    if (sn > 0.85) for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; g.set(lx + Math.cos(a) * 3, ly + Math.sin(a) * 1.4, '·', H(50, (sn - 0.85) * 6)); }
    // 霧
    for (const fg of s.fog) { fg.x += fg.v * dt; if (fg.x > cols + fg.w) fg.x = -fg.w; for (let yy = -1; yy <= 1; yy++) for (let xx = -fg.w; xx <= fg.w; xx++) if (hash(Math.round(fg.x + xx), Math.round(fg.y + yy)) < 0.25 * (1 - Math.abs(xx / fg.w))) g.set(fg.x + xx, fg.y + yy, '░', C(0.15)); }
  },
};
// ── 火車經過 ──
SC.train = {
  init(s, f) { s.trX = f.cols + 10; s.kind = 0; s.wait = 1; s.puffs = []; },
  frame(s, f) {
    const { g, cols, rows, C, H, t, dt } = f, A = f.aspect, rail = Math.round(rows * 0.72), big = rows >= 50;
    // 黃昏天空
    for (let y = 0; y < rail; y++) for (let x = 0; x < cols; x++) { const k = y / rail; if (hash(x, y) < 0.08 + k * 0.25) g.set(x, y, '░', H(20 + (1 - k) * 230, 0.08 + k * 0.18)); }
    const sx = cols * 0.7, sr = rows * 0.12; dRing(g, f, sx, rows * 0.45 * A, 0, sr * A * 0.9, 0, TAU, (a, k) => [k > 0.8 ? '▓' : '█', H(25, 0.75)]);
    ridge(g, f, rows * 0.62, rows * 0.3, 0.008, 1.3, '█', d => H(270, 0.12), 0, rail + 1);
    ridge(g, f, rows * 0.7, rows * 0.16, 0.015, 4.2, '█', d => H(250, 0.16), 0, rail + 1);
    // 鐵橋（高架）
    for (let x = 0; x < cols; x++) { g.set(x, rail + 1, '═', C(0.45)); g.set(x, rail + 2, x % 12 < 1 ? '║' : x % 6 === 0 ? '┼' : '─', C(0.3)); }
    for (let x = 4; x < cols; x += 12) for (let y = rail + 3; y < rows; y++) g.set(x, y, '║', C(0.3));
    for (let y = rail + 3; y < rows; y++) for (let x = 0; x < cols; x++) if (g.ch[y * cols + x] === ' ' && hash(x, y + Math.floor(t)) < 0.05) g.set(x, y, '~', H(210, 0.2));
    // 電線桿
    for (let x = 8; x < cols; x += Math.round(cols / 6)) { for (let y = Math.round(rail - rows * 0.25); y <= rail; y++) g.set(x, y, '│', C(0.35)); g.set(x - 1, Math.round(rail - rows * 0.25), '┬', C(0.35)); g.set(x + 1, Math.round(rail - rows * 0.25), '┬', C(0.35)); }
    for (let x = 0; x < cols; x++) { const k = ((x - 8) % Math.round(cols / 6) + Math.round(cols / 6)) % Math.round(cols / 6) / Math.round(cols / 6); g.set(x, Math.round(rail - rows * 0.25 + 1 + Math.sin(k * Math.PI) * 1.5), '·', C(0.25)); }
    // 火車
    if (s.wait > 0) { s.wait -= dt; if (s.wait <= 0) { s.trX = cols + 5; s.kind = (s.kind + 1) % 3; } }
    else {
      const sp = [cols * 0.11, cols * 0.18, cols * 0.09][s.kind]; s.trX -= sp * dt;
      const carW = big ? 22 : 12, carH = big ? 5 : 3, n = s.kind === 2 ? 12 : 7, len = n * (carW + 1) + carW;
      for (let k = 0; k <= n; k++) {
        const x0 = Math.round(s.trX + k * (carW + 1)); if (x0 > cols || x0 + carW < 0) continue;
        const loco = k === 0, top = rail - carH;
        for (let r = 0; r < carH; r++) for (let c = 0; c < carW; c++) {
          let ch = '█', col;
          if (loco) { col = s.kind === 0 ? C(0.25) : H(200, 0.55); if (s.kind === 0 && r < carH - 2 && c > carW * 0.55) continue; if (s.kind === 1 && c < 3 && r < 2) { ch = '▄'; } }
          else if (s.kind === 2) col = H((k * 47) % 360, 0.4 + (c % 4 === 0 ? -0.1 : 0));
          else { const win = r === 1 && c % 3 !== 0 && c > 0 && c < carW - 1; ch = win ? '▪' : '█'; col = win ? H(45, 0.9) : H(s.kind === 0 ? 10 : 200, 0.5 + (r === 0 ? 0.1 : 0)); }
          g.set(x0 + c, top + r, ch, col);
        }
        const wheelP = Math.floor(s.trX) % 2;
        for (let c = 2; c < carW - 1; c += Math.max(3, carW / 4)) g.set(x0 + c, rail, wheelP ? 'o' : 'O', C(0.6));
        if (loco && s.kind === 0) { const cx = x0 + 3; g.set(cx, top - 1, '█', C(0.3)); g.set(cx, top - 2, '▄', C(0.3)); if (Math.random() < dt * 12) s.puffs.push({ x: cx, y: top - 3, l: 2.5, r: 0.5 }); }
        if (loco) g.set(x0 - 1, rail - 1, '◄', H(50, 1));
      }
      if (s.trX + len < -5) s.wait = rnd(2, 4);
    }
    for (let k = s.puffs.length - 1; k >= 0; k--) { const q = s.puffs[k]; q.l -= dt; q.y -= dt * 2; q.x += dt * 4; q.r += dt * 1.5; if (q.l <= 0) { s.puffs.splice(k, 1); continue; } for (let a = 0; a < TAU; a += 0.6) g.set(q.x + Math.cos(a) * q.r * A * 0.6, q.y + Math.sin(a) * q.r * 0.5, q.l > 1.5 ? 'O' : 'o', C(0.2 + 0.15 * q.l)); }
  },
};
// ── 螞蟻農場 ──
SC.ants = {
  init(s, f) {
    const { cols, rows } = f;
    s.x0 = Math.round(cols * 0.08); s.x1 = Math.round(cols * 0.92); s.top = Math.round(rows * 0.28); s.bot = rows - 3; s.W = s.x1 - s.x0; s.Hh = s.bot - s.top;
    s.soil = new Uint8Array(s.W * s.Hh).fill(1); s.dist = new Int16Array(s.W * s.Hh); s.q = new Int32Array(s.W * s.Hh);
    for (let x = 0; x < s.W; x++) s.soil[x] = 0;
    s.ants = Array.from({ length: Math.round(s.W / 6) }, () => ({ x: rint(0, s.W - 1), y: 0, carry: 0, dx: pick([-1, 1]), ph: rnd(0, 1) }));
    s.pile = new Float32Array(s.W); s.recalc = 0; s.dug = 0; s.age = 0;
  },
  bfs(s) {
    const { W, Hh, soil, dist, q } = s; dist.fill(32000); let h = 0, t = 0;
    for (let x = 0; x < W; x++) if (!soil[x]) { dist[x] = 0; q[t++] = x; }
    while (h < t) { const c = q[h++], x = c % W, y = (c / W) | 0, d = dist[c] + 1; for (const [dx, dy] of CH_D) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; const n = Y * W + X; if (soil[n] || dist[n] <= d) continue; dist[n] = d; q[t++] = n; } }
  },
  frame(s, f) {
    const { g, cols, rows, C, H, t, dt } = f, W = s.W, Hh = s.Hh;
    s.age += dt; s.recalc -= dt; if (s.recalc <= 0) { s.recalc = 0.4; this.bfs(s); }
    if (s.dug > W * Hh * 0.3 || s.age > 240) this.init(s, f);
    const steps = Math.max(1, Math.round(dt * 14));
    for (let it = 0; it < steps; it++) for (const a of s.ants) {
      const i = a.y * W + a.x;
      if (a.carry) { // 往地面走
        let best = null, bd = s.dist[i]; for (const [dx, dy] of CH_D) { const X = a.x + dx, Y = a.y + dy; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; const n = Y * W + X; if (!s.soil[n] && s.dist[n] < bd) { bd = s.dist[n]; best = [X, Y]; } }
        if (best) { a.x = best[0]; a.y = best[1]; } else if (a.y === 0) { a.carry = 0; s.pile[a.x] = Math.min(Math.max(1, Math.round(f.rows * 0.12) - 2), s.pile[a.x] + 0.35); a.dx = pick([-1, 1]); }
        else if (a.y > 0) { a.y--; }
        continue;
      }
      // 探索：偏好往深處走，碰到土就挖
      const opts = [];
      for (const [dx, dy] of CH_D) { const X = a.x + dx, Y = a.y + dy; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; const n = Y * W + X; const wgt = (dy > 0 ? 2.2 : dy < 0 ? 0.5 : 1.3) * (dx === a.dx ? 1.5 : 1) * (s.soil[n] ? 0.22 : 1); opts.push([X, Y, n, wgt]); }
      let tot = 0; for (const o of opts) tot += o[3]; let r = Math.random() * tot, ch = opts[0];
      for (const o of opts) { r -= o[3]; if (r <= 0) { ch = o; break; } }
      if (!ch) continue;
      if (s.soil[ch[2]]) {
        // 只挖「旁邊幾乎都是土」的格子，隧道才會細細長長
        let open = 0; for (const [dx, dy] of CH_D) { const X = ch[0] + dx, Y = ch[1] + dy; if (X >= 0 && Y >= 0 && X < W && Y < Hh && !s.soil[Y * W + X]) open++; }
        if ((ch[1] > 0 || a.y === 0) && (open <= 1 || Math.random() < 0.04)) { s.soil[ch[2]] = 0; s.dug++; a.carry = 1; }
      }
      else { a.x = ch[0]; a.y = ch[1]; if (ch[0] !== a.x) a.dx = Math.sign(ch[0] - a.x) || a.dx; }
      if (Math.random() < 0.02) a.dx = -a.dx;
    }
    // 天空與草
    for (let y = 0; y < s.top; y++) for (let x = 0; x < cols; x++) if (hash(x, y) < 0.05) g.set(x, y, '·', H(200, 0.25));
    for (let x = 0; x < W - 1; x++) { const d = s.pile[x] - s.pile[x + 1]; if (Math.abs(d) > 0.5) { const m = d * 0.3; s.pile[x] -= m; s.pile[x + 1] += m; } }
    for (let x = 0; x < W; x++) {
      const ph = s.pile[x];
      for (let k = 0; k < ph; k++) g.set(s.x0 + x, s.top - 1 - k, ph - k < 0.5 ? '▄' : '█', H(30, 0.33 + 0.07 * hash(x, k)));
      if (hash(x, 3) < 0.45) g.set(s.x0 + x, s.top - 1 - Math.floor(ph + 0.5), Math.sin(t * 1.5 + x * 0.7) > 0 ? '"' : "'", H(110, 0.55));
    }
    // 土
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const n = y * W + x, X = s.x0 + x, Y = s.top + y;
      if (s.soil[n]) { const hh = hash(x, y); g.set(X, Y, hh < 0.15 ? '▓' : hh < 0.3 ? '▒' : '█', H(28 + hh * 10, 0.22 + 0.1 * hh - (y / Hh) * 0.06)); }
      else if (y > 0) g.set(X, Y, ' ', C(0));
    }
    for (const a of s.ants) { const X = s.x0 + a.x, Y = s.top + a.y; g.set(X, Y, 'ж', a.carry ? H(10, 0.75) : C(0.85)); if (a.carry) g.set(X + (a.dx > 0 ? 1 : -1), Y, '·', H(35, 0.6)); }
    // 玻璃框
    box(g, s.x0 - 1, s.top - Math.round(rows * 0.12), W + 2, s.Hh + Math.round(rows * 0.12) + 1, C(0.55), true);
    for (let x = -2; x < W + 2; x++) g.set(s.x0 + x, s.bot + 1, '▀', H(25, 0.4));
    txt(g, s.x0, s.bot + 2, tr(f, '螞蟻農場　已挖出 ' + s.dug + ' 粒土', 'Ant farm  ' + enN(s.dug, 'grain') + ' of soil dug'), C(0.5));
  },
};
// ── 雨夜窗邊 ──
SC.window = {
  init(s, f) {
    const { cols, rows } = f;
    s.wx0 = Math.round(cols * 0.08); s.wx1 = Math.round(cols * 0.6); s.wy0 = Math.round(rows * 0.08); s.wy1 = Math.round(rows * 0.66);
    s.drops = Array.from({ length: Math.round(((s.wx1 - s.wx0) * (s.wy1 - s.wy0)) / 40) }, () => ({ x: rnd(s.wx0, s.wx1), y: rnd(s.wy0, s.wy1), v: 0, m: rnd(0.2, 1), tr: [] }));
    s.bokeh = Array.from({ length: 30 }, () => ({ x: rnd(s.wx0, s.wx1), y: rnd(s.wy0 + 4, s.wy1), r: rnd(1.5, 4) * (rows / 40), hue: pick([45, 30, 200, 330, 0, 120]), ph: rnd(0, TAU) }));
    s.steam = []; s.flash = 0; s.nextF = rnd(20, 40);
  },
  frame(s, f) {
    const { g, cols, rows, C, H, t, dt } = f, A = f.aspect;
    s.nextF -= dt; if (s.nextF <= 0) { s.nextF = rnd(25, 45); s.flash = 0.25; } s.flash = Math.max(0, s.flash - dt);
    // 房間牆面（檯燈的暖光從右下擴散）
    const lx = cols * 0.8, ly = rows * 0.7;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const d = Math.hypot((x - lx) / A, y - ly) / rows; const v = Math.max(0, 0.22 - d * 0.3); if (hash(x, y) < 0.5) g.set(x, y, '░', H(30, v + 0.03)); }
    // 窗外
    for (let y = s.wy0; y < s.wy1; y++) for (let x = s.wx0; x < s.wx1; x++) g.set(x, y, ' ', C(0));
    for (const b of s.bokeh) { const tw = 0.6 + 0.4 * Math.sin(t * 0.8 + b.ph); dRing(g, f, b.x, b.y * A, b.r * 0.6, b.r, 0, TAU, (a, k, x, y) => (x >= s.wx0 && x < s.wx1 && y >= s.wy0 && y < s.wy1 ? ['○', H(b.hue, 0.25 * tw)] : null)); }
    for (let x = s.wx0; x < s.wx1; x++) { const h = rows * (0.1 + 0.12 * hash(Math.floor(x / 5), 9)); for (let y = Math.round(s.wy1 - h); y < s.wy1; y++) g.set(x, y, (y % 2 && x % 3 === 1 && hash(x, y) < 0.4) ? '▪' : '█', (y % 2 && x % 3 === 1 && hash(x, y) < 0.4) ? H(45, 0.35) : C(0.06 + (s.flash > 0.1 ? 0.2 : 0))); }
    if (s.flash > 0.12) for (let y = s.wy0; y < s.wy1; y++) for (let x = s.wx0; x < s.wx1; x++) if (g.ch[y * cols + x] === ' ') g.set(x, y, '░', C(0.25));
    // 玻璃上的雨滴
    for (const d of s.drops) {
      if (d.m > 0.7) { d.v = Math.min(14, d.v + dt * 10 * d.m); } else if (Math.random() < dt * 0.3) d.m += 0.15;
      d.y += d.v * dt; d.x += Math.sin(t * 3 + d.y) * dt * 0.5 * (d.v > 2 ? 1 : 0);
      if (d.v > 1) { d.tr.push([d.x, d.y]); if (d.tr.length > 10) d.tr.shift(); }
      if (d.y > s.wy1) { d.y = s.wy0; d.x = rnd(s.wx0, s.wx1); d.v = 0; d.m = rnd(0.2, 0.6); d.tr = []; }
      for (const [tx, ty] of d.tr) g.set(tx, ty, '│', C(0.25));
      g.set(d.x, d.y, d.m > 0.7 ? '●' : d.m > 0.45 ? '•' : '·', C(0.45 + d.m * 0.4));
    }
    // 窗框
    const fc = H(25, 0.35);
    for (let x = s.wx0 - 2; x <= s.wx1 + 1; x++) { g.set(x, s.wy0 - 1, '█', fc); g.set(x, s.wy1, '█', fc); g.set(x, s.wy1 + 1, '▀', H(25, 0.25)); g.set(x, Math.round((s.wy0 + s.wy1) / 2), '█', fc); }
    for (let y = s.wy0 - 1; y <= s.wy1; y++) { g.set(s.wx0 - 2, y, '█', fc); g.set(s.wx0 - 1, y, '█', fc); g.set(s.wx1, y, '█', fc); g.set(s.wx1 + 1, y, '█', fc); g.set(Math.round((s.wx0 + s.wx1) / 2), y, '█', fc); }
    // 書桌、檯燈、杯子
    const desk = Math.round(rows * 0.82);
    for (let x = 0; x < cols; x++) { g.set(x, desk, '▀', H(25, 0.4)); for (let y = desk + 1; y < rows; y++) g.set(x, y, '█', H(25, 0.14 + (y === desk + 1 ? 0.04 : 0))); }
    const lampX = Math.round(lx), sh = Math.max(3, Math.round(rows * 0.09));
    for (let r = 0; r < sh; r++) { const w = Math.round(2 + r * 1.6); for (let k = -w; k <= w; k++) g.set(lampX + k, desk - Math.round(rows * 0.35) + r, '█', H(40, 0.55 + 0.2 * (r / sh))); }
    for (let y = desk - Math.round(rows * 0.35) + sh; y < desk; y++) g.set(lampX + Math.round((y - (desk - rows * 0.35)) * 0.15), y, '│', C(0.4));
    for (let y = desk - Math.round(rows * 0.35) + sh; y < desk; y++) { const w = (y - (desk - rows * 0.35)) * 1.1; for (let k = -w; k <= w; k++) if (hash(lampX + k, y) < 0.4 && g.ch[y * cols + Math.round(lampX + k)] === '░') g.set(lampX + k, y, '░', H(45, 0.3)); }
    for (let k = -6; k <= 6; k++) g.set(lampX + k, desk - 1, '▄', H(40, 0.35));
    const mx = Math.round(cols * 0.66), mh = Math.max(2, Math.round(rows * 0.06));
    for (let r = 0; r < mh; r++) for (let k = 0; k < mh * 2; k++) g.set(mx + k, desk - mh + r, '█', H(200, 0.45));
    g.set(mx + mh * 2, desk - mh + 1, ')', H(200, 0.45));
    if (Math.random() < dt * 6) s.steam.push({ x: mx + rnd(1, mh * 2 - 1), y: desk - mh - 1, l: rnd(1.5, 3) });
    for (let k = s.steam.length - 1; k >= 0; k--) { const q = s.steam[k]; q.l -= dt; q.y -= dt * 2.5; q.x += Math.sin(t * 2 + k) * dt * 2; if (q.l <= 0) { s.steam.splice(k, 1); continue; } g.set(q.x, q.y, q.l > 2 ? '~' : q.l > 1 ? '~' : '·', C(0.2 + 0.1 * q.l)); }
  },
};
// ── 營火 ──
SC.campfire = {
  init(s, f) { s.sp = []; s.heat = new Float32Array(f.cols * f.rows); },
  frame(s, f) {
    const { g, cols, rows, C, H, t, dt } = f, A = f.aspect, gy = Math.round(rows * 0.8), fx = cols / 2, fw = Math.max(6, Math.round(cols * 0.09)), fh = Math.round(rows * 0.38);
    stars(g, f, (cols * rows) / 45, gy - rows * 0.2, 0.5);
    drawMoon(g, f, cols * 0.82, rows * 0.15 * A, Math.max(2, rows * 0.06) * A, 15, 0);
    // 樹林剪影
    for (let x = 0; x < cols; x++) { const k = Math.floor(x / 11), r = hash(k, 5), u = 1 - Math.abs((x / 11) - k - 0.5) * 2, h = rows * (0.2 + 0.3 * r) * Math.min(1, u * 1.6); if (Math.abs(x - fx) < cols * 0.25 && r < 0.8) continue; for (let y = Math.round(gy - h); y < gy; y++) g.set(x, y, '█', H(150, 0.07)); }
    // 帳篷
    const tx = cols * 0.25, th = Math.round(rows * 0.2);
    for (let r = 0; r < th; r++) { const w = (r + 1) * A * 0.75; for (let k = -w; k <= w; k++) g.set(tx + k, gy - th + r, Math.abs(k) < 1 && r > th * 0.4 ? ' ' : '█', H(20, 0.18 + 0.12 * Math.max(0, 1 - Math.abs(tx + k - fx) / cols * 3) * (0.8 + 0.2 * Math.sin(t * 9)))); }
    // 地面與火光
    const flick = 0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 13.3);
    for (let y = gy; y < rows; y++) for (let x = 0; x < cols; x++) { const d = Math.hypot((x - fx) / A, (y - gy) * 1.8) / (rows * 0.5); const v = Math.max(0, 0.35 - d * 0.5) * flick; g.set(x, y, hash(x, y) < 0.3 ? ',' : '█', H(25, 0.05 + v)); }
    // 火焰（以雜訊模擬）
    for (let y = gy - fh; y < gy; y++) for (let x = Math.round(fx - fw * 1.3); x <= fx + fw * 1.3; x++) {
      const v = (gy - y) / fh, dx = (x - fx) / fw, n = Noise.fbm(x * 0.25, y * 0.35 + t * 3, t, 3);
      const e = 1 - v * 1.2 - dx * dx * 1.4 + n * 0.8;
      if (e < 0.1) continue;
      g.set(x, y, e > 0.8 ? '@' : e > 0.6 ? '#' : e > 0.4 ? '*' : e > 0.25 ? '+' : '.', H(10 + e * 40, 0.4 + e * 0.6));
    }
    // 柴火
    for (let k = -fw; k <= fw; k++) { g.set(fx + k, gy, '█', H(20, 0.3)); g.set(fx + k * 0.8, gy - 1 + (Math.abs(k) > fw * 0.6 ? 1 : 0), k % 2 ? '═' : '█', H(20, 0.35)); }
    // 火星
    if (Math.random() < dt * 20) s.sp.push({ x: fx + rnd(-fw / 2, fw / 2), y: gy - fh * 0.5, vx: rnd(-2, 2), vy: -rnd(4, 10), l: rnd(1, 2.5) });
    for (let k = s.sp.length - 1; k >= 0; k--) { const p = s.sp[k]; p.l -= dt; p.x += (p.vx + Math.sin(t * 3 + k) * 2) * dt; p.y += p.vy * dt; if (p.l <= 0 || p.y < 0) { s.sp.splice(k, 1); continue; } g.set(p.x, p.y, p.l > 1.5 ? '*' : '·', H(30, 0.4 + p.l * 0.25)); }
  },
};
// ── 風車田 ──
SC.windmill = {
  init(s, f) { const { cols } = f; s.mills = [[0.2, 0.5, 1], [0.5, 0.45, 1.3], [0.78, 0.52, 0.9], [0.92, 0.58, 0.6]].map(([x, y, sc]) => ({ x: x * cols, y, sc, ph: rnd(0, TAU), v: rnd(0.6, 1) })); s.clouds = Array.from({ length: 5 }, () => ({ x: rnd(0, cols), y: rnd(0.05, 0.3), w: rnd(0.06, 0.12) })); },
  frame(s, f) {
    const { g, cols, rows, C, H, t, dt } = f, A = f.aspect;
    for (const c of s.clouds) { c.x += dt * cols * 0.008; if (c.x > cols * 1.15) c.x = -cols * 0.15; const cw = c.w * cols, cy = c.y * rows; for (let yy = -2; yy <= 1; yy++) for (let xx = -cw; xx <= cw; xx++) { const d = (xx / cw) ** 2 + ((yy + 0.5) / 2.3) ** 2; if (d < 1) g.set(c.x + xx, cy + yy, d < 0.45 ? '▒' : '░', C(0.2 + 0.15 * (1 - d))); } }
    dRing(g, f, cols * 0.88, rows * 0.13 * A, 0, rows * 0.07 * A, 0, TAU, () => ['█', H(50, 0.9)]);
    ridge(g, f, rows * 0.6, rows * 0.18, 0.006, 2.1, '█', d => H(120, 0.2));
    // 花田條紋
    const fy = Math.round(rows * 0.62), HU = [0, 50, 330, 280, 20, 60];
    for (let y = fy; y < rows; y++) { const k = (y - fy) / (rows - fy); for (let x = 0; x < cols; x++) { const band = Math.floor((x - cols / 2) / (2 + k * 18) + 100) % HU.length, row = (x - cols / 2) % (2 + k * 18); g.set(x, y, Math.abs(row) < 0.8 + k * 2 ? '▓' : hash(x, y) < 0.5 ? '"' : '\'', Math.abs(row) < 0.8 + k * 2 ? H(110, 0.25 + k * 0.1) : H(HU[band], 0.35 + k * 0.35)); } }
    for (const m of s.mills) {
      const h = rows * 0.28 * m.sc, bx = m.x, by = rows * m.y + h * 0.35, top = by - h, w0 = h * 0.18 * A, w1 = h * 0.1 * A;
      for (let y = Math.round(top); y < by; y++) { const k = (y - top) / h, w = lerp(w1, w0, k); for (let x = Math.round(bx - w); x <= bx + w; x++) g.set(x, y, '█', Math.abs(x - bx) > w - 1 ? C(0.6) : C(0.8)); }
      g.set(bx, by - h * 0.25, '▀', H(25, 0.5));
      m.ph += dt * m.v; const L = h * 0.75, hx = bx, hy = top + 1;
      for (let k = 0; k < 4; k++) {
        const a = m.ph + (k * Math.PI) / 2, ca = Math.cos(a), sa = Math.sin(a), sch = segCh(ca, sa);
        for (let d = 1; d < L; d += 0.4) {
          const x = hx + ca * d, y = hy + (sa * d) / A, sail = d > L * 0.4;
          if (sail && h > 18) g.set(x - sa * 1.3, y + (ca * 1.3) / A, '▒', C(0.5));
          g.set(x, y, sail ? '▓' : sch, sail ? C(0.82) : C(0.55));
        }
      }
      g.set(hx, hy, '●', C(1));
    }
  },
};
// ── 摩天輪 ──
SC.ferris = {
  frame(s, f) {
    const { g, cols, rows, C, H, t } = f, A = f.aspect, R = Math.min(cols * 0.32, rows * A * 0.4), cx = cols * 0.5, cyv = rows * A * 0.47, gy = Math.round(rows * 0.9);
    stars(g, f, (cols * rows) / 45, rows * 0.5, 0.4);
    for (let x = 0; x < cols; x++) { const h = rows * (0.08 + 0.12 * hash(Math.floor(x / 6), 2)); for (let y = Math.round(gy - h); y < gy; y++) g.set(x, y, (y % 2 && x % 3 === 1 && hash(x, y) < 0.3) ? '▪' : '█', (y % 2 && x % 3 === 1 && hash(x, y) < 0.3) ? H(45, 0.35) : H(260, 0.08)); }
    // 支架
    for (const side of [-1, 1]) g.line(cx, cyv / A, cx + side * R * 0.55, gy, side < 0 ? '/' : BS, C(0.4));
    const rot = t * 0.12, n = 16;
    dRing(g, f, cx, cyv, R * 0.985, R * 1.02, 0, TAU, (a) => { const k = Math.floor(((a + rot) / TAU) * 64) % 64; const hue = (k * 22 + t * 60) % 360; return ['•', H(hue, 0.5 + 0.5 * Math.max(0, Math.sin(k * 0.8 - t * 4)))]; });
    dRing(g, f, cx, cyv, R * 0.5, R * 0.52, 0, TAU, () => ['·', C(0.35)]);
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * TAU, ex = cx + Math.cos(a) * R, ey = cyv + Math.sin(a) * R;
      for (let d = 0; d < R; d += 0.8) g.set(cx + Math.cos(a) * d, (cyv + Math.sin(a) * d) / A, segCh(Math.cos(a), Math.sin(a)), C(0.28));
      const gx = ex, gyy = ey / A + 1, hue = (k * 360) / n;
      g.sprite(gx - 2, gyy, ['▄▄▄', '█▪█'.replace('▪', '▪')], H(hue, 0.6)); g.set(gx - 1, gyy + 1, '▪', H(50, 0.9)); g.set(gx - 1, gyy - 1 + 0, '│', C(0.4));
    }
    dRing(g, f, cx, cyv, 0, Math.max(1.2, R * 0.05), 0, TAU, () => ['█', H(50, 0.8)]);
    // 地面燈串
    for (let x = 0; x < cols; x++) { const y = gy + 1 + Math.round(Math.sin(x * 0.12) * 0.8 + 0.8); g.set(x, gy, '▀', C(0.2)); if (x % 3 === 0) g.set(x, y, '•', H((x * 12 + t * 80) % 360, 0.5 + 0.4 * Math.sin(x + t * 3))); }
  },
};
// ── 熱氣球 ──
SC.balloon = {
  init(s, f) { const { cols, rows } = f; s.b = Array.from({ length: 6 }, (_, k) => ({ x: rnd(0, cols), y: rnd(0.15, 0.6) * rows, sc: rnd(0.5, 1.2), v: rnd(1.5, 4), ph: rnd(0, TAU), hues: [rnd(0, 360), rnd(0, 360)], burn: 0 })).sort((a, b) => a.sc - b.sc); },
  frame(s, f) {
    const { g, cols, rows, C, H, t, dt } = f, A = f.aspect;
    // 清晨天空與太陽
    for (let y = 0; y < rows * 0.6; y++) for (let x = 0; x < cols; x++) if (hash(x, y) < 0.12 + (y / rows) * 0.3) g.set(x, y, '░', H(30 + (1 - y / (rows * 0.6)) * 170, 0.12 + (y / rows) * 0.25));
    dRing(g, f, cols * 0.2, rows * 0.48 * A, 0, rows * 0.1 * A, 0, TAU, (a, k) => [k > 0.8 ? '▓' : '█', H(35, 0.8)]);
    ridge(g, f, rows * 0.62, rows * 0.3, 0.007, 7.7, '█', d => H(280, 0.13));
    ridge(g, f, rows * 0.75, rows * 0.2, 0.012, 3.3, '█', d => H(160, 0.16));
    ridge(g, f, rows * 0.9, rows * 0.15, 0.02, 9.1, '█', d => H(120, 0.22));
    // 河
    for (let y = Math.round(rows * 0.82); y < rows; y++) { const cxr = cols * 0.6 + Math.sin(y * 0.3) * cols * 0.05, w = (y - rows * 0.8) * 2.2; for (let x = Math.round(cxr - w); x <= cxr + w; x++) g.set(x, y, hash(x, y + Math.floor(t * 2)) < 0.3 ? '~' : '▒', H(200, 0.35)); }
    for (const b of s.b) {
      b.x += b.v * dt * b.sc; b.y += Math.sin(t * 0.3 + b.ph) * dt * 0.6; if (b.x > cols + 30) { b.x = -30; b.y = rnd(0.15, 0.55) * rows; }
      if (Math.random() < dt * 0.15) b.burn = 0.8; b.burn = Math.max(0, b.burn - dt);
      const R = rows * 0.12 * b.sc, cx = b.x, cyv = b.y * A;
      dRing(g, f, cx, cyv, 0, R * A * 0.5 * 2, 0, TAU, (a, k, x, y) => {
        const dy = ((y + 0.5) * A - cyv) / (R * A), dx = (x + 0.5 - cx) / (R * A);
        if (dy > 0.55 && Math.abs(dx) > (1 - dy) * 1.3) return null;
        const stripe = Math.floor((Math.atan2(dx, 0.8) / Math.PI) * 8 + 8) % 2, l = 0.4 + 0.35 * (1 - k) * (dx < 0 ? 1.1 : 0.85);
        return ['█', H(b.hues[stripe], l)];
      });
      const by = (cyv + R * A * 1.15) / A, bw = Math.max(1, Math.round(R * A * 0.18));
      for (const s2 of [-1, 1]) g.line(cx + s2 * R * A * 0.4, (cyv + R * A * 0.7) / A, cx + s2 * bw, by, '│', C(0.4));
      for (let k = -bw; k <= bw; k++) g.set(cx + k, by, '█', H(25, 0.35));
      if (b.burn > 0) g.set(cx, by - 1, b.burn > 0.4 ? '▲' : '^', H(30, 0.9));
    }
  },
};
A({ id: 'ga-scene', name: '小小風景', cat: '場景', theme: 'ocean', hue: true, desc: '懸崖燈塔的光束掃過夜海',
  params: { view: 'lighthouse' },
  variants: [
    { id: 'train', name: '黃昏列車', theme: 'sunset', desc: '夕陽下的鐵橋與經過的火車', params: { view: 'train' } },
    { id: 'ants', name: '螞蟻農場', theme: 'amber', desc: '玻璃缸裡螞蟻一粒粒挖隧道', params: { view: 'ants' } },
    { id: 'window', name: '雨夜窗邊', theme: 'lavender', desc: '雨滴滑過窗玻璃、檯燈亮著', params: { view: 'window' } },
    { id: 'campfire', name: '營火', theme: 'fire', desc: '星空下劈啪作響的營火', params: { view: 'campfire' } },
    { id: 'windmill', name: '風車花田', theme: 'mint', desc: '轉動的風車與彩色花田', params: { view: 'windmill' } },
    { id: 'ferris', name: '摩天輪', theme: 'neon', desc: '夜裡緩緩轉動的燈光摩天輪', params: { view: 'ferris' } },
    { id: 'balloon', name: '熱氣球', theme: 'gold', desc: '清晨山谷上飄過的熱氣球', params: { view: 'balloon' } },
  ],
  init(s, f) { s.V = SC[f.p.view]; if (s.V.init) s.V.init(s, f); },
  frame(s, f) { s.V.frame.call(s.V, s, f); } });

})();
