import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './format-relative-time.js';

describe('formatRelativeTime', () => {
	const now = new Date('2026-07-23T12:00:00Z');

	it('reads as "just now" under a minute', () => {
		expect(formatRelativeTime('2026-07-23T11:59:30Z', now)).toBe('just now');
	});

	it('formats minutes', () => {
		expect(formatRelativeTime('2026-07-23T11:55:00Z', now)).toBe('5 minutes ago');
	});

	it('formats singular units', () => {
		expect(formatRelativeTime('2026-07-23T11:00:00Z', now)).toBe('1 hour ago');
	});

	it('formats days', () => {
		expect(formatRelativeTime('2026-07-21T12:00:00Z', now)).toBe('2 days ago');
	});

	it('clamps timestamps in the future to "just now"', () => {
		expect(formatRelativeTime('2026-07-23T12:05:00Z', now)).toBe('just now');
	});
});
