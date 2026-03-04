/**
 * 游戏状态定义
 */

import { Tile } from './tile';
import { Player, PlayerPublic } from './player';

// 游戏阶段
export type GamePhase = 'waiting' | 'playing' | 'finished';

// 当前回合阶段
export type TurnPhase = 'draw' | 'discard' | 'action';

// 等待中的操作
export interface PendingAction {
  playerId: string;
  action: 'chi' | 'peng' | 'gang' | 'hu';
  tiles?: Tile[];
  priority: number;  // 优先级：胡(4) > 杠(3) > 碰(2) > 吃(1)
}

// 游戏事件
export interface GameEvent {
  type: 'win' | 'lose' | 'ronned' | 'selfDrawn' | 'goodHandMissed';
  severity: 1 | 2 | 3;
  timestamp: number;
  description?: string;
}

// 情绪上下文
export interface EmotionContext {
  currentMood: import('./player').Mood;
  recentEvents: GameEvent[];
  streak: {
    type: 'win' | 'lose' | null;
    count: number;
  };
  thisRound: {
    scoreChange: number;
    wasRonned: boolean;
    wasSelfDraw: boolean;
  };
}

// 游戏状态
export interface GameState {
  roomId: string;
  phase: GamePhase;
  
  // 玩家
  players: Player[];
  currentPlayerIndex: number;
  
  // 牌组
  wall: Tile[];
  lastDiscard: Tile | null;
  lastDiscardPlayer: number;
  
  // 游戏信息
  dealerIndex: number;
  roundNumber: number;
  
  // 等待操作
  pendingActions: PendingAction[];
  
  // 胜利信息
  winner: number | null;
  winningHand: WinningHand | null;
}

// 公开的游戏状态（广播给所有玩家）
export interface GameStatePublic {
  roomId: string;
  phase: GamePhase;
  
  // 玩家（隐藏手牌）
  players: PlayerPublic[];
  currentPlayerIndex: number;
  
  // 牌组
  wallRemaining: number;
  lastDiscard: Tile | null;
  lastDiscardPlayer: number;
  
  // 游戏信息
  dealerIndex: number;
  roundNumber: number;
  
  // 是否有待处理的操作
  hasPendingActions: boolean;
  
  // 胜利信息
  winner: number | null;
}

// 胡牌信息
export interface WinningHand {
  tiles: Tile[];
  melds: import('./meld').Meld[];
  fans: Fan[];
  score: number;
  isSelfDraw: boolean;
}

// 番型
export interface Fan {
  id: string;
  name: string;
  fan: number;
  enabled: boolean;
}

// 获取操作的优先级
export function getActionPriority(action: 'chi' | 'peng' | 'gang' | 'hu'): number {
  switch (action) {
    case 'hu': return 4;
    case 'gang': return 3;
    case 'peng': return 2;
    case 'chi': return 1;
  }
}
