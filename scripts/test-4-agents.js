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
    this.isHost = false;
    this.gameStarted = false;
  }

  connect() {
    this.socket = io(SERVER_URL);
    
    this.socket.on('connect', () => {
      console.log(`[${this.name}] 连接成功`);
    });

    this.socket.on('agent:your_turn', (data) => {
      this.hand = data.hand || [];
      console.log(`[${this.name}] 轮次: ${data.phase}, 手牌: ${this.hand.length}张`);
      
      // 打印收到的自然语言 Prompt
      if (data.prompt) {
        console.log(`\n--- ${this.name} 收到的 Prompt ---`);
        console.log(data.prompt);
        console.log(`--- Prompt 结束 ---\n`);
      }
      
      setTimeout(() => this.handleTurn(data), 800);
    });

    this.socket.on('game:actions', (data) => {
      this.handleActions(data);
    });

    // 关键：监听房间更新，房主自动开始游戏
    this.socket.on('room:updated', (data) => {
      const room = data.room;
      if (!room || this.gameStarted) return;
      
      const isHost = room.host === this.id;
      const allReady = room.players.length === 4 && room.players.every(p => p.isReady);
      
      if (isHost && allReady) {
        console.log(`[${this.name}] 我是房主，全员已准备，自动开始游戏！`);
        this.gameStarted = true;
        setTimeout(() => {
          this.socket.emit('game:start', (res) => {
            console.log(`[${this.name}] 开始游戏:`, res?.success ? '成功' : res?.message);
          });
        }, 500);
      }
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

    // 监听发言事件
    this.socket.on('player:speech', (data) => {
      console.log(`💬 [${data.playerName}]: ${data.content}`);
    });
    
    // 监听情绪变化
    this.socket.on('player:emotion', (data) => {
      // 简化输出
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
      // 使用 room:createAI 以 AI 身份创建房间
      this.socket.emit('room:createAI', {
        agentId: this.id,
        agentName: this.name,
        type: 'ai-agent'
      }, (res) => {
        if (res.roomId) {
          this.roomId = res.roomId;
          this.isHost = true; // 标记为房主
          console.log(`[${this.name}] 创建房间: ${res.roomId}`);
        } else {
          console.log(`[${this.name}] 创建房间失败: ${res.error || res.message}`);
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

// 存储所有 agent 实例
const allAgents = [];

async function main() {
  console.log('=== 4 Agent 游戏测试 ===\n');

  const agents = [
    new Agent('agent-1', '紫璃'),
    new Agent('agent-2', '白泽'),
    new Agent('agent-3', '李瞳'),
    new Agent('agent-4', '测试员'),
  ];
  
  allAgents.push(...agents);

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

  // 不再硬编码开始游戏，而是让 room:updated 自动处理
  console.log('\n等待游戏自动开始...\n');

  // 运行 5 分钟
  await new Promise(r => setTimeout(r, 300000));

  console.log('\n测试结束');
}

main().catch(console.error);
