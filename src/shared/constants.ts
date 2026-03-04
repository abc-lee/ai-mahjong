/**
 * 常量定义
 */

// 座位方向
export const SEAT_NAMES = ['东', '南', '西', '北'] as const;

// 默认初始分数
export const DEFAULT_SCORE = 1000;

// 底分
export const BASE_SCORE = 1;

// 超时时间（毫秒）
export const ACTION_TIMEOUT = 15000;      // 操作超时 15 秒
const TURN_TIMEOUT = 30000;         // 回合超时 30 秒

// 断线重连时间窗口
export const RECONNECT_WINDOW = 300000;   // 5 分钟

// 最大手牌数
export const MAX_HAND_SIZE = 14;

// 初始手牌数
export const INITIAL_HAND_SIZE = 13;

// 庄家初始手牌数
export const DEALER_HAND_SIZE = 14;

// 牌墙初始大小
export const WALL_SIZE = 136;

// 每人初始牌数
export const TILES_PER_PLAYER = 13;

// 摸牌后剩余牌墙最小值（流局判定）
export const MIN_WALL_FOR_DRAW = 0;
