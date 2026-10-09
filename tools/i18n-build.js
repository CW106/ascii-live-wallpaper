// 產生 src-anims/zz-i18n-en.js：動畫的英文名稱和說明（英文介面用；中文名稱和說明寫在各模組的 A({...}) 裡）。
// 用法：
//   node tools/i18n-build.js [翻譯.json ...] [--fresh] [--prune] [--skip 檔名片段]
//   - 以目前的 zz-i18n-en.js 為底，再依序合併指令列給的 JSON（後面的優先），排好順序後寫回去；
//     不給 JSON 就只是重新整理、檢查一次。--fresh：不讀目前的 zz-i18n-en.js，只用給的 JSON 重新產生。
//   - JSON 格式：{ "bases": { "基本id": { "name": "...", "desc": "..." } },
//                  "variants": { "基本id.變化id": { "name": "（只有變化款的部分）", "desc": "..." } } }
//     頁面上變化款的英文名稱 = 「基本名稱 · 變化名稱」；缺英文的項目在英文介面裡顯示中文。
//   - 會載入 src-anims 裡的所有模組，列出還沒有英文的動畫（--skip 可略過某些模組，例如 --skip -gx-），
//     以及表裡找不到對應動畫的項目（加 --prune 會把這些刪掉）。
// 產生的檔案不能含有 '</script'、'<!--'、'<script'（'<' 一律寫成 <）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'ASCII動態桌布.html');
const SRC = path.join(ROOT, 'src-anims');
const OUT_NAME = 'zz-i18n-en.js';
const OUT = path.join(SRC, OUT_NAME);

const args = process.argv.slice(2);
const skip = [];
args.forEach((v, i) => { if (v === '--skip' && args[i + 1]) skip.push(args[i + 1]); });
const fresh = args.includes('--fresh'), prune = args.includes('--prune');
const inputs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--skip').map(a => path.resolve(a));

// ── 讀目前的表（執行 zz-i18n-en.js，攔下它交給 I18N_EN 的內容） ──
function readTable(file) {
  const got = { bases: {}, variants: {} };
  const sandbox = { I18N_EN: t => { Object.assign(got.bases, (t && t.bases) || {}); Object.assign(got.variants, (t && t.variants) || {}); } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: path.basename(file) });
  return got;
}
const table = { bases: {}, variants: {} };
const merge = (t, from) => {
  for (const kind of ['bases', 'variants']) {
    const src = (t && t[kind]) || {};
    if (typeof src !== 'object' || Array.isArray(src)) throw new Error(`${from}：${kind} 必須是物件`);
    for (const [id, e] of Object.entries(src)) {
      if (!e || typeof e !== 'object') throw new Error(`${from}：${kind}.${id} 必須是 { name, desc }`);
      const cur = table[kind][id] || {};
      const next = { ...cur };
      for (const k of ['name', 'desc']) {
        if (e[k] === undefined) continue;
        if (typeof e[k] !== 'string') throw new Error(`${from}：${kind}.${id}.${k} 必須是文字`);
        const v = e[k].replace(/\s+/g, ' ').trim();
        if (v) next[k] = v;
      }
      table[kind][id] = next;
    }
  }
};
if (!fresh && fs.existsSync(OUT)) merge(readTable(OUT), OUT_NAME);
for (const f of inputs) merge(JSON.parse(fs.readFileSync(f, 'utf8')), path.basename(f));

// ── 載入核心和所有動畫模組，取得目前的 id 和順序（和 tools/anim-harness.js 一樣在 Node 裡執行） ──
const html = fs.readFileSync(HTML, 'utf8');
const script = html.slice(html.indexOf('<script>') + 8);
const core = script.slice(0, script.indexOf('/* ANIMS:BEGIN */'));
global.window = global;
global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: { outerHTML: '' }, addEventListener() {} };
vm.runInThisContext(core, { filename: 'core.js' });
const ctx = vm.runInThisContext('({ BASES })');
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js') && f !== OUT_NAME && !skip.some(k => f.includes(k))).sort();
const origin = new Map();
for (const f of files) {
  const before = ctx.BASES.length;
  try { vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f }); }
  catch (e) { console.warn(`（提醒）${f} 載入失敗，略過它：${String(e.message).slice(0, 120)}`); }
  for (const b of ctx.BASES.slice(before)) origin.set(b, f);
}

// ── 依模組裡的順序排列；檢查缺少的和多出來的 ──
const known = new Set();
const order = { bases: [], variants: [] };
const missing = new Map();   // 模組 → [缺英文的 id]
const miss = (f, id) => { if (!missing.has(f)) missing.set(f, []); missing.get(f).push(id); };
for (const b of ctx.BASES) {
  const f = origin.get(b);
  known.add(b.id); order.bases.push(b.id);
  const be = table.bases[b.id];
  if (!be || !be.name) miss(f, b.id);
  else if (!be.desc && b.desc) miss(f, b.id + '（說明）');
  for (const v of b.variants || []) {
    const id = b.id + '.' + v.id;
    known.add(id); order.variants.push(id);
    const ve = table.variants[id];
    if (!ve || !ve.name) miss(f, id);
    else if (!ve.desc && v.desc) miss(f, id + '（說明）');
  }
}
const stale = [...Object.keys(table.bases), ...Object.keys(table.variants)].filter(id => !known.has(id));
if (prune) for (const id of stale) { delete table.bases[id]; delete table.variants[id]; }

// ── 寫出模組：一行一個項目，方便比對差異 ──
const js = v => JSON.stringify(v).replace(/</g, '\\u003c');
const lines = kind => {
  const ids = [...order[kind].filter(id => table[kind][id]), ...Object.keys(table[kind]).filter(id => !known.has(id)).sort()];
  return ids.map(id => `      ${js(id)}: ${js(table[kind][id])},`).join('\n');
};
const out = `// 動畫的英文名稱和說明（英文介面用）。由 tools/i18n-build.js 產生（排序、檢查缺漏）；可以直接改這個檔案，
// 或把翻譯寫成 JSON 再執行 node tools/i18n-build.js <翻譯.json> 合併進來。
// bases[基本id] = { name, desc }；variants['基本id.變化id'] = { name（只有變化款的部分，頁面上顯示成「基本名稱 · 變化名稱」）, desc }
(() => {
  if (typeof I18N_EN !== 'function') return;   // 沒有英文介面的舊版核心
  I18N_EN({
    bases: {
${lines('bases')}
    },
    variants: {
${lines('variants')}
    },
  });
})();
`;
for (const bad of ['</script', '<!--', '<script']) if (out.toLowerCase().includes(bad)) throw new Error(`產生的內容含有不能放進 <script> 的字串：${bad}`);
const tmp = OUT + '.tmp';
fs.writeFileSync(tmp, out);
readTable(tmp);   // 確定寫出來的檔案可以執行
fs.renameSync(tmp, OUT);

const nb = Object.keys(table.bases).length, nv = Object.keys(table.variants).length;
console.log(`已寫入 ${path.relative(ROOT, OUT)}：基本動畫 ${nb} 個、變化款 ${nv} 個（${(out.length / 1024).toFixed(0)} KB）`);
const total = [...missing.values()].reduce((a, l) => a + l.length, 0);
if (total) {
  console.log(`還沒有英文的動畫：${total} 項`);
  for (const [f, ids] of missing) console.log(`  ${f}：${ids.length} 項` + (ids.length <= 20 ? '：' + ids.join('、') : '（太多，略）'));
} else console.log('所有動畫都有英文名稱和說明');
if (stale.length) console.log(`${prune ? '已刪除' : '表裡有'} ${stale.length} 個找不到對應動畫的項目` + (prune ? '' : '（加 --prune 刪除）') + '：' + stale.slice(0, 20).join('、') + (stale.length > 20 ? '…' : ''));
