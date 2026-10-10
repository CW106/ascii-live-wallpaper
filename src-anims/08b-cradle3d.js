// 3D 牛頓擺：逐格光線投射的立體金屬牛頓擺（透視相機、鏡面反射、陰影、輪廓線；可以用滑鼠把球拉起來再放手）
(() => {
  // 明暗字元（由暗到亮）
  const RAMP = ' .:-=+*#%@';
  const NR = RAMP.length - 1;
  const BSL = String.fromCharCode(92);
  const MAC = String.fromCharCode(0x203e); // 上橫線（字格頂端的一槓；用 ‾ 而不是 ¯，Cascadia Mono 裡它和 ─、_ 一樣是連續的線）
  const HLN = String.fromCharCode(0x2500); // 細橫線（字格正中間、連續不斷）
  const sstep = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
  // 物件編號（id 緩衝）：0..8 是球，20 是底座，21..26 是兩根橫桿和四根立柱
  const ID_BASE = 20, ID_ROD = 21;
  const TH_LIM = 1.45;      // 自由的球最多擺到這個角度（約 83°）
  const ECAP_TH = 1.38;     // 自由的球往外擺的能量上限（換成角度）
  const REL_TH = 1.3;       // 放手、輕推時給的速度最多只夠擺到這個角度
  // 畫面上的文字：英文介面（f.lang === 'en'）顯示英文，其他情況照舊顯示中文
  const tr = (f, zh, en) => (f.lang === 'en' ? en : zh);
  // 音效：每一次真的相撞只響一聲 f.sfx('clack')（大鋼球的「鏘」），位置是相撞的那個接觸點（3D；兩邊幾乎同時撞到就依接近速度取兩者之間）
  const SND_AGE = 20;       // 這一對在 20 個子步（20 ms）內碰過（衝量正在一路傳過去、被拿著的球一直推著、靜止時互相壓著）：不算新的相撞
  const SND_FUSE = 5;       // 一聲開始後至少收 5 ms 的新接觸才發出（兩邊幾乎同時撞進來、只差一兩個子步時，就算跨到下一格也併成同一聲）
  const SND_WIN = 30;       // 一聲開始後 30 ms 內的新接觸都算同一下：還沒發出就併進去（位置依接近速度加權、音量看最快的），已經發出就不再出聲，
  const SND_LOUD = 1.5;     // 除非接近速度是這一聲的 1.5 倍以上：那是另一下更重的相撞（例如 2+1 時兩邊慢慢錯開，重的那一下晚到），自己響一聲
  const SND_MIN = 0.05;     // 接近速度不到示範時單顆球的 5%：不出聲
  const SND_MIN_HELD = 0.2; // 其中一顆被拿著（滑鼠或示範的手）：要 20% 以上才出聲（拿著球推一整排時，滑鼠一頓一頓的，球會一直輕輕彈開又靠回來）
  const SND_D = 1.3, SND_K = 0.16;   // 聽起來的位置：鏡頭看著的那一點在聽者正前方 1.3 公尺，1 單位（球的半徑）= 0.16 公尺
  // 滑鼠：按下時游標離球心不到 PICK_R 倍球的視半徑就抓得到（正好點在球上的優先）；按住右鍵拖曳轉動視角
  const PICK_R = 1.6;
  const PIT_MIN = 0.02, PIT_MAX = 1.05;   // 右鍵拖曳時鏡頭的仰角範圍（弧度）：最低幾乎平視（不會跑到底座下面），最高約 60°（不會翻過頭頂）
  const UV_HOLD = 20;                     // 最後一次操作後，轉過的視角再留 20 秒，然後慢慢回到示範的鏡頭路線
  const RING_GAP = 0.16, RING_MIN = 1.2, RING_MAX = 2.4;   // 「會抓到這顆」的圓圈在球的輪廓外面幾格（球的視半徑的 16%，限制在 1.2–2.4 格）
  const RIM_CH = '()_/|' + BSL + MAC + HLN;                  // 球的輪廓用到的字元（著色的球面只用 RAMP 裡的字元）

  // 線條字元：phi 是線段在畫面上的方向角（度，0 = 水平，往右上為正），off 是線在格子裡偏離中心的位置（-0.5..0.5，往下／往右為正）
  // vert = 這條線是一列一格（off 是左右位置）；否則是一欄一格（off 是上下位置）；curved = 球的輪廓
  function lineCh(phi, off, vert, curved, side) {
    const a = phi > 90 ? 180 - phi : phi;
    if (a < 34 && !vert) return off < -0.2 ? MAC : off < 0.22 ? HLN : '_';
    if (a < 64.5 && !vert) return off > 0.12 ? '_' : phi < 90 ? '/' : BSL;   // 45° 左右：一列兩格 _/ 或 \_
    if (a < 73) return phi < 90 ? '/' : BSL;
    return curved ? (side < 0 ? '(' : ')') : '|';
  }

  // ── 物理：n 個單擺，固定 1 ms 子步（速度 Verlet），鄰球之間用衝量處理彈性碰撞 ──
  const H_STEP = 0.001;
  function energy(s) {
    let e = 0;
    for (let i = 0; i < s.n; i++) e += 0.5 * s.om[i] * s.om[i] + s.w2 * (1 - Math.cos(s.th[i]));
    return e;
  }
  // 速度層的碰撞：把「幾乎碰到」（間隙以內）也當成接觸，同時發生的碰撞才會依序傳遞（像真的牛頓擺那樣 2+1 → 1+2）
  function contacts(s) {
    const n = s.n, th = s.th, om = s.om, kin = s.kin, L = s.L, L2 = L * L, px = s.px, Dc = 2 * s.r + s.ctol, D2 = Dc * Dc;
    // 音效（只看、不改變物理）：這個子步一開始就已經在互相接近、而且最近沒碰過的那幾對 = 新的相撞；
    // 接觸點依接近速度加權加起來（兩邊同時撞進來就是中間），交給 sndHit
    const age = s.cAge, hit = s.cHit;
    let sv = 0, sx = 0, sy = 0, sw = 0;
    for (let i = 0; i < n - 1; i++) {
      hit[i] = 0;
      const j = i + 1;
      if (age[i] < SND_AGE || (kin[i] && kin[j])) continue;
      const si = Math.sin(th[i]), ci = Math.cos(th[i]), sj = Math.sin(th[j]), cj = Math.cos(th[j]);
      const dx = px[j] + L * sj - px[i] - L * si, dy = L * (ci - cj);
      const d2 = dx * dx + dy * dy;
      if (d2 >= D2) continue;
      const d = Math.sqrt(d2) || 1e-9, nx = dx / d, ny = dy / d;
      const v = L * (ci * nx + si * ny) * om[i] - L * (cj * nx + sj * ny) * om[j];
      if (v < (kin[i] || kin[j] ? s.vMinH : s.vMin)) continue;
      if (v > sv) sv = v;
      sx += v * (px[i] + px[j] + L * (si + sj)) * 0.5; sy += v * (s.Hp - L * (ci + cj) * 0.5); sw += v;
    }
    for (let it = 0; it < 3 * n; it++) {
      let any = false;
      for (let q = 0; q < n - 1; q++) {
        const i = (it & 1) ? n - 2 - q : q, j = i + 1;
        const si = Math.sin(th[i]), ci = Math.cos(th[i]), sj = Math.sin(th[j]), cj = Math.cos(th[j]);
        const dx = px[j] + L * sj - px[i] - L * si, dy = L * (ci - cj);
        const d2 = dx * dx + dy * dy;
        if (d2 >= D2) continue;
        const d = Math.sqrt(d2) || 1e-9, nx = dx / d, ny = dy / d;
        const Ji = L * (ci * nx + si * ny), Jj = L * (cj * nx + sj * ny);
        const wi = kin[i] ? 0 : 1, wj = kin[j] ? 0 : 1;
        const K = (wi * Ji * Ji + wj * Jj * Jj) / L2;
        if (K < 1e-9) continue;
        const vn = Jj * om[j] - Ji * om[i];
        if (vn < 0) {
          let e;
          if (kin[i] || kin[j]) {
            // 一邊被手拿著：被拿著的球推過去不反彈（外側的球會跟著走）；自由的球自己撞上來才彈開
            const vFree = kin[i] ? -Jj * om[j] : Ji * om[i];
            e = vFree > 0.5 ? 0.5 : 0;
          } else e = -vn < s.vrest ? 0 : s.rest;
          const lam = -(1 + e) * vn / K;
          om[i] -= wi * Ji * lam / L2; om[j] += wj * Jj * lam / L2;
          any = true; hit[i] = 1;
        }
      }
      if (!any) break;
    }
    for (let i = 0; i < n - 1; i++) age[i] = hit[i] ? 0 : age[i] < 1e6 ? age[i] + 1 : age[i];
    if (sw > 0) sndHit(s, sv, sx, sy, sw);
    s.evAge++;
  }
  // 這個子步裡的新接觸（v = 最快的接近速度，sx、sy、sw = 依速度加權的接觸點總和）：
  // 距離這一聲開始不到 SND_WIN → 還沒發出就併進去；已經發出、又沒有快到 SND_LOUD 倍 → 屬於這一聲，不出聲；其他 → 新的一聲
  function sndHit(s, v, sx, sy, sw) {
    if (s.evAge <= SND_WIN) {
      if (s.evOpen) { s.evSX += sx; s.evSY += sy; s.evSW += sw; if (v > s.evSV) s.evSV = v; return; }
      if (v <= s.evSV * SND_LOUD) return;
    }
    if (s.evOpen) sndClose(s);
    s.evOpen = 1; s.evAge = 0; s.evSV = v; s.evSX = sx; s.evSY = sy; s.evSW = sw;
  }
  // 這一聲收好了：排進這一格要發出的聲音（每一格畫完前，開始超過 SND_FUSE 的這一聲就收好，由 sndEmit 發出）
  function sndClose(s) {
    s.evOpen = 0;
    if (s.evN < s.evV.length) s.evN++;
    const k = s.evN - 1;
    s.evV[k] = s.evSV; s.evX[k] = s.evSX / s.evSW; s.evY[k] = s.evSY / s.evSW;
  }
  // 發出這一格裡的相撞聲：接觸點（世界座標，z = 0）→ 相機座標（右、上、前）→ 公尺。
  // 鏡頭看著的那一點放在聽者正前方 SND_D 公尺（整座擺像一座擺在面前的大型桌上牛頓擺，兩端的球在左右約 20–30°），
  // 所以鏡頭轉動時聲音也跟著轉。左右、上下以畫面正中間為準（整座擺為了置中，鏡頭的中心線不一定在畫面正中間），
  // 畫在畫面左半邊的相撞就從左邊來。音量 = (接近速度 / 示範時單顆球的速度)^0.8
  function sndEmit(s, f) {
    const uc = (f.cols / 2 - s.ccx) / s.F, vc = (s.ccy - f.rows / 2) * f.aspect / s.F;
    for (let k = 0; k < s.evN; k++) {
      const qx = s.evX[k] - s.ex, qy = s.evY[k] - s.ey, qz = -s.ez;
      const cx = qx * s.rx + qy * s.ry + qz * s.rz, cy = qx * s.ux + qy * s.uy + qz * s.uz, cz = qx * s.fx + qy * s.fy + qz * s.fz;
      const vol = Math.min(1, Math.pow(s.evV[k] / s.vRef, 0.8));
      if (typeof f.sfx === 'function') f.sfx('clack', vol, { x: (cx - uc * cz) * SND_K, y: (cy - vc * cz) * SND_K, z: SND_D + (cz - s.pdist) * SND_K });
    }
    s.evN = 0;
  }
  // 位置修正：球不會互相穿過去
  function project(s) {
    const n = s.n, th = s.th, kin = s.kin, L = s.L, L2 = L * L, px = s.px, D = 2 * s.r, slop = 0.0015;
    for (let it = 0; it < 2; it++) for (let q = 0; q < n - 1; q++) {
      const i = (it & 1) ? n - 2 - q : q, j = i + 1;
      const si = Math.sin(th[i]), ci = Math.cos(th[i]), sj = Math.sin(th[j]), cj = Math.cos(th[j]);
      const dx = px[j] + L * sj - px[i] - L * si, dy = L * (ci - cj);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= D - slop) continue;
      const nx = dx / (d || 1e-9), ny = dy / (d || 1e-9);
      const Ji = L * (ci * nx + si * ny), Jj = L * (cj * nx + sj * ny);
      const wi = kin[i] ? 0 : 1, wj = kin[j] ? 0 : 1;
      const K = (wi * Ji * Ji + wj * Jj * Jj) / L2;
      if (K < 1e-9) continue;
      const mu = (D - slop - d) * 0.9 / K;
      th[i] -= wi * Ji * mu / L2; th[j] += wj * Jj * mu / L2;
    }
  }
  // 一個子步：半步重力 → 碰撞（速度）→ 位置 → 半步重力 → 位置修正
  function substep(s, keep) {
    const n = s.n, th = s.th, om = s.om, kin = s.kin, h = H_STEP, hh = 0.5 * h * s.w2;
    for (let i = 0; i < n; i++) if (!kin[i]) om[i] = om[i] * keep - hh * Math.sin(th[i]);
    contacts(s);
    // 保險：自由的球往外擺的速度，最多只夠擺到 ECAP_TH（用力甩、或拿著球去撞別的球時，球自己會先轉回來，不會撞到最上面的硬限制）
    const ec = s.ecap;
    for (let i = 0; i < n; i++) {
      if (kin[i] || om[i] * th[i] <= 0) continue;
      const pe = s.w2 * (1 - Math.cos(th[i])), r = ec - pe;
      if (0.5 * om[i] * om[i] > r) om[i] = r > 0 ? (om[i] > 0 ? Math.sqrt(2 * r) : -Math.sqrt(2 * r)) : 0;
    }
    for (let i = 0; i < n; i++) {
      th[i] += om[i] * h;
      if (kin[i]) continue;
      if (th[i] > TH_LIM) { th[i] = TH_LIM; if (om[i] > 0) om[i] = 0; } else if (th[i] < -TH_LIM) { th[i] = -TH_LIM; if (om[i] < 0) om[i] = 0; }
      om[i] -= hh * Math.sin(th[i]);
    }
    project(s);
  }

  // ── 示範：看不見的手把球抬起、放開；花樣依序輪流 ──
  function buildSeq(n) {
    const seq = [], m = n - 1;
    let side = 0;
    const dbl = [[1, 1], [2, 1], [1, 2], [2, 2], [3, 1], [1, 3], [3, 2]].filter(p => p[0] + p[1] <= m);
    let di = 0;
    for (let round = 0; round < 2; round++) {
      side = round & 1;   // 第二輪從另一邊開始：每種顆數左右都會輪到
      for (let k = 1; k <= m; k++) {
        seq.push(side ? [0, k] : [k, 0]); side ^= 1;
        if (k % 2 === 0 && dbl.length) seq.push(dbl[di++ % dbl.length]);
      }
    }
    return seq;
  }
  function startLift(s) {
    const pat = s.seq[s.pat % s.seq.length]; s.pat++;
    s.curPat = pat;
    const n = s.n, a = pat[0], b = pat[1];
    const amp = k => 0.74 - 0.035 * (k - 1);
    for (let i = 0; i < n; i++) {
      s.st[i] = s.th[i];
      s.tg[i] = i < a ? -amp(a) : i >= n - b ? amp(b) : 0;
      s.kin[i] = 1; s.om[i] = 0;
    }
    s.ph = 'lift'; s.pt = 0; s.liftT = 0;
  }
  function releaseAll(s) { for (let i = 0; i < s.n; i++) { if (s.kin[i]) s.om[i] = 0; s.kin[i] = 0; } s.Eref = energy(s); }

  // 每格：示範狀態機 + 物理
  function simulate(s, dt) {
    const n = s.n;
    if (!s.playing) {
      s.pt += dt;
      if (s.ph === 'swing' && s.pt > s.swingT) { s.ph = 'calm'; s.pt = 0; }
      if (s.ph === 'calm') {
        // 看不見的手在每顆球擺到最高點時接住它（見下面的子步迴圈）；剩下還在動的球都很小幅了，就開始下一次抬球
        let busy = false;
        const eS = s.w2 * (1 - Math.cos(0.03));
        for (let i = 0; i < n; i++) if (!s.kin[i] && 0.5 * s.om[i] * s.om[i] + s.w2 * (1 - Math.cos(s.th[i])) > eS) busy = true;
        if (!busy || s.pt > 3) startLift(s);
      }
      if (s.ph === 'hold' && s.pt > 0.45) { releaseAll(s); s.ph = 'swing'; s.pt = 0; const p = s.curPat; s.swingT = p[0] && p[1] ? 12 : 15; }
    }
    // 被拿著的球：用游標的速度移動（平均分到這一格的每個子步），慢慢拖時碰到的球也只會被慢慢推開
    if (s.drag) { const d = s.drag; d.v = clamp((d.tgt - s.th[d.i]) / Math.max(dt, 1 / 120), -6, 6); }
    s.acc += dt;
    let steps = 0;
    let held = false; for (let i = 0; i < n; i++) if (s.kin[i]) held = true;
    const kinActive = s.ph === 'lift' || s.ph === 'hold' || !!s.drag || held;
    const keep = Math.exp(-s.damp * H_STEP), calm = s.ph === 'calm', pom = s.pom, th = s.th, om = s.om, kin = s.kin;
    while (s.acc >= H_STEP && steps < 120) {
      s.acc -= H_STEP; steps++;
      if (s.ph === 'lift') {
        s.liftT += H_STEP;
        const u = sstep(0, 1, Math.min(1, s.liftT / 1.5));
        for (let i = 0; i < n; i++) { const t = s.st[i] + (s.tg[i] - s.st[i]) * u; s.om[i] = (t - s.th[i]) / H_STEP; }
        if (s.liftT >= 1.5) { s.ph = 'hold'; s.pt = 0; for (let i = 0; i < n; i++) s.om[i] = 0; }
      } else if (s.ph === 'hold') {
        for (let i = 0; i < n; i++) s.om[i] = 0;
      } else if (s.drag) {
        const i = s.drag.i, rem = s.drag.tgt - s.th[i], v = s.drag.v;
        s.om[i] = Math.abs(rem) <= Math.abs(v) * H_STEP ? rem / H_STEP : v;
      }
      if (calm) for (let i = 0; i < n; i++) pom[i] = om[i];
      substep(s, keep);
      // 示範換花樣前：球剛擺過最高點（速度從往外變成往內）就被接住、停在那裡
      if (calm) for (let i = 0; i < n; i++) if (!kin[i] && pom[i] * th[i] > 0 && om[i] * th[i] <= 0 && Math.abs(th[i]) > 0.03) { kin[i] = 1; om[i] = 0; }
    }
    if (s.acc > H_STEP * 4) s.acc = 0;
    if (s.drag && dt > 0) { const d = s.drag, w = (s.th[d.i] - d.last) / dt; d.om += (w - d.om) * 0.5; d.last = s.th[d.i]; }
    // 數值保險（正常情況下不會動作）：沒有外力時，總能量明顯超過上一個參考值才把速度縮回去
    const E = energy(s);
    if (kinActive) s.Eref = E;
    else if (E > s.Eref * 1.003 + 1e-4) {
      let ke = 0; for (let i = 0; i < n; i++) ke += 0.5 * s.om[i] * s.om[i];
      const k = ke > 1e-12 ? Math.sqrt(Math.max(0, (ke - (E - s.Eref)) / ke)) : 0;
      for (let i = 0; i < n; i++) s.om[i] *= k;
    } else if (E < s.Eref) s.Eref = E;
    for (let i = 0; i < n; i++) if (!Number.isFinite(s.th[i]) || !Number.isFinite(s.om[i])) { s.th[i] = 0; s.om[i] = 0; s.Eref = energy(s); }
  }

  // ── 相機：幾個好看的角度之間慢慢移動 ──
  // 鏡頭路線每 84 秒循環一次（四個鏡位各 21 秒，或環繞一圈）
  const CAM_T = 84, CAM_DT = 0.25, CAM_N = 336, CW = TAU / CAM_T;
  const POSES = {
    hero: [{ y: 0.5, p: 0.15, d: 46 }, { y: -0.45, p: 0.11, d: 44 }, { y: 0.2, p: 0.26, d: 48 }, { y: 0.8, p: 0.09, d: 40 }],
    low: [{ y: 0.62, p: 0.05, d: 27 }, { y: -0.4, p: 0.08, d: 28 }, { y: 0.95, p: 0.035, d: 26 }, { y: 0.25, p: 0.12, d: 30 }],
    // 幾乎正面、長焦（透視很淡），像原本的平面牛頓擺，只靠緩慢的視差和陰影看出立體
    front: [{ y: 0.2, p: 0.1, d: 74 }, { y: -0.16, p: 0.07, d: 70 }, { y: 0.06, p: 0.17, d: 76 }, { y: -0.26, p: 0.04, d: 68 }],
  };
  // 環繞鏡頭的方位角表：從正面、背面看（一整排球都看得到）時走得慢，正對兩端（球會疊成一串）時較快經過
  const ORB_N = 1024, ORB_K = 6, ORB_W = 0.5, ORB_Y0 = 0.38;
  function buildOrbit(s) {
    const N = ORB_N, cum = new Float64Array(N + 1), tab = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) { const c = Math.cos(ORB_Y0 + ((i + 0.5) / N) * TAU) / ORB_W; cum[i + 1] = cum[i] + 1 / (1 + ORB_K * Math.exp(-c * c)); }
    let j = 0;
    for (let k = 0; k <= N; k++) {
      const want = (k / N) * cum[N];
      while (j < N - 1 && cum[j + 1] < want) j++;
      const u = Math.min(1, Math.max(0, (want - cum[j]) / (cum[j + 1] - cum[j])));
      tab[k] = ORB_Y0 + ((j + u) / N) * TAU;
    }
    s.orb = tab;
  }
  function poseAt(s, tau) {
    let yaw, pit, dist;
    tau = ((tau % CAM_T) + CAM_T) % CAM_T;
    if (s.camMode === 'orbit') {
      // 繞一圈（見 buildOrbit）；接近兩端時相機也抬高，球在畫面上才會上下錯開
      const x = (tau / CAM_T) * ORB_N, k = Math.min(ORB_N - 1, Math.floor(x)), T = s.orb, ph = tau * CW;
      yaw = T[k] + (T[k + 1] - T[k]) * (x - k);
      const e2 = Math.sin(yaw) * Math.sin(yaw), e8 = e2 * e2 * e2 * e2;
      pit = 0.19 + 0.13 * e2 + 0.26 * e8 + 0.03 * Math.sin(2 * ph + 0.5); dist = 36 + 3 * e2 - 2 * Math.sin(ph + 1);
    } else {
      const P = POSES[s.camMode] || POSES.hero, seg = CAM_T / P.length, k = Math.floor(tau / seg), u = (tau - k * seg) / seg;
      const a = P[k % P.length], b = P[(k + 1) % P.length], w = sstep(0.6, 1, u);
      yaw = a.y + (b.y - a.y) * w; pit = a.p + (b.p - a.p) * w; dist = a.d + (b.d - a.d) * w;
      // 很慢的飄移（只用慢的正弦，畫面才不會來回抖）
      yaw += 0.05 * Math.sin(tau * CW * 3); pit += 0.015 * Math.sin(tau * CW * 2 + 2); dist += 0.8 * Math.sin(tau * CW * 2 + 1);
    }
    s.pyaw = yaw; s.ppit = pit; s.pdist = dist;
  }
  // 整條鏡頭路線上每個時間點「放得下」的焦距，先取一段時間內的最小值、再平滑兩次：
  // 結果一定不超過每個時間點放得下的焦距（整座擺永遠在畫面裡），而且只會隨著換鏡位慢慢改變，不會一格一格地忽大忽小
  function buildFrameTable(s, f) {
    const N = CAM_N, raw = new Float64Array(N), ero = new Float64Array(N), b1 = new Float64Array(N), out = new Float64Array(N);
    for (let k = 0; k < N; k++) { poseAt(s, k * CAM_DT); camBasis(s); camBox(s); raw[k] = fitF(s, f); }
    const R = 32, r = 16;   // 8 秒內的最小值，再各 4 秒平滑兩次（r + r <= R）
    for (let k = 0; k < N; k++) { let m = 1e9; for (let j = -R; j <= R; j++) { const v = raw[(k + j + N) % N]; if (v < m) m = v; } ero[k] = m; }
    for (let k = 0; k < N; k++) { let a = 0; for (let j = -r; j <= r; j++) a += ero[(k + j + N) % N]; b1[k] = a / (2 * r + 1); }
    for (let k = 0; k < N; k++) { let a = 0; for (let j = -r; j <= r; j++) a += b1[(k + j + N) % N]; out[k] = 0.985 * a / (2 * r + 1); }
    return out;
  }
  function frameF(s, tau) {
    const x = (((tau % CAM_T) + CAM_T) % CAM_T) / CAM_DT, k = Math.floor(x), u = x - k, T = s.Ftab;
    return T[k % CAM_N] + (T[(k + 1) % CAM_N] - T[k % CAM_N]) * u;
  }
  function camBasis(s) {
    const cp = Math.cos(s.ppit), ty = s.tgtY;
    const ex = s.pdist * Math.sin(s.pyaw) * cp, ey = ty + s.pdist * Math.sin(s.ppit), ez = s.pdist * Math.cos(s.pyaw) * cp;
    let fx = -ex, fy = ty - ey, fz = -ez; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl; const ry = 0;   // right = fwd × up
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    s.ex = ex; s.ey = ey; s.ez = ez; s.fx = fx; s.fy = fy; s.fz = fz; s.rx = rx; s.ry = ry; s.rz = rz; s.ux = ux; s.uy = uy; s.uz = uz;
  }
  // 整座擺（含底座）在視角空間（tan）的範圍 → s.bu0..bu1, s.bv0..bv1
  function camBox(s) {
    let umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9;
    for (let c = 0; c < 8; c++) {
      const X = c & 1 ? s.bxw : -s.bxw, Y = c & 2 ? s.yR + s.rr : -s.bh, Z = c & 4 ? s.bzw : -s.bzw;
      const qx = X - s.ex, qy = Y - s.ey, qz = Z - s.ez, zc = qx * s.fx + qy * s.fy + qz * s.fz;
      const u = (qx * s.rx + qy * s.ry + qz * s.rz) / zc, v = (qx * s.ux + qy * s.uy + qz * s.uz) / zc;
      if (u < umin) umin = u; if (u > umax) umax = u; if (v < vmin) vmin = v; if (v > vmax) vmax = v;
    }
    s.bu0 = umin; s.bu1 = umax; s.bv0 = vmin; s.bv1 = vmax;
  }
  // 這個角度下剛好放得進畫面（留邊）的焦距
  function fitF(s, f) { return Math.min(s.fitW * s.availW / (s.bu1 - s.bu0), s.fitH * s.availH * f.aspect / (s.bv1 - s.bv0)); }
  // ── 使用者轉過的視角（按住右鍵拖曳）──
  // s.uv = 使用者的視角在用；s.uw = 它的份量（1 = 完全是使用者的視角，回到示範時慢慢降到 0）；s.uE = 回去示範走了多久（0 = 還留著）；
  // s.uS = 回去的速度（半路上有人回來時很快降到 0）。uYaw/uPit/uDist = 使用者的鏡位（uYawT/uPitT = 拖曳的目標），udy = uYaw - 示範的方位角
  // 從「現在畫面上的樣子」開始（鏡位、焦距、置中都接著用），所以剛按下右鍵、或回去的半路上又有人操作時，畫面都不會跳
  function camGrab(s) {
    s.uv = 1; s.uE = 0; s.uw = 1; s.uS = 1; s.ubu = s.cbu; s.ubv = s.cbv;
    s.uYaw = s.uYawT = s.vyaw; s.uPit = s.vpit; s.uPitT = clamp(s.vpit, PIT_MIN, PIT_MAX); s.uDist = s.vdist;
    const d = s.vyaw - s.dyaw; s.udy = d - TAU * Math.round(d / TAU);
    s.uF = s.uF0 = s.Fd;
  }
  // 每格：跟著拖曳的目標慢慢轉過去（阻尼）；最後一次操作 UV_HOLD 秒後，花幾秒（轉得越多越久）平順地混回示範的鏡頭路線。
  // 「最後一次操作」用 s.uIdle：按著滑鼠（抓著球、按著右鍵）不動也算還在操作
  function userCam(s, dt) {
    if (s.uE > 0 || s.uIdle >= UV_HOLD) {
      // 開始回去：走最近的那一邊（轉了好幾圈也不會倒著轉回去），轉得越多花越久
      if (s.uE === 0) { s.udy -= TAU * Math.round(s.udy / TAU); s.uDur = clamp(2.5 + 2.2 * Math.hypot(s.udy, s.uPit - s.dpit), 2.5, 10); s.uZ = s.zoomU; s.uS = 1; }
      // 回去的半路上又有人來了：和示範的鏡頭一樣很快地停下來（約 0.2 秒），停住的樣子就是新的視角
      if (s.uIdle < UV_HOLD) s.uS *= Math.exp(-dt * 6);
      if (s.uS < 0.01) camGrab(s);
      else {
        s.uE += dt * s.uS;
        const e = Math.min(1, s.uE / s.uDur);
        s.uw = 1 - e * e * e * (e * (e * 6 - 15) + 10);
        s.zoomU = 1 + (s.uZ - 1) * s.uw;   // 滾輪縮放也跟著一起回去
        if (e >= 1) { s.uv = 0; s.uw = 0; s.zoomU = 1; s.pyaw = s.dyaw; s.ppit = s.dpit; s.pdist = s.ddist; return; }   // 回到示範的鏡頭路線了
      }
    }
    const k = 1 - Math.exp(-dt * 12);
    s.uYaw += (s.uYawT - s.uYaw) * k; s.uPit += (s.uPitT - s.uPit) * k;
    // 使用者和示範鏡頭的方位角差 udy = uYaw - 示範的方位角：連續追蹤（示範的環繞鏡頭繞完一圈、方位角少掉 360° 時也不會跳）
    const d = s.uYaw - s.dyaw - s.udy; s.udy += d - TAU * Math.round(d / TAU);
    const w = s.uw;
    s.pyaw = s.uYaw - s.udy * (1 - w); s.ppit = s.dpit + (s.uPit - s.dpit) * w; s.pdist = s.ddist + (s.uDist - s.ddist) * w;
  }
  function setCamera(s, f, dt) {
    const A = f.aspect;
    camBasis(s); camBox(s);
    // 焦距：init 裡算好的平滑表（見 buildFrameTable）
    let F0 = frameF(s, s.tau), cx0, cy0;
    if (s.uv) {
      // 使用者轉過的視角：焦距接著用轉之前的；轉到整座擺放不下的角度才慢慢拉遠（回到示範時跟著混回平滑表）
      s.uF += (Math.min(s.uF0, 0.985 * fitF(s, f)) - s.uF) * (1 - Math.exp(-dt * 3));
      F0 += (s.uF - F0) * s.uw;
      // 置中：外框的中心在換成另一個角落時會突然轉向（例如從側面轉到正對兩端），轉動視角時用稍微慢一點跟上的中心，
      // 畫面才不會頓一下；快回到示範時再慢慢換回外框的中心
      let bu = (s.bu0 + s.bu1) / 2, bv = (s.bv0 + s.bv1) / 2;
      const k = 1 - Math.exp(-dt * 5), q = Math.min(1, s.uw * 3);
      s.ubu += (bu - s.ubu) * k; s.ubv += (bv - s.ubv) * k;
      bu += (s.ubu - bu) * q; bv += (s.ubv - bv) * q;
      s.cbu = bu; s.cbv = bv;
      cx0 = f.cols / 2 - F0 * bu; cy0 = s.availCy + F0 * bv / A;
    } else {
      cx0 = f.cols / 2 - F0 * (s.bu0 + s.bu1) / 2; cy0 = s.availCy + F0 * (s.bv0 + s.bv1) / (2 * A);
      s.cbu = (s.bu0 + s.bu1) / 2; s.cbv = (s.bv0 + s.bv1) / 2;
    }
    s.Fd = F0; s.vyaw = s.pyaw; s.vpit = s.ppit; s.vdist = s.pdist;   // 畫面上的樣子（camGrab 從這裡開始）
    // 滾輪放大時以球列為中心
    const Z = s.zoomU;
    const qx = -s.ex, qy = s.c0 + 0.9 - s.ey, qz = -s.ez, zc = qx * s.fx + qy * s.fy + qz * s.fz;
    const u0 = (qx * s.rx + qy * s.ry + qz * s.rz) / zc, v0 = (qx * s.ux + qy * s.uy + qz * s.uz) / zc;
    const X0 = cx0 + F0 * u0, Y0 = cy0 - F0 * v0 / A, F = F0 * Z;
    s.F = F; s.ccx = X0 - F * u0; s.ccy = Y0 + F * v0 / A;
  }
  // 世界座標 → 畫面（格子）座標；回傳深度（<=0 表示在相機後面）
  function proj(s, A, X, Y, Z) {
    const qx = X - s.ex, qy = Y - s.ey, qz = Z - s.ez, zc = qx * s.fx + qy * s.fy + qz * s.fz;
    if (zc <= 0.05) { s.sx = -1e9; s.sy = -1e9; return zc; }
    s.sx = s.ccx + s.F * (qx * s.rx + qy * s.ry + qz * s.rz) / zc;
    s.sy = s.ccy - s.F * (qx * s.ux + qy * s.uy + qz * s.uz) / (zc * A);
    return zc;
  }
  // 包圍盒投影到畫面上的格子範圍 → s.x0..x1, s.y0..y1
  function rect(s, f, x0, y0, z0, x1, y1, z1, pad) {
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (let k = 0; k < 8; k++) {
      const z = proj(s, f.aspect, k & 1 ? x1 : x0, k & 2 ? y1 : y0, k & 4 ? z1 : z0);
      if (z <= 0.05) { a = 0; b = f.cols; c = 0; d = f.rows; break; }
      if (s.sx < a) a = s.sx; if (s.sx > b) b = s.sx; if (s.sy < c) c = s.sy; if (s.sy > d) d = s.sy;
    }
    s.x0 = Math.max(0, Math.floor(a - pad)); s.x1 = Math.min(f.cols - 1, Math.ceil(b + pad));
    s.y0 = Math.max(0, Math.floor(c - pad)); s.y1 = Math.min(f.rows - 1, Math.ceil(d + pad));
    return s.x0 <= s.x1 && s.y0 <= s.y1;
  }

  // ── 光柵化：每格一條光線，只在物件的包圍範圍裡做 ──
  function rasterSphere(s, f, Cx, Cy, Cz, rad, pid) {
    if (!rect(s, f, Cx - rad, Cy - rad, Cz - rad, Cx + rad, Cy + rad, Cz + rad, 1)) return;
    const ox = s.ex - Cx, oy = s.ey - Cy, oz = s.ez - Cz;
    const roc = s.rx * ox + s.ry * oy + s.rz * oz, c = ox * ox + oy * oy + oz * oz - rad * rad;
    const cols = f.cols, zb = s.zb, id = s.id, uu = s.uu, rbx = s.rbx, rby = s.rby, rbz = s.rbz, rbv = s.rbv;
    for (let y = s.y0; y <= s.y1; y++) {
      const by = rbx[y] * ox + rby[y] * oy + rbz[y] * oz, a0 = 1 + rbv[y] * rbv[y];
      let k = y * cols + s.x0;
      for (let x = s.x0; x <= s.x1; x++, k++) {
        const u = uu[x], b = by + u * roc, a = a0 + u * u, disc = b * b - a * c;
        if (disc < 0) continue;
        const t = (-b - Math.sqrt(disc)) / a;
        if (t > 0 && t < zb[k]) { zb[k] = t; id[k] = pid; }
      }
    }
  }
  // 圓柱：axis 0 = 沿 x（橫桿），1 = 沿 y（立柱）
  function rasterCyl(s, f, axis, a0, a1, p, q, rad, pid) {
    const ok = axis === 0 ? rect(s, f, a0, p - rad, q - rad, a1, p + rad, q + rad, 1) : rect(s, f, p - rad, a0, q - rad, p + rad, a1, q + rad, 1);
    if (!ok) return;
    const cols = f.cols, zb = s.zb, id = s.id, occ = s.occ, uu = s.uu, rbx = s.rbx, rby = s.rby, rbz = s.rbz;
    const rx = s.rx, ry = s.ry, rz = s.rz, ex = s.ex, ey = s.ey, ez = s.ez, rail = axis === 0;
    const o1 = axis === 0 ? ey - p : ex - p, o2 = ez - q, c = o1 * o1 + o2 * o2 - rad * rad;
    for (let y = s.y0; y <= s.y1; y++) {
      const bx = rbx[y], byy = rby[y], bz = rbz[y];
      let k = y * cols + s.x0;
      for (let x = s.x0; x <= s.x1; x++, k++) {
        const u = uu[x], dx = bx + u * rx, dy = byy + u * ry, dz = bz + u * rz;
        const d1 = axis === 0 ? dy : dx;
        const a = d1 * d1 + dz * dz, b = d1 * o1 + dz * o2, disc = b * b - a * c;
        if (disc < 0 || a < 1e-12) continue;
        const t = (-b - Math.sqrt(disc)) / a;
        if (t <= 0 || t >= zb[k]) continue;
        const h = axis === 0 ? ex + t * dx : ey + t * dy;
        if (h < a0 || h > a1) continue;
        if (rail && id[k] >= 0 && id[k] < ID_BASE) occ[k] = 1;   // 橫桿擋在球前面（這幾格要畫實心）
        zb[k] = t; id[k] = pid;
      }
    }
  }
  function rasterBox(s, f, x0, y0, z0, x1, y1, z1, pid) {
    if (!rect(s, f, x0, y0, z0, x1, y1, z1, 1)) return;
    const cols = f.cols, zb = s.zb, id = s.id, uu = s.uu, rbx = s.rbx, rby = s.rby, rbz = s.rbz;
    const rx = s.rx, ry = s.ry, rz = s.rz, ex = s.ex, ey = s.ey, ez = s.ez;
    for (let y = s.y0; y <= s.y1; y++) {
      const bx = rbx[y], byy = rby[y], bz = rbz[y];
      let k = y * cols + s.x0;
      for (let x = s.x0; x <= s.x1; x++, k++) {
        const u = uu[x], dx = bx + u * rx, dy = byy + u * ry, dz = bz + u * rz;
        let tn = -1e9, tf = 1e9, t1, t2, tt;
        if (Math.abs(dx) > 1e-12) { t1 = (x0 - ex) / dx; t2 = (x1 - ex) / dx; if (t1 > t2) { tt = t1; t1 = t2; t2 = tt; } if (t1 > tn) tn = t1; if (t2 < tf) tf = t2; } else if (ex < x0 || ex > x1) continue;
        if (Math.abs(dy) > 1e-12) { t1 = (y0 - ey) / dy; t2 = (y1 - ey) / dy; if (t1 > t2) { tt = t1; t1 = t2; t2 = tt; } if (t1 > tn) tn = t1; if (t2 < tf) tf = t2; } else if (ey < y0 || ey > y1) continue;
        if (Math.abs(dz) > 1e-12) { t1 = (z0 - ez) / dz; t2 = (z1 - ez) / dz; if (t1 > t2) { tt = t1; t1 = t2; t2 = tt; } if (t1 > tn) tn = t1; if (t2 < tf) tf = t2; } else if (ez < z0 || ez > z1) continue;
        if (tn > tf || tn <= 0 || tn >= zb[k]) continue;
        zb[k] = tn; id[k] = pid;
      }
    }
  }

  // ── 著色 ──
  // 攝影棚（只出現在反射裡；畫面背景本身是黑的，像產品攝影）：四周的白牆越往上越亮、地平線是一條清楚的暗帶、
  // 頭頂一盞大柔光箱、左右兩支直立條燈、右後方的輪廓燈
  function envLum(s, Rx, Ry, Rz) {
    const M = s.M;
    let e = Ry > 0.03 ? M.wall + M.zen * Ry : Ry > -0.12 ? M.band : M.gnd;
    if (Rz > 0 && Ry > -0.12) e += M.fill * Rz * Rz;
    const k = Rx * s.lkx + Ry * s.lky + Rz * s.lkz;
    if (k > 0.8) e += M.soft * sstep(0.84, 0.93, k);
    const q = Rx * s.lrx + Ry * s.lry + Rz * s.lrz;
    if (q > 0.82) e += M.rimL * sstep(0.84, 0.9, q);
    if (Ry > -0.3 && Ry < 0.8) {
      const hl = Math.sqrt(Rx * Rx + Rz * Rz);
      if (hl > 0.3) {
        const hx = Rx / hl, hz = Rz / hl;
        // 兩支條燈：左前、右前（稍微在側面）
        const q1 = hx * s.sqx + hz * s.sqz, q2 = -hx * s.sqx + hz * s.sqz;
        if (q1 > 0.965) e += M.strip * sstep(0.965, 0.985, q1);
        if (q2 > 0.965) e += M.strip * 0.6 * sstep(0.965, 0.985, q2);
      }
    }
    return e;
  }
  // 軟陰影：從 P 往主光方向，被其他球擋到多少（1 = 全亮）
  function ballShadow(s, Px, Py, Pz, self) {
    let sh = 1;
    const lx = s.lkx, ly = s.lky, lz = s.lkz, n = s.n;
    for (let j = 0; j < n; j++) {
      if (j === self) continue;
      const ox = Px - s.bcx[j], oy = Py - s.bcy[j], oz = Pz;
      const b = ox * lx + oy * ly + oz * lz;
      if (b > 0) continue;
      const c = ox * ox + oy * oy + oz * oz - 1, h = b * b - c;
      const w = sstep(0, 1, h * 6 / b);   // h>0 擋到；沒擋到時越接近邊緣越暗（半影）
      if (w < sh) sh = w;
    }
    return sh;
  }
  // 反射光線：其他球、橫桿、底座，都沒打到就是攝影棚
  function traceRefl(s, Px, Py, Pz, Rx, Ry, Rz, self) {
    let best = 1e9, hit = -1;
    const n = s.n;
    for (let j = 0; j < n; j++) {
      if (j === self) continue;
      const ox = Px - s.bcx[j], oy = Py - s.bcy[j], oz = Pz;
      const b = ox * Rx + oy * Ry + oz * Rz;
      if (b >= 0) continue;
      const h = b * b - (ox * ox + oy * oy + oz * oz - 1);
      if (h <= 0) continue;
      const t = -b - Math.sqrt(h);
      if (t > 1e-4 && t < best) { best = t; hit = j; }
    }
    // 橫桿（沿 x），反射裡畫粗一點才看得到
    const rr = s.rr * 1.8;
    if (Ry > 0) for (let k = 0; k < 2; k++) {
      const zc = k ? s.zr : -s.zr, o1 = Py - s.yR, o2 = Pz - zc;
      const a = Ry * Ry + Rz * Rz; if (a < 1e-9) continue;
      const b = Ry * o1 + Rz * o2, c = o1 * o1 + o2 * o2 - rr * rr, h = b * b - a * c;
      if (h <= 0) continue;
      const t = (-b - Math.sqrt(h)) / a;
      if (t > 1e-4 && t < best) { const hx = Px + t * Rx; if (hx >= -s.X && hx <= s.X) { best = t; hit = 30; } }
    }
    // 底座頂面
    if (Ry < 0) {
      const t = -Py / Ry;
      if (t > 1e-4 && t < best) { const hx = Px + t * Rx, hz = Pz + t * Rz; if (Math.abs(hx) <= s.bxw && Math.abs(hz) <= s.bzw) { best = t; hit = 40; } }
    }
    if (hit < 0) return envLum(s, Rx, Ry, Rz);
    if (hit < 30) {
      // 隔壁的球：它朝向這顆球的那一面也映著球，比較暗
      const nx = Px + best * Rx - s.bcx[hit], ny = Py + best * Ry - s.bcy[hit], nz = Pz + best * Rz;
      const dn = Rx * nx + Ry * ny + Rz * nz, qx = Rx - 2 * dn * nx, qy = Ry - 2 * dn * ny, qz = Rz - 2 * dn * nz;
      const df = nx * s.lkx + ny * s.lky + nz * s.lkz;
      return 0.04 + 0.16 * Math.max(0, df) + s.M.nbr * envLum(s, qx, qy, qz);
    }
    if (hit < 40) return 0.75;
    // 底座：暗色漆面，加上球的影子
    const hx = Px + best * Rx, hz = Pz + best * Rz;
    return (0.06 + 0.12 * ballShadow(s, hx, 0, hz, -1)) * s.baseK;
  }

  function txtC(g, y, str, col) {
    let w = 0; for (const c of str) w += isWide(c) ? 2 : 1;
    let x = Math.floor((g.cols - w) / 2);
    // 先把字底下（和左右各兩格）清乾淨
    for (let k = Math.max(0, x - 2); k < Math.min(g.cols, x + w + 2); k++) g.set(k, y, ' ', col);
    for (const c of str) { const wd = isWide(c); if (c !== ' ') { g.set(x, y, c, col); if (wd) g.set(x + 1, y, ' ', col); } x += wd ? 2 : 1; }
  }

  // 畫一條 3D 線段：投影後依方向與格內位置挑字元，和深度緩衝比較。
  // tube >= 0 時是金屬桿：每一格依那一點的反光算亮度（tube = 亮度倍率）；否則用固定顏色 col
  // own：這條線屬於哪個物件（id 緩衝）；在自己身上用寬鬆的 ownBias 比深度，其他東西前面只容許 0.05 的誤差
  function line3(s, f, X0, Y0, Z0, X1, Y1, Z1, col, own, ownBias, tube, thin) {
    const A = f.aspect, cols = f.cols, rows = f.rows, zb = s.zb, id = s.id, ch = f.g.ch, co = f.g.co;
    const z0 = proj(s, A, X0, Y0, Z0), sx0 = s.sx, sy0 = s.sy;
    const z1 = proj(s, A, X1, Y1, Z1), sx1 = s.sx, sy1 = s.sy;
    if (z0 <= 0.05 || z1 <= 0.05) return;
    const dx = sx1 - sx0, dy = sy1 - sy0;
    let phi = Math.atan2(-dy * A, dx) * 57.29578; if (phi < 0) phi += 180; if (phi >= 180) phi -= 180;
    const iz0 = 1 / z0, iz1 = 1 / z1;
    let ax = 0, ay = 0, az = 0;
    if (tube >= 0) { ax = X1 - X0; ay = Y1 - Y0; az = Z1 - Z0; const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l; }
    // 細線（吊線）比 58° 陡才一列只畫一格；34°~58° 一欄一格、用 / 或 \（兩兩相連，像原本平面版的吊線），不會斷成一段一段的
    const horiz = thin ? Math.abs(dy) * A < Math.abs(dx) * 1.6 : Math.abs(dx) >= Math.abs(dy);
    const phiA = phi > 90 ? 180 - phi : phi, diag = thin && horiz && phiA >= 34;
    if (horiz && Math.abs(dx) < 1e-6) return;
    if (!horiz && Math.abs(dy) < 1e-6) return;
    const lo = horiz ? Math.max(0, Math.ceil(Math.min(sx0, sx1) - 0.5)) : Math.max(0, Math.ceil(Math.min(sy0, sy1) - 0.5));
    const hi = horiz ? Math.min(cols - 1, Math.floor(Math.max(sx0, sx1) - 0.5)) : Math.min(rows - 1, Math.floor(Math.max(sy0, sy1) - 0.5));
    for (let m = lo; m <= hi; m++) {
      let t, k, off;
      if (horiz) {
        t = (m + 0.5 - sx0) / dx; const y = sy0 + t * dy, row = Math.floor(y);
        if (row < 0 || row >= rows) continue;
        k = row * cols + m; off = y - row - 0.5;
      } else {
        t = (m + 0.5 - sy0) / dy; const x = sx0 + t * dx, c = Math.floor(x);
        if (c < 0 || c >= cols) continue;
        k = m * cols + c; off = x - c - 0.5;
      }
      const iz = iz0 + (iz1 - iz0) * t, z = 1 / iz;
      if (z > zb[k] + (id[k] === own ? ownBias : 0.05)) continue;
      ch[k] = diag ? (phi < 90 ? '/' : BSL) : lineCh(phi, off, !horiz, false, 0);
      if (tube >= 0) {
        // 透視正確的參數 → 桿上的點；朝向相機那一面的法線 → 反射環境
        const w = t * iz1 / iz, Px = X0 + (X1 - X0) * w, Py = Y0 + (Y1 - Y0) * w, Pz = Z0 + (Z1 - Z0) * w;
        let vx = s.ex - Px, vy = s.ey - Py, vz = s.ez - Pz; const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
        const va = vx * ax + vy * ay + vz * az;
        let nx = vx - va * ax, ny = vy - va * ay, nz = vz - va * az; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const vn = vx * nx + vy * ny + vz * nz, Rx = 2 * vn * nx - vx, Ry = 2 * vn * ny - vy, Rz = 2 * vn * nz - vz;
        const lum = (0.16 + 0.3 * Math.max(0, nx * s.lkx + ny * s.lky + nz * s.lkz) + 0.62 * envLum(s, Rx, Ry, Rz)) * tube;
        co[k] = s.cRod[lum >= 1 ? 63 : (lum * 63) | 0];
      } else co[k] = col;
    }
  }
  // 金屬桿的模式：1 = 一條線、2 = 兩條平行線（上下輪廓）、3 = 夠粗了，整根逐格著色（加上兩側輪廓）
  function rodModes(s, f) {
    const A = f.aspect;
    for (let ri = 0; ri < 6; ri++) {
      let X0, Y0, Z0, X1, Y1, Z1;
      if (ri < 2) { X0 = -s.X; X1 = s.X; Y0 = Y1 = s.yR; Z0 = Z1 = ri ? s.zr : -s.zr; }
      else { const k = ri - 2; X0 = X1 = k & 1 ? s.X : -s.X; Y0 = 0; Y1 = s.yR; Z0 = Z1 = k & 2 ? s.zr : -s.zr; }
      const mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2, mz = (Z0 + Z1) / 2;
      const zm = proj(s, A, mx, my, mz);
      if (zm <= 0.05) { s.rodMode[ri] = 1; continue; }
      const sxa = s.sx, sya = s.sy;
      const ax = X1 - X0, ay = Y1 - Y0, az = Z1 - Z0, al = Math.hypot(ax, ay, az) || 1;
      proj(s, A, mx + ax / al, my + ay / al, mz + az / al);
      const horiz = Math.abs(s.sx - sxa) >= Math.abs(s.sy - sya);
      const rho = s.rr * s.F / zm;   // 半徑（欄寬單位）
      const cells = horiz ? 2 * rho / A : 2 * rho;
      s.rodCells[ri] = cells;
      // 切換時有遲滯，相機慢慢移動時才不會一直跳
      let mode = s.rodMode[ri];
      if (mode === 1 && cells > 2.5) mode = 2; else if (mode === 2 && cells < 2.1) mode = 1;
      if (mode === 2 && cells > 3.9) mode = 3; else if (mode === 3 && cells < 3.5) mode = 2;
      s.rodMode[ri] = mode;
    }
  }
  function rod(s, f, ri, X0, Y0, Z0, X1, Y1, Z1) {
    const mode = s.rodMode[ri], bias = s.rrE * 2 + 0.05;
    if (mode === 1) { line3(s, f, X0, Y0, Z0, X1, Y1, Z1, null, ID_ROD + ri, bias, 1); return; }
    // 垂直於桿、也垂直於視線的偏移方向
    const mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2, mz = (Z0 + Z1) / 2;
    let ax = X1 - X0, ay = Y1 - Y0, az = Z1 - Z0; const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
    const vx = s.ex - mx, vy = s.ey - my, vz = s.ez - mz;
    let wx = ay * vz - az * vy, wy = az * vx - ax * vz, wz = ax * vy - ay * vx; const wl = Math.hypot(wx, wy, wz) || 1;
    const cells = s.rodCells[ri];
    const o = s.rr * (mode === 3 ? 1 - 0.5 / cells : Math.max(0.35, 1 - 1 / cells)) / wl; wx *= o; wy *= o; wz *= o;
    const tb = mode === 3 ? 0.55 : 0.7;
    line3(s, f, X0 + wx, Y0 + wy, Z0 + wz, X1 + wx, Y1 + wy, Z1 + wz, null, ID_ROD + ri, bias, tb);
    line3(s, f, X0 - wx, Y0 - wy, Z0 - wz, X1 - wx, Y1 - wy, Z1 - wz, null, ID_ROD + ri, bias, tb);
  }

  // 球的輪廓：用「視線與球心方向的夾角」做成的距離場，算出邊界穿過每格的位置與方向
  function sphereContour(s, f, i) {
    const A = f.aspect, cols = f.cols, zb = s.zb, id = s.id, ob = s.ob, ch = f.g.ch, co = f.g.co, uu = s.uu, rbv = s.rbv;
    const Cx = s.bcx[i], Cy = s.bcy[i];
    if (!rect(s, f, Cx - 1, Cy - 1, -1, Cx + 1, Cy + 1, 1, 2)) return;
    const qx = Cx - s.ex, qy = Cy - s.ey, qz = -s.ez;
    const cx = qx * s.rx + qy * s.ry + qz * s.rz, cy = qx * s.ux + qy * s.uy + qz * s.uz, cz = qx * s.fx + qy * s.fy + qz * s.fz;
    const Cl = Math.hypot(cx, cy, cz);
    if (Cl <= 1.01) return;
    const cosA = Math.sqrt(1 - 1 / (Cl * Cl));
    const x0 = s.x0, x1 = s.x1, y0 = s.y0, y1 = s.y1, w = x1 - x0 + 1, fb = s.fb;
    for (let y = y0; y <= y1; y++) {
      const v = rbv[y];
      for (let x = x0; x <= x1; x++) {
        const u = uu[x];
        fb[(y - y0) * w + (x - x0)] = (u * cx + v * cy + cz) / (Math.sqrt(1 + u * u + v * v) * Cl) - cosA;
      }
    }
    for (let y = y0 + 1; y < y1; y++) {
      for (let x = x0 + 1; x < x1; x++) {
        const kb = (y - y0) * w + (x - x0), fv = fb[kb];
        const gx = (fb[kb + 1] - fb[kb - 1]) * 0.5, gyv = (fb[kb + w] - fb[kb - w]) * 0.5 / A;
        const gl = Math.sqrt(gx * gx + gyv * gyv);
        if (gl < 1e-12) continue;
        const sd = -fv / gl;
        if (sd > 2.2 || sd < -2.2 * A) continue;
        const nx = -gx / gl, ny = -gyv / gl;   // 往外的法線（畫面座標，y 向下）
        let off;
        const hz = Math.abs(ny) >= Math.abs(nx) / A;
        if (hz) { off = (-sd / ny) / A; } else { off = -sd / nx; }
        if (!(off >= -0.5 && off < 0.5)) continue;
        const k = y * cols + x;
        if (id[k] !== i && zb[k] < s.bcz[i] - 0.3) continue;
        let phi = Math.atan2(-nx, -ny) * 57.29578; if (phi < 0) phi += 180; if (phi >= 180) phi -= 180;
        ch[k] = lineCh(phi, off, !hz, true, nx < 0 ? -1 : 1);
        ob[k] = i;
        // 輪廓的亮度：用這一點真正的 3D 法線（垂直於視線）算主光與背光
        let wx = nx * s.rx - ny * s.ux, wy = nx * s.ry - ny * s.uy, wz = nx * s.rz - ny * s.uz;
        const wd = (wx * qx + wy * qy + wz * qz) / (Cl * Cl);
        wx -= wd * qx; wy -= wd * qy; wz -= wd * qz;
        const wl = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
        const kd = Math.max(0, (wx * s.lkx + wy * s.lky + wz * s.lkz) / wl), kr = Math.max(0, (wx * s.lrx + wy * s.lry + wz * s.lrz) / wl);
        const lum = Math.min(1, 0.3 + 0.45 * kd + 0.55 * kr * kr);
        co[k] = s.cBall[(lum * 63) | 0];
      }
    }
  }
  // 有人在玩、手上沒有球時：「按下去會抓到的那顆球」（見 pick）的輪廓改成最亮的顏色，外面再畫一圈亮的圓圈
  // （和輪廓同樣的畫法，半徑比球的輪廓大一兩格；圓圈在球心的深度，被前面的東西擋住、或落在其他球上的地方不畫）
  function hoverRing(s, f, i) {
    const A = f.aspect, cols = f.cols, zb = s.zb, ch = f.g.ch, co = f.g.co, uu = s.uu, rbv = s.rbv;
    const Cx = s.bcx[i], Cy = s.bcy[i];
    const qx = Cx - s.ex, qy = Cy - s.ey, qz = -s.ez;
    const cx = qx * s.rx + qy * s.ry + qz * s.rz, cy = qx * s.ux + qy * s.uy + qz * s.uz, cz = qx * s.fx + qy * s.fy + qz * s.fz;
    const Cl = Math.hypot(cx, cy, cz);
    if (Cl <= 1.05 || cz <= 0.5) return;
    const ta = 1 / Math.sqrt(Cl * Cl - 1), gap = clamp(ta * s.F * RING_GAP, RING_MIN, RING_MAX), ah = Math.atan(ta + gap / s.F);
    const cosA = Math.cos(ah), Rh = Cl * Math.sin(ah) + 0.05;
    if (!rect(s, f, Cx - Rh, Cy - Rh, -Rh, Cx + Rh, Cy + Rh, Rh, 2)) return;
    const x0 = s.x0, x1 = s.x1, y0 = s.y0, y1 = s.y1, w = x1 - x0 + 1, fb = s.fb, ob = s.ob, col = s.cHi;
    for (let y = y0; y <= y1; y++) {
      const v = rbv[y];
      for (let x = x0; x <= x1; x++) {
        const u = uu[x], k = y * cols + x;
        fb[(y - y0) * w + (x - x0)] = (u * cx + v * cy + cz) / (Math.sqrt(1 + u * u + v * v) * Cl) - cosA;
        if (ob[k] === i && RIM_CH.includes(ch[k])) co[k] = col;   // 這顆球自己的輪廓也改成最亮的顏色
      }
    }
    for (let y = y0 + 1; y < y1; y++) {
      for (let x = x0 + 1; x < x1; x++) {
        const kb = (y - y0) * w + (x - x0), fv = fb[kb];
        const gx = (fb[kb + 1] - fb[kb - 1]) * 0.5, gyv = (fb[kb + w] - fb[kb - w]) * 0.5 / A;
        const gl = Math.sqrt(gx * gx + gyv * gyv);
        if (gl < 1e-12) continue;
        const sd = -fv / gl;
        if (sd > 2.2 || sd < -2.2 * A) continue;
        const nx = -gx / gl, ny = -gyv / gl;
        let off;
        const hz = Math.abs(ny) >= Math.abs(nx) / A;
        if (hz) { off = (-sd / ny) / A; } else { off = -sd / nx; }
        if (!(off >= -0.5 && off < 0.5)) continue;
        const k = y * cols + x;
        if (zb[k] < cz || ob[k] >= 0) continue;
        let phi = Math.atan2(-nx, -ny) * 57.29578; if (phi < 0) phi += 180; if (phi >= 180) phi -= 180;
        ch[k] = lineCh(phi, off, !hz, true, nx < 0 ? -1 : 1); co[k] = col;
      }
    }
  }

  function buildColors(s, f) {
    s.lastC = f.C; s.lastH = f.H;
    const brass = s.mat === 'brass';
    s.cBall = []; s.cBase = []; s.cRod = []; s.cFloor = []; s.cStr = [];
    for (let k = 0; k < 64; k++) {
      const t = k / 63;
      if (brass) {
        s.cBall.push(t > 0.93 ? f.C(0.92 + (t - 0.93)) : f.H(40, 0.08 + t * 0.85));
        s.cBase.push(f.H(22, 0.06 + t * 0.7));
        s.cRod.push(f.H(38, 0.22 + t * 0.78));
        s.cFloor.push(f.H(28, 0.04 + t * 0.3));
      } else {
        s.cBall.push(f.C(0.1 + t * 0.9));
        s.cBase.push(f.C(0.06 + t * 0.8));
        s.cRod.push(f.C(0.12 + t * 0.88));
        s.cFloor.push(f.C(0.05 + t * 0.32));
      }
    }
    // 吊線：靠近相機的那條亮、遠的那條暗（16 階）
    for (let k = 0; k < 16; k++) { const t = k / 15; s.cStr.push(brass ? f.H(40, 0.3 + t * 0.26) : f.C(0.24 + t * 0.24)); }
    s.cBaseDot = brass ? f.H(26, 0.2) : f.C(0.17);
    s.cEdgeHi = brass ? f.H(34, 0.62) : f.C(0.56);
    s.cCap = f.C(0.42);
    s.cArc = f.C(0.3); s.cArcHi = f.C(0.5);
    s.cHi = f.C(1);
  }

  function render(s, f) {
    const g = f.g, cols = f.cols, rows = f.rows, A = f.aspect;
    const zb = s.zb, id = s.id, ob = s.ob, n = s.n;
    if (s.lastC !== f.C || s.lastH !== f.H) buildColors(s, f);
    zb.fill(1e9); id.fill(-1); ob.fill(-1); s.occ.fill(0);
    const F = s.F, uu = s.uu, rbx = s.rbx, rby = s.rby, rbz = s.rbz, rbv = s.rbv;
    for (let x = 0; x < cols; x++) uu[x] = (x + 0.5 - s.ccx) / F;
    for (let y = 0; y < rows; y++) { const v = (s.ccy - y - 0.5) * A / F; rbv[y] = v; rbx[y] = s.fx + v * s.ux; rby[y] = s.fy + v * s.uy; rbz[y] = s.fz + v * s.uz; }
    // 細桿在深度緩衝裡至少要有半列高，遮擋才會連續
    s.rrE = Math.max(s.rr, (s.pdist / F) * A * 0.45);
    const rr = s.rrE;
    for (let i = 0; i < n; i++) { s.bcx[i] = s.px[i] + s.L * Math.sin(s.th[i]); s.bcy[i] = s.Hp - s.L * Math.cos(s.th[i]); }
    for (let i = 0; i < n; i++) rasterSphere(s, f, s.bcx[i], s.bcy[i], 0, 1, i);
    for (let k = 0; k < 2; k++) {
      const zc = k ? s.zr : -s.zr, segs = 4;
      for (let q = 0; q < segs; q++) rasterCyl(s, f, 0, -s.X + (2 * s.X * q) / segs, -s.X + (2 * s.X * (q + 1)) / segs, s.yR, zc, rr, ID_ROD + k);
    }
    // 立柱：深度緩衝裡的寬度和畫出來的一樣（至少半欄），而且整根都會著色（見 shade），擋在球前面時是實心的，不會在球上切出一條黑縫
    const rrP = Math.max(s.rr, (s.pdist / F) * 0.5);
    for (let k = 0; k < 4; k++) rasterCyl(s, f, 1, 0, s.yR, k & 1 ? s.X : -s.X, k & 2 ? s.zr : -s.zr, rrP, ID_ROD + 2 + k);
    rasterBox(s, f, -s.bxw, -s.bh, -s.bzw, s.bxw, 0, s.bzw, ID_BASE);
    rodModes(s, f);
    shade(s, f);
    if (s.floor) floorDots(s, f);
    // 線條：底座的邊、框架、吊線、球的輪廓
    drawBaseEdges(s, f);
    for (let k = 0; k < 2; k++) { const zc = k ? s.zr : -s.zr; rod(s, f, k, -s.X, s.yR, zc, s.X, s.yR, zc); }
    for (let k = 0; k < 4; k++) { const xc = k & 1 ? s.X : -s.X, zc = k & 2 ? s.zr : -s.zr; rod(s, f, 2 + k, xc, 0, zc, xc, s.yR, zc); }
    // 吊線：每顆球兩條（V 字），近的亮、遠的暗
    const ez = s.ez, ezk = ez / (Math.abs(ez) + 4);
    const cN = s.cStr[Math.round(7.5 + 7.5 * ezk)], cF = s.cStr[Math.round(7.5 - 7.5 * ezk)];
    for (let i = 0; i < n; i++) {
      const sn = Math.sin(s.th[i]), cn = Math.cos(s.th[i]), Le = s.L - 1;
      const tx = s.px[i] + Le * sn, ty = s.Hp - Le * cn;
      if (!s.small) {
        line3(s, f, s.px[i], s.Hp, -s.zr, tx, ty, 0, cF, -9, 0, -1, true);
        line3(s, f, s.px[i], s.Hp, s.zr, tx, ty, 0, cN, -9, 0, -1, true);
      } else {
        // 縮圖：只畫靠近相機的那一條，比較乾淨
        line3(s, f, s.px[i], s.Hp, ez >= 0 ? s.zr : -s.zr, tx, ty, 0, cN, -9, 0, -1, true);
      }
    }
    if (s.playing && s.drag) swingArc(s, f, s.drag.i, true);
    const ord = s.ord;
    for (let i = 0; i < n; i++) { ord[i] = i; const qx = s.bcx[i] - s.ex, qy = s.bcy[i] - s.ey, qz = -s.ez; s.bcz[i] = qx * s.fx + qy * s.fy + qz * s.fz; }
    for (let a = 1; a < n; a++) { const v = ord[a]; let b = a - 1; while (b >= 0 && s.bcz[ord[b]] < s.bcz[v]) { ord[b + 1] = ord[b]; b--; } ord[b + 1] = v; }
    if (s.contour) for (let q = 0; q < n; q++) sphereContour(s, f, ord[q]);
    // 手上沒有球時：「現在按下去會抓到的那顆球」（pick）用這一格畫好的畫面來找，和下一格按下時抓到的一定是同一顆；
    // 畫出它可以擺動的弧線（只畫在空白的格子），有人在玩時再加上亮的輪廓和外圈
    const m = f.mouse;
    s.hover = s.playing && !s.drag && m && m.on && !m.down ? pick(s, f, m.x, m.y) : -1;
    if (s.hover >= 0) { swingArc(s, f, s.hover, false); if (s.idle < 6) hoverRing(s, f, s.hover); }
  }

  // 逐格著色：球（鏡面金屬）、底座、夠粗的金屬桿
  function shade(s, f) {
    const g = f.g, cols = f.cols, rows = f.rows, n = s.n, M = s.M;
    const zb = s.zb, id = s.id, ob = s.ob, occ = s.occ, ch = g.ch, co = g.co, uu = s.uu, rbx = s.rbx, rby = s.rby, rbz = s.rbz;
    const ex = s.ex, ey = s.ey, ez = s.ez, rx = s.rx, ry = s.ry, rz = s.rz;
    const lkx = s.lkx, lky = s.lky, lkz = s.lkz, lrx = s.lrx, lry = s.lry, lrz = s.lrz;
    const cBall = s.cBall, cBase = s.cBase, cRod = s.cRod, rodMode = s.rodMode;
    for (let y = 0; y < rows; y++) {
      let k = y * cols;
      for (let x = 0; x < cols; x++, k++) {
        const pid = id[k];
        if (pid < 0) continue;
        // 細的橫桿只畫線條（中間是空的），但擋在球前面的那幾格要填滿，球上才不會出現一條黑縫；立柱整根都填
        if (pid >= ID_ROD && pid - ID_ROD < 2 && rodMode[pid - ID_ROD] !== 3 && !occ[k]) continue;
        const u = uu[x], dx = rbx[y] + u * rx, dy = rby[y] + u * ry, dz = rbz[y] + u * rz, t = zb[k];
        const Px = ex + t * dx, Py = ey + t * dy, Pz = ez + t * dz;
        const dl = Math.sqrt(dx * dx + dy * dy + dz * dz), dnx = dx / dl, dny = dy / dl, dnz = dz / dl;
        if (pid < 20) {
          ob[k] = pid;
          const nx = Px - s.bcx[pid], ny = Py - s.bcy[pid], nz = Pz;
          const dn = dnx * nx + dny * ny + dnz * nz;
          const Rx = dnx - 2 * dn * nx, Ry = dny - 2 * dn * ny, Rz = dnz - 2 * dn * nz;
          const refl = traceRefl(s, Px, Py, Pz, Rx, Ry, Rz, pid);
          const ndl = nx * lkx + ny * lky + nz * lkz;
          const sh = ndl > -0.3 ? ballShadow(s, Px, Py, Pz, pid) : 0;
          const wrap = Math.max(0, (ndl + 0.35) / 1.35);
          const rim = Math.max(0, nx * lrx + ny * lry + nz * lrz), fres = 1 + dn, f2 = fres * fres, fr = M.F0 + (1 - M.F0) * f2 * f2 * fres;
          // 半向量高光（主光）
          let hx = lkx - dnx, hy = lky - dny, hz = lkz - dnz; const hl = Math.sqrt(hx * hx + hy * hy + hz * hz); hx /= hl; hy /= hl; hz /= hl;
          const nh = Math.max(0, nx * hx + ny * hy + nz * hz), n2 = nh * nh, n4 = n2 * n2, n8 = n4 * n4, n16 = n8 * n8, spec = n16 * n16 * n16;
          let ao = 1;
          for (let j = 0; j < n; j++) {
            if (j === pid) continue;
            const qx = s.bcx[j] - Px, qy = s.bcy[j] - Py, qz = -Pz, d2 = qx * qx + qy * qy + qz * qz;
            const dd = nx * qx + ny * qy + nz * qz;
            if (dd > 0) ao -= dd / (d2 * Math.sqrt(d2)) * 0.9;
          }
          if (ao < 0.2) ao = 0.2;
          // 鏡面反射為主（攝影棚的燈、地平線的暗帶、隔壁的球），加上一點形體明暗讓球保持圓潤，背光勾出邊緣
          let lum = (M.amb + M.kd * wrap * sh + M.kr * refl * fr + M.ks * spec * sh) * ao + M.rim * rim * rim * fres;
          if (lum > 1) lum = 1;
          let ci = (lum * NR + 0.5) | 0; if (ci < 2) ci = 2;
          ch[k] = RAMP[ci]; co[k] = cBall[(lum * 63) | 0];
        } else if (pid === ID_BASE) {
          // 底座：判斷是哪一面
          const ax = Math.abs(Px) / s.bxw, ay = Math.abs(Py + s.bh / 2) / (s.bh / 2), az = Math.abs(Pz) / s.bzw;
          let nx = 0, ny = 0, nz = 0;
          if (ay >= ax && ay >= az) ny = Py > -s.bh / 2 ? 1 : -1; else if (ax >= az) nx = Px > 0 ? 1 : -1; else nz = Pz > 0 ? 1 : -1;
          const ndl = Math.max(0, nx * lkx + ny * lky + nz * lkz);
          if (ny > 0) {
            const sh = ballShadow(s, Px, 0, Pz, -1);
            let ao = 1;
            for (let j = 0; j < n; j++) {
              const qx = s.bcx[j] - Px, qy = s.bcy[j], qz = -Pz, d2 = qx * qx + qy * qy + qz * qz;
              ao -= qy / (d2 * Math.sqrt(d2)) * 0.8;
            }
            // 亮面漆：像鏡子一樣映出上方的球（暗一點的倒影）
            const Rx = dnx, Ry = -dny, Rz = dnz;
            let refl = 0, bt = 1e9, bj = -1;
            for (let j = 0; j < n; j++) {
              const ox = Px - s.bcx[j], oy = -s.bcy[j], oz = Pz;
              const b = ox * Rx + oy * Ry + oz * Rz;
              if (b >= 0) continue;
              const h = b * b - (ox * ox + oy * oy + oz * oz - 1);
              if (h > 0) { const tt = -b - Math.sqrt(h); if (tt < bt) { bt = tt; bj = j; } }
            }
            if (bj >= 0) {
              const mx = Px + bt * Rx - s.bcx[bj], my = bt * Ry - s.bcy[bj], mz = Pz + bt * Rz;
              const w2 = Math.max(0, (mx * lkx + my * lky + mz * lkz + 0.35) / 1.35);
              refl = 0.1 + 0.32 * w2 * w2;
            }
            // 亮處落在「.」的正中間，影子是空白，倒影是「:」「-」
            const lum = ((0.02 + 0.19 * ndl * sh) * Math.max(0.3, ao) + refl) * s.baseK;
            if (refl === 0) { if (lum > 0.1) { ch[k] = '.'; co[k] = s.cBaseDot; } continue; }
            const l2 = lum > 1 ? 1 : lum;
            ch[k] = RAMP[(l2 * NR) | 0]; co[k] = cBase[(l2 * 63) | 0];
          } else if (ny === 0) {
            // 側面：順著長邊的細紋（字元固定，只改顏色，轉動時不會閃）；木頭底座多一點木紋
            const gr = s.wood ? 0.5 + 0.5 * Math.sin(Px * 1.7 + Py * 23 + 2.2 * Math.sin(Px * 0.45 + Pz)) : 0.5;
            const lum = s.wood ? 0.1 + 0.2 * ndl + 0.1 * gr : M.side + M.sideL * ndl;
            ch[k] = s.faceCh; co[k] = cBase[(lum * 63) | 0];
          }
        } else {
          // 粗的金屬桿：每格用桿的法線反射攝影棚
          const ri = pid - ID_ROD;
          let nx, ny, nz;
          if (ri < 2) { nx = 0; ny = Py - s.yR; nz = Pz - (ri ? s.zr : -s.zr); }
          else { const q = ri - 2; nx = Px - (q & 1 ? s.X : -s.X); ny = 0; nz = Pz - (q & 2 ? s.zr : -s.zr); }
          const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          const dn = dnx * nx + dny * ny + dnz * nz;
          // 立柱是一整排「|」（像有細紋的鍍鉻管），橫桿是「=」；亮暗只用顏色表現，轉動時字元不會閃
          const lum0 = 0.2 + 0.25 * Math.max(0, nx * lkx + ny * lky + nz * lkz) + 0.55 * envLum(s, dnx - 2 * dn * nx, dny - 2 * dn * ny, dnz - 2 * dn * nz);
          const lum = lum0 > 1 ? 1 : lum0;
          ch[k] = ri < 2 ? '=' : '|';
          co[k] = cRod[(lum * 63) | 0];
        }
      }
    }
  }

  // 地面：透視的點陣（只畫在空白處），越遠越暗，讓相機轉動時立體感更明顯
  function floorDots(s, f) {
    const A = f.aspect, cols = f.cols, rows = f.rows, id = s.id, ch = f.g.ch, co = f.g.co;
    const sp = s.fsp, Rx = s.bxw + 7, Rz = s.bzw + 7, y = -s.bh, nx = Math.ceil(Rx / sp), nz = Math.ceil(Rz / sp);
    const ymax = rows - s.capRows;
    for (let a = -nx; a <= nx; a++) {
      const x = a * sp;
      for (let b = -nz; b <= nz; b++) {
        const z = b * sp, w = 1 - (x * x) / (Rx * Rx) - (z * z) / (Rz * Rz);
        if (w <= 0) continue;
        if (proj(s, A, x, y, z) <= 0.05) continue;
        const cx = Math.floor(s.sx), cy = Math.floor(s.sy);
        if (cx < 0 || cy < 0 || cx >= cols || cy >= ymax) continue;
        const k = cy * cols + cx;
        if (id[k] !== -1 || ch[k] !== ' ') continue;
        // 靠近底座的地方有一點接觸陰影
        const ex = Math.max(0, Math.abs(x) - s.bxw), ez = Math.max(0, Math.abs(z) - s.bzw), near = Math.min(1, Math.hypot(ex, ez) / 1.2);
        const l = w * (0.35 + 0.65 * near);
        ch[k] = l > 0.55 ? ':' : '.'; co[k] = s.cFloor[(Math.min(1, l) * 63) | 0];
      }
    }
  }
  function drawBaseEdges(s, f) {
    const X = s.bxw, Z = s.bzw, Y0 = -s.bh, Y1 = 0;
    const vis = s.fvis;
    vis[0] = s.ex > X; vis[1] = s.ex < -X; vis[2] = s.ey > Y1; vis[3] = s.ey < Y0; vis[4] = s.ez > Z; vis[5] = s.ez < -Z;
    const E = s.edges;
    for (let k = 0; k < 12; k++) {
      const e = E[k];
      if (!vis[e[6]] && !vis[e[7]]) continue;
      if (e[6] !== 2 && e[7] !== 2) continue;   // 只畫頂面的邊（側面已經用字填滿了）
      line3(s, f, e[0] * X, e[1] ? Y1 : Y0, e[2] * Z, e[3] * X, e[4] ? Y1 : Y0, e[5] * Z, s.cEdgeHi, ID_BASE, 1e9, -1);
    }
  }
  // 滑鼠移到球上（或正在拖）時：淡淡的點線畫出這顆球可以擺動的弧線
  function swingArc(s, f, i, hi) {
    const A = f.aspect, cols = f.cols, ch = f.g.ch, co = f.g.co, zb = s.zb;
    const R = s.L + 1.15, M = s.thMax, N = 64, cur = s.th[i], ymax = f.rows - s.capRows;
    let lx = -9, ly = -9;
    for (let q = 0; q <= N; q++) {
      const th = -M + (2 * M * q) / N;
      const z = proj(s, A, s.px[i] + R * Math.sin(th), s.Hp - R * Math.cos(th), 0);
      if (z <= 0.05) continue;
      const cx = Math.floor(s.sx), cy = Math.floor(s.sy);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= ymax) continue;
      if (Math.abs(cx - lx) < 2 && cy === ly) continue;   // 點與點之間留一點空隙
      const k = cy * cols + cx;
      if (ch[k] !== ' ' || zb[k] < z) continue;
      ch[k] = '.'; co[k] = hi && Math.abs(th - cur) < 0.35 ? s.cArcHi : s.cArc;
      lx = cx; ly = cy;
    }
  }

  // ── 滑鼠 ──
  // 點選：先看游標那一格畫的是哪顆球（和畫面完全一致，連輪廓那一格也算），
  // 沒有的話用同一條光線做精確的球面測試（例如球被細桿擋住）；都沒打中就是寬容範圍：
  // 從相機看，游標和球心的夾角不到 PICK_R 倍球的視半徑（角半徑）的球裡，取倍數最小的那一顆（遠近不同的球一樣寬容），再遠就不抓
  function pick(s, f, mx, my) {
    const A = f.aspect, u = (mx - s.ccx) / s.F, v = (s.ccy - my) * A / s.F;
    const dx = s.fx + u * s.rx + v * s.ux, dy = s.fy + u * s.ry + v * s.uy, dz = s.fz + u * s.rz + v * s.uz;
    const a = dx * dx + dy * dy + dz * dz;
    const cx = Math.floor(mx), cy = Math.floor(my);
    let hit = -1;
    if (cx >= 0 && cy >= 0 && cx < f.cols && cy < f.rows) { const o = s.ob[cy * f.cols + cx]; if (o >= 0 && o < s.n) hit = o; }
    let best = 1e9, bi = -1, near = -1, nq = PICK_R;
    for (let i = 0; i < s.n; i++) {
      const ox = s.ex - s.bcx[i], oy = s.ey - s.bcy[i], oz = s.ez;
      const b = dx * ox + dy * oy + dz * oz, c = ox * ox + oy * oy + oz * oz - 1, h = b * b - a * c;
      if (h >= 0) { const t = (-b - Math.sqrt(h)) / a; if (t > 0 && t < best) { best = t; bi = i; } }
      else if (b < 0 && c > 0.01) {
        // 光線和「相機 → 球心」的夾角是球的角半徑的幾倍
        const D = Math.sqrt(c + 1), q = Math.acos(Math.min(1, -b / (Math.sqrt(a) * D))) / Math.asin(1 / D);
        if (q < nq) { nq = q; near = i; }
      }
    }
    if (hit < 0) hit = bi >= 0 ? bi : near;
    if (hit < 0) return -1;
    // 抓住的那一點：光線打到球面的點；沒打到球面（擦過或在球旁邊）就取光線上離球心最近的點：
    // 這一點就在游標底下，跟著球一起轉，拖動時它跟著游標走，球不會一抓就跳過去
    const ox = s.ex - s.bcx[hit], oy = s.ey - s.bcy[hit], oz = s.ez;
    const b = dx * ox + dy * oy + dz * oz, c = ox * ox + oy * oy + oz * oz - 1, h = b * b - a * c;
    const t = h >= 0 ? (-b - Math.sqrt(h)) / a : -b / a;
    s.gpx = s.ex + t * dx; s.gpy = s.ey + t * dy; s.gpz = s.ez + t * dz;
    return hit;
  }
  // 找出讓「抓住的那一點」投影最接近滑鼠的角度
  function dragAngle(s, f, mx, my) {
    const d = s.drag, A = f.aspect, i = d.i;
    const px = s.px[i], py = s.Hp;
    const cost = th => {
      const a = th - d.th0, ca = Math.cos(a), sa = Math.sin(a);
      const X = px + d.gx * ca - d.gy * sa, Y = py + d.gx * sa + d.gy * ca;
      const z = proj(s, A, X, Y, d.gz);
      if (z <= 0.05) return 1e12;
      const ddx = s.sx - mx, ddy = (s.sy - my) * A, dt = th - s.th[i];
      return ddx * ddx + ddy * ddy + dt * dt * 2;
    };
    const M = s.thMax;
    let bt = s.th[i], bc = cost(bt);
    for (let q = 0; q <= 48; q++) { const th = -M + (2 * M * q) / 48, c = cost(th); if (c < bc) { bc = c; bt = th; } }
    let step = (2 * M) / 48;
    for (let it = 0; it < 12; it++) {
      step *= 0.5;
      const c1 = cost(bt - step), c2 = cost(bt + step);
      if (c1 < bc && bt - step >= -M) { bc = c1; bt -= step; } else if (c2 < bc && bt + step <= M) { bc = c2; bt += step; }
    }
    return clamp(bt, -M, M);
  }
  function startDrag(s, i, mx, my) {
    s.drag = { i, th0: s.th[i], gx: s.gpx - s.px[i], gy: s.gpy - s.Hp, gz: s.gpz, tgt: s.th[i], om: 0, last: s.th[i], t0: s.time, mx, my, moved: 0, side: 0, v: 0 };
    // 點在球的哪一側（沿擺動方向）：快速點一下時把球往另一邊推
    s.drag.side = (s.gpx - s.bcx[i]) * Math.cos(s.th[i]) + (s.gpy - s.bcy[i]) * Math.sin(s.th[i]);
    s.kin[i] = 1; s.om[i] = 0;
  }
  // 在角度 th 時最多能有多快，球才會在 REL_TH 以內自己轉回來
  function relCap(s, th) { return Math.sqrt(Math.max(0, 2 * s.w2 * (Math.cos(th) - Math.cos(REL_TH)))); }
  function endDrag(s) {
    const d = s.drag; s.drag = null;
    const vm = relCap(s, s.th[d.i]);
    s.kin[d.i] = 0; s.om[d.i] = clamp(d.om, -vm, vm);
    // 很快的單擊（沒有拖動）→ 輕推那顆球
    if (s.time - d.t0 < 0.3 && d.moved < 1.2) nudge(s, d.i, d.side);
    s.Eref = energy(s);
  }
  function nudge(s, i, side) {
    if (Math.abs(s.om[i]) < 3) s.om[i] += side > 0 ? -2.2 : 2.2;
    const vm = relCap(s, s.th[i]); s.om[i] = clamp(s.om[i], -vm, vm);
    s.Eref = energy(s);
  }
  function input(s, f) {
    const m = f.mouse;
    if (!m) { s.playing = false; s.idle = Infinity; s.uIdle = Infinity; return; }
    const idle = typeof m.idle === 'number' && m.idle === m.idle ? m.idle : Infinity;
    s.idle = idle;
    // 轉過的視角要留多久（見 userCam）：按著滑鼠不動時 idle 不會更新，按著就當作一直在操作（和下面的 playing 一樣最多 60 秒）
    s.uIdle = (m.down || m.rdown) && idle < 60 ? 0 : idle;
    const playing = idle < 6 || ((!!m.down || !!m.rdown) && idle < 60);
    if (playing && !s.playing) {
      // 玩家接手：看不見的手放開
      if (s.ph === 'lift' || s.ph === 'hold' || s.ph === 'calm') releaseAll(s);
      s.ph = 'user';
    }
    // 玩家離開：讓球繼續擺一下再接手示範；說明文字先不寫顆數（還在擺的是玩家放的球，不是上一個示範花樣）
    if (!playing && s.playing) { if (s.drag) endDrag(s); s.ph = 'swing'; s.pt = 0; s.swingT = 5; s.hover = -1; s.curPat = null; }
    s.playing = playing;
    const down = !!m.down, clicks = m.clicks || [], rd = !!m.rdown;
    if (!playing) { s.wasDown = down; s.wasR = rd; return; }
    // 按住右鍵拖曳：轉動視角（左右 = 繞著牛頓擺轉，上下 = 抬高、降低鏡頭）。拖過一個螢幕高度大約轉半圈；
    // 開始拖動時從畫面上現在的視角開始（示範的鏡頭停在那裡，正在回去的話就停在半路）。按下右鍵沒有拖動（單純點一下右鍵，
    // 桌面上會叫出桌面選單）不算轉動視角
    if (rd) {
      if (!s.wasR) s.rPend = 1;
      else if (m.x !== s.rlx || m.y !== s.rly) {
        s.rPend = 0;
        if (!s.uv || s.uE > 0) camGrab(s);
        const S = Math.max(8, Math.min(f.cols, f.rows * f.aspect));
        s.uYawT -= Math.PI * (m.x - s.rlx) / S;
        s.uPitT = clamp(s.uPitT + Math.PI * (m.y - s.rly) * f.aspect / S, PIT_MIN, PIT_MAX);
      }
      s.rlx = m.x; s.rly = m.y;
    }
    s.wasR = rd;
    if (s.uv && s.uE > 0 && (down || m.wheel)) camGrab(s);
    if (m.wheel && !s.drag && !down) s.zoomU = clamp(s.zoomU * Math.exp(-m.wheel * 0.0012), 0.75, 1.5);
    // 按下：用點擊事件的位置（按下的那一刻）；只有「按住」沒有點擊事件時，就用目前位置
    if (down && !s.drag) {
      let px = NaN, py = NaN;
      if (clicks.length) { for (const c of clicks) if (!c.button) { px = c.x; py = c.y; } }
      else if (!s.wasDown) { px = m.x; py = m.y; }
      if (px === px) { const hit = pick(s, f, px, py); if (hit >= 0) startDrag(s, hit, px, py); }
    }
    if (s.drag) {
      if (!down) endDrag(s);
      else {
        const d = s.drag;
        d.moved = Math.max(d.moved, Math.hypot(m.x - d.mx, (m.y - d.my) * f.aspect));
        d.tgt = dragAngle(s, f, m.x, m.y);
      }
    } else if (!down) {
      // 按下和放開都發生在兩格之間（很快的點擊）→ 輕推
      for (const c of clicks) {
        if (c.button) continue;
        const hit = pick(s, f, c.x, c.y);
        if (hit < 0) continue;
        nudge(s, hit, (s.gpx - s.bcx[hit]) * Math.cos(s.th[hit]) + (s.gpy - s.bcy[hit]) * Math.sin(s.th[hit]));
      }
    }
    s.wasDown = down;
  }

  const SEED = ['tau', 'cspd', 'zoomU', 'time', 'pt', 'liftT', 'swingT', 'acc', 'Eref', 'gpx', 'gpy', 'gpz', 'rrE', 'F', 'ccx', 'ccy', 'ex', 'ey', 'ez',
    'fx', 'fy', 'fz', 'rx', 'ry', 'rz', 'ux', 'uy', 'uz', 'pyaw', 'ppit', 'pdist', 'bu0', 'bu1', 'bv0', 'bv1', 'w2', 'damp', 'rest', 'vrest', 'ctol',
    'ecap', 'L', 'Hp', 'c0', 'rr', 'yR', 'zr', 'X', 'bxw', 'bzw', 'bh', 'tgtY', 'baseK', 'sp', 'r', 'fsp', 'thMax', 'availW', 'availH', 'availCy', 'fitW', 'fitH', 'sx', 'sy',
    'evSV', 'evSX', 'evSY', 'evSW', 'idle', 'uIdle', 'uE', 'uw', 'uDur', 'uZ', 'uS', 'ubu', 'ubv', 'cbu', 'cbv', 'uYaw', 'uYawT', 'uPit', 'uPitT', 'uDist', 'udy', 'uF', 'uF0', 'Fd', 'dyaw', 'dpit', 'ddist',
    'vyaw', 'vpit', 'vdist', 'rlx', 'rly'];

  A({
    id: 'cradle3d', name: '3D 牛頓擺', cat: '遊戲', theme: 'mono', hue: false, interactive: true, sound: true,
    rightDrag: true,   // 按住右鍵拖曳轉動視角（f.mouse.rdown；全部變化款都是）
    desc: '會慢慢轉換視角的立體金屬牛頓擺；按住一顆球往外拉再放手，按住右鍵拖曳轉動視角，滾輪縮放',
    // 擺動週期 1.1 秒：示範時大約每 0.55 秒「鏘」一聲，接近音效參考的大型牛頓擺錄音（每 0.537 秒一聲）；黃銅款刻意慢一點
    params: { n: 5, len: 5.4, period: 1.1, cam: 'hero', mat: 'chrome', contour: true, floor: true },
    variants: [
      { id: 'seven', name: '七顆球', desc: '七顆球的長型牛頓擺，可以一次拉起更多顆', params: { n: 7, len: 6 } },
      { id: 'brass', name: '黃銅低角', theme: 'gold', hue: true, desc: '暖光下的黃銅球與木頭底座，低角度近拍', params: { mat: 'brass', cam: 'low', period: 1.45 } },
      { id: 'orbit', name: '環繞', desc: '相機慢慢繞著牛頓擺轉一整圈', params: { cam: 'orbit', len: 5 } },
      { id: 'front', name: '正面', desc: '幾乎正面的長焦視角，像原本的平面牛頓擺，但有光影和緩慢的視差', params: { cam: 'front', len: 6.2 } },
    ],
    init(s, f) {
      const p = f.p, n = clamp(p.n | 0, 2, 9), cols = Math.max(1, f.cols), rows = Math.max(1, f.rows), N = cols * rows;
      s.n = n; s.r = 1; s.sp = 2.02; s.L = p.len || 5.4; s.c0 = 1.8; s.Hp = s.c0 + s.L; s.rr = 0.1; s.yR = s.Hp + s.rr; s.zr = 2.0;
      s.px = new Float64Array(n); for (let i = 0; i < n; i++) s.px[i] = (i - (n - 1) / 2) * s.sp;
      // 框架的寬度：示範時擺最高（0.74 rad）的端球也不會超出立柱
      s.X = ((n - 1) / 2) * s.sp + s.L * Math.sin(0.78) + 1.45;
      s.bxw = s.X + 0.55; s.bzw = s.zr + 0.6; s.bh = 0.6; s.tgtY = (s.yR - s.bh) * 0.46;
      s.mat = p.mat; s.baseK = p.mat === 'brass' ? 1.6 : 1; s.wood = p.mat === 'brass'; s.contour = p.contour !== false;
      s.small = rows < 40; s.floor = p.floor !== false && !s.small; s.fsp = 1.2;
      // 底座側面：稀疏的「:」（木頭底座是「-」木紋），邊線只畫頂面那一圈，斜邊才不會變成一大片鋸齒
      s.faceCh = s.wood ? '-' : ':';
      // 材質：環境（反射裡的攝影棚）與球的打光比例
      s.M = p.mat === 'brass'
        ? { wall: 0.42, zen: 0.3, band: 0.05, gnd: 0.28, fill: 0.12, soft: 0.8, rimL: 0.5, strip: 0.45, nbr: 0.5, F0: 0.62, amb: 0.06, kd: 0.46, kr: 0.6, ks: 0.6, rim: 0.4, side: 0.08, sideL: 0.1 }
        : { wall: 0.48, zen: 0.36, band: 0.03, gnd: 0.3, fill: 0.14, soft: 0.95, rimL: 0.55, strip: 0.6, nbr: 0.5, F0: 0.72, amb: 0.04, kd: 0.4, kr: 0.7, ks: 0.55, rim: 0.35, side: 0.07, sideL: 0.12 };
      s.bcx = new Float64Array(n); s.bcy = new Float64Array(n); s.bcz = new Float64Array(n); s.ord = new Int32Array(n);
      // 物理
      s.th = new Float64Array(n); s.om = new Float64Array(n); s.kin = new Uint8Array(n); s.st = new Float64Array(n); s.tg = new Float64Array(n); s.pom = new Float64Array(n);
      s.w2 = Math.pow(TAU / (p.period || 1.3), 2); s.ctol = 0.03; s.rest = 0.985; s.vrest = 0.05; s.damp = 0.007; s.acc = 0; s.Eref = 0; s.thMax = 1.32;
      s.ecap = s.w2 * (1 - Math.cos(ECAP_TH));
      // 音效：示範時單顆球（從 0.74 rad 放開，見 startLift）撞上去的速度 = 音量 1；每一對鄰球多久沒碰過（子步）；這一格裡還沒發出的相撞
      s.vRef = 2 * s.L * Math.sqrt(s.w2) * Math.sin(0.74 / 2); s.vMin = SND_MIN * s.vRef; s.vMinH = SND_MIN_HELD * s.vRef;
      s.cAge = new Int32Array(n).fill(1e6); s.cHit = new Uint8Array(n); s.evAge = 1e6; s.evN = 0;
      s.evOpen = 0; s.evSV = 0; s.evSX = 0; s.evSY = 0; s.evSW = 0;   // 這一聲（evOpen = 還沒發出、還在收新接觸）
      s.evV = new Float64Array(4); s.evX = new Float64Array(4); s.evY = new Float64Array(4);
      // 示範
      s.seq = buildSeq(n); s.pat = 0; s.curPat = [1, 0]; s.ph = 'calm'; s.pt = 0; s.liftT = 0; s.swingT = 13;
      s.playing = false; s.wasDown = false; s.drag = null; s.hover = -1; s.time = 0; s.gpx = 0; s.gpy = 0; s.gpz = 0;
      // 相機與光
      s.camMode = p.cam; s.tau = 0; s.cspd = 1; s.zoomU = 1;
      // 使用者轉過的視角（見 camGrab、userCam）：一開始沒有；d* = 示範鏡頭的鏡位，v* = 畫面上的鏡位
      s.uv = 0; s.uE = 0; s.uw = 0; s.uDur = 0; s.uZ = 1; s.uS = 1; s.ubu = 0; s.ubv = 0; s.cbu = 0; s.cbv = 0; s.uYaw = 0; s.uYawT = 0; s.uPit = 0; s.uPitT = 0; s.uDist = 0; s.udy = 0; s.uF = 0; s.uF0 = 0; s.Fd = 0;
      s.dyaw = 0; s.dpit = 0; s.ddist = 0; s.vyaw = 0; s.vpit = 0; s.vdist = 0; s.wasR = false; s.rPend = 0; s.rlx = 0; s.rly = 0; s.idle = Infinity; s.uIdle = Infinity;
      if (s.camMode === 'orbit') buildOrbit(s);
      const L = Math.hypot(-0.45, 0.8, 0.5); s.lkx = -0.45 / L; s.lky = 0.8 / L; s.lkz = 0.5 / L;
      const L2 = Math.hypot(0.75, 0.3, -0.6); s.lrx = 0.75 / L2; s.lry = 0.3 / L2; s.lrz = -0.6 / L2;
      const L3 = Math.hypot(0.92, 0.38); s.sqx = 0.92 / L3; s.sqz = 0.38 / L3;
      // 畫面留邊：左右各 2 格、上面 1 列，最下面兩列給說明文字
      s.capRows = rows >= 20 ? 2 : 1;
      s.availW = Math.max(1, cols - 4); s.availH = Math.max(1, rows - s.capRows - 1); s.availCy = 1 + s.availH / 2;
      s.fitW = s.small ? 0.94 : 0.86; s.fitH = s.small ? 0.94 : 0.86;
      s.Ftab = buildFrameTable(s, f);
      // 緩衝
      s.zb = new Float32Array(N); s.id = new Int8Array(N); s.ob = new Int8Array(N); s.occ = new Uint8Array(N); s.fb = new Float32Array(N + 64);
      // 第一格在 render 之前就會處理滑鼠：id/ob 先填 -1（不是 0 號球），球心位置也先算好，點選才不會抓到不在游標下的球
      s.id.fill(-1); s.ob.fill(-1);
      s.uu = new Float32Array(cols); s.rbx = new Float32Array(rows); s.rby = new Float32Array(rows); s.rbz = new Float32Array(rows); s.rbv = new Float32Array(rows);
      s.fvis = [false, false, false, false, false, false]; s.rodMode = [1, 1, 1, 1, 1, 1]; s.rodCells = new Float64Array(6); s.rrE = s.rr;
      // 底座的 12 條邊：端點（x、z 用 ±1，y 用 0/1 = 底/頂）與相鄰的兩個面（0:+x 1:-x 2:+y 3:-y 4:+z 5:-z）
      s.edges = [
        [-1, 1, 1, 1, 1, 1, 2, 4], [-1, 1, -1, 1, 1, -1, 2, 5], [-1, 1, -1, -1, 1, 1, 2, 1], [1, 1, -1, 1, 1, 1, 2, 0],
        [-1, 0, 1, 1, 0, 1, 3, 4], [-1, 0, -1, 1, 0, -1, 3, 5], [-1, 0, -1, -1, 0, 1, 3, 1], [1, 0, -1, 1, 0, 1, 3, 0],
        [-1, 0, 1, -1, 1, 1, 1, 4], [1, 0, 1, 1, 1, 1, 0, 4], [-1, 0, -1, -1, 1, -1, 1, 5], [1, 0, -1, 1, 1, -1, 0, 5],
      ];
      s.lastC = null; s.lastH = null; s.sx = 0.5; s.sy = 0.5; s.x0 = 0; s.x1 = 0; s.y0 = 0; s.y1 = 0;
      // 一開始就是「剛放開」的樣子，不用等
      startLift(s); for (let i = 0; i < n; i++) s.th[i] = s.tg[i];
      releaseAll(s); s.ph = 'swing'; s.pt = 0; s.swingT = 13;
      poseAt(s, 0); s.dyaw = s.pyaw; s.dpit = s.ppit; s.ddist = s.pdist; setCamera(s, f, 0);
      for (let i = 0; i < n; i++) { s.bcx[i] = s.px[i] + s.L * Math.sin(s.th[i]); s.bcy[i] = s.Hp - s.L * Math.cos(s.th[i]); }
      // 會存小數的欄位先存一次小數、拖曳欄位先放一次物件：V8 一開始就用最後的欄位型別，
      // 第一次有人按滑鼠或第一次抬球時才不會整段程式重新最佳化（會卡一下）
      for (const k of SEED) { const v = s[k]; if (typeof v === 'number') { s[k] = 0.5; s[k] = v; } }
      s.drag = { i: 0, th0: 0.5, gx: 0.5, gy: 0.5, gz: 0.5, tgt: 0.5, om: 0.5, last: 0.5, t0: 0.5, mx: 0.5, my: 0.5, moved: 0.5, side: 0.5, v: 0.5 }; s.drag = null;
    },
    frame(s, f) {
      const dt = Number.isFinite(f.dt) ? Math.min(0.1, Math.max(0, f.dt)) : 1 / 30;
      s.time += dt;
      input(s, f);
      simulate(s, dt);
      // 相機：有人在玩就停住（按著滑鼠時完全不動），沒人玩再慢慢動起來
      const tgt = s.playing ? 0 : 1;
      if (s.drag || (f.mouse && (f.mouse.down || f.mouse.rdown) && s.playing)) s.cspd = 0;
      else s.cspd += (tgt - s.cspd) * (1 - Math.exp(-dt * (tgt < s.cspd ? 6 : 0.4)));
      if (s.cspd < 1e-3 && tgt === 0) s.cspd = 0;
      // 滾輪縮放：沒人玩就慢慢回到原來的大小（轉過的視角還在的時候由 userCam 處理：先留著，視角回去時一起回去）
      if (!s.playing && !s.uv) s.zoomU += (1 - s.zoomU) * (1 - Math.exp(-dt * 0.5));
      s.tau += dt * s.cspd;
      if (s.cspd > 0) { poseAt(s, s.tau); s.dyaw = s.pyaw; s.dpit = s.ppit; s.ddist = s.pdist; }
      if (s.uv) userCam(s, dt);
      setCamera(s, f, dt);
      if (s.evOpen && s.evAge > SND_FUSE) sndClose(s);
      if (s.evN) sndEmit(s, f);
      render(s, f);
      if (!s.playing) {
        // 說明文字（每一格依 f.lang 重新組，切換語言馬上生效）；操作說明放得下才加
        const p = s.curPat, k = p ? p[0] || p[1] : 0, g = f.g;
        const what = !p ? '' : p[0] && p[1] ? tr(f, '左 ' + p[0] + ' 顆、右 ' + p[1] + ' 顆', p[0] + ' from the left, ' + p[1] + ' from the right')
          : tr(f, '這次擺動 ' + k + ' 顆', k + (k === 1 ? ' ball' : ' balls') + ' swinging');
        let msg = what ? tr(f, '動量守恆　', 'Momentum conserved · ') + what : tr(f, '動量守恆', 'Momentum conserved');
        const hint = tr(f, '　·　按住鋼球往外拉再放手', ' · Drag a ball out and let go'), wide = f.cols >= 70;
        const fits = t => g.textW(t) + 4 <= f.cols;
        // 英文比較長：放不下時先拿掉「Momentum conserved ·」，顆數和操作說明（寬度 70 以上一定有，和中文一樣）留著
        if (f.lang === 'en' && what && !fits(wide ? msg + hint : msg)) msg = what;
        txtC(g, f.rows - 1, msg + (wide && fits(msg + hint) ? hint : ''), s.cCap);
      } else if (!s.drag && s.idle < 6 && f.cols >= 70) {
        // 有人在玩、手上沒有球：同一列改成操作說明（放不下時先拿掉右鍵那一句；寬度不到 70 不顯示）
        const g = f.g, fits = t => g.textW(t) + 4 <= f.cols;
        const a = tr(f, '按住鋼球左右拉、放開就會擺動', 'Pull a ball sideways and let go'), b = tr(f, '・按住右鍵拖曳可轉動視角', ' · Right-drag to rotate the view');
        if (fits(a + b)) txtC(g, f.rows - 1, a + b, s.cCap); else if (fits(a)) txtC(g, f.rows - 1, a, s.cCap);
      }
    },
  });
})();
