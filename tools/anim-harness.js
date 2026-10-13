// 動畫測試工具：不用瀏覽器，直接在 Node 裡跑每個「基本動畫 × 變化款」。
// 用法：
//   node tools/anim-harness.js src-anims/03-fractals.js            測試一個模組（經典模組會一起載入，用來檢查 id 重複）
//   node tools/anim-harness.js --all                                測試全部模組
//   選項：--snap  另外輸出每個桌布的文字截圖到 tools/out/<模組>-snap.txt（可以直接打開看長相）
//         --only <id開頭>  只測 id 以此開頭的項目
//         --skip <檔名片段>  搭配 --all：略過檔名含這段文字的模組（可重複，和 tools/build.js 一樣）；--skip-gx 等於 --skip -gx-
//         --lang en  每次執行都設 f.lang = 'en'（英文介面時動畫畫的字），並檢查測到的桌布在 src-anims/zz-i18n-en.js 裡有沒有英文名稱；
//                    沒給就和以前一樣（不設 f.lang，動畫照舊畫中文）
//   src-anims/zz-i18n-en.js 只登記英文名稱（沒有任何動畫），單獨測它就是 0 個桌布。
// 檢查：註冊格式、執行錯誤、字元/顏色格式、效能、是否空白、是否有動、同一個基本動畫的變化款是否太像。
// 互動桌布（interactive: true）另外用模擬的滑鼠玩一輪：閒置 → 移動、點擊、按住拖曳、滾輪 → 再閒置。
// 要右鍵拖曳的桌布（rightDrag: true，基本動畫或變化款）玩的時候另外會按住右鍵移動（f.mouse.rdown，例如轉動 3D 視角）。
// 音效：f.sfx 用了不存在的種類（見核心的 Sfx.KINDS）、傳了不是有限數字的參數，或 3D 位置 {x, y, z} 裡有不是有限數字的就 FAIL；
//       平均每秒超過 12 個音效就 WARN。第三個參數可以是左右（-1–1 的數字）或 3D 位置 {x, y, z}（公尺）。
// 像素動畫（pixel: 'gl' / '2d'，直接畫整張畫布，需要瀏覽器）：這裡只檢查註冊格式（id、名稱、說明、分類、pixel 的值、變化款不能只換顏色），
//   另外計數；實際執行請用 node tools/pixel-harness.js <id>（headless Edge）。
// 結束代碼：有任何 FAIL 就是 1。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'ASCII動態桌布.html');
const SRC = path.join(ROOT, 'src-anims');
const OUT = path.join(__dirname, 'out');

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const only = opt('--only');
const all = flag('--all');
const wantSnap = flag('--snap');
const lang = opt('--lang');
const skip = args.filter((a, i) => args[i - 1] === '--skip');
if (flag('--skip-gx')) skip.push('-gx-');
const modules = all ? fs.readdirSync(SRC).filter(f => f.endsWith('.js') && !skip.some(k => f.includes(k))).sort().map(f => path.join(SRC, f))
  : args.filter((a, i) => !a.startsWith('--') && !['--only', '--lang', '--skip'].includes(args[i - 1])).map(a => path.resolve(a));
if (!modules.length) { console.error('請指定模組檔，或用 --all'); process.exit(2); }

// ── 從 HTML 取出核心程式（到 ANIMS:BEGIN 為止），在 Node 裡用簡單的替身執行 ──
const html = fs.readFileSync(HTML, 'utf8');
const script = html.slice(html.indexOf('<script>') + 8);
const core = script.slice(0, script.indexOf('/* ANIMS:BEGIN */'));
global.window = global;
global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: { outerHTML: '' }, addEventListener() {} };
vm.runInThisContext(core, { filename: 'core.js' });
const ctx = vm.runInThisContext('({ BASES, CATS, THEME_IDS, themeFns, Grid, Sfx: typeof Sfx !== "undefined" ? Sfx : null })');
const SFX_KINDS = ctx.Sfx ? ctx.Sfx.KINDS : null;   // 舊版核心沒有音效：不檢查種類

// 經典模組一定載入（id 重複檢查用）；--lang en 時也載入英文名稱表（檢查有沒有英文名稱用）
const classicsPath = path.join(SRC, '00-classics.js'), i18nPath = path.join(SRC, 'zz-i18n-en.js');
const toLoad = [...new Set([classicsPath, ...modules, ...(lang === 'en' ? [i18nPath] : [])])].filter(p => fs.existsSync(p));
const baseOrigin = new Map();
for (const p of toLoad) {
  const before = ctx.BASES.length;
  try { vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: path.basename(p) }); }
  catch (e) {
    // 正在測的模組載入失敗就停止；別人的模組（例如其他人正在改的經典模組）壞掉只提醒，不影響這次測試
    if (modules.includes(p)) { console.error(`載入 ${path.basename(p)} 失敗：${e.stack}`); process.exit(1); }
    console.warn(`（提醒）${path.basename(p)} 目前載入失敗，略過它：${String(e.message).slice(0, 120)}`);
  }
  for (const b of ctx.BASES.slice(before)) baseOrigin.set(b, path.basename(p));
}
// 英文名稱表（核心的 ANIM_EN，由 zz-i18n-en.js 填入）；舊版核心沒有
const ANIM_EN = lang === 'en' ? vm.runInThisContext('typeof ANIM_EN !== "undefined" ? ANIM_EN : null') : null;

const results = [];
const fail = (entry, msg) => { entry.fails.push(msg); };
const warn = (entry, msg) => { entry.warns.push(msg); };
const ID_RE = /^[a-z][a-z0-9-]*$/;
const COLOR_RE = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;
const cats = ctx.CATS.filter(c => c !== '全部');
// 像素動畫的種類：只有 pixel: 'gl' 或 '2d' 這兩個字串算數（和頁面的 pxKind 一樣；有的字元動畫自己有叫 pixel 的方法，例如經典的 fire）
const pxKind = b => (b && (b.pixel === 'gl' || b.pixel === '2d') ? b.pixel : null);
const testedFiles = new Set(modules.map(p => path.basename(p)));

// ── 註冊格式與攤平（和頁面裡的 buildRegistry 相同規則） ──
const seen = new Map();
const entries = [];
for (const b of ctx.BASES) {
  const file = baseOrigin.get(b);
  const testing = testedFiles.has(file);
  const reg = { id: b.id, file, fails: [], warns: [] };
  if (!b.id || !ID_RE.test(b.id)) fail(reg, `基本動畫 id 格式不對：${b.id}`);
  if (!b.name || typeof b.name !== 'string') fail(reg, '缺少 name');
  if (!cats.includes(b.cat)) fail(reg, `cat 必須是 ${cats.join('、')} 之一，現在是 ${b.cat}`);
  if (!ctx.THEME_IDS.includes(b.theme)) fail(reg, `theme 必須是 ${ctx.THEME_IDS.join('、')} 之一，現在是 ${b.theme}`);
  if (typeof b.frame !== 'function') fail(reg, '缺少 frame()');
  if (!b.desc) warn(reg, '缺少 desc');
  // 像素動畫：pixel 只能是 'gl' 或 '2d'，一定要有 init()（建立 GL 資源），dispose 要是函式；變化款不能改 pixel。
  // 動畫自己的方法剛好叫 pixel（函式）不算，照字元動畫處理
  if (b.pixel !== undefined && typeof b.pixel !== 'function') {
    if (!pxKind(b)) fail(reg, `pixel 必須是 'gl' 或 '2d'，現在是 ${JSON.stringify(b.pixel)}`);
    if (typeof b.init !== 'function') fail(reg, '像素動畫缺少 init()');
    if (b.dispose !== undefined && typeof b.dispose !== 'function') fail(reg, 'dispose 必須是函式');
    if (b.pixel === 'gl' && typeof b.dispose !== 'function') warn(reg, '像素動畫（gl）沒有 dispose()：換動畫時 GL 資源不會釋放');
    if (b.cat !== '寫實') warn(reg, `像素動畫的分類建議用 寫實，現在是 ${b.cat}`);
    if (b.keep) warn(reg, '像素動畫不用 keep（核心本來就不清畫布）');
  }
  if (b.sound !== undefined && typeof b.sound !== 'boolean') fail(reg, `sound 必須是 true 或 false，現在是 ${b.sound}`);
  const vs = b.variants || [];
  // 精選刪減後有些系列只剩少數變化款，這是正常的；只提醒變化款多到難以區分的情況
  if (file !== '00-classics.js' && vs.length > 14) warn(reg, `變化款數量 ${vs.length}（建議不超過 14）`);
  const vids = new Set();
  for (const v of [null, ...vs]) {
    const id = v ? b.id + '.' + v.id : b.id;
    if (v) {
      if (!v.id || !ID_RE.test(v.id)) fail(reg, `變化款 id 格式不對：${v.id}`);
      if (vids.has(v.id)) fail(reg, `變化款 id 重複：${v.id}`);
      vids.add(v.id);
      if (!v.name || typeof v.name !== 'string') fail(reg, `變化款 ${v.id} 缺少 name`);
      else if ([...v.name].length > 10) warn(reg, `變化款名稱太長：${v.name}`);
      if (v.theme && !ctx.THEME_IDS.includes(v.theme)) fail(reg, `變化款 ${v.id} 的 theme 不存在：${v.theme}`);
      if (v.cat && !cats.includes(v.cat)) fail(reg, `變化款 ${v.id} 的 cat 不對：${v.cat}`);
      if (v.sound !== undefined && typeof v.sound !== 'boolean') fail(reg, `變化款 ${v.id} 的 sound 必須是 true 或 false`);
      if (v.pixel !== undefined && typeof v.pixel !== 'function') fail(reg, `變化款 ${v.id} 不能改 pixel（只能寫在基本動畫上）`);
    }
    if (seen.has(id)) fail(reg, `id 和 ${seen.get(id)} 重複：${id}`);
    seen.set(id, file);
    // --lang en：英文介面用的名稱和說明（src-anims/zz-i18n-en.js；node tools/i18n-build.js 會列出全部缺少的）
    if (ANIM_EN && testing) {
      const en = v ? ANIM_EN.variants[id] : ANIM_EN.bases[b.id];
      if (!en || !en.name) warn(reg, `${id} 沒有英文名稱（src-anims/zz-i18n-en.js）`);
      else if (!en.desc && (v ? v.desc : b.desc)) warn(reg, `${id} 沒有英文說明（src-anims/zz-i18n-en.js）`);
    }
    const e = Object.create(b);
    Object.assign(e, { base: b, id, name: v ? b.name + '・' + v.name : b.name, theme: (v && v.theme) || b.theme,
      hue: v && v.hue !== undefined ? v.hue : b.hue, params: Object.assign({}, b.params || {}, v && v.params), sound: v && v.sound !== undefined ? v.sound : b.sound,
      rightDrag: v && v.rightDrag !== undefined ? v.rightDrag : b.rightDrag,
      variantParams: v ? v.params || {} : null, file, testing, pixel: pxKind(b) });
    entries.push(e);
  }
  // 像素動畫：變化款只換顏色（params 空的）的比例不能超過 30%（和下面字元動畫的規則一樣，但這裡沒有畫面可以比較）
  if (testing && pxKind(b) && vs.length) {
    const colourOnly = vs.filter(v => !v.params || Object.keys(v.params).length === 0);
    if (colourOnly.length / vs.length > 0.3) fail(reg, `${b.id} 有 ${colourOnly.length}/${vs.length} 個變化款沒有自己的 params（上限 30%），請讓變化款的參數真的不一樣`);
  }
  if (testing && (reg.fails.length || reg.warns.length)) results.push({ id: b.id + '（註冊）', file, status: reg.fails.length ? 'FAIL' : 'WARN', fails: reg.fails, warns: reg.warns });
}

// ── 執行測試 ──
// 和頁面裡 Player 一樣的滑鼠資料：x/y（格子座標）、on、moved、down、rdown（右鍵按著）、clicks（這一格之間的點擊）、wheel、idle（距離上次操作幾秒）
const newMouse = () => ({ x: 0, y: 0, on: false, moved: false, down: false, rdown: false, clicks: [], wheel: 0, idle: Infinity, last: -Infinity });
// 模擬玩家：前 1/4 閒置，中間一半在畫面上移動、點擊、按住拖曳、捲動，最後 1/4 又閒置。
// rd（要右鍵拖曳的桌布）：另外每 40 格按住右鍵移動一段（和左鍵的拖曳錯開），其他桌布的 rdown 永遠是 false（和頁面一樣）
function simInput(m, k, frames, cols, rows, t, rd) {
  const a = frames * 0.25, b = frames * 0.75;
  if (k >= a && k < b) {
    const u = (k - a) / (b - a);
    const nx = cols * (0.5 + 0.42 * Math.sin(u * 9.1 + 0.3)), ny = rows * (0.5 + 0.4 * Math.sin(u * 6.7 + 1.1));
    m.moved = nx !== m.x || ny !== m.y; m.x = nx; m.y = ny; m.on = true; m.last = t;
    if (k % 11 === 0) m.clicks.push({ x: m.x, y: m.y, button: 0 });
    m.down = (k % 40) >= 25 && (k % 40) < 34;          // 每 40 格按住一小段時間（拖曳）
    if (rd) m.rdown = (k % 40) >= 4 && (k % 40) < 18;  // 右鍵拖曳（轉動視角）
    if (k % 37 === 0) m.wheel += 120;
  } else { m.down = false; m.rdown = false; }
  m.idle = t - m.last;
}
function run(e, cols, rows, frames, snapAt, play) {
  const g = new ctx.Grid(cols, rows);
  const tf = ctx.themeFns('default', e);
  // f.sfx：和頁面一樣一定是函式；這裡只記錄次數、檢查參數
  const st = { times: [], fill: [], change: [], badCh: 0, badCo: 0, snap: null, sig: new Float64Array(20 * 10), sigN: 0, sfx: 0, sfxBad: new Set(), secs: frames / 30 };
  // 錯誤訊息裡的參數連型別一起顯示：字串 '2' 顯示成 "2"（string），才看得出是型別錯了
  const showArg = v => { if (typeof v === 'number') return String(v); try { return (typeof v === 'string' ? JSON.stringify(v) : String(v)) + `（${v === null ? 'null' : typeof v}）`; } catch (e) { return `（${typeof v}）`; } };
  const sfx = (kind, vol, pan, pitch) => {
    st.sfx++;
    if (SFX_KINDS && !SFX_KINDS.includes(kind)) st.sfxBad.add(`f.sfx 用了不存在的音效種類：${String(kind)}（可用：${SFX_KINDS.join('、')}）`);
    for (const [k, v] of [['音量', vol], ['音高', pitch]]) if (v !== undefined && !Number.isFinite(v)) st.sfxBad.add(`f.sfx 的${k}不是有限的數字：${showArg(v)}`);
    // 第三個參數：左右（-1–1 的數字），或 3D 位置 {x, y, z}（三個都要是有限的數字，單位公尺）
    if (pan !== null && typeof pan === 'object') {
      for (const c of ['x', 'y', 'z']) {
        let v;
        try { v = pan[c]; } catch (e) { st.sfxBad.add(`f.sfx 的 3D 位置讀 ${c} 時出錯：${e && e.message}`); continue; }
        if (!Number.isFinite(v)) st.sfxBad.add(`f.sfx 的 3D 位置 ${c} 不是有限的數字：${showArg(v)}（位置要寫成 {x, y, z}，單位公尺）`);
      }
    } else if (pan !== undefined && !Number.isFinite(pan)) st.sfxBad.add(`f.sfx 的左右不是有限的數字：${showArg(pan)}（或傳 3D 位置 {x, y, z}）`);
  };
  const f = { g, cols, rows, aspect: 2.1, t: 0, dt: 1 / 30, C: tf.C, H: tf.H, bg: null, mouse: newMouse(), p: e.params, sfx };
  if (lang) f.lang = lang;   // --lang en：英文介面
  const s = {};
  if (e.init) e.init(s, f);
  let prevCh = null, prevCo = null;
  for (let k = 0; k < frames; k++) {
    f.t += f.dt; f.bg = null;
    if (play) simInput(f.mouse, k, frames, cols, rows, f.t, !!e.rightDrag);
    else f.mouse.idle = Infinity;
    if (!e.keep) g.clear();
    const t0 = process.hrtime.bigint();
    e.frame(s, f);
    st.times.push(Number(process.hrtime.bigint() - t0) / 1e6);
    f.mouse.clicks.length = 0; f.mouse.wheel = 0; f.mouse.moved = false; // Player 每畫完一格就清掉
    let filled = 0, changed = 0;
    const full = k % 10 === 0;
    for (let i = 0; i < g.n; i++) {
      const c = g.ch[i];
      if (c !== ' ') {
        filled++;
        if (full) {
          if (typeof c !== 'string' || c.length < 1 || c.length > 2) st.badCh++;
          if (typeof g.co[i] !== 'string' || !COLOR_RE.test(g.co[i])) st.badCo++;
        }
      }
      if (prevCh && (c !== prevCh[i] || (c !== ' ' && g.co[i] !== prevCo[i]))) changed++;
    }
    st.fill.push(filled / g.n);
    if (prevCh) { st.change.push(changed / g.n); st.changedCells = (st.changedCells || []).concat(changed); }
    prevCh = g.ch.slice(); prevCo = g.co.slice();
    if (k >= frames * 0.4) {
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (g.ch[y * cols + x] !== ' ') st.sig[((y * 10 / rows) | 0) * 20 + ((x * 20 / cols) | 0)]++;
      st.sigN++;
    }
    if (k === snapAt) st.snap = g.toText();
  }
  return st;
}
const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const snaps = new Map();
const sigs = [];
for (const e of entries) {
  if (!e.testing) continue;
  if (only && !e.id.startsWith(only)) continue;
  const r = { id: e.id, name: e.name, file: e.file, fails: [], warns: [] };
  // 像素動畫要瀏覽器才能跑：只算數，請用 tools/pixel-harness.js 測
  if (e.pixel) { r.pixel = e.pixel; r.status = 'OK'; results.push(r); continue; }
  try {
    const big = run(e, 320, 88, 150, -1);
    const small = run(e, 100, 28, 125, 120);
    const runs = [big, small];
    const times = big.times.slice(5);
    r.avgMs = +avg(times).toFixed(2); r.maxMs = +Math.max(...times).toFixed(1);
    r.fill = +(avg(big.fill) * 100).toFixed(1);
    r.change = +(avg(big.change) * 100).toFixed(2);
    r.activeFrames = +(big.changedCells.filter(c => c >= 3).length / big.changedCells.length * 100).toFixed(0);
    if (big.badCh + small.badCh) fail(r, `有 ${big.badCh + small.badCh} 個格子的字元不是 1–2 個字的字串`);
    if (big.badCo + small.badCo) fail(r, `有 ${big.badCo + small.badCo} 個格子的顏色不是 #rrggbb（請用 f.C()/f.H() 或 rgb()）`);
    if (r.avgMs > 4) fail(r, `太慢：平均 ${r.avgMs} ms/格（320×88，上限 4 ms）`);
    if (r.maxMs > 30) warn(r, `最慢一格 ${r.maxMs} ms`);
    if (r.fill < 0.3) fail(r, `幾乎是空白：平均只有 ${r.fill}% 的格子有字`);
    else if (r.fill < 1.5) warn(r, `很稀疏：平均只有 ${r.fill}% 的格子有字（確定這是想要的樣子嗎？）`);
    if (r.activeFrames < 30) fail(r, `幾乎不動：只有 ${r.activeFrames}% 的畫格有變化`);
    if (avg(small.fill) * 100 < 1) warn(r, `小尺寸（100×28）幾乎空白：${(avg(small.fill) * 100).toFixed(1)}%`);
    if (e.interactive || e.rightDrag) {
      // 用模擬的滑鼠玩一輪（大、小兩種尺寸）：不能出錯、不能太慢、玩的時候也不能變成一片空白（rightDrag 的桌布也會右鍵拖曳）
      const playBig = run(e, 320, 88, 240, -1, true), playSmall = run(e, 100, 28, 240, 150, true);
      runs.push(playBig, playSmall);
      const pt = playBig.times.slice(5);
      r.playMs = +avg(pt).toFixed(2);
      if (r.playMs > 4) fail(r, '玩的時候太慢：平均 ' + r.playMs + ' ms/格（320×88，上限 4 ms）');
      if (Math.max(...pt) > 40) warn(r, '玩的時候最慢一格 ' + Math.max(...pt).toFixed(1) + ' ms');
      if (avg(playBig.fill) * 100 < 0.3) fail(r, '玩的時候幾乎是空白');
      if (playBig.badCh + playSmall.badCh + playBig.badCo + playSmall.badCo) fail(r, '玩的時候出現格式不對的字元或顏色');
      snaps.set(e.id + ' (play)', playSmall.snap);
    }
    // 音效：參數錯誤是 FAIL；太吵（平均每秒超過 12 個）是 WARN
    const sfxBad = new Set(runs.flatMap(x => [...x.sfxBad])), sfxN = runs.reduce((a, x) => a + x.sfx, 0);
    for (const m of [...sfxBad].slice(0, 4)) fail(r, m);
    if (sfxN) {
      r.sfxRate = +Math.max(...runs.map(x => x.sfx / x.secs)).toFixed(1);
      if (r.sfxRate > 12) warn(r, `音效太多：平均每秒 ${r.sfxRate} 個（建議不超過 12 個，桌布會一直響）`);
      if (e.sound === undefined) warn(r, '有呼叫 f.sfx，但註冊時沒有寫 sound: true，實際上不會發聲');
    }
    const sig = Array.from(big.sig, v => v / Math.max(1, big.sigN));
    sig.push(r.fill * 20, r.change * 50);
    sigs.push({ e, sig, r });
    snaps.set(e.id, small.snap);
  } catch (err) {
    fail(r, '執行錯誤：' + (err && err.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : err));
  }
  r.status = r.fails.length ? 'FAIL' : r.warns.length ? 'WARN' : 'OK';
  results.push(r);
}

// ── 同一個基本動畫的變化款太像？ ──
const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / Math.sqrt(na * nb || 1); };
const byBase = new Map();
for (const s of sigs) { if (!byBase.has(s.e.base)) byBase.set(s.e.base, []); byBase.get(s.e.base).push(s); }
for (const [base, list] of byBase) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], c = cos(a.sig, b.sig);
    if (c > 0.995 && a.e.theme === b.e.theme && !!a.e.hue === !!b.e.hue) fail(b.r, `和 ${a.e.id} 幾乎一模一樣（相似度 ${c.toFixed(4)}，配色也相同）`);
  }
  if (baseOrigin.get(base) !== '00-classics.js') {
    const vs = list.filter(s => s.e.variantParams);
    const colourOnly = vs.filter(s => Object.keys(s.e.variantParams).length === 0);
    if (vs.length && colourOnly.length / vs.length > 0.3) {
      const r = list[0].r; fail(r, `${base.id} 有 ${colourOnly.length}/${vs.length} 個變化款只換顏色（上限 30%），請讓變化款的參數真的不一樣`);
      r.status = 'FAIL';
    }
  }
}
for (const r of results) if (r.fails.length) r.status = 'FAIL';

// ── 輸出 ──
if (wantSnap) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const file of testedFiles) {
    const lines = [];
    for (const e of entries) {
      if (e.file !== file) continue;
      if (snaps.has(e.id)) lines.push(`\n=== ${e.id}  「${e.name}」  theme=${e.theme} ===\n` + snaps.get(e.id));
      if (snaps.has(e.id + ' (play)')) lines.push(`\n=== ${e.id}  玩的時候（模擬滑鼠） ===\n` + snaps.get(e.id + ' (play)'));
    }
    fs.writeFileSync(path.join(OUT, file.replace(/\.js$/, '') + '-snap.txt'), lines.join('\n'));
  }
}
const bad = results.filter(r => r.status === 'FAIL');
const warns = results.filter(r => r.status === 'WARN');
const pixels = results.filter(r => r.pixel);
const tested = results.filter(r => !r.id.endsWith('（註冊）') && !r.pixel);
for (const r of results) {
  if (r.status === 'OK') continue;
  console.log(`[${r.status}] ${r.id}${r.name ? '「' + r.name + '」' : ''}`);
  for (const m of r.fails) console.log('   ✗ ' + m);
  for (const m of r.warns) console.log('   ! ' + m);
}
const perFile = {};
for (const r of tested) perFile[r.file] = (perFile[r.file] || 0) + 1;
console.log(`\n測試 ${tested.length} 個桌布（${Object.entries(perFile).map(([f, n]) => f + ' ' + n).join('，')}）${lang ? `［f.lang = ${lang}］` : ''}：FAIL ${bad.length}，WARN ${warns.length}`);
if (pixels.length) console.log(`像素動畫 ${pixels.length} 個（${pixels.map(r => r.id).join('，')}）只檢查了註冊格式；實際執行請用 node tools/pixel-harness.js <id>（headless Edge）`);
if (tested.length) {
  const slow = tested.filter(r => r.avgMs !== undefined).sort((a, b) => b.avgMs - a.avgMs).slice(0, 5);
  console.log('最慢：' + slow.map(r => `${r.id} ${r.avgMs}ms`).join('，'));
}
if (wantSnap) console.log('文字截圖：' + [...testedFiles].map(f => path.join('tools', 'out', f.replace(/\.js$/, '') + '-snap.txt')).join('，'));
process.exit(bad.length ? 1 : 0);
