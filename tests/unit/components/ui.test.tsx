import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ClockMark } from '@/components/ui/ClockMark';
import { cn } from '@/components/ui/cn';
import { Ornament } from '@/components/ui/Ornament';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { StarField } from '@/components/ui/StarField';
import { ThemeScope } from '@/components/ui/ThemeScope';

describe('cn', () => {
  it('merges conflicting Tailwind classes, last one wins', () => {
    expect(cn('px-2 text-sm', false, 'px-4')).toBe('text-sm px-4');
  });
});

describe('Button', () => {
  it('is a non-submitting button by default and handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>举手</Button>);
    const button = screen.getByRole('button', { name: '举手' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps an explicit type and ignores clicks when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button type="submit" disabled onClick={onClick}>
        加入
      </Button>,
    );
    const button = screen.getByRole('button', { name: '加入' });
    expect(button).toHaveAttribute('type', 'submit');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders its child element instead with asChild', () => {
    render(
      <Button asChild variant="outline">
        <a href="/scripts">剧本库</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: '剧本库' });
    expect(link).not.toHaveAttribute('type');
    expect(link.className).toContain('border-gold');
  });
});

describe('RoleToken', () => {
  it('exposes the role name, not the single glyph, to assistive tech', () => {
    render(<RoleToken glyph="占" team="townsfolk" label="占卜师" />);
    const token = screen.getByRole('img', { name: '占卜师' });
    expect(token).toHaveAttribute('data-team', 'townsfolk');
    expect(token).not.toHaveAttribute('data-dead');
  });

  it('announces and greys out a dead role', () => {
    render(<RoleToken glyph="葬" team="townsfolk" label="送葬者" dead />);
    const token = screen.getByRole('img', { name: '送葬者（已死亡）' });
    expect(token).toHaveAttribute('data-dead');
    expect(token.className).toContain('grayscale');
  });

  it('shows a gold ring when selected', () => {
    render(<RoleToken glyph="魔" team="demon" label="小恶魔" size="xl" selected />);
    expect(screen.getByRole('img', { name: '小恶魔' }).className).toContain('ring-gold');
  });
});

describe('small components', () => {
  it('renders Chip, Panel, Ornament, ClockMark and ThemeScope', () => {
    const { container } = render(
      <ThemeScope theme="grimoire">
        <Panel variant="gilded" aria-label="角色卡">
          <Chip tone="demon">恶魔</Chip>
          <Ornament />
          <ClockMark />
        </Panel>
      </ThemeScope>,
    );
    expect(container.querySelector('[data-theme="grimoire"]')).not.toBeNull();
    expect(screen.getByLabelText('角色卡').className).toContain('bg-parchment');
    expect(screen.getByText('恶魔').className).toContain('text-demon-text');
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
  });

  it('StarField is decorative and deterministic', () => {
    const a = render(<StarField count={12} seed={3} />);
    const first = a.container.innerHTML;
    a.unmount();
    const b = render(<StarField count={12} seed={3} />);
    expect(b.container.innerHTML).toBe(first);
    expect(b.container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(b.container.querySelectorAll('span')).toHaveLength(12);
  });
});
