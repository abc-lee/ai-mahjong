/**
 * AI 事件队列
 * 每个 AI 玩家有独立的事件队列，实时接收所有游戏事件
 */

import type { Tile } from '@shared/types';

// 事件类型
export type GameEventType = 
  | 'game_start'        // 游戏开始
  | 'game_end'          // 游戏结束
  | 'your_turn'         // 轮到自己
  | 'your_draw'         // 自己摸牌
  | 'player_discard'    // 有人打牌
  | 'player_action'     // 有人碰/杠/胡
  | 'player_speak'      // 有人发言
  | 'waiting'           // 等待中
  | 'turn_change';      // 回合变化

// 事件数据
export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  data: {
    // 通用
    playerId?: string;
    playerName?: string;
    
    // 打牌
    tile?: Tile;
    tileDisplay?: string;
    
    // 碰/杠/胡
    action?: 'chi' | 'peng' | 'gang' | 'hu';
    tiles?: Tile[];
    
    // 发言
    content?: string;
    
    // 自己的回合
    hand?: Tile[];
    lastDrawnTile?: Tile;
    gameState?: any;
    availableActions?: any[];
    
    // 其他
    [key: string]: any;
  };
}

// 单个 AI 的事件队列
class AIEventQueue {
  private queue: GameEvent[] = [];
  private maxEvents: number;
  
  constructor(maxEvents: number = 50) {
    this.maxEvents = maxEvents;
  }
  
  /**
   * 添加事件到队列
   */
  push(event: GameEvent): void {
    this.queue.push(event);
    // 限制队列长度
    if (this.queue.length > this.maxEvents) {
      this.queue.shift();
    }
  }
  
  /**
   * 获取所有未处理事件
   */
  getAll(): GameEvent[] {
    return [...this.queue];
  }
  
  /**
   * 获取最近 N 个事件
   */
  getRecent(count: number): GameEvent[] {
    return this.queue.slice(-count);
  }
  
  /**
   * 清空队列
   */
  clear(): void {
    this.queue = [];
  }
  
  /**
   * 获取队列长度
   */
  get length(): number {
    return this.queue.length;
  }
}

// 管理所有 AI 的事件队列
class EventQueueManager {
  private queues: Map<string, AIEventQueue> = new Map();
  
  /**
   * 为 AI 创建队列
   */
  createQueue(playerId: string): void {
    if (!this.queues.has(playerId)) {
      this.queues.set(playerId, new AIEventQueue());
    }
  }
  
  /**
   * 删除 AI 队列
   */
  removeQueue(playerId: string): void {
    this.queues.delete(playerId);
  }
  
  /**
   * 向单个 AI 推送事件
   */
  pushTo(playerId: string, event: GameEvent): void {
    const queue = this.queues.get(playerId);
    if (queue) {
      queue.push(event);
    }
  }
  
  /**
   * 向所有 AI 广播事件
   */
  broadcast(event: GameEvent, excludePlayerIds: string[] = []): void {
    for (const [playerId, queue] of this.queues) {
      if (!excludePlayerIds.includes(playerId)) {
        queue.push(event);
      }
    }
  }
  
  /**
   * 获取 AI 的事件队列
   */
  getQueue(playerId: string): GameEvent[] {
    const queue = this.queues.get(playerId);
    return queue ? queue.getAll() : [];
  }
  
  /**
   * 获取 AI 最近的事件
   */
  getRecentEvents(playerId: string, count: number): GameEvent[] {
    const queue = this.queues.get(playerId);
    return queue ? queue.getRecent(count) : [];
  }
  
  /**
   * 清空 AI 队列
   */
  clearQueue(playerId: string): void {
    const queue = this.queues.get(playerId);
    if (queue) {
      queue.clear();
    }
  }
}

// 单例
export const eventQueueManager = new EventQueueManager();
