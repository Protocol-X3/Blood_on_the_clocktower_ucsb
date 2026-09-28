import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AdminPage } from '@/pages/AdminPage';
import { ComingSoon, NotFoundPage } from '@/pages/ComingSoon';
import { DesignGallery } from '@/pages/DesignGallery';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RoomPage } from '@/pages/RoomPage';
import { WelcomePage } from '@/pages/WelcomePage';

const auth = (page: ReactNode) => <RequireAuth>{page}</RequireAuth>;

export const router = createBrowserRouter([
  { path: '/', element: auth(<HomePage />) },
  { path: '/login', element: <LoginPage /> },
  { path: '/welcome', element: <WelcomePage /> },
  { path: '/room/:code', element: auth(<RoomPage />) },
  { path: '/room/:code/summary', element: auth(<ComingSoon title="对局结算" milestone="M3" />) },
  { path: '/profile/:id', element: auth(<ComingSoon title="个人主页" milestone="M5" theme="day" />) },
  { path: '/games/:id', element: auth(<ComingSoon title="历史对局" milestone="M5" theme="day" />) },
  { path: '/scripts', element: auth(<ComingSoon title="剧本库" milestone="M2" theme="day" />) },
  { path: '/scripts/:id', element: auth(<ComingSoon title="剧本详情" milestone="M2" theme="day" />) },
  { path: '/admin', element: auth(<AdminPage />) },
  // Public: no user data. The gallery is for visual review; unknown addresses get a friendly page.
  { path: '/dev/design', element: <DesignGallery /> },
  { path: '*', element: <NotFoundPage /> },
]);
