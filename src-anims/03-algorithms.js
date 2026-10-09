// 演算法視覺化：排序、尋路、迷宮演算法、河內塔、N 皇后、騎士巡遊、數獨、凸包、圖論、分群、隨機漫步、樹。
// 整個檔案包在函式裡，輔助常數不會和其他模組撞名。
(() => {
/* ════════ 共用工具 ════════ */
const BRL = Array.from({ length: 256 }, (_, i) => (i ? String.fromCharCode(0x2800 + i) : ' '));
const BB = [1, 8, 2, 16, 4, 32, 64, 128]; // 點字位元：索引 = (子列 << 1) | 子行
const EIGHTH = ['', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const CAT = '演算法';
// 畫面上的文字：英文介面（f.lang === 'en'）顯示英文，其他情況照舊顯示中文
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
// 依照每秒步數換算這一格要跑幾步（不假設固定畫格率）
function due(s, dt, rate, max) {
  s.acc = (s.acc || 0) + dt * rate;
  let n = Math.floor(s.acc);
  s.acc -= n;
  if (n > max) { n = max; s.acc = 0; }
  return n;
}
// 各配色的色相範圍 [起點, 跨度]：有色相時，漸層顏色只在這個範圍內變化，和配色名稱一致
const HUE_WIN = { matrix: [95, 70], amber: [20, 35], ice: [175, 45], fire: [355, 60], synth: [270, 140], ocean: [180, 55], sakura: [300, 50], forest: [70, 60],
  mono: [190, 40], paper: [200, 40], neon: [250, 90], gold: [35, 25], blood: [345, 30], mint: [140, 45], lavender: [245, 50], sunset: [320, 85], toxic: [65, 45],
  blueprint: [195, 35], cyber: [180, 230], rainbow: [0, 330] };
// 彩虹配色的最暗與最亮色（用來判斷使用者是不是另外選了彩虹配色）
const RB0 = rgb(...hsl2rgb(250, 0.95, 0.12)), RB1 = rgb(...hsl2rgb(0, 0.95, 0.67));
// 配色改變（使用者換主題）時回傳 true，讓動畫重建顏色表；e 是目前的桌布（帶有 theme）
function themed(s, f, e) {
  if (s._C === f.C) return false;
  s._C = f.C; s.hueOn = f.H(0, 0.5) !== f.H(120, 0.5);
  s.hw = f.C(0) === RB0 && f.C(1) === RB1 ? HUE_WIN.rainbow : HUE_WIN[e && e.theme] || HUE_WIN.rainbow;
  return true;
}
// 色相或亮度：有色相時用 hue，沒有時用 t 當亮度（用在有固定意義的顏色：目前位置、衝突、完成…）
const hv = (s, f, hue, light, t) => (s.hueOn ? f.H(hue, light) : f.C(t));
// 漸層色：u∈[0,1] 對到這個配色的色相範圍；範圍窄時再用亮度拉開層次
function hg(s, f, u, light, t) {
  if (!s.hueOn) return f.C(t);
  const w = s.hw || HUE_WIN.rainbow;
  return f.H(w[0] + u * w[1], w[1] < 150 ? light * (0.62 + 0.5 * u) : light);
}
// 三角波 0→1→0：循環使用的漸層不會在窄色相範圍裡出現斷層
const tri = x => 1 - Math.abs(2 * fract(x) - 1);
// 小標籤：先清掉背景再寫字，縮圖太窄時不畫
function tag(g, x, y, str, col) {
  if (g.cols < 60) return;
  const w = g.textW(str);
  if (x < 0) x = g.cols - w + x;
  for (let k = -1; k <= w; k++) g.set(x + k, y, ' ', col);
  g.text(x, y, str, col);
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
const fmt = n => String(Math.floor(n));

// 點字畫布（子像素 2×4），用來畫細線與散點
class Dots {
  constructor(cols, rows) { this.cols = cols; this.rows = rows; this.W = cols * 2; this.H = rows * 4; this.b = new Uint8Array(cols * rows); this.c = new Array(cols * rows).fill('#ffffff'); }
  clear() { this.b.fill(0); }
  dot(x, y, col) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    x |= 0; y |= 0;
    const i = (y >> 2) * this.cols + (x >> 1);
    this.b[i] |= BB[((y & 3) << 1) | (x & 1)]; this.c[i] = col;
  }
  line(x0, y0, x1, y1, col) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))) || 1;
    for (let k = 0; k <= n; k++) this.dot(x0 + (dx * k) / n + 0.5, y0 + (dy * k) / n + 0.5, col);
  }
  flush(g) {
    const b = this.b, c = this.c, ch = g.ch, co = g.co;
    for (let i = 0, n = b.length; i < n; i++) if (b[i]) { ch[i] = BRL[b[i]]; co[i] = c[i]; }
  }
}

/* ════════ 排序引擎（產生器：每一次比較或寫入就讓出一步） ════════ */
function sw(A, i, j) { const a = A.a, t = a[i]; a[i] = a[j]; a[j] = t; A.w += 2; A.hot[i] = 1; A.hot[j] = 1; }
function cm(A, i, j) { A.c++; A.h1 = i; A.h2 = j; }
const SORT = {
  *bubble(A) {
    const a = A.a, n = A.n;
    for (let e = n - 1; e > 0; e--) {
      let any = false;
      for (let j = 0; j < e; j++) { cm(A, j, j + 1); if (a[j] > a[j + 1]) { sw(A, j, j + 1); any = true; } yield; }
      if (!any) return;
    }
  },
  *cocktail(A) {
    const a = A.a;
    let lo = 0, hi = A.n - 1;
    while (lo < hi) {
      let last = lo;
      for (let j = lo; j < hi; j++) { cm(A, j, j + 1); if (a[j] > a[j + 1]) { sw(A, j, j + 1); last = j; } yield; }
      hi = last; last = hi;
      for (let j = hi; j > lo; j--) { cm(A, j - 1, j); if (a[j - 1] > a[j]) { sw(A, j - 1, j); last = j; } yield; }
      lo = last;
    }
  },
  *gnome(A) {
    const a = A.a, n = A.n;
    let i = 1;
    while (i < n) { cm(A, i - 1, i); if (a[i - 1] <= a[i]) i++; else { sw(A, i - 1, i); if (i > 1) i--; } yield; }
  },
  *oddeven(A) {
    const a = A.a, n = A.n;
    let sorted = false;
    while (!sorted) {
      sorted = true;
      for (let p = 0; p < 2; p++) for (let j = p; j + 1 < n; j += 2) { cm(A, j, j + 1); if (a[j] > a[j + 1]) { sw(A, j, j + 1); sorted = false; } yield; }
    }
  },
  *comb(A) {
    const a = A.a, n = A.n;
    let gap = n, sorted = false;
    while (!sorted) {
      gap = Math.floor(gap / 1.3);
      if (gap <= 1) { gap = 1; sorted = true; }
      for (let j = 0; j + gap < n; j++) { cm(A, j, j + gap); if (a[j] > a[j + gap]) { sw(A, j, j + gap); sorted = false; } yield; }
    }
  },
  *insertion(A) {
    const a = A.a, n = A.n;
    for (let i = 1; i < n; i++) {
      let j = i;
      while (j > 0) { cm(A, j - 1, j); if (a[j - 1] > a[j]) { sw(A, j - 1, j); j--; yield; } else { yield; break; } }
    }
  },
  *selection(A) {
    const a = A.a, n = A.n;
    for (let i = 0; i < n - 1; i++) {
      let m = i;
      for (let j = i + 1; j < n; j++) { cm(A, m, j); if (a[j] < a[m]) m = j; yield; }
      if (m !== i) { sw(A, i, m); yield; }
    }
  },
  *shell(A) {
    const a = A.a, n = A.n, gaps = [1, 4, 10, 23, 57, 132, 301, 701, 1577, 3548, 7983];
    for (let gi = gaps.length - 1; gi >= 0; gi--) {
      const g = gaps[gi];
      if (g >= n) continue;
      for (let i = g; i < n; i++) {
        let j = i;
        while (j >= g) { cm(A, j - g, j); if (a[j - g] > a[j]) { sw(A, j - g, j); j -= g; yield; } else { yield; break; } }
      }
    }
  },
  *quick(A) {
    const a = A.a, st = [0, A.n - 1];
    while (st.length) {
      const hi = st.pop(), lo = st.pop();
      if (lo >= hi) continue;
      const pv = a[(lo + hi) >> 1];
      A.lo = lo; A.hi = hi; A.pv = pv;
      let i = lo, j = hi;
      while (i <= j) {
        while (a[i] < pv) { cm(A, i, j); i++; yield; }
        while (a[j] > pv) { cm(A, i, j); j--; yield; }
        if (i <= j) { cm(A, i, j); sw(A, i, j); i++; j--; yield; }
      }
      st.push(i, hi, lo, j);
    }
  },
  *merge(A) {
    const a = A.a, b = A.aux, L = [];
    (function rec(lo, hi) { if (hi - lo < 2) return; const mid = (lo + hi) >> 1; rec(lo, mid); rec(mid, hi); L.push(lo, mid, hi); })(0, A.n);
    for (let q = 0; q < L.length; q += 3) {
      const lo = L[q], mid = L[q + 1], hi = L[q + 2];
      for (let k = lo; k < hi; k++) b[k] = a[k];
      let i = lo, j = mid;
      for (let k = lo; k < hi; k++) {
        if (i < mid && (j >= hi || b[i] <= b[j])) a[k] = b[i++]; else a[k] = b[j++];
        A.c++; A.w++; A.hot[k] = 1; A.h1 = k; A.h2 = j < hi ? j : -1;
        yield;
      }
    }
  },
  *heap(A) {
    const a = A.a, n = A.n;
    for (let s = (n >> 1) - 1; s >= 0; s--) {
      let r = s;
      for (;;) {
        let c = 2 * r + 1;
        if (c >= n) break;
        if (c + 1 < n) { A.c++; if (a[c + 1] > a[c]) c++; }
        cm(A, r, c);
        if (a[r] < a[c]) { sw(A, r, c); r = c; yield; } else { yield; break; }
      }
    }
    for (let e = n - 1; e > 0; e--) {
      sw(A, 0, e); yield;
      let r = 0;
      for (;;) {
        let c = 2 * r + 1;
        if (c >= e) break;
        if (c + 1 < e) { A.c++; if (a[c + 1] > a[c]) c++; }
        cm(A, r, c);
        if (a[r] < a[c]) { sw(A, r, c); r = c; yield; } else { yield; break; }
      }
    }
  },
  *radix(A) {
    const a = A.a, b = A.aux, n = A.n, B = 4, cnt = new Int32Array(B), pos = new Int32Array(B);
    let mx = 0;
    for (let i = 0; i < n; i++) if (a[i] > mx) mx = a[i];
    for (let e = 1; e <= mx; e *= B) {
      cnt.fill(0);
      for (let i = 0; i < n; i++) { cnt[Math.floor(a[i] / e) % B]++; b[i] = a[i]; A.c++; A.h1 = i; A.h2 = -1; if (i & 1) yield; }
      pos[0] = 0;
      for (let d = 1; d < B; d++) pos[d] = pos[d - 1] + cnt[d - 1];
      for (let i = 0; i < n; i++) { const d = Math.floor(b[i] / e) % B, k = pos[d]++; a[k] = b[i]; A.w++; A.hot[k] = 1; A.h1 = k; A.h2 = -1; yield; }
    }
  },
  *bitonic(A) {
    const a = A.a, n = A.n;
    let N = 1;
    while (N < n) N <<= 1;
    for (let k = 2; k <= N; k <<= 1) for (let j = k >> 1; j > 0; j >>= 1) for (let i = 0; i < n; i++) {
      const l = j === k >> 1 ? i ^ (k - 1) : i ^ j;
      if (l > i && l < n) { cm(A, i, l); if (a[i] > a[l]) sw(A, i, l); yield; }
    }
  },
  *cycle(A) {
    const a = A.a, n = A.n;
    for (let cs = 0; cs < n - 1; cs++) {
      let item = a[cs], pos = cs;
      for (let i = cs + 1; i < n; i++) { cm(A, cs, i); if (a[i] < item) pos++; yield; }
      if (pos === cs) continue;
      while (item === a[pos]) pos++;
      { const t = a[pos]; a[pos] = item; item = t; A.w++; A.hot[pos] = 1; yield; }
      while (pos !== cs) {
        pos = cs;
        for (let i = cs + 1; i < n; i++) { cm(A, cs, i); if (a[i] < item) pos++; yield; }
        while (item === a[pos]) pos++;
        const t = a[pos]; a[pos] = item; item = t; A.w++; A.hot[pos] = 1; yield;
      }
    }
  },
  *pancake(A) {
    const a = A.a;
    for (let size = A.n; size > 1; size--) {
      let m = 0;
      for (let i = 1; i < size; i++) { cm(A, m, i); if (a[i] > a[m]) m = i; yield; }
      if (m === size - 1) continue;
      if (m > 0) for (let l = 0, r = m; l < r; l++, r--) { sw(A, l, r); A.h1 = l; A.h2 = r; yield; }
      for (let l = 0, r = size - 1; l < r; l++, r--) { sw(A, l, r); A.h1 = l; A.h2 = r; yield; }
    }
  },
};
const SORT_NAME = { bubble: '氣泡排序', cocktail: '雞尾酒排序', gnome: '侏儒排序', oddeven: '奇偶排序', comb: '梳排序', insertion: '插入排序', selection: '選擇排序',
  shell: '希爾排序', quick: '快速排序', merge: '合併排序', heap: '堆積排序', radix: '基數排序', bitonic: '雙調排序', cycle: '圈排序', pancake: '煎餅排序' };
const SORT_NAME_EN = { bubble: 'Bubble Sort', cocktail: 'Cocktail Sort', gnome: 'Gnome Sort', oddeven: 'Odd-Even Sort', comb: 'Comb Sort', insertion: 'Insertion Sort', selection: 'Selection Sort',
  shell: 'Shell Sort', quick: 'Quicksort', merge: 'Merge Sort', heap: 'Heapsort', radix: 'Radix Sort', bitonic: 'Bitonic Sort', cycle: 'Cycle Sort', pancake: 'Pancake Sort' };
const sortName = (f, alg) => tr(f, SORT_NAME[alg], SORT_NAME_EN[alg]);
// 每種演算法的播放時間比例（n log n 的演算法步數少，播短一點）
const SORT_DUR = { bubble: 1, cocktail: 1, gnome: 1, oddeven: 1, insertion: 1, selection: 1, cycle: 1.1, pancake: 1, comb: 0.75, shell: 0.75, quick: 0.6, merge: 0.65, heap: 0.7, radix: 0.6, bitonic: 0.7 };
const ALL_SORTS = ['bubble', 'insertion', 'quick', 'selection', 'merge', 'cocktail', 'heap', 'shell', 'radix', 'gnome', 'comb', 'bitonic', 'oddeven', 'cycle', 'pancake'];
const FAST_SORTS = ['quick', 'merge', 'heap', 'shell', 'radix', 'comb', 'bitonic'];

function newArr(n) { return { n, a: new Int32Array(n), aux: new Int32Array(n), hot: new Float32Array(n), c: 0, w: 0, h1: -1, h2: -1, gen: null, si: 0, sw: null, ops: 0, fin: 0, steps: 0, lo: 0, hi: -1, pv: 0 }; }
// 大陣列（5K 螢幕的曲線排序可達數萬筆）不空跑，改用 n log n 估計步數，避免換回合時卡一下
const SORT_K = { quick: 1.05, merge: 1, heap: 0.97, comb: 2.45 };
function sortOps(alg, n) {
  const lg = Math.log2(n);
  if (alg === 'radix') return Math.round(1.5 * n * Math.ceil(Math.log(n) / Math.log(4)));
  if (alg === 'bitonic') { const k = Math.ceil(lg); return Math.round(((n / 2) * k * (k + 1)) / 2); }
  if (alg === 'shell') return Math.round(n * lg * (1.46 + 0.04 * (lg - 14)));
  if (SORT_K[alg]) return Math.round(n * lg * SORT_K[alg]);
  return Math.round(n * n * 0.5);
}
function mkSwaps(n, input) {
  const s = [];
  if (input === 'reverse') { for (let i = 0; i < n >> 1; i++) s.push(i, n - 1 - i); }
  else if (input === 'nearly') { for (let k = Math.ceil(n / 7); k > 0; k--) { const i = rint(0, n - 1); s.push(i, clamp(i + rint(-6, 6), 0, n - 1)); } }
  else for (let i = n - 1; i > 0; i--) s.push(i, rint(0, i));
  return s;
}
function sortInit(p, n, m) {
  const R = { n, As: [], algos: p.algo === 'all' ? p.algos || ALL_SORTS : [p.algo], k: rint(0, 40), phase: 'prep', acc: 0, ph: 0, T: 0 };
  for (let j = 0; j < m; j++) R.As.push(newArr(n));
  sortRound(R, p);
  return R;
}
function sortRound(R, p) {
  const n = R.n, m = R.As.length, few = p.input === 'few', q = Math.max(1, Math.round(n / 7));
  if (p.race) R.algs = shuffle(p.race.slice()).slice(0, m);
  else { const al = R.algos[R.k++ % R.algos.length]; R.algs = R.As.map(() => al); }
  R.alg = R.algs[0];
  let shared = null, maxOps = 0;
  for (let j = 0; j < m; j++) {
    const A = R.As[j], a = A.a;
    for (let i = 0; i < n; i++) a[i] = few ? Math.min(n - 1, Math.floor(i / q) * q + (q >> 1)) : i;
    A.sw = p.same && shared ? shared : (shared = mkSwaps(n, p.input));
    A.si = 0; A.c = A.w = 0; A.h1 = A.h2 = -1; A.gen = null; A.fin = 0; A.steps = 0; A.lo = 0; A.hi = -1; A.alg = R.algs[j];
    if ((j === 0 || p.race) && n > 3000) { A.ops = sortOps(A.alg, n); maxOps = Math.max(maxOps, A.ops); }
    else if (j === 0 || p.race) {
      const T = newArr(n);
      T.a.set(a);
      for (let k = 0; k < A.sw.length; k += 2) { const x = T.a[A.sw[k]]; T.a[A.sw[k]] = T.a[A.sw[k + 1]]; T.a[A.sw[k + 1]] = x; }
      const it = SORT[A.alg](T);
      let ops = 0;
      while (!it.next().done) ops++;
      A.ops = ops; maxOps = Math.max(maxOps, ops);
    }
  }
  R.ops = Math.max(1, maxOps); R.phase = 'prep'; R.acc = 0; R.ph = 0; R.T = 0;
  R.dur = p.race ? p.dur : p.dur * (SORT_DUR[R.alg] || 1);
}
function sortStep(R, p, dt) {
  R.T += dt;
  if (R.phase === 'prep') {
    const A0 = R.As[0], tot = A0.sw.length >> 1;
    R.acc += dt * Math.max(2, tot / 1.2);
    let k = Math.floor(R.acc);
    R.acc -= k;
    let left = 0;
    for (const A of R.As) {
      const a = A.a, s = A.sw;
      for (let kk = k; kk > 0 && A.si < s.length; kk--) { const i = s[A.si++], j = s[A.si++], t = a[i]; a[i] = a[j]; a[j] = t; A.hot[i] = A.hot[j] = 0.6; A.h1 = i; A.h2 = j; }
      if (A.si < s.length) left++;
    }
    if (!left) { R.phase = 'sort'; R.acc = 0; R.T = 0; for (const A of R.As) { A.gen = SORT[A.alg](A); A.h1 = A.h2 = -1; } R.rate = R.ops / R.dur; }
  } else if (R.phase === 'sort') {
    // 步數是估計值時可能跑超過預定時間：超時後逐漸加速
    R.acc += dt * R.rate * (R.T > R.dur ? 1 + (R.T - R.dur) * 0.5 : 1);
    let k = Math.floor(R.acc);
    R.acc -= k;
    if (k > R.ops / 4) k = Math.ceil(R.ops / 4);
    let alive = 0;
    for (const A of R.As) {
      if (!A.gen) continue;
      for (let q = 0; q < k; q++) { if (A.gen.next().done) { A.gen = null; A.h1 = A.h2 = -1; A.fin = Math.max(0.05, R.T); break; } A.steps++; }
      if (A.gen) alive++;
    }
    if (!alive) { R.phase = 'check'; R.ph = 0; }
  } else if (R.phase === 'check') {
    R.ph += dt / 1.1;
    if (R.ph >= 1) { R.phase = 'hold'; R.ph = 0; }
  } else {
    R.ph += dt;
    if (R.ph > 1.6) sortRound(R, p);
  }
}
// 排序結束時的檢查掃描：回傳 0..1 的額外亮度
function sweepBoost(R, i, n) {
  if (R.phase === 'check') { const d = R.ph * n - i; return d >= 0 ? (d < n * 0.08 ? 0.5 : 0.18) : 0; }
  if (R.phase === 'hold') return 0.18 * Math.max(0, 1 - R.ph / 1.6);
  return 0;
}
function sortLabel(g, f, R, A, x, y, col) {
  const nm = sortName(f, A.alg), done = R.phase === 'sort' && A.gen ? '' : tr(f, '  完成', '  done');
  const str = R.phase === 'prep' ? nm + tr(f, '  洗牌中…', '  shuffling…') : nm + tr(f, '  比較 ', '  comparisons ') + fmt(A.c) + tr(f, '  寫入 ', '  writes ') + fmt(A.w) + done;
  tag(g, x, y, str, col);
}
function decayHot(A, dt) { const h = A.hot, k = Math.exp(-dt * 5); for (let i = 0; i < h.length; i++) if (h[i] > 0.01) h[i] *= k; else h[i] = 0; }

/* ════════ 1. 排序長條 ════════ */
// 畫一組長條：區域 (X0, Y0, Wd, Ht)，每條寬 bw
function drawBars(g, f, s, R, A, X0, Y0, Wd, Ht, st, bw) {
  const a = A.a, n = A.n, hot = A.hot, ch = g.ch, co = g.co, cols = g.cols, C = f.C, hue = st === 'hue';
  const hi = C(1), bot = Y0 + Ht - 1;
  for (let i = 0; i < n; i++) {
    const v = a[i], u = (v + 1) / n, x = X0 + i * bw;
    const cur = i === A.h1 || i === A.h2;
    const b = sweepBoost(R, i, n) + hot[i] * 0.35;
    const col = cur ? hi : hue ? f.H(u * 300, 0.4 + b * 0.8) : C(0.3 + u * 0.45 + b);
    if (st === 'mirror') {
      const mid = Y0 + (Ht >> 1), k = Math.max(1, Math.round(u * (Ht >> 1) * 2)), full = k >> 1;
      for (let r = 0; r < full; r++) for (let q = 0; q < bw; q++) { const xx = x + q; if (xx >= cols) continue; ch[(mid - 1 - r) * cols + xx] = '█'; co[(mid - 1 - r) * cols + xx] = col; ch[(mid + r) * cols + xx] = '█'; co[(mid + r) * cols + xx] = col; }
      if (k & 1) for (let q = 0; q < bw; q++) { const xx = x + q; if (xx >= cols) continue; g.set(xx, mid - 1 - full, '▄', col); g.set(xx, mid + full, '▀', col); }
      continue;
    }
    const e8 = Math.max(1, Math.round(u * Ht * 8)), full = e8 >> 3, rem = e8 & 7;
    if (st === 'lolli') {
      const body = cur ? hi : C(0.18 + b * 0.5), top = bot - full;
      for (let y = bot; y > top; y--) { ch[y * cols + x] = '│'; co[y * cols + x] = body; }
      if (top >= Y0) { ch[top * cols + x] = cur ? '◆' : '●'; co[top * cols + x] = col; }
      continue;
    }
    for (let r = 0; r < full; r++) {
      const y = bot - r, idx = y * cols + x;
      let c = '█', cc = col;
      if (st === 'shade') { const z = r / Math.max(1, full); c = z < 0.25 ? '░' : z < 0.5 ? '▒' : z < 0.8 ? '▓' : '█'; cc = cur ? hi : C(0.2 + z * 0.55 + b); }
      for (let q = 0; q < bw - (st === 'wide' ? 1 : 0); q++) { ch[idx + q] = c; co[idx + q] = cc; }
    }
    if (rem && bot - full >= Y0) for (let q = 0; q < bw - (st === 'wide' ? 1 : 0); q++) { const idx = (bot - full) * cols + x + q; ch[idx] = EIGHTH[rem]; co[idx] = col; }
  }
}
A({ id: 'al-sortbar', name: '排序長條', cat: CAT, theme: 'matrix', desc: '十五種排序演算法輪流整理長條',
  params: { algo: 'all', style: 'block', bw: 1, input: 'shuffle', dur: 20 },
  variants: [
    { id: 'bubble', name: '氣泡', theme: 'amber', desc: '大的數字像氣泡般一路浮到右邊', params: { algo: 'bubble', bw: 2, dur: 24 } },
    { id: 'insertion', name: '插入', theme: 'ice', desc: '棒棒糖般的長條逐一插回定位', params: { algo: 'insertion', style: 'lolli', bw: 2 } },
    { id: 'selection', name: '選擇', theme: 'gold', desc: '每輪挑出最小的放到前面', params: { algo: 'selection', style: 'wide', bw: 3 } },
    { id: 'cocktail', name: '雞尾酒', theme: 'sunset', desc: '上下對稱的長條來回搖晃排序', params: { algo: 'cocktail', style: 'mirror', bw: 1 } },
    { id: 'quick', name: '快速', theme: 'fire', desc: '有立體漸層的長條快速分割', params: { algo: 'quick', style: 'shade', bw: 2 } },
    { id: 'merge', name: '合併', theme: 'neon', hue: true, desc: '彩虹長條兩兩合併成序', params: { algo: 'merge', style: 'hue', bw: 1 } },
    { id: 'heap', name: '堆積', theme: 'lavender', desc: '倒序輸入建堆再逐一取出', params: { algo: 'heap', style: 'mirror', bw: 2, input: 'reverse' } },
    { id: 'race', name: '賽跑', theme: 'cyber', desc: '四種演算法同一份資料比快', params: { race: ['bubble', 'insertion', 'selection', 'quick', 'merge', 'heap', 'shell', 'comb', 'cocktail', 'radix'], same: true, style: 'block', dur: 26 } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows } = f;
    if (p.race) {
      const two = rows >= 20;
      s.panels = [];
      const pw = Math.floor(cols / 2), ph = two ? Math.floor(rows / 2) : rows;
      const np = two ? 4 : 2;
      for (let k = 0; k < np; k++) s.panels.push({ x: (k & 1) * pw + 1, y: (k >> 1) * ph + 1, w: pw - 2, h: ph - 2 });
      s.n = Math.max(8, s.panels[0].w);
      s.R = sortInit(p, s.n, np);
    } else {
      s.bw = p.bw;
      s.n = Math.max(8, Math.floor(cols / p.bw));
      s.x0 = Math.floor((cols - s.n * p.bw) / 2);
      s.R = sortInit(p, s.n, 1);
    }
  },
  frame(s, f) {
    const p = f.p, g = f.g, R = s.R;
    themed(s, f, this);
    sortStep(R, p, f.dt);
    for (const A of R.As) decayHot(A, f.dt);
    if (p.race) {
      const order = R.As.map((A, k) => [A.fin || 1e9, k]).sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < s.panels.length; k++) {
        const P = s.panels[k], A = R.As[k];
        drawBars(g, f, s, R, A, P.x, P.y + 1, P.w, P.h - 1, 'block', 1);
        const rank = A.fin ? order.findIndex(o => o[1] === k) + 1 : 0;
        // 每一格各自顯示：洗牌中／完成百分比／用時與名次
        const st = R.phase === 'prep' ? tr(f, '  洗牌中…', '  shuffling…')
          : rank ? tr(f, '  用時 ' + A.fin.toFixed(1) + ' 秒  第 ' + rank + ' 名', '  done in ' + A.fin.toFixed(1) + 's  #' + rank)
          : tr(f, '  進度 ', '  progress ') + Math.min(99, Math.floor((A.steps / Math.max(1, A.ops)) * 100)) + '%';
        tag(g, P.x + 1, P.y, sortName(f, A.alg) + st, rank === 1 ? f.C(1) : f.C(0.6));
      }
      return;
    }
    drawBars(g, f, s, R, R.As[0], s.x0, 1, s.n * s.bw, f.rows - 1, p.style, s.bw);
    sortLabel(g, f, R, R.As[0], 2, 0, f.C(0.65));
  } });

/* ════════ 2. 排序散點 ════════ */
A({ id: 'al-sortdot', name: '排序散點', cat: CAT, theme: 'ice', desc: '散落的點慢慢排成一條對角線',
  params: { algo: 'all', algos: FAST_SORTS, style: 'dot', dens: 1, input: 'shuffle', dur: 18 },
  variants: [
    { id: 'heap', name: '折線', theme: 'fire', desc: '鋸齒折線被堆積排序拉直', params: { algo: 'heap', style: 'link' } },
    { id: 'radix', name: '殘差', theme: 'toxic', desc: '直線殘差逐位數縮短消失', params: { algo: 'radix', style: 'resid' } },
    { id: 'bitonic', name: '雙調', theme: 'neon', desc: '倒序的偏差長條在排序網路中翻轉歸零', params: { algo: 'bitonic', input: 'reverse', style: 'stem' } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows } = f;
    s.D = new Dots(cols, rows);
    s.star = p.style === 'star';
    s.n = s.star ? Math.max(8, cols) : p.style === 'link' ? Math.max(8, cols) : Math.max(8, cols * p.dens);
    s.R = sortInit(p, s.n, 1);
  },
  frame(s, f) {
    const p = f.p, g = f.g, R = s.R, A = R.As[0], a = A.a, n = s.n, D = s.D, C = f.C;
    if (themed(s, f, this)) s.tab = Array.from({ length: 40 }, (_, k) => C(0.32 + k / 39 * 0.68));
    sortStep(R, p, f.dt);
    decayHot(A, f.dt);
    const W = D.W, H = D.H, top = 4, h4 = H - top - 2, st = p.style, tab = s.tab;
    const X = i => ((i + 0.5) * W) / n, Y = v => top + h4 - (v / (n - 1)) * h4;
    // 快速排序：目前正在分割的區段鋪上淡淡的點狀底紋
    const part = st === 'part' && R.phase === 'sort' && A.gen && A.hi > A.lo;
    if (part) {
      const x0 = Math.max(0, Math.floor(X(A.lo) / 2)), x1 = Math.min(f.cols - 1, Math.floor(X(A.hi) / 2)), bc = C(0.16), ch = g.ch, co = g.co;
      for (let y = 1; y < f.rows; y++) for (let x = x0 + ((x0 + y) & 1); x <= x1; x += 2) { const k = y * f.cols + x; ch[k] = '·'; co[k] = bc; }
    }
    // 比較中的位置：淡淡的直線游標
    for (const c of [A.h1, A.h2]) if (c >= 0) { const x = Math.floor(X(c) / 2); for (let y = 1; y < f.rows; y++) g.set(x, y, '│', C(0.13)); }
    if (s.star) {
      // 淡淡的對角線：排好之後每顆星都會落在這條線上
      for (let x = 0; x < f.cols; x += 2) g.set(x, Math.round(Y((x / f.cols) * (n - 1)) / 4), '·', C(0.16));
      for (let i = 0; i < n; i++) {
        const v = a[i], x = Math.floor((X(i)) / 2), y = Math.round(Y(v) / 4), b = A.hot[i] + sweepBoost(R, i, n);
        const cur = i === A.h1 || i === A.h2;
        g.set(x, y, cur ? '✦' : b > 0.3 ? '*' : '+', cur ? C(1) : tab[Math.min(39, ((v / n) * 26 + b * 14) | 0)]);
      }
    } else {
      D.clear();
      const mid = top + h4 / 2, dy = (v, i) => mid - ((v - i) / n) * h4 * 0.95;
      if (st === 'diff' || st === 'stem') D.line(0, mid, W - 1, mid, C(0.25));
      // 樞紐值：分割區段裡的一條水平線，小於它的點會被換到左邊
      if (part) D.line(X(A.lo), Y(A.pv), X(A.hi), Y(A.pv), C(0.55));
      let px = 0, py = 0;
      // 每個點都畫成 2×2 子像素，大螢幕上才看得清楚
      const dot4 = (x, y, col) => { D.dot(x, y, col); D.dot(x, y + 1, col); D.dot(x + 1, y, col); D.dot(x + 1, y + 1, col); };
      for (let i = 0; i < n; i++) {
        const v = a[i], x = X(i), b = A.hot[i] + sweepBoost(R, i, n), col = tab[Math.min(39, ((v / n) * 26 + b * 14) | 0)];
        if (st === 'diff') dot4(x, dy(v, i), col);
        // 偏差長條：從中線畫到「目前值 − 正確位置」，排好時全部縮回中線
        else if (st === 'stem') { const y = dy(v, i); D.line(x, mid, x, y, col); D.dot(x + 1, y, col); }
        else if (st === 'resid') { const y0 = Y(i), y1 = Y(v); D.line(x, y0, x, y1, tab[Math.min(39, (Math.abs(v - i) / n * 60 + 8) | 0)]); D.dot(x, y1, C(1)); }
        else if (st === 'link') { const y = Y(v); if (i) D.line(px, py, x, y, col); px = x; py = y; }
        else dot4(x, Y(v), part && (i < A.lo || i > A.hi) ? tab[Math.min(39, ((v / n) * 16) | 0)] : col);
      }
      D.flush(g);
      for (const c of [A.h1, A.h2]) if (c >= 0) { const v = a[c], y = st === 'diff' || st === 'stem' ? dy(v, c) : Y(v); g.set(X(c) / 2, y / 4, '◆', C(1)); }
    }
    sortLabel(g, f, R, A, 2, 0, C(0.65));
  } });

/* ════════ 3. 色彩排序（色輪、光芒、螺旋、希氏曲線…） ════════ */
// 廣義希爾伯特曲線（可填滿任意長方形）
function gilbert(W, H) {
  const out = [];
  const sg = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
  function gen(x, y, ax, ay, bx, by) {
    const w = Math.abs(ax + ay), h = Math.abs(bx + by), dax = sg(ax), day = sg(ay), dbx = sg(bx), dby = sg(by);
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
  }
  if (W >= H) gen(0, 0, W, 0, 0, H); else gen(0, 0, 0, W, H, 0);
  return out;
}
A({ id: 'al-sortwheel', name: '色彩排序', cat: CAT, theme: 'rainbow', hue: true, desc: '打亂的色輪被排序回漸層',
  params: { algo: 'all', algos: ['quick', 'merge', 'heap', 'shell', 'radix', 'insertion', 'selection', 'cocktail', 'comb', 'bitonic'], style: 'disc', n: 240, dur: 18, input: 'shuffle' },
  variants: [
    { id: 'rays', name: '光芒', desc: '長短不一的光芒排成鸚鵡螺', params: { style: 'rays', algo: 'insertion', n: 180 } },
    { id: 'disp', name: '偏差圓', theme: 'neon', desc: '偏離越多的點越靠近圓心', params: { style: 'disp', algo: 'quick', n: 420 } },
    { id: 'spiral', name: '螺旋', theme: 'synth', desc: '螺旋色帶慢慢變成平順漸層', params: { style: 'spiral', algo: 'heap', n: 600 } },
    { id: 'curve', name: '希氏曲線', theme: 'cyber', desc: '沿著空間填充曲線鋪滿整個畫面', params: { style: 'curve', algo: 'all', algos: ['quick', 'merge', 'heap', 'radix', 'shell'] } },
    { id: 'ripple', name: '漣漪', theme: 'ocean', desc: '同心圓環由內而外排好顏色', params: { style: 'ripple', algo: 'cocktail', n: 120 } },
    { id: 'full', name: '全景', theme: 'sunset', desc: '整個畫面就是一個大色輪', params: { style: 'full', algo: 'merge', n: 360 } },
    { id: 'petal', name: '花瓣', theme: 'sakura', desc: '玫瑰線花瓣裡的色彩歸位', params: { style: 'petal', algo: 'gnome', n: 200, dur: 22 } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows, aspect } = f, st = p.style, N = cols * rows;
    s.idx = new Int32Array(N).fill(-1);
    s.rr = new Float32Array(N);
    s.chr = new Array(N).fill('█');
    const cx = cols / 2, cy = rows / 2, R = rows / 2 - 0.6;
    let n = p.n;
    if (st === 'curve') {
      const cw = cols * rows > 9000 ? 2 : 2, chh = 1, W = Math.floor(cols / cw), H = Math.floor(rows / chh);
      const path = gilbert(W, H);
      n = path.length >> 1;
      s.cw = cw;
      for (let k = 0; k < n; k++) { const x = path[2 * k], y = path[2 * k + 1]; for (let q = 0; q < cw; q++) { const i = y * cols + x * cw + q; s.idx[i] = k; s.rr[i] = 1; } }
    } else if (st === 'disp') {
      s.D = new Dots(cols, rows);
    } else {
      const turns = 3.2, RX = st === 'full' ? Infinity : R;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const dx = (x + 0.5 - cx) / aspect, dy = y + 0.5 - cy, r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) + Math.PI / 2;
        const u = fract(ang / TAU), rho = r / R, i = y * cols + x;
        if (st === 'full') { s.idx[i] = Math.min(n - 1, Math.floor(u * n)); s.rr[i] = Math.min(1, rho); continue; }
        if (r > RX) continue;
        if (st === 'disc' || st === 'rays') { if (rho < 0.08) continue; s.idx[i] = Math.min(n - 1, Math.floor(u * n)); s.rr[i] = rho; }
        else if (st === 'ripple') { if (rho > 1) continue; s.idx[i] = Math.min(n - 1, Math.floor(rho * n)); s.rr[i] = u; }
        else if (st === 'petal') {
          const lim = 0.15 + 0.85 * Math.abs(Math.cos(2.5 * (ang - Math.PI / 2)));
          if (rho > lim) continue;
          s.idx[i] = Math.min(n - 1, Math.floor(u * n)); s.rr[i] = rho / lim;
          s.chr[i] = rho / lim > 0.92 ? '▓' : '█';
        } else if (st === 'spiral') {
          if (rho > 1 || rho < 0.05) continue;
          const k = Math.round(rho * turns - u), uu = (k + u) / turns, d = Math.abs(rho * turns - u - k);
          if (uu < 0 || uu >= 1) continue;
          s.idx[i] = Math.min(n - 1, Math.floor(uu * n)); s.rr[i] = rho;
          s.chr[i] = d < 0.22 ? '█' : d < 0.34 ? '▓' : d < 0.42 ? '▒' : '░';
        }
      }
    }
    s.n = n; s.cx = cx; s.cy = cy; s.R = R;
    s.S = sortInit(p, n, 1);
  },
  frame(s, f) {
    const p = f.p, g = f.g, S = s.S, A = S.As[0], a = A.a, n = s.n, st = p.style, ch = g.ch, co = g.co;
    if (themed(s, f, this)) s.tabs = null;
    sortStep(S, p, f.dt);
    decayHot(A, f.dt);
    // 顏色表：值 × 亮度層
    if (!s.tabs) {
      s.tabs = [];
      for (let L = 0; L < 8; L++) s.tabs.push(Array.from({ length: 64 }, (_, k) => hg(s, f, k / 64, 0.25 + L * 0.085, 0.12 + (k / 63) * 0.55 + L * 0.045)));
    }
    const tabs = s.tabs, hot = A.hot;
    if (st === 'disp') {
      const D = s.D;
      D.clear();
      const R2 = s.R * 0.97;
      for (let i = 0; i < n; i++) {
        const v = a[i];
        let d = Math.abs(v - i); d = Math.min(d, n - d);
        const rho = 1 - (d / (n / 2)) * 0.92, ang = (i / n) * TAU - Math.PI / 2;
        const x = s.cx * 2 + Math.cos(ang) * R2 * rho * f.aspect * 2, y = s.cy * 4 + Math.sin(ang) * R2 * rho * 4;
        const col = tabs[Math.min(7, 4 + ((hot[i] * 4) | 0))][((v / n) * 64) | 0];
        D.dot(x, y, col); D.dot(x + 1, y, col); D.dot(x, y + 1, col); D.dot(x + 1, y + 1, col);
      }
      D.flush(g);
    } else {
      const idx = s.idx, rr = s.rr, chr = s.chr, N = idx.length, rays = st === 'rays';
      const boost = S.phase === 'check' || S.phase === 'hold' ? 1 : 0;
      for (let i = 0; i < N; i++) {
        const e = idx[i];
        if (e < 0) continue;
        const v = a[e], u = (v + 0.5) / n;
        let L = st === 'curve' ? 5 : st === 'full' ? 2 + ((1 - rr[i]) * 3.5) | 0 : st === 'ripple' ? 4 : 1 + ((rr[i] * 5) | 0);
        if (rays) { const lim = 0.12 + 0.88 * u; if (rr[i] > lim) continue; L = rr[i] > lim - 0.06 ? 7 : 2 + ((rr[i] / lim) * 4) | 0; }
        if (hot[e] > 0.2) L = Math.min(7, L + 2);
        if (e === A.h1 || e === A.h2) L = 7;
        ch[i] = chr[i]; co[i] = tabs[Math.min(7, L + boost)][(u * 64) | 0];
      }
    }
    sortLabel(g, f, S, A, 2, 0, f.C(0.7));
  } });

/* ════════ 4. 排序織錦（每一列各自排序） ════════ */
A({ id: 'al-sortrows', name: '排序織錦', cat: CAT, theme: 'rainbow', hue: true, desc: '每一列各自排序，織出演算法的紋路',
  params: { algo: 'all', algos: ['bubble', 'insertion', 'selection', 'shell', 'quick', 'merge', 'heap', 'radix', 'bitonic', 'cocktail', 'comb', 'oddeven', 'pancake'], orient: 'rows', cw: 1, input: 'shuffle', dur: 18 },
  variants: [
    { id: 'insertion', name: '插入', theme: 'sunset', desc: '每列從左邊開始長出漸層', params: { algo: 'insertion', cw: 2 } },
    { id: 'quick', name: '快速直排', theme: 'fire', desc: '直行快速排序，色塊往下沉', params: { algo: 'quick', orient: 'cols', cw: 1 } },
    { id: 'bitonic', name: '雙調', theme: 'neon', desc: '排序網路交錯出格狀圖騰', params: { algo: 'bitonic', input: 'nearly' } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows } = f;
    s.cw = p.cw;
    if (p.orient === 'cols') { s.m = Math.max(2, Math.floor(cols / p.cw)); s.n = Math.max(8, rows); }
    else { s.m = Math.max(2, rows); s.n = Math.max(8, Math.floor(cols / p.cw)); }
    s.R = sortInit(p, s.n, s.m);
  },
  frame(s, f) {
    const p = f.p, g = f.g, R = s.R, n = s.n, m = s.m, cw = s.cw, cols = g.cols, rows = g.rows, ch = g.ch, co = g.co;
    if (themed(s, f, this) || !s.tab) {
      s.tab = Array.from({ length: n }, (_, v) => hg(s, f, v / n, 0.5, 0.12 + (v / (n - 1)) * 0.88));
      s.tabB = Array.from({ length: n }, (_, v) => hg(s, f, v / n, 0.75, 0.3 + (v / (n - 1)) * 0.7));
    }
    sortStep(R, p, f.dt);
    const tab = s.tab, tabB = s.tabB, cols_ = p.orient === 'cols';
    const sweepI = R.phase === 'check' ? R.ph * n : -1;
    for (let j = 0; j < m; j++) {
      const A = R.As[j], a = A.a, h1 = A.h1, h2 = A.h2;
      for (let i = 0; i < n; i++) {
        const v = a[i], col = Math.abs(i - sweepI) < n * 0.04 || i === h1 || i === h2 ? tabB[v] : tab[v];
        if (cols_) { if (i >= rows) break; for (let q = 0; q < cw; q++) { const x = j * cw + q; if (x < cols) { const k = i * cols + x; ch[k] = '█'; co[k] = col; } } }
        else { if (j >= rows) break; for (let q = 0; q < cw; q++) { const x = i * cw + q; if (x < cols) { const k = j * cols + x; ch[k] = '█'; co[k] = col; } } }
      }
    }
    const st = R.phase === 'prep' ? tr(f, '  洗牌中', '  shuffling') : R.phase === 'sort' ? '  ×' + m + tr(f, ' 列', cols_ ? ' columns' : ' rows') : tr(f, '  完成', '  done');
    tag(g, -3, rows - 1, sortName(f, R.alg) + st, f.C(0.95));
  } });

/* ════════ 5. 尋路演算法 ════════ */
const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const D8 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
class Heap {
  constructor(cap) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  push(key, val) {
    if (this.n >= this.k.length) { const k = new Float64Array(this.k.length * 2), v = new Int32Array(this.k.length * 2); k.set(this.k); v.set(this.v); this.k = k; this.v = v; }
    const k = this.k, v = this.v;
    let i = this.n++;
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], n = --this.n;
    if (n > 0) {
      const key = k[n], val = v[n];
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= key) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = key; v[i] = val;
    }
    return top;
  }
}
const PF_NAME = { bfs: '廣度優先搜尋', dfs: '深度優先搜尋', astar: 'A* 搜尋', astar8: 'A* 八方向', dijkstra: '戴克斯特拉', greedy: '貪婪最佳優先', bidir: '雙向廣度搜尋', multi: '多源擴散' };
const PF_NAME_EN = { bfs: 'Breadth-First Search', dfs: 'Depth-First Search', astar: 'A* Search', astar8: 'A* 8-Way', dijkstra: 'Dijkstra', greedy: 'Greedy Best-First', bidir: 'Bidirectional BFS', multi: 'Multi-Source Flood' };
function pfGen(s, kind) {
  const { W, H } = s, wall = s.wall, cost = s.cost, z = rnd(0, 200);
  wall.fill(0); cost.fill(1);
  const at = (x, y) => y * W + x, setW = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) wall[at(x, y)] = 1; };
  if (kind === 'noise') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Noise.fbm(x * 0.075, y * 0.075, z, 3) > 0.04) wall[at(x, y)] = 1;
  } else if (kind === 'scatter') {
    for (let i = 0; i < W * H; i++) if (Math.random() < 0.3) wall[i] = 1;
  } else if (kind === 'terrain') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = Noise.fbm(x * 0.05, y * 0.05, z, 4) + 0.5;
      cost[at(x, y)] = 1 + Math.floor(clamp(e * e, 0, 0.999) * 9);
      if (Noise.n3(x * 0.11, y * 0.11, z + 9) > 0.42) wall[at(x, y)] = 1;
    }
  } else if (kind === 'cups') {
    for (let i = 0; i < W * H; i++) if (Math.random() < 0.04) wall[i] = 1;
    for (let k = Math.max(3, Math.floor((W * H) / 300)); k > 0; k--) {
      const cw = rint(3, 9), ch = rint(4, Math.max(5, Math.min(16, H >> 1))), x0 = rint(Math.floor(W * 0.15), W - cw - 3), y0 = rint(0, Math.max(0, H - ch - 1));
      for (let x = x0; x <= x0 + cw; x++) { setW(x, y0); setW(x, y0 + ch); }
      for (let y = y0; y <= y0 + ch; y++) setW(x0 + cw, y);
    }
  } else if (kind === 'rooms') {
    const rw = rint(9, 13), rh = rint(5, 8);
    for (let y = 0; y < H; y += rh) for (let x = 0; x < W; x++) setW(x, y);
    for (let x = 0; x < W; x += rw) for (let y = 0; y < H; y++) setW(x, y);
    for (let y = 0; y < H; y += rh) for (let x = 0; x < W; x += rw) {
      if (Math.random() < 0.9) { const d = x + rint(1, rw - 2); for (let q = 0; q < 2; q++) if (d + q < W) wall[at(d + q, y)] = 0; }
      if (Math.random() < 0.9 && y + 1 < H) { const d = y + rint(1, rh - 1); if (d < H) wall[at(x, d)] = 0; }
      if (Math.random() < 0.5) { const bx = x + rint(2, rw - 3), by = y + rint(2, rh - 2); setW(bx, by); setW(bx + 1, by); }
    }
  } else if (kind === 'maze') {
    wall.fill(1);
    const MW = Math.max(2, (W - 1) >> 1), MH = Math.max(2, (H - 1) >> 1), seen = new Uint8Array(MW * MH), st = [rint(0, MW * MH - 1)];
    seen[st[0]] = 1; wall[at(1 + 2 * (st[0] % MW), 1 + 2 * Math.floor(st[0] / MW))] = 0;
    while (st.length) {
      const c = st[st.length - 1], cx = c % MW, cy = (c / MW) | 0, nb = [];
      for (const [dx, dy] of D4) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < MW && ny < MH && !seen[ny * MW + nx]) nb.push(ny * MW + nx); }
      if (!nb.length) { st.pop(); continue; }
      const j = pick(nb), jx = j % MW, jy = (j / MW) | 0;
      seen[j] = 1; wall[at(1 + 2 * jx, 1 + 2 * jy)] = 0; wall[at(1 + cx + jx, 1 + cy + jy)] = 0; st.push(j);
    }
    for (let y = 1; y < 2 * MH; y++) for (let x = 1; x < 2 * MW; x++) if (((x ^ y) & 1) && wall[at(x, y)] && Math.random() < 0.07) wall[at(x, y)] = 0;
  }
}
function pfReach(s, a, b) {
  const { W, H } = s, wall = s.wall, seen = new Uint8Array(W * H), q = new Int32Array(W * H);
  let h = 0, t = 0;
  q[t++] = a; seen[a] = 1;
  while (h < t) {
    const c = q[h++];
    if (c === b) return true;
    const x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (!seen[j] && !wall[j]) { seen[j] = 1; q[t++] = j; } }
  }
  return false;
}
A({ id: 'al-path', name: '尋路演算法', cat: CAT, theme: 'mint', hue: true, desc: 'A* 在洞穴地圖裡找出最短路徑',
  params: { alg: 'astar', map: 'noise', secs: 26 },
  variants: [
    { id: 'bfs', name: '廣度優先', theme: 'ice', desc: '一圈圈擴散的波前掃過碎石地', params: { alg: 'bfs', map: 'scatter' } },
    { id: 'dfs', name: '深度優先', theme: 'amber', desc: '一路鑽到底的蛇形搜尋', params: { alg: 'dfs', map: 'noise', secs: 14 } },
    { id: 'dijkstra', name: '地形成本', theme: 'forest', desc: '戴克斯特拉繞過高成本的山地', params: { alg: 'dijkstra', map: 'terrain', secs: 12 } },
    { id: 'greedy', name: '貪婪陷阱', theme: 'fire', desc: '貪婪搜尋一頭撞進 U 形死路', params: { alg: 'greedy', map: 'cups', secs: 22 } },
    { id: 'bidir', name: '雙向', theme: 'sakura', desc: '起點終點同時出發，在中間相遇', params: { alg: 'bidir', map: 'scatter' } },
    { id: 'maze', name: '迷宮', theme: 'blueprint', desc: 'A* 穿過有迴路的迷宮', params: { alg: 'astar', map: 'maze', secs: 16 } },
    { id: 'diag', name: '八方向', theme: 'cyber', desc: '可斜走的 A* 穿越一間間房間', params: { alg: 'astar8', map: 'rooms', secs: 22 } },
    { id: 'multi', name: '多源', theme: 'rainbow', desc: '多個源頭同時擴散瓜分地圖', params: { alg: 'multi', map: 'noise', secs: 9 } },
  ],
  init(s, f) {
    s.W = Math.max(8, Math.floor(f.cols / 2)); s.H = Math.max(6, f.rows);
    // 迷宮地圖的長寬要是奇數，四周的牆才會一樣厚；多出來的邊留白並置中
    if (f.p.map === 'maze') { if (!(s.W & 1)) s.W--; if (!(s.H & 1)) s.H--; }
    s.ox = Math.max(0, Math.floor((f.cols - s.W * 2) / 2)); s.oy = Math.max(0, Math.floor((f.rows - s.H) / 2));
    const n = s.W * s.H;
    Object.assign(s, { wall: new Uint8Array(n), cost: new Uint8Array(n), st: new Uint8Array(n), gc: new Float32Array(n), prev: new Int32Array(n), tc: new Float32Array(n),
      side: new Uint8Array(n), onPath: new Int32Array(n), q: new Int32Array(n + 4), q2: new Int32Array(n + 4), stk: new Int32Array(n * 4 + 8), stp: new Int32Array(n * 4 + 8), hp: new Heap(n * 2) });
    this.newMap(s, f);
  },
  newMap(s, f) {
    const p = f.p, { W, H } = s;
    let ok = false;
    for (let tries = 0; tries < 12 && !ok; tries++) {
      pfGen(s, p.map);
      if (p.alg === 'multi') { ok = true; break; }
      const pickOpen = (x0, x1) => { for (let k = 0; k < 400; k++) { const x = rint(x0, x1), y = rint(0, H - 1), i = y * W + x; if (!s.wall[i]) return i; } return -1; };
      if (p.map === 'maze') { s.start = (1 + 2 * rint(0, (H - 3) >> 1)) * W + 1; s.goal = (1 + 2 * rint(0, (H - 3) >> 1)) * W + 1 + 2 * (((W - 1) >> 1) - 1); }
      else { s.start = pickOpen(1, Math.max(1, Math.floor(W * 0.1))); s.goal = pickOpen(Math.floor(W * 0.9), W - 2); }
      ok = s.start >= 0 && s.goal >= 0 && pfReach(s, s.start, s.goal);
    }
    if (!ok) { s.wall.fill(0); s.start = Math.floor(H / 2) * W + 1; s.goal = Math.floor(H / 2) * W + W - 2; }
    s.alg = p.alg; s.T = 0; s.phase = 'show'; s.ph = 0; s.exp = 0; s.acc = 0; s.path = []; s.pathN = 0;
    s.st.fill(0); s.gc.fill(Infinity); s.prev.fill(-1); s.side.fill(0); s.onPath.fill(0); s.tc.fill(0);
    s.qh = s.qt = s.qh2 = s.qt2 = 0; s.sp = 0; s.hp.n = 0; s.turn = 1;
    const gx = s.goal % W, gy = (s.goal / W) | 0;
    s.h = p.alg === 'astar8'
      ? j => { const dx = Math.abs((j % W) - gx), dy = Math.abs(((j / W) | 0) - gy); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); }
      : j => Math.abs((j % W) - gx) + Math.abs(((j / W) | 0) - gy);
    if (p.alg === 'multi') {
      const k = rint(5, 8);
      for (let q = 0; q < k; q++) for (let t = 0; t < 300; t++) { const i = rint(0, W * H - 1); if (!s.wall[i] && !s.st[i]) { s.st[i] = 1; s.side[i] = q + 1; s.gc[i] = 0; s.q[s.qt++] = i; break; } }
      s.nSeeds = k;
    } else if (p.alg === 'bfs') { s.st[s.start] = 1; s.gc[s.start] = 0; s.q[s.qt++] = s.start; }
    else if (p.alg === 'bidir') { s.side[s.start] = 1; s.side[s.goal] = 2; s.gc[s.start] = s.gc[s.goal] = 0; s.q[s.qt++] = s.start; s.q2[s.qt2++] = s.goal; }
    else if (p.alg === 'dfs') { s.dord = shuffle(D4.slice()); s.stk[0] = s.start; s.stp[0] = -1; s.sp = 1; }
    else { s.gc[s.start] = 0; s.hp.push(0, s.start); }
  },
  step(s) {
    const { W, H, wall, st, gc, prev, cost } = s, T = s.T, alg = s.alg;
    const close = c => { st[c] = 2; s.tc[c] = T; s.exp++; };
    if (alg === 'bfs' || alg === 'multi') {
      if (s.qh >= s.qt) return 2;
      const c = s.q[s.qh++];
      close(c);
      if (alg === 'bfs' && c === s.goal) return 1;
      const x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (wall[j] || st[j]) continue;
        st[j] = 1; prev[j] = c; gc[j] = gc[c] + 1; s.side[j] = s.side[c]; s.q[s.qt++] = j;
      }
      return 0;
    }
    if (alg === 'bidir') {
      for (let tries = 0; tries < 2; tries++) {
        const side = (s.turn = 3 - s.turn), q = side === 1 ? s.q : s.q2;
        if (side === 1 ? s.qh >= s.qt : s.qh2 >= s.qt2) continue;
        const c = side === 1 ? q[s.qh++] : q[s.qh2++];
        close(c);
        const x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (wall[j]) continue;
          if (s.side[j] && s.side[j] !== side) { s.meetA = side === 1 ? c : j; s.meetB = side === 1 ? j : c; return 1; }
          if (s.side[j]) continue;
          s.side[j] = side; st[j] = 1; prev[j] = c; gc[j] = gc[c] + 1;
          if (side === 1) q[s.qt++] = j; else q[s.qt2++] = j;
        }
        return 0;
      }
      return 2;
    }
    if (alg === 'dfs') {
      while (s.sp > 0) {
        const c = s.stk[--s.sp], par = s.stp[s.sp];
        if (st[c] === 2) continue;
        close(c); prev[c] = par; gc[c] = par >= 0 ? gc[par] + 1 : 0;
        if (c === s.goal) return 1;
        const x = c % W, y = (c / W) | 0;
        for (let k = 3; k >= 0; k--) {
          const nx = x + s.dord[k][0], ny = y + s.dord[k][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (wall[j] || st[j] === 2) continue;
          st[j] = 1; s.stk[s.sp] = j; s.stp[s.sp++] = c;
        }
        return 0;
      }
      return 2;
    }
    const hp = s.hp, dirs = alg === 'astar8' ? D8 : D4, hw = alg === 'dijkstra' ? 0 : 1.001;
    while (hp.n > 0) {
      const c = hp.pop();
      if (st[c] === 2) continue;
      close(c);
      if (c === s.goal) return 1;
      const x = c % W, y = (c / W) | 0;
      for (let k = 0; k < dirs.length; k++) {
        const dx = dirs[k][0], dy = dirs[k][1], nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (wall[j] || st[j] === 2) continue;
        if (dx && dy && (wall[y * W + nx] || wall[ny * W + x])) continue;
        const stp = (dx && dy ? Math.SQRT2 : 1) * cost[j];
        if (alg === 'greedy') { if (st[j]) continue; st[j] = 1; prev[j] = c; gc[j] = gc[c] + stp; hp.push(s.h(j), j); continue; }
        const ng = gc[c] + stp;
        if (ng < gc[j]) { gc[j] = ng; prev[j] = c; st[j] = 1; hp.push(ng + hw * s.h(j), j); }
      }
      return 0;
    }
    return 2;
  },
  frame(s, f) {
    const p = f.p, g = f.g, { W, H } = s, ch = g.ch, co = g.co, cols = g.cols, dt = f.dt;
    themed(s, f, this);
    s.T += dt; s.ph += dt;
    if (s.phase === 'show') { if (s.ph > 0.7) { s.phase = 'search'; s.ph = 0; } }
    else if (s.phase === 'search') {
      let k = due(s, dt, Math.max(30, (W * H) / p.secs), 4000);
      while (k-- > 0) {
        const r = this.step(s);
        if (r === 0) continue;
        if (r === 1) {
          const path = [];
          if (s.alg === 'bidir') {
            for (let c = s.meetA; c >= 0; c = s.prev[c]) path.push(c);
            path.reverse();
            for (let c = s.meetB; c >= 0; c = s.prev[c]) path.push(c);
          } else { for (let c = s.goal; c >= 0; c = s.prev[c]) path.push(c); path.reverse(); }
          s.path = path; s.pathN = 0; s.phase = 'trace';
        } else s.phase = 'hold';
        s.ph = 0; s.acc = 0;
        break;
      }
    } else if (s.phase === 'trace') {
      const before = Math.floor(s.pathN);
      s.pathN = Math.min(s.path.length, s.pathN + dt * Math.max(25, s.path.length / 1.4));
      for (let k = before; k < Math.floor(s.pathN); k++) s.onPath[s.path[k]] = k + 1;
      if (s.pathN >= s.path.length) { s.phase = 'hold'; s.ph = 0; }
    } else if (s.phase === 'hold' && s.ph > 3) this.newMap(s, f);
    // 繪製
    const { wall, st, gc, tc, cost, side, onPath, ox, oy } = s, T = s.T, multi = s.alg === 'multi', terr = p.map === 'terrain';
    const wallCol = f.C(terr ? 0.42 : 0.26), pathCol = s.hueOn ? f.H(48, 0.95) : f.C(1), openCol = s.hueOn ? f.H(160, 0.85) : f.C(0.85);
    const TER = [' ', ' ', ' ', '·', '·', ':', ':', '░', '░', '▒'], dScale = 1 / (2 * (W + H));
    const fade = s.phase === 'hold' && s.ph > 2.4 ? 1 - (s.ph - 2.4) / 0.6 : 1;
    for (let y = 0; y < H && y + oy < g.rows; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, k = (y + oy) * cols + ox + x * 2;
      let c = ' ', col = wallCol;
      if (wall[i]) c = '█';
      else if (onPath[i]) { c = '█'; col = pathCol; }
      else if (st[i] === 2) {
        const age = T - tc[i], gl = Math.exp(-age * 1.6);
        c = age < 0.25 ? '▓' : age < 1.1 ? '▒' : '░';
        if (multi) { const band = gc[i] % 7 < 1 ? 0.18 : 0; col = hv(s, f, side[i] * 51 + 10, (0.3 + band + gl * 0.35) * fade, (0.25 + (side[i] % 4) * 0.12 + band + gl * 0.2) * fade); c = gc[i] % 7 < 1 ? '▒' : c; }
        else if (s.alg === 'bidir') col = hg(s, f, side[i] === 1 ? 0.05 : 0.95, (0.32 + gl * 0.4) * fade, (0.3 + gl * 0.5 + (side[i] === 2 ? 0.15 : 0)) * fade);
        else col = hg(s, f, tri(gc[i] * dScale), (0.3 + gl * 0.42) * fade, (0.22 + gl * 0.55 + (terr && gc[i] % 12 < 1.2 ? 0.15 : 0)) * fade);
        if (terr && cost[i] > 5) c = '▓';
      } else if (st[i] === 1) { c = '▓'; col = openCol; }
      else if (terr) { c = TER[cost[i]]; col = f.C(0.12 + cost[i] * 0.05); }
      if (c === ' ') continue;
      ch[k] = c; co[k] = col;
      if (ox + x * 2 + 1 < cols) { ch[k + 1] = c === '·' || c === ':' ? ' ' : c; co[k + 1] = col; }
    }
    if (!multi) {
      const blink = Math.sin(T * 5) > -0.3;
      for (const [cell, hue, lab] of [[s.start, 120, 'S'], [s.goal, 0, 'G']]) {
        const x = ox + (cell % W) * 2, y = oy + ((cell / W) | 0);
        g.set(x, y, blink ? '█' : lab, s.hueOn ? f.H(hue, 0.85) : f.C(1)); g.set(x + 1, y, blink ? '█' : lab, s.hueOn ? f.H(hue, 0.85) : f.C(1));
      }
    }
    let info = tr(f, PF_NAME[s.alg] + '  展開 ', PF_NAME_EN[s.alg] + '  expanded ') + s.exp;
    if (s.path.length && !multi) info += tr(f, '  路徑 ' + (s.path.length - 1) + ' 步', '  path ' + (s.path.length - 1) + ' steps') + (terr ? tr(f, '  成本 ', '  cost ') + Math.round(s.gc[s.goal]) : '');
    tag(g, 2, 0, info, f.C(0.9));
  } });

/* ════════ 6. 迷宮演算法（經典迷宮沒有的生成法，細線牆） ════════ */
// 框線接點：位元 上1 下2 左4 右8
const BOXJ = [' ', '│', '│', '│', '─', '┘', '┐', '┤', '─', '└', '┌', '├', '─', '┴', '┬', '┼'];
const MZ_NAME = { wilson: '威爾森演算法', hybrid: '漫遊＋威爾森', aldous: '奧德斯－布羅德', shift: '原點漂移法', braid: '打通死路', binary: '二元樹演算法',
  eller: '埃勒演算法', hunt: '獵殺演算法', division: '遞迴分割', growing: '生長樹' };
const MZ_NAME_EN = { wilson: "Wilson's Algorithm", hybrid: 'Aldous-Broder + Wilson', aldous: 'Aldous-Broder', shift: 'Origin Shift', braid: 'Braid Maze', binary: 'Binary Tree',
  eller: "Eller's Algorithm", hunt: 'Hunt-and-Kill', division: 'Recursive Division', growing: 'Growing Tree' };
// 不播放、瞬間做出一座完美迷宮（隨機普林），給原點漂移與打通死路當起點
function mzInstant(M) {
  const { N, inM } = M, inF = new Uint8Array(N), fr = [], s0 = rint(0, N - 1);
  const add = c => { for (const j of M.nbs(c)) if (!inM[j] && !inF[j]) { inF[j] = 1; fr.push(j); } };
  inM[s0] = 1; add(s0);
  while (fr.length) {
    const k = rint(0, fr.length - 1), c = fr[k];
    fr[k] = fr[fr.length - 1]; fr.pop();
    M.carve(c, pick(M.nbs(c).filter(j => inM[j]))); inM[c] = 1; add(c);
  }
}
const MZ = {
  *hybrid(M) {
    const { N, inM, nxt } = M;
    let c = rint(0, N - 1);
    inM[c] = 1; M.inCount = 1; M.cur = c;
    // 前段：漫無目的地隨機漫遊，走到新格子就打通
    while (M.inCount < N / 3) {
      const j = pick(M.nbs(c));
      if (!inM[j]) { M.carve(c, j); inM[j] = 1; M.inCount++; }
      c = j; M.cur = c;
      yield;
    }
    // 後段：改用威爾森的迴圈抹除漫步，補完剩下的格子
    M.stage = 1;
    for (const u of shuffle(Array.from({ length: N }, (_, i) => i))) {
      if (inM[u]) continue;
      let w = u;
      M.walk = u;
      while (!inM[w]) { const j = pick(M.nbs(w)); nxt[w] = j; w = j; M.cur = w; yield; }
      w = u;
      while (!inM[w]) { M.carve(w, nxt[w]); inM[w] = 1; M.inCount++; w = nxt[w]; M.cur = w; yield; }
      M.walk = -1;
    }
  },
  *shift(M) {
    // 原點漂移：迷宮是一棵以「原點」為根的樹。原點每次走到隨機鄰格，
    // 舊原點改指向新原點（打通），新原點原本的出路補回牆。迷宮永遠完美，卻不停變形。
    const { W, N } = M, par = M.nxt, q = new Int32Array(N);
    mzInstant(M);
    let o = rint(0, N - 1), h = 0, t = 0;
    par.fill(-2); par[o] = -1; q[t++] = o;
    while (h < t) {
      const c = q[h++], x = c % W;
      for (const j of [c - 1, c + 1, c - W, c + W]) {
        if (j < 0 || j >= N || (j === c - 1 && x === 0) || (j === c + 1 && x === W - 1) || par[j] !== -2 || !M.isOpen(c, j)) continue;
        par[j] = c; q[t++] = j;
      }
    }
    M.origin = o; M.cur = o;
    yield;
    for (;;) {
      const j = pick(M.nbs(o)), old = par[j];
      par[o] = j; M.carve(o, j);
      if (old !== o) M.wall(j, old);
      par[j] = -1; o = j; M.origin = o; M.cur = o;
      yield;
    }
  },
  *braid(M) {
    // 先瞬間做好一座完美迷宮，標出所有死路，再一條條打通成有迴圈的迷宮
    const { N, mark } = M;
    mzInstant(M);
    const deg = c => { let n = 0; for (const j of M.nbs(c)) if (M.isOpen(c, j)) n++; return n; };
    const ends = shuffle(Array.from({ length: N }, (_, i) => i).filter(c => deg(c) === 1));
    for (const c of ends) mark[c] = 1;
    M.left = ends.length;
    for (let k = 0; k < 40; k++) yield;
    for (const c of ends) {
      if (!mark[c]) continue;
      mark[c] = 0; M.left--;
      if (deg(c) !== 1) continue;
      // 優先打向另一條死路，一次消掉兩條
      const closed = M.nbs(c).filter(j => !M.isOpen(c, j)), pref = closed.filter(j => mark[j]);
      const j = pick(pref.length ? pref : closed);
      M.carve(c, j);
      if (mark[j]) { mark[j] = 0; M.left--; }
      M.cur = c;
      yield;
    }
  },
  *wilson(M) {
    const { N, inM, mark } = M, nxt = M.nxt, order = shuffle(Array.from({ length: N }, (_, i) => i));
    inM[order[0]] = 1; M.inCount = 1;
    for (const u of order) {
      if (inM[u]) continue;
      let c = u;
      M.walk = u;
      while (!inM[c]) { const j = pick(M.nbs(c)); nxt[c] = j; c = j; M.cur = c; yield; }
      c = u;
      while (!inM[c]) { M.carve(c, nxt[c]); inM[c] = 1; M.inCount++; mark[c] = 0; c = nxt[c]; M.cur = c; yield; }
      M.walk = -1;
    }
  },
  *aldous(M) {
    const { N, inM } = M;
    let c = rint(0, N - 1);
    inM[c] = 1; M.inCount = 1; M.cur = c;
    while (M.inCount < N) {
      const j = pick(M.nbs(c));
      if (!inM[j]) { M.carve(c, j); inM[j] = 1; M.inCount++; }
      c = j; M.cur = c;
      yield;
    }
  },
  *binary(M) {
    const { W, H, inM } = M;
    for (let d = 0; d < W + H - 1; d++) {
      for (let y = 0; y < H; y++) {
        const x = d - y;
        if (x < 0 || x >= W) continue;
        const i = y * W + x, opts = [];
        if (y > 0) opts.push(i - W);
        if (x < W - 1) opts.push(i + 1);
        if (opts.length) M.carve(i, pick(opts));
        inM[i] = 1; M.cur = i;
      }
      yield; yield;
    }
  },
  *eller(M) {
    const { W, H, inM, setOf } = M;
    let next = 1;
    for (let y = 0; y < H; y++) {
      const last = y === H - 1, row = y * W;
      for (let x = 0; x < W; x++) { if (!setOf[row + x]) setOf[row + x] = next++; inM[row + x] = 1; }
      M.cur = row; yield;
      for (let x = 0; x < W - 1; x++) {
        const a = row + x, b = a + 1;
        if (setOf[a] !== setOf[b] && (last || Math.random() < 0.5)) {
          const old = setOf[b], nw = setOf[a];
          for (let k = 0; k < W; k++) if (setOf[row + k] === old) setOf[row + k] = nw;
          M.carve(a, b); M.cur = b; yield;
        }
      }
      if (last) break;
      const groups = new Map();
      for (let x = 0; x < W; x++) { const s = setOf[row + x]; if (!groups.has(s)) groups.set(s, []); groups.get(s).push(row + x); }
      for (const [s, cells] of groups) {
        shuffle(cells);
        const k = rint(1, cells.length);
        for (let q = 0; q < k; q++) { const c = cells[q]; M.carve(c, c + W); setOf[c + W] = s; inM[c + W] = 1; M.cur = c + W; yield; }
      }
    }
  },
  *hunt(M) {
    const { W, H, N, inM } = M;
    let c = rint(0, N - 1);
    inM[c] = 1;
    for (;;) {
      M.hunt = -1;
      const un = M.nbs(c).filter(j => !inM[j]);
      if (un.length) { const j = pick(un); M.carve(c, j); inM[j] = 1; c = j; M.cur = c; yield; continue; }
      let found = false;
      for (let y = 0; y < H && !found; y++) {
        M.hunt = y; yield;
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (inM[i]) continue;
          const vis = M.nbs(i).filter(j => inM[j]);
          if (vis.length) { M.carve(i, pick(vis)); inM[i] = 1; c = i; M.cur = c; found = true; break; }
        }
      }
      if (!found) { M.hunt = -1; return; }
    }
  },
  *division(M) {
    const { W, H, E, S, inM } = M;
    E.fill(0); S.fill(0); inM.fill(1);
    const st = [[0, 0, W, H]];
    while (st.length) {
      const [x, y, w, h] = st.pop();
      if (w < 2 || h < 2) continue;
      M.room = [x, y, w, h];
      const horiz = h > w ? true : w > h ? false : Math.random() < 0.5;
      if (horiz) {
        const wy = y + rint(0, h - 2), gap = x + rint(0, w - 1);
        for (let k = x; k < x + w; k++) { if (k !== gap) { S[wy * W + k] = 1; M.cur = wy * W + k; yield; } }
        st.push([x, wy + 1, w, y + h - wy - 1], [x, y, w, wy - y + 1]);
      } else {
        const wx = x + rint(0, w - 2), gap = y + rint(0, h - 1);
        for (let k = y; k < y + h; k++) { if (k !== gap) { E[k * W + wx] = 1; M.cur = k * W + wx; yield; } }
        st.push([wx + 1, y, x + w - wx - 1, h], [x, y, wx - x + 1, h]);
      }
    }
    M.room = null;
  },
  *growing(M) {
    const { N, inM, mark } = M, act = [rint(0, N - 1)];
    inM[act[0]] = 1; mark[act[0]] = 1;
    while (act.length) {
      const k = Math.random() < 0.6 ? act.length - 1 : rint(0, act.length - 1), c = act[k];
      const un = M.nbs(c).filter(j => !inM[j]);
      if (un.length) { const j = pick(un); M.carve(c, j); inM[j] = 1; mark[j] = 1; act.push(j); M.cur = j; yield; }
      else { mark[c] = 0; act.splice(k, 1); }
    }
  },
};
A({ id: 'al-mazegen', name: '迷宮演算法', cat: CAT, theme: 'blueprint', hue: true, desc: '迴圈抹除的隨機漫步慢慢鋪出迷宮',
  params: { alg: 'wilson', cw: 4, chh: 2, secs: 18, rate: 26 },
  variants: [
    { id: 'shift', name: '原點漂移', theme: 'rainbow', desc: '根節點四處遊走，迷宮跟著不斷改變', params: { alg: 'shift', cw: 5, chh: 2, rate: 26 } },
    { id: 'aldous', name: '隨機漫遊', theme: 'amber', desc: '漫無目的的游標走遍每一格', params: { alg: 'aldous', secs: 14 } },
    { id: 'braid', name: '打通死路', theme: 'mint', desc: '把死路一條條打通，變成有迴圈的迷宮', params: { alg: 'braid', cw: 6, chh: 3, secs: 16 } },
    { id: 'binary', name: '二元樹', theme: 'paper', hue: false, desc: '斜向掃過，每格只往上或往右', params: { alg: 'binary', cw: 4, chh: 2, secs: 9 } },
    { id: 'eller', name: '埃勒', theme: 'sunset', desc: '逐列合併集合的埃勒演算法', params: { alg: 'eller', secs: 18 } },
    { id: 'hunt', name: '獵殺', theme: 'blood', desc: '走到死路就掃描整列繼續獵捕', params: { alg: 'hunt', cw: 6, chh: 3, secs: 20 } },
    { id: 'division', name: '遞迴分割', theme: 'gold', desc: '空房間被一道道牆遞迴切開', params: { alg: 'division', secs: 16 } },
    { id: 'growing', name: '生長樹', theme: 'forest', desc: '新舊分支交錯生長的迷宮', params: { alg: 'growing', cw: 5, chh: 2, secs: 20 } },
  ],
  init(s, f) {
    const p = f.p, cw = p.cw, chh = p.chh;
    const W = Math.max(3, Math.floor((f.cols - 1) / cw)), H = Math.max(3, Math.floor((f.rows - 1) / chh)), N = W * H;
    s.cw = cw; s.chh = chh; s.ox = Math.floor((f.cols - (W * cw + 1)) / 2); s.oy = Math.floor((f.rows - (H * chh + 1)) / 2);
    const M = { W, H, N, E: new Uint8Array(N), S: new Uint8Array(N), inM: new Uint8Array(N), mark: new Uint8Array(N), setOf: new Int32Array(N), nxt: new Int32Array(N),
      dist: new Int32Array(N), cur: -1, walk: -1, hunt: -1, room: null, inCount: 0, origin: -1, stage: 0 };
    M.E.fill(1); M.S.fill(1);
    M.nbs = c => { const x = c % W, r = []; if (x > 0) r.push(c - 1); if (x < W - 1) r.push(c + 1); if (c >= W) r.push(c - W); if (c + W < N) r.push(c + W); return r; };
    // 打通／補牆／是否相通（a、b 必須相鄰；b === -W 表示往上）
    const wallSet = (a, b, v) => { if (b === -W) b = a - W; if (b === a + 1) M.E[a] = v; else if (a === b + 1) M.E[b] = v; else if (b === a + W) M.S[a] = v; else if (a === b + W) M.S[b] = v; };
    M.carve = (a, b) => wallSet(a, b, 0);
    M.wall = (a, b) => wallSet(a, b, 1);
    M.isOpen = (a, b) => (b === a + 1 ? !M.E[a] : a === b + 1 ? !M.E[b] : b === a + W ? !M.S[a] : a === b + W ? !M.S[b] : false);
    s.M = M; s.gen = MZ[p.alg](M); s.phase = 'gen'; s.ph = 0; s.T = 0; s.acc = 0; s.steps = 0;
    s.fq = new Int32Array(N);
  },
  // 由 st（省略時隨機挑角落或中央）出發，沿著通道算每格的距離
  flood(s, st) {
    const M = s.M, { W, N, E, S, dist } = M, q = s.fq;
    dist.fill(-1);
    if (st === undefined) st = pick([0, W - 1, N - W, N - 1, Math.floor(N / 2 + W / 2)]);
    let h = 0, t = 0, mx = 0;
    q[t++] = st; dist[st] = 0;
    while (h < t) {
      const c = q[h++], d = dist[c] + 1, x = c % W;
      if (dist[c] > mx) mx = dist[c];
      if (x < W - 1 && !E[c] && dist[c + 1] < 0) { dist[c + 1] = d; q[t++] = c + 1; }
      if (x > 0 && !E[c - 1] && dist[c - 1] < 0) { dist[c - 1] = d; q[t++] = c - 1; }
      if (c + W < N && !S[c] && dist[c + W] < 0) { dist[c + W] = d; q[t++] = c + W; }
      if (c >= W && !S[c - W] && dist[c - W] < 0) { dist[c - W] = d; q[t++] = c - W; }
    }
    s.maxD = Math.max(1, mx);
  },
  frame(s, f) {
    const p = f.p, g = f.g, M = s.M, { W, H, N, E, S, inM, mark } = M, dt = f.dt, alg = p.alg;
    themed(s, f, this);
    s.T += dt; s.ph += dt;
    if (s.phase === 'gen') {
      let rate = (alg === 'binary' ? 2 * (W + H) : N) / p.secs;
      if (alg === 'wilson' || (alg === 'hybrid' && M.stage)) rate *= clamp(N / (M.inCount * 3 + 1), 1, 40);
      if (alg === 'aldous') rate *= clamp(N / (N - M.inCount + 1) * 0.15, 1, 120);
      if (alg === 'hunt' || alg === 'division') rate *= 1.2;
      if (alg === 'braid') rate *= 0.35;
      if (alg === 'shift') rate = p.rate;
      let k = due(s, dt, rate, 6000);
      while (k-- > 0) { if (s.gen.next().done) { s.phase = 'flood'; s.ph = 0; M.cur = -1; M.walk = -1; M.hunt = -1; this.flood(s); break; } s.steps++; }
      // 原點漂移永遠不會結束；跑一陣子後換一座新迷宮
      if (alg === 'shift' && s.T > 75) { s.phase = 'hold'; s.ph = 2.2; this.flood(s, M.origin); M.cur = -1; }
    } else if (s.phase === 'flood') { if (s.ph > 4.5) { s.phase = 'hold'; s.ph = 0; } }
    else if (s.phase === 'hold' && s.ph > 3) { this.init(s, f); return this.frame(s, f); }
    // 每格外觀
    const look = s.look || (s.look = new Array(N)), lc = s.lc || (s.lc = new Array(N));
    const wallC = f.C(0.55), faintC = f.C(0.2), hiC = s.hueOn ? f.H(50, 0.95) : f.C(1), accC = s.hueOn ? f.H(200, 0.6) : f.C(0.55), dimC = f.C(0.22);
    look.fill(' ');
    if (s.phase !== 'gen') {
      const front = s.phase === 'flood' ? (s.ph / 4) * s.maxD : 1e9, fade = s.phase === 'hold' && s.ph > 2.3 ? Math.max(0, 1 - (s.ph - 2.3) / 0.7) : 1;
      for (let i = 0; i < N; i++) {
        const d = M.dist[i];
        if (d < 0 || d > front) continue;
        const u = d / s.maxD, near = front - d < 3;
        look[i] = near ? '▓' : '█';
        lc[i] = hg(s, f, u, (near ? 0.8 : 0.42) * fade, (0.2 + u * 0.6) * fade);
      }
    } else if (alg === 'shift') {
      // 依「離原點幾步」上色：原點一動，整座迷宮的顏色跟著流動
      if (M.origin >= 0) {
        this.flood(s, M.origin);
        for (let i = 0; i < N; i++) { const u = M.dist[i] / s.maxD; look[i] = u < 0.06 ? '▓' : u < 0.45 ? '▒' : '░'; lc[i] = hg(s, f, u, 0.62 - u * 0.4, 0.62 - u * 0.47); }
      }
    } else if (alg === 'eller') {
      const cy = Math.floor(M.cur / W);
      for (let y = Math.max(0, cy - 1); y <= Math.min(H - 1, cy + 1); y++) for (let x = 0; x < W; x++) { const i = y * W + x, st = M.setOf[i]; if (st && inM[i]) { look[i] = '▒'; lc[i] = hv(s, f, (st * 137.508) % 360, 0.5, 0.25 + ((st * 0.618) % 1) * 0.5); } }
    } else {
      for (let i = 0; i < N; i++) {
        if (mark[i]) { look[i] = '░'; lc[i] = accC; }
      }
      if ((alg === 'wilson' || alg === 'hybrid') && M.walk >= 0) { let c = M.walk; for (let k = 0; k < N && !inM[c]; k++) { look[c] = '▒'; lc[c] = hiC; c = M.nxt[c]; } }
      if (alg === 'hunt' && M.hunt >= 0) for (let x = 0; x < W; x++) { look[M.hunt * W + x] = '░'; lc[M.hunt * W + x] = accC; }
      if (alg === 'division' && M.room) { const [rx, ry, rw, rh] = M.room; for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) { look[y * W + x] = '░'; lc[y * W + x] = dimC; } }
    }
    if (M.cur >= 0 && s.phase === 'gen') { look[M.cur] = '█'; lc[M.cur] = hiC; }
    // 繪製牆與格子
    const { cw, chh, ox, oy } = s, cols = g.cols, ch = g.ch, co = g.co;
    const put = (x, y, c, col) => { if (x >= 0 && y >= 0 && x < cols && y < g.rows) { const k = y * cols + x; ch[k] = c; co[k] = col; } };
    for (let Y = 0; Y <= H; Y++) for (let X = 0; X <= W; X++) {
      const up = Y > 0 && (X === 0 || X === W || E[(Y - 1) * W + X - 1]);
      const dn = Y < H && (X === 0 || X === W || E[Y * W + X - 1]);
      const lf = X > 0 && (Y === 0 || Y === H || S[(Y - 1) * W + X - 1]);
      const rt = X < W && (Y === 0 || Y === H || S[(Y - 1) * W + X]);
      const bits = (up ? 1 : 0) | (dn ? 2 : 0) | (lf ? 4 : 0) | (rt ? 8 : 0);
      const px = ox + X * cw, py = oy + Y * chh;
      const lit = (X > 0 && Y > 0 && inM[(Y - 1) * W + X - 1]) || (X < W && Y > 0 && inM[(Y - 1) * W + X]) || (X > 0 && Y < H && inM[Y * W + X - 1]) || (X < W && Y < H && inM[Y * W + X]);
      if (bits) put(px, py, BOXJ[bits], lit ? wallC : faintC);
      if (X < W) {
        const hw = Y === 0 || Y === H || S[(Y - 1) * W + X], a = Y > 0 ? (Y - 1) * W + X : -1, b = Y < H ? Y * W + X : -1;
        const fill = !hw && a >= 0 && b >= 0 && look[a] !== ' ' && look[b] !== ' ' && look[a] !== '·' ? look[a] : null;
        const hc = (a >= 0 && inM[a]) || (b >= 0 && inM[b]) ? wallC : faintC;
        for (let q = 1; q < cw; q++) { if (hw) put(px + q, py, '─', hc); else if (fill) put(px + q, py, fill, lc[a]); }
      }
      if (Y < H) {
        const vw = X === 0 || X === W || E[Y * W + X - 1], a = X > 0 ? Y * W + X - 1 : -1, b = X < W ? Y * W + X : -1;
        const fill = !vw && a >= 0 && b >= 0 && look[a] !== ' ' && look[b] !== ' ' && look[a] !== '·' ? look[a] : null;
        const vc = (a >= 0 && inM[a]) || (b >= 0 && inM[b]) ? wallC : faintC;
        for (let q = 1; q < chh; q++) { if (vw) put(px, py + q, '│', vc); else if (fill) put(px, py + q, fill, lc[a]); }
      }
      if (X < W && Y < H) {
        const i = Y * W + X, c = look[i];
        if (c === ' ') continue;
        if (c === '·') { put(px + (cw >> 1), py + (chh >> 1), '·', lc[i]); continue; }
        for (let yy = 1; yy < chh; yy++) for (let q = 1; q < cw; q++) put(px + q, py + yy, c, lc[i]);
      }
    }
    const st = alg === 'shift' ? (s.phase === 'gen' ? tr(f, '  原點移動 ' + s.steps + ' 步 ', '  origin moved ' + s.steps + ' steps ') : tr(f, '  換一座新迷宮 ', '  next maze… '))
      : s.phase !== 'gen' ? tr(f, '  完成，距離著色 ', '  done, colored by distance ')
      : alg === 'braid' && M.left !== undefined ? tr(f, '  剩下死路 ' + M.left + ' 條 ', '  dead ends left ' + M.left + ' ') : tr(f, '  ' + s.steps + ' 步 ', '  ' + s.steps + ' steps ');
    tag(g, ox + 2, oy, ' ' + tr(f, MZ_NAME[alg], MZ_NAME_EN[alg]) + st, f.C(0.95));
  } });

/* ════════ 7. 河內塔 ════════ */
// 像素圖：'#' 為亮點，每兩列像素合成一列半格字元
function pixArt(g, x, y, pix, sx, col) {
  const h = pix.length, w = pix[0].length;
  for (let r = 0; r < h; r += 2) for (let c = 0; c < w; c++) {
    const a = pix[r][c] === '#', b = r + 1 < h && pix[r + 1][c] === '#';
    if (!a && !b) continue;
    const chr = a && b ? '█' : a ? '▀' : '▄';
    for (let q = 0; q < sx; q++) g.set(x + c * sx + q, y + (r >> 1), chr, col);
  }
}
function hnMoves(n, a, b, c, out) { if (n <= 0) return; hnMoves(n - 1, a, c, b, out); out.push(a, b); hnMoves(n - 1, c, b, a, out); }
function fsMoves(n, src, dst, others, out) {
  if (n <= 0) return;
  if (n === 1) { out.push(src, dst); return; }
  if (others.length === 1) { hnMoves(n, src, dst, others[0], out); return; }
  const k = n - Math.round(Math.sqrt(2 * n + 1)) + 1, sp = others[0], rest = others.slice(1);
  fsMoves(k, src, sp, [dst, ...rest], out);
  fsMoves(n - k, src, dst, rest, out);
  fsMoves(k, sp, dst, [src, ...rest], out);
}
function cyQ(n, a, out) { if (!n) return; cyR(n - 1, a, out); out.push(a, (a + 1) % 3); cyR(n - 1, (a + 2) % 3, out); }
function cyR(n, a, out) { if (!n) return; cyR(n - 1, a, out); out.push(a, (a + 1) % 3); cyQ(n - 1, (a + 2) % 3, out); out.push((a + 1) % 3, (a + 2) % 3); cyR(n - 1, a, out); }
function hnTower(n, P, mode, mps) {
  const T = { n, P, mode, mps, pegs: Array.from({ length: P }, () => []), moves: [], mi: 0, u: 0, cnt: 0, hold: 0.8, from: 0, to: 0 };
  for (let d = n; d >= 1; d--) T.pegs[0].push(d);
  hnPlan(T, 0);
  return T;
}
function hnPlan(T, from) {
  const P = T.P;
  let to;
  if (T.mode === 'cyclic') to = (from + 1) % 3;
  else { const o = []; for (let k = 0; k < P; k++) if (k !== from) o.push(k); to = pick(o); }
  T.moves = [];
  if (T.mode === 'cyclic') cyQ(T.n, from, T.moves);
  else if (P > 3) fsMoves(T.n, from, to, [...Array(P).keys()].filter(k => k !== from && k !== to), T.moves);
  else hnMoves(T.n, from, to, 3 - from - to, T.moves);
  T.mi = 0; T.u = 0; T.from = from; T.to = to; T.cnt = 0;
}
function hnStep(T, dt) {
  if (T.hold > 0) { T.hold -= dt; if (T.hold <= 0 && T.mi * 2 >= T.moves.length) hnPlan(T, T.to); return; }
  T.u += dt * T.mps;
  while (T.u >= 1) {
    T.u -= 1;
    const a = T.moves[2 * T.mi], b = T.moves[2 * T.mi + 1];
    T.pegs[b].push(T.pegs[a].pop()); T.mi++; T.cnt++;
    if (T.mi * 2 >= T.moves.length) { T.hold = 2.2; T.u = 0; break; }
  }
}
function hnLayout(T, x0, y0, w, h) {
  Object.assign(T, { x0, y0, w, h, yb: y0 + h - 1 });
  // 盤子厚度跟著畫面高度放大，整疊約佔七成高度（大螢幕上不會只擠在下半部）
  T.dh = clamp(Math.floor((h - 3) / (T.n + 2)), 1, 7);
  T.pegX = Array.from({ length: T.P }, (_, k) => Math.round(x0 + (w * (2 * k + 1)) / (2 * T.P)));
  T.maxW = Math.max(3, Math.floor(w / T.P) - 3); T.minW = Math.min(T.maxW, Math.max(3, Math.round(T.maxW * 0.2)));
  T.top = T.yb - (T.n + 1) * T.dh - 1;
}
function hnDiscW(T, d) { let wd = Math.round(T.minW + ((T.maxW - T.minW) * (d - 1)) / Math.max(1, T.n - 1)); if (wd % 2 === 0) wd--; return Math.max(1, wd); }
function hnDisc(g, T, cx, ytop, d, col) {
  const wd = hnDiscW(T, d), x = Math.round(cx - (wd - 1) / 2);
  for (let r = 0; r < T.dh; r++) for (let q = 0; q < wd; q++) g.set(x + q, ytop + r, r === 0 ? '▄' : '█', col);
}
function hnDraw(g, f, s, T, dcol) {
  const { yb, dh, x0, w } = T, baseC = f.C(0.38), pegC = f.C(0.3);
  for (let x = x0; x < x0 + w; x++) g.set(x, yb, '▀', baseC);
  for (const px of T.pegX) for (let y = yb - 1; y >= T.top; y--) g.set(px, y, '│', pegC);
  const moving = T.hold <= 0 && T.mi * 2 < T.moves.length && T.mps < 14;
  const ma = moving ? T.moves[2 * T.mi] : -1, mb = moving ? T.moves[2 * T.mi + 1] : -1;
  for (let p = 0; p < T.P; p++) {
    const st = T.pegs[p];
    for (let L = 0; L < st.length; L++) { if (p === ma && L === st.length - 1) continue; hnDisc(g, T, T.pegX[p], yb - (L + 1) * dh, st[L], dcol(st[L])); }
  }
  if (moving) {
    const d = T.pegs[ma][T.pegs[ma].length - 1], xa = T.pegX[ma], xb = T.pegX[mb];
    const ya = yb - T.pegs[ma].length * dh, y2 = yb - (T.pegs[mb].length + 1) * dh;
    const wrap = T.mode === 'cyclic' && mb < ma, lift = wrap ? T.y0 : T.top - dh - 1;
    const L1 = ya - lift, L2 = Math.abs(xb - xa) / 2.1, L3 = y2 - lift, u = T.u, e = u * u * (3 - 2 * u), sp = e * (L1 + L2 + L3);
    let x, y;
    if (sp < L1) { x = xa; y = ya - sp; } else if (sp < L1 + L2) { x = xa + Math.sign(xb - xa) * (sp - L1) * 2.1; y = lift; } else { x = xb; y = lift + (sp - L1 - L2); }
    hnDisc(g, T, x, Math.round(y), d, dcol(d, true));
  }
}
// 狀態圖：n 個盤子的 3^n 種狀態構成謝爾賓斯基三角形
function hnStatePos(s, st) {
  let x = 0, y = 0;
  const n = s.n, V = s.V;
  for (let d = n - 1, k = 1; d >= 0; d--, k++) { const p = Math.floor(st / s.p3[d]) % 3; x += V[p][0] / 2 ** k; y += V[p][1] / 2 ** k; }
  const z = 1 - 2 ** -n;
  return [x / z, y / z];
}
function hnTop(s, st, peg) { for (let d = 0; d < s.n; d++) if (Math.floor(st / s.p3[d]) % 3 === peg) return d; return 99; }
A({ id: 'al-hanoi', name: '河內塔', cat: CAT, theme: 'gold', hue: true, desc: '八層河內塔用最少步數搬到另一根柱子',
  params: { mode: 'classic', n: 8, P: 3, dur: 80 },
  variants: [
    { id: 'four', name: '四柱', theme: 'ice', desc: '四根柱子的弗雷姆–斯圖爾特解法', params: { P: 4, n: 11, dur: 70 } },
    { id: 'graph', name: '狀態圖', theme: 'cyber', desc: '每種擺法都是謝爾賓斯基三角形上一點', params: { mode: 'graph', n: 6 } },
    { id: 'many', name: '群塔', theme: 'sunset', desc: '大大小小的河內塔同時開工', params: { mode: 'many' } },
    { id: 'binary', name: '二進位', theme: 'mint', desc: '步數的二進位恰好指出要動哪個盤子', params: { mode: 'binary', n: 10, dur: 160 } },
    { id: 'fast', name: '疾速', theme: 'fire', desc: '十幾層薄盤以極快速度來回搬運', params: { mode: 'fast', n: 15 } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows } = f;
    s.T = 0;
    if (p.mode === 'many') {
      const gc = cols >= 150 ? 3 : 2, gr = rows >= 40 ? 2 : 1, cw = Math.floor(cols / gc), rh = Math.floor(rows / gr);
      s.towers = [];
      for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) {
        const n = rint(3, rh >= 20 ? 7 : 5), P = Math.random() < 0.25 ? 4 : 3, mode = P === 3 && Math.random() < 0.3 ? 'cyclic' : 'classic';
        const T = hnTower(n, P, mode, rnd(1.5, 5));
        hnLayout(T, i * cw + 2, j * rh + 2, cw - 4, rh - 3);
        T.hue = rnd(0, 360); s.towers.push(T);
      }
      return;
    }
    if (p.mode === 'graph') {
      const n = cols >= 120 ? p.n : 4, W = cols * 2, H = rows * 4, m = 6;
      s.n = n; s.p3 = Array.from({ length: n + 1 }, (_, k) => 3 ** k);
      const side = Math.min(W - 2 * m - (cols >= 120 ? 50 : 0), ((H - 2 * m) * 2) / Math.sqrt(3)), hgt = (side * Math.sqrt(3)) / 2;
      const cx = cols >= 120 ? W / 2 + 25 : W / 2, top = (H - hgt) / 2;
      s.V = [[cx, top], [cx - side / 2, top + hgt], [cx + side / 2, top + hgt]];
      const NS = 3 ** n;
      s.pos = Array.from({ length: NS }, (_, st) => hnStatePos(s, st));
      const D = new Dots(cols, rows), dim = f.C(0.2);
      for (let st = 0; st < NS; st++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        if (a === b) continue;
        const ta = hnTop(s, st, a), tb = hnTop(s, st, b);
        if (ta >= 99 || ta > tb) continue;
        const nt = st + (b - a) * s.p3[ta];
        if (nt < st) continue;
        D.line(s.pos[st][0], s.pos[st][1], s.pos[nt][0], s.pos[nt][1], dim);
      }
      s.D = D; s.base = D.b.slice(); s.baseC = D.c.slice();
      s.st = rint(0, NS - 1); s.route = [s.st]; s.ri = 0; s.u = 0; s.trail = []; s.plan = 0;
      this.planGraph(s);
      return;
    }
    // 循環河內塔在高螢幕上多放一層，才填得滿畫面
    const n = p.mode === 'fast' ? clamp(rows - 8, 4, p.n) : p.mode === 'binary' ? clamp(Math.floor((rows - 6) / 1.5), 4, p.n) : p.mode === 'cyclic' && rows >= 60 ? p.n + 1 : p.n;
    const T = hnTower(n, p.P, p.mode === 'cyclic' ? 'cyclic' : 'classic', 1);
    T.mps = p.mode === 'fast' ? 45 : clamp(T.moves.length / 2 / p.dur, 1.2, 12);
    hnLayout(T, 2, 2, cols - 4, rows - (p.mode === 'binary' ? 6 : 3));
    s.towers = [T];
  },
  planGraph(s) {
    // 交替：從目前狀態走最佳步數到某個角落，再隨機漫步一段
    const n = s.n, route = [s.st];
    let st = s.st;
    const peg = d => Math.floor(st / s.p3[d]) % 3;
    if (s.plan % 2 === 0) {
      const t = rint(0, 2);
      const go = (d, tgt) => { if (d < 0) return; if (peg(d) === tgt) { go(d - 1, tgt); return; } const o = 3 - peg(d) - tgt; go(d - 1, o); st += (tgt - peg(d)) * s.p3[d]; route.push(st); go(d - 1, tgt); };
      go(n - 1, t);
      s.goal = ['全部移到第 ' + 'ABC'[t] + ' 柱', 'all disks to peg ' + 'ABC'[t]];
    } else {
      let last = -1;
      for (let k = 0; k < 30 + n * 6; k++) {
        const opts = [];
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { if (a === b) continue; const ta = hnTop(s, st, a), tb = hnTop(s, st, b); if (ta < 99 && ta < tb) { const nt = st + (b - a) * s.p3[ta]; if (nt !== last) opts.push(nt); } }
        last = st; st = pick(opts); route.push(st);
      }
      s.goal = ['隨機漫步', 'random walk'];
    }
    s.plan++; s.route = route; s.ri = 0; s.u = 0;
  },
  frame(s, f) {
    const p = f.p, g = f.g, dt = f.dt;
    themed(s, f, this);
    s.T += dt;
    if (p.mode === 'graph') {
      const D = s.D;
      if (s.ri >= s.route.length - 1) { s.st = s.route[s.route.length - 1]; this.planGraph(s); }
      s.u += dt * 3.6;
      while (s.u >= 1 && s.ri < s.route.length - 1) { s.u -= 1; s.trail.push([s.route[s.ri], s.route[s.ri + 1], s.T]); s.ri++; }
      if (s.trail.length > 220) s.trail.splice(0, s.trail.length - 220);
      D.b.set(s.base); for (let i = 0; i < s.baseC.length; i++) D.c[i] = s.baseC[i];
      for (const [a, b, t0] of s.trail) {
        const age = s.T - t0, A_ = s.pos[a], B_ = s.pos[b];
        D.line(A_[0], A_[1], B_[0], B_[1], hv(s, f, 180 + age * 4, Math.max(0.25, 0.85 - age * 0.012), Math.max(0.3, 1 - age * 0.012)));
      }
      const a = s.route[s.ri], b = s.route[Math.min(s.ri + 1, s.route.length - 1)], u = s.u;
      const px = lerp(s.pos[a][0], s.pos[b][0], u), py = lerp(s.pos[a][1], s.pos[b][1], u), hr = 5 + 2.5 * Math.sin(s.T * 4), halo = hv(s, f, 50, 0.7, 0.8);
      for (let k = 0; k < 24; k++) { const an = (k / 24) * TAU + s.T; D.dot(px + Math.cos(an) * hr, py + Math.sin(an) * hr, halo); }
      D.flush(g);
      g.set(px / 2, py / 4, '●', hv(s, f, 50, 0.95, 1));
      ['A', 'B', 'C'].forEach((L, k) => g.text(s.V[k][0] / 2 + (k === 0 ? 2 : k === 1 ? -3 : 2), s.V[k][1] / 4 + (k === 0 ? 0 : 0), L, f.C(0.8)));
      // 左上角的小河內塔顯示目前擺法
      if (f.cols >= 120) {
        const st = a, mini = { n: s.n, P: 3, pegs: [[], [], []], moves: [], mi: 0, hold: 1, mode: 'classic', mps: 1 };
        for (let d = s.n - 1; d >= 0; d--) mini.pegs[Math.floor(st / s.p3[d]) % 3].push(d + 1);
        hnLayout(mini, 2, 3, 44, Math.min(f.rows - 6, s.n * 2 + 6));
        hnDraw(g, f, s, mini, d => hg(s, f, d / s.n, 0.55, 0.35 + (0.6 * d) / s.n));
      }
      tag(g, 2, 0, tr(f, '河內塔狀態圖  ' + s.n + ' 層 × ' + 3 ** s.n + ' 種擺法  ' + s.goal[0], 'Hanoi State Graph  ' + s.n + ' disks, ' + 3 ** s.n + ' states  ' + s.goal[1]), f.C(0.8));
      return;
    }
    for (const T of s.towers) hnStep(T, dt);
    for (const T of s.towers) {
      // 群塔每座的漸層起點不同（三角波，窄色相範圍裡也不會斷層）
      const uOf = T.hue !== undefined ? d => tri(T.hue / 360 + (d / T.n) * 0.45) : d => d / T.n;
      hnDraw(g, f, s, T, (d, mv) => hg(s, f, uOf(d), mv ? 0.75 : 0.5, 0.3 + (0.62 * d) / T.n + (mv ? 0.1 : 0)));
      if (p.mode === 'many' && f.cols >= 80) tag(g, T.x0, T.y0 - 1, (T.P > 3 ? tr(f, '四柱 ', '4 pegs, ') : T.mode === 'cyclic' ? tr(f, '循環 ', 'cyclic, ') : '') + T.n + tr(f, ' 層  ', ' disks  ') + T.cnt + '/' + (T.moves.length >> 1), f.C(0.55));
    }
    const T = s.towers[0];
    if (p.mode === 'binary') {
      const n = T.n, bw = Math.max(2, Math.min(5, Math.floor((f.cols - 10) / n) - 1)), x0 = Math.floor((f.cols - n * (bw + 1)) / 2), y = f.rows - 3;
      for (let d = n; d >= 1; d--) {
        const on = (T.cnt >> (d - 1)) & 1, x = x0 + (n - d) * (bw + 1), col = hg(s, f, d / n, on ? 0.6 : 0.22, on ? 0.35 + (0.6 * d) / n : 0.14);
        for (let q = 0; q < bw; q++) { g.set(x + q, y, on ? '█' : '░', col); g.set(x + q, y + 1, on ? '▀' : ' ', col); }
      }
      const bin = T.cnt.toString(2).padStart(n, '0');
      tag(g, 2, f.rows - 1, tr(f, '第 ' + T.cnt + ' 步  二進位 ' + bin + '  最右邊的 1 是剛移動的盤子', 'move ' + T.cnt + '  binary ' + bin + '  the rightmost 1 is the disk just moved'), f.C(0.7));
    }
    if (p.mode !== 'many') {
      const nm = p.mode === 'cyclic' ? tr(f, '循環河內塔', 'Cyclic Tower of Hanoi') : T.P > 3 ? tr(f, '四柱河內塔', 'Four-Peg Tower of Hanoi') : tr(f, '河內塔', 'Tower of Hanoi');
      tag(g, 2, 0, nm + '  ' + T.n + tr(f, ' 層  第 ' + T.cnt + ' / ' + (T.moves.length >> 1) + ' 步', ' disks  move ' + T.cnt + ' / ' + (T.moves.length >> 1)), f.C(0.75));
    }
  } });

/* ════════ 8. N 皇后 ════════ */
const CROWN = ['#..#..#', '#.###.#', '#######', '.#####.', '.#####.', '#######'];
function qNew(N, rand) {
  const Q = { N, cols: new Int32Array(N).fill(-1), pos: new Int32Array(N), ord: [], r: 0, c: 0, steps: 0, sols: 0, tr: -1, tc: -1, conf: -1, done: false, last: '', hold: 0 };
  for (let r = 0; r < N; r++) { const o = Array.from({ length: N }, (_, i) => i); Q.ord.push(rand ? shuffle(o) : o); }
  return Q;
}
function qStep(Q) {
  const N = Q.N;
  if (Q.r >= N) { Q.r = N - 1; Q.c = Q.pos[Q.r] + 1; Q.cols[Q.r] = -1; Q.tr = -1; return (Q.last = 'back'); }
  if (Q.c >= N) {
    Q.r--;
    if (Q.r < 0) { Q.done = true; Q.r = 0; Q.tr = -1; return (Q.last = 'end'); }
    Q.c = Q.pos[Q.r] + 1; Q.cols[Q.r] = -1; Q.tr = -1;
    return (Q.last = 'back');
  }
  const col = Q.ord[Q.r][Q.c];
  Q.tr = Q.r; Q.tc = col; Q.steps++; Q.conf = -1;
  for (let k = 0; k < Q.r; k++) { const q = Q.cols[k]; if (q === col || Math.abs(q - col) === Q.r - k) { Q.conf = k; break; } }
  if (Q.conf < 0) { Q.cols[Q.r] = col; Q.pos[Q.r] = Q.c; Q.r++; Q.c = 0; if (Q.r === N) { Q.sols++; return (Q.last = 'sol'); } return (Q.last = 'place'); }
  Q.c++;
  return (Q.last = 'fail');
}
function qBoard(g, f, s, Q, x0, y0, cw, chh, attack) {
  const N = Q.N, dark = f.C(0.14), qc = hv(s, f, 45, 0.85, 1);
  let att = null;
  if (attack) {
    att = new Uint8Array(N * N);
    for (let r = 0; r < N; r++) { const c = Q.cols[r]; if (c < 0) continue; for (let k = 0; k < N; k++) { att[r * N + k]++; att[k * N + c]++; const d = k - r; if (c + d >= 0 && c + d < N) att[k * N + c + d]++; if (c - d >= 0 && c - d < N) att[k * N + c - d]++; } }
  }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    let chr = (r + c) & 1 ? '░' : ' ', col = dark;
    if (att && att[r * N + c] && Q.cols[r] !== c) { const a = att[r * N + c]; chr = a > 2 ? '▓' : a > 1 ? '▒' : '░'; col = hv(s, f, 350, 0.2 + a * 0.05, 0.16 + a * 0.06); }
    if (r === Q.tr && c === Q.tc && Q.last !== 'back') { chr = '▒'; col = Q.last === 'fail' ? hv(s, f, 0, 0.55, 0.5) : hv(s, f, 130, 0.55, 0.7); }
    if (chr === ' ') continue;
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) g.set(x0 + c * cw + x, y0 + r * chh + y, chr, col);
  }
  if (Q.last === 'fail' && Q.conf >= 0) {
    const ax = x0 + Q.tc * cw + cw / 2, ay = y0 + Q.tr * chh + chh / 2, bx = x0 + Q.cols[Q.conf] * cw + cw / 2, by = y0 + Q.conf * chh + chh / 2;
    g.line(ax, ay, bx, by, '·', hv(s, f, 0, 0.7, 0.8));
  }
  const big = cw >= 9 && chh >= 3, sx = cw >= 18 ? 2 : 1;
  for (let r = 0; r < N; r++) {
    const c = Q.cols[r];
    if (c < 0) continue;
    if (big) pixArt(g, x0 + c * cw + Math.floor((cw - 7 * sx) / 2), y0 + r * chh + Math.floor((chh - 3) / 2), CROWN, sx, qc);
    else { const X = x0 + c * cw + Math.floor((cw - 1) / 2), Y = y0 + r * chh + Math.floor((chh - 1) / 2); g.set(X, Y, '◆', qc); if (cw >= 2) g.set(X + 1, Y, cw >= 3 ? ' ' : '◆', qc); }
  }
}
function qGallery(g, f, s, sols, N, x0, y0, w, h, wave) {
  const tw = N * 2 + 2, th = N + 1, nc = Math.floor(w / tw), nr = Math.floor(h / th), cap = nc * nr;
  if (cap < 1) return;
  const start = Math.max(0, sols.length - cap), qc = hv(s, f, 45, 0.7, 0.85), newC = hv(s, f, 45, 0.95, 1), dk = f.C(0.12);
  for (let k = start; k < sols.length; k++) {
    const j = k - start, X = x0 + (j % nc) * tw, Y = y0 + Math.floor(j / nc) * th, sol = sols[k], isNew = k === sols.length - 1;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const q = sol[r] === c;
      if (!q && !((r + c) & 1)) continue;
      const ch = q ? '█' : '░', col = q ? (wave && Math.sin(s.T * 3 - j * 0.45) > 0.6 ? newC : isNew ? newC : qc) : dk;
      g.set(X + c * 2, Y + r, ch, col); g.set(X + c * 2 + 1, Y + r, ch, col);
    }
  }
}
function qTree(N) {
  const nodes = [{ d: 0, c: -1, p: -1, kids: [], sol: false }], cols = [];
  (function rec(par, d) {
    for (let c = 0; c < N; c++) {
      let ok = true;
      for (let k = 0; k < d; k++) { const q = cols[k]; if (q === c || Math.abs(q - c) === d - k) { ok = false; break; } }
      if (!ok) continue;
      const id = nodes.length;
      nodes.push({ d: d + 1, c, p: par, kids: [], sol: d + 1 === N });
      nodes[par].kids.push(id);
      cols.push(c); if (d + 1 < N) rec(id, d + 1); cols.pop();
    }
  })(0, 0);
  let leaf = 0;
  (function lay(i) { const nd = nodes[i]; if (!nd.kids.length) { nd.x = leaf++; return; } for (const k of nd.kids) lay(k); nd.x = (nodes[nd.kids[0]].x + nodes[nd.kids[nd.kids.length - 1]].x) / 2; })(0);
  // 通往任一個解的節點（完成後沿著這些枝幹打光）
  for (let i = nodes.length - 1; i > 0; i--) if (nodes[i].sol) for (let j = i; j > 0 && !nodes[j].toSol; j = nodes[j].p) nodes[j].toSol = true;
  return { nodes, leaves: leaf };
}
function mcConf(M, c, r) { let n = 0; const row = M.row; for (let k = 0; k < M.N; k++) { if (k === c) continue; const q = row[k]; if (q === r || Math.abs(q - r) === Math.abs(k - c)) n++; } return n; }
function mcNew(N) {
  const M = { N, row: new Int32Array(N).fill(-1000), it: 0, look: -1, lookT: 0, heat: new Uint8Array(N), solved: false, hold: 0 };
  for (let c = 0; c < N; c++) {
    let best = 1e9, br = 0, cnt = 0;
    for (let r = 0; r < N; r++) { let n = 0; for (let k = 0; k < c; k++) { const q = M.row[k]; if (q === r || Math.abs(q - r) === c - k) n++; } if (n < best) { best = n; br = r; cnt = 1; } else if (n === best && Math.random() < 1 / ++cnt) br = r; }
    M.row[c] = Math.random() < 0.35 ? rint(0, N - 1) : br;
  }
  return M;
}
function mcStep(M) {
  const N = M.N, bad = [];
  for (let c = 0; c < N; c++) if (mcConf(M, c, M.row[c])) bad.push(c);
  if (!bad.length) { M.solved = true; return; }
  const c = pick(bad);
  let best = 1e9, br = M.row[c], cnt = 0;
  for (let r = 0; r < N; r++) { const n = mcConf(M, c, r); M.heat[r] = Math.min(9, n); if (n < best || (n === best && Math.random() < 1 / ++cnt)) { if (n < best) cnt = 1; best = n; br = r; } }
  M.from = M.row[c]; M.row[c] = br; M.it++; M.look = c; M.lookT = 0.45;
}
A({ id: 'al-queens', name: 'N 皇后', cat: CAT, theme: 'gold', hue: true, desc: '八皇后回溯搜尋，找到的解排在右邊',
  params: { mode: 'classic', N: 8, rate: 24 },
  variants: [
    { id: 'attack', name: '攻擊範圍', theme: 'blood', desc: '每個皇后的攻擊線疊成深淺網格', params: { mode: 'attack', N: 10, rate: 18 } },
    { id: 'all', name: '全部解', theme: 'amber', desc: '高速列舉八皇后全部 92 個解', params: { mode: 'all', N: 8, rate: 500 } },
    { id: 'tree', name: '搜尋樹', theme: 'mint', desc: '回溯法的搜尋樹一枝一枝長出來', params: { mode: 'tree', rate: 7 } },
    { id: 'minconf', name: '最小衝突', theme: 'cyber', desc: '幾十個皇后靠局部調整消除衝突', params: { mode: 'minconf', rate: 3 } },
    { id: 'multi', name: '多盤', theme: 'lavender', desc: '四到九皇后的棋盤同時求解', params: { mode: 'multi', rate: 30 } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows, aspect } = f, mode = p.mode;
    s.T = 0; s.acc = 0;
    if (mode === 'tree') {
      s.N = cols >= 200 ? 7 : 6; s.tree = qTree(s.N); s.ri = 0; s.hold = 0; s.D = new Dots(cols, rows);
      return;
    }
    if (mode === 'minconf') {
      s.N = clamp(Math.min(rows - 2, Math.floor((cols - 4) / 2)), 8, 60); s.M = mcNew(s.N);
      s.cw = 2; s.chh = 1; s.x0 = Math.floor((cols - s.N * 2) / 2); s.y0 = Math.floor((rows - s.N) / 2);
      return;
    }
    if (mode === 'multi') {
      const gc = cols >= 150 ? 4 : 2, gr = rows >= 40 ? 2 : 1, bw = Math.floor(cols / gc), bh = Math.floor(rows / gr), Ns = shuffle([4, 5, 6, 7, 8, 9, 6, 8]);
      s.boards = [];
      for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) {
        const N = Ns[(j * gc + i) % Ns.length], chh = Math.max(1, Math.floor((bh - 3) / N)), cw = Math.max(2, Math.min(Math.round(chh * aspect), Math.floor((bw - 2) / N)));
        const B = { Q: qNew(N, true), N, cw, chh, x0: i * bw + Math.floor((bw - N * cw) / 2), y0: j * bh + 2 + Math.floor((bh - 3 - N * chh) / 2), lx: i * bw + 2, ly: j * bh, rate: p.rate * rnd(0.6, 1.4), acc: 0, hold: 0 };
        s.boards.push(B);
      }
      return;
    }
    const N = mode === 'big' ? (rows >= 40 ? p.N : 12) : p.N;
    s.Q = qNew(N, mode !== 'classic' || Math.random() < 0.5);
    s.sols = [];
    if (mode === 'all') { s.chh = Math.max(1, Math.floor((rows - 4) / (N * 2.2))); }
    else s.chh = Math.max(1, Math.floor((rows - 2) / N));
    s.cw = Math.max(2, Math.round(s.chh * aspect));
    const bw = N * s.cw;
    s.y0 = Math.floor((rows - N * s.chh) / 2) + (mode === 'all' ? 0 : 1);
    s.x0 = mode === 'classic' && cols - bw > 30 ? Math.max(2, Math.floor((cols - bw) * 0.12)) : mode === 'all' ? 2 : Math.floor((cols - bw) / 2);
    if (mode === 'all') s.y0 = 2;
  },
  frame(s, f) {
    const p = f.p, g = f.g, dt = f.dt, mode = p.mode;
    themed(s, f, this);
    s.T += dt;
    if (mode === 'tree') {
      const { nodes, leaves } = s.tree, D = s.D, W = D.W, H = D.H, N = s.N;
      if (s.hold > 0) { s.hold -= dt; if (s.hold <= 0) { s.ri = 0; } }
      else { s.ri += dt * p.rate * (N === 7 ? 3 : 1); if (s.ri >= nodes.length) { s.ri = nodes.length; s.hold = 4; } }
      const shown = Math.min(nodes.length, Math.floor(s.ri)), cur = Math.max(0, shown - 1);
      const top = f.cols >= 120 ? 36 : 8, bot = H - 6, mx = 6;
      const X = nd => mx + ((nd.x + 0.5) / leaves) * (W - 2 * mx), Y = nd => top + (nd.d / N) * (bot - top);
      const onPath = new Uint8Array(nodes.length);
      for (let i = cur; i >= 0; i = nodes[i].p) onPath[i] = 1;
      D.clear();
      // 搜尋完畢的停留時間：光波由樹根沿著通往解的枝幹往下流
      const glow = s.hold > 0, wave = nd => Math.sin(s.T * 4 - nd.d * 1.1 - (nd.x / leaves) * 5);
      for (let i = 1; i < shown; i++) {
        const nd = nodes[i], pr = nodes[nd.p];
        let col = onPath[i] && !glow ? hv(s, f, 50, 0.9, 1) : nd.sol ? hv(s, f, 130, 0.6, 0.75) : hv(s, f, 160 + nd.d * 20, 0.32, 0.2 + nd.d * 0.05);
        if (glow && nd.toSol) { const w = wave(nd); col = w > 0.35 ? hv(s, f, 50, 0.7 + w * 0.25, 0.75 + w * 0.25) : hv(s, f, 130, 0.5, 0.6); }
        D.line(X(pr), Y(pr), X(nd), Y(nd), col);
      }
      D.flush(g);
      for (let i = 0; i < shown; i++) {
        const nd = nodes[i], x = X(nd) / 2, y = Y(nd) / 4;
        if (nd.sol) g.set(x, y, '◆', glow && wave(nd) < 0 ? hv(s, f, 130, 0.7, 0.8) : hv(s, f, 50, 0.95, 1));
        else if (!nd.kids.length) g.set(x, y, 'x', hv(s, f, 0, 0.5, 0.45));
        else if (onPath[i] && !glow) g.set(x, y, '●', hv(s, f, 50, 0.9, 1));
      }
      // 目前的局部擺法
      if (f.cols >= 120) {
        const Q = { N, cols: new Int32Array(N).fill(-1), tr: -1, last: '' };
        for (let i = cur; i > 0; i = nodes[i].p) Q.cols[nodes[i].d - 1] = nodes[i].c;
        qBoard(g, f, s, Q, 2, 1, 4, 2, true);
      }
      let found = 0;
      for (let i = 0; i < shown; i++) if (nodes[i].sol) found++;
      tag(g, f.cols >= 120 ? 4 * N + 6 : 2, 0, tr(f, N + ' 皇后搜尋樹  節點 ' + shown + ' / ' + nodes.length + '  找到 ' + found + ' 解',
        N + '-Queens Search Tree  nodes ' + shown + ' / ' + nodes.length + '  solutions found ' + found), f.C(0.85));
      return;
    }
    if (mode === 'minconf') {
      const M = s.M, N = s.N;
      if (M.solved) { M.hold += dt; if (M.hold > 3.5) { s.M = mcNew(N); } }
      else { let k = due(s, dt, p.rate, 5); while (k-- > 0 && !M.solved) mcStep(M); }
      M.lookT -= dt;
      const dark = f.C(0.1);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r + c) & 1) { g.set(s.x0 + c * 2, s.y0 + r, '░', dark); g.set(s.x0 + c * 2 + 1, s.y0 + r, '░', dark); }
      if (M.lookT > 0 && M.look >= 0) for (let r = 0; r < N; r++) { const h = M.heat[r], ch = h === 0 ? '·' : h < 2 ? '░' : h < 4 ? '▒' : '▓'; const col = hv(s, f, 200, 0.3 + h * 0.04, 0.25 + h * 0.07); g.set(s.x0 + M.look * 2, s.y0 + r, ch, col); g.set(s.x0 + M.look * 2 + 1, s.y0 + r, ch, col); }
      let bad = 0;
      for (let c = 0; c < N; c++) {
        const n = mcConf(M, c, M.row[c]);
        if (n) bad++;
        const pulse = 0.12 * Math.sin(s.T * 3 + c * 0.7);
        const col = M.solved ? hv(s, f, 130 + (s.T * 40 + c * 6) % 60, 0.65 + pulse, 0.85 + pulse) : n ? hv(s, f, 0 + n * 8, 0.55 + pulse, 0.7 + n * 0.06 + pulse) : hv(s, f, 160, 0.45, 0.45);
        let ry = M.row[c];
        if (c === M.look && M.lookT > 0.15 && M.from !== undefined) { const u = 1 - (M.lookT - 0.15) / 0.3; ry = Math.round(lerp(M.from, M.row[c], u * u * (3 - 2 * u))); }
        g.set(s.x0 + c * 2, s.y0 + ry, '█', col); g.set(s.x0 + c * 2 + 1, s.y0 + ry, '█', col);
      }
      tag(g, 2, 0, tr(f, N + ' 皇后最小衝突法  第 ' + M.it + ' 次調整  衝突皇后 ' + bad + (M.solved ? '  完成' : ''),
        N + '-Queens Min-Conflicts  move ' + M.it + '  queens in conflict ' + bad + (M.solved ? '  solved' : '')), f.C(0.85));
      return;
    }
    if (mode === 'multi') {
      for (const B of s.boards) {
        if (B.hold > 0) { B.hold -= dt; if (B.hold <= 0 && B.Q.done) B.Q = qNew(B.N, true); }
        else {
          B.acc += dt * B.rate;
          while (B.acc >= 1) { B.acc -= 1; const r = qStep(B.Q); if (r === 'sol') { B.hold = 1.1; B.acc = 0; break; } if (r === 'end') { B.hold = 2.5; break; } }
        }
        qBoard(g, f, s, B.Q, B.x0, B.y0, B.cw, B.chh, false);
        tag(g, B.lx, B.ly, B.N + tr(f, ' 皇后  解 ', '-Queens  solutions ') + B.Q.sols, f.C(0.65));
      }
      return;
    }
    const Q = s.Q;
    if (Q.hold > 0) {
      Q.hold -= dt;
      if (Q.hold <= 0 && (Q.done || mode === 'big')) { s.Q = qNew(Q.N, true); if (Q.done) s.sols = []; }
    } else {
      const rate = p.rate * (mode === 'classic' && Q.steps < 3 ? 0.5 : 1);
      let k = due(s, dt, rate, 400);
      while (k-- > 0) {
        const r = qStep(Q);
        if (r === 'sol') { s.sols.push(Q.cols.slice()); if (s.sols.length > 200) s.sols.shift(); Q.hold = mode === 'all' ? 0.12 : mode === 'big' ? 2.8 : 1.4; s.acc = 0; break; }
        if (r === 'end') { Q.hold = 4; break; }
        if (mode === 'big' && Q.steps > 30000) { Q.done = true; Q.hold = 0.5; break; }
      }
    }
    qBoard(g, f, s, s.Q, s.x0, s.y0, s.cw, s.chh, mode === 'attack');
    const N = s.Q.N, bw = N * s.cw;
    if (mode === 'classic' || mode === 'all') {
      const gx = mode === 'all' ? s.x0 + bw + 4 : s.x0 + bw + 6, gy = mode === 'all' ? 1 : s.y0;
      qGallery(g, f, s, s.sols, N, gx, gy, f.cols - gx - 1, f.rows - gy - 1, s.Q.done);
    }
    const st = s.Q.hold > 0 && s.Q.last === 'sol' ? tr(f, '  找到第 ' + s.Q.sols + ' 個解！', '  new solution!') : '';
    tag(g, s.x0, Math.max(0, s.y0 - 1 - (mode === 'all' ? 1 : 0)), N + tr(f, ' 皇后回溯  嘗試 ', '-Queens Backtracking  tries ') + s.Q.steps + tr(f, '  解 ', '  solutions ') + s.Q.sols + st, f.C(0.8));
  } });

/* ════════ 9. 騎士巡遊 ════════ */
const KM = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const HORSE = ['..##...', '.####..', '##.###.', '....##.', '...###.', '..####.', '.#####.', '#######'];
function ktTour(BW, BH, closed) {
  const N = BW * BH;
  for (let att = 0; att < (closed ? 300 : 80); att++) {
    const vis = new Uint8Array(N), sx = rint(0, BW - 1), sy = rint(0, BH - 1);
    let c = sy * BW + sx;
    vis[c] = 1;
    const path = [c];
    const deg = (x, y) => { let d = 0; for (const [dx, dy] of KM) { const u = x + dx, v = y + dy; if (u >= 0 && v >= 0 && u < BW && v < BH && !vis[v * BW + u]) d++; } return d; };
    let ok = true;
    for (let k = 1; k < N; k++) {
      let best = -1, bd = 99, cnt = 0;
      const x = c % BW, y = (c / BW) | 0;
      for (const [dx, dy] of KM) {
        const u = x + dx, v = y + dy;
        if (u < 0 || v < 0 || u >= BW || v >= BH || vis[v * BW + u]) continue;
        const d = deg(u, v);
        if (d < bd) { bd = d; best = v * BW + u; cnt = 1; } else if (d === bd && Math.random() < 1 / ++cnt) best = v * BW + u;
      }
      if (best < 0) { ok = false; break; }
      vis[best] = 1; path.push(best); c = best;
    }
    if (!ok) continue;
    if (!closed) return path;
    const dx = Math.abs((c % BW) - sx), dy = Math.abs(((c / BW) | 0) - sy);
    if (dx * dy === 2) return path;
  }
  return closed ? ktTour(BW, BH, false) : null;
}
// 暴力回溯用的走法順序（事先挑過：5×5 從角落出發約一萬六千到三萬七千步就找到巡遊），再配上棋盤的八種對稱，每輪都不一樣
const KT_ORD = ['21467350', '23715046', '47023615', '72640135', '74602153', '25731640', '42175306', '52763410', '64725031'];
A({ id: 'al-knight', name: '騎士巡遊', cat: CAT, theme: 'amber', hue: true, desc: '騎士用沃恩斯多夫法則走遍棋盤每一格',
  params: { mode: 'lines', B: 8, rate: 3 },
  variants: [
    { id: 'num', name: '編號', theme: 'paper', hue: false, desc: '每格寫上第幾步抵達', params: { mode: 'num', B: 10, rate: 4 } },
    { id: 'big', name: '大棋盤', theme: 'cyber', desc: '大棋盤上的路線交織成網', params: { mode: 'big', B: 26, rate: 14 } },
    { id: 'wide', name: '寬幅', theme: 'synth', desc: '鋪滿整個螢幕的長方形棋盤', params: { mode: 'wide', rate: 0 } },
    { id: 'heat', name: '漸層', theme: 'rainbow', desc: '依抵達順序把每一格染上顏色', params: { mode: 'heat', B: 16, rate: 9 } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows, aspect } = f;
    s.T = 0; s.acc = 0; s.k = 0; s.hold = 0; s.orbit = 0;
    if (p.mode === 'wide') {
      // 格子跟著螢幕放大，棋盤最多約 1800 格，換新巡遊時不會卡頓
      s.cw = Math.max(4, Math.ceil(cols / 60)); s.chh = Math.max(2, Math.ceil(rows / 30));
      s.BW = Math.max(6, Math.floor(cols / s.cw)); s.BH = Math.max(5, Math.floor(rows / s.chh));
    } else {
      const B = p.mode === 'big' ? clamp(Math.floor((rows - 2) / 2), 8, p.B) : p.mode === 'heat' && rows < 40 ? 12 : p.B;
      s.BW = s.BH = B;
      s.chh = Math.max(1, Math.floor((rows - 2) / B)); s.cw = Math.max(2, Math.round(s.chh * aspect));
      if (s.cw * B > cols - 2) { s.cw = Math.max(2, Math.floor((cols - 2) / B)); }
    }
    s.x0 = Math.floor((cols - s.BW * s.cw) / 2); s.y0 = Math.floor((rows - s.BH * s.chh) / 2) + (p.mode === 'wide' ? 0 : 1);
    s.D = new Dots(cols, rows);
    this.newTour(s, f);
  },
  // 回溯模式：搜尋在標準方向上進行，畫的時候套用對稱
  symC(s, c) {
    const B = s.BW;
    let x = c % B, y = (c / B) | 0;
    if (s.sym & 4 && s.BW === s.BH) { const t = x; x = y; y = t; }
    if (s.sym & 1) x = s.BW - 1 - x;
    if (s.sym & 2) y = s.BH - 1 - y;
    return y * B + x;
  },
  newTour(s, f) {
    const p = f.p, N = s.BW * s.BH;
    s.k = 0; s.hold = 0; s.orbit = 0;
    if (p.mode === 'back') {
      s.km = pick(KT_ORD).split('').map(i => KM[+i]); s.sym = rint(0, 7);
      s.vis = new Int32Array(N); s.stk = [[0, 0]]; s.vis[0] = 1; s.steps = 0; s.backs = 0; s.path = [this.symC(s, 0)];
      s.born = new Float32Array(N + 1).fill(-9);
      return;
    }
    // 上一輪的路線留著淡出，新巡遊開始時畫面不會突然變空
    if (s.path && s.path.length > 1) { s.prev = s.path; s.prevT = s.T; }
    s.path = ktTour(s.BW, s.BH, p.mode === 'closed') || [0];
    s.closed = p.mode === 'closed' && s.path.length === N && (() => { const a = s.path[0], b = s.path[N - 1], dx = Math.abs((a % s.BW) - (b % s.BW)), dy = Math.abs(((a / s.BW) | 0) - ((b / s.BW) | 0)); return dx * dy === 2; })();
    s.rate = p.rate || N / 40;
  },
  frame(s, f) {
    const p = f.p, g = f.g, dt = f.dt, { BW, BH, cw, chh, x0, y0 } = s, N = BW * BH, D = s.D, mode = p.mode;
    themed(s, f, this);
    s.T += dt;
    if (mode === 'back') {
      if (s.hold > 0) { s.hold -= dt; s.orbit += dt * 8; if (s.hold <= 0) this.newTour(s, f); }
      else {
        let k = due(s, dt, p.rate, 60);
        while (k-- > 0) {
          const top = s.stk[s.stk.length - 1];
          if (s.stk.length === N) { s.hold = 4; s.orbit = 0; break; }
          if (top[1] >= 8) { s.stk.pop(); s.vis[top[0]] = 0; s.backs++; if (!s.stk.length) { s.hold = 1; break; } continue; }
          const [dx, dy] = s.km[top[1]++], x = (top[0] % BW) + dx, y = ((top[0] / BW) | 0) + dy;
          s.steps++;
          if (x >= 0 && y >= 0 && x < BW && y < BH && !s.vis[y * BW + x]) { s.vis[y * BW + x] = s.stk.length + 1; s.stk.push([y * BW + x, 0]); s.born[s.stk.length - 1] = s.T; }
        }
      }
      s.path = s.stk.map(e => this.symC(s, e[0]));
      s.k = s.path.length - 1;
    } else if (s.hold > 0) {
      s.hold -= dt;
      // 完成後：封閉巡遊一道光繞圈；開放巡遊一道光從起點掃到終點
      s.orbit += dt * (s.closed ? 6 : Math.max(6, s.path.length / 3));
      if (s.hold <= 0) this.newTour(s, f);
    } else {
      s.k = Math.min(s.path.length - 1, s.k + dt * s.rate);
      if (s.k >= s.path.length - 1) { s.hold = s.closed ? 14 : 3.5; s.orbit = 0; }
    }
    const kk = Math.floor(s.k), total = Math.max(1, N - 1), path = s.path;
    const cx = c => (x0 + (c % BW) * cw + cw / 2) * 2, cy = c => (y0 + ((c / BW) | 0) * chh + chh / 2) * 4;
    // 依抵達順序的漸層；m 讓剛出現的線段先暗後亮
    const gcol = (i, b, m = 1) => hg(s, f, i / total, (0.32 + (b || 0)) * m, (0.25 + (i / total) * 0.6 + (b || 0)) * m);
    // 完成後的光點位置（開放巡遊）：index 與光點的距離 0..4 會被打亮
    const comet = i => (s.hold > 0 && !s.closed ? s.orbit - i : -1);
    const cometCol = d => hv(s, f, 50, 0.92 - d * 0.1, 1 - d * 0.14);
    // 棋盤
    const dark = f.C(0.1);
    if (mode !== 'wide' && mode !== 'big') for (let r = 0; r < BH; r++) for (let c = 0; c < BW; c++) if ((r + c) & 1) for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) g.set(x0 + c * cw + x, y0 + r * chh + y, '░', dark);
    // 大棋盤不畫格子，只在每格中心點一個淡點
    if (mode === 'big') { const dc = f.C(0.2); for (let r = 0; r < BH; r++) for (let c = 0; c < BW; c++) g.set(x0 + c * cw + (cw >> 1), y0 + r * chh + (chh >> 1), '·', dc); }
    if (mode === 'heat' || mode === 'num') {
      for (let i = 0; i <= kk && i < path.length; i++) {
        const c = path[i], X = x0 + (c % BW) * cw, Y = y0 + ((c / BW) | 0) * chh, cm = comet(i), lit = cm >= 0 && cm < 4;
        const col = lit ? cometCol(cm) : gcol(i, i === kk ? 0.3 : 0);
        if (mode === 'heat') { for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) g.set(X + x, Y + y, i === kk || lit ? '▓' : '█', col); }
        else {
          const str = String(i + 1);
          for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) g.set(X + x, Y + y, ((c % BW) + ((c / BW) | 0)) & 1 ? '░' : ' ', f.C(0.12 + (i / total) * 0.15));
          // 數字放在格子中間偏下，左上角留給騎士，不會互相蓋住
          if (str.length <= cw) g.text(X + Math.floor((cw - str.length) / 2), Y + (chh >= 2 ? Math.max(1, Math.floor((chh - 1) / 2)) : 0), str, lit ? col : gcol(i, i === kk ? 0.45 : 0.2));
        }
      }
    }
    const fu = mode === 'back' || kk + 1 >= path.length ? 0 : s.k - kk, eu = fu * fu * (3 - 2 * fu);
    const nx = kk + 1 < path.length ? path[kk + 1] : path[kk];
    const kx = lerp(cx(path[kk]), cx(nx), eu), ky = lerp(cy(path[kk]), cy(nx), eu);
    if (mode !== 'heat' && mode !== 'num') {
      D.clear();
      const pf = s.prev && mode !== 'back' ? 1 - (s.T - s.prevT) / 1.6 : 0;
      if (pf > 0) { const pv = s.prev; for (let i = 0; i + 1 < pv.length; i++) D.line(cx(pv[i]), cy(pv[i]), cx(pv[i + 1]), cy(pv[i + 1]), gcol(i, 0, pf * 0.8)); }
      else s.prev = null;
      for (let i = 0; i < kk && i + 1 < path.length; i++) {
        // 回溯模式：新長出的線段 0.9 秒內由暗變亮，來回試探的線段就不會閃爍刺眼
        const m = mode === 'back' ? 0.15 + 0.85 * Math.min(1, (s.T - s.born[i + 1]) / 0.9) ** 2 : 1, cm = comet(i);
        D.line(cx(path[i]), cy(path[i]), cx(path[i + 1]), cy(path[i + 1]), cm >= 0 && cm < 5 ? cometCol(cm) : gcol(i, i >= kk - 1 ? 0.25 : 0, m));
      }
      if (eu > 0) D.line(cx(path[kk]), cy(path[kk]), kx, ky, gcol(kk, 0.3));
      if (s.closed && s.hold > 0) D.line(cx(path[path.length - 1]), cy(path[path.length - 1]), cx(path[0]), cy(path[0]), gcol(total, 0.2));
      // 封閉巡遊完成後，一道光沿著路線繞行
      if (s.closed && s.hold > 0) for (let q = 0; q < 6; q++) { const i = Math.floor(s.orbit + q) % path.length, j = (i + 1) % path.length; D.line(cx(path[i]), cy(path[i]), cx(path[j]), cy(path[j]), hv(s, f, 50, 0.9, 1)); }
      D.flush(g);
      if (mode === 'back' && cw >= 3) for (let i = 0; i < path.length; i++) {
        const c = path[i], m = i ? 0.2 + 0.8 * Math.min(1, (s.T - s.born[i]) / 0.9) ** 2 : 1;
        g.text(x0 + (c % BW) * cw + 1, y0 + ((c / BW) | 0) * chh, String(i + 1), gcol(i, 0.15, m));
      }
    }
    // 騎士
    let KX = kx / 2, KY = ky / 4;
    if (s.closed && s.hold > 0) { const c2 = path[Math.floor(s.orbit + 6) % path.length]; KX = cx(c2) / 2; KY = cy(c2) / 4; }
    if (mode === 'num') { KX -= cw / 2 - 0.5; KY -= chh / 2 - 0.5; }
    const kc = hv(s, f, 45, 0.92, 1);
    // 編號模式的格子夠寬時，左上角的馬（7 格寬）和置中的數字（從第 7 格起）不會重疊
    if (mode === 'num' ? cw >= 17 && chh >= 4 : cw >= 9 && chh >= 4) pixArt(g, mode === 'num' ? Math.floor(KX) : Math.round(KX - 3.5), mode === 'num' ? Math.floor(KY) : Math.round(KY - 2), HORSE, 1, kc);
    else g.set(KX, KY, '◆', kc);
    const label = mode === 'back'
      ? tr(f, '騎士巡遊暴力回溯  ' + BW + '×' + BH + '  嘗試 ' + s.steps + '  退回 ' + s.backs + '  深度 ' + path.length,
        "Knight's Tour Backtracking  " + BW + '×' + BH + '  tries ' + s.steps + '  backtracks ' + s.backs + '  depth ' + path.length)
      : tr(f, (s.closed ? '封閉' : '') + '騎士巡遊  ' + BW + '×' + BH + '  第 ' + (kk + 1) + ' / ' + N + ' 格',
        (s.closed ? "Closed Knight's Tour  " : "Knight's Tour  ") + BW + '×' + BH + '  square ' + (kk + 1) + ' / ' + N);
    tag(g, Math.max(1, x0), Math.max(0, y0 - 1), label, f.C(0.85));
  } });

/* ════════ 10. 數獨解題 ════════ */
const SD_FONT = { 0: '####.##.##.####', 1: '.#.##..#..#.###', 2: '###..#####..###', 3: '###..#.##..####', 4: '#.##.####..#..#', 5: '####..###..####', 6: '####..####.####',
  7: '###..#.#..#..#.', 8: '####.#####.####', 9: '####.####..####', A: '.#.#.#####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###', F: '####..##.#..#..' };
const POP = new Uint8Array(1 << 17);
for (let i = 1; i < POP.length; i++) POP[i] = POP[i >> 1] + (i & 1);
function sdNew(S, BR, BC, diag) {
  const N = S * S, B = { S, BR, BC, N, diag, g: new Int8Array(N), giv: new Uint8Array(N), rm: new Int32Array(S), cm: new Int32Array(S), bm: new Int32Array(S), dm: new Int32Array(2),
    boxOf: new Int32Array(N), bad: new Float32Array(N), hot: new Float32Array(N), cur: -1, tries: 0, backs: 0, filled: 0, full: (1 << (S + 1)) - 2, units: [], hist: [], how: '' };
  for (let i = 0; i < N; i++) { const r = Math.floor(i / S), c = i % S; B.boxOf[i] = Math.floor(r / BR) * (S / BC) + Math.floor(c / BC); }
  for (let r = 0; r < S; r++) B.units.push(Array.from({ length: S }, (_, c) => r * S + c));
  for (let c = 0; c < S; c++) B.units.push(Array.from({ length: S }, (_, r) => r * S + c));
  for (let b = 0; b < S; b++) B.units.push(Array.from({ length: N }, (_, i) => i).filter(i => B.boxOf[i] === b));
  if (diag) { B.units.push(Array.from({ length: S }, (_, k) => k * S + k)); B.units.push(Array.from({ length: S }, (_, k) => k * S + S - 1 - k)); }
  return B;
}
function sdCand(B, i) {
  const S = B.S, r = Math.floor(i / S), c = i % S;
  let m = B.rm[r] | B.cm[c] | B.bm[B.boxOf[i]];
  if (B.diag) { if (r === c) m |= B.dm[0]; if (r + c === S - 1) m |= B.dm[1]; }
  return B.full & ~m;
}
function sdSet(B, i, d, on) {
  const S = B.S, r = Math.floor(i / S), c = i % S, bit = 1 << d;
  if (on) { B.g[i] = d; B.rm[r] |= bit; B.cm[c] |= bit; B.bm[B.boxOf[i]] |= bit; if (B.diag) { if (r === c) B.dm[0] |= bit; if (r + c === S - 1) B.dm[1] |= bit; } B.filled++; B.hot[i] = 1; }
  else { B.g[i] = 0; B.rm[r] &= ~bit; B.cm[c] &= ~bit; B.bm[B.boxOf[i]] &= ~bit; if (B.diag) { if (r === c) B.dm[0] &= ~bit; if (r + c === S - 1) B.dm[1] &= ~bit; } B.filled--; }
}
function sdMRVCell(B) {
  let best = -1, bm = 0, bc = 99;
  for (let i = 0; i < B.N; i++) if (!B.g[i]) { const m = sdCand(B, i), c = POP[m]; if (c < bc) { bc = c; best = i; bm = m; if (c <= 1) break; } }
  return [best, bm, bc];
}
function sdDigits(m, S, rand) { const a = []; for (let d = 1; d <= S; d++) if (m & (1 << d)) a.push(d); return rand ? shuffle(a) : a; }
// 先隨機填滿一整盤（不播放），再挖空當作題目
function sdFillFast(B, budget) {
  const [i, m, c] = sdMRVCell(B);
  if (i < 0) return true;
  if (c === 0 || budget.n-- <= 0) return false;
  for (const d of sdDigits(m, B.S, true)) { sdSet(B, i, d, true); if (sdFillFast(B, budget)) return true; sdSet(B, i, d, false); }
  return false;
}
function sdPuzzle(B, givens) {
  for (let t = 0; t < 30; t++) {
    B.g.fill(0); B.rm.fill(0); B.cm.fill(0); B.bm.fill(0); B.dm.fill(0); B.filled = 0;
    if (sdFillFast(B, { n: 30000 })) break;
  }
  const order = shuffle(Array.from({ length: B.N }, (_, i) => i));
  for (let k = 0; k < B.N - givens; k++) sdSet(B, order[k], B.g[order[k]], false);
  for (let i = 0; i < B.N; i++) B.giv[i] = B.g[i] ? 1 : 0;
  B.hot.fill(0); B.bad.fill(0); B.tries = B.backs = 0;
}
function* sdMRV(B, rand) {
  const [i, m, c] = sdMRVCell(B);
  if (i < 0) return true;
  if (c === 0) return false;
  for (const d of sdDigits(m, B.S, rand)) {
    sdSet(B, i, d, true); B.cur = i; B.tries++; B.how = c === 1 ? ['唯一候選', 'single candidate'] : ['猜 ' + c + ' 選 1', 'guess 1 of ' + c]; yield;
    if (yield* sdMRV(B, rand)) return true;
    sdSet(B, i, d, false); B.backs++; B.bad[i] = 1; B.cur = i; yield;
  }
  return false;
}
function* sdNaive(B, from) {
  let i = from;
  while (i < B.N && B.g[i]) i++;
  if (i >= B.N) return true;
  const ok = sdCand(B, i);
  for (let d = 1; d <= B.S; d++) {
    if (!(ok & (1 << d))) continue;
    sdSet(B, i, d, true); B.cur = i; B.tries++; yield;
    if (yield* sdNaive(B, i + 1)) return true;
    sdSet(B, i, d, false); B.backs++; B.bad[i] = 1; B.cur = i; yield;
  }
  return false;
}
function* sdLogic(B) {
  const placed = [];
  const undo = () => { while (placed.length) { const i = placed.pop(); sdSet(B, i, B.g[i], false); } };
  for (;;) {
    let hit = -1, hd = 0, dead = false;
    for (let i = 0; i < B.N && hit < 0; i++) if (!B.g[i]) { const m = sdCand(B, i); if (!m) { dead = true; break; } if (POP[m] === 1) { hit = i; hd = 31 - Math.clz32(m); B.how = ['唯一候選', 'single candidate']; } }
    if (!dead && hit < 0) {
      for (const u of B.units) {
        let seen = 0;
        for (const i of u) if (B.g[i]) seen |= 1 << B.g[i];
        for (let d = 1; d <= B.S && hit < 0; d++) {
          if (seen & (1 << d)) continue;
          let cnt = 0, at = -1;
          for (const i of u) if (!B.g[i] && sdCand(B, i) & (1 << d)) { cnt++; at = i; }
          if (cnt === 0) { dead = true; break; }
          if (cnt === 1) { hit = at; hd = d; B.how = ['隱藏唯一', 'hidden single']; }
        }
        if (hit >= 0 || dead) break;
      }
    }
    if (dead) { undo(); B.backs++; return false; }
    if (hit < 0) break;
    sdSet(B, hit, hd, true); placed.push(hit); B.cur = hit; B.tries++; yield;
  }
  const [i, m, c] = sdMRVCell(B);
  if (i < 0) return true;
  if (c === 0) { undo(); return false; }
  for (const d of sdDigits(m, B.S, false)) {
    sdSet(B, i, d, true); B.cur = i; B.tries++; B.how = ['猜測', 'guess']; yield;
    if (yield* sdLogic(B)) return true;
    sdSet(B, i, d, false); B.backs++; B.bad[i] = 1; B.cur = i; yield;
  }
  undo();
  return false;
}
// 版面：一般模式每格之間都有細線；空間不夠時改用精簡模式，只畫宮格的粗線
function sdLayout(B, x0, y0, w, h, aspect) {
  const S = B.S, compact = (h - S - 1) / S < 1;
  const nH = compact ? S / B.BR + 1 : S + 1, nV = compact ? S / B.BC + 1 : S + 1;
  let ch = Math.max(1, Math.floor((h - nH) / S)), cw = Math.max(1, Math.round((ch + (compact ? 0 : 1)) * aspect) - (compact ? 0 : 1));
  if (S * cw + nV > w) cw = Math.max(1, Math.floor((w - nV) / S));
  Object.assign(B, { cw, ch, compact, W: S * cw + nV, H: S * ch + nH });
  B.x0 = x0 + Math.floor((w - B.W) / 2); B.y0 = y0 + Math.max(0, Math.floor((h - B.H) / 2));
}
const sdHasV = (B, k) => !B.compact || k % B.BC === 0, sdHasH = (B, k) => !B.compact || k % B.BR === 0;
const sdIX = (B, c) => B.x0 + c * B.cw + (B.compact ? Math.floor(c / B.BC) + 1 : c + 1);
const sdIY = (B, r) => B.y0 + r * B.ch + (B.compact ? Math.floor(r / B.BR) + 1 : r + 1);
const sdGlyph = (B, d) => (B.S > 9 ? (d - 1).toString(16).toUpperCase() : String(d));
function sdDraw(g, f, s, B, pencil, dt, wave) {
  const { S, BR, BC, cw, ch, x0, y0 } = B, thin = f.C(0.22), thick = f.C(0.62);
  for (let i = 0; i < B.N; i++) { B.bad[i] = Math.max(0, B.bad[i] - dt * 1.6); B.hot[i] = Math.max(0, B.hot[i] - dt * 1.2); }
  const LX = k => (k < S ? sdIX(B, k) : sdIX(B, S - 1) + cw + 1) - 1, LY = k => (k < S ? sdIY(B, k) : sdIY(B, S - 1) + ch + 1) - 1;
  for (let r = 0; r <= S; r++) for (let c = 0; c <= S; c++) {
    const hE = sdHasH(B, r), vE = sdHasV(B, c), hT = r % BR === 0, vT = c % BC === 0, x = LX(c), y = LY(r);
    if (hE && vE) { const bits = (r > 0 ? 1 : 0) | (r < S ? 2 : 0) | (c > 0 ? 4 : 0) | (c < S ? 8 : 0); g.set(x, y, BOXJ[bits], hT || vT ? thick : thin); }
    if (hE && c < S) for (let q = 1; q <= cw; q++) g.set(x + q, y, '─', hT ? thick : thin);
    if (vE && r < S) for (let q = 1; q <= ch; q++) g.set(x, y + q, '│', vT ? thick : thin);
  }
  const big = ch >= 5 && cw >= 5, pw = cw >= 10 ? 2 : 1, solC = hv(s, f, 195, 0.68, 0.72), givC = f.C(0.95), pen = f.C(0.4);
  for (let i = 0; i < B.N; i++) {
    const r = Math.floor(i / S), c = i % S, X = sdIX(B, c), Y = sdIY(B, r), d = B.g[i];
    let bg = null, bgc = null;
    if (B.bad[i] > 0.05) { bg = B.bad[i] > 0.5 ? '▒' : '░'; bgc = hv(s, f, 0, 0.3 + B.bad[i] * 0.3, 0.2 + B.bad[i] * 0.3); }
    else if (i === B.cur) { bg = '░'; bgc = hv(s, f, 60, 0.45, 0.4); }
    else if (B.diag && (r === c || r + c === S - 1)) { bg = '·'; bgc = f.C(0.2); }
    if (bg) for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) if (bg !== '·' || (xx === (cw >> 1) && yy === (ch >> 1))) g.set(X + xx, Y + yy, bg, bgc);
    if (d) {
      let col = B.giv[i] ? givC : B.hot[i] > 0.3 ? hv(s, f, 60, 0.85, 1) : solC;
      if (wave) { const w = Math.sin(s.T * 3 - (r + c) * 0.55); if (w > 0.6) col = hv(s, f, 60 + w * 20, 0.6 + w * 0.3, 0.8 + w * 0.2); }
      const gl = sdGlyph(B, d);
      if (big) {
        const font = SD_FONT[gl], gx = X + Math.floor((cw - 3 * pw) / 2), gy = Y + Math.floor((ch - 5) / 2);
        for (let py = 0; py < 5; py++) for (let px = 0; px < 3; px++) if (font[py * 3 + px] === '#') for (let q = 0; q < pw; q++) g.set(gx + px * pw + q, gy + py, '█', col);
      } else g.set(X + Math.floor((cw - 1) / 2), Y + Math.floor((ch - 1) / 2), gl, col);
    } else if (pencil) {
      const m = sdCand(B, i);
      if (ch >= 3 && cw >= 5 && S <= 9) {
        for (let k = 1; k <= S; k++) if (m & (1 << k)) g.set(X + Math.floor(((k - 1) % 3) * (cw / 3) + cw / 6), Y + Math.floor(Math.floor((k - 1) / 3) * (ch / 3) + ch / 6), String(k), pen);
      } else g.set(X + Math.floor((cw - 1) / 2), Y + Math.floor((ch - 1) / 2), ' .:-=+*#%@'[Math.min(9, POP[m])], pen);
    }
  }
}
A({ id: 'al-sudoku', name: '數獨解題', cat: CAT, theme: 'ice', hue: true, desc: '最少候選優先的回溯法解數獨',
  params: { mode: 'mrv', S: 9, givens: 27, rate: 9 },
  variants: [
    { id: 'pencil', name: '鉛筆註記', theme: 'paper', hue: false, desc: '候選數字一個個被劃掉的推理', params: { mode: 'logic', givens: 26, rate: 4 } },
    { id: 'naive', name: '暴力', theme: 'matrix', desc: '照順序一格格硬試的暴力回溯', params: { mode: 'naive', givens: 38, rate: 45 } },
    { id: 'hex', name: '十六宮', theme: 'cyber', desc: '十六進位的 16×16 大數獨', params: { mode: 'mrv', S: 16, givens: 132, rate: 14 } },
    { id: 'multi', name: '多盤', theme: 'mint', desc: '小型 4×4 與 6×6 數獨同時解題', params: { mode: 'multi', rate: 5 } },
    { id: 'fill', name: '從零填滿', theme: 'gold', desc: '從空白棋盤隨機填出完整解答', params: { mode: 'fill', givens: 0, rate: 14 } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows, aspect } = f;
    s.T = 0;
    if (p.mode === 'multi') {
      const gc = cols >= 150 ? 4 : 2, gr = rows >= 40 ? 2 : 1, bw = Math.floor(cols / gc), bh = Math.floor(rows / gr);
      s.boards = [];
      for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) {
        const six = (i + j) % 2 === 0, B = sdNew(six ? 6 : 4, 2, six ? 3 : 2, false);
        sdPuzzle(B, six ? rint(10, 14) : rint(5, 7));
        sdLayout(B, i * bw + 1, j * bh + 1, bw - 2, bh - 2, aspect);
        B.gen = sdMRV(B, false); B.acc = 0; B.hold = 0; B.rate = p.rate * rnd(0.7, 1.4); B.cell = [i * bw + 1, j * bh + 1, bw - 2, bh - 2];
        s.boards.push(B);
      }
      return;
    }
    const S = p.S, BR = S === 16 ? 4 : 3, B = sdNew(S, BR, BR, !!p.diag);
    if (p.mode !== 'fill') sdPuzzle(B, p.givens);
    s.panel = cols >= 150;
    sdLayout(B, 1, 1, s.panel ? cols - 46 : cols - 2, rows - 2, aspect);
    if (s.panel) B.x0 = Math.max(2, Math.floor((cols - 44 - B.W) / 2));
    B.gen = p.mode === 'naive' ? sdNaive(B, 0) : p.mode === 'logic' ? sdLogic(B) : sdMRV(B, p.mode === 'fill');
    s.B = B; s.hold = 0; s.acc = 0; s.hs = 0;
    // 回溯的步數分布有很長的尾巴：解太久就隨機重啟、逐漸加速，真的太難就換一題
    s.solved = false; s.solveT = 0; s.since = 0; s.restarts = 0; s.cap = S === 16 ? 800 : 250;
  },
  frame(s, f) {
    const p = f.p, g = f.g, dt = f.dt;
    themed(s, f, this);
    s.T += dt;
    if (p.mode === 'multi') {
      for (let bi = 0; bi < s.boards.length; bi++) {
        let B = s.boards[bi];
        if (B.hold > 0) {
          B.hold -= dt;
          if (B.hold <= 0) {
            const six = B.S === 6, nb = sdNew(B.S, 2, six ? 3 : 2, false);
            sdPuzzle(nb, six ? rint(10, 14) : rint(5, 7)); sdLayout(nb, ...B.cell, f.aspect);
            Object.assign(nb, { gen: sdMRV(nb, false), acc: 0, hold: 0, rate: B.rate, cell: B.cell });
            B = s.boards[bi] = nb;
          }
        } else {
          let k = due(B, dt, B.rate, 20);
          while (k-- > 0) if (B.gen.next().done) { B.hold = 2.5; B.cur = -1; break; }
        }
        sdDraw(g, f, s, B, true, dt, B.hold > 0);
      }
      return;
    }
    const B = s.B;
    if (s.hold > 0) { s.hold -= dt; if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); } }
    else {
      s.solveT += dt;
      // 超過 25 秒還沒解開就逐漸加速（最多 6 倍）
      const sp = p.mode === 'naive' ? 1 + Math.min(6, B.tries / 400) : 1 + Math.min(5, Math.max(0, s.solveT - 25) / 10);
      let k = due(s, dt, p.rate * sp, 300);
      while (k-- > 0) {
        if (B.gen.next().done) { s.hold = 4; s.solved = true; B.cur = -1; break; }
        s.since++;
        if (s.solveT > 150) { s.hold = 2.5; B.cur = -1; break; }
        if (p.mode === 'mrv' && s.since > s.cap) {
          // 隨機重啟：清回題目，換一個隨機的數字嘗試順序重新搜尋
          for (let i = 0; i < B.N; i++) if (B.g[i] && !B.giv[i]) { sdSet(B, i, B.g[i], false); B.bad[i] = 0.45; }
          B.gen = sdMRV(B, true); B.cur = -1; s.since = 0; s.cap = Math.round(s.cap * 1.5); s.restarts++;
          break;
        }
      }
    }
    s.hs += dt;
    if (s.hs > 0.12) { s.hs = 0; B.hist.push(B.filled); if (B.hist.length > 400) B.hist.shift(); }
    sdDraw(g, f, s, B, p.mode === 'logic', dt, s.hold > 0 && s.solved);
    const nm = p.mode === 'naive' ? tr(f, '暴力回溯', 'brute-force backtracking') : p.mode === 'logic' ? tr(f, '推理＋猜測', 'logic + guessing')
      : p.mode === 'fill' ? tr(f, '隨機填滿', 'random fill') : tr(f, '最少候選優先', 'fewest candidates first');
    const title = (B.S === 16 ? tr(f, '16×16 數獨  ', '16×16 Sudoku  ') : p.diag ? tr(f, '對角線數獨  ', 'Diagonal Sudoku  ') : tr(f, '數獨  ', 'Sudoku  ')) + nm;
    if (s.panel) {
      const px = B.x0 + B.W + 4, pw = Math.min(40, f.cols - px - 2), py = B.y0, ph = Math.max(6, Math.floor(B.H * 0.45));
      g.text(px, py, title, f.C(0.9));
      g.text(px, py + 2, tr(f, '嘗試 ', 'Tries ') + B.tries, f.C(0.7));
      g.text(px, py + 3, tr(f, '回溯 ', 'Backtracks ') + B.backs + (s.restarts ? tr(f, '  隨機重啟 ' + s.restarts + ' 次', '  random restarts ' + s.restarts) : ''), f.C(0.7));
      g.text(px, py + 4, tr(f, '已填 ', 'Filled ') + B.filled + ' / ' + B.N, f.C(0.7));
      if (B.how && s.hold <= 0) g.text(px, py + 5, tr(f, B.how[0], B.how[1]), hv(s, f, 60, 0.7, 0.8));
      if (s.hold > 0) g.text(px, py + 5, s.solved ? tr(f, '解開了！', 'Solved!') : tr(f, '這題太難，換一題', 'Too hard, trying a new puzzle'), s.solved ? hv(s, f, 130, 0.8, 1) : f.C(0.6));
      const cy = py + 8, hist = B.hist, n = Math.min(pw, hist.length);
      g.text(px, cy, tr(f, '已填格數變化', 'Filled cells over time'), f.C(0.5));
      for (let k = 0; k < n; k++) {
        const v = hist[hist.length - n + k] / B.N, e8 = Math.round(v * ph * 8), x = px + pw - n + k, col = hv(s, f, 195 + v * 80, 0.35 + v * 0.35, 0.3 + v * 0.6);
        for (let r = 0; r < ph; r++) { const lv = e8 - r * 8; if (lv <= 0) break; g.set(x, cy + ph - r, lv >= 8 ? '█' : EIGHTH[lv], col); }
      }
      for (let x = px; x < px + pw; x++) g.set(x, cy + ph + 1, '─', f.C(0.25));
    } else {
      const str = title + tr(f, '  嘗試 ', '  tries ') + B.tries + tr(f, '  回溯 ', '  backtracks ') + B.backs + (s.restarts ? tr(f, '  重啟 ', '  restarts ') + s.restarts : '');
      // 英文標籤比較長：太靠右時往左移，免得超出畫面（中文維持原位）
      tag(g, f.lang === 'en' ? Math.max(1, Math.min(B.x0, f.cols - 1 - g.textW(str))) : B.x0, Math.max(0, B.y0 - 1), str, f.C(0.85));
    }
  } });

/* ════════ 11. 凸包 ════════ */
// 點座標用點字子像素（近似正方形），y 向下；ccw 是 y 向上時的外積（>0 表示左轉）
const ccw = (o, a, b) => -((a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]));
function ptsGen(W, H, n, dist) {
  const P = [], mx = 10, my = 14, cx = W / 2, cy = (H + my) / 2, R = Math.min(W / 2 - mx, (H - my) / 2 - 6);
  const cl = Array.from({ length: rint(3, 6) }, () => [rnd(mx + R * 0.4, W - mx - R * 0.4), rnd(my + R * 0.4, H - 6 - R * 0.4), rnd(0.08, 0.2) * R]);
  for (let k = 0; k < n; k++) {
    let x, y;
    if (dist === 'disk') { const r = R * Math.sqrt(Math.random()), a = rnd(0, TAU); x = cx + Math.cos(a) * r * 1.6; y = cy + Math.sin(a) * r; }
    else if (dist === 'gauss') { x = cx + gauss() * R * 0.55; y = cy + gauss() * R * 0.32; }
    else if (dist === 'ring') { const r = R * rnd(0.55, 1), a = rnd(0, TAU); x = cx + Math.cos(a) * r * 1.7; y = cy + Math.sin(a) * r; }
    else if (dist === 'clusters') { const c = pick(cl); x = c[0] + gauss() * c[2] * 1.5; y = c[1] + gauss() * c[2]; }
    else { x = rnd(mx, W - mx); y = rnd(my, H - 6); }
    P.push([clamp(x, 4, W - 5), clamp(y, my, H - 5)]);
  }
  return P;
}
function monoHull(P, idx) {
  const ids = idx.slice().sort((a, b) => P[a][0] - P[b][0] || P[a][1] - P[b][1]);
  if (ids.length < 3) return ids;
  const lo = [], up = [];
  for (const i of ids) { while (lo.length >= 2 && ccw(P[lo[lo.length - 2]], P[lo[lo.length - 1]], P[i]) <= 0) lo.pop(); lo.push(i); }
  for (let k = ids.length - 1; k >= 0; k--) { const i = ids[k]; while (up.length >= 2 && ccw(P[up[up.length - 2]], P[up[up.length - 1]], P[i]) <= 0) up.pop(); up.push(i); }
  lo.pop(); up.pop();
  return lo.concat(up);
}
const HULL = {
  *jarvis(S) {
    const P = S.P, n = P.length;
    let l = 0;
    for (let i = 1; i < n; i++) if (P[i][0] < P[l][0]) l = i;
    let p = l;
    S.hull = [l];
    for (let guard = 0; guard <= n; guard++) {
      let q = (p + 1) % n;
      S.from = p; S.cand = q;
      for (let r = 0; r < n; r++) { S.test = r; if (ccw(P[p], P[q], P[r]) < 0) { q = r; S.cand = q; } yield; }
      S.test = -1;
      if (q === l) break;
      S.hull.push(q); p = q; yield;
    }
  },
  *graham(S) {
    const P = S.P, n = P.length;
    let pv = 0;
    for (let i = 1; i < n; i++) if (P[i][1] > P[pv][1] || (P[i][1] === P[pv][1] && P[i][0] < P[pv][0])) pv = i;
    const ord = [];
    for (let i = 0; i < n; i++) if (i !== pv) ord.push(i);
    const ang = i => Math.atan2(P[pv][1] - P[i][1], P[i][0] - P[pv][0]);
    ord.sort((a, b) => ang(a) - ang(b));
    S.pivot = pv; S.fan = ord;
    for (let k = 0; k <= ord.length; k += 2) { S.fanN = k; yield; }
    const st = [pv, ord[0]];
    for (let k = 1; k < ord.length; k++) {
      const r = ord[k];
      S.test = r;
      while (st.length >= 2 && ccw(P[st[st.length - 2]], P[st[st.length - 1]], P[r]) <= 0) { st.pop(); S.hull = st.slice(); S.popped = 1; yield; }
      st.push(r); S.hull = st.slice(); yield;
    }
    S.test = -1; S.fan = null;
  },
  *mono(S) {
    const P = S.P, ids = P.map((_, i) => i).sort((a, b) => P[a][0] - P[b][0] || P[a][1] - P[b][1]), lo = [], up = [];
    for (const i of ids) {
      S.sweep = P[i][0]; S.test = i;
      while (lo.length >= 2 && ccw(P[lo[lo.length - 2]], P[lo[lo.length - 1]], P[i]) <= 0) { lo.pop(); S.chain = lo.slice(); S.popped = 1; yield; }
      lo.push(i); S.chain = lo.slice(); yield;
    }
    S.lower = lo.slice();
    for (let k = ids.length - 1; k >= 0; k--) {
      const i = ids[k];
      S.sweep = P[i][0]; S.test = i;
      while (up.length >= 2 && ccw(P[up[up.length - 2]], P[up[up.length - 1]], P[i]) <= 0) { up.pop(); S.chain = up.slice(); S.popped = 1; yield; }
      up.push(i); S.chain = up.slice(); yield;
    }
    S.lower = null; S.chain = null; S.sweep = -1; S.test = -1;
    lo.pop(); up.pop(); S.hull = lo.concat(up);
  },
  *quick(S) {
    const P = S.P, n = P.length;
    let a = 0, b = 0;
    for (let i = 1; i < n; i++) { if (P[i][0] < P[a][0]) a = i; if (P[i][0] > P[b][0]) b = i; }
    S.hull = [a, b]; S.dead = new Uint8Array(n);
    const above = [], below = [];
    for (let i = 0; i < n; i++) { if (ccw(P[a], P[b], P[i]) > 0) above.push(i); else if (ccw(P[b], P[a], P[i]) > 0) below.push(i); }
    yield;
    const st = [[b, a, below], [a, b, above]];
    while (st.length) {
      const [u, v, set] = st.pop();
      if (!set.length) continue;
      let c = set[0];
      for (const i of set) if (ccw(P[u], P[v], P[i]) > ccw(P[u], P[v], P[c])) c = i;
      // 與 u–v 平行的掃描線往外推，碰到的第一個點就是最遠點
      const L = Math.hypot(P[v][0] - P[u][0], P[v][1] - P[u][1]) || 1, far = ccw(P[u], P[v], P[c]) / L;
      for (let k = 1; k <= 10; k++) { S.sweepL = [u, v, far, k]; yield; }
      S.sweepL = null;
      S.tri = [u, v, c]; yield; yield;
      S.hull.splice(S.hull.indexOf(u) + 1, 0, c);
      const s1 = [], s2 = [];
      for (const i of set) { if (i === c) continue; if (ccw(P[u], P[c], P[i]) > 0) s1.push(i); else if (ccw(P[c], P[v], P[i]) > 0) s2.push(i); else S.dead[i] = 1; }
      yield;
      st.push([c, v, s2], [u, c, s1]);
    }
    S.tri = null;
  },
  *onion(S) {
    const P = S.P;
    let rest = P.map((_, i) => i);
    S.layers = [];
    while (rest.length >= 3) {
      const h = monoHull(P, rest);
      for (let k = 1; k <= h.length; k++) { S.cur = h.slice(0, k); yield; }
      S.layers.push(h); S.cur = null;
      const on = new Set(h);
      rest = rest.filter(i => !on.has(i));
      yield;
    }
    if (rest.length) S.layers.push(rest);
    S.hull = [];
  },
};
const HULL_NAME = { jarvis: '禮品包裝法', graham: '葛立恆掃描', mono: '單調鏈', quick: '快速凸包', onion: '洋蔥剝皮', dyn: '動態凸包', caliper: '旋轉卡尺' };
const HULL_NAME_EN = { jarvis: 'Gift Wrapping', graham: 'Graham Scan', mono: 'Monotone Chain', quick: 'Quickhull', onion: 'Onion Peeling', dyn: 'Dynamic Hull', caliper: 'Rotating Calipers' };
A({ id: 'al-hull', name: '凸包', cat: CAT, theme: 'ocean', hue: true, desc: '禮品包裝法一條邊一條邊包住所有點',
  params: { alg: 'jarvis', dist: 'uniform', dens: 1.3, secs: 12 },
  variants: [
    { id: 'graham', name: '葛立恆', theme: 'gold', desc: '依角度排序後用堆疊掃描', params: { alg: 'graham', dist: 'disk', secs: 12 } },
    { id: 'mono', name: '單調鏈', theme: 'mint', desc: '掃描線由左到右建出上下兩條鏈', params: { alg: 'mono', dist: 'gauss', dens: 1.4, secs: 12 } },
    { id: 'onion', name: '洋蔥', theme: 'lavender', desc: '一層層剝下凸包，像洋蔥的年輪', params: { alg: 'onion', dist: 'gauss', dens: 1.8, secs: 16 } },
    { id: 'dyn', name: '動態', theme: 'cyber', desc: '游動的點群，凸包像橡皮筋即時變形', params: { alg: 'dyn', dist: 'uniform', dens: 0.7 } },
    { id: 'caliper', name: '旋轉卡尺', theme: 'blueprint', desc: '旋轉卡尺找出最小外接矩形', params: { alg: 'caliper', dist: 'ring', dens: 0.8 } },
  ],
  init(s, f) {
    const p = f.p, W = f.cols * 2, H = f.rows * 4;
    s.W = W; s.H = H; s.D = new Dots(f.cols, f.rows); s.T = 0;
    const n = clamp(Math.round(((W * H) / 2600) * p.dens), 22, 180);
    s.P = ptsGen(W, H, n, p.dist);
    s.S = { P: s.P, hull: [], from: -1, cand: -1, test: -1 };
    s.hold = 0; s.acc = 0; s.minA = Infinity;
    if (p.alg === 'dyn') { s.V = s.P.map(() => { const a = rnd(0, TAU), v = rnd(4, 14); return [Math.cos(a) * v, Math.sin(a) * v * 0.6]; }); return; }
    if (p.alg === 'caliper') { s.hullC = monoHull(s.P, s.P.map((_, i) => i)); return; }
    // 先空跑一次數出總步數，讓每種演算法大約都播 secs 秒
    const dry = { P: s.P, hull: [] }, it = HULL[p.alg](dry);
    let cnt = 0;
    while (!it.next().done) cnt++;
    s.rate = Math.max(5, cnt / p.secs);
    s.gen = HULL[p.alg](s.S);
  },
  frame(s, f) {
    const p = f.p, g = f.g, dt = f.dt, D = s.D, S = s.S, P = s.P, alg = p.alg;
    themed(s, f, this);
    s.T += dt;
    const ptDim = f.C(0.35), ptOn = hv(s, f, 45, 0.9, 1), edge = hv(s, f, 185, 0.65, 0.85), acc = hv(s, f, 330, 0.65, 0.8), faint = f.C(0.2), grid = f.C(0.1);
    for (let y = 2; y < f.rows; y += 4) for (let x = 0; x < f.cols; x += 8) g.set(x, y, '+', grid);
    D.clear();
    let hullPts = S.hull, closed = false;
    if (alg === 'dyn') {
      for (let i = 0; i < P.length; i++) {
        const q = P[i], v = s.V[i];
        q[0] += v[0] * dt; q[1] += v[1] * dt;
        if (q[0] < 4 || q[0] > s.W - 5) { v[0] = -v[0]; q[0] = clamp(q[0], 4, s.W - 5); }
        if (q[1] < 14 || q[1] > s.H - 5) { v[1] = -v[1]; q[1] = clamp(q[1], 14, s.H - 5); }
        const a = Noise.n3(i * 0.37, s.T * 0.2, 3) * 0.6 * dt; const c = Math.cos(a), sn = Math.sin(a); const vx = v[0]; v[0] = vx * c - v[1] * sn; v[1] = vx * sn + v[1] * c;
      }
      hullPts = monoHull(P, P.map((_, i) => i)); closed = true;
    } else if (alg === 'caliper') {
      s.hold += dt;
      if (s.hold > 22) { this.init(s, f); return this.frame(s, f); }
      hullPts = s.hullC; closed = true;
    } else if (s.hold > 0) {
      s.hold -= dt; closed = true;
      if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); }
    } else {
      let k = due(s, dt, s.rate, 400);
      while (k-- > 0) if (s.gen.next().done) { s.hold = 3.5; S.test = S.from = S.cand = -1; break; }
      hullPts = S.hull;
    }
    // 輔助線
    if (S.fan && alg === 'graham') for (let k = 0; k < Math.min(S.fanN || 0, S.fan.length); k++) { const q = P[S.fan[k]]; D.line(P[S.pivot][0], P[S.pivot][1], q[0], q[1], faint); }
    if (alg === 'mono' && S.sweep >= 0 && s.hold <= 0) D.line(S.sweep, 10, S.sweep, s.H - 2, faint);
    if (alg === 'mono' && S.lower) for (let k = 0; k + 1 < S.lower.length; k++) D.line(P[S.lower[k]][0], P[S.lower[k]][1], P[S.lower[k + 1]][0], P[S.lower[k + 1]][1], edge);
    if (alg === 'mono' && S.chain) for (let k = 0; k + 1 < S.chain.length; k++) D.line(P[S.chain[k]][0], P[S.chain[k]][1], P[S.chain[k + 1]][0], P[S.chain[k + 1]][1], edge);
    if (alg === 'quick' && S.sweepL) {
      const [u, v, far, sk] = S.sweepL, d = (far * Math.min(10, sk - 1 + (s.acc || 0))) / 10, dx = P[v][0] - P[u][0], dy = P[v][1] - P[u][1], L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L;
      D.line(P[u][0] + nx * d - dx * 0.15, P[u][1] + ny * d - dy * 0.15, P[v][0] + nx * d + dx * 0.15, P[v][1] + ny * d + dy * 0.15, hv(s, f, 300, 0.5, 0.55));
    }
    if (alg === 'quick' && S.tri) { const [u, v, c] = S.tri; D.line(P[u][0], P[u][1], P[c][0], P[c][1], acc); D.line(P[c][0], P[c][1], P[v][0], P[v][1], acc); D.line(P[u][0], P[u][1], P[v][0], P[v][1], faint); }
    if (alg === 'onion' && S.layers) {
      const L = S.layers;
      const sh = s.hold > 0 ? Math.sin(s.T * 2) * 0.5 + 0.5 : 0;
      L.forEach((h, li) => { const ph = s.hold > 0 ? Math.sin(s.T * 2.5 - li * 0.8) * 0.15 : 0, col = hv(s, f, 200 + li * 28 + sh * 30, 0.55 + ph, 0.35 + 0.6 * (1 - li / Math.max(4, L.length + 2)) + ph); for (let k = 0; k < h.length && h.length > 2; k++) { const a = P[h[k]], b = P[h[(k + 1) % h.length]]; D.line(a[0], a[1], b[0], b[1], col); } });
      if (S.cur) for (let k = 0; k + 1 < S.cur.length; k++) D.line(P[S.cur[k]][0], P[S.cur[k]][1], P[S.cur[k + 1]][0], P[S.cur[k + 1]][1], acc);
    }
    if (alg === 'jarvis' && S.from >= 0) {
      if (S.test >= 0) D.line(P[S.from][0], P[S.from][1], P[S.test][0], P[S.test][1], faint);
      if (S.cand >= 0) D.line(P[S.from][0], P[S.from][1], P[S.cand][0], P[S.cand][1], acc);
    }
    if (alg === 'caliper') {
      const h = hullPts, th = s.T * 0.35;
      let best = null;
      for (const base of [th, th + Math.PI / 2]) {
        const ux = Math.cos(base), uy = Math.sin(base);
        let mn = Infinity, mxv = -Infinity, a = 0, b = 0;
        for (const i of h) { const pr = -P[i][0] * uy + P[i][1] * ux; if (pr < mn) { mn = pr; a = i; } if (pr > mxv) { mxv = pr; b = i; } }
        for (const i of [a, b]) { const q = P[i]; D.line(q[0] - ux * 900, q[1] - uy * 900, q[0] + ux * 900, q[1] + uy * 900, faint); }
        best = best ? [...best, mxv - mn, ux, uy, mn, mxv] : [mxv - mn, ux, uy, mn, mxv];
      }
      // 外接矩形四個角
      const [w1, ux, uy, n1, x1, w2, vx, vy, n2, x2] = best, area = w1 * w2;
      const pts = [];
      for (const [a, b] of [[n1, n2], [x1, n2], [x1, x2], [n1, x2]]) {
        // 解 -x*uy + y*ux = a，-x*vy + y*vx = b
        const det = -uy * vx + vy * ux, X = (a * vx - b * ux) / det, Y = (-uy * b + vy * a) / det;
        pts.push([X, Y]);
      }
      const isMin = area < s.minA * 1.01;
      if (area < s.minA) s.minA = area;
      const rc = isMin ? hv(s, f, 50, 0.85, 1) : acc;
      for (let k = 0; k < 4; k++) D.line(pts[k][0], pts[k][1], pts[(k + 1) % 4][0], pts[(k + 1) % 4][1], rc);
      s.area = area;
    }
    if (hullPts && hullPts.length > 2 && (closed || s.hold > 0) && alg !== 'onion') {
      // 凸包內部淡淡填上點陣
      const m = hullPts.length, fill = hv(s, f, 190, 0.2, 0.16);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const i of hullPts) { x0 = Math.min(x0, P[i][0]); x1 = Math.max(x1, P[i][0]); y0 = Math.min(y0, P[i][1]); y1 = Math.max(y1, P[i][1]); }
      const sgn = ccw(P[hullPts[0]], P[hullPts[1]], P[hullPts[2]]) >= 0 ? 1 : -1;
      for (let cy = Math.ceil(y0 / 4); cy <= y1 / 4; cy++) for (let cx = Math.ceil(x0 / 2); cx <= x1 / 2; cx++) {
        if ((cx + cy * 2) % 3) continue;
        const q = [cx * 2 + 1, cy * 4 + 2];
        let inside = true;
        for (let k = 0; k < m && inside; k++) if (sgn * ccw(P[hullPts[k]], P[hullPts[(k + 1) % m]], q) < 0) inside = false;
        if (inside) g.set(cx, cy, '·', fill);
      }
    }
    if (hullPts && hullPts.length > 1) {
      const m = hullPts.length, cl = closed || (s.hold > 0 && alg !== 'onion');
      for (let k = 0; k < (cl ? m : m - 1); k++) { const a = P[hullPts[k]], b = P[hullPts[(k + 1) % m]]; D.line(a[0], a[1], b[0], b[1], s.hold > 0 && alg !== 'dyn' && alg !== 'caliper' ? hv(s, f, 185 + Math.sin(s.T * 3) * 20, 0.75, 0.95) : edge); }
    }
    D.flush(g);
    const onH = new Set(hullPts || []);
    for (let i = 0; i < P.length; i++) {
      const q = P[i], dead = S.dead && S.dead[i];
      g.set(q[0] / 2, q[1] / 4, onH.has(i) ? '●' : dead ? '·' : '•', onH.has(i) ? ptOn : dead ? faint : ptDim);
    }
    if (S.test >= 0 && s.hold <= 0 && alg !== 'dyn' && alg !== 'caliper') g.set(P[S.test][0] / 2, P[S.test][1] / 4, '◆', acc);
    let info = tr(f, HULL_NAME[alg] + '  ' + P.length + ' 點', HULL_NAME_EN[alg] + '  ' + P.length + ' points');
    if (alg === 'caliper') info += tr(f, '  外接矩形面積 ', '  bounding box area ') + Math.round(s.area / 8) + tr(f, '  最小 ', '  min ') + Math.round(s.minA / 8);
    else if (alg === 'onion') { const L = S.layers ? S.layers.length + (S.cur ? 1 : 0) : 1; info += tr(f, '  第 ' + L + ' 層', '  layer ' + L); }
    else if (alg === 'mono' && S.chain) info += tr(f, '  鏈 ' + S.chain.length + ' 點', '  chain ' + S.chain.length);
    else if (hullPts) info += tr(f, '  凸包 ' + hullPts.length + ' 點', '  hull ' + hullPts.length);
    tag(g, 2, 0, info, f.C(0.8));
  } });

/* ════════ 12. 圖論網路（最小生成樹、旅行推銷員、最短路徑樹） ════════ */
function spreadPts(W, H, n) {
  const P = [], d0 = Math.sqrt((W * H) / n) * 0.62;
  for (let t = 0; t < n * 60 && P.length < n; t++) {
    const x = rnd(6, W - 6), y = rnd(14, H - 6);
    let ok = true;
    for (const q of P) if ((q[0] - x) ** 2 + (q[1] - y) ** 2 < d0 * d0) { ok = false; break; }
    if (ok) P.push([x, y]);
  }
  return P;
}
const dst = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function knn(P, k) {
  const n = P.length, E = new Set(), out = [];
  for (let i = 0; i < n; i++) {
    const ds = [];
    for (let j = 0; j < n; j++) if (j !== i) ds.push([dst(P[i], P[j]), j]);
    ds.sort((a, b) => a[0] - b[0]);
    for (let q = 0; q < k && q < ds.length; q++) { const j = ds[q][1], key = i < j ? i * n + j : j * n + i; if (!E.has(key)) { E.add(key); out.push([ds[q][0], Math.min(i, j), Math.max(i, j)]); } }
  }
  return out;
}
const GR = {
  *prim(G) {
    const P = G.P, n = P.length, inT = new Uint8Array(n), best = new Float64Array(n).fill(Infinity), par = new Int32Array(n).fill(-1);
    G.par = par; G.inT = inT;
    let v = G.start;
    for (let k = 0; k < n; k++) {
      inT[v] = 1;
      if (par[v] >= 0) G.edges.push([par[v], v, k]);
      for (let u = 0; u < n; u++) if (!inT[u]) { const d = dst(P[v], P[u]); if (d < best[u]) { best[u] = d; par[u] = v; } }
      G.cur = v;
      yield;
      let nb = -1;
      for (let u = 0; u < n; u++) if (!inT[u] && (nb < 0 || best[u] < best[nb])) nb = u;
      if (nb < 0) break;
      v = nb;
    }
    G.cur = -1;
  },
  *kruskal(G) {
    const P = G.P, n = P.length, E = knn(P, 7).sort((a, b) => a[0] - b[0]), par = Int32Array.from({ length: n }, (_, i) => i);
    const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    G.find = find;
    let added = 0;
    for (const [, a, b] of E) {
      G.test = [a, b];
      const ra = find(a), rb = find(b);
      if (ra !== rb) { par[rb] = ra; G.edges.push([a, b, added++]); G.rej = 0; }
      else G.rej = 1;
      yield;
      if (added >= n - 1) break;
    }
    G.test = null;
  },
  *boruvka(G) {
    const P = G.P, n = P.length, comp = Int32Array.from({ length: n }, (_, i) => i);
    G.comp = comp;
    let round = 0;
    for (;;) {
      const best = new Map();
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (comp[i] === comp[j]) continue;
        const d = dst(P[i], P[j]), c = comp[i], b = best.get(c);
        if (!b || d < b[0]) best.set(c, [d, i, j]);
      }
      if (!best.size) break;
      G.cands = [...best.values()].map(e => [e[1], e[2]]);
      round++; G.round = round;
      for (let k = 1; k <= 24; k++) { G.grow = k / 24; yield; }
      for (const [i, j] of G.cands) {
        const ci = comp[i], cj = comp[j];
        if (ci === cj) continue;
        G.edges.push([i, j, round]);
        for (let q = 0; q < n; q++) if (comp[q] === cj) comp[q] = ci;
      }
      G.cands = null;
      for (let k = 0; k < 6; k++) yield;
    }
  },
  *tsp(G) {
    const P = G.P, n = P.length, used = new Uint8Array(n), t = [G.start];
    used[G.start] = 1; G.tour = t; G.open = true;
    while (t.length < n) {
      const a = t[t.length - 1];
      let b = -1;
      for (let j = 0; j < n; j++) if (!used[j] && (b < 0 || dst(P[a], P[j]) < dst(P[a], P[b]))) b = j;
      used[b] = 1; t.push(b); G.cur = b;
      yield;
    }
    G.open = false; G.cur = -1; G.phase = '2-opt';
    let improved = true, checks = 0;
    while (improved) {
      improved = false;
      for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const a = t[i], b = t[i + 1], c = t[j], d = t[(j + 1) % n];
        if (++checks % 1200 === 0) yield;
        if (dst(P[a], P[c]) + dst(P[b], P[d]) < dst(P[a], P[b]) + dst(P[c], P[d]) - 1e-6) {
          for (let l = i + 1, r = j; l < r; l++, r--) { const x = t[l]; t[l] = t[r]; t[r] = x; }
          G.swap = [a, c, b, d]; G.imp = (G.imp || 0) + 1; improved = true;
          yield; yield;
        }
      }
    }
    G.swap = null;
  },
  *insert(G) {
    const P = G.P, n = P.length, inT = new Uint8Array(n), dmin = new Float64Array(n).fill(Infinity);
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (dst(P[i], P[j]) > dst(P[a], P[b])) { a = i; b = j; }
    const t = [a, b];
    G.tour = t;
    for (const v of [a, b]) { inT[v] = 1; for (let u = 0; u < n; u++) dmin[u] = Math.min(dmin[u], dst(P[u], P[v])); }
    yield;
    while (t.length < n) {
      let v = -1;
      for (let u = 0; u < n; u++) if (!inT[u] && (v < 0 || dmin[u] > dmin[v])) v = u;
      let bi = 0, bc = Infinity;
      for (let k = 0; k < t.length; k++) { const x = P[t[k]], y = P[t[(k + 1) % t.length]], c = dst(x, P[v]) + dst(P[v], y) - dst(x, y); if (c < bc) { bc = c; bi = k; } }
      t.splice(bi + 1, 0, v); inT[v] = 1; G.cur = v;
      for (let u = 0; u < n; u++) dmin[u] = Math.min(dmin[u], dst(P[u], P[v]));
      yield;
    }
    G.cur = -1;
  },
  *spt(G) {
    const P = G.P, n = P.length, adj = Array.from({ length: n }, () => []);
    for (const [d, a, b] of knn(P, 5)) { adj[a].push([b, d]); adj[b].push([a, d]); }
    const dist = new Float64Array(n).fill(Infinity), par = new Int32Array(n).fill(-1), done = new Uint8Array(n), hp = new Heap(n * 8);
    G.dist = dist; G.done = done;
    dist[G.start] = 0; hp.push(0, G.start);
    while (hp.n) {
      const v = hp.pop();
      if (done[v]) continue;
      done[v] = 1; G.cur = v;
      if (par[v] >= 0) G.edges.push([par[v], v, dist[v]]);
      for (const [u, d] of adj[v]) if (dist[v] + d < dist[u]) { dist[u] = dist[v] + d; par[u] = v; hp.push(dist[u], u); }
      G.maxD = Math.max(G.maxD || 1, dist[v]);
      yield;
    }
    G.cur = -1;
  },
};
const GR_NAME = { prim: '普林最小生成樹', kruskal: '克魯斯克爾生成樹', boruvka: '博魯夫卡生成樹', tsp: '最近鄰＋2-opt 旅行推銷員', insert: '最遠插入旅行推銷員', anneal: '模擬退火旅行推銷員', spt: '戴克斯特拉最短路徑樹', drift: '流動最小生成樹' };
const GR_NAME_EN = { prim: "Prim's MST", kruskal: "Kruskal's MST", boruvka: "Borůvka's MST", tsp: 'Nearest Neighbor + 2-opt TSP', insert: 'Farthest Insertion TSP', anneal: 'Simulated Annealing TSP',
  spt: 'Dijkstra Shortest-Path Tree', drift: 'Drifting MST' };
A({ id: 'al-graph', name: '圖論網路', cat: CAT, theme: 'cyber', hue: true, desc: '普林演算法從一點長出最小生成樹',
  params: { alg: 'prim', dens: 1, secs: 12 },
  variants: [
    { id: 'kruskal', name: '克魯斯克爾', theme: 'rainbow', desc: '由短到長加邊，彩色森林逐漸合併', params: { alg: 'kruskal', secs: 14 } },
    { id: 'boruvka', name: '博魯夫卡', theme: 'sunset', desc: '每一回合所有群組同時向外連線', params: { alg: 'boruvka', secs: 12 } },
    { id: 'tsp', name: '旅行推銷員', theme: 'amber', desc: '貪心走完再用 2-opt 解開交叉', params: { alg: 'tsp', secs: 16 } },
    { id: 'insert', name: '最遠插入', theme: 'mint', desc: '巡迴路線像氣球一樣慢慢撐開', params: { alg: 'insert', secs: 13 } },
    { id: 'anneal', name: '模擬退火', theme: 'fire', desc: '亂糟糟的路線隨溫度下降而理順', params: { alg: 'anneal', dens: 0.8 } },
    { id: 'spt', name: '最短路徑樹', theme: 'ice', desc: '從中心向外擴散的最短路徑樹', params: { alg: 'spt', dens: 1.3, secs: 12 } },
    { id: 'drift', name: '流動', theme: 'neon', desc: '漂移的節點，生成樹隨時重新連線', params: { alg: 'drift', dens: 0.6 } },
  ],
  init(s, f) {
    const p = f.p, W = f.cols * 2, H = f.rows * 4;
    Object.assign(s, { W, H, D: new Dots(f.cols, f.rows), T: 0, hold: 0, acc: 0 });
    const n = clamp(Math.round(((W * H) / 1700) * p.dens), 22, 190);
    s.P = spreadPts(W, H, n);
    const P = s.P;
    let c = 0;
    for (let i = 1; i < P.length; i++) if (dst(P[i], [W / 2, H / 2]) < dst(P[c], [W / 2, H / 2])) c = i;
    const start = p.alg === 'spt' ? c : rint(0, P.length - 1);
    s.G = { P, edges: [], start, cur: -1 };
    if (p.alg === 'drift') { s.V = P.map(() => [0, 0]); return; }
    if (p.alg === 'anneal') {
      const n2 = P.length;
      s.tour = shuffle(P.map((_, i) => i));
      let tot = 0;
      for (let i = 0; i < n2; i++) tot += dst(P[s.tour[i]], P[s.tour[(i + 1) % n2]]);
      s.temp = (tot / n2) * 0.8; s.t0 = s.temp; s.len = tot; s.acc = 0;
      return;
    }
    const dry = { P, edges: [], start }, it = GR[p.alg](dry);
    let cnt = 0;
    while (!it.next().done) cnt++;
    s.rate = Math.max(2, cnt / p.secs);
    s.gen = GR[p.alg](s.G);
  },
  frame(s, f) {
    const p = f.p, g = f.g, dt = f.dt, D = s.D, G = s.G, P = s.P, n = P.length, alg = p.alg;
    themed(s, f, this);
    s.T += dt;
    D.clear();
    const faint = f.C(0.17), node = f.C(0.45), hot = hv(s, f, 50, 0.9, 1);
    const L = (a, b, col) => D.line(P[a][0], P[a][1], P[b][0], P[b][1], col);
    let info = tr(f, GR_NAME[alg], GR_NAME_EN[alg]);
    if (alg === 'drift') {
      for (let i = 0; i < n; i++) {
        const q = P[i], v = s.V[i], a = Noise.n3(i * 0.31, s.T * 0.15, 7) * TAU * 1.5;
        v[0] = lerp(v[0], Math.cos(a) * 10, dt * 0.8); v[1] = lerp(v[1], Math.sin(a) * 7, dt * 0.8);
        q[0] += v[0] * dt; q[1] += v[1] * dt;
        if (q[0] < 4) { q[0] = 4; v[0] = Math.abs(v[0]); } if (q[0] > s.W - 5) { q[0] = s.W - 5; v[0] = -Math.abs(v[0]); }
        if (q[1] < 12) { q[1] = 12; v[1] = Math.abs(v[1]); } if (q[1] > s.H - 5) { q[1] = s.H - 5; v[1] = -Math.abs(v[1]); }
      }
      const inT = new Uint8Array(n), best = new Float64Array(n).fill(Infinity), par = new Int32Array(n).fill(-1);
      let v = 0, tot = 0;
      for (let k = 0; k < n; k++) {
        inT[v] = 1;
        if (par[v] >= 0) { const d = best[v]; tot += d; L(par[v], v, hg(s, f, 1 - Math.min(1, d / 60), 0.6 - Math.min(0.3, d / 200), 0.95 - Math.min(0.6, d / 70))); }
        let nb = -1;
        for (let u = 0; u < n; u++) if (!inT[u]) { const d = dst(P[v], P[u]); if (d < best[u]) { best[u] = d; par[u] = v; } if (nb < 0 || best[u] < best[nb]) nb = u; }
        if (nb < 0) break;
        v = nb;
      }
      info += tr(f, '  總長 ', '  total length ') + Math.round(tot / 2);
    } else if (alg === 'anneal') {
      const t = s.tour;
      if (s.hold > 0) { s.hold -= dt; if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); } }
      else {
        for (let it = 0; it < 900; it++) {
          let i = rint(0, n - 2), j = rint(i + 1, n - 1);
          if (i === 0 && j === n - 1) continue;
          const a = t[i], b = t[i + 1], c = t[j], d = t[(j + 1) % n];
          const delta = dst(P[a], P[c]) + dst(P[b], P[d]) - dst(P[a], P[b]) - dst(P[c], P[d]);
          if (delta < 0 || Math.random() < Math.exp(-delta / s.temp)) { for (let l = i + 1, r = j; l < r; l++, r--) { const x = t[l]; t[l] = t[r]; t[r] = x; } s.len += delta; }
        }
        s.temp *= Math.exp(-dt * 0.28);
        if (s.temp < s.t0 * 0.002) s.hold = 4;
      }
      const heat = clamp(Math.log(s.temp / (s.t0 * 0.002)) / Math.log(500), 0, 1);
      for (let k = 0; k < n; k++) L(t[k], t[(k + 1) % n], s.hold > 0 ? hv(s, f, 50 + Math.sin(s.T * 2 + k * 0.2) * 15, 0.7, 0.95) : hg(s, f, heat, 0.45 + heat * 0.2, 0.4 + 0.5 * (1 - heat)));
      info += tr(f, '  溫度 ', '  temperature ') + (heat * 100).toFixed(0) + tr(f, '%  長度 ', '%  length ') + Math.round(s.len / 2);
    } else {
      if (s.hold > 0) { s.hold -= dt; if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); } }
      else { let k = due(s, dt, s.rate, 200); while (k-- > 0) if (s.gen.next().done) { s.hold = 3.5; break; } }
      const E = G.edges, ne = Math.max(1, E.length), holdWave = s.hold > 0 && E.length > 0 && (alg === 'prim' || alg === 'kruskal' || alg === 'boruvka' || alg === 'spt');
      // 完成後一道光沿著加入順序掃過整棵樹
      if (holdWave) E.forEach(([a, b], k) => { const w = Math.sin(s.T * 3 - (k / ne) * 12); L(a, b, w > 0.7 ? hot : hg(s, f, k / ne, 0.5, 0.45 + (k / ne) * 0.4)); });
      if (alg === 'prim' && G.inT) for (let u = 0; u < n; u++) if (!G.inT[u] && G.par[u] >= 0) L(G.par[u], u, faint);
      if (alg === 'boruvka' && G.cands) { const u = G.grow || 0, col = hv(s, f, 330, 0.7, 0.9); for (const [i, j] of G.cands) D.line(P[i][0], P[i][1], lerp(P[i][0], P[j][0], u), lerp(P[i][1], P[j][1], u), col); }
      if (holdWave) { /* 已畫過 */ } else if (alg === 'kruskal') {
        for (const [a, b] of E) { const r = G.find(a); L(a, b, hv(s, f, (r * 137.5) % 360, 0.55, 0.35 + ((r * 0.618) % 1) * 0.6)); }
        if (G.test) L(G.test[0], G.test[1], G.rej ? hv(s, f, 0, 0.5, 0.4) : hot);
      } else if (alg === 'boruvka') for (const [a, b, r] of E) L(a, b, hg(s, f, tri(r * 0.22), 0.6, 0.3 + Math.min(0.65, r * 0.13)));
      else if (alg === 'spt') for (const [a, b, d] of E) L(a, b, hg(s, f, d / (G.maxD || 1), 0.6, 0.95 - (d / (G.maxD || 1)) * 0.6));
      else if (alg === 'prim') E.forEach(([a, b, k]) => L(a, b, hg(s, f, k / n, 0.6, 0.35 + (k / n) * 0.6)));
      if (G.tour) {
        const t = G.tour, m = t.length;
        for (let k = 0; k < (G.open ? m - 1 : m); k++) L(t[k], t[(k + 1) % m], s.hold > 0 ? (Math.sin(s.T * 3 - (k / m) * 14) > 0.6 ? hot : hv(s, f, 50, 0.6, 0.8)) : hg(s, f, k / n, 0.55, 0.45 + (k / n) * 0.5));
        if (G.swap) { L(G.swap[0], G.swap[1], hot); L(G.swap[2], G.swap[3], hot); }
      }
      if (alg === 'tsp') info += G.phase ? tr(f, '  2-opt 改善 ' + (G.imp || 0) + ' 次', '  2-opt improvements ' + (G.imp || 0)) : tr(f, '  建立路線中', '  building tour');
      else if (alg === 'boruvka') info += tr(f, '  第 ' + (G.round || 0) + ' 回合', '  round ' + (G.round || 0));
      else info += '  ' + (G.tour ? G.tour.length : E.length) + ' / ' + (G.tour ? n : n - 1);
    }
    D.flush(g);
    for (let i = 0; i < n; i++) g.set(P[i][0] / 2, P[i][1] / 4, i === G.cur ? '●' : '•', i === G.cur ? hot : alg === 'spt' && G.done && G.done[i] ? hv(s, f, 190, 0.6, 0.7) : node);
    tag(g, 2, 0, info, f.C(0.8));
  } });

/* ════════ 13. 分群演算法 ════════ */
function kmData(W, H, n, kind, K) {
  const P = [], top = 14, R = Math.min(W, (H - top) * 1.6);
  if (kind === 'uniform') { for (let i = 0; i < n; i++) P.push([rnd(6, W - 6), rnd(top, H - 6)]); return P; }
  if (kind === 'tight') {
    // K 團又小又密、彼此分開的資料（放在打散的格子上），隨機初始化常會把兩團算成一群
    const gc = Math.max(2, Math.round(Math.sqrt((K * W) / (H - top)))), gr = Math.max(1, Math.ceil(K / gc)), cw = W / gc, chh = (H - top) / gr;
    const bl = shuffle(Array.from({ length: gc * gr }, (_, i) => i)).slice(0, K).map(q => ({
      x: ((q % gc) + 0.5 + rnd(-0.15, 0.15)) * cw, y: top + (Math.floor(q / gc) + 0.5 + rnd(-0.15, 0.15)) * chh, r: Math.min(cw, chh) * rnd(0.08, 0.13) }));
    for (let i = 0; i < n; i++) { const b = pick(bl); P.push([clamp(b.x + gauss() * b.r * 1.3, 4, W - 5), clamp(b.y + gauss() * b.r, top, H - 5)]); }
    return P;
  }
  if (kind === 'shapes') {
    const cx = W / 2, cy = (H + top) / 2, r = (H - top) * 0.28;
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      let x, y;
      if (t < 0.28) { const a = rnd(0, Math.PI); x = cx - r * 1.9 + Math.cos(a) * r * 1.6; y = cy - r * 0.2 - Math.sin(a) * r; }
      else if (t < 0.56) { const a = rnd(0, Math.PI); x = cx - r * 0.3 + Math.cos(a) * r * 1.6; y = cy - r * 0.6 + Math.sin(a) * r; }
      else if (t < 0.84) { const a = rnd(0, TAU); x = cx + r * 2.6 + Math.cos(a) * r * 1.2; y = cy + Math.sin(a) * r * 0.85; }
      else if (t < 0.92) { x = cx + r * 2.6 + gauss() * r * 0.15; y = cy + gauss() * r * 0.12; }
      else { x = rnd(6, W - 6); y = rnd(top, H - 6); }
      x += gauss() * r * 0.05; y += gauss() * r * 0.05;
      P.push([clamp(x, 4, W - 5), clamp(y, top, H - 5)]);
    }
    return P;
  }
  const m = rint(3, 6), bl = [];
  for (let k = 0; k < m; k++) bl.push({ x: rnd(W * 0.12, W * 0.88), y: rnd(top + H * 0.12, H * 0.88), sx: rnd(0.04, 0.11) * R * (kind === 'aniso' ? 1.5 : 1), sy: rnd(0.04, 0.11) * R * (kind === 'aniso' ? 0.45 : 0.6), a: rnd(0, Math.PI), w: rnd(0.5, 1.5) });
  const tw = bl.reduce((a, b) => a + b.w, 0);
  for (let i = 0; i < n; i++) {
    let r = Math.random() * tw, b = bl[0];
    for (const q of bl) { r -= q.w; if (r <= 0) { b = q; break; } }
    const u = gauss() * b.sx, v = gauss() * b.sy, c = Math.cos(b.a), s = Math.sin(b.a);
    P.push([clamp(b.x + u * c - v * s, 4, W - 5), clamp(b.y + u * s + v * c, top, H - 5)]);
  }
  return P;
}
const KM_NAME = { lloyd: 'K 平均法', pp: 'K 平均法＋＋', many: '質心沃羅諾伊', l1: 'K 中位數（曼哈頓距離）', dbscan: 'DBSCAN 密度分群', gmm: '高斯混合模型 EM', online: '線上 K 平均', mshift: '均值漂移' };
const KM_NAME_EN = { lloyd: 'K-Means', pp: 'K-Means++', many: 'Centroidal Voronoi', l1: 'K-Medians (Manhattan Distance)', dbscan: 'DBSCAN Density Clustering', gmm: 'Gaussian Mixture EM', online: 'Online K-Means', mshift: 'Mean Shift' };
A({ id: 'al-kmeans', name: '分群演算法', cat: CAT, theme: 'sunset', hue: true, desc: 'K 平均法反覆指派與移動質心',
  params: { alg: 'lloyd', K: 5, data: 'blobs', dens: 1 },
  variants: [
    { id: 'pp', name: '++初始化', theme: 'ocean', desc: '多團緊密資料，依距離平方機率挑選質心', params: { alg: 'pp', K: 9, data: 'tight' } },
    { id: 'many', name: '沃羅諾伊', theme: 'mint', desc: '均勻資料被切成質心沃羅諾伊圖', params: { alg: 'many', K: 14, data: 'uniform' } },
    { id: 'l1', name: '曼哈頓', theme: 'gold', desc: '用曼哈頓距離分群，邊界變成折線', params: { alg: 'l1', K: 6 } },
    { id: 'dbscan', name: '密度分群', theme: 'cyber', desc: 'DBSCAN 沿著密集的點擴張，月牙也分得開', params: { alg: 'dbscan', data: 'shapes', dens: 1.2 } },
    { id: 'gmm', name: '高斯混合', theme: 'lavender', desc: 'EM 演算法讓橢圓貼合每一群', params: { alg: 'gmm', K: 4, data: 'aniso' } },
    { id: 'online', name: '線上學習', theme: 'toxic', desc: '資料串流不斷湧入，質心持續追蹤', params: { alg: 'online', K: 5 } },
    { id: 'mshift', name: '均值漂移', theme: 'fire', desc: '每個點爬向密度高峰，聚成一團團', params: { alg: 'mshift', dens: 0.55 } },
  ],
  init(s, f) {
    const p = f.p, W = f.cols * 2, H = f.rows * 4;
    Object.assign(s, { W, H, D: new Dots(f.cols, f.rows), T: 0, ph: 0, phase: 'start', it: 0, hold: 0 });
    const n = clamp(Math.round(((W * H) / 190) * p.dens), 160, 1500);
    s.n = n; s.K = f.cols < 120 && p.K > 8 ? 8 : p.K;
    s.lab = new Int16Array(n).fill(-1); s.old = new Int16Array(n).fill(-1);
    s.regions = new Int16Array(f.cols * f.rows).fill(-1); s.rKey = '';
    if (p.alg === 'online') {
      s.blobs = Array.from({ length: s.K }, () => ({ x: rnd(W * 0.15, W * 0.85), y: rnd(H * 0.2, H * 0.85), ph: rnd(0, TAU), sp: rnd(0.05, 0.12), sx: rnd(10, 26) }));
      s.P = []; s.age = []; s.cnt = new Float32Array(s.K);
      s.C = s.blobs.map(() => [rnd(10, W - 10), rnd(14, H - 6)]); s.trail = s.C.map(c => [c.slice()]);
      return;
    }
    s.P = kmData(W, H, n, p.data, s.K);
    if (p.alg === 'dbscan') {
      const eps = Math.sqrt((W * H) / n) * 1.7;
      s.eps = eps; s.minPts = 5; s.lab.fill(-2);
      s.grid = new Map();
      s.P.forEach((q, i) => { const k = Math.floor(q[0] / eps) + ',' + Math.floor(q[1] / eps); if (!s.grid.has(k)) s.grid.set(k, []); s.grid.get(k).push(i); });
      s.gen = this.dbscan(s); s.rate = n / 14; s.acc = 0; s.ncl = 0;
      return;
    }
    if (p.alg === 'mshift') {
      s.Q = s.P.map(q => q.slice()); s.Q0 = s.P.map(q => q.slice()); s.bw = Math.sqrt((W * H) / 12) * 0.38;
      s.cell = s.bw; s.grid = new Map();
      s.P.forEach((q, i) => { const k = Math.floor(q[0] / s.cell) * 4096 + Math.floor(q[1] / s.cell); if (!s.grid.has(k)) s.grid.set(k, []); s.grid.get(k).push(i); });
      s.phase = 'iter'; s.ph = 0; s.it = 0;
      return;
    }
    const K = s.K;
    if (p.alg === 'gmm') {
      s.G = Array.from({ length: K }, () => { const q = pick(s.P); return { m: [q[0], q[1]], c: [W * W * 0.01, 0, H * H * 0.01], w: 1 / K }; });
      s.Gd = s.G.map(c => ({ m: c.m.slice(), c: c.c.slice(), w: c.w }));
      s.resp = new Float32Array(n * K); this.estep(s); s.phase = 'em'; s.ph = 0;
      return;
    }
    if (p.alg === 'pp') { s.C = [pick(s.P).slice()]; s.phase = 'seed'; }
    else { s.C = []; for (let k = 0; k < K; k++) s.C.push(pick(s.P).slice()); s.phase = 'assign'; }
    s.Cd = s.C.map(c => c.slice()); s.trail = s.C.map(c => [c.slice()]); s.ph = 0;
    if (s.phase === 'assign') this.assign(s, f);
  },
  dist(f, a, b) { return f.p.alg === 'l1' ? Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) : Math.hypot(a[0] - b[0], a[1] - b[1]); },
  assign(s, f) {
    s.old.set(s.lab);
    for (let i = 0; i < s.n; i++) { let b = 0, bd = Infinity; for (let k = 0; k < s.C.length; k++) { const d = this.dist(f, s.P[i], s.C[k]); if (d < bd) { bd = d; b = k; } } s.lab[i] = b; }
  },
  *dbscan(s) {
    const P = s.P, n = s.n, eps = s.eps, lab = s.lab;
    const nb = i => { const q = P[i], gx = Math.floor(q[0] / eps), gy = Math.floor(q[1] / eps), out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = s.grid.get(gx + dx + ',' + (gy + dy)); if (c) for (const j of c) if ((P[j][0] - q[0]) ** 2 + (P[j][1] - q[1]) ** 2 <= eps * eps) out.push(j); } return out; };
    for (const i of shuffle(P.map((_, k) => k))) {
      if (lab[i] !== -2) continue;
      const N0 = nb(i);
      if (N0.length < s.minPts) { lab[i] = -1; s.cur = i; yield; continue; }
      const c = s.ncl++;
      lab[i] = c; s.cur = i;
      const q = N0.slice();
      while (q.length) {
        const j = q.shift();
        if (lab[j] === -1) lab[j] = c;
        if (lab[j] !== -2) continue;
        lab[j] = c; s.cur = j;
        const Nj = nb(j);
        if (Nj.length >= s.minPts) for (const k of Nj) if (lab[k] === -2 || lab[k] === -1) q.push(k);
        yield;
      }
    }
    s.cur = -1;
  },
  estep(s) {
    const { P, G, n, resp } = s, K = G.length;
    let ll = 0;
    for (let i = 0; i < n; i++) {
      let tot = 0;
      for (let k = 0; k < K; k++) {
        const g = G[k], dx = P[i][0] - g.m[0], dy = P[i][1] - g.m[1], [a, b, c] = g.c, det = Math.max(1e-6, a * c - b * b);
        const q = (c * dx * dx - 2 * b * dx * dy + a * dy * dy) / det, v = (g.w * Math.exp(-0.5 * q)) / (TAU * Math.sqrt(det));
        resp[i * K + k] = v; tot += v;
      }
      tot = tot || 1e-300; ll += Math.log(tot);
      for (let k = 0; k < K; k++) resp[i * K + k] /= tot;
    }
    return ll;
  },
  mstep(s) {
    const { P, G, n, resp } = s, K = G.length;
    for (let k = 0; k < K; k++) {
      let w = 0, mx = 0, my = 0;
      for (let i = 0; i < n; i++) { const r = resp[i * K + k]; w += r; mx += r * P[i][0]; my += r * P[i][1]; }
      w = Math.max(w, 1e-6); mx /= w; my /= w;
      let a = 0, b = 0, c = 0;
      for (let i = 0; i < n; i++) { const r = resp[i * K + k], dx = P[i][0] - mx, dy = P[i][1] - my; a += r * dx * dx; b += r * dx * dy; c += r * dy * dy; }
      G[k] = { m: [mx, my], c: [a / w + 4, b / w, c / w + 4], w: w / n };
    }
  },
  frame(s, f) {
    const p = f.p, g = f.g, dt = f.dt, D = s.D, alg = p.alg, W = s.W, H = s.H;
    themed(s, f, this);
    s.T += dt; s.ph += dt;
    D.clear();
    const K = s.K, colK = (k, L, t) => hv(s, f, (k * 360) / Math.max(K, 1) + 15, L, t !== undefined ? t : 0.3 + (0.65 * k) / Math.max(1, K - 1)), grey = f.C(0.25);
    let info = tr(f, KM_NAME[alg], KM_NAME_EN[alg]);
    const ptDot = (q, col, big) => { D.dot(q[0], q[1], col); if (big) { D.dot(q[0] + 1, q[1], col); D.dot(q[0], q[1] + 1, col); D.dot(q[0] + 1, q[1] + 1, col); } };
    const big = s.n < 700;
    if (alg === 'online') {
      const P = s.P, age = s.age;
      for (const b of s.blobs) { b.ph += dt * b.sp; b.x = clamp(b.x + Math.cos(b.ph * 2.3) * dt * 9, W * 0.1, W * 0.9); b.y = clamp(b.y + Math.sin(b.ph * 1.7) * dt * 6, H * 0.15, H * 0.9); }
      s.acc = (s.acc || 0) + dt * 70;
      while (s.acc >= 1) {
        s.acc -= 1;
        const b = pick(s.blobs), q = [clamp(b.x + gauss() * b.sx, 4, W - 5), clamp(b.y + gauss() * b.sx * 0.6, 14, H - 5)];
        let bk = 0, bd = Infinity;
        s.C.forEach((c, k) => { const d = Math.hypot(c[0] - q[0], c[1] - q[1]); if (d < bd) { bd = d; bk = k; } });
        s.cnt[bk] = Math.min(60, s.cnt[bk] + 1);
        const eta = 1 / s.cnt[bk], c = s.C[bk];
        c[0] += (q[0] - c[0]) * eta; c[1] += (q[1] - c[1]) * eta;
        P.push(q); age.push([s.T, bk]);
      }
      while (age.length && s.T - age[0][0] > 7) { age.shift(); P.shift(); }
      s.C.forEach((c, k) => { const tr = s.trail[k], last = tr[tr.length - 1]; if (Math.hypot(last[0] - c[0], last[1] - c[1]) > 2) { tr.push(c.slice()); if (tr.length > 80) tr.shift(); } });
      for (let i = 0; i < P.length; i++) { const a = s.T - age[i][0]; ptDot(P[i], colK(age[i][1], 0.25 + 0.5 * Math.max(0, 1 - a / 7), 0.15 + 0.7 * Math.max(0, 1 - a / 7)), a < 0.4); }
      s.trail.forEach((tr, k) => { for (let j = 1; j < tr.length; j++) D.line(tr[j - 1][0], tr[j - 1][1], tr[j][0], tr[j][1], colK(k, 0.3, 0.3)); });
      s.Cd = s.C;
      info += tr(f, '  已讀入 ' + Math.floor(s.T * 70) + ' 筆', '  ' + Math.floor(s.T * 70) + ' points read');
    } else if (alg === 'dbscan') {
      if (s.hold > 0) { s.hold -= dt; if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); } }
      else { let k = due(s, dt, s.rate, 200); while (k-- > 0) if (s.gen.next().done) { s.hold = 4; break; } }
      // 分完群後的停留時間：一道亮光斜斜掃過各群
      for (let i = 0; i < s.n; i++) {
        const l = s.lab[i], q = s.P[i], w = s.hold > 0 ? 0.22 * Math.sin(s.T * 3 - (q[0] + q[1] * 1.5) * 0.02) : 0;
        ptDot(q, l >= 0 ? colK(l % 8, 0.55 + w, 0.35 + 0.08 * (l % 8) + w) : l === -1 ? hv(s, f, 0, 0.3, 0.2) : grey, big);
      }
      if (s.cur >= 0) { const q = s.P[s.cur]; for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU; D.dot(q[0] + Math.cos(a) * s.eps, q[1] + Math.sin(a) * s.eps, hv(s, f, 50, 0.85, 1)); } }
      info += tr(f, '  群數 ', '  clusters ') + s.ncl;
    } else if (alg === 'mshift') {
      const { P, Q, Q0 } = s, n = s.n, T = 0.45;
      if (s.phase === 'iter' && s.ph >= T) {
        s.ph = 0; s.it++;
        let mv = 0;
        for (let i = 0; i < n; i++) {
          const q = Q[i], gx = Math.floor(q[0] / s.cell), gy = Math.floor(q[1] / s.cell);
          let sx = 0, sy = 0, c = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const L = s.grid.get((gx + dx) * 4096 + gy + dy); if (L) for (const j of L) { const ex = P[j][0] - q[0], ey = P[j][1] - q[1]; if (ex * ex + ey * ey < s.bw * s.bw) { sx += P[j][0]; sy += P[j][1]; c++; } } }
          Q0[i][0] = q[0]; Q0[i][1] = q[1];
          if (c) { const nx = sx / c, ny = sy / c; mv = Math.max(mv, Math.hypot(nx - q[0], ny - q[1])); q[0] = nx; q[1] = ny; }
        }
        if (mv < 0.6 || s.it > 40) {
          s.phase = 'done'; s.hold = 4.5;
          const modes = [];
          for (let i = 0; i < n; i++) { let m = modes.findIndex(c => Math.hypot(c[0] - Q[i][0], c[1] - Q[i][1]) < s.bw * 0.5); if (m < 0) { modes.push(Q[i].slice()); m = modes.length - 1; } s.lab[i] = m; }
          s.modes = modes;
        }
      }
      if (s.phase === 'done') { s.hold -= dt; if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); } }
      const u = s.phase === 'iter' ? Math.min(1, s.ph / T) : 1, e = u * u * (3 - 2 * u);
      for (let i = 0; i < n; i++) {
        const x = lerp(Q0[i][0], Q[i][0], e), y = lerp(Q0[i][1], Q[i][1], e), d = Math.hypot(x - P[i][0], y - P[i][1]);
        // 從原位置拉出的軌跡：所有點像水流一樣匯向密度高峰
        if (d > 2) D.line(P[i][0], P[i][1], x, y, s.phase === 'done' ? colK(s.lab[i] % 8, 0.25, 0.22) : hv(s, f, 20 + Math.min(1, d / 60) * 40, 0.22, 0.18 + Math.min(0.2, d / 200)));
        else ptDot(P[i], f.C(0.2), false);
      }
      for (let i = 0; i < n; i++) {
        const x = lerp(Q0[i][0], Q[i][0], e), y = lerp(Q0[i][1], Q[i][1], e), d = Math.hypot(x - P[i][0], y - P[i][1]);
        ptDot([x, y], s.phase === 'done' ? colK(s.lab[i] % 8, 0.7) : hv(s, f, 20 + Math.min(1, d / 60) * 50, 0.45 + Math.min(0.4, d / 80), 0.45 + Math.min(0.55, d / 60)), true);
      }
      if (s.phase === 'done' && s.modes) s.modes.forEach((m, k) => { const rr = 4 + ((s.T * 6 + k * 3) % 10); for (let j = 0; j < 30; j++) { const a = (j / 30) * TAU; D.dot(m[0] + Math.cos(a) * rr * 1.2, m[1] + Math.sin(a) * rr, colK(k % 8, 0.6, 0.6 + 0.4 * (1 - (rr - 4) / 10))); } });
      info += tr(f, '  第 ' + s.it + ' 輪', '  round ' + s.it) + (s.modes ? tr(f, '  找到 ' + s.modes.length + ' 個高峰', '  peaks found ' + s.modes.length) : '');
    } else if (alg === 'gmm') {
      const G = s.G, Gd = s.Gd, n = s.n;
      if (s.phase === 'em' && s.ph > 0.7) {
        s.ph = 0; s.it++;
        const prev = s.ll;
        this.mstep(s); s.ll = this.estep(s);
        if ((prev !== undefined && Math.abs(s.ll - prev) < n * 1e-4) || s.it > 70) { s.phase = 'done'; s.hold = 4.5; }
      }
      if (s.phase === 'done') { s.hold -= dt; if (s.hold <= 0) { this.init(s, f); return this.frame(s, f); } }
      const k2 = Math.min(1, dt * 5);
      for (let k = 0; k < K; k++) { for (let q = 0; q < 2; q++) Gd[k].m[q] = lerp(Gd[k].m[q], G[k].m[q], k2); for (let q = 0; q < 3; q++) Gd[k].c[q] = lerp(Gd[k].c[q], G[k].c[q], k2); }
      for (let i = 0; i < n; i++) { let bk = 0, bv = 0; for (let k = 0; k < K; k++) if (s.resp[i * K + k] > bv) { bv = s.resp[i * K + k]; bk = k; } ptDot(s.P[i], colK(bk, 0.2 + bv * 0.45, 0.15 + bv * 0.6), big); }
      for (let k = 0; k < K; k++) {
        const [a, b, c] = Gd[k].c, tr = a + c, det = a * c - b * b, l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l2 = Math.max(1, tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det)));
        const ang = Math.abs(b) < 1e-9 ? (a >= c ? 0 : Math.PI / 2) : Math.atan2(l1 - a, b), ca = Math.cos(ang), sa = Math.sin(ang);
        for (const sc of [1, 2]) {
          const r1 = Math.sqrt(l1) * sc, r2 = Math.sqrt(l2) * sc;
          let px = 0, py = 0;
          const done = s.phase === 'done', spin = s.T * 1.5;
          for (let j = 0; j <= 72; j++) { const t = (j / 72) * TAU, x = Gd[k].m[0] + r1 * Math.cos(t) * ca - r2 * Math.sin(t) * sa, y = Gd[k].m[1] + r1 * Math.cos(t) * sa + r2 * Math.sin(t) * ca; if (j) D.line(px, py, x, y, done && Math.sin(t * 3 + spin * (sc === 1 ? 1 : -1)) > 0.5 ? colK(k, 0.95, 1) : colK(k, sc === 1 ? 0.8 : 0.5, sc === 1 ? 1 : 0.6)); px = x; py = y; }
        }
      }
      info += tr(f, '  第 ' + s.it + ' 次 EM', '  EM step ' + s.it) + (s.phase === 'done' ? tr(f, '  收斂', '  converged') : '');
    } else {
      // Lloyd 系列：assign → update → … → done
      const P = s.P, n = s.n;
      if (s.phase === 'seed') {
        const sample = () => { let r = Math.random() * s.d2sum; for (let i = 0; i < n; i++) { r -= s.d2[i]; if (r <= 0) return i; } return n - 1; };
        if (!s.d2) { s.d2 = P.map(q => Math.min(...s.C.map(c => (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2))); s.d2sum = s.d2.reduce((a, b) => a + b, 0) || 1; s.d2max = Math.max(1, ...s.d2); }
        if (s.ph > 0.8) {
          s.ph = 0;
          if (s.C.length >= K) { s.phase = 'assign'; this.assign(s, f); }
          else { const pi = sample(); s.C.push(P[pi].slice()); s.Cd.push(P[pi].slice()); s.trail.push([P[pi].slice()]); s.d2 = null; }
        }
        if (s.phase === 'seed' && s.d2) {
          for (let i = 0; i < n; i++) ptDot(P[i], hv(s, f, 40, 0.2 + 0.6 * (s.d2[i] / s.d2max), 0.15 + 0.85 * Math.sqrt(s.d2[i] / s.d2max)), big);
          const c = P[sample()];
          for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; D.dot(c[0] + Math.cos(a) * 5, c[1] + Math.sin(a) * 5, hv(s, f, 50, 0.9, 1)); }
        }
        info += tr(f, '  挑選第 ' + (s.C.length + 1) + ' 個質心（越亮機率越高）', '  picking centroid #' + (s.C.length + 1) + ' (brighter = more likely)');
      } else {
        if (s.phase === 'assign' && s.ph > 0.9) { s.phase = 'update'; s.ph = 0; s.from = s.C.map(c => c.slice()); this.update(s, f); }
        else if (s.phase === 'update' && s.ph > 0.9) {
          s.it++;
          const mv = Math.max(...s.C.map((c, k) => Math.hypot(c[0] - s.from[k][0], c[1] - s.from[k][1])));
          s.C.forEach((c, k) => s.trail[k].push(c.slice()));
          if (mv < 0.5 || s.it > 40) { s.phase = 'done'; s.ph = 0; } else { s.phase = 'assign'; s.ph = 0; this.assign(s, f); }
        } else if (s.phase === 'done' && s.ph > 4) { this.init(s, f); return this.frame(s, f); }
        const sweep = s.phase === 'assign' ? Math.min(1, s.ph / 0.7) * W : W + 1;
        for (let i = 0; i < n; i++) { const l = P[i][0] <= sweep ? s.lab[i] : s.old[i]; ptDot(P[i], l >= 0 ? colK(l, 0.55) : grey, big); }
        if (s.phase === 'assign' && sweep < W) D.line(sweep, 12, sweep, H - 2, f.C(0.3));
        const e = s.phase === 'update' ? Math.min(1, s.ph / 0.7) : 1, ee = e * e * (3 - 2 * e);
        s.C.forEach((c, k) => { s.Cd[k] = s.from && s.phase === 'update' ? [lerp(s.from[k][0], c[0], ee), lerp(s.from[k][1], c[1], ee)] : c.slice(); });
        s.trail.forEach((tr, k) => { for (let j = 1; j < tr.length; j++) D.line(tr[j - 1][0], tr[j - 1][1], tr[j][0], tr[j][1], colK(k, 0.35, 0.35)); if (s.phase === 'update') D.line(tr[tr.length - 1][0], tr[tr.length - 1][1], s.Cd[k][0], s.Cd[k][1], colK(k, 0.35, 0.35)); });
        // 收斂後：每個質心外圍一圈圈往外擴散的光環
        if (s.phase === 'done') s.C.forEach((c, k) => { const rr = 3 + ((s.T * 5 + k * 2.3) % 9); for (let j = 0; j < 28; j++) { const a = (j / 28) * TAU; D.dot(c[0] + Math.cos(a) * rr * 1.2, c[1] + Math.sin(a) * rr, colK(k, 0.7, 0.55 + 0.45 * (1 - (rr - 3) / 9))); } });
        info += tr(f, '  第 ' + s.it + ' 輪', '  round ' + s.it) + (s.phase === 'done' ? tr(f, '  收斂', '  converged') : s.phase === 'assign' ? tr(f, '  指派', '  assigning') : tr(f, '  移動質心', '  moving centroids'));
      }
    }
    // 區域邊界（Lloyd 系列與線上）
    const Cd = s.Cd;
    if (Cd && Cd.length && alg !== 'gmm') {
      const key = Cd.map(c => c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(';'), cols = f.cols, rows = f.rows, R = s.regions;
      if (key !== s.rKey) {
        s.rKey = key;
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const q = [x * 2 + 1, y * 4 + 2];
          let b = 0, bd = Infinity;
          for (let k = 0; k < Cd.length; k++) { const d = alg === 'l1' ? Math.abs(q[0] - Cd[k][0]) + Math.abs(q[1] - Cd[k][1]) : (q[0] - Cd[k][0]) ** 2 + (q[1] - Cd[k][1]) ** 2; if (d < bd) { bd = d; b = k; } }
          R[y * cols + x] = b;
        }
      }
      D.flush(g);
      for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
        const i = y * cols + x, r = R[i];
        if (r !== R[i + 1] || r !== R[i + cols]) { if (g.ch[i] === ' ') g.setI(i, '·', colK(r, 0.3, 0.3)); }
        else if (!((x + y * 3) % 7) && g.ch[i] === ' ') g.setI(i, '·', colK(r, 0.14, 0.12));
      }
      Cd.forEach((c, k) => {
        const x = c[0] / 2, y = c[1] / 4, col = colK(k, 0.85, 1);
        g.set(x - 2, y, '─', col); g.set(x - 1, y, '─', col); g.set(x + 1, y, '─', col); g.set(x + 2, y, '─', col); g.set(x, y - 1, '│', col); g.set(x, y + 1, '│', col); g.set(x, y, '█', col);
      });
    } else D.flush(g);
    tag(g, 2, 0, info, f.C(0.85));
  },
  update(s, f) {
    const p = f.p, K = s.C.length;
    for (let k = 0; k < K; k++) {
      const xs = [], ys = [];
      for (let i = 0; i < s.n; i++) if (s.lab[i] === k) { xs.push(s.P[i][0]); ys.push(s.P[i][1]); }
      if (!xs.length) { const q = pick(s.P); s.C[k] = q.slice(); continue; }
      if (p.alg === 'l1') { xs.sort((a, b) => a - b); ys.sort((a, b) => a - b); s.C[k] = [xs[xs.length >> 1], ys[ys.length >> 1]]; }
      else s.C[k] = [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
    }
  } });

/* ════════ 14. 隨機漫步 ════════ */
const WK_NAME = { lattice: '格點漫步', saw: '自迴避漫步', levy: '李維飛行', brown: '布朗運動', galton: '高爾頓板', ticker: '一維隨機漫步', heat: '足跡熱圖', lerw: '迴圈抹除漫步' };
const WK_NAME_EN = { lattice: 'Lattice Walk', saw: 'Self-Avoiding Walk', levy: 'Lévy Flight', brown: 'Brownian Motion', galton: 'Galton Board', ticker: '1D Random Walk', heat: 'Footprint Heat Map', lerw: 'Loop-Erased Walk' };
A({ id: 'al-walk', name: '隨機漫步', cat: CAT, theme: 'neon', hue: true, desc: '許多漫步者在格子上亂走，留下漸淡足跡',
  params: { mode: 'lattice' },
  variants: [
    { id: 'saw', name: '自迴避', theme: 'mint', desc: '不能踩回走過的路，直到把自己困住', params: { mode: 'saw' } },
    { id: 'levy', name: '李維飛行', theme: 'ice', desc: '小碎步之間偶爾來一次長途飛躍', params: { mode: 'levy' } },
    { id: 'brown', name: '布朗運動', theme: 'lavender', desc: '數百顆粒子從中心慢慢擴散', params: { mode: 'brown' } },
    { id: 'galton', name: '高爾頓板', theme: 'gold', desc: '小球穿過釘板，堆出鐘形曲線', params: { mode: 'galton' } },
    { id: 'ticker', name: '走勢線', theme: 'cyber', desc: '幾條隨機漫步曲線不斷向左捲動', params: { mode: 'ticker' } },
    { id: 'heat', name: '足跡熱圖', theme: 'fire', desc: '一個漫步者越常經過的地方越亮', params: { mode: 'heat' } },
    { id: 'lerw', name: '迴圈抹除', theme: 'sakura', desc: '走出迴圈就立刻抹掉的漫步路徑', params: { mode: 'lerw' } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows } = f, mode = p.mode;
    s.T = 0; s.acc = 0; s.mode = mode;
    s.U = Math.max(4, Math.floor(cols / 2)); s.V = rows;
    const N = s.U * s.V;
    if (mode === 'lattice') {
      s.tt = new Float32Array(N).fill(-99); s.who = new Uint8Array(N);
      s.walkers = Array.from({ length: cols >= 150 ? 12 : 5 }, (_, k) => ({ x: rint(0, s.U - 1), y: rint(0, s.V - 1), hue: (k * 360) / (cols >= 150 ? 12 : 5) }));
    } else if (mode === 'saw' || mode === 'lerw') {
      s.occ = new Int16Array(N).fill(-1); s.paths = []; s.cur = null; s.fade = 0;
      this.newWalk(s);
      // 先在背景走一段，讓畫面一開始就有幾條路徑
      for (let t = 0; t < 400 && s.cur && s.paths.length < (mode === 'saw' ? 10 : 4); t++) this.walkSteps(s, 50, cols);
    } else if (mode === 'levy') {
      s.D = new Dots(cols, rows); s.segs = []; s.pos = [cols, rows * 2]; s.fl = null;
      for (let k = 0; k < 160; k++) { this.levyFlight(s, cols * 2, rows * 4); s.segs.push([s.fl.x0, s.fl.y0, s.fl.x1, s.fl.y1, -(160 - k) * 0.22, s.fl.L]); s.pos = [s.fl.x1, s.fl.y1]; s.fl = null; }
    } else if (mode === 'brown') {
      s.D = new Dots(cols, rows); s.n = cols >= 150 ? 1100 : 260; s.pts = Array.from({ length: s.n }, () => [cols, rows * 2]); s.age = 0;
    } else if (mode === 'galton') {
      s.R = rows >= 40 ? 16 : 8; s.dx = clamp(Math.floor((cols * 0.7) / (s.R + 1)), 3, 10);
      s.rowH = Math.max(1, Math.floor((rows * 0.45) / s.R)); s.top = 3; s.cx = Math.floor(cols / 2);
      s.bins = new Int32Array(s.R + 1); s.balls = []; s.total = 0; s.binTop = s.top + s.R * s.rowH + 2;
    } else if (mode === 'ticker') {
      s.D = new Dots(cols, rows); s.K = cols >= 150 ? 6 : 4; s.W = cols * 2;
      s.ser = Array.from({ length: s.K }, () => ({ v: rnd(-0.3, 0.3), h: new Float32Array(s.W), n: 0 }));
      for (const q of s.ser) { for (let i = 0; i < s.W; i++) { q.v += gauss() * 0.02 - q.v * 0.004; q.h[i] = q.v; } q.n = s.W; }
    } else if (mode === 'heat') {
      s.cnt = new Float32Array(N); s.x = s.U >> 1; s.y = s.V >> 1; s.steps = 0; s.mx = 1;
    }
  },
  walkSteps(s, k, cols) {
    const mode = s.mode, U = s.U, V = s.V;
    while (k-- > 0 && s.cur) {
      const P = s.cur.path, c = P[P.length - 1], x = c % U, y = (c / U) | 0, opts = [];
      for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= U || ny >= V) { if (mode === 'lerw') opts.push(-1); continue; } const j = ny * U + nx; if (mode === 'lerw' || s.occ[j] < 0) opts.push(j); }
      if (mode === 'saw') {
        if (!opts.length) { s.paths.push(s.cur); s.cur = null; if (s.paths.length >= (cols >= 150 ? 36 : 12)) s.fade = 3; else this.newWalk(s); break; }
        // 稍微偏好直走，路徑比較長
        let j = pick(opts);
        if (P.length > 1) { const st = c + (c - P[P.length - 2]); if (opts.includes(st) && Math.random() < 0.45) j = st; }
        P.push(j); s.occ[j] = s.cur.id;
      } else {
        const j = pick(opts);
        if (j < 0 || s.occ[j] >= 0) { s.paths.push(s.cur); for (const q of P) s.occ[q] = s.cur.id; s.cur = null; if (s.paths.length >= (cols >= 150 ? 26 : 10)) s.fade = 3; else this.newWalk(s); break; }
        const at = P.indexOf(j);
        if (at >= 0) { P.length = at + 1; s.erased = (s.erased || 0) + 1; } else P.push(j);
      }
    }
  },
  levyFlight(s, W, H) {
    const L = Math.min(W * 0.6, 3 * Math.pow(Math.random(), -1 / 1.4)), a = rnd(0, TAU);
    let tx = s.pos[0] + Math.cos(a) * L, ty = s.pos[1] + Math.sin(a) * L * 0.9;
    if (tx < 4) tx = 8 - tx; if (tx > W - 5) tx = 2 * (W - 5) - tx; if (ty < 10) ty = 20 - ty; if (ty > H - 5) ty = 2 * (H - 5) - ty;
    tx = clamp(tx, 4, W - 5); ty = clamp(ty, 10, H - 5);
    s.fl = { x0: s.pos[0], y0: s.pos[1], x1: tx, y1: ty, u: 0, L: Math.max(1, Math.hypot(tx - s.pos[0], ty - s.pos[1])) };
  },
  newWalk(s) {
    const N = s.U * s.V;
    let st = -1;
    if (s.mode === 'lerw' && !s.paths.length) st = (s.V >> 1) * s.U + (s.U >> 1);
    else for (let t = 0; t < 500; t++) { const i = rint(0, N - 1); if (s.occ[i] < 0) { st = i; break; } }
    if (st < 0) { s.fade = 2.5; return; }
    s.cur = { path: [st], hue: rnd(0, 360), id: s.paths.length };
    if (s.mode === 'saw') s.occ[st] = s.cur.id;
  },
  frame(s, f) {
    const p = f.p, g = f.g, dt = f.dt, { cols, rows } = f, mode = s.mode, U = s.U, V = s.V;
    themed(s, f, this);
    s.T += dt;
    const ch = g.ch, co = g.co;
    let info = tr(f, WK_NAME[mode], WK_NAME_EN[mode]);
    if (mode === 'lattice') {
      let k = due(s, dt, 22, 10);
      while (k-- > 0) for (let w = 0; w < s.walkers.length; w++) {
        const W_ = s.walkers[w], d = D4[rint(0, 3)];
        W_.x = (W_.x + d[0] + U) % U; W_.y = (W_.y + d[1] + V) % V;
        const i = W_.y * U + W_.x; s.tt[i] = s.T; s.who[i] = w;
      }
      for (let y = 0; y < V; y++) for (let x = 0; x < U; x++) {
        const i = y * U + x, a = s.T - s.tt[i];
        if (a > 7) continue;
        const c = a < 0.12 ? '█' : a < 0.7 ? '▓' : a < 2 ? '▒' : a < 4 ? '░' : '·', col = hv(s, f, s.walkers[s.who[i]].hue, 0.2 + 0.55 * Math.exp(-a * 0.5), 0.15 + 0.8 * Math.exp(-a * 0.45));
        const k2 = y * cols + x * 2;
        ch[k2] = c; co[k2] = col; if (c !== '·') { ch[k2 + 1] = c; co[k2 + 1] = col; }
      }
      info += '  ' + s.walkers.length + tr(f, ' 個漫步者', ' walkers');
    } else if (mode === 'saw' || mode === 'lerw') {
      if (s.fade > 0) {
        s.fade -= dt;
        // 重新開始時也先在背景走一段，畫面不會只剩一條細線
        if (s.fade <= 0) this.init(s, f);
      } else if (s.cur) this.walkSteps(s, due(s, dt, mode === 'saw' ? 40 : 300, 60), cols);
      // 以框線畫出路徑
      const draw = (P, col, head) => {
        for (let k2 = 0; k2 < P.length; k2++) {
          const c = P[k2], x = c % U, y = (c / U) | 0;
          let bits = 0;
          for (const o of [P[k2 - 1], P[k2 + 1]]) { if (o === undefined) continue; const ox = o % U, oy = (o / U) | 0; bits |= oy < y ? 1 : oy > y ? 2 : ox < x ? 4 : 8; }
          if (!bits) bits = 4 | 8;
          const ci = y * cols + x * 2, cc = typeof col === 'function' ? col(k2, P.length) : col;
          ch[ci] = BOXJ[bits]; co[ci] = cc;
          if (bits & 8) { ch[ci + 1] = '─'; co[ci + 1] = cc; }
        }
        if (head && P.length) { const c = P[P.length - 1]; g.set((c % U) * 2, (c / U) | 0, '●', hv(s, f, 50, 0.95, 1)); }
      };
      const fadeK = s.fade > 0 ? Math.max(0, s.fade / 3) : 1;
      for (const q of s.paths) draw(q.path, (k2, n) => hv(s, f, q.hue, 0.3 * fadeK + 0.05, (0.25 + 0.25 * (k2 / n)) * fadeK));
      if (s.cur) draw(s.cur.path, (k2, n) => hv(s, f, s.cur.hue, 0.35 + 0.4 * (k2 / n), 0.4 + 0.6 * (k2 / n)), true);
      info += tr(f, '  第 ' + (s.paths.length + 1) + ' 條  長度 ', '  path #' + (s.paths.length + 1) + '  length ') + (s.cur ? s.cur.path.length : 0) + (mode === 'lerw' ? tr(f, '  已抹除迴圈 ', '  loops erased ') + (s.erased || 0) : '');
    } else if (mode === 'levy') {
      const D = s.D, W = cols * 2, H = rows * 4;
      if (!s.fl) this.levyFlight(s, W, H);
      const fl = s.fl;
      fl.u = Math.min(1, fl.u + (dt * (90 + fl.L * 3)) / fl.L);
      const cx = lerp(fl.x0, fl.x1, fl.u), cy = lerp(fl.y0, fl.y1, fl.u);
      if (fl.u >= 1) { s.segs.push([fl.x0, fl.y0, fl.x1, fl.y1, s.T, fl.L]); s.pos = [fl.x1, fl.y1]; s.fl = null; if (s.segs.length > 900) s.segs.shift(); }
      D.clear();
      for (const [x0, y0, x1, y1, t0, L] of s.segs) { const a = s.T - t0; if (a > 45) continue; const col = hv(s, f, L > 30 ? 300 : 190 + Math.min(60, L * 3), Math.max(0.15, 0.6 - a * 0.01), Math.max(0.14, 0.85 - a * 0.016)); D.line(x0, y0, x1, y1, col); D.dot(x1 + 1, y1, col); D.dot(x1, y1 + 1, col); }
      D.line(fl.x0, fl.y0, cx, cy, hv(s, f, 50, 0.9, 1));
      D.flush(g);
      g.set(cx / 2, cy / 4, '●', hv(s, f, 50, 0.95, 1));
      info += tr(f, '  第 ' + s.segs.length + ' 次飛行', '  flight #' + s.segs.length);
    } else if (mode === 'brown') {
      const D = s.D, W = cols * 2, H = rows * 4, cx = W / 2, cy = H / 2;
      s.age += dt;
      if (s.age > 26) { s.pts.forEach(q => { q[0] = cx; q[1] = cy; }); s.age = 0; }
      const sg = Math.sqrt(dt) * 9;
      D.clear();
      let r2 = 0;
      for (const q of s.pts) {
        q[0] += gauss() * sg * 1.05; q[1] += gauss() * sg;
        if (q[0] < 2 || q[0] > W - 3) q[0] = clamp(q[0], 2, W - 3);
        if (q[1] < 6 || q[1] > H - 3) q[1] = clamp(q[1], 6, H - 3);
        const d = Math.hypot(q[0] - cx, q[1] - cy); r2 += d * d;
        const bc = hv(s, f, 260 - Math.min(1, d / (H * 0.6)) * 200, 0.65, 0.95 - Math.min(0.6, d / H));
        D.dot(q[0], q[1], bc); D.dot(q[0] + 1, q[1], bc);
      }
      const rms = Math.sqrt(r2 / s.pts.length);
      for (let k = 0; k < 90; k++) { const a = (k / 90) * TAU; D.dot(cx + Math.cos(a) * rms, cy + Math.sin(a) * rms, f.C(0.3)); }
      D.flush(g);
      info += '  ' + s.pts.length + tr(f, ' 顆粒子  均方根距離 ', ' particles  RMS distance ') + rms.toFixed(0) + ' ∝ √t';
    } else if (mode === 'galton') {
      const R = s.R, dx = s.dx, rowH = s.rowH, top = s.top, cx = s.cx;
      // 落下夠多顆球後，長條在 1.2 秒內淡出再重新累積（高度一直自動縮放，不會超出畫面）
      if (!s.gfade && s.total > (R > 8 ? 2500 : 800)) s.gfade = 1.2;
      if (s.gfade > 0) { s.gfade -= dt; if (s.gfade <= 0) { s.bins.fill(0); s.total = 0; s.gfade = 0; } }
      const fk = s.gfade > 0 ? s.gfade / 1.2 : 1;
      s.acc += dt * (R > 8 ? 16 : 7);
      while (s.acc >= 1) { s.acc -= 1; s.balls.push({ r: 0, k: 0, u: 0, nx: Math.random() < 0.5 ? 0 : 1 }); }
      const pegC = f.C(0.4);
      for (let r = 0; r < R; r++) for (let k = 0; k <= r; k++) g.set(cx + (k - r / 2) * dx, top + r * rowH + 1, '•', pegC);
      const maxH = rows - s.binTop - 1;
      for (let i = s.balls.length - 1; i >= 0; i--) {
        const b = s.balls[i];
        b.u += dt * 9;
        if (b.u >= 1) {
          b.u -= 1; b.k += b.nx; b.r++;
          if (b.r >= R) { s.bins[b.k]++; s.total++; s.balls.splice(i, 1); continue; }
          b.nx = Math.random() < 0.5 ? 0 : 1;
        }
        const x0 = cx + (b.k - b.r / 2) * dx, x1 = cx + (b.k + b.nx - (b.r + 1) / 2) * dx, y = top + b.r * rowH + b.u * rowH - Math.sin(b.u * Math.PI) * 0.8;
        g.set(lerp(x0, x1, b.u), y, 'o', hv(s, f, 40 + b.r * 6, 0.75, 0.9));
      }
      const mxb = Math.max(1, ...s.bins), scale = Math.max(mxb, 10) / maxH;
      for (let k = 0; k <= R; k++) {
        const h8 = Math.round((s.bins[k] / scale) * 8), x = Math.round(cx + (k - R / 2) * dx - (dx - 1) / 2), col = hv(s, f, 30 + (k / R) * 40, 0.55 * fk, (0.45 + 0.4 * (s.bins[k] / mxb)) * fk);
        for (let q = 0; q < dx - 1; q++) for (let r = 0; r * 8 < h8; r++) { const lv = Math.min(8, h8 - r * 8); g.set(x + q, rows - 1 - r, EIGHTH[lv], col); }
        // 理論的二項分布
        let c = 1; for (let j = 0; j < k; j++) c = (c * (R - j)) / (j + 1);
        const exp = (s.total * c) / 2 ** R, ey = rows - 1 - exp / scale;
        if (exp > 0.5) g.set(x + ((dx - 1) >> 1), ey, '·', f.C(0.95 * fk));
      }
      info += '  ' + R + tr(f, ' 排釘子  已落下 ' + s.total + ' 顆', ' rows of pegs  balls dropped ' + s.total);
    } else if (mode === 'ticker') {
      const D = s.D, W = s.W, H = rows * 4, mid = H / 2 + 2;
      s.acc += dt * 30;
      let k = Math.floor(s.acc);
      s.acc -= k;
      if (k > 0) for (const q of s.ser) { for (let j = 0; j < k; j++) { q.v += gauss() * 0.02 - q.v * 0.004; q.h.copyWithin(0, 1); q.h[W - 1] = q.v; } }
      D.clear();
      for (let x = 0; x < W; x += 3) D.dot(x, mid, f.C(0.25));
      s.ser.forEach((q, si) => {
        const col = hv(s, f, (si * 360) / s.K + 20, 0.6, 0.35 + (0.6 * si) / s.K);
        const sc = H * 1.05, Y = v => clamp(mid - v * sc, 6, H - 2);
        let py = Y(q.h[0]);
        for (let x = 1; x < W; x++) { const y = Y(q.h[x]); D.line(x - 1, py, x, y, col); py = y; }
      });
      D.flush(g);
      s.ser.forEach((q, si) => { const y = clamp(mid - q.v * H * 1.05, 6, H - 2) / 4; if (cols >= 60) g.text(cols - 7, clamp(y, 1, rows - 1), (q.v >= 0 ? '+' : '') + q.v.toFixed(2), hv(s, f, (si * 360) / s.K + 20, 0.8, 0.9)); });
    } else if (mode === 'heat') {
      let k = due(s, dt, 380, 60);
      while (k-- > 0) {
        const d = D4[rint(0, 3)];
        s.x = clamp(s.x + d[0], 0, U - 1); s.y = clamp(s.y + d[1], 0, V - 1);
        const i = s.y * U + s.x; s.cnt[i]++; if (s.cnt[i] > s.mx) s.mx = s.cnt[i]; s.steps++;
      }
      if (s.steps > 60000) { s.cnt.fill(0); s.mx = 1; s.steps = 0; s.x = U >> 1; s.y = V >> 1; }
      const lm = Math.log(1 + s.mx);
      for (let y = 0; y < V; y++) for (let x = 0; x < U; x++) {
        const c = s.cnt[y * U + x];
        if (!c) continue;
        const e = Math.log(1 + c) / lm, k2 = y * cols + x * 2, chr = RAMP10[1 + Math.min(8, (e * 9) | 0)], col = f.C(0.2 + e * 0.8);
        ch[k2] = chr; co[k2] = col; ch[k2 + 1] = chr; co[k2 + 1] = col;
      }
      g.set(s.x * 2, s.y, '█', hv(s, f, 60, 0.95, 1)); g.set(s.x * 2 + 1, s.y, '█', hv(s, f, 60, 0.95, 1));
      info += '  ' + s.steps + tr(f, ' 步  最常經過 ' + s.mx + ' 次', ' steps  max visits ' + s.mx);
    }
    tag(g, 2, 0, info, f.C(0.85));
  } });

/* ════════ 15. 樹狀結構 ════════ */
// 旋轉：把 x 轉到父節點的位置（左右自動判斷）
function trRot(T, x) {
  const p = x.p, g = p.p;
  if (p.l === x) { p.l = x.r; if (x.r) x.r.p = p; x.r = p; } else { p.r = x.l; if (x.l) x.l.p = p; x.l = p; }
  p.p = x; x.p = g;
  if (!g) T.root = x; else if (g.l === p) g.l = x; else g.r = x;
  T.rots++;
}
const trH = n => (n ? n.h : 0);
const trUpd = n => { n.h = 1 + Math.max(trH(n.l), trH(n.r)); };
function trNode(k, x, y) { return { k, l: null, r: null, p: null, h: 1, red: true, x, y, tx: x, ty: y, hl: 1 }; }
function trInsert(T, nd) {
  if (!T.root) { T.root = nd; nd.p = null; return; }
  let c = T.root;
  for (;;) { if (nd.k < c.k) { if (!c.l) { c.l = nd; break; } c = c.l; } else { if (!c.r) { c.r = nd; break; } c = c.r; } }
  nd.p = c;
}
function trAVLFix(T, n) {
  while (n) {
    trUpd(n);
    const b = trH(n.l) - trH(n.r);
    if (b > 1) { const y = n.l; if (trH(y.l) >= trH(y.r)) { trRot(T, y); trUpd(n); trUpd(y); n = y; } else { const x = y.r; trRot(T, x); trRot(T, x); trUpd(n); trUpd(y); trUpd(x); n = x; } T.flash = ['右旋', 'rotate right']; }
    else if (b < -1) { const y = n.r; if (trH(y.r) >= trH(y.l)) { trRot(T, y); trUpd(n); trUpd(y); n = y; } else { const x = y.l; trRot(T, x); trRot(T, x); trUpd(n); trUpd(y); trUpd(x); n = x; } T.flash = ['左旋', 'rotate left']; }
    n = n.p;
  }
}
function trRBFix(T, z) {
  while (z.p && z.p.red) {
    const p = z.p, g = p.p;
    if (!g) break;
    const left = p === g.l, y = left ? g.r : g.l;
    if (y && y.red) { p.red = false; y.red = false; g.red = true; z = g; T.flash = ['變色', 'recolor']; continue; }
    if ((left && z === p.r) || (!left && z === p.l)) { trRot(T, z); z = p; }
    z.p.red = false; g.red = true; trRot(T, z.p); T.flash = ['旋轉', 'rotate'];
  }
  T.root.red = false;
}
function trDelete(T, z) {
  const tp = (u, v) => { if (!u.p) T.root = v; else if (u === u.p.l) u.p.l = v; else u.p.r = v; if (v) v.p = u.p; };
  if (!z.l) tp(z, z.r);
  else if (!z.r) tp(z, z.l);
  else {
    let y = z.r;
    while (y.l) y = y.l;
    if (y.p !== z) { tp(y, y.r); y.r = z.r; y.r.p = y; }
    tp(z, y); y.l = z.l; y.l.p = y;
  }
}
function trWalk(T, fn) { (function w(n, d) { if (!n) return; w(n.l, d + 1); fn(n, d); w(n.r, d + 1); })(T.root, 0); }
function trFind(T, k) { const path = []; let c = T.root; while (c) { path.push(c); if (k === c.k) break; c = k < c.k ? c.l : c.r; } return path; }
// 線條緩衝：累積上下左右連線，最後轉成框線字元
class LineBuf {
  constructor(cols, rows) { this.cols = cols; this.rows = rows; this.b = new Uint8Array(cols * rows); this.c = new Array(cols * rows); }
  clear() { this.b.fill(0); }
  h(x0, x1, y, col) { if (y < 0 || y >= this.rows) return; x0 = Math.max(0, x0); x1 = Math.min(this.cols - 1, x1); for (let x = x0; x <= x1; x++) { const i = y * this.cols + x; this.b[i] |= (x > x0 ? 4 : 0) | (x < x1 ? 8 : 0); this.c[i] = col; } }
  v(x, y0, y1, col) { if (x < 0 || x >= this.cols) return; y0 = Math.max(0, y0); y1 = Math.min(this.rows - 1, y1); for (let y = y0; y <= y1; y++) { const i = y * this.cols + x; this.b[i] |= (y > y0 ? 1 : 0) | (y < y1 ? 2 : 0); this.c[i] = col; } }
  flush(g) { for (let i = 0; i < this.b.length; i++) if (this.b[i]) { g.ch[i] = BOXJ[this.b[i]]; g.co[i] = this.c[i]; } }
}
const TR_NAME = { bst: '二元搜尋樹', avl: 'AVL 平衡樹', rb: '紅黑樹', splay: '伸展樹', heap: '二元堆積', quad: '四分樹', kd: 'K-D 樹' };
const TR_NAME_EN = { bst: 'Binary Search Tree', avl: 'AVL Tree', rb: 'Red-Black Tree', splay: 'Splay Tree', heap: 'Binary Heap', quad: 'Quadtree', kd: 'k-d Tree' };
A({ id: 'al-tree', name: '樹狀結構', cat: CAT, theme: 'forest', hue: true, desc: '二元搜尋樹一邊插入一邊長高，再逐一刪除',
  params: { mode: 'bst', rate: 2.2 },
  variants: [
    { id: 'avl', name: 'AVL', theme: 'ice', desc: '照順序插入也能靠旋轉保持平衡', params: { mode: 'avl', rate: 2.4 } },
    { id: 'rb', name: '紅黑樹', theme: 'blood', desc: '紅黑節點交替，變色與旋轉維持平衡', params: { mode: 'rb', rate: 2.2 } },
    { id: 'splay', name: '伸展樹', theme: 'lavender', desc: '被查詢的節點一路旋轉到樹根', params: { mode: 'splay', rate: 4 } },
    { id: 'heap', name: '堆積', theme: 'amber', desc: '最小堆積上浮下沉，取出成排序序列', params: { mode: 'heap', rate: 4 } },
    { id: 'quad', name: '四分樹', theme: 'cyber', desc: '點一多就切成四塊的空間索引', params: { mode: 'quad', rate: 7 } },
    { id: 'kd', name: 'K-D 樹', theme: 'mint', desc: '縱橫交替切割平面的 K-D 樹', params: { mode: 'kd', rate: 5 } },
  ],
  init(s, f) {
    const p = f.p, { cols, rows } = f;
    Object.assign(s, { T: 0, acc: 0, wait: 0, fade: 0, msg: '' });
    s.D = new Dots(cols, rows);
    s.cap = clamp(Math.floor((cols - 4) / (cols >= 150 ? 5 : 3)), 8, p.mode === 'splay' ? 40 : 60);
    s.maxDepth = clamp(Math.floor((rows - 5) / 3), 4, 14);
    if (p.mode === 'quad' || p.mode === 'kd') {
      s.LB = new LineBuf(cols, rows); s.pts = []; s.cap = cols >= 150 ? 240 : 60;
      s.blobs = Array.from({ length: 3 }, () => ({ x: rnd(0.15, 0.85) * cols, y: rnd(0.2, 0.85) * rows, a: rnd(0, TAU) }));
      s.root = p.mode === 'quad' ? { x0: 0, y0: 1, x1: cols - 1, y1: rows - 1, pts: [], kids: null, born: -9, d: 0 } : null;
      return;
    }
    s.Tr = { root: null, rots: 0, flash: '', n: 0 };
    s.keys = []; s.phase = 'ins'; s.probe = null;
    if (p.mode === 'heap') {
      s.cap = cols >= 200 ? 63 : cols >= 120 ? 31 : 15; s.arr = []; s.out = [];
      // 先放一半，畫面一開始就有一棵樹
      for (let q = 0; q < s.cap >> 1; q++) { const nd = { k: rint(1, 99), x: cols / 2, y: rows / 2, hl: 0 }; s.arr.push(nd); let i = s.arr.length - 1; while (i > 0 && s.arr[(i - 1) >> 1].k > s.arr[i].k) { const pi = (i - 1) >> 1; [s.arr[pi], s.arr[i]] = [s.arr[i], s.arr[pi]]; i = pi; } }
      s.gen = this.heapGen(s, f);
    }
    if (p.mode === 'avl') s.nextK = rint(1, 6);
    if (p.mode === 'bst' || p.mode === 'avl' || p.mode === 'rb') {
      const n0 = Math.floor(s.cap * 0.4);
      for (let q = 0; q < n0; q++) {
        let k;
        if (p.mode === 'avl') { k = s.nextK; s.nextK += rint(1, 3); }
        else { do k = rint(1, 99); while (s.keys.includes(k)); }
        const nd = trNode(k, cols / 2, 2); nd.hl = 0;
        trInsert(s.Tr, nd); s.Tr.n++; s.keys.push(k);
        if (p.mode === 'avl') trAVLFix(s.Tr, nd.p);
        if (p.mode === 'rb') trRBFix(s.Tr, nd);
      }
      s.Tr.rots = 0; s.Tr.flash = '';
      this.layout(s, f, true);
      if (s.depth >= s.maxDepth && p.mode === 'bst') s.phase = 'del';
    }
    if (p.mode === 'splay') {
      const ks = shuffle(Array.from({ length: s.cap }, (_, i) => i + 1));
      for (const k of ks) { const nd = trNode(k, cols / 2, 2); trInsert(s.Tr, nd); s.Tr.n++; nd.hl = 0; }
      s.rank = shuffle(ks.slice()); s.phase = 'idle';
      this.layout(s, f, true);
    }
  },
  layout(s, f, snap) {
    const Tr = s.Tr, list = [];
    let md = 0;
    trWalk(Tr, (n, d) => { list.push([n, d]); if (d > md) md = d; });
    s.depth = md;
    const lh = clamp(Math.floor((f.rows - 5) / Math.max(1, md)), 2, 12), sp = (f.cols - 4) / Math.max(1, list.length);
    list.forEach(([n, d], i) => { n.tx = 2 + (i + 0.5) * sp; n.ty = 2 + d * lh; if (snap) { n.x = n.tx; n.y = n.ty; } });
    s.sp = sp;
  },
  *heapGen(s, f) {
    const arr = s.arr;
    for (;;) {
      while (arr.length < s.cap) {
        const k = rint(1, 99), nd = { k, x: f.cols / 2, y: f.rows - 3, hl: 1 };
        arr.push(nd); s.msg = ['插入 ' + k, 'insert ' + k];
        let i = arr.length - 1;
        yield;
        while (i > 0) { const pi = (i - 1) >> 1; s.cmp = [arr[i], arr[pi]]; if (arr[pi].k <= arr[i].k) break; [arr[pi], arr[i]] = [arr[i], arr[pi]]; i = pi; s.msg = ['上浮 ' + k, 'sift up ' + k]; yield; }
        s.cmp = null;
      }
      yield; yield;
      s.out.length = 0;
      while (arr.length) {
        const top = arr[0];
        top.hl = 1; top.out = s.out.length; s.out.push(top); s.msg = ['取出最小值 ' + top.k, 'extract min ' + top.k];
        const last = arr.pop();
        if (arr.length) {
          arr[0] = last; yield;
          let i = 0;
          for (;;) {
            let c = 2 * i + 1;
            if (c >= arr.length) break;
            if (c + 1 < arr.length && arr[c + 1].k < arr[c].k) c++;
            s.cmp = [arr[i], arr[c]];
            if (arr[i].k <= arr[c].k) break;
            [arr[i], arr[c]] = [arr[c], arr[i]]; i = c; s.msg = ['下沉 ' + arr[i].k, 'sift down ' + arr[i].k]; yield;
          }
          s.cmp = null;
        } else yield;
      }
      s.msg = ['堆積排序完成', 'heapsort done'];
      for (let k = 0; k < 8; k++) yield;
    }
  },
  step(s, f) {
    const p = f.p, Tr = s.Tr, mode = p.mode;
    if (mode === 'heap') { s.gen.next(); return; }
    if (s.probe) {
      const pr = s.probe;
      pr.i++;
      if (pr.i < pr.path.length) return;
      // 探針走完：執行插入／刪除／伸展
      if (pr.op === 'ins') {
        const last = pr.path[pr.path.length - 1], nd = trNode(pr.k, last ? last.x : f.cols / 2, last ? last.y + 2 : 2);
        trInsert(Tr, nd); Tr.n++; s.keys.push(pr.k);
        if (mode === 'avl') trAVLFix(Tr, nd.p);
        if (mode === 'rb') trRBFix(Tr, nd);
        s.msg = ['插入 ' + pr.k + (Tr.flash ? '  ' + Tr.flash[0] : ''), 'insert ' + pr.k + (Tr.flash ? '  ' + Tr.flash[1] : '')];
      } else if (pr.op === 'del') {
        const nd = pr.path[pr.path.length - 1];
        trDelete(Tr, nd); Tr.n--; s.keys.splice(s.keys.indexOf(pr.k), 1); s.msg = ['刪除 ' + pr.k, 'delete ' + pr.k];
      } else if (pr.op === 'splay') { s.splay = pr.path[pr.path.length - 1]; s.splay.hl = 1; s.msg = ['存取 ' + pr.k + '，伸展到樹根', 'access ' + pr.k + ', splay to root']; }
      s.probe = null; this.layout(s, f);
      return;
    }
    if (s.splay) {
      const x = s.splay, pp = x.p;
      if (!pp) { s.splay = null; return; }
      const g = pp.p;
      if (!g) trRot(Tr, x);
      else if ((g.l === pp) === (pp.l === x)) { trRot(Tr, pp); trRot(Tr, x); }
      else { trRot(Tr, x); trRot(Tr, x); }
      this.layout(s, f);
      return;
    }
    Tr.flash = '';
    if (mode === 'splay') {
      const k = s.rank[Math.floor(s.rank.length * Math.random() ** 2.2)];
      s.probe = { k, path: trFind(Tr, k), i: 0, op: 'splay' };
      return;
    }
    if (s.phase === 'ins') {
      if (Tr.n >= s.cap || s.depth >= s.maxDepth) { s.phase = mode === 'bst' ? 'del' : 'fade'; s.fadeT = 0; return; }
      let k;
      if (mode === 'avl') { k = s.nextK; s.nextK += rint(1, 3); if (s.nextK > 99) { s.phase = 'fade'; return; } }
      else { for (let t = 0; t < 200; t++) { k = rint(1, 99); if (!s.keys.includes(k)) break; } if (s.keys.includes(k)) { s.phase = mode === 'bst' ? 'del' : 'fade'; return; } }
      const path = [];
      let c = Tr.root;
      while (c) { path.push(c); c = k < c.k ? c.l : c.r; }
      s.probe = { k, path, i: 0, op: 'ins' };
    } else if (s.phase === 'del') {
      if (!s.keys.length) { s.phase = 'ins'; return; }
      const k = pick(s.keys);
      s.probe = { k, path: trFind(Tr, k), i: 0, op: 'del' };
    }
  },
  frame(s, f) {
    const p = f.p, g = f.g, dt = f.dt, mode = p.mode, { cols, rows } = f, D = s.D;
    themed(s, f, this);
    s.T += dt;
    if (mode === 'quad' || mode === 'kd') { this.spatial(s, f); return; }
    if (s.phase === 'fade') { s.fadeT = (s.fadeT || 0) + dt; if (s.fadeT > 2.5) { this.init(s, f); return this.frame(s, f); } }
    else { let k = due(s, dt, p.rate * (s.probe ? 2.5 : 1) * (s.splay ? 1.5 : 1), 4); while (k-- > 0) this.step(s, f); }
    const fadeK = s.phase === 'fade' ? Math.max(0, 1 - s.fadeT / 2.5) : 1;
    // 收集節點與連線
    const nodes = [], edges = [];
    if (mode === 'heap') {
      const arr = s.arr, md = Math.max(1, Math.floor(Math.log2(Math.max(1, s.cap)))), lh = clamp(Math.floor((rows - 8) / md), 2, 15);
      arr.forEach((nd, i) => { const d = Math.floor(Math.log2(i + 1)), j = i - (2 ** d - 1), cnt = 2 ** d; nd.tx = 2 + ((j + 0.5) * (cols - 4)) / cnt; nd.ty = 2 + d * lh; nodes.push([nd, d]); if (i) edges.push([arr[(i - 1) >> 1], nd]); });
      const ow = Math.max(3, Math.min(5, Math.floor((cols - 4) / Math.max(1, s.cap))));
      s.out.forEach((nd, i) => { nd.tx = 2 + i * ow + 1; nd.ty = rows - 2; nodes.push([nd, -1]); });
    } else trWalk(s.Tr, (n, d) => { nodes.push([n, d]); if (n.l) edges.push([n, n.l]); if (n.r) edges.push([n, n.r]); });
    const k2 = Math.min(1, dt * 6);
    for (const [n] of nodes) { n.x += (n.tx - n.x) * k2; n.y += (n.ty - n.y) * k2; n.hl = Math.max(0, (n.hl || 0) - dt * 0.8); }
    D.clear();
    const eC = f.C(0.3 * fadeK + 0.05);
    for (const [a, b] of edges) D.line(a.x * 2, a.y * 4 + 3, b.x * 2, b.y * 4 - 1, eC);
    if (s.probe && s.probe.path.length) {
      const pth = s.probe.path, i = Math.min(s.probe.i, pth.length - 1);
      for (let q = 1; q <= i; q++) D.line(pth[q - 1].x * 2, pth[q - 1].y * 4 + 3, pth[q].x * 2, pth[q].y * 4 - 1, hv(s, f, 50, 0.8, 0.95));
    }
    D.flush(g);
    const wide = (s.sp || 9) >= 4.2 || mode === 'heap';
    for (const [n, d] of nodes) {
      let col, lab = String(n.k);
      if (mode === 'rb') { col = n.red ? hv(s, f, 0, 0.6, 0.95) : f.C(0.55); lab = wide ? (n.red ? '<' + n.k + '>' : '[' + n.k + ']') : lab; }
      else if (mode === 'avl') { const b = trH(n.l) - trH(n.r); col = b === 0 ? hv(s, f, 160, 0.55, 0.65) : hv(s, f, 50, 0.6, 0.85); lab = wide ? '(' + n.k + ')' : lab; }
      else if (mode === 'heap') { col = d < 0 ? hv(s, f, 40, 0.6, 0.9) : hv(s, f, 30 + (n.k / 99) * 160, 0.55, 0.4 + (n.k / 99) * 0.5); }
      else { col = hv(s, f, 90 + d * 25, 0.5, 0.45 + Math.min(0.5, d * 0.06)); lab = wide ? '(' + n.k + ')' : lab; }
      if (n.hl > 0.05) col = hv(s, f, 50, 0.6 + n.hl * 0.3, 0.7 + n.hl * 0.3);
      if (s.cmp && s.cmp.includes(n)) col = hv(s, f, 320, 0.75, 1);
      if (fadeK < 1) col = f.C(0.55 * fadeK);
      const w = lab.length, x = Math.round(n.x - w / 2), y = Math.round(n.y);
      for (let q = -1; q <= w; q++) g.set(x + q, y, ' ', col);
      g.text(x, y, lab, col);
    }
    if (s.probe && s.probe.path.length) {
      const pth = s.probe.path, i = Math.min(s.probe.i, pth.length - 1), nd = pth[i], lab = String(s.probe.k);
      g.text(Math.round(nd.x + 3), Math.round(nd.y) - 1, (s.probe.op === 'ins' ? '+' : s.probe.op === 'del' ? '-' : '?') + lab, hv(s, f, 50, 0.9, 1));
    }
    let info = tr(f, TR_NAME[mode] + '  節點 ', TR_NAME_EN[mode] + '  nodes ') + (mode === 'heap' ? s.arr.length : s.Tr.n);
    if (mode !== 'heap') info += tr(f, '  高度 ', '  height ') + (s.depth + 1) + tr(f, '  旋轉 ', '  rotations ') + s.Tr.rots;
    if (s.msg) info += '  ' + tr(f, s.msg[0], s.msg[1]);
    tag(g, 2, 0, info, f.C(0.85));
  },
  spatial(s, f) {
    const p = f.p, g = f.g, dt = f.dt, { cols, rows } = f, LB = s.LB, quad = p.mode === 'quad';
    if (s.fade > 0) { s.fade -= dt; if (s.fade <= 0) { this.init(s, f); return this.frame(s, f); } }
    else {
      let k = due(s, dt, p.rate, 6);
      while (k-- > 0) {
        if (s.pts.length >= s.cap) { s.fade = 2.5; break; }
        const b = pick(s.blobs), u = Math.random() < 0.25;
        const pt = { x: clamp(u ? rnd(1, cols - 2) : b.x + gauss() * cols * 0.07, 1, cols - 2), y: clamp(u ? rnd(2, rows - 2) : b.y + gauss() * rows * 0.1, 2, rows - 2), t: s.T };
        s.pts.push(pt);
        if (quad) this.qtIns(s, s.root, pt);
        else this.kdIns(s, pt);
      }
      for (const b of s.blobs) { b.a += dt * 0.2; b.x = clamp(b.x + Math.cos(b.a) * dt * 3, cols * 0.1, cols * 0.9); b.y = clamp(b.y + Math.sin(b.a * 1.3) * dt * 1.2, rows * 0.15, rows * 0.9); }
    }
    const fadeK = s.fade > 0 ? s.fade / 2.5 : 1;
    LB.clear();
    let nodes = 0, maxd = 0;
    if (quad) {
      const walk = n => {
        nodes++; maxd = Math.max(maxd, n.d);
        const age = s.T - n.born;
        if (age < 0.7) { const col = hv(s, f, 190, 0.3 * (1 - age / 0.7), 0.25 * (1 - age / 0.7)); for (let y = n.y0 + 1; y < n.y1; y++) for (let x = n.x0 + 1; x < n.x1; x++) g.set(x, y, '░', col); }
        if (!n.kids) return;
        const mx = (n.x0 + n.x1) >> 1, my = (n.y0 + n.y1) >> 1, col = hv(s, f, 150 + n.d * 30, 0.35 + 0.1 * fadeK, (0.5 - n.d * 0.05) * fadeK + 0.1);
        LB.h(n.x0, n.x1, my, col); LB.v(mx, n.y0, n.y1, col);
        n.kids.forEach(walk);
      };
      walk(s.root);
    } else {
      const walk = (n, d) => {
        if (!n) return;
        nodes++; maxd = Math.max(maxd, d);
        const u = Math.min(1, (s.T - n.born) / 0.5), col = hv(s, f, n.ax ? 300 : 170, 0.45, (0.55 - d * 0.03) * fadeK + 0.1);
        if (n.ax === 0) { const c = Math.round((n.r.y0 + n.r.y1) / 2), half = ((n.r.y1 - n.r.y0) / 2) * u; LB.v(Math.round(n.pt.x), Math.round(lerp(c, n.r.y0, u)), Math.round(c + half), col); }
        else { const c = Math.round((n.r.x0 + n.r.x1) / 2), half = ((n.r.x1 - n.r.x0) / 2) * u; LB.h(Math.round(lerp(c, n.r.x0, u)), Math.round(c + half), Math.round(n.pt.y), col); }
        walk(n.l, d + 1); walk(n.g, d + 1);
      };
      walk(s.root, 0);
    }
    // 外框（兩種空間索引都畫，一開始還沒有點時畫面也不會空白）
    const bc = f.C(0.4 * fadeK + 0.1);
    LB.h(0, cols - 1, 1, bc); LB.h(0, cols - 1, rows - 1, bc); LB.v(0, 1, rows - 1, bc); LB.v(cols - 1, 1, rows - 1, bc);
    LB.flush(g);
    for (const pt of s.pts) { const a = s.T - pt.t; g.set(pt.x, pt.y, a < 0.4 ? '●' : '•', a < 0.4 ? hv(s, f, 50, 0.95, 1) : hv(s, f, 45, 0.7 * fadeK, 0.85 * fadeK)); }
    tag(g, 2, 0, tr(f, TR_NAME[p.mode] + '  ' + s.pts.length + ' 點  ' + nodes + ' 個節點  深度 ' + maxd,
      TR_NAME_EN[p.mode] + '  points ' + s.pts.length + '  nodes ' + nodes + '  depth ' + maxd), f.C(0.85));
  },
  qtIns(s, n, pt) {
    if (n.kids) { const mx = (n.x0 + n.x1) >> 1, my = (n.y0 + n.y1) >> 1; this.qtIns(s, n.kids[(pt.x > mx ? 1 : 0) + (pt.y > my ? 2 : 0)], pt); return; }
    n.pts.push(pt);
    if (n.pts.length > 3 && n.x1 - n.x0 >= 4 && n.y1 - n.y0 >= 2) {
      const mx = (n.x0 + n.x1) >> 1, my = (n.y0 + n.y1) >> 1, d = n.d + 1, T = s.T;
      n.kids = [{ x0: n.x0, y0: n.y0, x1: mx, y1: my }, { x0: mx, y0: n.y0, x1: n.x1, y1: my }, { x0: n.x0, y0: my, x1: mx, y1: n.y1 }, { x0: mx, y0: my, x1: n.x1, y1: n.y1 }].map(r => Object.assign(r, { pts: [], kids: null, born: T, d }));
      n.born = T;
      const old = n.pts; n.pts = [];
      for (const q of old) this.qtIns(s, n, q);
    }
  },
  kdIns(s, pt) {
    const { cols, rows } = { cols: s.LB.cols, rows: s.LB.rows };
    const nd = { pt, l: null, g: null, born: s.T };
    if (!s.root) { nd.ax = 0; nd.r = { x0: 0, y0: 1, x1: cols - 1, y1: rows - 1 }; s.root = nd; return; }
    let c = s.root;
    for (;;) {
      const less = c.ax === 0 ? pt.x < c.pt.x : pt.y < c.pt.y, r = c.r;
      const sub = c.ax === 0 ? (less ? { x0: r.x0, y0: r.y0, x1: Math.round(c.pt.x), y1: r.y1 } : { x0: Math.round(c.pt.x), y0: r.y0, x1: r.x1, y1: r.y1 })
        : (less ? { x0: r.x0, y0: r.y0, x1: r.x1, y1: Math.round(c.pt.y) } : { x0: r.x0, y0: Math.round(c.pt.y), x1: r.x1, y1: r.y1 });
      const nx = less ? c.l : c.g;
      if (!nx) { nd.ax = 1 - c.ax; nd.r = sub; if (less) c.l = nd; else c.g = nd; return; }
      c = nx;
    }
  } });

})();
