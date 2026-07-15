/**
 * Imperative DOM piece-slide animation, ported from the reference's
 * _animateMove() steps 3-5 (LOGIC.md §2.4). Board.svelte calls this from an
 * $effect only when a single-step ply change is detected with the same flip
 * (the multi-step / different-flip guards live in Board.svelte, matching
 * the reference's componentDidUpdate guards).
 */
export function animateSlide(boardEl: HTMLElement, fromSq: string, toSq: string): void {
	boardEl.querySelectorAll('[data-sb-clone="1"]').forEach((clone) => clone.remove());
	boardEl.querySelectorAll<HTMLElement>('[data-sq] .piece').forEach((piece) => {
		piece.style.visibility = '';
	});

	if (fromSq === toSq) return;

	const startCell = boardEl.querySelector<HTMLElement>(`[data-sq="${fromSq}"]`);
	const endCell = boardEl.querySelector<HTMLElement>(`[data-sq="${toSq}"]`);
	if (!startCell || !endCell) return;

	const landing = endCell.querySelector<HTMLElement>('.piece');
	if (!landing) return;

	const boardRect = boardEl.getBoundingClientRect();
	const startRect = startCell.getBoundingClientRect();
	const endRect = endCell.getBoundingClientRect();

	const clone = landing.cloneNode(true) as HTMLElement;
	clone.setAttribute('data-sb-clone', '1');
	clone.style.position = 'absolute';
	clone.style.margin = '0';
	clone.style.zIndex = '7';
	clone.style.pointerEvents = 'none';
	clone.style.left = `${startRect.left - boardRect.left}px`;
	clone.style.top = `${startRect.top - boardRect.top}px`;
	clone.style.width = `${startRect.width}px`;
	clone.style.height = `${startRect.height}px`;
	clone.style.transition = 'none';
	clone.style.transform = 'translate(0,0)';
	boardEl.appendChild(clone);
	landing.style.visibility = 'hidden';
	void clone.getBoundingClientRect(); // force reflow before enabling the transition

	const dx = endRect.left - startRect.left;
	const dy = endRect.top - startRect.top;
	clone.style.transition = 'transform .17s cubic-bezier(.33,.9,.35,1)';
	clone.style.transform = `translate(${dx}px,${dy}px)`;

	const cleanup = () => {
		clone.remove();
		landing.style.visibility = '';
	};
	clone.addEventListener('transitionend', cleanup, { once: true });
	setTimeout(cleanup, 300);
}
