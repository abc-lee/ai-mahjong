/**
 * 游戏流程测试脚本
 * 4个AI在同一个房间进行完整游戏
 */

import { io, Socket } from 'socket.io-client';

interface Tile {
  id: string;
  suit: string;
  value: number;
  display: string;
}

interface PendingAction {
  playerId: string;
  action: string;
  priority: number;
  tiles?: Tile[];
}

interface GameState {
  roomId: string;
  phase: string;
  currentPlayerIndex: number;
  players: Array<{
    id: string;
    name: string;
    position: number;
    handCount: number;
  }>;
  pendingActions: PendingAction[];
}

class TestPlayer {
  socket: Socket;  // 改为 public
  private name: string;
  private hand: Tile[] = [];
  private myId: string = '';
  private roomId: string = '';
  
  constructor(name: string, private isHost: boolean = false) {
    this.name = name;
    this.socket = io('http://localhost:3000', {
      autoConnect: false,
      transports: ['websocket'],
    });
    this.setupListeners();
  }
  
  private setupListeners() {
    this.socket.on('connect', () => {
      this.myId = this.socket.id!;
      console.log(`[${this.name}] 已连接`);
    });
    
    this.socket.on('room:updated', (data: { room: { id: string; players: any[]; host: string; state: string } }) => {
      this.roomId = data.room.id;
      const me = data.room.players.find(p => p.id === this.myId);
      
      if (!me) return;
      
      // 自动准备
      if (!me.isReady && data.room.state === 'waiting') {
        setTimeout(() => {
          this.socket.emit('room:ready', { ready: true });
        }, 300);
      }
      
      // 房主检查是否可以开始
      if (data.room.host === this.myId && data.room.players.length === 4) {
        const allReady = data.room.players.every(p => p.isReady);
        if (allReady && data.room.state === 'waiting') {
          console.log(`[${this.name}] 所有人准备好了，开始游戏！`);
          setTimeout(() => {
            this.socket.emit('game:start', (res: any) => {
              console.log(`[${this.name}] 开始游戏结果:`, res);
            });
          }, 500);
        }
      }
    });
    
    this.socket.on('game:started', () => {
      console.log(`[${this.name}] 游戏开始！`);
    });
    
    this.socket.on('game:state', (data: { state: GameState; yourHand: Tile[]; yourTurn: boolean; lastDrawnTile?: Tile }) => {
      this.hand = data.yourHand || [];
      
      if (data.yourTurn && data.state.pendingActions.length === 0) {
        // 我的回合，没有待处理操作
        if (data.lastDrawnTile || this.hand.length !== 13) {
          // 打牌阶段
          setTimeout(() => this.discard(), 800);
        } else {
          // 摸牌阶段
          setTimeout(() => this.draw(), 300);
        }
      }
    });
    
    this.socket.on('game:actions', (data: { actions: PendingAction[] }) => {
      if (data.actions.length > 0) {
        // 优先级：胡 > 杠 > 碰 > 吃
        const priority = ['hu', 'gang', 'peng', 'chi'];
        const best = data.actions.sort((a, b) => 
          priority.indexOf(a.action) - priority.indexOf(b.action)
        )[0];
        
        console.log(`[${this.name}] 执行: ${best.action}`);
        setTimeout(() => {
          this.socket.emit('game:action', { action: best.action, tiles: best.tiles });
        }, 500);
      }
    });
    
    this.socket.on('game:draw', (data: { tile: Tile }) => {
      console.log(`[${this.name}] 摸到: ${data.tile.display}`);
    });
    
    this.socket.on('game:ended', (data: { winner: number }) => {
      console.log(`[${this.name}] 游戏结束！赢家: ${data.winner}`);
    });
  }
  
  private draw() {
    this.socket.emit('game:draw', (res: { tile?: Tile; error?: string }) => {
      if (res.tile) {
        console.log(`[${this.name}] 摸到: ${res.tile.display}`);
      }
    });
  }
  
  private discard() {
    if (this.hand.length === 0) return;
    const tile = this.hand[this.hand.length - 1];
    console.log(`[${this.name}] 打出: ${tile.display}`);
    this.socket.emit('game:discard', { tileId: tile.id });
  }
  
  joinRoom(roomId: string) {
    this.socket.connect();
    setTimeout(() => {
      this.socket.emit('room:join', { roomId, playerName: this.name });
    }, 500);
  }
  
  createRoom() {
    this.socket.connect();
    setTimeout(() => {
      this.socket.emit('room:create', { playerName: this.name }, (res: { roomId: string }) => {
        console.log(`[${this.name}] 创建房间: ${res.roomId}`);
        this.roomId = res.roomId;
      });
    }, 500);
  }
  
  getRoomId() {
    return this.roomId;
  }
}

// 测试主函数
async function runTest() {
  console.log('=== 开始游戏流程测试 ===\n');
  
  const players: TestPlayer[] = [];
  const names = ['玩家1', '玩家2', '玩家3', '玩家4'];
  let roomId: string = '';
  
  // 第一个玩家创建房间
  const host = new TestPlayer(names[0], true);
  
  // 等待连接
  await new Promise<void>(resolve => {
    host.socket.on('connect', () => resolve());
  });
  
  // 创建房间
  roomId = await new Promise<string>(resolve => {
    host.socket.emit('room:create', { playerName: names[0] }, (res: { roomId: string }) => {
      console.log(`[${names[0]}] 创建房间: ${res.roomId}`);
      resolve(res.roomId);
    });
  });
  
  players.push(host);
  
  // 其他玩家加入
  for (let i = 1; i < 4; i++) {
    const player = new TestPlayer(names[i]);
    await new Promise<void>(resolve => {
      player.socket.on('connect', () => resolve());
    });
    player.socket.emit('room:join', { roomId, playerName: names[i] }, () => {
      console.log(`[${names[i]}] 加入房间`);
    });
    players.push(player);
    await new Promise(r => setTimeout(r, 300));
  }
  
  // 游戏会自动开始和运行
  console.log('\n所有玩家已加入，游戏将自动开始...\n');
}

runTest();
