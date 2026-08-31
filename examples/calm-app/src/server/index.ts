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
  console.log(
    '[server] PUBLIC_BASE_URL not set — deriving the audio URL from each request (works on Railway with trust proxy). Only set it if the glasses can’t reach the derived URL.',
  );
}

// Synthesize the soundscape WAV loops on first boot (CC0, no downloads).
const generated = ensureSounds();
console.log(`[server] soundscapes ready (${generated} generated this boot)`);

// The glass app — note we do NOT call .start(); its webhook is mounted below so
// the whole app lives on a single port.
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.error(
    '[server] WEBHOOK_SECRET is not set. SeeIt signs every webhook it delivers, so without the secret this endpoint cannot verify deliveries or pass the ownership handshake — no events would ever arrive. Copy .env.example to .env.',
  );
  process.exit(1);
}

const glass = new CalmApp({ webhookSecret: WEBHOOK_SECRET });

const app = express();

// Behind Railway's proxy: trust X-Forwarded-Proto so req.protocol is `https`,
// which is what we build the public audio URL from when PUBLIC_BASE_URL is unset.
app.set('trust proxy', true);

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
