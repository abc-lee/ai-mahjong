/**
 * 玩家类型定义
 */

import { Tile } from './tile';
import { Meld } from './meld';

// 玩家类型
export type PlayerType = 'human' | 'ai-agent' | 'ai-auto';

// 情绪状态
export type Mood = 'confident' | 'happy' | 'normal' | 'upset' | 'angry' | 'devastated';

// AI 性格类型
export type AIPersonality = 'aggressive' | 'cautious' | 'balanced';

// AI 配置
export interface AIConfig {
  personality: AIPersonality;    // 性格
  llmEnabled: boolean;           // 是否使用大模型
  llmEndpoint?: string;          // 大模型 API 地址
  llmApiKey?: string;            // API Key
  timeout: number;               // 超时时间（毫秒）
  thinkTimeMin: number;          // 思考时间下限（毫秒）
  thinkTimeMax: number;          // 思考时间上限（毫秒）
  maxRetries: number;            // 最大重试次数
}

// AI 性格
export interface Personality {
  type: string;           // 性格类型
  traits: string[];       // 性格特点
  speakingStyle: string;  // 说话风格
  catchphrases: string[]; // 口头禅
}

// 玩家
export interface Player {
  id: string;
  name: string;
  position: 0 | 1 | 2 | 3; // 座位（东南西北）
  
  // 玩家类型
  type: PlayerType;
  
  // 人类玩家
  socketId?: string;          // Socket ID（仅人类有）
  
  // AI 玩家
  agentId?: string;           // OpenClaw Agent ID（仅 AI 有）
  aiConfig?: AIConfig;        // AI 配置（仅 AI 有）
  
  // AI 控制（agent 和 auto 共用）
  aiControl?: {
    mode: 'agent' | 'auto';   // 当前谁在控制
    agentSessionId?: string;  // Agent 会话 ID
    disconnectedAt?: number;  // 断线时间
  };
  
  // 人类断线托管
  aiFallback?: AIConfig;      // 托管配置（人类断线后启用）
  
  // 手牌
  hand: Tile[];
  
  // 副露
  melds: Meld[];
  
  // 弃牌
  discards: Tile[];
  
  // 状态
  isDealer: boolean;
  score: number;
  isReady: boolean;
  isOnline: boolean;
  
  // 情绪（AI 显示用）
  mood: Mood;
}

// 公开的玩家信息（其他玩家可以看到的）
export interface PlayerPublic {
  id: string;
  name: string;
  position: number;
  type: PlayerType;
  
  // 公开信息
  handCount: number;      // 手牌数量
  melds: Meld[];          // 副露
  discards: Tile[];       // 弃牌
  score: number;
  isDealer: boolean;
  isReady: boolean;       // 准备状态
  isOnline: boolean;
  mood: Mood;
}

// 转换为公开信息
export function toPublicPlayer(player: Player): PlayerPublic {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    type: player.type,
    handCount: player.hand.length,
    melds: player.melds,
    discards: player.discards,
    score: player.score,
    isDealer: player.isDealer,
    isReady: player.isReady,
    isOnline: player.isOnline,
    mood: player.mood,
  };
}
