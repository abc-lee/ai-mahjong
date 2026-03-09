const { io } = require('socket.io-client');

const AGENT_ID = 'qingluan';
const AGENT_NAME = '青鸾';
const ROOM_ID = process.argv[2] || 'mmeix7w0-kjgyvyj3oh';  // 从命令行参数获取房间 ID
const SERVER_URL = 'http://localhost:3000';

console.log(`🎴 AI Agent [${AGENT_NAME}] 启动...`);

const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10
});

socket.on('connect', () => {
  console.log(`✅ [${AGENT_NAME}] 已连接服务器`);
  
  // 先尝试加入房间
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent'
  }, (res) => {
    if (res && res.success) {
      console.log(`✅ [${AGENT_NAME}] 加入房间成功：${ROOM_ID}`);
      
      // 自动发送准备
      setTimeout(() => {
        socket.emit('room:ready', { ready: true }, (readyRes) => {
          console.log(`✅ [${AGENT_NAME}] 已准备`);
        });
      }, 500);
    } else {
      console.log(`⚠️  [${AGENT_NAME}] 加入失败，等待创建房间`);
    }
  });
});

socket.on('disconnect', () => {
  console.log(`⚠️  [${AGENT_NAME}] 断开连接`);
});

socket.on('connect_error', (err) => {
  console.error(`❌ [${AGENT_NAME}] 连接错误：${err.message}`);
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

// 处理可执行操作（吃碰杠胡）
socket.on('game:actions', (data) => {
  const actions = data.actions || [];
  console.log(`\n🎲 [${AGENT_NAME}] 可操作：${actions.join(', ') || '无'}`);
  
  // 优先级：hu > gang > peng > chi > pass
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

// 监听游戏消息
socket.on('game:message', (data) => {
  console.log(`💬 [${AGENT_NAME}] 消息：${data.message || JSON.stringify(data)}`);
});

console.log(`🔄 [${AGENT_NAME}] 等待连接...`);

// 保持进程运行
setInterval(() => {}, 60000);
