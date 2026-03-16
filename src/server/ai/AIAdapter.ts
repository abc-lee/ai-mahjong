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
import { promptLoader } from '../prompt/PromptLoader';

// 全局冷却时间（防止刷屏）
const REACTION_COOLDOWN = 10000; // 10秒
const lastReactionTime = new Map<string, number>();

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
  | { type: 'ACTION_REQUIRED'; availableActions: PendingAction[]; lastDiscard: Tile; lastDiscardPlayerName?: string; gameState: GameStatePublic }
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

    const systemPrompt = promptLoader.getWithVars('aiAdapter.chatResponse.system', {
      playerName: this.player.name,
      traits: personality.traits.join('、'),
      speakStyle: personality.speakStyle
    });

    const userPrompt = promptLoader.getWithVars('aiAdapter.chatResponse.user', {
      fromPlayer,
      message
    });

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

    // 检查冷却时间（防止刷屏）
    const now = Date.now();
    const lastTime = lastReactionTime.get(this.player.id) || 0;
    if (now - lastTime < REACTION_COOLDOWN) {
      console.log(`[AIAdapter] ${this.player.name} 冷却中，跳过反应`);
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
          // 碰/杠/胡事件：显示是谁打出的什么牌
          const actionName = e.data.actionName || e.data.action;
          if (e.data.targetPlayerName && e.data.targetTileDisplay) {
            return `${e.data.playerName} ${actionName}了 ${e.data.targetPlayerName} 打出的 ${e.data.targetTileDisplay}`;
          } else if (e.data.targetTileDisplay) {
            return `${e.data.playerName} ${actionName}了 ${e.data.targetTileDisplay}`;
          } else {
            return `${e.data.playerName} ${actionName}了`;
          }
        case 'player_speak':
          return `${e.data.playerName} 说："${e.data.content}"`;
        default:
          return null;
      }
    }).filter(Boolean).join('\n');

    if (!eventDescriptions) {
      return { reaction: null };
    }

    // 找到最近发言的人
    const lastSpeaker = recentEvents
      .filter(e => e.type === 'player_speak')
      .map(e => e.data.playerName)
      .find(name => name !== this.player.name);

    // 检测是否有人在@我说话
    const isMentioned = recentEvents.some(e => 
      e.type === 'player_speak' && 
      e.data.content && 
      e.data.content.includes(this.player.name)
    );

    const personality = PERSONALITIES[this.player.name] || {
      name: this.player.name,
      traits: ['普通'],
      speakStyle: '正常说话',
    };

    // 找到所有其他AI的名字
    const otherPlayers = recentEvents
      .filter(e => e.type === 'player_speak' && e.data.playerName !== this.player.name)
      .map(e => e.data.playerName);
    const otherPlayer = otherPlayers[otherPlayers.length - 1] || '其他玩家';

    const systemPrompt = promptLoader.getWithVars('aiAdapter.queueReaction.system', {
      playerName: this.player.name,
      traits: personality.traits.join('、'),
      speakStyle: personality.speakStyle,
      otherPlayer
    });

    let userPrompt = '';
    if (isMentioned) {
      userPrompt = promptLoader.getWithVars('aiAdapter.queueReaction.userMentioned', {
        otherPlayer,
        eventDescriptions
      });
    } else if (lastSpeaker) {
      userPrompt = promptLoader.getWithVars('aiAdapter.queueReaction.userWithSpeaker', {
        lastSpeaker,
        eventDescriptions
      });
    } else {
      userPrompt = promptLoader.getWithVars('aiAdapter.queueReaction.userDefault', {
        eventDescriptions
      });
    }

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
      
      // 更新最后发言时间
      lastReactionTime.set(this.player.id, Date.now());
      
      console.log(`[AIAdapter] ${this.player.name} 对事件反应: ${content}`);
      return { reaction: content };
    } catch (e: any) {
      console.log(`[AIAdapter] ${this.player.name} 事件反应失败:`, e.message);
      return { reaction: null };
    }
  }

  /**
   * 生成闲置时的私房话
   * 返回 { message, targetName } - targetName 是对话目标
   */
  async generateIdleChat(otherAIs: { name: string }[] = [], recentChats: { playerName: string; content: string }[] = []): Promise<{ message: string; targetName?: string } | null> {
    const timestamp = new Date().toISOString().substring(11, 23);
    console.log(`[${timestamp}] [AIAdapter] ${this.player.name} generateIdleChat 被调用`);
    console.log(`[${timestamp}] [AIAdapter] ${this.player.name} llmEnabled=${this.config.llmEnabled}, llmApiKey=${this.config.llmApiKey ? '有' : '无'}`);
    
    if (!this.config.llmEnabled || !this.config.llmApiKey) {
      console.log(`[${timestamp}] [AIAdapter] ${this.player.name} 无LLM配置，跳过私房话`);
      return null;
    }
    
    // 检查冷却时间（防止刷屏）
    const now = Date.now();
    const lastTime = lastReactionTime.get(this.player.id) || 0;
    if (now - lastTime < REACTION_COOLDOWN) {
      console.log(`[${timestamp}] [AIAdapter] ${this.player.name} 冷却中，跳过私房话`);
      return null;
    }
    
    console.log(`[${timestamp}] [AIAdapter] ${this.player.name} 开始生成私房话...`);
    
    const personality = PERSONALITIES[this.player.name] || {
      name: this.player.name,
      traits: ['普通'],
      speakStyle: '正常说话',
    };
    
    // 其他AI的名字
    const otherAINames = otherAIs.filter(ai => ai.name !== this.player.name).map(ai => ai.name);
    
    // 最近的聊天内容
    const chatContext = recentChats.length > 0 
      ? `\n\n【最近聊天】\n${recentChats.slice(-5).map(c => `${c.playerName}: ${c.content}`).join('\n')}`
      : '';
    
    // 判断是否需要回应某人
    const lastChat = recentChats[recentChats.length - 1];
    const isReplyingToMe = lastChat && lastChat.content.includes(this.player.name);
    
    const systemPrompt = promptLoader.getWithVars('aiAdapter.idleChat.system', {
      playerName: this.player.name,
      traits: personality.traits.join('、'),
      speakStyle: personality.speakStyle,
      otherAINames: otherAINames.length > 0 ? otherAINames.join('、') : '就你一个AI'
    });

    let userPrompt = '';
    if (isReplyingToMe && lastChat) {
      // 有人在跟我说话，我要回应
      userPrompt = promptLoader.getWithVars('aiAdapter.idleChat.userReplyingToMe', {
        lastChatPlayer: lastChat.playerName,
        lastChatContent: lastChat.content
      });
    } else if (recentChats.length > 0) {
      // 有聊天记录，可以接话或找人说
      userPrompt = promptLoader.getWithVars('aiAdapter.idleChat.userWithChats', {
        chatContext: chatContext.replace('\n\n【最近聊天】\n', '')
      });
    } else {
      // 没有聊天，主动开启话题
      userPrompt = promptLoader.get('aiAdapter.idleChat.userNoChat');
    }
    
    try {
      const modelId = this.config.llmModel || 'gpt-4o';
      const providerType = this.config.llmProviderType || 'openai';
      const endpoint = this.config.llmEndpoint?.replace('/chat/completions', '').replace('/v1/messages', '');
      
      const result = await chatWithSystem(
        {
          provider: providerType,
          apiKey: this.config.llmApiKey,
          baseURL: endpoint || 'https://api.openai.com/v1',
          model: modelId,
        },
        systemPrompt,
        userPrompt,
        { temperature: this.getTemperature(), maxTokens: 50 }
      );
      
      let content = result.text?.trim() || '';
      
      if (!content || content.length < 2) {
        return null;
      }
      
      if (content.length > 50) {
        content = content.substring(0, 50) + '...';
      }
      
      // 检测话里提到了谁
      let targetName: string | undefined;
      for (const name of otherAINames) {
        if (content.includes(name)) {
          targetName = name;
          break;
        }
      }
      
      // 更新最后发言时间
      lastReactionTime.set(this.player.id, Date.now());
      
      return { message: content, targetName };
    } catch (e: any) {
      console.log(`[AIAdapter] ${this.player.name} 私房话生成失败:`, e.message);
      return null;
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
    
    const systemPrompt = promptLoader.getWithVars('aiAdapter.decision.system', {
      playerName: this.player.name,
      traits: personality.traits.join('、'),
      personalityHint
    });

    // 用户消息（当前游戏状态）
    let chatSection = '';
    if (chatHistory && chatHistory.length > 0) {
      const recentChat = chatHistory.slice(-5);
      chatSection = `\n\n【最近聊天】\n${recentChat.map(m => `${m.playerName}: ${m.content}`).join('\n')}\n`;
    }
    
    // 方位映射
    const directions = ['东', '南', '西', '北'];
    const myDirection = directions[this.player.position];
    const dealerIndex = gameState.dealerIndex;
    
    // 构建其他玩家信息
    let otherPlayersSection = '';
    if (gameState.players && gameState.players.length > 0) {
      const otherPlayersInfo = gameState.players
        .filter(p => p.id !== this.player.id)
        .map(p => {
          const dir = directions[p.position];
          const discardsStr = p.discards && p.discards.length > 0 
            ? p.discards.map(t => t.display).join(' ') 
            : '无';
          const meldsStr = p.melds && p.melds.length > 0
            ? p.melds.map(m => `${m.type === 'chi' ? '吃' : m.type === 'peng' ? '碰' : '杠'}(${m.tiles.map(t => t.display).join('')})`).join(' ')
            : '无';
          const dealerMark = p.isDealer ? ', 庄家' : '';
          return `${dir}(${p.name}): 弃牌[${discardsStr}], 副露[${meldsStr}], 分数${p.score}${dealerMark}`;
        }).join('\n');
      if (otherPlayersInfo) {
        otherPlayersSection = `\n\n【其他玩家】\n${otherPlayersInfo}`;
      }
    }
    
    // 最后打出的牌信息
    let lastDiscardSection = '';
    if (gameState.lastDiscard && gameState.lastDiscardPlayer >= 0) {
      const lastDiscardPlayer = gameState.players[gameState.lastDiscardPlayer];
      if (lastDiscardPlayer) {
        const lastDir = directions[gameState.lastDiscardPlayer];
        lastDiscardSection = `\n\n【上一张弃牌】\n${lastDir}(${lastDiscardPlayer.name}) 打了 ${gameState.lastDiscard.display}`;
      }
    }
    
    // 庄家信息
    const dealerPlayer = gameState.players.find(p => p.isDealer);
    const dealerInfo = dealerPlayer ? `庄家: ${dealerPlayer.name}` : '';
    
    const userPrompt = promptLoader.getWithVars('aiAdapter.decision.user', {
      myDirection,
      playerName: this.player.name,
      handTiles: this.player.hand.map(t => `${t.display}[${t.id}]`).join(' '),
      wallRemaining: gameState.wallRemaining,
      lastDiscardSection,
      otherPlayersSection,
      chatSection
    });

    // 打印完整prompt用于调试
    console.log(`[AIAdapter] ====== PROMPT for ${this.player.name} ======`);
    console.log(`[AIAdapter] 手牌: ${this.player.hand.map(t => `${t.display}[${t.id}]`).join(' ')}`);
    console.log(`[AIAdapter] ====== END PROMPT ======`);

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
    
    // 从 promptLoader 获取性格 hint
    const personalityConfig = promptLoader.getPersonality(personality);
    if (personalityConfig) {
      return personalityConfig.hint;
    }
    
    // 降级：默认提示
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
