import NodeCache from 'node-cache';
import { ConversationState } from '../types';
import { logger } from '../utils/logger';

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

export function getConversation(phoneNumber: string): ConversationState {
  let state = cache.get<ConversationState>(phoneNumber);

  if (!state) {
    state = {
      phoneNumber,
      userId: null,
      role: null,
      lastCommand: null,
      context: {},
      lastInteraction: new Date(),
    };
    cache.set(phoneNumber, state);
  }

  return state;
}

export function updateConversation(
  phoneNumber: string,
  updates: Partial<ConversationState>
): ConversationState {
  const state = getConversation(phoneNumber);
  const updated = {
    ...state,
    ...updates,
    lastInteraction: new Date(),
  };
  cache.set(phoneNumber, updated);
  logger.debug('Conversation updated', { phoneNumber, updates: Object.keys(updates) });
  return updated;
}

export function clearConversation(phoneNumber: string): void {
  cache.del(phoneNumber);
  logger.debug('Conversation cleared', { phoneNumber });
}

export function clearStaleConversations(maxAgeMs: number = 86400000): number {
  const keys = cache.keys();
  let cleared = 0;
  const now = Date.now();

  for (const key of keys) {
    const state = cache.get<ConversationState>(key);
    if (state && now - state.lastInteraction.getTime() > maxAgeMs) {
      cache.del(key);
      cleared++;
    }
  }

  if (cleared > 0) {
    logger.info('Cleared stale conversations', { count: cleared });
  }

  return cleared;
}
