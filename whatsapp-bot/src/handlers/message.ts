import { getSupabase } from '../services/supabase';
import { sendTextMessage } from '../whatsapp/api';
import { detectIntent, getCommandList } from '../ai/intent';
import { getConversation, updateConversation, clearConversation } from '../services/conversation';
import { handleRegisterClient } from './register';
import {
  getBookings,
  getClientCount,
  getClients,
  getGalleries,
  getRecentActivity,
} from './queries';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ConversationState, IntentType } from '../types';

export async function handleIncomingMessage(
  phoneNumber: string,
  message: string,
  senderName?: string
): Promise<void> {
  const supabase = getSupabase();
  const state = getConversation(phoneNumber);

  logger.info('Incoming message', { phoneNumber, message: message.substring(0, 100) });

  if (state.lastCommand === 'register_client') {
    const response = await handleRegisterClient(phoneNumber, message, state);
    await sendTextMessage(phoneNumber, response);
    return;
  }

  const intent = detectIntent(message);

  if (intent.confidence < config.ai.confidenceThreshold && intent.type === 'unknown') {
    await logBotMessage(phoneNumber, message, 'Low confidence - no match', intent.type);

    const response = `I didn't quite understand that. Type *Help* to see available commands.`;
    await sendTextMessage(phoneNumber, response);
    return;
  }

  const response = await handleIntent(phoneNumber, intent.type, intent.entities, state);
  await sendTextMessage(phoneNumber, response);

  await logBotMessage(phoneNumber, message, response, intent.type);
}

async function handleIntent(
  phoneNumber: string,
  intentType: IntentType,
  entities: Record<string, string>,
  state: ConversationState
): Promise<string> {
  const supabase = getSupabase();

  const { data: user } = await supabase
    .from('users')
    .select('id, role')
    .eq('phone_number', phoneNumber)
    .single();

  if (!user) {
    return `Welcome to ${config.app.brandName}!

Your phone number is not yet registered in our system.

Please download our app to get started:
${config.app.downloadUrl}`;
  }

  const photographerId = user.id;

  switch (intentType) {
    case 'register_client':
      return handleRegisterClient(phoneNumber, '', {
        ...state,
        userId: photographerId,
        role: user.role,
      });

    case 'view_bookings':
      return getBookings(photographerId, entities.date);

    case 'today_bookings':
      return getBookings(photographerId, new Date().toISOString().split('T')[0]);

    case 'view_clients':
      return getClients(photographerId);

    case 'client_count':
      return getClientCount(photographerId);

    case 'pending_payments':
      return 'Payment tracking will be available soon. Stay tuned!';

    case 'delivered_galleries':
      return getGalleries(photographerId);

    case 'upload_status':
      return 'Upload status tracking will be available soon.';

    case 'recent_activity':
      return getRecentActivity(photographerId);

    case 'send_gallery_reminder':
      if (entities.name) {
        return `Gallery reminder for "${entities.name}" will be sent soon. This feature is coming soon!`;
      }
      return 'Please specify who to remind. Example: "Send gallery reminder to Mary"';

    case 'help':
      return getCommandList();

    case 'support':
      return 'Support ticket created. A team member will contact you shortly.';

    default:
      return getCommandList();
  }
}

async function logBotMessage(
  senderNumber: string,
  message: string,
  response: string,
  intent: string | null
): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('bot_logs').insert({
      sender_number: senderNumber,
      message,
      response,
      intent,
    });
  } catch (error: any) {
    logger.error('Failed to log bot message', { error: error.message });
  }
}
