import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { TranslateApp } from './TranslateApp.js';
import { api } from './api.js';
import { store } from './store.js';

const PORT = Number(process.env.PORT ?? 5002);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../dist');

if (!process.env.SEEIT_APP_ID) {
  console.warn(
    '[server] SEEIT_APP_ID is not set — token verification will reject everything. Copy .env.example to .env.',
  );
}
if (!process.env.OPENAI_API_KEY) {
  console.warn('[server] OPENAI_API_KEY is not set — translation will be disabled.');
}

// Don't let a stray rejection/exception take the whole process down.
process.on('unhandledRejection', (reason) =>
  console.error('[server] unhandledRejection:', reason),
);
process.on('uncaughtException', (err) =>
  console.error('[server] uncaughtException:', err),
);

// The glass app — note we do NOT call .start(); its webhook is mounted below so
// the whole app lives on a single port.
const glass = new TranslateApp({
  ...(process.env.WEBHOOK_SECRET
    ? { webhookSecret: process.env.WEBHOOK_SECRET }
    : {}),
});

const app = express();

// Health/readiness — before auth so load balancers can probe freely.
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/ready', (_req, res) => {
  const ready = Boolean(process.env.OPENAI_API_KEY);
  res.status(ready ? 200 : 503).json({ ready, openai: ready });
});

// Webhook FIRST, before any body parser — signature verification needs the raw
// request stream.
app.post('/webhook', (req, res) => glass.handleWebhookRequest(req, res));

app.use(express.json({ limit: '256kb' }));
app.use('/api', api);

// Serve the built React app (after `bun run build`). In dev you'll use the Vite
// server on :5173 instead, which proxies /api and /webhook back here.
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

const server = app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] health:   GET  /health, /ready`);
  console.log(`[server] webhook:  POST /webhook`);
  console.log(
    `[server] api:      GET /api/me, /api/languages, /api/transcripts (SSE), /api/sessions[/:id]`,
  );
  console.log(
    `[server] api:      POST /api/language, /api/settings, /api/retry/:id`,
  );
});

// Graceful shutdown: end open SSE responses, then close the server.
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} received — shutting down`);
  store.endAllListeners();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
