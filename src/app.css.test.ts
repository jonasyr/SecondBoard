import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const css = () => readFileSync(join(__dirname, './app.css'), 'utf-8');

describe('app.css', () => {
	it('imports every required font weight', () => {
		const content = css();
		expect(content).toContain("@import '@fontsource/geist-sans/300.css'");
		expect(content).toContain("@import '@fontsource/geist-sans/800.css'");
		expect(content).toContain("@import '@fontsource/geist-mono/400.css'");
		expect(content).toContain("@import '@fontsource/geist-mono/600.css'");
	});

	it('defines the exact color custom properties from TOKENS', () => {
		const content = css();
		expect(content).toContain('--color-app-bg: #07080C');
		expect(content).toContain('--color-accent-green: #4ADEA0');
		expect(content).toContain('--color-accent-teal: #2DE0CE');
		expect(content).toContain('--board-light-square: #5B5473');
		expect(content).toContain('--board-dark-square: #37344A');
	});

	it('defines the chrome-specific custom properties added in Iteration 2 (README §6.1)', () => {
		const content = css();
		expect(content).toContain('--color-window-dot: #3A3F4E');
		expect(content).toContain('--color-active-item-text: #EAF6F0');
		expect(content).toContain('--layout-nav-row-padding: 9px 11px');
		expect(content).toContain('--layout-nav-row-gap: 11px');
	});

	it('defines the .sbmono and .sbscroll utility classes', () => {
		const content = css();
		expect(content).toContain('.sbmono');
		expect(content).toContain("font-feature-settings: 'tnum' 1");
		expect(content).toContain('.sbscroll');
	});

	it('defines the bpulse and softfloat keyframes', () => {
		const content = css();
		expect(content).toContain('@keyframes bpulse');
		expect(content).toContain('@keyframes softfloat');
	});

	it('applies box-sizing: border-box globally and antialiased body text', () => {
		const content = css();
		expect(content).toContain('box-sizing: border-box');
		expect(content).toContain('-webkit-font-smoothing: antialiased');
	});
});
