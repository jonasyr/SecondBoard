import { formatRelativeTime } from './format-relative-time.js';

async function loadState() {
	const stored = await chrome.storage.local.get(['lastSyncedAt', 'retryQueue', 'ingestUrl']);
	return {
		lastSyncedAt: stored.lastSyncedAt ?? null,
		pendingCount: (stored.retryQueue ?? []).length,
		configured: Boolean(stored.ingestUrl)
	};
}

function render(state) {
	const dot = document.getElementById('status-dot');
	const lastSyncedEl = document.getElementById('last-synced');
	const pendingEl = document.getElementById('pending');
	const hintEl = document.getElementById('config-hint');
	const syncButton = document.getElementById('sync-now');

	lastSyncedEl.textContent = state.lastSyncedAt
		? `Last Game Review synced: ${formatRelativeTime(state.lastSyncedAt)}`
		: 'Last Game Review synced: never yet';

	if (state.pendingCount > 0) {
		pendingEl.textContent = `${state.pendingCount} game(s) waiting to sync`;
		pendingEl.hidden = false;
		dot.className = 'dot pending';
	} else {
		pendingEl.hidden = true;
		dot.className = state.lastSyncedAt ? 'dot ok' : 'dot';
	}

	hintEl.hidden = state.configured;
	syncButton.disabled = !state.configured;
}

document.getElementById('open-options').addEventListener('click', () => {
	chrome.runtime.openOptionsPage();
});

document.getElementById('sync-now').addEventListener('click', async () => {
	const button = document.getElementById('sync-now');
	button.disabled = true;
	button.textContent = 'Syncing…';

	await chrome.runtime.sendMessage({ type: 'manual-sync' });
	render(await loadState());

	button.textContent = 'Sync now';
	button.disabled = false;
});

render(await loadState());
