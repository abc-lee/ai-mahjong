/**
 * AI Agent Prompt 类型定义
 */

import type { Tile, GameStatePublic, PlayerPublic, PendingAction, Meld } from '@shared/types';

/**
 * Prompt 类型枚举
 */
export enum PromptType {
  GAME_START = 'GAME_START',
  YOUR_TURN_DRAW = 'YOUR_TURN_DRAW',
  YOUR_TURN_DISCARD = 'YOUR_TURN_DISCARD',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  ACTION_RESULT = 'ACTION_RESULT',
  OTHER_PLAYER_ACTION = 'OTHER_PLAYER_ACTION',
  GAME_END = 'GAME_END',
}

/**
 * AI Agent 返回格式
 */
export interface AIAgentResponse {
  // 必填：操作类型
  action: 'draw' | 'discard' | 'chi' | 'peng' | 'gang' | 'hu' | 'pass';
  
  // 打牌/吃碰杠时必填：相关牌
  tiles?: string[];  // 牌的 ID 列表
  
  // 可选：AI 的聊天内容
  message?: string;
  
  // 可选：AI 的情绪状态
  mood?: 'confident' | 'happy' | 'normal' | 'upset' | 'angry';
}

/**
 * Prompt 上下文
 */
export interface PromptContext {
  // 玩家信息
  playerId: string;
  playerName: string;
  position: number;
  isDealer: boolean;
  
  // 手牌
  hand: Tile[];
  lastDrawnTile?: Tile;
  
  // 游戏状态
  gameState: GameStatePublic;
  
  // 可用操作（吃碰杠胡时）
  availableActions?: PendingAction[];
  
  // 操作结果反馈
  actionResult?: {
    success: boolean;
    action: string;
    reason?: string;
  };
  
  // 其他玩家操作
  otherPlayerAction?: {
    playerName: string;
    position: number;
    action: string;
    tile?: Tile;
  };
  
  // 游戏结束信息
  gameEndInfo?: {
    winnerName: string;
    winnerPosition: number;
    winType: 'selfDraw' | 'ron';
    winningTiles: Tile[];
    scores: { playerName: string; score: number }[];
  };
}
