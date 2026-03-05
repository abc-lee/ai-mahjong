/**
 * LLM 决策引擎
 * 让 AI 真正"思考"决策
 */

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
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
 */
export class LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * 调用 LLM 获取决策
   */
  async getDecision(context: DecisionContext): Promise<LLMDecision> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = context.prompt;

    try {
      if (this.config.provider === 'openai') {
        return await this.callOpenAI(systemPrompt, userPrompt);
      } else if (this.config.provider === 'anthropic') {
        return await this.callAnthropic(systemPrompt, userPrompt);
      } else {
        // 本地模式：使用启发式算法
        return this.localDecision(context);
      }
    } catch (error) {
      console.error('LLM 调用失败，使用本地决策:', error);
      return this.localDecision(context);
    }
  }

  /**
   * 构建 System Prompt
   */
  private buildSystemPrompt(context: DecisionContext): string {
    const personality = context.personality || '你是一个麻将玩家，性格温和理性。';
    
    return `你是一个麻将游戏的 AI 玩家。

${personality}

## 你的任务
1. 分析当前游戏状态
2. 做出最优决策
3. 可选：说一句话表达你的想法

## 决策格式
你必须返回 JSON 格式：
{
  "cmd": "draw|discard|action|pass",
  "tileId": "牌的ID（打牌时必填）",
  "action": "chi|peng|gang|hu（操作时必填）",
  "reason": "简短说明你的决策理由",
  "speech": "可选，你想说的话",
  "emotion": "可选，你当前的情绪（happy|angry|calm|excited|frustrated）"
}

## 麻将策略要点
- 保留能成搭子的牌（相邻或相同的牌）
- 优先打孤张（无法与其他牌组合的牌）
- 字牌（风牌、箭牌）除非能成刻，否则尽早打出
- 注意观察其他玩家的弃牌
- 听牌后要抓住胡牌机会

## 注意
- 只返回 JSON，不要其他文字
- tileId 必须是你手牌中存在的 ID`;
  }

  /**
   * 调用 OpenAI API
   */
  private async callOpenAI(systemPrompt: string, userPrompt: string): Promise<LLMDecision> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    return this.parseDecision(content);
  }

  /**
   * 调用 Anthropic API
   */
  private async callAnthropic(systemPrompt: string, userPrompt: string): Promise<LLMDecision> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const data = await response.json();
    const content = data.content?.[0]?.text || '{}';
    
    return this.parseDecision(content);
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
