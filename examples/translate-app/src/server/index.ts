import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { TranslateApp } from './TranslateApp.js';
import { api } from './api.js';

const PORT = Number(process.env.PORT ?? 5002);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../dist');

if (!process.env.SEEIT_APP_ID) {
  console.warn(
    '[server] SEEIT_APP_ID is not set — token verification will reject everything. Copy .env.example to .env.',
  );
}

// The glass app — note we do NOT call .start(); its webhook is mounted below so
// the whole app lives on a single port.
const glass = new TranslateApp({
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

// Serve the built React app (after `bun run build`). In dev you'll use the Vite
// server on :5173 instead, which proxies /api and /webhook back here.
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] webhook:  POST /webhook`);
  console.log(
    `[server] api:      GET /api/languages, POST /api/language, GET /api/transcripts`,
  );
});
