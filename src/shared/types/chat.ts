/**
 * AI Agent 聊天消息类型定义
 * 
 * 统一定义所有消息类型，供前后端共享
 * 
 * @packageDocumentation
 */

/** 发送者类型 */
export type SenderType = 'human' | 'ai-agent';

/** 消息类型 */
export type MessageType = 'chat' | 'normal' | 'action' | 'system';

/** 情绪类型 */
export type EmotionType = 
  | 'happy' 
  | 'surprised' 
  | 'sad' 
  | 'thinking' 
  | 'confident';

/** 游戏动作类型 */
export type ActionType = 
  | 'discard' 
  | 'chi' 
  | 'peng' 
  | 'gang' 
  | 'hu' 
  | 'pass' 
  | 'draw';

/** 系统通知级别 */
export type NotificationLevel = 'info' | 'warning' | 'highlight';

/** 消息发送者信息 */
export interface MessageSender {
  id: string;
  name: string;
  type: SenderType;
  avatar?: string;
}

/** 纯聊天消息内容 */
export interface ChatTextContent {
  /** 消息文本 */
  text: string;
  /** 情绪类型（可选） */
  emotion?: EmotionType;
  /** 回复的消息 ID（可选） */
  replyTo?: string;
}

/** 游戏动作消息内容 */
export interface ActionContent {
  /** 动作描述文本 */
  text: string;
  /** 动作类型 */
  action: ActionType;
  /** 打出的牌（可选） */
  tile?: string;
  /** 目标牌（可选，用于吃碰杠） */
  targetTile?: string;
  /** 涉及的牌 ID 列表（可选） */
  tileIds?: string[];
}

/** 系统通知内容 */
export interface SystemContent {
  /** 通知内容 */
  notification: string;
  /** 通知级别（可选） */
  level?: NotificationLevel;
}

/** 消息内容变体联合类型 */
export type ChatContent = ChatTextContent | ActionContent | SystemContent;

/** 基础聊天消息接口 */
export interface ChatMessage {
  /** 消息唯一 ID */
  id: string;
  /** 时间戳（毫秒） */
  timestamp: number;
  /** 发送者信息 */
  sender: MessageSender;
  /** 消息类型 */
  type: MessageType;
  /** 消息内容 */
  content: ChatContent;
  /** 房间 ID（可选，服务端广播需要） */
  roomId?: string;
}

/** Agent 汇报事件类型 */
export type AgentReportEvent = 
  | 'discarded' 
  | 'chi' 
  | 'peng' 
  | 'gang' 
  | 'hu' 
  | 'chat' 
  | 'thinking';

/** 游戏结果类型 */
export type GameResult = 'win' | 'lose' | 'draw';

/** 状态更新汇报 */
export interface StatusUpdate {
  /** 汇报类型 */
  type: 'status_update';
  /** 房间 ID */
  roomId: string;
  /** 玩家信息 */
  player: { 
    id: string; 
    name: string; 
  };
  /** 事件类型 */
  event: AgentReportEvent;
  /** 事件内容 */
  content: { 
    tile?: string; 
    message?: string; 
    thought?: string; 
  };
  /** 游戏状态 */
  gameState: { 
    round: string; 
    remainingTiles: number; 
    scores: Record<string, number>; 
  };
  /** 时间戳（毫秒） */
  timestamp: number;
}

/** 聊天报告 */
export interface ChatReport {
  /** 汇报类型 */
  type: 'chat_report';
  /** 房间 ID */
  roomId: string;
  /** 玩家信息 */
  player: { 
    id: string; 
    name: string; 
  };
  /** 消息内容 */
  message: string;
  /** 情绪类型 */
  emotion: string;
  /** 回复的消息（可选） */
  replyTo?: { 
    playerId: string; 
    message: string; 
  };
  /** 时间戳（毫秒） */
  timestamp: number;
}

/** 游戏报告 */
export interface GameReport {
  /** 汇报类型 */
  type: 'game_report';
  /** 房间 ID */
  roomId: string;
  /** 玩家信息 */
  player: { 
    id: string; 
    name: string; 
  };
  /** 游戏结果 */
  result: GameResult;
  /** 得分 */
  score: number;
  /** 最终排名 */
  finalRank: number;
  /** 精彩时刻 */
  highlights: string[];
  /** 总结 */
  summary: string;
  /** 吐槽（可选） */
  complaints?: string[];
  /** 趣事（可选） */
  funFacts: string[];
  /** 时间戳（毫秒） */
  timestamp: number;
}

/** Agent 汇报协议联合类型 */
export type AgentReport = StatusUpdate | ChatReport | GameReport;

/** 状态更新类型（简化版，用于实时推送） */
export interface StatusUpdateLite {
  /** 玩家 ID */
  playerId: string;
  /** 玩家名称 */
  playerName: string;
  /** 状态类型 */
  status: 'thinking' | 'acting' | 'chatting' | 'idle';
  /** 状态描述（可选） */
  description?: string;
  /** 时间戳（毫秒） */
  timestamp: number;
}

/** 房间汇报存储 */
export interface RoomReports {
  /** 汇报列表 */
  reports: AgentReport[];
  /** 最后心跳时间：playerId -> timestamp */
  lastHeartbeat: Map<string, number>;
  /** 失联 Agent 列表 */
  disconnectedAgents: Set<string>;
}

/** Agent 信息 */
export interface AgentInfo {
  /** Agent ID */
  id: string;
  /** Agent 名称 */
  name: string;
  /** 连接状态 */
  status: 'connected' | 'disconnected';
  /** 最后心跳时间 */
  lastHeartbeat: number;
}

/** 房间状态 */
export interface RoomState {
  /** 房间 ID */
  roomId: string;
  /** Agent 列表 */
  agents: Map<string, AgentInfo>;
  /** 最后更新时间 */
  lastUpdate: number;
}
