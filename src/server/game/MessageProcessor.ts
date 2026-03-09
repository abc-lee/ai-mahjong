/**
 * 消息处理器
 * 
 * 负责：
 * - 接收 ChatMessage 并分类处理
 * - 生成动作描述文本
 * - 路由到游戏引擎执行逻辑
 * - 广播给房间所有玩家
 * - 消息节制（防止刷屏）
 */

import { ChatMessage, ActionContent, ChatTextContent, SystemContent } from '../../shared/types/chat';

/**
 * 消息节制配置
 */
interface ThrottleConfig {
  minInterval: number;      // 最小发送间隔（毫秒）
  mergeWindow: number;     // 合并窗口（毫秒）
  maxPendingMessages: number; // 最大待发送消息数
}

/**
 * 消息节制器类
 */
class MessageThrottler {
  private lastSendTime: Map<string, number> = new Map(); // 玩家最后发送时间
  private pendingMessages: Map<string, ChatMessage[]> = new Map(); // 待发送消息
  private mergeTimers: Map<string, NodeJS.Timeout> = new Map(); // 合并定时器
  
  private config: ThrottleConfig = {
    minInterval: 500,       // 最小间隔 500ms
    mergeWindow: 2000,     // 合并窗口 2秒
    maxPendingMessages: 5  // 最多等待 5 条消息
  };
  
  /**
   * 检查是否可以发送消息
   */
  canSend(playerId: string): boolean {
    const now = Date.now();
    const lastTime = this.lastSendTime.get(playerId) || 0;
    return now - lastTime >= this.config.minInterval;
  }
  
  /**
   * 添加消息到待发送队列
   * 如果在合并窗口内，会合并多条消息
   */
  addMessage(roomId: string, msg: ChatMessage): ChatMessage | null {
    if (!this.pendingMessages.has(roomId)) {
      this.pendingMessages.set(roomId, []);
    }
    
    const pending = this.pendingMessages.get(roomId)!;
    pending.push(msg);
    
    // 如果超过最大待发送数，立即发送合并消息
    if (pending.length >= this.config.maxPendingMessages) {
      return this.flushMessages(roomId);
    }
    
    // 设置合并定时器
    if (!this.mergeTimers.has(roomId)) {
      const timer = setTimeout(() => {
        this.flushMessages(roomId);
      }, this.config.mergeWindow);
      this.mergeTimers.set(roomId, timer);
    }
    
    return null; // 消息还在等待合并
  }
  
  /**
   * 刷新待发送消息，返回合并后的消息
   */
  private flushMessages(roomId: string): ChatMessage | null {
    const pending = this.pendingMessages.get(roomId) || [];
    if (pending.length === 0) return null;
    
    // 清除定时器和队列
    const timer = this.mergeTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.mergeTimers.delete(roomId);
    }
    this.pendingMessages.delete(roomId);
    
    // 如果只有一条消息，直接返回
    if (pending.length === 1) {
      this.lastSendTime.set(pending[0].sender.id, Date.now());
      return pending[0];
    }
    
    // 合并多条消息
    const mergedText = pending.map(m => {
      if (m.type === 'action') {
        const content = m.content as ActionContent;
        return content.text;
      } else if (m.type === 'chat') {
        const content = m.content as ChatTextContent;
        return content.text;
      }
      return '';
    }).filter(Boolean).join('；');
    
    const mergedMessage: ChatMessage = {
      id: `merged-${Date.now()}`,
      type: 'chat',
      sender: { id: 'system', name: '系统', type: 'ai-agent' },
      content: { text: mergedText },
      timestamp: Date.now()
    };
    
    this.lastSendTime.set('system', Date.now());
    return mergedMessage;
  }
}

/**
 * 消息处理器类（单例模式）
 */
class MessageProcessorClass {
  private throttler: MessageThrottler = new MessageThrottler();
  /**
   * 处理消息
   * 根据消息类型分发到不同处理器
   */
  process(msg: ChatMessage): void {
    switch (msg.type) {
      case 'chat':
        this.handleChatMessage(msg);
        break;
      case 'action':
        this.handleActionMessage(msg);
        break;
      case 'system':
        this.handleSystemMessage(msg);
        break;
      default:
        console.warn(`Unknown message type: ${(msg as any).type}`);
    }
  }

  /**
   * 处理聊天消息
   */
  private handleChatMessage(msg: ChatMessage): void {
    const content = msg.content as ChatTextContent;
    console.log(`[Chat] ${msg.sender.name}: ${content.text}`);
    
    // 触发聊天事件广播
    this.broadcastToRoom(msg.sender.id, msg);
  }

  /**
   * 处理动作消息
   */
  private handleActionMessage(msg: ChatMessage): void {
    const content = msg.content as ActionContent;
    console.log(`[Action] ${msg.sender.name}: ${content.action} - ${content.text}`);
    
    // 触发动作执行
    this.executeGameAction(msg);
    
    // 广播动作消息
    this.broadcastToRoom(msg.sender.id, msg);
  }

  /**
   * 处理系统消息
   */
  private handleSystemMessage(msg: ChatMessage): void {
    const content = msg.content as SystemContent;
    console.log(`[System] ${content.level || 'info'}: ${content.notification}`);
    
    // 系统消息也需要广播
    this.broadcastToRoom('system', msg);
  }

  /**
   * 生成动作描述
   * 根据动作类型生成自然语言描述
   */
  generateActionDescription(msg: ChatMessage): string {
    if (msg.type !== 'action') {
      return '';
    }

    const content = msg.content as ActionContent;
    const player = msg.sender.name;

    switch (content.action) {
      case 'discard':
        return `${player} 打出了 ${content.tile || '一张牌'}`;
      
      case 'draw':
        return `${player} 摸了一张牌`;
      
      case 'chi':
        return `${player} 吃了 ${content.targetTile || '上家的牌'}`;
      
      case 'peng':
        return `${player} 碰了 ${content.targetTile || '那张牌'}`;
      
      case 'gang':
        return `${player} 杠了 ${content.targetTile || '那张牌'}`;
      
      case 'hu':
        return `${player} 胡牌了！`;
      
      case 'pass':
        return `${player} 跳过`;
      
      default:
        return `${player} 执行了动作：${content.action}`;
    }
  }

  /**
   * 广播到房间
   * 将消息发送给房间内所有玩家
   */
  broadcastToRoom(roomId: string, msg: ChatMessage): void {
    // TODO: 实现房间广播逻辑
    // 这里需要通过 socket.io 发送消息给房间内所有连接
    console.log(`[Broadcast] Room ${roomId}: Message ${msg.id} from ${msg.sender.name}`);
    
    // 实际实现应该类似：
    // io.to(roomId).emit('room:chat', msg);
  }

  /**
   * 执行游戏动作
   * 将动作消息转换为游戏指令并执行
   */
  private executeGameAction(msg: ChatMessage): void {
    const content = msg.content as ActionContent;
    
    // TODO: 这里需要调用游戏引擎执行实际动作
    // 示例：
    // if (content.action === 'discard' && content.tileIds?.[0]) {
    //   gameEngine.discard(msg.sender.id, content.tileIds[0]);
    // } else if (content.action === 'peng') {
    //   gameEngine.peng(msg.sender.id);
    // }
    // ...
    
    console.log(`[Execute] Action ${content.action} for player ${msg.sender.id}`);
  }
}

// 单例实例
let instance: MessageProcessorClass | null = null;

/**
 * 获取单例实例
 */
export function getMessageProcessor(): MessageProcessorClass {
  if (!instance) {
    instance = new MessageProcessorClass();
  }
  return instance;
}

// 默认导出单例
export const MessageProcessor = getMessageProcessor();

export default MessageProcessor;
