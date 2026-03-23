/**
 * OAuth Flow Logging Helper
 * Provides detailed logging for Google Sign-In troubleshooting
 */

interface OAuthLogContext {
  step: string;
  data?: any;
  error?: any;
  timestamp?: string;
}

const logs: OAuthLogContext[] = [];

export const oauthLogger = {
  /**
   * Log a step in the OAuth flow
   */
  log: (step: string, data?: any) => {
    const logEntry: OAuthLogContext = {
      step,
      data,
      timestamp: new Date().toISOString(),
    };
    logs.push(logEntry);
    console.log(`[OAuth-${step}]`, data || '');
  },

  /**
   * Log an error in the OAuth flow
   */
  error: (step: string, error: any) => {
    const logEntry: OAuthLogContext = {
      step,
      error: {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack,
      },
      timestamp: new Date().toISOString(),
    };
    logs.push(logEntry);
    console.error(`[OAuth-ERROR-${step}]`, error);
  },

  /**
   * Get all logs
   */
  getLogs: () => logs,

  /**
   * Clear logs
   */
  clear: () => {
    logs.length = 0;
  },

  /**
   * Export logs as JSON for debugging
   */
  export: () => {
    return JSON.stringify(logs, null, 2);
  },

  /**
   * Log device/environment information
   */
  logEnvironment: (env: any) => {
    oauthLogger.log('Environment', {
      scheme: env.scheme,
      redirectUrl: env.redirectUrl,
      platform: env.platform,
      supabaseUrl: env.supabaseUrl ? 'configured' : 'missing',
    });
  },

  /**
   * Log browser session details
   */
  logBrowserSession: (result: any) => {
    oauthLogger.log('BrowserSession', {
      type: result.type,
      hasUrl: !!result.url,
      urlLength: result.url?.length,
      error: result.error?.message,
    });
  },

  /**
   * Log token extraction
   */
  logTokenExtraction: (tokens: any) => {
    oauthLogger.log('TokenExtraction', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      accessTokenLength: tokens.access_token?.length,
      refreshTokenLength: tokens.refresh_token?.length,
      error: tokens.error,
    });
  },

  /**
   * Log session establishment
   */
  logSessionEstablishment: (sessionData: any) => {
    oauthLogger.log('SessionEstablishment', {
      hasSession: !!sessionData.session,
      user: sessionData.session?.user?.email,
      expiresAt: sessionData.session?.expires_at,
      error: sessionData.error?.message,
    });
  },
};
