/**
 * Socket.io 客户端封装
 * 提供麻将游戏通信接口
 */

import { io } from 'socket.io-client';

// Socket 服务器 URL
const SOCKET_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_URL 
  ? import.meta.env.VITE_SOCKET_URL 
  : 'http://localhost:3000';

// 事件常量
const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_LIST: 'room:list',
  ROOM_READY: 'room:ready',
  GAME_START: 'game:start',
  GAME_DRAW: 'game:draw',
  GAME_DISCARD: 'game:discard',
  GAME_ACTION: 'game:action',
  GAME_PASS: 'game:pass',
};

const ServerEvents = {
  ROOM_UPDATED: 'room:updated',
  ROOM_ERROR: 'room:error',
  GAME_STARTED: 'game:started',
  GAME_STATE: 'game:state',
  GAME_DRAW: 'game:draw',
  GAME_ACTIONS: 'game:actions',
  GAME_ENDED: 'game:ended',
  GAME_ERROR: 'game:error',
  PLAYER_SPEECH: 'player:speech',
  PLAYER_EMOTION: 'player:emotion',
};

// 创建 socket 实例
const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

// 错误响应检测
function isErrorResponse(response) {
  if (typeof response !== 'object' || response === null) return false;
  return 'message' in response && !('roomId' in obj) && !('success' in obj);
}

// ==================== 连接管理 ====================

/**
 * 连接到服务器
 */
export function connect() {
  socket.connect();
}

/**
 * 断开连接
 */
export function disconnect() {
  socket.disconnect();
}

/**
 * 检查是否已连接
 */
export function isConnected() {
  return socket.connected;
}

// ==================== 房间操作 ====================

/**
 * 创建房间
 * @param {string} playerName - 玩家名称
 * @returns {Promise<{roomId: string, room: object, playerPosition: number}>}
 */
export function createRoom(playerName) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('创建房间超时')), 10000);
    
    socket.emit(ClientEvents.ROOM_CREATE, { playerName }, (response) => {
      clearTimeout(timeout);
      if (response.message && !response.roomId) {
        reject(new Error(response.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 加入房间
 * @param {string} roomId - 房间ID
 * @param {string} playerName - 玩家名称
 * @returns {Promise<{roomId: string, room: object, playerPosition: number}>}
 */
export function joinRoom(roomId, playerName) {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.ROOM_JOIN, { roomId, playerName }, (response) => {
      if (response.message && !response.roomId) {
        reject(new Error(response.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 离开房间
 * @returns {Promise<{success: boolean}>}
 */
export function leaveRoom() {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.ROOM_LEAVE, (response) => {
      if (response.message && response.success === undefined) {
        reject(new Error(response.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 获取房间列表
 * @returns {Promise<{rooms: Array}>}
 */
export function getRoomList() {
  return new Promise((resolve) => {
    socket.emit(ClientEvents.ROOM_LIST, resolve);
  });
}

/**
 * 设置准备状态
 * @param {boolean} ready - 是否准备
 * @returns {Promise<{success: boolean, room?: object}>}
 */
export function setReady(ready) {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.ROOM_READY, { ready }, (response) => {
      if (response.message && response.success === undefined) {
        reject(new Error(response.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ==================== 游戏操作 ====================

/**
 * 开始游戏（房主专用）
 * @returns {Promise<{success: boolean}>}
 */
export function startGame() {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.GAME_START, (response) => {
      if (response.message && response.success === undefined) {
        reject(new Error(response.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 摸牌
 * @returns {Promise<{tile: object}>}
 */
export function drawTile() {
  return new Promise((resolve) => {
    socket.emit(ClientEvents.GAME_DRAW, resolve);
  });
}

/**
 * 打牌
 * @param {string} tileId - 牌的ID
 * @returns {Promise<{success: boolean}>}
 */
export function discardTile(tileId) {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.GAME_DISCARD, { tileId }, (response) => {
      if (response.message && response.success === undefined) {
        reject(new Error(response.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 执行吃/碰/杠/胡操作
 * @param {string} action - 操作类型: 'chi' | 'peng' | 'gang' | 'hu'
 * @param {Array} [tiles] - 操作涉及的牌（吃牌时需要）
 * @returns {Promise<{success: boolean}>}
 */
export function performAction(action, tiles) {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.GAME_ACTION, { action, tiles }, (response) => {
      if (response.message && response.success === undefined) {
        reject(new Error(response.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * 跳过当前操作
 * @returns {Promise<{success: boolean}>}
 */
export function passAction() {
  return new Promise((resolve, reject) => {
    socket.emit(ClientEvents.GAME_PASS, (response) => {
      if (response.message && response.success === undefined) {
        reject(new Error(response.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ==================== 事件监听 ====================

/**
 * 监听连接事件
 * @param {Function} callback - 回调函数
 * @returns {Function} 取消监听函数
 */
export function onConnect(callback) {
  socket.on('connect', callback);
  return () => socket.off('connect', callback);
}

/**
 * 监听断开连接事件
 * @param {Function} callback - 回调函数
 * @returns {Function} 取消监听函数
 */
export function onDisconnect(callback) {
  socket.on('disconnect', callback);
  return () => socket.off('disconnect', callback);
}

/**
 * 监听房间更新
 * @param {Function} callback - 回调函数 ({room: object})
 * @returns {Function} 取消监听函数
 */
export function onRoomUpdated(callback) {
  socket.on(ServerEvents.ROOM_UPDATED, callback);
  return () => socket.off(ServerEvents.ROOM_UPDATED, callback);
}

/**
 * 监听房间错误
 * @param {Function} callback - 回调函数 ({message: string})
 * @returns {Function} 取消监听函数
 */
export function onRoomError(callback) {
  socket.on(ServerEvents.ROOM_ERROR, callback);
  return () => socket.off(ServerEvents.ROOM_ERROR, callback);
}

/**
 * 监听游戏开始
 * @param {Function} callback - 回调函数
 * @returns {Function} 取消监听函数
 */
export function onGameStarted(callback) {
  socket.on(ServerEvents.GAME_STARTED, callback);
  return () => socket.off(ServerEvents.GAME_STARTED, callback);
}

/**
 * 监听游戏状态更新
 * @param {Function} callback - 回调函数 ({state, yourHand, yourTurn, lastDrawnTile, turnPhase})
 * @returns {Function} 取消监听函数
 */
export function onGameState(callback) {
  socket.on(ServerEvents.GAME_STATE, callback);
  return () => socket.off(ServerEvents.GAME_STATE, callback);
}

/**
 * 监听摸牌结果
 * @param {Function} callback - 回调函数 ({tile: object})
 * @returns {Function} 取消监听函数
 */
export function onDraw(callback) {
  socket.on(ServerEvents.GAME_DRAW, callback);
  return () => socket.off(ServerEvents.GAME_DRAW, callback);
}

/**
 * 监听可用操作
 * @param {Function} callback - 回调函数 ({actions: Array})
 * @returns {Function} 取消监听函数
 */
export function onActions(callback) {
  socket.on(ServerEvents.GAME_ACTIONS, callback);
  return () => socket.off(ServerEvents.GAME_ACTIONS, callback);
}

/**
 * 监听游戏结束
 * @param {Function} callback - 回调函数 ({winner, winningHand, players})
 * @returns {Function} 取消监听函数
 */
export function onGameEnded(callback) {
  socket.on(ServerEvents.GAME_ENDED, callback);
  return () => socket.off(ServerEvents.GAME_ENDED, callback);
}

/**
 * 监听游戏错误
 * @param {Function} callback - 回调函数 ({message: string})
 * @returns {Function} 取消监听函数
 */
export function onGameError(callback) {
  socket.on(ServerEvents.GAME_ERROR, callback);
  return () => socket.off(ServerEvents.GAME_ERROR, callback);
}

/**
 * 监听玩家发言
 * @param {Function} callback - 回调函数 ({playerId, playerName, content, emotion, timestamp})
 * @returns {Function} 取消监听函数
 */
export function onPlayerSpeech(callback) {
  socket.on(ServerEvents.PLAYER_SPEECH, callback);
  return () => socket.off(ServerEvents.PLAYER_SPEECH, callback);
}

/**
 * 监听玩家情绪变化
 * @param {Function} callback - 回调函数 ({playerId, emotion})
 * @returns {Function} 取消监听函数
 */
export function onPlayerEmotion(callback) {
  socket.on(ServerEvents.PLAYER_EMOTION, callback);
  return () => socket.off(ServerEvents.PLAYER_EMOTION, callback);
}

// ==================== 统一监听器设置 ====================

/**
 * 设置所有必要的监听器
 * @param {object} listeners - 监听器对象
 * @returns {Function} 清理函数
 */
export function setupSocketListeners(listeners) {
  const {
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onRoomUpdate,
    onGameState,
    onActions,
    onGameEnd,
    onError,
    onPlayerSpeech,
    onPlayerEmotion,
  } = listeners;

  // 连接事件
  if (handleConnect) socket.on('connect', handleConnect);
  if (handleDisconnect) socket.on('disconnect', handleDisconnect);

  // 房间事件
  socket.on(ServerEvents.ROOM_UPDATED, (data) => {
    if (onRoomUpdate) onRoomUpdate(data.room);
  });
  socket.on(ServerEvents.ROOM_ERROR, (data) => {
    if (onError) onError(data.message);
  });

  // 游戏事件
  socket.on(ServerEvents.GAME_STARTED, () => {
    console.log('[Socket] 游戏开始');
  });
  socket.on(ServerEvents.GAME_STATE, (data) => {
    console.log('[Socket] 收到游戏状态');
    if (onGameState) {
      onGameState(data.state, data.yourHand, data.yourTurn, data.lastDrawnTile, data.turnPhase);
    }
  });
  socket.on(ServerEvents.GAME_ACTIONS, (data) => {
    console.log('[Socket] 收到可用操作:', data.actions);
    if (onActions) onActions(data.actions);
  });
  socket.on(ServerEvents.GAME_ENDED, (data) => {
    if (onGameEnd) onGameEnd(data.winner, data.winningHand, data.players);
  });
  socket.on(ServerEvents.GAME_ERROR, (data) => {
    if (onError) onError(data.message);
  });

  // 发言系统
  if (onPlayerSpeech) {
    socket.on(ServerEvents.PLAYER_SPEECH, onPlayerSpeech);
  }
  if (onPlayerEmotion) {
    socket.on(ServerEvents.PLAYER_EMOTION, onPlayerEmotion);
  }

  // 返回清理函数
  return () => {
    if (handleConnect) socket.off('connect', handleConnect);
    if (handleDisconnect) socket.off('disconnect', handleDisconnect);
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

// 导出 socket 实例供高级用法
export { socket, SOCKET_URL, ClientEvents, ServerEvents };
