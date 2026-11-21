import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase, UPLOADS_DIR } from './server/db/database.ts';
import aiRoutes from './server/routes/ai.ts';
import authRoutes from './server/routes/auth.ts';
import bookingRoutes from './server/routes/bookings.ts';
import dashboardRoutes from './server/routes/dashboard.ts';
import facilityRoutes from './server/routes/facilities.ts';
import inventoryRoutes from './server/routes/inventory.ts';
import notificationRoutes from './server/routes/notifications.ts';
import paymentRoutes from './server/routes/payments.ts';
import qrRoutes from './server/routes/qr.ts';
import supportRoutes from './server/routes/support.ts';

dotenv.config();

async function startServer() {
  initializeDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '6mb' }));
  app.use(cookieParser());

  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'stovra-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/facilities', facilityRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/qr', qrRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`STOVRA full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start STOVRA server:', err);
  process.exit(1);
});
