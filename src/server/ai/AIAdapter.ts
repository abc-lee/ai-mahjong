/**
 * AI 适配器
 * 服务端中间层，处理 AI 玩家的决策
 */

import type { Player, AIConfig } from '@shared/types';
import type { Tile, GameStatePublic, PendingAction } from '@shared/types';
import { findBestDiscard } from './RuleEngine';
import { PERSONALITIES } from '../speech/SpeechManager';
import type { GameEvent as QueueEvent } from './EventQueue';
import { chatWithSystem } from '../llm/LLMService';

// AI 决策（扩展：包含发言和情绪）
export interface AIDecision {
  action: 'draw' | 'discard' | 'chi' | 'peng' | 'gang' | 'hu' | 'pass';
  tileId?: string;
  tiles?: string[];
  message?: string;      // AI 想说的话
  emotion?: string;      // 情绪：happy, angry, thinking, normal
  targetPlayer?: string; // 说话对象
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
  async handleEvent(event: GameEvent, chatHistory?: { playerName: string; content: string }[]): Promise<AIDecision | null> {
    const thinkTime = this.randomThinkTime();

    switch (event.type) {
      case 'YOUR_TURN_DRAW':
        await this.delay(thinkTime);
        return { action: 'draw' };

      case 'YOUR_TURN_DISCARD':
        await this.delay(thinkTime);
        return this.decideDiscard(event.gameState, event.lastDrawnTile, chatHistory);

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
  private async decideDiscard(gameState: GameStatePublic, lastDrawnTile?: Tile, chatHistory?: { playerName: string; content: string }[]): Promise<AIDecision> {
    console.log(`[AIAdapter] ${this.player.name} decideDiscard: llmEnabled=${this.config.llmEnabled}, endpoint=${this.config.llmEndpoint?.substring(0, 50)}`);
    
    // 1. 尝试 LLM
    if (this.config.llmEnabled && this.consecutiveFailures < this.FAILURE_THRESHOLD) {
      console.log(`[AIAdapter] ${this.player.name} 尝试调用 LLM...`);
      try {
        const decision = await this.callLLM(gameState, chatHistory);
        if (decision && this.validateDiscard(decision)) {
          this.consecutiveFailures = 0;
          console.log(`[AIAdapter] ${this.player.name} LLM 决策成功: ${decision.tileId}, 发言: ${decision.message || '无'}`);
          return decision;
        }
      } catch (e: any) {
        this.consecutiveFailures++;
        console.log(`[AIAdapter] ${this.player.name} LLM 失败 (${this.consecutiveFailures}/${this.FAILURE_THRESHOLD}): ${e.message}`);
      }
    } else {
      console.log(`[AIAdapter] ${this.player.name} 跳过 LLM: llmEnabled=${this.config.llmEnabled}, failures=${this.consecutiveFailures}`);
    }

    // 2. 降级：规则引擎
    console.log(`[AIAdapter] ${this.player.name} 使用规则引擎降级`);
    const ruleDecision = this.ruleBasedDecision();
    if (ruleDecision) return ruleDecision;

    // 3. 最终降级：随机
    return this.randomDecision();
  }

  /**
   * 生成聊天回应（不涉及决策，只回应发言）
   */
  async generateChatResponse(
    message: string, 
    fromPlayer: string, 
    chatHistory?: { playerName: string; content: string }[]
  ): Promise<string | null> {
    if (!this.config.llmEnabled || !this.config.llmEndpoint || !this.config.llmApiKey) {
      return null;
    }

    const personality = PERSONALITIES[this.player.name] || {
      name: this.player.name,
      traits: ['普通'],
      speakStyle: '正常说话',
    };

    const systemPrompt = `你是麻将玩家"${this.player.name}"。
性格：${personality.traits.join('、')}
说话风格：${personality.speakStyle}

直接回应，简短自然。不想回应就说"无"。`;

    const userPrompt = `${fromPlayer} 说："${message}"
你回应：`;

    try {
      const modelId = this.config.llmModel || 'gpt-4o';
      const providerType = this.config.llmProviderType || 'openai';
      const endpoint = this.config.llmEndpoint?.replace('/chat/completions', '').replace('/v1/messages', '');
      
      const result = await chatWithSystem(
        {
          provider: providerType,
          apiKey: this.config.llmApiKey!,
          baseURL: endpoint || 'https://api.openai.com/v1',
          model: modelId,
        },
        systemPrompt,
        userPrompt,
        { temperature: 1.0, maxTokens: 100 }
      );
      
      let content = result.text?.trim() || '';
      
      // 简单清理
      if (content.length > 50) {
        content = content.substring(0, 50) + '...';
      }
      
      return content || null;
    } catch (e: any) {
      console.log(`[AIAdapter] ${this.player.name} 聊天回应失败:`, e.message);
      return null;
    }
  }

  /**
   * 处理事件队列，生成反应/发言
   * 返回 { reaction: string | null, shouldAct: boolean }
   */
  async processQueueEvents(events: QueueEvent[]): Promise<{ reaction: string | null }> {
    if (!events.length || !this.config.llmEnabled) {
      return { reaction: null };
    }

    // 获取最近的事件（最多5个）
    const recentEvents = events.slice(-5);
    
    // 构建事件描述
    const eventDescriptions = recentEvents.map(e => {
      switch (e.type) {
        case 'player_discard':
          return `${e.data.playerName} 打了 ${e.data.tileDisplay}`;
        case 'player_action':
          return `${e.data.playerName} ${e.data.action}了`;
        case 'player_speak':
          return `${e.data.playerName} 说："${e.data.content}"`;
        default:
          return null;
      }
    }).filter(Boolean).join('\n');

    if (!eventDescriptions) {
      return { reaction: null };
    }

    // 20% 概率有反应
    if (Math.random() > 0.2) {
      return { reaction: null };
    }

    const personality = PERSONALITIES[this.player.name] || {
      name: this.player.name,
      traits: ['普通'],
      speakStyle: '正常说话',
    };

    const systemPrompt = `你是麻将玩家"${this.player.name}"。
性格：${personality.traits.join('、')}
说话风格：${personality.speakStyle}

直接说你的反应，简短自然。不想说就说"无"。`;

    const userPrompt = `刚才发生：
${eventDescriptions}

你回应：`;

    try {
      const modelId = this.config.llmModel || 'gpt-4o';
      const providerType = this.config.llmProviderType || 'openai';
      const endpoint = this.config.llmEndpoint?.replace('/chat/completions', '').replace('/v1/messages', '');
      
      const result = await chatWithSystem(
        {
          provider: providerType,
          apiKey: this.config.llmApiKey!,
          baseURL: endpoint || 'https://api.openai.com/v1',
          model: modelId,
        },
        systemPrompt,
        userPrompt,
        { temperature: 1.0, maxTokens: 50 }
      );
      
      let content = result.text?.trim() || '';
      
      if (!content || content === '无' || content === '无。' || content.length < 2) {
        return { reaction: null };
      }
      
      if (content.length > 30) {
        content = content.substring(0, 30) + '...';
      }
      
      console.log(`[AIAdapter] ${this.player.name} 对事件反应: ${content}`);
      return { reaction: content };
    } catch (e: any) {
      console.log(`[AIAdapter] ${this.player.name} 事件反应失败:`, e.message);
      return { reaction: null };
    }
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
   * 调用 LLM（使用原生 fetch，支持 reasoning_split）
   */
  private async callLLM(gameState: GameStatePublic, chatHistory?: { playerName: string; content: string }[]): Promise<AIDecision | null> {
    if (!this.config.llmEndpoint || !this.config.llmApiKey) return null;

    // 获取性格配置
    const personality = PERSONALITIES[this.player.name] || {
      name: this.player.name,
      traits: ['普通'],
      speakStyle: '正常说话',
    };
    
    const personalityHint = this.getPersonalityHint();
    
    const systemPrompt = `你是麻将玩家"${this.player.name}"，性格"${personality.traits.join('、')}"。

【你的性格特点】
${personalityHint}

【说话规则】
- 你必须在 message 字段里说话
- 说话要符合你的性格，有趣有个性
- 可以回应其他玩家的发言

【输出格式】
直接输出 JSON，不要任何思考过程或标签：
{"cmd":"discard","tile":"牌ID","message":"你想说的话"}`;

    // 用户消息（当前游戏状态）
    let chatSection = '';
    if (chatHistory && chatHistory.length > 0) {
      const recentChat = chatHistory.slice(-5);
      chatSection = `\n\n【最近聊天】\n${recentChat.map(m => `${m.playerName}: ${m.content}`).join('\n')}\n`;
    }
    
    const userPrompt = `【麻将游戏 - 你的回合】

手牌: ${this.player.hand.map(t => `${t.display}[${t.id}]`).join(' ')}
牌墙: ${gameState.wallRemaining}张${chatSection}

选择一张牌打出，输出 JSON。`;

    try {
      const modelId = this.config.llmModel || 'gpt-4o';
      const providerType = this.config.llmProviderType || 'openai';
      
      console.log(`[AIAdapter] 调用 LLM: provider=${providerType}, model=${modelId}`);
      
      // 使用 SDK 调用，自动处理思考链
      const endpoint = this.config.llmEndpoint?.replace('/chat/completions', '').replace('/v1/messages', '');
      
      const result = await chatWithSystem(
        {
          provider: providerType,
          apiKey: this.config.llmApiKey!,
          baseURL: endpoint || 'https://api.openai.com/v1',
          model: modelId,
        },
        systemPrompt,
        userPrompt,
        { 
          temperature: this.getTemperature(),
          maxTokens: 800,  // 决策层需要更多 token 输出 JSON
        }
      );
      
      const content = result.text;
      
      console.log(`[AIAdapter] SDK 响应: ${content?.substring(0, 200)}`);
      
      if (!content || content.length < 5) {
        console.log(`[AIAdapter] content 为空，跳过`);
        return null;
      }
      
      return this.parseLLMResponse(content);
    } catch (e: any) {
      console.error(`[AIAdapter] LLM 调用失败: ${e.message}`);
      throw e;
    }
  }

  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(content: string): AIDecision | null {
    try {
      console.log(`[AIAdapter] 解析内容: ${content.substring(0, 100)}`);
      
      // 查找 JSON 对象
      const jsonMatch = content.match(/\{[\s\S]*?"(?:cmd|action)"[\s\S]*?\}/i);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[0]);
          return this.buildDecision(data);
        } catch (e) {
          console.log(`[AIAdapter] JSON 解析失败`);
        }
      }
      
      console.log(`[AIAdapter] 未找到有效 JSON`);
      return null;
    } catch (e: any) {
      console.log(`[AIAdapter] 解析失败: ${e.message}`);
      return null;
    }
  }
  
  /**
   * 构建决策对象
   */
  private buildDecision(data: any): AIDecision | null {
    // 兼容两种格式：{cmd: "discard", tile: "..."} 和 {action: "discard", tileId: "..."}
    const action = data.action || data.cmd;
    const tileId = data.tileId || data.tile;
    
    if (action && typeof action === 'string') {
      console.log(`[AIAdapter] buildDecision 成功: action=${action}, tileId=${tileId}, message=${data.message || '无'}`);
      return {
        action: action as 'draw' | 'discard' | 'chi' | 'peng' | 'gang' | 'hu' | 'pass',
        tileId: tileId,
        tiles: data.tiles,
        message: data.message,
        emotion: data.emotion,
        targetPlayer: data.target,
      };
    }
    console.log(`[AIAdapter] buildDecision 失败: 无效 action, data=${JSON.stringify(data)}`);
    return null;
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
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 根据性格获取提示
   */
  private getPersonalityHint(): string {
    const personality = this.config.personality || 'balanced';
    
    const hints: Record<string, string> = {
      'chatty': '你是话痨！每轮都要说话，喜欢分析牌局、吐槽别人、讲笑话。说话要多、要啰嗦。',
      'aggressive': '你很激进！说话直接、有攻击性，喜欢挑衅对手、展示自信。',
      'balanced': '你性格平和，偶尔说话，话语中规中矩但有礼貌。',
      'cautious': '你很谨慎，话不多，说话时比较保守和谨慎。',
    };
    
    return hints[personality] || hints['balanced'];
  }

  /**
   * 根据性格获取 temperature
   * 话痨 > 激进 > 平衡 > 谨慎
   */
  private getTemperature(): number {
    const personality = this.config.personality || 'balanced';
    
    const temperatureMap: Record<string, number> = {
      'chatty': 1.2,      // 话痨：最高，最敢说话
      'aggressive': 1.0,  // 激进：高，敢于发言
      'balanced': 0.9,    // 平衡：中高
      'cautious': 0.7,    // 谨慎：中等偏低
    };
    
    return temperatureMap[personality] || 0.9;
  }
}
