/**
 * Eval-graph geometry, ported verbatim from
 * design_handoff_secondboard/reference/logic/view-math.js's evalGraph()
 * (marked there as "NOT MOCKS — reusable as-is"; see LOGIC.md §3.1).
 * viewBox is always 0 0 660 78; the caller renders it at two different
 * SVG heights (66px in the Review tab, 62px in the shared bottom bar) —
 * that's purely a CSS/attribute concern on the <svg>, not this math.
 */
import { TOKENS } from '$lib/tokens';
import type { ClassCode } from '$lib/types';

export interface EvalGraphDot {
	cx: number;
	cy: number;
	color: string;
}

export interface EvalGraphResult {
	evalLine: string;
	evalArea: string;
	evalDots: EvalGraphDot[];
	markerX: number;
	markerCX: number;
	markerCY: number;
}

const NOTABLE_CODES = new Set<ClassCode>([
	'brilliant',
	'great',
	'excellent',
	'inaccuracy',
	'mistake',
	'miss',
	'blunder'
]);

const W = 660;
const H = 78;
const MID = 39;

export function evalGraph(
	evalPerPly: number[],
	classCodes: ClassCode[],
	ply: number
): EvalGraphResult {
	const xOf = (i: number) => Number(((i / (evalPerPly.length - 1)) * W).toFixed(1));
	const yOf = (v: number) => Number((MID - (Math.max(-5, Math.min(5, v)) / 5) * 34).toFixed(1));

	const line = evalPerPly.map((v, i) => (i ? 'L' : 'M') + xOf(i).toFixed(1) + ' ' + yOf(v).toFixed(1)).join(' ');
	const area = line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';

	const dots: EvalGraphDot[] = [];
	for (let i = 1; i < evalPerPly.length; i++) {
		const code = classCodes[i - 1];
		if (NOTABLE_CODES.has(code)) {
			dots.push({ cx: xOf(i), cy: yOf(evalPerPly[i]), color: TOKENS.classification[code].color });
		}
	}

	return {
		evalLine: line,
		evalArea: area,
		evalDots: dots,
		markerX: xOf(ply),
		markerCX: xOf(ply),
		markerCY: yOf(evalPerPly[ply])
	};
}
