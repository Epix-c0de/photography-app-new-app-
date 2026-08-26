export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[Native Intent] Handling deep link:', { path, initial });

  // Handle unlock links: /unlock?code=TRY-9391 or /unlock/CODE
  // Universal links: https://studio.epix.co/unlock?code=TRY-9391
  // Deep links: epix-visuals://unlock?code=TRY-9391
  if (path.startsWith('unlock') || path.startsWith('/unlock')) {
    console.log('[Native Intent] Routing unlock link:', path);
    const queryIndex = path.indexOf('?');
    const query = queryIndex >= 0 ? path.substring(queryIndex) : '';
    // Extract code from path like /unlock/TRY-9391
    const pathPart = queryIndex >= 0 ? path.substring(0, queryIndex) : path;
    const segments = pathPart.split('/').filter(Boolean);
    const codeFromPath = segments.length > 1 ? segments[segments.length - 1] : '';
    const finalQuery = codeFromPath
      ? `?autoUnlock=true&accessCode=${codeFromPath}${query ? '&' + query.substring(1) : ''}`
      : `?autoUnlock=true${query ? '&' + query.substring(1) : ''}`;
    return '/(tabs)/gallery' + finalQuery;
  }

  // Handle gallery links: /gallery?accessCode=TRY-9391 or /gallery?id=UUID or /gallery/UUID?code=TRY-9391
  if (path.startsWith('gallery') || path.startsWith('/gallery')) {
    console.log('[Native Intent] Routing gallery link:', path);
    const queryIndex = path.indexOf('?');
    let query = queryIndex >= 0 ? path.substring(queryIndex) : '';
    // Extract ID from path like /gallery/UUID
    const pathPart = queryIndex >= 0 ? path.substring(0, queryIndex) : path;
    const segments = pathPart.split('/').filter(Boolean);
    const idFromPath = segments.length > 1 ? segments[segments.length - 1] : '';
    // Convert ?code= to ?accessCode= for the app
    if (query.includes('code=')) {
      query = query.replace(/code=/g, 'accessCode=');
      // Add autoUnlock if accessCode is present
      if (!query.includes('autoUnlock')) {
        query += '&autoUnlock=true';
      }
    }
    if (idFromPath && !query) {
      return '/(tabs)/gallery?id=' + idFromPath;
    }
    return '/(tabs)/gallery' + query;
  }

  // Handle announcement links: /announcement?id=UUID or /announcement/UUID
  if (path.startsWith('announcement') || path.startsWith('/announcement')) {
    console.log('[Native Intent] Routing announcement link:', path);
    const queryIndex = path.indexOf('?');
    const query = queryIndex >= 0 ? path.substring(queryIndex) : '';
    const pathPart = queryIndex >= 0 ? path.substring(0, queryIndex) : path;
    const segments = pathPart.split('/').filter(Boolean);
    const idFromPath = segments.length > 1 ? segments[segments.length - 1] : '';
    if (idFromPath && !query) {
      return '/announcements/' + idFromPath;
    }
    return '/announcements' + query;
  }

  // Handle BTS links: /bts?id=UUID or /bts/UUID
  if (path.startsWith('bts') || path.startsWith('/bts')) {
    console.log('[Native Intent] Routing BTS link:', path);
    const queryIndex = path.indexOf('?');
    const query = queryIndex >= 0 ? path.substring(queryIndex) : '';
    const pathPart = queryIndex >= 0 ? path.substring(0, queryIndex) : path;
    const segments = pathPart.split('/').filter(Boolean);
    const idFromPath = segments.length > 1 ? segments[segments.length - 1] : '';
    if (idFromPath && !query) {
      return '/bts/' + idFromPath;
    }
    return '/bts' + query;
  }

  // Handle password reset deep link: epix-visuals://reset-password
  if (path.startsWith('reset-password') || path.startsWith('/reset-password')) {
    console.log('[Native Intent] Routing to reset-password');
    const queryIndex = path.indexOf('?');
    const query = queryIndex >= 0 ? path.substring(queryIndex) : '';
    return '/reset-password' + query;
  }

  // Handle OAuth callback — epix-visuals://auth/callback
  if (path.includes('auth/callback') || path.includes('auth') || path.startsWith('/auth')) {
    console.log('[Native Intent] Routing to auth/callback');
    return '/auth/callback' + (path.includes('?') ? path.substring(path.indexOf('?')) : '');
  }

  // Handle join/invite links: epix-visuals://join?code=XXXX or epix-visuals://join/CODE
  if (path.startsWith('join') || path.startsWith('/join')) {
    console.log('[Native Intent] Routing join link:', path);
    // Code is extracted and stored by _layout.tsx Linking listener — just navigate home
    return '/';
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
