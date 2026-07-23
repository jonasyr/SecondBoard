import { parseAnalyzeGameMessage } from './parse-analyze-frame.js';
import { buildEnvelope } from './build-envelope.js';
import { enqueue } from './retry-queue.js';

async function getConfig() {
	const stored = await chrome.storage.local.get(['ingestUrl', 'sharedToken', 'submittedBy']);
	return {
		ingestUrl: stored.ingestUrl ?? '',
		sharedToken: stored.sharedToken ?? '',
		submittedBy: stored.submittedBy ?? 'unknown'
	};
}

async function getQueue() {
	const stored = await chrome.storage.local.get(['retryQueue']);
	return stored.retryQueue ?? [];
}

async function setQueue(queue) {
	await chrome.storage.local.set({ retryQueue: queue });
}

async function sendEnvelope(config, envelope) {
	const response = await fetch(config.ingestUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'x-ingest-token': config.sharedToken },
		body: JSON.stringify(envelope)
	});
	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new Error(`ingest failed with status ${response.status}: ${detail}`);
	}
	await chrome.storage.local.set({
		lastSyncedAt: new Date().toISOString(),
		lastSyncedGameId: envelope.gameId
	});
}

async function updateBadge() {
	const queue = await getQueue();
	if (queue.length > 0) {
		await chrome.action.setBadgeText({ text: String(queue.length) });
		await chrome.action.setBadgeBackgroundColor({ color: '#c0392b' });
	} else {
		await chrome.action.setBadgeText({ text: '' });
	}
}

async function flushQueue() {
	const config = await getConfig();
	if (!config.ingestUrl) return;

	const queue = await getQueue();
	const remaining = [];
	for (const envelope of queue) {
		try {
			await sendEnvelope(config, envelope);
		} catch (error) {
			console.error('SecondBoard calibration: failed to sync queued game', envelope.gameId, error);
			remaining.push(envelope);
		}
	}
	await setQueue(remaining);
	await updateBadge();
}

async function captureAndSend(analyzeGameData, pageUrl) {
	const config = await getConfig();
	if (!config.ingestUrl) return;

	const envelope = buildEnvelope(analyzeGameData, pageUrl, config);
	if (!envelope.gameId) return;

	try {
		await sendEnvelope(config, envelope);
		await flushQueue();
	} catch (error) {
		console.error('SecondBoard calibration: failed to send captured game', envelope.gameId, error);
		const queue = await getQueue();
		await setQueue(enqueue(queue, envelope));
		await updateBadge();
	}
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type === 'raw-ws-message') {
		const analyzeGameData = parseAnalyzeGameMessage(message.rawMessageData);
		if (analyzeGameData) {
			captureAndSend(analyzeGameData, message.pageUrl);
		}
		return;
	}

	if (message?.type === 'manual-sync') {
		console.log('SecondBoard calibration: manual sync requested');
		flushQueue().then(async () => {
			const queue = await getQueue();
			console.log('SecondBoard calibration: manual sync finished, pending:', queue.length);
			sendResponse({ pendingCount: queue.length });
		});
		return true; // keep the message channel open for the async sendResponse
	}
});

chrome.runtime.onStartup.addListener(flushQueue);
chrome.runtime.onInstalled.addListener(flushQueue);
chrome.runtime.onStartup.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(updateBadge);
