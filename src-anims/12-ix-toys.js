// 互動小玩具（ix- 開頭）：魚群、粒子磁場、點擊煙火、沙畫、生命畫布、點擊花園、雷電游標、數位雨分流、霓虹塗鴉。
// 只用滑鼠：移動、左鍵點一下、按住拖曳（不用鍵盤、不用右鍵）。沒人操作（idle ≥ 6 秒）時由示範 AI 自己玩。
(() => {
/* ════════════ 共用小工具 ════════════ */
const wideCh = c => { const k = c.codePointAt(0); return k >= 0x2e80 && k < 0xff61; };
// 寫字：全形字的第二格也清掉，底下的東西才不會蓋住字的右半邊
function txt(g, x, y, s, col) {
  x = Math.floor(x);
  for (const c of s) { const w = wideCh(c); if (c !== ' ') { g.set(x, y, c, col); if (w) g.set(x + 1, y, ' ', col); } x += w ? 2 : 1; }
}
function blank(g, x, y, w) { x = Math.floor(x); for (let k = 0; k < w; k++) g.set(x + k, y, ' ', '#000000'); }
// 示範模式時，底部中央一行淡淡的提示
// 提示與 HUD 的顏色依「和背景的對比」挑，而不是固定的色階位置（霓虹這類暗色階 C(0.42) 幾乎看不見，賽博卻很刺眼）
const relLum = hex => { const c = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const TXT_COL = new Map();
function rampT(f, target, from) {
  const C = f.C, key = C(0) + C(0.5) + C(1) + target + from;
  let t = TXT_COL.get(key);
  if (t === undefined) {
    const l0 = relLum(C(0)), b = l0 < 0.3 ? l0 * 0.6 : Math.min(1, l0 * 1.15); // 色階起點比背景略靠近中間，往背景方向估一點
    for (t = from; t < 1; t += 0.02) { const l = relLum(C(t)), r = (Math.max(l, b) + 0.05) / (Math.min(l, b) + 0.05); if (r >= target) break; }
    TXT_COL.set(key, t = Math.min(1, t));
  }
  return t;
}
const rampAt = (f, target, from) => f.C(rampT(f, target, from));
function hint(f, s) { const g = f.g, w = g.textW(s), x = Math.floor((f.cols - w) / 2), y = f.rows - 1; blank(g, x - 2, y, w + 4); txt(g, x, y, s, rampAt(f, 4, 0.2)); }
// 介面語言：f.lang === 'en' 時畫英文，其他（含舊版沒有 f.lang）都畫中文
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
// 右上角的小 HUD（桌面圖示通常在左上角）
function hud(f, s, col) { const g = f.g, w = g.textW(s), x = f.cols - w - 2; blank(g, x - 1, 0, w + 2); txt(g, x, 0, s, col || rampAt(f, 6.5, 0.62)); }
const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sgn = v => (v < 0 ? -1 : 1);
const MIR = { '/': '\\', '\\': '/', '(': ')', ')': '(', '<': '>', '>': '<', '[': ']', ']': '[', '{': '}', '}': '{', '`': "'", "'": '`', '╱': '╲', '╲': '╱', '▌': '▐', '▐': '▌' };
const mirror = lines => { const w = Math.max(...lines.map(l => l.length)); return lines.map(l => [...l.padEnd(w)].reverse().map(c => MIR[c] || c).join('')); };
// 依方向選線段字元（vx, vy 是視覺座標：y 已經乘上字高比）
function dirCh(vx, vy, set) {
  const a = Math.abs(vx), b = Math.abs(vy);
  if (b > a * 3) return set[1];
  if (a > b * 1.7) return set[0];
  return (vx > 0) === (vy > 0) ? set[2] : set[3];
}
const BOX = ['─', '│', '╲', '╱'], ASC = ['-', '|', '\\', '/'];
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };

// ── 指標：有人玩時就是真的滑鼠；沒人玩時由各桌布自己的示範 AI（ai 物件）驅動 ──
function mkPtr(f) {
  const x = f.cols / 2, y = f.rows / 2;
  return { x, y, px: x, py: y, down: false, wasDown: false, clicks: [], on: false, playing: false, jump: true, wheel: 0, still: 0, moved: false,
    ai: { x, y, vx: 0, vy: 0, down: false, clicks: [] } };
}
function ptr(s, f, aiStep) {
  // 按住不動時 Player 不會更新 idle：按著的時候仍算玩家在玩（60 秒保險，避免漏掉放開事件就永遠卡住）
  const m = f.mouse, playing = m.idle < 6 || (!!m.down && m.idle < 60);
  const P = s.P || (s.P = mkPtr(f)), ai = P.ai;
  P.px = P.x; P.py = P.y; P.wasDown = P.down; P.jump = playing !== P.playing;
  if (!playing && P.playing) { ai.x = clamp(P.x, 0, f.cols - 1); ai.y = clamp(P.y, 0, f.rows - 1); ai.vx = ai.vy = 0; ai.down = false; } // AI 從玩家最後的位置接手
  P.playing = playing;
  if (playing) {
    P.x = m.x; P.y = m.y; P.down = !!m.down; P.on = !!m.on; P.wheel = m.wheel || 0;
    P.clicks = m.clicks.some(c => c.button) ? m.clicks.filter(c => !c.button) : m.clicks; // 只認左鍵
  }
  else { ai.clicks.length = 0; if (aiStep) aiStep(ai); P.x = ai.x; P.y = ai.y; P.down = !!ai.down; P.clicks = ai.clicks; P.on = true; P.wheel = 0; }
  const mv = Math.hypot(P.x - P.px, (P.y - P.py) * 2);
  P.moved = mv > 0.05 && !P.jump;
  P.still = P.moved ? 0 : P.still + f.dt;
  return P;
}
// 示範 AI 的平滑移動：像有人在拉滑鼠（臨界阻尼彈簧追目標，不會瞬移）
function aiSeek(ai, tx, ty, dt, k, vmax) {
  ai.vx += ((tx - ai.x) * k * k - ai.vx * 2 * k) * dt;
  ai.vy += ((ty - ai.y) * k * k - ai.vy * 2 * k) * dt;
  const v = Math.hypot(ai.vx, ai.vy * 2);
  if (v > vmax) { ai.vx *= vmax / v; ai.vy *= vmax / v; }
  ai.x += ai.vx * dt; ai.y += ai.vy * dt;
  return Math.hypot(tx - ai.x, (ty - ai.y) * 2);
}

/* ════════════ 魚群 ════════════ */
const FISH = [
  { r: '><>', l: '<><', hue: 25, w: 5, spd: 1.05 },
  { r: '><)°>', l: '<°(><', hue: 190, w: 3, spd: 0.95 },
  { r: '><((°>', l: '<°))><', hue: 52, w: 1.6, spd: 0.85 },
  { r: '><(((°>', l: '<°)))><', hue: 325, w: 0.8, spd: 0.8 },
];
const FISH_W = FISH.reduce((a, b) => a + b.w, 0);
function pickFish() { let r = Math.random() * FISH_W; for (let k = 0; k < FISH.length; k++) { r -= FISH[k].w; if (r <= 0) return k; } return 0; }
const SHARK_R = ['         /|', "\\   _.-'  `--._", ' >-(          °>', "/   `-.______.-'"];
const SHARK_L = mirror(SHARK_R);
const SHARK_BR = ['                 ___', '                /  /', "\\`.     __..---'  '----..__", " \\ '.--'                   ''-._", '  >                          ° _>', " / .'--..__              __..--'", "/.'        '''----....--'"];
const SHARK_BL = mirror(SHARK_BR);
function fishNew(s, f, edge) {
  const a = f.aspect;
  const o = { x: rnd(4, f.cols - 4), y: rnd(2, s.floor - 1) * a, vx: rnd(-8, 8), vy: rnd(-2, 2), sp: pickFish(), dir: 1, fear: 0, shade: rnd(-0.08, 0.08),
    // 每條魚在魚群裡有自己的位置（繞著目標慢慢轉的一個圓盤），魚群才會散開成一大片，而不是擠成一團
    ang: rnd(TAU), rad: Math.sqrt(rnd(0.04, 1)), angSp: rnd(0.06, 0.22) * (Math.random() < 0.5 ? -1 : 1), lead: Math.random() < 0.4 };
  if (edge) { const side = Math.random() < 0.5 ? -1 : 1; o.x = side < 0 ? -6 : f.cols + 6; o.vx = -side * rnd(8, 12); }
  o.dir = o.vx >= 0 ? 1 : -1;
  return o;
}
function fishAI(s, f, ai) {
  const dt = f.dt, A = f.aspect;
  if (ai.t === undefined) { ai.t = 0; ai.ft = rnd(3, 6); ai.bt = 1; }
  ai.t -= dt;
  if (f.p.shark) {
    // 鯊魚 AI：追最近的魚，嘴巴靠近時咬（有時太早咬，會落空）
    const sh = s.shark; let best = null, bd = 1e9;
    for (const o of s.fish) { const dx = o.x - ai.x, dy = o.y - ai.y * A, d = dx * dx + dy * dy; if (d < bd && o.x > 0 && o.x < f.cols) { bd = d; best = o; } }
    if (best) {
      aiSeek(ai, best.x - sh.dir * (sh.mouth - 1.5) + Math.sin(f.t * 1.3) * 2, best.y / A, dt, 2.1, 30);
      const mx = ai.x + sh.dir * sh.mouth, my = ai.y * A, tol = ai.tol || (ai.tol = (sh.big ? 7 : 5.5) * rnd(0.6, 1.9)); // 容許誤差和咬合範圍成比例：有時太早咬會落空
      if (ai.t <= 0 && Math.abs(best.x - mx) < tol && Math.abs(best.y - my) < 3.5) { ai.clicks.push({ x: ai.x, y: ai.y, button: 0 }); ai.t = rnd(0.5, 1.3); ai.tol = 0; }
    } else aiSeek(ai, f.cols / 2, f.rows / 2, dt, 1, 15);
  } else {
    // 一般 AI：慢慢在水族箱裡晃，魚群會跟著；隔一陣子撒一次飼料
    if (ai.t <= 0) { ai.tx = rnd(f.cols * 0.12, f.cols * 0.88); ai.ty = rnd(f.rows * 0.15, s.floor - 3); ai.t = rnd(3, 6); }
    aiSeek(ai, ai.tx, ai.ty, dt, 0.9, 14);
    ai.ft -= dt;
    if (ai.ft <= 0) { ai.clicks.push({ x: ai.x, y: ai.y, button: 0 }); ai.ft = rnd(7, 13); }
  }
}
A({ id: 'ix-fish', name: '魚群', cat: '互動', theme: 'ocean', hue: true, interactive: true,
  desc: '移動滑鼠讓魚群跟著游，點一下撒飼料、把魚嚇散',
  params: { shark: 0 },
  variants: [
    { id: 'shark', name: '鯊魚', desc: '你是鯊魚：移動滑鼠追魚群，點一下張口咬', params: { shark: 1 } },
  ],
  init(s, f) {
    const { cols, rows } = f;
    s.floor = rows - 1 - Math.max(1, Math.round(rows * 0.04));
    s.N = clamp(Math.round(cols * rows / 330), 14, 150);
    s.fish = []; for (let i = 0; i < s.N; i++) s.fish.push(fishNew(s, f, false));
    s.acc = new Float32Array(160 * 8);
    s.food = []; s.eaten = 0; s.caught = 0; s.bub = []; s.bt = 0; s.resp = 0;
    s.weeds = Array.from({ length: Math.max(3, Math.round(cols / 15)) }, () => ({ x: rnd(1, cols - 2), h: Math.max(3, Math.round(rows * rnd(0.12, 0.4))), ph: rnd(TAU), hue: rnd(95, 160) }));
    s.motes = Array.from({ length: Math.round(cols * rows / 150) }, () => ({ x: rnd(cols), y: rnd(1, s.floor), ph: rnd(TAU), b: rnd(0.12, 0.24) }));
    s.shark = { x: cols / 2, y: rows / 2 * f.aspect, dir: 1, bite: 0, big: cols >= 200 && rows >= 50 };
    s.shark.half = s.shark.big ? 17 : 8; s.shark.mouth = s.shark.big ? 15.5 : 7.5;
  },
  frame(s, f) {
    const { g, cols, rows, aspect: A, dt, t, C, H, p } = f;
    const shark = !!p.shark, floorV = (s.floor + 0.4) * A, topV = 1.3 * A;
    const P = ptr(s, f, ai => fishAI(s, f, ai));
    const F = s.fish, sh = s.shark;
    // ── 鯊魚跟著指標 ──
    if (shark) {
      sh.x = P.x; sh.y = clamp(P.y, 1, s.floor) * A;
      const vx = P.playing ? P.x - P.px : P.ai.vx * dt;
      if (vx > 0.15) sh.dir = 1; else if (vx < -0.15) sh.dir = -1;
      sh.bite -= dt;
    }
    // ── 點擊 ──
    for (const c of P.clicks) {
      const cx = c.x, cy = clamp(c.y, 1, s.floor) * A;
      if (shark) {
        sh.bite = 0.3;
        const mx = sh.x + sh.dir * sh.mouth, my = sh.y, bw = sh.big ? 7 : 5.5, bh = sh.big ? 4.5 : 3.4;
        for (let i = F.length - 1; i >= 0; i--) {
          const o = F[i];
          if (Math.abs(o.x - mx) < bw && Math.abs(o.y - my) < bh) { F.splice(i, 1); s.caught++; s.resp = Math.max(s.resp, 1.2); for (let k = 0; k < 3; k++) s.bub.push({ x: mx + rnd(-2, 2), y: my / A, v: rnd(3, 6), ph: rnd(TAU) }); }
        }
      } else {
        for (const o of F) {
          const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy) + 0.01, R = 24;
          if (d < R) { const k = 34 * (1 - d / R) + 10; o.vx += dx / d * k; o.vy += dy / d * k * 0.7; o.fear = rnd(0.9, 1.4); }
        }
        const nf = rint(4, 7);
        for (let k = 0; k < nf && s.food.length < 60; k++) s.food.push({ x: clamp(cx + rnd(-2.5, 2.5), 2, cols - 3), y: cy + rnd(-1.5, 1.5), ph: rnd(TAU), life: 12, land: false });
      }
    }
    // ── 魚群（boids：分離、對齊、聚集；只和同種的魚對齊聚集） ──
    const n = F.length, acc = s.acc, PER = 11, PER2 = PER * PER, SEP2 = 3.3 * 3.3;
    acc.fill(0, 0, n * 8);
    for (let i = 0; i < n; i++) {
      const a = F[i], oi = i * 8;
      for (let j = i + 1; j < n; j++) {
        const b = F[j], dx = b.x - a.x, dy = b.y - a.y;
        if (dx > PER || dx < -PER || dy > PER || dy < -PER) continue;
        const d2 = dx * dx + dy * dy; if (d2 > PER2) continue;
        const ex = dx * 0.42, ey = dy * 1.3, s2 = ex * ex + ey * ey, oj = j * 8; // 同一列（左右重疊）比上下相鄰更要分開
        if (s2 < SEP2) { const k = (SEP2 - s2) / SEP2 / Math.sqrt(s2 + 0.01); acc[oi] -= ex * k; acc[oi + 1] -= ey * k; acc[oj] += ex * k; acc[oj + 1] += ey * k; }
        if (a.sp === b.sp) {
          acc[oi + 2] += b.vx; acc[oi + 3] += b.vy; acc[oi + 4] += dx; acc[oi + 5] += dy; acc[oi + 6]++;
          acc[oj + 2] += a.vx; acc[oj + 3] += a.vy; acc[oj + 4] -= dx; acc[oj + 5] -= dy; acc[oj + 6]++;
        }
      }
    }
    const follow = P.playing ? (P.still < 2 ? 1 : Math.max(0.2, 1 - (P.still - 2) * 0.25)) : 0.8;
    const tx = P.x, ty = clamp(P.y, 1, s.floor) * A, food = s.food;
    // 魚群的大小隨魚數變大（每條魚在圓盤裡有自己的位置）；沒人玩時各種魚有自己的漫遊目標，只有一部分跟著示範游標，整個水族箱都有魚
    const slotR = k => Math.min(3 * Math.sqrt(k) + 3, cols * 0.22, (floorV - topV) * 0.42);
    const cnt4 = s.cnt4 || (s.cnt4 = [0, 0, 0, 0]); cnt4.fill(0); for (const o of F) cnt4[o.sp]++;
    const wt = s.wt || (s.wt = FISH.map(() => ({ x: 0, y: 0, p1: rnd(TAU), p2: rnd(TAU) }))), Rall = slotR(n);
    for (let k = 0; k < wt.length; k++) {
      const w = wt[k], R = slotR(cnt4[k]);
      w.x = cols / 2 + Math.sin(t * 0.045 * (1 + k * 0.17) + w.p1) * Math.max(0, cols / 2 - R * 1.5 - 6);
      w.y = (topV + floorV) / 2 + Math.sin(t * 0.07 * (1 + k * 0.23) + w.p2) * Math.max(0, (floorV - topV) / 2 - R * 0.8 - 2);
      w.R = R;
    }
    for (let i = 0; i < n; i++) {
      const a = F[i], oi = i * 8, cnt = acc[oi + 6], sp = FISH[a.sp], afraid = a.fear > 0;
      const vmax = 13 * sp.spd * (afraid ? 2.2 : 1);
      let ax = acc[oi] * 16, ay = acc[oi + 1] * 16;
      if (cnt) {
        ax += (acc[oi + 2] / cnt - a.vx) * 0.9; ay += (acc[oi + 3] / cnt - a.vy) * 0.9;
        if (!afraid) { ax += acc[oi + 4] / cnt * 0.35; ay += acc[oi + 5] / cnt * 0.35; }
      }
      ax += Math.sin(t * 0.7 + i * 1.7) * 1.6; ay += Math.cos(t * 0.5 + i * 2.3) * 0.9;
      const m = 6;
      if (a.x < m) ax += (m - a.x) * 5; else if (a.x > cols - m) ax -= (a.x - cols + m) * 5;
      if (a.y < topV + 2) ay += (topV + 2 - a.y) * 5; else if (a.y > floorV - 2) ay -= (a.y - floorV + 2) * 5;
      if (shark) {
        const dx = a.x - sh.x, dy = a.y - sh.y, d = Math.hypot(dx, dy) + 0.01, R = 26;
        if (d < R) { const k = (R - d) / R; ax += dx / d * 70 * k; ay += dy / d * 45 * k; a.fear = Math.max(a.fear, 0.35); }
      } else if (!afraid) {
        // 找最近的飼料
        let fb = -1, fd = 50 * 50;
        const hx = a.x + a.dir * sp.r.length * 0.4;
        for (let k = 0; k < food.length; k++) { const fo = food[k], dx = fo.x - hx, dy = fo.y - a.y, d2 = dx * dx + dy * dy; if (d2 < fd) { fd = d2; fb = k; } }
        if (fb >= 0) {
          const fo = food[fb], dx = fo.x - hx, dy = fo.y - a.y, d = Math.sqrt(fd) + 0.01;
          ax += (dx / d * vmax * 1.1 - a.vx) * 1.8; ay += (dy / d * vmax * 1.1 - a.vy) * 1.8;
          if (d < 1.9) { food.splice(fb, 1); s.eaten++; a.shade = Math.min(0.12, a.shade + 0.02); }
        } else if (P.on && follow > 0) {
          const own = !P.playing && !a.lead, w = wt[a.sp], R = own ? w.R : Rall;
          a.ang += a.angSp * dt;
          const gx = clamp((own ? w.x : tx) + Math.cos(a.ang) * a.rad * R * 1.5, 4, cols - 4), gy = clamp((own ? w.y : ty) + Math.sin(a.ang) * a.rad * R * 0.8, topV + 2, floorV - 2);
          const dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy) + 0.01;
          if (d > 6) { const w = follow * 0.55 * clamp(1.5 - d / (cols * 0.55), 0.12, 1); ax += (dx / d * vmax * 0.85 - a.vx) * w; ay += (dy / d * vmax * 0.85 - a.vy) * w; }
          else { const sg = i & 1 ? 1 : -1; ax += -dy / d * 9 * sg; ay += dx / d * 5 * sg; }
        }
      }
      a.vx += ax * dt; a.vy += ay * dt;
      const vyMax = afraid ? 30 : Math.abs(a.vx) * 0.6 + 3;
      if (a.vy > vyMax) a.vy = vyMax; else if (a.vy < -vyMax) a.vy = -vyMax;
      const v = Math.hypot(a.vx, a.vy), vmin = 3.5 * sp.spd;
      if (v > vmax) { a.vx *= vmax / v; a.vy *= vmax / v; } else if (v < vmin) { if (v < 0.01) a.vx = a.dir * vmin; else { a.vx *= vmin / v; a.vy *= vmin / v; } }
      a.x += a.vx * dt; a.y = clamp(a.y + a.vy * dt, topV, floorV);
      if (a.vx > 1.2) a.dir = 1; else if (a.vx < -1.2) a.dir = -1;
      a.fear -= dt;
    }
    // 鯊魚模式：魚被吃掉後，過一下從畫面兩側游回來
    if (shark && F.length < s.N) { s.resp -= dt; if (s.resp <= 0) { F.push(fishNew(s, f, true)); s.resp = 0.4; } }
    // ── 飼料 ──
    for (let k = food.length - 1; k >= 0; k--) {
      const fo = food[k];
      if (!fo.land) { fo.y += 4.5 * dt; fo.x += Math.sin(t * 2 + fo.ph) * 0.8 * dt; if (fo.y >= floorV) { fo.y = floorV; fo.land = true; } }
      else if ((fo.life -= dt) <= 0) food.splice(k, 1);
    }
    // ── 氣泡 ──
    s.bt -= dt;
    if (s.bt <= 0) { const w = pick(s.weeds); s.bub.push({ x: w.x + rnd(-1, 1), y: s.floor, v: rnd(2.5, 5), ph: rnd(TAU) }); s.bt = rnd(0.15, 0.6) * 100 / cols; }
    // ════ 畫面 ════
    for (let x = 0; x < cols; x++) { const v = Math.sin(x * 0.21 + t * 1.2) + Math.sin(x * 0.07 - t * 0.7); if (v > 1.2) g.set(x, 0, '~', C(0.3 + (v - 1.2) * 0.4)); }
    for (const o of s.motes) g.set(o.x + Math.sin(t * 0.2 + o.ph) * 1.5, o.y + Math.cos(t * 0.15 + o.ph) * 0.6, '.', C(o.b));
    for (let y = s.floor + 1; y < rows; y++) for (let x = 0; x < cols; x++) {
      const h = hash(x, y), dep = (y - s.floor) / (rows - s.floor);
      g.set(x, y, h < 0.05 ? 'o' : h < 0.55 ? '░' : h < 0.85 ? '▒' : '▓', h < 0.05 ? C(0.35) : H(38, 0.16 + h * 0.08 - dep * 0.04));
    }
    for (const w of s.weeds) {
      const ph = Math.floor(t * 1.6 + w.ph * 3);
      for (let k = 0; k < w.h; k++) {
        const u = k / w.h, sw = Math.sin(t * 1.1 + w.ph + k * 0.3) * u * 2.4, odd = (k + ph) & 1;
        g.set(w.x + sw + odd, s.floor - k, odd ? ')' : '(', H(w.hue, 0.2 + 0.24 * u));
      }
    }
    for (let k = s.bub.length - 1; k >= 0; k--) {
      const b = s.bub[k]; b.y -= b.v * dt; b.x += Math.sin(t * 3 + b.ph) * 0.06;
      if (b.y < 1) { s.bub.splice(k, 1); continue; }
      const u = 1 - b.y / s.floor;
      g.set(b.x, b.y, u < 0.35 ? '.' : u < 0.7 ? 'o' : 'O', C(0.45 + u * 0.25));
    }
    for (const fo of food) g.set(fo.x, fo.y / A, fo.land ? '.' : '•', H(30, fo.land ? 0.35 * Math.min(1, fo.life / 3) + 0.1 : 0.62));
    for (let sp = FISH.length - 1; sp >= 0; sp--) {
      const S = FISH[sp], eye = H(S.hue, 0.95);
      for (const a of F) {
        if (a.sp !== sp) continue;
        const str = a.dir > 0 ? S.r : S.l, L = str.length, x0 = Math.round(a.x - L / 2), y = Math.floor(a.y / A);
        const body = H(S.hue, 0.5 + a.shade + (a.fear > 0 && !shark ? 0.1 : 0));
        for (let k = 0; k < L; k++) { const c = str[k]; g.set(x0 + k, y, c, c === '°' ? eye : body); }
      }
    }
    if (shark) {
      const spr = sh.big ? (sh.dir > 0 ? SHARK_BR : SHARK_BL) : sh.dir > 0 ? SHARK_R : SHARK_L, x0 = Math.round(sh.x - sh.half), y0 = Math.round(sh.y / A) - (sh.big ? 4 : 2), bite = sh.bite > 0;
      for (let r = 0; r < spr.length; r++) {
        const L = spr[r], a = L.search(/[^ ]/), e = L.trimEnd().length;
        for (let k = 0; k < L.length; k++) { const c = L[k]; if (c !== ' ') g.set(x0 + k, y0 + r, c, c === '°' ? C(1) : C(bite ? 0.95 : 0.72)); else if (k > a && k < e && r > 1) g.set(x0 + k, y0 + r, ' ', '#000000'); }
      }
      if (bite) txt(g, sh.x + sh.dir * (sh.half + 1) - (sh.dir > 0 ? 0 : 2), Math.round(sh.y / A), sh.dir > 0 ? '<<' : '>>', C(1));
    }
    hud(f, shark ? tr(f, `捕獲 ${s.caught}`, `Caught ${s.caught}`) : tr(f, `餵食 ${s.eaten}`, `Fed ${s.eaten}`));
    if (!P.playing) hint(f, shark ? tr(f, '移動滑鼠當鯊魚・點一下咬', 'Move the mouse to be the shark · click to bite') : tr(f, '移動滑鼠讓魚跟著游・點一下撒飼料', 'Move the mouse and the fish follow · click to scatter food'));
  },
});

/* ════════════ 粒子磁場 ════════════ */
function magAI(s, f, ai) {
  const dt = f.dt;
  if (ai.ph === undefined) { ai.ph = rnd(TAU); ai.on = 1; ai.pt = rnd(10, 15); ai.ct = rnd(1.5, 3); ai.hold = 0; ai.tt = 0; }
  ai.tt += dt; ai.pt -= dt;
  if (ai.pt <= 0) { ai.on ^= 1; ai.pt = ai.on ? rnd(10, 16) : rnd(4, 7); }
  const iron = f.p.mode === 'iron';
  s.aiOn = iron || ai.on === 1;
  const u = ai.tt * (iron ? 0.12 : 0.16) + ai.ph;
  aiSeek(ai, f.cols * (0.5 + 0.36 * Math.sin(u * 1.3)), f.rows * (0.5 + 0.3 * Math.sin(u * 1.9 + 1)), dt, 1.4, 22);
  ai.down = false;
  if (s.aiOn) {
    ai.ct -= dt;
    if (ai.ct <= 0) {
      if (Math.random() < (iron ? 0.55 : 0.6)) ai.clicks.push({ x: ai.x, y: ai.y, button: 0 }); else ai.hold = rnd(0.8, 1.8);
      ai.ct = iron ? rnd(5, 9) : rnd(2.5, 5);
    }
    if (ai.hold > 0) { ai.hold -= dt; ai.down = true; }
  }
}
// 鐵粉：磁偶極的磁場 B = (3(m·r̂)r̂ − m)/r³，鐵粉沿著磁場方向排列
function magIron(s, f, P) {
  const { g, cols, rows, aspect: A, dt, C, H } = f, cur = s.cur;
  const nx = P.x, ny = P.y * A, dx = nx - cur.x, dy = ny - cur.y, mv = Math.hypot(dx, dy);
  if (mv > 0.3 && !P.jump) cur.a += angDiff(Math.atan2(dy, dx), cur.a) * (1 - Math.exp(-dt * 3 * Math.min(4, mv)));
  if (P.down) cur.a += 3 * dt;
  cur.x = nx; cur.y = ny;
  for (const c of P.clicks) { s.mags.push({ x: c.x, y: c.y * A, a: cur.a }); s.placed++; if (s.mags.length > 4) s.mags.shift(); }
  const ms = s.mags.slice(); if (P.on) ms.push(cur);
  const sc = Math.max(0.4, cols / 320), nm = ms.length, fil = s.fil, fch = s.fch, fl = s.fl;
  // 每格只重算一部分鐵粉（輪流），大畫面也不會太慢
  const np = s.parts; s.par = (s.par + 1) % np;
  for (let k = s.par; k < fil.length; k += np) {
    const i = fil[k], px = (i % cols) + 0.5, py = (((i / cols) | 0) + 0.5) * A;
    let bx = 0, by = 0;
    for (let q = 0; q < nm; q++) {
      const m = ms[q], ddx = (px - m.x) / sc, ddy = (py - m.y) / sc, r2 = ddx * ddx + ddy * ddy + 1.5, r = Math.sqrt(r2);
      const ux = ddx / r, uy = ddy / r, mx = Math.cos(m.a), my = Math.sin(m.a), md = mx * ux + my * uy, kk = 1 / (r2 * r);
      bx += (3 * md * ux - mx) * kk; by += (3 * md * uy - my) * kk;
    }
    const mag = Math.hypot(bx, by);
    fl[i] = nm ? clamp((Math.log10(mag + 1e-12) + 5.6) * 0.22, 0, 1) : 0.05;
    fch[i] = dirCh(bx, by, BOX);
  }
  const ch = g.ch, co = g.co;
  // 每一粒鐵粉都畫：遠處磁場弱的地方很暗但仍看得出方向，不會有一刀切的黑色區塊
  for (let k = 0; k < fil.length; k++) { const i = fil[k], L = 0.04 + 0.96 * fl[i]; ch[i] = fch[i]; co[i] = C(0.05 + L * 0.88); }
  for (const m of ms) {
    const L = Math.max(4.5, cols / 45), cx = Math.cos(m.a) * L, cy = Math.sin(m.a) * L, nst = Math.ceil(Math.max(Math.abs(cx) * 2, Math.abs(cy * 2 / A))) + 1;
    for (let k = 0; k <= nst; k++) { const u = k / nst; g.set(m.x - cx + 2 * cx * u, (m.y - cy + 2 * cy * u) / A, '█', u < 0.5 ? H(220, 0.55) : H(0, 0.55)); }
  }
  hud(f, tr(f, `磁鐵 ${s.mags.length}`, `Magnets ${s.mags.length}`));
  if (!P.playing) hint(f, tr(f, '移動磁鐵看磁力線・點一下放下磁鐵・按住旋轉', 'Move the magnet to see field lines · click to drop it · hold to rotate'));
}
const MAG_CH = ['.', '·', ':', '+', '*', '#'];
A({ id: 'ix-magnet', name: '粒子磁場', cat: '互動', theme: 'neon', hue: false, interactive: true,
  desc: '幾千顆粒子繞著游標轉；按住把粒子推開，點一下炸開',
  params: { mode: 'orbit' },
  variants: [
    { id: 'vortex', name: '漩渦', desc: '游標是漩渦中心：點一下留下新的漩渦，按住反轉方向', theme: 'cyber', params: { mode: 'vortex' } },
    { id: 'iron', name: '鐵粉', desc: '游標是一塊磁鐵，鐵粉排出磁力線；點一下放下磁鐵，按住旋轉', theme: 'mono', hue: true, params: { mode: 'iron' } },
  ],
  init(s, f) {
    const { cols, rows, aspect: A } = f, n = cols * rows;
    s.aiOn = true;
    if (f.p.mode === 'iron') {
      const dens = Math.min(0.5, 30000 / n); // 超大畫面時鐵粉稀一點
      s.fil = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (hash(x * 3 + 1, y * 7 + 3) < dens) s.fil.push(y * cols + x);
      s.parts = Math.max(2, Math.ceil(s.fil.length / 7000));
      s.fch = new Array(n).fill('·'); s.fl = new Float32Array(n);
      s.mags = []; s.cur = { x: cols / 2, y: rows / 2 * A, a: 0 }; s.par = 0; s.placed = 0;
      return;
    }
    const N = s.N = clamp(Math.round(n * 0.1), 320, 5000), W = cols, Hv = rows * A;
    s.X = new Float32Array(N); s.Y = new Float32Array(N); s.VX = new Float32Array(N); s.VY = new Float32Array(N);
    for (let i = 0; i < N; i++) { s.X[i] = rnd(W); s.Y[i] = rnd(Hv); s.VX[i] = rnd(-3, 3); s.VY[i] = rnd(-3, 3); }
    s.ACC = new Float32Array(n); s.SPD = new Float32Array(n);
    s.FW = Math.ceil(cols / 8) + 2; s.FH = Math.ceil(rows / 4) + 2; s.FL = new Float32Array(s.FW * s.FH * 2); s.ft = 0;
    s.vort = []; s.spin = 1; s.made = 0;
  },
  frame(s, f) {
    const { g, cols, rows, aspect: A, dt, t, C, H, p } = f;
    const P = ptr(s, f, ai => magAI(s, f, ai));
    if (p.mode === 'iron') return magIron(s, f, P);
    const N = s.N, X = s.X, Y = s.Y, VX = s.VX, VY = s.VY, ACC = s.ACC, SPD = s.SPD, FL = s.FL, FW = s.FW;
    const W = cols, Hv = rows * A, ia = 1 / A, vort = p.mode === 'vortex';
    // 流場（沒有磁鐵時粒子沿著它漂）：粗網格，每 0.25 秒更新一次
    s.ft -= dt;
    if (s.ft <= 0) {
      s.ft = 0.25;
      for (let gy = 0; gy < s.FH; gy++) for (let gx = 0; gx < FW; gx++) {
        const a = Noise.n3(gx * 0.3, gy * 0.42, t * 0.04) * TAU * 1.6, k = (gy * FW + gx) * 2;
        FL[k] = Math.cos(a) * 9; FL[k + 1] = Math.sin(a) * 9;
      }
    }
    const active = P.playing ? P.on : s.aiOn, down = P.down;
    const mx = P.x, my = P.y * A;
    const bursts = [];
    for (const c of P.clicks) {
      if (vort) { s.vort.push({ x: c.x, y: c.y * A, life: 7, spin: s.vort.length % 2 ? 1 : -1 }); if (s.vort.length > 5) s.vort.shift(); s.made++; }
      else { bursts.push(c.x, c.y * A); s.made++; }
    }
    for (let k = s.vort.length - 1; k >= 0; k--) if ((s.vort[k].life -= dt) <= 0) s.vort.splice(k, 1);
    const G = vort ? 450 : 1500, S = vort ? 2000 : 700, spin = vort && down ? -1 : 1, R0 = vort ? 3 : 5;
    const kf = dt * (active ? 0.25 : 1.1), damp = Math.exp(-dt * (active ? 0.9 : 0.35)), VM = 95, VM2 = VM * VM;
    const vs = s.vort, nv = vs.length, nb = bursts.length, k30 = dt * 30; // 每格的累積量乘上 dt：亮度不會因為 fps 不同而改變
    for (let i = 0; i < N; i++) {
      let x = X[i], y = Y[i], vx = VX[i], vy = VY[i];
      const fi = (((y * ia * 0.25) | 0) * FW + ((x * 0.125) | 0)) * 2;
      vx += (FL[fi] - vx) * kf; vy += (FL[fi + 1] - vy) * kf;
      if (active) {
        const dx = mx - x, dy = my - y, r = Math.sqrt(dx * dx + dy * dy + 9), ir = 1 / r;
        let ar, at;
        if (down && !vort) { ar = -3400 / (r + 6); at = 0; }
        else { ar = G * ir - (r < R0 ? (R0 - r) * 40 : 0); at = S * ir * spin; }
        vx += (dx * ar - dy * at) * ir * dt; vy += (dy * ar + dx * at) * ir * dt;
      }
      for (let k = 0; k < nv; k++) {
        const v = vs[k], dx = v.x - x, dy = v.y - y, r = Math.sqrt(dx * dx + dy * dy + 9), ir = 1 / r, w = Math.min(1, v.life / 2);
        const ar = 300 * ir * w, at = 1600 * ir * v.spin * w;
        vx += (dx * ar - dy * at) * ir * dt; vy += (dy * ar + dx * at) * ir * dt;
      }
      for (let k = 0; k < nb; k += 2) {
        const dx = x - bursts[k], dy = y - bursts[k + 1], d = Math.sqrt(dx * dx + dy * dy) + 0.5, R = 45;
        if (d < R) { const q = 140 * (1 - d / R) / d; vx += dx * q; vy += dy * q; }
      }
      vx *= damp; vy *= damp;
      const s2 = vx * vx + vy * vy;
      if (s2 > VM2) { const q = VM / Math.sqrt(s2); vx *= q; vy *= q; }
      x += vx * dt; y += vy * dt;
      if (x < 0) x += W; else if (x >= W) x -= W;
      if (y < 0) y += Hv; else if (y >= Hv) y -= Hv;
      X[i] = x; Y[i] = y; VX[i] = vx; VY[i] = vy;
      const ci = ((y * ia) | 0) * cols + (x | 0);
      if (ci >= 0 && ci < ACC.length) { const sp = Math.sqrt(s2); ACC[ci] += (0.1 + sp * 0.007) * k30; if (SPD[ci] < sp) SPD[ci] = sp; }
    }
    // 累積亮度 → 字元（每格衰減，留下發光的尾巴）
    // 單獨一顆粒子也要看得見：色階起點依和背景的對比挑（霓虹的暗紫色階前半段幾乎看不見）
    const dec = Math.exp(-dt * 8), n = cols * rows, ch = g.ch, co = g.co, lo = rampT(f, 2.2, 0.12), span = (0.97 - lo) / 2.2 * 0.8;
    for (let i = 0; i < n; i++) {
      const a = ACC[i];
      if (a < 0.06) { if (a > 0) { ACC[i] = 0; SPD[i] = 0; } continue; }
      const L = a < 0.2 ? 0 : a < 0.45 ? 1 : a < 0.8 ? 2 : a < 1.3 ? 3 : a < 2 ? 4 : 5;
      ch[i] = MAG_CH[L]; co[i] = C(lo + Math.min(a, 2.2) * span + SPD[i] * 0.004);
      ACC[i] = a * dec; SPD[i] *= dec;
    }
    if (active && !P.playing) g.set(mx, P.y, '◆', C(1));
    for (const v of vs) g.set(v.x, v.y * ia, v.spin > 0 ? '@' : 'O', C(0.5 + Math.min(1, v.life / 2) * 0.5));
    hud(f, vort ? tr(f, `漩渦 ${s.made}`, `Vortices ${s.made}`) : tr(f, `炸開 ${s.made}`, `Bursts ${s.made}`));
    if (!P.playing) hint(f, vort ? tr(f, '移動滑鼠攪動粒子・點一下留下漩渦・按住反轉', 'Move the mouse to stir · click to leave a vortex · hold to reverse') : tr(f, '移動滑鼠吸引粒子・按住推開・點一下炸開', 'Move the mouse to attract particles · hold to push · click to burst'));
  },
});

/* ════════════ 點擊煙火 ════════════ */
const FW_STYLES = ['peony', 'ring', 'willow', 'palm', 'cross', 'heart', 'double', 'glitter'];
function fwSpark(s, x, y, vx, vy, life, hue, k) {
  if (s.n >= s.M) return;
  const i = s.n++;
  s.X[i] = x; s.Y[i] = y; s.VX[i] = vx; s.VY[i] = vy; s.L[i] = life; s.ML[i] = life; s.HU[i] = hue; s.K[i] = k;
}
function fwStyle(s) { if (!s.bag.length) { s.bag = FW_STYLES.slice(); for (let i = s.bag.length - 1; i > 0; i--) { const j = rint(0, i); [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]]; } } return s.bag.pop(); }
function fwLaunch(s, f, x, y, delay, style) {
  const { cols, rows, aspect: A } = f;
  x = clamp(x, 2, cols - 3); y = clamp(y, 1.5, rows * 0.8);
  s.rk.push({ x0: clamp(x + rnd(-3, 3), 1, cols - 2), y0: rows * A, x1: x, y1: y * A, u: 0, T: 0.55 + 0.9 * (rows - y) / rows, hue: rnd(360), style: style || fwStyle(s), delay: delay || 0 });
}
function fwBurst(s, f, x, y, style, hue, small) {
  const R = s.R * (small ? 0.35 : rnd(0.85, 1.1)), V = R * 1.8, sz = s.sz * (small ? 0.3 : 1);
  s.count += small ? 0 : 1;
  if (!small) { s.flash = 1; s.flashX = x; s.flashHue = hue; }
  const ia = 1 / f.aspect, cx = x | 0, cy = (y * ia) | 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) { const X = cx + dx, Y = cy + dy; if (X >= 0 && Y >= 0 && X < f.cols && Y < f.rows) { const i = Y * f.cols + X; s.GI[i] += small ? 0.4 : 0.9; s.GH[i] = hue; } }
  const n = k => Math.max(6, Math.round(k * sz));
  switch (style) {
    case 'ring': {
      const N = n(70), tilt = rnd(0.35, 1), rot = rnd(TAU), cr = Math.cos(rot), sr = Math.sin(rot);
      for (let i = 0; i < N; i++) { const a = i / N * TAU + rnd(-0.03, 0.03), ex = Math.cos(a) * V, ey = Math.sin(a) * V * tilt; fwSpark(s, x, y, ex * cr - ey * sr, ex * sr + ey * cr, rnd(1.2, 1.5), hue + rnd(-6, 6), 0); }
      break;
    }
    case 'willow': for (let i = 0, N = n(80); i < N; i++) { const a = rnd(TAU), sp = V * 0.7 * Math.sqrt(rnd(0.15, 1)); fwSpark(s, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(2.4, 3.3), 42 + rnd(-6, 6), 1); } break;
    case 'palm': {
      const arms = rint(6, 8);
      for (let k = 0; k < arms; k++) { const a = -Math.PI / 2 + (k / arms - 0.5) * 3.6 + rnd(-0.15, 0.15); for (let j = 0; j < n(10); j++) { const sp = V * (0.4 + j / n(10) * 0.65); fwSpark(s, x, y, Math.cos(a) * sp + rnd(-1, 1), Math.sin(a) * sp, rnd(1.4, 1.9), hue + rnd(-8, 8), 1); } }
      break;
    }
    case 'cross': for (let i = 0, N = n(16); i < N; i++) { const a = i / N * TAU; fwSpark(s, x, y, Math.cos(a) * V * 0.62, Math.sin(a) * V * 0.62, rnd(0.5, 0.65), hue, 4); } break;
    case 'heart': for (let i = 0, N = n(90); i < N; i++) {
      const q = i / N * TAU, hx = 16 * Math.pow(Math.sin(q), 3), hy = -(13 * Math.cos(q) - 5 * Math.cos(2 * q) - 2 * Math.cos(3 * q) - Math.cos(4 * q));
      fwSpark(s, x, y, hx / 16 * V * 0.85, hy / 16 * V * 0.85, rnd(1.4, 1.7), 340 + rnd(-8, 8), 32);
    } break;
    case 'double': {
      const h2 = (hue + rnd(90, 180)) % 360;
      for (let i = 0, N = n(50); i < N; i++) { const a = rnd(TAU), c = rnd(-1, 1), sp = V * 0.5 * Math.sqrt(1 - c * c); fwSpark(s, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(1.1, 1.5), h2, 0); }
      for (let i = 0, N = n(64); i < N; i++) { const a = i / N * TAU; fwSpark(s, x, y, Math.cos(a) * V, Math.sin(a) * V, rnd(1.3, 1.6), hue, 0); }
      break;
    }
    case 'glitter': for (let i = 0, N = n(85); i < N; i++) { const a = rnd(TAU), c = rnd(-1, 1), sp = V * Math.sqrt(1 - c * c) * rnd(0.9, 1); fwSpark(s, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(1.3, 1.9), 48, 2 | 8); } break;
    case 'multi': for (let i = 0, N = 6; i < N; i++) { const a = i / N * TAU + rnd(-0.2, 0.2); fwSpark(s, x, y, Math.cos(a) * V * 0.55, Math.sin(a) * V * 0.55, rnd(0.5, 0.7), (hue + i * 50) % 360, 64); } break;
    default: for (let i = 0, N = n(small ? 70 : 100); i < N; i++) { const a = rnd(TAU), c = rnd(-1, 1), sp = V * Math.sqrt(1 - c * c) * rnd(0.92, 1); fwSpark(s, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(1.1, 1.7), hue + rnd(-8, 8), Math.random() < 0.25 ? 8 : 0); }
  }
}
A({ id: 'ix-fireworks', name: '點擊煙火', cat: '互動', theme: 'synth', hue: true, interactive: true,
  desc: '點一下就在那裡炸開一朵煙火（好幾種花樣），按住連發',
  params: { salvo: 1, rate: 1 },
  variants: [
    { id: 'salvo', name: '齊射', desc: '每點一下扇形齊射五發、還會二次開花；沒人玩時是盛大的煙火秀', theme: 'ocean', params: { salvo: 5, rate: 1.8 } },
  ],
  init(s, f) {
    const { cols, rows, aspect: A } = f;
    s.R = clamp(Math.min(cols * 0.11, rows * A * 0.2), 7, 60);
    s.sz = clamp(s.R / 30, 0.45, 1.6);
    const M = s.M = clamp(Math.round(cols * rows * 0.12), 1200, 6000);
    s.X = new Float32Array(M); s.Y = new Float32Array(M); s.VX = new Float32Array(M); s.VY = new Float32Array(M);
    s.L = new Float32Array(M); s.ML = new Float32Array(M); s.HU = new Float32Array(M); s.K = new Uint8Array(M); s.n = 0;
    s.GI = new Float32Array(cols * rows); s.GH = new Float32Array(cols * rows);
    s.rk = []; s.next = 0.3; s.count = 0; s.flash = 0; s.flashX = 0; s.flashHue = 0; s.holdT = 0; s.bag = [];
    s.top = new Int16Array(cols);
    const maxH = Math.max(2, Math.round(rows * 0.16)), wk = cols > 200 ? 2 : 1;
    for (let x = 0; x < cols;) { const w = rint(3, 9) * wk, h = Math.random() < 0.15 ? 0 : rint(1, maxH); for (let k = 0; k < w && x + k < cols; k++) s.top[x + k] = rows - h; x += w; }
    s.stars = Array.from({ length: Math.round(cols * rows / 110) }, () => ({ x: rint(0, cols - 1), y: rint(0, Math.floor(rows * 0.75)), ph: rnd(TAU), b: rnd(0.1, 0.32) }));
  },
  frame(s, f) {
    const { g, cols, rows, aspect: A, dt, t, C, H, p } = f, ia = 1 / A;
    const P = ptr(s, f, null);
    // ── 發射 ──
    const salvo = p.salvo || 1;
    const fire = (x, y) => {
      if (salvo > 1) { const st = fwStyle(s); for (let k = 0; k < salvo; k++) { const o = k - (salvo - 1) / 2; fwLaunch(s, f, x + o * s.R * 0.75, y - Math.abs(o) * s.R * 0.12 + rnd(-1, 1), Math.abs(o) * 0.12, k === (salvo - 1) / 2 ? 'multi' : st); } }
      else fwLaunch(s, f, x, y);
    };
    for (const c of P.clicks) fire(c.x, c.y);
    if (P.playing && P.down) { s.holdT += dt; if (s.holdT > (salvo > 1 ? 0.6 : 0.3)) { s.holdT = 0; fire(P.x + rnd(-2, 2), P.y + rnd(-1, 1)); } } else s.holdT = 0;
    if (!P.playing) {
      // 自動煙火秀：隨機發射，偶爾左右對稱，偶爾一段密集的壓軸
      s.next -= dt * (p.rate || 1);
      if (s.next <= 0) {
        const r = Math.random();
        if (r < 0.07) { for (let k = 0; k < 10; k++) fwLaunch(s, f, rnd(cols * 0.1, cols * 0.9), rnd(rows * 0.1, rows * 0.45), k * 0.22); s.next = 4; }
        else if (r < 0.25) { const x = rnd(cols * 0.12, cols * 0.4), y = rnd(rows * 0.12, rows * 0.45), st = fwStyle(s); fwLaunch(s, f, x, y, 0, st); fwLaunch(s, f, cols - x, y, 0, st); s.next = rnd(0.8, 1.8); }
        else if (salvo > 1 && r < 0.45) { fire(rnd(cols * 0.25, cols * 0.75), rnd(rows * 0.2, rows * 0.4)); s.next = rnd(1.5, 2.5); }
        else { fwLaunch(s, f, rnd(cols * 0.08, cols * 0.92), rnd(rows * 0.1, rows * 0.5)); s.next = rnd(0.4, 1.5); }
      }
    }
    // ── 火箭 ──
    const GI = s.GI, GH = s.GH;
    const k30 = dt * 30; // 每格留下的光量乘上 dt，亮度和 fps 無關
    const dep = (x, y, a, h) => { const X = x | 0, Y = (y * ia) | 0; if (X >= 0 && Y >= 0 && X < cols && Y < rows) { const i = Y * cols + X; GI[i] += a; GH[i] = h; } };
    for (let k = s.rk.length - 1; k >= 0; k--) {
      const r = s.rk[k];
      if (r.delay > 0) { r.delay -= dt; continue; }
      r.u += dt / r.T;
      if (r.u >= 1) { fwBurst(s, f, r.x1, r.y1, r.style, r.hue, false); s.rk.splice(k, 1); continue; }
      const e = 1 - (1 - r.u) * (1 - r.u), x = lerp(r.x0, r.x1, e), y = lerp(r.y0, r.y1, e);
      r.x = x; r.y = y;
      dep(x, y, 0.22 * k30, 35);
      if (Math.random() < 0.4) fwSpark(s, x, y, rnd(-2, 2), rnd(2, 6), rnd(0.25, 0.5), 38, 16);
    }
    // ── 火花 ──
    const X = s.X, Y = s.Y, VX = s.VX, VY = s.VY, L = s.L, ML = s.ML, HU = s.HU, K = s.K;
    for (let i = 0; i < s.n; i++) {
      const l = L[i] - dt, k = K[i];
      if (l <= 0) {
        if (k & 4) for (let q = 0; q < 4; q++) { const a = Math.atan2(VY[i], VX[i]) + Math.PI / 4 + q * Math.PI / 2; fwSpark(s, X[i], Y[i], Math.cos(a) * s.R * 0.6, Math.sin(a) * s.R * 0.6, rnd(0.5, 0.75), (HU[i] + 40) % 360, 0); }
        if (k & 64) fwBurst(s, f, X[i], Y[i], 'peony', HU[i], true);
        if (k & 8) dep(X[i], Y[i], 0.8, 55);
        const j = --s.n;
        X[i] = X[j]; Y[i] = Y[j]; VX[i] = VX[j]; VY[i] = VY[j]; L[i] = L[j]; ML[i] = ML[j]; HU[i] = HU[j]; K[i] = K[j];
        i--; continue;
      }
      L[i] = l;
      const drag = Math.exp(-dt * (k & 1 ? 2.4 : 1.8)), grav = k & 1 ? 9 : k & 32 ? 4 : 15;
      VX[i] *= drag; VY[i] = VY[i] * drag + grav * dt;
      X[i] += VX[i] * dt; Y[i] += VY[i] * dt;
      dep(X[i], Y[i], (k & 1 ? 0.5 : k & 16 ? 0.08 : k & 2 ? 0.15 : 0.26) * k30, HU[i]);
    }
    // ════ 畫面 ════
    for (const st of s.stars) { const b = st.b * (0.6 + 0.4 * Math.sin(t * 1.3 + st.ph)); g.set(st.x, st.y, b > 0.26 ? '+' : '.', C(b)); }
    const dec = Math.exp(-dt * (s.n > s.M * 0.5 ? 7 : 5.5)), n = cols * rows, ch = g.ch, co = g.co;
    for (let i = 0; i < n; i++) {
      const a = GI[i];
      if (a < 0.1) { if (a > 0) GI[i] = a < 0.02 ? 0 : a * dec; continue; }
      ch[i] = a < 0.3 ? '.' : a < 0.65 ? '·' : a < 1.1 ? ':' : '+';
      co[i] = H(GH[i], Math.min(0.72, 0.08 + a * 0.42));
      GI[i] = a * dec;
    }
    for (let i = 0; i < s.n; i++) {
      const u = L[i] / ML[i], k = K[i];
      if (k & 2) { if (((t * 16 + i) | 0) % 3 === 0) g.set(X[i], Y[i] * ia, '*', H(50, 0.98)); continue; }
      if (k & 16) { g.set(X[i], Y[i] * ia, '.', H(38, 0.3 + 0.4 * u)); continue; }
      g.set(X[i], Y[i] * ia, u > 0.55 ? '*' : u > 0.25 ? '+' : '·', H(HU[i], 0.35 + 0.6 * u));
    }
    for (const r of s.rk) if (r.delay <= 0 && r.x !== undefined) g.set(r.x, r.y * ia, '|', H(40, 0.95));
    // 城市剪影（煙火的光照亮大樓）
    s.flash *= Math.exp(-dt * 4);
    for (let x = 0; x < cols; x++) {
      const tp = s.top[x], lit = s.flash * Math.exp(-Math.abs(x - s.flashX) / (cols * 0.3)) * 0.14;
      for (let y = tp; y < rows; y++) {
        const h = hash(x, y);
        if (y > tp && h < 0.14 && ((x + y) & 1)) g.set(x, y, '▪', H(42, hash(x, y + ((t / 9 + h * 7) | 0)) < 0.75 ? 0.42 : 0.12));
        else g.set(x, y, '█', C(0.05 + lit));
      }
    }
    hud(f, tr(f, `煙火 ${s.count}`, `Fireworks ${s.count}`));
    if (!P.playing) hint(f, salvo > 1 ? tr(f, '點一下齊射五發・按住連發', 'Click to fire a volley of five · hold for rapid fire') : tr(f, '點一下放煙火・按住連發', 'Click to launch a firework · hold for rapid fire'));
  },
});
/* ════════════ 沙畫 ════════════ */
const SAND_PAL = [40, 26, 12, 350, 200, 170, 48, 30];
// 換下一個沙的顏色（都從同一組調和的色盤裡挑）
function sandColour(s, k) { s.pi = (((s.pi + k) % SAND_PAL.length) + SAND_PAL.length) % SAND_PAL.length; s.hue = SAND_PAL[s.pi] + rnd(-6, 6); }
function sandPut(s, i, hue, lum) { s.T[i] = 1; s.HU[i] = ((Math.round(hue) % 360) + 360) % 360; s.LU[i] = lum; s.CH[i] = Math.random() < 0.22 ? 1 : 0; s.FA[i] = 0; s.count++; }
// 落沙：由下往上掃，每一列交替方向；能往下掉就掉（一次最多 maxFall 格），否則往斜下滑，再不行就有機會往旁邊滑一格（坡度比較緩）
function sandStep(s) {
  const W = s.W, H = s.H, T = s.T, HU = s.HU, LU = s.LU, CH = s.CH, ST = s.ST, FA = s.FA;
  const st = s.stamp = s.stamp >= 250 ? 1 : s.stamp + 1, mf = s.maxFall;
  const mv = (i, j, fl) => { T[j] = 1; HU[j] = HU[i]; LU[j] = LU[i]; CH[j] = CH[i]; ST[j] = st; FA[j] = fl ? Math.min(3, FA[i] + 1) : 0; T[i] = 0; FA[i] = 0; };
  for (let y = H - 2; y >= 0; y--) {
    const ltr = ((y + st) & 1) === 0, row = y * W;
    for (let k = 0; k < W; k++) {
      const x = ltr ? k : W - 1 - k, i = row + x;
      if (T[i] !== 1 || ST[i] === st) continue;
      const j = i + W;
      if (T[j] === 0) {
        let ny = y + 1;
        while (ny + 1 < H && ny - y < mf && T[(ny + 1) * W + x] === 0) ny++;
        mv(i, ny * W + x, 1); continue;
      }
      FA[i] = 0;
      const d = Math.random() < 0.5 ? 1 : -1;
      if (x + d >= 0 && x + d < W && T[j + d] === 0 && T[i + d] === 0) { mv(i, j + d, 0); continue; }
      if (x - d >= 0 && x - d < W && T[j - d] === 0 && T[i - d] === 0) { mv(i, j - d, 0); continue; }
      const x3 = x + 2 * d;
      if (x3 >= 0 && x3 < W && Math.random() < 0.55 && T[i + d] === 0 && T[j + 2 * d] === 0) mv(i, i + d, 0);
    }
  }
}
function sandGlassInit(s, f) {
  const { cols, aspect: A } = f, W = s.W, H = s.H;
  const y0 = 2, y1 = H - 3, Hh = y1 - y0, K = W - 1;
  // 玻璃壁要比沙的安息角陡（每列最多移 1 格），上半部的沙才會全部流光
  const maxHalf = Math.max(4, Math.min(cols * 0.3, Hh * 0.43)), neck = Math.max(0.6, cols / 450);
  const xl = s.gxl = new Int16Array(H), xr = s.gxr = new Int16Array(H);
  s.gy0 = y0; s.gy1 = y1; s.gmid = (y0 + y1) / 2;
  let area = 0;
  for (let y = 0; y < H; y++) {
    let a = W, b = -1;
    if (y >= y0 && y <= y1) {
      const u = (y - y0) / Hh, v = Math.abs(2 * u - 1), hw = neck + (maxHalf - neck) * v * (1.1 - 0.1 * v);
      a = Math.round(K / 2 - hw); b = K - a; area += b - a + 1;
    }
    xl[y] = a; xr[y] = b;
    for (let x = 0; x < W; x++) s.T[y * W + x] = x >= a && x <= b ? 0 : 2;
  }
  s.cap = Math.round(area * 0.46);
  // 上半部從瓶頸往上一層一層裝滿彩色的沙（像沙畫瓶）
  let want = Math.round(area * 0.4);
  const band = Math.max(2, Math.round(Hh / 16)), off = rint(0, 7);
  for (let y = Math.floor(s.gmid) - 1; y >= y0 && want > 0; y--) {
    const layer = Math.floor((Math.floor(s.gmid) - 1 - y) / band), hue = SAND_PAL[(layer + off) % SAND_PAL.length];
    for (let x = xl[y]; x <= xr[y] && want > 0; x++) { sandPut(s, y * W + x, hue + rnd(-6, 6), rint(36, 52)); want--; }
  }
}
function sandFlip(s) {
  const W = s.W, y0 = s.gy0, y1 = s.gy1, keys = ['T', 'HU', 'LU', 'CH', 'FA'];
  for (let y = y0; y < y0 + y1 - y; y++) {
    const a = y * W, b = (y0 + y1 - y) * W;
    for (const k of keys) { const A = s[k]; for (let x = 0; x < W; x++) { const v = A[a + x]; A[a + x] = A[b + x]; A[b + x] = v; } }
  }
}
// 沙漏滿了：從玻璃裡最低、有沙的那一列拿掉一粒（輪流從左到右拿，各欄一起下沉，層次不會被拉花）
function sandRecycle(s) {
  const W = s.W, T = s.T;
  for (let y = s.gy1; y >= s.gy0; y--) {
    const a = s.gxl[y], b = s.gxr[y], n = b - a + 1;
    if (n <= 0) continue;
    for (let k = 0; k < n; k++) {
      const x = a + ((s.rcx + k) % n), i = y * W + x;
      if (T[i] === 1) { T[i] = 0; s.count--; s.rcx = (s.rcx + k + 1) % n; return true; }
    }
  }
  return false;
}
// 示範 AI 找下一段要倒沙的地方：挑沙面最低的一段（畫面才會整片都有沙），方向隨機
function sandSweep(s, f, ai) {
  const { cols, rows } = f, W = s.W, Hs = s.H, T = s.T, L = rnd(0.15, 0.4) * cols, step = Math.max(1, Math.floor(W / 80));
  const top = x => { for (let y = 0; y < Hs; y++) if (T[y * W + x] === 1) return y; return Hs; };
  let best = null, bs = -1e9;
  for (let k = 0; k < 8; k++) {
    const a = rnd(2, Math.max(3, cols - 3 - L)); let sum = 0, n = 0, hi = Hs;
    for (let x = Math.floor(a); x < a + L && x < W; x += step) { const t = top(x); sum += t; n++; if (t < hi) hi = t; }
    const sc = sum / Math.max(1, n) + rnd(0, Hs * 0.12);
    if (sc > bs) { bs = sc; best = { a, hi }; }
  }
  const fw = Math.random() < 0.5;
  ai.sx = fw ? best.a : best.a + L; ai.ex = fw ? best.a + L : best.a;
  ai.sy = clamp(Math.min(rnd(rows * 0.08, rows * 0.3), best.hi - 3), 1, rows - 3);
}
function sandAI(s, f, ai) {
  const { cols, rows, dt } = f;
  if (ai.mode === undefined) { ai.mode = 0; ai.t = 0.5; ai.sx = cols * 0.3; ai.sy = rows * 0.2; ai.ex = cols * 0.7; ai.T = 4; ai.wait = 0; ai.pt = rnd(8, 14); ai.held = false; }
  ai.t -= dt;
  if (f.p.glass) {
    // 沙漏：上半部漏光了就等一下再翻轉；偶爾按住在上半部加一點新顏色的沙（先點一下再按住，和真人一樣）
    aiSeek(ai, cols / 2 + Math.sin(f.t * 0.4) * cols * 0.12, s.gy0 + 3 + Math.sin(f.t * 0.3) * 2, dt, 1.2, 15);
    ai.down = false;
    ai.pt -= dt;
    if (ai.pt < 0 && ai.pt > -1.2 && (ai.held || (s.flipU < 0 && s.upper > 30))) {
      if (!ai.held) { ai.clicks.push({ x: ai.x, y: ai.y, button: 0 }); ai.held = true; }
      ai.down = true;
    } else if (ai.pt <= -1.2 || (ai.pt < 0 && !ai.held)) { ai.pt = rnd(18, 30); ai.held = false; }
    if (!ai.held && s.flipU < 0 && s.upper < 3) { ai.wait += dt; if (ai.wait > 1.6) { ai.clicks.push({ x: ai.x, y: ai.y, button: 0 }); ai.wait = 0; } }
    return;
  }
  if (ai.mode === 0) {
    ai.down = false;
    const d = aiSeek(ai, ai.sx, ai.sy, dt, 2, 45);
    if (ai.t <= 0 && d < 2 && s.count / (s.W * s.H) < 0.42) { ai.mode = 1; ai.T = ai.t = rnd(2.5, 5.5); sandColour(s, rint(1, 3)); }
  } else {
    ai.down = true;
    const u = 1 - ai.t / ai.T;
    aiSeek(ai, lerp(ai.sx, ai.ex, u), ai.sy + Math.sin(u * TAU) * rows * 0.04, dt, 3, 60);
    if (ai.t <= 0) { ai.mode = 0; ai.t = rnd(0.3, 1.2); sandSweep(s, f, ai); }
  }
}
A({ id: 'ix-sand', name: '沙畫', cat: '互動', theme: 'sunset', hue: true, interactive: true,
  desc: '按住滑鼠從游標倒出彩色的沙，沙會堆積、慢慢從底下漏掉',
  params: { glass: 0 },
  variants: [
    { id: 'glass', name: '沙漏', desc: '點一下翻轉沙漏，按住在玻璃裡加沙', theme: 'gold', params: { glass: 1 } },
  ],
  init(s, f) {
    const { cols, rows } = f;
    s.W = cols; s.H = rows - 1;
    const n = s.W * s.H;
    s.T = new Uint8Array(n); s.HU = new Uint16Array(n); s.LU = new Uint8Array(n); s.CH = new Uint8Array(n); s.ST = new Uint8Array(n); s.FA = new Uint8Array(n);
    s.stamp = 1; s.count = 0; s.pi = rint(0, SAND_PAL.length - 1); s.hue = SAND_PAL[s.pi]; s.pacc = 0; s.maxFall = Math.max(1, Math.round(rows / 40)); s.flipU = -1; s.flips = 0; s.upper = 0; s.press = null; s.sacc = 0; s.dacc = 0; s.dx = 0; s.rcx = 0;
    if (f.p.glass) { sandGlassInit(s, f); return; }
    // 開場先鋪幾層起伏的彩色沙丘，畫面不會空白
    const base = rows * 0.13, p1 = rnd(TAU), p2 = rnd(TAU), p3 = rnd(TAU), band = Math.max(2, base * 0.33), off = rint(0, 7);
    for (let x = 0; x < cols; x++) {
      const h = Math.round(base * (1 + 0.45 * Math.sin(x * 0.045 + p1) + 0.25 * Math.sin(x * 0.13 + p2)));
      for (let k = 0; k < h; k++) {
        const layer = Math.floor((k + 2 * Math.sin(x * 0.07 + p3)) / band), hue = SAND_PAL[((layer + off) % 8 + 8) % 8];
        sandPut(s, (s.H - 1 - k) * cols + x, hue + rnd(-6, 6), 36 + ((layer * 5) % 12));
      }
    }
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, C, H, p } = f, W = s.W, Hs = s.H, glass = !!p.glass;
    const P = ptr(s, f, ai => sandAI(s, f, ai));
    if (P.wheel) sandColour(s, sgn(P.wheel));
    const pour = (x, y, n, hue) => {
      for (let k = 0; k < n; k++) {
        const gx = Math.round(x + gauss() * 0.9), gy = Math.round(y + gauss() * 0.45);
        if (gx < 0 || gx >= W || gy < 0 || gy >= Hs - 1) continue;
        const i = gy * W + gx;
        if (s.T[i] === 0 && (!glass || s.count < s.cap || sandRecycle(s))) sandPut(s, i, hue + rnd(-7, 7), rint(34, 50));
      }
    };
    // ── 滑鼠 ──
    const rate = 90 * Math.max(1, cols / 160);
    if (glass) {
      for (const c of P.clicks) if (s.flipU < 0) { s.press = { t: 0, hold: false }; sandColour(s, 1); }
      if (s.press) {
        if (P.down) { s.press.t += dt; if (s.press.t > 0.22) s.press.hold = true; }
        else { if (!s.press.hold && s.flipU < 0) { s.flipU = 0; s.flipped = false; s.flips++; } s.press = null; }
      }
      if (P.down && s.press && s.press.hold && s.flipU < 0) { s.pacc += dt * rate * 0.6; const k = s.pacc | 0; s.pacc -= k; pour(P.x, P.y, k, s.hue); }
    } else {
      for (const c of P.clicks) { if (P.playing) sandColour(s, 1); pour(c.x, c.y, 18, s.hue); }
      if (P.down) { s.pacc += dt * rate; const k = s.pacc | 0; s.pacc -= k; pour(P.x, P.y, k, s.hue + Math.sin(t * 0.7) * 8); }
    }
    // ── 模擬（固定每秒 30 步，和 fps、速度設定無關） ──
    if (glass && s.flipU >= 0) {
      s.flipU += dt / 0.7;
      if (s.flipU >= 0.5 && !s.flipped) { sandFlip(s); s.flipped = true; }
      if (s.flipU >= 1) s.flipU = -1;
    } else {
      s.sacc = Math.min(s.sacc + dt * 30, 3);
      while (s.sacc >= 1) { s.sacc -= 1; sandStep(s); }
    }
    if (!glass) {
      // 底部慢慢漏沙；越滿漏得越快。由左到右一欄一欄地漏，所有欄一起下沉，沙的層次才不會被拉成直條紋
      const fill = s.count / (W * Hs), row = (Hs - 1) * W;
      s.dacc += (0.03 + Math.max(0, fill - 0.25) * 3) * dt * W;
      let k = Math.min(W, s.dacc | 0); s.dacc -= k;
      for (; k > 0; k--) { const i = row + s.dx; if (s.T[i] === 1) { s.T[i] = 0; s.count--; } s.dx = s.dx + 1 < W ? s.dx + 1 : 0; }
    }
    // ════ 畫面 ════
    const T = s.T, HU = s.HU, LU = s.LU, CH = s.CH, FA = s.FA, ch = g.ch, co = g.co;
    const c = glass && s.flipU >= 0 ? Math.abs(Math.cos(Math.PI * s.flipU)) : 1, cy = glass ? s.gmid : 0;
    let upper = 0;
    if (c === 1) {
      const mid = glass ? s.gmid : 0;
      for (let i = 0, n = W * Hs; i < n; i++) {
        if (T[i] !== 1) continue;
        ch[i] = FA[i] > 1 ? '•' : CH[i] ? '▓' : '█'; co[i] = H(HU[i], LU[i] / 100);
        if (glass && i < mid * W) upper++;
      }
    } else {
      for (let y = 0; y < Hs; y++) { const yy = Math.round(cy + (y - cy) * c); for (let x = 0; x < W; x++) { const i = y * W + x; if (T[i] === 1) g.set(x, yy, '█', H(HU[i], LU[i] / 100)); } }
    }
    s.upper = upper;
    if (glass) {
      const xl = s.gxl, xr = s.gxr, y0 = s.gy0, y1 = s.gy1, glassCol = H(195, 0.5), wood = H(28, 0.34);
      const Y = y => Math.round(cy + (y - cy) * c);
      for (let y = y0; y <= y1; y++) {
        const nb = y < y1 ? y + 1 : y, pb = y > y0 ? y - 1 : y, lo = Math.min(xl[y], xl[nb], xl[pb]), dl = xl[nb] - xl[pb];
        const lc = dl > 0 ? '\\' : dl < 0 ? '/' : '│', rc = dl > 0 ? '/' : dl < 0 ? '\\' : '│';
        for (let x = lo - 1; x <= xl[y] - 1; x++) { g.set(x, Y(y), lc, glassCol); g.set(W - 1 - x, Y(y), rc, glassCol); }
      }
      const wx0 = xl[y0] - 3, wx1 = xr[y0] + 3;
      for (let x = wx0; x <= wx1; x++) { g.set(x, Y(y0 - 1), '▄', wood); g.set(x, Y(y1 + 1), '▀', wood); }
      for (let y = y0; y <= y1; y++) { g.set(wx0, Y(y), '║', wood); g.set(wx1, Y(y), '║', wood); }
      for (let x = 0; x < cols; x++) g.set(x, rows - 1, '▀', H(28, 0.14));
      // 背景：桌面上方淡淡的灰塵光點
      for (let k = 0; k < 40; k++) { const x = hash(k, 3) * cols, y = (hash(k, 7) * (rows - 2) + t * (0.3 + hash(k, 9))) % (rows - 2); if (x < wx0 - 1 || x > wx1 + 1) g.set(x, y, '.', C(0.15 + 0.1 * hash(k, 11))); }
    } else {
      for (let x = 0; x < cols; x++) g.set(x, rows - 1, '▀', C(0.16 + 0.04 * hash(x, 1)));
    }
    if (glass) hud(f, tr(f, `翻轉 ${s.flips}`, `Flips ${s.flips}`));
    else hud(f, tr(f, '■ 沙 ', '■ Sand ') + `${Math.round(s.count / (W * Hs) * 100)}%`, H(s.hue, 0.62));
    if (!P.playing) hint(f, glass ? tr(f, '點一下翻轉沙漏・按住加沙', 'Click to flip the hourglass · hold to add sand') : tr(f, '按住滑鼠倒沙・沙會從底下慢慢漏掉', 'Hold the mouse button to pour sand · it slowly drains away below'));
  },
});

/* ════════════ 生命畫布 ════════════ */
const LIFE_PAT = {
  glider: ['.O.', '..O', 'OOO'],
  lwss: ['.O..O', 'O....', 'O...O', 'OOOO.'],
  rpent: ['.OO', 'OO.', '.O.'],
  acorn: ['.O.....', '...O...', 'OO..OOO'],
  diehard: ['......O.', 'OO......', '.O...OOO'],
  rep: ['..OOO', '.O..O', 'O...O', 'O..O.', 'OOO..'],
  gun: ['........................O...........', '......................O.O...........', '............OO......OO............OO',
    '...........O...O....OO............OO', 'OO........O.....O...OO..............', 'OO........O...O.OO....O.O...........',
    '..........O.....O.......O...........', '...........O...O....................', '............OO......................'],
};
function lifeSet(s, x, y) {
  x = ((Math.round(x) % s.bw) + s.bw) % s.bw; y = ((Math.round(y) % s.bh) + s.bh) % s.bh;
  const i = y * s.bw + x; s.A[i] = 1; s.AG[i] = 0; s.GH[i] = 0;
}
function lifeStamp(s, name, cx, cy) {
  const pat = LIFE_PAT[name], rot = rint(0, 3), fl = Math.random() < 0.5, h = pat.length, w = pat[0].length;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (pat[r][c] !== 'O') continue;
    let dx = (fl ? w - 1 - c : c) - (w >> 1), dy = r - (h >> 1);
    for (let k = 0; k < rot; k++) { const t = dx; dx = -dy; dy = t; }
    lifeSet(s, cx + dx, cy + dy);
  }
}
function lifeBrush(s, cx, cy, r, dens) {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r * r && Math.random() < dens) lifeSet(s, cx + dx, cy + dy);
}
function lifeSeed(s, rule, clear) {
  if (clear) { for (let i = 0; i < s.A.length; i++) if (s.A[i]) { s.GH[i] = 1; s.A[i] = 0; } }
  const K = 3 + Math.floor(s.bw * s.bh / 9000);
  const pats = rule === 'high' ? ['rep', 'rep', 'rpent', 'glider', 'acorn'] : ['glider', 'glider', 'lwss', 'rpent', 'acorn', 'diehard'];
  for (let k = 0; k < K; k++) {
    const x = rnd(s.bw), y = rnd(s.bh);
    if (rule === 'brain' || Math.random() < 0.3) lifeBrush(s, x, y, rnd(3, 6), rule === 'brain' ? 0.3 : 0.4);
    else lifeStamp(s, pick(pats), x, y);
  }
  if (rule === 'life' && s.bw > 120 && s.bh > 60 && Math.random() < 0.4) lifeStamp(s, 'gun', rnd(s.bw), rnd(s.bh));
  s.reseeds++;
}
// 一代：用三欄滑動視窗算鄰居數（環形世界）
function lifeStep(s, rule) {
  const bw = s.bw, bh = s.bh, A = s.A, B = s.B, AG = s.AG, GH = s.GH, brain = rule === 'brain', high = rule === 'high';
  let pop = 0;
  for (let y = 0; y < bh; y++) {
    const ym = (y === 0 ? bh - 1 : y - 1) * bw, y0 = y * bw, yp = (y === bh - 1 ? 0 : y + 1) * bw;
    if (brain) {
      let cl = (A[ym + bw - 1] === 1) + (A[y0 + bw - 1] === 1) + (A[yp + bw - 1] === 1), cc = (A[ym] === 1) + (A[y0] === 1) + (A[yp] === 1);
      for (let x = 0; x < bw; x++) {
        const xr = x + 1 < bw ? x + 1 : 0, cr = (A[ym + xr] === 1) + (A[y0 + xr] === 1) + (A[yp + xr] === 1);
        const i = y0 + x, a = A[i], n = cl + cc + cr - (a === 1 ? 1 : 0);
        const v = a === 1 ? 2 : a === 2 ? 0 : n === 2 ? 1 : 0;
        B[i] = v;
        if (v === 1) { pop++; AG[i] = 0; } else if (v === 2) pop++; else if (a === 2) GH[i] = 1;
        cl = cc; cc = cr;
      }
    } else {
      let cl = A[ym + bw - 1] + A[y0 + bw - 1] + A[yp + bw - 1], cc = A[ym] + A[y0] + A[yp];
      for (let x = 0; x < bw; x++) {
        const xr = x + 1 < bw ? x + 1 : 0, cr = A[ym + xr] + A[y0 + xr] + A[yp + xr];
        const i = y0 + x, a = A[i], n = cl + cc + cr - a;
        const v = n === 3 || (a === 1 && n === 2) || (high && a === 0 && n === 6) ? 1 : 0;
        B[i] = v;
        if (v) { pop++; AG[i] = a ? (AG[i] < 255 ? AG[i] + 1 : 255) : 0; } else if (a) GH[i] = 1;
        cl = cc; cc = cr;
      }
    }
  }
  s.A = B; s.B = A; s.gen++; s.pop = pop;
  return pop;
}
function lifeAI(s, f, ai) {
  const { cols, rows, dt } = f;
  if (ai.mode === undefined) { ai.mode = 0; ai.t = rnd(1, 2.5); ai.tx = rnd(cols * 0.15, cols * 0.85); ai.ty = rnd(rows * 0.2, rows * 0.8); }
  ai.t -= dt;
  if (ai.mode === 0) {
    ai.down = false;
    aiSeek(ai, ai.tx, ai.ty, dt, 1.6, 40);
    if (ai.t <= 0) {
      if (Math.random() < 0.4) { ai.clicks.push({ x: ai.x, y: ai.y, button: 0 }); ai.t = rnd(2.5, 5); ai.tx = rnd(cols * 0.1, cols * 0.9); ai.ty = rnd(rows * 0.15, rows * 0.85); }
      else { ai.mode = 1; ai.t = rnd(0.5, 1.3); ai.ang = rnd(TAU); ai.turn = rnd(-3, 3); ai.vx = ai.vy = 0; }
    }
  } else {
    ai.down = true;
    ai.ang += ai.turn * dt;
    ai.x = clamp(ai.x + Math.cos(ai.ang) * 26 * dt, 1, cols - 2); ai.y = clamp(ai.y + Math.sin(ai.ang) * 12 * dt, 1, rows - 2);
    if (ai.t <= 0) { ai.mode = 0; ai.down = false; ai.t = rnd(3, 6); ai.tx = rnd(cols * 0.1, cols * 0.9); ai.ty = rnd(rows * 0.15, rows * 0.85); }
  }
}
A({ id: 'ix-life', name: '生命畫布', cat: '互動', theme: 'mint', hue: false, interactive: true,
  desc: '按住拖曳畫出活細胞，康威生命遊戲會一直演化下去',
  params: { rule: 'life', rate: 12 },
  variants: [
    { id: 'brain', name: '腦波', desc: '布萊恩之腦規則：畫下的細胞會不停放電、向外擴散', theme: 'ice', params: { rule: 'brain', rate: 10 } },
    { id: 'high', name: '高生命', desc: 'HighLife 規則（B36/S23），會長出自我複製的圖案', theme: 'amber', params: { rule: 'high', rate: 14 } },
  ],
  init(s, f) {
    const { cols, rows } = f;
    s.half = cols * rows * 2 <= 160000;
    s.bw = s.half ? cols : cols >> 1; s.bh = s.half ? rows * 2 : rows;
    const n = s.bw * s.bh;
    s.A = new Uint8Array(n); s.B = new Uint8Array(n); s.AG = new Uint8Array(n); s.GH = new Float32Array(n);
    s.gen = 0; s.acc = 0; s.pop = 0; s.hist = new Int32Array(64); s.reseeds = 0; s.cool = 0;
    lifeSeed(s, f.p.rule, false);
  },
  frame(s, f) {
    const { g, cols, rows, dt, C, p } = f, rule = p.rule, bw = s.bw, bh = s.bh;
    const P = ptr(s, f, ai => lifeAI(s, f, ai));
    const sx = bw / cols, sy = bh / rows, rb = clamp(Math.min(bw, bh) / 26, 1.6, 7);
    // ── 畫細胞 ──
    for (const c0 of P.clicks) {
      const c = { x: clamp(c0.x, 0, cols - 0.01), y: clamp(c0.y, 0, rows - 0.01) };
      if (!P.playing && Math.random() < 0.6) lifeStamp(s, pick(rule === 'high' ? ['rep', 'glider', 'rpent'] : rule === 'brain' ? ['rpent', 'acorn'] : ['glider', 'lwss', 'rpent', 'acorn']), c.x * sx, c.y * sy);
      else lifeBrush(s, c.x * sx, c.y * sy, rb, 0.55);
    }
    if (P.down) {
      const x1 = clamp(P.x, 0, cols) * sx, y1 = clamp(P.y, 0, rows) * sy;
      if (P.wasDown && !P.jump) {
        const x0 = clamp(P.px, 0, cols) * sx, y0 = clamp(P.py, 0, rows) * sy, d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / (rb * 0.6)));
        for (let k = 1; k <= n; k++) lifeBrush(s, lerp(x0, x1, k / n), lerp(y0, y1, k / n), rb, 0.32);
      } else lifeBrush(s, x1, y1, rb, 0.45);
    }
    // ── 演化 ──
    s.acc = Math.min(s.acc + dt * (p.rate || 12), 3);
    s.cool -= dt;
    while (s.acc >= 1) {
      s.acc -= 1;
      const pop = lifeStep(s, rule);
      s.hist[s.gen & 63] = pop;
      if (s.gen > 70 && s.cool <= 0) {
        let mn = 1e9, mx = 0; for (let k = 0; k < 64; k++) { const v = s.hist[k]; if (v < mn) mn = v; if (v > mx) mx = v; }
        const stale = mx - mn <= 3;
        if (pop < Math.max(6, bw * bh * 0.0015) || stale) { lifeSeed(s, rule, stale && pop > bw * bh * 0.02); s.cool = 6; }
      }
    }
    // ════ 畫面 ════
    const A = s.A, AG = s.AG, GH = s.GH, ch = g.ch, co = g.co, gd = Math.exp(-dt * 2.2), brain = rule === 'brain';
    const lumOf = (i) => brain ? (A[i] === 1 ? 1 : 0.5) : 1 - Math.min(AG[i], 40) / 40 * 0.5;
    if (s.half) {
      for (let r = 0; r < rows; r++) {
        const ti = 2 * r * bw, ci = r * cols;
        for (let x = 0; x < cols; x++) {
          const i = ti + x, j = i + bw, a = A[i], b = A[j];
          let gi = GH[i], gj = GH[j];
          if (gi > 0) { gi *= gd; GH[i] = gi < 0.03 ? 0 : gi; }
          if (gj > 0) { gj *= gd; GH[j] = gj < 0.03 ? 0 : gj; }
          if (a | b) {
            ch[ci + x] = a && b ? '█' : a ? '▀' : '▄';
            co[ci + x] = C(0.1 + 0.9 * Math.max(a ? lumOf(i) : 0, b ? lumOf(j) : 0));
          } else if (gi > 0.06 || gj > 0.06) {
            ch[ci + x] = gi > 0.06 && gj > 0.06 ? '█' : gi > gj ? '▀' : '▄';
            co[ci + x] = C(0.04 + Math.max(gi, gj) * 0.2);
          } else if (x % 6 === 0 && r % 3 === 0) { ch[ci + x] = '·'; co[ci + x] = C(0.1); }
        }
      }
    } else {
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const i = y * bw + x, a = A[i];
        let gi = GH[i];
        if (gi > 0) { gi *= gd; GH[i] = gi < 0.03 ? 0 : gi; }
        const ci = y * cols + 2 * x;
        if (a) { const c = C(0.1 + 0.9 * lumOf(i)); ch[ci] = ch[ci + 1] = '█'; co[ci] = co[ci + 1] = c; }
        else if (gi > 0.06) { const c = C(0.04 + gi * 0.2); ch[ci] = ch[ci + 1] = '█'; co[ci] = co[ci + 1] = c; }
        else if (x % 3 === 0 && y % 3 === 0) { ch[ci] = '·'; co[ci] = C(0.1); }
      }
    }
    // 玩家沒按下時，在游標周圍畫出筆刷範圍
    if (P.playing && !P.down) {
      const n = Math.max(12, Math.round(rb * 8));
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU, x = (P.x * sx + Math.cos(a) * rb) / sx, y = (P.y * sy + Math.sin(a) * rb) / sy, X = Math.floor(x), Y = Math.floor(y);
        if (X >= 0 && Y >= 0 && X < cols && Y < rows && (ch[Y * cols + X] === ' ' || ch[Y * cols + X] === '·')) g.set(X, Y, '·', C(0.45));
      }
    }
    hud(f, tr(f, `世代 ${s.gen}  細胞 ${s.pop}`, `Gen ${s.gen}  Cells ${s.pop}`));
    if (!P.playing) hint(f, tr(f, '按住拖曳畫細胞・它們會自己演化', 'Hold and drag to draw cells · they evolve on their own'));
  },
});
/* ════════════ 點擊花園 ════════════ */
const GD_KIND = {
  base: [['flower', 5], ['tree', 1.5], ['grass', 1.3], ['bamboo', 0.9], ['mush', 0.8]],
  forest: [['tree', 1]],
  meadow: [['flower', 1]],
};
function wpick(list) { let tot = 0; for (const e of list) tot += e[1]; let r = Math.random() * tot; for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; } return list[0][0]; }
// 樹：在視覺座標（y 往上為負、已乘字高比）遞迴長出枝幹，枝端長出一團一團的葉子
function gdTree(o, A) {
  const segs = [], tips = [], maxD = o.h > 30 ? 5 : o.h > 14 ? 4 : 3, L0 = o.h * A * 0.32;
  const rec = (x, y, ang, len, d, t0) => {
    const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len, t1 = t0 + 0.55 / (maxD + 1);
    segs.push({ x0: x, y0: y, x1, y1, d, t0, t1 });
    if (d >= maxD) { tips.push({ x: x1, y: y1, r: len * rnd(1.1, 1.5) + 1.6, t0: t1 }); return; }
    const nk = d === 0 ? 2 : Math.random() < 0.3 ? 3 : 2;
    for (let k = 0; k < nk; k++) {
      const spread = rnd(0.32, 0.62), a2 = ang + (nk === 2 ? (k ? spread : -spread) : (k - 1) * spread) + rnd(-0.12, 0.12);
      rec(x1, y1, a2, len * rnd(0.66, 0.78), d + 1, t1);
    }
    if (d >= 2 && Math.random() < 0.4) tips.push({ x: x1, y: y1, r: len * 0.9 + 1.2, t0: t1 });
  };
  rec(0, 0, -Math.PI / 2 + rnd(-0.08, 0.08), L0, 0, 0);
  // 樹冠收窄：自然長出來的樹冠寬度約等於樹高（大畫面上一棵樹會佔掉半個畫面），橫向壓到半寬約 0.5–0.65 倍樹高（格數）
  const fwT = Math.max(4, o.h * rnd(0.5, 0.65));
  let sx = 1;
  for (let it = 0; it < 4; it++) { let e = 0; const ls = Math.sqrt(sx); for (const lf of tips) e = Math.max(e, Math.abs(lf.x) * sx + lf.r * ls); if (e <= fwT * 1.02) break; sx *= fwT / e; }
  const lsx = Math.sqrt(sx);
  if (sx < 1) { for (const sg of segs) { sg.x0 *= sx; sg.x1 *= sx; } for (const lf of tips) lf.x *= sx; }
  const cells = new Map(), chars = o.sp === 'cherry' ? ['*', 'o', '@', '*', '&'] : ['&', '@', '%', '&', '#'];
  for (const lf of tips) {
    const rx = lf.r * lsx, ry = lf.r / A, RX = Math.ceil(rx), RY = Math.ceil(ry);
    for (let dy = -RY; dy <= RY; dy++) for (let dx = -RX; dx <= RX; dx++) {
      const q = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (q > 1 || (q > 0.7 && Math.random() < 0.45)) continue;
      const cx = Math.round(lf.x + dx), cy = Math.round(lf.y / A + dy), key = cy * 10000 + cx;
      if (!cells.has(key)) cells.set(key, { x: cx, y: cy, q, h: Math.random(), ch: pick(chars), sh: -dy / (ry + 1) * 0.1 + rnd(-0.06, 0.06) });
    }
  }
  o.segs = segs; o.cells = [...cells.values()];
  let mn = 0, mx = 0; for (const c of o.cells) { if (c.x < mn) mn = c.x; if (c.x > mx) mx = c.x; }
  o.fw = Math.max(3, (mx - mn) / 2);
}
function gdNew(s, f, x) {
  const p = f.p, skyH = s.gy, A = f.aspect, sp = p.speed || 1, kind = p.kind || 'base';
  const type = wpick(GD_KIND[kind]);
  const o = { type, x: Math.round(clamp(x, 2, f.cols - 3)), age: 0, dir: Math.random() < 0.5 ? -1 : 1, hue: 0, w: 0, seed: rint(1, 1e6) };
  if (type === 'flower') {
    o.sp = pick(['daisy', 'daisy', 'rose', 'pom', 'sun', 'tulip']);
    const sm = kind === 'meadow' ? 0.6 : 1;
    o.h = Math.max(2, Math.round(skyH * (o.sp === 'sun' ? rnd(0.28, 0.45) : rnd(0.1, 0.28)) * sm));
    o.R = clamp(Math.round(o.h * 0.16), 1, o.sp === 'sun' ? 5 : 4);
    o.hue = o.sp === 'sun' ? 48 : o.sp === 'rose' ? pick([350, 0, 335, 15]) : pick([0, 30, 50, 200, 230, 270, 300, 330]);
    o.amp = rnd(0.3, 1.5); o.fr = rnd(0.6, 1.4); o.ph = rnd(TAU);
    o.growT = rnd(8, 14) / sp; o.life = rnd(30, 55) / sp; o.fw = o.R * 2 + 1;
    o.lk = []; for (let k = Math.max(1, Math.round(o.h * 0.22)), st = Math.max(3, Math.round(o.h / 4)); k < o.h * 0.78; k += st) o.lk.push(k);
  } else if (type === 'tree') {
    o.sp = pick(['oak', 'oak', 'cherry', 'pine']);
    o.h = clamp(Math.round(skyH * rnd(0.45, 0.8)), 6, 80);
    if (o.sp === 'pine') o.fw = o.h * 0.35 + 1; else gdTree(o, A);
    o.growT = rnd(18, 28) / sp * (kind === 'forest' ? 1.4 : 1); o.life = rnd(50, 80) / sp * (kind === 'forest' ? 1.4 : 1);
  } else if (type === 'grass') {
    o.blades = Array.from({ length: rint(3, 6) }, () => ({ off: rint(-2, 2), h: rint(2, Math.max(2, Math.round(skyH * 0.12))), lean: rnd(-1, 1) }));
    o.growT = rnd(4, 7) / sp; o.life = rnd(25, 45) / sp; o.fw = 2.5;
  } else if (type === 'bamboo') {
    o.h = Math.max(4, Math.round(skyH * rnd(0.4, 0.75)));
    o.stalks = Array.from({ length: rint(1, 3) }, (_, k) => ({ off: k * 2, h: Math.round(o.h * rnd(0.7, 1)) }));
    o.growT = rnd(10, 16) / sp; o.life = rnd(40, 60) / sp; o.fw = 3;
  } else {
    o.big = skyH > 18 && Math.random() < 0.6; o.hue = pick([5, 5, 25, 40]);
    o.growT = rnd(3, 6) / sp; o.life = rnd(15, 25) / sp; o.fw = 2;
  }
  return o;
}
const GD_BIG = { tree: 1, bamboo: 1 };
function gdPlant(s, f, x, init) {
  const o = gdNew(s, f, x);
  // 讓位：只有幾乎種在同一個位置（莖／樹幹之間的距離很近）的成熟植物才會枯萎讓位；
  // 還在長的不動，小花小草也不會擠死大樹（樹下可以種花），數量太多才讓最老的枯萎
  if (!init) {
    const rad = q => Math.max(1.5, Math.min(q.fw, o.fw) * (q.type === o.type ? 0.4 : 0.3));
    // 樹／竹子種在別的樹旁邊：先往旁邊挪到樹幹間距之外，而不是把長好的樹擠死
    if (GD_BIG[o.type]) for (const q of s.plants) {
      if (q.wilting || !GD_BIG[q.type]) continue;
      const r = rad(q), d = o.x - q.x;
      if (Math.abs(d) < r) { const nx = Math.round(q.x + (d >= 0 ? 1 : -1) * (r + 1)); if (nx >= 2 && nx <= f.cols - 3) o.x = nx; }
    }
    for (const q of s.plants) {
      if (q.wilting || q.age < q.growT || (GD_BIG[q.type] && !GD_BIG[o.type])) continue;
      if (Math.abs(q.x - o.x) < rad(q)) q.wilting = true;
    }
  }
  const alive = s.plants.filter(q => !q.wilting);
  if (alive.length >= s.max) { let old = alive[0]; for (const q of alive) if (q.age > old.age) old = q; old.wilting = true; }
  s.plants.push(o); s.planted++;
}
const gdCol = (H, hue, lum, w) => H(lerp(hue, 32, w), lum * (1 - 0.45 * w));
function gdLine(g, x0, y0, x1, y1, col, set) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))), ch = dirCh(dx, dy * 2.1, set);
  for (let k = 0; k <= n; k++) g.set(Math.round(x0 + dx * k / n), Math.round(y0 + dy * k / n), ch, col);
}
function gdDraw(s, f, o) {
  const { g, H, aspect: A, t } = f, base = s.gy - 1, gr = o.g, w = o.w;
  const petal = (x, y, ch, hue, lum, idx) => { if (w > 0 && hash(o.seed, idx) < w * 1.3 - 0.15) return; g.set(x, y, ch, gdCol(H, hue, lum, w)); };
  if (o.type === 'flower') {
    const hs = Math.max(1, Math.round(o.h * Math.min(1, gr / 0.6)));
    let px = o.x, tx = o.x, ty = base;
    const stem = gdCol(H, 115, 0.36, w), leaf = gdCol(H, 100, 0.44, w);
    for (let k = 0; k < hs; k++) {
      const u = k / o.h, off = o.amp * Math.sin(u * Math.PI * o.fr + o.ph + Math.sin(t * 0.8 + o.ph) * 0.15) * u + o.dir * w * o.h * 0.5 * u * u;
      const xx = o.x + Math.round(off), yy = base - k + Math.round(w * o.h * 0.35 * u * u);
      g.set(xx, yy, xx > px ? '/' : xx < px ? '\\' : '|', stem);
      const li = o.lk.indexOf(k);
      if (li >= 0 && gr > 0.25 + li * 0.1) { const d = li & 1 ? -o.dir : o.dir; g.set(xx + d, yy, d > 0 ? '/' : '\\', leaf); if (o.h > 16) g.set(xx + 2 * d, yy - 1, d > 0 ? '/' : '\\', leaf); }
      px = xx; tx = xx; ty = yy;
    }
    if (gr < 0.6) return;
    const cx = tx, cy = ty - 1;
    if (gr < 0.8) { g.set(cx, cy, 'o', gdCol(H, gr < 0.7 ? 100 : o.hue, 0.42, w)); return; }
    const b = Math.min(1, (gr - 0.8) / 0.18), r = Math.max(1, Math.round(o.R * b)), hue = o.hue;
    if (o.sp === 'daisy') {
      for (let k = 1; k <= r; k++) {
        petal(cx - 2 * k, cy, '-', hue, 0.85, k); petal(cx - 2 * k + 1, cy, '-', hue, 0.85, k + 10); petal(cx + 2 * k, cy, '-', hue, 0.85, k + 20); petal(cx + 2 * k - 1, cy, '-', hue, 0.85, k + 30);
        petal(cx, cy - k, '|', hue, 0.85, k + 40); petal(cx, cy + k, '|', hue, 0.75, k + 50);
        petal(cx - 2 * k, cy - k, '\\', hue, 0.8, k + 60); petal(cx + 2 * k, cy - k, '/', hue, 0.8, k + 70); petal(cx - 2 * k, cy + k, '/', hue, 0.7, k + 80); petal(cx + 2 * k, cy + k, '\\', hue, 0.7, k + 90);
      }
      g.set(cx, cy, r > 1 ? '@' : 'o', gdCol(H, 48, 0.7, w));
    } else if (o.sp === 'rose') {
      const rows = r === 1 ? ['@'] : r === 2 ? ['{@}'] : r === 3 ? ['.-.', '(@)', "`-'"] : [' _.-._ ', '( (@) )', " `-.-' "];
      for (let q = 0; q < rows.length; q++) { const L = rows[q], x0 = cx - (L.length >> 1), y0 = cy - (rows.length >> 1) + q; for (let k = 0; k < L.length; k++) if (L[k] !== ' ') petal(x0 + k, y0, L[k], hue, L[k] === '@' ? 0.62 : 0.5, q * 9 + k); }
    } else if (o.sp === 'pom') {
      const rx = r * 1.6 + 0.6, ry = r * 0.8 + 0.4, RX = Math.ceil(rx), RY = Math.ceil(ry);
      for (let dy = -RY; dy <= RY; dy++) for (let dx = -RX; dx <= RX; dx++) {
        if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1) continue;
        const h = hash(o.seed + dx * 31, dy * 17 + 5);
        petal(cx + dx, cy + dy, h < 0.3 ? 'o' : h < 0.55 ? '*' : h < 0.8 ? '°' : '·', hue + (h - 0.5) * 30, 0.5 + h * 0.3, dx * 13 + dy * 7 + 100);
      }
    } else if (o.sp === 'sun') {
      const rx = r, ry = Math.max(0.5, r * 0.5), n = 8 + r * 4;
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU, ex = Math.cos(a), ey = Math.sin(a);
        petal(Math.round(cx + ex * (rx + 1.4)), Math.round(cy + ey * (ry + 0.7)), dirCh(ex, ey, ASC), 48, 0.75, k);
        if (r > 1) petal(Math.round(cx + ex * (rx + 2.6)), Math.round(cy + ey * (ry + 1.3)), '*', 44, 0.62, k + 40);
      }
      for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -rx; dx <= rx; dx++) if ((dx / (rx + 0.3)) ** 2 + (dy / (ry + 0.3)) ** 2 <= 1) g.set(cx + dx, cy + dy, (dx + dy) & 1 ? '#' : '@', gdCol(H, 25, 0.3, w));
    } else {
      const rows = r === 1 ? ['v'] : r === 2 ? ['█▄█', '▀█▀'] : r === 3 ? ['█▄▄█', '████', '▀██▀'] : ['█▄█▄█', '█████', '█████', '▀███▀'];
      for (let q = 0; q < rows.length; q++) { const L = rows[q], x0 = cx - ((L.length - 1) >> 1), y0 = cy - rows.length + 1 + q; for (let k = 0; k < L.length; k++) if (L[k] !== ' ') petal(x0 + k, y0, L[k], hue, 0.5 + q * 0.04, q * 9 + k); }
    }
  } else if (o.type === 'tree') {
    if (o.sp === 'pine') {
      const hh = Math.max(3, Math.round(o.h * Math.min(1, gr * 1.1))), th = Math.max(1, Math.round(hh * 0.12)), crown = hh - th;
      const bark = gdCol(H, 25, 0.28, w * 0.5);
      for (let k = 0; k < th; k++) { g.set(o.x, base - k, '|', bark); if (o.h > 20) g.set(o.x + 1, base - k, '|', bark); }
      const tiers = clamp(Math.round(crown / 4), 1, 6), tierH = crown / tiers, top = base - hh + 1, cx = o.x + (o.h > 20 ? 0.5 : 0);
      for (let r = 0; r < crown; r++) {
        const ti = Math.floor(r / tierH), j = r - ti * tierH, hw = Math.max(0.6, (j + 1) * 1.15 + ti * 1.3), y = top + r;
        const L = Math.round(cx - hw), R = Math.round(cx + hw), col = gdCol(H, 140, 0.26 + j / tierH * 0.12, w);
        if (w > 0 && hash(o.seed, r) < w * 1.2 - 0.2) continue;
        g.set(L, y, '/', col); g.set(R, y, '\\', col);
        for (let x = L + 1; x < R; x++) if (hash(x * 7 + o.seed, y) < 0.55) g.set(x, y, '^', gdCol(H, 135, 0.3 + hash(x, y) * 0.12, w));
      }
      return;
    }
    const tw = Math.max(1, Math.round(o.h / 16)), bark = gdCol(H, 25, 0.3, w * 0.5), fall = s.season;
    for (const sg of o.segs) {
      if (gr <= sg.t0) continue;
      const u = Math.min(1, (gr - sg.t0) / (sg.t1 - sg.t0)), x0 = o.x + sg.x0, y0 = base + sg.y0 / A, x1 = o.x + sg.x0 + (sg.x1 - sg.x0) * u, y1 = base + (sg.y0 + (sg.y1 - sg.y0) * u) / A;
      if (sg.d === 0 && tw > 1) { for (let k = 0; k < tw; k++) gdLine(g, x0 + k - (tw >> 1), y0, x1 + k - (tw >> 1), y1, bark, ['█', '█', '█', '█']); }
      else gdLine(g, x0, y0, x1, y1, bark, ASC);
    }
    if (gr < 0.55) return;
    const sc = (gr - 0.55) / 0.45, cherry = o.sp === 'cherry';
    const lp = s.leaf, hueSeason = s.leafHue;
    for (let k = 0; k < o.cells.length; k++) {
      const c = o.cells[k];
      if (c.q > sc * 1.05 || c.h > lp) continue;
      if (w > 0 && c.h < w * 1.15 - 0.1) continue;
      const green = !cherry || c.h > 0.82 || fall > 0.5;
      const hue = green ? hueSeason + (c.h - 0.5) * 20 : 335 + (c.h - 0.5) * 20, lum = (green ? 0.32 : 0.6) + c.sh;
      g.set(o.x + c.x, base + c.y, c.ch, gdCol(H, hue, lum, w));
    }
  } else if (o.type === 'grass') {
    for (const b of o.blades) {
      const hh = Math.max(1, Math.round(b.h * Math.min(1, gr * 1.4)));
      for (let k = 0; k < hh; k++) {
        const u = k / hh, x = o.x + b.off + Math.round(b.lean * u * u * 2 + Math.sin(t * 1.3 + o.seed + b.off) * 0.4 * u);
        g.set(x, base - k, u > 0.45 && b.lean > 0.3 ? '/' : u > 0.45 && b.lean < -0.3 ? '\\' : '|', gdCol(H, 95 + b.off * 6, 0.3 + u * 0.18, w));
      }
    }
  } else if (o.type === 'bamboo') {
    for (const st of o.stalks) {
      const hh = Math.max(1, Math.round(st.h * Math.min(1, gr * 1.15))), x = o.x + st.off;
      for (let k = 0; k < hh; k++) {
        const node = k % 4 === 3, y = base - k;
        g.set(x, y, node ? '╫' : '║', gdCol(H, 80, node ? 0.3 : 0.42, w));
        if (node && k > 2 && hash(o.seed + st.off, k) < 0.6) {
          const d = hash(o.seed, k * 3 + st.off) < 0.5 ? -1 : 1, lc = gdCol(H, 100, 0.45, w), c = d > 0 ? '/' : '\\';
          g.set(x + d, y, c, lc); g.set(x + 2 * d, y - 1, c, lc); g.set(x + 3 * d, y - 1, d > 0 ? '‾' : '‾', lc);
        }
      }
    }
  } else {
    const cap = gdCol(H, o.hue, 0.48, w), stem = gdCol(H, 40, 0.72, w);
    if (gr < 0.4) { g.set(o.x, base, '.', cap); return; }
    if (gr < 0.75 || !o.big) { g.set(o.x, base - 1, '▄', cap); g.set(o.x + 1, base - 1, '▄', cap); g.set(o.x, base, '▐', stem); return; }
    g.set(o.x, base - 2, '▄', cap); g.set(o.x + 1, base - 2, '▄', cap);
    g.set(o.x - 1, base - 1, '▄', cap); g.set(o.x, base - 1, '█', cap); g.set(o.x + 1, base - 1, 'o', gdCol(H, 50, 0.95, w)); g.set(o.x + 2, base - 1, '▄', cap);
    g.set(o.x, base, '▐', stem); g.set(o.x + 1, base, '▌', stem);
  }
}
function gdAI(s, f, ai) {
  const { cols, dt } = f, p = f.p, gy = s.gy;
  const pickX = () => {
    let best = cols / 2, bs = -1;
    for (let k = 0; k < 7; k++) {
      const x = rnd(cols * 0.05, cols * 0.95); let d = 1e9;
      for (const q of s.plants) if (!q.wilting) d = Math.min(d, Math.abs(q.x - x) - q.fw);
      d += rnd(0, 6); if (d > bs) { bs = d; best = x; }
    }
    return best;
  };
  if (ai.mode === undefined) { ai.mode = 0; ai.t = 1; ai.tx = pickX(); ai.ty = rnd(gy * 0.3, gy - 2); }
  ai.t -= dt; ai.down = false;
  if (ai.mode === 0) {
    const big = p.kind === 'forest' ? 1 : Math.sqrt(Math.max(100, cols) / 100); // 大畫面移動快一點，花園才種得滿
    const d = aiSeek(ai, ai.tx, ai.ty, dt, 1.5 * big, 40 * big);
    if (d < 1.5 && ai.t <= 0) {
      ai.clicks.push({ x: ai.x, y: ai.y, button: 0 });
      if (Math.random() < 0.3) { ai.mode = 1; ai.t = rnd(1.2, 2.4); }
      else { ai.tx = pickX(); ai.ty = rnd(gy * 0.3, gy - 2); ai.t = p.kind === 'forest' ? rnd(5, 11) : rnd(2.5, 5.5) / (p.kind === 'meadow' ? 1.6 : 1) * Math.sqrt(100 / Math.max(100, cols)); } // 大畫面種得勤一點，花園才不會空蕩蕩
    }
  } else {
    ai.down = true;
    aiSeek(ai, ai.tx + Math.sin(f.t * 2.5) * 2, Math.max(2, gy - 8), dt, 2, 20);
    if (ai.t <= 0) { ai.mode = 0; ai.tx = pickX(); ai.ty = rnd(gy * 0.3, gy - 2); ai.t = rnd(2, 4); }
  }
}
A({ id: 'ix-garden', name: '點擊花園', cat: '互動', theme: 'forest', hue: true, interactive: true,
  desc: '點一下地面種下種子，花草樹木會慢慢長大；按住可以澆水',
  params: { kind: 'base', speed: 1 },
  variants: [
    { id: 'forest', name: '四季森林', desc: '只種樹：樹長得高大、四季變換，秋天落葉、冬天下雪', theme: 'mint', params: { kind: 'forest', speed: 1 } },
    { id: 'meadow', name: '花海', desc: '點一下撒一把花種：長得快、開得多，蝴蝶也多', theme: 'sakura', params: { kind: 'meadow', speed: 2.2 } },
  ],
  init(s, f) {
    const { cols, rows } = f, kind = f.p.kind;
    s.gy = rows - Math.max(2, Math.round(rows * 0.13));
    s.max = kind === 'forest' ? clamp(Math.round(cols / 22), 3, 16) : kind === 'meadow' ? clamp(Math.round(cols / 2.2), 20, 260) : clamp(Math.round(cols / 9), 6, 45);
    s.plants = []; s.seeds = []; s.parts = []; s.planted = 0; s.season = 0; s.leaf = 1; s.leafHue = 105; s.snowAcc = 0; s.pcap = clamp(Math.round(cols * rows / 50), 200, 2000);
    s.stars = Array.from({ length: Math.round(cols * rows / 140) }, () => ({ x: rint(0, cols - 1), y: rint(0, Math.floor(s.gy * 0.7)), ph: rnd(TAU), b: rnd(0.12, 0.35) }));
    s.hill = new Int16Array(cols);
    const hh = Math.max(1, s.gy * 0.14), hp = rnd(100);
    for (let x = 0; x < cols; x++) s.hill[x] = s.gy - 1 - Math.round((0.5 + 0.8 * Noise.n3(x * 0.012, hp, 0.5)) * hh);
    s.moon = { x: Math.round(cols * 0.78), y: Math.max(2, Math.round(rows * 0.13)), r: Math.max(1.2, rows * 0.045) };
    s.flies = Array.from({ length: clamp(Math.round(cols * rows / 700), 5, 80) }, () => ({ x: rnd(cols), y: rnd(s.gy * 0.3, s.gy - 1), ph: rnd(TAU), sp: rnd(0.5, 1.5) }));
    s.bfly = Array.from({ length: clamp(Math.round(cols / (kind === 'meadow' ? 45 : 90)), 1, 8) }, () => ({ x: rnd(cols), y: rnd(s.gy * 0.4, s.gy - 2), tx: rnd(cols), ty: s.gy * 0.6, ph: rnd(TAU), hue: pick([50, 200, 290, 20, 330]), t: 0 }));
    // 開場先有幾株已經長好的植物
    const n0 = kind === 'forest' ? Math.max(2, Math.round(s.max * 0.6)) : Math.round(s.max * 0.45);
    for (let k = 0; k < n0; k++) { gdPlant(s, f, (k + 0.5 + rnd(-0.3, 0.3)) * cols / n0, true); const o = s.plants[s.plants.length - 1]; o.age = o.growT * rnd(0.6, 1.3); }
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, C, H, p } = f, gy = s.gy, kind = p.kind;
    const P = ptr(s, f, ai => gdAI(s, f, ai));
    // ── 季節（森林版） ──
    if (kind === 'forest') {
      s.season = (t / 40) % 4;
      const se = s.season, ph = Math.floor(se), u = se - ph;
      s.leafHue = ph === 0 ? lerp(120, 100, u) : ph === 1 ? lerp(100, 75, u) : ph === 2 ? lerp(60, 20, u) : 20;
      s.leaf = ph === 0 ? 0.35 + 0.65 * u : ph === 1 ? 1 : ph === 2 ? 1 - 0.55 * u : 0.45 - 0.3 * Math.min(1, u * 3) + 0.2 * Math.max(0, u * 3 - 2);
      if (ph === 2 && Math.random() < dt * cols / 25) { const q = pick(s.plants); if (q && q.type === 'tree' && q.cells) { const c = pick(q.cells); s.parts.push({ x: q.x + c.x, y: gy - 1 + c.y, vx: rnd(-2, 2), vy: rnd(1, 3), life: 8, ch: pick([',', '`', '\'']), hue: rnd(15, 45) }); } }
      if (ph === 3) {
        // 下雪：用累加器控制每秒片數，並留空間給澆水的水滴和落葉
        s.snowAcc = Math.min(s.snowAcc + dt * cols / 6, 20);
        while (s.snowAcc >= 1) { s.snowAcc -= 1; if (s.parts.length < s.pcap * 0.75) s.parts.push({ x: rnd(cols), y: 0, vx: rnd(-1, 1), vy: rnd(2, 4), life: 30, ch: pick(['*', '·', '.']), hue: -1 }); }
      }
    } else s.season = 1;
    // ── 點擊：種子從點擊處落到地面 ──
    for (const c of P.clicks) {
      const n = kind === 'meadow' ? rint(5, 9) : 1;
      for (let k = 0; k < n; k++) {
        const x = clamp(c.x + (n > 1 ? rnd(-7, 7) : 0), 2, cols - 3);
        if (c.y >= gy && n === 1) gdPlant(s, f, x);
        else s.seeds.push({ x, y: Math.min(c.y, gy - 1) - (n > 1 ? rnd(0, 2) : 0), vy: rnd(0, 4) });
      }
    }
    for (let k = s.seeds.length - 1; k >= 0; k--) {
      const sd = s.seeds[k]; sd.vy += 30 * dt; sd.y += sd.vy * dt;
      if (sd.y >= gy - 1) { gdPlant(s, f, sd.x); s.seeds.splice(k, 1); for (let q = 0; q < 3; q++) s.parts.push({ x: sd.x, y: gy - 1, vx: rnd(-4, 4), vy: rnd(-4, -1), life: 0.4, ch: '.', hue: 30 }); }
    }
    // ── 澆水 ──
    const water = P.down;
    if (water) {
      if (Math.random() < dt * 40) s.parts.push({ x: P.x + rnd(-1.5, 1.5), y: P.y, vx: rnd(-0.5, 0.5), vy: rnd(10, 16), life: 3, ch: '\'', hue: 200, rain: 1 });
    }
    // ── 生長 ──
    for (let k = s.plants.length - 1; k >= 0; k--) {
      const o = s.plants[k];
      const boost = water && Math.abs(o.x - P.x) < 6 && o.age < o.growT ? 3 : 1;
      o.age += dt * boost;
      o.g = Math.min(1, o.age / o.growT);
      if (!o.wilting && o.age > o.growT + o.life) o.wilting = true;
      if (o.wilting) {
        o.w = Math.min(1, o.w + dt / 7);
        if (o.type === 'flower' && o.g > 0.8 && Math.random() < dt * 3 * o.w) s.parts.push({ x: o.x + rnd(-2, 2), y: gy - 1 - o.h, vx: rnd(-2, 2), vy: rnd(1, 3), life: 6, ch: pick(['.', ',', '\'']), hue: o.hue });
        if (o.type === 'tree' && o.cells && Math.random() < dt * 8 * o.w) { const c = pick(o.cells); s.parts.push({ x: o.x + c.x, y: gy - 1 + c.y, vx: rnd(-2, 2), vy: rnd(1, 3), life: 6, ch: pick([',', '`', '\'']), hue: 30 }); }
        if (o.w >= 1) s.plants.splice(k, 1);
      }
    }
    // ════ 畫面 ════
    for (const st of s.stars) { const b = st.b * (0.55 + 0.45 * Math.sin(t * 1.1 + st.ph)); g.set(st.x, st.y, b > 0.3 ? '+' : b > 0.18 ? '·' : '.', C(b)); }
    for (const fl of s.flies) {
      fl.x += Math.sin(t * 0.5 * fl.sp + fl.ph) * dt * 3; fl.y += Math.cos(t * 0.4 * fl.sp + fl.ph * 2) * dt * 1.2;
      if (fl.x < 0) fl.x += cols; else if (fl.x >= cols) fl.x -= cols; fl.y = clamp(fl.y, gy * 0.25, gy - 1);
      const b = Math.pow(Math.max(0, Math.sin(t * 1.7 * fl.sp + fl.ph)), 3);
      if (b > 0.08) g.set(fl.x, fl.y, b > 0.6 ? '•' : '·', H(70, 0.3 + b * 0.6));
    }
    // 月亮（彎月）與遠山
    // 月亮放暗一點（不要搶走植物的焦點），上下緣用半格方塊讓邊緣圓滑，外緣再暗一階
    const mo = s.moon, mr = mo.r, MR = Math.ceil(mr) + 1, mr2 = mr * mr, rim2 = Math.max(0, mr - 0.9) ** 2;
    const inM = (vx, vy) => { const ox = vx - mr * 0.55, oy = vy + mr * 0.2; return vx * vx + vy * vy <= mr2 && ox * ox + oy * oy > mr2 * 0.9; };
    for (let dy = -MR; dy <= MR; dy++) for (let dx = -MR * 3; dx <= MR * 3; dx++) {
      const vx = dx / f.aspect, a = inM(vx, dy - 0.25), b = inM(vx, dy + 0.25);
      if (!a && !b) continue;
      g.set(mo.x + dx, mo.y + dy, a && b ? '█' : a ? '▀' : '▄', H(50, vx * vx + dy * dy > rim2 ? 0.3 : 0.45));
    }
    for (let x = 0; x < cols; x++) for (let y = s.hill[x]; y < gy; y++) g.set(x, y, y === s.hill[x] ? '▄' : '█', C(0.045));
    const order = ['tree', 'bamboo', 'flower', 'grass', 'mush'];
    for (const ty of order) for (const o of s.plants) if (o.type === ty) gdDraw(s, f, o);
    // 蝴蝶：在開花的花之間飛
    const blooms = s.plants.filter(o => o.type === 'flower' && o.g >= 0.8 && !o.wilting);
    for (const b of s.bfly) {
      b.t -= dt;
      if (b.t <= 0) { const o = blooms.length ? pick(blooms) : null; b.tx = o ? o.x : rnd(cols); b.ty = o ? gy - 2 - o.h : rnd(gy * 0.3, gy * 0.8); b.t = rnd(3, 7); }
      b.x += clamp(b.tx - b.x, -1, 1) * dt * 8 + Math.sin(t * 3 + b.ph) * dt * 4; b.y += clamp(b.ty - b.y, -1, 1) * dt * 3 + Math.cos(t * 4.3 + b.ph) * dt * 3;
      b.y = clamp(b.y, 1, gy - 1);
      g.set(b.x, b.y, ((t * 7 + b.ph) | 0) % 2 ? 'ж' : '×', H(b.hue, 0.75));
    }
    if (s.parts.length > s.pcap) s.parts.splice(0, s.parts.length - s.pcap); // 太多時丟掉最舊的，不是剛產生的
    for (let k = s.parts.length - 1; k >= 0; k--) {
      const q = s.parts[k]; q.life -= dt;
      q.vy = q.rain ? q.vy : Math.min(q.vy + dt * 2, 4);
      q.x += (q.vx + (q.rain ? 0 : Math.sin(t * 2 + k) * 1.5)) * dt; q.y += q.vy * dt;
      if (q.life <= 0 || q.y >= gy) { s.parts.splice(k, 1); continue; }
      g.set(q.x, q.y, q.ch, q.hue < 0 ? C(0.9) : H(q.hue, q.rain ? 0.6 : 0.5));
    }
    for (const sd of s.seeds) g.set(sd.x, sd.y, '•', H(30, 0.55));
    // 地面：草皮 + 土壤
    const snow = kind === 'forest' && s.season >= 3.2;
    for (let x = 0; x < cols; x++) {
      const h = hash(x, 7), ci = ((t * 0.4 + h * 5) | 0);
      g.set(x, gy, snow ? '▄' : [',', '\'', '"', '.', '`', ';'][(hash(x, ci) * 6) | 0], snow ? C(0.85) : H(100 + h * 20, 0.28 + h * 0.14));
      for (let y = gy + 1; y < rows; y++) {
        const hh = hash(x, y * 13), d = (y - gy) / (rows - gy);
        g.set(x, y, hh < 0.04 ? '°' : hh < 0.5 ? '▒' : hh < 0.85 ? '░' : '▓', H(28, (hh < 0.04 ? 0.3 : 0.16) - d * 0.06 + hh * 0.04));
      }
    }
    const alive = s.plants.filter(o => !o.wilting).length;
    hud(f, kind === 'forest' ? tr(f, `${['春', '夏', '秋', '冬'][Math.floor(s.season) % 4]}  樹 ${alive}`, `${['Spring', 'Summer', 'Autumn', 'Winter'][Math.floor(s.season) % 4]}  Trees ${alive}`) : tr(f, `植物 ${alive}`, `Plants ${alive}`));
    if (!P.playing) hint(f, kind === 'meadow' ? tr(f, '點一下撒花種・按住澆水', 'Click to scatter flower seeds · hold to water') : tr(f, '點一下地面種下種子・按住澆水', 'Click the ground to plant a seed · hold to water'));
  },
});
/* ════════════ 雷電游標 ════════════ */
// 中點位移法產生鋸齒狀的閃電路徑（視覺座標：y 已乘上字高比）
// 段長約 3.6（不再細分到一兩格），每段畫成同一個方向字元的一小段直線，大畫面上才像閃電而不是一團亂線
// lim：每段相對於主方向（axis，沒給就用起點→終點的方向）只能往前走，橫向偏移最多是前進量的 lim 倍，
//      閃電不會折返、也不會在直直劈下的閃電裡出現一長串水平的 '-'；keep：主幹要打在目標上，把終點誤差平均攤回各點
function boltPath(x0, y0, x1, y1, rough, lim, keep, axis) {
  let pts = [x0, y0, x1, y1];
  const len = Math.hypot(x1 - x0, y1 - y0);
  let disp = len * rough;
  while (pts.length / 2 - 1 < len / 3.6 && disp > 0.25) {
    const np = [];
    for (let k = 0; k < pts.length - 2; k += 2) {
      const ax = pts[k], ay = pts[k + 1], bx = pts[k + 2], by = pts[k + 3], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, o = (Math.random() * 2 - 1) * disp;
      np.push(ax, ay, (ax + bx) / 2 - dy / l * o, (ay + by) / 2 + dx / l * o);
    }
    np.push(pts[pts.length - 2], pts[pts.length - 1]);
    pts = np; disp *= 0.55;
  }
  if (lim && pts.length > 4) {
    const n = pts.length / 2 - 1, ux = axis ? axis[0] : (x1 - x0) / (len || 1), uy = axis ? axis[1] : (y1 - y0) / (len || 1);
    let qx = pts[0], qy = pts[1];
    for (let k = 0; k < n; k++) {
      const i = k * 2, dx = pts[i + 2] - pts[i], dy = pts[i + 3] - pts[i + 1], l = Math.hypot(dx, dy);
      const par = Math.max(dx * ux + dy * uy, l * 0.3), m = par * lim, per = clamp(dy * ux - dx * uy, -m, m);
      pts[i] = qx; pts[i + 1] = qy; qx += par * ux - per * uy; qy += par * uy + per * ux;
    }
    pts[n * 2] = qx; pts[n * 2 + 1] = qy;
    if (keep) { const ex = x1 - qx, ey = y1 - qy; for (let k = 1; k <= n; k++) { pts[k * 2] += ex * k / n; pts[k * 2 + 1] += ey * k / n; } }
  }
  return pts;
}
const DOWN = [0, 1];
function mkBolt(x0, y0, x1, y1, o) {
  const axis = o.steep ? DOWN : null, bl = (o.lim || 0) * 1.35, main = boltPath(x0, y0, x1, y1, o.rough, o.lim || 0, true, axis), lines = [{ p: main, w: 1 }], n = main.length / 2;
  for (let k = 2; k < n - 2; k++) {
    if (Math.random() > o.br) continue;
    const ax = main[k * 2], ay = main[k * 2 + 1], a = Math.atan2(main[k * 2 + 3] - ay, main[k * 2 + 2] - ax) + (Math.random() < 0.5 ? -1 : 1) * rnd(0.35, 0.9);
    const L = Math.hypot(x1 - ax, y1 - ay) * rnd(0.12, 0.35) + 2, bp = boltPath(ax, ay, ax + Math.cos(a) * L, ay + Math.sin(a) * L, o.rough * 1.1, bl, false, axis);
    lines.push({ p: bp, w: 0.55 });
    if (Math.random() < 0.35 && bp.length > 8) {
      const j = ((bp.length / 4) | 0) * 2, a2 = a + rnd(-0.9, 0.9), L2 = L * 0.5;
      lines.push({ p: boltPath(bp[j], bp[j + 1], bp[j] + Math.cos(a2) * L2, bp[j + 1] + Math.sin(a2) * L2, o.rough, bl, false, axis), w: 0.35 });
    }
  }
  return { lines, life: o.life, max: o.life, thick: !!o.thick, flick: !!o.flick, soft: !!o.soft, x1, y1 };
}
function drawBolt(g, f, b, I) {
  const { C, cols, rows, aspect: A } = f, ia = 1 / A, ch = g.ch;
  for (const ln of b.lines) {
    const p = ln.p, w = ln.w, core = C(Math.min(1, 0.4 + I * (0.25 + w * 0.45))), glow = C(0.1 + I * w * 0.25);
    for (let k = 0; k < p.length - 2; k += 2) {
      const x0 = p[k], y0 = p[k + 1] * ia, dx = p[k + 2] - x0, dy = p[k + 3] * ia - y0;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))), c = dirCh(dx, dy * A, ASC);
      for (let q = 0; q < n; q++) {
        const X = Math.floor(x0 + dx * q / n), Y = Math.floor(y0 + dy * q / n);
        if (X < 0 || Y < 0 || X >= cols || Y >= rows) continue;
        g.set(X, Y, c, core);
        if (b.thick && w === 1) g.set(X + 1, Y, c, core);
        if (w > 0.5 && I > 0.35) { const i = Y * cols + X; if (X > 0 && ch[i - 1] === ' ') g.set(X - 1, Y, '·', glow); if (X < cols - 1 && ch[i + 1] === ' ') g.set(X + 1, Y, '·', glow); }
      }
    }
  }
}
function ltAI(s, f, ai) {
  const { cols, rows, dt, aspect: A } = f, mode = f.p.mode;
  if (ai.ph === undefined) { ai.ph = 0; ai.t = rnd(2, 4); ai.tx = rnd(cols); ai.ty = rnd(rows); ai.ct = 1; }
  ai.t -= dt; ai.down = false;
  if (mode === 'storm') { aiSeek(ai, cols * (0.5 + 0.4 * Math.sin(f.t * 0.05)), rows * 0.6, dt, 0.5, 5); s.aiNear = false; return; }
  if (ai.t <= 0) {
    ai.ph ^= 1; ai.t = ai.ph ? rnd(3, 5.5) : rnd(3, 6);
    if (ai.ph) { const a = rnd(Math.PI * 1.05, Math.PI * 1.95), d = s.R * (mode === 'globe' ? rnd(1.02, 1.12) : rnd(0.35, 0.75)); ai.tx = s.cx + Math.cos(a) * d; ai.ty = (s.cyv + Math.sin(a) * d) / A; ai.ct = rnd(0.8, 2.5); ai.a = a; }
    else { ai.tx = pick([rnd(cols * 0.02, cols * 0.15), rnd(cols * 0.85, cols * 0.98)]); ai.ty = rnd(rows * 0.1, rows * 0.4); }
  }
  if (ai.ph && mode === 'globe') { ai.a += Math.sin(f.t * 0.7) * dt * 0.5; const d = s.R * 1.06; ai.tx = s.cx + Math.cos(ai.a) * d; ai.ty = (s.cyv + Math.sin(ai.a) * d) / A; }
  aiSeek(ai, ai.tx, ai.ty, dt, 1.3, 30);
  s.aiNear = ai.ph === 1;
  if (ai.ph) { ai.ct -= dt; if (ai.ct <= 0) { ai.clicks.push({ x: ai.x, y: ai.y, button: 0 }); ai.ct = rnd(2, 4); } }
}
A({ id: 'ix-lightning', name: '雷電游標', cat: '互動', theme: 'ice', hue: false, interactive: true,
  desc: '閃電會從雲層打向游標；點一下劈下一道響雷',
  params: { mode: 'storm' },
  variants: [
    { id: 'tesla', name: '特斯拉', desc: '把游標靠近特斯拉線圈，電弧會跳向你；點一下大放電', theme: 'cyber', params: { mode: 'tesla' } },
    { id: 'globe', name: '電漿球', desc: '把游標靠近玻璃球，電漿絲會聚向你的手指；點一下放電', theme: 'neon', params: { mode: 'globe' } },
  ],
  init(s, f) {
    const { cols, rows, aspect: A } = f, mode = f.p.mode;
    s.bolts = []; s.flash = 0; s.fx = 0; s.sheet = 0; s.sx = 0; s.strikes = 0; s.next = 1; s.arcT = 0; s.rings = []; s.sparks = [];
    if (mode === 'storm') {
      s.ch = Math.max(3, Math.round(rows * 0.22));
      s.TW = Math.max(200, cols * 2);
      s.tex = new Float32Array(s.TW * s.ch);
      const Rn = s.TW / (TAU * 22);
      for (let y = 0; y < s.ch; y++) for (let x = 0; x < s.TW; x++) { const a = x / s.TW * TAU; s.tex[y * s.TW + x] = Noise.fbm(Math.cos(a) * Rn, Math.sin(a) * Rn, y / 10, 3); }
      s.gh = new Int16Array(cols);
      const hh = Math.max(1, rows * 0.09);
      for (let x = 0; x < cols; x++) s.gh[x] = Math.min(rows - 2, rows - 1 - Math.round(Math.max(0.15, 0.5 + 0.8 * Noise.n3(x * 0.025, 3.7, 1.3)) * hh)); // 地面至少一格高，不會有破洞
      s.tx = Math.round(cols * 0.72); s.th = Math.max(4, Math.round(rows * 0.22));
      const R = s.RN = clamp(Math.round(cols * rows / 70), 30, 2500);
      s.RX = new Float32Array(R); s.RY = new Float32Array(R); s.RV = new Float32Array(R);
      for (let k = 0; k < R; k++) { s.RX[k] = rnd(cols); s.RY[k] = rnd(s.ch, rows); s.RV[k] = rnd(25, 40) * rows / 60; }
    } else if (mode === 'tesla') {
      s.cx = Math.round(cols / 2); s.coilH = clamp(Math.round(rows * 0.42), 6, 120); s.top = rows - 1 - s.coilH;
      s.cw = Math.max(3, Math.round(s.coilH * 0.22)) | 1; s.tw = s.cw * 2 + 3;
      s.cyv = (s.top - 1.5) * A; s.R = Math.min(cols * 0.45, rows * A * 0.95);
    } else {
      s.cx = cols / 2; s.cy = rows * 0.45; s.cyv = s.cy * A; s.R = Math.max(6, Math.min(cols * 0.3, rows * A * 0.36));
      s.fil = Array.from({ length: clamp(Math.round(s.R / 7), 5, 12) }, (_, k) => ({ a: k / 8 * TAU + rnd(-0.3, 0.3), ph: rnd(TAU), sp: rnd(0.3, 0.8) * (Math.random() < 0.5 ? -1 : 1), pull: k < 3 ? rnd(1.8, 2.6) : rnd(0.15, 0.45) }));
      s.burst = 0; s.ba = 0;
    }
  },
  frame(s, f) {
    const { g, cols, rows, aspect: A, dt, t, C, p } = f, mode = p.mode, ia = 1 / A;
    const P = ptr(s, f, ai => ltAI(s, f, ai));
    const spark = (x, y, n, sp) => { for (let k = 0; k < n; k++) { const a = rnd(TAU), v = rnd(0.3, 1) * sp; s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: rnd(0.3, 0.7) }); } };
    if (mode === 'storm') {
      const strike = (x, y, big) => {
        x = clamp(x, 0, cols - 1);
        if (y < s.ch) { s.sheet = 1; s.sx = x; s.strikes++; return; }
        const sx = clamp(x + rnd(-1, 1) * cols * 0.06, 0, cols - 1), sy = rnd(0.3, 0.8) * s.ch * A;
        s.bolts.push(mkBolt(sx, sy, x, y * A, { rough: 0.2, br: 0.2, life: big ? 0.7 : rnd(0.35, 0.6), thick: big, flick: true, steep: true, lim: 1.2 }));
        s.flash = 1; s.fx = x; s.strikes++;
        s.rings.push({ x, y: y * A, r: 0 }); spark(x, y * A, big ? 16 : 8, 18);
      };
      for (const c of P.clicks) strike(c.x, c.y, true);
      if (P.playing && P.on) {
        // 游標引來的細閃電：游標停下來時比較密，只是移動經過時偶爾一道，不會一直在游標旁邊劈啪閃
        s.arcT -= dt;
        if (s.arcT <= 0 && s.bolts.length < 4) {
          let sx, sy;
          if (Math.random() < 0.7 && P.y > s.ch + 1) { sx = P.x + rnd(-1, 1) * Math.min(30, cols * 0.15); sy = rnd(0.6, 1) * s.ch * A; }
          else { sx = P.x < cols / 2 ? 0 : cols - 1; sy = (P.y + rnd(-8, 8)) * A; }
          s.bolts.push(mkBolt(sx, sy, P.x, P.y * A, { rough: 0.2, br: 0.1, life: rnd(0.15, 0.3), soft: true, lim: 1.2 }));
          s.arcT = P.still > 0.3 ? rnd(0.18, 0.45) : rnd(0.5, 1.1);
        }
      } else {
        // 沒人玩：暴風雨自己打雷
        s.next -= dt;
        if (s.next <= 0) {
          const r = Math.random();
          if (r < 0.2) strike(s.tx, s.gh[s.tx] - s.th, false);
          else if (r < 0.32) { s.sheet = rnd(0.5, 0.9); s.sx = rnd(cols); }
          else { const x = rint(1, cols - 2); strike(x, s.gh[x], Math.random() < 0.25); }
          s.next = Math.random() < 0.2 ? 0.15 : rnd(0.8, 3.2);
        }
      }
    } else if (mode === 'tesla') {
      const near = P.on && (P.playing || s.aiNear) && Math.hypot(P.x - s.cx, P.y * A - s.cyv) < s.R * 1.05;
      const src = () => { const a = rnd(Math.PI, TAU); return [s.cx + Math.cos(a) * s.tw * 0.5, s.cyv + Math.sin(a) * 1.3 * A]; };
      for (const c of P.clicks) {
        let tx = c.x, ty = c.y * A; const dx = tx - s.cx, dy = ty - s.cyv, d = Math.hypot(dx, dy) + 0.01, lim = s.R * 1.4;
        if (d > lim) { tx = s.cx + dx / d * lim; ty = s.cyv + dy / d * lim; }
        for (let k = 0; k < 5; k++) { const [sx, sy] = src(); s.bolts.push(mkBolt(sx, sy, tx, ty, { rough: 0.24, br: 0.16, life: rnd(0.25, 0.45), thick: k === 0, lim: 1 })); }
        s.flash = 1; s.strikes++; spark(tx, ty, 14, 16); s.rings.push({ x: tx, y: ty, r: 0 });
      }
      s.arcT -= dt;
      if (s.arcT <= 0 && s.bolts.length < 10) {
        const [sx, sy] = src();
        let tx, ty;
        if (near && Math.random() < 0.75) { tx = P.x; ty = P.y * A; }
        else { const a = rnd(Math.PI * 0.95, Math.PI * 2.05), d = s.R * rnd(0.3, 0.85); tx = s.cx + Math.cos(a) * d; ty = Math.min(s.cyv + Math.sin(a) * d, (rows - 1.5) * A); }
        s.bolts.push(mkBolt(sx, sy, tx, ty, { rough: 0.26, br: 0.2, life: rnd(0.08, 0.2), lim: 1 }));
        s.arcT = rnd(0.04, 0.1);
      }
    } else {
      // 電漿球：游標靠近時電漿絲聚向游標方向
      const dx = P.x - s.cx, dy = P.y * A - s.cyv, d = Math.hypot(dx, dy), ac = Math.atan2(dy, dx);
      const touch = P.on && (P.playing || s.aiNear) && d < s.R * 1.3;
      for (const c of P.clicks) { s.burst = 0.6; s.ba = Math.atan2(c.y * A - s.cyv, c.x - s.cx); s.strikes++; s.flash = 1; spark(s.cx + Math.cos(s.ba) * s.R, s.cyv + Math.sin(s.ba) * s.R, 12, 14); }
      s.burst -= dt;
      for (const fl of s.fil) {
        fl.a += Math.sin(t * fl.sp + fl.ph) * dt * (touch && fl.pull > 1 ? 0.25 : 0.9);
        if (s.burst > 0) fl.a += angDiff(s.ba, fl.a) * Math.min(1, dt * 8);
        else if (touch) fl.a += angDiff(ac, fl.a) * Math.min(1, dt * fl.pull);
      }
      s.touch = touch; s.tac = ac; s.td = d;
    }
    // ── 更新閃電、火花 ──
    for (let k = s.bolts.length - 1; k >= 0; k--) if ((s.bolts[k].life -= dt) <= 0) s.bolts.splice(k, 1);
    s.flash *= Math.exp(-dt * 5); s.sheet *= Math.exp(-dt * 3);
    // ════ 畫面 ════
    const light = x => s.flash * 0.55 * Math.exp(-Math.abs(x - s.fx) / (cols * 0.2)) + s.sheet * 0.4 * Math.exp(-Math.abs(x - s.sx) / (cols * 0.15));
    if (mode === 'storm') {
      const TW = s.TW, off = t * 1.5, tex = s.tex, chh = s.ch;
      for (let y = 0; y < chh; y++) {
        const bias = 0.35 * (1 - y / chh) - 0.05;
        for (let x = 0; x < cols; x++) {
          const v = tex[y * TW + (((x + off) | 0) % TW)] + bias;
          if (v < 0.06) continue;
          g.set(x, y, v < 0.16 ? '░' : v < 0.28 ? '▒' : v < 0.4 ? '▓' : '█', C(0.07 + v * 0.25 + light(x)));
        }
      }
      const wind = -0.35;
      for (let k = 0; k < s.RN; k++) {
        let x = s.RX[k], y = s.RY[k] + s.RV[k] * dt;
        x += wind * s.RV[k] * dt * 0.2;
        if (x < 0) x += cols;
        const gx = x | 0;
        if (y >= s.gh[gx]) { g.set(x, s.gh[gx] - 1, '.', C(0.3)); y = rnd(chh * 0.6, chh); x = rnd(cols); }
        s.RX[k] = x; s.RY[k] = y;
        g.set(x, y, k & 3 ? '/' : '\'', C((k & 3 ? 0.2 : 0.14) + light(x) * 0.4));
      }
      for (let x = 0; x < cols; x++) { const col = C(0.07 + light(x) * 0.45); for (let y = s.gh[x]; y < rows; y++) g.set(x, y, y === s.gh[x] ? '▄' : '█', col); }
      const tx = s.tx, tb = s.gh[tx];
      for (let k = 1; k <= s.th; k++) { g.set(tx - (k < s.th * 0.3 ? 1 : 0), tb - k, k % 3 ? '║' : '╫', C(0.2 + light(tx) * 0.5)); if (k < s.th * 0.3) g.set(tx + 1, tb - k, k % 3 ? '║' : '╫', C(0.2 + light(tx) * 0.5)); }
      g.set(tx, tb - s.th - 1, '•', C(Math.sin(t * 3) > 0 ? 1 : 0.3));
      if (P.playing && P.on && s.bolts.length) { g.set(P.x, P.y, '*', C(1)); for (let k = 0; k < 3; k++) g.set(P.x + rnd(-2, 2), P.y + rnd(-1, 1), '·', C(0.8)); }
    } else if (mode === 'tesla') {
      const cx = s.cx, top = s.top, cw = s.cw, tw = s.tw, fl = s.flash;
      for (let x = 0; x < cols; x++) g.set(x, rows - 1, '▀', C(0.1 + 0.25 * fl * Math.exp(-Math.abs(x - cx) / (cols * 0.2))));
      for (let x = 0; x < cols; x += 8) for (let y = 0; y < rows - 1; y += 4) g.set(x, y, '·', C(0.07));
      const bw = cw + 6;
      for (let x = 0; x < bw; x++) { g.set(cx - (bw >> 1) + x, rows - 2, '█', C(0.2)); g.set(cx - (bw >> 1) + x, rows - 3, '▄', C(0.26)); }
      for (let y = top + 1; y < rows - 3; y++) {
        g.set(cx - (cw >> 1) - 1, y, '▐', C(0.32)); g.set(cx + (cw >> 1) + 1, y, '▌', C(0.32));
        for (let x = -(cw >> 1); x <= cw >> 1; x++) g.set(cx + x, y, y & 1 ? '═' : '─', C(y & 1 ? 0.5 : 0.4));
      }
      for (let x = 0; x < tw; x++) {
        const X = cx - (tw >> 1) + x, edge = x === 0 || x === tw - 1;
        g.set(X, top - 1, edge ? '▀' : '█', C(0.55 + fl * 0.4)); if (!edge) g.set(X, top - 2, x === 1 || x === tw - 2 ? '▄' : '█', C(0.65 + fl * 0.35));
      }
      g.set(cx, top, '█', C(0.4));
      if (!P.playing && s.aiNear) g.set(P.x, P.y, '•', C(0.9));
    } else {
      const cx = s.cx, cyv = s.cyv, R = s.R, fl = s.flash;
      // 底座與桌面
      const by = Math.round((cyv + R) * ia) + 1;
      for (let y = by; y < rows - 1; y++) { const hw = Math.round(R * (0.25 + 0.25 * (y - by) / Math.max(1, rows - 1 - by))); for (let x = -hw; x <= hw; x++) g.set(cx + x, y, y === by ? '▄' : '█', C(0.12 + (x < 0 ? 0.04 : 0))); }
      for (let x = 0; x < cols; x++) g.set(x, rows - 1, '▀', C(0.08));
      // 玻璃
      const N = Math.ceil(TAU * R * 0.9);
      for (let k = 0; k < N; k++) {
        const a = k / N * TAU, x = cx + Math.cos(a) * R, y = (cyv + Math.sin(a) * R) * ia, hl = Math.pow(Math.max(0, Math.cos(a + 2.4)), 6);
        g.set(x, y, dirCh(-Math.sin(a), Math.cos(a), BOX), C(0.2 + hl * 0.45 + fl * 0.2));
      }
      // 電漿絲
      const fil = (a, r1, I, thick, ex, ey) => {
        const n = Math.max(4, Math.ceil(r1 / 1.4));
        let px = cx + Math.cos(a) * 1.5, py = cyv + Math.sin(a) * 1.5;
        const ca = Math.cos(a), sa = Math.sin(a), core = C(Math.min(1, 0.45 + I * 0.5)), glow = C(0.15 + I * 0.15);
        for (let k = 1; k <= n; k++) {
          const u = k / n, r = 1.5 + (r1 - 1.5) * u, off = Math.sin(u * Math.PI) * (Math.sin(u * 7 + t * 4 + a * 3) * R * 0.05 + (Math.random() - 0.5) * 1.3);
          let x = cx + ca * r - sa * off, y = cyv + sa * r + ca * off;
          if (k === n && ex !== undefined) { x = ex; y = ey; }
          const dx = x - px, dy = y - py, c = dirCh(dx, dy, ASC), steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy * ia))));
          for (let q = 1; q <= steps; q++) {
            const X = px + dx * q / steps, Y = (py + dy * q / steps) * ia;
            g.set(X, Y, c, core); if (thick) g.set(X + 1, Y, c, core);
            else if (Math.random() < 0.25) g.set(X + (Math.random() < 0.5 ? -1 : 1), Y, '·', glow);
          }
          px = x; py = y;
        }
        g.set(px, py * ia, '*', C(1));
      };
      const I0 = s.burst > 0 ? 1 : 0.55;
      for (const fl2 of s.fil) fil(fl2.a, R * 0.97, I0 * (0.7 + 0.3 * Math.random()), false);
      if (s.touch) { if (s.td < R) fil(s.tac, s.td, 1, true, P.x, P.y * A); else fil(s.tac, R * 0.97, 1, true); }
      g.set(cx, cyv * ia, '@', C(1)); g.set(cx - 1, cyv * ia, '(', C(0.7)); g.set(cx + 1, cyv * ia, ')', C(0.7));
    }
    for (const b of s.bolts) {
      const u = b.life / b.max;
      const I = b.flick ? (Math.sin(b.life * 48) > -0.35 ? 1 : 0.25) * (0.35 + 0.65 * u) : u * (b.soft ? 0.8 + 0.2 * Math.random() : 0.55 + 0.45 * Math.random());
      drawBolt(g, f, b, I);
    }
    for (let k = s.rings.length - 1; k >= 0; k--) {
      const r = s.rings[k]; r.r += dt * 40;
      if (r.r > 22) { s.rings.splice(k, 1); continue; }
      const n = Math.ceil(TAU * r.r * 0.8), col = C(0.5 * (1 - r.r / 22) + 0.1);
      for (let q = 0; q < n; q++) { const a = q / n * TAU; g.set(r.x + Math.cos(a) * r.r, (r.y + Math.sin(a) * r.r) * ia, '·', col); }
    }
    for (let k = s.sparks.length - 1; k >= 0; k--) {
      const q = s.sparks[k]; q.life -= dt; q.vy += 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.life <= 0) { s.sparks.splice(k, 1); continue; }
      g.set(q.x, q.y * ia, q.life > 0.3 ? '*' : '·', C(0.5 + q.life));
    }
    hud(f, mode === 'storm' ? tr(f, `落雷 ${s.strikes}`, `Strikes ${s.strikes}`) : tr(f, `放電 ${s.strikes}`, `Discharges ${s.strikes}`));
    if (!P.playing) hint(f, mode === 'storm' ? tr(f, '移動滑鼠引來閃電・點一下打雷', 'Move the mouse to draw lightning · click for a thunderbolt') : mode === 'tesla' ? tr(f, '游標靠近線圈會引來電弧・點一下放電', 'Bring the cursor near the coil to draw arcs · click to discharge') : tr(f, '游標靠近玻璃球・點一下放電', 'Bring the cursor near the glass globe · click to discharge'));
  },
});

/* ════════════ 數位雨分流 ════════════ */
const RAIN_G = [...KATA];
function rainSpawn(s, f, d, first) {
  const { cols, rows } = f;
  const x = rint(0, cols - 1);
  s.X[d] = x; s.HX[d] = x; s.VX[d] = 0;
  s.Y[d] = first ? rnd(-rows, rows) : -rnd(0, rows * 0.4);
  s.V[d] = rnd(0.35, 1) * Math.max(8, rows * 0.32) * (f.p.speed || 1);
  s.LEN[d] = rint(4, Math.max(6, Math.min(s.TL - 1, Math.round(rows * 0.5))));
  s.TC[d] = 0; s.LX[d] = -999; s.LY[d] = -999;
}
function rainAI(s, f, ai) {
  const { cols, rows, dt } = f, sink = f.p.mode === 'sink';
  if (ai.t === undefined) { ai.t = 0; ai.rt = rnd(4, 7); ai.tx = rnd(cols * 0.2, cols * 0.8); ai.ty = rows * rnd(0.45, 0.75); }
  ai.t -= dt; ai.rt -= dt; ai.down = false;
  if (ai.t <= 0) { ai.tx = clamp(ai.tx + rnd(-0.5, 0.5) * cols, cols * 0.1, cols * 0.9); ai.ty = rows * rnd(sink ? 0.25 : 0.45, sink ? 0.75 : 0.8); ai.t = rnd(5, 10); }
  aiSeek(ai, ai.tx, ai.ty + Math.sin(f.t * 3) * 0.3, dt, 0.8, sink ? 14 : 9);
  if (ai.rt <= 0 || (sink && s.orb.length > 140)) { ai.clicks.push({ x: ai.x, y: ai.y, button: 0 }); ai.rt = rnd(5, 9); }
}
A({ id: 'ix-rain', name: '數位雨分流', cat: '互動', theme: 'matrix', hue: false, interactive: true,
  desc: '數位雨會像碰到雨傘一樣繞過游標流下；點一下激起漣漪把雨滴推開',
  params: { mode: 'part', dens: 0.5, speed: 1 },
  variants: [
    { id: 'storm', name: '暴風雨', desc: '更密更快的雨，左右甩動滑鼠就會颳起風', theme: 'ice', params: { mode: 'storm', dens: 1, speed: 1.5 } },
    { id: 'sink', name: '黑洞', desc: '游標會把雨滴吸進去繞著轉，點一下把吸收的字元全部噴出去', theme: 'toxic', params: { mode: 'sink', dens: 0.6, speed: 1 } },
  ],
  init(s, f) {
    const { cols, rows, aspect: A, p } = f;
    const D = s.D = clamp(Math.round(cols * (p.dens || 0.5)), 30, 1200), TL = s.TL = 48;
    s.X = new Float32Array(D); s.Y = new Float32Array(D); s.V = new Float32Array(D); s.HX = new Float32Array(D); s.VX = new Float32Array(D);
    s.LEN = new Uint8Array(D); s.TC = new Uint8Array(D); s.HK = new Uint8Array(D); s.LX = new Int16Array(D); s.LY = new Int16Array(D);
    s.TX = new Int16Array(D * TL); s.TY = new Int16Array(D * TL); s.TG = new Uint8Array(D * TL);
    for (let d = 0; d < D; d++) rainSpawn(s, f, d, true);
    s.R = clamp(Math.min(cols * 0.07, rows * A * 0.2), 6, 40) * (p.mode === 'storm' ? 1.3 : 1);
    s.maxR = Math.min(cols, rows * A) * 0.45;
    s.rings = []; s.wind = 0; s.orb = []; s.fly = []; s.absorbed = 0; s.ripples = 0;
  },
  frame(s, f) {
    const { g, cols, rows, aspect: A, dt, t, C, p } = f, mode = p.mode, NG = RAIN_G.length;
    const P = ptr(s, f, ai => rainAI(s, f, ai));
    const mx = P.x, my = P.y, R = s.R, R2 = R * R, on = P.on;
    if (mode === 'storm') {
      const target = P.playing ? clamp((P.x - P.px) / Math.max(dt, 0.01) * 0.25, -14, 14) : Math.sin(t * 0.13) * 7 + Math.sin(t * 0.71) * 3;
      s.wind += (target - s.wind) * (1 - Math.exp(-dt * 1.5));
    }
    for (const c of P.clicks) {
      s.rings.push({ x: c.x, y: c.y * A, r: 0 }); s.ripples++;
      if (mode === 'sink') {
        for (const o of s.orb) { const a = o.a, sp = rnd(30, 70); s.fly.push({ x: c.x + Math.cos(a) * o.r, y: c.y * A + Math.sin(a) * o.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g, life: rnd(1, 1.8) }); }
        s.orb.length = 0;
      }
    }
    for (let k = s.rings.length - 1; k >= 0; k--) if ((s.rings[k].r += dt * 45) > s.maxR) s.rings.splice(k, 1);
    const X = s.X, Y = s.Y, V = s.V, HX = s.HX, VX = s.VX, LEN = s.LEN, TC = s.TC, HK = s.HK, LX = s.LX, LY = s.LY, TX = s.TX, TY = s.TY, TG = s.TG, TL = s.TL;
    const wind = s.wind, rings = s.rings, nr = rings.length, damp = Math.exp(-dt * 2.5), Rs = R * 1.7;
    for (let d = 0; d < s.D; d++) {
      let x = X[d], y = Y[d] + V[d] * dt;
      x += (VX[d] + wind) * dt; VX[d] *= damp;
      if (wind) { HX[d] += wind * dt; if (HX[d] < 0) HX[d] += cols; else if (HX[d] >= cols) HX[d] -= cols; }
      if (mode === 'sink') {
        if (on) {
          const dx = mx - x, dyv = (my - y) * A, dist = Math.sqrt(dx * dx + dyv * dyv) + 0.01;
          if (dist < Rs) {
            const k = 1 - dist / Rs, sp = 22 * k + 6;
            x += (dx / dist * sp - dyv / dist * sp * 0.6) * dt; y += (dyv / dist * sp + dx / dist * sp * 0.6) / A * dt;
            if (dist < 1.8) { s.absorbed++; if (s.orb.length < 260) s.orb.push({ a: rnd(TAU), r: rnd(0.6, 1.3), w: rnd(1.6, 2.6), g: TG[d * TL + HK[d]] }); rainSpawn(s, f, d, false); continue; }
          } else x += (HX[d] - x) * Math.min(1, dt * 1.5);
        }
      } else {
        const dx = x - mx, dyv = (y - my) * A;
        if (on && dyv < R * 0.2 && dyv > -R * 1.05 && dx * dx + dyv * dyv < R2) {
          const side = Math.abs(dx) < 0.05 ? (d & 1 ? 1 : -1) : sgn(dx);
          x += (mx + side * Math.sqrt(Math.max(0, R2 - dyv * dyv)) * 1.02 - x) * Math.min(1, dt * 30);
        } else if (!(on && y > my - 0.5 && Math.abs(HX[d] - mx) < R)) x += (HX[d] - x) * Math.min(1, dt * 1.5);
      }
      for (let k = 0; k < nr; k++) {
        const r = rings[k], dx = x - r.x, dyv = y * A - r.y, dist = Math.sqrt(dx * dx + dyv * dyv) + 0.01;
        if (Math.abs(dist - r.r) < 2.5) { const q = 70 * (1 - r.r / s.maxR); VX[d] += dx / dist * q; y += dyv / dist * q * 0.02; }
      }
      if (x < 0) x += cols; else if (x >= cols) x -= cols;
      X[d] = x; Y[d] = y;
      const cx = Math.floor(x), cy = Math.floor(y);
      if (cx !== LX[d] || cy !== LY[d]) {
        const h = HK[d] = (HK[d] + 1) % TL, o = d * TL + h;
        TX[o] = cx; TY[o] = cy; TG[o] = (Math.random() * NG) | 0;
        if (TC[d] < TL) TC[d]++;
        LX[d] = cx; LY[d] = cy;
      }
      if (y - LEN[d] > rows) rainSpawn(s, f, d, false);
    }
    // ════ 畫面 ════
    const dome = on && mode !== 'sink';
    for (let d = 0; d < s.D; d++) {
      const n = Math.min(TC[d], LEN[d]), base = d * TL, L = LEN[d];
      for (let k = n - 1; k >= 0; k--) {
        const o = base + (HK[d] - k + TL) % TL, x = TX[o], y = TY[o];
        if (y < 0 || y >= rows || x < 0 || x >= cols) continue;
        if (dome) { const dx = x + 0.5 - mx, dyv = (y + 0.5 - my) * A; if (dyv < R * 0.15 && dx * dx + dyv * dyv < R2 * 0.92) continue; } // 傘下面是乾的
        if (k > 0 && Math.random() < 0.004) TG[o] = (Math.random() * NG) | 0;
        if (k === 0) g.set(x, y, RAIN_G[(Math.random() * NG) | 0], C(1));
        else g.set(x, y, RAIN_G[TG[o]], C(0.08 + 0.8 * Math.pow(1 - k / L, 1.3)));
      }
    }
    for (const r of rings) {
      const n = Math.ceil(TAU * r.r * 0.7), dim = C(0.1 + 0.35 * (1 - r.r / s.maxR)), hi = C(0.95);
      for (let q = 0; q < n; q++) {
        const a = q / n * TAU, X = Math.floor(r.x + Math.cos(a) * r.r), Y = Math.floor((r.y + Math.sin(a) * r.r) / A);
        if (X < 0 || Y < 0 || X >= cols || Y >= rows) continue;
        const i = Y * cols + X; if (g.ch[i] === ' ') g.set(X, Y, '·', dim); else g.co[i] = hi;
      }
    }
    if (mode === 'sink') {
      const rr = 2.5 + Math.sqrt(s.orb.length) * 0.6;
      for (const o of s.orb) { o.a += o.w / o.r * dt; g.set(mx + Math.cos(o.a) * rr * o.r, my + Math.sin(o.a) * rr * o.r / A, RAIN_G[o.g % NG], C(0.6 + 0.4 * Math.sin(o.a * 3 + t))); }
      if (on) g.set(mx, my, '@', C(0.25));
      for (let k = s.fly.length - 1; k >= 0; k--) {
        const q = s.fly[k]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.exp(-dt); q.vy *= Math.exp(-dt);
        if (q.life <= 0) { s.fly.splice(k, 1); continue; }
        g.set(q.x, q.y / A, RAIN_G[q.g % NG], C(Math.min(1, q.life)));
      }
    } else if (on) {
      // 淡淡的傘面輪廓
      const n = Math.ceil(Math.PI * R * 0.8), col = C(0.22);
      for (let q = 0; q <= n; q++) { const a = Math.PI + q / n * Math.PI, X = Math.floor(mx + Math.cos(a) * R * 1.02), Y = Math.floor(my + Math.sin(a) * R * 1.02 / A); if (X >= 0 && Y >= 0 && X < cols && Y < rows && g.ch[Y * cols + X] === ' ') g.set(X, Y, dirCh(-Math.sin(a), Math.cos(a), BOX), col); }
      if (!P.playing) { const hh = Math.max(2, Math.round(R * 0.5 / A)); for (let k = 1; k < hh; k++) g.set(mx, my + k - 1, '│', C(0.3)); g.set(mx - 1, my + hh - 1, '╰', C(0.3)); g.set(mx, my + hh - 1, '╯', C(0.3)); }
    }
    hud(f, mode === 'sink' ? tr(f, `吸收 ${s.absorbed}`, `Absorbed ${s.absorbed}`) : tr(f, `漣漪 ${s.ripples}`, `Ripples ${s.ripples}`));
    if (!P.playing) hint(f, mode === 'sink' ? tr(f, '移動滑鼠吸住雨滴・點一下全部噴出', 'Move the mouse to soak up raindrops · click to spray them all out') : mode === 'storm' ? tr(f, '雨會繞過游標・左右甩動滑鼠颳風・點一下起漣漪', 'Rain flows around the cursor · shake the mouse for wind · click for ripples') : tr(f, '雨會繞過游標・點一下激起漣漪', 'Rain flows around the cursor · click to make ripples'));
  },
});

/* ════════════ 霓虹塗鴉 ════════════ */
function paintDep(s, f, x, y, dir, hue, thick) {
  const { cols, rows, aspect: A } = f, I = s.I, HU = s.HU, D = s.D;
  if (thick) {
    const r = s.thick, ry = r / A, RX = Math.ceil(r), RY = Math.ceil(ry);
    for (let dy = -RY; dy <= RY; dy++) for (let dx = -RX; dx <= RX; dx++) {
      const X = Math.floor(x + dx), Y = Math.floor(y + dy); if (X < 0 || Y < 0 || X >= cols || Y >= rows) continue;
      const q = (dx / r) ** 2 + (dy / ry) ** 2; if (q > 1) continue;
      const i = Y * cols + X, v = 1 - q * 0.45; if (I[i] < v || D[i] !== 5) { I[i] = Math.max(I[i], v); D[i] = 5; HU[i] = hue; }
    }
    return;
  }
  const X = Math.floor(x), Y = Math.floor(y); if (X < 0 || Y < 0 || X >= cols || Y >= rows) return;
  const i = Y * cols + X; I[i] = 1; D[i] = dir; HU[i] = hue;
  const nb = (j, ok) => { if (ok && I[j] < 0.42) { I[j] = 0.42; D[j] = 4; HU[j] = hue; } };
  nb(i - 1, X > 0); nb(i + 1, X < cols - 1); nb(i - cols, Y > 0); nb(i + cols, Y < rows - 1);
}
function paintSeg(s, f, x0, y0, x1, y1, hue, thick) {
  const A = f.aspect;
  const one = (a0, b0, a1, b1) => {
    const dx = a1 - a0, dy = b1 - b0, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 1.2)), c = dirCh(dx, dy * A, [0, 1, 2, 3]);
    for (let k = 0; k <= n; k++) paintDep(s, f, a0 + dx * k / n, b0 + dy * k / n, c, hue, thick);
  };
  if (!f.p.mirror) { one(x0, y0, x1, y1); return; }
  // 萬花筒：以畫面中心做 6 重旋轉 + 鏡射
  const cx = f.cols / 2, cy = f.rows / 2, p0 = [x0 - cx, (y0 - cy) * A], p1 = [x1 - cx, (y1 - cy) * A];
  const r0 = Math.hypot(p0[0], p0[1]), a0 = Math.atan2(p0[1], p0[0]), r1 = Math.hypot(p1[0], p1[1]), a1 = Math.atan2(p1[1], p1[0]);
  for (let k = 0; k < 6; k++) for (const m of [1, -1]) {
    const b0 = m * a0 + k * Math.PI / 3, b1 = m * a1 + k * Math.PI / 3;
    one(cx + Math.cos(b0) * r0, cy + Math.sin(b0) * r0 / A, cx + Math.cos(b1) * r1, cy + Math.sin(b1) * r1 / A);
  }
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function paintPen(s, f, k) {
  const { cols, rows, aspect: A } = f;
  const R = rint(5, 11); let r = rint(2, R - 1); if (R % r === 0 && r > 1) r--;
  const d = rnd(0.5, 1.15) * r, size = Math.min(cols * 0.2, rows * A * 0.42) * rnd(0.65, 1), S = size / (R - r + d);
  const mxs = size + 1, mys = size / A + 1;
  const cx = cols > 2 * mxs ? rnd(mxs, cols - mxs) : cols / 2, cy = rows > 2 * mys ? rnd(mys, rows - mys) : rows / 2;
  const end = TAU * r / gcd(R, r);
  return { R, r, d, S, cx, cy, th: 0, end, sp: end / rnd(10, 16), hue: rnd(360), wait: k ? rnd(2, 5) : 0, px: null, py: null };
}
function penPos(o, th) {
  const k = (o.R - o.r) / o.r;
  return [o.cx + ((o.R - o.r) * Math.cos(th) + o.d * Math.cos(k * th)) * o.S, o.cy + ((o.R - o.r) * Math.sin(th) - o.d * Math.sin(k * th)) * o.S / 2.1];
}
function paintAI(s, f, ai) {
  const { cols, rows, dt, t } = f;
  if (f.p.mirror) {
    // 萬花筒的 AI：在中心附近平滑地遊走，偶爾按住畫粗線
    if (ai.ht === undefined) { ai.ht = rnd(2, 4); ai.ph = rnd(100); }
    const rr = Math.min(cols, rows * 2.1) * 0.42;
    const x = cols / 2 + Noise.n3(t * 0.25, ai.ph, 0.5) * rr * 1.6, y = rows / 2 + Noise.n3(ai.ph, t * 0.25, 2.5) * rr * 1.6 / 2.1;
    aiSeek(ai, x, y, dt, 3, 50);
    ai.ht -= dt; ai.down = ai.ht < 0 && ai.ht > -0.8; if (ai.ht <= -0.8) ai.ht = rnd(3, 6);
    return;
  }
  const o = s.pens[0];
  if (o && o.px !== null) { ai.x = o.px; ai.y = o.py; }
  ai.down = false;
}
A({ id: 'ix-paint', name: '霓虹塗鴉', cat: '互動', theme: 'neon', hue: true, interactive: true,
  desc: '移動滑鼠畫出會發光、慢慢淡去的霓虹線條；按住畫粗線，顏色會自己變換',
  params: { mirror: 0 },
  variants: [
    { id: 'mirror', name: '萬花筒', desc: '畫下的每一筆都會以畫面中心六重對稱複製', theme: 'synth', params: { mirror: 1 } },
  ],
  init(s, f) {
    const { cols, rows } = f, n = cols * rows;
    s.I = new Float32Array(n); s.HU = new Float32Array(n); s.D = new Uint8Array(n);
    s.hue = rnd(360); s.thick = clamp(Math.min(cols, rows * 2.1) / 40, 1.4, 4);
    s.pens = [paintPen(s, f, 0), paintPen(s, f, 1)];
    // 背景：很暗的磚牆
    s.bg = new Array(n).fill('');
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const course = Math.floor(y / 4), off = course & 1 ? 8 : 0, mortar = y % 4 === 3, v = (x + off) % 16 === 0;
      const vAbove = (x + (course & 1 ? 8 : 0)) % 16 === 0, vBelow = (x + ((course + 1) & 1 ? 8 : 0)) % 16 === 0;
      s.bg[y * cols + x] = mortar ? (vAbove && vBelow ? '┼' : vAbove ? '┴' : vBelow ? '┬' : '─') : v ? '│' : '';
    }
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, C, H, p } = f, n = cols * rows;
    const P = ptr(s, f, ai => paintAI(s, f, ai));
    if (P.wheel) s.thick = clamp(s.thick - sgn(P.wheel) * 0.4, 1, 6);
    // ── 玩家畫線 ──
    if (P.playing || p.mirror) {
      if (P.moved) { paintSeg(s, f, P.px, P.py, P.x, P.y, s.hue, P.down); s.hue = (s.hue + dt * 40 + Math.hypot(P.x - P.px, P.y - P.py) * 0.4) % 360; }
      else if (P.down) { paintSeg(s, f, P.x, P.y, P.x + 0.01, P.y, s.hue, true); s.hue = (s.hue + dt * 30) % 360; }
      for (const c of P.clicks) for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, L = 3; paintSeg(s, f, c.x + Math.cos(a) * 1.2, c.y + Math.sin(a) * 0.6, c.x + Math.cos(a) * L * 1.6, c.y + Math.sin(a) * L * 0.75, (s.hue + k * 20) % 360, false); }
    }
    // ── 沒人玩：萬花筒尺（spirograph）自己畫 ──
    if (!P.playing && !p.mirror) {
      for (let k = 0; k < s.pens.length; k++) {
        const o = s.pens[k];
        if (o.wait > 0) { o.wait -= dt; continue; }
        const steps = 10, dth = o.sp * dt / steps;
        for (let q = 0; q < steps; q++) {
          o.th += dth;
          const [x, y] = penPos(o, o.th);
          if (o.px !== null) paintSeg(s, f, o.px, o.py, x, y, (o.hue + o.th / o.end * 140) % 360, false);
          o.px = x; o.py = y;
        }
        if (o.th >= o.end) { s.pens[k] = paintPen(s, f, 0); s.pens[k].wait = rnd(0.8, 2); }
      }
    }
    // ════ 畫面 ════
    const I = s.I, HU = s.HU, D = s.D, ch = g.ch, co = g.co, dec = Math.exp(-dt / (P.playing ? 2.6 : 4.5)), wall = C(0.06);
    for (let i = 0; i < n; i++) {
      const a = I[i];
      if (a < 0.04) { if (a > 0) I[i] = 0; const b = s.bg[i]; if (b) { ch[i] = b; co[i] = wall; } continue; }
      const st = D[i], hu = HU[i];
      if (st === 5) { ch[i] = a > 0.75 ? '█' : a > 0.5 ? '▓' : a > 0.3 ? '▒' : '░'; co[i] = H(hu, 0.3 + a * 0.6); }
      else if (st === 4) { ch[i] = a > 0.2 ? '·' : '.'; co[i] = H(hu, a * 0.75); }
      else if (a > 0.3) { ch[i] = BOX[st]; co[i] = H(hu, a > 0.93 ? 1 : 0.25 + a * 0.6); }
      else { ch[i] = '·'; co[i] = H(hu, a * 0.8); }
      I[i] = a * dec;
    }
    if (!P.playing && !p.mirror) for (const o of s.pens) if (o.wait <= 0 && o.px !== null) g.set(o.px, o.py, '●', H((o.hue + o.th / o.end * 140) % 360, 1));
    hud(f, (p.mirror ? tr(f, '萬花筒 ', 'Kaleidoscope ') : '') + '◆ ' + (P.down ? tr(f, '粗', 'Thick') : tr(f, '細', 'Thin')), H(s.hue, 0.8));
    if (!P.playing) hint(f, p.mirror ? tr(f, '移動滑鼠畫萬花筒・按住變粗', 'Move the mouse to paint a kaleidoscope · hold for a thicker line') : tr(f, '移動滑鼠畫霓虹線・按住變粗', 'Move the mouse to draw neon lines · hold for a thicker line'));
  },
});
})();
