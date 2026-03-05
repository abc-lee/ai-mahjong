/**
 * 4 Agent 完整游戏测试
 */
const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

class Agent {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.socket = null;
    this.hand = [];
    this.roomId = null;
  }

  connect() {
    this.socket = io(SERVER_URL);
    
    this.socket.on('connect', () => {
      console.log(`[${this.name}] 连接成功`);
    });

    this.socket.on('agent:your_turn', (data) => {
      this.hand = data.hand || [];
      console.log(`[${this.name}] 轮次: ${data.phase}, 手牌: ${this.hand.length}张`);
      
      setTimeout(() => this.handleTurn(data), 800);
    });

    this.socket.on('game:actions', (data) => {
      this.handleActions(data);
    });

    this.socket.on('room:updated', (data) => {
      // 静默
    });

    this.socket.on('game:state', (data) => {
      if (data.yourHand) this.hand = data.yourHand;
      // 如果收到 game:state 且 yourTurn=true，也处理轮次（作为"人类"玩家）
      if (data.yourTurn) {
        console.log(`[${this.name}] 收到 game:state, yourTurn=true, phase=${data.turnPhase}`);
        setTimeout(() => this.handleTurn({ phase: data.turnPhase, hand: data.yourHand }), 500);
      }
    });

    this.socket.on('game:ended', (data) => {
      console.log(`\n=== 游戏结束 ===`);
      console.log(`赢家: ${data.winner}`);
    });
  }

  handleTurn(data) {
    if (data.phase === 'draw') {
      console.log(`[${this.name}] 执行摸牌`);
      this.socket.emit('agent:command', { cmd: 'draw' }, (res) => {
        console.log(`[${this.name}] 摸牌结果:`, res.success ? '成功' : res.error);
      });
    } else if (data.phase === 'discard') {
      if (this.hand.length > 0) {
        const tile = this.hand[Math.floor(Math.random() * this.hand.length)];
        console.log(`[${this.name}] 打出: ${tile.display} (id: ${tile.id})`);
        this.socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res) => {
          if (!res.success) {
            console.log(`[${this.name}] 打牌失败: ${res.error}`);
            // 重试：随机选另一张
            const retry = this.hand[0];
            console.log(`[${this.name}] 重试打出: ${retry.display}`);
            this.socket.emit('agent:command', { cmd: 'discard', tileId: retry.id });
          }
        });
      }
    }
  }

  handleActions(data) {
    const actions = data.actions || [];
    console.log(`[${this.name}] 可用操作: ${actions.map(a => a.action).join(',')}`);
    
    // 优先级：胡 > 杠 > 碰 > 吃 > 过
    if (actions.some(a => a.action === 'hu')) {
      this.socket.emit('agent:command', { cmd: 'action', action: 'hu' });
    } else if (actions.some(a => a.action === 'gang')) {
      this.socket.emit('agent:command', { cmd: 'action', action: 'gang' });
    } else if (actions.some(a => a.action === 'peng')) {
      this.socket.emit('agent:command', { cmd: 'action', action: 'peng' });
    } else if (actions.some(a => a.action === 'chi')) {
      this.socket.emit('agent:command', { cmd: 'action', action: 'chi' });
    } else {
      this.socket.emit('agent:command', { cmd: 'pass' });
    }
  }

  createRoom() {
    return new Promise((resolve) => {
      this.socket.emit('room:create', { playerName: this.name }, (res) => {
        if (res.roomId) {
          this.roomId = res.roomId;
          console.log(`[${this.name}] 创建房间: ${res.roomId}`);
        }
        resolve(res);
      });
    });
  }

  joinRoom(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('room:joinAI', {
        roomId,
        agentId: this.id,
        agentName: this.name,
        type: 'ai-agent'
      }, (res) => {
        console.log(`[${this.name}] 加入房间: ${res.success ? '成功' : res.error}`);
        this.roomId = roomId;
        resolve(res);
      });
    });
  }

  startGame() {
    return new Promise((resolve) => {
      // game:start 只需要 callback，不需要 data
      this.socket.emit('game:start', (res) => {
        // res 可能是 undefined 或者有 success 属性
        const success = res && res.success !== false;
        console.log(`[${this.name}] 开始游戏: ${success ? '成功' : (res?.message || '未知错误')}`);
        resolve(res);
      });
    });
  }
}

async function main() {
  console.log('=== 4 Agent 游戏测试 ===\n');

  const agents = [
    new Agent('agent-1', '紫璃'),
    new Agent('agent-2', '白泽'),
    new Agent('agent-3', '李瞳'),
    new Agent('agent-4', '测试员'),
  ];

  // 连接
  agents.forEach(a => a.connect());
  await new Promise(r => setTimeout(r, 2000));

  // Agent 1 创建房间
  const createRes = await agents[0].createRoom();
  if (!createRes.roomId) {
    console.log('创建房间失败:', createRes);
    return;
  }

  const roomId = createRes.roomId;
  await new Promise(r => setTimeout(r, 1000));

  // 其他 Agent 加入
  await agents[1].joinRoom(roomId);
  await new Promise(r => setTimeout(r, 500));
  await agents[2].joinRoom(roomId);
  await new Promise(r => setTimeout(r, 500));
  await agents[3].joinRoom(roomId);
  await new Promise(r => setTimeout(r, 1000));

  // 开始游戏
  console.log('\n=== 开始游戏 ===');
  await agents[0].startGame();

  // 运行 5 分钟
  console.log('\n游戏进行中...\n');
  await new Promise(r => setTimeout(r, 300000));

  console.log('\n测试结束');
}

main().catch(console.error);
