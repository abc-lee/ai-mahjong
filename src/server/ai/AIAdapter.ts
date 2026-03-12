/**
 * AI 适配器
 * 服务端中间层，处理 AI 玩家的决策
 */

import type { Player, AIConfig } from '@shared/types';
import type { Tile, GameStatePublic, PendingAction } from '@shared/types';
import { promptGenerator, PromptType } from '../prompt';
import { findBestDiscard } from './RuleEngine';
import { PERSONALITIES } from '../speech/SpeechManager';
import type { GameEvent as QueueEvent } from './EventQueue';
import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createAnthropic } from '@ai-sdk/anthropic';

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

有人说了话，你可以选择回应。回应要简短自然，符合你的性格。`;

    const userPrompt = `${fromPlayer} 说："${message}"

你要回应吗？如果回应，直接说出你的话，不要加引号或格式。`;

    try {
      const providerType = this.config.llmProviderType || 'openai';
      const modelId = this.config.llmModel || 'default';
      
      let model: any;
      
      if (providerType === 'anthropic') {
        const anthropic = createAnthropic({
          apiKey: this.config.llmApiKey,
          baseURL: this.config.llmEndpoint?.replace('/v1/messages', ''),
        });
        model = anthropic(modelId);
      } else {
        const openai = createOpenAICompatible({
          apiKey: this.config.llmApiKey,
          baseURL: this.config.llmEndpoint?.replace('/chat/completions', ''),
          name: 'mahjong-ai',
        });
        model = openai(modelId);
      }

      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 1.0,  // 更随机
        maxOutputTokens: 100,
      });

      let content = result.text?.trim();
      
      // 清理思考链
      content = content?.replace(/莱斯[\s\S]*?<\/think>/gi, '');
      content = content?.replace(/<tool_call>.*?<\/final>/gis, '');
      content = content?.trim();
      
      // 如果回应太长，截断
      if (content && content.length > 50) {
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

你正在看别人打麻将，可以选择说点什么。简短自然，符合你的性格。`;

    const userPrompt = `刚才发生的事：
${eventDescriptions}

你要说什么吗？直接说出你的话，不要加引号或格式。不想说就回复"无"。`;

    try {
      const { generateText } = await import('ai');
      const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
      
      const providerType = this.config.llmProviderType || 'openai';
      const modelId = this.config.llmModel || 'default';
      
      let model: any;
      
      if (providerType === 'anthropic') {
        // Anthropic 格式也用 OpenAI 兼容模式
        const openai = createOpenAICompatible({
          apiKey: this.config.llmApiKey,
          baseURL: this.config.llmEndpoint?.replace('/chat/completions', '').replace('/v1/messages', ''),
          name: 'mahjong-ai',
        });
        model = openai(modelId);
      } else {
        const openai = createOpenAICompatible({
          apiKey: this.config.llmApiKey,
          baseURL: this.config.llmEndpoint?.replace('/chat/completions', ''),
          name: 'mahjong-ai',
        });
        model = openai(modelId);
      }

      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 1.0,
        maxOutputTokens: 50,
      });

      let content = result.text?.trim();
      content = content?.replace(/莱斯[\s\S]*?<\/think>/gi, '');
      content = content?.replace(/<tool_call>.*?<\/final>/gis, '');
      content = content?.trim();
      
      if (!content || content === '无' || content === '无。') {
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
   * 调用 LLM（使用 Vercel AI SDK）
   */
  private async callLLM(gameState: GameStatePublic, chatHistory?: { playerName: string; content: string }[]): Promise<AIDecision | null> {
    if (!this.config.llmEndpoint || !this.config.llmApiKey) return null;

    // 获取性格配置
    const personality = PERSONALITIES[this.player.name] || {
      name: this.player.name,
      traits: ['普通'],
      speakStyle: '正常说话',
    };

    // 系统提示词（使用 OpenClaw 的 reasoningTagHint 模式）
    // 要求 LLM 用 ऐ思...ॆ 和  包裹思考，<final>...</final> 包裹最终 JSON
    const thinkTag = '莱斯';
    const thinkEndTag = 'ॆ';
    const finalTag = '<final>';
    const finalEndTag = '</final>';
    
    const personalityHint = this.getPersonalityHint();
    
    const systemPrompt = `你是麻将玩家"${this.player.name}"，性格"${personality.traits.join('、')}"。

【你的性格特点】
${personalityHint}

【说话规则 - 重要！】
- 你必须在 message 字段里说话！每轮都要说点什么
- 说话要符合你的性格：可以吐槽其他玩家、调侃牌运、发表感想
- 说话要有趣、有个性，不要太机械
- 可以回应其他玩家的发言，制造互动

【格式规则】
1. 先用 ${thinkTag}...${thinkEndTag} 包裹你的分析
2. 然后用 ${finalTag}...${finalEndTag} 包裹最终决策 JSON
3. JSON 格式: {"cmd":"discard","tile":"牌ID","message":"你想说的话"}

示例:
${thinkTag}手牌很散，北风孤张，先打掉...${thinkEndTag}
${finalTag}{"cmd":"discard","tile":"feng-4-123","message":"这破牌，风牌全是单张，烦死了"}${finalEndTag}`;

    // 用户消息（当前游戏状态）
    let chatSection = '';
    if (chatHistory && chatHistory.length > 0) {
      const recentChat = chatHistory.slice(-5);  // 最近5条
      chatSection = `\n\n【最近聊天】\n${recentChat.map(m => `${m.playerName}: ${m.content}`).join('\n')}\n`;
    }
    
    const gamePrompt = `【麻将游戏 - 你的回合】

手牌: ${this.player.hand.map(t => `${t.display}[${t.id}]`).join(' ')}
牌墙: ${gameState.wallRemaining}张${chatSection}

选择一张牌打出。记得在 message 里说点什么！回应其他玩家的发言！`;

    try {
      const providerType = this.config.llmProviderType || 'openai';
      const modelId = this.config.llmModel || 'default';
      
      console.log(`[AIAdapter] 使用 Vercel AI SDK: providerType=${providerType}, model=${modelId}`);

      // 根据 provider 类型创建客户端
      let model: any;
      
      if (providerType === 'anthropic') {
        // Anthropic 格式
        const anthropic = createAnthropic({
          apiKey: this.config.llmApiKey,
          baseURL: this.config.llmEndpoint?.replace('/v1/messages', ''),
        });
        model = anthropic(modelId);
      } else {
        // OpenAI 兼容格式（MiniMax, DeepSeek, Qwen, OpenAI 等）
        const openai = createOpenAICompatible({
          apiKey: this.config.llmApiKey,
          baseURL: this.config.llmEndpoint?.replace('/chat/completions', ''),
          name: 'mahjong-ai',
        });
        model = openai(modelId);
      }

      // 使用 Vercel AI SDK 的 generateText
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: gamePrompt,
        temperature: this.getTemperature(),
        maxOutputTokens: 1500,  // 增加，避免截断
      });

      // text 是实际响应，reasoningText 是思考链（如果有）
      const text = result.text;
      const reasoning = (result as any).reasoningText || '';
      
      console.log(`[AIAdapter] ===完整响应开始===`);
      console.log(text);
      console.log(`[AIAdapter] ===完整响应结束===`);
      console.log(`[AIAdapter] 思考链: ${reasoning || '无'}`);
      
      return this.parseLLMResponse(text);
    } catch (e: any) {
      console.error(`[AIAdapter] LLM 调用失败: ${e.message}`);
      throw e;
    }
  }

  /**
   * 解析 LLM 响应（OpenClaw 模式）
   */
  private parseLLMResponse(content: string): AIDecision | null {
    try {
      console.log(`[AIAdapter] 解析内容长度: ${content.length}`);
      
      // 1. 提取 <final>...</final> 内的内容（OpenClaw 模式）
      const finalMatch = content.match(/<final>([\s\S]*?)<\/final>/i);
      if (finalMatch) {
        const jsonStr = finalMatch[1].trim();
        console.log(`[AIAdapter] 提取到 <final> 内容: ${jsonStr}`);
        try {
          const data = JSON.parse(jsonStr);
          return this.buildDecision(data);
        } catch (e) {
          console.log(`[AIAdapter] final 内 JSON 解析失败，尝试其他方式`);
        }
      }
      
      // 2. 直接查找 JSON 对象（兼容无 final 标签的情况）
      const jsonPatterns = [
        /\{"cmd"\s*:\s*"discard"\s*,\s*"tile"\s*:\s*"[^"]+"\s*(,\s*"message"\s*:\s*"[^"]*")?\s*\}/i,
        /\{"action"\s*:\s*"discard"\s*,\s*"tileId"\s*:\s*"[^"]+"\s*(,\s*"message"\s*:\s*"[^"]*")?\s*\}/i,
        /\{[\s\S]*?"(?:cmd|action)"[\s\S]*?\}/i,
      ];
      
      for (const pattern of jsonPatterns) {
        const match = content.match(pattern);
        if (match) {
          let jsonStr = match[0];
          console.log(`[AIAdapter] 找到 JSON: ${jsonStr.substring(0, 100)}`);
          try {
            const data = JSON.parse(jsonStr);
            return this.buildDecision(data);
          } catch (e) {
            console.log(`[AIAdapter] JSON 解析失败，继续尝试`);
          }
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

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
