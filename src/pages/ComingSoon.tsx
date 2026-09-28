import { Link } from 'react-router';
import { Ornament } from '@/components/ui/Ornament';
import { StarField } from '@/components/ui/StarField';
import { ThemeScope, type ThemeName } from '@/components/ui/ThemeScope';

/** A simple centered message page, used for placeholders and "not found". */
export function MessagePage({
  title,
  message,
  theme = 'night',
}: {
  title: string;
  message: string;
  theme?: ThemeName;
}) {
  return (
    <ThemeScope theme={theme} className="relative min-h-dvh overflow-hidden">
      {theme === 'night' && <StarField count={30} seed={11} />}
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
        <h1 className="font-serif text-3xl font-black tracking-[0.15em] text-gold-strong">{title}</h1>
        <Ornament className="mt-4" />
        <p className="mt-4 text-sm text-ink-muted">{message}</p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center px-3 text-sm text-ink-muted underline underline-offset-4 hover:text-gold"
        >
          返回首页
        </Link>
      </main>
    </ThemeScope>
  );
}

export function ComingSoon({ title, milestone, theme }: { title: string; milestone: string; theme?: ThemeName }) {
  return <MessagePage title={title} message={`此页面将在 ${milestone} 中实现`} theme={theme} />;
}

export function NotFoundPage() {
  return <MessagePage title="页面不存在" message="你访问的页面不存在或已被移除。" />;
}
