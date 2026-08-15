import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../../services/supabase';
import { updateConversation, getConversation } from '../../services/conversation';
import { sendTextMessage, sendButtonsMessage } from '../../whatsapp/api';
import { normalizePhone } from '../../utils/phone';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { ConversationState } from '../../types';

export async function handleRegisterClient(
  phoneNumber: string,
  message: string,
  state: ConversationState
): Promise<string> {
  const supabase = getSupabase();

  if (!state.context.step) {
    updateConversation(phoneNumber, {
      lastCommand: 'register_client',
      context: { step: 'awaiting_client_phone' },
    });
    return 'Please send the client\'s phone number.\n\nFormat: 0712345678 or +254712345678';
  }

  if (state.context.step === 'awaiting_client_phone') {
    let clientPhone: string;
    try {
      clientPhone = normalizePhone(message);
    } catch {
      return 'Invalid phone number. Please send a valid Kenyan phone number.\n\nExample: 0712345678';
    }

    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('phone_number', clientPhone)
      .single();

    if (existing) {
      clearRegistrationState(phoneNumber);
      return 'A client with this phone number already exists.';
    }

    updateConversation(phoneNumber, {
      context: { step: 'awaiting_client_name', clientPhone },
    });
    return 'Please send the client\'s name.\n\nExample: Mary Atieno';
  }

  if (state.context.step === 'awaiting_client_name') {
    const clientName = message.trim();
    if (clientName.length < 2) {
      return 'Please send a valid name (at least 2 characters).';
    }

    const { data: photographer } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phoneNumber)
      .eq('role', 'photographer')
      .single();

    if (!photographer) {
      clearRegistrationState(phoneNumber);
      return 'Your account is not registered as a photographer. Please contact support.';
    }

    const invitationToken = uuidv4();

    const { error } = await supabase.from('clients').insert({
      phone_number: state.context.clientPhone,
      temporary_name: clientName,
      photographer_id: photographer.id,
      registration_status: 'invited',
      invited_at: new Date().toISOString(),
    });

    if (error) {
      logger.error('Failed to register client', { error: error.message });
      clearRegistrationState(phoneNumber);
      return 'Failed to register client. Please try again.';
    }

    const downloadUrl = config.app.downloadUrl;
    const invitationMessage = `Hello ${clientName},

Thank you for choosing ${config.app.brandName}.

Your gallery and booking information will be delivered through our mobile application.

📲 *Download App:*
${downloadUrl}

After installation, complete registration using this phone number.
The system will automatically connect your account.`;

    await sendTextMessage(state.context.clientPhone, invitationMessage);

    clearRegistrationState(phoneNumber);

    return `✅ *Client Registered Successfully*

👤 Name: ${clientName}
📱 Phone: ${state.context.clientPhone}
📨 Invitation sent via WhatsApp`;
  }

  return 'Something went wrong. Please start over with "Register Client".';
}

function clearRegistrationState(phoneNumber: string): void {
  updateConversation(phoneNumber, {
    lastCommand: null,
    context: {},
  });
}
