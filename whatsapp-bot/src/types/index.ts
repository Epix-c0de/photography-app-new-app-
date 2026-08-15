export interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: 'text' | 'image' | 'template' | 'interactive';
  text?: { body: string; preview_url?: boolean };
  image?: { link: string; caption?: string };
  template?: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
  interactive?: {
    type: 'button' | 'list';
    header?: { type: string; text?: string; image?: { link: string } };
    body: { text: string };
    action: {
      buttons?: InteractiveButton[];
      sections?: InteractiveSection[];
    };
  };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: string;
  index?: number;
  parameters?: TemplateParameter[];
}

export interface TemplateParameter {
  type: 'text' | 'image' | 'currency' | 'date_time';
  text?: string;
  image?: { link: string };
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
}

export interface InteractiveButton {
  type: 'reply';
  reply: { id: string; title: string };
}

export interface InteractiveSection {
  title: string;
  rows: { id: string; title: string; description?: string }[];
}

export interface IncomingMessage {
  object: string;
  entry: {
    id: string;
    changes: {
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts: { profile: { name: string }; wa_id: string }[];
        messages: WhatsAppIncomingMessage[];
      };
      field: string;
    }[];
  }[];
}

export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'interactive' | 'button';
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { payload: string; text: string };
}

export interface User {
  id: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  username: string;
  role: 'client' | 'photographer' | 'admin' | 'super_admin';
  profile_photo: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Photographer {
  id: string;
  user_id: string;
  business_name: string;
  business_logo: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  created_at: string;
}

export interface Client {
  id: string;
  phone_number: string;
  temporary_name: string;
  user_id: string | null;
  photographer_id: string;
  registration_status: 'pending' | 'invited' | 'registered';
  invited_at: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  photographer_id: string;
  client_id: string;
  booking_date: string;
  booking_time: string;
  location: string;
  event_type: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  client?: Client;
  photographer?: Photographer;
}

export interface Gallery {
  id: string;
  photographer_id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'processing' | 'delivered';
  total_images: number;
  created_at: string;
  client?: Client;
  photographer?: Photographer;
}

export interface BotLog {
  id: string;
  sender_number: string;
  message: string;
  response: string;
  intent: string | null;
  created_at: string;
}

export type UserRole = 'client' | 'photographer' | 'admin' | 'super_admin';

export interface ConversationState {
  phoneNumber: string;
  userId: string | null;
  role: UserRole | null;
  lastCommand: string | null;
  context: Record<string, any>;
  lastInteraction: Date;
}

export type IntentType =
  | 'register_client'
  | 'view_bookings'
  | 'today_bookings'
  | 'view_clients'
  | 'client_count'
  | 'pending_payments'
  | 'delivered_galleries'
  | 'upload_status'
  | 'recent_activity'
  | 'help'
  | 'support'
  | 'send_gallery_reminder'
  | 'unknown';

export interface DetectedIntent {
  type: IntentType;
  confidence: number;
  entities: Record<string, string>;
}
