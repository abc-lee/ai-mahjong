/**
 * 汇报管理器（ReportManager）
 * 
 * 职责：
 * - 接收子 Agent 汇报
 * - 存储房间汇报状态
 * - 提供主 Agent 订阅接口
 * - 心跳检测
 * 
 * @packageDocumentation
 */

import type { AgentReport, RoomReports, RoomState, AgentInfo } from '../../shared/types/chat';

/**
 * 汇报管理器类
 * 
 * 使用单例模式，确保全局只有一个汇报管理器实例
 */
class ReportManager {
  /** 房间汇报存储：roomId -> RoomReports */
  private storage: Map<string, RoomReports> = new Map();
  
  /** 订阅回调：roomId -> callback[] */
  private subscribers: Map<string, ((report: AgentReport) => void)[]> = new Map();
  
  /** 心跳超时时间（毫秒） */
  private heartbeatTimeout: number = 30000; // 30 秒
  
  /** 心跳检测间隔（毫秒） */
  private heartbeatCheckInterval: number = 10000; // 10 秒
  
  /** 心跳检测定时器 */
  private heartbeatTimer: NodeJS.Timeout | null = null;
  
  /** 降级回调：roomId -> callback[] */
  private downgradeCallbacks: Map<string, ((roomId: string, playerId: string) => void)[]> = new Map();
  
  /** 全局降级回调 */
  private globalDowngradeCallbacks: ((roomId: string, playerId: string) => void)[] = [];
  
  /**
   * 私有构造函数，防止外部实例化
   */
  private constructor() {
    // 启动定时心跳检测
    this.startHeartbeatMonitor();
  }
  
  /** 单例实例 */
  private static instance: ReportManager;
  
  /**
   * 启动心跳检测定时器
   */
  private startHeartbeatMonitor(): void {
    this.heartbeatTimer = setInterval(() => {
      this.checkAllHeartbeats();
    }, this.heartbeatCheckInterval);
  }
  
  /**
   * 检查所有房间的心跳状态
   */
  private checkAllHeartbeats(): void {
    const now = Date.now();
    
    for (const [roomId, roomData] of this.storage.entries()) {
      for (const [playerId, lastHeartbeat] of roomData.lastHeartbeat.entries()) {
        // 检查是否超时
        if (now - lastHeartbeat > this.heartbeatTimeout) {
          // 检查是否已经被标记为失联
          if (!roomData.disconnectedAgents.has(playerId)) {
            console.log(`[HeartbeatMonitor] Agent ${playerId} (${roomId}) 超时，标记为失联`);
            
            // 标记为失联
            roomData.disconnectedAgents.add(playerId);
            
            // 触发降级回调
            this.notifyDowngrade(roomId, playerId);
          }
        }
      }
    }
  }
  
  /**
   * 注册降级回调（按房间）
   * 
   * @param roomId - 房间 ID
   * @param callback - 降级回调函数
   * @returns 取消注册函数
   */
  public onDowngrade(
    roomId: string,
    callback: (roomId: string, playerId: string) => void
  ): () => void {
    if (!this.downgradeCallbacks.has(roomId)) {
      this.downgradeCallbacks.set(roomId, []);
    }
    
    const callbacks = this.downgradeCallbacks.get(roomId)!;
    callbacks.push(callback);
    
    return () => {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * 注册全局降级回调（所有房间）
   * 
   * @param callback - 降级回调函数
   * @returns 取消注册函数
   */
  public onDowngradeGlobal(
    callback: (roomId: string, playerId: string) => void
  ): () => void {
    this.globalDowngradeCallbacks.push(callback);
    
    return () => {
      const index = this.globalDowngradeCallbacks.indexOf(callback);
      if (index !== -1) {
        this.globalDowngradeCallbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * 通知降级
   * 
   * @param roomId - 房间 ID
   * @param playerId - 玩家 ID
   */
  private notifyDowngrade(roomId: string, playerId: string): void {
    // 通知房间特定回调
    const roomCallbacks = this.downgradeCallbacks.get(roomId);
    if (roomCallbacks) {
      for (const callback of roomCallbacks) {
        try {
          callback(roomId, playerId);
        } catch (error) {
          console.error(`[HeartbeatMonitor] 降级回调失败:`, error);
        }
      }
    }
    
    // 通知全局回调
    for (const callback of this.globalDowngradeCallbacks) {
      try {
        callback(roomId, playerId);
      } catch (error) {
        console.error(`[HeartbeatMonitor] 全局降级回调失败:`, error);
      }
    }
  }
  
  /**
   * 停止心跳检测定时器
   */
  public stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * 获取心跳超时时间
   */
  public getHeartbeatTimeout(): number {
    return this.heartbeatTimeout;
  }
  
  /**
   * 获取心跳检测间隔
   */
  public getHeartbeatCheckInterval(): number {
    return this.heartbeatCheckInterval;
  }
  
  /**
   * 获取单例实例
   */
  public static getInstance(): ReportManager {
    if (!ReportManager.instance) {
      ReportManager.instance = new ReportManager();
    }
    return ReportManager.instance;
  }
  
  /**
   * 接收子 Agent 汇报
   * 
   * @param roomId - 房间 ID
   * @param report - Agent 汇报
   */
  public receiveReport(roomId: string, report: AgentReport): void {
    // 确保房间存在
    if (!this.storage.has(roomId)) {
      this.storage.set(roomId, {
        reports: [],
        lastHeartbeat: new Map(),
        disconnectedAgents: new Set(),
      });
    }
    
    const roomData = this.storage.get(roomId)!;
    
    // 更新心跳时间
    roomData.lastHeartbeat.set(report.player.id, report.timestamp);
    
    // 如果 Agent 之前被标记为失联，现在恢复连接状态
    roomData.disconnectedAgents.delete(report.player.id);
    
    // 添加汇报到列表
    roomData.reports.push(report);
    
    // 限制汇报列表大小（保留最近 100 条）
    if (roomData.reports.length > 100) {
      roomData.reports = roomData.reports.slice(-100);
    }
    
    // 通知订阅者
    this.notifySubscribers(roomId, report);
  }
  
  /**
   * 主 Agent 订阅房间汇报
   * 
   * @param roomId - 房间 ID
   * @param callback - 回调函数，收到汇报时调用
   * @returns 取消订阅函数
   */
  public subscribe(
    roomId: string,
    callback: (report: AgentReport) => void
  ): () => void {
    // 确保订阅列表存在
    if (!this.subscribers.has(roomId)) {
      this.subscribers.set(roomId, []);
    }
    
    const callbacks = this.subscribers.get(roomId)!;
    callbacks.push(callback);
    
    // 返回取消订阅函数
    return () => {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * 获取房间当前状态
   * 
   * @param roomId - 房间 ID
   * @returns 房间状态，如果房间不存在则返回 undefined
   */
  public getRoomState(roomId: string): RoomState | undefined {
    const roomData = this.storage.get(roomId);
    if (!roomData) {
      return undefined;
    }
    
    // 构建 Agent 信息列表
    const agents = new Map<string, AgentInfo>();
    const now = Date.now();
    
    for (const [playerId, lastHeartbeat] of roomData.lastHeartbeat) {
      const isDisconnected = now - lastHeartbeat > this.heartbeatTimeout;
      const isManuallyDisconnected = roomData.disconnectedAgents.has(playerId);
      
      agents.set(playerId, {
        id: playerId,
        name: playerId, // 名称需要在 receiveReport 时记录，这里简化处理
        status: isDisconnected || isManuallyDisconnected ? 'disconnected' : 'connected',
        lastHeartbeat,
      });
    }
    
    return {
      roomId,
      agents,
      lastUpdate: now,
    };
  }
  
  /**
   * 心跳检测
   * 
   * @param roomId - 房间 ID
   * @param playerId - 玩家 ID
   * @returns 是否存活（最后心跳在超时时间内）
   */
  public checkHeartbeat(roomId: string, playerId: string): boolean {
    const roomData = this.storage.get(roomId);
    if (!roomData) {
      return false;
    }
    
    const lastHeartbeat = roomData.lastHeartbeat.get(playerId);
    if (!lastHeartbeat) {
      return false;
    }
    
    const now = Date.now();
    return now - lastHeartbeat <= this.heartbeatTimeout;
  }
  
  /**
   * 标记失联 Agent
   * 
   * @param roomId - 房间 ID
   * @param playerId - 玩家 ID
   */
  public markAsDisconnected(roomId: string, playerId: string): void {
    const roomData = this.storage.get(roomId);
    if (!roomData) {
      return;
    }
    
    roomData.disconnectedAgents.add(playerId);
  }
  
  /**
   * 获取房间的汇报列表
   * 
   * @param roomId - 房间 ID
   * @returns 汇报列表
   */
  public getReports(roomId: string): AgentReport[] {
    const roomData = this.storage.get(roomId);
    if (!roomData) {
      return [];
    }
    
    return roomData.reports;
  }
  
  /**
   * 清除房间数据
   * 
   * @param roomId - 房间 ID
   */
  public clearRoom(roomId: string): void {
    this.storage.delete(roomId);
    this.subscribers.delete(roomId);
  }
  
  /**
   * 通知订阅者
   * 
   * @param roomId - 房间 ID
   * @param report - 汇报
   */
  private notifySubscribers(roomId: string, report: AgentReport): void {
    const callbacks = this.subscribers.get(roomId);
    if (!callbacks) {
      return;
    }
    
    // 异步调用所有订阅者
    for (const callback of callbacks) {
      try {
        callback(report);
      } catch (error) {
        console.error(`ReportManager: Error notifying subscriber for room ${roomId}:`, error);
      }
    }
  }
  
  /**
   * 设置心跳超时时间
   * 
   * @param timeout - 超时时间（毫秒）
   */
  public setHeartbeatTimeout(timeout: number): void {
    this.heartbeatTimeout = timeout;
  }
  
  /**
   * 获取所有房间 ID 列表
   * 
   * @returns 房间 ID 列表
   */
  public getRoomIds(): string[] {
    return Array.from(this.storage.keys());
  }
}

// 导出单例实例
export const reportManager = ReportManager.getInstance();

// 也导出类以便测试
export { ReportManager };
