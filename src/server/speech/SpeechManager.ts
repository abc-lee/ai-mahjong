/**
 * 发言系统管理器
 * 管理 AI 发言、情绪值、嘴炮对话
 */

import { Server } from 'socket.io';
import { getRandomStimulus, generateStimulusFromEvent, StimulusType, StimulusConfig } from './Stimuli';
import { memoryManager, MemoryEvent, MemoryEventType } from './MemoryManager';
import { promptLoader } from '../prompt/PromptLoader';

// 情绪状态
export interface EmotionState {
  happiness: number;   // 快乐 -100 ~ 100
  anger: number;       // 愤怒 0 ~ 100
  patience: number;    // 耐心 0 ~ 100
  confidence: number;  // 自信 0 ~ 100
}

// 发言消息
export interface SpeechMessage {
  playerId: string;
  playerName: string;
  content: string;
  emotion?: string;
  targetPlayer?: string;
  timestamp: number;
}

// AI 个性配置
export interface Personality {
  name: string;
  traits: string[];        // 性格特征
  speakStyle: string;      // 说话风格
  angerThreshold: number;  // 生气阈值（越低越容易生气）
  chatFrequency: number;   // 主动发言频率 (0-1)
  // 新增：发言模板
  templates?: {
    happy?: string[];      // 高兴时的话术
    angry?: string[];      // 生气时的话术
    thinking?: string[];   // 思考时的话术
    winning?: string[];    // 赢牌时的话术
    losing?: string[];     // 输牌时的话术
    greeting?: string[];   // 打招呼
    goodbye?: string[];    // 告别
  };
}

// 预设个性（从 JSON 加载）
export const PERSONALITIES: Record<string, Personality> = Object.fromEntries(
  promptLoader.getCharacterNames().map(name => {
    const config = promptLoader.getCharacter(name)!;
    return [name, {
      name: config.name,
      traits: config.traits,
      speakStyle: config.speakStyle,
      angerThreshold: config.angerThreshold || 50,
      chatFrequency: config.chatFrequency,
      templates: config.templates,
    }];
  })
);

// 按 personality 类型索引的配置（从 JSON 加载）
export const PERSONALITY_BY_TYPE: Record<string, Personality> = Object.fromEntries(
  promptLoader.getPersonalityTypes().map(type => {
    const config = promptLoader.getPersonality(type)!;
    return [type, {
      name: config.name,
      traits: config.traits,
      speakStyle: config.speakStyle,
      angerThreshold: config.angerThreshold || 50,
      chatFrequency: config.chatFrequency,
      templates: config.templates,
    }];
  })
);

// 等待超时配置
const WAITING_TIMEOUTS = {
  first: 5000,    // 5秒后第一次提醒
  second: 10000,  // 10秒后第二次提醒
  stimulus: 15000, // 15秒后情绪刺激
};

/**
 * 发言系统管理器
 */
export class SpeechManager {
  private io: Server;
  private roomId: string;
  private playerEmotions: Map<string, EmotionState> = new Map();
  private waitingTimers: Map<string, NodeJS.Timeout[]> = new Map();
  private speechHistory: SpeechMessage[] = [];
  private lang: 'zh' | 'en' = 'zh';

  constructor(io: Server, roomId: string) {
    this.io = io;
    this.roomId = roomId;
  }

  /**
   * 初始化玩家情绪
   * 如果已有情绪数据，则恢复部分情绪（跨局累积）
   */
  initPlayerEmotion(playerId: string, playerName?: string, isNewGame: boolean = false): void {
    console.log(`[initPlayerEmotion] playerId=${playerId?.slice(0,8)}, playerName=${playerName}, isNewGame=${isNewGame}`);
    
    // 检查是否已有情绪数据
    const existingEmotion = this.playerEmotions.get(playerId);
    
    if (existingEmotion) {
      // 已有情绪，进行衰减后保留
      this.restoreEmotionState(playerId, existingEmotion);
      console.log(`[Emotion] ${playerName || playerId} 恢复跨局情绪`);
    } else {
      // 新玩家，初始化默认情绪
      this.playerEmotions.set(playerId, {
        happiness: 0,
        anger: 0,
        patience: 100,
        confidence: 50,
      });
      console.log(`[Emotion] ${playerName || playerId} 初始化默认情绪`);
    }
    
    // 初始化或恢复记忆
    if (playerName) {
      const existingMemory = memoryManager.getMemory(playerId);
      if (!existingMemory) {
        memoryManager.initMemory(playerId, playerName);
      } else if (isNewGame) {
        // 新一局开始，清理旧事件
        console.log(`[Memory] ${playerName} 开始新一局，清理旧事件`);
        memoryManager.startNewGame(playerId);
      }
      
      // 记录游戏开始事件
      if (isNewGame) {
        console.log(`[Memory] ${playerName} 记录 game_start 事件`);
        memoryManager.recordEvent(playerId, { type: 'game_start' });
      }
    }
  }

  /**
   * 获取玩家情绪
   */
  getEmotion(playerId: string): EmotionState {
    return this.playerEmotions.get(playerId) || {
      happiness: 0,
      anger: 0,
      patience: 100,
      confidence: 50,
    };
  }

  /**
   * 更新玩家情绪
   */
  updateEmotion(playerId: string, changes: Partial<EmotionState>): EmotionState {
    const current = this.getEmotion(playerId);
    const updated: EmotionState = {
      happiness: Math.max(-100, Math.min(100, (current.happiness + (changes.happiness || 0)))),
      anger: Math.max(0, Math.min(100, (current.anger + (changes.anger || 0)))),
      patience: Math.max(0, Math.min(100, (current.patience + (changes.patience || 0)))),
      confidence: Math.max(0, Math.min(100, (current.confidence + (changes.confidence || 0)))),
    };
    this.playerEmotions.set(playerId, updated);
    
    // 广播情绪变化
    const displayEmotion = this.getEmotionForDisplay(playerId);
    this.io.to(this.roomId).emit('player:emotion', {
      playerId,
      emotion: displayEmotion,
    });
    
    return updated;
  }

  /**
   * 开始等待计时
   */
  startWaitingTimer(playerId: string, playerName: string): void {
    // 清除之前的计时器
    this.clearWaitingTimers(playerId);

    const timers: NodeJS.Timeout[] = [];

    // 第一次提醒
    timers.push(setTimeout(() => {
      this.broadcastWaiting(playerId, playerName, 1);
    }, WAITING_TIMEOUTS.first));

    // 第二次提醒
    timers.push(setTimeout(() => {
      this.broadcastWaiting(playerId, playerName, 2);
    }, WAITING_TIMEOUTS.second));

    // 情绪刺激
    timers.push(setTimeout(() => {
      this.triggerStimulus(playerId, playerName, 'slow');
    }, WAITING_TIMEOUTS.stimulus));

    this.waitingTimers.set(playerId, timers);
  }

  /**
   * 停止等待计时
   */
  stopWaitingTimer(playerId: string): void {
    this.clearWaitingTimers(playerId);
  }

  /**
   * 清除等待计时器
   */
  private clearWaitingTimers(playerId: string): void {
    const timers = this.waitingTimers.get(playerId);
    if (timers) {
      timers.forEach(t => clearTimeout(t));
      this.waitingTimers.delete(playerId);
    }
  }

  /**
   * 广播等待状态
   */
  private broadcastWaiting(playerId: string, playerName: string, level: number): void {
    const messages = {
      zh: {
        1: `⏳ ${playerName} 正在思考...`,
        2: `⏰ ${playerName} 还没出牌，大家等等~`,
      },
      en: {
        1: `⏳ ${playerName} is thinking...`,
        2: `⏰ ${playerName} hasn't played yet, wait a moment~`,
      },
    };

    this.io.to(this.roomId).emit('game:waiting', {
      playerId,
      playerName,
      level,
      message: messages[this.lang][level as 1 | 2],
    });
  }

  /**
   * 触发情绪刺激
   */
  triggerStimulus(targetPlayerId: string, targetPlayerName: string, type: StimulusType): void {
    const stimulus = getRandomStimulus(type, this.lang);
    
    // 向所有其他 AI 发送刺激
    this.io.to(this.roomId).emit('game:stimulus', {
      targetPlayer: targetPlayerName,
      stimulus: stimulus.message,
      type: stimulus.type,
      intensity: stimulus.intensity,
    });

    console.log(`[Speech] 情绪刺激: ${stimulus.message} (强度: ${stimulus.intensity})`);
  }

  /**
   * 处理游戏事件
   */
  handleGameEvent(event: {
    type: 'draw' | 'discard' | 'pong' | 'gang' | 'hu' | 'turn_start' | 'turn_end' | 'score_change';
    playerId: string;
    playerName: string;
    tile?: any;
    targetPlayerId?: string;
    targetPlayerName?: string;
    scoreChange?: number;
  }): void {
    switch (event.type) {
      case 'turn_start':
        this.startWaitingTimer(event.playerId, event.playerName);
        break;
      case 'turn_end':
        this.stopWaitingTimer(event.playerId);
        break;
      case 'draw':
        // 摸牌不改变情绪
        break;
      case 'pong':
      case 'gang':
        // 被碰/杠的人增加愤怒
        if (event.targetPlayerId) {
          this.updateEmotion(event.targetPlayerId, { 
            anger: 10, 
            patience: -10 
          });
          // 记录事件到被碰的人的记忆
          memoryManager.recordEvent(event.targetPlayerId, {
            type: 'someone_pong',
            playerId: event.playerId,
            playerName: event.playerName,
            details: { targetMe: true },
          });
          // 有概率触发冲突刺激
          if (Math.random() < 0.3) {
            this.triggerStimulus(event.playerId, event.playerName, 'conflict');
          }
        }
        // 碰/杠的人增加自信
        this.updateEmotion(event.playerId, { confidence: 5 });
        // 记录事件到碰的人的记忆
        memoryManager.recordEvent(event.playerId, {
          type: event.type as MemoryEventType,
          playerId: event.targetPlayerId,
          playerName: event.targetPlayerName,
        });
        break;
      case 'hu':
        // 胡牌者快乐增加
        this.updateEmotion(event.playerId, { 
          happiness: 30, 
          confidence: 20,
          anger: -10, // 减少愤怒
        });
        // 记录胡牌事件
        memoryManager.recordEvent(event.playerId, {
          type: 'i_won',
          content: `胡牌了！`,
        });
        // 其他人愤怒/沮丧
        this.broadcastStimulus(event.playerName, 'surprise');
        break;
      case 'score_change':
        // 分数变化影响情绪
        if (event.scoreChange && event.scoreChange !== 0) {
          if (event.scoreChange > 0) {
            // 赢分
            this.updateEmotion(event.playerId, {
              happiness: Math.min(20, event.scoreChange / 5),
              confidence: Math.min(10, event.scoreChange / 10),
            });
          } else {
            // 输分
            this.updateEmotion(event.playerId, {
              happiness: Math.max(-20, event.scoreChange / 5),
              anger: Math.min(15, Math.abs(event.scoreChange) / 10),
            });
          }
        }
        break;
    }
  }

  /**
   * 批量更新分数变化（游戏结束时）
   */
  handleScoreChanges(
    changes: Array<{ playerId: string; playerName: string; scoreChange: number }>
  ): void {
    changes.forEach(change => {
      this.handleGameEvent({
        type: 'score_change',
        playerId: change.playerId,
        playerName: change.playerName,
        scoreChange: change.scoreChange,
      });
      
      // 记录游戏结束到记忆
      const won = change.scoreChange > 0;
      memoryManager.recordGameEnd(change.playerId, won, change.scoreChange);
    });

    // 找出赢家和输家，触发刺激
    const winner = changes.find(c => c.scoreChange > 0);
    const losers = changes.filter(c => c.scoreChange < 0);

    if (winner) {
      // 输家可能会抱怨
      losers.forEach(loser => {
        const emotion = this.getEmotion(loser.playerId);
        if (emotion.anger > 30 && Math.random() < 0.5) {
          const complaints = [
            `${winner.playerName} 运气真好啊...`,
            `这都能胡，我不服！`,
            `下次我一定赢回来！`,
            `哼，这局算你运气好。`,
          ];
          this.io.to(this.roomId).emit('player:speech', {
            playerId: loser.playerId,
            playerName: loser.playerName,
            content: complaints[Math.floor(Math.random() * complaints.length)],
            emotion: 'frustrated',
            timestamp: Date.now(),
          });
        }
      });
    }
  }

  /**
   * 广播情绪刺激给所有人
   */
  private broadcastStimulus(targetName: string, type: StimulusType): void {
    const stimulus = getRandomStimulus(type, this.lang);
    this.io.to(this.roomId).emit('game:stimulus', {
      targetPlayer: targetName,
      stimulus: stimulus.message,
      type: stimulus.type,
      intensity: stimulus.intensity,
    });
  }

  /**
   * 处理 AI 发言
   */
  handleSpeech(message: SpeechMessage): void {
    // 记录发言历史
    this.speechHistory.push(message);

    // 记录到记忆系统
    memoryManager.recordSpeech(
      message.playerId,
      message.content,
      message.targetPlayer ? undefined : undefined,
      message.targetPlayer
    );

    // 广播给房间内所有人
    this.io.to(this.roomId).emit('player:speech', message);

    console.log(`[Speech] ${message.playerName}: ${message.content}`);

    // 检查是否触发嘴炮
    this.checkTriggerArgue(message);
  }

  /**
   * 检查是否触发嘴炮（AI 之间对话）
   */
  private checkTriggerArgue(message: SpeechMessage): void {
    // 如果发言针对了某个玩家
    if (message.targetPlayer) {
      // 被针对的玩家有 30% 概率回嘴
      const emotion = this.getEmotion(message.playerId);
      const angerBonus = emotion.anger > 50 ? 0.2 : 0;
      
      this.io.to(this.roomId).emit('argue:trigger', {
        fromPlayer: message.playerName,
        toPlayer: message.targetPlayer,
        content: message.content,
        emotion: message.emotion,
        replyProbability: 0.3 + angerBonus,
      });
    }
  }

  /**
   * 获取发言历史
   */
  getSpeechHistory(limit: number = 20): SpeechMessage[] {
    return this.speechHistory.slice(-limit);
  }

  /**
   * 根据情绪和记忆生成发言提示
   */
  generateEmotionPrompt(playerId: string, personalityName: string): string {
    const emotion = this.getEmotion(playerId);
    const personality = PERSONALITIES[personalityName] || PERSONALITIES['测试员'];
    
    let prompt = `你的性格：${personality.traits.join('、')}\n`;
    prompt += `说话风格：${personality.speakStyle}\n\n`;
    
    prompt += `当前情绪状态：\n`;
    
    if (emotion.anger > 70) {
      prompt += `- 你现在很生气 (愤怒值: ${emotion.anger})\n`;
    } else if (emotion.anger > 40) {
      prompt += `- 你有点不爽 (愤怒值: ${emotion.anger})\n`;
    }
    
    if (emotion.happiness > 30) {
      prompt += `- 你心情不错 (快乐值: ${emotion.happiness})\n`;
    } else if (emotion.happiness < -30) {
      prompt += `- 你有点沮丧 (快乐值: ${emotion.happiness})\n`;
    }
    
    if (emotion.patience < 30) {
      prompt += `- 你耐心快用完了 (耐心值: ${emotion.patience})\n`;
    }
    
    // 添加记忆信息
    const memorySummary = memoryManager.generateMemorySummary(playerId);
    if (memorySummary) {
      prompt += `\n${memorySummary}\n`;
    }
    
    return prompt;
  }

  /**
   * 获取个性发言模板
   */
  getPersonalityTemplate(playerName: string, category: 'happy' | 'angry' | 'thinking' | 'winning' | 'losing' | 'greeting' | 'goodbye'): string | null {
    const personality = PERSONALITIES[playerName] || PERSONALITIES['测试员'];
    const templates = personality.templates?.[category];
    if (templates && templates.length > 0) {
      return templates[Math.floor(Math.random() * templates.length)];
    }
    return null;
  }

  /**
    * 触发 AI 主动发言
    * 根据个性和情绪决定是否发言
    */
  triggerProactiveSpeech(
    playerId: string,
    playerName: string,
    situation: 'turn_start' | 'good_tile' | 'bad_tile' | 'someone_hu' | 'someone_pong' | 'someone_gang' | 'game_start' | 'game_end' | 'drew_tile' | 'waiting' | 'almost_hu',
    personalityType?: string  // AI 的 personality 类型 (chatty, sarcastic, etc.)
  ): void {
    // 优先使用 personalityType 查找配置，否则按名字查找，最后使用默认值
    let personality: Personality;
    
    if (personalityType && PERSONALITY_BY_TYPE[personalityType]) {
      personality = { ...PERSONALITY_BY_TYPE[personalityType], name: playerName };
    } else if (PERSONALITIES[playerName]) {
      personality = PERSONALITIES[playerName];
    } else {
      personality = PERSONALITIES['测试员'];
    }
    
    const emotion = this.getEmotion(playerId);
    
    console.log(`[Speech] triggerProactiveSpeech: ${playerName}, situation=${situation}, personalityType=${personalityType || 'none'}, chatFrequency=${personality.chatFrequency}`);
    
    // 根据个性决定是否发言
    if (Math.random() > personality.chatFrequency) {
      console.log(`[Speech] ${playerName} 不发言 (概率检查1)`);
      return; // 不发言
    }

    // 根据情绪调整发言概率
    let speechProbability = personality.chatFrequency;
    if (emotion.anger > 50) speechProbability += 0.1;
    if (emotion.happiness > 30) speechProbability += 0.1;
    
    if (Math.random() > speechProbability) {
      console.log(`[Speech] ${playerName} 不发言 (概率检查2)`);
      return;
    }

    // 根据场景选择发言类型
    let template: string | null = null;
    let content: string | null = null;

    switch (situation) {
      case 'turn_start':
        template = this.getPersonalityTemplate(playerName, 'thinking');
        break;
      case 'good_tile':
      case 'drew_tile':
        template = this.getPersonalityTemplate(playerName, 'happy');
        break;
      case 'bad_tile':
        template = this.getPersonalityTemplate(playerName, 'angry');
        break;
      case 'someone_hu':
        template = emotion.happiness < 0 
          ? this.getPersonalityTemplate(playerName, 'losing')
          : this.getPersonalityTemplate(playerName, 'winning');
        break;
      case 'someone_pong':
      case 'someone_gang':
        template = this.getPersonalityTemplate(playerName, 'angry');
        break;
      case 'game_start':
        template = this.getPersonalityTemplate(playerName, 'greeting');
        break;
      case 'game_end':
        template = emotion.happiness > 0
          ? this.getPersonalityTemplate(playerName, 'winning')
          : this.getPersonalityTemplate(playerName, 'losing');
        break;
      case 'waiting':
        template = this.getPersonalityTemplate(playerName, 'thinking');
        break;
      case 'almost_hu':
        template = this.getPersonalityTemplate(playerName, 'happy');
        break;
    }

    if (template) {
      content = template;
      console.log(`[Speech] ${playerName} 选择模板: ${template}`);
    } else {
      console.log(`[Speech] ${playerName} 没有找到模板`);
    }

    if (content) {
      // 延迟发送，模拟思考
      console.log(`[Speech] ${playerName} 将在 0.5-2秒后发言: ${content}`);
      setTimeout(() => {
        console.log(`[Speech] ${playerName} 发言中...`);
        this.handleSpeech({
          playerId,
          playerName,
          content,
          emotion: emotion.anger > 50 ? 'angry' : emotion.happiness > 30 ? 'happy' : 'calm',
          timestamp: Date.now(),
        });
      }, 500 + Math.random() * 1500);
    }
  }

  /**
   * 随机主动发言（游戏进行中）
   */
  triggerRandomSpeech(players: Array<{ id: string; name: string; personality?: string }>): void {
    // 每次轮换后有概率触发随机发言
    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    if (!randomPlayer) return;

    // 优先使用 personalityType 查找配置
    let personality: Personality;
    if (randomPlayer.personality && PERSONALITY_BY_TYPE[randomPlayer.personality]) {
      personality = PERSONALITY_BY_TYPE[randomPlayer.personality];
    } else {
      personality = PERSONALITIES[randomPlayer.name] || PERSONALITIES['测试员'];
    }
    
    const emotion = this.getEmotion(randomPlayer.id);

    // 低概率触发
    if (Math.random() > personality.chatFrequency * 0.5) {
      return;
    }

    // 随机选择发言内容
    const categories: Array<'happy' | 'angry' | 'thinking'> = ['happy', 'angry', 'thinking'];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const template = this.getPersonalityTemplate(randomPlayer.name, category);

    if (template) {
      setTimeout(() => {
        this.handleSpeech({
          playerId: randomPlayer.id,
          playerName: randomPlayer.name,
          content: template,
          emotion: emotion.anger > 50 ? 'angry' : emotion.happiness > 30 ? 'happy' : 'calm',
          timestamp: Date.now(),
        });
      }, 1000 + Math.random() * 3000);
    }
  }

  /**
   * 获取情绪状态（用于前端显示）
   */
  getEmotionForDisplay(playerId: string): {
    mood: string;
    emoji: string;
    color: string;
    values: EmotionState;
  } {
    const emotion = this.getEmotion(playerId);
    
    // 根据情绪值判断心情
    let mood = 'calm';
    let emoji = '😐';
    let color = '#888888';
    
    if (emotion.anger > 70) {
      mood = 'angry';
      emoji = '😠';
      color = '#ff4444';
    } else if (emotion.anger > 40) {
      mood = 'annoyed';
      emoji = '😤';
      color = '#ff8844';
    } else if (emotion.happiness > 50) {
      mood = 'happy';
      emoji = '😊';
      color = '#44ff44';
    } else if (emotion.happiness > 20) {
      mood = 'pleased';
      emoji = '🙂';
      color = '#88ff88';
    } else if (emotion.happiness < -50) {
      mood = 'sad';
      emoji = '😢';
      color = '#4444ff';
    } else if (emotion.happiness < -20) {
      mood = 'frustrated';
      emoji = '😔';
      color = '#8888ff';
    } else if (emotion.patience < 30) {
      mood = 'impatient';
      emoji = '🙄';
      color = '#ffaa44';
    } else if (emotion.confidence > 70) {
      mood = 'confident';
      emoji = '😎';
      color = '#44aaff';
    }
    
    return { mood, emoji, color, values: emotion };
  }

  /**
   * 保存情绪状态（游戏结束时）
   * 返回可序列化的情绪数据
   */
  saveEmotionState(playerId: string): EmotionState | null {
    return this.playerEmotions.get(playerId) || null;
  }

  /**
   * 恢复情绪状态（新游戏开始时）
   * 如果有之前的情绪，会部分恢复而不是完全重置
   */
  restoreEmotionState(playerId: string, savedEmotion: EmotionState): void {
    // 情绪会随时间衰减，新游戏开始时恢复 50%
    const decayFactor = 0.5;
    
    const restoredEmotion: EmotionState = {
      happiness: Math.round(savedEmotion.happiness * decayFactor),
      anger: Math.round(savedEmotion.anger * decayFactor),
      patience: 100, // 耐心重置
      confidence: Math.round(savedEmotion.confidence * decayFactor) + 25, // 基础自信
    };
    
    this.playerEmotions.set(playerId, restoredEmotion);
    
    console.log(`[Emotion] ${playerId} 恢复情绪: happy=${restoredEmotion.happiness}, angry=${restoredEmotion.anger}`);
  }

  /**
   * 情绪自然衰减（每局结束后调用）
   * 让极端情绪逐渐回归中性
   */
  decayEmotions(): void {
    this.playerEmotions.forEach((emotion, playerId) => {
      // 情绪衰减 10%，趋向中性
      const decay = (value: number, neutral: number = 0) => {
        if (value > neutral) {
          return Math.max(neutral, value - 10);
        } else if (value < neutral) {
          return Math.min(neutral, value + 10);
        }
        return value;
      };
      
      const newEmotion: EmotionState = {
        happiness: decay(emotion.happiness),
        anger: decay(emotion.anger, 0),
        patience: Math.min(100, emotion.patience + 20), // 耐心恢复
        confidence: decay(emotion.confidence, 50),
      };
      
      this.playerEmotions.set(playerId, newEmotion);
    });
  }

  /**
   * 批量保存所有玩家的情绪状态
   */
  saveAllEmotions(): Map<string, EmotionState> {
    return new Map(this.playerEmotions);
  }

  /**
   * 批量恢复所有玩家的情绪状态
   */
  restoreAllEmotions(saved: Map<string, EmotionState>): void {
    saved.forEach((emotion, playerId) => {
      this.restoreEmotionState(playerId, emotion);
    });
  }

  /**
   * 清理（保留记忆，只清理当前房间的状态）
   */
  destroy(): void {
    // 不再清除情绪，保留跨局情绪
    // this.playerEmotions.clear();
    this.waitingTimers.forEach((timers) => {
      timers.forEach(t => clearTimeout(t));
    });
    this.waitingTimers.clear();
    this.speechHistory = [];
  }

  /**
   * 完全清理（房间销毁时）
   */
  destroyComplete(): void {
    this.playerEmotions.clear();
    this.waitingTimers.forEach((timers) => {
      timers.forEach(t => clearTimeout(t));
    });
    this.waitingTimers.clear();
    this.speechHistory = [];
  }
}

// 全局发言管理器实例（按房间）
const speechManagers = new Map<string, SpeechManager>();

export function getSpeechManager(io: Server, roomId: string): SpeechManager {
  if (!speechManagers.has(roomId)) {
    speechManagers.set(roomId, new SpeechManager(io, roomId));
  }
  return speechManagers.get(roomId)!;
}

export function removeSpeechManager(roomId: string): void {
  const manager = speechManagers.get(roomId);
  if (manager) {
    manager.destroy();
    speechManagers.delete(roomId);
  }
}
