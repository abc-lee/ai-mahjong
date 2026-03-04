/**
 * AI 玩家 "小红"
 * 连接麻将服务器，自动加入房间并准备
 */

import { io, Socket } from 'socket.io-client';

// 类型定义
interface Tile {
  id: string;
  suit: string;
  value: number;
  display: string;
}

interface PlayerPublic {
  id: string;
  name: string;
  position: number;
  isReady: boolean;
  isOnline: boolean;
}

interface Room {
  id: string;
  name: string;
  host: string;
  players: PlayerPublic[];
  spectators: PlayerPublic[];
  state: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  settings: {
    maxPlayers: number;
    allowSpectators: boolean;
    baseScore: number;
  };
}

interface GameState {
  roomId: string;
  phase: string;
  currentPlayerIndex: number;
  players: PlayerPublic[];
}

const AI_NAME = '小红';
const SERVER_URL = 'http://localhost:3000';

class XiaohongAI {
  private socket: Socket;
  private roomId: string | null = null;
  private hand: Tile[] = [];
  private isMyTurn = false;

  constructor() {
    this.socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });

    this.setupListeners();
  }

  private setupListeners() {
    // 连接成功
    this.socket.on('connect', async () => {
      console.log(`[${AI_NAME}] 已连接到服务器`);
      
      // 等待 2 秒
      console.log(`[${AI_NAME}] 等待 2 秒...`);
      await this.sleep(2000);
      
      // 获取房间列表
      this.findRoom();
    });

    // 断开连接
    this.socket.on('disconnect', () => {
      console.log(`[${AI_NAME}] 断开连接`);
    });

    // 房间更新
    this.socket.on('room:updated', (data: { room: Room }) => {
      console.log(`[${AI_NAME}] 房间更新, 玩家: ${data.room.players.map(p => p.name).join(', ')}`);
      
      // 检查是否需要准备
      const me = data.room.players.find(p => p.name === AI_NAME);
      if (me && !me.isReady && data.room.state === 'waiting') {
        console.log(`[${AI_NAME}] 自动准备...`);
        setTimeout(() => this.setReady(true), 500);
      }
    });

    // 游戏开始
    this.socket.on('game:started', () => {
      console.log(`[${AI_NAME}] 游戏开始了！`);
    });

    // 游戏状态
    this.socket.on('game:state', (data: { state: GameState; yourHand: Tile[]; yourTurn: boolean; lastDrawnTile?: Tile }) => {
      this.hand = data.yourHand || [];
      this.isMyTurn = data.yourTurn;
      
      console.log(`[${AI_NAME}] 游戏状态 - 手牌: ${this.hand.length}张, 我的回合: ${this.isMyTurn}`);
      
      if (data.lastDrawnTile) {
        console.log(`[${AI_NAME}] 摸到: ${data.lastDrawnTile.display}`);
      }
      
      if (this.isMyTurn && this.hand.length > 0) {
        // 模拟思考后打牌
        setTimeout(() => this.playTurn(), 1000 + Math.random() * 1000);
      }
    });

    // 可执行操作
    this.socket.on('game:actions', (data: { actions: Array<{ action: string; tiles?: Tile[] }> }) => {
      if (data.actions.length > 0) {
        console.log(`[${AI_NAME}] 可用操作: ${data.actions.map(a => a.action).join(', ')}`);
        
        // 优先级: 胡 > 杠 > 碰 > 吃
        const priority = ['hu', 'gang', 'peng', 'chi'];
        const bestAction = data.actions.sort(
          (a, b) => priority.indexOf(a.action) - priority.indexOf(b.action)
        )[0];
        
        console.log(`[${AI_NAME}] 选择操作: ${bestAction.action}`);
        setTimeout(() => this.performAction(bestAction.action, bestAction.tiles), 500);
      }
    });

    // 游戏结束
    this.socket.on('game:ended', (data: { winner: number; winningHand?: unknown }) => {
      console.log(`[${AI_NAME}] 游戏结束! 赢家位置: ${data.winner}`);
      // 游戏结束后自动准备下一局
      setTimeout(() => this.setReady(true), 2000);
    });
  }

  private async findRoom() {
    console.log(`[${AI_NAME}] 获取房间列表...`);
    
    this.socket.emit('room:list', (response: { rooms: Room[] }) => {
      const waitingRooms = response.rooms.filter(r => r.state === 'waiting' && r.players.length < 4);
      
      console.log(`[${AI_NAME}] 找到 ${response.rooms.length} 个房间, ${waitingRooms.length} 个可加入`);
      
      if (waitingRooms.length > 0) {
        // 加入第一个可用的房间
        const room = waitingRooms[0];
        console.log(`[${AI_NAME}] 加入房间: ${room.id} (${room.players.length}/4 人)`);
        this.joinRoom(room.id);
      } else {
        // 创建新房间
        console.log(`[${AI_NAME}] 没有可加入的房间，创建新房间...`);
        this.createRoom();
      }
    });
  }

  private createRoom() {
    this.socket.emit('room:create', { playerName: AI_NAME }, (response: { roomId?: string; room?: Room; message?: string }) => {
      if (response.roomId) {
        this.roomId = response.roomId;
        console.log(`[${AI_NAME}] 创建房间成功: ${response.roomId}`);
        // 创建后自动准备
        setTimeout(() => this.setReady(true), 500);
      } else {
        console.log(`[${AI_NAME}] 创建房间失败: ${response.message}`);
      }
    });
  }

  private joinRoom(roomId: string) {
    this.socket.emit('room:join', { roomId, playerName: AI_NAME }, (response: { roomId?: string; room?: Room; playerPosition?: number; message?: string }) => {
      if (response.roomId) {
        this.roomId = response.roomId;
        console.log(`[${AI_NAME}] 加入房间成功! 位置: ${response.playerPosition}`);
        // 加入后自动准备
        setTimeout(() => this.setReady(true), 500);
      } else {
        console.log(`[${AI_NAME}] 加入房间失败: ${response.message}`);
        // 失败后尝试创建房间
        this.createRoom();
      }
    });
  }

  private setReady(ready: boolean) {
    this.socket.emit('room:ready', { ready }, (response: { success?: boolean; room?: Room; message?: string }) => {
      if (response.success) {
        console.log(`[${AI_NAME}] 准备状态: ${ready ? '已准备' : '取消准备'}`);
      } else {
        console.log(`[${AI_NAME}] 设置准备失败: ${response.message}`);
      }
    });
  }

  private playTurn() {
    if (!this.isMyTurn || this.hand.length === 0) return;
    
    // 简单策略：随机打出一张牌
    const randomIndex = Math.floor(Math.random() * this.hand.length);
    const tileToDiscard = this.hand[randomIndex];
    
    console.log(`[${AI_NAME}] 打出: ${tileToDiscard.display}`);
    this.socket.emit('game:discard', { tileId: tileToDiscard.id }, (response: { success?: boolean; message?: string }) => {
      if (!response?.success) {
        console.log(`[${AI_NAME}] 打牌失败: ${response?.message}`);
      }
    });
  }

  private performAction(action: string, tiles?: Tile[]) {
    this.socket.emit('game:action', { action, tiles }, (response: { success?: boolean; message?: string }) => {
      if (response.success) {
        console.log(`[${AI_NAME}] 操作完成: ${action}`);
      } else {
        console.log(`[${AI_NAME}] 操作失败: ${response.message}`);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  connect() {
    console.log(`[${AI_NAME}] 正在连接到 ${SERVER_URL}...`);
    this.socket.connect();
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// 启动 AI
const ai = new XiaohongAI();
ai.connect();

// 保持进程运行
process.on('SIGINT', () => {
  console.log(`\n[${AI_NAME}] 收到退出信号，断开连接...`);
  ai.disconnect();
  process.exit(0);
});

console.log('AI 玩家 "小红" 已启动');
console.log('按 Ctrl+C 退出');
