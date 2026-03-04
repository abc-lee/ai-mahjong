/**
 * AI 适配器
 * 服务端中间层，处理 AI 玩家的决策
 */

import type { Player, AIConfig } from '@shared/types';
import type { Tile, GameStatePublic, PendingAction } from '@shared/types';
import { promptGenerator, PromptType } from '../prompt';
import { findBestDiscard } from './RuleEngine';

// AI 决策
export interface AIDecision {
  action: 'draw' | 'discard' | 'chi' | 'peng' | 'gang' | 'hu' | 'pass';
  tileId?: string;
  tiles?: string[];
  message?: string;
}

// 游戏事件
export type GameEvent = 
  | { type: 'GAME_START'; hand: Tile[]; position: number }
  | { type: 'YOUR_TURN_DRAW'; gameState: GameStatePublic }
  | { type: 'YOUR_TURN_DISCARD'; lastDrawnTile?: Tile; gameState: GameStatePublic }
  | { type: 'ACTION_REQUIRED'; availableActions: PendingAction[]; lastDiscard: Tile; gameState: GameStatePublic }
  | { type: 'OTHER_PLAYER_ACTION'; playerName: string; action: string; tile?: Tile }
  | { type: 'GAME_END'; winner: string; scores: Record<string, number> };

/**
 * AI 适配器类
 */
export class AIAdapter {
  private player: Player;
  private config: AIConfig;
  private consecutiveFailures: number = 0;
  private readonly FAILURE_THRESHOLD: number = 3;

  constructor(player: Player) {
    this.player = player;
    this.config = player.aiConfig!;
  }

  /**
   * 处理游戏事件
   */
  async handleEvent(event: GameEvent): Promise<AIDecision | null> {
    const thinkTime = this.randomThinkTime();

    switch (event.type) {
      case 'YOUR_TURN_DRAW':
        await this.delay(thinkTime);
        return { action: 'draw' };

      case 'YOUR_TURN_DISCARD':
        await this.delay(thinkTime);
        return this.decideDiscard(event.gameState, event.lastDrawnTile);

      case 'ACTION_REQUIRED':
        await this.delay(thinkTime);
        return this.decideAction(event.availableActions);

      default:
        return null;
    }
  }

  /**
   * 决策：打哪张牌
   */
  private async decideDiscard(gameState: GameStatePublic, lastDrawnTile?: Tile): Promise<AIDecision> {
    // 1. 尝试 LLM
    if (this.config.llmEnabled && this.consecutiveFailures < this.FAILURE_THRESHOLD) {
      try {
        const decision = await this.callLLM(gameState);
        if (decision && this.validateDiscard(decision)) {
          this.consecutiveFailures = 0;
          return decision;
        }
      } catch (e) {
        this.consecutiveFailures++;
        console.log(`[AIAdapter] LLM 失败 (${this.consecutiveFailures}/${this.FAILURE_THRESHOLD})`);
      }
    }

    // 2. 降级：规则引擎
    const ruleDecision = this.ruleBasedDecision();
    if (ruleDecision) return ruleDecision;

    // 3. 最终降级：随机
    return this.randomDecision();
  }

  /**
   * 决策：吃碰杠胡
   */
  private async decideAction(availableActions: PendingAction[]): Promise<AIDecision> {
    // 优先级：胡 > 杠 > 碰 > 吃
    const priority = ['hu', 'gang', 'peng', 'chi'];
    
    for (const actionType of priority) {
      const action = availableActions.find(a => a.action === actionType);
      if (action) {
        return {
          action: action.action,
          tiles: action.tiles?.map(t => t.id),
        };
      }
    }

    return { action: 'pass' };
  }

  /**
   * 调用 LLM
   */
  private async callLLM(gameState: GameStatePublic): Promise<AIDecision | null> {
    if (!this.config.llmEndpoint) return null;

    const prompt = promptGenerator.generate(PromptType.YOUR_TURN_DISCARD, {
      playerId: this.player.id,
      playerName: this.player.name,
      position: this.player.position,
      isDealer: this.player.isDealer,
      hand: this.player.hand,
      gameState,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.llmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.llmApiKey || ''}`,
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();
      return this.parseLLMResponse(data);
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(data: any): AIDecision | null {
    try {
      if (data.action && typeof data.action === 'string') {
        return {
          action: data.action,
          tileId: data.tile || data.tileId,
          tiles: data.tiles,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 规则引擎决策
   */
  private ruleBasedDecision(): AIDecision | null {
    const hand = this.player.hand;
    if (hand.length === 0) return null;

    // 使用规则引擎找出最佳出牌
    const bestTile = findBestDiscard(hand, this.player.melds);
    if (bestTile) {
      return {
        action: 'discard',
        tileId: bestTile.id,
      };
    }

    // 保底：随机
    return this.randomDecision();
  }

  /**
   * 随机决策
   */
  randomDecision(): AIDecision {
    const hand = this.player.hand;
    const randomTile = hand[Math.floor(Math.random() * hand.length)];
    return {
      action: 'discard',
      tileId: randomTile.id,
    };
  }

  /**
   * 验证打牌决策
   */
  private validateDiscard(decision: AIDecision): boolean {
    if (decision.action !== 'discard') return false;
    if (!decision.tileId) return false;
    return this.player.hand.some(t => t.id === decision.tileId);
  }

  /**
   * 随机思考时间
   */
  private randomThinkTime(): number {
    return Math.random() * (this.config.thinkTimeMax - this.config.thinkTimeMin) + this.config.thinkTimeMin;
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
