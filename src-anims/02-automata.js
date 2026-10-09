// 生命與湧現：細胞自動機、反應擴散、沙堆、聚集、群聚與黏菌。整個檔案包在函式裡，輔助常數不會和其他模組撞名。
(() => {
const BRL = Array.from({ length: 256 }, (_, i) => (i ? String.fromCharCode(0x2800 + i) : ' '));
const POP = new Uint8Array(256);
for (let i = 1; i < 256; i++) POP[i] = POP[i >> 1] + (i & 1);
const SH = ['░', '▒', '▓', '█'];

// 模擬格大小：pair＝每格兩個字（接近正方形）、half＝上下半格、braille＝點字 2×4、char＝一格一字
function simSize(f, mode) {
  const { cols, rows } = f;
  if (mode === 'braille') return [cols * 2, rows * 4];
  if (mode === 'half') return [cols, rows * 2];
  if (mode === 'char') return [cols, rows];
  return [Math.max(4, cols >> 1), rows];
}
function wrapX(W) {
  const XM = new Int32Array(W), XP = new Int32Array(W);
  for (let x = 0; x < W; x++) { XM[x] = (x + W - 1) % W; XP[x] = (x + 1) % W; }
  return [XM, XP];
}
// 依照每秒步數換算這一格要跑幾步（不假設固定畫格率）；key 用來分開不同的累加器
function due(s, dt, rate, max, key = 'acc') {
  let a = (s[key] || 0) + dt * rate;
  let n = Math.floor(a);
  a -= n;
  if (n > max) { n = max; a = 0; }
  s[key] = a;
  return n;
}
// 點字繪製：a 是 (cols*2)×(rows*4) 的陣列，非 0 就是一個點；顏色依格內點數
function brailleDraw(g, a, W, colTab) {
  const cols = g.cols, rows = g.rows, ch = g.ch, co = g.co, W2 = W * 2, W3 = W * 3;
  for (let cy = 0; cy < rows; cy++) {
    let j = cy * 4 * W, i = cy * cols;
    for (let cx = 0; cx < cols; cx++, j += 2, i++) {
      const bits = (a[j] ? 1 : 0) | (a[j + W] ? 2 : 0) | (a[j + W2] ? 4 : 0) | (a[j + W3] ? 64 : 0) |
        (a[j + 1] ? 8 : 0) | (a[j + W + 1] ? 16 : 0) | (a[j + W2 + 1] ? 32 : 0) | (a[j + W3 + 1] ? 128 : 0);
      if (!bits) continue;
      ch[i] = BRL[bits]; co[i] = colTab[POP[bits]];
    }
  }
}
function blob(a, W, H, cx, cy, rw, rh, dens, v = 1) {
  for (let y = Math.floor(cy - rh); y <= cy + rh; y++) for (let x = Math.floor(cx - rw); x <= cx + rw; x++) {
    const dx = (x - cx) / rw, dy = (y - cy) / rh;
    if (dx * dx + dy * dy > 1 || Math.random() > dens) continue;
    a[((y % H) + H) % H * W + ((x % W) + W) % W] = v;
  }
}

/* ════════ 1. 類生命規則（B/S 二元規則家族） ════════ */
function ruleTab(str) {
  const m = /B([0-8]*)\/S([0-8]*)/i.exec(str) || ['', '3', '23'];
  const t = new Uint8Array(18);
  for (const c of m[1]) t[+c] = 1;
  for (const c of m[2]) t[9 + +c] = 1;
  return t;
}
A({ id: 'ca-life', name: '類生命規則', cat: '生命', theme: 'mint',
  desc: '細胞團不斷蠕動、分裂與融合',
  params: { rule: 'B368/S12578', mode: 'pair', seed: 'soup', dens: 0.4, sps: 12, trail: 2, reseed: 0, maxT: 80, look: 'block' },
  variants: [
    { id: 'daynight', name: '晝夜', theme: 'amber', desc: '黑白對稱的晝夜規則，雙色地塊推移',
      params: { rule: 'B3678/S34678', mode: 'half', dens: 0.5, sps: 12, maxT: 70 } },
    { id: 'seeds', name: '種子爆發', theme: 'fire', desc: '只會誕生不會存活，從中心炸開的火花',
      params: { rule: 'B2/S', mode: 'pair', seed: 'center', dens: 0.5, sps: 12, trail: 6, maxT: 26 } },
    { id: 'maze', name: '迷宮生長', theme: 'blueprint', desc: '細胞沿著走道蔓延，長成一座迷宮',
      params: { rule: 'B3/S12345', mode: 'pair', seed: 'center', dens: 0.6, sps: 14, trail: 0, maxT: 60, look: 'wall' } },
    { id: 'coral', name: '珊瑚礁', theme: 'sakura', desc: '珊瑚規則慢慢長出分岔的礁石',
      params: { rule: 'B3/S45678', mode: 'pair', seed: 'multi', dens: 0.7, sps: 12, trail: 0, maxT: 70, look: 'age' } },
    { id: 'replicator', name: '複製者', theme: 'neon', desc: '任何圖形都會自我複製成碎形地毯',
      params: { rule: 'B1357/S1357', mode: 'half', seed: 'dot', sps: 13, maxT: 24 } },
    { id: 'move', name: '莫利滑翔', theme: 'cyber', desc: '莫利規則，滑翔機在殘骸間穿梭',
      params: { rule: 'B368/S245', mode: 'pair', dens: 0.36, sps: 12, trail: 4, reseed: 1.5, rsR: 0.08, rsD: 0.5, lowPop: 0.03, maxT: 60, look: 'glyph' } },
    { id: 'anneal', name: '退火', theme: 'lavender', desc: '多數決般的規則，色塊逐漸合併變圓',
      params: { rule: 'B4678/S35678', mode: 'half', dens: 0.5, sps: 12, maxT: 55, look: 'edge' } },
  ],
  init(s, f) {
    const p = f.p, [W, H] = simSize(f, p.mode), n = W * H;
    Object.assign(s, { W, H, n, a: new Uint8Array(n), b: new Uint8Array(n), age: new Uint8Array(n), fd: new Uint8Array(n),
      nb: new Uint8Array(n), tab: ruleTab(p.rule), T: 0, hold: 0, quiet: 0, rs: 0, acc: 0, pop: 1 });
    [s.XM, s.XP] = wrapX(W);
    const a = s.a;
    if (p.seed === 'soup') { for (let i = 0; i < n; i++) a[i] = Math.random() < p.dens ? 1 : 0; }
    else if (p.seed === 'center') blob(a, W, H, W / 2, H / 2, Math.max(3, W * 0.04), Math.max(3, W * 0.04), p.dens);
    else if (p.seed === 'multi') { for (let k = rint(4, 7); k > 0; k--) { const r = Math.max(4, W * 0.04); blob(a, W, H, rnd(0.1, 0.9) * W, rnd(0.15, 0.85) * H, r, r, p.dens); } }
    else {
      const cx = W >> 1, cy = H >> 1;
      for (let y = -1; y <= 1; y++) for (let x = 0; x <= 1; x++) if (Math.random() < 0.6) { a[(cy + y) * W + cx + x] = 1; a[(cy + y) * W + cx - x] = 1; }
      a[cy * W + cx] = 1;
    }
    // 顏色表
    const C = f.C;
    s.colAge = Array.from({ length: 32 }, (_, k) => C(0.98 - 0.45 * Math.min(1, k / 24)));
    s.colFd = Array.from({ length: 16 }, (_, k) => C(0.12 + 0.3 * k / Math.max(1, p.trail)));
    s.colN = Array.from({ length: 9 }, (_, k) => C(0.3 + k * 0.085));
  },
  step(s, trail) {
    const { W, H, XM, XP, tab, age, fd, nb } = s, a = s.a, b = s.b;
    let changed = 0, pop = 0;
    for (let y = 0; y < H; y++) {
      const ym = ((y + H - 1) % H) * W, y0 = y * W, yp = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) {
        const xm = XM[x], xp = XP[x], i = y0 + x, o = a[i];
        const c = a[ym + xm] + a[ym + x] + a[ym + xp] + a[y0 + xm] + a[y0 + xp] + a[yp + xm] + a[yp + x] + a[yp + xp];
        const v = tab[o * 9 + c];
        b[i] = v; nb[i] = c;
        if (v) { pop++; age[i] = o ? (age[i] < 250 ? age[i] + 1 : 250) : 0; fd[i] = trail; if (!o) changed++; }
        else { if (o) changed++; if (fd[i]) fd[i]--; }
      }
    }
    s.a = b; s.b = a; s.pop = pop;
    return changed;
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols;
    s.T += f.dt;
    if (s.hold > 0) { s.hold -= f.dt; if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); } }
    else {
      if (p.reseed && (s.rs += f.dt) > p.reseed) {
        s.rs = 0;
        // 大螢幕一次多丟幾團，密度和小縮圖差不多
        for (let q = p.rsR ? Math.max(1, Math.round(s.n / 5000)) : 1; q > 0; q--) {
          const r = p.rsR ? Math.max(3, Math.min(s.W, s.H * 2) * p.rsR * rnd(0.8, 1.2)) : Math.max(2, s.W * rnd(0.02, 0.05));
          blob(s.a, s.W, s.H, rnd(0, s.W), rnd(0, s.H), r, r * (p.mode === 'char' ? 0.5 : 1), p.rsD || 0.45);
        }
      }
      let k = due(s, f.dt, p.sps, 3);
      while (k-- > 0) {
        const c = this.step(s, p.trail);
        s.quiet = c <= s.n * 0.0004 ? s.quiet + 1 : 0;
      }
      // 族群太稀疏（只剩零星的滑翔機）一段時間就重來
      if (p.lowPop) s.low = s.pop < s.n * p.lowPop ? (s.low || 0) + f.dt : 0;
      if (s.pop === 0 || s.quiet > 25 || s.T > p.maxT || s.low > 3) { s.hold = 1.6; s.low = 0; }
    }
    // 繪製
    const { W, H, a, age, fd, nb } = s, ch = g.ch, co = g.co;
    if (p.mode === 'braille') { brailleDraw(g, a, W, s.colN); return; }
    if (p.mode === 'half') {
      const edge = p.look === 'edge';
      for (let cy = 0; cy < g.rows; cy++) {
        const j0 = cy * 2 * W, j1 = j0 + W;
        for (let x = 0, i = cy * cols; x < W; x++, i++) {
          const t = a[j0 + x], u = a[j1 + x];
          if (!t && !u) continue;
          if (edge) {
            const e = Math.min(t ? nb[j0 + x] : 8, u ? nb[j1 + x] : 8);
            ch[i] = t && u ? (e >= 8 ? '█' : '▓') : t ? '▀' : '▄';
            co[i] = s.colN[e >= 8 ? 4 : 8];
          } else {
            ch[i] = t && u ? '█' : t ? '▀' : '▄';
            co[i] = s.colAge[Math.min(31, t ? age[j0 + x] : age[j1 + x])];
          }
        }
      }
      return;
    }
    if (p.mode === 'char') {
      const G = '·+xX#%@@@';
      for (let i = 0, n = s.n; i < n; i++) {
        if (a[i]) { ch[i] = G[nb[i]]; co[i] = s.colN[nb[i]]; }
        else if (fd[i]) { ch[i] = fd[i] > 1 ? ':' : '.'; co[i] = s.colFd[fd[i]]; }
      }
      return;
    }
    const look = p.look;
    for (let y = 0; y < H; y++) {
      for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
        if (a[j]) {
          let c1 = '█', c2 = '█', col;
          if (look === 'wall') { col = s.colAge[Math.min(31, (age[j] >> 2) + 4)]; const r = a[y * W + s.XP[x]]; c1 = '█'; c2 = r ? '█' : '▌'; }
          else if (look === 'age') { const ag = age[j]; col = f.C(0.35 + 0.65 * Math.max(0, 1 - ag / 60)); c1 = c2 = ag < 3 ? '█' : ag < 20 ? '▓' : '▒'; }
          else if (look === 'glyph') { const c = nb[j]; col = s.colN[c]; c1 = c < 3 ? '▓' : '█'; c2 = c < 2 ? '▒' : c1; }
          else col = s.colAge[Math.min(31, age[j])];
          ch[i] = c1; co[i] = col; ch[i + 1] = c2; co[i + 1] = col;
        } else if (fd[j] && look === 'glyph') {
          // 滑翔機拖出的點狀尾巴
          ch[i] = fd[j] > 1 ? ':' : '.'; co[i] = s.colFd[fd[j]];
        } else if (fd[j]) {
          const c = SH[Math.min(2, (fd[j] * 3 / Math.max(1, p.trail)) | 0)], col = s.colFd[fd[j]];
          ch[i] = c; co[i] = col; ch[i + 1] = c; co[i + 1] = col;
        }
      }
    }
  } });

/* ════════ 2. 世代自動機（Generations：多狀態衰亡規則） ════════ */
function genRule(str) {
  const [S, B, N] = str.split('/');
  const st = new Uint8Array(9), bt = new Uint8Array(9);
  for (const c of S) st[+c] = 1;
  for (const c of B) bt[+c] = 1;
  return { st, bt, N: Math.max(2, +N) };
}
A({ id: 'ca-gen', name: '世代自動機', cat: '生命', theme: 'ice',
  desc: '布萊恩大腦：放電細胞拖著衰減的尾巴',
  params: { rule: '/2/3', mode: 'pair', seed: 'soup', dens: 0.18, sps: 12, maxT: 120, look: 'shade', hue0: 190, hspan: 0, reseed: 3, glow: 1 },
  variants: [
    { id: 'cannons', name: '星際砲火', theme: 'cyber', desc: '固定的基地不斷射出成群的砲彈',
      params: { rule: '345/2/4', dens: 0.3, sps: 12, look: 'shade', reseed: 2.5 } },
    { id: 'belzhab', name: '化學漩渦', theme: 'rainbow', hue: true, desc: '類似 BZ 反應的彩色螺旋波',
      params: { rule: '23/23/8', dens: 0.3, sps: 12, look: 'hue', hue0: 0, hspan: 300 } },
    { id: 'frogs', name: '跳蛙', theme: 'forest', desc: '成群的小跳蛙在池面亂竄',
      params: { rule: '12/34/3', dens: 0.3, sps: 12, look: 'dot', reseed: 0.8, rsR: 0.06, rsD: 0.45, rsN: 2, glow: 1 } },
    { id: 'bloom', name: '花開', theme: 'sakura', hue: true, desc: '長尾的多狀態花瓣層層綻放',
      params: { rule: '234/34678/24', seed: 'center', dens: 0.5, sps: 14, look: 'hue', hue0: 300, hspan: 140, maxT: 60 } },
    { id: 'surf', name: '浪潮', theme: 'ocean', hue: true, desc: '十六狀態的波前互相碰撞交織',
      params: { rule: '1456/2356/16', dens: 0.2, sps: 12, look: 'hue', hue0: 170, hspan: 80 } },
    { id: 'spirals', name: '螺旋雲', theme: 'lavender', desc: '細小的螺旋紋在雲中生成又碎裂',
      params: { rule: '2/234/5', dens: 0.1, sps: 12, look: 'shade', mode: 'half', glow: 0 } },
  ],
  init(s, f) {
    const p = f.p, [W, H] = simSize(f, p.mode), n = W * H;
    const r = genRule(p.rule);
    Object.assign(s, { W, H, n, a: new Uint8Array(n), b: new Uint8Array(n), one: new Uint8Array(n), st: r.st, bt: r.bt, N: r.N, T: 0, hold: 0, quiet: 0, acc: 0, pop: 1 });
    [s.XM, s.XP] = wrapX(W);
    if (p.seed === 'center') blob(s.a, W, H, W / 2, H / 2, Math.max(3, W * 0.05), Math.max(3, W * 0.05) * (p.mode === 'char' ? 0.5 : 1), p.dens);
    else for (let i = 0; i < n; i++) s.a[i] = Math.random() < p.dens ? 1 : 0;
    const N = r.N, C = f.C, H2 = f.H;
    s.col = []; s.chA = []; s.chB = [];
    for (let k = 0; k < N; k++) {
      const t = k === 0 ? 0 : k === 1 ? 1 : 0.85 * (1 - (k - 1) / (N - 1)) + 0.08;
      let col, c;
      if (p.look === 'hue') { col = k === 1 ? H2(p.hue0, 0.98) : H2(p.hue0 + p.hspan * (k - 1) / Math.max(1, N - 2), 0.25 + 0.55 * t); c = k === 1 ? '█' : SH[Math.min(3, (t * 4) | 0)]; }
      else if (p.look === 'ramp') { col = C(t); c = k === 1 ? '@' : RAMP10[Math.max(1, Math.min(8, (t * 9) | 0))]; }
      else if (p.look === 'dot') { col = C(0.2 + 0.8 * t); c = k === 1 ? '●' : k === 2 ? 'o' : '·'; }
      else { col = C(t); c = k === 1 ? '█' : SH[Math.min(2, (t * 3.2) | 0)]; }
      s.col.push(col); s.chA.push(c); s.chB.push(p.look === 'dot' ? ' ' : c);
    }
  },
  step(s) {
    const { W, H, XM, XP, st, bt, N, one } = s, a = s.a, b = s.b, n = s.n;
    for (let i = 0; i < n; i++) one[i] = a[i] === 1 ? 1 : 0;
    let changed = 0, pop = 0;
    for (let y = 0; y < H; y++) {
      const ym = ((y + H - 1) % H) * W, y0 = y * W, yp = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) {
        const i = y0 + x, o = a[i];
        let v;
        if (o > 1) v = o + 1 < N ? o + 1 : 0;
        else {
          const xm = XM[x], xp = XP[x];
          const c = one[ym + xm] + one[ym + x] + one[ym + xp] + one[y0 + xm] + one[y0 + xp] + one[yp + xm] + one[yp + x] + one[yp + xp];
          v = o === 0 ? bt[c] : st[c] ? 1 : N > 2 ? 2 : 0;
        }
        b[i] = v; if (v) pop++; if (v !== o) changed++;
      }
    }
    s.a = b; s.b = a; s.pop = pop;
    return changed;
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols;
    s.T += f.dt;
    if (s.hold > 0) { s.hold -= f.dt; if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); } }
    else {
      if (p.reseed && (s.rs = (s.rs || 0) + f.dt) > p.reseed) {
        s.rs = 0;
        for (let q = p.rsN || 1; q > 0; q--) {
          const r = Math.max(3, s.W * (p.rsR ? p.rsR * rnd(0.8, 1.2) : rnd(0.03, 0.06)));
          blob(s.a, s.W, s.H, rnd(0, s.W), rnd(0, s.H), r, r * (p.mode === 'char' ? 0.5 : 1), p.rsD || 0.35);
        }
      }
      let k = due(s, f.dt, p.sps, 3);
      while (k-- > 0) s.quiet = this.step(s) === 0 ? s.quiet + 1 : 0;
      if (s.pop === 0 || s.quiet > 20 || s.T > p.maxT) s.hold = 1.5;
    }
    const { W, H, a, col, chA, chB } = s, ch = g.ch, co = g.co;
    if (p.glow && p.mode !== 'char') {
      // 放電後留下慢慢消失的餘光（每一格都會變，動起來比較順）
      if (!s.gl || s.gl.length !== s.n) { s.gl = new Float32Array(s.n); s.glc = Array.from({ length: 8 }, (_, k) => f.C(0.08 + k * 0.035)); }
      const gl = s.gl, dk = Math.exp(-f.dt * 2.2);
      for (let j = 0; j < s.n; j++) gl[j] = a[j] === 1 ? 1 : gl[j] * dk;
      if (p.mode === 'half') {
        // 上下半格：兩半都沒有活細胞時，取較亮的餘光
        for (let cy = 0; cy < g.rows; cy++) for (let x = 0, j0 = cy * 2 * W, i = cy * cols; x < W; x++, i++) {
          const j1 = j0 + W + x;
          if (a[j0 + x] || a[j1]) continue;
          const v = Math.max(gl[j0 + x], gl[j1]);
          if (v < 0.12) continue;
          ch[i] = '░'; co[i] = s.glc[Math.min(7, (v * 8) | 0)];
        }
      } else for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
        if (a[j] || gl[j] < 0.12) continue;
        const c = s.glc[Math.min(7, (gl[j] * 8) | 0)];
        ch[i] = '░'; co[i] = c; ch[i + 1] = '░'; co[i + 1] = c;
      }
    }
    if (p.mode === 'char') {
      for (let i = 0; i < s.n; i++) { const v = a[i]; if (v) { ch[i] = chA[v]; co[i] = col[v]; } }
      return;
    }
    if (p.mode === 'half') {
      // 上下兩格取較亮的狀態（1 最亮，其次數字越小越亮）
      for (let cy = 0; cy < g.rows; cy++) {
        const j0 = cy * 2 * W, j1 = j0 + W;
        for (let x = 0, i = cy * cols; x < W; x++, i++) {
          const t = a[j0 + x], u = a[j1 + x];
          if (!t && !u) continue;
          const m = !t ? u : !u ? t : Math.min(t, u);
          ch[i] = t && u ? chA[m] : t ? '▀' : '▄';
          co[i] = col[m];
        }
      }
      return;
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
        const v = a[j];
        if (!v) continue;
        ch[i] = chA[v]; co[i] = col[v]; ch[i + 1] = chB[v]; co[i + 1] = col[v];
      }
    }
  } });

/* ════════ 3. 電路世界（Wireworld） ════════ */
// 導線都放在「間隔 2 格」的格點上：節點在奇數座標，連線在節點之間，不同的導線永遠不會互相碰到。
const BOX_L = '·│─└││┌├─┘─┴┐┤┬┼', BOX_H = '•┃━┗┃┃┏┣━┛━┻┓┫┳╋';
const DX4 = [1, 0, -1, 0], DY4 = [0, 1, 0, -1];
A({ id: 'ca-wire', name: '電路世界', cat: '生命', theme: 'amber',
  desc: '線路世界規則：電子沿著電路板導線奔流',
  params: { layout: 'pcb', mode: 'pair', sps: 15, period: 9, cover: 0.5, chips: 1 },
  variants: [
    { id: 'maze', name: '迷宮電網', theme: 'cyber', desc: '電子從中心湧出，流遍整座迷宮導線',
      params: { layout: 'maze', period: 7, sps: 16 } },
    { id: 'htree', name: 'H 形樹', theme: 'gold', desc: '碎形 H 樹的每一根分支同時亮起',
      params: { layout: 'htree', period: 12, sps: 14 } },
    { id: 'bus', name: '資料匯流排', theme: 'ice', desc: '平行匯流排上的資料脈衝川流不息',
      params: { layout: 'bus', period: 6, sps: 18 } },
    { id: 'spiral', name: '螺旋線圈', theme: 'neon', desc: '一條長長的方形螺旋，電子一路繞出去',
      params: { layout: 'spiral', period: 5, sps: 18 } },
    { id: 'rings', name: '同心時鐘', theme: 'mint', desc: '同心迴圈裡的電子繞圈，經輻條互相干擾',
      params: { layout: 'rings', period: 0, sps: 14 } },
    { id: 'fine', name: '細密基板', theme: 'matrix', desc: '高密度的細導線基板，脈衝四處竄流',
      params: { layout: 'pcb', mode: 'char', cover: 0.62, chips: 0, period: 7, sps: 18 } },
    { id: 'tree', name: '分岔樹', theme: 'sunset', desc: '從底部長出的導線樹，電流往上分岔',
      params: { layout: 'tree', period: 6, sps: 16 } },
  ],
  init(s, f) {
    const p = f.p, [W, H] = simSize(f, p.mode), n = W * H;
    const NX = Math.max(3, (W - 1) >> 1), NY = Math.max(3, (H - 1) >> 1);
    const a = new Uint8Array(n), used = new Uint8Array(NX * NY), deg = new Uint8Array(NX * NY);
    Object.assign(s, { W, H, n, NX, NY, a, b: null, roots: [], deco: [], acc: 0, step: 0, rings: [] });
    const cell = (nx, ny) => (1 + 2 * ny) * W + 1 + 2 * nx;
    const inb = (nx, ny) => nx >= 0 && ny >= 0 && nx < NX && ny < NY;
    const link = (x0, y0, x1, y1) => {
      const i0 = y0 * NX + x0, i1 = y1 * NX + x1;
      used[i0] = used[i0] || 1; used[i1] = used[i1] || 1; deg[i0]++; deg[i1]++;
      a[cell(x0, y0)] = 1; a[cell(x1, y1)] = 1; a[(cell(x0, y0) + cell(x1, y1)) >> 1] = 1;
    };
    const free = (nx, ny) => inb(nx, ny) && !used[ny * NX + nx];
    const L = p.layout;
    if (L === 'pcb' || L === 'tree') {
      const tips = [];
      if (L === 'tree') {
        for (let k = 0, m = Math.max(2, Math.round(NX / 9)); k < m; k++) {
          const x = Math.round((k + 0.5) * NX / m);
          if (free(x, NY - 1)) { used[(NY - 1) * NX + x] = 1; tips.push({ x, y: NY - 1, d: 3, up: 1 }); s.roots.push({ i: cell(x, NY - 1), per: p.period, ph: rint(0, 5) }); }
        }
      } else {
        if (p.chips) {
          for (let k = 0, tries = 0; k < Math.max(2, (NX * NY / 260) | 0) && tries < 200; tries++) {
            const cw = rint(3, Math.max(3, Math.min(9, NX >> 3))), chh = rint(2, Math.max(2, Math.min(5, NY >> 3)));
            const x0 = rint(1, NX - cw - 2), y0 = rint(1, NY - chh - 2);
            let ok = x0 > 0 && y0 > 0;
            for (let y = y0 - 1; ok && y <= y0 + chh; y++) for (let x = x0 - 1; x <= x0 + cw; x++) if (!inb(x, y) || used[y * NX + x]) { ok = false; break; }
            if (!ok) continue;
            k++;
            for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) used[y * NX + x] = 2;
            for (let y = 1 + 2 * y0 - 1; y <= 1 + 2 * (y0 + chh - 1) + 1; y++) for (let x = 1 + 2 * x0 - 1; x <= 1 + 2 * (x0 + cw - 1) + 1; x++) s.deco.push(y * W + x);
            // 晶片四周的接腳就是電子的來源
            for (let x = x0; x < x0 + cw; x++) for (const [yy, d] of [[y0 - 1, 3], [y0 + chh, 1]]) if (Math.random() < 0.5 && free(x, yy)) { used[yy * NX + x] = 1; tips.push({ x, y: yy, d }); s.roots.push({ i: cell(x, yy), per: p.period + rint(0, 8), ph: rint(0, 20) }); }
            for (let y = y0; y < y0 + chh; y++) for (const [xx, d] of [[x0 - 1, 2], [x0 + cw, 0]]) if (Math.random() < 0.6 && free(xx, y)) { used[y * NX + xx] = 1; tips.push({ x: xx, y, d }); s.roots.push({ i: cell(xx, y), per: p.period + rint(0, 8), ph: rint(0, 20) }); }
          }
        }
        for (let k = 0, m = Math.max(3, (NX * NY / 300) | 0); k < m; k++) {
          const x = rint(0, NX - 1), y = rint(0, NY - 1);
          if (!free(x, y)) continue;
          used[y * NX + x] = 1; tips.push({ x, y, d: rint(0, 3) }); s.roots.push({ i: cell(x, y), per: p.period + rint(0, 6), ph: rint(0, 20) });
        }
        for (const t of tips) a[cell(t.x, t.y)] = 1;
      }
      for (const t of tips) a[cell(t.x, t.y)] = 1;
      let count = 0;
      const target = NX * NY * p.cover;
      while (tips.length && count < target) {
        const k = (Math.random() * tips.length) | 0, t = tips[k];
        let d = t.d;
        if (t.up) { if (Math.random() < 0.3) d = Math.random() < 0.5 ? 0 : 2; else d = 3; }
        else if (Math.random() < 0.16) d = (d + (Math.random() < 0.5 ? 1 : 3)) & 3;
        let moved = false;
        for (const dd of [d, (d + 1) & 3, (d + 3) & 3]) {
          const nx = t.x + DX4[dd], ny = t.y + DY4[dd];
          if (t.up && dd === 1) continue;
          if (!free(nx, ny) || deg[t.y * NX + t.x] >= 3) continue;
          link(t.x, t.y, nx, ny); count++;
          if (Math.random() < (t.up ? 0.2 : 0.06)) tips.push({ x: t.x, y: t.y, d: (dd + (Math.random() < 0.5 ? 1 : 3)) & 3, up: t.up });
          t.x = nx; t.y = ny; t.d = dd; moved = true; break;
        }
        if (!moved) { tips[k] = tips[tips.length - 1]; tips.pop(); }
      }
    } else if (L === 'maze') {
      const cx = NX >> 1, cy = NY >> 1, st = [[cx, cy]];
      used[cy * NX + cx] = 1; a[cell(cx, cy)] = 1;
      s.roots.push({ i: cell(cx, cy), per: p.period, ph: 0 });
      while (st.length) {
        const [x, y] = st[st.length - 1];
        const opts = [];
        if (deg[y * NX + x] < 3) for (let d = 0; d < 4; d++) if (free(x + DX4[d], y + DY4[d])) opts.push(d);
        if (!opts.length) { st.pop(); continue; }
        const d = pick(opts);
        link(x, y, x + DX4[d], y + DY4[d]);
        st.push([x + DX4[d], y + DY4[d]]);
      }
    } else if (L === 'htree') {
      const cx = NX >> 1, cy = NY >> 1;
      s.roots.push({ i: cell(cx, cy), per: p.period, ph: 0 });
      const seg = (x, y, horiz, lx, ly, depth) => {
        const len = horiz ? lx : ly;
        if (len < 1 || depth > 12) return;
        const ends = [];
        for (const sg of [-1, 1]) {
          let px = x, py = y;
          for (let k = 0; k < len; k++) {
            const nx = px + (horiz ? sg : 0), ny = py + (horiz ? 0 : sg);
            if (!inb(nx, ny) || (used[ny * NX + nx] && k < len - 1)) break;
            if (used[ny * NX + nx]) break;
            link(px, py, nx, ny); px = nx; py = ny;
          }
          ends.push([px, py]);
        }
        for (const [ex, ey] of ends) if (ex !== x || ey !== y) seg(ex, ey, !horiz, horiz ? Math.floor(lx / 2) : lx, horiz ? ly : Math.floor(ly / 2), depth + 1);
      };
      used[cy * NX + cx] = 1; a[cell(cx, cy)] = 1;
      seg(cx, cy, true, Math.max(1, Math.round(NX / 4)), Math.max(1, Math.round(NY / 4)), 0);
    } else if (L === 'bus') {
      // 每隔一列一條橫貫全螢幕的匯流排，左端或右端送出脈衝；相鄰兩條只用一根跳線接起來（沒有迴圈）
      for (let y = 0; y < NY; y += 2) {
        for (let x = 0; x + 1 < NX; x++) link(x, y, x + 1, y);
        const left = Math.random() < 0.65;
        s.roots.push({ i: cell(left ? 0 : NX - 1, y), per: p.period + rint(0, 9), ph: rint(0, 30) });
        if (y >= 2) for (let t = 0; t < 20; t++) { const x = rint(2, NX - 3); if (free(x, y - 1)) { link(x, y - 2, x, y - 1); link(x, y - 1, x, y); break; } }
      }
    } else if (L === 'spiral') {
      const d = Math.max(0, NX - NY);
      let x = Math.max(0, (NX >> 1) - (d >> 1)), y = NY >> 1;
      used[y * NX + x] = 1; a[cell(x, y)] = 1;
      s.roots.push({ i: cell(x, y), per: p.period, ph: 0 });
      out: for (let j = 0; j < 4000; j++) {
        const dir = j & 3, len = (j % 2 === 0 ? d : 0) + (j >> 1) + 1;
        for (let k = 0; k < len; k++) {
          const nx = x + DX4[dir], ny = y + DY4[dir];
          if (!free(nx, ny)) break out;
          link(x, y, nx, ny); x = nx; y = ny;
        }
      }
    } else if (L === 'rings') {
      // 同心長方形迴圈，相鄰兩圈之間隔一個節點，偶爾用輻條接起來
      const cx = NX >> 1, cy = NY >> 1;
      for (let r = 1; ; r++) {
        const rx = r * 2 + Math.max(0, (NX - NY) >> 1), ry = r * 2;
        if (cx - rx < 0 || cy - ry < 0 || cx + rx >= NX || cy + ry >= NY) break;
        const ring = [];
        const pts = [];
        for (let x = cx - rx; x < cx + rx; x++) pts.push([x, cy - ry]);
        for (let y = cy - ry; y < cy + ry; y++) pts.push([cx + rx, y]);
        for (let x = cx + rx; x > cx - rx; x--) pts.push([x, cy + ry]);
        for (let y = cy + ry; y > cy - ry; y--) pts.push([cx - rx, y]);
        for (let k = 0; k < pts.length; k++) {
          const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % pts.length];
          link(x0, y0, x1, y1);
          ring.push(cell(x0, y0), (cell(x0, y0) + cell(x1, y1)) >> 1);
        }
        s.rings.push({ cells: ring, dir: r % 2 ? 1 : -1 });
        if (r > 1) {
          for (let q = rint(1, 3); q > 0; q--) {
            const side = rint(0, 3);
            let x, y, dx = 0, dy = 0;
            if (side === 0) { x = rint(cx - rx + 2, cx + rx - 2); y = cy - ry; dy = 1; }
            else if (side === 1) { x = rint(cx - rx + 2, cx + rx - 2); y = cy + ry; dy = -1; }
            else if (side === 2) { y = rint(cy - ry + 2, cy + ry - 2); x = cx - rx; dx = 1; }
            else { y = rint(cy - ry + 2, cy + ry - 2); x = cx + rx; dx = -1; }
            if (deg[y * NX + x] >= 3 || deg[(y + 2 * dy) * NX + x + 2 * dx] >= 3 || used[(y + dy) * NX + x + dx]) continue;
            link(x, y, x + dx, y + dy); link(x + dx, y + dy, x + 2 * dx, y + 2 * dy);
          }
        }
      }
    }
    // 導線清單、鄰居表、框線字元
    const wl = [];
    for (let i = 0; i < n; i++) if (a[i]) wl.push(i);
    const m = wl.length, nb = new Int32Array(m * 8).fill(-1), box = new Uint8Array(m), rcon = new Uint8Array(m);
    for (let k = 0; k < m; k++) {
      const i = wl[k], x = i % W, y = (i / W) | 0;
      let q = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H || !a[Y * W + X]) continue;
        nb[k * 8 + q++] = Y * W + X;
      }
      const U = y > 0 && a[i - W], R = x < W - 1 && a[i + 1], D = y < H - 1 && a[i + W], Lf = x > 0 && a[i - 1];
      box[k] = (U ? 1 : 0) | (R ? 2 : 0) | (D ? 4 : 0) | (Lf ? 8 : 0);
      rcon[k] = R ? 1 : 0;
    }
    Object.assign(s, { wl: Int32Array.from(wl), m, nb, box, rcon, b: a.slice() });
    // 迴圈先放電子：頭在前、尾在後
    for (const r of s.rings) {
      const c = r.cells, L2 = c.length;
      for (let e = 0, ne = Math.max(1, Math.round(L2 / 30)); e < ne; e++) {
        const k = Math.floor((e + Math.random() * 0.5) * L2 / ne);
        s.a[c[k]] = 2; s.a[c[(k - r.dir + L2) % L2]] = 3;
      }
    }
    const C = f.C;
    s.cw = C(0.22); s.ct = C(0.55); s.ch = C(1); s.cd = C(0.13);
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols;
    let k = due(s, f.dt, p.sps, 3);
    while (k-- > 0) {
      s.step++;
      for (const r of s.roots) if ((s.step + r.ph) % r.per === 0 && s.a[r.i] === 1) s.a[r.i] = 2;
      if (p.rinj && s.step % p.period === 0 && s.m) { const i = s.wl[(Math.random() * s.m) | 0]; if (s.a[i] === 1) s.a[i] = 2; }
      const { wl, m, nb } = s, a = s.a, b = s.b;
      let heads = 0;
      for (let q = 0; q < m; q++) {
        const i = wl[q], v = a[i];
        if (v === 2) b[i] = 3;
        else if (v === 3) b[i] = 1;
        else {
          let c = 0;
          for (let o = q * 8, e = o + 8; o < e; o++) { const j = nb[o]; if (j < 0) break; if (a[j] === 2) c++; }
          if (c === 1 || c === 2) { b[i] = 2; heads++; } else b[i] = 1;
        }
      }
      s.a = b; s.b = a;
      // 太安靜就在隨機的導線上補一個電子
      if (heads < 2 && m) { const i = wl[(Math.random() * m) | 0]; if (s.a[i] === 1) s.a[i] = 2; }
    }
    const { W, wl, m, box, rcon, a } = s, ch = g.ch, co = g.co, pair = p.mode !== 'char';
    for (const i of s.deco) { const x = i % W, y = (i / W) | 0, o = pair ? y * cols + 2 * x : y * cols + x; ch[o] = '▒'; co[o] = s.cd; if (pair) { ch[o + 1] = '▒'; co[o + 1] = s.cd; } }
    for (let q = 0; q < m; q++) {
      const i = wl[q], v = a[i], x = i % W, y = (i / W) | 0, o = pair ? y * cols + 2 * x : y * cols + x;
      const hv = v > 1, col = v === 2 ? s.ch : v === 3 ? s.ct : s.cw;
      ch[o] = hv ? BOX_H[box[q]] : BOX_L[box[q]]; co[o] = col;
      if (pair && rcon[q]) { ch[o + 1] = hv ? '━' : '─'; co[o + 1] = col; }
    }
  } });

/* ════════ 4. 一維自動機（基本規則與三色總和規則，逐列捲動） ════════ */
A({ id: 'ca-elem', name: '一維自動機', cat: '生命', theme: 'ice',
  desc: '規則 30：每列由上一列算出，混沌不斷湧出',
  params: { rule: 30, k3: 0, mode: 'braille', init: 'one', rps: 32, dir: 'up', color: 'time', restart: 0, dens: 0.5 },
  variants: [
    { id: 'r90', name: '謝爾賓斯基', theme: 'rainbow', hue: true, desc: '規則 90 不斷畫出彩色碎形三角',
      params: { rule: 90, mode: 'half', init: 'one', rps: 22, color: 'hue', restart: 1 } },
    { id: 'r110', name: '滑翔粒子', theme: 'amber', desc: '規則 110 的粒子在背景紋理上穿梭',
      params: { rule: 110, mode: 'char', init: 'rand', rps: 14, dir: 'down' } },
    { id: 'r184', name: '車流', theme: 'cyber', desc: '規則 184 的交通流，塞車波往回傳',
      params: { rule: 184, mode: 'braille', init: 'rand', dens: 0.53, rps: 40, dir: 'side', color: 'state', jam: 1, perturb: 4, pd: [0.85, 0.2] } },
    { id: 'r150', name: '萬花筒', theme: 'rainbow', hue: true, desc: '規則 150 從中線向上下對稱展開',
      params: { rule: 150, mode: 'braille', init: 'one', rps: 28, dir: 'mirror', color: 'hue', restart: 1 } },
    { id: 'r45', name: '亂流', theme: 'blood', desc: '規則 45 的亂流由上往下傾瀉',
      params: { rule: 45, mode: 'half', init: 'rand', rps: 20, dir: 'down' } },
    { id: 'r73', name: '竹林', theme: 'forest', desc: '規則 73 長出一節一節的竹子',
      params: { rule: 73, mode: 'half', init: 'rand', rps: 20, dens: 0.55, perturb: 4, pd: [0.5] } },
    { id: 'k3', name: '三色總和', theme: 'sunset', desc: '三色總和規則從一點長出繁複圖騰',
      params: { k3: 357, mode: 'braille', init: 'one', rps: 30, color: 'state', restart: 2 } },
    { id: 'r30side', name: '側流', theme: 'lavender', desc: '規則 30 改成由右向左流動',
      params: { rule: 30, mode: 'half', init: 'rand', dens: 0.5, rps: 26, dir: 'side' } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows } = f;
    const [Wd, Hd] = p.mode === 'braille' ? [cols * 2, rows * 4] : p.mode === 'half' ? [cols, rows * 2] : [cols, rows];
    const S = p.dir === 'side' ? Hd : Wd, T = p.dir === 'mirror' ? (Hd >> 1) + 2 : p.dir === 'side' ? Wd : Hd;
    Object.assign(s, { Wd, Hd, S, T, hist: new Uint8Array(T * S), pix: new Uint8Array(Wd * Hd), g: 0, acc: 0, born: 0 });
    // 規則表：基本規則用 3 格的 8 種組合，三色總和規則用總和 0–6
    if (p.k3) { s.tab = new Uint8Array(7); let c = p.k3; for (let k = 0; k < 7; k++) { s.tab[k] = c % 3; c = Math.floor(c / 3); } }
    else { s.tab = new Uint8Array(8); for (let k = 0; k < 8; k++) s.tab[k] = (p.rule >> k) & 1; }
    this.seed(s, p, s.hist.subarray(0, S));
    const C = f.C, H = f.H;
    s.pal = [''];
    for (let b = 0; b < 32; b++) {
      const k = b & 15, hi = b >= 16;
      if (p.color === 'hue') s.pal.push(H(k * 22.5, 0.62));
      else if (p.color === 'state') s.pal.push(hi ? C(1 - k / 15 * 0.45) : C(0.62 - k / 15 * 0.4));
      else s.pal.push(C(1 - k / 15 * 0.72));
    }
  },
  seed(s, p, row) {
    row.fill(0);
    if (p.init === 'one') row[row.length >> 1] = 1;
    else for (let x = 0; x < row.length; x++) row[x] = Math.random() < p.dens ? (p.k3 ? rint(1, 2) : 1) : 0;
    s.born = s.g;
  },
  gen(s, p) {
    const { S, T, hist, tab } = s, prev = hist.subarray((s.g % T) * S, (s.g % T) * S + S);
    s.g++;
    const row = hist.subarray((s.g % T) * S, (s.g % T) * S + S);
    if (p.restart && s.g - s.born >= (S >> 1) * (p.restart === 2 ? 0.9 : 1)) { this.seed(s, p, row); return; }
    let any = 0;
    if (p.k3) {
      for (let x = 0; x < S; x++) { const v = tab[prev[x ? x - 1 : S - 1] + prev[x] + prev[x < S - 1 ? x + 1 : 0]]; row[x] = v; any |= v; }
    } else {
      for (let x = 0; x < S; x++) { const v = tab[(prev[x ? x - 1 : S - 1] << 2) | (prev[x] << 1) | prev[x < S - 1 ? x + 1 : 0]]; row[x] = v; any |= v; }
    }
    if (!any) this.seed(s, { init: 'rand', dens: 0.3, k3: p.k3 }, row);
    if (s.kick) {
      // 擾動：把最新一列的一小段重新打亂，長出新的紋路（車流則是製造塞車或空檔）
      s.kick = false;
      const len = Math.round(S * rnd(0.1, 0.2)), x0 = rint(0, S - 1), d = p.pd ? p.pd[(s.kc = (s.kc || 0) + 1) % p.pd.length] : 0.5;
      for (let q = 0; q < len; q++) row[(x0 + q) % S] = Math.random() < d ? (p.k3 ? rint(1, 2) : 1) : 0;
    }
  },
  frame(s, f) {
    const p = f.p, g = f.g;
    if (p.perturb && (s.pt = (s.pt || 0) + f.dt) > p.perturb) { s.pt = 0; s.kick = true; }
    let k = due(s, f.dt, p.rps, 12);
    while (k-- > 0) this.gen(s, p);
    const { Wd, Hd, S, T, hist, pix } = s, G = s.g, dir = p.dir, hue = p.color === 'hue', st = p.color === 'state';
    // 把歷史畫到像素：值 = 1 + 顏色編號（依年齡或世代）
    pix.fill(0);
    const val = (a, v) => {
      const b = hue ? ((G - a) >> 3) & 15 : Math.min(15, ((a * 16) / T) | 0);
      return 1 + b + (st && v === 2 ? 16 : 0);
    };
    if (dir === 'side') {
      for (let px = 0; px < Wd; px++) {
        const a = Wd - 1 - px;
        if (a > G) continue;
        const o = ((G - a) % T) * S, jam = p.jam;
        for (let py = 0; py < Hd; py++) {
          const v = hist[o + py];
          // 車流：前面有車而停住的車子畫得比較亮，塞車波就看得出來
          if (v) pix[py * Wd + px] = val(a, jam && hist[o + (py + 1 < S ? py + 1 : 0)] ? 2 : v);
        }
      }
    } else {
      const c = Hd >> 1;
      for (let py = 0; py < Hd; py++) {
        const a = dir === 'up' ? Hd - 1 - py : dir === 'down' ? py : Math.abs(py - c);
        if (a > G || a >= T) continue;
        const o = ((G - a) % T) * S, r = py * Wd;
        const v1 = val(a, 1), v2 = val(a, 2);
        for (let x = 0; x < Wd; x++) { const v = hist[o + x]; if (v) pix[r + x] = v === 2 ? v2 : v1; }
      }
    }
    const ch = g.ch, co = g.co, cols = g.cols, pal = s.pal;
    if (p.mode === 'braille') {
      const W = Wd, W2 = W * 2, W3 = W * 3;
      for (let cy = 0; cy < g.rows; cy++) {
        let j = cy * 4 * W, i = cy * cols;
        for (let cx = 0; cx < cols; cx++, j += 2, i++) {
          const a0 = pix[j], a1 = pix[j + W], a2 = pix[j + W2], a3 = pix[j + W3], b0 = pix[j + 1], b1 = pix[j + W + 1], b2 = pix[j + W2 + 1], b3 = pix[j + W3 + 1];
          const bits = (a0 ? 1 : 0) | (a1 ? 2 : 0) | (a2 ? 4 : 0) | (a3 ? 64 : 0) | (b0 ? 8 : 0) | (b1 ? 16 : 0) | (b2 ? 32 : 0) | (b3 ? 128 : 0);
          if (!bits) continue;
          ch[i] = BRL[bits]; co[i] = pal[Math.max(a0, a1, a2, a3, b0, b1, b2, b3)];
        }
      }
    } else if (p.mode === 'half') {
      for (let cy = 0; cy < g.rows; cy++) {
        const j0 = cy * 2 * Wd, j1 = j0 + Wd;
        for (let x = 0, i = cy * cols; x < Wd; x++, i++) {
          const t = pix[j0 + x], u = pix[j1 + x];
          if (!t && !u) continue;
          ch[i] = t && u ? '█' : t ? '▀' : '▄'; co[i] = pal[Math.max(t, u)];
        }
      }
    } else {
      for (let i = 0; i < g.n; i++) { const v = pix[i]; if (v) { ch[i] = '█'; co[i] = pal[v]; } }
    }
  } });

/* ════════ 5. 循環自動機（Griffeath 循環規則與 Greenberg–Hastings 可激發介質） ════════ */
A({ id: 'ca-cyclic', name: '循環自動機', cat: '生命', theme: 'rainbow', hue: true,
  desc: '每種顏色吃掉上一種，螺旋波自己長出來',
  params: { R: 1, T: 3, N: 3, nb: 'M', sps: 14, look: 'block', maxT: 80, gh: 0, mode: 'pair' },
  variants: [
    { id: 'perfect', name: '完美螺旋', theme: 'neon', hue: false, desc: '五狀態的細密螺旋，像唱片紋路',
      params: { R: 1, T: 2, N: 5, nb: 'M', sps: 16, look: 'shade' } },
    { id: 'square', name: '方形螺旋', theme: 'gold', hue: false, desc: '馮紐曼鄰域長出方方正正的螺旋',
      params: { R: 2, T: 2, N: 6, nb: 'N', sps: 14, look: 'shade' } },
    { id: 'big', name: '巨型漩渦', desc: '大範圍鄰域讓螺旋又寬又平滑',
      params: { R: 3, T: 5, N: 8, nb: 'M', sps: 10, maxT: 110 } },
    { id: 'stripes', name: '流紋', theme: 'ocean', hue: false, desc: '條紋狀的波前一層層推進',
      params: { R: 3, T: 4, N: 5, nb: 'N', sps: 10, look: 'ramp', mode: 'char' } },
    { id: 'excite', name: '可激發介質', theme: 'ice', hue: false, desc: '興奮與不反應期交替，螺旋波打轉',
      params: { gh: 1, R: 1, T: 1, N: 9, nb: 'M', sps: 14, look: 'glow' } },
  ],
  init(s, f) {
    const p = f.p, [W, H] = simSize(f, p.mode), n = W * H, N = p.N;
    // 小縮圖上大鄰域會退化成整片平面波，改用小一點的鄰域與門檻
    const R = p.R > 2 && W < 80 ? 2 : p.R, Tn = R === p.R ? p.T : Math.max(1, Math.round(p.T * 0.55));
    const a = new Uint8Array(n);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * N) | 0;
    if (p.gh) for (let i = 0; i < n; i++) a[i] = Math.random() < 0.08 ? 1 : Math.random() < 0.5 ? 0 : rint(2, N - 1);
    const off = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (!dx && !dy) continue;
      if (p.nb === 'N' && Math.abs(dx) + Math.abs(dy) > R) continue;
      off.push(dx, dy);
    }
    const rowI = [], colI = [];
    for (let d = -R; d <= R; d++) {
      rowI.push(Int32Array.from({ length: H }, (_, y) => ((y + d + H * 4) % H) * W));
      colI.push(Int32Array.from({ length: W }, (_, x) => (x + d + W * 4) % W));
    }
    Object.assign(s, { W, H, n, R, Tn, a, b: new Uint8Array(n), off: Int32Array.from(off), rowI, colI, T: 0, acc: 0, chk: 0, flat: 0, hist: new Int32Array(N) });
    const C = f.C, Hh = f.H;
    s.col = []; s.chs = [];
    for (let k = 0; k < N; k++) {
      const u = k / N;
      if (p.look === 'glow') { const t = k === 0 ? 0 : k === 1 ? 1 : 0.75 * (1 - (k - 2) / Math.max(1, N - 2)) + 0.12; s.col.push(C(t)); s.chs.push(k === 0 ? ' ' : k === 1 ? '█' : SH[Math.min(3, (t * 4) | 0)]); }
      else if (p.look === 'shade') { s.col.push(C(0.15 + 0.85 * u)); s.chs.push(SH[Math.min(3, (u * 4) | 0)]); }
      else if (p.look === 'ramp') { s.col.push(C(0.2 + 0.8 * u)); s.chs.push(RAMP10[1 + Math.min(8, (u * 9) | 0)]); }
      else { s.col.push(Hh(k * 360 / N, 0.3 + 0.45 * u)); s.chs.push('█'); }
    }
  },
  step(s, p) {
    const { W, H, off, rowI, colI, R, Tn } = s, a = s.a, b = s.b, N = p.N, no = off.length;
    let changed = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, v = a[i];
        let nx;
        if (p.gh) {
          if (v > 0) { nx = v + 1 < N ? v + 1 : 0; b[i] = nx; changed++; continue; }
          nx = 1;
        } else nx = v + 1 < N ? v + 1 : 0;
        const want = p.gh ? 1 : nx;
        let c = 0;
        for (let k = 0; k < no; k += 2) {
          if (a[rowI[off[k + 1] + R][y] + colI[off[k] + R][x]] === want && ++c >= Tn) break;
        }
        if (c >= Tn) { b[i] = nx; changed++; } else b[i] = v;
      }
    }
    s.a = b; s.b = a;
    return changed;
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols;
    s.T += f.dt;
    if (s.T > p.maxT) { this.init(s, f); }
    let k = due(s, f.dt, p.sps, 2);
    while (k-- > 0) {
      const c = this.step(s, p);
      // 整片變成同一色（沒有螺旋核心）就重新開始
      s.still = c < s.n * 0.001 ? (s.still || 0) + 1 : 0;
      if (!p.gh && s.still > 12) { this.init(s, f); break; }
      // 可激發介質全部熄滅時，隨機點燃幾處
      if (p.gh && c < s.n * 0.002) for (let q = 0; q < 6; q++) blob(s.a, s.W, s.H, rnd(0, s.W), rnd(0, s.H), 2, 2, 0.6, 1);
    }
    if (!p.gh && (s.chk += f.dt) > 1) {
      // 每秒檢查一次：單一顏色佔滿七成，或整個畫面變成一道平面波（每列或每欄都一樣），就重新開始
      s.chk = 0;
      const { W, H, a, hist } = s;
      hist.fill(0);
      let m = 0;
      for (let i = 0; i < s.n; i += 7) hist[a[i]]++, m++;
      let top = 0; for (let k = 0; k < p.N; k++) if (hist[k] > top) top = hist[k];
      let rowsSame = true, colsSame = true;
      for (let x = 0, r1 = (H >> 1) * W, r2 = (H >> 2) * W; x < W && rowsSame; x++) if (a[x] !== a[r1 + x] || a[x] !== a[r2 + x]) rowsSame = false;
      for (let y = 0, c1 = W >> 1, c2 = W >> 2; y < H && colsSame; y++) if (a[y * W] !== a[y * W + c1] || a[y * W] !== a[y * W + c2]) colsSame = false;
      s.flat = rowsSame || colsSame ? s.flat + 1 : 0;
      if (top > m * 0.7 || s.flat > 2) { this.init(s, f); }
    }
    const { W, H, a, col, chs } = s, ch = g.ch, co = g.co;
    if (p.mode === 'char') { for (let i = 0; i < s.n; i++) { const v = a[i]; ch[i] = chs[v]; co[i] = col[v]; } return; }
    if (p.mode === 'half') {
      for (let cy = 0; cy < g.rows; cy++) {
        // 模擬格是上下半格，但每格只能有一種顏色：整格用上半的顏色
        // （畫 ▀/▄ 的話另一半會露出底色，看起來像黑色掃描線）
        const j0 = cy * 2 * W;
        for (let x = 0, i = cy * cols; x < W; x++, i++) { ch[i] = '█'; co[i] = col[a[j0 + x]]; }
      }
      return;
    }
    for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
      const v = a[j], c = chs[v];
      if (c === ' ') continue;
      ch[i] = c; co[i] = col[v]; ch[i + 1] = c; co[i + 1] = col[v];
    }
  } });

/* ════════ 6. 蘭頓螞蟻與圖靈蟎（多色螞蟻、二維圖靈機） ════════ */
A({ id: 'ca-ant', name: '蘭頓螞蟻', cat: '生命', theme: 'amber',
  desc: '螞蟻依地板顏色轉彎，混沌之後築出公路',
  params: { rule: 'RL', ants: 1, sps: 700, dbl: 12, cap: 12000, maxT: 75, tm: null },
  variants: [
    { id: 'colony', name: '蟻群', theme: 'rainbow', hue: true, desc: '六隻螞蟻在同一片地上互相干擾',
      params: { rule: 'RL', ants: 6, sps: 500, dbl: 14, maxT: 80 } },
    { id: 'llrr', name: '對稱腦紋', theme: 'sakura', desc: '四色規則長出左右對稱的腦紋圖案',
      params: { rule: 'LLRR', sps: 2500, dbl: 8, cap: 40000, maxT: 70 } },
    { id: 'square', name: '方塊織布', theme: 'mint', desc: '九色規則把四周慢慢織成一塊方毯',
      params: { rule: 'LRRRRRLLR', sps: 1500, dbl: 9, cap: 40000, maxT: 70 } },
    { id: 'triangle', name: '三角拓荒', theme: 'sunset', desc: '十二色規則長出不斷擴張的三角形',
      params: { rule: 'RRLLLRLLLRRR', sps: 1500, dbl: 9, cap: 40000, maxT: 70 } },
    { id: 'convolute', name: '曲折公路', theme: 'ice', desc: '十二色規則修出蜿蜒的寬公路',
      params: { rule: 'LLRRRLRLRLLR', sps: 1200, dbl: 10, cap: 30000, maxT: 70 } },
    { id: 'castle', name: '迷宮城堡', theme: 'gold', desc: '雙狀態圖靈蟎蓋出不斷擴建的方形城堡',
      params: { tm: [[[1, 8, 0], [1, 2, 1]], [[0, 2, 0], [0, 8, 1]]], sps: 3000, dbl: 6, cap: 60000, maxT: 60 } },
    { id: 'chaos', name: '混沌之舞', theme: 'lavender', desc: '三色規則永遠長不出公路的混沌團塊',
      params: { rule: 'RLR', ants: 2, sps: 1200, dbl: 10, cap: 30000, maxT: 70 } },
  ],
  init(s, f) {
    const p = f.p, W = Math.max(8, f.cols >> 1), H = f.rows, n = W * H;
    const N = p.tm ? 2 : p.rule.length;
    Object.assign(s, { W, H, n, N, a: new Uint8Array(n), heat: new Float32Array(n), T: 0, acc: 0, ants: [] });
    s.turn = p.tm ? null : Array.from(p.rule, c => (c === 'R' ? 1 : c === 'L' ? 3 : c === 'U' ? 2 : 0));
    for (let k = 0; k < p.ants; k++) {
      const ang = (k / p.ants) * TAU, r = p.ants > 1 ? Math.min(W, H) * 0.22 : 0;
      s.ants.push({ x: ((W >> 1) + Math.round(Math.cos(ang) * r * 1.2)) | 0, y: ((H >> 1) + Math.round(Math.sin(ang) * r * 0.6)) | 0, d: k & 3, st: 0, k, hue: (k * 360) / Math.max(1, p.ants) });
    }
    const C = f.C, Hh = f.H;
    s.col = []; s.chr = [];
    for (let v = 0; v < N; v++) {
      const u = N > 1 ? v / (N - 1) : 1;
      s.col.push([0, 1, 2, 3].map(h => Hh(40 + v * 300 / N, Math.min(1, 0.25 + 0.55 * u + h * 0.08))));
      s.chr.push(v === 0 ? '░' : N <= 2 ? '█' : SH[1 + Math.min(2, ((u * 3) | 0))]);
    }
    // 多隻螞蟻：格子顏色依「最後是哪一隻螞蟻塗的」
    if (p.ants > 1) { s.own = new Uint8Array(n); s.antPal = s.ants.map(an => [0, 1, 2, 3].map(h => Hh(an.hue, Math.min(1, 0.45 + h * 0.15)))); }
    s.trail = [0, 1, 2, 3].map(h => C(0.1 + h * 0.07));
    s.antCol = s.ants.map(a => Hh(a.hue + 30, 1));
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols, { W, H, a, heat, N } = s;
    s.T += f.dt;
    if (s.T > p.maxT) { this.init(s, f); }
    const rate = Math.min(p.cap, p.sps * Math.pow(2, s.T / p.dbl));
    let k = due(s, f.dt, rate, 3000);
    while (k-- > 0) {
      for (const an of s.ants) {
        const i = an.y * W + an.x, v = a[i];
        if (p.tm) {
          const [w, t, nx] = p.tm[an.st][v];
          a[i] = w; an.st = nx;
          an.d = (an.d + (t === 2 ? 1 : t === 8 ? 3 : t === 4 ? 2 : 0)) & 3;
        } else {
          an.d = (an.d + s.turn[v]) & 3;
          a[i] = v + 1 < N ? v + 1 : 0;
        }
        heat[i] = 1;
        if (s.own) s.own[i] = an.k;
        an.x += an.d === 0 ? 1 : an.d === 2 ? -1 : 0; an.y += an.d === 1 ? 1 : an.d === 3 ? -1 : 0;
        if (an.x < 0) an.x += W; else if (an.x >= W) an.x -= W;
        if (an.y < 0) an.y += H; else if (an.y >= H) an.y -= H;
      }
    }
    const dk = Math.exp(-f.dt * 1.5), ch = g.ch, co = g.co;
    for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
      const v = a[j], h = heat[j] *= dk;
      const hb = h > 0.6 ? 3 : h > 0.3 ? 2 : h > 0.08 ? 1 : 0;
      if (v === 0) { if (hb) { ch[i] = ch[i + 1] = '░'; co[i] = co[i + 1] = s.trail[hb]; } continue; }
      const c = s.chr[v], col = s.own ? s.antPal[s.own[j]][hb] : s.col[v][hb];
      ch[i] = c; co[i] = col; ch[i + 1] = c; co[i + 1] = col;
    }
    for (let q = 0; q < s.ants.length; q++) {
      const an = s.ants[q], i = an.y * cols + an.x * 2;
      ch[i] = ch[i + 1] = '█'; co[i] = co[i + 1] = s.antCol[q];
    }
  } });

/* ════════ 7. 森林大火（Drossel–Schwabl 森林火災模型） ════════ */
// 樹齡由小到大：苗、草叢、小樹、灌木、大樹（不用英文字母，免得看起來像亂碼文字）
const TREE_G = [['.', ','], ["'", '"'], ['↑', '⇡'], ['♧', '♤'], ['♣', '♠'], ['♣', '♠']];
A({ id: 'ca-forest', name: '森林大火', cat: '生命', theme: 'forest', hue: true,
  desc: '樹木生長、雷擊起火，火線燒過後又再長回來',
  params: { grow: 0.012, strikes: 0.6, spread: 0.85, wind: 0, sps: 12, seed: 'rand', water: 0, look: 'tree', ring: 0, moore: 0 },
  variants: [
    { id: 'savanna', name: '草原', theme: 'gold', desc: '草長得快、雷擊頻繁，到處是小火',
      params: { grow: 0.05, strikes: 4, spread: 0.7, sps: 14, look: 'grass' } },
    { id: 'river', name: '河谷', theme: 'ocean', desc: '蜿蜒的河流與湖泊擋住了火勢',
      params: { water: 1, grow: 0.015, strikes: 0.8 } },
    { id: 'patch', name: '播種', theme: 'toxic', desc: '樹只從鄰樹播種，森林一塊塊往外擴張',
      params: { seed: 'spread', grow: 0.06, strikes: 0.5, spread: 0.9 } },
    { id: 'ring', name: '火環', theme: 'fire', desc: '中心一再起火，火環一圈圈向外擴散',
      params: { ring: 1, strikes: 0, grow: 0.02, spread: 0.97, sps: 14, moore: 1 } },
  ],
  init(s, f) {
    const p = f.p, W = Math.max(8, f.cols >> 1), H = f.rows, n = W * H;
    const a = new Uint8Array(n), age = new Uint8Array(n), hs = new Uint8Array(n);
    for (let i = 0; i < n; i++) { hs[i] = (Math.random() * 256) | 0; if (Math.random() < (p.seed === 'spread' ? 0.02 : 0.45)) { a[i] = 1; age[i] = rint(0, 120); } }
    if (p.water) {
      const z = rnd(0, 50);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = Noise.fbm(x * 0.035, y * 0.07, z, 3);
        if (Math.abs(v) < 0.045 || v > 0.33) a[y * W + x] = 5;
      }
    }
    Object.assign(s, { W, H, n, a, b: new Uint8Array(n), age, hs, acc: 0, flash: [], ringT: 0 });
    const Hh = f.H, C = f.C;
    s.treeCol = []; for (let k = 0; k < 6; k++) s.treeCol.push([0, 1, 2].map(v => Hh(85 + v * 22, p.look === 'night' ? 0.1 + k * 0.025 : 0.22 + k * 0.1)));
    s.fireCol = [0, 1, 2, 3].map(k => Hh(15 + k * 12, 0.65 + k * 0.1));
    s.emberCol = Hh(5, 0.38); s.ashCol = C(0.1); s.waterCol = [Hh(205, 0.32), Hh(195, 0.45)];
  },
  step(s, p) {
    const { W, H, a, b, age } = s, sp = p.spread, wd = p.wind, grow = p.grow;
    for (let y = 0; y < H; y++) {
      const y0 = y * W, ym = y > 0 ? y0 - W : -1, yp = y < H - 1 ? y0 + W : -1;
      for (let x = 0; x < W; x++) {
        const i = y0 + x, v = a[i];
        if (v === 0) {
          let g = grow;
          if (p.seed === 'spread') {
            let t = 0;
            if (x > 0 && a[i - 1] === 1) t++; if (x < W - 1 && a[i + 1] === 1) t++;
            if (ym >= 0 && a[i - W] === 1) t++; if (yp >= 0 && a[i + W] === 1) t++;
            g = grow * t * 0.25 + 0.00002;
          }
          if (Math.random() < g) { b[i] = 1; age[i] = 0; } else b[i] = 0;
        } else if (v === 1) {
          // 鄰居著火就有機率被點燃（風向會改變機率）
          let pr = 0;
          if (x > 0 && a[i - 1] === 2) pr = Math.max(pr, sp * (1 + wd));
          if (x < W - 1 && a[i + 1] === 2) pr = Math.max(pr, sp * (1 - wd));
          if (ym >= 0 && a[i - W] === 2) pr = Math.max(pr, sp);
          if (yp >= 0 && a[i + W] === 2) pr = Math.max(pr, sp);
          if (p.moore) {
            if (ym >= 0 && ((x > 0 && a[i - W - 1] === 2) || (x < W - 1 && a[i - W + 1] === 2))) pr = Math.max(pr, sp * 0.7);
            if (yp >= 0 && ((x > 0 && a[i + W - 1] === 2) || (x < W - 1 && a[i + W + 1] === 2))) pr = Math.max(pr, sp * 0.7);
          }
          if (pr > 0 && Math.random() < pr) b[i] = 2;
          else { b[i] = 1; if (age[i] < 250) age[i]++; }
        } else if (v === 2) b[i] = 3;
        else if (v === 3) b[i] = 4;
        else if (v === 4) b[i] = Math.random() < 0.12 ? 0 : 4;
        else b[i] = v;
      }
    }
    s.a = b; s.b = a;
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols;
    let k = due(s, f.dt, p.sps, 3);
    while (k-- > 0) {
      this.step(s, p);
      // 雷擊：每一步依機率挑一棵樹點燃（只閃一下小小的光點）
      if (p.strikes && Math.random() < p.strikes / p.sps) {
        for (let t = 0; t < 30; t++) { const i = (Math.random() * s.n) | 0; if (s.a[i] === 1) { s.a[i] = 2; s.flash.push({ i, t: 0.25 }); break; } }
      }
      if (p.ring && (s.ringT += 1) % 60 === 1) {
        const c = (s.H >> 1) * s.W + (s.W >> 1);
        for (let d = -1; d <= 1; d++) { if (s.a[c + d] === 1) s.a[c + d] = 2; }
        s.flash.push({ i: c, t: 0.25 });
      }
    }
    const { W, H, a, age, hs } = s, ch = g.ch, co = g.co, night = p.look === 'night', grass = p.look === 'grass';
    const wv = (f.t * 2) | 0;
    for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
      const v = a[j];
      if (v === 0) continue;
      let c1, c2, col;
      if (v === 1) {
        const ag = Math.min(5, (age[j] / (grass ? 6 : 14)) | 0), h = hs[j];
        if (night) { c1 = ag > 2 ? '·' : '.'; c2 = ' '; }
        else if (grass) { c1 = ag < 2 ? '.' : ag < 4 ? ',' : '"'; c2 = (h & 1) ? '\'' : ag < 3 ? ' ' : ','; }
        else { const gp = TREE_G[ag]; c1 = gp[h & 1]; c2 = (h & 6) ? gp[(h >> 3) & 1] : ' '; }
        col = s.treeCol[ag][h % 3];
      } else if (v === 2) { c1 = c2 = Math.random() < 0.5 ? '▓' : '█'; col = s.fireCol[(Math.random() * 4) | 0]; }
      else if (v === 3) { c1 = c2 = '▒'; col = s.emberCol; }
      else if (v === 4) { c1 = '.'; c2 = ' '; col = s.ashCol; }
      else { c1 = ((x + y + wv) & 3) ? '~' : '≈'; c2 = ((x + wv) & 1) ? '~' : ' '; col = s.waterCol[(x + y + wv) & 1]; }
      ch[i] = c1; co[i] = col; if (c2 !== ' ') { ch[i + 1] = c2; co[i + 1] = col; }
    }
    for (let q = s.flash.length - 1; q >= 0; q--) {
      const fl = s.flash[q];
      fl.t -= f.dt;
      if (fl.t <= 0) { s.flash.splice(q, 1); continue; }
      const x = fl.i % W, y = (fl.i / W) | 0;
      g.set(x * 2, y, '✦', f.C(1)); g.set(x * 2 + 1, y, '✦', f.C(1));
    }
  } });

/* ════════ 8. 反應擴散（Gray–Scott 模型） ════════ */
A({ id: 'ca-rd', name: '反應擴散', cat: '生命', theme: 'ocean',
  desc: '兩種化學物質反應又擴散，長出珊瑚紋',
  params: { F: 0.0545, k: 0.062, ips: 260, look: 'ramp', seeds: 1, stir: 5, drift: 0, maxT: 100, inv: 0 },
  variants: [
    { id: 'mitosis', name: '細胞分裂', theme: 'sakura', desc: '一顆顆圓點不斷長大、一分為二',
      params: { F: 0.0367, k: 0.0649, look: 'braille', ips: 250, stir: 4 } },
    { id: 'worms', name: '蠕蟲', theme: 'toxic', desc: '短短的蟲狀條紋彼此推擠排列',
      params: { F: 0.078, k: 0.061, look: 'block', ips: 270 } },
    { id: 'maze', name: '等高線迷宮', theme: 'blueprint', desc: '迷宮般的紋路，用等高線描出輪廓',
      params: { F: 0.029, k: 0.057, look: 'contour', ips: 270, stir: 4 } },
    { id: 'spots', name: '游移斑點', theme: 'amber', desc: '孤立的斑點在空間中漂移與碰撞',
      params: { F: 0.03, k: 0.062, look: 'dots', ips: 270, stir: 3 } },
    { id: 'waves', name: '混沌波', theme: 'synth', desc: '永不停歇的螺旋與碎波此起彼落',
      params: { F: 0.022, k: 0.049, look: 'ramp', ips: 240, stir: 8, seeds: 2 } },
    { id: 'holes', name: '泡泡孔', theme: 'ice', desc: '滿版的物質上浮現一個個孔洞',
      params: { F: 0.039, k: 0.058, look: 'block', inv: 1, ips: 270 } },
    { id: 'fingerprint', name: '指紋', theme: 'mono', desc: '細密平行的條紋像一枚放大的指紋',
      params: { F: 0.037, k: 0.06, look: 'ridge', ips: 270, stir: 5 } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows, aspect } = f;
    // 模擬格寬度：縮圖也要有夠多的紋路（大螢幕上限 140，避免太慢）
    const W = Math.round(clamp(cols * 0.8, 60, 140)), H = Math.max(12, Math.round((W * rows * aspect) / cols)), n = W * H;
    const u = new Float32Array(n).fill(1), v = new Float32Array(n);
    Object.assign(s, { W, H, n, u, v, u2: new Float32Array(n), v2: new Float32Array(n), T: 0, acc: 0, st: 0, vmax: 0.3 });
    // 均勻撒下很多小種子，畫面很快就會長滿
    const cnt = Math.max(4, Math.round((n / 500) * p.seeds));
    for (let q = 0; q < cnt; q++) this.drop(s, rnd(0, W), rnd(0, H), rint(4, 5));
    s.out = null;
  },
  drop(s, cx, cy, r) {
    const { W, H, u, v } = s;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const i = (((cy + y) | 0) % H + H) % H * W + ((((cx + x) | 0) % W) + W) % W;
      u[i] = 0.5 + Math.random() * 0.1; v[i] = 0.25 + Math.random() * 0.1;
    }
  },
  sim(s, F, k) {
    const { W, H } = s;
    let u = s.u, v = s.v, u2 = s.u2, v2 = s.v2;
    for (let y = 0; y < H; y++) {
      const r = y * W, rn = (y ? y - 1 : H - 1) * W, rs = (y < H - 1 ? y + 1 : 0) * W;
      for (let x = 0; x < W; x++) {
        const i = r + x, xw = x ? x - 1 : W - 1, xe = x < W - 1 ? x + 1 : 0;
        const uu = u[i], vv = v[i], uvv = uu * vv * vv;
        const lu = (u[rn + x] + u[rs + x] + u[r + xw] + u[r + xe]) * 0.25 - uu;
        const lv = (v[rn + x] + v[rs + x] + v[r + xw] + v[r + xe]) * 0.25 - vv;
        u2[i] = uu + 0.6 * lu - uvv + F * (1 - uu);
        v2[i] = vv + 0.3 * lv + uvv - (F + k) * vv;
      }
    }
    s.u = u2; s.v = v2; s.u2 = u; s.v2 = v;
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols, rows = g.rows;
    s.T += f.dt;
    if (s.T > p.maxT) this.init(s, f);
    let F = p.F, k = p.k;
    if (p.drift) { const ph = Math.sin(s.T * 0.06); F += ph * 0.006; k -= ph * 0.0012; }
    if ((s.st += f.dt) > p.stir) {
      s.st = 0;
      // 攪動：隨機丟一顆新種子，或挖掉一小塊讓它重新長
      if (Math.random() < 0.6) this.drop(s, rnd(0, s.W), rnd(0, s.H), rint(4, 5));
      else { const cx = rnd(0, s.W), cy = rnd(0, s.H), r = rint(3, 6); for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) { const i = ((((cy + y) | 0) % s.H) + s.H) % s.H * s.W + ((((cx + x) | 0) % s.W) + s.W) % s.W; s.u[i] = 1; s.v[i] = 0; } }
    }
    let it = due(s, f.dt, p.ips, 16);
    while (it-- > 0) this.sim(s, F, k);
    // 依目前最大濃度做正規化（慢慢追蹤，避免閃爍）
    const { W, H, v, u } = s;
    let mx = 0.05;
    for (let i = 0; i < s.n; i += 7) if (v[i] > mx) mx = v[i];
    s.vmax += (mx - s.vmax) * Math.min(1, f.dt * 2);
    if (mx < 0.051 && s.T > 2) { this.init(s, f); return; }
    const inv = 1 / Math.max(0.08, s.vmax), ch = g.ch, co = g.co, C = f.C, look = p.look;
    // 先把濃度用雙線性內插取樣到輸出格（點字模式是 2×4 倍解析度）
    const br = look === 'braille' || look === 'ridge', OW = br ? cols * 2 : cols, OH = br ? rows * 4 : rows;
    if (!s.out || s.out.length !== OW * OH) {
      s.out = new Float32Array(OW * OH);
      const mk = (N, M, Wd) => { const ia = new Int32Array(N), ib = new Int32Array(N), tw = new Float32Array(N); for (let q = 0; q < N; q++) { const fx = ((q + 0.5) / N) * M - 0.5, x0 = Math.floor(fx); ia[q] = ((x0 % M) + M) % M; ib[q] = (ia[q] + 1) % M; tw[q] = fx - x0; } return [ia, ib, tw]; };
      s.tx = mk(OW, W); s.ty = mk(OH, H);
    }
    const out = s.out, [xa, xb, txw] = s.tx, [ya, yb, tyw] = s.ty, ivt = p.inv;
    for (let y = 0; y < OH; y++) {
      const ra = ya[y] * W, rb = yb[y] * W, ty = tyw[y], o = y * OW;
      for (let x = 0; x < OW; x++) {
        const a0 = xa[x], b0 = xb[x], tx = txw[x];
        const top = v[ra + a0] + (v[ra + b0] - v[ra + a0]) * tx, bot = v[rb + a0] + (v[rb + b0] - v[rb + a0]) * tx;
        let t = (top + (bot - top) * ty) * inv;
        if (ivt) t = 1 - t;
        // 提高對比，紋路邊緣比較銳利
        t = (t - 0.18) * 1.5;
        out[o + x] = t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
      }
    }
    if (br) {
      const pix = s.pix || (s.pix = new Uint8Array(OW * OH));
      // ridge：只取濃度在中間帶的點，條紋的兩側邊緣變成細細的指紋紋線
      if (look === 'ridge') for (let q = 0; q < pix.length; q++) { const t = out[q]; pix[q] = t > 0.3 && t < 0.62 ? 1 : 0; }
      else for (let q = 0; q < pix.length; q++) pix[q] = out[q] > 0.45 ? 1 : 0;
      brailleDraw(g, pix, OW, s.btab || (s.btab = Array.from({ length: 9 }, (_, q) => C(0.35 + q * 0.08))));
      return;
    }
    const L = 5;
    for (let cy = 0; cy < rows; cy++) for (let cx = 0, i = cy * cols; cx < cols; cx++, i++) {
      const t = out[i];
      if (look === 'ramp') { if (t > 0.08) { ch[i] = RAMP10[Math.min(9, (t * 10) | 0)]; co[i] = C(t * 0.95 + 0.05); } }
      else if (look === 'block') { if (t > 0.15) { ch[i] = SH[Math.min(3, ((t - 0.15) * 4.7) | 0)]; co[i] = C(0.25 + t * 0.75); } }
      else if (look === 'dots') { if (t > 0.2) { ch[i] = t > 0.8 ? '@' : t > 0.6 ? 'O' : t > 0.4 ? 'o' : '·'; co[i] = C(0.3 + t * 0.7); } }
      else {
        // 等高線：和右邊、下面的格子落在不同的高度帶就畫線
        const lv = Math.min(L - 1, (t * L) | 0);
        const hr = cx < cols - 1 && Math.min(L - 1, (out[i + 1] * L) | 0) !== lv, vd = cy < rows - 1 && Math.min(L - 1, (out[i + cols] * L) | 0) !== lv;
        if (hr || vd) { ch[i] = hr && vd ? '+' : hr ? '|' : '-'; co[i] = C(0.35 + lv * 0.16); }
        else if (lv >= L - 1) { ch[i] = '·'; co[i] = C(0.3); }
      }
    }
  } });

/* ════════ 9. 沙堆模型（阿貝爾沙堆、自組織臨界） ════════ */
A({ id: 'ca-sand', name: '沙堆模型', cat: '生命', theme: 'gold', hue: true,
  desc: '沙粒落在中心不斷崩塌，堆出碎形曼陀羅',
  params: { mode: 'center', nb: 4, gps: 420, sweeps: 24, maxT: 75, look: 'block', hues: [215, 45, 330] },
  variants: [
    { id: 'moore', name: '八方崩塌', theme: 'sakura', desc: '八個方向一起崩塌，長成八角形花窗',
      params: { nb: 8, gps: 900, hues: [280, 190, 50] } },
    { id: 'trio', name: '三星', theme: 'ocean', desc: '三個沙源的曼陀羅互相碰撞交融',
      params: { mode: 'multi', gps: 700, hues: [190, 120, 60] } },
    { id: 'identity', name: '恆等元', theme: 'neon', desc: '沙堆群的單位元素一步步浮現',
      params: { mode: 'identity', sweeps: 30, maxT: 200, hues: [300, 200, 160] } },
    { id: 'drift', name: '漂移沙源', theme: 'mint', desc: '沙源緩緩繞行，留下拖曳的碎形',
      params: { mode: 'drift', gps: 650, hues: [160, 90, 30] } },
    { id: 'digits', name: '數字沙盤', theme: 'amber', desc: '直接用數字 0–3 顯示每格的沙量',
      params: { look: 'digits', gps: 520 } },
    { id: 'dump', name: '一次傾倒', theme: 'ice', desc: '上萬粒沙一次倒下，崩塌波由內往外擴',
      params: { mode: 'dump', gps: 0, sweeps: 3, maxT: 999, hues: [200, 230, 175] } },
  ],
  init(s, f) {
    const p = f.p, W = Math.max(8, f.cols >> 1), H = f.rows, n = W * H;
    const h = new Int32Array(n);
    Object.assign(s, { W, H, n, h, act: new Float32Array(n), T: 0, acc: 0, phase: 0, hold: 0 });
    if (p.mode === 'rain') for (let i = 0; i < n; i++) h[i] = rint(0, 3);
    if (p.mode === 'identity') h.fill(6);
    if (p.mode === 'dump') { const r = H * 0.46; h[(H >> 1) * W + (W >> 1)] = Math.round(2.1 * Math.PI * r * r); }
    s.src = p.mode === 'multi' ? [[W * 0.22, H * 0.5], [W * 0.5, H * 0.5], [W * 0.78, H * 0.5]].map(([x, y]) => (y | 0) * W + (x | 0)) : [(H >> 1) * W + (W >> 1)];
    const Hh = f.H, C = f.C, hu = p.hues;
    s.cols = [null, ...hu.map((x, k) => [0, 1, 2].map(a => Hh(x, 0.3 + k * 0.15 + a * 0.14)))];
    s.hot = C(1);
  },
  // 一次平行崩塌：高度 ≥ 門檻的格子把沙平分給鄰居（邊界外的沙直接掉出去）
  topple(s, p) {
    const { W, H, h, act } = s, T = p.nb === 8 ? 8 : 4;
    let any = 0;
    const b = s.tmp || (s.tmp = new Int32Array(s.n));
    b.set(h);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, v = h[i];
      if (v < T) continue;
      const q = (v / T) | 0;
      any++; b[i] -= q * T; act[i] = 1;
      if (x > 0) b[i - 1] += q; if (x < W - 1) b[i + 1] += q;
      if (y > 0) b[i - W] += q; if (y < H - 1) b[i + W] += q;
      if (T === 8) {
        if (y > 0) { if (x > 0) b[i - W - 1] += q; if (x < W - 1) b[i - W + 1] += q; }
        if (y < H - 1) { if (x > 0) b[i + W - 1] += q; if (x < W - 1) b[i + W + 1] += q; }
      }
    }
    h.set(b);
    return any;
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols, { W, H, h, act } = s;
    s.T += f.dt;
    if (s.hold > 0) { s.hold -= f.dt; if (s.hold <= 0) { this.init(s, f); } }
    else {
      if (s.T > p.maxT) s.hold = 2.5;
      const grains = due(s, f.dt, p.gps, 400);
      if (p.mode === 'rain') { for (let k = 0; k < grains; k++) h[(Math.random() * s.n) | 0]++; }
      else if (p.mode === 'drift') { const x = (W * (0.5 + 0.3 * Math.sin(s.T * 0.13))) | 0, y = (H * (0.5 + 0.28 * Math.sin(s.T * 0.21 + 1))) | 0; h[y * W + x] += grains; }
      else if (p.mode !== 'identity') for (const i of s.src) h[i] += Math.ceil(grains / s.src.length);
      // 崩塌次數跟著時間走（不受畫格率影響，也會跟著速度滑桿變快變慢）
      const sw = due(s, f.dt, p.sweeps * 30, p.sweeps * 2, 'swAcc');
      let busy = 0;
      for (let k = 0; k < sw; k++) { const a = this.topple(s, p); busy += a; if (!a) break; }
      const idle = sw > 0 && !busy;
      if (p.mode === 'dump' && idle && s.T > 1) s.hold = 5;
      if (p.mode === 'identity' && idle) {
        // 第一階段穩定後：6 − 穩定結果，再穩定一次就是單位元素
        if (s.phase === 0) { for (let i = 0; i < s.n; i++) h[i] = 6 - h[i]; s.phase = 1; }
        else if (s.phase === 1) { s.phase = 2; s.hold = 6; }
      }
      // 沙堆碰到邊界一陣子之後重新開始
      if ((p.mode === 'center' || p.mode === 'multi') && (h[W >> 1] > 0 || h[(H >> 1) * W]) ) s.edge = (s.edge || 0) + f.dt;
      if (s.edge > 8) { s.edge = 0; s.hold = 2.5; }
    }
    const ch = g.ch, co = g.co, dk = Math.exp(-f.dt * 3), look = p.look, digits = look === 'digits';
    const TH = p.nb === 8 ? 8 : 4;
    for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
      const v = h[j], a = act[j] *= dk;
      if (v === 0 && a < 0.1) continue;
      let c1, c2, col;
      // 數字沙盤每格都是「一個字＋空白」，欄位才不會亂掉
      if (v >= TH) { col = s.hot; if (digits) { c1 = '+'; c2 = ' '; } else c1 = c2 = '█'; }
      else if (v === 0) { c1 = '·'; c2 = digits ? ' ' : '·'; col = s.cols[1][0]; }
      else {
        // 八方崩塌的穩定高度是 1–7，壓成三個色階
        const hb = a > 0.5 ? 2 : a > 0.15 ? 1 : 0, vv = TH === 8 ? Math.min(3, 1 + (((v - 1) / 2.34) | 0)) : Math.min(3, v);
        col = s.cols[vv][hb];
        if (digits) { c1 = String(vv); c2 = ' '; }
        else { c1 = c2 = vv === 1 ? '░' : vv === 2 ? '▓' : '█'; }
      }
      ch[i] = c1; co[i] = col; if (c2 !== ' ') { ch[i + 1] = c2; co[i + 1] = col; }
    }
  } });

/* ════════ 10. 落沙世界（沙、水、牆的粒子自動機） ════════ */
// 格子種類：0 空、1 沙、2 水、3 牆、4 釘子
A({ id: 'ca-fall', name: '落沙世界', cat: '生命', theme: 'sunset', hue: true,
  desc: '彩色沙流從上方灑落，一層層堆成沙畫',
  params: { scene: 'dunes', sps: 40, full: 0.5 },
  variants: [
    { id: 'hourglass', name: '沙漏', theme: 'gold', desc: '沙從細頸流下，漏完就整個翻轉',
      params: { scene: 'hourglass', sps: 36 } },
    { id: 'rain', name: '雨落岩台', theme: 'ocean', desc: '雨滴打在岩台上，積成水池再溢流',
      params: { scene: 'rain', sps: 40 } },
    { id: 'mix', name: '泥沙俱下', theme: 'amber', desc: '沙和水一起倒下，沙沉到水底',
      params: { scene: 'mix', sps: 40, full: 0.45 } },
    { id: 'galton', name: '高爾頓板', theme: 'mint', desc: '珠子穿過釘陣，在底部排成鐘形分布',
      params: { scene: 'galton', sps: 40, full: 0.24 } },
    { id: 'slopes', name: '斜坡雪崩', theme: 'lavender', desc: '沙沿著斜坡一路滑落、堆積再崩塌',
      params: { scene: 'slopes', sps: 40, full: 0.42 } },
    { id: 'cascade', name: '層層瀑布', theme: 'ice', desc: '水從一個個水盆溢出，形成階梯瀑布',
      params: { scene: 'cascade', sps: 44 } },
  ],
  init(s, f) {
    const p = f.p, W = Math.max(10, f.cols >> 1), H = Math.max(8, f.rows), n = W * H;
    const a = new Uint8Array(n), hu = new Uint8Array(n), mv = new Uint8Array(n);
    Object.assign(s, { W, H, n, a, hu, mv, acc: 0, stamp: 1, em: [], drain: 0, T: 0, flipT: 0, dir: 1, moves: 0 });
    const wall = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) a[y * W + x] = 3; };
    // 斜線牆要四連通（每一步多補一格），沙才不會從斜角縫隙漏出去
    const seg = (x0, y0, x1, y1) => {
      const m = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      let px = Math.round(x0), py = Math.round(y0);
      for (let k = 0; k <= m; k++) {
        const x = Math.round(x0 + (x1 - x0) * k / m), y = Math.round(y0 + (y1 - y0) * k / m);
        if (x !== px && y !== py) wall(x, py);
        wall(x, y); px = x; py = y;
      }
    };
    const sc = p.scene;
    for (let x = 0; x < W; x++) a[(H - 1) * W + x] = 3;
    if (sc === 'dunes' || sc === 'mix') {
      const k = Math.max(2, Math.round(W / 40));
      for (let q = 0; q < k + 1; q++) s.em.push({ x: rnd(0.1, 0.9) * W, v: rnd(4, 9) * (Math.random() < 0.5 ? -1 : 1), t: sc === 'mix' && q % 2 ? 2 : 1, h: rint(0, 7), rate: sc === 'mix' && q % 2 ? 0.9 : 0.75 });
      // 一開始底部就有一層起伏的彩色沙丘，畫面不會從全空開始
      const z = rnd(0, 50), h0 = rint(0, 7);
      for (let x = 0; x < W; x++) {
        const hh = Math.round(H * (0.07 + 0.11 * (Noise.n3(x * 0.035, z, 0.5) + 1) * 0.5));
        for (let y = H - 2, d = 0; d < hh; y--, d++) { const i = y * W + x; a[i] = 1; hu[i] = (h0 + (((d + 2 * Noise.n3(x * 0.08, z, 3)) / Math.max(2, H * 0.05)) | 0)) & 7; }
      }
    } else if (sc === 'hourglass') {
      const cx = Math.round(W / 2), hw = Math.round(Math.min(W * 0.62, (H - 4) * 0.92)), top = 1, bot = H - 2, mid = Math.round(H / 2), neck = Math.max(1, Math.round(W / 80));
      seg(cx - hw / 2, top, cx - neck, mid); seg(cx + hw / 2, top, cx + neck, mid);
      seg(cx - neck, mid, cx - hw / 2, bot); seg(cx + neck, mid, cx + hw / 2, bot);
      seg(cx - hw / 2, top, cx + hw / 2, top); seg(cx - hw / 2, bot, cx + hw / 2, bot);
      seg(cx - hw / 2 - 1, top, cx - hw / 2 - 1, bot); seg(cx + hw / 2 + 1, top, cx + hw / 2 + 1, bot);
      // 上半部裝滿沙（不同顏色的層）
      for (let y = top + 1; y < mid - 1; y++) {
        const w = (hw / 2) * (1 - (y - top) / (mid - top)) - 1;
        for (let x = Math.ceil(cx - w); x <= cx + w; x++) if (!a[y * W + x]) { a[y * W + x] = 1; hu[y * W + x] = ((y * 4) / H) | 0; }
      }
      s.hg = true;
    } else if (sc === 'rain' || sc === 'cascade') {
      if (sc === 'rain') {
        for (let q = 0, m = Math.max(4, Math.round(W * H / 500)); q < m; q++) {
          const x = rnd(0, W), y = rnd(H * 0.2, H * 0.9), L = rnd(W * 0.05, W * 0.18), cup = Math.random() < 0.6;
          seg(x, y, x + L, y + rnd(-1, 1)); if (cup) { seg(x, y, x, y - rint(2, 4)); seg(x + L, y, x + L, y - rint(2, 4)); }
        }
      } else {
        // 階梯水盆：左右交錯往下
        let x = W * 0.12, y = H * 0.18, dirx = 1;
        const basins = [];
        while (y < H - 4) {
          const L = W * rnd(0.22, 0.32), d = Math.max(2, Math.round(H * 0.08));
          seg(x, y, x + L, y); seg(x, y, x, y - d); seg(x + L, y, x + L, y - d + 1);
          basins.push(x + L / 2);
          x += dirx * L * 0.62; if (x + L > W - 2 || x < 1) { dirx = -dirx; x = clamp(x, 1, W - L - 2); }
          y += H * 0.16;
        }
        // 大螢幕水量跟著寬度放大：第一個水盆一定有水源，再往後面幾個水盆各加一個
        const ne = Math.max(1, Math.round(W / 55)), sp = Math.max(1, W / 60);
        s.em.push({ x: W * 0.12 + 2 + sp, v: 0, t: 2, h: 0, rate: 1.8 * sp, spread: sp });
        for (let q = 1; q < ne && q < basins.length; q++) s.em.push({ x: clamp(basins[q], sp + 1, W - sp - 2), v: 0, t: 2, h: 0, rate: 1.2 * sp, spread: sp });
      }
      // 底部有排水孔，水不會淹滿
      for (let x = 0; x < W; x += 3) a[(H - 1) * W + x] = 0;
      s.sink = true;
    } else if (sc === 'galton') {
      const top = Math.round(H * 0.12), bins = Math.round(H * 0.62);
      for (let y = top + 2, r = 0; y < bins - 2; y += 2, r++) for (let x = (W >> 1) - r; x <= (W >> 1) + r; x += 2) if (x > 1 && x < W - 2) a[y * W + x] = 4;
      for (let x = (W >> 1) % 4; x < W; x += 4) for (let y = bins; y < H - 1; y++) a[y * W + x] = 3;
      seg((W >> 1) - 6, 1, (W >> 1) - 1, top); seg((W >> 1) + 6, 1, (W >> 1) + 1, top);
      s.em.push({ x: W >> 1, v: 0, t: 1, h: 0, rate: 1.5, cyc: 1 });
    } else if (sc === 'slopes') {
      for (let q = 0, m = Math.max(4, Math.round(W / 14)); q < m; q++) {
        const x = rnd(0, W * 0.8), y = rnd(H * 0.25, H * 0.85), L = rnd(W * 0.08, W * 0.2), dy = rnd(0.3, 0.7) * L * (Math.random() < 0.5 ? -1 : 1) * 0.5;
        seg(x, y, x + L, y + dy);
      }
      for (let q = 0, k = Math.max(2, Math.round(W / 50)); q < k; q++) s.em.push({ x: rnd(0.1, 0.9) * W, v: rnd(2, 5) * (Math.random() < 0.5 ? -1 : 1), t: 1, h: rint(0, 7), rate: 0.7 });
    }
    const Hh = f.H;
    s.sandCol = Array.from({ length: 8 }, (_, k) => [Hh(k * 45 + 10, 0.5), Hh(k * 45 + 10, 0.62)]);
    s.waterCol = [Hh(205, 0.38), Hh(200, 0.5), Hh(195, 0.62)];
    s.wallCol = f.C(0.3); s.pegCol = f.C(0.7);
  },
  step(s, p) {
    const { W, H, a, hu, mv } = s, st = ++s.stamp & 255 || (s.stamp = 1);
    s.dir = -s.dir;
    const swap = (i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; const u = hu[i]; hu[i] = hu[j]; hu[j] = u; mv[j] = st; s.moves++; };
    for (let y = H - 2; y >= 0; y--) {
      const ltr = (y + s.stamp) & 1;
      for (let k = 0; k < W; k++) {
        const x = ltr ? k : W - 1 - k, i = y * W + x, v = a[i];
        if ((v !== 1 && v !== 2) || mv[i] === st) continue;
        const b = i + W, bv = a[b];
        if (bv === 0 || (v === 1 && bv === 2)) { swap(i, b); continue; }
        const d1 = Math.random() < 0.5 ? -1 : 1;
        let moved = false;
        for (let q = 0; q < 2; q++) {
          const d = q ? -d1 : d1, xx = x + d;
          if (xx < 0 || xx >= W) continue;
          const j = b + d, jv = a[j];
          if (jv === 0 || (v === 1 && jv === 2)) { swap(i, j); moved = true; break; }
        }
        if (moved || v !== 2) continue;
        // 水往側邊流
        for (let q = 0; q < 2; q++) {
          const d = q ? -d1 : d1, xx = x + d;
          if (xx < 0 || xx >= W) continue;
          if (a[i + d] === 0) { swap(i, i + d); break; }
        }
      }
    }
    // 底部排水孔：落到最下面一列的東西就消失
    if (s.sink || s.drain > 0) for (let x = 0; x < W; x++) { const i = (H - 1) * W + x; if (a[i] === 1 || a[i] === 2) a[i] = 0; }
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols, { W, H, a, hu } = s;
    s.T += f.dt;
    // 灑落
    for (const e of s.em) {
      e.x += e.v * f.dt;
      if (e.x < 2 || e.x > W - 3) { e.v = -e.v; e.x = clamp(e.x, 2, W - 3); }
      if (Math.random() < f.dt * 0.15) e.h = (e.h + 1) & 7;
      let k = Math.floor(e.rate * f.dt * 30 + Math.random());
      while (k-- > 0) {
        const sp = e.spread || 1, x = Math.round(e.x + (e.t === 2 ? rnd(-sp, sp) : 0)), i = x;
        if (x >= 0 && x < W && a[i] === 0) { a[i] = e.t; hu[i] = e.cyc ? (s.T * 0.3) & 7 : e.h; }
      }
    }
    if (p.scene === 'rain') for (let k = Math.floor(W * f.dt * 0.6 + Math.random()); k > 0; k--) { const i = rint(0, W - 1); if (!a[i]) a[i] = 2; }
    let k = due(s, f.dt, s.hg ? p.sps * clamp(H / 80, 0.35, 1) : p.sps, 4);
    while (k-- > 0) this.step(s, p);
    // 太滿就打開底部排水，排到剩一半左右就關上（不會整個漏光變成空白）；沙漏則是上半部漏完就翻轉
    if (!s.sink && !s.hg && (s.chk = (s.chk || 0) + f.dt) > (s.drain > 0 ? 0.5 : 1)) {
      s.chk = 0;
      let c = 0; for (let i = 0; i < s.n; i++) if (a[i] === 1 || a[i] === 2) c++;
      if (s.drain > 0) {
        s.drain += 1;
        if (c < s.n * p.full * 0.55 || s.drain > 24) { s.drain = 0; for (let x = 0; x < W; x++) a[(H - 1) * W + x] = 3; }
      } else if (c > s.n * p.full) { s.drain = 1; for (let x = 0; x < W; x++) if (a[(H - 1) * W + x] === 3) a[(H - 1) * W + x] = 0; }
    }
    if (s.hg && (s.flipT += f.dt) > 1) {
      s.flipT = 0;
      // 一秒內幾乎沒有沙粒移動（漏完或卡住）就翻轉
      const still = s.moves < 3; s.moves = 0;
      if (still) {
        // 翻轉沙漏：整個上下顛倒
        for (let y = 0; y < H >> 1; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x, j = (H - 1 - y) * W + x;
          let t = a[i]; a[i] = a[j]; a[j] = t; t = hu[i]; hu[i] = hu[j]; hu[j] = t;
        }
      }
    }
    const ch = g.ch, co = g.co, wt = (f.t * 3) | 0;
    for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
      const v = a[j];
      if (!v) continue;
      let c1, c2, col;
      if (v === 1) { const r = (j * 2654435761) >>> 28; c1 = r & 1 ? '▒' : '░'; c2 = r & 2 ? '▒' : '░'; col = s.sandCol[hu[j]][r & 1]; if (r > 12) { c1 = c2 = '▓'; } }
      else if (v === 2) { const sur = y > 0 && a[j - W] === 0; c1 = sur ? ((x + wt) % 3 ? '~' : '≈') : '≈'; c2 = sur ? ((x + wt) & 1 ? '~' : '-') : '≈'; col = s.waterCol[sur ? 2 : y > 0 && a[j - W] === 2 ? 0 : 1]; }
      else if (v === 3) { c1 = c2 = '█'; col = s.wallCol; }
      else { c1 = '●'; c2 = ' '; col = s.pegCol; }
      ch[i] = c1; co[i] = col; if (c2 !== ' ') { ch[i + 1] = c2; co[i + 1] = col; }
    }
  } });

/* ════════ 11. 擴散聚集（DLA 晶體生長） ════════ */
A({ id: 'ca-dla', name: '擴散聚集', cat: '生命', theme: 'ice',
  desc: '隨機漫步的粒子一碰就黏住，長成分枝晶體',
  params: { seed: 'center', mode: 'braille', steps: 36000, stick: 1, sym: 0, drift: 0, hold: 5, colorBy: 'age' },
  variants: [
    { id: 'snow', name: '六角雪晶', theme: 'mono', desc: '六重對稱的聚集，長成一片雪花',
      params: { sym: 6, steps: 9000 } },
    { id: 'coral', name: '海底珊瑚', theme: 'sunset', desc: '粒子從上方沉降，海床長出珊瑚林',
      params: { seed: 'floor', drift: 0.35, steps: 56000 } },
    { id: 'lightning', name: '電樹', theme: 'lavender', desc: '偏向上方的漫步拉出往下分岔的樹枝',
      params: { seed: 'top', drift: 0.3, nr: 3, mode: 'half', steps: 16000, area: 1 } },
    { id: 'ring', name: '向心環', theme: 'gold', desc: '種子是一個大圓環，晶體往中心長',
      params: { seed: 'ring', steps: 45000 } },
    { id: 'rivals', name: '群落競爭', theme: 'rainbow', hue: true, desc: '幾顆不同顏色的種子搶地盤',
      params: { seed: 'multi', colorBy: 'owner', mode: 'half', steps: 70000 } },
    { id: 'dense', name: '黏滯團塊', theme: 'forest', desc: '黏著機率很低，長出又密又毛的團塊',
      params: { stick: 0.1, mode: 'pair', steps: 7000, area: 1, big: 1 } },
    { id: 'eden', name: '伊甸生長', theme: 'toxic', desc: '邊緣隨機長出新細胞，像菌落擴散',
      params: { seed: 'eden', mode: 'half', steps: 0 } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows } = f;
    const [W, H] = p.mode === 'braille' ? [cols * 2, rows * 4] : p.mode === 'half' ? [cols, rows * 2] : [Math.max(8, cols >> 1), rows];
    const n = W * H, ys = p.mode === 'pair' ? 1 : p.mode === 'half' ? 1.05 : 1.05;
    Object.assign(s, { W, H, n, ys, g: new Uint8Array(n), age: new Uint16Array(n), own: new Uint8Array(n), cnt: 0, rmax: 2, T: 0, hold: 0, wk: [], cx: W / 2, cy: H / 2, done: false, front: [], sx: 0, sy: 0, xmin: W / 2, xmax: W / 2, ymax: 0, lastCnt: 0, stall: 0 });
    // nr：降噪聚集，同一格要被碰到 nr 次才長出來，枝條比較細長（像閃電）
    s.hc = p.nr ? new Uint8Array(n) : null;
    const put = (x, y, o) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (!s.g[i]) { s.g[i] = 1; s.own[i] = o || 0; s.age[i] = 0; } };
    s.put = put;
    const sd = p.seed;
    if (sd === 'center' || sd === 'eden') put(W / 2, H / 2);
    else if (sd === 'floor') for (let x = 0; x < W; x++) put(x, H - 1);
    else if (sd === 'top') { const a = Math.round(W * 0.48), b = Math.round(W * 0.52); for (let x = a; x <= b; x++) put(x, 0); s.xmin = a; s.xmax = b; }
    else if (sd === 'ring') {
      const R = Math.min(W / 2, H / 2) * 0.96, k = W > H * 1.5 ? 1.6 : 1;
      s.rx = R * k; s.ry = R;
      for (let a = 0; a < TAU; a += 0.3 / (R * k)) { put(W / 2 + Math.cos(a) * R * k, H / 2 + Math.sin(a) * R); put(W / 2 + Math.cos(a) * R * k + 1, H / 2 + Math.sin(a) * R); }
      s.rmax = R;
    }
    else if (sd === 'multi') { for (let k = 0; k < 6; k++) { const cx = W * (0.1 + 0.8 * k / 5), cy = H * (k % 2 ? 0.3 : 0.7); for (let d = 0; d < 9; d++) put(cx + (d % 3) - 1, cy + ((d / 3) | 0) - 1, k + 1); } }
    if (sd === 'eden') { s.front = [((H / 2) | 0) * W + ((W / 2) | 0)]; }
    const C = f.C, Hh = f.H;
    s.pal = Array.from({ length: 16 }, (_, k) => C(1 - k * 0.045));
    s.opal = Array.from({ length: 6 }, (_, k) => Hh(k * 70 + 20, 0.6));
    s.bt = Array.from({ length: 9 }, (_, k) => C(0.4 + k * 0.075));
  },
  // 新的漫步粒子從哪裡出發（結果寫到 s.sx / s.sy，熱迴圈裡不配置新陣列）
  spawn(s, p) {
    const { W, H } = s, sd = p.seed;
    let x, y;
    if (sd === 'floor') { x = rnd(0, W); y = 0; }
    else if (sd === 'top') {
      // 電樹：從樹梢下方一段距離、樹的左右範圍附近出發，比較快碰到樹枝
      const m = Math.max(6, W * 0.04);
      x = rnd(Math.max(0, s.xmin - m), Math.min(W - 1, s.xmax + m)); y = Math.min(H - 1, s.ymax + Math.max(12, H * 0.3));
    }
    else if (sd === 'ring') { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * 0.9; x = s.cx + Math.cos(a) * r * s.rx; y = s.cy + Math.sin(a) * r * s.ry; }
    else if (sd === 'multi') { x = rnd(0, W); y = rnd(0, H); }
    else { const a = rnd(0, TAU), r = s.rmax + 6; x = s.cx + Math.cos(a) * r; y = s.cy + Math.sin(a) * r / s.ys; }
    s.sx = Math.round(x); s.sy = Math.round(y);
  },
  stickAt(s, p, x, y, o, px, py) {
    const { W, H } = s;
    s.cnt++;
    const age = Math.min(65535, s.cnt);
    const add = (X, Y) => { X = Math.round(X); Y = Math.round(Y); if (X < 0 || Y < 0 || X >= W || Y >= H) return; const i = Y * W + X; if (!s.g[i]) { s.g[i] = 1; s.age[i] = age; s.own[i] = o; } };
    if (p.sym) {
      // 六重對稱：以中心旋轉 60° 再鏡射（y 方向依格子比例換算）。
      // 每個複本都和「旋轉後的母點」用短線連起來，四捨五入到格子上也不會斷成一粒粒的灰塵
      const dx = x - s.cx, dy = (y - s.cy) * s.ys, qx = px - s.cx, qy = (py - s.cy) * s.ys;
      for (let k = 0; k < 6; k++) {
        const a = (k * TAU) / 6, c = Math.cos(a), sn = Math.sin(a);
        const rx = dx * c - dy * sn, ry = dx * sn + dy * c, ux = qx * c - qy * sn, uy = qx * sn + qy * c;
        for (let m = -1; m <= 1; m += 2) {
          const X0 = s.cx + ux, Y0 = s.cy + m * uy / s.ys, X1 = s.cx + rx, Y1 = s.cy + m * ry / s.ys;
          const st = Math.ceil(Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0)) * 2) + 1;
          for (let t = 0; t <= st; t++) add(X0 + (X1 - X0) * t / st, Y0 + (Y1 - Y0) * t / st);
        }
      }
    } else add(x, y);
    const r = Math.hypot(x - s.cx, (y - s.cy) * s.ys);
    if (r > s.rmax) s.rmax = r;
    if (x < s.xmin) s.xmin = x;
    if (x > s.xmax) s.xmax = x;
    if (y > s.ymax) s.ymax = y;
  },
  grow(s, p, budget) {
    const { W, H, g } = s;
    const sd = p.seed;
    const hit = (x, y) => (x > 0 && g[y * W + x - 1]) || (x < W - 1 && g[y * W + x + 1]) || (y > 0 && g[(y - 1) * W + x]) || (y < H - 1 && g[(y + 1) * W + x]);
    // 一般漫步的方向由同一個亂數剩下的區間決定，每一步只要抽一次亂數
    const lo = sd === 'ring' ? 0.04 : p.drift || 0, k4 = 4 / (1 - lo);
    while (budget > 0) {
      if (!s.wk.length) for (let k = 0, m = sd === 'multi' ? 24 : 8; k < m; k++) { this.spawn(s, p); s.wk.push({ x: s.sx, y: s.sy }); }
      for (let q = s.wk.length - 1; q >= 0 && budget > 0; q--) {
        const w = s.wk[q];
        for (let st = 0; st < 400 && budget > 0; st++) {
          budget--;
          // 離團塊很遠時一次跳一大步（加速）
          if (sd === 'center') {
            const ex = w.x - s.cx, ey = (w.y - s.cy) * s.ys, e2 = ex * ex + ey * ey, rr = s.rmax + 9;
            if (e2 > rr * rr) {
              const d = Math.sqrt(e2) - s.rmax - 3;
              if (d > s.rmax + 40) { this.spawn(s, p); w.x = s.sx; w.y = s.sy; }
              else { const a = rnd(0, TAU); w.x = Math.round(w.x + Math.cos(a) * d * 0.8); w.y = Math.round(w.y + Math.sin(a) * d * 0.8 / s.ys); }
            }
          }
          const r = Math.random();
          if (sd === 'ring') {
            const ex = (w.x - s.cx) / s.rx, ey = (w.y - s.cy) / s.ry;
            // 從環的縫隙溜出去就重新出發
            if (ex * ex + ey * ey > 1.02) { this.spawn(s, p); w.x = s.sx; w.y = s.sy; continue; }
          }
          const ox = w.x, oy = w.y;
          if (sd === 'ring' && r < 0.04) { const ex = w.x - s.cx, ey = (w.y - s.cy) * s.ys; if (Math.abs(ex) > Math.abs(ey) * 1.6) w.x += ex > 0 ? 1 : -1; else w.y += ey > 0 ? 1 : -1; }
          else if (p.drift && r < p.drift) w.y += sd === 'top' ? -1 : 1;
          else { const k = ((r - lo) * k4) | 0; if (k === 0) w.x++; else if (k === 1) w.x--; else if (k === 2) w.y++; else w.y--; }
          // big：團塊比畫面還高，上下邊緣直接吸收粒子（被畫面裁掉），才不會沿著邊框長成一條線
          if (p.big && (w.y < 0 || w.y >= H)) { this.spawn(s, p); w.x = s.sx; w.y = s.sy; continue; }
          if (w.x < 0) w.x = sd === 'center' ? 0 : W - 1; else if (w.x >= W) w.x = sd === 'center' ? W - 1 : 0;
          if (w.y < 0 || w.y >= H) { if (sd === 'center' || sd === 'multi' || sd === 'ring') w.y = clamp(w.y, 0, H - 1); else { this.spawn(s, p); w.x = s.sx; w.y = s.sy; continue; } }
          if (g[w.y * W + w.x]) {
            // 走進晶體裡：退回原位（還貼著晶體，下一步還有機會黏上）；原位本來就在晶體裡才重新出發
            if (oy < 0 || oy >= H || ox < 0 || ox >= W || g[oy * W + ox]) { this.spawn(s, p); w.x = s.sx; w.y = s.sy; continue; }
            w.x = ox; w.y = oy;
          }
          if (hit(w.x, w.y) && Math.random() < p.stick) {
            const i = w.y * W + w.x;
            if (s.hc && ++s.hc[i] < p.nr) { this.spawn(s, p); w.x = s.sx; w.y = s.sy; break; }
            let o = 0;
            if (sd === 'multi') o = (w.x > 0 && s.own[i - 1]) || (w.x < W - 1 && s.own[i + 1]) || (w.y > 0 && s.own[i - W]) || (w.y < H - 1 && s.own[i + W]) || 1;
            // 母點：貼著的那一格（雪晶用來把對稱複本連成線）
            let px = w.x, py = w.y;
            if (w.x > 0 && g[i - 1]) px--; else if (w.x < W - 1 && g[i + 1]) px++; else if (w.y > 0 && g[i - W]) py--; else py++;
            this.stickAt(s, p, w.x, w.y, o, px, py);
            this.spawn(s, p); w.x = s.sx; w.y = s.sy;
            break;
          }
        }
      }
    }
  },
  eden(s) {
    // 伊甸模型：隨機挑邊界上的空格長出新細胞
    const { W, H, g } = s;
    for (let k = 0; k < Math.max(6, s.n / 2500); k++) {
      if (!s.front.length) { s.done = true; return; }
      const q = (Math.random() * s.front.length) | 0, i = s.front[q];
      const x = i % W, y = (i / W) | 0, nb = [];
      if (x > 0 && !g[i - 1]) nb.push(i - 1); if (x < W - 1 && !g[i + 1]) nb.push(i + 1);
      if (y > 0 && !g[i - W]) nb.push(i - W); if (y < H - 1 && !g[i + W]) nb.push(i + W);
      if (!nb.length) { s.front[q] = s.front[s.front.length - 1]; s.front.pop(); k--; continue; }
      const j = pick(nb);
      g[j] = 1; s.cnt++; s.age[j] = Math.min(65535, s.cnt); s.front.push(j);
      const r = Math.hypot((j % W) - s.cx, (((j / W) | 0) - s.cy) * s.ys); if (r > s.rmax) s.rmax = r;
    }
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols, rows = g.rows, { W, H } = s;
    s.T += f.dt;
    if (s.hold > 0) { s.hold -= f.dt; if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); } }
    else {
      if (p.seed === 'eden') { let k = due(s, f.dt, 30, 3); while (k-- > 0) this.eden(s); }
      // 每格的漫步步數跟著時間走，但最多 1.5 倍（低畫格率時不會一格算太久）
      // area：步數依畫面大小縮放，小縮圖不會一下子就長完
      else this.grow(s, p, Math.round(p.steps * Math.min(1.5, f.dt * 30) * (p.area ? clamp(s.n / 56000, 0.06, 1) : 1)));
      // 長到邊緣（或填得夠滿、電樹打到地面、三秒都沒再長）就停一下再重來
      s.stall = s.cnt > (s.lastCnt || 0) ? 0 : (s.stall || 0) + f.dt;
      s.lastCnt = s.cnt;
      const lim = p.big ? W * 0.55 : p.seed === 'center' || p.sym ? Math.min(W / 2, (H / 2) * s.ys) * 0.97 : p.seed === 'eden' ? W * 0.47 : 1e9;
      if (s.rmax > lim || s.done || s.T > 120 || (p.seed === 'top' && s.ymax > H * 0.92) ||
        ((p.big || (p.seed !== 'center' && p.seed !== 'eden')) && s.cnt > s.n * (p.big ? 0.22 : p.seed === 'ring' ? 0.12 : 0.16)) || s.stall > 3) s.hold = p.hold;
    }
    // 繪製：顏色依加入順序（越新越亮）或依群落
    const ch = g.ch, co = g.co, G = s.g, age = s.age, cnt = Math.max(1, s.cnt);
    // 停下來展示時，一道亮光從種子沿著生長順序掃到枝梢
    const pulse = s.hold > 0 ? 15 - ((p.hold - s.hold) / p.hold) * 19 : -99;
    const colOf = i => {
      if (p.colorBy === 'owner') return s.opal[(s.own[i] - 1 + 6) % 6];
      const k = Math.min(15, (((cnt - age[i]) / cnt) * 16) | 0);
      return Math.abs(k - pulse) < 1.2 ? s.pal[0] : s.pal[k];
    };
    if (p.mode === 'braille') {
      const W2 = W * 2, W3 = W * 3, boff = s.boff || (s.boff = Int32Array.of(0, W, W2, W3, 1, W + 1, W2 + 1, W3 + 1));
      for (let cy = 0; cy < rows; cy++) {
        let j = cy * 4 * W, i = cy * cols;
        for (let cx = 0; cx < cols; cx++, j += 2, i++) {
          const bits = (G[j] ? 1 : 0) | (G[j + W] ? 2 : 0) | (G[j + W2] ? 4 : 0) | (G[j + W3] ? 64 : 0) | (G[j + 1] ? 8 : 0) | (G[j + W + 1] ? 16 : 0) | (G[j + W2 + 1] ? 32 : 0) | (G[j + W3 + 1] ? 128 : 0);
          if (!bits) continue;
          // 取格子裡最新的一點決定顏色
          let best = -1, bi = j;
          for (let q = 0; q < 8; q++) { const o = boff[q]; if (G[j + o] && age[j + o] > best) { best = age[j + o]; bi = j + o; } }
          ch[i] = BRL[bits]; co[i] = colOf(bi);
        }
      }
    } else if (p.mode === 'half') {
      for (let cy = 0; cy < rows; cy++) {
        const j0 = cy * 2 * W, j1 = j0 + W;
        for (let x = 0, i = cy * cols; x < W; x++, i++) {
          const t = G[j0 + x], u = G[j1 + x];
          if (!t && !u) continue;
          ch[i] = t && u ? '█' : t ? '▀' : '▄'; co[i] = colOf(t ? j0 + x : j1 + x);
        }
      }
    } else {
      for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
        if (!G[j]) continue;
        const nb = (x > 0 && G[j - 1]) + (x < W - 1 && G[j + 1]) + (y > 0 && G[j - W]) + (y < H - 1 && G[j + W]);
        const c = nb >= 4 ? '█' : nb === 3 ? '▓' : nb === 2 ? '▒' : '░', col = colOf(j);
        ch[i] = c; co[i] = col; ch[i + 1] = c; co[i + 1] = col;
      }
    }
    // 還在漫步的粒子畫成小點
    if (p.mode === 'pair') for (const w of s.wk) g.set(w.x * 2, w.y, '·', s.bt[3]);
  } });

/* ════════ 12. 易辛磁區（易辛模型、Potts、XY 自旋） ════════ */
const ARROWS = '→↘↓↙←↖↑↗';
const COSL = Float32Array.from({ length: 1024 }, (_, k) => Math.cos((k * TAU) / 1024));
const fcos = a => COSL[((a * 162.97466) | 0) & 1023];
// seq：隨機挑格子逐一更新（sweeps＝每 1/30 秒掃過幾遍），比棋盤式更新慢慢演變、不會整片閃爍
A({ id: 'ca-ising', name: '易辛磁區', cat: '生命', theme: 'ice',
  desc: '臨界溫度的磁性自旋，碎形磁區不停翻湧',
  params: { model: 'ising', T: 2.27, T2: 0, per: 40, h: 0, hamp: 0, sweeps: 0.5, seq: 1, mode: 'half', look: 'spin', q: 2, maxT: 90, reord: 0 },
  variants: [
    { id: 'quench', name: '急冷', theme: 'amber', desc: '突然降溫，磁區慢慢合併長大',
      params: { T: 1.55, mode: 'pair', sweeps: 0.3, maxT: 50, reord: 1 } },
    { id: 'anneal', name: '冷熱循環', theme: 'sunset', desc: '溫度忽高忽低，有序與混亂輪流出現',
      params: { T: 1.3, T2: 4.5, per: 36, mode: 'pair', sweeps: 0.5, look: 'shade' } },
    { id: 'kawasaki', name: '相分離', theme: 'mint', desc: '自旋總量守恆，像油水分離成迷宮紋',
      params: { model: 'kawasaki', T: 1.4, mode: 'pair', sweeps: 3, maxT: 70 } },
    { id: 'walls', name: '磁壁線', theme: 'blueprint', desc: '只畫出磁區之間的邊界線',
      params: { T: 2.3, mode: 'char', look: 'walls', sweeps: 0.5, maxT: 40 } },
  ],
  init(s, f) {
    const p = f.p, [W, H] = simSize(f, p.mode), n = W * H;
    Object.assign(s, { W, H, n, a: new Uint8Array(n), th: null, T: 0, acc: 0, mag: new Float32Array(n), pacc: new Float32Array(10), ordT: 0, chk: 0 });
    [s.XM, s.XP] = wrapX(W);
    if (p.model === 'xy') { s.th = new Float32Array(n); for (let i = 0; i < n; i++) s.th[i] = rnd(0, TAU); }
    else if (p.model === 'potts') for (let i = 0; i < n; i++) s.a[i] = rint(0, p.q - 1);
    else for (let i = 0; i < n; i++) s.a[i] = Math.random() < 0.5 ? 1 : 0;
    s.vis = Float32Array.from(s.a); s.vb = new Uint8Array(n);
    const C = f.C, Hh = f.H;
    s.up = [C(0.92), C(0.75)]; s.dn = C(0.16);
    s.sh = Array.from({ length: 9 }, (_, k) => C(0.15 + k * 0.1));
    s.pc = Array.from({ length: 8 }, (_, k) => Hh(k * 360 / p.q + 20, 0.55));
    s.ac = Array.from({ length: 16 }, (_, k) => Hh(k * 22.5, 0.6));
    s.wc = C(0.85); s.wd = C(0.12);
  },
  temp(s, p) {
    if (!p.T2) return p.T;
    // 從高溫（混亂）開始，慢慢冷卻到有序再加熱回去
    const u = 0.5 + 0.5 * Math.cos((s.T / p.per) * TAU);
    return p.T + (p.T2 - p.T) * u;
  },
  // 隨機挑格子逐一做 Metropolis 更新（易辛模型）；接受機率先算成表
  seqSweep(s, Tt, hf, count) {
    const { W, n, XM, XP, a, pacc } = s, beta = 1 / Tt;
    for (let k = 0; k < 10; k++) { const sv = k >= 5 ? 1 : -1, sum = (k % 5) * 2 - 4, dE = 2 * sv * (sum + hf); pacc[k] = dE <= 0 ? 1 : Math.exp(-dE * beta); }
    for (let c = 0; c < count; c++) {
      const i = (Math.random() * n) | 0, x = i % W, y0 = i - x, v = a[i];
      const m = a[y0 + XM[x]] + a[y0 + XP[x]] + a[i >= W ? i - W : i + n - W] + a[i + W < n ? i + W : i + W - n];
      if (Math.random() < pacc[v * 5 + m]) a[i] = 1 - v;
    }
  },
  sweep(s, p, Tt, hf) {
    const { W, H, XM, XP, a } = s, beta = 1 / Tt;
    if (p.model === 'xy') {
      const th = s.th, d = 1.2;
      for (let k = 0; k < s.n; k++) {
        const i = (Math.random() * s.n) | 0, x = i % W, y = (i / W) | 0;
        const o = th[i], nw = o + rnd(-d, d);
        const b1 = th[y * W + XM[x]], b2 = th[y * W + XP[x]], b3 = th[((y + H - 1) % H) * W + x], b4 = th[((y + 1) % H) * W + x];
        const dE = (fcos(o - b1) + fcos(o - b2) + fcos(o - b3) + fcos(o - b4)) - (fcos(nw - b1) + fcos(nw - b2) + fcos(nw - b3) + fcos(nw - b4));
        if (dE <= 0 || Math.random() < Math.exp(-dE * beta)) th[i] = nw;
      }
      return;
    }
    if (p.model === 'kawasaki') {
      // 隨機挑相鄰兩格交換（總量守恆）：ΔE = 2·si·Si + 2·sj·Sj + 4
      const local = c => { const cx = c % W, cy = (c / W) | 0; return (a[cy * W + XM[cx]] + a[cy * W + XP[cx]] + a[((cy + H - 1) % H) * W + cx] + a[((cy + 1) % H) * W + cx]) * 2 - 4; };
      for (let k = 0; k < s.n; k++) {
        const i = (Math.random() * s.n) | 0, x = i % W, y = (i / W) | 0, dir = (Math.random() * 4) | 0;
        const j = dir === 0 ? y * W + XP[x] : dir === 1 ? y * W + XM[x] : dir === 2 ? ((y + 1) % H) * W + x : ((y + H - 1) % H) * W + x;
        if (a[i] === a[j]) continue;
        const si = a[i] ? 1 : -1, dE = 2 * si * local(i) - 2 * si * local(j) + 4;
        if (dE <= 0 || Math.random() < Math.exp(-dE * beta)) { a[i] = 1 - a[i]; a[j] = 1 - a[j]; }
      }
      return;
    }
    // 棋盤式更新（Ising 或 Potts）
    for (let par = 0; par < 2; par++) for (let y = 0; y < H; y++) {
      const ym = ((y + H - 1) % H) * W, yp = ((y + 1) % H) * W, y0 = y * W;
      for (let x = (y + par) & 1; x < W; x += 2) {
        const i = y0 + x, v = a[i];
        const n1 = a[y0 + XM[x]], n2 = a[y0 + XP[x]], n3 = a[ym + x], n4 = a[yp + x];
        if (p.model === 'potts') {
          const nv = (v + 1 + ((Math.random() * (p.q - 1)) | 0)) % p.q;
          const dE = ((n1 === v) + (n2 === v) + (n3 === v) + (n4 === v)) - ((n1 === nv) + (n2 === nv) + (n3 === nv) + (n4 === nv));
          if (dE <= 0 || Math.random() < Math.exp(-dE * beta)) a[i] = nv;
        } else {
          const sv = v ? 1 : -1, sum = (n1 + n2 + n3 + n4) * 2 - 4;
          const dE = 2 * sv * (sum + hf);
          if (dE <= 0 || Math.random() < Math.exp(-dE * beta)) a[i] = 1 - v;
        }
      }
    }
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols, rows = g.rows;
    s.T += f.dt;
    if (s.T > p.maxT) this.init(s, f);
    const Tt = this.temp(s, p), hf = p.hamp ? p.hamp * Math.sin((s.T / p.per) * TAU) : p.h;
    if (p.seq && p.model === 'ising') this.seqSweep(s, Tt, hf, Math.round(s.n * p.sweeps * Math.min(3, f.dt * 30)));
    else { let k = due(s, f.dt, p.sweeps * 30, 4); while (k-- > 0) this.sweep(s, p, Tt, hf); }
    // 急冷：幾乎整片同一個方向超過兩秒就重新開始（不然後半段只剩一片單色）
    if (p.reord && (s.chk += f.dt) > 0.5) {
      s.chk = 0;
      let m = 0, c = 0; for (let i = 0; i < s.n; i += 3) { m += s.a[i]; c++; }
      s.ordT = Math.abs(m / c - 0.5) > 0.45 ? s.ordT + 0.5 : 0;
      if (s.ordT >= 2) { this.init(s, f); }
    }
    const { W, H } = s, ch = g.ch, co = g.co;
    let a = s.a;
    if (p.model === 'ising' && p.look !== 'shade') {
      // 顯示用的平滑：只翻一下又翻回來的自旋不畫出來，畫面不會像電視雜訊一樣閃
      const vis = s.vis, vb = s.vb, sm = 1 - Math.exp(-f.dt * 7);
      for (let j = 0; j < s.n; j++) { const v = (vis[j] += (a[j] - vis[j]) * sm); vb[j] = v > 0.5 ? 1 : 0; }
      a = vb;
    }
    if (p.model === 'xy') {
      const th = s.th;
      for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
        const u = ((th[j] / TAU) % 1 + 1) % 1;
        ch[i] = ARROWS[((u * 8 + 0.5) | 0) & 7]; co[i] = s.ac[((u * 16) | 0) & 15];
      }
      return;
    }
    if (p.look === 'walls') {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, v = a[i];
        const r = x < W - 1 && a[i + 1] !== v, d = y < H - 1 && a[i + W] !== v;
        if (r || d) { ch[i] = r && d ? '┘' : r ? '│' : '─'; co[i] = s.wc; }
        else if (v) { ch[i] = '·'; co[i] = s.wd; }
      }
      return;
    }
    if (p.mode === 'half') {
      for (let cy = 0; cy < rows; cy++) {
        const j0 = cy * 2 * W, j1 = j0 + W;
        for (let x = 0, i = cy * cols; x < W; x++, i++) {
          const t = a[j0 + x], u = a[j1 + x];
          if (t && u) { ch[i] = '█'; co[i] = s.up[0]; } else if (t) { ch[i] = '▀'; co[i] = s.up[0]; } else if (u) { ch[i] = '▄'; co[i] = s.up[0]; }
          else { ch[i] = '·'; co[i] = s.dn; }
        }
      }
      return;
    }
    // pair：Potts 依狀態上色；shade 依附近的平均磁化（平滑）上濃淡
    const mag = s.mag, sm = 1 - Math.exp(-f.dt * 6);
    for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
      const v = a[j];
      let c, col;
      if (p.model === 'potts') { c = '█'; col = s.pc[v]; }
      else if (p.look === 'shade') {
        const m = (a[j] + a[y * W + s.XM[x]] + a[y * W + s.XP[x]] + a[((y + H - 1) % H) * W + x] + a[((y + 1) % H) * W + x]) / 5;
        mag[j] += (m - mag[j]) * sm;
        const q = Math.min(8, (mag[j] * 9) | 0);
        // 全部朝下的區域也畫成暗暗的 ░，不會變成一片空白
        c = q >= 7 ? '█' : q >= 5 ? '▓' : q >= 3 ? '▒' : '░';
        col = s.sh[q];
      } else if (v) { c = '█'; col = s.up[0]; } else { c = '░'; col = s.dn; }
      if (c === ' ') continue;
      ch[i] = c; co[i] = col; ch[i + 1] = c; co[i + 1] = col;
    }
  } });

/* ════════ 13. 族群競爭（剪刀石頭布、投票者、捕食者與獵物） ════════ */
A({ id: 'ca-rps', name: '剪刀石頭布', cat: '生命', theme: 'rainbow', hue: true,
  desc: '三個族群循環相剋，捲出旋轉的螺旋戰線',
  params: { model: 'rps', q: 3, thr: 2, jit: 3, sps: 14, mode: 'pair', look: 'block', maxT: 90 },
  variants: [
    { id: 'mobile', name: '游走族群', theme: 'sunset', desc: '個體會四處移動，螺旋變得又大又圓',
      params: { model: 'may', q: 3, rate: 2.2, sel: 0.25, rep: 0.25 } },
    { id: 'schelling', name: '隔離模型', theme: 'ocean', desc: '只想住在同類旁邊，城市漸漸分成兩區',
      params: { model: 'schelling', thr: 0.55, rate: 0.04, maxT: 60 } },
    { id: 'glyph', name: '符號戰場', theme: 'cyber', desc: '用三角、方塊、圓點畫出三方混戰',
      params: { q: 3, thr: 2, jit: 2, mode: 'char', look: 'glyph', sps: 12 } },
  ],
  init(s, f) {
    const p = f.p, [W, H] = simSize(f, p.mode), n = W * H;
    const a = new Uint8Array(n);
    if (p.model === 'schelling') for (let i = 0; i < n; i++) { const r = Math.random(); a[i] = r < 0.1 ? 0 : r < 0.55 ? 1 : 2; }
    else if (p.model === 'voter') { for (let i = 0; i < n; i++) a[i] = rint(0, p.q - 1); }
    else if (p.model === 'may') for (let i = 0; i < n; i++) a[i] = Math.random() < 0.15 ? 0 : rint(1, 3);
    else {
      // 先撒大塊色斑，比完全隨機更快形成螺旋
      for (let i = 0; i < n; i++) a[i] = rint(0, p.q - 1);
      for (let k = 0; k < n / 30; k++) blob(a, W, H, rnd(0, W), rnd(0, H), rnd(1, 4), rnd(1, 4), 0.9, rint(0, p.q - 1));
    }
    Object.assign(s, { W, H, n, a, b: new Uint8Array(n), T: 0, acc: 0 });
    [s.XM, s.XP] = wrapX(W);
    const Hh = f.H, q = p.model === 'schelling' ? 3 : p.model === 'may' ? 4 : p.q;
    s.col = Array.from({ length: q }, (_, k) => Hh((k * 360) / (p.model === 'may' ? 3 : q) + 15, p.model === 'may' ? 0.5 : 0.35 + 0.35 * ((k % 3) / 2)));
    if (p.model === 'schelling') { s.col = [null, Hh(30, 0.5), Hh(200, 0.5)]; s.hot = [null, Hh(30, 0.8), Hh(200, 0.8)]; s.unh = new Uint8Array(n); }
    if (p.model === 'may') s.col = [null, Hh(20, 0.55), Hh(140, 0.55), Hh(260, 0.6)];
    s.dim = f.C(0.12);
  },
  step(s, p) {
    const { W, H, XM, XP, a, b } = s, q = p.q;
    for (let y = 0; y < H; y++) {
      const ym = ((y + H - 1) % H) * W, y0 = y * W, yp = ((y + 1) % H) * W;
      for (let x = 0; x < W; x++) {
        const i = y0 + x, v = a[i], p1 = (v + 1) % q, p2 = (v + 3) % q;
        let c1 = 0, c2 = 0;
        const n1 = a[ym + XM[x]], n2 = a[ym + x], n3 = a[ym + XP[x]], n4 = a[y0 + XM[x]], n5 = a[y0 + XP[x]], n6 = a[yp + XM[x]], n7 = a[yp + x], n8 = a[yp + XP[x]];
        c1 = (n1 === p1) + (n2 === p1) + (n3 === p1) + (n4 === p1) + (n5 === p1) + (n6 === p1) + (n7 === p1) + (n8 === p1);
        if (q === 5) c2 = (n1 === p2) + (n2 === p2) + (n3 === p2) + (n4 === p2) + (n5 === p2) + (n6 === p2) + (n7 === p2) + (n8 === p2);
        const t = p.thr + ((Math.random() * (p.jit + 1)) | 0);
        b[i] = c1 > t && c1 >= c2 ? p1 : c2 > t ? p2 : v;
      }
    }
    s.a = b; s.b = a;
  },
  // 謝林隔離模型：不滿意的人搬到隨機空屋
  schelling(s, p) {
    const { W, H, XM, XP, a, unh } = s;
    let moved = 0;
    const like = i => { const x = i % W, y = (i / W) | 0, v = a[i], ym = ((y + H - 1) % H) * W, y0 = y * W, yp = ((y + 1) % H) * W; let same = 0, occ = 0; for (const j of [ym + XM[x], ym + x, ym + XP[x], y0 + XM[x], y0 + XP[x], yp + XM[x], yp + x, yp + XP[x]]) { const u = a[j]; if (u) { occ++; if (u === v) same++; } } return occ ? same / occ : 1; };
    for (let k = 0, m = Math.round(s.n * p.rate); k < m; k++) {
      const i = (Math.random() * s.n) | 0;
      if (!a[i]) continue;
      if (like(i) >= p.thr) { unh[i] = 0; continue; }
      unh[i] = 1;
      for (let t = 0; t < 30; t++) { const j = (Math.random() * s.n) | 0; if (!a[j]) { a[j] = a[i]; a[i] = 0; unh[j] = 1; unh[i] = 0; moved++; break; } }
    }
    return moved;
  },
  // 非同步更新：投票者模型與 May–Leonard 移動族群
  async(s, p, count) {
    const { W, H, XM, XP, a } = s;
    for (let k = 0; k < count; k++) {
      const i = (Math.random() * s.n) | 0, x = i % W, y = (i / W) | 0, d = (Math.random() * 4) | 0;
      const j = d === 0 ? y * W + XP[x] : d === 1 ? y * W + XM[x] : d === 2 ? ((y + 1) % H) * W + x : ((y + H - 1) % H) * W + x;
      if (p.model === 'voter') { a[i] = a[j]; continue; }
      const r = Math.random(), u = a[i], v = a[j];
      if (r < p.sel) { if (u && v && v === (u % 3) + 1) a[j] = 0; }
      else if (r < p.sel + p.rep) { if (u && !v) a[j] = u; }
      else { a[i] = v; a[j] = u; }
    }
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols, rows = g.rows;
    s.T += f.dt;
    if (s.T > p.maxT) this.init(s, f);
    if (p.model === 'schelling') {
      if (s.hold > 0) { s.hold -= f.dt; if (s.hold <= 0) this.init(s, f); }
      else { const mv = this.schelling(s, p); s.quiet = mv < Math.max(2, s.n * 0.0005) ? (s.quiet || 0) + f.dt : 0; if (s.quiet > 4) { s.hold = 4; s.quiet = 0; } }
    }
    else if (p.model === 'voter' || p.model === 'may') this.async(s, p, Math.round(s.n * p.rate * Math.min(3, f.dt * 30)));
    else { let k = due(s, f.dt, p.sps, 3); while (k-- > 0) this.step(s, p); }
    // 族群滅絕（只剩一種）就重來
    if ((s.chk = (s.chk || 0) + f.dt) > 2) {
      s.chk = 0;
      const seen = new Set(); for (let i = 0; i < s.n; i += 13) seen.add(s.a[i]);
      if (seen.size <= (p.model === 'may' ? 2 : 1)) this.init(s, f);
    }
    const { W, H, a, col } = s, ch = g.ch, co = g.co;
    if (p.mode === 'half') {
      for (let cy = 0; cy < rows; cy++) {
        // 整格用上半的顏色，避免半格字露出底色變成黑色掃描線
        const j0 = cy * 2 * W;
        for (let x = 0, i = cy * cols; x < W; x++, i++) { ch[i] = '█'; co[i] = col[a[j0 + x]]; }
      }
      return;
    }
    if (p.mode === 'char') {
      const GL = '▲■●◆▼';
      for (let i = 0; i < s.n; i++) { const v = a[i]; ch[i] = GL[v]; co[i] = col[v]; }
      return;
    }
    for (let y = 0; y < H; y++) for (let x = 0, j = y * W, i = y * cols; x < W; x++, j++, i += 2) {
      const v = a[j], c = col[v];
      if (!c) { if (p.model === 'schelling') continue; ch[i] = '·'; co[i] = s.dim; continue; }
      if (p.model === 'schelling') { const hot = s.unh[j]; ch[i] = hot ? '▓' : '█'; ch[i + 1] = hot ? '▓' : '█'; co[i] = co[i + 1] = hot ? s.hot[v] : c; continue; }
      ch[i] = '█'; co[i] = c; ch[i + 1] = '█'; co[i + 1] = c;
    }
  } });

/* ════════ 14. 鳥群（Boids 群聚模擬） ════════ */
const BIRD = ['>', '\\', 'v', '/', '<', '\\', '^', '/'];
A({ id: 'ca-boids', name: '鳥群飛行', cat: '生命', theme: 'ice',
  desc: '分離、對齊、聚集三條規則，飛出整群椋鳥',
  params: { dens: 1.7, vmax: 16, vmin: 7, R: 5, sepR: 1.6, wA: 1.1, wC: 0.55, wS: 2.4, noise: 0.6, decay: 2.5, pred: 0, mode: 'flock', species: 1, center: 0, spring: 0, sr: 0 },
  variants: [
    { id: 'hawk', name: '老鷹來襲', theme: 'sunset', desc: '兩隻老鷹衝進鳥群，鳥群瞬間散開又聚合',
      params: { pred: 2, dens: 1.8, decay: 2.2 } },
    { id: 'mill', name: '魚群漩渦', theme: 'ocean', desc: '群體繞著中心打轉，形成旋轉的環',
      params: { center: 1, dens: 2.4, wC: 0.2, noise: 0.6, decay: 1.6 } },
    { id: 'lanes', name: '對向車道', theme: 'rainbow', hue: true, desc: '兩群往相反方向前進，自動排成車道',
      params: { mode: 'lanes', species: 2, dens: 2, wA: 1.6, decay: 5 } },
    { id: 'exposure', name: '長曝光', theme: 'gold', desc: '少量的鳥拖出長長的光軌',
      params: { dens: 0.5, decay: 0.45, vmax: 14 } },
  ],
  init(s, f) {
    const p = f.p, WW = f.cols, HH = f.rows * f.aspect;
    // 大螢幕上鳥要多一些（不然 5K 畫面上只剩零星小點）
    const N = Math.max(30, Math.round((f.cols * f.rows) / 1000 * p.dens * 10 * clamp(f.cols / 160, 1, 2)));
    Object.assign(s, { WW, HH, N, x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), sp: new Uint8Array(N), tr: new Float32Array(f.cols * f.rows), tc: new Uint8Array(f.cols * f.rows), T: 0, tgt: [WW / 2, HH / 2] });
    for (let i = 0; i < N; i++) {
      s.sp[i] = i % p.species;
      s.x[i] = rnd(0, WW); s.y[i] = rnd(0, HH);
      const a = p.mode === 'lanes' ? (s.sp[i] ? Math.PI : 0) + rnd(-0.3, 0.3) : rnd(0, TAU), v = rnd(p.vmin, p.vmax);
      s.vx[i] = Math.cos(a) * v; s.vy[i] = Math.sin(a) * v;
    }
    s.preds = Array.from({ length: p.pred }, () => ({ x: rnd(0, WW), y: rnd(0, HH), vx: rnd(-5, 5), vy: rnd(-5, 5) }));
    s.gw = Math.max(1, Math.ceil(WW / p.R)); s.gh = Math.max(1, Math.ceil(HH / p.R));
    s.head = new Int32Array(s.gw * s.gh); s.next = new Int32Array(N);
    const C = f.C, Hh = f.H;
    s.bc = [0, 1, 2].map(k => Hh(k * 120 + 30, 0.85));
    s.tcol = [0, 1, 2].map(k => Array.from({ length: 8 }, (_, q) => Hh(k * 120 + 30, 0.1 + q * 0.07)));
    s.pc = C(1);
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols, rows = g.rows, dt = Math.min(f.dt, 0.05), { WW, HH, N, x, y, vx, vy, sp, head, next, gw, gh } = s;
    s.T += dt;
    // 蚊蚋：目標點緩慢漂移
    if (p.mode === 'swarm') s.tgt = [0, 1, 2].map(k => [WW * (0.5 + 0.36 * Math.sin(s.T * (0.17 + k * 0.05) + k * 2.1)), HH * (0.5 + 0.32 * Math.sin(s.T * (0.23 + k * 0.04) + 1 + k))]);
    head.fill(-1);
    for (let i = 0; i < N; i++) {
      const c = Math.min(gw - 1, (x[i] / p.R) | 0) + Math.min(gh - 1, (y[i] / p.R) | 0) * gw;
      next[i] = head[c]; head[c] = i;
    }
    const R2 = p.R * p.R, S2 = p.sepR * p.sepR;
    for (let i = 0; i < N; i++) {
      let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, cnt = 0;
      const gx = Math.min(gw - 1, (x[i] / p.R) | 0), gy = Math.min(gh - 1, (y[i] / p.R) | 0);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const qx = (gx + ox + gw) % gw, qy = (gy + oy + gh) % gh;
        for (let j = head[qx + qy * gw]; j >= 0; j = next[j]) {
          if (j === i) continue;
          let dx = x[j] - x[i], dy = y[j] - y[i];
          if (dx > WW / 2) dx -= WW; else if (dx < -WW / 2) dx += WW;
          if (dy > HH / 2) dy -= HH; else if (dy < -HH / 2) dy += HH;
          const d2 = dx * dx + dy * dy;
          if (d2 > R2) continue;
          if (d2 < S2 && d2 > 1e-6) { sx -= dx / d2; sy -= dy / d2; }
          if (sp[j] !== sp[i]) { if (d2 < S2 * 3) { sx -= dx / (d2 + 0.1) * 0.6; sy -= dy / (d2 + 0.1) * 0.6; } continue; }
          ax += vx[j]; ay += vy[j]; cx += dx; cy += dy; cnt++;
        }
      }
      let fx = sx * p.wS, fy = sy * p.wS;
      if (cnt) { fx += (ax / cnt - vx[i]) * p.wA * 0.5 + (cx / cnt) * p.wC; fy += (ay / cnt - vy[i]) * p.wA * 0.5 + (cy / cnt) * p.wC; }
      if (p.mode === 'swarm') {
        // 只有飛出半徑 sr 之外才被拉回來，蟲雲才會蓬鬆地填滿一整團，不會縮成一個小點
        const t = s.tgt[sp[i]], dx = t[0] - x[i], dy = t[1] - y[i], d = Math.hypot(dx, dy) + 1e-6, r0 = Math.min(WW, HH) * p.sr;
        if (d > r0) { const k = (d - r0) * p.spring / d; fx += dx * k; fy += dy * k; }
      }
      if (p.mode === 'lanes') fx += (sp[i] ? -1 : 1) * 2;
      if (p.center) {
        // 繞中心打轉：向心力加上切線方向
        const dx = WW / 2 - x[i], dy = HH / 2 - y[i], d = Math.hypot(dx, dy) + 0.01, r0 = Math.min(WW, HH) * 0.3;
        fx += (dx / d) * (d - r0) * 0.05 + (-dy / d) * 3; fy += (dy / d) * (d - r0) * 0.05 + (dx / d) * 3;
      }
      for (const pr of s.preds) {
        let dx = x[i] - pr.x, dy = y[i] - pr.y;
        if (dx > WW / 2) dx -= WW; else if (dx < -WW / 2) dx += WW;
        if (dy > HH / 2) dy -= HH; else if (dy < -HH / 2) dy += HH;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120) { fx += (dx / (d2 + 1)) * 60; fy += (dy / (d2 + 1)) * 60; }
      }
      fx += gauss() * p.noise; fy += gauss() * p.noise;
      vx[i] += fx * dt * 6; vy[i] += fy * dt * 6;
      const v = Math.hypot(vx[i], vy[i]) + 1e-6, cl = v > p.vmax ? p.vmax / v : v < p.vmin ? p.vmin / v : 1;
      vx[i] *= cl; vy[i] *= cl;
    }
    for (let i = 0; i < N; i++) {
      x[i] = (x[i] + vx[i] * dt + WW) % WW; y[i] = (y[i] + vy[i] * dt + HH) % HH;
    }
    // 老鷹追最近的一隻鳥
    for (const pr of s.preds) {
      let best = 1e9, bx = 0, by = 0;
      for (let i = 0; i < N; i += 3) { let dx = x[i] - pr.x, dy = y[i] - pr.y; if (dx > WW / 2) dx -= WW; else if (dx < -WW / 2) dx += WW; if (dy > HH / 2) dy -= HH; else if (dy < -HH / 2) dy += HH; const d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; bx = dx; by = dy; } }
      const d = Math.sqrt(best) + 0.01;
      pr.vx += (bx / d) * 40 * dt; pr.vy += (by / d) * 40 * dt;
      const v = Math.hypot(pr.vx, pr.vy), vm = p.vmax * 1.25; if (v > vm) { pr.vx *= vm / v; pr.vy *= vm / v; }
      pr.x = (pr.x + pr.vx * dt + WW) % WW; pr.y = (pr.y + pr.vy * dt + HH) % HH;
    }
    // 繪製：先畫衰減的軌跡，再畫鳥
    const tr = s.tr, tc = s.tc, dk = Math.exp(-f.dt * p.decay), ch = g.ch, co = g.co, asp = f.aspect;
    for (let i = 0; i < N; i++) { const cx = x[i] | 0, cy = (y[i] / asp) | 0; if (cx < cols && cy < rows) { const k = cy * cols + cx; tr[k] = 1; tc[k] = sp[i]; } }
    for (let k = 0; k < tr.length; k++) {
      const v = (tr[k] *= dk);
      if (v < 0.06) continue;
      ch[k] = v > 0.5 ? '•' : v > 0.2 ? '·' : '.'; co[k] = s.tcol[tc[k]][Math.min(7, (v * 8) | 0)];
    }
    for (let i = 0; i < N; i++) {
      const cx = x[i] | 0, cy = (y[i] / asp) | 0;
      if (cx >= cols || cy >= rows) continue;
      const a = Math.atan2(vy[i], vx[i]), o = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
      ch[cy * cols + cx] = BIRD[o]; co[cy * cols + cx] = s.bc[sp[i]];
    }
    for (const pr of s.preds) g.set(pr.x, pr.y / asp, '◆', s.pc);
  } });

/* ════════ 15. 黏菌網路（Physarum 多頭絨泡菌的代理人模擬） ════════ */
// 正弦查表（4096 格），粒子很多時比 Math.sin / Math.cos 快
const SIN_T = Float32Array.from({ length: 4096 }, (_, k) => Math.sin((k * TAU) / 4096)), SIN_K = 4096 / TAU;
A({ id: 'ca-slime', name: '黏菌網路', cat: '生命', theme: 'gold',
  desc: '成千上萬的黏菌粒子循著氣味織成脈絡網',
  params: { SA: 22.5, RA: 45, SO: 9, SS: 1, dep: 1, decay: 0.07, dens: 0.22, sps: 30, start: 'rand', species: 1, food: 0, gamma: 0.5, maxT: 60, resp: 0.02 },
  variants: [
    { id: 'rings', name: '環網', theme: 'ice', desc: '大轉角與遠距感測，織出圓環狀的網眼',
      params: { SA: 60, RA: 25, SO: 14, decay: 0.08, dens: 0.1 } },
    { id: 'bloom', name: '綻放', theme: 'sunset', desc: '粒子從中心向外爆開，像一朵菌絲花',
      params: { start: 'disc', decay: 0.05, dens: 0.22, maxT: 40, resp: 0 } },
    { id: 'food', name: '覓食路網', theme: 'mint', desc: '黏菌在幾個食物點之間連出最短路網',
      params: { food: 9, SA: 30, RA: 30, SO: 10, decay: 0.08, dens: 0.18, maxT: 70 } },
    { id: 'rivals', name: '雙菌爭地', theme: 'rainbow', hue: true, desc: '兩種黏菌互相排斥，各自佔領地盤',
      params: { species: 2, SA: 30, RA: 40, SO: 9, decay: 0.1, dens: 0.1 } },
  ],
  init(s, f) {
    const p = f.p, W = f.cols, H = f.rows * 2, n = W * H, A0 = Math.round(n * p.dens), S = p.species;
    Object.assign(s, { W, H, n, A: A0, ax: new Float32Array(A0), ay: new Float32Array(A0), aa: new Float32Array(A0), asp: new Uint8Array(A0), tr: [], tmp: new Float32Array(n), T: 0, acc: 0, mx: [1, 1] });
    for (let k = 0; k < S; k++) s.tr.push(new Float32Array(n));
    for (let i = 0; i < A0; i++) {
      s.asp[i] = i % S;
      if (p.start === 'disc') { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * Math.min(W, H) * 0.08; s.ax[i] = W / 2 + Math.cos(a) * r; s.ay[i] = H / 2 + Math.sin(a) * r; s.aa[i] = a; }
      else { s.ax[i] = rnd(0, W); s.ay[i] = rnd(0, H); s.aa[i] = rnd(0, TAU); }
    }
    s.foods = Array.from({ length: p.food }, () => [rint(W * 0.06, W * 0.94), rint(H * 0.1, H * 0.9)]);
    const C = f.C, Hh = f.H;
    s.cols = [0, 1].map(k => Array.from({ length: 10 }, (_, q) => Hh(k ? 200 : 20, 0.15 + q * 0.085)));
    s.mono = Array.from({ length: 10 }, (_, q) => C(0.12 + q * 0.098));
    s.foodC = C(1);
    const d2r = Math.PI / 180;
    s.sa = p.SA * d2r; s.ra = p.RA * d2r;
  },
  step(s, p) {
    const { W, H, ax, ay, aa, asp, tr, A } = s, sa = s.sa, ra = s.ra, SO = p.SO, SS = p.SS, S = p.species;
    const tsin = v => SIN_T[((v * SIN_K) | 0) & 4095], tcos = v => SIN_T[(((v * SIN_K) | 0) + 1024) & 4095];
    const smp = (m, x, y) => { let xi = x | 0, yi = y | 0; if (xi < 0) xi += W; else if (xi >= W) xi -= W; if (yi < 0) yi += H; else if (yi >= H) yi -= H; return m[yi * W + xi]; };
    const bias = (p.bias || 0) * 0.01;
    for (let i = 0; i < A; i++) {
      const a = aa[i], x = ax[i], y = ay[i], k = asp[i], me = tr[k], ot = S > 1 ? tr[1 - k] : null;
      const c0 = tcos(a), s0 = tsin(a), cl = tcos(a - sa), sl = tsin(a - sa), cr = tcos(a + sa), sr = tsin(a + sa);
      let F = smp(me, x + c0 * SO, y + s0 * SO), FL = smp(me, x + cl * SO, y + sl * SO), FR = smp(me, x + cr * SO, y + sr * SO);
      if (ot) { F -= smp(ot, x + c0 * SO, y + s0 * SO) * 1.5; FL -= smp(ot, x + cl * SO, y + sl * SO) * 1.5; FR -= smp(ot, x + cr * SO, y + sr * SO) * 1.5; }
      let na = a;
      if (F > FL && F > FR) na = a;
      else if (F < FL && F < FR) na = a + (Math.random() < 0.5 ? -ra : ra);
      else if (FL < FR) na = a + ra;
      else if (FR < FL) na = a - ra;
      na += bias + (Math.random() - 0.5) * 0.1;
      if (na > 1e4 || na < -1e4) na %= TAU;
      let nx = x + tcos(na) * SS, ny = y + tsin(na) * SS;
      if (nx < 0) nx += W; else if (nx >= W) nx -= W;
      if (ny < 0) ny += H; else if (ny >= H) ny -= H;
      ax[i] = nx; ay[i] = ny; aa[i] = na;
      me[(ny | 0) * W + (nx | 0)] += p.dep;
    }
    for (const [fx, fy] of s.foods) for (let k = 0; k < S; k++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tr[k][((fy + dy + H) % H) * W + ((fx + dx + W) % W)] += 3;
    // 擴散（可分離的 3×3 平均）＋衰減
    const tmp = s.tmp, keep = 1 - p.decay;
    for (const m of tr) {
      for (let y = 0; y < H; y++) { const r = y * W; for (let x = 0; x < W; x++) tmp[r + x] = (m[r + (x ? x - 1 : W - 1)] + m[r + x] + m[r + (x < W - 1 ? x + 1 : 0)]) * (1 / 3); }
      for (let y = 0; y < H; y++) { const r = y * W, ru = (y ? y - 1 : H - 1) * W, rd = (y < H - 1 ? y + 1 : 0) * W; for (let x = 0; x < W; x++) m[r + x] = (tmp[ru + x] + tmp[r + x] + tmp[rd + x]) * (keep / 3); }
    }
  },
  frame(s, f) {
    const p = f.p, g = f.g, cols = g.cols, rows = g.rows;
    s.T += f.dt;
    if (s.T > p.maxT) this.init(s, f);
    let k = due(s, f.dt, p.sps, 2);
    while (k-- > 0) this.step(s, p);
    // 每秒把一小部分粒子丟回隨機位置，網路才不會縮成幾條粗線
    if (p.resp) for (let r = due(s, f.dt, s.A * p.resp, s.A * 0.05, 'rsAcc'); r > 0; r--) {
      const i = (Math.random() * s.A) | 0;
      s.ax[i] = rnd(0, s.W); s.ay[i] = rnd(0, s.H); s.aa[i] = rnd(0, TAU);
    }
    const { W, tr } = s, ch = g.ch, co = g.co, S = p.species, gm = p.gamma;
    for (let q = 0; q < S; q++) { let m = 0.5; const t = tr[q]; for (let i = 0; i < s.n; i += 5) if (t[i] > m) m = t[i]; s.mx[q] += (m - s.mx[q]) * Math.min(1, f.dt * 2); }
    for (let cy = 0; cy < rows; cy++) {
      const j0 = cy * 2 * W, j1 = j0 + W;
      for (let x = 0, i = cy * cols; x < cols; x++, i++) {
        if (S === 1) {
          const v = Math.max(tr[0][j0 + x], tr[0][j1 + x]) / (s.mx[0] * 0.8);
          if (v < 0.02) continue;
          const t = Math.min(1, Math.pow(v, gm)), q = Math.min(9, (t * 10) | 0);
          ch[i] = RAMP10[Math.max(1, q)]; co[i] = s.mono[q];
        } else {
          const a = Math.max(tr[0][j0 + x], tr[0][j1 + x]) / (s.mx[0] * 0.8), b = Math.max(tr[1][j0 + x], tr[1][j1 + x]) / (s.mx[1] * 0.8);
          const v = Math.max(a, b);
          if (v < 0.02) continue;
          const t = Math.min(1, Math.pow(v, gm)), q = Math.min(9, (t * 10) | 0);
          ch[i] = RAMP10[Math.max(1, q)]; co[i] = s.cols[a >= b ? 0 : 1][q];
        }
      }
    }
    for (const [fx, fy] of s.foods) g.set(fx, fy / 2, '◉', s.foodC);
  } });

})();
