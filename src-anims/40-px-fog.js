// 起霧的玻璃・影像（px-fog）：和 ix-fog 一樣的三個窗外景（夜晚的城市、雪地清晨、雨夜街角），改用真正的影像畫（pixel: 'gl'）。
// 窗玻璃起了一層霧：霧裡的景失焦、退色、帶一點藍灰，燈在霧裡散成圓圓的光斑（散景）；擦過的地方看得見清楚、鮮豔的窗外。
// 按住滑鼠就像用手指在霧上畫畫（柔邊的圓手指）、點一下按一個指印、滾輪調整手指粗細；筆畫邊緣聚著小水珠（反光、把後面的景折射一點），
// 筆畫底下偶爾長出一顆水珠、歪歪扭扭地流下去留下清楚的水痕；擦過的地方 40–90 秒內從邊緣慢慢再起霧。沒人操作時看不見的手指會自己畫小塗鴉。
// 擦開的地方也看得到濕路面的倒影（雨夜街角、城市的馬路：上面的景倒映下來，雨打出的漣漪讓它晃動）。
// 做法：霧／水氣的場（F 濃度、暫停起霧的時間、水膜、水珠高度）放在 1/4 解析度的貼圖裡（有半精度浮點就用，沒有就 8 位元；每格的小變化用隨機進位對齊到貼圖的格子，
// 不靠 GPU 存貼圖時的四捨五入），目標濃度圖每 2 秒才重算；筆畫用「膠囊」四邊形乘進場裡（相乘混合，WebGL1 也行）；
// 窗外的靜態景在 init 時畫一次成有 mipmap 的貼圖（WebGL2 用 4× 多重取樣，斜邊才平滑），霧裡的失焦直接用 LOD 取樣；
// 燈的散景另外用加法混合畫成光斑圖（1/4 解析度）；霧裡的景（失焦＋光暈＋散景＋大顆粒）也在 1/4 解析度合好；然後一次全螢幕合成（折射、細顆粒、調色），
// 筆畫邊緣的水珠另外一個 pass 只畫有邊緣的 32 像素格子（WebGL2 用 instance，沒邊緣的格子在頂點著色器裡丟掉），再疊上會動的東西（雪、雨、車燈、開關的窗）和提示字。
(() => {
/* ════════════ 小工具 ════════════ */
const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
const PI = Math.PI;
const sst = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
const hsh = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 1D 平滑雜訊（山脈、地形的輪廓）
function n1(x, seed) { const i = Math.floor(x), t = x - i, u = t * t * (3 - 2 * t); return (hsh(i, seed) * (1 - u) + hsh(i + 1, seed) * u) * 2 - 1; }
function fbm1(x, seed, oct) { let v = 0, a = 0.5, s = 0; for (let k = 0; k < oct; k++) { v += n1(x, seed + k * 17) * a; s += a; x *= 2.03; a *= 0.5; } return v / s; }
const wideCh = c => { const k = c.codePointAt(0); return k >= 0x2e80 && k < 0xff61; };
const hexC = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulC = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const WHITE = [1, 1, 1];
// 每格都會用到的顏色先算好（每格裡不再配置新的陣列）
const C_RED = hexC('#ff3a3a'), C_RED2 = hexC('#ff4040'), C_HEAD = hexC('#fff4dc'), C_TAIL = hexC('#ff3b30'), C_PLANE = hexC('#fff6e0'), C_GREEN = hexC('#60ff80');
const C_FLAKE = hexC('#f4f6ff'), C_FLAKE2 = hexC('#e8ecff'), C_SMOKE = hexC('#9fa6c0'), C_RAIN = hexC('#a9b3cc'), C_RIP = hexC('#9aa4c0'), C_HEAD2 = hexC('#fff1d6'), C_TAIL2 = hexC('#ff3a30');
const TLC = [hexC('#ff3b3b'), hexC('#ffc23b'), hexC('#3bff7a')];

/* ════════════ WebGL 小幫手 ════════════ */
function mkProg(gl, vs, fs, name) {
  const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(name + ' shader: ' + gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram(); const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ' link: ' + gl.getProgramInfoLog(p));
  gl.deleteShader(v); gl.deleteShader(f);
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let k = 0; k < n; k++) { const inf = gl.getActiveUniform(p, k); u[inf.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, inf.name); }
  const a = {}, na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let k = 0; k < na; k++) { const inf = gl.getActiveAttrib(p, k); a[inf.name] = gl.getAttribLocation(p, inf.name); }
  return { p, u, a };
}
function mkTex(gl, w, h, opt) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opt.mip ? gl.LINEAR_MIPMAP_LINEAR : (opt.nearest ? gl.NEAREST : gl.LINEAR));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opt.nearest ? gl.NEAREST : gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, opt.ifmt || gl.RGBA, w, h, 0, gl.RGBA, opt.type || gl.UNSIGNED_BYTE, null);
  return t;
}
function mkFbo(gl, tex) { const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return ok ? fb : (gl.deleteFramebuffer(fb), null); }
// 霧的場要能累積很小的變化：有半精度浮點（可當 render target、可線性取樣）就用；沒有就退回 8 位元（更新時加抖動）
function pickFieldFmt(gl, isGL2) {
  const tries = [];
  if (isGL2) { const ext = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'); if (ext) tries.push({ ifmt: gl.RGBA16F, type: gl.HALF_FLOAT, name: 'rgba16f' }); }
  else { const hf = gl.getExtension('OES_texture_half_float'); const lin = gl.getExtension('OES_texture_half_float_linear'); const cb = gl.getExtension('EXT_color_buffer_half_float'); if (hf && lin && cb) tries.push({ ifmt: gl.RGBA, type: hf.HALF_FLOAT_OES, name: 'rgba16f-oes' }); }
  for (const t of tries) {
    try {
      const tex = mkTex(gl, 4, 4, t); const fb = mkFbo(gl, tex);
      if (fb) { gl.deleteFramebuffer(fb); gl.deleteTexture(tex); if (gl.getError() === gl.NO_ERROR) return t; }
      gl.deleteTexture(tex);
    } catch (e) { /* 試下一個 */ }
    gl.getError();
  }
  return { ifmt: gl.RGBA, type: gl.UNSIGNED_BYTE, name: 'rgba8' };
}

/* ════════════ 幾何批次：三角形列表，每個頂點 x,y（畫布像素）, r,g,b,a, u,v, 種類 ════════════ */
const VF = 9;
class Batch {
  constructor(cap) { this.d = new Float32Array(cap * VF); this.n = 0; this.cap = cap; this.chunks = []; this.mode = 0; this.mark = 0; }
  // 混合模式：0 = 一般透明度、1 = 加法。換模式時切成新的一段
  blend(mode) { if (mode !== this.mode) { this.flushChunk(); this.mode = mode; } }
  flushChunk() { if (this.n > this.mark) { this.chunks.push({ a: this.mark, b: this.n, mode: this.mode }); this.mark = this.n; } }
  clear() { this.n = 0; this.mark = 0; this.chunks.length = 0; this.mode = 0; }
  grow(need) { if (this.n + need <= this.cap) return true; if (this.fixed) return false; let c = this.cap; while (this.n + need > c) c *= 2; const nd = new Float32Array(c * VF); nd.set(this.d); this.d = nd; this.cap = c; return true; }
  v(x, y, c, a, u, w, k) { const o = this.n * VF, d = this.d; d[o] = x; d[o + 1] = y; d[o + 2] = c[0]; d[o + 3] = c[1]; d[o + 4] = c[2]; d[o + 5] = a; d[o + 6] = u; d[o + 7] = w; d[o + 8] = k; this.n++; }
  // 四邊形（四個角依序：左上、右上、右下、左下），每個角可以有自己的顏色/透明度
  quad4(x0, y0, x1, y1, x2, y2, x3, y3, c0, a0, c1, a1, c2, a2, c3, a3, k) {
    if (!this.grow(6)) return;
    this.v(x0, y0, c0, a0, 0, 0, k); this.v(x1, y1, c1, a1, 1, 0, k); this.v(x2, y2, c2, a2, 1, 1, k);
    this.v(x0, y0, c0, a0, 0, 0, k); this.v(x2, y2, c2, a2, 1, 1, k); this.v(x3, y3, c3, a3, 0, 1, k);
  }
  rect(x, y, w, h, c, a, k = 0) { this.quad4(x, y, x + w, y, x + w, y + h, x, y + h, c, a, c, a, c, a, c, a, k); }
  // 上下不同顏色的矩形（漸層）
  vrect(x, y, w, h, c0, a0, c1, a1, k = 0) { this.quad4(x, y, x + w, y, x + w, y + h, x, y + h, c0, a0, c0, a0, c1, a1, c1, a1, k); }
  tri(x0, y0, x1, y1, x2, y2, c, a, c2) { if (!this.grow(3)) return; this.v(x0, y0, c, a, 0, 0, 0); this.v(x1, y1, c, a, 1, 0, 0); this.v(x2, y2, c2 || c, a, 0.5, 1, 0); }
  // 以中心、半徑畫的方形貼圖（圓、光暈、散景...）：rx/ry 半徑
  disc(cx, cy, rx, ry, c, a, k) { this.quad4(cx - rx, cy - ry, cx + rx, cy - ry, cx + rx, cy + ry, cx - rx, cy + ry, c, a, c, a, c, a, c, a, k); }
  // 線段（有寬度；k 6 = 柔邊光條）
  line(x0, y0, x1, y1, w, c, a, k = 0) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w * 0.5, ny = dx / L * w * 0.5;
    this.quad4(x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny, c, a, c, a, c, a, c, a, k);
  }
  // 貼上 2D 文字貼圖（k 10）
  tex(x, y, w, h, a) { const c = WHITE; this.quad4(x, y, x + w, y, x + w, y + h, x, y + h, c, a, c, a, c, a, c, a, 10); }
}
// 把批次送上 GPU 並畫出來（program = 批次著色器；靜態的批次只上傳一次）
function drawBatch(gl, P, b, buf, upload, res) {
  b.flushChunk();
  if (!b.chunks.length) return;
  gl.useProgram(P.p);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  if (upload === 2) gl.bufferData(gl.ARRAY_BUFFER, b.d.subarray(0, b.n * VF), gl.STATIC_DRAW);
  else if (upload) gl.bufferSubData(gl.ARRAY_BUFFER, 0, b.d.subarray(0, b.n * VF));
  gl.enableVertexAttribArray(P.a.aPos); gl.vertexAttribPointer(P.a.aPos, 2, gl.FLOAT, false, VF * 4, 0);
  gl.enableVertexAttribArray(P.a.aCol); gl.vertexAttribPointer(P.a.aCol, 4, gl.FLOAT, false, VF * 4, 8);
  gl.enableVertexAttribArray(P.a.aUvk); gl.vertexAttribPointer(P.a.aUvk, 3, gl.FLOAT, false, VF * 4, 24);
  gl.uniform2f(P.u.uRes, res[0], res[1]);
  gl.enable(gl.BLEND);
  for (const ch of b.chunks) {
    if (ch.mode === 1) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, ch.a, ch.b - ch.a);
  }
  gl.disableVertexAttribArray(P.a.aPos); gl.disableVertexAttribArray(P.a.aCol); gl.disableVertexAttribArray(P.a.aUvk);
}

/* ════════════ 著色器（GLSL ES 1.0：WebGL1 和 WebGL2 都能用） ════════════ */
const HASH = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); float a = hash12(i), b = hash12(i+vec2(1.0,0.0)), c = hash12(i+vec2(0.0,1.0)), d = hash12(i+vec2(1.0,1.0)); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
`;
// 批次：畫布像素 → 裁切空間（y 向下）
const VS_BATCH = `
attribute vec2 aPos; attribute vec4 aCol; attribute vec3 aUvk;
uniform vec2 uRes;
varying vec4 vCol; varying vec3 vUvk;
void main(){ vCol = aCol; vUvk = aUvk; gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0, 0.0, 1.0); }`;
const FS_BATCH = `
precision mediump float;
varying vec4 vCol; varying vec3 vUvk;
uniform sampler2D uTex; uniform sampler2D uField; uniform vec2 uInvRes; uniform float uFogAtt; uniform float uDither;
${HASH}
void main(){
  vec2 uv = vUvk.xy; float k = vUvk.z; vec4 c = vCol;
  vec2 q = uv * 2.0 - 1.0; float d = length(q);
  if (k < 0.5) { c.rgb += (hash12(gl_FragCoord.xy) - 0.5) * uDither; }
  else if (k < 1.5) { c.a *= smoothstep(1.0, 0.3, d); }                                   // 柔邊圓
  else if (k < 2.5) { float e = clamp(1.0 - d, 0.0, 1.0); c.a *= e * e * (0.6 + 0.4 * e); }  // 光暈
  else if (k < 3.5) { c.a *= smoothstep(1.0, 0.72, d) * (0.7 + 0.45 * smoothstep(0.35, 0.92, d)); } // 散景光斑：邊緣亮一點
  else if (k < 4.5) { c.rgb *= 1.0 - 0.38 * uv.y + 0.08 * smoothstep(0.0, 0.25, uv.y) * (1.0 - smoothstep(0.25, 0.5, uv.y)); c.a *= 0.86 + 0.14 * smoothstep(0.08, 0.0, abs(uv.x - 0.5) - 0.42); } // 窗：上面亮、下面暗
  else if (k < 5.5) { float e = clamp(1.0 - d, 0.0, 1.0); c.a *= e * e * e; }                 // 星星、小亮點
  else if (k < 6.5) { float w = 1.0 - q.y * q.y; c.a *= w * w * smoothstep(0.0, 0.25, uv.x) * (1.0 - 0.7 * uv.x); } // 橫向拖尾（車燈）
  else if (k < 7.5) { float w = 1.0 - q.x * q.x; c.a *= w * w * smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.75, uv.y); } // 直的光條（雨絲、倒影）
  else if (k < 8.5) { c.a *= smoothstep(1.0, 0.93, d); }                                   // 硬邊圓（月亮、燈）
  else if (k < 9.5) { c.a *= smoothstep(0.16, 0.0, abs(d - 0.82)) * (0.6 + 0.4 * (1.0 - q.y * 0.5)); } // 環（漣漪）
  else if (k < 10.5) { c *= texture2D(uTex, uv); }                                          // 文字貼圖
  else { float w = 1.0 - q.x * q.x; c.a *= w * smoothstep(1.0, 0.0, uv.y); }                // 向下漸淡的直條（倒影）
  if (uFogAtt > 0.5) { float F = texture2D(uField, gl_FragCoord.xy * uInvRes).r; c.a *= 1.0 - smoothstep(0.06, 0.42, F); }
  gl_FragColor = c;
}`;
// 全螢幕四邊形
const VS_QUAD = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
// 霧的目標濃度圖（1/4 解析度）：各處的霧最後會回到多濃（R，存 (T-0.5)*2）和回霧的快慢（G）。雜訊只慢慢飄（每秒千分之一格），
// 每 2 秒重算一次就夠了，場的更新每格就少讀三張雜訊
const FS_TGT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uNoise; uniform float uT, uSeed, uAspect; uniform vec3 uFogP;
void main(){
  vec2 uv = vUv; vec2 q = vec2(uv.x * uAspect, uv.y);
  float n = texture2D(uNoise, q * 0.1625 + uSeed * 0.0371 + vec2(uT * 0.00069, -uT * 0.00037)).g * 0.62 + texture2D(uNoise, q * 0.1 - uSeed * 0.0513 + vec2(-uT * 0.00022, uT * 0.00006)).r * 0.38;
  float corner = smoothstep(0.5, 1.0, abs(uv.x * 2.0 - 1.0)) * 0.08 + smoothstep(0.8, 1.0, uv.y) * 0.05;
  float T = clamp(uFogP.x + (n - 0.5) * uFogP.z + smoothstep(0.36, 0.0, uv.y) * uFogP.y + corner, 0.5, 1.0);
  gl_FragColor = vec4((T - 0.5) * 2.0, texture2D(uNoise, q * 0.14 + uSeed * 0.0731).r, 0.0, 1.0);
}`;
// 霧的場更新（乒乒乓乓）：R 霧濃度、G 1-暫停起霧、B 1-水膜、A 1-水珠高度
const HMAX = 14, WETMAX = 70;
const FS_FIELD = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPrev, uTgt, uMask; uniform vec2 uTexel; uniform float uDt, uT, uInit, uDither;
${HASH}
void main(){
  vec2 uv = vUv;
  vec4 tg = texture2D(uTgt, uv); float T = 0.5 + 0.5 * tg.r;
  if (uInit > 0.5) {   // 開場：uMask 的 R = 舊塗鴉（只擦掉一半、馬上開始回霧）、G = 水痕（擦得深、濕的）
    vec4 mk = texture2D(uMask, uv); float a = min(1.0, mk.r), b = min(1.0, mk.g);
    gl_FragColor = vec4(T * (1.0 - 0.8 * a) * (1.0 - 0.9 * b), 1.0, 1.0 - 0.45 * b, 1.0); return;
  }
  vec4 p = texture2D(uPrev, uv);
  float F = p.r, hI = p.g, wI = p.b, bI = p.a;
  float hold = 1.0 - hI;
  hI = min(1.0, hI + uDt / ${HMAX.toFixed(1)});
  wI = min(1.0, wI + uDt / ${WETMAX.toFixed(1)});
  float wet = 1.0 - wI;
  float nb = (texture2D(uPrev, uv + vec2(uTexel.x * 2.0, 0.0)).r + texture2D(uPrev, uv - vec2(uTexel.x * 2.0, 0.0)).r + texture2D(uPrev, uv + vec2(0.0, uTexel.y * 2.0)).r + texture2D(uPrev, uv - vec2(0.0, uTexel.y * 2.0)).r) * 0.25;
  float tau = mix(9.0, 20.0, tg.g);
  float rate = (hold < 0.002 ? 1.0 : 0.0) * (0.36 + 0.64 * smoothstep(0.08, 0.75, nb)) * (1.0 - 0.7 * wet) / tau;
  F += (T - F) * min(1.0, rate * uDt);
  bI = 1.0 - (1.0 - bI) * exp(-uDt * 9.0);
  // 每格的變化比貼圖的一格還小（F 一格約 0.1 LSB、水膜 0.1 LSB），不能靠 GPU 存進貼圖時的四捨五入（D3D11 存半精度是無條件捨去、
  // 8 位元也不是每張卡都精確到最近）：這裡自己對齊到貼圖的格子，用隨機進位讓平均值仍然等於真正的值；+0.25 格讓存的值不管是捨去還是四捨五入都落在同一格。
  // 8 位元：格子 1/255；半精度：2^(指數-10)
  vec4 o = vec4(clamp(F, 0.0, 1.0), hI, wI, bI);
  float h = hash12(uv * 1931.7 + fract(uT * 0.37) * 100.0);
  vec4 u4 = vec4(h, fract(h * 7.31 + 0.17), fract(h * 3.17 + 0.43), fract(h * 5.53 + 0.71));
  vec4 stepQ = uDither > 0.003 ? vec4(1.0 / 255.0) : exp2(floor(log2(max(o, vec4(6.1e-5)))) - 10.0);
  gl_FragColor = (floor(o / stepQ + u4) + 0.25) * stepQ;
}`;
// 膠囊（手指擦過的一段、水珠、水痕）：乘進場裡
const VS_CAP = `
attribute vec2 aPos; attribute vec4 aSeg; attribute vec4 aK; attribute float aR;
uniform vec2 uRes;
varying vec2 vP; varying vec4 vSeg; varying vec4 vK; varying float vR;
void main(){ vP = aPos; vSeg = aSeg; vK = aK; vR = aR; gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0, 0.0, 1.0); }`;
const FS_CAP = `
precision highp float;
varying vec2 vP; varying vec4 vSeg; varying vec4 vK; varying float vR;
uniform float uAdd;
void main(){
  vec2 d = vSeg.zw - vSeg.xy; float L2 = dot(d, d);
  float u = L2 > 0.0 ? clamp(dot(vP - vSeg.xy, d) / L2, 0.0, 1.0) : 0.0;
  float q = length(vP - vSeg.xy - d * u) / vR;
  float w = 1.0 - smoothstep(0.5, 1.0, q);
  float bump = vK.w * sqrt(max(0.0, 1.0 - q * q));
  if (uAdd > 0.5) { gl_FragColor = vec4(w * vK.x, w * vK.y, w * vK.z, bump); return; }   // 加法模式（開場的遮罩：重疊的膠囊只算一次）
  gl_FragColor = vec4(1.0 - w * vK.x, 1.0 - w * vK.y, 1.0 - w * vK.z, 1.0 - bump);
}`;
// 由場算出法向量（霧厚度的斜坡＋水珠；RG）、邊緣（筆畫邊緊實的霧界：那裡聚水珠；B）、水珠高度（A；合成時折射放大、流下來的水珠的反光用）
// 合成要用的都放在這張 8 位元貼圖裡，合成就不必再讀半精度的場
const FS_DERIVE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uField; uniform vec2 uTexel;
float H(vec2 uv, out float F){ vec4 c = texture2D(uField, uv); F = c.r; return F * 0.3 + (1.0 - c.a) * 2.4; }
void main(){
  float Fl, Fr, Fu, Fd;
  vec4 c0 = texture2D(uField, vUv); float F0 = c0.r;
  float hl = H(vUv - vec2(uTexel.x, 0.0), Fl), hr = H(vUv + vec2(uTexel.x, 0.0), Fr), hd = H(vUv - vec2(0.0, uTexel.y), Fd), hu = H(vUv + vec2(0.0, uTexel.y), Fu);
  vec2 g = vec2(Fr - Fl, Fu - Fd);
  float edge = smoothstep(0.07, 0.3, length(g)) * smoothstep(0.03, 0.14, F0) * smoothstep(0.98, 0.7, F0);
  vec2 n = vec2(hr - hl, hu - hd);
  gl_FragColor = vec4(clamp(n * 1.5 + 0.5, 0.0, 1.0), edge, 1.0 - c0.a);
}`;
// 哪些地方有筆畫邊緣（水珠只畫在這些 32 像素的格子裡）：每格取周圍 8×8 個場的格子（含 2 格邊）的邊緣最大值
const FS_TILE = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uDer; uniform vec2 uTexel, uTileScale;
void main(){
  vec2 c = vUv * uTileScale; float m = 0.0;
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) m = max(m, texture2D(uDer, c + (vec2(float(i), float(j)) * 2.0 - 7.0) * uTexel).b);
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}`;
// 筆畫邊緣的水珠：另外一個 pass，只畫有邊緣的格子（WebGL2：每個格子一個 instance，沒邊緣的格子在頂點著色器裡丟掉；
// WebGL1：整張畫，沒邊緣的像素馬上 discard）。合成的著色器因此不用背著水珠的程式碼（它會拖慢每一個像素）
const VS_BEADS = `
attribute vec2 aPos; attribute float aTile;
uniform sampler2D uTile; uniform vec2 uTiles, uTileUv;
varying vec2 vUv;
void main(){
  float ty = floor((aTile + 0.5) / uTiles.x), tx = aTile - ty * uTiles.x;
  float m = texture2D(uTile, (vec2(tx, ty) + 0.5) / uTiles).r;
  vUv = (vec2(tx, ty) + aPos) * uTileUv;
  gl_Position = m > 0.002 ? vec4(vUv * 2.0 - 1.0, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FS_BEADS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene, uDer, uFogI, uRand, uTile;
uniform vec2 uRes, uTileScale, uRandOff; uniform float uTileChk; uniform vec3 uGrade;
// 一層水珠：格子大小 cs，每格依機率放一顆（有沒有、位置、大小是這格的四個亂數 rn；大小看珠心那裡的邊緣值）；回傳覆蓋率，
// 並給出折射位移（小透鏡：倒立縮小的景）、高光（光從左上來）、下緣透進來的亮、上緣的暗邊、外圈一道細暗邊（像玻璃珠）
float beads(vec2 px, float cs, vec2 cell, vec4 rn, float prob, float rmax, float ec0, out vec2 rf, out float sp, out float rim, out float sh, out float ring){
  rf = vec2(0.0); sp = 0.0; rim = 0.0; sh = 0.0; ring = 0.0;
  if (rn.x > prob) return 0.0;
  vec2 ctr = (cell + 0.5 + (rn.yz - 0.5) * 0.8) * cs;
  float ec = ec0 >= 0.0 ? ec0 : texture2D(uDer, ctr / uRes).b;   // ec0 < 0：到珠心去查（大顆的）；小顆的用這個像素的邊緣值（不用等亂數算完才能讀）
  float rad = cs * (0.2 + rmax * rn.w) * smoothstep(0.04, 0.4, ec);
  vec2 dv = (px - ctr) / max(rad, 0.001); float dd = dot(dv, dv);
  if (dd >= 1.0) return 0.0;
  float z = sqrt(1.0 - dd);
  vec3 N = normalize(vec3(dv, z * 1.4));
  rf = -dv * rad * 0.85 + N.xy * 5.0;
  vec3 L = normalize(vec3(-0.4, 0.72, 0.56));
  float ndl = max(dot(N, L), 0.0);
  sp = pow(ndl, 48.0) + 0.25 * pow(ndl, 8.0);
  vec2 dn = dv / max(sqrt(dd), 0.001);
  rim = pow(1.0 - z, 2.5) * (0.5 + 0.5 * dot(dn, vec2(0.35, -0.9)));
  sh = smoothstep(0.3, 0.95, dd) * (0.5 + 0.5 * dot(dn, vec2(-0.35, 0.9)));
  ring = smoothstep(0.62, 1.0, dd);
  return smoothstep(0.0, min(1.0, 2.0 / max(rad, 1.0)), 1.0 - dd);
}
void main(){
  vec2 uv = vUv;
  if (uTileChk > 0.5 && texture2D(uTile, uv / uTileScale).r < 0.002) discard;   // 整張畫（WebGL1）時：沒邊緣的格子馬上丟掉
  vec2 px = uv * uRes;
  // 小顆的格子是大顆的一半：一次取樣就有兩層的亂數（每個 8 位元的高 4 位元是小顆的、低 4 位元是它所在的大格子的）
  float cs = uRes.y / 120.0; vec2 cell = floor(px / cs);
  float ep = texture2D(uDer, uv).b;
  vec4 rb = floor(texture2D(uRand, (cell + 0.5 + uRandOff) / 128.0) * 255.0 + 0.5);
  vec4 hi = floor(rb / 16.0), lo = rb - hi * 16.0;
  vec2 r1, r2; float s1, s2, m1, m2, h1, h2, g1, g2;
  float c1 = ep > 0.02 ? beads(px, cs, cell, hi / 15.0, 0.85, 0.32, ep, r1, s1, m1, h1, g1) : 0.0;
  float c2 = beads(px, cs * 2.0, floor(cell * 0.5), lo / 15.0, 0.26, 0.26, -1.0, r2, s2, m2, h2, g2);
  float cov = max(c1, c2);
  if (cov < 0.004) discard;
  float t = step(0.001, c2);
  vec2 rf = mix(r1, r2, t); float spec = mix(s1, s2, t), rim = mix(m1, m2, t), shade = mix(h1, h2, t), ring = mix(g1, g2, t), lensK = mix(0.42, 0.62, t);
  vec3 crisp = texture2D(uScene, clamp(uv + rf / uRes, 0.001, 0.999), -1.0).rgb;
  vec3 fogc = texture2D(uFogI, uv).rgb;
  // 小透鏡把周圍的光聚起來（比霧亮一點、帶一點倒立的清楚景）、下緣一圈暗邊、上緣反光、一點高光
  vec3 col = mix(fogc * 1.08 + 0.03, crisp * 1.15, lensK);
  col *= 1.0 - (0.38 * shade + 0.3 * ring);
  col += (spec * 1.2 * (1.0 - col * 0.4) + rim * 0.38) * vec3(0.92, 0.96, 1.0);
  // 和合成一樣的調色，水珠才融得進去
  float L2 = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(vec3(L2), col, uGrade.x);
  col = (col - 0.5) * uGrade.y + 0.5 + uGrade.z;
  vec2 vc = uv - 0.5; vc.y *= uv.y < 0.5 ? 0.5 : 1.0; col *= 1.0 - dot(vc, vc) * 0.5;
  col = col / (1.0 + col * 0.1);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), cov);
}`;
// 霧裡的景（1/4 解析度）：失焦、退色、帶一點藍灰，加上燈把霧照亮的寬光暈、室內暖光、散景光斑；alpha 放光暈亮度
// mip 的偏移要扣掉 log2(全解析度/場的解析度)：這個 pass 的像素比較大，內建的 LOD 本來就高
const FS_FOGI = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene, uField, uBokeh, uNoise, uNoise4;
uniform float uLod0, uBokehK, uLift, uT, uGrain, uSeed; uniform vec2 uRes; uniform vec3 uFogTint, uWarm; uniform vec4 uRefl;
void main(){
  vec2 uv = vUv;
  float F = texture2D(uField, uv).r;
  float lod = 3.2 + 2.6 * F - uLod0;
  vec3 soft = texture2D(uScene, uv, lod).rgb;
  if (uRefl.y > 0.0 && uv.y < uRefl.x) {   // 濕的路面：上面的景倒映下來（雨打出的漣漪讓它晃、離路面越遠越淡）
    float dd = uRefl.x - uv.y;
    float rp = (texture2D(uNoise, vec2(uv.x * 1.7 + uT * 0.004, uv.y * 9.0 - uT * 0.045)).g - 0.5) * uRefl.z * (0.3 + dd * 3.0);
    vec3 refl = texture2D(uScene, vec2(uv.x, uRefl.x + dd * 1.04 + rp), lod + 0.5).rgb;
    soft = mix(soft, refl * vec3(0.8, 0.85, 0.95), uRefl.y * (1.0 - smoothstep(0.0, uRefl.w, dd)));
  }
  vec3 glow = texture2D(uScene, uv, 7.0 - uLod0).rgb;
  float lum = dot(soft, vec3(0.3, 0.59, 0.11)), glum = dot(glow, vec3(0.3, 0.59, 0.11));
  vec3 fogc = mix(vec3(lum), soft, 0.55) * 0.78 + (uFogTint * (0.14 + 0.45 * glum) + glow * 0.4) * uLift;
  float tw = pow(max(0.0, 1.0 - length(uv * vec2(1.1, 1.5))), 2.0);
  fogc += uWarm * tw * 0.3 * uLift;
  fogc += texture2D(uBokeh, uv).rgb * uBokehK;
  // 水氣的大顆粒（16 像素左右的斑）：兩次取樣（不同尺度、轉了個角度）疊起來，256 像素的雜訊圖才不會看得出在重複；細顆粒在合成裡加
  vec2 pxf = uv * uRes;
  float bl = 0.5 * (texture2D(uNoise4, pxf / 256.0 + uSeed).g + texture2D(uNoise4, vec2(pxf.x * 0.8253 - pxf.y * 0.5646, pxf.x * 0.5646 + pxf.y * 0.8253) / 331.0 - uSeed).g);
  float gk = 1.0 - 0.6 * smoothstep(0.25, 0.7, dot(fogc, vec3(0.3, 0.59, 0.11)));   // 亮的光暈裡顆粒少一點
  fogc *= 1.0 + (bl - 0.5) * 0.048 * gk;
  gl_FragColor = vec4(clamp(fogc, 0.0, 1.0), clamp(F + (bl - 0.5) * 0.064 * uGrain, 0.0, 1.0));   // alpha 帶著霧濃度（含大顆粒的起伏）給合成用
}`;
// 合成：清楚的景（折射）、霧裡的景（上一個 pass）＋顆粒、流下來的水珠的反光、調色。只讀 8 位元的貼圖：法向量／邊緣／水珠高度（uDer）、
// 霧裡的景＋霧濃度（uFogI）、景、雜訊；筆畫邊緣的水珠在後面另一個 pass 畫（見 FS_BEADS）
const FS_COMP = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene, uDer, uFogI, uNoise;
uniform vec2 uRes; uniform float uT, uGrain, uThumb, uSeed, uReflC;
uniform vec4 uRing, uRefl; uniform vec3 uGrade;
void main(){
  vec2 uv = vUv; vec2 px = uv * uRes;
  vec4 der = texture2D(uDer, uv);
  vec4 fi = texture2D(uFogI, uv); vec3 fogc = fi.rgb; float F = fi.a;
  float bump = der.a;
  vec2 n = (der.rg - 0.5) / 1.5;
  // 水氣的細顆粒（凝結的小水珠；轉了個角度取樣，256 像素的重複才不會和螢幕的行列對齊）+ 偶爾一點反光；大顆粒已經在霧裡的景那個 pass 加好了
  vec4 nz = texture2D(uNoise, vec2(px.x * 0.9394 - px.y * 0.3429, px.x * 0.3429 + px.y * 0.9394) / 256.0 + uSeed);
  float grain = nz.r;
  float spk = nz.b * (0.5 + 0.5 * sin(uT * 2.0 + nz.a * 40.0)) * (1.0 - uThumb);
  float mask = smoothstep(0.04, 0.36, F + (grain - 0.5) * 0.096 * uGrain);
  // 折射：霧厚度的斜坡＋流下來的水珠
  vec2 refr = n * uRes.y * 0.02 * (1.0 + bump * 4.0);
  vec2 ruv = clamp(uv + refr / uRes, 0.001, 0.999);
  vec3 crisp = texture2D(uScene, ruv, -1.0).rgb;   // 永遠取最細的那層 mip
  if (uReflC > 0.0 && ruv.y < uRefl.x) {   // 濕的路面：柔柔的、一條一條的倒影（濕的柏油不是鏡子：水多的地方才照得清楚；漣漪會動）
    float dd = uRefl.x - ruv.y;
    float rp = (texture2D(uNoise, vec2(ruv.x * 1.7 + uT * 0.004, ruv.y * 9.0 - uT * 0.045)).g - 0.5) * uRefl.z * (0.3 + dd * 3.0);
    float pm = smoothstep(0.3, 0.7, texture2D(uNoise, vec2(ruv.x * 3.0 + uSeed, ruv.y * 0.5)).g);
    vec3 refl = texture2D(uScene, vec2(ruv.x, uRefl.x + dd * 1.04 + rp), 1.8).rgb;
    crisp = mix(crisp, refl * vec3(0.8, 0.85, 0.95), uReflC * (0.45 + 0.55 * pm) * (1.0 - smoothstep(0.0, uRefl.w, dd)));
  }
  float gk = 1.0 - 0.6 * smoothstep(0.25, 0.7, dot(fogc, vec3(0.3, 0.59, 0.11)));   // 亮的光暈裡顆粒少一點
  fogc *= 1.0 + (grain - 0.5) * 0.072 * gk;
  fogc += spk * 0.07 * gk;
  vec3 col = mix(crisp, fogc, mask);
  // 流下來的水珠：高光（只有水珠的地方才算）
  if (bump > 0.02) {
    vec3 Nn = normalize(vec3(-n * 3.0, 1.0));
    vec3 Hv = normalize(vec3(-0.45, -0.75, 1.55));
    float sp2 = pow(max(dot(Nn, Hv), 0.0), 50.0) * smoothstep(0.02, 0.2, bump);
    col += sp2 * 0.9 * vec3(0.92, 0.96, 1.0);
  }
  // 調色：飽和、對比、暗角（下緣只暗一點：桌面底下的工作列旁邊不要一片黑）、柔和的高光壓縮
  float L2 = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(vec3(L2), col, uGrade.x);
  col = (col - 0.5) * uGrade.y + 0.5 + uGrade.z;
  vec2 vc = uv - 0.5; vc.y *= uv.y < 0.5 ? 0.5 : 1.0; col *= 1.0 - dot(vc, vc) * 0.5;
  col = col / (1.0 + col * 0.1);
  if (uRing.w > 0.0) { float dr = abs(length(px - uRing.xy) - uRing.z); col += smoothstep(2.2, 0.0, dr) * uRing.w * 0.6; }
  col += (nz.a - 0.5) * 0.01;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/* ════════════ 窗外的景 ════════════ */
// 共用：k = 畫面尺度（1440p 的高度 = 1）；s.sb 靜態批次；s.lights 燈（霧裡會變成光斑）：{x, y, c, I, R, fl（會閃）, ph}
// pulse = false：亮度不呼吸（月亮、天光；路燈和窗燈才微微起伏）
function addLight(s, x, y, c, I, R, fl, pulse) { s.lights.push({ x, y, c, I, R, fl: fl || 0, ph: rnd(TAU), pulse: pulse !== false }); }
function skyBands(b, stops, x, y0, w, h) { for (let i = 0; i < stops.length - 1; i++) { const a = stops[i], c = stops[i + 1]; b.vrect(x, y0 + h * a[0], w, h * (c[0] - a[0]) + 1, hexC(a[1]), 1, hexC(c[1]), 1); } }
// 窗戶的顏色（暖色為主，偶爾冷色、偶爾粉紅）
const WIN_C = ['#ffc46e', '#ffd494', '#faaa5c', '#ffe4b0', '#ffba78', '#a8ccff', '#c8e2ff', '#ff96ac'].map(hexC);
const WIN_W = [5, 4, 3, 2, 3, 1.4, 1, 0.5];
function pickW() { let r = Math.random() * 19.9; for (let k = 0; k < WIN_W.length; k++) { r -= WIN_W[k]; if (r <= 0) return WIN_C[k]; } return WIN_C[0]; }
// 一棟樓的窗戶格子：畫在靜態批次上；lit 的機率；回傳窗戶清單（給開關燈的、散景用）
function windows(s, x, y, w, h, cell, ww, wh, lit, warm, bodyC) {
  const b = s.sb, out = [];
  const cols = Math.floor((w - cell * 0.4) / cell), rows = Math.floor((h - cell * 0.6) / (cell * 0.95));
  if (cols < 1 || rows < 1) return out;
  const ox = x + (w - cols * cell) / 2 + (cell - ww) / 2, oy = y + cell * 0.5;
  const dark = mulC(bodyC, 0.7);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = ox + c * cell, wy = oy + r * cell * 0.95;
    const on = Math.random() < lit, col = warm ? pickW() : WIN_C[5 + rint(0, 2)], br = rnd(0.55, 1);
    const cb = mulC(col, br);
    out.push({ x: wx, y: wy, w: ww, h: wh, c: col, cb, on, br });
    if (on) b.rect(wx, wy, ww, wh, cb, 1, 4); else b.rect(wx, wy, ww, wh, dark, 1);
  }
  return out;
}

/* ──────── 城市夜景 ──────── */
function buildCity(s, f) {
  const W = s.W, H = s.H, k = s.k, b = s.sb;
  const yS = s.yS = Math.round(H * 0.72);
  skyBands(b, [[0, '#04060f'], [0.3, '#0a1032'], [0.58, '#261d52'], [0.78, '#53305f'], [0.92, '#8c4a64'], [1, '#c47c78']], 0, 0, W, yS);
  b.rect(0, yS - 1, W, H - yS + 1, hexC('#0a0b14'), 1);
  // 星星：越高越多；一部分會閃
  const nS = Math.round(240 * Math.sqrt(W * H / (2560 * 1440)));
  s.dyn.stars = [];
  for (let i = 0; i < nS; i++) {
    const x = rnd(W), y = Math.pow(Math.random(), 1.6) * yS * 0.62, sz = (1 + Math.random() * 1.7) * k, a = 0.3 + Math.random() * 0.6;
    const c = pick([[0.78, 0.82, 1], [0.95, 0.95, 1], [1, 0.92, 0.82], [0.72, 0.8, 1]]);
    if (Math.hypot(x - W * 0.76, y - H * 0.15) < H * 0.11) continue;
    if (i % 6 === 0) s.dyn.stars.push({ x, y, sz, a, c, ph: rnd(TAU), sp: rnd(0.8, 2.2) }); else b.disc(x, y, sz * 1.7, sz * 1.7, c, a, 5);
  }
  // 月亮和月暈
  const mx = W * 0.76, my = H * 0.15, mR = H * 0.042;
  b.blend(1); b.disc(mx, my, mR * 5.5, mR * 5.5, hexC('#5e5a9c'), 0.26, 2); b.disc(mx, my, mR * 2.2, mR * 2.2, hexC('#9a90b8'), 0.22, 2); b.blend(0);
  b.disc(mx, my, mR, mR, hexC('#f8f1dc'), 1, 8);
  for (let i = 0; i < 7; i++) { const a = rnd(TAU), d = rnd(0.15, 0.7) * mR, r = rnd(0.08, 0.2) * mR; b.disc(mx + Math.cos(a) * d, my + Math.sin(a) * d, r, r, hexC('#d9d0b8'), 0.55, 1); }
  addLight(s, mx, my, hexC('#ece6cc'), 0.4, mR * 2.1, 0, false);
  // 地平線上的城市光暈
  b.blend(1); b.vrect(0, yS - H * 0.17, W, H * 0.17, hexC('#c2607c'), 0, hexC('#c2607c'), 0.26); b.blend(0);
  // 遠處的大樓（偏紫的剪影、稀疏的暗窗）
  for (let x = -rnd(0, 40) * k; x < W;) {
    const w = rnd(26, 110) * k, h = H * rnd(0.07, 0.3), top = yS - h, c = mixC(hexC('#2b2449'), hexC('#3c2f5e'), Math.random());
    b.vrect(x, top, w, h + 2, c, 1, mixC(c, hexC('#4a3a5a'), 0.5), 1);
    if (Math.random() < 0.4) { const w2 = w * rnd(0.3, 0.6), h2 = H * rnd(0.015, 0.05); b.rect(x + (w - w2) / 2, top - h2, w2, h2 + 1, c, 1); }
    const n = Math.floor(w * h / (260 * k * k));
    for (let i = 0; i < n; i++) if (Math.random() < 0.35) { const col = pickW(); b.rect(x + rnd(2, w - 4), top + rnd(4, h - 4), 2 * k, 1.6 * k, mulC(col, 0.55), 0.8); }
    x += w + rnd(-6, 10) * k;
  }
  // 近處的大樓：窗戶格子，一部分窗戶之後會開關燈
  s.dyn.tog = []; const cand = [];
  const towers = [];
  for (let x = -rnd(10, 60) * k; x < W;) {
    const tall = Math.random() < 0.18 && Math.abs(x - mx) > H * 0.2;
    const w = rnd(tall ? 90 : 110, tall ? 170 : 330) * k, h = H * (tall ? rnd(0.5, 0.64) : rnd(0.17, 0.46)), top = yS - h;
    const body = mixC(hexC('#13162a'), hexC('#1a1b2e'), Math.random());
    b.rect(x, top, w, h + 2, body, 1);
    b.rect(x, top, w, 2.2 * k, mixC(body, [1, 1, 1], 0.14), 1);
    b.rect(x + w - 2.5 * k, top, 2.5 * k, h, mixC(body, [0.5, 0.55, 0.8], 0.12), 1);
    const style = rint(0, 3), cell = [15, 18, 13, 16][style] * k, ww = [8, 11, 7, 14][style] * k, wh = [6.5, 7, 9, 5][style] * k;
    if (style === 3) for (let fy = top + 8 * k; fy < yS; fy += cell * 0.95) b.rect(x, fy, w, 1.5 * k, mixC(body, [1, 1, 1], 0.08), 1);
    const ws = windows(s, x + 4 * k, top + 8 * k, w - 8 * k, h - 14 * k, cell, ww, wh, rnd(0.32, 0.6), Math.random() < 0.8, body);
    for (const o of ws) { if (o.on && Math.random() < 0.045) addLight(s, o.x + o.w / 2, o.y + o.h / 2, o.c, 0.14, H * 0.021, 0); if (Math.random() < 0.08) cand.push(o); }
    if (tall) towers.push({ x: x + w / 2, top });
    else if (Math.random() < 0.35 && w > 60 * k) { const tx = x + rnd(10, w - 30) * k, tw = 18 * k; b.rect(tx, top - 14 * k, tw, 14 * k, hexC('#2a2430'), 1); b.rect(tx - 2 * k, top - 16 * k, tw + 4 * k, 3 * k, hexC('#332a36'), 1); }
    x += w + rnd(0, 12) * k;
  }
  // 開關燈的窗：靜態圖上一律畫成暗的，亮的時候每格另外畫
  for (const o of cand.slice(0, s.thumb ? 24 : 110)) { b.rect(o.x, o.y, o.w, o.h, hexC('#101222'), 1); s.dyn.tog.push({ o, on: Math.random() < 0.45, t: rnd(2, 30) }); }
  // 高樓的天線和航空燈
  s.dyn.ant = [];
  for (const t of towers) { b.rect(t.x - 1.2 * k, t.top - 60 * k, 2.4 * k, 60 * k, hexC('#2a2a3c'), 1); s.dyn.ant.push({ x: t.x, y: t.top - 62 * k, ph: rnd(TAU) }); }
  // 街道：路面、人行道、路燈、霓虹
  const yRoad = yS + H * 0.1;
  b.vrect(0, yS, W, H * 0.1, hexC('#121321'), 1, hexC('#0d0e18'), 1);
  b.rect(0, yRoad - 2 * k, W, 2 * k, hexC('#2a2b3a'), 1);
  b.vrect(0, yRoad, W, H - yRoad, hexC('#161826'), 1, hexC('#0d0e16'), 1);
  for (let y = yS + 9 * k; y < yRoad - 3 * k; y += 9 * k) b.rect(0, y, W, 1 * k, hexC('#0a0b12'), 0.45);                  // 人行道的磚縫
  for (let x = rnd(0, 40) * k; x < W; x += 40 * k) b.rect(x, yS, 1 * k, yRoad - yS, hexC('#0a0b12'), 0.3);
  for (let x = rnd(0, 26) * k; x < W; x += 26 * k) b.rect(x, yRoad - 13 * k, 2 * k, 13 * k, hexC('#1a1b27'), 1);           // 路邊的欄杆
  b.rect(0, yRoad - 13 * k, W, 1.6 * k, hexC('#262838'), 1); b.rect(0, yRoad - 7 * k, W, 1.2 * k, hexC('#20222f'), 1);
  let li = 0;
  for (let x = W * 0.06; x < W; x += W * 0.19, li++) {
    const yL = yS + H * 0.035;
    if (li % 2 === 0) for (let i = 0; i < 7; i++) b.rect(x - 70 * k + i * 20 * k, yRoad + 8 * k, 10 * k, H - yRoad - 16 * k, hexC('#3c3e50'), 0.42);   // 斑馬線
    b.rect(x - 1.4 * k, yL, 2.8 * k, H * 0.07, hexC('#1c1d2a'), 1);
    b.blend(1); b.disc(x, yL, H * 0.085, H * 0.085, hexC('#ffbe78'), 0.28, 2); b.disc(x, yRoad + H * 0.03, H * 0.1, H * 0.02, hexC('#ffbe78'), 0.3, 1); b.disc(x, yRoad + H * 0.06, H * 0.17, H * 0.05, hexC('#ffbe78'), 0.1, 1); b.blend(0);   // 路燈照亮的柏油
    b.disc(x, yL, 4.5 * k, 3.5 * k, hexC('#ffe8bf'), 1, 8);
    b.blend(1); b.quad4(x - 9 * k, yRoad, x + 9 * k, yRoad, x + 18 * k, yRoad + H * 0.13, x - 18 * k, yRoad + H * 0.13, hexC('#ffbe78'), 0.16, hexC('#ffbe78'), 0.16, hexC('#ffbe78'), 0, hexC('#ffbe78'), 0, 11); b.blend(0);
    addLight(s, x, yL, hexC('#ffd6a0'), 0.55, H * 0.046, 0);
  }
  const NEON = ['#ff5fa8', '#52e6ff', '#7dff8a', '#ffa347', '#c982ff'].map(hexC);
  for (let i = 0; i < 5; i++) {
    const x = W * (0.08 + i * 0.2) + rnd(-0.05, 0.05) * W, y = yS - H * rnd(0.03, 0.11), w = rnd(26, 70) * k, h = rnd(7, 14) * k, c = NEON[i % NEON.length], vert = Math.random() < 0.3;
    const rw = vert ? h : w, rh = vert ? w : h;
    b.blend(1); b.disc(x + rw / 2, y + rh / 2, rw * 1.3, rh * 2.6, c, 0.35, 2); b.blend(0);
    b.rect(x, y, rw, rh, mulC(c, 0.55), 1); b.rect(x + 2 * k, y + 2 * k, rw - 4 * k, rh - 4 * k, mixC(c, [1, 1, 1], 0.45), 1);
    addLight(s, x + rw / 2, y + rh / 2, c, 0.45, H * 0.032, 1);
  }
  // 車道線、人行道上的樹、公車亭
  for (let x = 0; x < W; x += W * 0.07) b.rect(x, yRoad + H * 0.065, W * 0.03, 2.5 * k, hexC('#4a4c62'), 0.9);
  b.rect(0, yRoad + H * 0.125, W, 1.6 * k, hexC('#3a3c4e'), 0.7);                                                              // 路邊的白線
  for (let i = 0; i < 4; i++) {   // 停在路邊的車（剪影、車頂一道反光、尾燈一點紅）
    const cw = rnd(66, 90) * k, cx = W * (0.05 + i * 0.26) + rnd(0, W * 0.12), cy = yRoad + H * 0.135, chh = 19 * k;
    b.rect(cx, cy, cw, chh, hexC('#0c0d15'), 1); b.rect(cx + cw * 0.18, cy - 11 * k, cw * 0.56, 11 * k, hexC('#0e0f18'), 1);
    b.rect(cx + cw * 0.2, cy - 11 * k, cw * 0.52, 1.4 * k, hexC('#363a4c'), 0.9); b.rect(cx + cw * 0.22, cy - 9 * k, cw * 0.48, 6 * k, hexC('#1b2033'), 0.8);
    b.disc(cx + cw * 0.22, cy + chh, 7 * k, 5 * k, hexC('#07080d'), 1, 1); b.disc(cx + cw * 0.78, cy + chh, 7 * k, 5 * k, hexC('#07080d'), 1, 1);
    b.disc(cx + cw - 3 * k, cy + 6 * k, 3 * k, 2 * k, hexC('#ff6a5a'), 0.55, 1); b.disc(cx + 3 * k, cy + 6 * k, 3 * k, 2 * k, hexC('#ffd9a8'), 0.35, 1);
  }
  for (let x = W * 0.14; x < W; x += W * 0.21) { const ty = yS + H * 0.095, th = H * 0.075; b.rect(x - 2 * k, ty - th * 0.5, 4 * k, th * 0.5, hexC('#0c0d16'), 1); b.disc(x, ty - th * 0.7, H * 0.045, H * 0.04, hexC('#0d1020'), 1, 1); b.disc(x - H * 0.02, ty - th * 0.6, H * 0.03, H * 0.026, hexC('#0e1122'), 1, 1); }
  { const bx = W * 0.58, by = yS + H * 0.06; b.rect(bx - 2 * k, by, 3 * k, H * 0.04, hexC('#1a1b28'), 1); b.rect(bx + 62 * k, by, 3 * k, H * 0.04, hexC('#1a1b28'), 1); b.rect(bx - 6 * k, by - 3 * k, 72 * k, 4 * k, hexC('#20212e'), 1); b.rect(bx + 40 * k, by + 4 * k, 20 * k, H * 0.03, hexC('#bcd6ff'), 1, 4); b.blend(1); b.disc(bx + 50 * k, by + H * 0.02, H * 0.05, H * 0.04, hexC('#8fb8ff'), 0.25, 2); b.blend(0); addLight(s, bx + 50 * k, by + H * 0.018, hexC('#bcd6ff'), 0.3, H * 0.03, 0); }
  s.dyn.cars = []; s.dyn.carT = rnd(1, 3); s.yRoad = yRoad;
  s.dyn.plane = null; s.dyn.planeT = rnd(15, 40);
  s.refl = [1 - yRoad / H, 0.32, 0.012, 0.2, 0.45];   // 馬路：淡淡的倒影（擦開的地方路燈下照得比較清楚）
}
function dynCity(s, f, db, gb, bk) {
  const W = s.W, H = s.H, k = s.k, dt = f.dt, t = f.t, d = s.dyn;
  for (const st of d.stars) { const a = st.a * (0.55 + 0.45 * Math.sin(t * st.sp + st.ph)); gb.disc(st.x, st.y, st.sz * 1.7, st.sz * 1.7, st.c, a, 5); }
  for (const tg of d.tog) {
    tg.t -= dt; if (tg.t <= 0) { tg.t = rnd(6, 40); if (Math.random() < 0.6) tg.on = !tg.on; }
    if (tg.on) { const o = tg.o; db.rect(o.x, o.y, o.w, o.h, o.cb, 1, 4); bk.disc(o.x + o.w / 2, o.y + o.h / 2, H * 0.02, H * 0.02, o.c, 0.16, 3); }
  }
  for (const a of d.ant) { const on = Math.sin(t * 2.6 + a.ph) > 0.35 ? 1 : 0.08; gb.disc(a.x, a.y, 5 * k, 5 * k, C_RED, on * 0.9, 5); gb.disc(a.x, a.y, 16 * k, 16 * k, C_RED, on * 0.25, 2); bk.disc(a.x, a.y, 11 * k, 11 * k, C_RED2, on * 0.4, 3); }
  // 車燈：來車白、去車紅，拖著光尾
  d.carT -= dt;
  if (d.carT <= 0 && d.cars.length < 5) { d.carT = rnd(3, 9); const dir = Math.random() < 0.5 ? 1 : -1; d.cars.push({ x: dir > 0 ? -W * 0.05 : W * 1.05, y: s.yRoad + H * (dir > 0 ? 0.045 : 0.085) + rnd(-0.006, 0.006) * H, v: dir * W * rnd(0.16, 0.26), dir }); }
  for (let i = d.cars.length - 1; i >= 0; i--) {
    const c = d.cars[i]; c.x += c.v * dt; if (c.x < -W * 0.1 || c.x > W * 1.1) { d.cars.splice(i, 1); continue; }
    const white = c.dir > 0, col = white ? C_HEAD : C_TAIL, gap = 9 * k, r = white ? 3.6 * k : 3 * k;
    for (let q = -1; q <= 1; q += 2) { const o = q * gap; gb.disc(c.x + o, c.y, r * 1.6, r * 1.6, col, 0.95, 5); gb.disc(c.x + o, c.y, r * 5, r * 5, col, 0.25, 2); }
    const len = Math.abs(c.v) * 0.22;
    if (white) gb.quad4(c.x, c.y - 3 * k, c.x - len, c.y - 5 * k, c.x - len, c.y + 5 * k, c.x, c.y + 3 * k, col, 0.3, col, 0, col, 0, col, 0.3, 6);
    else gb.quad4(c.x, c.y - 2 * k, c.x + len * 0.6, c.y - 3 * k, c.x + len * 0.6, c.y + 3 * k, c.x, c.y + 2 * k, col, 0.3, col, 0, col, 0, col, 0.3, 6);
    bk.disc(c.x, c.y, H * 0.04, H * 0.04, col, white ? 0.45 : 0.35, 3);
  }
  // 偶爾一架飛機慢慢飛過高空（紅燈一閃一閃）
  d.planeT -= dt;
  if (!d.plane && d.planeT <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; d.plane = { x: dir > 0 ? -10 : W + 10, y: H * rnd(0.05, 0.3), v: dir * W * 0.025 }; d.planeT = rnd(40, 90); }
  if (d.plane) { const p = d.plane; p.x += p.v * dt; if (p.x < -20 || p.x > W + 20) d.plane = null; else { const bl = (t * 1.5) % 1 < 0.12 ? 1 : 0; gb.disc(p.x, p.y, 2.2 * k, 2.2 * k, C_PLANE, 0.6, 5); gb.disc(p.x - 6 * k, p.y, 3 * k, 3 * k, C_RED2, bl * 0.9, 5); gb.disc(p.x + 6 * k, p.y, 2.5 * k, 2.5 * k, C_GREEN, bl * 0.6, 5); } }
}

/* ──────── 雪地清晨 ──────── */
// 松樹：一層層的三角形（下面寬、上面窄），每層上緣有雪
function pine(b, x, yb, h, c, snow) {
  const w = h * 0.36, dark = mulC(c, 0.8);
  b.rect(x - h * 0.025, yb - h * 0.12, h * 0.05, h * 0.14, hexC('#2b2019'), 1);
  for (let i = 0; i < 6; i++) {
    const u = i / 6, ty = yb - h * (0.1 + 0.9 * u), hh = h * 0.3 * (1 - u * 0.35), ww = w * (1 - u * 0.8) + h * 0.03;
    b.tri(x - ww, ty, x + ww, ty, x + ww * 0.08, ty - hh, i % 2 ? c : dark, 1);
    if (snow) b.tri(x - ww * 0.55, ty - hh * 0.42, x + ww * 0.75, ty - hh * 0.36, x + ww * 0.06, ty - hh * 0.95, snow, 0.9);
  }
}
function ridge(b, W, yBase, amp, off, seed, cTop, cBot, step) {
  for (let x = 0; x < W; x += step) {
    const y0 = yBase - amp * (0.5 + 0.5 * fbm1(x / W * 3.1 + seed, seed, 4)) - off, y1 = yBase - amp * (0.5 + 0.5 * fbm1((x + step) / W * 3.1 + seed, seed, 4)) - off;
    b.quad4(x, y0, x + step + 0.5, y1, x + step + 0.5, yBase + amp, x, yBase + amp, cTop, 1, cTop, 1, cBot, 1, cBot, 1, 0);
  }
}
function buildSnow(s, f) {
  const W = s.W, H = s.H, k = s.k, b = s.sb;
  const yH = s.yH = H * 0.46;
  skyBands(b, [[0, '#1d2650'], [0.28, '#555fa0'], [0.56, '#a58cb8'], [0.8, '#e2a99c'], [1, '#f9d6a8']], 0, 0, W, yH * 1.03);
  b.rect(0, yH, W, H - yH, hexC('#c7cde6'), 1);
  // 地平線下的太陽還沒出來：一大片暖光，細細的雲被照成粉色
  const sx = W * 0.6;
  b.blend(1); b.disc(sx, yH * 1.05, H * 0.5, H * 0.34, hexC('#ffcf98'), 0.5, 2); b.disc(sx, yH * 1.0, H * 0.16, H * 0.1, hexC('#fff0d0'), 0.6, 2);
  for (let i = 0; i < 9; i++) { const cx = rnd(W), cy = yH * rnd(0.3, 0.85), cw = W * rnd(0.08, 0.22), chh = H * rnd(0.006, 0.014); b.disc(cx, cy, cw, chh, mixC(hexC('#f4b8a8'), hexC('#8c7cb0'), (cy / yH - 0.3) * 0.6), 0.35, 1); }
  b.blend(0);
  addLight(s, sx, yH * 0.99, hexC('#ffe2b8'), 0.3, H * 0.14, 0, false);
  // 遠山（山頂帶雪、越遠越淡）、近山、雪地
  ridge(b, W, yH + 2, H * 0.21, 0, 3.7, hexC('#d4d6ec'), hexC('#9298c8'), 2 * k + 1);
  ridge(b, W, yH + H * 0.03, H * 0.12, 0, 9.1, hexC('#9198c6'), hexC('#5f6698'), 2 * k + 1);
  const yG = yH + H * 0.04;
  b.vrect(0, yG, W, H - yG, hexC('#e6eaf6'), 1, hexC('#b3bbd8'), 1);
  for (let i = 0; i < 3; i++) ridge(b, W, yG + H * (0.12 + i * 0.2), H * 0.05, 0, 21 + i * 5, mixC(hexC('#eef1f9'), hexC('#c8cee6'), i / 3), mixC(hexC('#cfd5ea'), hexC('#aeb6d4'), i / 3), 3 * k + 1);
  // 遠處的松林（一排排，越近越深）
  for (let i = 0; i < 70; i++) { const u = Math.random(), x = rnd(-20, W + 20), yb = yG + H * (0.06 + 0.16 * u), h = H * (0.035 + 0.06 * u), c = mixC(hexC('#6b74a4'), hexC('#3d4672'), u); pine(b, x, yb, h, c, mixC(c, hexC('#eef1fa'), 0.7)); }
  // 小木屋：原木牆、厚厚的雪屋頂、兩扇亮著的窗、煙囪
  const cx = W * 0.47, cy = yG + H * 0.36, cw = H * 0.2, ch = H * 0.105;
  b.rect(cx - cw / 2, cy - ch, cw, ch, hexC('#4e3527'), 1);
  for (let y = cy - ch + 7 * k; y < cy; y += 12 * k) b.rect(cx - cw / 2, y, cw, 2.5 * k, hexC('#3a271d'), 0.8);
  b.vrect(cx - cw / 2, cy - ch * 0.35, cw, ch * 0.35, hexC('#2a1c14'), 0, hexC('#2a1c14'), 0.5);
  b.tri(cx - cw * 0.6, cy - ch, cx + cw * 0.6, cy - ch, cx, cy - ch - H * 0.085, hexC('#3b2a24'), 1);
  b.tri(cx - cw * 0.63, cy - ch - 4 * k, cx + cw * 0.63, cy - ch - 4 * k, cx, cy - ch - H * 0.097, hexC('#f1f4fc'), 1);
  b.tri(cx - cw * 0.63, cy - ch - 4 * k, cx + cw * 0.63, cy - ch - 4 * k, cx, cy - ch - H * 0.05, hexC('#dfe4f2'), 0.6);
  b.rect(cx + cw * 0.22, cy - ch - H * 0.11, cw * 0.09, H * 0.05, hexC('#5a4a48'), 1); b.rect(cx + cw * 0.2, cy - ch - H * 0.12, cw * 0.13, H * 0.012, hexC('#eef1fa'), 1);
  const wins = [[cx - cw * 0.34, cy - ch * 0.72, cw * 0.17, ch * 0.4], [cx + cw * 0.14, cy - ch * 0.72, cw * 0.17, ch * 0.4]];
  for (const [wx, wy, ww, wh] of wins) {
    b.blend(1); b.disc(wx + ww / 2, wy + wh / 2, ww * 2.4, wh * 2.4, hexC('#ffbf70'), 0.4, 2); b.disc(wx + ww / 2, cy + ch * 0.25, ww * 2.2, wh * 0.9, hexC('#ffc070'), 0.28, 1); b.blend(0);
    b.rect(wx, wy, ww, wh, hexC('#ffd27a'), 1, 4); b.rect(wx + ww / 2 - 1.2 * k, wy, 2.4 * k, wh, hexC('#5a3a2a'), 1); b.rect(wx, wy + wh / 2 - 1.2 * k, ww, 2.4 * k, hexC('#5a3a2a'), 1);
    b.rect(wx - 2 * k, wy - 4 * k, ww + 4 * k, 4 * k, hexC('#eef1fa'), 1);
    addLight(s, wx + ww / 2, wy + wh / 2, hexC('#ffcf80'), 0.75, H * 0.034, 0);
  }
  b.rect(cx - cw * 0.08, cy - ch * 0.62, cw * 0.14, ch * 0.62, hexC('#2e1f1a'), 1);
  // 門前的小燈、雪地上的腳印
  const lx = cx + cw * 0.74, ly = cy - ch * 0.55;
  b.rect(lx - 1.5 * k, ly, 3 * k, ch * 0.55, hexC('#2a2420'), 1); b.blend(1); b.disc(lx, ly, H * 0.06, H * 0.06, hexC('#ffc78a'), 0.35, 2); b.blend(0); b.disc(lx, ly, 4.5 * k, 5.5 * k, hexC('#fff0c8'), 1, 8);
  addLight(s, lx, ly, hexC('#ffd9a8'), 0.55, H * 0.028, 0);
  for (let i = 0; i < 16; i++) { const u = i / 16; b.disc(cx + cw * 0.05 + (i % 2 ? 6 : -6) * k + u * W * 0.1, cy + 6 * k + u * H * 0.16, 3.2 * k, 2 * k, hexC('#aab2d0'), 0.8, 1); }
  // 小木屋附近的松樹
  for (let i = 0; i < 7; i++) { const side = i % 2 ? 1 : -1, x = cx + side * rnd(cw * 0.9, W * 0.3), yb = yG + H * rnd(0.3, 0.42), h = H * rnd(0.1, 0.18); pine(b, x, yb, h, hexC('#2d3660'), hexC('#e9edf8')); }
  // 兩側最前面的大松樹
  for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1, x = W * 0.5 + side * W * rnd(0.4, 0.52), yb = H * rnd(0.98, 1.08), h = H * rnd(0.3, 0.46); pine(b, x, yb, h, hexC('#1f2846'), hexC('#dfe5f4')); }
  ridge(b, W, H * 1.03, H * 0.05, 0, 44, hexC('#eef1fa'), hexC('#d3d9ec'), 3 * k + 1);
  s.chim = { x: cx + cw * 0.265, y: cy - ch - H * 0.12 };
  // 雪花：三層（遠小慢、近大快）
  const n = s.thumb ? 110 : Math.round(420 * Math.sqrt(W * H / (2560 * 1440)));
  s.dyn.snow = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) { const o = i * 5, z = Math.pow(Math.random(), 1.7); s.dyn.snow[o] = rnd(W); s.dyn.snow[o + 1] = rnd(H); s.dyn.snow[o + 2] = z; s.dyn.snow[o + 3] = rnd(TAU); s.dyn.snow[o + 4] = rnd(0.8, 1.2); }
  s.dyn.puffs = []; s.dyn.puffT = 0;
}
function dynSnow(s, f, db, gb, bk) {
  const W = s.W, H = s.H, k = s.k, dt = f.dt, t = f.t, d = s.dyn, sn = d.snow;
  const wind = Math.sin(t * 0.21) * 24 * k + 10 * k;
  for (let i = 0; i < sn.length; i += 5) {
    const z = sn[i + 2], sp = sn[i + 4];
    sn[i + 1] += (34 + 130 * z) * k * sp * dt; sn[i] += (wind * (0.4 + z) + Math.sin(t * 1.3 + sn[i + 3]) * 18 * k * z) * dt;
    if (sn[i + 1] > H + 10) { sn[i + 1] = -10; sn[i] = rnd(W); } if (sn[i] > W + 10) sn[i] = -10; else if (sn[i] < -10) sn[i] = W + 10;
    const r = (1.3 + 4.2 * z) * k, a = 0.45 + 0.5 * z;
    db.disc(sn[i], sn[i + 1], r * 1.5, r * 1.5, C_FLAKE, a, 1);
    if (z > 0.6) bk.disc(sn[i], sn[i + 1], r * 2.4, r * 2.4, C_FLAKE2, 0.1, 3);
  }
  // 煙囪的煙
  d.puffT -= dt; if (d.puffT <= 0) { d.puffT = rnd(0.35, 0.7); if (d.puffs.length < 26) d.puffs.push({ x: s.chim.x, y: s.chim.y, r: 4 * k, a: 0.3, ph: rnd(TAU) }); }
  for (let i = d.puffs.length - 1; i >= 0; i--) { const p = d.puffs[i]; p.y -= (26 + 10 * Math.sin(p.ph)) * k * dt; p.x += (wind * 0.5 + Math.sin(t + p.ph) * 6 * k) * dt; p.r += 9 * k * dt; p.a -= dt * 0.055; if (p.a <= 0) { d.puffs.splice(i, 1); continue; } db.disc(p.x, p.y, p.r, p.r, C_SMOKE, p.a, 1); }
}

/* ──────── 雨夜街角 ──────── */
// 3×5 點陣字（霓虹招牌用）
const PIX = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'], M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'],
};
const SIGN_WORDS = { 0: ['CAFE', 'BAR', 'DINER'], 1: ['BOOKS', 'READ', 'LIBRI'], 2: ['FLORA', 'BLOOM', 'ROSE'] };
function buildRain(s, f) {
  const W = s.W, H = s.H, k = s.k, b = s.sb;
  const yR = s.yR = H * 0.66, yT = H * 0.4;
  skyBands(b, [[0, '#07080f'], [0.5, '#111527'], [1, '#1c2036']], 0, 0, W, yT + 2);
  // 後面的大樓（暗，少數窗亮著）
  for (let x = -20 * k; x < W;) { const w = rnd(120, 300) * k, h = H * rnd(0.12, 0.38), top = yT - h + H * 0.02, body = mixC(hexC('#141828'), hexC('#1c1f33'), Math.random()); b.rect(x, top, w, h + H * 0.02, body, 1); const ws = windows(s, x + 6 * k, top + 10 * k, w - 12 * k, h - 10 * k, 20 * k, 10 * k, 12 * k, 0.18, Math.random() < 0.6, body); for (const o of ws) if (o.on && Math.random() < 0.3) addLight(s, o.x + o.w / 2, o.y + o.h / 2, o.c, 0.16, H * 0.02, 0); x += w + rnd(0, 10) * k; }
  // 一樓的店面
  b.rect(0, yT, W, yR - yT, hexC('#1a1824'), 1);
  b.rect(0, yT, W, 5 * k, hexC('#2a2634'), 1);
  s.dyn.neon = [];
  const kinds = [0, 1, 2], NEON = [hexC('#ff5fa8'), hexC('#52e6ff'), hexC('#ffb347'), hexC('#7dff8a')];
  let x = -rnd(0, 0.1) * W, si = 0;
  while (x < W) {
    const w = W * rnd(0.22, 0.34), kind = kinds[si % 3], gy0 = yT + H * 0.07, gy1 = yR - H * 0.02;
    const warm = [hexC('#ffb86c'), hexC('#ffd08c'), hexC('#ffc2d2')][kind];
    // 室內：暖光漸層、裡面的東西是暗的剪影
    b.vrect(x + 8 * k, gy0, w - 16 * k, gy1 - gy0, mixC(warm, [1, 1, 1], 0.08), 1, mulC(warm, 0.42), 1, 4);
    const inner = mulC(warm, 0.28);
    if (kind === 0) { for (let tx = x + 30 * k; tx < x + w - 50 * k; tx += rnd(70, 110) * k) { const ty = gy1 - H * 0.055; b.rect(tx, ty, 40 * k, 4 * k, inner, 1); b.rect(tx + 17 * k, ty, 6 * k, H * 0.05, inner, 1); if (Math.random() < 0.6) { b.disc(tx + (Math.random() < 0.5 ? -8 : 50) * k, ty - 10 * k, 7 * k, 8 * k, inner, 1, 8); b.rect(tx + (Math.random() < 0.5 ? -14 : 44) * k, ty - 2 * k, 12 * k, 28 * k, inner, 1); } } }
    else if (kind === 1) { for (let sy = gy1 - H * 0.03; sy > gy0 + H * 0.03; sy -= H * 0.045) { b.rect(x + 14 * k, sy, w - 28 * k, 3 * k, inner, 1); for (let bx = x + 16 * k; bx < x + w - 20 * k; bx += rnd(5, 9) * k) if (Math.random() < 0.8) b.rect(bx, sy - rnd(16, 26) * k, rnd(4, 7) * k, 26 * k, mixC(inner, pick([[0.7, 0.2, 0.2], [0.2, 0.3, 0.6], [0.8, 0.7, 0.3], [0.3, 0.5, 0.3]]), 0.5), 0.9); } }
    else { for (let bx = x + 20 * k; bx < x + w - 30 * k; bx += rnd(26, 40) * k) { b.rect(bx, gy1 - H * 0.03, 16 * k, H * 0.03, inner, 1); const fc = pick([[0.95, 0.4, 0.5], [1, 0.85, 0.35], [0.98, 0.6, 0.78], [0.75, 0.5, 0.95], [1, 1, 0.95]]); for (let q = 0; q < 6; q++) b.disc(bx + rnd(0, 16) * k, gy1 - H * 0.03 - rnd(6, 22) * k, 4 * k, 4 * k, fc, 0.9, 1); b.rect(bx + 6 * k, gy1 - H * 0.05, 3 * k, H * 0.02, [0.25, 0.45, 0.25], 1); } }
    // 吊燈
    for (let lx = x + rnd(60, 110) * k; lx < x + w - 40 * k; lx += rnd(170, 260) * k) { const ly = gy0 + H * 0.045; b.rect(lx - 1 * k, gy0, 2 * k, ly - gy0, inner, 1); b.blend(1); b.disc(lx, ly, H * 0.05, H * 0.05, hexC('#ffe2a8'), 0.35, 2); b.blend(0); b.disc(lx, ly, 5 * k, 4 * k, hexC('#fff4d8'), 1, 8); addLight(s, lx, ly, hexC('#ffe0a8'), 0.32, H * 0.032, 0); }
    b.quad4(x + w * 0.15, gy0, x + w * 0.3, gy0, x + w * 0.12, gy1, x + w * 0.02, gy1, [1, 1, 1], 0.07, [1, 1, 1], 0.07, [1, 1, 1], 0.02, [1, 1, 1], 0.02, 0);
    // 窗框、門
    const fc0 = hexC('#0d0e15');
    b.rect(x, yT, 8 * k, yR - yT, fc0, 1); b.rect(x + w - 8 * k, yT, 8 * k, yR - yT, fc0, 1); b.rect(x, gy1, w, yR - gy1, hexC('#15141c'), 1); b.rect(x, gy0 - 4 * k, w, 4 * k, fc0, 1);
    for (let mx = x + w * 0.33; mx < x + w - 10 * k; mx += w * 0.33) b.rect(mx - 2 * k, gy0, 4 * k, gy1 - gy0, fc0, 1);
    const dx = x + w * 0.72; b.rect(dx, gy0 + H * 0.02, w * 0.14, gy1 - gy0 - H * 0.02, hexC('#231a16'), 1); b.rect(dx + w * 0.02, gy0 + H * 0.04, w * 0.1, (gy1 - gy0) * 0.45, mulC(warm, 0.5), 1, 4);
    // 遮雨棚（條紋）
    const aw0 = yT + H * 0.055, aw1 = yT + H * 0.085, c1 = pick([hexC('#8a2432'), hexC('#1e4a3a'), hexC('#2a3f7a')]), c2 = hexC('#cfc9bb');
    for (let ax = x; ax < x + w; ax += 22 * k) b.quad4(ax, aw0, ax + 22 * k, aw0, ax + 22 * k + 6 * k, aw1, ax + 6 * k, aw1, (ax / (22 * k)) % 2 < 1 ? c1 : c2, 1, (ax / (22 * k)) % 2 < 1 ? c1 : c2, 1, mulC(c1, 0.6), 1, mulC(c1, 0.6), 1, 0);
    b.rect(x, aw1, w + 6 * k, 3 * k, hexC('#0a0a10'), 1);
    // 霓虹招牌（每格畫，會閃）
    const word = pick(SIGN_WORDS[kind]), nc = NEON[si % NEON.length], dot = 4.4 * k, gap = 1.6 * k, lw = 3 * dot + 3 * gap, tw = word.length * (lw + 2 * dot) - 2 * dot;
    const sx0 = x + (w - tw) / 2, sy0 = yT + H * 0.012;
    s.dyn.neon.push({ word, x: sx0, y: sy0, dot, gap, lw, c: nc, core: mixC(nc, WHITE, 0.55), ph: rnd(100), fl: Math.random() < 0.4 });
    b.rect(sx0 - 10 * k, sy0 - 6 * k, tw + 20 * k, 5 * dot + 4 * gap + 12 * k, hexC('#0e0d14'), 1);
    for (let i = 0; i < word.length; i++) addLight(s, sx0 + i * (lw + 2 * dot) + lw / 2, sy0 + (5 * dot + 4 * gap) / 2, nc, 0.4, H * 0.03, 1);
    x += w; si++;
  }
  // 路燈（左）：光在雨裡散成一個錐
  const lx = W * 0.12, ly = yT - H * 0.1;
  b.rect(lx - 2 * k, ly, 4 * k, yR - ly, hexC('#0b0b12'), 1);
  b.blend(1); b.tri(lx - W * 0.09, yR, lx + W * 0.09, yR, lx, ly, hexC('#ffd7a0'), 0.1); b.disc(lx, ly, H * 0.09, H * 0.09, hexC('#ffd7a0'), 0.4, 2); b.blend(0);
  b.disc(lx, ly, 6 * k, 4.5 * k, hexC('#fff0cc'), 1, 8);
  addLight(s, lx, ly, hexC('#ffdcaa'), 0.6, H * 0.05, 0);
  // 紅綠燈（右）
  const tx = W * 0.9, ty = yT - H * 0.02;
  b.rect(tx - 2 * k, ty, 4 * k, yR - ty, hexC('#0b0b12'), 1); b.rect(tx - 9 * k, ty - H * 0.075, 18 * k, H * 0.075, hexC('#121218'), 1);
  s.tl = { x: tx, y: ty - H * 0.075, h: H * 0.075, st: 0, t: rnd(2, 6) };
  // 濕的街道：路面、倒影
  b.vrect(0, yR, W, H - yR, hexC('#0e1019'), 1, hexC('#141722'), 1);
  b.rect(0, yR, W, 3 * k, hexC('#2c2f3c'), 1);
  for (let cx = W * 0.3; cx < W * 0.7; cx += W * 0.05) b.rect(cx, yR + H * 0.12, W * 0.028, H * 0.025, hexC('#232633'), 0.5);
  b.blend(1);
  for (const L of s.lights) { if (L.y > yR) continue; const len = (yR - L.y) * 0.95, w = L.R * (L.fl ? 2.4 : 2.2); b.quad4(L.x - w, yR, L.x + w, yR, L.x + w * 1.4, yR + len, L.x - w * 1.4, yR + len, L.c, L.I * 0.45, L.c, L.I * 0.45, L.c, 0, L.c, 0, 11); }
  // 店面窗的大片倒影
  b.vrect(0, yR, W, H * 0.22, hexC('#ffb870'), 0.14, hexC('#ffb870'), 0, 0);
  b.blend(0);
  // 雨：雨絲、漣漪、偶爾一輛車
  const n = s.thumb ? 90 : Math.round(360 * Math.sqrt(W * H / (2560 * 1440)));
  s.dyn.rain = new Float32Array(n * 4);  // x, y, 速度, 長度
  for (let i = 0; i < n; i++) { const o = i * 4; s.dyn.rain[o] = rnd(W); s.dyn.rain[o + 1] = rnd(H); s.dyn.rain[o + 2] = rnd(900, 1500) * k; s.dyn.rain[o + 3] = rnd(22, 48) * k; }
  s.dyn.rip = []; s.dyn.ripT = 0; s.dyn.cars = []; s.dyn.carT = rnd(4, 12);
  s.refl = [1 - yR / H, 0.62, 0.014, 0.38, 0.42];   // 濕的街道：上面的店面和燈倒映下來（擦開的地方是柔柔的、一條一條的濕柏油，不是鏡子）
}
function dynRain(s, f, db, gb, bk) {
  const W = s.W, H = s.H, k = s.k, dt = f.dt, t = f.t, d = s.dyn, yR = s.yR;
  const rn = d.rain, rc = C_RAIN;
  for (let i = 0; i < rn.length; i += 4) {
    rn[i + 1] += rn[i + 2] * dt; rn[i] -= rn[i + 2] * 0.1 * dt;
    if (rn[i + 1] > H + 20) { rn[i + 1] = -rn[i + 3] - rnd(0, H * 0.3); rn[i] = rnd(-10, W + 40); }
    const L = rn[i + 3]; db.quad4(rn[i] + L * 0.1, rn[i + 1], rn[i] + L * 0.1 + 2.6 * k, rn[i + 1], rn[i] + 2.6 * k, rn[i + 1] + L, rn[i], rn[i + 1] + L, rc, 0.34, rc, 0.34, rc, 0.34, rc, 0.34, 7);
  }
  d.ripT -= dt; if (d.ripT <= 0) { d.ripT = rnd(0.02, 0.08); if (d.rip.length < 46) d.rip.push({ x: rnd(W), y: rnd(yR + H * 0.015, H), t: 0, r: rnd(7, 15) * k }); }
  for (let i = d.rip.length - 1; i >= 0; i--) { const p = d.rip[i]; p.t += dt; if (p.t > 0.75) { d.rip.splice(i, 1); continue; } const u = p.t / 0.75, r = p.r * (0.2 + 0.8 * u); gb.disc(p.x, p.y, r * 1.2, r * 0.42, C_RIP, (1 - u) * 0.45, 9); }
  // 霓虹招牌
  for (const n of d.neon) {
    let I = 0.85 + 0.15 * Math.sin(t * 7 + n.ph) * Math.sin(t * 13.1 + n.ph);
    if (n.fl && hsh(Math.floor(t * 3 + n.ph), 5) < 0.06) I *= 0.25;
    const core = n.core;
    for (let i = 0; i < n.word.length; i++) {
      const g = PIX[n.word[i]]; if (!g) continue;
      const lx = n.x + i * (n.lw + 2 * n.dot);
      gb.disc(lx + n.lw / 2, n.y + (5 * n.dot + 4 * n.gap) / 2, n.lw * 1.8, n.lw * 2, n.c, 0.35 * I, 2);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '#') gb.disc(lx + c * (n.dot + n.gap) + n.dot / 2, n.y + r * (n.dot + n.gap) + n.dot / 2, n.dot * 1.1, n.dot * 1.1, core, I, 1);
      bk.disc(lx + n.lw / 2, n.y + (5 * n.dot + 4 * n.gap) / 2, H * 0.03, H * 0.03, n.c, 0.4 * I, 3);
    }
    // 招牌在濕路上的倒影（會跟著閃）
    const tw = n.word.length * (n.lw + 2 * n.dot) - 2 * n.dot, cx = n.x + tw / 2, len = (yR - n.y) * 0.9;
    gb.quad4(cx - tw * 0.5, yR, cx + tw * 0.5, yR, cx + tw * 0.65, yR + len, cx - tw * 0.65, yR + len, n.c, 0.12 * I, n.c, 0.12 * I, n.c, 0, n.c, 0, 11);
  }
  // 紅綠燈
  const tl = s.tl; tl.t -= dt; if (tl.t <= 0) { tl.st = (tl.st + 1) % 3; tl.t = [7, 1.6, 6][tl.st]; }
  for (let i = 0; i < 3; i++) { const on = i === tl.st, c = TLC[i], ly = tl.y + tl.h * (0.18 + 0.32 * i); gb.disc(tl.x, ly, 5 * k, 5 * k, c, on ? 1 : 0.1, 8); if (on) { gb.disc(tl.x, ly, 22 * k, 22 * k, c, 0.35, 2); bk.disc(tl.x, ly, H * 0.024, H * 0.024, c, 0.5, 3); gb.quad4(tl.x - 8 * k, yR, tl.x + 8 * k, yR, tl.x + 12 * k, yR + (yR - ly) * 0.9, tl.x - 12 * k, yR + (yR - ly) * 0.9, c, 0.3, c, 0.3, c, 0, c, 0, 11); } }
  // 偶爾一輛車開過（車燈在雨裡暈開、路上有倒影）
  d.carT -= dt;
  if (d.carT <= 0 && d.cars.length < 2) { d.carT = rnd(12, 26); const dir = Math.random() < 0.5 ? 1 : -1; d.cars.push({ x: dir > 0 ? -W * 0.08 : W * 1.08, y: yR + H * (dir > 0 ? 0.05 : 0.1), v: dir * W * rnd(0.22, 0.3), dir }); }
  for (let i = d.cars.length - 1; i >= 0; i--) {
    const c = d.cars[i]; c.x += c.v * dt; if (c.x < -W * 0.12 || c.x > W * 1.12) { d.cars.splice(i, 1); continue; }
    const white = c.dir > 0, col = white ? C_HEAD2 : C_TAIL2, gap = 11 * k;
    for (let q = -1; q <= 1; q += 2) { const o = q * gap; gb.disc(c.x + o, c.y, 5 * k, 5 * k, col, 1, 5); gb.disc(c.x + o, c.y, 30 * k, 30 * k, col, 0.3, 2); gb.quad4(c.x + o - 6 * k, c.y + 6 * k, c.x + o + 6 * k, c.y + 6 * k, c.x + o + 9 * k, c.y + 60 * k, c.x + o - 9 * k, c.y + 60 * k, col, 0.35, col, 0.35, col, 0, col, 0, 11); }
    bk.disc(c.x, c.y, H * 0.034, H * 0.034, col, white ? 0.6 : 0.45, 3);
  }
}
const SCENES = {
  city: { build: buildCity, dyn: dynCity, tint: hexC('#5a6684'), warm: hexC('#8a6a48'), fog: [0.8, 0.22, 0.42], grade: [1.15, 1.08, 0.0], bokeh: 0.9, grain: 1, lift: 1 },
  snow: { build: buildSnow, dyn: dynSnow, tint: hexC('#e9edf9'), warm: hexC('#c8a890'), fog: [0.84, 0.18, 0.3], grade: [1.1, 1.05, 0.0], bokeh: 0.5, grain: 0.8, lift: 0.42 },
  rain: { build: buildRain, dyn: dynRain, tint: hexC('#56607c'), warm: hexC('#80664a'), fog: [0.8, 0.22, 0.42], grade: [1.16, 1.1, 0.0], bokeh: 0.95, grain: 1, lift: 1 },
};

/* ════════════ 手指擦過的膠囊 → 送進霧的場 ════════════ */
const SEG_F = 11, MAX_SEG = 1000;
// (x0,y0)-(x1,y1) 半徑 R；kF 擦掉多少霧、kH 暫停起霧（0–1 = 0–HMAX 秒）、kW 水膜、bump 水珠高度
function seg(s, x0, y0, x1, y1, R, kF, kH, kW, bump) {
  if (s.nseg >= MAX_SEG) return;
  const d = s.segs; let o = s.nseg * 6 * SEG_F;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ex = L > 0 ? dx / L : 1, ey = L > 0 ? dy / L : 0, m = R * 1.04;
  const nx = -ey * m, ny = ex * m;
  const ax = x0 - ex * m, ay = y0 - ey * m, bx = x1 + ex * m, by = y1 + ey * m;
  for (let v = 0; v < 6; v++) {
    const px = v === 0 || v === 3 ? ax + nx : v === 1 ? bx + nx : v === 5 ? ax - nx : bx - nx, py = v === 0 || v === 3 ? ay + ny : v === 1 ? by + ny : v === 5 ? ay - ny : by - ny;
    d[o] = px; d[o + 1] = py; d[o + 2] = x0; d[o + 3] = y0; d[o + 4] = x1; d[o + 5] = y1; d[o + 6] = kF; d[o + 7] = kH; d[o + 8] = kW; d[o + 9] = bump; d[o + 10] = R; o += SEG_F;
  }
  s.nseg++;
}
// 把累積的膠囊畫進目前綁定的 framebuffer：add = 0 乘進霧的場，1 加進開場的遮罩（重疊只算一次）
function drawCaps(gl, s, add) {
  const P = s.P.cap; gl.useProgram(P.p); gl.uniform2f(P.u.uRes, s.W, s.H); gl.uniform1f(P.u.uAdd, add);
  gl.bindBuffer(gl.ARRAY_BUFFER, s.buf.cap); gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.segs.subarray(0, s.nseg * 6 * SEG_F));
  gl.enableVertexAttribArray(P.a.aPos); gl.vertexAttribPointer(P.a.aPos, 2, gl.FLOAT, false, SEG_F * 4, 0);
  gl.enableVertexAttribArray(P.a.aSeg); gl.vertexAttribPointer(P.a.aSeg, 4, gl.FLOAT, false, SEG_F * 4, 8);
  gl.enableVertexAttribArray(P.a.aK); gl.vertexAttribPointer(P.a.aK, 4, gl.FLOAT, false, SEG_F * 4, 24);
  gl.enableVertexAttribArray(P.a.aR); gl.vertexAttribPointer(P.a.aR, 1, gl.FLOAT, false, SEG_F * 4, 40);
  gl.enable(gl.BLEND); if (add) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
  gl.drawArrays(gl.TRIANGLES, 0, s.nseg * 6);
  gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(P.a.aPos); gl.disableVertexAttribArray(P.a.aSeg); gl.disableVertexAttribArray(P.a.aK); gl.disableVertexAttribArray(P.a.aR);
  s.nseg = 0;
}
const MAX_DROPS = 18, MAX_BEADS = 70;
function spawnDrop(s, x, y, m0, grow) {
  if (s.drops.length >= MAX_DROPS || y >= s.H - 4 * s.k || y < 0 || x < 0 || x >= s.W) return;
  s.drops.push({ x, y, m: m0, gr: (1 - m0) / grow, st: 0, vy: 0, pause: 0, ph: rnd(TAU), side: 0, bt: rnd(0.3, 0.8) });
}
function addBead(s, x, y, r, life) { if (s.beads.length >= MAX_BEADS) s.beads.shift(); s.beads.push({ x, y, r, life, L: life }); }
function wipe(s, x0, y0, x1, y1, R, hold) { seg(s, x0, y0, x1, y1, R, 1, Math.min(1, hold / HMAX), 0.3, 0); }
function strokeBegin(s, x, y) { const k = s.stk; k.on = true; k.len = 0; k.lx = x; k.ly = y; k.x0 = k.x1 = x; k.y0 = k.y1 = y; k.R = s.R0; }
function strokeSeg(s, x0, y0, x1, y1, R, hold) {
  wipe(s, x0, y0, x1, y1, R, hold);
  const k = s.stk, L = Math.hypot(x1 - x0, y1 - y0);
  k.len += L; k.R = R;
  if (x1 < k.x0) k.x0 = x1; if (x1 > k.x1) k.x1 = x1; if (y1 < k.y0) k.y0 = y1; if (y1 > k.y1) k.y1 = y1;
  s.wet += L / s.HE * s.cf.drops;          // 擦掉的水氣累積起來，夠多了才在筆畫底下聚成一顆會流的水珠
  if (y1 > k.ly) { k.ly = y1; k.lx = x1; }
  if (s.wet > s.wetAt * 2) { s.wet -= s.wetAt; s.wetAt = rnd(1, 1.8); spawnDrop(s, k.lx, k.ly + R * 0.9, 0.25, rnd(2.5, 6)); k.ly = -1e9; }
}
function strokeEnd(s) {
  const k = s.stk; if (!k.on) return; k.on = false;
  if (s.wet > s.wetAt && k.ly > -1e8) { s.wet -= s.wetAt; s.wetAt = rnd(1, 1.8); spawnDrop(s, k.lx, k.ly + (k.R || 1) * 0.9, 0.3, rnd(1.5, 4.5)); }
}
// 玩家畫完的一筆：記下它的範圍，示範模式的塗鴉會避開（和自己畫過的一樣，過一陣子才當它不在了）
const MAX_BOXES = 10;
function userBox(s, now) {
  const k = s.stk, R = k.R || s.R0, pad = R * 1.4, bx = s.ai.boxes;   // 外框 = 筆畫範圍 ± 1.4R，不能壓到的內框 = ± R（一條直線也有手指的粗細）
  const last = bx.length ? bx[bx.length - 1] : null;
  // 連著畫的幾筆（寫字）併成一個範圍，免得一下子把名額用光
  if (last && last.user && now - last.t < 4 && Math.max(k.x1, last.x1) - Math.min(k.x0, last.x0) < s.HE * 0.7) { last.x0 = Math.min(last.x0, k.x0 - pad); last.y0 = Math.min(last.y0, k.y0 - pad); last.x1 = Math.max(last.x1, k.x1 + pad); last.y1 = Math.max(last.y1, k.y1 + pad); last.t = now; return; }
  bx.push({ x0: k.x0 - pad, y0: k.y0 - pad, x1: k.x1 + pad, y1: k.y1 + pad, t: now, pa: R * 0.4, user: true });
  if (bx.length > MAX_BOXES) bx.shift();
}
// 流下來的水珠：一頓一頓地往下、左右歪、留下清楚的水痕和零星小水珠，水用完了就停成一顆小珠
function dropStep(s, f) {
  const dt = f.dt, H = s.H, W = s.W, k = s.k, drops = s.drops;
  s.nt -= dt * s.cf.drops;
  if (s.nt <= 0) { s.nt = rnd(8, 18); spawnDrop(s, rnd(W * 0.03, W * 0.97), rnd(H * 0.03, H * 0.6), 0.15, rnd(3, 7)); }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if (d.st === 0) { d.m += d.gr * dt; if (d.m >= 1) { d.m = 1; d.st = 1; d.vy = 8 * k; } continue; }
    const mm = Math.min(1.6, d.m);
    if (d.pause > 0) { d.pause -= dt; d.vy *= Math.exp(-dt * 12); }
    else if (Math.random() < dt * 0.5 * Math.max(0.35, 1.5 - mm)) d.pause = rnd(0.15, 0.8) * Math.max(0.15, 1.4 - mm);
    else { const vt = (36 + 150 * mm * mm) * k; d.vy += (vt - d.vy) * Math.min(1, dt * 3); }
    if (Math.random() < dt * 1.3) d.side = rnd(-1, 1) * 1.6;
    d.side *= Math.exp(-dt * 0.8);
    const ny = d.y + d.vy * dt, nx = clamp(d.x + (d.side + Math.sin(f.t * 1.7 + d.ph) * 0.4) * dt * d.vy * 0.3, 2, W - 2);
    const r = (2.4 + 3.4 * mm) * k;
    seg(s, d.x, d.y, nx, ny, r, 1, 0.3, 1, 0);
    d.m -= dt * (0.035 + 0.02 / Math.max(0.3, mm)) * (d.vy > 1 ? 1 : 0.2);
    d.bt -= dt * (d.vy / (40 * k)); if (d.bt <= 0 && d.m > 0.4) { d.bt = rnd(0.4, 1.1); addBead(s, d.x + rnd(-r, r) * 0.5, d.y - r * 1.5, (1.4 + rnd(0, 1.6)) * k, rnd(20, 45)); d.m -= 0.01; }
    d.x = nx; d.y = ny;
    if (d.y >= H + 10 * k) { drops.splice(i, 1); continue; }
    if (d.m < 0.3) { addBead(s, d.x, d.y, 3.2 * k, rnd(30, 70)); drops.splice(i, 1); }
  }
  // 兩顆碰在一起就合併
  for (let a = 0; a < drops.length; a++) for (let b = drops.length - 1; b > a; b--) {
    const p = drops[a], q = drops[b], ra = (4 + 7 * Math.min(1.5, p.m)) * k, rb = (4 + 7 * Math.min(1.5, q.m)) * k;
    if (Math.abs(p.x - q.x) < (ra + rb) * 0.8 && Math.abs(p.y - q.y) < (ra + rb) * 0.7 && (p.st || q.st)) {
      if (q.y > p.y) { p.x = q.x; p.y = q.y; }
      p.m = Math.min(1.8, p.m + q.m * 0.9); p.vy = Math.max(p.vy, q.vy); p.pause = 0; if (p.st === 0) p.st = 1;
      drops.splice(b, 1);
    }
  }
  // 畫出水珠本體（高度場）：長大中的半透明、流動中的滿的
  for (const d of drops) { const mm = Math.min(1.5, d.m), r = (4 + 7 * mm) * k; seg(s, d.x, d.y, d.x, d.y + r * 0.25 * (d.st ? 1 : 0), r, d.st ? 0.9 : 0.5 * mm, 0.08, 0.6, d.st ? 1 : 0.35 + 0.65 * mm); }
  for (let i = s.beads.length - 1; i >= 0; i--) { const b = s.beads[i]; b.life -= dt; if (b.life <= 0) { s.beads.splice(i, 1); continue; } seg(s, b.x, b.y, b.x, b.y, b.r, 0, 0, 0, Math.min(1, b.life / 8) * 0.8); }
}

/* ════════════ 塗鴉（示範模式：看不見的手指畫的） ════════════ */
function arcP(cx, cy, rx, ry, a0, a1, n) {
  const o = []; n = n || Math.max(10, Math.ceil(Math.abs(a1 - a0) * 9));
  for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return o;
}
// 手寫的小寫字母（基線 y = 1，x 高 0.42，上伸到 0，下伸到 1.32）
const LET = {
  h: { w: 0.46, it: () => [['s', [[0, 0], [0, 1], [0, 0.68], ...arcP(0.23, 0.68, 0.23, 0.25, PI, 2 * PI), [0.46, 1]]]] },
  i: { w: 0.1, it: () => [['s', [[0.05, 0.44], [0.05, 1]]], ['t', [0.05, 0.18]]] },
  l: { w: 0.14, it: () => [['s', [[0.06, 0], [0.06, 0.92], [0.14, 1]]]] },
  o: { w: 0.5, it: () => [['s', arcP(0.25, 0.71, 0.25, 0.29, -PI / 2, -PI / 2 - 2 * PI - 0.25)]] },
  v: { w: 0.48, it: () => [['s', [[0, 0.42], [0.24, 1], [0.48, 0.42]]]] },
  e: { w: 0.48, it: () => [['s', [[0.03, 0.72], [0.46, 0.72], ...arcP(0.245, 0.72, 0.215, 0.28, 0, -2 * PI + 0.75)]]] },
  k: { w: 0.42, it: () => [['s', [[0, 0], [0, 1]]], ['s', [[0.4, 0.44], [0.03, 0.74], [0.42, 1]]]] },
  y: { w: 0.48, it: () => [['s', [[0, 0.42], [0.23, 0.98]]], ['s', [[0.48, 0.42], [0.2, 1.16], [0.08, 1.32]]]] },
  你: { w: 1, it: () => [['s', [[0.24, 0], [0.04, 0.4]]], ['s', [[0.15, 0.24], [0.15, 1]]], ['s', [[0.52, 0], [0.36, 0.32]]], ['s', [[0.43, 0.17], [0.96, 0.17], [0.86, 0.34]]],
    ['s', [[0.68, 0.33], [0.68, 0.96], [0.58, 0.9]]], ['s', [[0.48, 0.56], [0.36, 0.8]]], ['s', [[0.84, 0.56], [0.97, 0.8]]]] },
  好: { w: 1, it: () => [['s', [[0.22, 0], [0.08, 0.52], [0.42, 0.98]]], ['s', [[0.38, 0.28], [0.32, 0.62], [0.04, 0.96]]], ['s', [[0, 0.42], [0.47, 0.42]]],
    ['s', [[0.56, 0.1], [0.93, 0.1], [0.76, 0.3]]], ['s', [[0.76, 0.3], [0.76, 0.96], [0.66, 0.9]]], ['s', [[0.52, 0.52], [1, 0.52]]]] },
};
function heartItems(cx, cy, h) {
  const o = [];
  for (let k = 0; k <= 72; k++) { const t = k / 72 * 2 * PI, x = 16 * Math.pow(Math.sin(t), 3), y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); o.push([cx + x / 29 * h, cy + (y - 2.5) / 29 * h]); }
  return [['s', o]];
}
function wordItems(word) {
  const it = []; let x = 0;
  for (const c of word) {
    if (c === ' ') { x += 0.3; continue; }
    if (c === '♡') { it.push(...heartItems(x + 0.42, 0.6, 0.56)); x += 0.9; continue; }
    const L = LET[c]; if (!L) continue;
    const sl = rnd(-0.03, 0.03), by = rnd(-0.03, 0.03);
    const tf = p => [x + p[0] - (p[1] - 0.5) * 0.12 + sl * (0.5 - p[1]), p[1] + by];
    for (const [k, v] of L.it()) it.push(k === 't' ? ['t', tf(v)] : ['s', v.map(tf)]);
    x += L.w + (wideCh(c) ? 0.16 : 0.17);
  }
  return it;
}
const DOODLES = {
  heart: () => heartItems(0.55, 0.5, 1),
  smile: () => [['s', arcP(0.5, 0.5, 0.5, 0.5, -PI / 2 - 0.3, -PI / 2 - 0.3 + 2 * PI + 0.35)], ['s', [[0.35, 0.3], [0.35, 0.42]]], ['s', [[0.65, 0.3], [0.65, 0.42]]], ['s', arcP(0.5, 0.52, 0.28, 0.24, 0.45, PI - 0.45)]],
  sun: () => {
    const it = [['s', arcP(0.5, 0.5, 0.3, 0.3, -PI / 2, 3 * PI / 2 + 0.3)]];
    for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; it.push(['s', [[0.5 + Math.cos(a) * 0.4, 0.5 + Math.sin(a) * 0.4], [0.5 + Math.cos(a) * 0.52, 0.5 + Math.sin(a) * 0.52]]]); }
    it.push(['t', [0.41, 0.44]], ['t', [0.59, 0.44]], ['s', arcP(0.5, 0.5, 0.14, 0.13, 0.45, PI - 0.45)]);
    return it;
  },
  star: () => { const p = []; for (let k = 0; k <= 10; k++) { const a = -PI / 2 + k * PI / 5, r = k % 2 ? 0.22 : 0.5; p.push([0.5 + Math.cos(a) * r, 0.53 + Math.sin(a) * r]); } return [['s', p]]; },
  swirl: () => { const p = []; for (let k = 0; k <= 140; k++) { const u = k / 140, a = u * 3.1 * 2 * PI; p.push([0.5 + Math.cos(a) * (0.03 + 0.47 * u), 0.5 + Math.sin(a) * (0.03 + 0.47 * u)]); } return [['s', p]]; },
  ttt: () => {
    const it = [['s', [[0.34, 0], [0.33, 1]]], ['s', [[0.67, 0], [0.68, 1]]], ['s', [[0, 0.34], [1, 0.33]]], ['s', [[0, 0.67], [1, 0.68]]]];
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]], win = pick(lines);
    const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(c => !win.includes(c)).sort(() => Math.random() - 0.5);
    const cell = c => [((c % 3) + 0.5) / 3, (Math.floor(c / 3) + 0.5) / 3], r = 0.095;
    const X = c => { const [cx, cy] = cell(c); it.push(['s', [[cx - r, cy - r], [cx + r, cy + r]]], ['s', [[cx + r, cy - r], [cx - r, cy + r]]]); };
    const O = c => { const [cx, cy] = cell(c); it.push(['s', arcP(cx, cy, r * 1.15, r * 1.15, -PI / 2, 3 * PI / 2 + 0.3)]); };
    X(win[0]); O(free[0]); X(win[2]); O(free[1]); X(win[1]);
    const a = cell(win[0]), b = cell(win[2]), ex = (b[0] - a[0]) * 0.28, ey = (b[1] - a[1]) * 0.28;
    it.push(['s', [[a[0] - ex, a[1] - ey], [b[0] + ex, b[1] + ey]]]);
    return it;
  },
  cat: () => [
    ['s', [[0.2, 0.44], [0.22, 0.06], [0.42, 0.3]]], ['s', [[0.58, 0.3], [0.78, 0.06], [0.8, 0.44]]],
    ['s', arcP(0.5, 0.6, 0.36, 0.32, -PI / 2 - 0.35, -PI / 2 - 0.35 + 2 * PI + 0.15)],
    ['t', [0.37, 0.56]], ['t', [0.63, 0.56]],
    ['s', [[0.42, 0.7], [0.46, 0.76], [0.5, 0.71], [0.54, 0.76], [0.58, 0.7]]],
    ['s', [[0.2, 0.64], [-0.1, 0.6]]], ['s', [[0.2, 0.73], [-0.08, 0.78]]], ['s', [[0.8, 0.64], [1.1, 0.6]]], ['s', [[0.8, 0.73], [1.08, 0.78]]],
  ],
  flower: () => [
    ['s', [[0.24, 0.06], ...arcP(0.5, 0.2, 0.26, 0.3, PI, 0, 16).slice(1), [0.76, 0.06], [0.63, 0.17], [0.5, 0.02], [0.37, 0.17], [0.24, 0.06]]],
    ['s', [[0.5, 0.5], [0.5, 1.05]]],
    ['s', [[0.5, 0.92], [0.36, 0.78], [0.2, 0.7], [0.3, 0.86], [0.5, 0.92]]], ['s', [[0.5, 0.8], [0.64, 0.66], [0.8, 0.6], [0.7, 0.75], [0.5, 0.8]]],
  ],
  house: () => [['s', [[0.15, 0.48], [0.15, 1], [0.85, 1], [0.85, 0.48]]], ['s', [[0.06, 0.54], [0.5, 0.1], [0.94, 0.54]]], ['s', [[0.42, 1], [0.42, 0.74], [0.58, 0.74], [0.58, 1]]], ['s', [[0.68, 0.18], [0.68, 0.3]]], ['t', [0.28, 0.66]]],
  moon: () => [['s', [...arcP(0.5, 0.5, 0.5, 0.5, -PI / 2 - 0.25, PI / 2 + 0.25, 30).reverse().map(([x, y]) => [1 - x, y]), ...arcP(0.68, 0.46, 0.4, 0.42, PI * 0.62, PI * 1.38, 20).reverse()]], ['t', [0.92, 0.2]], ['t', [0.78, 0.82]]],
  umbrella: () => [['s', arcP(0.5, 0.48, 0.5, 0.4, PI, 2 * PI)], ['s', [...arcP(0.833, 0.48, 0.167, 0.07, 0, -PI, 8), ...arcP(0.5, 0.48, 0.167, 0.07, 0, -PI, 8), ...arcP(0.167, 0.48, 0.167, 0.07, 0, -PI, 8)]], ['s', [[0.5, 0.08], [0.5, 0.94], ...arcP(0.42, 0.94, 0.08, 0.07, 0, PI, 8)]]],
  snowman: () => [['s', arcP(0.5, 0.7, 0.3, 0.3, -PI / 2, 3 * PI / 2 + 0.2)], ['s', arcP(0.5, 0.25, 0.19, 0.19, -PI / 2, 3 * PI / 2 + 0.2)], ['t', [0.44, 0.22]], ['t', [0.56, 0.22]], ['s', [[0.5, 0.29], [0.64, 0.31]]], ['t', [0.5, 0.58]], ['t', [0.5, 0.72]], ['s', [[0.24, 0.6], [0.02, 0.44]]], ['s', [[0.76, 0.6], [0.98, 0.44]]]],
  tree: () => [['s', [[0.5, 0], [0.24, 0.3], [0.38, 0.3], [0.14, 0.6], [0.32, 0.6], [0.06, 0.88], [0.94, 0.88], [0.68, 0.6], [0.86, 0.6], [0.62, 0.3], [0.76, 0.3], [0.5, 0]]], ['s', [[0.5, 0.88], [0.5, 1.05]]]],
};
const DOODLE_SETS = {
  city: ['heart', 'smile', 'star', 'moon', 'swirl', 'ttt', 'cat', 'word', 'word', 'house', 'heart'],
  snow: ['heart', 'smile', 'sun', 'snowman', 'tree', 'star', 'word', 'word', 'flower', 'cat'],
  rain: ['heart', 'smile', 'umbrella', 'cat', 'flower', 'ttt', 'word', 'word', 'swirl', 'sun'],
};
const DSIZE = { heart: [0.3, 0.42, 5], smile: [0.32, 0.42, 6], star: [0.32, 0.42, 5.5], swirl: [0.3, 0.4, 6], moon: [0.32, 0.42, 5], sun: [0.4, 0.5, 8],
  cat: [0.42, 0.52, 8.5], flower: [0.44, 0.54, 8.5], house: [0.36, 0.46, 6], umbrella: [0.36, 0.46, 6], snowman: [0.46, 0.56, 9], tree: [0.36, 0.46, 6], ttt: [0.48, 0.56, 9], word: [0.24, 0.3, 4.5] };
const SMALL_SET = ['heart', 'smile', 'star', 'swirl', 'word', 'heart'];
function makeShape(kind, f, small, ai) {
  let it;
  if (kind === 'word') {
    const list = small ? ['hi', 'hi', 'love', 'hi ♡'] : f.lang === 'en' ? ['hi', 'love', 'hello', 'hey', 'hi ♡', 'love'] : ['hi', 'love', '你好', '你好', 'hi ♡', '你好♡'];
    let w = pick(list);
    for (let k = 0; k < 8 && ai && w.replace(/ ?♡/, '') === ai.lastWord; k++) w = pick(list);
    if (ai) ai.lastWord = w.replace(/ ?♡/, '');
    it = wordItems(w);
  } else it = DOODLES[kind]();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [k, v] of it) for (const p of k === 't' ? [v] : v) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const sc = 1 / Math.max(0.01, y1 - y0);
  const items = it.map(([k, v]) => [k, k === 't' ? [(v[0] - x0) * sc, (v[1] - y0) * sc] : v.map(p => [(p[0] - x0) * sc, (p[1] - y0) * sc])]);
  return { kind, w: (x1 - x0) * sc, items };
}
const travel = (x0, y0, x1, y1, k) => (x0 === null ? 0.1 : 0.1 + Math.hypot(x1 - x0, y1 - y0) / (1200 * k)) + rnd(0.04, 0.2);
// 形狀放到畫面上 → 手指的動作（筆畫細分、加一點手抖；點一下）
function compileShape(s, sh, ox, oy, Hd) {
  const ops = [], seed = rnd(100);
  let lx = null, ly = null, arc = 0;
  for (const [k, v] of sh.items) {
    if (k === 't') { const x = ox + v[0] * Hd, y = oy + v[1] * Hd; ops.push({ k: 2, x, y, pre: travel(lx, ly, x, y, s.k) }); lx = x; ly = y; continue; }
    const P = [];
    for (let q = 0; q < v.length; q++) {
      const a = v[q], b = v[q + 1];
      const n = b ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05)) : 1;
      for (let e = 0; e < n; e++) {
        const u = b ? e / n : 0, px = b ? a[0] + (b[0] - a[0]) * u : a[0], py = b ? a[1] + (b[1] - a[1]) * u : a[1];
        if (P.length) arc += Math.hypot(px - P[P.length - 1][2], py - P[P.length - 1][3]);
        const wx = n1(arc * 2.3 + seed, 3) * 0.012, wy = n1(arc * 2.3 + seed, 11) * 0.012;
        P.push([ox + (px + wx) * Hd, oy + (py + wy) * Hd, px, py]);
        if (!b) break;
      }
    }
    const X = new Float32Array(P.length), Y = new Float32Array(P.length), L = new Float32Array(P.length);
    for (let q = 0; q < P.length; q++) { X[q] = P[q][0]; Y[q] = P[q][1]; if (q) L[q] = L[q - 1] + Math.hypot(X[q] - X[q - 1], Y[q] - Y[q - 1]); }
    ops.push({ k: 1, X, Y, L, len: L[L.length - 1], pre: travel(lx, ly, X[0], Y[0], s.k) });
    lx = X[X.length - 1]; ly = Y[Y.length - 1];
  }
  return ops;
}
// 找一塊地方畫下一個塗鴉：避開最近畫過的（還沒被霧蓋掉）、左上角的桌面圖示和底下的提示列
function planDoodle(s, f) {
  const ai = s.ai, W = s.W, H = s.H, HE = s.HE;
  const small = s.thumb, set = small ? SMALL_SET : DOODLE_SETS[s.scene];
  let kind;
  for (let k = 0; k < 8; k++) { kind = pick(set); if (!ai.recent.includes(kind) || kind === 'word') break; }
  const sh = makeShape(kind, f, small, ai);
  const sz = DSIZE[kind] || DSIZE.heart;
  // 一直找不到空位（前面的塗鴉都還看得見）：畫小一點的
  let Hd = Math.max(HE * (ai.shrink ? sz[0] * 0.8 : rnd(sz[0], sz[1])), s.R0 * 2 * sz[2]);
  Hd = Math.min(Hd, H * 0.8, W * 0.8 / Math.max(0.3, sh.w));
  const w = sh.w * Hd, pad = s.R0 * 1.4;
  let best = [clamp((W - w) / 2, 0, W), clamp((H - Hd) / 2, 0, H)], bs = -1e9, bestOv = 0;
  // 一個塗鴉大約 60 多秒才完全被霧蓋掉：70 秒內的不能壓到、110 秒內的盡量避開
  const boxes = ai.boxes, now = f.t, AGE = 110, FRESH = 70, AGE_U = 60, FRESH_U = 35;   // 玩家自己畫的避開短一點，示範不會停太久
  for (let k = 0; k < 40; k++) {
    const ox = rnd(Math.min(W * 0.09, Math.max(pad, W - w - pad)), Math.max(pad, W - w - pad)), oy = rnd(pad, Math.max(pad, H - H * 0.06 - pad - Hd));
    let ov = 0, ovF = 0;
    for (const bx of boxes) {
      const age = now - bx.t; if (age > (bx.user ? AGE_U : AGE)) continue;
      const ix = Math.min(ox + w + pad, bx.x1) - Math.max(ox - pad, bx.x0), iy = Math.min(oy + Hd + pad, bx.y1) - Math.max(oy - pad, bx.y0);
      if (ix > 0 && iy > 0) ov += ix * iy / Math.max(1, Math.min((w + 2 * pad) * (Hd + 2 * pad), (bx.x1 - bx.x0) * (bx.y1 - bx.y0))) * (1 - 0.6 * age / AGE);
      if (age < (bx.user ? FRESH_U : FRESH)) { const pa = bx.pa || 0, jx = Math.min(ox + w, bx.x1 - pa) - Math.max(ox, bx.x0 + pa), jy = Math.min(oy + Hd, bx.y1 - pa) - Math.max(oy, bx.y0 + pa); if (jx > 0 && jy > 0) ovF = Math.max(ovF, jx * jy / Math.max(1, Math.min(w * Hd, (bx.x1 - bx.x0 - 2 * pa) * (bx.y1 - bx.y0 - 2 * pa)))); }
    }
    // 偏好畫面中間偏上、避開左上角
    const cx = (ox + w / 2) / W, cy = (oy + Hd / 2) / H;
    const sc = -ov * 8 + Math.random() * 0.3 - (ox < W * 0.08 && oy < H * 0.6 ? 0.3 : 0) - Math.abs(cx - 0.5) * 0.25 - Math.abs(cy - 0.42) * 0.3;
    if (sc > bs) { bs = sc; best = [ox, oy]; bestOv = ovF; }
  }
  // 最好的位置還是會壓到還新鮮的塗鴉：絕不硬畫，等幾秒再找（等了三次就改畫小的）
  if (bestOv > 0.25) { ai.retry = (ai.retry || 0) + 1; if (ai.retry >= 3) ai.shrink = true; ai.wait = rnd(3, 6); return false; }
  ai.retry = 0; ai.shrink = false;
  ai.recent.push(kind); if (ai.recent.length > 3) ai.recent.shift();
  boxes.push({ x0: best[0] - pad, y0: best[1] - pad, x1: best[0] + w + pad, y1: best[1] + Hd + pad, t: now, pa: pad });
  if (boxes.length > MAX_BOXES) boxes.shift();
  ai.ops = compileShape(s, sh, best[0], best[1], Hd);
  ai.oi = 0; ai.ph = 0; ai.tt = 0; ai.seg = 0;
  ai.v = clamp(Hd * rnd(1.25, 1.7), 60 * s.k, 1200 * s.k) * (kind === 'word' ? 0.85 : 1);
  ai.R = s.R0 * rnd(0.9, 1.12);
  return true;
}
function aiStep(s, f) {
  const ai = s.ai, dt = f.dt;
  if (ai.wait > 0) { ai.wait -= dt; return; }
  if (!ai.ops) { planDoodle(s, f); return; }
  if (ai.oi >= ai.ops.length) { ai.ops = null; ai.wait = rnd(5, 11); return; }
  const op = ai.ops[ai.oi];
  if (ai.ph === 0) {
    ai.tt += dt; if (ai.tt < op.pre) return;
    ai.ph = 1; ai.tt = 0; ai.u = 0; ai.seg = 0;
    if (op.k === 2) { wipe(s, op.x, op.y, op.x, op.y, ai.R * 0.85, rnd(5, 9)); ai.down = true; ai.x = op.x; ai.y = op.y; }
    else { strokeBegin(s, op.X[0], op.Y[0]); strokeSeg(s, op.X[0], op.Y[0], op.X[0], op.Y[0], ai.R, rnd(6, 11)); ai.down = true; ai.x = op.X[0]; ai.y = op.Y[0]; }
    return;
  }
  if (op.k === 2) { ai.tt += dt; if (ai.tt > 0.14) { ai.down = false; ai.oi++; ai.ph = 0; ai.tt = 0; } return; }
  const len = op.len, u0 = ai.u, e = Math.min(1, 0.35 + 0.65 * Math.min(u0, len - u0) / Math.max(0.5, Math.min(len * 0.15, ai.v * 0.12)));
  const u1 = Math.min(len, u0 + ai.v * e * dt);
  const X = op.X, Y = op.Y, L = op.L, hold = rnd(6, 11);
  let k = ai.seg, px = ai.x, py = ai.y;
  while (k < L.length - 1 && L[k + 1] <= u1) { k++; strokeSeg(s, px, py, X[k], Y[k], ai.R, hold); px = X[k]; py = Y[k]; }
  if (k < L.length - 1) { const w = (u1 - L[k]) / Math.max(1e-6, L[k + 1] - L[k]), nx = X[k] + (X[k + 1] - X[k]) * w, ny = Y[k] + (Y[k + 1] - Y[k]) * w; strokeSeg(s, px, py, nx, ny, ai.R, hold); px = nx; py = ny; }
  ai.seg = k; ai.u = u1; ai.x = px; ai.y = py;
  if (u1 >= len) { ai.down = false; strokeEnd(s); ai.oi++; ai.ph = 0; ai.tt = 0; }
}

/* ════════════ 文字貼圖（提示、手指粗細）：2D canvas 畫好再上傳 ════════════ */
function textTex(gl, tex, str, px, bar) {
  const cv = textTex.cv || (textTex.cv = document.createElement('canvas')), ctx = cv.getContext('2d', { willReadFrequently: true });
  const font = `600 ${px}px "Segoe UI", "Microsoft JhengHei", "Noto Sans TC", "PingFang TC", sans-serif`;
  ctx.font = font;
  const tw = Math.ceil(ctx.measureText(str).width), pad = Math.ceil(px * 0.6), barW = bar ? Math.round(px * 0.55 * 7 + px * 0.5) : 0;
  const w = tw + pad * 2 + barW, h = Math.ceil(px * 1.5) + pad * 2;
  cv.width = w; cv.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = px * 0.3; ctx.shadowOffsetY = px * 0.05;
  ctx.fillStyle = 'rgba(236,240,250,0.96)';
  ctx.fillText(str, pad, h / 2);
  if (bar) { const bw = px * 0.42, gap = px * 0.13, x0 = pad + tw + px * 0.4; for (let i = 0; i < 7; i++) { ctx.fillStyle = i < bar ? 'rgba(236,240,250,0.96)' : 'rgba(236,240,250,0.3)'; ctx.fillRect(x0 + i * (bw + gap), h / 2 - px * 0.3, bw, px * 0.6); } }
  // 先把像素讀回來再上傳（直接把 canvas 丟給 texImage2D 偶爾會拿到還沒畫好的空白）；全透明就回報 ok: false，呼叫端過一下再試
  const img = ctx.getImageData(0, 0, w, h), px8 = img.data;
  let any = 0; for (let i = 3; i < px8.length; i += 4) if (px8[i]) { any = 1; break; }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px8);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { w, h, ok: any > 0 && tw > px };
}

/* ════════════ 註冊 ════════════ */
const FS_MIN = 0.5, FS_MAX = 2.2;
// 釋放 GPU 資源（換桌布、縮放後重新 init、context 掉了再回來都會用到；掉過的 context 裡的舊物件不能刪，先問過）
function disposeAll(s) {
  const gl = s.gl; if (!gl || !s.P) return;
  try {
    // 不用 gl.isTexture() 之類的判斷：還沒綁定過的貼圖（提示文字沒畫過）它會回 false，就漏掉不刪了；刪已經刪過的物件沒有錯誤
    if (!gl.isContextLost()) {
      for (const k in s.P) if (s.P[k] && s.P[k].p) gl.deleteProgram(s.P[k].p);
      for (const k in s.tex) if (s.tex[k]) gl.deleteTexture(s.tex[k]);
      for (const k in s.fbo) if (s.fbo[k]) gl.deleteFramebuffer(s.fbo[k]);
      for (const k in s.buf) if (s.buf[k]) gl.deleteBuffer(s.buf[k]);
      if (s.quadBuf) gl.deleteBuffer(s.quadBuf);
    }
  } catch (e) { /* context 可能已經沒了 */ }
  s.P = null; s.tex = null; s.fbo = null; s.buf = null; s.quadBuf = null; s.ok = false;
}
// step 4：同一張雜訊每 4 像素取一點的 64×64 小版本（1/4 解析度的 pass 用它，取樣才不會在快取裡跳來跳去）
function mkNoiseTex(gl, step = 1) {
  const N = 256 / step, d = new Uint8Array(N * N * 4);
  const vn = (x, y, P) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), h = (a, b) => hsh(((a % P) + P) % P, ((b % P) + P) % P + P * 7); return (h(i, j) * (1 - su) + h(i + 1, j) * su) * (1 - sv) + (h(i, j + 1) * (1 - su) + h(i + 1, j + 1) * su) * sv; };
  for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
    const o = (yy * N + xx) * 4, x = xx * step, y = yy * step;
    d[o] = Math.round(vn(x / 4, y / 4, 64) * 255); d[o + 1] = Math.round(vn(x / 16, y / 16, 16) * 255);
    d[o + 2] = hsh(x * 3 + 1, y * 7 + 2) > 0.996 ? 255 : 0; d[o + 3] = Math.round(hsh(x + 11, y + 13) * 255);
  }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return t;
}
const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const UNIT = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);   // 0..1 的四邊形（水珠 pass 的每一格）
// 128×128 的亂數貼圖（水珠每格有沒有、位置、大小）：每個位元組的高 4 位元是這一格（小顆）的亂數，低 4 位元是它所在的大格子（2×2 小格）的；
// 一次 NEAREST 取樣就有兩層各四個亂數（REPEAT；128 是偶數，大格子繞回去也對得上）
function mkRandTex(gl) {
  const N = 128, d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let c = 0; c < 4; c++) d[(y * N + x) * 4 + c] = (Math.floor(hsh(x * 7 + c * 131 + 3, y * 13 + 101) * 16) << 4) | Math.floor(hsh((x >> 1) * 7 + c * 131 + 5, (y >> 1) * 13 + 211) * 16);
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return t;
}
function pot(n) { let p = 1; while (p * 2 <= n) p *= 2; return n > p * 1.4142 && p < 4096 ? p * 2 : p; }   // 最接近的 2 的冪（對數尺度）
// 建立所有 GPU 資源、畫一次窗外的景、把霧的場初始化（含開場的舊塗鴉／水痕）。失敗就丟例外（init 會接住）
function initGL(s, f) {
  const gl = s.gl, W = s.W, H = s.H;
  s.isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  s.HE = Math.min(H, W * 9 / 16); s.k = s.HE / 1440;
  s.scene = SCENES[f.p.scene] ? f.p.scene : 'city'; s.cf = SCENES[s.scene]; s.cf.drops = s.scene === 'rain' ? 1.6 : s.scene === 'snow' ? 0.7 : 1;
  // 著色器（一個一個記進 s.P：中途失敗時 disposeAll 才放得掉已建立的）
  const P = s.P = {};
  P.batch = mkProg(gl, VS_BATCH, FS_BATCH, 'batch'); P.field = mkProg(gl, VS_QUAD, FS_FIELD, 'field'); P.cap = mkProg(gl, VS_CAP, FS_CAP, 'cap');
  P.der = mkProg(gl, VS_QUAD, FS_DERIVE, 'derive'); P.fogi = mkProg(gl, VS_QUAD, FS_FOGI, 'fogi'); P.comp = mkProg(gl, VS_QUAD, FS_COMP, 'comp');
  P.tgt = mkProg(gl, VS_QUAD, FS_TGT, 'target');
  // 筆畫邊緣的水珠（縮圖不畫）：WebGL2 每個 32 像素的格子一個 instance，WebGL1 整張畫
  s.inst = !s.thumb && s.isGL2 && typeof gl.drawArraysInstanced === 'function' && typeof gl.vertexAttribDivisor === 'function';
  if (!s.thumb) { P.tile = mkProg(gl, VS_QUAD, FS_TILE, 'tile'); P.beads = mkProg(gl, s.inst ? VS_BEADS : VS_QUAD, FS_BEADS, 'beads'); }
  s.quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, s.quadBuf); gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
  // 貼圖與 FBO：窗外的景（有 mipmap；WebGL1 要 2 的冪）、霧的場 ×2、目標濃度、法向量、散景、霧裡的景、有邊緣的格子
  const sw = s.isGL2 ? W : pot(W), sh = s.isGL2 ? H : pot(H);
  s.sw = sw; s.sh = sh;
  s.fmt = pickFieldFmt(gl, s.isGL2);
  const div = s.thumb ? 2 : 4;
  s.fw = Math.max(8, Math.ceil(W / div)); s.fh = Math.max(8, Math.ceil(H / div));
  const T = s.tex = {}, F = s.fbo = {};
  T.noise = mkNoiseTex(gl); T.noise4 = mkNoiseTex(gl, 4); T.hint = gl.createTexture(); T.label = gl.createTexture();
  T.scene = mkTex(gl, sw, sh, { mip: true, ifmt: s.isGL2 ? gl.RGBA8 : gl.RGBA }); F.scene = mkFbo(gl, T.scene);
  T.der = mkTex(gl, s.fw, s.fh, {}); F.der = mkFbo(gl, T.der);
  T.bokeh = mkTex(gl, s.fw, s.fh, {}); F.bokeh = mkFbo(gl, T.bokeh);
  T.fogi = mkTex(gl, s.fw, s.fh, {}); F.fogi = mkFbo(gl, T.fogi);
  T.tgt = mkTex(gl, s.fw, s.fh, {}); F.tgt = mkFbo(gl, T.tgt);
  T.fA = mkTex(gl, s.fw, s.fh, s.fmt); F.fA = mkFbo(gl, T.fA); T.fB = mkTex(gl, s.fw, s.fh, s.fmt); F.fB = mkFbo(gl, T.fB);
  if (!F.fA || !F.fB) {   // 半精度不能當 render target：退回 8 位元
    for (const n of ['fA', 'fB']) { if (F[n]) gl.deleteFramebuffer(F[n]); gl.deleteTexture(T[n]); }
    s.fmt = { ifmt: gl.RGBA, type: gl.UNSIGNED_BYTE, name: 'rgba8' };
    T.fA = mkTex(gl, s.fw, s.fh, s.fmt); T.fB = mkTex(gl, s.fw, s.fh, s.fmt); F.fA = mkFbo(gl, T.fA); F.fB = mkFbo(gl, T.fB);
  }
  if (!s.thumb) {   // 有邊緣的格子：每格 = 8 個場的格子（全解析度時 32 像素）
    s.tilePx = 8 * div; s.tw = Math.ceil(W / s.tilePx); s.th = Math.ceil(H / s.tilePx);
    T.tile = mkTex(gl, s.tw, s.th, { nearest: true }); F.tile = mkFbo(gl, T.tile);
    T.rand = mkRandTex(gl);
    if (!F.tile) throw new Error('framebuffer incomplete');
  }
  if (!F.scene || !F.fA || !F.fB || !F.der || !F.bokeh || !F.fogi || !F.tgt) throw new Error('framebuffer incomplete');
  s.dither = s.fmt.name === 'rgba8' ? 1 / 255 : 1 / 1024;
  // 批次（靜態的景一開始就給夠大，少幾次搬家）
  s.sb = new Batch(s.thumb ? 24576 : 73728); s.db = new Batch(s.thumb ? 9000 : 24000); s.gb = new Batch(s.thumb ? 9000 : 24000); s.bk = new Batch(6000); s.ov = new Batch(64);
  s.db.fixed = s.gb.fixed = s.bk.fixed = s.ov.fixed = true;
  s.buf = { sb: gl.createBuffer(), db: gl.createBuffer(), gb: gl.createBuffer(), bk: gl.createBuffer(), ov: gl.createBuffer(), cap: gl.createBuffer() };
  s.segs = new Float32Array(MAX_SEG * 6 * SEG_F); s.nseg = 0;
  for (const [n, b] of [['db', s.db], ['gb', s.gb], ['bk', s.bk], ['ov', s.ov]]) { gl.bindBuffer(gl.ARRAY_BUFFER, s.buf[n]); gl.bufferData(gl.ARRAY_BUFFER, b.cap * VF * 4, gl.DYNAMIC_DRAW); }
  gl.bindBuffer(gl.ARRAY_BUFFER, s.buf.cap); gl.bufferData(gl.ARRAY_BUFFER, s.segs.byteLength, gl.DYNAMIC_DRAW);
  if (!s.thumb) {   // 水珠 pass 的幾何：一個 0..1 的四邊形（6 個頂點）＋ 每個格子的編號（instance 屬性）
    s.buf.unit = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, s.buf.unit); gl.bufferData(gl.ARRAY_BUFFER, UNIT, gl.STATIC_DRAW);
    if (s.inst) { const ids = new Float32Array(s.tw * s.th); for (let i = 0; i < ids.length; i++) ids[i] = i; s.buf.inst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, s.buf.inst); gl.bufferData(gl.ARRAY_BUFFER, ids, gl.STATIC_DRAW); }
  }
  // 窗外的景：畫一次（WebGL2：先畫在 4× 多重取樣的 renderbuffer 再 blit 過去，斜邊才不會一階一階的；只在 init 花一次）
  s.lights = []; s.dyn = {}; s.refl = [0, 0, 0, 1, 0];
  s.cf.build(s, f);
  s.__sbN = s.sb.n;
  gl.useProgram(P.batch.p); gl.uniform1f(P.batch.u.uFogAtt, 0); gl.uniform1f(P.batch.u.uDither, 2 / 255);
  let ms = null;
  if (s.isGL2) {
    try {
      const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) | 0);
      if (samples > 1) {
        const rb = gl.createRenderbuffer(), fb = gl.createFramebuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, sw, sh);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE && gl.getError() === gl.NO_ERROR) {
          gl.viewport(0, 0, sw, sh); gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
          drawBatch(gl, P.batch, s.sb, s.buf.sb, 2, [W, H]);
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, F.scene);
          gl.blitFramebuffer(0, 0, sw, sh, 0, 0, sw, sh, gl.COLOR_BUFFER_BIT, gl.NEAREST);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          ms = { samples, ok: gl.getError() === gl.NO_ERROR };
        } else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.getError(); }
        gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb);
      }
    } catch (e) { ms = null; gl.getError(); }
  }
  if (!ms || !ms.ok) {   // 沒有多重取樣（WebGL1，或 blit 被拒）：直接畫
    gl.bindFramebuffer(gl.FRAMEBUFFER, F.scene); gl.viewport(0, 0, sw, sh); gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    drawBatch(gl, P.batch, s.sb, s.buf.sb, 2, [W, H]);
  }
  s.msaa = ms && ms.ok ? ms.samples : 0;
  gl.bindTexture(gl.TEXTURE_2D, T.scene); gl.generateMipmap(gl.TEXTURE_2D);
  s.sb = null; gl.deleteBuffer(s.buf.sb); s.buf.sb = null;   // 靜態幾何只畫這一次：貼圖有了就不用留著 2.6 MB 的頂點
  // 手指、玩家、示範、水珠
  s.seed = rnd(100); s.cur = 0; s.t0 = f.t; s.randOff = [2 * rint(0, 63), 2 * rint(0, 63)];   // 亂數貼圖的偏移（偶數格，大格子才對得上）
  s.R0 = clamp(0.034 * s.HE, 5, 220); s.fs = 1; s.showFs = 0; s.restT = 1; s.sq = 0;
  s.drops = []; s.beads = []; s.nt = rnd(2, 6); s.wet = 0.6; s.wetAt = rnd(1, 1.8);
  s.stk = { on: false, len: 0, lx: 0, ly: 0, R: 1 };
  s.user = { down: false, x: 0, y: 0 };
  s.ai = { ops: null, oi: 0, ph: 0, tt: 0, u: 0, seg: 0, x: W / 2, y: H / 2, down: false, wait: 0.8, recent: [], boxes: [], v: 20, R: s.R0 };
  s.wasPlaying = false; s.hintA = 0; s.hint = { lang: '', w: 0, h: 0, ok: false, retry: 0 }; s.label = { lv: -1, lang: '', w: 0, h: 0, ok: false, retry: 0 };
  // 開場：玻璃上已經有一個被霧蓋掉一半的舊塗鴉（遮罩 R）和一兩條水痕（遮罩 G）。畫成加法的遮罩：重疊的膠囊只算一次，
  // 霧的場初始化時再乘上去（縮圖沒有舊塗鴉：示範的小塗鴉馬上就會開始畫）
  s.nseg = 0;
  if (!s.thumb && planDoodle(s, f)) {
    const ai = s.ai; ai.boxes[0].t -= 35;
    for (const op of ai.ops) {
      if (op.k === 2) seg(s, op.x, op.y, op.x, op.y, ai.R * 0.85, 1, 0, 0, 0);
      else for (let q = 1; q < op.X.length; q++) seg(s, op.X[q - 1], op.Y[q - 1], op.X[q], op.Y[q], ai.R, 1, 0, 0, 0);
    }
    ai.ops = null;
  }
  for (let k = rint(1, 2); k > 0; k--) { let x = rnd(W * 0.1, W * 0.9), y = rnd(0, H * 0.4); const r = (3 + rnd(0, 2)) * s.k; while (y < H) { const ny = y + rnd(10, 24) * s.k, nx = x + rnd(-0.5, 0.5) * (Math.random() < 0.15 ? 14 : 3) * s.k; seg(s, x, y, nx, ny, r, 0, 1, 0, 0); x = nx; y = ny; if (Math.random() < 0.012) break; } }
  gl.bindFramebuffer(gl.FRAMEBUFFER, F.der); gl.viewport(0, 0, s.fw, s.fh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  if (s.nseg) drawCaps(gl, s, 1);
  // 霧的目標濃度圖，再把場初始化（F = 目標濃度 × 遮罩）
  s.tgtT = 0; drawTgt(gl, s, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, F.fA); gl.viewport(0, 0, s.fw, s.fh); gl.disable(gl.BLEND);
  const PF = P.field; gl.useProgram(PF.p);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.der); gl.uniform1i(PF.u.uMask, 2);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.tgt); gl.uniform1i(PF.u.uTgt, 1);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.fB); gl.uniform1i(PF.u.uPrev, 0);
  gl.uniform1f(PF.u.uInit, 1); gl.uniform1f(PF.u.uT, 0); gl.uniform1f(PF.u.uDt, 0); gl.uniform1f(PF.u.uDither, 0); gl.uniform2f(PF.u.uTexel, 1 / s.fw, 1 / s.fh);
  quad(gl, PF, s);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  s.__path = `${s.isGL2 ? 'webgl2' : 'webgl1'} field=${s.fmt.name} ${s.fw}x${s.fh} scene=${sw}x${sh}${s.msaa ? ' msaa' + s.msaa : ''}${s.thumb ? '' : s.inst ? ' beads=inst' : ' beads=full'}`;
}
// 畫一次全螢幕四邊形（program 的 aPos）
function quad(gl, P, s) { gl.bindBuffer(gl.ARRAY_BUFFER, s.quadBuf); gl.enableVertexAttribArray(P.a.aPos); gl.vertexAttribPointer(P.a.aPos, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(P.a.aPos); }
// 霧的目標濃度圖（init 一次，之後每 2 秒）
function drawTgt(gl, s, t) {
  const P = s.P.tgt; gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo.tgt); gl.viewport(0, 0, s.fw, s.fh); gl.disable(gl.BLEND);
  gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex.noise); gl.uniform1i(P.u.uNoise, 0);
  gl.uniform1f(P.u.uT, t); gl.uniform1f(P.u.uSeed, s.seed); gl.uniform1f(P.u.uAspect, s.W / s.H); gl.uniform3f(P.u.uFogP, s.cf.fog[0], s.cf.fog[1], s.cf.fog[2]);
  quad(gl, P, s);
}
A({ id: 'px-fog', name: '起霧的玻璃・影像', cat: '寫實', pixel: 'gl', theme: 'mono', hue: true, interactive: true, sound: true,
  desc: '真實影像版的起霧窗玻璃：按住滑鼠用手指在霧上畫畫，擦開的地方看得見窗外；滾輪調整手指粗細',
  params: { scene: 'city' },
  variants: [
    { id: 'snow', name: '雪地清晨', desc: '清晨的雪林與小木屋在霧玻璃後面：按住滑鼠畫畫，滾輪調整手指粗細', params: { scene: 'snow' } },
    { id: 'rain', name: '雨夜街角', desc: '下雨的街角，霓虹和車燈在霧裡暈開：按住滑鼠畫畫，水珠會流得比較多', params: { scene: 'rain' } },
  ],
  init(s, f) {
    const gl = f.gl, W = f.w, H = f.h;
    if (s.P && s.gl === gl) disposeAll(s);     // 縮放後重新 init：先把上一次的資源放掉
    s.gl = gl; s.W = W; s.H = H; s.thumb = !!f.thumb; s.ok = false;
    try { initGL(s, f); s.ok = true; }
    catch (e) {   // 著色器編不過、framebuffer 不完整…：放掉已建立的資源，之後每格只清成深色（不丟例外、不每格重試）
      disposeAll(s); s.ok = false;
      if (!s.warned) { s.warned = true; console.error('px-fog: init failed: ' + ((e && e.message) || e)); }
    }
  },
  frame(s, f) {
    const gl = s.gl; if (!gl) return;
    // 共用的縮圖 context 裡別的動畫可能留下各種狀態：每格先歸零我們會依賴的
    if (typeof gl.bindVertexArray === 'function') gl.bindVertexArray(null);
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.STENCIL_TEST);
    gl.colorMask(true, true, true, true); gl.depthMask(true);
    if (!s.ok) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, s.W, s.H); gl.clearColor(0.03, 0.035, 0.06, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    const W = s.W, H = s.H, k = s.k, dt = f.dt, t = f.t - s.t0, m = f.mouse, cf = s.cf;
    const playing = m.idle < 6 || (!!m.down && m.idle < 60);
    if (playing !== s.wasPlaying) {
      if (s.ai.down) { s.ai.down = false; strokeEnd(s); }
      s.ai.ops = null; s.ai.wait = rnd(1.5, 3);
      if (!playing && s.user.down) { s.user.down = false; strokeEnd(s); }
      s.wasPlaying = playing;
    }
    if (playing && m.wheel && Number.isFinite(m.wheel)) { const st = clamp(-m.wheel / 100, -4, 4); s.fs = clamp(s.fs * Math.pow(1.13, st), FS_MIN, FS_MAX); s.showFs = 1.8; }
    if (s.showFs > 0) s.showFs -= dt;
    if (s.sq > 0) s.sq -= dt;
    const R = Math.max(3, s.R0 * s.fs);
    // ── 玩家的手指 ──
    if (playing) {
      const u = s.user, down = !!m.down && m.on, x = m.x, y = m.y;
      let pc = null; for (const c of m.clicks) if (!c.button) pc = c;
      if (down && u.down && pc) { strokeEnd(s); u.down = false; }
      if (down) {
        if (!u.down) {
          const sx = pc ? pc.x : x, sy = pc ? pc.y : y;
          strokeBegin(s, sx, sy); strokeSeg(s, sx, sy, sx, sy, R, rnd(7, 11));
          if (sx !== x || sy !== y) strokeSeg(s, sx, sy, x, y, R, rnd(7, 11));
          s.restT = 1;
        } else if (x === u.x && y === u.y) {
          if ((s.restT -= dt) <= 0) { wipe(s, x, y, x, y, R, rnd(7, 11)); s.restT = 1; }
        } else {
          s.restT = 1;
          strokeSeg(s, u.x, u.y, x, y, R, rnd(7, 11));
          // 手指在玻璃上滑得快時，偶爾「啾」一聲（很小聲，最多每秒 4 次）
          const v = Math.hypot(x - u.x, y - u.y) / Math.max(dt, 1e-3) / (s.HE / 85);
          if (v > 14 && s.sq <= 0 && typeof f.sfx === 'function') { f.sfx('blip', clamp(0.025 + v * 0.0006, 0.025, 0.06), clamp(x / W * 2 - 1, -1, 1), clamp(1.6 + v * 0.008, 1.6, 2.3)); s.sq = rnd(0.25, 0.45); }
        }
        u.x = x; u.y = y; u.down = true;
      } else if (u.down) {   // 放開：最後一段（上一格的位置到放開時的位置）也要擦到，快速一揮才不會只剩一個點
        if (m.on && (x !== u.x || y !== u.y)) strokeSeg(s, u.x, u.y, x, y, R, rnd(7, 11));
        u.down = false; strokeEnd(s); userBox(s, f.t);
      } else if (pc) {   // 按下又放開都在同一格裡：有移動就當一小段筆畫，沒有就是一個指印
        if (m.on && (pc.x !== x || pc.y !== y)) { strokeBegin(s, pc.x, pc.y); strokeSeg(s, pc.x, pc.y, pc.x, pc.y, R, rnd(7, 11)); strokeSeg(s, pc.x, pc.y, x, y, R, rnd(7, 11)); strokeEnd(s); }
        else { strokeBegin(s, pc.x, pc.y); wipe(s, pc.x, pc.y, pc.x, pc.y, R * 0.85, rnd(5, 9)); s.stk.on = false; }
        userBox(s, f.t);
      }
    } else aiStep(s, f);
    dropStep(s, f);
    // ── 會動的東西 ──
    const db = s.db, gb = s.gb, bk = s.bk; db.clear(); gb.clear(); bk.clear(); bk.blend(1); gb.blend(1);
    for (const L of s.lights) {
      let I = L.I;
      if (L.fl) { I *= 0.85 + 0.15 * Math.sin(t * 7 + L.ph) * Math.sin(t * 13.1 + L.ph); if (hsh(Math.floor(t * 3 + L.ph), 5) < 0.06) I *= 0.25; }
      else if (L.pulse) I *= 0.94 + 0.06 * Math.sin(t * 1.3 + L.ph);
      bk.disc(L.x, L.y, L.R, L.R, L.c, I, 3);
    }
    cf.dyn(s, f, db, gb, bk);
    // ── GPU：1 場更新 → 2 膠囊乘進去 → 3 法向量/邊緣/水珠高度 → 4 散景 → 5 霧裡的景 → 6 合成 → 7 邊緣的水珠 → 8 會動的東西 → 9 文字 ──
    if ((s.tgtT -= dt) <= 0) { s.tgtT = 2; drawTgt(gl, s, t); }   // 目標濃度圖每 2 秒飄一下就夠
    const src = s.cur ? s.tex.fB : s.tex.fA, dstF = s.cur ? s.fbo.fA : s.fbo.fB, dstT = s.cur ? s.tex.fA : s.tex.fB; s.cur ^= 1;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstF); gl.viewport(0, 0, s.fw, s.fh); gl.disable(gl.BLEND);
    let P = s.P.field; gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(P.u.uPrev, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, s.tex.tgt); gl.uniform1i(P.u.uTgt, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, s.tex.der); gl.uniform1i(P.u.uMask, 2);   // 只有 init 會讀它，但取樣器得綁著完整的貼圖
    gl.uniform1f(P.u.uInit, 0); gl.uniform1f(P.u.uT, t); gl.uniform1f(P.u.uDt, dt); gl.uniform1f(P.u.uDither, s.dither); gl.uniform2f(P.u.uTexel, 1 / s.fw, 1 / s.fh);
    quad(gl, P, s);
    if (s.nseg) drawCaps(gl, s, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo.der);
    P = s.P.der; gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dstT); gl.uniform1i(P.u.uField, 0); gl.uniform2f(P.u.uTexel, 1 / s.fw, 1 / s.fh);
    quad(gl, P, s);
    gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo.bokeh); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    P = s.P.batch; gl.useProgram(P.p); gl.uniform1f(P.u.uFogAtt, 0); gl.uniform1f(P.u.uDither, 0);
    drawBatch(gl, P, bk, s.buf.bk, 1, [W, H]);
    // 霧裡的景（1/4 解析度；alpha 帶著霧濃度）
    gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo.fogi); gl.disable(gl.BLEND);
    P = s.P.fogi; gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex.scene); gl.uniform1i(P.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dstT); gl.uniform1i(P.u.uField, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, s.tex.bokeh); gl.uniform1i(P.u.uBokeh, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, s.tex.noise); gl.uniform1i(P.u.uNoise, 3);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, s.tex.noise4); gl.uniform1i(P.u.uNoise4, 4);
    gl.uniform1f(P.u.uLod0, Math.log2(W / s.fw)); gl.uniform1f(P.u.uBokehK, cf.bokeh); gl.uniform1f(P.u.uLift, cf.lift); gl.uniform1f(P.u.uT, t); gl.uniform1f(P.u.uGrain, cf.grain); gl.uniform1f(P.u.uSeed, s.seed); gl.uniform2f(P.u.uRes, W, H);
    gl.uniform4f(P.u.uRefl, s.refl[0], s.refl[1], s.refl[2], s.refl[3]);
    gl.uniform3f(P.u.uFogTint, cf.tint[0], cf.tint[1], cf.tint[2]); gl.uniform3f(P.u.uWarm, cf.warm[0], cf.warm[1], cf.warm[2]);
    quad(gl, P, s);
    // 有筆畫邊緣的格子（水珠只畫那裡）
    if (!s.thumb) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, s.fbo.tile); gl.viewport(0, 0, s.tw, s.th);
      P = s.P.tile; gl.useProgram(P.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex.der); gl.uniform1i(P.u.uDer, 0);
      gl.uniform2f(P.u.uTexel, 1 / s.fw, 1 / s.fh); gl.uniform2f(P.u.uTileScale, s.tw * s.tilePx / W, s.th * s.tilePx / H);
      quad(gl, P, s);
    }
    // 合成到畫布
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.BLEND);
    P = s.P.comp; gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex.scene); gl.uniform1i(P.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, s.tex.der); gl.uniform1i(P.u.uDer, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, s.tex.fogi); gl.uniform1i(P.u.uFogI, 3);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, s.tex.noise); gl.uniform1i(P.u.uNoise, 4);
    gl.uniform2f(P.u.uRes, W, H); gl.uniform1f(P.u.uT, t); gl.uniform1f(P.u.uGrain, cf.grain); gl.uniform1f(P.u.uThumb, s.thumb ? 1 : 0); gl.uniform1f(P.u.uSeed, s.seed);
    gl.uniform3f(P.u.uGrade, cf.grade[0], cf.grade[1], cf.grade[2]); gl.uniform4f(P.u.uRefl, s.refl[0], s.refl[1], s.refl[2], s.refl[3]); gl.uniform1f(P.u.uReflC, s.refl[4]);
    const ringA = s.showFs > 0 && playing ? Math.min(1, s.showFs / 0.5) : 0;
    gl.uniform4f(P.u.uRing, m.x, H - m.y, R, ringA);   // 著色器的 y 向上
    quad(gl, P, s);
    // 筆畫邊緣的水珠（疊在合成上；只有有邊緣的格子）
    if (!s.thumb) {
      P = s.P.beads; gl.useProgram(P.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex.scene); gl.uniform1i(P.u.uScene, 0);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, s.tex.der); gl.uniform1i(P.u.uDer, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, s.tex.fogi); gl.uniform1i(P.u.uFogI, 3);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, s.tex.rand); gl.uniform1i(P.u.uRand, 4);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, s.tex.tile); gl.uniform1i(P.u.uTile, 5);
      const tsx = s.tw * s.tilePx / W, tsy = s.th * s.tilePx / H;
      gl.uniform2f(P.u.uRes, W, H); gl.uniform2f(P.u.uTileScale, tsx, tsy); gl.uniform2f(P.u.uRandOff, s.randOff[0], s.randOff[1]); gl.uniform1f(P.u.uTileChk, s.inst ? 0 : 1); gl.uniform3f(P.u.uGrade, cf.grade[0], cf.grade[1], cf.grade[2]);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (s.inst) {
        gl.uniform2f(P.u.uTiles, s.tw, s.th); gl.uniform2f(P.u.uTileUv, tsx / s.tw, tsy / s.th);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.buf.unit); gl.enableVertexAttribArray(P.a.aPos); gl.vertexAttribPointer(P.a.aPos, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.buf.inst); gl.enableVertexAttribArray(P.a.aTile); gl.vertexAttribPointer(P.a.aTile, 1, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(P.a.aTile, 1);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, s.tw * s.th);
        gl.vertexAttribDivisor(P.a.aTile, 0); gl.disableVertexAttribArray(P.a.aTile); gl.disableVertexAttribArray(P.a.aPos);
      } else quad(gl, P, s);
      gl.disable(gl.BLEND);
    }
    // 會動的東西（在霧裡看不見：依霧濃度淡掉）
    P = s.P.batch; gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, dstT); gl.uniform1i(P.u.uField, 3); gl.uniform2f(P.u.uInvRes, 1 / W, 1 / H); gl.uniform1f(P.u.uFogAtt, 1); gl.uniform1f(P.u.uDither, 0);
    drawBatch(gl, P, db, s.buf.db, 1, [W, H]);
    drawBatch(gl, P, gb, s.buf.gb, 1, [W, H]);
    // ── 文字：示範模式的提示（底下中間）、滾輪時的手指粗細（右上） ──
    const ov = s.ov; ov.clear();
    s.hintA += ((playing || s.thumb) ? -dt * 1.5 : dt * 0.8); s.hintA = clamp(s.hintA, 0, 1);
    gl.uniform1f(P.u.uFogAtt, 0);
    if (s.hintA > 0.01) {
      const px = Math.max(13, Math.round(s.HE / 38));
      if (s.hint.lang !== f.lang || s.hint.px !== px || (!s.hint.ok && f.t >= s.hint.retry)) {
        let str = tr(f, '按住滑鼠在玻璃上畫畫・滾輪調整手指粗細', 'Hold the mouse button and draw on the glass · Scroll to change finger size');
        const d = textTex(gl, s.tex.hint, str, px, 0);
        if (d.w > W * 0.94) { str = tr(f, '按住滑鼠在玻璃上畫畫', 'Hold the mouse button and draw'); Object.assign(d, textTex(gl, s.tex.hint, str, px, 0)); }
        s.hint = { lang: f.lang, px, w: d.w, h: d.h, ok: d.ok, retry: f.t + 1 };
      }
      if (s.hint.ok) {
        ov.tex((W - s.hint.w) / 2, H - s.hint.h - px * 0.6, s.hint.w, s.hint.h, s.hintA * 0.92);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, s.tex.hint); gl.uniform1i(P.u.uTex, 2);
        drawBatch(gl, P, ov, s.buf.ov, 1, [W, H]); ov.clear();
      }
    }
    if (ringA > 0) {
      const lv = clamp(Math.round(Math.log(s.fs / FS_MIN) / Math.log(FS_MAX / FS_MIN) * 6) + 1, 1, 7), px = Math.max(12, Math.round(s.HE / 44));
      if (s.label.lv !== lv || s.label.lang !== f.lang || s.label.px !== px || (!s.label.ok && f.t >= s.label.retry)) { const d = textTex(gl, s.tex.label, tr(f, '手指粗細', 'Finger size'), px, lv); s.label = { lv, lang: f.lang, px, w: d.w, h: d.h, ok: d.ok, retry: f.t + 0.5 }; }
      if (s.label.ok) {
        ov.tex(W - s.label.w - px * 0.6, px * 0.4, s.label.w, s.label.h, ringA * 0.95);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, s.tex.label); gl.uniform1i(P.u.uTex, 2);
        drawBatch(gl, P, ov, s.buf.ov, 1, [W, H]);
      }
    }
    gl.disable(gl.BLEND); gl.activeTexture(gl.TEXTURE0);
  },
  dispose(s, f) { disposeAll(s); },
});
// 英文介面的名稱與說明在 zz-i18n-en.js（tools/i18n-build.js 產生；來源 scratchpad/i18n/en-40-px-fog.json）
})();
