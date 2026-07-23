const UNITS = [
	['year', 365 * 24 * 60 * 60],
	['month', 30 * 24 * 60 * 60],
	['day', 24 * 60 * 60],
	['hour', 60 * 60],
	['minute', 60]
];

/**
 * Formats an ISO timestamp as a coarse "N units ago" string relative to
 * `now` (defaults to the current time). Anything under a minute reads as
 * "just now".
 */
export function formatRelativeTime(isoTimestamp, now = new Date()) {
	const then = new Date(isoTimestamp);
	const diffSeconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));

	if (diffSeconds < 60) return 'just now';

	for (const [unit, unitSeconds] of UNITS) {
		const count = Math.floor(diffSeconds / unitSeconds);
		if (count >= 1) {
			return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
		}
	}

	return 'just now';
}
