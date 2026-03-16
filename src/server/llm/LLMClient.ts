/**
 * LLM 决策引擎
 * 让 AI 真正"思考"决策
 */

import { quickChat } from './LLMService';
import { promptLoader } from '../prompt/PromptLoader';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  // For convenience
  type?: 'openai' | 'anthropic';
  apiBase?: string;
}

export interface DecisionContext {
  playerName: string;
  phase: 'draw' | 'discard' | 'action';
  hand: any[];
  gameState?: any;
  prompt: string;
  personality?: string;
}

export interface LLMDecision {
  cmd: 'draw' | 'discard' | 'action' | 'pass';
  tileId?: string;
  action?: 'chi' | 'peng' | 'gang' | 'hu';
  tiles?: string[];
  reason?: string;  // AI 的决策理由
  speech?: string;  // AI 想说的话
  emotion?: string; // AI 当前情绪
}

/**
 * LLM 客户端
 * 使用统一的 LLMService (SDK)
 */
export class LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * 简单聊天接口（用于测试和名字生成）
   * 使用 SDK 统一处理
   */
  async chat(prompt: string): Promise<string> {
    const apiBase = this.config.apiBase || this.config.baseUrl || 'https://api.openai.com/v1';
    
    try {
      return await quickChat(
        {
          provider: this.config.type || this.config.provider || 'openai',
          apiKey: this.config.apiKey || '',
          baseURL: apiBase.replace('/chat/completions', ''),
          model: this.config.model || 'gpt-3.5-turbo',
        },
        prompt,
        { maxTokens: 100 }
      );
    } catch (e) {
      console.error('[LLMClient] Chat error:', e);
      throw e;
    }
  }

  /**
   * 调用 LLM 获取决策
   */
  async getDecision(context: DecisionContext): Promise<LLMDecision> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = context.prompt;
    const apiBase = this.config.apiBase || this.config.baseUrl || 'https://api.openai.com/v1';

    try {
      const result = await quickChat(
        {
          provider: this.config.type || this.config.provider || 'openai',
          apiKey: this.config.apiKey || '',
          baseURL: apiBase.replace('/chat/completions', ''),
          model: this.config.model || 'gpt-3.5-turbo',
        },
        `${systemPrompt}\n\n${userPrompt}`,
        { maxTokens: 500, temperature: 0.7 }
      );
      
      return this.parseDecision(result);
    } catch (error) {
      console.error('LLM 调用失败，使用本地决策:', error);
      return this.localDecision(context);
    }
  }

  /**
   * 构建 System Prompt
   */
  private buildSystemPrompt(context: DecisionContext): string {
    const personality = context.personality || promptLoader.get('llmClient.defaultPersonality');
    return promptLoader.getWithVars('llmClient.systemPrompt', { personality });
  }

  /**
   * 解析 LLM 返回的决策
   */
  private parseDecision(content: string): LLMDecision {
    try {
      // 提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { cmd: 'pass', reason: '无法解析 LLM 返回' };
    } catch {
      return { cmd: 'pass', reason: 'JSON 解析失败' };
    }
  }

  /**
   * 本地决策（启发式算法）
   */
  private localDecision(context: DecisionContext): LLMDecision {
    const { phase, hand } = context;

    if (phase === 'draw') {
      return { 
        cmd: 'draw', 
        reason: '轮到我摸牌了',
        speech: '让我看看能摸到什么~'
      };
    }

    if (phase === 'discard' && hand && hand.length > 0) {
      // 分析手牌
      const analysis = this.analyzeHand(hand);
      
      // 优先打孤张字牌
      const isolatedHonors = analysis.isolated.filter(t => 
        t && (t.suit === 'feng' || t.suit === 'jian')
      );
      
      if (isolatedHonors.length > 0) {
        const tile = isolatedHonors[0];
        return {
          cmd: 'discard',
          tileId: tile.id,
          reason: `打出孤张字牌 ${tile.display}`,
          speech: `这张${tile.display}留着没用，打掉吧。`
        };
      }

      // 打数量最少的花色
      const minSuit = Object.entries(analysis.suitCount)
        .filter(([suit]) => suit !== 'feng' && suit !== 'jian')
        .sort((a, b) => a[1] - b[1])[0];

      if (minSuit) {
        const tile = hand.find(t => t && t.suit === minSuit[0]);
        if (tile) {
          return {
            cmd: 'discard',
            tileId: tile.id,
            reason: `打出最少花色 ${tile.display}`,
            speech: `${minSuit[0]}牌太少了，清掉一些。`
          };
        }
      }

      // 默认打最后一张
      const tile = hand.find(t => t) || hand[hand.length - 1];
      return {
        cmd: 'discard',
        tileId: tile.id,
        reason: '默认决策',
        speech: '随便打一张吧。'
      };
    }

    return { cmd: 'pass', reason: '无法决策' };
  }

  /**
   * 分析手牌
   */
  private analyzeHand(hand: any[]) {
    const suitCount: { [key: string]: number } = {};
    const valueCount: { [key: string]: number } = {};
    const isolated: any[] = [];

    hand.forEach(t => {
      if (!t) return;
      suitCount[t.suit] = (suitCount[t.suit] || 0) + 1;
      const key = `${t.suit}-${t.value}`;
      valueCount[key] = (valueCount[key] || 0) + 1;
    });

    // 找孤张
    Object.entries(valueCount).forEach(([key, count]) => {
      if (count === 1) {
        const [suit, value] = key.split('-');
        const tiles = hand.filter(t => t && t.suit === suit && t.value === value);
        if (tiles.length > 0) {
          isolated.push(tiles[0]);
        }
      }
    });

    return { suitCount, valueCount, isolated };
  }
}

// 默认 LLM 客户端（本地模式）
export const defaultLLMClient = new LLMClient({ provider: 'local' });
