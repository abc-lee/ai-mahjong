const { io } = require('socket.io-client');

const AGENT_ID = 'zili';
const AGENT_NAME = '紫璃';
const SERVER_URL = 'http://localhost:3000';

console.log(`🎴 AI Agent [${AGENT_NAME}] 启动...`);

const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10
});

socket.on('connect', () => {
  console.log(`✅ [${AGENT_NAME}] 已连接服务器`);
  
  socket.emit('room:createAI', {
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent'
  }, (res) => {
    if (res && res.roomId) {
      console.log(`✅ [${AGENT_NAME}] 创建房间成功：${res.roomId}`);
    } else {
      console.error(`❌ [${AGENT_NAME}] 创建房间失败：${res?.error || res?.message || '未知错误'}`);
    }
  });
});

// 监听房间更新
socket.on('room:updated', (data) => {
  const room = data.room;
  if (!room) return;
  
  const isHost = room.host === AGENT_ID;
  const playerCount = room.players.length;
  const allReady = room.players.every(p => p.isReady);
  
  console.log(`[紫璃] 房间更新：玩家数=${playerCount}, 全员准备=${allReady}, 房主=${isHost}`);
  
  // 当有 3 个玩家且都准备好时开始游戏
  if (isHost && playerCount >= 3 && allReady && room.state === 'waiting') {
    console.log(`🎮 [${AGENT_NAME}] 全员已准备，开始游戏！`);
    socket.emit('game:start', (gameRes) => {
      console.log(`✅ [${AGENT_NAME}] 游戏开始：${gameRes?.success ? '成功' : gameRes?.message}`);
    });
  }
  
  // 当有 3 个玩家时自动准备
  if (isHost && playerCount >= 3 && room.state === 'waiting') {
    const self = room.players.find(p => p.id === AGENT_ID);
    if (self && !self.isReady) {
      console.log(`🎯 [${AGENT_NAME}] 3 人已到齐，自动准备！`);
      socket.emit('room:ready', { ready: true }, (readyRes) => {
        console.log(`✅ [${AGENT_NAME}] 已准备`);
      });
    }
  }
});

socket.on('disconnect', () => {
  console.log(`⚠️  [${AGENT_NAME}] 断开连接`);
});

// 处理回合
socket.on('agent:your_turn', (data) => {
  console.log(`\n🎯 [${AGENT_NAME}] 回合 - 阶段：${data.phase}`);
  
  if (data.phase === 'draw') {
    console.log(`  → 摸牌`);
    socket.emit('agent:command', { cmd: 'draw' });
  } else if (data.phase === 'discard') {
    const hand = data.hand || [];
    if (hand.length > 0) {
      const randomTile = hand[Math.floor(Math.random() * hand.length)];
      console.log(`  → 打牌：${randomTile.text || randomTile.id}`);
      socket.emit('agent:command', { cmd: 'discard', tileId: randomTile.id });
    } else {
      console.log(`  ⚠️  手牌为空，跳过`);
      socket.emit('agent:command', { cmd: 'pass' });
    }
  }
});

// 处理可执行操作
socket.on('game:actions', (data) => {
  const actions = data.actions || [];
  console.log(`\n🎲 [${AGENT_NAME}] 可操作：${actions.join(', ') || '无'}`);
  
  if (actions.includes('hu')) {
    console.log(`  → 胡！`);
    socket.emit('agent:command', { cmd: 'action', action: 'hu' });
  } else if (actions.includes('gang')) {
    console.log(`  → 杠！`);
    socket.emit('agent:command', { cmd: 'action', action: 'gang' });
  } else if (actions.includes('peng')) {
    console.log(`  → 碰！`);
    socket.emit('agent:command', { cmd: 'action', action: 'peng' });
  } else if (actions.includes('chi')) {
    console.log(`  → 吃！`);
    socket.emit('agent:command', { cmd: 'action', action: 'chi' });
  } else {
    console.log(`  → 跳过`);
    socket.emit('agent:command', { cmd: 'pass' });
  }
});

console.log(`🔄 [${AGENT_NAME}] 等待连接...`);

// 保持进程运行
setInterval(() => {}, 60000);
