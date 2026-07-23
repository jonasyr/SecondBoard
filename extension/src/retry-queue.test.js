import { describe, it, expect } from 'vitest';
import { enqueue } from './retry-queue.js';

describe('enqueue', () => {
	it('appends to an empty queue', () => {
		expect(enqueue([], { id: 1 })).toEqual([{ id: 1 }]);
	});

	it('caps the queue at 20 entries, dropping the oldest', () => {
		const full = Array.from({ length: 20 }, (_, i) => ({ id: i }));
		const result = enqueue(full, { id: 20 });
		expect(result).toHaveLength(20);
		expect(result[0]).toEqual({ id: 1 });
		expect(result[19]).toEqual({ id: 20 });
	});
});
