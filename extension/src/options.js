async function loadConfig() {
	const stored = await chrome.storage.local.get(['ingestUrl', 'sharedToken', 'submittedBy']);
	document.getElementById('ingestUrl').value = stored.ingestUrl ?? '';
	document.getElementById('sharedToken').value = stored.sharedToken ?? '';
	document.getElementById('submittedBy').value = stored.submittedBy ?? '';
}

document.getElementById('config-form').addEventListener('submit', async (event) => {
	event.preventDefault();
	const ingestUrl = document.getElementById('ingestUrl').value.trim();
	const sharedToken = document.getElementById('sharedToken').value.trim();
	const submittedBy = document.getElementById('submittedBy').value.trim();

	await chrome.storage.local.set({ ingestUrl, sharedToken, submittedBy });
	document.getElementById('status').textContent = 'Saved.';
});

loadConfig();
