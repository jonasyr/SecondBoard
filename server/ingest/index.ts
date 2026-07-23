import { openDb } from './db.js';
import { createServer } from './server.js';

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DB_PATH ?? './data/calibration.sqlite';
const SHARED_TOKEN = process.env.INGEST_SHARED_TOKEN;

if (!SHARED_TOKEN) {
	console.error('INGEST_SHARED_TOKEN environment variable is required');
	process.exit(1);
}

const db = openDb(DB_PATH);
const server = createServer({ db, sharedToken: SHARED_TOKEN });

server.listen(PORT, () => {
	console.log(`Calibration ingest server listening on port ${PORT}`);
});
