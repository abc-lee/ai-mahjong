/**
 * AI 管理器
 * 管理所有 AIAdapter 的生命周期
 */

import type { Player, AIConfig } from '@shared/types';
import { AIAdapter } from './AIAdapter';

/**
 * AI 管理器类
 */
export class AIManager {
  private adapters: Map<string, AIAdapter> = new Map();

  /**
   * 创建 AIAdapter
   */
  createAdapter(player: Player): AIAdapter | null {
    if (!player.aiConfig) return null;
    
    const adapter = new AIAdapter(player);
    this.adapters.set(player.id, adapter);
    return adapter;
  }

  /**
   * 销毁 AIAdapter
   */
  destroyAdapter(playerId: string): void {
    this.adapters.delete(playerId);
  }

  /**
   * 获取 AIAdapter
   */
  getAdapter(playerId: string): AIAdapter | undefined {
    return this.adapters.get(playerId);
  }

  /**
   * 游戏开始时初始化所有 AI
   */
  initGame(players: Player[]): void {
    for (const player of players) {
      if (player.type === 'ai' && player.aiConfig) {
        this.createAdapter(player);
      }
    }
  }

  /**
   * 游戏结束时清理所有 AI
   */
  cleanupGame(playerIds: string[]): void {
    for (const id of playerIds) {
      this.destroyAdapter(id);
    }
  }

  /**
   * 人类玩家断线时创建临时托管
   */
  createFallbackAdapter(player: Player): AIAdapter | null {
    const fallbackConfig: AIConfig = {
      personality: 'balanced',
      llmEnabled: false,
      timeout: 5000,
      thinkTimeMin: 300,
      thinkTimeMax: 800,
      maxRetries: 0,
    };

    player.aiFallback = fallbackConfig;
    return this.createAdapter({
      ...player,
      aiConfig: fallbackConfig,
    });
  }

  /**
   * 获取所有 AI 玩家 ID
   */
  getAIPlayerIds(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// 单例导出
export const aiManager = new AIManager();
