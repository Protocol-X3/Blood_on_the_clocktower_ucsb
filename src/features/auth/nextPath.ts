/** Where to go after signing in: the `next` parameter if it's a local path, otherwise home. */
export function nextPath(search: string): string {
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
