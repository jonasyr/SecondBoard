(function () {
	const OriginalWebSocket = window.WebSocket;

	function ChessComCaptureSocket(url, protocols) {
		const socket =
			protocols === undefined ? new OriginalWebSocket(url) : new OriginalWebSocket(url, protocols);

		if (typeof url === 'string' && url.includes('analysis.chess.com')) {
			socket.addEventListener('message', (event) => {
				window.postMessage(
					{ source: 'secondboard-calibration-capture', rawMessageData: event.data },
					'*'
				);
			});
		}

		return socket;
	}

	ChessComCaptureSocket.prototype = OriginalWebSocket.prototype;
	ChessComCaptureSocket.CONNECTING = OriginalWebSocket.CONNECTING;
	ChessComCaptureSocket.OPEN = OriginalWebSocket.OPEN;
	ChessComCaptureSocket.CLOSING = OriginalWebSocket.CLOSING;
	ChessComCaptureSocket.CLOSED = OriginalWebSocket.CLOSED;

	window.WebSocket = ChessComCaptureSocket;
})();
