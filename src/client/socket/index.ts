/**
 * Socket.io 客户端封装
 * 提供类型安全的麻将游戏通信接口
 */

import { io, Socket } from 'socket.io-client';
import type {
  Tile,
  PendingAction,
  CreateRoomResponse,
  JoinRoomResponse,
  RoomListResponse,
  GameStateEvent,
  DrawResponse,
  ActionsEvent,
  GameEndedEvent,
  RoomUpdatedEvent,
  SuccessResponse,
  ErrorResponse,
  Room,
  SpeechMessageEvent,
  EmotionEvent,
} from './events';
import { ClientEvents, ServerEvents } from './events';

// Socket 服务器 URL
function getSocketUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_URL) {
        // @ts-ignore
        return import.meta.env.VITE_SOCKET_URL;
      }
    } catch {}
  }
  return 'http://localhost:3000';
}

const SOCKET_URL = getSocketUrl();

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

function isErrorResponse(response: unknown): response is ErrorResponse {
  // 错误响应只有 message 字段，没有 roomId 或 success
  if (typeof response !== 'object' || response === null) return false;
  const obj = response as Record<string, unknown>;
  return 'message' in obj && !('roomId' in obj) && !('success' in obj) && !('rooms' in obj);
}

// 房间事件
export function createRoom(playerName: string): Promise<CreateRoomResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('创建房间超时'));
    }, 10000);
    
    socket.emit(ClientEvents.ROOM_CREATE, { playerName }, (response: unknown) => {
      clearTimeout(timeout);
      if (isErrorResponse(response)) {
        reject(new Error(response.message));
      } else {
        resolve(response as CreateRoomResponse);
      }
    });
  });
}

export function joinRoom(roomId: string, playerName: string): Promise<JoinRoomResponse> {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.ROOM_JOIN, { roomId, playerName }, (response) => {
      if (isErrorResponse(response)) reject(new Error(response.message));
      else resolve(response);
    });
  });
}

export function leaveRoom(): Promise<SuccessResponse> {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.ROOM_LEAVE, (response) => {
      if (isErrorResponse(response)) reject(new Error(response.message));
      else resolve(response);
    });
  });
}

export function getRoomList(): Promise<RoomListResponse> {
  return new Promise((resolve) => {
    socket.emit(ClientEvents.ROOM_LIST, resolve);
  });
}

export function setReady(ready: boolean): Promise<SuccessResponse & { room?: Room }> {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.ROOM_READY, { ready }, (response) => {
      if (isErrorResponse(response)) reject(new Error(response.message));
      else resolve(response);
    });
  });
}

// 游戏事件
export function startGame(): Promise<SuccessResponse> {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.GAME_START, (response) => {
      if (isErrorResponse(response)) reject(new Error(response.message));
      else resolve(response);
    });
  });
}

export function drawTile(): Promise<DrawResponse> {
  return new Promise((resolve) => {
    socket.emit(ClientEvents.GAME_DRAW, resolve);
  });
}

export function discardTile(tileId: string): Promise<SuccessResponse> {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.GAME_DISCARD, { tileId }, (response) => {
      if (isErrorResponse(response)) reject(new Error(response.message));
      else resolve(response);
    });
  });
}

export function performAction(action: 'chi' | 'peng' | 'gang' | 'hu', tiles?: Tile[]): Promise<SuccessResponse> {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.GAME_ACTION, { action, tiles }, (response) => {
      if (isErrorResponse(response)) reject(new Error(response.message));
      else resolve(response);
    });
  });
}

export function passAction(): Promise<SuccessResponse> {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.GAME_PASS, (response) => {
      if (isErrorResponse(response)) reject(new Error(response.message));
      else resolve(response);
    });
  });
}

// 事件监听
export function onRoomUpdated(callback: (data: RoomUpdatedEvent) => void) {
  socket.on(ServerEvents.ROOM_UPDATED, callback);
  return () => socket.off(ServerEvents.ROOM_UPDATED, callback);
}

export function onGameStarted(callback: () => void) {
  socket.on(ServerEvents.GAME_STARTED, callback);
  return () => socket.off(ServerEvents.GAME_STARTED, callback);
}

export function onGameState(callback: (data: GameStateEvent) => void) {
  socket.on(ServerEvents.GAME_STATE, callback);
  return () => socket.off(ServerEvents.GAME_STATE, callback);
}

export function onDraw(callback: (data: { tile: Tile }) => void) {
  socket.on(ServerEvents.GAME_DRAW, callback);
  return () => socket.off(ServerEvents.GAME_DRAW, callback);
}

export function onActions(callback: (data: ActionsEvent) => void) {
  socket.on(ServerEvents.GAME_ACTIONS, callback);
  return () => socket.off(ServerEvents.GAME_ACTIONS, callback);
}

export function onGameEnded(callback: (data: GameEndedEvent) => void) {
  socket.on(ServerEvents.GAME_ENDED, callback);
  return () => socket.off(ServerEvents.GAME_ENDED, callback);
}

export function onRoomError(callback: (data: ErrorResponse) => void) {
  socket.on(ServerEvents.ROOM_ERROR, callback);
  return () => socket.off(ServerEvents.ROOM_ERROR, callback);
}

export function onGameError(callback: (data: ErrorResponse) => void) {
  socket.on(ServerEvents.GAME_ERROR, callback);
  return () => socket.off(ServerEvents.GAME_ERROR, callback);
}

// 发言系统事件
export function onPlayerSpeech(callback: (data: SpeechMessageEvent) => void) {
  socket.on(ServerEvents.PLAYER_SPEECH, callback);
  return () => socket.off(ServerEvents.PLAYER_SPEECH, callback);
}

export function onPlayerEmotion(callback: (data: EmotionEvent) => void) {
  socket.on(ServerEvents.PLAYER_EMOTION, callback);
  return () => socket.off(ServerEvents.PLAYER_EMOTION, callback);
}

// 连接管理
export function connect() { socket.connect(); }
export function disconnect() { socket.disconnect(); }
export function isConnected() { return socket.connected; }

export function onConnect(callback: () => void) {
  socket.on('connect', callback);
  return () => socket.off('connect', callback);
}

export function onDisconnect(callback: (reason: Socket.DisconnectReason) => void) {
  socket.on('disconnect', callback);
  return () => socket.off('disconnect', callback);
}

export function onConnectError(callback: (error: Error) => void) {
  socket.on('connect_error', callback);
  return () => socket.off('connect_error', callback);
}

// 统一设置监听器
export interface SocketListeners {
  onConnect: () => void;
  onDisconnect: () => void;
  onRoomUpdate: (room: Room) => void;
  onGameState: (state: GameStateEvent['state'], hand: Tile[], yourTurn: boolean, lastDrawn?: Tile, turnPhase?: 'draw' | 'discard' | 'action') => void;
  onActions: (actions: PendingAction[]) => void;
  onGameEnd: (winnerId: string, winningHand: Tile[]) => void;
  onError: (message: string) => void;
  // 发言系统
  onPlayerSpeech?: (data: SpeechMessageEvent) => void;
  onPlayerEmotion?: (data: EmotionEvent) => void;
}

export function setupSocketListeners(listeners: SocketListeners): () => void {
  const {
    onConnect,
    onDisconnect,
    onRoomUpdate,
    onGameState,
    onActions,
    onGameEnd,
    onError,
    onPlayerSpeech,
    onPlayerEmotion,
  } = listeners;

  // 连接事件
  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);

  // 房间事件
  socket.on(ServerEvents.ROOM_UPDATED, (data: RoomUpdatedEvent) => {
    onRoomUpdate(data.room);
  });
  socket.on(ServerEvents.ROOM_ERROR, (data: ErrorResponse) => {
    onError(data.message);
  });

  // 游戏事件
  socket.on(ServerEvents.GAME_STARTED, () => {
    console.log('[Socket] Game started event received');
  });
  socket.on(ServerEvents.GAME_STATE, (data: GameStateEvent) => {
    console.log('[Socket] 收到 GAME_STATE 事件!');
    console.log('[Socket] data:', JSON.stringify(data).slice(0, 200));
    onGameState(data.state, data.yourHand, data.yourTurn, data.lastDrawnTile, data.turnPhase);
  });
  socket.on(ServerEvents.GAME_ACTIONS, (data: ActionsEvent) => {
    console.log('[Socket] 收到 GAME_ACTIONS 事件!');
    console.log('[Socket] actions:', data.actions);
    onActions(data.actions);
  });
  socket.on(ServerEvents.GAME_ENDED, (data: GameEndedEvent) => {
    onGameEnd(String(data.winner), data.winningHand?.tiles || []);
  });
  socket.on(ServerEvents.GAME_ERROR, (data: ErrorResponse) => {
    onError(data.message);
  });

  // 发言系统事件
  if (onPlayerSpeech) {
    socket.on(ServerEvents.PLAYER_SPEECH, onPlayerSpeech);
  }
  if (onPlayerEmotion) {
    socket.on(ServerEvents.PLAYER_EMOTION, onPlayerEmotion);
  }

  // 返回清理函数
  return () => {
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
    socket.off(ServerEvents.ROOM_UPDATED);
    socket.off(ServerEvents.ROOM_ERROR);
    socket.off(ServerEvents.GAME_STARTED);
    socket.off(ServerEvents.GAME_STATE);
    socket.off(ServerEvents.GAME_ACTIONS);
    socket.off(ServerEvents.GAME_ENDED);
    socket.off(ServerEvents.GAME_ERROR);
    socket.off(ServerEvents.PLAYER_SPEECH);
    socket.off(ServerEvents.PLAYER_EMOTION);
  };
}

export function removeAllGameListeners() {
  socket.off(ServerEvents.GAME_STARTED);
  socket.off(ServerEvents.GAME_STATE);
  socket.off(ServerEvents.GAME_DRAW);
  socket.off(ServerEvents.GAME_ACTIONS);
  socket.off(ServerEvents.GAME_ENDED);
  socket.off(ServerEvents.GAME_ERROR);
  socket.off(ServerEvents.PLAYER_SPEECH);
  socket.off(ServerEvents.PLAYER_EMOTION);
}

export function removeAllRoomListeners() {
  socket.off(ServerEvents.ROOM_UPDATED);
  socket.off(ServerEvents.ROOM_ERROR);
}

export type {
  Room, Tile, PendingAction, GameStateEvent, ActionsEvent, GameEndedEvent,
  RoomUpdatedEvent, DrawResponse, CreateRoomResponse, JoinRoomResponse,
  RoomListResponse, SuccessResponse, ErrorResponse,
  SpeechMessageEvent, EmotionEvent,
};
