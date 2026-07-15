import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import CoachCard from './CoachCard.svelte';

describe('CoachCard', () => {
	it('renders the move, title word, eval, and coach text', () => {
		const { getByText, container } = render(CoachCard, {
			props: {
				classCode: 'brilliant',
				coachMove: '16. Ne5',
				coachText: 'This move creates a strong threat...',
				evalStr: '+2.37',
				best: null
			}
		});
		expect(getByText('16. Ne5')).toBeTruthy();
		expect(container.querySelector('.word')?.textContent).toContain('is brilliant');
		expect(getByText('+2.37')).toBeTruthy();
	});

	it('shows the "Best was" strip only when best is provided', () => {
		const { queryByText } = render(CoachCard, {
			props: {
				classCode: 'inaccuracy',
				coachMove: '15. d5',
				coachText: 'A small slip...',
				evalStr: '+1.05',
				best: { from: 'c8', to: 'g4', san: 'Bg4' }
			}
		});
		expect(queryByText('Bg4')).not.toBeNull();
		expect(queryByText('Best was')).not.toBeNull();
		cleanup();

		const { queryByText: q2 } = render(CoachCard, {
			props: {
				classCode: 'best',
				coachMove: '16. Ne5',
				coachText: "Engine's top choice.",
				evalStr: '+2.37',
				best: null
			}
		});
		expect(q2('Best was')).toBeNull();
	});
});
