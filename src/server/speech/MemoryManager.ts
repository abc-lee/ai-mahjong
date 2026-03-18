/**
 * AI 记忆系统
 * 让 AI 记住游戏事件、对话历史、以及与其他玩家的关系
 */

// 记忆事件类型
export type MemoryEventType = 
  | 'game_start'      // 游戏开始
  | 'game_end'        // 游戏结束
  | 'someone_hu'      // 有人胡牌
  | 'someone_pong'    // 有人碰牌
  | 'someone_gang'    // 有人杠牌
  | 'i_won'           // 我赢了
  | 'i_lost'          // 我输了
  | 'i_dianpao'       // 我点炮了
  | 'someone_slow'    // 有人太慢
  | 'conflict'        // 冲突
  | 'compliment'      // 被夸奖
  | 'insult'          // 被侮辱
  | 'speech'          // 对话
  | 'good_draw'       // 摸到好牌
  | 'bad_draw';       // 摸到烂牌

// 游戏结束信息
export interface GameEndInfo {
  winnerId: string;
  winnerName: string;
  isSelfDraw: boolean;
  loserId: string | null;
  loserName: string | null;
  scoreChanges: Array<{ id: string; name: string; scoreChange: number }>;
}

// 记忆事件
export interface MemoryEvent {
  id: string;
  type: MemoryEventType;
  timestamp: number;
  round?: number;           // 第几局
  playerId?: string;        // 事件相关玩家
  playerName?: string;
  content?: string;         // 事件内容
  details?: any;            // 额外细节
}

// 玩家关系
export interface PlayerRelation {
  playerId: string;
  playerName: string;
  favorability: number;     // 好感度 -100 ~ 100
  grudgeLevel: number;      // 记仇等级 0 ~ 100
  interactions: number;     // 互动次数
  lastInteraction?: number; // 最后互动时间
  tags: string[];           // 标签（如：'常碰我', '运气好', '话唠'）
}

// 上一局游戏结果摘要
export interface LastGameResult {
  winnerName: string;
  winnerId: string;
  loserName: string | null;
  loserId: string | null;
  isSelfDraw: boolean;
  myScoreChange: number;
  allScores: string;
}

// AI 记忆存储
export interface AIMemory {
  // 基本信息
  playerId: string;
  playerName: string;
  
  // 游戏记忆
  events: MemoryEvent[];           // 最近事件
  gameCount: number;               // 总局数
  winCount: number;                // 赢的局数
  loseCount: number;               // 输的局数
  
  // 对话记忆
  speechHistory: MemoryEvent[];    // 对话历史
  
  // 玩家关系
  relations: Map<string, PlayerRelation>;
  
  // 个人状态
  currentMood: string;             // 当前心情
  lastAction?: MemoryEvent;        // 上一个动作
  lastGameResult?: LastGameResult; // 上一局结果摘要
}

/**
 * AI 记忆管理器
 */
export class MemoryManager {
  private memories: Map<string, AIMemory> = new Map();
  private maxEvents: number = 50;        // 最大事件数
  private maxSpeechHistory: number = 30; // 最大对话历史
  
  /**
   * 初始化 AI 记忆
   */
  initMemory(playerId: string, playerName: string): AIMemory {
    const memory: AIMemory = {
      playerId,
      playerName,
      events: [],
      gameCount: 0,
      winCount: 0,
      loseCount: 0,
      speechHistory: [],
      relations: new Map(),
      currentMood: 'normal',
    };
    
    this.memories.set(playerId, memory);
    return memory;
  }
  
  /**
   * 开始新一局（清理事件但保留统计数据）
   */
  startNewGame(playerId: string): void {
    const memory = this.getMemory(playerId);
    if (memory) {
      memory.events = [];
      memory.currentMood = 'excited';
      // 注意：不清除 lastGameResult，让 AI 知道上一局结果
    }
  }

  /**
   * 获取记忆
   */
  getMemory(playerId: string): AIMemory | undefined {
    return this.memories.get(playerId);
  }

  /**
   * 记录事件
   */
  recordEvent(playerId: string, event: Omit<MemoryEvent, 'id' | 'timestamp'>): MemoryEvent | null {
    const memory = this.getMemory(playerId);
    if (!memory) return null;

    const fullEvent: MemoryEvent = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    memory.events.push(fullEvent);
    memory.lastAction = fullEvent;

    // 限制事件数量
    if (memory.events.length > this.maxEvents) {
      memory.events = memory.events.slice(-this.maxEvents);
    }

    // 更新玩家关系
    if (event.playerId && event.playerId !== playerId) {
      this.updateRelation(playerId, event.playerId, event.playerName || 'Unknown', fullEvent);
    }

    // 更新心情
    this.updateMood(playerId, fullEvent);
    
    return fullEvent;
  }

  /**
   * 记录对话
   */
  recordSpeech(playerId: string, content: string, targetPlayerId?: string, targetPlayerName?: string): void {
    const memory = this.getMemory(playerId);
    if (!memory) return;

    const speechEvent: MemoryEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'speech',
      timestamp: Date.now(),
      content,
      playerId: targetPlayerId,
      playerName: targetPlayerName,
    };

    memory.speechHistory.push(speechEvent);

    // 限制对话历史
    if (memory.speechHistory.length > this.maxSpeechHistory) {
      memory.speechHistory = memory.speechHistory.slice(-this.maxSpeechHistory);
    }
  }

  /**
   * 更新玩家关系
   */
  updateRelation(
    myId: string, 
    otherId: string, 
    otherName: string, 
    event: MemoryEvent
  ): void {
    const memory = this.getMemory(myId);
    if (!memory) return;

    let relation = memory.relations.get(otherId);
    
    if (!relation) {
      relation = {
        playerId: otherId,
        playerName: otherName,
        favorability: 0,
        grudgeLevel: 0,
        interactions: 0,
        tags: [],
      };
      memory.relations.set(otherId, relation);
    }

    relation.interactions++;
    relation.lastInteraction = Date.now();

    // 根据事件类型更新关系
    switch (event.type) {
      case 'someone_pong':
      case 'someone_gang':
        if (event.details?.targetMe) {
          relation.grudgeLevel = Math.min(100, relation.grudgeLevel + 10);
          relation.favorability = Math.max(-100, relation.favorability - 5);
          this.addTag(relation, '常碰我');
        }
        break;
      case 'someone_hu':
        if (event.details?.iLost) {
          relation.grudgeLevel = Math.min(100, relation.grudgeLevel + 5);
          relation.favorability = Math.max(-100, relation.favorability - 3);
        }
        break;
      case 'conflict':
        relation.grudgeLevel = Math.min(100, relation.grudgeLevel + 15);
        relation.favorability = Math.max(-100, relation.favorability - 10);
        break;
      case 'compliment':
        relation.favorability = Math.min(100, relation.favorability + 10);
        this.addTag(relation, '对我友好');
        break;
      case 'insult':
        relation.grudgeLevel = Math.min(100, relation.grudgeLevel + 20);
        relation.favorability = Math.max(-100, relation.favorability - 15);
        this.addTag(relation, '讨厌的人');
        break;
    }
  }

  /**
   * 添加标签
   */
  private addTag(relation: PlayerRelation, tag: string): void {
    if (!relation.tags.includes(tag)) {
      relation.tags.push(tag);
      // 最多保留 5 个标签
      if (relation.tags.length > 5) {
        relation.tags = relation.tags.slice(-5);
      }
    }
  }

  /**
   * 更新心情
   */
  private updateMood(playerId: string, event: MemoryEvent): void {
    const memory = this.getMemory(playerId);
    if (!memory) return;

    const moodMap: Record<MemoryEventType, string> = {
      game_start: 'excited',
      game_end: memory.winCount > memory.loseCount ? 'happy' : 'frustrated',
      someone_hu: 'frustrated',
      someone_pong: 'annoyed',
      someone_gang: 'angry',
      i_won: 'happy',
      i_lost: 'sad',
      i_dianpao: 'embarrassed',
      someone_slow: 'impatient',
      conflict: 'angry',
      compliment: 'happy',
      insult: 'angry',
      speech: memory.currentMood,
      good_draw: 'happy',
      bad_draw: 'frustrated',
    };

    const newMood = moodMap[event.type];
    if (newMood) {
      memory.currentMood = newMood;
    }
  }

  /**
   * 记录游戏结束
   * @param playerId AI 玩家ID
   * @param gameEndInfo 游戏结束信息（谁胡、谁点炮、分数变化）
   */
  recordGameEnd(playerId: string, gameEndInfo: GameEndInfo): void {
    const memory = this.getMemory(playerId);
    if (!memory) {
      return;
    }

    const { winnerId, winnerName, isSelfDraw, loserId, loserName, scoreChanges } = gameEndInfo;
    
    // 找到这个玩家的分数变化
    const myScoreChange = scoreChanges.find(s => s.id === playerId)?.scoreChange || 0;
    const isWinner = playerId === winnerId;
    const isLoser = playerId === loserId;
    
    memory.gameCount++;
    
    if (isWinner) {
      memory.winCount++;
      this.recordEvent(playerId, { 
        type: 'i_won', 
        content: `${isSelfDraw ? '自摸' : '胡牌'}赢了${myScoreChange}分！`,
        details: { winnerName, isSelfDraw, scoreChanges }
      });
    } else if (isLoser) {
      memory.loseCount++;
      this.recordEvent(playerId, { 
        type: 'i_dianpao', 
        content: `点炮给${winnerName}，输了${Math.abs(myScoreChange)}分`,
        details: { winnerName, loserName: memory.playerName, scoreChanges }
      });
    } else {
      // 输了但不是点炮
      memory.loseCount++;
      this.recordEvent(playerId, { 
        type: 'i_lost', 
        content: `${winnerName}${isSelfDraw ? '自摸' : '胡牌'}，输了${Math.abs(myScoreChange)}分`,
        details: { winnerName, loserName, isSelfDraw, scoreChanges }
      });
    }
    
    // 记录上一局结果摘要（用于下一局提示词）
    memory.lastGameResult = {
      winnerName,
      winnerId,
      loserName,
      loserId,
      isSelfDraw,
      myScoreChange,
      allScores: scoreChanges.map(s => `${s.name}: ${s.scoreChange >= 0 ? '+' : ''}${s.scoreChange}`).join(', ')
    };
  }

  /**
   * 获取最近事件
   */
  getRecentEvents(playerId: string, count: number = 10): MemoryEvent[] {
    const memory = this.getMemory(playerId);
    if (!memory) return [];
    return memory.events.slice(-count);
  }

  /**
   * 获取对话历史
   */
  getSpeechHistory(playerId: string, count: number = 10): MemoryEvent[] {
    const memory = this.getMemory(playerId);
    if (!memory) return [];
    return memory.speechHistory.slice(-count);
  }

  /**
   * 获取玩家关系
   */
  getRelation(myId: string, otherId: string): PlayerRelation | undefined {
    const memory = this.getMemory(myId);
    if (!memory) return undefined;
    return memory.relations.get(otherId);
  }

  /**
   * 获取所有关系
   */
  getAllRelations(playerId: string): PlayerRelation[] {
    const memory = this.getMemory(playerId);
    if (!memory) return [];
    return Array.from(memory.relations.values());
  }

  /**
   * 生成记忆摘要（用于 Prompt）
   */
  generateMemorySummary(playerId: string): string {
    const memory = this.getMemory(playerId);
    if (!memory) return '';

    const lines: string[] = [];

    // 上一局结果（最重要，放在最前面）
    if (memory.lastGameResult) {
      const last = memory.lastGameResult;
      lines.push(`【上一局结果】`);
      if (last.isSelfDraw) {
        lines.push(`${last.winnerName} 自摸！分数: ${last.allScores}`);
      } else if (last.loserName) {
        lines.push(`${last.winnerName} 胡了${last.loserName}的牌！分数: ${last.allScores}`);
      } else {
        lines.push(`${last.winnerName} 胡牌！分数: ${last.allScores}`);
      }
      if (last.myScoreChange !== 0) {
        lines.push(`你${last.myScoreChange > 0 ? '赢了' : '输了'}${Math.abs(last.myScoreChange)}分`);
      }
      lines.push('');
    }

    // 游戏统计
    lines.push(`【游戏统计】`);
    lines.push(`总局数: ${memory.gameCount} | 赢: ${memory.winCount} | 输: ${memory.loseCount}`);
    lines.push(`当前心情: ${memory.currentMood}`);
    lines.push('');

    // 最近事件
    const recentEvents = memory.events.slice(-5);
    if (recentEvents.length > 0) {
      lines.push(`【最近发生的事】`);
      recentEvents.forEach(event => {
        const desc = this.eventToDescription(event);
        lines.push(`- ${desc}`);
      });
      lines.push('');
    }

    // 玩家关系
    const relations = Array.from(memory.relations.values())
      .filter(r => r.interactions > 0)
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 3);

    if (relations.length > 0) {
      lines.push(`【对其他玩家的印象】`);
      relations.forEach(r => {
        const feeling = r.favorability > 30 ? '喜欢' : r.favorability < -30 ? '讨厌' : '一般';
        const grudge = r.grudgeLevel > 50 ? ` (有点记仇)` : '';
        const tags = r.tags.length > 0 ? ` [${r.tags.join(', ')}]` : '';
        lines.push(`- ${r.playerName}: ${feeling}${grudge}${tags}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * 事件转描述
   */
  private eventToDescription(event: MemoryEvent): string {
    switch (event.type) {
      case 'someone_hu':
        return `${event.playerName} 胡牌了`;
      case 'someone_pong':
        return `${event.playerName} 碰了你的牌`;
      case 'someone_gang':
        return `${event.playerName} 杠了牌`;
      case 'i_won':
        return `我赢了！${event.content || ''}`;
      case 'i_lost':
        return `我输了...${event.content || ''}`;
      case 'i_dianpao':
        return `我点炮了！${event.content || ''}`;
      case 'conflict':
        return `和 ${event.playerName} 发生了冲突`;
      case 'compliment':
        return `${event.playerName} 夸了我`;
      case 'insult':
        return `${event.playerName} 说的话让我不爽`;
      case 'speech':
        return `我说: "${event.content}"`;
      case 'good_draw':
        return `摸到了好牌`;
      case 'bad_draw':
        return `摸到了烂牌`;
      default:
        return event.content || event.type;
    }
  }

  /**
   * 基于记忆生成发言建议
   */
  generateSpeechSuggestion(playerId: string, situation: string): string | null {
    const memory = this.getMemory(playerId);
    if (!memory) return null;

    // 根据心情和最近事件生成发言建议
    const recentEvents = memory.events.slice(-3);
    
    // 如果最近有人碰/杠我
    const recentPong = recentEvents.find(e => 
      e.type === 'someone_pong' && e.details?.targetMe
    );
    if (recentPong && Math.random() < 0.3) {
      return `${recentPong.playerName} 怎么老是碰我的牌...`;
    }

    // 如果最近有冲突
    const recentConflict = recentEvents.find(e => e.type === 'conflict');
    if (recentConflict && Math.random() < 0.4) {
      return `哼，${recentConflict.playerName} 刚才太过分了！`;
    }

    // 如果赢了
    if (memory.lastAction?.type === 'i_won') {
      return '耶，赢了！';
    }

    // 如果心情不好
    if (memory.currentMood === 'angry' || memory.currentMood === 'frustrated') {
      const targets = Array.from(memory.relations.values())
        .filter(r => r.grudgeLevel > 30);
      if (targets.length > 0 && Math.random() < 0.3) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        return `${target.playerName} 真让人火大！`;
      }
    }

    return null;
  }

  /**
   * 清除记忆
   */
  clearMemory(playerId: string): void {
    this.memories.delete(playerId);
  }

  /**
   * 清除所有记忆
   */
  clearAll(): void {
    this.memories.clear();
  }
}

// 全局记忆管理器
export const memoryManager = new MemoryManager();
