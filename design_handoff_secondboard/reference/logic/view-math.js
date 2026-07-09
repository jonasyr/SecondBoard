/*
 * view-math.js — PURE VIEW-GEOMETRY HELPERS (RUNTIME-FREE EXTRACTION)
 * -------------------------------------------------------------------
 * Extracted from reference/SecondBoard.dc.html → class Component.
 * Unlike chess-mock.js, THESE ARE NOT MOCKS — they are the exact math
 * that draws the board arrow, the eval graph, the captured-material row,
 * the skill radar, and the dashboard trend chart. They are stack-agnostic
 * and can be reused AS-IS in the SvelteKit frontend (they take plain data
 * and return SVG path strings / coordinates). Feed them REAL analysis data
 * from the Rust backend instead of the mock arrays in data.js.
 *
 * Coordinate system for the board: 8×8 over a 600×600 (or 100cqmin) space,
 * each square = 75 units, center of a square = col*75+37.5 / rowTop*75+37.5.
 */

const FILES = 'abcdefgh';

// --- Board pixel geometry (flip-aware) ---------------------------------
export function center(sq, flipped) {
  const f = FILES.indexOf(sq[0]), r = +sq[1];
  const col = flipped ? 7 - f : f;
  const rowTop = flipped ? r - 1 : 8 - r;
  return { x: col * 75 + 37.5, y: rowTop * 75 + 37.5 };
}

// Best-move arrow. w = shaft width (prototype uses 11). Knight moves bend
// at a right angle (L-shape); everything else is straight. Returns SVG
// path `shaft` + polygon `head` points, in the 600×600 board viewBox.
export function arrowGeom(fromSq, toSq, w, flipped) {
  const a = center(fromSq, flipped), b = center(toSq, flipped);
  const df = FILES.indexOf(toSq[0]) - FILES.indexOf(fromSq[0]);
  const dr = (+toSq[1]) - (+fromSq[1]);
  const knight = (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
  const P = (x, y) => x.toFixed(1) + ' ' + y.toFixed(1);
  const headLen = w * 1.7, headHalf = w * 1.25;
  if (knight) {
    const bend = Math.abs(dr) > Math.abs(df) ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
    const lx = b.x - bend.x, ly = b.y - bend.y, ll = Math.hypot(lx, ly), ux = lx / ll, uy = ly / ll, pxp = -uy, pyp = ux;
    const se = { x: b.x - ux * headLen, y: b.y - uy * headLen };
    return {
      shaft: 'M' + P(a.x, a.y) + ' L' + P(bend.x, bend.y) + ' L' + P(se.x, se.y),
      head: P(b.x, b.y) + ' ' + P(se.x + pxp * headHalf, se.y + pyp * headHalf) + ' ' + P(se.x - pxp * headHalf, se.y - pyp * headHalf),
    };
  }
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, pxp = -uy, pyp = ux;
  const se = { x: b.x - ux * headLen, y: b.y - uy * headLen }, st = { x: a.x + ux * (w * 0.2), y: a.y + uy * (w * 0.2) };
  return {
    shaft: 'M' + P(st.x, st.y) + ' L' + P(se.x, se.y),
    head: P(b.x, b.y) + ' ' + P(se.x + pxp * headHalf, se.y + pyp * headHalf) + ' ' + P(se.x - pxp * headHalf, se.y - pyp * headHalf),
  };
}

// --- Captured material -------------------------------------------------
// Diffs a position against the full starting army. Returns lists of the
// piece TYPES captured by each side (render your own sprites) + the net
// material advantage in points (positive = White is up).
// pos = { square: [type, color] }.
export function capturedInfo(pos) {
  const startEach = { P: 8, N: 2, B: 2, R: 2, Q: 1 }, val = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
  const cnt = { w: {}, b: {} };
  for (const sq in pos) { const p = pos[sq]; cnt[p[1]][p[0]] = (cnt[p[1]][p[0]] || 0) + 1; }
  const order = ['Q', 'R', 'B', 'N', 'P'];
  const whiteCap = [], blackCap = []; // whiteCap = black pieces White has captured
  let wMat = 0, bMat = 0;
  for (const t of order) {
    for (let i = 0; i < startEach[t] - (cnt.b[t] || 0); i++) whiteCap.push({ color: 'b', type: t });
    for (let i = 0; i < startEach[t] - (cnt.w[t] || 0); i++) blackCap.push({ color: 'w', type: t });
  }
  for (const t of order) { wMat += (cnt.w[t] || 0) * val[t]; bMat += (cnt.b[t] || 0) * val[t]; }
  return { whiteCap, blackCap, adv: wMat - bMat };
}

// --- Eval graph (viewBox 0 0 660 78) -----------------------------------
// evalPerPly: number[] centipawn/pawn evals, one per ply incl. index 0.
// classCodes: string[] classification code per move (length = plies-1).
// CLS: the classification map (see data.js) for dot colors.
// Returns SVG paths + notable-move dots + current-ply marker coordinates.
export function evalGraph(evalPerPly, classCodes, CLS, ply) {
  const ev = evalPerPly, W = 660, H = 78, mid = 39;
  const xOf = (i) => +(i / (ev.length - 1) * W).toFixed(1);
  const yOf = (v) => +(mid - Math.max(-5, Math.min(5, v)) / 5 * 34).toFixed(1);
  const line = ev.map((v, i) => (i ? 'L' : 'M') + xOf(i) + ' ' + yOf(v)).join(' ');
  const area = line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
  const notable = { brilliant: 1, great: 1, excellent: 1, inaccuracy: 1, mistake: 1, miss: 1, blunder: 1 };
  const dots = [];
  for (let i = 1; i < ev.length; i++) { const code = classCodes[i - 1]; if (notable[code]) dots.push({ cx: xOf(i), cy: yOf(ev[i]), color: CLS[code].color }); }
  return { evalLine: line, evalArea: area, evalDots: dots, markerX: xOf(ply), markerCX: xOf(ply), markerCY: yOf(ev[ply]) };
}

// --- Skill radar (SVG 220×220, center 110,110, R=78, 8 axes) -----------
// cats: [label, currentValue(0-100), baselineValue(0-100)] × 8.
export function radar(cats) {
  const cx = 110, cy = 110, R = 78;
  const pt = (val, i) => { const a = (i * 45 - 90) * Math.PI / 180, r = val / 100 * R; return { x: +(cx + r * Math.cos(a)).toFixed(1), y: +(cy + r * Math.sin(a)).toFixed(1) }; };
  const poly = (s) => cats.map((c, i) => { const p = pt(100 * s, i); return p.x + ',' + p.y; }).join(' ');
  const cur = cats.map((c, i) => pt(c[1], i)), base = cats.map((c, i) => pt(c[2], i)), axes = cats.map((c, i) => pt(100, i));
  const labels = cats.map((c, i) => { const a = (i * 45 - 90) * Math.PI / 180, r = R + 14, cos = Math.cos(a); return { label: c[0], x: +(cx + r * cos).toFixed(1), y: +(cy + r * Math.sin(a)).toFixed(1), anchor: Math.abs(cos) < 0.3 ? 'middle' : (cos > 0 ? 'start' : 'end') }; });
  return { ring1: poly(0.34), ring2: poly(0.67), ring3: poly(1), curPts: cur.map(p => p.x + ',' + p.y).join(' '), basePts: base.map(p => p.x + ',' + p.y).join(' '), radarAxes: axes, radarDots: cur, radarLabels: labels };
}

// --- Dashboard trend chart (viewBox 0 0 640 186) -----------------------
// rating / acc are arrays of already-scaled Y pixel values (lower = higher
// on screen). In the real app map real rating/accuracy series into pixel Y.
export function chartPaths(rating, acc) {
  const n = rating.length, xOf = (i) => +(i / (n - 1) * 640).toFixed(1);
  const line = (arr) => arr.map((y, i) => (i ? 'L' : 'M') + xOf(i) + ' ' + y).join(' ');
  const rl = line(rating);
  return { ratingLine: rl, ratingArea: rl + ' L640 186 L0 186 Z', accLine: line(acc) };
}

// --- Eval bar fill % (0..100, White's share of the bar) ----------------
export function evalBarPct(evNum) { return 50 + Math.max(-44, Math.min(44, evNum / 8 * 44)); }
