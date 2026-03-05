/**
 * 房间管理系统
 * 管理麻将游戏房间，处理玩家加入、离开、游戏开始等操作
 */

import { GameEngine } from '../game/GameEngine';
import { Player, GamePhase } from '../../shared/types';

// 房间状态
export type RoomState = 'waiting' | 'playing' | 'finished';

// 房间设置
export interface RoomSettings {
  maxPlayers: number;      // 麻将固定为4人
  allowSpectators: boolean; // 是否允许观战
  baseScore: number;       // 基础分数
}

// 房间信息
export interface Room {
  id: string;
  name: string;
  host: string;            // 房主玩家ID
  players: Player[];
  spectators: Player[];
  state: RoomState;
  gameEngine?: GameEngine;
  createdAt: Date;
  settings: RoomSettings;
}

// 默认房间设置
const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 4,
  allowSpectators: true,
  baseScore: 1000,
};

/**
 * 生成唯一ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 11);
  return `${timestamp}-${randomPart}`;
}

/**
 * 创建新玩家对象
 */
function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    position: 0,
    type: 'human',
    hand: [],
    melds: [],
    discards: [],
    isDealer: false,
    score: 1000,
    isReady: false,
    isOnline: true,
    mood: 'normal',
  };
}

/**
 * 房间管理器
 * 负责创建、销毁房间，管理玩家进出
 */
export class RoomManager {
  private rooms: Map<string, Room>;
  private playerRoomMap: Map<string, string>; // playerId -> roomId

  constructor() {
    this.rooms = new Map();
    this.playerRoomMap = new Map();
  }

  // ==================== 房间管理 ====================

  /**
   * 创建新房间
   */
  createRoom(hostId: string, hostName: string, settings?: Partial<RoomSettings>): Room {
    const roomId = generateId();
    const host = createPlayer(hostId, hostName);
    host.isReady = true; // 房主默认准备
    
    const room: Room = {
      id: roomId,
      name: `${hostName}的房间`,
      host: hostId,
      players: [host],
      spectators: [],
      state: 'waiting',
      createdAt: new Date(),
      settings: { ...DEFAULT_ROOM_SETTINGS, ...settings },
    };

    this.rooms.set(roomId, room);
    this.playerRoomMap.set(hostId, roomId);

    return room;
  }

  /**
   * 加入房间
   */
  joinRoom(roomId: string, playerId: string, playerName: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('房间不存在');
    }

    if (this.playerRoomMap.has(playerId)) {
      throw new Error('玩家已在其他房间中');
    }

    if (room.state !== 'waiting') {
      throw new Error('游戏已开始，无法加入');
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('房间已满');
    }

    const player = createPlayer(playerId, playerName);
    player.position = room.players.length as 0 | 1 | 2 | 3;
    
    room.players.push(player);
    this.playerRoomMap.set(playerId, roomId);

    return true;
  }

  /**
   * 离开房间
   */
  leaveRoom(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      // 检查是否是观众
      const spectatorIndex = room.spectators.findIndex(p => p.id === playerId);
      if (spectatorIndex !== -1) {
        room.spectators.splice(spectatorIndex, 1);
        this.playerRoomMap.delete(playerId);
      }
      return false;
    }

    // 移除玩家
    room.players.splice(playerIndex, 1);
    this.playerRoomMap.delete(playerId);

    // 如果游戏进行中，结束游戏
    if (room.state === 'playing') {
      this.endGame(roomId);
    }

    // 重新分配座位
    this.reassignPositions(room);

    // 如果房主离开，转移房主
    if (room.host === playerId && room.players.length > 0) {
      room.host = room.players[0].id;
      room.name = `${room.players[0].name}的房间`;
    }

    return true;
  }

  /**
   * 获取房间
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * 获取所有房间列表
   */
  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  // ==================== 游戏控制 ====================

  /**
   * 开始游戏
   */
  startGame(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('房间不存在');
    }

    if (room.state !== 'waiting') {
      throw new Error('游戏已开始或已结束');
    }

    if (room.players.length !== 4) {
      throw new Error('需要4名玩家才能开始游戏');
    }

    // 检查所有玩家是否已准备
    const allReady = room.players.every(p => p.isReady);
    if (!allReady) {
      throw new Error('还有玩家未准备');
    }

    // 初始化游戏引擎
    room.gameEngine = new GameEngine(roomId);
    
    // 重置玩家状态
    room.players.forEach(player => {
      player.hand = [];
      player.melds = [];
      player.discards = [];
      player.isDealer = false;
    });

    // 开始游戏
    room.gameEngine.startGame(room.players);
    room.state = 'playing';

    return true;
  }

  /**
   * 结束游戏
   */
  endGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.state = 'finished';
    
    if (room.gameEngine) {
      const gameState = room.gameEngine.getState();
      // 更新玩家分数
      room.players.forEach(player => {
        const gameStatePlayer = gameState.players.find(p => p.id === player.id);
        if (gameStatePlayer) {
          player.score = gameStatePlayer.score;
        }
      });
    }
  }

  // ==================== 玩家管理 ====================

  /**
   * 获取玩家所在房间
   */
  getPlayerRoom(playerId: string): Room | undefined {
    const roomId = this.playerRoomMap.get(playerId);
    if (!roomId) return undefined;
    return this.rooms.get(roomId);
  }

  /**
   * 设置玩家准备状态
   */
  setPlayerReady(roomId: string, playerId: string, ready: boolean): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return false;

    player.isReady = ready;
    return true;
  }

  /**
   * 添加 AI 玩家到房间
   */
  addAIPlayer(
    roomId: string,
    options?: {
      agentId?: string;
      name?: string;
      personality?: 'aggressive' | 'cautious' | 'balanced';
      type?: 'ai-agent' | 'ai-auto';
    }
  ): Player {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('房间不存在');
    }

    if (room.state !== 'waiting') {
      throw new Error('游戏已开始，无法加入');
    }

    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error('房间已满');
    }

    // 生成 AI 玩家 ID
    const aiPlayerId = options?.agentId || generateId();
    const playerType = options?.type || 'ai-agent';
    
    // 默认 AI 名称
    const aiNames = ['紫璃', '白泽', '李瞳'];
    const usedNames = room.players.map(p => p.name);
    const availableName = options?.name || 
      aiNames.find(n => !usedNames.includes(n)) || 
      `AI玩家${room.players.length + 1}`;

    // 创建 AI 玩家对象
    const aiPlayer: Player = {
      id: aiPlayerId,
      name: availableName,
      position: room.players.length as 0 | 1 | 2 | 3,
      type: playerType,
      agentId: playerType === 'ai-agent' ? aiPlayerId : undefined,
      aiConfig: {
        personality: options?.personality || 'balanced',
        llmEnabled: false,
        timeout: 5000,
        thinkTimeMin: 1000,
        thinkTimeMax: 3000,
        maxRetries: 3,
      },
      // 自动托管玩家初始化控制状态
      aiControl: playerType === 'ai-auto' ? { mode: 'auto' } : { mode: 'agent' },
      hand: [],
      melds: [],
      discards: [],
      isDealer: false,
      score: 1000,
      isReady: true,  // AI 默认准备
      isOnline: true,
      mood: 'normal',
    };

    // 添加到房间
    room.players.push(aiPlayer);
    this.playerRoomMap.set(aiPlayerId, roomId);

    return aiPlayer;
  }

  // ==================== 清理 ====================

  /**
   * 移除空房间
   */
  removeEmptyRooms(): void {
    for (const [roomId, room] of this.rooms) {
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 重新分配座位位置
   */
  private reassignPositions(room: Room): void {
    room.players.forEach((player, index) => {
      player.position = index as 0 | 1 | 2 | 3;
    });
  }
}

export default RoomManager;
