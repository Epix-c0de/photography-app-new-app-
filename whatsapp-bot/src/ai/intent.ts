import { DetectedIntent, IntentType } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

interface IntentPattern {
  type: IntentType;
  patterns: RegExp[];
  entities?: string[];
}

const intentPatterns: IntentPattern[] = [
  {
    type: 'register_client',
    patterns: [
      /register\s*(new\s*)?client/i,
      /new\s*client/i,
      /add\s*client/i,
      /client\s*register/i,
    ],
  },
  {
    type: 'view_bookings',
    patterns: [
      /my\s*bookings/i,
      /show\s*(my\s*)?bookings/i,
      /list\s*(my\s*)?bookings/i,
      /view\s*bookings/i,
      /all\s*bookings/i,
    ],
  },
  {
    type: 'today_bookings',
    patterns: [
      /today'?s?\s*bookings/i,
      /bookings?\s*(for\s*)?today/i,
      /what\s*do\s*i\s*have\s*today/i,
      /today'?s?\s*schedule/i,
    ],
  },
  {
    type: 'view_clients',
    patterns: [
      /my\s*clients/i,
      /show\s*(my\s*)?clients/i,
      /list\s*(my\s*)?clients/i,
      /view\s*clients/i,
      /all\s*clients/i,
    ],
  },
  {
    type: 'client_count',
    patterns: [
      /how\s*many\s*clients/i,
      /client\s*count/i,
      /number\s*of\s*clients/i,
      /total\s*clients/i,
    ],
  },
  {
    type: 'pending_payments',
    patterns: [
      /pending\s*payments?/i,
      /unpaid/i,
      /outstanding/i,
      / payments?\s*due/i,
      /who\s*owes/i,
    ],
  },
  {
    type: 'delivered_galleries',
    patterns: [
      /delivered\s*galleries/i,
      /sent\s*galleries/i,
      /completed\s*galleries/i,
      /gallery\s*status/i,
    ],
  },
  {
    type: 'upload_status',
    patterns: [
      /upload\s*status/i,
      /pending\s*uploads?/i,
      /uploads?\s*pending/i,
      /processing/i,
    ],
  },
  {
    type: 'recent_activity',
    patterns: [
      /recent\s*activity/i,
      /latest\s*activity/i,
      /what'?s?\s*happening/i,
      /activity\s*log/i,
      /recent\s*updates?/i,
    ],
  },
  {
    type: 'send_gallery_reminder',
    patterns: [
      /send\s*(gallery\s*)?reminder/i,
      /remind\s*(about\s*)?gallery/i,
      /gallery\s*reminder/i,
      /remind\s*client/i,
    ],
  },
  {
    type: 'help',
    patterns: [/^help$/i, /^commands$/i, /\bwhat\s*can\s*you\s*do\b/i, /\bmenu\b/i],
  },
  {
    type: 'support',
    patterns: [
      /support/i,
      /help\s*desk/i,
      /customer\s*service/i,
      /talk\s*to\s*(a\s*)?human/i,
      /escalate/i,
    ],
  },
];

const nameExtractionPatterns = [
  /register\s*(new\s*)?client\s+(.+)/i,
  /new\s*client\s+(.+)/i,
  /add\s*client\s+(.+)/i,
  /send\s*reminder\s*to\s+(.+)/i,
  /remind\s+(.+)/i,
];

export function detectIntent(message: string): DetectedIntent {
  const trimmed = message.trim();

  for (const intent of intentPatterns) {
    for (const pattern of intent.patterns) {
      if (pattern.test(trimmed)) {
        const entities = extractEntities(trimmed);
        const confidence = calculateConfidence(trimmed, pattern);

        logger.debug('Intent detected', {
          message: trimmed,
          intent: intent.type,
          confidence,
          entities,
        });

        return {
          type: intent.type,
          confidence,
          entities,
        };
      }
    }
  }

  return { type: 'unknown', confidence: 0, entities: {} };
}

function extractEntities(message: string): Record<string, string> {
  const entities: Record<string, string> = {};

  for (const pattern of nameExtractionPatterns) {
    const match = message.match(pattern);
    if (match && match[2]) {
      entities.name = match[2].trim();
      break;
    }
  }

  const phoneMatch = message.match(/(\+?254\d{9}|0\d{9})/);
  if (phoneMatch) {
    entities.phone = phoneMatch[1];
  }

  const dateKeywords: Record<string, string> = {
    today: new Date().toISOString().split('T')[0],
    tomorrow: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    yesterday: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    monday: getNextWeekday(1),
    tuesday: getNextWeekday(2),
    wednesday: getNextWeekday(3),
    thursday: getNextWeekday(4),
    friday: getNextWeekday(5),
    saturday: getNextWeekday(6),
    sunday: getNextWeekday(0),
  };

  for (const [keyword, date] of Object.entries(dateKeywords)) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(message)) {
      entities.date = date;
      break;
    }
  }

  return entities;
}

function calculateConfidence(message: string, pattern: RegExp): number {
  let confidence = 0.7;

  if (pattern.test(message)) confidence += 0.15;

  const words = message.toLowerCase().split(/\s+/);
  const patternStr = pattern.source.toLowerCase();
  const matchedWords = words.filter((w) => patternStr.includes(w));
  confidence += (matchedWords.length / words.length) * 0.15;

  return Math.min(confidence, 0.99);
}

function getNextWeekday(dayOfWeek: number): string {
  const now = new Date();
  const diff = (dayOfWeek - now.getDay() + 7) % 7 || 7;
  const next = new Date(now.getTime() + diff * 86400000);
  return next.toISOString().split('T')[0];
}

export function getCommandList(): string {
  return `📋 *Available Commands*

*Photographer Commands:*
• Register Client - Add a new client
• My Bookings - View all bookings
• Today's Bookings - See today's schedule
• My Clients - View client list
• Client Count - Total registered clients
• Pending Payments - Outstanding payments
• Delivered Galleries - Completed galleries
• Upload Status - Check pending uploads
• Recent Activity - Latest updates

*Support:*
• Help - Show this menu
• Support - Contact support team

*Natural Language:*
You can also type naturally:
• "Show me tomorrow's bookings"
• "How many clients do I have?"
• "Send gallery reminder to Mary"`;
}
