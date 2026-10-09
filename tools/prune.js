// 從 src-anims 模組裡刪掉指定的桌布。
// 用法：node tools/prune.js ids.json      （ids.json 是 id 陣列，例如 ["matrix.hex", "ca-ising"]）
// - 「基本id.變化id」：刪掉那個變化款（variants 陣列裡的那個物件）。
// - 「基本id」：刪掉整個 A({...}) 區塊，這時它所有的變化款也必須在清單裡。
// 刪完記得 node tools/build.js 重新組進 HTML，再跑 node tools/anim-harness.js --all。
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src-anims');
const ids = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const src = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(DIR, f), 'utf8')]));

// 從 s[open]（{ [ 或 (）找到對應的結尾括號，略過字串、樣板字串、註解和正規表示式
function matchClose(s, open) {
  const pairs = { '{': '}', '[': ']', '(': ')' }, stack = [];
  let prevSig = '(';
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2) + 1; continue; }
    if (c === '\'' || c === '"') { i = skipStr(s, i, c); prevSig = 'a'; continue; }
    if (c === '`') { i = skipTpl(s, i); prevSig = 'a'; continue; }
    if (c === '/' && '(,=:[!&|?{};+-*%<>~^\n'.includes(prevSig)) { i = skipRegex(s, i); prevSig = 'a'; continue; }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === '}' || c === ']' || c === ')') {
      if (stack.pop() !== c) throw new Error('bracket mismatch at ' + i);
      if (!stack.length) return i;
    }
    if (!/\s/.test(c)) prevSig = /[\w$]/.test(c) ? 'a' : c;
  }
  throw new Error('unclosed bracket from ' + open);
}
function skipStr(s, i, q) { for (i++; i < s.length; i++) { if (s[i] === '\\') i++; else if (s[i] === q) return i; } throw new Error('unclosed string'); }
function skipTpl(s, i) {
  for (i++; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '`') return i;
    else if (s[i] === '$' && s[i + 1] === '{') i = matchClose(s, i + 1);
  }
  throw new Error('unclosed template');
}
function skipRegex(s, i) {
  let cls = false;
  for (i++; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '[') cls = true;
    else if (s[i] === ']') cls = false;
    else if (s[i] === '/' && !cls) { while (/[a-z]/.test(s[i + 1])) i++; return i; }
  }
  throw new Error('unclosed regex');
}
const lineStart = (s, i) => s.lastIndexOf('\n', i - 1) + 1;
const lineEnd = (s, i) => { const e = s.indexOf('\n', i); return e < 0 ? s.length : e + 1; };

function findBase(base) {
  const needle = `A({ id: '${base}',`;
  const hits = files.filter(f => src[f].includes(needle));
  if (hits.length !== 1) throw new Error(`base ${base}: found in ${hits.length} files`);
  const f = hits[0], s = src[f], a = s.indexOf(needle);
  return { f, a, b: matchClose(s, a + 2) };
}

const byBase = new Map();
for (const id of ids) {
  const k = id.indexOf('.');
  const base = k < 0 ? id : id.slice(0, k), v = k < 0 ? null : id.slice(k + 1);
  if (!byBase.has(base)) byBase.set(base, { whole: false, vars: new Set() });
  if (v === null) byBase.get(base).whole = true; else byBase.get(base).vars.add(v);
}

let removed = 0;
for (const [base, job] of byBase) {
  const { f, a, b } = findBase(base);
  let s = src[f];
  const block = s.slice(a, b + 1);
  const vi = block.indexOf('variants: [');
  const allVars = [];
  let vOpen = -1, vClose = -1;
  if (vi >= 0) {
    vOpen = a + vi + 'variants: '.length; vClose = matchClose(s, vOpen);
    const re = /\{ id: '([^']+)'/g; re.lastIndex = vOpen;
    for (let m; (m = re.exec(s)) && m.index < vClose;) {
      allVars.push({ id: m[1], o: m.index, c: matchClose(s, m.index) });
      re.lastIndex = allVars[allVars.length - 1].c;
    }
  }
  for (const v of job.vars) if (!allVars.some(x => x.id === v)) throw new Error(`${base}.${v}: variant not found`);
  if (job.whole) {
    const keep = allVars.filter(x => !job.vars.has(x.id)).map(x => x.id);
    if (keep.length) throw new Error(`${base}: removing the base but keeping variants ${keep.join(', ')}`);
    // 整個區塊連同結尾的「});」那一行和後面一個空行
    let e = lineEnd(s, b + 1);
    if (s.slice(e, e + 1) === '\n') e++;
    else if (s.slice(e, e + 2) === '\r\n') e += 2;
    s = s.slice(0, lineStart(s, a)) + s.slice(e);
    removed += 1 + allVars.length;
  } else {
    // 從後面刪回來，前面的位置才不會跑掉；每個變化款物件佔自己的那幾行
    const del = allVars.filter(x => job.vars.has(x.id)).sort((p, q) => q.o - p.o);
    for (const x of del) {
      const ls = lineStart(s, x.o), le = lineEnd(s, x.c);
      if (s.slice(ls, x.o).trim() !== '' || s.slice(x.c + 1, le).trim().replace(/^,/, '') !== '') throw new Error(`${base}.${x.id}: variant does not occupy whole lines`);
      s = s.slice(0, ls) + s.slice(le);
      removed++;
    }
    // 變化款全部刪光就把空的 variants 陣列也拿掉
    if (del.length && del.length === allVars.length) {
      const o = s.indexOf('variants: [', lineStart(s, a)), c = matchClose(s, o + 'variants: '.length);
      if (s.slice(o + 'variants: ['.length, c).trim() !== '') throw new Error(base + ': variants not empty');
      s = s.slice(0, lineStart(s, o)) + s.slice(lineEnd(s, c));
    }
  }
  src[f] = s;
}
for (const f of files) fs.writeFileSync(path.join(DIR, f), src[f]);
console.log(`removed ${removed} wallpapers from ${byBase.size} bases`);
