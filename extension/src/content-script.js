(function injectPageScript() {
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('src/injected-page.js');
	script.onload = () => script.remove();
	(document.head || document.documentElement).appendChild(script);
})();

window.addEventListener('message', (event) => {
	if (event.source !== window) return;
	if (!event.data || event.data.source !== 'secondboard-calibration-capture') return;
	chrome.runtime.sendMessage({
		type: 'raw-ws-message',
		rawMessageData: event.data.rawMessageData,
		pageUrl: window.location.href
	});
});
