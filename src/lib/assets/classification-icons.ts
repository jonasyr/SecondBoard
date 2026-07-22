import type { ClassCode } from '$lib/types';
import brilliant from './chesscom-analysis-icons/svg/brilliant.svg?url';
import greatFind from './chesscom-analysis-icons/svg/great_find.svg?url';
import best from './chesscom-analysis-icons/svg/best.svg?url';
import excellent from './chesscom-analysis-icons/svg/excellent.svg?url';
import good from './chesscom-analysis-icons/svg/good.svg?url';
import book from './chesscom-analysis-icons/svg/book.svg?url';
import forced from './chesscom-analysis-icons/svg/forced.svg?url';
import inaccuracy from './chesscom-analysis-icons/svg/inaccuracy.svg?url';
import mistake from './chesscom-analysis-icons/svg/mistake.svg?url';
import missedWin from './chesscom-analysis-icons/svg/missed_win.svg?url';
import blunder from './chesscom-analysis-icons/svg/blunder.svg?url';

export const CLASSIFICATION_ICONS = {
	brilliant,
	great: greatFind,
	best,
	excellent,
	good,
	book,
	forced,
	inaccuracy,
	mistake,
	miss: missedWin,
	blunder
} satisfies Record<ClassCode, string>;
