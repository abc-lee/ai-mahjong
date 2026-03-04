/**
 * 房间类型定义
 */

import { PlayerPublic } from './player';
import { GamePhase } from './game';

// 房间状态
export type RoomState = 'waiting' | 'playing' | 'finished';

// 房间设置
export interface RoomSettings {
  maxPlayers: number;       // 麻将固定为4人
  allowSpectators: boolean; // 是否允许观战
  baseScore: number;        // 基础分数
}

// 房间信息（客户端使用）
export interface Room {
  id: string;
  name: string;
  host: string;             // 房主玩家ID
  players: PlayerPublic[];
  spectators: PlayerPublic[];
  state: RoomState;
  createdAt: number;        // 时间戳
  settings: RoomSettings;
}
