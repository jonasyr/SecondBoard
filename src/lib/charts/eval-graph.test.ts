import { describe, it, expect } from 'vitest';
import { evalGraph } from './eval-graph';
import type { ClassCode } from '$lib/types';

describe('evalGraph', () => {
	it('maps eval values to the 660x78 viewBox with a midline of 39', () => {
		const ev = [0, 0.3];
		const codes: ClassCode[] = ['best'];
		const result = evalGraph(ev, codes, 1);
		expect(result.evalLine).toBe('M0.0 39.0 L660.0 37.0');
		expect(result.evalArea).toBe('M0.0 39.0 L660.0 37.0 L660 78 L0 78 Z');
		expect(result.markerX).toBe(660);
		expect(result.markerCX).toBe(660);
		expect(result.markerCY).toBe(37.0);
	});

	it('clamps eval values to +/-5 before mapping to y', () => {
		const ev = [0, 12];
		const result = evalGraph(ev, ['best'], 1);
		expect(result.evalLine).toBe('M0.0 39.0 L660.0 5.0');
	});

	it('emits a dot only for notable classification codes, colored by TOKENS.classification', () => {
		const ev = [0, 0.3, 0.2, 0.3];
		const codes: ClassCode[] = ['book', 'brilliant', 'good'];
		const result = evalGraph(ev, codes, 0);
		expect(result.evalDots).toHaveLength(1);
		expect(result.evalDots[0]).toEqual({ cx: 440, cy: 37.6, color: '#2DE0CE' });
	});
});
