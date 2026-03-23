export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[Native Intent] Handling deep link:', { path, initial });
  
  // Handle OAuth callback
  if (path.includes('auth/callback') || path.includes('auth') || path.startsWith('/auth')) {
    console.log('[Native Intent] Routing to auth/callback');
    return '/auth/callback' + (path.includes('?') ? path.substring(path.indexOf('?')) : '');
  }

  if (initial) {
    return '/';
  }
  return path;
}
