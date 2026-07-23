import { parseAnalyzeGameMessage } from './parse-analyze-frame.js';
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
		throw new Error(`ingest failed with status ${response.status}`);
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
		} catch {
			remaining.push(envelope);
		}
	}
	await setQueue(remaining);
}

async function captureAndSend(analyzeGameData) {
	const config = await getConfig();
	if (!config.ingestUrl) return;

	const envelope = {
		...analyzeGameData,
		submittedBy: config.submittedBy,
		capturedAt: new Date().toISOString()
	};

	try {
		await sendEnvelope(config, envelope);
	} catch {
		const queue = await getQueue();
		await setQueue(enqueue(queue, envelope));
	}
}

chrome.runtime.onMessage.addListener((message) => {
	if (message?.type !== 'raw-ws-message') return;
	const analyzeGameData = parseAnalyzeGameMessage(message.rawMessageData);
	if (analyzeGameData) {
		captureAndSend(analyzeGameData);
	}
});

chrome.runtime.onStartup.addListener(flushQueue);
chrome.runtime.onInstalled.addListener(flushQueue);
