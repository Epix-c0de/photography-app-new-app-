import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { WhatsAppMessage } from '../types';

const api: AxiosInstance = axios.create({
  baseURL: config.whatsapp.apiUrl,
  headers: {
    Authorization: `Bearer ${config.whatsapp.accessToken}`,
    'Content-Type': 'application/json',
  },
});

export async function sendTextMessage(to: string, text: string): Promise<boolean> {
  try {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    };

    await api.post(`/${config.whatsapp.phoneNumberId}/messages`, payload);
    logger.info('Text message sent', { to, length: text.length });
    return true;
  } catch (error: any) {
    logger.error('Failed to send text message', {
      to,
      error: error.response?.data || error.message,
    });
    return false;
  }
}

export async function sendImageMessage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<boolean> {
  try {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { link: imageUrl, caption },
    };

    await api.post(`/${config.whatsapp.phoneNumberId}/messages`, payload);
    logger.info('Image message sent', { to });
    return true;
  } catch (error: any) {
    logger.error('Failed to send image message', {
      to,
      error: error.response?.data || error.message,
    });
    return false;
  }
}

export async function sendButtonsMessage(
  to: string,
  body: string,
  buttons: { id: string; title: string }[]
): Promise<boolean> {
  try {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply' as const,
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    };

    await api.post(`/${config.whatsapp.phoneNumberId}/messages`, payload);
    logger.info('Buttons message sent', { to, buttonCount: buttons.length });
    return true;
  } catch (error: any) {
    logger.error('Failed to send buttons message', {
      to,
      error: error.response?.data || error.message,
    });
    return false;
  }
}

export async function sendListMessage(
  to: string,
  body: string,
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[],
  buttonText?: string
): Promise<boolean> {
  try {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        action: {
          button: buttonText || 'Select',
          sections,
        },
      },
    };

    await api.post(`/${config.whatsapp.phoneNumberId}/messages`, payload);
    logger.info('List message sent', { to });
    return true;
  } catch (error: any) {
    logger.error('Failed to send list message', {
      to,
      error: error.response?.data || error.message,
    });
    return false;
  }
}

export async function markAsRead(messageId: string): Promise<boolean> {
  try {
    await api.post(`/${config.whatsapp.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
    return true;
  } catch (error: any) {
    logger.error('Failed to mark as read', { messageId, error: error.message });
    return false;
  }
}
