import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  WHATSAPP_API_URL: z.string().url().default('https://graph.facebook.com/v18.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),

  APP_BRAND_NAME: z.string().default('Epix Visuals'),
  APP_DOWNLOAD_URL: z.string().url(),
  APP_DEEP_LINK_BASE: z.string().default('exp://epixvisuals.app'),

  AI_CONFIDENCE_THRESHOLD: z.string().default('0.7'),

  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/bot.log'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parseInt(parsed.data.PORT, 10),
  nodeEnv: parsed.data.NODE_ENV,
  isDevelopment: parsed.data.NODE_ENV === 'development',

  supabase: {
    url: parsed.data.SUPABASE_URL,
    anonKey: parsed.data.SUPABASE_ANON_KEY,
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  },

  whatsapp: {
    apiUrl: parsed.data.WHATSAPP_API_URL,
    phoneNumberId: parsed.data.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: parsed.data.WHATSAPP_ACCESS_TOKEN,
    businessAccountId: parsed.data.WHATSAPP_BUSINESS_ACCOUNT_ID,
    verifyToken: parsed.data.WHATSAPP_VERIFY_TOKEN,
  },

  app: {
    brandName: parsed.data.APP_BRAND_NAME,
    downloadUrl: parsed.data.APP_DOWNLOAD_URL,
    deepLinkBase: parsed.data.APP_DEEP_LINK_BASE,
  },

  ai: {
    confidenceThreshold: parseFloat(parsed.data.AI_CONFIDENCE_THRESHOLD),
  },

  rateLimit: {
    windowMs: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(parsed.data.RATE_LIMIT_MAX_REQUESTS, 10),
  },

  logging: {
    level: parsed.data.LOG_LEVEL,
    file: parsed.data.LOG_FILE,
  },
};
