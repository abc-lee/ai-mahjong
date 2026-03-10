/**
 * Socket.io 事件类型定义
 */

import type { Tile, GameStatePublic, PendingAction, WinningHand, Room } from '@shared/types';

// 重新导出共享类型，方便使用
export type { Tile, Player, PlayerPublic, Meld, GameStatePublic, PendingAction, WinningHand, Room } from '@shared/types';

// ==================== 房间事件 ====================

// 客户端 -> 服务器：房间事件载荷
export interface CreateRoomPayload {
  playerName: string;
}

export interface JoinRoomPayload {
  roomId: string;
  playerName: string;
}

export interface ReadyPayload {
  ready: boolean;
}

// 服务器 -> 客户端：房间事件响应
export interface CreateRoomResponse {
  roomId: string;
  room: Room;
}

export interface JoinRoomResponse {
  roomId: string;
  room: Room;
  playerPosition: number;
}

export interface RoomListResponse {
  rooms: Room[];
}

export interface RoomUpdatedEvent {
  room: Room;
}

// ==================== 游戏事件 ====================

// 客户端 -> 服务器：游戏事件载荷
export interface DiscardPayload {
  tileId: string;
}

export interface ActionPayload {
  action: 'chi' | 'peng' | 'gang' | 'hu';
  tiles?: Tile[];
}

// 服务器 -> 客户端：游戏事件响应
export interface GameStateEvent {
  state: GameStatePublic;
  yourHand: Tile[];
  yourTurn: boolean;
  lastDrawnTile?: Tile;
  turnPhase?: 'draw' | 'discard' | 'action';
}

export interface DrawResponse {
  tile?: Tile;
  error?: string;
}

export interface ActionsEvent {
  actions: PendingAction[];
}

export interface GameEndedEvent {
  winner: number;
  winningHand: WinningHand | null;
  players?: Array<{ id: string; name: string; score: number }>;
}

// ==================== 发言系统事件 ====================

export interface SpeechMessageEvent {
  playerId: string;
  playerName: string;
  content: string;
  emotion?: string;
  targetPlayer?: string;
  timestamp: number;
}

export interface EmotionEvent {
  playerId: string;
  emotion: {
    mood: string;
    emoji: string;
    color: string;
    values: {
      happiness: number;
      anger: number;
      patience: number;
      confidence: number;
    };
  };
}

// ==================== 通用响应 ====================

export interface SuccessResponse {
  success: boolean;
}

export interface ErrorResponse {
  message: string;
}

// ==================== 事件名称常量 ====================

/** 客户端发送的事件 */
export const ClientEvents = {
  // 房间
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_LIST: 'room:list',
  ROOM_READY: 'room:ready',
  // 游戏
  GAME_START: 'game:start',
  GAME_DRAW: 'game:draw',
  GAME_DISCARD: 'game:discard',
  GAME_ACTION: 'game:action',
  GAME_PASS: 'game:pass',
} as const;

/** 服务器发送的事件 */
export const ServerEvents = {
  // 房间
  ROOM_UPDATED: 'room:updated',
  ROOM_ERROR: 'room:error',
  // 游戏
  GAME_STARTED: 'game:started',
  GAME_STATE: 'game:state',
  GAME_DRAW: 'game:draw',
  GAME_ACTIONS: 'game:actions',
  GAME_ENDED: 'game:ended',
  GAME_ERROR: 'game:error',
  // 发言系统
  PLAYER_SPEECH: 'player:speech',
  PLAYER_EMOTION: 'player:emotion',
} as const;

// ==================== 回调类型 ====================

type Callback<T> = (response: T) => void;

export type CreateRoomCallback = Callback<CreateRoomResponse | ErrorResponse>;
export type JoinRoomCallback = Callback<JoinRoomResponse | ErrorResponse>;
export type LeaveRoomCallback = Callback<SuccessResponse | ErrorResponse>;
export type RoomListCallback = Callback<RoomListResponse>;
export type ReadyCallback = Callback<SuccessResponse | ErrorResponse>;
export type StartGameCallback = Callback<SuccessResponse | ErrorResponse>;
export type DrawCallback = Callback<DrawResponse>;
export type DiscardCallback = Callback<SuccessResponse | ErrorResponse>;
export type ActionCallback = Callback<SuccessResponse | ErrorResponse>;
export type PassCallback = Callback<SuccessResponse | ErrorResponse>;
