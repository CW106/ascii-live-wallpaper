// 科技主題（te- 開頭）：系統日誌、十六進位檢視、示波器、生理監視、頻譜、系統監視、網路拓樸、電路板、
// 資料洪流、訊號干擾、測試畫面、進度條、行情看板、航線地圖、神經網路、聲納。所有文字都是自己編的假資料。
(() => {
/* ───────── 共用工具 ───────── */
const HX = '0123456789ABCDEF';
const hx = (v, n) => { v = Math.floor(Math.abs(v)); let s = ''; for (let k = 0; k < n; k++) { s = HX[v % 16] + s; v = Math.floor(v / 16); } return s; };
const pad = (v, n) => String(v).padStart(n, ' ');
const pad0 = (v, n) => String(v).padStart(n, '0');
const wideC = c => { const k = c.charCodeAt(0); return k >= 0x2e80 && k < 0xff61; };
const mix32 = a => { a |= 0; a = Math.imul(a ^ (a >>> 16), 0x7feb352d); a = Math.imul(a ^ (a >>> 15), 0x846ca68b); return (a ^ (a >>> 16)) >>> 0; };
const hash2 = (a, b) => mix32(Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263));
const sstep = v => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
const fmtT = sec => { sec = Math.floor(sec) % 86400; return pad0((sec / 3600) | 0, 2) + ':' + pad0(((sec / 60) | 0) % 60, 2) + ':' + pad0(sec % 60, 2); };
const kill = (arr, k) => { arr[k] = arr[arr.length - 1]; arr.pop(); };
// 介面語言：f.lang === 'en' 時畫英文（舊版核心沒有 f.lang，一律當中文）
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
// 雙語文字：字串原樣回傳；[中文, English] 依語言取一個（存在狀態裡的文字用這個，切換語言時會跟著換）
const txt2 = (v, en) => (typeof v === 'string' ? v : v[en ? 1 : 0]);

// 寫字串（含空白，會覆蓋），自動處理全形字，超過 x1 截斷
function put(g, x, y, s, col, x1) {
  y = Math.floor(y); x = Math.floor(x);
  if (y < 0 || y >= g.rows) return x;
  if (x1 === undefined || x1 > g.cols) x1 = g.cols;
  const ch = g.ch, co = g.co, r = y * g.cols;
  for (let k = 0; k < s.length; k++) {
    const c = s[k], w = wideC(c);
    if (x >= x1 || (w && x + 1 >= x1)) return x;
    if (x >= 0) { ch[r + x] = c; co[r + x] = col; if (w) { ch[r + x + 1] = ' '; } }
    x += w ? 2 : 1;
  }
  return x;
}
// 只寫非空白字元（透明背景）
function putT(g, x, y, s, col, x1) {
  y = Math.floor(y); x = Math.floor(x);
  if (y < 0 || y >= g.rows) return x;
  if (x1 === undefined || x1 > g.cols) x1 = g.cols;
  const ch = g.ch, co = g.co, r = y * g.cols;
  for (let k = 0; k < s.length; k++) {
    const c = s[k], w = wideC(c);
    if (x >= x1 || (w && x + 1 >= x1)) return x;
    if (x >= 0 && c !== ' ') { ch[r + x] = c; co[r + x] = col; if (w) ch[r + x + 1] = ' '; }
    x += w ? 2 : 1;
  }
  return x;
}
const strW = s => { let w = 0; for (let k = 0; k < s.length; k++) w += wideC(s[k]) ? 2 : 1; return w; };
function fillR(g, x0, y0, w, h, c, col) {
  const xa = Math.max(0, Math.floor(x0)), ya = Math.max(0, Math.floor(y0)), xb = Math.min(g.cols, Math.floor(x0 + w)), yb = Math.min(g.rows, Math.floor(y0 + h));
  for (let y = ya; y < yb; y++) for (let i = y * g.cols + xa, e = y * g.cols + xb; i < e; i++) { g.ch[i] = c; g.co[i] = col; }
}
function clearR(g, x0, y0, w, h) { fillR(g, x0, y0, w, h, ' ', '#000000'); }
// 方框（可帶標題），樣式：0 細線、1 圓角、2 雙線
const BOXS = ['─│┌┐└┘', '─│╭╮╰╯', '═║╔╗╚╝'];
function box(g, x0, y0, w, h, col, title, tcol, st) {
  x0 = Math.floor(x0); y0 = Math.floor(y0); w = Math.floor(w); h = Math.floor(h);
  if (w < 2 || h < 2) return;
  const B = BOXS[st || 0], x1 = x0 + w - 1, y1 = y0 + h - 1;
  for (let x = x0 + 1; x < x1; x++) { g.set(x, y0, B[0], col); g.set(x, y1, B[0], col); }
  for (let y = y0 + 1; y < y1; y++) { g.set(x0, y, B[1], col); g.set(x1, y, B[1], col); }
  g.set(x0, y0, B[2], col); g.set(x1, y0, B[3], col); g.set(x0, y1, B[4], col); g.set(x1, y1, B[5], col);
  if (title && w > 6) put(g, x0 + 2, y0, ' ' + title + ' ', tcol || col, x1 - 1);
}
// 水平條：frac 0–1，寬 w，字元 full/empty，可有 1/8 精細尾端
const EIGHTH = ' ▏▎▍▌▋▊▉█';
const VEIGHT = ' ▁▂▃▄▅▆▇█';
function hbar(g, x, y, w, frac, colOn, colOff, emptyCh) {
  frac = clamp(frac, 0, 1);
  const v = frac * w, full = Math.floor(v), part = Math.floor((v - full) * 8);
  for (let k = 0; k < w; k++) {
    if (k < full) g.set(x + k, y, '█', colOn);
    else if (k === full && part > 0) g.set(x + k, y, EIGHTH[part], colOn);
    else if (emptyCh) g.set(x + k, y, emptyCh, colOff);
  }
}
// 迷你走勢（▁▂▃…█）
function spark(g, x, y, w, arr, n, head, lo, hi, col) {
  for (let k = 0; k < w; k++) {
    const idx = (head - w + k + n * 4) % n, v = clamp((arr[idx] - lo) / (hi - lo || 1), 0, 1);
    g.set(x + k, y, VEIGHT[1 + Math.round(v * 7)], typeof col === 'function' ? col(v) : col);
  }
}

// 3×5 點陣大字（用 sx×sy 放大，預設以 █ 填滿）
const F3 = {};
(() => {
  const d = {
    '0': '###,# #,# #,# #,###', '1': ' # ,## , # , # ,###', '2': '###,  #,###,#  ,###', '3': '###,  #, ##,  #,###', '4': '# #,# #,###,  #,  #',
    '5': '###,#  ,###,  #,###', '6': '###,#  ,###,# #,###', '7': '###,  #,  #, # , # ', '8': '###,# #,###,# #,###', '9': '###,# #,###,  #,###',
    'A': ' # ,# #,###,# #,# #', 'B': '## ,# #,## ,# #,## ', 'C': ' ##,#  ,#  ,#  , ##', 'D': '## ,# #,# #,# #,## ', 'E': '###,#  ,## ,#  ,###',
    'F': '###,#  ,## ,#  ,#  ', 'G': ' ##,#  ,# #,# #, ##', 'H': '# #,# #,###,# #,# #', 'I': '###, # , # , # ,###', 'J': '  #,  #,  #,# #, # ',
    'K': '# #,# #,## ,# #,# #', 'L': '#  ,#  ,#  ,#  ,###', 'M': '# #,###,###,# #,# #', 'N': '## ,# #,# #,# #,# #', 'O': ' # ,# #,# #,# #, # ',
    'P': '## ,# #,## ,#  ,#  ', 'Q': ' # ,# #,# #,## , ##', 'R': '## ,# #,## ,# #,# #', 'S': ' ##,#  , # ,  #,## ', 'T': '###, # , # , # , # ',
    'U': '# #,# #,# #,# #,###', 'V': '# #,# #,# #,# #, # ', 'W': '# #,# #,###,###,# #', 'X': '# #,# #, # ,# #,# #', 'Y': '# #,# #, # , # , # ',
    'Z': '###,  #, # ,#  ,###', '%': '# #,  #, # ,#  ,# #', '.': '   ,   ,   ,   , # ', ':': '   , # ,   , # ,   ', '-': '   ,   ,###,   ,   ',
    '/': '  #,  #, # ,#  ,#  ', '+': '   , # ,###, # ,   ', ' ': '   ,   ,   ,   ,   ', '>': '#  , # ,  #, # ,#  ', '<': '  #, # ,#  , # ,  #',
    '!': ' # , # , # ,   , # ', '?': '###,  #, ##,   , # ', '=': '   ,###,   ,###,   ', '_': '   ,   ,   ,   ,###', '^': ' # ,# #,   ,   ,   ',
  };
  for (const k in d) F3[k] = d[k].split(',');
})();
const bigW = (s, sx) => s.length * 4 * sx - sx;
function big(g, x, y, s, sx, sy, col, c) {
  c = c || '█'; x = Math.floor(x); y = Math.floor(y);
  for (let n = 0; n < s.length; n++) {
    const F = F3[s[n]] || F3[' '];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (F[r][q] === '#')
      for (let a = 0; a < sy; a++) for (let b = 0; b < sx; b++) g.set(x + q * sx + b, y + r * sy + a, c, typeof col === 'function' ? col(q * sx + b, r * sy + a) : col);
    x += 4 * sx;
  }
}

// 點字畫布：每格 2×4 個子像素，畫細線與曲線用
const BR = []; for (let i = 0; i < 256; i++) BR.push(String.fromCharCode(0x2800 + i));
const BB = [0x01, 0x02, 0x04, 0x40, 0x08, 0x10, 0x20, 0x80]; // [x*4+y]
function bnew(cols, rows) { return { W: cols * 2, Hh: rows * 4, cols, rows, bits: new Uint8Array(cols * rows), val: new Float32Array(cols * rows), tag: new Uint8Array(cols * rows) }; }
function bclr(b) { b.bits.fill(0); b.val.fill(0); }
function bdot(b, x, y, v, tag) {
  if (x < 0 || y < 0 || x >= b.W || y >= b.Hh) return;
  x |= 0; y |= 0;
  const i = (y >> 2) * b.cols + (x >> 1);
  b.bits[i] |= BB[(x & 1) * 4 + (y & 3)];
  if (v >= b.val[i]) { b.val[i] = v; if (tag !== undefined) b.tag[i] = tag; }
}
function bline(b, x0, y0, x1, y1, v, tag) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
  if (n > 4000) return;
  for (let k = 0; k <= n; k++) bdot(b, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, v, tag);
}
// 把點字畫布寫進字元格；colf(val, tag, i) 回傳顏色
function bflush(g, b, colf) {
  const ch = g.ch, co = g.co, bits = b.bits, val = b.val, tag = b.tag;
  for (let i = 0; i < bits.length; i++) if (bits[i]) { ch[i] = BR[bits[i]]; co[i] = colf(val[i], tag[i], i); }
}

// 色彩代號：日誌與表格用（有 hue 時是真的色相，否則退回主題亮度）
function kcols(s, f) {
  if (s._kC === f.C && s._kH === f.H) return s._K;
  const C = f.C, H = f.H;
  const K = [C(0.3), C(0.62), C(0.97), H(120, 0.56), H(48, 0.62), H(2, 0.58), H(190, 0.62), H(300, 0.62), C(0.45), H(28, 0.6)];
  for (let k = 0; k < 12; k++) K.push(H(k * 30 + 15, 0.62));
  s._kC = f.C; s._kH = f.H; s._K = K;
  return K;
}
// 一行 = [[文字, 色彩代號], ...]；文字可以是 [中文, English]，en 為真時畫英文
function drawSegs(g, x, y, segs, x1, K, en) {
  for (let n = 0; n < segs.length; n++) { x = putT(g, x, y, txt2(segs[n][0], en), K[segs[n][1]], x1); if (x >= x1) return; }
}

// 假資料字庫
const WORDS = ['alpha', 'beta', 'core', 'node', 'flux', 'delta', 'omega', 'nova', 'orbit', 'pulse', 'vector', 'kernel', 'shard', 'relay', 'cipher', 'quartz', 'ember', 'nimbus', 'vertex', 'photon', 'lumen', 'atlas', 'comet', 'prism', 'drift', 'tensor', 'spark', 'helix', 'zenith', 'pixel'];
const SVCN = ['Network Manager', 'Device Events', 'Journal Writer', 'Task Scheduler', 'Secure Shell', 'Message Bus', 'Audit Logger', 'Time Sync', 'Name Resolver', 'Packet Filter', 'Storage Pool', 'Login Manager', 'Swap Space', 'Thermal Monitor', 'Wireless Radio', 'Print Spooler', 'Backup Agent', 'Cache Warmer', 'Metrics Collector', 'Power Profiles', 'Display Server', 'Input Methods', 'Sound System', 'Module Loader', 'Entropy Seed', 'Host Naming', 'Locale Setup', 'Firmware Update', 'Disk Quota', 'Container Runtime'];
const TARGETS = ['Local File Systems', 'Network', 'Basic System', 'Sockets', 'Timers', 'Paths', 'Swap', 'Multi-User System', 'Graphical Interface', 'Remote Storage'];
const DIRS = ['core', 'net', 'io', 'gfx', 'audio', 'util', 'db', 'ui', 'crypto', 'sched', 'mem', 'fs'];
const NICKS = ['nyx', 'k0ji', 'mira', 'tofu', 'pixel', 'rin', 'zed', 'lumen', 'haru', 'byte', 'echo', 'sora'];
// 聊天訊息：[中文, English]（存成一對，畫的時候才依 f.lang 取，切換語言時舊訊息也會跟著換）
const CHAT = [['有人在嗎？', 'anyone here?'], ['剛剛部署完了', 'just finished deploying'], ['測試全部通過 ✓', 'all tests passed ✓'], ['build 又壞了…', 'build broke again…'], ['誰動了設定檔', 'who touched the config?'], ['咖啡續杯中', 'refilling my coffee'], ['rebase 完成', 'rebase done'], ['今晚 23:00 停機維護', 'maintenance tonight at 23:00'], ['lgtm', 'lgtm'], ['ping', 'ping'], ['pong', 'pong'], ['記憶體用量又飆高', 'memory usage spiking again'], ['我先去吃飯', 'grabbing lunch'], ['已重啟服務', 'service restarted'], ['延遲降到 12ms 了', 'latency down to 12ms'], ['外面下大雨', 'pouring rain outside'], ['週五不要上線啦', 'no deploys on Friday!'], ['好', 'sure'], ['收到', 'copy that'], ['ok', 'ok'], ['brb', 'brb'], ['有人看到我的鍵盤嗎', 'has anyone seen my keyboard?'], ['merge 衝突了', 'merge conflict'], ['CI 綠燈', 'CI is green'], ['新版快好了', 'new release almost ready'], ['日誌量是平常的三倍', 'log volume is 3x normal'], ['快取命中率 97%', 'cache hit rate 97%'], ['我來看一下', "I'll take a look"], ['已開工單', 'ticket filed'], ['回滾到上一版', 'rolled back one version'], ['監控圖看起來正常', 'dashboards look normal'], ['誰有空幫忙 review', 'anyone free to review?'], ['這個 bug 好詭異', 'this bug is so weird'], ['原來是時區問題', 'turns out it was time zones'], ['感謝！', 'thanks!'], ['先別碰正式環境', "don't touch prod yet"], ['hotfix 已上', 'hotfix is live'], ['負載平衡器換好了', 'load balancer swapped'], ['凌晨三點的警報…', '3 a.m. alerts…'], ['睡覺了 晚安', 'off to bed, good night']];
const COMMIT = ['fix: handle empty buffer in relay', 'feat: add retry with backoff', 'refactor: split parser module', 'docs: update setup notes', 'test: cover cache edge cases', 'chore: bump dependencies', 'perf: avoid copy in hot path', 'fix: off-by-one in ring index', 'feat: stream logs over socket', 'style: format with new rules', 'fix: race in shutdown hook', 'feat: dark mode for console', 'refactor: rename vertex pool', 'fix: guard against null config', 'feat: add metrics endpoint', 'perf: batch disk writes', 'test: flaky timer test fixed', 'feat: support unicode paths', 'fix: memory leak in cache', 'build: speed up release job'];
const AUTH = ['mira', 'koji', 'sora', 'haru', 'lin', 'chen', 'wu', 'tsai', 'nova', 'rin'];
const PKGS = ['libflux', 'nimbus-core', 'quartz-utils', 'orbit-tools', 'photon-dev', 'ember-fonts', 'helix-net', 'prism-gfx', 'atlas-maps', 'comet-cli', 'tensor-math', 'lumen-ui', 'drift-sync', 'vertex-io', 'zenith-db', 'spark-rt'];
const ip = () => pick(['10.', '10.', '172.16.', '192.168.']) + rint(0, 255) + '.' + rint(1, 254) + (Math.random() < 0.5 ? '.' + rint(1, 254) : '.' + rint(1, 99));
const ip4 = () => { const s = ip().split('.'); return s.slice(0, 4).join('.'); };

/* ═════════ 1. 終端日誌 ═════════ */
// 每種日誌一個產生器：回傳要加入的行（陣列）
const LOGGEN = {
  boot(st) {
    st.kt = (st.kt || 0) + rnd(0.004, 0.08);
    const ts = ['[' + pad(st.kt.toFixed(6), 12) + '] ', 0];
    st.n = (st.n || 0) + 1;
    if (st.n < st.kn) {
      const m = pick([
        () => `pci 0000:${hx(rint(0, 15), 2)}:${hx(rint(0, 31), 2)}.${rint(0, 7)}: enabling bus mastering`,
        () => `usb ${rint(1, 4)}-${rint(1, 8)}: new high-speed device #${rint(2, 30)} attached`,
        () => `cpu${rint(0, 31)}: core online, freq ${rint(18, 52) / 10} GHz`,
        () => `mem: ${rint(16, 128) * 1024}K/${131072}K available`,
        () => `fs (disk0p${rint(1, 4)}): mounted volume, journal ok`,
        () => `rng: entropy pool ready (${rint(128, 512)} bits)`,
        () => `net: registered protocol family ${rint(2, 40)}`,
        () => `clock: switched to stable timer source`,
        () => `acpi: ${pick(['power button', 'lid switch', 'thermal zone', 'sleep button'])} [${hx(rint(0, 255), 4)}] found`,
        () => `ssd0: ${rint(2, 16)}/${rint(16, 64)} io queues, firmware ${rint(1, 9)}.${rint(0, 9)}`,
        () => `eth0: link up, ${pick(['1000', '2500', '10000'])} Mbps full duplex`,
      ])();
      return [[ts, [m, 1]]];
    }
    if (st.n === st.kn) return [[['', 0]], [['        ', 0], ['Nimbus OS 7.2 starting user space…', 2]], [['', 0]]];
    if (st.n > st.kn + st.un) {
      st.n = 0; st.kt = 0; st.kn = rint(25, 45); st.un = rint(90, 150); st.wait = 3.5;
      return [[['', 0]], [['Nimbus OS 7.2  node-' + pad0(rint(1, 99), 2) + '  tty1', 2]], [['', 0]], [['node login: ', 1], ['_', 2]], 'CLEAR'];
    }
    const nm = pick(SVCN), r = Math.random();
    if (r < 0.06) return [[['[', 1], ['FAILED', 5], ['] ', 1], ['Failed to start ' + nm + '.', 1]], [['         ', 0], ['See status log for details.', 0]]];
    if (r < 0.14) return [[['[ ', 1], ['WAIT', 4], [' ] ', 1], ['A start job is running for ' + nm + ' (' + rint(1, 9) + 's / 1min 30s)', 1]]];
    if (r < 0.34) return [[['         Starting ', 1], [nm + '…', 2]]];
    if (r < 0.44) return [[['[  ', 1], ['OK', 3], ['  ] ', 1], ['Reached target ', 1], [pick(TARGETS), 2], ['.', 1]]];
    if (r < 0.52) return [[['[  ', 1], ['OK', 3], ['  ] ', 1], ['Mounted ', 1], ['/' + pick(['boot', 'home', 'var/log', 'srv/data', 'mnt/cache', 'opt']), 2], ['.', 1]]];
    return [[['[  ', 1], ['OK', 3], ['  ] ', 1], ['Started ', 1], [nm, 2], ['.', 1]]];
  },
  compile(st) {
    st.n = (st.n || 0) + 1;
    if (st.pct === undefined) st.pct = 0;
    if (st.pct >= 100) {
      st.pct = 0; st.wait = 2.5; st.builds = (st.builds || 0) + 1;
      return [[['[100%] ', 2], ['Built target ', 3], [pick(WORDS) + '-app', 2]], [['== build finished: ', 1], ['0 errors', 3], [', ', 1], [st.warn + ' warnings', 4], [', ' + rint(18, 95) + 's ==', 1]], [['', 0]], [['$ ', 3], ['build --all --jobs 16', 2]]];
    }
    if (st.pct === 0) st.warn = 0;
    st.pct = Math.min(100, st.pct + (Math.random() < 0.55 ? 1 : 0));
    const P = '[' + pad(st.pct, 3) + '%] ', dir = pick(DIRS), file = pick(WORDS) + '_' + pick(['io', 'map', 'pool', 'util', 'parse', 'view', 'task']);
    const r = Math.random();
    if (r < 0.07) {
      st.warn++;
      const ln = rint(20, 900), col = rint(5, 30), v = pick(['tmp', 'len', 'ctx', 'buf', 'idx']);
      return [[[`src/${dir}/${file}.c:${ln}:${col}: `, 2], ['warning: ', 7], [`unused variable '${v}'`, 2], [' [-Wunused-variable]', 0]],
        [[pad(ln, 5) + ' |     int ' + v + ' = ' + pick(['len * 2', 'count + 1', '0', 'size >> 3']) + ';', 1]],
        [['      |         ', 1], ['^' + '~'.repeat(v.length - 1), 3]]];
    }
    if (r < 0.12) return [[[P, 2], ['Linking C static library ', 6], ['lib' + pick(WORDS) + '.a', 2]]];
    if (r < 0.15) return [[[P, 2], ['Generating ', 9], [pick(WORDS) + '_tables.h', 1]]];
    return [[[P, 2], ['Building C object ', 3], [`build/obj/${dir}/${pick(WORDS)}/${file}.o`, 1]]];
  },
  access(st) {
    st.sec = (st.sec || 50000) + rnd(0, 0.6);
    const r = Math.random(), code = r < 0.72 ? 200 : r < 0.8 ? 304 : r < 0.85 ? 201 : r < 0.91 ? 404 : r < 0.94 ? 301 : r < 0.96 ? 403 : r < 0.985 ? 500 : 503;
    const m = Math.random(), meth = m < 0.7 ? 'GET' : m < 0.88 ? 'POST' : m < 0.95 ? 'PUT' : 'DELETE';
    const path = pick([
      () => `/api/v2/items/${rint(100, 9999)}`, () => `/static/js/app.${hx(rint(0, 65535), 4).toLowerCase()}.js`, () => '/login', () => '/health',
      () => `/api/v2/search?q=${pick(WORDS)}&page=${rint(1, 9)}`, () => `/img/${pick(WORDS)}.png`, () => '/metrics', () => `/u/${pick(NICKS)}/feed`,
      () => `/api/v2/orders/${rint(1000, 99999)}/status`, () => '/favicon.ico', () => `/docs/${pick(DIRS)}/${pick(WORDS)}.html`])();
    const ms = code >= 500 ? rint(300, 2400) : Math.random() < 0.1 ? rint(120, 600) : rint(2, 90);
    st.last = { code, path, ms };
    const ck = code < 300 ? 3 : code < 400 ? 6 : code < 500 ? 4 : 5;
    return [[[pad(ip4(), 15) + ' ', 0], ['[' + fmtT(st.sec) + '] ', 8], ['"', 1], [meth, 2], [' ' + path + ' HTTP/1.1" ', 1], [String(code), ck], [' ' + pad(code === 304 ? 0 : rint(80, 48000), 6), 1], [' ' + pad(ms, 4) + 'ms', ms > 200 ? 5 : 0], ['  ' + pick(['client/3.2', 'mobile/5.1', 'fetch/2.0', 'crawler/1.4', 'desk/8.0']), 0]]];
  },
  chat(st) {
    st.sec = (st.sec || 51000) + rnd(2, 40);
    const T = ['[' + fmtT(st.sec).slice(0, 5) + '] ', 0], nk = pick(NICKS), nc = 10 + NICKS.indexOf(nk), r = Math.random();
    if (r < 0.06) { const a = rint(0, 9), b = rint(2, 250); return [[T, ['--> ', 3], [nk, nc], [[` (${nk}@10.0.${a}.${b}) 加入了 #ops`, ` (${nk}@10.0.${a}.${b}) joined #ops`], 0]]]; }
    if (r < 0.1) { const why = pick([['逾時', 'timed out'], ['下班', 'off shift'], ['重新連線', 'reconnecting'], ['睡覺', 'sleeping']]); return [[T, ['<-- ', 5], [nk, nc], [[' 離開了（' + why[0] + '）', ' left (' + why[1] + ')'], 0]]]; }
    if (r < 0.15) { const act = pick([['去倒咖啡', 'goes to pour coffee'], ['伸了個懶腰', 'stretches'], ['把風扇開到最大', 'turns the fans up to max'], ['重開了機器', 'reboots the box'], ['默默按下部署', 'quietly hits deploy']]); return [[T, [' * ', 7], [nk, nc], [[' ' + act[0], ' ' + act[1]], 7]]]; }
    const msg = pick(CHAT);
    return [[T, ['<', 0], [pad(nk, 6), nc], ['> ', 0], [msg, Math.random() < 0.1 ? 2 : 1]]];
  },
  vcs(st) {
    if (!st.lanes) st.lanes = 1;
    const n = st.lanes, r = Math.random(), graph = [];
    const lane = k => [k === -1 ? '' : '', 0];
    const gl = (chars) => { // chars: 每個軌道的字元
      const segs = [];
      for (let k = 0; k < chars.length; k++) segs.push([chars[k], chars[k] === ' ' ? 0 : 10 + (k >> 1) % 12]);
      return segs;
    };
    if (r < 0.12 && n < 5) {
      const c = []; for (let k = 0; k < n; k++) c.push('|', ' '); c[2 * n - 1] = '\\';
      st.lanes = n + 1; return [gl(c)];
    }
    if (r < 0.22 && n > 1) {
      const c = []; for (let k = 0; k < n - 1; k++) c.push('|', ' '); c[2 * (n - 1) - 1] = '/';
      st.lanes = n - 1;
      const c2 = []; const at = rint(0, n - 2); for (let k = 0; k < n - 1; k++) c2.push(k === at ? '*' : '|', ' ');
      return [gl(c), [...gl(c2), [' ' + hx(rint(0, 0xfffffff), 7).toLowerCase(), 4], [' Merge branch \'' + pick(['feature', 'fix', 'exp']) + '/' + pick(WORDS) + '\'', 2], [' (' + rint(1, 59) + ' min ago)', 3], [' <' + pick(AUTH) + '>', 6]]];
    }
    const at = rint(0, n - 1), c = [];
    for (let k = 0; k < n; k++) c.push(k === at ? '*' : '|', ' ');
    while (c.length < 10) c.push(' ');
    const refs = Math.random() < 0.08 ? [' (tag: v' + rint(1, 4) + '.' + rint(0, 12) + '.' + rint(0, 9) + ')', 9] : Math.random() < 0.05 ? [' (HEAD -> main)', 6] : ['', 0];
    return [[...gl(c), [hx(rint(0, 0xfffffff), 7).toLowerCase(), 4], refs, [' ' + pick(COMMIT), 1], [' (' + rint(2, 59) + ' ' + pick(['min', 'hours', 'days']) + ' ago)', 3], [' <' + pick(AUTH) + '>', 6]]];
  },
  install(st) {
    st.n = (st.n || 0) + 1;
    if (!st.q || !st.q.length) {
      st.q = [];
      const list = [...PKGS].sort(() => Math.random() - 0.5).slice(0, rint(6, 10));
      list.forEach((p, k) => st.q.push(['get', p, k + 1]));
      list.forEach(p => st.q.push(['unpack', p]));
      list.forEach(p => st.q.push(['setup', p]));
      st.q.push(['done', list.length]);
      st.ver = {}; list.forEach(p => (st.ver[p] = rint(1, 6) + '.' + rint(0, 20) + '.' + rint(0, 9)));
    }
    const [k, p, a] = st.q.shift(), v = st.ver[p];
    if (k === 'get') return [[['Get:' + a + ' ', 3], ['https://mirror.example.test/pool/main ', 0], [p + ' ' + v, 2], [' [' + rint(12, 9000) + ' kB]', 1]]];
    if (k === 'unpack') return [[['Selecting previously unselected package ', 1], [p, 2], ['.', 1]], [['Preparing to unpack …/' + p + '_' + v + '_amd64.pkg …', 0]], [['Unpacking ', 6], [p + ' (' + v + ') …', 1]]];
    if (k === 'setup') return [[['Setting up ', 3], [p + ' (' + v + ') …', 1]]];
    st.wait = 2.5;
    return [[['Processing triggers for ', 1], ['shared-cache', 2], [' …', 1]], [[p + ' packages installed, 0 removed, 0 not upgraded.', 2]], [['', 0]], [['$ ', 3], ['pkg install ' + pick(PKGS) + ' ' + pick(PKGS), 2]]];
  },
};

function logState(kind, rate) { return { kind, rate, lines: [], acc: 0, wait: 0, kn: rint(25, 45), un: rint(90, 150) }; }
function logPush(st, out, max) {
  for (const L of out) {
    if (L === 'CLEAR') { st.clearAt = 3.5; continue; }
    st.lines.push(L);
  }
  if (st.lines.length > max) st.lines.splice(0, st.lines.length - max);
}
function logStep(st, dt, max) {
  if (st.clearAt !== undefined) { st.clearAt -= dt; if (st.clearAt <= 0) { st.clearAt = undefined; st.lines.length = 0; } return; }
  if (st.wait > 0) { st.wait -= dt; return; }
  // 偶爾停頓、偶爾一口氣冒出一串
  st.acc += dt * st.rate * (st.burst > 0 ? 6 : 1);
  st.burst = (st.burst || 0) - dt;
  if (Math.random() < dt * 0.25) st.burst = rnd(0.2, 0.8);
  let guard = 0;
  while (st.acc >= 1 && guard++ < 40) {
    st.acc -= 1;
    logPush(st, LOGGEN[st.kind](st), max);
    if (st.wait > 0 || st.clearAt !== undefined) { st.acc = 0; break; }
  }
}
function logDraw(g, st, x0, y0, w, h, K, cursor, t, en) {
  const L = st.lines, n = Math.min(h, L.length), start = L.length - n;
  for (let k = 0; k < n; k++) drawSegs(g, x0, y0 + k, L[start + k], x0 + w, K, en);
  if (cursor && Math.floor(t * 2) % 2 === 0 && n < h + 1) {
    const yy = y0 + Math.min(n, h - 1);
    if (n < h) g.set(x0, yy, '█', K[2]);
  }
}

// 伺服器牆：主機與各角色的日誌內容
const WALL_HOSTS = ['web-01', 'api-01', 'db-main', 'cache-01', 'web-02', 'queue-01', 'worker-01', 'auth-01', 'edge-01', 'api-02', 'db-replica', 'worker-02', 'search-01', 'media-01', 'web-03', 'edge-02'];
const WALL_MSG = {
  web: () => pick(['GET', 'GET', 'POST', 'PUT']) + ' ' + pick(['/', '/home', '/cart', '/search?q=' + pick(WORDS), '/img/' + pick(WORDS) + '.png', '/static/app.js']) + ' ' + pick([200, 200, 200, 304, 301]) + ' ' + rint(2, 90) + 'ms',
  edge: () => 'cache ' + pick(['HIT', 'HIT', 'HIT', 'MISS']) + ' /' + pick(WORDS) + '/' + pick(WORDS) + ' ' + rint(1, 40) + 'ms',
  api: () => pick(['GET', 'POST', 'PATCH']) + ' /v2/' + pick(['orders', 'items', 'users', 'feeds']) + '/' + rint(100, 9999) + ' ' + pick([200, 200, 201, 204]) + ' ' + rint(4, 120) + 'ms',
  db: () => pick(['query ok rows=' + rint(1, 900) + ' ' + rnd(0.2, 9).toFixed(1) + 'ms', 'checkpoint: wrote ' + rint(100, 9000) + ' buffers', 'autovacuum: ' + pick(['orders', 'items', 'events']) + ' ' + rint(2, 80) + ' pages', 'wal segment ' + hx(rint(0, 0xffffff), 8) + ' archived']),
  cache: () => pick(['hit ratio ' + rnd(94, 99.5).toFixed(1) + '%', 'evicted ' + rint(10, 900) + ' keys', 'keys=' + rint(1, 9) + '.' + rint(0, 9) + 'M mem=' + rint(40, 80) + '%', 'expired ' + rint(10, 400) + ' keys']),
  queue: () => pick(['consumed ' + rint(5, 90) + ' msgs from ' + pick(['orders.new', 'mail.out', 'thumbs']), 'depth ' + rint(0, 400) + ' lag ' + rint(0, 900) + 'ms', 'ack batch ' + rint(10, 200)]),
  worker: () => 'job #' + rint(10000, 99999) + ' ' + pick(['resize', 'export', 'email', 'index', 'report']) + ' done ' + rint(20, 2400) + 'ms',
  auth: () => pick(['token issued uid=' + rint(1000, 99999), 'session refresh ok', 'login ok uid=' + rint(1000, 99999), 'mfa verified uid=' + rint(1000, 99999)]),
  search: () => 'q="' + pick(WORDS) + '" hits=' + rint(0, 9000) + ' ' + rint(3, 80) + 'ms',
  media: () => 'transcode ' + pick(WORDS) + '.mp4 ' + rint(10, 99) + '% ' + rnd(1, 6).toFixed(1) + 'x',
};
const WALL_WARN = ['slow query ' + 812 + 'ms', 'retrying request (2/3)', 'gc pause 180ms', 'queue depth 4200', 'cert expires in 14 days', 'p99 latency 920ms', 'pool 90% in use', 'clock drift 40ms'];
const WALL_ERR = ['upstream timeout (3000ms)', 'connection refused :5432', 'disk /var 95% full', 'out of memory, worker killed', 'TLS handshake failed', 'replication lag 12.4s', 'deadlock detected', 'health check failed 503', 'too many open files'];
LOGGEN.svc = st => {
  st.sec = (st.sec || 40000) + rnd(0.05, 1.2);
  const T = [fmtT(st.sec) + ' ', 0], r = Math.random();
  if (r < 0.004 + (st.hot > 0 ? 0.09 : 0)) { st.err = 1; return [[T, ['ERROR ', 5], [pick(WALL_ERR), 2]]]; }
  if (r < 0.05 + (st.hot > 0 ? 0.1 : 0)) return [[T, ['WARN  ', 4], [pick(WALL_WARN), 1]]];
  if (r < 0.1) return [[T, ['DEBUG ', 0], [pick(['tick', 'heartbeat ok', 'config reloaded', 'conn pool ' + rint(4, 64) + '/64', 'gc ' + rint(2, 40) + 'ms']), 0]]];
  return [[T, ['INFO  ', 3], [(WALL_MSG[st.role] || WALL_MSG.web)(), 1]]];
};
// 韌體設定：分頁與項目。第一個字元：> 子選單、! 動作、= 唯讀資訊、- 分隔標題
const EN2 = ['Enabled', 'Disabled'], DIS2 = ['Disabled', 'Enabled'];
const BIOS_TABS = [
  ['Main', [['System Time', 'TIME'], ['System Date', 'DATE'], ['=BIOS Version', '4.20.1 (TE-9000)'], ['=Processor', 'CPU'], ['=Total Memory', '65536 MB'], ['Memory Speed', ['Auto', '4800 MT/s', '5200 MT/s', '5600 MT/s']], ['Language', ['English', 'Français', 'Deutsch']], ['=Access Level', 'Administrator']]],
  ['Advanced', [['>CPU Configuration'], ['Hyper-Threading', EN2], ['Virtualization', EN2], ['C-States', ['Auto', 'Enabled', 'Disabled']], ['Turbo Mode', EN2], ['SATA Mode', ['AHCI', 'RAID']], ['USB Legacy Support', EN2], ['Network Stack', DIS2], ['PCIe ASPM', ['Auto', 'L0s', 'L1', 'Disabled']], ['Fan Profile', ['Balanced', 'Silent', 'Performance', 'Full Speed']], ['>PC Health Status']]],
  ['Chipset', [['-Graphics'], ['Primary Display', ['Auto', 'PCIe', 'Onboard']], ['Above 4G Decoding', EN2], ['Re-Size BAR', ['Auto', 'Disabled']], ['-Onboard Devices'], ['PCIe Link Speed', ['Auto', 'Gen3', 'Gen4', 'Gen5']], ['Onboard Audio', EN2], ['Onboard LAN', EN2], ['Deep Sleep', DIS2], ['Restore on AC Loss', ['Power Off', 'Power On', 'Last State']]]],
  ['Boot', [['Boot Option #1', ['NVMe: TE-SSD 1TB', 'USB: Flash Drive', 'Network: PXE IPv4']], ['Boot Option #2', ['USB: Flash Drive', 'NVMe: TE-SSD 1TB', 'Network: PXE IPv4']], ['Boot Option #3', ['Network: PXE IPv4', 'USB: Flash Drive', 'NVMe: TE-SSD 1TB']], ['Fast Boot', EN2], ['Boot Logo', DIS2], ['NumLock State', ['On', 'Off']], ['Boot Mode', ['UEFI', 'UEFI + Legacy']], ['Menu Timeout', ['3 s', '5 s', '10 s', '1 s']]]],
  ['Security', [['=Administrator Password', 'Not Installed'], ['=User Password', 'Not Installed'], ['>Set Administrator Password'], ['Secure Boot', EN2], ['TPM Device', EN2], ['Chassis Intrusion', DIS2], ['Erase Drive on Next Boot', DIS2]]],
  ['Save & Exit', [['!Save Changes and Reset'], ['!Discard Changes and Exit'], ['!Load Optimized Defaults'], ['!Save as User Defaults'], ['-Boot Override'], ['!NVMe: TE-SSD 1TB'], ['!USB: Flash Drive'], ['!Network: PXE IPv4']]],
];
const BIOS_HELP = {
  'System Time': 'Set the system time. Use Tab to switch between hour, minute and second.',
  'System Date': 'Set the system date. Format is weekday month/day/year.',
  'Hyper-Threading': 'Run two hardware threads on each physical core.',
  'Virtualization': 'Allow a virtual machine monitor to use hardware assist features.',
  'Turbo Mode': 'Let cores run above base frequency when power and thermal limits allow.',
  'Fan Profile': 'Choose how aggressively the fans react to temperature changes.',
  'Secure Boot': 'Only start boot loaders that are signed with a trusted key.',
  'Fast Boot': 'Skip some device checks during start-up to boot faster.',
  'Save Changes and Reset': 'Save all changes and restart the system.',
  'Load Optimized Defaults': 'Restore the recommended value for every setting.',
};
// 英文斷行
function wrapTxt(s, w) {
  const out = []; let ln = '';
  for (const word of s.split(' ')) { if ((ln + ' ' + word).trim().length > w) { if (ln) out.push(ln); ln = word; } else ln = (ln + ' ' + word).trim(); }
  if (ln) out.push(ln);
  return out;
}

A({ id: 'te-log', name: '終端日誌', cat: '科技', theme: 'amber', hue: true, desc: '開機時一行行亮起的服務啟動訊息',
  params: { kind: 'boot', rate: 16, layout: 'full' },
  variants: [
    { id: 'compile', name: '編譯中', theme: 'mint', desc: '程式編譯進度、警告與底部進度條', params: { kind: 'compile', rate: 14, layout: 'build' } },
    { id: 'access', name: '存取紀錄', theme: 'ice', desc: '伺服器請求紀錄與右側即時統計', params: { kind: 'access', rate: 12, layout: 'access' } },
    { id: 'chat', name: '聊天室', theme: 'lavender', desc: '值班工程師的聊天頻道與輸入列', params: { kind: 'chat', rate: 1.6, layout: 'chat' } },
    { id: 'vcs', name: '版本紀錄', theme: 'gold', desc: '分支線圖與一筆筆提交紀錄', params: { kind: 'vcs', rate: 3.5, layout: 'full' } },
    { id: 'setup', name: '韌體設定', theme: 'blueprint', desc: '設定選單的游標上下移動、切換選項', params: { kind: 'setup', layout: 'setup' } },
    { id: 'install', name: '套件安裝', theme: 'forest', desc: '下載解包設定，底部多條平行下載', params: { kind: 'install', rate: 7, layout: 'install' } },
    { id: 'wall', name: '伺服器牆', theme: 'cyber', desc: '一整面主機日誌窗格，出錯的亮紅框', params: { kind: 'svc', layout: 'wall' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.max = rows + 4;
    s.t0 = 0;
    if (p.layout === 'wall') { this.wallInit(s, f); return; }
    if (p.layout === 'setup') { this.setupInit(s, f); return; }
    s.st = logState(p.kind, p.rate);
    if (p.kind !== 'boot') { for (let k = 0; k < rows * 1.2; k++) logPush(s.st, LOGGEN[p.kind](s.st), s.max); s.st.wait = 0; s.st.clearAt = undefined; }
    if (p.kind === 'compile') s.st.pct = rint(5, 40);
    // 存取統計
    s.codes = [0, 0, 0, 0]; s.rps = new Float32Array(120); s.rh = 0; s.cnt = 0; s.tick = 0; s.paths = new Map(); s.total = rint(100000, 900000);
    // 聊天室輸入列
    s.typing = ''; s.typed = 0; s.typeT = 2;
    // 平行下載
    s.dl = [0, 1, 2, 3].map(() => ({ name: pick(PKGS), v: Math.random(), sp: rnd(0.05, 0.3) }));
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, p } = f, K = kcols(s, f);
    if (p.layout === 'setup') return this.setupFrame(s, f, K);
    if (p.layout === 'wall') return this.wallFrame(s, f, K);
    const st = s.st;
    logStep(st, dt, s.max);
    if (p.layout === 'full') {
      if (p.kind !== 'vcs') { logDraw(g, st, 1, 0, cols - 2, rows, K, true, t); return; }
      // 版本紀錄：像瀏覽器一樣有一條選取列慢慢往上移
      logDraw(g, st, 2, 0, cols - 3, rows - 1, K, false, t);
      const n = Math.min(rows - 1, st.lines.length), sel = n - 1 - (Math.floor(t * 1.4) % Math.max(1, n));
      if (sel >= 0) {
        const L = st.lines[st.lines.length - n + sel], c = f.C(0.75 + 0.25 * Math.sin(t * 4));
        g.set(0, sel, '▶', c);
        let x = 2; for (const sg of L) x = putT(g, x, sel, sg[0], sg[1] === 0 ? K[0] : c, cols - 1);
      }
      fillR(g, 0, rows - 1, cols, 1, ' ', K[0]);
      put(g, 1, rows - 1, ':log --graph --all   commits ' + (12000 + st.lines.length) + '   branches ' + st.lanes + tr(f, '   (j/k 移動, q 離開)', '   (j/k move, q quit)'), K[8]);
      return;
    }
    if (p.layout === 'build') {
      logDraw(g, st, 1, 0, cols - 2, rows - 2, K, false, t);
      for (let x = 0; x < cols; x++) g.set(x, rows - 2, '─', K[0]);
      const lab = ' building ' + pad(st.pct, 3) + '% ', bw = Math.max(10, cols - lab.length - 22);
      put(g, 1, rows - 1, lab, K[2]);
      hbar(g, 1 + lab.length, rows - 1, bw, st.pct / 100, K[3], K[0], '░');
      put(g, 2 + lab.length + bw, rows - 1, 'ETA ' + fmtT((100 - st.pct) * 0.7).slice(3), K[1]);
      return;
    }
    if (p.layout === 'access') {
      const pw = cols >= 120 ? Math.floor(cols * 0.24) : 0, lw = cols - pw - (pw ? 1 : 0);
      // 統計
      const before = st.lines.length;
      s.tick += dt;
      if (st.last) { const c = st.last.code; s.codes[c < 300 ? 0 : c < 400 ? 1 : c < 500 ? 2 : 3]++; s.cnt++; s.total++; s.paths.set(st.last.path.split('?')[0].replace(/\d+/g, ':id'), (s.paths.get(st.last.path.split('?')[0].replace(/\d+/g, ':id')) || 0) + 1); st.last = null; }
      if (s.tick > 0.25) { s.rps[s.rh % 120] = s.cnt * 4 + rnd(0, 3); s.rh++; s.cnt = 0; s.tick = 0; }
      logDraw(g, st, 1, 0, lw - 2, rows, K, false, t);
      if (!pw) return;
      const x0 = lw;
      for (let y = 0; y < rows; y++) g.set(x0, y, '│', K[0]);
      let y = 1;
      put(g, x0 + 2, y++, 'LIVE TRAFFIC', K[2]);
      put(g, x0 + 2, y++, 'total ' + s.total.toLocaleString('en'), K[1]);
      y++;
      put(g, x0 + 2, y++, 'req/s', K[0]);
      const sw = pw - 4, sh = Math.max(3, Math.floor(rows * 0.18));
      let mx = 10; for (let k = 0; k < 120; k++) mx = Math.max(mx, s.rps[k]);
      for (let k = 0; k < sw; k++) {
        const idx = (s.rh - sw + k + 1200) % 120, v = s.rps[idx] / mx * sh;
        for (let q = 0; q < sh; q++) { const fill = clamp(v - q, 0, 1); if (fill > 0) g.set(x0 + 2 + k, y + sh - 1 - q, fill >= 1 ? '█' : VEIGHT[Math.max(1, Math.round(fill * 8))], K[6]); }
      }
      y += sh + 1;
      put(g, x0 + 2, y++, 'status codes', K[0]);
      const tot = s.codes[0] + s.codes[1] + s.codes[2] + s.codes[3] || 1;
      const lab = ['2xx', '3xx', '4xx', '5xx'], kk = [3, 6, 4, 5];
      for (let k = 0; k < 4; k++) { put(g, x0 + 2, y, lab[k], K[kk[k]]); hbar(g, x0 + 6, y, sw - 13, s.codes[k] / tot, K[kk[k]], K[0], '·'); put(g, x0 + sw - 5, y, pad((s.codes[k] / tot * 100).toFixed(1), 5) + '%', K[1]); y++; }
      y++;
      put(g, x0 + 2, y++, 'top paths', K[0]);
      const top = [...s.paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(0, rows - y - 1));
      for (const [pth, c] of top) { put(g, x0 + 2, y, pad(c, 5) + ' ' + pth, K[1], x0 + pw); y++; }
      return;
    }
    if (p.layout === 'chat') {
      const lw = cols >= 120 ? 16 : 0, rw = cols >= 120 ? 16 : 0, x0 = lw ? lw + 1 : 0, w = cols - x0 - (rw ? rw + 1 : 0);
      const en = f.lang === 'en';
      put(g, x0 + 1, 0, tr(f, '#ops │ 今晚 23:00 停機維護 │ 有事請先開工單 │ 保持冷靜', '#ops │ Maintenance tonight at 23:00 │ File a ticket first │ Stay calm'), K[6], x0 + w);
      for (let x = x0; x < x0 + w; x++) g.set(x, 1, '─', K[0]);
      logDraw(g, st, x0 + 1, 2, w - 2, rows - 4, K, false, t, en);
      for (let x = x0; x < x0 + w; x++) g.set(x, rows - 2, '─', K[0]);
      // 輸入列：慢慢打字，打完送出
      if (!s.typing) { s.typing = pick(CHAT); s.typed = 0; s.typeT = rnd(1, 4); }
      if (s.typeT > 0) s.typeT -= dt; else { s.typed += dt * (4 + 10 * Math.abs(Math.sin(t * 1.7))); if (s.typed >= txt2(s.typing, en).length + 6) { logPush(st, [[['[' + fmtT((st.sec = (st.sec || 51000) + 20)).slice(0, 5) + '] ', 0], ['<', 0], [pad('me', 6), 3], ['> ', 0], [s.typing, 2]]], s.max); s.typing = ''; } }
      const typ = txt2(s.typing, en), shown = typ.slice(0, Math.min(typ.length, Math.floor(s.typed)));
      put(g, x0 + 1, rows - 1, '[me]', f.C(0.55 + 0.4 * Math.sin(t * 3)));
      const ex = put(g, x0 + 6, rows - 1, shown, K[2], x0 + w);
      g.set(ex, rows - 1, '█', f.C(0.35 + 0.6 * Math.abs(Math.sin(t * 3.2))));
      // 「某人正在輸入」提示（點字轉圈）
      const who = NICKS[Math.floor(t / 6) % NICKS.length], spin = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[Math.floor(t * 12) % 10];
      const tip = spin + ' ' + who + tr(f, ' 正在輸入…', ' is typing…');
      put(g, x0 + w - strW(tip) - 2, rows - 2, tip, K[0]);
      if (lw) {
        put(g, 1, 0, 'CHANNELS', K[0]);
        const chs = ['#ops', '#dev', '#build', '#random', '#infra', '#lounge', '#alerts'];
        chs.forEach((c, k) => { const sel = k === 0; put(g, 1, 2 + k, (sel ? '▸ ' : '  ') + c, sel ? K[2] : K[1]); if (!sel && hash2(k, Math.floor(t / 7)) % 3 === 0) put(g, 13, 2 + k, String(1 + hash2(k, Math.floor(t / 5)) % 9), K[4]); });
        for (let y = 0; y < rows; y++) g.set(lw, y, '│', K[0]);
        put(g, cols - rw + 1, 0, 'USERS ' + NICKS.length, K[0]);
        NICKS.forEach((nk, k) => put(g, cols - rw + 1, 2 + k, (k < 2 ? '@' : k < 5 ? '+' : ' ') + nk, K[10 + k]));
        for (let y = 0; y < rows; y++) g.set(cols - rw - 1, y, '│', K[0]);
      }
      return;
    }
    if (p.layout === 'install') {
      const nb = rows >= 40 ? 4 : 2, ph = nb + 2;
      logDraw(g, st, 1, 0, cols - 2, rows - ph, K, false, t);
      for (let x = 0; x < cols; x++) g.set(x, rows - ph, '─', K[0]);
      put(g, 2, rows - ph, ' downloads ', K[2]);
      for (let k = 0; k < nb; k++) {
        const d = s.dl[k], y = rows - ph + 1 + k;
        d.v += dt * d.sp * (0.6 + 0.8 * Math.abs(Math.sin(t * 0.7 + k)));
        if (d.v >= 1.15) { d.v = 0; d.name = pick(PKGS); d.sp = rnd(0.05, 0.3); }
        const nm = pad(d.name, 13).slice(0, 13), bw = Math.max(8, cols - 44);
        put(g, 2, y, nm, K[1]);
        put(g, 16, y, '[', K[0]); hbar(g, 17, y, bw, Math.min(1, d.v), d.v >= 1 ? K[3] : K[6], K[0], '·'); put(g, 17 + bw, y, ']', K[0]);
        put(g, 19 + bw, y, d.v >= 1 ? ' done ' : pad(Math.floor(Math.min(1, d.v) * 100), 3) + '% ' + pad((d.sp * 40 * (0.8 + 0.4 * Math.sin(t * 3 + k))).toFixed(1), 5) + ' MB/s', d.v >= 1 ? K[3] : K[1]);
      }
      return;
    }
  },
  // 伺服器牆：每台主機一個 tail -f 小窗格
  wallInit(s, f) {
    const { cols, rows } = f;
    const fw = Math.max(30, Math.floor(cols * 0.36)), gw = cols - fw;
    const nx = gw >= 180 ? 4 : gw >= 110 ? 3 : 2, ny = rows >= 60 ? 4 : 3;
    s.wl = { fw, gw, nx, ny, pw: Math.floor(gw / nx), ph: Math.floor((rows - 1) / ny), focus: 0, focusT: 0, errs: 0, lastErr: '--:--:--' };
    const hosts = WALL_HOSTS.slice(0, nx * ny);
    s.panes = hosts.map((h, k) => {
      const st = logState('svc', rnd(2.5, 7)); st.host = h; st.role = h.split('-')[0]; st.alert = 0; st.hot = 0;
      st.sec = 40000 + rnd(0, 600);
      for (let j = 0; j < rows; j++) logPush(st, LOGGEN.svc(st), s.max);
      st.err = 0; st.wait = 0;
      return st;
    });
  },
  wallFrame(s, f, K) {
    const { g, cols, rows, dt, t } = f, W = s.wl;
    W.focusT += dt;
    // 偶爾有一台主機出狀況，一陣子錯誤特別多
    if (Math.random() < dt * 0.08) { const q = pick(s.panes); q.hot = rnd(4, 8); }
    let alerts = 0;
    s.panes.forEach((st, k) => {
      st.hot = Math.max(0, st.hot - dt);
      logStep(st, dt * (st.hot > 0 ? 1.8 : 1), s.max);
      if (st.err) { st.err = 0; st.alert = 5; W.errs++; W.lastErr = fmtT(st.sec); if (k !== W.focus && W.focusT > 2.5) { W.focus = k; W.focusT = 0; } }
      st.alert = Math.max(0, st.alert - dt);
      if (st.alert > 0) alerts++;
      const x0 = (k % W.nx) * W.pw, y0 = Math.floor(k / W.nx) * W.ph, al = st.alert > 0;
      const bc = al ? f.H(0, 0.45 + 0.15 * Math.sin(t * 3)) : k === W.focus ? f.C(0.55) : f.C(0.28);
      logDraw(g, st, x0 + 1, y0 + 1, W.pw - 3, W.ph - 2, K, false, t);
      box(g, x0, y0, W.pw - 1, W.ph, bc, (al ? '✖ ' : k === W.focus ? '◆ ' : '') + st.host, al ? f.H(0, 0.7) : f.C(0.8), al ? 2 : 1);
    });
    // 右側放大窗格：最後出錯的那台主機
    const st = s.panes[W.focus], x0 = W.gw, fw = cols - W.gw, fh = rows - 1, al = st.alert > 0;
    const L = st.lines, n = Math.min(fh - 2, L.length), start = L.length - n;
    for (let k = 0; k < n; k++) {
      const line = L[start + k], isErr = line[1] && line[1][1] === 5;
      if (isErr) put(g, x0 + 1, 1 + k, '▌', K[5]);
      drawSegs(g, x0 + 2, 1 + k, line, x0 + fw - 1, K);
    }
    box(g, x0, 0, fw, fh, al ? f.H(0, 0.55) : f.C(0.5), 'tail -f ' + st.host + '/app.log', f.C(0.95), 2);
    const tag = ' last error ' + W.lastErr + ' ';
    if (fw > tag.length + 30) put(g, x0 + fw - tag.length - 2, 0, tag, K[5]);
    fillR(g, 0, rows - 1, cols, 1, ' ', K[0]);
    put(g, 1, rows - 1, '[wall] ' + s.panes.length + ' hosts │ ' + alerts + ' alerting │ ' + W.errs + ' errors today │ focus: ' + st.host, alerts ? K[4] : K[3]);
    const clk = fmtT(43200 + t);
    put(g, cols - clk.length - 1, rows - 1, clk, K[1]);
  },
  // 韌體設定畫面：分頁、設定表、說明欄，游標自己移動並切換選項
  setupInit(s, f) {
    s.bs = { tab: 0, sel: 0, moves: 0, nextMove: rint(5, 8), act: 1.2, pop: null, confirm: 0, reboot: 0, vals: new Map(), changed: 0, hT: 0, hist: [new Float32Array(120), new Float32Array(120)], hh: 0 };
    s.bs.sel = this.setupNext(0, -1, 1);
    s.bs.cpu = rint(8, 32) + '-Core Processor @ ' + (rint(30, 52) / 10).toFixed(2) + 'GHz';
    for (let k = 0; k < 120; k++) this.setupHw(s.bs, k * 0.25);
  },
  setupHw(B, tm) {
    B.temp = 44 + 7 * Math.sin(tm * 0.21) + 3 * Noise.n3(tm * 0.6, 1.7);
    B.fan = 1450 + 520 * Math.sin(tm * 0.17 + 1) + 90 * Noise.n3(tm * 1.3, 4.2);
    B.hist[0][B.hh % 120] = B.temp; B.hist[1][B.hh % 120] = B.fan; B.hh++;
  },
  setupItems(tab) { return BIOS_TABS[tab][1]; },
  setupNext(tab, from, dir) {
    const L = this.setupItems(tab);
    for (let k = 1; k <= L.length; k++) { const i = (from + dir * k + L.length * 4) % L.length; const kd = L[i][0][0]; if (kd !== '=' && kd !== '-') return i; }
    return 0;
  },
  setupVal(B, it) {
    const lab = it[0].replace(/^[>!=-]/, ''), o = it[1];
    if (o === 'TIME') return fmtT(36000 + B.T);
    if (o === 'DATE') return 'Thu 10/08/2026';
    if (o === 'CPU') return B.cpu;
    if (typeof o === 'string') return o;
    if (Array.isArray(o)) return o[B.vals.has(lab) ? B.vals.get(lab) : 0];
    return '';
  },
  setupFrame(s, f, K) {
    const { g, cols, rows, dt, t } = f, B = s.bs, hue = f.H(0, 0.6) !== f.H(120, 0.6);
    B.T = (B.T || 0) + dt;
    B.hT += dt; while (B.hT >= 0.25) { B.hT -= 0.25; this.setupHw(B, B.T); }
    const cHi = hue ? f.H(52, 0.78) : f.C(1), cDim = f.C(0.4), cTxt = f.C(0.72), cFrame = f.C(0.45);
    // ── 自動操作（儲存重開時暫停） ──
    if (B.reboot > 0) B.reboot -= dt; else B.act -= dt;
    const items = this.setupItems(B.tab), it = items[B.sel];
    if (B.reboot <= 0 && B.act <= 0) {
      B.act = rnd(0.55, 1.1);
      if (B.confirm > 0) { B.reboot = 2.6; B.confirm = 0; }
      else if (B.pop) {
        if (B.pop.steps > 0) { B.pop.idx = (B.pop.idx + 1) % B.pop.opts.length; B.pop.steps--; }
        else { B.vals.set(B.pop.lab, B.pop.idx); B.changed++; B.pop = null; }
      } else if (B.tab === BIOS_TABS.length - 1 && B.moves >= B.nextMove) {
        if (B.sel !== 0) B.sel = 0; else { B.confirm = 1; B.act = 1.6; }
      } else if (B.moves >= B.nextMove) {
        B.tab = (B.tab + 1) % BIOS_TABS.length; B.sel = this.setupNext(B.tab, -1, 1); B.moves = 0; B.nextMove = rint(4, 8);
      } else {
        const r = Math.random();
        if (Array.isArray(it[1]) && r < 0.3) { const lab = it[0]; B.pop = { lab, opts: it[1], idx: B.vals.has(lab) ? B.vals.get(lab) : 0, steps: rint(1, Math.max(1, it[1].length - 1)) }; B.act = 0.8; }
        else { B.sel = this.setupNext(B.tab, B.sel, r < 0.82 ? 1 : -1); B.moves++; }
      }
    }
    // ── 版面 ──
    const title = 'TE Firmware Setup Utility  ·  Version 4.20.1';
    put(g, Math.floor((cols - title.length) / 2), 0, title, f.C(0.9));
    let tx = 2;
    for (let k = 0; k < BIOS_TABS.length; k++) {
      const nm = BIOS_TABS[k][0], on = k === B.tab, w = nm.length + 4;
      put(g, tx, 1, '  ' + nm + '  ', on ? cHi : f.C(0.6));
      for (let x = tx; x < tx + w; x++) g.set(x, 2, on ? '━' : '─', on ? cHi : cFrame);
      tx += w + 1;
    }
    for (let x = tx; x < cols; x++) g.set(x, 2, '─', cFrame);
    for (let x = 0; x < 2; x++) g.set(x, 2, '─', cFrame);
    const by = 3, bh = rows - by - 1, lw = Math.floor(cols * 0.64);
    box(g, 0, by, cols, bh, cFrame, null, null, 2);
    for (let y = by + 1; y < by + bh - 1; y++) g.set(lw, y, '║', cFrame);
    g.set(lw, by, '╦', cFrame); g.set(lw, by + bh - 1, '╩', cFrame);
    // 設定表
    const sp = clamp(Math.floor((rows * 0.42) / 12), 1, 3), labW = clamp(Math.floor(lw * 0.42), 18, 34), vx = 3 + labW + 2;
    let y = by + 2;
    items.forEach((q, k) => {
      const kd = q[0][0], lab = q[0].replace(/^[>!=-]/, ''), sel = k === B.sel;
      const lc = sel ? f.C(0.82 + 0.18 * Math.sin(t * 3.2)) : kd === '=' ? cDim : cTxt;
      if (sel) put(g, 1, y, '►', cHi);
      if (kd === '-') put(g, 3, y, '── ' + lab + ' ' + '─'.repeat(Math.max(0, lw - lab.length - 9)), cDim, lw - 1);
      else if (kd === '>') put(g, 3, y, '▸ ' + lab, lc, lw - 1);
      else if (kd === '!') put(g, 3, y, lab, lc, lw - 1);
      else {
        put(g, 3, y, lab, lc, vx - 1);
        const v = this.setupVal(B, q), ch = Array.isArray(q[1]) && B.vals.has(lab);
        put(g, vx, y, Array.isArray(q[1]) ? '[' + v + ']' : v, sel ? cHi : Array.isArray(q[1]) ? (ch ? (hue ? f.H(190, 0.7) : f.C(0.95)) : f.C(0.88)) : cDim, lw - 1);
      }
      y += sp;
    });
    // 左下：硬體監控走勢
    const mh = Math.min(by + bh - 2 - (y + 1), 8 + Math.floor(rows * 0.2)), my = by + bh - 2 - mh;
    // 大畫面：中間空出來的地方放系統摘要
    const sh = Math.min(my - y - 1, 16);
    if (sh >= 8) {
      const sy = y + Math.floor((my - y - sh) / 2);
      box(g, 2, sy, lw - 4, sh, cFrame, 'System Summary', f.C(0.8), 1);
      const SI = [['CPU Type', B.cpu], ['Microcode', '0x' + hx(0x2b000461, 8)], ['L2 / L3 Cache', '32 MB / 64 MB'], ['DIMM A1', '16384 MB 4800 MT/s'], ['DIMM A2', '16384 MB 4800 MT/s'], ['DIMM B1', '16384 MB 4800 MT/s'], ['DIMM B2', '16384 MB 4800 MT/s'], ['NVMe 0', 'TE-SSD 1TB  PCIe 4.0 x4'], ['SATA 1', 'Not Present'], ['USB Devices', '1 Keyboard, 1 Mouse, 1 Drive'], ['MAC Address', '02:7E:00:4A:1C:90'], ['Uptime', fmtT(B.T + 3)]];
      const half = Math.floor((lw - 8) / 2), nr = sh - 3;
      for (let j = 0; j < SI.length && j < nr * 2; j++) { const cx = 5 + Math.floor(j / nr) * half, cy = sy + 2 + (j % nr); put(g, cx, cy, SI[j][0], f.C(0.55), cx + half); put(g, cx + 16, cy, SI[j][1], f.C(0.85), cx + half - 2); }
    }
    if (mh >= 7) {
      box(g, 2, my, lw - 4, mh, cFrame, 'Hardware Monitor', f.C(0.8), 1);
      const gw = Math.floor((lw - 10) / 2), gh = mh - 4;
      [['CPU Temperature', 0, 30, 70, ' °C', 15], ['CPU Fan Speed', 1, 600, 2400, ' RPM', 200]].forEach(([nm, hi, lo, hiV, un, hu], j) => {
        const gx = 4 + j * (gw + 2), H = B.hist[hi], cur = H[(B.hh - 1) % 120];
        put(g, gx, my + 1, nm, f.C(0.6)); const vs = (hi ? Math.round(cur) : cur.toFixed(1)) + un; put(g, gx + gw - vs.length, my + 1, vs, cHi);
        for (let x = 0; x < gw; x++) {
          const v = clamp((H[(B.hh - gw + x + 1200) % 120] - lo) / (hiV - lo), 0, 1) * gh, full = Math.floor(v), part = Math.floor((v - full) * 8), col = hue ? f.H(hu, 0.35 + 0.3 * (x / gw)) : f.C(0.35 + 0.4 * (x / gw));
          for (let r = 0; r < full; r++) g.set(gx + x, my + 2 + gh - 1 - r, '█', col);
          if (part && full < gh) g.set(gx + x, my + 2 + gh - 1 - full, VEIGHT[part], col);
        }
      });
    }
    // 右側說明與按鍵
    const hpx = lw + 2, hw = cols - hpx - 2;
    const help = BIOS_HELP[it[0].replace(/^[>!=-]/, '')] || (Array.isArray(it[1]) ? 'Select the setting for ' + it[0] + '. Press Enter to see the available options.' : it[0][0] === '>' ? 'Enter this submenu to view and change detailed settings.' : 'Press Enter to run this action.');
    let hy = by + 2;
    for (const ln of wrapTxt(help, hw)) put(g, hpx, hy++, ln, f.C(0.65));
    const keys = ['→←: Select Screen', '↑↓: Select Item', 'Enter: Select', '+/-: Change Opt.', 'F1: General Help', 'F9: Optimized Defaults', 'F10: Save & Exit', 'ESC: Exit'];
    const ky = by + bh - 2 - keys.length;
    if (ky > hy + 1) { for (let x = hpx - 1; x < cols - 1; x++) g.set(x, ky - 1, '─', cFrame); keys.forEach((k2, j) => put(g, hpx, ky + j, k2, f.C(0.6))); }
    // 說明欄中段：感測器數值（空間夠才放）
    const tm = B.T, SN = [['CPU Temp', B.temp.toFixed(1) + ' °C', (B.temp - 30) / 40], ['System Temp', (B.temp * 0.78).toFixed(1) + ' °C', (B.temp * 0.78 - 20) / 40], ['CPU Fan', Math.round(B.fan) + ' RPM', (B.fan - 600) / 1800], ['System Fan', Math.round(B.fan * 0.62) + ' RPM', (B.fan * 0.62 - 300) / 1500], ['Vcore', (1.2 + 0.012 * Math.sin(tm * 5.3) + 0.004 * Noise.n3(tm * 3, 2)).toFixed(3) + ' V', 0.6], ['+3.3V', (3.31 + 0.01 * Math.sin(tm * 2.1)).toFixed(3) + ' V', 0.66], ['+5V', (5.02 + 0.015 * Math.sin(tm * 1.7)).toFixed(3) + ' V', 0.7], ['+12V', (12.1 + 0.04 * Math.sin(tm * 1.3)).toFixed(3) + ' V', 0.75]];
    const sy0 = hy + 1, nS = Math.min(SN.length, Math.floor((ky - 2 - sy0) / (rows >= 50 ? 2 : 1)));
    if (nS >= 2) {
      put(g, hpx, sy0, '── PC Health ' + '─'.repeat(Math.max(0, hw - 13)), cDim, hpx + hw);
      const bwS = Math.max(0, Math.min(40, hw - 32));
      for (let j = 0; j < nS; j++) {
        const yy = sy0 + 1 + j * (rows >= 50 ? 2 : 1), q = SN[j];
        put(g, hpx, yy, q[0], f.C(0.6)); put(g, hpx + 13, yy, pad(q[1], 11), cHi);
        if (bwS >= 6) hbar(g, hpx + 26, yy, bwS, q[2], f.C(0.55), f.C(0.14), '·');
      }
    }
    const cp = 'Version 2.22.1287  Copyright (C) 2026 Generic Firmware Works' + (B.changed ? '  ·  ' + B.changed + ' change(s) pending' : '');
    put(g, Math.max(0, Math.floor((cols - cp.length) / 2)), rows - 1, cp, f.C(0.4));
    // 彈出選單與確認對話框
    if (B.pop) {
      const P = B.pop, pw = Math.max(P.lab.length + 6, ...P.opts.map(o => strW(o) + 8)), ph = P.opts.length + 2, px = Math.floor((cols - pw) / 2), py = Math.floor((rows - ph) / 2);
      clearR(g, px, py, pw, ph); box(g, px, py, pw, ph, cHi, P.lab, cHi, 2);
      P.opts.forEach((o, j) => { if (j === P.idx) put(g, px + 2, py + 1 + j, '►', cHi); put(g, px + 4, py + 1 + j, o, j === P.idx ? cHi : f.C(0.7)); });
    }
    if (B.reboot > 0) {
      // 儲存中：設定畫面保留在背後，前面一個進度對話框，跑完就從頭開始
      const msg = 'Saving configuration … system will restart', pw = msg.length + 8, px = Math.floor((cols - pw) / 2), py = Math.floor(rows / 2) - 3, sp = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[Math.floor(t * 10) % 10];
      clearR(g, px, py, pw, 6); box(g, px, py, pw, 6, cHi, 'Save & Exit Setup', cHi, 2);
      put(g, px + 4, py + 2, msg, f.C(0.85)); put(g, px + 2, py + 2, sp, cHi);
      hbar(g, px + 4, py + 4, pw - 8, 1 - B.reboot / 2.6, cHi, f.C(0.15), '░');
      if (B.reboot <= 0) this.setupInit(s, f);
    } else if (B.confirm > 0) {
      const m1 = 'Save configuration and reset?', pw = m1.length + 8, px = Math.floor((cols - pw) / 2), py = Math.floor(rows / 2) - 3;
      clearR(g, px, py, pw, 6); box(g, px, py, pw, 6, cHi, 'Save & Exit Setup', cHi, 2);
      put(g, px + 4, py + 2, m1, f.C(0.85));
      put(g, px + Math.floor(pw / 2) - 9, py + 4, '[ Yes ]', cHi); put(g, px + Math.floor(pw / 2) + 3, py + 4, '[ No ]', f.C(0.5));
    }
  },
});

/* ═════════ 2. 十六進位檢視 ═════════ */
let TEXTB = null;
function textBlob() {
  if (TEXTB) return TEXTB;
  let s = '';
  while (s.length < 4096) s += pick([pick(WORDS), pick(WORDS) + '_' + pick(DIRS), '/usr/lib/' + pick(PKGS) + '.so', 'config.' + pick(WORDS), 'ERROR: ' + pick(WORDS), pick(SVCN), 'v' + rint(1, 9) + '.' + rint(0, 9)]) + '\0';
  return (TEXTB = s);
}
const OPC = [0x48, 0x89, 0x8b, 0xe8, 0xc3, 0x55, 0x5d, 0x83, 0xec, 0x0f, 0x85, 0x84, 0x74, 0x75, 0xeb, 0x31, 0xc0, 0x41, 0x50, 0x58, 0xff, 0x90, 0x8d, 0x45, 0x24, 0x01, 0x00, 0x00];
// 依位址決定的假檔案內容（同一個位址每次都一樣）
function byteAt(a, seed) {
  const blk = mix32(Math.floor(a / 384) * 2654435761 + seed) % 8, h = mix32(Math.imul(a, 374761393) + seed);
  switch (blk) {
    case 0: case 1: return (h & 15) === 0 ? (h >>> 8) & 255 : 0;
    case 2: case 3: return TEXTB.charCodeAt((a * 1 + seed) % TEXTB.length);
    case 4: return (h >>> 8) & 255;
    case 5: return OPC[(h >>> 5) % OPC.length];
    case 6: return (a & 3) === 0 ? (h >>> 8) & 127 : (a & 3) === 1 ? (h >>> 16) & 3 : 0;
    default: return (a & 15) < 4 ? (Math.floor(a / 16) >>> ((a & 3) * 8)) & 255 : TEXTB.charCodeAt((Math.floor(a / 16) * 7 + (a & 15)) % TEXTB.length);
  }
}
// 檔案區段（和 byteAt 的區塊種類一一對應）：名稱、色相（-1 表示不上色）
const HEXREG = [['pad', -1], ['pad', -1], ['.rodata', 120], ['.rodata', 120], ['.data', 280], ['.text', 200], ['reloc', 30], ['symtab', 50]];
const hexReg = (a, seed) => mix32(Math.floor(a / 384) * 2654435761 + seed) % 8;
// 比對模式：哪些 24 位元組區塊有差異（約五分之一，另外每 7 塊必有一塊，畫面上永遠看得到差異）
const diffBlk = (a, seed) => { const bk = Math.floor(a / 24); return mix32(bk * 97 + seed) % 5 === 0 || bk % 7 === 3; };
const MN = ['mov', 'mov', 'mov', 'push', 'pop', 'call', 'ret', 'jmp', 'jz', 'jnz', 'cmp', 'test', 'add', 'sub', 'xor', 'and', 'lea', 'shl', 'inc', 'dec', 'imul', 'nop', 'jl', 'jge'];
const REG = ['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'rbp', 'rsp', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15'];
// 同一個位址每次都解出一樣的指令（註解也是），結果快取起來
const INSN_CACHE = new Map();
const INSN_CALLS = ['alloc', 'memcpy', 'log_write', 'hash_update', 'open_file', 'parse_hdr'];
function insn(i) {
  let r = INSN_CACHE.get(i);
  if (!r) { if (INSN_CACHE.size > 4000) INSN_CACHE.clear(); r = insnMake(i); INSN_CACHE.set(i, r); }
  return r;
}
function insnMake(i) {
  const h = mix32(i * 2654435761 + 77), h2 = mix32(h + 1);
  if (h % 29 === 0) return { label: 'sub_' + hx(0x401000 + i * 4, 6) };
  const m = MN[(h >>> 3) % MN.length];
  let ops = '', jt = null;
  const r1 = REG[(h2 >>> 3) & 15], r2 = REG[(h2 >>> 9) & 15];
  if (m[0] === 'j') { const d = ((h2 >>> 4) % 26) - 11 || 3; jt = i + d; ops = 'loc_' + hx(0x401000 + jt * 4, 6); }
  else if (m === 'call') ops = 'sub_' + hx(0x401000 + ((h2 >>> 4) % 4000) * 4, 6);
  else if (m === 'ret' || m === 'nop') ops = '';
  else if (m === 'push' || m === 'pop' || m === 'inc' || m === 'dec') ops = r1;
  else if (m === 'lea') ops = r1 + ', [' + r2 + '+0x' + hx(h2 >>> 20 & 255, 2) + ']';
  else if ((h2 & 3) === 0) ops = r1 + ', 0x' + hx((h2 >>> 12) & 0xffff, 4);
  else if ((h2 & 3) === 1) ops = r1 + ', qword [rbp-0x' + hx((h2 >>> 14) & 255, 2) + ']';
  else ops = r1 + ', ' + r2;
  const nb = m === 'ret' || m === 'nop' || m === 'push' || m === 'pop' ? 1 + (h & 1) : 2 + (h2 % 6);
  let bytes = ''; for (let k = 0; k < nb; k++) bytes += hx(mix32(h + k * 7) & 255, 2) + ' ';
  const cm = m === 'call' && (h & 3) === 0 ? '; ' + INSN_CALLS[(h2 >>> 7) % INSN_CALLS.length] : (h % 13 === 0 ? "; '" + WORDS[(h >>> 11) % WORDS.length] + "'" : '');
  return { m, ops, jt, bytes, cm };
}

A({ id: 'te-hex', name: '十六進位檢視', cat: '科技', theme: 'matrix', hue: true, desc: '依檔案結構分色的位元組與資料檢查器',
  params: { mode: 'hex', speed: 5 },
  variants: [
    { id: 'bin', name: '二進位', theme: 'mint', hue: false, desc: '每個位元組攤開成八個 0 與 1', params: { mode: 'bin', speed: 4 } },
    { id: 'debug', name: '除錯器', theme: 'amber', hue: false, desc: '反組譯清單、跳躍箭頭、暫存器與堆疊', params: { mode: 'dis' } },
    { id: 'heat', name: '熱圖', theme: 'rainbow', hue: true, desc: '整個檔案的位元組依種類上色', params: { mode: 'heat', speed: 3 } },
    { id: 'diff', name: '比對', theme: 'ice', hue: true, desc: '兩個版本並排，差異的位元組亮起', params: { mode: 'diff', speed: 4 } },
    { id: 'defrag', name: '磁碟重組', theme: 'ocean', hue: true, desc: '方塊一格格搬移，碎片慢慢歸位', params: { mode: 'defrag' } },
    { id: 'pcap', name: '封包擷取', theme: 'cyber', hue: true, desc: '封包清單、協定樹與原始位元組', params: { mode: 'pcap' } },
  ],
  init(s, f) {
    textBlob();
    const { cols, rows, p } = f;
    s.seed = rint(1, 1e6); s.row = rint(0, 4000); s.edits = new Map(); s.cur = 0; s.curT = 0; s.pause = 0;
    if (p.mode === 'hex' || p.mode === 'bin') {
      const per = p.mode === 'hex' ? 4 : 10;
      const side = cols >= 140 ? 34 : 0;
      let b = Math.floor((cols - 14 - side) / (per + (p.mode === 'hex' ? 0.13 : 0)));
      b = p.mode === 'hex' ? (b >= 16 ? b - (b % 16) : Math.max(4, b - (b % 4))) : Math.max(4, b - (b % 4));
      s.bpr = b; s.side = side;
    }
    if (p.mode === 'diff') {
      const half = Math.floor((cols - 3) / 2);
      let b = Math.floor((half - 12) / 4.13); b = b >= 16 ? b - (b % 8) : Math.max(4, b - (b % 4));
      s.bpr = b; s.half = half;
      s.seed2 = s.seed;
    }
    if (p.mode === 'heat') {
      s.mort = new Uint16Array(32 * 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) { let m = 0; for (let k = 0; k < 5; k++) { m |= ((x >> k) & 1) << (2 * k); if (k < 4) m |= ((y >> k) & 1) << (2 * k + 1); } s.mort[y * 32 + x] = m; }
      s.yoff = 0;
    }
    if (p.mode === 'dis') {
      s.ip = rint(0, 3000); s.top = s.ip - 8; s.stepT = 0; s.regs = REG.map(() => rint(0, 0xffffffff)); s.regHot = new Float32Array(16); s.stack = []; for (let k = 0; k < 24; k++) s.stack.push(rint(0, 0xffffffff)); s.taken = -1;
    }
    if (p.mode === 'defrag') this.dfInit(s, f);
    if (p.mode === 'pcap') { s.pk = []; s.no = rint(1000, 9000); s.tm = rnd(10, 90); s.sel = null; s.selT = 0; s.acc = 0; for (let k = 0; k < rows; k++) s.pk.push(this.mkPkt(s)); }
  },
  frame(s, f) {
    const p = f.p;
    if (p.mode === 'hex' || p.mode === 'bin') return this.hexFrame(s, f);
    if (p.mode === 'dis') return this.disFrame(s, f);
    if (p.mode === 'heat') return this.heatFrame(s, f);
    if (p.mode === 'diff') return this.diffFrame(s, f);
    if (p.mode === 'defrag') return this.dfFrame(s, f);
    if (p.mode === 'pcap') return this.pcapFrame(s, f);
  },
  bcol(f, b) { return b === 0 ? f.C(0.22) : b >= 32 && b < 127 ? f.C(0.62) : b === 255 ? f.C(0.95) : f.C(0.42); },
  // 依檔案區段上色（有色相時是真的顏色，沒有就退回亮度）
  rcol(f, b, rt) { const R = HEXREG[rt], l = b === 0 ? 0.22 : b >= 32 && b < 127 ? 0.62 : b === 255 ? 0.95 : 0.45; return R[1] < 0 ? f.C(l * 0.8) : f.H(R[1], l); },
  hexFrame(s, f) {
    const { g, cols, rows, dt, t, p } = f, bin = p.mode === 'bin', bpr = s.bpr, seed = s.seed;
    const per = bin ? 9 : 3, gap = bin ? 0 : 1;
    // 捲動與編輯游標
    const H = rows - 3;
    s.curT += dt;
    if (s.pause > 0) {
      s.pause -= dt;
      if (s.curT > 0.09) { s.curT = 0; s.cur++; if (Math.random() < 0.35) s.edits.set(s.cur, { v: rint(0, 255), t: 0 }); }
    } else {
      s.row += dt * p.speed;
      // 平常游標也一直往前讀（資料檢查器跟著變）
      if (s.curT > 0.06) { s.curT = 0; s.cur += 1; }
      if (Math.random() < dt * 0.15) { s.pause = rnd(3, 6); s.cur = (Math.floor(s.row) + rint(4, Math.max(5, H - 6))) * bpr + rint(0, bpr - 1); }
    }
    const lo = Math.floor(s.row) * bpr;
    if (s.cur < lo + bpr || s.cur >= lo + (H - 1) * bpr) s.cur = lo + rint(2, Math.max(3, H - 4)) * bpr + rint(0, bpr - 1);
    for (const [a, e] of s.edits) { e.t += dt; if (a < Math.floor(s.row - 2) * bpr) s.edits.delete(a); }
    const top = Math.floor(s.row);
    const hx0 = 11, ax0 = hx0 + bpr * per + (bin ? 0 : Math.floor(bpr / 8) * gap) + 2;
    const cHdr = f.C(0.5), cAddr = f.C(0.4), cEd = f.C(1), cCur = f.C(1);
    // 標頭
    put(g, 0, 0, bin ? ' Offset    ' : ' Offset(h) ', cHdr);
    for (let k = 0; k < bpr; k++) { const x = hx0 + k * per + (bin ? 0 : Math.floor(k / 8) * gap); put(g, x, 0, bin ? hx(k, 2) + '      ' : hx(k, 2), cHdr); }
    put(g, ax0, 0, 'Decoded', cHdr);
    for (let x = 0; x < cols - s.side; x++) g.set(x, 1, '─', f.C(0.25));
    const lx = ax0 + bpr + 1, lx1 = cols - s.side;
    for (let y = 0; y < H; y++) {
      const r = top + y, a0 = r * bpr, yy = y + 2, rt0 = hexReg(a0, seed);
      put(g, 1, yy, hx(a0, 8), cAddr);
      // 左側色帶 + 右側區段標籤（區段開頭或畫面最上面一列）
      g.set(9, yy, '▌', HEXREG[rt0][1] < 0 ? f.C(0.18) : f.H(HEXREG[rt0][1], 0.5));
      if (lx + 4 < lx1 && (y === 0 || Math.floor(a0 / 384) !== Math.floor((a0 - bpr) / 384))) put(g, lx, yy, '◂' + HEXREG[rt0][0] + (lx1 - lx > 20 ? ' @' + hx(Math.floor(a0 / 384) * 384, 6) : ''), HEXREG[rt0][1] < 0 ? f.C(0.4) : f.H(HEXREG[rt0][1], 0.7), lx1);
      for (let k = 0; k < bpr; k++) {
        const a = a0 + k, e = s.edits.get(a), b = e ? e.v : byteAt(a, seed);
        const x = hx0 + k * per + (bin ? 0 : Math.floor(k / 8) * gap);
        const col = a === s.cur ? cCur : e ? (e.t < 1.5 ? cEd : f.C(0.8)) : this.rcol(f, b, (k === 0 ? rt0 : hexReg(a, seed)));
        if (bin) { for (let q = 0; q < 8; q++) g.set(x + q, yy, (b >> (7 - q)) & 1 ? '1' : '0', (b >> (7 - q)) & 1 ? col : a === s.cur ? f.C(0.6) : f.C(0.25)); }
        else { g.set(x, yy, HX[b >> 4], col); g.set(x + 1, yy, HX[b & 15], col); }
        if (a === s.cur && (s.pause <= 0 || Math.floor(t * 4) % 2 === 0)) { g.set(x - 1, yy, '[', cCur); g.set(x + (bin ? 8 : 2), yy, ']', cCur); }
        g.set(ax0 + k, yy, b >= 32 && b < 127 ? String.fromCharCode(b) : '.', b >= 32 && b < 127 ? (e ? cEd : f.C(0.55)) : f.C(0.2));
      }
    }
    // 狀態列
    const cs = s.cur;
    fillR(g, 0, rows - 1, cols, 1, ' ', cHdr);
    if (s.side) put(g, 1, rows - 1, ' firmware.img │ 16 MiB │ offset 0x' + hx(cs, 8) + ' │ ' + HEXREG[hexReg(cs, seed)][0] + ' │ ' + (s.pause > 0 ? 'EDIT' : 'VIEW') + ' │ ' + s.edits.size + ' modified ', f.C(0.75));
    else {
      // 窄畫面：檢查器縮成狀態列一行
      const b0 = byteAt(cs, seed), u16 = b0 | (byteAt(cs + 1, seed) << 8), u32 = (u16 | (byteAt(cs + 2, seed) << 16) | (byteAt(cs + 3, seed) << 24)) >>> 0, fv = new Float32Array(new Uint32Array([u32]).buffer)[0];
      put(g, 1, rows - 1, '0x' + hx(cs, 8) + ' │ ' + HEXREG[hexReg(cs, seed)][0] + ' │ u8 ' + b0 + ' │ u16 ' + u16 + ' │ u32 ' + u32 + ' │ f32 ' + (isFinite(fv) ? fv.toExponential(2) : 'NaN') + ' │ ' + (s.pause > 0 ? 'EDIT' : 'VIEW'), f.C(0.75), cols - 1);
    }
    // 右側資料檢查器
    if (s.side) {
      const x0 = cols - s.side + 1, w = s.side - 2, b0 = byteAt(cs, seed), b1 = byteAt(cs + 1, seed), b2 = byteAt(cs + 2, seed), b3 = byteAt(cs + 3, seed);
      box(g, x0, 0, w, 13, f.C(0.35), 'Inspector', f.C(0.8));
      const u16 = b0 | (b1 << 8), u32 = (u16 | (b2 << 16) | (b3 << 24)) >>> 0;
      const fv = new Float32Array(new Uint32Array([u32]).buffer)[0];
      const L = [['offset', '0x' + hx(cs, 8)], ['uint8', String(b0)], ['int8', String(b0 > 127 ? b0 - 256 : b0)], ['uint16', String(u16)], ['int16', String(u16 > 32767 ? u16 - 65536 : u16)], ['uint32', String(u32)], ['float32', isFinite(fv) ? fv.toExponential(3) : 'NaN'], ['binary', (b0 >>> 0).toString(2).padStart(8, '0')], ['char', b0 >= 32 && b0 < 127 ? "'" + String.fromCharCode(b0) + "'" : '-'], ['entropy', (4 + 4 * Math.abs(Math.sin(cs * 0.001))).toFixed(2) + ' bits']];
      L.forEach((l, k) => { put(g, x0 + 2, 1 + k, pad(l[0], 8), f.C(0.4)); put(g, x0 + 11, 1 + k, l[1], f.C(0.85), x0 + w - 1); });
      // 檔案縮圖：每列一個區塊的種類
      const my = 14, mh = rows - my - 2;
      box(g, x0, my, w, mh + 1, f.C(0.35), 'Map', f.C(0.8));
      const span = 4096 * 1.0, here = Math.floor(cs / span);
      for (let y = 0; y < mh - 1; y++) for (let x = 0; x < w - 4; x++) {
        const blk = here - Math.floor((mh - 1) / 2) + y, a = (blk * (w - 4) + x) * 384;
        const k = mix32(Math.floor(a / 384) * 2654435761 + seed) % 8, c = '·░▒▓█'[[0, 0, 2, 2, 4, 3, 1, 2][k]];
        g.set(x0 + 2 + x, my + 1 + y, c, blk === here ? f.C(0.95) : HEXREG[k][1] < 0 ? f.C(0.22) : f.H(HEXREG[k][1], 0.25 + [0, 0, 0.2, 0.2, 0.45, 0.35, 0.1, 0.2][k]));
      }
    }
  },
  disFrame(s, f) {
    const { g, cols, rows, dt, t } = f;
    s.stepT += dt;
    if (s.stepT > 0.22) {
      s.stepT = 0;
      const I = insn(s.ip);
      s.taken = -1;
      if (I.jt !== null && I.jt !== undefined && Math.random() < 0.55) { s.taken = s.ip; s.ip = I.jt; }
      else s.ip++;
      const r = rint(0, 15); s.regs[r] = rint(0, 0xffffffff); s.regHot[r] = 1;
      if (I.m === 'push' || I.m === 'call') { s.stack.unshift(rint(0, 0xffffffff)); s.stack.pop(); }
      if (I.m === 'pop' || I.m === 'ret') { s.stack.push(rint(0, 0xffffffff)); s.stack.shift(); }
    }
    for (let k = 0; k < 16; k++) s.regHot[k] = Math.max(0, s.regHot[k] - dt * 0.8);
    const LH = rows - 2;
    if (s.ip < s.top + LH * 0.25) s.top = Math.floor(s.ip - LH * 0.4);
    if (s.ip > s.top + LH * 0.7) s.top = Math.floor(s.ip - LH * 0.4);
    const side = cols >= 140 ? Math.min(60, Math.floor(cols * 0.32)) : 0, lw = cols - side;
    const GW = 12;
    put(g, 0, 0, ' ' + 'disassembly — .text', f.C(0.6));
    for (let x = 0; x < lw; x++) g.set(x, 1, '─', f.C(0.25));
    const jumps = [];
    for (let y = 0; y < LH; y++) {
      const i = s.top + y, I = insn(i), yy = y + 2, cur = i === s.ip;
      if (I.label) { put(g, GW, yy, I.label + ':', f.C(0.85)); continue; }
      const c = cur ? f.C(1) : f.C(0.6);
      if (cur) put(g, GW - 1, yy, '►', f.C(1));
      put(g, GW + 1, yy, '0x' + hx(0x401000 + i * 4, 8), cur ? c : f.C(0.35));
      put(g, GW + 13, yy, I.bytes, f.C(cur ? 0.8 : 0.3), GW + 13 + 24);
      put(g, GW + 38, yy, I.m, I.m[0] === 'j' || I.m === 'call' || I.m === 'ret' ? f.C(cur ? 1 : 0.85) : c);
      put(g, GW + 45, yy, I.ops, c, lw - 1);
      if (I.cm) put(g, GW + 46 + I.ops.length + 2, yy, I.cm, f.C(0.32), lw - 1);
      if (I.jt !== null && I.jt !== undefined) jumps.push([y, I.jt - s.top, i === s.taken || i === s.ip]);
    }
    // 跳躍箭頭：依跨度分配軌道
    jumps.sort((a, b) => Math.abs(a[1] - a[0]) - Math.abs(b[1] - b[0]));
    const used = [];
    for (const [y0, y1r, act] of jumps) {
      const y1 = clamp(y1r, -1, LH), lo = Math.min(y0, y1), hi = Math.max(y0, y1);
      let lane = 0;
      while (lane < 5 && used.some(u => u[0] === lane && !(u[2] < lo || u[1] > hi))) lane++;
      used.push([lane, lo, hi]);
      const x = GW - 3 - lane * 2, col = act ? f.C(1) : f.C(0.3);
      for (let y = lo; y <= hi; y++) if (y >= 0 && y < LH) g.set(x, y + 2, '│', col);
      if (y0 >= 0) { g.set(x, y0 + 2, y0 < y1 ? '┌' : '└', col); for (let xx = x + 1; xx < GW - 1; xx++) g.set(xx, y0 + 2, '─', col); }
      if (y1 >= 0 && y1 < LH) { g.set(x, y1 + 2, y1 < y0 ? '┌' : '└', col); for (let xx = x + 1; xx < GW - 2; xx++) g.set(xx, y1 + 2, '─', col); g.set(GW - 2, y1 + 2, '>', col); }
    }
    fillR(g, 0, rows - 1, cols, 1, ' ', f.C(0.5));
    put(g, 1, rows - 1, 'paused │ step ' + (s.ip % 100000) + ' │ rip=0x' + hx(0x401000 + s.ip * 4, 8) + ' │ breakpoints 3 │ thread 1', f.C(0.7));
    if (!side) return;
    const x0 = lw + 1, w = side - 2;
    box(g, x0, 0, w, 19, f.C(0.35), 'Registers', f.C(0.8));
    for (let k = 0; k < 16; k++) {
      const cx = x0 + 2 + (k % 2) * Math.floor((w - 3) / 2), cy = 1 + (k >> 1) * 2;
      put(g, cx, cy, pad(REG[k], 3), f.C(0.45));
      put(g, cx + 4, cy, hx(s.regs[k], 8) + hx(s.regs[(k + 5) & 15] >>> 8, 6), s.regHot[k] > 0 ? f.C(0.55 + 0.45 * s.regHot[k]) : f.C(0.6), x0 + w - 1);
    }
    put(g, x0 + 2, 17, 'flags  ' + ['Z', 'C', 'S', 'O', 'P'].map((c, k) => ((s.ip >> k) & 1 ? c : '-')).join(' '), f.C(0.6));
    const sy = 20, sh = rows - sy - 1;
    box(g, x0, sy, w, sh, f.C(0.35), 'Stack', f.C(0.8));
    for (let k = 0; k < sh - 2 && k < s.stack.length; k++) {
      put(g, x0 + 2, sy + 1 + k, (k === 0 ? 'rsp► ' : '     ') + '0x7FFD' + hx(0xE000 - k * 8, 4) + '  ' + hx(s.stack[k], 8) + hx(s.stack[(k + 3) % s.stack.length] >>> 12, 5), k === 0 ? f.C(0.95) : f.C(0.5), x0 + w - 1);
    }
  },
  heatFrame(s, f) {
    const { g, cols, rows, dt, t, p } = f, seed = s.seed, ch = g.ch, co = g.co;
    s.yoff += dt * p.speed;
    const yo = Math.floor(s.yoff), tilesX = Math.ceil(cols / 32), Hh = rows - 2;
    const hue = f.H(0, 0.5) !== f.H(180, 0.5);
    const scanY = ((t * 7) % (Hh + 12)) - 6;
    for (let y = 0; y < Hh; y++) {
      const Y = y + yo, tr = Math.floor(Y / 16), ly = Y & 15;
      for (let x = 0; x < cols; x++) {
        const tile = tr * tilesX + (x >> 5), a = (tile * 512 + s.mort[ly * 32 + (x & 31)]) * 4;
        const b = byteAt(a, seed), b2 = byteAt(a + 1, seed);
        let c, col;
        const dd = Math.abs(y - scanY), near = dd < 2.5 && ((x + y * 3) & 3) !== 0;
        if (b === 0 && b2 === 0) { c = '·'; col = f.C(0.12); }
        else if (b >= 32 && b < 127) { c = '█'; col = hue ? f.H(205, 0.35 + (b - 32) / 190) : f.C(0.4 + (b - 32) / 300); }
        else if (b === 255) { c = '█'; col = hue ? f.H(0, 0.85) : f.C(1); }
        else { c = b < 32 ? '▓' : '█'; col = hue ? f.H(b < 32 ? 280 : 20 + (b & 63), 0.25 + (b / 255) * 0.45) : f.C(0.2 + (b / 255) * 0.6); }
        if (near) { col = f.C(1 - dd * 0.22); c = c === '·' ? '░' : c; }
        const i = y * cols + x; ch[i] = c; co[i] = col;
      }
    }
    fillR(g, 0, rows - 2, cols, 2, ' ', f.C(0.3));
    const leg = [['·', 'zero', f.C(0.3)], ['█', 'text', hue ? f.H(205, 0.6) : f.C(0.6)], ['▓', 'low', hue ? f.H(280, 0.5) : f.C(0.3)], ['█', 'binary', hue ? f.H(40, 0.55) : f.C(0.7)], ['█', '0xFF', hue ? f.H(0, 0.85) : f.C(1)]];
    let x = 2;
    put(g, x, rows - 1, 'byte classes:', f.C(0.6)); x += 15;
    for (const l of leg) { g.set(x, rows - 1, l[0], l[2]); put(g, x + 2, rows - 1, l[1], f.C(0.6)); x += l[1].length + 5; }
    const off = '0x' + hx(yo * tilesX * 512 * 4 / 16, 8);
    put(g, cols - off.length - 14, rows - 1, 'offset ' + off, f.C(0.75));
  },
  diffFrame(s, f) {
    const { g, cols, rows, dt, t, p } = f, bpr = s.bpr, seed = s.seed, half = s.half;
    s.row += dt * p.speed;
    const top = Math.floor(s.row), H = rows - 3;
    const pu = 0.5 + 0.5 * Math.sin(t * 2.6);
    const cA = f.C(0.4), cDel = f.H(0, 0.45 + 0.3 * pu), cAdd = f.H(130, 0.45 + 0.3 * pu), cDim = f.C(0.25);
    put(g, 1, 0, '--- a/firmware_v1.bin', f.H(0, 0.6)); put(g, half + 3, 0, '+++ b/firmware_v2.bin', f.H(130, 0.6));
    for (let x = 0; x < cols; x++) g.set(x, 1, x === half + 1 ? '┬' : '─', cDim);
    let nd = 0;
    for (let y = 0; y < H; y++) {
      const r = top + y, a0 = r * bpr, yy = y + 2;
      g.set(half + 1, yy, '│', cDim);
      let rowDiff = false;
      for (let side = 0; side < 2; side++) {
        const x0 = side ? half + 3 : 1;
        put(g, x0, yy, hx(a0, 8), cA);
        for (let k = 0; k < bpr; k++) {
          const a = a0 + k, b0 = byteAt(a, seed);
          const dz = diffBlk(a, seed) && (mix32(a + seed) & 3) !== 0;
          const b = side && dz ? (b0 ^ (1 + (mix32(a * 7) & 254))) & 255 : b0;
          if (dz) rowDiff = true;
          const x = x0 + 10 + k * 3 + Math.floor(k / 8);
          const col = dz ? (side ? cAdd : cDel) : this.bcol(f, b);
          g.set(x, yy, HX[b >> 4], col); g.set(x + 1, yy, HX[b & 15], col);
          if (dz && k > 0 && diffBlk(a - 1, seed)) g.set(x - 1, yy, '·', col);
        }
      }
      if (rowDiff) { nd++; g.set(0, yy, '!', cDel); g.set(half + 2, yy, '!', cAdd); }
    }
    fillR(g, 0, rows - 1, cols, 1, ' ', cA);
    put(g, 1, rows - 1, ' compare │ block size ' + bpr + ' │ rows with changes on screen: ' + nd + ' │ offset 0x' + hx(top * bpr, 8) + ' ', f.C(0.7));
  },
  dfInit(s, f) {
    const { cols, rows } = f;
    s.dw = Math.floor((cols - 2) / 2); s.dh = rows - 5; s.N = s.dw * s.dh;
    s.blk = new Uint8Array(s.N); s.hl = new Float32Array(s.N); s.hk = new Uint8Array(s.N);
    for (let i = 0; i < s.N; i++) { const r = Math.random(); s.blk[i] = r < 0.34 ? 0 : r < 0.42 ? 3 : r < 0.62 ? 2 : 1; }
    // 系統區塊集中在前段
    for (let i = 0; i < s.N * 0.04; i++) s.blk[i] = 3;
    s.pa = 0; s.pb = s.N - 1; s.acc = 0; s.done = 0; s.moved = 0;
  },
  dfFrame(s, f) {
    const { g, cols, rows, dt, t } = f, N = s.N, B = s.blk;
    if (s.done > 0) { s.done -= dt; if (s.done <= 0) this.dfInit(s, f); }
    else {
      s.acc += dt * N / 22;
      let guard = 0;
      while (s.acc >= 1 && guard++ < 400) {
        s.acc -= 1;
        while (s.pa < s.pb && (B[s.pa] === 2 || B[s.pa] === 3)) s.pa++;
        if (s.pa >= s.pb) { s.done = 4; break; }
        if (B[s.pa] === 1) { B[s.pa] = 2; s.hl[s.pa] = 0.5; s.hk[s.pa] = 1; s.pa++; continue; }
        // 空位：從尾端搬一塊過來
        while (s.pb > s.pa && (B[s.pb] === 0 || B[s.pb] === 3)) s.pb--;
        if (s.pb <= s.pa) { s.done = 4; break; }
        B[s.pa] = 2; B[s.pb] = 0; s.hl[s.pa] = 0.6; s.hk[s.pa] = 1; s.hl[s.pb] = 0.6; s.hk[s.pb] = 0; s.moved++;
      }
    }
    for (let i = 0; i < N; i++) if (s.hl[i] > 0) s.hl[i] -= dt;
    const hue = f.H(0, 0.5) !== f.H(180, 0.5);
    const cs = [f.C(0.18), hue ? f.H(0, 0.5) : f.C(0.45), hue ? f.H(212, 0.55) : f.C(0.7), hue ? f.H(55, 0.6) : f.C(0.95)];
    const cR = hue ? f.H(120, 0.7) : f.C(1), cW = f.C(1);
    put(g, 2, 0, 'Disk Optimizer — Volume D:  (' + N + ' clusters)', f.C(0.8));
    for (let y = 0; y < s.dh; y++) for (let x = 0; x < s.dw; x++) {
      const i = y * s.dw + x, b = B[i];
      let c = b === 0 ? '·' : '■', col = cs[b];
      if (s.hl[i] > 0) { c = '■'; col = s.hk[i] ? cW : cR; }
      g.set(1 + x * 2, 2 + y, c, col);
    }
    const pct = Math.floor(s.pa / Math.max(1, s.pb) * 100);
    const y = rows - 2;
    put(g, 2, y, s.done > 0 ? 'Optimization complete.' : 'Analyzing and moving files …  ' + pad(Math.min(100, pct), 3) + '%   moved ' + s.moved + ' clusters', f.C(0.85));
    let x = 2;
    const leg = [['■', 'fragmented', cs[1]], ['■', 'contiguous', cs[2]], ['■', 'unmovable', cs[3]], ['·', 'free space', cs[0]], ['■', 'reading', cR], ['■', 'writing', cW]];
    for (const l of leg) { g.set(x, rows - 1, l[0], l[2]); put(g, x + 2, rows - 1, l[1], f.C(0.55)); x += l[1].length + 5; }
  },
  mkPkt(s) {
    s.no++; s.tm += rnd(0.0002, 0.08);
    const pr = pick(['TCP', 'TCP', 'TCP', 'UDP', 'DNS', 'DNS', 'HTTP', 'TLS', 'TLS', 'ARP', 'ICMP', 'NTP']);
    const a = ip4(), b = ip4(), sp = rint(1024, 65000), dp = pick([443, 80, 53, 22, 8080, 5432, 123]);
    let info;
    switch (pr) {
      case 'TCP': info = `${sp} → ${dp} [${pick(['ACK', 'SYN', 'SYN, ACK', 'PSH, ACK', 'FIN, ACK'])}] Seq=${rint(1, 90000)} Ack=${rint(1, 90000)} Win=${pick([512, 1024, 65535])} Len=${rint(0, 1400)}`; break;
      case 'UDP': info = `${sp} → ${dp} Len=${rint(20, 1200)}`; break;
      case 'DNS': info = `Standard query${Math.random() < 0.5 ? ' response' : ''} 0x${hx(rint(0, 65535), 4).toLowerCase()} A ${pick(WORDS)}.example.test`; break;
      case 'HTTP': info = `${pick(['GET', 'POST'])} /${pick(WORDS)}/${pick(WORDS)}.json HTTP/1.1`; break;
      case 'TLS': info = pick(['Application Data', 'Client Hello', 'Server Hello, Certificate', 'Change Cipher Spec']); break;
      case 'ARP': info = `Who has ${b}? Tell ${a}`; break;
      case 'ICMP': info = `Echo (ping) ${pick(['request', 'reply'])}  id=0x${hx(rint(0, 65535), 4).toLowerCase()}, seq=${rint(1, 999)}/${rint(256, 9999)}, ttl=64`; break;
      default: info = 'NTP Version 4, client';
    }
    const len = rint(42, 1514), bytes = new Uint8Array(Math.min(len, 160));
    for (let k = 0; k < bytes.length; k++) bytes[k] = k < 14 ? rint(0, 255) : k < 34 ? [0x45, 0, (len >> 8) & 255, len & 255, rint(0, 255), rint(0, 255), 0x40, 0, 64, 6][k - 14] ?? rint(0, 255) : Math.random() < 0.4 ? rint(32, 126) : rint(0, 255);
    return { no: s.no, tm: s.tm, a, b, pr, len, info, bytes };
  },
  pcapFrame(s, f) {
    const { g, cols, rows, dt, t } = f;
    s.acc += dt * (6 + 10 * Math.max(0, Math.sin(t * 0.5)));
    while (s.acc >= 1) { s.acc--; s.pk.push(this.mkPkt(s)); if (s.pk.length > rows * 2) s.pk.shift(); }
    const PH = { TCP: 210, UDP: 180, DNS: 60, HTTP: 120, TLS: 280, ARP: 30, ICMP: 330, NTP: 160 };
    const lh = Math.floor(rows * 0.5), th = Math.floor(rows * 0.2), bh = rows - lh - th - 2;
    const cHead = f.C(0.85), cDim = f.C(0.3);
    put(g, 1, 0, '   No.  Time          Source           Destination      Proto  Len  Info', cHead);
    const list = s.pk.slice(-(lh - 1));
    s.selT -= dt;
    if (s.selT <= 0 || !s.sel || !list.includes(s.sel)) { s.sel = list[Math.max(0, list.length - 1 - rint(2, Math.max(3, lh - 3)))]; s.selT = 2.5; s.fld = 0; }
    list.forEach((q, k) => {
      const y = 1 + k, sel = q === s.sel, col = sel ? f.C(1) : f.H(PH[q.pr], 0.55);
      if (sel) put(g, 0, y, '►', f.C(1));
      put(g, 1, y, pad(q.no, 6) + '  ' + q.tm.toFixed(6).padEnd(12) + '  ' + q.a.padEnd(15) + '  ' + q.b.padEnd(15) + '  ' + q.pr.padEnd(5) + ' ' + pad(q.len, 4) + '  ' + q.info, col, cols - 1);
    });
    const q = s.sel;
    let y = lh;
    for (let x = 0; x < cols; x++) g.set(x, y, '─', cDim);
    y++;
    s.fld = (s.fld + dt * 0.8) % 4;
    const fi = Math.floor(s.fld);
    const tree = [
      ['▸ Frame ' + q.no + ': ' + q.len + ' bytes on wire (' + q.len * 8 + ' bits), ' + q.len + ' bytes captured', 0],
      ['▸ Ethernet II, Src: 02:' + hx(q.bytes[6], 2) + ':' + hx(q.bytes[7], 2) + ':' + hx(q.bytes[8], 2) + ':' + hx(q.bytes[9], 2) + ':' + hx(q.bytes[10], 2) + ', Dst: 02:' + hx(q.bytes[0], 2) + ':' + hx(q.bytes[1], 2) + ':' + hx(q.bytes[2], 2) + ':' + hx(q.bytes[3], 2) + ':' + hx(q.bytes[4], 2), 1],
      ['▾ Internet Protocol Version 4, Src: ' + q.a + ', Dst: ' + q.b, 2],
      ['     Time to live: 64   Header checksum: 0x' + hx(q.bytes[24] * 256 + q.bytes[25], 4).toLowerCase() + ' [unverified]', 2],
      ['▸ ' + (q.pr === 'UDP' || q.pr === 'DNS' || q.pr === 'NTP' ? 'User Datagram' : 'Transmission Control') + ' Protocol, ' + q.info.split(' ').slice(0, 3).join(' '), 3],
    ];
    for (let k = 0; k < tree.length && k < th; k++) put(g, 1, y + k, tree[k][0], tree[k][1] === fi ? f.C(1) : f.C(0.6), cols - 1);
    y += th;
    for (let x = 0; x < cols; x++) g.set(x, y, '─', cDim);
    y++;
    const rng = [[0, 0], [0, 14], [14, 34], [14, 34], [34, 54]][fi];
    const per = cols >= 120 ? 32 : 16;
    for (let r = 0; r < bh && r * per < q.bytes.length; r++) {
      put(g, 1, y + r, hx(r * per, 4), f.C(0.4));
      for (let k = 0; k < per; k++) {
        const a = r * per + k; if (a >= q.bytes.length) break;
        const b = q.bytes[a], hot = a >= rng[0] && a < rng[1], col = hot ? f.C(1) : f.C(0.5);
        const x = 7 + k * 3 + Math.floor(k / 8);
        g.set(x, y + r, HX[b >> 4], col); g.set(x + 1, y + r, HX[b & 15], col);
        g.set(7 + per * 3 + per / 8 + 2 + k, y + r, b >= 32 && b < 127 ? String.fromCharCode(b) : '.', hot ? f.C(1) : f.C(0.35));
      }
    }
  },
});

/* ═════════ 3. 示波器 ═════════ */
// 螢光餘暉緩衝：每個點字子像素一個亮度，逐格衰減
function phosNew(cols, rows) { const W = cols * 2, Hh = rows * 4; return { W, Hh, cols, rows, P: new Float32Array(W * Hh), T: new Uint8Array(W * Hh) }; }
function phosDot(o, x, y, v, tag) {
  if (x < 0 || y < 0 || x >= o.W || y >= o.Hh) return;
  const i = (y | 0) * o.W + (x | 0);
  if (v >= o.P[i]) { o.P[i] = v; o.T[i] = tag; }
}
function phosLine(o, x0, y0, x1, y1, v, tag) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
  if (n > 3000) return;
  for (let k = 0; k <= n; k++) phosDot(o, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, v, tag);
}
function phosDecay(o, m) { const P = o.P; for (let i = 0; i < P.length; i++) P[i] *= m; }
function phosFlush(g, o, th, colf) {
  const P = o.P, T = o.T, W = o.W, ch = g.ch, co = g.co, cols = o.cols;
  for (let cy = 0; cy < o.rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let bits = 0, mv = 0, mt = 0, b = cy * 4 * W + cx * 2;
    for (let dy = 0; dy < 4; dy++, b += W) {
      const v0 = P[b], v1 = P[b + 1];
      if (v0 > th) { bits |= BB[dy]; if (v0 > mv) { mv = v0; mt = T[b]; } }
      if (v1 > th) { bits |= BB[4 + dy]; if (v1 > mv) { mv = v1; mt = T[b + 1]; } }
    }
    if (bits) { const i = cy * cols + cx; ch[i] = BR[bits]; co[i] = colf(mv, mt); }
  }
}
// 刻度格線：nx×ny 格，中央十字有細刻度（預先算好位置）
function gratBuild(w, h, nx, ny) {
  const vx = new Uint8Array(w), hy = new Uint8Array(h), sx = new Uint8Array(w), sy = new Uint8Array(h);
  for (let k = 0; k <= nx; k++) vx[Math.round((k * (w - 1)) / nx)] = 1;
  for (let k = 0; k <= ny; k++) hy[Math.round((k * (h - 1)) / ny)] = 1;
  for (let k = 0; k <= nx * 5; k++) sx[Math.round((k * (w - 1)) / (nx * 5))] = 1;
  for (let k = 0; k <= ny * 5; k++) sy[Math.round((k * (h - 1)) / (ny * 5))] = 1;
  const mx = Math.round((w - 1) / 2), my = Math.round((h - 1) / 2), out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = null, m = 0;
    if (vx[x] && hy[y]) { c = '+'; m = x === mx || y === my ? 1 : 0; }
    else if (y === my) { c = sx[x] ? '┼' : '┈'; m = 1; }
    else if (x === mx) { c = sy[y] ? '┼' : '┊'; m = 1; }
    else if (hy[y]) c = x % 2 === 0 ? '·' : null;
    else if (vx[x]) c = '·';
    if (c) out.push([x, y, c, m]);
  }
  return out;
}
function gratDraw(g, gr, x0, y0, cMin, cMaj) { for (let k = 0; k < gr.length; k++) { const q = gr[k]; g.set(x0 + q[0], y0 + q[1], q[2], q[3] ? cMaj : cMin); } }
const SCH = [58, 188, 305, 120];
A({ id: 'te-scope', name: '示波器', cat: '科技', theme: 'matrix', hue: true, desc: '螢光掃描線畫出正弦波與方波',
  params: { mode: 'dual', sweep: 1.3, decay: 1.8, thr: 0.07 },
  variants: [
    { id: 'saw', name: '三通道', desc: '鋸齒波、三角波與脈寬調變', params: { mode: 'tri', sweep: 1.6 } },
    { id: 'am', name: '調幅', theme: 'amber', desc: '高頻載波被包絡線起伏調制', params: { mode: 'am', sweep: 1.1, decay: 2.6 } },
    { id: 'lissa', name: '李沙育', desc: 'XY 模式下慢慢變形的李沙育圖形', params: { mode: 'lissa', decay: 13, thr: 0.32 } },
    { id: 'xy', name: 'XY 圖形', theme: 'ice', desc: '光點畫出玫瑰線、繁花曲線與環結', params: { mode: 'xy', decay: 13, thr: 0.32 } },
    { id: 'logic', name: '邏輯分析', theme: 'cyber', desc: '多路數位訊號與解碼後的位元組', params: { mode: 'logic' } },
    { id: 'fft', name: '頻域', desc: '上方時域波形、下方即時頻譜', params: { mode: 'fft', sweep: 1.4, decay: 3 } },
    { id: 'roll', name: '捲動記錄', theme: 'mint', desc: '慢速訊號從右往左連續捲動', params: { mode: 'roll' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.rows = rows - 2;
    s.o = phosNew(cols, s.rows);
    s.sw = 0; s.th = 0;
    s.gr = gratBuild(cols, s.rows, 10, 8);
    s.cyc = clamp(s.o.W / 14, 12, 46); // 載波週期數依寬度縮放，縮圖才不會糊成一團
    if (p.mode === 'roll') { s.hist = [new Float32Array(s.o.W), new Float32Array(s.o.W), new Float32Array(s.o.W)]; s.rt = 0; s.racc = s.o.W; s.rh = 0; }
    if (p.mode === 'logic') { s.off = rint(0, 5000); s.lanes = clamp(Math.floor((rows - 4) / 5), 6, 16); }
  },
  sig(mode, ch, u, t, cyc) {
    // u：畫面上的時間（0–1 是整個寬度）；cyc：調幅載波在整個寬度內的週期數
    const TAUu = TAU * u;
    if (mode === 'dual') {
      const fr = 2.5 + 0.8 * Math.sin(t * 0.13);
      if (ch === 0) return Math.sin(TAUu * fr + t * 0.2) * (0.85 + 0.15 * Math.sin(t * 0.7));
      const v = Math.sin(TAUu * (fr * 2) + 1.1);
      return (v > 0 ? 1 : -1) * 0.8 + 0.06 * Math.sin(TAUu * 90);
    }
    if (mode === 'tri') {
      const fr = 3 + Math.sin(t * 0.11);
      if (ch === 0) return fract(u * fr + t * 0.05) * 2 - 1;
      if (ch === 1) { const q = fract(u * fr * 0.75 + 0.3); return (q < 0.5 ? q * 4 - 1 : 3 - q * 4); }
      const duty = 0.5 + 0.4 * Math.sin(t * 0.6);
      return fract(u * 8) < duty ? 0.8 : -0.8;
    }
    if (mode === 'am') {
      const m = 0.55 + 0.45 * Math.sin(t * 0.25), env = 1 + m * Math.sin(TAUu * 2 + t * 0.4);
      return ch === 0 ? env * Math.sin(TAUu * (cyc || 46)) * 0.5 : env * 0.5;
    }
    if (mode === 'fft') {
      const f1 = 3 + Math.sin(t * 0.17), f2 = 11 + 3 * Math.sin(t * 0.09), f3 = 23 + 5 * Math.sin(t * 0.13);
      return 0.55 * Math.sin(TAUu * f1) + 0.28 * Math.sin(TAUu * f2 + 0.7) + 0.16 * Math.sin(TAUu * f3) + 0.04 * Math.sin(TAUu * 177 + t * 9);
    }
    return 0;
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, p } = f, o = s.o, W = o.W, Hh = o.Hh, R = s.rows;
    const cMin = f.C(0.16), cMaj = f.C(0.3);
    if (p.mode === 'logic') return this.logic(s, f);
    gratDraw(g, s.gr, 0, 0, cMin, cMaj);
    phosDecay(o, Math.exp(-dt * p.decay));
    const mode = p.mode;
    if (mode === 'dual' || mode === 'tri' || mode === 'am' || mode === 'fft') {
      const nch = mode === 'dual' ? 2 : mode === 'tri' ? 3 : mode === 'am' ? 1 : 1;
      const s0 = s.sw, s1 = s.sw + dt * p.sweep;
      s.sw = s1;
      const a = s0 % 1, b = s1 % 1, wrap = Math.floor(s1) !== Math.floor(s0);
      const segs = wrap ? [[a, 1], [0, b]] : [[a, b]];
      const area = mode === 'fft' ? Hh * 0.55 : Hh;
      for (let c = 0; c < nch; c++) {
        const cy = mode === 'am' ? Hh / 2 : mode === 'fft' ? area / 2 : (Hh * (c + 0.5)) / nch, amp = mode === 'am' ? Hh * 0.42 : mode === 'fft' ? area * 0.42 : (Hh / nch) * 0.38;
        for (const [ua, ub] of segs) {
          let px = ua * W, py = cy - this.sig(mode, c, ua, t, s.cyc) * amp;
          for (let x = Math.floor(ua * W) + 1; x <= ub * W; x++) {
            const u = x / W, y = cy - this.sig(mode, c, u, t, s.cyc) * amp;
            phosLine(o, px, py, x, y, 1, c);
            px = x; py = y;
          }
        }
        if (mode === 'am') {
          // 包絡線（虛線）
          for (let x = 0; x < W; x += 3) { const e = this.sig('am', 1, x / W, t, s.cyc) * amp; phosDot(o, x, cy - e, 0.35, 1); phosDot(o, x, cy + e, 0.35, 1); }
        }
      }
      // 光點
      for (let c = 0; c < nch; c++) {
        const cy = mode === 'am' ? Hh / 2 : mode === 'fft' ? area / 2 : (Hh * (c + 0.5)) / nch, amp = mode === 'am' ? Hh * 0.42 : mode === 'fft' ? area * 0.42 : (Hh / nch) * 0.38;
        const x = b * W, y = cy - this.sig(mode, c, b, t, s.cyc) * amp;
        for (let k = -2; k <= 2; k++) phosDot(o, x + k * 0.5, y, 1, c);
      }
      if (mode === 'fft') {
        // 下方頻譜：依三個成分頻率畫峰值
        const f1 = 3 + Math.sin(t * 0.17), f2 = 11 + 3 * Math.sin(t * 0.09), f3 = 23 + 5 * Math.sin(t * 0.13);
        const y0 = Hh - 2, sh = Hh * 0.36;
        for (let x = 0; x < W; x += 1) {
          const fr = (x / W) * 40;
          const m = 0.95 * Math.exp(-((fr - f1) ** 2) * 2) + 0.55 * Math.exp(-((fr - f2) ** 2) * 1.5) + 0.35 * Math.exp(-((fr - f3) ** 2) * 1.2) + 0.04 + 0.03 * Math.random();
          const yy = y0 - m * sh;
          if (m > 0.09 && x % 3 === 0) phosLine(o, x, y0, x, yy, 0.45, 2); phosDot(o, x, yy, 1, 2);
        }
      }
    } else if (mode === 'lissa' || mode === 'xy') {
      const Rr = Math.min(W * 0.45, Hh * 0.45 * 1.05), cx = W / 2, cy = Hh / 2;
      const N = 1400;
      s.th += dt;
      let px = null, py = null;
      for (let k = 0; k <= N; k++) {
        const q = k / N;
        let x, y;
        if (mode === 'lissa') {
          const pairs = [[1, 2], [3, 2], [3, 4], [5, 4], [2, 3], [5, 6]], cyc = (t / 9) % pairs.length, i0 = Math.floor(cyc), fr = sstep((cyc - i0 - 0.75) * 4);
          const A0 = pairs[i0], A1 = pairs[(i0 + 1) % pairs.length], a = A0[0] + (A1[0] - A0[0]) * fr, b2 = A0[1] + (A1[1] - A0[1]) * fr;
          const th = q * TAU * 4, d = t * 0.7;
          x = Math.sin(a * th + d); y = Math.sin(b2 * th);
        } else {
          // 玫瑰線的花瓣數每一輪（40 秒）才換一次，畫面上不會突然跳變
          const shapes = 4, cyc = (t / 10) % shapes, i0 = Math.floor(cyc), fr = sstep((cyc - i0 - 0.7) / 0.3), round = Math.floor(t / 40);
          const P0 = this.shape(i0, q, t, round), P1 = this.shape((i0 + 1) % shapes, q, t, i0 === shapes - 1 ? round + 1 : round);
          x = P0[0] + (P1[0] - P0[0]) * fr; y = P0[1] + (P1[1] - P0[1]) * fr;
        }
        const X = cx + x * Rr * 1.05, Y = cy - y * Rr * 0.95;
        if (px !== null) phosLine(o, px, py, X, Y, 0.9, mode === 'xy' ? 1 : 0);
        px = X; py = Y;
      }
    } else if (mode === 'roll') {
      // 捲動記錄：三支筆從右邊寫入
      s.racc += dt * 40;
      while (s.racc >= 1) {
        s.racc -= 1; s.rt += 1 / 40; s.rh = (s.rh + 1) % W;
        const T = s.rt;
        s.hist[0][s.rh] = 0.6 * Noise.n3(T * 0.35, 1.3) + 0.25 * Math.sin(T * 1.1);
        s.hist[1][s.rh] = 0.7 * Noise.n3(T * 0.8, 5.1) + (fract(T / 7) < 0.05 ? 0.6 : 0);
        s.hist[2][s.rh] = Math.sin(T * 0.6) * 0.5 + 0.2 * Noise.n3(T * 3, 9.2);
      }
      o.P.fill(0);
      for (let c = 0; c < 3; c++) {
        const cy = (Hh * (c + 0.5)) / 3, amp = Hh / 3 * 0.42, H = s.hist[c];
        let py = null;
        for (let x = 0; x < W; x++) {
          const y = cy - H[(s.rh + 1 + x) % W] * amp;
          if (py !== null) phosLine(o, x - 1, py, x, y, 0.35 + 0.65 * (x / W), c);
          py = y;
        }
      }
    }
    const th = p.thr;
    phosFlush(g, o, th, (v, tg) => f.H(SCH[tg], 0.18 + 0.62 * Math.min(1, v * 1.15)));
    if (mode === 'fft') {
      // 分隔線與標籤畫在螢光之後，才不會被波形蓋掉
      const yd = Math.floor(R * 0.58);
      for (let x = 0; x < cols; x++) g.set(x, yd, '─', cMaj);
      put(g, 2, yd, ' FFT · Hanning · 0–40 kHz ', f.C(0.5));
    }
    // 讀數
    const yb = rows - 2;
    for (let x = 0; x < cols; x++) g.set(x, yb, '─', f.C(0.2));
    const fr = (2.5 + 0.8 * Math.sin(t * 0.13)) * 0.4;
    const RD = {
      dual: [['CH1 500mV', 0], ['CH2 2.00V', 1], ['M 250µs', -1], ['T▲ CH1 0.00V', -1], ['f=' + fr.toFixed(3) + 'kHz', 0], ['Vpp=' + (1.7 + 0.3 * Math.sin(t * 0.7)).toFixed(2) + 'V', 0]],
      tri: [['CH1 1.00V', 0], ['CH2 1.00V', 1], ['CH3 5.00V', 2], ['M 1.00ms', -1], ['duty=' + Math.round((0.5 + 0.4 * Math.sin(t * 0.6)) * 100) + '%', 2]],
      am: [['CH1 200mV', 0], ['M 50µs', -1], ['carrier 455kHz', 0], ['mod=' + Math.round((0.55 + 0.45 * Math.sin(t * 0.25)) * 100) + '%', 1]],
      fft: [['CH1 1.00V', 0], ['M 2.00ms', -1], ['MATH FFT', 2], ['peak ' + ((3 + Math.sin(t * 0.17)) * 1).toFixed(2) + 'kHz', 2]],
      lissa: [['XY MODE', -1], ['X: CH1', 0], ['Y: CH2', 0], ['phase ' + Math.round((t * 0.7 * 57.3) % 360) + '°', 0]],
      xy: [['XY MODE', -1], ['X: CH1 1.00V', 0], ['Y: CH2 1.00V', 0], ['persist ON', -1]],
      roll: [['ROLL', -1], ['CH1 temp', 0], ['CH2 pressure', 1], ['CH3 flow', 2], ['M 5.00s', -1]],
    }[p.mode];
    let x = 1;
    for (const [txt, c] of RD) { put(g, x, rows - 1, txt, c < 0 ? f.C(0.65) : f.H(SCH[c], 0.6)); x += txt.length + 3; }
    const rn = Math.floor(t * 2) % 2 ? 'RUN' : 'RUN';
    put(g, cols - 6, rows - 1, rn, f.H(120, 0.55));
  },
  shape(k, q, t, round) {
    const th = q * TAU;
    if (k === 0) { const n = [5, 3, 7][(round || 0) % 3], r = Math.cos(n * th) * 0.95; return [r * Math.cos(th + t * 0.2), r * Math.sin(th + t * 0.2)]; }
    if (k === 1) { const R = 1, r = 0.38, d = 0.62, a = th * 13; const x = (R - r) * Math.cos(a) + d * Math.cos(((R - r) / r) * a), y = (R - r) * Math.sin(a) - d * Math.sin(((R - r) / r) * a); return [x * 0.78, y * 0.78]; }
    if (k === 2) {
      const a = th * 2, p2 = 2, q2 = 5, r = Math.cos(q2 * a / 2 * 1) + 2, x0 = r * Math.cos(p2 * a / 2 * 1) / 3, z0 = r * Math.sin(p2 * a / 2) / 3, y0 = -Math.sin(q2 * a / 2) / 3;
      const ca = Math.cos(t * 0.5), sa = Math.sin(t * 0.5), x1 = x0 * ca + z0 * sa, z1 = -x0 * sa + z0 * ca, cb = Math.cos(0.6), sb = Math.sin(0.6), y1 = y0 * cb - z1 * sb;
      return [x1 * 0.95, y1 * 0.95];
    }
    const r = 0.25 + 0.7 * Math.abs(Math.sin(th * 3 + t * 0.3)) * (0.6 + 0.4 * Math.cos(th * 8));
    return [r * Math.cos(th), r * Math.sin(th)];
  },
  logic(s, f) {
    const { g, cols, rows, dt, t } = f;
    s.off += dt * 22;
    const NL = s.lanes, lh = Math.floor((rows - 3) / NL), LW = 7, off = Math.floor(s.off);
    const names = ['CLK', 'CS#', 'MOSI', 'MISO', 'D0', 'D1', 'D2', 'D3', 'SCL', 'SDA', 'TX', 'RX', 'PWM', 'INT', 'D4', 'D5'];
    const val = (ln, u) => {
      const bit = Math.floor(u / 4), frame = Math.floor(u / 72), inFrame = (u % 72) < 64;
      switch (ln) {
        case 0: return Math.floor(u / 2) % 2 === 0 ? 1 : 0;
        case 1: return inFrame && (hash2(frame, 3) & 3) !== 0 ? 0 : 1;
        case 2: case 3: return inFrame ? hash2(bit, ln * 7) & 1 : 1;
        case 8: return Math.floor(u / 3) % 2;
        case 9: return hash2(Math.floor(u / 6), 99) & 1;
        case 10: case 11: return (hash2(Math.floor(u / 5), ln) % 5) !== 0 ? 1 : 0;
        case 12: return (u % 20) < 10 + 8 * Math.sin(u * 0.01) ? 1 : 0;
        case 13: return (hash2(Math.floor(u / 40), 13) % 7) === 0 && (u % 40) < 6 ? 1 : 0;
        default: return hash2(Math.floor(u / 8), ln * 31) & 1;
      }
    };
    for (let L = 0; L < NL; L++) {
      const y0 = 1 + L * lh, yh = y0, yl = y0 + Math.max(1, lh - 2), col = f.H((L * 47) % 360, 0.6), dim = f.C(0.25);
      put(g, 1, Math.floor((yh + yl) / 2), names[L], f.C(0.75));
      let prev = val(L, off + LW - 1);
      for (let x = LW; x < cols; x++) {
        const v = val(L, off + x);
        if (v !== prev) {
          g.set(x, yh, v ? '┌' : '┐', col); g.set(x, yl, v ? '┘' : '└', col);
          for (let y = yh + 1; y < yl; y++) g.set(x, y, '│', col);
        } else g.set(x, v ? yh : yl, '─', col);
        prev = v;
      }
      // 解碼後的位元組（MOSI / MISO）
      if ((L === 2 || L === 3) && lh >= 3) {
        for (let u0 = Math.floor((off + LW) / 72) * 72; u0 < off + cols; u0 += 72) {
          const fr = Math.floor(u0 / 72);
          if ((hash2(fr, 3) & 3) === 0) continue;
          for (let k = 0; k < 2; k++) {
            const bx = u0 + k * 32 - off; let byte = 0;
            for (let b = 0; b < 8; b++) byte = (byte << 1) | (hash2(Math.floor((u0 + k * 32 + b * 4) / 4), L * 7) & 1);
            const tx = '0x' + hx(byte, 2), cx = bx + 13;
            if (cx >= LW && cx + 4 < cols) put(g, cx, yl + 1 <= y0 + lh - 1 ? yl + 1 : yh + 1, tx, f.C(0.9));
          }
        }
      }
      if (lh >= 4) for (let x = LW; x < cols; x += 2) if (g.ch[(y0 + lh - 1) * cols + x] === ' ') g.set(x, y0 + lh - 1, '·', dim);
    }
    // 時間尺與觸發游標
    const yr = rows - 2;
    for (let x = LW; x < cols; x++) {
      const u = off + x;
      g.set(x, yr, u % 40 === 0 ? '┴' : u % 8 === 0 ? '╵' : '─', f.C(0.3));
      if (u % 40 === 0 && x + 6 < cols) put(g, x, rows - 1, (u / 40 * 0.5).toFixed(1) + 'µs', f.C(0.5));
    }
    const tx = LW + Math.floor((cols - LW) * 0.3);
    for (let y = 1; y < yr; y++) if (g.ch[y * cols + tx] === ' ') g.set(tx, y, '┆', f.H(0, 0.5));
    put(g, tx - 1, 0, '▼T', f.H(0, 0.7));
    put(g, LW, 0, 'SPI + I²C + UART  ·  24 MS/s  ·  ' + (s.off / 1e3).toFixed(3) + ' ms', f.C(0.6));
  },
});

/* ═════════ 4. 生理監視 ═════════ */
// 心電圖一拍的形狀（ph 0–1）
const ecgW = (ph, a) => {
  a = a || [1, 1, 1];
  const g2 = (c, w) => Math.exp(-(((ph - c) / w) ** 2));
  return a[0] * 0.13 * g2(0.18, 0.03) - a[1] * 0.14 * g2(0.355, 0.009) + a[1] * 1.0 * g2(0.385, 0.011) - a[1] * 0.28 * g2(0.415, 0.011) + a[2] * 0.3 * g2(0.64, 0.055);
};
const plethW = ph => { ph = fract(ph - 0.12); return Math.exp(-(((ph - 0.25) / 0.09) ** 2)) * 0.95 + 0.38 * Math.exp(-(((ph - 0.5) / 0.09) ** 2)) + 0.25 * Math.exp(-(((ph - 0.05) / 0.12) ** 2)); };
// 心跳狀態：依取樣時間推進
function beat(st, dtS, hr) {
  st.ph += dtS / st.rr;
  if (st.ph >= 1) { st.ph -= 1; st.rr = (60 / hr) * (1 + 0.035 * gauss()); st.beats++; st.flash = 0.25; }
  return st.ph;
}
const LEADS = [['I', [1, 0.7, 1]], ['II', [1, 1, 1]], ['III', [0.6, 0.45, 0.5]], ['aVR', [-1, -0.8, -1]], ['aVL', [0.6, 0.35, 0.6]], ['aVF', [0.8, 0.75, 0.7]], ['V1', [0.6, -0.9, -0.3]], ['V2', [0.8, -0.6, 0.9]], ['V3', [0.9, 0.5, 1.2]], ['V4', [1, 1.3, 1.3]], ['V5', [1, 1.2, 1.1]], ['V6', [0.9, 0.9, 0.9]]];
const EEGN = ['Fp1-F7', 'F7-T3', 'T3-T5', 'T5-O1', 'Fp2-F8', 'F8-T4', 'T4-T6', 'T6-O2', 'Fp1-F3', 'F3-C3', 'C3-P3', 'P3-O1', 'Fp2-F4', 'F4-C4', 'C4-P4', 'P4-O2'];
A({ id: 'te-vital', name: '生理監視', cat: '科技', theme: 'matrix', hue: true, desc: '心電、血氧與呼吸波形和大字讀數',
  params: { mode: 'icu', speed: 1 },
  variants: [
    { id: 'strip', name: '心電圖紙', theme: 'paper', hue: false, desc: '方格紙上捲動的大心電圖', params: { mode: 'strip' } },
    { id: 'leads', name: '十二導程', theme: 'mint', desc: '十二個導程的波形與節律帶', params: { mode: 'leads' } },
    { id: 'eeg', name: '腦波', theme: 'lavender', hue: false, desc: '十六個頻道的腦波與 α 波爆發', params: { mode: 'eeg' } },
    { id: 'seismo', name: '地震儀', theme: 'paper', desc: '一行行的震波紀錄，偶爾來場地震', params: { mode: 'seismo' } },
    { id: 'stress', name: '運動測試', theme: 'fire', desc: '心率隨跑步機階段一路攀升', params: { mode: 'stress' } },
    { id: 'fetal', name: '胎心監測', theme: 'sakura', hue: false, desc: '胎心率與宮縮曲線緩緩捲動', params: { mode: 'fetal' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.b = bnew(cols, rows);
    s.bt = { ph: 0.3, rr: 0.85, beats: 0, flash: 0 };
    s.hr = 72; s.T = 0; s.acc = 0; s.head = 0;
    const m = p.mode;
    if (m === 'icu' || m === 'stress') {
      s.tw = m === 'icu' ? Math.floor(cols * 0.7) : Math.floor(cols * 0.6) - 2;
      s.W = s.tw * 2; s.buf = [new Float32Array(s.W), new Float32Array(s.W), new Float32Array(s.W)];
      s.spd = s.W / 6;
      s.bp = [rint(112, 128), rint(70, 82)]; s.bpT = 0;
      if (m === 'stress') {
        s.trend = []; s.stT = rnd(28, 52);
        for (let k = 300; k >= 1; k--) { const tm = s.stT - k * 0.25; if (tm >= 0) s.trend.push(this.stressHR(tm % 80) + gauss() * 1.2); }
        s.hr = this.stressHR(s.stT % 80);
      }
    }
    if (m === 'strip' || m === 'fetal') { s.W = cols * 2; s.buf = [new Float32Array(s.W), new Float32Array(s.W)]; s.spd = m === 'strip' ? cols * 2 / 5 : cols * 2 / 30; s.off = 0; s.ctx = 0; s.fhr = 140; s.toco = 0; s.acc2 = 0; }
    if (m === 'leads') { s.W = (cols - 2) * 2; s.buf = [new Float32Array(s.W), new Float32Array(s.W), new Float32Array(s.W), new Float32Array(s.W)]; s.spd = s.W / 10; }
    if (m === 'eeg') { s.nch = rows >= 40 ? 16 : 8; s.W = (cols - 9) * 2; s.buf = []; for (let k = 0; k < s.nch; k++) s.buf.push(new Float32Array(s.W)); s.spd = s.W / (cols >= 200 ? 10 : 5); s.kf = cols >= 200 ? 1 : 0.45; s.ph = Array.from({ length: s.nch * 4 }, () => rnd(0, TAU)); s.alpha = 0; s.blink = 0; }
    if (m === 'seismo') {
      s.nl = Math.max(6, Math.floor((rows - 3) / 3)); s.lh = (rows - 3) / s.nl;
      s.W = (cols - 8) * 2; s.lines = []; for (let k = 0; k < s.nl; k++) s.lines.push(new Float32Array(s.W).fill(NaN));
      s.cur = 0; s.spd = s.W / 5; s.q = null; s.nextQ = rnd(4, 8); s.lineNo = rint(100, 900);
      // 預先填幾行，畫面一開始不是空的
      for (let k = 0; k < Math.floor(s.nl * 0.6); k++) { for (let x = 0; x < s.W; x++) { s.T += 1 / s.spd; s.lines[s.cur][x] = this.seisV(s, 1 / s.spd); } s.cur++; s.lineNo++; }
    }
    if (s.buf && m !== 'seismo') {
      // 預填：先跑一圈，畫面一開始就有波形
      const n = s.W;
      for (let k = 0; k < n; k++) this.sample(s, f, p);
      s.head = 0;
    }
  },
  // 取一個樣本寫到 head 位置
  sample(s, f, p) {
    const m = p.mode, dtS = 1 / s.spd, x = s.head;
    s.T += dtS;
    if (m === 'icu' || m === 'stress') {
      const ph = beat(s.bt, dtS, s.hr);
      s.buf[0][x] = ecgW(ph); s.buf[1][x] = plethW(ph); s.buf[2][x] = Math.sin(s.T * TAU / 4.2) * 0.9 + 0.08 * Math.sin(s.T * 7);
    } else if (m === 'strip') {
      const ph = beat(s.bt, dtS, s.hr);
      s.buf[0][x] = ecgW(ph) + 0.015 * Math.sin(s.T * 40) + 0.04 * Math.sin(s.T * 0.9);
    } else if (m === 'fetal') {
      // 胎心率：基線 140、變異、偶爾加速；宮縮：每 25 秒左右一次
      s.ctx += dtS;
      const T4 = s.T * 4, cyc = (T4 % 26) / 26, toco = 12 + 70 * Math.exp(-(((cyc - 0.5) / 0.12) ** 2)) + 3 * Noise.n3(T4 * 0.5, 2);
      const acc = Math.max(0, Math.sin(T4 * 0.09)) ** 6 * 22;
      s.buf[0][x] = 140 + acc + 6 * Noise.n3(T4 * 0.4, 7) + 3 * Noise.n3(T4 * 2.5, 9);
      s.buf[1][x] = toco;
    } else if (m === 'leads') {
      const ph = beat(s.bt, dtS, s.hr), seg = Math.floor(x / (s.W / 4));
      for (let r = 0; r < 3; r++) s.buf[r][x] = ecgW(ph, LEADS[seg * 3 + r][1]);
      s.buf[3][x] = ecgW(ph);
    } else if (m === 'eeg') {
      s.alpha += (Math.sin(s.T * 0.4) > 0.3 ? 1 : 0 - s.alpha) * dtS * 0.8;
      if (s.blink <= 0 && Math.random() < dtS * 0.15) s.blink = 0.6; else s.blink -= dtS;
      for (let c = 0; c < s.nch; c++) {
        const P = s.ph, back = c % 8 >= 3;
        const kf = s.kf, T = s.T * kf;
        let v = 0.22 * Math.sin(T * TAU * 6.3 + P[c * 4]) + 0.18 * Math.sin(T * TAU * 2.1 + P[c * 4 + 1]) + (kf < 1 ? 0 : 0.12 * Math.sin(T * TAU * 17 + P[c * 4 + 2])) + 0.25 * Noise.n3(T * 9, c * 3.1);
        v += (back ? 0.55 : 0.2) * Math.max(0, s.alpha) * Math.sin(T * TAU * 10.2 + P[c * 4 + 3]);
        if ((c === 0 || c === 4 || c === 8 || c === 12) && s.blink > 0) v -= 1.6 * Math.sin((0.6 - s.blink) / 0.6 * Math.PI);
        s.buf[c][x] = v;
      }
    }
    s.head = (s.head + 1) % s.W;
  },
  stressHR(cyc) { return cyc >= 60 ? 165 - (cyc - 60) * 3.5 : 78 + Math.min(5, Math.floor(cyc / 10)) * 15 + (cyc % 10) * 1.2; },
  seisV(s, dtS) {
    s.nextQ -= dtS;
    if (!s.q && s.nextQ <= 0) s.q = { t: 0, m: rnd(0.8, 3.2) };
    let v = 0.08 * Math.sin(s.T * 1.7) + 0.06 * Noise.n3(s.T * 6, 1) + 0.04 * (Math.random() - 0.5);
    if (s.q) {
      const q = s.q; q.t += dtS;
      const P = q.t > 0 ? Math.exp(-q.t * 1.2) * Math.min(1, q.t * 8) * 0.35 : 0, S = q.t > 1.6 ? Math.exp(-(q.t - 1.6) * 0.55) * Math.min(1, (q.t - 1.6) * 4) : 0;
      v += q.m * (P * Math.sin(q.t * 55) + S * (Math.sin(q.t * 23) * 0.7 + Math.sin(q.t * 37 + 1) * 0.5) * (0.7 + 0.3 * Noise.n3(q.t * 4, 3)));
      if (q.t > 11) { s.q = null; s.nextQ = rnd(8, 20); }
    }
    return v;
  },
  frame(s, f) {
    const { p, dt } = f, m = p.mode;
    s.bt.flash = Math.max(0, s.bt.flash - dt);
    if (m === 'seismo') return this.seismo(s, f);
    if (m === 'stress') {
      s.stT += dt;
      const cyc = s.stT % 80, stage = Math.min(6, Math.floor(cyc / 10));
      s.stage = stage; s.rec = cyc >= 60;
      s.hr += (this.stressHR(cyc) - s.hr) * Math.min(1, dt * 0.8);
    } else s.hr = 72 + 5 * Math.sin(s.T * 0.1);
    s.acc += dt * s.spd * p.speed;
    let guard = 0;
    while (s.acc >= 1 && guard++ < 2000) { s.acc -= 1; this.sample(s, f, p); if (m === 'strip' || m === 'fetal') s.off++; }
    if (m === 'icu' || m === 'stress') return this.icu(s, f);
    if (m === 'strip') return this.strip(s, f);
    if (m === 'leads') return this.leads(s, f);
    if (m === 'eeg') return this.eeg(s, f);
    if (m === 'fetal') return this.fetal(s, f);
  },
  // 掃描式畫線：head 前方留一段空白
  sweep(b, buf, W, head, x0, cy, amp, tag, gap, lo, hi) {
    let py = null;
    for (let x = 0; x < W; x++) {
      const d = (x - head + W) % W;
      if (d < gap) { py = null; continue; }
      let v = buf[x]; if (lo !== undefined) v = clamp(v, lo, hi);
      const y = cy - v * amp;
      if (py !== null) bline(b, x0 + x - 1, py, x0 + x, y, 0.4 + 0.6 * (1 - ((head - x + W) % W) / W), tag); else bdot(b, x0 + x, y, 1, tag);
      py = y;
    }
  },
  icu(s, f) {
    const { g, cols, rows, t, p } = f, b = s.b, W = s.W, stress = p.mode === 'stress';
    bclr(b);
    const Hh = rows * 4, gap = Math.max(6, W / 40);
    const HUES = [120, 185, 52];
    if (!stress) {
      const bands = [[0.04, 0.42], [0.47, 0.7], [0.75, 0.95]], amps = [0.9, 0.85, 0.8];
      for (let k = 0; k < 3; k++) {
        const y0 = bands[k][0] * Hh, y1 = bands[k][1] * Hh, cy = k === 0 ? y0 + (y1 - y0) * 0.68 : k === 1 ? y1 - (y1 - y0) * 0.1 : (y0 + y1) / 2;
        const amp = (y1 - y0) * (k === 0 ? 0.62 : k === 1 ? 0.85 : 0.45) * amps[k];
        this.sweep(b, s.buf[k], W, s.head, 0, cy, amp, k, gap);
        put(g, 1, Math.floor(y0 / 4), ['II', 'Pleth', 'Resp'][k], f.H(HUES[k], 0.55));
      }
    } else {
      const y0 = 0.03 * Hh, y1 = 0.5 * Hh;
      this.sweep(b, s.buf[0], W, s.head, 2, y0 + (y1 - y0) * 0.72, (y1 - y0) * 0.62, 0, gap);
      put(g, 1, 0, 'II  ×1  25mm/s', f.H(120, 0.55));
      // 心率趨勢
      if (!s.trT || t - s.trT > 0.25) { s.trT = t; s.trend.push(s.hr); if (s.trend.length > 400) s.trend.shift(); }
      const tx0 = 2, tw = Math.floor(cols * 0.6) - 4, ty0 = Math.floor(rows * 0.55) + 1, th = rows - ty0 - 2;
      box(g, tx0 - 1, ty0 - 1, tw + 2, th + 2, f.C(0.25), 'HR trend', f.C(0.6));
      const n = s.trend.length, bw2 = tw * 2;
      let py = null;
      for (let k = 0; k < Math.min(n, bw2); k++) {
        const v = s.trend[n - Math.min(n, bw2) + k], y = (ty0 + th) * 4 - 1 - ((v - 60) / 120) * th * 4;
        const x = tx0 * 2 + k;
        if (py !== null) bline(b, x - 1, py, x, y, 1, 3); py = y;
      }
      for (const lv of [80, 120, 160]) { const yy = Math.floor(ty0 + th - ((lv - 60) / 120) * th); put(g, tx0 + tw - 4, yy, String(lv), f.C(0.35)); for (let x = tx0; x < tx0 + tw - 5; x += 3) if (g.ch[yy * cols + x] === ' ') g.set(x, yy, '·', f.C(0.2)); }
    }
    bflush(g, b, (v, tg) => f.H([120, 185, 52, 25][tg], 0.25 + 0.55 * v));
    // 右側大字
    const px0 = stress ? Math.floor(cols * 0.6) + 1 : s.tw + 1, pw = cols - px0 - 1;
    for (let y = 0; y < rows; y++) g.set(px0 - 1, y, '│', f.C(0.2));
    const sx = pw >= 60 ? 3 : pw >= 30 ? 2 : 1, sy = Math.max(1, Math.round(sx * 0.66 + 0.2));
    const hrS = String(Math.round(s.hr));
    if (!stress) {
      const items = [['HR', 'bpm', hrS, 120, 0.02], ['SpO₂', '%', String(97 + Math.round(Math.sin(s.T * 0.05) + 0.6)), 185, 0.3], ['RESP', 'rpm', String(15 + Math.round(Math.sin(s.T * 0.03) * 1.4)), 52, 0.55]];
      for (const [lab, unit, val, h, yf] of items) {
        const y = Math.floor(rows * yf) + 1;
        put(g, px0 + 1, y, lab, f.H(h, 0.55)); put(g, px0 + 1 + lab.length + 1, y, unit, f.C(0.35));
        big(g, px0 + Math.max(1, Math.floor((pw - bigW(val, sx)) / 2)), y + 1, val, sx, sy, f.H(h, 0.62));
        if (lab === 'HR') put(g, px0 + pw - 3, y, '♥', s.bt.flash > 0 ? f.H(0, 0.7) : f.C(0.2));
      }
      const y = Math.floor(rows * 0.8);
      if (t - s.bpT > 30) { s.bpT = t; s.bp = [rint(112, 128), rint(70, 82)]; }
      put(g, px0 + 1, y, 'NIBP mmHg', f.C(0.6)); put(g, px0 + 1, y + 1, s.bp[0] + '/' + s.bp[1] + ' (' + Math.round((s.bp[0] + 2 * s.bp[1]) / 3) + ')', f.C(0.95));
      put(g, px0 + 1, y + 2, 'TEMP 36.' + (7 + Math.round(Math.sin(t * 0.01))) + '°C', f.H(300, 0.6));
      put(g, 1, rows - 1, 'Bed 07 · Adult · ' + fmtT(30000 + t), f.C(0.4));
    } else {
      const y0 = 0;
      put(g, px0 + 1, y0 + 1, 'HR', f.H(120, 0.55)); put(g, px0 + 4, y0 + 1, 'bpm', f.C(0.35));
      big(g, px0 + 2, y0 + 2, hrS, sx, sy, f.H(s.hr > 150 ? 0 : 120, 0.62));
      const yy = y0 + 3 + 5 * sy, stg = s.rec ? 'RECOVERY' : 'STAGE ' + (s.stage + 1);
      put(g, px0 + 1, yy, stg, f.C(0.95));
      const spd = s.rec ? 2.0 : [2.7, 4.0, 5.5, 6.8, 8.0, 8.8, 9.6][s.stage], grd = s.rec ? 0 : [10, 12, 14, 16, 18, 20, 22][s.stage];
      put(g, px0 + 1, yy + 1, 'speed ' + spd.toFixed(1) + ' km/h', f.C(0.65));
      put(g, px0 + 1, yy + 2, 'grade ' + grd + ' %', f.C(0.65));
      put(g, px0 + 1, yy + 3, 'time  ' + fmtT(s.stT % 80 * 9).slice(3), f.C(0.65));
      put(g, px0 + 1, yy + 4, 'METs  ' + (spd * 1.3 + grd * 0.2).toFixed(1), f.C(0.65));
      put(g, px0 + 1, yy + 5, 'BP    ' + Math.round(120 + s.hr * 0.3) + '/' + Math.round(78 + s.hr * 0.05), f.C(0.65));
      put(g, px0 + 1, yy + 7, 'target ' + Math.round(0.85 * 190) + ' bpm', f.C(0.4));
      hbar(g, px0 + 1, yy + 8, Math.max(6, pw - 3), (s.hr - 60) / 110, f.H(s.hr > 150 ? 0 : 50, 0.6), f.C(0.2), '░');
      if (s.hr > 158 && Math.floor(t * 2) % 2 === 0) put(g, px0 + 1, yy + 10, '▲ HR HIGH', f.H(0, 0.65));
    }
  },
  // 心電圖紙：格線跟著紙一起捲動
  paper(g, f, x0, y0, w, h, off, maj, min2) {
    const cMin = f.C(min2), cMaj = f.C(maj);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = x + off, majX = X % 10 === 0, majY = y % 5 === 0;
      let c = null, col = cMin;
      if (majX && majY) { c = '┼'; col = cMaj; } else if (majX) { c = '│'; col = cMaj; } else if (majY) { c = X % 2 ? '─' : '─'; col = cMaj; } else if (X % 2 === 0) c = '·';
      if (c) g.set(x0 + x, y0 + y, c, col);
    }
  },
  strip(s, f) {
    const { g, cols, rows, t } = f, b = s.b, W = s.W;
    bclr(b);
    this.paper(g, f, 0, 0, cols, rows, Math.floor(s.off / 2), 0.32, 0.18);
    const Hh = rows * 4, cy = Hh * 0.62, amp = Hh * 0.42;
    let py = null;
    for (let x = 0; x < W; x++) {
      const v = s.buf[0][(s.head + x) % W], y = cy - v * amp;
      if (py !== null) bline(b, x - 1, py, x, y, 1, 0); py = y;
    }
    bflush(g, b, () => f.C(0.97));
    put(g, 2, 1, ' II   25 mm/s   10 mm/mV   0.05–150 Hz ', f.C(0.85));
    const hr = ' HR ' + Math.round(s.hr) + ' bpm ', x = cols - hr.length - 2;
    put(g, x, 1, hr, f.C(0.95));
    put(g, 2, rows - 2, ' Sinus rhythm · ' + fmtT(36000 + t) + ' ', f.C(0.7));
  },
  leads(s, f) {
    const { g, cols, rows } = f, b = s.b, W = s.W;
    bclr(b);
    const rh = (rows - 1) / 4, segW = W / 4, gap = 6;
    for (let r = 0; r < 4; r++) {
      const cy = (r * rh + rh * 0.66) * 4, amp = rh * 4 * 0.42;
      this.sweep(b, s.buf[r], W, s.head, 2, cy, amp, r === 3 ? 1 : 0, gap, -1.1, 1.5);
      for (let k = 0; k < (r === 3 ? 1 : 4); k++) put(g, 2 + Math.floor(k * segW / 2), Math.floor(r * rh), r === 3 ? 'II  rhythm' : LEADS[k * 3 + r][0], f.C(0.85));
      if (r < 3) for (let k = 1; k < 4; k++) { const x = 1 + Math.floor(k * segW / 2); for (let y = Math.floor(r * rh) + 1; y < Math.floor((r + 1) * rh); y++) g.set(x, y, '┊', f.C(0.2)); }
      const yl = Math.floor((r + 1) * rh) - 0;
      if (r < 3) for (let x = 0; x < cols; x += 2) g.set(x, yl, '·', f.C(0.18));
    }
    bflush(g, b, (v, tg) => f.C(tg ? 0.5 + 0.45 * v : 0.35 + 0.6 * v));
    put(g, cols - 26, rows - 1, ' 12-lead · HR ' + Math.round(s.hr) + ' bpm ', f.C(0.6));
  },
  eeg(s, f) {
    const { g, cols, rows } = f, b = s.b, W = s.W, n = s.nch;
    bclr(b);
    const ch = (rows - 2) / n, x0 = 9 * 2;
    // 每秒一條垂直格線
    for (let k = 1; k < 10; k++) { const x = 9 + Math.floor((k * (cols - 9)) / 10); for (let y = 0; y < rows - 2; y++) g.set(x, y, y % 2 ? '┊' : ' ', f.C(0.15)); put(g, x - 1, rows - 1, k + 's', f.C(0.35)); }
    for (let c = 0; c < n; c++) {
      const cy = (c + 0.5) * ch * 4, amp = ch * 4 * (cols >= 200 ? 0.5 : 0.36);
      this.sweep(b, s.buf[c], W, s.head, x0, cy, amp, c < 8 ? 0 : 1, 5, -1.6, 1.6);
      put(g, 0, Math.floor((c + 0.5) * ch), pad(EEGN[c], 7).slice(0, 7), f.C(0.5));
    }
    bflush(g, b, (v, tg) => f.C(0.35 + 0.6 * v));
    for (let x = 0; x < cols; x++) g.set(x, rows - 2, '─', f.C(0.2));
    put(g, 1, rows - 1, '7µV/mm', f.C(0.4));
  },
  fetal(s, f) {
    const { g, cols, rows, t } = f, b = s.b, W = s.W;
    bclr(b);
    const off = Math.floor(s.off / 2);
    const h1 = Math.floor(rows * 0.58), y2 = h1 + 2, h2 = rows - y2 - 1;
    // 上：胎心率格線（50–210，每 10 一格），110–160 正常帶
    for (let y = 0; y < h1; y++) {
      const bpm = 210 - (y / (h1 - 1)) * 160, inBand = bpm >= 110 && bpm <= 160;
      for (let x = 0; x < cols; x++) {
        const X = x + off, maj = X % 20 === 0;
        if (maj) g.set(x, y, '│', f.C(0.3));
        else if (y % Math.max(2, Math.round(h1 / 16)) === 0 && X % 2 === 0) g.set(x, y, '·', f.C(0.25));
        else if (inBand && (X + y) % 4 === 0) g.set(x, y, '░', f.C(0.12));
      }
      if (y % Math.max(1, Math.round(h1 / 8)) === 0) put(g, 1, y, String(Math.round(bpm)), f.C(0.5));
    }
    for (let y = y2; y < y2 + h2; y++) for (let x = 0; x < cols; x++) { const X = x + off; if (X % 20 === 0) g.set(x, y, '│', f.C(0.3)); else if ((y - y2) % Math.max(1, Math.round(h2 / 4)) === 0) g.set(x, y, '·', f.C(0.25)); }
    for (let x = 0; x < cols; x++) { if ((x + off) % 20 === 0 && x + 4 < cols) put(g, x + 1, h1, Math.floor((x + off) / 20) % 60 + "'", f.C(0.45)); }
    let p1 = null, p2 = null;
    for (let x = 0; x < W; x++) {
      const i = (s.head + x) % W;
      const v1 = s.buf[0][i], v2 = s.buf[1][i];
      const ya = (210 - v1) / 160 * (h1 * 4 - 1), yb = (y2 + h2) * 4 - 1 - (v2 / 100) * (h2 * 4 - 2);
      if (p1 !== null) { bline(b, x - 1, p1, x, ya, 1, 0); bline(b, x - 1, p2, x, yb, 1, 1); }
      p1 = ya; p2 = yb;
    }
    bflush(g, b, (v, tg) => f.C(tg ? 0.75 : 0.97));
    const last = s.buf[0][(s.head - 1 + W) % W];
    put(g, cols - 22, 0, ' FHR ' + Math.round(last) + ' bpm ', f.C(0.95));
    put(g, cols - 22, y2, ' TOCO ' + Math.round(s.buf[1][(s.head - 1 + W) % W]) + ' ', f.C(0.85));
    put(g, 6, rows - 1, '3 cm/min · ' + fmtT(50000 + t), f.C(0.45));
  },
  seismo(s, f) {
    const { g, cols, rows, dt, t } = f, b = s.b, W = s.W;
    s.acc += dt * s.spd;
    let guard = 0;
    while (s.acc >= 1 && guard++ < 2000) {
      s.acc -= 1; s.T += 1 / s.spd;
      s.lines[s.cur][s.head] = this.seisV(s, 1 / s.spd);
      s.head++;
      if (s.head >= W) {
        s.head = 0; s.cur++; s.lineNo++;
        if (s.cur >= s.nl) { s.lines.push(s.lines.shift().fill(NaN)); s.cur = s.nl - 1; }
      }
    }
    bclr(b);
    const hueOn = f.H(0, 0.5) !== f.H(200, 0.5), HU = [220, 0, 130, 280];
    for (let L = 0; L < s.nl; L++) {
      const cy = (1 + (L + 0.5) * s.lh) * 4, amp = s.lh * 4 * 0.55, buf = s.lines[L];
      let py = null;
      for (let x = 0; x < W; x++) {
        const v = buf[x];
        if (v !== v) { py = null; continue; }
        const y = cy - clamp(v, -2.6, 2.6) * amp;
        if (py !== null) bline(b, 16 + x - 1, py, 16 + x, y, 1, (s.lineNo - s.cur + L) & 3); else bdot(b, 16 + x, y, 1, (s.lineNo - s.cur + L) & 3);
        py = y;
      }
      const ln = s.lineNo - s.cur + L;
      put(g, 0, Math.floor(1 + (L + 0.5) * s.lh), fmtT(ln * 300).slice(0, 5), f.C(0.4));
    }
    bflush(g, b, (v, tg) => (hueOn ? f.H(HU[tg], 0.42) : f.C(0.8)));
    put(g, 8, 0, 'STATION TEV · BHZ · 1 line = 5 min', f.C(0.6));
    if (s.q) put(g, cols - 24, 0, '● EVENT M' + (s.q.m * 1.6 + 2).toFixed(1), f.H(0, 0.55));
  },
});

/* ═════════ 5. 頻譜分析 ═════════ */
function specInit(s, nb) { s.nb = nb; s.v = new Float32Array(nb); s.pk = new Float32Array(nb); }
// 合成的音樂頻譜：低頻鼓、中頻小鼓、高頻鈸，加上三條會移動的旋律峰
function specStep(s, t, dt) {
  const nb = s.nb, tb = t * 2.0, kick = Math.exp(-fract(tb) * 7), snare = Math.exp(-fract(tb + 0.5) * 9) * (Math.floor(tb + 0.5) % 2 === 0 ? 1 : 0.35), hat = Math.exp(-fract(tb * 2 + 0.25) * 14);
  const c1 = 0.17 + 0.07 * Math.sin(t * 0.37), c2 = 0.38 + 0.12 * Math.sin(t * 0.23 + 1), c3 = 0.6 + 0.1 * Math.sin(t * 0.31 + 2);
  const ka = Math.min(1, dt * 26), kd = Math.min(1, dt * 6);
  for (let i = 0; i < nb; i++) {
    const u = i / (nb - 1);
    let v = 0.4 * Math.pow(1 - u, 0.8) * (0.55 + 0.45 * Noise.n3(u * 7, t * 0.6, 0.5));
    v += kick * 0.58 * Math.exp(-u * 13);
    v += snare * 0.3 * Math.exp(-(((u - 0.35) / 0.18) ** 2));
    v += hat * 0.24 * Math.exp(-(((u - 0.82) / 0.12) ** 2));
    v += 0.3 * Math.exp(-(((u - c1) / 0.025) ** 2)) * (0.6 + 0.4 * Math.sin(t * 3.1));
    v += 0.22 * Math.exp(-(((u - c2) / 0.02) ** 2)) * (0.6 + 0.4 * Math.sin(t * 2.3 + 1));
    v += 0.16 * Math.exp(-(((u - c3) / 0.02) ** 2));
    v = clamp(v + 0.05 * Math.random(), 0, 1);
    s.v[i] += (v - s.v[i]) * (v > s.v[i] ? ka : kd);
    s.pk[i] = s.v[i] > s.pk[i] ? s.v[i] : Math.max(0, s.pk[i] - dt * 0.3);
  }
  s.kick = kick; s.hat = hat; s.snare = snare;
}
const specAt = (s, u, arr) => { arr = arr || s.v; const x = clamp(u, 0, 1) * (s.nb - 1), i = Math.floor(x), fr = x - i; return arr[i] + (arr[Math.min(s.nb - 1, i + 1)] - arr[i]) * fr; };
const RAMPS = ' .:-=+*#%@';
// 鋼琴捲軸頻譜：和弦進行（相對根音的半音）、調、泛音位置與強度、黑鍵、音名
const PN_CH = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], PN_KEY = [0, 5, -3, 2], PN_HO = [0, 12, 19, 24], PN_HA = [1, 0.5, 0.32, 0.22];
const PN_BLACK = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0], PN_NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
A({ id: 'te-spectrum', name: '頻譜分析', cat: '科技', theme: 'synth', hue: true, desc: '頻譜一排排推向遠方的立體地形',
  params: { mode: 'terrain' },
  variants: [
    { id: 'phase', name: '相位儀', theme: 'neon', desc: '左右聲道的光點雲與相關係數表', params: { mode: 'phase' } },
    { id: 'piano', name: '琴鍵頻譜', theme: 'ocean', desc: '左側琴鍵當音高軸，音符由右往左流過', params: { mode: 'piano' } },
    { id: 'ridge', name: '層疊', theme: 'sunset', hue: false, desc: '一層層往後退的頻譜山脊線', params: { mode: 'ridge' } },
    { id: 'vu', name: '指針表', theme: 'amber', desc: '兩顆類比音量表的指針左右擺動', params: { mode: 'vu' } },
    { id: 'curve', name: '分析曲線', theme: 'ice', hue: false, desc: '對數頻率軸上的平滑頻譜曲線', params: { mode: 'curve' } },
    { id: 'polar', name: '花瓣', theme: 'rainbow', desc: '八重對稱、隨節拍綻放的頻譜花', params: { mode: 'polar' } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f;
    specInit(s, 128);
    s.b = bnew(cols, rows);
    if (p.mode === 'terrain') { s.TK = clamp(Math.floor(rows * 0.55), 16, 48); s.tq = []; s.tacc = 0; s.ybuf = new Float32Array(cols); }
    if (p.mode === 'phase') { s.o = phosNew(cols, rows); s.corr = 0; s.pkL = 0; s.pkR = 0; }
    if (p.mode === 'piano') {
      const NR = rows - 2, spr = Math.max(1, Math.ceil(66 / NR)), m0 = Math.max(24, 60 - Math.floor((NR * spr) / 2));
      const HW = Math.max(1, cols - 10);
      s.pn = { bt: 0, step: 0, notes: [], NR, spr, m0, HW, H: new Float32Array(NR * HW), head: 0, acc: 0 };
      // 先跑出一整面歷史，一開始畫面就是滿的
      for (let k = 0; k < HW; k++) { const tt = -HW / 24 + k / 24; specStep(s, tt, 1 / 24); this.pianoTick(s, 1 / 24); }
    }
    if (p.mode === 'fountain') { const nb = Math.max(24, Math.floor(cols / 3)), cap = 7000; s.fp = { nb, cap, n: 0, x: new Float32Array(cap), y: new Float32Array(cap), vx: new Float32Array(cap), vy: new Float32Array(cap), k: new Uint16Array(cap), acc: new Float32Array(nb) }; }
    if (p.mode === 'polar') {
      const n = cols * rows; s.ang = new Float32Array(n); s.rad = new Float32Array(n);
      const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const dx = x - cx, dy = (y - cy) * aspect, i = y * cols + x; s.rad[i] = Math.hypot(dx, dy); s.ang[i] = (Math.atan2(dx, -dy) / TAU + 1) % 1; }
      s.Rm = Math.min(cols / 2, (rows * aspect) / 2);
    }
    if (p.mode === 'ridge') { s.K = clamp(Math.floor(rows / 2.6), 9, 34); s.snaps = []; s.acc = 0; s.hz = new Float32Array(cols * 2); }
    if (p.mode === 'vu') { s.nd = [0, 0]; s.pkL = [0, 0]; }
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, p } = f;
    specStep(s, t, dt);
    this[p.mode](s, f);
  },
  // 立體頻譜地形：最新的頻譜在最前面，舊的一排排往遠方退，近的擋住遠的
  terrain(s, f) {
    const { g, cols, rows, dt, t } = f, ch = g.ch, co = g.co, A = f.aspect;
    s.tacc += dt * 12;
    while (s.tacc >= 1) { s.tacc--; const a = s.tq.length >= s.TK ? s.tq.pop() : new Float32Array(s.nb); a.set(s.v); s.tq.unshift(a); }
    const ybuf = s.ybuf; ybuf.fill(rows);
    const hor = 1 + Math.round(rows * 0.05), Hc = 1, AMP = 0.85, dzN = 1, dzs = 5 / s.TK, F = (rows - 1 - hor) * dzN / Hc;
    const Wd = (cols * 1.04 * dzN) / (F * A), fr = s.tacc, ND = clamp(Math.floor(cols / 9), 8, 32); // 縱向格線數：小畫面少一點
    for (let j = 0; j < s.tq.length; j++) {
      const a = s.tq[j], dz = dzN + (j + fr) * dzs, sc = F / dz, half = Wd * F * A / dz / 2, cx = cols / 2, fade = 1 - (j + fr) / (s.TK + 2);
      const xa = Math.max(0, Math.ceil(cx - half)), xb = Math.min(cols - 1, Math.floor(cx + half));
      for (let x = xa; x <= xb; x++) {
        const u = (x - cx) / (2 * half) + 0.5, h = specAt(s, u * 0.94, a), sy = hor + (Hc - h * AMP) * sc;
        if (sy >= ybuf[x]) continue;
        const top = Math.max(0, Math.floor(sy)), hue = 265 + 120 * Math.min(1, h * 1.4), lt = (0.14 + 0.5 * h) * fade;
        const cTop = f.H(hue, Math.min(0.9, lt + 0.25 * fade)), cBody = f.H(hue, lt * 0.7), edgeX = half * 2 / ND >= 3 && (Math.floor(u * ND) !== Math.floor((u + 1 / (2 * half)) * ND));
        for (let y = top; y < ybuf[x] && y < rows; y++) { const i = y * cols + x; if (y === top) { ch[i] = sy - top < 0.5 ? '▀' : '▄'; co[i] = cTop; } else { ch[i] = edgeX ? '▏' : '█'; co[i] = edgeX ? cTop : cBody; } }
        ybuf[x] = top;
      }
    }
    put(g, 1, 0, '3D SPECTRUM · 128 bands · ' + s.TK + ' frames of history', f.C(0.5));
  },
  // 相位儀：中聲道朝上、側聲道左右，光點雲的形狀代表立體聲寬度
  phase(s, f) {
    const { g, cols, rows, dt, t } = f, o = s.o, A = f.aspect, W = o.W, Hh = o.Hh;
    phosDecay(o, Math.exp(-dt * 7));
    const cx = W / 2, cy = (rows - 4) * 2 + 2, R = Math.min(cols / 2 - 10, ((rows - 5) * A) / 2) * 0.92, kx = R * 2 * 0.7, ky = (R / A) * 4 * 0.7;
    // 合成左右聲道：低音在中央、和弦左右相位慢慢漂移、鈸是去相關的雜訊
    const N = 1000, sr = 40000, pan = 0.5 + 0.42 * Math.sin(t * 0.23), kick = s.kick, ph1 = t * 0.31, ph2 = Math.sin(t * 0.17) * 2.2, wide = 0.5 + 0.5 * Math.sin(t * 0.11);
    let sLL = 0, sRR = 0, sLR = 0, pkL = 0, pkR = 0;
    for (let k = 0; k < N; k++) {
      const tau = t + k / sr;
      const bass = (0.25 + 0.5 * kick) * Math.sin(TAU * 55 * tau);
      const c1 = 0.22 * Math.sin(TAU * 220 * tau), c1r = 0.22 * Math.sin(TAU * 220 * tau + ph1 * wide);
      const c2 = 0.18 * Math.sin(TAU * 277.2 * tau + 0.4), c2r = 0.18 * Math.sin(TAU * 277.2 * tau + 0.4 + ph2 * wide);
      const lead = 0.16 * Math.sin(TAU * 659 * tau) * (0.5 + 0.5 * Math.sin(t * 1.3));
      const n1 = (hash2(k, Math.floor(t * 30)) / 4294967296 - 0.5) * 0.5 * s.hat, n2 = (hash2(k + 7777, Math.floor(t * 30)) / 4294967296 - 0.5) * 0.5 * s.hat;
      const L = bass + c1 + c2 + lead * 1.6 * pan + n1 * 0.7, Rr = bass + c1r + c2r + lead * 1.6 * (1 - pan) + n2 * 0.7;
      sLL += L * L; sRR += Rr * Rr; sLR += L * Rr; pkL = Math.max(pkL, Math.abs(L)); pkR = Math.max(pkR, Math.abs(Rr));
      const M = (L + Rr) * 0.5, S = (L - Rr) * 0.5;
      phosDot(o, cx + S * kx * 2.1, cy - M * ky * 2.1, 0.55 + 0.45 * Math.min(1, Math.abs(M) + Math.abs(S)), 0);
    }
    const corr = sLR / Math.sqrt(sLL * sRR || 1);
    s.corr += (corr - s.corr) * Math.min(1, dt * 4);
    s.pkL = Math.max(pkL, s.pkL - dt * 0.6); s.pkR = Math.max(pkR, s.pkR - dt * 0.6);
    // 刻度：菱形外框與 L / R / M / S 軸
    const g2 = s.b; bclr(g2);
    const Rx = R * 2, Ry = (R / A) * 4;
    for (let q = 0; q < 1; q += 1 / (R * 6)) { const a = q * TAU; if (Math.floor(q * 72) % 2 === 0) bdot(g2, cx + Math.cos(a) * Rx, cy + Math.sin(a) * Ry, 0.3, 0); }
    for (let q = -1; q <= 1; q += 1 / (R * 3)) {
      bdot(g2, cx + q * Rx, cy, 0.25, 0); bdot(g2, cx, cy + q * Ry, 0.25, 0);
      if (Math.floor(q * R * 2) % 3 === 0) { bdot(g2, cx + q * Rx * 0.707, cy + q * Ry * 0.707, 0.2, 0); bdot(g2, cx + q * Rx * 0.707, cy - q * Ry * 0.707, 0.2, 0); }
    }
    bflush(g, g2, () => f.C(0.2));
    phosFlush(g, o, 0.06, v => f.H(170 + 150 * Math.min(1, v), 0.2 + 0.65 * Math.min(1, v)));
    const ccx = Math.round(cx / 2), ccy = Math.round(cy / 4), rc = Math.round(R), rr = Math.round(R / A);
    put(g, ccx, ccy - rr - 1, 'M', f.C(0.85)); put(g, ccx - rc - 3, ccy, '+S', f.C(0.6)); put(g, ccx + rc + 2, ccy, '−S', f.C(0.6));
    put(g, Math.round(ccx - rc * 0.74) - 1, Math.round(ccy - rr * 0.74) - 1, 'L', f.C(0.85)); put(g, Math.round(ccx + rc * 0.74) + 1, Math.round(ccy - rr * 0.74) - 1, 'R', f.C(0.85));
    // 兩側：左右聲道峰值表
    const mh = rows - 6;
    for (const [x0, pk, lab] of [[2, s.pkL, 'L'], [cols - 4, s.pkR, 'R']]) {
      const v = clamp(pk / 1.3, 0, 1) * mh, full = Math.floor(v), part = Math.floor((v - full) * 8);
      for (let j = 0; j < mh; j++) { const y = 1 + mh - 1 - j, z = j / mh, col = z > 0.85 ? f.H(0, 0.6) : z > 0.7 ? f.H(45, 0.6) : f.H(170, 0.5); if (j < full) { g.set(x0, y, '█', col); g.set(x0 + 1, y, '█', col); } else if (j === full && part) { g.set(x0, y, VEIGHT[part], col); g.set(x0 + 1, y, VEIGHT[part], col); } else g.set(x0, y, '·', f.C(0.12)); }
      put(g, x0, rows - 4, lab, f.C(0.7));
    }
    // 下方：相關表（−1 … +1）
    const by = rows - 2, bw = Math.min(cols - 20, 90), bx = Math.floor((cols - bw) / 2);
    for (let k = 0; k < bw; k++) { const u = (k / (bw - 1)) * 2 - 1; g.set(bx + k, by, k === Math.floor(bw / 2) ? '┼' : Math.abs(u * 4 - Math.round(u * 4)) < 2 / bw ? '┴' : '─', f.C(0.3)); }
    const nx = bx + Math.round(((s.corr + 1) / 2) * (bw - 1));
    for (let k = -1; k <= 1; k++) g.set(nx + k, by, '█', s.corr < 0 ? f.H(0, 0.65) : f.H(150, 0.65));
    put(g, bx - 3, by, '−1', f.C(0.55)); put(g, bx + bw + 1, by, '+1', f.C(0.55));
    put(g, Math.floor(cols / 2) - 7, by + 1, 'CORR ' + (s.corr >= 0 ? '+' : '') + s.corr.toFixed(2), f.C(0.85));
    put(g, 1, 0, 'GONIOMETER · M/S · width ' + Math.round(wide * 100) + '%', f.C(0.55));
  },
  // 鋼琴捲軸頻譜：左邊是直立的琴鍵，音符由右往左流過
  pianoTick(s, dt) {
    const P = s.pn;
    P.bt += dt;
    while (P.bt >= 0.25) {
      P.bt -= 0.25; P.step++;
      const chd = PN_CH[Math.floor(P.step / 16) % PN_CH.length], root = 48 + PN_KEY[Math.floor(P.step / 64) % PN_KEY.length];
      if (P.step % 4 === 0) P.notes.push({ m: root - 12 + chd[0], age: 0, a: 1 });
      if (P.step % 8 === 0) for (const c of chd) P.notes.push({ m: root + c, age: 0, a: 0.55 });
      if (Math.random() < 0.8) P.notes.push({ m: root + 12 + chd[rint(0, 2)] + (Math.random() < 0.3 ? 12 : 0), age: 0, a: 0.85 });
    }
    for (let k = P.notes.length - 1; k >= 0; k--) { P.notes[k].age += dt; if (P.notes[k].age > 1.6) kill(P.notes, k); }
    P.acc += dt * 24;
    while (P.acc >= 1) {
      // 寫入新的一欄（每列對應 spr 個半音）
      P.acc--; P.head = (P.head + 1) % P.HW;
      for (let r = 0; r < P.NR; r++) {
        const ma = P.m0 + r * P.spr, mb = ma + P.spr, bgv = specAt(s, clamp((ma + P.spr / 2 - 36) / 80, 0, 1));
        let v = 0.34 * bgv * bgv;
        for (const n of P.notes) for (let hk = 0; hk < 4; hk++) { const mh = n.m + PN_HO[hk]; if (mh >= ma - 0.3 && mh < mb - 0.3) v = Math.max(v, n.a * PN_HA[hk] * Math.exp(-n.age * 2.2)); }
        P.H[r * P.HW + P.head] = clamp(v + 0.03 * Math.random(), 0, 1);
      }
    }
  },
  // 鋼琴捲軸頻譜：左邊是直立的琴鍵，音符由右往左流過
  piano(s, f) {
    const { g, cols, rows, dt, t } = f, ch = g.ch, co = g.co, P = s.pn;
    this.pianoTick(s, dt);
    const NR = P.NR, spr = P.spr, m0 = P.m0, x0 = 10, HW = P.HW;
    // 畫頻譜圖（最新在右）
    for (let r = 0; r < NR; r++) {
      const y = rows - 2 - r; if (y < 1) break;
      for (let k = 0; k < HW; k++) {
        const v = P.H[r * HW + ((P.head + 1 + k) % HW)]; if (v < 0.1) continue;
        const i = y * cols + x0 + k;
        ch[i] = v > 0.8 ? '█' : v > 0.55 ? '▓' : v > 0.32 ? '▒' : '░'; co[i] = f.H(240 - 230 * v, 0.14 + 0.62 * v);
      }
    }
    // 直立琴鍵，正在響的音會亮
    const on = new Set(); for (const n of P.notes) if (n.age < 0.5) on.add(n.m);
    for (let r = 0; r < NR; r++) {
      const y = rows - 2 - r; if (y < 1) break;
      const ma = m0 + r * spr, mc = ma + Math.floor(spr / 2), blk = PN_BLACK[mc % 12];
      let lit = false; for (let q = ma; q < ma + spr; q++) if (on.has(q)) lit = true;
      for (let x = 4; x < 9; x++) {
        const isB = blk && x < 7;
        g.set(x, y, '█', lit ? f.H(45, 0.7) : isB ? f.C(0.12) : f.C(0.78));
      }
      g.set(9, y, '▕', f.C(0.3));
      for (let q = ma; q < ma + spr; q++) if (q % 12 === 0) put(g, 0, y, 'C' + (Math.floor(q / 12) - 1), f.C(0.75));
    }
    // 上方：目前最響的音
    let best = null; for (const n of P.notes) if (!best || n.a * Math.exp(-n.age * 2.2) > best.a * Math.exp(-best.age * 2.2)) best = n;
    put(g, 1, 0, 'PIANO-ROLL SPECTROGRAM · ' + PN_NM[m0 % 12] + (Math.floor(m0 / 12) - 1) + '–' + PN_NM[(m0 + NR * spr) % 12] + (Math.floor((m0 + NR * spr) / 12) - 1), f.C(0.55));
    if (best) { const nm = '▶ ' + PN_NM[best.m % 12] + (Math.floor(best.m / 12) - 1) + '  ' + (440 * Math.pow(2, (best.m - 69) / 12)).toFixed(1) + ' Hz'; put(g, cols - nm.length - 2, 0, nm, f.H(45, 0.75)); }
    const sec = HW / 24;
    fillR(g, 0, rows - 1, cols, 1, ' ', f.C(0.3));
    for (let k = 0; k <= 4; k++) { const lab = k === 4 ? 'now' : '-' + (sec * (1 - k / 4)).toFixed(0) + 's'; put(g, Math.min(cols - lab.length - 1, x0 + Math.round((k / 4) * (HW - 1)) - (k === 4 ? lab.length - 1 : 0)), rows - 1, lab, f.C(0.5)); }
  },
  // 粒子噴泉：每個頻段把光點往上拋，受重力落回地面
  fountain(s, f) {
    const { g, cols, rows, dt, t } = f, b = s.b, W = cols * 2, Hh = rows * 4, FP = s.fp;
    const nb = FP.nb, floorY = (rows - 2) * 4, G = 1.25 * Hh;
    for (let k = 0; k < nb; k++) {
      const u = (k + 0.5) / nb, v = specAt(s, u * 0.92);
      FP.acc[k] += dt * v * v * 130;
      while (FP.acc[k] >= 1 && FP.n < FP.cap) {
        FP.acc[k]--;
        const i = FP.n++, hgt = floorY * (0.2 + 0.8 * Math.sqrt(v)) * rnd(0.7, 1.04);
        FP.x[i] = (u + rnd(-0.4, 0.4) / nb) * W; FP.y[i] = floorY; FP.vx[i] = rnd(-1, 1) * W * 0.012; FP.vy[i] = -Math.sqrt(2 * G * hgt); FP.k[i] = k;
      }
      if (FP.acc[k] > 1) FP.acc[k] = 1;
    }
    bclr(b);
    for (let i = FP.n - 1; i >= 0; i--) {
      FP.vy[i] += G * dt;
      FP.x[i] += FP.vx[i] * dt; FP.y[i] += FP.vy[i] * dt;
      const px = FP.x[i] - FP.vx[i] * 0.025, py = FP.y[i] - FP.vy[i] * 0.025;
      if (FP.y[i] > floorY || FP.x[i] < 0 || FP.x[i] >= W) { const j = --FP.n; FP.x[i] = FP.x[j]; FP.y[i] = FP.y[j]; FP.vx[i] = FP.vx[j]; FP.vy[i] = FP.vy[j]; FP.k[i] = FP.k[j]; continue; }
      const sp = Math.min(1, Math.abs(FP.vy[i]) / (G * 0.9));
      bline(b, px, py, FP.x[i], FP.y[i], 0.35 + 0.65 * (1 - sp), Math.floor((FP.k[i] / nb) * 250));
    }
    bflush(g, b, (v, tg) => f.H(280 - (tg / 250) * 260, 0.25 + 0.6 * v));
    // 地面上的發射座：各頻段的即時電平
    const bw = cols / nb;
    for (let k = 0; k < nb; k++) {
      const u = (k + 0.5) / nb, v = specAt(s, u * 0.92), xa = Math.floor(k * bw), xb = Math.floor((k + 1) * bw) - 1, c = f.H(280 - u * 260, 0.3 + 0.4 * v);
      for (let x = xa; x <= xb; x++) { g.set(x, rows - 2, VEIGHT[1 + Math.round(v * 7)], c); g.set(x, rows - 1, x === xb && bw >= 3 ? ' ' : '▀', f.C(0.2)); }
    }
  },
  ridge(s, f) {
    const { g, cols, rows, dt, t } = f, b = s.b, W = cols * 2, Hh = rows * 4, K = s.K;
    s.acc += dt * 9;
    while (s.acc >= 1) {
      s.acc -= 1;
      const a = s.snaps.length >= K ? s.snaps.pop() : new Float32Array(W);
      for (let x = 0; x < W; x++) { const u = x / W, m = 0.25 + 0.75 * Math.exp(-(((u - 0.5) / 0.33) ** 2)); a[x] = specAt(s, Math.abs(u * 2 - 1) * 0.85) * m; }
      s.snaps.unshift(a);
    }
    bclr(b);
    const hz = s.hz; hz.fill(Hh);
    const dy = (Hh * 0.6) / K, A = Hh * 0.3;
    for (let j = 0; j < s.snaps.length; j++) {
      const a = s.snaps[j], yb = Hh - 3 - j * dy, sh = 0, fade = 1 - j / K;
      let py = null;
      for (let x = 0; x < W; x++) {
        const xs = Math.floor(x + sh); if (xs >= W) break;
        const y = yb - a[x] * A * (0.6 + 0.4 * fade);
        if (y < hz[xs]) { if (py !== null) bline(b, xs - 1, py, xs, y, fade, 0); else bdot(b, xs, y, fade, 0); py = y; hz[xs] = y; }
        else py = null;
      }
    }
    bflush(g, b, v => f.C(0.2 + 0.8 * v));
  },
  vu(s, f) {
    const { g, cols, rows, dt, t } = f, b = s.b;
    bclr(b);
    let e = 0; for (let i = 0; i < 64; i++) e += s.v[i]; e /= 64;
    const tg = [clamp(e * 1.35 + 0.08 * Math.sin(t * 5.1), 0, 1.1), clamp(e * 1.3 + 0.1 * Math.sin(t * 4.3 + 1), 0, 1.1)];
    const mh = Math.floor(rows * 0.7), mw = Math.floor((cols - 6) / 2);
    const DB = [[-20, 0], [-10, 0.25], [-7, 0.38], [-5, 0.48], [-3, 0.6], [-2, 0.67], [-1, 0.74], [0, 0.8], [1, 0.87], [2, 0.93], [3, 1]], txt = [];
    for (let m = 0; m < 2; m++) {
      s.nd[m] += (tg[m] - s.nd[m]) * Math.min(1, dt * 7);
      const x0 = 2 + m * (mw + 2), y0 = 1;
      box(g, x0, y0, mw, mh, f.C(0.4), null, null, 1);
      // 錶面淡淡的底紋
      for (let y = y0 + 1; y < y0 + mh - 1; y++) for (let x = x0 + 1; x < x0 + mw - 1; x++) if ((x * 3 + y * 7) % 11 === 0) g.set(x, y, '·', f.C(0.1));
      // 轉軸在方框最下面一列，弧頂剛好碰到方框上緣下兩列
      const px = (x0 + mw / 2) * 2, py = (y0 + mh - 2) * 4, Ls = Math.min(((mh - 4) * 4) / 0.95, (mw - 4) / 0.72);
      const ang = v => (-48 + 96 * clamp(v, 0, 1.05)) * Math.PI / 180;
      // 刻度弧
      for (let k = 0; k <= 400; k++) {
        const v = k / 400, a = ang(v), red = v > 0.8;
        bdot(b, px + Math.sin(a) * Ls * 0.82, py - Math.cos(a) * Ls * 0.82, red ? 0.6 : 0.4, red ? 1 : 0);
        if (red) bdot(b, px + Math.sin(a) * Ls * 0.8, py - Math.cos(a) * Ls * 0.8, 0.6, 1);
      }
      for (const [db, v] of DB) {
        const a = ang(v);
        bline(b, px + Math.sin(a) * Ls * 0.82, py - Math.cos(a) * Ls * 0.82, px + Math.sin(a) * Ls * 0.88, py - Math.cos(a) * Ls * 0.88, 0.7, v > 0.8 ? 1 : 0);
        const lx = (px + Math.sin(a) * Ls * 0.95) / 2, ly = (py - Math.cos(a) * Ls * 0.95) / 4, lab = (db > 0 ? '+' : '') + db;
        txt.push([clamp(Math.round(lx - lab.length / 2), x0 + 1, x0 + mw - 2 - lab.length), Math.floor(ly), lab, v > 0.8 ? f.H(0, 0.6) : f.C(0.75)]);
      }
      // 指針
      const a = ang(s.nd[m]);
      bline(b, px + Math.sin(a) * Ls * 0.25, py - Math.cos(a) * Ls * 0.25, px + Math.sin(a) * Ls * 0.92, py - Math.cos(a) * Ls * 0.92, 1, 2);
      put(g, x0 + Math.floor(mw / 2) - 1, y0 + mh - 3, 'VU', f.C(0.8));
      put(g, x0 + 2, y0 + mh - 2, m ? 'R' : 'L', f.C(0.6));
      if (s.nd[m] > 0.87) s.pkL[m] = 0.4; else s.pkL[m] -= dt;
      put(g, x0 + mw - 9, y0 + mh - 2, 'PEAK', f.C(0.5)); g.set(x0 + mw - 4, y0 + mh - 2, '●', s.pkL[m] > 0 ? f.H(0, 0.65) : f.C(0.15));
    }
    bflush(g, b, (v, tg2) => (tg2 === 1 ? f.H(0, 0.55) : tg2 === 2 ? f.C(1) : f.C(0.35 + 0.5 * v)));
    for (const q of txt) put(g, q[0], q[1], q[2], q[3]);
    // 下方：雙聲道分段條
    const by = mh + 2, bwid = cols - 12;
    for (let m = 0; m < 2; m++) {
      const y = by + m * 2; if (y >= rows - 1) break;
      put(g, 2, y, m ? 'R' : 'L', f.C(0.7));
      const lv = clamp(s.nd[m], 0, 1.05) / 1.05, segs = Math.floor(bwid / 2);
      for (let k = 0; k < segs; k++) { const on = k / segs < lv, z = k / segs; g.set(5 + k * 2, y, on ? '▮' : '▯', on ? (z > 0.8 ? f.H(0, 0.6) : z > 0.65 ? f.H(45, 0.6) : f.H(110, 0.5)) : f.C(0.15)); }
    }
    if (by + 4 < rows) { const sc = ['-40', '-30', '-20', '-10', '-6', '-3', '0', '+3']; sc.forEach((l, k) => put(g, 5 + Math.floor((k / (sc.length - 1)) * (bwid - 4)), by + 4, l, f.C(0.45))); }
  },
  curve(s, f) {
    const { g, cols, rows, t } = f, b = s.b, W = cols * 2, Hh = rows * 4;
    bclr(b);
    const x0 = 6, y0 = 1, gw = cols - x0 - 2, gh = rows - 4;
    const FR = [[20, '20'], [50, '50'], [100, '100'], [200, '200'], [500, '500'], [1000, '1k'], [2000, '2k'], [5000, '5k'], [10000, '10k'], [20000, '20k']];
    const lx = fr => x0 + (Math.log10(fr / 20) / 3) * gw;
    for (const [fr, l] of FR) { const x = Math.round(lx(fr)); for (let y = y0; y < y0 + gh; y++) g.set(x, y, '┊', f.C(0.16)); put(g, x - Math.floor(l.length / 2), y0 + gh, l, f.C(0.5)); }
    for (let k = 0; k <= 6; k++) { const y = y0 + Math.round((k / 6) * (gh - 1)); for (let x = x0; x < x0 + gw; x += 2) if (g.ch[y * cols + x] === ' ') g.set(x, y, '·', f.C(0.16)); put(g, 0, y, pad(-k * 12, 4), f.C(0.45)); }
    put(g, 0, y0 + gh, '  dB', f.C(0.45));
    let py = null, pp = null;
    const bx0 = x0 * 2, bw = gw * 2, by0 = y0 * 4, bh = gh * 4;
    for (let x = 0; x < bw; x++) {
      const u = x / bw, v = specAt(s, u), pk = specAt(s, u, s.pk);
      const y = by0 + bh - 1 - Math.pow(v, 0.6) * (bh - 2), yp = by0 + bh - 1 - Math.pow(pk, 0.6) * (bh - 2);
      if (py !== null) bline(b, bx0 + x - 1, py, bx0 + x, y, 1, 0);
      if (x % 2 === 0) for (let yy = Math.ceil(y) + 2; yy < by0 + bh; yy++) if ((yy & 3) === ((x >> 1) & 1) * 2) bdot(b, bx0 + x, yy, 0.3, 1);
      if (x % 3 === 0) bdot(b, bx0 + x, yp, 0.6, 2);
      py = y; pp = yp;
    }
    bflush(g, b, (v, tg) => f.C(tg === 1 ? 0.3 : tg === 2 ? 0.55 : 0.95));
    put(g, x0 + 1, 0, 'RTA  1/24 oct  ·  peak hold  ·  slope 4.5 dB', f.C(0.6));
  },
  polar(s, f) {
    const { g, cols, rows, t } = f, ch = g.ch, co = g.co, n = cols * rows;
    const R0 = s.Rm * (0.1 + 0.05 * s.kick), Rmax = s.Rm * 0.85, rot = t * 0.05;
    for (let i = 0; i < n; i++) {
      const r = s.rad[i];
      if (r > R0 + Rmax) continue;
      const a8 = fract((s.ang[i] + rot) * 8), u = Math.abs(a8 * 2 - 1), v = specAt(s, u * 0.75), R = R0 + Math.pow(v, 0.6) * Rmax;
      if (r > R) continue;
      const q = r / R;
      ch[i] = RAMPS[Math.min(9, 1 + Math.floor(q * 9))];
      co[i] = f.H(fract(s.ang[i] + rot * 0.5) * 360 + q * 80, 0.18 + 0.55 * q);
    }
  },
});

/* ═════════ 6. 系統監視 ═════════ */
// 火焰圖用的假函式名稱
const FL_TOP = ['app_main', 'worker_pool', 'net_loop', 'gc_thread', 'render', 'kworker', 'cpu_idle', 'db_writer'];
const FL_L2 = ['run_loop', 'dispatch', 'poll_events', 'mark_sweep', 'draw_frame', 'handle_irq', 'do_idle', 'flush_wal', 'task_run'];
const FL_FN = ['handle_request', 'parse_json', 'json_decode', 'hash_update', 'sha256_block', 'memcpy', 'malloc', 'free_list', 'btree_find', 'query_exec', 'sort_rows', 'deflate', 'tls_write', 'aes_encrypt', 'sys_read', 'sys_write', 'vfs_read', 'tcp_sendmsg', 'ip_output', 'layout_text', 'shape_glyphs', 'raster_tile', 'blend_span', 'decode_png', 'inflate', 'mutex_lock', 'futex_wait', 'schedule', 'page_fault', 'copy_user', 'regex_match', 'utf8_decode', 'log_format', 'vsnprintf', 'cache_get', 'map_lookup', 'alloc_slab', 'walk_tree', 'eval_node', 'resolve_deps'];
const FL_REC = ['btree_find', 'walk_tree', 'eval_node', 'resolve_deps'];
const FL_KERN = /^(sys_|vfs_|tcp_|ip_|schedule|page_fault|copy_user|futex|handle_irq|kworker|do_idle|cpu_idle|alloc_slab)/;
const SVCS = ['api-gw', 'auth', 'search', 'orders', 'payments', 'cdn-edge', 'queue', 'db-main', 'db-replica', 'cache', 'ingest', 'thumbs', 'mailer', 'reports', 'ws-hub', 'billing', 'geo', 'feeds', 'media', 'notify', 'audit', 'export', 'ml-infer', 'tiles'];
A({ id: 'te-sysmon', name: '系統監視', cat: '科技', theme: 'sunset', hue: true, desc: '即時取樣的火焰圖與各核心熱度條',
  params: { mode: 'flame' },
  variants: [
    { id: 'graphs', name: '四宮格圖', theme: 'ice', desc: 'CPU、記憶體、網路、磁碟四張面積圖', params: { mode: 'graphs' } },
    { id: 'cores', name: '多核心', theme: 'mint', desc: '上百顆核心的負載方塊牆', params: { mode: 'cores' } },
    { id: 'gauge', name: '儀表板', theme: 'gold', desc: '一排圓弧儀表的指針與讀數', params: { mode: 'gauge' } },
    { id: 'rack', name: '機房機櫃', theme: 'cyber', desc: '一排機櫃的伺服器燈號閃爍', params: { mode: 'rack' } },
    { id: 'wall', name: '監控牆', theme: 'blueprint', desc: '一整面服務小卡與迷你走勢', params: { mode: 'wall' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.N = p.mode === 'cores' ? (cols >= 200 ? 128 : 32) : cols >= 200 ? 64 : 16;
    s.load = new Float32Array(s.N); s.seed = rnd(0, 100);
    s.HN = 600; s.hist = {}; for (const k of ['cpu', 'mem', 'rx', 'tx', 'rd', 'wr']) s.hist[k] = new Float32Array(s.HN);
    s.hh = 0; s.acc = 0; s.T = rnd(0, 1000);
    for (let k = 0; k < s.HN; k++) this.tick(s, 0.1);
    s.b = bnew(cols, rows);
    if (p.mode === 'rack') this.rackInit(s, f);
    if (p.mode === 'flame') this.flameInit(s, f);
    if (p.mode === 'wall') { s.tiles = SVCS.map((n, k) => ({ name: n, h: new Float32Array(48), base: rnd(20, 80), alert: 0 })); s.tacc = 0; for (const tl of s.tiles) for (let k = 0; k < 48; k++) tl.h[k] = tl.base * (0.7 + 0.6 * Math.random()); }
  },
  tick(s, dt) {
    s.T += dt;
    const T = s.T;
    let sum = 0;
    for (let k = 0; k < s.N; k++) { const v = clamp(0.35 + 0.55 * Noise.n3(k * 1.37 + s.seed, T * 0.35) + (Noise.n3(k * 0.2, T * 0.08 + 7) > 0.35 ? 0.4 : 0), 0.01, 1); s.load[k] += (v - s.load[k]) * Math.min(1, dt * 4); sum += s.load[k]; }
    s.hh = (s.hh + 1) % s.HN;
    const H = s.hist, i = s.hh;
    H.cpu[i] = sum / s.N;
    H.mem[i] = clamp(0.55 + 0.2 * Noise.n3(T * 0.05, 3) + 0.05 * Math.sin(T * 0.3), 0, 1);
    H.rx[i] = clamp(0.3 + 0.35 * Noise.n3(T * 0.4, 11) + (Math.sin(T * 0.7) > 0.8 ? 0.35 : 0), 0, 1);
    H.tx[i] = clamp(0.2 + 0.25 * Noise.n3(T * 0.5, 17), 0, 1);
    H.rd[i] = clamp(0.15 + 0.4 * Math.max(0, Noise.n3(T * 0.6, 21)) + (fract(T / 13) < 0.1 ? 0.5 : 0), 0, 1);
    H.wr[i] = clamp(0.1 + 0.3 * Math.max(0, Noise.n3(T * 0.45, 29)), 0, 1);
  },
  frame(s, f) {
    const { dt, p } = f;
    s.acc += dt;
    while (s.acc >= 0.1) { s.acc -= 0.1; this.tick(s, 0.1); }
    this[p.mode](s, f);
  },
  lastH(s, k, back) { return s.hist[k][(s.hh - (back || 0) + s.HN * 2) % s.HN]; },
  // 火焰圖：每一層是一個呼叫堆疊框，寬度 = 取樣比例，隨取樣慢慢伸縮
  flameInit(s, f) {
    const { cols, rows } = f, big = cols >= 200;
    s.fh = clamp(Math.floor(rows / 26), 1, 3); s.stripH = big ? 2 : 1;
    s.fTop = 2 + s.stripH; s.fBot = rows - 2;
    s.maxD = Math.max(4, Math.floor((s.fBot - s.fTop) / s.fh));
    let n = 0;
    const mk = (name, d) => { const h = mix32(n * 7919 + name.length * 131 + d); n++; return { name, d, kids: [], base: rnd(0.25, 1), ph: rnd(0, 100), w: 0, fill: rnd(0.74, 0.96), hue: FL_KERN.test(name) ? 28 : (h % 6) * 10, lt: 0.34 + ((h >>> 8) % 5) * 0.035, x0: 0, cw: 0 }; };
    // minD：這條分支至少要長到的深度（讓幾座「火焰塔」夠高，畫面上方不會空著）
    const gen = (q, minD) => {
      if (q.d >= s.maxD - 1 || n > (big ? 640 : 240)) return;
      if (FL_REC.includes(q.name) && Math.random() < 0.86) { const c = mk(q.name, q.d + 1); c.fill = rnd(0.82, 0.97); q.kids.push(c); gen(c, minD); return; }
      const leaf = q.d < minD ? 0 : 0.08 + (q.d / s.maxD) * 0.5;
      if (Math.random() < leaf) return;
      const r = Math.random(), nk = q.d === 0 ? (big ? 6 : 4) : q.d === 1 ? rint(1, 2) : r < 0.62 ? 1 : r < 0.92 ? 2 : 3;
      for (let k = 0; k < nk; k++) {
        const c = mk(q.d === 0 ? FL_TOP[k % FL_TOP.length] : pick(q.d === 1 ? FL_L2 : FL_FN), q.d + 1);
        if (q.d === 0 && k === 0) c.base = 2.2; // 主程式佔最大塊
        if (nk === 1) c.fill = rnd(0.86, 0.98);
        else if (k === 0 && q.d > 0) c.base *= 2.4; // 主幹比旁支寬，塔才撐得高
        q.kids.push(c);
        gen(c, q.d === 0 ? Math.floor(s.maxD * (k === 0 ? 0.9 : rnd(0.35, 0.8))) : k === 0 ? minD : Math.min(minD, q.d + rint(1, 8)));
      }
    };
    s.root = mk('all', 0); s.root.fill = 1; gen(s.root, 2);
    s.samp = rint(200000, 900000); s.hov = null; s.hovT = 0; s.list = [];
  },
  flame(s, f) {
    const { g, cols, rows, dt, t } = f, N = s.N, ch = g.ch, co = g.co;
    if (!s.root) this.flameInit(s, f);
    s.samp += dt * 99 * N;
    // 權重：雜訊驅動、平滑跟隨
    const k = Math.min(1, dt * 2.5), list = s.list; list.length = 0;
    const upd = q => { const tg = q.base * (0.35 + 0.65 * (0.5 + 0.5 * Noise.n3(q.ph, t * 0.22))); q.w += (tg - q.w) * k; for (const c of q.kids) upd(c); };
    upd(s.root);
    // 排版並畫出每一層（根在最下面）
    const fh = s.fh, bot = s.fBot, path = s.hovPath;
    const lay = (q, x0, w) => {
      q.x0 = x0; q.cw = w;
      const xa = Math.round(x0), xb = Math.round(x0 + w) - (w >= 3 ? 1 : 0), y = bot - q.d * fh;
      if (xb <= xa || y - fh + 1 < s.fTop) return;
      list.push(q);
      const hot = q === s.hov || (path && path.has(q));
      const col = f.H(q.hue, Math.min(0.8, q.lt + (hot ? 0.2 : 0))), col2 = f.H(q.hue, q.lt * 0.62);
      for (let r = 0; r < fh; r++) {
        const yy = y - r, base = yy * cols, c = r === 0 && fh > 1 ? '▀' : '█', cc = r === 0 && fh > 2 ? col2 : col;
        for (let x = xa; x < xb; x++) { ch[base + x] = c; co[base + x] = cc; }
      }
      const ly = y - fh + 1, lw = xb - xa - 2;
      if (lw >= 3) { const lab = q.name.length <= lw ? q.name : q.name.slice(0, lw - 1) + '…'; put(g, xa + 1, ly, lab, hot ? f.C(1) : f.C(0.95)); }
      let tot = 0; for (const c of q.kids) tot += c.w;
      if (!tot) return;
      const sc = (w * q.fill) / tot;
      let x = x0;
      for (const c of q.kids) { const cw = c.w * sc; if (cw >= 0.8) lay(c, x, cw); x += cw; }
    };
    lay(s.root, 0, cols);
    // 游標：每隔一段時間停在一個夠寬的框上，整條呼叫路徑一起變亮
    s.hovT -= dt;
    if (s.hovT <= 0 || !s.hov || !list.includes(s.hov)) {
      const cand = list.filter(q => q.cw >= 8 && q.d >= 2);
      s.hov = cand.length ? pick(cand) : null; s.hovT = rnd(1.4, 2.6);
      s.hovPath = new Set();
      if (s.hov) { const walk = (q, pth) => { if (q === s.hov) { for (const p of pth) s.hovPath.add(p); return true; } for (const c of q.kids) if (walk(c, pth.concat([c]))) return true; return false; }; walk(s.root, [s.root]); }
    }
    // 上方：每顆核心的熱度條
    put(g, 1, 0, 'perf record -F 99 -a -g · flame graph · ' + N + ' CPUs · ' + Math.floor(s.samp).toLocaleString('en') + ' samples', f.C(0.7));
    const sx = 5, cw = Math.max(1, Math.floor((cols - sx - 1) / N));
    put(g, 1, 1, 'CPU', f.C(0.5));
    for (let c = 0; c < N; c++) {
      const v = s.load[c], col = f.H(120 - 120 * v, 0.25 + 0.45 * v);
      for (let r = 0; r < s.stripH; r++) for (let q = 0; q < cw - (cw > 2 ? 1 : 0); q++) g.set(sx + c * cw + q, 1 + r, r === s.stripH - 1 && s.stripH > 1 ? VEIGHT[1 + Math.round(v * 7)] : '█', col);
    }
    for (let x = 0; x < cols; x++) g.set(x, 1 + s.stripH, '┈', f.C(0.18));
    // 下方狀態列
    fillR(g, 0, rows - 1, cols, 1, ' ', f.C(0.3));
    if (s.hov) {
      const pc = (s.hov.cw / cols) * 100, tip = '▶ ' + s.hov.name + ' · ' + Math.round(s.samp * s.hov.cw / cols).toLocaleString('en') + ' samples (' + pc.toFixed(2) + '%) · depth ' + s.hov.d;
      put(g, 1, rows - 1, tip, f.C(0.9), cols - 1);
    } else put(g, 1, rows - 1, 'sampling …', f.C(0.6));
  },
  graphs(s, f) {
    const { g, cols, rows } = f, b = s.b;
    bclr(b);
    const pw = Math.floor(cols / 2), ph = Math.floor(rows / 2);
    const P = [['CPU', [['cpu', 0]], v => (v * 100).toFixed(0) + '%'], ['Memory', [['mem', 1]], v => (v * 64).toFixed(1) + ' GB'], ['Network', [['rx', 2], ['tx', 3]], v => (v * 940).toFixed(0) + ' Mb/s'], ['Disk I/O', [['rd', 4], ['wr', 5]], v => (v * 2100).toFixed(0) + ' MB/s']];
    const HU = [120, 200, 280, 40, 330, 170];
    P.forEach(([name, series, fmt], k) => {
      const x0 = (k % 2) * pw, y0 = Math.floor(k / 2) * ph, w = (k % 2 ? cols - pw : pw), h = (k < 2 ? ph : rows - ph);
      box(g, x0, y0, w, h, f.C(0.3), name, f.C(0.85), 1);
      const gx = (x0 + 1) * 2, gy = (y0 + 1) * 4, gw = (w - 2) * 2, gh = (h - 2) * 4;
      for (let q = 1; q < 4; q++) { const yy = y0 + Math.round((q / 4) * (h - 2)); for (let x = x0 + 1; x < x0 + w - 1; x += 3) g.set(x, yy, '·', f.C(0.15)); }
      series.forEach(([key, tag], si) => {
        const H = s.hist[key];
        let py = null;
        for (let x = 0; x < gw; x++) {
          const v = H[(s.hh - gw + 1 + x + s.HN * 4) % s.HN], y = gy + gh - 1 - v * (gh - 2);
          if (si === 0 && x % 2 === 0) for (let yy = Math.ceil(y) + 2; yy < gy + gh; yy++) if ((yy & 3) === ((x >> 1) & 1) * 2) bdot(b, gx + x, yy, 0.25, tag);
          if (py !== null) bline(b, gx + x - 1, py, gx + x, y, 1, tag);
          py = y;
        }
        const cur = s.hist[key][s.hh], lab = (series.length > 1 ? (si ? (key === 'tx' ? '↑ ' : 'W ') : (key === 'rx' ? '↓ ' : 'R ')) : '') + fmt(cur);
        put(g, x0 + w - lab.length - 3 - si * 16, y0, ' ' + lab + ' ', f.H(HU[tag], 0.65));
      });
    });
    bflush(g, b, (v, tg) => f.H(HU[tg], 0.2 + 0.5 * v));
  },
  cores(s, f) {
    const { g, cols, rows, t } = f, N = s.N;
    const gc = cols >= 200 ? 16 : 8, gr = Math.ceil(N / gc), tw = Math.floor((cols - 1) / gc), th = Math.floor((rows - 2) / gr);
    put(g, 1, 0, N + ' cores · avg ' + (this.lastH(s, 'cpu') * 100).toFixed(1) + '% · ' + (3.2 + this.lastH(s, 'cpu')).toFixed(2) + ' GHz', f.C(0.8));
    for (let k = 0; k < N; k++) {
      const v = s.load[k], x0 = 1 + (k % gc) * tw, y0 = 1 + Math.floor(k / gc) * th, hue = 120 - 120 * v;
      if (th >= 3 && tw >= 6) {
        box(g, x0, y0, tw - 1, th, f.H(hue, 0.3), null);
        put(g, x0 + 1, y0, 'C' + pad0(k, 3), f.C(0.6));
        const ih = th - 2, iw = tw - 3, hv = v * ih, full = Math.floor(hv), part = Math.floor((hv - full) * 8);
        for (let j = 0; j < ih; j++) for (let q = 0; q < iw; q++) {
          const y = y0 + th - 2 - j;
          if (j < full) g.set(x0 + 1 + q, y, '█', f.H(120 - 120 * (j / ih), 0.35 + 0.25 * v));
          else if (j === full && part) g.set(x0 + 1 + q, y, VEIGHT[part], f.H(120 - 120 * (j / ih), 0.45));
        }
        const pc = Math.round(v * 100) + '%';
        put(g, x0 + Math.floor((tw - 1 - pc.length) / 2), y0 + 1, pc, f.C(0.95));
      } else {
        put(g, x0, y0, pad(Math.round(v * 99), 2), f.H(hue, 0.6));
      }
    }
  },
  gauge(s, f) {
    const { g, cols, rows, t, aspect } = f, b = s.b;
    bclr(b);
    const G = [['CPU', '%', this.lastH(s, 'cpu'), 100], ['MEMORY', '%', this.lastH(s, 'mem'), 100], ['NET IN', 'Mb/s', this.lastH(s, 'rx'), 1000], ['DISK', 'MB/s', this.lastH(s, 'rd'), 2000], ['TEMP', '°C', 0.4 + 0.4 * this.lastH(s, 'cpu'), 100], ['FAN', 'RPM', 0.3 + 0.5 * this.lastH(s, 'cpu'), 4000]];
    const nx = cols >= 200 ? 3 : 3, ny = 2, cw = cols / nx, chh = rows / ny;
    const txt = []; // 文字最後才寫，避免被指針與圓弧的點字蓋掉
    G.forEach(([name, unit, v, mx], k) => {
      const cx = (k % nx + 0.5) * cw, cy = (Math.floor(k / nx) + 0.55) * chh;
      const R = Math.min(cw * 0.42, chh * aspect * 0.42);
      const bx = cx * 2, by = cy * 4, kx = 2, ky = 4 / aspect;
      const a0 = -135, a1 = 135, ang = q => (a0 + (a1 - a0) * q) * Math.PI / 180;
      const P = (a, r) => [bx + Math.sin(a) * r * kx, by - Math.cos(a) * r * ky];
      // 弧與刻度
      for (let q = 0; q <= 1; q += 1 / 360) { const [x, y] = P(ang(q), R * 0.92); bdot(b, x, y, q < v ? 1 : 0.3, q > 0.8 ? 1 : 0); }
      for (let q = 0; q <= 10; q++) {
        const a = ang(q / 10), [x1, y1] = P(a, R * 0.78), [x2, y2] = P(a, R * 0.88);
        bline(b, x1, y1, x2, y2, 0.7, q >= 8 ? 1 : 0);
        if (q % 2 === 0 && R > 8) { const [x3, y3] = P(a, R * 0.64), vv = Math.round(mx * q / 10), lab = vv >= 1000 ? (vv / 1000) + 'k' : String(vv); txt.push([Math.round(x3 / 2 - lab.length / 2), Math.floor(y3 / 4), lab, f.C(0.45)]); }
      }
      const a = ang(clamp(v, 0, 1)), [nx2, ny2] = P(a, R * 0.8);
      bline(b, bx, by, nx2, ny2, 1, 2);
      bdot(b, bx, by, 1, 2); bdot(b, bx + 1, by, 1, 2);
      const val = String(Math.round(v * mx));
      txt.push([Math.round(cx - val.length / 2), Math.floor(cy + R / aspect * 0.45), val, f.C(1)]);
      txt.push([Math.round(cx - unit.length / 2), Math.floor(cy + R / aspect * 0.45) + 1, unit, f.C(0.5)]);
      txt.push([Math.round(cx - name.length / 2), Math.min(rows - 1, Math.floor(cy + R / aspect * 0.95)), name, f.C(0.8)]);
    });
    bflush(g, b, (v, tg) => (tg === 2 ? f.C(1) : tg === 1 ? f.H(0, 0.3 + 0.35 * v) : f.C(0.2 + 0.65 * v)));
    for (const q of txt) put(g, q[0], q[1], q[2], q[3]);
  },
  rackInit(s, f) {
    const { cols, rows } = f;
    const rw = cols >= 200 ? 38 : 30, nr = Math.max(1, Math.floor((cols - 2) / (rw + 2)));
    s.racks = [];
    for (let r = 0; r < nr; r++) {
      const units = []; let y = 0; const H = rows - 4;
      while (y < H) {
        const tp = pick(['srv', 'srv', 'srv', 'sw', 'disk', 'blank', 'srv2']), h = tp === 'disk' ? 3 : tp === 'srv2' ? 2 : 1;
        if (y + h > H) break;
        // 閃爍頻率壓在 1–3 Hz（交換器埠 ×1.5），數百顆燈才不會變成一片閃光
        units.push({ tp, y, h, name: (tp === 'sw' ? 'sw-' : tp === 'disk' ? 'nas-' : 'node-') + pad0(rint(1, 99), 2), ph: rnd(0, 100), rate: rnd(1, 3), alert: Math.random() < 0.06 });
        y += h;
      }
      s.racks.push({ x: 1 + r * (rw + 2), w: rw, units });
    }
  },
  rack(s, f) {
    const { g, cols, rows, t } = f;
    for (const R of s.racks) {
      const x0 = R.x, w = R.w;
      box(g, x0, 1, w, rows - 2, f.C(0.35), 'RACK ' + String.fromCharCode(65 + s.racks.indexOf(R)), f.C(0.8), 2);
      for (const U of R.units) {
        const y = 2 + U.y, ix = x0 + 2, iw = w - 4;
        const blink = (k, rate) => hash2(Math.floor(t * (rate || U.rate) + U.ph), k) % 3 !== 0;
        if (U.tp === 'blank') { for (let q = 0; q < iw; q++) g.set(ix + q, y, '─', f.C(0.15)); continue; }
        if (U.tp === 'sw') {
          put(g, ix, y, U.name.padEnd(6), f.C(0.6));
          for (let q = 0; q < iw - 8; q++) g.set(ix + 7 + q, y, '▪', blink(q, U.rate * 1.5) ? f.H(q % 2 ? 120 : 45, 0.55) : f.C(0.15));
          continue;
        }
        if (U.tp === 'disk') {
          put(g, ix, y, U.name, f.C(0.6));
          for (let r = 0; r < U.h; r++) for (let q = 0; q < Math.floor((iw - 8) / 2); q++) { const on = blink(r * 50 + q, U.rate * 1.5); g.set(ix + 8 + q * 2, y + r, on ? '▮' : '▯', on ? f.H(200, 0.55) : f.C(0.25)); }
          g.set(ix + 6, y + 1, '●', f.H(120, 0.5));
          continue;
        }
        // 伺服器：電源燈、活動燈、通風孔、名稱
        const al = U.alert && Math.floor(t * 1.5) % 2 === 0;
        g.set(ix, y, '●', al ? f.H(0, 0.65) : f.H(120, 0.5));
        g.set(ix + 1, y, '●', blink(1) ? f.H(40, 0.62) : f.C(0.15));
        put(g, ix + 3, y, U.name, f.C(0.75));
        for (let q = ix + 11; q < ix + iw - 6; q++) for (let r = 0; r < U.h; r++) g.set(q, y + r, (q + r) % 2 ? '░' : '▒', f.C(0.14 + 0.04 * ((q + r) % 3)));
        const ld = Math.round(clamp(0.5 + 0.5 * Noise.n3(U.ph, t * 0.3), 0, 1) * 4);
        for (let q = 0; q < 4; q++) g.set(ix + iw - 5 + q, y, q < ld ? '▮' : '▯', q < ld ? f.H(190, 0.55) : f.C(0.2));
      }
    }
    put(g, 1, 0, 'DC-2 · ROW 07 · ' + s.racks.length + ' racks · PUE 1.31 · inlet ' + (22 + Math.sin(t * 0.2)).toFixed(1) + '°C', f.C(0.7));
  },
  thermal(s, f) {
    const { g, cols, rows, t, aspect } = f, ch = g.ch, co = g.co;
    const lw = cols >= 120 ? 12 : 6, W = cols - lw - 1, H = rows - 1;
    const nh = 6;
    if (!s.tex || s.tex.length !== W * H) { s.tex = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) s.tex[y * W + x] = Noise.n3(x * 0.09, y * 0.18, 3.3); s.ex = new Float32Array(nh * W); s.ey = new Float32Array(nh * H); s.amp = new Float32Array(nh); }
    // 可分離的高斯熱點：每個熱點先算好 x、y 兩個方向的權重
    for (let k = 0; k < nh; k++) {
      const hx0 = (0.5 + 0.4 * Noise.n3(k * 3.1, t * 0.12)) * W, hy0 = (0.5 + 0.4 * Noise.n3(k * 5.7, t * 0.12 + 9)) * H, rad = (6 + 4 * Math.sin(k)) * W / 100;
      s.amp[k] = 0.5 + 0.6 * Math.max(0, Noise.n3(k, t * 0.3 + 4));
      for (let x = 0; x < W; x++) { const d = (x - hx0) / rad; s.ex[k * W + x] = Math.exp(-d * d * 0.08); }
      for (let y = 0; y < H; y++) { const d = ((y - hy0) * aspect) / rad; s.ey[k * H + y] = Math.exp(-d * d * 0.08); }
    }
    const drift = Math.sin(t * 0.2) * 0.03;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let T = 0.12 + 0.06 * s.tex[y * W + x] + drift;
      for (let k = 0; k < nh; k++) T += s.amp[k] * s.ex[k * W + x] * s.ey[k * H + y];
      T = T < 0 ? 0 : T > 1 ? 1 : T;
      const i = (y + 1) * cols + x;
      ch[i] = '█'; co[i] = f.H(250 - 250 * T, 0.12 + 0.55 * T);
    }
    const hs = [[0, 0, Math.max(...s.amp)]];
    // 晶片分區框線
    const gx = 4, gy = 2;
    for (let a = 1; a < gx; a++) { const x = Math.floor((a * W) / gx); for (let y = 1; y <= H; y++) g.set(x, y, '│', f.C(0.4)); }
    for (let a = 1; a < gy; a++) { const y = 1 + Math.floor((a * H) / gy); for (let x = 0; x < W; x++) g.set(x, y, '─', f.C(0.4)); }
    for (let a = 0; a < gx * gy; a++) put(g, Math.floor(((a % gx) * W) / gx) + 1, 1 + Math.floor((Math.floor(a / gx) * H) / gy), 'CORE ' + a, f.C(0.9));
    // 色階
    const lx = cols - lw;
    for (let y = 1; y < rows; y++) { const T = 1 - (y - 1) / (rows - 2); for (let q = 0; q < 2; q++) g.set(lx + q, y, '█', f.H(250 - 250 * T, 0.12 + 0.55 * T)); if ((y - 1) % Math.max(2, Math.floor(rows / 8)) === 0 && lw > 6) put(g, lx + 3, y, Math.round(30 + 70 * T) + '°C', f.C(0.6)); }
    let mx = 0; for (const h of hs) mx = Math.max(mx, h[2]);
    put(g, 1, 0, 'die temperature · max ' + (40 + 50 * Math.min(1, mx * 0.8)).toFixed(1) + '°C · 8 cores · 1 Hz', f.C(0.75));
  },
  wall(s, f) {
    const { g, cols, rows, dt, t } = f;
    s.tacc += dt;
    if (s.tacc > 0.14) {
      s.tacc = 0;
      for (const tl of s.tiles) { tl.h.copyWithin(0, 1); tl.h[47] = clamp(tl.base * (0.75 + 0.5 * Math.random()) + (tl.alert > 0 ? 40 : 0), 0, 100); if (tl.alert > 0) tl.alert -= 0.5; else if (Math.random() < 0.004) tl.alert = rnd(4, 9); }
    }
    const nx = cols >= 200 ? 6 : 3, ny = cols >= 200 ? 4 : 3, tw = Math.floor(cols / nx), th = Math.floor((rows - 1) / ny);
    put(g, 1, 0, 'SERVICE HEALTH · ' + s.tiles.length + ' services · ' + s.tiles.filter(q => q.alert > 0).length + ' alerts · ' + fmtT(40000 + t), f.C(0.75));
    for (let k = 0; k < nx * ny && k < s.tiles.length; k++) {
      const tl = s.tiles[k], x0 = (k % nx) * tw, y0 = 1 + Math.floor(k / nx) * th, al = tl.alert > 0;
      const col = al ? f.H(0, 0.55) : f.C(0.35);
      box(g, x0, y0, tw - 1, th, col, null, null, 1);
      g.set(x0 + 2, y0 + 1, '●', al ? (Math.floor(t * 2) % 2 ? f.H(0, 0.7) : f.H(0, 0.4)) : f.H(120, 0.35 + 0.25 * Math.sin(t * 3 + k)));
      put(g, x0 + 4, y0 + 1, tl.name, f.C(0.9));
      const cur = tl.h[47], val = Math.round(cur * 3.7) + ' ms';
      put(g, x0 + tw - val.length - 3, y0 + 1, val, al ? f.H(0, 0.65) : f.C(0.75));
      const sw = tw - 5, sh = Math.max(1, th - 4);
      for (let q = 0; q < sw; q++) {
        const v = tl.h[Math.max(0, 48 - sw + q)] / 100 * sh, full = Math.floor(v), part = Math.floor((v - full) * 8);
        for (let j = 0; j < sh; j++) {
          const y = y0 + th - 2 - j;
          if (j < full) g.set(x0 + 2 + q, y, '█', al ? f.H(0, 0.3 + 0.2 * j / sh) : f.C(0.3 + 0.4 * j / sh));
          else if (j === full && part) g.set(x0 + 2 + q, y, VEIGHT[part], al ? f.H(0, 0.45) : f.C(0.6));
        }
      }
    }
  },
});

/* ═════════ 7. 網路拓樸 ═════════ */
const CONN = ' ╵╷│╴┘┐┤╶└┌├─┴┬┼';
// 斜線字元：依螢幕上的角度挑 ─ │ ╱ ╲
function slopeCh(dx, dy, aspect) {
  const a = Math.abs(Math.atan2(dy * aspect, dx) * 180 / Math.PI);
  const b = a > 90 ? 180 - a : a;
  if (b < 24) return '─';
  if (b > 66) return '│';
  return (dx > 0) === (dy < 0) ? '╱' : '╲';
}
const NODE_CH = { core: '◉', hub: '◆', srv: '■', cli: '●', sat: '✦', gnd: '▲', j: '' };
A({ id: 'te-net', name: '網路拓樸', cat: '科技', theme: 'cyber', hue: true, desc: '節點之間封包帶著光尾來回奔跑',
  params: { mode: 'mesh' },
  variants: [
    { id: 'star', name: '星狀', theme: 'ice', desc: '核心連到集線器，再分散到各終端', params: { mode: 'star' } },
    { id: 'ring', name: '環狀', theme: 'neon', desc: '同心圓環上的封包繞圈傳遞', params: { mode: 'ring' } },
    { id: 'tree', name: '樹狀', theme: 'mint', desc: '由根節點往下分支的組織圖', params: { mode: 'tree' } },
    { id: 'grid', name: '網格路由', theme: 'blueprint', desc: '棋盤網格上封包找路，路徑發亮', params: { mode: 'grid' } },
    { id: 'force', name: '力導向', theme: 'lavender', desc: '彈簧般互相拉扯、緩緩漂移的節點', params: { mode: 'force' } },
    { id: 'bus', name: '匯流排', theme: 'amber', desc: '三條主幹線上掛滿裝置', params: { mode: 'bus' } },
    { id: 'sat', name: '衛星鏈路', theme: 'ocean', desc: '地面站經由移動中的衛星互傳', params: { mode: 'sat' } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f;
    s.nodes = []; s.edges = []; s.mode = p.mode; s.orth = false;
    const N = (x, y, kind, label) => { s.nodes.push({ x, y, kind, label: label || '', pulse: 0, vx: 0, vy: 0 }); return s.nodes.length - 1; };
    const E = (a, b) => s.edges.push([a, b, 0]);
    const W = cols, H = rows, big = cols >= 200;
    const m = p.mode;
    if (m === 'mesh') {
      const n = clamp(Math.floor((W * H) / 230), 14, 80), d = Math.sqrt((W * H * aspect) / n) * 0.72;
      let tries = 0;
      while (s.nodes.length < n && tries++ < 5000) {
        const x = rnd(3, W - 10), y = rnd(1.5, H - 2.5);
        if (s.nodes.every(q => Math.hypot(q.x - x, (q.y - y) * aspect) > d)) { const r = Math.random(); N(x, y, r < 0.18 ? 'hub' : r < 0.6 ? 'srv' : 'cli', r < 0.18 ? 'rt-' + rint(1, 99) : r < 0.6 ? 'srv-' + pad0(rint(1, 99), 2) : '10.0.' + rint(0, 9) + '.' + rint(2, 250)); }
      }
      s.nodes.forEach((a, i) => {
        const near = s.nodes.map((b, j) => [Math.hypot(a.x - b.x, (a.y - b.y) * aspect), j]).filter(q => q[1] !== i).sort((u, v) => u[0] - v[0]);
        for (let k = 0; k < (a.kind === 'hub' ? 3 : 2); k++) { const j = near[k][1]; if (!s.edges.some(e => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) E(i, j); }
      });
    } else if (m === 'star') {
      const cx = W / 2, cy = H / 2, c = N(cx, cy, 'core', 'CORE'), nh = big ? 7 : 5, R = Math.min(W * 0.3, H * aspect * 0.3);
      for (let h = 0; h < nh; h++) {
        const a = (h / nh) * TAU + 0.3, hx0 = cx + Math.cos(a) * R * 1.25, hy0 = cy + (Math.sin(a) * R) / aspect, hb = N(hx0, hy0, 'hub', 'sw-' + (h + 1));
        E(c, hb);
        const nl = rint(big ? 5 : 3, big ? 9 : 5), r2 = R * 0.42;
        for (let k = 0; k < nl; k++) { const b = a + ((k - (nl - 1) / 2) / nl) * 2.2; E(hb, N(hx0 + Math.cos(b) * r2 * 1.4, hy0 + (Math.sin(b) * r2) / aspect, Math.random() < 0.5 ? 'srv' : 'cli', (h + 1) + '.' + (k + 1))); }
      }
      for (const q of s.nodes) { q.x = clamp(q.x, 1, W - 6); q.y = clamp(q.y, 1, H - 2); }
    } else if (m === 'ring') {
      const cx = W / 2, cy = H / 2, R = Math.min(W * 0.48, H * aspect * 0.48), c = N(cx, cy, 'core', 'HUB');
      const rings = big ? [8, 16, 24] : [6, 10, 14], idx = [];
      rings.forEach((n, r) => {
        const rr = R * (0.3 + 0.33 * r), row = [];
        for (let k = 0; k < n; k++) { const a = (k / n) * TAU + r * 0.2; row.push(N(cx + Math.cos(a) * rr * 1.15, cy + (Math.sin(a) * rr) / aspect, r === 0 ? 'hub' : r === 1 ? 'srv' : 'cli', 'n' + r + k)); }
        for (let k = 0; k < n; k++) E(row[k], row[(k + 1) % n]);
        idx.push(row);
      });
      idx[0].forEach(q => E(c, q));
      for (let r = 1; r < idx.length; r++) idx[r].forEach((q, k) => { if (k % 2 === 0) E(q, idx[r - 1][Math.round((k / idx[r].length) * idx[r - 1].length) % idx[r - 1].length]); });
    } else if (m === 'tree') {
      s.orth = true;
      const L = big ? 5 : 4, levels = [[N(0, 1.5, 'core', 'root')]];
      s.nodes[0].ch = [];
      for (let l = 1; l < L; l++) {
        const row = [];
        for (const pi of levels[l - 1]) {
          const nc = l === L - 1 ? rint(2, big ? 4 : 3) : rint(2, 3);
          s.nodes[pi].ch = [];
          for (let k = 0; k < nc; k++) { const q = N(0, 1.5 + (l * (H - 4)) / (L - 1), l === L - 1 ? 'cli' : l === 1 ? 'hub' : 'srv', l === L - 1 ? '' : (l === 1 ? 'dc-' : 'rk-') + (row.length + 1)); s.nodes[q].ch = []; s.nodes[pi].ch.push(q); row.push(q); E(pi, q); }
        }
        levels.push(row);
      }
      const leaves = levels[L - 1], sp = (W - 4) / leaves.length;
      leaves.forEach((q, k) => (s.nodes[q].x = Math.round(2 + sp * (k + 0.5))));
      for (let l = L - 2; l >= 0; l--) for (const q of levels[l]) { const ch2 = s.nodes[q].ch; s.nodes[q].x = Math.round(ch2.reduce((a, c2) => a + s.nodes[c2].x, 0) / ch2.length); }
      for (const q of s.nodes) q.y = Math.round(q.y);
    } else if (m === 'grid') {
      s.orth = true;
      const gx = big ? 16 : 8, gy = big ? 9 : 5, sx = (W - 8) / (gx - 1), sy = (H - 3) / (gy - 1);
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) N(Math.round(3 + i * sx), Math.round(1 + j * sy), Math.random() < 0.15 ? 'hub' : 'srv', '');
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const a = j * gx + i; if (i < gx - 1 && Math.random() > 0.08) E(a, a + 1); if (j < gy - 1 && Math.random() > 0.08) E(a, a + gx); }
      s.gx = gx; s.gy = gy;
    } else if (m === 'force') {
      const n = big ? 46 : 22;
      for (let k = 0; k < n; k++) { N(W / 2 + rnd(-W * 0.3, W * 0.3), H / 2 + rnd(-H * 0.3, H * 0.3), k === 0 ? 'core' : k < 5 ? 'hub' : 'cli', k < 5 ? 'n' + k : ''); if (k) E(k, k < 5 ? 0 : rint(0, Math.min(k - 1, 4 + (k >> 2)))); }
      for (let k = 0; k < n / 5; k++) { const a = rint(1, n - 1), b = rint(1, n - 1); if (a !== b) E(a, b); }
    } else if (m === 'bus') {
      s.orth = true;
      const nb = 3, ys = [0.22, 0.52, 0.82].map(v => Math.round(v * H));
      const jn = [];
      ys.forEach((y, bi) => {
        const row = []; let x = 4;
        while (x < W - 6) {
          const j = N(x, y, 'j', ''); row.push(j);
          const up = (row.length + bi) % 2 === 0, dh = rint(2, Math.max(2, Math.floor(H * 0.1)));
          const d = N(x, y + (up ? -dh : dh), Math.random() < 0.25 ? 'srv' : 'cli', (up ? '' : '') + pick(['pc', 'cam', 'plc', 'nas', 'ap', 'tv']) + rint(1, 99));
          E(j, d);
          x += rint(big ? 9 : 7, big ? 15 : 11);
        }
        for (let k = 0; k < row.length - 1; k++) E(row[k], row[k + 1]);
        jn.push(row);
      });
      for (let bi = 0; bi < nb - 1; bi++) for (let k = 0; k < 2; k++) {
        const a = jn[bi][Math.floor(((k + 0.5) / 2) * jn[bi].length)];
        // 用路由器把兩條匯流排接起來（垂直線）
        const x = s.nodes[a].x, b = N(x, s.nodes[jn[bi + 1][0]].y, 'j', '');
        const r = N(x + 0.0, Math.round((s.nodes[a].y + s.nodes[b].y) / 2), 'hub', 'rt' + (bi * 2 + k + 1));
        E(a, r); E(r, b);
        // 找下一條匯流排上最近的接點相連
        let best = jn[bi + 1][0]; for (const q of jn[bi + 1]) if (Math.abs(s.nodes[q].x - x) < Math.abs(s.nodes[best].x - x)) best = q;
        if (best !== b) E(b, best);
      }
    } else if (m === 'sat') {
      s.ng = big ? 9 : 5;
      for (let k = 0; k < s.ng; k++) N(Math.round(((k + 0.5) / s.ng) * W + rnd(-3, 3)), H - 3, 'gnd', 'GS-' + (k + 1));
      s.ns = big ? 12 : 7;
      for (let k = 0; k < s.ns; k++) N(0, 0, 'sat', 'SAT-' + pad0(k + 11, 2));
      s.terrain = []; for (let x = 0; x < W; x++) s.terrain.push(clamp(1.2 + 1.2 * Noise.n3(x * 0.05, 3.3) + 0.6 * Noise.n3(x * 0.2, 7), 0.2, 2.8));
      this.satMove(s, f, 0);
    }
    s.edges.forEach(e => (e[2] = 0));
    this.adj(s);
    s.pk = [];
    const np = m === 'sat' ? s.ng * 2 : m === 'grid' ? Math.floor(s.nodes.length / 4) : Math.max(6, Math.floor(s.edges.length * 0.55));
    for (let k = 0; k < np; k++) this.spawn(s, f);
    s.conn = new Uint8Array(cols * rows); s.heat = new Float32Array(cols * rows);
  },
  adj(s) {
    s.ad = s.nodes.map(() => []);
    s.edges.forEach((e, k) => { s.ad[e[0]].push([e[1], k]); s.ad[e[1]].push([e[0], k]); });
  },
  spawn(s, f) {
    const cand = s.nodes.map((q, i) => i).filter(i => s.ad[i].length && s.nodes[i].kind !== 'j');
    const a = pick(cand.length ? cand : [0]);
    if (!s.ad[a] || !s.ad[a].length) return;
    const [b, e] = pick(s.ad[a]);
    s.pk.push({ a, b, e, pos: 0, sp: rnd(6, 16), hue: pick([190, 300, 50, 120, 20]), dest: s.mode === 'grid' ? rint(0, s.nodes.length - 1) : -1 });
  },
  // 兩點之間的折線（樹狀圖用直角折線）
  path(s, a, b, out) {
    const A2 = s.nodes[a], B2 = s.nodes[b];
    if (s.mode === 'tree') {
      const up = A2.y < B2.y ? A2 : B2, dn = A2.y < B2.y ? B2 : A2, my = Math.round((up.y + dn.y) / 2);
      const P = [[up.x, up.y], [up.x, my], [dn.x, my], [dn.x, dn.y]];
      if (A2 !== up) P.reverse();
      return P;
    }
    return [[A2.x, A2.y], [B2.x, B2.y]];
  },
  plen(P, aspect) { let L = 0; for (let k = 1; k < P.length; k++) L += Math.hypot(P[k][0] - P[k - 1][0], (P[k][1] - P[k - 1][1]) * aspect); return L; },
  pat(P, d, aspect) {
    for (let k = 1; k < P.length; k++) {
      const l = Math.hypot(P[k][0] - P[k - 1][0], (P[k][1] - P[k - 1][1]) * aspect);
      if (d <= l || k === P.length - 1) { const u = l ? clamp(d / l, 0, 1) : 0; return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * u, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * u]; }
      d -= l;
    }
    return P[P.length - 1];
  },
  satMove(s, f, t) {
    const { cols, rows } = f, W = cols, H = rows;
    for (let k = 0; k < s.ns; k++) {
      const q = s.nodes[s.ng + k], u = fract(k / s.ns + t * 0.012);
      q.x = -10 + u * (W + 20); q.y = H * 0.12 + H * 0.22 * (1 - Math.sin(u * Math.PI)) + (k % 2) * H * 0.08;
    }
    s.edges = [];
    const sats = []; for (let k = 0; k < s.ns; k++) sats.push(s.ng + k);
    sats.sort((a, b) => s.nodes[a].x - s.nodes[b].x);
    for (let k = 0; k < sats.length - 1; k++) if (s.nodes[sats[k + 1]].x - s.nodes[sats[k]].x < W * 0.3) s.edges.push([sats[k], sats[k + 1], 0]);
    for (let gI = 0; gI < s.ng; gI++) {
      const gq = s.nodes[gI]; let best = -1, bd = 1e9;
      for (const sI of sats) { const sq = s.nodes[sI]; if (sq.x < 0 || sq.x >= W) continue; const d = Math.abs(sq.x - gq.x); if (d < bd) { bd = d; best = sI; } }
      if (best >= 0 && bd < W * 0.22) s.edges.push([gI, best, 0]);
    }
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, aspect } = f, nodes = s.nodes, m = s.mode;
    if (m === 'force') this.force(s, f);
    if (m === 'sat') { this.satMove(s, f, t); this.adj(s); }
    // 封包移動
    for (let k = s.pk.length - 1; k >= 0; k--) {
      const q = s.pk[k], P = this.path(s, q.a, q.b), L = this.plen(P, aspect);
      q.pos += q.sp * dt;
      if (s.edges[q.e] && s.edges[q.e][0] !== undefined) s.edges[q.e][2] = 1;
      if (q.pos >= L) {
        const nb = nodes[q.b]; nb.pulse = 1;
        const opts = s.ad[q.b] || [];
        if (!opts.length) { kill(s.pk, k); this.spawn(s, f); continue; }
        let nx;
        if (m === 'grid') {
          if (q.b === q.dest) q.dest = rint(0, nodes.length - 1);
          const D = nodes[q.dest], cur = nodes[q.b];
          const good = opts.filter(([o]) => Math.abs(nodes[o].x - D.x) + Math.abs(nodes[o].y - D.y) * 2 < Math.abs(cur.x - D.x) + Math.abs(cur.y - D.y) * 2);
          nx = pick(good.length ? good : opts);
        } else if (m === 'ring') {
          const fw = opts.filter(([o]) => o !== q.a);
          nx = pick(fw.length ? fw : opts);
        } else {
          const fw = opts.filter(([o]) => o !== q.a);
          nx = pick(fw.length && Math.random() < 0.9 ? fw : opts);
        }
        q.a = q.b; q.b = nx[0]; q.e = nx[1]; q.pos -= L;
        if (q.pos > 5) q.pos = 0;
      }
    }
    // 線路
    const conn = s.conn, heat = s.heat, ch = g.ch, co = g.co;
    if (s.orth) { conn.fill(0); heat.fill(0); }
    for (const e of s.edges) {
      e[2] = Math.max(0, e[2] - dt * 0.6);
      const P = this.path(s, e[0], e[1]);
      for (let k = 1; k < P.length; k++) {
        const x0 = Math.round(P[k - 1][0]), y0 = Math.round(P[k - 1][1]), x1 = Math.round(P[k][0]), y1 = Math.round(P[k][1]);
        if (s.orth && (x0 === x1 || y0 === y1)) {
          if (y0 === y1) { const a = Math.min(x0, x1), b = Math.max(x0, x1); for (let x = a; x <= b; x++) { if (x < 0 || x >= cols || y0 < 0 || y0 >= rows) continue; const i = y0 * cols + x; if (x > a) conn[i] |= 4; if (x < b) conn[i] |= 8; heat[i] = Math.max(heat[i], e[2]); } }
          else { const a = Math.min(y0, y1), b = Math.max(y0, y1); for (let y = a; y <= b; y++) { if (y < 0 || y >= rows || x0 < 0 || x0 >= cols) continue; const i = y * cols + x0; if (y > a) conn[i] |= 1; if (y < b) conn[i] |= 2; heat[i] = Math.max(heat[i], e[2]); } }
        } else {
          const c = slopeCh(x1 - x0, y1 - y0, aspect), col = f.C(0.2 + 0.45 * e[2]);
          const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
          for (let q = 1; q < n; q++) { const x = Math.round(x0 + ((x1 - x0) * q) / n), y = Math.round(y0 + ((y1 - y0) * q) / n); if (x >= 0 && y >= 0 && x < cols && y < rows) { const i = y * cols + x; if (ch[i] === ' ' || e[2] > 0.1) { ch[i] = c; co[i] = col; } } }
        }
      }
    }
    if (s.orth) for (let i = 0; i < conn.length; i++) if (conn[i]) { ch[i] = CONN[conn[i]]; co[i] = f.C(0.2 + 0.5 * heat[i]); }
    if (m === 'sat') {
      for (let x = 0; x < cols; x++) { const h = s.terrain[x]; for (let k = 0; k < Math.ceil(h); k++) { const v = clamp(h - k, 0, 1); g.set(x, rows - 1 - k, k === Math.ceil(h) - 1 ? VEIGHT[Math.max(1, Math.round(v * 8))] : '█', f.C(0.12 + 0.05 * k)); } }
      for (let x = 0; x < cols; x += 3) { const u = (x + 10) / (cols + 20); for (const off of [0, rows * 0.08]) g.set(x, rows * 0.12 + rows * 0.22 * (1 - Math.sin(u * Math.PI)) + off, '·', f.C(0.15)); }
    }
    // 封包與光尾
    for (const q of s.pk) {
      const P = this.path(s, q.a, q.b);
      for (let k = 7; k >= 0; k--) {
        const d = q.pos - k * 0.7; if (d < 0) continue;
        const [x, y] = this.pat(P, d, aspect);
        const xi = Math.round(x), yi = Math.round(y);
        if (xi < 0 || yi < 0 || xi >= cols || yi >= rows) continue;
        const i = yi * cols + xi;
        ch[i] = k === 0 ? '●' : k < 3 ? '•' : '·'; co[i] = f.H(q.hue, k === 0 ? 0.8 : 0.65 - k * 0.07);
      }
    }
    // 節點
    for (const q of nodes) {
      q.pulse = Math.max(0, q.pulse - dt * 1.6);
      const c = NODE_CH[q.kind]; if (!c) continue;
      const x = Math.round(q.x), y = Math.round(q.y);
      if (q.pulse > 0.4 && q.kind !== 'cli') { const r = (1 - q.pulse) * 2.4 + 1; for (let a = 0; a < 12; a++) { const xx = Math.round(x + Math.cos((a / 12) * TAU) * r * 1.2), yy = Math.round(y + (Math.sin((a / 12) * TAU) * r) / aspect); if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && ch[yy * cols + xx] === ' ') g.set(xx, yy, '·', f.C(0.3 + 0.4 * q.pulse)); } }
      g.set(x, y, c, q.kind === 'core' ? f.C(0.9 + 0.1 * q.pulse) : q.pulse > 0 ? f.C(0.6 + 0.4 * q.pulse) : f.C(q.kind === 'hub' ? 0.8 : 0.6));
      if (q.label && (cols >= 160 || q.kind !== 'cli')) putT(g, x + 2, y, q.label, f.C(q.pulse > 0.3 ? 0.75 : 0.42));
    }
    if (m === 'grid') for (const q of s.pk) { const D = nodes[q.dest]; if (D) g.set(Math.round(D.x), Math.round(D.y), '◎', f.H(q.hue, 0.7)); }
    put(g, 1, 0, { mesh: 'mesh · ', star: 'star · ', ring: 'ring · ', tree: 'tree · ', grid: 'grid · ', force: 'live graph · ', bus: 'field bus · ', sat: 'constellation · ' }[m] + nodes.filter(q => q.kind !== 'j').length + ' nodes · ' + s.pk.length + ' flows', f.C(0.55));
  },
  force(s, f) {
    const { cols, rows, dt, t, aspect } = f, N = s.nodes, n = N.length, k = Math.sqrt((cols * rows * aspect) / n) * 0.85;
    for (let i = 0; i < n; i++) {
      const a = N[i]; let fx = 0, fy = 0;
      for (let j = 0; j < n; j++) { if (i === j) continue; const b = N[j], dx = a.x - b.x, dy = (a.y - b.y) * aspect, d2 = dx * dx + dy * dy + 0.5, d = Math.sqrt(d2), rep = (k * k) / d2; fx += (dx / d) * rep; fy += (dy / d) * rep; }
      fx += (cols / 2 - a.x) * 0.006; fy += (rows / 2 - a.y) * aspect * 0.006;
      fx += Noise.n3(i * 3.1, t * 0.2) * 1.5; fy += Noise.n3(i * 7.3, t * 0.2) * 1.5;
      a.vx = (a.vx + fx * dt * 2) * 0.9; a.vy = (a.vy + fy * dt * 2) * 0.9;
    }
    for (const e of s.edges) {
      const a = N[e[0]], b = N[e[1]], dx = b.x - a.x, dy = (b.y - a.y) * aspect, d = Math.hypot(dx, dy) || 1, ff = (d - k) * 0.06;
      a.vx += (dx / d) * ff; a.vy += (dy / d) * ff; b.vx -= (dx / d) * ff; b.vy -= (dy / d) * ff;
    }
    for (const a of N) { a.x = clamp(a.x + a.vx * dt, 2, cols - 8); a.y = clamp(a.y + (a.vy * dt) / aspect, 1.5, rows - 1.5); }
    // 自動撐滿畫面：包圍框比目標小就慢慢往外拉（螢幕比圖寬，水平方向特別需要）
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const a of N) { x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y); }
    const kf = Math.min(1, dt * 1.2), sx = 1 + clamp((cols - 14) * 0.94 / Math.max(1, x1 - x0) - 1, -0.3, 0.3) * kf, sy = 1 + clamp((rows - 4) * 0.94 / Math.max(1, y1 - y0) - 1, -0.3, 0.3) * kf;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = mx + ((cols - 6) / 2 - mx) * kf, ny = my + (rows / 2 - my) * kf;
    for (const a of N) { a.x = clamp(nx + (a.x - mx) * sx, 2, cols - 8); a.y = clamp(ny + (a.y - my) * sy, 1.5, rows - 1.5); }
  },
});

/* ═════════ 8. 電路板 ═════════ */
const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DCH = ['─', '╲', '│', '╱', '─', '╲', '│', '╱'];
// 直角圓轉角：[進入方向][離開方向]
const RND = { '0,2': '╮', '0,6': '╯', '4,2': '╭', '4,6': '╰', '2,0': '╰', '2,4': '╯', '6,0': '╭', '6,4': '╮' };
A({ id: 'te-circuit', name: '電路板', cat: '科技', theme: 'mint', desc: '晶片之間的走線上脈衝流動',
  params: { mode: 'board', chips: 5, sp: 1, diag: 1, trail: 6, pulses: 0.35 },
  variants: [
    { id: 'cpu', name: '中央晶片', theme: 'gold', desc: '大晶片的接腳向四面八方扇出', params: { mode: 'cpu' } },
    { id: 'bus', name: '平行匯流', theme: 'ice', desc: '成束的平行走線斜折穿越板面', params: { mode: 'bus' } },
    { id: 'ortho', name: '直角佈線', theme: 'amber', desc: '只走直角的圓角走線與過孔', params: { mode: 'board', diag: 0, chips: 6 } },
    { id: 'grow', name: '自動佈線', theme: 'matrix', desc: '走線一條條長出來，鋪滿後重來', params: { mode: 'board', grow: 1, chips: 6 } },
    { id: 'radial', name: '放射光波', theme: 'rainbow', hue: true, desc: '走線從中央核心放射，光波一圈圈外擴', params: { mode: 'radial', trail: 16 } },
    { id: 'dense', name: '高密度', theme: 'forest', desc: '小晶片密密麻麻、走線貼得很近', params: { mode: 'board', chips: 16, sp: 0, pulses: 0.5 } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.own = new Int16Array(cols * rows); s.tr = []; s.chipsL = []; s.deco = []; s.pl = []; s.gT = 0; s.done = 0;
    const big = cols >= 200, own = s.own;
    const free = (x, y, w, h) => { for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 2; xx <= x + w + 1; xx++) { if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) return false; if (own[yy * cols + xx]) return false; } return true; };
    const chip = (x, y, w, h, lab) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) own[yy * cols + xx] = -1; s.chipsL.push({ x, y, w, h, lab }); };
    const LAB = ['U1', 'MCU', 'RAM', 'PMIC', 'ETH', 'PHY', 'DSP', 'ROM', 'FPGA', 'RF', 'ADC', 'CLK'];
    if (p.mode === 'cpu') {
      const w = Math.floor(cols * 0.22), h = Math.max(5, Math.floor(rows * 0.3));
      chip(Math.floor((cols - w) / 2), Math.floor((rows - h) / 2), w, h, 'TE-9000 CPU');
    } else if (p.mode === 'radial') {
      // 中央圓形核心焊墊，沒有其他晶片
      const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2), R = Math.max(4, Math.min(cols, rows * f.aspect) * 0.09);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (Math.hypot(x - cx, (y - cy) * f.aspect) <= R + 0.5) own[y * cols + x] = -1;
      s.core = { cx, cy, R }; s.wT = 0; s.wHue = rnd(0, 360); s.lastW = -9;
    } else if (p.mode === 'bus') {
      const h = Math.max(4, Math.floor(rows * 0.18)), w = big ? 14 : 9;
      chip(2, Math.floor(rows * 0.06), w, h, 'CPU'); chip(cols - w - 3, Math.floor(rows * 0.26), w, h, 'GPU');
      chip(2, Math.floor(rows * 0.74), w, h, 'I/O'); chip(cols - w - 3, Math.floor(rows * 0.5), w, h, 'RAM');
    }
    const nc = p.mode === 'board' ? Math.round(p.chips * (big ? 1.6 : 1)) : 0;
    for (let k = 0, tries = 0; k < nc && tries < 400; tries++) {
      const w = p.sp ? rint(big ? 8 : 6, big ? 18 : 12) : rint(4, 8), h = p.sp ? rint(3, big ? 7 : 5) : rint(2, 4), x = rint(3, cols - w - 4), y = rint(2, rows - h - 3);
      if (free(x, y, w, h)) { chip(x, y, w, h, pick(LAB)); k++; }
    }
    // 接腳 → 起點
    const starts = [];
    for (const c of s.chipsL) {
      const st = p.mode === 'cpu' ? 1 : p.sp ? 2 : 1;
      for (let x = c.x + 1; x < c.x + c.w - 1; x += st) { starts.push([x, c.y - 1, 6]); starts.push([x, c.y + c.h, 2]); }
      for (let y = c.y + (c.h > 3 ? 1 : 0); y < c.y + c.h - (c.h > 3 ? 1 : 0); y++) { starts.push([c.x - 1, y, 4]); starts.push([c.x + c.w, y, 0]); }
    }
    if (p.mode === 'bus') {
      // 成束的平行線：左邊晶片 → 右邊晶片
      const pairs = [[0, 1], [2, 3]];
      for (const [ai, bi] of pairs) {
        const A2 = s.chipsL[ai], B2 = s.chipsL[bi], n = Math.min(A2.h, B2.h) - 1;
        for (let k = 0; k < n; k++) {
          const y0 = A2.y + k + (A2.h > n ? 0 : 0), y1 = B2.y + k, x0 = A2.x + A2.w, x1 = B2.x - 1, pts = [];
          const mid = Math.floor((x0 + x1) / 2) - Math.floor(n / 2) + k * (y1 > y0 ? -1 : 1);
          let x = x0, y = y0;
          while (x < x1 && pts.length < cols * 3) { pts.push(y * cols + x); if (x >= mid && y !== y1) { y += y1 > y0 ? 1 : -1; } x++; }
          for (const i of pts) own[i] = s.tr.length + 1;
          s.tr.push(this.mkTrace(s, f, pts, 1));
        }
      }
    }
    if (p.mode === 'radial') {
      // 沿著核心外圈，每隔約兩格起一條往外放射的走線
      const C = s.core, rr = C.R + 1.6, ns = Math.floor(TAU * rr * 3), acc = [];
      for (let k = 0; k < ns; k++) {
        const a = (k / ns) * TAU, x = Math.round(C.cx + Math.cos(a) * rr), y = Math.round(C.cy + (Math.sin(a) * rr) / f.aspect);
        if (x < 0 || y < 0 || x >= cols || y >= rows || own[y * cols + x] || acc.some(q => Math.abs(q[0] - x) < 2 && Math.abs(q[1] - y) < 2)) continue;
        acc.push([x, y]);
        const pts = this.routeOut(s, f, x, y, s.tr.length + 1, a);
        if (pts.length >= 4) s.tr.push(this.mkTrace(s, f, pts, 1)); else for (const i of pts) own[i] = 0;
      }
    }
    starts.sort(() => Math.random() - 0.5);
    const maxT = p.mode === 'bus' ? Math.floor(starts.length * 0.5) : starts.length;
    for (let k = 0; k < maxT; k++) {
      const [x, y, d] = starts[k];
      if (x < 0 || y < 0 || x >= cols || y >= rows || own[y * cols + x]) continue;
      const pts = this.route(s, f, x, y, d, p.mode === 'cpu' ? 400 : rint(6, big ? 90 : 40), p.diag, p.sp, s.tr.length + 1);
      if (pts.length >= 3) s.tr.push(this.mkTrace(s, f, pts, p.diag));
      else for (const i of pts) own[i] = 0;
    }
    // 小零件、過孔、固定孔（放射款是暗色板子，不放）
    for (let k = 0, tries = 0; p.mode !== 'radial' && k < (cols * rows) / 160 && tries < 3000; tries++) {
      const x = rint(2, cols - 6), y = rint(1, rows - 2);
      if (own[y * cols + x] || own[y * cols + x + 1] || own[y * cols + x + 2] || own[y * cols + x - 1] || own[y * cols + x + 3]) continue;
      const r = Math.random();
      s.deco.push([x, y, r < 0.4 ? '▭' : r < 0.7 ? '◦' : r < 0.85 ? '[≡]' : '▪', (r < 0.4 ? 'R' : r < 0.7 ? '' : 'C') + (r < 0.7 && r >= 0.4 ? '' : rint(1, 99))]);
      own[y * cols + x] = -2; k++;
    }
    s.np = p.mode === 'radial' ? 0 : Math.max(3, Math.floor(s.tr.length * p.pulses));
    for (let k = 0; k < s.np; k++) this.pulse(s, true);
    if (p.grow) { s.gT = 0; for (const tr of s.tr) tr.shown = 0; }
  },
  // 放射走線：每一步都挑最接近「離開核心方向」的八方向之一，偶爾斜折一段
  routeOut(s, f, x, y, id, th0) {
    // 沿著起點的放射方向走：只用 0°/45°/90° 線段，偏離射線超過一點點才斜折修正，所以每個角度都有走線
    const { cols, rows, aspect } = f, own = s.own, C = s.core, pts = [], ux = Math.cos(th0), uy = Math.sin(th0);
    const ok = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false;
      if (own[ny * cols + nx]) return false;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const mx = nx + ax, my = ny + ay; if (mx < 0 || my < 0 || mx >= cols || my >= rows) continue; const o = own[my * cols + mx]; if (o > 0 && o !== id) return false; }
      return true;
    };
    const dev = (px, py) => (px - C.cx) * uy - (py - C.cy) * aspect * ux; // 到射線的垂直距離（等向）
    const ang = k => Math.atan2(D8[k][1] * aspect, D8[k][0]), adiff = (u, v) => Math.abs((((u - v) % TAU) + TAU * 1.5) % TAU - Math.PI);
    let cur = 0, bd = 9;
    for (let k = 0; k < 8; k++) { const d = adiff(ang(k), th0); if (d < bd) { bd = d; cur = k; } }
    own[y * cols + x] = id; pts.push(y * cols + x);
    for (let n = 0; n < cols * 2; n++) {
      const e = dev(x, y);
      if (Math.abs(e) > 1.3) {
        // 換到能把偏差拉回來的相鄰方向
        for (const k of [(cur + 1) % 8, (cur + 7) % 8]) { const e2 = dev(x + D8[k][0] * 3, y + D8[k][1] * 3); if (Math.abs(e2) < Math.abs(e) && Math.cos(ang(k) - th0) > 0.2) { cur = k; break; } }
      } else if (Math.abs(e) < 0.4) {
        let best = cur, b2 = 9; for (let k = 0; k < 8; k++) { const d = adiff(ang(k), th0); if (d < b2) { b2 = d; best = k; } } cur = best;
      }
      let moved = false;
      for (const td of [cur, (cur + 1) % 8, (cur + 7) % 8]) { const nx = x + D8[td][0], ny = y + D8[td][1]; if (ok(nx, ny)) { x = nx; y = ny; own[y * cols + x] = id; pts.push(y * cols + x); moved = true; break; } }
      if (!moved) break;
    }
    return pts;
  },
  route(s, f, x, y, d, maxLen, diag, sp, id) {
    const { cols, rows } = f, own = s.own, pts = [];
    const ok = (nx, ny, dx, dy) => {
      if (nx < 1 || ny < 0 || nx >= cols - 1 || ny >= rows) return false;
      const i = ny * cols + nx; if (own[i]) return false;
      if (dx && dy && own[y * cols + nx] > 0 && own[ny * cols + x] > 0 && own[y * cols + nx] === own[ny * cols + x]) return false;
      if (sp) for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const mx = nx + ax, my = ny + ay; if (mx < 0 || my < 0 || mx >= cols || my >= rows) continue; const o = own[my * cols + mx]; if (o > 0 && o !== id) return false; }
      return true;
    };
    own[y * cols + x] = id; pts.push(y * cols + x);
    for (let n = 0; n < maxLen; n++) {
      if (n > 2 && Math.random() < (diag ? 0.12 : 0.1)) d = (d + (diag ? (Math.random() < 0.5 ? 1 : 7) : (Math.random() < 0.5 ? 2 : 6))) % 8;
      let moved = false;
      for (const tryD of diag ? [d, (d + 1) % 8, (d + 7) % 8] : [d, (d + 2) % 8, (d + 6) % 8]) {
        const [dx, dy] = D8[tryD], nx = x + dx, ny = y + dy;
        if (ok(nx, ny, dx, dy)) { d = tryD; x = nx; y = ny; own[y * cols + x] = id; pts.push(y * cols + x); moved = true; break; }
      }
      if (!moved) break;
    }
    return pts;
  },
  mkTrace(s, f, pts, diag) {
    const cols = f.cols, chs = [];
    const dirOf = (a, b) => { const dx = Math.sign((b % cols) - (a % cols)), dy = Math.sign(Math.floor(b / cols) - Math.floor(a / cols)); return D8.findIndex(q => q[0] === dx && q[1] === dy); };
    for (let k = 0; k < pts.length; k++) {
      if (k === pts.length - 1) { chs.push('o'); continue; }
      const dOut = dirOf(pts[k], pts[k + 1]);
      if (!diag && k > 0) { const dIn = dirOf(pts[k - 1], pts[k]); if (dIn !== dOut) { chs.push(RND[dIn + ',' + dOut] || DCH[dOut]); continue; } }
      chs.push(DCH[dOut] || '·');
    }
    return { pts, chs, shown: pts.length };
  },
  pulse(s, init) {
    if (!s.tr.length) return;
    const tr = rint(0, s.tr.length - 1), L = s.tr[tr].pts.length, dir = Math.random() < 0.5 ? 1 : -1;
    s.pl.push({ tr, pos: init ? rnd(0, L) : dir > 0 ? 0 : L - 1, dir, sp: rnd(8, 22), hue: rnd(0, 360) });
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, p } = f, ch = g.ch, co = g.co, radial = p.mode === 'radial';
    // 板面底紋（放射款是全暗的板子）
    if (!radial) for (let y = 1; y < rows; y += 3) for (let x = (y * 2) % 6; x < cols; x += 6) { const i = y * cols + x; ch[i] = '·'; co[i] = f.C(0.08); }
    if (radial) {
      // 每隔一段時間從核心送出一圈光波，沿每條走線同時往外跑
      s.wT -= dt;
      if (s.wT <= 0) { s.wT = 1.7; s.wHue = (s.wHue + 47) % 360; s.lastW = t; for (let k = 0; k < s.tr.length; k++) s.pl.push({ tr: k, pos: 0, dir: 1, sp: 15, hue: s.wHue }); }
    }
    if (p.grow) {
      if (s.done > 0) { s.done -= dt; if (s.done <= 0) { this.init(s, f); return; } }
      else {
        s.gT += dt;
        let all = true;
        for (let k = 0; k < s.tr.length; k++) { const tr = s.tr[k], st = (k / s.tr.length) * 14; tr.shown = clamp(Math.floor((s.gT - st) * 26), 0, tr.pts.length); if (tr.shown < tr.pts.length) all = false; }
        if (all) s.done = 5;
      }
    }
    const glow = p.trail > 10, base = glow ? 0.14 : 0.32;
    for (const tr of s.tr) {
      const n = tr.shown;
      for (let k = 0; k < n; k++) { const i = tr.pts[k]; ch[i] = tr.chs[k]; co[i] = f.C(k === tr.pts.length - 1 ? base + 0.2 : base); }
      if (p.grow && n > 0 && n < tr.pts.length) { const i = tr.pts[n - 1]; ch[i] = '█'; co[i] = f.C(1); }
    }
    for (const d of s.deco) { put(g, d[0], d[1], d[2], f.C(0.4)); if (d[3] && cols >= 120) put(g, d[0], d[1] - 1 >= 0 ? d[1] - 1 : d[1] + 1, d[3], f.C(0.18)); }
    for (const c of s.chipsL) {
      for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) {
        const top = y === c.y, bot = y === c.y + c.h - 1, lf = x === c.x, rt = x === c.x + c.w - 1;
        const cc = top && lf ? '┏' : top && rt ? '┓' : bot && lf ? '┗' : bot && rt ? '┛' : top || bot ? '━' : lf || rt ? '┃' : (x + y) % 2 ? '░' : ' ';
        g.set(x, y, cc, f.C(top || bot || lf || rt ? 0.7 : 0.14));
      }
      if (c.w > c.lab.length + 1) put(g, c.x + Math.floor((c.w - c.lab.length) / 2), c.y + Math.floor(c.h / 2), c.lab, f.C(0.85));
      if (c.h >= 4) g.set(c.x + 1, c.y + 1, '●', f.C(0.5));
    }
    // 脈衝
    const TL = p.trail;
    for (let k = s.pl.length - 1; k >= 0; k--) {
      const q = s.pl[k], tr = s.tr[q.tr];
      if (!tr) { kill(s.pl, k); continue; }
      q.pos += q.dir * q.sp * dt;
      if (q.pos < -TL || q.pos > tr.pts.length + TL) { kill(s.pl, k); this.pulse(s, false); continue; }
      for (let j = 0; j <= TL; j++) {
        const pi = Math.round(q.pos - q.dir * j);
        if (pi < 0 || pi >= tr.shown) continue;
        const i = tr.pts[pi], v = 1 - j / (TL + 1);
        co[i] = glow ? f.H(q.hue + j * 6, 0.25 + 0.55 * v) : f.C(base + (1 - base) * v);
        if (j === 0) ch[i] = tr.chs[pi] === 'o' ? '◉' : '█';
      }
    }
    while (s.pl.length < s.np) this.pulse(s, false);
    if (radial) {
      // 核心焊墊：光波送出時亮一下
      const C = s.core, fl = Math.max(0, 1 - (t - s.lastW) / 0.7);
      for (let y = Math.floor(C.cy - C.R / f.aspect) - 1; y <= C.cy + C.R / f.aspect + 1; y++) for (let x = Math.floor(C.cx - C.R) - 1; x <= C.cx + C.R + 1; x++) {
        const d = Math.hypot(x - C.cx, (y - C.cy) * f.aspect);
        if (d <= C.R + 0.5) g.set(x, y, d > C.R - 0.9 ? '█' : (x + y) % 2 ? '▓' : '▒', d > C.R - 0.9 ? f.H(s.wHue, 0.35 + 0.45 * fl) : f.H(s.wHue, 0.12 + 0.3 * fl * (1 - d / C.R)));
      }
      if (C.R >= 4) put(g, C.cx - 2, C.cy, 'CORE', f.C(0.9));
    }
  },
});

/* ═════════ 9. 資料洪流（水平） ═════════ */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function laneStr(kind, L) {
  let s = '';
  if (kind === 'bin') while (s.length < L) s += Math.random() < 0.5 ? '0' : '1';
  else if (kind === 'hex') while (s.length < L) s += hx(rint(0, 255), 2) + (Math.random() < 0.15 ? '  ' : ' ');
  else while (s.length < L) s += B64[rint(0, 63)];
  return s.slice(0, L);
}
function laneInt(L) {
  // 亮度：一段段的封包，前緣最亮、尾巴漸暗
  const I = new Float32Array(L);
  let x = 0;
  while (x < L) {
    const gap = rint(4, 30), len = rint(6, 40);
    x += gap;
    for (let k = 0; k < len && x + k < L; k++) I[x + k] = 0.25 + 0.75 * Math.pow(k / len, 1.6);
    x += len;
  }
  for (let k = 0; k < L; k++) if (!I[k]) I[k] = Math.random() < 0.5 ? 0.12 : 0;
  return I;
}
A({ id: 'te-stream', name: '資料洪流', cat: '科技', theme: 'matrix', desc: '一排排位元以不同速度橫向奔流',
  params: { mode: 'bin' },
  variants: [
    { id: 'hex', name: '十六進位', theme: 'amber', desc: '位元組成對流過，左側標著介面名稱', params: { mode: 'hex' } },
    { id: 'parallax', name: '視差', theme: 'ice', desc: '遠、中、近三層資料以不同速度滑過', params: { mode: 'parallax' } },
    { id: 'duplex', name: '全雙工', theme: 'cyber', hue: true, desc: '收發兩條管線裡封包與 ACK 對向奔流', params: { mode: 'duplex' } },
    { id: 'converge', name: '匯聚', theme: 'neon', desc: '資料從四面八方被吸進右方核心', params: { mode: 'converge' } },
    { id: 'packets', name: '封包列車', theme: 'mint', hue: true, desc: '帶標頭的封包方塊在軌道上前進', params: { mode: 'packets' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f, m = p.mode;
    s.L = 1024; s.lanes = [];
    const mk = (y, v, kind, layer) => ({ y, v, o: rnd(0, 1000), s: laneStr(kind, s.L).split(''), I: laneInt(s.L), kind, layer: layer || 0, lab: pick(['eth0', 'eth1', 'wlan0', 'bond0', 'ib0', 'lo', 'tun0']) + ' ' });
    if (m === 'bin' || m === 'hex') {
      for (let y = 0; y < rows; y += m === 'hex' ? 2 : 1) s.lanes.push(mk(y, (Math.random() < 0.5 ? 1 : 1) * rnd(5, 45) * (m === 'hex' ? 0.6 : 1), m));
    } else if (m === 'parallax') {
      for (let layer = 0; layer < 3; layer++) for (let y = 0; y < rows; y++) if (Math.random() < [0.7, 0.45, 0.25][layer]) s.lanes.push(mk(y, [4, 14, 40][layer] * rnd(0.8, 1.25), layer === 2 ? 'bin' : 'b64', layer));
      s.lanes.sort((a, b) => a.layer - b.layer);
    } else if (m === 'duplex') {
      s.dx = { pk: [[], []], ack: [[], []], seq: [rint(1e5, 9e5), rint(1e5, 9e5)], rate: [new Float32Array(120), new Float32Array(120)], rh: 0, racc: 0, bytes: [0, 0], fl: [0, 0] };
      for (let k = 0; k < 120; k++) { s.dx.rate[0][k] = 420 + 160 * Math.sin(k * 0.13) + rnd(0, 60); s.dx.rate[1][k] = 380 + 140 * Math.sin(k * 0.09 + 2) + rnd(0, 60); }
      s.dx.rh = 120;
    } else if (m === 'wave') {
      s.rb = [];
      const nr = Math.max(4, Math.floor(rows / 9));
      for (let k = 0; k < nr; k++) { const w = rint(3, 5), ln = []; for (let j = 0; j < w; j++) ln.push(mk(0, rnd(10, 18), 'b64')); s.rb.push({ y0: ((k + 0.5) / nr) * rows, A: rows * rnd(0.05, 0.12), kx: rnd(0.02, 0.06), w: rnd(0.4, 1.0), ph: rnd(0, TAU), ln, hue: k }); }
    } else if (m === 'converge') {
      s.vx = cols * 0.82; s.vy = rows / 2; s.items = [];
      for (let k = 0; k < (cols * rows) / 11; k++) s.items.push(this.cItem(s, f, true));
    } else if (m === 'packets') {
      s.tracks = [];
      const nt = Math.max(3, Math.floor((rows - 1) / 4));
      for (let k = 0; k < nt; k++) { const tk = { y: 1 + k * 4, v: rnd(8, 22) * (k % 2 ? -1 : 1), pk: [] }; let x = rnd(-20, 0); while (x < cols + 40) { const len = rint(10, 28); tk.pk.push({ x, len, pr: pick(['TCP', 'UDP', 'TLS', 'DNS', 'ICMP', 'QUIC']), id: hx(rint(0, 65535), 4), data: laneStr('hex', 64), hue: rint(0, 5) }); x += len + rint(3, 18); } s.tracks.push(tk); }
    } else if (m === 'dots') {
      s.b = bnew(cols, rows); s.P = [];
      const n = Math.floor(cols * rows * 0.5);
      for (let k = 0; k < n; k++) s.P.push([rnd(0, cols * 2), rnd(0, rows * 4), rnd(0.5, 1.5)]);
      s.vr = new Float32Array(rows * 4);
    }
  },
  // 全雙工：上管 A→B、下管 B→A，封包是有框的資料塊；收到後在對向管子送回 ACK；兩端是吞吐量走勢
  duplex(s, f) {
    const { g, cols, rows, dt, t } = f, D = s.dx;
    const ew = clamp(Math.floor(cols * 0.12), 13, 30), px0 = ew + 1, px1 = cols - ew - 2, PW = px1 - px0 + 1;
    const gp = Math.max(3, Math.floor(rows * 0.12)), ph = Math.max(6, Math.floor((rows - 4 - gp) / 2)), PY = [2, 2 + ph + gp];
    const dh = ph - 3, nl = Math.max(1, Math.floor((dh + 1) / 7)), lh = Math.floor((dh + 1) / nl), fh = Math.max(3, lh - 1);
    const HU = [190, 320], spd = PW / 3.2;
    // 產生、移動封包
    for (let p = 0; p < 2; p++) {
      const L = D.pk[p];
      for (let ln = 0; ln < nl; ln++) {
        let near = false; for (const q of L) if (q.ln === ln && q.x < 3) near = true;
        if (!near && Math.random() < dt * 2.2) { const w = rint(10, Math.max(11, Math.min(26, Math.floor(PW / 4)))); D.seq[p] += rint(512, 1460); L.push({ ln, x: -w - rint(0, 4), w, seq: D.seq[p], len: rint(64, 1460), sp: spd * rnd(0.9, 1.1) }); }
      }
      for (let k = L.length - 1; k >= 0; k--) {
        const q = L[k]; q.x += q.sp * dt;
        if (q.x > PW) { D.bytes[p] += q.len; D.ack[1 - p].push({ x: -9, seq: q.seq + q.len, sp: spd * 1.7 }); D.fl[1 - p] = 0.5; kill(L, k); }
      }
      const A = D.ack[p];
      for (let k = A.length - 1; k >= 0; k--) { A[k].x += A[k].sp * dt; if (A[k].x > PW + 10) { D.fl[p] = 0.5; kill(A, k); } }
      D.fl[p] = Math.max(0, D.fl[p] - dt);
    }
    D.racc += dt;
    if (D.racc >= 0.25) { D.racc -= 0.25; for (let p = 0; p < 2; p++) { const prev = D.rate[p][(D.rh + 119) % 120]; D.rate[p][D.rh % 120] = prev * 0.6 + (D.bytes[p] / 0.25 * 0.6 / nl) * 0.4; D.bytes[p] = 0; } D.rh++; }
    // 管壁
    const wallC = f.C(0.28);
    for (let p = 0; p < 2; p++) {
      const y0 = PY[p];
      for (let x = px0; x <= px1; x++) { g.set(x, y0, '▄', wallC); g.set(x, y0 + ph - 1, '▀', wallC); }
      for (let x = px0 + ((Math.floor(t * 6) * (p ? -1 : 1)) % 10 + 10) % 10; x <= px1; x += 10) g.set(x, y0, p ? '◂' : '▸', f.H(HU[p], 0.45));
    }
    // 封包框（左右裁切在管子範圍內）
    const setC = (x, y, c, col) => { if (x >= px0 && x <= px1) g.set(x, y, c, col); };
    for (let p = 0; p < 2; p++) {
      for (const q of D.pk[p]) {
        const xl = p ? px1 - Math.round(q.x) - q.w + 1 : px0 + Math.round(q.x), y0 = PY[p] + 1 + q.ln * lh, bc = f.H(HU[p], 0.55);
        for (let x = 0; x < q.w; x++) { const c = x === 0 ? '┌' : x === q.w - 1 ? '┐' : '─', c2 = x === 0 ? '└' : x === q.w - 1 ? '┘' : '─'; setC(xl + x, y0, c, bc); setC(xl + x, y0 + fh - 1, c2, bc); }
        for (let r = 1; r < fh - 1; r++) {
          setC(xl, y0 + r, '│', bc); setC(xl + q.w - 1, y0 + r, '│', bc);
          const txt = r === 1 ? 'SEQ ' + q.seq : r === 2 ? 'LEN ' + q.len : (() => { let h = ''; for (let k = 0; k < 8; k++) h += hx(mix32(q.seq * 31 + r * 7 + k) & 255, 2); return h; })();
          for (let k = 0; k < q.w - 3 && k < txt.length; k++) setC(xl + 1 + k + (r > 2 ? 0 : 0), y0 + r, txt[k], r <= 2 ? f.C(0.85) : f.C(0.35));
          if (r === 1) setC(xl + q.w - 2, y0 + r, p ? '◂' : '▸', f.H(HU[p], 0.8));
        }
      }
      // ACK 小訊號：在對向管子的最下面一條跑道
      const ay = PY[p] + ph - 2;
      for (const a of D.ack[p]) { const lab = (p ? '◂' : '▸') + 'ACK ' + (a.seq % 100000), x0 = p ? px1 - Math.round(a.x) - lab.length + 1 : px0 + Math.round(a.x); for (let k = 0; k < lab.length; k++) setC(x0 + k, ay, lab[k], f.H(55, 0.75)); }
    }
    // 兩端的節點面板
    const nodes = [['NODE A', '10.0.3.7', 0], ['NODE B', '10.0.9.12', 1]];
    for (const [nm, ipS, side] of nodes) {
      const x0 = side ? cols - ew : 0, w = ew, txP = side, rxP = 1 - side, fl = D.fl[side] > 0;
      box(g, x0, 0, w, rows - 1, fl ? f.H(55, 0.5) : f.C(0.35), nm, f.C(0.9), 1);
      put(g, x0 + 2, 1, ipS, f.C(0.55), x0 + w - 1);
      const gh = Math.max(2, Math.floor((rows - 10) / 2)), gw = w - 4;
      [[txP, 'TX', 3], [rxP, 'RX', 3 + gh + 2]].forEach(([pp, lab, yy]) => {
        const R = D.rate[pp], cur = R[(D.rh + 119) % 120];
        let mx = 600; for (let k = 0; k < 120; k++) mx = Math.max(mx, R[k]);
        put(g, x0 + 2, yy, lab + ' ' + pad(Math.round(cur), 4) + ' Mb/s', f.H(HU[pp], 0.7), x0 + w - 1);
        for (let k = 0; k < gw; k++) {
          const v = (R[(D.rh - gw + k + 1200) % 120] / mx) * gh, full = Math.floor(v), part = Math.floor((v - full) * 8);
          for (let j = 0; j < gh; j++) { const y = yy + gh - j; if (j < full) g.set(x0 + 2 + k, y, '█', f.H(HU[pp], 0.25 + 0.3 * (j / gh))); else if (j === full && part) g.set(x0 + 2 + k, y, VEIGHT[part], f.H(HU[pp], 0.4)); }
        }
      });
      put(g, x0 + 2, rows - 3, 'RTT ' + (22 + Math.round(4 * Math.sin(t * 0.7 + side))) + ' ms', f.C(0.6), x0 + w - 1);
    }
    // 中間資訊列與管子標籤
    const inF = D.pk[0].length + D.pk[1].length, info = 'TCP :443 ⇄ :51820 · window 64 KB · in flight ' + inF + ' · acks ' + (D.ack[0].length + D.ack[1].length);
    put(g, Math.max(px0, Math.floor((cols - strW(info)) / 2)), PY[1] - Math.ceil(gp / 2), info, f.C(0.6), px1);
    put(g, px0, 1, 'TX ▶ A → B', f.H(HU[0], 0.7)); put(g, px1 - 10, PY[1] + ph, 'B → A ◀ RX', f.H(HU[1], 0.7));
  },
  cItem(s, f, init) {
    const { cols, rows } = f, a = rnd(0, TAU), side = Math.random();
    // 起點：畫面左、上、下邊緣
    let x0, y0;
    if (side < 0.5) { x0 = rnd(-2, 2); y0 = rnd(0, rows); } else if (side < 0.75) { x0 = rnd(0, s.vx); y0 = -1; } else { x0 = rnd(0, s.vx); y0 = rows; }
    return { x0, y0, u: init ? rnd(0, 1) : 0, v: rnd(0.12, 0.3), c: pick(B64 + '01') };
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, p, aspect } = f, ch = g.ch, co = g.co, m = p.mode, L = s.L;
    const drawLane = (ln, y, x0, x1, bright, dir) => {
      if (y < 0 || y >= rows) return;
      ln.o += ln.v * dt;
      const off = Math.floor(ln.o), r = y * cols;
      for (let x = x0; x < x1; x++) {
        const k = (((x - off) % L) + L) % L, I = ln.I[k];
        if (I <= 0) continue;
        const c = ln.s[k]; if (c === ' ') continue;
        ch[r + x] = c; co[r + x] = bright(I, x, ln);
      }
      // 偶爾換掉一些字，看起來資料一直在變
      for (let q = 0; q < 3; q++) { const k = rint(0, L - 1); if (ln.s[k] !== ' ') ln.s[k] = ln.kind === 'bin' ? (Math.random() < 0.5 ? '0' : '1') : ln.kind === 'hex' ? HX[rint(0, 15)] : B64[rint(0, 63)]; }
    };
    if (m === 'bin' || m === 'hex') {
      const x0 = m === 'hex' && cols >= 60 ? 7 : 0;
      for (const ln of s.lanes) {
        drawLane(ln, ln.y, x0, cols, I => f.C(0.15 + 0.85 * I * (0.6 + 0.4 * Math.min(1, ln.v / 30))));
        if (x0) put(g, 0, ln.y, ln.lab.padEnd(6).slice(0, 6), f.C(0.5));
      }
      if (x0) for (let y = 1; y < rows; y += 2) for (let x = x0; x < cols; x += 4) if (ch[y * cols + x] === ' ') g.set(x, y, '·', f.C(0.08));
      return;
    }
    if (m === 'parallax') {
      for (const ln of s.lanes) drawLane(ln, ln.y, 0, cols, I => f.C([0.08, 0.25, 0.45][ln.layer] + [0.2, 0.4, 0.55][ln.layer] * I));
      return;
    }
    if (m === 'duplex') return this.duplex(s, f);
    if (m === 'wave') {
      for (const rb of s.rb) {
        rb.ln.forEach((ln, j) => {
          ln.o += ln.v * dt;
          const off = Math.floor(ln.o);
          for (let x = 0; x < cols; x++) {
            const y = Math.round(rb.y0 + rb.A * Math.sin(x * rb.kx + t * rb.w + rb.ph) + (j - rb.ln.length / 2) * (0.8 + 0.5 * Math.sin(x * rb.kx * 0.7 + t * 0.6 + rb.ph)));
            if (y < 0 || y >= rows) continue;
            const k = (((x - off) % L) + L) % L, I = ln.I[k];
            if (I <= 0.05) continue;
            const i = y * cols + x;
            ch[i] = ln.s[k]; co[i] = f.C(0.12 + 0.8 * I * (0.55 + 0.45 * Math.sin(x * 0.05 + rb.ph)));
          }
        });
      }
      return;
    }
    if (m === 'converge') {
      const vx = s.vx, vy = s.vy;
      for (let k = 0; k < s.items.length; k++) {
        const q = s.items[k];
        q.u += q.v * dt * (0.4 + q.u);
        if (q.u >= 1) { s.items[k] = this.cItem(s, f, false); continue; }
        const e = q.u * q.u, x = q.x0 + (vx - q.x0) * e, y = q.y0 + (vy - q.y0) * e;
        const xi = Math.round(x), yi = Math.round(y);
        for (let j = 1; j <= 3; j++) {
          const u2 = Math.max(0, q.u - j * 0.025), e2 = u2 * u2, tx2 = Math.round(q.x0 + (vx - q.x0) * e2), ty2 = Math.round(q.y0 + (vy - q.y0) * e2);
          if ((tx2 !== xi || ty2 !== yi) && tx2 >= 0 && ty2 >= 0 && tx2 < cols && ty2 < rows && ch[ty2 * cols + tx2] === ' ') { ch[ty2 * cols + tx2] = '·'; co[ty2 * cols + tx2] = f.C((0.1 + 0.5 * q.u) * (1 - j * 0.25)); }
        }
        if (xi < 0 || yi < 0 || xi >= cols || yi >= rows) continue;
        const i = yi * cols + xi;
        ch[i] = q.u > 0.85 ? '·' : q.u > 0.6 ? (q.c === '0' || q.c === '1' ? q.c : '•') : q.c; co[i] = f.C(0.15 + 0.85 * Math.min(1, q.u * 1.3));
      }
      // 核心
      const R = Math.min(cols, rows * aspect) * 0.11 * (1 + 0.08 * Math.sin(t * 3));
      for (let y = Math.floor(vy - R / aspect) - 1; y <= vy + R / aspect + 1; y++) for (let x = Math.floor(vx - R) - 1; x <= vx + R + 1; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const d = Math.hypot(x - vx, (y - vy) * aspect) / R;
        if (d < 1) { const i = y * cols + x; ch[i] = d < 0.35 ? '█' : d < 0.6 ? '▓' : d < 0.8 ? '▒' : '░'; co[i] = f.C(1 - d * 0.6); }
        else if (d < 1.15 && (Math.atan2(y - vy, x - vx) * 6 + t * 3) % TAU < 2) g.set(x, y, '·', f.C(0.6));
      }
      put(g, Math.round(vx - 4), Math.min(rows - 1, Math.round(vy + R / aspect + 2)), 'INGEST', f.C(0.7));
      return;
    }
    if (m === 'packets') {
      const PH = [190, 120, 280, 50, 0, 320];
      for (const tk of s.tracks) {
        for (let x = 0; x < cols; x++) { if (tk.y === 1) g.set(x, 0, '─', f.C(0.14)); g.set(x, tk.y + 2, (x + Math.floor(t * tk.v)) % 8 === 0 ? '┴' : '─', f.C(0.14)); }
        for (const q of tk.pk) {
          q.x += tk.v * dt;
          if (tk.v > 0 && q.x > cols + 2) { let mn = 1e9; for (const b2 of tk.pk) mn = Math.min(mn, b2.x); q.x = Math.min(-q.len - 2, mn - q.len - rint(3, 18)); }
          if (tk.v < 0 && q.x + q.len < -2) { let mx = -1e9; for (const b2 of tk.pk) mx = Math.max(mx, b2.x + b2.len); q.x = Math.max(cols + 2, mx + rint(3, 18)); }
          const x0 = Math.round(q.x), hue = PH[q.hue];
          for (let k = 0; k < q.len; k++) {
            const x = x0 + k; if (x < 0 || x >= cols) continue;
            const hdr = k < 6;
            g.set(x, tk.y, hdr ? '█' : '▒', hdr ? f.H(hue, 0.45) : f.H(hue, 0.25));
            g.set(x, tk.y + 1, k < q.data.length ? q.data[k] : ' ', f.C(hdr ? 0.3 : 0.55));
          }
          if (x0 + 1 >= 0 && x0 + 5 < cols) put(g, x0 + 1, tk.y, q.pr.padEnd(4).slice(0, 4), f.C(1));
          if (x0 + 7 >= 0 && x0 + 12 < cols && q.len > 13) put(g, x0 + 7, tk.y, '#' + q.id, f.C(0.85));
          g.set(x0 + (tk.v > 0 ? q.len : -1), tk.y, tk.v > 0 ? '▶' : '◀', f.H(hue, 0.6));
        }
      }
      return;
    }
    if (m === 'dots') {
      const b = s.b, W = cols * 2, Hh = rows * 4;
      bclr(b);
      for (let y = 0; y < Hh; y++) s.vr[y] = 30 + 40 * (0.5 + 0.5 * Math.sin(y * 0.05 + t * 0.7)) + 25 * Noise.n3(y * 0.02, t * 0.2);
      for (const q of s.P) {
        const y = q[1], v = s.vr[y | 0];
        q[0] += v * q[2] * dt;
        if (q[0] >= W) { q[0] -= W; q[1] = rnd(0, Hh); }
        const bright = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(q[0] * 0.02 - t * 2 + y * 0.03));
        bdot(b, q[0], q[1], bright * q[2] * 0.66, 0);
        bdot(b, q[0] - 1, q[1], bright * q[2] * 0.3, 0);
      }
      bflush(g, b, v => f.C(0.15 + 0.85 * Math.min(1, v)));
    }
  },
});

/* ═════════ 10. 訊號干擾 ═════════ */
// 暫存畫面：co 存的是亮度數字（0–1），最後才換成顏色
function mkBuf(cols, rows) {
  const n = cols * rows;
  return { cols, rows, n, ch: new Array(n).fill(' '), co: new Array(n).fill(0), set(x, y, c, v) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= cols || y >= rows) return; const i = y * cols + x; this.ch[i] = c; this.co[i] = v; } };
}
const hueOnF = f => f.H(0, 0.6) !== f.H(120, 0.6);
const GLY = '▓▒░█#%&@$?¤§╳◆▚▞';
A({ id: 'te-glitch', name: '訊號干擾', cat: '科技', theme: 'cyber', desc: '桌面畫面不時被切片、錯位與雜訊撕裂',
  params: { mode: 'blocks', scene: 'desk' },
  variants: [
    { id: 'rgb', name: '色偏', theme: 'rainbow', hue: true, desc: '紅綠藍三色分離錯開又合回', params: { mode: 'rgb' } },
    { id: 'snow', name: '雪花雜訊', theme: 'mono', desc: '訊號時強時弱，畫面在雪花中浮現', params: { mode: 'snow', scene: 'tv' } },
    { id: 'vhs', name: '錄影帶', theme: 'sunset', desc: '追蹤雜訊帶、畫面晃動與螢幕顯示', params: { mode: 'vhs', scene: 'tv' } },
    { id: 'melt', name: '融化', theme: 'synth', desc: '畫面一欄欄往下滴落又縮回', params: { mode: 'melt' } },
    { id: 'rot', name: '資料毀損', theme: 'amber', desc: '文件被亂碼侵蝕，掃描線再把它修好', params: { mode: 'rot', scene: 'doc' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.sb = mkBuf(cols, rows);
    s.log = logState('boot', 5); s.log.kn = 0; s.log.un = 1e9;
    for (let k = 0; k < rows; k++) logPush(s.log, LOGGEN.boot(s.log), rows + 4);
    s.burst = 0; s.next = rnd(0.3, 1.2); s.sl = [];
    s.rot = new Float32Array(cols * rows); s.rotY = -1; s.rotT = 0;
    s.bx = rnd(0, cols * 0.5); s.by = rnd(0, rows * 0.5); s.vx = cols * 0.09; s.vy = rows * 0.11; s.hue = 190;
    s.drip = new Float32Array(cols); s.dy = new Float32Array(cols);
    for (let x = 0; x < cols; x++) s.dy[x] = rows * (0.15 + 0.5 * Math.abs(Noise.n3(Math.floor(x / 6) * 0.7, 2.2)));
    if (p.scene === 'doc') {
      const W2 = []; while (W2.length < 400) W2.push(pick(WORDS.concat(['the', 'of', 'data', 'signal', 'and', 'to', 'system', 'record', 'block', 'error', 'a', 'in', 'value', 'sector', 'header'])));
      s.words = W2;
    }
  },
  scene(s, f) {
    const { cols, rows, t, dt, p } = f, sb = s.sb;
    sb.ch.fill(' '); sb.co.fill(0);
    if (p.scene === 'none') return;
    if (p.scene === 'doc') {
      // 文件：標題、段落
      let y = 1, wi = 0;
      put(sb, 3, y, 'INCIDENT REPORT  ·  ARCHIVE 0x' + hx(Math.floor(t / 20) * 7919 + 4096, 6), 0.95); y += 2;
      while (y < rows - 2) {
        if (y % 9 === 3) { put(sb, 3, y, '§ ' + (1 + Math.floor(y / 9)) + '. ' + s.words[(y * 7) % 400].toUpperCase() + ' ' + s.words[(y * 13) % 400].toUpperCase(), 0.85); y += 2; continue; }
        let x = 3;
        while (x < cols - 4) { const w = s.words[wi++ % 400]; if (x + w.length >= cols - 4) break; put(sb, x, y, w, 0.55); x += w.length + 1; }
        y++;
      }
      return;
    }
    if (p.scene === 'tv') {
      // 電視節目：天空漸層、山、太陽、台標與字幕
      const hz = Math.floor(rows * 0.62);
      for (let y = 0; y < hz; y++) for (let x = 0; x < cols; x++) { const v = 0.15 + 0.35 * (y / hz); if ((x + y) % 2 === 0) sb.set(x, y, y > hz * 0.6 ? '░' : '·', v); }
      const sx = cols * 0.68, sy = hz * 0.45, R = Math.min(cols, rows * 2) * 0.12;
      for (let y = Math.floor(sy - R); y <= sy + R; y++) for (let x = Math.floor(sx - R * 2); x <= sx + R * 2; x++) { const d = Math.hypot((x - sx) / 2, y - sy) / R; if (d < 1) sb.set(x, y, d < 0.7 ? '█' : '▓', 0.95 - d * 0.3); }
      for (let x = 0; x < cols; x++) { const h = Math.floor(hz - rows * 0.2 * (0.5 + 0.5 * Noise.n3(x * 0.03, 1.1))); for (let y = h; y < rows; y++) sb.set(x, y, y < hz ? '▓' : (x + y) % 3 ? '▒' : '░', y < hz ? 0.4 : 0.25 + 0.1 * Math.sin(x * 0.3 + y + t)); }
      put(sb, cols - 10, 1, 'TE 07', 0.9);
      const cap = tr(f, '  晚間新聞 · 今日天氣晴朗 · 明天午後有雷陣雨  ', '  Evening News · Sunny today · Thunderstorms likely tomorrow afternoon  '), cw = strW(cap), off = Math.floor(t * 8) % (cw + cols);
      for (let x = 0; x < cols; x++) sb.set(x, rows - 3, '▁', 0.3);
      put(sb, cols - off, rows - 2, cap, 0.9);
      return;
    }
    // 桌面：背景紋路＋幾個視窗
    for (let y = 0; y < rows; y += 2) for (let x = (y * 2) % 8; x < cols; x += 8) sb.set(x, y, '·', 0.1);
    const w1 = Math.floor(cols * 0.46), h1 = Math.floor(rows * 0.62);
    const win = (x, y, w, h, title) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) sb.set(xx, yy, ' ', 0); box(sb, x, y, w, h, 0.5, title, 0.9, 1); };
    win(2, 1, w1, h1, 'system.log');
    if (Math.random() < dt * 4) logPush(s.log, LOGGEN.boot(s.log), rows + 4);
    const L = s.log.lines, nl = Math.min(h1 - 2, L.length);
    for (let k = 0; k < nl; k++) { let x = 4; for (const sg of L[L.length - nl + k]) x = put(sb, x, 2 + k, sg[0], sg[1] === 3 ? 0.9 : sg[1] === 2 ? 0.8 : 0.5, 2 + w1 - 2); }
    const x2 = w1 + 4, w2 = cols - x2 - 2, h2 = Math.floor(rows * 0.34);
    win(x2, 1, w2, h2, 'monitor');
    for (let k = 0; k < Math.min(6, h2 - 2); k++) { const v = 0.5 + 0.45 * Math.sin(t * (0.7 + k * 0.3) + k); put(sb, x2 + 2, 2 + k, ['cpu', 'mem', 'gpu', 'net', 'disk', 'fan'][k], 0.6); hbar(sb, x2 + 7, 2 + k, Math.max(4, w2 - 16), v, 0.85, 0.2, '░'); put(sb, x2 + w2 - 7, 2 + k, pad(Math.round(v * 100), 3) + '%', 0.7); }
    const y3 = h2 + 2, h3 = rows - y3 - 2;
    win(x2, y3, w2, h3, 'clock');
    const clk = fmtT(43200 + t), sxk = bigW(clk, 3) <= w2 - 4 && h3 >= 13 ? 3 : bigW(clk, 2) <= w2 - 4 && h3 >= 8 ? 2 : 1;
    big(sb, x2 + Math.max(1, Math.floor((w2 - bigW(clk, sxk)) / 2)), y3 + Math.max(1, Math.floor((h3 - 5 * Math.ceil(sxk / 1.5)) / 2)), clk, sxk, Math.max(1, Math.ceil(sxk / 1.5)), 0.95);
    const y4 = h1 + 2, h4 = rows - y4 - 1;
    win(2, y4, w1, h4, 'notes.txt');
    const notes = ['- backup runs at 03:00', '- cert expires next month', '- new dashboard is live', '- clean up /tmp on node-07', '- rotate api keys (q4)', '- order 2 spare ssds'];
    for (let k = 0; k < Math.min(notes.length, h4 - 2); k++) put(sb, 4, y4 + 1 + k, notes[k], 0.6, 2 + w1 - 2);
  },
  frame(s, f) {
    this.fx(s, f);
    // 全形字的右半格一定要留空，避免被雜訊字蓋住
    const ch = f.g.ch, n = f.cols * f.rows;
    for (let i = 0; i < n - 1; i++) { const c = ch[i]; if (c.charCodeAt(0) >= 0x2e80 && wideC(c) && (i + 1) % f.cols) ch[i + 1] = ' '; }
  },
  fx(s, f) {
    const { g, cols, rows, dt, t, p } = f, sb = s.sb, ch = g.ch, co = g.co, n = cols * rows;
    this.scene(s, f);
    const m = p.mode;
    const copy = (rowOff, ivMul) => {
      for (let y = 0; y < rows; y++) {
        const off = rowOff ? rowOff[y] : 0, r = y * cols, mul = ivMul ? ivMul[y] : 1;
        for (let x = 0; x < cols; x++) { const sx = x - off; if (sx < 0 || sx >= cols) continue; const c = sb.ch[r + sx]; if (c === ' ') continue; ch[r + x] = c; co[r + x] = f.C(sb.co[r + sx] * mul); }
      }
    };
    if (m === 'blocks') {
      // 撕裂只在一陣干擾的開頭與中段各換一次形狀（不做高頻閃爍）
      const mkSl = () => { s.sl = []; for (let k = 0; k < rint(2, 6); k++) s.sl.push({ y: rint(0, rows - 1), h: rint(1, Math.max(2, rows / 7)), dx: rint(-cols / 5, cols / 5), x0: rint(0, cols - 10), w: rint(8, cols / 2.5), g: Math.random() < 0.4, seed: rint(0, 99999) }); };
      s.next -= dt;
      if (s.next <= 0 && s.burst <= 0) { s.burst = rnd(0.25, 0.7); s.next = rnd(1.0, 2.8); s.half = s.burst / 2; mkSl(); }
      if (s.burst > 0) {
        s.burst -= dt;
        if (s.half > 0 && s.burst < s.half) { s.half = 0; mkSl(); }
        if (s.burst <= 0) s.sl = [];
      } else s.sl = Math.random() < dt * 1.5 ? [{ y: rint(0, rows - 1), h: 1, dx: rint(-6, 6), x0: 0, w: cols, g: false, seed: 0 }] : [];
      copy();
      for (const q of s.sl) for (let y = q.y; y < Math.min(rows, q.y + q.h); y++) for (let x = q.x0; x < Math.min(cols, q.x0 + q.w); x++) {
        const sx = x - q.dx, i = y * cols + x;
        if (sx < 0 || sx >= cols) { ch[i] = ' '; continue; }
        const c = sb.ch[y * cols + sx];
        const hh = q.g ? hash2(x + q.seed, y) : 0;
        if (q.g && hh % 10 < 3) { ch[i] = GLY[(hh >>> 4) % GLY.length]; co[i] = f.C(0.4 + 0.4 * (((hh >>> 9) & 7) / 7)); }
        else { ch[i] = c; co[i] = f.C(Math.min(1, sb.co[y * cols + sx] * 1.1 + 0.05)); }
      }
      return;
    }
    if (m === 'scan') {
      const off = new Int16Array(rows), mul = new Float32Array(rows);
      const roll = ((t * 4) % (rows + 20)) - 10;
      for (let y = 0; y < rows; y++) {
        off[y] = Math.round(Math.sin(y * 0.35 + t * 7) * 0.7 + (Math.abs(y - roll) < 3 ? Math.sin(t * 40 + y) * 2 : 0));
        mul[y] = (y % 2 ? 0.72 : 1) * (1 + 0.5 * Math.max(0, 1 - Math.abs(y - roll) / 4));
      }
      copy(off, mul);
      for (let x = 0; x < cols; x++) { const y = Math.round(roll); if (y >= 0 && y < rows && ch[y * cols + x] === ' ') { ch[y * cols + x] = '─'; co[y * cols + x] = f.C(0.25); } }
      return;
    }
    if (m === 'rgb') {
      const hue = hueOnF(f), burst = Math.max(0, Math.sin(t * 0.9)) ** 8;
      const dr = Math.round(1 + 2 * Math.sin(t * 1.3) + burst * 6), db = Math.round(1 + 2 * Math.sin(t * 1.1 + 2) + burst * 5), dyr = burst > 0.5 ? 1 : 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x, yr = clamp(y - dyr, 0, rows - 1);
        const ir = yr * cols + clamp(x + dr, 0, cols - 1), ib = y * cols + clamp(x - db, 0, cols - 1);
        const R = sb.ch[ir] !== ' ' ? sb.co[ir] : 0, G = sb.ch[i] !== ' ' ? sb.co[i] : 0, B = sb.ch[ib] !== ' ' ? sb.co[ib] : 0;
        if (!R && !G && !B) continue;
        const cc = G ? sb.ch[i] : R ? sb.ch[ir] : sb.ch[ib];
        ch[i] = !G && wideC(cc) ? '▒' : cc;
        co[i] = hue ? rgb(255 * R, 255 * G, 255 * B) : f.C(Math.max(R, G, B) * (G ? 1 : 0.6));
      }
      return;
    }
    if (m === 'snow') {
      const sig = clamp(0.5 + 0.55 * Math.sin(t * 0.35) + 0.15 * Math.sin(t * 1.7), 0, 1);
      // 雜訊每秒只換 12 次（用雜湊，不用每格每幀的亂數），畫面依訊號強度整體淡入淡出，不會全螢幕狂閃
      const q = Math.floor(t * 12), cover = (1 - sig) * 0.35, dens = 0.5 * (1 - sig * 0.6), sv = 0.15 + 0.85 * sig;
      for (let i = 0; i < n; i++) {
        const h = hash2(i, q), r1 = (h & 1023) / 1024, r2 = ((h >>> 10) & 1023) / 1024;
        if (sb.ch[i] !== ' ' && r1 >= cover) { ch[i] = sb.ch[i]; co[i] = f.C(sb.co[i] * sv); continue; }
        if (r2 < dens) { const v = (h >>> 20) & 3; ch[i] = v < 2 ? '·' : v < 3 ? '░' : '▒'; co[i] = f.C(0.1 + 0.18 * (((h >>> 23) & 7) / 7)); }
      }
      const tag = sig < 0.35 ? tr(f, ' 訊號微弱 ', ' WEAK SIGNAL ') : ' CH 07 ';
      put(g, 3, 1, tag, f.C(0.9));
      hbar(g, 3, 2, 12, sig, f.C(0.8), f.C(0.2), '░');
      return;
    }
    if (m === 'vhs') {
      const off = new Int16Array(rows), band = rows - ((t * 3.2) % (rows + 14));
      for (let y = 0; y < rows; y++) off[y] = Math.round(Math.sin(y * 0.15 + t * 1.3) * 0.8 + (Math.abs(y - band) < 2.5 ? Math.sin(t * 30 + y * 3) * 4 : 0));
      copy(off);
      // 色彩暈開
      for (let i = n - 1; i > 0; i--) if (ch[i] === ' ' && ch[i - 1] !== ' ' && (i % cols)) { ch[i] = '░'; co[i] = f.C(0.25); }
      for (let y = Math.floor(band - 2); y <= band + 2; y++) { if (y < 0 || y >= rows) continue; for (let x = 0; x < cols; x++) if (Math.random() < 0.35) { ch[y * cols + x] = pick('▔▀▄_-─━'); co[y * cols + x] = f.C(0.5 + 0.5 * Math.random()); } }
      for (let y = rows - 2; y < rows; y++) for (let x = 0; x < cols; x++) if (Math.random() < 0.2) { ch[y * cols + x] = pick('_-~'); co[y * cols + x] = f.C(0.6); }
      if (Math.floor(t) % 2 === 0) put(g, 3, 1, 'PLAY ▶', f.C(1));
      put(g, cols - 18, rows - 4, 'SP  ' + fmtT(754 + t).slice(1), f.C(1));
      return;
    }
    if (m === 'melt') {
      for (let x = 0; x < cols; x++) { const tgt = Math.max(0, Noise.n3(Math.floor(x / 3) * 0.37, t * 0.25) * 1.6 - 0.3) * rows * 0.45; s.drip[x] += (tgt - s.drip[x]) * Math.min(1, dt * 3); }
      for (let x = 0; x < cols; x++) {
        const d = Math.floor(s.drip[x]), ys = Math.floor(s.dy[x]);
        let lastC = ' ', lastV = 0;
        for (let y = 0; y < rows; y++) {
          let sy = y;
          if (y >= ys + d) sy = y - d; else if (y >= ys) sy = -1;
          const i = y * cols + x;
          if (sy === -1) {
            // 拉長的條紋
            if (lastC !== ' ') { ch[i] = (y - ys) % 2 ? '│' : '┃'; co[i] = f.C(lastV * (1 - (y - ys) / (d + 1) * 0.6)); }
            continue;
          }
          const si = sy * cols + x, c = sb.ch[si];
          if (c !== ' ') { lastC = c; lastV = sb.co[si]; ch[i] = c; co[i] = f.C(sb.co[si]); }
          else if (y < ys) { lastC = ' '; }
        }
      }
      return;
    }
    if (m === 'rot') {
      const R = s.rot;
      s.rotT += dt;
      // 隨機長出毀損點，並向鄰居擴散
      for (let k = 0; k < Math.ceil(n * dt * 0.004); k++) R[rint(0, n - 1)] = 1;
      for (let k = 0; k < n * dt * 0.12; k++) { const i = rint(cols, n - cols - 1); if (R[i] > 0.5) { const j = i + pick([1, -1, cols, -cols]); if (R[j] < 0.5) R[j] = 1; } }
      if (s.rotT > 9) { s.rotY += dt * rows * 0.5; if (s.rotY > rows + 2) { s.rotY = -1; s.rotT = 0; } }
      const ry = Math.floor(s.rotY);
      let bad = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (s.rotY >= 0 && y <= ry) R[i] = 0;
        const c = sb.ch[i];
        if (R[i] > 0.5) { bad++; if (c !== ' ' || Math.random() < 0.3) { ch[i] = GLY[(i * 7 + Math.floor(t * 6)) % GLY.length]; co[i] = f.C(0.35 + 0.4 * ((i * 13 + Math.floor(t * 9)) % 7) / 7); } }
        else if (c !== ' ') { ch[i] = c; co[i] = f.C(sb.co[i]); }
      }
      if (s.rotY >= 0 && ry < rows) for (let x = 0; x < cols; x++) { ch[ry * cols + x] = '▀'; co[ry * cols + x] = f.C(1); }
      fillR(g, 0, rows - 1, cols, 1, ' ', f.C(0.5));
      put(g, 1, rows - 1, s.rotY >= 0 ? tr(f, ' 修復中 … 校驗 ', ' Repairing … verified ') + Math.floor(clamp(s.rotY / rows, 0, 1) * 100) + '%' : ' CRC ERROR · ' + bad + ' cells corrupted · sector 0x' + hx(bad * 37, 6), f.C(0.85));
      return;
    }
    if (m === 'nosig') {
      for (let k = 0; k < n * 0.01; k++) { const i = rint(0, n - 1); ch[i] = '·'; co[i] = f.C(0.12); }
      const big2 = cols >= 160, txt = 'NO SIGNAL', bw = big2 ? bigW(txt, 2) + 6 : txt.length + 6, bh = big2 ? 9 : 5;
      s.bx += s.vx * dt; s.by += s.vy * dt;
      let hit = false;
      if (s.bx < 0) { s.bx = 0; s.vx = Math.abs(s.vx); hit = true; } if (s.bx + bw > cols) { s.bx = cols - bw; s.vx = -Math.abs(s.vx); hit = true; }
      if (s.by < 0) { s.by = 0; s.vy = Math.abs(s.vy); hit = true; } if (s.by + bh > rows) { s.by = rows - bh; s.vy = -Math.abs(s.vy); hit = true; }
      if (hit) s.hue = (s.hue + 67) % 360;
      const col = f.H(s.hue, 0.6), x0 = Math.round(s.bx), y0 = Math.round(s.by);
      clearR(g, x0, y0, bw, bh);
      box(g, x0, y0, bw, bh, col, null, null, 2);
      if (big2) big(g, x0 + 3, y0 + 2, txt, 2, 1, col); else put(g, x0 + 3, y0 + 2, txt, col);
      const sub = big2 ? tr(f, '輸入 1 · 請檢查連接線', 'Input 1 · Check the cable') : tr(f, '輸入 1', 'Input 1');
      put(g, x0 + Math.floor((bw - strW(sub)) / 2), y0 + bh - 2, sub, f.C(0.7));
      return;
    }
  },
});

/* ═════════ 11. 測試畫面 ═════════ */
const BARS7 = [[-1, 0.78], [60, 0.55], [180, 0.5], [120, 0.42], [300, 0.45], [0, 0.45], [240, 0.42]];
A({ id: 'te-testcard', name: '測試畫面', cat: '科技', theme: 'mono', hue: true, desc: '電視彩條、時間碼與底部跑馬燈',
  params: { mode: 'bars' },
  variants: [
    { id: 'card', name: '圓形測試卡', theme: 'lavender', desc: '方格背景上的大圓與各種測試區塊', params: { mode: 'card' } },
    { id: 'grey', name: '灰階', theme: 'blueprint', desc: '灰階階梯、漸層與移動的亮度探針', params: { mode: 'grey' } },
    { id: 'grid', name: '會聚格', theme: 'ice', desc: '十字格線與到處移動的對準游標', params: { mode: 'grid' } },
    { id: 'burst', name: '多頻條紋', theme: 'amber', desc: '由粗到細的頻率條紋與掃頻線', params: { mode: 'burst' } },
    { id: 'wheel', name: '色輪', theme: 'rainbow', desc: '緩緩旋轉的色相環與刻度', params: { mode: 'wheel' } },
    { id: 'standby', name: '收播', desc: '同心圓台標、走秒時鐘與「請稍候」倒數', params: { mode: 'standby' } },
    { id: 'zone', name: '波帶片', theme: 'paper', hue: false, desc: '同心波紋越往外越密，產生疊紋', params: { mode: 'zone' } },
  ],
  init(s, f) { s.cd = 300; },
  bar(f, k, dim) { const b = BARS7[k], l = b[1] * (dim || 1); return b[0] < 0 ? f.C(l) : f.H(b[0], l); },
  ticker(g, f, y, txt, sp, col) {
    const { cols, t } = f, w = strW(txt), off = Math.floor(t * sp) % (w + cols);
    clearR(g, 0, y, cols, 1);
    put(g, cols - off, y, txt, col);
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, p, aspect } = f, ch = g.ch, co = g.co, m = p.mode;
    const fr = Math.floor(t * 30) % 30, tc = fmtT(36000 + t) + ':' + pad0(fr, 2);
    if (m === 'bars') {
      const dim = 1, h1 = Math.floor(rows * 0.62), h2 = Math.floor(rows * 0.08), bw = cols / 7;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const k = Math.min(6, Math.floor(x / bw)), i = y * cols + x;
        let c;
        if (y < h1) c = this.bar(f, k, dim);
        else if (y < h1 + h2) c = k % 2 ? f.C(0.05) : this.bar(f, 6 - k, dim);
        else { const u = x / cols; c = u < 0.14 ? f.H(220, 0.3 * dim) : u < 0.28 ? f.C(0.95 * dim) : u < 0.42 ? f.H(270, 0.3 * dim) : u < 0.7 ? f.C(0.04) : u < 0.76 ? f.C(0.02) : u < 0.82 ? f.C(0.06) : u < 0.88 ? f.C(0.1) : f.C(0.04); }
        ch[i] = '█'; co[i] = c;
      }
        const bwid = Math.max(22, Math.floor(cols * 0.22)), bx = Math.floor((cols - bwid) / 2), by = h1 + h2 + Math.floor((rows - h1 - h2 - 4) / 2);
        clearR(g, bx, by, bwid, 3); box(g, bx, by, bwid, 3, f.C(0.6), null, null, 0);
        put(g, bx + Math.floor((bwid - tc.length - 6) / 2), by + 1, 'TE TV ' + tc, f.C(1));
        const ph = (t * 1000) % 360;
        put(g, cols - 14, 1, '♪ 1 kHz ' + '▁▃▅▇▅▃'[Math.floor(t * 12) % 6], f.C(0.05));
        this.ticker(g, f, rows - 1, tr(f, '  TE 測試訊號 · 本台節目將於 06:00 開始 · 請調整您的電視色彩與亮度 · TEST SIGNAL 1080i 59.94  ', '  TE TEST SIGNAL · Programming begins at 06:00 · Please adjust the color and brightness of your TV · 1080i 59.94  '), 14, f.C(0.9));
      return;
    }
    if (m === 'standby') {
      // 台標畫面：緩緩外擴的同心圓、色調慢慢漂移，中央一座走秒的類比時鐘，下方「請稍候」倒數
      const cx = (cols - 1) / 2, cy = rows * 0.4, hueB = 215 + 35 * Math.sin(t * 0.05);
      for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols; x++) {
        const r = Math.hypot(x - cx, (y - cy) * aspect), v = 0.5 + 0.5 * Math.sin(r * 0.32 - t * 0.9), i = y * cols + x;
        if (v > 0.55) { ch[i] = v > 0.9 ? '▒' : '░'; co[i] = f.H(hueB + r * 0.15, 0.06 + 0.1 * v); }
      }
      const Rc = Math.min(cols * 0.22, rows * aspect * 0.3), b = s.b || (s.b = bnew(cols, rows));
      bclr(b);
      // 錶面：清掉背景、外圈與刻度
      for (let y = Math.floor(cy - Rc / aspect) - 1; y <= cy + Rc / aspect + 1; y++) for (let x = Math.floor(cx - Rc) - 2; x <= cx + Rc + 2; x++) if (x >= 0 && y >= 0 && x < cols && y < rows && Math.hypot(x - cx, (y - cy) * aspect) < Rc + 1.2) { ch[y * cols + x] = ' '; }
      const P = (a, r) => [(cx + Math.sin(a) * r) * 2 + 1, (cy - (Math.cos(a) * r) / aspect) * 4 + 2];
      for (let q = 0; q < 720; q++) { const [x, y] = P((q / 720) * TAU, Rc); bdot(b, x, y, 0.6, 0); }
      for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU, [x1, y1] = P(a, Rc * (k % 5 ? 0.93 : 0.84)), [x2, y2] = P(a, Rc * 0.97); bline(b, x1, y1, x2, y2, k % 5 ? 0.4 : 0.9, 0); }
      const d = new Date(), sec = d.getSeconds() + d.getMilliseconds() / 1000, mn = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + mn / 60;
      for (const [a, len, v, tg] of [[(hr / 12) * TAU, 0.5, 1, 1], [(mn / 60) * TAU, 0.75, 1, 1], [(sec / 60) * TAU, 0.88, 1, 2]]) { const [x0, y0] = P(a + Math.PI, Rc * 0.1), [x1, y1] = P(a, Rc * len); bline(b, x0, y0, x1, y1, v, tg); if (tg === 1) bline(b, x0 + 1, y0, x1 + 1, y1, v, tg); }
      bflush(g, b, (v, tg) => (tg === 2 ? f.H(0, 0.6) : tg === 1 ? f.C(0.95) : f.C(0.35 + 0.5 * v)));
      for (let k = 1; k <= 12; k++) { const a = (k / 12) * TAU, lab = String(k), x = Math.round(cx + Math.sin(a) * Rc * 0.7 - lab.length / 2 + 0.5), y = Math.round(cy - (Math.cos(a) * Rc * 0.7) / aspect); if (Rc > 12) put(g, x, y, lab, f.C(0.75)); }
      g.set(Math.round(cx), Math.round(cy), '●', f.C(1));
      // STAND BY 與倒數
      s.cd -= dt; if (s.cd < 0) s.cd = 300;
      const cdS = '0' + Math.floor(s.cd / 60) + ':' + pad0(Math.floor(s.cd) % 60, 2), by = Math.round(cy + Rc / aspect) + 2;
      if (cols >= 160 && by + 12 < rows) {
        big(g, Math.floor((cols - bigW('STAND BY', 2)) / 2), by, 'STAND BY', 2, 1, f.C(1));
        big(g, Math.floor((cols - bigW(cdS, 2)) / 2), by + 6, cdS, 2, 1, f.H(50, 0.6));
      } else {
        const ln = 'STAND BY  ' + cdS;
        clearR(g, Math.floor((cols - ln.length) / 2) - 1, by, ln.length + 2, 1);
        put(g, Math.floor((cols - ln.length) / 2), by, 'STAND BY', f.C(1)); put(g, Math.floor((cols - ln.length) / 2) + 10, by, cdS, f.H(50, 0.6));
      }
      const msg = tr(f, '節目即將開始 · 請稍候', 'Program starting soon · Please wait'), my = Math.min(rows - 3, cols >= 160 && by + 12 < rows ? by + 12 : by + 1);
      clearR(g, Math.floor((cols - strW(msg)) / 2) - 1, my, strW(msg) + 2, 1);
      put(g, Math.floor((cols - strW(msg)) / 2), my, msg, f.C(0.75));
      this.ticker(g, f, rows - 1, tr(f, '  技術維修中 · 造成不便敬請見諒 · 稍後將恢復正常播出 · PLEASE STAND BY  ', '  Technical difficulties · We apologize for the inconvenience · Regular programming will resume shortly · PLEASE STAND BY  '), 10, f.C(0.8));
      return;
    }
    if (m === 'card') {
      const cx = (cols - 1) / 2, cy = (rows - 1) / 2, R = Math.min(cols * 0.36, rows * aspect * 0.46), gs = Math.max(6, Math.round(cols / 20));
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x, dx = x - cx, dy = (y - cy) * aspect, r = Math.hypot(dx, dy);
        if (r < R) {
          const v = (y - (cy - R / aspect)) / ((2 * R) / aspect);
          let c;
          if (v < 0.22) c = this.bar(f, Math.min(6, Math.floor(((dx / R) * 0.5 + 0.5) * 7)));
          else if (v < 0.4) c = f.C(Math.floor(((dx / R) * 0.5 + 0.5) * 6) / 5);
          else if (v < 0.6) c = Math.abs(dx) < 0.6 || Math.abs(y - cy) < 0.5 ? f.C(1) : f.C(0.3);
          else if (v < 0.78) { const fq = 0.3 + ((dx / R) * 0.5 + 0.5) * 1.6; c = Math.sin(x * fq * 2.2) > 0 ? f.C(0.9) : f.C(0.1); }
          else c = Math.floor(x / 3) % 2 ? f.H(30, 0.5) : f.H(200, 0.45);
          ch[i] = '█'; co[i] = c;
          if (Math.abs(r - R) < 0.8) co[i] = f.C(1);
        } else {
          const onX = x % gs === 0, onY = y % Math.round(gs / aspect) === 0;
          ch[i] = onX && onY ? '┼' : onX ? '│' : onY ? '─' : '█'; co[i] = onX || onY ? f.C(0.9) : f.C(0.35);
        }
      }
      // 中央小圓與秒針
      const r2 = R * 0.3, lab = 'TE-TV  ' + fmtT(36000 + t);
      for (let y = Math.floor(cy - r2 / aspect); y <= cy + r2 / aspect; y++) for (let x = Math.floor(cx - r2); x <= cx + r2; x++) { const d = Math.hypot(x - cx, (y - cy) * aspect); if (d < r2) g.set(x, y, '█', f.C(0.08)); else if (d < r2 + 0.8) g.set(x, y, '█', f.C(0.95)); }
      const a = (t / 5) * TAU;
      for (let k = 0; k < r2 * 0.92; k += 0.5) g.set(Math.round(cx + Math.sin(a) * k), Math.round(cy - (Math.cos(a) * k) / aspect), '█', f.H(0, 0.55));
      clearR(g, Math.round(cx - lab.length / 2) - 1, Math.round(cy + r2 / aspect * 0.5), lab.length + 2, 1);
      put(g, Math.round(cx - lab.length / 2), Math.round(cy + r2 / aspect * 0.5), lab, f.C(1));
      return;
    }
    if (m === 'grey') {
      const h1 = Math.floor(rows * 0.45), h2 = Math.floor(rows * 0.3);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x, u = x / cols;
        let c, cc = '█';
        if (y < h1) c = f.C(Math.floor(u * 11) / 10);
        else if (y < h1 + h2) c = f.C(u);
        else { const k = Math.floor(u * 6), lv = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85][k]; if ((x + y) % 2 === 0 && Math.floor(u * 12) % 2) { cc = '▒'; } c = f.C(lv); }
        ch[i] = cc; co[i] = c;
      }
      for (let k = 0; k <= 10; k++) put(g, Math.floor((k + 0.5) * cols / 11) - 1, h1 - 2, String(k * 10), f.C(k > 5 ? 0.05 : 0.95));
      const px = Math.round((0.5 + 0.48 * Math.sin(t * 0.4)) * (cols - 1)), ire = Math.round((px / cols) * 100);
      for (let y = h1; y < h1 + h2; y++) g.set(px, y, '┃', f.H(0, 0.55));
      const lab = ' IRE ' + ire + ' ';
      clearR(g, clamp(px - 4, 0, cols - lab.length), h1 + h2, lab.length, 1);
      put(g, clamp(px - 4, 0, cols - lab.length), h1 + h2, lab, f.C(1));
      return;
    }
    if (m === 'grid') {
      const gs = Math.max(8, Math.round(cols / 16)), gv = Math.max(3, Math.round(gs / aspect));
      const mis = Math.round(Math.sin(t * 0.3) * 1.2);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const onX = x % gs === 0, onY = y % gv === 0, i = y * cols + x;
        if (onX && onY) { ch[i] = '┼'; co[i] = f.C(1); }
        else if (onX) { ch[i] = '│'; co[i] = f.C(0.85); }
        else if (onY) { ch[i] = '─'; co[i] = f.C(0.85); }
        else if (x % gs === Math.floor(gs / 2) && y % gv === Math.floor(gv / 2)) { ch[i] = '·'; co[i] = f.C(0.6); }
        // 色彩會聚誤差：邊緣的紅、藍線偏一格
        const edge = Math.abs(x - cols / 2) > cols * 0.3;
        if (edge && ((x - mis) % gs === 0) && !onX && !onY) { ch[i] = '│'; co[i] = f.H(0, 0.5); }
        if (edge && ((x + mis) % gs === 0) && !onX && !onY && mis) { ch[i] = '│'; co[i] = f.H(230, 0.5); }
      }
      const cxp = cols / 2 + Math.sin(t * 0.37) * cols * 0.4, cyp = rows / 2 + Math.sin(t * 0.53 + 1) * rows * 0.38;
      const X = Math.round(cxp), Y = Math.round(cyp);
      for (let k = -6; k <= 6; k++) { g.set(X + k, Y, '━', f.H(50, 0.6)); }
      for (let k = -3; k <= 3; k++) g.set(X, Y + k, '┃', f.H(50, 0.6));
      g.set(X, Y, '╋', f.C(1));
      put(g, X + 3, Y - 1, 'X ' + pad(X, 4) + '  Y ' + pad(Y, 3), f.H(50, 0.7));
      put(g, 1, 0, 'CONVERGENCE', f.C(1)); put(g, cols - 12, rows - 1, 'H ' + (mis > 0 ? '+' : '') + mis + '  V 0', f.C(1));
      return;
    }
    if (m === 'burst') {
      const h1 = Math.floor(rows * 0.6), F = [0.5, 1.0, 2.0, 3.0, 4.2, 5.8];
      const pw = cols / 7;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (y < h1) {
          const k = Math.floor(x / pw) - 1;
          if (k < 0) { ch[i] = '█'; co[i] = y < h1 / 2 ? f.C(0.95) : f.C(0.05); continue; }
          const per = [8, 6, 4, 3, 2, 1][k], on = Math.floor(x / per) % 2 === 0;
          ch[i] = per === 1 ? (x % 2 ? '▌' : '▐') : '█'; co[i] = on || per === 1 ? f.C(0.92) : f.C(0.06);
        } else if (y < h1 + 3) { ch[i] = ' '; }
        else {
          // 掃頻：頻率從左到右漸增，相位隨時間移動
          const u = x / cols, ph = u * u * cols * 1.2 - t * 6, v = 0.5 + 0.5 * Math.sin(ph);
          ch[i] = '█'; co[i] = f.C(0.08 + 0.85 * v * (1 - (y - h1) / (rows - h1) * 0.3));
        }
      }
      for (let k = 0; k < 6; k++) put(g, Math.floor((k + 1) * pw + pw / 2 - 2), h1 + 1, F[k].toFixed(1), f.C(0.9));
      put(g, 1, h1 + 1, 'MHz', f.C(0.6));
      put(g, cols - 18, h1 + 1, 'SWEEP 0.5–6 MHz', f.C(0.6));
      return;
    }
    if (m === 'wheel') {
      const cx = (cols - 1) / 2, cy = (rows - 1) / 2, R = Math.min(cols * 0.42, rows * aspect * 0.44), rot = t * 12;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const dx = x - cx, dy = (y - cy) * aspect, r = Math.hypot(dx, dy), i = y * cols + x;
        if (r < R) {
          const a = (Math.atan2(dy, dx) * 180) / Math.PI + rot, q = r / R;
          ch[i] = q < 0.12 ? '█' : q > 0.97 ? '▓' : '█'; co[i] = q < 0.12 ? f.C(1) : f.H(a, 0.72 - q * 0.35);
        } else if (r < R * 1.12) {
          const a = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
          if (Math.abs((a % 15) - 7.5) > 6.6) { ch[i] = a % 45 < 1.5 || a % 45 > 43.5 ? '█' : '│'; co[i] = f.C(0.7); }
        }
      }
      for (let d = 0; d < 360; d += 45) { const a = (d * Math.PI) / 180, lab = d + '°'; put(g, Math.round(cx + Math.cos(a) * R * 1.22 - lab.length / 2), Math.round(cy + (Math.sin(a) * R * 1.22) / aspect), lab, f.C(0.85)); }
      const sw = Math.max(4, Math.floor(cols * 0.05));
      for (let k = 0; k < 6; k++) for (let j = 0; j < 2; j++) fillR(g, 1 + (k % 2) * (sw + 1), 1 + Math.floor(k / 2) * 2 + j, sw, 1, '█', f.H(k * 60 + rot, 0.5));
      put(g, cols - 16, rows - 1, 'HUE ' + pad(Math.round(rot % 360), 3) + '°', f.C(0.85));
      return;
    }
    if (m === 'zone') {
      const cx = (cols - 1) / 2, cy = (rows - 1) / 2, Rm = Math.hypot(cx, cy * aspect), k = (Math.PI * 0.9) / Rm, ph = t * 2.2;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const dx = x - cx, dy = (y - cy) * aspect, v = 0.5 + 0.5 * Math.cos(k * (dx * dx + dy * dy) * 0.5 - ph), i = y * cols + x;
        ch[i] = RAMP10[Math.min(9, Math.floor(v * 10))]; co[i] = f.C(0.15 + 0.8 * v);
      }
      put(g, 1, rows - 1, ' ZONE PLATE · ' + Math.round(Rm) + ' cy/ph ', f.C(1));
    }
  },
});

/* ═════════ 12. 進度條大全 ═════════ */
const PSTY = [['█', '░'], ['#', '.'], ['=', ' ', '>'], ['▰', '▱'], ['⣿', '⣀'], ['●', '○'], ['■', '□'], ['▮', '▯'], ['━', '─'], ['/', ' ']];
const TASKS = ['compiling assets', 'downloading textures', 'indexing files', 'resolving deps', 'optimizing images', 'syncing mailbox', 'verifying checksums', 'extracting archive', 'uploading backup', 'rendering frames', 'training model', 'migrating db', 'building docs', 'warming cache', 'encoding video', 'scanning ports'];
const SPIN = [['|/-\\', 'classic'], ['⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏', 'dots'], ['◐◓◑◒', 'half'], ['▖▘▝▗', 'quad'], ['←↖↑↗→↘↓↙', 'arrow'], ['⣾⣽⣻⢿⡿⣟⣯⣷', 'braille'], ['▁▂▃▄▅▆▇█▇▆▅▄▃▂', 'pulse'], ['◢◣◤◥', 'corner'], ['○◔◑◕●◕◑◔', 'moon'], ['✶✸✹✺✹✸', 'star'], ['▏▎▍▌▋▊▉█▉▊▋▌▍▎', 'fill'], ['┤┘┴└├┌┬┐', 'box'], ['◜◝◞◟', 'arc'], ['⠁⠂⠄⡀⢀⠠⠐⠈', 'orbit'], ['▉▊▋▌▍▎▏▎▍▌▋▊▉', 'wipe'], ['.oO@*', 'bubble']];
A({ id: 'te-progress', name: '進度條大全', cat: '科技', theme: 'mint', hue: true, desc: '各種樣式的進度條同時往前跑',
  params: { mode: 'bars' },
  variants: [
    { id: 'spin', name: '轉圈圈', theme: 'cyber', desc: '一整面各式各樣的等待動畫', params: { mode: 'spin' } },
    { id: 'big', name: '大數字', theme: 'gold', desc: '巨大的百分比數字與粗進度條', params: { mode: 'big' } },
    { id: 'ring', name: '環形', theme: 'neon', desc: '大小不一的圓環進度一圈圈填滿', params: { mode: 'ring' } },
    { id: 'download', name: '下載管理', theme: 'ice', desc: '檔案清單、速度與頻寬走勢圖', params: { mode: 'download' } },
    { id: 'blocks', name: '批次處理', theme: 'lavender', desc: '大量小方塊依序被處理完成', params: { mode: 'blocks' } },
    { id: 'wizard', name: '安裝精靈', theme: 'blueprint', desc: '安裝視窗、步驟清單與細節紀錄', params: { mode: 'wizard' } },
    { id: 'copy', name: '檔案複製', theme: 'amber', desc: '檔案一張張從左邊飛到右邊資料夾', params: { mode: 'copy' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.tasks = []; s.T = 0;
    const nt = p.mode === 'download' ? Math.max(4, Math.floor((rows - 12) / 2)) : Math.max(40, rows * 2);
    for (let k = 0; k < nt; k++) s.tasks.push(this.mkTask(k, true));
    s.pct = rnd(0, 40); s.rate = rnd(4, 10); s.done = 0;
    s.bw = new Float32Array(240); s.bh = 240; s.bacc = 0;
    for (let k = 0; k < 240; k++) s.bw[k] = 9 + 5 * Math.sin(k * 0.07) + 3 * Math.sin(k * 0.31) + rnd(0, 2);
    if (p.mode === 'blocks') { s.N = cols >= 200 ? Math.floor((cols / 2) * (rows - 4)) : Math.floor((cols / 2) * (rows - 4)); s.st = new Uint8Array(s.N); s.ord = Array.from({ length: s.N }, (_, i) => i).sort(() => Math.random() - 0.5); s.bi = 0; s.act = []; s.bdone = 0; }
    if (p.mode === 'wizard') { s.wl = []; s.wstep = 2; }
    if (p.mode === 'copy') { s.fl = []; s.cn = 0; s.ctot = rint(300, 900); s.cacc = 0; }
    if (p.mode === 'ring') { s.rg = []; }
  },
  mkTask(k, init) {
    return { name: TASKS[(k * 7 + rint(0, 15)) % TASKS.length], sty: PSTY[k % PSTY.length], v: init ? rnd(0, 0.9) : 0, sp: rnd(0.02, 0.12), stall: 0, done: 0, size: rint(5, 900), file: pick(WORDS) + '_' + pick(['v2', 'final', 'data', 'pack', 'x64']) + pick(['.zip', '.iso', '.tar.gz', '.mp4', '.bin', '.pkg']) };
  },
  stepTask(q, dt, k) {
    if (q.done > 0) { q.done -= dt; if (q.done <= 0) Object.assign(q, this.mkTask(k, false)); return; }
    if (q.stall > 0) { q.stall -= dt; return; }
    if (Math.random() < dt * 0.15) q.stall = rnd(0.3, 2);
    q.v = Math.min(1, q.v + dt * q.sp * (0.5 + Math.random()));
    if (q.v >= 1) q.done = rnd(1.5, 3);
  },
  frame(s, f) { this[f.p.mode](s, f); },
  bars(s, f) {
    const { g, cols, rows, dt, t } = f;
    const nc = cols >= 200 ? 2 : 1, cw = Math.floor(cols / nc), per = rows >= 40 ? 2 : 1, nr = Math.floor((rows - 1) / per);
    put(g, 1, 0, 'jobs: ' + nr * nc + ' · running ' + s.tasks.slice(0, nr * nc).filter(q => q.done <= 0).length + ' · ' + fmtT(30000 + t), f.C(0.6));
    for (let k = 0; k < nr * nc; k++) {
      const q = s.tasks[k]; this.stepTask(q, dt, k);
      const x0 = (k % nc) * cw + 1, y = 1 + Math.floor(k / nc) * per, w = cw - 2;
      const nm = q.name.padEnd(22).slice(0, 22), bw = Math.max(8, w - 46), [on, off, head] = q.sty;
      put(g, x0, y, nm, f.C(0.75));
      put(g, x0 + 23, y, '[', f.C(0.5));
      const fill = Math.floor(q.v * bw);
      for (let j = 0; j < bw; j++) g.set(x0 + 24 + j, y, j < fill ? on : j === fill && head ? head : off, j < fill ? f.H((k * 37) % 360, 0.55) : f.C(0.22));
      put(g, x0 + 24 + bw, y, ']', f.C(0.5));
      const info = q.done > 0 ? ' ✓ done' : q.stall > 0 ? pad(Math.floor(q.v * 100), 4) + '%  waiting…' : pad(Math.floor(q.v * 100), 4) + '%  ' + (q.sp * 40).toFixed(1) + ' MB/s  ETA ' + fmtT(((1 - q.v) / q.sp) * 1.5).slice(3);
      put(g, x0 + 26 + bw, y, info, q.done > 0 ? f.H(120, 0.6) : f.C(0.65), x0 + w);
    }
  },
  spin(s, f) {
    const { g, cols, rows, t } = f;
    const tw = cols >= 200 ? 26 : 20, th = rows >= 40 ? 5 : 3, nx = Math.floor(cols / tw), ny = Math.floor(rows / th);
    for (let k = 0; k < nx * ny; k++) {
      const x0 = (k % nx) * tw + 1, y0 = Math.floor(k / nx) * th, sp = SPIN[(k * 5 + Math.floor(k / nx)) % SPIN.length], fr = sp[0], spd = 6 + ((k * 3) % 7) * 1.5;
      const c = fr[Math.floor(t * spd + k) % fr.length], col = f.H((k * 29) % 360, 0.6);
      if (th >= 5) {
        // 大型：同一個轉圈字元排成 3×3，中間放名稱
        for (let j = 0; j < 3; j++) g.set(x0 + 1 + j, y0 + 1, fr[Math.floor(t * spd + k + j) % fr.length], col);
        put(g, x0 + 5, y0 + 1, sp[1], f.C(0.75));
        put(g, x0 + 1, y0 + 2, ['loading', 'syncing', 'indexing', 'waiting', 'linking', 'fetching'][k % 6] + '.'.repeat(1 + (Math.floor(t * 2 + k) % 3)), f.C(0.4));
        // 彈跳小方塊
        const bw = tw - 4, pos = Math.abs(((t * spd * 2 + k * 3) % (bw * 2)) - bw);
        for (let j = 0; j < bw; j++) g.set(x0 + 1 + j, y0 + 3, Math.abs(j - pos) < 2 ? '▬' : '─', Math.abs(j - pos) < 2 ? col : f.C(0.15));
      } else {
        g.set(x0, y0 + 1, c, col);
        put(g, x0 + 2, y0 + 1, sp[1] + '.'.repeat(1 + (Math.floor(t * 2 + k) % 3)), f.C(0.55));
      }
    }
  },
  big(s, f) {
    const { g, cols, rows, dt, t } = f;
    if (s.done > 0) { s.done -= dt; if (s.done <= 0) { s.pct = 0; s.rate = rnd(4, 12); } }
    else { s.pct = Math.min(100, s.pct + dt * s.rate * (0.4 + Math.abs(Math.sin(t * 0.7)) * 1.2)); if (s.pct >= 100) s.done = 3; }
    const txt = s.done > 0 ? 'DONE' : Math.floor(s.pct) + '%';
    const sx = Math.max(1, Math.floor(Math.min(cols / 22, rows / 9 * 1.6))), sy = Math.max(1, Math.round(sx / 1.6));
    const bx = Math.floor((cols - bigW(txt, sx)) / 2), by = Math.floor(rows * 0.42 - (5 * sy) / 2);
    big(g, bx, by, txt, sx, sy, (x, y) => f.C(0.55 + 0.45 * (1 - y / (5 * sy))));
    const bw = Math.floor(cols * 0.8), x0 = Math.floor((cols - bw) / 2), y0 = by + 5 * sy + 2, h = Math.max(1, Math.floor(rows / 14));
    box(g, x0 - 1, y0 - 1, bw + 2, h + 2, f.C(0.4), null, null, 1);
    for (let j = 0; j < h; j++) hbar(g, x0, y0 + j, bw, s.pct / 100, f.H(40 + s.pct, 0.55), f.C(0.12), '·');
    const sh = (t * 30) % (bw + 20) - 10;
    for (let j = 0; j < h; j++) for (let k = 0; k < 4; k++) { const x = Math.floor(x0 + sh + k); if (x < x0 + (s.pct / 100) * bw && x >= x0) g.set(x, y0 + j, '█', f.C(0.95 - k * 0.1)); }
    const info = 'firmware_update_v4.2.bin  ·  ' + (s.pct * 0.48).toFixed(1) + ' / 48.0 MB  ·  ' + (s.rate * 0.6).toFixed(1) + ' MB/s';
    put(g, Math.floor((cols - info.length) / 2), y0 + h + 2, info, f.C(0.6));
  },
  ring(s, f) {
    const { g, cols, rows, dt, t, aspect } = f;
    if (!s.rg.length) {
      const sizes = cols >= 200 ? [0.22, 0.15, 0.15, 0.11, 0.11, 0.11, 0.08, 0.08] : [0.3, 0.2, 0.2, 0.14];
      const placed = [];
      for (const sz of sizes) {
        const R = Math.min(cols, rows * aspect) * sz;
        for (let tries = 0; tries < 300; tries++) {
          const x = rnd(R + 2, cols - R - 2), y = rnd(R / aspect + 1, rows - R / aspect - 2);
          if (placed.every(q => Math.hypot(q.x - x, (q.y - y) * aspect) > q.R + R + 3)) { placed.push({ x, y, R, v: rnd(0, 0.9), sp: rnd(0.03, 0.12), done: 0, hue: rnd(0, 360), lab: pick(TASKS).split(' ')[0] }); break; }
        }
      }
      s.rg = placed; s.b = bnew(cols, rows);
    }
    const b = s.b; bclr(b);
    for (const q of s.rg) {
      if (q.done > 0) { q.done -= dt; if (q.done <= 0) { q.v = 0; q.sp = rnd(0.03, 0.12); } } else { q.v = Math.min(1, q.v + dt * q.sp * (0.5 + Math.random())); if (q.v >= 1) q.done = 2; }
      const bx = q.x * 2, by = q.y * 4, rx = q.R * 2, ry = (q.R * 4) / aspect, th = Math.max(2, q.R * 0.18);
      for (let a = 0; a < 1; a += 1 / (q.R * 30)) {
        const ang = a * TAU - Math.PI / 2, on = a <= q.v;
        for (let w = 0; w < th; w += 0.7) { const rr = 1 - w / q.R / 2; bdot(b, bx + Math.cos(ang) * rx * rr, by + Math.sin(ang) * ry * rr, on ? 1 : 0.25, on ? 1 : 0); }
      }
      const pc = Math.floor(q.v * 100) + '%';
      put(g, Math.round(q.x - pc.length / 2), Math.round(q.y), pc, q.done > 0 ? f.H(120, 0.65) : f.C(0.95));
      put(g, Math.round(q.x - q.lab.length / 2), Math.round(q.y + q.R / aspect + 1), q.lab, f.C(0.55));
    }
    bflush(g, b, (v, tg) => (tg ? f.H(300 + v * 40, 0.3 + 0.35 * v) : f.C(0.18)));
  },
  download(s, f) {
    const { g, cols, rows, dt, t } = f;
    let tot = 0;
    const lh = 2, n = Math.min(s.tasks.length, Math.floor((rows - 12) / lh));
    put(g, 1, 0, 'Downloads', f.C(0.95)); put(g, 13, 0, '· ' + n + ' items · ' + s.tasks.slice(0, n).filter(q => q.done > 0).length + ' completed', f.C(0.5));
    for (let x = 0; x < cols; x++) g.set(x, 1, '─', f.C(0.25));
    for (let k = 0; k < n; k++) {
      const q = s.tasks[k]; this.stepTask(q, dt, k);
      const y = 2 + k * lh, spd = q.done > 0 || q.stall > 0 ? 0 : q.sp * 60 * (0.8 + 0.4 * Math.sin(t * 2 + k));
      tot += spd;
      g.set(1, y, q.done > 0 ? '✓' : q.stall > 0 ? '‖' : '↓', q.done > 0 ? f.H(120, 0.6) : f.H(200, 0.6));
      put(g, 3, y, q.file, f.C(0.9), Math.floor(cols * 0.45));
      const sz = (q.size * q.v).toFixed(1) + ' / ' + q.size + ' MB';
      put(g, Math.floor(cols * 0.45), y, sz, f.C(0.55));
      put(g, cols - 24, y, q.done > 0 ? 'completed' : q.stall > 0 ? 'paused' : spd.toFixed(1) + ' MB/s', q.done > 0 ? f.H(120, 0.6) : f.C(0.65));
      hbar(g, 3, y + 1, cols - 8, q.v, q.done > 0 ? f.H(120, 0.45) : f.H(200, 0.5), f.C(0.12), '─');
    }
    s.bacc += dt; if (s.bacc > 0.1) { s.bacc = 0; s.bw[s.bh % 240] = tot; s.bh++; }
    const gy = 2 + n * lh + 1, gh = rows - gy - 1;
    if (gh >= 3) {
      box(g, 0, gy, cols, gh + 1, f.C(0.25), 'bandwidth ' + tot.toFixed(1) + ' MB/s', f.C(0.8), 1);
      const b = s.b || (s.b = bnew(cols, rows)); bclr(b);
      let mx = 10; for (let k = 0; k < 240; k++) mx = Math.max(mx, s.bw[k]);
      const W = (cols - 2) * 2, H4 = (gh - 1) * 4;
      let py = null;
      for (let x = 0; x < W; x++) {
        const idx = Math.floor(s.bh - W / 2 + x / 2), v = idx >= 0 ? s.bw[idx % 240] : 0, y = (gy + 1) * 4 + H4 - 1 - (v / mx) * (H4 - 2);
        if (py !== null) bline(b, 2 + x - 1, py, 2 + x, y, 1, 0);
        if (x % 3 === 0) for (let yy = Math.ceil(y) + 2; yy < (gy + 1) * 4 + H4; yy += 3) bdot(b, 2 + x, yy, 0.3, 1);
        py = y;
      }
      bflush(g, b, (v, tg) => (tg ? f.C(0.2) : f.H(200, 0.6)));
    }
  },
  blocks(s, f) {
    const { g, cols, rows, dt, t } = f;
    const W = Math.floor(cols / 2), N = s.N;
    if (s.bdone > 0) { s.bdone -= dt; if (s.bdone <= 0) { s.st.fill(0); s.bi = 0; s.act = []; } }
    else {
      const rate = N / 20;
      s.acc2 = (s.acc2 || 0) + dt * rate;
      while (s.acc2 >= 1 && s.bi < N) { s.acc2--; const i = s.ord[s.bi++]; s.st[i] = 1; s.act.push([i, rnd(0.2, 1.2)]); }
      for (let k = s.act.length - 1; k >= 0; k--) { s.act[k][1] -= dt; if (s.act[k][1] <= 0) { s.st[s.act[k][0]] = Math.random() < 0.02 ? 3 : 2; kill(s.act, k); } }
      if (s.bi >= N && !s.act.length) s.bdone = 3;
    }
    let dn = 0, er = 0;
    for (let i = 0; i < N; i++) {
      const x = (i % W) * 2 + 1, y = 2 + Math.floor(i / W), st = s.st[i];
      if (st === 2) dn++; if (st === 3) er++;
      g.set(x, y, st === 0 ? '□' : st === 1 ? '▣' : '■', st === 0 ? f.C(0.15) : st === 1 ? f.C(0.6 + 0.4 * Math.sin(t * 10 + i)) : st === 3 ? f.H(0, 0.6) : f.H(150 + (i % W) / W * 120, 0.5));
    }
    put(g, 1, 0, 'batch ' + pad0(Math.floor(t / 23) % 1000, 3) + ' · ' + dn + ' / ' + N + ' done · ' + s.act.length + ' active · ' + er + ' failed', f.C(0.75));
    hbar(g, 1, rows - 1, cols - 10, dn / N, f.H(200, 0.55), f.C(0.15), '░');
    put(g, cols - 8, rows - 1, pad(Math.floor((dn / N) * 100), 3) + '%', f.C(0.9));
  },
  wizard(s, f) {
    const { g, cols, rows, dt, t } = f;
    // 桌面底紋
    for (let y = 0; y < rows; y++) for (let x = (y % 2) * 2; x < cols; x += 4) g.set(x, y, '░', f.C(0.1));
    if (s.done > 0) { s.done -= dt; if (s.done <= 0) { s.pct = 0; s.wl = []; } }
    else { s.pct = Math.min(100, s.pct + dt * (3 + 4 * Math.abs(Math.sin(t * 0.5)))); if (s.pct >= 100) s.done = 3; }
    if (Math.random() < dt * 9 && s.pct < 100) { s.wl.push('/opt/te-suite/' + pick(DIRS) + '/' + pick(WORDS) + pick(['.so', '.dat', '.json', '.png', '.ttf'])); if (s.wl.length > 60) s.wl.shift(); }
    const ww = Math.min(cols - 4, Math.max(60, Math.floor(cols * 0.7))), wh = Math.min(rows - 2, Math.max(20, Math.floor(rows * 0.8))), x0 = Math.floor((cols - ww) / 2), y0 = Math.floor((rows - wh) / 2);
    clearR(g, x0, y0, ww, wh);
    box(g, x0, y0, ww, wh, f.C(0.75), null, null, 2);
    fillR(g, x0 + 1, y0 + 1, ww - 2, 1, '▀', f.C(0.35));
    put(g, x0 + 2, y0 + 1, tr(f, ' 安裝精靈 — TE Suite 2026 ', ' Setup Wizard — TE Suite 2026 '), f.C(1));
    put(g, x0 + ww - 8, y0 + 1, '─ □ ✕', f.C(0.9));
    const sw = Math.min(22, Math.floor(ww * 0.28));
    for (let y = y0 + 2; y < y0 + wh - 1; y++) g.set(x0 + sw, y, '│', f.C(0.3));
    const steps = tr(f, ['歡迎', '授權合約', '選擇元件', '安裝位置', '安裝中', '完成'], ['Welcome', 'License', 'Components', 'Location', 'Installing', 'Finish']), cur = s.pct >= 100 ? 5 : 4;
    steps.forEach((st, k) => put(g, x0 + 2, y0 + 3 + k * 2, (k < cur ? '✓ ' : k === cur ? '▶ ' : '  ') + st, k < cur ? f.H(120, 0.6) : k === cur ? f.C(1) : f.C(0.4)));
    const mx = x0 + sw + 2, mw = ww - sw - 4;
    // 紀錄裡只存路徑，前綴「正在複製」畫的時候才依語言加上
    const cpy = tr(f, '正在複製 ', 'Copying ');
    put(g, mx, y0 + 3, s.pct >= 100 ? tr(f, '安裝完成！', 'Installation complete!') : tr(f, '正在安裝 TE Suite …', 'Installing TE Suite …'), f.C(1));
    put(g, mx, y0 + 5, s.wl.length ? cpy + s.wl[s.wl.length - 1] : tr(f, '準備中 …', 'Preparing …'), f.C(0.6), mx + mw);
    hbar(g, mx, y0 + 7, mw - 7, s.pct / 100, f.H(210, 0.55), f.C(0.15), '░');
    put(g, mx + mw - 5, y0 + 7, pad(Math.floor(s.pct), 3) + '%', f.C(0.9));
    const ly = y0 + 9, lh = wh - 14;
    box(g, mx, ly, mw, lh, f.C(0.3), tr(f, '詳細資料', 'Details'), f.C(0.6), 1);
    const n = Math.min(lh - 2, s.wl.length);
    for (let k = 0; k < n; k++) put(g, mx + 2, ly + 1 + k, cpy + s.wl[s.wl.length - n + k], f.C(0.45), mx + mw - 1);
    const by = y0 + wh - 3;
    put(g, x0 + ww - 40, by, tr(f, '[ < 上一步 ]', '[ < Back ]'), f.C(0.35)); put(g, x0 + ww - 26, by, s.pct >= 100 ? tr(f, '[ 完成 ]', '[ Finish ]') : tr(f, '[ 下一步 > ]', '[ Next > ]'), s.pct >= 100 ? f.C(1) : f.C(0.35)); put(g, x0 + ww - 12, by, tr(f, '[ 取消 ]', '[ Cancel ]'), f.C(0.7));
  },
  copy(s, f) {
    const { g, cols, rows, dt, t, aspect } = f;
    const fy = Math.floor(rows * 0.4), lx = Math.floor(cols * 0.12), rx = Math.floor(cols * 0.78), fw = Math.max(12, Math.floor(cols * 0.1)), fh = Math.max(5, Math.floor(rows * 0.2));
    const folder = (x, y, lab, fillv) => {
      for (let k = 0; k < Math.floor(fw * 0.4); k++) g.set(x + k, y - 1, '▄', f.H(40, 0.5));
      for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < fw; xx++) g.set(x + xx, y + yy, '█', f.H(40, yy === 0 ? 0.6 : 0.45 - 0.1 * (yy / fh)));
      put(g, x + Math.floor((fw - strW(lab)) / 2), y + fh + 1, lab, f.C(0.85));
    };
    folder(lx, fy, tr(f, '來源', 'Source'), 0); folder(rx, fy, tr(f, '目的地', 'Destination'), 0);
    if (s.done > 0) { s.done -= dt; if (s.done <= 0) { s.cn = 0; s.ctot = rint(300, 900); } }
    else {
      s.cacc += dt * rnd(4, 9);
      while (s.cacc >= 1) { s.cacc--; if (s.cn + s.fl.length < s.ctot) s.fl.push({ u: 0, sp: rnd(0.35, 0.6), h: rnd(0.5, 1.2), nm: pick(WORDS) }); }
    }
    const sx = lx + fw, ex = rx, sy = fy + fh / 2;
    for (let k = s.fl.length - 1; k >= 0; k--) {
      const q = s.fl[k]; q.u += dt * q.sp;
      if (q.u >= 1) { kill(s.fl, k); s.cn++; if (s.cn >= s.ctot) s.done = 3; continue; }
      const x = sx + (ex - sx) * q.u, y = sy - Math.sin(q.u * Math.PI) * rows * 0.3 * q.h;
      g.sprite(Math.round(x), Math.round(y) - 1, ['▛▀▜', '▌≡▐', '▙▄▟'], f.C(0.85));
    }
    const bw = Math.floor(cols * 0.7), bx = Math.floor((cols - bw) / 2), by = rows - 4;
    hbar(g, bx, by, bw, s.cn / s.ctot, f.H(40, 0.55), f.C(0.15), '░');
    const mb = (s.cn * 2.3).toFixed(0), left = Math.max(0, Math.ceil((s.ctot - s.cn) / 6));
    put(g, bx, by + 1, tr(f, '已複製 ' + s.cn + ' / ' + s.ctot + ' 個檔案 · ' + mb + ' MB · 剩餘約 ' + left + ' 秒', 'Copied ' + s.cn + ' / ' + s.ctot + ' files · ' + mb + ' MB · about ' + left + 's left'), f.C(0.7));
    put(g, bx, by - 1, s.done > 0 ? tr(f, '複製完成', 'Copy complete') : tr(f, '正在複製 ', 'Copying ') + (s.fl.length ? s.fl[0].nm + '.dat' : '…'), f.C(0.9));
  },
});

/* ═════════ 13. 行情看板 ═════════ */
const SYMS = ['TQXA', 'NVZR', 'QRZT', 'ORBX', 'FLXQ', 'HLXZ', 'PRZM', 'ZNTQ', 'EMBQ', 'LMNX', 'ATLZ', 'CMTQ', 'VRTQ', 'DLTZ', 'OMGQ', 'SPKZ', 'KRNQ', 'PXLZ', 'TNSQ', 'DRFX'];
const SECT = ['科技', '能源', '金融', '醫療', '工業', '原料', '通訊', '消費'];
const SECT_EN = ['Tech', 'Energy', 'Finance', 'Health', 'Industry', 'Materials', 'Telecom', 'Consumer'];
// 台灣慣例：紅漲綠跌
const UPH = 0, DNH = 125;
// 一支假股票：對數空間裡均值回歸的隨機漫步（放多久都不會漂到天邊），每一根 K 棒彙整一段時間
function mkSym(name, p0) {
  const q = { name, p: p0, p0, open: p0, prev: p0, vol: rnd(0.004, 0.012), drift: rnd(-0.0008, 0.0008), c: [], cur: null, hist: [] };
  return q;
}
function symTick(q) {
  q.p *= Math.exp(q.drift * 0.1 - 0.0004 * Math.log(q.p / q.p0) + q.vol * 0.35 * gauss());
  if (Math.random() < 0.002) q.drift = rnd(-0.0008, 0.0008);
  if (!q.cur) q.cur = { o: q.p, h: q.p, l: q.p, c: q.p, v: 0 };
  q.cur.c = q.p; q.cur.h = Math.max(q.cur.h, q.p); q.cur.l = Math.min(q.cur.l, q.p); q.cur.v += rnd(0, 10);
}
function symClose(q, max) { q.c.push(q.cur); if (q.c.length > max) q.c.shift(); q.cur = null; symTick(q); }
A({ id: 'te-market', name: '行情看板', cat: '科技', theme: 'matrix', hue: true, desc: 'K 線、均線與成交量一根根往前推',
  params: { mode: 'candle' },
  variants: [
    { id: 'line', name: '走勢圖', theme: 'ice', desc: '多檔代號的漲跌幅曲線疊在一起', params: { mode: 'line' } },
    { id: 'board', name: '報價表', theme: 'amber', desc: '大字指數、跳動的報價表與跑馬燈', params: { mode: 'board' } },
    { id: 'book', name: '委託簿', theme: 'cyber', desc: '買賣掛單階梯、深度圖與成交明細', params: { mode: 'book' } },
    { id: 'heat', name: '類股熱圖', theme: 'mono', desc: '依市值切塊、依漲跌上色的方塊圖', params: { mode: 'heat' } },
    { id: 'multi', name: '多圖', theme: 'mint', desc: '一面牆的迷你 K 線小圖', params: { mode: 'multi' } },
    { id: 'pnf', name: '圈叉圖', theme: 'paper', hue: false, desc: '只記錄漲跌轉折的 X 與 O 欄', params: { mode: 'pnf' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    s.sy = SYMS.map((n, k) => mkSym(n, rnd(8, 400)));
    s.acc = 0; s.cacc = 0; s.T = 0;
    s.maxC = Math.max(60, cols);
    // 先跑出一段歷史
    for (let k = 0; k < s.maxC; k++) { for (const q of s.sy) { for (let j = 0; j < 12; j++) symTick(q); symClose(q, s.maxC); } }
    for (const q of s.sy) { q.open = q.c[Math.max(0, q.c.length - 40)].o; q.prev = q.p; q.flash = 0; q.dir = 0; }
    s.b = bnew(cols, rows);
    s.tr = []; s.book = null;
    if (p.mode === 'pnf') { s.box = 0; s.pc = []; this.pnfBuild(s); }
    if (p.mode === 'heat') { s.cap = SYMS.map(() => rnd(1, 10)).concat(SYMS.map(() => rnd(0.5, 4))); }
    if (p.mode === 'board') { s.idxC = 18240 + rnd(-300, 300); s.idx = s.idxC; s.idx0 = s.idx; }
    s.sess = 600; // 每十分鐘開新的一盤：重設開盤價
  },
  frame(s, f) {
    const { dt, p } = f;
    s.acc += dt * 12;
    while (s.acc >= 1) {
      s.acc--;
      for (const q of s.sy) { const before = q.p; symTick(q); if (Math.random() < 0.15) { q.dir = Math.sign(q.p - q.prev); q.prev = q.p; q.flash = 0.6; } }
      if (p.mode === 'book' && Math.random() < 0.6) { const q = s.sy[0]; s.tr.unshift([fmtT(36000 + s.T), q.p, rint(1, 900), Math.random() < 0.5]); if (s.tr.length > 80) s.tr.pop(); }
    }
    for (const q of s.sy) q.flash = Math.max(0, q.flash - dt);
    s.T += dt; s.sess -= dt;
    if (s.sess <= 0) { s.sess = 600; for (const q of s.sy) q.open = q.p; if (s.idx !== undefined) s.idx0 = s.idx; }
    s.cacc += dt;
    const per = p.mode === 'pnf' ? 0.35 : 1.4;
    if (s.cacc >= per) { s.cacc = 0; for (const q of s.sy) symClose(q, s.maxC); if (p.mode === 'pnf') this.pnfBuild(s); }
    this[p.mode](s, f);
  },
  // K 線圖：在 (x0,y0,w,h) 範圍內畫一檔
  candles(g, f, q, x0, y0, w, h, cw, opts) {
    const n = Math.floor(w / cw), list = q.c.slice(-(n - 1)).concat([q.cur || { o: q.p, h: q.p, l: q.p, c: q.p, v: 0 }]);
    let lo = 1e9, hi = -1e9; for (const c of list) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
    const pad2 = (hi - lo) * 0.08 + 1e-6; lo -= pad2; hi += pad2;
    const Y = v => y0 + (1 - (v - lo) / (hi - lo)) * (h - 1);
    list.forEach((c, k) => {
      const x = x0 + k * cw, up = c.c >= c.o, col = up ? f.H(DNH, 0.55) : f.H(UPH, 0.55);
      const yh = Y(c.h), yl = Y(c.l), yo = Y(c.o), yc = Y(c.c), bt = Math.min(yo, yc), bb = Math.max(yo, yc);
      for (let y = Math.round(yh); y <= Math.round(yl); y++) g.set(x + Math.floor((cw - 1) / 2), y, '│', col);
      // 實體用半格精度：上半 ▀、下半 ▄、整格 █
      const t2 = Math.round(bt * 2), b2 = Math.round(bb * 2);
      for (let r = t2 >> 1; r <= b2 >> 1; r++) {
        const up2 = 2 * r >= t2 && 2 * r <= b2, lo2 = 2 * r + 1 >= t2 && 2 * r + 1 <= b2;
        const c2 = t2 === b2 ? '━' : up2 && lo2 ? '█' : up2 ? '▀' : '▄';
        for (let j = 0; j < Math.max(1, cw - 1); j++) g.set(x + j, r, c2, col);
      }
    });
    if (opts && opts.axis) {
      for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4, y = Math.round(Y(v)); put(g, x0 + w + 1, y, v.toFixed(2), f.C(0.45)); for (let x = x0; x < x0 + w; x += 3) if (g.ch[y * g.cols + x] === ' ') g.set(x, y, '·', f.C(0.15)); }
    }
    return { lo, hi, Y, list, n };
  },
  candle(s, f) {
    const { g, cols, rows, t } = f, q = s.sy[0], b = s.b;
    const aw = cols >= 120 ? 10 : 8, w = cols - aw - 2, vh = Math.max(3, Math.floor(rows * 0.18)), h = rows - vh - 4, cw = cols >= 200 ? 3 : 2;
    put(g, 1, 0, q.name + '  ' + q.p.toFixed(2), f.C(1));
    const ch = ((q.p / q.open - 1) * 100);
    put(g, 3 + q.name.length + q.p.toFixed(2).length + 2, 0, (ch >= 0 ? '▲ +' : '▼ ') + ch.toFixed(2) + '%', ch >= 0 ? f.H(DNH, 0.6) : f.H(UPH, 0.6));
    put(g, cols - 30, 0, '1m  ·  MA7  MA25  ·  VOL', f.C(0.45));
    const R = this.candles(g, f, q, 1, 2, w, h, cw, { axis: true });
    // 均線（點字）
    bclr(b);
    const all = q.c.concat([q.cur || { c: q.p }]);
    for (const [len, tag] of [[7, 0], [25, 1]]) {
      let py = null;
      R.list.forEach((c, k) => {
        const idx = all.length - R.list.length + k; let sum = 0, nn = 0;
        for (let j = Math.max(0, idx - len + 1); j <= idx; j++) { sum += all[j].c; nn++; }
        const y = R.Y(sum / nn) * 4 + 2, x = (1 + k * cw) * 2 + cw - 1;
        if (py !== null) bline(b, x - cw * 2, py, x, y, 1, tag); py = y;
      });
    }
    bflush(g, b, (v, tg) => (tg ? f.H(280, 0.55) : f.H(45, 0.6)));
    // 現價線
    const yp = Math.round(R.Y(q.p));
    for (let x = 1; x < w; x += 2) if (g.ch[yp * cols + x] === ' ') g.set(x, yp, '─', f.C(0.4));
    put(g, w + 1, yp, ' ' + q.p.toFixed(2) + ' ', f.C(1));
    // 成交量
    const vy = rows - 1;
    let mv = 1; for (const c of R.list) mv = Math.max(mv, c.v);
    R.list.forEach((c, k) => {
      const hv = (c.v / mv) * vh, full = Math.floor(hv), part = Math.floor((hv - full) * 8), col = c.c >= c.o ? f.H(DNH, 0.35) : f.H(UPH, 0.35);
      for (let j = 0; j < Math.max(1, cw - 1); j++) { for (let y = 0; y < full; y++) g.set(1 + k * cw + j, vy - y, '█', col); if (part) g.set(1 + k * cw + j, vy - full, VEIGHT[part], col); }
    });
    for (let x = 1; x < w; x++) g.set(x, rows - vh - 2, '┈', f.C(0.2));
  },
  line(s, f) {
    const { g, cols, rows, t } = f, b = s.b;
    bclr(b);
    const N = Math.min(5, s.sy.length), W = (cols - 12) * 2, H4 = (rows - 3) * 4, x0 = 2, y0 = 4;
    const series = [];
    let lo = 1e9, hi = -1e9;
    for (let k = 0; k < N; k++) {
      const q = s.sy[k], list = q.c.slice(-Math.floor(W / 2)).map(c => c.c).concat([q.p]), base = list[0];
      const pc = list.map(v => (v / base - 1) * 100);
      for (const v of pc) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      series.push(pc);
    }
    lo -= 0.5; hi += 0.5;
    const Y = v => y0 + (1 - (v - lo) / (hi - lo)) * (H4 - 2);
    for (let k = -10; k <= 10; k++) { const v = k * Math.max(1, Math.round((hi - lo) / 8)); if (v < lo || v > hi) continue; const yy = Math.floor(Y(v) / 4); for (let x = 1; x < cols - 10; x += 2) g.set(x, yy, v === 0 ? '─' : '·', f.C(v === 0 ? 0.3 : 0.15)); put(g, cols - 9, yy, (v > 0 ? '+' : '') + v + '%', f.C(0.45)); }
    series.forEach((pc, k) => {
      const n = pc.length, step = W / Math.max(1, n - 1);
      let px = null, py = null;
      for (let j = 0; j < n; j++) {
        const x = x0 + j * step, y = Y(pc[j]);
        if (px !== null) bline(b, px, py, x, y, 1, k);
        if (k === 0 && j % 2 === 0) for (let yy = Math.ceil(y) + 3; yy < Y(0); yy += 4) bdot(b, x, yy, 0.3, 7);
        px = x; py = y;
      }
    });
    const HU = [45, 190, 300, 120, 15];
    bflush(g, b, (v, tg) => (tg === 7 ? f.H(45, 0.25) : f.H(HU[tg], 0.6)));
    let x = 1;
    for (let k = 0; k < N; k++) { const q = s.sy[k], pc = series[k][series[k].length - 1], lab = '■ ' + q.name + ' ' + (pc >= 0 ? '+' : '') + pc.toFixed(2) + '%'; put(g, x, 1, lab, f.H(HU[k], 0.6)); x += lab.length + 3; }
    put(g, 1, 0, 'relative performance · last ' + Math.floor(W / 2) + ' bars', f.C(0.5));
  },
  board(s, f) {
    const { g, cols, rows, dt, t } = f;
    s.idx += gauss() * 6 * Math.sqrt(dt) - (s.idx - s.idxC) * 0.004 * dt; // 指數也會回歸
    const ich = s.idx - s.idx0, up = ich >= 0, sx = cols >= 200 ? 3 : 2, sy = cols >= 200 ? 2 : 1;
    put(g, 2, 0, 'TE-50 INDEX', f.C(0.7));
    const it = s.idx.toFixed(2);
    big(g, 2, 1, it, sx, sy, up ? f.H(DNH, 0.6) : f.H(UPH, 0.6));
    const ix = 4 + bigW(it, sx);
    put(g, ix, 2, (up ? '▲ +' : '▼ ') + ich.toFixed(2), up ? f.H(DNH, 0.65) : f.H(UPH, 0.65));
    put(g, ix, 3, (up ? '+' : '') + ((ich / s.idx0) * 100).toFixed(2) + '%', up ? f.H(DNH, 0.65) : f.H(UPH, 0.65));
    const vol = 12.4 + t * 0.01; // 單位：億（英文顯示成 B = 十億）
    put(g, ix, 4, tr(f, '成交量 ' + vol.toFixed(2) + ' 億', 'Volume ' + (vol / 10).toFixed(3) + 'B'), f.C(0.5));
    const y0 = 2 + 5 * sy + 1, hdr = ' SYMBOL      LAST       CHG     %CHG       BID       ASK        VOL   TREND';
    put(g, 0, y0, hdr, f.C(0.85));
    for (let x = 0; x < cols; x++) g.set(x, y0 + 1, '─', f.C(0.25));
    const nr = Math.min(s.sy.length, rows - y0 - 4);
    for (let k = 0; k < nr; k++) {
      const q = s.sy[k], y = y0 + 2 + k, chg = q.p - q.open, pc = (chg / q.open) * 100, upq = chg >= 0, cc = upq ? f.H(DNH, 0.6) : f.H(UPH, 0.6);
      const fl = q.flash > 0.3 ? (q.dir > 0 ? f.H(DNH, 0.8) : f.H(UPH, 0.75)) : f.C(0.95);
      put(g, 1, y, q.name, f.C(0.85));
      put(g, 9, y, pad(q.p.toFixed(2), 10), fl);
      put(g, 20, y, pad((upq ? '+' : '') + chg.toFixed(2), 9), cc);
      put(g, 30, y, pad((upq ? '+' : '') + pc.toFixed(2) + '%', 8), cc);
      put(g, 40, y, pad((q.p * 0.9995).toFixed(2), 9) + ' ' + pad((q.p * 1.0005).toFixed(2), 9), f.C(0.55));
      put(g, 60, y, pad((q.c.length * 137 + Math.floor(q.cur ? q.cur.v : 0)).toLocaleString('en'), 10), f.C(0.5));
      const sw = Math.max(0, cols - 74), list = q.c.slice(-sw);
      let lo = 1e9, hi = -1e9; for (const c of list) { lo = Math.min(lo, c.c); hi = Math.max(hi, c.c); }
      list.forEach((c, j) => g.set(73 + j, y, VEIGHT[1 + Math.round(((c.c - lo) / (hi - lo || 1)) * 7)], cc));
    }
    // 跑馬燈
    let tape = '';
    for (const q of s.sy) { const pc = ((q.p / q.open - 1) * 100); tape += '  ' + q.name + ' ' + q.p.toFixed(2) + (pc >= 0 ? ' ▲' : ' ▼') + Math.abs(pc).toFixed(2) + '%  │'; }
    const tw = tape.length, off = Math.floor(t * 12) % tw;
    for (let x = 0; x < cols; x++) { const c = tape[(x + off) % tw]; g.set(x, rows - 1, c, f.C(0.8)); }
    for (let x = 0; x < cols; x++) g.set(x, rows - 2, '▁', f.C(0.25));
  },
  book(s, f) {
    const { g, cols, rows, t } = f, q = s.sy[0], b = s.b;
    const mid = q.p, tick = Math.max(0.01, +(mid * 0.0005).toPrecision(1)), lv = Math.floor((rows - 4) / 2);
    const lw = cols >= 160 ? Math.floor(cols * 0.42) : cols - 2;
    // 欄位：買量｜買單條（往左長）｜價格｜賣單條（往右長）｜賣量
    const szW = 7, px = Math.floor(lw / 2) - 4, bR = px - 2, bL = szW + 2, bmax = Math.max(4, bR - bL), aL = px + 10, aR = lw - szW - 2, amax = Math.max(4, aR - aL);
    put(g, 1, 0, q.name + ' · order book · tick ' + tick + ' · spread ' + tick.toFixed(2), f.C(0.85));
    put(g, 1, 1, pad('SIZE', szW), f.C(0.5)); put(g, bR - 3, 1, 'BID', f.H(UPH, 0.55)); put(g, px, 1, '  PRICE', f.C(0.5)); put(g, aL, 1, 'ASK', f.H(DNH, 0.55)); put(g, aR + 1, 1, 'SIZE', f.C(0.5));
    const cy = 2 + lv;
    let cumB = 0, cumA = 0; const cb = [], ca = [];
    for (let k = 0; k < lv; k++) {
      const pa = mid + (k + 0.5) * tick, pb = mid - (k + 0.5) * tick;
      const sa = Math.floor(200 + 800 * Math.abs(Noise.n3(k * 0.4, t * 0.5, 1)) + (k % 7 === 3 ? 900 : 0)), sb = Math.floor(200 + 800 * Math.abs(Noise.n3(k * 0.4, t * 0.5, 9)) + (k % 9 === 5 ? 1100 : 0));
      cumA += sa; cumB += sb; ca.push(cumA); cb.push(cumB);
      const ya = cy - 1 - k, yb = cy + 1 + k;
      if (ya >= 2) {
        put(g, px, ya, pad(pa.toFixed(2), 8), f.H(DNH, 0.6));
        hbar(g, aL, ya, amax, sa / 2000, f.H(DNH, 0.35), f.C(0.1));
        put(g, aR + 1, ya, pad(sa, szW), f.C(0.6));
      }
      if (yb < rows - 1) {
        put(g, px, yb, pad(pb.toFixed(2), 8), f.H(UPH, 0.6));
        const L = clamp(sb / 2000, 0, 1) * bmax, n = Math.floor(L), col = f.H(UPH, 0.35);
        for (let j = 0; j < n; j++) g.set(bR - j, yb, '█', col);
        if (L - n >= 0.5 && n < bmax) g.set(bR - n, yb, '▐', col);
        put(g, 1, yb, pad(sb, szW), f.C(0.6));
      }
    }
    for (let x = 1; x < lw; x++) g.set(x, cy, '═', f.C(0.4));
    put(g, px - 1, cy, ' ' + pad(mid.toFixed(2), 8) + ' ', f.C(1));
    if (lw < cols - 20) {
      // 深度圖
      bclr(b);
      const dx0 = lw + 2, dw = Math.floor((cols - dx0) * 0.6), W2 = dw * 2, Hh2 = (rows - 4) * 4, mx = Math.max(cumA, cumB);
      for (let x = 0; x < W2; x++) {
        const half = W2 / 2, k = Math.floor(Math.abs(x - half) / half * lv), cum = x < half ? cb[Math.min(lv - 1, k)] : ca[Math.min(lv - 1, k)];
        const y = 8 + Hh2 - (cum / mx) * (Hh2 - 4);
        for (let yy = Math.ceil(y); yy < 8 + Hh2; yy += (yy - y < 2 ? 1 : 3)) bdot(b, dx0 * 2 + x, yy, yy - y < 2 ? 1 : 0.4, x < half ? 0 : 1);
      }
      bflush(g, b, (v, tg) => f.H(tg ? DNH : UPH, 0.2 + 0.4 * v));
      put(g, dx0, 1, 'depth', f.C(0.6));
      const tx = dx0 + dw + 2;
      put(g, tx, 1, 'TIME      PRICE    SIZE', f.C(0.6));
      for (let k = 0; k < Math.min(s.tr.length, rows - 3); k++) { const r = s.tr[k]; put(g, tx, 2 + k, r[0] + ' ' + pad(r[1].toFixed(2), 8) + ' ' + pad(r[2], 5), r[3] ? f.H(DNH, 0.55 - k * 0.004) : f.H(UPH, 0.55 - k * 0.004), cols); }
    }
  },
  heat(s, f) {
    const { g, cols, rows, t } = f;
    const items = [], en = f.lang === 'en', SEC = en ? SECT_EN : SECT;
    for (let k = 0; k < s.sy.length; k++) items.push({ name: s.sy[k].name, cap: s.cap[k], pc: ((s.sy[k].p / s.sy[k].open) - 1) * 100, sec: SEC[k % SECT.length] });
    for (let k = 0; k < 14; k++) { const q = s.sy[k % s.sy.length]; items.push({ name: q.name.slice(0, 2) + hx(k + 10, 1) + 'X', cap: s.cap[20 + k], pc: (((q.p / q.open) - 1) * 100) * 0.6 + Math.sin(t * 0.3 + k) * 0.8, sec: SEC[(k + 3) % SECT.length] }); }
    items.sort((a, b2) => b2.cap - a.cap);
    // 切片排版（squarified 的簡化版：交替水平、垂直切）
    const lay = (list, x, y, w, h, vert) => {
      if (!list.length) return;
      if (list.length === 1) { list[0].r = [x, y, w, h]; return; }
      const tot = list.reduce((a, b2) => a + b2.cap, 0);
      let acc = 0, k = 0; while (k < list.length - 1 && acc + list[k].cap < tot / 2) acc += list[k++].cap;
      if (k === 0) { acc = list[0].cap; k = 1; }
      const fr = acc / tot;
      if (vert) { const w1 = Math.round(w * fr); lay(list.slice(0, k), x, y, w1, h, !vert); lay(list.slice(k), x + w1, y, w - w1, h, !vert); }
      else { const h1 = Math.round(h * fr); lay(list.slice(0, k), x, y, w, h1, !vert); lay(list.slice(k), x, y + h1, w, h - h1, !vert); }
    };
    lay(items, 0, 1, cols, rows - 1, true);
    put(g, 1, 0, tr(f, '類股熱圖 · 面積 = 市值 · 顏色 = 今日漲跌', 'Sector heat map · area = market cap · color = change today'), f.C(0.9));
    for (const it of items) {
      const [x, y, w, h] = it.r; if (w < 1 || h < 1) continue;
      const pc = clamp(it.pc / 3, -1, 1), col = pc >= 0 ? f.H(DNH, 0.12 + 0.4 * pc) : f.H(UPH, 0.12 - 0.4 * pc);
      fillR(g, x, y, w, h, '█', col);
      for (let xx = x; xx < x + w; xx++) g.set(xx, y + h - 1, '▁', f.C(0.02));
      for (let yy = y; yy < y + h; yy++) g.set(x + w - 1, yy, '▕', f.C(0.02));
      if (w >= 6 && h >= 2) {
        const yc = y + Math.floor((h - 2) / 2);
        put(g, x + Math.max(0, Math.floor((w - it.name.length) / 2)), yc, it.name, f.C(1), x + w - 1);
        const ps = (it.pc >= 0 ? '+' : '') + it.pc.toFixed(2) + '%';
        if (h >= 3 || w >= 14) put(g, x + Math.max(0, Math.floor((w - ps.length) / 2)), h >= 3 ? yc + 1 : yc, h >= 3 ? ps : '', f.C(0.9), x + w - 1);
        if (h >= 5 && w >= 8 && (!en || it.sec.length <= w - 2)) put(g, x + 1, y, it.sec, f.C(0.75), x + w - 1); // 英文類股名放不下就不畫（不截成半個字）
      }
    }
  },
  multi(s, f) {
    const { g, cols, rows } = f;
    const nx = cols >= 200 ? 4 : 2, ny = cols >= 200 ? 3 : 2, tw = Math.floor(cols / nx), th = Math.floor(rows / ny);
    for (let k = 0; k < nx * ny; k++) {
      const q = s.sy[k], x0 = (k % nx) * tw, y0 = Math.floor(k / nx) * th, pc = ((q.p / q.open) - 1) * 100;
      box(g, x0, y0, tw - 1, th, f.C(0.25), null, null, 1);
      put(g, x0 + 2, y0, ' ' + q.name + ' ', f.C(0.95));
      const lab = q.p.toFixed(2) + ' ' + (pc >= 0 ? '+' : '') + pc.toFixed(2) + '% ';
      put(g, x0 + tw - lab.length - 3, y0, lab, pc >= 0 ? f.H(DNH, 0.6) : f.H(UPH, 0.6));
      this.candles(g, f, q, x0 + 2, y0 + 1, tw - 5, th - 2, 2);
    }
  },
  pnfBuild(s) {
    // 圈叉圖：格子大小 = 價格的 1%，反轉 3 格
    const q = s.sy[1], closes = q.c.map(c => c.c).concat([q.p]);
    const bx = closes[0] * 0.003;
    const cols2 = [];
    let dir = 0, top = Math.floor(closes[0] / bx), bot = top;
    for (const v of closes) {
      const lvl = Math.floor(v / bx);
      if (dir >= 0) {
        if (lvl > top) { top = lvl; dir = 1; }
        else if (lvl <= top - 3) { cols2.push({ up: true, a: bot, b: top }); dir = -1; bot = lvl; top = top - 1; }
      } else {
        if (lvl < bot) bot = lvl;
        else if (lvl >= bot + 3) { cols2.push({ up: false, a: bot, b: top }); dir = 1; top = lvl; bot = bot + 1; }
      }
    }
    cols2.push({ up: dir >= 0, a: bot, b: top, live: true });
    s.pc = cols2; s.box = bx;
  },
  pnf(s, f) {
    const { g, cols, rows, t } = f;
    const cw = 2, nc = Math.floor((cols - 10) / cw), list = s.pc.slice(-nc);
    let lo = 1e9, hi = -1e9; for (const c of list) { lo = Math.min(lo, c.a); hi = Math.max(hi, c.b); }
    const span = hi - lo + 1, H = rows - 3, sc = Math.max(1, Math.ceil(span / H));
    const Y = lv => 1 + H - 1 - Math.floor((lv - lo) / sc);
    for (let lv = lo; lv <= hi; lv += sc * Math.max(1, Math.round(4 / sc))) { const y = Y(lv); for (let x = 1; x < nc * cw; x += 2) g.set(x, y, '·', f.C(0.2)); put(g, nc * cw + 2, y, (lv * s.box).toFixed(2), f.C(0.55)); }
    list.forEach((c, k) => {
      for (let lv = c.a; lv <= c.b; lv += sc) g.set(1 + k * cw, Y(lv), c.up ? 'X' : 'O', c.live && Math.floor(t * 3) % 2 && lv + sc > c.b ? f.C(0.6) : f.C(c.up ? 0.95 : 0.7));
    });
    put(g, 1, 0, s.sy[1].name + ' · point & figure · box 0.3% · reversal 3 · last ' + s.sy[1].p.toFixed(2), f.C(0.8));
    // 現價游標與底部逐筆成交帶
    const q1 = s.sy[1], ly = clamp(Y(Math.floor(q1.p / s.box)), 1, rows - 3);
    for (let x = 1; x < nc * cw; x += 3) if (g.ch[ly * cols + x] === ' ') g.set(x, ly, '┈', f.C(0.35));
    put(g, nc * cw + 1, ly, '◄' + q1.p.toFixed(2), f.C(1));
    let tape = ''; for (const c of q1.c.slice(-40)) tape += c.c.toFixed(2) + (c.c >= c.o ? ' ↑  ' : ' ↓  ');
    const off = Math.floor(t * 16) % tape.length;
    for (let x = 0; x < cols; x++) g.set(x, rows - 1, tape[(x + off) % tape.length], f.C(0.55));
  },
});

/* ═════════ 14. 世界航線地圖（程序生成的大陸） ═════════ */
// 等高線分層色：低地綠 → 黃 → 橙 → 紅，最高一層是雪白（-1）
const CT_HUE = [120, 90, 60, 38, 18, -1];
const CODES = 'KRX VOL MIR SEN TAL ORU BEX NAV QIR ZEL HOK PAM DUR LYS ARC VEN KOS TAR ILO MEB SUV RAN GOL YEM FAR NIX OBE CAL TEZ WUN'.split(' ');
A({ id: 'te-map', name: '航線地圖', cat: '科技', theme: 'ocean', hue: true, desc: '點陣大陸上一條條飛行航線弧線',
  params: { mode: 'flights' },
  variants: [
    { id: 'night', name: '晝夜線', theme: 'gold', desc: '晨昏線移動，夜側城市燈火亮起', params: { mode: 'night' } },
    { id: 'orbit', name: '衛星軌跡', theme: 'mint', desc: '衛星的正弦軌跡、覆蓋圈與遙測面板', params: { mode: 'orbit' } },
    { id: 'pings', name: '連線脈衝', theme: 'cyber', desc: '城市間光束一閃即逝，兩端擴散雙圈', params: { mode: 'pings' } },
    { id: 'contour', name: '等高線圖', theme: 'forest', desc: '依高度分層的等高線，一條條輪流亮起', params: { mode: 'contour' } },
    { id: 'quake', name: '地震監測', theme: 'sunset', desc: '震央圓圈擴散，側欄列出最新事件', params: { mode: 'quake' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f;
    const n = cols * rows, E = new Float32Array(n), seed = rnd(0, 50);
    s.W = cols; s.Hm = rows - 1;
    const H = s.Hm;
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - (y + 0.5) / H) * Math.PI;
      for (let x = 0; x < cols; x++) {
        const lon = (x / cols) * TAU, cx = Math.cos(lat) * Math.cos(lon), cy = Math.cos(lat) * Math.sin(lon), cz = Math.sin(lat);
        E[y * cols + x] = Noise.fbm(cx * 1.6 + seed, cy * 1.6, cz * 1.6, 4) - Math.abs(cz) * 0.18 + (Math.abs(cz) > 0.93 ? 0.35 : 0);
      }
    }
    const sorted = Array.from(E.subarray(0, H * cols)).sort((a, b) => a - b), th = sorted[Math.floor(sorted.length * 0.68)];
    s.land = new Uint8Array(n); s.elev = new Float32Array(n);
    const emax = sorted[sorted.length - 1] - th;
    for (let i = 0; i < H * cols; i++) { s.land[i] = E[i] > th ? 1 : 0; s.elev[i] = (E[i] - th) / (E[i] > th ? emax : -(sorted[0] - th)); }
    s.coast = new Uint8Array(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < cols; x++) { const i = y * cols + x; if (!s.land[i]) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = (x + dx + cols) % cols, yy = y + dy; if (yy >= 0 && yy < H && !s.land[yy * cols + xx]) { s.coast[i] = 1; break; } } }
    // 城市：放在陸地上，彼此保持距離
    s.cities = [];
    for (let tries = 0; tries < 4000 && s.cities.length < (cols >= 200 ? 30 : 14); tries++) {
      const x = rint(1, cols - 2), y = rint(2, H - 3);
      if (!s.land[y * cols + x] || Math.abs(y - H / 2) > H * 0.4) continue;
      if (s.cities.some(c => Math.hypot(c.x - x, (c.y - y) * 2) < cols / 14)) continue;
      s.cities.push({ x, y, code: CODES[s.cities.length % CODES.length], ring: 0 });
    }
    s.fl = []; s.ev = []; s.ships = []; s.sats = [];
    const nf = cols >= 200 ? 26 : 10;
    if (p.mode === 'flights') for (let k = 0; k < nf; k++) s.fl.push(this.flight(s, f, true));
    s.bm = [];
    if (p.mode === 'contour') this.contourInit(s, f);
    if (p.mode === 'orbit') for (let k = 0; k < (cols >= 200 ? 4 : 2); k++) s.sats.push({ ph: rnd(0, TAU), inc: rnd(0.35, 0.85), sp: rnd(0.035, 0.06), lon0: rnd(0, TAU), name: 'TE-SAT ' + (k + 1), alt: rint(420, 1200) });
    if (p.mode === 'ships') {
      for (let k = 0; k < (cols >= 200 ? 70 : 22); k++) { let x, y, tries = 0; do { x = rnd(0, cols); y = rnd(2, H - 2); } while (s.land[Math.floor(y) * cols + Math.floor(x)] && tries++ < 200); s.ships.push({ x, y, a: rnd(0, TAU), tr: [] }); }
    }
    s.evT = 0; s.cnt = rint(1000, 9000);
  },
  contourInit(s, f) {
    const { cols, aspect } = f, H = s.Hm, n = cols * f.rows;
    s.lv = new Int8Array(n); s.cc = new Array(n).fill('');
    // 先把高度場模糊兩次，等高線才會是平順的曲線而不是一堆碎點
    let E = Float32Array.from(s.elev), E2 = new Float32Array(n);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < cols; x++) { let sum = 0, c = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { sum += E[yy * cols + (((x + dx) % cols) + cols) % cols]; c++; } } E2[y * cols + x] = sum / c; }
      const tmp = E; E = E2; E2 = tmp;
    }
    s.sm = E;
    for (let i = 0; i < H * cols; i++) { const e = E[i]; s.lv[i] = s.land[i] ? 1 + Math.min(5, Math.floor(Math.pow(Math.max(0, e), 0.7) * 7)) : e > -0.18 ? -1 : -2; }
    const at = (x, y) => E[clamp(y, 0, H - 1) * cols + (((x % cols) + cols) % cols)], lvAt = (x, y) => s.lv[clamp(y, 0, H - 1) * cols + (((x % cols) + cols) % cols)];
    for (let y = 0; y < H; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, lv = s.lv[i];
      if (!(lvAt(x - 1, y) < lv || lvAt(x + 1, y) < lv || (y > 0 && lvAt(x, y - 1) < lv) || (y < H - 1 && lvAt(x, y + 1) < lv))) continue;
      // 等高線方向和坡度垂直（等向座標）
      const gX = (at(x + 1, y) - at(x - 1, y)) / 2, gY = (at(x, y + 1) - at(x, y - 1)) / (2 * aspect), Tx = -gY, Ty = gX;
      let b = Math.abs(Math.atan2(Ty, Tx) * 180 / Math.PI); if (b > 90) b = 180 - b;
      s.cc[i] = b < 28 ? '─' : b > 76 ? '│' : Tx * Ty < 0 ? '╱' : '╲';
    }
    s.peaks = [];
    const idx = []; for (let i = 0; i < H * cols; i++) if (s.land[i] && s.elev[i] > 0.55) idx.push(i);
    idx.sort((a, b) => s.elev[b] - s.elev[a]);
    for (const i of idx) { const x = i % cols, y = Math.floor(i / cols); if (x > cols - 8 || s.peaks.some(q => Math.hypot(q.x - x, (q.y - y) * 2) < cols / 8)) continue; s.peaks.push({ x, y, h: Math.round(s.elev[i] * 2000 + 200) }); if (s.peaks.length >= (cols >= 200 ? 8 : 4)) break; }
  },
  flight(s, f, init) {
    const a = pick(s.cities), b = pick(s.cities.filter(c => c !== a));
    let dx = b.x - a.x; if (Math.abs(dx) > s.W / 2) dx -= Math.sign(dx) * s.W;
    const d = Math.hypot(dx, (b.y - a.y) * 2);
    return { a, b, dx, h: d * 0.22, u: init ? rnd(0, 1) : 0, sp: (f.cols >= 200 ? 14 : 8) / Math.max(10, d), hue: pick([30, 190, 300, 55, 120]) };
  },
  fpos(s, q, u) { let x = q.a.x + q.dx * u; x = ((x % s.W) + s.W) % s.W; return [x, q.a.y + (q.b.y - q.a.y) * u - q.h * Math.sin(Math.PI * u) * 0.5]; },
  drawLand(s, f, dim, nightFn) {
    const { g, cols } = f, ch = g.ch, co = g.co, H = s.Hm;
    for (let y = 0; y < H; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (s.land[i]) {
        const nf = nightFn ? nightFn(x, y) : 0;
        ch[i] = s.coast[i] ? '•' : '·'; co[i] = f.C((s.coast[i] ? 0.55 : 0.38) * dim * (1 - nf * 0.6));
      } else if (y % Math.round(H / 6) === 0 && x % 2 === 0 || x % Math.round(cols / 12) === 0 && y % 2 === 0) { ch[i] = '·'; co[i] = f.C(0.1 * dim); }
    }
  },
  frame(s, f) {
    const { g, cols, rows, dt, t, p, aspect } = f, H = s.Hm, ch = g.ch, co = g.co, m = p.mode;
    if (m === 'contour') {
      // 等高線：固定高度間隔畫線、依高度分層上色；每隔一下高亮一條等高線往上爬
      const hi = Math.floor(t * 0.9) % 8, hl = hi < 2 ? hi - 2 : hi - 1;
      for (let y = 0; y < H; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x, lv = s.lv[i], c = s.cc[i];
        if (lv > 0) {
          const hue = CT_HUE[lv - 1], on = lv === hl;
          if (c) { ch[i] = c; co[i] = on ? f.C(1) : hue < 0 ? f.C(0.85) : f.H(hue, 0.5 + 0.03 * lv); }
          else { ch[i] = (x + y) % 2 ? '·' : ' '; co[i] = hue < 0 ? f.C(0.35) : f.H(hue, 0.2 + 0.03 * lv); }
        } else {
          const on = lv === hl;
          if (c) { ch[i] = c; co[i] = on ? f.C(0.95) : f.H(205, 0.3 + 0.05 * lv); }
          else { const w = Math.sin(x * 0.35 + y * 0.8 - t * 1.2 + s.elev[i] * 5); if (w > 0.75) { ch[i] = '~'; co[i] = f.H(210, 0.12 + 0.08 * (w - 0.75) * 4); } }
        }
      }
      for (const pk of s.peaks) { g.set(pk.x, pk.y, '▲', f.C(0.95)); put(g, pk.x + 2, pk.y, String(pk.h), f.C(0.7)); }
      const hm = hl > 0 ? hl * 400 + ' m' : hl * 2000 + ' m';
      this.footer(s, f, 'CONTOUR MAP · land 400 m / sea 2000 m interval · highlight ' + hm);
      return;
    }
    if (m === 'night') {
      const sl = (t * 0.06) % 1, term = (x, y) => { const lon = (x / cols) * TAU, lat = (0.5 - y / H) * Math.PI, sun = Math.cos(lon - sl * TAU) * Math.cos(lat) * Math.cos(0.3) + Math.sin(lat) * Math.sin(0.3); return clamp(0.5 - sun * 3, 0, 1); };
      for (let y = 0; y < H; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x, nf = term(x, y);
        if (s.land[i]) {
          const light = nf > 0.6 && (hash2(x, y) % 9 === 0 || s.coast[i] && hash2(x, y * 3) % 4 === 0);
          ch[i] = light ? '∙' : s.coast[i] ? '•' : '·';
          co[i] = light ? f.H(45, 0.45 + 0.25 * ((hash2(x, y) % 5) / 5) + 0.05 * Math.sin(t * 3 + x)) : f.H(110 - 60 * nf, (s.coast[i] ? 0.5 : 0.36) * (1 - nf * 0.7));
        } else if (nf > 0.05 && nf < 0.95 && (x + y) % 2 === 0) { ch[i] = '░'; co[i] = f.C(0.08); }
      }
      for (const c of s.cities) { const nf = term(c.x, c.y); g.set(c.x, c.y, '●', nf > 0.5 ? f.H(45, 0.75) : f.C(0.5)); }
      this.footer(s, f, 'DAY / NIGHT · UTC ' + fmtT(sl * 86400).slice(0, 5) + ' · subsolar ' + Math.round(sl * 360 - 180) + '°');
      return;
    }
    if (m === 'pings') {
      // 連線脈衝：瞬間亮起的直線光束、兩端擴散雙圈，地圖壓暗；事件清單在右側
      const pw = cols >= 160 ? 26 : 18, mapW = cols - pw - 1;
      s.evT -= dt;
      if (s.evT <= 0) {
        s.evT = rnd(0.12, 0.45) * (cols >= 200 ? 0.6 : 1);
        const cand = s.cities.filter(c => c.x < mapW - 2), a = pick(cand), b = pick(cand.filter(c => c !== a));
        if (a && b) { const ms = rint(12, 480); s.bm.push({ a, b, age: 0, hue: pick([190, 300, 50, 120, 20]), ms }); s.cnt++; s.ev.unshift([a.code + '→' + b.code, ms]); if (s.ev.length > 60) s.ev.pop(); }
      }
      // 地圖（壓暗）
      for (let y = 0; y < H; y++) for (let x = 0; x < mapW; x++) { const i = y * cols + x; if (s.land[i]) { ch[i] = s.coast[i] ? '•' : '·'; co[i] = f.C(s.coast[i] ? 0.26 : 0.15); } }
      for (let k = s.bm.length - 1; k >= 0; k--) {
        const q = s.bm[k]; q.age += dt;
        if (q.age > 1.6) { kill(s.bm, k); continue; }
        const br = q.age < 0.12 ? 1 : Math.max(0, 1 - (q.age - 0.12) / 0.9), dx = q.b.x - q.a.x, dy = q.b.y - q.a.y, n = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
        if (br > 0) {
          const c = slopeCh(dx, dy, aspect), col = f.H(q.hue, 0.2 + 0.65 * br);
          for (let j = 1; j < n; j++) { const x = Math.round(q.a.x + (dx * j) / n), y = Math.round(q.a.y + (dy * j) / n), i = y * cols + x; if (x < mapW && ch[i] !== '◉') { ch[i] = c; co[i] = col; } }
        }
        // 兩端的雙圈
        for (const [c0, d0] of [[q.a, 0], [q.b, 0.15]]) {
          const ag = q.age - d0; if (ag <= 0) continue;
          for (const r of [ag * 7, ag * 7 - 2]) {
            if (r <= 0.3) continue;
            const fd = Math.max(0, 1 - ag / 1.4), np = Math.max(10, Math.round(r * 6));
            for (let a2 = 0; a2 < np; a2++) { const xx = Math.round(c0.x + Math.cos((a2 / np) * TAU) * r * 1.2), yy = Math.round(c0.y + (Math.sin((a2 / np) * TAU) * r) / aspect * 1.2); if (xx >= 0 && xx < mapW && yy >= 0 && yy < H) g.set(xx, yy, '·', f.H(q.hue, 0.15 + 0.5 * fd)); }
          }
          g.set(c0.x, c0.y, '◉', f.H(q.hue, 0.5 + 0.4 * br));
        }
      }
      for (const c of s.cities) { const i = c.y * cols + c.x; if (c.x < mapW && (ch[i] === ' ' || ch[i] === '·' || ch[i] === '•')) g.set(c.x, c.y, '∘', f.C(0.5)); }
      // 右側事件清單
      clearR(g, mapW, 0, pw + 1, H);
      for (let y = 0; y < H; y++) g.set(mapW, y, '│', f.C(0.25));
      put(g, mapW + 2, 0, 'EVENTS', f.C(0.8));
      for (let k = 0; k < Math.min(s.ev.length, H - 2); k++) { const e = s.ev[k], txt = e[0] + ' ' + pad(e[1], 3) + 'ms'; put(g, mapW + 2, 1 + k, txt, k === 0 ? f.C(1) : f.C(Math.max(0.25, 0.75 - k * 0.02)), cols); }
      this.footer(s, f, 'TRAFFIC · ' + s.cnt + ' sessions · ' + s.bm.length + ' live links');
      return;
    }
    this.drawLand(s, f, 1);
    if (m === 'flights') {
      for (let k = 0; k < s.fl.length; k++) {
        const q = s.fl[k];
        q.u += dt * q.sp;
        if (q.u >= 1) { q.b.ring = 1; s.fl[k] = this.flight(s, f, false); s.cnt++; continue; }
        for (let u = 0; u < 1; u += 0.5 / Math.max(10, Math.abs(q.dx) + q.h)) { const [x, y] = this.fpos(s, q, u); const i = Math.round(y) * cols + Math.round(x) % cols; if (y >= 0 && y < H && ch[i] !== '●') { ch[i] = u < q.u ? '·' : '˙'; co[i] = f.H(q.hue, u < q.u ? 0.35 : 0.18); } }
        for (let j = 0; j < 6; j++) { const u = q.u - j * 0.012; if (u < 0) break; const [x, y] = this.fpos(s, q, u); g.set(Math.round(x), Math.round(y), j ? '•' : '●', f.H(q.hue, 0.8 - j * 0.08)); }
      }
      this.cityDraw(s, f);
      this.footer(s, f, 'LIVE FLIGHTS · ' + s.fl.length + ' airborne · ' + s.cnt + ' landed today');
      return;
    }
    if (m === 'orbit') {
      for (const st of s.sats) {
        st.ph += dt * st.sp;
        // 地面軌跡：過去一圈畫成點線
        for (let k = 0; k < 400; k++) {
          const ph = st.ph - k * 0.016, lon = st.lon0 + ph * 0.92 - st.ph * 0.0, lat = Math.asin(Math.sin(st.inc) * Math.sin(ph));
          const x = Math.round((((lon / TAU) % 1) + 1) % 1 * cols), y = Math.round((0.5 - lat / Math.PI) * H);
          if (k % 2 === 0 && y >= 0 && y < H) g.set(x, y, k < 40 ? '•' : '·', f.H(50, 0.65 - k * 0.0012));
        }
        const lon = st.lon0 + st.ph * 0.92, lat = Math.asin(Math.sin(st.inc) * Math.sin(st.ph));
        const x = (((lon / TAU) % 1) + 1) % 1 * cols, y = (0.5 - lat / Math.PI) * H, R = cols * 0.06;
        for (let a = 0; a < 48; a++) { const xx = Math.round(x + Math.cos((a / 48) * TAU) * R), yy = Math.round(y + (Math.sin((a / 48) * TAU) * R) / aspect); if (yy >= 0 && yy < H) g.set(((xx % cols) + cols) % cols, yy, '·', f.H(190, 0.5)); }
        g.set(Math.round(x), Math.round(y), '✦', f.C(1));
        put(g, Math.round(x) + 2, Math.round(y) - 1, st.name, f.C(0.85));
        st.lat = lat; st.lon = lon;
      }
      if (cols >= 140) {
        const pw = 30, x0 = cols - pw - 1;
        clearR(g, x0, 1, pw, s.sats.length * 6 + 2);
        box(g, x0, 1, pw, s.sats.length * 6 + 2, f.C(0.4), 'TELEMETRY', f.C(0.85), 1);
        s.sats.forEach((st, k) => {
          const y = 2 + k * 6, deg = v => (v * 180 / Math.PI);
          put(g, x0 + 2, y, st.name, f.H(50, 0.7));
          put(g, x0 + 2, y + 1, 'LAT ' + pad(deg(st.lat || 0).toFixed(2), 7) + '  LON ' + pad((((deg(st.lon || 0) % 360) + 540) % 360 - 180).toFixed(1), 6), f.C(0.7));
          put(g, x0 + 2, y + 2, 'ALT ' + (st.alt + Math.round(Math.sin(t * 0.2 + k) * 3)) + ' km  V ' + (7.6 + 0.01 * Math.sin(t + k)).toFixed(3), f.C(0.7));
          put(g, x0 + 2, y + 3, 'SIG', f.C(0.5)); hbar(g, x0 + 6, y + 3, pw - 9, 0.55 + 0.4 * Math.sin(t * 0.7 + k * 2), f.H(120, 0.55), f.C(0.15), '·');
          put(g, x0 + 2, y + 4, 'BAT ' + (78 + Math.round(10 * Math.sin(t * 0.05 + k))) + '%  TEMP ' + (12 + Math.round(5 * Math.sin(t * 0.1 + k))) + '°C', f.C(0.6));
        });
      }
      this.footer(s, f, 'GROUND TRACKS · ' + s.sats.length + ' satellites · AOS ' + fmtT(30000 + t * 13).slice(0, 5));
      return;
    }
    if (m === 'quake') {
      s.evT -= dt;
      if (s.evT <= 0) {
        s.evT = rnd(0.6, 2.2);
        let x, y, tries = 0;
        do { x = rint(0, cols - 1); y = rint(1, H - 2); } while (!(s.coast[y * cols + x] || (s.land[y * cols + x] && Math.random() < 0.2)) && tries++ < 300);
        const mag = Math.min(8.4, 2.5 + -Math.log(Math.random() + 1e-6) * 0.9);
        s.ev.unshift({ x, y, mag, age: 0, tm: fmtT(36000 + t * 30), dep: rint(5, 600) });
        if (s.ev.length > 30) s.ev.pop();
      }
      for (const e of s.ev) {
        e.age += dt;
        if (e.age > 14) continue;
        const R = (e.age * 4 * (e.mag / 4)) % (e.mag * 3 + 4), fade = 1 - e.age / 14, hue = e.mag > 6 ? 0 : e.mag > 4.5 ? 30 : 55;
        for (const rr of [R, R * 0.6]) for (let a = 0; a < Math.max(12, rr * 6); a++) { const ang = (a / Math.max(12, rr * 6)) * TAU, xx = Math.round(e.x + Math.cos(ang) * rr * 1.1), yy = Math.round(e.y + (Math.sin(ang) * rr) / aspect * 1.1); if (yy >= 0 && yy < H) g.set(((xx % cols) + cols) % cols, yy, '·', f.H(hue, 0.25 + 0.4 * fade * (rr === R ? 1 : 0.6))); }
        g.set(e.x, e.y, e.mag > 6 ? '◉' : '●', f.H(hue, 0.4 + 0.4 * fade));
        if (e.mag > 4.5) put(g, e.x + 2, e.y, 'M' + e.mag.toFixed(1), f.H(hue, 0.4 + 0.4 * fade));
      }
      if (cols >= 160) {
        const x0 = cols - 34;
        clearR(g, x0, 1, 33, Math.min(s.ev.length, H - 3) + 2);
        put(g, x0 + 1, 1, 'TIME      MAG   DEPTH  LOC', f.C(0.8));
        for (let k = 0; k < Math.min(s.ev.length, H - 4); k++) { const e = s.ev[k]; put(g, x0 + 1, 2 + k, e.tm + '  ' + e.mag.toFixed(1) + '  ' + pad(e.dep, 4) + 'km  ' + pad0(e.x, 3) + ',' + pad0(e.y, 2), f.H(e.mag > 6 ? 0 : e.mag > 4.5 ? 30 : 55, 0.6 - k * 0.01)); }
      }
      this.footer(s, f, 'SEISMIC NETWORK · ' + s.ev.filter(e => e.age < 14).length + ' active events · largest M' + Math.max(0, ...s.ev.map(e => e.mag)).toFixed(1));
      return;
    }
    if (m === 'ships') {
      for (const sh of s.ships) {
        const fl = Noise.n3(sh.x * 0.03, sh.y * 0.06, t * 0.05) * TAU * 1.5;
        sh.a += (fl - sh.a) * dt * 0.3;
        let nx = sh.x + Math.cos(sh.a) * dt * 1.8, ny = sh.y + (Math.sin(sh.a) * dt * 1.8) / aspect;
        nx = (nx + cols) % cols;
        if (ny < 1 || ny >= H - 1 || s.land[Math.floor(ny) * cols + Math.floor(nx)]) { sh.a += Math.PI * rnd(0.6, 1.4); continue; }
        sh.x = nx; sh.y = ny;
        const last = sh.tr[sh.tr.length - 1];
        if (!last || Math.hypot(last[0] - sh.x, last[1] - sh.y) > 0.8) { sh.tr.push([sh.x, sh.y]); if (sh.tr.length > 14) sh.tr.shift(); }
        sh.tr.forEach(([x, y], k) => { const i = Math.floor(y) * cols + Math.floor(x); if (ch[i] === ' ') { ch[i] = '·'; co[i] = f.H(200, 0.15 + 0.03 * k); } });
        const dir = Math.cos(sh.a) > 0 ? '▸' : '◂';
        g.set(Math.floor(sh.x), Math.floor(sh.y), dir, f.H(40, 0.7));
      }
      for (const c of s.cities) if (s.coast[c.y * cols + c.x]) g.set(c.x, c.y, '◘', f.C(0.7));
      this.footer(s, f, 'AIS · ' + s.ships.length + ' vessels tracked · avg 14.2 kn');
    }
  },
  cityDraw(s, f) {
    const { g, dt, cols } = f;
    for (const c of s.cities) {
      c.ring = Math.max(0, c.ring - dt * 1.2);
      if (c.ring > 0) { const r = (1 - c.ring) * 3 + 0.5; for (let a = 0; a < 16; a++) g.set(Math.round(c.x + Math.cos((a / 16) * TAU) * r * 2), Math.round(c.y + Math.sin((a / 16) * TAU) * r), '·', f.C(0.3 + 0.6 * c.ring)); }
      g.set(c.x, c.y, '◆', f.C(0.95));
      if (cols >= 160) put(g, c.x + 2, c.y, c.code, f.C(0.55));
    }
  },
  footer(s, f, txt) {
    const { g, cols, rows } = f;
    fillR(g, 0, rows - 1, cols, 1, ' ', f.C(0.5));
    put(g, 1, rows - 1, txt, f.C(0.75));
    const clk = 'UTC ' + fmtT(43200 + f.t);
    put(g, cols - clk.length - 1, rows - 1, clk, f.C(0.6));
  },
});

/* ═════════ 15. 神經網路 ═════════ */
// 卷積：八個 3×3 卷積核與名稱、四個分類
const CV_K = [[[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], [[-1, -2, -1], [0, 0, 0], [1, 2, 1]], [[2, 1, 0], [1, 0, -1], [0, -1, -2]], [[0, 1, 2], [-1, 0, 1], [-2, -1, 0]], [[0, -1, 0], [-1, 4, -1], [0, -1, 0]], [[1, 2, 1], [2, 4, 2], [1, 2, 1]], [[0, -1, 0], [-1, 5, -1], [0, -1, 0]], [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]]];
const CV_KN = ['edge-x', 'edge-y', 'diag-a', 'diag-b', 'laplace', 'blur', 'sharpen', 'emboss'], CV_CLS = ['ring', 'cross', 'line', 'blob'];
const CV_N = CV_K.map(K => 2.5 / K.flat().reduce((a, v) => a + Math.abs(v), 0));
const TOK = ['the', 'small', 'robot', 'reads', 'old', 'maps', 'at', 'night', 'and', 'dreams', 'of', 'stars'];
A({ id: 'te-neural', name: '神經網路', cat: '科技', theme: 'ice', hue: true, desc: '訊號一層層前饋，誤差再反向傳回',
  params: { mode: 'mlp' },
  variants: [
    { id: 'deep', name: '深層網路', theme: 'lavender', desc: '十幾層窄網路，脈衝接力橫越畫面', params: { mode: 'deep' } },
    { id: 'conv', name: '卷積', theme: 'mint', desc: '卷積核滑過影像，特徵圖逐格填滿', params: { mode: 'conv' } },
    { id: 'rnn', name: '循環網路', theme: 'amber', desc: '展開的循環單元逐字讀入句子', params: { mode: 'rnn' } },
    { id: 'attn', name: '注意力', theme: 'neon', desc: '注意力矩陣與字詞之間的連線弧', params: { mode: 'attn' } },
    { id: 'train', name: '訓練曲線', theme: 'matrix', desc: '損失下降、準確率上升與訓練紀錄', params: { mode: 'train' } },
    { id: 'weights', name: '權重矩陣', theme: 'synth', desc: '大片權重色塊隨梯度更新而波動', params: { mode: 'weights' } },
  ],
  init(s, f) {
    const { cols, rows, p } = f, big2 = cols >= 200;
    s.b = bnew(cols, rows); s.ph = 0; s.ep = rint(1, 9); s.loss = rnd(0.6, 1.2);
    const m = p.mode;
    if (m === 'mlp' || m === 'deep') {
      const L = m === 'mlp' ? (big2 ? [6, 10, 12, 12, 10, 4] : [4, 7, 8, 6, 3]) : Array.from({ length: big2 ? 14 : 8 }, (_, k) => (k === 0 ? 4 : k === (big2 ? 13 : 7) ? 3 : rint(big2 ? 6 : 4, big2 ? 9 : 6)));
      s.L = L; s.nodes = []; s.W = [];
      const x0 = big2 ? 18 : 8, x1 = cols - (big2 ? 26 : 12);
      L.forEach((n, l) => { const row = []; for (let k = 0; k < n; k++) row.push({ x: x0 + ((x1 - x0) * l) / (L.length - 1), y: 2 + ((rows - 5) * (k + 0.5)) / n, a: 0, g: 0 }); s.nodes.push(row); });
      // 深層網路：每顆神經元只接下一層最近的 2–3 顆（稀疏連線，一眼就看得出層層接力）
      s.M = null;
      if (m === 'deep') {
        s.M = [];
        for (let l = 0; l < L.length - 1; l++) {
          const A2 = s.nodes[l], B2 = s.nodes[l + 1], mk = [];
          for (let a = 0; a < L[l]; a++) {
            const near = B2.map((q, k) => [Math.abs(q.y - A2[a].y), k]).sort((u, v) => u[0] - v[0]), r = new Uint8Array(L[l + 1]), nn = rint(2, 3);
            for (let k = 0; k < Math.min(nn, near.length); k++) r[near[k][1]] = 1;
            mk.push(r);
          }
          for (let k = 0; k < L[l + 1]; k++) if (!mk.some(r => r[k])) { let best = 0; for (let a = 1; a < L[l]; a++) if (Math.abs(A2[a].y - B2[k].y) < Math.abs(A2[best].y - B2[k].y)) best = a; mk[best][k] = 1; }
          s.M.push(mk);
        }
      }
      this.initW(s);
      s.cyc = 0; s.run = rint(1, 40);
      this.sample(s);
    }
    if (m === 'conv') { s.img = null; this.mkImg(s); this.mkImg(s); s.kp = 0; }
    if (m === 'rnn') { s.step = 0; s.stT = 0; s.sent = this.mkSent(); }
    if (m === 'attn') { s.head = 0; s.hT = 0; s.A = this.mkAttn(); s.A2 = this.mkAttn(); }
    if (m === 'train') { s.lossH = []; s.accH = []; s.tl = []; s.st = 0; s.acc = 0; s.ep = 1; s.EP = 30; for (let k = 0; k < rows * 0.6; k++) this.trainStep(s); }
    if (m === 'weights') { s.wr = Math.max(8, rows - 9); s.wc = Math.floor((cols - 4) / 2); s.w = new Float32Array(s.wr * s.wc); for (let i = 0; i < s.w.length; i++) s.w[i] = gauss() * 0.5; s.ur = 0; s.hot = new Float32Array(s.wr); }
  },
  initW(s) {
    const L = s.L; s.W = [];
    for (let l = 0; l < L.length - 1; l++) { const w = []; for (let a = 0; a < L[l]; a++) { const r = []; for (let b = 0; b < L[l + 1]; b++) r.push(s.M && !s.M[l][a][b] ? 0 : gauss() * (s.M ? 1.4 : 0.7)); w.push(r); } s.W.push(w); }
  },
  sample(s) { s.inp = s.L ? Array.from({ length: s.L[0] }, () => Math.random()) : []; s.ph = 0; s.lab = rint(0, (s.L ? s.L[s.L.length - 1] : 4) - 1); },
  mkImg(s) {
    // 四種形狀：圓環、十字、斜線、實心團塊；上一張留著給特徵圖當底
    if (s.img) s.prev = s.img.slice(); else s.img = new Float32Array(256);
    const cx = rnd(5, 10), cy = rnd(5, 10), r = rnd(3, 5), sh = rint(0, 3);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const v = sh === 0 ? 1 - Math.abs(d - r) / 1.3 : sh === 1 ? (Math.abs(x - cx) < 1.4 || Math.abs(y - cy) < 1.4 ? 1 : 0) * (d < r + 2 ? 1 : 0) : sh === 2 ? (Math.abs(x - y - (cx - cy)) < 1.5 && d < r + 3 ? 1 : 0) : clamp(r + 0.8 - d, 0, 1);
      s.img[y * 16 + x] = clamp(v, 0, 1) + Math.random() * 0.08;
    }
    s.cls = sh; s.lg = [0, 1, 2, 3].map(() => rnd(-0.6, 0.9)); s.km = (s.km || 0) + 1;
  },
  mkSent() { const n = rint(6, 9), w = []; for (let k = 0; k < n; k++) w.push(TOK[(k * 3 + rint(0, 11)) % TOK.length]); return w; },
  mkAttn() { const n = TOK.length, A2 = new Float32Array(n * n); for (let i = 0; i < n; i++) { let sum = 0; const f2 = rint(0, 3); for (let j = 0; j < n; j++) { const v = Math.exp(-Math.abs(i - j - (f2 === 0 ? 0 : f2 === 1 ? 1 : f2 === 2 ? -2 : (i % 3) - 1)) * rnd(0.5, 1.5)) + (Math.random() < 0.1 ? rnd(0.5, 1.5) : 0); A2[i * n + j] = v; sum += v; } for (let j = 0; j < n; j++) A2[i * n + j] /= sum; } return A2; },
  trainStep(s) {
    s.st++;
    s.loss = Math.max(0.03, s.loss * 0.985 + gauss() * 0.02 + 0.003);
    const acc = clamp(1 - s.loss * 0.55 + gauss() * 0.01, 0, 0.995);
    s.lossH.push(s.loss); s.accH.push(acc); if (s.lossH.length > 2000) { s.lossH.shift(); s.accH.shift(); }
    if (s.st % 25 === 0) { s.ep++; s.tl.push('epoch ' + pad(s.ep, 2) + '/' + s.EP + '  loss ' + s.loss.toFixed(4) + '  acc ' + (acc * 100).toFixed(2) + '%  val ' + (acc * 100 - rnd(0.5, 3)).toFixed(2) + '%  lr ' + (0.001 * Math.pow(0.95, s.ep)).toExponential(2)); if (s.tl.length > 60) s.tl.shift(); }
    if (s.ep > s.EP) { s.ep = 1; s.loss = rnd(0.9, 1.3); s.lossH = []; s.accH = []; s.tl.push('── new run · seed ' + rint(1000, 9999) + ' ──'); }
  },
  frame(s, f) { this[f.p.mode](s, f); },
  mlp(s, f) {
    const { g, cols, rows, dt, t } = f, b = s.b, L = s.L, NL = L.length;
    s.ph += dt * (f.p.mode === 'deep' ? 2.6 : 1.4);
    const fw = NL - 1, total = fw * 2 + 1.5;
    if (s.ph > total) {
      this.sample(s); s.cyc++; s.ep++;
      // 權重小步更新並且衰減，不會越跑越大；每 40 輪換一次新的訓練
      for (let l = 0; l < s.W.length; l++) for (let j = 0; j < s.W[l].length; j++) { const r = s.W[l][j]; for (let k = 0; k < r.length; k++) if (!s.M || s.M[l][j][k]) r[k] = r[k] * 0.99 + gauss() * 0.05; }
      s.loss = Math.max(0.05, s.loss * 0.95);
      if (s.cyc >= 40) { s.cyc = 0; s.run++; s.ep = 1; s.loss = rnd(0.6, 1.2); this.initW(s); }
    }
    const ph = s.ph, back = ph > fw + 0.5 ? fw - (ph - fw - 0.5) : -1;
    // 啟動值
    s.nodes[0].forEach((n, k) => (n.a = s.inp[k]));
    for (let l = 1; l < NL; l++) s.nodes[l].forEach((n, k) => { let v = 0; s.nodes[l - 1].forEach((m, j) => (v += m.a * s.W[l - 1][j][k])); n.a = 1 / (1 + Math.exp(-v)); });
    bclr(b);
    for (let l = 0; l < NL - 1; l++) {
      const A2 = s.nodes[l], B2 = s.nodes[l + 1];
      for (let j = 0; j < A2.length; j++) for (let k = 0; k < B2.length; k++) {
        if (s.M && !s.M[l][j][k]) continue;
        const w = s.W[l][j][k], aw = Math.abs(w), st = Math.min(1, aw), ax = A2[j].x * 2 + 2, ay = A2[j].y * 4 + 2, bx = B2[k].x * 2 - 1, by = B2[k].y * 4 + 2;
        const strong = s.M ? true : aw > (cols >= 200 ? 0.9 : 0.72);
        // 強權重畫實線；弱權重只畫稀疏的暗點，避免整片糊成一團
        if (strong) bline(b, ax, ay, bx, by, 0.18 + 0.3 * st, w > 0 ? 0 : 1);
        else if (aw > 0.25) { const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))); for (let q = 0; q <= n; q += 5) bdot(b, ax + ((bx - ax) * q) / n, ay + ((by - ay) * q) / n, 0.04, w > 0 ? 0 : 1); }
        // 前饋脈衝
        const u = ph - l;
        if (u > 0 && u < 1 && strong) { const px = ax + (bx - ax) * u, py = ay + (by - ay) * u; bdot(b, px, py, 1, 2); bdot(b, px - (bx - ax) * 0.02, py - (by - ay) * 0.02, 0.8, 2); }
        const ub = back - l;
        if (back >= 0 && ub > 0 && ub < 1 && strong && st > 0.45) { const px = ax + (bx - ax) * ub, py = ay + (by - ay) * ub; bdot(b, px, py, 1, 3); }
      }
    }
    bflush(g, b, (v, tg) => (tg === 2 ? f.H(55, 0.75) : tg === 3 ? f.H(0, 0.65) : f.H(tg ? 300 : 190, 0.15 + 0.4 * v)));
    s.nodes.forEach((row, l) => row.forEach((n, k) => {
      const lit = ph >= l || l === 0, v = lit ? n.a : 0.1, x = Math.round(n.x), y = Math.round(n.y);
      g.set(x, y, '●', f.H(190 + 120 * (1 - v), 0.25 + 0.6 * v)); g.set(x - 1, y, '(', f.C(0.4)); g.set(x + 1, y, ')', f.C(0.4));
      if (l === NL - 1 && cols >= 60) { const bw = Math.min(14, cols - x - 8); put(g, x + 3, y, String.fromCharCode(65 + k), f.C(0.8)); if (lit) hbar(g, x + 5, y, bw, n.a, k === s.lab ? f.H(120, 0.6) : f.C(0.5), f.C(0.12), '·'); }
      if (l === 0 && cols >= 60) put(g, x - 6, y, n.a.toFixed(2), f.C(0.6));
    }));
    const st = ph < fw ? 'forward  ▶' : back >= 0 ? '◀  backprop' : 'loss';
    put(g, 1, 0, (f.p.mode === 'deep' ? 'deep net · ' + NL + ' layers · sparse' : 'mlp ' + L.join('-')) + ' · run ' + s.run + ' · ' + st + ' · step ' + s.ep + ' · loss ' + s.loss.toFixed(3), f.C(0.7));
  },
  deep(s, f) { this.mlp(s, f); },
  conv(s, f) {
    const { g, cols, rows, dt, t } = f;
    s.kp += dt * 22;
    if (s.kp >= 14 * 14 + 30) { s.kp = 0; this.mkImg(s); }
    const kp = Math.min(14 * 14 - 1, Math.floor(s.kp)), kx = kp % 14, ky = Math.floor(kp / 14), prog = Math.min(1, s.kp / 196);
    const big2 = rows >= 50, outH = big2 ? 10 : 6;
    const cs = Math.max(1, Math.floor(Math.min((cols * 0.4) / 32, (rows - 4 - outH) / 16))), cx2 = cs * 2, x0 = 2, y0 = 2;
    // 輸入影像與卷積核框
    put(g, x0, 0, 'input 16×16 · ' + CV_CLS[s.cls] + '?', f.C(0.7));
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = s.img[y * 16 + x], inK = x >= kx && x < kx + 3 && y >= ky && y < ky + 3;
      for (let a = 0; a < cs; a++) for (let b2 = 0; b2 < cx2; b2++) g.set(x0 + x * cx2 + b2, y0 + y * cs + a, v > 0.1 ? '█' : '·', inK ? f.H(50, 0.35 + 0.4 * v) : f.C(v > 0.1 ? 0.25 + 0.7 * v : 0.15));
    }
    box(g, x0 + kx * cx2 - 1, y0 + ky * cs - 1, 3 * cx2 + 2, 3 * cs + 2, f.H(50, 0.7), null, null, 0);
    // 卷積核數值（目前高亮的那張特徵圖）
    const nm = cols >= 200 ? 8 : 4, K = CV_K[s.km % nm];
    const kxp = x0 + 16 * cx2 + 3;
    put(g, kxp, y0, 'kernel', f.C(0.7)); put(g, kxp, y0 + 1, CV_KN[s.km % nm], f.H(50, 0.7));
    K.forEach((r, a) => put(g, kxp, y0 + 3 + a, r.map(v => pad(v, 3)).join(''), f.H(50, 0.6)));
    for (let k = 0; k < 3; k++) put(g, kxp + 3, y0 + 8 + k, '│', f.C(0.3));
    put(g, kxp, y0 + 11, 'relu ▶', f.C(0.5));
    // 特徵圖：挑一種排法讓每張圖最大且長寬比正確；還沒掃到的地方先顯示上一張圖的結果（較暗）
    const fx0 = kxp + 13, W = cols - 1 - fx0, Hav = rows - 2;
    let best = null;
    for (const gxx of [2, 4, 8]) { if (nm % gxx) continue; const gyy = nm / gxx, iw = Math.floor(W / gxx) - 3, ih = Math.floor(Hav / gyy) - 3, sz = Math.min(iw, ih * 2); if (!best || sz > best.sz) best = { gxx, gyy, sz }; }
    const gxn2 = best.gxx, gyn = best.gyy, cw = Math.max(4, best.sz), chh = Math.max(3, Math.floor(cw / 2)), bw = cw + 2, bh = chh + 2;
    const pz = Math.floor(cw / 2), ph = Math.max(2, Math.floor(chh / 2)), withPool = gyn * (bh + ph + 3) <= Hav && pz >= 6;
    const rowH = bh + (withPool ? ph + 3 : 0), gy0 = 1 + Math.floor((Hav - gyn * rowH) / 2), colW = Math.floor(W / gxn2);
    if (!s.fm || s.fm.length !== nm * 196) s.fm = new Float32Array(nm * 196);
    const FM = s.fm;
    for (let k = 0; k < nm; k++) for (let idx = 0; idx < 196; idx++) {
      const sx = idx % 14, sy = Math.floor(idx / 14), cur = idx <= kp, src = cur ? s.img : s.prev, KK = CV_K[k];
      let v = 0; for (let a = 0; a < 3; a++) for (let b2 = 0; b2 < 3; b2++) v += src[(sy + a) * 16 + sx + b2] * KK[a][b2];
      FM[k * 196 + idx] = clamp(v * CV_N[k], 0, 1) * (cur ? 1 : 0.4);
    }
    const cell = (v, k) => (v > 0.06 ? [RAMP10[Math.min(9, 1 + Math.floor(v * 9))], f.H(150 + k * 22, 0.2 + 0.55 * v)] : null);
    for (let k = 0; k < nm; k++) {
      const bx = fx0 + (k % gxn2) * colW + Math.floor((colW - bw) / 2), by = gy0 + Math.floor(k / gxn2) * rowH, hot = k === s.km % nm;
      box(g, bx, by, bw, bh, hot ? f.H(50, 0.6) : f.C(0.35), CV_KN[k], hot ? f.H(50, 0.8) : f.C(0.6), 1);
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) { const q = cell(FM[k * 196 + Math.floor((y / chh) * 14) * 14 + Math.floor((x / cw) * 14)], k); if (q) g.set(bx + 1 + x, by + 1 + y, q[0], q[1]); }
      g.set(bx + 1 + Math.floor(((kx + 0.5) / 14) * cw), by + 1 + Math.floor(((ky + 0.5) / 14) * chh), '█', f.C(1));
      if (withPool) {
        // 2×2 最大池化
        const px0 = bx + Math.floor((bw - pz - 2) / 2), py0 = by + bh + 1;
        g.set(bx + Math.floor(bw / 2), by + bh, '↓', f.C(0.4));
        box(g, px0, py0, pz + 2, ph + 2, f.C(0.28), 'pool', f.C(0.5), 1);
        for (let y = 0; y < ph; y++) for (let x = 0; x < pz; x++) {
          const qx = Math.floor((x / pz) * 7) * 2, qy = Math.floor((y / ph) * 7) * 2, o = k * 196;
          const v = Math.max(FM[o + qy * 14 + qx], FM[o + qy * 14 + qx + 1], FM[o + (qy + 1) * 14 + qx], FM[o + (qy + 1) * 14 + qx + 1]), q = cell(v, k);
          if (q) g.set(px0 + 1 + x, py0 + 1 + y, q[0], q[1]);
        }
      }
    }
    // 輸出：softmax，四類加起來 100%，答案隨掃描進度越來越確定
    const lg = s.lg.map((v, k) => (k === s.cls ? v + 4.2 * prog : v)), mx = Math.max(...lg), ex = lg.map(v => Math.exp(v - mx)), sum = ex.reduce((a, b2) => a + b2, 0);
    const pc = ex.map(v => Math.round((v / sum) * 100)); let top = 0; for (let k = 1; k < 4; k++) if (pc[k] > pc[top]) top = k;
    pc[top] += 100 - pc.reduce((a, b2) => a + b2, 0);
    const oy = y0 + 16 * cs + 1, sp = big2 ? 2 : 1, bwo = Math.max(6, 16 * cx2 - 16);
    put(g, x0, oy, 'output · softmax' + (prog >= 1 ? ' · ' + CV_CLS[top] : ''), f.C(0.7));
    for (let k = 0; k < 4; k++) {
      const y = oy + 1 + k * sp, win = k === top && prog > 0.3;
      put(g, x0, y, CV_CLS[k].padEnd(6), win ? f.C(1) : f.C(0.6));
      hbar(g, x0 + 7, y, bwo, pc[k] / 100, win ? f.H(120, 0.6) : f.C(0.45), f.C(0.12), '·');
      put(g, x0 + 8 + bwo, y, pad(pc[k], 3) + '%', win ? f.C(1) : f.C(0.6));
    }
  },
  rnn(s, f) {
    const { g, cols, rows, dt, t } = f;
    s.stT += dt;
    if (s.stT > 0.7) { s.stT = 0; s.step++; if (s.step > s.sent.length + 3) { s.step = 0; s.sent = this.mkSent(); } }
    const n = s.sent.length, cw = Math.floor((cols - 6) / n), bw = Math.max(7, Math.floor(cw * 0.6)), yh = Math.floor(rows * 0.45), bh = Math.max(3, Math.floor(rows * 0.14));
    put(g, 1, 0, 'recurrent net · unrolled ' + n + ' steps · hidden 256', f.C(0.7));
    for (let k = 0; k < n; k++) {
      const x = 3 + k * cw, act = k === s.step, done = k < s.step, col = act ? f.H(45, 0.7) : done ? f.H(190, 0.5) : f.C(0.3);
      box(g, x, yh, bw, bh, col, null, null, act ? 2 : 1);
      const lab = 'h' + k;
      put(g, x + Math.floor((bw - lab.length) / 2), yh + Math.floor(bh / 2), lab, col);
      // 輸入字、輸出字
      const wd = s.sent[k];
      put(g, x + Math.floor((bw - wd.length) / 2), rows - 3, wd, done || act ? f.C(0.9) : f.C(0.35));
      for (let y = yh + bh; y < rows - 4; y++) g.set(x + Math.floor(bw / 2), y, y === yh + bh ? '▲' : '│', done || act ? f.C(0.6) : f.C(0.2));
      for (let y = 3; y < yh; y++) g.set(x + Math.floor(bw / 2), y, y === yh - 1 ? '│' : y === 3 ? '▲' : '│', done ? f.C(0.5) : f.C(0.15));
      if (done) { const out = s.sent[(k + 1) % n]; put(g, x + Math.floor((bw - out.length) / 2), 2, out, f.H(120, 0.6)); }
      // 隱藏狀態傳遞
      if (k < n - 1) { const y = yh + Math.floor(bh / 2); for (let xx = x + bw; xx < x + cw; xx++) g.set(xx, y, xx === x + cw - 1 ? '▶' : '─', k < s.step ? f.H(190, 0.6) : f.C(0.2)); if (k === s.step - 1) { const px = x + bw + Math.floor((s.stT / 0.7) * (cw - bw)); g.set(px, y, '●', f.H(45, 0.8)); } }
      // 隱藏狀態小長條
      if (done || act) for (let j = 0; j < Math.min(bw - 2, 12); j++) g.set(x + 1 + j, yh + bh - 2 >= yh + 1 ? yh + bh - 2 : yh + 1, VEIGHT[1 + Math.floor(7 * (0.5 + 0.5 * Math.sin(j * 1.7 + k * 2.3 + (act ? t * 6 : 0))))], f.H(190, 0.5));
    }
    put(g, 1, rows - 1, 'input  ▸ ' + s.sent.slice(0, Math.min(s.step + 1, n)).join(' '), f.C(0.6));
  },
  attn(s, f) {
    const { g, cols, rows, dt, t } = f, b = s.b, n = TOK.length;
    s.hT += dt;
    if (s.hT > 4) { s.hT = 0; s.head = (s.head + 1) % 8; s.A = s.A2; s.A2 = this.mkAttn(); }
    const mix = sstep((s.hT - 3) / 1), A2 = i => s.A[i] * (1 - mix) + s.A2[i] * mix;
    const lw = 8, cwid = Math.max(2, Math.floor((cols * 0.55 - lw) / n)), chh = Math.max(1, Math.floor((rows - 7) / n)), x0 = lw + 1, y0 = 6;
    put(g, 1, 0, 'self-attention · layer 6 · head ' + (s.head + 1) + '/8', f.C(0.75));
    for (let j = 0; j < n; j++) { const w = TOK[j].slice(0, Math.max(1, cwid * 1 + 3)); for (let k = 0; k < Math.min(w.length, 4); k++) g.set(x0 + j * cwid, y0 - 4 + k, w[k] || ' ', f.C(0.6)); }
    const qr = Math.floor(t * 0.8) % n;
    for (let i = 0; i < n; i++) {
      put(g, 1, y0 + i * chh, pad(TOK[i], 7), i === qr ? f.H(50, 0.6 + 0.2 * Math.sin(t * 5)) : f.C(0.6));
      for (let j = 0; j < n; j++) {
        const v = clamp(A2(i * n + j) * 2.2 * (i === qr ? 1.15 + 0.15 * Math.sin(t * 5 + j) : 1), 0, 1);
        for (let a = 0; a < chh; a++) for (let c = 0; c < cwid - (cwid > 2 ? 1 : 0); c++) g.set(x0 + j * cwid + c, y0 + i * chh + a, '█', f.H(260 - 220 * v, 0.06 + 0.6 * v));
      }
    }
    // 右側：字詞與連線弧
    const rx0 = Math.floor(cols * 0.58) + 4, rw = cols - rx0 - 2;
    if (rw > 20) {
      bclr(b);
      const sp = rw / n, by = rows - 4;
      TOK.forEach((w, k) => put(g, Math.round(rx0 + k * sp), by + 1, w.slice(0, Math.max(2, Math.floor(sp) - 1)), f.C(0.75)));
      const q = Math.floor(t * 0.8) % n;
      for (let j = 0; j < n; j++) {
        const v = A2(q * n + j); if (v < 0.04) continue;
        const xa = (rx0 + q * sp + 1) * 2, xb = (rx0 + j * sp + 1) * 2, hgt = Math.abs(xb - xa) * 0.9 + 8;
        let px = null, py = null;
        for (let u = 0; u <= 1; u += 0.02) { const x = xa + (xb - xa) * u, y = by * 4 - Math.sin(Math.PI * u) * Math.min(hgt, (by - 3) * 4); if (px !== null) bline(b, px, py, x, y, Math.min(1, v * 2.5), 0); px = x; py = y; }
        const u2 = fract(t * 0.9 + j * 0.13), x2 = xa + (xb - xa) * u2, y2 = by * 4 - Math.sin(Math.PI * u2) * Math.min(hgt, (by - 3) * 4);
        bdot(b, x2, y2, 1, 1); bdot(b, x2 + 1, y2, 1, 1); bdot(b, x2, y2 + 1, 1, 1);
      }
      bflush(g, b, (v, tg) => (tg ? f.H(50, 0.8) : f.H(300, 0.2 + 0.6 * v)));
      put(g, Math.round(rx0 + q * sp), by + 2, '▲ query', f.H(50, 0.7));
    }
  },
  train(s, f) {
    const { g, cols, rows, dt, t } = f, b = s.b;
    s.acc += dt * 14; while (s.acc >= 1) { s.acc--; this.trainStep(s); }
    bclr(b);
    const gw = cols >= 160 ? Math.floor(cols * 0.58) : cols - 2, gh = rows - 4, x0 = 6, y0 = 1;
    box(g, x0 - 1, y0, gw - x0 + 1, gh + 2, f.C(0.3), 'loss / accuracy', f.C(0.8), 1);
    for (let k = 0; k <= 4; k++) { const y = y0 + 1 + Math.round((k / 4) * (gh - 1)); put(g, 0, y, (1 - k / 4).toFixed(2), f.C(0.4)); for (let x = x0; x < gw - 1; x += 3) g.set(x, y, '·', f.C(0.12)); }
    const W = (gw - x0 - 1) * 2, n = s.lossH.length, H4 = (gh - 1) * 4;
    for (const [arr, tag, sc] of [[s.lossH, 0, 1 / 1.3], [s.accH, 1, 1]]) {
      let py = null;
      for (let x = 0; x < W; x++) {
        const k = Math.floor((x / W) * n); if (k >= n) break;
        const v = clamp(arr[k] * sc, 0, 1), y = (y0 + 1) * 4 + (1 - v) * H4;
        if (py !== null) bline(b, x0 * 2 + x - 1, py, x0 * 2 + x, y, 1, tag); py = y;
      }
    }
    bflush(g, b, (v, tg) => (tg ? f.H(120, 0.6) : f.H(20, 0.6)));
    put(g, x0 + 2, y0 + gh + 1, ' ── loss ', f.H(20, 0.65)); put(g, x0 + 12, y0 + gh + 1, ' ── accuracy ', f.H(120, 0.65));
    const lx = cols >= 160 ? gw + 2 : 1, ly = cols >= 160 ? 1 : rows - 1;
    if (cols >= 160) {
      put(g, lx, 0, 'training log', f.C(0.8));
      const nl = Math.min(s.tl.length, rows - 6);
      for (let k = 0; k < nl; k++) put(g, lx, 2 + k, s.tl[s.tl.length - nl + k], f.C(0.4 + 0.5 * (k / nl)), cols - 1);
      const pr = (s.st % 25) / 25;
      put(g, lx, rows - 3, 'epoch ' + s.ep + '/' + s.EP + '  step ' + s.st, f.C(0.8));
      hbar(g, lx, rows - 2, cols - lx - 8, pr, f.H(120, 0.55), f.C(0.15), '░');
      put(g, cols - 6, rows - 2, pad(Math.floor(pr * 100), 3) + '%', f.C(0.8));
    } else { const pr = (s.st % 25) / 25, lab = 'ep ' + s.ep + '/' + s.EP + ' loss ' + s.loss.toFixed(4) + ' '; put(g, 1, rows - 1, lab, f.C(0.75)); hbar(g, lab.length + 2, rows - 1, cols - lab.length - 4, pr, f.H(120, 0.55), f.C(0.15), '░'); }
    // 曲線最前端的游標
    if (n) { const xe = x0 * 2 + Math.min(W - 1, Math.floor(((n - 1) / n) * W)), ye = Math.round(((y0 + 1) * 4 + (1 - clamp(s.lossH[n - 1] / 1.3, 0, 1)) * H4) / 4); g.set(Math.floor(xe / 2), ye, '●', f.H(20, 0.6 + 0.3 * Math.sin(t * 6))); }
  },
  weights(s, f) {
    const { g, cols, rows, dt, t } = f, R = s.wr, C = s.wc;
    s.ur += dt * 14;
    while (s.ur >= 1) { s.ur--; const r = rint(0, R - 1); for (let c = 0; c < C; c++) s.w[r * C + c] = clamp(s.w[r * C + c] * 0.97 + gauss() * 0.06 + 0.04 * Math.sin(c * 0.2 + t), -1.5, 1.5); s.hot[r] = 1; }
    put(g, 1, 0, 'layer 4 · weight matrix ' + R + '×' + C + ' · gradient updates', f.C(0.75));
    for (let r = 0; r < R; r++) {
      s.hot[r] = Math.max(0, s.hot[r] - dt * 2);
      for (let c = 0; c < C; c++) {
        const v = s.w[r * C + c], a = clamp(Math.abs(v), 0, 1);
        const col = f.H(v > 0 ? 25 : 200, 0.08 + 0.55 * a + 0.25 * s.hot[r]);
        g.set(2 + c * 2, 2 + r, '█', col); g.set(3 + c * 2, 2 + r, '▌', col);
      }
    }
    // 直方圖
    const hb = new Float32Array(Math.floor((cols - 4) / 2)), nb = hb.length;
    for (let i = 0; i < s.w.length; i++) { const k = clamp(Math.floor(((s.w[i] + 1.5) / 3) * nb), 0, nb - 1); hb[k]++; }
    let mx = 1; for (const v of hb) mx = Math.max(mx, v);
    const hy = rows - 2, hh = 5;
    for (let k = 0; k < nb; k++) { const v = (hb[k] / mx) * hh, full = Math.floor(v), part = Math.floor((v - full) * 8), col = f.H(k < nb / 2 ? 200 : 25, 0.5); for (let j = 0; j < full; j++) g.set(2 + k * 2, hy - j, '█', col); if (part) g.set(2 + k * 2, hy - full, VEIGHT[part], col); }
    put(g, 2, rows - 1, '-1.5', f.C(0.5)); put(g, Math.floor(cols / 2) - 1, rows - 1, '0', f.C(0.5)); put(g, cols - 6, rows - 1, '+1.5', f.C(0.5));
  },
});

/* ═════════ 16. 聲納探測 ═════════ */
A({ id: 'te-sonar', name: '聲納探測', cat: '科技', theme: 'amber', desc: '扇形聲波一圈圈推出，照亮海底與魚群',
  params: { mode: 'fan' },
  variants: [
    { id: 'fish', name: '魚探', theme: 'ocean', hue: true, desc: '捲動的深度剖面、魚群弧形與海底', params: { mode: 'fish' } },
    { id: 'side', name: '側掃', theme: 'gold', desc: '左右兩側的海床影像與沉船陰影', params: { mode: 'side' } },
    { id: 'passive', name: '被動聲紋', theme: 'matrix', desc: '方位對時間的瀑布圖與目標軌跡', params: { mode: 'passive' } },
    { id: 'buoy', name: '浮標定位', theme: 'ice', desc: '九顆浮標聽音，雙曲線交會出目標位置', params: { mode: 'buoy' } },
    { id: 'bathy', name: '海底地形', theme: 'blueprint', hue: true, desc: '多波束測深的立體海底緩緩前進', params: { mode: 'bathy' } },
    { id: 'ascan', name: '回波強度', theme: 'mint', desc: '上方回波波形、下方距離時間影像', params: { mode: 'ascan' } },
  ],
  init(s, f) {
    const { cols, rows, aspect, p } = f, n = cols * rows;
    s.P = new Float32Array(n); s.pt = 0; s.T = 0;
    const m = p.mode;
    if (m === 'fan') {
      s.r = new Float32Array(n); s.th = new Float32Array(n);
      const ax = cols / 2, ay = rows - 1.5;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const dx = x - ax, dy = (y - ay) * aspect, i = y * cols + x; s.r[i] = Math.hypot(dx, dy); s.th[i] = Math.atan2(dx, -dy); }
      s.R = Math.min(cols * 0.5 / Math.sin(1.05), (rows - 2) * aspect) * 0.97;
      s.tg = []; for (let k = 0; k < 4; k++) s.tg.push({ r: rnd(0.25, 0.85), th: rnd(-1, 1) * 0.9, vr: rnd(-0.01, 0.01), vt: rnd(-0.02, 0.02), sz: rnd(0.02, 0.05), id: 'S' + (k + 1) });
      s.front = 0;
    }
    if (m === 'buoy') this.buoyInit(s, f);
    if (m === 'fish' || m === 'ascan') { s.col = []; s.acc = 0; s.x = 0; s.fishT = 0; s.H = new Float32Array(cols * rows); for (let k = 0; k < cols; k++) this.fishCol(s, f); }
    if (m === 'side') { s.H = new Float32Array(n); s.acc = 0; s.line = 0; for (let k = 0; k < rows; k++) this.sideLine(s, f); }
    if (m === 'passive') { s.H = new Float32Array(n); s.acc = 0; s.ct = []; for (let k = 0; k < 5; k++) s.ct.push({ b: rnd(0, 360), v: rnd(-4, 4), s: rnd(0.4, 1), id: 'C' + (k + 1) }); for (let k = 0; k < rows; k++) this.passLine(s, f); }
    if (m === 'bathy') {
      s.z = 0; s.ybuf = new Float32Array(cols);
      // 預先算好可平鋪的海底高度貼圖（每格 = 4 個世界單位）
      if (!s.tex) { s.tex = new Float32Array(256 * 256); for (let v = 0; v < 256; v++) for (let u = 0; u < 256; u++) { const a = (u / 256) * TAU, c = (v / 256) * TAU; s.tex[v * 256 + u] = 0.5 + 0.35 * Noise.n3(Math.cos(a) * 5.7 + 9, Math.sin(a) * 5.7, Math.cos(c) * 5.7 + Math.sin(c) * 2.1) + 0.15 * Noise.n3(Math.cos(a) * 19 + 3, Math.sin(a) * 19, Math.sin(c) * 19); } }
    }
  },
  frame(s, f) { this[f.p.mode](s, f); },
  // 扇形前視聲納
  fan(s, f) {
    const { g, cols, rows, dt, t } = f, n = cols * rows, P = s.P, ch = g.ch, co = g.co, R = s.R, SP = 1.05;
    const per = 2.4; s.pt += dt; if (s.pt > per) s.pt = 0;
    const front = (s.pt / per) * R * 1.05;
    for (const q of s.tg) { q.r = clamp(q.r + q.vr * dt, 0.2, 0.85); q.th = clamp(q.th + q.vt * dt, -0.95, 0.95); if (Math.random() < dt * 0.1) { q.vr = rnd(-0.02, 0.02); q.vt = rnd(-0.03, 0.03); } }
    const dec = Math.exp(-dt * 0.45);
    for (let i = 0; i < n; i++) {
      const r = s.r[i], th = s.th[i];
      P[i] *= dec;
      if (r > R || Math.abs(th) > SP) continue;
      if (Math.abs(r - front) < 1.6) {
        const rn = r / R, bottom = 0.72 + 0.12 * Noise.n3(th * 2.5, 3.3) + 0.04 * Noise.n3(th * 9, 7);
        let e = 0.04 + 0.08 * Math.random();
        if (rn > bottom) e = Math.max(e, (0.9 - (rn - bottom) * 2.2) * (0.7 + 0.3 * Noise.n3(th * 20, rn * 20)));
        for (const q of s.tg) { const d = Math.hypot((rn - q.r) * 1.2, (th - q.th) * rn); if (d < q.sz) e = Math.max(e, 0.95 - d / q.sz * 0.4); }
        if (e > P[i]) P[i] = e;
      }
    }
    for (let i = 0; i < n; i++) {
      const r = s.r[i], th = s.th[i];
      if (r > R + 0.5 || Math.abs(th) > SP + 0.01) continue;
      const v = P[i];
      if (Math.abs(r - front) < 0.8 && r < R) { ch[i] = '░'; co[i] = f.C(0.55); continue; }
      if (v > 0.06) { ch[i] = RAMP10[Math.min(9, Math.floor(v * 10))]; co[i] = f.C(0.2 + 0.8 * v); }
      else if (Math.abs(Math.abs(th) - SP) < 0.012 * (R / Math.max(r, 1)) * 2 || (Math.abs(r % (R / 4)) < 0.5 && Math.floor(th * 40) % 2 === 0)) { ch[i] = '·'; co[i] = f.C(0.25); }
    }
    for (let k = 1; k <= 4; k++) { const rr = (k * R) / 4, y = Math.round(rows - 1.5 - rr / f.aspect); if (y >= 0) put(g, Math.round(cols / 2) + 1, y, k * 25 + 'm', f.C(0.5)); }
    put(g, 1, 0, 'FORWARD SONAR · 120° · 100 m · ping ' + (Math.floor(t / per) % 10000), f.C(0.75));
    put(g, 1, rows - 1, 'freq 450 kHz · gain 62% · ' + s.tg.length + ' contacts', f.C(0.5));
  },
  fishCol(s, f) {
    const { cols, rows } = f, H = s.H;
    // 整個畫面往左捲一欄，最右邊寫入新的一欄
    for (let y = 0; y < rows; y++) { const r = y * cols; H.copyWithin(r, r + 1, r + cols); H[r + cols - 1] = 0; }
    s.x++; s.T += 0.05;
    const top = 2, depth = rows - 2 - top, x = s.x;
    const bot = top + depth * (0.62 + 0.18 * Noise.n3(x * 0.02, 1.1) + 0.08 * Noise.n3(x * 0.09, 2.2));
    const therm = top + depth * (0.3 + 0.03 * Math.sin(x * 0.05));
    s.fishT -= 1;
    if (s.fishT <= 0 && Math.random() < 0.05) { s.fish = { y: rnd(top + 3, bot - 4), len: rint(10, 24), k: 0, n: rint(1, 4) }; s.fishT = 30; }
    for (let y = 0; y < rows; y++) {
      let v = 0;
      if (y < top) v = 0;
      else if (y < bot) { v = Math.random() < 0.04 ? rnd(0.15, 0.35) : 0; if (Math.abs(y - therm) < 1.2) v = Math.max(v, 0.18 + 0.12 * Math.random()); }
      else { const d = y - bot; v = d < 1 ? 1 : Math.max(0.05, 0.85 - d * 0.12 + 0.1 * Math.random()); }
      H[y * cols + cols - 1] = v;
    }
    if (s.fish) {
      const F2 = s.fish, u = F2.k / F2.len, arch = (u - 0.5) * (u - 0.5) * 6;
      for (let j = 0; j < F2.n; j++) { const yy = Math.round(F2.y + arch + j * 1.5); if (yy > 0 && yy < rows) H[yy * cols + cols - 1] = 0.9; }
      if (++F2.k > F2.len) s.fish = null;
    }
    s.bot = bot;
  },
  fish(s, f) {
    const { g, cols, rows, dt, t } = f, H = s.H, ch = g.ch, co = g.co;
    s.acc += dt * 14; while (s.acc >= 1) { s.acc--; this.fishCol(s, f); }
    const hue = hueOnF(f);
    for (let i = 0; i < cols * rows; i++) {
      const v = H[i]; if (v <= 0.04) continue;
      ch[i] = v > 0.85 ? '█' : v > 0.6 ? '▓' : v > 0.35 ? '▒' : '░';
      co[i] = hue ? f.H(240 - 240 * v, 0.2 + 0.45 * v) : f.C(0.2 + 0.8 * v);
    }
    const depth = rows - 4;
    for (let k = 0; k <= 5; k++) { const y = 2 + Math.round((k / 5) * depth); put(g, cols - 5, y, pad(k * 8, 3) + 'm', f.C(0.6)); }
    const dm = ((s.bot - 2) / depth * 40).toFixed(1);
    clearR(g, 0, 0, 30, 2);
    put(g, 1, 0, 'DEPTH ' + dm + ' m · 12.4°C · 6.2 kn', f.C(0.95));
  },
  sideLine(s, f) {
    const { cols, rows } = f, H = s.H;
    H.copyWithin(cols, 0, cols * (rows - 1));
    s.line++;
    const L = s.line, mid = cols / 2, gap = 3 + 2 * Math.abs(Noise.n3(L * 0.03, 5));
    // 物體：岩石或沉船，後方留下聲影
    if (!s.obj || s.obj.y > s.obj.len) s.obj = Math.random() < 0.025 ? { side: Math.random() < 0.5 ? -1 : 1, x: rnd(gap + 6, mid - 10), len: rint(6, 16), y: 0, w: rnd(3, 8) } : s.obj && s.obj.y <= s.obj.len ? s.obj : null;
    for (let x = 0; x < cols; x++) {
      const d = Math.abs(x - mid);
      let v;
      if (d < gap) v = 0;
      else {
        const rr = d - gap, ripple = 0.5 + 0.5 * Math.sin(rr * 0.9 + L * 0.15 + Noise.n3(rr * 0.05, L * 0.05) * 4);
        v = clamp(0.25 + 0.35 * Noise.n3(x * 0.15, L * 0.12, 1) + 0.18 * ripple * (Noise.n3(x * 0.03, L * 0.02, 4) > 0 ? 1 : 0.2) - rr / mid * 0.25, 0, 1);
        if (s.obj && Math.sign(x - mid) === s.obj.side) {
          const o = s.obj, wv = o.w * Math.sin((o.y / o.len) * Math.PI);
          if (rr > o.x && rr < o.x + wv) v = 1;
          else if (rr >= o.x + wv && rr < o.x + wv + o.w * 2.5) v = 0.03;
        }
      }
      H[x] = v;
    }
    if (s.obj) s.obj.y++;
  },
  side(s, f) {
    const { g, cols, rows, dt } = f, H = s.H, ch = g.ch, co = g.co;
    s.acc += dt * 10; while (s.acc >= 1) { s.acc--; this.sideLine(s, f); }
    for (let i = 0; i < cols * rows; i++) { const v = H[i]; if (v < 0.06) continue; ch[i] = RAMP10[Math.min(9, 1 + Math.floor(v * 9))]; co[i] = f.C(0.15 + 0.85 * v); }
    const mid = Math.floor(cols / 2);
    put(g, 2, 0, 'PORT', f.C(0.8)); put(g, cols - 12, 0, 'STARBOARD', f.C(0.8));
    put(g, mid - 6, rows - 1, ' 75 m swath ', f.C(0.7));
    for (let k = 1; k <= 3; k++) { const dx = Math.round((k / 4) * mid); g.set(mid - dx, rows - 1, '┴', f.C(0.5)); g.set(mid + dx, rows - 1, '┴', f.C(0.5)); }
  },
  passLine(s, f) {
    const { cols, rows } = f, H = s.H;
    H.copyWithin(cols * 3, cols * 2, cols * (rows - 1));
    for (const c of s.ct) { c.b = (c.b + c.v * 0.05 + 360) % 360; if (Math.random() < 0.01) c.v = rnd(-4, 4); }
    const y = 2;
    for (let x = 0; x < cols; x++) {
      const bd = (x / cols) * 360;
      let v = 0.08 + 0.12 * Math.random();
      for (const c of s.ct) { let d = Math.abs(bd - c.b); d = Math.min(d, 360 - d); v += c.s * Math.exp(-d * d * 0.15) * (0.7 + 0.3 * Math.random()); }
      H[y * cols + x] = clamp(v, 0, 1);
    }
  },
  passive(s, f) {
    const { g, cols, rows, dt, t } = f, H = s.H, ch = g.ch, co = g.co, b = s.b || (s.b = bnew(cols, rows));
    s.acc += dt * 11; while (s.acc >= 1) { s.acc--; this.passLine(s, f); }
    for (let y = 3; y < rows - 1; y++) for (let x = 0; x < cols; x++) { const i = y * cols + x, v = H[i] * (1 - (y / rows) * 0.4); if (v < 0.12) continue; ch[i] = RAMP10[Math.min(9, Math.floor(v * 10))]; co[i] = f.C(0.12 + 0.88 * v); }
    // 上方：目前的方位響應曲線
    bclr(b);
    let py = null;
    for (let x = 0; x < cols * 2; x++) { const v = H[2 * cols + Math.floor(x / 2)] * (0.85 + 0.15 * Math.random()), y = 11 - v * 10; if (py !== null) bline(b, x - 1, py, x, y, 1, 0); py = y; }
    bflush(g, b, () => f.C(0.85));
    for (const c of s.ct) { const x = Math.round((c.b / 360) * cols); put(g, clamp(x - 1, 0, cols - 3), 3, c.id, f.C(1)); }
    for (let k = 0; k <= 8; k++) put(g, Math.round((k / 8) * (cols - 4)), rows - 1, String(k * 45).padStart(3, '0'), f.C(0.5));
  },
  // 浮標定位：目標發出聲音 → 各浮標先後收到 → 用到達時間差畫雙曲線、擴張圓，交會處就是目標
  buoyInit(s, f) {
    const { cols, rows, aspect } = f;
    s.b = bnew(cols, rows); s.bu = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) s.bu.push({ x: cols * (0.16 + 0.34 * i) + rnd(-2, 2), y: 2 + (rows - 5) * (0.12 + 0.38 * j) + rnd(-0.5, 0.5), id: 'B' + (j * 3 + i + 1), hit: -1, d: 0 });
    s.diag = Math.hypot(cols, rows * aspect); s.c = s.diag / 2.6;
    s.cyc = -1; s.fixes = []; s.tgP = rnd(0, 100); s.fixN = rint(10, 60); s.km = 8 / cols;
  },
  tgPos(s, f, T) { const { cols, rows } = f; return [cols * (0.5 + 0.34 * Math.sin(T * 0.021 + s.tgP)), 2 + (rows - 5) * (0.5 + 0.4 * Math.sin(T * 0.033 + s.tgP * 1.7))]; },
  // 以 A、B 為焦點、|PA|−|PB| = dl 的雙曲線（等向座標），畫成點字
  hyper(b, A2, B2, dl, asp, v) {
    const ax = A2.x, ay = A2.y * asp, bx = B2.x, by = B2.y * asp, c0 = Math.hypot(bx - ax, by - ay) / 2, a = Math.abs(dl) / 2;
    if (a >= c0 * 0.995 || c0 < 1) return;
    const ux = (bx - ax) / (2 * c0), uy = (by - ay) / (2 * c0), mx = (ax + bx) / 2, my = (ay + by) / 2, sg = dl >= 0 ? 1 : -1, bb = Math.sqrt(c0 * c0 - a * a);
    const U = Math.asinh(400 / Math.max(0.5, bb));
    for (let side = -1; side <= 1; side += 2) {
      let u = 0, guard = 0;
      while (u < U && guard++ < 3000) {
        const lx = sg * a * Math.cosh(u), ly = side * bb * Math.sinh(u), X = mx + lx * ux - ly * uy, Y = my + lx * uy + ly * ux;
        bdot(b, X * 2, (Y / asp) * 4, v, 0);
        u += 0.6 / Math.max(1, 2 * Math.hypot(a * Math.sinh(u), bb * Math.cosh(u)));
      }
    }
  },
  ring(b, x, y, r, asp, v, tag, dash) {
    const n = Math.max(12, Math.ceil(r * 7));
    for (let k = 0; k < n; k++) { if (dash && (k % 3) === 2) continue; const a = (k / n) * TAU; bdot(b, (x + Math.cos(a) * r) * 2, (y + (Math.sin(a) * r) / asp) * 4, v, tag); }
  },
  buoy(s, f) {
    const { g, cols, rows, t, aspect } = f, b = s.b, A = aspect, P = 6.5;
    const cyc = Math.floor(t / P), tc = t - cyc * P;
    if (cyc !== s.cyc) {
      s.cyc = cyc;
      const [ex, ey] = this.tgPos(s, f, t); s.ex = ex; s.ey = ey;
      for (const q of s.bu) { q.d = Math.hypot(q.x - ex, (q.y - ey) * A); q.hit = -1; }
      s.ord = s.bu.slice().sort((p, q) => p.d - q.d);
      s.ts = s.ord[s.ord.length - 1].d / s.c + 0.35; s.fixed = false;
    }
    const ref = s.ord[0], ts = s.ts, solve = sstep((tc - ts) / 1.7);
    if (!s.fixed && tc >= ts + 1.7) {
      s.fixed = true; s.fixN++;
      s.fixes.push({ x: s.ex + rnd(-0.5, 0.5), y: s.ey + rnd(-0.25, 0.25), n: s.fixN });
      if (s.fixes.length > 16) s.fixes.shift();
    }
    bclr(b);
    // 海面格線
    const gx = Math.max(8, Math.round(cols / 12)), gy = Math.max(3, Math.round(gx / A));
    for (let y = gy; y < rows - 1; y += gy) for (let x = 0; x < cols; x += gx >> 1) g.set(x, y, x % gx === 0 ? '+' : '·', f.C(x % gx === 0 ? 0.2 : 0.1));
    // 聲波從目標擴散（虛線）
    const R = s.c * tc;
    if (R < s.diag) this.ring(b, s.ex, s.ey, R, A, 0.32, 2, true);
    // 浮標收到聲音
    for (const q of s.bu) if (q.hit < 0 && tc >= q.d / s.c) q.hit = tc;
    // 雙曲線：以最先收到的浮標為基準，和接下來三顆配對
    if (tc > ts) {
      const fade = Math.min(1, (tc - ts) / 0.6) * (tc > P - 0.9 ? Math.max(0, (P - tc) / 0.9) : 1);
      for (let k = 1; k <= 3; k++) { const q = s.ord[k]; this.hyper(b, q, ref, q.d - ref.d, A, 0.25 + 0.35 * fade); }
      // 擴張圓：半徑 = ρ + 到達時間差，ρ 長到正確值時全部交會在同一點
      if (tc < ts + 2.4) { const rho = ref.d * solve; for (let k = 0; k <= 3; k++) { const q = s.ord[k]; this.ring(b, q.x, q.y, rho + (q.d - ref.d), A, 0.5 * (1 - Math.max(0, tc - ts - 1.7) / 0.7), 1, false); } }
    }
    // 航跡
    for (let k = 1; k < s.fixes.length; k++) { const p0 = s.fixes[k - 1], p1 = s.fixes[k]; bline(b, p0.x * 2, p0.y * 4, p1.x * 2, p1.y * 4, 0.3 + 0.5 * (k / s.fixes.length), 3); }
    bflush(g, b, (v, tg) => (tg === 3 ? f.C(0.25 + 0.6 * v) : tg === 1 ? f.C(0.2 + 0.7 * v) : tg === 2 ? f.C(0.18 + 0.4 * v) : f.C(0.15 + 0.75 * v)));
    for (let k = 0; k < s.fixes.length - 1; k++) { const p = s.fixes[k]; g.set(p.x, p.y, '•', f.C(0.3 + 0.45 * (k / s.fixes.length))); }
    // 浮標
    for (const q of s.bu) {
      const hot = q.hit >= 0 ? Math.max(0, 1 - (tc - q.hit) / 1.5) : 0, x = Math.round(q.x), y = Math.round(q.y);
      if (hot > 0) { const r = (1 - hot) * 3 + 0.8; for (let a = 0; a < 16; a++) g.set(Math.round(q.x + Math.cos((a / 16) * TAU) * r * 1.4), Math.round(q.y + (Math.sin((a / 16) * TAU) * r * 1.4) / A), '·', f.C(0.3 + 0.6 * hot)); }
      g.set(x, y, q.hit >= 0 ? '◉' : '○', q.hit >= 0 ? f.C(0.6 + 0.4 * hot) : f.C(0.45));
      put(g, x + 2, y, q.id, f.C(q.hit >= 0 ? 0.8 : 0.45));
      if (q.hit >= 0) { const dtS = (q.d - ref.d) / s.c; put(g, x + 2, y + 1, q === ref ? 'REF' : '+' + dtS.toFixed(2) + 's', q === ref ? f.C(1) : f.C(0.6)); }
    }
    // 定位點與讀數
    const L = s.fixes[s.fixes.length - 1], L0 = s.fixes[s.fixes.length - 2];
    let rd = 'awaiting fix';
    if (L) {
      const pulse = s.fixed && tc - ts - 1.7 < 1 ? 1 : 0.75;
      g.set(L.x, L.y, '✛', f.C(pulse)); put(g, L.x + 2, L.y - 1, 'FIX ' + L.n, f.C(0.9));
      const dx = L.x - cols / 2, dy = (L.y - rows / 2) * A, brg = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360, rng = Math.hypot(dx, dy) * s.km;
      // 每一輪定位代表一分鐘
      let crs = '---', spd = '--.-';
      if (L0) { const vx = L.x - L0.x, vy = (L.y - L0.y) * A; crs = pad0(Math.round(((Math.atan2(vx, -vy) * 180 / Math.PI) + 360) % 360), 3); spd = (Math.hypot(vx, vy) * s.km * 1000 / 60 * 1.94).toFixed(1); }
      rd = 'FIX ' + L.n + ' · BRG ' + pad0(brg.toFixed(1), 5) + '° · RNG ' + rng.toFixed(2) + ' km · CRS ' + crs + '° · SPD ' + spd + ' kn';
    }
    put(g, 1, 0, 'SONOBUOY FIELD · 9 buoys · TDOA · ' + (tc < ts ? 'listening …' : !s.fixed ? 'solving …' : 'fix locked'), f.C(0.8));
    fillR(g, 0, rows - 1, cols, 1, ' ', f.C(0.3));
    put(g, 1, rows - 1, rd, f.C(0.85), cols - 1);
    if (cols >= 140) {
      // 右上：到達時間差表
      const pw = 24, x0 = cols - pw - 1, ph = s.bu.length + 3;
      clearR(g, x0, 1, pw, ph); box(g, x0, 1, pw, ph, f.C(0.35), 'TDOA', f.C(0.8), 1);
      s.ord.forEach((q, k) => { const on = q.hit >= 0; put(g, x0 + 2, 2 + k, q.id + '  ' + (on ? (q === ref ? '   ref' : '+' + ((q.d - ref.d) / s.c).toFixed(3)) + ' s' : '   ---'), on ? f.C(0.85) : f.C(0.35)); hbar(g, x0 + 17, 2 + k, 5, on ? 1 - (q.d - ref.d) / s.diag : 0, f.C(0.6), f.C(0.12), '·'); });
    }
  },
  bathy(s, f) {
    const { g, cols, rows, dt, t } = f, ch = g.ch, co = g.co;
    s.z += dt * 3;
    const ybuf = s.ybuf; ybuf.fill(rows);
    if (!s.hA || s.hA.length !== cols) { s.hA = new Float32Array(cols); s.hB = new Float32Array(cols); }
    const T2 = s.tex, depthAt = (x, z) => { const u = x * 0.25, v = z * 0.25, ui = Math.floor(u), vi = Math.floor(v), fu = u - ui, fv = v - vi, a = T2[((vi & 255) << 8) | (ui & 255)], b2 = T2[((vi & 255) << 8) | ((ui + 1) & 255)], c = T2[(((vi + 1) & 255) << 8) | (ui & 255)], d = T2[(((vi + 1) & 255) << 8) | ((ui + 1) & 255)]; return a + (b2 - a) * fu + (c - a + (a - b2 - c + d) * fu) * fv; };
    // 相機在海底上方 Hc，往前斜看；F = 距離 1 處每個世界單位佔幾列
    const hor = 1 + Math.round(rows * 0.06), Hc = 10, AMP = 6, dz0 = 6, F = ((rows - 1 - hor) * dz0) / Hc;
    const D = (wx, z) => depthAt(wx * 2.9 + 700, z * 2.9);
    const ping = fract(t * 0.7), pz = dz0 + 2 + ping * 6;
    let hp = s.hA, hc = s.hB, first = true, prevDz = 2.6;
    // 由近到遠，每一片只畫還沒被前面擋住的部分；亮度依坡度（光從左前上方來）
    for (let dz = 2.6, guard = 0; dz < 140 && guard < 500; guard++) { // 從畫面下緣以外開始，近處不會有截斷的斷面
      const z = s.z + dz, sc = F / dz, step = dz - prevDz, dwx = 1 / (sc * f.aspect), wx0 = -(cols / 2) * dwx;
      // 格線只畫在間距夠大的近處，遠方不會變成一片橫紋
      const grid = (Hc * F * 4) / (dz * dz) >= 2 && Math.floor(z / 4) !== Math.floor((z - Math.max(step, 0.05)) / 4), gridX = 4 * sc * f.aspect >= 4, swath = Math.abs(dz - pz) < Math.max(step, 0.05) * 0.6, fade = 1 - (dz - dz0) / 170;
      for (let x = 0; x < cols; x++) hc[x] = D(wx0 + x * dwx, z);
      for (let x = 0; x < cols; x++) {
        const h = hc[x], sy = hor + (Hc - h * AMP) * sc;
        if (sy >= ybuf[x]) continue;
        const wx = wx0 + x * dwx + 4000, gx = gridX && Math.floor(wx / 4) !== Math.floor((wx + dwx) / 4);
        const ddx = AMP * (hc[Math.min(cols - 1, x + 1)] - hc[Math.max(0, x - 1)]) / (2 * dwx), ddz = first ? 0 : AMP * (h - hp[x]) / Math.max(0.05, step);
        const L = clamp(0.5 - 0.45 * ddx + 0.55 * ddz, 0.06, 1);
        const top = Math.max(0, Math.floor(sy)), fc = dz < 40 ? '█' : dz < 80 ? '▓' : '▒';
        const hue = 235 - 175 * h, cBody = f.H(hue, (0.08 + 0.55 * L) * fade), cEdge = f.H(hue, Math.min(0.85, (0.2 + 0.55 * L) * fade + 0.08));
        for (let y = top; y < ybuf[x] && y < rows; y++) {
          const i = y * cols + x;
          if (y === top && swath) { ch[i] = '▀'; co[i] = f.H(55, 0.55 + 0.25 * (1 - ping)); }
          else if (y === top && (grid || gx)) { ch[i] = '▀'; co[i] = cEdge; }
          else { ch[i] = fc; co[i] = cBody; }
        }
        ybuf[x] = top;
      }
      const tmp = hp; hp = hc; hc = tmp; first = false; prevDz = dz;
      dz += Math.max(0.02, (dz * dz) / (Hc * F) * 0.9);
    }
    // 多波束扇形：從船往下打到目前測量的那一排
    const cx = Math.floor(cols / 2), scP = F / pz;
    for (let kb = -8; kb <= 8; kb++) {
      const xe = cx + kb * (cols / 17), ye = Math.min(rows - 1, hor + (Hc - D((xe - cols / 2) / (scP * f.aspect), s.z + pz) * AMP) * scP);
      for (let q = 0.06; q < 1; q += 0.05) { const x = Math.round(cx + (xe - cx) * q), y = Math.round(1 + (ye - 1) * q); if (x >= 0 && x < cols && y < ybuf[x]) g.set(x, y, '·', f.H(55, 0.3 + 0.35 * q)); }
    }
    g.set(cx, 1, '▲', f.C(1));
    put(g, 1, 0, 'MULTIBEAM · 256 beams · swath 120° · depth ' + (40 + 30 * D(0, s.z + pz)).toFixed(1) + ' m · line ' + Math.floor(s.z / 4), f.C(0.8));
  },
  ascan(s, f) {
    const { g, cols, rows, dt, t } = f, H = s.H, ch = g.ch, co = g.co, b = s.b || (s.b = bnew(cols, rows));
    s.acc += dt * 12; while (s.acc >= 1) { s.acc--; this.fishCol(s, f); }
    // 下方 B 掃描：把魚探資料轉置成「距離 × 時間」
    const top = Math.floor(rows * 0.42), bh = rows - top - 1;
    for (let y = 0; y < bh; y++) for (let x = 0; x < cols; x++) {
      const srcY = Math.floor((x / cols) * rows), srcX = cols - 1 - Math.floor((y / bh) * Math.min(cols, bh * 3));
      const v = H[srcY * cols + clamp(srcX, 0, cols - 1)];
      if (v < 0.05) continue;
      const i = (top + 1 + y) * cols + x; ch[i] = RAMP10[Math.min(9, 1 + Math.floor(v * 9))]; co[i] = f.C(0.15 + 0.85 * v);
    }
    for (let x = 0; x < cols; x++) g.set(x, top, '─', f.C(0.3));
    // 上方 A 掃描：最新一欄的回波波形
    bclr(b);
    let py = null;
    const ah = top - 2;
    for (let x = 0; x < cols * 2; x++) { const srcY = Math.floor((x / (cols * 2)) * rows), v = H[srcY * cols + cols - 1] * (0.85 + 0.15 * Math.random()), y = (1 + ah) * 4 - v * (ah * 4 - 2); if (py !== null) bline(b, x - 1, py, x, y, 1, 0); py = y; }
    bflush(g, b, () => f.C(0.9));
    for (let k = 0; k <= 5; k++) put(g, Math.round((k / 5) * (cols - 5)), top, ' ' + k * 8 + 'm', f.C(0.55));
    put(g, 1, 0, 'A-SCAN · single beam 200 kHz · gain 18 dB', f.C(0.75));
  },
});

})();
