import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES, errorMessage, FALLBACK_ERROR } from '@/services/errors';

describe('error messages', () => {
  it('UI-03: every database error code has a Chinese message', () => {
    for (const message of Object.values(ERROR_MESSAGES)) expect(message).toMatch(/[\u4e00-\u9fff]/);
    expect(errorMessage({ message: 'SEAT_TAKEN' })).toBe('座位已被占用');
    expect(errorMessage({ message: ' NICKNAME_TAKEN ' })).toBe('昵称已被使用');
  });

  it('UI-03: unknown errors fall back to a Chinese message', () => {
    expect(errorMessage({ message: 'something unexpected' })).toBe(FALLBACK_ERROR);
    expect(errorMessage(null)).toBe(FALLBACK_ERROR);
    expect(errorMessage('boom')).toBe(FALLBACK_ERROR);
  });
});
