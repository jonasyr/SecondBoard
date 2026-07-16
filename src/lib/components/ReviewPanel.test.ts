import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ReviewPanel from './ReviewPanel.svelte';
import { appState } from '$lib/stores/app-state.svelte';
import { SAMPLE_SAN_LIST_EXPORT, SAMPLE_POSITIONS, SAMPLE_MOVE_META } from '$lib/game/mock-data';

beforeEach(() => {
	appState.tab = 'analysis';
	appState.ply = 31;
	appState.flipped = false;
	appState.game = {
		sanList: SAMPLE_SAN_LIST_EXPORT,
		positions: SAMPLE_POSITIONS,
		moveMeta: SAMPLE_MOVE_META,
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
