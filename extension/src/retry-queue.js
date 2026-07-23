const MAX_QUEUE_SIZE = 20;

/**
 * Returns a new queue with `envelope` appended, capped at MAX_QUEUE_SIZE
 * (the oldest entries are dropped first when over capacity).
 * @param {Array<object>} queue
 * @param {object} envelope
 * @returns {Array<object>}
 */
export function enqueue(queue, envelope) {
	const next = [...queue, envelope];
	if (next.length > MAX_QUEUE_SIZE) {
		return next.slice(next.length - MAX_QUEUE_SIZE);
	}
	return next;
}
