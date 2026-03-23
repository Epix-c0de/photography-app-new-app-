export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  console.log('[Native Intent] Handling deep link:', { path, initial });
  
  if (path.includes('auth/callback') || path.includes('auth') || path.startsWith('/auth')) {
    console.log('[Native Intent] Routing to auth/callback');
    return `/auth/callback?url=${encodeURIComponent(path)}`;
  }

  if (initial) {
    return '/';
  }
  return path;
}
