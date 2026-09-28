import { createBrowserRouter } from 'react-router';
import { ComingSoon, NotFoundPage } from '@/pages/ComingSoon';
import { DesignGallery } from '@/pages/DesignGallery';
import { HomePage } from '@/pages/HomePage';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <ComingSoon title="登录" milestone="M1" /> },
  { path: '/room/:code', element: <ComingSoon title="房间" milestone="M1" /> },
  { path: '/room/:code/summary', element: <ComingSoon title="对局结算" milestone="M3" /> },
  { path: '/profile/:id', element: <ComingSoon title="个人主页" milestone="M5" theme="day" /> },
  { path: '/games/:id', element: <ComingSoon title="历史对局" milestone="M5" theme="day" /> },
  { path: '/scripts', element: <ComingSoon title="剧本库" milestone="M2" theme="day" /> },
  { path: '/scripts/:id', element: <ComingSoon title="剧本详情" milestone="M2" theme="day" /> },
  { path: '/admin', element: <ComingSoon title="管理" milestone="M1" theme="grimoire" /> },
  { path: '/dev/design', element: <DesignGallery /> },
  { path: '*', element: <NotFoundPage /> },
]);
