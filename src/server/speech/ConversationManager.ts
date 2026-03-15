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
import { PERSONALITIES, Personality } from './SpeechManager';
import { chatWithSystem, clearProviderCache } from '../llm/LLMService';

// 根据 personality 类型获取性格配置
function getPersonalityByType(type: string, playerName: string): Personality {
  // 先尝试从预设名字查找
  if (PERSONALITIES[playerName]) {
    return PERSONALITIES[playerName];
  }
  
  // 根据 personality 类型返回配置
  const typeConfigs: Record<string, Personality> = {
    chatty: {
      name: playerName,
      traits: ['话痨', '话多', '喜欢分析'],
      speakStyle: '每轮都要说话，喜欢分析牌局、吐槽别人、讲笑话。说话要多、要啰嗦。',
      angerThreshold: 50,
      chatFrequency: 0.8,  // 高发言频率
    },
    sarcastic: {
      name: playerName,
      traits: ['毒舌', '冷淡', '讽刺'],
      speakStyle: '说话带刺，喜欢吐槽，实力强',
      angerThreshold: 30,
      chatFrequency: 0.4,
    },
    tsundere: {
      name: playerName,
      traits: ['傲娇', '不服输', '心口不一'],
      speakStyle: '嘴上不说，内心善良',
      angerThreshold: 40,
      chatFrequency: 0.3,
    },
    lucky: {
      name: playerName,
      traits: ['幸运星', '运气好', '乐天派'],
      speakStyle: '总是很开心，运气特别好',
      angerThreshold: 70,
      chatFrequency: 0.4,
    },
    serious: {
      name: playerName,
      traits: ['认真', '计算型', '话少'],
      speakStyle: '专注于牌局，很少说话',
      angerThreshold: 60,
      chatFrequency: 0.1,
    },
    dramatic: {
      name: playerName,
      traits: ['戏精', '戏多', '夸张'],
      speakStyle: '每件事都要夸张表达，喜欢演戏',
      angerThreshold: 40,
      chatFrequency: 0.6,
    },
    balanced: {
      name: playerName,
      traits: ['普通'],
      speakStyle: '正常说话',
      angerThreshold: 50,
      chatFrequency: 0.3,
    },
  };
  
  return typeConfigs[type] || typeConfigs['balanced'];
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
}

// 默认配置
const DEFAULT_CONFIG: ResponseConfig = {
  responseProbability: 0.5,     // 50% 概率回应（被点名时必回应）
  minDelay: 500,                // 0.5秒
  maxDelay: 2000,               // 2秒
  maxLength: 200,               // 200字符（允许多行发言）
};

/**
 * 会话管理器类
 * 处理 AI 即时发言，不阻塞游戏
 */
export class ConversationManager {
  private io: Server;
  private config: ResponseConfig;
  
  // 每个 AI 的最近发言时间（防刷屏）
  private lastResponseTime: Map<string, number> = new Map();
  
  // 每个 AI 的发言冷却时间（毫秒）- LLM响应慢，不需要冷却
  private readonly COOLDOWN = 0;

  constructor(io: Server, config: Partial<ResponseConfig> = {}) {
    this.io = io;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
 * 处理发言事件
   * 当有人说话时，通知所有 AI，可能触发即时回应
   */
  async handleSpeech(
    roomId: string,
    message: ConversationMessage,
    aiPlayers: Player[],
    llmConfig?: { apiKey?: string; endpoint?: string; model?: string; providerType?: string }
  ): Promise<void> {
    console.log(`[Conversation] ========== 开始处理发言 ==========`);
    console.log(`[Conversation] 房间: ${roomId}`);
    console.log(`[Conversation] 发言者: ${message.playerName}(${message.playerId})`);
    console.log(`[Conversation] 内容: "${message.content}"`);
    console.log(`[Conversation] AI玩家数量: ${aiPlayers.length}`);
    console.log(`[Conversation] AI玩家: ${aiPlayers.map(p => p.name).join(', ')}`);
    console.log(`[Conversation] LLM配置: apiKey=${llmConfig?.apiKey ? '有' : '无'}, endpoint=${llmConfig?.endpoint}, model=${llmConfig?.model}`);
    
    // 并行通知所有 AI（不阻塞）
    for (const aiPlayer of aiPlayers) {
      // 不回应自己
      if (aiPlayer.id === message.playerId) {
        console.log(`[Conversation] ${aiPlayer.name}: 跳过（自己）`);
        continue;
      }
      
      // 检查玩家是否启用了 LLM
      if (!aiPlayer.aiConfig?.llmEnabled) {
        console.log(`[Conversation] ${aiPlayer.name}: 跳过（llmEnabled=false）`);
        continue;
      }
      
      // 检查冷却时间
      const now = Date.now();
      const lastTime = this.lastResponseTime.get(aiPlayer.id) || 0;
      const timeSinceLast = now - lastTime;
      if (timeSinceLast < this.COOLDOWN) {
        console.log(`[Conversation] ${aiPlayer.name}: 冷却中 (${timeSinceLast}ms < ${this.COOLDOWN}ms)`);
        continue;
      }
      
      // 被点名时必回应，否则也尝试回应（LLM响应慢，不会刷屏）
      const isMentioned = message.content.includes(aiPlayer.name);
      if (isMentioned) {
        console.log(`[Conversation] ${aiPlayer.name}: 被点名，准备回应`);
      } else {
        console.log(`[Conversation] ${aiPlayer.name}: 准备回应`);
      }
      
      console.log(`[Conversation] ${aiPlayer.name}: 准备生成回应...`);
      
      // 异步生成回应（不阻塞）
      this.generateAndBroadcastResponse(roomId, aiPlayer, message, aiPlayers, llmConfig).catch(e => {
        console.error(`[Conversation] ${aiPlayer.name} 回应失败:`, e.message);
      });
    }
    
    console.log(`[Conversation] ========== 处理完成 ==========`);
  }

  /**
   * 生成并广播回应
   */
  private async generateAndBroadcastResponse(
    roomId: string,
    aiPlayer: Player,
    message: ConversationMessage,
    allPlayers: Player[],
    llmConfig?: { apiKey?: string; endpoint?: string; model?: string; providerType?: string }
  ): Promise<void> {
    console.log(`[Conversation] >>> ${aiPlayer.name} 开始生成回应`);
    
    try {
      const response = await this.generateResponse(aiPlayer, message, allPlayers, llmConfig);
      
      console.log(`[Conversation] >>> ${aiPlayer.name} 生成结果: "${response || '无回应'}"`);
      
      if (response) {
        // 记录发言时间
        this.lastResponseTime.set(aiPlayer.id, Date.now());
        
        // 添加延迟（模拟思考）
        const delay = this.randomDelay();
        console.log(`[Conversation] >>> ${aiPlayer.name} 延迟 ${delay}ms 后广播`);
        await this.sleep(delay);
        
        // 广播回应
        this.io.in(roomId).emit('player:speech', {
          playerId: aiPlayer.id,
          playerName: aiPlayer.name,
          content: response,
          timestamp: Date.now(),
        });
        
        console.log(`[Conversation] >>> ${aiPlayer.name} 已广播回应: "${response}"`);
      } else {
        console.log(`[Conversation] >>> ${aiPlayer.name} 无回应内容，不广播`);
      }
    } catch (e: any) {
      console.error(`[Conversation] >>> ${aiPlayer.name} 回应失败:`, e.message);
    }
  }

  /**
   * 生成回应 - 使用 SDK 统一处理
   */
  private async generateResponse(
    aiPlayer: Player,
    message: ConversationMessage,
    allPlayers: Player[],
    llmConfig?: { apiKey?: string; endpoint?: string; model?: string; providerType?: string }
  ): Promise<string | null> {
    // 没有 LLM 配置，使用 fallback
    if (!llmConfig?.apiKey || !llmConfig?.endpoint) {
      return this.fallbackResponse(aiPlayer, message);
    }
    
    // 根据 AI 配置的 personality 类型获取性格
    const personalityType = (aiPlayer as any).aiConfig?.personality || 'balanced';
    const personality = getPersonalityByType(personalityType, aiPlayer.name);

    // 构建牌桌信息
    const playerList = allPlayers.map(p => {
      const role = p.type === 'human' ? '人类玩家' : 
                   p.type === 'ai-agent' ? 'AI玩家' : 'NPC';
      const pos = ['东', '南', '西', '北'][p.position];
      return `- ${p.name}(${pos}位, ${role})`;
    }).join('\n');

    const systemPrompt = `你是麻将玩家"${aiPlayer.name}"。
性格：${personality.traits.join('、')}
说话风格：${personality.speakStyle}

牌桌玩家：
${playerList}

规则：简短回应，直接说话。不想说就回"无"。`;

    const userPrompt = `${message.playerName}说："${message.content}"
你回应：`;

    console.log(`[Conversation] >>> ${aiPlayer.name} 提示词:`);
    console.log(`[Conversation] >>> System: ${systemPrompt.substring(0, 100)}...`);
    console.log(`[Conversation] >>> User: ${userPrompt}`);

    try {
      // 使用 SDK 调用，自动处理思考链
      const endpoint = llmConfig.endpoint?.replace('/chat/completions', '').replace('/v1/messages', '');
      const result = await chatWithSystem(
        {
          provider: llmConfig.providerType || 'openai',
          apiKey: llmConfig.apiKey!,
          baseURL: endpoint || 'https://api.openai.com/v1',
          model: llmConfig.model || 'gpt-4o',
        },
        systemPrompt,
        userPrompt,
        { temperature: 1.0, maxTokens: 2000 }
      );
      
      let content = result.text;
      
      console.log(`[Conversation] >>> ${aiPlayer.name} SDK 响应: "${content?.substring(0, 100)}"`);
      
      if (!content || content.trim().length < 2) {
        console.log(`[Conversation] >>> ${aiPlayer.name} content 为空，跳过`);
        return null;
      }
      
      // 移除引号，保留换行（允许多行发言）
      content = content.replace(/[「」""'']/g, '').trim();
      
      // 过滤无意义回应
      if (content === '无' || content === '无。' || content.length < 2) {
        return null;
      }
      
      console.log(`[Conversation] >>> ${aiPlayer.name} 最终: "${content.substring(0, 100)}"`);
      
      // 截断过长回应
      if (content.length > this.config.maxLength) {
        content = content.substring(0, this.config.maxLength);
      }
      
      return content;
    } catch (e: any) {
      console.log(`[Conversation] LLM 回应失败，使用 fallback:`, e.message);
      return this.fallbackResponse(aiPlayer, message);
    }
  }

  /**
   * Fallback 回应（无 LLM 时）
   */
  private fallbackResponse(aiPlayer: Player, message: ConversationMessage): string | null {
    const personality = PERSONALITIES[aiPlayer.name];
    
    // 根据性格选择回应模板
    if (personality?.traits.includes('话痨')) {
      const templates = [
        `哈哈，${message.playerName}说得对`,
        `${message.playerName}，我也这么觉得`,
        `是呀是呀`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }
    
    if (personality?.traits.includes('暴躁')) {
      const templates = [
        `少废话，打牌`,
        `${message.playerName}你话真多`,
        `快点打牌行不行`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }
    
    // 默认不回应
    return null;
  }

  /**
   * 随机延迟
   */
  private randomDelay(): number {
    return Math.random() * (this.config.maxDelay - this.config.minDelay) + this.config.minDelay;
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 全局实例缓存
const conversationManagers = new Map<string, ConversationManager>();

/**
 * 获取或创建会话管理器
 */
export function getConversationManager(io: Server, roomId: string): ConversationManager {
  if (!conversationManagers.has(roomId)) {
    conversationManagers.set(roomId, new ConversationManager(io));
  }
  return conversationManagers.get(roomId)!;
}
