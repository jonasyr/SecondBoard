import { formatRelativeTime } from './format-relative-time.js';

async function render() {
	const stored = await chrome.storage.local.get(['lastSyncedAt', 'retryQueue']);
	const lastSyncedEl = document.getElementById('last-synced');
	const pendingEl = document.getElementById('pending');

	lastSyncedEl.textContent = stored.lastSyncedAt
		? `Last Game Review synced: ${formatRelativeTime(stored.lastSyncedAt)}`
		: 'Last Game Review synced: never yet';

	const pendingCount = (stored.retryQueue ?? []).length;
	pendingEl.textContent = pendingCount > 0 ? `${pendingCount} game(s) waiting to sync` : '';
	pendingEl.className = pendingCount > 0 ? 'pending' : '';
}

render();
