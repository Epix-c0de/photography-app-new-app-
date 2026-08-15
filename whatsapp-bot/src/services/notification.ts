import { getSupabase } from './supabase';
import { sendTextMessage, sendImageMessage } from '../whatsapp/api';
import { config } from '../config';
import { logger } from '../utils/logger';

export async function notifyNewBooking(
  photographerId: string,
  booking: {
    clientName: string;
    date: string;
    time?: string;
    location?: string;
    eventType?: string;
  }
): Promise<void> {
  try {
    const { data: photographer } = await getSupabase()
      .from('users')
      .select('phone_number')
      .eq('id', photographerId)
      .single();

    if (!photographer) return;

    const message = `📅 *New Booking Received*

👤 Client: ${booking.clientName}
📅 Date: ${booking.date}
⏰ Time: ${booking.time || 'TBD'}
📍 Location: ${booking.location || 'TBD'}
📷 Event: ${booking.eventType || 'Shoot'}

Open app to view details.`;

    await sendTextMessage(photographer.phone_number, message);
    logger.info('Booking notification sent', { photographerId, clientName: booking.clientName });
  } catch (error: any) {
    logger.error('Failed to send booking notification', { error: error.message });
  }
}

export async function notifyGalleryReady(
  clientId: string,
  gallery: {
    title: string;
    imageUrl?: string;
    imageCount: number;
  }
): Promise<void> {
  try {
    const { data: client } = await getSupabase()
      .from('clients')
      .select('phone_number, temporary_name')
      .eq('id', clientId)
      .single();

    if (!client) return;

    const message = `🖼️ *Your Gallery is Ready!*

📸 ${gallery.title}
🖼️ ${gallery.imageCount} photos

Open the app to view your gallery:
${config.app.downloadUrl}`;

    if (gallery.imageUrl) {
      await sendImageMessage(client.phone_number, gallery.imageUrl, message);
    } else {
      await sendTextMessage(client.phone_number, message);
    }

    logger.info('Gallery notification sent', { clientId, title: gallery.title });
  } catch (error: any) {
    logger.error('Failed to send gallery notification', { error: error.message });
  }
}

export async function notifyPaymentReminder(
  clientId: string,
  amount: string,
  dueDate?: string
): Promise<void> {
  try {
    const { data: client } = await getSupabase()
      .from('clients')
      .select('phone_number, temporary_name')
      .eq('id', clientId)
      .single();

    if (!client) return;

    const message = `💰 *Payment Reminder*

Hi ${client.temporary_name || 'there'},

Amount: KES ${amount}
${dueDate ? `Due: ${dueDate}` : ''}

Please make payment at your earliest convenience.`;

    await sendTextMessage(client.phone_number, message);
    logger.info('Payment reminder sent', { clientId, amount });
  } catch (error: any) {
    logger.error('Failed to send payment reminder', { error: error.message });
  }
}

export async function notifySupportTicket(
  adminPhone: string,
  ticket: {
    clientName: string;
    message: string;
    ticketId: string;
  }
): Promise<void> {
  try {
    const message = `🎫 *New Support Ticket*

From: ${ticket.clientName}
Message: ${ticket.message}
Ticket ID: ${ticket.ticketId}

Please respond in the admin dashboard.`;

    await sendTextMessage(adminPhone, message);
    logger.info('Support ticket notification sent', { ticketId: ticket.ticketId });
  } catch (error: any) {
    logger.error('Failed to send support notification', { error: error.message });
  }
}

export async function broadcastMessage(
  phoneNumbers: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const phone of phoneNumbers) {
    try {
      const success = await sendTextMessage(phone, message);
      if (success) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  logger.info('Broadcast completed', { total: phoneNumbers.length, sent, failed });
  return { sent, failed };
}
