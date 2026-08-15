import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { initSupabase } from './services/supabase';
import { logger } from './utils/logger';
import routes from './api/routes';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.info(message.trim()) },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({
    service: 'Photography WhatsApp Bot',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      webhook: '/api/webhook',
      send: '/api/send',
      broadcast: '/api/broadcast',
    },
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    initSupabase();
    logger.info('Supabase connected');

    app.listen(config.port, () => {
      logger.info(`WhatsApp bot server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Webhook URL: http://localhost:${config.port}/api/webhook`);
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

start();

export default app;
