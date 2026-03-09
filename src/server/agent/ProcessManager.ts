/**
 * 进程管理器
 * 
 * 负责：
 * - 启动 Bridge 进程
 * - 管理进程生命周期
 * - 避免进程累积
 * - 游戏结束自动清理
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface BridgeProcess {
  process: ChildProcess;
  roomId: string;
  agentId: string;
  agentName: string;
  startedAt: number;
}

class ProcessManagerClass {
  private processes: Map<string, BridgeProcess> = new Map();
  private bridgeScriptPath: string;
  
  constructor() {
    this.bridgeScriptPath = path.join(__dirname, '../../scripts/bridge.js');
  }
  
  /**
   * 获取进程键
   */
  private getKey(roomId: string, agentId: string): string {
    return `${roomId}-${agentId}`;
  }
  
  /**
   * 启动 Bridge 进程
   */
  spawn(roomId: string, agentId: string, agentName: string): ChildProcess | null {
    const key = this.getKey(roomId, agentId);
    
    // 如果已有进程，先杀掉（避免累积）
    if (this.processes.has(key)) {
      console.log(`[ProcessManager] 杀掉旧进程: ${key}`);
      this.kill(roomId, agentId);
    }
    
    try {
      // 启动新进程
      const proc = spawn('node', [this.bridgeScriptPath, roomId, agentId, agentName], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });
      
      // 记录进程
      this.processes.set(key, {
        process: proc,
        roomId,
        agentId,
        agentName,
        startedAt: Date.now()
      });
      
      console.log(`[ProcessManager] 启动 Bridge: ${key} (PID: ${proc.pid})`);
      
      // 监听进程退出
      proc.on('exit', (code) => {
        console.log(`[ProcessManager] Bridge 退出: ${key} (code: ${code})`);
        this.processes.delete(key);
      });
      
      // 监听错误
      proc.on('error', (err) => {
        console.error(`[ProcessManager] Bridge 错误: ${key}`, err);
        this.processes.delete(key);
      });
      
      return proc;
    } catch (err) {
      console.error(`[ProcessManager] 启动失败: ${key}`, err);
      return null;
    }
  }
  
  /**
   * 杀掉指定进程
   */
  kill(roomId: string, agentId: string): boolean {
    const key = this.getKey(roomId, agentId);
    const bridge = this.processes.get(key);
    
    if (bridge) {
      bridge.process.kill();
      this.processes.delete(key);
      return true;
    }
    return false;
  }
  
  /**
   * 杀掉指定房间的所有进程
   */
  killRoom(roomId: string): number {
    let count = 0;
    for (const [key, bridge] of this.processes) {
      if (bridge.roomId === roomId) {
        bridge.process.kill();
        this.processes.delete(key);
        count++;
      }
    }
    return count;
  }
  
  /**
   * 杀掉所有进程
   */
  killAll(): void {
    for (const [key, bridge] of this.processes) {
      bridge.process.kill();
    }
    this.processes.clear();
    console.log(`[ProcessManager] 已杀掉所有进程`);
  }
  
  /**
   * 获取进程
   */
  get(roomId: string, agentId: string): BridgeProcess | undefined {
    return this.processes.get(this.getKey(roomId, agentId));
  }
  
  /**
   * 发送决策到 Bridge
   */
  sendDecision(roomId: string, agentId: string, decision: any): boolean {
    const bridge = this.get(roomId, agentId);
    if (bridge && bridge.process.stdin) {
      bridge.process.stdin.write(JSON.stringify(decision) + '\n');
      return true;
    }
    return false;
  }
  
  /**
   * 获取所有进程状态
   */
  getStatus(): Array<{ roomId: string; agentId: string; agentName: string; pid?: number; uptime: number }> {
    const now = Date.now();
    return Array.from(this.processes.values()).map(bridge => ({
      roomId: bridge.roomId,
      agentId: bridge.agentId,
      agentName: bridge.agentName,
      pid: bridge.process.pid,
      uptime: Math.floor((now - bridge.startedAt) / 1000)
    }));
  }
}

// 单例导出
export const ProcessManager = new ProcessManagerClass();
