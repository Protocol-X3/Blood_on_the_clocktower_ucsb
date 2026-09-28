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
  // M2 · scripts and roles
  ROLE_INVALID: '角色需要名称（最多 20 字）、阵营和能力描述（最多 300 字），图标为 1 个字',
  ROLE_NOT_FOUND: '角色不存在',
  SCRIPT_NAME_INVALID: '剧本名称需为 1–30 个字，作者最多 30 字',
  SCRIPT_EMPTY: '剧本至少需要一个角色',
  SCRIPT_DUPLICATE_ROLE: '同一个角色不能重复加入剧本',
  SCRIPT_NOT_FOUND: '剧本不存在',
  // M2 · setup and card draw
  GAME_NOT_FOUND: '对局不存在',
  NOT_IN_SETUP: '对局不在配置阶段',
  MODE_REQUIRED: '请选择分配方式',
  COMPOSITION_INVALID: '角色配置无效',
  COMPOSITION_SIZE: '角色数量必须与座位数相同',
  COMPOSITION_DUPLICATE: '同一个角色不能使用两次',
  COMPOSITION_INCOMPLETE: '请先完成角色配置',
  ROLE_NOT_IN_SCRIPT: '该角色不在所选剧本中',
  ROLE_NOT_IN_COMPOSITION: '该角色不在本局配置中',
  ROLE_ALREADY_ASSIGNED: '该角色已分配给其他座位',
  WRONG_MODE: '当前分配方式下不能这样做',
  SEAT_EMPTY: '这个座位还没有玩家',
  NOT_SEATED: '只有入座的玩家可以抽卡',
  NOT_SHUFFLED: '说书人还没有发牌',
  ALREADY_DRAWN: '你已经抽过牌了',
  CARD_TAKEN: '已被抽走，请重选',
  CARD_INVALID: '这张牌不存在',
  NOT_ALL_SEATED: '还有座位没有玩家',
  NOT_ALL_ASSIGNED: '还有座位没有分配角色',
};

export const FALLBACK_ERROR = '出错了，请稍后再试';

/** The Chinese message for an error from Supabase or a thrown value. */
export function errorMessage(error: unknown): string {
  const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  return ERROR_MESSAGES[message.trim()] ?? FALLBACK_ERROR;
}
