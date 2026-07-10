import { describe, it, expect } from 'vitest';
import { TOKENS } from './tokens';

describe('TOKENS', () => {
	it('matches the exact color spec from README §4.2', () => {
		expect(TOKENS.color.appBg).toBe('#07080C');
		expect(TOKENS.color.cardBg).toBe('#14161F');
		expect(TOKENS.color.panelBg).toBe('#101219');
		expect(TOKENS.color.insetBg).toBe('#0F1119');
		expect(TOKENS.color.deepInsetBg).toBe('#0B0C12');
		expect(TOKENS.color.bottomBarBg).toBe('#0C0E15');
		expect(TOKENS.color.textPrimary).toBe('#F3F4F8');
		expect(TOKENS.color.textPrimaryAlt).toBe('#E3E6EE');
		expect(TOKENS.color.textTertiary).toBe('#8A90A0');
		expect(TOKENS.color.textMuted).toBe('#6B7180');
		expect(TOKENS.color.textMutedDark).toBe('#565C6B');
	});

	it('matches the exact accent spec from README §4.3', () => {
		expect(TOKENS.color.accentGreen).toBe('#4ADEA0');
		expect(TOKENS.color.accentTeal).toBe('#2DE0CE');
		expect(TOKENS.color.accentBlue).toBe('#60A5FA');
		expect(TOKENS.color.accentPurple).toBe('#A78BFA');
		expect(TOKENS.color.accentAmber).toBe('#F5B14C');
		expect(TOKENS.color.accentOrange).toBe('#F97A45');
		expect(TOKENS.color.accentRed).toBe('#F26B6B');
	});

	it('matches the exact board color spec from README §4.4', () => {
		expect(TOKENS.board.lightSquare).toBe('#5B5473');
		expect(TOKENS.board.darkSquare).toBe('#37344A');
		expect(TOKENS.board.evalBarTrack).toBe('#26232E');
	});

	it('matches the exact classification color spec from README §5', () => {
		expect(TOKENS.classification.brilliant.color).toBe('#2DE0CE');
		expect(TOKENS.classification.brilliant.glyph).toBe('!!');
		expect(TOKENS.classification.best.color).toBe('#4ADEA0');
		expect(TOKENS.classification.best.glyph).toBe('★');
		expect(TOKENS.classification.blunder.color).toBe('#F26B6B');
		expect(TOKENS.classification.blunder.glyph).toBe('??');
		expect(Object.keys(TOKENS.classification)).toHaveLength(10);
	});

	it('matches the exact spacing/radius spec from README §4.5', () => {
		expect(TOKENS.layout.sidebarWidthExpanded).toBe('236px');
		expect(TOKENS.layout.sidebarWidthCollapsed).toBe('70px');
		expect(TOKENS.layout.reviewPanelWidth).toBe('404px');
		expect(TOKENS.layout.titleBarHeight).toBe('38px');
		expect(TOKENS.radius.card).toBe('16px');
		expect(TOKENS.radius.board).toBe('12px');
		expect(TOKENS.radius.pill).toBe('20px');
	});
});
