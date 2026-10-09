// 經典作品（最早的 30 個基本動畫，各自附帶多個變化款）。整個檔案包在函式裡，輔助常數不會和其他模組撞名。
(() => {
// ── 共用小工具（只在這個檔案裡用） ──
const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const spriteW = lines => { let w = 0; for (const l of lines) if (l.length > w) w = l.length; return w; };
// 介面語言：f.lang === 'en' 時畫英文，其他（含舊版沒有 f.lang）一律畫中文
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);

A({ id: 'matrix', name: '數位雨', cat: '經典', theme: 'matrix', desc: '綠色片假名如瀑布般落下的字元雨',
  params: { chars: '', dir: 'down', spacing: 1, pair: false, drops: 1, vmin: 7, vmax: 24, len: 0.75, wait: 0.5, mut: 0.25, halo: false },
  variants: [
    { id: 'hex', name: '十六進位', theme: 'amber', desc: '成對十六進位位元組如雨落下', params: { chars: '0123456789ABCDEF', pair: true, spacing: 3, vmin: 6, vmax: 18, len: 0.6 } },
    { id: 'side', name: '橫向流', theme: 'ice', desc: '資料流從左向右橫掃畫面', params: { dir: 'side', vmin: 8, vmax: 26, len: 0.5, wait: 0.3 } },
    { id: 'up', name: '逆流而上', theme: 'cyber', desc: '符號由下往上逆向湧升', params: { dir: 'up', chars: '+-*=<>|:.^~#%&', vmin: 6, vmax: 20 } },
    { id: 'storm', name: '數位暴雨', desc: '近處亮雨隨風斜落、遠處細雨與雜訊帶', params: { dir: 'storm', mut: 0.6 } },
  ],
  init(s, f) {
    const p = f.p, side = p.dir === 'side';
    s.cs = p.chars || KATA;
    s.buf = Array.from({ length: f.cols * f.rows }, () => pick(s.cs));
    if (p.dir === 'storm') {
      // 兩層景深：遠層是暗淡、緩慢的細雨；近層是又亮又長、會被陣風吹斜的雨
      const { cols, rows } = f;
      s.far = Array.from({ length: cols }, () => ({ y: rnd(-rows, rows), v: rnd(3, 8), len: rint(3, Math.max(4, rows * 0.3)) }));
      s.nmk = first => ({ x: rnd(-cols * 0.3, cols * 1.3), y: first ? rnd(-rows, rows) : rnd(-rows * 0.6, 0), v: rnd(26, 50), len: rint(Math.max(6, rows * 0.3) | 0, Math.max(8, rows * 0.8) | 0) });
      s.near = Array.from({ length: Math.max(12, Math.round(cols / 3.2)) }, () => s.nmk(true));
      s.gl = null; s.gnext = rnd(1.5, 4); s.row = [];
      return;
    }
    s.L = side ? f.cols : f.rows;
    s.lanes = side ? f.rows : Math.ceil(f.cols / p.spacing);
    const sp = side ? f.aspect : 1;
    s.nd = first => ({ y: first ? rnd(-s.L * Math.max(1, p.wait), s.L) : rnd(-s.L * p.wait, 0), v: rnd(p.vmin, p.vmax) * sp, len: rint(Math.round(6 * sp), Math.max(8, s.L * p.len)) });
    s.d = Array.from({ length: s.lanes * p.drops }, () => s.nd(true));
  },
  frame(s, f) {
    const { g, cols, rows, dt, C, p } = f, buf = s.buf, cs = s.cs, ncs = cs.length, L = s.L;
    const dir = p.dir === 'side' ? 2 : p.dir === 'up' ? 1 : 0, sp = p.spacing;
    for (let k = cols * rows * dt * p.mut; k > 0; k--) buf[(Math.random() * buf.length) | 0] = cs[(Math.random() * ncs) | 0];
    if (p.dir === 'storm') return this.storm(s, f);
    for (let n = 0; n < s.d.length; n++) {
      const d = s.d[n], lane = (n / p.drops) | 0;
      d.y += d.v * dt;
      if (d.y - d.len > L) { s.d[n] = s.nd(false); continue; }
      const hy = Math.floor(d.y);
      for (let k = 0; k < d.len; k++) {
        const pos = hy - k;
        if (pos < 0) break;
        if (pos >= L) continue;
        let x, y;
        if (dir === 2) { x = pos; y = lane; } else { x = lane * sp; y = dir === 1 ? rows - 1 - pos : pos; }
        if (x >= cols) continue;
        const i = y * cols + x;
        let c, col;
        if (k === 0) { c = cs[(Math.random() * ncs) | 0]; col = C(1); } else { c = buf[i]; col = C(0.88 - 0.78 * (k / d.len)); }
        g.setI(i, c, col);
        if (p.pair && x + 1 < cols) g.setI(i + 1, k === 0 ? cs[(Math.random() * ncs) | 0] : buf[i + 1], col);
        if (p.halo && k === 0) {
          const hc = C(0.35);
          if (x > 0 && g.ch[i - 1] === ' ') g.setI(i - 1, '·', hc);
          if (x + 1 < cols && g.ch[i + 1] === ' ') g.setI(i + 1, '·', hc);
        }
      }
    }
  },
  storm(s, f) {
    const { g, cols, rows, aspect, dt, t, C } = f, buf = s.buf, cs = s.cs, ncs = cs.length, ch = g.ch, co = g.co;
    for (let x = 0; x < cols; x++) {
      const d = s.far[x];
      d.y += d.v * dt;
      if (d.y - d.len > rows) { d.y = rnd(-rows * 0.5, 0); d.v = rnd(3, 8); d.len = rint(3, Math.max(4, rows * 0.3)); }
      const hy = Math.floor(d.y);
      for (let k = 0; k < d.len; k++) {
        const y = hy - k;
        if (y < 0) break;
        if (y >= rows) continue;
        const i = y * cols + x;
        ch[i] = buf[i]; co[i] = C(k === 0 ? 0.42 : 0.3 - 0.22 * (k / d.len));
      }
    }
    // 陣風：近層雨絲的斜率（每往下一列往旁邊偏幾格）
    const wind = 0.42 * Math.sin(t * 0.23) + 0.2 * Math.sin(t * 0.71 + 1) + 0.12 * Noise.n3(t * 0.5, 2, 0), slope = wind * aspect;
    for (let n = 0; n < s.near.length; n++) {
      const d = s.near[n];
      d.y += d.v * dt; d.x += slope * d.v * dt;
      if (d.y - d.len > rows || d.x < -cols * 0.6 || d.x > cols * 1.6) { s.near[n] = s.nmk(false); continue; }
      const hy = Math.floor(d.y);
      for (let k = 0; k < d.len; k++) {
        const y = hy - k;
        if (y < 0) break;
        if (y >= rows) continue;
        const x = Math.floor(d.x - k * slope);
        if (x < 0 || x >= cols) continue;
        const i = y * cols + x;
        if (k === 0) { ch[i] = cs[(Math.random() * ncs) | 0]; co[i] = C(1); }
        else { ch[i] = buf[i]; co[i] = C(0.92 - 0.72 * (k / d.len)); }
      }
    }
    // 偶爾一條水平雜訊帶：幾列畫面整條錯位一下
    s.gnext -= dt;
    if (!s.gl && s.gnext <= 0) { s.gnext = rnd(2.5, 6); s.gl = { l: rnd(0.15, 0.35), y: rint(0, rows - 1), h: rint(1, Math.max(1, Math.round(rows * 0.1))), dx: pick([-1, 1]) * rint(3, Math.max(4, Math.round(cols * 0.06))) }; }
    if (s.gl) {
      const G = s.gl;
      G.l -= dt;
      for (let y = G.y; y < Math.min(rows, G.y + G.h); y++) {
        const o = y * cols, cc = ch.slice(o, o + cols), oc = co.slice(o, o + cols);
        for (let x = 0; x < cols; x++) { const j = (((x - G.dx) % cols) + cols) % cols; ch[o + x] = cc[j]; co[o + x] = oc[j]; }
      }
      if (G.l <= 0) s.gl = null;
    }
  } });

// 甜甜圈：一般化的環面算繪（管徑、環徑、線框、雙環、移動光源、糖霜）
function trigTable(s, key, step) {
  const n = Math.ceil(TAU / step), tb = s[key];
  if (tb && tb.n === n) return tb;
  const c = new Float32Array(n), sn = new Float32Array(n), a = new Float32Array(n);
  for (let k = 0; k < n; k++) { a[k] = k * step; c[k] = Math.cos(a[k]); sn[k] = Math.sin(a[k]); }
  return (s[key] = { n, c, s: sn, a });
}
A({ id: 'donut', name: '3D 甜甜圈', cat: '幾何', theme: 'amber', desc: '經典的旋轉甜甜圈，光影即時計算',
  params: { R1: 1, R2: 2, sa: 0.9, sb: 0.45, ramp: '.,-~:;=!*#$@', mode: 'shade', twin: false, orbit: false },
  variants: [
    { id: 'fat', name: '胖胖圈', desc: '管身肥厚、以方塊明暗描繪', params: { R1: 1.45, R2: 1.75, sa: 0.7, sb: 0.35, ramp: '.:-=+░▒▓█' } },
    { id: 'thin', name: '細指環', theme: 'gold', desc: '纖細的金色指環快速翻轉', params: { R1: 0.42, R2: 2.3, sa: 1.3, sb: 0.75 } },
    { id: 'wire', name: '線框', theme: 'blueprint', desc: '經緯線框成的甜甜圈，背面自動隱藏', params: { mode: 'wire', ramp: '.:-=+*#%@' } },
    { id: 'twin', name: '雙環相扣', desc: '兩個互相穿過的環一起旋轉', params: { twin: true, R1: 0.7, sa: 0.7, sb: 0.5 } },
    { id: 'orbit', name: '繞行光源', theme: 'neon', desc: '光源繞著甜甜圈轉，明暗流轉', params: { orbit: true, sa: 0.45, sb: 0.25 } },
    { id: 'glaze', name: '彩米糖霜', theme: 'sakura', hue: true, desc: '粉紅糖霜加上彩色巧克力米', params: { mode: 'glaze', sa: 0.6, sb: 0.3, R1: 1.1 } },
  ],
  init(s) { s.a = 1; s.b = 0; s.z = null; },
  frame(s, f) {
    const { g, cols, rows, aspect, C, H, p, t } = f, n = cols * rows;
    s.a += f.dt * p.sa; s.b += f.dt * p.sb;
    if (!s.z || s.z.length !== n) s.z = new Float32Array(n); else s.z.fill(0);
    const R1 = p.R1, R2 = p.R2, twin = p.twin, outer = twin ? R2 * 1.5 + R1 : R1 + R2, K2 = outer + 2;
    const ext = Math.min(cols, rows * aspect) * (twin ? 0.4 : 0.31), K = (ext * K2) / outer, Ky = K / aspect, cx = cols / 2, cy = rows / 2, unit = ext / outer;
    const T = trigTable(s, 'tt', clamp(0.75 / (R1 * unit), 0.012, 0.25)), P = trigTable(s, 'pt', clamp(0.75 / ((R2 + R1) * unit), 0.004, 0.1));
    const cA = Math.cos(s.a), sA = Math.sin(s.a), cB = Math.cos(s.b), sB = Math.sin(s.b);
    let Lx = 0, Ly = -0.7071, Lz = -0.7071;
    if (p.orbit) { Lx = Math.sin(t * 0.8); Ly = -0.35; Lz = -Math.cos(t * 0.8); const l = Math.hypot(Lx, Ly, Lz); Lx /= l; Ly /= l; Lz /= l; }
    const R = p.ramp, nr = R.length, rk = (nr - 1) * 1.03, z = s.z, ch = g.ch, co = g.co, mode = p.mode;
    const wire = mode === 'wire', glaze = mode === 'glaze';
    const tN = T.n, pN = P.n;
    const cols1 = [];
    for (let k = 0; k < nr; k++) cols1.push(C(0.22 + (k / (nr - 1)) * 0.78));
    for (let tor = 0; tor < (twin ? 2 : 1); tor++) {
      const sh = twin ? (tor ? R2 / 2 : -R2 / 2) : 0;
      for (let j = 0; j < tN; j++) {
        const ct = T.c[j], st = T.s[j], h = R2 + R1 * ct;
        for (let i = 0; i < pN; i++) {
          const cp = P.c[i], sp = P.s[i];
          let ox = h * cp, oy = h * sp, oz = R1 * st, nx = ct * cp, ny = ct * sp, nz = st;
          if (tor) { const ty = oy; oy = -oz; oz = ty; const tn = ny; ny = -nz; nz = tn; }
          ox += sh;
          const y1 = oy * cA - oz * sA, z1 = oy * sA + oz * cA, x2 = ox * cB - y1 * sB, y2 = ox * sB + y1 * cB;
          const D = 1 / (z1 + K2), xf = cx + K * D * x2, yf = cy + Ky * D * y2;
          if (xf < 0 || yf < 0 || xf >= cols || yf >= rows) continue;
          const xi = xf | 0, o = xi + cols * (yf | 0);
          // 靠近觀眾的半邊會被透視放大，取樣點之間會空出一格：順便也畫在右邊那一格，正面就不會露出背面的點
          const a1 = D > z[o], a2 = z1 < 0 && xi + 1 < cols && D > z[o + 1];
          if (!a1 && !a2) continue;
          if (a1) z[o] = D;
          if (a2) z[o + 1] = D;
          if (wire) continue;
          const ny1 = ny * cA - nz * sA, nz2 = ny * sA + nz * cA, nx2 = nx * cB - ny1 * sB, ny2 = nx * sB + ny1 * cB;
          const lum = nx2 * Lx + ny2 * Ly + nz2 * Lz;
          const li = lum > 0 ? Math.min(nr - 1, (lum * rk) | 0) : 0;
          let c, cc;
          if (glaze) {
            const e = 0.18 + (li / (nr - 1)) * 0.82, top = tor === 0 && st > -0.2 + 0.22 * Math.sin(P.a[i] * 7 + 1.3 * Math.sin(P.a[i] * 3));
            if (top) {
              const hs = hash2((i / 9) | 0, (j / 4) | 0);
              if (hs > 0.86 && (i % 9) < 5) { c = (i + j) & 1 ? '=' : '-'; cc = H((hs * 3600) % 360, 0.45 + e * 0.5); }
              else { c = R[li]; cc = H(335, 0.3 + e * 0.6); }
            } else { c = R[li]; cc = H(30, 0.15 + e * 0.5); }
          } else { c = R[li]; cc = cols1[li]; }
          if (a1) { ch[o] = c; co[o] = cc; }
          if (a2) { ch[o + 1] = c; co[o + 1] = cc; }
        }
      }
    }
    if (wire) this.wire(s, f, { R1, R2, K, Ky, K2, cx, cy, cA, sA, cB, sB, Lx, Ly, Lz, ext, unit, twin });
  },
  // 線框：經線與緯線各畫成一條條折線，用上面算好的深度緩衝做隱藏線處理
  wire(s, f, o) {
    const { g, cols, rows, aspect, C } = f, z = s.z, ch = g.ch, co = g.co;
    const { R1, R2, K, Ky, K2, cx, cy, cA, sA, cB, sB, Lx, Ly, Lz, ext, unit, twin } = o;
    const nTl = clamp(Math.round(ext * 0.36), 9, 18), nPl = clamp(Math.round(ext * 0.85), 20, 44);
    const Mp = clamp(Math.round((R2 + R1) * unit * 2.4), 48, 220), Mt = clamp(Math.round(R1 * unit * 3), 16, 64);
    const q = s.wq || (s.wq = new Float32Array(10));
    const proj = (th, ph, tor, k) => {
      const ct = Math.cos(th), st = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph), h = R2 + R1 * ct;
      let ox = h * cp, oy = h * sp, oz = R1 * st, nx = ct * cp, ny = ct * sp, nz = st;
      if (tor) { const ty = oy; oy = -oz; oz = ty; const tn = ny; ny = -nz; nz = tn; }
      if (twin) ox += tor ? R2 / 2 : -R2 / 2;
      const y1 = oy * cA - oz * sA, z1 = oy * sA + oz * cA, x2 = ox * cB - y1 * sB, y2 = ox * sB + y1 * cB;
      const ny1 = ny * cA - nz * sA, nz2 = ny * sA + nz * cA, nx2 = nx * cB - ny1 * sB, ny2 = nx * sB + ny1 * cB;
      const D = 1 / (z1 + K2);
      q[k] = cx + K * D * x2; q[k + 1] = cy + Ky * D * y2; q[k + 2] = D;
      q[k + 3] = nx2 * Lx + ny2 * Ly + nz2 * Lz;
      q[k + 4] = nx2 * x2 + ny2 * y2 + nz2 * (z1 + K2);   // < 0：這一點面向觀眾
    };
    const seg = () => {
      if (q[4] + q[9] > 0) return;
      const ax = q[0], ay = q[1], dx = q[5] - ax, dy = q[6] - ay, aD = q[2], dD = q[7] - aD;
      const lum = Math.max(0, (q[3] + q[8]) * 0.5), c = slopeCh(dx, dy * aspect), col = C(0.25 + lum * 0.75);
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 1.5));
      for (let k = 0; k <= n; k++) {
        const u = k / n, x = ax + dx * u, y = ay + dy * u;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const i = (x | 0) + cols * (y | 0), D = aD + dD * u;
        if (D < z[i] * 0.8) continue;
        ch[i] = c; co[i] = col;
      }
    };
    for (let tor = 0; tor < (twin ? 2 : 1); tor++) {
      for (let j = 0; j < nTl; j++) {
        const th = (j / nTl) * TAU;
        proj(th, 0, tor, 5);
        for (let k = 1; k <= Mp; k++) { q.copyWithin(0, 5, 10); proj(th, (k / Mp) * TAU, tor, 5); seg(); }
      }
      for (let i = 0; i < nPl; i++) {
        const ph = (i / nPl) * TAU;
        proj(0, ph, tor, 5);
        for (let k = 1; k <= Mt; k++) { q.copyWithin(0, 5, 10); proj((k / Mt) * TAU, ph, tor, 5); seg(); }
      }
      for (let j = 0; j < nTl; j++) for (let i = 0; i < nPl; i++) {
        proj((j / nTl) * TAU, (i / nPl) * TAU, tor, 0);
        if (q[4] > 0 || q[0] < 0 || q[1] < 0 || q[0] >= cols || q[1] >= rows) continue;
        const k = (q[0] | 0) + cols * (q[1] | 0);
        if (q[2] < z[k] * 0.8) continue;
        ch[k] = '@'; co[k] = C(0.45 + Math.max(0, q[3]) * 0.55);
      }
    }
  } });

A({ id: 'fire', name: '熊熊烈火', cat: '自然', theme: 'fire', desc: '雜訊模擬的火舌，不停竄升搖曳',
  params: { mode: 'wall', h: 1.55, base: 1.05, rise: 1.8, oct: 3, amp: 1.25, sc: 7, sparks: 0 },
  variants: [
    { id: 'camp', name: '營火', desc: '夜空下劈啪作響的營火與火星', params: { mode: 'camp', h: 1.25, sparks: 1 } },
    { id: 'gas', name: '藍色爐火', theme: 'ice', desc: '一排穩定燃燒的藍色瓦斯火焰', params: { mode: 'gas', h: 1.4, amp: 0.55, rise: 2.6, sc: 10 } },
    { id: 'inferno', name: '烈焰火海', desc: '吞沒整個畫面的熊熊火海', params: { h: 0.95, rise: 2.6, oct: 2, amp: 1.35, sc: 9, base: 1.15 } },
    { id: 'ember', name: '餘燼星火', theme: 'sunset', desc: '低伏的餘火與漫天飄升的火星', params: { mode: 'ember', h: 3.2, amp: 0.9, sparks: 3 } },
    { id: 'wisp', name: '幽幽鬼火', theme: 'toxic', desc: '在黑暗中飄移的團團綠色鬼火', params: { mode: 'wisp' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.sp = []; s.acc = 0;
    if (p.mode === 'pixel') s.heat = new Float32Array(cols * (rows + 3));
    if (p.mode === 'wisp') s.w = Array.from({ length: clamp(Math.round(cols / 40), 3, 8) }, (_, k) => ({ fx: rnd(0.05, 0.12), fy: rnd(0.07, 0.15), px: rnd(0, TAU), py: rnd(0, TAU), r: rnd(0.8, 1.2), k }));
    if (p.mode === 'camp') s.st = Array.from({ length: (cols * rows / 140) | 0 }, () => [rint(0, cols - 1), rint(0, (rows * 0.45) | 0), rnd(0, TAU)]);
  },
  spark(s, f, x, y, spread) {
    s.sp.push({ x: x + rnd(-spread, spread), y, vx: rnd(-2, 2), vy: -rnd(f.rows * 0.15, f.rows * 0.45), l: rnd(1, 3), L: 0, ph: rnd(0, TAU) });
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, C, p } = f, ch = g.ch, co = g.co, mode = p.mode;
    if (mode === 'pixel') return this.pixel(s, f);
    if (mode === 'wisp') return this.wisp(s, f);
    const sc = p.sc / Math.max(1, rows * aspect), h = p.h, base = p.base, amp = p.amp, oct = p.oct, rise = p.rise;
    const hyMax = Math.min(0.95, (base + amp * (mode === 'wall' ? 0.9 : 0.65) - 0.08) / h + 0.02);
    const camp = mode === 'camp', gas = mode === 'gas', cx = cols / 2;
    const W = camp ? Math.min(cols * 0.2, rows * aspect * 0.42) : 1, P = Math.max(8, Math.round(cols / 12));
    if (camp) for (const [x, y, ph] of s.st) g.set(x, y, '.', C(0.12 + 0.1 * Math.sin(t * 1.3 + ph)));
    const bot = camp ? rows - 3 : gas ? rows - 2 : rows;
    if (!s.wb || s.wb.length < cols + 2) { s.wb = new Float32Array(cols + 2); s.ob = new Float32Array(cols + 2); }
    for (let y = 0; y < bot; y++) {
      const hy = (bot - 1 - y) / rows, v = y * aspect * sc;
      if (hy > hyMax) continue;
      let x0 = 0, x1 = cols;
      if (camp) { x0 = Math.max(0, Math.floor(cx - W * 1.3)); x1 = Math.min(cols, Math.ceil(cx + W * 1.3)); }
      // 低頻的扭曲與第一個八度變化很慢：隔一格算一次、中間線性內插（肉眼看不出差別，省下約四分之一的雜訊計算）
      const Y = v + t * rise, Z = t * 0.4, wy = v * 0.5 + t * 0.6, wz = t * 0.2, WB = s.wb, OB = s.ob;
      const lo = (x) => { const u = x * sc, w = Noise.n3(u * 0.5, wy, wz) * 0.8, X = u + w; WB[x] = w; OB[x] = 0.5 * Noise.n3(X, Y, Z) + (oct > 1 ? 0.25 * Noise.n3(X * 2, Y * 2, Z * 2) : 0); };
      for (let x = x0; x < x1; x += 2) lo(x);
      if ((x1 - 1 - x0) & 1) lo(x1 - 1);
      for (let x = x0, i = y * cols + x0; x < x1; x++, i++) {
        const u = x * sc, odd = (x - x0) & 1 && x + 1 < x1;
        let m = 0;
        if (camp) { const dx = (x - cx) / W; m = dx * dx * 1.5 + hy * 0.4 * Math.abs(dx); }
        else if (gas) { const d = Math.abs(fract((x + 0.5) / P) - 0.5) * 2; m = hy * h * d * d * 3.5 + d * d * 0.35; }
        const warp = odd ? (WB[x - 1] + WB[x + 1]) * 0.5 : WB[x], X = u + warp;
        let sum = odd ? (OB[x - 1] + OB[x + 1]) * 0.5 : OB[x], a = 0.125, fq = 4;
        const e0 = base - hy * h - m, rest = (0.25 - 2 * 0.125 * Math.pow(0.5, oct - 2)) * 1.1 * amp;
        // 剩下的高頻八度最多只能改變 ±rest：一定看不見或一定是最亮時就不必再算
        if (oct > 2 && e0 + sum * amp + rest < 0.08) continue;
        if (oct > 2 && e0 + sum * amp - rest >= 1) { ch[i] = RAMP10[9]; co[i] = C(0.95); continue; }
        for (let o = 2; o < oct; o++) { sum += a * Noise.n3(X * fq, Y * fq, Z * fq); a *= 0.5; fq *= 2; }
        let e = e0 + sum * amp;
        if (e < 0.08) continue;
        e = Math.min(1, e);
        ch[i] = RAMP10[Math.min(9, (e * 10) | 0)]; co[i] = C(e * 0.95);
      }
    }
    if (camp) {
      // 木柴只畫在火焰沒蓋到（或很暗）的地方，看起來就在火的後面、底下
      const yb = rows - 2, lw = W * 0.95, wood = C(0.32), dark = C(0.2);
      const under = (x0, y0, x1, y1, c, col) => {
        const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
        for (let k = 0; k <= n; k++) {
          const x = Math.floor(x0 + ((x1 - x0) * k) / n), y = Math.floor(y0 + ((y1 - y0) * k) / n);
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const c0 = ch[y * cols + x];
          if (c0 === ' ' || c0 === '.' || c0 === ':' || c0 === '-') g.set(x, y, c, col);
        }
      };
      under(cx - lw, yb + 1, cx + lw * 0.8, yb - 1, '=', wood); under(cx + lw, yb + 1, cx - lw * 0.8, yb - 1, '=', wood);
      under(cx - lw * 0.5, yb + 1, cx + lw * 0.35, yb - 2, '#', dark);
      for (let k = -1; k <= 1; k += 2) for (let q = 0; q < 4; q++) g.set(cx + k * (lw + 1 + q * 2), yb + 1, 'o', C(0.25));
      for (let x = 0; x < cols; x++) if (g.ch[(rows - 1) * cols + x] === ' ') { const hs = hash2(x, 7.3); g.set(x, rows - 1, hs > 0.93 ? ',' : hs > 0.88 ? '.' : '_', C(hs > 0.88 ? 0.2 : 0.14)); }
      // 火星從火舌的尖端冒出來：找出火堆中央附近最高、還夠亮的那一列
      if (Math.random() < dt * 9) {
        let tipY = rows - 4;
        const xa = Math.max(0, Math.floor(cx - W * 0.5)), xb = Math.min(cols - 1, Math.ceil(cx + W * 0.5));
        search: for (let y = 0; y < rows - 3; y++) for (let x = xa; x <= xb; x++) if (RAMP10.indexOf(ch[y * cols + x]) >= 3) { tipY = y; break search; }
        this.spark(s, f, cx, tipY, W * 0.25);
      }
    } else if (gas) {
      for (let x = 0; x < cols; x++) {
        const d = Math.abs(fract((x + 0.5) / P) - 0.5) * 2;
        g.set(x, rows - 2, d < 0.5 ? '▀' : '_', C(d < 0.5 ? 0.35 : 0.2)); g.set(x, rows - 1, '▔', C(0.18));
      }
    } else if (mode === 'ember') {
      for (let x = 0; x < cols; x++) {
        const e = 0.55 + 0.45 * Noise.n3(x * 0.15, t * 0.5, 7);
        g.set(x, rows - 1, e > 0.75 ? '@' : e > 0.55 ? '%' : '#', C(e));
      }
      for (let k = p.sparks * cols * dt * 0.35; k > 0; k--) if (Math.random() < k) this.spark(s, f, rnd(0, cols), rows - 2, 0);
    }
    for (let k = s.sp.length - 1; k >= 0; k--) {
      const q = s.sp[k];
      q.L += dt;
      if (q.L > q.l || q.y < 0) { s.sp[k] = s.sp[s.sp.length - 1]; s.sp.pop(); continue; }
      q.x += (q.vx + Math.sin(t * 2 + q.ph) * 3 + Noise.n3(q.x * 0.05, q.y * 0.1, t * 0.3) * 6) * dt; q.y += q.vy * dt; q.vy *= Math.exp(-dt * 0.4);
      const e = 1 - q.L / q.l, tw = 0.5 + 0.5 * Math.sin(t * 13 + q.ph * 5);
      g.set(q.x, q.y, e > 0.6 ? (tw > 0.5 ? '*' : '+') : e > 0.3 ? "'" : '.', C(0.45 + e * 0.55));
    }
  },
  wisp(s, f) {
    const { g, cols, rows, aspect, t, C } = f, R = Math.min(cols * 0.09, rows * aspect * 0.13), sc = 6 / Math.max(1, rows * aspect);
    for (const w of s.w) {
      const wx = cols * (0.5 + 0.42 * Math.sin(t * w.fx + w.px + w.k)), wy = rows * (0.52 + 0.3 * Math.sin(t * w.fy + w.py)), r = R * w.r;
      const y0 = Math.max(0, Math.floor(wy - (r * 2.6) / aspect)), y1 = Math.min(rows - 1, Math.ceil(wy + r / aspect));
      const x0 = Math.max(0, Math.floor(wx - r * 1.3)), x1 = Math.min(cols - 1, Math.ceil(wx + r * 1.3));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x - wx) / r, dy = ((y - wy) * aspect) / r;
        const up = dy < 0 ? -dy : 0, sway = Math.sin(t * 3 + up * 2 + w.k) * up * 0.25;
        const q = (dx - sway) * (dx - sway) * (1 + up * 1.4) + (dy < 0 ? dy * dy * 0.16 : dy * dy * 1.4);
        let e = 1.05 - q + Noise.fbm(x * sc * 2, y * aspect * sc * 2 + t * 2.2, t * 0.5 + w.k, 2) * 0.7 - up * 0.12;
        if (e < 0.1) continue;
        e = Math.min(1, e);
        const i = y * cols + x;
        if (g.ch[i] !== ' ' && RAMP10.indexOf(g.ch[i]) >= ((e * 10) | 0)) continue;
        g.setI(i, RAMP10[Math.min(9, (e * 10) | 0)], C(0.2 + e * 0.8));
      }
      if (Math.random() < f.dt * 4) s.sp.push({ x: wx + rnd(-r * 0.4, r * 0.4), y: wy - r / aspect, l: rnd(0.8, 2), L: 0, vy: -rnd(2, 5) });
    }
    for (let k = s.sp.length - 1; k >= 0; k--) {
      const q = s.sp[k];
      q.L += f.dt; q.y += q.vy * f.dt; q.x += Math.sin(t * 2 + k) * f.dt;
      if (q.L > q.l) { s.sp[k] = s.sp[s.sp.length - 1]; s.sp.pop(); continue; }
      g.set(q.x, q.y, q.L < q.l * 0.5 ? '°' : '.', C(0.6 * (1 - q.L / q.l) + 0.2));
    }
  },
  pixel(s, f) {
    const { g, cols, dt, aspect, C } = f, rows = f.rows + 3, W = cols, hb = s.heat, Hc = rows * 2;
    if (!s.cm) {
      s.cm = new Float32Array(W * Hc); s.off = 0;
      for (let y = 0; y < Hc; y++) for (let x = 0; x < W; x++) {
        const a = (y / Hc) * TAU, n = Noise.n3(x * 0.2, Math.cos(a) * rows * 0.14 * aspect / TAU * 1.6, Math.sin(a) * rows * 0.14 * aspect / TAU * 1.6);
        s.cm[y * W + x] = clamp(0.45 + (n + 0.35) * 1.2, 0.15, 2);
      }
    }
    // 冷卻得夠快、冷卻圖的紋理夠細，火舌大約在六成高度就熄掉，不會斷成一團團飄到頂端
    const cool = 3.6 / rows;
    s.acc = Math.min(s.acc + dt, 0.2);
    while (s.acc >= 1 / 30) {
      s.acc -= 1 / 30; s.off = (s.off + 1) % Hc;
      const b = (rows - 1) * W;
      for (let x = 0; x < W; x++) hb[b + x] = Math.random() < 0.55 ? 1.25 : 0.2;
      for (let y = 0; y < rows - 1; y++) {
        const y1 = (y + 1) * W, y2 = Math.min(rows - 1, y + 2) * W, cmr = ((y + s.off) % Hc) * W;
        for (let x = 0; x < W; x++) {
          const xl = x > 0 ? x - 1 : x, xr = x < W - 1 ? x + 1 : x;
          const v = (hb[y1 + xl] + hb[y1 + x] + hb[y1 + xr] + hb[y2 + x]) * 0.25 - cool * s.cm[cmr + x];
          hb[y * W + x] = v > 0 ? v : 0;
        }
      }
    }
    const R = ' .:-=+*#%@';
    for (let i = 0; i < g.n; i++) {
      const e = hb[i];
      if (e < 0.06) continue;
      g.ch[i] = R[Math.min(9, (e * 10.5) | 0)]; g.co[i] = C(Math.min(1, e * 1.05));
    }
  } });

A({ id: 'starfield', name: '光速星海', cat: '太空', theme: 'ice', desc: '以光速穿越無盡的星空',
  params: { mode: '3d', warp: -1, roll: 0, streak: 1, rev: false, count: 14, twinkle: false, rainbow: false, jump: false, nebula: false },
  variants: [
    { id: 'hyper', name: '超光速', desc: '每隔幾秒躍進一次，星光拉成光之隧道', params: { jump: true, count: 16 } },
    { id: 'vortex', name: '星際漩渦', theme: 'synth', desc: '一邊前進一邊旋轉的星光漩渦', params: { warp: 0.75, roll: 0.7, streak: 1.4 } },
    { id: 'reverse', name: '時光倒流', theme: 'sakura', desc: '星星從眼前退向遠方的中心', params: { rev: true, warp: 0.9, streak: 1.3 } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f;
    s.ang = 0;
    if (p.mode === 'parallax') {
      const L = [0.004, 0.012, 0.03, 0.075, 0.16];
      s.st = [];
      for (let l = 0; l < L.length; l++) for (let k = (cols * rows / [70, 110, 160, 230, 420][l]) | 0; k > 0; k--) s.st.push({ x: rnd(0, cols), y: rint(0, rows - 1), l, v: L[l] * cols * rnd(0.85, 1.15), ph: rnd(0, TAU) });
      // 星雲帶：預先算好一張首尾相接的雜訊圖（取樣在圓柱面上，所以左右接縫看不出來），之後只要捲動
      const W2 = cols * 2, R = (W2 * 0.035) / TAU;
      s.nw = W2; s.nb = new Float32Array(W2 * rows); s.noff = 0;
      for (let x = 0; x < W2; x++) {
        const a = (x / W2) * TAU, X = Math.cos(a) * R, Z = Math.sin(a) * R, yc = rows * (0.5 + 0.22 * Noise.n3(X * 0.25, 3.3, Z * 0.25)), bw = rows * 0.2;
        for (let y = 0; y < rows; y++) {
          const m = Math.exp(-(((y - yc) / bw) ** 2));
          if (m < 0.05) continue;
          s.nb[y * W2 + x] = clamp((Noise.fbm(X, y * 0.11, Z, 3) * 1.2 + 0.25) * m, 0, 1);
        }
      }
      return;
    }
    if (p.nebula) {
      // 彩色星雲：在比畫面對角線還大的正方形上預先算好（半解析度），之後跟著鏡頭慢慢旋轉取樣
      const D = Math.ceil(Math.hypot(cols, rows * aspect)) + 4, N = Math.ceil(D / 2) + 1, sc = 3.4 / D;
      s.nD = D; s.nN = N; s.neb = new Float32Array(N * N); s.nhu = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const X = (i * 2 - D / 2) * sc, Y = (j * 2 - D / 2) * sc, d = Noise.fbm(X, Y, 1.3, 4);
        s.neb[j * N + i] = clamp(Math.pow(Math.max(0, d * 1.5 + 0.12), 1.3), 0, 1);
        s.nhu[j * N + i] = 190 + 170 * (0.5 + 0.5 * Noise.n3(X * 0.5 + 7, Y * 0.5, 2.2) * 1.4);
      }
    }
    s.mk = z => {
      if (p.rev && (z === undefined || z < 0)) { const zz = z < 0 ? -z : rnd(0.03, 0.35); return { x: rnd(-1, 1) * zz * 1.7, y: rnd(-1, 1) * zz * 1.7, z: zz, h: rnd(0, 360), ph: rnd(0, TAU) }; }
      return { x: rnd(-1.6, 1.6), y: rnd(-1.6, 1.6), z: z === undefined ? rnd(0.05, 1) : z, h: rnd(0, 360), ph: rnd(0, TAU) };
    };
    s.st = Array.from({ length: clamp((cols * rows / p.count) | 0, 80, 4000) }, () => { if (p.rev) return s.mk(-rnd(0.05, 1)); const q = s.mk(); q.z = rnd(0.05, 1); return q; });
  },
  // 超光速的躍進循環：巡航 → 加速 → 光之隧道 → 一下子收回成點
  jumpK(t) {
    const P = 9.5, u = t % P;
    if (u < 2.4) return 0;
    if (u < 3.6) { const k = (u - 2.4) / 1.2; return k * k * (3 - 2 * k); }
    if (u < 6.6) return 1;
    if (u < 7) return 1 - (u - 6.6) / 0.4;
    return 0;
  },
  frame(s, f) {
    const { g, cols, rows, aspect, C, H, t, dt, p } = f;
    if (p.mode === 'parallax') return this.parallax(s, f);
    const cx = cols / 2, cy = rows / 2, S = cols * 0.32, jk = p.jump ? this.jumpK(t) : 0;
    const warp = p.jump ? 0.35 + 1.9 * jk : p.warp < 0 ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.3)) : p.warp, vz = 0.4 * warp;
    s.ang += p.roll * dt;
    if (s.neb) this.nebula(s, f);
    const CH = ['.', '·', '+', '*', '✦'], rev = p.rev, trailT = 0.12 * (1 + warp * 2) * p.streak * (1 + 24 * jk * jk);
    const ca = Math.cos(s.ang), sa = Math.sin(s.ang), ta = s.ang - p.roll * trailT * (rev ? -1 : 1), ct = Math.cos(ta), stt = Math.sin(ta);
    for (let n = 0; n < s.st.length; n++) {
      const q = s.st[n];
      q.z += (rev ? vz : -vz) * dt;
      if (!rev && q.z <= 0.02) Object.assign(q, s.mk(1));
      if (rev && q.z > 1.15) Object.assign(q, s.mk());
      const rx = q.x * ca - q.y * sa, ry = q.x * sa + q.y * ca;
      const sx = cx + (rx / q.z) * S, sy = cy + ((ry / q.z) * S) / aspect;
      if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) { if (!rev && q.z < 0.6) Object.assign(q, s.mk(1)); if (rev) Object.assign(q, s.mk()); continue; }
      let b = clamp(1 - q.z, 0, 1);
      if (p.twinkle) b *= 0.55 + 0.45 * Math.sin(t * 2.5 + q.ph);
      // 躍進時只有三分之一的星星拉成長光束（其餘維持光點），整片光束就像一條隧道
      if (p.streak > 0 && (jk < 0.3 || n % 3 === 0)) {
        const tz = rev ? q.z * (1 - Math.min(0.3, vz * trailT * 1.2)) : q.z + vz * trailT;
        const tx = cx + ((q.x * ct - q.y * stt) / tz) * S, ty = cy + (((q.x * stt + q.y * ct) / tz) * S) / aspect;
        if (Math.hypot(sx - tx, (sy - ty) * aspect) > 1.5) {
          const a8 = ((Math.round(Math.atan2((sy - ty) * aspect, sx - tx) / (Math.PI / 4)) % 4) + 4) % 4, lb = b * 0.5 + jk * 0.3;
          g.line(tx, ty, sx, sy, '-\\|/'[a8], p.rainbow ? H(q.h, lb) : C(lb));
        }
      }
      g.set(sx, sy, CH[Math.min(4, (b * 5) | 0)], p.rainbow ? H(q.h, 0.3 + b * 0.7) : C(0.3 + b * 0.7));
    }
  },
  nebula(s, f) {
    const { g, cols, rows, aspect, H, t } = f, ch = g.ch, co = g.co, N = s.nN, D2 = s.nD / 2, neb = s.neb, nhu = s.nhu;
    const ca = Math.cos(s.ang), sa = Math.sin(s.ang), br = 0.85 + 0.15 * Math.sin(t * 0.21), R = ' .:-=+*';
    for (let y = 0, i = 0; y < rows; y++) {
      const dy = (y + 0.5 - rows / 2) * aspect;
      for (let x = 0; x < cols; x++, i++) {
        const dx = x + 0.5 - cols / 2, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        const k = (((v + D2) * 0.5) | 0) * N + (((u + D2) * 0.5) | 0), e = neb[k] * br;
        if (e < 0.07) continue;
        ch[i] = R[Math.min(6, (e * 7) | 0)]; co[i] = H(nhu[k], 0.1 + e * 0.42);
      }
    }
  },
  parallax(s, f) {
    const { g, cols, rows, dt, t, C } = f, CH = ['.', '.', '·', '+', '*'], BR = [0.22, 0.35, 0.5, 0.72, 1];
    s.noff = (s.noff + dt * cols * 0.02) % s.nw;
    const W2 = s.nw, nb = s.nb, off = s.noff | 0, ch = g.ch, co = g.co, R = ' .:░▒';
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const e = nb[y * W2 + ((x + off) % W2)];
      if (e < 0.12) continue;
      ch[i] = R[Math.min(4, (e * 5) | 0)]; co[i] = C(0.06 + e * 0.22);
    }
    for (const q of s.st) {
      q.x -= q.v * dt;
      if (q.x < -20) { q.x = cols + rnd(0, 10); q.y = rint(0, rows - 1); }
      const tw = q.l < 2 ? 0.75 + 0.25 * Math.sin(t * 2 + q.ph) : 1;
      if (q.l >= 2) { const L = Math.round(q.v * 0.25); for (let k = 1; k <= L; k++) g.set(q.x + k, q.y, k < L * 0.55 ? '-' : '·', C(BR[q.l] * (1 - k / (L + 1)) * 0.65)); }
      g.set(q.x, q.y, CH[q.l], C(BR[q.l] * tw));
    }
  } });

const FISH = [
  ['><>'],
  ['><(((º>'],
  ['><}}°>'],
  ['  __', '\\/ o\\', '/\\__/'],
  ['    _____', '\\  /   o \\', ' >|  )    >', '/  \\_____/'],
];
const MIRROR = { '<': '>', '>': '<', '(': ')', ')': '(', '/': '\\', '\\': '/', '{': '}', '}': '{', '[': ']', ']': '[' };
function mirror(lines) {
  const w = Math.max(...lines.map(l => l.length));
  return lines.map(l => l.padEnd(w).split('').reverse().map(c => MIRROR[c] || c).join(''));
}
const JELLY = [['  .--.  ', ' /    \\ ', '(______)'], ['  .--.  ', ' (    ) ', "  `--'  "]];
const ANGLER = ['        ,  ', '  .--. /   ', '><  o `.   ', "  `VVV-'   "];
const SHARK = [
  '                 /|',
  "              _.' |",
  "\\    _.---''''     ''''---.._",
  " >-''                    o   `>",
  "/   `''---...______.;;;..--''",
];
A({ id: 'aquarium', name: '字元水族箱', cat: '場景', theme: 'ocean', hue: true, desc: '魚兒游來游去、水草搖曳、氣泡上升',
  params: { fish: 400, school: 0, jelly: 0, deep: false, reef: false, shark: false, weed: 9 },
  variants: [
    { id: 'school', name: '魚群洄游', theme: 'ice', desc: '成群的小魚像波浪般一起游動', params: { school: 4, fish: 900 } },
    { id: 'jelly', name: '水母之舞', theme: 'lavender', desc: '一隻隻水母收縮脈動、緩緩上升', params: { jelly: -1, fish: 1400, weed: 14 } },
    { id: 'deep', name: '深海幽光', desc: '漆黑深海裡的鮟鱇魚與發光浮游', params: { deep: true, fish: 1500, weed: 0, jelly: 3 } },
    { id: 'reef', name: '珊瑚礁', desc: '五彩珊瑚與熱鬧的熱帶魚群', params: { reef: true, fish: 220, weed: 24 } },
    { id: 'shark', name: '鯊魚出沒', theme: 'blueprint', desc: '大鯊魚巡游而過，小魚四散奔逃', params: { shark: true, fish: 260 } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.mkFish = init => {
      const spr = pick(FISH), dir = Math.random() < 0.5 ? 1 : -1, w = Math.max(...spr.map(l => l.length));
      return { base: spr, spr: dir > 0 ? spr : mirror(spr), dir, w,
        x: init ? rnd(0, cols) : dir > 0 ? -w - rnd(0, 20) : cols + rnd(0, 20),
        y: rnd(2, Math.max(3, rows - 4 - spr.length)), v: rnd(3, 10) * (spr.length > 1 ? 0.7 : 1),
        hue: pick([20, 45, 190, 330, 280, 0, 160, 60]), ph: rnd(0, TAU), fl: 0 };
    };
    s.fish = Array.from({ length: clamp((cols * rows / p.fish) | 0, p.deep ? 3 : 4, p.reef || p.shark ? 90 : 40) }, () => s.mkFish(true));
    s.bub = [];
    s.weed = p.weed ? Array.from({ length: Math.max(3, (cols / p.weed) | 0) }, () => ({ x: rint(1, cols - 2), h: rint(3, Math.max(4, (rows * (p.reef ? 0.25 : 0.4)) | 0)), ph: rnd(0, 10) })) : [];
    s.sand = Array.from({ length: cols }, () => pick(['.', ',', '_', '.', '`', '.']));
    s.mkSchool = init => {
      const dir = Math.random() < 0.5 ? 1 : -1, rx = rnd(8, 16) * Math.max(1, cols / 160), ry = rnd(2.5, 4.5) * Math.max(1, rows / 50);
      const m = Array.from({ length: Math.round(rx * ry * 0.45) }, () => { const a = rnd(0, TAU), r = Math.sqrt(Math.random()); return { ox: Math.cos(a) * r * rx, oy: Math.sin(a) * r * ry, ph: rnd(0, TAU), big: Math.random() < 0.4 }; });
      return { dir, rx, m, x: init ? rnd(0, cols) : dir > 0 ? -rx - 4 : cols + rx + 4, y: rnd(rows * 0.2, rows * 0.75), v: rnd(5, 9), ph: rnd(0, TAU), hue: pick([190, 45, 200, 15, 160]) };
    };
    s.schools = Array.from({ length: p.school }, () => s.mkSchool(true));
    const nj = p.jelly < 0 ? clamp(Math.round(cols * rows / 1300), 4, 22) : p.jelly;
    s.mkJelly = init => ({ x: rnd(4, cols - 10), y: init ? rnd(0, rows) : rows + rnd(2, 8), ph: rnd(0, TAU), hue: pick([280, 320, 190, 40, 200]), n: rint(3, 6), tl: rint(3, Math.max(4, (rows / 9) | 0)) });
    s.jelly = Array.from({ length: nj }, () => s.mkJelly(true));
    s.angl = p.deep ? Array.from({ length: clamp(Math.round(cols / 70), 2, 5) }, () => { const d = Math.random() < 0.5 ? 1 : -1; return { x: rnd(0, cols), y: rnd(rows * 0.25, rows * 0.8), dir: d, v: rnd(1.2, 2.5), ph: rnd(0, TAU), spr: d > 0 ? ANGLER : mirror(ANGLER) }; }) : [];
    s.snow = p.deep ? Array.from({ length: (cols * rows / 55) | 0 }, () => ({ x: rnd(0, cols), y: rnd(0, rows), v: rnd(0.4, 1.4), ph: rnd(0, TAU), c: pick('..,·') })) : [];
    s.plank = p.deep ? Array.from({ length: (cols * rows / 160) | 0 }, () => ({ x: rint(0, cols - 1), y: rint(0, rows - 2), ph: rnd(0, TAU), fr: rnd(0.3, 0.9), hue: pick([180, 190, 200, 160]) })) : [];
    s.coral = [];
    if (p.reef) {
      for (let x = 2; x < cols - 2; x += rint(5, 11)) {
        const hue = pick([0, 15, 30, 300, 330, 45, 280]), kind = rint(0, 2), hgt = rint(Math.max(3, rows * 0.1) | 0, Math.max(4, rows * 0.32) | 0), cells = [];
        if (kind === 0) {
          for (let st = 0; st < 3; st++) { let cx = x + rnd(-1, 1); for (let k = 0; k < hgt - st * 2; k++) { const d = rint(-1, 1); cx += d * 0.6; cells.push([cx, rows - 2 - k, k === hgt - st * 2 - 1 ? 'Y' : d < 0 ? '\\' : d > 0 ? '/' : '|']); } }
        } else if (kind === 1) {
          const r = Math.max(2, hgt * 0.8);
          for (let a = 0.15; a < Math.PI - 0.1; a += 0.07) for (let q = 1; q <= r; q += 1) cells.push([x + Math.cos(a) * q * 1.8, rows - 2 - Math.sin(a) * q * 0.6, q > r - 1 ? '*' : ':']);
        } else {
          const r = rint(2, 4);
          for (let dy = 0; dy < r; dy++) for (let dx = -r * 2 + dy; dx <= r * 2 - dy; dx++) cells.push([x + dx, rows - 2 - dy, (dx + dy) % 3 ? '@' : '(']);
        }
        s.coral.push({ hue, cells, kind });
      }
    }
    s.sh = p.shark ? { on: false, next: 2 } : null;
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, C, H, p } = f;
    const top = p.deep ? -1 : 0;
    for (const q of s.snow) { q.y += q.v * dt; q.x += Math.sin(t * 0.7 + q.ph) * dt * 0.5; if (q.y >= rows) { q.y = 0; q.x = rnd(0, cols); } g.set(q.x, q.y, q.c, C(0.18 + 0.08 * Math.sin(t + q.ph))); }
    for (const q of s.plank) { const b = Math.pow(Math.max(0, Math.sin(t * q.fr + q.ph)), 10); if (b > 0.05) g.set(q.x, q.y, b > 0.6 ? '*' : '·', H(q.hue, 0.3 + b * 0.6)); }
    if (top === 0) for (let x = 0; x < cols; x++) g.set(x, 0, (x + Math.floor(t * 3)) % 9 === 0 ? '^' : '~', C(0.55));
    for (const w of s.weed) {
      const ph = (t * 1.5 + w.ph) | 0;
      for (let k = 0; k < w.h; k++) { const odd = (k + ph) & 1; g.set(w.x + odd, rows - 2 - k, odd ? ')' : '(', H(120, 0.3 + 0.3 * (k / w.h))); }
    }
    for (const c of s.coral) {
      const sway = c.kind === 0 ? Math.sin(t * 0.8 + c.hue) * 0.4 : 0;
      for (const [x, y, ch] of c.cells) g.set(x + sway * (rows - 2 - y) * 0.15, y, ch, H(c.hue, 0.45 + 0.2 * ((rows - y) / rows)));
    }
    for (let x = 0; x < cols; x++) g.set(x, rows - 1, s.sand[x], H(40, p.deep ? 0.22 : 0.5));
    const sh = s.sh;
    if (sh) {
      if (!sh.on) { sh.next -= dt; if (sh.next <= 0) { const d = Math.random() < 0.5 ? 1 : -1; Object.assign(sh, { on: true, dir: d, spr: d > 0 ? SHARK : mirror(SHARK), w: spriteW(SHARK), y: rnd(rows * 0.2, rows * 0.7 - 5), v: Math.max(7, cols / 16) }); sh.x = d > 0 ? -sh.w : cols; } }
      else { sh.x += sh.dir * sh.v * dt; if (sh.x > cols + 2 || sh.x < -sh.w - 2) { sh.on = false; sh.next = rnd(4, 9); } }
    }
    const dim = p.deep ? 0.42 : 0.72;
    for (let k = 0; k < s.fish.length; k++) {
      const fi = s.fish[k];
      if (sh && sh.on) {
        const nose = sh.dir > 0 ? sh.x + sh.w : sh.x, ahead = (fi.x - nose) * sh.dir;
        if (ahead > -sh.w && ahead < 40 && Math.abs(fi.y + 1 - (sh.y + 2.5)) < 7) {
          if (fi.dir !== sh.dir) { fi.dir = sh.dir; fi.spr = fi.dir > 0 ? fi.base : mirror(fi.base); }
          fi.fl = 1.5; fi.y += Math.sign(fi.y + 1 - sh.y - 2.5 || 1) * dt * 6; fi.y = clamp(fi.y, 1, rows - 3);
        }
      }
      if (fi.fl > 0) fi.fl -= dt;
      fi.x += fi.dir * fi.v * dt * (fi.fl > 0 ? 3 : 1);
      if ((fi.dir > 0 && fi.x > cols + 2) || (fi.dir < 0 && fi.x < -fi.w - 2)) { s.fish[k] = s.mkFish(false); continue; }
      const y = fi.y + Math.sin(t * 1.2 + fi.ph) * 0.6;
      g.sprite(fi.x, y, fi.spr, H(fi.hue, dim));
      if (p.deep) g.set(fi.x + (fi.dir > 0 ? fi.w - 2 : 1), y + (fi.spr.length > 1 ? 1 : 0), '°', H(60, 0.7));
      if (!p.deep && Math.random() < dt * 0.3) s.bub.push({ x: fi.x + (fi.dir > 0 ? fi.w : -1), y, v: rnd(2, 4) });
    }
    for (let k = 0; k < s.schools.length; k++) {
      const sc = s.schools[k];
      sc.x += sc.dir * sc.v * dt;
      if ((sc.dir > 0 && sc.x - sc.rx > cols + 4) || (sc.dir < 0 && sc.x + sc.rx < -4)) { s.schools[k] = s.mkSchool(false); continue; }
      const wy = sc.y + Math.sin(t * 0.45 + sc.ph) * rows * 0.12;
      for (const m of sc.m) {
        const x = sc.x + m.ox + Math.sin(t * 1.3 + m.ph) * 1.2, y = wy + m.oy + Math.sin(t * 0.9 + m.ph + m.ox * 0.15) * 0.8;
        g.text(x, y, m.big ? (sc.dir > 0 ? '><>' : '<><') : sc.dir > 0 ? '>' : '<', H(sc.hue + m.oy * 6, 0.55 + 0.25 * Math.sin(t * 2 + m.ph)));
      }
    }
    for (let k = 0; k < s.jelly.length; k++) {
      const j = s.jelly[k], pulse = Math.sin(t * 1.7 + j.ph), con = pulse > 0.2;
      j.y -= (0.25 + 1.6 * Math.max(0, pulse)) * dt; j.x += Math.sin(t * 0.3 + j.ph) * dt * 0.8;
      if (j.y < -j.tl - 4) { s.jelly[k] = s.mkJelly(false); continue; }
      const glow = p.deep ? 0.45 + 0.35 * Math.max(0, pulse) : 0.62;
      g.sprite(j.x, j.y, JELLY[con ? 1 : 0], H(j.hue, glow));
      for (let q = 0; q < 4; q++) {
        const tx = j.x + 1.5 + q * 1.6;
        for (let d = 0; d < j.tl + (con ? -1 : 1); d++) {
          const w = Math.sin(t * 2.4 - d * 0.9 + q * 1.3 + j.ph);
          g.set(tx + Math.round(w * 0.7), j.y + 3 + d, w > 0.35 ? ')' : w < -0.35 ? '(' : '|', H(j.hue + 20, glow * (0.75 - d * 0.04)));
        }
      }
    }
    for (const a of s.angl) {
      a.x += a.dir * a.v * dt;
      if (a.x > cols + 12) { a.x = -12; } else if (a.x < -12) a.x = cols + 12;
      const y = a.y + Math.sin(t * 0.6 + a.ph) * 1.5, b = 0.6 + 0.4 * Math.sin(t * 2.2 + a.ph);
      g.sprite(a.x, y, a.spr, H(25, 0.3));
      const lx = a.dir > 0 ? a.x + 8 : a.x + 2;
      g.set(lx, y - 1, '●', H(55, 0.55 + b * 0.45));
      if (b > 0.5) { const hc = H(55, b * 0.35); g.set(lx - 1, y - 1, '·', hc); g.set(lx + 1, y - 1, '·', hc); g.set(lx, y - 2, '·', hc); }
    }
    if (sh && sh.on) g.sprite(sh.x, sh.y + Math.sin(t * 0.8) * 0.5, sh.spr, C(0.8));
    if (!p.deep && Math.random() < dt * 3 && s.weed.length) s.bub.push({ x: s.weed[0].x + 3, y: rows - 2, v: rnd(3, 6) });
    for (let k = s.bub.length - 1; k >= 0; k--) {
      const b = s.bub[k];
      b.y -= b.v * dt; b.x += Math.sin(t * 3 + k) * dt * 0.8;
      if (b.y < 1) { s.bub[k] = s.bub[s.bub.length - 1]; s.bub.pop(); continue; }
      const r = 1 - b.y / rows;
      g.set(b.x, b.y, r < 0.35 ? '.' : r < 0.7 ? 'o' : 'O', C(0.75));
    }
  } });

const DIG = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['0', '1', '1', '0', '1', '1', '0'],
};
// 七段顯示器：每個數字亮哪幾段（a 上 b 右上 c 右下 d 下 e 左下 f 左上 g 中）
const SEG7 = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
const p2 = n => String(n).padStart(2, '0');
const WEEK = '日一二三四五六';
const WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateStr = (now, f) => tr(f, `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日　星期${WEEK[now.getDay()]}`,
  `${WEEK_EN[now.getDay()]}, ${MONTH_EN[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`);
A({ id: 'clock', name: '大字時鐘', cat: '實用', theme: 'amber', desc: '即時的大字時鐘、日期與秒數進度',
  params: { style: 'block', h12: false },
  variants: [
    { id: 'h12', name: '十二小時制', desc: '點陣燈板顯示上午／下午時間', params: { style: 'dot', h12: true } },
    { id: 'minimal', name: '極簡時分', theme: 'mono', desc: '只有時與分的鏤空大字', params: { style: 'minimal' } },
    { id: 'seg', name: '七段顯示', theme: 'blood', desc: '紅色七段顯示器，未亮的段落淡淡可見', params: { style: 'seg' } },
    { id: 'analog', name: '指針時鐘', theme: 'paper', desc: '刻度錶面與平滑轉動的秒針', params: { style: 'analog' } },
    { id: 'binary', name: '二進位鐘', theme: 'cyber', desc: '以亮暗方塊表示時分秒的二進位', params: { style: 'binary' } },
    { id: 'flip', name: '翻頁鐘', theme: 'mono', desc: '數字卡片翻落換頁的復古時鐘', params: { style: 'flip' } },
  ],
  init(s, f) { s.dots = Array.from({ length: (f.cols * f.rows / 60) | 0 }, () => ({ x: rnd(0, f.cols), y: rnd(0, f.rows), v: rnd(0.3, 1.2), p: rnd(0, TAU) })); s.flip = []; },
  frame(s, f) {
    const { g, rows, t, C } = f, now = new Date();
    for (const d of s.dots) { d.y -= d.v * f.dt; if (d.y < 0) { d.y = rows; d.x = rnd(0, f.cols); } g.set(d.x, d.y, '.', C(0.12 + 0.1 * Math.sin(t + d.p))); }
    const st = f.p.style;
    if (st === 'analog') return this.analog(s, f, now);
    if (st === 'seg') return this.seg(s, f, now);
    if (st === 'binary') return this.binary(s, f, now);
    if (st === 'flip') return this.flipc(s, f, now);
    return this.block(s, f, now);
  },
  block(s, f, now) {
    const { g, cols, rows, aspect, C, p } = f, st = p.style, minimal = st === 'minimal', dot = st === 'dot';
    let hh = now.getHours();
    if (p.h12) hh = hh % 12 || 12;
    const str = minimal ? p2(hh) + ':' + p2(now.getMinutes()) : p2(hh) + ':' + p2(now.getMinutes()) + ':' + p2(now.getSeconds());
    let pw = -1;
    for (const c of str) pw += DIG[c][0].length + 1;
    const fill = minimal ? 0.6 : 0.42;
    const sy = Math.max(1, Math.floor(Math.min((rows * fill) / 7, (cols * (minimal ? 0.8 : 0.86)) / (pw * aspect)))), sx = Math.max(1, Math.round(sy * aspect));
    const W = pw * sx, Hh = 7 * sy, ox = Math.floor((cols - W) / 2), oy = Math.floor((rows - Hh) / 2) - Math.floor(rows * 0.06);
    const blink = now.getMilliseconds() < 500, shx = Math.max(1, Math.ceil(sx / 4)), shy = Math.max(1, Math.ceil(sy / 4));
    const lit = (bm, r, q) => r >= 0 && r < 7 && q >= 0 && q < bm[0].length && bm[r][q] === '1';
    for (let pass = dot || minimal ? 1 : 0; pass < 2; pass++) {
      let cx = ox;
      for (const c of str) {
        const bm = DIG[c], w = bm[0].length;
        const on = !(c === ':' && !blink);
        for (let r = 0; r < 7; r++) for (let q = 0; q < w; q++) {
          const L = bm[r][q] === '1';
          if (dot) {
            if (c === ':' && !L) continue;
            const col = L && on ? C(1 - (r / 7) * 0.3) : C(0.16), chr = L && on ? '●' : '·';
            for (let yy = 0; yy < sy; yy++) for (let xx = 0; xx < sx; xx++) if (!(xx & 1)) g.set(cx + q * sx + xx, oy + r * sy + yy, chr, col);
            continue;
          }
          if (!L || !on) continue;
          if (minimal) {
            const col = C(0.95 - (r / 7) * 0.25);
            const nU = lit(bm, r - 1, q), nD = lit(bm, r + 1, q), nL = lit(bm, r, q - 1), nR = lit(bm, r, q + 1);
            for (let yy = 0; yy < sy; yy++) for (let xx = 0; xx < sx; xx++) {
              const edge = (!nU && yy === 0) || (!nD && yy === sy - 1) || (!nL && xx < 2) || (!nR && xx >= sx - 2);
              if (edge) g.set(cx + q * sx + xx, oy + r * sy + yy, '█', col);
              else if ((xx + yy * 2) % 6 === 0) g.set(cx + q * sx + xx, oy + r * sy + yy, '·', C(0.35));
            }
            continue;
          }
          const col = pass ? C(1 - (r / 7) * 0.45) : C(0.2);
          for (let yy = 0; yy < sy; yy++) for (let xx = 0; xx < sx; xx++) {
            if (pass) g.set(cx + q * sx + xx, oy + r * sy + yy, '█', col);
            else g.set(cx + q * sx + xx + shx, oy + r * sy + yy + shy, '░', col);
          }
        }
        cx += (w + 1) * sx;
      }
    }
    const ds = dateStr(now, f);
    const dy = oy + Hh + Math.max(2, sy);
    if (p.h12) { const ap = now.getHours() < 12 ? tr(f, '上午', 'AM') : tr(f, '下午', 'PM'); g.text((cols - g.textW(ap)) / 2, oy - Math.max(2, sy), ap, C(0.85)); }
    g.text((cols - g.textW(ds)) / 2, dy, ds, C(0.75));
    const bw = Math.min(cols - 4, Math.max(20, W)), bx = Math.floor((cols - bw) / 2), prog = (now.getSeconds() + now.getMilliseconds() / 1000) / 60;
    if (minimal) { const k = Math.floor(prog * bw); g.set(bx + k, dy + 2, '◆', C(0.9)); for (let q = 0; q < bw; q += 3) if (q !== k) g.set(bx + q, dy + 2, '·', C(q < k ? 0.5 : 0.2)); return; }
    for (let k = 0; k < bw; k++) g.set(bx + k, dy + 2, k < prog * bw ? '━' : '─', k < prog * bw ? C(0.85) : C(0.25));
  },
  seg(s, f, now) {
    const { g, cols, rows, aspect, C } = f;
    const digs = [now.getHours(), now.getMinutes(), now.getSeconds()].map(p2).join('');
    const dh = Math.max(5, Math.floor(rows * 0.44)), dw = Math.max(4, Math.round(dh * aspect * 0.52)), gap = Math.max(2, Math.round(dw * 0.35)), cg = Math.max(3, Math.round(dw * 0.55));
    const total = dw * 6 + gap * 3 + cg * 2;
    const sc = Math.min(1, (cols * 0.92) / total), DW = Math.max(4, Math.round(dw * sc)), DH = Math.max(5, Math.round(dh * sc)), GP = Math.max(1, Math.round(gap * sc)), CG = Math.max(2, Math.round(cg * sc));
    const T = Math.max(1, Math.round(DH * 0.1)), TV = Math.max(1, Math.round(T * aspect * 0.8)), W = DW * 6 + GP * 3 + CG * 2;
    const ox = Math.floor((cols - W) / 2), oy = Math.floor((rows - DH) / 2) - Math.floor(rows * 0.05), mid = Math.floor((DH - T) / 2), skew = 0.18;
    const put = (x, y, on) => g.set(x + (DH - y) * skew, oy + y, on ? '█' : '░', on ? C(0.95 - (y / DH) * 0.3) : C(0.12));
    let x = ox;
    for (let k = 0; k < 6; k++) {
      const sg = SEG7[+digs[k]];
      const segs = { a: [TV, 0, DW - 2 * TV, T, 'h'], d: [TV, DH - T, DW - 2 * TV, T, 'h'], g: [TV, mid, DW - 2 * TV, T, 'h'],
        f: [0, T, TV, mid - T, 'v'], b: [DW - TV, T, TV, mid - T, 'v'], e: [0, mid + T, TV, DH - T - mid - T, 'v'], c: [DW - TV, mid + T, TV, DH - T - mid - T, 'v'] };
      for (const key of 'abcdefg') {
        const [sx0, sy0, w, h] = segs[key], on = sg.includes(key);
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(x + sx0 + xx, sy0 + yy, on);
      }
      x += DW + (k % 2 === 0 ? GP : 0);
      if (k === 1 || k === 3) {
        const on = now.getMilliseconds() < 500, cx = x + Math.floor((CG - TV) / 2);
        for (const yy of [Math.floor(DH * 0.3), Math.floor(DH * 0.68)]) for (let q = 0; q < T; q++) for (let w = 0; w < TV; w++) put(cx + w, yy + q, on);
        x += CG;
      }
    }
    const ds = dateStr(now, f);
    g.text((cols - g.textW(ds)) / 2, oy + DH + Math.max(2, T * 2), ds, C(0.6));
  },
  analog(s, f, now) {
    const { g, cols, rows, aspect, C } = f, cx = cols / 2, cy = rows / 2, R = Math.min(cols * 0.5, rows * aspect * 0.5) * 0.9;
    const ms = now.getMilliseconds() / 1000, sec = now.getSeconds() + ms, mn = now.getMinutes() + sec / 60, hr = (now.getHours() % 12) + mn / 60;
    const P = (a, r) => [cx + Math.sin(a) * r, cy - (Math.cos(a) * r) / aspect];
    for (let a = 0; a < TAU; a += 0.6 / R) { const [x, y] = P(a, R); g.set(x, y, '·', C(0.45)); }
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * TAU, big = k % 5 === 0, [x, y] = P(a, R * 0.93);
      if (big) { const [x2, y2] = P(a, R * 0.85); g.line(x2, y2, x, y, '#', C(0.85)); } else g.set(x, y, '.', C(0.55));
      if (big) { const lab = String(k / 5 || 12), [lx, ly] = P(a, R * 0.73); g.text(lx - (lab.length - 1) / 2, ly, lab, C(0.9)); }
    }
    const hand = (a, len, w, ch, col) => {
      const [x1, y1] = P(a, len), [x0, y0] = P(a + Math.PI, len * 0.12);
      for (let o = -w; o <= w; o++) { const ox = Math.cos(a) * o * 0.5, oy = (Math.sin(a) * o * 0.5) / aspect; g.line(x0 + ox, y0 + oy, x1 + ox, y1 + oy, ch, col); }
    };
    const dch = a => { const k = ((Math.round((a / Math.PI) * 4) % 8) + 8) % 8; return '|/-\\|/-\\'[k]; };
    const ah = (hr / 12) * TAU, am = (mn / 60) * TAU, as = (sec / 60) * TAU;
    hand(ah, R * 0.5, Math.max(1, Math.round(R / 25)), '█', C(0.9));
    hand(am, R * 0.75, Math.max(1, Math.round(R / 45)), '█', C(0.75));
    hand(as, R * 0.86, 0, dch(as), C(1));
    const [tx, ty] = P(as, R * 0.86); g.set(tx, ty, '●', C(1));
    g.set(cx, cy, '◆', C(1));
    const ds = tr(f, `${p2(now.getHours())}:${p2(now.getMinutes())}  ${now.getMonth() + 1}/${now.getDate()} 星期${WEEK[now.getDay()]}`,
      `${p2(now.getHours())}:${p2(now.getMinutes())}  ${WEEK_EN[now.getDay()].slice(0, 3)} ${now.getMonth() + 1}/${now.getDate()}`);
    g.text(cx - g.textW(ds) / 2, cy + (R * 0.38) / aspect + 1, ds, C(0.6));
  },
  binary(s, f, now) {
    const { g, cols, rows, aspect, C } = f;
    const parts = [now.getHours(), now.getMinutes(), now.getSeconds()].map(p2).join(''), bits = [2, 4, 3, 4, 3, 4];
    const bh = Math.max(1, Math.floor((rows * 0.62) / 4 / 1.5)), bw = Math.max(2, Math.min(Math.round(bh * aspect * 1.6), Math.floor((cols * 0.8) / 9.5)));
    const gx = Math.max(1, Math.round(bw * 0.35)), gy = Math.max(1, Math.round(bh * 0.5)), pg = bw;
    const W = bw * 6 + gx * 3 + pg * 2, Hh = bh * 4 + gy * 3, ox = Math.floor((cols - W) / 2), oy = Math.floor((rows - Hh) / 2) - 1;
    let x = ox;
    for (let k = 0; k < 6; k++) {
      const v = +parts[k];
      for (let b = 0; b < 4; b++) {
        const y = oy + (3 - b) * (bh + gy), has = b < bits[k], on = has && (v >> b) & 1;
        if (!has) continue;
        for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
          const edge = yy === 0 || yy === bh - 1 || xx === 0 || xx === bw - 1;
          g.set(x + xx, y + yy, on ? '█' : edge ? '░' : ' ', on ? C(0.9 - (yy / bh) * 0.25) : C(0.25));
        }
      }
      g.text(x + bw / 2 - 0.5, oy + Hh + 1, parts[k], C(0.7));
      x += bw + (k % 2 === 0 ? gx : pg);
    }
    const lab = tr(f, ['時', '分', '秒'], ['HR', 'MIN', 'SEC']);
    // 中文標籤寬 2 格、置中於 lx + 1；英文依字數重新置中
    for (let k = 0; k < 3; k++) { const lx = ox + k * (bw * 2 + gx + pg) + bw + gx / 2 - 1; g.text(tr(f, lx, lx + 1 - lab[k].length / 2), oy - 2, lab[k], C(0.6)); }
    for (let b = 0; b < 4; b++) g.text(ox - 4, oy + (3 - b) * (bh + gy) + Math.floor(bh / 2), String(1 << b), C(0.35));
    const ds = dateStr(now, f);
    g.text((cols - g.textW(ds)) / 2, oy + Hh + 3, ds, C(0.5));
  },
  flipc(s, f, now) {
    const { g, cols, rows, aspect, C } = f;
    const digs = [now.getHours(), now.getMinutes(), now.getSeconds()].map(p2).join('');
    const ch = Math.max(9, Math.floor(rows * 0.46)), cw = Math.max(7, Math.round(ch * aspect * 0.5)), gp = Math.max(1, Math.round(cw * 0.12)), gg = Math.max(3, Math.round(cw * 0.45));
    const sc = Math.min(1, (cols * 0.94) / (cw * 6 + gp * 3 + gg * 2)), CW = Math.max(6, Math.floor(cw * sc)), CH = Math.max(8, Math.floor(ch * sc)), GP = Math.max(1, Math.round(gp * sc)), GG = Math.max(2, Math.round(gg * sc));
    const W = CW * 6 + GP * 3 + GG * 2, ox = Math.floor((cols - W) / 2), oy = Math.floor((rows - CH) / 2) - 1, mid = Math.floor(CH / 2);
    const mx = Math.max(1, Math.round(CW * 0.16)), my = Math.max(1, Math.round(CH * 0.12));
    const pix = (d, r, x) => { const fy = ((r - my) / (CH - 2 * my)) * 7, fx = ((x - mx) / (CW - 2 * mx)) * 5; if (fy < 0 || fy >= 7 || fx < 0 || fx >= 5) return false; return DIG[d][fy | 0][fx | 0] === '1'; };
    const tnow = f.t;
    let x = ox;
    for (let k = 0; k < 6; k++) {
      const d = digs[k], fl = s.flip[k] || (s.flip[k] = { cur: d, old: d, t0: -9 });
      if (fl.cur !== d) { fl.old = fl.cur; fl.cur = d; fl.t0 = tnow; }
      const u = clamp((tnow - fl.t0) / 0.45, 0, 1);
      for (let r = 0; r < CH; r++) {
        let src = r, dg = d, shade = 1;
        if (u < 1) {
          if (r < mid) { const top = mid - (1 - 2 * u) * mid; if (u < 0.5 && r >= top) { dg = fl.old; src = mid - (mid - r) / Math.max(0.05, 1 - 2 * u); shade = 0.6 + 0.4 * (1 - 2 * u); } }
          else if (u < 0.5) dg = fl.old;
          else { const bot = mid + (2 * u - 1) * (CH - mid); if (r < bot) { src = mid + (r - mid) / Math.max(0.05, 2 * u - 1); shade = 0.6 + 0.4 * (2 * u - 1); } else dg = fl.old; }
        }
        for (let q = 0; q < CW; q++) {
          const corner = (r === 0 || r === CH - 1) && (q === 0 || q === CW - 1);
          if (corner) continue;
          if (r === mid) { g.set(x + q, oy + r, '─', C(0.08)); continue; }
          const on = pix(dg, src, q);
          g.set(x + q, oy + r, on ? '█' : '▓', on ? C((0.95 - (r / CH) * 0.15) * shade) : C(r < mid ? 0.16 : 0.12));
        }
      }
      x += CW + (k % 2 === 0 ? GP : GG);
    }
    const ds = dateStr(now, f);
    g.text((cols - g.textW(ds)) / 2, oy + CH + 2, ds, C(0.6));
  } });

const SIGNS = ['BAR', 'HOTEL', '24H', 'OPEN', 'NOODLE', 'CAFE', 'KARAOKE', 'DINER', 'TEA', 'CLUB'];
const WALKER = [[' .---. ', '/_____\\', '   |   ', '   o   ', '  /|\\  ', '  / \\  '], [' .---. ', '/_____\\', '   |   ', '   o   ', '  /|\\  ', '   |   ']];
A({ id: 'rain', name: '城市雨夜', cat: '自然', theme: 'ice', hue: true, desc: '雨絲落在夜晚的城市，偶爾劃過閃電',
  params: { mode: 'city', dens: 45, vmin: 28, vmax: 46, wind: 0.35, bolt: true, bmin: 6, bmax: 16, soft: false, lit: 0.28, neon: false, walkers: false, drizzle: false },
  variants: [
    { id: 'storm', name: '暴風雨', theme: 'blueprint', desc: '狂風斜雨，分岔閃電照亮天際', params: { dens: 15, vmin: 45, vmax: 75, wind: 0.95, bmin: 3.5, bmax: 8, soft: true } },
    { id: 'neon', name: '霓虹街', theme: 'cyber', desc: '閃爍霓虹招牌倒映在濕漉漉的街上', params: { neon: true, lit: 0.18, bolt: false, dens: 40 } },
    { id: 'window', name: '雨窗', theme: 'ocean', desc: '隔著布滿水珠的玻璃看模糊燈光', params: { mode: 'window' } },
    { id: 'walkers', name: '雨中行人', theme: 'mono', desc: '撐著彩色雨傘走過街頭的路人', params: { walkers: true, bolt: false, dens: 55 } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    if (p.mode === 'window') return this.winit(s, f);
    s.refl = p.neon ? Math.max(2, Math.floor(rows * 0.2)) : 0;
    s.street = p.walkers ? WALKER[0].length + 1 : 0;   // 行人走在建築物前面的一條人行道上，不會和窗戶疊在一起
    const ground = rows - 1 - s.refl - s.street;
    s.drops = Array.from({ length: Math.max(30, (cols * rows / p.dens) | 0) }, () => ({ x: rnd(-cols * 0.2, cols * 1.2), y: rnd(-rows, ground), v: rnd(p.vmin, p.vmax) }));
    s.spl = []; s.flash = 0; s.bolt = null; s.next = rnd(p.soft ? 2 : 5, p.soft ? 5 : 12); s.b = [];
    for (let x = 0; x < cols; ) {
      const w = rint(6, 16), h = rint(Math.max(3, ground * 0.15) | 0, Math.max(4, ground * 0.5) | 0);
      const b = { x, w, h, win: Array.from({ length: w * h }, () => Math.random() < p.lit) };
      if (p.neon && Math.random() < 0.6) { const txt = pick(SIGNS); b.sign = { txt, vert: txt.length + 2 > h * 0.8 ? false : Math.random() < 0.5, hue: pick([320, 190, 50, 280, 0, 140]), ph: rnd(0, 100), dy: rint(1, Math.max(1, h - txt.length - 1)) }; }
      s.b.push(b);
      x += w + rint(0, 2);
    }
    s.walk = p.walkers ? Array.from({ length: clamp(Math.round(cols / 22), 3, 14) }, () => this.mkWalker(f, true)) : [];
    s.fog = p.drizzle ? Array.from({ length: (cols * rows / 40) | 0 }, () => [rnd(0, cols), rint(0, rows - 2), rnd(0, TAU)]) : null;
  },
  mkWalker(f, init) {
    const d = Math.random() < 0.5 ? 1 : -1;
    return { x: init ? rnd(0, f.cols) : d > 0 ? -8 : f.cols + 1, d, v: rnd(3, 6), hue: pick([0, 30, 50, 120, 200, 280, 320]), ph: rnd(0, 10) };
  },
  frame(s, f) {
    const { g, cols, rows, aspect, dt, t, C, H, p } = f;
    if (p.mode === 'window') return this.wframe(s, f);
    const ground = rows - 1 - s.refl - s.street, floor = s.street ? rows - 1 : ground;
    const wind = p.soft ? p.wind * Math.sin(t * 0.09) + 0.25 * Math.sin(t * 0.6) : p.wind * Math.sin(t * 0.13) + 0.1 * Math.sin(t * 0.7);
    if (s.fog) for (const q of s.fog) { const n = Noise.n3(q[0] * 0.04 + t * 0.05, q[1] * 0.12, t * 0.07); if (n > 0.1) g.set(q[0], q[1], n > 0.3 ? ':' : '.', C(0.1 + n * 0.25)); }
    for (const b of s.b) {
      const top = ground - b.h;
      for (let dx = 0; dx < b.w; dx++) g.set(b.x + dx, top, '_', C(0.25));
      for (let dy = 1; dy < b.h; dy++) {
        const y = top + dy;
        g.set(b.x, y, '|', C(0.22)); g.set(b.x + b.w - 1, y, '|', C(0.22));
        if (dy % 2 === 0) continue;
        for (let dx = 2; dx < b.w - 2; dx += 2) { const lit = b.win[dy * b.w + dx]; g.set(b.x + dx, y, lit ? '▪' : '.', lit ? H(42, 0.75) : C(0.15)); }
      }
      if (b.sign) {
        const sg = b.sign, fl = Noise.n3(t * 3, sg.ph, 0) > -0.35 || Math.sin(t * 0.7 + sg.ph) > 0.9, col = H(sg.hue, fl ? 0.85 : 0.3);
        if (sg.vert) for (let k = 0; k < sg.txt.length; k++) g.set(b.x + Math.floor(b.w / 2), top + sg.dy + k, sg.txt[k], col);
        else g.text(b.x + Math.max(1, Math.floor((b.w - sg.txt.length) / 2)), top - 1, sg.txt, col);
      }
    }
    if (Math.random() < dt * 2) { const b = pick(s.b); const k = rint(0, b.win.length - 1); b.win[k] = !b.win[k]; }
    for (let x = 0; x < cols; x++) g.set(x, ground, (x + ((t * 3) | 0)) % 7 === 0 ? '~' : '_', C(0.3));
    if (s.refl) {
      for (let y = ground + 1; y < rows; y++) {
        const k = y - ground, off = Math.round(Math.sin(y * 1.7 + t * 2.2) * 1.2);
        for (let x = 0; x < cols; x++) {
          const sy = ground - k * 2, src = sy >= 0 ? g.ch[sy * cols + x - off] : ' ';
          if (src && src !== ' ' && src !== '|' && src !== '_' && ((x + y) & 1) === 0) g.set(x, y, src === '.' ? '.' : (x + k) % 3 ? '~' : '-', H(src === '▪' ? 42 : 300, 0.12 + 0.28 / k));
          else if ((x * 7 + y * 13 + ((t * 4) | 0)) % 23 === 0) g.set(x, y, '-', C(0.12));
        }
      }
      for (const b of s.b) if (b.sign) { const sg = b.sign, fl = Noise.n3(t * 3, sg.ph, 0) > -0.35; if (fl) for (let y = ground + 1; y < rows; y++) g.set(b.x + Math.floor(b.w / 2) + Math.round(Math.sin(y * 2 + t * 3)), y, (y & 1) ? '|' : '!', H(sg.hue, 0.45 - (y - ground) * 0.04)); }
    }
    if (s.street) for (let x = 0; x < cols; x++) g.set(x, rows - 1, (x * 5 + ((t * 2) | 0)) % 13 === 0 ? '~' : '▔', C(0.22));
    const dch = wind > 0.15 ? '\\' : wind < -0.15 ? '/' : '|';
    for (const d of s.drops) {
      d.y += d.v * dt; d.x += wind * aspect * d.v * dt * 0.5;
      if (d.y >= floor) {
        if (Math.random() < 0.5 && s.spl.length < 400) for (let k = 0; k < 2; k++) s.spl.push({ x: d.x, y: floor - 1, vx: rnd(-6, 6), vy: rnd(-8, -3), l: rnd(0.2, 0.45) });
        d.y = rnd(-rows * 0.3, 0); d.x = rnd(-cols * 0.3, cols * 1.3);
      }
      if (p.drizzle) { g.set(d.x, d.y, (d.x | 0) % 3 ? '.' : ',', C(0.5)); continue; }
      g.set(d.x, d.y, dch, C(0.6)); g.set(d.x - wind * aspect * 0.5, d.y - 1, dch, C(0.32));
      if (p.soft) g.set(d.x - wind * aspect, d.y - 2, dch, C(0.2));
    }
    for (let k = s.spl.length - 1; k >= 0; k--) {
      const q = s.spl[k];
      q.l -= dt;
      if (q.l <= 0) { s.spl[k] = s.spl[s.spl.length - 1]; s.spl.pop(); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 30 * dt;
      g.set(q.x, Math.min(q.y, floor - 1), q.l > 0.25 ? "'" : '.', C(0.6));
    }
    // 行人最後畫：先把身形範圍清空，傘和身體才不會被雨絲或背景切碎
    for (let k = 0; k < s.walk.length; k++) {
      const w = s.walk[k];
      w.x += w.d * w.v * dt;
      if (w.x > cols + 8 || w.x < -9) { s.walk[k] = this.mkWalker(f, false); continue; }
      const fr = WALKER[((t * w.v * 0.8 + w.ph) | 0) & 1], y0 = rows - fr.length - 1;
      for (let r = 0; r < fr.length; r++) {
        const L = fr[r], a = L.length - L.trimStart().length, b = L.trimEnd().length;
        for (let q = a; q < b; q++) g.set(w.x + q, y0 + r, L[q], L[q] === ' ' ? C(0) : r < 2 ? H(w.hue, 0.75) : C(0.6));
      }
    }
    if (!p.bolt) return;
    s.next -= dt;
    if (s.next <= 0) {
      s.next = rnd(p.bmin, p.bmax); s.flash = p.soft ? 0.5 : 0.35;
      const path = (x, y, Y, out) => { for (; y < Y; y++) { const dx = rint(-1, 1); x += dx; out.push([x, y, dx]); } return out; };
      const pts = path(rnd(cols * 0.15, cols * 0.85), 0, rows * rnd(0.5, 0.8), []);
      if (p.soft) for (let k = 0; k < 2; k++) { const st = pick(pts); path(st[0], st[1], st[1] + rows * rnd(0.12, 0.3), pts); }
      s.bolt = pts;
    }
    if (s.flash > 0) {
      s.flash -= dt;
      if (p.soft) { if (s.flash > 0.2) f.bg = C(0.06 + 0.16 * ((s.flash - 0.2) / 0.3)); }
      else if (s.flash > 0.25 || (s.flash > 0.1 && s.flash < 0.17)) f.bg = C(0.22);
      if (s.bolt && s.flash > 0.12) for (const [x, y, dx] of s.bolt) g.set(x, y, dx < 0 ? '/' : dx > 0 ? '\\' : '|', C(1));
    }
  },
  winit(s, f) {
    const { cols, rows } = f;
    s.lights = Array.from({ length: clamp(Math.round(cols * rows / 380), 8, 90) }, () => ({ x: rnd(0, cols), y: rnd(rows * 0.1, rows), r: rnd(3, 8) * Math.max(1, rows / 40), hue: pick([40, 30, 50, 0, 200, 320, 120]), ph: rnd(0, TAU), v: rnd(-1, 1) }));
    s.wet = new Float32Array(cols * rows);
    s.beads = Array.from({ length: (cols * rows / 30) | 0 }, () => ({ x: rint(0, cols - 1), y: rint(0, rows - 1), s: rnd(0, 1) }));
    s.run = [];
  },
  wframe(s, f) {
    const { g, cols, rows, aspect, dt, t, C, H } = f, ch = g.ch, co = g.co, R = ' .·:oO';
    for (const L of s.lights) {
      L.x += L.v * dt * 0.6; if (L.x < -6) L.x = cols + 5; else if (L.x > cols + 6) L.x = -5;
      const r = L.r * (0.9 + 0.1 * Math.sin(t * 0.8 + L.ph)), b = 0.55 + 0.25 * Math.sin(t * 0.5 + L.ph);
      for (let y = Math.max(0, Math.floor(L.y - r / aspect)); y <= Math.min(rows - 1, L.y + r / aspect); y++) for (let x = Math.max(0, Math.floor(L.x - r)); x <= Math.min(cols - 1, L.x + r); x++) {
        const d = Math.hypot(x - L.x, (y - L.y) * aspect) / r;
        if (d > 1) continue;
        const e = (1 - d * d) * b, i = y * cols + x, k = Math.min(5, 1 + ((e * 5) | 0));
        if (ch[i] === ' ' || R.indexOf(ch[i]) < k) { ch[i] = d > 0.85 ? '·' : R[k]; co[i] = H(L.hue, 0.15 + e * 0.6); }
      }
    }
    const wet = s.wet, dk = Math.exp(-dt * 0.35);
    for (let i = 0; i < wet.length; i++) if (wet[i] > 0.02) { wet[i] *= dk; ch[i] = wet[i] > 0.5 ? '|' : wet[i] > 0.2 ? ':' : '.'; co[i] = C(0.25 + wet[i] * 0.5); }
    for (const b of s.beads) {
      b.s += dt * 0.04;
      if (b.s > 1.2 && Math.random() < dt * 0.5) { s.run.push({ x: b.x, y: b.y, v: rnd(4, 10), l: rnd(rows * 0.2, rows * 0.8) }); b.s = 0; b.x = rint(0, cols - 1); b.y = rint(0, rows - 1); }
      g.set(b.x, b.y, b.s < 0.4 ? '.' : b.s < 0.9 ? 'o' : 'O', C(0.45 + Math.min(1, b.s) * 0.45));
    }
    if (Math.random() < dt * 6) { const b = pick(s.beads); b.s = 0; b.x = rint(0, cols - 1); b.y = rint(0, rows - 1); }
    for (let k = s.run.length - 1; k >= 0; k--) {
      const r = s.run[k], y0 = r.y;
      r.y += r.v * dt * (0.6 + 0.4 * Math.sin(t * 5 + k)); r.l -= r.v * dt; r.x += (Math.random() < dt * 2 ? rint(-1, 1) : 0);
      for (let y = Math.floor(y0); y <= r.y; y++) if (y >= 0 && y < rows && r.x >= 0 && r.x < cols) wet[y * cols + (r.x | 0)] = 0.8;
      if (r.l <= 0 || r.y >= rows) { s.run[k] = s.run[s.run.length - 1]; s.run.pop(); continue; }
      g.set(r.x, r.y, 'O', C(0.95));
    }
  } });

const BIGFLAKE = [['  \\ | /  ', '-- \\|/ --', '  --*--  ', '-- /|\\ --', '  / | \\  '], ['    |    ', ' \\  |  / ', ' --(*)-- ', ' /  |  \\ ', '    |    ']];
const MIDFLAKE = [[' \\|/ ', ' -*- ', ' /|\\ '], ['  |  ', '-<*>-', '  |  ']];
A({ id: 'snow', name: '靜謐飄雪', cat: '自然', theme: 'ice', hue: true, desc: '雪花緩緩飄落，在地面慢慢堆積',
  params: { kind: 'snow', dens: 28, wind: 1.5, wf: 0.2, gust: 0, fall: 1, trees: 30, houses: false, big: 0, streak: false, maxG: 0.22 },
  variants: [
    { id: 'blizzard', name: '暴風雪', theme: 'mono', desc: '狂風捲著密集雪片橫掃而過', params: { dens: 8, wind: 5, wf: 0.35, gust: 4, fall: 1.7, streak: true, trees: 22, maxG: 0.3 } },
    { id: 'flakes', name: '大雪花', theme: 'lavender', desc: '一片片六角大雪花旋轉飄落', params: { big: 1, dens: 60, trees: 0, wind: 0.8 } },
    { id: 'village', name: '雪夜小鎮', theme: 'amber', desc: '屋頂積雪、窗透暖光、炊煙裊裊', params: { houses: true, trees: 0, dens: 30 } },
    { id: 'sakura', name: '櫻花飄落', theme: 'sakura', desc: '粉色花瓣隨風翻飛、鋪滿地面', params: { kind: 'petal', dens: 38, trees: 0, wind: 2.2, wf: 0.15, fall: 0.6, maxG: 0.12 } },
    { id: 'autumn', name: '秋日落葉', theme: 'sunset', desc: '紅黃落葉翻滾搖擺著落下', params: { kind: 'leaf', dens: 42, trees: 0, wind: 2.5, wf: 0.12, fall: 0.55, maxG: 0.14 } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.mk = top => { const L = Math.random(), l = L < 0.5 ? 0 : L < 0.85 ? 1 : 2; return { x: rnd(0, cols), y: top ? rnd(-rows * 0.2, 0) : rnd(0, rows), v: [2.2, 4, 6.5][l] * rnd(0.8, 1.2) * p.fall, ph: rnd(0, TAU), l, h: rnd(0, 55), sw: rnd(1.5, 3.5) }; };
    s.fl = Array.from({ length: clamp((cols * rows / p.dens) | 0, 40, 3500) }, () => s.mk(false));
    s.gr = new Float32Array(cols).fill(0.6);
    s.gh = Float32Array.from({ length: cols }, () => rnd(0, 50));
    s.trees = p.trees ? Array.from({ length: Math.max(1, (cols / p.trees) | 0) }, () => ({ x: rint(4, Math.max(5, cols - 5)), h: rint(Math.max(4, rows * 0.12) | 0, Math.max(5, rows * 0.3) | 0) })) : [];
    s.big = p.big ? Array.from({ length: clamp(Math.round(cols * rows / 650), 6, 60) }, (_, k) => ({ x: rnd(0, cols), y: rnd(-5, rows), v: rnd(1.2, 3), ph: rnd(0, TAU), big: k % 3 === 0 })) : [];
    s.houses = [];
    if (p.houses) {
      for (let x = rint(2, 8); x < cols - 12; ) {
        const w = rint(10, 18) + (rows > 50 ? rint(2, 8) : 0), h = rint(4, 6) + (rows > 50 ? rint(2, 5) : 0), rh = Math.ceil(w / 3.2);
        s.houses.push({ x, w, h, rh, win: Array.from({ length: 8 }, () => Math.random() < 0.7), ch: Math.random() < 0.7 });
        const gap = rint(6, 24);
        if (gap >= 11) s.trees.push({ x: x + w + Math.floor(gap / 2), h: rint(Math.max(4, rows * 0.1) | 0, Math.max(5, rows * 0.22) | 0) });
        x += w + gap;
      }
      s.smoke = [];
    }
    s.petalB = [];
    if (p.kind === 'petal') {
      for (const side of [0, 1]) for (let b = 0; b < 3; b++) {
        const len = cols * rnd(0.18, 0.32), y1 = rnd(0, rows * 0.28), x0 = side ? cols - 1 : 0, x1 = side ? cols - len : len;
        s.petalB.push({ x0, y0: rnd(-2, rows * 0.08), x1, y1, cl: Array.from({ length: Math.round(len / 3) }, () => ({ u: Math.random(), dx: rnd(-3, 3), dy: rnd(-1.5, 1.5), r: rnd(1, 2.6) })) });
      }
    }
  },
  frame(s, f) {
    const { g, cols, rows, aspect, dt, t, C, H, p } = f, gr = s.gr, maxG = Math.max(2, rows * p.maxG);
    const wind = Math.sin(t * p.wf) * p.wind + (p.gust ? Noise.n3(t * 0.4, 3.1, 0) * p.gust : 0);
    for (const b of s.petalB) {
      g.line(b.x0, b.y0, b.x1, b.y1, '~', C(0.25));
      for (const c of b.cl) {
        const cx = lerp(b.x0, b.x1, c.u) + c.dx, cy = lerp(b.y0, b.y1, c.u) + c.dy;
        for (let y = Math.floor(cy - c.r / aspect * 1.5); y <= cy + c.r / aspect * 1.5; y++) for (let x = Math.floor(cx - c.r * 1.6); x <= cx + c.r * 1.6; x++) {
          const d = Math.hypot((x - cx) / 1.6, (y - cy) * aspect / 1.5) / c.r;
          if (d < 1) g.set(x, y, d < 0.45 ? '@' : d < 0.8 ? '%' : '*', C(0.55 + (1 - d) * 0.35 + 0.05 * Math.sin(t + c.u * 9)));
        }
      }
    }
    for (const tr of s.trees) {
      const top = rows - 2 - tr.h;
      for (let k = 0; k < tr.h; k++) {
        const y = top + k, half = Math.floor(k * 0.75);
        g.set(tr.x - half - 1, y, '/', H(130, 0.38)); g.set(tr.x + half + 1, y, '\\', H(130, 0.38));
        for (let dx = -half; dx <= half; dx++) { const sn = (dx + k * 3) % 4 === 0; g.set(tr.x + dx, y, sn ? '*' : '^', sn ? C(0.85) : H(130, 0.32)); }
      }
      g.set(tr.x, top - 1, '★', H(50, 0.85));
      g.set(tr.x, rows - 2, '|', H(25, 0.35));
    }
    for (const hs of s.houses) this.house(s, f, hs, wind);
    if (s.smoke) {
      for (let k = s.smoke.length - 1; k >= 0; k--) {
        const q = s.smoke[k];
        q.L += dt; q.y -= dt * 2.2; q.x += (wind * 0.8 + Math.sin(t * 1.3 + q.ph)) * dt;
        if (q.L > q.l) { s.smoke[k] = s.smoke[s.smoke.length - 1]; s.smoke.pop(); continue; }
        const e = 1 - q.L / q.l;
        g.set(q.x, q.y, e > 0.7 ? 'o' : e > 0.35 ? '°' : '.', C(0.25 + e * 0.3));
      }
    }
    let sum = 0;
    const leaf = p.kind === 'leaf';
    for (let x = 0; x < cols; x++) {
      const hgt = gr[x], full = Math.floor(hgt), fr = hgt - full, col = leaf ? H(s.gh[x], 0.5) : C(0.8);
      sum += hgt;
      for (let k = 0; k < full; k++) g.set(x, rows - 1 - k, leaf && (x + k) % 3 === 0 ? '▓' : '█', leaf ? H(s.gh[(x + k * 7) % cols], 0.45) : col);
      if (fr > 0.5) g.set(x, rows - 1 - full, '▄', col); else if (fr > 0.15) g.set(x, rows - 1 - full, '_', col);
    }
    if (sum / cols > maxG * 0.7) for (let x = 0; x < cols; x++) gr[x] = Math.max(0.6, gr[x] - dt * 0.08);
    const CH = ['.', '+', '*'], BR = [0.4, 0.7, 1], kind = p.kind;
    for (const q of s.fl) {
      q.y += q.v * dt;
      let sx = 0;
      if (kind === 'snow') q.x += (Math.sin(t * 0.9 + q.ph) * 0.8 + wind) * dt * (q.l + 1) * 0.8;
      else { sx = Math.sin(t * (kind === 'leaf' ? 1.6 : 2.3) + q.ph) * q.sw; q.x += (wind * (q.l + 1) * 0.5 + Math.cos(t * 1.6 + q.ph) * 1.5) * dt; }
      if (q.x < 0) q.x += cols; else if (q.x >= cols) q.x -= cols;
      const cx = Math.min(cols - 1, (q.x + sx + cols) % cols | 0);
      if (q.y >= rows - 1 - gr[cx]) {
        if (q.l > 0) {
          gr[cx] = Math.min(maxG, gr[cx] + 0.25 * q.l);
          if (leaf) s.gh[cx] = q.h;
          for (const j of [cx - 1, cx + 1]) { const jj = (j + cols) % cols; if (gr[cx] - gr[jj] > 1.2) { gr[cx] -= 0.3; gr[jj] += 0.3; } }
        }
        Object.assign(q, s.mk(true));
        continue;
      }
      if (kind === 'snow') {
        g.set(q.x, q.y, CH[q.l], C(BR[q.l]));
        if (p.streak && Math.abs(wind) > 1.5 && q.l > 0) g.set(q.x - Math.sign(wind), q.y, '-', C(BR[q.l] * 0.45));
      } else if (kind === 'petal') {
        // 花瓣邊飄邊翻轉：近的大片用花形字，中層用小圓點，最遠的才是細點
        const r = (t * 2 + q.ph * 3) % 4 | 0;
        g.set(cx, q.y, q.l === 0 ? '.' : q.l === 1 ? ['°', 'o', '*', 'o'][r] : ['❀', '✿', '*', '✿'][r], H(335 + q.h * 0.27, 0.42 + q.l * 0.22));
      } else {
        const r = (t * 1.5 + q.ph * 3) % 4 | 0;
        g.set(cx, q.y, q.l === 0 ? ',' : ['&', '%', '@', '*'][r], H(q.h, 0.45 + q.l * 0.17));
      }
    }
    for (const b of s.big) {
      b.y += b.v * dt; b.x += (wind * 0.6 + Math.sin(t * 0.5 + b.ph) * 1.2) * dt;
      if (b.y > rows + 1) { b.y = -6; b.x = rnd(0, cols); }
      const fr = (((t * 0.7 + b.ph) | 0) & 1), spr = b.big ? BIGFLAKE[fr] : MIDFLAKE[fr];
      g.sprite(b.x - spr[0].length / 2, b.y, spr, C(b.big ? 0.95 : 0.7));
    }
  },
  house(s, f, hs, wind) {
    const { g, rows, dt, t, C, H } = f, gy = rows - 2, top = gy - hs.h + 1, cx = hs.x + hs.w / 2;
    for (let r = 0; r < hs.rh; r++) {
      const y = top - hs.rh + r, half = ((r + 1) / hs.rh) * (hs.w / 2 + 1);
      g.set(cx - half - 0.5, y, '/', C(0.85)); g.set(cx + half - 0.5, y, '\\', C(0.85));
      for (let x = Math.ceil(cx - half + 0.5); x < cx + half - 0.5; x++) g.set(x, y, r === 0 ? '▄' : r === 1 ? '▀' : (x + r) % 2 ? '=' : '-', r < 2 ? C(0.85) : C(0.3));
    }
    if (hs.ch) {
      const chx = Math.floor(cx + hs.w * 0.25), chy = top - hs.rh + Math.floor(hs.rh * 0.4);
      g.set(chx, chy - 1, '▄', C(0.85)); g.set(chx, chy, '█', C(0.3)); g.set(chx + 1, chy - 1, '▄', C(0.85)); g.set(chx + 1, chy, '█', C(0.3));
      if (Math.random() < dt * 5) s.smoke.push({ x: chx + 0.5, y: chy - 2, L: 0, l: rnd(2, 4), ph: rnd(0, TAU) });
    }
    for (let r = 0; r < hs.h; r++) {
      const y = top + r;
      g.set(hs.x, y, '|', C(0.4)); g.set(hs.x + hs.w - 1, y, '|', C(0.4));
      for (let x = hs.x + 1; x < hs.x + hs.w - 1; x++) g.set(x, y, ' ', C(0));
    }
    const dx = Math.floor(cx) - 1;
    for (let r = hs.h - Math.min(3, hs.h - 1); r < hs.h; r++) { g.set(dx, top + r, '█', H(25, 0.3)); g.set(dx + 1, top + r, '█', H(25, 0.3)); }
    let k = 0;
    for (let wx = hs.x + 2; wx < hs.x + hs.w - 4; wx += 5) {
      if (Math.abs(wx + 1 - dx) < 3) continue;
      const lit = hs.win[k++ % 8], fl = lit ? 0.75 + 0.1 * Math.sin(t * 3 + wx) : 0.2;
      for (let r = 1; r < Math.min(hs.h - 1, 3); r++) g.text(wx, top + r, '▪▪', lit ? H(42, fl) : C(0.2));
    }
    void wind;
  } });

A({ id: 'ocean', name: '月光海面', cat: '自然', theme: 'ocean', desc: '月光灑落在起伏的夜海上',
  params: { sky: 'moon', hz: 0.45, amp: 1, spd: 1, boat: false, mtn: false, shoot: false, stars: 90 },
  variants: [
    { id: 'sunset', name: '夕陽海面', theme: 'sunset', desc: '半沉入海的夕陽與金色光路', params: { sky: 'sun', stars: 0 } },
    { id: 'storm', name: '暴雨怒海', theme: 'mono', desc: '烏雲、斜雨與翻騰的白浪', params: { sky: 'storm', hz: 0.38, amp: 1.6, spd: 1.8, stars: 0 } },
    { id: 'lake', name: '寧靜湖面', theme: 'mint', desc: '群山倒映在幾乎無波的湖上', params: { mtn: true, amp: 0.55, spd: 0.5, hz: 0.55 } },
    { id: 'boat', name: '月下孤舟', theme: 'ice', hue: true, desc: '低垂明月前，掛著燈籠的帆船緩緩駛過', params: { boat: true, low: true } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.stars = p.stars ? Array.from({ length: (cols * rows / p.stars) | 0 }, () => ({ x: rint(0, cols - 1), y: rint(0, (rows * 0.42) | 0), p: rnd(0, TAU), c: pick(['.', '.', '·', '+', '*']) })) : [];
    s.mt = p.mtn ? Array.from({ length: cols }, (_, x) => rows * (0.08 + 0.2 * clamp(0.45 + Noise.fbm(x * 0.025, 7.7, 0, 4) * 1.4, 0, 1))) : null;
    s.rain = p.sky === 'storm' ? Array.from({ length: (cols * rows / 50) | 0 }, () => ({ x: rnd(0, cols), y: rnd(0, rows), v: rnd(35, 55) })) : null;
    s.flash = 0; s.next = rnd(4, 9); s.met = []; s.mnext = rnd(1, 3); s.bx = cols * 0.62;
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, C, p } = f, hz = Math.floor(rows * p.hz), sky = p.sky;
    const sun = sky === 'sun', storm = sky === 'storm';
    const mx = sun ? cols * 0.5 : p.mtn ? cols * 0.28 : p.low ? cols * 0.36 : cols * 0.72, mr = Math.max(3, Math.min(cols, rows * aspect) * (sun ? 0.15 : p.mtn ? 0.06 : sky === 'crescent' ? 0.11 : p.low ? 0.12 : 0.08));
    const my = sun ? hz - (mr * 0.35) / aspect : p.low ? hz - (mr * 1.1) / aspect : rows * (p.mtn ? 0.14 : 0.17);
    for (const st of s.stars) if (st.y < hz - 1) g.set(st.x, st.y, st.c, C(0.28 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.5 + st.p))));
    if (sun || storm) {
      let n = 0;
      for (let y = 0; y < hz; y++) for (let x = 0; x < cols; x++) {
        if (!(x & 1)) n = Noise.fbm(x * 0.022 + t * (storm ? 0.05 : 0.008), y * (storm ? 0.13 : 0.32), t * 0.02, 3);
        if (storm) { if (n > -0.08) g.set(x, y, n > 0.25 ? '▓' : n > 0.08 ? '▒' : '░', C(0.08 + (n + 0.1) * 0.35)); }
        else if (n > 0.12) g.set(x, y, n > 0.3 ? '=' : '-', C(0.25 + (y / hz) * 0.35 + n * 0.3));
        else if ((x * 7 + y * 31) % 53 === 0) g.set(x, y, '.', C(0.2 + (y / hz) * 0.2));
      }
    }
    if (s.mt) for (let x = 0; x < cols; x++) {
      const h = s.mt[x], d = (s.mt[x + 1] || h) - (s.mt[x - 1] || h);
      for (let k = 0; k < h; k++) g.set(x, hz - 1 - k, k >= h - 1 ? (d > 0.6 ? '/' : d < -0.6 ? '\\' : '^') : '█', k >= h - 1 ? C(0.3) : C(0.06));
    }
    if (!storm) {
      for (let y = Math.floor(my - mr / aspect) - 2; y <= my + mr / aspect + 2; y++) {
        if (y >= hz) break;
        for (let x = Math.floor(mx - mr * 1.3); x <= mx + mr * 1.3; x++) {
          const dx = (x + 0.5 - mx) / mr, dy = ((y + 0.5 - my) * aspect) / mr, d = dx * dx + dy * dy;
          if (d <= 1) {
            if (sky === 'crescent' && (dx + 0.38) ** 2 + (dy + 0.12) ** 2 < 0.72) { if (d < 0.97) g.set(x, y, '.', C(0.12)); continue; }
            if (s.mt && hz - 1 - (y | 0) < s.mt[x]) continue;
            if (sun) { const l = 1 - d * 0.35 + Noise.n3(dx * 3, dy * 3 + t * 0.3, 1) * 0.15; g.set(x, y, l > 0.85 ? '@' : l > 0.72 ? '#' : '%', C(clamp(l, 0.6, 1))); }
            else { const l = 0.78 + Noise.n3(dx * 2.5, dy * 2.5, 3.3) * 0.6 - d * 0.2; g.set(x, y, l > 0.85 ? '@' : l > 0.65 ? '#' : '%', C(clamp(l, 0.5, 1))); }
          } else if (d < (sun ? 2.2 : 1.7) && sky !== 'crescent') g.set(x, y, '.', C(sun ? 0.45 : 0.3));
        }
      }
    }
    const rh = rows - hz, amp = p.amp, ts = t * p.spd, bright = storm ? 0 : 1;
    for (let y = hz; y < rows; y++) {
      const pp = (y - hz + 1) / rh, sc = 0.12 + pp * 1.6, refl = mr * (sun ? 1.6 + pp * 4 : 1.2 + pp * 3);
      // 兩個正弦波沿 x 是等差相位：用旋轉遞推代替逐格呼叫 Math.sin（數值相同到小數點後十幾位）
      const u0 = (0 - cols / 2) / sc, da = 0.32 / sc, db = 0.71 / sc, ca = Math.cos(da), sa = Math.sin(da), cb = Math.cos(db), sb = Math.sin(db);
      let a0 = u0 * 0.32 + ts * 1.1 + pp * 30, b0 = u0 * 0.71 - ts * 0.8 + pp * 47, sA = Math.sin(a0), cA = Math.cos(a0), sB = Math.sin(b0), cB = Math.cos(b0);
      for (let x = 0; x < cols; x++) {
        const u = (x - cols / 2) / sc;
        const w = (sA + 0.6 * sB + 0.8 * Noise.n3(u * 0.15, pp * 8 - ts * 0.3, ts * 0.2)) * amp;
        const nA = sA * ca + cA * sa; cA = cA * ca - sA * sa; sA = nA;
        const nB = sB * cb + cB * sb; cB = cB * cb - sB * sb; sB = nB;
        let c = null, b = 0;
        if (storm && w > 2.1) { c = pp > 0.35 ? '^' : '*'; b = 0.7 + pp * 0.3; }
        else if (w > 1.25) { c = '~'; b = 0.55 + pp * 0.3; }
        else if (w > 0.6) { c = '~'; b = 0.32 + pp * 0.3; }
        else if (w > 0.1) { c = '-'; b = 0.2 + pp * 0.25; }
        else if (w > -0.4 && pp > 0.3) { c = '.'; b = 0.15 + pp * 0.15; }
        if (s.mt) {
          // 湖面倒影：山的剪影用暗暗的 ▒ 倒過來畫，被雜訊做出的水平漣漪切成一段一段
          const ry = y - hz, rx = Math.round(x + Math.sin(y * 1.3 + t * 1.2) * 0.8);
          if (ry < s.mt[clamp(rx, 0, cols - 1)] * 0.85) {
            const gap = Noise.n3(x * 0.035, y * 0.85, t * 0.25) > 0.12;
            if (gap) { c = w > 0.5 ? '-' : null; b = 0.14; } else { c = ry >= s.mt[clamp(rx, 0, cols - 1)] * 0.85 - 1 ? '~' : '▒'; b = 0.07; }
          }
        }
        if (bright && w > (s.mt ? -0.3 : 0.2) && Math.abs(x - mx) < refl * (0.6 + 0.4 * Math.sin(y * 1.7 + t * 2))) { c = w > 0.9 ? '=' : '-'; b = sun ? 1 : 0.95; }
        if (c) g.set(x, y, c, C(b));
      }
    }
    if (p.boat) this.boat(s, f, hz);
    if (s.rain) {
      for (const d of s.rain) {
        d.y += d.v * dt; d.x -= d.v * dt * 0.35 * aspect * 0.5;
        if (d.y > rows) { d.y = rnd(-5, 0); d.x = rnd(0, cols * 1.2); }
        g.set(d.x, d.y, '/', C(0.4));
      }
      s.next -= dt;
      if (s.next <= 0) { s.next = rnd(5, 11); s.flash = 0.45; s.bolt = []; let x = rnd(cols * 0.1, cols * 0.9); for (let y = 0; y < hz; y++) { const dx = rint(-1, 1); x += dx; s.bolt.push([x, y, dx]); } }
      if (s.flash > 0) {
        s.flash -= dt;
        if (s.flash > 0.15) f.bg = C(0.04 + 0.14 * ((s.flash - 0.15) / 0.3));
        if (s.flash > 0.2) for (const [x, y, dx] of s.bolt) g.set(x, y, dx < 0 ? '/' : dx > 0 ? '\\' : '|', C(1));
      }
    }
    if (p.shoot) {
      s.mnext -= dt;
      if (s.mnext <= 0) { s.mnext = rnd(1.5, 4.5); const d = Math.random() < 0.5 ? 1 : -1; s.met.push({ x: rnd(cols * 0.1, cols * 0.9), y: rnd(0, hz * 0.4), vx: d * rnd(cols * 0.35, cols * 0.6), vy: rnd(hz * 0.25, hz * 0.5), L: 0, l: rnd(0.6, 1.1) }); }
      for (let k = s.met.length - 1; k >= 0; k--) {
        const m = s.met[k];
        m.L += dt;
        if (m.L > m.l) { s.met.splice(k, 1); continue; }
        const x = m.x + m.vx * m.L, y = m.y + m.vy * m.L, e = 1 - m.L / m.l, n = 14;
        for (let q = n; q >= 0; q--) { const tt = Math.max(0, m.L - q * 0.018), ty = m.y + m.vy * tt; if (ty < hz - 1) g.set(m.x + m.vx * tt, ty, q === 0 ? '*' : q < 4 ? '-' : '.', C(e * (1 - q / (n + 1)))); }
        void x; void y;
      }
    }
  },
  // 前景的大帆船：慢慢往左駛過，船尾掛著燈籠（暖光暈與水面倒影），後方拖出 V 字形航跡
  boat(s, f, hz) {
    const { g, cols, rows, dt, t, C, H } = f, ch = g.ch;
    const W = clamp(Math.round(cols * 0.24), 22, 90), Hh = clamp(Math.round(rows * 0.07), 2, 6), wl = Math.round(rows * 0.88) - 1;
    const mastH = Math.max(6, Math.round((wl - hz) * 0.25 + rows * 0.3));
    s.bx -= dt * 0.9;
    if (s.bx < -W) s.bx = cols + W;
    const bx = s.bx, x0 = bx - W / 2, x1 = bx + W / 2, deck = wl - Hh, boom = deck - 1, top = deck - mastH, mxp = Math.round(bx - W * 0.08);
    // 航跡：從船尾往右後方分成兩道，一道往遠處（往上）一道往近處（往下）
    const Lw = Math.round(W * 0.7);
    for (let k = 1; k <= Lw; k++) {
      const e = 1 - k / (Lw + 1), c = ((k + Math.floor(t * 5)) % 3) ? '~' : '-';
      g.set(x1 + k * 1.6, wl - k * 0.12, c, C(0.15 + e * 0.5));
      g.set(x1 + k * 1.6, wl + 1 + k * 0.22, c, C(0.15 + e * 0.5));
    }
    // 燈籠光暈（只畫在空白處）
    const lx = Math.round(x1 - 3), ly = deck - 4, Rg = clamp(rows * 0.12, 3, 11);
    for (let y = Math.floor(ly - Rg / 2); y <= ly + Rg / 2; y++) for (let x = Math.floor(lx - Rg * 1.1); x <= lx + Rg * 1.1; x++) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const d = Math.hypot((x - lx) / 1.1, (y - ly) * 2.1) / Rg;
      if (d >= 1 || ch[y * cols + x] !== ' ' || hash2(x, y) > 0.55) continue;
      g.set(x, y, d < 0.5 ? ':' : '·', H(38, 0.12 + (1 - d) * 0.35 + 0.04 * Math.sin(t * 3)));
    }
    for (let y = wl + 1; y < rows; y++) g.set(lx + Math.round(Math.sin(y * 2.1 + t * 3) * 0.8), y, (y & 1) ? '|' : '!', H(38, 0.55 - (y - wl) * 0.03));
    // 主帆（桅桿右邊）與前帆（左邊）
    for (let y = top + 1; y <= boom; y++) {
      const u = (y - top) / (boom - top), wm = u * W * 0.4, wj = u * W * 0.24 * (y > top + mastH * 0.15 ? 1 : 0);
      for (let x = mxp + 1; x <= mxp + wm; x++) g.set(x, y, x >= mxp + wm - 1 ? '\\' : '▒', C(x >= mxp + wm - 1 ? 0.6 : 0.16 + 0.12 * u));
      for (let x = Math.ceil(mxp - wj); x < mxp; x++) g.set(x, y, x <= mxp - wj + 1 ? '/' : '░', C(x <= mxp - wj + 1 ? 0.55 : 0.14 + 0.1 * u));
    }
    for (let y = top; y <= boom; y++) g.set(mxp, y, '|', C(0.55));
    for (let x = mxp; x <= mxp + W * 0.4; x++) g.set(x, boom, '_', C(0.45));
    // 船身：深色剪影，船舷一道亮線
    for (let r = 0; r < Hh; r++) {
      const y = deck + r, a = Math.round(x0 + r * 1.5), b = Math.round(x1 - r * 0.8);
      for (let x = a; x <= b; x++) g.set(x, y, x === a ? '\\' : x === b ? '/' : r === 0 ? '▀' : '█', x === a || x === b ? C(0.45) : r === 0 ? C(0.4) : C(0.05));
    }
    // 燈籠
    for (let k = 1; k <= 3; k++) g.set(lx, deck - k, '|', C(0.4));
    g.set(lx, ly, '@', H(40, 0.95)); g.set(lx - 1, ly, '(', H(35, 0.6)); g.set(lx + 1, ly, ')', H(35, 0.6));
  } });

const DIMC = new Map();
function dimCol(c, k) {
  const key = c + k;
  let v = DIMC.get(key);
  if (v === undefined) { const n = parseInt(c.slice(1), 16); v = rgb(((n >> 16) & 255) * k, ((n >> 8) & 255) * k, (n & 255) * k); DIMC.set(key, v); }
  return v;
}
A({ id: 'aurora', name: '北極光', cat: '自然', theme: 'forest', hue: true, desc: '星空下緩緩舞動的極光與山稜',
  params: { mode: 'band', rays: 0, reflect: false, double: false, ground: 'mtn', by: 0.42, h0: 135, hs: 150 },
  variants: [
    { id: 'corona', name: '冕狀極光', theme: 'lavender', desc: '抬頭仰望，光芒從天頂放射而下', params: { mode: 'corona', ground: 'pines' } },
    { id: 'double', name: '雙層極光', theme: 'synth', desc: '綠色與紫紅色兩道光帶交錯', params: { double: true, by: 0.5 } },
    { id: 'pines', name: '針葉林', theme: 'ocean', desc: '松林剪影與小木屋上方的極光', params: { ground: 'pines', by: 0.45, h0: 150, hs: 120 } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f;
    s.st = Array.from({ length: (cols * rows / 60) | 0 }, () => [rint(0, cols - 1), rint(0, (rows * 0.75) | 0), rnd(0, TAU), Math.random()]);
    const mh = p.reflect ? [0.03, 0.1] : [0.1, 0.18];
    s.mt = Array.from({ length: cols }, (_, x) => rows * (mh[0] + mh[1] * clamp(0.5 + Noise.fbm(x * 0.03, 4.2, 0, 3) * 1.6, 0, 1)));
    if (p.ground === 'pines') {
      s.pines = [];
      for (let x = -2; x < cols + 2; x += rnd(2, 5)) s.pines.push({ x, h: rows * rnd(0.1, 0.24) * (0.6 + 0.4 * Math.abs(Noise.n3(x * 0.05, 1.3, 0)) * 2) });
      s.pines.sort((a, b) => b.h - a.h);
      s.cab = { x: Math.floor(cols * rnd(0.3, 0.7)), w: Math.max(8, Math.round(cols / 18)) };
    }
    if (p.mode === 'corona') {
      const n = cols * rows, cx = cols / 2, cy = -rows * 0.25;
      s.th = new Float32Array(n); s.r = new Float32Array(n);
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) { const dx = x - cx, dy = (y - cy) * aspect; s.th[i] = Math.atan2(dx, dy); s.r[i] = Math.hypot(dx, dy) / (rows * aspect); }
    }
  },
  band(f, z, by, h0, hs, rays, ymax) {
    const { g, cols, rows, t, H } = f, R = ' .:!|';
    for (let x = 0; x < cols; x++) {
      const I = Math.pow(clamp(0.6 + 1.1 * Noise.n3(x * 0.03 + t * 0.08, t * 0.1, 5 + z), 0, 1), 1.5);
      if (I < 0.02) continue;
      const base = rows * (by + 0.12 * Noise.n3(x * 0.012, t * 0.05, 1 + z)) + 4 * Math.sin(x * 0.04 + t * 0.3 + z);
      const len = rows * (0.26 + 0.24 * (0.5 + 0.5 * Noise.n3(x * 0.02, t * 0.07, 9 + z))) * (rays ? 1.25 : 1);
      const rf = rays ? 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Noise.n3(x * 0.45, t * 0.5, 2 + z), 2) : 1;
      for (let y = Math.max(0, Math.floor(base - len)); y <= base && y < ymax; y++) {
        const k = (base - y) / len;
        const e = I * rf * Math.pow(1 - k, 1.4) * (0.75 + 0.25 * Noise.n3(x * 0.4, y * 0.15, t * 0.8)) * (k < 0.06 ? 1.3 : 1);
        if (e < 0.04) continue;
        g.set(x, y, rays && e > 0.25 ? (e > 0.5 ? '|' : '!') : R[Math.min(4, (e * 5) | 0)], H(h0 + k * hs, Math.min(1, e * 1.2)));
      }
    }
  },
  frame(s, f) {
    const { g, cols, rows, t, C, H, p } = f;
    const wl = p.reflect ? Math.floor(rows * 0.64) : rows;
    for (const [x, y, ph, k] of s.st) if (y < wl) g.set(x, y, k > 0.9 ? '+' : '.', C(0.15 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.3 + ph))));
    if (p.mode === 'corona') this.corona(s, f);
    else {
      if (p.double) this.band(f, 31, p.by - 0.24, 290, 60, 0, wl);
      this.band(f, 0, p.by, p.h0, p.hs, p.rays, wl);
    }
    if (p.ground === 'pines') this.pines(s, f);
    else for (let x = 0; x < cols; x++) {
      const h = s.mt[x], d = (s.mt[x + 1] || h) - (s.mt[x - 1] || h);
      for (let k = 0; k < h; k++) g.set(x, wl - 1 - k, k >= h - 1 ? (d > 0.6 ? '/' : d < -0.6 ? '\\' : '^') : '█', k >= h - 1 ? C(0.22) : C(0.03));
    }
    if (p.reflect) {
      const ch = g.ch, co = g.co;
      for (let y = wl; y < rows; y++) {
        const k = y - wl, sy = wl - 1 - Math.floor(k * 1.15);
        if (sy < 0) break;
        const off = Math.round(Math.sin(y * 1.9 + t * 1.7) * (0.6 + k * 0.05));
        for (let x = 0; x < cols; x++) {
          const sx = clamp(x + off, 0, cols - 1), c = ch[sy * cols + sx];
          if (c === ' ') { if ((x * 13 + y * 7 + ((t * 2) | 0)) % 41 === 0) g.set(x, y, '-', C(0.12)); continue; }
          const i = y * cols + x;
          ch[i] = c === '█' ? '█' : c === '|' || c === '!' ? ((x + y) & 1 ? '|' : ':') : c === '^' || c === '/' || c === '\\' ? '~' : c;
          co[i] = dimCol(co[sy * cols + sx], c === '█' ? 1 : 0.5 - k * 0.012);
        }
      }
    }
  },
  corona(s, f) {
    const { g, rows, t, H } = f, n = g.n, ch = g.ch, co = g.co, th = s.th, rr = s.r;
    for (let i = 0; i < n; i++) {
      const r = rr[i];
      if (r > 1.15) continue;
      const a = th[i], ray = 0.5 + 0.5 * Noise.n3(a * 9, t * 0.25, 4 + r * 0.6), ray2 = 0.5 + 0.5 * Noise.n3(a * 3 + 7, t * 0.15, r * 1.5 - t * 0.2);
      const fall = r < 0.3 ? r / 0.3 : Math.max(0, 1 - (r - 0.3) / 0.85);
      const e = Math.pow(ray, 1.7) * (0.5 + 0.9 * ray2) * fall * 1.15;
      if (e < 0.08) continue;
      ch[i] = e > 0.55 ? (Math.abs(a) < 0.15 ? '|' : a > 0 ? '\\' : '/') : e > 0.3 ? ':' : '.';
      co[i] = H(120 + r * 200 + ray2 * 40, Math.min(1, 0.2 + e));
    }
    void rows;
  },
  pines(s, f) {
    const { g, cols, rows, t, C, H } = f, gy = rows - 1;
    for (let x = 0; x < cols; x++) { g.set(x, gy, '█', C(0.05)); g.set(x, gy - 1, '█', C(0.05)); }
    const cb = s.cab, cy = gy - 2, ch = Math.max(3, Math.round(cb.w * 0.4));
    for (const pn of s.pines) {
      const h = Math.round(pn.h), top = gy - h;
      for (let k = 0; k < h; k++) {
        const tierH = Math.max(2, Math.round(h / 4)), j = k % tierH, y = top + k, half = Math.round((k + 1) * 0.42 * (0.5 + 0.5 * (j + 1) / tierH));
        for (let dx = -half; dx <= half; dx++) g.set(pn.x + dx, y, dx === -half && half ? '/' : dx === half && half ? '\\' : '█', dx === -half || dx === half ? C(0.13) : C(0.04));
      }
      g.set(pn.x, top - 1, '^', C(0.15));
    }
    for (let r = 0; r < ch; r++) for (let q = 0; q < cb.w; q++) g.set(cb.x + q, cy - r, '█', C(0.08));
    for (let q = -1; q <= cb.w; q++) g.set(cb.x + q, cy - ch, '▄', C(0.55));
    const lit = 0.7 + 0.15 * Math.sin(t * 2.3) + 0.05 * Math.sin(t * 7.1);
    g.set(cb.x + 2, cy - 1, '▪', H(40, lit)); g.set(cb.x + 3, cy - 1, '▪', H(40, lit));
    g.set(cb.x + cb.w - 3, cy - 1, '▪', H(40, lit)); g.set(cb.x + cb.w - 4, cy - 1, '▪', H(40, lit));
  } });

// 煙火的爆炸形狀：回傳單位速度向量（x 已是視覺單位）
function burstShape(kind, j, n) {
  const a = (j / n) * TAU;
  if (kind === 'heart') { const x = 16 * Math.sin(a) ** 3, y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); return [x / 17, y / 17]; }
  if (kind === 'star') {
    const k = (j / n) * 10, i0 = Math.floor(k), fr = k - i0, r0 = i0 % 2 ? 0.42 : 1, r1 = i0 % 2 ? 1 : 0.42;
    const a0 = (i0 / 10) * TAU - Math.PI / 2, a1 = ((i0 + 1) / 10) * TAU - Math.PI / 2;
    return [lerp(Math.cos(a0) * r0, Math.cos(a1) * r1, fr), lerp(Math.sin(a0) * r0, Math.sin(a1) * r1, fr)];
  }
  if (kind === 'rings') { const r = j % 2 ? 1 : 0.55; return [Math.cos(a) * r, Math.sin(a) * r]; }
  if (kind === 'smile') {
    const m = j % 4;
    if (m === 0 || m === 1) return [Math.cos(a), Math.sin(a)];
    if (m === 2) { const b = Math.PI * (0.2 + 0.6 * ((j * 7) % n) / n); return [Math.cos(b) * 0.55, Math.sin(b) * 0.55]; }
    const e = (j >> 2) % 2 ? -1 : 1, b = ((j * 13) % n) / n * TAU; return [e * 0.35 + Math.cos(b) * 0.09, -0.3 + Math.sin(b) * 0.09];
  }
  return null;
}
A({ id: 'fireworks', name: '夜空煙火', cat: '場景', theme: 'fire', hue: true, desc: '一發發升空綻放的彩色煙火',
  // 基本款的參數和最早的版本相同（每 0.25–1.1 秒一發、45–110 顆火花）；sm 是小畫面時火花數量的倍率，
  // area 讓基本款在 2K/5K 全螢幕時火花數量跟著面積放大（最多兩倍），不然大螢幕上只剩零星幾點
  params: { rate: [0.25, 1.1], salvo: [1, 1], cnt: [45, 110], life: [1, 2], sp: [0.35, 0.6], sm: 1, area: true, trail: 0, grav: 0.3, shapes: false, city: false, crackle: false },
  variants: [
    { id: 'finale', name: '終場齊放', theme: 'rainbow', desc: '一次齊射多發，滿天同時綻放', params: { rate: [0.7, 1.4], salvo: [4, 7], cnt: [120, 200], life: [1.4, 2.5], sp: [0.38, 0.62], sm: 0.6, area: false } },
    { id: 'willow', name: '金色垂柳', theme: 'gold', hue: false, desc: '拖著長尾緩緩垂落的金色柳枝', params: { trail: 0.9, life: [2.6, 3.8], grav: 0.55, cnt: [70, 120], rate: [0.5, 1.2], sp: [0.3, 0.45], salvo: [1, 2], area: false } },
    { id: 'shapes', name: '造型煙火', theme: 'sakura', desc: '綻放成愛心、星星與笑臉的煙火', params: { shapes: true, rate: [0.3, 0.75], salvo: [1, 2], cnt: [170, 240], grav: 0.06, life: [2.4, 3.2], sp: [0.32, 0.45], area: false } },
    { id: 'city', name: '港灣夜景', theme: 'ocean', desc: '城市天際線上綻放，倒映在海面', params: { city: true, rate: [0.25, 0.7], salvo: [1, 2], cnt: [80, 140], life: [1.3, 2.3], sp: [0.38, 0.62], sm: 0.6, area: false } },
    { id: 'crackle', name: '閃爍菊花', theme: 'amber', desc: '火花在空中再次爆裂、劈啪閃爍', params: { crackle: true, cnt: [110, 170], rate: [0.25, 0.6], salvo: [1, 2], life: [1.4, 2.5], sp: [0.38, 0.62], sm: 0.6, area: false } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.r = []; s.p = []; s.next = 0;
    s.tr = p.trail ? new Float32Array(cols * rows) : null;
    s.th = p.trail ? new Float32Array(cols * rows) : null;
    s.wl = p.city ? Math.floor(rows * 0.86) : rows;
    if (p.city) {
      s.b = [];
      for (let x = 0; x < cols; ) { const w = rint(4, 12), h = rint(Math.max(2, rows * 0.06) | 0, Math.max(3, rows * 0.24) | 0); s.b.push({ x, w, h, win: Array.from({ length: w * h }, () => Math.random() < 0.25) }); x += w + rint(0, 2); }
    }
    for (let k = 0; k < 50; k++) this.update(s, f, 1 / 30);
  },
  launch(s, f) {
    const { cols, rows, p } = f, top = s.wl;
    for (let k = rint(p.salvo[0], p.salvo[1]); k > 0; k--) {
      s.r.push({ x: rnd(cols * 0.1, cols * 0.9), y: top - 1, vy: -top * (p.shapes ? rnd(0.62, 0.82) : rnd(0.7, 0.98)), hue: rnd(0, 360), type: rint(0, 3), sh: p.shapes ? pick(['heart', 'star', 'rings', 'smile', null]) : null });
    }
    void rows;
  },
  update(s, f, dt) {
    const { cols, rows, aspect, p } = f, top = s.wl, grav = top * 0.55;
    s.next -= dt;
    if (s.next <= 0) { s.next = rnd(p.rate[0], p.rate[1]); this.launch(s, f); }
    for (let k = s.r.length - 1; k >= 0; k--) {
      const r = s.r[k];
      r.y += r.vy * dt; r.vy += grav * dt;
      if (r.vy >= -top * 0.08) {
        s.r.splice(k, 1);
        const cnt = rint(p.cnt[0], p.cnt[1]) * (cols * rows > 12000 ? (p.area ? Math.min(2, (cols * rows) / 12000) : 1) : p.sm), sp = top * rnd(p.sp[0], p.sp[1]);
        for (let j = 0; j < cnt; j++) {
          let vx, vy;
          const shp = r.sh ? burstShape(r.sh, j, cnt) : null;
          if (shp) { vx = shp[0] * sp * 0.8; vy = shp[1] * sp * 0.8; }
          else { const a = rnd(0, TAU), v = r.type === 1 ? sp : sp * Math.sqrt(Math.random()); vx = Math.cos(a) * v; vy = Math.sin(a) * v; }
          s.p.push({ x: r.x, y: r.y, vx: vx * aspect, vy, l: rnd(p.life[0], p.life[1]) * (shp ? 0.8 : 1), L: 0, hue: r.type === 2 && j % 2 ? r.hue + 150 : r.hue + rnd(-20, 20), w: r.type === 3 || !!shp, cr: p.crackle && Math.random() < 0.5, sub: false });
        }
      }
    }
    for (let k = s.p.length - 1; k >= 0; k--) {
      const q = s.p[k];
      q.L += dt;
      if (q.L >= q.l || q.y >= top) {
        if (q.cr && !q.sub && q.y < top) for (let m = 0; m < 3; m++) s.p.push({ x: q.x, y: q.y, vx: rnd(-8, 8) * aspect, vy: rnd(-8, 8), l: rnd(0.25, 0.6), L: 0, hue: 50, w: false, cr: false, sub: true });
        s.p[k] = s.p[s.p.length - 1]; s.p.pop(); continue;
      }
      const drag = Math.exp(-dt * (q.w ? 2.5 : 1.6));
      q.vx *= drag; q.vy *= drag; q.vy += grav * p.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    }
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, C, H, p } = f, top = s.wl;
    this.update(s, f, dt);
    if (s.tr) {
      const tr = s.tr, th = s.th, dk = Math.exp(-dt / p.trail * 2.2), R = ' .,:;+*';
      for (const q of s.p) { const x = q.x | 0, y = q.y | 0; if (x >= 0 && y >= 0 && x < cols && y < rows) { const i = y * cols + x; tr[i] = Math.min(1, tr[i] + 0.35 * (1 - q.L / q.l)); th[i] = q.hue; } }
      for (let i = 0; i < tr.length; i++) { const v = tr[i]; if (v < 0.04) continue; tr[i] = v * dk; g.ch[i] = R[Math.min(6, (v * 7) | 0)]; g.co[i] = H(th[i], 0.15 + v * 0.75); }
    }
    for (const r of s.r) { g.set(r.x, r.y, '|', C(0.9)); g.set(r.x, r.y + 1, '.', C(0.5)); g.set(r.x + rnd(-0.6, 0.6), r.y + 2, "'", C(0.3)); }
    for (const q of s.p) {
      const e = 1 - q.L / q.l;
      if (q.sub) { g.set(q.x, q.y, ((t * 20 + q.x) | 0) & 1 ? '*' : '+', H(55, 0.6 + e * 0.4)); continue; }
      if (e < 0.3 && Math.random() < 0.3) continue;
      const crk = q.cr && e < 0.55;
      g.set(q.x, q.y, crk ? (((t * 14 + q.y * 3) | 0) & 1 ? '+' : '·') : e > 0.7 ? '*' : e > 0.4 ? '+' : e > 0.2 ? '·' : '.', H(crk ? 50 : q.hue, 0.25 + e * 0.75));
    }
    if (p.city) {
      for (const b of s.b) {
        const y0 = top - b.h;
        for (let y = y0; y < top; y++) for (let x = b.x; x < b.x + b.w; x++) { const lit = b.win[(y - y0) * b.w + x - b.x] && (y - y0) % 2 === 1 && (x - b.x) % 2 === 1; g.set(x, y, lit ? '▪' : '█', lit ? H(45, 0.6) : C(0.04)); }
      }
    }
    if (p.city) {
      const ch = g.ch, co = g.co;
      for (let y = top; y < rows; y++) {
        const k = y - top + 1, sy = top - k * 2;
        for (let x = 0; x < cols; x++) {
          const sx = clamp(x + Math.round(Math.sin(y * 1.7 + t * 2) * 1.5), 0, cols - 1), si = sy * cols + sx;
          if (sy >= 0 && ch[si] !== ' ' && ch[si] !== '█') { g.set(x, y, ch[si] === '▪' ? '-' : (x + y) & 1 ? '~' : ch[si], dimCol(co[si], 0.45)); }
          else if ((x * 3 + y * 11 + ((t * 3) | 0)) % 29 === 0) g.set(x, y, '~', C(0.12));
        }
      }
    }
  } });

A({ id: 'synthwave', name: '合成波夕陽', cat: '科技', theme: 'synth', hue: true, desc: '80 年代復古未來感的霓虹地平線',
  params: { sun: 'sun', ground: 'grid', road: false, palms: false, city: false, spd: 6 },
  variants: [
    { id: 'road', name: '夜間公路', theme: 'sunset', desc: '筆直公路伸向夕陽，標線飛快後退', params: { road: true, spd: 10 } },
    { id: 'palms', name: '棕櫚海岸', theme: 'neon', desc: '隨風搖曳的棕櫚樹剪影夾道', params: { palms: true } },
    { id: 'terrain', name: '線框山谷', desc: '起伏的線框山谷向前捲動', params: { ground: 'terrain' } },
    { id: 'city', name: '霓虹都市', theme: 'cyber', desc: '霓虹燈閃爍的城市天際線', params: { city: true } },
    { id: 'eclipse', name: '日蝕', theme: 'lavender', desc: '黑色日輪周圍燃燒著光環', params: { sun: 'eclipse' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.st = Array.from({ length: (f.cols * f.rows / 80) | 0 }, () => [rint(0, f.cols - 1), rint(0, (f.rows * 0.55) | 0), rnd(0, TAU)]);
    s.mt = Array.from({ length: f.cols }, (_, x) => Math.max(0, Noise.fbm(x * 0.045, 2.2, 0, 3) * 1.3 + 0.2));
    if (p.city) {
      s.bl = [];
      for (let x = 0; x < cols; ) { const w = rint(3, 9), d = Math.abs(x + w / 2 - cols / 2) / (cols / 2); s.bl.push({ x, w, h: Math.round(rows * rnd(0.06, 0.3) * (0.35 + d)), seed: rnd(0, 99), hue: pick([190, 320, 280, 50]) }); x += w + rint(0, 1); }
    }
    s.ymin = new Int32Array(cols);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H, p } = f, hz = Math.floor(rows * 0.58), cx = cols / 2;
    for (const [x, y, ph] of s.st) if (y < hz - 1) g.set(x, y, '.', C(0.25 + 0.2 * Math.sin(t * 2 + ph)));
    const R = Math.min(cols, rows * aspect) * 0.24, Ry = R / aspect, scy = hz - Ry * 0.45;
    if (p.sun === 'eclipse') {
      for (let y = Math.max(0, Math.floor(scy - Ry * 1.5)); y < hz; y++) for (let x = Math.floor(cx - R * 1.5); x <= cx + R * 1.5; x++) {
        const dx = x + 0.5 - cx, dy = (y + 0.5 - scy) * aspect, d = Math.hypot(dx, dy) / R;
        if (d < 1) { g.set(x, y, '█', C(0.02)); continue; }
        const a = Math.atan2(dy, dx), fl = 0.5 + 0.5 * Noise.n3(a * 4, t * 0.6, d * 2), e = Math.max(0, 1 - (d - 1) / (0.12 + 0.4 * fl));
        if (e > 0.05) g.set(x, y, e > 0.75 ? '@' : e > 0.5 ? '*' : e > 0.25 ? '+' : '.', H(30 + (1 - e) * 290, 0.3 + e * 0.7));
      }
    } else {
      for (let y = Math.max(0, Math.floor(scy - Ry)); y < hz; y++) {
        const v = (y - (scy - Ry)) / (2 * Ry);
        if (v > 0.3 && fract((y - scy) * 0.3 - t * 0.5) < (v - 0.3) * 1.5) continue;
        const half = Math.sqrt(Math.max(0, R * R - ((y + 0.5 - scy) * aspect) ** 2));
        if (half < 1) continue;
        for (let x = Math.ceil(cx - half); x <= cx + half; x++) g.set(x, y, '█', H(52 - v * 75, 0.85 - v * 0.25));
      }
    }
    if (p.city) {
      for (const b of s.bl) for (let k = 0; k < b.h; k++) for (let q = 0; q < b.w; q++) {
        const y = hz - 1 - k, x = b.x + q, win = q > 0 && q < b.w - 1 && k % 2 === 1 && k < b.h - 1, on = win && hash2(x, y + b.seed) > 0.55;
        const tw = on && hash2(x * 3, y) > 0.9 ? 0.5 + 0.5 * Math.sin(t * 3 + x) : 1;
        g.set(x, y, k === b.h - 1 ? '▄' : on ? '▪' : '█', k === b.h - 1 ? H(b.hue, 0.5) : on ? H(b.hue + 40 * hash2(y, x), 0.55 * tw + 0.2) : C(0.05));
      }
    } else for (let x = 0; x < cols; x++) {
      const h = Math.round(s.mt[x] * rows * 0.14 * (0.4 + Math.abs(x - cx) / cx));
      for (let k = 0; k < h; k++) g.set(x, hz - 1 - k, k === h - 1 ? '^' : '█', k === h - 1 ? H(285, 0.55) : C(0.04));
    }
    if (p.ground === 'terrain') this.terrain(s, f, hz);
    else {
      const span = rows - hz, F = rows * 8, sp = t * p.spd, Sb = cols * 0.08, road = p.road;
      for (let y = hz; y < rows; y++) {
        const dy = y - hz + 1, I = dy / span;
        const hl = Math.floor((F / (dy - 0.5) + sp) / 3) !== Math.floor((F / (dy + 0.5) + sp) / 3);
        const spc = (Sb * dy) / span, rw = road ? (cols * 0.16 * dy) / span + 1 : 0;
        const dash = road && Math.floor((F / dy + sp) / 4) % 2 === 0;
        for (let x = 0; x < cols; x++) {
          const ax = Math.abs(x + 0.5 - cx);
          if (road && ax < rw + 0.5) {
            if (ax > rw - 0.5) g.set(x, y, x < cx ? '/' : '\\', H(50, 0.4 + I * 0.6));
            else if (dash && ax < Math.max(0.5, rw * 0.04)) g.set(x, y, '█', H(50, 0.35 + I * 0.6));
            else if ((x + y * 3) % 11 === 0) g.set(x, y, '.', C(0.12));
            continue;
          }
          const k = Math.round((x + 0.5 - cx) / spc), vl = Math.abs(x + 0.5 - cx - k * spc) < 0.5;
          let c = null;
          if (vl) { const sl = (k * Sb) / span; c = Math.abs(sl) < 0.6 ? '|' : Math.abs(sl) < 2.2 ? (sl > 0 ? '\\' : '/') : '-'; }
          if (hl) c = vl ? '+' : '-';
          if (c) g.set(x, y, c, H(hl ? 315 : 295, 0.15 + I * 0.75));
        }
      }
    }
    if (p.palms) for (const side of [-1, 1]) for (let k = 0; k < 2; k++) this.palm(f, cx + side * cols * (0.36 + k * 0.1), rows - 1 - k * 2, rows * (0.62 - k * 0.12), side, k);
  },
  palm(f, bx, by, h, side, k) {
    const { g, aspect, t, H } = f, sw = Math.sin(t * 0.8 + k * 1.3) * 0.6, col = H(300, 0.38 - k * 0.08), col2 = H(320, 0.5 - k * 0.1);
    let px = bx, py = by;
    for (let i = 0; i < h; i++) {
      const u = i / h, x = bx - side * Math.pow(u, 1.8) * h * 0.45 * aspect * 0.5 + sw * u * u * 2, y = by - i;
      g.set(x, y, '(', col); g.set(x + 1, y, ')', col);
      px = x + 0.5; py = y;
    }
    for (let fr = 0; fr < 8; fr++) {
      const a = 0.12 + (fr / 7) * (Math.PI - 0.24), L = h * 0.5 * aspect * (0.75 + 0.25 * Math.sin(fr * 2.3)), ca = Math.cos(a), sa = Math.sin(a), dr = 0.95;
      for (let r = 0.04; r <= 1; r += 0.5 / L) {
        const X = ca * r * L + sw * r * 2, Y = -sa * r * L * 0.75 + dr * r * r * L;
        const dX = ca, dY = -sa * 0.75 + 2 * dr * r, th = Math.atan2(dY, dX * aspect * 0.5);
        const at = Math.abs(th), c = at < 0.4 || at > Math.PI - 0.4 ? (r > 0.7 ? '~' : '-') : Math.abs(at - Math.PI / 2) < 0.35 ? '|' : (th < 0) === (dX > 0) ? '/' : '\\';
        g.set(px + X, py + Y / aspect, c, col2);
      }
    }
  },
  // 線框山谷：一條條橫切的地形剖面由近而遠畫，每條剖面相鄰兩欄用 _ / \ 接起來，
  // 已經被較近剖面擋住的地方不畫（隱藏線）；地形高度壓在鏡頭高度以下，永遠不會越過地平線蓋到夕陽
  terrain(s, f, hz) {
    const { g, cols, rows, aspect, t, H, p } = f, cx = cols / 2, F = rows * 1.1, camH = 2.2, hmax = camH * 0.93;
    const zs = t * p.spd * 0.6, ymin = s.ymin, gap = 1.6, dz = 1.2, zfar = 46;
    if (!s.tc || s.tc.length !== cols) { s.tc = new Float32Array(cols); s.tl = new Int32Array(cols); }
    const cur = s.tc, top = s.tl;
    ymin.fill(rows);
    const hgt = (X, Z) => {
      const a = Math.min(7, Math.max(0, Math.abs(X) - 2.2));
      if (a <= 0) return 0;
      const raw = Math.pow(a, 1.2) * 0.42 * (0.5 + 0.5 * Noise.n3(X * 0.22, Z * 0.18, 0.5)) + Math.max(0, Noise.n3(X * 0.6, Z * 0.5, 3)) * a * 0.12;
      return hmax * (1 - Math.exp(-raw / hmax));
    };
    const sy = (X, Z, z) => hz + ((camH - hgt(X, Z)) * F) / z;
    const line = (x0, y0, x1, y1, col) => {
      const dx = x1 - x0, dy = y1 - y0, c = slopeCh(dx, dy * aspect), n = Math.min(400, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 1.2) + 1);
      for (let k = 0; k <= n; k++) {
        const x = Math.floor(x0 + (dx * k) / n), y = Math.floor(y0 + (dy * k) / n);
        if (x < 0 || x >= cols || y < hz || y >= rows || y >= ymin[x]) continue;
        g.set(x, y, c, col);
      }
    };
    let pz = 0, pZ = 0, have = false;
    for (let nIdx = Math.floor(zs / dz) - 1; ; nIdx++) {
      const z = 0.9 + nIdx * dz - zs;
      if (z <= 0.5) continue;
      if (z > zfar) break;
      // 遠處剖面在螢幕上會擠在一起：依距離只畫每 2、4、8… 條其中一條
      const spc = (camH * F * dz) / (z * z);
      let step = 1;
      while (spc * step < 0.9 && step < 64) step *= 2;
      if (((nIdx % step) + step) % step) continue;
      const Z = z + zs, I = clamp(1 - z / zfar, 0, 1);
      for (let x = 0; x < cols; x++) cur[x] = sy(((x + 0.5 - cx) / (cols * 0.5)) * z * 1.7, Z, z);
      if (have) {
        const col = H(290, 0.12 + I * 0.7), pxs = (gap / (z * 1.7)) * cols * 0.5;
        let sj = 1;
        while (pxs * sj < 3 && sj < 64) sj *= 2;
        const J = Math.floor(Math.ceil((z * 1.7 * 1.05) / gap) / sj) * sj;
        for (let j = -J; j <= J; j += sj) {
          const X = j * gap, x0 = cx + (X / (pz * 1.7)) * cols * 0.5 - 0.5, x1 = cx + (X / (z * 1.7)) * cols * 0.5 - 0.5;
          if ((x0 < 0 && x1 < 0) || (x0 >= cols && x1 >= cols)) continue;
          line(x0, sy(X, pZ, pz), x1, sy(X, Z, z), col);
        }
      }
      const col = H(310 - I * 40, 0.15 + I * 0.8);
      for (let x = 0; x < cols; x++) {
        const yb = Math.floor(cur[x]), ya = x > 0 ? Math.floor(cur[x - 1]) : yb;
        let lo, hi, c;
        if (yb === ya) { lo = hi = yb; c = '_'; } else if (yb < ya) { lo = yb + 1; hi = ya; c = '/'; } else { lo = ya + 1; hi = yb; c = '\\'; }
        top[x] = lo;
        const y0 = Math.max(lo, hz), y1 = Math.min(hi, rows - 1, ymin[x] - 1);
        for (let y = y0; y <= y1; y++) g.set(x, y, c, col);
      }
      for (let x = 0; x < cols; x++) if (top[x] < ymin[x]) ymin[x] = Math.max(hz, top[x]);
      pz = z; pZ = Z; have = true;
    }
  } });

A({ id: 'galaxy', name: '螺旋星系', cat: '太空', theme: 'ice', hue: true, desc: '差速旋轉中的雙臂螺旋星系',
  params: { arms: 2, wind: 2.2, spread: 0.35, tilt: 0.5, core: 0.18, bar: 0, kind: 'spiral', two: false, dust: false, h0: 45, h1: 215, size: 1 },
  variants: [
    { id: 'barred', name: '棒旋星系', theme: 'gold', desc: '中央一道亮棒，旋臂從兩端甩出', params: { bar: 0.32, wind: 1.6, spread: 0.3, core: 0.1, h0: 40, h1: 200 } },
    { id: 'edge', name: '側看星系', theme: 'sunset', desc: '幾乎側面看去的盤面與暗塵帶', params: { tilt: 0.13, dust: true, core: 0.24, size: 1.2, h0: 35, h1: 200 } },
    { id: 'collide', name: '星系碰撞', theme: 'neon', desc: '兩個星系互相繞轉、拉扯', params: { two: true, size: 0.62 } },
    { id: 'elliptical', name: '橢圓星系', theme: 'amber', desc: '圓潤飽滿、點綴星團的橢圓星系', params: { kind: 'ellip', tilt: 0.62, h0: 25, h1: 55 } },
    { id: 'three', name: '三臂星系', theme: 'mint', desc: '正面俯視、三條旋臂的星系', params: { arms: 3, wind: 2.7, tilt: 0.95, spread: 0.3, h0: 60, h1: 170 } },
  ],
  init(s, f) {
    const p = f.p, N = clamp((f.cols * f.rows / 5) | 0, 800, 6000);
    s.s = new Float32Array(N * 4); s.n = N;
    for (let i = 0; i < N; i++) {
      let r, th, rigid = 0;
      if (p.kind === 'ellip') {
        const cl = Math.random() < 0.08;
        if (cl) { const k = i % 7, cr = 0.25 + (k * 0.11) % 0.6, ca = k * 2.4; r = cr + gauss() * 0.02; th = ca + gauss() * 0.06; }
        else { r = Math.min(1.05, Math.abs(gauss()) * 0.38); th = rnd(0, TAU); }
      } else {
        const core = Math.random() < p.core;
        if (core) { r = Math.min(1, Math.abs(gauss()) * 0.12); th = rnd(0, TAU); }
        else if (p.bar && Math.random() < 0.22) { r = rnd(0, p.bar); th = (i % 2) * Math.PI + gauss() * 0.06 / (r + 0.1); rigid = 1; }
        else { r = Math.pow(Math.random(), 0.75) * 0.95 + 0.05; if (p.bar) r = p.bar + r * (1 - p.bar); th = ((i % p.arms) * TAU) / p.arms + p.wind * Math.log(r * 20) + gauss() * p.spread; }
      }
      s.s[i * 4] = r; s.s[i * 4 + 1] = th; s.s[i * 4 + 2] = rnd(0.3, 1); s.s[i * 4 + 3] = rigid;
    }
    s.d = new Float32Array(f.cols * f.rows);
    s.bg = Array.from({ length: (f.cols * f.rows / 90) | 0 }, () => [rint(0, f.cols - 1), rint(0, f.rows - 1)]);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H, p } = f, d = s.d;
    d.fill(0);
    for (const [x, y] of s.bg) g.set(x, y, '.', C(0.18));
    const Rx0 = Math.min(cols, rows * aspect * 1.6) * 0.48 * p.size, tilt = p.tilt;
    const gals = p.two
      ? [0, 1].map(k => { const a = t * 0.12 + k * Math.PI, sep = 0.55 + 0.12 * Math.sin(t * 0.21); return { cx: cols / 2 + Math.cos(a) * Rx0 * sep * 1.25, cy: rows / 2 + (Math.sin(a) * Rx0 * sep * 0.45) / aspect, rot: k ? -0.9 : 0.35, tilt: k ? 0.7 : 0.45, dir: k ? -1 : 1 }; })
      : [{ cx: cols / 2, cy: rows / 2, rot: 0.35, tilt, dir: 1 }];
    const half = (s.n / gals.length) | 0, ell = p.kind === 'ellip';
    for (let gi = 0; gi < gals.length; gi++) {
      const G = gals[gi], cr = Math.cos(G.rot), sr = Math.sin(G.rot), i0 = gi * half, i1 = gals.length > 1 ? i0 + half : s.n;
      for (let i = i0; i < i1; i++) {
        const r = s.s[i * 4], rigid = s.s[i * 4 + 3];
        const th = s.s[i * 4 + 1] - (G.dir * t * (ell ? 0.06 : 0.3)) / ((rigid ? p.bar : r) + 0.2);
        const x = r * Math.cos(th), y = r * Math.sin(th) * G.tilt;
        const px = G.cx + (x * cr - y * sr) * Rx0, py = G.cy + ((x * sr + y * cr) * Rx0) / aspect;
        if (px < 0 || py < 0 || px >= cols || py >= rows) continue;
        d[(py | 0) * cols + (px | 0)] += s.s[i * 4 + 2];
      }
    }
    if (p.dust) {
      const cr = Math.cos(0.35), sr = Math.sin(0.35), cx = cols / 2, cy = rows / 2;
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        if (d[i] <= 0) continue;
        const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * aspect, along = dx * cr + dy * sr, perp = -dx * sr + dy * cr;
        const lane = Math.abs(perp + Rx0 * 0.012) < Rx0 * 0.02 * (1 - Math.abs(along) / Rx0) && Math.abs(along) < Rx0 * 0.85;
        if (lane) d[i] *= 0.12;
      }
    }
    const RR = ' .·:+*#%@';
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const v = d[i];
      if (v <= 0) continue;
      let dist = 2;
      for (const G of gals) dist = Math.min(dist, Math.hypot((x - G.cx) / Rx0, ((y - G.cy) * aspect) / Rx0));
      const e = 1 - Math.exp(-v * 0.7);
      g.ch[i] = RR[Math.min(8, 1 + ((e * 8) | 0))]; g.co[i] = H(lerp(p.h0, p.h1, clamp(dist * 2.5, 0, 1)), 0.25 + e * 0.75);
    }
  } });

A({ id: 'globe', name: '旋轉地球', cat: '太空', theme: 'ocean', hue: true, desc: '程序生成大陸、自轉中的星球',
  params: { kind: 'earth', spin: 0.22 },
  variants: [
    { id: 'moon', name: '坑洞月球', theme: 'mono', hue: false, desc: '布滿隕石坑、緩緩自轉的月球', params: { kind: 'moon', spin: 0.12 } },
    { id: 'ringed', name: '光環行星', theme: 'gold', hue: false, desc: '條紋雲帶與傾斜光環的巨大行星', params: { kind: 'ringed', spin: 0.3 } },
    { id: 'night', name: '晝夜交界', theme: 'cyber', desc: '晨昏線掃過，夜側城市燈火點點', params: { kind: 'night', spin: 0.15 } },
    { id: 'wire', name: '經緯網格', theme: 'blueprint', hue: false, desc: '經緯線構成的透明旋轉球體', params: { kind: 'wire', spin: 0.35 } },
    { id: 'lava', name: '熔岩星球', theme: 'fire', hue: false, desc: '黑色地殼裂縫中透出熔岩紅光', params: { kind: 'lava', spin: 0.18 } },
  ],
  init(s, f) {
    s.st = Array.from({ length: (f.cols * f.rows / 70) | 0 }, () => [rint(0, f.cols - 1), rint(0, f.rows - 1), rnd(0, TAU)]);
    if (f.p.kind === 'moon') s.cr = Array.from({ length: 46 }, () => { const z = rnd(-1, 1), a = rnd(0, TAU), q = Math.sqrt(1 - z * z); return [q * Math.cos(a), z, q * Math.sin(a), Math.cos(Math.pow(Math.random(), 2.2) * 0.32 + 0.03)]; });
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H, p } = f, kind = p.kind;
    for (const [x, y, ph] of s.st) g.set(x, y, '.', C(0.2 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2 + ph))));
    const ringed = kind === 'ringed';
    const R = Math.min(cols * (ringed ? 0.21 : 1), rows * aspect) * (ringed ? 1 : 0.4) * (ringed ? 1 : 1), cx = cols / 2, cy = rows / 2, rot = t * p.spin, cr = Math.cos(rot), sr = Math.sin(rot);
    const ct = Math.cos(0.4), stl = Math.sin(0.4), LAND = '.:-=+*#%@', SEA = ' .~-=', RAMP = ' .:-=+*#%@';
    const y0 = Math.max(0, Math.floor(cy - R / aspect - 2)), y1 = Math.min(rows - 1, Math.ceil(cy + R / aspect + 2));
    const x0 = Math.max(0, Math.floor(cx - R - 2)), x1 = Math.min(cols - 1, Math.ceil(cx + R + 2));
    let Lx = -0.55, Ly = -0.35, Lz = 0.76;
    if (kind === 'night') { const a = t * 0.1; Lx = Math.sin(a) * 0.95; Ly = -0.2; Lz = Math.cos(a) * 0.95; }
    if (ringed) this.ring(f, cx, cy, R, 0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / R, dy = ((y + 0.5 - cy) * aspect) / R, d2 = dx * dx + dy * dy;
      if (d2 > 1) { if (d2 < 1.12 && kind !== 'wire') g.set(x, y, '.', kind === 'earth' || kind === 'night' ? H(200, 0.1 + (0.45 * (1.12 - d2)) / 0.12) : C(0.1 + (0.35 * (1.12 - d2)) / 0.12)); continue; }
      const nz = Math.sqrt(1 - d2);
      if (kind === 'wire') { this.wire(f, x, y, dx, dy, nz, cr, sr, ct, stl, R); continue; }
      const ty = dy * ct - nz * stl, tz = dy * stl + nz * ct;
      const wx = dx * cr + tz * sr, wz = -dx * sr + tz * cr, wy = ty;
      const lr = dx * Lx + dy * Ly + nz * Lz, l = clamp(lr, 0, 1) * 0.85 + 0.15;
      let c, col;
      if (kind === 'moon') {
        let alb = 0.62 + 0.3 * Noise.fbm(wx * 2.2 + 5, wy * 2.2, wz * 2.2, 3), sh = 0;
        for (const q of s.cr) {
          const dd = wx * q[0] + wy * q[1] + wz * q[2];
          if (dd < q[3]) continue;
          const u = (1 - dd) / (1 - q[3]);
          if (u < 0.7) { alb -= 0.22 * (1 - u / 0.7); sh += (wx - q[0]) * Lx * 0.8 + (wy - q[1]) * Ly * 0.8; } else alb += 0.25 * (1 - Math.abs(u - 0.85) / 0.15);
        }
        const e = clamp(l * alb + sh * 0.6, 0, 1);
        c = RAMP[Math.max(1, Math.min(9, (e * 10) | 0))]; col = C(0.15 + e * 0.85);
      } else if (kind === 'ringed') {
        const band = Math.sin(wy * 15 + Noise.fbm(wx * 1.5, wy * 6, wz * 1.5, 2) * 2.4), spot = Math.hypot((wy + 0.35) * 3.2, Math.atan2(wx, wz) - 1.2);
        let e = l * (0.55 + 0.25 * band);
        if (spot < 0.45) e = l * (0.85 - spot * 0.4);
        c = RAMP[Math.max(1, Math.min(9, (e * 10) | 0))]; col = C(0.15 + e * 0.8);
      } else if (kind === 'lava') {
        const n = Noise.n3(wx * 2.2 + 3, wy * 2.2, wz * 2.2), r = 1 - Math.abs(n);
        const glow = Math.pow(r, 22) * (0.75 + 0.25 * Math.sin(t * 1.5 + wx * 4));
        if (glow > 0.2) { c = glow > 0.6 ? '@' : glow > 0.38 ? '%' : '#'; col = C(0.55 + glow * 0.45); }
        else if (glow > 0.06) { c = ':'; col = C(0.35 + glow); }
        else { const e = l * (0.3 + 0.2 * Noise.fbm(wx * 4, wy * 4, wz * 4, 2)); c = RAMP[Math.max(1, Math.min(4, (e * 10) | 0))]; col = C(0.08 + e * 0.35); }
      } else if (kind === 'night') {
        const e = Noise.fbm(wx * 1.6 + 10, wy * 1.6, wz * 1.6, 4), day = clamp(lr * 4 + 0.3, 0, 1);
        if (day > 0.05) {
          const ld = l * day;
          if (Math.abs(wy) > 0.88 - e * 0.2) { c = ld > 0.6 ? '#' : '+'; col = C(0.3 + 0.6 * ld); }
          else if (e > 0.04) { c = LAND[Math.max(1, Math.min(8, ((ld * 0.75 + e * 1.2) * 9) | 0))]; col = H(e > 0.25 ? 35 : 110, ld * 0.85); }
          else { c = SEA[Math.max(1, Math.min(4, (ld * 5) | 0))]; col = H(215, ld * 0.75); }
          if (day < 0.5 && e > 0.04) { const hs = hash2(Math.floor(wx * 40), Math.floor(wy * 40) + Math.floor(wz * 40) * 57); if (hs > 0.8) { c = hs > 0.95 ? '*' : '·'; col = H(45, 0.5 + 0.4 * (1 - day)); } }
        } else if (e > 0.04 && Math.abs(wy) < 0.8) {
          const hs = hash2(Math.floor(wx * 40), Math.floor(wy * 40) + Math.floor(wz * 40) * 57);
          if (hs > 0.78) { c = hs > 0.95 ? '*' : hs > 0.88 ? '+' : '·'; col = H(42, 0.45 + 0.4 * hs + 0.1 * Math.sin(t * 3 + hs * 50)); } else continue;
        } else continue;
      } else {
        const e = Noise.fbm(wx * 1.6 + 10, wy * 1.6, wz * 1.6, 4);
        if (Math.abs(wy) > 0.88 - e * 0.2) { c = l > 0.6 ? '#' : '+'; col = C(0.55 + 0.45 * l); }
        else if (e > 0.04) { c = LAND[Math.max(1, Math.min(8, ((l * 0.75 + e * 1.2) * 9) | 0))]; col = H(e > 0.25 ? 35 : 110, l * 0.85); }
        else { c = SEA[Math.max(1, Math.min(4, (l * 5) | 0))]; col = H(215, l * 0.75); }
      }
      g.set(x, y, c, col);
    }
    if (ringed) this.ring(f, cx, cy, R, 1);
  },
  ring(f, cx, cy, R, front) {
    const { g, cols, rows, aspect, C } = f, inc = 0.28, ca = Math.cos(-0.25), sa = Math.sin(-0.25);
    const ext = R * 2.25;
    for (let y = Math.max(0, Math.floor(cy - ext / aspect)); y <= Math.min(rows - 1, cy + ext / aspect); y++) for (let x = Math.max(0, Math.floor(cx - ext)); x <= Math.min(cols - 1, cx + ext); x++) {
      const px = (x + 0.5 - cx) / R, py = ((y + 0.5 - cy) * aspect) / R;
      const u = px * ca + py * sa, v = (-px * sa + py * ca) / inc, r = Math.hypot(u, v);
      if (r < 1.3 || r > 2.2) continue;
      const isFront = v > 0;
      if (isFront !== !!front) continue;
      if (!front && px * px + py * py < 1) continue;
      if (r > 1.74 && r < 1.8) continue;
      const dens = 0.55 + 0.35 * Math.sin(r * 38) + 0.1 * Math.sin(r * 91);
      g.set(x, y, dens > 0.75 ? '=' : dens > 0.45 ? '-' : '.', C(0.25 + dens * 0.6 * (front ? 1 : 0.7)));
    }
  },
  wire(f, x, y, dx, dy, nz, cr, sr, ct, stl, R) {
    const { g, C } = f, step = Math.PI / 9, th = clamp(0.8 / R, 0.012, 0.09);
    let best = 0, ch = '';
    for (const sgn of [-1, 1]) {
      const z = nz * sgn, ty = dy * ct - z * stl, tz = dy * stl + z * ct;
      const wx = dx * cr + tz * sr, wz = -dx * sr + tz * cr, lat = Math.asin(clamp(ty, -1, 1)), lon = Math.atan2(wx, wz);
      const dl = Math.abs(lat - Math.round(lat / step) * step), dn = Math.abs(lon - Math.round(lon / step) * step) * Math.cos(lat);
      const onLat = dl < th, onLon = dn < th && Math.abs(lat) < 1.4;
      if (!onLat && !onLon) continue;
      const b = sgn > 0 ? 0.55 + 0.45 * z : 0.18;
      if (b > best) { best = b; ch = onLat && onLon ? '+' : onLat ? (Math.abs(lat) < 0.02 ? '=' : '-') : '|'; if (onLon && !onLat && Math.abs(dx) > 0.35) ch = (dx > 0) === (dy > 0) ? '\\' : '/'; }
    }
    if (best) g.set(x, y, ch, C(best));
  } });

const PHI = (1 + Math.sqrt(5)) / 2;
const rotM = (ax, ay, az) => {
  const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), cc = Math.cos(az), sc = Math.sin(az);
  return [cb * cc, sa * sb * cc - ca * sc, ca * sb * cc + sa * sc, cb * sc, sa * sb * sc + ca * cc, ca * sb * sc - sa * cc, -sb, sa * cb, ca * cb];
};
const mul = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const slopeCh = (dx, dy) => { const a = Math.atan2(dy, dx), k = ((Math.round(a / (Math.PI / 4)) % 4) + 4) % 4; return '-\\|/'[k]; };
// 二十面體的面法向量（= 正十二面體的頂點方向）
const ICO_N = (() => {
  const out = [], q = 1 / PHI;
  for (const a of [-1, 1]) for (const b of [-1, 1]) { for (const c of [-1, 1]) out.push([a, b, c]); out.push([0, a * q, b * PHI], [a * q, b * PHI, 0], [a * PHI, 0, b * q]); }
  return out.map(v => { const l = Math.hypot(...v); return v.map(c => c / l); });
})();
const CUBE_N = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
A({ id: 'cube', name: '旋轉方塊', cat: '幾何', theme: 'ice', hue: true, desc: '光影即時計算的 3D 立方體',
  params: { shape: 'cube' },
  variants: [
    { id: 'wire', name: '線框方塊', theme: 'blueprint', hue: false, desc: '大小兩個線框立方體反向旋轉', params: { shape: 'wire' } },
    { id: 'tess', name: '超正方體', theme: 'neon', desc: '四維超正方體投影到三維的旋轉', params: { shape: 'tess' } },
    { id: 'icosa', name: '二十面體', theme: 'mint', desc: '二十個三角面各自上色的多面體', params: { shape: 'icosa' } },
    { id: 'grid', name: '方塊矩陣', theme: 'synth', desc: '整排小方塊依序翻滾的波浪', params: { shape: 'grid' } },
    { id: 'sticker', name: '彩格方塊', theme: 'mono', desc: '每面九格彩色貼紙的方塊', params: { shape: 'sticker' } },
  ],
  init(s) { s.z = null; },
  frame(s, f) {
    const { g, cols, rows, aspect, t, H, p } = f, n = cols * rows, shp = p.shape;
    if (shp === 'wire') return this.wire(s, f);
    if (shp === 'tess') return this.tess(s, f);
    if (shp === 'icosa') return this.poly(f, cols / 2, rows / 2, Math.min(cols, rows * aspect) * 0.4, rotM(t * 0.5, t * 0.37, t * 0.21), ICO_N, 1.5115 / 1.902, k => (k * 47) % 360, true);
    if (shp === 'grid') {
      const cs = (rows * aspect) / 3.1, nx = Math.max(1, Math.floor(cols / cs)), ny = 3, ox = (cols - nx * cs) / 2 + cs / 2;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const ph = t * 1.2 - (i + j) * 0.35, k = Math.max(0, Math.sin(ph)) ** 2;
        this.poly(f, ox + i * cs, (j + 0.5) * (rows / ny), cs * 0.36, rotM(k * Math.PI * 0.5 + 0.5, k * Math.PI + 0.6, 0.2), CUBE_N, 1 / Math.sqrt(3), q => [0, 40, 120, 190, 270, 320][q] + (i + j) * 12, false);
      }
      return;
    }
    if (!s.z || s.z.length !== n) s.z = new Float32Array(n); else s.z.fill(0);
    const ax = t * (shp === 'sticker' ? 0.45 : 0.7), ay = t * (shp === 'sticker' ? 0.33 : 0.5), az = t * 0.3;
    const m = rotM(ax, ay, az);
    const size = Math.min(cols, rows * aspect) * 0.24, K = size * 4.2, cx = cols / 2, cy = rows / 2;
    const st = clamp(0.55 / size, 0.008, 0.12), R = '.,-~:;=!*#$@', HU = [0, 40, 120, 190, 270, 320];
    const STK = [-1, 30, 55, 120, 220, 0];
    for (let fi = 0; fi < 6; fi++) {
      const N = CUBE_N[fi];
      const nx = m[0] * N[0] + m[1] * N[1] + m[2] * N[2], ny = m[3] * N[0] + m[4] * N[1] + m[5] * N[2], nz = m[6] * N[0] + m[7] * N[1] + m[8] * N[2];
      if (nz > 0.05) continue;
      const lum = clamp(nx * -0.45 + ny * -0.55 + nz * -0.7, 0, 1);
      const col = H(HU[fi], 0.25 + lum * 0.75), edgeCol = H(HU[fi], 1), chr = R[Math.min(11, Math.round(lum * 11))];
      const sc = shp === 'sticker' ? (STK[fi] < 0 ? f.C(0.3 + lum * 0.7) : H(STK[fi], 0.3 + lum * 0.6)) : null;
      for (let u = -1; u <= 1; u += st) for (let v = -1; v <= 1; v += st) {
        let px, py, pz;
        if (N[0]) { px = N[0]; py = u; pz = v; } else if (N[1]) { px = u; py = N[1]; pz = v; } else { px = u; py = v; pz = N[2]; }
        const X = m[0] * px + m[1] * py + m[2] * pz, Y = m[3] * px + m[4] * py + m[5] * pz, Z = m[6] * px + m[7] * py + m[8] * pz + 4.2;
        const oz = 1 / Z, xf = cx + K * oz * X, yf = cy + (K * oz * Y) / aspect;
        if (xf < 0 || yf < 0 || xf >= cols || yf >= rows) continue;
        const o = (yf | 0) * cols + (xf | 0);
        if (oz > s.z[o]) {
          s.z[o] = oz;
          if (sc) {
            const gu = Math.abs(fract((u + 1) * 1.5) - 0.5), gv = Math.abs(fract((v + 1) * 1.5) - 0.5);
            if (gu > 0.4 || gv > 0.4) { g.ch[o] = ' '; continue; }
            g.ch[o] = '█'; g.co[o] = sc; continue;
          }
          const edge = Math.abs(u) > 0.97 || Math.abs(v) > 0.97;
          g.ch[o] = edge ? '#' : chr; g.co[o] = edge ? edgeCol : col;
        }
      }
    }
  },
  // 凸多面體逐格光線投射（正交投影）：planes 為單位法向量，d 為內切半徑／外接半徑
  poly(f, cx, cy, R, m, planes, d, hueOf, edges) {
    const { g, cols, rows, aspect, H } = f, np = planes.length, rn = planes.map(v => mul(m, v)), RAMP = '.:-=+*#%@';
    const y0 = Math.max(0, Math.floor(cy - R / aspect - 1)), y1 = Math.min(rows - 1, Math.ceil(cy + R / aspect + 1));
    const x0 = Math.max(0, Math.floor(cx - R - 1)), x1 = Math.min(cols - 1, Math.ceil(cx + R + 1));
    const Lx = -0.45, Ly = -0.55, Lz = -0.7, eps = 1.2 / R;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const X = (x + 0.5 - cx) / R, Y = ((y + 0.5 - cy) * aspect) / R;
      let tn = -9, tf = 9, best = -1, second = -9;
      for (let k = 0; k < np; k++) {
        const nv = rn[k], num = d - nv[0] * X - nv[1] * Y + nv[2] * 3, den = nv[2];
        if (Math.abs(den) < 1e-6) { if (num < 0) { tn = 9; break; } continue; }
        const tt = num / den;
        if (den < 0) { if (tt > tn) { second = tn; tn = tt; best = k; } else if (tt > second) second = tt; } else if (tt < tf) tf = tt;
      }
      if (best < 0 || tn > tf) continue;
      const nv = rn[best], lum = clamp(nv[0] * Lx + nv[1] * Ly + nv[2] * Lz, 0, 1);
      const edge = edges && tn - second < eps;
      g.set(x, y, edge ? '#' : RAMP[Math.min(8, (lum * 9) | 0)], H(hueOf(best), edge ? 0.95 : 0.2 + lum * 0.75));
    }
  },
  wire(s, f) {
    const { g, cols, rows, aspect, t, C } = f, cx = cols / 2, cy = rows / 2, size = Math.min(cols, rows * aspect) * 0.26;
    const V = []; for (let i = 0; i < 8; i++) V.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
    const E = []; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const x = i ^ j; if (x === 1 || x === 2 || x === 4) E.push([i, j]); }
    for (const [sc, dir] of [[1, 1], [0.5, -1.6]]) {
      const m = rotM(t * 0.6 * dir, t * 0.43 * dir, t * 0.27), P = V.map(v => { const r = mul(m, v.map(c => c * sc)), oz = 1 / (r[2] + 4.2); return [cx + size * 4.2 * oz * r[0], cy + (size * 4.2 * oz * r[1]) / aspect, r[2]]; });
      for (const [a, b] of E) {
        const A0 = P[a], B0 = P[b], zz = (A0[2] + B0[2]) / 2, br = clamp(0.75 - zz * 0.3, 0.25, 1);
        g.line(A0[0], A0[1], B0[0], B0[1], slopeCh(B0[0] - A0[0], (B0[1] - A0[1]) * aspect), C(br * (sc < 1 ? 0.8 : 1)));
      }
      for (const q of P) g.set(q[0], q[1], 'O', C(clamp(0.9 - q[2] * 0.3, 0.3, 1)));
    }
  },
  tess(s, f) {
    const { g, cols, rows, aspect, t, H } = f, cx = cols / 2, cy = rows / 2, size = Math.min(cols, rows * aspect) * 0.2;
    const a1 = t * 0.5, a2 = t * 0.33, c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2), m = rotM(0.5 + t * 0.12, t * 0.2, 0.3);
    const P = [];
    for (let i = 0; i < 16; i++) {
      let x = i & 1 ? 1 : -1, y = i & 2 ? 1 : -1, z = i & 4 ? 1 : -1, w = i & 8 ? 1 : -1;
      [x, w] = [x * c1 - w * s1, x * s1 + w * c1];
      [y, z] = [y * c2 - z * s2, y * s2 + z * c2];
      const k = 2.2 / (3 - w), r = mul(m, [x * k, y * k, z * k]), oz = 1 / (r[2] + 5);
      P.push([cx + size * 5 * oz * r[0], cy + (size * 5 * oz * r[1]) / aspect, w, r[2]]);
    }
    for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) {
      const j = i ^ (1 << b);
      if (j < i) continue;
      const A0 = P[i], B0 = P[j], w = (A0[2] + B0[2]) / 2, br = clamp(0.55 - (A0[3] + B0[3]) * 0.12, 0.2, 1);
      g.line(A0[0], A0[1], B0[0], B0[1], slopeCh(B0[0] - A0[0], (B0[1] - A0[1]) * aspect), H(b === 3 ? 300 : 190 + w * 40, br));
    }
    for (const q of P) g.set(q[0], q[1], '●', H(320 + q[2] * 30, clamp(0.85 - q[3] * 0.15, 0.4, 1)));
  } });

A({ id: 'plasma', name: '迷幻電漿', cat: '幾何', theme: 'rainbow', hue: true, desc: 'Demoscene 經典的流動色彩',
  params: { mode: 'classic' },
  variants: [
    { id: 'ripple', name: '干涉波紋', theme: 'ocean', desc: '三個移動波源交織出的干涉紋', params: { mode: 'ripple' } },
    { id: 'thermal', name: '熱像儀', theme: 'fire', hue: false, desc: '熱源團塊漂移的紅外線熱影像', params: { mode: 'thermal' } },
    { id: 'camo', name: '數位迷彩', theme: 'forest', hue: false, desc: '四階色塊緩慢變形的迷彩圖樣', params: { mode: 'camo' } },
    { id: 'checker', name: '歐普藝術', theme: 'mono', hue: false, desc: '扭曲鼓脹的黑白棋盤錯視', params: { mode: 'checker' } },
    { id: 'marble', name: '大理石紋', theme: 'paper', hue: false, desc: '墨色紋理在紙面上緩緩流動', params: { mode: 'marble' } },
  ],
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H, p } = f, ch = g.ch, co = g.co, mode = p.mode;
    const k = 9 / cols;
    if (mode === 'classic') {
      const px = 4 + Math.sin(t * 0.37) * 3, py = 2 + Math.cos(t * 0.29) * 2;
      if (!s.sx || s.sx.length !== cols) s.sx = new Float64Array(cols);
      for (let x = 0; x < cols; x++) s.sx[x] = Math.sin(x * k + t);
      for (let y = 0, i = 0; y < rows; y++) {
        const v = y * aspect * k, sy = Math.sin(v * 1.3 + t * 0.9), dy = v - py;
        for (let x = 0; x < cols; x++, i++) {
          const u = x * k, dx = u - px;
          const val = s.sx[x] + sy + Math.sin((u + v) * 0.7 + t * 0.6) + Math.sin(Math.sqrt(dx * dx + dy * dy) * 1.6 - t * 1.4);
          const e = 0.5 + 0.5 * Math.sin(val * 1.6 + t * 0.5);
          ch[i] = RAMP10[Math.min(9, (e * 10) | 0)];
          co[i] = H(val * 45 + t * 25, 0.25 + e * 0.75);
        }
      }
    } else if (mode === 'ripple') {
      const W = cols * k, Hh = rows * aspect * k;
      const src = [0, 1, 2].map(j => [W * (0.5 + 0.38 * Math.sin(t * (0.13 + j * 0.05) + j * 2.1)), Hh * (0.5 + 0.38 * Math.cos(t * (0.11 + j * 0.04) + j * 1.3))]);
      for (let y = 0, i = 0; y < rows; y++) {
        const v = y * aspect * k;
        for (let x = 0; x < cols; x++, i++) {
          const u = x * k;
          let val = 0;
          for (let q = 0; q < 3; q++) { const dx = u - src[q][0], dy = v - src[q][1]; val += Math.sin(Math.sqrt(dx * dx + dy * dy) * 4.2 - t * 2.2); }
          const e = (val + 3) / 6;
          if (e < 0.18) continue;
          ch[i] = e > 0.85 ? '@' : e > 0.7 ? '#' : e > 0.55 ? '=' : e > 0.4 ? '-' : e > 0.28 ? '~' : '.';
          co[i] = H(190 + val * 30, 0.15 + e * 0.8);
        }
      }
    } else if (mode === 'thermal') {
      const R = ' .:░▒▓█', bl = [];
      for (let j = 0; j < 7; j++) bl.push([cols * (0.5 + 0.45 * Math.sin(t * (0.07 + j * 0.017) + j * 1.7)), rows * aspect * (0.5 + 0.45 * Math.sin(t * (0.09 + j * 0.013) + j * 2.9)), (0.04 + (j % 3) * 0.02) * cols]);
      for (let y = 0, i = 0; y < rows; y++) {
        const yy = y * aspect;
        let nz = 0;
        for (let x = 0; x < cols; x++, i++) {
          let v = 0;
          if (!(x & 1)) nz = Noise.n3(x * 0.05, yy * 0.05, t * 0.3) * 0.12;
          for (let q = 0; q < 7; q++) { const b = bl[q], dx = x - b[0], dy = yy - b[1], d2 = (dx * dx + dy * dy) / (b[2] * b[2]); if (d2 < 7) v += Math.exp(-d2); }
          const e = clamp(v * 0.85 + nz, 0, 1);
          ch[i] = R[Math.min(6, (e * 7) | 0)]; co[i] = C(0.1 + e * 0.9);
        }
      }
    } else if (mode === 'camo') {
      const L = ['░', '▒', '▓', '█'], sc = 6 / cols;
      let n = 0;
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        if (!(x & 1)) n = Noise.fbm(x * sc, y * aspect * sc, t * 0.06, 2) + 0.35 * Noise.n3(x * sc * 3.2, y * aspect * sc * 3.2, t * 0.1 + 5);
        const q = n < -0.18 ? 0 : n < 0.02 ? 1 : n < 0.2 ? 2 : 3;
        ch[i] = L[q]; co[i] = C(0.18 + q * 0.16);
      }
    } else if (mode === 'checker') {
      const sc = 14 / cols, bx = cols * (0.5 + 0.3 * Math.sin(t * 0.21)), by = rows * aspect * (0.5 + 0.3 * Math.cos(t * 0.17)), br = Math.min(cols, rows * aspect) * 0.45;
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        let dx = x - bx, dy = y * aspect - by;
        const d = Math.hypot(dx, dy) / br, bulge = d < 1 ? 0.45 + 0.55 * d * d : 1;
        dx *= bulge; dy *= bulge;
        const u = (dx + bx) * sc + Math.sin(y * aspect * sc * 0.6 + t * 0.5) * 0.6, v = (dy + by) * sc + Math.sin(x * sc * 0.6 - t * 0.4) * 0.6;
        const cu = fract(u), cv = fract(v), on = ((Math.floor(u) + Math.floor(v)) & 1) === 0;
        if (!on) continue;
        const edge = Math.min(cu, 1 - cu, cv, 1 - cv) < 0.08;
        ch[i] = edge ? '▓' : '█'; co[i] = C(edge ? 0.6 : 0.92 - (d < 1 ? (1 - d) * 0.25 : 0));
      }
    } else {
      const sc = 3 / cols, R = ' .,:-=+*#%';
      let w0 = 0, w2 = 0;
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        const u = x * sc, v = y * aspect * sc;
        if (!(x & 1)) { w0 = x ? w2 : Noise.fbm(u * 1.4, v * 1.4, t * 0.04, 2); w2 = Noise.fbm((x + 2) * sc * 1.4, v * 1.4, t * 0.04, 2); }
        const w = x & 1 ? (w0 + w2) * 0.5 : w0;
        const vein = Math.abs(Math.sin((u * 2.2 + v * 1.1 + w * 4.5 + t * 0.05) * Math.PI));
        const q1 = 1 - vein, e = q1 * q1 * q1 * Math.sqrt(q1) + Math.max(0, w) * 0.25;
        if (e < 0.08) continue;
        ch[i] = R[Math.min(9, (e * 10) | 0)]; co[i] = C(0.25 + e * 0.75);
      }
    }
  } });

A({ id: 'tunnel', name: '時空隧道', cat: '幾何', theme: 'synth', hue: true, desc: '無限延伸、旋轉前進的隧道',
  params: { shape: 'round', mode: 'check' },
  variants: [
    { id: 'square', name: '方形隧道', theme: 'cyber', desc: '方正的格紋通道筆直向前', params: { shape: 'square' } },
    { id: 'hex', name: '六角隧道', theme: 'gold', desc: '六角截面緩緩旋轉的金色蜂巢通道', params: { mode: 'hex' } },
    { id: 'wire', name: '線框隧道', theme: 'matrix', hue: false, desc: '只有環與縱線的綠色線框通道', params: { mode: 'wire' } },
    { id: 'vortex', name: '漩渦', theme: 'ocean', hue: false, desc: '螺旋條紋不斷向中心捲入', params: { mode: 'vortex' } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f, n = cols * rows;
    s.d = new Float32Array(n); s.a = new Float32Array(n);
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const dx = x - cols / 2 + 0.5, dy = (y - rows / 2 + 0.5) * aspect, ax = Math.abs(dx), ay = Math.abs(dy);
      s.d[i] = p.shape === 'square' ? Math.max(ax, ay) * 1.1 : p.shape === 'hex' ? Math.max(ax * 0.866 + ay * 0.5, ay) * 1.05 : Math.hypot(dx, dy);
      s.a[i] = Math.atan2(dy, dx) / TAU;
    }
    s.m = Math.hypot(cols / 2, (rows / 2) * aspect);
    if (p.mode === 'hex') { s.r = new Float32Array(n); for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) s.r[i] = Math.hypot(x - cols / 2 + 0.5, (y - rows / 2 + 0.5) * aspect); }
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H, p } = f, n = g.n, ch = g.ch, co = g.co, mode = p.mode;
    if (mode === 'hex') return this.hex(s, f);
    if (mode === 'bend') {
      const ox = Math.sin(t * 0.43) * cols * 0.3 + Math.sin(t * 0.17) * cols * 0.1, oy = Math.sin(t * 0.31 + 1) * rows * aspect * 0.25, m = s.m;
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        const d0 = s.d[i], w = 1 / (1 + d0 / (m * 0.12)), dx = x - cols / 2 + 0.5 - ox * w, dy = (y - rows / 2 + 0.5) * aspect - oy * w;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 2) continue;
        const u = 70 / d + t * 1.8, v = Math.atan2(dy, dx) / TAU * 8 + t * 0.12 + u * 0.05;
        const chk = (Math.floor(u * 2) + Math.floor(v * 2)) & 1, e = Math.min(1, (d0 / m) * 1.6) * (chk ? 1 : 0.42);
        ch[i] = RAMP10[Math.min(9, (e * 10) | 0)]; co[i] = H(u * 40, e);
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      const d = s.d[i];
      if (d < 2) continue;
      if (mode === 'wire') {
        const u = 70 / d + t * 1.6, v = s.a[i] * 16 + t * 0.1, fu = fract(u * 1.5), fv = fract(v), ring = fu < 0.07 * (1 + d / 40), spoke = Math.min(fv, 1 - fv) < 0.5 / (d * 0.18 + 0.5);
        if (!ring && !spoke) continue;
        const e = Math.min(1, (d / s.m) * 1.8);
        ch[i] = ring && spoke ? '+' : ring ? (d > 25 ? '=' : '-') : ':'; co[i] = C(0.15 + e * 0.85);
        continue;
      }
      if (mode === 'vortex') {
        const u = 70 / d + t * 1.2, v = s.a[i] * 6 + u * 0.55 + t * 0.2, st = 0.5 + 0.5 * Math.sin(v * TAU), dep = Math.min(1, (d / s.m) * 1.7);
        const e = dep * (0.3 + 0.7 * st);
        ch[i] = RAMP10[Math.min(9, (e * 10) | 0)]; co[i] = C(e);
        continue;
      }
      const u = 70 / d + t * 1.6, v = s.a[i] * 8 + t * 0.15 + u * 0.05;
      const chk = (Math.floor(u * 2) + Math.floor(v * 2)) & 1;
      const e = Math.min(1, (d / s.m) * 1.6) * (chk ? 1 : 0.42);
      ch[i] = RAMP10[Math.min(9, (e * 10) | 0)]; co[i] = H(u * 40, e);
    }
  },
  // 六角隧道：截面是慢慢旋轉的正六邊形，六面牆各自貼上蜂巢格（材質座標 X 沿著牆面、Y 是深度），
  // 格線的方向換算回螢幕上的方向來挑 / \ _ |，六個稜角畫成明亮的放射線
  hex(s, f) {
    const { g, cols, rows, aspect, t, C } = f, n = g.n, ch = g.ch, co = g.co, m = s.m;
    const rot = t * 0.12, S3 = Math.sqrt(3), T30 = Math.tan(Math.PI / 6), ky = 1.5, P3 = Math.PI / 3;
    const fill = ' .:-=+';
    for (let i = 0; i < n; i++) {
      const r = s.r[i];
      if (r < 2) continue;
      let a = s.a[i] * TAU - rot;
      const k = Math.round(a / P3), arel = a - k * P3, an = k * P3 + rot;
      const dh = r * Math.cos(arel);
      if (dh < 2.5) continue;
      const e = Math.min(1, (dh / m) * 1.7);
      // 稜角：六邊形的六個角往中心收束的接縫
      if (Math.abs(arel) > Math.PI / 6 - 0.9 / r) {
        const ra = s.a[i] * TAU;
        ch[i] = slopeCh(Math.cos(ra), Math.sin(ra)); co[i] = C(0.35 + e * 0.65);
        continue;
      }
      const lam = Math.tan(arel), u = 70 / dh + t * 1.6, Y = u * ky, X = (((k % 6) + 6) % 6) * 3 + 1.5 + lam * (1.5 / T30);
      let ax = X - 3 * Math.round(X / 3), ay = Y - S3 * Math.round(Y / S3);
      const bX = X - 1.5, bY = Y - S3 / 2, bx = bX - 3 * Math.round(bX / 3), by = bY - S3 * Math.round(bY / S3);
      let cid;
      if (bx * bx + by * by < ax * ax + ay * ay) { ax = bx; ay = by; cid = hash2(Math.round(bX / 3) + 0.5, Math.round(bY / S3)); }
      else cid = hash2(Math.round(X / 3), Math.round(Y / S3));
      const gx = Math.abs(ax), gy = Math.abs(ay), side = gx * 0.866 + gy * 0.5, hd = Math.max(gy, side);
      // 一格螢幕字元大約等於多少材質單位：格線粗細維持一個字左右
      const sY = (dh * dh) / (70 * ky), sX = dh * T30 / 1.5, wr = 0.75 / Math.min(sY, sX * 1.4), w = clamp(wr, 0.05, 0.45);
      if (wr > 0.6) { if (hash2(i, 3.7) > 0.8) { ch[i] = '.'; co[i] = C(0.1 + e * 0.3); } continue; }   // 太遠：格子小到畫不出來，只留一點微光
      if (hd > 0.866 - w) {
        let eX, eY;
        if (gy >= side) { eX = 1; eY = 0; } else if (ax * ay > 0) { eX = -0.5; eY = 0.866; } else { eX = 0.5; eY = 0.866; }
        const dl = eX * (T30 / 1.5), dd = (-dh * dh / 70) * (eY / ky);
        const nx = Math.cos(an), ny = Math.sin(an), tx = -ny, ty = nx;
        const vx = dd * (nx + lam * tx) + dh * dl * tx, vy = dd * (ny + lam * ty) + dh * dl * ty;
        const c = slopeCh(vx, vy);
        ch[i] = c === '-' ? '_' : c; co[i] = C(0.2 + e * 0.7);
        continue;
      }
      // 格子內部：暗暗的蜂蜜色，少數格子慢慢亮起
      const glow = cid > 0.82 ? 0.5 + 0.5 * Math.sin(t * 1.3 + cid * 40) : 0, q = (1 - hd / 0.866) * (0.35 + glow * 0.65) * e;
      const fi = Math.min(5, (q * 6 + glow * 1.5 * e) | 0);
      if (fi > 0) { ch[i] = fill[fi]; co[i] = C(0.08 + q * 0.5 + glow * e * 0.3); }
    }
  } });

A({ id: 'julia', name: '碎形漫遊', cat: '碎形', theme: 'rainbow', hue: true, desc: '不斷變形的朱利亞集合碎形',
  params: { kind: 'julia' },
  variants: [
    { id: 'trap', name: '軌道陷阱', theme: 'gold', hue: false, desc: '以軌道陷阱著色的花瓣狀碎形', params: { kind: 'trap' } },
  ],
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H, p } = f, n = cols * rows, ch = g.ch, co = g.co, kind = p.kind;
    const maxIt = clamp((1.4e6 / n) | 0, 14, 48), R = ' .,:;-=+*#%@', cx = cols / 2, cy = rows / 2;
    if (kind === 'julia' || kind === 'quartic' || kind === 'trap') {
      const q4 = kind === 'quartic', trap = kind === 'trap';
      const ang = q4 ? t * 0.07 : trap ? 2.4 + Math.sin(t * 0.07) * 0.6 : 2.15 + Math.sin(t * 0.09) * 0.75, rad = q4 ? 0.72 + 0.06 * Math.sin(t * 0.13) : 0.7885;
      const cr = rad * Math.cos(ang), ci = rad * Math.sin(ang);
      const zoom = 1.25 + 0.25 * Math.sin(t * 0.13), sc = (q4 ? 2.9 : 3.2) / zoom / cols, mi = q4 ? Math.max(12, (maxIt * 0.7) | 0) : maxIt;
      for (let y = 0, i = 0; y < rows; y++) {
        const zy0 = (y - cy) * aspect * sc;
        const my = rows - y;
        for (let x = 0; x < cols; x++, i++) {
          // z 與 -z 的迭代結果相同：畫面中心對稱的那一格已經算過就直接複製（結果完全一樣，速度快一倍）
          const mx = cols - x;
          if ((my < y || (my === y && mx < x)) && mx < cols) { const j = my * cols + mx; ch[i] = ch[j]; co[i] = co[j]; continue; }
          let zx = (x - cx) * sc, zy = zy0, it = 0, zx2 = zx * zx, zy2 = zy * zy, tm = 9;
          if (q4) {
            while (it < mi && zx2 + zy2 < 16) { const a = zx2 - zy2, b = 2 * zx * zy; zx = a * a - b * b + cr; zy = 2 * a * b + ci; zx2 = zx * zx; zy2 = zy * zy; it++; }
          } else {
            while (it < mi && zx2 + zy2 < 16) {
              zy = 2 * zx * zy + ci; zx = zx2 - zy2 + cr; zx2 = zx * zx; zy2 = zy * zy; it++;
              if (trap) { const dd = Math.abs(zx) < Math.abs(zy) ? Math.abs(zx) : Math.abs(zy); if (dd < tm) tm = dd; }
            }
          }
          if (trap) {
            const e = Math.pow(clamp(1 - Math.sqrt(tm) * 1.6, 0, 1), 2.2);
            if (e < 0.06) continue;
            ch[i] = R[Math.min(11, (e * 12) | 0)]; co[i] = C(0.15 + e * 0.85);
            continue;
          }
          if (it >= mi) continue;
          const mu = it + 1 - Math.log(Math.log(Math.sqrt(zx2 + zy2))) / Math.log(q4 ? 4 : 2);
          const e = Math.pow(clamp(mu / (mi * 0.5), 0, 1), 0.7);
          ch[i] = R[Math.min(11, (e * 12) | 0)]; co[i] = H(mu * 9 + t * 25, 0.2 + e * 0.8);
        }
      }
      return;
    }
    if (kind === 'newton') {
      const a = 1 + 0.45 * Math.sin(t * 0.17), rot = t * 0.05, cr = Math.cos(rot), sr = Math.sin(rot), sc = 3.4 / cols, HU = [0, 120, 240];
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        const X = (x - cx) * sc, Y = (y - cy) * aspect * sc;
        let zx = X * cr - Y * sr, zy = X * sr + Y * cr, it = 0, root = -1;
        for (; it < 24; it++) {
          const x2 = zx * zx, y2 = zy * zy, d = 3 * (x2 + y2) * (x2 + y2);
          if (d < 1e-9) break;
          const fx = zx * x2 - 3 * zx * y2 - 1, fy = 3 * x2 * zy - zy * y2, gx = 3 * (x2 - y2), gy = 6 * zx * zy;
          const qx = (fx * gx + fy * gy) / (gx * gx + gy * gy), qy = (fy * gx - fx * gy) / (gx * gx + gy * gy);
          zx -= a * qx; zy -= a * qy;
          if ((zx - 1) * (zx - 1) + zy * zy < 1e-3) { root = 0; break; }
          if ((zx + 0.5) * (zx + 0.5) + (zy - 0.866) * (zy - 0.866) < 1e-3) { root = 1; break; }
          if ((zx + 0.5) * (zx + 0.5) + (zy + 0.866) * (zy + 0.866) < 1e-3) { root = 2; break; }
        }
        if (root < 0) continue;
        const e = clamp(1 - it / 16, 0, 1);
        ch[i] = R[Math.max(1, Math.min(11, ((1 - e) * 12) | 0))]; co[i] = H(HU[root] + t * 10, 0.25 + 0.65 * Math.pow(1 - e, 0.6) + 0.1);
      }
      return;
    }
    let ox, oy, span, mi = maxIt;
    if (kind === 'mandel') {
      const z = 0.5 - 0.5 * Math.cos(t * 0.07), k = Math.exp(-z * 5.2);
      ox = lerp(-0.6, -0.743643887, Math.min(1, z * 1.6)); oy = lerp(0, 0.131825904, Math.min(1, z * 1.6)); span = 3.2 * k; mi = Math.min(90, maxIt + ((z * 40) | 0));
    } else {
      const z = 0.5 - 0.5 * Math.cos(t * 0.05);
      ox = lerp(-0.45, -1.755, z); oy = lerp(-0.5, -0.03, z); span = lerp(3.4, 0.16, Math.pow(z, 0.5)); mi = Math.max(14, (maxIt * 0.8) | 0);
    }
    const sc = span / cols;
    for (let y = 0, i = 0; y < rows; y++) {
      const c0 = oy + (y - cy) * aspect * sc;
      for (let x = 0; x < cols; x++, i++) {
        const c1 = ox + (x - cx) * sc;
        if (kind === 'mandel') { const q = (c1 - 0.25) ** 2 + c0 * c0; if (q * (q + c1 - 0.25) < 0.25 * c0 * c0 || (c1 + 1) ** 2 + c0 * c0 < 0.0625) continue; }
        let zx = 0, zy = 0, zx2 = 0, zy2 = 0, it = 0;
        if (kind === 'mandel') while (it < mi && zx2 + zy2 < 16) { zy = 2 * zx * zy + c0; zx = zx2 - zy2 + c1; zx2 = zx * zx; zy2 = zy * zy; it++; }
        else while (it < mi && zx2 + zy2 < 16) { zy = 2 * Math.abs(zx * zy) + c0; zx = zx2 - zy2 + c1; zx2 = zx * zx; zy2 = zy * zy; it++; }
        if (it >= mi) continue;
        const mu = it + 1 - Math.log(Math.log(Math.sqrt(zx2 + zy2))) / Math.LN2;
        const e = Math.pow(clamp(mu / (mi * 0.45), 0, 1), 0.6);
        ch[i] = R[Math.min(11, (e * 12) | 0)]; co[i] = C(0.15 + e * 0.85);
      }
    }
    void H;
  } });

A({ id: 'lava', name: '熔岩燈', cat: '幾何', theme: 'synth', desc: '黏稠流動、融合又分離的熔岩團',
  params: { mode: 'blob', n: 8, r: [0.07, 0.14], spd: 6 },
  variants: [
    { id: 'lamp', name: '經典燈瓶', theme: 'sunset', desc: '玻璃燈瓶裡緩緩浮沉的蠟團', params: { mode: 'lamp', n: 6, r: [0.05, 0.085], spd: 3 } },
    { id: 'rainbow', name: '彩色融合', theme: 'rainbow', hue: true, desc: '各色團塊相遇時顏色交融', params: { mode: 'rainbow', n: 9 } },
    { id: 'mercury', name: '液態水銀', theme: 'mono', desc: '帶高光反射的銀色液滴', params: { mode: 'mercury', n: 7, r: [0.08, 0.15] } },
    { id: 'swarm', name: '泡泡群', theme: 'mint', desc: '二十多顆小泡泡快速聚散', params: { n: 24, r: [0.035, 0.07], spd: 10 } },
  ],
  init(s, f) {
    const p = f.p;
    s.b = Array.from({ length: p.n }, (_, k) => ({ fx: rnd(0.05, 0.16), fy: rnd(0.04, 0.12), px: rnd(0, TAU), py: rnd(0, TAU), r: rnd(p.r[0], p.r[1]), hue: (k * 360) / p.n + rnd(-15, 15) }));
    s.v = new Float32Array(f.cols * f.rows);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H, p } = f, M = Math.min(cols, rows * aspect), mode = p.mode, sp = p.spd;
    const lamp = mode === 'lamp', ly0 = rows * 0.12, ly1 = rows * 0.82, lcx = cols / 2, lw = Math.min(cols * 0.22, rows * aspect * 0.32);
    const hw = y => { const u = (y - ly0) / (ly1 - ly0); return lw * (0.42 + 0.58 * Math.sin(Math.PI * clamp(0.15 + u * 0.75, 0, 1))); };
    const bs = s.b.map(b => Object.assign(lamp
      ? { x: lcx + Math.sin(t * b.fx * sp + b.px) * lw * 0.35, y: aspect * (ly0 + (ly1 - ly0) * (0.5 + 0.47 * Math.sin(t * b.fy * sp + b.py))), r2: (b.r * M) ** 2, hue: b.hue }
      : { x: cols * (0.5 + 0.4 * Math.sin(t * b.fx * sp + b.px)), y: rows * aspect * (0.5 + 0.42 * Math.sin(t * b.fy * sp + b.py)), r2: (b.r * M) ** 2, hue: b.hue }, { hs: Math.sin((b.hue * Math.PI) / 180), hc: Math.cos((b.hue * Math.PI) / 180) }));
    const nb = bs.length, V = s.v, rain = mode === 'rainbow';
    for (let y = 0, i = 0; y < rows; y++) {
      const yy = (y + 0.5) * aspect;
      let x0 = 0, x1 = cols;
      if (lamp) { if (y < ly0 || y > ly1) { for (let x = 0; x < cols; x++) V[i + x] = 0; i += cols; continue; } const w = hw(y); x0 = Math.max(0, Math.ceil(lcx - w)); x1 = Math.min(cols, Math.floor(lcx + w)); for (let x = 0; x < cols; x++) V[i + x] = 0; }
      for (let x = x0, j = i + x0; x < x1; x++, j++) {
        let v = 0, hs = 0, hc = 0;
        for (let k = 0; k < nb; k++) {
          const b = bs[k], dx = x + 0.5 - b.x, dy = yy - b.y, w = b.r2 / (dx * dx + dy * dy + 1);
          v += w;
          if (rain) { hs += b.hs * w; hc += b.hc * w; }
        }
        V[j] = v;
        if (rain && v >= 0.35) { const e = v >= 1 ? clamp(0.7 + (v - 1) * 0.15, 0, 1) : ((v - 0.35) / 0.65) * 0.55; g.ch[j] = RAMP10[Math.min(9, (e * 10) | 0)]; g.co[j] = H((Math.atan2(hs, hc) * 180) / Math.PI, e); }
      }
      i += cols;
    }
    if (rain) return;
    if (mode === 'contour') {
      for (let i = 0; i < g.n; i++) {
        const v = V[i];
        if (v < 0.15) continue;
        const lv = Math.log2(v) * 2.2, fr = fract(lv);
        if (fr > 0.16 && fr < 0.84) continue;
        const k = Math.round(lv);
        g.ch[i] = k >= 2 ? '#' : k >= 0 ? '=' : k >= -2 ? '-' : '.'; g.co[i] = C(clamp(0.35 + k * 0.12, 0.2, 1));
      }
      return;
    }
    if (mode === 'mercury') {
      const R = ' .:-=+*#%@';
      for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
        const v = V[i];
        if (v < 0.7) { if (v > 0.45) { g.ch[i] = '.'; g.co[i] = C(0.2); } continue; }
        const gx = (x + 1 < cols ? V[i + 1] : v) - (x > 0 ? V[i - 1] : v), gy = ((y + 1 < rows ? V[i + cols] : v) - (y > 0 ? V[i - cols] : v)) / aspect;
        const nl = Math.hypot(gx, gy, 0.35), nx = -gx / nl, ny = -gy / nl, nz = 0.35 / nl;
        const lum = clamp(nx * -0.5 + ny * -0.6 + nz * 0.62, 0, 1), spec = Math.pow(lum, 18), e = clamp(0.15 + lum * 0.6 + spec * 0.6, 0, 1);
        g.ch[i] = spec > 0.5 ? '@' : R[Math.max(1, Math.min(9, (e * 10) | 0))]; g.co[i] = C(e);
      }
      return;
    }
    for (let i = 0; i < g.n; i++) {
      const v = V[i];
      if (v < 0.35) continue;
      const e = v >= 1 ? clamp(0.7 + (v - 1) * 0.15, 0, 1) : ((v - 0.35) / 0.65) * 0.55;
      g.ch[i] = RAMP10[Math.min(9, (e * 10) | 0)]; g.co[i] = C(e);
    }
    if (lamp) {
      const glass = C(0.3), metal = C(0.22);
      for (let y = Math.floor(ly0); y <= ly1; y++) { const w = hw(y); g.set(lcx - w - 1, y, '(', glass); g.set(lcx + w, y, ')', glass); }
      const capW = hw(ly0) * 0.7, baseW = hw(ly1);
      for (let r = 1; r <= Math.max(2, rows * 0.08); r++) { const w = capW * (1 - r * 0.06); for (let x = Math.ceil(lcx - w); x < lcx + w; x++) g.set(x, ly0 - r, r === 1 ? '▄' : '█', metal); }
      const bh = rows - 1 - ly1;
      for (let r = 1; r <= bh; r++) { const w = baseW * (0.85 - 0.25 * Math.sin((r / bh) * Math.PI)); for (let x = Math.ceil(lcx - w); x < lcx + w; x++) g.set(x, ly1 + r, '█', r === 1 ? C(0.45) : metal); }
      for (let x = 0; x < cols; x++) if (g.ch[(rows - 1) * cols + x] === ' ') g.set(x, rows - 1, '_', C(0.12));
    }
  } });

const ARROWS = '→↘↓↙←↖↑↗';
A({ id: 'flow', name: '流場粒子', cat: '幾何', theme: 'synth', hue: true, desc: '粒子沿著柏林雜訊流場留下彩色軌跡',
  params: { field: 'noise', decay: 1.6, life: [2, 8], dens: 10, speed: 10, add: 0.25, arrows: false, ink: false },
  variants: [
    { id: 'vortex', name: '渦旋場', theme: 'ocean', desc: '幾個移動漩渦牽引著粒子打轉', params: { field: 'vortex', speed: 13 } },
    { id: 'wind', name: '風場', theme: 'ice', hue: false, desc: '橫向吹拂、時強時弱的氣流線', params: { field: 'wind', speed: 20, decay: 2.4, dens: 8 } },
    { id: 'arrows', name: '向量箭頭', theme: 'neon', desc: '整面箭頭標出流向，粒子隨之漂流', params: { arrows: true, dens: 40, decay: 2.5 } },
    { id: 'ink', name: '墨水暈染', theme: 'paper', hue: false, desc: '墨滴在紙上順著流場暈開', params: { ink: true, decay: 0.45, dens: 22, speed: 6, add: 0.18, life: [3, 9] } },
  ],
  init(s, f) {
    const n = f.cols * f.rows, p = f.p;
    s.tr = new Float32Array(n); s.hu = new Float32Array(n);
    s.src = Array.from({ length: 4 }, () => ({ ph: rnd(0, TAU), fx: rnd(0.04, 0.09), fy: rnd(0.05, 0.1) }));
    s.mk = () => {
      if (p.ink) { const q = pick(s.src), t = s.t || 0; return { x: f.cols * (0.5 + 0.4 * Math.sin(t * q.fx + q.ph)) + gauss() * 2, y: f.rows * (0.5 + 0.38 * Math.sin(t * q.fy + q.ph * 2)) + gauss(), l: rnd(p.life[0], p.life[1]) }; }
      return { x: rnd(0, f.cols), y: rnd(0, f.rows), l: rnd(p.life[0], p.life[1]) };
    };
    s.p = Array.from({ length: clamp((n / p.dens) | 0, 60, 5000) }, s.mk);
  },
  ang(s, f, x, y) {
    const { cols, rows, aspect, t, p } = f, sc = 3 / cols;
    if (p.field === 'vortex') {
      let vx = 0, vy = 0;
      for (let k = 0; k < 4; k++) {
        const q = s.src[k], cx = cols * (0.5 + 0.35 * Math.sin(t * q.fx * 1.5 + q.ph)), cy = rows * (0.5 + 0.35 * Math.cos(t * q.fy * 1.5 + q.ph));
        const dx = x - cx, dy = (y - cy) * aspect, d2 = dx * dx + dy * dy + cols * 2, st = k & 1 ? 1 : -1;
        vx += (-dy * st) / d2; vy += (dx * st) / d2;
      }
      const a = Noise.n3(x * sc, y * aspect * sc, t * 0.05) * 2;
      return Math.atan2(vy * cols + Math.sin(a) * 0.15, vx * cols + Math.cos(a) * 0.15);
    }
    if (p.field === 'wind') return Noise.n3(x * sc * 0.6, y * aspect * sc * 1.4, t * 0.12) * 1.3 + Math.sin(t * 0.3) * 0.2;
    return Noise.n3(x * sc, y * aspect * sc, t * 0.06) * TAU * 1.5;
  },
  frame(s, f) {
    const { g, cols, rows, aspect, dt, t, C, H, p } = f, tr = s.tr, hu = s.hu, n = cols * rows, k = Math.exp(-dt * p.decay), sp = p.speed;
    s.t = t;
    for (let i = 0; i < n; i++) tr[i] *= k;
    for (const q of s.p) {
      const a = this.ang(s, f, q.x, q.y);
      q.x += Math.cos(a) * dt * sp; q.y += (Math.sin(a) * dt * sp) / aspect; q.l -= dt;
      if (q.l <= 0 || q.x < 0 || q.y < 0 || q.x >= cols || q.y >= rows) { Object.assign(q, s.mk()); continue; }
      const i = (q.y | 0) * cols + (q.x | 0);
      tr[i] = Math.min(1.2, tr[i] + p.add); hu[i] = a * 28 + t * 8;
    }
    if (p.arrows) {
      for (let y = 1; y < rows; y += 2) for (let x = 1; x < cols; x += 4) {
        const a = this.ang(s, f, x, y), ki = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
        g.set(x, y, ARROWS[ki], H(a * 57 + 200, 0.32));
      }
    }
    const R = ' .·:-=+*#%@';
    for (let i = 0; i < n; i++) {
      const v = tr[i];
      if (v < 0.1) continue;
      const e = Math.min(1, v);
      if (p.field === 'wind') { g.ch[i] = e > 0.6 ? '~' : e > 0.3 ? '-' : '.'; g.co[i] = C(0.2 + e * 0.8); continue; }
      g.ch[i] = R[Math.min(10, (e * 11) | 0)]; g.co[i] = p.ink ? C(0.15 + e * 0.85) : H(hu[i], 0.2 + e * 0.8);
    }
  } });

A({ id: 'life', name: '生命遊戲', cat: '生命', theme: 'ice', desc: '康威生命遊戲：細胞誕生、繁衍與消逝',
  params: { kind: 'life', B: [3], S: [2, 3], C: 3, dens: 0.28, reseed: 2.5, rate: 12, N: 14, center: false },
  variants: [
    { id: 'highlife', name: '高生命', theme: 'amber', desc: '複製子在空地上自我複製、留下軌跡', params: { kind: 'rep', B: [3, 6], reseed: 0, rate: 10 } },
    { id: 'daynight', name: '晝夜', theme: 'lavender', desc: '生與死對稱的晝夜規則，形成大塊領地', params: { B: [3, 6, 7, 8], S: [3, 4, 6, 7, 8], dens: 0.5, reseed: 4 } },
    { id: 'brain', name: '腦波', theme: 'cyber', desc: '三態腦波規則，脈衝不停四處竄流', params: { kind: 'gen', B: [2], S: [], C: 3, dens: 0.35, reseed: 0.6 } },
    { id: 'maze', name: '迷宮規則', theme: 'mint', desc: 'B3/S12345 規則從中心長出迷宮', params: { B: [3], S: [1, 2, 3, 4, 5], reseed: 0, rate: 20, center: true } },
    { id: 'cyclic', name: '循環自動機', theme: 'rainbow', hue: true, desc: '十四種狀態循環吞食，形成螺旋', params: { kind: 'cyclic', reseed: 0, rate: 9 } },
    { id: 'starburst', name: '星爆世代', theme: 'fire', desc: '多階段衰亡的世代規則，火花四濺', params: { kind: 'gen', B: [2], S: [3, 4, 5], C: 4, dens: 0.3, reseed: 1.2, rate: 14 } },
  ],
  init(s, f) {
    const p = f.p;
    s.W = Math.max(4, f.cols >> 1); s.Hh = f.rows;
    const n = s.W * s.Hh;
    s.a = new Uint8Array(n); s.b = new Uint8Array(n); s.age = new Uint16Array(n); s.dead = new Uint8Array(n);
    s.bm = 0; s.sm = 0;
    for (const k of p.B) s.bm |= 1 << k;
    for (const k of p.S) s.sm |= 1 << k;
    s.dmax = p.kind === 'rep' ? 16 : 4;
    if (p.kind === 'cyclic') {
      for (let i = 0; i < n; i++) s.a[i] = (Math.random() * p.N) | 0;
      // 每個狀態的顏色先調到差不多的明暗（藍色天生比黃綠暗），整片畫面換色時才不會閃爍刺眼
      s.cyc = [];
      for (let v = 0; v < p.N; v++) {
        const hue = (v * 360) / p.N;
        let lo = 0.05, hi = 0.7;
        for (let it = 0; it < 14; it++) { const l = (lo + hi) / 2, c = hsl2rgb(hue, 0.9, l), lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; if (lum < 0.3) lo = l; else hi = l; }
        s.cyc.push(f.H(hue, clamp(((lo + hi) / 2 - 0.05) / 0.65, 0.3, 0.75)));
      }
    } else if (p.kind === 'rep') {
      // 高生命（B36/S23）的複製子：空地上放幾個，看它們一代代複製
      s.repT = 0;
      for (let k = Math.max(3, Math.round(n / 900)); k > 0; k--) this.putRep(s);
    } else if (p.center) { const cx = s.W >> 1, cy = s.Hh >> 1; for (let y = -3; y <= 3; y++) for (let x = -5; x <= 5; x++) if (Math.random() < 0.5) s.a[(cy + y) * s.W + cx + x] = 1; }
    else for (let i = 0; i < n; i++) s.a[i] = Math.random() < p.dens ? 1 : 0;
    s.acc = 0; s.seedT = 0; s.still = 0;
  },
  putRep(s) {
    const R = ['..###', '.#..#', '#...#', '#..#.', '###..'], W = s.W, Hh = s.Hh, fx = Math.random() < 0.5, fy = Math.random() < 0.5;
    const px = rint(0, W - 1), py = rint(0, Hh - 1);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (R[fy ? 4 - y : y][fx ? 4 - x : x] === '#') s.a[((py + y) % Hh) * W + ((px + x) % W)] = 1;
  },
  step(s, p) {
    const a = s.a, b = s.b, W = s.W, Hh = s.Hh, kind = p.kind, bm = s.bm, sm = s.sm, Cn = p.C, N = p.N;
    let changes = 0;
    for (let y = 0; y < Hh; y++) {
      const ym = ((y - 1 + Hh) % Hh) * W, y0 = y * W, yp = ((y + 1) % Hh) * W;
      for (let x = 0; x < W; x++) {
        const xm = (x - 1 + W) % W, xp = (x + 1) % W, i = y0 + x, cur = a[i];
        let nx;
        if (kind === 'cyclic') {
          const nxt = (cur + 1) % N;
          nx = a[ym + x] === nxt || a[yp + x] === nxt || a[y0 + xm] === nxt || a[y0 + xp] === nxt ? nxt : cur;
        } else if (kind === 'gen') {
          const nb = (a[ym + xm] === 1) + (a[ym + x] === 1) + (a[ym + xp] === 1) + (a[y0 + xm] === 1) + (a[y0 + xp] === 1) + (a[yp + xm] === 1) + (a[yp + x] === 1) + (a[yp + xp] === 1);
          if (cur === 0) nx = (bm >> nb) & 1 ? 1 : 0;
          else if (cur === 1) nx = (sm >> nb) & 1 ? 1 : 2;
          else nx = cur + 1 >= Cn ? 0 : cur + 1;
        } else {
          const nb = a[ym + xm] + a[ym + x] + a[ym + xp] + a[y0 + xm] + a[y0 + xp] + a[yp + xm] + a[yp + x] + a[yp + xp];
          nx = cur ? (sm >> nb) & 1 : (bm >> nb) & 1;
          if (nx) { s.age[i] = cur ? Math.min(s.age[i] + 1, 999) : 0; s.dead[i] = 0; }
          else if (cur) s.dead[i] = 1;
          else if (s.dead[i] && s.dead[i] < s.dmax) s.dead[i]++;
        }
        if (nx !== cur) changes++;
        b[i] = nx;
      }
    }
    s.a = b; s.b = a;
    return changes;
  },
  frame(s, f) {
    const { g, dt, C, H, p } = f, W = s.W, Hh = s.Hh;
    s.acc = Math.min(s.acc + dt, 0.3); s.seedT += dt;
    if (p.reseed && s.seedT > p.reseed) {
      s.seedT = 0;
      const px = rint(0, W - 1), py = rint(0, Hh - 1);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) if (Math.random() < 0.45) s.a[((py + y) % Hh) * W + ((px + x) % W)] = 1;
    }
    while (s.acc >= 1 / p.rate) {
      s.acc -= 1 / p.rate;
      const ch = this.step(s, p);
      s.still = ch < Math.max(3, W * Hh * 0.0015) ? s.still + 1 / p.rate : 0;
      if (s.still > 2.5 && !p.reseed) { this.init(s, f); return; }
    }
    const a = s.a, kind = p.kind;
    if (kind === 'cyclic') {
      const cyc = s.cyc;
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const c = cyc[a[y * W + x]]; g.set(x * 2, y, '█', c); g.set(x * 2 + 1, y, '█', c); }
      return;
    }
    if (kind === 'rep') {
      // 活細胞畫成 []，死去的位置留下慢慢變淡的軌跡；太擠或全滅就重來，偶爾再丟一個新的複製子
      let live = 0;
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (a[i]) { live++; const c = C(0.75 + 0.25 / (1 + s.age[i] * 0.2)); g.set(x * 2, y, '[', c); g.set(x * 2 + 1, y, ']', c); }
        else if (s.dead[i] && s.dead[i] < s.dmax) { const d = s.dead[i], c = C(0.42 - d * 0.022), q = d < 4 ? ':' : d < 10 ? '·' : '.'; g.set(x * 2, y, q, c); g.set(x * 2 + 1, y, q, c); }
      }
      s.repT += dt;
      if (live > W * Hh * 0.22 || live === 0) { this.init(s, f); return; }
      if (s.repT > 7) { s.repT = 0; this.putRep(s); }
      return;
    }
    if (kind === 'gen') {
      const T = ['', '█', '▓', '▒', '░'];
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const v = a[y * W + x];
        if (!v) continue;
        const c = v === 1 ? C(1) : C(0.75 - (v - 1) * (0.5 / p.C)), chs = v === 1 ? '█' : T[Math.min(4, v + (p.C > 3 ? 0 : 1))];
        g.set(x * 2, y, chs, c); g.set(x * 2 + 1, y, chs, c);
      }
      return;
    }
    const T = ['', '▓', '▒', '░'];
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (a[i]) { const c = C(0.55 + 0.45 / (1 + s.age[i] * 0.12)); g.set(x * 2, y, '█', c); g.set(x * 2 + 1, y, '█', c); }
      else if (s.dead[i] && s.dead[i] < 4) { const d = s.dead[i], c = C(0.42 - d * 0.09); g.set(x * 2, y, T[d], c); g.set(x * 2 + 1, y, T[d], c); }
    }
  } });

// 細線迷宮的框線字：上 1、右 2、下 4、左 8
const BOX = [' ', '╵', '╶', '└', '╷', '│', '┌', '├', '╴', '┘', '─', '┴', '┐', '┤', '┬', '┼'];
A({ id: 'maze', name: '迷宮生成', cat: '演算法', theme: 'matrix', hue: true, desc: '自動挖出迷宮，再自動找出解答',
  params: { algo: 'dfs' },
  variants: [
    { id: 'prim', name: '普林生長', theme: 'ice', desc: '從起點像珊瑚一樣向外蔓生的迷宮', params: { algo: 'prim' } },
    { id: 'kruskal', name: '隨機合併', theme: 'amber', desc: '隨機拆牆、區塊逐漸連成一片', params: { algo: 'kruskal' } },
    { id: 'sidewinder', name: '逐列掃描', theme: 'mint', desc: '一列一列由上往下快速生成', params: { algo: 'sidewinder' } },
    { id: 'thin', name: '細線迷宮', theme: 'blueprint', desc: '框線字畫出的細牆迷宮與解答', params: { algo: 'thin' } },
    { id: 'walker', name: '摸牆探險', theme: 'gold', desc: '探險者用右手摸牆法走出迷宮', params: { algo: 'walker' } },
  ],
  init(s, f) {
    const algo = f.p.algo;
    if (algo === 'thin') return this.tinit(s, f);
    let GW = f.cols >> 1, GH = f.rows;
    if (GW % 2 === 0) GW--;
    if (GH % 2 === 0) GH--;
    s.GW = GW = Math.max(5, GW); s.GH = GH = Math.max(5, GH);
    s.m = new Uint8Array(GW * GH).fill(1);
    s.m[GW + 1] = 0; s.stack = [[1, 1]]; s.phase = 'gen'; s.acc = 0;
    s.ox = Math.floor((f.cols - GW * 2) / 2); s.oy = Math.floor((f.rows - GH) / 2);
    if (algo === 'prim') { s.fr = []; this.addFront(s, 1, 1); }
    if (algo === 'kruskal') {
      s.par = new Int32Array(GW * GH).map((_, i) => i);
      for (let y = 1; y < GH; y += 2) for (let x = 1; x < GW; x += 2) s.m[y * GW + x] = 0;
      s.walls = [];
      for (let y = 1; y < GH; y += 2) for (let x = 1; x < GW; x += 2) { if (x + 2 < GW) s.walls.push([x + 1, y, 1, 0]); if (y + 2 < GH) s.walls.push([x, y + 1, 0, 1]); }
      for (let i = s.walls.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [s.walls[i], s.walls[j]] = [s.walls[j], s.walls[i]]; }
      s.wi = 0;
    }
    if (algo === 'sidewinder') { s.sy = 1; s.sx = 1; s.run = []; }
    if (algo === 'walker') {
      while (s.stack.length) this.dfsStep(s);
      s.phase = 'walk'; s.pos = GW + 1; s.dir = 1; s.trail = new Float32Array(GW * GH); s.steps = 0;
    }
  },
  addFront(s, x, y) {
    const GW = s.GW, GH = s.GH, m = s.m;
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const nx = x + dx, ny = y + dy; if (nx > 0 && ny > 0 && nx < GW - 1 && ny < GH - 1 && m[ny * GW + nx] === 1) { m[ny * GW + nx] = 4; s.fr.push([nx, ny]); } }
  },
  dfsStep(s) {
    const GW = s.GW, GH = s.GH, m = s.m, [x, y] = s.stack[s.stack.length - 1], nb = [];
    if (x > 1 && m[y * GW + x - 2] === 1) nb.push([-2, 0]);
    if (x < GW - 2 && m[y * GW + x + 2] === 1) nb.push([2, 0]);
    if (y > 1 && m[(y - 2) * GW + x] === 1) nb.push([0, -2]);
    if (y < GH - 2 && m[(y + 2) * GW + x] === 1) nb.push([0, 2]);
    if (nb.length) { const [dx, dy] = pick(nb); m[(y + dy / 2) * GW + x + dx / 2] = 0; m[(y + dy) * GW + x + dx] = 0; s.stack.push([x + dx, y + dy]); }
    else s.stack.pop();
  },
  find(s, i) { while (s.par[i] !== i) { s.par[i] = s.par[s.par[i]]; i = s.par[i]; } return i; },
  genStep(s, algo) {
    const GW = s.GW, GH = s.GH, m = s.m;
    if (algo === 'dfs') { if (!s.stack.length) return false; this.dfsStep(s); return true; }
    if (algo === 'prim') {
      if (!s.fr.length) return false;
      const k = (Math.random() * s.fr.length) | 0, [x, y] = s.fr[k];
      s.fr[k] = s.fr[s.fr.length - 1]; s.fr.pop();
      const nb = [];
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const nx = x + dx, ny = y + dy; if (nx > 0 && ny > 0 && nx < GW - 1 && ny < GH - 1 && m[ny * GW + nx] === 0) nb.push([dx, dy]); }
      const [dx, dy] = pick(nb);
      m[y * GW + x] = 0; m[(y + dy / 2) * GW + x + dx / 2] = 0;
      s.head = [x, y];
      this.addFront(s, x, y);
      return true;
    }
    if (algo === 'kruskal') {
      if (s.wi >= s.walls.length) return false;
      const [x, y, dx, dy] = s.walls[s.wi++], a = this.find(s, (y - dy) * GW + x - dx), b = this.find(s, (y + dy) * GW + x + dx);
      if (a !== b) { s.par[a] = b; m[y * GW + x] = 0; s.head = [x, y]; }
      return true;
    }
    if (algo === 'sidewinder') {
      if (s.sy >= GH - 1) return false;
      const x = s.sx, y = s.sy;
      s.run.push(x); s.head = [x, y];
      const east = x + 2 < GW - 1 && (y === 1 || Math.random() < 0.55);
      if (east) m[y * GW + x + 1] = 0;
      else { if (y > 1) { const c = pick(s.run); m[(y - 1) * GW + c] = 0; } s.run = []; }
      s.sx += 2;
      if (s.sx >= GW - 1) { s.sx = 1; s.sy += 2; s.run = []; }
      return true;
    }
    return false;
  },
  frame(s, f) {
    const { g, dt, C, H, p } = f, GW = s.GW, GH = s.GH, m = s.m, algo = p.algo;
    if (algo === 'thin') return this.tframe(s, f);
    const cells = ((GW - 1) / 2) * ((GH - 1) / 2);
    s.acc += dt;
    if (s.phase === 'gen') {
      if (algo === 'sidewinder') for (let y = 1; y < GH; y += 2) for (let x = 1; x < GW; x += 2) if (y < s.sy || (y === s.sy && x < s.sx)) m[y * GW + x] = 0;
      let steps = Math.floor((s.acc * cells * (algo === 'kruskal' ? 2 : 1)) / 7);
      if (steps > 0) s.acc = 0;
      let more = true;
      while (steps-- > 0 && (more = this.genStep(s, algo)));
      if (!more || (algo === 'dfs' && !s.stack.length)) {
        if (algo === 'sidewinder') for (let y = 1; y < GH; y += 2) for (let x = 1; x < GW; x += 2) m[y * GW + x] = 0;
        s.phase = 'solve'; s.q = [GW + 1]; s.qh = 0; s.prev = new Int32Array(GW * GH).fill(-1); s.prev[GW + 1] = GW + 1; s.acc = 0; s.head = null;
      }
    } else if (s.phase === 'solve') {
      let steps = Math.floor((s.acc * cells) / 4);
      if (steps > 0) s.acc = 0;
      const goal = (GH - 2) * GW + (GW - 2);
      while (steps-- > 0 && s.qh < s.q.length) {
        const i = s.q[s.qh++];
        if (m[i] === 0) m[i] = 2;
        if (i === goal) { s.phase = 'path'; s.cur = goal; break; }
        for (const j of [i + 1, i - 1, i + GW, i - GW]) if (m[j] !== 1 && s.prev[j] < 0) { s.prev[j] = i; s.q.push(j); }
      }
      if (s.phase === 'solve' && s.qh >= s.q.length) { s.phase = 'hold'; s.hold = 2; }
    } else if (s.phase === 'path') {
      let steps = Math.floor(s.acc * 60);
      if (steps > 0) s.acc = 0;
      while (steps-- > 0) { m[s.cur] = 3; if (s.cur === GW + 1) { s.phase = 'hold'; s.hold = 4; break; } s.cur = s.prev[s.cur]; }
    } else if (s.phase === 'walk') {
      const tr = s.trail, k = Math.exp(-dt * 0.12);
      for (let i = 0; i < tr.length; i++) if (tr[i] > 0.01) tr[i] *= k;
      let steps = Math.floor(s.acc * Math.max(25, cells / 18));
      if (steps > 0) s.acc = 0;
      const D = [-GW, 1, GW, -1], goal = (GH - 2) * GW + (GW - 2);
      while (steps-- > 0) {
        tr[s.pos] = 1;
        if (s.pos === goal) { s.phase = 'hold'; s.hold = 3; break; }
        for (const turn of [1, 0, 3, 2]) { const d = (s.dir + turn) % 4; if (m[s.pos + D[d]] !== 1) { s.dir = d; s.pos += D[d]; break; } }
      }
    } else {
      s.hold -= dt;
      if (s.hold <= 0) { this.init(s, f); return; }
    }
    const head = s.phase === 'gen' ? (algo === 'dfs' ? (s.stack.length ? s.stack[s.stack.length - 1] : null) : s.head) : null;
    const wall = C(0.3), seen = H(200, 0.4), path = H(45, 0.9), hi = C(1), fr = H(120, 0.55);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x, v = m[i], gx = s.ox + x * 2, gy = s.oy + y;
      if (v === 1) { g.set(gx, gy, '█', wall); g.set(gx + 1, gy, '█', wall); }
      else if (v === 4) { g.set(gx, gy, '▒', fr); g.set(gx + 1, gy, '▒', fr); }
      else if (v === 2) g.set(gx, gy, '·', seen);
      else if (v === 3) { g.set(gx, gy, '█', path); g.set(gx + 1, gy, '█', path); }
      else if (s.trail && s.trail[i] > 0.02) { const e = s.trail[i], c = H(40 - e * 30, 0.25 + e * 0.6); g.set(gx, gy, e > 0.5 ? '▓' : '░', c); g.set(gx + 1, gy, e > 0.5 ? '▓' : '░', c); }
    }
    if (s.phase === 'walk' || (s.phase === 'hold' && s.trail)) { const x = s.pos % GW, y = (s.pos / GW) | 0; g.set(s.ox + x * 2, s.oy + y, '◆', hi); g.set(s.ox + x * 2 + 1, s.oy + y, ' ', hi); }
    if (head) { g.set(s.ox + head[0] * 2, s.oy + head[1], '█', hi); g.set(s.ox + head[0] * 2 + 1, s.oy + head[1], '█', hi); }
  },
  tinit(s, f) {
    const w = Math.max(3, Math.floor((f.cols - 1) / 4)), h = Math.max(3, Math.floor((f.rows - 1) / 2));
    Object.assign(s, { w, h, ox: Math.floor((f.cols - (w * 4 + 1)) / 2), oy: Math.floor((f.rows - (h * 2 + 1)) / 2), E: new Uint8Array(w * h).fill(1), S: new Uint8Array(w * h).fill(1), vis: new Uint8Array(w * h), st: [0], phase: 'gen', acc: 0, sol: null, mark: new Uint8Array(w * h) });
    s.vis[0] = 1;
  },
  tframe(s, f) {
    const { g, dt, C, H } = f, w = s.w, h = s.h, n = w * h;
    s.acc += dt;
    if (s.phase === 'gen') {
      let steps = Math.floor((s.acc * n) / 6); if (steps > 0) s.acc = 0;
      while (steps-- > 0 && s.st.length) {
        const c = s.st[s.st.length - 1], x = c % w, y = (c / w) | 0, nb = [];
        if (x > 0 && !s.vis[c - 1]) nb.push(c - 1); if (x < w - 1 && !s.vis[c + 1]) nb.push(c + 1);
        if (y > 0 && !s.vis[c - w]) nb.push(c - w); if (y < h - 1 && !s.vis[c + w]) nb.push(c + w);
        if (!nb.length) { s.st.pop(); continue; }
        const d = pick(nb);
        if (d === c + 1) s.E[c] = 0; else if (d === c - 1) s.E[d] = 0; else if (d === c + w) s.S[c] = 0; else s.S[d] = 0;
        s.vis[d] = 1; s.st.push(d);
      }
      if (!s.st.length) {
        const prev = new Int32Array(n).fill(-1), q = [0]; prev[0] = 0;
        for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % w; for (const [d, ok] of [[c + 1, x < w - 1 && !s.E[c]], [c - 1, x > 0 && !s.E[c - 1]], [c + w, c + w < n && !s.S[c]], [c - w, c - w >= 0 && !s.S[c - w]]]) if (ok && prev[d] < 0) { prev[d] = c; q.push(d); } }
        s.sol = []; for (let c = n - 1; c !== 0; c = prev[c]) s.sol.push(c); s.sol.push(0); s.sol.reverse(); s.si = 0; s.phase = 'path';
      }
    } else if (s.phase === 'path') {
      let steps = Math.floor(s.acc * 40); if (steps > 0) s.acc = 0;
      while (steps-- > 0 && s.si < s.sol.length) s.mark[s.sol[s.si++]] = 1;
      if (s.si >= s.sol.length) { s.phase = 'hold'; s.hold = 4; }
    } else { s.hold -= dt; if (s.hold <= 0) { this.tinit(s, f); return; } }
    const wallC = C(0.75), dim = C(0.3);
    const hw = (x, y) => y === 0 || y === h || (x >= 0 && x < w && (y === 0 || s.S[(y - 1) * w + x])), vw = (x, y) => x === 0 || x === w || (y >= 0 && y < h && s.E[y * w + x - 1]);
    for (let Y = 0; Y <= h; Y++) for (let X = 0; X <= w; X++) {
      const up = Y > 0 && vw(X, Y - 1), dn = Y < h && vw(X, Y), lf = X > 0 && hw(X - 1, Y), rt = X < w && hw(X, Y);
      const gx = s.ox + X * 4, gy = s.oy + Y * 2, vis = (X < w && Y < h && s.vis[Y * w + X]) || s.phase !== 'gen';
      g.set(gx, gy, BOX[(up ? 1 : 0) | (rt ? 2 : 0) | (dn ? 4 : 0) | (lf ? 8 : 0)], vis ? wallC : dim);
      if (rt) for (let k = 1; k < 4; k++) g.set(gx + k, gy, '─', vis ? wallC : dim);
      if (dn) g.set(gx, gy + 1, '│', vis ? wallC : dim);
    }
    for (let c = 0; c < n; c++) {
      const x = c % w, y = (c / w) | 0, gx = s.ox + x * 4 + 2, gy = s.oy + y * 2 + 1;
      if (s.mark[c]) { g.set(gx, gy, '●', H(45, 0.95)); if (x < w - 1 && s.mark[c + 1] && !s.E[c]) for (let k = 1; k < 4; k++) g.set(gx + k, gy, '·', H(45, 0.7)); }
      else if (!s.vis[c]) g.set(gx, gy, '·', C(0.15));
    }
    if (s.phase === 'gen' && s.st.length) { const c = s.st[s.st.length - 1]; g.set(s.ox + (c % w) * 4 + 2, s.oy + ((c / w) | 0) * 2 + 1, '◆', C(1)); }
  } });

function flood(occ, W, H, start, lim = 2500) {
  const seen = new Uint8Array(W * H), q = [start];
  seen[start] = 1;
  for (let qi = 0; qi < q.length && q.length < lim; qi++) {
    const c = q[qi], x = c % W;
    for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W]) if (j >= 0 && j < W * H && !occ[j] && !seen[j]) { seen[j] = 1; q.push(j); }
  }
  return q.length;
}
A({ id: 'snake', name: 'AI 貪食蛇', cat: '遊戲', theme: 'matrix', hue: true, desc: '自己玩的貪食蛇，看牠能長到多長',
  // board: 0 = 原版的細格子（每格 2×1 字、鋪滿全畫面、沒有外框）；其他數字 = 縱向大約幾格的大格子棋盤
  params: { snakes: 1, foods: 1, walls: false, ham: false, board: 0, frame: false, dots: false, retro: false, rainbow: false },
  variants: [
    { id: 'duel', name: '雙蛇對決', theme: 'cyber', desc: '兩條 AI 蛇搶食，誰會先撞牆', params: { snakes: 2, foods: 3, board: 34, frame: true, dots: true } },
    { id: 'feast', name: '盛宴', theme: 'rainbow', desc: '滿地食物，彩虹蛇一路狂吃變長', params: { foods: 9, rainbow: true, board: 34, frame: true, dots: true } },
    { id: 'ham', name: '完美路線', theme: 'mint', desc: '沿著哈密頓迴路抄捷徑，越長越滿', params: { ham: true, board: 22, frame: true, dots: true } },
    { id: 'walls', name: '障礙關卡', theme: 'amber', desc: '在障礙物之間穿梭覓食的蛇', params: { walls: true, board: 34, frame: true, dots: true } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f;
    if (p.board > 0) {
      s.ch = Math.max(1, Math.floor((rows - 2) / p.board)); s.cw = Math.max(1, Math.round(s.ch * aspect));
      s.W = Math.max(8, Math.floor((cols - 2) / s.cw)); s.Hh = Math.max(6, Math.floor((rows - 3) / s.ch));
    } else { s.ch = 1; s.cw = 2; s.W = Math.max(8, cols >> 1); s.Hh = Math.max(6, rows - 1); }
    if (p.ham && s.Hh % 2) s.Hh--;
    if (p.ham && s.W % 2) s.W--;
    const W = s.W, Hh = s.Hh, N = W * Hh;
    s.ox = Math.floor((cols - W * s.cw) / 2); s.oy = p.board > 0 ? 1 + Math.floor((rows - 1 - Hh * s.ch) / 2) : 1;
    s.fine = !(p.board > 0);
    s.wall = new Uint8Array(N); s.occ = new Uint8Array(N); s.prev = new Int32Array(N);
    if (p.walls) {
      for (let tries = 0; tries < 20; tries++) {
        s.wall.fill(0);
        for (let k = Math.round(N / 90); k > 0; k--) {
          const horiz = Math.random() < 0.5, len = rint(3, Math.max(4, (horiz ? W : Hh) * 0.3)), x0 = rint(1, W - 2), y0 = rint(1, Hh - 2);
          for (let q = 0; q < len; q++) { const x = horiz ? x0 + q : x0, y = horiz ? y0 : y0 + q; if (x < W - 1 && y < Hh - 1) s.wall[y * W + x] = 1; }
        }
        const cx = W >> 1, cy = Hh >> 1;
        for (let d = -6; d <= 1; d++) s.wall[cy * W + cx + d] = 0;
        const free = N - s.wall.reduce((a, b) => a + b, 0);
        if (flood(s.wall, W, Hh, cy * W + cx, N + 1) >= free) break;
      }
    }
    if (p.ham) {
      s.ord = new Int32Array(N);
      let k = 0;
      for (let y = 0; y < Hh; y++) for (let i = 1; i < W; i++) { const x = y % 2 === 0 ? i : W - i; s.ord[y * W + x] = k++; }
      for (let y = Hh - 1; y >= 0; y--) s.ord[y * W] = k++;
      s.at = new Int32Array(N);
      for (let c = 0; c < N; c++) s.at[s.ord[c]] = c;
    }
    s.hi = s.hi || 0;
    s.sn = [];
    for (let k = 0; k < p.snakes; k++) s.sn.push(this.spawn(s, k, p.snakes));
    s.food = [];
    for (let k = 0; k < p.foods; k++) this.place(s);
    s.acc = 0; s.won = 0;
  },
  spawn(s, k, n) {
    const W = s.W, Hh = s.Hh, cy = n > 1 ? Math.floor(Hh * (k + 1) / (n + 1)) : Hh >> 1, cx = W >> 1;
    if (s.ord) { const c0 = s.at[2], c1 = s.at[1], c2 = s.at[0]; return { body: [[c0 % W, (c0 / W) | 0], [c1 % W, (c1 / W) | 0], [c2 % W, (c2 / W) | 0]], dead: 0, score: 0, hue: 110 }; }
    // 細格子：起始長度跟著棋盤大小調整（小畫面 3 節，和原版一樣；5K 全螢幕時不會小到看不見）
    const L0 = s.fine ? clamp(Math.round((W * Hh) / 290), 3, cx - 1) : 6;
    return { body: Array.from({ length: L0 }, (_, d) => [cx - d, cy]), dead: 0, score: 0, hue: k ? 300 : 110 };
  },
  fillOcc(s) {
    const occ = s.occ, W = s.W;
    occ.set(s.wall);
    for (const sn of s.sn) if (!sn.dead) for (const b of sn.body) occ[b[1] * W + b[0]] = 1;
  },
  place(s) {
    this.fillOcc(s);
    for (const fd of s.food) s.occ[fd[1] * s.W + fd[0]] = 1;
    for (let k = 0; k < 800; k++) { const x = rint(0, s.W - 1), y = rint(0, s.Hh - 1); if (!s.occ[y * s.W + x]) { s.food.push([x, y]); return; } }
  },
  step(s, sn, p) {
    const W = s.W, Hh = s.Hh, N = W * Hh, occ = s.occ, head = sn.body[0], hi = head[1] * W + head[0];
    this.fillOcc(s);
    const tail = sn.body[sn.body.length - 1];
    occ[tail[1] * W + tail[0]] = 0;
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let move = null;
    if (s.ord) {
      const L = sn.body.length, pos = c => s.ord[c], dist = (a, b) => (pos(b) - pos(a) + N) % N, ti = tail[1] * W + tail[0];
      let target = s.food.length ? s.food[0][1] * W + s.food[0][0] : -1, best = -1;
      const nextC = s.at[(pos(hi) + 1) % N];
      for (const [dx, dy] of D) {
        const nx = head[0] + dx, ny = head[1] + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= Hh) continue;
        const c = ny * W + nx;
        if (occ[c]) continue;
        const dc = dist(hi, c);
        if (c === nextC) { if (best < 0) { best = dc; move = [dx, dy]; } continue; }
        if (L > N * 0.55 || target < 0) continue;
        if (dc < dist(hi, ti) - 4 && dc <= dist(hi, target) && dc > best) { best = dc; move = [dx, dy]; }
      }
    } else if (s.food.length) {
      const prev = s.prev; prev.fill(-1);
      const q = [hi], goal = new Set(s.food.map(fd => fd[1] * W + fd[0]));
      prev[hi] = hi;
      let found = -1;
      for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi];
        if (goal.has(c)) { found = c; break; }
        const cx = c % W, cy = (c / W) | 0;
        for (const [dx, dy] of D) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= Hh) continue;
          const j = ny * W + nx;
          if (occ[j] || prev[j] >= 0) continue;
          prev[j] = c; q.push(j);
        }
      }
      if (found >= 0 && found !== hi) {
        let c = found;
        while (prev[c] !== hi) c = prev[c];
        const after = new Uint8Array(occ); after[c] = 1;
        if (flood(after, W, Hh, c) > Math.min(sn.body.length + 2, 60)) move = [(c % W) - head[0], ((c / W) | 0) - head[1]];
      }
    }
    if (!move) {
      let best = -1;
      for (const [dx, dy] of D) {
        const nx = head[0] + dx, ny = head[1] + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= Hh || occ[ny * W + nx]) continue;
        const a = flood(occ, W, Hh, ny * W + nx);
        if (a > best) { best = a; move = [dx, dy]; }
      }
    }
    if (!move) { sn.dead = 1.5; s.hi = Math.max(s.hi, sn.score); return; }
    const nh = [head[0] + move[0], head[1] + move[1]];
    sn.body.unshift(nh);
    const fi = s.food.findIndex(fd => fd[0] === nh[0] && fd[1] === nh[1]);
    if (fi >= 0) { sn.score++; s.food.splice(fi, 1); this.place(s); } else sn.body.pop();
    if (s.ord && sn.body.length >= N * 0.7) s.won = 3;
  },
  cell(f, s, x, y, ch, col, inset) {
    const { g } = f, cw = s.cw, chh = s.ch, gx = s.ox + x * cw, gy = s.oy + y * chh;
    const ix = inset && cw >= 4 ? 1 : 0;
    for (let r = 0; r < chh; r++) for (let q = ix; q < cw - ix; q++) g.set(gx + q, gy + r, ch, col);
  },
  frame(s, f) {
    const { g, cols, dt, t, C, H, p } = f, W = s.W, Hh = s.Hh, cw = s.cw, chh = s.ch;
    if (s.won > 0) { s.won -= dt; if (s.won <= 0) { this.init(s, f); return; } }
    else {
      for (const sn of s.sn) if (sn.dead > 0) { sn.dead -= dt; if (sn.dead <= 0) { if (s.sn.length === 1) { this.init(s, f); return; } Object.assign(sn, this.spawn(s, s.sn.indexOf(sn), s.sn.length)); } }
      s.acc = Math.min(s.acc + dt, 0.5);
      const L = Math.max(...s.sn.map(sn => sn.body.length)), stepT = 1 / (s.ord ? clamp(30 + L * 0.6, 30, 220) : s.fine ? clamp(12 + L * 0.05, 12, 30) : clamp(14 + L * 0.06, 14, 32));
      while (s.acc >= stepT) { s.acc -= stepT; for (const sn of s.sn) if (sn.dead <= 0) this.step(s, sn, p); }
    }
    if (p.frame) {
      const x0 = s.ox - 1, x1 = s.ox + W * cw, y0 = s.oy - 1, y1 = s.oy + Hh * chh, fc = C(p.retro ? 0.75 : 0.3);
      for (let x = x0 + 1; x < x1; x++) { g.set(x, y0, '─', fc); g.set(x, y1, '─', fc); }
      for (let y = y0 + 1; y < y1; y++) { g.set(x0, y, '│', fc); g.set(x1, y, '│', fc); }
      g.set(x0, y0, '┌', fc); g.set(x1, y0, '┐', fc); g.set(x0, y1, '└', fc); g.set(x1, y1, '┘', fc);
    }
    if (p.retro) for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) this.cell(f, s, x, y, '░', C(0.05), true);
    else if (p.dots) { const dc = C(0.13); for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) g.set(s.ox + x * cw + (cw >> 1), s.oy + y * chh + (chh >> 1), '·', dc); }
    for (let i = 0; i < W * Hh; i++) if (s.wall[i]) this.cell(f, s, i % W, (i / W) | 0, '▓', C(0.38), false);
    const txt = s.sn.length > 1 ? s.sn.map((sn, k) => `P${k + 1} ${String(sn.score).padStart(3, '0')}`).join('   ') + `   HI ${String(s.hi).padStart(3, '0')}`
      : `SCORE ${String(s.sn[0].score).padStart(3, '0')}   HI ${String(Math.max(s.hi, s.sn[0].score)).padStart(3, '0')}   LEN ${s.sn[0].body.length}`;
    g.text(2, 0, txt, C(0.7));
    for (const fd of s.food) {
      const c = p.retro ? C(0.9) : s.fine ? H(0, 1) : H(0, 0.9 + 0.1 * Math.sin(t * 6));
      if (cw >= 4) this.cell(f, s, fd[0], fd[1], '█', c, true);
      else { g.set(s.ox + fd[0] * cw, s.oy + fd[1] * chh, '<', c); g.set(s.ox + fd[0] * cw + 1, s.oy + fd[1] * chh, '>', c); }
    }
    for (const sn of s.sn) {
      if (sn.dead > 0 && ((sn.dead * 8) | 0) % 2 === 0) continue;
      const L = sn.body.length;
      for (let k = L - 1; k >= 0; k--) {
        const [x, y] = sn.body[k];
        const c = k === 0 ? C(1) : p.retro ? C(0.75) : p.rainbow ? H(k * 9 - t * 60, 0.8) : H(sn.hue + k * 3, 0.85 - Math.min(0.45, (k / L) * 0.45));
        this.cell(f, s, x, y, p.retro ? '▓' : '█', c, p.retro);
      }
      if (cw >= 4 && chh >= 2 && sn.dead <= 0) {
        const [hx, hy] = sn.body[0], [nx, ny] = sn.body[1] || [hx - 1, hy], dx = hx - nx, dy = hy - ny, gx = s.ox + hx * cw, gy = s.oy + hy * chh, ec = p.retro ? C(0.1) : C(0.05);
        if (dx) { const ex = dx > 0 ? gx + cw - 2 : gx + 1; g.set(ex, gy, '•', ec); g.set(ex, gy + chh - 1, '•', ec); }
        else { const ey = dy > 0 ? gy + chh - 1 : gy; g.set(gx + 1, ey, '•', ec); g.set(gx + cw - 2, ey, '•', ec); }
      }
    }
    void cols;
  } });

const PIPE_SETS = { heavy: '┃━┏┓┗┛', thin: '│─╭╮╰╯', double: '║═╔╗╚╝' };
function pipeChar(a, b, set = PIPE_SETS.heavy) {
  const k = (1 << a) | (1 << b);
  return k === 5 ? set[0] : k === 10 ? set[1] : k === 6 ? set[2] : k === 12 ? set[3] : k === 3 ? set[4] : k === 9 ? set[5] : set[1];
}
// 八方向：0 上、1 右上、2 右、3 右下、4 下、5 左下、6 左、7 左上
const D8X = [0, 1, 1, 1, 0, -1, -1, -1], D8Y = [-1, -1, 0, 1, 1, 1, 0, -1], D8C = '|/-\\|/-\\', D8M = '┃╱━╲┃╱━╲';
A({ id: 'pipes', name: '管線迷城', cat: '經典', theme: 'ice', hue: true, keep: true, desc: '經典螢幕保護程式：不斷延伸的彩色管線',
  params: { style: 'heavy', per: 3500, turn: 0.12, speed: 45 },
  variants: [
    { id: 'thin', name: '細圓管', theme: 'mint', desc: '細線圓角的管線，數量更多更密', params: { style: 'thin', per: 1400, speed: 70, turn: 0.18 } },
    { id: 'double', name: '雙線管', theme: 'gold', hue: false, desc: '金色雙線管路交錯盤繞', params: { style: 'double', per: 2600, turn: 0.09 } },
    { id: 'circuit', name: '電路板', theme: 'matrix', hue: false, desc: '晶片之間延伸的走線與焊點', params: { style: 'circuit', per: 1800, speed: 55 } },
    { id: 'metro', name: '捷運路網', theme: 'paper', desc: '彩色路線與車站慢慢畫出路網圖', params: { style: 'metro', per: 3200, speed: 32 } },
    { id: 'vine', name: '藤蔓', theme: 'forest', hue: false, desc: '藤蔓蜿蜒生長、長出葉子與花', params: { style: 'vine', per: 1000, speed: 26 } },
  ],
  init(s, f) {
    const { cols, rows, p, g } = f, st = p.style;
    g.clear();
    s.n = 0; s.acc = 0;
    const eight = st === 'circuit' || st === 'metro';
    s.mk = () => {
      if (st === 'vine') return { x: rint(0, cols - 1), y: rows - 1, d: 0, hue: 0, b: rnd(0.45, 0.85), len: rint(rows * 0.6, rows * 1.6), k: 0 };
      if (st === 'metro') return { x: rint(4, cols - 5), y: rint(2, rows - 3), d: pick([0, 2, 4, 6, 1, 3]), hue: pick([0, 30, 50, 130, 200, 280, 320]), b: 0.6, len: rint(cols * 0.5, cols * 1.5), k: 0, ex: rint(8, 20) };
      return { x: rint(0, cols - 1), y: rint(0, rows - 1), d: eight ? pick([0, 2, 4, 6]) : rint(0, 3), hue: rnd(0, 360), b: rnd(0.55, 1), len: rint(20, 120), k: 0 };
    };
    s.p = Array.from({ length: clamp(Math.round((cols * rows) / p.per), 2, st === 'thin' ? 24 : st === 'heavy' ? 8 : 12) }, s.mk);
    if (st === 'circuit') {
      s.chips = [];
      for (let k = clamp(Math.round(cols * rows / 5000), 2, 7); k > 0; k--) {
        const w = rint(6, 14), h = rint(2, 4), x = rint(2, cols - w - 3), y = rint(2, rows - h - 3);
        s.chips.push({ x, y, w, h });
        for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) g.set(x + q, y + r, '█', f.C(0.25));
        for (let q = 1; q < w - 1; q += 2) { g.set(x + q, y - 1, '┴', f.C(0.6)); g.set(x + q, y + h, '┬', f.C(0.6)); }
      }
      for (const q of s.p) { const c = pick(s.chips), top = Math.random() < 0.5, px = c.x + 1 + 2 * rint(0, Math.max(0, ((c.w - 3) / 2) | 0)); Object.assign(q, { x: px, y: top ? c.y - 2 : c.y + c.h + 1, d: top ? 0 : 4 }); }
    }
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, C, H, p } = f, st = p.style, DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    s.acc = Math.min(s.acc + dt, 0.25);
    const set = PIPE_SETS[st];
    while (s.acc >= 1 / p.speed) {
      s.acc -= 1 / p.speed;
      for (let k = 0; k < s.p.length; k++) {
        const q = s.p[k];
        if (set) {
          let nd = q.d;
          if (Math.random() < p.turn) nd = (q.d + (Math.random() < 0.5 ? 1 : 3)) % 4;
          g.set(q.x, q.y, pipeChar((q.d + 2) % 4, nd, set), H(q.hue, q.b));
          q.d = nd; q.x += DX[nd]; q.y += DY[nd]; s.n++;
          if (q.x < 0 || q.y < 0 || q.x >= cols || q.y >= rows) Object.assign(q, s.mk());
          continue;
        }
        q.k++;
        if (st === 'circuit') {
          let nd = q.d;
          if (Math.random() < 0.08) nd = (q.d + (Math.random() < 0.5 ? 1 : 7)) % 8;
          else if (q.d % 2 && Math.random() < 0.25) nd = (q.d + (Math.random() < 0.5 ? 1 : 7)) % 8;
          const nx = q.x + D8X[nd], ny = q.y + D8Y[nd], blocked = nx < 0 || ny < 0 || nx >= cols || ny >= rows || g.ch[ny * cols + nx] !== ' ';
          if (blocked || q.k > q.len) { g.set(q.x, q.y, 'o', C(0.95)); s.p[k] = s.mk(); s.p[k].x = rint(1, cols - 2); s.p[k].y = rint(1, rows - 2); if (g.ch[s.p[k].y * cols + s.p[k].x] === ' ') g.set(s.p[k].x, s.p[k].y, 'o', C(0.95)); continue; }
          g.set(nx, ny, Math.random() < 0.03 ? '•' : D8C[nd], C(0.45 + 0.2 * q.b));
          q.d = nd; q.x = nx; q.y = ny; s.n++;
        } else if (st === 'metro') {
          let nd = q.d;
          if (q.k % q.ex === 0 && Math.random() < 0.5) nd = (q.d + (Math.random() < 0.5 ? 1 : 7)) % 8;
          let nx = q.x + D8X[nd], ny = q.y + D8Y[nd];
          if (nx < 2 || ny < 1 || nx >= cols - 2 || ny >= rows - 1) { nd = (nd + 2 + 4 * (Math.random() < 0.5 ? 1 : 0)) % 8; nx = q.x + D8X[nd]; ny = q.y + D8Y[nd]; if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1) { s.p[k] = s.mk(); continue; } }
          const cur = g.ch[ny * cols + nx];
          g.set(nx, ny, cur !== ' ' && cur !== D8M[nd] ? '◆' : D8M[nd], cur !== ' ' && cur !== D8M[nd] ? C(0.9) : H(q.hue, 0.42));
          if (q.k % 16 === 0) g.set(nx, ny, '●', H(q.hue, 0.28));
          q.d = nd; q.x = nx; q.y = ny; s.n++;
          if (q.k > q.len) { g.set(q.x, q.y, '●', C(0.95)); s.p[k] = s.mk(); }
        } else {
          let nd = q.d;
          const r = Math.random();
          if (r < 0.3) nd = (q.d + 1) % 8; else if (r < 0.6) nd = (q.d + 7) % 8;
          if (nd === 3 || nd === 4 || nd === 5) nd = q.d === 2 || q.d === 6 ? 0 : q.d;
          const nx = q.x + D8X[nd], ny = q.y + D8Y[nd];
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || q.k > q.len) {
            g.set(q.x, q.y, pick(['*', '@', 'o']), H(pick([320, 50, 0, 280]), 0.85));
            s.p[k] = s.mk(); continue;
          }
          g.set(nx, ny, D8C[nd], C(0.35 + 0.25 * q.b));
          if (Math.random() < 0.4) { const side = Math.random() < 0.5 ? -1 : 1; if (g.ch[ny * cols + clamp(nx + side, 0, cols - 1)] === ' ') g.set(nx + side, ny, pick(['&', '%', '&', '*', '~']), C(0.5 + 0.4 * Math.random())); }
          if (Math.random() < 0.02 && s.p.length < 16) s.p.push({ x: nx, y: ny, d: Math.random() < 0.5 ? 7 : 1, hue: 0, b: q.b * 0.85, len: q.len * 0.4, k: 0 });
          q.d = nd; q.x = nx; q.y = ny; s.n++;
        }
      }
      if (s.n > cols * rows * (set ? 0.9 : st === 'vine' ? 0.45 : st === 'metro' ? 0.18 : 0.4)) { this.init(s, f); return; }
    }
    void t;
  } });

A({ id: 'radar', name: '雷達掃描', cat: '科技', theme: 'matrix', desc: '軍事風格的雷達掃描與目標追蹤',
  params: { mode: 'sweep' },
  variants: [
    { id: 'sonar', name: '聲納', theme: 'ocean', desc: '聲波一圈圈擴散，碰到目標才亮起', params: { mode: 'sonar' } },
    { id: 'weather', name: '氣象雷達', theme: 'ice', hue: true, desc: '掃描出移動中的降雨回波強度', params: { mode: 'weather' } },
    { id: 'atc', name: '航管雷達', theme: 'amber', desc: '飛機拖著航跡，標示高度與速度', params: { mode: 'atc' } },
    { id: 'sector', name: '扇形掃描', theme: 'toxic', desc: '光束在半圓扇面來回擺動搜索', params: { mode: 'sector' } },
    { id: 'terrain', name: '地形掃描', theme: 'forest', desc: '掃描線逐步描出海岸與陸地輪廓', params: { mode: 'terrain' } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f, n = cols * rows, mode = p.mode, sector = mode === 'sector';
    s.cx = cols / 2; s.cy = sector ? rows - 1.5 : rows / 2;
    s.d = new Float32Array(n); s.a = new Float32Array(n); s.tol = new Float32Array(n);
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const dx = x + 0.5 - s.cx, dy = (y + 0.5 - s.cy) * aspect;
      let a = Math.atan2(dy, dx);
      if (a < 0) a += TAU;
      s.d[i] = Math.hypot(dx, dy); s.a[i] = a;
      s.tol[i] = 0.5 * Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)) * aspect);
    }
    s.R = sector ? Math.min(cols * 0.48, (rows - 3) * aspect) : Math.min(cols, rows * aspect) * 0.46;
    s.bl = Array.from({ length: 7 }, () => ({ a: rnd(0, TAU), d: rnd(0.15, 0.95), g: 0, id: rint(10, 99) }));
    if (mode === 'atc') s.pl = Array.from({ length: 9 }, () => this.plane(true));
    if (mode === 'terrain') { s.land = new Float32Array(n); for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) s.land[i] = Noise.fbm(x * 0.03 + 3, y * aspect * 0.03, 1.7, 4) + 0.08; }
    s.ping = 0;
  },
  plane(init) {
    const a = rnd(0, TAU), r = init ? rnd(0.2, 0.9) : 1.02, h = init ? rnd(0, TAU) : a + Math.PI + rnd(-0.6, 0.6);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, h, v: rnd(0.012, 0.03), alt: rint(8, 41) * 10, tr: [], tt: 0, id: pick(['ASC', 'PXL', 'TTY', 'KAT', 'ZEN']) + rint(100, 989) };   // 虛構的航空公司代碼，避免湊出真實的航空公司
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, dt, C, H, p } = f, R = s.R, n = cols * rows, mode = p.mode, cx = s.cx, cy = s.cy;
    if (mode === 'sonar') return this.sonar(s, f);
    let sw = (t * 1.1) % TAU;
    if (mode === 'sector') sw = Math.PI * 1.5 + Math.sin(t * 0.7) * 1.35;
    const prev = s.sw === undefined ? sw : s.sw, dir = mode === 'sector' ? Math.sign(sw - prev) || 1 : 1;
    s.sw = sw;
    const cxi = Math.floor(cx), cyi = Math.floor(cy), T = ' .:-=+*#';
    for (let i = 0; i < n; i++) {
      const d = s.d[i];
      if (d > R + 1.5) continue;
      let diff = dir > 0 ? sw - s.a[i] : s.a[i] - sw;
      if (diff < 0) diff += TAU;
      const inSec = mode !== 'sector' || (s.a[i] > Math.PI * 1.5 - 1.42 && s.a[i] < Math.PI * 1.5 + 1.42);
      if (!inSec) continue;
      const tr = diff < 1.6 ? Math.pow(1 - diff / 1.6, 2) : 0;
      let c = ' ', b = 0, col = null;
      const tol = s.tol[i], rr = (d / R) * 4;
      if (Math.abs(d - R) < tol + 0.1) { c = '='; b = 0.55; }
      else if (d < R && d > 1 && Math.abs(rr - Math.round(rr)) * (R / 4) < tol) { c = '.'; b = 0.32; }
      else if (d < R && (i % cols === cxi || ((i / cols) | 0) === cyi)) { c = i % cols === cxi ? ':' : '-'; b = 0.22; }
      if (mode === 'weather' && d < R) {
        const x = i % cols, y = (i / cols) | 0, rn = Noise.fbm(x * 0.045 - t * 0.04, y * aspect * 0.045 + t * 0.015, t * 0.03, 3);
        if (rn > 0.05) { const e = clamp((rn - 0.05) * 2.6, 0, 1), vis = 0.35 + 0.65 * Math.max(tr, 0.25); c = ' .:░▒▓'[Math.min(5, 1 + ((e * 5) | 0))]; col = H(120 - e * 120, (0.25 + e * 0.6) * vis); }
      } else if (mode === 'terrain' && d < R) {
        const L = s.land[i], vis = Math.max(tr, 0.12);
        if (L > 0.05) { c = L > 0.3 ? '#' : L > 0.15 ? '%' : '+'; b = Math.max(b, (0.25 + L) * vis); }
        else if (L > -0.02) { c = '.'; b = Math.max(b, 0.6 * vis); }
        else if ((i * 7) % 13 === 0) { c = '~'; b = Math.max(b, 0.25 * vis); }
      }
      if (d < R && tr > 0.05 && mode !== 'weather') { const k = Math.min(7, (tr * 8) | 0); if (k > 0 && (c === ' ' || tr > 0.5)) c = T[k]; b = Math.max(b, 0.15 + tr * 0.85); }
      if (c !== ' ') { g.ch[i] = c; g.co[i] = col || (mode === 'weather' ? C(Math.max(b, 0.15 + tr * 0.6)) : C(b)); }
    }
    if (mode === 'atc') this.atc(s, f, sw);
    else if (mode === 'sweep' || mode === 'sector') {
      for (const bl of s.bl) {
        if (mode === 'sector' && Math.abs(bl.a - Math.PI * 1.5) > 1.3) bl.a = Math.PI * 1.5 + rnd(-1.3, 1.3);
        let diff = dir > 0 ? sw - bl.a : bl.a - sw;
        if (diff < 0) diff += TAU;
        if (diff < Math.max(dt * 1.7, 0.05)) bl.g = 1; else bl.g = Math.max(0, bl.g - dt * 0.35);
        if (Math.random() < dt * 0.02) Object.assign(bl, { a: rnd(0, TAU), d: rnd(0.15, 0.95), g: 0 });
        bl.a = (bl.a + dt * 0.01) % TAU;
        if (bl.g <= 0.02) continue;
        const x = cx + Math.cos(bl.a) * bl.d * R, y = cy + (Math.sin(bl.a) * bl.d * R) / aspect;
        g.set(x, y, '◆', C(0.4 + bl.g * 0.6)); g.text(x + 2, y, 'T' + bl.id, C(bl.g * 0.75));
      }
    }
    const lab = { sweep: 'RADAR // SECTOR 4', weather: 'WX RADAR // PRECIP', atc: 'APPROACH CONTROL', sector: 'SEARCH // ARC SCAN', terrain: 'MAPPING // COASTLINE' }[mode];
    g.text(2, 1, lab, C(0.7));
    g.text(2, 2, mode === 'weather' ? 'RANGE  240 KM' : 'RANGE  120 NM', C(0.45));
    g.text(2, 3, 'BRG    ' + String(Math.round((sw / TAU) * 360) % 360).padStart(3, '0') + '°', C(0.45));
    if (mode === 'sweep') g.text(2, rows - 2, 'CONTACTS ' + s.bl.filter(b => b.g > 0.02).length, C(0.45));
    if (mode === 'weather') { const lg = ' ░▒▓'; for (let k = 1; k < 4; k++) g.text(2 + k * 3, rows - 2, lg[k] + lg[k], H(120 - k * 40, 0.75)); g.text(2, rows - 2, 'dBZ', C(0.5)); }
    if (mode === 'atc') g.text(2, rows - 2, 'TRAFFIC ' + s.pl.length, C(0.45));
  },
  atc(s, f, sw) {
    const { g, aspect, dt, C } = f, R = s.R;
    for (let k = 0; k < s.pl.length; k++) {
      const pl = s.pl[k];
      pl.x += Math.cos(pl.h) * pl.v * dt; pl.y += Math.sin(pl.h) * pl.v * dt; pl.tt += dt;
      if (pl.tt > 1.2) { pl.tt = 0; pl.tr.unshift([pl.x, pl.y]); if (pl.tr.length > 7) pl.tr.pop(); }
      if (Math.hypot(pl.x, pl.y) > 1.05) { s.pl[k] = this.plane(false); continue; }
      const sx = s.cx + pl.x * R, sy = s.cy + (pl.y * R) / aspect;
      pl.tr.forEach(([x, y], j) => g.set(s.cx + x * R, s.cy + (y * R) / aspect, '·', C(0.55 - j * 0.06)));
      g.set(sx, sy, '■', C(1));
      g.line(sx, sy, sx + Math.cos(pl.h) * 3, sy + (Math.sin(pl.h) * 3) / aspect, '.', C(0.6));
      g.text(sx + 2, sy - 1, pl.id, C(0.85)); g.text(sx + 2, sy, String(pl.alt).padStart(3, '0') + ' ' + Math.round(pl.v * 16000), C(0.6));
    }
    void sw;
  },
  sonar(s, f) {
    const { g, cols, rows, aspect, t, dt, C } = f, R = s.R, n = cols * rows, cx = s.cx, cy = s.cy;
    s.ping += dt;
    if (s.ping > 3.2) s.ping = 0;
    const rp = (s.ping / 2.6) * R, cxi = Math.floor(cx), cyi = Math.floor(cy);
    for (let i = 0; i < n; i++) {
      const d = s.d[i];
      if (d > R + 1.5) continue;
      const tol = s.tol[i], rr = (d / R) * 5;
      let c = ' ', b = 0;
      if (Math.abs(d - R) < tol + 0.1) { c = '='; b = 0.5; }
      else if (d < R && d > 1 && Math.abs(rr - Math.round(rr)) * (R / 5) < tol) { c = '.'; b = 0.25; }
      else if (d < R && (i % cols === cxi || ((i / cols) | 0) === cyi)) { c = '.'; b = 0.18; }
      const behind = rp - d;
      if (d < R && behind > -tol - 0.3 && behind < R * 0.25 && rp < R * 1.05) {
        const e = behind < tol + 0.3 ? 1 : Math.pow(1 - behind / (R * 0.25), 2) * 0.5;
        if (e > 0.06) { c = behind < tol + 0.3 ? 'o' : e > 0.3 ? '~' : '-'; b = Math.max(b, 0.15 + e * 0.85 * (1 - s.ping / 3.4)); }
      }
      if (c !== ' ') { g.ch[i] = c; g.co[i] = C(b); }
    }
    for (const bl of s.bl) {
      bl.a = (bl.a + dt * 0.02 * (bl.id % 2 ? 1 : -1) + TAU) % TAU;
      const dd = bl.d * R;
      if (Math.abs(dd - rp) < 1.5) bl.g = 1; else bl.g = Math.max(0, bl.g - dt * 0.3);
      if (bl.g <= 0.02) continue;
      const x = cx + Math.cos(bl.a) * dd, y = cy + (Math.sin(bl.a) * dd) / aspect;
      g.set(x, y, '●', C(0.4 + bl.g * 0.6)); g.text(x + 2, y, 'S' + bl.id, C(bl.g * 0.7));
    }
    g.text(2, 1, 'SONAR // ACTIVE PING', C(0.7));
    g.text(2, 2, 'DEPTH  120 M', C(0.45));
    g.text(2, 3, 'NEXT   ' + (3.2 - s.ping).toFixed(1) + ' S', C(0.45));
    void t;
  } });

A({ id: 'eq', name: '音樂頻譜', cat: '科技', theme: 'synth', hue: true, desc: '跟著節拍跳動的霓虹頻譜',
  params: { mode: 'bars' },
  variants: [
    { id: 'mirror', name: '鏡像頻譜', theme: 'cyber', desc: '從中線向上下對稱伸展的頻譜', params: { mode: 'mirror' } },
    { id: 'radial', name: '環形頻譜', theme: 'neon', desc: '圍成一圈、隨節拍脈動的頻譜', params: { mode: 'radial' } },
    { id: 'led', name: 'LED 燈條', theme: 'mono', desc: '綠黃紅分段亮起的音響燈條', params: { mode: 'led' } },
  ],
  init(s, f) {
    s.nb = Math.max(8, Math.floor(f.cols / 3)); s.v = new Float32Array(s.nb); s.pk = new Float32Array(s.nb);
    s.hist = []; s.acc = 0; s.ph = new Float32Array(16);
  },
  frame(s, f) {
    const { g, cols, rows, aspect, dt, t, C, H, p } = f, nb = s.nb, mode = p.mode;
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2.1)), 12);
    for (let i = 0; i < nb; i++) {
      const fr = i / nb;
      const target = clamp(0.15 + 0.55 * (0.5 + 0.5 * Noise.n3(i * 0.12, t * 1.4, 0)) * (1 - fr * 0.45) + beat * (1 - fr) * 0.45 + 0.08 * Math.sin(t * 7 + i), 0, 1);
      s.v[i] += (target - s.v[i]) * Math.min(1, dt * 14);
      s.pk[i] = s.v[i] > s.pk[i] ? s.v[i] : Math.max(0, s.pk[i] - dt * 0.35);
    }
    if (mode === 'bars') {
      const bw = cols / nb, maxH = rows * 0.82, base = rows - 2;
      for (let i = 0; i < nb; i++) {
        const x0 = Math.floor(i * bw), w = Math.max(1, Math.floor(bw) - 1), hgt = s.v[i] * maxH, hue = 280 - (i / nb) * 250;
        for (let k = 0; k < hgt; k++) { const c = H(hue, 0.35 + (0.65 * k) / maxH); for (let q = 0; q < w; q++) g.set(x0 + q, base - k, '█', c); }
        const py = base - Math.floor(s.pk[i] * maxH) - 1;
        for (let q = 0; q < w; q++) g.set(x0 + q, py, '▀', C(1));
      }
      for (let x = 0; x < cols; x++) g.set(x, base + 1, '─', C(0.3));
    } else if (mode === 'mirror') {
      const bw = cols / nb, mid = Math.floor(rows / 2), maxH = rows * 0.46;
      for (let i = 0; i < nb; i++) {
        const j = Math.abs(i - nb / 2) * 2, k0 = Math.min(nb - 1, j | 0), x0 = Math.floor(i * bw), w = Math.max(1, Math.floor(bw) - 1), hgt = s.v[k0] * maxH, hue = 190 + (j / nb) * 140;
        for (let k = 0; k < hgt; k++) { const c = H(hue, 0.3 + (0.7 * k) / maxH); for (let q = 0; q < w; q++) { g.set(x0 + q, mid - 1 - k, '█', c); g.set(x0 + q, mid + k, k % 2 ? '▓' : '█', H(hue, 0.15 + (0.4 * k) / maxH)); } }
        const pk = Math.floor(s.pk[k0] * maxH);
        for (let q = 0; q < w; q++) { g.set(x0 + q, mid - 2 - pk, '▀', C(1)); g.set(x0 + q, mid + 1 + pk, '▄', C(0.6)); }
      }
    } else if (mode === 'radial') {
      const cx = cols / 2, cy = rows / 2, r0 = Math.min(cols, rows * aspect) * (0.17 + beat * 0.02), maxL = Math.min(cols, rows * aspect) * 0.3, nR = 120;
      for (let k = 0; k < nR; k++) {
        const a = (k / nR) * TAU - Math.PI / 2, j = Math.min(nb - 1, Math.floor((Math.abs(((k / nR) * 2) % 2 - 1)) * nb * 0.8)), L = s.v[j] * maxL, ca = Math.cos(a), sa = Math.sin(a);
        const chs = slopeCh(ca, sa);
        for (let r = 0; r < L; r += 0.6) g.set(cx + ca * (r0 + r), cy + (sa * (r0 + r)) / aspect, r > L - 1 ? '*' : chs, H((k / nR) * 360 + t * 20, 0.3 + (0.6 * r) / maxL));
        g.set(cx + ca * (r0 + s.pk[j] * maxL + 1), cy + (sa * (r0 + s.pk[j] * maxL + 1)) / aspect, '·', C(0.9));
      }
      for (let a = 0; a < TAU; a += 0.5 / r0) g.set(cx + Math.cos(a) * (r0 - 1), cy + (Math.sin(a) * (r0 - 1)) / aspect, '.', C(0.4 + beat * 0.5));
    } else if (mode === 'wave') {
      const mid = rows / 2, amp = rows * 0.42;
      for (let k = 0; k < 16; k++) s.ph[k] += dt * (2 + k * 1.7);
      for (let ch = 0; ch < 2; ch++) {
        let prevY = null;
        for (let x = 0; x < cols; x++) {
          let y = 0;
          for (let k = 0; k < 8; k++) y += s.v[Math.min(nb - 1, k * 3 + ch)] * Math.sin(x * (0.03 + k * 0.035) + s.ph[k * 2 + ch] + ch * 1.3) / (1 + k * 0.4);
          const sy = mid + y * amp * 0.38 * (ch ? -1 : 1) + (ch ? rows * 0.0 : 0);
          if (prevY !== null) { const a = Math.min(prevY, sy), b = Math.max(prevY, sy); for (let yy = Math.floor(a); yy <= b; yy++) g.set(x, yy, Math.abs(sy - prevY) < 0.6 ? '-' : sy < prevY ? '/' : '\\', C(ch ? 0.55 : 0.95)); }
          else g.set(x, sy, '-', C(0.9));
          prevY = sy;
        }
      }
      for (let x = 0; x < cols; x += 2) g.set(x, mid, '·', C(0.18));
      for (let y = 0; y < rows; y += 2) for (let x = 0; x < cols; x += Math.max(8, cols >> 3)) g.set(x, y, '·', C(0.15));
    } else if (mode === 'led') {
      const n2 = Math.max(8, Math.floor(nb / 1.5)), bw = cols / n2, maxH = rows - 3, base = rows - 2;
      for (let i = 0; i < n2; i++) {
        const v = s.v[Math.floor((i * nb) / n2)], pk = s.pk[Math.floor((i * nb) / n2)], x0 = Math.floor(i * bw), w = Math.max(1, Math.floor(bw) - 1), hgt = Math.round(v * maxH), pky = Math.round(pk * maxH);
        for (let k = 0; k < maxH; k++) {
          const fr = k / maxH, on = k < hgt, hue = fr < 0.6 ? 120 : fr < 0.85 ? 55 : 0;
          const c = on ? H(hue, 0.55 + fr * 0.2) : k === pky ? H(hue, 0.75) : C(0.1);
          for (let q = 0; q < w; q++) g.set(x0 + q, base - k, '▄', c);
        }
      }
    } else {
      s.acc += dt;
      while (s.acc > 1 / 20) { s.acc -= 1 / 20; s.hist.unshift(Float32Array.from(s.v)); if (s.hist.length > rows) s.hist.pop(); }
      const R = ' .:-=+*#%@';
      for (let y = 0; y < s.hist.length; y++) {
        const row = s.hist[y];
        for (let x = 0; x < cols; x++) {
          const e = row[Math.min(nb - 1, Math.floor((x / cols) * nb))];
          const k = Math.min(9, (e * e * 11) | 0);
          if (k > 0) g.set(x, y, R[k], C(0.1 + e * e * 0.9 * (1 - (y / rows) * 0.4)));
        }
      }
    }
  } });

const PAIR = { A: 'T', T: 'A', C: 'G', G: 'C' }, BH = { A: 0, T: 50, C: 120, G: 200 }, SEQ = 'ATCGGCTAAGCTTACG';
A({ id: 'dna', name: 'DNA 螺旋', cat: '科技', theme: 'ice', hue: true, desc: '緩緩轉動的雙股螺旋與鹼基對',
  params: { mode: 'multi' },
  variants: [
    { id: 'big', name: '巨型螺旋', theme: 'sakura', desc: '佔滿畫面的單一螺旋，鹼基清晰可見', params: { mode: 'big' } },
    { id: 'vertical', name: '直立螺旋', theme: 'mint', desc: '一排直立旋轉的雙股螺旋', params: { mode: 'vertical' } },
    { id: 'ribbon', name: '緞帶螺旋', theme: 'lavender', desc: '有寬度的緞帶隨轉動翻面', params: { mode: 'ribbon' } },
    { id: 'braid', name: '三股辮', theme: 'fire', desc: '三條股線交錯編織前進', params: { mode: 'braid' } },
    { id: 'sequencer', name: '定序儀', theme: 'matrix', desc: '螺旋上方流過一行行鹼基序列', params: { mode: 'seq' } },
  ],
  init(s, f) {
    s.rows = Array.from({ length: f.rows }, () => ({ off: rnd(0, 100), sp: rnd(4, 12), seq: Array.from({ length: 64 }, () => pick('ATCG')).join('') }));
  },
  helixH(f, y0, Am, k, sp, ph0, dir, big) {
    const { g, cols, t, C, H } = f;
    for (let x = 0; x < cols; x++) {
      const ph = x * k - t * sp * dir + ph0, s1 = Math.sin(ph), z1 = Math.cos(ph);
      const y1 = y0 + Am * s1, y2 = y0 - Am * s1;
      const slot = Math.floor(ph / k), isR = ((slot % 3) + 3) % 3 === 0;
      const b1 = SEQ[(((Math.floor(slot / 3) % 16) + 16) % 16)], b2 = PAIR[b1];
      const front1 = z1 > 0, fy = front1 ? y1 : y2, by = front1 ? y2 : y1, fz = Math.abs(z1);
      g.set(x, by, big ? 'o' : '.', H(front1 ? 200 : 320, 0.3));
      if (isR && Math.abs(y1 - y2) >= 3) {
        for (let yy = Math.round(Math.min(y1, y2)) + 2; yy < Math.round(Math.max(y1, y2)) - 1; yy++) g.set(x, yy, big ? (yy === Math.round(y0) ? '+' : '|') : ':', C(big ? 0.25 + 0.3 * fz : 0.32));
        const s1d = y1 < y2 ? 1 : -1;
        g.set(x, Math.round(y1) + s1d, b1, H(BH[b1], 0.8)); g.set(x, Math.round(y2) - s1d, b2, H(BH[b2], 0.8));
      }
      if (big) { g.set(x, fy, fz > 0.7 ? '@' : fz > 0.35 ? 'O' : 'o', H(front1 ? 320 : 200, 0.55 + 0.45 * fz)); g.set(x, fy + (s1 > 0 === front1 ? -1 : 1) * 0, fz > 0.7 ? '@' : 'O', H(front1 ? 320 : 200, 0.55 + 0.45 * fz)); }
      else g.set(x, fy, fz > 0.5 ? '@' : 'O', H(front1 ? 320 : 200, 0.55 + 0.45 * fz));
    }
  },
  frame(s, f) {
    const { g, cols, rows, aspect, t, C, H, p } = f, mode = p.mode;
    if (mode === 'multi') {
      const nh = Math.max(1, Math.floor(rows / 16)), gap = rows / nh, Am = Math.min(5, gap * 0.3), k = TAU / 28;
      for (let h = 0; h < nh; h++) this.helixH(f, gap * (h + 0.5), Am, k, 1.3 + h * 0.17, h * 1.7, h % 2 ? -1 : 1, false);
      return;
    }
    if (mode === 'big') { this.helixH(f, rows / 2, rows * 0.36, TAU / Math.max(40, cols * 0.3), 1.1, 0, 1, true); return; }
    if (mode === 'seq') {
      const hy = rows / 2, Am = Math.max(2, rows * 0.12);
      this.helixH(f, hy, Am, TAU / 34, 1.6, 0, 1, false);
      for (let y = 0; y < rows; y++) {
        if (Math.abs(y - hy) < Am + 3) continue;
        const r = s.rows[y], off = r.off + t * r.sp * (y % 2 ? 1 : -1), dim = Math.abs(y - hy) / rows;
        for (let x = 0; x < cols; x += 2) {
          const q = Math.floor(x / 2 + off), ch = r.seq[((q % 64) + 64) % 64];
          const scan = Math.abs(((x / cols) - fract(t * 0.08))) < 0.015;
          g.set(x, y, ch, scan ? C(1) : H(BH[ch], 0.55 - dim * 0.5));
        }
      }
      return;
    }
    if (mode === 'vertical') {
      const nv = Math.max(2, Math.floor(cols / 28)), gap = cols / nv, Am = Math.min(gap * 0.32, 9), k = TAU / Math.max(14, rows * 0.55);
      for (let v = 0; v < nv; v++) {
        const x0 = gap * (v + 0.5), dir = v % 2 ? -1 : 1;
        for (let y = 0; y < rows; y++) {
          const ph = y * k - t * 1.4 * dir + v * 1.3, s1 = Math.sin(ph), z1 = Math.cos(ph), x1 = x0 + Am * s1, x2 = x0 - Am * s1, slot = Math.floor(ph / k);
          const front1 = z1 > 0, fx = front1 ? x1 : x2, bx = front1 ? x2 : x1, fz = Math.abs(z1);
          g.set(bx, y, '.', H(front1 ? 160 : 40, 0.3));
          if (((slot % 2) + 2) % 2 === 0 && Math.abs(x1 - x2) > 3) {
            const b1 = SEQ[((slot % 16) + 16) % 16];
            for (let xx = Math.round(Math.min(x1, x2)) + 1; xx < Math.round(Math.max(x1, x2)); xx++) g.set(xx, y, '-', H(BH[xx < x0 === (x1 < x2) ? b1 : PAIR[b1]], 0.45));
          }
          g.set(fx, y, fz > 0.5 ? '@' : 'O', H(front1 ? 40 : 160, 0.55 + 0.45 * fz));
        }
      }
      return;
    }
    if (mode === 'ribbon') {
      const nh = Math.max(1, Math.floor(rows / 22)), gap = rows / nh, Am = gap * 0.3, k = TAU / Math.max(36, cols * 0.18), W = Math.max(1.2, gap * 0.09);
      for (let h = 0; h < nh; h++) {
        const y0 = gap * (h + 0.5);
        for (let x = 0; x < cols; x++) {
          const items = [];
          for (let st = 0; st < 2; st++) {
            const ph = x * k - t * 1.2 + h * 2 + st * Math.PI, sy = y0 + Am * Math.sin(ph), z = Math.cos(ph), wid = W * (0.25 + 0.75 * Math.abs(Math.cos(ph * 2 + t * 0.5)));
            items.push({ sy, z, wid, st });
          }
          items.sort((a, b) => a.z - b.z);
          for (const it of items) {
            const face = it.wid > W * 0.6;
            for (let yy = Math.round(it.sy - it.wid); yy <= Math.round(it.sy + it.wid); yy++) g.set(x, yy, face ? (it.z > 0 ? '█' : '▒') : '|', H(it.st ? 280 : 190, (it.z > 0 ? 0.55 : 0.25) + 0.3 * Math.abs(it.z)));
          }
        }
      }
      return;
    }
    const Am = rows * 0.32, k = TAU / Math.max(40, cols * 0.22), y0 = rows / 2, HU = [10, 45, 330];
    for (let x = 0; x < cols; x++) {
      const items = [];
      for (let st = 0; st < 3; st++) { const ph = x * k - t * 1.1 + (st * TAU) / 3; items.push({ y: y0 + Am * Math.sin(ph), z: Math.cos(ph), dy: Math.cos(ph), st }); }
      items.sort((a, b) => a.z - b.z);
      for (const it of items) {
        const th = Math.max(1, Math.round(rows * 0.04 * (1 + it.z * 0.5)));
        for (let q = -th; q <= th; q++) g.set(x, it.y + q, Math.abs(q) === th ? (it.dy > 0.3 ? '\\' : it.dy < -0.3 ? '/' : '=') : '█', H(HU[it.st], 0.25 + 0.4 * (it.z + 1) / 2 + (q === 0 ? 0.15 : 0)));
      }
    }
    void aspect;
  } });

// 進度條文字；spin 是正在前進時，進度條最前端轉動的小指針
const barText = (label, p, w, spin) => { const k = Math.min(w, Math.round((p / 100) * w)), sp = spin && k < w ? spin : ''; return `${label} [${'#'.repeat(k)}${sp}${'.'.repeat(w - k - sp.length)}] ${Math.round(p)}%`; };
function termLine(cols) {
  const r = Math.random(), hx = n => Array.from({ length: n }, () => rint(0, 255).toString(16).padStart(2, '0')).join(' ');
  if (r < 0.25) return { text: `0x${rint(0x1000, 0xfffff).toString(16).padStart(8, '0')}  ${hx(8)}  ${hx(8)}`, b: 0.45, fast: true, pause: 0.02, n: 0 };
  if (r < 0.45) return { text: `[  OK  ] ${pick(['Started', 'Mounted', 'Reached', 'Loaded', 'Listening on'])} ${pick(['Network Manager', 'Quantum Entropy Pool', '/dev/nvme0n1p2', 'Neural Cache', 'Secure Shell Daemon', 'Mainframe Uplink', 'Kernel Module ascii.ko', 'Firewall Rules'])}.`, b: 0.6, fast: true, pause: 0.12, n: 0 };
  if (r < 0.6) return { text: `root@ascii:~# ${pick(['nmap -sV 10.0.0.0/24', 'ssh -p 2222 admin@relay', 'cat /etc/shadow | grep root', './decrypt --key=0xDEADBEEF', 'tail -f /var/log/syslog', 'make -j16 && sudo make install', 'ping -c 4 mainframe.local', 'python3 probe.py --target 127.0.0.1'])}`, b: 1, pause: 0.35, n: 0 };
  // 進度條：先出現 0%，再一格一格長到目標百分比
  if (r < 0.75) { const label = pick(['Decrypting', 'Uploading', 'Compiling', 'Bypassing proxy', 'Rendering frames', 'Indexing']), w = 24; return { label, w, p: rint(30, 100), pp: 0, sp: rnd(45, 120), text: barText(label, 0, w), b: 0.7, fast: true, pause: 0.15, n: 0 }; }
  if (r < 0.87) return { text: `${pick(['WARN ', 'INFO ', 'DEBUG', 'TRACE'])}  pid=${rint(100, 9999)}  ${pick(['packet loss detected on eth0', 'cache miss ratio 0.0' + rint(1, 9), 'handshake complete', 'entropy pool refilled', 'segment 0x' + rint(4096, 65535).toString(16) + ' verified', 'latency ' + rint(2, 90) + 'ms'])}`, b: 0.5, fast: true, pause: 0.05, n: 0 };
  if (r < 0.92) return { text: pick(['>>> ACCESS GRANTED <<<', '*** CONNECTION ESTABLISHED ***', '!!! INTRUSION DETECTED !!!', '=== SYSTEM ONLINE ===']), b: 1, pause: 0.8, n: 0 };
  return { text: Array.from({ length: Math.max(8, Math.min(cols - 4, 72)) }, () => pick('01')).join(''), b: 0.3, fast: true, pause: 0.02, n: 0 };
}
const CODE_ID = ['buffer', 'packet', 'node', 'frame', 'index', 'signal', 'vector', 'cache', 'stream', 'matrix', 'queue', 'token', 'pixel', 'delta'];
const CODE_FN = ['decode', 'render', 'update', 'resolve', 'compress', 'scan', 'route', 'hash', 'blend', 'sample', 'encrypt', 'flush'];
const CODE_FILES = ['render.js', 'packet.c', 'cache.rs', 'stream.go', 'vector.py', 'signal.ts'];
function codeLine(st) {
  const id = () => pick(CODE_ID), fn = () => pick(CODE_FN), ind = '  '.repeat(st.ind), r = Math.random();
  if (st.ind === 0) { st.ind = 1; return [[ind, 0], ['function ', 1], [fn() + pick(['Frame', 'Block', 'Chunk', 'Data']), 0.8], [`(${id()}, ${id()}) {`, 0.6]]; }
  if (r < 0.14 && st.ind < 4) { st.ind++; return [[ind, 0], ['for ', 1], [`(let i = 0; i < ${id()}.length; i++) {`, 0.6]]; }
  if (r < 0.26 && st.ind < 4) { st.ind++; return [[ind, 0], ['if ', 1], [`(${id()}.${pick(['size', 'count', 'level'])} > ${rint(2, 512)}) {`, 0.6]]; }
  if (r < 0.4 && st.ind > 0) { st.ind--; return [['  '.repeat(st.ind), 0], ['}', 0.6]]; }
  if (r < 0.5) return [[ind, 0], [`// ${pick(['normalize the input range', 'TODO: tune this threshold', 'fast path for small blocks', 'merge adjacent segments', 'keep the hot loop simple'])}`, 0.35]];
  if (r < 0.58) return [[ind, 0], ['return ', 1], [`${id()};`, 0.7]];
  if (r < 0.7) return [[ind, 0], ['const ', 1], [`${id()} = `, 0.7], [`'${pick(['0x1F', 'ready', 'utf-8', 'mesh', 'v2'])}'`, 0.9], [';', 0.6]];
  return [[ind, 0], ['const ', 1], [`${id()} = ${fn()}(${id()}, ${rint(0, 255)});`, 0.7]];
}
// 開機畫面右側的大字標誌（每個 # 畫成兩格寬的方塊）
const BIOS_FONT = {
  A: [' ### ', '#   #', '#####', '#   #', '#   #'],
  S: [' ####', '#    ', ' ### ', '    #', '#### '],
  C: [' ####', '#    ', '#    ', '#    ', ' ####'],
  I: ['###', ' # ', ' # ', ' # ', '###'],
};
const BOOT_DEVS = [['Disk 0', 'Detecting SATA Port 0 ... SSD 1024GB', 'SSD 1024GB'], ['Disk 1', 'Detecting SATA Port 1 ... None', 'None'], ['USB', 'USB Controller ......... OK', 'xHCI 3.2, 12 ports'], ['Network', 'Network Adapter ........ OK', '2.5 GbE'], ['Audio', 'Audio Device ........... OK', 'HD Audio 7.1'], ['Display', 'Graphics Adapter ....... OK', 'VGA 80x25 text'], ['Keyboard', 'Keyboard ............... Detected', 'PS/2 101-key'], ['Mouse', 'Mouse .................. Detected', 'USB 3-button']];
A({ id: 'terminal', name: '駭客終端機', cat: '科技', theme: 'matrix', desc: '不斷捲動的系統日誌與十六進位傾印',
  params: { mode: 'log' },
  variants: [
    { id: 'code', name: '程式碼', theme: 'cyber', desc: '一行行自動打出的程式碼與行號', params: { mode: 'code' } },
    { id: 'monitor', name: '系統監控', theme: 'ice', desc: '處理器、記憶體、網路與行程的即時儀表', params: { mode: 'monitor' } },
    { id: 'boot', name: '開機畫面', theme: 'amber', desc: '記憶體檢查、偵測裝置到載入完成', params: { mode: 'boot' } },
    { id: 'split', name: '分割視窗', theme: 'mint', desc: '四個窗格同時跑著不同的輸出', params: { mode: 'split' } },
    { id: 'hexdump', name: '記憶體傾印', theme: 'toxic', desc: '整面捲動的十六進位記憶體傾印', params: { mode: 'hexdump' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.lines = []; s.cur = null; s.acc = 0;
    if (p.mode === 'log') for (let k = 0; k < Math.floor(rows * 0.7); k++) { const L = termLine(cols); if (L.label !== undefined) L.text = barText(L.label, L.p, L.w); s.lines.push(L); }
    if (p.mode === 'code') {
      // 寬螢幕分成 2～3 個編輯器窗格，各自打不同的檔案
      const np = cols >= 240 ? 3 : cols > 160 ? 2 : 1, names = CODE_FILES.slice().sort(() => Math.random() - 0.5);
      s.panes = Array.from({ length: np }, (_, k) => {
        const pn = { cs: { ind: 0 }, ln: rint(1, 400), lines: [], cur: null, acc: 0, sp: k ? rnd(70, 140) : 110, name: names[k] };
        for (let q = 0; q < Math.floor(rows * rnd(0.45, 0.8)); q++) pn.lines.push({ segs: codeLine(pn.cs), no: pn.ln++ });
        return pn;
      });
    }
    if (p.mode === 'monitor') {
      const nc = clamp(Math.floor(rows / 4), 4, 16), ty = nc + 6;
      s.net = new Float32Array(Math.max(10, cols)); s.net2 = new Float32Array(Math.max(10, cols));
      s.procs = Array.from({ length: Math.max(24, rows - ty) }, () => ({ pid: rint(100, 32000), user: pick(['root', 'daemon', 'www', 'sys', 'user']), cmd: pick(['kworker/0:1', 'render-node', 'syncd', 'net-relay', 'indexer', 'compositor', 'audio-mix', 'shell', 'cron', 'db-writer', 'cachefs', 'telemetry', 'logrotate', 'dhcp-client', 'font-cache', 'scheduler', 'backupd', 'thumbnailer']), c: rnd(0, 30), m: rnd(0.2, 9), th: rint(1, 64) }));
    }
    if (p.mode === 'boot') { s.step = 0; s.mem = 0; s.bl = []; s.wait = 0.3; s.q = null; }
    if (p.mode === 'split') s.panes = [0, 1, 2, 3].map(k => ({ k, lines: [], acc: 0 }));
    if (p.mode === 'hexdump') {
      // 寬螢幕並排兩、三份各自捲動的傾印
      const per = clamp(Math.floor((cols - 12) / 4.2), 4, 32), dw = 11 + per * 4, nd = clamp(Math.floor((cols + 3) / (dw + 3)), 1, 3), tot = nd * dw + (nd - 1) * 3;
      s.per = per;
      s.dumps = Array.from({ length: nd }, (_, k) => ({ x: Math.floor((cols - tot) / 2) + k * (dw + 3), addr: rint(0x10000, 0xf0000) & ~15, hl: [], off: 0, sp: k ? rnd(3.5, 9) : 6, data: [] }));
    }
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, C, p } = f, mode = p.mode;
    if (mode === 'code') return this.code(s, f);
    if (mode === 'monitor') return this.monitor(s, f);
    if (mode === 'boot') return this.boot(s, f);
    if (mode === 'split') return this.split(s, f);
    if (mode === 'hexdump') return this.hexdump(s, f);
    if (!s.cur) s.cur = termLine(cols);
    const cur = s.cur;
    let done;
    if (cur.label !== undefined) {
      cur.pp = Math.min(cur.p, cur.pp + dt * cur.sp); done = cur.pp >= cur.p;
      cur.text = barText(cur.label, cur.pp, cur.w, done ? '' : '|/-\\'[Math.floor(t * 24) % 4]); cur.n = cur.text.length;
    } else {
      s.acc += dt * (cur.fast ? 320 : 110);
      const take = Math.floor(s.acc);
      if (take > 0) { s.acc -= take; cur.n = Math.min(cur.text.length, cur.n + take); }
      done = cur.n >= cur.text.length;
    }
    if (done) {
      cur.wait = (cur.wait ?? cur.pause) - dt;
      if (cur.wait <= 0) { s.lines.push(cur); s.cur = null; s.acc = 0; if (s.lines.length > rows) s.lines.splice(0, s.lines.length - rows); }
    }
    const all = s.cur ? [...s.lines, s.cur] : s.lines, start = Math.max(0, all.length - (rows - 1));
    for (let k = start; k < all.length; k++) {
      const L = all[k], y = k - start, txt = L === s.cur ? L.text.slice(0, L.n) : L.text;
      g.text(1, y, txt.slice(0, cols - 2), C(L.b));
      if (L === s.cur && Math.floor(t * 2.5) % 2 === 0) g.set(1 + Math.min(txt.length, cols - 3), y, '█', C(0.9));
    }
  },
  code(s, f) {
    const { g, cols, rows, dt, t, C } = f, np = s.panes.length, pw = Math.floor(cols / np), y0 = np > 1 ? 1 : 0, vis = rows - 1 - y0;
    for (let k = 0; k < np; k++) {
      const pn = s.panes[k], x0 = k * pw, xe = k === np - 1 ? cols : x0 + pw - 1;
      if (np > 1) {
        for (let x = x0; x < xe; x++) g.set(x, 0, '─', C(0.2));
        g.text(x0 + 2, 0, ` ${pn.name} `, C(0.75));
        if (k < np - 1) for (let y = 0; y < rows; y++) g.set(xe, y, y ? '│' : '┬', C(0.25));
      }
      if (!pn.cur) { pn.cur = { segs: codeLine(pn.cs), no: pn.ln++, n: 0 }; pn.cur.len = pn.cur.segs.reduce((a, q) => a + q[0].length, 0); }
      pn.acc += dt * pn.sp;
      const take = Math.floor(pn.acc);
      if (take > 0) { pn.acc -= take; pn.cur.n = Math.min(pn.cur.len, pn.cur.n + take); }
      if (pn.cur.n >= pn.cur.len) { pn.cur.w = (pn.cur.w ?? 0.1) - dt; if (pn.cur.w <= 0) { pn.lines.push(pn.cur); pn.cur = null; if (pn.lines.length > rows) pn.lines.splice(0, pn.lines.length - rows); } }
      const all = pn.cur ? [...pn.lines, pn.cur] : pn.lines, start = Math.max(0, all.length - vis), lim0 = xe - 1;
      for (let q = start; q < all.length; q++) {
        const L = all[q], y = y0 + q - start, lim = L === pn.cur ? L.n : 1e9;
        g.text(x0 + 1, y, String(L.no).padStart(4, ' '), C(0.22)); g.set(x0 + 6, y, '│', C(0.18));
        let x = x0 + 8, used = 0;
        for (const [txt, b] of L.segs) {
          const part = txt.slice(0, Math.max(0, lim - used)); used += txt.length;
          if (b) g.text(x, y, part.slice(0, Math.max(0, lim0 - x)), C(b));
          x += part.length;
          if (used > lim) break;
        }
        if (L === pn.cur && Math.floor(t * 2.5 + k) % 2 === 0) g.set(Math.min(x, lim0 - 1), y, '█', C(0.9));
      }
    }
  },
  monitor(s, f) {
    const { g, cols, rows, dt, t, C } = f, nc = clamp(Math.floor(rows / 4), 4, 16), half = Math.floor(cols / 2);
    const up = Math.floor(t + 98765), hh = Math.floor(up / 3600) % 24, mm = Math.floor(up / 60) % 60, ss = up % 60;
    g.text(1, 0, `SYSTEM MONITOR   uptime ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}   load ${(1.2 + Noise.n3(t * 0.2, 1, 0)).toFixed(2)}   tasks ${s.procs.length}`, C(1));
    for (let x = 0; x < cols; x++) g.set(x, 1, '─', C(0.25));
    const bw = Math.max(10, half - 16);
    for (let k = 0; k < nc; k++) {
      const v = clamp(0.45 + 0.55 * Noise.n3(k * 1.7, t * 0.8, 3), 0.02, 1), n = Math.round(v * bw);
      g.text(1, 2 + k, `CPU${String(k).padEnd(2)}[`, C(0.6));
      for (let q = 0; q < bw; q++) g.set(8 + q, 2 + k, q < n ? '|' : ' ', C(q < n ? 0.4 + (q / bw) * 0.6 : 0.1));
      g.text(8 + bw, 2 + k, `]${String(Math.round(v * 100)).padStart(4)}%`, C(0.6));
    }
    const mem = 0.55 + 0.1 * Math.sin(t * 0.1), my = 3 + nc;
    for (const [lab, v, yy] of [['MEM', mem, my], ['SWP', 0.12 + 0.03 * Math.sin(t * 0.05), my + 1]]) {
      g.text(1, yy, lab + '  [', C(0.6));
      const n = Math.round(v * bw);
      for (let q = 0; q < bw; q++) g.set(8 + q, yy, q < n ? '#' : '.', C(q < n ? 0.75 : 0.15));
      g.text(8 + bw, yy, `]${(v * 32).toFixed(1).padStart(5)}G`, C(0.6));
    }
    s.acc += dt;
    while (s.acc > 0.15) { s.acc -= 0.15; s.net.copyWithin(0, 1); s.net2.copyWithin(0, 1); s.net[s.net.length - 1] = clamp(0.4 + 0.6 * Noise.n3(t * 0.6, 7, 0) + (Math.random() < 0.05 ? 0.4 : 0), 0, 1); s.net2[s.net2.length - 1] = clamp(0.3 + 0.5 * Noise.n3(t * 0.5, 9, 0), 0, 1); }
    const gx = half + 1, gw = cols - gx - 1, gh = Math.max(4, my - 2), BL = ' ▁▂▃▄▅▆▇█';
    g.text(gx, 2, 'NET  rx ' + (s.net[s.net.length - 1] * 940).toFixed(0) + ' KB/s   tx ' + (s.net2[s.net2.length - 1] * 310).toFixed(0) + ' KB/s', C(0.7));
    for (let x = 0; x < gw; x++) {
      const v = s.net[s.net.length - gw + x] || 0, v2 = s.net2[s.net2.length - gw + x] || 0, H1 = v * (gh - 1), H2 = v2 * (gh - 1);
      for (let k = 0; k < gh - 1; k++) { const fill = clamp(H1 - k, 0, 1); if (fill > 0) g.set(gx + x, my + 1 - k, BL[Math.round(fill * 8)], C(0.35 + (k / gh) * 0.5)); }
      g.set(gx + x, my + 1 - Math.round(H2), '·', C(0.95));
    }
    const ty = my + 3, wide = cols >= 100, bx = 47, bwp = cols - bx - 8;
    for (let x = 0; x < cols; x++) g.set(x, ty - 1, '─', C(0.25));
    g.text(1, ty, '  PID USER     CPU%  MEM%  THR  COMMAND' + (wide ? '         CPU' : ''), C(0.9));
    for (const pr of s.procs) { pr.c = clamp(pr.c + (Math.random() - 0.5) * dt * 30, 0, 99); pr.m = clamp(pr.m + (Math.random() - 0.5) * dt, 0.1, 30); }
    const sorted = s.procs.slice().sort((a, b) => b.c - a.c), nshow = Math.min(sorted.length, rows - ty - 1);
    for (let k = 0; k < nshow; k++) {
      const pr = sorted[k], y = ty + 1 + k, b = k === 0 ? 1 : Math.max(0.3, 0.65 - (k / nshow) * 0.35);
      g.text(1, y, `${String(pr.pid).padStart(5)} ${pr.user.padEnd(8)} ${pr.c.toFixed(1).padStart(5)} ${pr.m.toFixed(1).padStart(5)} ${String(pr.th).padStart(4)}  ${pr.cmd}`, C(b));
      if (wide) { const n = Math.round((pr.c / 100) * bwp); for (let q = 0; q < n; q++) g.set(bx + q, y, '|', C(0.2 + (q / bwp) * 0.6)); }
    }
  },
  boot(s, f) {
    const { g, cols, rows, dt, t, C } = f, wide = cols >= 140 && rows >= 36;
    const mh = clamp(Math.round(rows * 0.2), 4, 18), y0 = 4 + mh, lw = wide ? Math.floor(cols * 0.48) : cols - 2, cap = Math.max(4, rows - 3 - y0);
    if (!s.q) {
      s.q = [{ k: 'mem' }, ...BOOT_DEVS.map(d => ({ k: 'line', text: d[1], b: 0.7 }))];
      if (rows - y0 - 3 > 34) {
        // 版面夠高時多列一張 PCI 裝置清單
        s.q.push({ k: 'line', text: '', b: 0 }, { k: 'line', text: 'PCI Device Listing ...', b: 0.95 }, { k: 'line', text: 'Bus Dev Fun  Vendor  Device  Class  IRQ', b: 0.8 });
        const cls = [['0106', 'SATA'], ['0c03', 'USB'], ['0200', 'LAN'], ['0403', 'Audio'], ['0300', 'VGA'], ['0604', 'Bridge'], ['0108', 'NVMe'], ['0c05', 'SMBus']];
        for (let k = 0; k < Math.min(10, rows - y0 - 38); k++) { const c = cls[k % cls.length]; s.q.push({ k: 'line', text: ` ${String(rint(0, 4)).padStart(2, '0')}  ${String(rint(0, 31)).padStart(2, '0')}  ${rint(0, 7)}    ${rint(0x1000, 0xffff).toString(16).toUpperCase()}    ${rint(0x1000, 0xffff).toString(16).toUpperCase()}   ${c[0]}   ${String(rint(3, 15)).padStart(2)}   ${c[1]}`, b: 0.6 }); }
      }
      s.q.push({ k: 'line', text: '', b: 0 }, { k: 'line', text: 'Loading kernel image ...', b: 0.95 }, { k: 'bar' });
      for (let i = 0; i < 10; i++) s.q.push({ k: 'line', text: `[  OK  ] ${pick(['Mounted root filesystem', 'Started system logger', 'Reached target network', 'Started display manager', 'Loaded input drivers', 'Started time sync', 'Checked disk integrity', 'Started session manager', 'Started power daemon', 'Reached target graphics'])}.`, b: 0.6 });
      s.q.push({ k: 'line', text: '', b: 0 }, { k: 'line', text: 'SYSTEM READY.', b: 1 }, { k: 'hold' });
      s.qi = 0; s.typed = 0; s.mem = 0; s.prog = 0; s.hold = 0; s.bl = [];
    }
    const ev = s.q[s.qi];
    if (ev.k === 'mem') { s.mem += dt * 16000; if (s.mem >= 65536) { s.mem = 65536; s.qi++; } }
    else if (ev.k === 'line') { s.typed += dt * 160; if (s.typed >= ev.text.length + 6) { s.bl.push(ev); if (s.bl.length > cap - 1) s.bl.shift(); s.typed = 0; s.qi++; } }
    else if (ev.k === 'bar') { s.prog += dt * 0.45; if (s.prog >= 1) { s.prog = 1; s.qi++; } }
    else { s.hold += dt; if (s.hold > 3.5) { s.q = null; s.bl = []; return; } }
    g.text(1, 0, tr(f, 'ASCII BIOS v2.31  (C) 字元工坊', 'ASCII BIOS v2.31  (C) Character Workshop'), C(1));
    g.text(1, 1, `Memory Test: ${String(Math.floor(s.mem)).padStart(6)}K ${s.mem >= 65536 ? 'OK' : ''}`, C(0.85));
    // 記憶體檢查格：橫跨整個畫面寬度、大約兩成的高度
    const mw = cols - 4, tot = mw * mh, done = Math.floor((s.mem / 65536) * tot);
    for (let i = 0; i < tot; i++) { const x = 2 + (i % mw), y = 3 + ((i / mw) | 0), on = i < done; g.set(x, y, on ? (i > done - 6 ? '█' : '▪') : '·', C(on ? (i > done - 6 ? 0.9 : 0.35 + 0.25 * ((i * 7919) % 3 === 0 ? 1 : 0)) : 0.12)); }
    let y = y0;
    for (const L of s.bl) { if (L.text) g.text(1, y, L.text.slice(0, lw), C(L.b)); y++; }
    if (ev.k === 'line' && ev.text) { const part = ev.text.slice(0, Math.floor(s.typed)); g.text(1, y, part.slice(0, lw), C(ev.b)); if (Math.floor(t * 3) % 2 === 0) g.set(1 + Math.min(part.length, lw), y, '█', C(0.9)); }
    if (ev.k === 'bar' || (s.prog > 0 && s.qi > 0)) { const w = Math.min(lw - 10, 60), k = Math.round(s.prog * w); g.text(1, rows - 2, '[' + '#'.repeat(k) + '.'.repeat(w - k) + '] ' + Math.round(s.prog * 100) + '%', C(0.8)); }
    if (ev.k === 'hold') { const sp = '|/-\\'[Math.floor(t * 8) % 4]; g.text(1, y, sp + ' starting session ' + sp, C(0.7)); }
    g.text(1, rows - 1, 'Press DEL to enter SETUP,  F8 for BOOT MENU', C(0.3));
    if (wide) this.bootPanel(s, f, Math.floor(cols * 0.52), y0, mh);
  },
  // 寬螢幕右半邊：大字標誌、系統設定表（偵測到的裝置逐一亮起）、即時硬體監控
  bootPanel(s, f, x0, y0, mh) {
    const { g, cols, rows, t, C } = f, w = cols - x0 - 2, sc = rows >= 70 ? 2 : 1;
    let y = y0;
    const word = 'ASCII', lw = [...word].reduce((a, ch) => a + BIOS_FONT[ch][0].length * 2 + 2, -2);
    let lx = x0 + Math.max(0, Math.floor((w - lw) / 2));
    for (const chh of word) {
      const gl = BIOS_FONT[chh];
      for (let r = 0; r < 5 * sc; r++) for (let q = 0; q < gl[0].length; q++) if (gl[(r / sc) | 0][q] === '#') { g.set(lx + q * 2, y + r, '█', C(0.55 + 0.1 * Math.sin(t * 1.5 - lx * 0.05))); g.set(lx + q * 2 + 1, y + r, '█', C(0.55 + 0.1 * Math.sin(t * 1.5 - lx * 0.05))); }
      lx += gl[0].length * 2 + 2;
    }
    y += 5 * sc + 1;
    if (y < rows - 3) g.text(x0 + Math.max(0, Math.floor((w - 24) / 2)), y, 'Text  Mode  Computing', C(0.45));
    y += 2;
    const devDone = k => s.qi > k + 1, spin = '|/-\\'[Math.floor(t * 8) % 4];
    const items = [['CPU Type', 'ASC-86 Octa-Core'], ['CPU Clock', '3.60 GHz'], ['Cache L2 / L3', '4 MB / 16 MB'], ['System Memory', `${Math.floor(s.mem)}K`], ...BOOT_DEVS.map((d, k) => [d[0], devDone(k) ? d[2] : null])];
    const bh = items.length + 2;
    if (y + bh < rows - 1) {
      const bc = C(0.35);
      for (let x = 1; x < w; x++) { if (x < 2 || x > 23) g.set(x0 + x, y, '─', bc); g.set(x0 + x, y + bh - 1, '─', bc); }
      for (let r = 1; r < bh - 1; r++) { g.set(x0, y + r, '│', bc); g.set(x0 + w, y + r, '│', bc); }
      g.set(x0, y, '┌', bc); g.set(x0 + w, y, '┐', bc); g.set(x0, y + bh - 1, '└', bc); g.set(x0 + w, y + bh - 1, '┘', bc);
      g.text(x0 + 2, y, ' System Configuration ', C(0.8));
      items.forEach(([k, v], r) => {
        g.text(x0 + 2, y + 1 + r, k.padEnd(16, '.'), C(0.5));
        g.text(x0 + 20, y + 1 + r, (v === null ? spin + ' detecting' : v).slice(0, Math.max(0, w - 21)), C(v === null ? 0.3 : 0.85));
      });
      y += bh + 1;
    }
    if (y + 4 < rows - 1) {
      g.text(x0 + 2, y, 'Hardware Monitor', C(0.8));
      const temp = 38 + 6 * (0.5 + 0.5 * Noise.n3(t * 0.3, 1, 2)), fan = 1500 + 600 * (0.5 + 0.5 * Noise.n3(t * 0.25, 4, 1)), vc = 1.18 + 0.04 * Noise.n3(t * 0.8, 2, 7);
      const rowsHM = [['CPU Temp', `${temp.toFixed(1)} °C`, (temp - 30) / 30], ['CPU Fan', `${Math.round(fan)} RPM`, fan / 2400], ['Vcore', `${vc.toFixed(3)} V`, (vc - 1) / 0.4]];
      rowsHM.forEach(([k, v, fr], r) => {
        g.text(x0 + 2, y + 1 + r, k.padEnd(12), C(0.5)); g.text(x0 + 14, y + 1 + r, v.padStart(10), C(0.85));
        const bw2 = Math.max(0, w - 28), n = Math.round(clamp(fr, 0, 1) * bw2);
        for (let q = 0; q < bw2; q++) g.set(x0 + 26 + q, y + 1 + r, q < n ? '▮' : '·', C(q < n ? 0.4 + (q / bw2) * 0.5 : 0.12));
      });
    }
    void mh;
  },
  split(s, f) {
    const { g, cols, rows, dt, t, C } = f, hw = Math.floor(cols / 2), hh = Math.floor(rows / 2), bc = C(0.35);
    for (let x = 0; x < cols; x++) { g.set(x, 0, '─', bc); g.set(x, hh, '─', bc); g.set(x, rows - 1, '─', bc); }
    for (let y = 0; y < rows; y++) { g.set(0, y, '│', bc); g.set(hw, y, '│', bc); g.set(cols - 1, y, '│', bc); }
    g.set(0, 0, '┌', bc); g.set(hw, 0, '┬', bc); g.set(cols - 1, 0, '┐', bc); g.set(0, hh, '├', bc); g.set(hw, hh, '┼', bc); g.set(cols - 1, hh, '┤', bc);
    g.set(0, rows - 1, '└', bc); g.set(hw, rows - 1, '┴', bc); g.set(cols - 1, rows - 1, '┘', bc);
    const titles = [' syslog ', ' memory ', ' build ', ' traffic '];
    for (const pn of s.panes) {
      const x0 = pn.k % 2 ? hw + 1 : 1, y0 = pn.k < 2 ? 1 : hh + 1, w = (pn.k % 2 ? cols - 1 : hw) - x0, h = (pn.k < 2 ? hh : rows - 1) - y0;
      g.text(x0 + 2, y0 - 1, titles[pn.k], C(0.8));
      pn.acc += dt * [6, 14, 3, 9][pn.k];
      while (pn.acc > 1) {
        pn.acc -= 1;
        let L;
        if (pn.k === 0) { L = termLine(w); if (L.label !== undefined) L.text = barText(L.label, L.p, L.w); }
        else if (pn.k === 1) L = { text: rint(0, 0xffff).toString(16).padStart(4, '0') + ': ' + Array.from({ length: 8 }, () => rint(0, 255).toString(16).padStart(2, '0')).join(' '), b: 0.55 };
        else if (pn.k === 2) L = { text: pick(['[ ' + rint(1, 99) + '%] Building ' + pick(CODE_FN) + '.o', 'Linking target bin/' + pick(CODE_ID), 'warning: unused variable ' + pick(CODE_ID), 'Compiling module ' + pick(CODE_ID) + ' ... done']), b: 0.7 };
        else L = { text: `${pick(['TCP', 'UDP'])} 10.0.${rint(0, 9)}.${rint(2, 254)}:${rint(1000, 65000)} -> ${rint(10, 99)}.${rint(0, 255)}.${rint(0, 255)}.${rint(1, 254)}  ${rint(40, 1500)}B`, b: 0.6 };
        pn.lines.push(L); if (pn.lines.length > h) pn.lines.shift();
      }
      for (let k = 0; k < pn.lines.length; k++) g.text(x0 + 1, y0 + k, pn.lines[k].text.slice(0, Math.max(0, w - 2)), C(pn.lines[k].b));
    }
    void t;
  },
  hexdump(s, f) {
    const { g, rows, dt, C } = f, per = s.per, row = () => Array.from({ length: per }, () => (Math.random() < 0.3 ? 0 : rint(0, 255)));
    for (const d of s.dumps) {
      d.off += dt * d.sp;
      while (d.data.length < rows + 2) d.data.push(row());
      while (d.off >= 1) { d.off -= 1; d.data.shift(); d.addr += per; d.data.push(row()); }
      if (Math.random() < dt * 20) d.hl.push({ r: rint(0, rows - 1), c: rint(0, per - 1), l: 1 });
      for (let k = d.hl.length - 1; k >= 0; k--) { d.hl[k].l -= dt; if (d.hl[k].l <= 0) d.hl.splice(k, 1); }
      const X = d.x;
      for (let y = 0; y < rows; y++) {
        const rw = d.data[y], addr = (d.addr + y * per).toString(16).padStart(8, '0');
        g.text(X, y, addr + ':', C(0.4));
        for (let c = 0; c < per; c++) {
          const v = rw[c], hl = d.hl.find(h => h.r === y && h.c === c), b = hl ? 0.5 + hl.l * 0.5 : v === 0 ? 0.25 : 0.6;
          g.text(X + 10 + c * 3, y, v.toString(16).padStart(2, '0'), C(b));
          const ch = v >= 33 && v < 127 ? String.fromCharCode(v) : '.';
          g.set(X + 11 + per * 3 + c, y, ch, C(hl ? 1 : v >= 33 && v < 127 ? 0.7 : 0.2));
        }
        g.set(X + 10 + per * 3, y, '|', C(0.3));
      }
    }
  } });

A({ id: 'fireflies', name: '螢火蟲之夜', cat: '自然', theme: 'forest', hue: true, desc: '夏夜草叢裡忽明忽暗的螢火蟲',
  params: { mode: 'meadow', per: 220 },
  variants: [
    { id: 'river', name: '螢火河畔', theme: 'ocean', desc: '河面倒映著閃爍的點點螢光', params: { mode: 'river' } },
    { id: 'sync', name: '同步閃爍', theme: 'mint', desc: '河邊大樹上的螢火蟲漸漸一起明滅', params: { mode: 'sync', per: 110 } },
    { id: 'forest', name: '林間深處', theme: 'mono', desc: '高大樹幹之間穿梭的螢火蟲', params: { mode: 'forest', per: 180 } },
    { id: 'dandelion', name: '蒲公英', theme: 'lavender', desc: '蒲公英種子被夜風吹散飄遠', params: { mode: 'dandelion' } },
    { id: 'jar', name: '螢火蟲罐', theme: 'amber', desc: '玻璃罐裡亮著一群螢火蟲', params: { mode: 'jar', per: 130 } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f, mode = p.mode;
    s.wl = mode === 'river' ? Math.floor(rows * 0.68) : mode === 'sync' ? Math.floor(rows * 0.8) : rows;
    s.ff = Array.from({ length: clamp((cols * rows / p.per) | 0, 15, 300) }, () => ({ x: rnd(0, cols), y: rnd(rows * 0.2, s.wl * 0.95), p: rnd(0, TAU), fr: rnd(0.6, 1.6), s: rnd(0, 100), w: rnd(0.9, 1.1), z: Math.random() }));
    s.gh = Array.from({ length: cols }, (_, x) => 2 + Math.abs(Noise.n3(x * 0.15, 1.7)) * rows * (mode === 'river' || mode === 'sync' ? 0.1 : 0.25) + Math.random() * 2);
    if (mode === 'sync') this.syncTree(s, f);
    s.st = Array.from({ length: (cols * rows / 120) | 0 }, () => [rint(0, cols - 1), rint(0, (rows * 0.35) | 0), rnd(0, TAU)]);
    if (mode === 'forest') {
      s.tr = [];
      for (let x = rnd(0, 8); x < cols; x += rnd(cols * 0.06, cols * 0.16)) s.tr.push({ x, w: Math.round(rnd(2, Math.max(3, cols / 25))), z: Math.random() });
      s.tr.sort((a, b) => a.z - b.z);
    }
    if (mode === 'dandelion') {
      s.heads = Array.from({ length: clamp(Math.round(cols / 30), 3, 10) }, () => ({ x: rnd(cols * 0.08, cols * 0.92), h: rnd(rows * 0.25, rows * 0.55), n: 0 }));
      s.seeds = [];
      s.ff.length = Math.min(s.ff.length, 25);
    }
    if (mode === 'jar') {
      const jh = rows * 0.72, jw = Math.min(cols * 0.32, jh * aspect * 0.42);
      s.jar = { cx: cols / 2, top: rows * 0.16, bot: rows * 0.16 + jh, w: jw };
      for (const q of s.ff) { q.in = Math.random() < 0.8; if (q.in) { q.x = s.jar.cx + rnd(-jw * 0.8, jw * 0.8); q.y = rnd(s.jar.top + 3, s.jar.bot - 2); } }
    }
    s.K = 0; s.kt = 0;
  },
  frame(s, f) {
    const { g, cols, rows, aspect, dt, t, C, H, p } = f, mode = p.mode, wl = s.wl;
    for (const [x, y, ph] of s.st) g.set(x, y, '.', C(0.15 + 0.1 * Math.sin(t + ph)));
    if (s.tr) for (const tr of s.tr) if (tr.z < 0.5) this.trunk(f, tr);
    if (mode !== 'jar') for (let x = 0; x < cols; x++) {
      const h = s.gh[x], lean = Math.sin(t * 1.1 + x * 0.12) + 0.3 * Math.sin(t * 2.3 + x * 0.5);
      for (let k = 0; k < h; k++) g.set(x, wl - 1 - k, k > h - 2 ? (lean > 0.4 ? '/' : lean < -0.4 ? '\\' : '|') : k % 2 ? '|' : '!', H(115 + k * 2, 0.12 + (0.22 * k) / h));
    }
    if (mode === 'river' || mode === 'sync') for (let y = wl; y < rows; y++) for (let x = 0; x < cols; x++) { const w = Math.sin(x * 0.2 + y * 1.3 - t * 1.5) + Math.sin(x * 0.07 - t * 0.6 + y); if (w > 1.2) g.set(x, y, '~', C(0.18 + (y - wl) * 0.01)); else if (w > 0.6 && (x + y) % 3 === 0) g.set(x, y, '-', C(0.12)); }
    if (mode === 'sync') {
      // 藏本模型：2 秒後開始耦合、6 秒內加到最強，維持同步約 20 秒後打散重來
      s.kt += dt;
      if (s.kt > 26) { s.kt = 0; for (const q of s.ff) q.p = rnd(0, TAU); }
      const K = clamp((s.kt - 2) / 4, 0, 1) * 3.6;
      let sx = 0, sy = 0;
      for (const q of s.ff) { sx += Math.cos(q.p); sy += Math.sin(q.p); }
      const R = Math.hypot(sx, sy) / s.ff.length, Ps = Math.atan2(sy, sx);
      for (const q of s.ff) q.p += dt * (2.2 * q.w + K * R * Math.sin(Ps - q.p));
      this.syncDraw(s, f, R * Math.pow(Math.max(0, Math.cos(Ps)), 6));
    }
    if (mode === 'dandelion') this.dandelion(s, f);
    if (mode === 'jar') this.jarDraw(s, f, 0);
    for (const q of s.ff) {
      const a = Noise.n3(q.x * 0.05, q.y * 0.1, t * 0.15 + q.s) * TAU * 2;
      if (q.hx !== undefined) { q.x = q.hx + Noise.n3(q.s, t * 0.15, 0) * 2.5; q.y = q.hy + Noise.n3(q.s, t * 0.15, 4) * 1.1; }
      else { q.x += Math.cos(a) * dt * 3; q.y += (Math.sin(a) * dt * 3) / aspect; }
      if (q.hx !== undefined) { /* 停在樹上的螢火蟲只在原地附近晃動 */ }
      else if (mode === 'jar' && q.in) {
        const J = s.jar, hw = this.jarW(J, q.y) - 2;
        q.y = clamp(q.y, J.top + 3, J.bot - 2); q.x = clamp(q.x, J.cx - hw, J.cx + hw);
      } else {
        if (q.x < 0) q.x += cols; else if (q.x >= cols) q.x -= cols;
        q.y = clamp(q.y, rows * 0.15, wl - 1);
      }
      const b = mode === 'sync' ? Math.pow(Math.max(0, Math.cos(q.p)), 10) : Math.pow(Math.max(0, Math.sin(t * q.fr + q.p)), 4);
      if (b < 0.03) continue;
      if (s.tr && q.z < 0.5 && s.tr.some(tr => tr.z >= 0.5 && Math.abs(q.x - tr.x) < tr.w / 2 + 0.5)) continue;
      if (b > 0.45) { const hc = H(70, b * 0.4); g.set(q.x - 1, q.y, '·', hc); g.set(q.x + 1, q.y, '·', hc); g.set(q.x, q.y - 1, '·', hc); g.set(q.x, q.y + 1, '·', hc); }
      g.set(q.x, q.y, b > 0.7 ? '✦' : b > 0.35 ? '*' : b > 0.12 ? '+' : '.', H(68, 0.35 + b * 0.65));
      if (mode === 'river' || mode === 'sync') { const ry = wl + (wl - q.y) * (mode === 'sync' ? 0.3 : 0.6) + 1; if (ry < rows) g.set(q.x + Math.sin(t * 3 + q.s) * 0.8, ry, b > 0.5 ? '*' : '.', H(68, 0.2 + b * 0.35)); }
    }
    if (s.tr) for (const tr of s.tr) if (tr.z >= 0.5) this.trunk(f, tr);
    if (mode === 'jar') this.jarDraw(s, f, 1);
  },
  // 同步閃爍：河岸邊一棵大樹，樹冠由幾團橢圓拼成；大部分螢火蟲停在樹冠裡
  syncTree(s, f) {
    const { cols, rows, aspect } = f, wl = s.wl, cx = cols * 0.5, cy = rows * 0.36;
    const Rx = Math.min(cols * 0.36, rows * aspect * 0.8), Ry = rows * 0.27, lobes = [];
    for (let k = 0; k < 8; k++) lobes.push([cx + rnd(-0.62, 0.62) * Rx, cy + rnd(-0.55, 0.3) * Ry, Rx * rnd(0.32, 0.5), Ry * rnd(0.38, 0.6)]);
    lobes.push([cx, cy, Rx * 0.55, Ry * 0.6]);
    const n = cols * rows, cm = new Uint8Array(n);
    for (let y = 0; y < wl; y++) for (let x = 0; x < cols; x++) {
      const wob = 0.18 * Noise.n3(x * 0.12, y * 0.25, 2.7);
      for (const [lx, ly, rx, ry] of lobes) { const dx = (x - lx) / rx, dy = (y - ly) / ry; if (dx * dx + dy * dy < 1 + wob) { cm[y * cols + x] = 1 + ((hash2(x, y) * 4) | 0); break; } }
    }
    s.cm = cm;
    s.trunk = { x: cx, w: Math.max(2, Math.round(Rx * 0.09)), top: Math.round(cy + Ry * 0.15) };
    const inside = [];
    for (let i = 0; i < n; i++) if (cm[i]) inside.push(i);
    for (const q of s.ff) {
      if (Math.random() < 0.88 && inside.length) { const i = pick(inside); q.hx = i % cols; q.hy = (i / cols) | 0; q.x = q.hx; q.y = q.hy; }
      else q.y = rnd(rows * 0.2, wl - 2);
    }
  },
  syncDraw(s, f, glow) {
    const { g, cols, rows, C, H } = f, wl = s.wl, cm = s.cm, ch = g.ch, co = g.co, T = s.trunk, L = ' ██▓&';
    // 樹幹與根部（往下變寬）、幾根伸進樹冠的枝幹
    for (let y = T.top; y < wl; y++) {
      const u = (y - T.top) / Math.max(1, wl - T.top), w = T.w * (1 + Math.pow(u, 3) * 1.6);
      for (let x = Math.floor(T.x - w / 2); x <= T.x + w / 2; x++) g.set(x, y, x <= T.x - w / 2 + 1 || x >= T.x + w / 2 - 1 ? '|' : '█', C(0.1));
    }
    for (const [dx, h] of [[-0.18, 0.35], [0.2, 0.42], [-0.08, 0.6], [0.1, 0.55]]) g.line(T.x, T.top, T.x + dx * cols, T.top - h * (T.top - rows * 0.1), dx < 0 ? '\\' : '/', C(0.12));
    // 樹冠：暗暗的葉子字元；整群同步亮起的那一下，葉子也被映亮
    const lc = [];
    for (let k = 0; k < 5; k++) lc.push(H(130, 0.045 + (k >= 3 ? 0.04 + (k - 3) * 0.04 : 0) + glow * 0.1));
    for (let y = 0, i = 0; y < wl; y++) for (let x = 0; x < cols; x++, i++) { const v = cm[i]; if (v) { ch[i] = L[v]; co[i] = lc[v]; } }
    void rows;
  },
  trunk(f, tr) {
    const { g, rows, C } = f, near = tr.z >= 0.5, w = Math.max(1, Math.round(tr.w * (near ? 1.4 : 0.8)));
    for (let y = 0; y < rows; y++) for (let q = 0; q < w; q++) { const x = Math.round(tr.x - w / 2 + q), edge = q === 0 || q === w - 1; g.set(x, y, edge ? '|' : (y * 7 + q * 3) % 11 === 0 ? ':' : '█', near ? C(edge ? 0.2 : 0.06) : C(edge ? 0.14 : 0.1)); }
  },
  jarW(J, y) { const u = (y - J.top) / (J.bot - J.top); return u < 0.08 ? J.w * 0.62 : u < 0.16 ? J.w * (0.62 + (u - 0.08) / 0.08 * 0.38) : J.w; },
  jarDraw(s, f, front) {
    const { g, C } = f, J = s.jar, gc = C(front ? 0.4 : 0.15);
    for (let y = Math.floor(J.top); y <= J.bot; y++) { const w = this.jarW(J, y); g.set(J.cx - w - 1, y, front ? '(' : '░', gc); g.set(J.cx + w, y, front ? ')' : '░', gc); }
    if (!front) return;
    for (let x = Math.ceil(J.cx - J.w); x < J.cx + J.w; x++) g.set(x, J.bot + 1, '▀', C(0.4));
    for (let x = 0; x < f.cols; x++) g.set(x, J.bot + 2, x % 9 === 4 ? '=' : '_', C(0.22));
    const lw = J.w * 0.7;
    for (let x = Math.ceil(J.cx - lw - 1); x <= J.cx + lw; x++) { g.set(x, J.top - 1, '▄', C(0.55)); g.set(x, J.top - 2, '▄', C(0.45)); }
    for (let k = 0; k < 3; k++) g.set(J.cx - J.w * 0.6 + k, J.top + 4 + k * 2, '/', C(0.3));
  },
  dandelion(s, f) {
    const { g, rows, aspect, dt, t, C, H } = f, wind = 2.5 + 2 * Math.sin(t * 0.15);
    for (const hd of s.heads) {
      const by = rows - 1, hy = by - hd.h, sway = Math.sin(t * 0.8 + hd.x) * 1.2;
      for (let y = hy; y < by; y++) g.set(hd.x + sway * ((by - y) / hd.h) ** 2 * 0, y, '|', H(110, 0.3));
      const R = Math.max(2.5, rows * 0.07), hx = hd.x, n = 22, left = Math.max(0, n - hd.n);
      g.set(hx, hy, '@', C(0.5));
      for (let k = 0; k < left; k++) { const a = (k / n) * TAU; g.set(hx + Math.cos(a) * R, hy + (Math.sin(a) * R) / aspect, '*', C(0.85)); g.set(hx + Math.cos(a) * R * 0.5, hy + (Math.sin(a) * R * 0.5) / aspect, '·', C(0.5)); }
      if (Math.random() < dt * 0.9 && hd.n < n) { const a = (hd.n / n) * TAU; s.seeds.push({ x: hx + Math.cos(a) * R, y: hy + (Math.sin(a) * R) / aspect, vy: rnd(-1.5, 0.5), ph: rnd(0, TAU) }); hd.n++; }
      if (hd.n >= n && Math.random() < dt * 0.15) hd.n = 0;
    }
    for (let k = s.seeds.length - 1; k >= 0; k--) {
      const q = s.seeds[k];
      q.x += (wind + Math.sin(t * 1.3 + q.ph) * 1.5) * dt * 1.5; q.y += (q.vy + Math.sin(t * 0.9 + q.ph) * 0.8) * dt;
      if (q.x > f.cols + 2 || q.y < -2 || q.y > rows) { s.seeds[k] = s.seeds[s.seeds.length - 1]; s.seeds.pop(); continue; }
      g.set(q.x, q.y, '*', C(0.8)); g.set(q.x, q.y + 1, '|', C(0.35));
    }
  } });

const KOI = ['><(((°>', '><((°>', '>=(((°>'];
A({ id: 'ripple', name: '水波漣漪', cat: '自然', theme: 'ocean', desc: '雨滴落入水面的漣漪（滑鼠也能撥水）',
  params: { mode: 'rain', rate: [0.15, 0.8], amp: [3, 6], damp: 0.975, rad: 1 },
  variants: [
    { id: 'storm', name: '驟雨', theme: 'ice', desc: '密集雨點把水面打成一片碎紋', params: { rate: [0.015, 0.06], amp: [1.6, 3.2], damp: 0.968 } },
    { id: 'stone', name: '投石', theme: 'mono', desc: '偶爾落下的大石激起一圈圈大波紋', params: { rate: [1.6, 3.2], amp: [9, 14], damp: 0.99, rad: 2 } },
    { id: 'koi', name: '錦鯉池', theme: 'forest', hue: true, desc: '錦鯉游過荷葉間，拖出淡淡水痕', params: { mode: 'koi', rate: [0.8, 2.5], amp: [2, 4] } },
    { id: 'contour', name: '等高水紋', theme: 'blueprint', desc: '只畫水面高度等高線的漣漪', params: { mode: 'contour', rate: [0.8, 1.8], amp: [8, 12], rad: 2, damp: 0.985 } },
  ],
  init(s, f) {
    const p = f.p;
    s.W = Math.max(4, Math.ceil(f.cols / 2)); s.Hh = f.rows; const n = s.W * s.Hh; s.a = new Float32Array(n); s.b = new Float32Array(n); s.acc = 0; s.drop = 0;
    if (p.mode === 'interf') s.src = Array.from({ length: 2 }, (_, k) => ({ ph: rnd(0, TAU), fx: rnd(0.03, 0.06), fy: rnd(0.03, 0.05), w: 5.5 + k * 0.4 }));
    if (p.mode === 'koi') {
      s.koi = Array.from({ length: clamp(Math.round(f.cols * f.rows / 1600), 3, 12) }, () => ({ cx: rnd(0.2, 0.8), cy: rnd(0.2, 0.8), rx: rnd(0.15, 0.35), ry: rnd(0.15, 0.35), w: rnd(0.08, 0.18) * (Math.random() < 0.5 ? 1 : -1), ph: rnd(0, TAU), hue: pick([20, 30, 0, 40]), spr: pick(KOI), white: Math.random() < 0.3 }));
      s.pads = Array.from({ length: clamp(Math.round(f.cols * f.rows / 1400), 4, 16) }, () => ({ x: rnd(0, f.cols), y: rnd(0, f.rows), r: rnd(2, 5) * Math.max(1, f.rows / 40), cut: rnd(0, TAU), fl: Math.random() < 0.3 }));
    }
  },
  frame(s, f) {
    const { g, dt, t, C, H, mouse, p } = f, W = s.W, Hh = s.Hh, mode = p.mode;
    const poke = (cx, cy, amp, rad) => {
      for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const X = cx + x, Y = cy + y, d = Math.hypot(x, y); if (d <= rad + 0.5 && X > 0 && Y > 0 && X < W - 1 && Y < Hh - 1) s.a[Y * W + X] += amp * (d === 0 ? 1 : rad === 1 ? 0.5 : 0.5 / d); }
    };
    s.drop -= dt;
    if (mode !== 'interf' && s.drop <= 0) { s.drop = rnd(p.rate[0], p.rate[1]); poke(rint(2, W - 3), rint(2, Hh - 3), rnd(p.amp[0], p.amp[1]), p.rad); }
    if (mouse.on && mouse.moved) { poke(Math.floor(mouse.x / 2), Math.floor(mouse.y), 2, 1); mouse.moved = false; }
    s.acc = Math.min(s.acc + dt, 0.1);
    while (s.acc >= 1 / 40) {
      s.acc -= 1 / 40;
      if (mode === 'interf') for (const q of s.src) { const x = Math.floor(W * (0.5 + 0.3 * Math.sin(t * q.fx + q.ph))), y = Math.floor(Hh * (0.5 + 0.3 * Math.sin(t * q.fy + q.ph * 2))); s.a[y * W + x] = Math.sin(t * q.w) * 7; }
      if (mode === 'koi') for (const k of s.koi) { const [x, y] = this.koiPos(s, f, k, t); if (Math.random() < 0.3) poke(Math.floor(x / 2), Math.floor(y), 0.6, 1); }
      const a = s.a, b = s.b, dm = p.damp;
      for (let y = 1; y < Hh - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) b[i] = ((a[i - 1] + a[i + 1] + a[i - W] + a[i + W]) * 0.5 - b[i]) * dm;
      s.a = b; s.b = a;
    }
    const a = s.a;
    if (mode === 'contour') {
      // 等高線：某個高度剛好落在這一格和右邊或下面那一格之間，就畫一段線（線的方向和坡度垂直），波峰與波谷用不同的字
      const LV = [2.4, 1.2, 0.6, -0.6, -1.2, -2.4], cc = LV.map(L => C(L > 0 ? 0.45 + L * 0.22 : 0.3 - L * 0.08));
      for (let y = 1; y < Hh - 2; y++) for (let x = 1; x < W - 2; x++) {
        const i = y * W + x, v = a[i], vr = a[i + 1], vd = a[i + W];
        for (let k = 0; k < 6; k++) {
          const L = LV[k];
          if ((v > L) === (vr > L) && (v > L) === (vd > L)) continue;
          const gx = vr - a[i - 1], gy = vd - a[i - W];
          if (L > 0) { const c = slopeCh(-gy * 2, gx * 2.1), c2 = c === '-' ? '=' : c; g.set(x * 2, y, c2, cc[k]); g.set(x * 2 + 1, y, c2, cc[k]); }
          else { g.set(x * 2, y, L < -1 ? '~' : '·', cc[k]); g.set(x * 2 + 1, y, L < -1 ? '~' : '·', cc[k]); }
          break;
        }
      }
      return;
    }
    const dim = mode === 'koi' ? 0.55 : 1;
    for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, sl = a[i - 1] - a[i + 1] + (a[i - W] - a[i + W]);
      const e = clamp(0.2 + sl * 0.32 + a[i] * 0.06, 0, 1), c = RAMP10[Math.min(9, (e * 10) | 0)], col = C(e * dim);
      g.set(x * 2, y, c, col); g.set(x * 2 + 1, y, c, col);
    }
    if (mode === 'koi') {
      for (const pd of s.pads) for (let y = Math.floor(pd.y - pd.r / 2); y <= pd.y + pd.r / 2; y++) for (let x = Math.floor(pd.x - pd.r); x <= pd.x + pd.r; x++) {
        const dx = (x - pd.x) / pd.r, dy = ((y - pd.y) * 2) / pd.r, d = dx * dx + dy * dy, an = Math.atan2(dy, dx);
        if (d > 1 || Math.abs(((an - pd.cut + 3 * Math.PI) % TAU) - Math.PI) < 0.25) continue;
        g.set(x, y, d > 0.75 ? 'o' : '@', H(120, 0.3 + (1 - d) * 0.2));
      }
      for (const pd of s.pads) if (pd.fl) { g.set(pd.x, pd.y, '*', H(330, 0.85)); g.set(pd.x - 1, pd.y, '(', H(330, 0.7)); g.set(pd.x + 1, pd.y, ')', H(330, 0.7)); }
      for (const k of s.koi) {
        const [x, y, dir] = this.koiPos(s, f, k, t), spr = dir > 0 ? k.spr : mirror([k.spr])[0];
        g.text(x - spr.length / 2, y, spr, k.white ? C(0.95) : H(k.hue, 0.65));
        if (k.white) g.set(x + (dir > 0 ? 1 : -1), y, '(', H(10, 0.6));
      }
    }
  },
  koiPos(s, f, k, t) {
    const a = t * k.w + k.ph, x = f.cols * (k.cx + k.rx * Math.cos(a)), y = f.rows * (k.cy + k.ry * Math.sin(a * 2) * 0.6);
    const dx = -Math.sin(a) * k.w;
    return [x, y, dx > 0 ? 1 : -1];
  } });
})();
