import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuth } from './useAuth';

/**
 * AUTH-07: pages behind this need a signed-in user; visitors go to /login and come back after.
 * AUTH-04: signed-in users without a nickname choose one first.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth();
  const location = useLocation();
  const here = `${location.pathname}${location.search}`;

  if (loading || (session && !profile)) return <LoadingScreen />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(here)}`} replace />;
  if (!profile?.nickname) return <Navigate to={`/welcome?next=${encodeURIComponent(here)}`} replace />;
  return <>{children}</>;
}
