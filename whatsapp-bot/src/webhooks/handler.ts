import { Request, Response } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';
import { handleIncomingMessage } from '../handlers/message';
import { IncomingMessage, WhatsAppIncomingMessage } from '../types';

const processedMessages = new Set<string>();

export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('Webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed', { mode, token });
    res.sendStatus(403);
  }
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  res.sendStatus(200);

  try {
    const body = req.body as IncomingMessage;

    if (body.object !== 'whatsapp_business_account') {
      return;
    }

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const messages = change.value.messages;
        if (!messages || messages.length === 0) continue;

        for (const msg of messages) {
          if (processedMessages.has(msg.id)) {
            logger.debug('Duplicate message ignored', { messageId: msg.id });
            continue;
          }

          processedMessages.add(msg.id);

          setTimeout(() => {
            processedMessages.delete(msg.id);
          }, 60000);

          await processMessage(msg, change.value.contacts);
        }
      }
    }
  } catch (error: any) {
    logger.error('Webhook processing error', { error: error.message });
  }
}

async function processMessage(
  msg: WhatsAppIncomingMessage,
  contacts: { profile: { name: string }; wa_id: string }[]
): Promise<void> {
  const senderPhone = msg.from;
  const senderName = contacts?.[0]?.profile?.name;

  let messageText = '';

  switch (msg.type) {
    case 'text':
      messageText = msg.text?.body || '';
      break;
    case 'interactive':
      if (msg.interactive?.type === 'button_reply') {
        messageText = msg.interactive.button_reply?.title || '';
      } else if (msg.interactive?.type === 'list_reply') {
        messageText = msg.interactive.list_reply?.title || '';
      }
      break;
    case 'button':
      messageText = msg.button?.text || '';
      break;
    case 'image':
      messageText = msg.image?.caption || '[Image received]';
      break;
    default:
      messageText = `[${msg.type} message]`;
  }

  if (!messageText) {
    logger.warn('Empty message received', { messageId: msg.id });
    return;
  }

  logger.info('Processing message', {
    from: senderPhone,
    name: senderName,
    type: msg.type,
    text: messageText.substring(0, 100),
  });

  await handleIncomingMessage(senderPhone, messageText, senderName);
}
