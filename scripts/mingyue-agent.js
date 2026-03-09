const { io } = require('socket.io-client');

const AGENT_NAME = '明月';
const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = 'mmeu4825-dddarxdlm';

console.log(`🌙 麻将AI玩家"${AGENT_NAME}"启动中...`);
console.log(`📡 连接服务器：${SERVER_URL}`);
console.log(`🏠 加入房间：${ROOM_ID}`);

const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('✅ 已连接服务器');
  console.log('🔑 申请加入房间...');
  
  socket.emit('room:joinAI', {
    roomId: ROOM_ID,
    agentId: 'mingyue-agent',
    agentName: AGENT_NAME,
    type: 'ai-agent'
  }, (res) => {
    if (res && res.success) {
      console.log(`🎉 成功加入房间 ${ROOM_ID}`);
      console.log(`🎮 玩家ID: ${res.playerId}`);
    } else {
      console.error('❌ 加入房间失败:', res);
    }
  });
});

socket.on('disconnect', () => {
  console.log('⚠️  与服务器断开连接');
});

socket.on('connect_error', (err) => {
  console.error('❌ 连接错误:', err.message);
});

// 收到回合事件
socket.on('agent:your_turn', (data) => {
  console.log('\n🎴 轮到我行动了');
  console.log(`   阶段：${data.phase}`);
  
  if (data.phase === 'draw') {
    console.log('📥 摸牌');
    socket.emit('agent:command', { cmd: 'draw' });
  } else if (data.phase === 'discard') {
    // 随机打一张牌
    const tileId = data.hand?.tiles?.[0]?.id;
    if (tileId) {
      console.log(`🎴 打牌：${tileId}`);
      socket.emit('agent:command', { cmd: 'discard', tileId: tileId });
    } else {
      console.log('⚠️  没有可打的牌，发送 pass');
      socket.emit('agent:command', { cmd: 'pass' });
    }
  }
});

// 收到可行动事件
socket.on('game:actions', (data) => {
  console.log('\n⚡ 收到可行动列表:', data.actions);
  
  if (data.actions.includes('hu')) {
    console.log('🎉 胡牌！');
    socket.emit('agent:command', { cmd: 'action', action: 'hu' });
  } else if (data.actions.includes('peng')) {
    console.log('🀄 碰！');
    socket.emit('agent:command', { cmd: 'action', action: 'peng' });
  } else {
    console.log('⏭️  跳过');
    socket.emit('agent:command', { cmd: 'pass' });
  }
});

// 游戏状态更新
socket.on('game:state', (data) => {
  console.log('📊 游戏状态更新');
});

// 房间信息
socket.on('room:info', (data) => {
  console.log('📋 房间信息:', data);
});

console.log('\n⏳ 保持连接中... (Ctrl+C 退出)');

// 保持进程运行
setInterval(() => {
  // 心跳保持
}, 5000);
