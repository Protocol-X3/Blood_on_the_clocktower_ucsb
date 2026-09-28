// Error codes raised by the database functions, and their Chinese messages.

export const ERROR_MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: '请先登录',
  NICKNAME_INVALID: '昵称需为 1–12 个字符',
  NICKNAME_TAKEN: '昵称已被使用',
  NICKNAME_REQUIRED: '请先设置昵称',
  FORBIDDEN: '你没有权限执行此操作',
  USER_NOT_FOUND: '用户不存在',
  GUEST_NOT_ALLOWED: '游客不能成为说书人',
  ROOM_NOT_FOUND: '房间不存在',
  NOT_MEMBER: '你不在这个房间中',
  GAME_IN_PROGRESS: '对局进行中，暂时不能这样做',
  IS_DM: '说书人不能坐玩家座位',
  SEAT_INVALID: '座位号无效',
  SEAT_TAKEN: '座位已被占用',
  SEAT_COUNT_INVALID: '座位数需在 5 到 15 之间',
  SEAT_COUNT_TOO_LOW: '座位数不能少于已占用的最大座位号',
  NOT_DM: '只有说书人可以这样做',
  DM_SEAT_TAKEN: '说书人座位已被占用',
  IS_SEATED: '请先离开玩家座位',
  TARGET_NOT_DM_ELIGIBLE: '该玩家不能担任说书人',
  TARGET_SEATED: '该玩家正在对局中',
};

export const FALLBACK_ERROR = '出错了，请稍后再试';

/** The Chinese message for an error from Supabase or a thrown value. */
export function errorMessage(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  return ERROR_MESSAGES[message.trim()] ?? FALLBACK_ERROR;
}
