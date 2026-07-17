export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[Native Intent] Handling deep link:', { path, initial });

  // Handle password reset deep link: epix-visuals://reset-password
  if (path.startsWith('reset-password') || path.startsWith('/reset-password')) {
    console.log('[Native Intent] Routing to reset-password');
    const queryIndex = path.indexOf('?');
    const query = queryIndex >= 0 ? path.substring(queryIndex) : '';
    return '/reset-password' + query;
  }

  // Handle OAuth callback
  if (path.includes('auth/callback') || path.includes('auth') || path.startsWith('/auth')) {
    console.log('[Native Intent] Routing to auth/callback');
    return '/auth/callback' + (path.includes('?') ? path.substring(path.indexOf('?')) : '');
  }

  // Handle join/invite links: epix-visuals://join?code=XXXX or epix-visuals://join/CODE
  if (path.startsWith('join') || path.startsWith('/join')) {
    console.log('[Native Intent] Routing join link:', path);
    // Extract the code from the path or query params
    const codeMatch = path.match(/join[/?]?(?:code=)?([A-Za-z0-9]+)/);
    if (codeMatch && codeMatch[1]) {
      return `/?pending_join_code=${codeMatch[1].toUpperCase()}`;
    }
  }

  // Handle signup with referral: /signup?ref=CODE
  if (path.startsWith('/signup') || path.includes('signup')) {
    const queryIndex = path.indexOf('?');
    const query = queryIndex >= 0 ? path.substring(queryIndex) : '';
    console.log('[Native Intent] Routing to signup with ref:', query);
    return '/signup' + query;
  }

  if (initial) {
    return '/';
  }
  return path;
}
