// 互動・棋盤（ix- 開頭）：踩地雷、記憶翻牌、井字棋、四子棋、黑白棋、五子棋。
// 只用滑鼠：移動、左鍵點一下、按住不放。沒人操作時電腦自己玩（示範），一動滑鼠就立刻交給玩家；
// 大約 6 秒沒有操作，電腦再接手。整個檔案包在函式裡，輔助函式不會和其他模組撞名。
(() => {
/* ════════════ 共用小工具 ════════════ */
const wideCh = c => { const k = c.codePointAt(0); return k >= 0x2e80 && k < 0xff61; };
// 寫字：全形字的第二格也清掉，底下的棋盤線才不會蓋住字的右半邊
function txt(g, x, y, s, col) {
  x = Math.floor(x);
  for (const c of s) { const w = wideCh(c); if (c !== ' ') { g.set(x, y, c, col); if (w) g.set(x + 1, y, ' ', col); } x += w ? 2 : 1; }
}
const ctxt = (g, cx, y, s, col) => txt(g, Math.floor(cx - g.textW(s) / 2), y, s, col);
// 介面語言：f.lang === 'en' 時畫英文，其他（含舊版沒有 f.lang）都畫中文
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
function fillRect(g, x0, y0, w, h, ch, col) {
  const xa = Math.max(0, Math.floor(x0)), xb = Math.min(g.cols, Math.floor(x0 + w));
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(g.rows, Math.floor(y0 + h));
  for (let y = ya; y < yb; y++) { let i = y * g.cols + xa; for (let x = xa; x < xb; x++, i++) { g.ch[i] = ch; g.co[i] = col; } }
}
const BOXL = ['┌', '┐', '└', '┘', '─', '│'], BOXH = ['╔', '╗', '╚', '╝', '═', '║'];
function box(g, x0, y0, w, h, col, heavy) {
  const B = heavy ? BOXH : BOXL;
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  for (let x = 1; x < w - 1; x++) { g.set(x0 + x, y0, B[4], col); g.set(x0 + x, y0 + h - 1, B[4], col); }
  for (let y = 1; y < h - 1; y++) { g.set(x0, y0 + y, B[5], col); g.set(x0 + w - 1, y0 + y, B[5], col); }
  g.set(x0, y0, B[0], col); g.set(x0 + w - 1, y0, B[1], col); g.set(x0, y0 + h - 1, B[2], col); g.set(x0 + w - 1, y0 + h - 1, B[3], col);
}
// 只畫四個角（游標、提示框）
function corners(g, x0, y0, w, h, col) {
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const x1 = x0 + w - 1, y1 = y0 + h - 1, arm = Math.max(0, Math.min(Math.floor(w / 4), 3)), av = Math.max(0, Math.min(Math.floor(h / 4), 1));
  g.set(x0, y0, '┌', col); g.set(x1, y0, '┐', col); g.set(x0, y1, '└', col); g.set(x1, y1, '┘', col);
  for (let k = 1; k <= arm; k++) { g.set(x0 + k, y0, '─', col); g.set(x1 - k, y0, '─', col); g.set(x0 + k, y1, '─', col); g.set(x1 - k, y1, '─', col); }
  for (let k = 1; k <= av; k++) { g.set(x0, y0 + k, '│', col); g.set(x1, y0 + k, '│', col); g.set(x0, y1 - k, '│', col); g.set(x1, y1 - k, '│', col); }
}
// 棋盤格線：nx × ny 格，每格 px 欄 × py 列
function lattice(g, x0, y0, nx, ny, px, py, col) {
  const W = nx * px, Hh = ny * py;
  for (let r = 0; r <= ny; r++) {
    const y = y0 + r * py, T = r === 0, B = r === ny;
    for (let x = 0; x <= W; x++) {
      let ch = '─';
      if (x % px === 0) { const L = x === 0, R = x === W; ch = T ? (L ? '┌' : R ? '┐' : '┬') : B ? (L ? '└' : R ? '┘' : '┴') : L ? '├' : R ? '┤' : '┼'; }
      g.set(x0 + x, y, ch, col);
    }
  }
  if (py > 1) for (let c = 0; c <= nx; c++) { const x = x0 + c * px; for (let y = 0; y <= Hh; y++) if (y % py) g.set(x, y0 + y, '│', col); }
}
const pad2 = n => String(n).padStart(2, '0');
const clock = t => pad2(Math.floor(t / 60)) + ':' + pad2(Math.floor(t % 60));
// 版面：右上角一行 HUD、底部中間一行提示，中間是遊戲區
const hudRow = f => (f.rows >= 40 ? 1 : 0);
const hintRow = f => f.rows - 1 - Math.max(1, Math.round(f.rows * 0.045));
function area(f) { const y0 = hudRow(f) + 2, y1 = hintRow(f) - 1; return { x0: 2, y0, w: f.cols - 4, h: Math.max(4, y1 - y0) }; }
function hud(g, f, s) {
  const w = g.textW(s), x = f.cols - w - 2, y = hudRow(f);
  fillRect(g, x - 1, y, w + 2, 1, ' ', f.C(0)); txt(g, x, y, s, f.C(0.62));
}
function hint(g, f, s) {
  const w = g.textW(s), y = hintRow(f), x = Math.floor((f.cols - w) / 2);
  fillRect(g, x - 1, y, w + 2, 1, ' ', f.C(0)); txt(g, x, y, s, f.C(0.36 + 0.09 * Math.sin(f.t * 2.2)));
}
// 置中的結果框；px、py：左右、上下多留的空白（大棋盤用，框才不會小得看不見）
function banner(g, cx, cy, lines, col, bcol, px = 0, py = 0) {
  let w = 0; for (const l of lines) w = Math.max(w, g.textW(l));
  w += 6 + 2 * px; const h = lines.length + 2 + 2 * py, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  fillRect(g, x0, y0, w, h, ' ', col); box(g, x0, y0, w, h, bcol, true);
  for (let k = 0; k < lines.length; k++) ctxt(g, x0 + w / 2, y0 + 1 + py + k, lines[k], col);
}
// 半格精度的形狀：fn(px, py) 以「欄寬」為單位、原點在範圍中心；回傳出現順序 0..1（畫的動畫用），不在形狀內回傳 -1
function mkMask(w, h, A, fn) {
  const m = { n: 0, dx: [], dy: [], a: [], b: [] };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - w / 2, a = fn(px, (y + 0.25 - h / 2) * A), b = fn(px, (y + 0.75 - h / 2) * A);
    if (a < 0 && b < 0) continue;
    m.dx.push(x); m.dy.push(y); m.a.push(a); m.b.push(b); m.n++;
  }
  return m;
}
// 只用整格的形狀：一格有 need/16 以上落在形狀裡就算（4×4 取樣，預設一半）。畫在有底色的檯面上用，邊緣比「上下兩半都在裡面」圓
function mkCover(w, h, A, fn, need = 8) {
  const m = { n: 0, dx: [], dy: [], a: [], b: [] };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (fn(x + (i + 0.5) / 4 - w / 2, (y + (j + 0.5) / 4 - h / 2) * A) >= 0) c++;
    if (c < need) continue;
    m.dx.push(x); m.dy.push(y); m.a.push(0); m.b.push(0); m.n++;
  }
  return m;
}
// p：畫到哪裡（0..1）；full：只畫上下兩半都在形狀裡的整格，true 用淡淡的 ░（預覽用），或直接給字元（例如 '█'）。
// 畫在有底色的檯面上要用整格：半格字元沒畫到的那一半會露出畫面背景色，不是檯面的顏色
function drawMask(g, m, x0, y0, col, p, full) {
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const fc = full === true ? '░' : full;
  for (let k = 0; k < m.n; k++) {
    const a = m.a[k], b = m.b[k], ta = a >= 0 && a <= p, tb = b >= 0 && b <= p;
    if (!ta && !tb) continue;
    if (fc) { if (ta && tb) g.set(x0 + m.dx[k], y0 + m.dy[k], fc, col); continue; }
    g.set(x0 + m.dx[k], y0 + m.dy[k], ta && tb ? '█' : ta ? '▀' : '▄', col);
  }
}
const discFn = (R, sx) => (px, py) => ((px / sx) * (px / sx) + py * py <= R * R ? 0 : -1);
// 有粗細的直線（半格精度）：r 是半徑，以「欄寬」為單位；座標是格子座標
function thickLine(g, x0, y0, x1, y1, r, A, col) {
  const dx = x1 - x0, dy = (y1 - y0) * A, L2 = dx * dx + dy * dy || 1e-9, r2 = r * r;
  const xa = Math.max(0, Math.floor(Math.min(x0, x1) - r - 1)), xb = Math.min(g.cols - 1, Math.ceil(Math.max(x0, x1) + r + 1));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1) - r / A - 1)), yb = Math.min(g.rows - 1, Math.ceil(Math.max(y0, y1) + r / A + 1));
  const inside = (px, py) => { const qx = px - x0, qy = (py - y0) * A, u = clamp((qx * dx + qy * dy) / L2, 0, 1), ex = qx - u * dx, ey = qy - u * dy; return ex * ex + ey * ey <= r2; };
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const a = inside(x + 0.5, y + 0.25), b = inside(x + 0.5, y + 0.75);
    if (a || b) g.set(x, y, a && b ? '█' : a ? '▀' : '▄', col);
  }
}
const glide = (o, tx, ty, dt, k) => { const a = 1 - Math.exp(-dt * k); o.x += (tx - o.x) * a; o.y += (ty - o.y) * a; };
const pulse = (t, sp) => 0.5 + 0.5 * Math.sin(t * sp);
// 回合制對局共用：示範時兩邊都由電腦下；有人操作時，玩家接手「現在輪到的那一方」，閒置後電腦再接回去
function takeover(s, f) {
  const playing = f.mouse.idle < 6;
  if (playing && s.human < 0) { s.human = s.over ? s.side : s.drop ? 1 - s.turn : s.turn; s.plan = -1; }   // 棋子還在落下時，交給下一手
  else if (!playing && s.human >= 0) { s.side = s.human; s.human = -1; s.plan = -1; }
  return playing;
}
function sideLabel(s, names, f, namesEn) {
  if (f.lang === 'en') {
    if (s.human < 0) return 'Demo game';
    return 'You: ' + namesEn[s.human] + (s.over ? '' : s.turn === s.human ? ' · your turn' : ' · CPU thinking…');
  }
  if (s.human < 0) return '示範對局';
  return '你是' + names[s.human] + (s.over ? '' : s.turn === s.human ? '・輪到你' : '・電腦思考中…');
}
function resultText(s, w, names) {
  if (w < 0) return '平手';
  if (s.human >= 0) return w === s.human ? '你贏了！' : '電腦贏了';
  return names[w] + ' 獲勝';
}
// 英文版的結果（和中文一起在對局結束時算好存起來，之後切換語言也不會變成另一種說法）
function resultEn(s, w, namesEn) {
  if (w < 0) return 'Draw';
  if (s.human >= 0) return w === s.human ? 'You win!' : 'CPU wins';
  return namesEn[w] + ' wins';
}
const NAMES_C4 = ['Red', 'Yellow'], NAMES_BW = ['Black', 'White'];
// 3×5 小點陣數字（大格子的踩地雷數字用）
const F3 = {
  '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'], '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'], '8': ['111', '101', '111', '101', '111'],
};
function bigDigit(g, d, x0, y0, sx, sy, col) {
  const gl = F3[d]; if (!gl) return;
  for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (gl[r][q] === '1') fillRect(g, x0 + q * sx, y0 + r * sy, sx, sy, '█', col);
}

/* ════════════ 1. 踩地雷 ════════════ */
const N8 = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1];
const NB1 = new Int32Array(8), NB2 = new Int32Array(8);
// 數字顏色：藍、紫在深藍底上偏暗，所以 1 改成偏青的藍，1 和 4 再調亮一點
const MS_HUE = [0, 200, 125, 355, 275, 20, 180, 310, 60], MS_LUM = [0, 0.86, 0.68, 0.8, 0.9, 0.8, 0.84, 0.88, 0.92];
const MS_HOLD = 0.45;   // 按住多久算插旗
function msNb(s, i, out) {
  const W = s.W, x = i % W, y = (i / W) | 0; let n = 0;
  for (let k = 0; k < 16; k += 2) { const X = x + N8[k], Y = y + N8[k + 1]; if (X >= 0 && Y >= 0 && X < W && Y < s.H) out[n++] = Y * W + X; }
  return n;
}
function msNew(s) {
  const n = s.W * s.H;
  s.mine = new Uint8Array(n); s.rev = new Uint8Array(n); s.flag = new Uint8Array(n); s.num = new Uint8Array(n);
  s.rt = new Float64Array(n).fill(-9);
  s.total = Math.min(n - 10, Math.round(n * s.dens));
  s.placed = false; s.left = n - s.total; s.state = 'play'; s.endT = 0; s.time = 0; s.flags = 0; s.boom = -1;
  s.flood = []; s.facc = 0; s.press = null; s.plan = -1; s.wait = 0; s.retry = 0; s.byUser = false;
}
function msPlace(s, safe) { // 第一下一定安全：點的那格和周圍都不放雷
  const n = s.W * s.H, ban = new Uint8Array(n); ban[safe] = 1;
  let k = msNb(s, safe, NB1); for (let j = 0; j < k; j++) ban[NB1[j]] = 1;
  let c = 0; while (c < s.total) { const i = (Math.random() * n) | 0; if (s.mine[i] || ban[i]) continue; s.mine[i] = 1; c++; }
  for (let i = 0; i < n; i++) { let m = 0; k = msNb(s, i, NB1); for (let j = 0; j < k; j++) m += s.mine[NB1[j]]; s.num[i] = m; }
  s.placed = true;
}
function msOpen(s, f, i) { // 翻開一格；踩到雷回傳 false
  if (s.state !== 'play' || s.rev[i] || s.flag[i]) return true;
  if (!s.placed) msPlace(s, i);
  s.rev[i] = 1; s.rt[i] = f.t;
  if (s.mine[i]) { s.state = 'lose'; s.boom = i; s.endT = 0; return false; }
  s.left--;
  if (!s.num[i]) s.flood.push(i);
  if (s.left <= 0) msWin(s);
  return true;
}
function msFloodStep(s, f) { // 一圈一圈往外翻
  const nf = [];
  for (const i of s.flood) {
    const k = msNb(s, i, NB1);
    for (let j = 0; j < k; j++) { const q = NB1[j]; if (s.rev[q] || s.flag[q]) continue; s.rev[q] = 1; s.rt[q] = f.t; s.left--; if (!s.num[q]) nf.push(q); }
  }
  s.flood = nf;
  if (s.left <= 0 && s.state === 'play') msWin(s);
}
function msWin(s) { s.state = 'win'; s.endT = 0; s.flood.length = 0; for (let i = 0; i < s.mine.length; i++) if (s.mine[i] && !s.flag[i]) { s.flag[i] = 1; s.flags++; } }
function msFlag(s, i) { if (s.rev[i] || s.state !== 'play') return; s.flag[i] ^= 1; s.flags += s.flag[i] ? 1 : -1; }
// 點一下：沒翻開的就翻開；已經翻開的數字、旗子數量對了就把周圍一次翻開
function msTap(s, f, i) {
  if (!s.rev[i]) { msOpen(s, f, i); return; }
  if (!s.num[i]) return;
  const k = msNb(s, i, NB2); let fl = 0;
  for (let j = 0; j < k; j++) fl += s.flag[NB2[j]];
  if (fl !== s.num[i]) return;
  const list = Array.from(NB2.subarray(0, k));
  for (const q of list) if (!s.rev[q] && !s.flag[q] && !msOpen(s, f, q)) return;
}
const msDist = (s, i) => Math.hypot((i % s.W) - s.gp.x, (((i / s.W) | 0) - s.gp.y) * 0.8);
// 離游標最近、插錯的旗子（玩家留下的）；沒有就回傳 -1
function msWrongFlag(s) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < s.W * s.H; i++) if (s.flag[i] && !s.mine[i] && !s.rev[i]) { const d = msDist(s, i); if (d < bd) { bd = d; best = i; } }
  return best;
}
// 電腦：先找確定的（數字 = 旗數 → 其餘安全；數字 = 旗數 + 未知數 → 全是雷），挑離游標最近的；找不到才猜
// 回傳 [格子, 動作, 要不要猶豫]；動作 0 翻開、1 插旗、2 拔掉旗子
function msPlan(s) {
  const n = s.W * s.H;
  if (!s.placed) return [clamp(Math.floor(s.H / 2 + rnd(-2, 2)), 0, s.H - 1) * s.W + clamp(Math.floor(s.W / 2 + rnd(-5, 5)), 0, s.W - 1), 0, 1];
  let best = -1, act = 0, bd = 1e9;
  // 玩家插錯的旗子：旁邊有翻開的 0，或某個數字周圍的旗子比數字還多 → 一定有插錯的，拔掉一支（拔哪支用真實答案挑，免得拔掉對的又插回去）
  for (let i = 0; i < n; i++) {
    if (!s.rev[i]) continue;
    const k = msNb(s, i, NB1); let fl = 0;
    for (let j = 0; j < k; j++) fl += s.flag[NB1[j]];
    if (fl <= s.num[i]) continue;
    for (let j = 0; j < k; j++) { const q = NB1[j]; if (!s.flag[q] || s.mine[q]) continue; const d = msDist(s, q); if (d < bd) { bd = d; best = q; } }
  }
  if (best >= 0) return [best, 2, 1];
  for (let i = 0; i < n; i++) {
    if (!s.rev[i] || !s.num[i]) continue;
    const k = msNb(s, i, NB1); let fl = 0, un = 0;
    for (let j = 0; j < k; j++) { const q = NB1[j]; if (s.flag[q]) fl++; else if (!s.rev[q]) un++; }
    if (!un) continue;
    const a = fl === s.num[i] ? 0 : fl + un === s.num[i] ? 1 : -1;
    if (a < 0) continue;
    for (let j = 0; j < k; j++) { const q = NB1[j]; if (s.flag[q] || s.rev[q]) continue; const d = msDist(s, q); if (d < bd) { bd = d; best = q; act = a; } }
  }
  if (best >= 0) return [best, act, 0];
  const sub = Math.random() < s.miss ? null : msSubset(s);   // 偶爾看漏比較難的推理，改用猜的（像人一樣）
  if (sub) return sub;
  if (s.flags > s.total) { const w = msWrongFlag(s); if (w >= 0) return [w, 2, 1]; }   // 旗子比地雷還多：一定有插錯的
  const unk = s.left + s.total - s.flags, base = (s.total - s.flags) / Math.max(1, unk);
  let bp = 9;
  for (let i = 0; i < n; i++) {
    if (s.rev[i] || s.flag[i]) continue;
    let pr = base; const k = msNb(s, i, NB1);
    for (let j = 0; j < k; j++) {
      const q = NB1[j]; if (!s.rev[q] || !s.num[q]) continue;
      const k2 = msNb(s, q, NB2); let fl = 0, un = 0;
      for (let m = 0; m < k2; m++) { const r = NB2[m]; if (s.flag[r]) fl++; else if (!s.rev[r]) un++; }
      pr = Math.max(pr, (s.num[q] - fl) / Math.max(1, un));
    }
    const sc = pr + msDist(s, i) * 0.003 + Math.random() * 0.05;
    if (sc < bp) { bp = sc; best = i; }
  }
  if (best < 0 && s.flags > 0) return [msWrongFlag(s), 2, 1];   // 沒翻開的都插了旗卻還沒過關 → 有旗子插錯了
  return [best, 0, 1];
}
// 進一步推理（子集合規則）：數字格 A 的未知鄰格全都在 B 的未知鄰格裡 → 多出來的那幾格共有 (B 剩餘雷數 − A 剩餘雷數) 顆雷
function msSubset(s) {
  const n = s.W * s.H, W = s.W, cons = [], at = s.conAt || (s.conAt = new Int32Array(n));
  at.fill(-1);
  for (let i = 0; i < n; i++) {
    if (!s.rev[i] || !s.num[i]) continue;
    const k = msNb(s, i, NB1), u = []; let fl = 0;
    for (let j = 0; j < k; j++) { const q = NB1[j]; if (s.flag[q]) fl++; else if (!s.rev[q]) u.push(q); }
    if (u.length) { at[i] = cons.length; cons.push({ i, u, rem: s.num[i] - fl }); }
  }
  let best = -1, act = 0, bd = 1e9;
  for (const A of cons) {
    const ax = A.i % W, ay = (A.i / W) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = ax + dx, Y = ay + dy;
      if ((!dx && !dy) || X < 0 || Y < 0 || X >= W || Y >= s.H) continue;
      const bi = at[Y * W + X]; if (bi < 0) continue;
      const B = cons[bi];
      if (B.u.length <= A.u.length || !A.u.every(c => B.u.includes(c))) continue;
      const diff = B.u.filter(c => !A.u.includes(c)), dm = B.rem - A.rem;
      const a = dm === 0 ? 0 : dm === diff.length ? 1 : -1;
      if (a < 0) continue;
      for (const q of diff) { const d = msDist(s, q); if (d < bd) { bd = d; best = q; act = a; } }
    }
  }
  return best >= 0 ? [best, act, 0] : null;
}
function msAt(s, x, y) {
  const tx = Math.floor((x - s.x0) / s.cw), ty = Math.floor((y - s.y0) / s.chh);
  return x >= s.x0 && y >= s.y0 && tx < s.W && ty < s.H ? ty * s.W + tx : -1;
}
A({ id: 'ix-mines', name: '踩地雷', cat: '益智', theme: 'blueprint', hue: true, interactive: true,
  desc: '點一下翻開格子、按住不放插旗；沒人玩時電腦自己推理',
  params: { rowsT: 16, wMax: 30, dens: 0.155, speed: 1, miss: 0.2 },
  variants: [
    { id: 'hard', name: '高手雷區', theme: 'matrix', desc: '格子更小、地雷更密的大雷區；點一下翻開，按住插旗', params: { rowsT: 22, wMax: 46, dens: 0.2, speed: 1.5, miss: 0.08 } },
  ],
  init(s, f) {
    const a = area(f), p = f.p;
    s.chh = Math.max(1, Math.floor(a.h / p.rowsT)); s.cw = Math.max(2, Math.round(s.chh * f.aspect));
    s.H = Math.min(p.rowsT, Math.floor(a.h / s.chh));
    s.W = Math.max(8, Math.min(p.wMax, Math.floor((a.w * 0.8) / s.cw)));
    if (s.W * s.cw > a.w) s.W = Math.floor(a.w / s.cw);
    s.x0 = a.x0 + Math.floor((a.w - s.W * s.cw) / 2); s.y0 = a.y0 + Math.floor((a.h - s.H * s.chh) / 2);
    s.dens = p.dens; s.miss = p.miss; s.gp = { x: s.W / 2, y: s.H / 2 };
    msNew(s);
  },
  frame(s, f) {
    const { g, C, H, dt, t, mouse } = f, p = f.p, playing = mouse.idle < 6;
    const W = s.W, cw = s.cw, chh = s.chh, n = W * s.H;
    let used = false;
    if (s.flood.length) { s.facc += dt; while (s.facc > 0.03 && s.flood.length) { s.facc -= 0.03; msFloodStep(s, f); } }
    if (s.state === 'play') { if (s.placed) s.time += dt; }
    else {
      s.endT += dt;
      if (s.endT > 4.5 || (playing && mouse.clicks.length && s.endT > 0.8)) { msNew(s); used = true; }
    }
    if (playing) {
      s.plan = -1;
      if (s.state === 'play' && !used) {
        for (const c of mouse.clicks) { if (c.button) continue; const i = msAt(s, c.x, c.y); if (i >= 0) s.press = { i, t0: t, done: false }; }
        const pr = s.press;
        if (pr) {
          if (!mouse.down) { if (!pr.done) msTap(s, f, pr.i); s.press = null; }
          else if (msAt(s, mouse.x, mouse.y) !== pr.i) s.press = null;   // 按著拖走就取消
          else if (!pr.done && !s.rev[pr.i] && t - pr.t0 >= MS_HOLD) { msFlag(s, pr.i); pr.done = true; }   // 數字格按多久都算點一下（一次翻開周圍）
        }
      } else s.press = null;
    } else if (s.state === 'play' && !s.flood.length) {
      // 示範：游標滑到目標格，停一下再動作（猜的時候猶豫久一點）
      s.press = null;
      if (s.plan >= 0 && (s.rev[s.plan] || (s.pact === 2) !== !!s.flag[s.plan])) s.plan = -1;   // 目標已經不需要了（拔旗的目標要還有旗子）
      if (s.plan < 0 && (s.retry -= dt) <= 0) {
        const r = msPlan(s); s.plan = r[0]; s.pact = r[1]; s.wait = r[2] ? rnd(0.35, 0.8) : rnd(0.04, 0.16);
        s.retry = s.plan < 0 ? 0.5 : 0;   // 想不出下一步就等一下再想，不要每格都重算
      }
      if (s.plan >= 0) {
        const tx = s.plan % W, ty = (s.plan / W) | 0;
        glide(s.gp, tx, ty, dt, 9 * p.speed);
        if (Math.abs(s.gp.x - tx) < 0.3 && Math.abs(s.gp.y - ty) < 0.3) {
          s.wait -= dt * p.speed;
          if (s.wait <= 0) { if (s.pact) msFlag(s, s.plan); else msOpen(s, f, s.plan); s.plan = -1; }
        }
      }
    } else s.press = null;
    // ── 畫 ──
    const lose = s.state === 'lose', win = s.state === 'win';
    const hov = playing && s.state === 'play' && mouse.on ? msAt(s, mouse.x, mouse.y) : -1;
    const ghost = !playing && s.state === 'play' ? Math.round(s.gp.y) * W + Math.round(s.gp.x) : -1;
    const press = s.press && !s.press.done ? s.press : null, pf = press ? Math.ceil(clamp((t - press.t0) / MS_HOLD, 0, 1) * (cw - 1)) : 0;
    const big = chh >= 7 && cw >= 9, dsy = big ? Math.floor((chh - 2) / 5) : 0, dsx = big ? Math.min(Math.round(dsy * f.aspect), Math.floor((cw - 3) / 3)) : 0;
    const flagC = H(5, 0.85), pc = H(15, 0.8);
    // 一格的形狀：右邊留半欄、下面留半列當縫；fill 欄以內改用 fc（按住插旗的進度）
    const tile = (X, Y, col, fill, fc) => {
      for (let yy = 0; yy < chh; yy++) {
        const last = chh > 1 && yy === chh - 1;
        for (let xx = 0; xx < cw; xx++) {
          const edge = xx === cw - 1;
          g.set(X + xx, Y + yy, last ? (edge ? '▘' : '▀') : edge ? '▌' : '█', xx < fill ? fc : col);
        }
      }
    };
    for (let i = 0; i < n; i++) {
      const tx = i % W, ty = (i / W) | 0, X = s.x0 + tx * cw, Y = s.y0 + ty * chh;
      const cx = X + ((cw - 2) >> 1), cy = Y + ((chh - 1) >> 1);   // 格子中心（最右一欄是縫）
      if (s.rev[i] && !s.mine[i]) { // 翻開的格子：暗暗的地板（翻開時從凸起的亮度慢慢沉下去）
        const v = s.num[i], age = clamp((t - s.rt[i]) / 0.3, 0, 1);
        tile(X, Y, C(0.1 + 0.18 * (1 - age)), 0, null);
        if (v) {
          const col = H(MS_HUE[v], MS_LUM[v] * (0.45 + 0.55 * age));
          if (big) bigDigit(g, String(v), X + Math.floor((cw - 1 - 3 * dsx) / 2), Y + Math.floor((chh - 5 * dsy) / 2), dsx, dsy, col);
          else g.set(cx, cy, String(v), col);
        }
        continue;
      }
      if (lose && s.mine[i] !== s.flag[i]) { // 輸了：沒標到的地雷、插錯的旗子（插對的旗子照常畫）
        const boom = i === s.boom;
        tile(X, Y, boom ? H(10, 0.32) : C(0.1), 0, null);
        if (s.flag[i]) g.set(cx, cy, 'x', C(0.6));
        else g.set(cx, cy, boom ? '@' : '*', boom ? H(10, 1) : C(0.85));
        continue;
      }
      let lum = 0.28 + ((tx + ty) & 1) * 0.05;
      if (win) lum = 0.24 + 0.22 * Math.max(0, Math.sin(tx * 0.45 + ty * 0.3 - s.endT * 5));
      if (i === hov) lum = 0.5;
      if (i === ghost) lum = 0.48 + 0.12 * pulse(t, 7);
      tile(X, Y, C(lum), press && press.i === i ? pf : 0, pc);
      if (s.flag[i]) {
        g.set(cx, cy, '▲', flagC);
        if (chh >= 3 && cw >= 6) { g.set(cx, cy + 1, '▀', C(0.85)); g.set(cx - 1, cy + 1, '▀', C(0.85)); g.set(cx + 1, cy + 1, '▀', C(0.85)); }
      }
    }
    // 雷區外框：右邊、下面剛好壓在最後一排格子的縫上，四邊離格子一樣遠
    box(g, s.x0 - 1, s.y0 - 1, W * cw + 1, s.H * chh + (chh > 1 ? 1 : 2), C(0.3));
    if (lose && s.endT < 2.2) { // 爆炸的圈
      const bx = s.x0 + (s.boom % W) * cw + cw / 2, by = s.y0 + ((s.boom / W) | 0) * chh + chh / 2, R = s.endT * Math.max(10, W * cw * 0.25);
      for (let k = 0; k < 48; k++) { const a = (k / 48) * TAU; g.set(bx + Math.cos(a) * R, by + (Math.sin(a) * R) / f.aspect, k & 1 ? '*' : '+', H(20 + k * 2, Math.max(0, 0.9 - s.endT / 2.4))); }
    }
    const bcx = s.x0 + (W * cw) / 2, bcy = s.y0 + (s.H * chh) / 2;
    if (win && s.endT > 0.4) banner(g, bcx, bcy, [tr(f, '全部清除！', 'All clear!'), tr(f, '用時 ', 'Time ') + clock(s.time)], C(1), C(0.7));
    if (lose && s.endT > 0.9) banner(g, bcx, bcy, [tr(f, '踩到地雷了', 'You hit a mine'), playing ? tr(f, '點一下重新開始', 'Click to start over') : tr(f, '馬上重來', 'New game coming up')], C(1), H(10, 0.75));
    hud(g, f, (playing ? '' : tr(f, '示範 │ ', 'Demo │ ')) + tr(f, '地雷 ', 'Mines ') + Math.max(0, s.total - s.flags) + ' │ ' + clock(s.time));
    if (!playing) hint(g, f, tr(f, '點一下翻開・按住不放插旗', 'Click to reveal · hold to flag'));
  },
});

/* ════════════ 2. 記憶翻牌 ════════════ */
// 7×7 點陣圖案；縮圖太小放不下時改用一個字元
const MM_SYM = [
  { c: '♥', h: 350, b: ['.......', '.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'] },
  { c: '*', h: 50, b: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '##...##'] },
  { c: '♦', h: 195, b: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'] },
  { c: ')', h: 225, b: ['..####.', '.###...', '###....', '###....', '###....', '.###...', '..####.'] },
  { c: '☼', h: 30, b: ['#..#..#', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '#..#..#'] },
  { c: '♪', h: 280, b: ['...##..', '...#.#.', '...#..#', '...#...', '.###...', '####...', '.##....'] },
  { c: '♣', h: 120, b: ['...#...', '..###..', '.#####.', '..###..', '.#####.', '#######', '...#...'] },
  { c: '⌂', h: 10, b: ['...#...', '..###..', '.#####.', '#######', '.##.##.', '.##.##.', '.##.##.'] },
  { c: 'α', h: 175, b: ['.......', '..##...', '.####.#', '#.#####', '.####.#', '..##...', '.......'] },
  { c: 'Ω', h: 38, b: ['#.....#', '##...##', '#######', '#.###.#', '#######', '##.#.##', '.#####.'] },
  { c: '♀', h: 60, b: ['.......', '.##....', '#..#...', '#..####', '#..#.#.', '.##..#.', '.......'] },
  { c: '†', h: 320, b: ['..###..', '.#####.', '#######', '...#...', '...#...', '.#.#...', '..#....'] },
  { c: 'ö', h: 255, b: ['..###..', '.#####.', '##.#.##', '#######', '#######', '#######', '#.#.#.#'] },
  { c: '‡', h: 205, b: ['..###..', '...#...', '.#####.', '...#...', '#..#..#', '##.#.##', '.#####.'] },
  { c: '§', h: 70, b: ['....##.', '...##..', '..##...', '.######', '...##..', '..##...', '.##....'] },
  { c: '♠', h: 0, b: ['..###..', '.#####.', '##.#.##', '#######', '..#.#..', '..#.#..', '..###..'] },
];
// 同樣的亮度下藍、紫看起來暗很多（月亮、幽靈、音符），這些色相加亮一點；配對完成的暗色也一起補
for (const sy of MM_SYM) sy.l = sy.h >= 215 && sy.h <= 295 ? 0.15 : sy.h >= 200 && sy.h < 215 ? 0.06 : 0;
function mmSymMask(bits, k, w, h) {
  const iw = w - 2, ih = h - 2, SW = 7 * k, SH = 7 * k;
  const ox = 1 + Math.floor((iw - SW) / 2), oh = 2 + Math.floor((2 * ih - SH) / 2);
  const m = { n: 0, dx: [], dy: [], ch: [] };
  const on = (hr, x) => { const r = Math.floor((hr - oh) / k), c = Math.floor(x / k); return hr >= oh && r < 7 && bits[r][c] === '#'; };
  for (let cy = Math.floor(oh / 2); cy <= Math.floor((oh + SH - 1) / 2); cy++) for (let x = 0; x < SW; x++) {
    const tp = on(2 * cy, x), bt = on(2 * cy + 1, x);
    if (!tp && !bt) continue;
    m.dx.push(ox + x); m.dy.push(cy); m.ch.push(tp && bt ? '█' : tp ? '▀' : '▄'); m.n++;
  }
  return m;
}
function mmNew(s, f) {
  const N = s.N, sym = [];
  const pool = MM_SYM.map((_, k) => k).sort(() => Math.random() - 0.5).slice(0, N / 2);
  for (const k of pool) sym.push(k, k);
  for (let i = N - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const tmp = sym[i]; sym[i] = sym[j]; sym[j] = tmp; }
  s.sym = Int8Array.from(sym); s.known = new Int8Array(N).fill(-1);
  s.fd = new Uint8Array(N); s.ft = new Float64Array(N).fill(-9); s.mt = new Float64Array(N).fill(-9);
  if (s.st) for (let i = 0; i < N; i++) if (s.st[i]) s.ft[i] = f.t;   // 上一局翻開的牌蓋回去
  s.st = new Uint8Array(N);
  s.open = []; s.hideT = 0; s.moves = 0; s.pairs = 0; s.time = 0; s.started = false; s.over = false; s.overT = 0; s.plan = -1; s.wait = 0.6;
}
function mmSee(s, i) { // 電腦的記憶不完美：有時沒記住，有時記錯位置
  if (Math.random() > s.memP) return;
  let j = i;
  if (Math.random() < 0.08) { const nb = [i - 1, i + 1, i - s.nc, i + s.nc].filter(q => q >= 0 && q < s.N && s.st[q] === 0); if (nb.length) j = pick(nb); }
  s.known[j] = s.sym[i];
}
function mmHide(s, f) { for (const i of s.open) { s.st[i] = 0; s.fd[i] = 0; s.ft[i] = f.t; } s.open.length = 0; s.hideT = 0; }
function mmPick(s, f, i) {
  if (s.over) return;
  if (s.open.length >= 2) mmHide(s, f);
  if (s.st[i] !== 0) return;
  s.started = true; s.st[i] = 1; s.fd[i] = 1; s.ft[i] = f.t; s.open.push(i);
  for (let k = 0; k < s.N; k++) if (s.known[k] >= 0 && Math.random() < 0.035) s.known[k] = -1;  // 慢慢忘記
  mmSee(s, i);
  if (s.open.length < 2) return;
  s.moves++;
  const a = s.open[0], b = s.open[1];
  if (s.sym[a] === s.sym[b]) {
    s.st[a] = s.st[b] = 2; s.mt[a] = s.mt[b] = f.t + 0.25; s.open.length = 0; s.pairs++;
    s.known[a] = s.known[b] = -1;
    if (s.pairs * 2 >= s.N) { s.over = true; s.overT = 0; s.byUser = f.mouse.idle < 6; }
  } else s.hideT = 1.0;
}
function mmChoose(s) {
  const down = [];
  for (let i = 0; i < s.N; i++) if (s.st[i] === 0) down.push(i);
  if (!down.length) return -1;
  if (s.open.length === 1) {
    const sy = s.sym[s.open[0]];
    for (const j of down) if (s.known[j] === sy) return j;
  } else {
    for (const i of down) { if (s.known[i] < 0) continue; for (const j of down) if (j !== i && s.known[j] === s.known[i]) return i; }
  }
  const unk = down.filter(i => s.known[i] < 0);
  return pick(unk.length ? unk : down);
}
const mmX = (s, i) => s.x0 + (i % s.nc) * (s.w + s.gx), mmY = (s, i) => s.y0 + ((i / s.nc) | 0) * (s.h + s.gy);
function mmAt(s, x, y) {
  for (let i = 0; i < s.N; i++) { const X = mmX(s, i), Y = mmY(s, i); if (x >= X && x < X + s.w && y >= Y && y < Y + s.h) return i; }
  return -1;
}
function mmCard(g, f, s, i, hl) {
  const { C, H, t } = f, w = s.w, h = s.h, x = mmX(s, i), y = mmY(s, i);
  const ph = (t - s.ft[i]) / 0.28, anim = ph >= 0 && ph < 1;
  const face = anim ? (ph < 0.5 ? !s.fd[i] : !!s.fd[i]) : s.st[i] > 0;
  if (anim) { // 翻牌：寬度縮成一條線再展開
    const ww = Math.max(1, Math.round(w * Math.abs(Math.cos(Math.PI * ph)))), xo = x + Math.floor((w - ww) / 2);
    if (ww < 3) { fillRect(g, xo, y, ww, h, '█', C(0.45)); return; }
    box(g, xo, y, ww, h, C(face ? 0.75 : 0.45));
    if (!face) fillRect(g, xo + 1, y + 1, ww - 2, h - 2, '▒', C(0.22));
    return;
  }
  if (!face) {
    box(g, x, y, w, h, C(hl ? 0.62 + 0.25 * pulse(t, 6) : 0.42));
    const pc = C(hl ? 0.32 : 0.2);
    for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) g.set(x + xx, y + yy, (xx + yy) & 1 ? '╱' : '╲', pc);
    if (w >= 7 && h >= 5) g.set(x + (w >> 1), y + (h >> 1), '◆', C(hl ? 0.75 : 0.5));
    return;
  }
  const sy = MM_SYM[s.sym[i]], done = s.st[i] === 2, glow = done ? clamp(1 - (t - s.mt[i]) / 0.8, 0, 1) : 0;
  box(g, x, y, w, h, done ? C(0.26 + glow * 0.6) : C(hl ? 1 : 0.78));
  const col = H(sy.h, done ? 0.42 + sy.l * 1.4 + glow * 0.5 : 0.78 + sy.l);
  if (s.mk) { const m = s.mk[s.sym[i]]; for (let k = 0; k < m.n; k++) g.set(x + m.dx[k], y + m.dy[k], m.ch[k], col); }
  else g.set(x + ((w - 1) >> 1), y + ((h - 1) >> 1), sy.c, col);
}
A({ id: 'ix-memory', name: '記憶翻牌', cat: '益智', theme: 'lavender', hue: true, interactive: true,
  desc: '點牌翻開，一次翻兩張，找出相同的圖案；沒人玩時電腦憑記憶自己配對',
  params: { nc: 5, nr: 4, mem: 0.7 },
  variants: [
    { id: 'big', name: '大桌面', theme: 'sakura', desc: '8×4 共 16 對的大牌桌，記性要更好；點牌翻開', params: { nc: 8, nr: 4, mem: 0.8 } },
  ],
  init(s, f) {
    const a = area(f), p = f.p, A_ = f.aspect;
    s.nc = p.nc; s.nr = p.nr; s.N = p.nc * p.nr; s.memP = p.mem;
    s.gx = a.w > 150 ? 3 : 2; s.gy = a.h > 40 ? 2 : 1;
    let h = Math.floor((a.h - (s.nr - 1) * s.gy) / s.nr), w = Math.round((h * A_) / 1.35);
    if (w * s.nc + (s.nc - 1) * s.gx > a.w) { w = Math.floor((a.w - (s.nc - 1) * s.gx) / s.nc); h = Math.min(h, Math.round((w * 1.35) / A_)); }
    s.w = Math.max(3, w); s.h = Math.max(3, h);
    const TW = s.nc * s.w + (s.nc - 1) * s.gx, TH = s.nr * s.h + (s.nr - 1) * s.gy;
    s.x0 = a.x0 + Math.floor((a.w - TW) / 2); s.y0 = a.y0 + Math.floor((a.h - TH) / 2);
    const k = Math.floor(Math.min((s.w - 3) / 7, (2 * (s.h - 2) - 1) / 7));
    s.mk = k >= 1 ? MM_SYM.map(sy => mmSymMask(sy.b, k, s.w, s.h)) : null;
    s.gp = { x: (s.nc - 1) / 2, y: (s.nr - 1) / 2 };
    mmNew(s, f);
  },
  frame(s, f) {
    const { g, C, dt, t, mouse } = f, playing = mouse.idle < 6;
    let used = false;
    if (s.over) { s.overT += dt; if (s.overT > 4.5 || (playing && mouse.clicks.length && s.overT > 0.8)) { mmNew(s, f); used = true; } }
    else {
      if (s.started) s.time += dt;
      if (s.hideT > 0) { s.hideT -= dt; if (s.hideT <= 0) mmHide(s, f); }
    }
    if (playing) {
      s.plan = -1;
      if (!used && !s.over) for (const c of mouse.clicks) { if (c.button) continue; const i = mmAt(s, c.x, c.y); if (i >= 0) mmPick(s, f, i); else if (s.open.length >= 2) mmHide(s, f); }
    } else if (!s.over && s.open.length < 2) {
      if (s.plan < 0 || s.st[s.plan] !== 0) { s.plan = mmChoose(s); s.wait = rnd(0.35, 0.75); }
      if (s.plan >= 0) {
        const tx = s.plan % s.nc, ty = (s.plan / s.nc) | 0;
        glide(s.gp, tx, ty, dt, 7);
        s.wait -= dt;
        if (s.wait <= 0 && Math.abs(s.gp.x - tx) < 0.2 && Math.abs(s.gp.y - ty) < 0.2) { mmPick(s, f, s.plan); s.plan = -1; }
      }
    }
    const hov = playing && mouse.on && !s.over ? mmAt(s, mouse.x, mouse.y) : -1;
    const ghost = !playing && !s.over ? Math.round(s.gp.y) * s.nc + Math.round(s.gp.x) : -1;
    for (let i = 0; i < s.N; i++) mmCard(g, f, s, i, i === hov || i === ghost);
    const TW = s.nc * s.w + (s.nc - 1) * s.gx, TH = s.nr * s.h + (s.nr - 1) * s.gy;
    if (s.over && s.overT > 0.6) banner(g, s.x0 + TW / 2, s.y0 + TH / 2, [s.byUser ? tr(f, '你完成了！', 'You did it!') : tr(f, '全部配對完成！', 'All pairs found!'), s.moves + tr(f, ' 步 · ', ' moves · ') + clock(s.time)], C(1), C(0.7));
    hud(g, f, (playing ? '' : tr(f, '示範 │ ', 'Demo │ ')) + tr(f, '步數 ', 'Moves ') + s.moves + tr(f, ' │ 配對 ', ' │ Pairs ') + s.pairs + '/' + s.N / 2 + ' │ ' + clock(s.time));
    if (!playing) hint(g, f, tr(f, '點兩張牌，翻出相同的圖案', 'Click two cards to find a matching pair'));
  },
});

/* ════════════ 3. 井字棋 ════════════ */
const TL = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tLine(b, who) { for (const l of TL) if (b[l[0]] === who && b[l[1]] === who && b[l[2]] === who) return l; return null; }
const TMEMO = new Int8Array(19683 * 2).fill(-128);
function tKey(b) { let k = 0; for (let i = 8; i >= 0; i--) k = k * 3 + b[i] + 1; return k; }
// 一般規則：完整搜尋（記憶表整個遊戲共用），回傳「輪到 who」的評分：贏 > 0（越快越高）、輸 < 0、和 0
function tSolve(b, who) {
  const key = tKey(b) * 2 + who;
  if (TMEMO[key] !== -128) return TMEMO[key];
  let best = -100, any = false, empty = 0;
  for (let i = 0; i < 9; i++) if (b[i] < 0) empty++;
  for (let i = 0; i < 9; i++) {
    if (b[i] >= 0) continue; any = true;
    b[i] = who;
    const v = tLine(b, who) ? 10 + empty : -tSolve(b, 1 - who);
    b[i] = -1;
    if (v > best) best = v;
  }
  if (!any) best = 0;
  TMEMO[key] = best;
  return best;
}
// 三子輪替：每人最多三子，下第四子時最舊的那顆消失
function tPlay(b, q, who, i, fade) { b[i] = who; q[who].push(i); let r = -1; if (fade && q[who].length > 3) { r = q[who].shift(); b[r] = -1; } return r; }
function tUndo(b, q, who, i, r) { b[i] = -1; q[who].pop(); if (r >= 0) { b[r] = who; q[who].unshift(r); } }
function tFade(b, q, who, depth, alpha, beta) {
  let best = -1000;
  for (let i = 0; i < 9; i++) {
    if (b[i] >= 0) continue;
    const r = tPlay(b, q, who, i, true);
    const v = tLine(b, who) ? 100 + depth : depth <= 1 ? 0 : -tFade(b, q, 1 - who, depth - 1, -beta, -alpha);
    tUndo(b, q, who, i, r);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best === -1000 ? 0 : best;
}
function tChoose(s, p) {
  const b = s.b, who = s.turn, opp = 1 - who, empties = [];
  for (let i = 0; i < 9; i++) if (b[i] < 0) empties.push(i);
  if (empties.length === 9) return pick([0, 2, 6, 8, 4, 4, 4, 1, 3]);
  const sloppy = Math.random() < p.err;   // 偶爾只看一步，看不出「雙殺」
  let best = -1e9, cands = [];
  for (const i of empties) {
    let v;
    if (p.fade) {
      const r = tPlay(b, s.q, who, i, true);
      v = tLine(b, who) ? 1000 : -tFade(b, s.q, opp, sloppy ? 2 : 6, -1e9, 1e9);
      tUndo(b, s.q, who, i, r);
    } else {
      b[i] = who;
      if (tLine(b, who)) v = 1000;
      else if (sloppy) { v = 0; for (const j of empties) if (j !== i) { b[j] = opp; if (tLine(b, opp)) v = -500; b[j] = -1; } }
      else v = -tSolve(b, opp);
      b[i] = -1;
    }
    if (v > best) { best = v; cands = [i]; } else if (v === best) cands.push(i);
  }
  return pick(cands);
}
const tX = (s, i) => s.x0 + (i % 3) * (s.cw + 1), tY = (s, i) => s.y0 + ((i / 3) | 0) * (s.chh + 1);
function tCell(s, x, y) {
  const cx = Math.floor((x - s.x0) / (s.cw + 1)), cy = Math.floor((y - s.y0) / (s.chh + 1));
  return x >= s.x0 && y >= s.y0 && cx < 3 && cy < 3 ? cy * 3 + cx : -1;
}
function tNew(s) {
  s.b = new Int8Array(9).fill(-1); s.q = [[], []]; s.pt = new Float64Array(9).fill(-9);
  s.turn = s.first; s.first ^= 1; s.over = null; s.overT = 0; s.plan = -1; s.n = 0; s.gone = null;
}
function tMove(s, f, i) {
  const who = s.turn, r = tPlay(s.b, s.q, who, i, f.p.fade);
  s.pt[i] = f.t; s.n++; s.plan = -1;
  if (r >= 0) s.gone = { i: r, who, t: f.t };
  const l = tLine(s.b, who), names = ['X', 'O'];
  if (l) { s.over = { w: who, l, t: f.t, msg: resultText(s, who, names), msgEn: resultEn(s, who, names) }; s.score[who]++; }
  else if ((!f.p.fade && s.n >= 9) || (f.p.fade && s.n >= 40)) { s.over = { w: -1, l: null, t: f.t, msg: '平手', msgEn: 'Draw' }; s.score[2]++; }
  else s.turn = 1 - who;
  s.overT = 0;
}
A({ id: 'ix-tictactoe', name: '井字棋', cat: '益智', theme: 'cyber', hue: true, interactive: true,
  desc: '點空格畫下你的記號，和電腦比一局井字棋；沒人玩時電腦自己對下',
  params: { fade: 0, err: 0.3 },
  variants: [
    { id: 'fade', name: '三子輪替', theme: 'synth', desc: '每人只留三子，下第四子時最舊的會消失；點空格下子', params: { fade: 1, err: 0.25 } },
  ],
  init(s, f) {
    const a = area(f), A_ = f.aspect;
    let H = a.h, W = Math.round(H * A_);
    if (W > a.w) { W = a.w; H = Math.floor(W / A_); }
    s.cw = Math.max(3, Math.floor((W - 2) / 3)); s.chh = Math.max(1, Math.floor((H - 2) / 3));
    s.W = s.cw * 3 + 2; s.H = s.chh * 3 + 2;
    s.x0 = a.x0 + Math.floor((a.w - s.W) / 2); s.y0 = a.y0 + Math.floor((a.h - s.H) / 2);
    const cw = s.cw, chh = s.chh, R = Math.min(cw, chh * A_) * 0.33, th = Math.max(0.6, R * 0.17);
    s.th = th;
    // 叉：兩筆斜線（先左上到右下，再右上到左下）；圈：從頂端順時針
    const seg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, u = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1); return [Math.hypot(px - ax - u * dx, py - ay - u * dy), u]; };
    s.mx = mkMask(cw, chh, A_, (px, py) => {
      const [d1, u1] = seg(px, py, -R, -R, R, R), [d2, u2] = seg(px, py, R, -R, -R, R);
      const a1 = d1 <= th ? u1 * 0.5 : 9, a2 = d2 <= th ? 0.5 + u2 * 0.5 : 9, v = Math.min(a1, a2);
      return v > 1 ? -1 : v;
    });
    s.mo = mkMask(cw, chh, A_, (px, py) => (Math.abs(Math.hypot(px, py) - R) <= th ? ((Math.atan2(px, -py) / TAU) + 1) % 1 : -1));
    s.score = [0, 0, 0]; s.human = -1; s.side = 0; s.first = 0; s.gp = { x: 1, y: 1 };
    tNew(s);
  },
  frame(s, f) {
    const { g, C, H, dt, t, mouse } = f, p = f.p, names = ['X', 'O'];
    const playing = takeover(s, f);
    if (s.over) {
      s.overT += dt;
      if (s.overT > 3.6 || (playing && mouse.clicks.length && s.overT > 0.6)) tNew(s);
    } else if (s.human === s.turn) {
      for (const c of mouse.clicks) { if (c.button) continue; const i = tCell(s, c.x, c.y); if (i >= 0 && s.b[i] < 0) { tMove(s, f, i); break; } }
    } else {
      if (s.plan < 0) { s.plan = tChoose(s, p); s.wait = rnd(0.6, 1.2); }
      glide(s.gp, s.plan % 3, (s.plan / 3) | 0, dt, 5);
      s.wait -= dt;
      if (s.wait <= 0) tMove(s, f, s.plan);
    }
    // ── 畫 ──
    const cw = s.cw, chh = s.chh, lc = C(0.36);
    for (let y = 0; y < s.H; y++) { g.set(s.x0 + cw, s.y0 + y, '┃', lc); g.set(s.x0 + 2 * cw + 1, s.y0 + y, '┃', lc); }
    for (let x = 0; x < s.W; x++) {
      const ch = x === cw || x === 2 * cw + 1 ? '╋' : '━';
      g.set(s.x0 + x, s.y0 + chh, ch, lc); g.set(s.x0 + x, s.y0 + 2 * chh + 1, ch, lc);
    }
    if (s.gone && t - s.gone.t < 0.45) drawMask(g, s.gone.who ? s.mo : s.mx, tX(s, s.gone.i), tY(s, s.gone.i), C(0.3), 1 - (t - s.gone.t) / 0.45);
    const wl = s.over && s.over.l;
    for (let i = 0; i < 9; i++) {
      const v = s.b[i]; if (v < 0) continue;
      let lum = v ? 0.66 : 0.92;
      if (s.over) lum *= wl && wl.includes(i) ? 0.9 + 0.12 * Math.sin(t * 6) : 0.5;
      else if (p.fade && v === s.turn && s.q[v].length === 3 && s.q[v][0] === i) lum *= 0.45 + 0.2 * pulse(t, 5);   // 下一手就要消失
      drawMask(g, v ? s.mo : s.mx, tX(s, i), tY(s, i), v ? H(330, lum) : H(185, lum), clamp((t - s.pt[i]) / 0.35, 0, 1));
    }
    let hi = -1;
    if (!s.over) {
      if (s.human === s.turn) {
        hi = mouse.on ? tCell(s, mouse.x, mouse.y) : -1;
        if (hi >= 0 && s.b[hi] >= 0) hi = -1;
        if (hi >= 0) drawMask(g, s.turn ? s.mo : s.mx, tX(s, hi), tY(s, hi), C(0.2), 1, chh >= 4);
      } else if (s.plan >= 0) hi = Math.round(s.gp.y) * 3 + Math.round(s.gp.x);
    }
    if (hi >= 0 && cw >= 5 && chh >= 3) corners(g, tX(s, hi) + 1, tY(s, hi) + (chh >= 6 ? 1 : 0), cw - 2, chh - (chh >= 6 ? 2 : 0), C(0.45 + 0.3 * pulse(t, 5)));
    if (wl) { // 連線
      const pr = clamp((t - s.over.t) / 0.4, 0, 1);
      const ax = tX(s, wl[0]) + cw / 2, ay = tY(s, wl[0]) + chh / 2, bx = tX(s, wl[2]) + cw / 2, by = tY(s, wl[2]) + chh / 2;
      const ex = (bx - ax) * 0.18, ey = (by - ay) * 0.18, sx = ax - ex, sy = ay - ey, dx = bx + ex - sx, dy = by + ey - sy;
      if (chh >= 8) thickLine(g, sx, sy, sx + dx * pr, sy + dy * pr, Math.max(1, s.th * 0.75), f.aspect, C(1));   // 大棋盤：和記號的筆畫差不多粗
      else {
        const ch = Math.abs(dy) < 0.5 ? '━' : Math.abs(dx) < 0.5 ? '┃' : (dx > 0) === (dy > 0) ? '╲' : '╱';
        g.line(sx, sy, sx + dx * pr, sy + dy * pr, ch, C(1));
      }
    }
    if (s.over && s.overT > 0.7) {
      const bp = chh >= 8;
      banner(g, s.x0 + s.W / 2, s.y0 + s.H / 2, [tr(f, s.over.msg, s.over.msgEn)], C(1), C(0.7), bp ? Math.round(cw * 0.22) : 0, bp ? Math.max(1, Math.round(chh * 0.125)) : 0);
    }
    hud(g, f, sideLabel(s, names, f, names) + ' │ X ' + s.score[0] + '  O ' + s.score[1] + tr(f, '  和 ', '  Draw ') + s.score[2]);
    if (!playing) hint(g, f, p.fade ? tr(f, '點空格下子，每人只留三子', 'Click an empty square · each side keeps only three marks') : tr(f, '點空格下子，和電腦比一局', 'Click an empty square to play against the computer'));
  },
});

/* ════════════ 4. 四子棋 ════════════ */
const C4D = [1, 0, 0, 1, 1, 1, 1, -1];
function c4Count(b, nc, nr, c, r, dx, dy, who) { let k = 0, x = c + dx, y = r + dy; while (x >= 0 && y >= 0 && x < nc && y < nr && b[y * nc + x] === who) { k++; x += dx; y += dy; } return k; }
function c4Wins(b, nc, nr, c, r, who) {
  for (let d = 0; d < 8; d += 2) { const dx = C4D[d], dy = C4D[d + 1]; if (1 + c4Count(b, nc, nr, c, r, dx, dy, who) + c4Count(b, nc, nr, c, r, -dx, -dy, who) >= 4) return true; }
  return false;
}
function c4Line(b, nc, nr, c, r, who) {
  for (let d = 0; d < 8; d += 2) {
    const dx = C4D[d], dy = C4D[d + 1], a = c4Count(b, nc, nr, c, r, -dx, -dy, who), z = c4Count(b, nc, nr, c, r, dx, dy, who);
    if (1 + a + z >= 4) { const out = []; for (let k = -a; k <= z; k++) out.push((r + dy * k) * nc + c + dx * k); return out; }
  }
  return null;
}
// 評分：每個「連四窗口」裡自己/對手的子數；對手已有三子又輪到他，扣得比較重
function c4Eval(s, who) {
  const b = s.b, W4 = s.w4; let sc = 0;
  for (let k = 0; k < W4.length; k += 4) {
    let m = 0, o = 0;
    for (let j = 0; j < 4; j++) { const v = b[W4[k + j]]; if (v === who) m++; else if (v >= 0) o++; }
    if (m && o) continue;
    if (m === 3) sc += 5; else if (m === 2) sc += 2; else if (o === 3) sc -= 7; else if (o === 2) sc -= 2;
  }
  const cc = s.nc >> 1;
  for (let r = 0; r < s.nr; r++) { const v = b[r * s.nc + cc]; if (v === who) sc += 3; else if (v >= 0) sc -= 3; }
  return sc;
}
function c4Neg(s, who, depth, alpha, beta) {
  const { b, h, nc, nr } = s; let best = -1e9, any = false;
  for (const c of s.order) {
    if (h[c] >= nr) continue; any = true;
    const r = nr - 1 - h[c], i = r * nc + c;
    b[i] = who; h[c]++;
    const v = c4Wins(b, nc, nr, c, r, who) ? 100000 + depth : depth <= 1 ? c4Eval(s, who) : -c4Neg(s, 1 - who, depth - 1, -beta, -alpha);
    b[i] = -1; h[c]--;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}
function c4Choose(s, p) {
  const who = s.turn, depth = Math.random() < p.err ? 2 : p.depth, { b, h, nc, nr } = s;
  let best = -1e9, bc = -1;
  for (const c of s.order) {
    if (h[c] >= nr) continue;
    const r = nr - 1 - h[c], i = r * nc + c;
    b[i] = who; h[c]++;
    let v = c4Wins(b, nc, nr, c, r, who) ? 1e6 : -c4Neg(s, 1 - who, depth - 1, -1e9, 1e9);
    b[i] = -1; h[c]--;
    v += rnd(0, 2.5);   // 同分時隨機一點，每局才不一樣
    if (v > best) { best = v; bc = c; }
  }
  return bc;
}
function c4New(s) {
  s.b = new Int8Array(s.nc * s.nr).fill(-1); s.h = new Uint8Array(s.nc);
  s.turn = s.first; s.first ^= 1; s.over = null; s.overT = 0; s.plan = -1; s.drop = null; s.n = 0; s.lt = new Float64Array(s.nc * s.nr).fill(-9);
}
function c4ColAt(s, x, y) {
  const c = Math.floor((x - s.bx) / s.px);
  return c >= 0 && c < s.nc && y >= s.by - s.py - 2 && y < s.by + s.nr * s.py + 2 ? c : -1;
}
function c4Land(s, f) {
  const d = s.drop, i = d.r * s.nc + d.c, names = ['紅', '黃'];
  s.b[i] = d.who; s.h[d.c]++; s.n++; s.drop = null; s.lt[i] = f.t;
  const l = c4Line(s.b, s.nc, s.nr, d.c, d.r, d.who);
  if (l) { s.over = { w: d.who, l, msg: resultText(s, d.who, names), msgEn: resultEn(s, d.who, NAMES_C4) }; s.score[d.who]++; s.overT = 0; }
  else if (s.n >= s.nc * s.nr) { s.over = { w: -1, l: null, msg: '平手', msgEn: 'Draw' }; s.score[2]++; s.overT = 0; }
  else s.turn = 1 - d.who;
}
A({ id: 'ix-connect4', name: '四子棋', cat: '益智', theme: 'ocean', hue: true, interactive: true,
  desc: '滑鼠移到某一欄、點一下投下棋子，先連成四個就贏',
  params: { nc: 7, nr: 6, depth: 4, err: 0.15, boardHue: 222 },
  variants: [
    { id: 'wide', name: '九欄寬盤', theme: 'sunset', desc: '9 欄 × 7 列的大棋盤，變化更多；點一欄投下棋子', params: { nc: 9, nr: 7, depth: 4, err: 0.18, boardHue: 268 } },
  ],
  init(s, f) {
    const a = area(f), A_ = f.aspect, p = f.p, nc = p.nc, nr = p.nr;
    let py = Math.max(2, Math.floor((a.h - 1) / (nr + 1))), px = Math.max(3, Math.round(py * A_));
    if (px * nc + 2 > a.w) { px = Math.max(3, Math.floor((a.w - 2) / nc)); py = Math.max(2, Math.round(px / A_)); }
    s.nc = nc; s.nr = nr; s.px = px; s.py = py;
    const BW = nc * px + 2, BH = (nr + 1) * py + 1;
    s.bx = a.x0 + Math.floor((a.w - BW) / 2) + 1; s.by = a.y0 + Math.floor((a.h - BH) / 2) + py;
    // 每個洞的形狀：板子的部分（洞以外）、棋子的部分（洞裡面）
    const R = Math.min(Math.min(px, py * A_) * 0.4, (px - 1.2) / 2), mb ={ n: 0, dx: [], dy: [], ch: [] }, md = { n: 0, dx: [], dy: [], ch: [] };
    for (let y = 0; y < py; y++) for (let x = 0; x < px; x++) {
      const qx = x + 0.5 - px / 2, it = qx * qx + ((y + 0.25 - py / 2) * A_) ** 2 <= R * R, ib = qx * qx + ((y + 0.75 - py / 2) * A_) ** 2 <= R * R;
      const bc = !it && !ib ? '█' : it && !ib ? '▄' : !it && ib ? '▀' : null, dc = it && ib ? '█' : it ? '▀' : ib ? '▄' : null;
      if (bc) { mb.dx.push(x); mb.dy.push(y); mb.ch.push(bc); mb.n++; }
      if (dc) { md.dx.push(x); md.dy.push(y); md.ch.push(dc); md.n++; }
    }
    s.mb = mb; s.md = md;
    const w4 = [];
    for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) for (let d = 0; d < 8; d += 2) {
      const dx = C4D[d], dy = C4D[d + 1], ec = c + dx * 3, er = r + dy * 3;
      if (ec < 0 || ec >= nc || er < 0 || er >= nr) continue;
      for (let k = 0; k < 4; k++) w4.push((r + dy * k) * nc + c + dx * k);
    }
    s.w4 = Int16Array.from(w4);
    s.order = Array.from({ length: nc }, (_, c) => c).sort((u, v) => Math.abs(u - (nc - 1) / 2) - Math.abs(v - (nc - 1) / 2));
    s.score = [0, 0, 0]; s.human = -1; s.side = 0; s.first = 0; s.gc = (nc - 1) / 2;
    c4New(s);
  },
  frame(s, f) {
    const { g, C, H, dt, t, mouse } = f, p = f.p, names = ['紅', '黃'];
    const playing = takeover(s, f);
    if (s.drop) {
      const d = s.drop; d.v += 40 * dt; d.y += d.v * dt;
      if (d.y >= d.r) { d.y = d.r; if (d.v > 7 && !d.bn) { d.v = -d.v * 0.22; d.bn = 1; } else c4Land(s, f); }
    } else if (s.over) {
      s.overT += dt;
      if (s.overT > 4 || (playing && mouse.clicks.length && s.overT > 0.7)) c4New(s);
    } else if (s.human === s.turn) {
      for (const c of mouse.clicks) { if (c.button) continue; const col = c4ColAt(s, c.x, c.y); if (col >= 0 && s.h[col] < s.nr) { s.drop = { c: col, r: s.nr - 1 - s.h[col], who: s.turn, y: -1, v: 3, bn: 0 }; break; } }
    } else {
      if (s.plan < 0) { s.plan = c4Choose(s, p); s.wait = rnd(0.45, 1.0); }
      s.gc += (s.plan - s.gc) * (1 - Math.exp(-dt * 6));
      s.wait -= dt;
      if (s.wait <= 0 && Math.abs(s.gc - s.plan) < 0.12) { s.drop = { c: s.plan, r: s.nr - 1 - s.h[s.plan], who: s.turn, y: -1, v: 3, bn: 0 }; s.gc = s.plan; s.plan = -1; }
    }
    // ── 畫 ──
    const { bx, by, px, py, nc, nr } = s;
    const pcol = (who, lum) => (who ? H(48, lum * 0.92) : H(356, lum * 0.66));
    const hov = s.human === s.turn && !s.over && !s.drop && mouse.on ? c4ColAt(s, mouse.x, mouse.y) : -1;
    const bc = H(p.boardHue, 0.36), bch = H(p.boardHue, 0.46), wl = s.over && s.over.l;
    for (let y = 0; y < nr * py; y++) { g.set(bx - 1, by + y, '█', bc); g.set(bx + nc * px, by + y, '█', bc); }
    for (let x = -1; x <= nc * px; x++) g.set(bx + x, by + nr * py, '▀', bc);
    for (let c = 0; c < nc; c++) {
      const col = c === hov ? bch : bc;
      for (let r = 0; r < nr; r++) {
        const X = bx + c * px, Y = by + r * py, i = r * nc + c, v = s.b[i];
        for (let k = 0; k < s.mb.n; k++) g.set(X + s.mb.dx[k], Y + s.mb.dy[k], s.mb.ch[k], col);
        if (v < 0) continue;
        let lum = 1;
        if (s.over) lum = wl && wl.includes(i) ? 0.85 + 0.25 * pulse(t, 7) : 0.55;
        const pc = pcol(v, lum);
        for (let k = 0; k < s.md.n; k++) g.set(X + s.md.dx[k], Y + s.md.dy[k], s.md.ch[k], pc);
        if (t - s.lt[i] < 0.35 && px >= 5) g.set(X + (px >> 1), Y + ((py - 1) >> 1), '◦', C(1));
      }
    }
    if (s.drop) { // 落下中的棋子（畫在板子前面）
      const d = s.drop, X = bx + d.c * px, Y = by + Math.round(d.y * py), pc = pcol(d.who, 1);
      for (let k = 0; k < s.md.n; k++) g.set(X + s.md.dx[k], Y + s.md.dy[k], s.md.ch[k], pc);
    } else if (!s.over) { // 上方的預覽棋子：玩家跟著滑鼠，電腦慢慢滑到想下的那一欄
      const gc = hov >= 0 ? hov : s.human === s.turn ? -1 : s.gc;
      if (gc >= 0) {
        const X = Math.round(bx + gc * px), Y = by - py, pc = pcol(s.turn, 0.45 + 0.25 * pulse(t, 5));
        for (let k = 0; k < s.md.n; k++) g.set(X + s.md.dx[k], Y + s.md.dy[k], s.md.ch[k], pc);
      }
    }
    if (s.over && s.overT > 0.8) banner(g, bx + (nc * px) / 2, by + (nr * py) / 2, [tr(f, s.over.msg, s.over.msgEn)], C(1), C(0.75));
    hud(g, f, sideLabel(s, names, f, NAMES_C4) + tr(f, ' │ 紅 ', ' │ Red ') + s.score[0] + tr(f, '  黃 ', '  Yellow ') + s.score[1] + tr(f, '  和 ', '  Draw ') + s.score[2]);
    if (!playing) hint(g, f, tr(f, '點一欄投下棋子，連成四個就贏', 'Click a column to drop a disc, four in a row wins'));
  },
});

/* ════════════ 5. 黑白棋 ════════════ */
const D8 = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];
function rvFlips(b, n, i, who, out) { // 回傳會翻幾顆；out 有給就把要翻的位置放進去
  if (b[i] >= 0) return 0;
  const x0 = i % n, y0 = (i / n) | 0; let tot = 0;
  for (let d = 0; d < 16; d += 2) {
    const dx = D8[d], dy = D8[d + 1]; let x = x0 + dx, y = y0 + dy, k = 0;
    while (x >= 0 && y >= 0 && x < n && y < n && b[y * n + x] === 1 - who) { x += dx; y += dy; k++; }
    if (k && x >= 0 && y >= 0 && x < n && y < n && b[y * n + x] === who) {
      tot += k;
      if (out) for (let j = 1; j <= k; j++) out.push((y0 + dy * j) * n + x0 + dx * j);
    }
  }
  return tot;
}
function rvMoves(b, n, who) { const m = []; for (let i = 0; i < n * n; i++) if (b[i] < 0 && rvFlips(b, n, i, who)) m.push(i); return m; }
function rvWeights(n) { // 角最好、角旁邊的格子最危險、邊不錯
  const w = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const ex = x === 0 || x === n - 1, ey = y === 0 || y === n - 1, nx = x === 1 || x === n - 2, ny = y === 1 || y === n - 2;
    w[y * n + x] = ex && ey ? 100 : (ex && ny) || (ey && nx) ? -25 : nx && ny ? -50 : ex || ey ? 10 : nx || ny ? -3 : 1;
  }
  return w;
}
function rvChoose(s, p) {
  const { b, n } = s, who = s.turn, moves = rvMoves(b, n, who);
  if (!moves.length) return -1;
  const sloppy = Math.random() < p.err, tmp = [];
  let best = -1e9, bi = moves[0];
  for (const i of moves) {
    tmp.length = 0; const k = rvFlips(b, n, i, who, tmp);
    const b2 = b.slice(); b2[i] = who; for (const j of tmp) b2[j] = who;
    let v = s.wt[i] + k * 1.2 - rvMoves(b2, n, 1 - who).length * 1.5;
    for (const c of s.corners) if (b2[c] < 0 && rvFlips(b2, n, c, 1 - who)) v -= 60;   // 下完會不會送角給對手
    v += rnd(0, sloppy ? 70 : 8);
    if (v > best) { best = v; bi = i; }
  }
  return bi;
}
function rvNew(s, f) {
  const n = s.n, m = n >> 1;
  s.b = new Int8Array(n * n).fill(-1);
  s.b[(m - 1) * n + m - 1] = 1; s.b[(m - 1) * n + m] = 0; s.b[m * n + m - 1] = 0; s.b[m * n + m] = 1;
  s.ft = new Float64Array(n * n).fill(-9); s.from = new Int8Array(n * n).fill(-1); s.pt = new Float64Array(n * n).fill(-9);
  s.turn = 0; s.over = null; s.overT = 0; s.plan = -1; s.last = -1; s.busy = f.t + 0.3; s.msg = null;
  s.legal = rvMoves(s.b, n, 0);
}
function rvPlay(s, f, i) {
  const { b, n } = s, who = s.turn, fl = [];
  rvFlips(b, n, i, who, fl);
  b[i] = who; s.pt[i] = f.t; s.last = i; s.plan = -1;
  const x0 = i % n, y0 = (i / n) | 0; let end = f.t + 0.3;
  for (const j of fl) {
    s.from[j] = 1 - who; b[j] = who;
    s.ft[j] = f.t + 0.1 + Math.max(Math.abs((j % n) - x0), Math.abs(((j / n) | 0) - y0)) * 0.08;
    end = Math.max(end, s.ft[j] + 0.32);
  }
  s.busy = end;
  const opp = 1 - who, names = ['黑', '白'];
  let mv = rvMoves(b, n, opp);
  if (mv.length) { s.turn = opp; s.legal = mv; return; }
  mv = rvMoves(b, n, who);
  if (mv.length) { s.legal = mv; s.msg = { txt: names[opp] + '無處可下，跳過', txtEn: NAMES_BW[opp] + ' has no move and must pass', t: end }; s.busy = end + 1.2; return; }
  let nb = 0, nw = 0; for (let k = 0; k < n * n; k++) { if (b[k] === 0) nb++; else if (b[k] === 1) nw++; }
  const w = nb > nw ? 0 : nw > nb ? 1 : -1;
  s.over = { w, msg: resultText(s, w, names), msgEn: resultEn(s, w, NAMES_BW), sc: '黑 ' + nb + ' : ' + nw + ' 白', scEn: 'Black ' + nb + ' : ' + nw + ' White', t: end }; s.overT = -(end - f.t); s.legal = [];
  if (w >= 0) s.score[w]++; else s.score[2]++;
}
A({ id: 'ix-reversi', name: '黑白棋', cat: '益智', theme: 'forest', interactive: true,
  desc: '點有小點的格子下子，夾住對手的棋子就能翻面；沒人玩時電腦自己對下',
  params: { n: 8, err: 0.2 },
  variants: [
    { id: 'small', name: '六路小盤', theme: 'mint', desc: '6×6 的小棋盤，節奏更快；點有小點的格子下子', params: { n: 6, err: 0.25 } },
  ],
  init(s, f) {
    const a = area(f), A_ = f.aspect, n = f.p.n;
    let py = Math.max(2, Math.floor((a.h - 1) / n)), px = Math.max(3, Math.round(py * A_));
    if (n * px + 1 > a.w) { px = Math.max(3, Math.floor((a.w - 1) / n)); py = Math.max(2, Math.round(px / A_)); }
    s.n = n; s.px = px; s.py = py;
    s.bx = a.x0 + Math.floor((a.w - n * px - 1) / 2); s.by = a.y0 + Math.floor((a.h - n * py - 1) / 2);
    const iw = px - 1, ih = py - 1, R = ih <= 1 ? 1.45 : Math.min(iw, ih * A_) * 0.47;
    // 棋子只用整格畫（檯面有底色）；k = 0..8 是翻面動畫時越來越窄的樣子
    s.dm = []; for (let k = 0; k <= 8; k++) s.dm.push(mkCover(iw, ih, A_, discFn(R, Math.max(0.08, k / 8)), ih >= 4 ? 8 : 10));   // 很矮的格子門檻高一點，才不會變成方塊
    // 大格子：可下的位置畫成小圓點、會被翻的棋子中間畫一個換色的小圓
    s.big = iw >= 7 && ih >= 3;
    s.lm = s.big ? mkCover(iw, ih, A_, discFn(R * 0.3, 1)) : null;
    s.im = s.big ? mkCover(iw, ih, A_, discFn(R * 0.5, 1)) : null;
    s.wt = rvWeights(n); s.corners = [0, n - 1, n * (n - 1), n * n - 1];
    s.score = [0, 0, 0]; s.human = -1; s.side = 0; s.gp = { x: n / 2, y: n / 2 };
    rvNew(s, f);
  },
  frame(s, f) {
    const { g, C, dt, t, mouse } = f, p = f.p, names = ['黑', '白'], n = s.n;
    const playing = takeover(s, f);
    const cellAt = (x, y) => { const cx = Math.floor((x - s.bx) / s.px), cy = Math.floor((y - s.by) / s.py); return x >= s.bx && y >= s.by && cx < n && cy < n ? cy * n + cx : -1; };
    if (s.over) {
      s.overT += dt;
      if (s.overT > 5 || (playing && mouse.clicks.length && s.overT > 0.8)) rvNew(s, f);
    } else if (t >= s.busy) {
      if (s.human === s.turn) {
        for (const c of mouse.clicks) { if (c.button) continue; const i = cellAt(c.x, c.y); if (i >= 0 && s.legal.includes(i)) { rvPlay(s, f, i); break; } }
      } else {
        if (s.plan < 0) { s.plan = rvChoose(s, p); s.wait = rnd(0.4, 0.9); }
        if (s.plan >= 0) {
          glide(s.gp, s.plan % n, (s.plan / n) | 0, dt, 6);
          s.wait -= dt;
          if (s.wait <= 0) rvPlay(s, f, s.plan);
        }
      }
    }
    // ── 畫 ──
    const { bx, by, px, py } = s, iw = px - 1, ih = py - 1, BW = n * px, BH = n * py, felt = C(0.27);
    // 綠色檯面＋深色的溝：直溝是一整欄、橫溝是 ▄ 露出來的上半列，兩個方向差不多粗；外圍再留一圈窄窄的邊
    fillRect(g, bx - 1, by - 1, BW + 3, 1, '▄', felt);
    fillRect(g, bx - 1, by, BW + 3, BH + 1, '█', felt);
    for (let r = 0; r <= n; r++) fillRect(g, bx, by + r * py, BW + 1, 1, '▄', felt);
    for (let c = 0; c <= n; c++) fillRect(g, bx + c * px, by, 1, BH, ' ', felt);
    if (n === 8) for (const [qx, qy] of [[2, 2], [6, 2], [2, 6], [6, 6]]) g.set(bx + qx * px, by + qy * py, '•', C(0.5));
    const myTurn = s.human === s.turn && !s.over && t >= s.busy;
    const hov = myTurn && mouse.on ? cellAt(mouse.x, mouse.y) : -1, hovOk = hov >= 0 && s.legal.includes(hov);
    const prev = hovOk ? [] : null;
    if (hovOk) rvFlips(s.b, n, hov, s.turn, prev);
    const col0 = C(0), col1 = C(1), big = s.big;
    const cellX = i => bx + (i % n) * px + 1, cellY = i => by + ((i / n) | 0) * py + 1;
    for (let i = 0; i < n * n; i++) {
      const X = cellX(i), Y = cellY(i), v = s.b[i];
      if (v < 0) continue;
      let who = v, k = 8;
      const ph = (t - s.ft[i]) / 0.32;
      if (ph < 0 && s.from[i] >= 0) who = s.from[i];
      else if (ph >= 0 && ph < 1) { k = Math.round(Math.abs(Math.cos(Math.PI * ph)) * 8); if (ph < 0.5) who = s.from[i]; }
      const gp = (t - s.pt[i]) / 0.2;
      if (gp >= 0 && gp < 1) k = Math.round(gp * 8);
      drawMask(g, s.dm[k], X, Y, who ? col1 : col0, 1, '█');
      const cx = X + ((iw - 1) >> 1), cy = Y + ((ih - 1) >> 1);
      if (prev && prev.includes(i)) { // 下在這裡會被翻面：中間換成對方的顏色，一明一暗地閃
        const nc = s.turn ? C(0.72 + 0.28 * pulse(t, 6)) : C(0.02 + 0.12 * pulse(t, 6));
        if (big) drawMask(g, s.im, X, Y, nc, 1, '█'); else g.set(cx, cy, '█', nc);
      } else if (i === s.last && !s.over) { // 最後一手：中間一小塊比較淡的顏色
        const mc = who ? C(0.55) : C(0.42);
        if (big) { const w = 2 * Math.max(1, Math.round(iw / 8)), h = ih >= 7 ? 2 : 1; fillRect(g, X + ((iw - w) >> 1), Y + ((ih - h) >> 1), w, h, '█', mc); }
        else g.set(cx, cy, '•', mc);
      }
    }
    // 可以下的位置（小圓點）、預覽、電腦的游標
    if (!s.over && t >= s.busy) {
      const lc = C((myTurn ? 0.5 : 0.38) + 0.15 * pulse(t, 4));
      for (const i of s.legal) {
        if (i === hov) continue;
        if (big) drawMask(g, s.lm, cellX(i), cellY(i), lc, 1, '█');
        else g.set(cellX(i) + ((iw - 1) >> 1), cellY(i) + ((ih - 1) >> 1), '•', lc);
      }
      if (hovOk) drawMask(g, s.dm[8], cellX(hov), cellY(hov), s.turn ? C(0.56 + 0.08 * pulse(t, 5)) : C(0.11 + 0.04 * pulse(t, 5)), 1, '█');
      const gi = hovOk ? hov : s.human !== s.turn && s.plan >= 0 ? Math.round(s.gp.y) * n + Math.round(s.gp.x) : -1;
      if (gi >= 0 && iw >= 4 && ih >= 2) corners(g, bx + (gi % n) * px + 1, by + ((gi / n) | 0) * py + 1, iw, ih, C(0.75 + 0.25 * pulse(t, 6)));
    }
    let nb = 0, nw = 0; for (let k = 0; k < n * n; k++) { if (s.b[k] === 0) nb++; else if (s.b[k] === 1) nw++; }
    const ccx = bx + (n * px) / 2, ccy = by + (n * py) / 2;
    if (s.msg && t >= s.msg.t && t < s.msg.t + 1.3) banner(g, ccx, ccy, [tr(f, s.msg.txt, s.msg.txtEn)], C(1), C(0.6));
    if (s.over && s.overT > 0.4) banner(g, ccx, ccy, [tr(f, s.over.msg, s.over.msgEn), tr(f, s.over.sc, s.over.scEn)], C(1), C(0.75));
    hud(g, f, sideLabel(s, names, f, NAMES_BW) + tr(f, ' │ 黑 ' + nb + ' : ' + nw + ' 白 │ 戰績 ', ' │ Black ' + nb + ' : ' + nw + ' White │ Wins ') + s.score[0] + '-' + s.score[1]);
    if (!playing) hint(g, f, tr(f, '點有小點的格子，夾住對方就能翻面', 'Click a square with a dot, trap discs between yours to flip them'));
  },
});

/* ════════════ 6. 五子棋 ════════════ */
const G4 = [1, 0, 0, 1, 1, 1, 1, -1];
// 威脅分數：看這個方向上所有「包含 (x,y)、沒有對手棋子」的五格窗口，數出 who 下在這裡後窗口裡有幾子。
// 這樣「跳三」「跳四」（XX_X、XX_XX）也看得出來。
// 型：0 五連、1 活四、2 衝四、3 活三、4 眠三、5 活二、6 眠二、7 其他
const GK_ATT = [1e7, 1e5, 3500, 3000, 350, 120, 20, 2];
const GK_DEF = [5e6, 5e4, 1500, 700, 90, 35, 6, 1];
function gkShape(b, n, x, y, dx, dy, who) {
  let c2 = 0, c3 = 0, c4 = 0;
  for (let st = -4; st <= 0; st++) {
    let k = 1, ok = true;
    for (let j = 0; j < 5; j++) {
      const o = st + j; if (!o) continue;
      const X = x + dx * o, Y = y + dy * o;
      if (X < 0 || Y < 0 || X >= n || Y >= n) { ok = false; break; }
      const v = b[Y * n + X];
      if (v === who) k++; else if (v >= 0) { ok = false; break; }
    }
    if (!ok) continue;
    if (k >= 5) return 0;
    if (k === 4) c4++; else if (k === 3) c3++; else if (k === 2) c2++;
  }
  return c4 >= 2 ? 1 : c4 ? 2 : c3 >= 2 ? 3 : c3 ? 4 : c2 >= 2 ? 5 : c2 ? 6 : 7;
}
function gkFive(b, n, i, who) {
  const x = i % n, y = (i / n) | 0;
  for (let d = 0; d < 8; d += 2) {
    const dx = G4[d], dy = G4[d + 1], cells = [i];
    for (const sg of [1, -1]) { let X = x + dx * sg, Y = y + dy * sg; while (X >= 0 && Y >= 0 && X < n && Y < n && b[Y * n + X] === who) { cells.push(Y * n + X); X += dx * sg; Y += dy * sg; } }
    if (cells.length >= 5) return cells.sort((u, v) => (u % n) - (v % n) || u - v);
  }
  return null;
}
const GK_TOP_V = new Float64Array(4), GK_TOP_I = new Int32Array(4);
function gkChoose(s, p) {
  const { b, n } = s, who = s.turn, opp = 1 - who;
  if (!s.cnt) { const c = n >> 1; return (c + rint(-1, 1)) * n + c + rint(-1, 1); }
  let m = 0;
  for (let i = 0; i < n * n; i++) {
    if (b[i] >= 0 || !s.near[i]) continue;
    const x = i % n, y = (i / n) | 0; let v = Math.random() * 4;
    for (let d = 0; d < 8; d += 2) v += GK_ATT[gkShape(b, n, x, y, G4[d], G4[d + 1], who)] + GK_DEF[gkShape(b, n, x, y, G4[d], G4[d + 1], opp)];
    let k = Math.min(m, 3);
    if (m >= 4 && v <= GK_TOP_V[3]) continue;
    while (k > 0 && GK_TOP_V[k - 1] < v) { if (k < 4) { GK_TOP_V[k] = GK_TOP_V[k - 1]; GK_TOP_I[k] = GK_TOP_I[k - 1]; } k--; }
    GK_TOP_V[k] = v; GK_TOP_I[k] = i; if (m < 4) m++;
  }
  if (!m) return -1;
  // 不完美：偶爾選第二、三好的位置（但不會差太多）；「馬上贏、擋五連、擋活三」不會漏
  let k = 0;
  const top = GK_TOP_V[0], r = Math.random();
  if (r < p.err && top < 4e4) {
    k = Math.min(m - 1, r < p.err * 0.35 ? 2 : 1);
    while (k > 0 && GK_TOP_V[k] < top * 0.35) k--;
  }
  return GK_TOP_I[k];
}
function gkNew(s) {
  const n = s.n;
  s.b = new Int8Array(n * n).fill(-1); s.near = new Uint8Array(n * n); s.pt = new Float64Array(n * n).fill(-9);
  s.turn = 0; s.over = null; s.overT = 0; s.plan = -1; s.cnt = 0; s.last = -1;
}
function gkPlay(s, f, i) {
  const { b, n } = s, who = s.turn, x = i % n, y = (i / n) | 0, names = ['黑', '白'];
  b[i] = who; s.pt[i] = f.t; s.cnt++; s.last = i; s.plan = -1;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < n && Y < n) s.near[Y * n + X] = 1; }
  const l = gkFive(b, n, i, who);
  if (l) { s.over = { w: who, l, msg: resultText(s, who, names), msgEn: resultEn(s, who, NAMES_BW), t: f.t }; s.score[who]++; s.overT = 0; }
  else if (s.cnt >= n * n || (s.cnt >= 40 && !gkAlive(b, n))) { s.over = { w: -1, l: null, msg: '平手（誰都連不成五）', msgEn: 'Draw (no one can make five)', t: f.t }; s.score[2]++; s.overT = 0; }
  else s.turn = 1 - who;
}
// 還有沒有哪個五格窗口只有一種顏色（或全空）→ 還有人可能連成五
function gkAlive(b, n) {
  for (let d = 0; d < 8; d += 2) {
    const dx = G4[d], dy = G4[d + 1];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const ex = x + dx * 4, ey = y + dy * 4;
      if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue;
      let c0 = 0, c1 = 0;
      for (let k = 0; k < 5; k++) { const v = b[(y + dy * k) * n + x + dx * k]; if (v === 0) c0++; else if (v === 1) c1++; }
      if (!c0 || !c1) return true;
    }
  }
  return false;
}
function gkStone(R, A_) { // 以交叉點為中心的棋子形狀：ch 字元、rim 是否為外圈
  const w = 2 * Math.ceil(R) + 1, h = 2 * Math.ceil(R / A_) + 1, m = { n: 0, dx: [], dy: [], ch: [], rim: [] };
  const rIn = Math.max(0, R - Math.max(0.9, R * 0.16));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const qx = x + 0.5 - w / 2, dt = Math.hypot(qx, (y + 0.25 - h / 2) * A_), db = Math.hypot(qx, (y + 0.75 - h / 2) * A_);
    const it = dt <= R, ib = db <= R;
    if (!it && !ib) continue;
    m.dx.push(x - (w - 1) / 2); m.dy.push(y - (h - 1) / 2); m.ch.push(it && ib ? '█' : it ? '▀' : '▄');
    m.rim.push((it && dt > rIn) || (ib && db > rIn) ? 1 : 0); m.n++;
  }
  return m;
}
A({ id: 'ix-gomoku', name: '五子棋', cat: '益智', theme: 'amber', interactive: true,
  desc: '點棋盤上的交叉點下子，先連成五個就贏；沒人玩時電腦自己對下',
  params: { n: 15, err: 0.15 },
  variants: [
    { id: 'big', name: '十九路', theme: 'gold', desc: '19 路的大棋盤，對局更長；點交叉點下子', params: { n: 19, err: 0.15 } },
  ],
  init(s, f) {
    const a = area(f), A_ = f.aspect, n = f.p.n;
    let sy = Math.max(1, Math.floor((a.h - 3) / (n - 1))), sx = Math.max(2, Math.round(sy * A_));
    if ((n - 1) * sx + 1 > a.w - 4) { sx = Math.max(2, Math.floor((a.w - 5) / (n - 1))); sy = Math.max(1, Math.min(sy, Math.round(sx / A_))); }
    s.n = n; s.sx = sx; s.sy = sy;
    const LW = (n - 1) * sx + 1, LH = (n - 1) * sy + 1;
    s.my = clamp(Math.floor((a.h - LH) / 2), 0, Math.floor(sy / 2)); s.mx = clamp(Math.floor((a.w - LW) / 2), 0, Math.floor(sx / 2));
    s.bx = a.x0 + Math.floor((a.w - LW) / 2); s.by = a.y0 + Math.floor((a.h - LH) / 2);
    s.stone = sy >= 2 ? gkStone(Math.min(sx, sy * A_) * 0.46, A_) : null;
    s.stars = n === 19 ? [3, 9, 15] : n === 15 ? [3, 7, 11] : [n >> 1];
    s.score = [0, 0, 0]; s.human = -1; s.side = 0; s.gp = { x: n / 2, y: n / 2 };
    gkNew(s);
  },
  frame(s, f) {
    const { g, C, dt, t, mouse } = f, p = f.p, names = ['黑', '白'], n = s.n;
    const playing = takeover(s, f);
    const at = (x, y) => { const X = Math.round((x - s.bx - 0.5) / s.sx), Y = Math.round((y - s.by - 0.5) / s.sy); return X >= 0 && Y >= 0 && X < n && Y < n ? Y * n + X : -1; };
    if (s.over) {
      s.overT += dt;
      if (s.overT > 4.5 || (playing && mouse.clicks.length && s.overT > 0.8)) gkNew(s);
    } else if (s.human === s.turn) {
      for (const c of mouse.clicks) { if (c.button) continue; const i = at(c.x, c.y); if (i >= 0 && s.b[i] < 0) { gkPlay(s, f, i); break; } }
    } else {
      if (s.plan < 0) { s.plan = gkChoose(s, p); s.wait = rnd(0.35, 0.8); }
      if (s.plan >= 0) {
        glide(s.gp, s.plan % n, (s.plan / n) | 0, dt, 6);
        s.wait -= dt;
        if (s.wait <= 0) gkPlay(s, f, s.plan);
      }
    }
    // ── 畫 ──
    const { bx, by, sx, sy } = s, big = !!s.stone;
    if (big) fillRect(g, bx - s.mx, by - s.my, (n - 1) * sx + 1 + 2 * s.mx, (n - 1) * sy + 1 + 2 * s.my, '░', C(0.13));
    lattice(g, bx, by, n - 1, n - 1, sx, sy, C(big ? 0.38 : 0.2));
    for (const a of s.stars) for (const b2 of s.stars) g.set(bx + a * sx, by + b2 * sy, '╋', C(big ? 0.6 : 0.4));
    const wl = s.over && s.over.l;
    const drawStone = (i, who, lum, ghost) => {
      const X = bx + (i % n) * sx, Y = by + ((i / n) | 0) * sy;
      if (!big) { g.set(X, Y, ghost ? '○' : '●', who ? C(lum) : C(0.56 * lum + (ghost ? 0.1 : 0))); return; }
      const m = s.stone, fc = who ? C(0.93 * lum) : C(0.07), rc = who ? C(0.72 * lum) : C(0.42 * lum);
      for (let k = 0; k < m.n; k++) {
        if (ghost) { if (m.ch[k] === '█') g.set(X + m.dx[k], Y + m.dy[k], '░', who ? C(0.55) : C(0.3)); continue; }
        g.set(X + m.dx[k], Y + m.dy[k], m.ch[k], m.rim[k] ? rc : fc);
      }
    };
    for (let i = 0; i < n * n; i++) {
      const v = s.b[i]; if (v < 0) continue;
      let lum = 1;
      if (wl) lum = wl.includes(i) ? 1 : 0.6;
      drawStone(i, v, lum, false);
      if (wl && wl.includes(i)) { const X = bx + (i % n) * sx, Y = by + ((i / n) | 0) * sy; g.set(X, Y, big ? '◆' : '●', C(0.75 + 0.25 * pulse(t, 7))); }
    }
    if (s.last >= 0 && !s.over) { // 最後一手
      const X = bx + (s.last % n) * sx, Y = by + ((s.last / n) | 0) * sy, mc = C(0.65 + 0.3 * pulse(t, 4));
      if (big) g.set(X, Y, '•', s.b[s.last] ? C(0.35) : mc);
      else { g.set(X - 1, Y, '[', mc); g.set(X + 1, Y, ']', mc); }
    }
    if (!s.over) { // 預覽：玩家跟著滑鼠；電腦的游標滑到想下的位置
      let gi = -1;
      if (s.human === s.turn) { gi = mouse.on ? at(mouse.x, mouse.y) : -1; if (gi >= 0 && s.b[gi] >= 0) gi = -1; }
      else if (s.plan >= 0) gi = Math.round(s.gp.y) * n + Math.round(s.gp.x);
      if (gi >= 0 && s.b[gi] < 0) drawStone(gi, s.turn, 0.6, true);
    }
    if (wl && sx >= 4) { // 五連線
      const a = wl[0], z = wl[wl.length - 1], pr = clamp((t - s.over.t) / 0.5, 0, 1);
      const ax = bx + (a % n) * sx + 0.5, ay = by + ((a / n) | 0) * sy + 0.5, zx = bx + (z % n) * sx + 0.5, zy = by + ((z / n) | 0) * sy + 0.5;
      const dx = zx - ax, dy = zy - ay, ch = Math.abs(dy) < 0.5 ? '━' : Math.abs(dx) < 0.5 ? '┃' : (dx > 0) === (dy > 0) ? '╲' : '╱';
      g.line(ax, ay, ax + dx * pr, ay + dy * pr, ch, C(1));
    }
    if (s.over && s.overT > 0.8) banner(g, bx + ((n - 1) * sx) / 2, by + ((n - 1) * sy) / 2, [tr(f, s.over.msg, s.over.msgEn)], C(1), C(0.75));
    hud(g, f, sideLabel(s, names, f, NAMES_BW) + tr(f, ' │ 第 ' + s.cnt + ' 手 │ 黑 ', ' │ Move ' + s.cnt + ' │ Black ') + s.score[0] + tr(f, '  白 ', '  White ') + s.score[1]);
    if (!playing) hint(g, f, tr(f, '點交叉點下子，先連成五個就贏', 'Click an intersection, first to get five in a row wins'));
  },
});
})();
