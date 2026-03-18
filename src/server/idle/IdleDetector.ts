/**
 * 闲置检测层 - 完全独立于会话层
 * 
 * 架构设计：
 * ┌─────────────────────────────────────┐
 * │         闲置检测层（本文件）          │
 * │  - 监测活动（打牌、聊天等）          │
 * │  - 15秒无活动 → 批量处理事件队列     │
 * │  - 一次性给AI所有累积事件            │
 * │  - fire-and-forget，不阻塞           │
 * └─────────────────────────────────────┘
 *                 │
 *                 │ 批量触发（不等待）
 *                 ▼
 * ┌─────────────────────────────────────┐
 * │         会话层（handlers.ts）        │
 * │  - ConversationManager              │
 * │  - 处理发言，调用LLM                │
 * │  - 广播消息                         │
 * └─────────────────────────────────────┘
 */

import type { Server } from 'socket.io';
import { RoomManager } from '../room/RoomManager';
import { aiManager } from '../ai/AIManager';
import { eventQueueManager, GameEvent } from '../ai/EventQueue';

// 闲置时间配置
const IDLE_TIMEOUT_MS = 15000; // 15秒

// 房间定时器映射
const idleTimers = new Map<string, NodeJS.Timeout>();

// 最后活动时间（用于防止重复触发）
const lastActivityTime = new Map<string, number>();

// AI发言冷却时间（防止连续刷屏）
const AI_SPEECH_COOLDOWN = 8000; // 8秒
const lastSpeechTime = new Map<string, number>();

/**
 * 闲置检测器
 * 
 * 职责：
 * 1. 监测房间内的任何活动
 * 2. 15秒无活动时，批量处理所有AI的事件队列
 * 3. 每个AI看到完整的上下文，一次性回复
 */
export const IdleDetector = {
  /**
   * 重置闲置定时器
   * 任何活动（打牌、聊天、碰杠胡）都应调用此方法
   */
  resetTimer(roomId: string, io: Server, roomManager: RoomManager): void {
    const now = Date.now();
    const timestamp = new Date().toISOString().substring(11, 23);
    
    // 记录活动时间
    lastActivityTime.set(roomId, now);
    
    // 清除现有定时器
    const existingTimer = idleTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      idleTimers.delete(roomId);
    }
    
    
    // 设置新定时器
    const timer = setTimeout(() => {
      const triggerTime = new Date().toISOString().substring(11, 23);
      
      // 检查是否真的闲置了15秒（防止重复触发）
      const lastActivity = lastActivityTime.get(roomId) || 0;
      const elapsed = Date.now() - lastActivity;
      
      
      if (elapsed >= IDLE_TIMEOUT_MS - 1000) { // 允许1秒误差
        processAllAIQueues(roomId, io, roomManager);
      }
      
      idleTimers.delete(roomId);
    }, IDLE_TIMEOUT_MS);
    
    idleTimers.set(roomId, timer);
  },
  
  /**
   * 清除闲置定时器
   * 游戏结束或房间销毁时调用
   */
  clearTimer(roomId: string): void {
    const timer = idleTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      idleTimers.delete(roomId);
    }
    lastActivityTime.delete(roomId);
  },
  
  /**
   * 检查房间是否有活跃的闲置检测
   */
  isActive(roomId: string): boolean {
    return idleTimers.has(roomId);
  }
};

/**
 * 触发闲置聊天
 * 
 * 关键设计：
 * - 只在真正闲置15秒后触发
 * - 只生成"私房话"，不处理事件队列
 * - 事件队列由会话层处理
 */
function processAllAIQueues(roomId: string, io: Server, roomManager: RoomManager): void {
  const room = roomManager.getRoom(roomId);
  if (!room || room.state !== 'playing') {
    return;
  }
  
  // 只获取有LLM配置的AI玩家（排除NPC）
  const aiPlayers = room.players.filter(p => 
    p.type === 'ai-agent' && p.aiConfig?.llmEnabled
  );
  if (aiPlayers.length === 0) {
    return;
  }
  
  
  // 检查冷却时间，筛选可发言的AI
  const eligibleAIs = aiPlayers.filter(p => {
    const lastTime = lastSpeechTime.get(p.id) || 0;
    const elapsed = Date.now() - lastTime;
    return elapsed >= AI_SPEECH_COOLDOWN;
  });
  
  if (eligibleAIs.length === 0) {
    return;
  }
  
  // 随机选择一个AI
  const selectedAI = eligibleAIs[Math.floor(Math.random() * eligibleAIs.length)];
  const adapter = aiManager.getAdapter(selectedAI.id);
  
  if (!adapter) {
    return;
  }
  
  // 清空该AI的事件队列（避免重复处理）
  eventQueueManager.clearQueue(selectedAI.id);
  
  // 生成私房话
  const otherAIs = aiPlayers.map(p => ({ name: p.name }));
  const recentChats = (room.chatHistory || []).slice(-5).map(msg => ({
    playerName: msg.playerName,
    content: msg.content,
  }));
  
  
  adapter.generateIdleChat(otherAIs, recentChats)
    .then(result => {
      if (result && result.message) {
        lastSpeechTime.set(selectedAI.id, Date.now());
        broadcastAISpeech(roomId, io, roomManager, selectedAI.id, selectedAI.name, result.message);
        
        // 私房话生成后，重新设置15秒定时器（如果玩家继续挂机）
        IdleDetector.resetTimer(roomId, io, roomManager);
      } else {
        // 没有生成私房话，也重新设置定时器
        IdleDetector.resetTimer(roomId, io, roomManager);
      }
    })
    .catch(e => {
      // 失败也重新设置定时器
      IdleDetector.resetTimer(roomId, io, roomManager);
    });
}

/**
 * 广播AI发言
 * 纯广播功能，不涉及定时器
 */
function broadcastAISpeech(
  roomId: string,
  io: Server,
  roomManager: RoomManager,
  playerId: string,
  playerName: string,
  content: string
): void {
  // 广播发言给所有玩家
  io.in(roomId).emit('player:speech', {
    playerId,
    playerName,
    content,
    timestamp: Date.now(),
  });
  
  // 保存到聊天历史
  const room = roomManager.getRoom(roomId);
  if (!room) return;
  
  room.chatHistory.push({
    playerId,
    playerName,
    content,
    timestamp: Date.now(),
  });
  
  // 限制历史长度
  if (room.chatHistory.length > 20) {
    room.chatHistory.shift();
  }
  
  // 推送给其他AI的事件队列
  const speakEvent: GameEvent = {
    type: 'player_speak',
    timestamp: Date.now(),
    data: {
      playerId,
      playerName,
      content,
    }
  };
  
  for (const p of room.players) {
    if ((p.type === 'ai-agent' || p.type === 'npc') && p.id !== playerId) {
      eventQueueManager.pushTo(p.id, speakEvent);
    }
  }
  
  // 触发会话层，让其他AI能回应
  const { getConversationManager } = require('../speech/ConversationManager');
  const conversationManager = getConversationManager(io, roomId);
  conversationManager.setRoomManager(roomManager);
  
  // 获取其他AI玩家
  const otherAIPlayers = room.players.filter(p =>
    (p.type === 'ai-agent') && p.id !== playerId
  );
  
  if (otherAIPlayers.length > 0) {
    // 获取LLM配置
    const aiWithConfig = otherAIPlayers.find(p => p.aiConfig?.llmEnabled);
    const llmConfig = aiWithConfig ? {
      apiKey: aiWithConfig.aiConfig?.llmApiKey,
      endpoint: aiWithConfig.aiConfig?.llmEndpoint,
      model: aiWithConfig.aiConfig?.llmModel,
      providerType: aiWithConfig.aiConfig?.llmProviderType,
    } : undefined;
    
    const message = {
      playerId,
      playerName,
      content,
      timestamp: Date.now(),
    };
    
    conversationManager.handleSpeech(roomId, message, otherAIPlayers, llmConfig).catch(e => {
    });
  }
}

export default IdleDetector;
