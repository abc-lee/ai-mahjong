/**
 * 老王 - 麻将 AI 玩家
 * 单独运行的 AI 客户端
 */

import { io, Socket } from 'socket.io-client';

interface Tile {
  id: string;
  suit: string;
  value: number;
  display: string;
}

interface Player {
  id: string;
  name: string;
  position: number;
  isReady: boolean;
}

interface Room {
  id: string;
  name: string;
  host: string;
  players: Player[];
  state: string;
}

interface GameState {
  roomId: string;
  phase: string;
  currentPlayerIndex: number;
  players: Player[];
}

const PLAYER_NAME = '老王';
const SERVER_URL = 'http://localhost:3000';

class LaowangPlayer {
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
    this.socket.on('connect', () => {
      console.log(`[${PLAYER_NAME}] 已连接到服务器 ${SERVER_URL}`);
      
      // 等待 4 秒后获取房间列表
      console.log(`[${PLAYER_NAME}] 等待 4 秒...`);
      setTimeout(() => {
        this.findRoom();
      }, 4000);
    });

    this.socket.on('disconnect', () => {
      console.log(`[${PLAYER_NAME}] 断开连接`);
    });

    this.socket.on('connect_error', (error) => {
      console.log(`[${PLAYER_NAME}] 连接失败: ${error.message}`);
    });

    // 房间更新
    this.socket.on('room:updated', (data: { room: Room }) => {
      this.roomId = data.room.id;
      console.log(`[${PLAYER_NAME}] 房间更新, 玩家数: ${data.room.players.length}/4`);
      
      // 显示房间内玩家
      data.room.players.forEach(p => {
        console.log(`  - ${p.name} (位置 ${p.position}) ${p.isReady ? '✓已准备' : '等待中'}`);
      });
      
      // 如果还没准备，自动准备
      const me = data.room.players.find(p => p.name === PLAYER_NAME);
      if (me && !me.isReady) {
        setTimeout(() => this.setReady(true), 500 + Math.random() * 1000);
      }
    });

    // 游戏开始
    this.socket.on('game:started', () => {
      console.log(`[${PLAYER_NAME}] 游戏开始了！`);
    });

    // 游戏状态
    this.socket.on('game:state', (data: { state: GameState; yourHand: Tile[]; yourTurn: boolean; lastDrawnTile?: Tile }) => {
      this.hand = data.yourHand || [];
      this.isMyTurn = data.yourTurn;
      
      const handDisplay = this.hand.map(t => t.display).join(' ');
      console.log(`[${PLAYER_NAME}] 手牌: ${handDisplay}`);
      console.log(`[${PLAYER_NAME}] 当前玩家位置: ${data.state.currentPlayerIndex}, 我的回合: ${this.isMyTurn}`);
      
      if (this.isMyTurn && this.hand.length > 0) {
        // 延迟一下再打牌，模拟思考
        setTimeout(() => this.playTurn(), 1000 + Math.random() * 2000);
      }
    });

    // 可执行的操作
    this.socket.on('game:actions', (data: { actions: Array<{ action: string; tiles?: Tile[] }> }) => {
      if (data.actions.length > 0) {
        console.log(`[${PLAYER_NAME}] 可执行操作: ${data.actions.map(a => a.action).join(', ')}`);
        
        // 优先胡牌，其次杠，再次碰，最后吃
        const priority = ['hu', 'gang', 'peng', 'chi'];
        const bestAction = data.actions.sort(
          (a, b) => priority.indexOf(a.action) - priority.indexOf(b.action)
        )[0];
        
        console.log(`[${PLAYER_NAME}] 执行操作: ${bestAction.action}`);
        setTimeout(() => this.performAction(bestAction.action, bestAction.tiles), 500);
      }
    });

    // 游戏结束
    this.socket.on('game:ended', (data: { winner: number; winningHand?: unknown }) => {
      console.log(`[${PLAYER_NAME}] 游戏结束, 赢家位置: ${data.winner}`);
      if (data.winningHand) {
        console.log(`[${PLAYER_NAME}] 胡牌牌型:`, data.winningHand);
      }
      // 游戏结束后自动准备下一局
      setTimeout(() => this.setReady(true), 2000);
    });

    // 错误处理
    this.socket.on('room:error', (data: { message: string }) => {
      console.log(`[${PLAYER_NAME}] 房间错误: ${data.message}`);
    });

    this.socket.on('game:error', (data: { message: string }) => {
      console.log(`[${PLAYER_NAME}] 游戏错误: ${data.message}`);
    });
  }

  private findRoom() {
    console.log(`[${PLAYER_NAME}] 获取房间列表...`);
    
    this.socket.emit('room:list', (response: { rooms: Room[] }) => {
      console.log(`[${PLAYER_NAME}] 当前房间数: ${response.rooms.length}`);
      
      // 查找等待中且未满员的房间
      const waitingRooms = response.rooms.filter(r => r.state === 'waiting' && r.players.length < 4);
      
      if (waitingRooms.length > 0) {
        // 加入第一个可用房间
        const room = waitingRooms[0];
        console.log(`[${PLAYER_NAME}] 找到房间 ${room.id}, 当前 ${room.players.length}/4 人`);
        this.joinRoom(room.id);
      } else {
        console.log(`[${PLAYER_NAME}] 没有等待中的房间，创建新房间...`);
        this.createRoom();
      }
    });
  }

  private createRoom() {
    this.socket.emit('room:create', { playerName: PLAYER_NAME }, (res: unknown) => {
      const response = res as { roomId?: string; error?: string };
      if (response.roomId) {
        this.roomId = response.roomId;
        console.log(`[${PLAYER_NAME}] 创建房间成功: ${response.roomId}`);
      } else if (response.error) {
        console.log(`[${PLAYER_NAME}] 创建房间失败: ${response.error}`);
      }
    });
  }

  private joinRoom(roomId: string) {
    this.socket.emit('room:join', { roomId, playerName: PLAYER_NAME }, (res: unknown) => {
      const response = res as { roomId?: string; error?: string; playerPosition?: number };
      if (response.roomId) {
        this.roomId = response.roomId;
        console.log(`[${PLAYER_NAME}] 加入房间成功: ${response.roomId}, 位置: ${response.playerPosition}`);
      } else if (response.error) {
        console.log(`[${PLAYER_NAME}] 加入房间失败: ${response.error}`);
        // 如果加入失败，尝试创建新房间
        this.createRoom();
      }
    });
  }

  private setReady(ready: boolean) {
    this.socket.emit('room:ready', { ready }, (res: unknown) => {
      const response = res as { success?: boolean; error?: string };
      if (response.success) {
        console.log(`[${PLAYER_NAME}] 已准备: ${ready}`);
      } else if (response.error) {
        console.log(`[${PLAYER_NAME}] 准备失败: ${response.error}`);
      }
    });
  }

  private playTurn() {
    if (!this.isMyTurn || this.hand.length === 0) return;
    
    // 简单策略：随机打出一张牌
    const randomIndex = Math.floor(Math.random() * this.hand.length);
    const tileToDiscard = this.hand[randomIndex];
    
    console.log(`[${PLAYER_NAME}] 打出: ${tileToDiscard.display}`);
    this.socket.emit('game:discard', { tileId: tileToDiscard.id });
  }

  private performAction(action: string, tiles?: Tile[]) {
    this.socket.emit('game:action', { action, tiles }, (res: unknown) => {
      const response = res as { success?: boolean; error?: string };
      if (response.success) {
        console.log(`[${PLAYER_NAME}] 操作成功: ${action}`);
      } else if (response.error) {
        console.log(`[${PLAYER_NAME}] 操作失败: ${response.error}`);
      }
    });
  }

  connect() {
    console.log(`[${PLAYER_NAME}] 正在连接到 ${SERVER_URL}...`);
    this.socket.connect();
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// 启动老王
console.log('====================================');
console.log('  老王 - 麻将 AI 玩家');
console.log('====================================');
console.log('');

const laowang = new LaowangPlayer();
laowang.connect();

// 保持进程运行
process.on('SIGINT', () => {
  console.log(`\n[${PLAYER_NAME}] 收到退出信号，断开连接...`);
  laowang.disconnect();
  process.exit(0);
});

// 防止进程退出
process.stdin.resume();
