import { Router, Request, Response } from 'express';
import { verifyWebhook, handleWebhook } from '../webhooks/handler';
import { sendTextMessage } from '../whatsapp/api';
import { logger } from '../utils/logger';

const router = Router();

router.get('/webhook', (req: Request, res: Response) => {
  verifyWebhook(req, res);
});

router.post('/webhook', (req: Request, res: Response) => {
  handleWebhook(req, res);
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'whatsapp-bot',
    timestamp: new Date().toISOString(),
  });
});

router.post('/send', async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      res.status(400).json({ error: 'Missing "to" or "message"' });
      return;
    }

    const success = await sendTextMessage(to, message);

    if (success) {
      res.json({ success: true, message: 'Message sent' });
    } else {
      res.status(500).json({ error: 'Failed to send message' });
    }
  } catch (error: any) {
    logger.error('Send message error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/broadcast', async (req: Request, res: Response) => {
  try {
    const { phoneNumbers, message } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || !message) {
      res.status(400).json({ error: 'Missing "phoneNumbers" array or "message"' });
      return;
    }

    let sent = 0;
    let failed = 0;

    for (const phone of phoneNumbers) {
      const success = await sendTextMessage(phone, message);
      if (success) sent++;
      else failed++;
    }

    res.json({
      success: true,
      sent,
      failed,
      total: phoneNumbers.length,
    });
  } catch (error: any) {
    logger.error('Broadcast error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
