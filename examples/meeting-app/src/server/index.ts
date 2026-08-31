import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { MeetingApp } from './MeetingApp.js';
import { api } from './api.js';

const PORT = Number(process.env.PORT ?? 5003);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../dist');

if (!process.env.SEEIT_APP_ID) {
  console.warn(
    '[server] SEEIT_APP_ID is not set — token verification will reject everything. Copy .env.example to .env.',
  );
}
if (!process.env.OPENAI_API_KEY) {
  console.warn('[server] OPENAI_API_KEY is not set — note-taking will be disabled.');
}

// The glass app — note we do NOT call .start(); its webhook is mounted below so
// the whole app lives on a single port.
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.error(
    '[server] WEBHOOK_SECRET is not set. SeeIt signs every webhook it delivers, so without the secret this endpoint cannot verify deliveries or pass the ownership handshake — no events would ever arrive. Copy .env.example to .env.',
  );
  process.exit(1);
}

const glass = new MeetingApp({ webhookSecret: WEBHOOK_SECRET });

const app = express();

// Webhook FIRST, before any body parser — signature verification needs the raw
// request stream.
app.post('/webhook', (req, res) => glass.handleWebhookRequest(req, res));

app.use(express.json());
app.use('/api', api);

app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] webhook:  POST /webhook`);
  console.log(
    `[server] api:      GET /api/me, /api/transcripts (SSE), /api/sessions[/:id]`,
  );
  console.log(`[server] api:      POST /api/start, /api/stop`);
});
