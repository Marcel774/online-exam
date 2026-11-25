import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { env } from './backend/config/env.ts';
import { connectDatabase } from './backend/config/db.ts';
import { createExpressApp } from './backend/app.ts';
import { ensureDefaultSettings } from './backend/services/seedService.ts';

async function startServer() {
  await connectDatabase();
  await ensureDefaultSettings();

  const app = createExpressApp();

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`EXAMPRO server running on http://0.0.0.0:${env.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start EXAMPRO server:', err);
  process.exit(1);
});
