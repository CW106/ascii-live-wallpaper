// 像素動畫測試工具（pixel: 'gl' / '2d' 的動畫要瀏覽器才能跑）：用 headless Edge 載入組好的 HTML（#wp=<id>），
// 在頁面裡量每格的時間（Player.advance；--gpu-sync 時含等 GPU）、每格檢查 gl.getError、收集 console 錯誤和例外、
// 用 CDP 模擬滑鼠（移動、按住拖曳、點擊、滾輪）、在指定的秒數存 PNG 截圖。
// 用法：node tools/pixel-harness.js <id>[.變化款] [選項]
//   --html <檔>       要載入的 HTML（預設 ASCII動態桌布.html；測試用的複本也可以）
//   --size WxH        視窗大小（CSS 像素，預設 2560x1440）
//   --dpr N           devicePixelRatio（預設 1；2 = 高 DPI：畫布像素 = CSS 像素 × 2，MAX_CANVAS_PX 的上限照算）
//   --secs N          跑幾秒（預設 10）
//   --fps N           播放器的幀率（預設 30；縮圖一律 15）
//   --shots 2,8,30    在這些秒數存 PNG 截圖：<out>/px-<id>-<秒>s.png
//   --out <資料夾>    截圖放哪（預設 tools/out）
//   --script <json>   排好時間的滑鼠動作（檔名或 JSON 字串）：
//                     [{ "t": 秒, "type": "move" | "down" | "up" | "click" | "wheel", "x", "y"（CSS 像素）或 "fx", "fy"（0–1，視窗的比例）,
//                        "button": "left" | "right"（預設 left）, "dy": 滾輪（同 WheelEvent.deltaY，往下是正的）}, ...]
//                     沒給座標的動作用上一個動作的位置。
//   --gpu-sync        每格畫完 gl.finish()（量到的時間包含等 GPU 畫完；沒有它量到的是 CPU 的提交時間）
//   --gpu-timer       用 EXT_disjoint_timer_query_webgl2 量每格 GPU 真正花的時間（平均／中位／p95／最慢；WebGL2 + 支援的驅動才有）
//   --luid High,Low   指定顯示卡（Edge 的 --use-angle=d3d11 --use-adapter-luid；筆電的內建顯示卡才量得到真正的預算。
//                     LUID 用 PowerShell 的 DXGI 列舉可以查到，例如 0,91588）
//   --lang zh|en      載入後切換介面語言（setLang；動畫畫的字跟著 f.lang）
//   --mem             每 10 秒（先 GC）量 JS heap 和還活著的 WebGL 物件（貼圖、buffer、程式、framebuffer…）：長時間跑看有沒有一直長；
//                     活著的 GL 物件從第一次取樣到最後多了超過 8 個就 FAIL
//   --thumb           模擬作品庫的縮圖：複製模式（畫在共用的離屏 WebGL 畫布再複製）、15 fps、f.thumb = true；搭配 --size 480x270
//   --swiftshader     強制軟體 WebGL（--use-angle=swiftshader）。沒有 GPU 時會自動改用，報告會註明是軟體算的（慢很多）
//   --edge <路徑>     msedge.exe（預設找 Edge，找不到就找 Chrome；也可以設環境變數 EDGE_PATH）
//   --json            最後多印一行 JSON 摘要（給程式讀）
//   --keep            不刪 Edge 的暫存設定檔
// 結束代碼：有 console 錯誤、例外、WebGL 錯誤、沒畫出任何一格、找不到動畫或頁面 → 1。
// 注意：--script 跑的時候每一步滑鼠動作都要等 CDP 來回一趟，headless 的頁面會被拖慢（fps 掉到個位數是測試環境的關係），
//   每格的時間（advance、GPU timer）仍然可信，但 fps 不代表真正播放時的幀率；不給 --shots 就不存截圖。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ════════ Edge / CDP ════════ */
function findBrowser(explicit) {
  const la = process.env.LOCALAPPDATA || '';
  const cands = [explicit, process.env.EDGE_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', la + '/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', la + '/Google/Chrome/Application/chrome.exe'].filter(Boolean);
  return cands.find(p => fs.existsSync(p)) || null;
}
function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
function getJSON(url) {
  return new Promise((res, rej) => { http.get(url, r => { let d = ''; r.on('data', c => { d += c; }); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej); });
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map(); ws.onmessage = e => this.onmsg(JSON.parse(e.data)); ws.onclose = () => { for (const p of this.pending.values()) p.rej(new Error('CDP closed')); this.pending.clear(); }; }
  static connect(url) { return new Promise((res, rej) => { const ws = new WebSocket(url); ws.onopen = () => res(new CDP(ws)); ws.onerror = () => rej(new Error('WebSocket error: ' + url)); }); }
  onmsg(m) {
    if (m.id) { const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message + (m.error.data ? ' ' + m.error.data : ''))); else p.res(m.result); }
    else { const hs = this.handlers.get(m.method); if (hs) for (const h of hs) h(m.params); }
  }
  send(method, params = {}) { return new Promise((res, rej) => { const id = ++this.id; this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  on(method, fn) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(fn); }
  // 在頁面裡執行；頁面丟出例外就 throw
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) { const ex = r.exceptionDetails; throw new Error('頁面例外：' + ((ex.exception && (ex.exception.description || ex.exception.value)) || ex.text)); }
    return r.result ? r.result.value : undefined;
  }
  close() { try { this.ws.close(); } catch (e) { /* 已關 */ } }
}
// 啟動 headless 瀏覽器，連上第一個分頁。回傳 { proc, cdp, port, udd, kill() }
async function launch(opts) {
  const exe = findBrowser(opts.edge);
  if (!exe) throw new Error('找不到 msedge.exe（用 --edge 指定，或設環境變數 EDGE_PATH）');
  const port = await freePort();
  const udd = opts.udd || fs.mkdtempSync(path.join(os.tmpdir(), 'px-harness-'));
  const w = opts.w || 1280, h = opts.h || 720, dpr = opts.dpr || 1;
  const args = ['--headless=new', `--user-data-dir=${udd}`, `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--disable-background-networking', '--disable-component-update', '--no-proxy-server', '--hide-scrollbars', '--mute-audio', '--allow-file-access-from-files',
    '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion,msEdgeStartupBoost',
    `--window-size=${w},${h}`, `--force-device-scale-factor=${dpr}`];
  if (opts.swift) args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist');
  else if (opts.luid) args.push('--use-angle=d3d11', '--use-adapter-luid=' + opts.luid, '--ignore-gpu-blocklist');
  args.push('about:blank');
  const proc = spawn(exe, args, { stdio: 'ignore', windowsHide: true });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  const kill = () => {
    if (!exited) { try { proc.kill(); } catch (e) { /* 已結束 */ } }
    if (!opts.keep) setTimeout(() => { try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { /* 還在用 */ } }, 1500);
  };
  const t0 = Date.now();
  let ver = null;
  while (!ver) {
    if (exited) throw new Error('瀏覽器啟動後馬上結束了（' + exe + '）');
    if (Date.now() - t0 > 25000) { kill(); throw new Error('等不到 DevTools（port ' + port + '）'); }
    try { ver = await getJSON(`http://127.0.0.1:${port}/json/version`); } catch (e) { await sleep(120); }
  }
  let page = null;
  while (!page) {
    const list = await getJSON(`http://127.0.0.1:${port}/json/list`);
    page = list.find(t => t.type === 'page');
    if (!page) await sleep(100);
  }
  const cdp = await CDP.connect(page.webSocketDebuggerUrl);
  return { proc, cdp, port, udd, exe, kill, browser: ver.Browser || '' };
}
// 頁面一開始就裝好的計數器（數 getContext、記 window 的錯誤）
const BOOT_HOOK = `(() => {
  const H = window.__PXH = { ctx: {}, errors: [], frames: 0, sumMs: 0, maxMs: 0, times: [], glErr: 0, glErrCodes: {}, firstAt: 0, lastAt: 0 };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const c = gc.call(this, type, ...a);
    if (c && !this.__pxhKind) { this.__pxhKind = type; H.ctx[type] = (H.ctx[type] || 0) + 1; }
    return c;
  };
  H.res = { created: 0, deleted: 0, live: {} };
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext].filter(Boolean)) {
    for (const k of ['Texture', 'Buffer', 'Program', 'Shader', 'Framebuffer', 'Renderbuffer', 'VertexArray', 'Sampler', 'TransformFeedback']) {
      const c = C.prototype['create' + k], d = C.prototype['delete' + k];
      if (c) C.prototype['create' + k] = function (...a) { const o = c.apply(this, a); if (o) { H.res.created++; H.res.live[k] = (H.res.live[k] || 0) + 1; } return o; };
      if (d) C.prototype['delete' + k] = function (o, ...a) { if (o) { H.res.deleted++; H.res.live[k] = (H.res.live[k] || 0) - 1; } return d.call(this, o, ...a); };
    }
  }
  window.addEventListener('error', e => H.errors.push('error: ' + String(e.message)));
  window.addEventListener('unhandledrejection', e => H.errors.push('unhandledrejection: ' + String((e.reason && e.reason.message) || e.reason)));
})();`;
// 載入後：換成縮圖模式（--thumb）、設幀率、包住 Player.advance 量時間和 gl.getError
const setupScript = (id, o) => `(() => {
  const H = window.__PXH;
  if (typeof Player !== 'function' || typeof WP === 'undefined' || !WP.player) return { ok: false, why: '頁面裡沒有桌布播放器（WP.player）' };
  if (!ANIM_MAP[${JSON.stringify(id)}]) return { ok: false, why: '找不到動畫 ' + ${JSON.stringify(id)} };
  if (${o.thumb ? 'true' : 'false'}) {
    const old = WP.player; old.destroy();
    const p = new Player(document.getElementById('view-canvas'), { thumbCols: 92, interactive: true, sound: false });
    p.setAnim(${JSON.stringify(id)}); Loop.add(p); WP.player = p;
  } else WP.player.setOpts({ fps: ${o.fps} });
  if (${JSON.stringify(o.lang || '')} && typeof setLang === 'function') setLang(${JSON.stringify(o.lang || '')});
  // --gpu-timer：每格包一個 timer query（上一格的結果下一格再讀，不等 GPU）
  const TQ = H.tq = { ext: null, gl: null, pending: [], n: 0, sum: 0, max: 0, times: [], disjoint: 0, none: false };
  const tqPoll = () => { const gl = TQ.gl, ext = TQ.ext; while (TQ.pending.length) { const q = TQ.pending[0]; if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; TQ.pending.shift();
    if (gl.getParameter(ext.GPU_DISJOINT_EXT)) TQ.disjoint++; else { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; TQ.n++; TQ.sum += ms; if (ms > TQ.max) TQ.max = ms; if (TQ.times.length < 200000) TQ.times.push(ms); } gl.deleteQuery(q); } };
  const tqBegin = gl => { if (gl !== TQ.gl) { TQ.gl = gl; TQ.pending.length = 0; TQ.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); if (!TQ.ext) TQ.none = true; } if (!TQ.ext || TQ.pending.length > 16) return null; tqPoll(); const q = gl.createQuery(); gl.beginQuery(TQ.ext.TIME_ELAPSED_EXT, q); return q; };
  const adv = Player.prototype.advance;
  Player.prototype.advance = function (dt) {
    const me = this === WP.player, t0 = performance.now();
    let q = null;
    if (me && ${o.gpuTimer ? 'true' : 'false'}) { const sf = this.px && this.px.sf, gl = sf && sf.gl && !sf.lost && sf.webgl2 && this.inited ? sf.gl : null; if (gl) { try { q = tqBegin(gl); } catch (e) { q = null; } } }
    try { return adv.call(this, dt); }
    finally {
      if (q) { try { TQ.gl.endQuery(TQ.ext.TIME_ELAPSED_EXT); TQ.pending.push(q); } catch (e) { /* context 掉了 */ } }
      if (me) {
        const sf = this.px && this.px.sf, gl = sf && sf.gl && !sf.lost ? sf.gl : null;
        if (gl && ${o.gpuSync ? 'true' : 'false'}) gl.finish();
        const ms = performance.now() - t0;
        H.frames++; H.sumMs += ms; if (ms > H.maxMs) H.maxMs = ms; if (H.times.length < 200000) H.times.push(ms);
        if (!H.firstAt) H.firstAt = t0; H.lastAt = t0;
        if (gl) for (let k = 0; k < 8; k++) { const e = gl.getError(); if (!e) break; H.glErr++; H.glErrCodes[e] = (H.glErrCodes[e] || 0) + 1; }
      }
    }
  };
  return { ok: true, def: { id: ANIM_MAP[${JSON.stringify(id)}].id, name: ANIM_MAP[${JSON.stringify(id)}].name, pixel: ANIM_MAP[${JSON.stringify(id)}].pixel || null, interactive: !!ANIM_MAP[${JSON.stringify(id)}].interactive } };
})()`;
// 現在的狀態（WebGL 有沒有、哪個 GPU、畫布大小…）
const STATE = `(() => {
  const p = WP.player, px = p.px, cv = p.viewCanvas();
  let gl = null, sf = null;
  const kind = p.pixel();
  if (kind) { sf = p.pxSurface(kind); gl = sf.gl; }
  let renderer = null, webgl2 = null;
  if (gl) {
    try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { renderer = String(e); }
    webgl2 = !!sf.webgl2;
  }
  return { kind, ok: sf ? sf.ok : null, lost: sf ? sf.lost : null, gen: sf ? sf.gen : null, renderer, webgl2, pxW: p.pxW, pxH: p.pxH, dpr: p.pxDpr, devicePixelRatio: window.devicePixelRatio,
    inner: [innerWidth, innerHeight], canvas: [cv.width, cv.height], canvasHidden: !!cv.hidden, canvases: document.querySelectorAll('canvas').length, visible: document.visibilityState,
    inited: p.inited, thumb: !!p.f.thumb, copy: p.copy, fps: p.o.thumbCols ? 15 : p.opts.fps, lang: LANG, paused: Loop.paused, ctx: window.__PXH.ctx };
})()`;
const SUMMARY = `(() => {
  const H = window.__PXH, t = H.times.slice().sort((a, b) => a - b), q = f => (t.length ? t[Math.min(t.length - 1, Math.floor(f * t.length))] : 0);
  const secs = H.lastAt > H.firstAt ? (H.lastAt - H.firstAt) / 1000 : 0;
  const T = H.tq, tt = T ? T.times.slice().sort((a, b) => a - b) : [], tq = f => (tt.length ? tt[Math.min(tt.length - 1, Math.floor(f * tt.length))] : 0);
  return { frames: H.frames, avgMs: H.frames ? H.sumMs / H.frames : 0, p50: q(0.5), p95: q(0.95), maxMs: H.maxMs, glErr: H.glErr, glErrCodes: H.glErrCodes, pageErrors: H.errors,
    fpsAchieved: secs > 0 && H.frames > 1 ? (H.frames - 1) / secs : 0, ctx: H.ctx, res: H.res,
    gpu: T && T.n ? { n: T.n, avgMs: T.sum / T.n, p50: tq(0.5), p95: tq(0.95), maxMs: T.max, disjoint: T.disjoint } : (T && T.none ? { none: true } : null) };
})()`;

/* ════════ 滑鼠腳本 ════════ */
function parseScript(v, W, H) {
  if (!v) return [];
  let steps;
  try { steps = fs.existsSync(v) ? JSON.parse(fs.readFileSync(v, 'utf8')) : JSON.parse(v); } catch (e) { throw new Error('--script 不是檔名也不是合法的 JSON：' + e.message); }
  if (!Array.isArray(steps)) throw new Error('--script 必須是陣列');
  let lx = W / 2, ly = H / 2;
  const out = [];
  for (const s of steps) {
    if (!s || typeof s.t !== 'number' || !['move', 'down', 'up', 'click', 'wheel'].includes(s.type)) throw new Error('--script 的每一步要有 t（秒）和 type（move/down/up/click/wheel）：' + JSON.stringify(s));
    const x = typeof s.fx === 'number' ? s.fx * W : typeof s.x === 'number' ? s.x : lx;
    const y = typeof s.fy === 'number' ? s.fy * H : typeof s.y === 'number' ? s.y : ly;
    lx = x; ly = y;
    out.push({ t: s.t, type: s.type, x, y, button: s.button === 'right' ? 'right' : 'left', dy: typeof s.dy === 'number' ? s.dy : 120 });
  }
  return out.sort((a, b) => a.t - b.t);
}
class Mouse {
  constructor(cdp) { this.cdp = cdp; this.held = new Set(); }
  get buttons() { return (this.held.has('left') ? 1 : 0) | (this.held.has('right') ? 2 : 0); }
  async step(s) {
    const base = { x: s.x, y: s.y, buttons: this.buttons };
    if (s.type === 'move') return this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, button: this.held.size ? [...this.held][0] : 'none' });
    if (s.type === 'wheel') return this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...base, deltaX: 0, deltaY: s.dy });
    if (s.type === 'down' || s.type === 'click') {
      this.held.add(s.button);
      await this.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base, buttons: this.buttons, button: s.button, clickCount: 1 });
    }
    if (s.type === 'up' || s.type === 'click') {
      this.held.delete(s.button);
      await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: this.buttons, button: s.button, clickCount: 1 });
    }
  }
}

/* ════════ 主程式 ════════ */
function parseArgs(argv) {
  const a = argv.slice(2), opt = (n, d) => { const i = a.indexOf(n); return i >= 0 && a[i + 1] !== undefined ? a[i + 1] : d; }, flag = n => a.includes(n);
  const withVal = ['--html', '--size', '--dpr', '--secs', '--fps', '--shots', '--out', '--script', '--edge', '--lang', '--luid'];
  const id = a.find((v, i) => !v.startsWith('--') && !withVal.includes(a[i - 1]));
  const m = /^(\d+)x(\d+)$/.exec(opt('--size', '2560x1440'));
  if (!m) throw new Error('--size 要寫成 WxH，例如 2560x1440');
  return { id, html: path.resolve(opt('--html', path.join(ROOT, 'ASCII動態桌布.html'))), w: +m[1], h: +m[2], dpr: +opt('--dpr', '1') || 1, secs: +opt('--secs', '10') || 10, fps: +opt('--fps', '30') || 30,
    shots: String(opt('--shots', '')).split(',').filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n >= 0), out: path.resolve(opt('--out', path.join(__dirname, 'out'))), script: opt('--script', ''),
    gpuSync: flag('--gpu-sync'), gpuTimer: flag('--gpu-timer'), thumb: flag('--thumb'), swift: flag('--swiftshader'), edge: opt('--edge', ''), json: flag('--json'), keep: flag('--keep'),
    lang: opt('--lang', ''), luid: opt('--luid', ''), mem: flag('--mem') };
}
async function runOnce(o, swift) {
  const B = await launch({ w: o.w, h: o.h, dpr: o.dpr, swift, edge: o.edge, keep: o.keep, luid: o.luid });
  const cdp = B.cdp, log = { consoleErrors: [], exceptions: [], glLog: [], warnings: [] };
  const GL_RE = /GL_INVALID|INVALID_(ENUM|VALUE|OPERATION|FRAMEBUFFER)|GL_OUT_OF_MEMORY|WebGL: (?!performance warning|CONTEXT_LOST_WEBGL)/;   // 失去 context 本身不算動畫的錯
  try {
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable');
    cdp.on('Runtime.consoleAPICalled', p => {
      const text = (p.args || []).map(a => a.value !== undefined ? String(a.value) : a.description || a.type).join(' ');
      if (p.type === 'error') log.consoleErrors.push(text.slice(0, 400));
      else if (p.type === 'warning') { if (GL_RE.test(text)) log.glLog.push(text.slice(0, 300)); else log.warnings.push(text.slice(0, 300)); }
    });
    cdp.on('Runtime.exceptionThrown', p => { const ex = p.exceptionDetails; log.exceptions.push(((ex.exception && ex.exception.description) || ex.text || '').slice(0, 400)); });
    cdp.on('Log.entryAdded', p => { const e = p.entry, text = String(e.text || ''); if (GL_RE.test(text)) log.glLog.push(text.slice(0, 300)); else if (e.level === 'error') log.consoleErrors.push('[' + e.source + '] ' + text.slice(0, 300)); else if (e.level === 'warning') log.warnings.push(text.slice(0, 300)); });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: o.w, height: o.h, deviceScaleFactor: o.dpr, mobile: false });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: BOOT_HOOK });
    const url = 'file:///' + o.html.replace(/\\/g, '/').replace(/^\/+/, '') + '#wp=' + encodeURIComponent(o.id);
    const loaded = new Promise(res => cdp.on('Page.loadEventFired', res));
    await cdp.send('Page.navigate', { url });
    await Promise.race([loaded, sleep(20000)]);
    await sleep(300);
    const setup = await cdp.eval(setupScript(o.id, o));
    if (!setup.ok) return { fatal: setup.why, B, log };
    // 第一格之後才知道 WebGL 有沒有、是哪個 GPU
    let st = null;
    for (let k = 0; k < 40; k++) { await sleep(100); st = await cdp.eval(STATE); if (st.inited || (st.kind && st.ok === false)) break; }
    if (st.kind === 'gl' && st.ok === false) return { noGL: true, B, log, st };
    const steps = parseScript(o.script, o.w, o.h), mouse = new Mouse(cdp), shots = [], shotTimes = o.shots.slice().sort((a, b) => a - b);
    fs.mkdirSync(o.out, { recursive: true });
    const t0 = Date.now(), now = () => (Date.now() - t0) / 1000;
    let si = 0, hi = 0;
    // --mem：每 10 秒先 GC 再量 heap 和活著的 GL 物件
    const mems = [], memTimes = o.mem ? [] : [];
    if (o.mem) { for (let t = 5; t < o.secs; t += 10) memTimes.push(t); memTimes.push(o.secs); }
    let mi = 0;
    const sampleMem = async tsec => { try { await cdp.send('HeapProfiler.collectGarbage'); } catch (e) { /* 沒有 HeapProfiler */ } const hu = await cdp.send('Runtime.getHeapUsage'); const res = await cdp.eval('JSON.parse(JSON.stringify(window.__PXH.res))'); const live = Object.values(res.live).reduce((a, b) => a + b, 0); mems.push({ t: tsec, heapMB: hu.usedSize / 1048576, live, kinds: res.live }); };
    while (now() < o.secs || si < steps.length || hi < shotTimes.length || mi < memTimes.length) {
      const nextStep = si < steps.length ? steps[si].t : Infinity, nextShot = hi < shotTimes.length ? shotTimes[hi] : Infinity, nextMem = mi < memTimes.length ? memTimes[mi] : Infinity;
      const next = Math.min(nextStep, nextShot, nextMem, o.secs);
      if (next > now()) await sleep(Math.min(250, Math.max(1, (next - now()) * 1000)));
      if (now() >= nextStep) { await mouse.step(steps[si++]); continue; }
      if (now() >= nextMem) { await sampleMem(memTimes[mi++]); continue; }
      if (now() >= nextShot) {
        const tsec = shotTimes[hi++], r = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const file = path.join(o.out, `px-${o.id.replace(/[^a-z0-9.-]/gi, '_')}-${tsec}s.png`);
        fs.writeFileSync(file, Buffer.from(r.data, 'base64')); shots.push(file); continue;
      }
      if (now() >= o.secs && si >= steps.length && hi >= shotTimes.length && mi >= memTimes.length) break;
    }
    const sum = await cdp.eval(SUMMARY), st2 = await cdp.eval(STATE);
    return { B, log, st: st2, sum, shots, setup, swift, mems };
  } catch (e) { return { fatal: e.message, B, log }; }
}
async function main() {
  const o = parseArgs(process.argv);
  if (!o.id) { console.error('請指定動畫 id，例如 node tools/pixel-harness.js px-fog.snow --shots 2,8'); process.exit(2); }
  if (!fs.existsSync(o.html)) { console.error('找不到 HTML：' + o.html); process.exit(2); }
  let r = await runOnce(o, o.swift);
  if (r.noGL && !o.swift) {
    console.log('這個環境的 headless Edge 沒有 WebGL（GPU）：改用軟體算（--use-angle=swiftshader，慢很多；時間數字不代表真正的 GPU）');
    r.B.cdp.close(); r.B.kill();
    r = await runOnce(o, true);
  }
  const { B, log } = r;
  try {
    if (r.fatal) { console.log('FAIL ' + r.fatal); for (const e of log.exceptions) console.log('   例外：' + e); for (const e of log.consoleErrors) console.log('   console：' + e); process.exitCode = 1; return; }
    if (r.noGL) { console.log('FAIL 連軟體 WebGL 也沒有'); process.exitCode = 1; return; }
    const st = r.st, sum = r.sum, def = r.setup.def;
    const soft = /swiftshader|software|llvmpipe/i.test(st.renderer || '') || r.swift;
    const fails = [];
    if (!sum.frames) fails.push('沒畫出任何一格');
    if (sum.glErr) fails.push(`WebGL 錯誤 ${sum.glErr} 次（gl.getError：${Object.entries(sum.glErrCodes).map(([c, n]) => '0x' + (+c).toString(16) + '×' + n).join('，')}）`);
    if (log.glLog.length) fails.push(`瀏覽器回報 WebGL 錯誤 ${log.glLog.length} 則`);
    if (log.consoleErrors.length) fails.push(`console.error ${log.consoleErrors.length} 則`);
    if (log.exceptions.length + sum.pageErrors.length) fails.push(`例外 ${log.exceptions.length + sum.pageErrors.length} 則`);
    if (def.pixel && !st.kind) fails.push('播放器沒有進入像素模式');
    if (st.lost) fails.push('WebGL 還是失去的狀態');
    const mems = r.mems || [];
    if (mems.length >= 2 && mems[mems.length - 1].live > mems[0].live + 8) fails.push(`活著的 WebGL 物件一直增加（${mems[0].live} → ${mems[mems.length - 1].live}）`);
    if (o.gpuTimer && sum.gpu && sum.gpu.none) console.log('  （--gpu-timer：這個 context 沒有 EXT_disjoint_timer_query_webgl2，量不到 GPU 時間）');
    console.log(`像素動畫測試 ${def.id}「${def.name}」 pixel=${def.pixel}${def.interactive ? ' interactive' : ''}  視窗 ${o.w}×${o.h} @dpr ${o.dpr} → 畫布 ${st.canvas[0]}×${st.canvas[1]}${o.thumb ? '（縮圖模式）' : ''}`);
    console.log(`  ${st.kind === 'gl' ? (st.webgl2 ? 'WebGL2' : 'WebGL1') + '  ' + (st.renderer || '?') + (soft ? '  ［軟體算的］' : '  ［GPU］') : st.kind === '2d' ? 'Canvas 2D' : '字元動畫'}  ${B.browser}`);
    console.log(`  畫了 ${sum.frames} 格（${sum.fpsAchieved.toFixed(1)} fps，設定 ${st.fps}）  advance 平均 ${sum.avgMs.toFixed(2)} ms  中位 ${sum.p50.toFixed(2)}  p95 ${sum.p95.toFixed(2)}  最慢 ${sum.maxMs.toFixed(1)}${o.gpuSync ? '（含等 GPU：--gpu-sync）' : '（只有 CPU 提交的時間；加 --gpu-sync 量含 GPU 的）'}`);
    if (sum.gpu && !sum.gpu.none) console.log(`  GPU（timer query，${sum.gpu.n} 格）平均 ${sum.gpu.avgMs.toFixed(2)} ms  中位 ${sum.gpu.p50.toFixed(2)}  p95 ${sum.gpu.p95.toFixed(2)}  最慢 ${sum.gpu.maxMs.toFixed(2)}${sum.gpu.disjoint ? '  （disjoint ' + sum.gpu.disjoint + ' 次）' : ''}`);
    console.log(`  WebGL 錯誤 ${sum.glErr}  console 錯誤 ${log.consoleErrors.length}  例外 ${log.exceptions.length + sum.pageErrors.length}  警告 ${log.warnings.length}  context：${Object.entries(st.ctx).map(([k, n]) => k + ' ' + n).join('，') || '無'}  畫布元素 ${st.canvases}  f.thumb ${st.thumb}  dpr ${st.dpr}  lang ${st.lang}  GL 物件 建 ${sum.res.created} 刪 ${sum.res.deleted} 活 ${Object.values(sum.res.live).reduce((a, b) => a + b, 0)}`);
    if (mems.length) { const hs = mems.map(m => m.heapMB); console.log(`  記憶體（GC 後，${mems.length} 次取樣）：heap ${hs[0].toFixed(1)} → ${hs[hs.length - 1].toFixed(1)} MB（最少 ${Math.min(...hs).toFixed(1)}，最多 ${Math.max(...hs).toFixed(1)}）  活著的 GL 物件 ${mems[0].live} → ${mems[mems.length - 1].live}  ${JSON.stringify(mems[mems.length - 1].kinds)}`); }
    if (r.shots.length) console.log('  截圖：' + r.shots.map(f => path.relative(ROOT, f)).join('，'));
    for (const e of log.consoleErrors.slice(0, 6)) console.log('   ✗ console：' + e);
    for (const e of [...log.exceptions, ...sum.pageErrors].slice(0, 6)) console.log('   ✗ 例外：' + e);
    for (const e of log.glLog.slice(0, 6)) console.log('   ✗ WebGL：' + e);
    for (const e of log.warnings.slice(0, 4)) console.log('   ! ' + e);
    console.log(fails.length ? 'FAIL：' + fails.join('；') : 'PASS');
    if (o.json) console.log(JSON.stringify({ id: def.id, pixel: def.pixel, size: [o.w, o.h], dpr: o.dpr, canvas: st.canvas, webgl2: st.webgl2, renderer: st.renderer, software: soft, thumb: o.thumb, frames: sum.frames, fps: sum.fpsAchieved, avgMs: sum.avgMs, p50: sum.p50, p95: sum.p95, maxMs: sum.maxMs, gpuSync: o.gpuSync, glErr: sum.glErr, consoleErrors: log.consoleErrors, exceptions: [...log.exceptions, ...sum.pageErrors], glLog: log.glLog, warnings: log.warnings.length, ctx: st.ctx, canvases: st.canvases, shots: r.shots, gpu: sum.gpu, res: sum.res, mems, lang: st.lang, pass: !fails.length }));
    process.exitCode = fails.length ? 1 : 0;
  } finally { B.cdp.close(); B.kill(); }
}
if (require.main === module) main().catch(e => { console.error('FAIL ' + (e.stack || e)); process.exit(1); });
module.exports = { launch, CDP, Mouse, parseScript, findBrowser, BOOT_HOOK, sleep };
