import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { CalmApp } from './CalmApp.js';
import { api } from './api.js';
import { ensureSounds, AUDIO_DIR } from './sounds/generate.js';

const PORT = Number(process.env.PORT ?? 5004);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../dist');

if (!process.env.SEEIT_APP_ID) {
  console.warn(
    '[server] SEEIT_APP_ID is not set — token verification will reject everything. Copy .env.example to .env.',
  );
}
if (!process.env.PUBLIC_BASE_URL) {
  console.warn(
    '[server] PUBLIC_BASE_URL is not set — the glasses may not be able to reach the audio files in local dev. Set it to a publicly reachable origin (e.g. your tunnel URL).',
  );
}

// Synthesize the soundscape WAV loops on first boot (CC0, no downloads).
const generated = ensureSounds();
console.log(`[server] soundscapes ready (${generated} generated this boot)`);

// The glass app — note we do NOT call .start(); its webhook is mounted below so
// the whole app lives on a single port.
const glass = new CalmApp({
  ...(process.env.WEBHOOK_SECRET
    ? { webhookSecret: process.env.WEBHOOK_SECRET }
    : {}),
});

const app = express();

// Webhook FIRST, before any body parser — signature verification needs the raw
// request stream.
app.post('/webhook', (req, res) => glass.handleWebhookRequest(req, res));

app.use(express.json());
app.use('/api', api);

// Generated soundscape audio (fetched by the glasses via playAudio).
app.use('/audio', express.static(AUDIO_DIR));

app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] webhook:  POST /webhook`);
  console.log(
    `[server] api:      GET /api/me, /api/soundscapes, /api/state, /api/stream (SSE)`,
  );
  console.log(`[server] api:      POST /api/play, /api/stop`);
});
