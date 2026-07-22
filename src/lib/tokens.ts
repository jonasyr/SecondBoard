import type { ClassCode } from './types';
import { CLASSIFICATION_ICONS } from './assets/classification-icons';

/**
 * Single source of truth for the SecondBoard design system.
 * Every value here is copied verbatim from design_handoff_secondboard/README.md §4-5.
 * Do NOT approximate — if a value looks wrong, re-check the README/reference before changing it.
 * app.css mirrors this object into CSS custom properties; keep them in sync.
 */
export const TOKENS = {
	color: {
		appBg: '#07080C',
		sidebarGradient: 'linear-gradient(180deg,#0D0F17,#0A0B12)',
		titleBarGradient: 'linear-gradient(180deg,#111420,#0C0E16)',
		cardBg: '#14161F',
		panelBg: '#101219',
		insetBg: '#0F1119',
		deepInsetBg: '#0B0C12',
		bottomBarBg: '#0C0E15',
		textPrimary: '#F3F4F8',
		textPrimaryAlt: '#E3E6EE',
		textSecondary: '#C7CCDA',
		textSecondaryAlt: '#B8BDCC',
		textSecondaryAlt2: '#9298A8',
		textSecondaryAlt3: '#9AA0B0',
		textTertiary: '#8A90A0',
		textMuted: '#6B7180',
		textMutedDark: '#565C6B',
		// Chrome (title bar / sidebar) additions — Iteration 2, README §6.1.
		windowDotGrey: '#3A3F4E',
		activeItemText: '#EAF6F0',
		hairlineLow: 'rgba(255,255,255,.05)',
		hairlineHigh: 'rgba(255,255,255,.08)',
		accentGreen: '#4ADEA0',
		accentTeal: '#2DE0CE',
		lightGreen1: '#8FE9C2',
		lightGreen2: '#86E5A8',
		lightGreen3: '#5EF0DE',
		linkHoverGreen: '#74ECBC',
		accentBlue: '#60A5FA',
		accentBlueAlt: '#3B82F6',
		accentIndigo: '#6366F1',
		accentPurple: '#A78BFA',
		accentPurpleAlt: '#8B5CF6',
		missPurple: '#C77DFF',
		accentAmber: '#F5B14C',
		accentOrange: '#F97A45',
		accentRed: '#F26B6B',
		ctaPrimaryGradient: 'linear-gradient(135deg,#4ADEA0,#2DE0CE)',
		ctaPrimaryText: '#062018',
		ctaBlueGradient: 'linear-gradient(135deg,#3B82F6,#6366F1)',
		ctaPurpleGradient: 'linear-gradient(135deg,#A78BFA,#8B5CF6)',
		logoGradient: 'linear-gradient(140deg,#2DE0CE,#3B82F6 55%,#A78BFA)'
	},
	board: {
		lightSquare: '#5B5473',
		darkSquare: '#37344A',
		lastMoveAlphaHex: '52',
		evalBarTrack: '#26232E',
		evalWhiteFillFrom: '#F4F5FA',
		evalWhiteFillTo: '#DDE1EC',
		evalMidline: 'rgba(45,224,206,.5)',
		coordOnDark: 'rgba(255,255,255,.30)',
		coordOnLight: 'rgba(20,20,30,.34)'
	},
	radius: {
		card: '16px',
		inset: '12px',
		control: '10px',
		pill: '20px',
		chip: '9px',
		board: '12px'
	},
	shadow: {
		board: '0 20px 60px rgba(0,0,0,.5)',
		ctaGlow: '0 8px 22px rgba(74,222,160,.3)'
	},
	layout: {
		sidebarWidthExpanded: '236px',
		sidebarWidthCollapsed: '70px',
		reviewPanelWidth: '404px',
		titleBarHeight: '38px',
		navRowPadding: '9px 11px',
		navRowGap: '11px'
	},
	scrollbar: {
		size: '9px',
		thumb: '#262A38',
		thumbHover: '#363B4E',
		radius: '20px'
	},
	font: {
		sans: "'Geist', -apple-system, system-ui, sans-serif",
		mono: "'Geist Mono', ui-monospace, monospace"
	},
	classification: {
		brilliant: { name: 'Brilliant', word: 'brilliant', color: '#1bada6', glyph: '!!', icon: CLASSIFICATION_ICONS.brilliant },
		great: { name: 'Great', word: 'a great move', color: '#1bada6', glyph: '!', icon: CLASSIFICATION_ICONS.great },
		best: { name: 'Best', word: 'the best move', color: '#96bc4b', glyph: '★', icon: CLASSIFICATION_ICONS.best },
		excellent: { name: 'Excellent', word: 'excellent', color: '#96bc4b', glyph: '✦', icon: CLASSIFICATION_ICONS.excellent },
		good: { name: 'Good', word: 'a good move', color: '#96af8b', glyph: '✓', icon: CLASSIFICATION_ICONS.good },
		book: { name: 'Book', word: 'a book move', color: '#a88865', glyph: '◈', icon: CLASSIFICATION_ICONS.book },
		forced: { name: 'Forced', word: 'a forced move', color: '#7c94a8', glyph: '⇥', icon: CLASSIFICATION_ICONS.forced },
		inaccuracy: { name: 'Inaccuracy', word: 'an inaccuracy', color: '#f7c045', glyph: '?!', icon: CLASSIFICATION_ICONS.inaccuracy },
		mistake: { name: 'Mistake', word: 'a mistake', color: '#e58f2a', glyph: '?', icon: CLASSIFICATION_ICONS.mistake },
		miss: { name: 'Miss', word: 'a miss', color: '#dbac16', glyph: '✕', icon: CLASSIFICATION_ICONS.miss },
		blunder: { name: 'Blunder', word: 'a blunder', color: '#ca3431', glyph: '??', icon: CLASSIFICATION_ICONS.blunder }
	} satisfies Record<ClassCode, { name: string; word: string; color: string; glyph: string; icon: string }>,
	review: {
		avatarWhiteBg: '#EDEFF6',
		avatarWhiteBorder: 'rgba(255,255,255,.15)',
		avatarWhiteText: '#14161F',
		avatarBlackBg: 'linear-gradient(135deg,#3B4252,#20222E)',
		avatarBlackBorder: 'rgba(255,255,255,.1)',
		avatarBlackText: '#C7CCDA',
		clockActiveBg: 'rgba(45,224,206,.12)',
		clockActiveText: '#5EF0DE',
		clockInactiveBg: '#14161F',
		clockInactiveText: '#6B7180',
		newGameBg: '#181A24',
		newGameBorder: 'rgba(255,255,255,.08)',
		newGameText: '#C7CCDA',
		evalGraphBg: '#20222E',
		evalGraphArea: '#EFF1F6',
		evalGraphMidline: '#2DE0CE',
		evalGraphLine: '#8A90A0',
		chipNeutralBg: '#181A24',
		chipNeutralBorder: 'rgba(255,255,255,.1)',
		chipNeutralText: '#E3E6EE',
		chipTintedBg: 'rgba(74,222,160,.06)',
		chipTintedBorder: 'rgba(74,222,160,.4)',
		chipTintedText: '#8FE9C2',
		capturedSpriteShadow: 'drop-shadow(0 1px 1.5px rgba(0,0,0,.5))',
		// Black piece sprites are solid #000 with no light outline of their own,
		// so the dark drop-shadow above (meant for white sprites) leaves them
		// nearly invisible against the panel's dark background — this gives
		// captured black pieces a light halo instead.
		capturedSpriteShadowBlack:
			'drop-shadow(0 0 1px rgba(255,255,255,.55)) drop-shadow(0 0 1px rgba(255,255,255,.55))',
		navBtnBg: '#14161F',
		navBtnBorder: 'rgba(255,255,255,.07)',
		navBtnStroke: '#9298A8'
	}
} as const;

export const DARK_FG_CODES: ClassCode[] = [
	'brilliant',
	'best',
	'excellent',
	'good',
	'book',
	'forced',
	'inaccuracy'
];

export const NOT_BEST_CODES: ClassCode[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];
