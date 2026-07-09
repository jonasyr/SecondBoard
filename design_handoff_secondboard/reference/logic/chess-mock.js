/*
 * chess-mock.js — SAN → board-position engine (RUNTIME-FREE EXTRACTION)
 * ---------------------------------------------------------------------
 * Extracted verbatim (de-tangled from the DC runtime) from
 * reference/SecondBoard.dc.html → class Component. In the prototype this
 * is how a hardcoded move list becomes a piece map per ply, so the mock
 * board can render every position.
 *
 * ⚠ THIS IS A MOCK. It is a minimal, NON-legal-checking SAN interpreter
 * that only understands the moves it is fed. In the REAL app you MUST NOT
 * ship this — replace it with the Rust `pgn` module using `shakmaty`
 * (OVERVIEW §6.5, §8.3, §10.1). It is included ONLY to document the exact
 * DATA SHAPE the frontend board consumes:
 *
 *     positions[ply] = { <square>: [<pieceLetter>, <'w'|'b'>], ... }
 *     meta[i]        = { from: <square>, to: <square> }   // move i (0-based)
 *
 * where square = file+rank e.g. 'e4', pieceLetter ∈ {K,Q,R,B,N,P}.
 *
 * Your Rust backend should emit, per ply: FEN (or a piece map), plus the
 * from/to squares of the move that produced it. The frontend then renders
 * identically to this mock.
 */

export const FILES = 'abcdefgh';

export function standardBoard() {
  const b = {}, back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    b[FILES[f] + '1'] = [back[f], 'w']; b[FILES[f] + '2'] = ['P', 'w'];
    b[FILES[f] + '8'] = [back[f], 'b']; b[FILES[f] + '7'] = ['P', 'b'];
  }
  return b;
}

function clearPath(b, f, r, tf, tr) {
  const sf = Math.sign(tf - f), sr = Math.sign(tr - r);
  let cf = f + sf, cr = r + sr;
  while (cf !== tf || cr !== tr) { if (b[FILES[cf] + cr]) return false; cf += sf; cr += sr; }
  return true;
}

function canReach(b, piece, f, r, tf, tr) {
  const df = tf - f, dr = tr - r, af = Math.abs(df), ar = Math.abs(dr);
  if (piece === 'N') return (af === 1 && ar === 2) || (af === 2 && ar === 1);
  if (piece === 'K') return af <= 1 && ar <= 1;
  if (piece === 'B') return af === ar && df !== 0 && clearPath(b, f, r, tf, tr);
  if (piece === 'R') return (df === 0 || dr === 0) && clearPath(b, f, r, tf, tr);
  if (piece === 'Q') return (af === ar || df === 0 || dr === 0) && clearPath(b, f, r, tf, tr);
  return false;
}

// Mutates b, returns {from, to}. Handles castling, captures, promotions-as-move,
// and SAN disambiguation (file/rank hints). No legality/check validation.
export function applySan(b, sanRaw, color) {
  let san = sanRaw.replace(/[+#!?]/g, '');
  const rank = color === 'w' ? '1' : '8';
  if (san === 'O-O')   { b['g' + rank] = b['e' + rank]; delete b['e' + rank]; b['f' + rank] = b['h' + rank]; delete b['h' + rank]; return { from: 'e' + rank, to: 'g' + rank }; }
  if (san === 'O-O-O') { b['c' + rank] = b['e' + rank]; delete b['e' + rank]; b['d' + rank] = b['a' + rank]; delete b['a' + rank]; return { from: 'e' + rank, to: 'c' + rank }; }
  let piece = 'P';
  if ('KQRBN'.indexOf(san[0]) >= 0) { piece = san[0]; san = san.slice(1); }
  const capture = san.indexOf('x') >= 0; san = san.replace('x', '');
  const target = san.slice(-2); san = san.slice(0, -2);
  const tf = FILES.indexOf(target[0]), tr = +target[1];
  let disF = null, disR = null;
  for (const ch of san) { if (ch >= 'a' && ch <= 'h') disF = FILES.indexOf(ch); else if (ch >= '1' && ch <= '8') disR = +ch; }
  let from = null;
  if (piece === 'P') {
    if (capture) from = FILES[disF] + (color === 'w' ? tr - 1 : tr + 1);
    else {
      const one = color === 'w' ? tr - 1 : tr + 1;
      if (b[FILES[tf] + one] && b[FILES[tf] + one][0] === 'P') from = FILES[tf] + one;
      else from = FILES[tf] + (color === 'w' ? tr - 2 : tr + 2);
    }
  } else {
    for (const sq in b) {
      const p = b[sq];
      if (p[0] !== piece || p[1] !== color) continue;
      const f = FILES.indexOf(sq[0]), r = +sq[1];
      if (!canReach(b, piece, f, r, tf, tr)) continue;
      if (disF != null && f !== disF) continue;
      if (disR != null && r !== disR) continue;
      from = sq; break;
    }
  }
  delete b[target]; b[target] = [piece, color]; if (from) delete b[from];
  return { from, to: target };
}

// Given an array of SAN strings, returns { positions:[...ply maps], meta:[...{from,to}] }.
// positions has length sanList.length + 1 (index 0 = start position).
export function buildGame(sanList) {
  let b = standardBoard();
  const positions = [Object.assign({}, b)], meta = [];
  let color = 'w';
  for (const san of sanList) {
    const m = applySan(b, san, color);
    positions.push(Object.assign({}, b));
    meta.push(m);
    color = color === 'w' ? 'b' : 'w';
  }
  return { positions, meta };
}
