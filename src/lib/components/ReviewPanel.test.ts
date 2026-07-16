import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ReviewPanel from './ReviewPanel.svelte';
import { appState } from '$lib/stores/app-state.svelte';
import { SAN_LIST } from '$lib/game/mock-data';

// Self-contained fixture: real sample SAN list (still legitimate mock content in
// mock-data.ts) paired with placeholder positions/moveMeta — this panel-level
// test only asserts on tab switching and move-list row presence, not on real
// chess position content.
const positions = Array.from({ length: SAN_LIST.length + 1 }, () => ({}));
const moveMeta = Array.from({ length: SAN_LIST.length }, () => ({ from: 'a2', to: 'a3' }));

beforeEach(() => {
	appState.tab = 'analysis';
	appState.ply = 31;
	appState.flipped = false;
	appState.game = {
		sanList: SAN_LIST,
		positions,
		moveMeta,
		isSample: true
	};
});

describe('ReviewPanel', () => {
	it('renders all 4 tab buttons and shows the Analysis tab by default', () => {
		const { getByText, container } = render(ReviewPanel, {
			props: { onToggleFlip: () => {}, onOpenOpenings: () => {} }
		});
		expect(getByText('Analysis')).toBeTruthy();
		expect(getByText('Review')).toBeTruthy();
		expect(getByText('Details')).toBeTruthy();
		expect(getByText('Explore')).toBeTruthy();
		expect(container.querySelectorAll('.row')).not.toHaveLength(0); // MoveList rows present
	});

	it('switches tabs on click and hides the bottom bar only on the Review tab', async () => {
		const { getByText, container } = render(ReviewPanel, {
			props: { onToggleFlip: () => {}, onOpenOpenings: () => {} }
		});
		expect(container.querySelector('.bottom-bar')).not.toBeNull();

		await fireEvent.click(getByText('Review'));
		expect(appState.tab).toBe('review');
		expect(container.querySelector('.bottom-bar')).toBeNull();

		await fireEvent.click(getByText('Details'));
		expect(appState.tab).toBe('details');
		expect(container.querySelector('.bottom-bar')).not.toBeNull();
	});

	it('calls onToggleFlip when the flip button is clicked', async () => {
		const onToggleFlip = vi.fn();
		const { container } = render(ReviewPanel, {
			props: { onToggleFlip, onOpenOpenings: () => {} }
		});
		await fireEvent.click(container.querySelector('.flip-btn')!);
		expect(onToggleFlip).toHaveBeenCalledOnce();
	});
});
