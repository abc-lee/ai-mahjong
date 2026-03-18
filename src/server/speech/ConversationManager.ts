/**
 * 会话管理器
 * 专门处理 AI 的即时发言/回应，与决策层分离
 * 
 * 架构：
 * ┌─────────────────────────────────────┐
 * │         会话层（即时响应）            │
 * │  指令来了 → 分类 → 说话的直接广播      │
 * └──────────────┬──────────────────────┘
 *                ↓ 该决策的
 * ┌─────────────────────────────────────┐
 * │         决策层（轮次处理）            │
 * │  打牌、碰杠胡 → 队列 → 轮到你时处理    │
 * └─────────────────────────────────────┘
 */

import type { Player } from '@shared/types';
import type { Server } from 'socket.io';
import { PERSONALITY_BY_TYPE, Personality } from './SpeechManager';
import { chatWithSystem } from '../llm/LLMService';
import { IdleDetector } from '../idle/IdleDetector';
import { RoomManager } from '../room/RoomManager';
import { promptLoader } from '../prompt/PromptLoader';

// 根据 personality 类型获取性格配置
function getPersonalityByType(type: string, playerName: string): Personality {
  const personalityType = type || 'balanced';
  const config = PERSONALITY_BY_TYPE[personalityType] || PERSONALITY_BY_TYPE['balanced'];

  return {
    ...config,
    name: playerName,
  };
}

// 会话消息
interface ConversationMessage {
  playerId: string;
  playerName: string;
  content: string;
  timestamp: number;
}

// AI 回应配置
interface ResponseConfig {
  responseProbability: number;   // 回应概率
  minDelay: number;              // 最小延迟（毫秒）
  maxDelay: number;              // 最大延迟（毫秒）
  maxLength: number;             // 最大回应长度
  batchWindow: number;           // 批量累积窗口（毫秒）
}

// 默认配置
const DEFAULT_CONFIG: ResponseConfig = {
  responseProbability: 0.5,
  minDelay: 300,    // 最小延迟0.3秒
  maxDelay: 1000,   // 最大延迟1秒
  maxLength: 200,
  batchWindow: 800, // 批量累积窗口0.8秒
};

/**
 * 会话管理器类
 * 处理 AI 即时发言，不阻塞游戏
 * 
 * 关键机制：批量累积
 * - 短时间内多条消息累积起来
 * - 一起给AI处理，避免刷屏
 */
export class ConversationManager {
  private io: Server;
  private roomManager: RoomManager | null = null;
  private config: ResponseConfig;
  
  // 每个 AI 的最近发言时间（防刷屏）
  private lastResponseTime: Map<string, number> = new Map();
  
  // 每个 AI 的发言冷却时间（毫秒）
  private readonly COOLDOWN = 3000; // 3秒冷却，让对话更流畅
  
  // 批量累积：房间 -> 消息缓冲区
  private messageBuffer: Map<string, ConversationMessage[]> = new Map();
  
  // 批量累积：房间 -> 处理定时器
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: Server, config: Partial<ResponseConfig> = {}) {
    this.io = io;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 设置 RoomManager（用于重置闲置计时器）
   */
  setRoomManager(roomManager: RoomManager): void {
    this.roomManager = roomManager;
  }

  /**
   * 处理发言事件
   * 当有人说话时，AI即时回应
   */
  async handleSpeech(
    roomId: string,
    message: ConversationMessage,
    aiPlayers: Player[],
    llmConfig?: { apiKey?: string; endpoint?: string; model?: string; providerType?: string }
  ): Promise<void> {
    const timestamp = new Date().toISOString().substring(11, 23);
    
    // 检查是否有AI被点名
    const mentionedAI = aiPlayers.find(p => message.content.includes(p.name));
    
    // 被@的AI强制回应，忽略冷却时间
    if (mentionedAI) {
      
      // 检查AI自己的LLM配置
      const aiConfig = (mentionedAI as any).aiConfig;
      
      this.generateAndBroadcastResponse(roomId, mentionedAI, [message], aiPlayers, llmConfig).catch(e => {
        console.error(`[${timestamp}] [Conversation] ${mentionedAI.name} 回应失败:`, e.message);
      });
      return;
    }
    
    // 没被@，筛选可回应的AI（冷却时间检查）
    const eligibleAIs = aiPlayers.filter(p => {
      const lastTime = this.lastResponseTime.get(p.id) || 0;
      const elapsed = Date.now() - lastTime;
      if (elapsed < this.COOLDOWN) {
        return false;
      }
      return true;
    });
    
    
    if (eligibleAIs.length === 0) {
      return;
    }
    
    // 随机选择一个AI
    const selectedAI = eligibleAIs[Math.floor(Math.random() * eligibleAIs.length)];
    
    // 异步生成回应
    this.generateAndBroadcastResponse(roomId, selectedAI, [message], aiPlayers, llmConfig).catch(e => {
      console.error(`[Conversation] ${selectedAI.name} 回应失败:`, e.message);
    });
    
  }
  
  /**
   * 批量处理累积的消息
   * 一次性给AI所有消息，让它看到完整上下文
   */
  private async processBatch(
    roomId: string,
    aiPlayers: Player[],
    llmConfig?: { apiKey?: string; endpoint?: string; model?: string; providerType?: string }
  ): Promise<void> {
    const messages = this.messageBuffer.get(roomId) || [];
    this.messageBuffer.delete(roomId);
    
    if (messages.length === 0) {
      return;
    }
    
    messages.forEach((m, i) => {
    });
    
    // 检查冷却时间，筛选可回应的AI
    const eligibleAIs = aiPlayers.filter(p => {
      const lastTime = this.lastResponseTime.get(p.id) || 0;
      const elapsed = Date.now() - lastTime;
      if (elapsed < this.COOLDOWN) {
        return false;
      }
      return true;
    });
    
    if (eligibleAIs.length === 0) {
      return;
    }
    
    // 检查是否有AI被点名（优先让被点名的AI回应）
    const mentionedAI = eligibleAIs.find(p => 
      messages.some(m => m.content.includes(p.name))
    );
    
    let selectedAI: Player | undefined;
    
    if (mentionedAI) {
      // 被点名的AI必须回应
      selectedAI = mentionedAI;
    } else {
      // 没被点名，随机选择一个AI回应
      selectedAI = eligibleAIs[Math.floor(Math.random() * eligibleAIs.length)];
    }
    
    // 生成回应
    this.generateAndBroadcastResponse(roomId, selectedAI, messages, aiPlayers, llmConfig).catch(e => {
      console.error(`[Conversation] ${selectedAI!.name} 回应失败:`, e.message);
    });
    
  }

  /**
   * 生成并广播回应
   */
  private async generateAndBroadcastResponse(
    roomId: string,
    aiPlayer: Player,
    messages: ConversationMessage[],
    allPlayers: Player[],
    llmConfig?: { apiKey?: string; endpoint?: string; model?: string; providerType?: string }
  ): Promise<void> {
    
    try {
      const response = await this.generateResponse(aiPlayer, messages, allPlayers, llmConfig);
      
      
      if (response) {
        // 记录发言时间
        this.lastResponseTime.set(aiPlayer.id, Date.now());
        
        // 添加延迟（模拟思考）
        const delay = this.randomDelay();
        await this.sleep(delay);
        
        // 广播回应
        this.io.in(roomId).emit('player:speech', {
          playerId: aiPlayer.id,
          playerName: aiPlayer.name,
          content: response,
          timestamp: Date.now(),
        });
        
        // 重置闲置计时器（AI发言也是活动）
        if (this.roomManager) {
          IdleDetector.resetTimer(roomId, this.io, this.roomManager);
        }
        
      }
    } catch (e: any) {
      console.error(`[Conversation] >>> ${aiPlayer.name} 回应失败:`, e.message);
    }
  }

  /**
   * 生成回应 - 传入批量消息
   */
  private async generateResponse(
    aiPlayer: Player,
    messages: ConversationMessage[],
    allPlayers: Player[],
    llmConfig?: { apiKey?: string; endpoint?: string; model?: string; providerType?: string }
  ): Promise<string | null> {
    // 优先使用AI自己的配置，其次使用全局配置
    const aiConfig = (aiPlayer as any).aiConfig;
    const actualConfig = {
      apiKey: aiConfig?.llmApiKey || llmConfig?.apiKey,
      endpoint: aiConfig?.llmEndpoint || llmConfig?.endpoint,
      model: aiConfig?.llmModel || llmConfig?.model,
      providerType: aiConfig?.llmProviderType || llmConfig?.providerType,
    };
    
    // 没有 LLM 配置，使用 fallback
    if (!actualConfig.apiKey || !actualConfig.endpoint) {
      return this.fallbackResponse(aiPlayer, messages[messages.length - 1]);
    }
    
    // 根据 AI 配置的 personality 类型获取性格
    const personalityType = aiConfig?.personality || 'balanced';
    const personality = getPersonalityByType(personalityType, aiPlayer.name);

    // 构建牌桌信息
    const playerList = allPlayers.map(p => {
      const role = p.type === 'human' ? '人类玩家' : 
                   p.type === 'ai-agent' ? 'AI玩家' : 'NPC';
      const pos = ['东', '南', '西', '北'][p.position];
      return `- ${p.name}(${pos}位, ${role})`;
    }).join('\n');

    // 构建消息上下文（批量消息）
    const messageContext = messages.map(m => `${m.playerName}: "${m.content}"`).join('\n');
    const lastMessage = messages[messages.length - 1];
    
    const systemPrompt = promptLoader.getWithVars('conversation.response.system', {
      playerName: aiPlayer.name,
      traits: personality.traits.join('、'),
      speakStyle: personality.speakStyle,
      playerList
    });

    const userPrompt = promptLoader.getWithVars('conversation.response.user', {
      messageContext
    });


    try {
      const endpoint = actualConfig.endpoint?.replace('/chat/completions', '').replace('/v1/messages', '');
      const result = await chatWithSystem(
        {
          provider: actualConfig.providerType || 'openai',
          apiKey: actualConfig.apiKey!,
          baseURL: endpoint || 'https://api.openai.com/v1',
          model: actualConfig.model || 'gpt-4o',
        },
        systemPrompt,
        userPrompt,
        { temperature: 1.0, maxTokens: 800 }  // 思考链+回复共需要
      );
      
      let content = result.text;
      
      if (!content || content.trim().length < 2) {
        return null;
      }
      
      content = content.replace(/[「」""'']/g, '').trim();
      
      if (content === '无' || content === '无。' || content.length < 2) {
        return null;
      }

      return content;
    } catch (e: any) {
      return this.fallbackResponse(aiPlayer, lastMessage);
    }
  }

  /**
   * Fallback 回应（无 LLM 时）
   */
  private fallbackResponse(aiPlayer: Player, message: ConversationMessage): string | null {
    // 优先使用 AI 自己配置的 personality 类型
    const aiConfig = (aiPlayer as any).aiConfig;
    const personalityType = aiConfig?.personality || 'balanced';
    
    // 根据 personality 类型选择 fallback 模板
    return promptLoader.getRandomFallback(personalityType, message.playerName);
  }

  private randomDelay(): number {
    return Math.random() * (this.config.maxDelay - this.config.minDelay) + this.config.minDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 全局实例缓存
const conversationManagers = new Map<string, ConversationManager>();

export function getConversationManager(io: Server, roomId: string): ConversationManager {
  if (!conversationManagers.has(roomId)) {
    conversationManagers.set(roomId, new ConversationManager(io));
  }
  return conversationManagers.get(roomId)!;
}
