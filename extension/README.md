# SecondBoard Calibration Capture (browser extension)

Automatically forwards chess.com Game Review results to a personal
calibration server on your home network. Install once, then forget about
it — every Game Review you run afterward is captured with no extra steps.

## Install

1. Open `chrome://extensions` in Chrome.
2. Turn on "Developer mode" (top-right toggle).
3. Click "Load unpacked" and select this `extension/` folder.
4. Click "Details" on the newly installed extension, then "Extension
   options."
5. Fill in:
   - **Ingest server URL**: e.g. `http://192.168.1.50:8787/ingest`
     (ask whoever set up the server for this).
   - **Shared token**: the secret they gave you.
   - **Submitted by**: your name, e.g. `brother`.
6. Click Save. That's it — nothing else to do.

## What it does

Whenever you finish a Game Review on chess.com, this extension notices and
sends the analysis results to the configured server. It never touches your
chess.com login, password, or session — only the game analysis data itself.

## Troubleshooting

If captures aren't showing up, re-open the extension's options page and
double-check the server URL and token are correct, and that your computer
can reach the server (same Wi-Fi/network).
