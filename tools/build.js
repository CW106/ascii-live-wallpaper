// 把 src-anims/*.js 組進 ASCII動態桌布.html（ANIMS:BEGIN 和 ANIMS:END 之間）。
// 用法：node tools/build.js [--skip 檔名片段]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'ASCII動態桌布.html');
const SRC = path.join(ROOT, 'src-anims');
const BEGIN = '/* ANIMS:BEGIN */', END = '/* ANIMS:END */';

// --skip <文字>：略過檔名含這段文字的模組（例如還在製作中的模組），可重複
const skip = [];
process.argv.forEach((v, i, all) => { if (v === '--skip' && all[i + 1]) skip.push(all[i + 1]); });
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js') && !skip.some(k => f.includes(k))).sort();
const parts = [];
for (const f of files) {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  // 這些字串放在 <script> 裡會提早結束腳本或破壞頁面
  for (const bad of ['</script', '<!--', '<script']) {
    if (code.toLowerCase().includes(bad)) throw new Error(`${f} 含有不能放進 <script> 的字串：${bad}（請改寫成 '<scr' + 'ipt' 這類拆開的寫法）`);
  }
  parts.push(`/* ── ${f} ── */\n${code.trim()}\n`);
}

let html = fs.readFileSync(HTML, 'utf8');
const a = html.indexOf(BEGIN), b = html.indexOf(END);
if (a < 0 || b < a) throw new Error('找不到 ANIMS:BEGIN / ANIMS:END 標記');
html = html.slice(0, a + BEGIN.length) + '\n' + parts.join('\n') + html.slice(b);
fs.writeFileSync(HTML, html);
console.log(`已組入 ${files.length} 個動畫模組：${files.join(', ')}`);
