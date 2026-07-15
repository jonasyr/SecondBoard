import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import NavControls from './NavControls.svelte';

describe('NavControls', () => {
	it('renders 5 buttons and wires each callback', async () => {
		const onFirst = vi.fn();
		const onPrev = vi.fn();
		const onNext = vi.fn();
		const onLast = vi.fn();
		const { container } = render(NavControls, { props: { onFirst, onPrev, onNext, onLast } });
		const buttons = container.querySelectorAll('button');
		expect(buttons).toHaveLength(5); // First, Prev, big-Next, Next, Last

		await fireEvent.click(buttons[0]);
		expect(onFirst).toHaveBeenCalledOnce();
		await fireEvent.click(buttons[1]);
		expect(onPrev).toHaveBeenCalledOnce();
		await fireEvent.click(buttons[2]); // big center Next
		expect(onNext).toHaveBeenCalledOnce();
		await fireEvent.click(buttons[3]); // small Next
		expect(onNext).toHaveBeenCalledTimes(2);
		await fireEvent.click(buttons[4]);
		expect(onLast).toHaveBeenCalledOnce();
	});
});
