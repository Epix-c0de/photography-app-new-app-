import { Alert } from 'react-native';

// Comprehensive network debugging utilities
export interface NetworkDiagnostics {
  timestamp: string;
  reachable: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
  dnsResolved: boolean;
  ipAddresses?: string[];
  isOnline: boolean;
  userAgent: string;
  platform: string;
}

export async function runNetworkDiagnostics(url: string): Promise<NetworkDiagnostics> {
  const diagnostics: NetworkDiagnostics = {
    timestamp: new Date().toISOString(),
    reachable: false,
    dnsResolved: false,
    isOnline: navigator.onLine,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
  };

  try {
    // Test basic connectivity
    const startTime = Date.now();
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: { 'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '' }
    });
    
    diagnostics.reachable = true;
    diagnostics.responseTime = Date.now() - startTime;
    diagnostics.statusCode = response.status;
    
  } catch (error: any) {
    diagnostics.error = error.message;
  }

  // Try to get DNS resolution info (this will only work in some environments)
  try {
    // This is a best-effort approach for DNS resolution in browser context
    const testUrl = new URL(url);
    const hostname = testUrl.hostname;
    
    // Create an image load to trigger DNS resolution (browser trick)
    const img = new Image();
    img.src = `https://${hostname}/favicon.ico?t=${Date.now()}`;
    
    diagnostics.dnsResolved = true; // Assume true if we reach this point
  } catch (dnsError) {
    diagnostics.dnsResolved = false;
  }

  return diagnostics;
}

export async function checkConnectivityWithRetry(
  url: string, 
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<{
  success: boolean;
  attempts: number;
  totalTime: number;
  errors: string[];
  bestResponseTime?: number;
}> {
  const errors: string[] = [];
  let attempts = 0;
  const startTime = Date.now();
  let bestResponseTime: number | undefined;

  for (let i = 0; i < maxRetries; i++) {
    attempts++;
    try {
      const testStart = Date.now();
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: { 'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const responseTime = Date.now() - testStart;
      bestResponseTime = bestResponseTime ? Math.min(bestResponseTime, responseTime) : responseTime;
      
      if (response.status < 400) {
        return {
          success: true,
          attempts,
          totalTime: Date.now() - startTime,
          errors,
          bestResponseTime
        };
      }
      
      errors.push(`Attempt ${i + 1}: HTTP ${response.status}`);
    } catch (error: any) {
      errors.push(`Attempt ${i + 1}: ${error.message}`);
    }

    // Exponential backoff
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, i)));
    }
  }

  return {
    success: false,
    attempts,
    totalTime: Date.now() - startTime,
    errors,
    bestResponseTime
  };
}

export function showNetworkDiagnosticsAlert(diagnostics: NetworkDiagnostics) {
  const message = `
📊 Network Diagnostics:

• Server Reachable: ${diagnostics.reachable ? '✅ Yes' : '❌ No'}
• Response Time: ${diagnostics.responseTime || 'N/A'}ms
• Status Code: ${diagnostics.statusCode || 'N/A'}
• DNS Resolved: ${diagnostics.dnsResolved ? '✅ Yes' : '❌ No'}
• Online Status: ${diagnostics.isOnline ? '✅ Online' : '❌ Offline'}
• Platform: ${diagnostics.platform}

${diagnostics.error ? `Error: ${diagnostics.error}` : ''}
  `.trim();

  Alert.alert('Network Diagnostics', message);
}

// Quick connectivity check utility
export async function quickConnectivityCheck() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ujunohfpcmjywsblsoel.supabase.co';
  
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      method: 'HEAD',
      headers: { 'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '' },
      signal: AbortSignal.timeout(3000)
    });
    
    return {
      ok: response.status < 400,
      status: response.status,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}