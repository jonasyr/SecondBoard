import { describe, it, expect } from 'vitest';
import { center, arrowGeom, capturedInfo, evalBarPct } from './geometry';
import type { Position } from './types';

describe('center', () => {
	it('maps e4 to its pixel center, unflipped', () => {
		// f=4 (e), r=4 -> col=4, rowTop=8-4=4 -> x=4*75+37.5=337.5, y=337.5
		expect(center('e4', false)).toEqual({ x: 337.5, y: 337.5 });
	});

	it('maps e4 to its pixel center, flipped', () => {
		// col=7-4=3, rowTop=4-1=3 -> x=3*75+37.5=262.5, y=262.5
		expect(center('e4', true)).toEqual({ x: 262.5, y: 262.5 });
	});

	it('maps a1 to the bottom-left corner region, unflipped', () => {
		// f=0, r=1 -> col=0, rowTop=8-1=7 -> x=37.5, y=7*75+37.5=562.5
		expect(center('a1', false)).toEqual({ x: 37.5, y: 562.5 });
	});
});

describe('arrowGeom', () => {
	it('produces a straight shaft for a non-knight move (e2-e4)', () => {
		const g = arrowGeom('e2', 'e4', 11, false);
		expect(g.shaft.startsWith('M')).toBe(true);
		expect(g.shaft).toContain('L');
		expect(g.head.split(' ').length).toBeGreaterThanOrEqual(6); // 3 points x,y pairs
	});

	it('bends at a right angle for a knight move (f3-g5)', () => {
		const straight = arrowGeom('e2', 'e4', 11, false);
		const knight = arrowGeom('f3', 'g5', 11, false);
		// A knight-move shaft has two line segments (two 'L's); a straight one has one.
		const countL = (s: string) => (s.match(/L/g) ?? []).length;
		expect(countL(knight.shaft)).toBe(2);
		expect(countL(straight.shaft)).toBe(1);
	});
});

describe('capturedInfo', () => {
	const STANDARD_START: Position = {
		a1: ['R', 'w'], b1: ['N', 'w'], c1: ['B', 'w'], d1: ['Q', 'w'], e1: ['K', 'w'], f1: ['B', 'w'], g1: ['N', 'w'], h1: ['R', 'w'],
		a2: ['P', 'w'], b2: ['P', 'w'], c2: ['P', 'w'], d2: ['P', 'w'], e2: ['P', 'w'], f2: ['P', 'w'], g2: ['P', 'w'], h2: ['P', 'w'],
		a7: ['P', 'b'], b7: ['P', 'b'], c7: ['P', 'b'], d7: ['P', 'b'], e7: ['P', 'b'], f7: ['P', 'b'], g7: ['P', 'b'], h7: ['P', 'b'],
		a8: ['R', 'b'], b8: ['N', 'b'], c8: ['B', 'b'], d8: ['Q', 'b'], e8: ['K', 'b'], f8: ['B', 'b'], g8: ['N', 'b'], h8: ['R', 'b']
	};

	it('returns no captures and zero advantage for the standard starting position', () => {
		expect(capturedInfo(STANDARD_START)).toEqual({ whiteCap: [], blackCap: [], adv: 0 });
	});

	it('counts a single missing black pawn as a White capture with +1 advantage', () => {
		const pos: Position = { ...STANDARD_START };
		delete pos.e7;
		const result = capturedInfo(pos);
		expect(result.whiteCap).toEqual([{ color: 'b', type: 'P' }]);
		expect(result.blackCap).toEqual([]);
		expect(result.adv).toBe(1);
	});
});

describe('evalBarPct', () => {
	it('returns 50 (even) for an eval of 0', () => {
		expect(evalBarPct(0)).toBe(50);
	});

	it('scales linearly within the ±8 pawn range', () => {
		expect(evalBarPct(4)).toBe(72);
		expect(evalBarPct(-4)).toBe(28);
	});

	it('clamps at ±44 around 50 for evals beyond ±8', () => {
		expect(evalBarPct(20)).toBe(94);
		expect(evalBarPct(-20)).toBe(6);
	});
});
