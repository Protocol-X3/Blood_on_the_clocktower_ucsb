import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { AdminPage } from '@/pages/AdminPage';
import { NotFoundPage } from '@/pages/ComingSoon';
import { DesignGallery } from '@/pages/DesignGallery';
import { GameHistoryPage } from '@/pages/GameHistoryPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { RoomPage } from '@/pages/RoomPage';
import { ScriptDetailPage } from '@/pages/ScriptDetailPage';
import { ScriptEditorPage } from '@/pages/ScriptEditorPage';
import { ScriptsPage } from '@/pages/ScriptsPage';
import { SummaryPage } from '@/pages/SummaryPage';
import { WelcomePage } from '@/pages/WelcomePage';

const auth = (page: ReactNode) => <RequireAuth>{page}</RequireAuth>;

export const router = createBrowserRouter([
  { path: '/', element: auth(<HomePage />) },
  { path: '/login', element: <LoginPage /> },
  { path: '/welcome', element: <WelcomePage /> },
  { path: '/room/:code', element: auth(<RoomPage />) },
  { path: '/room/:code/summary', element: auth(<SummaryPage />) },
  { path: '/profile/:id', element: auth(<ProfilePage />) },
  { path: '/games/:id', element: auth(<GameHistoryPage />) },
  { path: '/scripts', element: auth(<ScriptsPage />) },
  { path: '/scripts/new', element: auth(<ScriptEditorPage />) },
  { path: '/scripts/:id', element: auth(<ScriptDetailPage />) },
  { path: '/scripts/:id/edit', element: auth(<ScriptEditorPage />) },
  { path: '/admin', element: auth(<AdminPage />) },
  // Public: no user data. The gallery is for visual review; unknown addresses get a friendly page.
  { path: '/dev/design', element: <DesignGallery /> },
  { path: '*', element: <NotFoundPage /> },
]);
